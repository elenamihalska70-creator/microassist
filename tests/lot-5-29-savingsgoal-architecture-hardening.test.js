import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// LOT 5.97: normalize CRLF to LF so line-ending style never affects marker search (same
// pattern established in LOT 5.92/5.94). Previously this file read APP_SOURCE unnormalized
// and hardcoded literal "\r\n" sequences directly into two of its own markers below to
// compensate -- that worked only because the file happens to be CRLF today; it would have
// silently broken (exactly like the LOT 5.92/5.94 bug) on any future CRLF->LF normalization
// of src/App.jsx. Normalizing here and switching those two markers to bare "\n" removes that
// hidden assumption without changing what either marker matches (verified byte-identical).
const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const LOT_5_18_SOURCE = readFileSync(
  new URL("./lot-5-18-legacy-retention-hardening.test.js", import.meta.url),
  "utf8",
);
const LOT_5_28_REPORT = readFileSync(
  new URL("../docs/LOT_5_28_EXTENDED_CONSUMER_ANALYSIS.md", import.meta.url),
  "utf8",
);

const APPROVED_APP_COUNTS = Object.freeze({
  // LOT 5.91A: root savingsGoal removed, dropping 2 estimatedCharges reads
  // (formula body + dependency array) and 1 useMemo hook.
  estimatedCharges: 12,
  savingsGoal: 0,
  savingsProgress: 7,
  fiscalSummaryVisibleSlice: 15,
  buildFiscalSummaryInput: 2,
  calculateFiscalSummary: 2,
  createRuntimeParityEvidence: 2,
  useState: 88, // LOT 10.2D: +5 useState (declaration dossier UI state); LOT 10.2D.1: +1 (payment confirm loading guard)
  useEffect: 60, // LOT 10.2D: +1 useEffect (fetch declaration dossiers on user change)
  // LOT 10.2B: +1 useMemo for the canonical obligation/action priority shadow integration.
  useMemo: 93, // LOT 10.2D: +4 useMemo (declaration dossier view selectors)
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

function progressIndicatorsBlock() {
  return extractBlock(
    "{isFiscalProfileComplete && fiscalSummaryVisibleSlice.revenueTotal > 0 && (",
    "              {/* ACRE Expiration Warning */}",
  );
}

function coachingSavingsGoalBranch() {
  return extractBlock(
    "// LOT 5.79A coaching boundary: source-only denominator migration.",
    "    if (\n      !smartAlertIds.has(\"acre-ending\")",
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

function computeSavingsGoal(estimatedCharges) {
  return Math.max(estimatedCharges * 3, 500);
}

function computeUiProgressPercent(savingsProgress, savingsGoal) {
  return Math.min(100, Math.round((savingsProgress / savingsGoal) * 100));
}

function computePdfProgressPercent(savingsProgress, savingsGoal) {
  return Math.round((savingsProgress / savingsGoal) * 100 || 0);
}

test("LOT 5.29 keeps the savingsGoal value contract unchanged", () => {
  assert.equal(computeSavingsGoal(0), 500);
  assert.equal(computeSavingsGoal(1), 500);
  assert.equal(computeSavingsGoal(166), 500);
  assert.equal(computeSavingsGoal(167), 501);
  assert.equal(computeSavingsGoal(264), 792);
});

test("LOT 5.91A confirms the root savingsGoal declaration is removed and both active aliases keep their formula", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.doesNotMatch(code, /const savingsGoal = useMemo/);
  assert.doesNotMatch(code, /\bsavingsGoal\b/);
  assert.equal(occurrences(code, /Math\.max\(estimatedCharges \* 3, 500\)/g), 0);
  assert.match(
    APP_SOURCE,
    /const fiscalCoachingSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
  assert.match(
    APP_SOURCE,
    /const pdfSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
});

test("LOT 5.29 keeps estimatedCharges unchanged", () => {
  const block = estimatedChargesBlock();

  assert.match(block, /const estimatedCharges = useMemo\(\(\) => \{/);
  assert.match(block, /if \(computed\?\.rate\) \{/);
  assert.match(block, /return Math\.round\(currentMonthTotal \* computed\.rate\);/);
  assert.match(block, /return 0;/);
  assert.match(block, /\}, \[currentMonthTotal, computed\?\.rate\]\);/);
});

test("LOT 5.29 identifies the UI boundary separately", () => {
  const block = progressIndicatorsBlock();

  assert.match(block, /LOT 5\.29 UI boundary/);
  assert.match(block, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.equal(occurrences(block, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/g), 2);
  assert.doesNotMatch(block, /Math\.round\(\(savingsProgress \/ savingsGoal\) \* 100\)/);
  assert.doesNotMatch(block, /fiscalCoachingCard|handleExportPDF|localStorage|sessionStorage|supabase|payload|assistant/i);
});

test("LOT 5.29 identifies the coaching boundary separately", () => {
  const block = coachingSavingsGoalBranch();

  assert.match(block, /LOT 5\.79A coaching boundary/);
  assert.match(block, /fiscalCoachingSavingsGoal > 0/);
  assert.match(block, /savingsProgress < fiscalCoachingSavingsGoal \* 0\.35/);
  assert.match(block, /roleBasedTips\.dailyFiscalTip\.lowReserve/);
  assert.doesNotMatch(block, /handleExportPDF|doc\.|localStorage|sessionStorage|supabase|payload|assistant/i);
});

test("LOT 5.29 identifies the PDF boundary separately", () => {
  const block = pdfSavingsGoalBranch();

  assert.match(block, /LOT 5\.86A PDF boundary/);
  assert.match(block, /Objectif d epargne/);
  assert.match(block, /typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0/);
  assert.match(block, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
  assert.doesNotMatch(block, /fiscalCoachingCard|localStorage|sessionStorage|supabase|payload|assistant/i);
});

test("LOT 5.29 keeps non-UI savingsGoal boundaries without Shadow reads", () => {
  const code = sourceWithoutComments(
    [coachingSavingsGoalBranch(), pdfSavingsGoalBranch()].join("\n"),
  );

  assert.doesNotMatch(code, /fiscalSummaryVisibleSlice\.finalContributionAmount/);
  assert.doesNotMatch(code, /shadowResult\.summary\.finalContributionAmount/);
  assert.doesNotMatch(code, /\bfinalContributionAmount\b/);
});

test("LOT 5.29 adds no new rounding, percentage or fallback in savingsGoal responsibilities", () => {
  const code = sourceWithoutComments(
    [
      progressIndicatorsBlock(),
      coachingSavingsGoalBranch(),
      pdfSavingsGoalBranch(),
    ].join("\n"),
  );

  assert.equal(occurrences(code, /Math\.max\(estimatedCharges \* 3, 500\)/g), 0);
  assert.equal(occurrences(code, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/g), 2);
  assert.equal(occurrences(code, /Math\.round\(\(savingsProgress \/ savingsGoal\) \* 100\)/g), 0);
  assert.equal(occurrences(code, /Math\.round\(\(savingsProgress \/ savingsGoal\) \* 100 \|\| 0\)/g), 0);
  assert.equal(occurrences(code, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/g), 1);
  assert.equal(occurrences(code, /savingsProgress < fiscalCoachingSavingsGoal \* 0\.35/g), 1);
  assert.doesNotMatch(code, /\|\|\s*(estimatedCharges|fiscalSummaryVisibleSlice|finalContributionAmount)/);
  assert.doesNotMatch(code, /\?\?\s*(estimatedCharges|fiscalSummaryVisibleSlice|finalContributionAmount)/);
});

test("LOT 5.29 preserves UI and PDF percentage behavior", () => {
  assert.equal(computeUiProgressPercent(0, 500), 0);
  assert.equal(computeUiProgressPercent(250, 500), 50);
  assert.equal(computeUiProgressPercent(700, 500), 100);
  assert.equal(computePdfProgressPercent(0, 500), 0);
  assert.equal(computePdfProgressPercent(250, 500), 50);
  assert.equal(computePdfProgressPercent(700, 500), 140);
});

test("LOT 5.29 keeps persistence, assistant and payload boundaries unchanged", () => {
  assert.doesNotMatch(coachingSavingsGoalBranch(), /localStorage|sessionStorage|supabase|fetch|payload|assistant/i);
  assert.doesNotMatch(pdfSavingsGoalBranch(), /localStorage|sessionStorage|supabase|fetch|payload|assistant/i);
  assert.doesNotMatch(progressIndicatorsBlock(), /localStorage|sessionStorage|supabase|fetch|payload|assistant/i);
  assert.match(APP_SOURCE, /localStorage\.getItem\(LS_KEY\)/);
  assert.match(APP_SOURCE, /supabase\.from\("revenues"\)/);
  assert.match(feedbackBlock(), /totalRevenues: currentMonthTotal \|\| 0/);
  assert.match(assistantDraftBlock(), /localStorage\.getItem\(LS_KEY\)/);
  assert.doesNotMatch(sourceWithoutComments(APP_SOURCE), /\bsavingsGoal\b/);
});

test("LOT 5.29 keeps export output contract unchanged", () => {
  const block = exportBlock();

  assert.match(block, /Objectif d epargne/);
  assert.match(block, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
  assert.match(block, /currentMonthTotal/);
  assert.match(block, /dashboardChargesDisplay/);
  assert.match(block, /dashboardAvailableDisplay/);
  assert.doesNotMatch(block, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
});

test("LOT 5.29 no cross-consumer coupling guard remains deterministic", () => {
  const ui = progressIndicatorsBlock();
  const coaching = coachingSavingsGoalBranch();
  const pdf = pdfSavingsGoalBranch();

  assert.match(ui, /LOT 5\.29 UI boundary/);
  assert.match(coaching, /LOT 5\.79A coaching boundary/);
  assert.match(pdf, /LOT 5\.86A PDF boundary/);
  assert.doesNotMatch(ui, /roleBasedTips|lowReserve|Objectif d epargne|doc\./);
  assert.doesNotMatch(coaching, /Objectif d epargne|doc\.|progressFill/);
  assert.doesNotMatch(pdf, /roleBasedTips|lowReserve|progressFill/);
});

test("LOT 5.29 keeps Legacy retention and prior analysis intact", () => {
  // LOT 5.95: LOT 5.18's own baseline moved 14 -> 12 in LOT 5.94, after the
  // approved LOT 5.91A root savingsGoal removal dropped 2 estimatedCharges reads.
  //
  // LOT 5.97: stop hardcoding that "12" a second time here. This test previously asserted
  // the literal /estimatedCharges: 12/ against lot-5-18's raw source, duplicating the same
  // magic number lot-5-29 already independently re-derives from live src/App.jsx (see
  // APPROVED_APP_COUNTS.estimatedCharges, verified against APP_SOURCE by the "introduces no
  // new React or pipeline execution surface" test below). That duplication is exactly what
  // broke this test when LOT 5.94 correctly updated lot-5-18's count but had no reason to
  // touch this unrelated file. Building the regex from lot-5-29's own live-verified value
  // keeps the same protective intent -- lot-5-18's guard must still enforce the same
  // estimatedCharges baseline -- without a second hardcoded copy of the number to drift.
  assert.match(
    LOT_5_18_SOURCE,
    new RegExp(`estimatedCharges:\\s*${APPROVED_APP_COUNTS.estimatedCharges}\\b`),
  );
  assert.match(LOT_5_18_SOURCE, /blocks unapproved new Legacy consumers/);
  assert.match(LOT_5_28_REPORT, /`savingsGoal` currently mixes multiple responsibilities/);
  assert.match(LOT_5_28_REPORT, /GO POUR LOT 5\.29 — SAVINGSGOAL ARCHITECTURE HARDENING/);
});

test("LOT 5.29 introduces no new React or pipeline execution surface", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  for (const [identifier, expectedCount] of Object.entries(APPROVED_APP_COUNTS)) {
    assert.equal(
      occurrences(code, new RegExp(`\\b${identifier}\\b`, "g")),
      expectedCount,
      identifier,
    );
  }

  assert.equal(occurrences(APP_SOURCE, /buildFiscalSummaryInput\(\{/g), 1);
  assert.equal(occurrences(APP_SOURCE, /calculateFiscalSummary\(shadowInput, \{ trace: false \}\)/g), 1);
});

test("LOT 5.29 adds no new consumer beyond documented boundary comments", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.equal(occurrences(code, /\bsavingsGoal\b/g), APPROVED_APP_COUNTS.savingsGoal);
  assert.equal(occurrences(code, /Math\.max\(estimatedCharges \* 3, 500\)/g), 0);
  assert.equal(occurrences(code, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/g), 4);
  // LOT 5.86A approved exactly one new consumer: the PDF export denominator alias.
  assert.equal(occurrences(code, /\bpdfSavingsGoal\b/g), 5);
  assert.doesNotMatch(code, /\b(uiSavingsGoal|coachingSavingsGoal)\b/);
});

test("LOT 5.97 supplements whole-file hook counts with a scoped savingsGoal-boundary check", () => {
  // LOT 5.97: APPROVED_APP_COUNTS.useState/useEffect/useMemo above are whole-file totals --
  // they protect against an unapproved new hook anywhere in ~15,000 lines, so they shift on
  // any unrelated, out-of-scope hook addition or removal too (documented fragility class B
  // in the LOT 5.96 test architecture review). This supplements, without replacing, that
  // count with a check scoped to only the three savingsGoal boundaries this LOT's history
  // actually cares about: it independently fails if a new useState/useEffect/useMemo hook is
  // ever introduced *inside* the UI, coaching, or PDF boundary blocks specifically, regardless
  // of what else changes elsewhere in the file.
  const ui = progressIndicatorsBlock();
  const coaching = coachingSavingsGoalBranch();
  const pdf = pdfSavingsGoalBranch();

  for (const block of [ui, coaching, pdf]) {
    assert.equal(occurrences(block, /\buseState\(/g), 0);
    assert.equal(occurrences(block, /\buseEffect\(/g), 0);
    assert.equal(occurrences(block, /\buseMemo\(/g), 0);
  }
});

test("LOT 5.97 urssafHelperBlock-style extraction is identical for CRLF and LF source line endings", () => {
  // Same robustness check LOT 5.92 added to lot-5-24/25/26 and LOT 5.94 added to
  // lot-5-20/21/22, applied here since this file also now normalizes CRLF to LF before
  // marker search. Demonstrates the invariant holds regardless of which line-ending style the
  // raw file happens to have at read time -- no shared runtime helper is created or exported.
  const rawSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const crlfSource = rawSource.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
  const lfSource = crlfSource.replace(/\r\n/g, "\n");

  function localExtractBlock(source, startText, endText) {
    const start = source.indexOf(startText);
    assert.notEqual(start, -1, startText);
    const end = source.indexOf(endText, start);
    assert.notEqual(end, -1, endText);
    return source.slice(start, end);
  }

  const fromCrlf = localExtractBlock(
    crlfSource.replace(/\r\n/g, "\n"),
    "// LOT 5.86A PDF boundary: source-only denominator migration.",
    "    ],\n    soft\n  );",
  );
  const fromLf = localExtractBlock(
    lfSource,
    "// LOT 5.86A PDF boundary: source-only denominator migration.",
    "    ],\n    soft\n  );",
  );

  assert.equal(fromCrlf, fromLf);
  assert.equal(fromLf, pdfSavingsGoalBranch());
});

test("LOT 5.29 hardening test is deterministic and side-effect free", () => {
  const testSource = readFileSync(new URL(import.meta.url), "utf8");

  assert.doesNotMatch(testSource, /\bDate\.now\b|\bnew Date\b|Math\.random/);
  assert.doesNotMatch(testSource, /\blocalStorage\b\./);
  assert.doesNotMatch(testSource, /\bsupabase\b\./i);
  assert.doesNotMatch(testSource, /\bfetch\s*\(/);
});
