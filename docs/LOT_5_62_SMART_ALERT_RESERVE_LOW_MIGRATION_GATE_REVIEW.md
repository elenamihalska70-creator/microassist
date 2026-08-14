# LOT 5.62 - Smart Alert Reserve-Low Migration Gate Review

## 1. Executive Summary

LOT 5.62 is a documentation-only migration gate review.

No migration was implemented. `src/App.jsx` was not modified. No runtime code, smart alert condition, threshold, severity, priority, message, persistence path, payload, export, assistant, coaching, invoice or reminder behavior was changed.

Reviewed consumer:

```txt
Smart alerts - estimated charges input for reserve-low alert
```

Gate decision:

```txt
READY
```

Recommended next lot:

```txt
GO POUR LOT 5.63 - SMART ALERT RESERVE-LOW MIGRATION IMPLEMENTATION
```

## 2. Source and Authority

Authority documents read:

- `docs/LOT_5_60_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md`
- `docs/LOT_5_61_SMART_ALERT_RESERVE_LOW_PARITY_EVIDENCE_REPORT.md`
- `docs/LOT_5_59_MONTHLY_REFLECTION_CHARGES_STABILIZATION_REPORT.md`

Inspected:

- `src/App.jsx`
- `buildSmartAlerts`
- `smartAlerts` `useMemo`
- `estimatedCharges`
- `availableAmount`
- `fiscalSummaryVisibleSlice.finalContributionAmount`
- visible-slice feature flag selector
- reserve-low condition, threshold, severity and message
- persistence, payload, assistant, export and coaching boundaries

## 3. Consumer Exact

File:

```txt
src/App.jsx
```

Runtime function:

```jsx
function buildSmartAlerts({
  answers = {},
  computed = {},
  revenues = [],
  invoices = [],
  reminderPrefs = {},
  estimatedCharges = 0,
  currentMonthTotal = 0,
} = {}) {
```

Call site:

```jsx
const smartAlerts = useMemo(
  () =>
    buildSmartAlerts({
      answers: dashboardAnswers,
      computed,
      revenues,
      invoices: visibleInvoices,
      reminderPrefs,
      estimatedCharges,
      currentMonthTotal,
    }),
  [
    dashboardAnswers,
    computed,
    revenues,
    visibleInvoices,
    reminderPrefs,
    estimatedCharges,
    currentMonthTotal,
  ],
);
```

Consumer variable:

```txt
estimatedCharges
```

Authorized future source-only replacement:

```txt
estimatedCharges
->
fiscalSummaryVisibleSlice.finalContributionAmount
```

Only the input value is eligible. The alert formula, condition, message and neighbors are not eligible in this migration.

## 4. Alert Contract

Current reserve-low setup:

```jsx
const rawAvailable = Number(currentMonthTotal || 0) - Number(estimatedCharges || 0);
```

```jsx
if (estimatedCharges > 0 && rawAvailable < estimatedCharges) {
  return [
    {
      id: "reserve-low",
      level: "warning",
      title: "Réserve à renforcer",
      text: "La réserve actuelle couvre moins d’un cycle de charges estimées.",
      cta: "Ajouter une dépense",
      action: "profile",
    },
  ];
}
```

Threshold:

```txt
estimatedCharges > 0 && rawAvailable < estimatedCharges
```

Equivalent boundary:

```txt
currentMonthTotal < 2 * estimatedCharges
```

Severity:

```txt
warning
```

Priority:

- TVA `tva-threshold` returns before reserve-low;
- ACRE `acre-ending` returns before reserve-low;
- reserve-low returns before `early-tracking`.

Immediate dependencies:

- `dashboardAnswers`;
- `computed`;
- `revenues`;
- `visibleInvoices`;
- `reminderPrefs`;
- `estimatedCharges`;
- `currentMonthTotal`.

Only `estimatedCharges` is in scope for future replacement.

## 5. Parity Review

LOT 5.61 evidence confirmed:

- revenue = 0 MATCH;
- positive revenue MATCH;
- multiple revenues MATCH;
- service MATCH;
- commerce MATCH;
- mixte MATCH;
- ACRE inactive MATCH;
- ACRE active MATCH;
- contribution amount = 0 MATCH;
- decimal amount MATCH;
- low contribution MATCH;
- high contribution MATCH;
- revenue added MATCH;
- revenue removed MATCH;
- last revenue removed MATCH;
- same input determinism;
- cloned input determinism;
- no mutation;
- no implicit time;
- no persistence;
- no smart alert migration;
- no new Shadow consumer;
- parity/runtime guards intact.

Intentional mismatch evidence:

```txt
Legacy input = 100
Shadow candidate = 101
Status = MISMATCH
```

The mismatch remains visible and can change ON/OFF near the boundary. This is evidence integrity, not a real covered-scenario mismatch.

Classification:

```txt
READY
```

Reason: all real supported scenarios covered by LOT 5.61 match strictly, and no formula, fallback, tolerance or behavior change is needed for the selected input.

## 6. Alert Boundary Safety

LOT 5.61 boundary evidence:

| currentMonthTotal | charges input | Result |
| ---: | ---: | --- |
| 199 | 100 | ALERT_ON |
| 200 | 100 | ALERT_OFF |
| 201 | 100 | ALERT_OFF |

For MATCH scenarios, replacing only the charges source does not change reserve-low ON/OFF behavior.

Boundary safety result:

```txt
PASS
```

Important retained risk: any future real mismatch could change ON/OFF near the threshold. The implementation lot must not mask mismatches or add tolerance.

## 7. Formula Isolation

Future migration must not change:

- threshold;
- comparison;
- ratio;
- `Math.round`;
- `Math.max`;
- `Math.min`;
- percentage;
- `availableAmount`;
- revenue source;
- severity;
- priority;
- title;
- message;
- CTA;
- action.

The approved future migration is source-only:

```jsx
estimatedCharges,
```

to:

```jsx
estimatedCharges: fiscalSummaryVisibleSlice.finalContributionAmount,
```

No other expression is approved.

## 8. Feature Flag

The future migration can reuse the existing visible-slice selector:

```jsx
finalContributionAmount: usesShadow
  ? shadowResult.summary.finalContributionAmount
  : estimatedCharges
```

Flag ON:

```txt
fiscalSummaryVisibleSlice.finalContributionAmount reads Shadow summary.finalContributionAmount
```

Flag OFF or missing Shadow Result:

```txt
fiscalSummaryVisibleSlice.finalContributionAmount falls back to Legacy estimatedCharges
```

No new feature flag is needed.

No feature flag persistence is needed.

## 9. Shadow Baseline

Current guarded baseline:

```txt
fiscalSummaryVisibleSlice = 11
```

Future expected baseline after implementation:

```txt
fiscalSummaryVisibleSlice = 12
```

The future twelfth occurrence must be only:

```txt
src/App.jsx smartAlerts useMemo buildSmartAlerts(...) call
```

No thirteenth occurrence is approved.

LOT 5.62 adds no occurrence because it is documentation-only.

## 10. Legacy Retention

`estimatedCharges` must remain Legacy in other approved roles, including:

- `estimatedCharges` `useMemo`;
- `availableAmount`;
- `savingsGoal`;
- coaching boundary;
- PDF/export;
- assistant-adjacent values;
- payload / feedback contexts;
- other smart alert or dashboard consumers not explicitly approved.

The reserve-low migration must not authorize migration of:

- coaching;
- PDF/export;
- savings goal;
- other alerts;
- assistant;
- other dashboard values;
- obligations;
- invoices;
- reminders.

Legacy remains the compatibility and rollback layer.

## 11. No Propagation

The selected consumer does not require:

- Supabase write;
- localStorage write;
- payload construction;
- assistant output;
- export output;
- PDF output;
- invoice state mutation;
- reminder state mutation.

The smart-alert call site includes `visibleInvoices` and `reminderPrefs`, but the approved future change does not alter those arguments or their state.

No dependency requires blocking the migration gate.

## 12. React / State Review

The future source-only migration must not require:

- new `useState`;
- new `useEffect`;
- new `useMemo`;
- new Context;
- new event handler;
- second Adapter execution;
- second Facade execution;
- new data model;
- new local fallback.

Expected dependency update:

```txt
replace `estimatedCharges` with `fiscalSummaryVisibleSlice.finalContributionAmount` in the smartAlerts useMemo dependency list only if required by React hook correctness.
```

No additional React structure is approved.

## 13. Rollback

Future rollback must be local:

```txt
fiscalSummaryVisibleSlice.finalContributionAmount
->
estimatedCharges
```

Allowed rollback location:

```txt
src/App.jsx smartAlerts useMemo buildSmartAlerts(...) call
```

If the dependency list is updated in the implementation lot, rollback must restore the corresponding dependency from:

```txt
fiscalSummaryVisibleSlice.finalContributionAmount
```

to:

```txt
estimatedCharges
```

Rollback must not require:

- data migration;
- Supabase change;
- localStorage change;
- alert formula change;
- threshold change;
- message change;
- Adapter change;
- Facade change;
- Domain change;
- Rules change;
- coaching change;
- PDF/export change;
- assistant change;
- payload change.

## 14. LOT 5.63 Implementation Envelope

If LOT 5.63 proceeds, authorized file:

```txt
src/App.jsx
```

Authorized block:

```txt
smartAlerts useMemo buildSmartAlerts(...) call
```

Authorized expression replacement:

```jsx
estimatedCharges,
```

to:

```jsx
estimatedCharges: fiscalSummaryVisibleSlice.finalContributionAmount,
```

Authorized dependency adjustment:

```txt
estimatedCharges
->
fiscalSummaryVisibleSlice.finalContributionAmount
```

Expected Shadow baseline:

```txt
11 -> 12
```

Expected rollback:

```txt
restore `estimatedCharges` in the reserve-low smart-alert input only
```

Suggested targeted tests for LOT 5.63:

- LOT 5.61 smart alert reserve-low parity evidence;
- LOT 5.59 monthly reflection charges stabilization;
- LOT 5.58 monthly reflection charges migration validation;
- shadow parity validation;
- runtime parity evidence;
- new LOT 5.63 migration implementation test;
- targeted ESLint on new/changed test only.

Stop conditions for LOT 5.63:

- alert threshold must change;
- ON/OFF logic must change;
- severity/message must change;
- `availableAmount` must change;
- new calculation required;
- new rounding required;
- new fallback required;
- persistence/payload/assistant must change;
- rollback is not local;
- real parity mismatch appears;
- Permanent Guard violated.

## 15. Permanent Guards

Permanent Facade Guard: respected. No Facade change is proposed.

Permanent Migration Guard: respected. This lot authorizes only a future implementation lot, not migration now.

Permanent Shadow Rule: respected. No new runtime Shadow read is added by this document.

Permanent Deterministic Parity Guard: respected through LOT 5.61 evidence.

Permanent Evidence Integrity Guard: respected. Intentional mismatch remains documented and visible.

Permanent Slice Isolation Guard: respected. Baseline remains 11 in this documentation lot; future implementation may move to 12 only at the selected call site.

Legacy Retention Guard: respected. `estimatedCharges` remains retained for all other Legacy consumers.

## 16. Validation

Executed lightweight commands only:

```bash
git diff --stat
```

```bash
git status --short
```

```bash
git diff -- docs/LOT_5_62_SMART_ALERT_RESERVE_LOW_MIGRATION_GATE_REVIEW.md
```

```bash
git status --short --untracked-files=all -- docs/LOT_5_62_SMART_ALERT_RESERVE_LOW_MIGRATION_GATE_REVIEW.md
```

Not run by scope:

- `node --test`;
- `npm run build`;
- `npm run lint`;
- Playwright;
- application.

## 17. Risks

Residual risks:

- reserve-low is behavior, not a display-only consumer;
- priority masking by TVA and ACRE-ending branches can hide reserve-low in some real states;
- any real future input mismatch could change ON/OFF near the threshold;
- the future implementation must stabilize the Shadow occurrence count from 11 to 12.

These risks are acceptable for a migration implementation lot because LOT 5.61 proved strict input parity for the supported scenarios and the future change is source-only with local rollback.

## 18. Final Decision

Consumer:

```txt
Smart alerts - estimated charges input for reserve-low alert
```

Status:

```txt
READY
```

Decision:

```txt
GO POUR LOT 5.63 - SMART ALERT RESERVE-LOW MIGRATION IMPLEMENTATION
```
