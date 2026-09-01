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
const RUNTIME_EVIDENCE_SOURCE = readFileSync(
  new URL("./runtime-parity-evidence.test.js", import.meta.url),
  "utf8",
);
const SHADOW_PARITY_SOURCE = readFileSync(
  new URL("./shadow-parity-validation.test.js", import.meta.url),
  "utf8",
);

const APPROVED_APP_COUNTS = Object.freeze({
  fiscalSummaryVisibleSlice: 13,
  // LOT 5.91A: root savingsGoal removed; useMemo drops by the 1 hook removed with it.
  savingsGoal: 0,
  useState: 88, // LOT 10.2D: +5 useState (declaration dossier UI state); LOT 10.2D.1: +1 (payment confirm loading guard)
  useEffect: 60, // LOT 10.2D: +1 useEffect (fetch declaration dossiers on user change)
  useMemo: 94, // LOT 10.2D: +4 useMemo (declaration dossier view selectors); LOT 10.2E.1: +2 (dashboardPrioritizedActions, priorityCardViewModel)
  buildFiscalSummaryInput: 2,
  calculateFiscalSummary: 2,
  featureFlag: 2,
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
  assert.notEqual(start, -1, startText);
  const end = APP_SOURCE.indexOf(endText, start);
  assert.notEqual(end, -1, endText);
  return APP_SOURCE.slice(start, end);
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

function migratedBarPercent(savingsProgress, finalContributionAmount) {
  return Math.min(
    100,
    Math.round((savingsProgress / Math.max(finalContributionAmount * 3, 500)) * 100),
  );
}

test("LOT 5.37 identifies the exact progress bar fill width consumer", () => {
  const block = progressFillBlock();

  assert.match(block, /className="progressBar progressBarPremium"/);
  assert.match(block, /className="progressFill"/);
  assert.match(block, /width: `\$\{Math\.min\(/);
});

test("LOT 5.37 progress bar source is the approved Shadow field", () => {
  const block = sourceWithoutComments(progressFillBlock());

  assert.match(block, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.equal(occurrences(block, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 1);
});

test("LOT 5.37 removes the direct Legacy source only from this consumer", () => {
  const block = sourceWithoutComments(progressFillBlock());

  assert.doesNotMatch(block, /savingsProgress \/ savingsGoal/);
  assert.doesNotMatch(block, /\bestimatedCharges\b|\bcomputed\b|\bcurrentMonthTotal\b/);
});

test("LOT 5.37 width formula remains unchanged", () => {
  const block = sourceWithoutComments(progressFillBlock());

  assert.match(block, /Math\.min\(\s*100,/);
  assert.match(block, /Math\.round\(/);
  assert.match(block, /\(savingsProgress\s*\//);
});

test("LOT 5.37 denominator contract remains three months with a 500 floor", () => {
  const block = sourceWithoutComments(progressFillBlock());

  assert.match(block, /Math\.max\(/);
  assert.match(block, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.match(block, /500/);
});

test("LOT 5.37 percentage multiplier remains unchanged", () => {
  const block = sourceWithoutComments(progressFillBlock());

  assert.match(block, /\)\s*\*\s*100/);
  assert.equal(migratedBarPercent(330, 220), 50);
  assert.equal(migratedBarPercent(900, 180), 100);
});

test("LOT 5.37 clamp remains unchanged", () => {
  assert.equal(migratedBarPercent(900, 180), 100);
  assert.match(progressFillBlock(), /Math\.min\(\s*100,/);
});

test("LOT 5.37 CSS width contract remains unchanged", () => {
  const block = progressFillBlock();

  assert.match(block, /style=\{\{/);
  assert.match(block, /width: `\$\{[\s\S]*\}%`/);
  assert.match(block, /className="progressFill"/);
});

test("LOT 5.37 root savingsGoal is removed and both active aliases keep their formula", () => {
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

test("LOT 5.37 Objectif d'epargne text remains Shadow stabilized", () => {
  const block = sourceWithoutComments(objectiveSavingsTextBlock());

  assert.match(block, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.equal(occurrences(block, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 1);
  assert.doesNotMatch(block, /\bsavingsGoal\b/);
});

test("LOT 5.37 coaching low-reserve uses migrated denominator", () => {
  const block = sourceWithoutComments(coachingSavingsGoalBranch());

  assert.match(block, /fiscalCoachingSavingsGoal > 0/);
  assert.match(block, /savingsProgress < fiscalCoachingSavingsGoal \* 0\.35/);
  assert.doesNotMatch(block, /fiscalSummaryVisibleSlice|finalContributionAmount|shadowResult/);
});

test("LOT 5.37 PDF remains Legacy", () => {
  const block = sourceWithoutComments(pdfSavingsGoalBranch());

  assert.match(block, /typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0/);
  assert.match(block, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
  assert.doesNotMatch(block, /fiscalSummaryVisibleSlice|finalContributionAmount|shadowResult/);
});

test("LOT 5.37 creates no new feature flag", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.equal(
    occurrences(code, /\bFISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED\b/g),
    APPROVED_APP_COUNTS.featureFlag,
  );
  assert.match(visibleSliceBlock(), /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/);
});

test("LOT 5.37 adds no new state", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.equal(occurrences(code, /\buseState\b/g), APPROVED_APP_COUNTS.useState);
});

test("LOT 5.37 adds no new effect", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.equal(occurrences(code, /\buseEffect\b/g), APPROVED_APP_COUNTS.useEffect);
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

test("LOT 5.37 adds no second Adapter execution", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.equal(occurrences(code, /buildFiscalSummaryInput\(\{/g), 1);
  assert.equal(occurrences(code, /\bbuildFiscalSummaryInput\b/g), APPROVED_APP_COUNTS.buildFiscalSummaryInput);
});

test("LOT 5.37 adds no second Facade execution", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.equal(occurrences(code, /calculateFiscalSummary\(shadowInput, \{ trace: false \}\)/g), 1);
  assert.equal(occurrences(code, /\bcalculateFiscalSummary\b/g), APPROVED_APP_COUNTS.calculateFiscalSummary);
});

test("LOT 5.37 parity evidence remains intact", () => {
  assert.match(LOT_5_30_SOURCE, /approved scenario matrix produces only MATCH results/);
  assert.match(LOT_5_30_SOURCE, /intentional mismatch is detected and preserved/);
  assert.match(SHADOW_PARITY_SOURCE, /MISMATCH/);
});

test("LOT 5.37 runtime evidence remains intact", () => {
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MATCH with compared fields/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /summary\.finalContributionAmount/);
});

test("LOT 5.37 persistence remains unchanged", () => {
  assert.doesNotMatch(progressFillBlock(), /localStorage|sessionStorage|supabase|fetch/i);
  assert.doesNotMatch(visibleSliceBlock(), /localStorage|sessionStorage|supabase|fetch/i);
});

test("LOT 5.37 payloads remain unchanged", () => {
  assert.doesNotMatch(progressFillBlock(), /payload/i);
  assert.match(feedbackBlock(), /totalRevenues: currentMonthTotal \|\| 0/);
});

test("LOT 5.37 assistant remains unchanged", () => {
  assert.doesNotMatch(progressFillBlock(), /assistant/i);
  assert.match(assistantDraftBlock(), /localStorage\.getItem\(LS_KEY\)/);
});

test("LOT 5.37 exports remain unchanged", () => {
  assert.doesNotMatch(progressFillBlock(), /handleExportPDF|doc\.|Objectif d epargne/);
  assert.match(exportBlock(), /dashboardChargesDisplay/);
  assert.match(exportBlock(), /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
});

test("LOT 5.37 migrates no other consumer", () => {
  const appCode = sourceWithoutComments(APP_SOURCE);
  const progress = sourceWithoutComments(progressIndicatorsBlock());

  assert.equal(occurrences(appCode, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/g), 4);
  assert.equal(occurrences(progress, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 2);
  assert.equal(occurrences(appCode, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_APP_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(occurrences(appCode, /\bsavingsGoal\b/g), APPROVED_APP_COUNTS.savingsGoal);
  assert.doesNotMatch(appCode, /\b(uiSavingsGoal|coachingSavingsGoal)\b/);
  // LOT 5.86A approved exactly one new consumer: the PDF export denominator alias.
  assert.equal(occurrences(appCode, /\bpdfSavingsGoal\b/g), 5);
});

test("LOT 5.37 rollback remains local to the progress bar width", () => {
  const rollbackBlock = progressFillBlock().replace(
    /Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\)/,
    "savingsGoal",
  );

  assert.match(rollbackBlock, /savingsProgress\s*\/\s*savingsGoal/);
  assert.doesNotMatch(rollbackBlock, /localStorage|sessionStorage|supabase|fetch|payload|assistant/i);
});

test("LOT 5.37 Shadow baseline includes the approved weekly rate and monthly reflection occurrences", () => {
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
