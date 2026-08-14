import test from "node:test";
import assert from "node:assert/strict";
import {
  getEligibilityWindow,
  isReminderEligible,
} from "../supabase/functions/send-reminder/reminderWindow.js";

// UNIT + CHARACTERIZATION — mirrors exactly the window the live Supabase
// query in send-reminder/index.ts applies: status "pending" AND
// reminder_date within [today, today+2]. This is the same window that let
// a header-auth failure hide for months (LOT 7.2) precisely because no test
// existed for it. No catch-up logic exists; that absence is characterized
// here, not fixed.

const REFERENCE_DATE = new Date(2026, 7, 14); // 14 Aug 2026, arbitrary fixed anchor

function isoDate(date) {
  return date.toISOString().split("T")[0];
}

function daysFromReference(offset) {
  const d = new Date(REFERENCE_DATE);
  d.setDate(d.getDate() + offset);
  return isoDate(d);
}

test("getEligibilityWindow: [today, today+2] inclusive, as plain YYYY-MM-DD strings", () => {
  const window = getEligibilityWindow(REFERENCE_DATE);

  assert.equal(window.startDate, daysFromReference(0));
  assert.equal(window.endDate, daysFromReference(2));
});

test("UNIT — status=pending, reminder_date=today -> eligible", () => {
  const reminder = { status: "pending", reminder_date: daysFromReference(0) };
  assert.equal(isReminderEligible(reminder, REFERENCE_DATE), true);
});

test("UNIT — status=pending, reminder_date=today+1 -> eligible", () => {
  const reminder = { status: "pending", reminder_date: daysFromReference(1) };
  assert.equal(isReminderEligible(reminder, REFERENCE_DATE), true);
});

test("UNIT — status=pending, reminder_date=today+2 -> eligible (inclusive upper bound)", () => {
  const reminder = { status: "pending", reminder_date: daysFromReference(2) };
  assert.equal(isReminderEligible(reminder, REFERENCE_DATE), true);
});

test("UNIT — status=pending, reminder_date=today+3 -> not eligible", () => {
  const reminder = { status: "pending", reminder_date: daysFromReference(3) };
  assert.equal(isReminderEligible(reminder, REFERENCE_DATE), false);
});

test("CHARACTERIZATION — overdue reminder (reminder_date=yesterday) is never eligible again: no catch-up", () => {
  const reminder = { status: "pending", reminder_date: daysFromReference(-1) };
  assert.equal(
    isReminderEligible(reminder, REFERENCE_DATE),
    false,
    "known limitation (LOT 7.1/7.2): a reminder that falls out of the window is permanently skipped, never retried",
  );
});

test("CHARACTERIZATION — a reminder overdue by months is still permanently excluded", () => {
  const reminder = { status: "pending", reminder_date: daysFromReference(-90) };
  assert.equal(isReminderEligible(reminder, REFERENCE_DATE), false);
});

for (const status of ["sent", "failed", "cancelled"]) {
  test(`UNIT — status="${status}" is excluded even within the date window`, () => {
    const reminder = { status, reminder_date: daysFromReference(0) };
    assert.equal(isReminderEligible(reminder, REFERENCE_DATE), false);
  });
}

test("UNIT — missing/null reminder or reminder_date is excluded, not thrown", () => {
  assert.equal(isReminderEligible(null, REFERENCE_DATE), false);
  assert.equal(
    isReminderEligible({ status: "pending", reminder_date: null }, REFERENCE_DATE),
    false,
  );
});
