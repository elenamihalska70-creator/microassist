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
const LOT_5_18_SOURCE = readFileSync(
  new URL("./lot-5-18-legacy-retention-hardening.test.js", import.meta.url),
  "utf8",
);
const LOT_5_20_SOURCE = readFileSync(
  new URL("./lot-5-20-next-consumer-migration.test.js", import.meta.url),
  "utf8",
);
const LOT_5_21_SOURCE = readFileSync(
  new URL("./lot-5-21-next-consumer-migration-validation.test.js", import.meta.url),
  "utf8",
);
const LOT_5_22_SOURCE = readFileSync(
  new URL("./lot-5-22-next-consumer-stabilization.test.js", import.meta.url),
  "utf8",
);
const LOT_5_24_SOURCE = readFileSync(
  new URL("./lot-5-24-next-consumer-migration.test.js", import.meta.url),
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
  useMemo: 95, // LOT 10.2D: +4 useMemo (declaration dossier view selectors); LOT 10.2E.1: +2 (dashboardPrioritizedActions, priorityCardViewModel)
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

function fiscalProfileCompletenessBlock() {
  return extractBlock("const hasProfileCore =", "  useEffect(() => {");
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

function progressVisible(isFiscalProfileComplete, fiscalSummaryVisibleSlice) {
  return isFiscalProfileComplete && fiscalSummaryVisibleSlice.revenueTotal > 0;
}

function transitionResults(profileStates, revenueTotals) {
  return profileStates.map((isComplete, index) =>
    progressVisible(isComplete, { revenueTotal: revenueTotals[index] }),
  );
}

function createEvidence({
  legacyRevenue = 1200,
  shadowRevenue = 1200,
  legacyAmount = 264,
  shadowAmount = 264,
} = {}) {
  return createRuntimeParityEvidence({
    scenarioId: "lot-5-25-progress-gate-validation",
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
    observedAt: "LOT_5_25_FIXED_OBSERVATION",
  });
}

test("LOT 5.25 validates the exact Shadow-backed progress gate", () => {
  const block = progressIndicatorsBlock();

  assert.match(block, /isFiscalProfileComplete && fiscalSummaryVisibleSlice\.revenueTotal > 0 && \(/);
  assert.doesNotMatch(block, /currentMonthTotal > 0/);
  assert.equal(occurrences(block, /fiscalSummaryVisibleSlice\.revenueTotal > 0/g), 1);
  assert.equal(occurrences(APP_SOURCE, /currentMonthTotal > 0/g), 0);
  assert.equal(occurrences(APP_SOURCE, /fiscalSummaryVisibleSlice\.revenueTotal > 0/g), 2);
});

test("LOT 5.25 validates isFiscalProfileComplete definition and order remain intact", () => {
  const block = fiscalProfileCompletenessBlock();
  const gateBlock = progressIndicatorsBlock();

  assert.match(block, /const hasProfileCore =\s*Boolean\(dashboardAnswers\?\.activity_type\) &&\s*Boolean\(dashboardAnswers\?\.declaration_frequency\);/);
  assert.match(block, /const requiresAcreStartDate = dashboardAnswers\?\.acre === "yes";/);
  assert.match(
    block,
    /const isFiscalProfileComplete =\s*hasProfileCore &&\s*Boolean\(dashboardAnswers\?\.business_start_date\) &&\s*\(!requiresAcreStartDate \|\| Boolean\(dashboardAnswers\?\.acre_start_date\)\);/,
  );
  assert.match(gateBlock, /isFiscalProfileComplete && fiscalSummaryVisibleSlice\.revenueTotal > 0/);
  assert.doesNotMatch(gateBlock, /Boolean\s*\(isFiscalProfileComplete\)|!!isFiscalProfileComplete/);
});

test("LOT 5.25 validates profile and revenue visibility matrix", () => {
  assert.equal(progressVisible(false, { revenueTotal: 0 }), false);
  assert.equal(progressVisible(false, { revenueTotal: 1200 }), false);
  assert.equal(progressVisible(true, { revenueTotal: 0 }), false);
  assert.equal(progressVisible(true, { revenueTotal: 1200 }), true);
  assert.equal(progressVisible(true, { revenueTotal: 0.01 }), true);
  assert.equal(progressVisible(true, { revenueTotal: -1 }), false);
});

test("LOT 5.25 validates revenue and profile transitions stay deterministic", () => {
  assert.deepEqual(
    transitionResults([true, true, true, true, true], [0, 1200, 1500, 0.01, 0]),
    [false, true, true, true, false],
  );
  assert.deepEqual(
    transitionResults([true, true, true], [1200, 200, 0]),
    [true, true, false],
  );
  assert.deepEqual(
    transitionResults([false, true, false, true], [1200, 1200, 1200, 0]),
    [false, true, false, false],
  );
});

test("LOT 5.25 validates flag ON, flag OFF and absent Shadow behavior", () => {
  const flagOn = selectVisibleSlice({
    flagEnabled: true,
    fiscalSummaryShadow: {
      shadowResult: createShadowResult({ revenueTotal: 0 }),
    },
    ...createLegacyState({ currentMonthTotal: 1200 }),
  });
  const flagOff = selectVisibleSlice({
    flagEnabled: false,
    fiscalSummaryShadow: {
      shadowResult: createShadowResult({ revenueTotal: 0 }),
    },
    ...createLegacyState({ currentMonthTotal: 1200 }),
  });
  const absentShadow = selectVisibleSlice({
    flagEnabled: true,
    fiscalSummaryShadow: null,
    ...createLegacyState({ currentMonthTotal: 1200 }),
  });

  assert.equal(flagOn.revenueTotal, 0);
  assert.equal(progressVisible(true, flagOn), false);
  assert.equal(flagOff.revenueTotal, 1200);
  assert.equal(progressVisible(true, flagOff), true);
  assert.equal(absentShadow.revenueTotal, 1200);
  assert.equal(progressVisible(true, absentShadow), true);
});

test("LOT 5.25 validates no new React or pipeline execution surface", () => {
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
  assert.equal(occurrences(APP_SOURCE, /buildFiscalSummaryInput\(\{/g), 1);
  assert.equal(occurrences(APP_SOURCE, /calculateFiscalSummary\(shadowInput, \{ trace: false \}\)/g), 1);
  const uiText = sourceWithoutComments(objectiveSavingsTextBlock());
  assert.equal(occurrences(code, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/g), 4);
  assert.match(uiText, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.doesNotMatch(uiText, /\bsavingsGoal\b/);
});

test("LOT 5.25 validates the progress gate has no fallback, coercion or calculation", () => {
  const block = progressIndicatorsBlock();
  const condition = block.slice(0, block.indexOf("<div"));

  assert.doesNotMatch(condition, /\|\| 0|\?\? 0|Boolean\s*\(|Number\s*\(|parseFloat\s*\(|parseInt\s*\(/);
  assert.doesNotMatch(condition, /Math\.(round|floor|ceil|max|min)/);
  assert.doesNotMatch(condition, /currentMonthTotal|estimatedCharges|availableAmount|computed|shadowResult|legacySnapshot/);
});

test("LOT 5.25 validates progress indicator JSX and values remain unchanged outside the gate", () => {
  const block = progressIndicatorsBlock();

  assert.match(block, /className="progressIndicators"/);
  assert.match(block, /className="progressItem"/);
  assert.match(block, /className="progressItemHeader"/);
  assert.match(block, /Objectif d'épargne/);
  assert.equal(occurrences(block, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/g), 2);
  assert.doesNotMatch(block, /Math\.round\(\(savingsProgress \/ savingsGoal\) \* 100\)/);
  assert.match(block, /className="progressBar progressBarPremium"/);
  assert.match(block, /className="progressFill"/);
  assert.doesNotMatch(block, /onClick|trackBetaEvent|getDisplayValue|localStorage|sessionStorage|supabase|fetch/i);
});

test("LOT 5.25 validates visible selector and URSSAF gate remain within approved Shadow list", () => {
  const selector = fiscalSummaryVisibleSliceBlock();
  const urssaf = urssafHelperBlock();

  assert.match(selector, /Boolean\(shadowResult\)/);
  assert.match(selector, /revenueTotal:[\s\S]*shadowResult\.revenue\.total[\s\S]*currentMonthTotal/);
  assert.match(selector, /finalContributionAmount:[\s\S]*shadowResult\.summary\.finalContributionAmount[\s\S]*estimatedCharges/);
  assert.match(urssaf, /fiscalSummaryVisibleSlice\.revenueTotal > 0/);
  assert.match(urssaf, /getDisplayValue\(fiscalSummaryVisibleSlice\.revenueTotal, "money"\)/);
  assert.doesNotMatch(APP_SOURCE, /shadowResult\.(tva|cfe|deadline|annual|savings|available|invoice|assistant)/i);
});

test("LOT 5.25 validates remaining currentMonthTotal consumers are retained for approved roles", () => {
  const inventory = [
    [/const currentMonthTotal = useMemo/, "Legacy revenue total"],
    [/ca_month: currentMonthTotal/, "Legacy obligations input"],
    [/revenueTotal: currentMonthTotal/, "runtime parity legacy snapshot"],
    [/: currentMonthTotal/, "visible selector rollback fallback"],
    [/Math\.round\(currentMonthTotal \* computed\.rate\)/, "Legacy estimated charges"],
    [/Math\.max\(0, currentMonthTotal - estimatedCharges\)/, "Legacy available amount"],
    [/realMonthlyRevenue: currentMonthTotal/, "assistant-adjacent guidance"],
    [/totalRevenues: currentMonthTotal \|\| 0/, "feedback payload context"],
    [/getDisplayValue\(currentMonthTotal, "money"\)/, "export summary"],
  ];

  for (const [pattern, role] of inventory) {
    assert.match(APP_SOURCE, pattern, role);
  }

  assert.equal(occurrences(APP_SOURCE, /currentMonthTotal > 0/g), 0);
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
});

test("LOT 5.25 validates persistence, payload, export and assistant boundaries", () => {
  assert.doesNotMatch(progressIndicatorsBlock(), /localStorage|sessionStorage|supabase|fetch|payload|assistant/i);
  assert.doesNotMatch(fiscalSummaryVisibleSliceBlock(), /localStorage|sessionStorage|supabase|fetch|trackBetaEvent|payload/i);
  assert.match(APP_SOURCE, /localStorage\.getItem\(LS_KEY\)/);
  assert.match(APP_SOURCE, /supabase\.from\("revenues"\)/);
  assert.match(feedbackBlock(), /totalRevenues: currentMonthTotal \|\| 0/);
  assert.match(exportBlock(), /getDisplayValue\(currentMonthTotal, "money"\)/);
  assert.match(exportBlock(), /dashboardChargesDisplay/);
  assert.match(exportBlock(), /dashboardAvailableDisplay/);
  assert.match(assistantDraftBlock(), /localStorage\.getItem\(LS_KEY\)/);
});

test("LOT 5.25 validates parity, runtime evidence and intentional MISMATCH stay intact", () => {
  const block = fiscalSummaryShadowBlock();

  assert.match(block, /const legacySnapshot = \{/);
  assert.match(block, /createRuntimeParityEvidence\(/);
  assert.match(block, /SHADOW_PARITY_EVIDENCE_STORE\.record\(shadowParityEvidence\)/);
  assert.match(LOT_5_11_SOURCE, /produces reproducible MATCH evidence/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
  assert.match(SHADOW_PARITY_SOURCE, /SHADOW_PARITY_MISMATCH/);

  const matchOne = createEvidence();
  const matchTwo = createEvidence();
  const mismatch = createEvidence({ legacyRevenue: 999, shadowRevenue: 1200 });

  assert.deepEqual(matchOne, matchTwo);
  assert.equal(matchOne.status, SHADOW_PARITY_MATCH);
  assert.equal(mismatch.status, SHADOW_PARITY_MISMATCH);
  assert.equal(mismatch.checks[0].name, "revenue.total");
  assert.equal(mismatch.checks[0].legacyValue, 999);
  assert.equal(mismatch.checks[0].shadowValue, 1200);
});

test("LOT 5.25 validates LOT 5.18 through LOT 5.24 guard adjustments stay narrow", () => {
  // LOT 5.98: stop hardcoding currentMonthTotal/fiscalSummaryVisibleSlice a second (and, for
  // currentMonthTotal, a sixth) time here. These were dormant duplicates of the exact
  // magic-number-coupling bug class LOT 5.97 fixed in lot-5-29 (which mirror-quoted lot-5-18's
  // estimatedCharges literal). Deriving the regex from this file's own
  // independently-live-verified APPROVED_APP_COUNTS keeps the same protective intent -- every
  // sibling guard file must still agree on the same baseline -- without five separate
  // hardcoded copies of the number to drift out of sync with each other.
  const currentMonthTotalPattern = new RegExp(
    `currentMonthTotal:\\s*${APPROVED_APP_COUNTS.currentMonthTotal}\\b`,
  );

  assert.match(LOT_5_18_SOURCE, currentMonthTotalPattern);
  assert.match(
    LOT_5_18_SOURCE,
    new RegExp(`fiscalSummaryVisibleSlice:\\s*${APPROVED_APP_COUNTS.fiscalSummaryVisibleSlice}\\b`),
  );
  assert.match(LOT_5_18_SOURCE, /fiscalSummaryVisibleSlice\\\.finalContributionAmount \\\* 3/);
  assert.match(LOT_5_18_SOURCE, /blocks unapproved new Legacy consumers/);
  assert.match(LOT_5_18_SOURCE, /isFiscalProfileComplete && fiscalSummaryVisibleSlice\\\.revenueTotal > 0/);
  assert.doesNotMatch(LOT_5_18_SOURCE, /APPROVED_LEGACY_REFERENCES[\s\S]*currentMonthTotal:\s*28/);

  assert.match(LOT_5_20_SOURCE, currentMonthTotalPattern);
  assert.match(LOT_5_21_SOURCE, currentMonthTotalPattern);
  assert.match(LOT_5_22_SOURCE, currentMonthTotalPattern);
  assert.match(LOT_5_24_SOURCE, currentMonthTotalPattern);
  assert.match(LOT_5_24_SOURCE, /rollback is local to the progress gate expression/);
  assert.doesNotMatch(LOT_5_24_SOURCE, /new Context|dashboard-specific flag|new flag/i);
});

test("LOT 5.25 validates rollback remains local to the progress gate", () => {
  const block = progressIndicatorsBlock();
  const rollbackBlock = block.replace(
    "fiscalSummaryVisibleSlice.revenueTotal > 0",
    "currentMonthTotal > 0",
  );

  assert.match(rollbackBlock, /isFiscalProfileComplete && currentMonthTotal > 0/);
  assert.doesNotMatch(rollbackBlock, /isFiscalProfileComplete && fiscalSummaryVisibleSlice\.revenueTotal > 0/);
  assert.match(APP_SOURCE, /fiscalSummaryVisibleSlice\.revenueTotal > 0 \? \(/);
  assert.equal(occurrences(block, /fiscalSummaryVisibleSlice\.revenueTotal > 0/g), 1);
});

test("LOT 5.25 validation harness is deterministic and side-effect free", () => {
  const testSource = readFileSync(new URL(import.meta.url), "utf8");

  assert.doesNotMatch(testSource, /\bDate\.now\b|\bnew Date\b|Math\.random/);
  assert.doesNotMatch(testSource, /\blocalStorage\b\./);
  assert.doesNotMatch(testSource, /\bsupabase\b\./i);
  assert.doesNotMatch(testSource, /\bfetch\s*\(/);
});
