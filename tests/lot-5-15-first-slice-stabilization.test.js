import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createRuntimeParityEvidence,
  SHADOW_PARITY_MATCH,
  SHADOW_PARITY_MISMATCH,
} from "../src/application/shadow/runtimeParityEvidence.js";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
const LOT_5_11_SOURCE = readFileSync(
  new URL("./lot-5-11-additional-parity-evidence.test.js", import.meta.url),
  "utf8",
);
const LOT_5_13_SOURCE = readFileSync(
  new URL("./lot-5-13-first-visible-replacement.test.js", import.meta.url),
  "utf8",
);
const LOT_5_14_SOURCE = readFileSync(
  new URL("./lot-5-14-first-visible-replacement-validation.test.js", import.meta.url),
  "utf8",
);

const APPROVED_VISIBLE_FIELDS = Object.freeze([
  "revenueTotal",
  "baseAmount",
  "finalContributionAmount",
  "effectiveRate",
  "acreStatus",
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

function shadowResult({
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

function legacyState() {
  return {
    currentMonthTotal: 1234,
    estimatedCharges: 271,
    computed: {
      rate: 0.22,
      acreStatus: "legacy-inactive",
    },
  };
}

function createEvidence({ legacyAmount = 220, shadowAmount = 220 } = {}) {
  return createRuntimeParityEvidence({
    scenarioId: "lot-5-15-stability-control",
    legacySnapshot: {
      revenueTotal: 1000,
      estimatedAmount: legacyAmount,
      rate: 0.22,
      acreStatus: "inactive",
    },
    shadowResult: shadowResult({
      revenueTotal: 1000,
      baseAmount: 1000,
      finalContributionAmount: shadowAmount,
      effectiveRate: 0.22,
      acreStatus: "inactive",
    }),
    shadowInput: {
      revenues: [{ id: "r1", amount: 1000, date: "2026-07-10" }],
      fiscalProfile: {
        activityType: "services",
        acre: "no",
        acreStartDate: null,
      },
      period: {},
      referenceDate: "2026-07-30",
    },
    observedAt: "LOT_5_15_FIXED_OBSERVATION",
  });
}

test("LOT 5.15 keeps Shadow as the visible source for the approved first slice", () => {
  const selected = selectFirstSlice({
    flagEnabled: true,
    fiscalSummaryShadow: {
      shadowResult: shadowResult({
        revenueTotal: 0,
        baseAmount: 0,
        finalContributionAmount: 0,
        effectiveRate: 0,
        acreStatus: "active",
      }),
    },
    ...legacyState(),
  });

  assert.deepEqual(selected, {
    revenueTotal: 0,
    baseAmount: 0,
    finalContributionAmount: 0,
    effectiveRate: 0,
    acreStatus: "active",
  });
});

test("LOT 5.15 keeps flag OFF rollback to Legacy stable", () => {
  const selected = selectFirstSlice({
    flagEnabled: false,
    fiscalSummaryShadow: {
      shadowResult: shadowResult({
        revenueTotal: 9999,
        baseAmount: 9999,
        finalContributionAmount: 999,
        effectiveRate: 0.99,
        acreStatus: "active",
      }),
    },
    ...legacyState(),
  });

  assert.deepEqual(selected, {
    revenueTotal: 1234,
    baseAmount: 1234,
    finalContributionAmount: 271,
    effectiveRate: 0.22,
    acreStatus: "legacy-inactive",
  });
});

test("LOT 5.15 keeps the fallback tied to global Shadow Result availability only", () => {
  const block = visibleSliceBlock();

  assert.match(block, /Boolean\(shadowResult\)/);
  assert.doesNotMatch(block, /\|\|\s*(currentMonthTotal|estimatedCharges|computed)/);
  assert.doesNotMatch(block, /\?\?\s*(currentMonthTotal|estimatedCharges|computed)/);
  assert.doesNotMatch(block, /shadowResult\.(revenue|summary|contributions)[\s\S]{0,80}\|\|/);
  assert.doesNotMatch(block, /shadowResult\.(revenue|summary|contributions)[\s\S]{0,80}\?\?/);
});

test("LOT 5.15 keeps zero and null Shadow values stable", () => {
  const selected = selectFirstSlice({
    flagEnabled: true,
    fiscalSummaryShadow: {
      shadowResult: shadowResult({
        revenueTotal: 0,
        baseAmount: 0,
        finalContributionAmount: 0,
        effectiveRate: 0,
        acreStatus: null,
      }),
    },
    ...legacyState(),
  });

  assert.equal(selected.revenueTotal, 0);
  assert.equal(selected.baseAmount, 0);
  assert.equal(selected.finalContributionAmount, 0);
  assert.equal(selected.effectiveRate, 0);
  assert.equal(selected.acreStatus, null);
});

test("LOT 5.15 keeps parity deterministic across same input, clone and distinct references", () => {
  const first = createEvidence();
  const second = createEvidence();
  const cloned = createRuntimeParityEvidence(JSON.parse(JSON.stringify({
    scenarioId: "lot-5-15-stability-control",
    legacySnapshot: first.legacySnapshot,
    shadowResult: {
      revenue: { total: first.shadowSnapshot.revenueTotal },
      summary: {
        baseAmount: first.shadowSnapshot.baseAmount,
        finalContributionAmount: first.shadowSnapshot.finalContributionAmount,
        effectiveRate: first.shadowSnapshot.effectiveRate,
      },
      contributions: {
        acre: { acreStatus: first.shadowSnapshot.acreStatus },
      },
    },
    shadowInput: first.reproduction.shadowInput,
    observedAt: first.observedAt,
  })));

  assert.deepEqual(second, first);
  assert.deepEqual(cloned, first);
});

test("LOT 5.15 keeps MISMATCH evidence observable and uncorrected", () => {
  const matchEvidence = createEvidence();
  const mismatchEvidence = createEvidence({ legacyAmount: 999, shadowAmount: 220 });

  assert.equal(matchEvidence.status, SHADOW_PARITY_MATCH);
  assert.equal(mismatchEvidence.status, SHADOW_PARITY_MISMATCH);
  assert.deepEqual(
    mismatchEvidence.checks.map((check) => [check.name, check.status]),
    [
      ["revenue.total", SHADOW_PARITY_MATCH],
      ["summary.baseAmount", SHADOW_PARITY_MATCH],
      ["summary.finalContributionAmount", SHADOW_PARITY_MISMATCH],
      ["summary.effectiveRate", SHADOW_PARITY_MATCH],
      ["acre.status", SHADOW_PARITY_MATCH],
    ],
  );
});

test("LOT 5.15 keeps the selector limited to the approved first-slice fields", () => {
  const block = visibleSliceBlock();

  for (const field of APPROVED_VISIBLE_FIELDS) {
    assert.match(block, new RegExp(`${field}:`));
  }

  assert.doesNotMatch(block, /tva|vat|cfe|deadline|assistant|export|invoice|available|savedAmount|standardContributionAmount/i);
});

test("LOT 5.15 keeps visible dashboard reads isolated to the first slice", () => {
  const block = dashboardDisplayBlock();

  assert.match(block, /fiscalSummaryVisibleSlice\.revenueTotal/);
  assert.match(block, /fiscalSummaryVisibleSlice\.finalContributionAmount/);
  assert.doesNotMatch(block, /fiscalSummaryVisibleSlice\.(baseAmount|effectiveRate|acreStatus|tva|cfe|deadline|assistant|export|invoice|available)/i);
});

test("LOT 5.15 keeps Legacy dependencies available for parity, persistence and rollback", () => {
  assert.match(APP_SOURCE, /const currentMonthTotal = useMemo/);
  assert.match(APP_SOURCE, /const computed = useMemo/);
  assert.match(APP_SOURCE, /const estimatedCharges = useMemo/);
  assert.match(shadowBlock(), /const legacySnapshot = \{/);
  assert.match(shadowBlock(), /revenueTotal: currentMonthTotal/);
  assert.match(shadowBlock(), /estimatedAmount: computed\?\.estimatedAmount/);
  assert.match(visibleSliceBlock(), /: currentMonthTotal/);
  assert.match(visibleSliceBlock(), /: estimatedCharges/);
  assert.match(visibleSliceBlock(), /: computed\?\.rate/);
  assert.match(visibleSliceBlock(), /: computed\?\.acreStatus/);
});

test("LOT 5.15 keeps persistence, payload, export and assistant paths free of Shadow visible selector", () => {
  const appWithoutSelector = APP_SOURCE.replace(visibleSliceBlock(), "");

  assert.doesNotMatch(appWithoutSelector, /fiscalSummaryVisibleSlice[\s\S]{0,180}(supabase|localStorage|sessionStorage|downloadTextFile|generateFacturXXml|generateB2CInvoicePdf|assistant)/i);
  assert.doesNotMatch(appWithoutSelector, /(supabase|localStorage|sessionStorage|downloadTextFile|generateFacturXXml|generateB2CInvoicePdf|assistant)[\s\S]{0,180}fiscalSummaryVisibleSlice/i);
  assert.doesNotMatch(appWithoutSelector, /shadowResult[\s\S]{0,180}(supabase|localStorage|sessionStorage|downloadTextFile|generateFacturXXml|generateB2CInvoicePdf|assistant)/i);
});

test("LOT 5.15 keeps React and calculation stability boundaries", () => {
  const block = visibleSliceBlock();

  assert.equal(occurrences(APP_SOURCE, /calculateFiscalSummary\(/g), 1);
  assert.equal(occurrences(APP_SOURCE, /buildFiscalSummaryInput\(/g), 1);
  assert.match(block, /const fiscalSummaryVisibleSlice = useMemo/);
  assert.doesNotMatch(block, /useState\s*\(/);
  assert.doesNotMatch(block, /useEffect\s*\(/);
  assert.doesNotMatch(block, /calculateFiscalSummary\s*\(/);
  assert.doesNotMatch(block, /buildFiscalSummaryInput\s*\(/);
});

test("LOT 5.15 keeps feature flag deterministic and rollbackable", () => {
  assert.match(
    APP_SOURCE,
    /const FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED = true;/,
  );
  assert.doesNotMatch(APP_SOURCE, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED[\s\S]{0,160}(Date\.now|new Date|Math\.random|localStorage|sessionStorage|supabase|fetch|user)/);
});

test("LOT 5.15 keeps LOT 5.11, LOT 5.13 and LOT 5.14 proof coverage active", () => {
  assert.match(LOT_5_11_SOURCE, /produces reproducible MATCH evidence/);
  assert.match(LOT_5_11_SOURCE, /detects and preserves MISMATCH without correction/);
  assert.match(LOT_5_13_SOURCE, /visible selector maps only the approved first-slice fields/);
  assert.match(LOT_5_14_SOURCE, /validates flag ON reads Shadow/);
  assert.match(LOT_5_14_SOURCE, /validates flag OFF rolls back immediately to Legacy values/);
});
