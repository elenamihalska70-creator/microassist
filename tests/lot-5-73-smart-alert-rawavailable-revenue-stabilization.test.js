import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildFiscalSummaryInput } from "../src/application/adapters/index.js";
import { calculateFiscalSummary } from "../src/domain/calculations/facade/index.js";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const LOT_5_68_SOURCE = readFileSync(
  new URL("./lot-5-68-smart-alert-rawavailable-revenue-parity-evidence.test.js", import.meta.url),
  "utf8",
);
const LOT_5_72_SOURCE = readFileSync(
  new URL("./lot-5-72-smart-alert-rawavailable-revenue-migration-validation.test.js", import.meta.url),
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
  useState: 86, // LOT 10.2D: +5 useState (declaration dossier UI state)
  useEffect: 59, // LOT 10.2D: +1 useEffect (fetch declaration dossiers on user change)
  // LOT 5.91A: root savingsGoal removed, dropping 1 useMemo( call site.
  // LOT 10.2B: +1 useMemo for the canonical obligation/action priority shadow integration.
  useMemo: 92, // LOT 10.2D: +4 useMemo (declaration dossier view selectors)
  buildFiscalSummaryInput: 2,
  calculateFiscalSummary: 2,
});
const REFERENCE_DATE = "2026-07-20";
const ALERT_ON = "ALERT_ON";
const ALERT_OFF = "ALERT_OFF";

const REVENUE_TRANSITIONS = Object.freeze([
  { id: "revenue-zero", values: [], charges: 100, expected: ALERT_ON },
  { id: "revenue-positive", values: [1000], charges: 100, expected: ALERT_OFF },
  { id: "decimal-revenue", values: [125.5, 74.5], charges: 100, expected: ALERT_OFF },
  { id: "multiple-revenues", values: [1000, 250, 75], charges: 100, expected: ALERT_OFF },
  { id: "add-revenue-before", values: [100], charges: 100, expected: ALERT_ON },
  { id: "add-revenue-after", values: [100, 100], charges: 100, expected: ALERT_OFF },
  { id: "remove-revenue-before", values: [100, 100], charges: 100, expected: ALERT_OFF },
  { id: "remove-revenue-after", values: [100], charges: 100, expected: ALERT_ON },
  { id: "last-revenue-removal-before", values: [200], charges: 100, expected: ALERT_OFF },
  { id: "last-revenue-removal-after", values: [], charges: 100, expected: ALERT_ON },
  { id: "zero-to-positive-before", values: [], charges: 100, expected: ALERT_ON },
  { id: "zero-to-positive-after", values: [250], charges: 100, expected: ALERT_OFF },
  { id: "positive-to-zero-before", values: [250], charges: 100, expected: ALERT_OFF },
  { id: "positive-to-zero-after", values: [], charges: 100, expected: ALERT_ON },
]);

const THRESHOLD_TRANSITIONS = Object.freeze([
  { id: "threshold-below", revenue: 199, charges: 100, expected: ALERT_ON },
  { id: "threshold-exact", revenue: 200, charges: 100, expected: ALERT_OFF },
  { id: "threshold-above", revenue: 201, charges: 100, expected: ALERT_OFF },
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
  return extractBlock("const smartAlertEstimatedCharges =", "  const smartPriorities = useMemo");
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

function assistantBlock() {
  return extractBlock("const simpleAssistantGuidance = useMemo", "  const dashboardRevenueDisplay");
}

function exportBlock() {
  return extractBlock("const handleExportPDF = useCallback", "async function handleExportPDFWithLimit");
}

function persistenceBlock() {
  return extractBlock("    if (!hydrated) return;", "  }, [hydrated, stepIndex, answers, messages, userName, appView]);");
}

function coachingBlock() {
  return extractBlock("const fiscalCoachingCard = useMemo(() => {", "  const isHelperStyledCoachingCard");
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

function revenuesFrom(values = []) {
  return values.map((amount, index) => ({
    id: `lot-5-73-revenue-${index}`,
    amount,
    category: "service",
    revenueCategory: "service",
    date: `2026-07-${String(index + 1).padStart(2, "0")}`,
  }));
}

function shadowRevenueTotal(values = []) {
  const input = buildFiscalSummaryInput({
    revenues: revenuesFrom(values),
    fiscalProfile: {
      activity_type: "services",
      acre: "no",
      acre_start_date: "",
    },
    period: {},
    referenceDate: REFERENCE_DATE,
  });

  return calculateFiscalSummary(input, { trace: false }).revenue.total;
}

function rawAvailable({ revenue, charges }) {
  return Number(revenue || 0) - Number(charges || 0);
}

function reserveLowState({ revenue, charges }) {
  return charges > 0 && rawAvailable({ revenue, charges }) < charges ? ALERT_ON : ALERT_OFF;
}

function selectVisibleRevenueTotal({ flagEnabled, shadowResult, currentMonthTotal }) {
  const usesShadow = Boolean(flagEnabled && shadowResult);
  return usesShadow ? shadowResult.revenue.total : currentMonthTotal;
}

test("LOT 5.73 keeps the Shadow source and buildSmartAlerts call-site stable", () => {
  const smartCall = sourceWithoutComments(smartAlertsBlock());

  assert.match(smartCall, /const smartAlertRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/);
  assert.match(smartCall, /const smartAlertEstimatedCharges =\s*fiscalSummaryVisibleSlice\.finalContributionAmount;/);
  assert.match(smartCall, /estimatedCharges: smartAlertEstimatedCharges/);
  assert.match(smartCall, /currentMonthTotal: smartAlertRevenueTotal/);
  assert.match(smartCall, /smartAlertEstimatedCharges,\s*\n\s*smartAlertRevenueTotal,/);
  assert.doesNotMatch(smartCall, /currentMonthTotal,\s*\n\s*\}\)|currentMonthTotal:\s*currentMonthTotal/);
});

test("LOT 5.73 keeps Shadow baseline stable after the approved coaching occurrence", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const smartCall = sourceWithoutComments(smartAlertsBlock());

  assert.equal(occurrences(app, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(occurrences(smartCall, /fiscalSummaryVisibleSlice\.revenueTotal/g), 1);
  assert.equal(occurrences(app, /const smartAlertRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/g), 1);
  assert.equal(occurrences(appWithoutVisibleSlice(), /fiscalSummaryVisibleSlice\.revenueTotal/g), 6);
});

test("LOT 5.73 keeps rawAvailable formula, threshold and output stable", () => {
  const smartFunction = sourceWithoutComments(buildSmartAlertsFunctionBlock());
  const rawAvailableLine = smartFunction
    .split("\n")
    .find((line) => line.includes("const rawAvailable ="));

  assert.match(
    smartFunction,
    /const rawAvailable = Number\(currentMonthTotal \|\| 0\) - Number\(estimatedCharges \|\| 0\);/,
  );
  assert.match(smartFunction, /if \(estimatedCharges > 0 && rawAvailable < estimatedCharges\)/);
  assert.doesNotMatch(
    rawAvailableLine,
    /fiscalSummaryVisibleSlice|smartAlertRevenueTotal|smartAlertEstimatedCharges|Math\.max|Math\.min|Math\.round|parseFloat|toFixed|toLocaleString/,
  );
  assert.match(smartFunction, /id: "reserve-low"/);
  assert.match(smartFunction, /level: "warning"/);
  assert.match(smartFunction, /title: "Réserve à renforcer"/);
  assert.match(smartFunction, /text: "La réserve actuelle couvre moins d’un cycle de charges estimées\."/);
  assert.match(smartFunction, /cta: "Ajouter une dépense"/);
  assert.match(smartFunction, /action: "profile"/);
});

test("LOT 5.73 keeps alert priority and other smart alerts isolated", () => {
  const smartFunction = sourceWithoutComments(buildSmartAlertsFunctionBlock());

  assert.match(smartFunction, /computed\?\.tvaStatus === "exceeded"[\s\S]*id: "tva-threshold"/);
  // LOT 10.1D: ACRE timing now derives from the canonical, reform-aware
  // computed.acreStatus/acreEndDate instead of an independent
  // acre_start_date + 12 months guess.
  assert.match(smartFunction, /computed\?\.acreStatus === "active"[\s\S]*id: "acre-ending"/);
  assert.match(smartFunction, /id: "reserve-low"[\s\S]*revenues\.length <= 2[\s\S]*id: "early-tracking"/);
  assert.match(smartFunction, /id: "all-clear"/);
  assert.doesNotMatch(smartFunction, /smartAlertRevenueTotal|fiscalSummaryVisibleSlice/);
});

test("LOT 5.73 stabilizes revenue transitions through the migrated source", () => {
  for (const scenario of REVENUE_TRANSITIONS) {
    const legacyRevenue = revenueTotal(scenario.values);
    const shadowRevenue = shadowRevenueTotal(scenario.values);

    assert.equal(Object.is(legacyRevenue, shadowRevenue), true, `${scenario.id} revenue`);
    assert.equal(reserveLowState({ revenue: shadowRevenue, charges: scenario.charges }), scenario.expected, scenario.id);
    assert.equal(
      rawAvailable({ revenue: legacyRevenue, charges: scenario.charges }),
      rawAvailable({ revenue: shadowRevenue, charges: scenario.charges }),
      `${scenario.id} rawAvailable`,
    );
  }
});

test("LOT 5.73 stabilizes threshold transitions without tolerance", () => {
  const states = THRESHOLD_TRANSITIONS.map((scenario) =>
    reserveLowState({ revenue: scenario.revenue, charges: scenario.charges }),
  );

  assert.deepEqual(states, THRESHOLD_TRANSITIONS.map((scenario) => scenario.expected));
  assert.deepEqual([states[0], states[1]], [ALERT_ON, ALERT_OFF]);
  assert.deepEqual([states[1], states[2]], [ALERT_OFF, ALERT_OFF]);
  assert.deepEqual([states[2], states[0]], [ALERT_OFF, ALERT_ON]);
});

test("LOT 5.73 keeps same-input, cloned-input and successive changes deterministic", () => {
  const values = [1234.56, 789];
  const clonedValues = structuredClone(values);
  const sequence = [[], [250], [250, 25], [25], []];

  assert.equal(shadowRevenueTotal(values), shadowRevenueTotal(values));
  assert.equal(shadowRevenueTotal(values), shadowRevenueTotal(clonedValues));
  assert.deepEqual(
    sequence.map((entry) => reserveLowState({ revenue: shadowRevenueTotal(entry), charges: 100 })),
    [ALERT_ON, ALERT_OFF, ALERT_OFF, ALERT_ON, ALERT_ON],
  );
});

test("LOT 5.73 keeps feature flag behavior stable without local fallback", () => {
  const visibleSlice = sourceWithoutComments(visibleSliceBlock());
  const smartCall = sourceWithoutComments(smartAlertsBlock());

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
  assert.doesNotMatch(smartCall, /usesShadow|shadowResult|FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/);
});

test("LOT 5.73 keeps currentMonthTotal Legacy retention outside the migrated input", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const feedback = sourceWithoutComments(feedbackBlock());
  const assistant = sourceWithoutComments(assistantBlock());
  const pdfExport = sourceWithoutComments(exportBlock());

  assert.match(app, /ca_month: currentMonthTotal/);
  assert.match(app, /return Math\.max\(0, currentMonthTotal - estimatedCharges\);/);
  assert.match(feedback, /totalRevenues: currentMonthTotal \|\| 0/);
  assert.match(assistant, /realMonthlyRevenue: currentMonthTotal/);
  assert.match(pdfExport, /getDisplayValue\(currentMonthTotal, "money"\)/);
});

test("LOT 5.73 keeps no propagation to adjacent boundaries", () => {
  const smartCall = sourceWithoutComments(smartAlertsBlock());
  const feedback = sourceWithoutComments(feedbackBlock());
  const assistant = sourceWithoutComments(assistantBlock());
  const pdfExport = sourceWithoutComments(exportBlock());
  const persistence = sourceWithoutComments(persistenceBlock());
  const coaching = sourceWithoutComments(coachingBlock());
  const weekly = sourceWithoutComments(weeklyRecapBlock());

  assert.doesNotMatch(
    smartCall,
    /supabase|localStorage|sessionStorage|payload|feedback|analytics|trackEvent|export|PDF|assistant|coaching|savingsGoal|invoices\.map|saveReminder|weekly/i,
  );
  assert.doesNotMatch(feedback, /smartAlertRevenueTotal|fiscalSummaryVisibleSlice\.revenueTotal/);
  assert.doesNotMatch(assistant, /smartAlertRevenueTotal|fiscalSummaryVisibleSlice\.revenueTotal/);
  assert.doesNotMatch(pdfExport, /smartAlertRevenueTotal|fiscalSummaryVisibleSlice/);
  assert.doesNotMatch(persistence, /smartAlertRevenueTotal|fiscalSummaryVisibleSlice/);
  assert.doesNotMatch(coaching, /smartAlertRevenueTotal|fiscalSummaryVisibleSlice\.revenueTotal/);
  assert.doesNotMatch(weekly, /smartAlertRevenueTotal/);
});

test("LOT 5.73 keeps React and fiscal pipeline stable", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const smartCall = sourceWithoutComments(smartAlertsBlock());

  assert.equal(occurrences(app, /\buseState\(/g), APPROVED_COUNTS.useState);
  assert.equal(occurrences(app, /\buseEffect\(/g), APPROVED_COUNTS.useEffect);
  assert.equal(occurrences(app, /\buseMemo\(/g), APPROVED_COUNTS.useMemo);
  assert.equal(occurrences(app, /\bbuildFiscalSummaryInput\b/g), APPROVED_COUNTS.buildFiscalSummaryInput);
  assert.equal(occurrences(app, /\bcalculateFiscalSummary\b/g), APPROVED_COUNTS.calculateFiscalSummary);
  assert.doesNotMatch(smartCall, /useState|useEffect|buildFiscalSummaryInput|calculateFiscalSummary/);
});

test("LOT 5.73 keeps parity, runtime evidence and rollback stable", () => {
  const smartCall = sourceWithoutComments(smartAlertsBlock());

  assert.match(LOT_5_68_SOURCE, /rawAvailable MATCH/);
  assert.match(LOT_5_72_SOURCE, /currentMonthTotal: smartAlertRevenueTotal/);
  assert.match(SHADOW_PARITY_SOURCE, /SHADOW_PARITY_MATCH/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
  assert.match(smartCall, /currentMonthTotal: smartAlertRevenueTotal/);
  assert.match(smartCall, /smartAlertRevenueTotal,\s*\n\s*\]/);
  assert.doesNotMatch(smartCall, /rawAvailable =|localStorage|supabase|payload|feedback|assistant|handleExportPDF/);
});
