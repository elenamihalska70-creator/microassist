import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);

const APPROVED_APP_COUNTS = Object.freeze({
  fiscalSummaryVisibleSlice: 15,
  // LOT 5.91A: root savingsGoal removed (0 remaining occurrences).
  savingsGoal: 0,
  directShadowResultConsumersOutsideSelector: 0,
});

const DETERMINISTIC_SCENARIOS = Object.freeze([
  { id: "zero-final", savingsProgress: 0, finalContributionAmount: 0, expected: 0 },
  { id: "floor-denominator", savingsProgress: 250, finalContributionAmount: 100, expected: 50 },
  { id: "three-month-denominator", savingsProgress: 330, finalContributionAmount: 220, expected: 50 },
  { id: "decimal-rounding", savingsProgress: 301, finalContributionAmount: 200.5, expected: 50 },
  { id: "cap-at-one-hundred", savingsProgress: 900, finalContributionAmount: 180, expected: 100 },
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

function estimatedChargesBlock() {
  return extractBlock(
    "const estimatedCharges = useMemo(() => {",
    "  const availableAmount = useMemo(() => {",
  );
}

function visibleSliceBlock() {
  return extractBlock(
    "const fiscalSummaryVisibleSlice = useMemo(() => {",
    "  // ==================== PREVIEW POUR MODALE AJOUT REVENU ====================",
  );
}

function progressIndicatorsBlock() {
  return extractBlock(
    "{isFiscalProfileComplete && fiscalSummaryVisibleSlice.revenueTotal > 0 && (",
    "              {/* ACRE Expiration Warning */}",
  );
}

function objectiveSavingsTextBlock() {
  return extractBlock(
    "<span>💰 Objectif d'épargne</span>",
    '                    <div className="progressBar progressBarPremium">',
  );
}

function progressFillBlock() {
  return extractBlock(
    '<div className="progressBar progressBarPremium">',
    "                  </div>\n                </div>\n              )}",
  );
}

function coachingSavingsGoalBranch() {
  return extractBlock(
    "// LOT 5.79A coaching boundary: source-only denominator migration.",
    '    if (\n      !smartAlertIds.has("acre-ending")',
  );
}

function exportBlock() {
  return extractBlock("const handleExportPDF = useCallback", "async function handleExportPDFWithLimit");
}

function pdfSavingsGoalBranch() {
  return extractBlock(
    "// LOT 5.86A PDF boundary: source-only denominator migration.",
    "    ],\n    soft\n  );",
  );
}

function feedbackBlock() {
  return extractBlock("const feedbackContextSnapshot = useMemo", "  const dashboardMonthlyReflection");
}

function assistantDraftBlock() {
  return extractBlock("function readLocalDraftPayload", "function pickProfileField");
}

function shadowResultExecutionBlock() {
  return extractBlock(
    "const fiscalSummaryShadow = useMemo(() => {",
    "  const fiscalSummaryVisibleSlice = useMemo(() => {",
  );
}

function appOutsideVisibleSlice() {
  return sourceWithoutComments(APP_SOURCE).replace(sourceWithoutComments(visibleSliceBlock()), "");
}

function progressBarPercent(savingsProgress, finalContributionAmount) {
  return Math.min(
    100,
    Math.round((savingsProgress / Math.max(finalContributionAmount * 3, 500)) * 100),
  );
}

test("LOT 5.39 progress bar uses fiscalSummaryVisibleSlice.finalContributionAmount", () => {
  const block = sourceWithoutComments(progressFillBlock());

  assert.match(block, /className="progressBar progressBarPremium"/);
  assert.match(block, /className="progressFill"/);
  assert.match(block, /width: `\$\{Math\.min\(/);
  assert.match(block, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.equal(occurrences(block, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 1);
  assert.doesNotMatch(block, /\bsavingsGoal\b|\bestimatedCharges\b|\bshadowResult\b/);
});

test("LOT 5.39 Objectif d'epargne text stays on the approved Shadow source", () => {
  const block = sourceWithoutComments(objectiveSavingsTextBlock());

  assert.match(block, /Objectif d'épargne/);
  assert.match(block, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.equal(occurrences(block, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 1);
  assert.doesNotMatch(block, /\bsavingsGoal\b|\bestimatedCharges\b|\bshadowResult\b/);
});

test("LOT 5.39 Shadow baseline includes the approved weekly rate and monthly reflection occurrences", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.equal(occurrences(code, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_APP_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(occurrences(code, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/g), 4);
  assert.equal(
    occurrences(
      code,
      /const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/g,
    ),
    1,
  );
});

test("LOT 5.39 approved Objectif d'epargne Shadow pair remains scoped and isolated", () => {
  const progress = sourceWithoutComments(progressIndicatorsBlock());

  assert.equal(occurrences(progress, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 2);
  assert.match(progress, /<span>💰 Objectif d'épargne<\/span>/);
  assert.match(progress, /className="progressBar progressBarPremium"/);
  assert.match(progress, /className="progressFill"/);
  assert.doesNotMatch(progress, /\bsavingsProgress \/ savingsGoal\b/);
});

test("LOT 5.39 root savingsGoal is removed and both active aliases keep their formula", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.doesNotMatch(code, /const savingsGoal = useMemo/);
  assert.doesNotMatch(code, /\bsavingsGoal\b/);
  assert.match(
    APP_SOURCE,
    /const fiscalCoachingSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
  assert.match(
    APP_SOURCE,
    /const pdfSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
});

test("LOT 5.39 estimatedCharges remains the Legacy source it always was, independent of the removed global savingsGoal", () => {
  const block = sourceWithoutComments(estimatedChargesBlock());

  assert.match(block, /return Math\.round\(currentMonthTotal \* computed\.rate\);/);
  assert.match(block, /return 0;/);
  assert.doesNotMatch(block, /fiscalSummaryVisibleSlice|finalContributionAmount|shadowResult/);
});

test("LOT 5.39 coaching low-reserve uses migrated denominator", () => {
  const block = sourceWithoutComments(coachingSavingsGoalBranch());

  assert.match(block, /fiscalCoachingSavingsGoal > 0/);
  assert.match(block, /savingsProgress < fiscalCoachingSavingsGoal \* 0\.35/);
  assert.match(block, /roleBasedTips\.dailyFiscalTip\.lowReserve/);
  assert.doesNotMatch(block, /fiscalSummaryVisibleSlice|finalContributionAmount|shadowResult/);
});

test("LOT 5.39 PDF and export remain Legacy", () => {
  const pdfBranch = sourceWithoutComments(pdfSavingsGoalBranch());
  const exportSource = sourceWithoutComments(exportBlock());

  assert.match(pdfBranch, /typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0/);
  assert.match(pdfBranch, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
  assert.doesNotMatch(pdfBranch, /fiscalSummaryVisibleSlice|finalContributionAmount|shadowResult/);
  assert.match(exportSource, /dashboardChargesDisplay/);
  assert.match(exportSource, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
});

test("LOT 5.39 persistence, payloads and assistant remain unchanged by the migrated consumer", () => {
  const progress = sourceWithoutComments(progressIndicatorsBlock());

  assert.doesNotMatch(progress, /localStorage|sessionStorage|supabase|fetch|payload|assistant/i);
  assert.doesNotMatch(visibleSliceBlock(), /localStorage|sessionStorage|supabase|fetch|payload/i);
  assert.match(feedbackBlock(), /totalRevenues: currentMonthTotal \|\| 0/);
  assert.match(assistantDraftBlock(), /localStorage\.getItem\(LS_KEY\)/);
});

test("LOT 5.39 introduces no direct Shadow Result consumer outside the selector", () => {
  const outsideSelector = appOutsideVisibleSlice();

  assert.equal(
    occurrences(outsideSelector, /shadowResult\.summary\.finalContributionAmount/g),
    APPROVED_APP_COUNTS.directShadowResultConsumersOutsideSelector,
  );
  assert.match(visibleSliceBlock(), /shadowResult\.summary\.finalContributionAmount/);
  assert.match(shadowResultExecutionBlock(), /const shadowResult = calculateFiscalSummary/);
});

test("LOT 5.39 progress bar local formula structure remains unchanged", () => {
  const block = sourceWithoutComments(progressFillBlock());

  assert.match(block, /Math\.min\(\s*100,/);
  assert.match(block, /Math\.round\(/);
  assert.match(block, /\(savingsProgress\s*\//);
  assert.match(block, /Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\)/);
  assert.match(block, /\)\s*\*\s*100/);
  assert.match(block, /}%`/);
});

test("LOT 5.39 deterministic progress values preserve Math.max, Math.round, times three and 500", () => {
  const firstRun = DETERMINISTIC_SCENARIOS.map((scenario) => ({
    id: scenario.id,
    value: progressBarPercent(scenario.savingsProgress, scenario.finalContributionAmount),
  }));
  const secondRun = DETERMINISTIC_SCENARIOS.map((scenario) => ({
    id: scenario.id,
    value: progressBarPercent(scenario.savingsProgress, scenario.finalContributionAmount),
  }));
  const clonedRun = structuredClone(DETERMINISTIC_SCENARIOS).map((scenario) => ({
    id: scenario.id,
    value: progressBarPercent(scenario.savingsProgress, scenario.finalContributionAmount),
  }));

  assert.deepEqual(firstRun, secondRun);
  assert.deepEqual(firstRun, clonedRun);
  assert.deepEqual(
    firstRun,
    DETERMINISTIC_SCENARIOS.map(({ id, expected }) => ({ id, value: expected })),
  );
});

test("LOT 5.39 rollback remains local to the progress bar width source", () => {
  const rollbackBlock = progressFillBlock().replace(
    /Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\)/,
    "savingsGoal",
  );

  assert.match(rollbackBlock, /savingsProgress\s*\/\s*savingsGoal/);
  assert.doesNotMatch(rollbackBlock, /shadowResult|calculateFiscalSummary|buildFiscalSummaryInput/);
  assert.doesNotMatch(rollbackBlock, /localStorage|sessionStorage|supabase|fetch|payload|assistant/i);
});

test("LOT 5.39 no unapproved Shadow-backed savings goal aliases exist", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.equal(occurrences(code, /\bsavingsGoal\b/g), APPROVED_APP_COUNTS.savingsGoal);
  assert.doesNotMatch(code, /\b(uiSavingsGoal|coachingSavingsGoal|shadowSavingsGoal)\b/);
  // LOT 5.86A approved exactly one new consumer: the PDF export denominator alias.
  assert.equal(occurrences(code, /\bpdfSavingsGoal\b/g), 5);
});
