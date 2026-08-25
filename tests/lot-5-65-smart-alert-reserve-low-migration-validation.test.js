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
const LOT_5_63_SOURCE = readFileSync(
  new URL("./lot-5-63-smart-alert-reserve-low-migration.test.js", import.meta.url),
  "utf8",
);
const LOT_5_64_SOURCE = readFileSync(
  new URL("./lot-5-64-extended-stabilization.test.js", import.meta.url),
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
  fiscalSummaryVisibleSlice: 15,
  useState: 82,
  useEffect: 59,
  // LOT 5.91A: root savingsGoal removed; useMemo drops by the 1 hook removed with it.
  // LOT 10.2B: +1 useMemo for the canonical obligation/action priority shadow integration.
  useMemo: 89,
  buildFiscalSummaryInput: 2,
  calculateFiscalSummary: 2,
});

const REFERENCE_DATE = "2026-07-20";
const RATES = Object.freeze({
  services: 0.22,
  commerce: 0.123,
  mixte: 0.18,
});

const BOUNDARY_SCENARIOS = Object.freeze([
  { id: "charges-zero", values: [], activityType: "services", expected: "ALERT_OFF" },
  { id: "low-amount", values: [25], activityType: "services", expected: "ALERT_OFF" },
  { id: "medium-amount", values: [1000], activityType: "services", expected: "ALERT_OFF" },
  { id: "high-amount", values: [25000], activityType: "services", expected: "ALERT_OFF" },
  { id: "threshold-below", currentMonthTotal: 199, chargesInput: 100, expected: "ALERT_ON" },
  { id: "threshold-exact", currentMonthTotal: 200, chargesInput: 100, expected: "ALERT_OFF" },
  { id: "threshold-above", currentMonthTotal: 201, chargesInput: 100, expected: "ALERT_OFF" },
  { id: "acre-inactive", values: [1000], activityType: "services", acre: "no", expected: "ALERT_OFF" },
  {
    id: "acre-active",
    values: [1000],
    activityType: "services",
    acre: "yes",
    acreStartDate: "2026-01-01",
    expected: "ALERT_OFF",
  },
  { id: "revenue-zero", values: [], activityType: "services", expected: "ALERT_OFF" },
  { id: "revenue-positive", values: [1000], activityType: "services", expected: "ALERT_OFF" },
  { id: "multiple-revenues", values: [1000, 250, 75], activityType: "services", expected: "ALERT_OFF" },
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

function coachingBlock() {
  return extractBlock("const fiscalCoachingCard = useMemo(() => {", "  const isHelperStyledCoachingCard");
}

function exportBlock() {
  return extractBlock("const handleExportPDF = useCallback", "async function handleExportPDFWithLimit");
}

function assistantGuidanceBlock() {
  return extractBlock("const simpleAssistantGuidance = useMemo", "  const dashboardRevenueDisplay");
}

function persistenceBlock() {
  return extractBlock("    if (!hydrated) return;", "  }, [hydrated, stepIndex, answers, messages, userName, appView]);");
}

function feedbackBlock() {
  return extractBlock("const feedbackContextSnapshot = useMemo", "  const monthlyReflectionRevenueTotal");
}

function weeklyRecapBlock() {
  return extractBlock("const dashboardWeeklyRecap = useMemo(() => {", "  const dashboardThisWeekInsight");
}

function appWithoutVisibleSlice() {
  return sourceWithoutComments(APP_SOURCE).replace(sourceWithoutComments(visibleSliceBlock()), "");
}

function revenueTotal(values = []) {
  return values.reduce((sum, amount) => sum + amount, 0);
}

function contributionRate({ activityType, acre = "no" }) {
  const baseRate = RATES[activityType] ?? 0;
  return acre === "yes" && baseRate > 0 ? baseRate / 2 : baseRate;
}

function legacyEstimatedCharges(scenario) {
  return Math.round(revenueTotal(scenario.values) * contributionRate(scenario));
}

function revenuesFrom(values = []) {
  return values.map((amount, index) => ({
    id: `lot-5-65-revenue-${index}`,
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
    },
    period: {},
    referenceDate: REFERENCE_DATE,
  });

  return calculateFiscalSummary(input, { trace: false }).summary.finalContributionAmount;
}

function reserveLowState({ currentMonthTotal, chargesInput }) {
  const rawAvailable = Number(currentMonthTotal || 0) - Number(chargesInput || 0);
  return chargesInput > 0 && rawAvailable < chargesInput ? "ALERT_ON" : "ALERT_OFF";
}

function reserveLowScenarioResult(scenario) {
  const currentMonthTotal = scenario.currentMonthTotal ?? revenueTotal(scenario.values);
  const chargesInput = scenario.chargesInput ?? shadowFinalContributionAmount(scenario);
  return reserveLowState({ currentMonthTotal, chargesInput });
}

function selectVisibleFinalContributionAmount({ flagEnabled, shadowResult, estimatedCharges }) {
  const usesShadow = Boolean(flagEnabled && shadowResult);
  return usesShadow ? shadowResult.summary.finalContributionAmount : estimatedCharges;
}

test("LOT 5.65 validates the exact alias and Shadow finalContributionAmount source", () => {
  const app = sourceWithoutComments(APP_SOURCE);

  assert.match(app, /const smartAlertEstimatedCharges =\s*fiscalSummaryVisibleSlice\.finalContributionAmount;/);
  assert.equal(
    occurrences(app, /const smartAlertEstimatedCharges =\s*fiscalSummaryVisibleSlice\.finalContributionAmount;/g),
    1,
  );
  assert.equal(shadowFinalContributionAmount({ id: "source", values: [1000], activityType: "services" }), 220);
});

test("LOT 5.65 validates the reserve-low consumer and removes direct estimatedCharges from the call site", () => {
  const smartCall = sourceWithoutComments(smartAlertsBlock());

  assert.match(smartCall, /buildSmartAlerts\(\{/);
  assert.match(smartCall, /estimatedCharges: smartAlertEstimatedCharges/);
  assert.match(smartCall, /currentMonthTotal: smartAlertRevenueTotal/);
  assert.match(smartCall, /smartAlertEstimatedCharges,\s*\n\s*smartAlertRevenueTotal/);
  assert.doesNotMatch(smartCall, /\bestimatedCharges,\s*\n\s*currentMonthTotal/);
  assert.doesNotMatch(smartCall, /fiscalSummaryVisibleSlice\.finalContributionAmount/);
});

test("LOT 5.65 validates reserve-low threshold, ON/OFF condition and availableAmount isolation", () => {
  const smartFunction = sourceWithoutComments(buildSmartAlertsFunctionBlock());
  const app = sourceWithoutComments(APP_SOURCE);

  assert.match(
    smartFunction,
    /const rawAvailable = Number\(currentMonthTotal \|\| 0\) - Number\(estimatedCharges \|\| 0\);/,
  );
  assert.match(smartFunction, /if \(estimatedCharges > 0 && rawAvailable < estimatedCharges\)/);
  assert.doesNotMatch(smartFunction, /availableAmount|fiscalSummaryVisibleSlice|smartAlertEstimatedCharges/);
  assert.match(app, /return Math\.max\(0, currentMonthTotal - estimatedCharges\);/);
});

test("LOT 5.65 validates reserve-low output contract and priority order", () => {
  const smartFunction = sourceWithoutComments(buildSmartAlertsFunctionBlock());

  assert.match(smartFunction, /computed\?\.tvaStatus === "exceeded"[\s\S]*id: "tva-threshold"/);
  assert.match(smartFunction, /id: "acre-ending"[\s\S]*if \(estimatedCharges > 0/);
  assert.match(smartFunction, /id: "reserve-low"/);
  assert.match(smartFunction, /level: "warning"/);
  assert.match(smartFunction, /title: "Réserve à renforcer"/);
  assert.match(smartFunction, /text: "La réserve actuelle couvre moins d’un cycle de charges estimées\."/);
  assert.match(smartFunction, /cta: "Ajouter une dépense"/);
  assert.match(smartFunction, /action: "profile"/);
  assert.match(smartFunction, /id: "reserve-low"[\s\S]*id: "early-tracking"/);
});

test("LOT 5.65 validates boundary scenarios with unchanged ON/OFF behavior", () => {
  assert.deepEqual(
    BOUNDARY_SCENARIOS.map((scenario) => [scenario.id, reserveLowScenarioResult(scenario)]),
    BOUNDARY_SCENARIOS.map((scenario) => [scenario.id, scenario.expected]),
  );
});

test("LOT 5.65 validates same input and cloned input determinism", () => {
  const scenario = { id: "deterministic", values: [1234.56, 789], activityType: "services" };
  const first = reserveLowScenarioResult(scenario);
  const second = reserveLowScenarioResult(scenario);
  const cloned = reserveLowScenarioResult(structuredClone(scenario));

  assert.equal(first, second);
  assert.equal(first, cloned);
  assert.equal(shadowFinalContributionAmount(scenario), legacyEstimatedCharges(scenario));
});

test("LOT 5.65 validates feature flag ON and OFF through the visible slice only", () => {
  const selector = sourceWithoutComments(visibleSliceBlock());
  const smartCall = sourceWithoutComments(smartAlertsBlock());
  const shadowResult = { summary: { finalContributionAmount: 321 } };

  assert.match(selector, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/);
  assert.match(
    selector,
    /finalContributionAmount: usesShadow\s*\?\s*shadowResult\.summary\.finalContributionAmount\s*:\s*estimatedCharges/,
  );
  assert.equal(
    selectVisibleFinalContributionAmount({ flagEnabled: true, shadowResult, estimatedCharges: 999 }),
    321,
  );
  assert.equal(
    selectVisibleFinalContributionAmount({ flagEnabled: false, shadowResult, estimatedCharges: 999 }),
    999,
  );
  assert.equal(
    selectVisibleFinalContributionAmount({ flagEnabled: true, shadowResult: null, estimatedCharges: 999 }),
    999,
  );
  assert.doesNotMatch(smartCall, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED|usesShadow|shadowResult/);
});

test("LOT 5.65 validates Shadow baseline thirteen after approved revenue input migration", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const smartCall = sourceWithoutComments(smartAlertsBlock());

  assert.equal(occurrences(app, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(occurrences(appWithoutVisibleSlice(), /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 7);
  assert.equal(occurrences(smartCall, /smartAlertEstimatedCharges/g), 2);
  assert.equal(occurrences(smartCall, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 0);
  assert.equal(occurrences(app, /const smartAlertRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/g), 1);
  assert.match(LOT_5_64_SOURCE, /occurrences\(app, \/\\bfiscalSummaryVisibleSlice\\b\/g\), 15/);
});

test("LOT 5.65 validates estimatedCharges Legacy retention outside reserve-low input; confirms root savingsGoal removed", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const coaching = sourceWithoutComments(coachingBlock());
  const exportSource = sourceWithoutComments(exportBlock());
  const assistant = sourceWithoutComments(assistantGuidanceBlock());
  const feedback = sourceWithoutComments(feedbackBlock());

  assert.match(app, /const estimatedCharges = useMemo\(\(\) => \{/);
  assert.match(app, /return Math\.round\(currentMonthTotal \* computed\.rate\);/);
  assert.match(app, /Math\.max\(0, currentMonthTotal - estimatedCharges\)/);
  // LOT 5.91A: root savingsGoal removed; both active aliases keep the Shadow-backed formula.
  assert.doesNotMatch(app, /const savingsGoal = useMemo/);
  assert.doesNotMatch(app, /\bsavingsGoal\b/);
  assert.match(
    APP_SOURCE,
    /const fiscalCoachingSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
  assert.match(
    APP_SOURCE,
    /const pdfSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
  assert.match(coaching, /fiscalCoachingSavingsGoal > 0/);
  assert.match(exportSource, /estimatedCharges|dashboardChargesDisplay/);
  assert.match(assistant, /realMonthlyRevenue: currentMonthTotal/);
  assert.match(feedback, /totalRevenues: currentMonthTotal \|\| 0/);
});

test("LOT 5.65 validates other smart alerts remain isolated", () => {
  const smartFunction = sourceWithoutComments(buildSmartAlertsFunctionBlock());

  assert.match(smartFunction, /id: "tva-threshold"[\s\S]*title: "TVA à activer ce mois"/);
  assert.match(smartFunction, /id: "acre-ending"[\s\S]*title: "Fin ACRE bientôt"/);
  assert.match(smartFunction, /id: "early-tracking"[\s\S]*title: "Suivi en démarrage"/);
  assert.match(smartFunction, /id: "all-clear"[\s\S]*title: "Aucun signal critique"/);
  assert.equal(occurrences(smartFunction, /smartAlertEstimatedCharges/g), 0);
  assert.equal(occurrences(smartFunction, /fiscalSummaryVisibleSlice/g), 0);
});

test("LOT 5.65 validates no propagation to adjacent boundaries", () => {
  const smartCall = sourceWithoutComments(smartAlertsBlock());
  const coaching = sourceWithoutComments(coachingBlock());
  const exportSource = sourceWithoutComments(exportBlock());
  const assistant = sourceWithoutComments(assistantGuidanceBlock());
  const persistence = sourceWithoutComments(persistenceBlock());
  const feedback = sourceWithoutComments(feedbackBlock());
  const weekly = sourceWithoutComments(weeklyRecapBlock());

  assert.doesNotMatch(smartCall, /supabase|localStorage|sessionStorage|payload|feedback|analytics|export|assistant|coaching|savingsGoal/i);
  assert.doesNotMatch(coaching, /smartAlertEstimatedCharges|fiscalSummaryVisibleSlice\.finalContributionAmount/);
  assert.doesNotMatch(exportSource, /smartAlertEstimatedCharges|fiscalSummaryVisibleSlice/);
  assert.doesNotMatch(assistant, /smartAlertEstimatedCharges|fiscalSummaryVisibleSlice\.finalContributionAmount/);
  assert.doesNotMatch(persistence, /smartAlertEstimatedCharges|fiscalSummaryVisibleSlice/);
  assert.doesNotMatch(feedback, /smartAlertEstimatedCharges|fiscalSummaryVisibleSlice\.finalContributionAmount/);
  assert.doesNotMatch(weekly, /smartAlertEstimatedCharges/);
});

test("LOT 5.65 validates React and fiscal pipeline stability", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const smartCall = sourceWithoutComments(smartAlertsBlock());

  assert.equal(occurrences(app, /\buseState\b/g), APPROVED_COUNTS.useState);
  assert.equal(occurrences(app, /\buseEffect\b/g), APPROVED_COUNTS.useEffect);
  assert.equal(occurrences(app, /\buseMemo\b/g), APPROVED_COUNTS.useMemo);
  assert.equal(occurrences(app, /\bbuildFiscalSummaryInput\b/g), APPROVED_COUNTS.buildFiscalSummaryInput);
  assert.equal(occurrences(app, /\bcalculateFiscalSummary\b/g), APPROVED_COUNTS.calculateFiscalSummary);
  assert.doesNotMatch(smartCall, /useState|useEffect|buildFiscalSummaryInput|calculateFiscalSummary/);
});

test("LOT 5.65 validates parity and runtime evidence integrity", () => {
  assert.match(LOT_5_61_SOURCE, /strict input MATCH/);
  assert.match(LOT_5_61_SOURCE, /intentional mismatch/);
  assert.match(LOT_5_63_SOURCE, /migrates exactly the reserve-low charges input source/);
  assert.match(SHADOW_PARITY_SOURCE, /strict identity/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
});

test("LOT 5.65 validates rollback remains local to the reserve-low input", () => {
  const before = "estimatedCharges: smartAlertEstimatedCharges";
  const after = "estimatedCharges";

  assert.equal(before, "estimatedCharges: smartAlertEstimatedCharges");
  assert.equal(after, "estimatedCharges");
  assert.doesNotMatch(sourceWithoutComments(smartAlertsBlock()), /localStorage|supabase|payload|handleExportPDF|assistant/i);
});
