import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildFiscalSummaryInput } from "../src/application/adapters/index.js";
import { calculateFiscalSummary } from "../src/domain/calculations/facade/index.js";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const SHADOW_PARITY_SOURCE = readFileSync(
  new URL("./shadow-parity-validation.test.js", import.meta.url),
  "utf8",
);
const RUNTIME_EVIDENCE_SOURCE = readFileSync(
  new URL("./runtime-parity-evidence.test.js", import.meta.url),
  "utf8",
);

const APPROVED_COUNTS = Object.freeze({
  fiscalSummaryVisibleSlice: 15,
  buildFiscalSummaryInput: 2,
  calculateFiscalSummary: 2,
});

const REFERENCE_DATE = "2026-07-20";
const RATES = Object.freeze({
  services: 0.22,
  commerce: 0.123,
  mixte: 0.18,
});

const INPUT_PARITY_SCENARIOS = Object.freeze([
  { id: "revenue-zero", values: [], activityType: "services", reachability: "reachable in production" },
  { id: "revenue-positive", values: [1000], activityType: "services", reachability: "reachable in production" },
  {
    id: "multiple-revenues",
    values: [1000, 250, 75],
    activityType: "services",
    reachability: "reachable in production",
  },
  { id: "service", values: [1000], activityType: "services", reachability: "reachable in production" },
  { id: "commerce", values: [1000], activityType: "commerce", reachability: "reachable in production" },
  { id: "mixte", values: [1000], activityType: "mixte", reachability: "reachable in production" },
  {
    id: "acre-inactive",
    values: [1000],
    activityType: "services",
    acre: "no",
    reachability: "reachable in production",
  },
  {
    id: "acre-active",
    values: [1000],
    activityType: "services",
    acre: "yes",
    acreStartDate: "2026-01-01",
    // LOT 10.1B: pre-reform business so the historical flat-50% stand-in in
    // contributionRate() below remains an accurate proxy for this scenario.
    businessStartDate: "2020-01-01",
    reachability: "reachable in production",
  },
  { id: "contribution-zero", values: [], activityType: "services", reachability: "reachable in production" },
  { id: "decimal-amount", values: [1234.56], activityType: "services", reachability: "reachable in production" },
  { id: "low-contribution", values: [25], activityType: "services", reachability: "reachable in production" },
  { id: "high-contribution", values: [25000], activityType: "services", reachability: "reachable in production" },
  { id: "revenue-added-before", values: [1000], activityType: "services", reachability: "reachable in production" },
  {
    id: "revenue-added-after",
    values: [1000, 500],
    activityType: "services",
    reachability: "reachable in production",
  },
  {
    id: "revenue-removed-before",
    values: [1000, 500],
    activityType: "services",
    reachability: "reachable in production",
  },
  {
    id: "revenue-removed-after",
    values: [1000],
    activityType: "services",
    reachability: "reachable in production",
  },
  {
    id: "last-revenue-removed-before",
    values: [500],
    activityType: "services",
    reachability: "reachable in production",
  },
  {
    id: "last-revenue-removed-after",
    values: [],
    activityType: "services",
    reachability: "reachable in production",
  },
]);

function sourceWithoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function occurrences(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

function extractBlock(startText, endText) {
  const start = APP_SOURCE.indexOf(startText);
  assert.notEqual(start, -1, `Missing block start: ${startText}`);
  const end = APP_SOURCE.indexOf(endText, start);
  assert.notEqual(end, -1, `Missing block end: ${endText}`);
  return APP_SOURCE.slice(start, end);
}

function buildSmartAlertsFunctionBlock() {
  return extractBlock("function buildSmartAlerts({", "function buildSmartPriorities(");
}

function smartAlertsBlock() {
  return extractBlock("const smartAlerts = useMemo", "  const smartPriorities = useMemo");
}

function visibleSliceBlock() {
  return extractBlock(
    "const fiscalSummaryVisibleSlice = useMemo(() => {",
    "  // ==================== PREVIEW POUR MODALE AJOUT REVENU ====================",
  );
}

function appWithoutVisibleSlice() {
  return sourceWithoutComments(APP_SOURCE).replace(sourceWithoutComments(visibleSliceBlock()), "");
}

function revenueTotal(values) {
  return values.reduce((sum, amount) => sum + amount, 0);
}

function contributionRate({ activityType, acre = "no" }) {
  const baseRate = RATES[activityType] ?? 0;
  return acre === "yes" && baseRate > 0 ? baseRate / 2 : baseRate;
}

function legacyEstimatedCharges(scenario) {
  return Math.round(revenueTotal(scenario.values) * contributionRate(scenario));
}

function revenuesFrom(values) {
  return values.map((amount, index) => ({
    id: `lot-5-61-revenue-${index}`,
    amount,
    category: "service",
    date: `2026-07-${String(index + 1).padStart(2, "0")}`,
  }));
}

function shadowFinalContributionAmount(scenario) {
  const input = buildFiscalSummaryInput({
    revenues: revenuesFrom(scenario.values),
    fiscalProfile: {
      activity_type: scenario.activityType,
      acre: scenario.acre ?? "no",
      acre_start_date: scenario.acreStartDate ?? "",
      business_start_date: scenario.businessStartDate ?? "",
    },
    period: {},
    referenceDate: REFERENCE_DATE,
  });

  return calculateFiscalSummary(input, { trace: false }).summary.finalContributionAmount;
}

function compareInputParity(scenario) {
  const legacyInput = legacyEstimatedCharges(scenario);
  const shadowInput = shadowFinalContributionAmount(scenario);

  return {
    scenarioId: scenario.id,
    reachability: scenario.reachability,
    legacyInput,
    shadowInput,
    status: Object.is(legacyInput, shadowInput) ? "MATCH" : "MISMATCH",
  };
}

function reserveLowState({ currentMonthTotal, chargesInput }) {
  const rawAvailable = Number(currentMonthTotal || 0) - Number(chargesInput || 0);

  return chargesInput > 0 && rawAvailable < chargesInput ? "ALERT_ON" : "ALERT_OFF";
}

function freezeDeep(value) {
  if (!value || typeof value !== "object") return value;

  Object.freeze(value);

  for (const child of Object.values(value)) {
    freezeDeep(child);
  }

  return value;
}

test("LOT 5.61 identifies the exact Legacy input and reserve-low condition", () => {
  const smartFunction = sourceWithoutComments(buildSmartAlertsFunctionBlock());
  const smartCall = sourceWithoutComments(smartAlertsBlock());

  assert.match(smartFunction, /estimatedCharges = 0/);
  assert.match(smartFunction, /currentMonthTotal = 0/);
  assert.match(
    smartFunction,
    /const rawAvailable = Number\(currentMonthTotal \|\| 0\) - Number\(estimatedCharges \|\| 0\);/,
  );
  assert.match(smartFunction, /if \(estimatedCharges > 0 && rawAvailable < estimatedCharges\)/);
  assert.match(smartFunction, /id: "reserve-low"/);
  assert.match(smartFunction, /level: "warning"/);
  assert.match(smartFunction, /title: "Reserve a renforcer"|title: "Réserve à renforcer"/);
  assert.match(smartFunction, /La réserve actuelle couvre moins d.un cycle de charges estimées\./);
  assert.doesNotMatch(smartFunction, /Math\.round\(estimatedCharges|parseFloat\(estimatedCharges/);
  assert.match(smartCall, /estimatedCharges: smartAlertEstimatedCharges/);
  assert.match(smartCall, /currentMonthTotal: smartAlertRevenueTotal/);
  assert.doesNotMatch(smartCall, /\bestimatedCharges,\s*\n\s*currentMonthTotal/);
  assert.doesNotMatch(smartCall, /fiscalSummaryVisibleSlice\.finalContributionAmount/);
});

test("LOT 5.61 identifies the Shadow candidate and feature-flag fallback contract", () => {
  const selector = sourceWithoutComments(visibleSliceBlock());

  assert.match(selector, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/);
  assert.match(
    selector,
    /finalContributionAmount: usesShadow\s*\?\s*shadowResult\.summary\.finalContributionAmount\s*:\s*estimatedCharges/,
  );
  assert.equal(shadowFinalContributionAmount({ id: "candidate", values: [1000], activityType: "services" }), 220);
  assert.equal(legacyEstimatedCharges({ id: "legacy", values: [1000], activityType: "services" }), 220);
});

test("LOT 5.61 proves strict input MATCH for supported reserve-low input scenarios", () => {
  const results = INPUT_PARITY_SCENARIOS.map(compareInputParity);

  assert.deepEqual(
    results.map((result) => [result.scenarioId, result.status]),
    INPUT_PARITY_SCENARIOS.map((scenario) => [scenario.id, "MATCH"]),
  );
  assert.ok(results.every((result) => result.reachability === "reachable in production"));
});

test("LOT 5.61 covers service, commerce, mixte and ACRE input parity", () => {
  const scenarios = [
    { id: "service", values: [1000], activityType: "services" },
    { id: "commerce", values: [1000], activityType: "commerce" },
    { id: "mixte", values: [1000], activityType: "mixte" },
    { id: "acre-inactive", values: [1000], activityType: "services", acre: "no" },
    {
      id: "acre-active",
      values: [1000],
      activityType: "services",
      acre: "yes",
      acreStartDate: "2026-01-01",
      businessStartDate: "2020-01-01",
    },
  ];

  assert.deepEqual(
    scenarios.map(compareInputParity),
    [
      { scenarioId: "service", reachability: undefined, legacyInput: 220, shadowInput: 220, status: "MATCH" },
      { scenarioId: "commerce", reachability: undefined, legacyInput: 123, shadowInput: 123, status: "MATCH" },
      { scenarioId: "mixte", reachability: undefined, legacyInput: 180, shadowInput: 180, status: "MATCH" },
      { scenarioId: "acre-inactive", reachability: undefined, legacyInput: 220, shadowInput: 220, status: "MATCH" },
      { scenarioId: "acre-active", reachability: undefined, legacyInput: 110, shadowInput: 110, status: "MATCH" },
    ],
  );
});

test("LOT 5.61 characterizes near-threshold reserve-low boundary without changing it", () => {
  const chargesInput = 100;

  assert.equal(reserveLowState({ currentMonthTotal: 199, chargesInput }), "ALERT_ON");
  assert.equal(reserveLowState({ currentMonthTotal: 200, chargesInput }), "ALERT_OFF");
  assert.equal(reserveLowState({ currentMonthTotal: 201, chargesInput }), "ALERT_OFF");
  assert.equal(reserveLowState({ currentMonthTotal: 0, chargesInput: 0 }), "ALERT_OFF");
});

test("LOT 5.61 keeps MATCH inputs from changing reserve-low ON/OFF behavior", () => {
  for (const scenario of INPUT_PARITY_SCENARIOS) {
    const result = compareInputParity(scenario);
    const total = revenueTotal(scenario.values);

    assert.equal(result.status, "MATCH", scenario.id);
    assert.equal(
      reserveLowState({ currentMonthTotal: total, chargesInput: result.legacyInput }),
      reserveLowState({ currentMonthTotal: total, chargesInput: result.shadowInput }),
      scenario.id,
    );
  }
});

test("LOT 5.61 preserves intentional mismatch visibility and impact classification", () => {
  const mismatch = {
    scenarioId: "intentional-mismatch",
    legacyInput: 100,
    shadowInput: 101,
    status: Object.is(100, 101) ? "MATCH" : "MISMATCH",
  };

  assert.equal(mismatch.status, "MISMATCH");
  assert.equal(reserveLowState({ currentMonthTotal: 201, chargesInput: mismatch.legacyInput }), "ALERT_OFF");
  assert.equal(reserveLowState({ currentMonthTotal: 201, chargesInput: mismatch.shadowInput }), "ALERT_ON");
});

test("LOT 5.61 is deterministic for same input and cloned input", () => {
  const scenario = { id: "deterministic", values: [1234.56, 789], activityType: "services" };
  const first = compareInputParity(scenario);
  const second = compareInputParity(scenario);
  const cloned = compareInputParity(structuredClone(scenario));

  assert.deepEqual(first, second);
  assert.deepEqual(first, cloned);
});

test("LOT 5.61 does not mutate scenario, revenues, Shadow input or Shadow result", () => {
  const scenario = freezeDeep({ id: "mutation", values: [1000, 250], activityType: "services" });
  const beforeScenario = structuredClone(scenario);
  const revenues = freezeDeep(revenuesFrom(scenario.values));
  const fiscalProfile = freezeDeep({
    activity_type: scenario.activityType,
    acre: "no",
    acre_start_date: "",
  });
  const shadowInput = freezeDeep(
    buildFiscalSummaryInput({
      revenues,
      fiscalProfile,
      period: {},
      referenceDate: REFERENCE_DATE,
    }),
  );
  const beforeInput = structuredClone(shadowInput);
  const shadowResult = freezeDeep(calculateFiscalSummary(shadowInput, { trace: false }));
  const beforeResult = structuredClone(shadowResult);

  compareInputParity(scenario);

  assert.deepEqual(scenario, beforeScenario);
  assert.deepEqual(shadowInput, beforeInput);
  assert.deepEqual(shadowResult, beforeResult);
});

test("LOT 5.61 uses no implicit time, persistence, network or randomness in the evidence file", () => {
  const evidenceHelpers = [
    revenueTotal,
    contributionRate,
    legacyEstimatedCharges,
    revenuesFrom,
    shadowFinalContributionAmount,
    compareInputParity,
    reserveLowState,
  ]
    .map((helper) => helper.toString())
    .join("\n");

  assert.doesNotMatch(evidenceHelpers, /\bDate\.now\b/);
  assert.doesNotMatch(evidenceHelpers, /\bnew\s+Date\b/);
  assert.doesNotMatch(evidenceHelpers, /\bMath\.random\b/);
  assert.doesNotMatch(evidenceHelpers, /\blocalStorage\b/);
  assert.doesNotMatch(evidenceHelpers, /\bsessionStorage\b/);
  assert.doesNotMatch(evidenceHelpers, /\bsupabase\b/i);
  assert.doesNotMatch(evidenceHelpers, /\bfetch\s*\(/);
});

test("LOT 5.61 keeps parity evidence intact after the approved smart alert migration", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const smartCall = sourceWithoutComments(smartAlertsBlock());

  assert.equal(occurrences(app, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(occurrences(app, /\bbuildFiscalSummaryInput\b/g), APPROVED_COUNTS.buildFiscalSummaryInput);
  assert.equal(occurrences(app, /\bcalculateFiscalSummary\b/g), APPROVED_COUNTS.calculateFiscalSummary);
  assert.equal(occurrences(appWithoutVisibleSlice(), /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 7);
  assert.match(app, /const smartAlertEstimatedCharges =\s*fiscalSummaryVisibleSlice\.finalContributionAmount;/);
  assert.match(smartCall, /estimatedCharges: smartAlertEstimatedCharges/);
  assert.match(smartCall, /smartAlertEstimatedCharges,\s*\n\s*smartAlertRevenueTotal/);
  assert.doesNotMatch(smartCall, /\bestimatedCharges,\s*\n\s*currentMonthTotal/);
  assert.doesNotMatch(smartCall, /shadowResult/);
});

test("LOT 5.61 confirms no propagation to sensitive adjacent consumers", () => {
  const smartCall = sourceWithoutComments(smartAlertsBlock());

  assert.doesNotMatch(
    smartCall,
    /localStorage|sessionStorage|supabase|payload|feedback|analytics|handleExportPDF|export_csv|export_pdf|assistant|coaching|savingsGoal|invoiceSectionSummary|handleMarkInvoicePaid/i,
  );
  assert.match(smartCall, /reminderPrefs/);
  assert.match(SHADOW_PARITY_SOURCE, /strict identity/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
});
