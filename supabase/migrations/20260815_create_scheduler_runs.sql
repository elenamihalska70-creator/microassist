create table if not exists public.scheduler_runs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  trigger_source text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'started',
  processed_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  catch_up_count integer not null default 0,
  retry_count integer not null default 0,
  fatal_error text,
  created_at timestamptz not null default now(),

  constraint scheduler_runs_run_id_unique unique (run_id),
  constraint scheduler_runs_trigger_source_check
    check (trigger_source in ('scheduled', 'manual')),
  constraint scheduler_runs_status_check
    check (status in ('started', 'completed', 'failed')),
  constraint scheduler_runs_counts_nonnegative_check
    check (
      processed_count >= 0
      and sent_count >= 0
      and failed_count >= 0
      and skipped_count >= 0
      and catch_up_count >= 0
      and retry_count >= 0
    )
);

-- Dominant read pattern: "how recent is activity" (general diagnostics).
create index if not exists scheduler_runs_started_at_idx
  on public.scheduler_runs (started_at desc);

-- Dominant health-check pattern (LOT 8.1 section 4/8): "when did the
-- scheduler last successfully complete" -- scoped to trigger_source since
-- manual smoke invocations must never answer this question (LOT 8.1
-- section 11 / this LOT section 13). Partial index keeps it targeted
-- rather than adding a third general-purpose column index on a
-- low-volume table.
create index if not exists scheduler_runs_last_success_idx
  on public.scheduler_runs (trigger_source, completed_at desc)
  where status = 'completed';

alter table public.scheduler_runs enable row level security;

-- Deliberately zero policies: RLS with no policies denies all access to
-- anon/authenticated for both reads and writes. service_role bypasses RLS
-- entirely (Supabase default), so send-reminder (which already holds a
-- service-role client) can insert/update without any policy grant. No
-- health UI exists yet (explicitly out of scope this LOT) -- a future LOT
-- adding one must add a narrowly scoped SELECT policy then, and must not
-- expose fatal_error to a broadly-readable policy.
