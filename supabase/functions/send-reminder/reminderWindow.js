// Pure, runtime-agnostic (Deno + Node) reminder eligibility logic.
// Mirrors exactly the window used by the live Supabase query in index.ts:
// status "pending" AND reminder_date within
// [today - REMINDER_LEAD_DAYS, today + 2].
//
// LOT 7.33: extended from the original [today, today+2]-only window to
// include bounded overdue catch-up, tied to the derived declaration
// deadline (LOT 7.31 section 2/3/4): deadline = reminder_date +
// REMINDER_LEAD_DAYS. A reminder stays useful to send through its deadline
// day and never past it -- this is a bounded catch-up horizon, not an
// unbounded backlog.
//
// REMINDER_LEAD_DAYS duplicates the private, unexported constant of the
// same meaning and value in src/domain/rules/reminderSchedule.js, which
// this Deno runtime cannot import (separate runtime, separate deploy
// target). Pre-existing "duplicated deadline source" debt (LOT 7.17+,
// named explicitly in LOT 7.31 section 4) -- not fixed here. If the
// frontend's lead time ever changes, this constant must be updated by
// hand to match.

export const REMINDER_LEAD_DAYS = 7;

export function getEligibilityWindow(referenceDate = new Date()) {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - REMINDER_LEAD_DAYS);

  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + 2);

  return {
    startDate: windowStart.toISOString().split("T")[0],
    endDate: windowEnd.toISOString().split("T")[0],
  };
}

export function isReminderEligible(reminder, referenceDate = new Date()) {
  if (!reminder || reminder.status !== "pending") return false;
  if (!reminder.reminder_date) return false;

  const { startDate, endDate } = getEligibilityWindow(referenceDate);

  return reminder.reminder_date >= startDate && reminder.reminder_date <= endDate;
}
