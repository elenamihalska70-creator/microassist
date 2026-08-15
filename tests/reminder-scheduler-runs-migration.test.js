import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// UNIT/CHARACTERIZATION — LOT 8.2 scheduler_runs migration contract. No
// local/ephemeral Postgres is available in this environment, so this
// checks the migration text directly rather than executing it (same
// documented limitation as tests/reminder-claim-migration.test.js). Not
// applied to Production in this LOT.

const MIGRATION_SOURCE = readFileSync(
  new URL("../supabase/migrations/20260815_create_scheduler_runs.sql", import.meta.url),
  "utf8",
);

test("defines the scheduler_runs table", () => {
  assert.match(MIGRATION_SOURCE, /create table if not exists public\.scheduler_runs/);
});

test("contains every column required by LOT 8.2 section 2", () => {
  const requiredColumns = [
    "id uuid primary key",
    "run_id uuid not null",
    "trigger_source text not null",
    "started_at timestamptz not null",
    "completed_at timestamptz",
    "status text not null",
    "processed_count integer",
    "sent_count integer",
    "failed_count integer",
    "skipped_count integer",
    "catch_up_count integer",
    "retry_count integer",
    "fatal_error text",
    "created_at timestamptz",
  ];
  for (const column of requiredColumns) {
    assert.match(MIGRATION_SOURCE, new RegExp(column.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing: ${column}`);
  }
});

test("run_id has a uniqueness constraint", () => {
  assert.match(MIGRATION_SOURCE, /unique \(run_id\)/);
});

test("trigger_source is constrained to exactly 'scheduled' | 'manual'", () => {
  assert.match(MIGRATION_SOURCE, /trigger_source in \('scheduled', 'manual'\)/);
});

test("status is constrained to exactly 'started' | 'completed' | 'failed' -- no more (LOT 8.2 section 2)", () => {
  assert.match(MIGRATION_SOURCE, /status in \('started', 'completed', 'failed'\)/);
});

test("all six counters are constrained non-negative", () => {
  const countsBlockMatch = MIGRATION_SOURCE.match(/scheduler_runs_counts_nonnegative_check[\s\S]*?\);/);
  assert.ok(countsBlockMatch, "counts check constraint must exist");
  const block = countsBlockMatch[0];
  for (const column of [
    "processed_count",
    "sent_count",
    "failed_count",
    "skipped_count",
    "catch_up_count",
    "retry_count",
  ]) {
    assert.match(block, new RegExp(`${column} >= 0`), `${column} must be constrained >= 0`);
  }
});

test("RLS is enabled with no policies -- service_role-only by default", () => {
  assert.match(MIGRATION_SOURCE, /alter table public\.scheduler_runs enable row level security/);
  assert.doesNotMatch(MIGRATION_SOURCE, /create policy/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /grant .* to (anon|authenticated)/i);
});

test("no destructive statement, no unrelated object, no other table touched", () => {
  assert.doesNotMatch(MIGRATION_SOURCE, /\bdrop table\b/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /\btruncate\b/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /\bdelete from\b/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /alter table public\.reminders/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /cron\.(schedule|alter_job|unschedule)/i);
});

test("security: no secret values, keys, or credentials embedded", () => {
  assert.doesNotMatch(MIGRATION_SOURCE, /service_role.{0,20}key/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /eyJ[a-zA-Z0-9_-]{10,}/); // JWT shape
});

test("migration filename follows this repo's <version>_<name>.sql convention", () => {
  const path = new URL(
    "../supabase/migrations/20260815_create_scheduler_runs.sql",
    import.meta.url,
  ).pathname;
  assert.match(path, /\/\d+_[a-z0-9_]+\.sql$/);
});
