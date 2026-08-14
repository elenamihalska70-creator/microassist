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

function occurrences(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

function extractVisibleSliceBlock() {
  const start = APP_SOURCE.indexOf("const fiscalSummaryVisibleSlice = useMemo");
  assert.notEqual(start, -1);

  const end = APP_SOURCE.indexOf("  // ==================== PREVIEW", start);
  assert.notEqual(end, -1);

  return APP_SOURCE.slice(start, end);
}

function extractDashboardDisplayBlock() {
  const start = APP_SOURCE.indexOf("const dashboardRevenueDisplay =");
  assert.notEqual(start, -1);

  const end = APP_SOURCE.indexOf("  const dashboardAvailableDisplay =", start);
  assert.notEqual(end, -1);

  return APP_SOURCE.slice(start, end);
}

test("LOT 5.13 defines a local visible replacement feature flag", () => {
  assert.match(
    APP_SOURCE,
    /const FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED = true;/,
  );
  assert.doesNotMatch(APP_SOURCE, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED.*localStorage/);
  assert.doesNotMatch(APP_SOURCE, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED.*supabase/i);
});

test("LOT 5.13 reuses the existing Shadow Facade execution without adding a second one", () => {
  assert.equal(occurrences(APP_SOURCE, /calculateFiscalSummary\(/g), 1);
  assert.match(APP_SOURCE, /const fiscalSummaryShadow = useMemo/);
  assert.match(APP_SOURCE, /return \{\s*shadowInput,\s*shadowResult,\s*shadowParityEvidence,\s*\}/);
});

test("LOT 5.13 visible selector maps only the approved first-slice fields", () => {
  const block = extractVisibleSliceBlock();

  assert.match(block, /fiscalSummaryShadow\?\.shadowResult/);
  assert.match(block, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/);
  assert.match(block, /revenueTotal:[\s\S]*shadowResult\.revenue\.total[\s\S]*currentMonthTotal/);
  assert.match(block, /baseAmount:[\s\S]*shadowResult\.summary\.baseAmount[\s\S]*currentMonthTotal/);
  assert.match(block, /finalContributionAmount:[\s\S]*shadowResult\.summary\.finalContributionAmount[\s\S]*estimatedCharges/);
  assert.match(block, /effectiveRate:[\s\S]*shadowResult\.summary\.effectiveRate[\s\S]*computed\?\.rate/);
  assert.match(block, /acreStatus:[\s\S]*shadowResult\.contributions\.acre\.acreStatus[\s\S]*computed\?\.acreStatus/);
  assert.doesNotMatch(block, /tva|cfe|deadline|assistant|export|invoice/i);
});

test("LOT 5.13 visible dashboard reads use the visible slice values", () => {
  const displayBlock = extractDashboardDisplayBlock();

  assert.match(displayBlock, /getDisplayValue\(fiscalSummaryVisibleSlice\.revenueTotal, "money"\)/);
  assert.match(displayBlock, /fiscalSummaryVisibleSlice\.finalContributionAmount/);
  assert.match(
    APP_SOURCE,
    /Montant à déclarer : \{getDisplayValue\(fiscalSummaryVisibleSlice\.revenueTotal, "money"\)\}/,
  );
  assert.match(APP_SOURCE, /: dashboardChargesDisplay/);
});

test("LOT 5.13 visible replacement block has no state, persistence, payload or export side effect", () => {
  const block = extractVisibleSliceBlock();

  assert.doesNotMatch(block, /\bset[A-Z]\w*\s*\(/);
  assert.doesNotMatch(block, /\blocalStorage\b/);
  assert.doesNotMatch(block, /\bsessionStorage\b/);
  assert.doesNotMatch(block, /\bsupabase\b/i);
  assert.doesNotMatch(block, /\bfetch\s*\(/);
  assert.doesNotMatch(block, /\bdownloadTextFile\b/);
  assert.doesNotMatch(block, /\bgenerateFacturXXml\b/);
  assert.doesNotMatch(block, /\bgenerateB2CInvoicePdf\b/);
});

test("LOT 5.13 does not introduce new rounding, fallback or normalization in the visible selector", () => {
  const block = extractVisibleSliceBlock();

  assert.doesNotMatch(block, /Math\.(round|floor|ceil|abs)/);
  assert.doesNotMatch(block, /Number\s*\(/);
  assert.doesNotMatch(block, /parseFloat\s*\(/);
  assert.doesNotMatch(block, /parseInt\s*\(/);
  assert.doesNotMatch(block, /\|\|\s*0\b/);
  assert.doesNotMatch(block, /\?\?\s*0\b/);
});

test("LOT 5.13 keeps LOT 5.11 MATCH and MISMATCH evidence tests present", () => {
  assert.match(LOT_5_11_SOURCE, /produces reproducible MATCH evidence/);
  assert.match(LOT_5_11_SOURCE, /detects and preserves MISMATCH without correction/);
});

test("LOT 5.13 keeps MATCH and MISMATCH evidence behavior functional", () => {
  const matchEvidence = createRuntimeParityEvidence({
    scenarioId: "lot-5-13-match-control",
    legacySnapshot: {
      revenueTotal: 1000,
      estimatedAmount: 220,
      rate: 0.22,
      acreStatus: "inactive",
    },
    shadowResult: {
      revenue: { total: 1000 },
      summary: {
        baseAmount: 1000,
        finalContributionAmount: 220,
        effectiveRate: 0.22,
      },
      contributions: { acre: { acreStatus: "inactive" } },
    },
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
    observedAt: "LOT_5_13_FIXED_OBSERVATION",
  });

  const mismatchEvidence = createRuntimeParityEvidence({
    ...matchEvidence,
    scenarioId: "lot-5-13-mismatch-control",
    legacySnapshot: {
      ...matchEvidence.legacySnapshot,
      estimatedAmount: 999,
    },
  });

  assert.equal(matchEvidence.status, SHADOW_PARITY_MATCH);
  assert.equal(mismatchEvidence.status, SHADOW_PARITY_MISMATCH);
});
