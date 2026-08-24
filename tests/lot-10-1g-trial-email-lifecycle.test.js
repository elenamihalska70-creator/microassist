import test from "node:test";
import assert from "node:assert/strict";
import {
  computeTrialDaysLeft,
  resolveTrialEventType,
  ALLOWED_TRIAL_EVENT_TYPES,
} from "../supabase/functions/send-trial-ending-email/trialEmailLifecycle.js";

test("computeTrialDaysLeft: null/undefined/invalid input returns null (fail-safe, never guesses)", () => {
  assert.equal(computeTrialDaysLeft(null), null);
  assert.equal(computeTrialDaysLeft(undefined), null);
  assert.equal(computeTrialDaysLeft("not-a-date"), null);
});

test("computeTrialDaysLeft: clamps at 0 for a trial that has already ended", () => {
  const now = Date.parse("2026-09-01T00:00:00Z");
  const daysLeft = computeTrialDaysLeft("2026-08-01T00:00:00Z", now);
  assert.equal(daysLeft, 0);
});

test("computeTrialDaysLeft: matches the expected day count for a future trial_ends_at", () => {
  const now = Date.parse("2026-09-01T00:00:00Z");
  const daysLeft = computeTrialDaysLeft("2026-09-08T00:00:00Z", now);
  assert.equal(daysLeft, 7);
});

test("resolveTrialEventType: null daysLeft resolves to null (no event, no guessing)", () => {
  assert.equal(resolveTrialEventType(null), null);
});

test("resolveTrialEventType: daysLeft <= 0 resolves to trial_expired", () => {
  assert.equal(resolveTrialEventType(0), "trial_expired");
});

test("resolveTrialEventType: daysLeft in the near-boundary window resolves to trial_ending_j2", () => {
  assert.equal(resolveTrialEventType(1), "trial_ending_j2");
  assert.equal(resolveTrialEventType(2), "trial_ending_j2");
});

test("resolveTrialEventType: daysLeft in the wider window resolves to trial_ending_j7", () => {
  assert.equal(resolveTrialEventType(3), "trial_ending_j7");
  assert.equal(resolveTrialEventType(7), "trial_ending_j7");
});

test("resolveTrialEventType: daysLeft beyond every window resolves to null (not due -- server disagrees, request is skipped, not honored)", () => {
  assert.equal(resolveTrialEventType(8), null);
  assert.equal(resolveTrialEventType(30), null);
});

test("ALLOWED_TRIAL_EVENT_TYPES is exactly the three known lifecycle events, and frozen", () => {
  assert.deepEqual(ALLOWED_TRIAL_EVENT_TYPES, ["trial_ending_j7", "trial_ending_j2", "trial_expired"]);
  assert.ok(Object.isFrozen(ALLOWED_TRIAL_EVENT_TYPES));
});
