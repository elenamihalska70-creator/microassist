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

const MATCH = "MATCH";
const MISMATCH = "MISMATCH";

const APPROVED_APP_COUNTS = Object.freeze({
  fiscalSummaryVisibleSlice: 15,
  fiscalSummaryVisibleSliceEffectiveRateConsumers: 1,
});

const CONTRACT_SCENARIOS = Object.freeze([
  {
    id: "positive-effective-rate",
    activityType: "services",
    computedRate: 0.22,
    effectiveRate: 0.22,
    expectedRate: 0.22,
  },
  {
    id: "zero-effective-rate-fallback",
    activityType: "services",
    computedRate: 0,
    effectiveRate: 0,
    expectedRate: 0.22,
  },
  {
    id: "null-effective-rate-fallback",
    activityType: "commerce",
    computedRate: null,
    effectiveRate: null,
    expectedRate: 0.123,
  },
  {
    id: "undefined-effective-rate-fallback",
    activityType: "services",
    computedRate: undefined,
    effectiveRate: undefined,
    expectedRate: 0.22,
  },
  {
    id: "fallback-zero-preserved",
    activityType: "services",
    computedRate: 0,
    effectiveRate: 0,
    fallbackOverride: 0,
    expectedRate: 0,
  },
  {
    id: "service-parity",
    activityType: "services",
    computedRate: 0.22,
    effectiveRate: 0.22,
    expectedRate: 0.22,
  },
  {
    id: "commerce-parity",
    activityType: "commerce",
    computedRate: 0.123,
    effectiveRate: 0.123,
    expectedRate: 0.123,
  },
  {
    id: "mixed-parity",
    activityType: "mixte",
    computedRate: 0.18,
    effectiveRate: 0.18,
    expectedRate: 0.18,
  },
  {
    id: "unknown-activity-parity",
    activityType: "unknown",
    computedRate: 0,
    effectiveRate: 0,
    expectedRate: 0.22,
  },
  {
    id: "missing-activity-parity",
    activityType: undefined,
    computedRate: null,
    effectiveRate: null,
    expectedRate: 0.22,
  },
  {
    id: "acre-inactive-parity",
    activityType: "services",
    computedRate: 0.22,
    effectiveRate: 0.22,
    expectedRate: 0.22,
  },
  {
    id: "acre-active-parity",
    activityType: "services",
    computedRate: 0.11,
    effectiveRate: 0.11,
    expectedRate: 0.11,
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

function legacyWeeklyRate({ computedRate, activityType, fallbackOverride }) {
  const computed = computedRate === undefined ? {} : { rate: computedRate };
  const fallbackRate =
    fallbackOverride === undefined ? getEstimatedRate(activityType) : fallbackOverride;
  return computed?.rate || fallbackRate;
}

function hardenedWeeklyRate({ effectiveRate, activityType, fallbackOverride }) {
  const legacyFallbackRate =
    fallbackOverride === undefined ? getEstimatedRate(activityType) : fallbackOverride;

  return resolveWeeklyEstimatedRate({
    effectiveRate,
    legacyFallbackRate,
  });
}

function compareScenario(scenario) {
  const legacyRate = legacyWeeklyRate(scenario);
  const hardenedRate = hardenedWeeklyRate(scenario);

  return {
    id: scenario.id,
    legacyRate,
    hardenedRate,
    status: Object.is(legacyRate, hardenedRate) ? MATCH : MISMATCH,
  };
}

function compareAll(scenarios = CONTRACT_SCENARIOS) {
  return scenarios.map(compareScenario);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;

  Object.freeze(value);

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return value;
}

test("LOT 5.44 contract helper is pure orchestration only", () => {
  assert.match(HELPER_SOURCE, /return effectiveRate \|\| legacyFallbackRate;/);
  assert.doesNotMatch(HELPER_SOURCE, /0\.22|0\.123|0\.18|switch|case|Math\.round|Math\.max|Math\.min/);
  assert.doesNotMatch(HELPER_SOURCE, /React|useMemo|useState|useEffect|Date|localStorage|sessionStorage|supabase|fetch/);
});

test("LOT 5.44 preserves positive primary effectiveRate", () => {
  assert.equal(
    resolveWeeklyEstimatedRate({ effectiveRate: 0.11, legacyFallbackRate: 0.22 }),
    0.11,
  );
});

test("LOT 5.44 preserves zero, null and undefined fallback semantics", () => {
  assert.equal(resolveWeeklyEstimatedRate({ effectiveRate: 0, legacyFallbackRate: 0.22 }), 0.22);
  assert.equal(resolveWeeklyEstimatedRate({ effectiveRate: null, legacyFallbackRate: 0.123 }), 0.123);
  assert.equal(
    resolveWeeklyEstimatedRate({ effectiveRate: undefined, legacyFallbackRate: 0.18 }),
    0.18,
  );
});

test("LOT 5.44 preserves fallback value including zero", () => {
  assert.equal(resolveWeeklyEstimatedRate({ effectiveRate: 0, legacyFallbackRate: 0 }), 0);
});

test("LOT 5.44 matches Legacy weekly rate contract for all approved scenarios", () => {
  assert.deepEqual(
    compareAll(),
    CONTRACT_SCENARIOS.map(({ id, expectedRate }) => ({
      id,
      legacyRate: expectedRate,
      hardenedRate: expectedRate,
      status: MATCH,
    })),
  );
});

test("LOT 5.44 locks service, commerce, mixed, unknown and missing activity parity", () => {
  const ids = new Set([
    "service-parity",
    "commerce-parity",
    "mixed-parity",
    "unknown-activity-parity",
    "missing-activity-parity",
  ]);
  const results = compareAll().filter(({ id }) => ids.has(id));

  assert.deepEqual(
    results.map(({ id, legacyRate, hardenedRate, status }) => ({
      id,
      legacyRate,
      hardenedRate,
      status,
    })),
    [
      { id: "service-parity", legacyRate: 0.22, hardenedRate: 0.22, status: MATCH },
      { id: "commerce-parity", legacyRate: 0.123, hardenedRate: 0.123, status: MATCH },
      { id: "mixed-parity", legacyRate: 0.18, hardenedRate: 0.18, status: MATCH },
      { id: "unknown-activity-parity", legacyRate: 0.22, hardenedRate: 0.22, status: MATCH },
      { id: "missing-activity-parity", legacyRate: 0.22, hardenedRate: 0.22, status: MATCH },
    ],
  );
});

test("LOT 5.44 locks ACRE inactive and active rate parity", () => {
  const results = compareAll().filter(({ id }) =>
    ["acre-inactive-parity", "acre-active-parity"].includes(id),
  );

  assert.deepEqual(
    results.map(({ id, legacyRate, hardenedRate, status }) => ({
      id,
      legacyRate,
      hardenedRate,
      status,
    })),
    [
      { id: "acre-inactive-parity", legacyRate: 0.22, hardenedRate: 0.22, status: MATCH },
      { id: "acre-active-parity", legacyRate: 0.11, hardenedRate: 0.11, status: MATCH },
    ],
  );
});

test("LOT 5.44 intentional mismatch detection remains visible", () => {
  const result = {
    legacyRate: legacyWeeklyRate({
      computedRate: 0,
      activityType: "services",
    }),
    hardenedRate: resolveWeeklyEstimatedRate({
      effectiveRate: 0,
      legacyFallbackRate: 0.123,
    }),
  };

  assert.equal(result.legacyRate, 0.22);
  assert.equal(result.hardenedRate, 0.123);
  assert.equal(Object.is(result.legacyRate, result.hardenedRate) ? MATCH : MISMATCH, MISMATCH);
});

test("LOT 5.44 same input and cloned input are deterministic", () => {
  const firstRun = compareAll();
  const secondRun = compareAll();
  const clonedRun = compareAll(structuredClone(CONTRACT_SCENARIOS));

  assert.deepEqual(firstRun, secondRun);
  assert.deepEqual(firstRun, clonedRun);
});

test("LOT 5.44 does not mutate inputs", () => {
  const scenario = deepFreeze({
    id: "immutable",
    activityType: "services",
    computedRate: 0,
    effectiveRate: 0,
    expectedRate: 0.22,
    nested: { marker: "keep" },
  });
  const before = structuredClone(scenario);

  compareScenario(scenario);

  assert.deepEqual(scenario, before);
});

test("LOT 5.44 contract has no implicit time, React, persistence or weekly context dependency", () => {
  assert.doesNotMatch(resolveWeeklyEstimatedRate.toString(), /Date\.now|new Date|useMemo|useState|useEffect/);
  assert.doesNotMatch(resolveWeeklyEstimatedRate.toString(), /localStorage|sessionStorage|supabase|fetch/);
  assert.doesNotMatch(resolveWeeklyEstimatedRate.toString(), /weekStart|visibleInvoices|activeReminderItems/);
});

test("LOT 5.44 confirms weekly visible consumer uses the approved hardened contract", () => {
  const weekly = sourceWithoutComments(weeklyRecapBlock());
  const appOutsideSelector = appWithoutVisibleSlice();

  assert.match(APP_SOURCE, /const weeklyRecapEffectiveRate = fiscalSummaryVisibleSlice\.effectiveRate;/);
  assert.match(weekly, /resolveWeeklyEstimatedRate\(\{\s*effectiveRate:\s*weeklyRecapEffectiveRate,\s*legacyFallbackRate:\s*getEstimatedRate\(dashboardAnswers\.activity_type\),\s*\}\)/);
  assert.doesNotMatch(weekly, /computed\?\.rate \|\| getEstimatedRate\(dashboardAnswers\.activity_type\)/);
  assert.equal(occurrences(APP_SOURCE, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_APP_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(
    occurrences(appOutsideSelector, /fiscalSummaryVisibleSlice\.effectiveRate/g),
    APPROVED_APP_COUNTS.fiscalSummaryVisibleSliceEffectiveRateConsumers,
  );
});

test("LOT 5.44 keeps existing source contracts documented and prior evidence intact", () => {
  const weekly = sourceWithoutComments(weeklyRecapBlock());
  const selector = sourceWithoutComments(visibleSliceBlock());
  const fallback = sourceWithoutComments(getEstimatedRateBlock());

  assert.match(weekly, /Math\.round\(weeklyRevenueTotal \* estimatedRate\)/);
  assert.match(selector, /effectiveRate: usesShadow\s*\?\s*shadowResult\.summary\.effectiveRate/);
  assert.match(selector, /:\s*computed\?\.rate/);
  assert.match(fallback, /default:[\s\S]*return 0\.22;/);
  assert.match(LOT_5_42_SOURCE, /computed-rate-zero-falls-back/);
  assert.match(LOT_5_42_SOURCE, /unknown-activity/);
  assert.match(LOT_5_42_SOURCE, /missing-activity/);
});
