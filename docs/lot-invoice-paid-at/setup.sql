\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
CREATE TABLE public.invoices (
 id uuid PRIMARY KEY, user_id uuid NOT NULL, invoice_number text,
 amount numeric NOT NULL DEFAULT 0, status text DEFAULT 'draft',
 created_at timestamptz DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.invoices TO anon, authenticated;
CREATE POLICY "Users see own invoices" ON public.invoices FOR ALL TO PUBLIC
 USING (auth.uid() = user_id);
INSERT INTO public.invoices(id,user_id,invoice_number,amount,status) VALUES
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','A',10,'paid'),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','B',20,'draft');
CREATE TABLE public.before_invoices AS SELECT to_jsonb(i) AS row FROM public.invoices i;
CREATE FUNCTION public.assert_true(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %', label; END IF;
 RAISE NOTICE 'PASS: %', label;
END $$;
