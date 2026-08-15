import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// UNIT — LOT 7.24 repository/runtime reproducibility. claim_reminder was
// already deployed to Production (remote migration version
// 20260814213308) before any file for it existed in this repo. These tests
// pin the migration file's contract against what index.ts actually calls
// (LOT 7.23 section 13 snapshot of the live RPC via pg_get_functiondef),
// so a future edit to either side can't silently drift without a test
// failing. They check the migration text directly rather than executing it
// -- no local/ephemeral Postgres is available in this environment (LOT
// 7.24 section 9: parse/inspect against the real RPC definition instead).

const MIGRATION_SOURCE = readFileSync(
  new URL("../supabase/migrations/20260814213308_create_claim_reminder_rpc.sql", import.meta.url),
  "utf8",
);

const INDEX_SOURCE = readFileSync(
  new URL("../supabase/functions/send-reminder/index.ts", import.meta.url),
  "utf8",
);

test("A. migration defines claim_reminder", () => {
  assert.match(MIGRATION_SOURCE, /create (or replace )?function public\.claim_reminder/);
});

test("B. migration signature matches the contract index.ts calls with", () => {
  assert.match(MIGRATION_SOURCE, /p_reminder_id uuid/);
  assert.match(MIGRATION_SOURCE, /p_logical_delivery_key text/);
  assert.match(MIGRATION_SOURCE, /p_lease_minutes integer default 5/);
  assert.match(MIGRATION_SOURCE, /returns table\(id uuid, claimed boolean, claim_token uuid, metadata jsonb\)/);

  // index.ts's actual rpc() call site (LOT 7.19/7.23) must supply exactly
  // these three named params -- if either side renames a param, this fails.
  assert.match(INDEX_SOURCE, /"claim_reminder"/);
  assert.match(INDEX_SOURCE, /p_reminder_id:\s*reminder\.id/);
  assert.match(INDEX_SOURCE, /p_logical_delivery_key:\s*logicalDeliveryKey/);
  assert.match(INDEX_SOURCE, /p_lease_minutes:\s*CLAIM_LEASE_MINUTES/);
});

test("B. index.ts consumes the exact return columns the migration declares", () => {
  // claim.claimed / claim.claim_token / claim.metadata, from a row of
  // { id, claimed, claim_token, metadata } as declared in RETURNS TABLE.
  assert.match(INDEX_SOURCE, /claim\.claimed/);
  assert.match(INDEX_SOURCE, /claim\.claim_token/);
  assert.match(INDEX_SOURCE, /claim\.metadata/);
});

test("claim ownership fields written by the RPC match what index.ts reads back", () => {
  // The RPC writes metadata.claim.claim_token / claim_expires_at; index.ts's
  // ownership filter and hasDurableAcceptedOutcome() path both depend on
  // this exact shape.
  assert.match(MIGRATION_SOURCE, /'claim_token', v_claim_token/);
  assert.match(MIGRATION_SOURCE, /'claim_expires_at'/);
  assert.match(MIGRATION_SOURCE, /'\{logical_delivery_key\}'/);
  assert.match(INDEX_SOURCE, /metadata->claim->>claim_token/);
});

test("RPC only claims pending, unexpired-or-unclaimed rows matching the logical delivery key", () => {
  assert.match(MIGRATION_SOURCE, /r\.status = 'pending'/);
  assert.match(
    MIGRATION_SOURCE,
    /r\.reminder_type \|\| ':' \|\| r\.id::text \|\| ':' \|\| r\.reminder_date::text/,
  );
  assert.match(MIGRATION_SOURCE, /claim_expires_at'\)::timestamptz < v_now/);
});

test("no destructive statement (drop table/truncate/delete) in the migration", () => {
  assert.doesNotMatch(MIGRATION_SOURCE, /\bdrop table\b/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /\btruncate\b/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /\bdelete from\b/i);
});

test("no unrelated DB object (table/index/cron/policy) introduced", () => {
  assert.doesNotMatch(MIGRATION_SOURCE, /create table/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /create index/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /cron\.schedule/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /create policy/i);
});

test("security: execute is restricted away from anon/authenticated and granted to service_role only", () => {
  assert.match(
    MIGRATION_SOURCE,
    /revoke execute on function public\.claim_reminder\(uuid, text, integer\) from anon, authenticated;/,
  );
  assert.match(
    MIGRATION_SOURCE,
    /grant execute on function public\.claim_reminder\(uuid, text, integer\) to service_role;/,
  );
  assert.doesNotMatch(MIGRATION_SOURCE, /to public;/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /security definer/i);
});

test("security: no secret values, keys, or credentials embedded in the migration", () => {
  assert.doesNotMatch(MIGRATION_SOURCE, /service_role.{0,20}key/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /re_[a-zA-Z0-9]{20,}/); // Resend key shape
  assert.doesNotMatch(MIGRATION_SOURCE, /eyJ[a-zA-Z0-9_-]{10,}/); // JWT shape
});

test("migration filename follows this repo's <version>_<name>.sql convention", () => {
  const path = new URL(
    "../supabase/migrations/20260814213308_create_claim_reminder_rpc.sql",
    import.meta.url,
  ).pathname;
  assert.match(path, /\/\d+_[a-z0-9_]+\.sql$/);
});
