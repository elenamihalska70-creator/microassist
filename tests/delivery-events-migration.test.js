import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// UNIT/CHARACTERIZATION — LOT 8.12 delivery_events migration contract. No
// local/ephemeral Postgres is available in this environment, so this
// checks the migration text directly rather than executing it (same
// documented limitation as tests/reminder-scheduler-runs-migration.test.js
// and tests/reminder-claim-migration.test.js). Not applied to Production
// in this LOT.

const MIGRATION_SOURCE = readFileSync(
  new URL("../supabase/migrations/20260817_create_delivery_events.sql", import.meta.url),
  "utf8",
);

test("defines the delivery_events table", () => {
  assert.match(MIGRATION_SOURCE, /create table if not exists public\.delivery_events/);
});

test("contains every required column (LOT 8.12 section 2, minus raw payload)", () => {
  const requiredColumns = [
    "id uuid primary key",
    "svix_id text not null",
    "provider text not null",
    "provider_message_id text not null",
    "reminder_id uuid",
    "event_type text not null",
    "event_created_at timestamptz not null",
    "received_at timestamptz not null",
    "bounce_type text",
    "failure_reason text",
  ];
  for (const column of requiredColumns) {
    assert.match(MIGRATION_SOURCE, new RegExp(column.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing: ${column}`);
  }
});

test("does not store the raw webhook payload -- LOT 8.12 section 2/15: PII-bearing fields (recipient, subject) must not be duplicated here", () => {
  // Checks for an actual column definition, not just the word appearing
  // anywhere -- this migration's own comments discuss raw_event/
  // payload_version by name while explaining why they were left out.
  assert.doesNotMatch(MIGRATION_SOURCE, /^\s*raw_event\s+jsonb/m);
  assert.doesNotMatch(MIGRATION_SOURCE, /^\s*payload_version\s+text/m);
});

test("svix_id has a uniqueness constraint (primary dedup key, LOT 8.12 section 6)", () => {
  assert.match(MIGRATION_SOURCE, /unique \(svix_id\)/);
});

test("event_type is constrained to exactly the six LOT 8.11-confirmed Resend event types", () => {
  const checkBlockMatch = MIGRATION_SOURCE.match(/delivery_events_event_type_check[\s\S]*?\);/);
  assert.ok(checkBlockMatch, "event_type check constraint must exist");
  const block = checkBlockMatch[0];
  for (const type of [
    "email.sent",
    "email.delivered",
    "email.delivery_delayed",
    "email.bounced",
    "email.complained",
    "email.failed",
  ]) {
    assert.match(block, new RegExp(type.replace(/\./g, "\\.")), `event_type check must allow ${type}`);
  }
});

test("event_type is not a bare unconstrained text column -- a CHECK contract exists, not a Postgres enum", () => {
  assert.match(MIGRATION_SOURCE, /check\s*\(\s*event_type in/);
  assert.doesNotMatch(MIGRATION_SOURCE, /create type .* as enum/i);
});

test("reminder_id references reminders with ON DELETE SET NULL -- audit history must survive reminder deletion (LOT 8.12 section 4)", () => {
  // Matched as one exact clause (not a permissive multi-line scan) so this
  // cannot be fooled by unrelated prose mentioning cascade/restrict
  // elsewhere in the file's own explanatory comments.
  assert.match(
    MIGRATION_SOURCE,
    /reminder_id uuid references public\.reminders\(id\) on delete set null,/,
  );
});

test("reminder_id is nullable -- an uncorrelated event (unknown provider_message_id) must still be storable (LOT 8.12 section 14)", () => {
  assert.doesNotMatch(MIGRATION_SOURCE, /reminder_id uuid not null/);
});

test("has the three minimal useful indexes (LOT 8.12 section 16), no more", () => {
  assert.match(MIGRATION_SOURCE, /delivery_events_provider_message_id_idx\s+on public\.delivery_events \(provider_message_id\)/);
  assert.match(MIGRATION_SOURCE, /delivery_events_reminder_id_idx\s+on public\.delivery_events \(reminder_id\)/);
  assert.match(MIGRATION_SOURCE, /delivery_events_event_created_at_idx\s+on public\.delivery_events \(event_created_at desc\)/);
});

test("RLS is enabled with no policies -- service_role-only by default, same as scheduler_runs", () => {
  assert.match(MIGRATION_SOURCE, /alter table public\.delivery_events enable row level security/);
  assert.doesNotMatch(MIGRATION_SOURCE, /create policy/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /grant .* to (anon|authenticated)/i);
});

test("no destructive statement, no unrelated object, no other table touched", () => {
  assert.doesNotMatch(MIGRATION_SOURCE, /\bdrop table\b/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /\btruncate\b/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /\bdelete from\b/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /alter table public\.reminders\b/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /alter table public\.scheduler_runs\b/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /alter table public\.email_events\b/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /cron\.(schedule|alter_job|unschedule)/i);
});

test("security: no secret values, keys, or credentials embedded", () => {
  assert.doesNotMatch(MIGRATION_SOURCE, /service_role.{0,20}key/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /whsec_[a-zA-Z0-9_-]+/);
  assert.doesNotMatch(MIGRATION_SOURCE, /eyJ[a-zA-Z0-9_-]{10,}/); // JWT shape
});

test("migration filename follows this repo's <version>_<name>.sql convention", () => {
  const path = new URL(
    "../supabase/migrations/20260817_create_delivery_events.sql",
    import.meta.url,
  ).pathname;
  assert.match(path, /\/\d+_[a-z0-9_]+\.sql$/);
});
