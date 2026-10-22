\set ON_ERROR_STOP on
SET statement_timeout = '15s';
SELECT assert_true((SELECT atttypid = 'uuid'::regtype AND NOT attnotnull
 FROM pg_attribute WHERE attrelid='invoices'::regclass AND attname='user_id'
 AND NOT attisdropped), 'user_id remains nullable uuid after migration');
SELECT assert_true(NOT EXISTS (
 (SELECT to_jsonb(i) - 'paid_at' FROM invoices i EXCEPT SELECT row FROM before_invoices)
 UNION ALL
 (SELECT row FROM before_invoices EXCEPT SELECT to_jsonb(i) - 'paid_at' FROM invoices i)
), 'all existing row values preserved');
SELECT assert_true((SELECT count(*) = 2 AND bool_and(paid_at IS NULL) FROM invoices), 'no backfill, including existing paid status');
SELECT assert_true((SELECT atttypid = 'timestamptz'::regtype AND NOT attnotnull AND NOT atthasdef
 AND attidentity = '' AND attgenerated = '' FROM pg_attribute
 WHERE attrelid = 'invoices'::regclass AND attname = 'paid_at'), 'nullable timestamptz without default');
SELECT assert_true(NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='invoices'::regclass AND attname='is_compliant'), 'is_compliant not added');
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
WITH changed AS (UPDATE invoices SET status='paid',paid_at='2026-10-22T18:00:00Z'
 WHERE id='10000000-0000-4000-8000-000000000001' RETURNING *)
 SELECT assert_true((SELECT count(*)=1 AND bool_and(paid_at='2026-10-22T18:00:00Z') FROM changed), 'owner payment allowed');
SELECT assert_true((SELECT count(*)=0 FROM invoices WHERE invoice_number='B'), 'cross account SELECT hidden');
WITH changed AS (UPDATE invoices SET status='paid',paid_at=now()
 WHERE id='10000000-0000-4000-8000-000000000002' RETURNING *)
 SELECT assert_true((SELECT count(*)=0 FROM changed), 'cross account UPDATE affects zero rows');
DO $$ BEGIN
 BEGIN
 INSERT INTO invoices(id,user_id) VALUES ('10000000-0000-4000-8000-000000000003',auth.uid());
 RAISE EXCEPTION 'FAIL: authenticated INSERT accepted';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: authenticated INSERT denied [42501]'; END;
END $$;
RESET ROLE;
SET ROLE anon;
-- Deliberately give anon a matching synthetic UID: the restrictive gate must still win.
DO $$ BEGIN
 BEGIN
 INSERT INTO invoices(id,user_id) VALUES ('10000000-0000-4000-8000-000000000004',auth.uid());
 RAISE EXCEPTION 'FAIL: anon INSERT accepted';
 EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'PASS: anon INSERT denied [42501]'; END;
END $$;
RESET ROLE;
SELECT assert_true((SELECT status='draft' AND paid_at IS NULL FROM invoices WHERE invoice_number='B'), 'other account unchanged');
-- No cancellation action exists in the client. No new reversal contract is introduced.
