import test from "node:test";
import assert from "node:assert/strict";

import * as revenueApi from "../src/domain/calculations/revenue/index.js";

const {
  calculateRevenueTotal,
  filterRevenues,
  normalizeRevenue,
} = revenueApi;

function historicalRevenueTotal(revenues) {
  return revenues.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

test("revenue foundations expose only the public API", () => {
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

test("normalizeRevenue converts historical local and Supabase shapes immutably", () => {
  const source = Object.freeze({
    id: "rev-1",
    user_id: "user-1",
    amount: "123,45",
    revenue_date: "2026-07-29",
    revenue_category: "service",
    client: "Client A",
    invoice_id: "INV-1",
    note: "paid",
    created_at: "2026-07-29T10:00:00.000Z",
    unknown_field: "kept",
  });

  const normalized = normalizeRevenue(source);

  assert.equal(normalized.id, "rev-1");
  assert.equal(normalized.userId, "user-1");
  assert.equal(normalized.amount, 123.45);
  assert.equal(normalized.date, "2026-07-29");
  assert.equal(normalized.revenueCategory, "service");
  assert.equal(normalized.invoice, "INV-1");
  assert.equal(normalized.createdAt, "2026-07-29T10:00:00.000Z");
  assert.equal(normalized.unknown_field, "kept");
  assert.deepEqual(normalized.warnings, []);
  assert.equal(source.amount, "123,45");
});

test("normalizeRevenue documents invalid amount and date without fiscal fallback", () => {
  const normalized = normalizeRevenue({
    id: "bad-rev",
    amount: "not-a-number",
    date: "2026-02-31",
    revenue_category: "vente",
  });

  assert.equal(normalized.amount, null);
  assert.equal(normalized.date, null);
  assert.equal(normalized.revenueCategory, "vente");
  assert.equal(normalized.warnings.length, 2);
  assert.equal(normalized.warnings[0].code, "INVALID_REVENUE_AMOUNT");
  assert.equal(normalized.warnings[1].code, "INVALID_REVENUE_DATE");
});

test("filterRevenues returns all normalized revenues by default with no implicit filter", () => {
  const revenues = [
    { id: "valid", amount: 100, date: "2026-07-01" },
    { id: "invalid", amount: "bad", date: "bad-date" },
    { id: "negative", amount: -50, date: "2026-07-02" },
  ];

  const result = filterRevenues(revenues);

  assert.equal(result.includedCount, 3);
  assert.equal(result.excludedCount, 0);
  assert.equal(result.revenues[1].amount, null);
  assert.equal(result.warnings.length, 2);
});

test("filterRevenues can explicitly remove invalid, zero or negative revenues", () => {
  const revenues = [
    { id: "zero", amount: 0, date: "2026-07-01" },
    { id: "positive", amount: 100, date: "2026-07-02" },
    { id: "negative", amount: -50, date: "2026-07-03" },
    { id: "invalid", amount: "bad", date: "2026-07-04" },
  ];

  const result = filterRevenues(revenues, {
    excludeInvalid: true,
    includeNegative: false,
    includeZero: false,
  });

  assert.deepEqual(
    result.revenues.map((revenue) => revenue.id),
    ["positive"],
  );
  assert.equal(result.includedCount, 1);
  assert.equal(result.excludedCount, 3);
  assert.equal(
    result.warnings.some((warning) => warning.code === "REVENUE_EXCLUDED_AS_INVALID"),
    true,
  );
});

test("filterRevenues filters explicitly by category", () => {
  const revenues = [
    { id: "sale", amount: 100, date: "2026-07-01", revenue_category: "vente" },
    { id: "service", amount: 200, date: "2026-07-02", revenue_category: "service" },
    { id: "unset", amount: 300, date: "2026-07-03" },
  ];

  const result = filterRevenues(revenues, { category: "service" });

  assert.deepEqual(
    result.revenues.map((revenue) => revenue.id),
    ["service"],
  );
  assert.equal(result.excludedCount, 2);
});

test("filterRevenues filters explicitly by inclusive local-date period", () => {
  const revenues = [
    { id: "before", amount: 100, date: "2026-06-30" },
    { id: "start", amount: 200, date: "2026-07-01" },
    { id: "inside", amount: 300, date: "2026-07-15" },
    { id: "end", amount: 400, date: "2026-07-31" },
    { id: "after", amount: 500, date: "2026-08-01" },
  ];

  const result = filterRevenues(revenues, {
    period: { from: "2026-07-01", to: "2026-07-31" },
  });

  assert.deepEqual(
    result.revenues.map((revenue) => revenue.id),
    ["start", "inside", "end"],
  );
});

test("calculateRevenueTotal handles empty, one and multiple revenues", () => {
  assert.equal(calculateRevenueTotal([]).total, 0);
  assert.equal(calculateRevenueTotal([{ amount: 100 }]).total, 100);
  assert.equal(
    calculateRevenueTotal([{ amount: 100 }, { amount: 200 }, { amount: "50" }]).total,
    350,
  );
});

test("calculateRevenueTotal preserves zero and negative amount contracts", () => {
  const result = calculateRevenueTotal([
    { id: "zero", amount: 0 },
    { id: "negative", amount: -25 },
    { id: "positive", amount: 100 },
  ]);

  assert.equal(result.total, 75);
  assert.equal(result.includedCount, 3);
  assert.equal(result.excludedCount, 0);
});

test("calculateRevenueTotal excludes invalid values with warnings", () => {
  const result = calculateRevenueTotal([
    { id: "valid", amount: "100" },
    { id: "invalid", amount: "bad" },
  ]);

  assert.equal(result.total, 100);
  assert.equal(result.includedCount, 1);
  assert.equal(result.excludedCount, 1);
  assert.equal(
    result.warnings.some((warning) => warning.code === "INVALID_REVENUE_AMOUNT"),
    true,
  );
});

test("calculateRevenueTotal matches historical App total for equivalent valid cases", () => {
  const revenues = [
    { amount: 0 },
    { amount: 100 },
    { amount: "200" },
    { amount: -50 },
    { amount: null },
    { amount: undefined },
  ];

  assert.equal(calculateRevenueTotal(revenues).total, historicalRevenueTotal(revenues));
});

test("calculateRevenueTotal supports explicit category and period filters", () => {
  const revenues = [
    { id: "a", amount: 100, date: "2026-07-01", revenue_category: "vente" },
    { id: "b", amount: 200, date: "2026-07-15", revenue_category: "service" },
    { id: "c", amount: 300, date: "2026-08-01", revenue_category: "service" },
  ];

  const result = calculateRevenueTotal(revenues, {
    category: "service",
    period: { from: "2026-07-01", to: "2026-07-31" },
  });

  assert.equal(result.total, 200);
  assert.equal(result.includedCount, 1);
  assert.equal(result.excludedCount, 2);
});

test("revenue calculations do not mutate source arrays or objects", () => {
  const revenues = [
    { id: "a", amount: "100", date: "2026-07-01" },
    { id: "b", amount: "200", date: "2026-07-02" },
  ];
  const before = structuredClone(revenues);

  filterRevenues(revenues, {
    period: { from: "2026-07-02", to: "2026-07-31" },
  });
  calculateRevenueTotal(revenues);

  assert.deepEqual(revenues, before);
});

test("revenue trace is empty by default and structured when requested", () => {
  const withoutTrace = calculateRevenueTotal([{ id: "a", amount: 100 }]);
  const withTrace = calculateRevenueTotal([{ id: "a", amount: 100 }], {
    trace: true,
  });

  assert.deepEqual(withoutTrace.trace, []);
  assert.equal(withTrace.trace.length, 1);
  assert.equal(withTrace.trace[0].step, "revenue.filter.include");
  assert.equal(withTrace.trace[0].domain, "revenue");
});
