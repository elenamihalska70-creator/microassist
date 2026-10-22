\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
CREATE TABLE public.invoices (
 id uuid PRIMARY KEY, user_id uuid NULL, invoice_number text,
 amount numeric NOT NULL DEFAULT 0, status text DEFAULT 'draft',
 created_at timestamptz DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.invoices TO anon, authenticated;
CREATE POLICY "Users see own invoices" ON public.invoices FOR ALL TO PUBLIC
 USING (auth.uid() = user_id);
-- Synthetic fixture only: model the already-present gate without replaying its migration.
CREATE POLICY lot_10_3b_6d_4_deny_browser_invoice_insert ON public.invoices
 AS RESTRICTIVE FOR INSERT TO anon, authenticated WITH CHECK (false);
INSERT INTO public.invoices(id,user_id,invoice_number,amount,status) VALUES
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','A',10,'paid'),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','B',20,'draft');
CREATE TABLE public.before_invoices AS SELECT to_jsonb(i) AS row FROM public.invoices i;
CREATE FUNCTION public.assert_true(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
 RAISE NOTICE 'PASS: %', label;
END $$;
SELECT assert_true((SELECT atttypid = 'uuid'::regtype AND NOT attnotnull
 FROM pg_attribute WHERE attrelid='invoices'::regclass AND attname='user_id'
 AND NOT attisdropped), 'user_id is nullable uuid before migration');
