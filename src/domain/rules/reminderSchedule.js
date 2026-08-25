import { resolveCurrentDeclarationPeriod, computeDeclarationDeadline } from "./declarationPeriod.js";

const REMINDER_LEAD_DAYS = 7;

// LOT 10.2C: was an independent third copy of the same today-anchored
// deadline arithmetic as obligations.js/deadlineRules.js (now fixed there);
// delegates to the shared, period-anchored module instead of re-deriving
// its own (previously buggy) formula, so all three stay in sync by
// construction.
export function calculateNextReminderDate(frequency, today = new Date()) {
  const period = resolveCurrentDeclarationPeriod({ frequency, referenceDate: today });
  if (!period) return null;

  const deadline = computeDeclarationDeadline({ period, referenceDate: today });
  if (!deadline) return null;

  const reminderDate = new Date(deadline.dueDate);
  reminderDate.setDate(reminderDate.getDate() - REMINDER_LEAD_DAYS);
  return reminderDate.toISOString();
}
