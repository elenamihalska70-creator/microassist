// Pure, runtime-agnostic (Deno + Node) scheduler heartbeat helpers
// (LOT 8.2).
//
// Builds the durable evidence that a send-reminder invocation happened and
// how it ended, so scheduler health can eventually be evaluated (LOT 8.1
// design) without depending on the reminder rows themselves. Never writes
// to Supabase -- index.ts owns the actual insert/update calls, using these
// functions only to build payloads and derive counts.

const FATAL_ERROR_MAX_LENGTH = 500;

// LOT 8.1 section 11 / this LOT section 7: the cron command is unchanged
// and carries no marker at all (out of scope to modify this LOT), so
// "no marker present" must default to "scheduled" -- manual/smoke
// invocations are the ones required to self-identify by explicitly
// setting this header. This is a deliberate trade-off, not a proof:
// nothing here cryptographically establishes a request actually came from
// pg_cron, only that it did not opt into being treated as a manual test.
export function resolveTriggerSource(headerValue) {
  return headerValue === "manual" ? "manual" : "scheduled";
}

export function buildStartRecord({ runId, triggerSource, startedAt }) {
  return {
    run_id: runId,
    trigger_source: triggerSource,
    status: "started",
    started_at: startedAt,
  };
}

// Derives sent/failed/skipped from the existing per-reminder `results`
// array index.ts already builds -- every loop iteration pushes exactly one
// entry, so reading it back afterward is a single, safe source of truth
// instead of threading counter increments through the 10+ existing
// branches (which would risk exactly the double-counting this LOT warns
// against, and would touch reminder-processing logic this LOT must not
// alter).
//
// "skipped" (claim races / not-claimed) is its own bucket, not a failure:
// it means another invocation is handling the row, or it was no longer
// eligible by the time this one reached it. Everything else this run
// didn't confirm as sent (failed / pending-retryable / finalize_failed /
// outcome_persist_failed) counts as failed_count -- from THIS run's
// perspective none of them ended in a confirmed send. The invariant
// sent + failed + skipped === processed always holds by construction.
export function aggregateResultCounts(results) {
  const list = Array.isArray(results) ? results : [];
  const sentCount = list.filter((r) => r?.status === "sent").length;
  const skippedCount = list.filter((r) => r?.status === "skipped").length;
  const processedCount = list.length;
  const failedCount = processedCount - sentCount - skippedCount;

  return {
    processed_count: processedCount,
    sent_count: sentCount,
    skipped_count: skippedCount,
    failed_count: failedCount,
  };
}

export function buildCompletionRecord({ completedAt, results, catchUpCount, retryCount }) {
  const counts = aggregateResultCounts(results);

  return {
    status: "completed",
    completed_at: completedAt,
    ...counts,
    catch_up_count: catchUpCount ?? 0,
    retry_count: retryCount ?? 0,
  };
}

// No stack trace, no PII: only the first line of the error's own message,
// bounded in length. This project's error messages never embed secrets or
// user data (the same contract reminderMetadata.js's failure_reason
// already relies on), so this is a truncation safeguard, not a redaction
// one -- it protects against an unexpectedly huge message, not against a
// message that was never going to contain anything sensitive.
export function sanitizeFatalError(error) {
  const raw =
    error && typeof error === "object" && "message" in error ? String(error.message) : String(error);
  const firstLine = raw.split("\n")[0];
  return firstLine.length > FATAL_ERROR_MAX_LENGTH
    ? `${firstLine.slice(0, FATAL_ERROR_MAX_LENGTH)}…`
    : firstLine;
}

export function buildFailureRecord({ completedAt, error }) {
  return {
    status: "failed",
    completed_at: completedAt,
    fatal_error: sanitizeFatalError(error),
  };
}
