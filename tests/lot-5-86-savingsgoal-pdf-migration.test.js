import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const LOT_5_84_SOURCE = readFileSync(
  new URL("./lot-5-84-savingsgoal-pdf-parity-evidence.test.js", import.meta.url),
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
  // LOT 5.91A: root savingsGoal removed (0 remaining occurrences), dropping
  // 1 useMemo( call site.
  savingsGoal: 0,
  pdfSavingsGoal: 5,
  useState: 87, // LOT 10.2D: +5 useState (declaration dossier UI state); LOT 10.2D.1: +1 (payment confirm loading guard)
  useEffect: 59, // LOT 10.2D: +1 useEffect (fetch declaration dossiers on user change)
  // LOT 10.2B: +1 useMemo for the canonical obligation/action priority shadow integration.
  useMemo: 94, // LOT 10.2D: +4 useMemo (declaration dossier view selectors); LOT 10.2E.1: +2 (dashboardPrioritizedActions, priorityCardViewModel)
  buildFiscalSummaryInput: 2,
  calculateFiscalSummary: 2,
});
const FALLBACK_TEXT = "Pas encore assez de données";

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

function savingsProgressBlock() {
  return extractBlock("const savingsProgress = useMemo(() => {", "  const fiscalCoachingSavingsGoal = Math.max");
}

function fiscalCoachingSavingsGoalBlock() {
  return extractBlock("const fiscalCoachingSavingsGoal = Math.max(", "  const pdfSavingsGoal = Math.max");
}

function pdfSavingsGoalBlock() {
  return extractBlock("const pdfSavingsGoal = Math.max(", "  const fiscalCoachingCard = useMemo");
}

function visibleSliceBlock() {
  return extractBlock(
    "const fiscalSummaryVisibleSlice = useMemo(() => {",
    "  // ==================== PREVIEW POUR MODALE AJOUT REVENU ====================",
  );
}

function exportBlock() {
  return extractBlock("const handleExportPDF = useCallback", "async function handleExportPDFWithLimit");
}

function pdfObjectifLineBlock() {
  return extractBlock(
    "// LOT 5.86A PDF boundary: source-only denominator migration.",
    "    ],\n    soft\n  );",
  );
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

function appWithoutVisibleSlice() {
  return sourceWithoutComments(APP_SOURCE).replace(sourceWithoutComments(visibleSliceBlock()), "");
}

function pdfPercentageSnapshot({ savingsProgress, pdfSavingsGoal }) {
  return typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0
    ? `${Math.round((savingsProgress / pdfSavingsGoal) * 100 || 0)}%`
    : FALLBACK_TEXT;
}

test("LOT 5.86A identifies handleExportPDF and the Objectif d epargne percentage consumer", () => {
  const pdfExport = sourceWithoutComments(exportBlock());
  const objectifLine = sourceWithoutComments(pdfObjectifLineBlock());

  assert.match(pdfExport, /const handleExportPDF = useCallback\(async \(\) => \{/);
  assert.match(pdfExport, /drawTitle\("3\. Analyse"\)/);
  assert.match(pdfExport, /drawBox\(\s*"Projection"/);
  assert.match(objectifLine, /Objectif d epargne/);
  assert.match(objectifLine, /typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0/);
});

test("LOT 5.86A uses the exact Shadow-derived PDF denominator alias", () => {
  const alias = sourceWithoutComments(pdfSavingsGoalBlock());

  assert.match(
    alias,
    /const pdfSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
  assert.equal(occurrences(alias, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 1);
  assert.equal(occurrences(alias, /\* 3/g), 1);
  assert.equal(occurrences(alias, /\b500\b/g), 1);
  assert.doesNotMatch(alias, /useMemo|savingsGoal|Math\.round|Math\.min|\|\||\?\?|Number\(|parseFloat|format|toLocaleString/);
});

test("LOT 5.86A removes direct savingsGoal only from the targeted PDF denominator", () => {
  const objectifLine = sourceWithoutComments(pdfObjectifLineBlock());
  const pdfExport = sourceWithoutComments(exportBlock());
  const app = sourceWithoutComments(APP_SOURCE);

  assert.match(objectifLine, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
  assert.match(objectifLine, /`\$\{Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)\}%`/);
  assert.doesNotMatch(objectifLine, /\bsavingsGoal\b/);
  assert.doesNotMatch(pdfExport, /fiscalCoachingSavingsGoal|fiscalSummaryVisibleSlice\.finalContributionAmount/);
  assert.equal(occurrences(app, /\bsavingsGoal\b/g), APPROVED_COUNTS.savingsGoal);
});

test("LOT 5.86A confirms root savingsGoal is removed (LOT 5.91A) and savingsProgress is unchanged", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const progress = sourceWithoutComments(savingsProgressBlock());

  assert.doesNotMatch(app, /const savingsGoal = useMemo/);
  assert.doesNotMatch(app, /\bsavingsGoal\b/);
  assert.match(progress, /const savingsProgress = useMemo\(\(\) => \{/);
  assert.match(progress, /return availableAmount;/);
  assert.match(progress, /\}, \[availableAmount\]\);/);
});

test("LOT 5.86A preserves ratio fallback rounding formatter and no-cap behavior", () => {
  const objectifLine = sourceWithoutComments(pdfObjectifLineBlock());

  assert.match(objectifLine, /typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0/);
  assert.match(objectifLine, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
  assert.match(objectifLine, /}%`/);
  assert.match(objectifLine, /"Pas encore assez de données"/);
  assert.doesNotMatch(objectifLine, /Math\.min\(\s*100|Math\.max\(\s*0|toLocaleString|Intl\.NumberFormat|toFixed/);
  assert.equal(pdfPercentageSnapshot({ savingsProgress: 505, pdfSavingsGoal: 500 }), "101%");
  assert.equal(pdfPercentageSnapshot({ savingsProgress: 625, pdfSavingsGoal: 500 }), "125%");
  assert.equal(pdfPercentageSnapshot({ savingsProgress: 100, pdfSavingsGoal: 0 }), FALLBACK_TEXT);
});

test("LOT 5.86A keeps PDF layout labels filename and other outputs unchanged", () => {
  const pdfExport = sourceWithoutComments(exportBlock());

  assert.match(pdfExport, /drawTitle\("1\. Profil"\)/);
  assert.match(pdfExport, /drawTitle\("2\. Resume du mois"\)/);
  assert.match(pdfExport, /drawTitle\("3\. Analyse"\)/);
  assert.match(pdfExport, /Projection annuelle/);
  assert.match(pdfExport, /Taux estime/);
  assert.match(pdfExport, /Objectif d epargne/);
  assert.match(pdfExport, /drawTitle\("4\. Actions recommandees"\)/);
  assert.match(pdfExport, /doc\.save\(\s*`rapport_microassist_/);
  assert.match(APP_SOURCE, /trackEvent\("export_pdf", \{\s*source: "revenues",\s*totalRevenues: revenues\.length,\s*invoiceCount: visibleInvoices\.length,\s*\}\);/);
});

test("LOT 5.86A keeps assistant persistence payload feedback and analytics isolated", () => {
  const assistant = sourceWithoutComments(assistantBlock());
  const persistence = sourceWithoutComments(persistenceBlock());
  const feedback = sourceWithoutComments(feedbackBlock());
  const pdfExport = sourceWithoutComments(exportBlock());

  assert.doesNotMatch(assistant, /\bsavingsGoal\b|pdfSavingsGoal|fiscalSummaryVisibleSlice\.finalContributionAmount/);
  assert.doesNotMatch(persistence, /\bsavingsGoal\b|pdfSavingsGoal|fiscalSummaryVisibleSlice/);
  assert.doesNotMatch(feedback, /\bsavingsGoal\b|pdfSavingsGoal|fiscalSummaryVisibleSlice\.finalContributionAmount/);
  assert.doesNotMatch(pdfExport, /localStorage|sessionStorage|supabase|fetch|feedbackContextSnapshot|simpleAssistantGuidance/);
});

test("LOT 5.86A adds no state effect memo adapter facade or feature flag", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const visibleSlice = sourceWithoutComments(visibleSliceBlock());
  const alias = sourceWithoutComments(pdfSavingsGoalBlock());

  assert.equal(occurrences(app, /\buseState\(/g), APPROVED_COUNTS.useState);
  assert.equal(occurrences(app, /\buseEffect\(/g), APPROVED_COUNTS.useEffect);
  assert.equal(occurrences(app, /\buseMemo\(/g), APPROVED_COUNTS.useMemo);
  assert.equal(occurrences(app, /\bbuildFiscalSummaryInput\b/g), APPROVED_COUNTS.buildFiscalSummaryInput);
  assert.equal(occurrences(app, /\bcalculateFiscalSummary\b/g), APPROVED_COUNTS.calculateFiscalSummary);
  assert.doesNotMatch(alias, /useState|useEffect|useMemo\(|buildFiscalSummaryInput|calculateFiscalSummary/);
  assert.match(visibleSlice, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/);
  assert.doesNotMatch(app, /SAVINGSGOAL_PDF|PDF_SAVINGSGOAL|localStorage\.[gs]etItem\([^)]*FISCAL_SUMMARY/);
});

test("LOT 5.98 supplements the whole-file hook counts with a scoped savingsGoal-boundary check", () => {
  // LOT 5.98: APPROVED_COUNTS.useState/useEffect/useMemo above are whole-file totals -- they
  // shift on any unrelated hook addition or removal anywhere in the ~15,000-line file
  // (documented fragility class B in LOT 5.96/5.97). This supplements, without replacing, that
  // count with a check scoped to the two savingsGoal boundaries this file's own history cares
  // about (the coaching/PDF denominator aliases and the PDF Objectif line that reads the PDF
  // alias), mirroring the pattern LOT 5.97 established in lot-5-29. savingsProgressBlock() is
  // intentionally not included here: its own start marker is the `useMemo(` declaration of
  // savingsProgress itself (a separate, still-Legacy upstream value, not part of this LOT's
  // approved boundary), so a zero-count check against it would always fail.
  const coachingAlias = fiscalCoachingSavingsGoalBlock();
  const pdfAlias = pdfSavingsGoalBlock();
  const objectifLine = pdfObjectifLineBlock();

  for (const block of [coachingAlias, pdfAlias, objectifLine]) {
    assert.equal(occurrences(block, /\buseState\(/g), 0);
    assert.equal(occurrences(block, /\buseEffect\(/g), 0);
    assert.equal(occurrences(block, /\buseMemo\(/g), 0);
  }
});

test("LOT 5.86A keeps PDF parity shadow parity and runtime evidence intact", () => {
  assert.match(LOT_5_84_SOURCE, /one-hundred-one-percent/);
  assert.match(LOT_5_84_SOURCE, /detects intentional denominator ratio rounded and formatted mismatches/);
  assert.match(SHADOW_PARITY_SOURCE, /SHADOW_PARITY_MATCH/);
  assert.match(SHADOW_PARITY_SOURCE, /SHADOW_PARITY_MISMATCH/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /runtime parity evidence has no UI, state, persistence, network or implicit time access/);
});

test("LOT 5.86A locks Shadow baseline thirteen and the exact thirteenth consumer", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const alias = sourceWithoutComments(pdfSavingsGoalBlock());
  const coachingAlias = sourceWithoutComments(fiscalCoachingSavingsGoalBlock());

  assert.equal(occurrences(app, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(occurrences(appWithoutVisibleSlice(), /\bfiscalSummaryVisibleSlice\b/g), 12);
  assert.equal(occurrences(alias, /\bfiscalSummaryVisibleSlice\b/g), 1);
  assert.equal(occurrences(coachingAlias, /\bfiscalSummaryVisibleSlice\b/g), 1);
  assert.equal(occurrences(app, /\bpdfSavingsGoal\b/g), APPROVED_COUNTS.pdfSavingsGoal);
  assert.doesNotMatch(sourceWithoutComments(exportBlock()), /fiscalSummaryVisibleSlice/);
});

test("LOT 5.86A keeps rollback local to the PDF Objectif denominator", () => {
  const objectifLine = sourceWithoutComments(pdfObjectifLineBlock());
  const pdfExport = sourceWithoutComments(exportBlock());

  assert.equal(occurrences(objectifLine, /\bpdfSavingsGoal\b/g), 3);
  assert.equal(occurrences(pdfExport, /\bpdfSavingsGoal\b/g), 4);
  assert.doesNotMatch(objectifLine, /\bsavingsGoal\b/);
  assert.match(pdfExport, /pdfSavingsGoal,\s*savingsProgress,\s*\]\);/);
});
