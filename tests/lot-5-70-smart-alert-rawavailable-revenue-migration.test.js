import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const LOT_5_68_SOURCE = readFileSync(
  new URL("./lot-5-68-smart-alert-rawavailable-revenue-parity-evidence.test.js", import.meta.url),
  "utf8",
);
const LOT_5_66_SOURCE = readFileSync(
  new URL("./lot-5-66-smart-alert-reserve-low-stabilization.test.js", import.meta.url),
  "utf8",
);
const LOT_5_65_SOURCE = readFileSync(
  new URL("./lot-5-65-smart-alert-reserve-low-migration-validation.test.js", import.meta.url),
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
  useState: 81,
  useEffect: 58,
  // LOT 5.91A: root savingsGoal removed, dropping 1 useMemo( call site.
  useMemo: 87,
  buildFiscalSummaryInput: 2,
  calculateFiscalSummary: 2,
});

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

function appWithoutVisibleSlice() {
  return sourceWithoutComments(APP_SOURCE).replace(sourceWithoutComments(visibleSliceBlock()), "");
}

function reserveLowState({ currentMonthTotal, estimatedCharges }) {
  const rawAvailable = Number(currentMonthTotal || 0) - Number(estimatedCharges || 0);
  return estimatedCharges > 0 && rawAvailable < estimatedCharges ? "ALERT_ON" : "ALERT_OFF";
}

test("LOT 5.70 identifies the smartAlerts block and migrated rawAvailable revenue consumer", () => {
  const smartCall = sourceWithoutComments(smartAlertsBlock());

  assert.match(smartCall, /const smartAlertEstimatedCharges =\s*fiscalSummaryVisibleSlice\.finalContributionAmount;/);
  assert.match(smartCall, /const smartAlertRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/);
  assert.match(smartCall, /buildSmartAlerts\(\{/);
  assert.match(smartCall, /estimatedCharges: smartAlertEstimatedCharges/);
  assert.match(smartCall, /currentMonthTotal: smartAlertRevenueTotal/);
  assert.doesNotMatch(smartCall, /currentMonthTotal,\s*\n\s*\}\)/);
});

test("LOT 5.70 keeps rawAvailable formula, threshold and ON/OFF logic unchanged", () => {
  const smartFunction = sourceWithoutComments(buildSmartAlertsFunctionBlock());

  assert.match(
    smartFunction,
    /const rawAvailable = Number\(currentMonthTotal \|\| 0\) - Number\(estimatedCharges \|\| 0\);/,
  );
  assert.match(smartFunction, /if \(estimatedCharges > 0 && rawAvailable < estimatedCharges\)/);
  assert.doesNotMatch(
    smartFunction,
    /fiscalSummaryVisibleSlice|smartAlertRevenueTotal|Math\.round|parseFloat|toFixed|toLocaleString/,
  );
  assert.equal(reserveLowState({ currentMonthTotal: 199, estimatedCharges: 100 }), "ALERT_ON");
  assert.equal(reserveLowState({ currentMonthTotal: 200, estimatedCharges: 100 }), "ALERT_OFF");
  assert.equal(reserveLowState({ currentMonthTotal: 201, estimatedCharges: 100 }), "ALERT_OFF");
});

test("LOT 5.70 keeps reserve-low alert output and priority unchanged", () => {
  const smartFunction = sourceWithoutComments(buildSmartAlertsFunctionBlock());

  assert.match(smartFunction, /computed\?\.tvaStatus === "exceeded"[\s\S]*id: "tva-threshold"/);
  assert.match(smartFunction, /id: "acre-ending"[\s\S]*if \(estimatedCharges > 0/);
  assert.match(smartFunction, /id: "reserve-low"/);
  assert.match(smartFunction, /level: "warning"/);
  assert.match(smartFunction, /title: "Réserve à renforcer"/);
  assert.match(smartFunction, /text: "La réserve actuelle couvre moins d’un cycle de charges estimées\."/);
  assert.match(smartFunction, /cta: "Ajouter une dépense"/);
  assert.match(smartFunction, /action: "profile"/);
  assert.match(smartFunction, /id: "reserve-low"[\s\S]*id: "early-tracking"[\s\S]*id: "all-clear"/);
});

test("LOT 5.70 reuses the existing visible feature flag selector", () => {
  const visibleSlice = sourceWithoutComments(visibleSliceBlock());
  const smartCall = sourceWithoutComments(smartAlertsBlock());

  assert.match(visibleSlice, /revenueTotal: usesShadow\s*\?\s*shadowResult\.revenue\.total\s*:\s*currentMonthTotal/);
  assert.doesNotMatch(smartCall, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED|usesShadow|shadowResult/);
  assert.doesNotMatch(smartCall, /\?\s*fiscalSummaryVisibleSlice\.revenueTotal|:\s*currentMonthTotal/);
});

test("LOT 5.70 locks Shadow baseline at thirteen with exact thirteenth consumer signature", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const smartCall = sourceWithoutComments(smartAlertsBlock());

  assert.equal(occurrences(app, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(occurrences(smartCall, /fiscalSummaryVisibleSlice\.revenueTotal/g), 1);
  assert.equal(
    occurrences(app, /const smartAlertRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/g),
    1,
  );
  assert.equal(occurrences(appWithoutVisibleSlice(), /fiscalSummaryVisibleSlice\.revenueTotal/g), 6);
  assert.doesNotMatch(smartCall, /fiscalSummaryVisibleSlice\.finalContributionAmount[\s\S]*fiscalSummaryVisibleSlice\.finalContributionAmount/);
});

test("LOT 5.70 updates the dependency array minimally and adds no alias useMemo", () => {
  const smartCall = sourceWithoutComments(smartAlertsBlock());

  assert.match(smartCall, /smartAlertEstimatedCharges,\s*\n\s*smartAlertRevenueTotal,/);
  assert.doesNotMatch(smartCall, /currentMonthTotal,\s*\n\s*\]/);
  assert.doesNotMatch(smartCall, /useMemo\(\(\) =>\s*fiscalSummaryVisibleSlice\.revenueTotal/);
  assert.equal(occurrences(smartCall, /\bsmartAlertRevenueTotal\b/g), 3);
});

test("LOT 5.70 keeps React and fiscal pipeline surfaces stable", () => {
  const app = sourceWithoutComments(APP_SOURCE);

  assert.equal(occurrences(app, /\buseState\(/g), APPROVED_COUNTS.useState);
  assert.equal(occurrences(app, /\buseEffect\(/g), APPROVED_COUNTS.useEffect);
  assert.equal(occurrences(app, /\buseMemo\(/g), APPROVED_COUNTS.useMemo);
  assert.equal(occurrences(app, /\bbuildFiscalSummaryInput\b/g), APPROVED_COUNTS.buildFiscalSummaryInput);
  assert.equal(occurrences(app, /\bcalculateFiscalSummary\b/g), APPROVED_COUNTS.calculateFiscalSummary);
});

test("LOT 5.70 retains currentMonthTotal Legacy consumers outside the smart alert revenue input", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const smartCall = sourceWithoutComments(smartAlertsBlock());
  const feedback = sourceWithoutComments(feedbackBlock());
  const assistant = sourceWithoutComments(assistantBlock());
  const pdfExport = sourceWithoutComments(exportBlock());

  assert.match(feedback, /totalRevenues: currentMonthTotal \|\| 0/);
  assert.match(assistant, /realMonthlyRevenue: currentMonthTotal/);
  assert.match(pdfExport, /getDisplayValue\(currentMonthTotal, "money"\)/);
  assert.match(app, /return Math\.max\(0, currentMonthTotal - estimatedCharges\);/);
  assert.match(app, /ca_month: currentMonthTotal/);
  assert.doesNotMatch(smartCall, /totalRevenues|realMonthlyRevenue|getDisplayValue\(currentMonthTotal|ca_month/);
});

test("LOT 5.70 keeps feedback, persistence, payloads, assistant and exports isolated", () => {
  const smartCall = sourceWithoutComments(smartAlertsBlock());
  const persistence = sourceWithoutComments(persistenceBlock());
  const feedback = sourceWithoutComments(feedbackBlock());

  assert.match(persistence, /localStorage\.setItem/);
  assert.match(feedback, /totalRevenues: currentMonthTotal \|\| 0/);
  assert.doesNotMatch(
    smartCall,
    /localStorage|sessionStorage|supabase|payload|feedback|analytics|export|PDF|coaching|savingsGoal|weekly/i,
  );
});

test("LOT 5.70 keeps other smart alerts isolated", () => {
  const smartFunction = sourceWithoutComments(buildSmartAlertsFunctionBlock());

  assert.match(smartFunction, /computed\?\.tvaStatus === "exceeded"/);
  // LOT 10.1D: ACRE timing now derives from the canonical, reform-aware
  // computed.acreStatus/acreEndDate instead of an independent
  // acre_start_date + 12 months guess.
  assert.match(smartFunction, /computed\?\.acreStatus === "active"/);
  assert.match(smartFunction, /revenues\.length <= 2/);
  assert.doesNotMatch(smartFunction, /smartAlertRevenueTotal|fiscalSummaryVisibleSlice/);
});

test("LOT 5.70 keeps parity and runtime evidence intact", () => {
  assert.match(LOT_5_68_SOURCE, /rawAvailable MATCH/);
  assert.match(LOT_5_68_SOURCE, /reserve-low alert ON\/OFF and message parity/i);
  assert.match(LOT_5_66_SOURCE, /boundary/i);
  assert.match(LOT_5_65_SOURCE, /reserve-low threshold/i);
  assert.match(SHADOW_PARITY_SOURCE, /SHADOW_PARITY_MATCH/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /SHADOW_PARITY_MISMATCH/);
});

test("LOT 5.70 rollback remains local to the smart alert revenue input", () => {
  const smartCall = sourceWithoutComments(smartAlertsBlock());

  assert.match(smartCall, /currentMonthTotal: smartAlertRevenueTotal/);
  assert.match(smartCall, /smartAlertRevenueTotal,\s*\n\s*\]/);
  assert.doesNotMatch(smartCall, /rawAvailable|localStorage|feedback|assistant|handleExportPDF/);
});
