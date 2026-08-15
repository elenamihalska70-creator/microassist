import test from "node:test";
import assert from "node:assert/strict";
import {
  computeSchedulerHealth,
  fetchRecentScheduledRuns,
  RECENT_RUNS_LIMIT,
  STUCK_RUN_THRESHOLD_MS,
} from "../supabase/functions/send-reminder/reminderSchedulerHealth.js";

// UNIT — LOT 8.3 scheduler health model. `now` is always injected
// explicitly (never Date.now()/new Date() hidden inside the core
// computation) -- computeSchedulerHealth itself defaults the parameter,
// but every test below passes it explicitly for determinism.

const NOW = new Date("2026-08-20T08:00:00.000Z");

function isoHoursAgo(hours, from = NOW) {
  return new Date(from.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function run({ status = "completed", startedHoursAgo, completedHoursAgo, failedCount = 0, source = "scheduled" }) {
  return {
    trigger_source: source,
    started_at: isoHoursAgo(startedHoursAgo),
    completed_at: completedHoursAgo == null ? null : isoHoursAgo(completedHoursAgo),
    status,
    processed_count: 0,
    sent_count: 0,
    failed_count: failedCount,
  };
}

// core thresholds -----------------------------------------------------

test("fresh scheduled success -> HEALTHY / HEALTHY", () => {
  const runs = [run({ startedHoursAgo: 1, completedHoursAgo: 1 })];
  const health = computeSchedulerHealth(runs, { now: NOW });
  assert.equal(health.scheduler_status, "HEALTHY");
  assert.equal(health.processing_status, "HEALTHY");
});

test("exactly 25h since success -> DEGRADED (inclusive lower boundary)", () => {
  const runs = [run({ startedHoursAgo: 25, completedHoursAgo: 25 })];
  const health = computeSchedulerHealth(runs, { now: NOW });
  assert.equal(health.scheduler_status, "DEGRADED");
});

test("just under 25h (24.9h) -> still HEALTHY", () => {
  const health = computeSchedulerHealth(
    [
      {
        trigger_source: "scheduled",
        started_at: new Date(NOW.getTime() - 24.9 * 60 * 60 * 1000).toISOString(),
        completed_at: new Date(NOW.getTime() - 24.9 * 60 * 60 * 1000).toISOString(),
        status: "completed",
        failed_count: 0,
      },
    ],
    { now: NOW },
  );
  assert.equal(health.scheduler_status, "HEALTHY");
});

test("between 25h and 49h -> DEGRADED", () => {
  const runs = [run({ startedHoursAgo: 37, completedHoursAgo: 37 })];
  const health = computeSchedulerHealth(runs, { now: NOW });
  assert.equal(health.scheduler_status, "DEGRADED");
});

test("exactly 49h since success -> DEGRADED (inclusive upper boundary)", () => {
  const runs = [run({ startedHoursAgo: 49, completedHoursAgo: 49 })];
  const health = computeSchedulerHealth(runs, { now: NOW });
  assert.equal(health.scheduler_status, "DEGRADED");
});

test("just over 49h (49.1h) -> UNHEALTHY", () => {
  const health = computeSchedulerHealth(
    [
      {
        trigger_source: "scheduled",
        started_at: new Date(NOW.getTime() - 49.1 * 60 * 60 * 1000).toISOString(),
        completed_at: new Date(NOW.getTime() - 49.1 * 60 * 60 * 1000).toISOString(),
        status: "completed",
        failed_count: 0,
      },
    ],
    { now: NOW },
  );
  assert.equal(health.scheduler_status, "UNHEALTHY");
});

test(">49h -> UNHEALTHY", () => {
  const runs = [run({ startedHoursAgo: 96, completedHoursAgo: 96 })];
  const health = computeSchedulerHealth(runs, { now: NOW });
  assert.equal(health.scheduler_status, "UNHEALTHY");
});

// UNKNOWN ----------------------------------------------------------------

test("no scheduled data at all -> UNKNOWN / UNKNOWN, not HEALTHY", () => {
  const health = computeSchedulerHealth([], { now: NOW });
  assert.equal(health.scheduler_status, "UNKNOWN");
  assert.equal(health.processing_status, "UNKNOWN");
});

test("manual success only -> UNKNOWN (manual runs never answer scheduler health)", () => {
  const runs = [run({ startedHoursAgo: 1, completedHoursAgo: 1, source: "manual" })];
  const health = computeSchedulerHealth(runs, { now: NOW });
  assert.equal(health.scheduler_status, "UNKNOWN");
});

test("mixed manual + scheduled: manual rows are ignored for health, scheduled evidence still used", () => {
  const runs = [
    run({ startedHoursAgo: 0.5, completedHoursAgo: 0.5, source: "manual" }), // very recent manual "success"
    run({ startedHoursAgo: 30, completedHoursAgo: 30, source: "scheduled" }), // older scheduled success -> DEGRADED
  ];
  const health = computeSchedulerHealth(runs, { now: NOW });
  assert.equal(health.scheduler_status, "DEGRADED", "a recent manual success must not mask a stale scheduled one");
});

test("no successful run ever (only failures, but real history exists) -> UNHEALTHY, not UNKNOWN", () => {
  const runs = [
    run({ status: "failed", startedHoursAgo: 24, completedHoursAgo: 24 }),
    run({ status: "failed", startedHoursAgo: 48, completedHoursAgo: 48 }),
  ];
  const health = computeSchedulerHealth(runs, { now: NOW });
  assert.equal(health.scheduler_status, "UNHEALTHY");
});

// stuck run ----------------------------------------------------------------

test("stuck run (started, no completion, beyond the threshold) floors a would-be-HEALTHY result to DEGRADED", () => {
  const runs = [
    run({ startedHoursAgo: 20, completedHoursAgo: 20 }), // prior success, still within 25h
    { trigger_source: "scheduled", started_at: isoHoursAgo(0.2), completed_at: null, status: "started", failed_count: 0 },
  ];
  const health = computeSchedulerHealth(runs, { now: NOW });
  assert.equal(health.evidence.is_latest_run_stuck, true);
  assert.equal(health.scheduler_status, "DEGRADED");
});

test("started run still within the stuck threshold is NOT flagged stuck", () => {
  const recentlyStartedMs = 2 * 60 * 1000; // 2 minutes, well under STUCK_RUN_THRESHOLD_MS
  assert.ok(recentlyStartedMs < STUCK_RUN_THRESHOLD_MS);
  const runs = [
    {
      trigger_source: "scheduled",
      started_at: new Date(NOW.getTime() - recentlyStartedMs).toISOString(),
      completed_at: null,
      status: "started",
      failed_count: 0,
    },
  ];
  const health = computeSchedulerHealth(runs, { now: NOW });
  assert.equal(health.evidence.is_latest_run_stuck, false);
});

test("a stuck run never de-escalates an already-UNHEALTHY result", () => {
  const runs = [
    run({ startedHoursAgo: 96, completedHoursAgo: 96 }), // last success 96h ago -> UNHEALTHY on its own
    { trigger_source: "scheduled", started_at: isoHoursAgo(1), completed_at: null, status: "started", failed_count: 0 },
  ];
  const health = computeSchedulerHealth(runs, { now: NOW });
  assert.equal(health.scheduler_status, "UNHEALTHY");
});

// processing_status (two-dimension model) -----------------------------

test("completed run with failed_count > 0 -> scheduler HEALTHY, processing DEGRADED", () => {
  const runs = [run({ startedHoursAgo: 1, completedHoursAgo: 1, failedCount: 3 })];
  const health = computeSchedulerHealth(runs, { now: NOW });
  assert.equal(health.scheduler_status, "HEALTHY");
  assert.equal(health.processing_status, "DEGRADED");
});

test("all-zero successful run (0 reminders that day) -> HEALTHY / HEALTHY", () => {
  const runs = [run({ startedHoursAgo: 1, completedHoursAgo: 1, failedCount: 0 })];
  const health = computeSchedulerHealth(runs, { now: NOW });
  assert.equal(health.scheduler_status, "HEALTHY");
  assert.equal(health.processing_status, "HEALTHY");
});

test("latest run failed outright -> processing_status UNKNOWN (no trustworthy failed_count)", () => {
  const runs = [run({ status: "failed", startedHoursAgo: 1, completedHoursAgo: 1 })];
  const health = computeSchedulerHealth(runs, { now: NOW });
  assert.equal(health.processing_status, "UNKNOWN");
});

test("recent scheduled failure after an older success: scheduler_status still reflects the older success, evidence shows the failure", () => {
  const runs = [
    run({ status: "failed", startedHoursAgo: 2, completedHoursAgo: 2 }),
    run({ status: "completed", startedHoursAgo: 20, completedHoursAgo: 20 }),
  ];
  const health = computeSchedulerHealth(runs, { now: NOW });
  assert.equal(health.scheduler_status, "HEALTHY"); // last success still within 25h
  assert.equal(health.evidence.last_status, "failed"); // but the latest attempt is visible as failed
  assert.ok(health.evidence.last_failure_at);
});

// evidence / consecutive_failures -------------------------------------

test("consecutive_failures counts back from the most recent run, stopping at the first non-failure", () => {
  const runs = [
    run({ status: "failed", startedHoursAgo: 1, completedHoursAgo: 1 }),
    run({ status: "failed", startedHoursAgo: 25, completedHoursAgo: 25 }),
    run({ status: "completed", startedHoursAgo: 49, completedHoursAgo: 49 }),
    run({ status: "failed", startedHoursAgo: 73, completedHoursAgo: 73 }), // older than the break, must not count
  ];
  const health = computeSchedulerHealth(runs, { now: NOW });
  assert.equal(health.evidence.consecutive_failures, 2);
});

test("current time is fully injected: identical runs + different `now` produce different, deterministic results", () => {
  const runs = [run({ startedHoursAgo: 1, completedHoursAgo: 1 })];
  const soon = computeSchedulerHealth(runs, { now: NOW });
  const muchLater = computeSchedulerHealth(runs, { now: new Date(NOW.getTime() + 100 * 60 * 60 * 1000) });
  assert.equal(soon.scheduler_status, "HEALTHY");
  assert.equal(muchLater.scheduler_status, "UNHEALTHY");
});

test("malformed/incomplete rows are handled without throwing", () => {
  assert.doesNotThrow(() => computeSchedulerHealth(null, { now: NOW }));
  assert.doesNotThrow(() => computeSchedulerHealth(undefined, { now: NOW }));
  assert.doesNotThrow(() =>
    computeSchedulerHealth([{ trigger_source: "scheduled" /* missing everything else */ }], { now: NOW }),
  );
  assert.doesNotThrow(() => computeSchedulerHealth([{}, null, undefined], { now: NOW }));
});

// query helper (mocked -- NOT a claim of real DB integration) -------------

function makeMockSupabaseClient({ data, error }) {
  const calls = { table: null, select: null, eq: [], order: null, limit: null };
  const builder = {
    from(table) {
      calls.table = table;
      return builder;
    },
    select(cols) {
      calls.select = cols;
      return builder;
    },
    eq(col, val) {
      calls.eq.push([col, val]);
      return builder;
    },
    order(col, opts) {
      calls.order = [col, opts];
      return builder;
    },
    limit(n) {
      calls.limit = n;
      return Promise.resolve({ data, error });
    },
  };
  return { client: builder, calls };
}

test("fetchRecentScheduledRuns: filters to trigger_source=scheduled at the query layer (mocked, not real Postgres)", async () => {
  const { client, calls } = makeMockSupabaseClient({ data: [], error: null });
  await fetchRecentScheduledRuns(client);
  assert.equal(calls.table, "scheduler_runs");
  assert.deepEqual(calls.eq, [["trigger_source", "scheduled"]]);
});

test("fetchRecentScheduledRuns: orders by started_at descending (most recent first)", async () => {
  const { client, calls } = makeMockSupabaseClient({ data: [], error: null });
  await fetchRecentScheduledRuns(client);
  assert.deepEqual(calls.order, ["started_at", { ascending: false }]);
});

test("fetchRecentScheduledRuns: bounded to RECENT_RUNS_LIMIT by default, overridable", async () => {
  const { client, calls } = makeMockSupabaseClient({ data: [], error: null });
  await fetchRecentScheduledRuns(client);
  assert.equal(calls.limit, RECENT_RUNS_LIMIT);

  const { client: client2, calls: calls2 } = makeMockSupabaseClient({ data: [], error: null });
  await fetchRecentScheduledRuns(client2, { limit: 7 });
  assert.equal(calls2.limit, 7);
});

test("fetchRecentScheduledRuns: DB error is surfaced, not swallowed", async () => {
  const { client } = makeMockSupabaseClient({ data: null, error: { message: "connection reset" } });
  const { runs, error } = await fetchRecentScheduledRuns(client);
  assert.equal(runs, null);
  assert.ok(error);
});

test("fetchRecentScheduledRuns: null data from a successful query resolves to an empty array, not null", async () => {
  const { client } = makeMockSupabaseClient({ data: null, error: null });
  const { runs, error } = await fetchRecentScheduledRuns(client);
  assert.equal(error, null);
  assert.deepEqual(runs, []);
});
