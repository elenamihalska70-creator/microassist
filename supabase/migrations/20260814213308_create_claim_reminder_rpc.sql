-- Reproduces claim_reminder exactly as already deployed to Production
-- (applied out-of-band; this file did not previously exist in the repo).
-- Definition captured verbatim via pg_get_functiondef, lowercased to match
-- this repo's migration style; body/signature unchanged. Not a schema
-- change -- this only makes the repo reproduce a runtime dependency
-- supabase/functions/send-reminder/index.ts already calls.

create or replace function public.claim_reminder(
  p_reminder_id uuid,
  p_logical_delivery_key text,
  p_lease_minutes integer default 5
)
returns table(id uuid, claimed boolean, claim_token uuid, metadata jsonb)
language plpgsql
set search_path to 'public'
as $$
declare
  v_claim_token uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_row public.reminders%rowtype;
begin
  update public.reminders r
  set metadata = jsonb_set(
        jsonb_set(
          coalesce(r.metadata, '{}'::jsonb),
          '{claim}',
          jsonb_build_object(
            'claim_token', v_claim_token,
            'claimed_at', v_now,
            'processing_started_at', v_now,
            'claim_expires_at', v_now + make_interval(mins => p_lease_minutes)
          )
        ),
        '{logical_delivery_key}',
        to_jsonb(p_logical_delivery_key)
      )
  where r.id = p_reminder_id
    and r.status = 'pending'
    and (r.reminder_type || ':' || r.id::text || ':' || r.reminder_date::text) = p_logical_delivery_key
    and (
      r.metadata->'claim' is null
      or (r.metadata->'claim'->>'claim_expires_at')::timestamptz < v_now
    )
  returning r.* into v_row;

  if v_row.id is null then
    return query select p_reminder_id, false, null::uuid, null::jsonb;
  else
    return query select v_row.id, true, v_claim_token, v_row.metadata;
  end if;
end;
$$;

revoke execute on function public.claim_reminder(uuid, text, integer) from anon, authenticated;
grant execute on function public.claim_reminder(uuid, text, integer) to service_role;
