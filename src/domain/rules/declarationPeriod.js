import { DECLARATION_FREQUENCIES } from "../constants.js";
import { parseLocalDate, differenceInCalendarDays } from "../calculations/dates.js";

// Reuses the same local-calendar-safe parsing/diffing already used by ACRE
// timing (parseLocalDate/differenceInCalendarDays, src/domain/calculations/dates.js)
// instead of raw millisecond subtraction: comparing epoch millis directly is
// vulnerable to producing an off-by-one (or a spurious -0) day count across a
// DST transition or when a "YYYY-MM-DD" string (parsed as UTC midnight) is
// compared against a `new Date(y, m, d)` local-midnight value.
function coerceDate(value) {
  return parseLocalDate(value) || new Date();
}

function getQuarterIndex(month0) {
  return Math.floor(month0 / 3) + 1;
}

// LOT 10.2C: verified against an official source (entreprendre.service-public.gouv.fr,
// fetched 2026-08-25 -- see LOT 10.2C final report for the exact citation and
// corroborating sources). Each quarter's declaration deadline falls on a
// fixed date in the FIRST MONTH of the FOLLOWING quarter:
//   Q1 (Jan-Mar) -> 30 April
//   Q2 (Apr-Jun) -> 31 July      (directly confirmed by primary-source fetch)
//   Q3 (Jul-Sep) -> 31 October
//   Q4 (Oct-Dec) -> 31 January of the following year
// These fixed dates were already correct in the pre-existing code; the bug
// this module fixes is period SELECTION (see resolveCurrentDeclarationPeriod),
// not these dates.
const QUARTER_DEADLINES = Object.freeze({
  1: { month0: 3, day: 30, yearOffset: 0 },
  2: { month0: 6, day: 31, yearOffset: 0 },
  3: { month0: 9, day: 31, yearOffset: 0 },
  4: { month0: 0, day: 31, yearOffset: 1 },
});

/**
 * Identifies which declaration period is presumptively "current" for a given
 * referenceDate, with no persisted state.
 *
 * Monthly: declarers always report LAST calendar month's revenue -- a clean,
 * one-month-wide window (deadline is always exactly one month out from the
 * period's own end, per computeDeclarationDeadline below).
 *
 * Quarterly: each quarter's declaration window is only ONE month wide (the
 * first month of the following quarter -- e.g. Q1 (Jan-Mar) is declared
 * during April only, due 30 April). During that window month, the relevant
 * period is the quarter that just closed. During the other two months of a
 * quarter, no quarterly window is open yet; the next relevant deadline is
 * for the CURRENT (still-accruing) quarter, due in the first month of the
 * following quarter.
 *
 * This is a best-effort, stateless default for "what should I show right
 * now" -- it cannot express "period X, still not confirmed declared" once
 * its window has closed and a new one has opened, since distinguishing a
 * missed declaration from an already-filed one requires persisted
 * completion state (explicitly out of scope for LOT 10.2C; see
 * computeDeclarationDeadline for a pure, period-pinned function that fully
 * supports a stable OVERDUE status for an explicit, already-identified
 * period, independent of this auto-selection heuristic).
 */
export function resolveCurrentDeclarationPeriod({ frequency, referenceDate } = {}) {
  const today = coerceDate(referenceDate);
  const year = today.getFullYear();
  const month0 = today.getMonth();

  if (frequency === DECLARATION_FREQUENCIES.monthly) {
    const rawMonth0 = month0 - 1;
    return {
      type: "month",
      year: rawMonth0 < 0 ? year - 1 : year,
      month0: (rawMonth0 + 12) % 12,
    };
  }

  if (frequency === DECLARATION_FREQUENCIES.quarterly) {
    const currentQuarter = getQuarterIndex(month0);
    const isWindowMonth = month0 % 3 === 0;

    if (isWindowMonth) {
      return {
        type: "quarter",
        year: currentQuarter === 1 ? year - 1 : year,
        quarter: currentQuarter === 1 ? 4 : currentQuarter - 1,
      };
    }

    return { type: "quarter", year, quarter: currentQuarter };
  }

  return null;
}

/**
 * Pure: the period immediately following an explicit period (e.g. for a
 * future "Calendrier" view to show what's next after the current one).
 * Does not consult referenceDate or any dossier/confirmation state -- it is
 * purely "one calendar step forward", independent of whether the given
 * period has been declared.
 */
export function getNextDeclarationPeriod(period) {
  if (!period) return null;

  if (period.type === "month" && Number.isInteger(period.year) && Number.isInteger(period.month0)) {
    const nextMonth0 = period.month0 + 1;
    return {
      type: "month",
      year: nextMonth0 > 11 ? period.year + 1 : period.year,
      month0: nextMonth0 % 12,
    };
  }

  if (
    period.type === "quarter" &&
    Number.isInteger(period.year) &&
    Number.isInteger(period.quarter)
  ) {
    const nextQuarter = period.quarter + 1;
    return {
      type: "quarter",
      year: nextQuarter > 4 ? period.year + 1 : period.year,
      quarter: nextQuarter > 4 ? 1 : nextQuarter,
    };
  }

  return null;
}

/**
 * Pure: computes the fixed due date and current daysLeft for an EXPLICIT,
 * already-identified declaration period, given a referenceDate.
 *
 * The due date is a function of `period` ALONE -- never of `referenceDate` --
 * so calling this again later for the SAME period never moves the due date;
 * only daysLeft (and therefore lifecycle status: UPCOMING -> DUE_SOON -> DUE
 * -> OVERDUE) advances as referenceDate advances. This is the fix for the
 * pre-existing bug where the deadline itself rolled forward with "today".
 */
export function computeDeclarationDeadline({ period, referenceDate } = {}) {
  if (!period) return null;

  let dueDate = null;

  if (period.type === "month" && Number.isInteger(period.year) && Number.isInteger(period.month0)) {
    dueDate = new Date(period.year, period.month0 + 2, 0);
  } else if (period.type === "quarter" && Number.isInteger(period.year)) {
    const config = QUARTER_DEADLINES[period.quarter];
    if (config) {
      dueDate = new Date(period.year + config.yearOffset, config.month0, config.day);
    }
  }

  if (!dueDate || Number.isNaN(dueDate.getTime())) return null;

  const today = coerceDate(referenceDate);
  const daysLeft = differenceInCalendarDays(today, dueDate);

  return { dueDate, daysLeft };
}

/**
 * Pure: the calendar span (first/last day, inclusive) an explicit,
 * already-identified declaration period covers -- e.g. for the declaration
 * dossier system (LOT 10.2D) to know exactly which revenue entries a given
 * period's confirmation snapshot should total. Independent of
 * computeDeclarationDeadline's due date (a different, later date).
 */
export function getDeclarationPeriodBounds(period) {
  if (!period) return null;

  if (period.type === "month" && Number.isInteger(period.year) && Number.isInteger(period.month0)) {
    return {
      start: new Date(period.year, period.month0, 1),
      end: new Date(period.year, period.month0 + 1, 0),
    };
  }

  if (
    period.type === "quarter" &&
    Number.isInteger(period.year) &&
    Number.isInteger(period.quarter)
  ) {
    const startMonth0 = (period.quarter - 1) * 3;
    return {
      start: new Date(period.year, startMonth0, 1),
      end: new Date(period.year, startMonth0 + 3, 0),
    };
  }

  return null;
}
