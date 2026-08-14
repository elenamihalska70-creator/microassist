# LOT 5.60 - Next Consumer Migration Gate Review

## 1. Executive Summary

LOT 5.60 is a documentation-only gate review.

No migration was implemented. No application code, tests, runtime calculation, Adapter, Facade, Domain, Rules Engine, persistence path, payload, export or assistant path was modified.

Selected next consumer:

```txt
Smart alerts - estimated charges input for reserve-low alert
```

Current Legacy expression:

```jsx
estimatedCharges
```

Current call site:

```jsx
buildSmartAlerts({
  ...
  estimatedCharges,
  currentMonthTotal,
})
```

Candidate Shadow-backed expression:

```jsx
fiscalSummaryVisibleSlice.finalContributionAmount
```

Decision for LOT 5.61:

```txt
GO POUR LOT 5.61 - NEXT CONSUMER PARITY EVIDENCE
```

Reason: the field mapping is direct and uses an already proven Shadow field, but the consumer drives alert behavior. It must receive dedicated parity evidence before any migration.

## 2. Scope and Authority

Authority documents read:

- `docs/LOT_5_18_LEGACY_RETENTION_HARDENING_REPORT.md`
- `docs/LOT_5_55_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md`
- `docs/LOT_5_56_MONTHLY_REFLECTION_CHARGES_MIGRATION_REPORT.md`
- `docs/LOT_5_57_EXTENDED_STABILIZATION_REPORT.md`
- `docs/LOT_5_58_MONTHLY_REFLECTION_CHARGES_MIGRATION_VALIDATION_REPORT.md`
- `docs/LOT_5_59_MONTHLY_REFLECTION_CHARGES_STABILIZATION_REPORT.md`

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
- dashboard cards and summaries
- `buildSmartAlerts`
- obligations path
- coaching
- PDF/export
- assistant-adjacent state
- persistence and payload-like feedback context
- simulator / cockpit estimate
- invoice-related consumers

## 3. Current Migration State

Already migrated and stabilized:

- URSSAF helper gate;
- progress indicators gate;
- Objectif d'epargne text UI;
- Objectif d'epargne progress bar;
- weekly recap effective rate;
- monthly reflection revenue amount;
- monthly reflection charges amount.

Current guarded baseline:

```txt
fiscalSummaryVisibleSlice = 11
```

No twelfth Shadow consumer is currently approved.

Still Legacy by design:

- remaining `currentMonthTotal` compatibility roles;
- remaining `estimatedCharges` compatibility roles;
- global `savingsGoal`;
- coaching;
- smart alerts / obligations;
- PDF/export;
- persistence;
- payloads / feedback / analytics;
- assistant-adjacent values;
- invoice and reminder-related consumers.

Legacy remains the compatibility and rollback layer.

## 4. Candidate Inventory

| ID | Consumer exact | File / block | Legacy expression | Shadow candidate | Visible | Parity | Transformation | React dependency | Persistence | Payload | Export | Assistant | Rollback | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-60A | Smart alerts charges input for reserve-low alert | `src/App.jsx` `buildSmartAlerts(...)` call | `estimatedCharges` | `fiscalSummaryVisibleSlice.finalContributionAmount` | indirectly visible | NEEDS EVIDENCE | alert branching through `rawAvailable` and `reserve-low` | existing `useMemo` dependency | no | no direct | no | no | local input restoration | MEDIUM |
| C-60B | Smart alerts revenue input for reserve-low alert | `src/App.jsx` `buildSmartAlerts(...)` call | `currentMonthTotal` | `fiscalSummaryVisibleSlice.revenueTotal` | indirectly visible | NEEDS EVIDENCE | combines with charges into `rawAvailable` | existing `useMemo` dependency | no | no direct | no | no | local input restoration | MEDIUM |
| C-60C | Dashboard available display | `src/App.jsx` `dashboardAvailableDisplay` | `availableAmount` | derived from Shadow `baseAmount - finalContributionAmount` | yes | NEEDS EVIDENCE | would require formula or new field | render constants | no | no | export-adjacent display reuse | no | not single read | HIGH |
| C-60D | Cash impact modal adjusted available | `src/App.jsx` cash impact modal | `availableAmount - Math.max(estimatedCharges, computed?.treasuryRecommended)` | partial Shadow candidate | yes | BLOCKED | formula and mixed Legacy recommendation | render | no | no | no | no | not local enough | BLOCKED |
| C-60E | Global savingsGoal | `src/App.jsx` `savingsGoal` | `Math.max(estimatedCharges * 3, 500)` | `fiscalSummaryVisibleSlice.finalContributionAmount` based formula | yes | NEEDS EVIDENCE | shared formula and denominator | existing `useMemo` | no | no | yes | coaching dependency | not isolated | HIGH |
| C-60F | Assistant guidance real revenue | `src/App.jsx` `simpleAssistantGuidance` | `realMonthlyRevenue: currentMonthTotal` | `fiscalSummaryVisibleSlice.revenueTotal` | yes | READY field, consumer not ready | assistant behavior | existing `useMemo` | no | no | no | yes | coupled to assistant | BLOCKED |
| C-60G | Feedback context total revenues | `src/App.jsx` `feedbackContextSnapshot` | `totalRevenues: currentMonthTotal || 0` | `fiscalSummaryVisibleSlice.revenueTotal` | no | READY field, payload not ready | payload contract | existing `useMemo` | no | yes | no | no | local but payload | BLOCKED |
| C-60H | PDF revenue and charges summary | `src/App.jsx` `handleExportPDF` | `currentMonthTotal`, `dashboardChargesDisplay`, `savingsGoal` | visible slice fields partial | exported | NEEDS EVIDENCE | export contract | callback deps | no | analytics nearby | yes | no | not local enough | BLOCKED |
| C-60I | Obligations monthly CA input | `src/App.jsx` `computeObligations` | `ca_month: currentMonthTotal` | `fiscalSummaryVisibleSlice.revenueTotal` or Facade replacement | not direct UI | BLOCKED | changes Legacy obligations engine input | core useMemo | no | indirect | no | no | not local enough | BLOCKED |
| C-60J | Cockpit estimate real revenue base | `src/App.jsx` `cockpitEstimate` | `hasRealRevenue ? currentMonthTotal : ...` | `fiscalSummaryVisibleSlice.revenueTotal` | yes | NEEDS EVIDENCE | mixed starter / real revenue semantics | existing `useMemo` | no | indirect | export-adjacent | assistant-adjacent | local but coupled | HIGH |

## 5. Exclusions

Excluded from direct implementation now:

- global `savingsGoal`: shared with coaching and PDF/export boundaries;
- coaching: behavior branches and user guidance;
- PDF/export: exported contract;
- feedback / analytics: payload-like context;
- assistant guidance: assistant-adjacent behavior;
- obligations: core Legacy engine input and deadline side effects;
- dashboard available amount: requires a derived Shadow formula, not a direct existing field read;
- cockpit estimate: mixes starter low-data estimates with real revenues.

All exclusions follow the automatic exclusion rules because they require new formulas, change behavior, touch payload/export/assistant boundaries, affect multiple consumers or lack a sufficiently local rollback.

## 6. Selected Consumer

Selected consumer:

```txt
C-60A - Smart alerts charges input for reserve-low alert
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
  estimatedCharges,
  currentMonthTotal,
})
```

Legacy source:

```txt
estimatedCharges
```

Shadow candidate:

```txt
fiscalSummaryVisibleSlice.finalContributionAmount
```

## 7. Why This Consumer

C-60A is the safest next candidate to study because:

- it maps to the already proven `summary.finalContributionAmount` field;
- it does not require Adapter, Facade, Domain or Rules changes;
- it has no persistence write;
- it has no payload write;
- it has no export output;
- it has no assistant output;
- it can be rolled back by restoring one call-site input;
- it is narrower than migrating global `savingsGoal`, coaching, PDF/export, assistant, feedback or obligations.

It is not ready for implementation because `buildSmartAlerts` branches on the value:

```jsx
const rawAvailable = Number(currentMonthTotal || 0) - Number(estimatedCharges || 0);
```

and:

```jsx
if (estimatedCharges > 0 && rawAvailable < estimatedCharges) {
  return [{ id: "reserve-low", ... }];
}
```

The next lot should prove alert parity first.

## 8. Double Source Visible Review

Visible outputs affected by C-60A are indirect:

- smart alert card / section;
- `primarySmartAlertId`;
- `fiscalRecommendationCard` branching;
- coaching exclusion via `smartAlertIds`;
- premium trigger context through smart priorities nearby.

Visible neighbors and current sources:

- dashboard charges display already uses `fiscalSummaryVisibleSlice.finalContributionAmount`;
- monthly reflection charges already uses `monthlyReflectionChargesAmount`;
- savings goal remains Legacy;
- coaching remains Legacy;
- PDF/export remains Legacy.

Double-source risk:

```txt
MEDIUM
```

Reason: the amount field parity is strong, but alert behavior can branch differently if a mismatch appears. Evidence must cover `reserve-low`, TVA priority precedence, ACRE precedence, early tracking and all-clear outcomes before migration.

## 9. Parity Review

Field parity status for `summary.finalContributionAmount`:

```txt
READY
```

Existing evidence covers:

- Legacy `estimatedCharges` vs Shadow `summary.finalContributionAmount`;
- dashboard charges display;
- Objectif d'epargne text;
- Objectif d'epargne progress bar;
- monthly reflection charges;
- strict MATCH/MISMATCH behavior;
- runtime evidence integrity.

Consumer parity status for `buildSmartAlerts`:

```txt
NEEDS EVIDENCE
```

Missing evidence:

- reserve-low branch parity;
- TVA branch precedence;
- ACRE branch precedence;
- early-tracking branch parity;
- all-clear branch parity;
- same input / cloned input determinism;
- no mutation of inputs;
- no hidden normalization;
- mismatch stays observable.

## 10. Feature Flag Review

No new flag should be created.

Future implementation, if approved after evidence, should reuse the existing visible slice:

```txt
fiscalSummaryVisibleSlice.finalContributionAmount
```

Flag ON:

```txt
smart alerts charges input reads Shadow-backed summary.finalContributionAmount through the visible slice
```

Flag OFF or absent Shadow Result:

```txt
smart alerts charges input falls back to estimatedCharges through the visible slice selector
```

No flag persistence is needed.

## 11. Rollback Review

Rollback would be local:

```txt
fiscalSummaryVisibleSlice.finalContributionAmount
-> estimatedCharges
```

Allowed rollback location:

```txt
src/App.jsx smartAlerts useMemo buildSmartAlerts(...) call
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

## 12. Future LOT 5.61 Evidence Scope

Recommended next lot:

```txt
LOT 5.61 - Next Consumer Parity Evidence
```

Expected scope:

- create a dedicated evidence test for `buildSmartAlerts` charges input;
- compare Legacy `estimatedCharges` with Shadow `summary.finalContributionAmount`;
- cover alert outcome parity for reserve-low and non-reserve paths;
- cover TVA and ACRE precedence;
- cover deterministic same-input and cloned-input behavior;
- preserve mismatch visibility;
- avoid modifying `src/App.jsx`.

Potential future files:

- `tests/lot-5-61-smart-alerts-charges-parity-evidence.test.js`
- `docs/LOT_5_61_SMART_ALERTS_CHARGES_PARITY_EVIDENCE_REPORT.md`

No implementation file should be changed in the evidence lot.

## 13. Permanent Guards

Permanent Facade Guard: respected. No Facade change is proposed.

Permanent Migration Guard: respected. LOT 5.60 selects one future consumer for evidence only.

Permanent Shadow Rule: respected. No runtime Shadow read is added by this document.

Permanent Deterministic Parity Guard: respected. The next step is evidence before migration.

Permanent Evidence Integrity Guard: respected. No mismatch is hidden or corrected.

Permanent Slice Isolation Guard: respected. No twelfth occurrence is added.

Legacy Retention Guard: respected. Legacy remains compatibility layer for rollback, coaching, PDF, exports, assistant, persistence, payloads and retained consumers.

## 14. Confirmations

Confirmed for LOT 5.60:

- exactly one document created;
- no code modified;
- no test modified;
- no consumer migrated;
- no new slice;
- baseline Shadow remains `11`;
- no twelfth occurrence added;
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

```bash
git status --short
```

```bash
git diff -- docs/LOT_5_60_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md
```

```bash
git status --short --untracked-files=all -- docs/LOT_5_60_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md
```

No Node tests, build, lint, Playwright or application run is authorized in this lot.

## 16. Risks

Residual risks before evidence:

- `buildSmartAlerts` is behavior, not a pure display value;
- alert priority can mask downstream branches;
- `reserve-low` depends on both charges and available amount;
- smart alerts influence coaching exclusions and recommendation context;
- future implementation would intentionally add the twelfth `fiscalSummaryVisibleSlice` occurrence and would require guard stabilization.

No risk requires rollback because this lot is documentation-only.

## 17. Decision for LOT 5.61

Selected consumer:

```txt
Smart alerts - estimated charges input for reserve-low alert
```

Selected status:

```txt
NEEDS EVIDENCE + MEDIUM risk
```

Final decision:

```txt
GO POUR LOT 5.61 - NEXT CONSUMER PARITY EVIDENCE
```
