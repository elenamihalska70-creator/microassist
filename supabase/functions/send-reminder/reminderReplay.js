// Pure, runtime-agnostic (Deno + Node) occurrence-identity and
// replay-safety decisions (LOT 7.22, extended LOT 7.32).
//
// A claim can be reclaimed after a prior attempt whose provider outcome was
// durably persisted (Phase A) but whose status finalize did not complete
// (Phase B failed or never ran). In that case the provider already accepted
// the send: calling it again must be avoided, not merely tolerated via the
// provider's own idempotency dedup.
//
// LOT 7.32 finding: `reminders` has a UNIQUE(user_id, reminder_type)
// constraint, so a fiscal-profile save upserts a NEW reminder_date onto the
// SAME row (resetting status to "pending") without ever touching metadata.
// The claim_reminder RPC then unconditionally refreshes
// metadata.logical_delivery_key to whatever key the caller just computed
// from the row's CURRENT state, on every successful claim -- including a
// claim on a row whose occurrence just changed. That means comparing the
// RPC's returned metadata's logical_delivery_key against the current key
// ALWAYS matches, trivially, even when the rest of that metadata
// (provider_status, rendered_subject/html, recipient_snapshot,
// attempt_count) is a leftover from a DIFFERENT, superseded occurrence.
// Concretely: a reminder that was genuinely accepted once, whose user later
// edits their fiscal profile (creating a new occurrence on the same row),
// would otherwise be silently treated as "already accepted" forever after
// -- finalized to "sent" without ever calling the provider for the new
// occurrence. Every function here MUST be evaluated against PRE-claim
// metadata (the row as read by the initial SELECT, before this
// invocation's claim_reminder call touched it) -- never against the claim
// RPC's return value.

function normalizeMetadata(metadata) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
}

function belongsToOccurrence(metadata, logicalDeliveryKey) {
  const meta = normalizeMetadata(metadata);
  return meta.logical_delivery_key === logicalDeliveryKey;
}

// Single choke point: returns preClaimMetadata unchanged if it belongs to
// the occurrence being claimed right now, otherwise `{}`. Every other
// function in this module routes through this before trusting anything
// beyond logical_delivery_key itself.
export function occurrenceScopedMetadata(preClaimMetadata, logicalDeliveryKey) {
  return belongsToOccurrence(preClaimMetadata, logicalDeliveryKey)
    ? normalizeMetadata(preClaimMetadata)
    : {};
}

export function hasDurableAcceptedOutcome(preClaimMetadata, logicalDeliveryKey) {
  const scoped = occurrenceScopedMetadata(preClaimMetadata, logicalDeliveryKey);
  return scoped.provider_status === "accepted";
}

// LOT 7.32 / LOT 7.31 section 17: a frozen rendering from a PRIOR
// occurrence must never be reused for the current one -- same root cause
// as the accepted-outcome masking above.
export function hasFrozenPayloadForOccurrence(preClaimMetadata, logicalDeliveryKey) {
  const scoped = occurrenceScopedMetadata(preClaimMetadata, logicalDeliveryKey);
  return typeof scoped.rendered_subject === "string" && typeof scoped.rendered_html === "string";
}

export function hasFrozenRecipientForOccurrence(preClaimMetadata, logicalDeliveryKey) {
  const scoped = occurrenceScopedMetadata(preClaimMetadata, logicalDeliveryKey);
  return typeof scoped.recipient_snapshot === "string";
}
