import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const LOT_5_61_SOURCE = readFileSync(
  new URL("./lot-5-61-smart-alert-reserve-low-parity-evidence.test.js", import.meta.url),
  "utf8",
);
const LOT_5_59_SOURCE = readFileSync(
  new URL("./lot-5-59-monthly-reflection-charges-stabilization.test.js", import.meta.url),
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

function appWithoutVisibleSlice() {
  return sourceWithoutComments(APP_SOURCE).replace(sourceWithoutComments(visibleSliceBlock()), "");
}

test("LOT 5.63A identifies the smartAlerts block and reserve-low alert", () => {
  const smartCall = sourceWithoutComments(smartAlertsBlock());
  const smartFunction = sourceWithoutComments(buildSmartAlertsFunctionBlock());

  assert.match(smartCall, /const smartAlerts = useMemo/);
  assert.match(smartCall, /buildSmartAlerts\(\{/);
  assert.match(smartFunction, /id: "reserve-low"/);
  assert.match(smartFunction, /title: "Réserve à renforcer"/);
});

test("LOT 5.63A migrates exactly the reserve-low charges input source", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const smartCall = sourceWithoutComments(smartAlertsBlock());

  assert.match(app, /const smartAlertEstimatedCharges =\s*fiscalSummaryVisibleSlice\.finalContributionAmount;/);
  assert.match(smartCall, /estimatedCharges: smartAlertEstimatedCharges/);
  assert.match(smartCall, /currentMonthTotal: smartAlertRevenueTotal/);
  assert.doesNotMatch(smartCall, /\bestimatedCharges,\s*\n\s*currentMonthTotal/);
  assert.doesNotMatch(smartCall, /shadowResult|calculateFiscalSummary|buildFiscalSummaryInput/);
});

test("LOT 5.63A updates the smartAlerts dependency array minimally", () => {
  const smartCall = sourceWithoutComments(smartAlertsBlock());

  assert.match(smartCall, /smartAlertEstimatedCharges,\s*\n\s*smartAlertRevenueTotal/);
  assert.doesNotMatch(smartCall, /\bestimatedCharges,\s*\n\s*currentMonthTotal/);
  assert.doesNotMatch(smartCall, /useState|useEffect|function\s+\w+|const\s+\w+\s*=\s*\(/);
});

test("LOT 5.63A keeps reserve-low threshold and ON/OFF condition unchanged", () => {
  const smartFunction = sourceWithoutComments(buildSmartAlertsFunctionBlock());

  assert.match(
    smartFunction,
    /const rawAvailable = Number\(currentMonthTotal \|\| 0\) - Number\(estimatedCharges \|\| 0\);/,
  );
  assert.match(smartFunction, /if \(estimatedCharges > 0 && rawAvailable < estimatedCharges\)/);
  assert.doesNotMatch(smartFunction, /fiscalSummaryVisibleSlice/);
  assert.doesNotMatch(smartFunction, /Math\.round\(estimatedCharges|Math\.max\(estimatedCharges/);
});

test("LOT 5.63A keeps message, severity, priority and alert output unchanged", () => {
  const smartFunction = sourceWithoutComments(buildSmartAlertsFunctionBlock());

  assert.match(smartFunction, /computed\?\.tvaStatus === "exceeded"[\s\S]*id: "tva-threshold"/);
  assert.match(smartFunction, /id: "acre-ending"[\s\S]*if \(estimatedCharges > 0/);
  assert.match(smartFunction, /id: "reserve-low"/);
  assert.match(smartFunction, /level: "warning"/);
  assert.match(smartFunction, /title: "Réserve à renforcer"/);
  assert.match(smartFunction, /text: "La réserve actuelle couvre moins d’un cycle de charges estimées\."/);
  assert.match(smartFunction, /cta: "Ajouter une dépense"/);
  assert.match(smartFunction, /action: "profile"/);
  assert.match(smartFunction, /id: "reserve-low"[\s\S]*if \(revenues\.length <= 2\)/);
});

test("LOT 5.63A preserves availableAmount and estimatedCharges Legacy; confirms root savingsGoal removed", () => {
  const app = sourceWithoutComments(APP_SOURCE);

  assert.match(app, /const estimatedCharges = useMemo\(\(\) => \{/);
  assert.match(app, /return Math\.round\(currentMonthTotal \* computed\.rate\);/);
  assert.match(app, /return Math\.max\(0, currentMonthTotal - estimatedCharges\);/);
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
});

test("LOT 5.63A keeps other sensitive boundaries Legacy or unchanged", () => {
  const coaching = sourceWithoutComments(coachingBlock());
  const exportSource = sourceWithoutComments(exportBlock());
  const assistant = sourceWithoutComments(assistantGuidanceBlock());
  const persistence = sourceWithoutComments(persistenceBlock());
  const feedback = sourceWithoutComments(feedbackBlock());

  assert.match(coaching, /fiscalCoachingSavingsGoal > 0/);
  assert.doesNotMatch(coaching, /fiscalSummaryVisibleSlice\.finalContributionAmount/);
  assert.match(exportSource, /estimatedCharges/);
  assert.match(exportSource, /pdfSavingsGoal/);
  assert.doesNotMatch(exportSource, /fiscalSummaryVisibleSlice/);
  assert.match(assistant, /realMonthlyRevenue: currentMonthTotal/);
  assert.doesNotMatch(assistant, /fiscalSummaryVisibleSlice\.finalContributionAmount/);
  assert.match(persistence, /localStorage\.setItem\(LS_KEY, JSON\.stringify\(payload\)\)/);
  assert.doesNotMatch(persistence, /fiscalSummaryVisibleSlice/);
  assert.match(feedback, /totalRevenues: currentMonthTotal \|\| 0/);
  assert.doesNotMatch(feedback, /fiscalSummaryVisibleSlice\.finalContributionAmount/);
});

test("LOT 5.63A reuses the existing feature flag through the visible slice", () => {
  const selector = sourceWithoutComments(visibleSliceBlock());

  assert.match(selector, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/);
  assert.match(
    selector,
    /finalContributionAmount: usesShadow\s*\?\s*shadowResult\.summary\.finalContributionAmount\s*:\s*estimatedCharges/,
  );
  assert.doesNotMatch(
    sourceWithoutComments(smartAlertsBlock()),
    /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/,
  );
});

test("LOT 5.63A keeps Adapter, Facade, state and helper surfaces unchanged", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const smartCall = sourceWithoutComments(smartAlertsBlock());

  assert.equal(occurrences(app, /\bbuildFiscalSummaryInput\b/g), APPROVED_COUNTS.buildFiscalSummaryInput);
  assert.equal(occurrences(app, /\bcalculateFiscalSummary\b/g), APPROVED_COUNTS.calculateFiscalSummary);
  assert.doesNotMatch(smartCall, /useState|useEffect|buildFiscalSummaryInput|calculateFiscalSummary/);
  assert.doesNotMatch(smartCall, /function\s+\w+|const\s+\w+\s*=\s*\(/);
});

test("LOT 5.63A locks Shadow baseline twelve and the exact twelfth consumer", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const appWithoutSelector = appWithoutVisibleSlice();
  const smartCall = sourceWithoutComments(smartAlertsBlock());

  assert.equal(occurrences(app, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(occurrences(appWithoutSelector, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 7);
  assert.equal(occurrences(app, /const smartAlertEstimatedCharges =\s*fiscalSummaryVisibleSlice\.finalContributionAmount;/g), 1);
  assert.equal(
    occurrences(smartCall, /estimatedCharges: smartAlertEstimatedCharges/g),
    1,
  );
  assert.equal(occurrences(smartCall, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 0);
  assert.equal(occurrences(smartCall, /smartAlertEstimatedCharges/g), 2);
});

test("LOT 5.63A keeps parity and runtime evidence guards intact", () => {
  assert.match(LOT_5_61_SOURCE, /strict input MATCH/);
  assert.match(LOT_5_61_SOURCE, /intentional mismatch/);
  assert.match(LOT_5_59_SOURCE, /monthly reflection charges Shadow source stable/);
  assert.match(SHADOW_PARITY_SOURCE, /strict identity/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
});

test("LOT 5.63A documents local rollback only", () => {
  const before = "estimatedCharges: smartAlertEstimatedCharges";
  const after = "estimatedCharges";

  assert.equal(before, "estimatedCharges: smartAlertEstimatedCharges");
  assert.equal(after, "estimatedCharges");
});
