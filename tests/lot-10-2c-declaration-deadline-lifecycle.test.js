import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveCurrentDeclarationPeriod,
  computeDeclarationDeadline,
} from "../src/domain/rules/declarationPeriod.js";
import {
  resolveStatus,
  resolveSeverityAndTier,
} from "../src/domain/obligations/buildUrssafDeclarationAction.js";
import { OBLIGATION_STATUS } from "../src/domain/obligations/constants.js";

function dateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function lifecycleStatus(daysLeft) {
  return resolveStatus(daysLeft);
}

// ---------------------------------------------------------------------
// MONTHLY -- computeDeclarationDeadline given an explicit period
// ---------------------------------------------------------------------

const JAN_2026 = { type: "month", year: 2026, month0: 0 }; // due 28 Feb 2026

test("MONTHLY: well before deadline is UPCOMING", () => {
  const { dueDate, daysLeft } = computeDeclarationDeadline({
    period: JAN_2026,
    referenceDate: "2026-02-01",
  });
  assert.equal(dateOnly(dueDate), "2026-02-28");
  assert.equal(daysLeft, 27);
  assert.equal(lifecycleStatus(daysLeft), OBLIGATION_STATUS.upcoming);
});

test("MONTHLY: exactly 7 days before deadline is DUE_SOON (warning band)", () => {
  const { daysLeft } = computeDeclarationDeadline({ period: JAN_2026, referenceDate: "2026-02-21" });
  assert.equal(daysLeft, 7);
  assert.equal(lifecycleStatus(daysLeft), OBLIGATION_STATUS.dueSoon);
  assert.equal(resolveSeverityAndTier(OBLIGATION_STATUS.dueSoon, daysLeft).priorityTier, 3);
});

test("MONTHLY: exactly 2 days before deadline is DUE_SOON (critical J-2 band)", () => {
  const { daysLeft } = computeDeclarationDeadline({ period: JAN_2026, referenceDate: "2026-02-26" });
  assert.equal(daysLeft, 2);
  assert.equal(lifecycleStatus(daysLeft), OBLIGATION_STATUS.dueSoon);
  assert.equal(resolveSeverityAndTier(OBLIGATION_STATUS.dueSoon, daysLeft).priorityTier, 2);
});

test("MONTHLY: day before deadline", () => {
  const { daysLeft } = computeDeclarationDeadline({ period: JAN_2026, referenceDate: "2026-02-27" });
  assert.equal(daysLeft, 1);
  assert.equal(lifecycleStatus(daysLeft), OBLIGATION_STATUS.dueSoon);
});

test("MONTHLY: deadline day is DUE", () => {
  const { daysLeft } = computeDeclarationDeadline({ period: JAN_2026, referenceDate: "2026-02-28" });
  assert.equal(daysLeft, 0);
  assert.equal(lifecycleStatus(daysLeft), OBLIGATION_STATUS.due);
});

test("MONTHLY: day after deadline is OVERDUE", () => {
  const { daysLeft } = computeDeclarationDeadline({ period: JAN_2026, referenceDate: "2026-03-01" });
  assert.equal(daysLeft, -1);
  assert.equal(lifecycleStatus(daysLeft), OBLIGATION_STATUS.overdue);
});

test("MONTHLY: multiple days after deadline stays OVERDUE with a growing negative daysLeft", () => {
  const { daysLeft } = computeDeclarationDeadline({ period: JAN_2026, referenceDate: "2026-03-10" });
  assert.equal(daysLeft, -10);
  assert.equal(lifecycleStatus(daysLeft), OBLIGATION_STATUS.overdue);
});

test("MONTHLY: month boundary and year boundary (December period rolls the deadline into January of the next year)", () => {
  const dec2025 = { type: "month", year: 2025, month0: 11 };
  const { dueDate } = computeDeclarationDeadline({ period: dec2025, referenceDate: "2026-01-15" });
  assert.equal(dateOnly(dueDate), "2026-01-31");
});

test("MONTHLY: February in a non-leap year", () => {
  const { dueDate } = computeDeclarationDeadline({ period: JAN_2026, referenceDate: "2026-02-01" });
  assert.equal(dateOnly(dueDate), "2026-02-28");
});

test("MONTHLY: February in a leap year", () => {
  const jan2028 = { type: "month", year: 2028, month0: 0 };
  const { dueDate } = computeDeclarationDeadline({ period: jan2028, referenceDate: "2028-02-01" });
  assert.equal(dateOnly(dueDate), "2028-02-29");
});

test("MONTHLY: dueDate is stable for the SAME period as referenceDate advances", () => {
  const early = computeDeclarationDeadline({ period: JAN_2026, referenceDate: "2026-02-01" });
  const late = computeDeclarationDeadline({ period: JAN_2026, referenceDate: "2026-03-15" });
  assert.equal(dateOnly(early.dueDate), dateOnly(late.dueDate));
  assert.equal(dateOnly(early.dueDate), "2026-02-28");
});

// ---------------------------------------------------------------------
// MONTHLY -- resolveCurrentDeclarationPeriod (auto-selection, no persistence)
// ---------------------------------------------------------------------

test("MONTHLY auto-select: the period currently open for declaration is always last calendar month", () => {
  const period = resolveCurrentDeclarationPeriod({ frequency: "mensuel", referenceDate: "2026-08-25" });
  assert.deepEqual(period, { type: "month", year: 2026, month0: 6 }); // July

  const { dueDate, daysLeft } = computeDeclarationDeadline({ period, referenceDate: "2026-08-25" });
  assert.equal(dateOnly(dueDate), "2026-08-31");
  assert.equal(daysLeft, 6);
  assert.equal(lifecycleStatus(daysLeft), OBLIGATION_STATUS.dueSoon);
});

test("MONTHLY auto-select: January maps to December of the previous year", () => {
  const period = resolveCurrentDeclarationPeriod({ frequency: "mensuel", referenceDate: "2026-01-10" });
  assert.deepEqual(period, { type: "month", year: 2025, month0: 11 });
});

// ---------------------------------------------------------------------
// QUARTERLY -- computeDeclarationDeadline given an explicit period
// ---------------------------------------------------------------------

test("QUARTERLY: each quarter's deadline lands on the correct fixed date", () => {
  assert.equal(
    dateOnly(computeDeclarationDeadline({ period: { type: "quarter", year: 2026, quarter: 1 } }).dueDate),
    "2026-04-30",
  );
  assert.equal(
    dateOnly(computeDeclarationDeadline({ period: { type: "quarter", year: 2026, quarter: 2 } }).dueDate),
    "2026-07-31",
  );
  assert.equal(
    dateOnly(computeDeclarationDeadline({ period: { type: "quarter", year: 2026, quarter: 3 } }).dueDate),
    "2026-10-31",
  );
  assert.equal(
    dateOnly(computeDeclarationDeadline({ period: { type: "quarter", year: 2026, quarter: 4 } }).dueDate),
    "2027-01-31", // year transition: Q4 2026 -> January of 2027
  );
});

test("QUARTERLY: DUE_SOON, DUE and OVERDUE around the Q2 deadline (31 July)", () => {
  const period = { type: "quarter", year: 2026, quarter: 2 };

  const sevenDaysOut = computeDeclarationDeadline({ period, referenceDate: "2026-07-24" });
  assert.equal(sevenDaysOut.daysLeft, 7);
  assert.equal(lifecycleStatus(sevenDaysOut.daysLeft), OBLIGATION_STATUS.dueSoon);

  const twoDaysOut = computeDeclarationDeadline({ period, referenceDate: "2026-07-29" });
  assert.equal(twoDaysOut.daysLeft, 2);
  assert.equal(lifecycleStatus(twoDaysOut.daysLeft), OBLIGATION_STATUS.dueSoon);

  const dueToday = computeDeclarationDeadline({ period, referenceDate: "2026-07-31" });
  assert.equal(dueToday.daysLeft, 0);
  assert.equal(lifecycleStatus(dueToday.daysLeft), OBLIGATION_STATUS.due);

  const overdue = computeDeclarationDeadline({ period, referenceDate: "2026-08-01" });
  assert.equal(overdue.daysLeft, -1);
  assert.equal(lifecycleStatus(overdue.daysLeft), OBLIGATION_STATUS.overdue);

  // Stability: the SAME period's dueDate never moves across all four calls above.
  assert.equal(dateOnly(sevenDaysOut.dueDate), "2026-07-31");
  assert.equal(dateOnly(twoDaysOut.dueDate), "2026-07-31");
  assert.equal(dateOnly(dueToday.dueDate), "2026-07-31");
  assert.equal(dateOnly(overdue.dueDate), "2026-07-31");
});

// ---------------------------------------------------------------------
// QUARTERLY -- resolveCurrentDeclarationPeriod (window month vs accrual months)
// ---------------------------------------------------------------------

test("QUARTERLY auto-select: during the window month, the just-closed quarter is due", () => {
  // April is the one-month window for declaring Q1 (Jan-Mar), due 30 April.
  assert.deepEqual(
    resolveCurrentDeclarationPeriod({ frequency: "trimestriel", referenceDate: "2026-04-15" }),
    { type: "quarter", year: 2026, quarter: 1 },
  );
  // July is the window for Q2.
  assert.deepEqual(
    resolveCurrentDeclarationPeriod({ frequency: "trimestriel", referenceDate: "2026-07-15" }),
    { type: "quarter", year: 2026, quarter: 2 },
  );
  // October is the window for Q3.
  assert.deepEqual(
    resolveCurrentDeclarationPeriod({ frequency: "trimestriel", referenceDate: "2026-10-15" }),
    { type: "quarter", year: 2026, quarter: 3 },
  );
});

test("QUARTERLY auto-select: January is the window month for Q4 of the PREVIOUS year", () => {
  assert.deepEqual(
    resolveCurrentDeclarationPeriod({ frequency: "trimestriel", referenceDate: "2027-01-15" }),
    { type: "quarter", year: 2026, quarter: 4 },
  );
});

test("QUARTERLY auto-select: outside the window month, the still-accruing current quarter is shown (not yet due)", () => {
  // May and June are NOT the window month for Q2 -- no quarterly declaration
  // is imminent; the relevant period is Q2 itself, still weeks from its own
  // deadline.
  const may = resolveCurrentDeclarationPeriod({ frequency: "trimestriel", referenceDate: "2026-05-15" });
  assert.deepEqual(may, { type: "quarter", year: 2026, quarter: 2 });
  const { daysLeft } = computeDeclarationDeadline({ period: may, referenceDate: "2026-05-15" });
  assert.equal(lifecycleStatus(daysLeft), OBLIGATION_STATUS.upcoming);

  const june = resolveCurrentDeclarationPeriod({ frequency: "trimestriel", referenceDate: "2026-06-15" });
  assert.deepEqual(june, { type: "quarter", year: 2026, quarter: 2 });
});

test("QUARTERLY auto-select: quarter and year boundaries stay internally consistent", () => {
  // Every window month must resolve to a period whose OWN computed deadline
  // equals (or very nearly equals) the referenceDate that triggered it --
  // i.e. auto-selection and the pure deadline function agree.
  const referenceDates = ["2026-04-30", "2026-07-31", "2026-10-31", "2027-01-31"];
  for (const referenceDate of referenceDates) {
    const period = resolveCurrentDeclarationPeriod({ frequency: "trimestriel", referenceDate });
    const { dueDate, daysLeft } = computeDeclarationDeadline({ period, referenceDate });
    assert.equal(dateOnly(dueDate), referenceDate, `period for ${referenceDate}`);
    assert.equal(daysLeft, 0, `daysLeft for ${referenceDate}`);
  }
});

// ---------------------------------------------------------------------
// Unknown / missing frequency
// ---------------------------------------------------------------------

test("resolveCurrentDeclarationPeriod returns null for an unrecognized frequency", () => {
  assert.equal(resolveCurrentDeclarationPeriod({ frequency: "annuel", referenceDate: "2026-01-01" }), null);
  assert.equal(resolveCurrentDeclarationPeriod({ referenceDate: "2026-01-01" }), null);
});

test("computeDeclarationDeadline returns null without a period", () => {
  assert.equal(computeDeclarationDeadline({ referenceDate: "2026-01-01" }), null);
});
