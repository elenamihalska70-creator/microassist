# LOT 5.32 - Isolated SavingsGoal UI Migration Report

## 1. Executive Summary

LOT 5.32 migrated exactly one visible UI text consumer for `Objectif d'épargne`.

The migrated consumer now derives its denominator from:

```js
fiscalSummaryVisibleSlice.finalContributionAmount
```

No global `savingsGoal`, `estimatedCharges`, coaching, PDF, export percentage, persistence, payload, assistant, Adapter, Facade, Domain, Rules Engine, rate, rounding, style, layout or workflow change was made.

## 2. Scope

Modified files:

- `src/App.jsx`
- `tests/lot-5-32-isolated-savingsgoal-ui-migration.test.js`
- `tests/lot-5-30-isolated-savingsgoal-ui-parity-evidence.test.js`
- `tests/lot-5-29-savingsgoal-architecture-hardening.test.js`
- `docs/LOT_5_32_ISOLATED_SAVINGSGOAL_UI_MIGRATION_REPORT.md`

The updates to LOT 5.29 and LOT 5.30 tests only adjust historical guards for the single approved UI text migration.

## 3. Consumer Before

The selected text consumer previously used the global Legacy denominator:

```js
Math.round((savingsProgress / savingsGoal) * 100)
```

The selected consumer was the text percentage next to:

```txt
Objectif d'épargne
```

## 4. Consumer After

The selected text consumer now uses the Shadow-backed visible slice amount as the source:

```js
Math.round(
  (savingsProgress /
    Math.max(
      fiscalSummaryVisibleSlice.finalContributionAmount * 3,
      500,
    )) *
    100,
)
```

The visible formatter remains:

```js
Math.min(100, Math.round(...))
```

The label, unit, CSS, layout and placement remain unchanged.

## 5. Global SavingsGoal Preservation

Global `savingsGoal` remains unchanged:

```js
const savingsGoal = useMemo(() => {
  return Math.max(estimatedCharges * 3, 500);
}, [estimatedCharges]);
```

It continues to feed Legacy consumers outside the selected text read.

## 6. Coaching Preservation

Coaching remains Legacy.

The low-reserve branch still uses:

```js
savingsGoal > 0 &&
savingsProgress < savingsGoal * 0.35
```

No Shadow read was added to `fiscalCoachingCard`.

## 7. PDF Preservation

PDF remains Legacy.

The PDF export percentage still uses:

```js
Math.round((savingsProgress / savingsGoal) * 100 || 0)
```

No export builder, PDF text, PDF rounding or PDF formula was changed.

## 8. Feature Flag Behavior

The migration reuses the existing visible slice behavior:

```js
FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED
```

Flag ON:

```txt
fiscalSummaryVisibleSlice.finalContributionAmount reads Shadow
```

Flag OFF or Shadow unavailable:

```txt
fiscalSummaryVisibleSlice.finalContributionAmount falls back to estimatedCharges
```

No new flag was created. No flag persistence was added.

## 9. UI Formatting Preservation

Preserved:

- label: `Objectif d'épargne`;
- unit: `%`;
- cap: `Math.min(100, ...)`;
- rounding: `Math.round(...)`;
- CSS classes;
- layout;
- interaction.

Only the amount source feeding the selected denominator changed.

## 10. Double Source Assessment

The selected text consumer is migrated.

The progress fill width remains Legacy:

```js
Math.round((savingsProgress / savingsGoal) * 100)
```

This is intentional and follows LOT 5.31. The future rollback is local to the text read.

## 11. Tests

Created:

```txt
tests/lot-5-32-isolated-savingsgoal-ui-migration.test.js
```

The test covers:

- target UI consumer identification;
- removal of direct `savingsGoal` read from that text consumer;
- exact `fiscalSummaryVisibleSlice.finalContributionAmount` read;
- global `savingsGoal` preservation;
- `estimatedCharges` preservation;
- coaching and PDF Legacy retention;
- unchanged export percentage;
- no new rounding, fallback, state, effect, Adapter execution or Facade execution;
- feature flag ON/OFF behavior through the existing visible slice;
- parity, runtime evidence and mismatch detection integrity;
- persistence, payload, assistant and export isolation;
- no other consumer migrated;
- UI formatter preservation.

## 12. Targeted Validation

Executed only the LOT 5.32A validation set.

```txt
node --test tests/lot-5-32-isolated-savingsgoal-ui-migration.test.js
PASS - 25/25
```

```txt
node --test tests/lot-5-30-isolated-savingsgoal-ui-parity-evidence.test.js
PASS - 19/19
```

```txt
node --test tests/lot-5-29-savingsgoal-architecture-hardening.test.js
PASS - 16/16
```

```txt
node --test tests/shadow-parity-validation.test.js
PASS - 6/6
```

```txt
node --test tests/runtime-parity-evidence.test.js
PASS - 11/11
```

```txt
npx eslint tests/lot-5-32-isolated-savingsgoal-ui-migration.test.js
PASS
```

The first sandboxed Node run hit the known Windows `spawn EPERM`; the same command passed with approved escalation. No full `node --test`, build, global lint or Playwright run was executed.

## 13. Risks

Remaining risk:

- the text percentage is now Shadow-backed while the progress fill width remains Legacy.

This divergence is intentional under LOT 5.31 and must be reviewed in full validation before expanding any UI migration.

No real mismatch was observed in targeted validation.

## 14. Rollback

Rollback is local to the selected text read:

```txt
Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)
-> savingsGoal
```

Rollback does not require:

- data migration;
- Supabase action;
- localStorage action;
- Adapter change;
- Facade change;
- coaching change;
- PDF change;
- assistant change.

## 15. Full Migration Validation

### 1. Source-only Diff Verification

Pre-test inspection confirmed:

- only the `Objectif d'épargne` UI text consumer changed source;
- `savingsGoal` global remains Legacy;
- the progress fill width remains Legacy;
- coaching remains Legacy;
- PDF remains Legacy;
- no Adapter, Facade, Domain, Rules Engine, persistence, payload or assistant path was modified by LOT 5.32B.

### 2. Formula Preservation

The selected UI text keeps:

- the `* 3` multiplier;
- the `500` minimum;
- `Math.max`;
- `Math.min(100, ...)`;
- `Math.round`;
- the `%` unit;
- the `Objectif d'épargne` label.

The source changed to:

```js
fiscalSummaryVisibleSlice.finalContributionAmount
```

### 3. Full Node Suite

Command:

```txt
node --test
```

Sandbox result:

```txt
FAIL - spawn EPERM
```

Approved escalation result:

```txt
421 tests
414 pass
7 fail
0 cancelled
0 skipped
0 todo
```

Failing tests:

- `tests/lot-5-18-legacy-retention-hardening.test.js`
- `tests/lot-5-20-next-consumer-migration.test.js`
- `tests/lot-5-21-next-consumer-migration-validation.test.js`
- `tests/lot-5-22-next-consumer-stabilization.test.js`
- `tests/lot-5-24-next-consumer-migration.test.js`
- `tests/lot-5-25-next-consumer-migration-validation.test.js`
- `tests/lot-5-26-next-consumer-stabilization.test.js`

Observed failure pattern:

```txt
fiscalSummaryVisibleSlice
7 !== 6
```

Interpretation:

- LOT 5.32A targeted guards were adjusted for the approved migration;
- earlier historical guards still expect the pre-LOT-5.32 count;
- this is a blocking full-suite guard inconsistency;
- no automatic guard correction was performed in LOT 5.32B, per STOP conditions.

### 4. Build

Not executed.

Reason:

```txt
STOP after node --test failure.
```

### 5. Global Lint

Not executed.

Reason:

```txt
STOP after node --test failure.
```

### 6. Targeted ESLint

Not executed in LOT 5.32B.

Reason:

```txt
STOP after node --test failure.
```

Latest LOT 5.32A targeted ESLint result remained:

```txt
PASS
```

### 7. Playwright Run 1

Not executed.

Reason:

```txt
STOP after node --test failure.
```

### 8. Playwright Run 2

Not executed.

Reason:

```txt
STOP after node --test failure.
```

### 9. Parity / Runtime Evidence

Within the full Node output:

- LOT 5.30 parity evidence passed;
- LOT 5.32 migration test passed;
- shadow parity validation passed;
- runtime evidence passed;
- no real mismatch was reported.

### 10. Legacy Boundaries

Confirmed before tests:

- UI text `Objectif d'épargne` -> Shadow authorized;
- global `savingsGoal` -> Legacy;
- progress fill width -> Legacy;
- coaching -> Legacy;
- PDF -> Legacy;
- export percentage -> Legacy outside the approved UI text consumer;
- persistence -> unchanged;
- payloads -> unchanged;
- assistant -> unchanged.

### 11. Rollback

Rollback remains local:

```txt
restore the selected Objectif d'épargne text denominator to savingsGoal
```

No rollback requires data migration, Supabase, localStorage, Facade, Adapter, coaching or PDF changes.

### 12. Scope Control

No code correction was attempted after the full-suite failure.

The validation stopped at step 1 as required.

### 13. Final Decision

Full migration validation is not complete because `node --test` failed on historical guard count expectations.

## 16. Recommended Next LOT

Recommended next LOT:

```txt
LOT 5.33 - Extended Stabilization
```

## 17. Final Decision

LOT 5.32B stopped after the full Node suite failure. The issue is a technical guard stabilization problem, not an observed parity mismatch.

GO POUR LOT 5.33 — EXTENDED STABILIZATION
