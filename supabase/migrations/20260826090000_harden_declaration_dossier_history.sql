-- LOT 10.2D.1: close the P0 finding from the independent LOT 10.2D review --
-- direct client UPDATE on public.declaration_dossiers (RLS scoped only to
-- row ownership, not to which columns or which value transitions) let the
-- row owner silently regress already-confirmed history: clear declared_at/
-- paid_at, backdate either to an arbitrary timestamp, rewrite period
-- identity after confirmation, or self-assign a stronger confirmation_source
-- (document_supported/externally_verified) than ever actually occurred.
--
-- Fix: remove direct client INSERT/UPDATE entirely and replace them with
-- two SECURITY DEFINER RPCs that enforce monotonic transitions server-side,
-- mirroring the exact claim_trial_email/finalize_trial_email pattern
-- already proven in this repo (20260824000000_secure_and_deduplicate_trial_email_delivery.sql)
-- -- including the LOT 10.1H lesson that Postgres grants EXECUTE to PUBLIC
-- by default on function creation, so every function below explicitly
-- revokes it in addition to revoking from anon/authenticated as intended.
--
-- SELECT is untouched (already correctly owner-scoped by the existing
-- declaration_dossiers_select_own policy) -- this migration only removes
-- write paths and adds controlled replacements for them.
--
-- Non-destructive/additive: no column, table, or existing row is altered.
-- Preflight (LOT 10.2D.1): production declaration_dossiers had 0 rows,
-- 0 declared_at, 0 paid_at at the time this migration was authored --
-- verified via `select count(*) ... from public.declaration_dossiers`
-- immediately before applying. No historical data exists to be incompatible
-- with the narrowed access model, so no repair/backfill step is needed or
-- provided by this migration.

-- ---------------------------------------------------------------------
-- 1. Remove direct client write access
-- ---------------------------------------------------------------------
drop policy if exists "declaration_dossiers_insert_own" on public.declaration_dossiers;
drop policy if exists "declaration_dossiers_update_own" on public.declaration_dossiers;

revoke insert, update, delete on public.declaration_dossiers from authenticated;
revoke all on public.declaration_dossiers from anon;

-- Explicit (LOT 10.2D.1 section 10): SELECT is the only privilege the
-- authenticated role has on this table going forward, rather than relying
-- on Supabase's ambient default grant the way the original LOT 10.2D
-- migration did (a gap the independent review flagged).
grant select on public.declaration_dossiers to authenticated;

-- ---------------------------------------------------------------------
-- 2. confirm_declaration: the only path to create or edit a dossier
-- ---------------------------------------------------------------------
-- First call for a given (user_id, declaration_type, period_start,
-- period_end) identity inserts the full row, exactly as the client-side
-- upsert used to. Every subsequent call for the SAME identity only ever
-- updates declared_revenue, actual_contributions and notes -- the
-- genuinely user-editable fields. declared_at, confirmation_source,
-- paid_at, period identity, frequency, due_date, calculated_revenue and
-- estimated_contributions are silently preserved from the original
-- confirmation regardless of what the caller passes for them: due_date/
-- calculated_revenue/estimated_contributions are a historical audit
-- snapshot ("what MicroAssist told the user at confirmation time"),
-- declared_at/confirmation_source/paid_at are facts that must never be
-- silently backdated or erased, and period_start/period_end/
-- declaration_type/frequency are the row's own identity.
create or replace function public.confirm_declaration(
  p_declaration_type text,
  p_frequency text,
  p_period_start date,
  p_period_end date,
  p_due_date date,
  p_calculated_revenue numeric,
  p_estimated_contributions numeric,
  p_declared_revenue numeric,
  p_actual_contributions numeric,
  p_declared_at timestamptz default null,
  p_notes text default null
)
returns public.declaration_dossiers
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_result public.declaration_dossiers;
begin
  if v_user_id is null then
    raise exception 'confirm_declaration requires an authenticated caller';
  end if;

  if p_declaration_type is null or p_frequency is null or p_period_start is null
     or p_period_end is null or p_due_date is null then
    raise exception 'confirm_declaration requires declaration_type, frequency, period_start, period_end and due_date';
  end if;

  select id into v_existing_id
  from public.declaration_dossiers
  where user_id = v_user_id
    and declaration_type = p_declaration_type
    and period_start = p_period_start
    and period_end = p_period_end
  for update;

  if v_existing_id is null then
    insert into public.declaration_dossiers (
      user_id, declaration_type, frequency, period_start, period_end, due_date,
      calculated_revenue, estimated_contributions,
      declared_revenue, actual_contributions,
      declared_at, confirmation_source, notes
    ) values (
      v_user_id, p_declaration_type, p_frequency, p_period_start, p_period_end, p_due_date,
      p_calculated_revenue, p_estimated_contributions,
      coalesce(p_declared_revenue, p_calculated_revenue), p_actual_contributions,
      coalesce(p_declared_at, now()), 'user_confirmed', p_notes
    )
    returning * into v_result;
  else
    update public.declaration_dossiers
    set
      declared_revenue = coalesce(p_declared_revenue, declared_revenue),
      actual_contributions = p_actual_contributions,
      notes = p_notes
    where id = v_existing_id
    returning * into v_result;
  end if;

  return v_result;
end;
$$;

revoke all on function public.confirm_declaration(
  text, text, date, date, date, numeric, numeric, numeric, numeric, timestamptz, text
) from public;
revoke all on function public.confirm_declaration(
  text, text, date, date, date, numeric, numeric, numeric, numeric, timestamptz, text
) from anon;
grant execute on function public.confirm_declaration(
  text, text, date, date, date, numeric, numeric, numeric, numeric, timestamptz, text
) to authenticated;

-- ---------------------------------------------------------------------
-- 3. confirm_declaration_payment: the only path to mark a dossier paid
-- ---------------------------------------------------------------------
-- Idempotent by construction (coalesce(paid_at, ...) leaves an
-- already-set paid_at untouched on repeat calls -- a double-click or a
-- retried request can never move the timestamp or otherwise corrupt
-- state) and requires declared_at to already be set (PAID always implies
-- DECLARED), enforced here in addition to the table's own CHECK
-- constraint (declaration_dossiers_paid_requires_declared) for defense in
-- depth. Scoped by both id and user_id despite running as SECURITY
-- DEFINER (which bypasses RLS) -- this WHERE clause is the actual
-- authorization check for this function.
create or replace function public.confirm_declaration_payment(
  p_dossier_id uuid,
  p_paid_at timestamptz default null
)
returns public.declaration_dossiers
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid := auth.uid();
  v_result public.declaration_dossiers;
begin
  if v_user_id is null then
    raise exception 'confirm_declaration_payment requires an authenticated caller';
  end if;

  update public.declaration_dossiers
  set paid_at = coalesce(paid_at, coalesce(p_paid_at, now()))
  where id = p_dossier_id
    and user_id = v_user_id
    and declared_at is not null
  returning * into v_result;

  if v_result.id is null then
    raise exception 'Dossier not found, not owned by the caller, or not yet declared';
  end if;

  return v_result;
end;
$$;

revoke all on function public.confirm_declaration_payment(uuid, timestamptz) from public;
revoke all on function public.confirm_declaration_payment(uuid, timestamptz) from anon;
grant execute on function public.confirm_declaration_payment(uuid, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- Preflight (read-only; NOT executed by this migration -- run manually
-- before applying)
-- ---------------------------------------------------------------------
-- select count(*) as total_rows,
--        count(*) filter (where declared_at is not null) as declared_rows,
--        count(*) filter (where paid_at is not null) as paid_rows
-- from public.declaration_dossiers;
-- -- LOT 10.2D.1: confirmed 0/0/0 immediately before this migration was
-- -- applied to production -- see LOT 10.2D.1 report section L.
