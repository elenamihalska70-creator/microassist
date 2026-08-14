# LOT 5.24 - Next Consumer Migration Implementation

## 1. Executive Summary

LOT 5.24 migrates exactly one consumer:

```text
Dashboard progress indicators revenue-presence gate
```

The gate no longer reads direct Legacy `currentMonthTotal > 0`.

It now reads:

```text
isFiscalProfileComplete && fiscalSummaryVisibleSlice.revenueTotal > 0
```

No business calculation, formula, rate, rounding, persistence, payload, export, assistant path, Adapter, Facade, Domain, CSS, label, text, interaction or layout was changed.

## 2. Scope and Authority

Authority documents read:

- `docs/LOT_5_18_LEGACY_RETENTION_HARDENING_REPORT.md`;
- `docs/LOT_5_20_NEXT_CONSUMER_MIGRATION_IMPLEMENTATION_REPORT.md`;
- `docs/LOT_5_21_NEXT_CONSUMER_MIGRATION_VALIDATION_REPORT.md`;
- `docs/LOT_5_22_NEXT_CONSUMER_STABILIZATION_REPORT.md`;
- `docs/LOT_5_23_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md`.

LOT 5.23 is the authority for the approved consumer and exact mapping.

## 3. Approved Consumer

Approved consumer:

- file: `src/App.jsx`;
- block: dashboard progress indicators;
- previous condition: `isFiscalProfileComplete && currentMonthTotal > 0`;
- new condition: `isFiscalProfileComplete && fiscalSummaryVisibleSlice.revenueTotal > 0`;
- migrated source: revenue presence only;
- retained source: `isFiscalProfileComplete` unchanged.

## 4. Permanent Guards

Permanent Facade Guard: respected. `calculateFiscalSummary` was not changed.

Permanent Migration Guard: respected. Shadow feeds only the approved first slice, the approved URSSAF gate and this approved progress indicators gate.

Permanent Shadow Rule: respected. The migrated gate reads `fiscalSummaryVisibleSlice`, not `shadowResult` directly.

Permanent Deterministic Parity Guard: respected. Same input still produces deterministic evidence.

Permanent Evidence Integrity Guard: respected. MISMATCH remains observable.

Permanent Slice Isolation Guard: respected. Exactly one consumer was migrated in runtime code.

Legacy Retention Guard: respected. Legacy remains retained for rollback, parity, runtime evidence and other authorized consumers.

## 5. Gate Before

```text
isFiscalProfileComplete && currentMonthTotal > 0
```

## 6. Gate After

```text
isFiscalProfileComplete && fiscalSummaryVisibleSlice.revenueTotal > 0
```

No helper, ternary, coercion, fallback, rounding, normalization or new variable was added.

## 7. Preservation of isFiscalProfileComplete

`isFiscalProfileComplete` remains in the same boolean gate and in the same logical order.

Validated by `tests/lot-5-24-next-consumer-migration.test.js`.

## 8. Feature Flag Behavior

The existing flag is reused through `fiscalSummaryVisibleSlice`:

```text
FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED
```

Flag ON with Shadow Result:

- `revenueTotal` comes from Shadow `revenue.total`;
- the progress gate uses Shadow-backed visible revenue.

Flag OFF or absent Shadow Result:

- `revenueTotal` falls back to Legacy `currentMonthTotal`;
- the progress gate automatically restores Legacy behavior through the selector.

No new flag was added.

## 9. Value Matrix

Validated:

| Case | Result |
| --- | --- |
| profile incomplete + positive revenue | hidden |
| profile complete + zero revenue | hidden |
| profile complete + positive revenue | visible |
| profile incomplete + zero revenue | hidden |
| profile complete + positive decimal revenue | visible |
| profile complete + negative revenue | hidden |
| Shadow Result present + flag ON | Shadow-backed |
| Shadow Result absent | Legacy fallback |
| flag ON | Shadow via selector |
| flag OFF | Legacy via selector |

## 10. Double Source of Truth Assessment

The progress gate now has one revenue source:

```text
fiscalSummaryVisibleSlice.revenueTotal > 0
```

Legacy `currentMonthTotal` remains calculated for authorized compatibility paths, but it no longer directly drives this gate when the selector is Shadow-backed.

## 11. Progress Indicators Integrity

Unchanged:

- progress indicator JSX structure;
- `progressIndicators`, `progressItem`, `progressItemHeader`, `progressBar progressBarPremium`, `progressFill`;
- `Objectif d'épargne` label;
- `savingsProgress / savingsGoal` percentage formula;
- `Math.min` and `Math.round` display behavior;
- styles, layout, interactions and texts.

## 12. Scope Isolation

Runtime code changed only one approved condition in `src/App.jsx`.

Test guard maintenance updated count assertions in LOT 5.18 and the prior LOT 5.20-5.22 tests so they no longer assert the old remaining direct Legacy progress gate.

No other application file was modified by LOT 5.24.

## 13. Parity Safety

Parity remains intact:

- LOT 5.11 evidence harness passed;
- `shadow-parity-validation.test.js` passed;
- `runtime-parity-evidence.test.js` passed;
- intentional MISMATCH remains detected.

The migrated field is only `revenue.total`, already covered by existing parity evidence.

## 14. Persistence Assessment

No persistence path changed.

Confirmed unchanged:

- Supabase reads/writes;
- localStorage reads/writes;
- save/restore/sync workflows.

## 15. Payload Assessment

No payload path changed.

Feedback and analytics remain Legacy-compatible, including:

```text
totalRevenues: currentMonthTotal || 0
```

## 16. Export Assessment

No export path changed.

PDF/export consumers remain Legacy-compatible, including:

- `getDisplayValue(currentMonthTotal, "money")`;
- `dashboardChargesDisplay`;
- `dashboardAvailableDisplay`.

## 17. Assistant Assessment

No assistant output, draft, message, state or assistant-adjacent persistence path changed.

Assistant-adjacent consumers remain excluded from this migration.

## 18. Tests Added

Created:

- `tests/lot-5-24-next-consumer-migration.test.js`.

Coverage includes:

- exact progress gate migration;
- `isFiscalProfileComplete` preservation;
- zero, positive, decimal and negative revenue behavior;
- flag ON, flag OFF and absent Shadow Result behavior;
- no new flag/state/effect/memo;
- no second Adapter or Facade execution;
- no fallback or normalization;
- progress indicator content integrity;
- no persistence, payload, export or assistant change;
- parity and runtime evidence integrity;
- local rollback expression.

## 19. Full Node Suite Result

Executed:

```text
node --test
```

Result:

- tests: 328;
- pass: 328;
- fail: 0;
- cancelled: 0;
- skipped: 0;
- todo: 0;
- duration: about 1.11 seconds.

Targeted required tests also passed:

- LOT 5.24: 16 passed;
- LOT 5.22: 26 passed;
- LOT 5.21: 19 passed;
- LOT 5.20: 13 passed;
- LOT 5.18: 13 passed;
- LOT 5.15: 13 passed;
- LOT 5.14: 14 passed;
- LOT 5.13: 8 passed;
- LOT 5.11: 7 passed;
- shadow parity: 6 passed;
- runtime parity evidence: 11 passed.

Node commands were run with approved escalated execution because sandboxed Node test execution previously failed with `spawn EPERM`.

## 20. Build and Lint Results

Build:

- `npm run build`: passed;
- existing Vite large chunk warning remains.

Global lint:

- `npm run lint`: failed on historical baseline only;
- 50 problems;
- 21 errors;
- 29 warnings;
- files: `src/App.jsx`, `src/components/InvoiceGenerator.jsx`, `src/context/AuthContext.jsx`.

Targeted lint:

- `npx eslint tests/lot-5-18-legacy-retention-hardening.test.js tests/lot-5-20-next-consumer-migration.test.js tests/lot-5-21-next-consumer-migration-validation.test.js tests/lot-5-22-next-consumer-stabilization.test.js tests/lot-5-24-next-consumer-migration.test.js`: passed.
- `npx eslint src/App.jsx ...tests touched by LOT 5.24`: failed only on the existing `src/App.jsx` historical debt, 48 problems: 19 errors and 29 warnings.

No LOT 5.24 test lint issue was introduced.

## 21. Consecutive Playwright Runs

Executed twice:

```text
npx playwright test --reporter=line
```

Run 1:

- 11 tests detected;
- 11 passed;
- no Node tests collected;
- no OOM;
- no Vite crash;
- no Node crash.

Run 2:

- 11 tests detected;
- 11 passed;
- no Node tests collected;
- no OOM;
- no Vite crash;
- no Node crash.

Post-run process check showed no significant Microassist/Vite/Playwright/Chromium orphan. Remaining Node processes were Codex `node_repl` and unrelated Node processes outside this project.

## 22. Risks

Residual risks:

- global lint debt remains historical and outside this LOT;
- `src/App.jsx` remains large and continues to trigger Babel deoptimization notes;
- prior LOT tests needed guard maintenance because they encoded the pre-5.24 remaining Legacy gate.

No risk requires rollback.

## 23. Rollback

Rollback is local:

```text
isFiscalProfileComplete && fiscalSummaryVisibleSlice.revenueTotal > 0
```

back to:

```text
isFiscalProfileComplete && currentMonthTotal > 0
```

only at the progress indicators gate.

Rollback keeps:

- first visible Shadow slice;
- URSSAF migrated gate;
- Adapter;
- Facade;
- parity;
- runtime evidence;
- Legacy Retention Guards.

No data migration, Supabase action or localStorage action is required.

## 24. Files Modified

Modified:

- `src/App.jsx`;
- `tests/lot-5-18-legacy-retention-hardening.test.js`;
- `tests/lot-5-20-next-consumer-migration.test.js`;
- `tests/lot-5-21-next-consumer-migration-validation.test.js`;
- `tests/lot-5-22-next-consumer-stabilization.test.js`.

Created:

- `tests/lot-5-24-next-consumer-migration.test.js`;
- `docs/LOT_5_24_NEXT_CONSUMER_MIGRATION_IMPLEMENTATION_REPORT.md`.

## 25. Recommended Next LOT

Recommended next LOT:

```text
LOT 5.25 - Next Consumer Migration Validation
```

Purpose:

- validate the migrated progress indicators gate as a visible consumer;
- confirm it remains isolated, rollbackable and stable after implementation.

## 26. Final Decision

GO POUR LOT 5.25 — NEXT CONSUMER MIGRATION VALIDATION
