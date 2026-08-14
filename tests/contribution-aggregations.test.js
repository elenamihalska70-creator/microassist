import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateAnnualContributionTotal,
  calculateContributionTotal,
  calculateContributionTotalsByActivity,
  calculateContributionsForPeriod,
  calculateMonthlyContributionTotals,
  calculateQuarterlyContributionTotals,
  calculateStandardContribution,
} from "../src/domain/calculations/contributions/index.js";
import { getContributionRule } from "../src/domain/rules/contributionRules.js";
import { computeObligations } from "../src/utils/obligations.js";

function contributionAmount(baseAmount, activityType, options = {}) {
  return calculateStandardContribution(
    {
      baseAmount,
      activityType,
    },
    options,
  ).contributionAmount;
}

function warningCodes(result) {
  return result.warnings.map((warning) => warning.code);
}

const mixedEntries = Object.freeze([
  Object.freeze({
    sourceId: "january-services",
    baseAmount: 1000,
    activityType: "services",
    date: "2028-01-31",
  }),
  Object.freeze({
    sourceId: "february-commerce",
    baseAmount: 1000,
    activityType: "commerce",
    date: "2028-02-29",
  }),
  Object.freeze({
    sourceId: "march-mixte",
    baseAmount: 1000,
    activityType: "mixte",
    date: "2028-03-31",
  }),
  Object.freeze({
    sourceId: "april-services",
    baseAmount: 100,
    activityType: "services",
    date: "2028-04-01",
  }),
  Object.freeze({
    sourceId: "june-commerce",
    baseAmount: 100,
    activityType: "commerce",
    date: "2028-06-30",
  }),
  Object.freeze({
    sourceId: "july-services",
    baseAmount: 100,
    activityType: "services",
    date: "2028-07-01",
  }),
  Object.freeze({
    sourceId: "september-commerce",
    baseAmount: 100,
    activityType: "commerce",
    date: "2028-09-30",
  }),
  Object.freeze({
    sourceId: "october-services",
    baseAmount: 100,
    activityType: "services",
    date: "2028-10-01",
  }),
  Object.freeze({
    sourceId: "december-commerce",
    baseAmount: 100,
    activityType: "commerce",
    date: "2028-12-31",
  }),
  Object.freeze({
    sourceId: "next-year-services",
    baseAmount: 100,
    activityType: "services",
    date: "2029-01-01",
  }),
]);

test("global total handles empty, one and multiple entries", () => {
  assert.deepEqual(calculateContributionTotal([]), {
    totalBaseAmount: 0,
    totalContributionAmount: 0,
    count: 0,
    includedCount: 0,
    excludedCount: 0,
    warnings: [],
    trace: [],
  });

  const one = calculateContributionTotal([
    { baseAmount: 1000, activityType: "services", sourceId: "one" },
  ]);

  assert.equal(one.totalBaseAmount, 1000);
  assert.equal(one.totalContributionAmount, contributionAmount(1000, "services"));
  assert.equal(one.includedCount, 1);

  const many = calculateContributionTotal([
    { baseAmount: 1000, activityType: "services" },
    { baseAmount: 1000, activityType: "commerce" },
    { baseAmount: 0, activityType: "mixte" },
  ]);

  assert.equal(many.totalBaseAmount, 2000);
  assert.equal(
    many.totalContributionAmount,
    contributionAmount(1000, "services") + contributionAmount(1000, "commerce"),
  );
  assert.equal(many.count, 3);
  assert.equal(many.includedCount, 3);
});

test("global total excludes negative, unknown activity and missing rule cases with warnings", () => {
  const result = calculateContributionTotal(
    [
      { sourceId: "valid", baseAmount: 1000, activityType: "services" },
      { sourceId: "zero", baseAmount: 0, activityType: "services" },
      { sourceId: "negative", baseAmount: -100, activityType: "services" },
      { sourceId: "unknown", baseAmount: 1000, activityType: "unknown" },
      { sourceId: "missing-rule", baseAmount: 1000, activityType: "commerce" },
    ],
    {
      resolveContributionRule: ({ activityType }) =>
        activityType === "commerce" ? null : getContributionRule({ activityType }),
    },
  );

  assert.equal(result.count, 5);
  assert.equal(result.includedCount, 2);
  assert.equal(result.excludedCount, 3);
  assert.ok(warningCodes(result).includes("NEGATIVE_CONTRIBUTION_BASE"));
  assert.ok(warningCodes(result).includes("UNKNOWN_ACTIVITY_TYPE"));
  assert.ok(warningCodes(result).includes("CONTRIBUTION_RULE_NOT_FOUND"));
  assert.ok(warningCodes(result).includes("CONTRIBUTION_ENTRY_EXCLUDED"));
});

test("global total supports injected missing rule without changing standard calculator", () => {
  const result = calculateContributionTotal(
    [{ sourceId: "missing", baseAmount: 1000, activityType: "services" }],
    {
      resolveContributionRule: () => null,
    },
  );

  assert.equal(result.totalContributionAmount, 0);
  assert.equal(result.includedCount, 0);
  assert.ok(warningCodes(result).includes("CONTRIBUTION_RULE_NOT_FOUND"));
});

test("period aggregation uses inclusive boundaries and same-day periods", () => {
  const result = calculateContributionsForPeriod(
    mixedEntries,
    { startDate: "2028-01-31", endDate: "2028-02-29" },
  );

  assert.equal(result.includedCount, 2);
  assert.equal(
    result.totalContributionAmount,
    contributionAmount(1000, "services") + contributionAmount(1000, "commerce"),
  );

  const sameDay = calculateContributionsForPeriod(mixedEntries, {
    startDate: "2028-03-31",
    endDate: "2028-03-31",
  });

  assert.equal(sameDay.includedCount, 1);
  assert.equal(sameDay.totalContributionAmount, contributionAmount(1000, "mixte"));
});

test("period aggregation rejects invalid periods and supports month and year changes", () => {
  const invalid = calculateContributionsForPeriod(mixedEntries, {
    startDate: "2028-04-01",
    endDate: "2028-03-31",
  });

  assert.equal(invalid.valid, false);
  assert.ok(warningCodes(invalid).includes("INVALID_CONTRIBUTION_PERIOD_ORDER"));

  const monthChange = calculateContributionsForPeriod(mixedEntries, {
    startDate: "2028-03-31",
    endDate: "2028-04-01",
  });
  const yearChange = calculateContributionsForPeriod(mixedEntries, {
    startDate: "2028-12-31",
    endDate: "2029-01-01",
  });

  assert.equal(monthChange.includedCount, 2);
  assert.equal(yearChange.includedCount, 2);
});

test("period aggregation excludes invalid entry dates with structured warnings", () => {
  const result = calculateContributionsForPeriod(
    [
      { sourceId: "valid", baseAmount: 1000, activityType: "services", date: "2028-01-01" },
      { sourceId: "invalid", baseAmount: 1000, activityType: "services", date: "bad" },
    ],
    { startDate: "2028-01-01", endDate: "2028-01-31" },
  );

  assert.equal(result.includedCount, 1);
  assert.equal(result.excludedCount, 1);
  assert.ok(warningCodes(result).includes("INVALID_CONTRIBUTION_DATE"));
});

test("monthly aggregation returns twelve months including empty months", () => {
  const result = calculateMonthlyContributionTotals(mixedEntries, 2028);

  assert.equal(result.months.length, 12);
  assert.equal(result.months[0].monthKey, "2028-01");
  assert.equal(result.months[1].period.endDate, "2028-02-29");
  assert.equal(result.months[4].contributionAmount, 0);
  assert.equal(result.months[11].monthKey, "2028-12");
  assert.equal(result.months[0].count, 1);
  assert.equal(result.months[11].count, 1);
});

test("monthly aggregation separates years and rejects invalid year", () => {
  const currentYear = calculateMonthlyContributionTotals(mixedEntries, 2028);
  const nextYear = calculateMonthlyContributionTotals(mixedEntries, 2029);
  const invalid = calculateMonthlyContributionTotals(mixedEntries, "bad");

  assert.equal(currentYear.includedCount, mixedEntries.length - 1);
  assert.equal(nextYear.includedCount, 1);
  assert.equal(invalid.valid, false);
  assert.ok(warningCodes(invalid).includes("INVALID_CONTRIBUTION_YEAR"));
});

test("quarterly aggregation returns four calendar quarters with exact boundaries", () => {
  const result = calculateQuarterlyContributionTotals(mixedEntries, 2028);

  assert.equal(result.quarters.length, 4);
  assert.equal(result.quarters[0].period.endDate, "2028-03-31");
  assert.equal(result.quarters[1].period.startDate, "2028-04-01");
  assert.equal(result.quarters[1].period.endDate, "2028-06-30");
  assert.equal(result.quarters[2].period.startDate, "2028-07-01");
  assert.equal(result.quarters[2].period.endDate, "2028-09-30");
  assert.equal(result.quarters[3].period.startDate, "2028-10-01");
  assert.equal(result.quarters[3].period.endDate, "2028-12-31");
  assert.equal(result.quarters[0].count, 3);
  assert.equal(result.quarters[1].count, 2);
  assert.equal(result.quarters[2].count, 2);
  assert.equal(result.quarters[3].count, 2);
});

test("quarterly aggregation rejects invalid year", () => {
  const result = calculateQuarterlyContributionTotals(mixedEntries, null);

  assert.equal(result.valid, false);
  assert.deepEqual(result.quarters, []);
  assert.ok(warningCodes(result).includes("INVALID_CONTRIBUTION_YEAR"));
});

test("annual aggregation handles empty, mixed activities, invalid and injected years", () => {
  const empty = calculateAnnualContributionTotal([], 2028);
  const mixed = calculateAnnualContributionTotal(mixedEntries, 2028);
  const invalid = calculateAnnualContributionTotal(mixedEntries, "bad");

  assert.equal(empty.totalContributionAmount, 0);
  assert.equal(empty.valid, true);
  assert.equal(mixed.year, 2028);
  assert.equal(mixed.includedCount, mixedEntries.length - 1);
  assert.equal(
    mixed.totalContributionAmount,
    calculateMonthlyContributionTotals(mixedEntries, 2028).totalContributionAmount,
  );
  assert.equal(invalid.valid, false);
  assert.ok(warningCodes(invalid).includes("INVALID_CONTRIBUTION_YEAR"));
});

test("activity breakdown preserves activity values without implicit fusion", () => {
  const entries = [
    { baseAmount: 100, activityType: "service" },
    { baseAmount: 100, activityType: "services" },
    { baseAmount: 100, activityType: "vente" },
    { baseAmount: 100, activityType: "commerce" },
    { baseAmount: 100, activityType: "mixed" },
    { baseAmount: 100, activityType: "mixte" },
    { baseAmount: 100, activityType: "unknown" },
  ];
  const result = calculateContributionTotalsByActivity(entries);

  assert.deepEqual(
    result.groups.map((group) => group.activityType),
    ["service", "services", "vente", "commerce", "mixed", "mixte", "unknown"],
  );
  assert.equal(result.groups.length, entries.length);
  assert.equal(result.groups.find((group) => group.activityType === "services").includedCount, 1);
  assert.equal(result.groups.find((group) => group.activityType === "service").includedCount, 0);
});

test("activity breakdown is safe with prototype-sensitive keys", () => {
  const result = calculateContributionTotalsByActivity([
    { baseAmount: 100, activityType: "__proto__" },
    { baseAmount: 100, activityType: "constructor" },
    { baseAmount: 100, activityType: "toString" },
  ]);

  assert.deepEqual(
    result.groups.map((group) => group.activityType),
    ["__proto__", "constructor", "toString"],
  );
  assert.equal({}.polluted, undefined);
});

test("contracts preserve immutability, determinism and trace options", () => {
  const entries = Object.freeze([
    Object.freeze({
      sourceId: "immutable",
      baseAmount: 1000,
      activityType: "services",
      date: "2028-01-01",
    }),
  ]);
  const period = Object.freeze({ startDate: "2028-01-01", endDate: "2028-01-31" });
  const options = Object.freeze({ trace: true });

  const first = calculateContributionsForPeriod(entries, period, options);
  const second = calculateContributionsForPeriod(entries, period, options);
  const withoutTrace = calculateContributionTotal(entries);

  assert.deepEqual(first, second);
  assert.deepEqual(entries, [
    {
      sourceId: "immutable",
      baseAmount: 1000,
      activityType: "services",
      date: "2028-01-01",
    },
  ]);
  assert.deepEqual(period, { startDate: "2028-01-01", endDate: "2028-01-31" });
  assert.deepEqual(options, { trace: true });
  assert.deepEqual(withoutTrace.trace, []);
  assert.ok(first.trace.some((step) => step.step === "contributions.period.aggregate"));
});

test("warnings remain structured and do not include UI or personal payloads", () => {
  const result = calculateContributionTotal([
    {
      sourceId: "private-source",
      baseAmount: "bad",
      activityType: "unknown",
      client: "Client visible only in source",
      note: "private note",
    },
  ]);

  assert.ok(result.warnings.length > 0);

  for (const warning of result.warnings) {
    assert.equal(warning.domain, "contributions");
    assert.ok(["info", "warning", "error"].includes(warning.severity));
    assert.equal(JSON.stringify(warning).includes("Client visible only in source"), false);
    assert.equal(JSON.stringify(warning).includes("private note"), false);
    assert.equal(JSON.stringify(warning).includes("€"), false);
  }
});

test("aggregation parity matches historical standard computeObligations without importing App", () => {
  const entries = [
    { baseAmount: 1000, activityType: "services" },
    { baseAmount: 1000, activityType: "commerce" },
    { baseAmount: 1000, activityType: "mixte" },
    { baseAmount: 1000, activityType: "unknown" },
    { baseAmount: 0, activityType: "services" },
    { baseAmount: 100.5, activityType: "services" },
  ];
  const result = calculateContributionTotal(entries);
  const legacyTotal = entries.reduce((sum, entry) => {
    const legacy = computeObligations({
      activity_type: entry.activityType,
      ca_month: entry.baseAmount,
      acre: "no",
    });

    return sum + legacy.estimatedAmount;
  }, 0);

  assert.equal(result.totalContributionAmount, legacyTotal);
});
