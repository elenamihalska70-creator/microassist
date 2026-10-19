-- SYNTHETIC DISPOSABLE LOCAL DATABASE ONLY. Creates test roles/data.
-- Never execute against any linked or remote database.
\set ON_ERROR_STOP on
SET statement_timeout = '20s';
-- Run the whole fixture under an additional external timeout (for example 60s).
-- Child psql invocations below always target this disposable container's postgres
-- database, use the actual unchanged /tmp/gate-proposal.sql, and stop on error.
CREATE ROLE table_owner NOLOGIN BYPASSRLS;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator NOLOGIN NOINHERIT;
GRANT anon, authenticated, service_role TO authenticator WITH INHERIT FALSE;
CREATE ROLE browser_inherited NOLOGIN INHERIT;
GRANT authenticated TO browser_inherited;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES
 ('00000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000002');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
 $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, browser_inherited;
CREATE TABLE public.invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
 invoice_number text NOT NULL,
 client_name text, client_address text, client_email text, description text,
 amount numeric NOT NULL DEFAULT 0,
 invoice_date date DEFAULT CURRENT_DATE, due_date date,
 status text DEFAULT 'draft', created_at timestamptz DEFAULT now()
);
ALTER TABLE public.invoices OWNER TO table_owner;
GRANT ALL ON public.invoices TO anon, authenticated, service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own invoices" ON public.invoices FOR ALL TO PUBLIC
 USING (auth.uid() = user_id);
CREATE TABLE public.scope_sentinel (id integer PRIMARY KEY);
INSERT INTO public.scope_sentinel VALUES (1);
INSERT INTO public.invoices (id,user_id,invoice_number,amount) VALUES
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','SYNTHETIC-A',10),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','SYNTHETIC-B',20);

CREATE SCHEMA audit;
GRANT USAGE ON SCHEMA audit TO anon, authenticated, browser_inherited, service_role;
CREATE FUNCTION audit.ok(passed boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF passed IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
 RAISE NOTICE 'PASS: %', label;
END $$;
CREATE FUNCTION audit.denied(statement text, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN
  EXECUTE statement;
 EXCEPTION WHEN insufficient_privilege THEN
  IF position('row-level security' IN SQLERRM) = 0 THEN
   RAISE EXCEPTION 'Unexpected privilege failure: %', SQLERRM;
  END IF;
  RAISE NOTICE 'PASS: % [42501 RLS]', label;
  RETURN;
 END;
 RAISE EXCEPTION 'FAIL: accepted forbidden operation: %', label;
END $$;
CREATE FUNCTION audit.assert_gate(label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM audit.ok(EXISTS (
  SELECT FROM pg_policy p
  WHERE p.polrelid='public.invoices'::regclass
   AND p.polname='lot_10_3b_6d_4_deny_browser_invoice_insert'
   AND NOT p.polpermissive AND p.polcmd='a' AND p.polqual IS NULL
   AND pg_get_expr(p.polwithcheck,p.polrelid)='false'
   AND ARRAY(SELECT r.rolname::text FROM pg_roles r
     WHERE r.oid=ANY(p.polroles) ORDER BY r.rolname)=ARRAY['anon','authenticated']
 ), label);
END $$;
CREATE FUNCTION audit.fixture_state() RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object(
  'table',(SELECT jsonb_build_object('owner',relowner,'rls',relrowsecurity,
    'force_rls',relforcerowsecurity,'acl',relacl)
    FROM pg_class WHERE oid='public.invoices'::regclass),
  'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY attnum) FROM pg_attribute a
    WHERE attrelid='public.invoices'::regclass AND attnum>0),
  'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY policyname) FROM pg_policies p
    WHERE schemaname='public' AND tablename='invoices'),
  'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'super',rolsuper,
    'bypass',rolbypassrls,'inherit',rolinherit) ORDER BY rolname) FROM pg_roles
    WHERE rolname IN ('anon','anon_missing','authenticated','table_owner',
      'service_role','authenticator','browser_inherited')),
  'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member)
    FROM pg_auth_members m))
$$;
CREATE TABLE audit.baseline AS
 SELECT (SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.invoices i) AS rows,
        (SELECT relacl::text FROM pg_class WHERE oid='public.invoices'::regclass) AS acl,
        (SELECT jsonb_agg(to_jsonb(a) ORDER BY attnum) FROM pg_attribute a
          WHERE attrelid='public.invoices'::regclass AND attnum>0) AS columns,
        (SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p
          WHERE schemaname='public' AND tablename='scope_sentinel') AS sentinel_policies;
SELECT audit.ok(has_table_privilege('authenticated','public.invoices','INSERT'), 'baseline table INSERT grant');
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
BEGIN;
INSERT INTO public.invoices (user_id,invoice_number) VALUES (auth.uid(),'BASELINE-OLD-INSERT');
ROLLBACK;
RESET ROLE;

-- Positive anon control without changing grants or the original owner policy.
-- The mocked subject is only a synthetic RLS fixture, never a real anon JWT.
SET ROLE anon;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
SELECT audit.ok(auth.uid()='00000000-0000-4000-8000-000000000001'::uuid
 AND has_table_privilege(current_user,'public.invoices','INSERT'), 'anon positive fixture identity/grant');
BEGIN;
INSERT INTO public.invoices(user_id,invoice_number) VALUES(auth.uid(),'ANON-POSITIVE-BASELINE');
ROLLBACK;
RESET ROLE;

-- Each child must exit on the expected SQLSTATE AND message. Closing its failed
-- transaction must leave the policy/catalog state unchanged, including roles,
-- RLS, table/column ACLs and all existing invoice policies. No translated copy of
-- the proposal is used for these failure cases. Logs exist only inside /tmp.
SELECT audit.fixture_state() AS original_state \gset
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
SELECT audit.fixture_state() AS case_state \gset
\set case_ok `timeout 12s psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -f /tmp/gate-proposal.sql >/tmp/gate-rls.log 2>&1; code=$?; if [ "$code" -eq 3 ] && grep -Fq 'P0001:' /tmp/gate-rls.log && grep -Fq 'Expected ordinary invoices table with RLS enabled' /tmp/gate-rls.log; then printf true; else cat /tmp/gate-rls.log >&2; printf false; fi`
SELECT audit.ok(:case_ok, 'RLS-disabled proposal rejected with P0001');
SELECT audit.ok(audit.fixture_state()=:'case_state'::jsonb, 'RLS-disabled failure leaves no partial policy');
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

ALTER ROLE anon RENAME TO anon_missing;
SELECT audit.fixture_state() AS case_state \gset
\set case_ok `timeout 12s psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -f /tmp/gate-proposal.sql >/tmp/gate-missing.log 2>&1; code=$?; if [ "$code" -eq 3 ] && grep -Fq 'P0001:' /tmp/gate-missing.log && grep -Fq 'Browser roles missing or privileged' /tmp/gate-missing.log; then printf true; else cat /tmp/gate-missing.log >&2; printf false; fi`
SELECT audit.ok(:case_ok, 'missing browser role rejected with P0001');
SELECT audit.ok(audit.fixture_state()=:'case_state'::jsonb, 'missing-role failure leaves no partial policy');
ALTER ROLE anon_missing RENAME TO anon;

ALTER ROLE authenticated BYPASSRLS;
SELECT audit.fixture_state() AS case_state \gset
\set case_ok `timeout 12s psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -f /tmp/gate-proposal.sql >/tmp/gate-privileged.log 2>&1; code=$?; if [ "$code" -eq 3 ] && grep -Fq 'P0001:' /tmp/gate-privileged.log && grep -Fq 'Browser roles missing or privileged' /tmp/gate-privileged.log; then printf true; else cat /tmp/gate-privileged.log >&2; printf false; fi`
SELECT audit.ok(:case_ok, 'BYPASSRLS browser role rejected with P0001');
SELECT audit.ok(audit.fixture_state()=:'case_state'::jsonb, 'privileged-role failure leaves no partial policy');
ALTER ROLE authenticated NOBYPASSRLS;

GRANT table_owner TO authenticated;
SELECT audit.fixture_state() AS case_state \gset
\set case_ok `timeout 12s psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -f /tmp/gate-proposal.sql >/tmp/gate-owner.log 2>&1; code=$?; if [ "$code" -eq 3 ] && grep -Fq 'P0001:' /tmp/gate-owner.log && grep -Fq 'Browser role can reach table owner' /tmp/gate-owner.log; then printf true; else cat /tmp/gate-owner.log >&2; printf false; fi`
SELECT audit.ok(:case_ok, 'browser owner membership rejected with P0001');
SELECT audit.ok(audit.fixture_state()=:'case_state'::jsonb, 'owner-membership failure leaves no partial policy');
REVOKE table_owner FROM authenticated;

CREATE POLICY lot_10_3b_6d_4_deny_browser_invoice_insert ON public.invoices
 AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
SELECT audit.fixture_state() AS case_state \gset
\set case_ok `timeout 12s psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -f /tmp/gate-proposal.sql >/tmp/gate-conflict.log 2>&1; code=$?; if [ "$code" -eq 3 ] && grep -Fq '42710:' /tmp/gate-conflict.log && grep -Fq 'already exists' /tmp/gate-conflict.log; then printf true; else cat /tmp/gate-conflict.log >&2; printf false; fi`
SELECT audit.ok(:case_ok, 'conflicting policy name rejected with 42710');
SELECT audit.ok(audit.fixture_state()=:'case_state'::jsonb, 'conflict failure preserves exact prior policy');
DROP POLICY lot_10_3b_6d_4_deny_browser_invoice_insert ON public.invoices;
SELECT audit.ok(audit.fixture_state()=:'original_state'::jsonb, 'all preflight mutations restored');

-- Independent bounded session holds an ACCESS EXCLUSIVE lock. Poll its actual
-- granted lock (not a guessed startup delay), then run the unchanged proposal.
-- Its 5s lock_timeout must win over the separate 12s process timeout.
\! PGAPPNAME=lot6d4a-lock-holder timeout 12s psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'BEGIN; LOCK TABLE public.invoices IN ACCESS EXCLUSIVE MODE; SELECT pg_sleep(9); ROLLBACK;' >/tmp/gate-lock-holder.log 2>&1 &
DO $$
BEGIN
 FOR attempt IN 1..50 LOOP
  IF EXISTS (SELECT FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid
    WHERE l.relation='public.invoices'::regclass AND l.granted
      AND l.mode='AccessExclusiveLock' AND a.application_name='lot6d4a-lock-holder') THEN
   RETURN;
  END IF;
  PERFORM pg_sleep(0.1);
 END LOOP;
 RAISE EXCEPTION 'Lock holder failed to acquire lock within 5s';
END $$;
\set case_ok `started=$(date +%s); timeout 12s psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -f /tmp/gate-proposal.sql >/tmp/gate-timeout.log 2>&1; code=$?; elapsed=$(($(date +%s)-started)); if [ "$code" -eq 3 ] && [ "$elapsed" -ge 4 ] && [ "$elapsed" -le 10 ] && grep -Fq '55P03:' /tmp/gate-timeout.log && grep -Fq 'lock timeout' /tmp/gate-timeout.log; then printf true; else cat /tmp/gate-timeout.log >&2; printf false; fi`
SELECT audit.ok(:case_ok, 'actual proposal lock timeout is 55P03 near 5s, not outer timeout');
SELECT audit.ok(audit.fixture_state()=:'original_state'::jsonb, 'lock timeout rolls back with no partial committed gate');

-- Test transaction rollback of gate installation, with unchanged baseline schema.
BEGIN;
CREATE POLICY lot_10_3b_6d_4_deny_browser_invoice_insert ON public.invoices
 AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
ROLLBACK;
SELECT audit.ok(NOT EXISTS (SELECT FROM pg_policies WHERE
 policyname='lot_10_3b_6d_4_deny_browser_invoice_insert'), 'gate transaction rollback');

-- Execute the exact proposal copied into this disposable container.
\i /tmp/gate-proposal.sql
SELECT audit.assert_gate('installed policy has exact name, restrictive INSERT, roles and false check');
SELECT audit.ok(has_table_privilege('authenticated','public.invoices','INSERT'), 'gate leaves table grants intact');
SELECT audit.ok((SELECT relacl::text FROM pg_class WHERE oid='public.invoices'::regclass)
 = (SELECT acl FROM audit.baseline), 'no ACL modification');
SELECT audit.ok((SELECT jsonb_agg(to_jsonb(a) ORDER BY attnum) FROM pg_attribute a
 WHERE attrelid='public.invoices'::regclass AND attnum>0)
 = (SELECT columns FROM audit.baseline), 'no column modification by gate');
SET ROLE authenticated;
SELECT audit.denied($q$INSERT INTO public.invoices(user_id,invoice_number) VALUES(auth.uid(),'OLD')$q$, 'old-schema authenticated INSERT denied');
SELECT audit.ok((SELECT count(*) FROM public.invoices)=1, 'authorized SELECT preserved; other owner hidden');
BEGIN;
UPDATE public.invoices SET status='paid'
 WHERE id='10000000-0000-4000-8000-000000000001' AND user_id=auth.uid();
SELECT audit.ok((SELECT count(*) FROM public.invoices WHERE status='paid')=1,
 'existing-schema status UPDATE preserved');
ROLLBACK;
SELECT audit.denied($q$INSERT INTO public.invoices(user_id,invoice_number) VALUES(auth.uid(),'BULK-1'),(auth.uid(),'BULK-2')$q$, 'bulk INSERT denied');
SELECT audit.denied($q$INSERT INTO public.invoices(id,user_id,invoice_number) VALUES('10000000-0000-4000-8000-000000000001',auth.uid(),'UPSERT') ON CONFLICT(id) DO UPDATE SET invoice_number=EXCLUDED.invoice_number$q$, 'conflicting upsert denied before UPDATE');
SELECT audit.denied($q$INSERT INTO public.invoices(id,user_id,invoice_number) VALUES('10000000-0000-4000-8000-000000000001',auth.uid(),'IGNORE') ON CONFLICT(id) DO NOTHING$q$, 'conflicting ignore-duplicate INSERT denied');
SELECT audit.denied($q$INSERT INTO public.invoices(id,user_id,invoice_number) VALUES('10000000-0000-4000-8000-000000000003',auth.uid(),'NEW-UPSERT') ON CONFLICT(id) DO UPDATE SET invoice_number=EXCLUDED.invoice_number$q$, 'new-row upsert denied');
RESET ROLE;
SET ROLE anon;
RESET request.jwt.claim.sub;
SELECT audit.denied($q$INSERT INTO public.invoices(user_id,invoice_number) VALUES(NULL,'ANON')$q$, 'anon INSERT denied');
SELECT audit.ok((SELECT count(*) FROM public.invoices)=0, 'anon SELECT remains owner-filtered');
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
SELECT audit.ok(auth.uid()='00000000-0000-4000-8000-000000000001'::uuid,
 'anon gate test uses the same positive-baseline owner');
SELECT audit.denied($q$INSERT INTO public.invoices(user_id,invoice_number) VALUES(auth.uid(),'ANON-POSITIVE-BASELINE')$q$,
 'anon matching-owner INSERT now denied by restrictive gate');
RESET ROLE;
SET ROLE browser_inherited;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
SELECT audit.denied($q$INSERT INTO public.invoices(user_id,invoice_number) VALUES(auth.uid(),'INHERITED')$q$, 'inherited authenticated role denied');
RESET ROLE;

-- Add only the exact synthetic compatibility proposal from LOT 6D.2.
\i /tmp/invoices-schema-compatibility.sql
SELECT audit.ok((SELECT count(*) FROM information_schema.columns WHERE table_schema='public'
 AND table_name='invoices' AND column_name IN ('is_compliant','paid_at')
 AND is_nullable='YES' AND column_default IS NULL
 AND ((column_name='is_compliant' AND data_type='boolean') OR
      (column_name='paid_at' AND data_type='timestamp with time zone')))=2, 'synthetic compatibility columns');
SELECT audit.ok((SELECT jsonb_agg(to_jsonb(i)-'is_compliant'-'paid_at' ORDER BY id)
 FROM public.invoices i)=(SELECT rows FROM audit.baseline), 'existing rows unchanged after gate and columns');
SET ROLE authenticated;
SELECT audit.denied($q$INSERT INTO public.invoices(user_id,invoice_number,client_name,client_address,client_email,description,amount,invoice_date,due_date,status,is_compliant,paid_at) VALUES(auth.uid(),'LEGACY','','','','',10,'2026-01-01','2026-02-01','unpaid',true,NULL)$q$, 'exact legacy payload denied after compatibility columns');
SELECT audit.denied($q$INSERT INTO public.invoices(user_id,invoice_number) VALUES(auth.uid(),'OMITTED-COLUMNS')$q$, 'omitting new columns cannot bypass');
SELECT audit.denied($q$INSERT INTO public.invoices(user_id,invoice_number) VALUES(auth.uid(),'BULK-3'),(auth.uid(),'BULK-4')$q$, 'bulk denied after columns');
SELECT audit.denied($q$INSERT INTO public.invoices(id,user_id,invoice_number) VALUES('10000000-0000-4000-8000-000000000001',auth.uid(),'POST-UPSERT') ON CONFLICT(id) DO UPDATE SET invoice_number=EXCLUDED.invoice_number$q$, 'upsert denied after columns');
BEGIN;
UPDATE public.invoices SET status='paid',paid_at='2026-10-18T12:00:00Z'
 WHERE id='10000000-0000-4000-8000-000000000001' AND user_id=auth.uid();
SELECT audit.ok((SELECT count(*) FROM public.invoices WHERE status='paid' AND paid_at IS NOT NULL)=1, 'authorized payment UPDATE preserved');
WITH changed AS (UPDATE public.invoices SET status='paid'
 WHERE id='10000000-0000-4000-8000-000000000002' RETURNING id)
 SELECT audit.ok((SELECT count(*) FROM changed)=0, 'other-owner UPDATE denied');
WITH deleted AS (DELETE FROM public.invoices WHERE user_id=auth.uid() RETURNING id)
 SELECT audit.ok((SELECT count(*) FROM deleted)=1, 'authorized DELETE preserved');
ROLLBACK;
RESET ROLE;
SET ROLE anon;
RESET request.jwt.claim.sub;
SELECT audit.denied($q$INSERT INTO public.invoices(invoice_number,is_compliant,paid_at) VALUES('ANON-POST',false,NULL)$q$, 'anon denied after columns');
RESET ROLE;

-- Explicitly prove the privilege boundary: service_role bypasses this gate.
SET ROLE service_role;
BEGIN;
INSERT INTO public.invoices(invoice_number) VALUES('PRIVILEGED-SYNTHETIC');
ROLLBACK;
RESET ROLE;
SELECT audit.ok((SELECT jsonb_agg(to_jsonb(i)-'is_compliant'-'paid_at' ORDER BY id)
 FROM public.invoices i)=(SELECT rows FROM audit.baseline), 'all denied attempts and rolled-back edits preserve rows');
SELECT audit.ok((SELECT count(*) FROM public.scope_sentinel)=1 AND NOT EXISTS
 (SELECT FROM pg_policies WHERE tablename='scope_sentinel'), 'other table unchanged');

-- Demonstrate unsafe gate removal ONLY in disposable transaction, then undo it.
BEGIN;
DROP POLICY lot_10_3b_6d_4_deny_browser_invoice_insert ON public.invoices;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
INSERT INTO public.invoices(user_id,invoice_number,is_compliant,paid_at)
 VALUES(auth.uid(),'UNSAFE-REMOVAL-DEMONSTRATION',true,NULL);
ROLLBACK;
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
SELECT audit.denied($q$INSERT INTO public.invoices(user_id,invoice_number) VALUES(auth.uid(),'STILL-BLOCKED')$q$, 'rollback restores denial after columns');
RESET ROLE;
SELECT audit.assert_gate('rollback restores exact policy definition and exact anon/authenticated role list');
SELECT audit.ok((SELECT count(*) FROM pg_policies WHERE tablename='invoices')=2,
 'only original policy plus restrictive gate');
SELECT version();
\echo ISOLATED_VALIDATION_COMPLETE
