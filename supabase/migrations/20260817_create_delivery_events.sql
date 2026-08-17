create table if not exists public.delivery_events (
  id uuid primary key default gen_random_uuid(),
  svix_id text not null,
  provider text not null default 'resend',
  provider_message_id text not null,
  reminder_id uuid references public.reminders(id) on delete set null,
  event_type text not null,
  event_created_at timestamptz not null,
  received_at timestamptz not null default now(),
  bounce_type text,
  failure_reason text,

  constraint delivery_events_svix_id_unique unique (svix_id),
  constraint delivery_events_event_type_check
    check (
      event_type in (
        'email.sent',
        'email.delivered',
        'email.delivery_delayed',
        'email.bounced',
        'email.complained',
        'email.failed'
      )
    )
);

-- LOT 8.12 section 2: raw_event/payload_version deliberately omitted.
-- Resend's payload embeds the recipient address (data.to) and subject
-- (data.subject) -- storing it verbatim would duplicate PII into a table
-- this LOT's own security section requires to hold none. bounce_type and
-- failure_reason are the two small, non-PII discriminators LOT 8.11
-- sections 12/13 asked to preserve (Permanent vs Transient bounce,
-- email.failed vs email.bounced) without keeping the full payload.
--
-- No CHECK constraint on bounce_type's values: LOT 8.11's research
-- confirmed one literal value ("Permanent") from Resend's own example
-- payload, not an authoritative full enumeration -- constraining to a
-- guessed set risks silently rejecting a legitimate future value Resend
-- actually sends. Presence/absence (not null on email.bounced, null
-- otherwise) is left to the future webhook handler, not enforced here.

-- LOT 8.12 section 3/4: reminder_id is nullable and ON DELETE SET NULL,
-- not RESTRICT/CASCADE -- a webhook event whose provider_message_id
-- resolves to no known reminder must still be storable (section 14), and
-- deleting a reminder later must never destroy delivery audit history
-- (section 4). Correlation is by provider_message_id only, never by
-- recipient email (LOT 8.11 section 7 / this LOT section 3).
create index if not exists delivery_events_provider_message_id_idx
  on public.delivery_events (provider_message_id);

create index if not exists delivery_events_reminder_id_idx
  on public.delivery_events (reminder_id);

-- Dominant read pattern: "what happened, most recently" (debugging/support,
-- LOT 8.11 section 10) -- ordered by the provider's own event_created_at,
-- never local receive time (LOT 8.11 section 11/12, this LOT section 7).
create index if not exists delivery_events_event_created_at_idx
  on public.delivery_events (event_created_at desc);

alter table public.delivery_events enable row level security;

-- Deliberately zero policies, same as scheduler_runs (LOT 8.2): RLS with
-- no policies denies all access to anon/authenticated for both reads and
-- writes. service_role bypasses RLS entirely (Supabase default), so the
-- future resend-webhook function (not implemented this LOT) can insert
-- without any policy grant. No read UI exists yet -- a future LOT adding
-- one must add a narrowly scoped SELECT policy then.
