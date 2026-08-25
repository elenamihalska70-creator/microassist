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
  // LOT 5.91A: root savingsGoal removed, dropping 2 estimatedCharges reads
  // (formula body + dependency array) and 1 useMemo hook.
  savingsGoal: 0,
  estimatedCharges: 12,
  fiscalSummaryVisibleSlice: 15,
  buildFiscalSummaryInput: 2,
  calculateFiscalSummary: 2,
  createRuntimeParityEvidence: 2,
  useState: 82,
  useEffect: 59,
  // LOT 10.2B: +1 useMemo for the canonical obligation/action priority shadow integration.
  useMemo: 89,
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

function visibleSavingsGoalFromSlice(finalContributionAmount) {
  return Math.max(finalContributionAmount * 3, 500);
}

function visibleTextPercent(savingsProgress, finalContributionAmount) {
  return Math.min(
    100,
    Math.round((savingsProgress / visibleSavingsGoalFromSlice(finalContributionAmount)) * 100),
  );
}

test("LOT 5.32 identifies the approved UI text consumer", () => {
  const block = objectiveSavingsTextBlock();

  assert.match(block, /Objectif d'épargne/);
  assert.match(block, /Math\.min\(\s*100,/);
  assert.match(block, /%\s*<\/span>/);
});

test("LOT 5.32 UI text consumer no longer reads Legacy savingsGoal directly", () => {
  const block = sourceWithoutComments(objectiveSavingsTextBlock());

  assert.doesNotMatch(block, /\bsavingsGoal\b/);
});

test("LOT 5.32 UI text consumer reads fiscalSummaryVisibleSlice.finalContributionAmount exactly", () => {
  const block = sourceWithoutComments(objectiveSavingsTextBlock());

  assert.match(block, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.match(block, /Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\)/);
});

test("LOT 5.32 confirms root savingsGoal removed and both active aliases keep their formula", () => {
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

test("LOT 5.32 keeps estimatedCharges unchanged", () => {
  const block = estimatedChargesBlock();

  assert.match(block, /if \(computed\?\.rate\) \{/);
  assert.match(block, /return Math\.round\(currentMonthTotal \* computed\.rate\);/);
  assert.match(block, /return 0;/);
  assert.match(block, /\}, \[currentMonthTotal, computed\?\.rate\]\);/);
});

test("LOT 5.32 keeps coaching low-reserve migrated", () => {
  const block = sourceWithoutComments(coachingSavingsGoalBranch());

  assert.match(block, /fiscalCoachingSavingsGoal > 0/);
  assert.match(block, /savingsProgress < fiscalCoachingSavingsGoal \* 0\.35/);
  assert.match(block, /roleBasedTips\.dailyFiscalTip\.lowReserve/);
  assert.doesNotMatch(block, /fiscalSummaryVisibleSlice|finalContributionAmount|shadowResult/);
});

test("LOT 5.32 keeps PDF Legacy", () => {
  const block = sourceWithoutComments(pdfSavingsGoalBranch());

  assert.match(block, /typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0/);
  assert.match(block, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
  assert.doesNotMatch(block, /fiscalSummaryVisibleSlice|finalContributionAmount|shadowResult/);
});

test("LOT 5.32 keeps export percentage unchanged", () => {
  const block = exportBlock();

  assert.match(block, /Objectif d epargne/);
  assert.match(block, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
  assert.doesNotMatch(pdfSavingsGoalBranch(), /fiscalSummaryVisibleSlice\.finalContributionAmount/);
});

test("LOT 5.32 adds no new rounding", () => {
  const code = sourceWithoutComments(progressIndicatorsBlock());

  assert.equal(occurrences(code, /Math\.round\(/g), 2);
  assert.equal(
    occurrences(
      code,
      /Math\.round\(\s*\(savingsProgress\s*\/\s*Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\)\)\s*\*\s*100,\s*\)/g,
    ),
    2,
  );
  assert.equal(occurrences(code, /Math\.round\(\(savingsProgress \/ savingsGoal\) \* 100\)/g), 0);
});

test("LOT 5.32 adds no new fallback", () => {
  const code = sourceWithoutComments(progressIndicatorsBlock());

  assert.doesNotMatch(code, /\?\?/);
  assert.doesNotMatch(code, /\|\|/);
});

test("LOT 5.32 adds no new state or effect", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.equal(occurrences(code, /\buseState\b/g), APPROVED_APP_COUNTS.useState);
  assert.equal(occurrences(code, /\buseEffect\b/g), APPROVED_APP_COUNTS.useEffect);
  assert.equal(occurrences(code, /\buseMemo\b/g), APPROVED_APP_COUNTS.useMemo);
});

test("LOT 5.32 adds no second Adapter execution", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.equal(
    occurrences(code, /buildFiscalSummaryInput\(\{/g),
    1,
  );
  assert.equal(occurrences(code, /\bbuildFiscalSummaryInput\b/g), APPROVED_APP_COUNTS.buildFiscalSummaryInput);
});

test("LOT 5.32 adds no second Facade execution", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.equal(
    occurrences(code, /calculateFiscalSummary\(shadowInput, \{ trace: false \}\)/g),
    1,
  );
  assert.equal(occurrences(code, /\bcalculateFiscalSummary\b/g), APPROVED_APP_COUNTS.calculateFiscalSummary);
});

test("LOT 5.32 flag ON selects Shadow through the existing visible slice", () => {
  const block = visibleSliceBlock();

  assert.match(block, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/);
  assert.match(block, /finalContributionAmount: usesShadow\s*\?\s*shadowResult\.summary\.finalContributionAmount/);
});

test("LOT 5.32 flag OFF keeps Legacy rollback through the existing visible slice", () => {
  const block = visibleSliceBlock();

  assert.match(block, /finalContributionAmount: usesShadow[\s\S]*: estimatedCharges/);
});

test("LOT 5.32 keeps parity evidence intact", () => {
  assert.match(LOT_5_30_SOURCE, /approved scenario matrix produces only MATCH results/);
  assert.match(LOT_5_30_SOURCE, /assert\.equal\(result\.legacyUiAmount, result\.shadowCandidateAmount/);
});

test("LOT 5.32 keeps runtime evidence intact", () => {
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MATCH with compared fields/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /summary\.finalContributionAmount/);
});

test("LOT 5.32 keeps intentional mismatch detection intact", () => {
  assert.match(LOT_5_30_SOURCE, /intentional mismatch is detected and preserved/);
  assert.match(SHADOW_PARITY_SOURCE, /MISMATCH/);
});

test("LOT 5.32 keeps persistence unchanged", () => {
  assert.doesNotMatch(objectiveSavingsTextBlock(), /localStorage|sessionStorage|supabase|fetch/i);
  assert.match(APP_SOURCE, /localStorage\.getItem\(LS_KEY\)/);
});

test("LOT 5.32 keeps payloads unchanged", () => {
  assert.doesNotMatch(objectiveSavingsTextBlock(), /payload/i);
  assert.match(feedbackBlock(), /totalRevenues: currentMonthTotal \|\| 0/);
});

test("LOT 5.32 keeps assistant unchanged", () => {
  assert.doesNotMatch(objectiveSavingsTextBlock(), /assistant/i);
  assert.match(assistantDraftBlock(), /localStorage\.getItem\(LS_KEY\)/);
});

test("LOT 5.32 keeps export unchanged", () => {
  assert.doesNotMatch(objectiveSavingsTextBlock(), /handleExportPDF|doc\.|Objectif d epargne/);
  assert.match(exportBlock(), /handleExportPDF/);
});

test("LOT 5.32 keeps Objectif d'epargne UI migrations bounded", () => {
  const textBlock = sourceWithoutComments(objectiveSavingsTextBlock());
  const fillBlock = sourceWithoutComments(progressFillBlock());
  const appCode = sourceWithoutComments(APP_SOURCE);

  assert.equal(occurrences(textBlock, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 1);
  assert.equal(occurrences(fillBlock, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 1);
  assert.doesNotMatch(fillBlock, /Math\.round\(\(savingsProgress \/ savingsGoal\) \* 100\)/);
  assert.equal(occurrences(appCode, /\bsavingsGoal\b/g), APPROVED_APP_COUNTS.savingsGoal);
  assert.equal(occurrences(appCode, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_APP_COUNTS.fiscalSummaryVisibleSlice);
});

test("LOT 5.32 keeps UI formatter unchanged", () => {
  assert.equal(visibleTextPercent(250, 220), 38);
  assert.equal(visibleTextPercent(700, 220), 100);
  assert.match(objectiveSavingsTextBlock(), /Math\.min\(\s*100,\s*Math\.round\(/);
  assert.match(objectiveSavingsTextBlock(), /%\s*<\/span>/);
});

test("LOT 5.32 keeps approved execution surface counts", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  for (const [identifier, expectedCount] of Object.entries(APPROVED_APP_COUNTS)) {
    assert.equal(
      occurrences(code, new RegExp(`\\b${identifier}\\b`, "g")),
      expectedCount,
      identifier,
    );
  }
});

test("LOT 5.98 supplements the whole-file hook counts with a scoped savingsGoal-boundary check", () => {
  // LOT 5.98: APPROVED_APP_COUNTS.useState/useEffect/useMemo above are whole-file totals --
  // they shift on any unrelated hook addition or removal anywhere in the ~15,000-line file
  // (documented fragility class B in LOT 5.96/5.97). This supplements, without replacing, that
  // count with a check scoped to only the three savingsGoal boundaries this file's own history
  // cares about, mirroring the pattern LOT 5.97 established in lot-5-29.
  const ui = progressIndicatorsBlock();
  const coaching = coachingSavingsGoalBranch();
  const pdf = pdfSavingsGoalBranch();

  for (const block of [ui, coaching, pdf]) {
    assert.equal(occurrences(block, /\buseState\(/g), 0);
    assert.equal(occurrences(block, /\buseEffect\(/g), 0);
    assert.equal(occurrences(block, /\buseMemo\(/g), 0);
  }
});
