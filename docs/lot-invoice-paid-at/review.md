# Invoice payment compatibility — local review, 2026-10-22

## Scope and decision

Baseline verified: main, `1eb21ecb7ab9e3f23d8f21ba79c56a03de8c00aa`.
First commit `26b944d` contains only the exact already-applied INSERT gate migration.
Gate SHA-256: `4CF51AA8D0E484863637EB3CD09721C49B9A9D834D56DDC1F07F9027DFAA5187`.
No remote commands, migration replay, push or deployment in this LOT. Running
the gate SQL in this LOT is restricted to a new synthetic disposable database.
Historical migrations/proposals and pre-existing untracked files are preserved.

Add only nullable `public.invoices.paid_at timestamptz`, without a default,
backfill, data UPDATE, ownership change, new policy, or change to existing rows.
Exact SQL: `../../supabase/migrations/20261022194733_add_invoice_paid_at_guarded.sql`.
SQL SHA-256: `E367133F35FF5EE0BABFD37A35506C83DF93E45CF4AF25391F2A3EDE5875F375`.
No `IF NOT EXISTS`: even an existing correctly typed paid_at causes an explicit
stop for history/schema review. No automatic migration of historical versions.

## Current client usage audit

- `src/App.jsx`, `handleMarkInvoicePaid`: requires invoice.id, computes an ISO UTC
  instant, writes `{status:'paid', paid_at:paidAt}` to a remote invoice, filtered
  by both id and user_id. Local-only invoices, including signed-in device-local
  drafts, update guest_invoices only; existing local paid_at is retained.
- `refreshInvoices` uses SELECT * with the user_id filter: an additive nullable
  column does not change its query contract. No client invoice INSERT exists in
  the corrected migration/creation paths; creation stays local in InvoiceGenerator
  and the App onSaved callback. Account reset can delete invoice rows separately.
- Invoice payment display uses status, not paid_at. The invoice list exposes
  “Marquer comme payée” only for an unpaid invoice. No invoice payment cancellation
  handler or reverse payment write exists; “Annuler” buttons dismiss other forms.
  No reversal feature or new timestamp-clearing behavior is introduced or claimed
  as tested. NULL remains valid for historical paid rows without a known instant.
- `src/domain/models/invoice.js` accepts paidAt/paid_at, normalizes the timestamp,
  and tolerates absence; payment status has a timestamp fallback when status is
  unknown. It accepts optional isCompliant/is_compliant with null fallback.
- `src/components/InvoiceGenerator.jsx` and `src/utils/facturx.js` generate
  is_compliant for local Factur-X drafts. `isInvoiceCompliant` reads an explicit
  boolean when available and otherwise computes from seller/profile SIRET; this
  feeds compliance/PDF behavior. No current remote invoice writer requires this
  column. The old combined SQL is not a reason to add it: is_compliant is excluded.
- `src/App.jsx` declaration payment display and
  `src/application/adapters/declarationDossierRepository.js` use paid_at on
  declaration_dossiers via confirm_declaration_payment. Those are separate,
  monotonic declaration facts, unchanged by this invoice migration.
- Repository-wide search of paid_at/is_compliant found no other active invoice
  write contract. Historical SQL/model documentation is not evidence of a column
  being deployed. Remote absence was checked in the preceding synchronization;
  this LOT does not claim a fresh remote inventory or HTTP acceptance test.

## Demonstrated runtime defect and minimal fix

The original markPaid predicate OR'ed id, invoice_number and invoiceNumber.
Two absent invoiceNumber values compare equal (`undefined === undefined`), so
paying A also optimistically marked B paid, including persisted local invoices.
The new tests failed in all three modes before the fix (3 failures, 2 passes).
Matching only the already-required invoice.id fixes the issue with a two-line
net reduction; it does not change the remote payload or add a new state model.

Remote acknowledgement behavior is otherwise unchanged: the handler treats an
error-free UPDATE as success and refreshes on returned errors; it does not verify
an affected-row receipt. Tests of simulated services are not HTTP/PostgREST proof.

## Preconditions and verification

The transaction sets lock_timeout=5s, statement_timeout=15s and
idle_in_transaction_session_timeout=20s. ACCESS EXCLUSIVE protects the preflight
and column addition from concurrent schema/policy changes; it can briefly block
other access, and lock contention causes a bounded failure. The preflight checks
an ordinary RLS-enabled table; nonprivileged browser roles unable to inherit the
owner; exact gate name, INSERT command, restrictive mode, exact two roles,
no USING expression, and WITH CHECK false; UUID identities, text status, and no
existing paid_at. This is a targeted contract check, not a full schema fingerprint.

`run-validation.ps1` uses cached PostgreSQL 17 by digest, no network, no host
mounts/ports, tmpfs, synthetic roles and two synthetic invoices. SQL copies are
hash-verified. `results.json` reports success and verified container cleanup.
`postgres-results.txt` records expected ERRORs for negative cases; those are
asserted failures, not an unsuccessful run.

Verified: unchanged existing row values; all historical paid_at NULL (including
paid status); exact nullable timestamptz with no default; is_compliant absent;
owner payment timestamp roundtrip; cross-account SELECT hidden and UPDATE zero
rows; authenticated and anon INSERT rejected with 42501; other account unchanged.
Nine rejected drift cases: gate absent/permissive/wrong roles/extra role/wrong
check/wrong command, disabled RLS, existing column, changed status type.
Each failure preserves rows and its pre-existing column state. Reapplication
also fails explicitly. Timeouts are configured; lock-contention timing was not
separately exercised.

Client validation: 37/37 Node tests pass (new extracted actual payment-handler
tests with simulated service/storage, existing local invoice safety and domain
normalization). Vite production build passes after sandbox spawn EPERM retry;
existing bundle-size warning remains. Only the relevant browser suite is run,
with all external services intercepted; its final result is recorded in
`client-results.txt`. No full unchanged client test run.

## Remaining work

Review this local migration and apply separately under explicit remote authority;
do not replay the gate, run a blanket db push, or repair historical version drift.
After application, verify API schema visibility and the payment flow with the
intended account/ownership context. Publish the corrected client separately,
including this payment-targeting fix. Keep the restrictive INSERT gate active.
Server invoice creation/idempotency and a payment reversal product flow are not
introduced by this LOT. is_compliant remains outside this migration.

Catalog fields were checked against the official PostgreSQL documentation:
https://www.postgresql.org/docs/current/catalog-pg-policy.html . The Supabase
changelog markdown fetch was unavailable (unsupported content type); no new
Supabase API behavior is assumed by this SQL-only compatibility proposal.
