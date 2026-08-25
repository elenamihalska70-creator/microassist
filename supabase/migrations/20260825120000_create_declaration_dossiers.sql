-- LOT 10.2D: declaration dossier -- a durable, period-scoped business
-- object distinguishing "what MicroAssist calculates" (calculated_revenue,
-- estimated_contributions -- system-derived, snapshotted at confirmation
-- time) from "what the user actually confirmed they did" (declared_revenue,
-- actual_contributions, declared_at, paid_at -- user-confirmed).
--
-- Mirrors the user-owned table pattern already established by
-- public.subscriptions (20260419_prepare_saas_profiles_and_subscriptions.sql):
-- user_id references auth.users, the shared set_current_timestamp_updated_at
-- trigger, and real auth.uid() = user_id RLS policies -- NOT the
-- zero-policy/service-role-only pattern used by trial_email_events, since
-- this table is written directly by the authenticated user's own client
-- action ("J'ai fait ma déclaration"), not by a server-side job.
--
-- Every statement is additive/idempotent (if not exists / or replace) and
-- non-destructive, per this repo's established migration convention. See
-- the preflight query at the end of this file.
--
-- LOT 10.2D live-schema preflight found that 20260419_prepare_saas_profiles_and_subscriptions.sql
-- (which originally defined set_current_timestamp_updated_at) was
-- apparently never actually applied to production -- the function does not
-- exist there (confirmed against pg_proc), matching the same "migration
-- file present locally, never applied live" pattern already documented for
-- email_events/subscriptions in this repo's history. Defined here
-- defensively (create or replace, identical to the original definition) so
-- this migration is self-sufficient regardless of that gap, rather than
-- assuming it and failing on the trigger's CREATE below.
create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.declaration_dossiers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- LOT 10.2D builds only the URSSAF turnover declaration; declaration_type
  -- is schema-ready for a future TVA/CFE dossier (LOT 10.2B's
  -- ACTION_TYPE already anticipates this split) without another migration.
  declaration_type text not null default 'urssaf_ca'
    check (declaration_type in ('urssaf_ca')),
  frequency text not null
    check (frequency in ('mensuel', 'trimestriel')),

  -- The period this dossier is FOR (a fixed calendar span), not "today".
  period_start date not null,
  period_end date not null,
  -- The period's own fixed deadline (src/domain/rules/declarationPeriod.js
  -- computeDeclarationDeadline output), snapshotted so history remains
  -- correct even if the deadline rule itself is later revised.
  due_date date not null,

  -- System-derived: MicroAssist's own calculation for this exact period,
  -- snapshotted at confirmation time (never live-recomputed after that).
  calculated_revenue numeric check (calculated_revenue is null or calculated_revenue >= 0),
  estimated_contributions numeric check (estimated_contributions is null or estimated_contributions >= 0),

  -- User-confirmed: what the user actually told URSSAF, and what they
  -- actually paid or expect to pay -- explicitly editable, prefilled from
  -- the system-derived values above but never silently overwritten by them.
  declared_revenue numeric check (declared_revenue is null or declared_revenue >= 0),
  actual_contributions numeric check (actual_contributions is null or actual_contributions >= 0),

  -- Trust/source model (LOT 10.2D section 4): a dossier with no
  -- declared_at is pure system-derived data (an anticipated obligation,
  -- not a confirmed fact). confirmation_source is schema-ready for a
  -- future Document Vault (document_supported) or an official-API sync
  -- (externally_verified) -- LOT 10.2D's own UI only ever writes
  -- 'user_confirmed'; an uploaded document must never be treated as
  -- externally verified, and an estimate must never be labeled paid.
  declared_at timestamptz,
  confirmation_source text
    check (confirmation_source in ('user_confirmed', 'document_supported', 'externally_verified')),
  -- DECLARED and PAID are deliberately independent facts (LOT 10.2D
  -- section 5/10): paid_at can only be set once declared_at is, but a
  -- declared dossier is not assumed paid.
  paid_at timestamptz,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint declaration_dossiers_period_order check (period_start <= period_end),
  constraint declaration_dossiers_paid_requires_declared
    check (paid_at is null or declared_at is not null),
  constraint declaration_dossiers_confirmation_requires_declared_at
    check (confirmation_source is null or declared_at is not null),

  -- Period identity (LOT 10.2D section 6): one dossier per user per
  -- declared period. period_start/period_end alone already can't collide
  -- between a monthly and a quarterly period (different span lengths), but
  -- declaration_type is included for clarity and to remain correct once a
  -- second declaration_type value exists.
  constraint declaration_dossiers_identity_unique
    unique (user_id, declaration_type, period_start, period_end)
);

create index if not exists declaration_dossiers_user_id_idx
  on public.declaration_dossiers(user_id);

create index if not exists declaration_dossiers_user_period_idx
  on public.declaration_dossiers(user_id, period_start desc);

drop trigger if exists set_declaration_dossiers_updated_at on public.declaration_dossiers;
create trigger set_declaration_dossiers_updated_at
before update on public.declaration_dossiers
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.declaration_dossiers enable row level security;

-- No anon access at all (LOT 10.2D section 7 requirement), belt-and-braces
-- alongside the auth.uid() RLS policies below (auth.uid() is null for an
-- anon request, so `null = user_id` already denies it -- this makes the
-- intent explicit at the grant level too, matching how this repo treats
-- other sensitive tables).
revoke all on public.declaration_dossiers from anon;

drop policy if exists "declaration_dossiers_select_own" on public.declaration_dossiers;
create policy "declaration_dossiers_select_own"
on public.declaration_dossiers
for select
using (auth.uid() = user_id);

drop policy if exists "declaration_dossiers_insert_own" on public.declaration_dossiers;
create policy "declaration_dossiers_insert_own"
on public.declaration_dossiers
for insert
with check (auth.uid() = user_id);

drop policy if exists "declaration_dossiers_update_own" on public.declaration_dossiers;
create policy "declaration_dossiers_update_own"
on public.declaration_dossiers
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Deliberately no delete policy: a dossier is a durable audit record once
-- created (RLS with no DELETE policy denies deletion for anon/authenticated;
-- service_role can still intervene if ever genuinely needed).

-- ---------------------------------------------------------------------
-- Preflight (read-only; NOT executed by this migration -- run manually
-- before applying, per this repo's established convention)
-- ---------------------------------------------------------------------
-- New table, starts empty: the unique constraint above cannot conflict
-- with any pre-existing row, and no backfill/historical-duplicate cleanup
-- step is required or provided by this migration (LOT 10.2D explicitly
-- does not fabricate historical declaration completion -- see report
-- section I).
--
-- select count(*) from public.declaration_dossiers; -- expect 0 before apply
