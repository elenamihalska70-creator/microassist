-- LOT-MICROASSIST-SECURITY-P0-01
-- offer_interest and premium_waitlist hold contact details (email, phone, SMS consent).
-- Browser roles previously had permissive policies (select/update with `true`), so anyone
-- holding the public anon key could read or rewrite every row. After this migration the
-- browser can only reach these tables through two SECURITY DEFINER functions that accept
-- an email and return a status; no row is ever returned to the client.

begin;

-- Fail fast instead of queueing behind long transactions while holding table locks.
set local lock_timeout = '5s';

-- 1. Remove every browser-facing policy on both tables.
drop policy if exists "Allow insert for everyone" on public.offer_interest;
drop policy if exists "Allow insert offer_interest" on public.offer_interest;
drop policy if exists "Allow select for authenticated" on public.offer_interest;
drop policy if exists "Allow select offer_interest for upsert" on public.offer_interest;
drop policy if exists "Allow update offer_interest" on public.offer_interest;
drop policy if exists "waitlist_insert_public" on public.premium_waitlist;
drop policy if exists "waitlist_update_public" on public.premium_waitlist;

-- 2. No direct table access for browser roles; RLS stays on as a second barrier.
revoke all on table public.offer_interest from public, anon, authenticated;
revoke all on table public.premium_waitlist from public, anon, authenticated;
alter table public.offer_interest enable row level security;
alter table public.premium_waitlist enable row level security;

-- 3. Shared helper: the caller's id, only when the session belongs to a non-anonymous user
--    whose CONFIRMED account email is exactly this address. auth.email() alone is a JWT claim
--    and is not treated as proof of ownership. Not exposed to API roles.
create or replace function public.lead_owner_for_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from auth.users u
  where u.id = auth.uid()
    and u.email_confirmed_at is not null
    and coalesce(u.is_anonymous, false) = false
    and lower(u.email) = p_email
$$;

revoke all on function public.lead_owner_for_email(text) from public, anon, authenticated;

-- 4. Interest registration. The owner is derived from the session, never from the client,
--    and an existing row is never rewritten except to link it to its verified owner.
create or replace function public.save_offer_interest(
  p_email text,
  p_offer_type text,
  p_source text default null
)
returns table(status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  -- Sources are internal slugs (see normalizePremiumTriggerType); anything else is not stored.
  v_source text := case when p_source ~ '^[a-z0-9_]{1,64}$' then p_source else 'unknown' end;
  v_owner uuid;
begin
  if length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;

  if p_offer_type is null or p_offer_type not in ('current_premium', 'future_advanced') then
    raise exception 'invalid_offer_type' using errcode = '22023';
  end if;

  v_owner := public.lead_owner_for_email(v_email);

  insert into public.offer_interest as oi (email, user_id, offer_type, source, status)
  values (v_email, v_owner, p_offer_type, v_source, 'new')
  on conflict (email, offer_type) do update
    set user_id = coalesce(oi.user_id, excluded.user_id)
    where excluded.user_id is not null and oi.user_id is null;

  -- Same answer whether the email was already known, so the endpoint cannot be used to
  -- test which addresses are on the list.
  return query select 'received'::text;
end;
$$;

-- 5. Premium waitlist. Signature kept so the deployed frontend keeps working; p_user_id is
--    ignored and the status of an existing row is no longer reset.
create or replace function public.join_premium_waitlist(
  p_email text,
  p_user_id uuid,
  p_source text
)
returns table(status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_source text := case when p_source ~ '^[a-z0-9_]{1,64}$' then p_source else 'unknown' end;
  v_owner uuid;
  v_rows integer;
begin
  if length(v_email) > 254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'email_required' using errcode = '22023';
  end if;

  v_owner := public.lead_owner_for_email(v_email);

  insert into public.premium_waitlist (email, user_id, source, status)
  values (v_email, v_owner, v_source, 'pending')
  on conflict (email) do nothing;

  get diagnostics v_rows = row_count;

  if v_rows > 0 then
    return query select 'joined'::text;
    return;
  end if;

  -- Only the signed-in owner of the address learns that it was already registered.
  if v_owner is null then
    return query select 'joined'::text;
    return;
  end if;

  update public.premium_waitlist pw
  set user_id = v_owner
  where pw.email = v_email and pw.user_id is null;

  return query select 'already_exists'::text;
end;
$$;

revoke all on function public.save_offer_interest(text, text, text) from public;
revoke all on function public.join_premium_waitlist(text, uuid, text) from public;
grant execute on function public.save_offer_interest(text, text, text) to anon, authenticated, service_role;
grant execute on function public.join_premium_waitlist(text, uuid, text) to anon, authenticated, service_role;

-- 6. Assertions: any failure aborts the whole migration, leaving production unchanged.
do $assert$
declare
  v_role text;
  v_table regclass;
  v_fn regprocedure;
  v_table_owner oid := (select relowner from pg_class where oid = 'public.offer_interest'::regclass);
begin
  -- Effective privileges (includes anything inherited through PUBLIC or role membership).
  foreach v_role in array array['anon', 'authenticated'] loop
    foreach v_table in array array['public.offer_interest'::regclass, 'public.premium_waitlist'::regclass] loop
      if has_table_privilege(v_role, v_table, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
         or has_any_column_privilege(v_role, v_table, 'SELECT, INSERT, UPDATE, REFERENCES') then
        raise exception 'assert: % still has a privilege on %', v_role, v_table;
      end if;
    end loop;
  end loop;

  if exists (select 1 from pg_policy where polrelid in ('public.offer_interest'::regclass, 'public.premium_waitlist'::regclass)) then
    raise exception 'assert: a policy remains on a lead table';
  end if;

  -- Exactly one function per exposed name, anywhere in the database (no reachable overload).
  if (select count(*) from pg_proc where proname = 'save_offer_interest') <> 1
     or (select count(*) from pg_proc where proname = 'join_premium_waitlist') <> 1
     or (select count(*) from pg_proc where proname = 'lead_owner_for_email') <> 1 then
    raise exception 'assert: unexpected overload of a lead RPC';
  end if;

  foreach v_fn in array array[
    'public.save_offer_interest(text, text, text)'::regprocedure,
    'public.join_premium_waitlist(text, uuid, text)'::regprocedure,
    'public.lead_owner_for_email(text)'::regprocedure
  ] loop
    if not exists (
      select 1 from pg_proc
      where oid = v_fn and prosecdef and proconfig @> array['search_path=""'] and proowner = v_table_owner
    ) then
      raise exception 'assert: % is not SECURITY DEFINER / empty search_path / owned by the table owner', v_fn;
    end if;
    if exists (select 1 from pg_proc p, aclexplode(p.proacl) a where p.oid = v_fn and a.grantee = 0) then
      raise exception 'assert: PUBLIC can execute %', v_fn;
    end if;
  end loop;

  if not (has_function_privilege('anon', 'public.save_offer_interest(text, text, text)', 'EXECUTE')
          and has_function_privilege('anon', 'public.join_premium_waitlist(text, uuid, text)', 'EXECUTE')) then
    raise exception 'assert: anon cannot execute the public RPCs';
  end if;

  if has_function_privilege('anon', 'public.lead_owner_for_email(text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.lead_owner_for_email(text)', 'EXECUTE') then
    raise exception 'assert: lead_owner_for_email is reachable from the API';
  end if;
end
$assert$;

-- Expose the new RPC immediately (pgrst_ddl_watch also does this; explicit for safety).
notify pgrst, 'reload schema';

commit;
