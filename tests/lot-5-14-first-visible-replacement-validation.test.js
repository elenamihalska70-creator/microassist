import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createRuntimeParityEvidence,
  SHADOW_PARITY_MATCH,
  SHADOW_PARITY_MISMATCH,
} from "../src/application/shadow/runtimeParityEvidence.js";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const LOT_5_12_REPORT = readFileSync(
  new URL("../docs/LOT_5_12_FIRST_VISIBLE_REPLACEMENT_GATE_REVIEW.md", import.meta.url),
  "utf8",
);
const LOT_5_13_REPORT = readFileSync(
  new URL("../docs/LOT_5_13_FIRST_VISIBLE_REPLACEMENT_REPORT.md", import.meta.url),
  "utf8",
);
const LOT_5_11_SOURCE = readFileSync(
  new URL("./lot-5-11-additional-parity-evidence.test.js", import.meta.url),
  "utf8",
);

const APPROVED_FIELDS = Object.freeze([
  "revenue.total",
  "summary.baseAmount",
  "summary.finalContributionAmount",
  "summary.effectiveRate",
  "acre.status",
]);

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
  return extractBlock("const dashboardRevenueDisplay =", "  const dashboardAvailableDisplay =");
}

function selectFirstSliceForValidation({
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

function createLegacyValues() {
  return {
    currentMonthTotal: 999,
    estimatedCharges: 333,
    computed: {
      rate: 0.33,
      acreStatus: "legacy-status",
    },
  };
}

test("LOT 5.14 confirms LOT 5.12 authorized the local flag, selector and Legacy fallback", () => {
  assert.match(LOT_5_12_REPORT, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/);
  assert.match(LOT_5_12_REPORT, /if the feature flag is enabled and Shadow result is available, use Shadow values/);
  assert.match(LOT_5_12_REPORT, /otherwise use Legacy values/);
  assert.match(LOT_5_13_REPORT, /visible approved slice value -> Shadow value when flag enabled/);
  assert.match(LOT_5_13_REPORT, /visible approved slice value -> Legacy fallback when flag disabled or Shadow unavailable/);
});

test("LOT 5.14 validates the feature flag is local, explicit and deterministic", () => {
  assert.match(
    APP_SOURCE,
    /const FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED = true;/,
  );
  assert.doesNotMatch(APP_SOURCE, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED[\s\S]{0,120}(localStorage|sessionStorage|supabase|fetch|Date\.now|new Date|Math\.random)/);
});

test("LOT 5.14 validates flag ON reads Shadow for every approved first-slice field", () => {
  const selected = selectFirstSliceForValidation({
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
    ...createLegacyValues(),
  });

  assert.deepEqual(selected, {
    revenueTotal: 0,
    baseAmount: 0,
    finalContributionAmount: 0,
    effectiveRate: 0,
    acreStatus: "active",
  });
});

test("LOT 5.14 validates flag OFF rolls back immediately to Legacy values", () => {
  const selected = selectFirstSliceForValidation({
    flagEnabled: false,
    fiscalSummaryShadow: {
      shadowResult: createShadowResult({
        revenueTotal: 100,
        baseAmount: 100,
        finalContributionAmount: 22,
        effectiveRate: 0.22,
        acreStatus: "active",
      }),
    },
    ...createLegacyValues(),
  });

  assert.deepEqual(selected, {
    revenueTotal: 999,
    baseAmount: 999,
    finalContributionAmount: 333,
    effectiveRate: 0.33,
    acreStatus: "legacy-status",
  });
});

test("LOT 5.14 validates absent Shadow Result follows the approved Legacy fallback", () => {
  const selected = selectFirstSliceForValidation({
    flagEnabled: true,
    fiscalSummaryShadow: null,
    ...createLegacyValues(),
  });

  assert.deepEqual(selected, {
    revenueTotal: 999,
    baseAmount: 999,
    finalContributionAmount: 333,
    effectiveRate: 0.33,
    acreStatus: "legacy-status",
  });
});

test("LOT 5.14 validates falsy Shadow field values are not confused with missing Shadow", () => {
  const block = visibleSliceBlock();

  assert.match(block, /Boolean\(shadowResult\)/);
  assert.doesNotMatch(block, /\|\|\s*(currentMonthTotal|estimatedCharges|computed)/);
  assert.doesNotMatch(block, /\?\?\s*(currentMonthTotal|estimatedCharges|computed)/);
  assert.doesNotMatch(block, /shadowResult\.revenue\.total\s*\?/);
  assert.doesNotMatch(block, /shadowResult\.summary\.finalContributionAmount\s*\?/);

  const selected = selectFirstSliceForValidation({
    flagEnabled: true,
    fiscalSummaryShadow: {
      shadowResult: createShadowResult({
        revenueTotal: 0,
        baseAmount: 0,
        finalContributionAmount: 0,
        effectiveRate: 0,
        acreStatus: null,
      }),
    },
    ...createLegacyValues(),
  });

  assert.equal(selected.revenueTotal, 0);
  assert.equal(selected.baseAmount, 0);
  assert.equal(selected.finalContributionAmount, 0);
  assert.equal(selected.effectiveRate, 0);
  assert.equal(selected.acreStatus, null);
});

test("LOT 5.14 validates all supported ACRE statuses are selected from Shadow when flag is ON", () => {
  for (const acreStatus of ["inactive", "active", "expired", null]) {
    const selected = selectFirstSliceForValidation({
      flagEnabled: true,
      fiscalSummaryShadow: {
        shadowResult: createShadowResult({ acreStatus }),
      },
      ...createLegacyValues(),
    });

    assert.equal(selected.acreStatus, acreStatus);
  }
});

test("LOT 5.14 validates MISMATCH and incomplete Shadow structures remain observable in evidence", () => {
  const mismatchEvidence = createRuntimeParityEvidence({
    scenarioId: "lot-5-14-mismatch-control",
    legacySnapshot: {
      revenueTotal: 100,
      estimatedAmount: 22,
      rate: 0.22,
      acreStatus: "inactive",
    },
    shadowResult: createShadowResult({
      revenueTotal: 100,
      baseAmount: 100,
      finalContributionAmount: 999,
      effectiveRate: 0.22,
      acreStatus: "inactive",
    }),
    shadowInput: {
      revenues: [{ id: "r1", amount: 100, date: "2026-07-10" }],
      fiscalProfile: {
        activityType: "services",
        acre: "no",
        acreStartDate: null,
      },
      period: {},
      referenceDate: "2026-07-30",
    },
    observedAt: "LOT_5_14_FIXED_OBSERVATION",
  });

  const incompleteEvidence = createRuntimeParityEvidence({
    ...mismatchEvidence,
    scenarioId: "lot-5-14-incomplete-shadow-control",
    shadowResult: { revenue: { total: 100 } },
  });

  assert.equal(mismatchEvidence.status, SHADOW_PARITY_MISMATCH);
  assert.equal(incompleteEvidence.status, SHADOW_PARITY_MISMATCH);
  assert.deepEqual(
    incompleteEvidence.checks.map((check) => [check.name, check.status]),
    [
      ["revenue.total", SHADOW_PARITY_MATCH],
      ["summary.baseAmount", SHADOW_PARITY_MISMATCH],
      ["summary.finalContributionAmount", SHADOW_PARITY_MISMATCH],
      ["summary.effectiveRate", SHADOW_PARITY_MISMATCH],
      ["acre.status", SHADOW_PARITY_MISMATCH],
    ],
  );
});

test("LOT 5.14 validates the selector only chooses a source and has no side effects", () => {
  const block = visibleSliceBlock();

  for (const field of APPROVED_FIELDS) {
    assert.match(LOT_5_13_REPORT, new RegExp(field.replace(".", "\\.")));
  }

  assert.doesNotMatch(block, /Math\.(round|floor|ceil|abs)/);
  assert.doesNotMatch(block, /Number\s*\(/);
  assert.doesNotMatch(block, /parseFloat\s*\(/);
  assert.doesNotMatch(block, /parseInt\s*\(/);
  assert.doesNotMatch(block, /\bset[A-Z]\w*\s*\(/);
  assert.doesNotMatch(block, /\b(localStorage|sessionStorage|supabase|fetch)\b/i);
  assert.doesNotMatch(block, /\b(downloadTextFile|generateFacturXXml|generateB2CInvoicePdf|assistantMessages)\b/);
});

test("LOT 5.14 validates no second Adapter or Facade execution was introduced", () => {
  const block = shadowBlock();

  assert.equal(occurrences(APP_SOURCE, /calculateFiscalSummary\(/g), 1);
  assert.equal(occurrences(APP_SOURCE, /buildFiscalSummaryInput\(/g), 1);
  assert.match(block, /const shadowResult = calculateFiscalSummary\(shadowInput, \{ trace: false \}\)/);
  assert.match(block, /return \{\s*shadowInput,\s*shadowResult,\s*shadowParityEvidence,\s*\}/);
});

test("LOT 5.14 validates visible dashboard reads are isolated to the approved slice", () => {
  const block = dashboardDisplayBlock();

  assert.match(block, /getDisplayValue\(fiscalSummaryVisibleSlice\.revenueTotal, "money"\)/);
  assert.match(block, /fiscalSummaryVisibleSlice\.finalContributionAmount/);
  assert.match(
    APP_SOURCE,
    /Montant à déclarer : \{getDisplayValue\(fiscalSummaryVisibleSlice\.revenueTotal, "money"\)\}/,
  );
  assert.doesNotMatch(block, /fiscalSummaryVisibleSlice\.(tva|cfe|deadline|assistant|export|invoice|available)/i);
});

test("LOT 5.14 validates persistence, payload, export and assistant paths remain Legacy-only", () => {
  const appWithoutSelector = APP_SOURCE.replace(visibleSliceBlock(), "");

  assert.doesNotMatch(appWithoutSelector, /fiscalSummaryVisibleSlice[\s\S]{0,160}(supabase|localStorage|sessionStorage|downloadTextFile|generateFacturXXml|generateB2CInvoicePdf|assistant)/i);
  assert.doesNotMatch(appWithoutSelector, /(supabase|localStorage|sessionStorage|downloadTextFile|generateFacturXXml|generateB2CInvoicePdf|assistant)[\s\S]{0,160}fiscalSummaryVisibleSlice/i);
  assert.doesNotMatch(appWithoutSelector, /shadowResult[\s\S]{0,160}(supabase|localStorage|sessionStorage|downloadTextFile|generateFacturXXml|generateB2CInvoicePdf|assistant)/i);
});

test("LOT 5.14 validates React boundary: no new state or effect is coupled to replacement", () => {
  const block = visibleSliceBlock();

  assert.match(block, /const fiscalSummaryVisibleSlice = useMemo/);
  assert.doesNotMatch(block, /useState\s*\(/);
  assert.doesNotMatch(block, /useEffect\s*\(/);
  assert.doesNotMatch(block, /calculateFiscalSummary\s*\(/);
  assert.doesNotMatch(block, /buildFiscalSummaryInput\s*\(/);
});

test("LOT 5.14 validates LOT 5.11 MATCH coverage and intentional MISMATCH remain present", () => {
  assert.match(LOT_5_11_SOURCE, /produces reproducible MATCH evidence/);
  assert.match(LOT_5_11_SOURCE, /detects and preserves MISMATCH without correction/);
  assert.match(LOT_5_11_SOURCE, /service-acre-active/);
  assert.match(LOT_5_11_SOURCE, /service-acre-expired/);
});
