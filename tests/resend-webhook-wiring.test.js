import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// CHARACTERIZATION — LOT 8.13. No Deno/Postgres integration harness
// exists in this repo (longstanding, documented gap, HIGH severity per
// LOT 7.34 section 21, restated LOT 8.2) -- these assert against the real
// shipped index.ts source, matching the pattern established since LOT
// 7.24 (see tests/reminder-scheduler-heartbeat-wiring.test.js). Do not
// read these as integration proof: they prove the wiring exists in the
// right place and order, not that a live request against a deployed
// function actually behaves this way end-to-end.

const INDEX_SOURCE = readFileSync(
  new URL("../supabase/functions/resend-webhook/index.ts", import.meta.url),
  "utf8",
);

test("missing RESEND_WEBHOOK_SECRET returns a deterministic 500 before any body/header processing", () => {
  const secretCheckIndex = INDEX_SOURCE.indexOf("if (!RESEND_WEBHOOK_SECRET)");
  const bodyReadIndex = INDEX_SOURCE.indexOf("await req.text()");
  assert.ok(secretCheckIndex > -1, "secret presence check must exist");
  assert.ok(secretCheckIndex < bodyReadIndex, "secret must be checked before the raw body is even read");
  const block = INDEX_SOURCE.slice(secretCheckIndex, secretCheckIndex + 300);
  assert.match(block, /status: 500/);
});

test("secret value itself is never logged", () => {
  assert.doesNotMatch(INDEX_SOURCE, /console\.(log|error)\([^)]*RESEND_WEBHOOK_SECRET\)/);
});

test("raw body is captured via req.text() -- never JSON-parsed before signature verification", () => {
  const rawBodyIndex = INDEX_SOURCE.indexOf("const rawBody = await req.text();");
  const verifyCallIndex = INDEX_SOURCE.indexOf("wh.verify(rawBody");
  assert.ok(rawBodyIndex > -1);
  assert.ok(verifyCallIndex > -1);
  assert.ok(rawBodyIndex < verifyCallIndex);
  // No JSON.parse of the body happens between capture and verification.
  const between = INDEX_SOURCE.slice(rawBodyIndex, verifyCallIndex);
  assert.doesNotMatch(between, /JSON\.parse\(rawBody\)/);
});

test("Svix headers are extracted and validated before signature verification is attempted", () => {
  const headersIndex = INDEX_SOURCE.indexOf("const svixHeaders = extractSvixHeaders(req.headers);");
  const verifyCallIndex = INDEX_SOURCE.indexOf("wh.verify(rawBody");
  assert.ok(headersIndex > -1);
  assert.ok(headersIndex < verifyCallIndex, "headers must be extracted before verify() is called");
  const guardBlock = INDEX_SOURCE.slice(headersIndex, headersIndex + 300);
  assert.match(guardBlock, /if \(!svixHeaders\)/);
  assert.match(guardBlock, /status: 400/);
});

test("signature verification happens inside a try/catch, and failure returns 4xx without touching the payload as trusted", () => {
  const verifyIndex = INDEX_SOURCE.indexOf("let verifiedPayload");
  const catchIndex = INDEX_SOURCE.indexOf("} catch (verifyError) {");
  assert.ok(verifyIndex > -1 && catchIndex > -1 && verifyIndex < catchIndex);
  const catchBlock = INDEX_SOURCE.slice(catchIndex, catchIndex + 400);
  assert.match(catchBlock, /status: 400/);
  // The caught error's raw value (which could echo signature material) is
  // never logged directly -- only its .message.
  assert.doesNotMatch(catchBlock, /console\.error\([^)]*verifyError\)/);
});

test("event-type support is checked using the LOT 8.12 shared validator, not a locally redefined list", () => {
  assert.match(INDEX_SOURCE, /import \{[\s\S]*?isSupportedEventType[\s\S]*?\} from "\.\.\/_shared\/deliveryEvents\/deliveryEventValidation\.js";/);
  assert.match(INDEX_SOURCE, /if \(!isSupportedEventType\(eventType\)\)/);
  // No second, hand-written list of "email.sent" / "email.delivered" / ...
  // literals anywhere else in this file.
  const eventTypeLiteralMatches = INDEX_SOURCE.match(/"email\.(sent|delivered|delivery_delayed|bounced|complained|failed)"/g) ?? [];
  assert.equal(eventTypeLiteralMatches.length, 0, "event type literals must live only in deliveryEventValidation.js, not be re-typed here");
});

test("unsupported event type returns 200 (acknowledge, do not persist, do not trigger a Resend retry)", () => {
  const guardIndex = INDEX_SOURCE.indexOf("if (!isSupportedEventType(eventType)) {");
  const block = INDEX_SOURCE.slice(guardIndex, guardIndex + 300);
  assert.match(block, /status: 200/);
});

test("correlation lookup filters by metadata->>provider_message_id only -- never by recipient email", () => {
  assert.match(INDEX_SOURCE, /\.eq\("metadata->>provider_message_id", providerMessageId\)/);
  assert.doesNotMatch(INDEX_SOURCE, /\.eq\("email"/);
  assert.doesNotMatch(INDEX_SOURCE, /\.eq\("to"/);
});

test("no reminder match is logged and proceeds (not rejected) -- reminder_id is allowed to be null", () => {
  const noMatchIndex = INDEX_SOURCE.indexOf("if (!matchedReminder) {");
  assert.ok(noMatchIndex > -1);
  const block = INDEX_SOURCE.slice(noMatchIndex, noMatchIndex + 200);
  assert.doesNotMatch(block, /return new Response/);
});

test("duplicate insert (23505 via isDuplicateSvixIdError) returns 200, not 4xx/5xx", () => {
  const dupIndex = INDEX_SOURCE.indexOf("if (isDuplicateSvixIdError(insertError)) {");
  assert.ok(dupIndex > -1);
  const block = INDEX_SOURCE.slice(dupIndex, dupIndex + 300);
  assert.match(block, /status: 200/);
});

test("a genuine (non-duplicate) insert failure returns 5xx, distinct from the duplicate branch", () => {
  const dupIndex = INDEX_SOURCE.indexOf("if (isDuplicateSvixIdError(insertError)) {");
  const afterDup = INDEX_SOURCE.slice(dupIndex);
  const genuineFailureBlock = afterDup.slice(0, afterDup.indexOf("console.log(`✅"));
  assert.match(genuineFailureBlock, /status: 500/);
});

test("service-role key is read server-side from Deno.env only, never hardcoded", () => {
  assert.match(INDEX_SOURCE, /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/);
  assert.doesNotMatch(INDEX_SOURCE, /eyJ[a-zA-Z0-9_-]{10,}/); // JWT/key shape hardcoded
});

test("service-role key value is never logged", () => {
  assert.doesNotMatch(INDEX_SOURCE, /console\.(log|error)\([^)]*SUPABASE_SERVICE_ROLE_KEY\)/);
});

test("send-reminder is not imported or called from this file (comments may still explain the separation decision in prose)", () => {
  assert.doesNotMatch(INDEX_SOURCE, /from ["'].*send-reminder/);
  assert.doesNotMatch(INDEX_SOURCE, /\.functions\.invoke\(["']send-reminder["']\)/);
});

test("no cron/scheduler mutation from this function", () => {
  assert.doesNotMatch(INDEX_SOURCE, /cron\.(schedule|alter_job|unschedule)/i);
  assert.doesNotMatch(INDEX_SOURCE, /scheduler_runs/);
});

test("outer catch-all also returns 5xx and logs a sanitized message", () => {
  const catchAllIndex = INDEX_SOURCE.lastIndexOf("} catch (error) {");
  const block = INDEX_SOURCE.slice(catchAllIndex);
  assert.match(block, /status: 500/);
  assert.match(block, /console\.error/);
});

test("verify_jwt=false deployment requirement is documented in the file itself, alongside why it is safe", () => {
  assert.match(INDEX_SOURCE, /verify_jwt=false/);
  assert.match(INDEX_SOURCE, /Svix/);
});
