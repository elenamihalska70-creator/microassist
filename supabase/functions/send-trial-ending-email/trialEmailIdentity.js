// LOT 10.1G (promoted from LOT 10.1F's design prototype, now wired into
// index.ts). Pure, runtime-agnostic (Deno + Node) logical identity for
// one trial lifecycle email occurrence. Mirrors send-reminder's
// reminderIdentity.js shape/philosophy (logical key + provider
// idempotency key derived from it).
//
// Identity is (event_type, user_id, trial_ends_at) -- NOT email address.
// user_id is durable across devices/browsers/sessions (email can
// change); trial_ends_at is included so a genuine future second trial (a
// new trial_ends_at, if product policy ever grants one) gets a fresh
// identity instead of being permanently blocked by the first trial's
// row, the way the old email_events unique index on
// (lower(email), event_type) would have blocked it forever.
const PROVIDER_IDEMPOTENCY_PREFIX = "microassist/trial-email";

export function buildTrialEmailLogicalKey({ userId, eventType, trialEndsAt }) {
  if (!userId || !eventType || !trialEndsAt) return null;
  return `${eventType}:${userId}:${trialEndsAt}`;
}

export function buildTrialEmailIdempotencyKey(logicalKey) {
  if (!logicalKey) return null;
  return `${PROVIDER_IDEMPOTENCY_PREFIX}/${logicalKey}`;
}
