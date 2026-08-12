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

const APPROVED_REFERENCE_COUNTS = Object.freeze({
  currentMonthTotal: 24,
  // LOT 5.91A: root savingsGoal removed, dropping 2 estimatedCharges reads (formula body + dependency array) and 1 useMemo hook.
  estimatedCharges: 12,
  availableAmount: 8,
  legacySnapshot: 2,
  fiscalSummaryVisibleSlice: 15,
  FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED: 2,
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

function objectiveSavingsTextBlock() {
  return extractBlock(
    "<span>💰 Objectif d'épargne</span>",
    '                    <div className="progressBar progressBarPremium">',
  );
}

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

function shouldShowUrssafHelperDetail(fiscalSummaryVisibleSlice) {
  return fiscalSummaryVisibleSlice.revenueTotal > 0;
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

function createLegacyState({
  currentMonthTotal = 1200,
  estimatedCharges = 264,
  rate = 0.22,
  acreStatus = "legacy-inactive",
} = {}) {
  return {
    currentMonthTotal,
    estimatedCharges,
    computed: {
      estimatedAmount: estimatedCharges,
      rate,
      acreStatus,
    },
  };
}

function createEvidence({ legacyRevenue = 1200, shadowRevenue = 1200 } = {}) {
  return createRuntimeParityEvidence({
    scenarioId: "lot-5-20-urssaf-gate-control",
    legacySnapshot: {
      revenueTotal: legacyRevenue,
      estimatedAmount: 264,
      rate: 0.22,
      acreStatus: "inactive",
    },
    shadowResult: createShadowResult({
      revenueTotal: shadowRevenue,
      baseAmount: shadowRevenue,
      finalContributionAmount: 264,
      effectiveRate: 0.22,
      acreStatus: "inactive",
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
    observedAt: "LOT_5_20_FIXED_OBSERVATION",
  });
}

test("LOT 5.20 migrates only the URSSAF helper gate away from direct Legacy revenue", () => {
  const block = urssafHelperBlock();

  assert.match(block, /fiscalSummaryVisibleSlice\.revenueTotal > 0/);
  assert.doesNotMatch(block, /currentMonthTotal > 0/);
  assert.equal(occurrences(block, /fiscalSummaryVisibleSlice\.revenueTotal > 0/g), 1);
  assert.equal(occurrences(APP_SOURCE, /currentMonthTotal > 0/g), 0);
  assert.match(APP_SOURCE, /isFiscalProfileComplete && fiscalSummaryVisibleSlice\.revenueTotal > 0/);
});

test("LOT 5.20 keeps URSSAF helper text, formatter and actions unchanged", () => {
  const block = urssafHelperBlock();

  assert.match(block, /Montant à déclarer : \{getDisplayValue\(fiscalSummaryVisibleSlice\.revenueTotal, "money"\)\}/);
  assert.match(block, /Période concernée : \{computed\.nextDeclarationLabel\}/);
  assert.match(block, /Échéance estimée : \{computed\.deadlineLabel\}/);
  assert.match(block, /Microassist t’ouvre le site officiel URSSAF/);
  assert.match(block, /Ajoute un revenu pour calculer le montant à déclarer\./);
  assert.doesNotMatch(block, /localStorage|sessionStorage|supabase|fetch|trackEvent|payload/i);
});

test("LOT 5.20 revenueTotal zero, positive and negative values drive only the approved gate", () => {
  assert.equal(shouldShowUrssafHelperDetail({ revenueTotal: 0 }), false);
  assert.equal(shouldShowUrssafHelperDetail({ revenueTotal: 1 }), true);
  assert.equal(shouldShowUrssafHelperDetail({ revenueTotal: -1 }), false);
});

test("LOT 5.20 flag ON uses Shadow revenue through the existing visible selector", () => {
  const selected = selectFirstSlice({
    flagEnabled: true,
    fiscalSummaryShadow: {
      shadowResult: createShadowResult({ revenueTotal: 0 }),
    },
    ...createLegacyState({ currentMonthTotal: 1200 }),
  });

  assert.equal(selected.revenueTotal, 0);
  assert.equal(shouldShowUrssafHelperDetail(selected), false);
});

test("LOT 5.20 flag OFF restores Legacy through the existing visible selector", () => {
  const selected = selectFirstSlice({
    flagEnabled: false,
    fiscalSummaryShadow: {
      shadowResult: createShadowResult({ revenueTotal: 0 }),
    },
    ...createLegacyState({ currentMonthTotal: 1200 }),
  });

  assert.equal(selected.revenueTotal, 1200);
  assert.equal(shouldShowUrssafHelperDetail(selected), true);
});

test("LOT 5.20 absent Shadow Result follows the existing Legacy fallback", () => {
  const selected = selectFirstSlice({
    flagEnabled: true,
    fiscalSummaryShadow: null,
    ...createLegacyState({ currentMonthTotal: 1200 }),
  });

  assert.equal(selected.revenueTotal, 1200);
  assert.equal(shouldShowUrssafHelperDetail(selected), true);
});

test("LOT 5.20 does not add a flag, state, effect, Adapter execution or Facade execution", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  for (const [identifier, expectedCount] of Object.entries(APPROVED_REFERENCE_COUNTS)) {
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

test("LOT 5.20 does not add fallback or normalization to the migrated gate", () => {
  const block = urssafHelperBlock();

  assert.doesNotMatch(block, /\|\| 0|\?\? 0|Boolean\s*\(|Number\s*\(|parseFloat\s*\(|parseInt\s*\(/);
  assert.doesNotMatch(block, /Math\.(round|floor|ceil|max|min)/);
});

test("LOT 5.20 keeps the visible selector fallback and approved slice unchanged", () => {
  const block = visibleSliceBlock();

  assert.match(block, /Boolean\(shadowResult\)/);
  assert.match(block, /revenueTotal:[\s\S]*shadowResult\.revenue\.total[\s\S]*currentMonthTotal/);
  assert.match(block, /baseAmount:[\s\S]*shadowResult\.summary\.baseAmount[\s\S]*currentMonthTotal/);
  assert.match(block, /finalContributionAmount:[\s\S]*shadowResult\.summary\.finalContributionAmount[\s\S]*estimatedCharges/);
  assert.match(block, /effectiveRate:[\s\S]*shadowResult\.summary\.effectiveRate[\s\S]*computed\?\.rate/);
  assert.match(block, /acreStatus:[\s\S]*shadowResult\.contributions\.acre\.acreStatus[\s\S]*computed\?\.acreStatus/);
  assert.doesNotMatch(block, /localStorage|sessionStorage|supabase|fetch|trackEvent|payload/i);
});

test("LOT 5.20 keeps parity validation and runtime evidence intact", () => {
  const block = shadowBlock();

  assert.match(block, /const legacySnapshot = \{/);
  assert.match(block, /createRuntimeParityEvidence\(/);
  assert.match(block, /SHADOW_PARITY_EVIDENCE_STORE\.record\(shadowParityEvidence\)/);
  assert.match(LOT_5_11_SOURCE, /produces reproducible MATCH evidence/);

  const matchEvidence = createEvidence();
  const mismatchEvidence = createEvidence({ legacyRevenue: 999, shadowRevenue: 1200 });

  assert.equal(matchEvidence.status, SHADOW_PARITY_MATCH);
  assert.equal(mismatchEvidence.status, SHADOW_PARITY_MISMATCH);
  assert.equal(mismatchEvidence.checks[0].name, "revenue.total");
  assert.equal(mismatchEvidence.checks[0].legacyValue, 999);
  assert.equal(mismatchEvidence.checks[0].shadowValue, 1200);
});

test("LOT 5.20 keeps persistence, payloads, exports and assistant boundaries unchanged", () => {
  assert.match(feedbackBlock(), /totalRevenues: currentMonthTotal \|\| 0/);
  assert.match(exportBlock(), /getDisplayValue\(currentMonthTotal, "money"\)/);
  assert.match(assistantDraftBlock(), /localStorage\.getItem\(LS_KEY\)/);
  assert.doesNotMatch(urssafHelperBlock(), /localStorage|sessionStorage|supabase|fetch|trackEvent|payload/i);
});

test("LOT 5.20 keeps second slices away from new Shadow reads", () => {
  assert.doesNotMatch(APP_SOURCE, /shadowResult\.(tva|cfe|deadline|annual|savings|available|invoice|assistant)/i);
  assert.match(APP_SOURCE, /dashboardAvailableDisplay[\s\S]*availableAmount/);
  assert.match(
    APP_SOURCE,
    /const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/,
  );
  assert.match(
    monthlyReflectionBlock(),
    /monthlyReflectionRevenueTotal\.toLocaleString\("fr-FR"\)/,
  );
  assert.doesNotMatch(
    monthlyReflectionBlock(),
    /currentMonthTotal\.toLocaleString\("fr-FR"\)/,
  );
  assert.match(APP_SOURCE, /simpleAssistantGuidance[\s\S]*realMonthlyRevenue: currentMonthTotal/);
});

test("LOT 5.20 guard is deterministic and side-effect free", () => {
  const testSource = readFileSync(new URL(import.meta.url), "utf8");

  assert.doesNotMatch(testSource, /\bDate\.now\b|\bnew Date\b|Math\.random/);
  assert.doesNotMatch(testSource, /\blocalStorage\b\./);
  assert.doesNotMatch(testSource, /\bsupabase\b\./i);
  assert.doesNotMatch(testSource, /\bfetch\s*\(/);
});
