# LOT 5.50 - Next Consumer Migration Gate Review

## 1. Executive Summary

LOT 5.50 is a documentation-only gate review.

No migration was implemented. No application code, test, runtime calculation, Adapter, Facade, Domain, Rules Engine, persistence path, payload, export or assistant path was modified.

Selected next consumer:

```txt
Dashboard monthly reflection - revenue amount in the month summary text
```

Current Legacy expression:

```jsx
currentMonthTotal.toLocaleString("fr-FR")
```

Candidate Shadow-backed expression:

```jsx
monthlyReflectionRevenueTotal.toLocaleString("fr-FR")
```

where the future local alias would be:

```jsx
const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice.revenueTotal;
```

Decision for LOT 5.51:

```txt
GO POUR LOT 5.51 - NEXT CONSUMER MIGRATION IMPLEMENTATION
```

Reason: the consumer is a direct visible read of monthly revenue, uses only the already proven `revenue.total` field through the existing visible slice, needs no new transformation, formatter, fallback, state, persistence, payload, export or assistant change, and has a local rollback.

## 2. Scope and Authority

Authority documents read:

- `docs/LOT_5_18_LEGACY_RETENTION_HARDENING_REPORT.md`
- `docs/LOT_5_41_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md`
- `docs/LOT_5_42_WEEKLY_RECAP_EFFECTIVE_RATE_PARITY_EVIDENCE_REPORT.md`
- `docs/LOT_5_43_WEEKLY_RATE_MISMATCH_INVESTIGATION_REPORT.md`
- `docs/LOT_5_44_WEEKLY_RATE_CONTRACT_HARDENING_REPORT.md`
- `docs/LOT_5_45_WEEKLY_RATE_MIGRATION_GATE_REVIEW.md`
- `docs/LOT_5_46_WEEKLY_RATE_MIGRATION_REPORT.md`
- `docs/LOT_5_48_WEEKLY_RATE_MIGRATION_VALIDATION_REPORT.md`
- `docs/LOT_5_49_WEEKLY_RATE_STABILIZATION_REPORT.md`

Inspected:

- `src/App.jsx`
- `fiscalSummaryVisibleSlice`
- remaining `currentMonthTotal` usages
- remaining `estimatedCharges` usages
- remaining `savingsGoal` usages
- `summary.finalContributionAmount` usages
- `summary.effectiveRate` usages
- `summary.baseAmount` usages
- `acre.status` usages
- remaining dashboard cards and summaries
- coaching
- obligations / smart alerts
- PDF/export
- assistant-adjacent state
- persistence
- payload builders / analytics / feedback
- simulator / revenue preview-adjacent flows
- invoice and reminder-related consumers

## 3. Current Migration State

Already migrated and stabilized:

- URSSAF helper gate;
- progress indicators gate;
- Objectif d'epargne text UI;
- Objectif d'epargne progress bar;
- weekly recap effective rate.

Current guarded baseline:

```txt
fiscalSummaryVisibleSlice = 9
```

No 10th Shadow consumer is currently approved.

Still Legacy by design:

- global `savingsGoal`;
- coaching;
- PDF/export;
- persistence;
- payloads / analytics / feedback;
- assistant-adjacent values;
- broader obligations and smart alert inputs;
- invoice-related consumers.

Legacy remains the compatibility and rollback layer.

## 4. Short Candidate Inventory

| ID | Consumer exact | File / block | Legacy expression | Shadow candidate | Visible | Parity | Transformation | React dependency | Persistence | Payload | Export | Assistant | Rollback | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-50A | Dashboard monthly reflection revenue amount | `src/App.jsx` `dashboardMonthlyReflection` text | `currentMonthTotal.toLocaleString("fr-FR")` | `fiscalSummaryVisibleSlice.revenueTotal.toLocaleString("fr-FR")` via local alias | yes | READY | same formatter | existing `useMemo` dependency swap | no | no | no | no | local read restoration | LOW |
| C-50B | Dashboard monthly reflection charges amount | `src/App.jsx` `dashboardMonthlyReflection` text | `estimatedCharges.toLocaleString("fr-FR")` | `fiscalSummaryVisibleSlice.finalContributionAmount.toLocaleString("fr-FR")` | yes | READY field, needs text-pair check | same formatter | existing `useMemo` dependency swap | no | no | no | no | local read restoration | MEDIUM |
| C-50C | Dashboard monthly reflection full text | `src/App.jsx` `dashboardMonthlyReflection` text | `currentMonthTotal` + `estimatedCharges` + invoice label | revenue and contribution visible slice fields | yes | partial as combined consumer | two fields together | existing `useMemo` | no | no | no | no | local but multi-field | MEDIUM |
| C-50D | Smart alerts revenue/charges inputs | `buildSmartAlerts(...)` call | `currentMonthTotal`, `estimatedCharges` | `revenueTotal`, `finalContributionAmount` | visible alerts | partial | alert behavior | existing `useMemo` | no | no direct | no | no | broad behavior | HIGH |
| C-50E | Simple assistant guidance revenue | `simpleAssistantGuidance` | `currentMonthTotal` | `fiscalSummaryVisibleSlice.revenueTotal` | yes | READY field | guidance behavior | existing `useMemo` | no | no | no | yes | local technically | BLOCKED |
| C-50F | Cockpit estimate real revenue | `cockpitEstimate` | `currentMonthTotal` | `fiscalSummaryVisibleSlice.revenueTotal` | yes | READY field | real/provisional branching | existing `useMemo` | no | indirect display helpers | indirect | assistant-adjacent | local but coupled | HIGH |
| C-50G | Feedback context total revenues | `feedbackContextSnapshot` | `currentMonthTotal || 0` | `fiscalSummaryVisibleSlice.revenueTotal` | no direct UI | READY field | payload contract | existing `useMemo` | no | yes | no | no | local but payload | BLOCKED |
| C-50H | PDF revenue lines | `handleExportPDF` | `currentMonthTotal`, `dashboardChargesDisplay`, `computed?.deadlineLabel` neighbors | visible slice fields partial | exported | partial | export contract | callback deps | no | analytics nearby | yes | no | not local enough | BLOCKED |
| C-50I | Global savingsGoal | `savingsGoal` | `Math.max(estimatedCharges * 3, 500)` | `finalContributionAmount` candidate | yes | evidence exists for isolated UI only | shared dependency | existing `useMemo` | no | no | PDF dependency | coaching dependency | not isolated globally | HIGH |
| C-50J | Coaching low-reserve threshold | `fiscalCoachingCard` | `savingsProgress < savingsGoal * 0.35` | isolated Shadow-backed reserve goal candidate | yes | partial | behavior branch | existing `useMemo` | no | no | no | no | not local enough | HIGH |
| C-50K | Invoice section summary | `invoiceSectionSummary` / invoice cards | `visibleInvoices` | no approved Shadow field | yes | none | invoice behavior | existing `useMemo` | invoice state | analytics nearby | PDF links | no | not a fiscal slice | BLOCKED |

The list is intentionally short and limited to plausible remaining Legacy consumers.

## 5. Exclusions

Excluded from the next implementation lot:

- global `savingsGoal`: still shared with coaching and PDF boundaries;
- coaching: behavior branch, not a direct fiscal value display;
- PDF/export: exported output contract and export analytics nearby;
- feedback context: payload-like analytics/feedback contract;
- assistant guidance: assistant-adjacent behavior;
- cockpit estimate: mixed real/starter estimate behavior with display helper dependencies;
- smart alerts / obligations: broad product behavior and multiple inputs;
- invoice-related consumers: invoice state, persistence and PDF links;
- full monthly reflection text: combines multiple fields and invoice text;
- ACRE status consumers: profile/date semantics and status wording are not isolated enough.

All exclusions follow the automatic exclusion rules because they touch sensitive boundaries, require behavior evidence, combine multiple consumers, use unapproved fields, or have non-local rollback.

## 6. Selected Consumer

Selected consumer:

```txt
C-50A - Dashboard monthly reflection revenue amount
```

File / block:

```txt
src/App.jsx
dashboardMonthlyReflection useMemo
```

Current code:

```jsx
text: `Tu as enregistré ${currentMonthTotal.toLocaleString("fr-FR")} € de revenus, prévu ${estimatedCharges.toLocaleString("fr-FR")} € de charges et créé ${invoiceLabel}.`,
```

Legacy source:

```txt
currentMonthTotal
```

Shadow candidate:

```txt
fiscalSummaryVisibleSlice.revenueTotal
```

Future source should use a local alias to add exactly one approved occurrence and keep the memo dependency clear:

```jsx
const monthlyReflectionRevenueTotal = fiscalSummaryVisibleSlice.revenueTotal;
```

Future expression:

```jsx
monthlyReflectionRevenueTotal.toLocaleString("fr-FR")
```

Future implementation must not change:

- the sentence copy;
- `estimatedCharges`;
- `invoiceLabel`;
- `reminderLabel`;
- `tvaHelper`;
- `invoicesThisMonth`;
- active reminder logic;
- formatter locale;
- display conditions.

## 7. Why This Consumer

C-50A is the safest remaining candidate because:

- it is a direct read of monthly revenue;
- it uses the already available `fiscalSummaryVisibleSlice.revenueTotal` field;
- `revenue.total` is already covered by parity and runtime evidence;
- it keeps the exact existing formatter, `.toLocaleString("fr-FR")`;
- it has no fallback, rate, rounding or formula;
- it does not touch persistence, payloads, exports, assistant, coaching or invoices;
- it is local to one `useMemo`;
- rollback is a one-read restoration.

It is safer than migrating the monthly reflection charges in the same lot because that would add a second field. It is safer than `savingsGoal`, coaching, export, assistant and smart alert consumers because those are retained or broad compatibility boundaries.

## 8. Double Source Visible Review

Visible neighbors in the monthly reflection:

- charges amount from `estimatedCharges`;
- invoice count from `invoicesThisMonth`;
- reminder count from `activeReminderItems.length`;
- TVA helper from `computed?.tvaStatus` and `normalizedTvaStatusLabel`.

The selected migration would change only the revenue amount source. The charges and invoice/reminder text would remain Legacy/local.

Double-source risk:

```txt
LOW
```

Reason:

- `revenue.total` parity is already proven;
- the first dashboard revenue display already uses `fiscalSummaryVisibleSlice.revenueTotal`;
- no new calculation or formatter is introduced;
- the neighboring charge amount is an explicit separate consumer and should not be migrated in the same lot.

## 9. Parity Review

Field parity status for `revenue.total`:

```txt
READY
```

Existing evidence covers:

- Legacy revenue total vs Shadow `revenue.total`;
- runtime evidence compared field `revenue.total`;
- zero revenue;
- positive revenue;
- multiple revenues;
- restored state;
- deterministic same-input and cloned-input behavior;
- strict MATCH/MISMATCH evidence integrity.

Consumer parity status:

```txt
READY
```

Reason: the consumer only formats the monthly revenue total for display. It does not combine the value into a new formula.

## 10. Feature Flag Review

No new flag should be created.

Future implementation can reuse the existing visible slice:

```txt
fiscalSummaryVisibleSlice.revenueTotal
```

Flag ON:

```txt
monthly reflection revenue amount reads Shadow-backed revenue.total through the visible slice
```

Flag OFF or absent Shadow Result:

```txt
monthly reflection revenue amount falls back to currentMonthTotal through the visible slice selector
```

No flag persistence is needed.

## 11. Rollback Review

Rollback is local:

```txt
monthlyReflectionRevenueTotal
-> currentMonthTotal
```

Allowed rollback location:

```txt
src/App.jsx dashboardMonthlyReflection useMemo revenue amount source only
```

Rollback must not require:

- Supabase;
- localStorage;
- data migration;
- Adapter;
- Facade;
- Domain;
- Rules;
- payload;
- export;
- assistant;
- coaching;
- PDF;
- invoice or reminder changes.

## 12. Future LOT 5.51 Implementation Scope

Recommended next lot:

```txt
LOT 5.51 - Next Consumer Migration Implementation
```

Expected future implementation scope:

- create one local alias from `fiscalSummaryVisibleSlice.revenueTotal`;
- replace only the revenue amount read inside `dashboardMonthlyReflection`;
- update the `useMemo` dependency from `currentMonthTotal` to the alias if applicable;
- add targeted tests and report for LOT 5.51;
- preserve baseline change intentionally from `9` to `10`;
- prove no 11th occurrence.

Potential future files:

- `src/App.jsx`
- `tests/lot-5-51-next-consumer-migration.test.js`
- `docs/LOT_5_51_NEXT_CONSUMER_MIGRATION_IMPLEMENTATION_REPORT.md`

## 13. Permanent Guards

Permanent Facade Guard: respected. No Facade change is proposed.

Permanent Migration Guard: respected. LOT 5.50 selects one future consumer only.

Permanent Shadow Rule: respected. No runtime Shadow read is added by this document.

Permanent Deterministic Parity Guard: respected. The selected consumer relies on existing deterministic `revenue.total` evidence.

Permanent Evidence Integrity Guard: respected. No mismatch is hidden or corrected.

Permanent Slice Isolation Guard: respected. Exactly one future candidate is selected; no 10th occurrence is added now.

Legacy Retention Guard: respected. Legacy remains compatibility layer for rollback, coaching, PDF, exports, assistant, persistence, payloads and other retained consumers.

## 14. Confirmations

Confirmed for LOT 5.50:

- exactly one document created;
- no code modified;
- no test modified;
- no consumer migrated;
- no new slice;
- baseline Shadow remains `9`;
- no 10th occurrence added;
- no persistence modified;
- no payload modified;
- no export modified;
- no assistant modified;
- no formula modified;
- no rate modified;
- no rounding modified;
- Legacy remains compatibility layer;
- no new consumer Legacy added.

## 15. Lightweight Validation

Executed lightweight commands only.

```bash
git diff --stat
```

Output:

```txt
playwright.config.js     |  12 +-
src/App.jsx              | 302 +++++++++++++++++++++++++++--------------------
src/utils/obligations.js |   6 -
tests/home.spec.js       |  15 ++-
tests/premium.spec.js    |  11 +-
5 files changed, 201 insertions(+), 145 deletions(-)
```

Note: this stat reflects pre-existing tracked worktree changes. The LOT 5.50 document is untracked, so it is not included in `git diff --stat`.

```bash
git status --short
```

Output:

```txt
Pre-existing dirty worktree remains visible.
New LOT 5.50 file appears under the untracked docs directory.
No tracked code or test file was modified by LOT 5.50.
```

```bash
git diff -- docs/LOT_5_50_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md
```

Output:

```txt
<empty>
```

Reason: the document is a new untracked file; plain `git diff -- <path>` does not display untracked file contents.

```bash
git status --short --untracked-files=all -- docs/LOT_5_50_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md
```

Output:

```txt
?? docs/LOT_5_50_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md
```

No Node tests, build, lint, Playwright or application run is authorized in this lot.

## 16. Risks

Residual risks before implementation:

- future implementation will intentionally add the 10th `fiscalSummaryVisibleSlice` occurrence and must update guards deliberately;
- the neighboring monthly reflection charges remain Legacy and must not be migrated accidentally;
- the future test must prove the sentence copy, formatter, invoice count and reminder helper remain unchanged.

No risk blocks implementation because the selected consumer is READY and LOW risk.

## 17. Decision for LOT 5.51

Selected consumer:

```txt
Dashboard monthly reflection - revenue amount in the month summary text
```

Selected status:

```txt
READY + LOW risk
```

Final decision:

```txt
GO POUR LOT 5.51 - NEXT CONSUMER MIGRATION IMPLEMENTATION
```
