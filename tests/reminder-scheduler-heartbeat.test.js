import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveTriggerSource,
  buildStartRecord,
  aggregateResultCounts,
  buildCompletionRecord,
  sanitizeFatalError,
  buildFailureRecord,
} from "../supabase/functions/send-reminder/reminderSchedulerHeartbeat.js";

// UNIT — LOT 8.2 scheduler heartbeat contract.

// trigger_source validation ----------------------------------------------

test("resolveTriggerSource: explicit 'manual' header -> manual", () => {
  assert.equal(resolveTriggerSource("manual"), "manual");
});

test("resolveTriggerSource: no header (cron's actual, unmodified request) -> scheduled", () => {
  assert.equal(resolveTriggerSource(null), "scheduled");
  assert.equal(resolveTriggerSource(undefined), "scheduled");
});

test("resolveTriggerSource: any other/unexpected value -> scheduled (fail toward the safe default, not toward manual)", () => {
  assert.equal(resolveTriggerSource("cron"), "scheduled");
  assert.equal(resolveTriggerSource("Manual"), "scheduled"); // case-sensitive, deliberately strict
  assert.equal(resolveTriggerSource(""), "scheduled");
});

// start record -------------------------------------------------------------

test("buildStartRecord: exact shape, status always 'started'", () => {
  const record = buildStartRecord({
    runId: "11111111-1111-4111-8111-111111111111",
    triggerSource: "scheduled",
    startedAt: "2026-08-16T08:00:00.000Z",
  });
  assert.deepEqual(record, {
    run_id: "11111111-1111-4111-8111-111111111111",
    trigger_source: "scheduled",
    status: "started",
    started_at: "2026-08-16T08:00:00.000Z",
  });
});

// counters -------------------------------------------------------------

test("zero-reminder run -> completed with every counter at 0 (LOT 8.2 section 12)", () => {
  const record = buildCompletionRecord({
    completedAt: "2026-08-16T08:00:01.000Z",
    results: [],
    catchUpCount: 0,
    retryCount: 0,
  });
  assert.equal(record.status, "completed");
  assert.equal(record.processed_count, 0);
  assert.equal(record.sent_count, 0);
  assert.equal(record.failed_count, 0);
  assert.equal(record.skipped_count, 0);
  assert.equal(record.catch_up_count, 0);
  assert.equal(record.retry_count, 0);
});

test("successful run: counters aggregate correctly from a realistic mixed results array", () => {
  const results = [
    { id: "a", status: "sent" },
    { id: "b", status: "sent" },
    { id: "c", status: "failed" },
    { id: "d", status: "pending" }, // retryable failure this run -- counts as not-sent
    { id: "e", status: "skipped", reason: "not_claimed" },
    { id: "f", status: "finalize_failed" },
    { id: "g", status: "outcome_persist_failed" },
  ];
  const counts = aggregateResultCounts(results);

  assert.equal(counts.processed_count, 7);
  assert.equal(counts.sent_count, 2);
  assert.equal(counts.skipped_count, 1);
  assert.equal(counts.failed_count, 4); // failed + pending + finalize_failed + outcome_persist_failed
});

test("invariant: sent + failed + skipped === processed, across varied inputs", () => {
  const cases = [
    [],
    [{ status: "sent" }],
    [{ status: "skipped" }, { status: "skipped" }],
    [{ status: "sent" }, { status: "failed" }, { status: "skipped" }, { status: "pending" }],
    [{ status: "weird_unexpected_value" }],
    [{}, { status: null }],
  ];
  for (const results of cases) {
    const c = aggregateResultCounts(results);
    assert.equal(c.sent_count + c.failed_count + c.skipped_count, c.processed_count);
    assert.ok(c.failed_count >= 0, "failed_count must never go negative");
  }
});

test("a retry that succeeds counts once: processed +1, sent +1, retry tag +1 -- never processed twice", () => {
  const results = [{ id: "a", status: "sent" }];
  const record = buildCompletionRecord({
    completedAt: "2026-08-16T08:00:01.000Z",
    results,
    catchUpCount: 0,
    retryCount: 1,
  });
  assert.equal(record.processed_count, 1);
  assert.equal(record.sent_count, 1);
  assert.equal(record.retry_count, 1);
});

test("aggregateResultCounts tolerates non-array/garbage input without throwing", () => {
  assert.deepEqual(aggregateResultCounts(null), {
    processed_count: 0,
    sent_count: 0,
    skipped_count: 0,
    failed_count: 0,
  });
  assert.deepEqual(aggregateResultCounts(undefined).processed_count, 0);
});

// fatal error sanitization -------------------------------------------------

test("sanitizeFatalError: short message passes through unchanged", () => {
  const err = new Error("connection reset");
  assert.equal(sanitizeFatalError(err), "connection reset");
});

test("sanitizeFatalError: only the first line survives -- no stack trace persisted", () => {
  const err = new Error("boom\n    at foo (index.ts:42:1)\n    at bar (index.ts:10:1)");
  const sanitized = sanitizeFatalError(err);
  assert.equal(sanitized, "boom");
  assert.doesNotMatch(sanitized, /at foo|at bar|index\.ts/);
});

test("sanitizeFatalError: long message is truncated to a bounded length", () => {
  const longMessage = "x".repeat(1000);
  const sanitized = sanitizeFatalError(new Error(longMessage));
  assert.ok(sanitized.length <= 501); // 500 chars + ellipsis marker
  assert.ok(sanitized.endsWith("…"));
});

test("sanitizeFatalError: non-Error thrown value is handled without throwing", () => {
  assert.doesNotThrow(() => sanitizeFatalError("a plain string throw"));
  assert.doesNotThrow(() => sanitizeFatalError({ weird: "object" }));
  assert.doesNotThrow(() => sanitizeFatalError(null));
});

// fatal run persistence -----------------------------------------------------

test("buildFailureRecord: status always 'failed', carries a sanitized message", () => {
  const record = buildFailureRecord({
    completedAt: "2026-08-16T08:00:01.000Z",
    error: new Error("db unreachable"),
  });
  assert.equal(record.status, "failed");
  assert.equal(record.completed_at, "2026-08-16T08:00:01.000Z");
  assert.equal(record.fatal_error, "db unreachable");
});
