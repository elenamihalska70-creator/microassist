import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// CHARACTERIZATION — LOT 7.32. No Deno integration harness exists in this
// repo (long-standing, documented gap), so these assert against the real
// shipped index.ts source rather than a reimplementation, matching the
// pattern already used in tests/reminder-no-email.test.js.

const INDEX_SOURCE = readFileSync(
  new URL("../supabase/functions/send-reminder/index.ts", import.meta.url),
  "utf8",
);

test("selection query (status/date window) is byte-for-byte unchanged by this LOT", () => {
  assert.match(
    INDEX_SOURCE,
    /\.from\("reminders"\)\s*\.select\("\*"\)\s*\.eq\("status", "pending"\)\s*\.lte\("reminder_date", dayAfterTomorrowDateString\)\s*\.gte\("reminder_date", dateString\);/,
  );
});

test("no overdue/retry-eligibility condition has been added to the selection query", () => {
  const selectBlock = INDEX_SOURCE.slice(
    INDEX_SOURCE.indexOf('.from("reminders")\n      .select("*")'),
    INDEX_SOURCE.indexOf(";", INDEX_SOURCE.indexOf('.gte("reminder_date", dateString)')),
  );
  assert.doesNotMatch(selectBlock, /retry_exhausted_at|last_failure_category|attempt_count/);
});

test("occurrence-identity checks are wired to preClaimMetadata (reminder.metadata), not claimedMetadata (claim.metadata)", () => {
  assert.match(INDEX_SOURCE, /const preClaimMetadata = reminder\.metadata \|\| \{\};/);
  assert.match(
    INDEX_SOURCE,
    /hasDurableAcceptedOutcome\(preClaimMetadata, logicalDeliveryKey\)/,
    "hasDurableAcceptedOutcome must read the pre-claim snapshot, not the RPC's always-fresh-keyed return value",
  );
  assert.match(INDEX_SOURCE, /hasFrozenPayloadForOccurrence\(preClaimMetadata, logicalDeliveryKey\)/);
  assert.match(INDEX_SOURCE, /hasFrozenRecipientForOccurrence\(preClaimMetadata, logicalDeliveryKey\)/);
});

test("frozenFields is built from scopedPriorMetadata, not a raw claimedMetadata spread", () => {
  const frozenFieldsIndex = INDEX_SOURCE.indexOf("const frozenFields = {");
  const frozenFieldsBlock = INDEX_SOURCE.slice(frozenFieldsIndex, INDEX_SOURCE.indexOf("};", frozenFieldsIndex));

  assert.match(frozenFieldsBlock, /\.\.\.scopedPriorMetadata/);
  assert.doesNotMatch(
    frozenFieldsBlock,
    /\.\.\.claimedMetadata/,
    "frozenFields must not spread claimedMetadata directly -- that would carry a superseded occurrence's attempt_count/provider_status/retry state forward",
  );
  assert.match(
    frozenFieldsBlock,
    /claim: claimedMetadata\.claim/,
    "the claim token itself must still come from claimedMetadata -- ownership is per-row, not per-occurrence",
  );
});

test("retry-policy fields are merged into outcomeMetadata before Phase A persists it", () => {
  const mergeIndex = INDEX_SOURCE.indexOf("...buildRetryPolicyFields(outcomeMetadata");
  const phaseAIndex = INDEX_SOURCE.indexOf('.update({ metadata: outcomeMetadata })');
  assert.ok(mergeIndex > -1, "buildRetryPolicyFields must be applied to outcomeMetadata");
  assert.ok(phaseAIndex > -1, "Phase A write must still exist");
  assert.ok(mergeIndex < phaseAIndex, "retry-policy fields must be computed before the durable write, not after");
});

test("no-email path also applies buildRetryPolicyFields", () => {
  const noEmailIndex = INDEX_SOURCE.indexOf("No email for user");
  const resendCallIndex = INDEX_SOURCE.indexOf("resend.emails.send(");
  const noEmailBlock = INDEX_SOURCE.slice(noEmailIndex, resendCallIndex);
  assert.match(noEmailBlock, /buildRetryPolicyFields\(noEmailMetadataBase/);
});

// LOT 7.33 -------------------------------------------------------------

test("the retry-exhaustion gate runs before the Resend call, and requires a prior successful claim", () => {
  const gateIndex = INDEX_SOURCE.indexOf("if (!isRetryable(scopedPriorMetadata, { now }))");
  const resendCallIndex = INDEX_SOURCE.indexOf("resend.emails.send(");
  const claimIndex = INDEX_SOURCE.indexOf('await supabaseClient.rpc(\n        "claim_reminder"');

  assert.ok(gateIndex > -1, "the exhaustion gate must exist");
  assert.ok(claimIndex > -1 && claimIndex < gateIndex, "the gate must run after a claim was attempted");
  assert.ok(gateIndex < resendCallIndex, "the gate must run before any Resend call");
});

test("the exhaustion-gate finalize write is ownership-filtered, like every other finalize write", () => {
  const gateIndex = INDEX_SOURCE.indexOf("if (!isRetryable(scopedPriorMetadata, { now }))");
  const resendCallIndex = INDEX_SOURCE.indexOf("resend.emails.send(");
  const gateBlock = INDEX_SOURCE.slice(gateIndex, resendCallIndex);

  assert.match(gateBlock, /\.eq\("metadata->claim->>claim_token", claimToken\)/);
  assert.match(gateBlock, /\.select\("id"\)/);
  assert.match(gateBlock, /status: "failed"/);
});

test("only a genuinely failed outcome is re-evaluated for retryability -- accepted's finalStatus is never touched", () => {
  const reEvalIndex = INDEX_SOURCE.indexOf('if (finalStatus === "failed") {');
  assert.ok(reEvalIndex > -1);

  const acceptedAssignIndex = INDEX_SOURCE.indexOf('finalStatus = "sent";');
  assert.ok(acceptedAssignIndex > -1 && acceptedAssignIndex < reEvalIndex,
    "finalStatus = \"sent\" must be assigned before the re-evaluation guard, and the guard's condition excludes it");
});

test("a retryable failure can finalize to 'pending' (not just 'sent'/'failed') -- this is what makes retry actually reachable", () => {
  const reEvalIndex = INDEX_SOURCE.indexOf('if (finalStatus === "failed") {');
  const phaseAIndex = INDEX_SOURCE.indexOf('.update({ metadata: outcomeMetadata })');
  const reEvalBlock = INDEX_SOURCE.slice(reEvalIndex, phaseAIndex);

  assert.match(reEvalBlock, /"pending"/);
  assert.match(reEvalBlock, /isRetryable\(outcomeMetadata, \{ now \}\)/);
});

test("no alternate path calls Resend outside the single claimed-and-processed try block", () => {
  const sendCallMatches = INDEX_SOURCE.match(/resend\.emails\.send\(/g) ?? [];
  assert.equal(sendCallMatches.length, 1, "exactly one Resend call site must exist in the whole file");
});

test("getEligibilityWindow is still the sole source of the query's date bounds -- no second, independent date computation was introduced", () => {
  const dateBoundsMatches = INDEX_SOURCE.match(/getEligibilityWindow\(/g) ?? [];
  assert.equal(dateBoundsMatches.length, 1);
});
