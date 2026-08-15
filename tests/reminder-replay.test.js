import test from "node:test";
import assert from "node:assert/strict";
import {
  hasDurableAcceptedOutcome,
  occurrenceScopedMetadata,
  hasFrozenPayloadForOccurrence,
  hasFrozenRecipientForOccurrence,
} from "../supabase/functions/send-reminder/reminderReplay.js";

// UNIT — LOT 7.22 replay-safety decision. A reclaim must not trigger a
// second provider call when a prior attempt's outcome was already durably
// persisted as "accepted" for this exact logical delivery (Phase A
// succeeded, Phase B/finalize did not).

const LOGICAL_KEY = "declaration:931a309f-c7fb-4e5b-8c88-7c99da0dd9ef:2026-08-23";

test("accepted outcome for the same logical delivery -> true (skip provider call)", () => {
  const metadata = { provider_status: "accepted", logical_delivery_key: LOGICAL_KEY };
  assert.equal(hasDurableAcceptedOutcome(metadata, LOGICAL_KEY), true);
});

test("no prior metadata (first-ever attempt) -> false", () => {
  assert.equal(hasDurableAcceptedOutcome({}, LOGICAL_KEY), false);
  assert.equal(hasDurableAcceptedOutcome(null, LOGICAL_KEY), false);
});

test("failed/unknown/conflict/concurrent outcomes -> false (must retry provider)", () => {
  for (const providerStatus of ["failed", "unknown", "conflict", "concurrent"]) {
    const metadata = { provider_status: providerStatus, logical_delivery_key: LOGICAL_KEY };
    assert.equal(hasDurableAcceptedOutcome(metadata, LOGICAL_KEY), false);
  }
});

test("accepted outcome recorded under a DIFFERENT logical delivery key -> false", () => {
  const metadata = {
    provider_status: "accepted",
    logical_delivery_key: "declaration:931a309f-c7fb-4e5b-8c88-7c99da0dd9ef:2026-09-23",
  };
  assert.equal(hasDurableAcceptedOutcome(metadata, LOGICAL_KEY), false);
});

test("accepted outcome with missing logical_delivery_key -> false (fail closed, not open)", () => {
  const metadata = { provider_status: "accepted" };
  assert.equal(hasDurableAcceptedOutcome(metadata, LOGICAL_KEY), false);
});

test("non-object metadata -> false, does not throw", () => {
  assert.equal(hasDurableAcceptedOutcome("accepted", LOGICAL_KEY), false);
  assert.equal(hasDurableAcceptedOutcome(42, LOGICAL_KEY), false);
});

// LOT 7.32 — occurrenceScopedMetadata is the fix for the masking bug this
// LOT found: claim_reminder unconditionally refreshes
// metadata.logical_delivery_key on every successful claim, so a raw
// post-claim metadata blob's key always matches the current occurrence
// trivially, even when the rest of the metadata belongs to a DIFFERENT,
// superseded occurrence. Every function below must be given PRE-claim
// metadata to mean anything.

test("occurrenceScopedMetadata: same key -> metadata passed through unchanged", () => {
  const metadata = { provider_status: "failed", attempt_count: 2, logical_delivery_key: LOGICAL_KEY };
  assert.deepEqual(occurrenceScopedMetadata(metadata, LOGICAL_KEY), metadata);
});

test("occurrenceScopedMetadata: different key -> {} (superseded occurrence discarded)", () => {
  const metadata = {
    provider_status: "accepted",
    attempt_count: 2,
    logical_delivery_key: "declaration:931a309f-c7fb-4e5b-8c88-7c99da0dd9ef:2026-05-23",
  };
  assert.deepEqual(occurrenceScopedMetadata(metadata, LOGICAL_KEY), {});
});

test("occurrenceScopedMetadata: no key at all (first-ever attempt) -> {}", () => {
  assert.deepEqual(occurrenceScopedMetadata({}, LOGICAL_KEY), {});
  assert.deepEqual(occurrenceScopedMetadata(null, LOGICAL_KEY), {});
});

// The regression this whole LOT exists to close: a genuinely-accepted send
// for an OLD occurrence must never make a NEW occurrence on the same row
// (frequency change -> new reminder_date, same (user_id, reminder_type)
// unique row) look like it was already sent.
test("CRITICAL: stale accepted outcome from a superseded occurrence is not durable for the new one", () => {
  const staleAcceptedFromOldOccurrence = {
    provider_status: "accepted",
    provider_message_id: "msg_old",
    logical_delivery_key: "declaration:931a309f-c7fb-4e5b-8c88-7c99da0dd9ef:2026-05-23",
    rendered_subject: "old subject",
    rendered_html: "<p>old</p>",
    recipient_snapshot: "old@example.com",
  };
  const newOccurrenceKey = "declaration:931a309f-c7fb-4e5b-8c88-7c99da0dd9ef:2026-08-23";

  assert.equal(hasDurableAcceptedOutcome(staleAcceptedFromOldOccurrence, newOccurrenceKey), false);
  assert.equal(hasFrozenPayloadForOccurrence(staleAcceptedFromOldOccurrence, newOccurrenceKey), false);
  assert.equal(hasFrozenRecipientForOccurrence(staleAcceptedFromOldOccurrence, newOccurrenceKey), false);
});

test("hasFrozenPayloadForOccurrence: same occurrence, both fields present -> true", () => {
  const metadata = {
    logical_delivery_key: LOGICAL_KEY,
    rendered_subject: "subject",
    rendered_html: "<p>html</p>",
  };
  assert.equal(hasFrozenPayloadForOccurrence(metadata, LOGICAL_KEY), true);
});

test("hasFrozenPayloadForOccurrence: same occurrence but only one field present -> false", () => {
  assert.equal(
    hasFrozenPayloadForOccurrence({ logical_delivery_key: LOGICAL_KEY, rendered_subject: "subject" }, LOGICAL_KEY),
    false,
  );
});

test("hasFrozenRecipientForOccurrence: same occurrence, field present -> true", () => {
  const metadata = { logical_delivery_key: LOGICAL_KEY, recipient_snapshot: "user@example.com" };
  assert.equal(hasFrozenRecipientForOccurrence(metadata, LOGICAL_KEY), true);
});

test("hasFrozenRecipientForOccurrence: different occurrence -> false even though field is present", () => {
  const metadata = {
    logical_delivery_key: "declaration:931a309f-c7fb-4e5b-8c88-7c99da0dd9ef:2026-05-23",
    recipient_snapshot: "old@example.com",
  };
  assert.equal(hasFrozenRecipientForOccurrence(metadata, LOGICAL_KEY), false);
});
