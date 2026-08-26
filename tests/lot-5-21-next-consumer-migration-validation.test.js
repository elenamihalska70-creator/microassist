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
const LOT_5_18_SOURCE = readFileSync(
  new URL("./lot-5-18-legacy-retention-hardening.test.js", import.meta.url),
  "utf8",
);
const LOT_5_20_SOURCE = readFileSync(
  new URL("./lot-5-20-next-consumer-migration.test.js", import.meta.url),
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
  fiscalSummaryVisibleSlice: 15,
  FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED: 2,
  buildFiscalSummaryInput: 2,
  calculateFiscalSummary: 2,
  createRuntimeParityEvidence: 2,
  useState: 88, // LOT 10.2D: +5 useState (declaration dossier UI state); LOT 10.2D.1: +1 (payment confirm loading guard)
  useEffect: 60, // LOT 10.2D: +1 useEffect (fetch declaration dossiers on user change)
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
  baseAmount = revenueTotal,
  finalContributionAmount = 0,
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
    scenarioId: "lot-5-21-urssaf-gate-validation",
    legacySnapshot: {
      revenueTotal: legacyRevenue,
      estimatedAmount: 264,
      rate: 0.22,
      acreStatus: "inactive",
    },
    shadowResult: createShadowResult({
      revenueTotal: shadowRevenue,
      finalContributionAmount: 264,
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
    observedAt: "LOT_5_21_FIXED_OBSERVATION",
  });
}

test("LOT 5.21 validates the exact migrated URSSAF gate condition", () => {
  const block = urssafHelperBlock();

  assert.match(block, /fiscalSummaryVisibleSlice\.revenueTotal > 0/);
  assert.equal(occurrences(block, /fiscalSummaryVisibleSlice\.revenueTotal > 0/g), 1);
  assert.doesNotMatch(block, /currentMonthTotal > 0/);
  assert.doesNotMatch(block, /Number\s*\(|Boolean\s*\(|parseFloat\s*\(|parseInt\s*\(/);
  assert.doesNotMatch(block, /\|\| 0|\?\? 0|Math\.(round|floor|ceil|max|min)/);
});

test("LOT 5.21 validates zero, positive, negative and decimal gate behavior", () => {
  assert.equal(shouldShowUrssafHelperDetail({ revenueTotal: 0 }), false);
  assert.equal(shouldShowUrssafHelperDetail({ revenueTotal: 1 }), true);
  assert.equal(shouldShowUrssafHelperDetail({ revenueTotal: -1 }), false);
  assert.equal(shouldShowUrssafHelperDetail({ revenueTotal: 0.01 }), true);
});

test("LOT 5.21 validates successive revenue transitions for the gate", () => {
  const states = [0, 100, 40, 0, 0.5, 0];
  const visibility = states.map((revenueTotal) =>
    shouldShowUrssafHelperDetail({ revenueTotal }),
  );

  assert.deepEqual(visibility, [false, true, true, false, true, false]);
});

test("LOT 5.21 validates flag ON uses Shadow revenue for visibility", () => {
  const selected = selectFirstSlice({
    flagEnabled: true,
    fiscalSummaryShadow: { shadowResult: createShadowResult({ revenueTotal: 0 }) },
    ...createLegacyState({ currentMonthTotal: 1200 }),
  });

  assert.equal(selected.revenueTotal, 0);
  assert.equal(shouldShowUrssafHelperDetail(selected), false);
});

test("LOT 5.21 validates flag OFF rollback to Legacy visibility", () => {
  const selected = selectFirstSlice({
    flagEnabled: false,
    fiscalSummaryShadow: { shadowResult: createShadowResult({ revenueTotal: 0 }) },
    ...createLegacyState({ currentMonthTotal: 1200 }),
  });

  assert.equal(selected.revenueTotal, 1200);
  assert.equal(shouldShowUrssafHelperDetail(selected), true);
});

test("LOT 5.21 validates absent Shadow Result rollback to Legacy visibility", () => {
  const selected = selectFirstSlice({
    flagEnabled: true,
    fiscalSummaryShadow: null,
    ...createLegacyState({ currentMonthTotal: 1200 }),
  });

  assert.equal(selected.revenueTotal, 1200);
  assert.equal(shouldShowUrssafHelperDetail(selected), true);
});

test("LOT 5.21 validates the existing feature flag remains local and unique", () => {
  const code = sourceWithoutComments(APP_SOURCE);
  const block = visibleSliceBlock();

  assert.equal(
    occurrences(code, /const FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED = true;/g),
    1,
  );
  assert.match(block, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/);
  assert.deepEqual(
    code.match(/\bconst\s+[A-Z0-9_]*FEATURE[A-Z0-9_]*\s*=/g) ?? [],
    [],
  );
  // LOT 10.2C.1: DECLARATION_REMINDER_EMAILS_ENABLED is an unrelated
  // release-safety flag for the declaration-reminder EMAIL pathway (see
  // tests/lot-10-2c-1-declaration-email-safety.test.js) -- it does not
  // compete with or duplicate FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED,
  // which is what this assertion actually protects. Explicitly excluded by
  // name so this still catches any OTHER URSSAF/DECLARATION-named flag.
  assert.doesNotMatch(
    code,
    /\bconst\s+(?!DECLARATION_REMINDER_EMAILS_ENABLED\b)[A-Z0-9_]*(URSSAF|DECLARATION)[A-Z0-9_]*\s*=/,
  );
  assert.doesNotMatch(block, /localStorage|sessionStorage|supabase|fetch|Date\.now|new Date|Math\.random/i);
});

test("LOT 5.21 validates no new state, effect, Adapter or Facade execution", () => {
  const code = sourceWithoutComments(APP_SOURCE);

  for (const [identifier, expectedCount] of Object.entries(APPROVED_APP_COUNTS)) {
    assert.equal(
      occurrences(code, new RegExp(`\\b${identifier}\\b`, "g")),
      expectedCount,
      identifier,
    );
  }

  assert.equal(occurrences(APP_SOURCE, /const fiscalSummaryShadow = useMemo/g), 1);
  assert.equal(occurrences(APP_SOURCE, /const fiscalSummaryVisibleSlice = useMemo/g), 1);
  assert.equal(occurrences(APP_SOURCE, /calculateFiscalSummary\(shadowInput, \{ trace: false \}\)/g), 1);
  assert.equal(occurrences(APP_SOURCE, /buildFiscalSummaryInput\(\{/g), 1);
  const uiText = sourceWithoutComments(objectiveSavingsTextBlock());
  assert.equal(occurrences(code, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/g), 4);
  assert.match(uiText, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.doesNotMatch(uiText, /\bsavingsGoal\b/);
});

test("LOT 5.21 validates helper JSX, text, classes and interactions remain unchanged", () => {
  const block = urssafHelperBlock();

  assert.match(block, /className="dashboardDeclareHelper"/);
  assert.match(block, /Montant à déclarer : \{getDisplayValue\(fiscalSummaryVisibleSlice\.revenueTotal, "money"\)\}/);
  assert.match(block, /Période concernée : \{computed\.nextDeclarationLabel\}/);
  assert.match(block, /Échéance estimée : \{computed\.deadlineLabel\}/);
  assert.match(block, /Microassist t’ouvre le site officiel URSSAF\. Vérifie toujours le montant avant de valider\./);
  assert.match(block, /Ajoute un revenu pour calculer le montant à déclarer\./);
  assert.doesNotMatch(block, /onClick|href=|style=|className=\{`|dangerouslySetInnerHTML/);
});

test("LOT 5.21 validates there is no double source for the helper visibility", () => {
  const block = urssafHelperBlock();

  assert.match(block, /fiscalSummaryVisibleSlice\.revenueTotal > 0/);
  assert.match(block, /getDisplayValue\(fiscalSummaryVisibleSlice\.revenueTotal, "money"\)/);
  assert.doesNotMatch(block, /currentMonthTotal|shadowResult|legacySnapshot/);
});

test("LOT 5.21 validates other currentMonthTotal consumers remain intact", () => {
  assert.match(APP_SOURCE, /const currentMonthTotal = useMemo/);
  assert.match(APP_SOURCE, /ca_month: currentMonthTotal/);
  assert.match(shadowBlock(), /revenueTotal: currentMonthTotal/);
  assert.match(visibleSliceBlock(), /: currentMonthTotal/);
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
  assert.match(APP_SOURCE, /isFiscalProfileComplete && fiscalSummaryVisibleSlice\.revenueTotal > 0/);
});

test("LOT 5.21 validates no other consumer was migrated to Shadow", () => {
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
  assert.equal(occurrences(APP_SOURCE, /currentMonthTotal > 0/g), 0);
});

test("LOT 5.21 validates parity and runtime evidence remain intact", () => {
  const block = shadowBlock();

  assert.match(block, /const legacySnapshot = \{/);
  assert.match(block, /createRuntimeParityEvidence\(/);
  assert.match(block, /SHADOW_PARITY_EVIDENCE_STORE\.record\(shadowParityEvidence\)/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
  assert.match(SHADOW_PARITY_SOURCE, /SHADOW_PARITY_MISMATCH/);

  const matchEvidence = createEvidence();
  const mismatchEvidence = createEvidence({ legacyRevenue: 999, shadowRevenue: 1200 });

  assert.equal(matchEvidence.status, SHADOW_PARITY_MATCH);
  assert.equal(mismatchEvidence.status, SHADOW_PARITY_MISMATCH);
  assert.equal(mismatchEvidence.checks[0].name, "revenue.total");
  assert.equal(mismatchEvidence.checks[0].legacyValue, 999);
  assert.equal(mismatchEvidence.checks[0].shadowValue, 1200);
});

test("LOT 5.21 validates persistence paths are not touched by the gate", () => {
  assert.doesNotMatch(urssafHelperBlock(), /localStorage|sessionStorage|supabase|fetch/i);
  assert.doesNotMatch(visibleSliceBlock(), /localStorage|sessionStorage|supabase|fetch/i);
  assert.match(APP_SOURCE, /localStorage\.getItem\(LS_KEY\)/);
  assert.match(APP_SOURCE, /supabase\.from\("revenues"\)/);
});

test("LOT 5.21 validates payload, export and assistant boundaries stay Legacy-compatible", () => {
  assert.match(feedbackBlock(), /totalRevenues: currentMonthTotal \|\| 0/);
  assert.match(exportBlock(), /getDisplayValue\(currentMonthTotal, "money"\)/);
  assert.match(exportBlock(), /dashboardChargesDisplay/);
  assert.match(exportBlock(), /dashboardAvailableDisplay/);
  assert.match(assistantDraftBlock(), /localStorage\.getItem\(LS_KEY\)/);
  assert.doesNotMatch(urssafHelperBlock(), /trackBetaEvent|payload|downloadTextFile|generateFacturXXml|generateB2CInvoicePdf|assistant/i);
});

test("LOT 5.21 validates Legacy Retention Guard remains adjusted only for the approved gate", () => {
  // LOT 5.98: stop hardcoding currentMonthTotal/fiscalSummaryVisibleSlice a second time here.
  // These were dormant duplicates of the exact magic-number-coupling bug class LOT 5.97 fixed
  // in lot-5-29 (which mirror-quoted lot-5-18's estimatedCharges literal). Deriving the regex
  // from this file's own independently-live-verified APPROVED_APP_COUNTS keeps the same
  // protective intent -- lot-5-18's guard must still enforce the same baselines -- without a
  // second hardcoded copy of either number to drift out of sync.
  assert.match(
    LOT_5_18_SOURCE,
    new RegExp(`currentMonthTotal:\\s*${APPROVED_APP_COUNTS.currentMonthTotal}\\b`),
  );
  assert.match(
    LOT_5_18_SOURCE,
    new RegExp(`fiscalSummaryVisibleSlice:\\s*${APPROVED_APP_COUNTS.fiscalSummaryVisibleSlice}\\b`),
  );
  assert.match(LOT_5_18_SOURCE, /fiscalSummaryVisibleSlice\\\.finalContributionAmount \\\* 3/);
  assert.match(LOT_5_18_SOURCE, /fiscalSummaryVisibleSlice\\\.revenueTotal > 0/);
  assert.match(LOT_5_18_SOURCE, /isFiscalProfileComplete && fiscalSummaryVisibleSlice\\\.revenueTotal > 0/);
  assert.match(LOT_5_18_SOURCE, /blocks unapproved new Legacy consumers/);
});

test("LOT 5.21 validates LOT 5.20 proof remains active", () => {
  assert.match(LOT_5_20_SOURCE, /migrates only the URSSAF helper gate/);
  assert.match(LOT_5_20_SOURCE, /flag ON uses Shadow revenue/);
  assert.match(LOT_5_20_SOURCE, /flag OFF restores Legacy/);
  assert.match(LOT_5_20_SOURCE, /keeps persistence, payloads, exports and assistant boundaries unchanged/);
});

test("LOT 5.21 validates rollback remains a single local expression", () => {
  const block = urssafHelperBlock();
  const rollbackBlock = block.replace(
    "fiscalSummaryVisibleSlice.revenueTotal > 0",
    "currentMonthTotal > 0",
  );

  assert.match(rollbackBlock, /currentMonthTotal > 0/);
  assert.doesNotMatch(rollbackBlock, /fiscalSummaryVisibleSlice\.revenueTotal > 0/);
  assert.equal(occurrences(block, /fiscalSummaryVisibleSlice\.revenueTotal > 0/g), 1);
});

test("LOT 5.21 validation guards are deterministic and side-effect free", () => {
  const testSource = readFileSync(new URL(import.meta.url), "utf8");

  assert.doesNotMatch(testSource, /\bDate\.now\b|\bMath\.random/);
  assert.doesNotMatch(testSource, /\blocalStorage\b\./);
  assert.doesNotMatch(testSource, /\bsupabase\b\./i);
  assert.doesNotMatch(testSource, /\bfetch\s*\(/);
});
