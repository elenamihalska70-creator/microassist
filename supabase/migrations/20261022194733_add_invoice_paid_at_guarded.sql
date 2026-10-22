-- Local review only. Apply separately after approval; never replay the INSERT gate.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';
SET LOCAL idle_in_transaction_session_timeout = '20s';

-- Serialize schema/policy inspection with the ALTER; lock wait is bounded above.
LOCK TABLE public.invoices IN ACCESS EXCLUSIVE MODE;
DO $preflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE oid = 'public.invoices'::regclass AND relkind = 'r'
      AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Expected ordinary invoices table with RLS enabled';
  END IF;
  IF (SELECT count(*) FROM pg_roles
      WHERE rolname IN ('anon', 'authenticated')
        AND NOT rolsuper AND NOT rolbypassrls) <> 2 THEN
    RAISE EXCEPTION 'Browser roles missing or privileged';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
    WHERE c.oid = 'public.invoices'::regclass
      AND (pg_has_role('anon', r.oid, 'MEMBER')
        OR pg_has_role('authenticated', r.oid, 'MEMBER'))
  ) THEN
    RAISE EXCEPTION 'Browser role can reach invoice owner';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy p
    WHERE p.polrelid = 'public.invoices'::regclass
      AND p.polname = 'lot_10_3b_6d_4_deny_browser_invoice_insert'
      AND p.polcmd = 'a' AND NOT p.polpermissive
      AND p.polqual IS NULL
      AND pg_get_expr(p.polwithcheck, p.polrelid) = 'false'
      AND (SELECT array_agg(r.rolname::text ORDER BY r.rolname::text)
           FROM pg_roles r WHERE r.oid = ANY(p.polroles))
          = ARRAY['anon', 'authenticated']::text[]
      AND cardinality(p.polroles) = 2
  ) THEN
    RAISE EXCEPTION 'Missing or drifted invoice INSERT gate';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute
      WHERE attrelid = 'public.invoices'::regclass AND attname = 'id'
        AND atttypid = 'uuid'::regtype AND attnotnull AND NOT attisdropped)
    OR NOT EXISTS (SELECT 1 FROM pg_attribute
      WHERE attrelid = 'public.invoices'::regclass AND attname = 'user_id'
        AND atttypid = 'uuid'::regtype AND attnotnull AND NOT attisdropped)
    OR NOT EXISTS (SELECT 1 FROM pg_attribute
      WHERE attrelid = 'public.invoices'::regclass AND attname = 'status'
        AND atttypid = 'text'::regtype AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Unexpected invoice identity/payment schema';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute
      WHERE attrelid = 'public.invoices'::regclass AND attname = 'paid_at'
        AND NOT attisdropped) THEN
    RAISE EXCEPTION 'paid_at already exists; review schema/history before proceeding';
  END IF;
END
$preflight$;

ALTER TABLE public.invoices ADD COLUMN paid_at timestamptz NULL;
COMMIT;
