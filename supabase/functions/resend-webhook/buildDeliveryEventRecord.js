// Pure, runtime-agnostic (Deno + Node) delivery_events insert-row
// construction (LOT 8.13 section 9/13). Takes an already-verified Resend
// webhook payload plus the pre-computed correlation/dedup fields and
// returns exactly the shape the LOT 8.12 migration expects -- no raw
// payload, no recipient/subject PII, matching the approved model exactly.

import { extractBounceType, extractFailureReason } from "../_shared/deliveryEvents/deliveryEventValidation.js";

// verifiedPayload: the Svix-verified, parsed Resend event object.
// fields: { svixId, eventType, providerMessageId, eventCreatedAt, reminderId }
//   all pre-extracted/pre-validated by the caller (index.ts) using the
//   LOT 8.12 deliveryEventValidation helpers -- this function does not
//   re-derive them, it only assembles the final row.
export function buildDeliveryEventRecord(verifiedPayload, fields) {
  return {
    svix_id: fields.svixId,
    provider: "resend",
    provider_message_id: fields.providerMessageId,
    reminder_id: fields.reminderId ?? null,
    event_type: fields.eventType,
    event_created_at: fields.eventCreatedAt,
    bounce_type: extractBounceType(verifiedPayload),
    failure_reason: extractFailureReason(verifiedPayload),
  };
}
