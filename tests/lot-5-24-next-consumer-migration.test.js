import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createRuntimeParityEvidence,
  SHADOW_PARITY_MATCH,
  SHADOW_PARITY_MISMATCH,
} from "../src/application/shadow/runtimeParityEvidence.js";

// LOT 5.92: normalize CRLF to LF so line-ending style never affects marker search.
const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const LOT_5_11_SOURCE = readFileSync(
  new URL("./lot-5-11-additional-parity-evidence.test.js", import.meta.url),
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
  currentMonthTotal: 24,
  // LOT 5.91A: root savingsGoal removed, dropping 2 estimatedCharges reads
  // (formula body + dependency array) and 1 useMemo hook.
  estimatedCharges: 12,
  availableAmount: 8,
  legacySnapshot: 2,
  fiscalSummaryVisibleSlice: 15,
  FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED: 2,
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

function fiscalSummaryVisibleSliceBlock() {
  return extractBlock(
    "const fiscalSummaryVisibleSlice = useMemo",
    "  // ==================== PREVIEW POUR MODALE AJOUT REVENU",
  );
}

function fiscalSummaryShadowBlock() {
  return extractBlock("const fiscalSummaryShadow = useMemo", "  const activityLabel = useMemo");
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

function urssafHelperBlock() {
  return extractBlock(
    '<div className="dashboardDeclareHelper">',
    "                        </>\n                      ) : (\n                        <>\n                          <button",
  );
}

test("LOT 5.92 urssafHelperBlock extraction is identical for CRLF and LF source line endings", () => {
  function normalizeToLf(source) {
    return source.replace(/\r\n/g, "\n");
  }

  function extractFrom(source, startText, endText) {
    const start = source.indexOf(startText);
    assert.notEqual(start, -1, startText);
    const end = source.indexOf(endText, start);
    assert.notEqual(end, -1, endText);
    return source.slice(start, end);
  }

  const URSSAF_START = '<div className="dashboardDeclareHelper">';
  const URSSAF_END =
    "                        </>\n                      ) : (\n                        <>\n                          <button";

  const rawCrlfSource = readFileSync(
    new URL("../src/App.jsx", import.meta.url),
    "utf8",
  ).replace(/\r?\n/g, "\r\n");
  const rawLfSource = rawCrlfSource.replace(/\r\n/g, "\n");

  const blockFromCrlf = extractFrom(normalizeToLf(rawCrlfSource), URSSAF_START, URSSAF_END);
  const blockFromLf = extractFrom(normalizeToLf(rawLfSource), URSSAF_START, URSSAF_END);

  assert.equal(blockFromCrlf, blockFromLf);
  assert.equal(blockFromCrlf, urssafHelperBlock());
});

function feedbackBlock() {
  return extractBlock("const feedbackContextSnapshot = useMemo", "  const dashboardMonthlyReflection");
}

function monthlyReflectionBlock() {
  return extractBlock("const dashboardMonthlyReflection = useMemo", "  const goToAssistant");
}

function exportBlock() {
  return extractBlock("const handleExportPDF = useCallback", "async function handleExportPDFWithLimit");
}

function assistantDraftBlock() {
  return extractBlock("function readLocalDraftPayload", "function pickProfileField");
}

function createShadowResult({
  revenueTotal = 1200,
  baseAmount = revenueTotal,
  finalContributionAmount = 264,
  effectiveRate = 0.22,
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

function createLegacyState({
  currentMonthTotal = 1200,
  estimatedCharges = 264,
  rate = 0.22,
  acreStatus = "inactive",
} = {}) {
  return {
    currentMonthTotal,
    estimatedCharges,
    computed: {
      rate,
      acreStatus,
    },
  };
}

function selectVisibleSlice({
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

function shouldShowProgressIndicators(isFiscalProfileComplete, fiscalSummaryVisibleSlice) {
  return isFiscalProfileComplete && fiscalSummaryVisibleSlice.revenueTotal > 0;
}

function createEvidence({
  legacyRevenue = 1200,
  shadowRevenue = 1200,
  legacyAmount = 264,
  shadowAmount = 264,
} = {}) {
  return createRuntimeParityEvidence({
    scenarioId: "lot-5-24-progress-gate",
    legacySnapshot: {
      revenueTotal: legacyRevenue,
      estimatedAmount: legacyAmount,
      rate: 0.22,
      acreStatus: "inactive",
    },
    shadowResult: createShadowResult({
      revenueTotal: shadowRevenue,
      finalContributionAmount: shadowAmount,
    }),
    shadowInput: {
      revenues: [{ id: "r1", amount: shadowRevenue, date: "2026-07-10" }],
      fiscalProfile: {
        activityType: "services",
        acre: "no",
        acreStartDate: null,
      },
      period: {},
      referenceDate: "2026-07-30",
    },
    observedAt: "LOT_5_24_FIXED_OBSERVATION",
  });
}

test("LOT 5.24 migrates exactly the progress indicators gate revenue source", () => {
  const block = progressIndicatorsBlock();

  assert.match(block, /isFiscalProfileComplete && fiscalSummaryVisibleSlice\.revenueTotal > 0 && \(/);
  assert.doesNotMatch(block, /currentMonthTotal > 0/);
  assert.equal(occurrences(block, /fiscalSummaryVisibleSlice\.revenueTotal > 0/g), 1);
  assert.equal(occurrences(APP_SOURCE, /currentMonthTotal > 0/g), 0);
  assert.equal(occurrences(APP_SOURCE, /fiscalSummaryVisibleSlice\.revenueTotal > 0/g), 2);
});

test("LOT 5.24 preserves isFiscalProfileComplete in the progress condition", () => {
  const block = progressIndicatorsBlock();

  assert.match(block, /isFiscalProfileComplete && fiscalSummaryVisibleSlice\.revenueTotal > 0/);
  assert.doesNotMatch(block, /fiscalSummaryVisibleSlice\.revenueTotal > 0 && isFiscalProfileComplete/);
  assert.doesNotMatch(block, /Boolean\s*\(isFiscalProfileComplete\)|!!isFiscalProfileComplete/);
});

test("LOT 5.24 validates the progress visibility value matrix", () => {
  assert.equal(shouldShowProgressIndicators(false, { revenueTotal: 1200 }), false);
  assert.equal(shouldShowProgressIndicators(true, { revenueTotal: 0 }), false);
  assert.equal(shouldShowProgressIndicators(true, { revenueTotal: 1200 }), true);
  assert.equal(shouldShowProgressIndicators(false, { revenueTotal: 0 }), false);
  assert.equal(shouldShowProgressIndicators(true, { revenueTotal: 0.01 }), true);
  assert.equal(shouldShowProgressIndicators(true, { revenueTotal: -1 }), false);
});

test("LOT 5.24 flag ON uses Shadow through fiscalSummaryVisibleSlice", () => {
  const selected = selectVisibleSlice({
    flagEnabled: true,
    fiscalSummaryShadow: {
      shadowResult: createShadowResult({ revenueTotal: 0 }),
    },
    ...createLegacyState({ currentMonthTotal: 1200 }),
  });

  assert.equal(selected.revenueTotal, 0);
  assert.equal(shouldShowProgressIndicators(true, selected), false);
});

test("LOT 5.24 flag OFF restores Legacy through fiscalSummaryVisibleSlice", () => {
  const selected = selectVisibleSlice({
    flagEnabled: false,
    fiscalSummaryShadow: {
      shadowResult: createShadowResult({ revenueTotal: 0 }),
    },
    ...createLegacyState({ currentMonthTotal: 1200 }),
  });

  assert.equal(selected.revenueTotal, 1200);
  assert.equal(shouldShowProgressIndicators(true, selected), true);
});

test("LOT 5.24 absent Shadow Result keeps the existing global Legacy fallback", () => {
  const selected = selectVisibleSlice({
    flagEnabled: true,
    fiscalSummaryShadow: null,
    ...createLegacyState({ currentMonthTotal: 1200 }),
  });

  assert.equal(selected.revenueTotal, 1200);
  assert.equal(shouldShowProgressIndicators(true, selected), true);
});

test("LOT 5.24 adds no flag, state, effect, memo, Adapter or Facade execution", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  for (const [identifier, expectedCount] of Object.entries(APPROVED_APP_COUNTS)) {
    assert.equal(
      occurrences(code, new RegExp(`\\b${identifier}\\b`, "g")),
      expectedCount,
      identifier,
    );
  }

  assert.equal(occurrences(APP_SOURCE, /const FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED = true;/g), 1);
  assert.equal(occurrences(APP_SOURCE, /const fiscalSummaryShadow = useMemo/g), 1);
  assert.equal(occurrences(APP_SOURCE, /const fiscalSummaryVisibleSlice = useMemo/g), 1);
  const uiText = sourceWithoutComments(objectiveSavingsTextBlock());
  assert.equal(occurrences(code, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/g), 4);
  assert.match(uiText, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.doesNotMatch(uiText, /\bsavingsGoal\b/);
});

test("LOT 5.24 keeps the gate free of fallback, normalization and business calculation", () => {
  const block = progressIndicatorsBlock();
  const condition = block.slice(0, block.indexOf('<div'));

  assert.doesNotMatch(condition, /\|\| 0|\?\? 0|Boolean\s*\(|Number\s*\(|parseFloat\s*\(|parseInt\s*\(/);
  assert.doesNotMatch(condition, /Math\.(round|floor|ceil|max|min)/);
  assert.doesNotMatch(condition, /currentMonthTotal|estimatedCharges|availableAmount|computed|shadowResult/);
});

test("LOT 5.24 keeps progress indicator content and savings formulas unchanged", () => {
  const block = progressIndicatorsBlock();

  assert.match(block, /className="progressIndicators"/);
  assert.match(block, /className="progressItem"/);
  assert.match(block, /className="progressItemHeader"/);
  assert.match(block, /Objectif d'épargne/);
  assert.equal(occurrences(block, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/g), 2);
  assert.doesNotMatch(block, /Math\.round\(\(savingsProgress \/ savingsGoal\) \* 100\)/);
  assert.match(block, /className="progressBar progressBarPremium"/);
  assert.match(block, /className="progressFill"/);
  assert.doesNotMatch(block, /getDisplayValue|trackBetaEvent|onClick|localStorage|supabase|fetch/i);
});

test("LOT 5.24 keeps the visible selector fallback and first slice unchanged", () => {
  const block = fiscalSummaryVisibleSliceBlock();

  assert.match(block, /Boolean\(shadowResult\)/);
  assert.match(block, /revenueTotal:[\s\S]*shadowResult\.revenue\.total[\s\S]*currentMonthTotal/);
  assert.match(block, /baseAmount:[\s\S]*shadowResult\.summary\.baseAmount[\s\S]*currentMonthTotal/);
  assert.match(block, /finalContributionAmount:[\s\S]*shadowResult\.summary\.finalContributionAmount[\s\S]*estimatedCharges/);
  assert.match(block, /effectiveRate:[\s\S]*shadowResult\.summary\.effectiveRate[\s\S]*computed\?\.rate/);
  assert.match(block, /acreStatus:[\s\S]*shadowResult\.contributions\.acre\.acreStatus[\s\S]*computed\?\.acreStatus/);
  assert.doesNotMatch(block, /localStorage|sessionStorage|supabase|fetch|trackEvent|payload/i);
});

test("LOT 5.24 keeps the URSSAF helper as the only earlier revenue gate migration", () => {
  const block = urssafHelperBlock();

  assert.match(block, /fiscalSummaryVisibleSlice\.revenueTotal > 0/);
  assert.match(block, /getDisplayValue\(fiscalSummaryVisibleSlice\.revenueTotal, "money"\)/);
  assert.doesNotMatch(block, /currentMonthTotal > 0/);
});

test("LOT 5.24 keeps other currentMonthTotal consumers retained and unchanged", () => {
  assert.match(APP_SOURCE, /const currentMonthTotal = useMemo/);
  assert.match(APP_SOURCE, /ca_month: currentMonthTotal/);
  assert.match(fiscalSummaryShadowBlock(), /revenueTotal: currentMonthTotal/);
  assert.match(fiscalSummaryVisibleSliceBlock(), /: currentMonthTotal/);
  assert.match(APP_SOURCE, /Math\.round\(currentMonthTotal \* computed\.rate\)/);
  assert.match(APP_SOURCE, /Math\.max\(0, currentMonthTotal - estimatedCharges\)/);
  assert.match(APP_SOURCE, /realMonthlyRevenue: currentMonthTotal/);
  assert.match(feedbackBlock(), /totalRevenues: currentMonthTotal \|\| 0/);
  assert.match(
    monthlyReflectionBlock(),
    /monthlyReflectionRevenueTotal\.toLocaleString\("fr-FR"\)/,
  );
  assert.doesNotMatch(
    monthlyReflectionBlock(),
    /currentMonthTotal\.toLocaleString\("fr-FR"\)/,
  );
  assert.match(
    APP_SOURCE,
    /const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/,
  );
  assert.match(exportBlock(), /getDisplayValue\(currentMonthTotal, "money"\)/);
});

test("LOT 5.24 keeps Shadow reads limited to approved selector and evidence paths", () => {
  assert.doesNotMatch(APP_SOURCE, /shadowResult\.(tva|cfe|deadline|annual|savings|available|invoice|assistant)/i);
  assert.match(APP_SOURCE, /dashboardAvailableDisplay[\s\S]*availableAmount/);
  assert.match(APP_SOURCE, /simpleAssistantGuidance[\s\S]*realMonthlyRevenue: currentMonthTotal/);
  assert.match(
    monthlyReflectionBlock(),
    /monthlyReflectionRevenueTotal\.toLocaleString\("fr-FR"\)/,
  );
  assert.doesNotMatch(
    monthlyReflectionBlock(),
    /currentMonthTotal\.toLocaleString\("fr-FR"\)/,
  );
});

test("LOT 5.24 keeps parity validation and runtime evidence intact", () => {
  const block = fiscalSummaryShadowBlock();

  assert.match(block, /const legacySnapshot = \{/);
  assert.match(block, /createRuntimeParityEvidence\(/);
  assert.match(block, /SHADOW_PARITY_EVIDENCE_STORE\.record\(shadowParityEvidence\)/);
  assert.match(LOT_5_11_SOURCE, /produces reproducible MATCH evidence/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
  assert.match(SHADOW_PARITY_SOURCE, /SHADOW_PARITY_MISMATCH/);

  const matchEvidence = createEvidence();
  const mismatchEvidence = createEvidence({ legacyRevenue: 999, shadowRevenue: 1200 });

  assert.equal(matchEvidence.status, SHADOW_PARITY_MATCH);
  assert.equal(mismatchEvidence.status, SHADOW_PARITY_MISMATCH);
  assert.equal(mismatchEvidence.checks[0].name, "revenue.total");
});

test("LOT 5.24 keeps persistence, payload, export and assistant boundaries unchanged", () => {
  assert.doesNotMatch(progressIndicatorsBlock(), /localStorage|sessionStorage|supabase|fetch|payload|assistant/i);
  assert.match(APP_SOURCE, /localStorage\.getItem\(LS_KEY\)/);
  assert.match(APP_SOURCE, /supabase\.from\("revenues"\)/);
  assert.match(feedbackBlock(), /totalRevenues: currentMonthTotal \|\| 0/);
  assert.match(exportBlock(), /getDisplayValue\(currentMonthTotal, "money"\)/);
  assert.match(exportBlock(), /dashboardChargesDisplay/);
  assert.match(exportBlock(), /dashboardAvailableDisplay/);
  assert.match(assistantDraftBlock(), /localStorage\.getItem\(LS_KEY\)/);
});

test("LOT 5.24 rollback is local to the progress gate expression", () => {
  const block = progressIndicatorsBlock();
  const rollbackBlock = block.replace(
    "fiscalSummaryVisibleSlice.revenueTotal > 0",
    "currentMonthTotal > 0",
  );

  assert.match(rollbackBlock, /isFiscalProfileComplete && currentMonthTotal > 0/);
  assert.doesNotMatch(rollbackBlock, /isFiscalProfileComplete && fiscalSummaryVisibleSlice\.revenueTotal > 0/);
  assert.equal(occurrences(block, /fiscalSummaryVisibleSlice\.revenueTotal > 0/g), 1);
});
