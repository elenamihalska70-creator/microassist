import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildFiscalSummaryInput } from "../src/application/adapters/index.js";
import { calculateFiscalSummary } from "../src/domain/calculations/facade/index.js";
import { computeObligations } from "../src/utils/obligations.js";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
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
  // LOT 5.91A: root savingsGoal removed (0 remaining occurrences).
  savingsGoal: 0,
  pdfSavingsGoal: 5,
});
const REFERENCE_DATE = "2026-07-20";
const FALLBACK_TEXT = "Pas encore assez de données";

const PDF_PERCENTAGE_SCENARIOS = Object.freeze([
  { id: "zero-progress", finalContributionAmount: 0, savingsProgress: 0, expectedOutput: "0%" },
  { id: "low-progress", finalContributionAmount: 0, savingsProgress: 50, expectedOutput: "10%" },
  { id: "half-progress", finalContributionAmount: 0, savingsProgress: 250, expectedOutput: "50%" },
  { id: "ninety-nine-percent", finalContributionAmount: 0, savingsProgress: 495, expectedOutput: "99%" },
  { id: "one-hundred-percent", finalContributionAmount: 0, savingsProgress: 500, expectedOutput: "100%" },
  { id: "one-hundred-one-percent", finalContributionAmount: 0, savingsProgress: 505, expectedOutput: "101%" },
  { id: "one-hundred-twenty-five-percent", finalContributionAmount: 0, savingsProgress: 625, expectedOutput: "125%" },
  { id: "above-two-hundred-percent", finalContributionAmount: 0, savingsProgress: 1005, expectedOutput: "201%" },
  { id: "denominator-above-minimum", finalContributionAmount: 220, savingsProgress: 660, expectedOutput: "100%" },
]);

const ROUNDING_BOUNDARY_SCENARIOS = Object.freeze([
  { id: "rounding-lower-boundary", savingsGoal: 10000, savingsProgress: 4949, expectedOutput: "49%" },
  { id: "rounding-exact-boundary", savingsGoal: 10000, savingsProgress: 4950, expectedOutput: "50%" },
  { id: "rounding-upper-boundary", savingsGoal: 10000, savingsProgress: 4951, expectedOutput: "50%" },
]);

const ACRE_SCENARIOS = Object.freeze([
  {
    id: "acre-inactive",
    values: [1000],
    activityType: "services",
    acre: "no",
    acreStartDate: "",
    expectedRate: 0.22,
    expectedCharges: 220,
    expectedAcreStatus: "inactive",
  },
  {
    id: "acre-active",
    values: [1000],
    activityType: "services",
    acre: "yes",
    acreStartDate: "2026-01-15",
    // LOT 10.1B: pre-reform business so this stays the historical 50% case.
    businessStartDate: "2020-01-01",
    expectedRate: 0.11,
    expectedCharges: 110,
    expectedAcreStatus: "active",
  },
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

function savingsProgressBlock() {
  return extractBlock("const savingsProgress = useMemo(() => {", "  const fiscalCoachingSavingsGoal = Math.max");
}

function coachingSavingsGoalBlock() {
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

function revenuesFrom(values = []) {
  return values.map((amount, index) => ({
    id: `lot-5-84-revenue-${index}`,
    amount,
    category: "service",
    revenueCategory: "service",
    date: `2026-07-${String(index + 1).padStart(2, "0")}`,
  }));
}

function revenueTotal(values = []) {
  return values.reduce((sum, amount) => sum + Number(amount || 0), 0);
}

function legacyChargesFor(scenario) {
  const computed = computeObligations({
    activity_type: scenario.activityType,
    acre: scenario.acre,
    acre_start_date: scenario.acreStartDate,
    business_start_date: scenario.businessStartDate ?? "",
    referenceDate: REFERENCE_DATE,
  });
  const total = revenueTotal(scenario.values);

  return computed?.rate ? Math.round(total * computed.rate) : 0;
}

function shadowResultFor(scenario) {
  const shadowInput = buildFiscalSummaryInput({
    revenues: revenuesFrom(scenario.values),
    fiscalProfile: {
      activity_type: scenario.activityType,
      acre: scenario.acre,
      acre_start_date: scenario.acreStartDate,
      business_start_date: scenario.businessStartDate ?? "",
    },
    period: {},
    referenceDate: REFERENCE_DATE,
  });

  return calculateFiscalSummary(shadowInput, { trace: false });
}

function savingsGoalFromCharges(charges) {
  return Math.max(charges * 3, 500);
}

function pdfPercentageSnapshot({ savingsProgress, savingsGoal }) {
  const formatted =
    typeof savingsGoal !== "undefined" && savingsGoal > 0
      ? `${Math.round((savingsProgress / savingsGoal) * 100 || 0)}%`
      : FALLBACK_TEXT;

  return {
    rawRatio: savingsProgress / savingsGoal,
    roundedValue:
      typeof savingsGoal !== "undefined" && savingsGoal > 0
        ? Math.round((savingsProgress / savingsGoal) * 100 || 0)
        : null,
    formatted,
  };
}

function comparePdfCandidate({ savingsProgress, legacyCharges, shadowFinalContributionAmount }) {
  const legacyDenominator = savingsGoalFromCharges(legacyCharges);
  const shadowDenominator = savingsGoalFromCharges(shadowFinalContributionAmount);
  const legacy = pdfPercentageSnapshot({
    savingsProgress,
    savingsGoal: legacyDenominator,
  });
  const shadow = pdfPercentageSnapshot({
    savingsProgress,
    savingsGoal: shadowDenominator,
  });

  return {
    denominatorMatches: Object.is(legacyDenominator, shadowDenominator),
    ratioMatches: Object.is(legacy.rawRatio, shadow.rawRatio),
    roundedMatches: Object.is(legacy.roundedValue, shadow.roundedValue),
    formattedMatches: Object.is(legacy.formatted, shadow.formatted),
    legacyDenominator,
    shadowDenominator,
    legacy,
    shadow,
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}

test("LOT 5.84 identifies the exact PDF Objectif d epargne consumer", () => {
  const pdfExport = sourceWithoutComments(exportBlock());
  const objectifLine = sourceWithoutComments(pdfObjectifLineBlock());

  assert.match(pdfExport, /const handleExportPDF = useCallback\(async \(\) => \{/);
  assert.match(objectifLine, /Objectif d epargne/);
  assert.match(objectifLine, /typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0/);
  assert.match(objectifLine, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
  assert.match(objectifLine, /`\$\{Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)\}%`/);
  assert.match(objectifLine, /: "Pas encore assez de données"/);
});

test("LOT 5.84 confirms root savingsGoal is removed (LOT 5.91A) and identifies numerator savingsProgress", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const progress = sourceWithoutComments(savingsProgressBlock());

  assert.doesNotMatch(app, /const savingsGoal = useMemo/);
  assert.doesNotMatch(app, /\bsavingsGoal\b/);
  assert.match(progress, /const savingsProgress = useMemo\(\(\) => \{/);
  assert.match(progress, /return availableAmount;/);
  assert.match(progress, /\}, \[availableAmount\]\);/);
});

test("LOT 5.84 keeps the Shadow denominator candidate and migrated PDF denominator", () => {
  const alias = sourceWithoutComments(coachingSavingsGoalBlock());
  const pdfAlias = sourceWithoutComments(pdfSavingsGoalBlock());
  const pdfExport = sourceWithoutComments(exportBlock());

  assert.match(
    alias,
    /const fiscalCoachingSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
  assert.match(alias, /finalContributionAmount \* 3/);
  assert.match(alias, /\b500\b/);
  assert.match(
    pdfAlias,
    /const pdfSavingsGoal = Math\.max\(\s*fiscalSummaryVisibleSlice\.finalContributionAmount \* 3,\s*500,\s*\);/,
  );
  assert.match(pdfExport, /\bpdfSavingsGoal\b/);
  assert.doesNotMatch(pdfExport, /fiscalSummaryVisibleSlice\.finalContributionAmount|fiscalCoachingSavingsGoal|\bsavingsGoal\b/);
});

test("LOT 5.84 identifies fallback rounding formatter and no-cap PDF contracts", () => {
  const objectifLine = sourceWithoutComments(pdfObjectifLineBlock());

  assert.match(objectifLine, /typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0/);
  assert.match(objectifLine, /Math\.round\(\(savingsProgress \/ pdfSavingsGoal\) \* 100 \|\| 0\)/);
  assert.match(objectifLine, /}%`/);
  assert.match(objectifLine, /"Pas encore assez de données"/);
  assert.doesNotMatch(objectifLine, /Math\.min\(\s*100|Math\.max\(\s*0|toLocaleString|Intl\.NumberFormat|toFixed/);
});

test("LOT 5.84 proves PDF percentage parity for zero low half and no-cap scenarios", () => {
  for (const scenario of PDF_PERCENTAGE_SCENARIOS) {
    const comparison = comparePdfCandidate({
      savingsProgress: scenario.savingsProgress,
      legacyCharges: scenario.finalContributionAmount,
      shadowFinalContributionAmount: scenario.finalContributionAmount,
    });

    assert.equal(comparison.denominatorMatches, true, scenario.id);
    assert.equal(comparison.ratioMatches, true, scenario.id);
    assert.equal(comparison.roundedMatches, true, scenario.id);
    assert.equal(comparison.formattedMatches, true, scenario.id);
    assert.equal(comparison.legacy.formatted, scenario.expectedOutput, scenario.id);
    assert.equal(comparison.shadow.formatted, scenario.expectedOutput, scenario.id);
  }
});

test("LOT 5.84 preserves PDF values above 100 percent without cap", () => {
  const oneHundredOne = pdfPercentageSnapshot({ savingsProgress: 505, savingsGoal: 500 });
  const oneHundredTwentyFive = pdfPercentageSnapshot({ savingsProgress: 625, savingsGoal: 500 });
  const aboveTwoHundred = pdfPercentageSnapshot({ savingsProgress: 1005, savingsGoal: 500 });

  assert.equal(oneHundredOne.formatted, "101%");
  assert.equal(oneHundredTwentyFive.formatted, "125%");
  assert.equal(aboveTwoHundred.formatted, "201%");
});

test("LOT 5.84 proves denominator minimum and above-minimum contracts", () => {
  const minimum = comparePdfCandidate({
    savingsProgress: 500,
    legacyCharges: 0,
    shadowFinalContributionAmount: 0,
  });
  const aboveMinimum = comparePdfCandidate({
    savingsProgress: 660,
    legacyCharges: 220,
    shadowFinalContributionAmount: 220,
  });

  assert.equal(minimum.legacyDenominator, 500);
  assert.equal(minimum.shadowDenominator, 500);
  assert.equal(minimum.legacy.formatted, "100%");
  assert.equal(aboveMinimum.legacyDenominator, 660);
  assert.equal(aboveMinimum.shadowDenominator, 660);
  assert.equal(aboveMinimum.legacy.formatted, "100%");
});

test("LOT 5.84 proves rounding boundary parity without tolerance", () => {
  for (const scenario of ROUNDING_BOUNDARY_SCENARIOS) {
    const legacy = pdfPercentageSnapshot({
      savingsProgress: scenario.savingsProgress,
      savingsGoal: scenario.savingsGoal,
    });
    const shadow = pdfPercentageSnapshot({
      savingsProgress: scenario.savingsProgress,
      savingsGoal: scenario.savingsGoal,
    });

    assert.equal(legacy.rawRatio, shadow.rawRatio, scenario.id);
    assert.equal(legacy.roundedValue, shadow.roundedValue, scenario.id);
    assert.equal(legacy.formatted, shadow.formatted, scenario.id);
    assert.equal(legacy.formatted, scenario.expectedOutput, scenario.id);
  }
});

test("LOT 5.84 proves fallback contract without inventing a Shadow fallback", () => {
  assert.equal(pdfPercentageSnapshot({ savingsProgress: 0, savingsGoal: 0 }).formatted, FALLBACK_TEXT);
  assert.equal(pdfPercentageSnapshot({ savingsProgress: 100, savingsGoal: 0 }).formatted, FALLBACK_TEXT);
  assert.equal(pdfPercentageSnapshot({ savingsProgress: 100, savingsGoal: undefined }).formatted, FALLBACK_TEXT);
  assert.equal(pdfPercentageSnapshot({ savingsProgress: 0, savingsGoal: 500 }).formatted, "0%");
});

test("LOT 5.84 proves ACRE inactive and active PDF denominator parity", () => {
  for (const scenario of ACRE_SCENARIOS) {
    const legacyCharges = legacyChargesFor(scenario);
    const shadowResult = shadowResultFor(scenario);
    const savingsProgress = 500;
    const comparison = comparePdfCandidate({
      savingsProgress,
      legacyCharges,
      shadowFinalContributionAmount: shadowResult.summary.finalContributionAmount,
    });

    assert.equal(legacyCharges, scenario.expectedCharges, scenario.id);
    assert.equal(shadowResult.summary.finalContributionAmount, scenario.expectedCharges, scenario.id);
    assert.equal(shadowResult.summary.effectiveRate, scenario.expectedRate, scenario.id);
    assert.equal(shadowResult.contributions.acre.acreStatus, scenario.expectedAcreStatus, scenario.id);
    assert.equal(comparison.denominatorMatches, true, scenario.id);
    assert.equal(comparison.ratioMatches, true, scenario.id);
    assert.equal(comparison.roundedMatches, true, scenario.id);
    assert.equal(comparison.formattedMatches, true, scenario.id);
  }
});

test("LOT 5.84 detects intentional denominator ratio rounded and formatted mismatches", () => {
  const comparison = comparePdfCandidate({
    savingsProgress: 500,
    legacyCharges: 220,
    shadowFinalContributionAmount: 110,
  });

  assert.equal(comparison.legacyDenominator, 660);
  assert.equal(comparison.shadowDenominator, 500);
  assert.equal(comparison.denominatorMatches, false);
  assert.equal(comparison.ratioMatches, false);
  assert.equal(comparison.roundedMatches, false);
  assert.equal(comparison.formattedMatches, false);
  assert.equal(comparison.legacy.formatted, "76%");
  assert.equal(comparison.shadow.formatted, "100%");
});

test("LOT 5.84 is deterministic for same input and cloned input", () => {
  const input = Object.freeze({
    savingsProgress: 625,
    legacyCharges: 0,
    shadowFinalContributionAmount: 0,
  });
  const first = comparePdfCandidate(input);
  const second = comparePdfCandidate(input);
  const cloned = comparePdfCandidate(structuredClone(input));

  assert.deepEqual(first, second);
  assert.deepEqual(first, cloned);
});

test("LOT 5.84 does not mutate evidence inputs", () => {
  const input = deepFreeze({
    savingsProgress: 495,
    legacyCharges: 0,
    shadowFinalContributionAmount: 0,
  });
  const before = structuredClone(input);

  comparePdfCandidate(input);

  assert.deepEqual(input, before);
});

test("LOT 5.84 evidence helpers have no implicit time random network or persistence", () => {
  const helperSources = [
    savingsGoalFromCharges,
    pdfPercentageSnapshot,
    comparePdfCandidate,
    revenueTotal,
    legacyChargesFor,
  ]
    .map((fn) => fn.toString())
    .join("\n");

  assert.doesNotMatch(helperSources, /Date\.now|new Date|getTodayIsoDate|Math\.random|fetch|localStorage|sessionStorage|supabase/i);
});

test("LOT 5.84 keeps PDF output structure generation and analytics unchanged", () => {
  const pdfExport = sourceWithoutComments(exportBlock());

  assert.match(pdfExport, /drawTitle\("3\. Analyse"\)/);
  assert.match(pdfExport, /drawBox\(\s*"Projection"/);
  assert.match(pdfExport, /Projection annuelle/);
  assert.match(pdfExport, /Taux estime/);
  assert.match(pdfExport, /Objectif d epargne/);
  assert.match(pdfExport, /doc\.save\(\s*`rapport_microassist_/);
  assert.match(APP_SOURCE, /trackEvent\("export_pdf", \{\s*source: "revenues",\s*totalRevenues: revenues\.length,\s*invoiceCount: visibleInvoices\.length,\s*\}\);/);
});

test("LOT 5.84 keeps persistence payload assistant and feedback isolated", () => {
  const assistant = sourceWithoutComments(assistantBlock());
  const persistence = sourceWithoutComments(persistenceBlock());
  const feedback = sourceWithoutComments(feedbackBlock());
  const pdfExport = sourceWithoutComments(exportBlock());

  assert.doesNotMatch(assistant, /\bsavingsGoal\b|fiscalSummaryVisibleSlice\.finalContributionAmount/);
  assert.doesNotMatch(persistence, /\bsavingsGoal\b|fiscalSummaryVisibleSlice/);
  assert.doesNotMatch(feedback, /\bsavingsGoal\b|fiscalSummaryVisibleSlice\.finalContributionAmount/);
  assert.doesNotMatch(pdfExport, /localStorage|sessionStorage|supabase|fetch|feedbackContextSnapshot|simpleAssistantGuidance/);
});

test("LOT 5.84 keeps baseline Shadow fifteen and no sixteenth occurrence", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const pdfAlias = sourceWithoutComments(pdfSavingsGoalBlock());

  assert.equal(occurrences(app, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(occurrences(appWithoutVisibleSlice(), /\bfiscalSummaryVisibleSlice\b/g), 14);
  assert.equal(occurrences(pdfAlias, /\bfiscalSummaryVisibleSlice\b/g), 1);
  assert.equal(occurrences(app, /\bsavingsGoal\b/g), APPROVED_COUNTS.savingsGoal);
  assert.equal(occurrences(app, /\bpdfSavingsGoal\b/g), APPROVED_COUNTS.pdfSavingsGoal);
  assert.doesNotMatch(sourceWithoutComments(exportBlock()), /fiscalSummaryVisibleSlice|\bsavingsGoal\b/);
});

test("LOT 5.84 keeps feature flag characterization and runtime evidence intact", () => {
  const visibleSlice = sourceWithoutComments(visibleSliceBlock());

  assert.match(visibleSlice, /const usesShadow =\s*FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED &&\s*Boolean\(shadowResult\);/);
  assert.match(visibleSlice, /finalContributionAmount: usesShadow\s*\?\s*shadowResult\.summary\.finalContributionAmount\s*:\s*estimatedCharges/);
  assert.match(SHADOW_PARITY_SOURCE, /SHADOW_PARITY_MATCH/);
  assert.match(SHADOW_PARITY_SOURCE, /SHADOW_PARITY_MISMATCH/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /runtime parity evidence has no UI, state, persistence, network or implicit time access/);
});
