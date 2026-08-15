// Pure, runtime-agnostic (Deno + Node) scheduler health model (LOT 8.3).
//
// Answers, from a recent slice of scheduler_runs rows alone: is the
// scheduler healthy, and how are the reminders the latest run touched
// faring? Two deliberately separate dimensions (LOT 8.3 sections 10/11):
//   scheduler_status  -- did send-reminder actually run and finish on
//                        schedule? (infrastructure question)
//   processing_status -- of the reminders the latest run touched, did any
//                        fail? (business-processing question)
// A scheduler that runs perfectly on time while individual reminders
// transiently fail is not an infrastructure problem -- that's exactly what
// the retry system (LOT 7.31-7.33) already exists to absorb. Collapsing
// these into one status would either hide a real scheduler outage behind
// "well SOME emails went out," or cry wolf over ordinary, self-healing
// per-item failures.
//
// No alerting, no DB writes, no HTTP endpoint, and nothing here is called
// from index.ts -- this module is exposed for a future watchdog/dashboard
// LOT to consume (LOT 8.1 section 16), not wired into anything yet.

// LOT 8.1/8.2 approved thresholds, restated exactly (this LOT sections
// 5/6): HEALTHY < 25h, DEGRADED in [25h, 49h], UNHEALTHY > 49h, all
// relative to the last successful SCHEDULED completion. Manual runs are
// filtered out before any of this is computed.
const HEALTHY_THRESHOLD_HOURS = 25;
const UNHEALTHY_THRESHOLD_HOURS = 49;
const HOUR_MS = 60 * 60 * 1000;

// Function-runtime-based, not an arbitrary day count (LOT 8.3 section 8):
// LOT 8.1's live evidence showed real invocations complete in ~70-130ms at
// current volume, and Supabase Edge Functions have their own platform
// wall-clock timeout far shorter than this. 10 minutes is generous enough
// to never false-positive on a legitimately large batch, while still being
// a dramatically faster signal than waiting a full day for the time-based
// thresholds to notice a genuinely orphaned "started" row.
export const STUCK_RUN_THRESHOLD_MS = 10 * 60 * 1000;

// How much history the health model looks at (LOT 8.3 section 12): enough
// to reliably find a recent success/failure and a meaningful consecutive-
// failure streak, without ever loading the whole table. Cron fires once a
// day, so 30 rows is roughly a month of daily runs -- comfortably more
// than the 49h UNHEALTHY threshold could ever need, small enough to never
// be a real query-cost concern on a table this size.
export const RECENT_RUNS_LIMIT = 30;

function toTime(isoString) {
  return isoString ? new Date(isoString).getTime() : null;
}

function hoursBetween(laterMs, earlierMs) {
  return (laterMs - earlierMs) / HOUR_MS;
}

export function computeSchedulerHealth(runs, { now = new Date() } = {}) {
  const nowMs = now.getTime();
  // LOT 8.3 section 3: manual runs must never answer scheduler health,
  // even defensively -- filtered here regardless of what the caller
  // already excluded at the query layer.
  const scheduledRuns = (Array.isArray(runs) ? runs : []).filter(
    (r) => r?.trigger_source === "scheduled",
  );

  if (scheduledRuns.length === 0) {
    // LOT 8.3 section 7: no scheduled data at all -- not enough evidence
    // to say anything, must not be misrepresented as HEALTHY.
    return {
      scheduler_status: "UNKNOWN",
      processing_status: "UNKNOWN",
      evidence: {
        last_scheduled_started_at: null,
        last_scheduled_completed_at: null,
        last_success_at: null,
        last_failure_at: null,
        last_status: null,
        hours_since_success: null,
        consecutive_failures: null,
        is_latest_run_stuck: false,
      },
    };
  }

  const sorted = [...scheduledRuns].sort((a, b) => toTime(b.started_at) - toTime(a.started_at));
  const latestRun = sorted[0];

  const successes = sorted.filter((r) => r.status === "completed" && r.completed_at);
  const failures = sorted.filter((r) => r.status === "failed" && r.completed_at);
  const lastSuccess = successes[0] ?? null;
  const lastFailure = failures[0] ?? null;

  const isLatestRunStuck =
    latestRun.status === "started" &&
    latestRun.started_at != null &&
    nowMs - toTime(latestRun.started_at) > STUCK_RUN_THRESHOLD_MS;

  let schedulerStatus;
  let hoursSinceSuccess = null;

  if (!lastSuccess) {
    // We DO have scheduled-run history, just zero successes in it --
    // stronger and worse than "insufficient data" (UNKNOWN): a conclusive
    // UNHEALTHY, not an unknown.
    schedulerStatus = "UNHEALTHY";
  } else {
    hoursSinceSuccess = hoursBetween(nowMs, toTime(lastSuccess.completed_at));
    if (hoursSinceSuccess < HEALTHY_THRESHOLD_HOURS) {
      schedulerStatus = "HEALTHY";
    } else if (hoursSinceSuccess <= UNHEALTHY_THRESHOLD_HOURS) {
      schedulerStatus = "DEGRADED";
    } else {
      schedulerStatus = "UNHEALTHY";
    }

    if (isLatestRunStuck && schedulerStatus === "HEALTHY") {
      // Floor, not an override: direct evidence of a stuck run right now
      // must never read as fully healthy, even if history up to this
      // point looks fine. Never de-escalates an already DEGRADED/
      // UNHEALTHY result -- the time-based signal already captured the
      // more serious case.
      schedulerStatus = "DEGRADED";
    }
  }

  // Business-processing quality of the MOST RECENT attempt specifically,
  // not the most recent success -- a stale old success saying "everything
  // was fine three days ago" is not what this dimension is for. If the
  // latest run never reached "completed" (still running, or crashed
  // before finishing), there's no trustworthy failed_count, so this is
  // UNKNOWN rather than guessed at.
  const processingStatus =
    latestRun.status !== "completed"
      ? "UNKNOWN"
      : (latestRun.failed_count ?? 0) > 0
        ? "DEGRADED"
        : "HEALTHY";

  // Consecutive failed runs counting back from the most recent, stopping
  // at the first non-failure. Deliberately NOT used as an independent
  // escalation trigger to UNHEALTHY: given the fixed once-daily cadence, N
  // consecutive failures already pushes hours_since_success past the same
  // 25h/49h thresholds this model already uses, so a separate threshold
  // here would be redundant without new evidence to justify a different
  // number -- exposed as observability only (LOT 8.3 section 9).
  let consecutiveFailures = 0;
  for (const run of sorted) {
    if (run.status === "failed") consecutiveFailures += 1;
    else break;
  }

  return {
    scheduler_status: schedulerStatus,
    processing_status: processingStatus,
    evidence: {
      last_scheduled_started_at: latestRun.started_at ?? null,
      last_scheduled_completed_at: latestRun.completed_at ?? null,
      last_success_at: lastSuccess?.completed_at ?? null,
      last_failure_at: lastFailure?.completed_at ?? null,
      last_status: latestRun.status ?? null,
      hours_since_success: hoursSinceSuccess,
      consecutive_failures: consecutiveFailures,
      is_latest_run_stuck: isLatestRunStuck,
    },
  };
}

// Minimal read path (LOT 8.3 section 12): scheduled runs only, most
// recent first, bounded to RECENT_RUNS_LIMIT. No fatal_error column
// selected -- this service is backend-only with nothing consuming it yet
// (section 13); a future LOT adding real exposure must decide access to
// that field deliberately, not inherit it from here by accident.
export async function fetchRecentScheduledRuns(supabaseClient, { limit = RECENT_RUNS_LIMIT } = {}) {
  const { data, error } = await supabaseClient
    .from("scheduler_runs")
    .select("run_id, trigger_source, started_at, completed_at, status, processed_count, sent_count, failed_count")
    .eq("trigger_source", "scheduled")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    return { runs: null, error };
  }
  return { runs: data ?? [], error: null };
}

// Thin composition of the two above -- the shape a future watchdog/
// health-check endpoint would actually call. Not invoked anywhere yet.
export async function evaluateSchedulerHealth(supabaseClient, { now = new Date(), limit = RECENT_RUNS_LIMIT } = {}) {
  const { runs, error } = await fetchRecentScheduledRuns(supabaseClient, { limit });
  if (error) {
    return { error, health: null };
  }
  return { error: null, health: computeSchedulerHealth(runs, { now }) };
}
