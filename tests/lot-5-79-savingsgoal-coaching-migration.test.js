import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const LOT_5_77_SOURCE = readFileSync(
  new URL("./lot-5-77-savingsgoal-coaching-parity-evidence.test.js", import.meta.url),
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

function coachingSavingsGoalBlock() {
  return extractBlock("const fiscalCoachingSavingsGoal = Math.max(", "  const fiscalCoachingCard = useMemo");
}

function fiscalCoachingCardBlock() {
  return extractBlock("const fiscalCoachingCard = useMemo(() => {", "  const isHelperStyledCoachingCard");
}

function lowReserveBranch() {
  const coaching = fiscalCoachingCardBlock();
  const start = coaching.indexOf('!smartAlertIds.has("reserve-low")');
  assert.notEqual(start, -1);
  const end = coaching.indexOf('    if (\n      !smartAlertIds.has("acre-ending")', start);
  assert.notEqual(end, -1);
  return coaching.slice(start, end);
}

function exportBlock() {
  return extractBlock("const handleExportPDF = useCallback", "async function handleExportPDFWithLimit");
}

function assistantBlock() {
  return extractBlock("const simpleAssistantGuidance = useMemo", "  const dashboardRevenueDisplay");
}

function feedbackBlock() {
  return extractBlock("const feedbackContextSnapshot = useMemo", "  const monthlyReflectionRevenueTotal");
}

function persistenceBlock() {
  return extractBlock("    if (!hydrated) return;", "  }, [hydrated, stepIndex, answers, messages, userName, appView]);");
}

function visibleSliceBlock() {
  return extractBlock(
    "const fiscalSummaryVisibleSlice = useMemo(() => {",
    "  // ==================== PREVIEW POUR MODALE AJOUT REVENU ====================",
  );
}

function smartAlertsBlock() {
  return extractBlock("const smartAlertEstimatedCharges =", "  const smartPriorities = useMemo");
}

function weeklyRecapBlock() {
  return extractBlock("const dashboardWeeklyRecap = useMemo(() => {", "  const dashboardThisWeekInsight");
}

test("LOT 5.79 identifies fiscalCoachingCard and exact low-reserve consumer", () => {
  const coaching = sourceWithoutComments(fiscalCoachingCardBlock());
  const branch = sourceWithoutComments(lowReserveBranch());

  assert.match(coaching, /const fiscalCoachingCard = useMemo\(\(\) => \{/);
  assert.match(branch, /!smartAlertIds\.has\("reserve-low"\)/);
  assert.match(branch, /text: roleBasedTips\.dailyFiscalTip\.lowReserve/);
  assert.doesNotMatch(branch, /tvaWatch|missingExpenses|deadline|acreEnding|guestHistory|firstInvoice/);
});

test("LOT 5.79 uses the exact Shadow-backed denominator alias", () => {
  const alias = sourceWithoutComments(coachingSavingsGoalBlock());

  assert.match(
    alias,
    /const fiscalCoachingSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
  assert.doesNotMatch(alias, /savingsGoal|Math\.round|Math\.min|\|\||\?\?|Number\(|parseFloat|toLocaleString/);
});

test("LOT 5.79 removes direct savingsGoal only from the low-reserve consumer", () => {
  const coaching = sourceWithoutComments(fiscalCoachingCardBlock());
  const branch = sourceWithoutComments(lowReserveBranch());

  assert.doesNotMatch(branch, /\bsavingsGoal\b/);
  assert.doesNotMatch(coaching, /\bsavingsGoal\b/);
  assert.match(branch, /fiscalCoachingSavingsGoal > 0/);
  assert.match(branch, /savingsProgress < fiscalCoachingSavingsGoal \* 0\.35/);
});

test("LOT 5.79 confirms root savingsGoal is removed (LOT 5.91A) and the coaching alias keeps its formula", () => {
  const app = sourceWithoutComments(APP_SOURCE);

  assert.doesNotMatch(app, /const savingsGoal = useMemo/);
  assert.doesNotMatch(app, /\bsavingsGoal\b/);
  assert.match(
    APP_SOURCE,
    /const fiscalCoachingSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
});

test("LOT 5.79 keeps numerator ratio structure and threshold unchanged", () => {
  const branch = sourceWithoutComments(lowReserveBranch());

  assert.match(branch, /savingsProgress < fiscalCoachingSavingsGoal \* 0\.35/);
  assert.match(branch, /&&\s*fiscalCoachingSavingsGoal > 0 &&\s*savingsProgress < fiscalCoachingSavingsGoal \* 0\.35/);
  assert.doesNotMatch(branch, /Math\.(round|min|max)\(\s*savingsProgress|\/|<=|>=|===|!==/);
  assert.doesNotMatch(branch, /0\.34|0\.36|100/);
});

test("LOT 5.79 keeps Math.max multiplier and floor unchanged", () => {
  // LOT 5.86A placed the approved pdfSavingsGoal alias directly after
  // fiscalCoachingSavingsGoal, so this extraction range now covers both
  // Shadow-backed savings-goal aliases (coaching, then PDF), in that order.
  const alias = sourceWithoutComments(coachingSavingsGoalBlock());

  assert.match(alias, /const fiscalCoachingSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/);
  assert.match(alias, /const pdfSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/);
  assert.equal(occurrences(alias, /Math\.max\(/g), 2);
  assert.equal(occurrences(alias, /finalContributionAmount \* 3/g), 2);
  assert.equal(occurrences(alias, /\* 3/g), 2);
  assert.equal(occurrences(alias, /\b500\b/g), 2);
});

test("LOT 5.79 keeps rounding comparator branch logic and message unchanged", () => {
  const branch = sourceWithoutComments(lowReserveBranch());

  assert.doesNotMatch(branch, /Math\.round|Math\.floor|Math\.ceil|toFixed|toLocaleString/);
  assert.match(branch, /savingsProgress < fiscalCoachingSavingsGoal \* 0\.35/);
  assert.doesNotMatch(branch, /savingsProgress <=|savingsProgress >|savingsProgress >=/);
  assert.match(branch, /return \{\s*text: roleBasedTips\.dailyFiscalTip\.lowReserve,\s*\};/);
  assert.doesNotMatch(branch, /cta:|title:|level:|severity:|priority:|onClick:|helperStyle:/);
});

test("LOT 5.79 keeps other coaching consumers Legacy or unrelated", () => {
  const coaching = sourceWithoutComments(fiscalCoachingCardBlock());
  const beforeLowReserve = coaching.slice(0, coaching.indexOf('!smartAlertIds.has("reserve-low")'));
  const afterLowReserve = coaching.slice(coaching.indexOf('!smartAlertIds.has("acre-ending")'));

  assert.match(beforeLowReserve, /roleBasedTips\.dailyFiscalTip\.irregularRevenue/);
  assert.match(beforeLowReserve, /roleBasedTips\.dailyFiscalTip\.tvaWatch/);
  assert.match(beforeLowReserve, /roleBasedTips\.dailyFiscalTip\.missingExpenses/);
  assert.match(beforeLowReserve, /roleBasedTips\.dailyFiscalTip\.deadline/);
  assert.match(afterLowReserve, /roleBasedTips\.dailyFiscalTip\.acreEnding/);
  assert.match(afterLowReserve, /roleBasedTips\.dailyFiscalTip\.guestHistory/);
  assert.match(afterLowReserve, /roleBasedTips\.dailyFiscalTip\.firstInvoice/);
  assert.doesNotMatch(`${beforeLowReserve}\n${afterLowReserve}`, /fiscalSummaryVisibleSlice/);
  assert.equal(occurrences(`${beforeLowReserve}\n${afterLowReserve}`, /\bfiscalCoachingSavingsGoal\b/g), 1);
});

test("LOT 5.79 keeps PDF export Legacy", () => {
  const pdfExport = sourceWithoutComments(exportBlock());

  assert.match(pdfExport, /Objectif d epargne/);
  assert.match(pdfExport, /typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0/);
  assert.match(pdfExport, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
  assert.match(pdfExport, /pdfSavingsGoal,\s*\n\s*savingsProgress,/);
  assert.doesNotMatch(pdfExport, /fiscalCoachingSavingsGoal|fiscalSummaryVisibleSlice\.finalContributionAmount/);
});

test("LOT 5.79 keeps assistant persistence payloads feedback analytics isolated", () => {
  const coaching = sourceWithoutComments(fiscalCoachingCardBlock());
  const assistant = sourceWithoutComments(assistantBlock());
  const persistence = sourceWithoutComments(persistenceBlock());
  const feedback = sourceWithoutComments(feedbackBlock());

  assert.doesNotMatch(coaching, /simpleAssistantGuidance|localStorage|sessionStorage|supabase|payload|trackEvent|feedbackContextSnapshot|handleExportPDF/i);
  assert.doesNotMatch(assistant, /fiscalCoachingSavingsGoal|savingsGoal/);
  assert.doesNotMatch(persistence, /fiscalCoachingSavingsGoal|savingsGoal|fiscalSummaryVisibleSlice/);
  assert.doesNotMatch(feedback, /fiscalCoachingSavingsGoal|savingsGoal|fiscalSummaryVisibleSlice\.finalContributionAmount/);
});

test("LOT 5.79 keeps no propagation to smart alerts weekly invoices or reminders", () => {
  const smartAlerts = sourceWithoutComments(smartAlertsBlock());
  const weekly = sourceWithoutComments(weeklyRecapBlock());
  const coaching = sourceWithoutComments(fiscalCoachingCardBlock());

  assert.doesNotMatch(smartAlerts, /fiscalCoachingSavingsGoal|savingsGoal/);
  assert.doesNotMatch(weekly, /fiscalCoachingSavingsGoal|savingsGoal/);
  assert.doesNotMatch(coaching, /invoice_create|saveReminder|reminder|weeklyRecap|buildSmartAlerts/);
});

test("LOT 5.79 reuses the existing feature flag through the visible slice", () => {
  const visibleSlice = sourceWithoutComments(visibleSliceBlock());
  const app = sourceWithoutComments(APP_SOURCE);

  assert.match(visibleSlice, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/);
  assert.match(visibleSlice, /finalContributionAmount: usesShadow\s*\?\s*shadowResult\.summary\.finalContributionAmount\s*:\s*estimatedCharges/);
  assert.equal(occurrences(app, /SAVINGSGOAL_COACHING/g), 0);
});

test("LOT 5.79 adds no new state effect memo adapter or facade", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const alias = sourceWithoutComments(coachingSavingsGoalBlock());

  assert.equal(occurrences(app, /\buseState\(/g), APPROVED_COUNTS.useState);
  assert.equal(occurrences(app, /\buseEffect\(/g), APPROVED_COUNTS.useEffect);
  assert.equal(occurrences(app, /\buseMemo\(/g), APPROVED_COUNTS.useMemo);
  assert.equal(occurrences(app, /\bbuildFiscalSummaryInput\b/g), APPROVED_COUNTS.buildFiscalSummaryInput);
  assert.equal(occurrences(app, /\bcalculateFiscalSummary\b/g), APPROVED_COUNTS.calculateFiscalSummary);
  assert.doesNotMatch(alias, /useState|useEffect|useMemo\(|buildFiscalSummaryInput|calculateFiscalSummary/);
});

test("LOT 5.98 supplements the whole-file hook counts with a scoped savingsGoal-boundary check", () => {
  // LOT 5.98: APPROVED_COUNTS.useState/useEffect/useMemo above are whole-file totals -- they
  // shift on any unrelated hook addition or removal anywhere in the ~15,000-line file
  // (documented fragility class B in LOT 5.96/5.97). This supplements, without replacing, that
  // count with a check scoped to the two savingsGoal boundaries this file's own history cares
  // about (the coaching/PDF denominator aliases and the low-reserve branch that reads them),
  // mirroring the pattern LOT 5.97 established in lot-5-29. fiscalCoachingCardBlock() is
  // intentionally not included here: its own start marker is the `useMemo(` declaration of the
  // coaching card itself, so a zero-count check against it would always fail regardless of
  // this boundary's actual content.
  const alias = coachingSavingsGoalBlock();
  const branch = lowReserveBranch();

  for (const block of [alias, branch]) {
    assert.equal(occurrences(block, /\buseState\(/g), 0);
    assert.equal(occurrences(block, /\buseEffect\(/g), 0);
    assert.equal(occurrences(block, /\buseMemo\(/g), 0);
  }
});

test("LOT 5.79 preserves parity evidence shadow evidence and runtime evidence", () => {
  assert.match(LOT_5_77_SOURCE, /intentional amount ratio and branch mismatches/);
  assert.match(LOT_5_77_SOURCE, /shadowCandidateGoal/);
  assert.match(SHADOW_PARITY_SOURCE, /SHADOW_PARITY_MATCH/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
});

test("LOT 5.79 sets Shadow baseline to fourteen with exact fourteenth signature", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const alias = sourceWithoutComments(coachingSavingsGoalBlock());
  const coaching = sourceWithoutComments(fiscalCoachingCardBlock());

  assert.equal(occurrences(app, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_COUNTS.fiscalSummaryVisibleSlice);
  // LOT 5.86A's approved pdfSavingsGoal alias sits in this same extraction
  // range, so it now carries two finalContributionAmount reads, not one.
  assert.equal(occurrences(alias, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 2);
  assert.equal(occurrences(coaching, /\bfiscalSummaryVisibleSlice\b/g), 0);
});

test("LOT 5.79 has no fifteenth occurrence and rollback remains local", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const alias = sourceWithoutComments(coachingSavingsGoalBlock());
  const branch = sourceWithoutComments(lowReserveBranch());

  // LOT 5.86A approved exactly one further consumer (the PDF export alias),
  // raising the baseline from 14 to 15 with no 16th occurrence.
  assert.equal(occurrences(app, /\bfiscalSummaryVisibleSlice\b/g), 15);
  assert.match(alias, /const fiscalCoachingSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.match(alias, /const pdfSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.match(branch, /fiscalCoachingSavingsGoal > 0/);
  assert.match(branch, /savingsProgress < fiscalCoachingSavingsGoal \* 0\.35/);
  assert.doesNotMatch(branch, /\bsavingsGoal\b/);
});
