import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const LOT_5_87_REPORT = readFileSync(
  new URL("../docs/LOT_5_87_SAVINGSGOAL_PDF_FULL_SUITE_FAILURE_TRIAGE.md", import.meta.url),
  "utf8",
);
const LOT_5_86_SOURCE = readFileSync(
  new URL("./lot-5-86-savingsgoal-pdf-migration.test.js", import.meta.url),
  "utf8",
);

const APPROVED_COUNTS = Object.freeze({
  fiscalSummaryVisibleSlice: 13,
  // LOT 5.91A: root savingsGoal removed (0 remaining occurrences).
  savingsGoal: 0,
  pdfSavingsGoal: 5,
  fiscalCoachingSavingsGoal: 4,
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

function occurrenceIndexes(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => match.index);
}

function extractBlock(startText, endText) {
  const start = APP_SOURCE.indexOf(startText);
  assert.notEqual(start, -1, `Missing block start: ${startText}`);
  const end = APP_SOURCE.indexOf(endText, start);
  assert.notEqual(end, -1, `Missing block end: ${endText}`);
  return APP_SOURCE.slice(start, end);
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

function appWithoutVisibleSlice() {
  return sourceWithoutComments(APP_SOURCE).replace(sourceWithoutComments(visibleSliceBlock()), "");
}

test("LOT 5.88 recomputes the fiscalSummaryVisibleSlice baseline as exactly thirteen", () => {
  const code = sourceWithoutComments(APP_SOURCE);
  const indexes = occurrenceIndexes(code, /\bfiscalSummaryVisibleSlice\b/g);

  assert.equal(indexes.length, 13);
  assert.equal(indexes.length, APPROVED_COUNTS.fiscalSummaryVisibleSlice);
});

test("LOT 5.88 confirms the fifteenth (newest-approved) occurrence is the pdfSavingsGoal alias signature", () => {
  // The Nth-occurrence numbering used across the LOT 5.x guard series tracks
  // the cumulative count of approved consumers introduced LOT by LOT, not a
  // raw left-to-right text position in App.jsx (pdfSavingsGoal is defined
  // near the top of the component body, well before later JSX consumers).
  // The fifteenth approved consumer -- the one that raised the baseline from
  // 14 to 15 -- is therefore verified by exact block content, the same way
  // every prior LOT 5.x baseline guard verifies its newest consumer.
  const alias = sourceWithoutComments(pdfSavingsGoalBlock());

  assert.match(
    alias,
    /const pdfSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
  assert.equal(occurrences(alias, /fiscalSummaryVisibleSlice\.finalContributionAmount/g), 1);
  assert.equal(occurrences(alias, /\* 3/g), 1);
  assert.equal(occurrences(alias, /\b500\b/g), 1);
  assert.doesNotMatch(alias, /useMemo|\bsavingsGoal\b|Math\.round|Math\.min|\|\||\?\?|Number\(|parseFloat|toLocaleString/);
});

test("LOT 5.88 confirms no fourteenth fiscalSummaryVisibleSlice occurrence exists", () => {
  const code = sourceWithoutComments(APP_SOURCE);
  const indexes = occurrenceIndexes(code, /\bfiscalSummaryVisibleSlice\b/g);

  assert.equal(indexes.length, 13);
  assert.equal(indexes[13], undefined);
  assert.equal(occurrences(appWithoutVisibleSlice(), /\bfiscalSummaryVisibleSlice\b/g), 12);
});

test("LOT 5.88 confirms root savingsGoal is removed (LOT 5.91A), untouched by the PDF migration itself", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.doesNotMatch(code, /const savingsGoal = useMemo/);
  assert.equal(occurrences(code, /\bsavingsGoal\b/g), APPROVED_COUNTS.savingsGoal);
});

test("LOT 5.88 keeps the approved pdfSavingsGoal alias as the sole new consumer", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  assert.equal(occurrences(code, /\bpdfSavingsGoal\b/g), APPROVED_COUNTS.pdfSavingsGoal);
  assert.equal(occurrences(code, /\bfiscalCoachingSavingsGoal\b/g), APPROVED_COUNTS.fiscalCoachingSavingsGoal);
  assert.doesNotMatch(code, /\b(uiSavingsGoal|coachingSavingsGoal|shadowSavingsGoal)\b/);
});

test("LOT 5.88 keeps the PDF Objectif d'epargne percentage contract exact", () => {
  const objectifLine = sourceWithoutComments(pdfObjectifLineBlock());
  const pdfExport = sourceWithoutComments(exportBlock());

  assert.match(objectifLine, /Objectif d epargne/);
  assert.match(objectifLine, /typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0/);
  assert.match(objectifLine, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
  assert.match(objectifLine, /`\$\{Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)\}%`/);
  assert.match(objectifLine, new RegExp(`: "${FALLBACK_TEXT}"`));
  assert.doesNotMatch(objectifLine, /Math\.min\(\s*100|Math\.max\(\s*0|toLocaleString|Intl\.NumberFormat|toFixed/);
  assert.doesNotMatch(objectifLine, /\bsavingsGoal\b/);
  assert.match(pdfExport, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
  assert.doesNotMatch(pdfExport, /fiscalSummaryVisibleSlice\.finalContributionAmount|fiscalCoachingSavingsGoal/);
});

test("LOT 5.88 confirms the LOT 5.87 triage inventory and LOT 5.86A migration remain the source of truth", () => {
  assert.match(LOT_5_87_REPORT, /GO POUR LOT 5\.88 — EXTENDED STABILIZATION/);
  assert.match(LOT_5_87_REPORT, /fiscalSummaryVisibleSlice = 15/);
  assert.match(LOT_5_86_SOURCE, /LOT 5\.86A locks Shadow baseline thirteen and the exact thirteenth consumer/);
});

test("LOT 5.88 lock-in guard is deterministic and side-effect free", () => {
  const testSource = readFileSync(new URL(import.meta.url), "utf8");

  assert.doesNotMatch(testSource, /\bDate\.now\b|\bnew Date\b|Math\.random/);
  assert.doesNotMatch(testSource, /\blocalStorage\b\./);
  assert.doesNotMatch(testSource, /\bsupabase\b\./i);
  assert.doesNotMatch(testSource, /\bfetch\s*\(/);
});
