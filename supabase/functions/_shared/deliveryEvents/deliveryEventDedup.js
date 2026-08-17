// Pure, runtime-agnostic (Deno + Node) webhook-event deduplication
// decision (LOT 8.12 section 6). Resend delivers at-least-once and
// duplicates are expected, not exceptional (LOT 8.11 section 4/11,
// confirmed against Resend's own docs) -- svix_id is the documented
// dedup key, NOT provider_message_id + event_type, because multiple
// legitimate distinct events legitimately share both (e.g. a delayed
// bounce still shares provider_message_id with its earlier email.sent,
// and two different reminders could in principle share event_type).
//
// The durable source of truth is the DB's own `unique (svix_id)`
// constraint on delivery_events (see migration) -- this helper exists for
// callers that already know whether a svix_id has been seen (e.g. a
// pre-insert lookup, or a duplicate-key error caught from the insert
// itself), not as a replacement for that constraint.

export function isDuplicateDeliveryEvent(svixId, knownSvixIds) {
  if (typeof svixId !== "string" || svixId.length === 0) return false;
  if (knownSvixIds instanceof Set) return knownSvixIds.has(svixId);
  if (Array.isArray(knownSvixIds)) return knownSvixIds.includes(svixId);
  return false;
}
