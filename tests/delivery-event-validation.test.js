import test from "node:test";
import assert from "node:assert/strict";
import {
  SUPPORTED_EVENT_TYPES,
  isSupportedEventType,
  extractProviderMessageId,
  normalizeEventCreatedAt,
  extractBounceType,
  extractFailureReason,
} from "../supabase/functions/_shared/deliveryEvents/deliveryEventValidation.js";

// UNIT — LOT 8.12 delivery-event payload validation/extraction contract.
// Payload shapes below match Resend's own documented examples exactly
// (LOT 8.11 section 3), not invented shapes.

// isSupportedEventType ---------------------------------------------------

test("every LOT 8.11-confirmed Resend event type is supported", () => {
  const expected = [
    "email.sent",
    "email.delivered",
    "email.delivery_delayed",
    "email.bounced",
    "email.complained",
    "email.failed",
  ];
  assert.deepEqual([...SUPPORTED_EVENT_TYPES].sort(), [...expected].sort());
  for (const type of expected) {
    assert.equal(isSupportedEventType(type), true, `${type} must be supported`);
  }
});

test("unknown event type is rejected, not thrown", () => {
  assert.equal(isSupportedEventType("email.opened"), false);
  assert.equal(isSupportedEventType("something_unrelated"), false);
});

test("isSupportedEventType tolerates non-string/missing input", () => {
  assert.equal(isSupportedEventType(undefined), false);
  assert.equal(isSupportedEventType(null), false);
  assert.equal(isSupportedEventType(42), false);
});

// extractProviderMessageId -----------------------------------------------

test("extractProviderMessageId reads data.email_id (Resend's send-time id)", () => {
  const payload = {
    type: "email.delivered",
    data: { email_id: "56761188-7520-42d8-8898-ff6fc54ce618", message_id: "<111@example.com>" },
  };
  assert.equal(extractProviderMessageId(payload), "56761188-7520-42d8-8898-ff6fc54ce618");
});

test("extractProviderMessageId never falls back to message_id", () => {
  const payload = { type: "email.delivered", data: { message_id: "<111@example.com>" } };
  assert.equal(extractProviderMessageId(payload), null);
});

test("extractProviderMessageId handles missing email_id / missing data safely", () => {
  assert.equal(extractProviderMessageId({ data: {} }), null);
  assert.equal(extractProviderMessageId({}), null);
  assert.equal(extractProviderMessageId(null), null);
  assert.equal(extractProviderMessageId(undefined), null);
});

// normalizeEventCreatedAt -------------------------------------------------

test("normalizeEventCreatedAt normalizes a valid ISO timestamp", () => {
  assert.equal(normalizeEventCreatedAt("2026-02-22T23:41:12.126Z"), "2026-02-22T23:41:12.126Z");
});

test("normalizeEventCreatedAt returns null for unparseable/missing input", () => {
  assert.equal(normalizeEventCreatedAt("not-a-date"), null);
  assert.equal(normalizeEventCreatedAt(undefined), null);
  assert.equal(normalizeEventCreatedAt(null), null);
  assert.equal(normalizeEventCreatedAt(12345), null);
});

// extractBounceType / extractFailureReason --------------------------------

test("extractBounceType reads data.bounce.type from a bounced payload", () => {
  const payload = { type: "email.bounced", data: { bounce: { type: "Permanent", subType: "Suppressed" } } };
  assert.equal(extractBounceType(payload), "Permanent");
});

test("extractBounceType is null when no bounce object is present", () => {
  assert.equal(extractBounceType({ type: "email.delivered", data: {} }), null);
});

test("extractFailureReason reads data.failed.reason from a failed payload", () => {
  const payload = { type: "email.failed", data: { failed: { reason: "reached_daily_quota" } } };
  assert.equal(extractFailureReason(payload), "reached_daily_quota");
});

test("extractFailureReason is null when no failed object is present", () => {
  assert.equal(extractFailureReason({ type: "email.bounced", data: {} }), null);
});

test("distinct fields stay distinct: a bounced payload has no failure_reason, a failed payload has no bounce_type", () => {
  const bounced = { type: "email.bounced", data: { bounce: { type: "Permanent" } } };
  const failed = { type: "email.failed", data: { failed: { reason: "reached_daily_quota" } } };
  assert.equal(extractFailureReason(bounced), null);
  assert.equal(extractBounceType(failed), null);
});
