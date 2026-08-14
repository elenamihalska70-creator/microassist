# LOT 5.88 - Extended Stabilization Report

## 1. Executive Summary

LOT 5.88 stabilized every historical guard made obsolete by the approved LOT 5.86A PDF denominator migration (`savingsGoal -> pdfSavingsGoal` in `handleExportPDF -> Objectif d'epargne`).

No runtime code was changed. `src/App.jsx`, `pdfSavingsGoal`, the root `savingsGoal` definition, `savingsProgress`, the PDF ratio/rounding/fallback/formatter/no-cap contract, `fiscalCoachingSavingsGoal`, and every Adapter/Facade/Domain/persistence/payload/assistant path remain byte-for-byte as they were after LOT 5.86A.

Result:

```txt
Full validation PASS on node --test, build, and both Playwright runs.
Global lint carries a pre-existing +1 problem unrelated to this LOT (see section 16).
```

## 2. Original 74 Failures

LOT 5.87 outside-sandbox `node --test` reported:

```txt
tests 862
pass 788
fail 74
```

This LOT re-ran the exact same command as its own ground truth before editing anything. The live result matched the LOT 5.87 inventory exactly: 74 unique failing test names, same distribution across the same 39 files.

## 3. Failure Classification

All 74 failures were historical guard drift, confirmed by direct inspection of each failing assertion:

| Drift class | Evidence |
| --- | --- |
| Shadow baseline still expects `14` | Actual source count is `15` |
| `fiscalSummaryVisibleSlice.finalContributionAmount * 3` still expects `3` | Actual count is `4` (the approved `pdfSavingsGoal` alias added a 4th) |
| Historical PDF guards still expect Legacy `savingsGoal` | Actual PDF denominator is `pdfSavingsGoal` |
| Historical PDF boundary extraction still keyed on the LOT 5.29 comment | Actual boundary comment is the LOT 5.86A comment |
| Historical `savingsGoal` lexical count still expects `5` | Actual source count is `1` (root definition only) |
| Historical "no `pdfSavingsGoal` alias" guards still reject it | `pdfSavingsGoal` is the LOT 5.86A-approved alias |
| LOT 5.79/5.81 coaching-alias extraction ranges still assume one alias | The range now contains two: `fiscalCoachingSavingsGoal` then `pdfSavingsGoal` |
| "Outside visible-slice selector" `finalContributionAmount` counts still expect `6` | Actual count is `7` (the PDF alias definition sits outside the selector) |

No failure was a LOT 5.86 test defect, a real runtime regression, or unrelated to the migration.

## 4. Historical Guards Updated

Exactly the 39 files named in the LOT 5.87 inventory were edited, and no file outside that set was touched. Per file, updates were limited to: baseline-count literals, PDF denominator identifiers/regex, PDF boundary-comment extraction anchors, coaching-alias extraction range assertions (now naming both approved aliases), and the small number of downstream cross-file quote checks that assert an earlier LOT file's own source text (e.g. `LOT_5_18_SOURCE` regex checks embedded in LOT 5.21/5.22/5.25/5.26/5.65).

No assertion was deleted. No guard was weakened to a vague check. Every "root `savingsGoal` still exists" retention assertion was preserved; only its expected *count* changed from `5` to `1`.

## 5. Old Shadow Baseline = 14

Before LOT 5.86A, the approved baseline was:

```txt
fiscalSummaryVisibleSlice = 14
```

## 6. New Shadow Baseline = 15

After LOT 5.86A, the approved baseline is:

```txt
fiscalSummaryVisibleSlice = 15
```

Recomputed independently in `tests/lot-5-88-extended-stabilization.test.js` from `sourceWithoutComments(APP_SOURCE)`, not hardcoded against a comment.

## 7. Fifteenth Consumer Signature

The newest approved consumer (the one that raised the baseline from 14 to 15) is:

```js
const pdfSavingsGoal = Math.max(
  fiscalSummaryVisibleSlice.finalContributionAmount * 3,
  500,
);
```

Note on numbering: across the LOT 5.x guard series, "Nth occurrence" tracks the cumulative count of approved consumers introduced LOT by LOT, not raw left-to-right text position in `src/App.jsx` (`pdfSavingsGoal` is defined near the top of the component body, before later JSX consumers). `tests/lot-5-88-extended-stabilization.test.js` verifies this consumer by exact block content, consistent with how every prior LOT 5.x baseline guard verifies its own newest consumer.

## 8. No Sixteenth Occurrence

Confirmed in the new lock-in test:

```txt
fiscalSummaryVisibleSlice = 15
outside visible-slice selector = 14
no 16th occurrence
```

No stray 16th consumer was found in `src/App.jsx`.

## 9. pdfSavingsGoal Guard

`pdfSavingsGoal` occurs exactly `5` times in `src/App.jsx` (definition, `typeof` check, `> 0` check, division, and the `handleExportPDF` dependency array entry). Every historical "no `pdfSavingsGoal` alias" guard across the 39 files was updated to allow this approved alias while continuing to reject invented aliases (`uiSavingsGoal`, `coachingSavingsGoal`, `shadowSavingsGoal`).

## 10. Root SavingsGoal Retention

Root `savingsGoal` is retained, unchanged, and still asserted as present in every file that previously asserted it:

```js
const savingsGoal = useMemo(() => {
  return Math.max(estimatedCharges * 3, 500);
}, [estimatedCharges]);
```

Its lexical count in `src/App.jsx` is now `1` (the four direct PDF reads became the `pdfSavingsGoal` alias reads). No retention assertion was removed; only the expected count was corrected from `5` to `1`.

## 11. LOT 5.29 Comment Drift

The old LOT 5.29 PDF boundary comment (`// LOT 5.29 PDF boundary: export keeps the Legacy savingsGoal percentage contract.`) no longer exists in `src/App.jsx` -- it was already replaced by the approved LOT 5.86A comment (`// LOT 5.86A PDF boundary: source-only denominator migration.`) as part of the already-merged migration. Every guard file whose block-extraction helper (`pdfSavingsGoalBranch()` / `pdfObjectifLineBlock()`) was keyed on the old comment had its extraction anchor updated to the current comment. `src/App.jsx` itself was never touched to satisfy a guard.

## 12. PDF Contract Integrity

Verified unchanged across every updated file and locked in again in `tests/lot-5-88-extended-stabilization.test.js`:

| Contract item | State |
| --- | --- |
| numerator | `savingsProgress` (unchanged) |
| denominator | `pdfSavingsGoal` (approved) |
| rounding | `Math.round(...)` (unchanged) |
| inner fallback | `\|\| 0` (unchanged) |
| fallback text | `"Pas encore assez de données"` (unchanged) |
| formatter | trailing `%` (unchanged) |
| cap | no `Math.min(100, ...)` in the PDF consumer (unchanged) |
| label | `Objectif d'epargne` (unchanged) |

## 13. Targeted Validation

```txt
node --test tests/lot-5-86-savingsgoal-pdf-migration.test.js
node --test tests/lot-5-84-savingsgoal-pdf-parity-evidence.test.js
node --test tests/lot-5-82-savingsgoal-coaching-stabilization.test.js
node --test tests/shadow-parity-validation.test.js
node --test tests/runtime-parity-evidence.test.js
node --test tests/lot-5-88-extended-stabilization.test.js
```

Result:

```txt
PASS - 71/71 combined
```

Targeted ESLint on all 39 modified files plus the newly created `tests/lot-5-88-extended-stabilization.test.js`:

```txt
PASS - 0 problems
```

## 14. Full Node Suite

```txt
node --test
```

Sandbox result: `spawn EPERM` (known condition). Relaunched with `dangerouslyDisableSandbox: true`, mirroring the accepted workflow from prior LOTs.

Outside-sandbox result:

```txt
tests 870
pass 870
fail 0
```

870 = the original 862 total plus the 8 new tests added in `tests/lot-5-88-extended-stabilization.test.js`.

## 15. Build

```txt
npm run build
```

Result: `PASS` (`vite build`, `358 modules transformed`, built in `3.98s`). The known pre-existing Vite chunk-size-over-500kB warning is present and is not treated as a failure.

## 16. Global Lint

```txt
npm run lint
```

Result:

```txt
51 problems (22 errors, 29 warnings)
```

Expected baseline per this LOT's instructions was `50 problems (21 errors, 29 warnings)`. This is a `+1 error` delta.

Investigation: `git diff --stat 622f931 -- src/App.jsx` confirms `src/App.jsx` already carried uncommitted changes (198 insertions / 144 deletions) before LOT 5.88 began -- the accumulated, not-yet-committed work of LOT 5.86A and earlier LOTs in this working tree. LOT 5.88 made zero edits under `src/`. The two `no-unused-vars` errors observed (`handleExportLimitHit`, `handleDownloadTxt` in `src/App.jsx`) sit outside every block this LOT extracted or referenced (`handleExportPDF`, the PDF `Objectif d'epargne` line, the coaching/root `savingsGoal` blocks). Targeted ESLint on all 39 files this LOT touched plus the new `tests/lot-5-88-extended-stabilization.test.js` is clean (0 problems; see section 13). The lint delta therefore predates this LOT and is not attributable to LOT 5.88's guard-only changes; it reflects that the `50`-problem baseline quoted for this LOT was measured before this working tree's already-uncommitted `src/App.jsx` state.

## 17. Playwright Run 1

```txt
npx playwright test --reporter=line
```

Result:

```txt
11 passed (16.1s)
```

## 18. Playwright Run 2

```txt
npx playwright test --reporter=line
```

Repeated exactly. Result:

```txt
11 passed (13.8s)
```

## 19. Rollback

Rollback remains local:

```txt
pdfSavingsGoal -> savingsGoal
```

Only inside:

```txt
handleExportPDF -> Objectif d'epargne percentage denominator
```

No data migration, no global PDF change. LOT 5.88 itself has no rollback surface of its own: it only corrected historical test assertions to match the already-approved LOT 5.86A source shape. Reverting LOT 5.88 would simply restore the 74 obsolete guard failures against unchanged `src/App.jsx`.

## 20. Scope Control

Confirmed:

- no file under `src/` was read-then-edited or written in this LOT;
- exactly the 39 files named in the LOT 5.87 inventory were edited, no others;
- one new test file was created (`tests/lot-5-88-extended-stabilization.test.js`);
- one new report file was created (this file);
- no test file was deleted;
- no assertion was deleted or replaced with a vague `toBeTruthy()`-style check;
- every count correction was verified against the live source (via targeted single-file `node --test` runs) before being accepted, not applied as a blind `14 -> 15` replace-all;
- `pdfSavingsGoal`, root `savingsGoal`, `savingsProgress`, the PDF ratio/rounding/fallback/formatter/no-cap contract, and the LOT 5.86A boundary comment were never touched, only referenced.

## 21. Final Decision

All guard, node-suite, build, and Playwright validation is clean: 870/870 tests pass, build succeeds, and both Playwright runs are 11/11. The single open item is a `+1` global lint delta (51 vs. the 50-problem baseline quoted for this LOT), traced to `src/App.jsx` changes that were already uncommitted in this working tree before LOT 5.88 began and that this LOT never touched (targeted ESLint on every file this LOT modified or created is 0 problems). Because the full-validation gate for this LOT explicitly requires the global lint count not to increase from the stated baseline, and it did (through no edit made in this LOT), validation was not completed fully clean against the letter of that gate.

NO-GO POUR LOT 5.89
