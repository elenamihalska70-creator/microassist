// Pure, runtime-agnostic (Deno + Node) replay-safety decision (LOT 7.22).
//
// A claim can be reclaimed after a prior attempt whose provider outcome was
// durably persisted (Phase A) but whose status finalize did not complete
// (Phase B failed or never ran). In that case the provider already accepted
// the send: calling it again must be avoided, not merely tolerated via the
// provider's own idempotency dedup. This function is the single place that
// decides whether a reclaimed logical delivery already carries that proof.

export function hasDurableAcceptedOutcome(claimedMetadata, logicalDeliveryKey) {
  return (
    Boolean(claimedMetadata) &&
    typeof claimedMetadata === "object" &&
    claimedMetadata.provider_status === "accepted" &&
    claimedMetadata.logical_delivery_key === logicalDeliveryKey
  );
}
