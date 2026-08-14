# LOT 5.90 - Targeted Lint Debt Correction Review

## 1. Executive Summary

LOT 5.90 is a documentation-only review of whether the root Legacy `savingsGoal` declaration in `src/App.jsx` (line 6441) can be safely removed in a future LOT.

No runtime code, test, guard, or configuration was modified. `savingsGoal` itself was not removed in this LOT.

Result:

```txt
READY FOR REMOVAL
```

The root `savingsGoal` declaration (`src/App.jsx:6441`) has zero remaining direct consumers, zero indirect consumers, zero dependency-array references, zero persistence/payload/assistant coupling, and its removal would eliminate exactly the `+1` lint error identified by LOT 5.89 -- restoring the historical `50/21/29` baseline with no other side effect.

## 2. Source and Authority

Authority documents read:

- `docs/LOT_5_75_SAVINGSGOAL_DEPENDENCY_ANALYSIS.md`
- `docs/LOT_5_76_SAVINGSGOAL_CONTRACT_HARDENING_REPORT.md`
- `docs/LOT_5_79_SAVINGSGOAL_COACHING_MIGRATION_REPORT.md`
- `docs/LOT_5_82_SAVINGSGOAL_COACHING_STABILIZATION_REPORT.md`
- `docs/LOT_5_84_SAVINGSGOAL_PDF_PARITY_EVIDENCE_REPORT.md`
- `docs/LOT_5_85_SAVINGSGOAL_PDF_MIGRATION_GATE_REVIEW.md`
- `docs/LOT_5_86_SAVINGSGOAL_PDF_MIGRATION_REPORT.md`
- `docs/LOT_5_89_GLOBAL_LINT_BASELINE_DRIFT_INVESTIGATION.md`

Inspected: `src/App.jsx` (declaration, all whole-word `savingsGoal` occurrences, dependency arrays, `fiscalCoachingSavingsGoal`, `pdfSavingsGoal`, PDF/export block, coaching block, JSX Objectif d'epargne block, persistence/Supabase/localStorage sections, `trackEvent` payloads), and `tests/` for guards referencing `savingsGoal`.

## 3. Declaration Exact

Current declaration (`src/App.jsx:6440-6444`):

```js
// LOT 5.29: Legacy savings goal source retained for UI, coaching and PDF boundaries.
const savingsGoal = useMemo(() => {
  // Objectif d'épargne recommandé: 3 mois de charges
  return Math.max(estimatedCharges * 3, 500);
}, [estimatedCharges]);
```

| Field | Value |
| --- | --- |
| hook | `useMemo` |
| formula | `Math.max(estimatedCharges * 3, 500)` |
| input | `estimatedCharges` (Legacy-derived, not Shadow) |
| dependency array | `[estimatedCharges]` |
| floor | `500` |
| rounding | none direct (inherited from `estimatedCharges`) |
| guarding comment | `LOT 5.29: Legacy savings goal source retained for UI, coaching and PDF boundaries` -- itself now stale prose, see section 11 |

No edit was made to this block.

## 4. Whole-Word Occurrence Check

Pattern searched: `\bsavingsGoal\b`.

In `src/App.jsx`:

```txt
6441:  const savingsGoal = useMemo(() => {
```

- executable reads: **0** (no read outside the declaration itself)
- declaration: **1** (line 6441)
- comments: **0** literal-identifier matches (the guarding comment on line 6440 uses the English phrase "savings goal", not the code token `savingsGoal`)

Elsewhere in `src/`: **0** occurrences outside `src/App.jsx` (checked recursively across `.js`/`.jsx`).

In `tests/`: 203 occurrences across 29 files (guard/assertion code only, not runtime).

In `docs/`: extensive references (expected -- these are historical LOT reports, not runtime).

This matches the expected state exactly: **1 executable occurrence = declaration only.** No STOP condition triggered.

## 5. Direct Consumer Check

Confirmed absent from every listed surface, verified by the single-occurrence result in section 4 (a variable with exactly one occurrence in the whole file cannot have a second-file read):

| Surface | Current denominator/source | Reads root `savingsGoal`? |
| --- | --- | --- |
| coaching (`fiscalCoachingCard` low-reserve) | `fiscalCoachingSavingsGoal` | no |
| PDF/export (`handleExportPDF` -> Objectif d'epargne) | `pdfSavingsGoal` | no |
| JSX Objectif d'epargne text/progress bar | inline `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` | no |
| smart alerts | `fiscalSummaryVisibleSlice`-derived fields only | no |
| summaries / dashboard | Shadow-backed fields | no |
| weekly recap | `fiscalSummaryVisibleSlice.effectiveRate` | no |
| monthly reflection | `fiscalSummaryVisibleSlice.revenueTotal` / `.finalContributionAmount` | no |
| obligations | `src/utils/obligations.js`, no `savingsGoal` reference (confirmed by src-wide search) | no |
| invoices / reminders | unrelated state | no |

## 6. Indirect Consumer Check

Searched for any variable derived from root `savingsGoal` (e.g. `const x = savingsGoal`, or a closure capturing it).

Result:

```txt
NONE
```

Because the declaration has exactly one occurrence in the file (section 4), no other expression can read it to produce a derived value. There is no second-order consumer.

## 7. Dependency Array Check

Searched all `useMemo` / `useEffect` / `useCallback` dependency arrays for `savingsGoal`.

Result:

```txt
ZERO remaining dependencies.
```

The only array that once carried it (`handleExportPDF`'s `useCallback` deps) was updated to `pdfSavingsGoal` at LOT 5.86A; the coaching `useMemo`/`useCallback` deps were updated to `fiscalCoachingSavingsGoal` at LOT 5.79A. The root's own dependency array (`[estimatedCharges]`) does not reference `savingsGoal` itself.

## 8. Persistence Check

Searched `localStorage`, `sessionStorage`, Supabase calls, persisted profile/draft state, and snapshot/history paths in `src/App.jsx` for `savingsGoal` or a value derived from it.

Result:

```txt
NONE
```

This matches LOT 5.75's original finding (`NO direct persistence usage of savingsGoal`) and is now strictly stronger: LOT 5.75 found no persistence read even while `savingsGoal` still had 8 live consumers; today it has 0.

## 9. Payload / Assistant Check

Searched API payloads, feedback payloads, analytics/`trackEvent` payloads, assistant context/prompt building, exported JSON, and logs.

Result:

```txt
NONE
```

Confirmed directly: the `export_pdf` analytics event (`src/App.jsx:10147-10151`) sends only `source`, `totalRevenues`, `invoiceCount` -- no `savingsGoal`-derived field, unchanged since LOT 5.75/5.84/5.86.

## 10. Legacy Compatibility Layer Decision

LOT 5.76 established the root retention guard verbatim as:

```txt
Never replace global savingsGoal while either of these remains true:
- fiscalCoachingCard reads savingsGoal;
- handleExportPDF reads savingsGoal.
```

Current state, verified directly from source (sections 3-7):

- `fiscalCoachingCard` reads `fiscalCoachingSavingsGoal`, not `savingsGoal` -- condition false.
- `handleExportPDF` reads `pdfSavingsGoal`, not `savingsGoal` -- condition false.

Both conditions that the project's own established guard used to justify retention are now false. This is not a mechanical inference; it is the direct, literal application of the rule LOT 5.76 itself defined, using the current source state confirmed in sections 4-7.

Classification:

```txt
OBSOLETE COMPATIBILITY ROOT
```

The declaration is not "dead code by omission" -- it is a compatibility root whose own documented retention condition has been satisfied out of existence by the already-approved LOT 5.79A (coaching) and LOT 5.86A (PDF) migrations.

## 11. Formula Duplication Check

Comparison of the retained root against the three currently active aliases:

| Symbol | Formula | Input | Status |
| --- | --- | --- | --- |
| `savingsGoal` (root) | `Math.max(estimatedCharges * 3, 500)` | `estimatedCharges` (Legacy-derived) | dead -- 0 readers |
| `fiscalCoachingSavingsGoal` | `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` | `fiscalSummaryVisibleSlice.finalContributionAmount` (Shadow) | active -- coaching |
| `pdfSavingsGoal` | `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` | `fiscalSummaryVisibleSlice.finalContributionAmount` (Shadow) | active -- PDF |
| JSX Objectif d'epargne (text + bar) | inline `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` | `fiscalSummaryVisibleSlice.finalContributionAmount` (Shadow) | active -- UI |

The three active aliases share the same `Math.max(x * 3, 500)` shape but all read the **Shadow** input (`fiscalSummaryVisibleSlice.finalContributionAmount`). The root `savingsGoal` is the only remaining reader of the **Legacy** input (`estimatedCharges`) in this formula family, and it has no reader of its own.

Removing `savingsGoal` removes only this one dead Legacy-input formula. It requires no change to `fiscalCoachingSavingsGoal`, `pdfSavingsGoal`, or the inline JSX expressions -- each is self-contained and does not reference root `savingsGoal`.

## 12. Shadow Baseline

The root declaration's formula (`Math.max(estimatedCharges * 3, 500)`) contains no `fiscalSummaryVisibleSlice` token (confirmed in section 3's exact source excerpt).

Removing it therefore:

```txt
fiscalSummaryVisibleSlice = 15   (unchanged)
no 16th occurrence added or removed
```

A future removal LOT must not alter the Shadow baseline in any direction. This review confirms the declaration is entirely outside the Shadow occurrence count.

## 13. Lint Impact

Current `npm run lint` state (per LOT 5.89, re-confirmed unchanged since no file was edited between LOT 5.89 and this review):

```txt
51 problems (22 errors, 29 warnings)
```

The single error entry naming this symbol:

```txt
src/App.jsx:6441:9  error  'savingsGoal' is assigned a value but never used. Allowed unused vars must match /^[A-Z_]/u  no-unused-vars
```

No other error or warning in the current 51-problem list references `savingsGoal` by name (cross-checked against the full itemized list in `docs/LOT_5_89_GLOBAL_LINT_BASELINE_DRIFT_INVESTIGATION.md`, section 2).

Expected effect of removing exactly this declaration, with no other change:

```txt
51 problems (22 errors, 29 warnings)
->
50 problems (21 errors, 29 warnings)
```

This is an exact, single-error removal, restoring the LOT 5.80 baseline precisely -- not an estimate.

## 14. Historical Guards Impact

Guards whose assertions directly encode the root declaration text (`const savingsGoal = useMemo`) and/or an explicit "root savingsGoal remains Legacy" retention claim -- confirmed by direct pattern search, not assumed -- and that will need adjustment if a future LOT 5.91 removes the declaration:

```txt
tests/lot-5-29-savingsgoal-architecture-hardening.test.js
tests/lot-5-30-isolated-savingsgoal-ui-parity-evidence.test.js
tests/lot-5-32-isolated-savingsgoal-ui-migration.test.js
tests/lot-5-34-isolated-savingsgoal-ui-migration-validation.test.js
tests/lot-5-35-isolated-savingsgoal-ui-stabilization.test.js
tests/lot-5-37-objective-savings-progress-bar-migration.test.js
tests/lot-5-39-objective-savings-progress-bar-migration-validation.test.js
tests/lot-5-40-objective-savings-progress-bar-stabilization.test.js
tests/lot-5-56-monthly-reflection-charges-migration.test.js
tests/lot-5-57-extended-stabilization.test.js
tests/lot-5-58-monthly-reflection-charges-migration-validation.test.js
tests/lot-5-59-monthly-reflection-charges-stabilization.test.js
tests/lot-5-63-smart-alert-reserve-low-migration.test.js
tests/lot-5-65-smart-alert-reserve-low-migration-validation.test.js
tests/lot-5-66-smart-alert-reserve-low-stabilization.test.js
tests/lot-5-77-savingsgoal-coaching-parity-evidence.test.js
tests/lot-5-79-savingsgoal-coaching-migration.test.js
tests/lot-5-81-savingsgoal-coaching-migration-validation.test.js
tests/lot-5-82-savingsgoal-coaching-stabilization.test.js
tests/lot-5-84-savingsgoal-pdf-parity-evidence.test.js
tests/lot-5-86-savingsgoal-pdf-migration.test.js
tests/lot-5-88-extended-stabilization.test.js
```

22 files. A broader keyword scan (any whole-word `savingsGoal` reference at all, including alias-adjacent mentions, lexical-count assertions, and comment/string references) touches 29 files total; the 7 additional files (`lot-5-18` family is unaffected, but `lot-5-20/21/22/24/25/26`-style "next consumer migration" guards and count-only guards) reference the token more incidentally and were not individually opened in this review -- LOT 5.91, if launched, must re-verify each of the 29 before editing any of them, per this LOT's review-only scope.

No guard was modified in LOT 5.90.

## 15. Rollback

Future rollback (if LOT 5.91 removes the root and a revert is later needed):

```txt
restore exactly:

// LOT 5.29: Legacy savings goal source retained for UI, coaching and PDF boundaries.
const savingsGoal = useMemo(() => {
  // Objectif d'épargne recommandé: 3 mois de charges
  return Math.max(estimatedCharges * 3, 500);
}, [estimatedCharges]);
```

Scope:

```txt
src/App.jsx only, at the current line 6441 location.
```

No data migration required (nothing persists `savingsGoal`). No consumer modification required (`fiscalCoachingSavingsGoal`, `pdfSavingsGoal`, and the JSX inline expressions do not reference root `savingsGoal` and would not need to change either to remove it or to roll back its removal).

## 16. Readiness

```txt
READY FOR REMOVAL
```

Checklist:

| Requirement | Status |
| --- | --- |
| declaration-only (1 occurrence, no reads) | met |
| no direct consumers | met |
| no indirect consumers | met |
| no dependency arrays | met |
| no persistence | met |
| no payloads | met |
| no assistant | met |
| no export dependency | met |
| no coaching dependency | met |
| rollback local | met |
| lint impact exact (51/22/29 -> 50/21/29, single error) | met |

All eleven conditions are met with direct source evidence, not assumption.

## 17. Scope Control

Confirmed:

- no file under `src/` was modified;
- no test or guard was modified;
- no ESLint configuration or `package.json` script was modified;
- `savingsGoal` was not removed in this LOT;
- `npm run lint` was not re-executed unnecessarily -- the LOT 5.89 result was reused since no file changed between the two LOTs;
- `node --test`, `npm run build`, and Playwright were not run, per this LOT's authorized-commands scope.

## 18. Final Decision

Root `savingsGoal` is declaration-only, has no direct or indirect consumer, no dependency-array reference, no persistence/payload/assistant coupling, a purely local rollback, and an exactly predictable lint effect.

```txt
GO POUR LOT 5.91 — OBSOLETE SAVINGSGOAL ROOT REMOVAL
```
