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
const LOT_5_21_SOURCE = readFileSync(
  new URL("./lot-5-21-next-consumer-migration-validation.test.js", import.meta.url),
  "utf8",
);
const PLAYWRIGHT_CONFIG = readFileSync(
  new URL("../playwright.config.js", import.meta.url),
  "utf8",
);

const APPROVED_APP_COUNTS = Object.freeze({
  currentMonthTotal: 24,
  fiscalSummaryVisibleSlice: 15,
  FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED: 2,
  buildFiscalSummaryInput: 2,
  calculateFiscalSummary: 2,
  createRuntimeParityEvidence: 2,
  useState: 87, // LOT 10.2D: +5 useState (declaration dossier UI state)
  useEffect: 60, // LOT 10.2D: +1 useEffect (fetch declaration dossiers on user change)
  // LOT 5.91A: root savingsGoal removed, dropping 2 estimatedCharges reads (formula body + dependency array) and 1 useMemo hook.
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

function createShadowResult({
  revenueTotal = 0,
  finalContributionAmount = 0,
  effectiveRate = 0.22,
  acreStatus = "inactive",
} = {}) {
  return {
    revenue: { total: revenueTotal },
    summary: {
      baseAmount: revenueTotal,
      finalContributionAmount,
      effectiveRate,
    },
    contributions: {
      acre: { acreStatus },
    },
  };
}

function createLegacyState({
  currentMonthTotal = 0,
  estimatedCharges = 0,
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

function currentMonthTotalFrom(revenues) {
  return revenues.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function visibleSliceFromRevenue({
  revenueTotal,
  flagEnabled = true,
  shadowAvailable = true,
  legacyTotal = 999,
} = {}) {
  return selectFirstSlice({
    flagEnabled,
    fiscalSummaryShadow: shadowAvailable
      ? { shadowResult: createShadowResult({ revenueTotal }) }
      : null,
    ...createLegacyState({ currentMonthTotal: legacyTotal }),
  });
}

function shouldShowUrssafHelperDetail(fiscalSummaryVisibleSlice) {
  return fiscalSummaryVisibleSlice.revenueTotal > 0;
}

function createEvidence({ legacyRevenue = 1200, shadowRevenue = 1200 } = {}) {
  return createRuntimeParityEvidence({
    scenarioId: "lot-5-22-urssaf-gate-stabilization",
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
    observedAt: "LOT_5_22_FIXED_OBSERVATION",
  });
}

test("LOT 5.22 keeps the URSSAF gate Shadow-backed and exact", () => {
  const block = urssafHelperBlock();

  assert.match(block, /fiscalSummaryVisibleSlice\.revenueTotal > 0/);
  assert.equal(occurrences(block, /fiscalSummaryVisibleSlice\.revenueTotal > 0/g), 1);
  assert.doesNotMatch(block, /currentMonthTotal > 0/);
  assert.doesNotMatch(block, /shadowResult|legacySnapshot/);
});

test("LOT 5.22 keeps zero hidden and positive visible", () => {
  assert.equal(shouldShowUrssafHelperDetail({ revenueTotal: 0 }), false);
  assert.equal(shouldShowUrssafHelperDetail({ revenueTotal: 1 }), true);
  assert.equal(shouldShowUrssafHelperDetail({ revenueTotal: 1250 }), true);
});

test("LOT 5.22 stabilizes positive to zero and zero to positive transitions", () => {
  const values = [100, 0, 0, 50, 0];

  assert.deepEqual(
    values.map((revenueTotal) => shouldShowUrssafHelperDetail({ revenueTotal })),
    [true, false, false, true, false],
  );
});

test("LOT 5.22 stabilizes first, second and removed revenue transitions", () => {
  const steps = [
    [],
    [{ amount: 100 }],
    [{ amount: 100 }, { amount: 250 }],
    [{ amount: 250 }],
    [],
  ];

  assert.deepEqual(
    steps.map((revenues) =>
      shouldShowUrssafHelperDetail({
        revenueTotal: currentMonthTotalFrom(revenues),
      }),
    ),
    [false, true, true, true, false],
  );
});

test("LOT 5.22 keeps repeated revenue changes deterministic", () => {
  const sequence = [0, 10, 20, 20, 5, 0, 30, 0];
  const firstRun = sequence.map((revenueTotal) =>
    shouldShowUrssafHelperDetail({ revenueTotal }),
  );
  const secondRun = sequence.map((revenueTotal) =>
    shouldShowUrssafHelperDetail({ revenueTotal }),
  );

  assert.deepEqual(firstRun, [false, true, true, true, true, false, true, false]);
  assert.deepEqual(firstRun, secondRun);
});

test("LOT 5.22 keeps activity and frequency changes from creating a hidden gate dependency", () => {
  const stableRevenue = 800;
  const scenarios = [
    { activityType: "services", declarationFrequency: "mensuel" },
    { activityType: "vente", declarationFrequency: "mensuel" },
    { activityType: "services", declarationFrequency: "trimestriel" },
    { activityType: "mixte", declarationFrequency: "trimestriel" },
  ];

  assert.deepEqual(
    scenarios.map(() =>
      shouldShowUrssafHelperDetail(visibleSliceFromRevenue({ revenueTotal: stableRevenue })),
    ),
    [true, true, true, true],
  );
});

test("LOT 5.22 keeps reload and restoration behavior tied only to restored revenue total", () => {
  const persistedState = {
    revenues: [{ id: "r1", amount: 150 }],
  };
  const restoredState = structuredClone(persistedState);

  assert.equal(currentMonthTotalFrom(restoredState.revenues), 150);
  assert.equal(
    shouldShowUrssafHelperDetail(
      visibleSliceFromRevenue({ revenueTotal: currentMonthTotalFrom(restoredState.revenues) }),
    ),
    true,
  );
});

test("LOT 5.22 keeps flag ON on Shadow revenue without an intermediate visible state", () => {
  const selected = visibleSliceFromRevenue({
    revenueTotal: 0,
    flagEnabled: true,
    legacyTotal: 1200,
  });

  assert.equal(selected.revenueTotal, 0);
  assert.equal(shouldShowUrssafHelperDetail(selected), false);
});

test("LOT 5.22 keeps flag OFF rollback immediate and Legacy-backed", () => {
  const selected = visibleSliceFromRevenue({
    revenueTotal: 0,
    flagEnabled: false,
    legacyTotal: 1200,
  });

  assert.equal(selected.revenueTotal, 1200);
  assert.equal(shouldShowUrssafHelperDetail(selected), true);
});

test("LOT 5.22 keeps absent Shadow Result fallback global and Legacy-backed", () => {
  const selected = visibleSliceFromRevenue({
    revenueTotal: 0,
    flagEnabled: true,
    shadowAvailable: false,
    legacyTotal: 1200,
  });

  assert.equal(selected.revenueTotal, 1200);
  assert.equal(shouldShowUrssafHelperDetail(selected), true);
});

test("LOT 5.22 keeps fallback from replacing valid falsy Shadow values", () => {
  const selected = visibleSliceFromRevenue({
    revenueTotal: 0,
    flagEnabled: true,
    legacyTotal: 1200,
  });
  const block = visibleSliceBlock();

  assert.equal(selected.revenueTotal, 0);
  assert.match(block, /Boolean\(shadowResult\)/);
  assert.doesNotMatch(block, /\|\|\s*(currentMonthTotal|estimatedCharges|computed)/);
  assert.doesNotMatch(block, /\?\?\s*(currentMonthTotal|estimatedCharges|computed)/);
});

test("LOT 5.22 keeps the feature flag local, unique and not persisted", () => {
  const code = sourceWithoutComments(APP_SOURCE);
  const block = visibleSliceBlock();

  assert.equal(
    occurrences(code, /const FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED = true;/g),
    1,
  );
  assert.match(block, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/);
  assert.doesNotMatch(block, /localStorage|sessionStorage|supabase|fetch|Date\.now|new Date|Math\.random|user/i);
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
});

test("LOT 5.22 keeps React counts, Adapter execution and Facade execution stable", () => {
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
  assert.equal(occurrences(APP_SOURCE, /buildFiscalSummaryInput\(\{/g), 1);
  assert.equal(occurrences(APP_SOURCE, /calculateFiscalSummary\(shadowInput, \{ trace: false \}\)/g), 1);
  const uiText = sourceWithoutComments(objectiveSavingsTextBlock());
  assert.equal(occurrences(code, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/g), 4);
  assert.match(uiText, /fiscalSummaryVisibleSlice\.finalContributionAmount \* 3/);
  assert.doesNotMatch(uiText, /\bsavingsGoal\b/);
});

test("LOT 5.22 keeps helper JSX unchanged outside the approved gate", () => {
  const block = urssafHelperBlock();

  assert.match(block, /className="dashboardDeclareHelper"/);
  assert.match(block, /Montant à déclarer : \{getDisplayValue\(fiscalSummaryVisibleSlice\.revenueTotal, "money"\)\}/);
  assert.match(block, /Période concernée : \{computed\.nextDeclarationLabel\}/);
  assert.match(block, /Échéance estimée : \{computed\.deadlineLabel\}/);
  assert.match(block, /Microassist t’ouvre le site officiel URSSAF\. Vérifie toujours le montant avant de valider\./);
  assert.match(block, /Ajoute un revenu pour calculer le montant à déclarer\./);
  assert.doesNotMatch(block, /style=|dangerouslySetInnerHTML|set[A-Z]\w*\s*\(/);
});

test("LOT 5.22 keeps parity MATCH and intentional MISMATCH observable", () => {
  const matchEvidence = createEvidence();
  const mismatchEvidence = createEvidence({ legacyRevenue: 999, shadowRevenue: 1200 });

  assert.equal(matchEvidence.status, SHADOW_PARITY_MATCH);
  assert.equal(mismatchEvidence.status, SHADOW_PARITY_MISMATCH);
  assert.equal(mismatchEvidence.checks[0].name, "revenue.total");
  assert.equal(mismatchEvidence.checks[0].legacyValue, 999);
  assert.equal(mismatchEvidence.checks[0].shadowValue, 1200);
});

test("LOT 5.22 keeps runtime evidence wiring intact", () => {
  const block = shadowBlock();

  assert.match(block, /const legacySnapshot = \{/);
  assert.match(block, /createRuntimeParityEvidence\(/);
  assert.match(block, /SHADOW_PARITY_EVIDENCE_STORE\.record\(shadowParityEvidence\)/);
  assert.match(block, /return \{\s*shadowInput,\s*shadowResult,\s*shadowParityEvidence,\s*\}/);
});

test("LOT 5.22 keeps parity inputs, traces, warnings and fixtures unaffected by the gate", () => {
  assert.match(LOT_5_21_SOURCE, /validates parity and runtime evidence remain intact/);
  assert.match(LOT_5_21_SOURCE, /validates persistence paths are not touched by the gate/);
  assert.match(LOT_5_21_SOURCE, /validates payload, export and assistant boundaries stay Legacy-compatible/);
  assert.doesNotMatch(urssafHelperBlock(), /trace|warnings|fixture|shadowInput|legacySnapshot/i);
});

test("LOT 5.22 keeps Legacy retention guards strict and adjusted only for the approved gate", () => {
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
  assert.match(LOT_5_18_SOURCE, /blocks unapproved new Legacy consumers/);
  assert.match(LOT_5_18_SOURCE, /isFiscalProfileComplete && fiscalSummaryVisibleSlice\\\.revenueTotal > 0/);
  assert.equal(occurrences(APP_SOURCE, /currentMonthTotal > 0/g), 0);
});

test("LOT 5.22 keeps other currentMonthTotal consumers unchanged", () => {
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
});

test("LOT 5.22 keeps other Shadow consumers out of scope", () => {
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

test("LOT 5.22 keeps persistence isolated from the migrated gate", () => {
  assert.doesNotMatch(urssafHelperBlock(), /localStorage|sessionStorage|supabase|fetch/i);
  assert.doesNotMatch(visibleSliceBlock(), /localStorage|sessionStorage|supabase|fetch/i);
  assert.match(APP_SOURCE, /localStorage\.getItem\(LS_KEY\)/);
  assert.match(APP_SOURCE, /supabase\.from\("revenues"\)/);
});

test("LOT 5.22 keeps payloads, exports and assistant boundaries unchanged", () => {
  assert.match(feedbackBlock(), /totalRevenues: currentMonthTotal \|\| 0/);
  assert.match(exportBlock(), /getDisplayValue\(currentMonthTotal, "money"\)/);
  assert.match(exportBlock(), /dashboardChargesDisplay/);
  assert.match(exportBlock(), /dashboardAvailableDisplay/);
  assert.match(assistantDraftBlock(), /localStorage\.getItem\(LS_KEY\)/);
  assert.doesNotMatch(urssafHelperBlock(), /trackBetaEvent|payload|downloadTextFile|generateFacturXXml|generateB2CInvoicePdf|assistant/i);
});

test("LOT 5.22 keeps rollback local to the helper gate expression", () => {
  const block = urssafHelperBlock();
  const rollbackBlock = block.replace(
    "fiscalSummaryVisibleSlice.revenueTotal > 0",
    "currentMonthTotal > 0",
  );

  assert.match(rollbackBlock, /currentMonthTotal > 0/);
  assert.doesNotMatch(rollbackBlock, /fiscalSummaryVisibleSlice\.revenueTotal > 0/);
  assert.equal(occurrences(block, /fiscalSummaryVisibleSlice\.revenueTotal > 0/g), 1);
});

test("LOT 5.22 keeps Playwright collection restricted to browser specs", () => {
  assert.match(PLAYWRIGHT_CONFIG, /testMatch:\s*['"]\*\*\/\*\.spec\.js['"]/);
  assert.match(PLAYWRIGHT_CONFIG, /workers:\s*1/);
  assert.doesNotMatch(PLAYWRIGHT_CONFIG, /\.test\.js/);
});

test("LOT 5.22 dependency inventory remains stable", () => {
  const dependencies = {
    fiscalSummaryVisibleSlice: visibleSliceBlock(),
    shadowResult: visibleSliceBlock(),
    currentMonthTotal: APP_SOURCE,
    featureFlag: visibleSliceBlock(),
    fallback: visibleSliceBlock(),
    parity: shadowBlock(),
    runtimeEvidence: shadowBlock(),
    dashboard: APP_SOURCE,
    helperJsx: urssafHelperBlock(),
    legacyRollbackPath: visibleSliceBlock(),
  };

  for (const [name, source] of Object.entries(dependencies)) {
    assert.equal(typeof source, "string", name);
    assert.notEqual(source.length, 0, name);
  }
});

test("LOT 5.22 stabilization guard is deterministic and side-effect free", () => {
  const testSource = readFileSync(new URL(import.meta.url), "utf8");

  assert.doesNotMatch(testSource, /\bDate\.now\b|\bMath\.random\b/);
  assert.doesNotMatch(testSource, /\blocalStorage\b\./);
  assert.doesNotMatch(testSource, /\bsupabase\b\./i);
  assert.doesNotMatch(testSource, /\bfetch\s*\(/);
});
