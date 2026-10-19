-- LOT 10.3B.6D.2: preparation only; not queued for automatic migration.
-- Do not run on Production or any linked remote database in this LOT.
-- Activation requires the fail-closed gate in activation-checklist.md.
-- Deliberately fail on pre-existing columns instead of masking schema drift.
ALTER TABLE public.invoices
  ADD COLUMN is_compliant boolean NULL,
  ADD COLUMN paid_at timestamptz NULL;
