import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const CSS_SOURCE = readFileSync(new URL("../src/App.css", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const LOT_5_39_SOURCE = readFileSync(
  new URL("./lot-5-39-objective-savings-progress-bar-migration-validation.test.js", import.meta.url),
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

const APPROVED_APP_COUNTS = Object.freeze({
  fiscalSummaryVisibleSlice: 15,
  // LOT 5.91A: root savingsGoal removed; useMemo drops by the 1 hook removed with it.
  savingsGoal: 0,
  useState: 88, // LOT 10.2D: +5 useState (declaration dossier UI state); LOT 10.2D.1: +1 (payment confirm loading guard)
  useEffect: 60, // LOT 10.2D: +1 useEffect (fetch declaration dossiers on user change)
  // LOT 10.2B: +1 useMemo for the canonical obligation/action priority shadow integration.
  useMemo: 95, // LOT 10.2D: +4 useMemo (declaration dossier view selectors); LOT 10.2E.1: +2 (dashboardPrioritizedActions, priorityCardViewModel)
  buildFiscalSummaryInput: 2,
  calculateFiscalSummary: 2,
  featureFlag: 2,
});

const TRANSITION_SCENARIOS = Object.freeze([
  { id: "zero-revenue", savingsProgress: 0, finalContributionAmount: 0, expected: 0 },
  { id: "first-positive-revenue", savingsProgress: 330, finalContributionAmount: 220, expected: 50 },
  { id: "multiple-revenues", savingsProgress: 1155, finalContributionAmount: 770, expected: 50 },
  { id: "removed-one-revenue", savingsProgress: 825, finalContributionAmount: 550, expected: 50 },
  { id: "removed-last-revenue", savingsProgress: 0, finalContributionAmount: 0, expected: 0 },
  { id: "zero-to-positive-before", savingsProgress: 0, finalContributionAmount: 0, expected: 0 },
  { id: "zero-to-positive-after", savingsProgress: 250, finalContributionAmount: 110, expected: 50 },
  { id: "positive-to-zero-before", savingsProgress: 330, finalContributionAmount: 220, expected: 50 },
  { id: "positive-to-zero-after", savingsProgress: 0, finalContributionAmount: 0, expected: 0 },
  { id: "low-contribution", savingsProgress: 250, finalContributionAmount: 100, expected: 50 },
  { id: "high-contribution", savingsProgress: 495, finalContributionAmount: 330, expected: 50 },
  { id: "decimal-amount", savingsProgress: 301, finalContributionAmount: 200.5, expected: 50 },
  { id: "acre-inactive", savingsProgress: 330, finalContributionAmount: 220, expected: 50 },
  { id: "acre-active", savingsProgress: 330, finalContributionAmount: 110, expected: 66 },
  { id: "activity-change-service", savingsProgress: 330, finalContributionAmount: 220, expected: 50 },
  { id: "activity-change-commerce", savingsProgress: 246, finalContributionAmount: 123, expected: 49 },
  { id: "same-input", savingsProgress: 396, finalContributionAmount: 264, expected: 50 },
  { id: "cloned-input", savingsProgress: 396, finalContributionAmount: 264, expected: 50 },
  { id: "clamped", savingsProgress: 900, finalContributionAmount: 180, expected: 100 },
]);

function sourceWithoutComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function occurrences(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

function extractBlock(source, startText, endText) {
  const start = source.indexOf(startText);
  assert.notEqual(start, -1, `Missing block start: ${startText}`);
  const end = source.indexOf(endText, start);
  assert.notEqual(end, -1, `Missing block end: ${endText}`);
  return source.slice(start, end);
}

function appBlock(startText, endText) {
  return extractBlock(APP_SOURCE, startText, endText);
}

function cssBlock(startText, endText) {
  return extractBlock(CSS_SOURCE, startText, endText);
}

function estimatedChargesBlock() {
  return appBlock(
    "const estimatedCharges = useMemo(() => {",
    "  const availableAmount = useMemo(() => {",
  );
}

function visibleSliceBlock() {
  return appBlock(
    "const fiscalSummaryVisibleSlice = useMemo(() => {",
    "  // ==================== PREVIEW POUR MODALE AJOUT REVENU ====================",
  );
}

function progressIndicatorsBlock() {
  return appBlock(
    "{isFiscalProfileComplete && fiscalSummaryVisibleSlice.revenueTotal > 0 && (",
    "              {/* ACRE Expiration Warning */}",
  );
}

function objectiveSavingsTextBlock() {
  return appBlock(
    "<span>💰 Objectif d'épargne</span>",
    '                    <div className="progressBar progressBarPremium">',
  );
}

function progressFillBlock() {
  return appBlock(
    '<div className="progressBar progressBarPremium">',
    "                  </div>\n                </div>\n              )}",
  );
}

function coachingSavingsGoalBranch() {
  return appBlock(
    "// LOT 5.79A coaching boundary: source-only denominator migration.",
    '    if (\n      !smartAlertIds.has("acre-ending")',
  );
}

function exportBlock() {
  return appBlock("const handleExportPDF = useCallback", "async function handleExportPDFWithLimit");
}

function pdfSavingsGoalBranch() {
  return appBlock(
    "// LOT 5.86A PDF boundary: source-only denominator migration.",
    "    ],\n    soft\n  );",
  );
}

function feedbackBlock() {
  return appBlock("const feedbackContextSnapshot = useMemo", "  const dashboardMonthlyReflection");
}

function assistantDraftBlock() {
  return appBlock("function readLocalDraftPayload", "function pickProfileField");
}

function appOutsideVisibleSlice() {
  return sourceWithoutComments(APP_SOURCE).replace(sourceWithoutComments(visibleSliceBlock()), "");
}

function progressFillCssBlock() {
  return cssBlock(".progressFill {", "/* ===== DASHBOARD ===== */");
}

function premiumProgressFillCssBlock() {
  return cssBlock(".progressBarPremium {", "/* ===== ASSISTANT SECTION ===== */");
}

function savingsDenominator(finalContributionAmount) {
  return Math.max(finalContributionAmount * 3, 500);
}

function progressBarPercent(savingsProgress, finalContributionAmount) {
  return Math.min(100, Math.round((savingsProgress / savingsDenominator(finalContributionAmount)) * 100));
}

function progressBarWidth(savingsProgress, finalContributionAmount) {
  return `${progressBarPercent(savingsProgress, finalContributionAmount)}%`;
}

function transitionResults(scenarios = TRANSITION_SCENARIOS) {
  return scenarios.map((scenario) => ({
    id: scenario.id,
    value: progressBarPercent(scenario.savingsProgress, scenario.finalContributionAmount),
    width: progressBarWidth(scenario.savingsProgress, scenario.finalContributionAmount),
  }));
}

function selectVisibleSliceFinalContribution({ flagEnabled, shadowResult, estimatedCharges }) {
  const usesShadow = flagEnabled && Boolean(shadowResult);
  return usesShadow ? shadowResult.summary.finalContributionAmount : estimatedCharges;
}

test("LOT 5.40 keeps the progress bar source Shadow-backed and scoped", () => {
  const block = sourceWithoutComments(progressFillBlock());

  assert.match(block, /className="progressBar progressBarPremium"/);
  assert.match(block, /className="progressFill"/);
  assert.match(block, /style=\{\{/);
  assert.match(block, /width: `\$\{Math\.min\(/);
  assert.match(block, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.equal(occurrences(block, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 1);
  assert.doesNotMatch(block, /\bsavingsGoal\b|\bestimatedCharges\b|\bshadowResult\b/);
});

test("LOT 5.40 keeps Shadow baseline at ten with the monthly reflection occurrence", () => {
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

test("LOT 5.40 confirms the eighth Shadow occurrence remains the approved progress bar", () => {
  const progress = sourceWithoutComments(progressIndicatorsBlock());

  assert.equal(occurrences(progress, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 2);
  assert.match(objectiveSavingsTextBlock(), /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.match(progressFillBlock(), /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.doesNotMatch(progress, /\bsavingsProgress \/ savingsGoal\b/);
});

test("LOT 5.40 keeps the width formula, clamp, percentage and formatter unchanged", () => {
  const block = sourceWithoutComments(progressFillBlock());

  assert.match(block, /Math\.min\(\s*100,/);
  assert.match(block, /Math\.round\(/);
  assert.match(block, /\(savingsProgress\s*\//);
  assert.match(block, /Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\)/);
  assert.match(block, /\)\s*\*\s*100/);
  assert.match(block, /}%`/);
  assert.equal(progressBarWidth(330, 220), "50%");
  assert.equal(progressBarWidth(900, 180), "100%");
});

test("LOT 5.40 keeps CSS width transition and premium fill styling stable", () => {
  assert.match(progressFillCssBlock(), /transition: width 0\.4s ease;/);
  assert.match(premiumProgressFillCssBlock(), /\.progressBarPremium \.progressFill/);
  assert.match(premiumProgressFillCssBlock(), /height: 100%;/);
  assert.match(premiumProgressFillCssBlock(), /border-radius: 999px;/);
  assert.match(premiumProgressFillCssBlock(), /background: linear-gradient/);
});

test("LOT 5.40 transition matrix stays deterministic across required revenue states", () => {
  const firstRun = transitionResults();
  const secondRun = transitionResults();
  const clonedRun = transitionResults(structuredClone(TRANSITION_SCENARIOS));

  assert.deepEqual(firstRun, secondRun);
  assert.deepEqual(firstRun, clonedRun);
  assert.deepEqual(
    firstRun,
    TRANSITION_SCENARIOS.map(({ id, expected }) => ({
      id,
      value: expected,
      width: `${expected}%`,
    })),
  );
});

test("LOT 5.40 validates named zero, positive, deletion and zero-positive transitions", () => {
  const requiredIds = new Set([
    "zero-revenue",
    "first-positive-revenue",
    "multiple-revenues",
    "removed-one-revenue",
    "removed-last-revenue",
    "zero-to-positive-before",
    "zero-to-positive-after",
    "positive-to-zero-before",
    "positive-to-zero-after",
  ]);
  const actual = transitionResults().filter(({ id }) => requiredIds.has(id));

  assert.deepEqual(
    actual,
    TRANSITION_SCENARIOS.filter(({ id }) => requiredIds.has(id)).map(({ id, expected }) => ({
      id,
      value: expected,
      width: `${expected}%`,
    })),
  );
});

test("LOT 5.40 validates contribution, ACRE and activity transition stability", () => {
  const requiredIds = new Set([
    "low-contribution",
    "high-contribution",
    "decimal-amount",
    "acre-inactive",
    "acre-active",
    "activity-change-service",
    "activity-change-commerce",
  ]);
  const actual = transitionResults().filter(({ id }) => requiredIds.has(id));

  assert.deepEqual(
    actual,
    TRANSITION_SCENARIOS.filter(({ id }) => requiredIds.has(id)).map(({ id, expected }) => ({
      id,
      value: expected,
      width: `${expected}%`,
    })),
  );
});

test("LOT 5.40 feature flag ON uses Shadow and OFF returns to Legacy fallback", () => {
  const shadowResult = { summary: { finalContributionAmount: 330 } };

  assert.equal(
    selectVisibleSliceFinalContribution({
      flagEnabled: true,
      shadowResult,
      estimatedCharges: 220,
    }),
    330,
  );
  assert.equal(
    selectVisibleSliceFinalContribution({
      flagEnabled: false,
      shadowResult,
      estimatedCharges: 220,
    }),
    220,
  );
  assert.equal(
    selectVisibleSliceFinalContribution({
      flagEnabled: true,
      shadowResult: null,
      estimatedCharges: 220,
    }),
    220,
  );
  assert.match(visibleSliceBlock(), /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/);
  assert.match(visibleSliceBlock(), /finalContributionAmount: usesShadow[\s\S]*: estimatedCharges/);
});

test("LOT 5.40 keeps feature flag static, local and non-persistent", () => {
  const code = sourceWithoutComments(APP_SOURCE);
  const flagDeclaration = "const FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED = true;";

  assert.match(code, new RegExp(flagDeclaration.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(
    occurrences(code, /\bFISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED\b/g),
    APPROVED_APP_COUNTS.featureFlag,
  );
  assert.doesNotMatch(visibleSliceBlock(), /localStorage|sessionStorage|supabase|fetch|user|Date\.now|new Date/i);
});

test("LOT 5.40 rollback remains local to the progress bar width source", () => {
  const rollbackBlock = progressFillBlock().replace(
    /Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\)/,
    "savingsGoal",
  );

  assert.match(rollbackBlock, /savingsProgress\s*\/\s*savingsGoal/);
  assert.doesNotMatch(rollbackBlock, /shadowResult|calculateFiscalSummary|buildFiscalSummaryInput/);
  assert.doesNotMatch(rollbackBlock, /localStorage|sessionStorage|supabase|fetch|payload|assistant/i);
});

test("LOT 5.40 keeps estimatedCharges Legacy and confirms root savingsGoal is removed with both active aliases keeping their formula", () => {
  const estimated = sourceWithoutComments(estimatedChargesBlock());
  const code = sourceWithoutComments(APP_SOURCE);

  assert.match(estimated, /return Math\.round\(currentMonthTotal \* computed\.rate\);/);
  assert.match(estimated, /return 0;/);
  assert.doesNotMatch(estimated, /fiscalSummaryVisibleSlice|finalContributionAmount|shadowResult/);
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

test("LOT 5.40 keeps Objectif d'epargne text consumer Shadow-stabilized without changing it", () => {
  const block = sourceWithoutComments(objectiveSavingsTextBlock());

  assert.match(block, /Objectif d'épargne/);
  assert.match(block, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.equal(occurrences(block, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 1);
  assert.doesNotMatch(block, /\bsavingsGoal\b|\bestimatedCharges\b|\bshadowResult\b/);
});

test("LOT 5.40 keeps coaching low-reserve migrated with same low reserve condition and message", () => {
  const block = sourceWithoutComments(coachingSavingsGoalBranch());

  assert.match(block, /fiscalCoachingSavingsGoal > 0/);
  assert.match(block, /savingsProgress < fiscalCoachingSavingsGoal \* 0\.35/);
  assert.match(block, /roleBasedTips\.dailyFiscalTip\.lowReserve/);
  assert.doesNotMatch(block, /fiscalSummaryVisibleSlice|finalContributionAmount|shadowResult/);
});

test("LOT 5.40 keeps PDF and export Legacy contract", () => {
  const pdfBranch = sourceWithoutComments(pdfSavingsGoalBranch());
  const exportSource = sourceWithoutComments(exportBlock());

  assert.match(pdfBranch, /Objectif d epargne/);
  assert.match(pdfBranch, /typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0/);
  assert.match(pdfBranch, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
  assert.doesNotMatch(pdfBranch, /fiscalSummaryVisibleSlice|finalContributionAmount|shadowResult/);
  assert.match(exportSource, /dashboardChargesDisplay/);
  assert.match(exportSource, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
});

test("LOT 5.40 keeps persistence, payloads, assistant, analytics and feedback isolated", () => {
  const progress = sourceWithoutComments(progressIndicatorsBlock());

  assert.doesNotMatch(progress, /localStorage|sessionStorage|supabase|fetch|payload|assistant|analytics|feedback/i);
  assert.doesNotMatch(progress, /trackEvent|dashboardMonthlyReflection|\bsummary:/i);
  assert.doesNotMatch(visibleSliceBlock(), /localStorage|sessionStorage|supabase|fetch|payload|assistant|trackEvent/i);
  assert.match(feedbackBlock(), /totalRevenues: currentMonthTotal \|\| 0/);
  assert.match(assistantDraftBlock(), /localStorage\.getItem\(LS_KEY\)/);
});

test("LOT 5.40 keeps React hook counts and avoids new state/effect/memo churn", () => {
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

test("LOT 5.40 keeps single Adapter and Facade executions", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.equal(occurrences(code, /buildFiscalSummaryInput\(\{/g), 1);
  assert.equal(occurrences(code, /\bbuildFiscalSummaryInput\b/g), APPROVED_APP_COUNTS.buildFiscalSummaryInput);
  assert.equal(occurrences(code, /calculateFiscalSummary\(shadowInput, \{ trace: false \}\)/g), 1);
  assert.equal(occurrences(code, /\bcalculateFiscalSummary\b/g), APPROVED_APP_COUNTS.calculateFiscalSummary);
});

test("LOT 5.40 keeps parity and runtime evidence intact", () => {
  assert.match(SHADOW_PARITY_SOURCE, /MISMATCH/);
  assert.match(SHADOW_PARITY_SOURCE, /strict identity/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MATCH with compared fields/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /does not mutate legacy snapshot, shadow result or shadow input/);
  assert.match(
    LOT_5_39_SOURCE,
    /LOT 5\.39 Shadow baseline includes the approved weekly rate and monthly reflection occurrences/,
  );
});

test("LOT 5.40 introduces no new Shadow Result consumer or Shadow savings goal alias", () => {
  const code = sourceWithoutComments(APP_SOURCE);
  const outsideSelector = appOutsideVisibleSlice();

  assert.equal(occurrences(outsideSelector, /shadowResult\.summary\.finalContributionAmount/g), 0);
  assert.equal(occurrences(code, /\bsavingsGoal\b/g), APPROVED_APP_COUNTS.savingsGoal);
  assert.doesNotMatch(code, /\b(uiSavingsGoal|coachingSavingsGoal|shadowSavingsGoal)\b/);
  // LOT 5.86A approved exactly one new consumer: the PDF export denominator alias.
  assert.equal(occurrences(code, /\bpdfSavingsGoal\b/g), 5);
});
