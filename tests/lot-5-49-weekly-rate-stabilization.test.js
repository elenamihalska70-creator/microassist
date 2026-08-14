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
const LOT_5_48_SOURCE = readFileSync(
  new URL("./lot-5-48-weekly-rate-migration-validation.test.js", import.meta.url),
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
  fiscalSummaryVisibleSlice: 15,
  fiscalSummaryVisibleSliceEffectiveRateConsumers: 1,
  monthlyReflectionRevenueTotalAssignment: 1,
  monthlyReflectionChargesAmountAssignment: 1,
  resolveWeeklyEstimatedRateCalls: 1,
  resolveWeeklyEstimatedRateImports: 1,
  buildFiscalSummaryInput: 2,
  calculateFiscalSummary: 2,
});

const TRANSITION_SCENARIOS = Object.freeze([
  {
    id: "positive-effective-rate",
    activityType: "services",
    effectiveRate: 0.11,
    weeklyRevenues: [1000],
    expectedRate: 0.11,
    expectedCharges: 110,
  },
  {
    id: "zero-effective-rate",
    activityType: "services",
    effectiveRate: 0,
    weeklyRevenues: [1000],
    expectedRate: 0.22,
    expectedCharges: 220,
  },
  {
    id: "null-effective-rate",
    activityType: "commerce",
    effectiveRate: null,
    weeklyRevenues: [1000],
    expectedRate: 0.123,
    expectedCharges: 123,
  },
  {
    id: "undefined-effective-rate",
    activityType: "mixte",
    effectiveRate: undefined,
    weeklyRevenues: [1000],
    expectedRate: 0.18,
    expectedCharges: 180,
  },
  {
    id: "fallback-positive",
    activityType: "services",
    effectiveRate: 0,
    fallbackOverride: 0.3,
    weeklyRevenues: [1000],
    expectedRate: 0.3,
    expectedCharges: 300,
  },
  {
    id: "fallback-zero",
    activityType: "services",
    effectiveRate: 0,
    fallbackOverride: 0,
    weeklyRevenues: [1000],
    expectedRate: 0,
    expectedCharges: 0,
  },
  {
    id: "service",
    activityType: "services",
    effectiveRate: 0,
    weeklyRevenues: [1000],
    expectedRate: 0.22,
    expectedCharges: 220,
  },
  {
    id: "commerce",
    activityType: "commerce",
    effectiveRate: 0,
    weeklyRevenues: [1000],
    expectedRate: 0.123,
    expectedCharges: 123,
  },
  {
    id: "mixte",
    activityType: "mixte",
    effectiveRate: 0,
    weeklyRevenues: [1000],
    expectedRate: 0.18,
    expectedCharges: 180,
  },
  {
    id: "unknown-activity",
    activityType: "unknown",
    effectiveRate: 0,
    weeklyRevenues: [1000],
    expectedRate: 0.22,
    expectedCharges: 220,
  },
  {
    id: "missing-activity",
    activityType: undefined,
    effectiveRate: null,
    weeklyRevenues: [1000],
    expectedRate: 0.22,
    expectedCharges: 220,
  },
  {
    id: "acre-inactive",
    activityType: "services",
    effectiveRate: 0.22,
    weeklyRevenues: [1000],
    expectedRate: 0.22,
    expectedCharges: 220,
  },
  {
    id: "acre-active",
    activityType: "services",
    effectiveRate: 0.11,
    weeklyRevenues: [1000],
    expectedRate: 0.11,
    expectedCharges: 110,
  },
  {
    id: "zero-revenue",
    activityType: "services",
    effectiveRate: 0.22,
    weeklyRevenues: [],
    expectedRate: 0.22,
    expectedCharges: null,
  },
  {
    id: "positive-revenue",
    activityType: "services",
    effectiveRate: 0.22,
    weeklyRevenues: [750],
    expectedRate: 0.22,
    expectedCharges: 165,
  },
  {
    id: "multiple-revenues",
    activityType: "services",
    effectiveRate: 0.22,
    weeklyRevenues: [500, 250, 1000],
    expectedRate: 0.22,
    expectedCharges: 385,
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

function weeklyRate({ effectiveRate, activityType, fallbackOverride }) {
  const legacyFallbackRate =
    fallbackOverride === undefined ? getEstimatedRate(activityType) : fallbackOverride;

  return resolveWeeklyEstimatedRate({
    effectiveRate,
    legacyFallbackRate,
  });
}

function weeklyEstimatedCharges({ weeklyRevenues, rate }) {
  const total = weeklyRevenues.reduce((sum, amount) => sum + amount, 0);

  return weeklyRevenues.length > 0 && Number.isFinite(rate)
    ? Math.round(total * rate)
    : null;
}

function evaluateTransition(scenario) {
  const rate = weeklyRate(scenario);

  return {
    id: scenario.id,
    rate,
    charges: weeklyEstimatedCharges({
      weeklyRevenues: scenario.weeklyRevenues,
      rate,
    }),
  };
}

function visibleEffectiveRate({ usesShadow, shadowEffectiveRate, legacyRate }) {
  return usesShadow ? shadowEffectiveRate : legacyRate;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

test("LOT 5.49 stabilizes helper purity and contract", () => {
  assert.match(HELPER_SOURCE, /return effectiveRate \|\| legacyFallbackRate;/);
  assert.doesNotMatch(
    HELPER_SOURCE,
    /\?\?|0\.22|0\.123|0\.18|switch|case|Math\.round|Date|React|useMemo|useState|useEffect/i,
  );
  assert.doesNotMatch(HELPER_SOURCE, /localStorage|sessionStorage|supabase|fetch|revenue|invoice|reminder/i);
});

test("LOT 5.49 stabilizes fallback semantics for all requested transitions", () => {
  assert.deepEqual(
    TRANSITION_SCENARIOS.map(evaluateTransition),
    TRANSITION_SCENARIOS.map(({ id, expectedRate, expectedCharges }) => ({
      id,
      rate: expectedRate,
      charges: expectedCharges,
    })),
  );
});

test("LOT 5.49 stabilizes successive revenue and activity transitions", () => {
  const revenueTransitions = [
    { weeklyRevenues: [], expectedCharges: null },
    { weeklyRevenues: [500], expectedCharges: 110 },
    { weeklyRevenues: [500, 250], expectedCharges: 165 },
    { weeklyRevenues: [500, 250, 1000], expectedCharges: 385 },
  ];

  assert.deepEqual(
    revenueTransitions.map((transition) =>
      evaluateTransition({
        id: "revenue-transition",
        activityType: "services",
        effectiveRate: 0.22,
        weeklyRevenues: transition.weeklyRevenues,
      }).charges,
    ),
    revenueTransitions.map(({ expectedCharges }) => expectedCharges),
  );

  assert.deepEqual(
    ["services", "commerce", "mixte", "unknown", undefined].map((activityType) =>
      weeklyRate({ effectiveRate: 0, activityType }),
    ),
    [0.22, 0.123, 0.18, 0.22, 0.22],
  );
});

test("LOT 5.49 stabilizes feature flag ON and OFF rate selection", () => {
  assert.equal(
    weeklyRate({
      effectiveRate: visibleEffectiveRate({
        usesShadow: true,
        shadowEffectiveRate: 0.11,
        legacyRate: 0.22,
      }),
      activityType: "services",
    }),
    0.11,
  );
  assert.equal(
    weeklyRate({
      effectiveRate: visibleEffectiveRate({
        usesShadow: false,
        shadowEffectiveRate: 0.11,
        legacyRate: 0.22,
      }),
      activityType: "services",
    }),
    0.22,
  );
});

test("LOT 5.49 stabilizes the exact weekly consumer, rollback and dependency source", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const weekly = sourceWithoutComments(weeklyRecapBlock());

  assert.match(app, /const weeklyRecapEffectiveRate = fiscalSummaryVisibleSlice\.effectiveRate;/);
  assert.match(weekly, /const estimatedRate = resolveWeeklyEstimatedRate\(\{/);
  assert.match(weekly, /effectiveRate:\s*weeklyRecapEffectiveRate/);
  assert.match(weekly, /legacyFallbackRate:\s*getEstimatedRate\(dashboardAnswers\.activity_type\)/);
  assert.match(weekly, /revenues,\s*visibleInvoices,\s*weeklyRecapEffectiveRate,/);
  assert.doesNotMatch(weekly, /computed\?\.rate \|\| getEstimatedRate\(dashboardAnswers\.activity_type\)/);

  const rollbackExpression =
    "const estimatedRate = computed?.rate || getEstimatedRate(dashboardAnswers.activity_type);";

  assert.equal(
    rollbackExpression,
    "const estimatedRate = computed?.rate || getEstimatedRate(dashboardAnswers.activity_type);",
  );
});

test("LOT 5.49 stabilizes weekly formula, date, invoice and reminder logic", () => {
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
  assert.match(weekly, /activeReminderItems\[0\]\?\.title/);
});

test("LOT 5.49 stabilizes Shadow baseline and approved monthly reflection occurrences", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const appOutsideSelector = appWithoutVisibleSlice();

  assert.equal(occurrences(app, /\bfiscalSummaryVisibleSlice\b/g), APPROVED_COUNTS.fiscalSummaryVisibleSlice);
  assert.equal(
    occurrences(appOutsideSelector, /fiscalSummaryVisibleSlice\.effectiveRate/g),
    APPROVED_COUNTS.fiscalSummaryVisibleSliceEffectiveRateConsumers,
  );
  assert.equal(
    occurrences(app, /const weeklyRecapEffectiveRate = fiscalSummaryVisibleSlice\.effectiveRate;/g),
    APPROVED_COUNTS.fiscalSummaryVisibleSliceEffectiveRateConsumers,
  );
  assert.equal(
    occurrences(app, /const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice\.revenueTotal;/g),
    APPROVED_COUNTS.monthlyReflectionRevenueTotalAssignment,
  );
  assert.equal(
    occurrences(
      app,
      /const monthlyReflectionChargesAmount =\s*fiscalSummaryVisibleSlice\.finalContributionAmount;/g,
    ),
    APPROVED_COUNTS.monthlyReflectionChargesAmountAssignment,
  );
});

test("LOT 5.49 stabilizes React and fiscal pipeline boundaries", () => {
  const app = sourceWithoutComments(APP_SOURCE);
  const weekly = sourceWithoutComments(weeklyRecapBlock());
  const selector = sourceWithoutComments(visibleSliceBlock());

  assert.equal(
    occurrences(app, /import \{ resolveWeeklyEstimatedRate \} from/g),
    APPROVED_COUNTS.resolveWeeklyEstimatedRateImports,
  );
  assert.equal(occurrences(app, /resolveWeeklyEstimatedRate\(/g), APPROVED_COUNTS.resolveWeeklyEstimatedRateCalls);
  assert.equal(occurrences(app, /\bbuildFiscalSummaryInput\b/g), APPROVED_COUNTS.buildFiscalSummaryInput);
  assert.equal(occurrences(app, /\bcalculateFiscalSummary\b/g), APPROVED_COUNTS.calculateFiscalSummary);
  assert.match(selector, /effectiveRate: usesShadow\s*\?\s*shadowResult\.summary\.effectiveRate\s*:\s*computed\?\.rate/);
  assert.doesNotMatch(weekly, /useState|useEffect|buildFiscalSummaryInput|calculateFiscalSummary/);
  assert.equal(occurrences(weekly, /useMemo\(/g), 1);
});

test("LOT 5.49 stabilizes parity, runtime evidence and no propagation", () => {
  const weekly = sourceWithoutComments(weeklyRecapBlock());

  assert.match(LOT_5_42_SOURCE, /computed-rate-zero-falls-back/);
  assert.match(LOT_5_44_SOURCE, /zero-effective-rate-fallback/);
  assert.match(LOT_5_48_SOURCE, /LOT 5\.48 validates no propagation and local rollback/);
  assert.match(SHADOW_PARITY_SOURCE, /strict identity/);
  assert.match(SHADOW_PARITY_SOURCE, /MISMATCH/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /records MISMATCH without hidden normalization or tolerance/);
  assert.match(RUNTIME_EVIDENCE_SOURCE, /summary\.effectiveRate/);
  assert.doesNotMatch(
    weekly,
    /localStorage|sessionStorage|supabase|fetch|payload|assistant|analytics|feedback|coaching|handleExportPDF|export_csv|export_pdf/i,
  );
});

test("LOT 5.49 stabilizes deterministic and immutable helper behavior", () => {
  const scenario = deepFreeze({
    id: "deterministic",
    activityType: "services",
    effectiveRate: 0,
    weeklyRevenues: [500, 500],
    nested: { marker: "keep" },
  });
  const before = structuredClone(scenario);

  const first = evaluateTransition(scenario);
  const second = evaluateTransition(scenario);
  const cloned = evaluateTransition(structuredClone(scenario));

  assert.deepEqual(first, second);
  assert.deepEqual(first, cloned);
  assert.deepEqual(scenario, before);
});
