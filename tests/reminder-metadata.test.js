import test from "node:test";
import assert from "node:assert/strict";
import { buildAttemptMetadata } from "../supabase/functions/send-reminder/reminderMetadata.js";

// UNIT — LOT 7.6 minimum observability contract, built on the existing
// reminders.metadata jsonb column (no schema migration). provider_status is
// never "delivered": no delivery/bounce webhook exists (LOT 7.5, section 11).

test("first attempt, accepted: attempt_count starts at 1, message id persisted", () => {
  const metadata = buildAttemptMetadata(
    {},
    {
      attemptedAt: "2026-08-14T08:00:01.000Z",
      providerStatus: "accepted",
      providerMessageId: "msg_123",
    },
  );

  assert.deepEqual(metadata, {
    last_attempt_at: "2026-08-14T08:00:01.000Z",
    attempt_count: 1,
    provider: "resend",
    provider_message_id: "msg_123",
    provider_status: "accepted",
    failure_reason: null,
  });
});

test("first attempt, failed: failure_reason persisted, message id null", () => {
  const metadata = buildAttemptMetadata(
    {},
    {
      attemptedAt: "2026-08-14T08:00:01.000Z",
      providerStatus: "failed",
      failureReason: "Resend API error 429",
    },
  );

  assert.deepEqual(metadata, {
    last_attempt_at: "2026-08-14T08:00:01.000Z",
    attempt_count: 1,
    provider: "resend",
    provider_message_id: null,
    provider_status: "failed",
    failure_reason: "Resend API error 429",
  });
});

test("second attempt increments attempt_count from existing metadata", () => {
  const existing = {
    last_attempt_at: "2026-08-14T08:00:01.000Z",
    attempt_count: 1,
    provider: "resend",
    provider_message_id: null,
    provider_status: "failed",
    failure_reason: "Resend API error 429",
  };

  const metadata = buildAttemptMetadata(existing, {
    attemptedAt: "2026-08-15T08:00:01.000Z",
    providerStatus: "accepted",
    providerMessageId: "msg_456",
  });

  assert.equal(metadata.attempt_count, 2);
  assert.equal(metadata.last_attempt_at, "2026-08-15T08:00:01.000Z");
  assert.equal(metadata.provider_status, "accepted");
  assert.equal(metadata.provider_message_id, "msg_456");
});

test("a success clears a previous failure_reason (failure_reason reflects only the latest attempt)", () => {
  const existing = {
    attempt_count: 1,
    provider_status: "failed",
    failure_reason: "Resend API error 429",
  };

  const metadata = buildAttemptMetadata(existing, {
    attemptedAt: "2026-08-15T08:00:01.000Z",
    providerStatus: "accepted",
    providerMessageId: "msg_456",
  });

  assert.equal(metadata.failure_reason, null);
});

test("unrelated existing metadata keys are preserved (merge, not replace)", () => {
  const existing = { some_future_key: "kept", attempt_count: 3 };

  const metadata = buildAttemptMetadata(existing, {
    attemptedAt: "2026-08-14T08:00:01.000Z",
    providerStatus: "accepted",
    providerMessageId: "msg_789",
  });

  assert.equal(metadata.some_future_key, "kept");
  assert.equal(metadata.attempt_count, 4);
});

test("provider_status is never 'delivered' regardless of input (no delivery webhook exists)", () => {
  const metadata = buildAttemptMetadata(
    {},
    { attemptedAt: "2026-08-14T08:00:01.000Z", providerStatus: "accepted" },
  );

  assert.notEqual(metadata.provider_status, "delivered");
  assert.ok(["accepted", "failed"].includes(metadata.provider_status));
});

test("null/non-object existing metadata is treated as empty, not thrown", () => {
  const metadata = buildAttemptMetadata(null, {
    attemptedAt: "2026-08-14T08:00:01.000Z",
    providerStatus: "accepted",
  });

  assert.equal(metadata.attempt_count, 1);
});

// LOT 7.20 — extended provider_status vocabulary. None of these three may
// ever be conflated with a definite "failed": they each mean "we cannot
// prove the email was not sent", which matters once retry exists.

test("'unknown' outcome (no response received) is recorded distinctly from 'failed'", () => {
  const metadata = buildAttemptMetadata(
    {},
    {
      attemptedAt: "2026-08-14T08:00:01.000Z",
      providerStatus: "unknown",
      failureReason: "TypeError: fetch failed",
    },
  );

  assert.equal(metadata.provider_status, "unknown");
  assert.notEqual(metadata.provider_status, "failed");
  assert.equal(metadata.failure_reason, "TypeError: fetch failed");
  assert.equal(metadata.attempt_count, 1);
});

test("'conflict' outcome (invalid_idempotent_request) is recorded distinctly from 'failed'", () => {
  const metadata = buildAttemptMetadata(
    {},
    {
      attemptedAt: "2026-08-14T08:00:01.000Z",
      providerStatus: "conflict",
      failureReason: "Idempotency key already used with a different payload",
    },
  );

  assert.equal(metadata.provider_status, "conflict");
  assert.notEqual(metadata.provider_status, "failed");
});

test("'concurrent' outcome (concurrent_idempotent_requests) is recorded distinctly from 'failed'", () => {
  const metadata = buildAttemptMetadata(
    {},
    {
      attemptedAt: "2026-08-14T08:00:01.000Z",
      providerStatus: "concurrent",
      failureReason: "A request with this idempotency key is already in progress",
    },
  );

  assert.equal(metadata.provider_status, "concurrent");
  assert.notEqual(metadata.provider_status, "failed");
});
