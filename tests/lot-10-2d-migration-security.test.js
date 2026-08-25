import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// LOT 10.2D: declaration_dossiers is a client-writable, owner-scoped table
// (unlike the server-only trial_email_events/scheduler_runs pattern) --
// its security boundary is entirely enforced by RLS + `auth.uid()`. This
// file locks in the migration's RLS/isolation guarantees at the SQL level,
// since Node tests here have no live Supabase connection to exercise RLS
// against directly.

const MIGRATION_SOURCE = readFileSync(
  new URL("../supabase/migrations/20260825120000_create_declaration_dossiers.sql", import.meta.url),
  "utf8",
).replace(/\r\n/g, "\n");

test("SECURITY: RLS is enabled on declaration_dossiers", () => {
  assert.match(
    MIGRATION_SOURCE,
    /alter table public\.declaration_dossiers enable row level security;/,
  );
});

test("SECURITY: anon has no access at all -- explicit revoke, in addition to RLS", () => {
  assert.match(MIGRATION_SOURCE, /revoke all on public\.declaration_dossiers from anon;/);
});

test("SECURITY: select/insert/update policies are all scoped to auth.uid() = user_id -- a user can only ever read/write their own rows", () => {
  const selectPolicy = MIGRATION_SOURCE.slice(
    MIGRATION_SOURCE.indexOf('create policy "declaration_dossiers_select_own"'),
    MIGRATION_SOURCE.indexOf('create policy "declaration_dossiers_insert_own"'),
  );
  assert.match(selectPolicy, /for select/);
  assert.match(selectPolicy, /using \(auth\.uid\(\) = user_id\);/);

  const insertPolicy = MIGRATION_SOURCE.slice(
    MIGRATION_SOURCE.indexOf('create policy "declaration_dossiers_insert_own"'),
    MIGRATION_SOURCE.indexOf('create policy "declaration_dossiers_update_own"'),
  );
  assert.match(insertPolicy, /for insert/);
  assert.match(insertPolicy, /with check \(auth\.uid\(\) = user_id\);/);

  const updatePolicy = MIGRATION_SOURCE.slice(
    MIGRATION_SOURCE.indexOf('create policy "declaration_dossiers_update_own"'),
  );
  assert.match(updatePolicy, /for update/);
  assert.match(updatePolicy, /using \(auth\.uid\(\) = user_id\)/);
  assert.match(updatePolicy, /with check \(auth\.uid\(\) = user_id\);/);
});

test("SECURITY: no delete policy exists -- a dossier is a durable record no client (own or otherwise) can erase", () => {
  assert.doesNotMatch(MIGRATION_SOURCE, /for delete/);
});

test("SECURITY: user_id is a NOT NULL foreign key to auth.users with cascade delete, matching the fiscal_profiles/subscriptions/trial_email_events convention", () => {
  assert.match(
    MIGRATION_SOURCE,
    /user_id uuid not null references auth\.users\(id\) on delete cascade,/,
  );
});

test("SECURITY: the migration is additive/idempotent -- no destructive statement", () => {
  assert.doesNotMatch(MIGRATION_SOURCE, /\bdrop table\b/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /\bdrop column\b/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /\btruncate\b/i);
  assert.match(MIGRATION_SOURCE, /create table if not exists public\.declaration_dossiers/);
});

// ---------------------------------------------------------------------
// TRUST/UNIQUENESS: schema-level constraints backing the domain layer's
// own guarantees (dossierIdentity.js, buildDeclarationConfirmation.js).
// ---------------------------------------------------------------------

test("SCHEMA: the period identity unique constraint matches the domain layer's own identity key exactly", () => {
  assert.match(
    MIGRATION_SOURCE,
    /unique \(user_id, declaration_type, period_start, period_end\)/,
  );
});

test("SCHEMA: paid_at can never be set without declared_at -- payment cannot be confirmed before declaration", () => {
  assert.match(
    MIGRATION_SOURCE,
    /check \(paid_at is null or declared_at is not null\)/,
  );
});

test("SCHEMA: confirmation_source can never be set without declared_at -- no trust source without a confirmed fact", () => {
  assert.match(
    MIGRATION_SOURCE,
    /check \(confirmation_source is null or declared_at is not null\)/,
  );
});

test("SCHEMA: confirmation_source's allowed values match the domain layer's COMPLETION_STATE vocabulary exactly", () => {
  assert.match(
    MIGRATION_SOURCE,
    /check \(confirmation_source in \('user_confirmed', 'document_supported', 'externally_verified'\)\)/,
  );
});

test("SCHEMA: declaration_type is schema-ready for future types but currently constrained to only 'urssaf_ca'", () => {
  assert.match(MIGRATION_SOURCE, /check \(declaration_type in \('urssaf_ca'\)\)/);
});

test("SCHEMA: defines set_current_timestamp_updated_at defensively (create or replace) rather than assuming it already exists", () => {
  // Live-schema preflight (LOT 10.2D) found this function does NOT exist in
  // production, despite being defined in an earlier migration file
  // (20260419_prepare_saas_profiles_and_subscriptions.sql) -- that file was
  // apparently never actually applied there. `create or replace` is safe
  // and idempotent whether or not it already exists.
  assert.match(
    MIGRATION_SOURCE,
    /create or replace function public\.set_current_timestamp_updated_at\(\)/,
  );
  assert.match(
    MIGRATION_SOURCE,
    /execute function public\.set_current_timestamp_updated_at\(\);/,
  );
});

test("SCHEMA: set_current_timestamp_updated_at pins search_path (fixes a security-advisor WARN found live, matching the trial-email RPCs' hardened pattern rather than the original 20260419 definition's gap)", () => {
  assert.match(MIGRATION_SOURCE, /set search_path to 'public'/);
});
