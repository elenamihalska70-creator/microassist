-- REVIEW PROPOSAL ONLY. Not an automatically queued migration.
-- Do not execute on Production/linked Supabase in LOT 6D.4.
-- Keep this policy after schema activation, including during app rollback.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.invoices'::regclass AND relkind = 'r' AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Expected ordinary invoices table with RLS enabled';
  END IF;
  IF (SELECT count(*) FROM pg_roles
      WHERE rolname IN ('anon', 'authenticated')
        AND NOT rolsuper AND NOT rolbypassrls) <> 2 THEN
    RAISE EXCEPTION 'Browser roles missing or privileged; stop for review';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
    WHERE c.oid = 'public.invoices'::regclass
      AND (pg_has_role('anon', r.oid, 'MEMBER')
        OR pg_has_role('authenticated', r.oid, 'MEMBER'))
  ) THEN
    RAISE EXCEPTION 'Browser role can reach table owner; stop for review';
  END IF;
END
$preflight$;

CREATE POLICY lot_10_3b_6d_4_deny_browser_invoice_insert
  ON public.invoices
  AS RESTRICTIVE
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);
COMMIT;
