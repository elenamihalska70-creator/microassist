import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildFiscalSummaryInput } from "../src/application/adapters/index.js";
import { calculateFiscalSummary } from "../src/domain/calculations/facade/index.js";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const LOT_5_61_SOURCE = readFileSync(
  new URL("./lot-5-61-smart-alert-reserve-low-parity-evidence.test.js", import.meta.url),
  "utf8",
);
const LOT_5_65_SOURCE = readFileSync(
  new URL("./lot-5-65-smart-alert-reserve-low-migration-validation.test.js", import.meta.url),
  "utf8",
);
const LOT_5_66_SOURCE = readFileSync(
  new URL("./lot-5-66-smart-alert-reserve-low-stabilization.test.js", import.meta.url),
  "utf8",
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
  fiscalSummaryVisibleSlice: 13,
});
const REFERENCE_DATE = "2026-07-20";
const ALERT_ON = "ALERT_ON";
const ALERT_OFF = "ALERT_OFF";

const REVENUE_PARITY_SCENARIOS = Object.freeze([
  { id: "revenue-zero", values: [], activityType: "services" },
  { id: "positive-revenue", values: [1000], activityType: "services" },
  { id: "decimal-revenue", values: [1000.5, 249.25], activityType: "services" },
  { id: "multiple-revenues", values: [1000, 250, 75], activityType: "services" },
  { id: "add-revenue-before", values: [1000], activityType: "services" },
  { id: "add-revenue-after", values: [1000, 500], activityType: "services" },
  { id: "remove-revenue-before", values: [1000, 500], activityType: "services" },
  { id: "remove-revenue-after", values: [1000], activityType: "services" },
  { id: "remove-last-revenue-before", values: [1000], activityType: "services" },
  { id: "remove-last-revenue-after", values: [], activityType: "services" },
  { id: "zero-to-positive-before", values: [], activityType: "services" },
  { id: "zero-to-positive-after", values: [333], activityType: "services" },
  { id: "positive-to-zero-before", values: [333], activityType: "services" },
  { id: "positive-to-zero-after", values: [], activityType: "services" },
  { id: "charges-zero", values: [], activityType: "commerce", chargesInput: 0 },
  { id: "charges-positive", values: [1000], activityType: "commerce" },
  { id: "low-reserve", values: [199], activityType: "services", chargesInput: 100 },
  { id: "high-reserve", values: [1000], activityType: "services", chargesInput: 100 },
  { id: "acre-inactive", values: [1000], activityType: "services", acre: "no" },
  {
    id: "acre-active",
    values: [1000],
    activityType: "services",
    acre: "yes",
    acreStartDate: "2026-01-01",
  },
]);

const THRESHOLD_SCENARIOS = Object.freeze([
  { id: "threshold-below", legacyRevenue: 199, shadowRevenue: 199, chargesInput: 100, expected: ALERT_ON },
  { id: "threshold-exact", legacyRevenue: 200, shadowRevenue: 200, chargesInput: 100, expected: ALERT_OFF },
  { id: "threshold-above", legacyRevenue: 201, shadowRevenue: 201, chargesInput: 100, expected: ALERT_OFF },
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

function feedbackBlock() {
  return extractBlock("const feedbackContextSnapshot = useMemo", "  const monthlyReflectionRevenueTotal");
}

function appWithoutVisibleSlice() {
  return sourceWithoutComments(APP_SOURCE).replace(sourceWithoutComments(visibleSliceBlock()), "");
}

function revenueTotal(values = []) {
  return values.reduce((sum, amount) => sum + amount, 0);
}

function revenuesFrom(values = []) {
  return values.map((amount, index) => ({
    id: `lot-5-68-revenue-${index}`,
    amount,
    category: "service",
    revenueCategory: "service",
    date: `2026-07-${String(index + 1).padStart(2, "0")}`,
  }));
}

function shadowRevenueTotal(scenario) {
  const input = buildFiscalSummaryInput({
    revenues: revenuesFrom(scenario.values),
    fiscalProfile: {
      activity_type: scenario.activityType,
      acre: scenario.acre ?? "no",
      acre_start_date: scenario.acreStartDate ?? "",
    },
    period: {},
    referenceDate: REFERENCE_DATE,
  });

  return calculateFiscalSummary(input, { trace: false }).revenue.total;
}

function legacyRevenueInput(scenario) {
  return revenueTotal(scenario.values);
}

function rawAvailable({ revenueInput, chargesInput }) {
  return Number(revenueInput || 0) - Number(chargesInput || 0);
}

function reserveLowAlert({ revenueInput, chargesInput }) {
  const available = rawAvailable({ revenueInput, chargesInput });

  if (chargesInput > 0 && available < chargesInput) {
    return {
      state: ALERT_ON,
      id: "reserve-low",
      level: "warning",
      title: "Réserve à renforcer",
      text: "La réserve actuelle couvre moins d’un cycle de charges estimées.",
      cta: "Ajouter une dépense",
      action: "profile",
      rawAvailable: available,
    };
  }

  return {
    state: ALERT_OFF,
    rawAvailable: available,
  };
}

function compareRevenuePath({ legacyRevenue, shadowRevenue, chargesInput }) {
  const legacyAlert = reserveLowAlert({ revenueInput: legacyRevenue, chargesInput });
  const shadowAlert = reserveLowAlert({ revenueInput: shadowRevenue, chargesInput });

  return {
    revenueStatus: Object.is(legacyRevenue, shadowRevenue) ? "MATCH" : "MISMATCH",
    rawAvailableStatus: Object.is(legacyAlert.rawAvailable, shadowAlert.rawAvailable)
      ? "MATCH"
      : "MISMATCH",
    alertStatus: legacyAlert.state === shadowAlert.state ? "MATCH" : "MISMATCH",
    legacyAlert,
    shadowAlert,
  };
}

function selectVisibleRevenueTotal({ flagEnabled, shadowResult, currentMonthTotal }) {
  const usesShadow = Boolean(flagEnabled && shadowResult);
  return usesShadow ? shadowResult.revenue.total : currentMonthTotal;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;

  Object.freeze(value);

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}

test("LOT 5.68 characterizes the current Legacy revenue input in rawAvailable", () => {
  const smartFunction = sourceWithoutComments(buildSmartAlertsFunctionBlock());
  const smartCall = sourceWithoutComments(smartAlertsBlock());

  assert.match(smartFunction, /currentMonthTotal = 0/);
  assert.match(
    smartFunction,
    /const rawAvailable = Number\(currentMonthTotal \|\| 0\) - Number\(estimatedCharges \|\| 0\);/,
  );
  assert.match(smartFunction, /if \(estimatedCharges > 0 && rawAvailable < estimatedCharges\)/);
  assert.doesNotMatch(
    smartFunction,
    /const rawAvailable = Math\.|const rawAvailable = parseFloat|const rawAvailable = .*toFixed|const rawAvailable = .*toLocaleString/,
  );
  assert.match(smartCall, /estimatedCharges: smartAlertEstimatedCharges/);
  assert.match(smartCall, /currentMonthTotal: smartAlertRevenueTotal/);
});

test("LOT 5.68 characterizes the Shadow revenueTotal candidate and visible selector fallback", () => {
  const visibleSlice = sourceWithoutComments(visibleSliceBlock());

  assert.match(visibleSlice, /revenueTotal: usesShadow\s*\?\s*shadowResult\.revenue\.total\s*:\s*currentMonthTotal/);
  assert.equal(
    selectVisibleRevenueTotal({
      flagEnabled: true,
      shadowResult: { revenue: { total: 1250 } },
      currentMonthTotal: 999,
    }),
    1250,
  );
  assert.equal(
    selectVisibleRevenueTotal({
      flagEnabled: false,
      shadowResult: { revenue: { total: 1250 } },
      currentMonthTotal: 999,
    }),
    999,
  );
  assert.equal(
    selectVisibleRevenueTotal({
      flagEnabled: true,
      shadowResult: null,
      currentMonthTotal: 999,
    }),
    999,
  );
});

test("LOT 5.68 proves strict revenue input MATCH for reachable scenarios", () => {
  for (const scenario of REVENUE_PARITY_SCENARIOS) {
    assert.equal(
      Object.is(legacyRevenueInput(scenario), shadowRevenueTotal(scenario)),
      true,
      `${scenario.id} revenue input mismatch`,
    );
  }
});

test("LOT 5.68 proves rawAvailable MATCH with all non-revenue inputs held identical", () => {
  for (const scenario of REVENUE_PARITY_SCENARIOS) {
    const legacyRevenue = legacyRevenueInput(scenario);
    const shadowRevenue = shadowRevenueTotal(scenario);
    const chargesInput = scenario.chargesInput ?? Math.round(shadowRevenue * 0.22);
    const result = compareRevenuePath({ legacyRevenue, shadowRevenue, chargesInput });

    assert.equal(result.revenueStatus, "MATCH", `${scenario.id} revenue`);
    assert.equal(result.rawAvailableStatus, "MATCH", `${scenario.id} rawAvailable`);
  }
});

test("LOT 5.68 proves reserve-low alert ON/OFF and message parity", () => {
  const scenarios = [
    { id: "alert-on", legacyRevenue: 199, shadowRevenue: 199, chargesInput: 100 },
    { id: "alert-off", legacyRevenue: 250, shadowRevenue: 250, chargesInput: 100 },
  ];

  for (const scenario of scenarios) {
    const result = compareRevenuePath(scenario);

    assert.equal(result.alertStatus, "MATCH", scenario.id);
    assert.equal(result.legacyAlert.state, result.shadowAlert.state, scenario.id);
    assert.equal(result.legacyAlert.level, result.shadowAlert.level, scenario.id);
    assert.equal(result.legacyAlert.title, result.shadowAlert.title, scenario.id);
    assert.equal(result.legacyAlert.text, result.shadowAlert.text, scenario.id);
  }
});

test("LOT 5.68 locks threshold boundaries without tolerance", () => {
  for (const scenario of THRESHOLD_SCENARIOS) {
    const result = compareRevenuePath(scenario);

    assert.equal(result.revenueStatus, "MATCH", scenario.id);
    assert.equal(result.rawAvailableStatus, "MATCH", scenario.id);
    assert.equal(result.alertStatus, "MATCH", scenario.id);
    assert.equal(result.legacyAlert.state, scenario.expected, scenario.id);
    assert.equal(result.shadowAlert.state, scenario.expected, scenario.id);
  }
});

test("LOT 5.68 exposes intentional revenue, rawAvailable and ON/OFF mismatch", () => {
  const mismatch = compareRevenuePath({
    legacyRevenue: 200,
    shadowRevenue: 199,
    chargesInput: 100,
  });

  assert.equal(mismatch.revenueStatus, "MISMATCH");
  assert.equal(mismatch.rawAvailableStatus, "MISMATCH");
  assert.equal(mismatch.alertStatus, "MISMATCH");
  assert.equal(mismatch.legacyAlert.state, ALERT_OFF);
  assert.equal(mismatch.shadowAlert.state, ALERT_ON);
});

test("LOT 5.68 keeps higher and lower priority smart-alert branches outside revenue migration scope", () => {
  const smartFunction = sourceWithoutComments(buildSmartAlertsFunctionBlock());

  assert.match(smartFunction, /computed\?\.tvaStatus === "exceeded"[\s\S]*id: "tva-threshold"/);
  // LOT 10.1D: ACRE timing now derives from the canonical, reform-aware
  // computed.acreStatus/acreEndDate instead of an independent
  // acre_start_date + 12 months guess.
  assert.match(smartFunction, /computed\?\.acreStatus === "active"[\s\S]*id: "acre-ending"/);
  assert.match(smartFunction, /id: "reserve-low"[\s\S]*revenues\.length <= 2[\s\S]*id: "early-tracking"/);
  assert.match(smartFunction, /id: "all-clear"/);
  assert.doesNotMatch(smartFunction, /fiscalSummaryVisibleSlice\.revenueTotal|smartAlertEstimatedCharges/);
});

test("LOT 5.68 proves same-input and cloned-input determinism", () => {
  const scenario = { id: "same-input", values: [1000, 250], activityType: "services" };
  const clone = structuredClone(scenario);

  assert.equal(shadowRevenueTotal(scenario), shadowRevenueTotal(scenario));
  assert.equal(shadowRevenueTotal(scenario), shadowRevenueTotal(clone));
  assert.deepEqual(
    compareRevenuePath({ legacyRevenue: 1250, shadowRevenue: 1250, chargesInput: 100 }),
    compareRevenuePath({ legacyRevenue: 1250, shadowRevenue: 1250, chargesInput: 100 }),
  );
});

test("LOT 5.68 evidence helpers do not mutate input scenarios", () => {
  const scenario = deepFreeze({
    id: "frozen-input",
    values: [1000, 250],
    activityType: "services",
    acre: "no",
  });

  assert.equal(legacyRevenueInput(scenario), 1250);
  assert.equal(shadowRevenueTotal(scenario), 1250);
  assert.deepEqual(scenario, {
    id: "frozen-input",
    values: [1000, 250],
    activityType: "services",
    acre: "no",
  });
});

test("LOT 5.68 evidence file has no implicit time, persistence, network or randomness dependency", () => {
  const helperSource = [
    shadowRevenueTotal,
    legacyRevenueInput,
    rawAvailable,
    reserveLowAlert,
    compareRevenuePath,
    selectVisibleRevenueTotal,
  ]
    .map((helper) => helper.toString())
    .join("\n");

  assert.doesNotMatch(helperSource, /Date\.now\(|new Date\(|Math\.random\(|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(helperSource, /localStorage|sessionStorage|supabase/i);
});

test("LOT 5.68 confirms approved smart alert revenue migration remains source-only", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const smartCall = sourceWithoutComments(smartAlertsBlock());

  assert.equal(occurrences(app, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_COUNTS.fiscalSummaryVisibleSlice);
  assert.match(app, /const smartAlertRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/);
  assert.match(smartCall, /currentMonthTotal: smartAlertRevenueTotal/);
  assert.match(smartCall, /smartAlertRevenueTotal,\s*\n\s*\]/);
  assert.doesNotMatch(smartCall, /revenueTotal:\s*fiscalSummaryVisibleSlice\.revenueTotal/);
  assert.equal(occurrences(appWithoutVisibleSlice(), /fiscalSummaryVisibleSlice\.revenueTotal/g), 4);
});

test("LOT 5.68 confirms no propagation to retained Legacy revenue consumers", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const smartCall = sourceWithoutComments(smartAlertsBlock());
  const feedback = sourceWithoutComments(feedbackBlock());

  assert.match(app, /realMonthlyRevenue: currentMonthTotal/);
  assert.match(feedback, /totalRevenues: currentMonthTotal \|\| 0/);
  assert.match(app, /getDisplayValue\(currentMonthTotal, "money"\)/);
  assert.match(smartCall, /invoices: visibleInvoices/);
  assert.match(smartCall, /reminderPrefs/);
  assert.doesNotMatch(smartCall, /payload|localStorage|sessionStorage|supabase|feedback|analytics|export|PDF|coaching|weekly/i);
});

test("LOT 5.68 confirms parity and runtime evidence remain intact", () => {
  assert.match(LOT_5_61_SOURCE, /intentional mismatch/i);
  assert.match(LOT_5_65_SOURCE, /reserve-low threshold/i);
  assert.match(LOT_5_66_SOURCE, /boundary/i);
  assert.match(SHADOW_PARITY_SOURCE, /SHADOW_PARITY_MATCH/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /SHADOW_PARITY_MISMATCH/);
});
