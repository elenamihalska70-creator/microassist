import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTrialEmailLogicalKey,
  buildTrialEmailIdempotencyKey,
} from "../supabase/functions/send-trial-ending-email/trialEmailIdentity.js";
import {
  claimTrialEmail,
  finalizeTrialEmail,
} from "../supabase/functions/send-trial-ending-email/_design/trialEmailClaimSimulator.js";

// LOT 10.1F -- DESIGN ONLY. Proves the proposed identity + claim/finalize
// state machine's correctness properties before any real migration or
// Edge Function change is made. Not wired into the live app; no network,
// no real send, no live database anywhere in this file.

test("identity: refuses to build a key when any required field is missing (fail-safe, no guessing)", () => {
  assert.equal(buildTrialEmailLogicalKey({ userId: null, eventType: "trial_expired", trialEndsAt: "2026-09-01" }), null);
  assert.equal(buildTrialEmailLogicalKey({ userId: "u1", eventType: null, trialEndsAt: "2026-09-01" }), null);
  assert.equal(buildTrialEmailLogicalKey({ userId: "u1", eventType: "trial_expired", trialEndsAt: null }), null);
  assert.equal(buildTrialEmailIdempotencyKey(null), null);
});

test("identity: stable for the same (event_type, user_id, trial_ends_at), independent of email or device", () => {
  const a = buildTrialEmailLogicalKey({ userId: "user-1", eventType: "trial_expired", trialEndsAt: "2026-09-01T00:00:00Z" });
  const b = buildTrialEmailLogicalKey({ userId: "user-1", eventType: "trial_expired", trialEndsAt: "2026-09-01T00:00:00Z" });
  assert.equal(a, b);
  assert.equal(buildTrialEmailIdempotencyKey(a), buildTrialEmailIdempotencyKey(b));
});

test("identity: a different trial_ends_at (a genuine future second trial) produces a different identity", () => {
  const first = buildTrialEmailLogicalKey({ userId: "user-1", eventType: "trial_expired", trialEndsAt: "2026-09-01T00:00:00Z" });
  const secondTrial = buildTrialEmailLogicalKey({ userId: "user-1", eventType: "trial_expired", trialEndsAt: "2027-01-01T00:00:00Z" });
  assert.notEqual(first, secondTrial);
});

test("identity: different lifecycle events for the same user/trial are independent", () => {
  const j2 = buildTrialEmailLogicalKey({ userId: "user-1", eventType: "trial_ending_j2", trialEndsAt: "2026-09-01T00:00:00Z" });
  const expired = buildTrialEmailLogicalKey({ userId: "user-1", eventType: "trial_expired", trialEndsAt: "2026-09-01T00:00:00Z" });
  assert.notEqual(j2, expired);
});

test("claim: first legitimate request claims successfully", () => {
  const store = new Map();
  const key = buildTrialEmailLogicalKey({ userId: "u1", eventType: "trial_expired", trialEndsAt: "2026-09-01" });
  const result = claimTrialEmail(store, { logicalKey: key, now: 1000, claimToken: "token-A" });
  assert.equal(result.claimed, true);
  assert.equal(result.claimToken, "token-A");
});

test("concurrency: two simultaneous requests for the same identity -- only one claims, the other is told no", () => {
  const store = new Map();
  const key = buildTrialEmailLogicalKey({ userId: "u1", eventType: "trial_expired", trialEndsAt: "2026-09-01" });

  const first = claimTrialEmail(store, { logicalKey: key, now: 1000, claimToken: "token-A" });
  const second = claimTrialEmail(store, { logicalKey: key, now: 1000, claimToken: "token-B" });

  assert.equal(first.claimed, true);
  assert.equal(second.claimed, false, "a second simultaneous request must never also claim -- this is the actual duplicate-send guard");
});

test("duplicate same event: after a successful send, a later request for the identical event never resends", () => {
  const store = new Map();
  const key = buildTrialEmailLogicalKey({ userId: "u1", eventType: "trial_expired", trialEndsAt: "2026-09-01" });

  const claimed = claimTrialEmail(store, { logicalKey: key, now: 1000, claimToken: "token-A" });
  finalizeTrialEmail(store, { logicalKey: key, claimToken: claimed.claimToken, status: "sent", providerMessageId: "resend-id-1" });

  const laterVisit = claimTrialEmail(store, { logicalKey: key, now: 999_999, claimToken: "token-B" });
  assert.equal(laterVisit.claimed, false, "an already-sent lifecycle email must never be reclaimed, no matter how long afterward");
});

test("second device: same user opening the app on a second device produces the same identity and is deduped identically", () => {
  const store = new Map();
  const keyDeviceOne = buildTrialEmailLogicalKey({ userId: "u1", eventType: "trial_expired", trialEndsAt: "2026-09-01" });
  const keyDeviceTwo = buildTrialEmailLogicalKey({ userId: "u1", eventType: "trial_expired", trialEndsAt: "2026-09-01" });
  assert.equal(keyDeviceOne, keyDeviceTwo, "identity must not depend on device/browser/localStorage state");

  const deviceOneClaim = claimTrialEmail(store, { logicalKey: keyDeviceOne, now: 1000, claimToken: "device-1-token" });
  finalizeTrialEmail(store, { logicalKey: keyDeviceOne, claimToken: deviceOneClaim.claimToken, status: "sent" });

  const deviceTwoClaim = claimTrialEmail(store, { logicalKey: keyDeviceTwo, now: 1500, claimToken: "device-2-token" });
  assert.equal(deviceTwoClaim.claimed, false, "device two must not be able to trigger a second send for the same identity");
});

test("provider failure + retry: a failed attempt can be legitimately reclaimed and completed later", () => {
  const store = new Map();
  const key = buildTrialEmailLogicalKey({ userId: "u1", eventType: "trial_expired", trialEndsAt: "2026-09-01" });

  const firstAttempt = claimTrialEmail(store, { logicalKey: key, now: 1000, claimToken: "attempt-1" });
  finalizeTrialEmail(store, { logicalKey: key, claimToken: firstAttempt.claimToken, status: "failed" });

  const retry = claimTrialEmail(store, { logicalKey: key, now: 2000, claimToken: "attempt-2" });
  assert.equal(retry.claimed, true, "a failed outcome must remain recoverable -- a legitimate email must not be permanently lost");

  const retryResult = finalizeTrialEmail(store, { logicalKey: key, claimToken: retry.claimToken, status: "sent", providerMessageId: "resend-id-2" });
  assert.equal(retryResult.finalized, true);
});

test("crash mid-flight: an expired, never-finalized claim (function crashed) can be reclaimed by a later invocation", () => {
  const store = new Map();
  const key = buildTrialEmailLogicalKey({ userId: "u1", eventType: "trial_expired", trialEndsAt: "2026-09-01" });
  const leaseMs = 5 * 60 * 1000;

  claimTrialEmail(store, { logicalKey: key, now: 1000, claimToken: "crashed-attempt", leaseMs });
  // No finalize call here -- simulates the function crashing before it could persist any outcome.

  const stillWithinLease = claimTrialEmail(store, { logicalKey: key, now: 1000 + leaseMs - 1, claimToken: "too-soon" });
  assert.equal(stillWithinLease.claimed, false, "must not reclaim while the crashed invocation's lease could still legitimately complete");

  const afterLeaseExpires = claimTrialEmail(store, { logicalKey: key, now: 1000 + leaseMs + 1, claimToken: "recovery-attempt" });
  assert.equal(afterLeaseExpires.claimed, true, "once the lease expires, a later invocation must be able to recover the stuck claim");
});

test("ownership check: a finalize from a superseded claim token is rejected, never overwrites a newer invocation's state", () => {
  const store = new Map();
  const key = buildTrialEmailLogicalKey({ userId: "u1", eventType: "trial_expired", trialEndsAt: "2026-09-01" });
  const leaseMs = 5 * 60 * 1000;

  claimTrialEmail(store, { logicalKey: key, now: 1000, claimToken: "stale-token", leaseMs });
  const reclaimed = claimTrialEmail(store, { logicalKey: key, now: 1000 + leaseMs + 1, claimToken: "fresh-token", leaseMs });
  assert.equal(reclaimed.claimed, true);

  // The original (now-superseded) invocation finally wakes up and tries to finalize with its stale token.
  const staleFinalize = finalizeTrialEmail(store, { logicalKey: key, claimToken: "stale-token", status: "sent" });
  assert.equal(staleFinalize.finalized, false, "a stale claim token must never be able to overwrite the reclaiming invocation's outcome");

  const freshFinalize = finalizeTrialEmail(store, { logicalKey: key, claimToken: "fresh-token", status: "sent" });
  assert.equal(freshFinalize.finalized, true);
});

test("different legitimate lifecycle event for the same user/trial is never blocked by another event's dedup state", () => {
  const store = new Map();
  const expiredKey = buildTrialEmailLogicalKey({ userId: "u1", eventType: "trial_expired", trialEndsAt: "2026-09-01" });
  const j2Key = buildTrialEmailLogicalKey({ userId: "u1", eventType: "trial_ending_j2", trialEndsAt: "2026-09-01" });

  const expiredClaim = claimTrialEmail(store, { logicalKey: expiredKey, now: 1000, claimToken: "expired-token" });
  finalizeTrialEmail(store, { logicalKey: expiredKey, claimToken: expiredClaim.claimToken, status: "sent" });

  const j2Claim = claimTrialEmail(store, { logicalKey: j2Key, now: 1500, claimToken: "j2-token" });
  assert.equal(j2Claim.claimed, true, "trial_expired being sent must never block the unrelated trial_ending_j2 event");
});
