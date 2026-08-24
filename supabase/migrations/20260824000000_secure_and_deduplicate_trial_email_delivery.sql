-- LOT 10.1G: (1) harden the orphaned email_events table to be fully
-- server-owned, and (2) introduce a durable, DB-enforced idempotency
-- boundary for trial lifecycle emails (trial_email_events +
-- claim/finalize RPCs), reusing the exact claim/lease shape already
-- proven safe in production by claim_reminder
-- (20260814213308_create_claim_reminder_rpc.sql).
--
-- Written in LOT 10.1G for review, applied to production in LOT 10.1H
-- after live-schema verification (see that LOT's report). Every
-- statement is additive/idempotent (if not exists / or replace) and
-- non-destructive. See the preflight query at the end of this file and
-- LOT 10.1H report section F for why this migration carries zero
-- conflict risk against existing rows.

-- ---------------------------------------------------------------------
-- 1. email_events: harden to fully server-owned (LOT 10.1G section 3)
-- ---------------------------------------------------------------------
-- This table is orphaned: LOT 10.1E removed its only application
-- consumer, and no code in this repository references it anymore. It
-- was created (20260421_create_email_events.sql) without RLS and
-- without any explicit grant revocation. Per Supabase's documented
-- default, an RLS-less table is reachable through the auto-generated
-- PostgREST API by anon/authenticated roles. This section makes the
-- intended protection explicit rather than relying on nobody having
-- called it.
--
-- LOT 10.1H release verification found this table does NOT exist in
-- the live production database (its migration file was apparently never
-- actually applied there, unlike this file's own trial_email_events
-- section) -- so the exposure LOT 10.1F/G could only report as
-- "inferred, not independently verified" was in fact never live at all.
-- Guarded with a conditional so this migration applies cleanly whether
-- or not the table exists (now, or if created later), instead of
-- aborting the whole transaction on a relation-does-not-exist error.

do $$
begin
  if exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'email_events'
  ) then
    execute 'alter table public.email_events enable row level security';
    execute 'revoke all on public.email_events from anon, authenticated';
  end if;
end
$$;

-- Deliberately zero policies when the table exists: RLS with no
-- policies denies all access to anon/authenticated for both reads and
-- writes. service_role bypasses RLS entirely (Supabase default),
-- matching the delivery_events/scheduler_runs precedent already
-- established in this repository.

-- ---------------------------------------------------------------------
-- 2. trial_email_events: new, purpose-built idempotency table
-- ---------------------------------------------------------------------
-- A new table rather than retrofitting email_events: email_events' shape
-- has no trial_ends_at/claim/lease fields, no RLS today, and its blast
-- radius if repurposed is unknown. A new table starts empty (zero
-- conflict risk for the unique constraint below) and is born with RLS
-- enabled from row one.

create table if not exists public.trial_email_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null
    check (event_type in ('trial_ending_j7', 'trial_ending_j2', 'trial_expired')),
  trial_ends_at timestamptz not null,
  status text not null default 'claimed'
    check (status in ('claimed', 'sent', 'failed', 'unknown')),
  claim_token uuid not null,
  claimed_at timestamptz not null default now(),
  claim_expires_at timestamptz not null,
  provider_message_id text,
  created_at timestamptz not null default now(),

  -- The idempotency identity (LOT 10.1F/10.1G section D/G): user_id, not
  -- email (durable across devices/sessions, unaffected by an email
  -- change), scoped to one event kind, and including trial_ends_at so a
  -- genuine future second trial (a new trial_ends_at) is never
  -- permanently blocked by a prior trial's row.
  constraint trial_email_events_identity_unique
    unique (user_id, event_type, trial_ends_at)
);

create index if not exists trial_email_events_user_id_idx
  on public.trial_email_events (user_id);

alter table public.trial_email_events enable row level security;
-- Zero policies, same deny-all-to-client / service_role-bypasses pattern
-- as email_events above and delivery_events/scheduler_runs. Only the
-- Edge Function, using the service-role key, can read or write this
-- table -- no client (anon or authenticated) ever touches it directly.

revoke all on public.trial_email_events from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Atomic claim/lease RPC -- adapted from claim_reminder
-- ---------------------------------------------------------------------
-- Single atomic INSERT ... ON CONFLICT DO UPDATE ... WHERE statement:
-- Postgres's own row-level locking resolves simultaneous callers for the
-- same identity, so exactly one can ever see itself win a given claim at
-- a time (LOT 10.1F section E, re-verified against this exact SQL shape
-- in LOT 10.1G section I). A row is only ever reclaimable if it has not
-- reached 'sent' AND (it is not actively 'claimed', or its lease has
-- expired) -- this is what makes a failed/unknown outcome retryable
-- while a crashed invocation's stuck claim eventually recovers, and a
-- successfully sent email is never resent.
create or replace function public.claim_trial_email(
  p_user_id uuid,
  p_event_type text,
  p_trial_ends_at timestamptz,
  p_lease_minutes integer default 5
)
returns table(claimed boolean, claim_token uuid)
language plpgsql
set search_path to 'public'
as $$
declare
  v_claim_token uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_row public.trial_email_events%rowtype;
begin
  insert into public.trial_email_events
    (user_id, event_type, trial_ends_at, status, claim_token, claimed_at, claim_expires_at)
  values
    (p_user_id, p_event_type, p_trial_ends_at, 'claimed', v_claim_token, v_now,
     v_now + make_interval(mins => p_lease_minutes))
  on conflict (user_id, event_type, trial_ends_at) do update
    set claim_token = v_claim_token,
        claimed_at = v_now,
        claim_expires_at = v_now + make_interval(mins => p_lease_minutes),
        status = 'claimed'
    where public.trial_email_events.status <> 'sent'
      and (
        public.trial_email_events.status <> 'claimed'
        or public.trial_email_events.claim_expires_at < v_now
      )
  returning * into v_row;

  if v_row.id is null or v_row.claim_token is distinct from v_claim_token then
    return query select false, null::uuid;
  else
    return query select true, v_row.claim_token;
  end if;
end;
$$;

revoke execute on function public.claim_trial_email(uuid, text, timestamptz, integer)
  from anon, authenticated;
grant execute on function public.claim_trial_email(uuid, text, timestamptz, integer)
  to service_role;

-- ---------------------------------------------------------------------
-- 4. Ownership-checked finalize RPC
-- ---------------------------------------------------------------------
-- Only the invocation still holding the exact claim_token it was issued
-- may finalize -- a stale/superseded claim token (e.g. a crashed
-- invocation that finally wakes up after its lease was reclaimed) is
-- rejected (0 rows updated), never overwriting a newer invocation's
-- outcome.
create or replace function public.finalize_trial_email(
  p_user_id uuid,
  p_event_type text,
  p_trial_ends_at timestamptz,
  p_claim_token uuid,
  p_status text,
  p_provider_message_id text default null
)
returns boolean
language plpgsql
set search_path to 'public'
as $$
declare
  v_updated integer;
begin
  update public.trial_email_events
  set status = p_status,
      provider_message_id = coalesce(p_provider_message_id, provider_message_id)
  where user_id = p_user_id
    and event_type = p_event_type
    and trial_ends_at = p_trial_ends_at
    and claim_token = p_claim_token;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke execute on function public.finalize_trial_email(uuid, text, timestamptz, uuid, text, text)
  from anon, authenticated;
grant execute on function public.finalize_trial_email(uuid, text, timestamptz, uuid, text, text)
  to service_role;

-- ---------------------------------------------------------------------
-- 5. Preflight (read-only; NOT executed by this migration -- run
--    manually before applying; see LOT 10.1G report section L)
-- ---------------------------------------------------------------------
-- select count(*) as total_rows,
--        count(*) filter (where user_id is null) as rows_missing_user_id
-- from public.email_events;
--
-- trial_email_events is newly created immediately above and starts
-- empty, so its own unique constraint cannot conflict with any
-- pre-existing row. No historical-duplicate cleanup step is required or
-- provided by this migration.
