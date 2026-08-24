import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { calculateFiscalSummary } from "../src/domain/calculations/facade/index.js";

const INPUT = Object.freeze({
  revenues: Object.freeze([{ id: "r1", amount: 1000, date: "2026-07-01" }]),
  fiscalProfile: Object.freeze({
    activityType: "services",
    acre: "yes",
    acreStartDate: "2026-01-01",
  }),
  period: Object.freeze({
    startDate: "2026-07-01",
    endDate: "2026-07-31",
  }),
  referenceDate: "2026-07-30",
});

function createWarning(code, domain, field = null, sourceId = null) {
  return {
    code,
    severity: "warning",
    domain,
    field,
    sourceId,
    details: {},
  };
}

function createMockCalculators(calls = []) {
  const revenueResult = {
    total: 1000,
    period: { startDate: "2026-07-01", endDate: "2026-07-31" },
    includedCount: 1,
    excludedCount: 0,
    valid: true,
    warnings: [createWarning("SHARED", "revenue", "x", "same")],
    trace: [{ step: "revenue.total" }],
  };
  const categoryResult = {
    groups: [{ category: "service", total: 1000 }],
    total: 1000,
    warnings: [createWarning("SHARED", "revenue", "x", "same")],
    trace: [{ step: "revenue.category" }],
  };
  const standardResult = {
    baseAmount: 1000,
    activityType: "services",
    rate: 0.22,
    contributionAmount: 220,
    ruleId: "STANDARD",
    rounding: "nearest_euro_math_round",
    calculable: true,
    warnings: [createWarning("STANDARD", "contributions")],
    trace: [{ step: "contributions.standard" }],
  };
  const acreResult = {
    baseAmount: 1000,
    activityType: "services",
    referenceDate: "2026-07-30",
    standardRate: 0.22,
    standardContributionAmount: 220,
    acreApplied: true,
    acreRate: 0.11,
    reductionRate: 0.5,
    acreContributionAmount: 110,
    savedAmount: 110,
    acrePeriod: { startDate: "2026-01-01", endDate: "2027-01-01" },
    acreStatus: "active",
    acreMonthsLeft: 6,
    ruleId: "ACRE",
    rounding: "nearest_euro_math_round",
    calculable: true,
    warnings: [createWarning("ACRE", "acre")],
    trace: [{ step: "acre.legacy" }],
  };

  return {
    calculateRevenueTotal: (revenues, options) => {
      calls.push(["revenueTotal", revenues, options]);
      return revenueResult;
    },
    calculateRevenueForPeriod: (revenues, period, options) => {
      calls.push(["revenuePeriod", revenues, period, options]);
      return revenueResult;
    },
    calculateAnnualRevenueTotal: (revenues, year, options) => {
      calls.push(["revenueAnnual", revenues, year, options]);
      return { ...revenueResult, year };
    },
    calculateRevenueTotalsByCategory: (revenues, options) => {
      calls.push(["revenueCategories", revenues, options]);
      return categoryResult;
    },
    calculateStandardContribution: (input, options) => {
      calls.push(["standardContribution", input, options, standardResult]);
      return standardResult;
    },
    calculateLegacyAcreContribution: (standard, context, options) => {
      calls.push(["acreContribution", standard, context, options]);
      return acreResult;
    },
  };
}

function stripImportsCommentsAndStrings(source) {
  return source
    .replace(/import[\s\S]*?;\n/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/"(?:\\.|[^"\\])*"/g, "")
    .replace(/'(?:\\.|[^'\\])*'/g, "")
    .replace(/`(?:\\.|[^`\\])*`/g, "");
}

test("exports only calculateFiscalSummary from the facade module", async () => {
  const module = await import("../src/domain/calculations/facade/index.js");

  assert.deepEqual(Object.keys(module), ["calculateFiscalSummary"]);
});

test("orchestrates the full pipeline in the expected order", () => {
  const calls = [];
  const result = calculateFiscalSummary(INPUT, {
    ...createMockCalculators(calls),
    trace: true,
  });

  assert.deepEqual(calls.map(([name]) => name), [
    "revenuePeriod",
    "revenueCategories",
    "standardContribution",
    "acreContribution",
  ]);
  assert.equal(result.revenue.total, 1000);
  assert.equal(result.contributions.standard.contributionAmount, 220);
  assert.equal(result.contributions.acre.acreContributionAmount, 110);
  assert.equal(result.summary.finalContributionAmount, 110);
});

test("accepts only the LOT 5.0 top-level input fields", () => {
  assert.throws(
    () =>
      calculateFiscalSummary(
        {
          revenues: [],
          fiscalProfile: {},
          period: {},
          referenceDate: "2026-07-30",
          appState: {},
        },
        createMockCalculators(),
      ),
    /input contains unknown fields/,
  );
});

test("rejects missing required top-level input fields instead of completing them", () => {
  for (const field of ["revenues", "fiscalProfile", "period", "referenceDate"]) {
    const input = structuredClone(INPUT);
    delete input[field];

    assert.throws(
      () => calculateFiscalSummary(input, createMockCalculators()),
      /input is missing required fields/,
    );
  }
});

test("accepts absent options and rejects unknown option fields", () => {
  assert.doesNotThrow(() =>
    calculateFiscalSummary({
      revenues: [],
      fiscalProfile: { activityType: "services", acre: "no" },
      period: {},
      referenceDate: "2026-07-30",
    }),
  );

  assert.throws(
    () =>
      calculateFiscalSummary(INPUT, {
        ...createMockCalculators(),
        extraOption: true,
      }),
    /options contain unknown fields/,
  );
});

test("returns exactly the LOT 5.0 output structure without extra top-level fields", () => {
  const result = calculateFiscalSummary(INPUT, createMockCalculators());

  assert.deepEqual(Object.keys(result), [
    "revenue",
    "contributions",
    "summary",
    "warnings",
    "trace",
  ]);
  assert.deepEqual(Object.keys(result.revenue), ["total", "period", "breakdowns"]);
  assert.deepEqual(Object.keys(result.contributions), ["standard", "final", "acre"]);
  assert.deepEqual(Object.keys(result.summary), [
    "baseAmount",
    "standardContributionAmount",
    "finalContributionAmount",
    "savedAmount",
    "effectiveRate",
    "calculable",
  ]);
});

test("passes revenue total to Contributions without recalculating inside the facade", () => {
  const calls = [];

  calculateFiscalSummary(INPUT, createMockCalculators(calls));

  const standardCall = calls.find(([name]) => name === "standardContribution");
  assert.deepEqual(standardCall[1], {
    baseAmount: 1000,
    activityType: "services",
  });
});

test("passes the standard contribution result and ACRE context to ACRE", () => {
  const calls = [];

  calculateFiscalSummary(INPUT, createMockCalculators(calls));

  const standardCall = calls.find(([name]) => name === "standardContribution");
  const acreCall = calls.find(([name]) => name === "acreContribution");
  assert.equal(acreCall[1], standardCall.at(-1));
  assert.deepEqual(acreCall[2], {
    acre: "yes",
    acreStartDate: "2026-01-01",
    businessStartDate: undefined,
    activityType: "services",
    referenceDate: "2026-07-30",
  });
});

test("uses total revenue when no explicit period is provided", () => {
  const calls = [];

  calculateFiscalSummary(
    {
      ...INPUT,
      period: {},
    },
    createMockCalculators(calls),
  );

  assert.equal(calls[0][0], "revenueTotal");
});

test("uses annual Revenue orchestration when a year period is provided", () => {
  const calls = [];

  calculateFiscalSummary(
    {
      ...INPUT,
      period: { year: 2026 },
    },
    createMockCalculators(calls),
  );

  assert.equal(calls[0][0], "revenueAnnual");
  assert.equal(calls[0][2], 2026);
});

test("deduplicates warnings while preserving provenance fields", () => {
  const result = calculateFiscalSummary(INPUT, createMockCalculators());

  assert.deepEqual(
    result.warnings.map((warning) => `${warning.domain}:${warning.code}`),
    ["revenue:SHARED", "contributions:STANDARD", "acre:ACRE"],
  );
  assert.deepEqual(result.warnings[0], {
    code: "SHARED",
    severity: "warning",
    domain: "revenue",
    field: "x",
    sourceId: "same",
    details: {},
  });
});

test("fuses traces in pipeline order only when trace is enabled", () => {
  const withoutTrace = calculateFiscalSummary(INPUT, createMockCalculators());
  const withTrace = calculateFiscalSummary(INPUT, {
    ...createMockCalculators(),
    trace: true,
  });

  assert.deepEqual(withoutTrace.trace, []);
  assert.deepEqual(
    withTrace.trace.map((entry) => entry.step),
    [
      "revenue.total",
      "revenue.category",
      "contributions.standard",
      "acre.legacy",
    ],
  );
});

test("propagates domain errors without converting them to warnings", () => {
  const error = new Error("domain failure");

  assert.throws(
    () =>
      calculateFiscalSummary(INPUT, {
        ...createMockCalculators(),
        calculateRevenueForPeriod: () => {
          throw error;
        },
      }),
    error,
  );
});

test("stops orchestration when Revenue fails", () => {
  const calls = [];
  const error = new Error("revenue failure");

  assert.throws(
    () =>
      calculateFiscalSummary(INPUT, {
        ...createMockCalculators(calls),
        calculateRevenueForPeriod: () => {
          calls.push(["revenuePeriod"]);
          throw error;
        },
      }),
    error,
  );
  assert.deepEqual(calls.map(([name]) => name), ["revenuePeriod"]);
});

test("stops orchestration when Contributions fails before ACRE", () => {
  const calls = [];
  const error = new Error("contribution failure");

  assert.throws(
    () =>
      calculateFiscalSummary(INPUT, {
        ...createMockCalculators(calls),
        calculateStandardContribution: () => {
          calls.push(["standardContribution"]);
          throw error;
        },
      }),
    error,
  );
  assert.deepEqual(calls.map(([name]) => name), [
    "revenuePeriod",
    "revenueCategories",
    "standardContribution",
  ]);
});

test("propagates ACRE errors after Revenue and Contributions have run", () => {
  const calls = [];
  const error = new Error("acre failure");

  assert.throws(
    () =>
      calculateFiscalSummary(INPUT, {
        ...createMockCalculators(calls),
        calculateLegacyAcreContribution: () => {
          calls.push(["acreContribution"]);
          throw error;
        },
      }),
    error,
  );
  assert.deepEqual(calls.map(([name]) => name), [
    "revenuePeriod",
    "revenueCategories",
    "standardContribution",
    "acreContribution",
  ]);
});

test("does not mutate input, options, warnings or trace arrays returned by domains", () => {
  const calls = [];
  const calculators = createMockCalculators(calls);
  const input = structuredClone(INPUT);
  const options = { ...calculators, trace: true };
  const inputBefore = structuredClone(input);
  const optionsKeysBefore = Object.keys(options);
  const result = calculateFiscalSummary(input, options);

  assert.deepEqual(input, inputBefore);
  assert.deepEqual(Object.keys(options), optionsKeysBefore);
  assert.notEqual(result.warnings, calls[0].at(-1)?.warnings);
  assert.notEqual(result.trace, calls[0].at(-1)?.trace);
});

test("is deterministic for identical input and injected domain results", () => {
  const first = calculateFiscalSummary(INPUT, createMockCalculators());
  const second = calculateFiscalSummary(INPUT, createMockCalculators());

  assert.deepEqual(first, second);
});

test("throws on invalid programming contracts", () => {
  assert.throws(
    () => calculateFiscalSummary(null),
    /expects an input object/,
  );
  assert.throws(
    () => calculateFiscalSummary(INPUT, null),
    /options must be an object/,
  );
  assert.throws(
    () =>
      calculateFiscalSummary(INPUT, {
        ...createMockCalculators(),
        calculateStandardContribution: null,
      }),
    /calculateStandardContribution must be a function/,
  );
});

test("works with real domains without App, Rules direct access or legacy obligations", () => {
  const result = calculateFiscalSummary({
    revenues: [
      { id: "r1", amount: 1000, date: "2026-07-01", revenueCategory: "service" },
    ],
    fiscalProfile: {
      activityType: "services",
      acre: "yes",
      acreStartDate: "2026-07-01",
    },
    period: {
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    },
    referenceDate: "2026-07-30",
  });

  assert.equal(result.revenue.total, 1000);
  assert.equal(result.contributions.standard.baseAmount, 1000);
  assert.equal(result.contributions.acre.baseAmount, 1000);
  assert.equal(result.summary.baseAmount, 1000);
  assert.equal(result.summary.savedAmount >= 0, true);
});

test("architectural guard: facade source contains no direct business calculation", () => {
  const source = readFileSync(
    new URL(
      "../src/domain/calculations/facade/calculateFiscalSummary.js",
      import.meta.url,
    ),
    "utf8",
  );
  const executableSource = stripImportsCommentsAndStrings(source);

  assert.equal(/\bMath\.round\b/.test(executableSource), false);
  assert.equal(/\bgetContributionRule\b/.test(executableSource), false);
  assert.equal(/\bswitch\s*\(/.test(executableSource), false);
  assert.equal(/\bactivityType\b/.test(executableSource), false);
  assert.equal(/\bDate\.now\b/.test(executableSource), false);
  assert.equal(/\bnew\s+Date\b/.test(executableSource), false);
  assert.equal(/\bNumber\s*\(/.test(executableSource), false);
  assert.equal(/\bparseFloat\s*\(/.test(executableSource), false);
  assert.equal(/\bparseInt\s*\(/.test(executableSource), false);
  assert.equal(/\|\|\s*0\b/.test(executableSource), false);
  assert.equal(/\?\?\s*0\b/.test(executableSource), false);
  assert.equal(/[*/%]/.test(executableSource), false);
});
