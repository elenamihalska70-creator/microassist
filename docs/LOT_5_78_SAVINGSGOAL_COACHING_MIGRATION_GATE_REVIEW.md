# LOT 5.78 - SavingsGoal Coaching Migration Gate Review

## 1. Executive Summary

LOT 5.78 is a documentation-only gate review for the single coaching consumer:

```txt
fiscalCoachingCard low-reserve
```

No runtime code, `src/App.jsx`, root `savingsGoal`, coaching message, threshold, branch order, PDF/export, persistence, payload, assistant, analytics, Adapter, Facade, Domain, Rules Engine, helper, test or feature flag was modified.

Gate result:

```txt
READY for a source-only migration implementation in LOT 5.79.
```

The future migration must be local to the `fiscalCoachingCard` low-reserve denominator and must not replace the global `savingsGoal` root.

## 2. Consumer Exact

Authorized consumer:

| Field | Value |
| --- | --- |
| file | `src/App.jsx` |
| block | `const fiscalCoachingCard = useMemo(() => { ... })` |
| branch | low-reserve coaching branch |
| current dependency | `savingsGoal` |
| output | `{ text: roleBasedTips.dailyFiscalTip.lowReserve }` |
| visible | yes, when this branch is selected |

Current Legacy expression:

```js
if (
  !smartAlertIds.has("reserve-low") &&
  savingsGoal > 0 &&
  savingsProgress < savingsGoal * 0.35
) {
  return {
    text: roleBasedTips.dailyFiscalTip.lowReserve,
  };
}
```

Current dependency array includes:

```txt
savingsGoal
savingsProgress
```

No other coaching consumer is authorized for LOT 5.79.

## 3. Legacy Contract

The Legacy coaching contract is mixed: it uses an amount-derived denominator to drive a boolean threshold.

| Contract piece | Legacy value |
| --- | --- |
| root amount | `savingsGoal = Math.max(estimatedCharges * 3, 500)` |
| numerator | `savingsProgress` |
| denominator | `savingsGoal` |
| ratio concept | `savingsProgress / savingsGoal` |
| threshold | `savingsGoal * 0.35` |
| comparator | strict `<` |
| clamp | none |
| direct rounding in branch | none |
| inherited rounding | `estimatedCharges = Math.round(currentMonthTotal * computed.rate)` |
| smart-alert guard | `!smartAlertIds.has("reserve-low")` |
| message | `roleBasedTips.dailyFiscalTip.lowReserve` |

The branch must remain behaviorally identical after migration.

## 4. Target Shadow Contract

Approved Shadow candidate:

```txt
fiscalSummaryVisibleSlice.finalContributionAmount
```

Future source-only denominator:

```js
Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)
```

Mapping:

| Legacy | Shadow candidate | Status |
| --- | --- | --- |
| `estimatedCharges` | `fiscalSummaryVisibleSlice.finalContributionAmount` | proven |
| `savingsGoal` denominator | `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` | proven for UI and coaching evidence |
| `savingsProgress` | retained Legacy `savingsProgress` | no migration |
| `smartAlertIds` | retained local set | no migration |

No new synthetic Shadow field is needed.

## 5. Parity Review

LOT 5.77 evidence:

| Evidence item | Result | Classification |
| --- | --- | --- |
| coaching consumer identified | PASS | READY |
| root `savingsGoal` remains Legacy | PASS | READY |
| amount parity | PASS | READY |
| ratio parity | PASS | READY |
| boolean parity | PASS | READY |
| threshold below | PASS | READY |
| threshold exact | PASS | READY |
| threshold above | PASS | READY |
| revenue zero / positive | PASS | READY |
| estimatedCharges zero / positive | PASS | READY |
| ACRE inactive / active | PASS | READY |
| intentional mismatch detection | PASS | READY |
| branch mismatch detection | PASS | READY |
| message branch integrity | PASS | READY |
| same input determinism | PASS | READY |
| cloned input determinism | PASS | READY |
| no mutation | PASS | READY |
| no implicit time in evidence helpers | PASS | READY |
| no persistence / assistant mutation | PASS | READY |
| PDF/export untouched | PASS | READY |
| no new Shadow consumer | PASS | READY |
| baseline Shadow = 13 | PASS | READY |
| no 14th occurrence in LOT 5.77 | PASS | READY |

Overall parity classification:

```txt
READY
```

## 6. Source-Only Requirement

LOT 5.79 must only change the source of the low-reserve denominator.

Allowed future expression shape:

```js
Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)
```

Forbidden changes:

- no root `savingsGoal` replacement;
- no threshold change;
- no comparator change;
- no rounding change;
- no clamp;
- no fallback;
- no message change;
- no branch order change;
- no PDF/export change.

If any of those are required during implementation, LOT 5.79 must stop.

## 7. Root SavingsGoal Retention

The root remains Legacy after a future coaching migration:

```js
const savingsGoal = useMemo(() => {
  return Math.max(estimatedCharges * 3, 500);
}, [estimatedCharges]);
```

The coaching migration does not authorize:

- deleting `savingsGoal`;
- replacing `savingsGoal` globally;
- migrating PDF/export;
- migrating other coaching branches;
- changing `savingsProgress`.

## 8. PDF / Export Isolation

PDF/export remains Legacy and outside LOT 5.79 scope.

Current PDF/export contract:

```js
typeof savingsGoal !== "undefined" && savingsGoal > 0
  ? `${Math.round((savingsProgress / savingsGoal) * 100 || 0)}%`
  : "Pas encore assez de données"
```

The future coaching source does not feed PDF/export. No PDF change is required.

## 9. Feature Flag

The future migration can reuse the existing visible-slice selector and feature flag behavior:

```js
const usesShadow =
  FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED &&
  Boolean(shadowResult);
```

Current selector:

```js
finalContributionAmount: usesShadow
  ? shadowResult.summary.finalContributionAmount
  : estimatedCharges
```

Gate decision:

```txt
Use fiscalSummaryVisibleSlice.finalContributionAmount.
Do not create a new flag.
Flag ON uses Shadow.
Flag OFF or missing Shadow result falls back to Legacy estimatedCharges through the existing selector.
```

## 10. Shadow Baseline

Current baseline:

```txt
fiscalSummaryVisibleSlice = 13
```

Future expected baseline if LOT 5.79 proceeds:

```txt
fiscalSummaryVisibleSlice = 14
```

The 14th occurrence must be the single new read in:

```txt
src/App.jsx -> fiscalCoachingCard -> low-reserve branch
```

No 15th occurrence is authorized.

## 11. React / State

LOT 5.79 must not require:

- new `useState`;
- new `useEffect`;
- new unnecessary `useMemo`;
- new Context;
- new business helper;
- second Adapter call;
- second Facade call;
- new feature flag.

Expected dependency change:

```txt
fiscalCoachingCard deps may replace savingsGoal with fiscalSummaryVisibleSlice.finalContributionAmount
only if the low-reserve expression no longer reads savingsGoal.
```

`savingsProgress` remains in dependencies.

## 12. No Propagation

The authorized consumer does not write to:

- Supabase;
- `localStorage`;
- `sessionStorage`;
- payloads;
- assistant;
- feedback;
- analytics;
- PDF/export;
- invoices;
- reminders.

LOT 5.79 must preserve that isolation.

## 13. Rollback

Future rollback is local:

```txt
Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)
-> savingsGoal
```

Rollback scope:

```txt
src/App.jsx -> fiscalCoachingCard -> low-reserve branch only
```

No data migration, persistence migration, message change, threshold change or PDF/export change is involved.

## 14. Future LOT 5.79 Scope

If LOT 5.79 is launched, exact authorized scope:

| Item | Authorization |
| --- | --- |
| file | `src/App.jsx` |
| block | `fiscalCoachingCard` |
| branch | low-reserve only |
| Legacy expression | `savingsGoal > 0 && savingsProgress < savingsGoal * 0.35` |
| Shadow expression | denominator derived from `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` |
| flag | existing `fiscalSummaryVisibleSlice` behavior only |
| baseline | `13 -> 14` |
| rollback | local expression back to `savingsGoal` |
| tests | targeted LOT 5.77 plus migration-specific guards |

Expected stop conditions for LOT 5.79:

- root `savingsGoal` needs to change;
- message changes;
- threshold changes;
- comparator changes;
- branch order changes;
- PDF/export changes;
- assistant/persistence/payload changes;
- baseline becomes anything other than `14`;
- more than one coaching consumer must migrate.

## 15. Gate Decision

The `fiscalCoachingCard` low-reserve consumer is approved for a future source-only migration implementation.

Status:

```txt
READY
```

Reason:

```txt
The consumer is exact, local, parity-proven, rollbackable, and can use the existing visible-slice selector without changing root savingsGoal or PDF/export.
```

## 16. Validation

Light validation required for this documentation-only LOT:

```txt
git diff --stat
git status --short
git diff -- docs/LOT_5_78_SAVINGSGOAL_COACHING_MIGRATION_GATE_REVIEW.md
git status --short --untracked-files=all -- docs/LOT_5_78_SAVINGSGOAL_COACHING_MIGRATION_GATE_REVIEW.md
```

Results will be recorded after execution.

Observed results:

```txt
git diff --stat
-> existing tracked worktree changes only:
   playwright.config.js, src/App.jsx, src/utils/obligations.js,
   tests/home.spec.js, tests/premium.spec.js

git status --short
-> existing broader worktree changes plus untracked docs/, src/application/,
   src/domain/, src/navigation/, src/shell/ and tests/ entries.

git diff -- docs/LOT_5_78_SAVINGSGOAL_COACHING_MIGRATION_GATE_REVIEW.md
-> no output because the report is untracked.

git status --short --untracked-files=all -- docs/LOT_5_78_SAVINGSGOAL_COACHING_MIGRATION_GATE_REVIEW.md
-> ?? docs/LOT_5_78_SAVINGSGOAL_COACHING_MIGRATION_GATE_REVIEW.md
```

## 17. Final Decision

GO POUR LOT 5.79 - SAVINGSGOAL COACHING MIGRATION IMPLEMENTATION
