# LOT 5.41 - Next Consumer Migration Gate Review

## 1. Executive Summary

LOT 5.41 is a documentation-only gate review.

No migration was implemented. No application code, test, runtime calculation, Adapter, Facade, Domain, Rules Engine, persistence path, payload, export or assistant path was modified.

Selected next consumer:

```txt
Dashboard weekly recap - estimated rate source for weekly estimated charges
```

Current Legacy expression:

```jsx
const estimatedRate =
  computed?.rate || getEstimatedRate(dashboardAnswers.activity_type);
```

Candidate Shadow-backed expression:

```jsx
const estimatedRate =
  fiscalSummaryVisibleSlice.effectiveRate || getEstimatedRate(dashboardAnswers.activity_type);
```

Decision for LOT 5.42:

```txt
GO POUR LOT 5.42 — NEXT CONSUMER PARITY EVIDENCE
```

Reason: the consumer is dashboard-visible, local to one memo, not persistence/payload/export/assistant, uses an already available Shadow field, and has a local rollback. It still needs dedicated consumer evidence because the consumer applies the rate to a weekly revenue aggregate inside a date/invoice/reminder recap, not to the already-proven monthly fiscal summary amount directly.

## 2. Scope and Authority

Authority documents read:

- `docs/LOT_5_18_LEGACY_RETENTION_HARDENING_REPORT.md`
- `docs/LOT_5_36_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md`
- `docs/LOT_5_37_OBJECTIF_EPARGNE_PROGRESS_BAR_MIGRATION_REPORT.md`
- `docs/LOT_5_39_OBJECTIF_EPARGNE_PROGRESS_BAR_MIGRATION_VALIDATION_REPORT.md`
- `docs/LOT_5_40_OBJECTIF_EPARGNE_PROGRESS_BAR_STABILIZATION_REPORT.md`

Inspected:

- `src/App.jsx`
- `fiscalSummaryVisibleSlice`
- remaining `currentMonthTotal` usages
- remaining `estimatedCharges` usages
- remaining `savingsGoal` usages
- `summary.finalContributionAmount` evidence/usages
- `summary.effectiveRate` evidence/usages
- `acre.status` evidence/usages
- dashboard cards and summaries
- coaching
- obligations / smart alerts
- PDF/export
- assistant-adjacent state
- persistence
- payloads / analytics / feedback
- simulator / revenue modal preview
- invoice-related consumers

## 3. Current Migration State

Already Shadow-backed through `fiscalSummaryVisibleSlice` when the existing local flag is ON and a Shadow Result exists:

- dashboard revenue display
- dashboard amount-to-set-aside display for real revenue
- URSSAF helper amount and revenue-presence gate
- progress indicators revenue-presence gate
- Objectif d'epargne text percentage
- Objectif d'epargne progress bar fill width

Current guarded baseline:

```txt
fiscalSummaryVisibleSlice = 8
```

No 9th Shadow consumer is currently approved.

Still Legacy by design:

- global `savingsGoal`
- coaching low-reserve threshold
- PDF/export Objectif d'epargne percentage
- persistence
- payloads / analytics / feedback
- assistant-adjacent state
- simulator / revenue modal preview
- invoice-related behavior

Legacy remains a compatibility and rollback layer.

## 4. Short Candidate Inventory

| ID | Consumer exact | File / block | Legacy expression | Shadow candidate | Visible | Parity | Transformation | React dependency | Persistence | Payload | Export | Assistant | Rollback | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-41A | Dashboard weekly recap estimated rate for weekly charges | `src/App.jsx` `dashboardWeeklyRecap` | `computed?.rate || getEstimatedRate(dashboardAnswers.activity_type)` | `fiscalSummaryVisibleSlice.effectiveRate` with existing activity fallback | yes | NEEDS EVIDENCE | existing weekly formula only | existing `useMemo` dependency update in future | no | no | no | no | local source restoration | MEDIUM |
| C-41B | Revenue modal preview charges | `previewCharges` | `getRevenueContributionRate(..., computed?.rate)` | `fiscalSummaryVisibleSlice.effectiveRate` partial | yes | NEEDS EVIDENCE | category-specific rate resolver | existing `useMemo` | no | no | no | no | local but modal-coupled | HIGH |
| C-41C | Revenue modal preview rate label | `previewRateLabel` | `getRevenueContributionRate(..., computed?.rate)` | `fiscalSummaryVisibleSlice.effectiveRate` partial | yes | NEEDS EVIDENCE | category-specific rate resolver + formatter | existing `useMemo` | no | no | no | no | local but modal-coupled | HIGH |
| C-41D | Simple assistant guidance monthly revenue | `simpleAssistantGuidance` | `currentMonthTotal` | `fiscalSummaryVisibleSlice.revenueTotal` | yes | READY for field | assistant guidance behavior | existing `useMemo` | no | no | no | yes | local source restoration | BLOCKED |
| C-41E | Cockpit estimate real base revenue | `cockpitEstimate` | `currentMonthTotal` | `fiscalSummaryVisibleSlice.revenueTotal` | yes | READY for field | mixed starter-vs-real estimate | existing `useMemo` | no | indirect display/export helpers | indirect | assistant-adjacent | local but coupled | HIGH |
| C-41F | Feedback context total revenues | `feedbackContextSnapshot` | `currentMonthTotal || 0` | `fiscalSummaryVisibleSlice.revenueTotal` | no direct UI | READY for field | none | existing `useMemo` | no | yes | no | no | local but payload contract | BLOCKED |
| C-41G | Monthly reflection revenue/charges text | `dashboardMonthlyReflection` | `currentMonthTotal`, `estimatedCharges` | `revenueTotal`, `finalContributionAmount` | yes | partial | text contract + formatter | existing `useMemo` | no | no | no | assistant-adjacent tone | medium | HIGH |
| C-41H | PDF revenue/charges/rate lines | `handleExportPDF` | `currentMonthTotal`, `dashboardChargesDisplay`, `computed?.rate` | available fields partial | exported | partial | export contract | callback deps | export usage | analytics nearby | yes | no | not local enough | BLOCKED |
| C-41I | Coaching low-reserve threshold | `fiscalCoachingCard` | `savingsGoal` | derived from `finalContributionAmount` | yes | partial | behavior threshold | existing `useMemo` | no | no | no | no | not local enough | HIGH |
| C-41J | PDF Objectif d'epargne percentage | `handleExportPDF` | `savingsGoal` | derived from `finalContributionAmount` | exported | partial | export percentage contract | callback deps | export usage | analytics nearby | yes | no | not local enough | BLOCKED |
| C-41K | Smart alerts input charges/revenue | `buildSmartAlerts` call | `estimatedCharges`, `currentMonthTotal` | revenue + final contribution fields | visible alerts | partial | broad alert behavior | existing `useMemo` | no | no | no | no | broad behavior | HIGH |

The list is intentionally short and limited to plausible remaining consumers.

## 5. Exclusions

Excluded from the next implementation lot:

- global `savingsGoal`: shared retained Legacy layer for coaching and PDF.
- coaching low-reserve threshold: behavior branch, not pure display.
- PDF/export consumers: exported output contract and export usage accounting nearby.
- feedback context: payload-like analytics/feedback contract.
- assistant guidance: assistant-adjacent behavior.
- cockpit estimate: mixed real/starter estimate with downstream display helpers.
- monthly reflection: mixed revenue/charge text contract plus current-month invoice/date logic.
- revenue modal preview: category-specific `getRevenueContributionRate` behavior and form preview semantics.
- smart alerts / obligations call sites: broad product behavior and multiple inputs.
- invoice-related consumers: persistence/export/invoice coupling.
- available amount consumers: no approved Shadow `availableAmount` field.

All exclusions follow the automatic exclusion rules because they touch payload/export/assistant boundaries, require behavior evidence, require multiple consumers together, use unapproved fields, or have non-local rollback.

## 6. Selected Consumer

Selected consumer:

```txt
C-41A - Dashboard weekly recap estimated rate source for weekly estimated charges
```

File / block:

```txt
src/App.jsx
dashboardWeeklyRecap useMemo
```

Current code:

```jsx
const estimatedRate =
  computed?.rate || getEstimatedRate(dashboardAnswers.activity_type);
const weeklyEstimatedCharges =
  weeklyRevenueCount > 0 && Number.isFinite(estimatedRate)
    ? Math.round(weeklyRevenueTotal * estimatedRate)
    : null;
```

Legacy source:

```txt
computed?.rate
```

Legacy fallback:

```txt
getEstimatedRate(dashboardAnswers.activity_type)
```

Shadow candidate:

```txt
fiscalSummaryVisibleSlice.effectiveRate
```

Candidate future expression:

```jsx
const estimatedRate =
  fiscalSummaryVisibleSlice.effectiveRate || getEstimatedRate(dashboardAnswers.activity_type);
```

Future implementation must not change:

- `weeklyRevenueEntries`
- `weeklyRevenueCount`
- `weeklyRevenueTotal`
- `Math.round(weeklyRevenueTotal * estimatedRate)`
- invoice count
- reminder count
- labels
- helper text
- weekly date logic
- UI copy

## 7. Why This Consumer

C-41A is the safest remaining non-`savingsGoal` candidate because:

- it is a single local source read inside one `useMemo`;
- it is dashboard-visible but not exported;
- it is not persistence, payload, feedback, analytics, assistant or invoice mutation;
- it uses the already available `fiscalSummaryVisibleSlice.effectiveRate` field;
- `summary.effectiveRate` is part of the existing parity evidence set;
- the existing weekly formula can remain unchanged;
- rollback is a local source restoration;
- it does not require Adapter, Facade, Domain, Rules, Supabase or localStorage changes.

It is safer than the modal preview consumers because those use category-specific rate resolution. It is safer than feedback/export/assistant consumers because those are explicit retained boundaries. It is safer than `savingsGoal` consumers because global `savingsGoal`, coaching and PDF are intentionally retained Legacy responsibilities.

## 8. Parity Review

Field parity status for `summary.effectiveRate`:

```txt
AVAILABLE
```

Evidence already covers:

- `summary.effectiveRate` in runtime evidence compared fields;
- strict MATCH/MISMATCH status handling;
- deterministic same-input and cloned-input behavior;
- ACRE inactive / active / expired scenarios;
- service, commerce and mixed activity coverage in historical evidence reports.

Consumer parity status:

```txt
NEEDS EVIDENCE
```

Reason:

- field parity is available, but this consumer applies the rate to a weekly revenue aggregate;
- the weekly block has date logic via `getTodayIsoDate()`, `parseIsoDate()`, `new Date(today)`, and invoice/reminder context;
- the existing fallback `getEstimatedRate(dashboardAnswers.activity_type)` must be preserved and characterized before any implementation;
- a future evidence lot should prove same weekly input, cloned weekly input, no revenue, one weekly revenue, multiple weekly revenues, different activity types, ACRE inactive/active, and fallback behavior.

No real mismatch is identified in this gate review.

## 9. Isolation Review

C-41A does not touch:

- global `savingsGoal`
- Objectif d'epargne text
- Objectif d'epargne progress bar
- coaching
- PDF/export
- persistence
- payloads
- assistant
- Supabase
- localStorage
- invoice mutation
- Adapter
- Facade
- Domain
- Rules

Visible neighbors in the weekly recap:

- weekly revenue count and amount, sourced from `revenues`;
- weekly invoice count, sourced from `visibleInvoices`;
- reminder count, sourced from `activeReminderItems`;
- next action label, sourced from dashboard recommendation/next step.

Double-source visible risk:

```txt
MEDIUM until evidence is added
```

Reason: the weekly charge amount would be Shadow-rate-backed while adjacent weekly revenue and invoice counts remain existing local UI aggregates. This is acceptable only if a future evidence lot confirms no visible inconsistency.

## 10. Feature Flag Review

No new flag should be created.

Future implementation can reuse the existing source path:

```txt
fiscalSummaryVisibleSlice.effectiveRate
```

That visible slice already applies:

```txt
FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED
```

Flag ON:

```txt
weekly rate source would be Shadow-backed through fiscalSummaryVisibleSlice.effectiveRate
```

Flag OFF or absent Shadow Result:

```txt
weekly rate source would fall back to computed?.rate through fiscalSummaryVisibleSlice.effectiveRate
```

No flag persistence is needed.

## 11. Rollback Review

Rollback is local:

```txt
fiscalSummaryVisibleSlice.effectiveRate
-> computed?.rate
```

Allowed rollback location:

```txt
src/App.jsx dashboardWeeklyRecap useMemo estimatedRate source only
```

Rollback must not require:

- Supabase
- localStorage
- data migration
- Adapter
- Facade
- Domain
- Rules
- payload
- export
- assistant
- coaching
- PDF
- global `savingsGoal`

## 12. Future LOT 5.42 Evidence Scope

Recommended next lot:

```txt
LOT 5.42 - Next Consumer Parity Evidence
```

Create evidence only; do not migrate yet.

Evidence should cover C-41A:

- exact current Legacy expression;
- exact candidate Shadow expression;
- no revenue this week;
- one weekly revenue;
- multiple weekly revenues;
- revenues outside the week ignored;
- service activity;
- commerce activity;
- ACRE inactive;
- ACRE active if supported by fixture;
- same input twice;
- cloned input;
- fallback to `getEstimatedRate` when rate is unavailable;
- no persistence, payload, export or assistant propagation;
- rollback remains local.

Potential future files after evidence approval:

- `tests/lot-5-42-next-consumer-parity-evidence.test.js`
- `docs/LOT_5_42_NEXT_CONSUMER_PARITY_EVIDENCE_REPORT.md`

No runtime file should be modified in the evidence lot.

## 13. Permanent Guards

Permanent Facade Guard: respected. No Facade change is proposed.

Permanent Migration Guard: respected. LOT 5.41 selects one future consumer only.

Permanent Shadow Rule: respected. No runtime Shadow read is added by this document.

Permanent Deterministic Parity Guard: respected. The selected next step is evidence before implementation.

Permanent Evidence Integrity Guard: respected. No mismatch is hidden or corrected.

Permanent Slice Isolation Guard: respected. Exactly one future candidate is selected; no 9th occurrence is added now.

Legacy Retention Guard: respected. Legacy remains compatibility layer for rollback, coaching, PDF, exports, assistant, persistence, payloads and other retained consumers.

## 14. Confirmations

Confirmed for LOT 5.41:

- exactly one document created;
- no code modified;
- no test modified;
- no consumer migrated;
- no new slice;
- baseline Shadow remains `8`;
- no 9th occurrence added;
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

Executed lightweight commands:

```bash
git diff --stat
```

Output:

```text
 playwright.config.js     |  12 +-
 src/App.jsx              | 292 ++++++++++++++++++++++++++---------------------
 src/utils/obligations.js |   6 -
 tests/home.spec.js       |  15 ++-
 tests/premium.spec.js    |  11 +-
 5 files changed, 194 insertions(+), 142 deletions(-)
```

Note: this stat reflects pre-existing tracked worktree changes. The LOT 5.41 document is untracked, so it is not included in `git diff --stat`.

```bash
git status --short
```

Output includes the pre-existing dirty worktree plus the untracked `docs/` directory. No tracked code or test file was modified by LOT 5.41.

```bash
git diff -- docs/LOT_5_41_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md
```

Output:

```text
<empty>
```

Reason: the document is a new untracked file; plain `git diff -- <path>` does not display untracked file contents.

```bash
git status --short --untracked-files=all -- docs/LOT_5_41_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md
```

Output:

```text
?? docs/LOT_5_41_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md
```

No Node tests, build, lint, Playwright or application run is authorized in this lot.

## 16. Risks

Risks before implementation:

- C-41A uses proven field parity, but not yet consumer-specific weekly evidence.
- The block contains date logic and invoice/reminder neighbors.
- The fallback behavior must be preserved exactly before migration.
- Future implementation would intentionally create the 9th `fiscalSummaryVisibleSlice` occurrence and must update guards only in that implementation/stabilization path.

No risk requires rollback because LOT 5.41 made no runtime change.

## 17. Decision for LOT 5.42

Selected consumer:

```txt
Dashboard weekly recap - estimated rate source for weekly estimated charges
```

Selected status:

```txt
consumer plausible and isolated, but consumer-specific evidence insufficient
```

Final decision:

```txt
GO POUR LOT 5.42 — NEXT CONSUMER PARITY EVIDENCE
```
