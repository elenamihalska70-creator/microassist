import { DECLARATION_FREQUENCIES } from "../constants.js";

const REMINDER_LEAD_DAYS = 7;

export function calculateNextReminderDate(frequency, today = new Date()) {
  if (frequency === DECLARATION_FREQUENCIES.monthly) {
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    nextMonth.setDate(nextMonth.getDate() - REMINDER_LEAD_DAYS);
    return nextMonth.toISOString();
  }

  if (frequency === DECLARATION_FREQUENCIES.quarterly) {
    const month = today.getMonth();
    let endQuarter;

    if (month <= 2) endQuarter = new Date(today.getFullYear(), 3, 30);
    else if (month <= 5) endQuarter = new Date(today.getFullYear(), 6, 31);
    else if (month <= 8) endQuarter = new Date(today.getFullYear(), 9, 31);
    else endQuarter = new Date(today.getFullYear() + 1, 0, 31);

    endQuarter.setDate(endQuarter.getDate() - REMINDER_LEAD_DAYS);
    return endQuarter.toISOString();
  }

  return null;
}
