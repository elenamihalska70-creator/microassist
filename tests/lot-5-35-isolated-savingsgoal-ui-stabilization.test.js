import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const LOT_5_30_SOURCE = readFileSync(
  new URL("./lot-5-30-isolated-savingsgoal-ui-parity-evidence.test.js", import.meta.url),
  "utf8",
);
const LOT_5_32_SOURCE = readFileSync(
  new URL("./lot-5-32-isolated-savingsgoal-ui-migration.test.js", import.meta.url),
  "utf8",
);
const LOT_5_34_SOURCE = readFileSync(
  new URL("./lot-5-34-isolated-savingsgoal-ui-migration-validation.test.js", import.meta.url),
  "utf8",
);
const RUNTIME_EVIDENCE_SOURCE = readFileSync(
  new URL("./runtime-parity-evidence.test.js", import.meta.url),
  "utf8",
);
const SHADOW_PARITY_SOURCE = readFileSync(
  new URL("./shadow-parity-validation.test.js", import.meta.url),
  "utf8",
);
const LOT_5_34_REPORT = readFileSync(
  new URL(
    "../docs/LOT_5_34_ISOLATED_SAVINGSGOAL_UI_MIGRATION_VALIDATION_REPORT.md",
    import.meta.url,
  ),
  "utf8",
);

const APPROVED_APP_COUNTS = Object.freeze({
  fiscalSummaryVisibleSlice: 15,
  // LOT 5.91A: root savingsGoal removed; useMemo drops by the 1 hook removed with it.
  savingsGoal: 0,
  useState: 87, // LOT 10.2D: +5 useState (declaration dossier UI state)
  useEffect: 60, // LOT 10.2D: +1 useEffect (fetch declaration dossiers on user change)
  // LOT 10.2B: +1 useMemo for the canonical obligation/action priority shadow integration.
  useMemo: 93, // LOT 10.2D: +4 useMemo (declaration dossier view selectors)
  buildFiscalSummaryInput: 2,
  calculateFiscalSummary: 2,
});

const TRANSITION_SCENARIOS = Object.freeze([
  { id: "zero-revenue", finalContributionAmount: 0, savingsProgress: 0, expected: 0 },
  { id: "first-positive-revenue", finalContributionAmount: 220, savingsProgress: 330, expected: 50 },
  { id: "multiple-revenues", finalContributionAmount: 770, savingsProgress: 1155, expected: 50 },
  { id: "removed-one-revenue", finalContributionAmount: 550, savingsProgress: 825, expected: 50 },
  { id: "removed-last-revenue", finalContributionAmount: 0, savingsProgress: 0, expected: 0 },
  { id: "zero-to-positive-before", finalContributionAmount: 0, savingsProgress: 0, expected: 0 },
  { id: "zero-to-positive-after", finalContributionAmount: 110, savingsProgress: 250, expected: 50 },
  { id: "positive-to-zero-before", finalContributionAmount: 220, savingsProgress: 330, expected: 50 },
  { id: "positive-to-zero-after", finalContributionAmount: 0, savingsProgress: 0, expected: 0 },
  { id: "activity-change-service", finalContributionAmount: 220, savingsProgress: 330, expected: 50 },
  { id: "activity-change-commerce", finalContributionAmount: 123, savingsProgress: 246, expected: 49 },
  { id: "acre-inactive", finalContributionAmount: 220, savingsProgress: 330, expected: 50 },
  { id: "acre-active", finalContributionAmount: 110, savingsProgress: 330, expected: 66 },
  { id: "reload-existing-state", finalContributionAmount: 264, savingsProgress: 396, expected: 50 },
  { id: "restored-state", finalContributionAmount: 264, savingsProgress: 396, expected: 50 },
  { id: "capped-percent", finalContributionAmount: 180, savingsProgress: 900, expected: 100 },
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
  assert.notEqual(start, -1, startText);
  const end = APP_SOURCE.indexOf(endText, start);
  assert.notEqual(end, -1, endText);
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

function visibleSavingsGoal(finalContributionAmount) {
  return Math.max(finalContributionAmount * 3, 500);
}

function visibleTextPercent(savingsProgress, finalContributionAmount) {
  return Math.min(100, Math.round((savingsProgress / visibleSavingsGoal(finalContributionAmount)) * 100));
}

function selectVisibleSliceFinalContribution({ flagEnabled, shadowResult, estimatedCharges }) {
  const usesShadow = flagEnabled && Boolean(shadowResult);
  return usesShadow ? shadowResult.summary.finalContributionAmount : estimatedCharges;
}

function transitionResults(scenarios = TRANSITION_SCENARIOS) {
  return scenarios.map((scenario) => ({
    id: scenario.id,
    value: visibleTextPercent(scenario.savingsProgress, scenario.finalContributionAmount),
  }));
}

test("LOT 5.35 source Shadow remains stable for Objectif d'epargne UI text", () => {
  const block = sourceWithoutComments(objectiveSavingsTextBlock());

  assert.match(block, /Objectif d'épargne/);
  assert.match(block, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.equal(occurrences(block, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 1);
  assert.doesNotMatch(block, /\bestimatedCharges\b|\bsavingsGoal\b|\bshadowResult\b/);
});

test("LOT 5.35 Shadow baseline includes the approved progress bar and weekly rate occurrences", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.equal(occurrences(code, /\bfiscalSummaryVisibleSlice\b/g), 15);
});

test("LOT 5.35 detects the approved monthly reflection tenth Shadow occurrence", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.equal(occurrences(code, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/g), 4);
  assert.equal(occurrences(code, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_APP_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(
    occurrences(
      code,
      /const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/g,
    ),
    1,
  );
});

test("LOT 5.35 visible formula and formatter remain preserved", () => {
  const block = objectiveSavingsTextBlock();

  assert.match(block, /Math\.min\(\s*100,/);
  assert.match(block, /Math\.round\(/);
  assert.match(block, /Math\.max\(/);
  assert.match(block, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.match(block, /500,/);
  assert.match(block, /%\s*<\/span>/);
});

test("LOT 5.35 label, CSS and layout remain preserved", () => {
  const block = objectiveSavingsTextBlock();

  assert.match(block, /<span>💰 Objectif d'épargne<\/span>/);
  assert.match(block, /<span>\s*\{Math\.min\(/);
  assert.match(APP_SOURCE, /className="progressBar progressBarPremium"/);
  assert.match(APP_SOURCE, /className="progressFill"/);
});

test("LOT 5.35 zero revenue transition remains stable", () => {
  const scenario = TRANSITION_SCENARIOS.find(({ id }) => id === "zero-revenue");

  assert.equal(visibleTextPercent(scenario.savingsProgress, scenario.finalContributionAmount), 0);
});

test("LOT 5.35 first positive revenue transition remains stable", () => {
  const scenario = TRANSITION_SCENARIOS.find(({ id }) => id === "first-positive-revenue");

  assert.equal(visibleTextPercent(scenario.savingsProgress, scenario.finalContributionAmount), 50);
});

test("LOT 5.35 revenue transition matrix remains deterministic", () => {
  assert.deepEqual(
    transitionResults(),
    TRANSITION_SCENARIOS.map(({ id, expected }) => ({ id, value: expected })),
  );
});

test("LOT 5.35 deletion and zero-positive transitions remain stable", () => {
  const ids = new Set([
    "removed-one-revenue",
    "removed-last-revenue",
    "zero-to-positive-before",
    "zero-to-positive-after",
    "positive-to-zero-before",
    "positive-to-zero-after",
  ]);
  const actual = transitionResults().filter(({ id }) => ids.has(id));
  const expected = TRANSITION_SCENARIOS.filter(({ id }) => ids.has(id)).map(({ id, expected }) => ({
    id,
    value: expected,
  }));

  assert.deepEqual(actual, expected);
});

test("LOT 5.35 activity and ACRE transitions remain stable", () => {
  const ids = new Set([
    "activity-change-service",
    "activity-change-commerce",
    "acre-inactive",
    "acre-active",
  ]);
  const actual = transitionResults().filter(({ id }) => ids.has(id));
  const expected = TRANSITION_SCENARIOS.filter(({ id }) => ids.has(id)).map(({ id, expected }) => ({
    id,
    value: expected,
  }));

  assert.deepEqual(actual, expected);
});

test("LOT 5.35 reload and restored state transitions remain stable", () => {
  const ids = new Set(["reload-existing-state", "restored-state"]);
  const actual = transitionResults().filter(({ id }) => ids.has(id));

  assert.deepEqual(actual, [
    { id: "reload-existing-state", value: 50 },
    { id: "restored-state", value: 50 },
  ]);
});

test("LOT 5.35 flag ON keeps Objectif d'epargne UI on Shadow", () => {
  assert.equal(
    selectVisibleSliceFinalContribution({
      flagEnabled: true,
      shadowResult: { summary: { finalContributionAmount: 330 } },
      estimatedCharges: 220,
    }),
    330,
  );
  assert.match(visibleSliceBlock(), /finalContributionAmount: usesShadow\s*\?\s*shadowResult\.summary/);
});

test("LOT 5.35 flag OFF returns Objectif d'epargne UI to Legacy", () => {
  assert.equal(
    selectVisibleSliceFinalContribution({
      flagEnabled: false,
      shadowResult: { summary: { finalContributionAmount: 330 } },
      estimatedCharges: 220,
    }),
    220,
  );
  assert.match(visibleSliceBlock(), /finalContributionAmount: usesShadow[\s\S]*: estimatedCharges/);
});

test("LOT 5.35 rollback remains local to the UI text denominator", () => {
  const rollbackBlock = objectiveSavingsTextBlock().replace(
    /Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\)/,
    "savingsGoal",
  );

  assert.match(rollbackBlock, /savingsProgress\s*\/\s*savingsGoal/);
  assert.doesNotMatch(rollbackBlock, /localStorage|sessionStorage|supabase|fetch|payload|assistant/i);
});

test("LOT 5.35 root savingsGoal is removed and both active aliases keep their formula", () => {
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

test("LOT 5.35 estimatedCharges remains Legacy", () => {
  const block = sourceWithoutComments(estimatedChargesBlock());

  assert.match(block, /return Math\.round\(currentMonthTotal \* computed\.rate\);/);
  assert.match(block, /return 0;/);
  assert.doesNotMatch(block, /fiscalSummaryVisibleSlice|finalContributionAmount|shadowResult/);
});

test("LOT 5.35 progress bar follows the approved Shadow-backed UI source", () => {
  const block = sourceWithoutComments(progressFillBlock());

  assert.match(block, /Math\.round\(/);
  assert.match(block, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.match(block, /500/);
  assert.doesNotMatch(block, /savingsProgress \/ savingsGoal|shadowResult/);
});

test("LOT 5.35 coaching low-reserve uses migrated denominator", () => {
  const block = sourceWithoutComments(coachingSavingsGoalBranch());

  assert.match(block, /fiscalCoachingSavingsGoal > 0/);
  assert.match(block, /savingsProgress < fiscalCoachingSavingsGoal \* 0\.35/);
  assert.match(block, /roleBasedTips\.dailyFiscalTip\.lowReserve/);
  assert.doesNotMatch(block, /fiscalSummaryVisibleSlice|finalContributionAmount|shadowResult/);
});

test("LOT 5.35 PDF remains Legacy", () => {
  const block = sourceWithoutComments(pdfSavingsGoalBranch());

  assert.match(block, /Objectif d epargne/);
  assert.match(block, /typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0/);
  assert.match(block, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
  assert.doesNotMatch(block, /fiscalSummaryVisibleSlice|finalContributionAmount|shadowResult/);
});

test("LOT 5.35 persistence remains unchanged", () => {
  assert.doesNotMatch(objectiveSavingsTextBlock(), /localStorage|sessionStorage|supabase|fetch/i);
  assert.doesNotMatch(visibleSliceBlock(), /localStorage|sessionStorage|supabase|fetch/i);
  assert.match(APP_SOURCE, /localStorage\.getItem\(LS_KEY\)/);
});

test("LOT 5.35 payloads and exports remain unchanged", () => {
  assert.doesNotMatch(objectiveSavingsTextBlock(), /payload|handleExportPDF|doc\./i);
  assert.match(feedbackBlock(), /totalRevenues: currentMonthTotal \|\| 0/);
  assert.match(exportBlock(), /dashboardChargesDisplay/);
  assert.match(exportBlock(), /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
});

test("LOT 5.35 assistant remains unchanged", () => {
  assert.doesNotMatch(objectiveSavingsTextBlock(), /assistant/i);
  assert.match(assistantDraftBlock(), /localStorage\.getItem\(LS_KEY\)/);
});

test("LOT 5.35 React hook counts remain unchanged", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.equal(occurrences(code, /\buseState\b/g), APPROVED_APP_COUNTS.useState);
  assert.equal(occurrences(code, /\buseEffect\b/g), APPROVED_APP_COUNTS.useEffect);
  assert.equal(occurrences(code, /\buseMemo\b/g), APPROVED_APP_COUNTS.useMemo);
});

test("LOT 5.98 supplements the whole-file hook counts with a scoped savingsGoal-boundary check", () => {
  // LOT 5.98: the counts above are whole-file totals -- they shift on any unrelated hook
  // addition or removal anywhere in the ~15,000-line file (documented fragility class B in
  // LOT 5.96/5.97). This supplements, without replacing, that count with a check scoped to
  // only the three savingsGoal boundaries this file's own history cares about, mirroring the
  // pattern LOT 5.97 established in lot-5-29.
  const ui = progressIndicatorsBlock();
  const coaching = coachingSavingsGoalBranch();
  const pdf = pdfSavingsGoalBranch();

  for (const block of [ui, coaching, pdf]) {
    assert.equal(occurrences(block, /\buseState\(/g), 0);
    assert.equal(occurrences(block, /\buseEffect\(/g), 0);
    assert.equal(occurrences(block, /\buseMemo\(/g), 0);
  }
});

test("LOT 5.35 no second Adapter execution exists", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.equal(occurrences(code, /buildFiscalSummaryInput\(\{/g), 1);
  assert.equal(occurrences(code, /\bbuildFiscalSummaryInput\b/g), APPROVED_APP_COUNTS.buildFiscalSummaryInput);
});

test("LOT 5.35 no second Facade execution exists", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.equal(occurrences(code, /calculateFiscalSummary\(shadowInput, \{ trace: false \}\)/g), 1);
  assert.equal(occurrences(code, /\bcalculateFiscalSummary\b/g), APPROVED_APP_COUNTS.calculateFiscalSummary);
});

test("LOT 5.35 parity evidence remains intact", () => {
  assert.match(LOT_5_30_SOURCE, /approved scenario matrix produces only MATCH results/);
  assert.match(LOT_5_30_SOURCE, /intentional mismatch is detected and preserved/);
  assert.match(SHADOW_PARITY_SOURCE, /MISMATCH/);
  assert.match(LOT_5_34_REPORT, /PASS - 15\/15/);
});

test("LOT 5.35 runtime evidence remains intact", () => {
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MATCH with compared fields/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /summary\.finalContributionAmount/);
});

test("LOT 5.35 same input and cloned input remain deterministic", () => {
  const firstRun = transitionResults();
  const secondRun = transitionResults();
  const clonedRun = transitionResults(structuredClone(TRANSITION_SCENARIOS));

  assert.deepEqual(firstRun, secondRun);
  assert.deepEqual(firstRun, clonedRun);
});

test("LOT 5.35 validates no migrated consumer beyond the approved Objectif UI pair", () => {
  const appCode = sourceWithoutComments(APP_SOURCE);
  const progress = sourceWithoutComments(progressIndicatorsBlock());

  assert.equal(occurrences(appCode, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/g), 4);
  assert.equal(occurrences(progress, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 2);
  assert.equal(occurrences(appCode, /\bsavingsGoal\b/g), APPROVED_APP_COUNTS.savingsGoal);
  assert.doesNotMatch(appCode, /\b(uiSavingsGoal|coachingSavingsGoal)\b/);
  // LOT 5.86A approved exactly one new consumer: the PDF export denominator alias.
  assert.equal(occurrences(appCode, /\bpdfSavingsGoal\b/g), 5);
});

test("LOT 5.35 validates no propagation outside the approved UI text", () => {
  const block = objectiveSavingsTextBlock();
  const appCode = sourceWithoutComments(APP_SOURCE);

  assert.doesNotMatch(block, /supabase|localStorage|sessionStorage|payload|assistant|analytics|feedback/i);
  assert.doesNotMatch(block, /trackEvent|export|dashboardMonthlyReflection|\bsummary:/i);
  assert.equal(occurrences(appCode, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_APP_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(
    occurrences(
      appCode,
      /const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/g,
    ),
    1,
  );
});

test("LOT 5.35 legacy retention guards remain referenced by prior stabilization", () => {
  assert.match(LOT_5_32_SOURCE, /confirms root savingsGoal removed and both active aliases keep their formula/);
  assert.match(LOT_5_32_SOURCE, /keeps coaching low-reserve migrated/);
  assert.match(LOT_5_32_SOURCE, /keeps PDF Legacy/);
  assert.match(LOT_5_34_SOURCE, /validates no new consumer beyond the approved Objectif UI consumers/);
});
