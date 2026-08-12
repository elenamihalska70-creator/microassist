import test from "node:test";
import assert from "node:assert/strict";

import * as revenueApi from "../src/domain/calculations/revenue/index.js";

const {
  calculateAnnualRevenueTotal,
  calculateMonthlyRevenueTotals,
  calculateQuarterlyRevenueTotals,
  calculateRevenueForPeriod,
  calculateRevenueTotalsByCategory,
} = revenueApi;

function historicalRevenueTotal(revenues) {
  return revenues.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function historicalMonthlyHistory(revenues) {
  const map = {};

  revenues.forEach((item) => {
    if (!item?.date) return;

    const date = new Date(`${item.date}T00:00:00`);
    if (Number.isNaN(date.getTime())) return;

    const key = `${date.getFullYear()}-${date.getMonth()}`;

    if (!map[key]) {
      map[key] = {
        year: date.getFullYear(),
        month: date.getMonth(),
        total: 0,
      };
    }

    map[key].total += Number(item.amount || 0);
  });

  return Object.values(map).sort((a, b) => {
    const first = new Date(a.year, a.month, 1);
    const second = new Date(b.year, b.month, 1);
    return second - first;
  });
}

function historicalMixedBreakdown(revenues) {
  const venteTotal = revenues.reduce((sum, item) => {
    return item?.revenue_category === "vente"
      ? sum + Number(item.amount || 0)
      : sum;
  }, 0);
  const serviceTotal = revenues.reduce((sum, item) => {
    return item?.revenue_category === "service"
      ? sum + Number(item.amount || 0)
      : sum;
  }, 0);

  return { venteTotal, serviceTotal };
}

function getGroup(result, key) {
  return result.groups.find((group) => group.categoryKey === key);
}

test("revenue periods expose the extended public API from the Revenue barrel only", () => {
  assert.deepEqual(Object.keys(revenueApi).sort(), [
    "calculateAnnualRevenueTotal",
    "calculateMonthlyRevenueTotals",
    "calculateQuarterlyRevenueTotals",
    "calculateRevenueForPeriod",
    "calculateRevenueTotal",
    "calculateRevenueTotalsByCategory",
    "filterRevenues",
    "normalizeRevenue",
  ]);
});

test("calculateRevenueForPeriod handles empty revenues and empty period contracts", () => {
  const empty = calculateRevenueForPeriod([], {
    startDate: "2026-01-01",
    endDate: "2026-01-31",
  });
  const invalid = calculateRevenueForPeriod([{ id: "a", amount: 100 }], {});

  assert.equal(empty.total, 0);
  assert.equal(empty.count, 0);
  assert.equal(empty.valid, true);
  assert.equal(invalid.valid, false);
  assert.equal(invalid.total, 0);
  assert.equal(invalid.excludedCount, 1);
  assert.deepEqual(
    invalid.warnings.map((warning) => warning.code),
    ["INVALID_REVENUE_PERIOD_START_DATE", "INVALID_REVENUE_PERIOD_END_DATE"],
  );
});

test("calculateRevenueForPeriod uses inclusive start and end boundaries", () => {
  const revenues = [
    { id: "before", amount: 10, date: "2026-06-30" },
    { id: "start", amount: 20, date: "2026-07-01" },
    { id: "inside", amount: 30, date: "2026-07-15" },
    { id: "end", amount: 40, date: "2026-07-31" },
    { id: "after", amount: 50, date: "2026-08-01" },
  ];
  const result = calculateRevenueForPeriod(revenues, {
    startDate: "2026-07-01",
    endDate: "2026-07-31",
  });

  assert.equal(result.total, 90);
  assert.equal(result.count, 3);
  assert.equal(result.includedCount, 3);
  assert.equal(result.excludedCount, 2);
  assert.deepEqual(result.period, {
    startDate: "2026-07-01",
    endDate: "2026-07-31",
  });
});

test("calculateRevenueForPeriod supports same-day, month and year boundaries", () => {
  const revenues = [
    { id: "same", amount: 100, date: "2026-12-31" },
    { id: "next", amount: 200, date: "2027-01-01" },
  ];

  assert.equal(
    calculateRevenueForPeriod(revenues, {
      startDate: "2026-12-31",
      endDate: "2026-12-31",
    }).total,
    100,
  );
  assert.equal(
    calculateRevenueForPeriod(revenues, {
      startDate: "2026-12-31",
      endDate: "2027-01-01",
    }).total,
    300,
  );
});

test("calculateRevenueForPeriod rejects invalid dates and reversed periods", () => {
  const invalidStart = calculateRevenueForPeriod([], {
    startDate: "2026-02-31",
    endDate: "2026-03-01",
  });
  const invalidEnd = calculateRevenueForPeriod([], {
    startDate: "2026-02-01",
    endDate: "2026-02-31",
  });
  const reversed = calculateRevenueForPeriod([], {
    startDate: "2026-08-01",
    endDate: "2026-07-31",
  });

  assert.equal(invalidStart.warnings[0].code, "INVALID_REVENUE_PERIOD_START_DATE");
  assert.equal(invalidEnd.warnings[0].code, "INVALID_REVENUE_PERIOD_END_DATE");
  assert.equal(reversed.warnings[0].code, "INVALID_REVENUE_PERIOD_ORDER");
});

test("calculateMonthlyRevenueTotals returns twelve calendar months including empty months", () => {
  const revenues = [
    { id: "jan", amount: 100, date: "2026-01-01" },
    { id: "feb-a", amount: 200, date: "2026-02-28" },
    { id: "feb-b", amount: 50, date: "2026-02-15" },
    { id: "dec", amount: 300, date: "2026-12-31" },
    { id: "other-year", amount: 999, date: "2027-01-01" },
  ];
  const result = calculateMonthlyRevenueTotals(revenues, 2026);

  assert.equal(result.months.length, 12);
  assert.deepEqual(result.months[0], {
    month: 1,
    monthKey: "2026-01",
    period: { startDate: "2026-01-01", endDate: "2026-01-31" },
    total: 100,
    count: 1,
    includedCount: 1,
    excludedCount: 0,
  });
  assert.equal(result.months[1].total, 250);
  assert.equal(result.months[2].total, 0);
  assert.equal(result.months[11].total, 300);
  assert.equal(result.total, 650);
  assert.equal(result.includedCount, 4);
  assert.equal(result.excludedCount, 1);
});

test("calculateMonthlyRevenueTotals preserves leap-day and local date-only semantics", () => {
  const result = calculateMonthlyRevenueTotals([
    { id: "leap", amount: 100, date: "2028-02-29" },
    { id: "bad", amount: 100, date: "2026-02-29" },
  ], "2028");

  assert.equal(result.year, 2028);
  assert.equal(result.months[1].period.endDate, "2028-02-29");
  assert.equal(result.months[1].total, 100);
  assert.equal(
    result.warnings.some((warning) => warning.code === "INVALID_REVENUE_DATE"),
    true,
  );
});

test("calculateMonthlyRevenueTotals rejects invalid years without using current date", () => {
  const result = calculateMonthlyRevenueTotals([{ amount: 100 }], "20x6", {
    trace: true,
  });

  assert.equal(result.valid, false);
  assert.equal(result.year, null);
  assert.deepEqual(result.months, []);
  assert.equal(result.warnings[0].code, "INVALID_REVENUE_YEAR");
  assert.equal(result.trace[0].step, "revenue.monthly.validate");
});

test("calculateMonthlyRevenueTotals matches the historical monthly totals for valid dates", () => {
  const revenues = [
    { amount: "100", date: "2026-07-01" },
    { amount: 50, date: "2026-07-31" },
    { amount: -10, date: "2026-08-01" },
    { amount: null, date: "2026-08-02" },
  ];
  const legacy = historicalMonthlyHistory(revenues);
  const result = calculateMonthlyRevenueTotals(revenues, 2026);

  for (const legacyMonth of legacy) {
    const month = result.months[legacyMonth.month];
    assert.equal(month.total, legacyMonth.total);
  }
});

test("calculateQuarterlyRevenueTotals returns four calendar quarters and exact boundaries", () => {
  const revenues = [
    { id: "q1-end", amount: 31, date: "2026-03-31" },
    { id: "q2-start", amount: 40, date: "2026-04-01" },
    { id: "q2-end", amount: 60, date: "2026-06-30" },
    { id: "q3-start", amount: 70, date: "2026-07-01" },
    { id: "q3-end", amount: 90, date: "2026-09-30" },
    { id: "q4-start", amount: 100, date: "2026-10-01" },
    { id: "q4-end", amount: 120, date: "2026-12-31" },
    { id: "next-year", amount: 999, date: "2027-01-01" },
  ];
  const result = calculateQuarterlyRevenueTotals(revenues, 2026);

  assert.equal(result.quarters.length, 4);
  assert.deepEqual(
    result.quarters.map((quarter) => quarter.total),
    [31, 100, 160, 220],
  );
  assert.deepEqual(result.quarters[0].period, {
    startDate: "2026-01-01",
    endDate: "2026-03-31",
  });
  assert.deepEqual(result.quarters[3].period, {
    startDate: "2026-10-01",
    endDate: "2026-12-31",
  });
  assert.equal(result.total, 511);
  assert.equal(result.excludedCount, 1);
});

test("calculateQuarterlyRevenueTotals rejects invalid years", () => {
  const result = calculateQuarterlyRevenueTotals([{ amount: 100 }], 2026.5);

  assert.equal(result.valid, false);
  assert.deepEqual(result.quarters, []);
  assert.equal(result.warnings[0].code, "INVALID_REVENUE_YEAR");
});

test("calculateAnnualRevenueTotal sums only the requested year", () => {
  const revenues = [
    { id: "previous", amount: 1000, date: "2025-12-31" },
    { id: "start", amount: "100.5", date: "2026-01-01" },
    { id: "negative", amount: -25.25, date: "2026-02-01" },
    { id: "leap", amount: 29, date: "2028-02-29" },
    { id: "end", amount: 200, date: "2026-12-31" },
    { id: "next", amount: 300, date: "2027-01-01" },
  ];
  const result = calculateAnnualRevenueTotal(revenues, 2026);

  assert.equal(result.year, 2026);
  assert.equal(result.total, 275.25);
  assert.equal(result.count, 3);
  assert.deepEqual(result.period, {
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  });
});

test("calculateAnnualRevenueTotal handles empty and invalid years", () => {
  assert.equal(calculateAnnualRevenueTotal([], 2026).total, 0);

  const invalid = calculateAnnualRevenueTotal([{ amount: 100 }], null);
  assert.equal(invalid.valid, false);
  assert.equal(invalid.warnings[0].code, "INVALID_REVENUE_YEAR");
});

test("calculateRevenueTotalsByCategory preserves historical categories without implicit mapping", () => {
  const revenues = [
    { id: "service", amount: 100, revenue_category: "service" },
    { id: "services", amount: 200, revenue_category: "services" },
    { id: "vente", amount: 300, revenue_category: "vente" },
    { id: "commerce", amount: 400, revenue_category: "commerce" },
    { id: "mixed", amount: 500, revenue_category: "mixed" },
    { id: "mixte", amount: 600, revenue_category: "mixte" },
    { id: "other", amount: 700, revenue_category: "other" },
    { id: "custom", amount: 800, revenue_category: "custom" },
    { id: "missing", amount: 900 },
  ];
  const result = calculateRevenueTotalsByCategory(revenues);

  assert.equal(getGroup(result, "service").total, 100);
  assert.equal(getGroup(result, "services").total, 200);
  assert.equal(getGroup(result, "vente").total, 300);
  assert.equal(getGroup(result, "commerce").total, 400);
  assert.equal(getGroup(result, "mixed").total, 500);
  assert.equal(getGroup(result, "mixte").total, 600);
  assert.equal(getGroup(result, "other").total, 700);
  assert.equal(getGroup(result, "custom").total, 800);
  assert.equal(getGroup(result, "__missing__").total, 900);
  assert.equal(result.total, 4500);
  assert.equal(
    result.warnings.some((warning) => warning.code === "UNKNOWN_REVENUE_CATEGORY"),
    true,
  );
  assert.equal(
    result.warnings.some((warning) => warning.code === "MISSING_REVENUE_CATEGORY"),
    true,
  );
});

test("calculateRevenueTotalsByCategory applies only explicit category mappings", () => {
  const revenues = [
    { id: "service", amount: 100, revenue_category: "service" },
    { id: "services", amount: 200, revenue_category: "services" },
    { id: "vente", amount: 300, revenue_category: "vente" },
  ];
  const categoryMapping = Object.freeze({ services: "service" });
  const withoutMapping = calculateRevenueTotalsByCategory(revenues);
  const withMapping = calculateRevenueTotalsByCategory(revenues, {
    categoryMapping,
  });

  assert.equal(getGroup(withoutMapping, "service").total, 100);
  assert.equal(getGroup(withoutMapping, "services").total, 200);
  assert.equal(getGroup(withMapping, "service").total, 300);
  assert.deepEqual(categoryMapping, { services: "service" });
});

test("calculateRevenueTotalsByCategory is safe with prototype-sensitive keys", () => {
  const result = calculateRevenueTotalsByCategory([
    { id: "proto", amount: 10, revenue_category: "__proto__" },
    { id: "constructor", amount: 20, revenue_category: "constructor" },
    { id: "to-string", amount: 30, revenue_category: "toString" },
  ]);

  assert.equal(getGroup(result, "__proto__").total, 10);
  assert.equal(getGroup(result, "constructor").total, 20);
  assert.equal(getGroup(result, "toString").total, 30);
  assert.equal(Object.prototype.polluted, undefined);
});

test("category breakdown matches the historical vente/service mixed activity totals", () => {
  const revenues = [
    { amount: 100, revenue_category: "vente" },
    { amount: "50", revenue_category: "vente" },
    { amount: 200, revenue_category: "service" },
    { amount: 300, revenue_category: "commerce" },
  ];
  const legacy = historicalMixedBreakdown(revenues);
  const result = calculateRevenueTotalsByCategory(revenues);

  assert.equal(getGroup(result, "vente").total, legacy.venteTotal);
  assert.equal(getGroup(result, "service").total, legacy.serviceTotal);
});

test("warnings stay structured and do not include UI text or personal payloads", () => {
  const result = calculateRevenueTotalsByCategory([
    {
      id: "bad",
      amount: "bad",
      date: "2026-02-31",
      revenue_category: "unexpected",
      client: "Client visible only in source",
      note: "private note",
    },
    {
      id: "missing",
      amount: 100,
      revenue_category: "",
    },
  ]);

  for (const warning of result.warnings) {
    assert.equal(warning.domain, "revenue");
    assert.ok(["info", "warning", "error"].includes(warning.severity));
    assert.equal(JSON.stringify(warning).includes("Client visible only in source"), false);
    assert.equal(JSON.stringify(warning).includes("private note"), false);
    assert.equal(JSON.stringify(warning).includes("€"), false);
  }
});

test("trace is disabled by default and structured when explicitly requested", () => {
  const withoutTrace = calculateMonthlyRevenueTotals([
    { id: "a", amount: 100, date: "2026-01-01" },
  ], 2026);
  const withTrace = calculateQuarterlyRevenueTotals([
    { id: "a", amount: 100, date: "2026-01-01" },
  ], 2026, {
    trace: true,
  });
  const categoryTrace = calculateRevenueTotalsByCategory([
    { id: "a", amount: 100, revenue_category: "service" },
  ], {
    trace: true,
  });

  assert.deepEqual(withoutTrace.trace, []);
  assert.equal(withTrace.trace.at(-1).step, "revenue.quarterly.aggregate");
  assert.equal(categoryTrace.trace.at(-1).step, "revenue.category.aggregate");
  assert.equal(withTrace.trace.at(-1).domain, "revenue");
});

test("period and breakdown calculations do not mutate source arrays, objects, period or options", () => {
  const revenues = [
    { id: "a", amount: "100", date: "2026-07-01", revenue_category: "service" },
    { id: "b", amount: "-25", date: "2026-07-02", revenue_category: "vente" },
  ];
  const period = { startDate: "2026-07-01", endDate: "2026-07-31" };
  const options = {
    categoryMapping: { services: "service" },
    trace: true,
  };
  const beforeRevenues = structuredClone(revenues);
  const beforePeriod = structuredClone(period);
  const beforeOptions = structuredClone(options);

  calculateRevenueForPeriod(revenues, period, options);
  calculateMonthlyRevenueTotals(revenues, 2026, options);
  calculateQuarterlyRevenueTotals(revenues, 2026, options);
  calculateAnnualRevenueTotal(revenues, 2026, options);
  calculateRevenueTotalsByCategory(revenues, options);

  assert.deepEqual(revenues, beforeRevenues);
  assert.deepEqual(period, beforePeriod);
  assert.deepEqual(options, beforeOptions);
});

test("period calculations preserve the historical total for equivalent valid explicit periods", () => {
  const revenues = [
    { amount: 100, date: "2026-07-01" },
    { amount: "200", date: "2026-07-31" },
    { amount: 500, date: "2026-08-01" },
    { amount: null, date: "2026-07-15" },
  ];
  const legacy = historicalRevenueTotal(revenues.slice(0, 3).slice(0, 2).concat(revenues[3]));
  const result = calculateRevenueForPeriod(revenues, {
    startDate: "2026-07-01",
    endDate: "2026-07-31",
  });

  assert.equal(result.total, legacy);
});
