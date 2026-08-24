import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// CHARACTERIZATION — LOT 10.1G. This migration is written for review and
// is NOT executed against any database from this repository's test
// suite (no live Postgres/Supabase connection exists in this test
// environment). These tests assert against the migration's SQL source
// text, proving the intended RLS/grants/constraint shape is explicit in
// the file that would be applied -- they do not prove the live database
// has been migrated.

const MIGRATION_SOURCE = readFileSync(
  new URL(
    "../supabase/migrations/20260824000000_secure_and_deduplicate_trial_email_delivery.sql",
    import.meta.url,
  ),
  "utf8",
);

test("email_events: RLS enable and anon/authenticated revoke are explicit, guarded so the migration applies cleanly whether or not the table exists", () => {
  assert.match(MIGRATION_SOURCE, /if exists \(\s*\n\s*select 1 from pg_tables where schemaname = 'public' and tablename = 'email_events'/);
  assert.match(MIGRATION_SOURCE, /execute 'alter table public\.email_events enable row level security';/);
  assert.match(MIGRATION_SOURCE, /execute 'revoke all on public\.email_events from anon, authenticated';/);
});

test("trial_email_events: identity unique constraint is (user_id, event_type, trial_ends_at), not email", () => {
  assert.match(
    MIGRATION_SOURCE,
    /constraint trial_email_events_identity_unique\s*\n\s*unique \(user_id, event_type, trial_ends_at\)/,
  );
  assert.doesNotMatch(MIGRATION_SOURCE, /unique \(lower\(email\)/);
});

test("trial_email_events: RLS is explicitly enabled and anon/authenticated are explicitly revoked", () => {
  assert.match(MIGRATION_SOURCE, /alter table public\.trial_email_events enable row level security;/);
  assert.match(MIGRATION_SOURCE, /revoke all on public\.trial_email_events from anon, authenticated;/);
});

test("trial_email_events: event_type is allowlisted at the database level", () => {
  assert.match(
    MIGRATION_SOURCE,
    /check \(event_type in \('trial_ending_j7', 'trial_ending_j2', 'trial_expired'\)\)/,
  );
});

test("trial_email_events: status is constrained to the known outcome set", () => {
  assert.match(MIGRATION_SOURCE, /check \(status in \('claimed', 'sent', 'failed', 'unknown'\)\)/);
});

test("claim_trial_email RPC: reclaim guard never reclaims a sent row, and only reclaims an expired/non-active claim", () => {
  const rpcIndex = MIGRATION_SOURCE.indexOf("create or replace function public.claim_trial_email");
  assert.ok(rpcIndex > -1);
  const block = MIGRATION_SOURCE.slice(rpcIndex, rpcIndex + 2000);
  assert.match(block, /where public\.trial_email_events\.status <> 'sent'/);
  assert.match(block, /public\.trial_email_events\.status <> 'claimed'/);
  assert.match(block, /public\.trial_email_events\.claim_expires_at < v_now/);
});

test("claim_trial_email RPC: restricted to service_role only", () => {
  assert.match(
    MIGRATION_SOURCE,
    /revoke execute on function public\.claim_trial_email\(uuid, text, timestamptz, integer\)\s*\n\s*from anon, authenticated;/,
  );
  assert.match(
    MIGRATION_SOURCE,
    /grant execute on function public\.claim_trial_email\(uuid, text, timestamptz, integer\)\s*\n\s*to service_role;/,
  );
});

test("finalize_trial_email RPC: ownership-checked by claim_token, restricted to service_role only", () => {
  const rpcIndex = MIGRATION_SOURCE.indexOf("create or replace function public.finalize_trial_email");
  assert.ok(rpcIndex > -1);
  const block = MIGRATION_SOURCE.slice(rpcIndex, rpcIndex + 1200);
  assert.match(block, /and claim_token = p_claim_token;/);

  assert.match(
    MIGRATION_SOURCE,
    /revoke execute on function public\.finalize_trial_email\(uuid, text, timestamptz, uuid, text, text\)\s*\n\s*from anon, authenticated;/,
  );
  assert.match(
    MIGRATION_SOURCE,
    /grant execute on function public\.finalize_trial_email\(uuid, text, timestamptz, uuid, text, text\)\s*\n\s*to service_role;/,
  );
});

test("migration is non-destructive: no drop table, delete, or truncate statement anywhere", () => {
  assert.doesNotMatch(MIGRATION_SOURCE.toLowerCase(), /drop table/);
  assert.doesNotMatch(MIGRATION_SOURCE.toLowerCase(), /truncate/);
  assert.doesNotMatch(MIGRATION_SOURCE.toLowerCase(), /\bdelete from\b/);
});

test("migration is written to be safely re-runnable: uses if not exists / or replace throughout its DDL", () => {
  assert.match(MIGRATION_SOURCE, /create table if not exists public\.trial_email_events/);
  assert.match(MIGRATION_SOURCE, /create index if not exists trial_email_events_user_id_idx/);
  assert.match(MIGRATION_SOURCE, /create or replace function public\.claim_trial_email/);
  assert.match(MIGRATION_SOURCE, /create or replace function public\.finalize_trial_email/);
});
