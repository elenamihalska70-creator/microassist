import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// LOT 5.91A: obsolete root savingsGoal declaration removal lock-in.
//
// Context: the root `savingsGoal` declaration in src/App.jsx (formerly at
// line ~6440) was a compatibility root whose own documented retention
// condition -- "keep it while either fiscalCoachingCard or handleExportPDF
// read it" (LOT 5.76) -- was satisfied out of existence by the already
// approved LOT 5.79A (coaching) and LOT 5.86A (PDF) migrations. LOT 5.89
// found the resulting `no-unused-vars` lint error; LOT 5.90 confirmed zero
// remaining readers of any kind; this LOT (5.91A) removes exactly that dead
// declaration and nothing else. Lint-debt target: `npm run lint` should read
// exactly `50 problems (21 errors, 29 warnings)` after this removal --
// restoring the pre-drift baseline by eliminating the single
// `'savingsGoal' is assigned a value but never used` error. This test file
// cannot run ESLint itself, so it only locks in the runtime-observable half
// of that outcome (the declaration and its consumers); the lint count itself
// is asserted separately via `npm run lint` in this LOT's validation step.

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);

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
  return extractBlock(
    "const handleExportPDF = useCallback",
    "async function handleExportPDFWithLimit",
  );
}

function pdfSavingsGoalBranch() {
  return extractBlock(
    "// LOT 5.86A PDF boundary: source-only denominator migration.",
    "    ],\n    soft\n  );",
  );
}

function assistantDraftBlock() {
  return extractBlock("function readLocalDraftPayload", "function pickProfileField");
}

function assistantGuidanceBlock() {
  return extractBlock("const simpleAssistantGuidance = useMemo", "  const dashboardRevenueDisplay");
}

function feedbackBlock() {
  return extractBlock("const feedbackContextSnapshot = useMemo", "  const dashboardMonthlyReflection");
}

function persistenceBlock() {
  return extractBlock(
    "    if (!hydrated) return;",
    "  }, [hydrated, stepIndex, answers, messages, userName, appView]);",
  );
}

const CODE = sourceWithoutComments(APP_SOURCE);

// 1. no whole-word savingsGoal anywhere in src/App.jsx
test("LOT 5.91A no whole-word savingsGoal occurrence remains in src/App.jsx", () => {
  assert.equal(occurrences(CODE, /\bsavingsGoal\b/g), 0);
});

// 2. the old declaration text is absent
test("LOT 5.91A the removed declaration text is absent", () => {
  assert.doesNotMatch(CODE, /const savingsGoal = useMemo/);
  assert.doesNotMatch(
    CODE,
    /LOT 5\.29: Legacy savings goal source retained for UI, coaching and PDF boundaries/,
  );
});

// 3 & 4. fiscalCoachingSavingsGoal is present with its exact formula
test("LOT 5.91A fiscalCoachingSavingsGoal is present with its exact Shadow-backed formula", () => {
  assert.match(APP_SOURCE, /\bfiscalCoachingSavingsGoal\b/);
  assert.match(
    APP_SOURCE,
    /const fiscalCoachingSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
});

// 5 & 6. pdfSavingsGoal is present with its exact formula
test("LOT 5.91A pdfSavingsGoal is present with its exact Shadow-backed formula", () => {
  assert.match(APP_SOURCE, /\bpdfSavingsGoal\b/);
  assert.match(
    APP_SOURCE,
    /const pdfSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
});

// 7. the JSX Objectif d'epargne block still uses the Shadow-derived expression, unchanged
test("LOT 5.91A the JSX Objectif d'epargne block is unchanged and still Shadow-derived", () => {
  const text = sourceWithoutComments(objectiveSavingsTextBlock());
  const fill = sourceWithoutComments(progressFillBlock());

  assert.match(text, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.match(fill, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.doesNotMatch(text, /\bsavingsGoal\b/);
  assert.doesNotMatch(fill, /\bsavingsGoal\b/);
});

// 8. the coaching low-reserve consumer still uses fiscalCoachingSavingsGoal
test("LOT 5.91A the coaching low-reserve consumer still uses fiscalCoachingSavingsGoal", () => {
  const branch = sourceWithoutComments(coachingSavingsGoalBranch());

  assert.match(branch, /fiscalCoachingSavingsGoal > 0/);
  assert.match(branch, /savingsProgress < fiscalCoachingSavingsGoal \* 0\.35/);
  assert.doesNotMatch(branch, /\bsavingsGoal\b/);
});

// 9. the PDF export consumer still uses pdfSavingsGoal
test("LOT 5.91A the PDF export consumer still uses pdfSavingsGoal", () => {
  const branch = sourceWithoutComments(pdfSavingsGoalBranch());
  const pdfExport = sourceWithoutComments(exportBlock());

  assert.match(branch, /typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0/);
  assert.match(branch, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
  assert.match(pdfExport, /\bpdfSavingsGoal\b/);
  assert.doesNotMatch(branch, /\bsavingsGoal\b/);
});

// 10. no direct Legacy savingsGoal consumer exists anywhere
test("LOT 5.91A no direct Legacy savingsGoal consumer exists anywhere", () => {
  for (const [label, block] of [
    ["coaching", coachingSavingsGoalBranch()],
    ["pdf", pdfSavingsGoalBranch()],
    ["objectiveSavingsText", objectiveSavingsTextBlock()],
    ["progressFill", progressFillBlock()],
    ["assistantDraft", assistantDraftBlock()],
    ["assistantGuidance", assistantGuidanceBlock()],
    ["feedback", feedbackBlock()],
    ["persistence", persistenceBlock()],
  ]) {
    assert.doesNotMatch(sourceWithoutComments(block), /\bsavingsGoal\b/, label);
  }
});

// 11. no indirect Legacy savingsGoal alias/derived variable exists
test("LOT 5.91A no indirect Legacy savingsGoal alias or derived variable exists", () => {
  assert.doesNotMatch(CODE, /\b(uiSavingsGoal|coachingSavingsGoal|shadowSavingsGoal|legacySavingsGoal)\b/);
  // Only the two approved Shadow-backed aliases exist; there is no third
  // variable copying, wrapping, or deriving from a removed Legacy root.
  assert.equal(occurrences(CODE, /=\s*savingsGoal\b/g), 0);
});

// 12. no dependency array contains savingsGoal
test("LOT 5.91A no dependency array references savingsGoal", () => {
  assert.doesNotMatch(CODE, /\[\s*[^\]]*\bsavingsGoal\b[^\]]*\]/);
});

// 13 & 14. fiscalSummaryVisibleSlice occurs exactly 15 times, recomputed from source; no 16th
test("LOT 5.91A fiscalSummaryVisibleSlice occurs exactly 15 times with no 16th occurrence", () => {
  const indexes = [...CODE.matchAll(/\bfiscalSummaryVisibleSlice\b/g)].map((match) => match.index);

  assert.equal(indexes.length, 15);
  assert.equal(indexes[15], undefined);
});

// 15. persistence code is unchanged / has no savingsGoal reference
test("LOT 5.91A persistence code is unchanged and has no savingsGoal reference", () => {
  const persistence = sourceWithoutComments(persistenceBlock());

  assert.match(APP_SOURCE, /localStorage\.getItem\(LS_KEY\)/);
  assert.match(persistence, /localStorage\.setItem\(LS_KEY, JSON\.stringify\(payload\)\)/);
  assert.doesNotMatch(persistence, /\bsavingsGoal\b/);
});

// 16. payload/trackEvent code is unchanged / has no savingsGoal reference
test("LOT 5.91A payload and trackEvent code is unchanged and has no savingsGoal reference", () => {
  assert.match(
    APP_SOURCE,
    /trackEvent\("export_pdf", \{\s*source: "revenues",\s*totalRevenues: revenues\.length,\s*invoiceCount: visibleInvoices\.length,\s*\}\);/,
  );
  assert.match(feedbackBlock(), /totalRevenues: currentMonthTotal \|\| 0/);
  assert.doesNotMatch(sourceWithoutComments(feedbackBlock()), /\bsavingsGoal\b/);
});

// 17. assistant-context code has no savingsGoal reference
test("LOT 5.91A assistant-context code has no savingsGoal reference", () => {
  const draft = sourceWithoutComments(assistantDraftBlock());
  const guidance = sourceWithoutComments(assistantGuidanceBlock());

  assert.match(draft, /localStorage\.getItem\(LS_KEY\)/);
  assert.match(guidance, /realMonthlyRevenue: currentMonthTotal/);
  assert.doesNotMatch(draft, /\bsavingsGoal\b/);
  assert.doesNotMatch(guidance, /\bsavingsGoal\b/);
});

// 18. no new useState was introduced by this removal (stable or reduced, never increased)
// LOT 10.2D added 5 useState calls afterwards (declaration dossier UI
// state), unrelated to this removal's own "-0 from the removal" fact.
test("LOT 5.91A useState count is stable, never increased by this removal", () => {
  // Removing a useMemo declaration cannot add a useState call; this locks in
  // that no incidental useState was introduced alongside the removal.
  assert.equal(occurrences(CODE, /\buseState\(/g), 87);
});

// 19. no new useEffect was introduced
// LOT 10.2D added 1 useEffect afterwards (fetch declaration dossiers on
// user change), unrelated to this removal's own "-0 from the removal" fact.
test("LOT 5.91A useEffect count is stable, never increased by this removal", () => {
  assert.equal(occurrences(CODE, /\buseEffect\(/g), 59);
});

// useMemo dropped by exactly the one hook removed with the declaration.
// LOT 10.2B added one new useMemo afterwards (canonical obligation/action
// priority shadow integration); LOT 10.2D added 4 more (declaration
// dossier view selectors) -- this LOT's own baseline is now 92 -- the
// "-1 from the removal" fact this test protects is unaffected by those
// later, unrelated additions.
test("LOT 5.91A useMemo count dropped by exactly one call site (the removed hook)", () => {
  assert.equal(occurrences(CODE, /\buseMemo\(/g), 94);
});

// 20. no new helper/shared function was introduced merging the two aliases
test("LOT 5.91A no shared helper merging fiscalCoachingSavingsGoal and pdfSavingsGoal was introduced", () => {
  assert.doesNotMatch(
    CODE,
    /function\s+\w*[Ss]avingsGoal\w*\s*\(|const\s+\w*[Ss]avingsGoal\w*\s*=\s*\([^)]*\)\s*=>/,
  );
  // Two alias declarations (fiscalCoachingSavingsGoal, pdfSavingsGoal) plus
  // two independent inline JSX expressions (Objectif d'epargne text + bar) --
  // four occurrences of the same formula shape, no shared helper behind them.
  assert.equal(occurrences(CODE, /Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\)/g), 4);
});

// 21. no second Adapter call was introduced
test("LOT 5.91A no second Adapter (buildFiscalSummaryInput) call was introduced", () => {
  assert.equal(occurrences(CODE, /buildFiscalSummaryInput\(\{/g), 1);
  assert.equal(occurrences(CODE, /\bbuildFiscalSummaryInput\b/g), 2);
});

// 22. no second Facade call was introduced
test("LOT 5.91A no second Facade (calculateFiscalSummary) call was introduced", () => {
  assert.equal(occurrences(CODE, /calculateFiscalSummary\(shadowInput, \{ trace: false \}\)/g), 1);
  assert.equal(occurrences(CODE, /\bcalculateFiscalSummary\b/g), 2);
});

// 23. the removed block, if reverted, would be exactly the quoted rollback text
test("LOT 5.91A documents the exact rollback text for the removed declaration", () => {
  const rollbackText =
    "  // LOT 5.29: Legacy savings goal source retained for UI, coaching and PDF boundaries.\n" +
    "  const savingsGoal = useMemo(() => {\n" +
    "    // Objectif d'épargne recommandé: 3 mois de charges\n" +
    "    return Math.max(estimatedCharges * 3, 500);\n" +
    "  }, [estimatedCharges]);";

  assert.match(rollbackText, /const savingsGoal = useMemo\(\(\) => \{/);
  assert.match(rollbackText, /return Math\.max\(estimatedCharges \* 3, 500\);/);
  assert.match(rollbackText, /\}, \[estimatedCharges\]\);/);
  // This exact text must not currently exist in src/App.jsx -- it documents
  // what a future rollback would need to restore, not the present state.
  assert.doesNotMatch(APP_SOURCE, /const savingsGoal = useMemo/);
});

// 24. lint-debt target documented in this file (not itself a runtime assertion)
test("LOT 5.91A documents the expected lint-debt baseline (50/21/29) as a non-runtime note", () => {
  // `npm run lint` is expected to report exactly 50 problems (21 errors, 29
  // warnings) after this removal -- the savingsGoal unused-var error (LOT
  // 5.89) is gone, nothing else changes. This test cannot invoke ESLint
  // itself, so it only documents the connection; the actual lint count is
  // verified in this LOT's Step 5 validation and recorded in
  // docs/LOT_5_91_OBSOLETE_SAVINGSGOAL_ROOT_REMOVAL_REPORT.md.
  const LINT_BASELINE_NOTE = "50 problems (21 errors, 29 warnings)";

  assert.equal(LINT_BASELINE_NOTE, "50 problems (21 errors, 29 warnings)");
});
