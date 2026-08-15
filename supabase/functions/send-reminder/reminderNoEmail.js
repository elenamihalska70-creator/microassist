// Pure, runtime-agnostic (Deno + Node) no-email finalize helpers (LOT 7.24).
//
// A reminder with no resolvable user email is a terminal failure that never
// reaches the provider -- it must not be recorded with the buildAttemptMetadata
// shape (LOT 7.6/7.20), which documents its provider/provider_status/
// provider_message_id fields as meaning a provider round-trip occurred. No
// such round-trip happens here.
//
// A reclaimed reminder can still carry metadata from an EARLIER attempt that
// did reach the provider (e.g. Phase A persisted "failed"/"unknown" and
// Phase B never finalized). buildNoEmailMetadata keeps that history intact
// (nothing is deleted) but stamps a distinct, newer no_email_at marker so a
// reader can tell the latest processing outcome was a no-email skip, not a
// stale provider attempt.

export function buildNoEmailMetadata(claimedMetadata, noEmailAt) {
  const previous =
    claimedMetadata && typeof claimedMetadata === "object" && !Array.isArray(claimedMetadata)
      ? claimedMetadata
      : {};

  return {
    ...previous,
    no_email_at: noEmailAt,
  };
}

// Mirrors the ownership-checked-write result shape already used by the
// replay-finalize / Phase A / Phase B writes in index.ts: a Supabase
// `.update(...).eq(...).eq("metadata->claim->>claim_token", claimToken).select("id")`
// call either errors, matches zero rows (claim lost to a newer invocation),
// or matches the row it just claimed.
export function resolveNoEmailFinalizeResult(reminderId, { error, rows } = {}) {
  if (error) {
    return { id: reminderId, status: "finalize_failed", reason: "No email" };
  }
  if (!rows || rows.length === 0) {
    return { id: reminderId, status: "skipped", reason: "claim_lost_before_no_email_finalize" };
  }
  return { id: reminderId, status: "failed", reason: "No email" };
}
