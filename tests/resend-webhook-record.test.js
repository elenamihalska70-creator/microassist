import test from "node:test";
import assert from "node:assert/strict";
import { buildDeliveryEventRecord } from "../supabase/functions/resend-webhook/buildDeliveryEventRecord.js";

// UNIT — LOT 8.13 section 9. Persistence DTO must match the delivery_events
// migration contract (LOT 8.12) exactly: no raw payload, no recipient/
// subject PII, only the approved normalized fields.

const baseFields = {
  svixId: "msg_p5jXN8AQM9LWM0D4loKWxJek",
  eventType: "email.delivered",
  providerMessageId: "56761188-7520-42d8-8898-ff6fc54ce618",
  eventCreatedAt: "2026-02-22T23:41:12.126Z",
  reminderId: "11111111-1111-1111-1111-111111111111",
};

test("builds the exact delivery_events row shape for a delivered event", () => {
  const payload = {
    type: "email.delivered",
    data: { email_id: baseFields.providerMessageId, to: ["user@example.com"], subject: "Rappel TVA" },
  };
  const record = buildDeliveryEventRecord(payload, baseFields);
  assert.deepEqual(record, {
    svix_id: "msg_p5jXN8AQM9LWM0D4loKWxJek",
    provider: "resend",
    provider_message_id: "56761188-7520-42d8-8898-ff6fc54ce618",
    reminder_id: "11111111-1111-1111-1111-111111111111",
    event_type: "email.delivered",
    event_created_at: "2026-02-22T23:41:12.126Z",
    bounce_type: null,
    failure_reason: null,
  });
});

test("does not leak recipient (to) or subject from the payload into the record", () => {
  const payload = {
    type: "email.delivered",
    data: { email_id: baseFields.providerMessageId, to: ["user@example.com"], subject: "Rappel TVA" },
  };
  const record = buildDeliveryEventRecord(payload, baseFields);
  const values = JSON.stringify(record);
  assert.doesNotMatch(values, /user@example\.com/);
  assert.doesNotMatch(values, /Rappel TVA/);
});

test("bounced event carries bounce_type, no failure_reason", () => {
  const payload = {
    type: "email.bounced",
    data: { email_id: baseFields.providerMessageId, bounce: { type: "Permanent", subType: "Suppressed" } },
  };
  const record = buildDeliveryEventRecord(payload, { ...baseFields, eventType: "email.bounced" });
  assert.equal(record.bounce_type, "Permanent");
  assert.equal(record.failure_reason, null);
});

test("failed event carries failure_reason, no bounce_type -- section 13 distinction preserved", () => {
  const payload = {
    type: "email.failed",
    data: { email_id: baseFields.providerMessageId, failed: { reason: "reached_daily_quota" } },
  };
  const record = buildDeliveryEventRecord(payload, { ...baseFields, eventType: "email.failed" });
  assert.equal(record.failure_reason, "reached_daily_quota");
  assert.equal(record.bounce_type, null);
});

test("reminder_id defaults to null when omitted (uncorrelated event, LOT 8.12 section 14)", () => {
  const payload = { type: "email.sent", data: { email_id: baseFields.providerMessageId } };
  const record = buildDeliveryEventRecord(payload, { ...baseFields, eventType: "email.sent", reminderId: null });
  assert.equal(record.reminder_id, null);
});

test("reminder_id explicitly undefined is normalized to null, not left undefined", () => {
  const payload = { type: "email.sent", data: { email_id: baseFields.providerMessageId } };
  const { reminderId: _reminderId, ...rest } = baseFields;
  const record = buildDeliveryEventRecord(payload, { ...rest, eventType: "email.sent" });
  assert.equal(record.reminder_id, null);
  assert.equal("reminder_id" in record, true);
});

test("provider is always 'resend'", () => {
  const payload = { type: "email.sent", data: { email_id: baseFields.providerMessageId } };
  const record = buildDeliveryEventRecord(payload, { ...baseFields, eventType: "email.sent" });
  assert.equal(record.provider, "resend");
});
