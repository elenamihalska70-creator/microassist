// Pure, runtime-agnostic (Deno + Node) reminder eligibility logic.
// Mirrors exactly the window currently used by the live Supabase query in
// index.ts: status "pending" AND reminder_date within [today, today+2].
// No provider I/O, no Supabase dependency, no catch-up: an overdue reminder
// (reminder_date < today) is a known, characterized limitation, not fixed here.

export function getEligibilityWindow(referenceDate = new Date()) {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);

  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + 2);

  return {
    startDate: today.toISOString().split("T")[0],
    endDate: windowEnd.toISOString().split("T")[0],
  };
}

export function isReminderEligible(reminder, referenceDate = new Date()) {
  if (!reminder || reminder.status !== "pending") return false;
  if (!reminder.reminder_date) return false;

  const { startDate, endDate } = getEligibilityWindow(referenceDate);

  return reminder.reminder_date >= startDate && reminder.reminder_date <= endDate;
}
