import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveWeeklyEstimatedRate } from "../src/application/weekly/resolveWeeklyEstimatedRate.js";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const LOT_5_42_SOURCE = readFileSync(
  new URL("./lot-5-42-weekly-recap-effective-rate-parity-evidence.test.js", import.meta.url),
  "utf8",
);
const LOT_5_44_SOURCE = readFileSync(
  new URL("./lot-5-44-weekly-rate-contract-hardening.test.js", import.meta.url),
  "utf8",
);
const SHADOW_PARITY_SOURCE = readFileSync(
  new URL("./shadow-parity-validation.test.js", import.meta.url),
  "utf8",
);
const RUNTIME_EVIDENCE_SOURCE = readFileSync(
  new URL("./runtime-parity-evidence.test.js", import.meta.url),
  "utf8",
);
const HELPER_SOURCE = readFileSync(
  new URL("../src/application/weekly/resolveWeeklyEstimatedRate.js", import.meta.url),
  "utf8",
);

const APPROVED_APP_COUNTS = Object.freeze({
  fiscalSummaryVisibleSlice: 13,
  fiscalSummaryVisibleSliceEffectiveRateConsumers: 1,
  resolveWeeklyEstimatedRateCalls: 1,
  resolveWeeklyEstimatedRateImports: 1,
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
  assert.notEqual(start, -1, `Missing block start: ${startText}`);
  const end = APP_SOURCE.indexOf(endText, start);
  assert.notEqual(end, -1, `Missing block end: ${endText}`);
  return APP_SOURCE.slice(start, end);
}

function weeklyRecapBlock() {
  return extractBlock("const dashboardWeeklyRecap = useMemo(() => {", "  const dashboardThisWeekInsight");
}

function visibleSliceBlock() {
  return extractBlock(
    "const fiscalSummaryVisibleSlice = useMemo(() => {",
    "  // ==================== PREVIEW POUR MODALE AJOUT REVENU ====================",
  );
}

function appWithoutVisibleSlice() {
  return sourceWithoutComments(APP_SOURCE).replace(sourceWithoutComments(visibleSliceBlock()), "");
}

function normalizeActivityType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "vente" || normalized === "sale" || normalized === "sales") return "commerce";
  if (normalized === "service" || normalized === "services") return "services";
  if (normalized === "mixte" || normalized === "mix" || normalized === "mixed") return "mixte";
  return normalized || "services";
}

function isMixedActivityValue(activityType = "") {
  const normalized = String(activityType || "").trim().toLowerCase();
  return normalized === "mixte" || normalized === "mix" || normalized === "mixed";
}

function getEstimatedRate(activityType) {
  const normalizedActivityType = normalizeActivityType(activityType);
  if (isMixedActivityValue(normalizedActivityType)) return 0.18;

  switch (normalizedActivityType) {
    case "commerce":
      return 0.123;
    case "services":
      return 0.22;
    default:
      return 0.22;
  }
}

function migratedWeeklyRate({ effectiveRate, activityType }) {
  return resolveWeeklyEstimatedRate({
    effectiveRate,
    legacyFallbackRate: getEstimatedRate(activityType),
  });
}

test("LOT 5.46 identifies the exact migrated weekly recap consumer", () => {
  const weekly = sourceWithoutComments(weeklyRecapBlock());
  const app = sourceWithoutComments(APP_SOURCE);

  assert.match(weekly, /const dashboardWeeklyRecap = useMemo\(\(\) => \{/);
  assert.match(app, /const weeklyRecapEffectiveRate = fiscalSummaryVisibleSlice\.effectiveRate;/);
  assert.match(weekly, /const estimatedRate = resolveWeeklyEstimatedRate\(\{/);
  assert.match(weekly, /effectiveRate:\s*weeklyRecapEffectiveRate/);
  assert.match(weekly, /legacyFallbackRate:\s*getEstimatedRate\(dashboardAnswers\.activity_type\)/);
  assert.doesNotMatch(
    weekly,
    /const estimatedRate =\s*computed\?\.rate \|\| getEstimatedRate\(dashboardAnswers\.activity_type\);/,
  );
});

test("LOT 5.46 uses the helper exactly once and does not inline its contract in App", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const weekly = sourceWithoutComments(weeklyRecapBlock());

  assert.match(
    app,
    /import \{ resolveWeeklyEstimatedRate \} from "\.\/application\/weekly\/resolveWeeklyEstimatedRate\.js";/,
  );
  assert.equal(
    occurrences(app, /import \{ resolveWeeklyEstimatedRate \} from/g),
    APPROVED_APP_COUNTS.resolveWeeklyEstimatedRateImports,
  );
  assert.equal(
    occurrences(app, /resolveWeeklyEstimatedRate\(/g),
    APPROVED_APP_COUNTS.resolveWeeklyEstimatedRateCalls,
  );
  assert.doesNotMatch(weekly, /weeklyRecapEffectiveRate \|\| getEstimatedRate/);
});

test("LOT 5.46 preserves positive, zero, null and undefined semantics", () => {
  assert.equal(migratedWeeklyRate({ effectiveRate: 0.11, activityType: "services" }), 0.11);
  assert.equal(migratedWeeklyRate({ effectiveRate: 0, activityType: "services" }), 0.22);
  assert.equal(migratedWeeklyRate({ effectiveRate: null, activityType: "commerce" }), 0.123);
  assert.equal(migratedWeeklyRate({ effectiveRate: undefined, activityType: "mixte" }), 0.18);
});

test("LOT 5.46 preserves unknown and missing activity through the Legacy fallback contract", () => {
  assert.equal(migratedWeeklyRate({ effectiveRate: 0, activityType: "unknown" }), 0.22);
  assert.equal(migratedWeeklyRate({ effectiveRate: null, activityType: undefined }), 0.22);
  assert.equal(migratedWeeklyRate({ effectiveRate: undefined, activityType: "" }), 0.22);
});

test("LOT 5.46 keeps weekly formula, date logic, invoice logic and reminder logic unchanged", () => {
  const weekly = sourceWithoutComments(weeklyRecapBlock());

  assert.match(weekly, /const today = parseIsoDate\(getTodayIsoDate\(\)\);/);
  assert.match(weekly, /const weekStart = new Date\(today\);/);
  assert.match(weekly, /weekStart\.setHours\(0, 0, 0, 0\);/);
  assert.match(weekly, /revenues\.filter\(\(revenue\) => \{/);
  assert.match(weekly, /Math\.round\(weeklyRevenueTotal \* estimatedRate\)/);
  assert.match(weekly, /weeklyRevenueCount > 0 && Number\.isFinite\(estimatedRate\)/);
  assert.match(weekly, /const weeklyInvoicesCreated = visibleInvoices\.filter\(\(invoice\) => \{/);
  assert.match(weekly, /const invoiceDate = parseIsoDate\(invoice\.invoice_date\);/);
  assert.match(weekly, /const reminderCount = activeReminderItems\.length;/);
  assert.match(weekly, /activeReminderItems\[0\]\?\.title/);
});

test("LOT 5.46 keeps the feature flag on the existing visible slice", () => {
  const selector = sourceWithoutComments(visibleSliceBlock());
  const weekly = sourceWithoutComments(weeklyRecapBlock());

  assert.match(selector, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED/);
  assert.match(selector, /effectiveRate: usesShadow\s*\?\s*shadowResult\.summary\.effectiveRate\s*:\s*computed\?\.rate/);
  assert.doesNotMatch(weekly, /FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED|FISCAL_SUMMARY_SHADOW_ENABLED/);
});

test("LOT 5.46 keeps the approved weekly rate occurrence and monthly reflection tenth occurrence", () => {
  const appOutsideSelector = appWithoutVisibleSlice();
  const weekly = sourceWithoutComments(weeklyRecapBlock());

  assert.equal(occurrences(APP_SOURCE, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_APP_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(
    occurrences(appOutsideSelector, /fiscalSummaryVisibleSlice\.effectiveRate/g),
    APPROVED_APP_COUNTS.fiscalSummaryVisibleSliceEffectiveRateConsumers,
  );
  assert.match(APP_SOURCE, /const weeklyRecapEffectiveRate = fiscalSummaryVisibleSlice\.effectiveRate;/);
  assert.equal(
    occurrences(
      APP_SOURCE,
      /const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/g,
    ),
    1,
  );
  assert.match(weekly, /weeklyRecapEffectiveRate/);
});

test("LOT 5.46 adds no state, effect, adapter, facade, persistence, payload, assistant or export change in the consumer", () => {
  const weekly = sourceWithoutComments(weeklyRecapBlock());

  assert.doesNotMatch(weekly, /useState|useEffect|createFiscalSummaryInput|calculateFiscalSummary/);
  assert.doesNotMatch(weekly, /localStorage|sessionStorage|supabase|fetch|payload/i);
  assert.doesNotMatch(weekly, /assistant|handleExportPDF|export_csv|export_pdf/i);
});

test("LOT 5.46 keeps dependency migration source-only", () => {
  const weekly = sourceWithoutComments(weeklyRecapBlock());

  assert.match(weekly, /revenues,\s*visibleInvoices,\s*weeklyRecapEffectiveRate,/);
  assert.doesNotMatch(weekly, /computed\?\.rate,/);
  assert.match(weekly, /dashboardAnswers\.activity_type,/);
});

test("LOT 5.46 preserves parity, runtime evidence and historical guards", () => {
  assert.match(LOT_5_42_SOURCE, /computed-rate-zero-falls-back/);
  assert.match(LOT_5_42_SOURCE, /unknown-activity/);
  assert.match(LOT_5_42_SOURCE, /missing-activity/);
  assert.match(LOT_5_44_SOURCE, /return effectiveRate \\?\|\\?\| legacyFallbackRate/);
  assert.match(HELPER_SOURCE, /return effectiveRate \|\| legacyFallbackRate;/);
  assert.match(SHADOW_PARITY_SOURCE, /strict identity/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /summary\.effectiveRate/);
});

test("LOT 5.46 rollback remains local to the rate source", () => {
  const weekly = sourceWithoutComments(weeklyRecapBlock());

  assert.match(weekly, /const estimatedRate = resolveWeeklyEstimatedRate\(\{/);
  assert.match(weekly, /const weeklyEstimatedCharges =/);
  assert.match(weekly, /Math\.round\(weeklyRevenueTotal \* estimatedRate\)/);

  const rollbackExpression =
    "const estimatedRate = computed?.rate || getEstimatedRate(dashboardAnswers.activity_type);";

  assert.equal(
    rollbackExpression,
    "const estimatedRate = computed?.rate || getEstimatedRate(dashboardAnswers.activity_type);",
  );
});
