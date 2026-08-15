import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildNoEmailMetadata,
  resolveNoEmailFinalizeResult,
} from "../supabase/functions/send-reminder/reminderNoEmail.js";

const INDEX_SOURCE = readFileSync(
  new URL("../supabase/functions/send-reminder/index.ts", import.meta.url),
  "utf8",
);

// UNIT — LOT 7.24 no-email finalize decision. These exercise the exact
// branching logic index.ts wires to a real
// `.update(...).eq(id).eq("metadata->claim->>claim_token", claimToken).select("id")`
// call, using response shapes matching what supabase-js actually returns
// (data/error, rows possibly empty). Postgres row-locking/atomicity itself
// is not re-proven here -- that's the same `.eq(claim_token)` pattern
// already established by the replay-finalize/Phase A/Phase B writes.

test("C. valid claim, update succeeds -> failed state, deterministic reason", () => {
  const result = resolveNoEmailFinalizeResult("reminder-1", {
    error: null,
    rows: [{ id: "reminder-1" }],
  });
  assert.deepEqual(result, { id: "reminder-1", status: "failed", reason: "No email" });
});

test("D. DB update error -> surfaced as finalize_failed, not silently treated as failed", () => {
  const result = resolveNoEmailFinalizeResult("reminder-1", {
    error: { message: "connection reset" },
    rows: null,
  });
  assert.deepEqual(result, { id: "reminder-1", status: "finalize_failed", reason: "No email" });
});

test("E. stale claim (zero rows matched) -> skipped, not overwritten, not falsely 'failed'", () => {
  const result = resolveNoEmailFinalizeResult("reminder-1", { error: null, rows: [] });
  assert.deepEqual(result, {
    id: "reminder-1",
    status: "skipped",
    reason: "claim_lost_before_no_email_finalize",
  });
});

test("E (variant). undefined rows (network hiccup shape) treated the same as zero rows, not as success", () => {
  const result = resolveNoEmailFinalizeResult("reminder-1", { error: null, rows: undefined });
  assert.equal(result.status, "skipped");
});

test("error takes precedence over an empty rows array in the same response", () => {
  const result = resolveNoEmailFinalizeResult("reminder-1", { error: { message: "x" }, rows: [] });
  assert.equal(result.status, "finalize_failed");
});

test("F. no-email branch returns/continues before the Resend call is ever reached", () => {
  const noEmailIndex = INDEX_SOURCE.indexOf("No email for user");
  const resendCallIndex = INDEX_SOURCE.indexOf("resend.emails.send(");
  const continueAfterNoEmail = INDEX_SOURCE.indexOf("continue;", noEmailIndex);

  assert.ok(noEmailIndex > -1, "no-email branch must exist in index.ts");
  assert.ok(resendCallIndex > -1, "resend.emails.send call must exist in index.ts");
  assert.ok(
    noEmailIndex < continueAfterNoEmail && continueAfterNoEmail < resendCallIndex,
    "the no-email branch's continue must execute before the Resend call is reached",
  );
});

test("no-email finalize write is ownership-filtered by claim_token, like the other finalize writes", () => {
  const noEmailIndex = INDEX_SOURCE.indexOf("No email for user");
  const resendCallIndex = INDEX_SOURCE.indexOf("resend.emails.send(");
  const noEmailBlock = INDEX_SOURCE.slice(noEmailIndex, resendCallIndex);

  assert.match(noEmailBlock, /\.eq\("metadata->claim->>claim_token", claimToken\)/);
  assert.match(noEmailBlock, /\.select\("id"\)/);
});

// G. previous provider metadata cannot create a contradictory final state:
// buildNoEmailMetadata must not delete prior provider evidence (still
// auditable) but must add a distinct, newer marker so a reader can tell the
// LATEST outcome was a no-email skip, not a stale provider attempt.

test("G. stale provider_status from an earlier attempt is preserved, not deleted", () => {
  const claimedMetadata = {
    provider_status: "failed",
    failure_reason: "SMTP timeout",
    logical_delivery_key: "declaration:abc:2026-08-23",
    claim: { claim_token: "old-token" },
  };
  const metadata = buildNoEmailMetadata(claimedMetadata, "2026-08-15T08:00:01.000Z");

  assert.equal(metadata.provider_status, "failed");
  assert.equal(metadata.failure_reason, "SMTP timeout");
  assert.equal(metadata.logical_delivery_key, "declaration:abc:2026-08-23");
});

test("G. no_email_at is added as a distinct, newer marker of the latest outcome", () => {
  const claimedMetadata = { provider_status: "unknown" };
  const metadata = buildNoEmailMetadata(claimedMetadata, "2026-08-15T08:00:01.000Z");

  assert.equal(metadata.no_email_at, "2026-08-15T08:00:01.000Z");
  assert.notEqual(metadata.no_email_at, undefined);
});

test("no provider-attempt shaped fields are introduced by the no-email path", () => {
  const metadata = buildNoEmailMetadata({}, "2026-08-15T08:00:01.000Z");

  assert.equal(metadata.provider, undefined);
  assert.equal(metadata.provider_message_id, undefined);
  assert.equal(metadata.attempt_count, undefined);
  assert.equal(metadata.last_attempt_at, undefined);
});

test("null/non-object claimed metadata is treated as empty, not thrown", () => {
  assert.doesNotThrow(() => buildNoEmailMetadata(null, "2026-08-15T08:00:01.000Z"));
  assert.doesNotThrow(() => buildNoEmailMetadata(undefined, "2026-08-15T08:00:01.000Z"));
  assert.doesNotThrow(() => buildNoEmailMetadata("not-an-object", "2026-08-15T08:00:01.000Z"));

  const metadata = buildNoEmailMetadata(null, "2026-08-15T08:00:01.000Z");
  assert.equal(metadata.no_email_at, "2026-08-15T08:00:01.000Z");
});
