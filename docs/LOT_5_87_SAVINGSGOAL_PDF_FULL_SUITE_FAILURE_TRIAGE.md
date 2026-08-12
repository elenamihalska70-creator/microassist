# LOT 5.87 - SavingsGoal PDF Full Suite Failure Triage

## 1. Executive Summary

LOT 5.87 investigated the full `node --test` failure after the approved LOT 5.86A PDF denominator migration.

No runtime code, test, historical guard, formula, PDF behavior, `savingsGoal`, `savingsProgress`, Adapter, Facade, Domain, persistence, payload or assistant path was modified.

Classification:

```txt
A. HISTORICAL GUARD DRIFT
```

All 74 real full-suite failures are historical source/guard assertions that still encode one or more pre-LOT-5.86A expectations:

- `fiscalSummaryVisibleSlice = 14`;
- no 15th Shadow occurrence;
- PDF `Objectif d epargne` denominator remains direct `savingsGoal`;
- old LOT 5.29 PDF boundary comment still exists;
- no `pdfSavingsGoal` alias;
- `savingsGoal` lexical count remains `5`;
- only one savings-goal Shadow alias exists.

No real PDF runtime mismatch or migration scope violation was found.

## 2. Reproduction Result

Command:

```txt
node --test
```

Sandbox result:

```txt
FAIL - known spawn EPERM
tests 60
pass 0
fail 60
```

Exact outside-sandbox relaunch:

```txt
node --test
```

Outside-sandbox result:

```txt
FAIL
tests 862
pass 788
fail 74
```

For inventory only, the same command output was captured to a temporary file outside the repository:

```txt
%TEMP%\lot587-node-test-output.txt
```

No repository file was created or modified for output capture.

## 3. Full Failure Count

Unique failing tests:

```txt
74
```

Failing LOT distribution:

| LOT | Failures |
| --- | ---: |
| 5.18 | 1 |
| 5.20 | 1 |
| 5.21 | 1 |
| 5.22 | 1 |
| 5.24 | 1 |
| 5.25 | 1 |
| 5.26 | 1 |
| 5.29 | 7 |
| 5.30 | 3 |
| 5.32 | 4 |
| 5.34 | 3 |
| 5.35 | 6 |
| 5.37 | 4 |
| 5.39 | 3 |
| 5.40 | 3 |
| 5.42 | 2 |
| 5.44 | 1 |
| 5.46 | 1 |
| 5.47 | 1 |
| 5.48 | 1 |
| 5.49 | 1 |
| 5.51 | 1 |
| 5.53 | 1 |
| 5.54 | 1 |
| 5.56 | 1 |
| 5.57 | 1 |
| 5.58 | 1 |
| 5.59 | 1 |
| 5.61 | 1 |
| 5.63 | 2 |
| 5.64 | 1 |
| 5.65 | 1 |
| 5.66 | 1 |
| 5.68 | 1 |
| 5.70 | 1 |
| 5.72 | 1 |
| 5.73 | 1 |
| 5.77 | 2 |
| 5.79 | 4 |
| 5.81 | 4 |

## 4. Failure Inventory

| # | Test file / test name | Expected | Actual | Observed dependency | Classification |
| ---: | --- | --- | --- | --- | --- |
| 1 | `tests/lot-5-18-legacy-retention-hardening.test.js` - blocks unapproved new Legacy consumers | `fiscalSummaryVisibleSlice = 14` | `15` | approved `pdfSavingsGoal` 15th occurrence | Historical guard drift |
| 2 | `tests/lot-5-20-next-consumer-migration.test.js` - no new flag/state/effect/Adapter/Facade | `fiscalSummaryVisibleSlice = 14` | `15` | approved PDF denominator read | Historical guard drift |
| 3 | `tests/lot-5-21-next-consumer-migration-validation.test.js` - no new state/effect/Adapter/Facade | `fiscalSummaryVisibleSlice = 14` | `15` | approved PDF denominator read | Historical guard drift |
| 4 | `tests/lot-5-22-next-consumer-stabilization.test.js` - React counts, Adapter, Facade stable | `fiscalSummaryVisibleSlice = 14` | `15` | approved PDF denominator read | Historical guard drift |
| 5 | `tests/lot-5-24-next-consumer-migration.test.js` - no flag/state/effect/memo/Adapter/Facade | `fiscalSummaryVisibleSlice = 14` | `15` | approved PDF denominator read | Historical guard drift |
| 6 | `tests/lot-5-25-next-consumer-migration-validation.test.js` - no new React or pipeline surface | `fiscalSummaryVisibleSlice = 14` | `15` | approved PDF denominator read | Historical guard drift |
| 7 | `tests/lot-5-26-next-consumer-stabilization.test.js` - React hooks, Adapter, Facade surface stable | `fiscalSummaryVisibleSlice = 14` | `15` | approved PDF denominator read | Historical guard drift |
| 8 | `tests/lot-5-29-savingsgoal-architecture-hardening.test.js` - identifies the PDF boundary separately | old LOT 5.29 PDF comment and `savingsGoal` denominator | LOT 5.86A comment and `pdfSavingsGoal` denominator | approved PDF migration | Historical guard drift |
| 9 | `tests/lot-5-29-savingsgoal-architecture-hardening.test.js` - non-UI boundaries without Shadow reads | PDF still no Shadow read | PDF has approved `pdfSavingsGoal` Shadow-derived alias | approved PDF migration | Historical guard drift |
| 10 | `tests/lot-5-29-savingsgoal-architecture-hardening.test.js` - no new rounding/percentage/fallback | old PDF block extraction and old denominator | extraction/comment obsolete; denominator changed only | approved source-only denominator migration | Historical guard drift |
| 11 | `tests/lot-5-29-savingsgoal-architecture-hardening.test.js` - export output contract unchanged | `Math.round((savingsProgress / savingsGoal) * 100 || 0)` | `Math.round((savingsProgress / pdfSavingsGoal) * 100 || 0)` | approved denominator source change | Historical guard drift |
| 12 | `tests/lot-5-29-savingsgoal-architecture-hardening.test.js` - cross-consumer coupling guard | no `pdfSavingsGoal` alias | `pdfSavingsGoal` exists | approved PDF alias | Historical guard drift |
| 13 | `tests/lot-5-29-savingsgoal-architecture-hardening.test.js` - no new React/pipeline surface | old Shadow count / savingsGoal count | `fiscalSummaryVisibleSlice = 15`, `savingsGoal = 1` | approved PDF migration | Historical guard drift |
| 14 | `tests/lot-5-29-savingsgoal-architecture-hardening.test.js` - no new consumer beyond comments | no `pdfSavingsGoal` consumer | one approved PDF consumer | approved LOT 5.86A consumer | Historical guard drift |
| 15 | `tests/lot-5-30-isolated-savingsgoal-ui-parity-evidence.test.js` - no Shadow read to PDF export | PDF export Legacy/no Shadow | PDF denominator now Shadow-derived via alias | approved PDF migration | Historical guard drift |
| 16 | `tests/lot-5-30-isolated-savingsgoal-ui-parity-evidence.test.js` - no new rounding to UI parity path | old PDF block/string count | denominator alias changes old count assumptions | approved PDF alias | Historical guard drift |
| 17 | `tests/lot-5-30-isolated-savingsgoal-ui-parity-evidence.test.js` - Legacy Retention intact | `savingsGoal = 5` | `savingsGoal = 1` | direct PDF reads removed only from approved consumer | Historical guard drift |
| 18 | `tests/lot-5-32-isolated-savingsgoal-ui-migration.test.js` - PDF Legacy | direct PDF `savingsGoal` | PDF `pdfSavingsGoal` | approved PDF migration | Historical guard drift |
| 19 | `tests/lot-5-32-isolated-savingsgoal-ui-migration.test.js` - export percentage unchanged | old denominator expression | same ratio with new denominator alias | approved source-only denominator migration | Historical guard drift |
| 20 | `tests/lot-5-32-isolated-savingsgoal-ui-migration.test.js` - UI migrations bounded | no PDF alias counted | `pdfSavingsGoal` counted | approved PDF consumer | Historical guard drift |
| 21 | `tests/lot-5-32-isolated-savingsgoal-ui-migration.test.js` - approved execution surface counts | `savingsGoal = 5` / old count | `savingsGoal = 1` / `pdfSavingsGoal = 5` | approved PDF migration | Historical guard drift |
| 22 | `tests/lot-5-34-isolated-savingsgoal-ui-migration-validation.test.js` - Shadow baseline | `fiscalSummaryVisibleSlice = 14` | `15` | approved PDF alias | Historical guard drift |
| 23 | `tests/lot-5-34-isolated-savingsgoal-ui-migration-validation.test.js` - PDF stays Legacy | direct PDF `savingsGoal` | PDF `pdfSavingsGoal` | approved PDF migration | Historical guard drift |
| 24 | `tests/lot-5-34-isolated-savingsgoal-ui-migration-validation.test.js` - no new consumer beyond UI consumers | no PDF Shadow consumer | one approved PDF Shadow consumer | approved LOT 5.86A consumer | Historical guard drift |
| 25 | `tests/lot-5-35-isolated-savingsgoal-ui-stabilization.test.js` - Shadow baseline | old baseline 14 | 15 | approved PDF alias | Historical guard drift |
| 26 | `tests/lot-5-35-isolated-savingsgoal-ui-stabilization.test.js` - monthly reflection tenth occurrence | old source-count window | count shifted by 15th PDF occurrence | approved PDF alias | Historical guard drift |
| 27 | `tests/lot-5-35-isolated-savingsgoal-ui-stabilization.test.js` - PDF remains Legacy | direct PDF `savingsGoal` | PDF `pdfSavingsGoal` | approved PDF migration | Historical guard drift |
| 28 | `tests/lot-5-35-isolated-savingsgoal-ui-stabilization.test.js` - payloads and exports unchanged | export has old denominator | export has approved denominator alias | approved PDF migration | Historical guard drift |
| 29 | `tests/lot-5-35-isolated-savingsgoal-ui-stabilization.test.js` - no migrated consumer beyond UI pair | no PDF Shadow consumer | one approved PDF Shadow consumer | approved LOT 5.86A consumer | Historical guard drift |
| 30 | `tests/lot-5-35-isolated-savingsgoal-ui-stabilization.test.js` - no propagation outside UI text | no PDF alias | `pdfSavingsGoal` exists | approved PDF migration | Historical guard drift |
| 31 | `tests/lot-5-37-objective-savings-progress-bar-migration.test.js` - PDF remains Legacy | direct PDF `savingsGoal` | PDF `pdfSavingsGoal` | approved PDF migration | Historical guard drift |
| 32 | `tests/lot-5-37-objective-savings-progress-bar-migration.test.js` - exports unchanged | old denominator expression | denominator source changed only | approved source-only migration | Historical guard drift |
| 33 | `tests/lot-5-37-objective-savings-progress-bar-migration.test.js` - migrates no other consumer | no PDF Shadow consumer | one approved PDF consumer | approved LOT 5.86A consumer | Historical guard drift |
| 34 | `tests/lot-5-37-objective-savings-progress-bar-migration.test.js` - Shadow baseline | old baseline 14 | 15 | approved PDF alias | Historical guard drift |
| 35 | `tests/lot-5-39-objective-savings-progress-bar-migration-validation.test.js` - Shadow baseline | old baseline 14 | 15 | approved PDF alias | Historical guard drift |
| 36 | `tests/lot-5-39-objective-savings-progress-bar-migration-validation.test.js` - PDF and export Legacy | old LOT 5.29 block/direct `savingsGoal` | LOT 5.86A block/`pdfSavingsGoal` | approved PDF migration | Historical guard drift |
| 37 | `tests/lot-5-39-objective-savings-progress-bar-migration-validation.test.js` - no unapproved Shadow savings aliases | no `pdfSavingsGoal` | approved `pdfSavingsGoal` | approved PDF alias | Historical guard drift |
| 38 | `tests/lot-5-40-objective-savings-progress-bar-stabilization.test.js` - Shadow baseline ten/monthly reflection | old baseline family | 15 | approved later migrations plus PDF alias | Historical guard drift |
| 39 | `tests/lot-5-40-objective-savings-progress-bar-stabilization.test.js` - PDF/export Legacy | direct PDF `savingsGoal` | PDF `pdfSavingsGoal` | approved PDF migration | Historical guard drift |
| 40 | `tests/lot-5-40-objective-savings-progress-bar-stabilization.test.js` - no new Shadow consumer/alias | no `pdfSavingsGoal` | approved `pdfSavingsGoal` | approved PDF alias | Historical guard drift |
| 41 | `tests/lot-5-42-weekly-recap-effective-rate-parity-evidence.test.js` - weekly effectiveRate source | old count / no extra Shadow consumer | 15 occurrences | approved PDF alias | Historical guard drift |
| 42 | `tests/lot-5-42-weekly-recap-effective-rate-parity-evidence.test.js` - no persistence/payload/export/assistant or extra Shadow consumer | no PDF Shadow read | approved PDF alias | approved PDF migration | Historical guard drift |
| 43 | `tests/lot-5-44-weekly-rate-contract-hardening.test.js` - weekly visible consumer contract | old source-count guard | 15 occurrences | approved PDF alias | Historical guard drift |
| 44 | `tests/lot-5-46-weekly-rate-migration.test.js` - weekly/monthly tenth occurrence | old baseline 14 | 15 | approved PDF alias | Historical guard drift |
| 45 | `tests/lot-5-47-extended-stabilization.test.js` - tenth fiscalSummaryVisibleSlice occurrence | old baseline 14 | 15 | approved PDF alias | Historical guard drift |
| 46 | `tests/lot-5-48-weekly-rate-migration-validation.test.js` - Shadow baseline | old baseline 14 | 15 | approved PDF alias | Historical guard drift |
| 47 | `tests/lot-5-49-weekly-rate-stabilization.test.js` - Shadow baseline/monthly reflection occurrences | old baseline 14 | 15 | approved PDF alias | Historical guard drift |
| 48 | `tests/lot-5-51-monthly-reflection-revenue-migration.test.js` - twelve Shadow occurrences | old count guard | 15 | approved later migrations plus PDF alias | Historical guard drift |
| 49 | `tests/lot-5-53-monthly-reflection-revenue-migration-validation.test.js` - baseline twelve | old count guard | 15 | approved later migrations plus PDF alias | Historical guard drift |
| 50 | `tests/lot-5-54-monthly-reflection-revenue-stabilization.test.js` - baseline twelve | old count guard | 15 | approved later migrations plus PDF alias | Historical guard drift |
| 51 | `tests/lot-5-56-monthly-reflection-charges-migration.test.js` - twelve Shadow occurrences | old count guard | 15 | approved later migrations plus PDF alias | Historical guard drift |
| 52 | `tests/lot-5-57-extended-stabilization.test.js` - Shadow baseline twelve | old count guard | 15 | approved later migrations plus PDF alias | Historical guard drift |
| 53 | `tests/lot-5-58-monthly-reflection-charges-migration-validation.test.js` - Shadow baseline twelve | old count guard | 15 | approved later migrations plus PDF alias | Historical guard drift |
| 54 | `tests/lot-5-59-monthly-reflection-charges-stabilization.test.js` - monthly reflection stable after twelfth | old count guard | 15 | approved later migrations plus PDF alias | Historical guard drift |
| 55 | `tests/lot-5-61-smart-alert-reserve-low-parity-evidence.test.js` - parity evidence intact | old baseline 14 | 15 | approved PDF alias | Historical guard drift |
| 56 | `tests/lot-5-63-smart-alert-reserve-low-migration.test.js` - sensitive boundaries Legacy/unchanged | PDF expected direct `savingsGoal` | PDF no longer direct `savingsGoal` | approved PDF migration | Historical guard drift |
| 57 | `tests/lot-5-63-smart-alert-reserve-low-migration.test.js` - baseline twelve/exact twelfth | old count guard | 15 | approved later migrations plus PDF alias | Historical guard drift |
| 58 | `tests/lot-5-64-extended-stabilization.test.js` - reserve-low Shadow baseline | old baseline 14 | 15 | approved PDF alias | Historical guard drift |
| 59 | `tests/lot-5-65-smart-alert-reserve-low-migration-validation.test.js` - baseline thirteen | old count guard | 15 | approved later migrations plus PDF alias | Historical guard drift |
| 60 | `tests/lot-5-66-smart-alert-reserve-low-stabilization.test.js` - baseline thirteen | old count guard | 15 | approved later migrations plus PDF alias | Historical guard drift |
| 61 | `tests/lot-5-68-smart-alert-rawavailable-revenue-parity-evidence.test.js` - source-only revenue migration | old baseline 14 | 15 | approved PDF alias | Historical guard drift |
| 62 | `tests/lot-5-70-smart-alert-rawavailable-revenue-migration.test.js` - baseline thirteen/exact thirteenth | old count guard | 15 | approved PDF alias | Historical guard drift |
| 63 | `tests/lot-5-72-smart-alert-rawavailable-revenue-migration-validation.test.js` - baseline thirteen/no fourteenth | old no-fourteenth guard | 15 | approved coaching plus PDF aliases | Historical guard drift |
| 64 | `tests/lot-5-73-smart-alert-rawavailable-revenue-stabilization.test.js` - baseline after coaching occurrence | old baseline 14 | 15 | approved PDF alias | Historical guard drift |
| 65 | `tests/lot-5-77-savingsgoal-coaching-parity-evidence.test.js` - PDF export untouched/out of coaching | direct PDF `savingsGoal` | PDF `pdfSavingsGoal` | approved later PDF migration | Historical guard drift |
| 66 | `tests/lot-5-77-savingsgoal-coaching-parity-evidence.test.js` - coaching Shadow consumer and baseline fourteen | baseline 14 | 15 | approved PDF alias | Historical guard drift |
| 67 | `tests/lot-5-79-savingsgoal-coaching-migration.test.js` - Math.max multiplier/floor | one finalContributionAmount savings-goal alias in extracted region | two aliases: coaching + PDF | approved PDF alias placed after coaching alias | Historical guard drift |
| 68 | `tests/lot-5-79-savingsgoal-coaching-migration.test.js` - PDF export Legacy | direct PDF `savingsGoal` | PDF `pdfSavingsGoal` | approved PDF migration | Historical guard drift |
| 69 | `tests/lot-5-79-savingsgoal-coaching-migration.test.js` - Shadow baseline fourteen | 14 | 15 | approved PDF alias | Historical guard drift |
| 70 | `tests/lot-5-79-savingsgoal-coaching-migration.test.js` - no fifteenth occurrence/rollback local | no 15th | approved 15th PDF occurrence | approved PDF migration | Historical guard drift |
| 71 | `tests/lot-5-81-savingsgoal-coaching-migration-validation.test.js` - exact Shadow-backed coaching alias | one occurrence in old extraction block | two because old extraction now includes `pdfSavingsGoal` | approved PDF alias placement | Historical guard drift |
| 72 | `tests/lot-5-81-savingsgoal-coaching-migration-validation.test.js` - denominator contract/no new transform | one `finalContributionAmount * 3` in old alias block | two: coaching + PDF aliases | approved PDF alias | Historical guard drift |
| 73 | `tests/lot-5-81-savingsgoal-coaching-migration-validation.test.js` - Shadow baseline fourteen/no fifteenth | 14 and no 15th | 15 | approved PDF alias | Historical guard drift |
| 74 | `tests/lot-5-81-savingsgoal-coaching-migration-validation.test.js` - PDF export remains Legacy/isolated | direct PDF `savingsGoal` | PDF `pdfSavingsGoal` | approved PDF migration | Historical guard drift |

No failure was classified as a LOT 5.86 test defect, real runtime regression, pre-existing unrelated failure, or unknown failure.

## 5. Shadow Baseline Analysis

Current source-without-comments counts:

```txt
fiscalSummaryVisibleSlice = 15
savingsGoal = 1
pdfSavingsGoal = 5
fiscalCoachingSavingsGoal = 4
```

The 15th `fiscalSummaryVisibleSlice` occurrence is exactly:

```js
const pdfSavingsGoal = Math.max(
  fiscalSummaryVisibleSlice.finalContributionAmount * 3,
  500,
);
```

There is no 16th `fiscalSummaryVisibleSlice` occurrence.

Baseline failures are therefore obsolete guard expectations, not evidence of scope expansion.

## 6. Historical Guard Drift

The full suite still contains historical guards written before LOT 5.86A.

Drift classes:

| Drift class | Evidence | Affected failures |
| --- | --- | ---: |
| Shadow baseline still expects `14` | Actual source count is `15` | majority of count failures |
| Historical PDF still expects Legacy `savingsGoal` | Actual PDF denominator is `pdfSavingsGoal` | PDF/export failures |
| Historical block extraction starts at old LOT 5.29 comment | Actual comment is LOT 5.86A boundary | block-start failures |
| Historical savingsGoal lexical count expects `5` | Actual source count is `1` | Legacy count failures |
| Historical no-alias guard rejects `pdfSavingsGoal` | Actual alias is approved by LOT 5.86A | alias failures |
| Historical coaching alias extraction includes new PDF alias | Old end delimiter was `fiscalCoachingCard`; `pdfSavingsGoal` now sits before it | LOT 5.79/5.81 alias count failures |

All drift aligns with the approved LOT 5.86A migration.

## 7. SavingsGoal Guard Analysis

Current root:

```js
const savingsGoal = useMemo(() => {
  return Math.max(estimatedCharges * 3, 500);
}, [estimatedCharges]);
```

Current PDF denominator:

```js
typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0
  ? `${Math.round((savingsProgress / pdfSavingsGoal) * 100 || 0)}%`
  : "Pas encore assez de donnees"
```

The direct `savingsGoal` read disappeared only from the approved PDF `Objectif d epargne` consumer and its callback dependency list.

Root `savingsGoal` still exists. No other direct runtime consumer was removed by LOT 5.86A.

Historical guards expecting direct PDF `savingsGoal` are obsolete.

## 8. PDF Contract Analysis

Inspected PDF contract:

| Contract item | Current state | Result |
| --- | --- | --- |
| consumer | `handleExportPDF -> Projection -> Objectif d epargne` | expected |
| numerator | `savingsProgress` | unchanged |
| denominator | `pdfSavingsGoal` | approved source-only migration |
| denominator source | `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` | exact |
| division | `savingsProgress / pdfSavingsGoal` | ratio structure preserved |
| multiplier | `* 100` | unchanged |
| rounding | `Math.round(...)` | unchanged |
| inner fallback | `|| 0` | unchanged |
| fallback text | `Pas encore assez de donnees` source retains accented text | unchanged |
| formatter | trailing `%` | unchanged |
| cap | no `Math.min(100, ...)` in PDF consumer | unchanged |
| label | `Objectif d epargne` | unchanged |
| layout | same `3. Analyse` / `Projection` block | unchanged |

No real PDF behavior failure was observed in full suite output. The failures are source guards expecting the pre-migration denominator.

## 9. Root SavingsGoal Retention

Root `savingsGoal` is retained and unchanged.

The current source count `savingsGoal = 1` corresponds to the root definition after removing the approved direct PDF reads.

This matches LOT 5.86A scope. It does not indicate root deletion or global replacement.

## 10. Scope Integrity

Confirmed:

- `pdfSavingsGoal` exact;
- `fiscalSummaryVisibleSlice = 15`;
- no 16th occurrence;
- `savingsProgress` unchanged;
- PDF ratio structure unchanged;
- fallback unchanged;
- `Math.round` unchanged;
- `%` formatter unchanged;
- no PDF cap added;
- root `savingsGoal` unchanged;
- no other PDF output migrated;
- no persistence, payload, assistant, feedback or analytics propagation found.

No scope violation was identified.

## 11. Unrelated Failures

No failing test was classified as unrelated.

All 74 failures reference one of:

- `fiscalSummaryVisibleSlice` count drift;
- `savingsGoal` count drift;
- obsolete PDF Legacy denominator assertions;
- obsolete PDF boundary comment extraction;
- obsolete no-`pdfSavingsGoal` alias assertions.

No domain-only, adapter-only, facade-only, money/date, runtime evidence, or shadow parity test failed outside these historical guards.

## 12. Failure Classification Summary

| Classification | Count | Notes |
| --- | ---: | --- |
| A. Historical guard drift | 74 | all failures |
| B. LOT 5.86 test / guard defect | 0 | LOT 5.86 targeted guard passes and aligns with approved scope |
| C. Real runtime regression | 0 | no formula/contract/runtime mismatch found |
| D. Pre-existing unrelated failure | 0 | no unrelated failing file/test observed |
| E. Mixed | 0 | single class only |

## 13. Runtime Regression Assessment

Runtime regression assessment:

```txt
NO REAL RUNTIME REGRESSION IDENTIFIED
```

Reason:

- targeted LOT 5.86A validation already passed;
- source inspection confirms the denominator migration is exact;
- the PDF contract still has the same numerator, ratio, rounding, fallback, formatter, label and layout;
- root `savingsGoal` remains Legacy;
- full-suite failures are old source guards, not executable runtime behavior assertions.

## 14. Recommended Next LOT

Recommended next LOT:

```txt
GO POUR LOT 5.88 — EXTENDED STABILIZATION
```

Scope should be historical-guard stabilization only, following the LOT 5.80 pattern:

- update obsolete historical baselines from `14` to `15` only where the 15th occurrence is the approved `pdfSavingsGoal` alias;
- update obsolete PDF Legacy assertions to recognize the approved `pdfSavingsGoal` denominator;
- preserve root `savingsGoal` retention;
- preserve PDF ratio/fallback/rounding/formatter/no-cap guards;
- do not change runtime code.

## 15. Final Decision

GO POUR LOT 5.88 — EXTENDED STABILIZATION
