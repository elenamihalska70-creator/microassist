import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// CHARACTERIZATION — LOT 9.2 / 10.1E / 10.1G. No Deno integration harness
// exists in this repo (longstanding, documented gap, see
// tests/resend-webhook-wiring.test.js and
// tests/reminder-scheduler-heartbeat-wiring.test.js for the same
// pattern) -- these assert against the real shipped index.ts source, not
// a live invocation.
//
// LOT 10.1G rewrote this function's security and idempotency model
// (LOT 10.1F findings: unauthenticated arbitrary-email relay, unsafe
// check-then-act dedup). Several LOT 10.1E-era assertions here were
// about properties this LOT deliberately changed (e.g. "no dedup logic",
// "subject has a client-suppliable fallback") -- those are replaced
// below with assertions proving the new, intentional behavior instead of
// being silently dropped.

const INDEX_SOURCE = readFileSync(
  new URL("../supabase/functions/send-trial-ending-email/index.ts", import.meta.url),
  "utf8",
);

test("flag is derived via the fail-closed pure helper, not re-implemented inline", () => {
  assert.match(INDEX_SOURCE, /import \{ isTrialEmailsEnabled \} from "\.\/trialEmailsFlag\.js";/);
  assert.match(INDEX_SOURCE, /const TRIAL_EMAILS_ENABLED = isTrialEmailsEnabled\(Deno\.env\.get\("TRIAL_EMAILS_ENABLED"\)\);/);
});

test("disabled check happens before Authorization is even read, before any Supabase client, and before any Resend call", () => {
  const guardIndex = INDEX_SOURCE.indexOf("if (!TRIAL_EMAILS_ENABLED)");
  const authHeaderIndex = INDEX_SOURCE.indexOf('req.headers.get("Authorization")');
  const createClientIndex = INDEX_SOURCE.indexOf("createClient(");
  const resendCallIndex = INDEX_SOURCE.indexOf('fetch("https://api.resend.com/emails"');

  assert.ok(guardIndex > -1, "disabled guard must exist");
  assert.ok(guardIndex < authHeaderIndex, "guard must run before the Authorization header is even read");
  assert.ok(guardIndex < createClientIndex, "guard must run before any Supabase client is created");
  assert.ok(guardIndex < resendCallIndex, "guard must run before any Resend call");
});

test("disabled path returns the exact deterministic skipped response", () => {
  const guardIndex = INDEX_SOURCE.indexOf("if (!TRIAL_EMAILS_ENABLED)");
  const block = INDEX_SOURCE.slice(guardIndex, guardIndex + 400);
  assert.match(block, /ok: true,/);
  assert.match(block, /skipped: true,/);
  assert.match(block, /reason: "trial_emails_disabled"/);
  assert.match(block, /status: 200/);
});

test("only one fetch() call site in the whole file (to Resend), and it is reachable only after the guard", () => {
  const fetchCallMatches = [...INDEX_SOURCE.matchAll(/fetch\(/g)];
  assert.equal(fetchCallMatches.length, 1, "exactly one fetch() call site expected");
  const guardIndex = INDEX_SOURCE.indexOf("if (!TRIAL_EMAILS_ENABLED)");
  assert.ok(fetchCallMatches[0].index > guardIndex, "the fetch() call must be reachable only after the guard");
});

test("unauthenticated caller: missing/malformed Authorization header is rejected with 401 before any Supabase client exists", () => {
  const authCheckIndex = INDEX_SOURCE.indexOf('!authHeader || !authHeader.startsWith("Bearer ")');
  const createClientIndex = INDEX_SOURCE.indexOf("createClient(");
  assert.ok(authCheckIndex > -1, "an explicit Bearer-shape check must exist");
  assert.ok(authCheckIndex < createClientIndex, "the auth-header check must run before any Supabase client is created");

  const block = INDEX_SOURCE.slice(authCheckIndex, authCheckIndex + 300);
  assert.match(block, /status: 401/);
});

test("caller identity is cryptographically verified via auth.getUser before any profile/claim/send work", () => {
  const verifyIndex = INDEX_SOURCE.indexOf("supabaseAdmin.auth.getUser(accessToken)");
  const profileIndex = INDEX_SOURCE.indexOf('.from("profiles")');
  const claimIndex = INDEX_SOURCE.indexOf('rpc("claim_trial_email"');
  const resendCallIndex = INDEX_SOURCE.indexOf('fetch("https://api.resend.com/emails"');

  assert.ok(verifyIndex > -1, "auth.getUser must be called");
  assert.ok(verifyIndex < profileIndex);
  assert.ok(verifyIndex < claimIndex);
  assert.ok(verifyIndex < resendCallIndex);

  const rejectBlock = INDEX_SOURCE.slice(verifyIndex, verifyIndex + 300);
  assert.match(rejectBlock, /verifyError \|\| !verifiedUser\?\.user/);
  assert.match(rejectBlock, /status: 401/);
});

test("request body is never parsed at all -- no req.json() call anywhere in the file", () => {
  assert.doesNotMatch(INDEX_SOURCE, /req\.json\(\)/);
});

test("recipient email is the verified caller's own email, never a request-body field", () => {
  assert.match(INDEX_SOURCE, /const email = verifiedUser\.user\.email;/);
  assert.match(INDEX_SOURCE, /to: email,/);
  assert.doesNotMatch(INDEX_SOURCE, /body\.email/);
  assert.doesNotMatch(INDEX_SOURCE, /body\.userId/);
});

test("subject/html/text are taken only from the server-owned template, never from a request-body field", () => {
  assert.match(INDEX_SOURCE, /subject: template\.subject,/);
  assert.match(INDEX_SOURCE, /html: template\.html,/);
  assert.match(INDEX_SOURCE, /text: template\.text,/);
  assert.doesNotMatch(INDEX_SOURCE, /body\.subject/);
  assert.doesNotMatch(INDEX_SOURCE, /body\.html/);
  assert.doesNotMatch(INDEX_SOURCE, /body\.text/);
});

test("event type and trial_ends_at are server-derived, never read from a request-body field (invalid/forged lifecycle events are structurally impossible)", () => {
  assert.match(INDEX_SOURCE, /const eventType = resolveTrialEventType\(daysLeft\);/);
  assert.match(INDEX_SOURCE, /const trialEndsAt = profileRow\?\.trial_ends_at/);
  assert.doesNotMatch(INDEX_SOURCE, /body\.eventType/);
  assert.doesNotMatch(INDEX_SOURCE, /body\.trialEndsAt/);
});

test("provider call carries a derived Idempotency-Key header (second, independent dedup layer)", () => {
  assert.match(INDEX_SOURCE, /"Idempotency-Key": idempotencyKey,/);
  assert.match(INDEX_SOURCE, /const idempotencyKey = buildTrialEmailIdempotencyKey\(logicalKey\);/);
});

test("order of operations: claim before Resend, finalize after Resend, both keyed by the same claim token", () => {
  const claimIndex = INDEX_SOURCE.indexOf('rpc("claim_trial_email"');
  const resendCallIndex = INDEX_SOURCE.indexOf('fetch("https://api.resend.com/emails"');
  const finalizeIndex = INDEX_SOURCE.indexOf('rpc("finalize_trial_email"', resendCallIndex);

  assert.ok(claimIndex > -1 && claimIndex < resendCallIndex, "claim must happen before the Resend call");
  assert.ok(finalizeIndex > -1 && finalizeIndex > resendCallIndex, "finalize (for the success/failure path) must happen after the Resend call");
  assert.match(INDEX_SOURCE, /p_claim_token: claimToken,/);
});

test("a claim loser (already_handled) returns before ever reaching the Resend call site", () => {
  const notClaimedIndex = INDEX_SOURCE.indexOf("if (!claim?.claimed)");
  const resendCallIndex = INDEX_SOURCE.indexOf('fetch("https://api.resend.com/emails"');
  assert.ok(notClaimedIndex > -1 && notClaimedIndex < resendCallIndex);

  const block = INDEX_SOURCE.slice(notClaimedIndex, notClaimedIndex + 300);
  assert.match(block, /reason: "already_handled"/);
  assert.match(block, /return new Response/);
});

test("disabled path logs only a sanitized, non-PII message", () => {
  const guardIndex = INDEX_SOURCE.indexOf("if (!TRIAL_EMAILS_ENABLED)");
  const block = INDEX_SOURCE.slice(guardIndex, guardIndex + 400);
  const logMatch = block.match(/console\.log\("([^"]*)"\)/);
  assert.ok(logMatch, "expected a sanitized console.log in the disabled branch");
  assert.equal(logMatch[1], "[trial-email] skipped: disabled");
});

test("no secret value is ever logged anywhere in the file", () => {
  assert.doesNotMatch(INDEX_SOURCE, /console\.(log|error|warn)\([^)]*RESEND_API_KEY\)/);
  assert.doesNotMatch(INDEX_SOURCE, /console\.(log|error|warn)\([^)]*TRIAL_EMAILS_ENABLED\)/);
  assert.doesNotMatch(INDEX_SOURCE, /console\.(log|error|warn)\([^)]*SUPABASE_SERVICE_ROLE_KEY\)/);
  assert.doesNotMatch(INDEX_SOURCE, /console\.(log|error|warn)\([^)]*accessToken\)/);
});
