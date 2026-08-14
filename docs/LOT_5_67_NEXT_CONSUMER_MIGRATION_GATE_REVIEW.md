# LOT 5.67 - NEXT CONSUMER MIGRATION GATE REVIEW

## 1. Executive Summary

LOT 5.67 is a documentation-only gate review.

No migration was implemented. No application code, tests, runtime calculation, Adapter, Facade, Domain, Rules Engine, persistence path, payload, export, assistant, coaching, invoice or reminder behavior was modified.

Selected next consumer:

```txt
Smart alerts - currentMonthTotal revenue input for reserve-low rawAvailable
```

Current Legacy expression:

```jsx
currentMonthTotal
```

Current call site:

```jsx
buildSmartAlerts({
  answers: dashboardAnswers,
  computed,
  revenues,
  invoices: visibleInvoices,
  reminderPrefs,
  estimatedCharges: smartAlertEstimatedCharges,
  currentMonthTotal,
})
```

Candidate Shadow-backed expression:

```jsx
fiscalSummaryVisibleSlice.revenueTotal
```

Decision for LOT 5.68:

```txt
GO POUR LOT 5.68 - SMART ALERT PARITY EVIDENCE
```

Reason: the candidate is local and direct, but it controls reserve-low behavior through `rawAvailable`. It must receive dedicated smart-alert parity evidence before implementation.

## 2. Scope and Authority

Authority documents read:

- `docs/LOT_5_18_LEGACY_RETENTION_HARDENING_REPORT.md`
- `docs/LOT_5_60_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md`
- `docs/LOT_5_61_SMART_ALERT_RESERVE_LOW_PARITY_EVIDENCE_REPORT.md`
- `docs/LOT_5_62_SMART_ALERT_RESERVE_LOW_MIGRATION_GATE_REVIEW.md`
- `docs/LOT_5_63_SMART_ALERT_RESERVE_LOW_MIGRATION_REPORT.md`
- `docs/LOT_5_64_EXTENDED_STABILIZATION_REPORT.md`
- `docs/LOT_5_65_SMART_ALERT_RESERVE_LOW_MIGRATION_VALIDATION_REPORT.md`
- `docs/LOT_5_66_SMART_ALERT_RESERVE_LOW_STABILIZATION_REPORT.md`

Inspected:

- `src/App.jsx`
- `fiscalSummaryVisibleSlice`
- remaining `currentMonthTotal` usages
- remaining `estimatedCharges` usages
- remaining `savingsGoal` usages
- `summary.baseAmount`
- `summary.finalContributionAmount`
- `summary.effectiveRate`
- ACRE status usage
- `buildSmartAlerts`
- remaining smart alerts
- dashboard displays and summaries
- coaching
- obligations
- PDF/export
- assistant-adjacent state
- persistence and payload-like feedback context
- simulator / cockpit estimate
- invoice and reminder-related consumers

## 3. Current Migration State

Already migrated and stabilized:

- URSSAF helper gate
- progress indicators gate
- Objectif d'epargne text UI
- Objectif d'epargne progress bar
- weekly recap effective rate
- monthly reflection revenue amount
- monthly reflection charges amount
- smart alert reserve-low charges input

Current guarded baseline:

```txt
fiscalSummaryVisibleSlice = 12
```

No thirteenth Shadow consumer is currently approved.

Legacy remains the compatibility layer for:

- retained `currentMonthTotal` consumers
- retained `estimatedCharges` consumers
- global `savingsGoal`
- coaching
- PDF/export
- assistant-adjacent values
- persistence and payloads
- obligations
- invoices and reminders

## 4. Candidate Inventory

| ID | Consumer exact | File / block | Legacy expression | Shadow candidate | Visible | Parity | Transformation | React dependency | Persistence | Payload | Export | Assistant | Rollback | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-67A | Smart alerts revenue input for reserve-low `rawAvailable` | `src/App.jsx` `smartAlerts` `useMemo` / `buildSmartAlerts(...)` call | `currentMonthTotal` | `fiscalSummaryVisibleSlice.revenueTotal` | indirectly visible | NEEDS EVIDENCE | no new formula, but behavior branches through `rawAvailable` | existing `smartAlerts` dependency | no | no direct | no | no | local input restoration | MEDIUM |
| C-67B | Dashboard available display | `src/App.jsx` `dashboardAvailableDisplay` | `availableAmount` | derived from Shadow `baseAmount - finalContributionAmount` | yes | NEEDS EVIDENCE | new derived formula required | render constant | no | no | export-adjacent display reuse | no | not direct | HIGH |
| C-67C | Global `savingsGoal` | `src/App.jsx` `savingsGoal` | `Math.max(estimatedCharges * 3, 500)` | `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` | yes | NEEDS EVIDENCE | formula migration and shared denominator | existing `useMemo` | no | no | yes | coaching dependency | not isolated | HIGH |
| C-67D | Smart priorities recommended reserve | `src/App.jsx` `buildSmartPriorities(...)` call | `availableAmount` | Shadow available derivation | visible priority context | NEEDS EVIDENCE | derived available amount required | existing `useMemo` | no | indirect | no | no | not direct | HIGH |
| C-67E | Assistant guidance real revenue | `src/App.jsx` `simpleAssistantGuidance` | `realMonthlyRevenue: currentMonthTotal` | `fiscalSummaryVisibleSlice.revenueTotal` | yes | field READY, consumer not ready | assistant behavior | existing `useMemo` | no | no | no | yes | local expression, coupled to assistant | BLOCKED |
| C-67F | Feedback context total revenues | `src/App.jsx` `feedbackContextSnapshot` | `totalRevenues: currentMonthTotal || 0` | `fiscalSummaryVisibleSlice.revenueTotal` | no | field READY, payload not ready | payload contract | existing `useMemo` | no | yes | no | no | local expression, payload coupled | BLOCKED |
| C-67G | PDF revenue summary | `src/App.jsx` `handleExportPDF` | `getDisplayValue(currentMonthTotal, "money")` | `fiscalSummaryVisibleSlice.revenueTotal` or display value | exported | NEEDS EVIDENCE | export contract | callback dependency | no | analytics nearby | yes | no | not local enough | BLOCKED |
| C-67H | Obligations monthly CA input | `src/App.jsx` `computed` / `computeObligations(...)` | `ca_month: currentMonthTotal` | `fiscalSummaryVisibleSlice.revenueTotal` or Facade replacement | indirect | BLOCKED | changes Legacy obligations engine input | core `useMemo` | no | indirect | no | no | not local enough | BLOCKED |
| C-67I | Cockpit estimate real revenue base | `src/App.jsx` `cockpitEstimate` | `hasRealRevenue ? currentMonthTotal : starterRevenue` | `fiscalSummaryVisibleSlice.revenueTotal` | yes | NEEDS EVIDENCE | mixed real/provisional behavior | existing `useMemo` | no | indirect | export-adjacent | assistant-adjacent | ambiguous | HIGH |

## 5. Exclusions

Excluded from implementation readiness:

- `dashboardAvailableDisplay`: requires deriving a new Shadow available amount formula.
- global `savingsGoal`: shared with coaching and PDF/export.
- smart priorities recommended reserve: depends on `availableAmount`, not a direct proven Shadow field.
- assistant guidance: assistant-adjacent behavior requires a dedicated gate.
- feedback context: payload-like contract requires a dedicated gate.
- PDF/export: exported values require export parity.
- obligations: core Legacy engine input and deadline side effects require an obligations gate.
- cockpit estimate: mixes real revenue with starter/provisional estimates.

All exclusions follow the automatic exclusion rules because they require a new formula, affect payload/export/assistant boundaries, touch multiple consumers, or lack a sufficiently local rollback.

## 6. Smart Alerts Review

Current `buildSmartAlerts` inputs:

```jsx
answers = {}
computed = {}
revenues = []
invoices = []
reminderPrefs = {}
estimatedCharges = 0
currentMonthTotal = 0
```

Reserve-low logic:

```jsx
const rawAvailable = Number(currentMonthTotal || 0) - Number(estimatedCharges || 0);
```

```jsx
if (estimatedCharges > 0 && rawAvailable < estimatedCharges) {
```

Current migrated charges input:

```jsx
estimatedCharges: smartAlertEstimatedCharges
```

Remaining candidate revenue input:

```jsx
currentMonthTotal
```

Candidate replacement:

```jsx
currentMonthTotal: fiscalSummaryVisibleSlice.revenueTotal
```

Other smart alert branches:

- TVA threshold uses `computed?.tvaStatus`.
- ACRE ending uses `answers?.acre` and `answers?.acre_start_date`.
- early tracking uses `revenues.length`.
- all clear has no fiscal source input.

These other branches are not selected for implementation.

## 7. Selected Consumer

Selected consumer:

```txt
C-67A - Smart alerts currentMonthTotal revenue input for reserve-low rawAvailable
```

File / block:

```txt
src/App.jsx
smartAlerts useMemo
buildSmartAlerts(...) call
```

Current code:

```jsx
buildSmartAlerts({
  answers: dashboardAnswers,
  computed,
  revenues,
  invoices: visibleInvoices,
  reminderPrefs,
  estimatedCharges: smartAlertEstimatedCharges,
  currentMonthTotal,
})
```

Legacy source:

```txt
currentMonthTotal
```

Shadow candidate:

```txt
fiscalSummaryVisibleSlice.revenueTotal
```

## 8. Why This Consumer

C-67A is the safest plausible next candidate because:

- it is local to the same `smartAlerts` call already isolated by LOT 5.63 through LOT 5.66;
- the Shadow field `revenue.total` is already available through `fiscalSummaryVisibleSlice.revenueTotal`;
- it does not require Adapter, Facade, Domain or Rules changes;
- it does not write persistence;
- it does not construct a payload;
- it does not export data;
- it does not touch assistant output;
- it does not create a new visible component;
- rollback is local to one call-site input and one dependency entry.

It is not selected for direct implementation because it drives behavior:

```txt
rawAvailable = currentMonthTotal - estimatedCharges
```

A mismatch near the reserve-low threshold could change alert ON/OFF behavior. Dedicated smart-alert parity evidence is required first.

## 9. Double Source Visible Review

Visible outputs affected by C-67A are indirect:

- smart alert card / section;
- `primarySmartAlertId`;
- fiscal recommendation text;
- coaching exclusion via `smartAlertIds`;
- premium trigger context nearby.

Visible neighbors and current sources:

- dashboard revenue display already uses `fiscalSummaryVisibleSlice.revenueTotal`;
- dashboard charges display already uses `fiscalSummaryVisibleSlice.finalContributionAmount` when not provisional;
- dashboard available display remains Legacy / cockpit based;
- global `savingsGoal` remains Legacy;
- coaching remains Legacy;
- PDF/export remains Legacy.

Double-source risk:

```txt
MEDIUM
```

Reason: the field mapping is direct, but the alert output is behavioral and priority-masked by TVA and ACRE-ending branches.

## 10. Parity Review

Field parity for `revenue.total`:

```txt
READY
```

Existing evidence already covers:

- `currentMonthTotal` vs Shadow `revenue.total`;
- visible dashboard revenue;
- URSSAF helper gate;
- progress indicators gate;
- monthly reflection revenue;
- strict MATCH/MISMATCH behavior;
- runtime evidence integrity.

Consumer parity for `buildSmartAlerts` revenue input:

```txt
NEEDS EVIDENCE
```

Missing evidence:

- reserve-low `rawAvailable` parity using Shadow revenue;
- threshold below / exact / above with migrated revenue input;
- TVA priority masking;
- ACRE priority masking;
- early-tracking and all-clear branch parity;
- same input and cloned input determinism;
- no mutation;
- mismatch visibility near the boundary.

## 11. Feature Flag Review

No new flag should be created.

Future evidence should validate existing selector behavior:

```jsx
revenueTotal: usesShadow
  ? shadowResult.revenue.total
  : currentMonthTotal
```

Flag ON:

```txt
smart alert revenue input would read Shadow-backed revenue.total through the visible slice
```

Flag OFF or missing Shadow Result:

```txt
smart alert revenue input would fall back to Legacy currentMonthTotal through the visible slice
```

No flag persistence is needed.

## 12. Rollback Review

Future rollback would be local:

```txt
fiscalSummaryVisibleSlice.revenueTotal
-> currentMonthTotal
```

Allowed rollback location:

```txt
src/App.jsx smartAlerts useMemo buildSmartAlerts(...) call
```

If the dependency list is changed in a future implementation lot, rollback must restore:

```txt
fiscalSummaryVisibleSlice.revenueTotal
-> currentMonthTotal
```

Rollback must not require:

- data migration;
- Supabase;
- localStorage;
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

## 13. Expected Future Evidence Scope

Recommended LOT 5.68 scope:

```txt
SMART ALERT PARITY EVIDENCE
```

Expected evidence should cover:

- Legacy `currentMonthTotal` vs Shadow `fiscalSummaryVisibleSlice.revenueTotal`;
- reserve-low ON/OFF parity;
- threshold below / exact / above;
- TVA branch priority;
- ACRE branch priority;
- early-tracking branch;
- all-clear branch;
- revenue zero, positive and multiple revenues;
- same input and cloned input determinism;
- mutation safety;
- no hidden normalization, tolerance or fallback;
- intentional mismatch visibility.

No runtime file should be modified in that evidence lot.

## 14. Permanent Guards

Permanent Facade Guard: respected. No Facade change is proposed.

Permanent Migration Guard: respected. This lot selects one future consumer for evidence only.

Permanent Shadow Rule: respected. No new runtime Shadow read is added.

Permanent Deterministic Parity Guard: respected. Evidence is required before any migration.

Permanent Evidence Integrity Guard: respected. Future mismatch must remain visible.

Permanent Slice Isolation Guard: respected. Baseline remains `12`; no thirteenth occurrence is added.

Legacy Retention Guard: respected. Legacy remains the compatibility layer for rollback and retained consumers.

## 15. Confirmations

Confirmed for LOT 5.67:

- exactly one document created;
- no code modified;
- no test modified;
- no consumer migrated;
- no new slice;
- baseline Shadow remains `12`;
- no thirteenth occurrence added;
- no persistence modified;
- no payload modified;
- no export modified;
- no assistant modified;
- no formula modified;
- no rate modified;
- no rounding modified;
- Legacy remains compatibility layer;
- no new consumer Legacy added.

## 16. Lightweight Validation

Executed lightweight validation only:

```txt
git diff --stat
```

```txt
git status --short
```

```txt
git diff -- docs/LOT_5_67_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md
```

```txt
git status --short --untracked-files=all -- docs/LOT_5_67_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md
```

Not run by scope:

- `node --test`
- `npm run build`
- `npm run lint`
- Playwright
- application

## 17. Risks

Residual risks before evidence:

- reserve-low is behavioral, not display-only;
- `rawAvailable` depends on both revenue and charges;
- TVA and ACRE-ending branches can mask reserve-low;
- a real mismatch near threshold can flip alert ON/OFF;
- future implementation would add the thirteenth `fiscalSummaryVisibleSlice` occurrence and require guard stabilization.

No risk requires rollback because this lot is documentation-only.

## 18. Decision for LOT 5.68

Selected consumer:

```txt
Smart alerts - currentMonthTotal revenue input for reserve-low rawAvailable
```

Selected status:

```txt
NEEDS EVIDENCE + MEDIUM risk
```

Final decision:

```txt
GO POUR LOT 5.68 - SMART ALERT PARITY EVIDENCE
```
