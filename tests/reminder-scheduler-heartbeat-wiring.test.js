import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// CHARACTERIZATION — LOT 8.2. No Deno/Postgres integration harness exists
// in this repo (longstanding, documented gap, HIGH severity per LOT 7.34
// section 21) -- these assert against the real shipped index.ts source,
// matching the pattern established since LOT 7.24. Do not read these as
// integration proof: they prove the wiring exists in the right place and
// order, not that a live insert/update against Postgres actually succeeds.

const INDEX_SOURCE = readFileSync(
  new URL("../supabase/functions/send-reminder/index.ts", import.meta.url),
  "utf8",
);

test("run_id is generated with crypto.randomUUID() inside the handler, not reused from any reminder id", () => {
  assert.match(INDEX_SOURCE, /const runId = crypto\.randomUUID\(\);/);
});

test("trigger_source is resolved from a request header, not inferred from time of day", () => {
  assert.match(
    INDEX_SOURCE,
    /resolveTriggerSource\(req\.headers\.get\("X-Trigger-Source"\)\)/,
  );
  // Explicitly guard against a regression toward inferring from time --
  // there must be no reference to something like `now.getHours()` or a
  // fixed "08" check anywhere near the trigger-source resolution.
  const triggerLineIndex = INDEX_SOURCE.indexOf("resolveTriggerSource(");
  const nearbyBlock = INDEX_SOURCE.slice(Math.max(0, triggerLineIndex - 200), triggerLineIndex + 200);
  assert.doesNotMatch(nearbyBlock, /getHours\(\)|getUTCHours\(\)/);
});

test("the cron command itself is never referenced/modified from application code (no cron.* SQL call)", () => {
  assert.doesNotMatch(INDEX_SOURCE, /cron\.(schedule|alter_job|unschedule)/i);
});

test("start record is inserted before the reminders SELECT query runs", () => {
  const startInsertIndex = INDEX_SOURCE.indexOf('.from("scheduler_runs")\n      .insert(');
  const selectIndex = INDEX_SOURCE.indexOf('.from("reminders")\n      .select("*")');
  assert.ok(startInsertIndex > -1, "scheduler_runs insert must exist");
  assert.ok(startInsertIndex < selectIndex, "heartbeat must start before the reminders query runs");
});

test("start-record insert failure is logged but does not return/throw (observability must not block reminder processing)", () => {
  const ifIndex = INDEX_SOURCE.indexOf("if (heartbeatStartError) {");
  const block = INDEX_SOURCE.slice(ifIndex, ifIndex + 400);
  assert.match(block, /console\.error/);
  assert.doesNotMatch(block, /return new Response/);
});

test("finalizeHeartbeat is declared before the try block so a pre-client crash can still be handled", () => {
  const finalizeDeclIndex = INDEX_SOURCE.indexOf("let finalizeHeartbeat:");
  const tryIndex = INDEX_SOURCE.indexOf("\n  try {");
  assert.ok(finalizeDeclIndex > -1);
  assert.ok(finalizeDeclIndex < tryIndex, "finalizeHeartbeat must be declared outside/before the try block");
});

test("zero-reminder path finalizes a completed heartbeat with all counts at 0 before returning", () => {
  const noRemindersIndex = INDEX_SOURCE.indexOf('"No reminders to send"');
  const block = INDEX_SOURCE.slice(noRemindersIndex - 400, noRemindersIndex + 50);
  assert.match(block, /buildCompletionRecord\(/);
  assert.match(block, /results: \[\], catchUpCount: 0, retryCount: 0/);
  assert.match(block, /await finalizeHeartbeat\(/);
});

test("remindersError path finalizes a failure heartbeat before returning 500", () => {
  const errorIndex = INDEX_SOURCE.indexOf("Error fetching reminders");
  const block = INDEX_SOURCE.slice(errorIndex, errorIndex + 300);
  assert.match(block, /buildFailureRecord\(/);
  assert.match(block, /status: 500/);
});

test("catch-up and retry tags are computed exactly once per claimed row, immediately after scopedPriorMetadata", () => {
  const scopedIndex = INDEX_SOURCE.indexOf("const scopedPriorMetadata = occurrenceScopedMetadata(");
  const replayIndex = INDEX_SOURCE.indexOf("hasDurableAcceptedOutcome(preClaimMetadata, logicalDeliveryKey)");
  const nextBlock = INDEX_SOURCE.slice(scopedIndex, replayIndex);
  assert.match(nextBlock, /catchUpCount \+= 1/);
  assert.match(nextBlock, /retryCount \+= 1/);

  // exactly one increment site each in the whole file (no double counting)
  assert.equal((INDEX_SOURCE.match(/catchUpCount \+= 1/g) ?? []).length, 1);
  assert.equal((INDEX_SOURCE.match(/retryCount \+= 1/g) ?? []).length, 1);
});

test("catch-up/retry tagging does not touch selection, claim, or provider logic (observability only)", () => {
  const scopedIndex = INDEX_SOURCE.indexOf("const scopedPriorMetadata = occurrenceScopedMetadata(");
  const replayIndex = INDEX_SOURCE.indexOf("hasDurableAcceptedOutcome(preClaimMetadata, logicalDeliveryKey)");
  const taggingBlock = INDEX_SOURCE.slice(scopedIndex, replayIndex);
  assert.doesNotMatch(taggingBlock, /resend\.emails\.send/);
  assert.doesNotMatch(taggingBlock, /\.rpc\(/);
  assert.doesNotMatch(taggingBlock, /\.update\(/);
});

test("successful completion finalizes the heartbeat with the real results/counts before the 200 response", () => {
  const finalLogIndex = INDEX_SOURCE.indexOf("Fin. ${results.length}");
  const successReturnIndex = INDEX_SOURCE.indexOf("success: true, results");
  const block = INDEX_SOURCE.slice(finalLogIndex, successReturnIndex);
  assert.match(block, /buildCompletionRecord\(\{ completedAt: new Date\(\)\.toISOString\(\), results, catchUpCount, retryCount \}\)/);
});

test("outer catch finalizes a failure heartbeat, and a heartbeat write failure there cannot mask the original 500 response", () => {
  const catchIndex = INDEX_SOURCE.lastIndexOf("} catch (error) {");
  const block = INDEX_SOURCE.slice(catchIndex);
  assert.match(block, /buildFailureRecord\(/);
  assert.match(block, /catch \(heartbeatError\)/);
  assert.match(block, /status: 500/);
});

test("existing selection query and claim RPC call are unmodified by this LOT", () => {
  assert.match(
    INDEX_SOURCE,
    /\.from\("reminders"\)\s*\.select\("\*"\)\s*\.eq\("status", "pending"\)\s*\.lte\("reminder_date", dayAfterTomorrowDateString\)\s*\.gte\("reminder_date", dateString\);/,
  );
  assert.match(INDEX_SOURCE, /await supabaseClient\.rpc\(\s*"claim_reminder",/);
});

test("exactly one Resend call site remains (heartbeat introduces no new send path)", () => {
  const sendCallMatches = INDEX_SOURCE.match(/resend\.emails\.send\(/g) ?? [];
  assert.equal(sendCallMatches.length, 1);
});
