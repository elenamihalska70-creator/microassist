import test from "node:test";
import assert from "node:assert/strict";
import { formatAbsoluteFrenchDate } from "../supabase/functions/send-reminder/reminderDateFormat.js";

// UNIT — deliberately does NOT go through `new Date(...)` at any point in
// the implementation (verified by reading the source, not just its output):
// the whole point is to be immune to the runtime's system timezone, which
// is exactly the class of bug empirically demonstrated in LOT 7.8 (a
// Paris-timezone dev machine shifting a UTC-serialized date by one day).

test("normal date formats as day + full French month name + year", () => {
  assert.equal(formatAbsoluteFrenchDate("2026-08-23"), "23 août 2026");
});

test("month boundary: last day of a month", () => {
  assert.equal(formatAbsoluteFrenchDate("2026-01-31"), "31 janvier 2026");
});

test("month boundary: first day of a month", () => {
  assert.equal(formatAbsoluteFrenchDate("2026-02-01"), "1 février 2026");
});

test("year boundary: 31 December", () => {
  assert.equal(formatAbsoluteFrenchDate("2026-12-31"), "31 décembre 2026");
});

test("year boundary: 1 January (next year)", () => {
  assert.equal(formatAbsoluteFrenchDate("2027-01-01"), "1 janvier 2027");
});

test("leap-day date (DST-adjacent, February 29)", () => {
  assert.equal(formatAbsoluteFrenchDate("2028-02-29"), "29 février 2028");
});

test("DST-adjacent date in late March (French spring-forward window)", () => {
  assert.equal(formatAbsoluteFrenchDate("2026-03-29"), "29 mars 2026");
});

test("DST-adjacent date in late October (French fall-back window)", () => {
  assert.equal(formatAbsoluteFrenchDate("2026-10-25"), "25 octobre 2026");
});

test("all 12 months map to their correct French name", () => {
  const expected = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  expected.forEach((name, index) => {
    const month = String(index + 1).padStart(2, "0");
    assert.equal(formatAbsoluteFrenchDate(`2026-${month}-15`), `15 ${name} 2026`);
  });
});

test("malformed input falls back to the raw string rather than throwing", () => {
  assert.equal(formatAbsoluteFrenchDate("not-a-date"), "not-a-date");
  assert.equal(formatAbsoluteFrenchDate(null), "");
  assert.equal(formatAbsoluteFrenchDate(undefined), "");
});
