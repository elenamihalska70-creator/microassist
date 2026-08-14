import test from "node:test";
import assert from "node:assert/strict";

import {
  ADD_MONTH_POLICIES,
  MONEY_INVALID_VALUE_POLICIES,
  MONEY_ROUNDING_STRATEGIES,
  addCalendarDays,
  addCalendarMonths,
  areMoneyValuesEqual,
  clampNonNegative,
  compareLocalDates,
  daysInMonth,
  differenceInCalendarDays,
  endOfLocalMonth,
  formatLocalDate,
  isFiniteMoneyValue,
  isLeapYear,
  isValidLocalDateString,
  multiplyMoneyByRate,
  normalizeMoney,
  parseLocalDate,
  parseMoneyValue,
  requireReferenceDate,
  roundEuro,
  roundMoney,
  startOfLocalDay,
  startOfLocalMonth,
  sumMoney,
  toFiniteNumberOrZero,
} from "../src/domain/index.js";

function dateOnly(date) {
  return formatLocalDate(date);
}

test("money primitives identify finite numeric values without formatting", () => {
  assert.equal(isFiniteMoneyValue(0), true);
  assert.equal(isFiniteMoneyValue(42), true);
  assert.equal(isFiniteMoneyValue(-42), true);
  assert.equal(isFiniteMoneyValue(12.34), true);
  assert.equal(isFiniteMoneyValue("123"), true);
  assert.equal(isFiniteMoneyValue(" 123 "), true);
  assert.equal(isFiniteMoneyValue("123,45"), false);
  assert.equal(isFiniteMoneyValue("123,45", { allowDecimalComma: true }), true);
  assert.equal(isFiniteMoneyValue(""), false);
  assert.equal(isFiniteMoneyValue(null), false);
  assert.equal(isFiniteMoneyValue(undefined), false);
  assert.equal(isFiniteMoneyValue(Number.NaN), false);
  assert.equal(isFiniteMoneyValue(Infinity), false);
  assert.equal(isFiniteMoneyValue(-Infinity), false);
  assert.equal(isFiniteMoneyValue({}), false);
  assert.equal(isFiniteMoneyValue([]), true);
});

test("parseMoneyValue exposes invalid-value policies explicitly", () => {
  assert.equal(parseMoneyValue("12.5"), 12.5);
  assert.equal(parseMoneyValue("12,5", { allowDecimalComma: true }), 12.5);
  assert.equal(parseMoneyValue(""), null);
  assert.equal(parseMoneyValue(null), null);
  assert.equal(parseMoneyValue(undefined), null);
  assert.equal(parseMoneyValue(Number.NaN), null);
  assert.equal(parseMoneyValue(Infinity), null);
  assert.equal(
    parseMoneyValue("bad", { invalidValue: MONEY_INVALID_VALUE_POLICIES.zero }),
    0,
  );
  assert.throws(
    () => parseMoneyValue("bad", { invalidValue: MONEY_INVALID_VALUE_POLICIES.reject }),
    TypeError,
  );
});

test("normalizeMoney can preserve or reject negative amounts by explicit contract", () => {
  assert.equal(normalizeMoney(-10), -10);
  assert.equal(normalizeMoney(-10, { allowNegative: false }), null);
  assert.equal(
    normalizeMoney(-10, {
      allowNegative: false,
      invalidValue: MONEY_INVALID_VALUE_POLICIES.zero,
    }),
    0,
  );
});

test("historical zero fallback and non-negative clamp are explicit", () => {
  assert.equal(toFiniteNumberOrZero(""), 0);
  assert.equal(toFiniteNumberOrZero("bad"), 0);
  assert.equal(toFiniteNumberOrZero("123,45", { allowDecimalComma: true }), 123.45);
  assert.equal(clampNonNegative(-10), 0);
  assert.equal(clampNonNegative("12.5"), 12.5);
  assert.equal(clampNonNegative("bad"), 0);
});

test("sumMoney handles empty, mixed and decimal values without mutating inputs", () => {
  const values = Object.freeze([0.1, 0.2, "1.50", "2,50", "bad"]);

  assert.equal(sumMoney([]), 0);
  assert.equal(sumMoney(values, { allowDecimalComma: true }), 4.3);
  assert.deepEqual(values, [0.1, 0.2, "1.50", "2,50", "bad"]);
  assert.equal(
    sumMoney("not-array", { invalidValue: MONEY_INVALID_VALUE_POLICIES.zero }),
    0,
  );
});

test("roundMoney exposes deterministic rounding strategies", () => {
  assert.equal(roundMoney(12.345, { precision: 2 }), 12.35);
  assert.equal(roundMoney(12.344, { precision: 2 }), 12.34);
  assert.equal(
    roundMoney(12.349, {
      precision: 2,
      strategy: MONEY_ROUNDING_STRATEGIES.floor,
    }),
    12.34,
  );
  assert.equal(
    roundMoney(12.341, {
      precision: 2,
      strategy: MONEY_ROUNDING_STRATEGIES.ceil,
    }),
    12.35,
  );
  assert.equal(
    roundMoney(-12.349, {
      precision: 2,
      strategy: MONEY_ROUNDING_STRATEGIES.truncate,
    }),
    -12.34,
  );
  assert.equal(roundMoney(12.5, { precision: 0 }), 13);
  assert.throws(() => roundMoney(1, { precision: -1 }), RangeError);
  assert.throws(() => roundMoney(1, { strategy: "bankers" }), RangeError);
});

test("roundEuro and two-decimal rounding match current JavaScript behavior", () => {
  assert.equal(roundEuro(123.49), 123);
  assert.equal(roundEuro(123.5), 124);
  assert.equal(roundEuro(-1.5), -1);
  assert.equal(roundMoney(1.005, { precision: 2 }), 1);
  assert.equal(roundMoney(0.1 + 0.2, { precision: 2 }), 0.3);
});

test("multiplyMoneyByRate and equality tolerance do not choose business rates", () => {
  assert.equal(multiplyMoneyByRate(100, 0.22), 22);
  assert.equal(multiplyMoneyByRate(100, 0), 0);
  assert.equal(multiplyMoneyByRate(100, -0.1), -10);
  assert.equal(multiplyMoneyByRate("bad", 0.2), null);
  assert.equal(areMoneyValuesEqual(0.1 + 0.2, 0.3), false);
  assert.equal(areMoneyValuesEqual(0.1 + 0.2, 0.3, { tolerance: 1e-10 }), true);
  assert.throws(() => areMoneyValuesEqual(1, 1, { tolerance: -1 }), RangeError);
});

test("local date validation is strict for YYYY-MM-DD", () => {
  assert.equal(isValidLocalDateString("2026-07-29"), true);
  assert.equal(isValidLocalDateString("2026-00-29"), false);
  assert.equal(isValidLocalDateString("2026-13-29"), false);
  assert.equal(isValidLocalDateString("2026-01-00"), false);
  assert.equal(isValidLocalDateString("2026-04-31"), false);
  assert.equal(isValidLocalDateString("2028-02-29"), true);
  assert.equal(isValidLocalDateString("2026-02-29"), false);
  assert.equal(isValidLocalDateString("29/07/2026"), false);
  assert.equal(isValidLocalDateString("2026-7-29"), false);
});

test("leap-year and days-in-month helpers are pure calendar primitives", () => {
  assert.equal(isLeapYear(2028), true);
  assert.equal(isLeapYear(2026), false);
  assert.equal(isLeapYear(2000), true);
  assert.equal(isLeapYear(1900), false);
  assert.equal(daysInMonth(2026, 1), 31);
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(daysInMonth(2026, 13), null);
});

test("parseLocalDate and formatLocalDate preserve local date-only values", () => {
  const parsed = parseLocalDate("2026-03-29");

  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 2);
  assert.equal(parsed.getDate(), 29);
  assert.equal(formatLocalDate(parsed), "2026-03-29");
  assert.equal(formatLocalDate("2026-10-25"), "2026-10-25");
  assert.equal(formatLocalDate("invalid"), null);
});

test("date helpers clone Date inputs and never mutate source dates", () => {
  const source = new Date(2026, 0, 31, 15, 30, 10);
  const before = source.getTime();
  const parsed = parseLocalDate(source);
  const start = startOfLocalDay(source);
  const added = addCalendarDays(source, 1);

  parsed.setDate(1);

  assert.equal(source.getTime(), before);
  assert.equal(dateOnly(start), "2026-01-31");
  assert.equal(dateOnly(added), "2026-02-01");
});

test("compareLocalDates and differenceInCalendarDays are calendar based", () => {
  assert.equal(compareLocalDates("2026-07-28", "2026-07-29"), -1);
  assert.equal(compareLocalDates("2026-07-29", "2026-07-29"), 0);
  assert.equal(compareLocalDates("2026-07-30", "2026-07-29"), 1);
  assert.equal(compareLocalDates("bad", "2026-07-29"), null);
  assert.equal(differenceInCalendarDays("2026-07-29", "2026-07-30"), 1);
  assert.equal(differenceInCalendarDays("2026-07-30", "2026-07-29"), -1);
  assert.equal(differenceInCalendarDays("2026-07-29", "2026-07-29"), 0);
});

test("addCalendarDays covers month, year and DST-sensitive boundaries", () => {
  assert.equal(dateOnly(addCalendarDays("2026-01-31", 1)), "2026-02-01");
  assert.equal(dateOnly(addCalendarDays("2026-03-01", -1)), "2026-02-28");
  assert.equal(dateOnly(addCalendarDays("2026-12-31", 1)), "2027-01-01");
  assert.equal(dateOnly(addCalendarDays("2026-03-29", 1)), "2026-03-30");
  assert.equal(dateOnly(addCalendarDays("2026-10-25", 1)), "2026-10-26");
  assert.equal(addCalendarDays("2026-07-29", 1.5), null);
});

test("start and end of local month preserve calendar intent", () => {
  assert.equal(dateOnly(startOfLocalMonth("2026-02-15")), "2026-02-01");
  assert.equal(dateOnly(endOfLocalMonth("2026-02-15")), "2026-02-28");
  assert.equal(dateOnly(endOfLocalMonth("2028-02-15")), "2028-02-29");
  assert.equal(dateOnly(endOfLocalMonth("2026-12-15")), "2026-12-31");
});

test("addCalendarMonths makes end-of-month policy explicit", () => {
  assert.equal(dateOnly(addCalendarMonths("2026-01-31", 1)), "2026-02-28");
  assert.equal(dateOnly(addCalendarMonths("2028-01-31", 1)), "2028-02-29");
  assert.equal(dateOnly(addCalendarMonths("2026-11-30", 1)), "2026-12-30");
  assert.equal(dateOnly(addCalendarMonths("2026-12-31", 1)), "2027-01-31");
  assert.equal(dateOnly(addCalendarMonths("2026-03-31", -1)), "2026-02-28");
  assert.equal(
    dateOnly(addCalendarMonths("2026-01-31", 1, {
      policy: ADD_MONTH_POLICIES.overflow,
    })),
    "2026-03-03",
  );
  assert.throws(
    () => addCalendarMonths("2026-01-31", 1, { policy: "silent" }),
    RangeError,
  );
});

test("reference dates must be injected explicitly", () => {
  const date = requireReferenceDate("2026-07-29");

  assert.equal(dateOnly(date), "2026-07-29");
  assert.throws(() => requireReferenceDate(null), TypeError);
});
