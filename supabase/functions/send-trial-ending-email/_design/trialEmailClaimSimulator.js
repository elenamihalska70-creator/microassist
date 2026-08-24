// LOT 10.1F design prototype, kept as a supplementary logic-proof after
// LOT 10.1G implemented the real thing. This module is NOT imported by
// index.ts -- the production concurrency mechanism is the real
// claim_trial_email/finalize_trial_email SQL (see the LOT 10.1G
// migration). This file remains only as a fast, no-database unit-tested
// model of that SQL's DECISION LOGIC, kept in sync by inspection: it
// proves the state machine is correct -- it does NOT prove Postgres-level
// atomicity under real concurrency. That guarantee comes from row locking
// inside a single INSERT ... ON CONFLICT DO UPDATE ... WHERE statement,
// the same mechanism already proven safe in production by claim_reminder
// (see supabase/migrations/20260814213308_create_claim_reminder_rpc.sql).
//
// `store` is a Map<logicalKey, { status, claimToken, claimedAt,
// claimExpiresAt, providerMessageId }>. `claimToken` is supplied by the
// caller (not generated here) so tests can model two distinct concurrent
// invocations deterministically.

export function claimTrialEmail(store, { logicalKey, now, claimToken, leaseMs = 5 * 60 * 1000 }) {
  if (!logicalKey || !claimToken) return { claimed: false, claimToken: null };

  const existing = store.get(logicalKey);

  if (!existing) {
    store.set(logicalKey, {
      status: "claimed",
      claimToken,
      claimedAt: now,
      claimExpiresAt: now + leaseMs,
      providerMessageId: null,
    });
    return { claimed: true, claimToken };
  }

  // Never reclaim a logical email that has already been durably sent --
  // this is the actual duplicate-send guard.
  if (existing.status === "sent") {
    return { claimed: false, claimToken: existing.claimToken };
  }

  // An active, unexpired claim is held by another in-flight invocation --
  // this is what makes two simultaneous requests race-safe: only one can
  // ever see `!existing` or an expired claim first.
  if (existing.status === "claimed" && existing.claimExpiresAt > now) {
    return { claimed: false, claimToken: existing.claimToken };
  }

  // Reclaimable: either a prior attempt terminated in failed/unknown
  // (retry path), or a prior claim's lease expired without finalizing
  // (crash-recovery path). Overwrite with a fresh claim.
  store.set(logicalKey, {
    status: "claimed",
    claimToken,
    claimedAt: now,
    claimExpiresAt: now + leaseMs,
    providerMessageId: existing.providerMessageId,
  });
  return { claimed: true, claimToken };
}

// Ownership-checked finalize, mirroring send-reminder's
// `.eq("metadata->claim->>claim_token", claimToken)` pattern: a caller
// whose claim has since been superseded (lease expired and reclaimed by a
// newer invocation) must not be able to overwrite that newer invocation's
// state.
export function finalizeTrialEmail(store, { logicalKey, claimToken, status, providerMessageId = null }) {
  const existing = store.get(logicalKey);
  if (!existing || existing.claimToken !== claimToken) {
    return { finalized: false, reason: "claim_lost" };
  }
  store.set(logicalKey, { ...existing, status, providerMessageId });
  return { finalized: true };
}
