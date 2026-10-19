-- ONLY in the named network-isolated disposable container, after the historical fixture.
\set ON_ERROR_STOP on
SET statement_timeout = '20s';
SELECT audit.assert_gate('supplement starts with exact gate');
CREATE TABLE audit.supplement_rows AS SELECT jsonb_agg(to_jsonb(i) ORDER BY id) AS rows FROM public.invoices i;
CREATE FUNCTION audit.expected_code(statement text, expected text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual text;
BEGIN
 BEGIN
  EXECUTE statement;
 EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS actual = RETURNED_SQLSTATE;
  IF actual <> expected THEN RAISE EXCEPTION 'Unexpected SQLSTATE % for %, expected %', actual,label,expected; END IF;
  RAISE NOTICE 'PASS: % [%]',label,actual;
  RETURN;
 END;
 RAISE EXCEPTION 'FAIL: expected rejection: %',label;
END $$;

-- Deliberately remove the gate ONLY in this synthetic DB for a full-payload positive control.
DROP POLICY lot_10_3b_6d_4_deny_browser_invoice_insert ON public.invoices;
SET ROLE authenticated;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
BEGIN;
WITH added AS (
 INSERT INTO public.invoices(user_id,invoice_number,client_name,client_address,client_email,description,amount,invoice_date,due_date,status,is_compliant,paid_at)
 VALUES(auth.uid(),'FULL-POSITIVE','SYNTHETIC','','','TEST',10,'2026-01-01','2026-02-01','unpaid',true,NULL) RETURNING id
) SELECT audit.ok((SELECT count(*) FROM added)=1,'full legacy-shaped positive control affects exactly one row before gate');
ROLLBACK;
RESET ROLE;

-- Execute the exact proposal with a synthetic error AFTER CREATE POLICY, BEFORE COMMIT.
SELECT audit.fixture_state() AS rollback_baseline \gset
CREATE FUNCTION audit.abort_gate_ddl() RETURNS event_trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION USING ERRCODE='ZX001', MESSAGE='synthetic abort after gate DDL before COMMIT'; END $$;
CREATE EVENT TRIGGER synthetic_abort_gate ON ddl_command_end WHEN TAG IN ('CREATE POLICY') EXECUTE FUNCTION audit.abort_gate_ddl();
\set rollback_ok `timeout 12s psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -f /tmp/gate-proposal.sql >/tmp/gate-abort.log 2>&1; code=$?; if [ "$code" -eq 3 ] && grep -Fq 'ZX001:' /tmp/gate-abort.log; then printf true; else cat /tmp/gate-abort.log >&2; printf false; fi`
SELECT audit.ok(:rollback_ok,'exact gate proposal aborts after DDL before commit with ZX001');
DROP EVENT TRIGGER synthetic_abort_gate;
DROP FUNCTION audit.abort_gate_ddl();
SELECT audit.ok(audit.fixture_state()=:'rollback_baseline'::jsonb,'precommit abort restores exact relevant initial catalogs/roles');
SELECT audit.ok((SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.invoices i)=(SELECT rows FROM audit.supplement_rows),'precommit rollback preserves all rows');
\i /tmp/gate-proposal.sql
SELECT audit.assert_gate('exact proposal reinstalled after precommit rollback test');

SET ROLE authenticated;
BEGIN;
SELECT audit.denied($q$INSERT INTO public.invoices(user_id,invoice_number,client_name,client_address,client_email,description,amount,invoice_date,due_date,status,is_compliant,paid_at)
VALUES(auth.uid(),'FULL-SIMPLE','SYNTHETIC','','','TEST',10,'2026-01-01','2026-02-01','unpaid',true,NULL)$q$,'full legacy simple INSERT denied');
SELECT audit.denied($q$INSERT INTO public.invoices(user_id,invoice_number,client_name,client_address,client_email,description,amount,invoice_date,due_date,status,is_compliant,paid_at)
VALUES(auth.uid(),'FULL-BULK-1','SYNTHETIC','','','TEST',10,'2026-01-01','2026-02-01','unpaid',true,NULL),
(auth.uid(),'FULL-BULK-2','SYNTHETIC','','','TEST',10,'2026-01-01','2026-02-01','unpaid',true,NULL)$q$,'full legacy bulk INSERT denied');
SELECT audit.denied($q$INSERT INTO public.invoices(id,user_id,invoice_number,client_name,client_address,client_email,description,amount,invoice_date,due_date,status,is_compliant,paid_at)
VALUES('10000000-0000-4000-8000-000000000001',auth.uid(),'FULL-CONFLICT','SYNTHETIC','','','TEST',999,'2026-01-01','2026-02-01','paid',true,NULL)
ON CONFLICT(id) DO UPDATE SET amount=EXCLUDED.amount,status=EXCLUDED.status$q$,'full legacy conflicting upsert denied');
WITH changed AS (UPDATE public.invoices SET status='paid',paid_at='2026-10-19T00:00:00Z' WHERE user_id=auth.uid() RETURNING id)
 SELECT audit.ok((SELECT count(*) FROM changed)=1,'payment UPDATE affects exactly one authorized row');
SELECT audit.ok((SELECT count(*) FROM public.invoices WHERE status='paid' AND paid_at='2026-10-19T00:00:00Z')=1,'payment fields really updated');
WITH removed AS (DELETE FROM public.invoices WHERE user_id=auth.uid() RETURNING id)
 SELECT audit.ok((SELECT count(*) FROM removed)=1,'DELETE affects exactly one authorized row');
SELECT audit.ok((SELECT count(*) FROM public.invoices)=0,'authorized row really deleted inside test transaction');
ROLLBACK;
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';
SELECT audit.ok((SELECT count(*) FROM public.invoices WHERE id='10000000-0000-4000-8000-000000000001')=0,'user B cannot read user A');
WITH changed AS (UPDATE public.invoices SET amount=999 WHERE id='10000000-0000-4000-8000-000000000001' RETURNING id)
 SELECT audit.ok((SELECT count(*) FROM changed)=0,'user B cannot update user A: zero affected rows');
WITH removed AS (DELETE FROM public.invoices WHERE id='10000000-0000-4000-8000-000000000001' RETURNING id)
 SELECT audit.ok((SELECT count(*) FROM removed)=0,'user B cannot delete user A: zero affected rows');
RESET ROLE;
SELECT audit.ok((SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.invoices i)=(SELECT rows FROM audit.supplement_rows),'all full-payload denials and rolled-back CRUD leave exact rows intact');

-- Explicitly distinguish missing-column parsing failure from RLS denial.
BEGIN;
ALTER TABLE public.invoices DROP COLUMN is_compliant, DROP COLUMN paid_at;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
SELECT audit.expected_code($q$INSERT INTO public.invoices(user_id,invoice_number,is_compliant,paid_at)
 VALUES(auth.uid(),'MISSING-COLUMNS',true,NULL)$q$,'42703','payload naming absent compatibility columns fails parsing, not RLS');
SELECT audit.denied($q$INSERT INTO public.invoices(user_id,invoice_number) VALUES(auth.uid(),'OLD-SHAPE')$q$,'valid old-schema payload still denied by RLS');
ROLLBACK;
SELECT audit.assert_gate('gate unchanged after temporary absent-column case rollback');
SELECT audit.ok((SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM public.invoices i)=(SELECT rows FROM audit.supplement_rows),'final row state is exactly initial state');
\echo SUPPLEMENTAL_VALIDATION_COMPLETE
