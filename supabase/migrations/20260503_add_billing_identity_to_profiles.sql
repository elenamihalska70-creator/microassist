alter table public.profiles
  add column if not exists billing_identity jsonb;

do $$
begin
  if to_regclass('public.invoices') is not null then
    alter table public.invoices
      add column if not exists is_compliant boolean,
      add column if not exists paid_at timestamptz;
  end if;
end
$$;
