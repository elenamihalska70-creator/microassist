import test from "node:test";
import assert from "node:assert/strict";
import {
  REMINDER_LEAD_DAYS,
  getEligibilityWindow,
  isReminderEligible,
} from "../supabase/functions/send-reminder/reminderWindow.js";

// UNIT + CHARACTERIZATION — mirrors exactly the window the live Supabase
// query in send-reminder/index.ts applies: status "pending" AND
// reminder_date within [today - REMINDER_LEAD_DAYS, today + 2].
//
// LOT 7.33: widened from the original [today, today+2]-only window to
// include bounded overdue catch-up (LOT 7.31/7.32 design). The header-auth
// failure that hid for months (LOT 7.2) precisely because no test existed
// for this window is the reason this file exists at all -- keep it
// accurate to what the live query actually does, not to what it used to do.

const REFERENCE_DATE = new Date(2026, 7, 14); // 14 Aug 2026, arbitrary fixed anchor

function isoDate(date) {
  return date.toISOString().split("T")[0];
}

function daysFromReference(offset) {
  const d = new Date(REFERENCE_DATE);
  d.setDate(d.getDate() + offset);
  return isoDate(d);
}

test("REMINDER_LEAD_DAYS matches the approved LOT 7.31 usefulness boundary", () => {
  assert.equal(REMINDER_LEAD_DAYS, 7);
});

test("getEligibilityWindow: [today - REMINDER_LEAD_DAYS, today + 2] inclusive, as plain YYYY-MM-DD strings", () => {
  const window = getEligibilityWindow(REFERENCE_DATE);

  assert.equal(window.startDate, daysFromReference(-REMINDER_LEAD_DAYS));
  assert.equal(window.endDate, daysFromReference(2));
});

// NORMAL — unchanged upper-window behavior, no regression.

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

// CATCH-UP — bounded overdue window (LOT 7.33).

test("UNIT — one day overdue but still useful -> eligible", () => {
  const reminder = { status: "pending", reminder_date: daysFromReference(-1) };
  assert.equal(isReminderEligible(reminder, REFERENCE_DATE), true);
});

test("UNIT — overdue by exactly REMINDER_LEAD_DAYS (deadline day itself) -> still eligible (inclusive boundary)", () => {
  const reminder = { status: "pending", reminder_date: daysFromReference(-REMINDER_LEAD_DAYS) };
  assert.equal(isReminderEligible(reminder, REFERENCE_DATE), true);
});

test("UNIT — overdue by REMINDER_LEAD_DAYS + 1 (past the deadline) -> excluded", () => {
  const reminder = { status: "pending", reminder_date: daysFromReference(-REMINDER_LEAD_DAYS - 1) };
  assert.equal(isReminderEligible(reminder, REFERENCE_DATE), false);
});

test("UNIT — a reminder overdue by months is still excluded (bounded, not an unlimited backlog)", () => {
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
