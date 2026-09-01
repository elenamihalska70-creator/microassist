import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createRuntimeParityEvidence,
  SHADOW_PARITY_MATCH,
  SHADOW_PARITY_MISMATCH,
} from "../src/application/shadow/runtimeParityEvidence.js";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const LOT_5_17_REPORT = readFileSync(
  new URL("../docs/LOT_5_17_LEGACY_REMOVAL_GATE_REVIEW.md", import.meta.url),
  "utf8",
);

const FIRST_SLICE_FIELDS = Object.freeze([
  "revenueTotal",
  "baseAmount",
  "finalContributionAmount",
  "effectiveRate",
  "acreStatus",
]);

const APPROVED_LEGACY_REFERENCES = Object.freeze({
  currentMonthTotal: 24,
  // LOT 5.91A: root savingsGoal removed, dropping 2 estimatedCharges reads (formula body + dependency array) and 1 useMemo hook.
  estimatedCharges: 12,
  availableAmount: 8,
  legacySnapshot: 2,
  fiscalSummaryVisibleSlice: 13,
  FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED: 2,
  createRuntimeParityEvidence: 2,
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
    "const fiscalSummaryVisibleSlice = useMemo",
    "  // ==================== PREVIEW",
  );
}

function shadowBlock() {
  return extractBlock("const fiscalSummaryShadow = useMemo", "  const activityLabel = useMemo");
}

function dashboardDisplayBlock() {
  return extractBlock("const dashboardRevenueDisplay =", "  const reliabilityBadge = useMemo");
}

function objectiveSavingsTextBlock() {
  return extractBlock(
    "<span>💰 Objectif d'épargne</span>",
    '                    <div className="progressBar progressBarPremium">',
  );
}

function exportBlock() {
  return extractBlock("const handleExportPDF = useCallback", "async function handleExportPDFWithLimit");
}

function feedbackBlock() {
  return extractBlock("const feedbackContextSnapshot = useMemo", "  const dashboardMonthlyReflection");
}

function monthlyReflectionBlock() {
  return extractBlock("const dashboardMonthlyReflection = useMemo", "  const goToAssistant");
}

function selectFirstSlice({
  flagEnabled,
  fiscalSummaryShadow,
  currentMonthTotal,
  estimatedCharges,
  computed,
}) {
  const shadowResult = fiscalSummaryShadow?.shadowResult;
  const usesShadow = flagEnabled && Boolean(shadowResult);

  return {
    revenueTotal: usesShadow ? shadowResult.revenue.total : currentMonthTotal,
    baseAmount: usesShadow ? shadowResult.summary.baseAmount : currentMonthTotal,
    finalContributionAmount: usesShadow
      ? shadowResult.summary.finalContributionAmount
      : estimatedCharges,
    effectiveRate: usesShadow ? shadowResult.summary.effectiveRate : computed?.rate,
    acreStatus: usesShadow
      ? shadowResult.contributions.acre.acreStatus
      : computed?.acreStatus,
  };
}

function createShadowResult({
  revenueTotal = 0,
  baseAmount = 0,
  finalContributionAmount = 0,
  effectiveRate = 0,
  acreStatus = "inactive",
} = {}) {
  return {
    revenue: { total: revenueTotal },
    summary: {
      baseAmount,
      finalContributionAmount,
      effectiveRate,
    },
    contributions: {
      acre: { acreStatus },
    },
  };
}

function createLegacyState() {
  return {
    currentMonthTotal: 1200,
    estimatedCharges: 264,
    computed: {
      estimatedAmount: 264,
      rate: 0.22,
      acreStatus: "legacy-inactive",
    },
  };
}

function createEvidence({ legacyAmount = 264, shadowAmount = 264 } = {}) {
  return createRuntimeParityEvidence({
    scenarioId: "lot-5-18-retention-control",
    legacySnapshot: {
      revenueTotal: 1200,
      estimatedAmount: legacyAmount,
      rate: 0.22,
      acreStatus: "inactive",
    },
    shadowResult: createShadowResult({
      revenueTotal: 1200,
      baseAmount: 1200,
      finalContributionAmount: shadowAmount,
      effectiveRate: 0.22,
      acreStatus: "inactive",
    }),
    shadowInput: {
      revenues: [{ id: "r1", amount: 1200, date: "2026-07-10" }],
      fiscalProfile: {
        activityType: "services",
        acre: "no",
        acreStartDate: null,
      },
      period: {},
      referenceDate: "2026-07-30",
    },
    observedAt: "LOT_5_18_FIXED_OBSERVATION",
  });
}

test("LOT 5.18 documents the authorized Legacy responsibilities from LOT 5.17", () => {
  for (const responsibility of [
    "rollback",
    "parity",
    "runtime evidence",
    "exports",
    "feedback context",
    "assistant",
    "dashboard",
  ]) {
    assert.match(LOT_5_17_REPORT, new RegExp(responsibility, "i"));
  }

  for (const legacyElement of [
    "currentMonthTotal",
    "computed",
    "estimatedCharges",
    "availableAmount",
    "legacySnapshot",
  ]) {
    assert.match(LOT_5_17_REPORT, new RegExp(legacyElement));
  }
});

test("LOT 5.18 keeps Shadow as the visible source for the approved first slice", () => {
  const selected = selectFirstSlice({
    flagEnabled: true,
    fiscalSummaryShadow: {
      shadowResult: createShadowResult({
        revenueTotal: 0,
        baseAmount: 0,
        finalContributionAmount: 0,
        effectiveRate: 0,
        acreStatus: "active",
      }),
    },
    ...createLegacyState(),
  });

  assert.deepEqual(Object.keys(selected), FIRST_SLICE_FIELDS);
  assert.deepEqual(selected, {
    revenueTotal: 0,
    baseAmount: 0,
    finalContributionAmount: 0,
    effectiveRate: 0,
    acreStatus: "active",
  });
});

test("LOT 5.18 keeps immediate flag OFF rollback to Legacy available", () => {
  const selected = selectFirstSlice({
    flagEnabled: false,
    fiscalSummaryShadow: {
      shadowResult: createShadowResult({
        revenueTotal: 9999,
        baseAmount: 9999,
        finalContributionAmount: 999,
        effectiveRate: 0.99,
        acreStatus: "active",
      }),
    },
    ...createLegacyState(),
  });

  assert.deepEqual(selected, {
    revenueTotal: 1200,
    baseAmount: 1200,
    finalContributionAmount: 264,
    effectiveRate: 0.22,
    acreStatus: "legacy-inactive",
  });
});

test("LOT 5.18 keeps the fallback limited to global Shadow Result availability", () => {
  const block = visibleSliceBlock();

  assert.match(block, /Boolean\(shadowResult\)/);
  assert.equal(occurrences(block, /\busesShadow\b/g), 6);
  assert.doesNotMatch(block, /\|\|\s*(currentMonthTotal|estimatedCharges|computed)/);
  assert.doesNotMatch(block, /\?\?\s*(currentMonthTotal|estimatedCharges|computed)/);
  assert.doesNotMatch(block, /localStorage|sessionStorage|supabase|fetch|set[A-Z]\w*\s*\(/i);
});

test("LOT 5.18 keeps Legacy available for parity and runtime evidence", () => {
  const block = shadowBlock();

  assert.match(block, /const legacySnapshot = \{/);
  assert.match(block, /revenueTotal: currentMonthTotal/);
  assert.match(block, /estimatedAmount: computed\?\.estimatedAmount/);
  assert.match(block, /rate: computed\?\.rate/);
  assert.match(block, /acreStatus: computed\?\.acreStatus/);
  assert.match(block, /createRuntimeParityEvidence\(/);
  assert.match(block, /SHADOW_PARITY_EVIDENCE_STORE\.record\(shadowParityEvidence\)/);
});

test("LOT 5.18 keeps MATCH and MISMATCH evidence deterministic and uncorrected", () => {
  const matchRunOne = createEvidence();
  const matchRunTwo = createEvidence();
  const mismatchRunOne = createEvidence({ legacyAmount: 999 });
  const mismatchRunTwo = createEvidence({ legacyAmount: 999 });

  assert.deepEqual(matchRunOne, matchRunTwo);
  assert.deepEqual(mismatchRunOne, mismatchRunTwo);
  assert.equal(matchRunOne.status, SHADOW_PARITY_MATCH);
  assert.equal(mismatchRunOne.status, SHADOW_PARITY_MISMATCH);
  assert.equal(mismatchRunOne.checks[2].name, "summary.finalContributionAmount");
  assert.equal(mismatchRunOne.checks[2].legacyValue, 999);
  assert.equal(mismatchRunOne.checks[2].shadowValue, 264);
});

test("LOT 5.18 blocks unapproved new Legacy consumers with a deterministic reference count guard", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  for (const [identifier, expectedCount] of Object.entries(APPROVED_LEGACY_REFERENCES)) {
    assert.equal(
      occurrences(code, new RegExp(`\\b${identifier}\\b`, "g")),
      expectedCount,
      identifier,
    );
  }

  const uiText = sourceWithoutComments(objectiveSavingsTextBlock());
  assert.equal(occurrences(code, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/g), 4);
  assert.match(uiText, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.doesNotMatch(uiText, /\bsavingsGoal\b/);
  assert.match(
  code,
  /<div className="progressBar progressBarPremium">[\s\S]*?fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/,
);
});

test("LOT 5.18 keeps approved Legacy formulas and rounding unchanged", () => {
  assert.match(
    APP_SOURCE,
    /const currentMonthTotal = useMemo\(\(\) => \{\s*return revenues\.reduce\(\(sum, item\) => \{\s*return sum \+ Number\(item\.amount \|\| 0\);\s*\}, 0\);\s*\}, \[revenues\]\);/,
  );
  assert.match(
    APP_SOURCE,
    /const estimatedCharges = useMemo\(\(\) => \{\s*if \(computed\?\.rate\) \{\s*return Math\.round\(currentMonthTotal \* computed\.rate\);\s*\}\s*return 0;\s*\}, \[currentMonthTotal, computed\?\.rate\]\);/,
  );
  assert.match(
    APP_SOURCE,
    /const availableAmount = useMemo\(\(\) => \{\s*return Math\.max\(0, currentMonthTotal - estimatedCharges\);\s*\}, \[currentMonthTotal, estimatedCharges\]\);/,
  );
});

test("LOT 5.18 keeps second slices away from Shadow Result reads", () => {
  const visibleBlock = visibleSliceBlock();

  assert.match(visibleBlock, /shadowResult\.revenue\.total/);
  assert.match(visibleBlock, /shadowResult\.summary\.baseAmount/);
  assert.match(visibleBlock, /shadowResult\.summary\.finalContributionAmount/);
  assert.match(visibleBlock, /shadowResult\.summary\.effectiveRate/);
  assert.match(visibleBlock, /shadowResult\.contributions\.acre\.acreStatus/);
  assert.doesNotMatch(visibleBlock, /tva|cfe|deadline|annual|savings|available|invoice|assistant/i);
  assert.doesNotMatch(APP_SOURCE, /shadowResult\.(tva|cfe|deadline|annual|savings|available|invoice|assistant)/i);
});

test("LOT 5.18 keeps persistence and payload paths unchanged by the visible selector", () => {
  const block = visibleSliceBlock();

  assert.doesNotMatch(block, /localStorage|sessionStorage|supabase|fetch|trackEvent|payload/i);
  assert.match(feedbackBlock(), /totalRevenues: currentMonthTotal \|\| 0/);
});

test("LOT 5.18 keeps export and assistant-adjacent consumers retained as Legacy", () => {
  assert.match(exportBlock(), /getDisplayValue\(currentMonthTotal, "money"\)/);
  assert.match(exportBlock(), /dashboardChargesDisplay/);
  assert.match(exportBlock(), /dashboardAvailableDisplay/);
  assert.match(exportBlock(), /computed\?\.rate \? Math\.round\(computed\.rate \* 100\) : 0/);
  assert.match(
    monthlyReflectionBlock(),
    /monthlyReflectionRevenueTotal\.toLocaleString\("fr-FR"\)/,
  );
  assert.doesNotMatch(
    monthlyReflectionBlock(),
    /currentMonthTotal\.toLocaleString\("fr-FR"\)/,
  );
  assert.equal(
    occurrences(
      APP_SOURCE,
      /const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/g,
    ),
    1,
  );
  assert.match(
    monthlyReflectionBlock(),
    /monthlyReflectionChargesAmount\.toLocaleString\("fr-FR"\)/,
  );
  assert.doesNotMatch(
    monthlyReflectionBlock(),
    /estimatedCharges\.toLocaleString\("fr-FR"\)/,
  );
  assert.equal(
    occurrences(
      APP_SOURCE,
      /const monthlyReflectionChargesAmount =\s*fiscalSummaryVisibleSlice\.finalContributionAmount;/g,
    ),
    1,
  );
});

test("LOT 5.18 keeps dashboard compatibility outside the first slice", () => {
  const displayBlock = dashboardDisplayBlock();

  assert.match(displayBlock, /fiscalSummaryVisibleSlice\.revenueTotal/);
  assert.match(displayBlock, /fiscalSummaryVisibleSlice\.finalContributionAmount/);
  assert.match(displayBlock, /availableAmount/);
  assert.match(APP_SOURCE, /fiscalSummaryVisibleSlice\.revenueTotal > 0/);
  assert.match(APP_SOURCE, /isFiscalProfileComplete && fiscalSummaryVisibleSlice\.revenueTotal > 0/);
  assert.doesNotMatch(APP_SOURCE, /isFiscalProfileComplete && currentMonthTotal > 0/);
});

test("LOT 5.18 guards remain pure local source checks", () => {
  const testSource = readFileSync(new URL(import.meta.url), "utf8");

  assert.doesNotMatch(testSource, /\bDate\.now\b|\bnew Date\b|Math\.random/);
  assert.doesNotMatch(testSource, /\blocalStorage\b\./);
  assert.doesNotMatch(testSource, /\bsupabase\b\./i);
  assert.doesNotMatch(testSource, /\bfetch\s*\(/);
});
