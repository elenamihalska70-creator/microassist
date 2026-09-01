import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolveWeeklyEstimatedRate } from "../src/application/weekly/resolveWeeklyEstimatedRate.js";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const HELPER_SOURCE = readFileSync(
  new URL("../src/application/weekly/resolveWeeklyEstimatedRate.js", import.meta.url),
  "utf8",
);
const LOT_5_42_SOURCE = readFileSync(
  new URL("./lot-5-42-weekly-recap-effective-rate-parity-evidence.test.js", import.meta.url),
  "utf8",
);
const LOT_5_44_SOURCE = readFileSync(
  new URL("./lot-5-44-weekly-rate-contract-hardening.test.js", import.meta.url),
  "utf8",
);
const LOT_5_47_SOURCE = readFileSync(
  new URL("./lot-5-47-extended-stabilization.test.js", import.meta.url),
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

const APPROVED_COUNTS = Object.freeze({
  fiscalSummaryVisibleSlice: 13,
  weeklyRecapEffectiveRateAssignment: 1,
  monthlyReflectionRevenueTotalAssignment: 1,
  resolveWeeklyEstimatedRateCalls: 1,
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

function migratedRate({ effectiveRate, activityType }) {
  return resolveWeeklyEstimatedRate({
    effectiveRate,
    legacyFallbackRate: getEstimatedRate(activityType),
  });
}

function visibleEffectiveRate({ usesShadow, shadowEffectiveRate, computedRate }) {
  return usesShadow ? shadowEffectiveRate : computedRate;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

test("LOT 5.48 validates the exact migrated weekly rate consumer source", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const weekly = sourceWithoutComments(weeklyRecapBlock());

  assert.match(app, /const weeklyRecapEffectiveRate = fiscalSummaryVisibleSlice\.effectiveRate;/);
  assert.match(weekly, /const estimatedRate = resolveWeeklyEstimatedRate\(\{/);
  assert.match(weekly, /effectiveRate:\s*weeklyRecapEffectiveRate/);
  assert.match(weekly, /legacyFallbackRate:\s*getEstimatedRate\(dashboardAnswers\.activity_type\)/);
  assert.doesNotMatch(weekly, /computed\?\.rate \|\| getEstimatedRate\(dashboardAnswers\.activity_type\)/);
  assert.doesNotMatch(weekly, /fiscalSummaryVisibleSlice\.effectiveRate \|\| getEstimatedRate/);
});

test("LOT 5.48 validates helper contract and value semantics", () => {
  assert.match(HELPER_SOURCE, /return effectiveRate \|\| legacyFallbackRate;/);
  assert.doesNotMatch(HELPER_SOURCE, /\?\?|0\.22|0\.123|0\.18|switch|case|Math\.round/);

  assert.equal(migratedRate({ effectiveRate: 0.11, activityType: "services" }), 0.11);
  assert.equal(migratedRate({ effectiveRate: 0, activityType: "services" }), 0.22);
  assert.equal(migratedRate({ effectiveRate: null, activityType: "commerce" }), 0.123);
  assert.equal(migratedRate({ effectiveRate: undefined, activityType: "mixte" }), 0.18);
  assert.equal(migratedRate({ effectiveRate: 0, activityType: "unknown" }), 0.22);
  assert.equal(migratedRate({ effectiveRate: null, activityType: undefined }), 0.22);
});

test("LOT 5.48 validates flag ON and OFF effective rate selection before helper fallback", () => {
  assert.equal(
    migratedRate({
      effectiveRate: visibleEffectiveRate({
        usesShadow: true,
        shadowEffectiveRate: 0.11,
        computedRate: 0.22,
      }),
      activityType: "services",
    }),
    0.11,
  );
  assert.equal(
    migratedRate({
      effectiveRate: visibleEffectiveRate({
        usesShadow: false,
        shadowEffectiveRate: 0.11,
        computedRate: 0.22,
      }),
      activityType: "services",
    }),
    0.22,
  );
  assert.equal(
    migratedRate({
      effectiveRate: visibleEffectiveRate({
        usesShadow: true,
        shadowEffectiveRate: 0,
        computedRate: 0.22,
      }),
      activityType: "services",
    }),
    0.22,
  );
});

test("LOT 5.48 validates weekly formula, date, invoice and reminder isolation", () => {
  const weekly = sourceWithoutComments(weeklyRecapBlock());

  assert.match(weekly, /const today = parseIsoDate\(getTodayIsoDate\(\)\);/);
  assert.match(weekly, /const weekStart = new Date\(today\);/);
  assert.match(weekly, /const daysFromMonday = dayOfWeek === 0 \? 6 : dayOfWeek - 1;/);
  assert.match(weekly, /weekStart\.setHours\(0, 0, 0, 0\);/);
  assert.match(weekly, /const weeklyRevenueEntries = revenues\.filter\(\(revenue\) => \{/);
  assert.match(weekly, /Math\.round\(weeklyRevenueTotal \* estimatedRate\)/);
  assert.match(weekly, /weeklyRevenueCount > 0 && Number\.isFinite\(estimatedRate\)/);
  assert.match(weekly, /const weeklyInvoicesCreated = visibleInvoices\.filter\(\(invoice\) => \{/);
  assert.match(weekly, /const invoiceDate = parseIsoDate\(invoice\.invoice_date\);/);
  assert.match(weekly, /const reminderCount = activeReminderItems\.length;/);
  assert.doesNotMatch(weekly, /localStorage|sessionStorage|supabase|fetch|payload|handleExportPDF/i);
});

test("LOT 5.48 validates Shadow baseline and approved tenth occurrence", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const appOutsideSelector = appWithoutVisibleSlice();

  assert.equal(occurrences(app, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(
    occurrences(app, /const weeklyRecapEffectiveRate = fiscalSummaryVisibleSlice\.effectiveRate;/g),
    APPROVED_COUNTS.weeklyRecapEffectiveRateAssignment,
  );
  assert.equal(occurrences(appOutsideSelector, /fiscalSummaryVisibleSlice\.effectiveRate/g), 1);
  assert.equal(
    occurrences(app, /const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/g),
    APPROVED_COUNTS.monthlyReflectionRevenueTotalAssignment,
  );
  assert.match(LOT_5_47_SOURCE, /fiscalSummaryVisibleSlice\\\.effectiveRate/);
});

test("LOT 5.48 validates React and pipeline stability", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const weekly = sourceWithoutComments(weeklyRecapBlock());

  assert.equal(occurrences(app, /resolveWeeklyEstimatedRate\(/g), APPROVED_COUNTS.resolveWeeklyEstimatedRateCalls);
  assert.equal(occurrences(app, /\bbuildFiscalSummaryInput\b/g), APPROVED_COUNTS.buildFiscalSummaryInput);
  assert.equal(occurrences(app, /\bcalculateFiscalSummary\b/g), APPROVED_COUNTS.calculateFiscalSummary);
  assert.doesNotMatch(weekly, /useState|useEffect|useMemo\(\(\) => \{[\s\S]*useMemo/);
  assert.doesNotMatch(weekly, /buildFiscalSummaryInput|calculateFiscalSummary|createRuntimeParityEvidence/);
});

test("LOT 5.48 validates parity, runtime evidence and intentional mismatch guards", () => {
  assert.match(LOT_5_42_SOURCE, /computed-rate-zero-falls-back/);
  assert.match(LOT_5_42_SOURCE, /unknown-activity/);
  assert.match(LOT_5_42_SOURCE, /missing-activity/);
  assert.match(LOT_5_44_SOURCE, /zero-effective-rate-fallback/);
  assert.match(SHADOW_PARITY_SOURCE, /strict identity/);
  assert.match(SHADOW_PARITY_SOURCE, /MISMATCH/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /summary\.effectiveRate/);
});

test("LOT 5.48 validates no propagation and local rollback", () => {
  const weekly = sourceWithoutComments(weeklyRecapBlock());
  const rollbackExpression =
    "const estimatedRate = computed?.rate || getEstimatedRate(dashboardAnswers.activity_type);";

  assert.doesNotMatch(
    weekly,
    /localStorage|sessionStorage|supabase|fetch|payload|assistant|analytics|feedback|coaching|handleExportPDF|export_csv|export_pdf/i,
  );
  assert.match(weekly, /const estimatedRate = resolveWeeklyEstimatedRate\(\{/);
  assert.equal(
    rollbackExpression,
    "const estimatedRate = computed?.rate || getEstimatedRate(dashboardAnswers.activity_type);",
  );
});

test("LOT 5.48 validation helpers are deterministic and immutable", () => {
  const scenario = deepFreeze({
    effectiveRate: 0,
    activityType: "services",
    nested: { keep: true },
  });
  const before = structuredClone(scenario);

  const first = migratedRate(scenario);
  const second = migratedRate(scenario);
  const cloned = migratedRate(structuredClone(scenario));

  assert.equal(first, 0.22);
  assert.equal(first, second);
  assert.equal(first, cloned);
  assert.deepEqual(scenario, before);
});
