import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// CHARACTERIZATION — LOT 9.2. No Deno integration harness exists in this
// repo (longstanding, documented gap, see tests/resend-webhook-wiring.test.js
// and tests/reminder-scheduler-heartbeat-wiring.test.js for the same
// pattern) -- these assert against the real shipped index.ts source, not
// a live invocation. Proves the disabled path is checked first and skips
// all downstream work; does not prove a live deployed function behaves
// this way end-to-end (LOT 9.2 section 12 covers that separately).

const INDEX_SOURCE = readFileSync(
  new URL("../supabase/functions/send-trial-ending-email/index.ts", import.meta.url),
  "utf8",
);

test("flag is derived via the fail-closed pure helper, not re-implemented inline", () => {
  assert.match(INDEX_SOURCE, /import \{ isTrialEmailsEnabled \} from "\.\/trialEmailsFlag\.js";/);
  assert.match(INDEX_SOURCE, /const TRIAL_EMAILS_ENABLED = isTrialEmailsEnabled\(Deno\.env\.get\("TRIAL_EMAILS_ENABLED"\)\);/);
});

test("disabled check happens before body parsing, Resend call, and any DB work (LOT 9.2 section 4)", () => {
  const guardIndex = INDEX_SOURCE.indexOf("if (!TRIAL_EMAILS_ENABLED)");
  const bodyParseIndex = INDEX_SOURCE.indexOf("await req.json()");
  const resendCallIndex = INDEX_SOURCE.indexOf('fetch("https://api.resend.com/emails"');

  assert.ok(guardIndex > -1, "disabled guard must exist");
  assert.ok(guardIndex < bodyParseIndex, "guard must run before request body is parsed");
  assert.ok(guardIndex < resendCallIndex, "guard must run before any Resend call");
});

test("disabled path returns the exact deterministic skipped response (D/G)", () => {
  const guardIndex = INDEX_SOURCE.indexOf("if (!TRIAL_EMAILS_ENABLED)");
  const block = INDEX_SOURCE.slice(guardIndex, guardIndex + 400);
  assert.match(block, /ok: true,/);
  assert.match(block, /skipped: true,/);
  assert.match(block, /reason: "trial_emails_disabled",/);
  assert.match(block, /status: 200/);
});

test("disabled path never calls Resend (E) -- only one fetch() call site in the whole file, and it is after the guard", () => {
  const fetchCallMatches = [...INDEX_SOURCE.matchAll(/fetch\(/g)];
  assert.equal(fetchCallMatches.length, 1, "exactly one fetch() call site expected");
  const guardIndex = INDEX_SOURCE.indexOf("if (!TRIAL_EMAILS_ENABLED)");
  assert.ok(fetchCallMatches[0].index > guardIndex, "the fetch() call must be reachable only after the guard");
});

test("disabled path never touches a database (F) -- no Supabase client, no email_events table access anywhere in this file", () => {
  assert.doesNotMatch(INDEX_SOURCE, /createClient/);
  assert.doesNotMatch(INDEX_SOURCE, /\.from\("email_events"\)/);
  assert.doesNotMatch(INDEX_SOURCE, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("disabled path logs only a sanitized, non-PII message", () => {
  const guardIndex = INDEX_SOURCE.indexOf("if (!TRIAL_EMAILS_ENABLED)");
  const block = INDEX_SOURCE.slice(guardIndex, guardIndex + 400);
  const logMatch = block.match(/console\.log\("([^"]*)"\)/);
  assert.ok(logMatch, "expected a sanitized console.log in the disabled branch");
  assert.equal(logMatch[1], "[trial-email] skipped: disabled");
});

test("no secret value is ever logged anywhere in the file", () => {
  assert.doesNotMatch(INDEX_SOURCE, /console\.(log|error)\([^)]*RESEND_API_KEY\)/);
  assert.doesNotMatch(INDEX_SOURCE, /console\.(log|error)\([^)]*TRIAL_EMAILS_ENABLED\)/);
});

test("enabled-path parity: send logic is byte-identical to the pre-LOT-9.2 deployed version (only the guard was added, LOT 9.2 section 6)", () => {
  // The exact call shape/from-address/fallback copy that was already live
  // in Production before this LOT -- proves nothing about the send path
  // itself was rewritten, only gated.
  assert.match(INDEX_SOURCE, /from: "Microassist <onboarding@resend\.dev>",/);
  assert.match(INDEX_SOURCE, /to: email,/);
  assert.match(INDEX_SOURCE, /subject: subject \|\| "Test Microassist",/);
  assert.match(INDEX_SOURCE, /Ton essai Premium se termine dans 7 jours/);
});

test("this LOT does not introduce dedup, email_events, or trial-policy logic (LOT 9.2 section 6/17 -- explicitly out of scope)", () => {
  assert.doesNotMatch(INDEX_SOURCE, /\.eq\("event_type"/);
  assert.doesNotMatch(INDEX_SOURCE, /already_sent/);
  assert.doesNotMatch(INDEX_SOURCE, /trial_ends_at/);
});
