import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
const RUNTIME_EVIDENCE_SOURCE = readFileSync(
  new URL("./runtime-parity-evidence.test.js", import.meta.url),
  "utf8",
);
const SHADOW_PARITY_SOURCE = readFileSync(
  new URL("./shadow-parity-validation.test.js", import.meta.url),
  "utf8",
);

const MATCH = "MATCH";
const MISMATCH = "MISMATCH";

const APPROVED_APP_COUNTS = Object.freeze({
  fiscalSummaryVisibleSlice: 15,
  fiscalSummaryVisibleSliceEffectiveRateConsumers: 1,
});

const RATE_SCENARIOS = Object.freeze([
  {
    id: "service-standard",
    activityType: "services",
    computedRate: 0.22,
    shadowEffectiveRate: 0.22,
    weeklyRevenueTotal: 1000,
    expectedStatus: MATCH,
    reason: "service rate matches",
  },
  {
    id: "commerce-standard",
    activityType: "commerce",
    computedRate: 0.123,
    shadowEffectiveRate: 0.123,
    weeklyRevenueTotal: 1000,
    expectedStatus: MATCH,
    reason: "commerce rate matches",
  },
  {
    id: "mixed-standard",
    activityType: "mixte",
    computedRate: 0.18,
    shadowEffectiveRate: 0.18,
    weeklyRevenueTotal: 1000,
    expectedStatus: MATCH,
    reason: "mixed rate matches",
  },
  {
    id: "computed-rate-positive-priority",
    activityType: "commerce",
    computedRate: 0.11,
    shadowEffectiveRate: 0.11,
    weeklyRevenueTotal: 1000,
    expectedStatus: MATCH,
    reason: "positive computed rate wins over activity fallback",
  },
  {
    id: "computed-rate-zero-falls-back",
    activityType: "services",
    computedRate: 0,
    shadowEffectiveRate: 0,
    weeklyRevenueTotal: 1000,
    expectedStatus: MISMATCH,
    reason: "legacy || fallback turns zero into services fallback",
  },
  {
    id: "computed-rate-null-commerce-fallback",
    activityType: "commerce",
    computedRate: null,
    shadowEffectiveRate: 0.123,
    weeklyRevenueTotal: 1000,
    expectedStatus: MATCH,
    reason: "legacy null falls back to commerce rate",
  },
  {
    id: "computed-rate-undefined-services-fallback",
    activityType: "services",
    computedRate: undefined,
    shadowEffectiveRate: 0.22,
    weeklyRevenueTotal: 1000,
    expectedStatus: MATCH,
    reason: "legacy undefined falls back to services rate",
  },
  {
    id: "known-activity-alias-vente",
    activityType: "vente",
    computedRate: null,
    shadowEffectiveRate: 0.123,
    weeklyRevenueTotal: 1000,
    expectedStatus: MATCH,
    reason: "legacy vente alias falls back to commerce rate",
  },
  {
    id: "unknown-activity",
    activityType: "unknown",
    computedRate: undefined,
    shadowEffectiveRate: 0,
    weeklyRevenueTotal: 1000,
    expectedStatus: MISMATCH,
    reason: "legacy unknown activity falls back to services while Shadow can expose zero",
  },
  {
    id: "missing-activity",
    activityType: undefined,
    computedRate: undefined,
    shadowEffectiveRate: 0,
    weeklyRevenueTotal: 1000,
    expectedStatus: MISMATCH,
    reason: "legacy missing activity falls back to services while Shadow can expose zero",
  },
  {
    id: "acre-inactive",
    activityType: "services",
    computedRate: 0.22,
    shadowEffectiveRate: 0.22,
    weeklyRevenueTotal: 1000,
    expectedStatus: MATCH,
    reason: "inactive ACRE keeps standard service rate",
  },
  {
    id: "acre-active",
    activityType: "services",
    computedRate: 0.11,
    shadowEffectiveRate: 0.11,
    weeklyRevenueTotal: 1000,
    expectedStatus: MATCH,
    reason: "active ACRE effective rate matches",
  },
  {
    id: "zero-revenue",
    activityType: "services",
    computedRate: 0.22,
    shadowEffectiveRate: 0.22,
    weeklyRevenueTotal: 0,
    expectedStatus: MATCH,
    reason: "rate is independent from weekly revenue amount",
  },
  {
    id: "positive-revenue",
    activityType: "services",
    computedRate: 0.22,
    shadowEffectiveRate: 0.22,
    weeklyRevenueTotal: 750,
    expectedStatus: MATCH,
    reason: "positive weekly revenue does not alter rate",
  },
  {
    id: "multiple-revenues",
    activityType: "services",
    computedRate: 0.22,
    shadowEffectiveRate: 0.22,
    weeklyRevenueTotal: 1750,
    expectedStatus: MATCH,
    reason: "multiple weekly revenues do not alter rate",
  },
]);

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

function getEstimatedRateBlock() {
  return extractBlock("function getEstimatedRate(activityType) {", "function isMixedActivityValue");
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

function legacyRateSource({ computedRate, activityType }) {
  const computed = computedRate === undefined ? {} : { rate: computedRate };
  return computed?.rate || getEstimatedRate(activityType);
}

function shadowRateSource({ shadowEffectiveRate }) {
  return shadowEffectiveRate;
}

function weeklyEstimatedCharges(weeklyRevenueTotal, rate) {
  return Number.isFinite(rate) ? Math.round(weeklyRevenueTotal * rate) : null;
}

function compareRateScenario(scenario) {
  const legacyRate = legacyRateSource(scenario);
  const shadowRate = shadowRateSource(scenario);
  const status = Object.is(legacyRate, shadowRate) ? MATCH : MISMATCH;

  return {
    id: scenario.id,
    legacyRate,
    shadowRate,
    legacyWeeklyCharges: weeklyEstimatedCharges(scenario.weeklyRevenueTotal, legacyRate),
    shadowWeeklyCharges: weeklyEstimatedCharges(scenario.weeklyRevenueTotal, shadowRate),
    status,
    reason: scenario.reason,
  };
}

function compareAll(scenarios = RATE_SCENARIOS) {
  return scenarios.map(compareRateScenario);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;

  Object.freeze(value);

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}

test("LOT 5.42 identifies the migrated weekly rate source while preserving formula", () => {
  const weekly = sourceWithoutComments(weeklyRecapBlock());
  const rateBlock = sourceWithoutComments(getEstimatedRateBlock());

  assert.match(APP_SOURCE, /const weeklyRecapEffectiveRate = fiscalSummaryVisibleSlice\.effectiveRate;/);
  assert.match(weekly, /resolveWeeklyEstimatedRate\(\{/);
  assert.match(weekly, /effectiveRate:\s*weeklyRecapEffectiveRate/);
  assert.match(weekly, /legacyFallbackRate:\s*getEstimatedRate\(dashboardAnswers\.activity_type\)/);
  assert.match(weekly, /Math\.round\(weeklyRevenueTotal \* estimatedRate\)/);
  assert.match(rateBlock, /case "commerce":[\s\S]*return 0\.123;/);
  assert.match(rateBlock, /case "services":[\s\S]*return 0\.22;/);
  assert.match(rateBlock, /return 0\.18;/);
  assert.match(rateBlock, /default:[\s\S]*return 0\.22;/);
});

test("LOT 5.42 identifies the Shadow effectiveRate source with the approved weekly consumer", () => {
  const selector = sourceWithoutComments(visibleSliceBlock());
  const appOutsideSelector = appWithoutVisibleSlice();

  assert.match(selector, /effectiveRate: usesShadow\s*\?\s*shadowResult\.summary\.effectiveRate/);
  assert.match(selector, /:\s*computed\?\.rate/);
  assert.equal(occurrences(APP_SOURCE, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_APP_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(
    occurrences(appOutsideSelector, /fiscalSummaryVisibleSlice\.effectiveRate/g),
    APPROVED_APP_COUNTS.fiscalSummaryVisibleSliceEffectiveRateConsumers,
  );
});

test("LOT 5.42 records service, commerce and mixed MATCH evidence", () => {
  const results = compareAll().filter(({ id }) =>
    ["service-standard", "commerce-standard", "mixed-standard"].includes(id),
  );

  assert.deepEqual(
    results.map(({ id, legacyRate, shadowRate, status }) => ({ id, legacyRate, shadowRate, status })),
    [
      { id: "service-standard", legacyRate: 0.22, shadowRate: 0.22, status: MATCH },
      { id: "commerce-standard", legacyRate: 0.123, shadowRate: 0.123, status: MATCH },
      { id: "mixed-standard", legacyRate: 0.18, shadowRate: 0.18, status: MATCH },
    ],
  );
});

test("LOT 5.42 preserves computed.rate positive priority over activity fallback", () => {
  const result = compareRateScenario({
    id: "positive-priority",
    activityType: "commerce",
    computedRate: 0.11,
    shadowEffectiveRate: 0.11,
    weeklyRevenueTotal: 1000,
    reason: "positive computed rate wins",
  });

  assert.equal(result.legacyRate, 0.11);
  assert.equal(result.shadowRate, 0.11);
  assert.equal(result.status, MATCH);
});

test("LOT 5.42 characterizes computed.rate zero behavior as Legacy fallback", () => {
  const result = compareAll().find(({ id }) => id === "computed-rate-zero-falls-back");

  assert.equal(result.legacyRate, 0.22);
  assert.equal(result.shadowRate, 0);
  assert.equal(result.status, MISMATCH);
  assert.equal(result.legacyWeeklyCharges, 220);
  assert.equal(result.shadowWeeklyCharges, 0);
});

test("LOT 5.42 characterizes null and undefined behavior", () => {
  const results = compareAll().filter(({ id }) =>
    ["computed-rate-null-commerce-fallback", "computed-rate-undefined-services-fallback"].includes(id),
  );

  assert.deepEqual(
    results.map(({ id, legacyRate, shadowRate, status }) => ({ id, legacyRate, shadowRate, status })),
    [
      { id: "computed-rate-null-commerce-fallback", legacyRate: 0.123, shadowRate: 0.123, status: MATCH },
      { id: "computed-rate-undefined-services-fallback", legacyRate: 0.22, shadowRate: 0.22, status: MATCH },
    ],
  );
});

test("LOT 5.42 characterizes known alias, unknown activity and missing activity", () => {
  const results = compareAll().filter(({ id }) =>
    ["known-activity-alias-vente", "unknown-activity", "missing-activity"].includes(id),
  );

  assert.deepEqual(
    results.map(({ id, legacyRate, shadowRate, status }) => ({ id, legacyRate, shadowRate, status })),
    [
      { id: "known-activity-alias-vente", legacyRate: 0.123, shadowRate: 0.123, status: MATCH },
      { id: "unknown-activity", legacyRate: 0.22, shadowRate: 0, status: MISMATCH },
      { id: "missing-activity", legacyRate: 0.22, shadowRate: 0, status: MISMATCH },
    ],
  );
});

test("LOT 5.42 characterizes ACRE inactive and active effective rate parity", () => {
  const results = compareAll().filter(({ id }) => ["acre-inactive", "acre-active"].includes(id));

  assert.deepEqual(
    results.map(({ id, legacyRate, shadowRate, status }) => ({ id, legacyRate, shadowRate, status })),
    [
      { id: "acre-inactive", legacyRate: 0.22, shadowRate: 0.22, status: MATCH },
      { id: "acre-active", legacyRate: 0.11, shadowRate: 0.11, status: MATCH },
    ],
  );
});

test("LOT 5.42 isolates rate parity from weekly revenue amount", () => {
  const results = compareAll().filter(({ id }) =>
    ["zero-revenue", "positive-revenue", "multiple-revenues"].includes(id),
  );

  assert.deepEqual(
    results.map(({ id, legacyRate, shadowRate, status }) => ({ id, legacyRate, shadowRate, status })),
    [
      { id: "zero-revenue", legacyRate: 0.22, shadowRate: 0.22, status: MATCH },
      { id: "positive-revenue", legacyRate: 0.22, shadowRate: 0.22, status: MATCH },
      { id: "multiple-revenues", legacyRate: 0.22, shadowRate: 0.22, status: MATCH },
    ],
  );
});

test("LOT 5.42 intentional mismatches remain visible without normalization", () => {
  const mismatches = compareAll().filter(({ status }) => status === MISMATCH);

  assert.deepEqual(
    mismatches.map(({ id, legacyRate, shadowRate, status }) => ({ id, legacyRate, shadowRate, status })),
    [
      { id: "computed-rate-zero-falls-back", legacyRate: 0.22, shadowRate: 0, status: MISMATCH },
      { id: "unknown-activity", legacyRate: 0.22, shadowRate: 0, status: MISMATCH },
      { id: "missing-activity", legacyRate: 0.22, shadowRate: 0, status: MISMATCH },
    ],
  );
});

test("LOT 5.42 same input, cloned input and different references are deterministic", () => {
  const firstRun = compareAll();
  const secondRun = compareAll();
  const clonedRun = compareAll(structuredClone(RATE_SCENARIOS));
  const differentReferences = compareAll(RATE_SCENARIOS.map((scenario) => ({ ...scenario })));

  assert.deepEqual(firstRun, secondRun);
  assert.deepEqual(firstRun, clonedRun);
  assert.deepEqual(firstRun, differentReferences);
});

test("LOT 5.42 does not mutate Legacy or Shadow inputs", () => {
  const scenario = deepFreeze({
    id: "immutable",
    activityType: "services",
    computedRate: 0.22,
    shadowEffectiveRate: 0.22,
    weeklyRevenueTotal: 1000,
    expectedStatus: MATCH,
    reason: "immutability proof",
    invoices: [{ id: "invoice-1", status: "unpaid" }],
    reminders: [{ id: "reminder-1", urgent: true }],
  });
  const before = structuredClone(scenario);

  compareRateScenario(scenario);

  assert.deepEqual(scenario, before);
});

test("LOT 5.42 rate evidence has no implicit time, persistence, invoice or reminder dependency", () => {
  const weekly = sourceWithoutComments(weeklyRecapBlock());

  assert.match(weekly, /const today = parseIsoDate\(getTodayIsoDate\(\)\);/);
  assert.match(weekly, /const weeklyInvoicesCreated = visibleInvoices\.filter/);
  assert.match(weekly, /const reminderCount = activeReminderItems\.length/);
  assert.doesNotMatch(compareRateScenario.toString(), /Date\.now|new Date|localStorage|sessionStorage|supabase|fetch/i);
  assert.doesNotMatch(legacyRateSource.toString(), /Date\.now|new Date|localStorage|sessionStorage|supabase|fetch/i);
  assert.doesNotMatch(shadowRateSource.toString(), /Date\.now|new Date|localStorage|sessionStorage|supabase|fetch/i);
});

test("LOT 5.42 parity and runtime evidence mechanisms remain intact", () => {
  assert.match(SHADOW_PARITY_SOURCE, /strict identity/);
  assert.match(SHADOW_PARITY_SOURCE, /MISMATCH/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /summary\.effectiveRate/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
});

test("LOT 5.42 does not add persistence, payload, export, assistant or an extra Shadow consumer", () => {
  const weekly = sourceWithoutComments(weeklyRecapBlock());
  const appOutsideSelector = appWithoutVisibleSlice();

  assert.doesNotMatch(weekly, /localStorage|sessionStorage|supabase|fetch|payload|assistant|handleExportPDF/i);
  assert.equal(occurrences(APP_SOURCE, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_APP_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(
    occurrences(appOutsideSelector, /fiscalSummaryVisibleSlice\.effectiveRate/g),
    APPROVED_APP_COUNTS.fiscalSummaryVisibleSliceEffectiveRateConsumers,
  );
});
