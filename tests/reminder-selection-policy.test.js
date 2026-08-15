import test from "node:test";
import assert from "node:assert/strict";
import { isReminderProcessable } from "../supabase/functions/send-reminder/reminderSelectionPolicy.js";
import { REMINDER_LEAD_DAYS } from "../supabase/functions/send-reminder/reminderWindow.js";
import { MAX_ATTEMPTS } from "../supabase/functions/send-reminder/reminderRetryPolicy.js";

// UNIT + CHARACTERIZATION — LOT 7.33 full selection-policy matrix.
// isReminderProcessable(reminder, now) answers "would index.ts's current
// logic actually reach a fresh resend.emails.send() for this row" -- the
// single safety-critical question this whole design exists to get right.
// Does not model the no-email path (not part of the `reminders` row; see
// reminder-no-email.test.js).

const NOW = new Date(2026, 7, 15); // 15 Aug 2026, arbitrary fixed anchor
const REMINDER_ID = "931a309f-c7fb-4e5b-8c88-7c99da0dd9ef";
const USER_ID = "b5e1a5f0-1111-4a1a-9a1a-000000000001";

function isoDate(offsetDays) {
  const d = new Date(NOW);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

function keyFor(reminderDate) {
  return `declaration:${REMINDER_ID}:${reminderDate}`;
}

function reminderAt(offsetDays, { status = "pending", metadata = {} } = {}) {
  const reminder_date = isoDate(offsetDays);
  return {
    id: REMINDER_ID,
    user_id: USER_ID,
    reminder_type: "declaration",
    reminder_date,
    status,
    metadata,
  };
}

// NORMAL ---------------------------------------------------------------

test("NORMAL — today is processable", () => {
  assert.equal(isReminderProcessable(reminderAt(0), NOW), true);
});

test("NORMAL — today+1 is processable", () => {
  assert.equal(isReminderProcessable(reminderAt(1), NOW), true);
});

test("NORMAL — today+2 is processable (inclusive upper bound)", () => {
  assert.equal(isReminderProcessable(reminderAt(2), NOW), true);
});

test("NORMAL — today+3 is excluded", () => {
  assert.equal(isReminderProcessable(reminderAt(3), NOW), false);
});

// CATCH-UP ---------------------------------------------------------------

test("CATCH-UP — one day overdue, still useful -> eligible", () => {
  assert.equal(isReminderProcessable(reminderAt(-1), NOW), true);
});

test("CATCH-UP — overdue exactly at the usefulness boundary (deadline day) -> eligible", () => {
  assert.equal(isReminderProcessable(reminderAt(-REMINDER_LEAD_DAYS), NOW), true);
});

test("CATCH-UP — beyond the usefulness boundary (deadline already passed) -> excluded", () => {
  assert.equal(isReminderProcessable(reminderAt(-REMINDER_LEAD_DAYS - 1), NOW), false);
});

test("CATCH-UP — overdue by months -> excluded (bounded, not an unlimited backlog)", () => {
  assert.equal(isReminderProcessable(reminderAt(-90), NOW), false);
});

// RETRY --------------------------------------------------------------------

test("RETRY — transient failure under the limit -> eligible", () => {
  const reminderDate = isoDate(0);
  const metadata = {
    provider_status: "failed",
    attempt_count: 1,
    logical_delivery_key: keyFor(reminderDate),
  };
  assert.equal(isReminderProcessable(reminderAt(0, { metadata }), NOW), true);
});

test("RETRY — transient failure at the attempt limit -> excluded (exhausted)", () => {
  const reminderDate = isoDate(0);
  const metadata = {
    provider_status: "failed",
    attempt_count: MAX_ATTEMPTS,
    logical_delivery_key: keyFor(reminderDate),
  };
  assert.equal(isReminderProcessable(reminderAt(0, { metadata }), NOW), false);
});

test("RETRY — permanent failure (conflict) -> excluded regardless of attempt_count", () => {
  const reminderDate = isoDate(0);
  const metadata = {
    provider_status: "conflict",
    attempt_count: 1,
    logical_delivery_key: keyFor(reminderDate),
  };
  assert.equal(isReminderProcessable(reminderAt(0, { metadata }), NOW), false);
});

test("RETRY — unknown outcome within the safe 24h window -> eligible", () => {
  const reminderDate = isoDate(0);
  const metadata = {
    provider_status: "unknown",
    attempt_count: 1,
    logical_delivery_key: keyFor(reminderDate),
    last_attempt_at: new Date(NOW.getTime() - 6 * 60 * 60 * 1000).toISOString(), // 6h ago
  };
  assert.equal(isReminderProcessable(reminderAt(0, { metadata }), NOW), true);
});

test("RETRY — unknown outcome past the safe 24h window -> excluded (conservative, no blind resend)", () => {
  const reminderDate = isoDate(0);
  const metadata = {
    provider_status: "unknown",
    attempt_count: 1,
    logical_delivery_key: keyFor(reminderDate),
    last_attempt_at: new Date(NOW.getTime() - 30 * 60 * 60 * 1000).toISOString(), // 30h ago
  };
  assert.equal(isReminderProcessable(reminderAt(0, { metadata }), NOW), false);
});

test("RETRY — accepted metadata with status drift (still 'pending') -> excluded, never a fresh send", () => {
  const reminderDate = isoDate(0);
  const metadata = {
    provider_status: "accepted",
    provider_message_id: "msg_123",
    logical_delivery_key: keyFor(reminderDate),
  };
  // status is still "pending" here on purpose -- this models Phase A
  // succeeding (durable accepted outcome) but Phase B never completing.
  assert.equal(isReminderProcessable(reminderAt(0, { status: "pending", metadata }), NOW), false);
});

test("RETRY — status='failed' (terminal) is excluded outright, independent of metadata", () => {
  const reminderDate = isoDate(0);
  const metadata = { provider_status: "failed", attempt_count: 1, logical_delivery_key: keyFor(reminderDate) };
  assert.equal(isReminderProcessable(reminderAt(0, { status: "failed", metadata }), NOW), false);
});

test("RETRY — status='sent' is excluded outright", () => {
  assert.equal(isReminderProcessable(reminderAt(0, { status: "sent" }), NOW), false);
});

test("RETRY — no real 'cancelled' status exists; a status not in {pending} is simply excluded", () => {
  assert.equal(isReminderProcessable(reminderAt(0, { status: "cancelled" }), NOW), false);
});

// OVERLAP — old occurrence vs new occurrence (LOT 7.31 section 17/18) -----

test("OVERLAP — a new occurrence is fresh-eligible even though stale metadata from a superseded occurrence sits on the row", () => {
  const oldOccurrenceKey = "declaration:931a309f-c7fb-4e5b-8c88-7c99da0dd9ef:2026-05-01";
  const staleMetadata = {
    provider_status: "accepted", // the OLD occurrence really was sent
    attempt_count: 1,
    logical_delivery_key: oldOccurrenceKey, // does NOT match the row's current reminder_date
  };
  // reminder_date is TODAY (a brand new occurrence); metadata still shows
  // the old, unrelated occurrence's key.
  assert.equal(isReminderProcessable(reminderAt(0, { metadata: staleMetadata }), NOW), true);
});

test("OVERLAP — a superseded occurrence's exhausted retry state does not block the new occurrence", () => {
  const oldOccurrenceKey = "declaration:931a309f-c7fb-4e5b-8c88-7c99da0dd9ef:2026-05-01";
  const staleMetadata = {
    provider_status: "failed",
    attempt_count: MAX_ATTEMPTS, // exhausted, but for the OLD occurrence
    retry_exhausted_at: "2026-05-08T08:00:00.000Z",
    logical_delivery_key: oldOccurrenceKey,
  };
  assert.equal(isReminderProcessable(reminderAt(0, { metadata: staleMetadata }), NOW), true);
});

test("OVERLAP — the CURRENT occurrence's own exhaustion is still respected (not blanket-ignored)", () => {
  const reminderDate = isoDate(0);
  const metadata = {
    provider_status: "failed",
    attempt_count: MAX_ATTEMPTS,
    logical_delivery_key: keyFor(reminderDate), // matches the row's actual current occurrence
  };
  assert.equal(isReminderProcessable(reminderAt(0, { metadata }), NOW), false);
});
