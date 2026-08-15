import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_ATTEMPTS,
  classifyFailure,
  isRetryable,
  isRetryExhausted,
  buildRetryPolicyFields,
} from "../supabase/functions/send-reminder/reminderRetryPolicy.js";

// UNIT — LOT 7.32 retry-policy contract. All inputs here are already
// occurrence-scoped metadata (as produced by
// reminderReplay.js#occurrenceScopedMetadata) -- cross-occurrence leakage
// itself is covered in reminder-replay.test.js.

test("MAX_ATTEMPTS is the LOT 7.31-approved budget", () => {
  assert.equal(MAX_ATTEMPTS, 3);
});

// classifyFailure -------------------------------------------------------

test("classifyFailure: accepted -> null (not a failure)", () => {
  assert.equal(classifyFailure({ provider_status: "accepted" }), null);
});

test("classifyFailure: failed -> transient (conservative default)", () => {
  assert.equal(classifyFailure({ provider_status: "failed" }), "transient");
});

test("classifyFailure: concurrent -> transient", () => {
  assert.equal(classifyFailure({ provider_status: "concurrent" }), "transient");
});

test("classifyFailure: conflict -> permanent", () => {
  assert.equal(classifyFailure({ provider_status: "conflict" }), "permanent");
});

test("classifyFailure: unknown -> unknown", () => {
  assert.equal(classifyFailure({ provider_status: "unknown" }), "unknown");
});

test("classifyFailure: no_email_at set -> permanent, regardless of provider_status", () => {
  assert.equal(classifyFailure({ no_email_at: "2026-08-15T08:00:00.000Z" }), "permanent");
  assert.equal(
    classifyFailure({ no_email_at: "2026-08-15T08:00:00.000Z", provider_status: "accepted" }),
    "permanent",
  );
});

test("classifyFailure: no attempt yet -> null", () => {
  assert.equal(classifyFailure({}), null);
});

// isRetryable -------------------------------------------------------------

test("accepted -> never retryable (central invariant)", () => {
  assert.equal(isRetryable({ provider_status: "accepted", attempt_count: 1 }), false);
});

test("transient failure under limit -> retryable", () => {
  const metadata = { provider_status: "failed", attempt_count: 1 };
  assert.equal(isRetryable(metadata), true);
});

test("transient failure at limit -> exhausted, not retryable", () => {
  const metadata = { provider_status: "failed", attempt_count: MAX_ATTEMPTS };
  assert.equal(isRetryable(metadata), false);
  assert.equal(isRetryExhausted(metadata), true);
});

test("permanent failure (conflict) -> not retryable regardless of attempt_count", () => {
  assert.equal(isRetryable({ provider_status: "conflict", attempt_count: 1 }), false);
});

test("no-email -> permanent, not retryable", () => {
  const metadata = { no_email_at: "2026-08-15T08:00:00.000Z", attempt_count: 1 };
  assert.equal(isRetryable(metadata), false);
  assert.equal(isRetryExhausted(metadata), false); // nothing to exhaust, never had a budget
});

test("unknown within 24h -> retryable", () => {
  const metadata = {
    provider_status: "unknown",
    attempt_count: 1,
    last_attempt_at: "2026-08-15T08:00:00.000Z",
  };
  const now = new Date("2026-08-15T20:00:00.000Z"); // 12h later
  assert.equal(isRetryable(metadata, { now }), true);
  assert.equal(isRetryExhausted(metadata, { now }), false);
});

test("unknown exactly at 24h boundary -> exhausted (conservative: >= window counts)", () => {
  const metadata = {
    provider_status: "unknown",
    attempt_count: 1,
    last_attempt_at: "2026-08-15T08:00:00.000Z",
  };
  const now = new Date("2026-08-16T08:00:00.000Z"); // exactly 24h later
  assert.equal(isRetryExhausted(metadata, { now }), true);
  assert.equal(isRetryable(metadata, { now }), false);
});

test("unknown after 24h with no resolution -> conservative: not retryable, stop (LOT 7.31 section 16)", () => {
  const metadata = {
    provider_status: "unknown",
    attempt_count: 1,
    last_attempt_at: "2026-08-15T08:00:00.000Z",
  };
  const now = new Date("2026-08-17T08:00:00.000Z"); // 48h later
  assert.equal(isRetryable(metadata, { now }), false);
  assert.equal(isRetryExhausted(metadata, { now }), true);
});

test("unknown under 24h but attempt_count already at limit -> exhausted by count, not time", () => {
  const metadata = {
    provider_status: "unknown",
    attempt_count: MAX_ATTEMPTS,
    last_attempt_at: "2026-08-15T08:00:00.000Z",
  };
  const now = new Date("2026-08-15T08:05:00.000Z"); // 5 minutes later
  assert.equal(isRetryExhausted(metadata, { now }), true);
});

test("never-attempted metadata -> retryable (nothing blocks first processing)", () => {
  assert.equal(isRetryable({}), true);
  assert.equal(isRetryable(null), true);
});

// buildRetryPolicyFields ---------------------------------------------------

test("retry_exhausted_at set correctly on the attempt that reaches the limit", () => {
  const now = new Date("2026-08-15T08:00:01.000Z");
  const outcomeMetadata = {
    provider_status: "failed",
    attempt_count: MAX_ATTEMPTS,
    last_attempt_at: now.toISOString(),
  };
  const fields = buildRetryPolicyFields(outcomeMetadata, { now });
  assert.equal(fields.last_failure_category, "transient");
  assert.equal(fields.retry_exhausted_at, now.toISOString());
});

test("retry_exhausted_at stays null while under the limit", () => {
  const now = new Date("2026-08-15T08:00:01.000Z");
  const outcomeMetadata = { provider_status: "failed", attempt_count: 1, last_attempt_at: now.toISOString() };
  const fields = buildRetryPolicyFields(outcomeMetadata, { now });
  assert.equal(fields.retry_exhausted_at, null);
});

test("retry_exhausted_at is set once and preserved, not overwritten with a later timestamp", () => {
  const firstExhaustedAt = "2026-08-15T08:00:01.000Z";
  const outcomeMetadata = {
    provider_status: "failed",
    attempt_count: MAX_ATTEMPTS,
    last_attempt_at: "2026-08-16T08:00:01.000Z",
    retry_exhausted_at: firstExhaustedAt,
  };
  const fields = buildRetryPolicyFields(outcomeMetadata, { now: new Date("2026-08-16T08:00:01.000Z") });
  assert.equal(fields.retry_exhausted_at, firstExhaustedAt);
});

test("accepted outcome -> last_failure_category null, retry_exhausted_at null", () => {
  const fields = buildRetryPolicyFields({ provider_status: "accepted", attempt_count: 1 });
  assert.equal(fields.last_failure_category, null);
  assert.equal(fields.retry_exhausted_at, null);
});

test("buildRetryPolicyFields only returns the two new keys -- does not echo or mutate the rest of metadata", () => {
  const outcomeMetadata = {
    provider_status: "failed",
    attempt_count: 1,
    provider_message_id: "msg_123",
    rendered_subject: "keep me",
  };
  const fields = buildRetryPolicyFields(outcomeMetadata);
  assert.deepEqual(Object.keys(fields).sort(), ["last_failure_category", "retry_exhausted_at"]);
});

test("existing metadata keys are preserved when the caller spreads buildRetryPolicyFields on top", () => {
  const outcomeMetadata = {
    provider: "resend",
    provider_status: "failed",
    provider_message_id: null,
    attempt_count: 1,
    last_attempt_at: "2026-08-15T08:00:01.000Z",
    failure_reason: "network error",
    logical_delivery_key: "declaration:abc:2026-08-23",
    idempotency_key: "microassist/reminder/declaration:abc:2026-08-23",
    rendered_subject: "subject",
    rendered_html: "<p>html</p>",
    recipient_snapshot: "user@example.com",
  };
  const merged = { ...outcomeMetadata, ...buildRetryPolicyFields(outcomeMetadata) };

  for (const key of Object.keys(outcomeMetadata)) {
    assert.equal(merged[key], outcomeMetadata[key], `expected ${key} to survive the merge unchanged`);
  }
  assert.equal(merged.last_failure_category, "transient");
});
