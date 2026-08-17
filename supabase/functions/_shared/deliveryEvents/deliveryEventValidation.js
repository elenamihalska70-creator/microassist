// Pure, runtime-agnostic (Deno + Node) Resend webhook payload validation
// and field extraction (LOT 8.12). No network/Supabase dependency -- this
// module only reads a parsed webhook payload object; signature
// verification and the HTTP layer belong to the future resend-webhook
// function (LOT 8.13, not implemented here).
//
// Exact event type names and payload shapes confirmed against Resend's
// own docs (LOT 8.11 section 3), not assumed from memory.

export const SUPPORTED_EVENT_TYPES = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.failed",
];

export function isSupportedEventType(type) {
  return typeof type === "string" && SUPPORTED_EVENT_TYPES.includes(type);
}

// data.email_id is Resend's own send-time identifier -- the same value
// already persisted as reminders.metadata.provider_message_id (LOT 8.11
// section 7, confirmed against Resend docs). Deliberately NOT
// data.message_id, which is the RFC 5322 Message-ID header: a different,
// secondary identifier never used for correlation in this system.
export function extractProviderMessageId(webhookPayload) {
  const emailId = webhookPayload?.data?.email_id;
  return typeof emailId === "string" && emailId.length > 0 ? emailId : null;
}

// Ordering must use the provider's own event timestamp, never local
// receive time (LOT 8.11 section 11/12). Returns a normalized ISO string,
// or null if the payload's created_at is missing/unparseable -- callers
// must treat null as "cannot order, cannot trust this event's timing."
export function normalizeEventCreatedAt(rawCreatedAt) {
  if (typeof rawCreatedAt !== "string") return null;
  const parsed = new Date(rawCreatedAt);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

// email.bounced only. Resend's confirmed example shows bounce.type:
// "Permanent" (LOT 8.11 section 3) -- no authoritative full enumeration
// was found, so this only extracts the value, it does not validate it
// against a fixed set (see migration comment for why the DB doesn't
// either).
export function extractBounceType(webhookPayload) {
  const type = webhookPayload?.data?.bounce?.type;
  return typeof type === "string" && type.length > 0 ? type : null;
}

// email.failed only. Distinct field from bounce -- LOT 8.11 section 13 /
// this LOT section 13 require failed vs bounced to remain distinguishable,
// never collapsed into one generic failure.
export function extractFailureReason(webhookPayload) {
  const reason = webhookPayload?.data?.failed?.reason;
  return typeof reason === "string" && reason.length > 0 ? reason : null;
}
