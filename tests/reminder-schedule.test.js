import test from "node:test";
import assert from "node:assert/strict";
import { calculateNextReminderDate } from "../src/domain/index.js";

// UNIT — deterministic, injected `today`, mirrors the exact arithmetic
// currently used in production (App.jsx `calculateNextReminder`, extracted
// unchanged in LOT 7.6). Expected values are computed with the same Date
// primitives as the function under test so assertions stay timezone-
// independent across CI machines, instead of hardcoding a UTC literal.

// LOT 10.2C: monthly declarers report LAST calendar month's revenue, due by
// the last day of the CURRENT month (previously this function -- like
// obligations.js and deadlineRules.js -- anchored one month too far out,
// so the reminder date could never land close to a real deadline).

test("monthly: returns last day of the current month minus 7 days", () => {
  const today = new Date(2026, 7, 25); // 25 Aug 2026 -> declaring July, due 31 Aug
  const expected = new Date(today.getFullYear(), today.getMonth() + 1, 0); // last day of August 2026
  expected.setDate(expected.getDate() - 7);

  const result = calculateNextReminderDate("mensuel", today);

  assert.equal(result, expected.toISOString());
});

test("monthly: respects leap year (Feb 29) when computing the offset", () => {
  const today = new Date(2028, 1, 15); // 15 Feb 2028 -> declaring January 2028, due end of Feb 2028
  const expected = new Date(today.getFullYear(), today.getMonth() + 1, 0); // last day of Feb 2028
  assert.equal(expected.getDate(), 29);
  expected.setDate(expected.getDate() - 7);

  const result = calculateNextReminderDate("mensuel", today);

  assert.equal(result, expected.toISOString());
});

test("quarterly: Q1 (Jan-Mar) resolves to 30/04 minus 7 days", () => {
  const today = new Date(2026, 1, 10); // Feb 2026 -> Q1
  const expected = new Date(2026, 3, 30);
  expected.setDate(expected.getDate() - 7);

  const result = calculateNextReminderDate("trimestriel", today);

  assert.equal(result, expected.toISOString());
});

test("quarterly: Q4 (Oct-Dec) rolls over into next calendar year (31/01)", () => {
  const today = new Date(2026, 10, 10); // Nov 2026 -> Q4
  const expected = new Date(2027, 0, 31);
  expected.setDate(expected.getDate() - 7);

  const result = calculateNextReminderDate("trimestriel", today);

  assert.equal(result, expected.toISOString());
});

test("unknown or empty frequency returns null", () => {
  const today = new Date(2026, 5, 1);

  assert.equal(calculateNextReminderDate("", today), null);
  assert.equal(calculateNextReminderDate(undefined, today), null);
  assert.equal(calculateNextReminderDate("annuel", today), null);
});

test("defaults `today` to the current date when omitted (production call signature)", () => {
  const before = Date.now();
  const result = calculateNextReminderDate("mensuel");
  const after = Date.now();

  assert.ok(result, "expected a non-null ISO string");
  const resultTime = new Date(result).getTime();
  // Sanity bound only: result must be a plausible near-future date, not a
  // precise value (today is not injected here on purpose).
  assert.ok(resultTime > before - 40 * 24 * 60 * 60 * 1000);
  assert.ok(resultTime < after + 40 * 24 * 60 * 60 * 1000);
});
