import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getPrioritizedActions } from "../src/domain/obligations/index.js";
import { buildMissingInformationActions } from "../src/domain/obligations/buildMissingInformationActions.js";
import { buildUrssafDeclarationAction } from "../src/domain/obligations/buildUrssafDeclarationAction.js";
import { findDossierForPeriod } from "../src/domain/declarationDossier/dossierIdentity.js";
import { ACTION_TYPE, OBLIGATION_STATUS } from "../src/domain/obligations/constants.js";

// LOT 10.2D.1: fixes for the P0/P1 findings of an independent review of LOT
// 10.2D. Two kinds of coverage here: (1) behavioral tests against the
// domain layer, where a real seam exists to exercise the fixed logic
// directly, and (2) source-shape tests against the new hardening migration,
// where no live Supabase connection exists in this test runner to exercise
// RLS/RPC grants directly -- mirroring the established convention in
// tests/lot-10-2d-migration-security.test.js.

const MIGRATION_SOURCE = readFileSync(
  new URL(
    "../supabase/migrations/20260826090000_harden_declaration_dossier_history.sql",
    import.meta.url,
  ),
  "utf8",
).replace(/\r\n/g, "\n");

// ---------------------------------------------------------------------
// SECTION 6: first-declaration consistency (P1) -- getPrioritizedActions
// must refuse to fabricate a DUE/DUE_SOON/OVERDUE claim for a period that
// predates the business's own start date, exactly like
// getCurrentDeclarationView already did (see
// tests/lot-10-2d-declaration-history.test.js's own FIRST DECLARATION
// cases) -- this was the P1 inconsistency: the newer dossier view refused
// to fabricate it, but the canonical obligation model did not.
// ---------------------------------------------------------------------

const QUARTERLY_PROFILE_MID_Q2_START = Object.freeze({
  activity_type: "services",
  acre: "no",
  acre_start_date: null,
  business_start_date: "2026-05-15", // mid-Q2 -- Q2 (Apr-Jun) predates this
  declaration_frequency: "trimestriel",
});

const Q2_WINDOW_REFERENCE_DATE = "2026-07-29"; // auto-selects Q2 (Apr-Jun), 2 days before its 31 Jul deadline

test("FIRST DECLARATION: buildMissingInformationActions flags an unresolved first-declaration period as blocking", () => {
  const actions = buildMissingInformationActions({
    fiscalProfile: QUARTERLY_PROFILE_MID_Q2_START,
    referenceDate: Q2_WINDOW_REFERENCE_DATE,
  });

  const firstDeclarationAction = actions.find(
    (action) => action.metadata.missingField === "first_declaration_period",
  );
  assert.ok(firstDeclarationAction);
  assert.equal(firstDeclarationAction.metadata.blocking, true);
});

test("FIRST DECLARATION: a business started before the period is never flagged (no false positive)", () => {
  const actions = buildMissingInformationActions({
    fiscalProfile: { ...QUARTERLY_PROFILE_MID_Q2_START, business_start_date: "2020-01-01" },
    referenceDate: Q2_WINDOW_REFERENCE_DATE,
  });

  assert.equal(
    actions.some((action) => action.metadata.missingField === "first_declaration_period"),
    false,
  );
});

test("FIRST DECLARATION: getPrioritizedActions suppresses the URSSAF declaration action instead of fabricating DUE/DUE_SOON/OVERDUE", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: QUARTERLY_PROFILE_MID_Q2_START,
    revenues: [],
    referenceDate: Q2_WINDOW_REFERENCE_DATE,
  });

  const declarationAction = actions.find((action) => action.type === ACTION_TYPE.urssafDeclaration);
  assert.equal(declarationAction, undefined);

  // A safe, precise missing-information action takes its place instead --
  // never silence with nothing (no-action-required would be a fabricated
  // "all clear" here).
  const missingInfoAction = actions.find(
    (action) =>
      action.type === ACTION_TYPE.missingInformation &&
      action.metadata.missingField === "first_declaration_period",
  );
  assert.ok(missingInfoAction);
});

test("FIRST DECLARATION: once the business start date is safely before the period, the declaration action resolves normally again", () => {
  const actions = getPrioritizedActions({
    fiscalProfile: { ...QUARTERLY_PROFILE_MID_Q2_START, business_start_date: "2020-01-01" },
    revenues: [],
    referenceDate: Q2_WINDOW_REFERENCE_DATE,
  });

  const declarationAction = actions.find((action) => action.type === ACTION_TYPE.urssafDeclaration);
  assert.ok(declarationAction);
  assert.equal(declarationAction.status, OBLIGATION_STATUS.dueSoon);
});

// ---------------------------------------------------------------------
// SECTION 7: user-scope defense in depth (P1) -- findDossierForPeriod's
// own userId isolation already had direct-parameter coverage (see
// tests/lot-10-2d-declaration-dossier.test.js), but it was never actually
// threaded into getPrioritizedActions, the real integration call site --
// so a caller who accidentally passed a mixed-user array got no
// protection from the domain layer itself, relying entirely on the
// caller's own fetch already being scoped to one user. These tests use a
// genuinely mixed array (multiple users' dossiers together in the SAME
// array) rather than separate single-user arrays, matching the LOT's own
// "mixed-user-array test" requirement.
// ---------------------------------------------------------------------

const MIXED_USER_DOSSIERS = Object.freeze([
  {
    id: "dossier-other-user",
    user_id: "user-b",
    declaration_type: "urssaf_ca",
    period_start: "2026-04-01",
    period_end: "2026-06-30",
    due_date: "2026-07-31",
    declared_at: "2026-07-20T00:00:00.000Z",
    paid_at: "2026-07-21T00:00:00.000Z",
  },
  {
    id: "dossier-correct-user",
    user_id: "user-a",
    declaration_type: "urssaf_ca",
    period_start: "2026-04-01",
    period_end: "2026-06-30",
    due_date: "2026-07-31",
    declared_at: "2026-07-25T00:00:00.000Z",
    paid_at: null,
  },
]);

test("USER SCOPE: findDossierForPeriod picks only the matching user's row out of a mixed-user array", () => {
  const found = findDossierForPeriod(
    MIXED_USER_DOSSIERS,
    { type: "quarter", year: 2026, quarter: 2 },
    { userId: "user-a" },
  );
  assert.equal(found.id, "dossier-correct-user");
});

test("USER SCOPE: getPrioritizedActions never leaks another user's PAID status into this user's action, even given a mixed-user array", () => {
  const actionsForUserA = getPrioritizedActions({
    fiscalProfile: {
      activity_type: "services",
      acre: "no",
      declaration_frequency: "trimestriel",
    },
    revenues: [],
    referenceDate: Q2_WINDOW_REFERENCE_DATE,
    declarationDossiers: MIXED_USER_DOSSIERS,
    userId: "user-a",
  });

  const declarationAction = actionsForUserA.find(
    (action) => action.type === ACTION_TYPE.urssafDeclaration,
  );
  assert.ok(declarationAction);
  // user-a's own dossier is DECLARED but not PAID -- must not inherit
  // user-b's PAID fact just because the period identity matches.
  assert.equal(declarationAction.status, OBLIGATION_STATUS.declared);
  assert.equal(declarationAction.metadata.dossierId, "dossier-correct-user");
});

test("USER SCOPE: with no userId supplied, behavior is unchanged from before this LOT (first period match wins) -- the new parameter is additive, not a behavior break for existing single-user callers", () => {
  const singleUserDossiers = [MIXED_USER_DOSSIERS[1]]; // only user-a's own row, as a real caller's own RLS-scoped fetch would return
  const actions = getPrioritizedActions({
    fiscalProfile: {
      activity_type: "services",
      acre: "no",
      declaration_frequency: "trimestriel",
    },
    revenues: [],
    referenceDate: Q2_WINDOW_REFERENCE_DATE,
    declarationDossiers: singleUserDossiers,
  });

  const declarationAction = actions.find((action) => action.type === ACTION_TYPE.urssafDeclaration);
  assert.equal(declarationAction.status, OBLIGATION_STATUS.declared);
});

// ---------------------------------------------------------------------
// SECTION 8: historical due-date snapshot -- once a dossier is matched,
// its own persisted due_date is preferred over the live-recomputed
// deadline; a period with no matching dossier still uses the live engine.
// ---------------------------------------------------------------------

test("DUE DATE SNAPSHOT: a matched dossier's own due_date is used, even if it disagrees with what the live deadline engine would compute today", () => {
  const dossier = {
    id: "dossier-1",
    user_id: "u1",
    declaration_type: "urssaf_ca",
    period_start: "2026-04-01",
    period_end: "2026-06-30",
    due_date: "2026-08-15", // deliberately NOT the live engine's 2026-07-31, simulating a rule change since confirmation
    declared_at: "2026-07-20T00:00:00.000Z",
  };

  const action = buildUrssafDeclarationAction({
    fiscalProfile: {
      activity_type: "services",
      declaration_frequency: "trimestriel",
    },
    referenceDate: Q2_WINDOW_REFERENCE_DATE,
    declarationDossier: dossier,
  });

  assert.equal(action.dueDate, "2026-08-15");
  assert.equal(action.id, "urssaf-declaration-2026-08-15");
});

test("DUE DATE SNAPSHOT: with no matching dossier, the live deadline engine remains authoritative (unchanged behavior)", () => {
  const action = buildUrssafDeclarationAction({
    fiscalProfile: {
      activity_type: "services",
      declaration_frequency: "trimestriel",
    },
    referenceDate: Q2_WINDOW_REFERENCE_DATE,
    declarationDossier: null,
  });

  assert.equal(action.dueDate, "2026-07-31"); // Q2's real, live-computed deadline
});

// ---------------------------------------------------------------------
// SECTION 2/3/9/10: history-integrity, trust-source, and grant hardening,
// verified at the migration-source level (no live Supabase connection is
// available to this test runner to exercise RLS/RPC behavior directly).
// ---------------------------------------------------------------------

test("MONOTONICITY: direct client INSERT/UPDATE is removed -- the old *_insert_own/*_update_own policies are dropped", () => {
  assert.match(MIGRATION_SOURCE, /drop policy if exists "declaration_dossiers_insert_own"/);
  assert.match(MIGRATION_SOURCE, /drop policy if exists "declaration_dossiers_update_own"/);
});

test("MONOTONICITY: authenticated loses direct insert/update/delete privilege on the table -- write access only exists through the RPCs below", () => {
  assert.match(
    MIGRATION_SOURCE,
    /revoke insert, update, delete on public\.declaration_dossiers from authenticated;/,
  );
});

test("TRUST: anon retains no access at all after hardening", () => {
  assert.match(MIGRATION_SOURCE, /revoke all on public\.declaration_dossiers from anon;/);
});

test("SECTION 10: authenticated's only remaining direct table privilege is explicit SELECT (not left to an ambient default grant)", () => {
  assert.match(MIGRATION_SOURCE, /grant select on public\.declaration_dossiers to authenticated;/);
});

function extractFunctionBody(source, functionName) {
  const start = source.indexOf(`create or replace function public.${functionName}(`);
  assert.ok(start >= 0, `${functionName} definition not found`);
  const end = source.indexOf("$$;", source.indexOf("as $$", start));
  return source.slice(start, end);
}

const CONFIRM_DECLARATION_BODY = extractFunctionBody(MIGRATION_SOURCE, "confirm_declaration");
const CONFIRM_PAYMENT_BODY = extractFunctionBody(MIGRATION_SOURCE, "confirm_declaration_payment");

test("MONOTONICITY: confirm_declaration is SECURITY DEFINER with a pinned search_path (matches the claim/finalize_trial_email pattern)", () => {
  assert.match(CONFIRM_DECLARATION_BODY, /security definer/);
  assert.match(CONFIRM_DECLARATION_BODY, /set search_path to 'public'/);
});

test("MONOTONICITY: confirm_declaration derives the acting user from auth.uid(), never from a client-supplied user id", () => {
  assert.match(CONFIRM_DECLARATION_BODY, /v_user_id uuid := auth\.uid\(\)/);
  assert.doesNotMatch(CONFIRM_DECLARATION_BODY, /p_user_id/);
});

test("MONOTONICITY: on re-confirmation, only declared_revenue/actual_contributions/notes are updated -- declared_at, confirmation_source, paid_at and period identity are never in the UPDATE's SET list", () => {
  const updateClause = CONFIRM_DECLARATION_BODY.slice(CONFIRM_DECLARATION_BODY.indexOf("else"));
  assert.match(updateClause, /update public\.declaration_dossiers/);
  assert.match(updateClause, /declared_revenue = coalesce\(p_declared_revenue, declared_revenue\)/);
  assert.match(updateClause, /actual_contributions = p_actual_contributions/);
  assert.match(updateClause, /notes = p_notes/);
  assert.doesNotMatch(updateClause, /declared_at\s*=/);
  assert.doesNotMatch(updateClause, /paid_at\s*=/);
  assert.doesNotMatch(updateClause, /confirmation_source\s*=/);
  assert.doesNotMatch(updateClause, /period_start\s*=/);
  assert.doesNotMatch(updateClause, /period_end\s*=/);
  assert.doesNotMatch(updateClause, /due_date\s*=/);
});

test("TRUST: confirm_declaration hardcodes confirmation_source to 'user_confirmed' on insert -- there is no parameter through which a client can request document_supported/externally_verified", () => {
  assert.doesNotMatch(CONFIRM_DECLARATION_BODY, /p_confirmation_source/);
  const insertClause = CONFIRM_DECLARATION_BODY.slice(0, CONFIRM_DECLARATION_BODY.indexOf("else"));
  assert.match(insertClause, /'user_confirmed'/);
  assert.doesNotMatch(insertClause, /document_supported/);
  assert.doesNotMatch(insertClause, /externally_verified/);
});

test("MONOTONICITY: confirm_declaration_payment is SECURITY DEFINER, scoped by id AND user_id (the real authorization check, since SECURITY DEFINER bypasses RLS)", () => {
  assert.match(CONFIRM_PAYMENT_BODY, /security definer/);
  assert.match(CONFIRM_PAYMENT_BODY, /where id = p_dossier_id/);
  assert.match(CONFIRM_PAYMENT_BODY, /and user_id = v_user_id/);
});

test("PAYMENT: confirm_declaration_payment requires declared_at to already be set -- PAID always implies DECLARED, enforced here in addition to the table's own CHECK constraint", () => {
  assert.match(CONFIRM_PAYMENT_BODY, /and declared_at is not null/);
});

test("PAYMENT/IDEMPOTENCY: confirm_declaration_payment never overwrites an already-set paid_at -- a repeat call (double-click, retried request) leaves the original timestamp untouched", () => {
  assert.match(CONFIRM_PAYMENT_BODY, /paid_at = coalesce\(paid_at, coalesce\(p_paid_at, now\(\)\)\)/);
});

test("SECTION 10 / LOT 10.1H lesson: both new RPCs explicitly revoke the PUBLIC execute grant Postgres creates by default, in addition to revoking from anon and granting only to authenticated", () => {
  for (const fnSignature of [
    "public.confirm_declaration(\n  text, text, date, date, date, numeric, numeric, numeric, numeric, timestamptz, text\n)",
    "public.confirm_declaration_payment(uuid, timestamptz)",
  ]) {
    assert.match(
      MIGRATION_SOURCE,
      new RegExp(`revoke all on function ${escapeRegex(fnSignature)} from public;`),
    );
    assert.match(
      MIGRATION_SOURCE,
      new RegExp(`revoke all on function ${escapeRegex(fnSignature)} from anon;`),
    );
    assert.match(
      MIGRATION_SOURCE,
      new RegExp(`grant execute on function ${escapeRegex(fnSignature)} to authenticated;`),
    );
  }
});

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("MIGRATION: additive/idempotent -- no destructive statement, uses create or replace for both new functions", () => {
  assert.doesNotMatch(MIGRATION_SOURCE, /\bdrop table\b/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /\bdrop column\b/i);
  assert.doesNotMatch(MIGRATION_SOURCE, /\btruncate\b/i);
  assert.match(MIGRATION_SOURCE, /create or replace function public\.confirm_declaration\(/);
  assert.match(MIGRATION_SOURCE, /create or replace function public\.confirm_declaration_payment\(/);
});

test("MIGRATION: confirm_declaration validates required identity/snapshot parameters are not null before writing anything", () => {
  assert.match(
    CONFIRM_DECLARATION_BODY,
    /if p_declaration_type is null or p_frequency is null or p_period_start is null/,
  );
});

test("MIGRATION: both RPCs raise on an unauthenticated caller rather than silently doing nothing or writing a null-owned row", () => {
  assert.match(CONFIRM_DECLARATION_BODY, /if v_user_id is null then\s*\n\s*raise exception/);
  assert.match(CONFIRM_PAYMENT_BODY, /if v_user_id is null then\s*\n\s*raise exception/);
});
