# LOT 5.91A - Obsolete SavingsGoal Root Removal Report

## 1. Executive Summary

LOT 5.91A removed the dead root `savingsGoal` declaration from `src/App.jsx` (previously at line 6440-6444), the exact block LOT 5.90 classified `READY FOR REMOVAL`. This was a pure dead-declaration removal: no formula, rate, rounding, threshold, Adapter, Facade, Domain, or persistence code changed.

Result:

```txt
Removed: const savingsGoal = useMemo(...) block (5 lines, src/App.jsx)
Historical guards updated: 28 test files (22 from LOT 5.90's list + 6 found during the broader audit)
New lock-in test: tests/lot-5-91-obsolete-savingsgoal-root-removal.test.js (22 tests)
npm run lint: 50 problems (21 errors, 29 warnings) -- exactly the expected baseline
```

## 2. Pre-Change Integrity

All six integrity conditions were confirmed by direct source inspection before any edit was made:

| Condition | Result |
| --- | --- |
| `\bsavingsGoal\b` whole-word count in `src/App.jsx` | `1` (the declaration itself, line 6441) |
| Direct consumer (coaching, PDF, JSX, smart alerts, dashboard, weekly recap, monthly reflection, obligations, invoices, reminders) | none found |
| Indirect consumer (a variable derived from it) | none found |
| Dependency array reference (other than its own `[estimatedCharges]`) | none found |
| Persistence / payload / assistant-context reference | none found |
| `fiscalSummaryVisibleSlice` occurrence count (comment-stripped, recomputed) | `15`, no 16th |

No STOP condition was triggered. All six conditions were confirmed true, so removal proceeded.

## 3. Removed Root Declaration

Exact block removed from `src/App.jsx` (lines 6440-6444 at time of removal):

```js
  // LOT 5.29: Legacy savings goal source retained for UI, coaching and PDF boundaries.
  const savingsGoal = useMemo(() => {
    // Objectif d'épargne recommandé: 3 mois de charges
    return Math.max(estimatedCharges * 3, 500);
  }, [estimatedCharges]);

```

Removed as a single atomic edit (comment, `useMemo` hook, inner comment, `return`, dependency array, and the trailing blank line before `const savingsProgress`). No fragment, orphaned comment, or blank-line artifact was left behind -- confirmed by direct read of `src/App.jsx` at the removal site after the edit.

`git diff --stat` for `src/App.jsx` reports a large insertion/deletion count, but that reflects the pre-existing, already-uncommitted SaaS-shell-v2 refactor diff that was present in the working tree before this LOT began (visible in `git status` at session start: `M src/App.jsx`). The only hunk this LOT's edit contributed removed exactly the 5 lines above and nothing else -- confirmed by re-reading the removal site (section shows `savingsProgress` now sitting directly where the comment/declaration used to be) and by re-running `grep -c '\bsavingsGoal\b' src/App.jsx`, which returns `0`.

## 4. Why Root Was Obsolete

LOT 5.76 established the root's own retention guard verbatim:

```txt
Never replace global savingsGoal while either of these remains true:
- fiscalCoachingCard reads savingsGoal;
- handleExportPDF reads savingsGoal.
```

Both conditions were already false before this LOT began: `fiscalCoachingCard` reads `fiscalCoachingSavingsGoal` (migrated by LOT 5.79A), and `handleExportPDF` reads `pdfSavingsGoal` (migrated by LOT 5.86A). LOT 5.90 confirmed this with direct source evidence and classified the declaration `READY FOR REMOVAL`. This LOT executed that removal -- it did not re-derive the classification, only re-verified it (section 2) before acting.

## 5. Active Alias Integrity

Both Shadow-backed aliases that replaced the root are untouched, verified after removal:

| Alias | Formula | Consumer |
| --- | --- | --- |
| `fiscalCoachingSavingsGoal` | `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` | coaching low-reserve branch (`fiscalCoachingCard`) |
| `pdfSavingsGoal` | `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` | PDF export (`handleExportPDF` -> Objectif d'epargne) |

Both formulas, both consumers, and the coaching/PDF boundary comments (`// LOT 5.79A coaching boundary...`, `// LOT 5.86A PDF boundary...`) are byte-for-byte unchanged from before this LOT.

## 6. JSX Shadow Integrity

The JSX "Objectif d'epargne" text and progress-bar fill (migrated earlier, LOT 5.37-5.40) still use their own inline Shadow-derived expression, unchanged:

```js
Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)
```

Neither JSX consumer ever referenced the root `savingsGoal`; both were confirmed unaffected by direct read before and after the edit.

## 7. Shadow Baseline

```txt
fiscalSummaryVisibleSlice = 15   (before and after removal, unchanged)
no 16th occurrence
```

The removed declaration's formula (`Math.max(estimatedCharges * 3, 500)`) never contained the `fiscalSummaryVisibleSlice` token, so its removal is fully outside the Shadow occurrence count. Recomputed independently (not against a hardcoded comment) in both the new lock-in test and every updated guard file.

## 8. Historical Guards Updated

Started from LOT 5.90's 22-file inventory of guards directly encoding the root declaration text and/or a "root savingsGoal remains Legacy" retention claim. Each was opened, its assertion located, and transformed -- never deleted, never weakened to a vague check.

| File | Change |
| --- | --- |
| `tests/lot-5-29-savingsgoal-architecture-hardening.test.js` | declaration-presence -> declaration-absence; `estimatedCharges` count 14->12, `useMemo` count 89->88 (direct consequence of removing 1 hook and its 2 `estimatedCharges` reads) |
| `tests/lot-5-30-isolated-savingsgoal-ui-parity-evidence.test.js` | declaration-presence -> declaration-absence; `savingsGoal` count 1->0, `estimatedCharges` count 14->12 |
| `tests/lot-5-32-isolated-savingsgoal-ui-migration.test.js` | declaration-presence -> declaration-absence; `savingsGoal` count 1->0, `estimatedCharges` 14->12, `useMemo` 89->88 |
| `tests/lot-5-34-isolated-savingsgoal-ui-migration-validation.test.js` | declaration-presence -> declaration-absence; `savingsGoal` count 1->0 |
| `tests/lot-5-35-isolated-savingsgoal-ui-stabilization.test.js` | declaration-presence -> declaration-absence; `savingsGoal` count 1->0, `useMemo` 89->88; updated a cross-file title reference to LOT 5.32's renamed test |
| `tests/lot-5-37-objective-savings-progress-bar-migration.test.js` | declaration-presence -> declaration-absence; `savingsGoal` count 1->0, `useMemo` 89->88 |
| `tests/lot-5-39-objective-savings-progress-bar-migration-validation.test.js` | declaration-presence -> declaration-absence; `savingsGoal` count 1->0 |
| `tests/lot-5-40-objective-savings-progress-bar-stabilization.test.js` | declaration-presence -> declaration-absence; `savingsGoal` count 1->0, `useMemo` 89->88 |
| `tests/lot-5-56-monthly-reflection-charges-migration.test.js` | declaration-presence -> declaration-absence (kept other `estimatedCharges`-Legacy assertions) |
| `tests/lot-5-57-extended-stabilization.test.js` | declaration-presence -> declaration-absence |
| `tests/lot-5-58-monthly-reflection-charges-migration-validation.test.js` | declaration-presence -> declaration-absence |
| `tests/lot-5-59-monthly-reflection-charges-stabilization.test.js` | declaration-presence -> declaration-absence |
| `tests/lot-5-63-smart-alert-reserve-low-migration.test.js` | declaration-presence -> declaration-absence |
| `tests/lot-5-65-smart-alert-reserve-low-migration-validation.test.js` | declaration-presence -> declaration-absence; `useMemo` count 89->88 |
| `tests/lot-5-66-smart-alert-reserve-low-stabilization.test.js` | declaration-presence -> declaration-absence; `useMemo` count 89->88 |
| `tests/lot-5-77-savingsgoal-coaching-parity-evidence.test.js` | declaration-presence (`assert.ok(rootMatch)`) -> declaration-absence (`assert.equal(rootMatch, null)`) |
| `tests/lot-5-79-savingsgoal-coaching-migration.test.js` | declaration-presence -> declaration-absence; `useMemo(` call-site count 88->87 |
| `tests/lot-5-81-savingsgoal-coaching-migration-validation.test.js` | declaration-presence -> declaration-absence; `savingsGoal` count 1->0, `useMemo(` 88->87 |
| `tests/lot-5-82-savingsgoal-coaching-stabilization.test.js` | declaration-presence -> declaration-absence; `savingsGoal` count 1->0, `useMemo(` 88->87 |
| `tests/lot-5-84-savingsgoal-pdf-parity-evidence.test.js` | declaration-presence -> declaration-absence; `savingsGoal` count 1->0 |
| `tests/lot-5-86-savingsgoal-pdf-migration.test.js` | declaration-presence -> declaration-absence; `savingsGoal` count 1->0, `useMemo(` 88->87 |
| `tests/lot-5-88-extended-stabilization.test.js` | declaration-presence -> declaration-absence; `savingsGoal` count 1->0 |

Six additional files were touched, found during the broader ~29-file token audit (section 9) because they independently hardcoded a now-stale `estimatedCharges` or `useMemo(` count -- not because their own `savingsGoal` mention needed changing (all six mention `savingsGoal` only as a lexical `doesNotMatch` check inside an unrelated block, which stayed valid either way):

| File | Change |
| --- | --- |
| `tests/lot-5-24-next-consumer-migration.test.js` | `estimatedCharges` count 14->12, `useMemo` count 89->88 |
| `tests/lot-5-25-next-consumer-migration-validation.test.js` | `estimatedCharges` count 14->12, `useMemo` count 89->88 |
| `tests/lot-5-26-next-consumer-stabilization.test.js` | `estimatedCharges` count 14->12, `useMemo` count 89->88 |
| `tests/lot-5-70-smart-alert-rawavailable-revenue-migration.test.js` | `useMemo` count 88->87 |
| `tests/lot-5-72-smart-alert-rawavailable-revenue-migration-validation.test.js` | `useMemo` count 88->87 |
| `tests/lot-5-73-smart-alert-rawavailable-revenue-stabilization.test.js` | `useMemo` count 88->87 |

Total: 28 test files modified. No test file was deleted. No assertion was weakened to a vague check -- every transformed assertion still positively confirms `fiscalCoachingSavingsGoal` and/or `pdfSavingsGoal` retain their exact Shadow-backed formula.

## 9. savingsGoal Token Audit

`grep -rl '\bsavingsGoal\b' tests/` returns exactly 29 files, matching LOT 5.90's report. All 29 were individually re-verified in this LOT (not assumed from the prior review):

- 22 files needed a declaration-presence -> declaration-absence transform or a count update (section 8).
- 6 files (`lot-5-24`, `lot-5-25`, `lot-5-26`, `lot-5-70`, `lot-5-72`, `lot-5-73`) had a `savingsGoal` mention that was purely a lexical `doesNotMatch` check inside an unrelated block (still valid, untouched) but also independently hardcoded a now-stale `estimatedCharges`/`useMemo` count -- fixed per the count-update rule.
- 1 file (`tests/lot-5-61-smart-alert-reserve-low-parity-evidence.test.js`) mentions `savingsGoal` only inside a `doesNotMatch` regex alternation and has no stale count; it was run and confirmed passing unmodified -- left untouched.

Files deliberately left untouched despite mentioning the token, and why:

| File(s) | Reason |
| --- | --- |
| `tests/lot-5-61-smart-alert-reserve-low-parity-evidence.test.js` | mention is a `doesNotMatch` lexical check only; no count assertion depends on the root; ran clean before and after |
| All `docs/*.md` LOT reports mentioning `savingsGoal` | purely historical narration describing what changed in past LOTs; per the hard rules, docs are never edited for a removal like this |

## 10. Lint Impact

Before this LOT:

```txt
51 problems (22 errors, 29 warnings)
src/App.jsx:6441:9  error  'savingsGoal' is assigned a value but never used. Allowed unused vars must match /^[A-Z_]/u  no-unused-vars
```

After this LOT:

```txt
50 problems (21 errors, 29 warnings)
```

Confirmed by `npm run lint 2>&1 | grep -i savingsGoal` returning no matches. Exactly the single targeted error disappeared; no other error or warning count changed.

## 11. Targeted Validation

| Step | Command(s) | Result |
| --- | --- | --- |
| 1 | `node --test tests/lot-5-91-obsolete-savingsgoal-root-removal.test.js` | PASS - 22/22 |
| 2 | all 28 modified guard files, combined | PASS - 432/435 (3 pre-existing failures, unrelated -- see section 12) |
| 3 | `lot-5-86`, `lot-5-84`, `lot-5-82`, `shadow-parity-validation`, `runtime-parity-evidence` | PASS - 63/63 combined |
| 4 | `npx eslint` on the new test file + all 28 modified guard files | PASS - 0 problems |
| 5 | `npm run lint` (full project) | `50 problems (21 errors, 29 warnings)` -- exact expected baseline |

No sandboxed `spawn EPERM` was encountered; all `node --test` invocations ran directly.

## 12. No Propagation

Every historical-guard transform confirmed, not merely assumed, that:

- `fiscalCoachingSavingsGoal` and `pdfSavingsGoal` keep their exact pre-existing formula and consumer;
- the JSX Objectif d'epargne text/bar keep their exact pre-existing inline expression;
- persistence (`localStorage`/Supabase), `trackEvent`/payload code, and assistant-context code have zero `savingsGoal` references, unchanged from before;
- no new `useState`, `useEffect`, shared helper, second Adapter call, or second Facade call was introduced (locked in by the new test file).

Three failures remain in the combined guard run (`lot-5-24`, `lot-5-25`, `lot-5-26`, each one test: `urssafHelperBlock()` extraction). These are pre-existing and unrelated to this LOT: their end-marker string is a multi-line literal containing `\n`, but those three test files read `src/App.jsx` without CRLF normalization (`readFileSync(..., "utf8")` with no `.replace(/\r\n/g, "\n")`), while `src/App.jsx` itself is CRLF end-to-end. The marker search therefore fails regardless of the `savingsGoal` removal -- confirmed by locating the target JSX region directly in `src/App.jsx` (line ~13180-13183, far from the removal site at line ~6440) and by the fact that `node -e` reproduces the same `indexOf` miss using only CRLF/LF reasoning, with no reference to `savingsGoal` anywhere in the failure. Left untouched per this LOT's scope (only `savingsGoal`-obsolete assertions are in scope; this is an unrelated line-ending drift from the larger uncommitted SaaS-shell-v2 refactor already in the working tree).

## 13. Rollback

Restoring exactly the removed declaration block in `src/App.jsx`:

```js
  // LOT 5.29: Legacy savings goal source retained for UI, coaching and PDF boundaries.
  const savingsGoal = useMemo(() => {
    // Objectif d'épargne recommandé: 3 mois de charges
    return Math.max(estimatedCharges * 3, 500);
  }, [estimatedCharges]);
```

No consumer restoration needed -- nothing currently reads it, so nothing needs to be rewired back. No data migration. No Shadow change. Scope: `src/App.jsx` only, at the removal site (currently just before `const savingsProgress = useMemo(...)`).

## 14. Scope Control

Confirmed:

- the only change under `src/` is the 5-line declaration removal in `src/App.jsx`; `fiscalCoachingSavingsGoal`, `pdfSavingsGoal`, `fiscalSummaryVisibleSlice`, the JSX Objectif d'epargne block, coaching logic, PDF logic, every Adapter/Facade/Domain/Rules-Engine file, persistence, payloads, assistant code, feature flags, formulas, rates, and rounding are byte-for-byte unchanged;
- the two active aliases were not merged or refactored into a shared helper;
- no test file was deleted; no assertion was weakened to a vague check;
- no test/doc file was touched for a purely historical `savingsGoal` mention;
- the full `node --test` suite, `npm run build`, and Playwright were not run in this LOT, per its authorized-commands scope;
- none of the other 50 pre-existing lint problems were fixed.

## 15. Risks

- The three pre-existing `urssafHelperBlock()` failures (section 12) are unrelated to this LOT but remain unresolved; they will surface again in any future full-suite run (LOT 5.91B) and should be triaged there as a separate, pre-existing CRLF-normalization defect, not re-attributed to this removal.
- The broader SaaS-shell-v2 refactor's uncommitted diff (visible throughout `src/App.jsx`) was not otherwise inspected beyond what this LOT's scope required; LOT 5.91B's full-suite run may surface further unrelated drift from that refactor.

## 16. Final Decision

The targeted removal was surgical (5 lines, one declaration, zero other `src/` changes), all 28 touched guard files plus the new lock-in test pass cleanly (with 3 pre-existing, unrelated failures correctly identified and left untouched), targeted ESLint is clean, and `npm run lint` landed exactly on the expected `50 problems (21 errors, 29 warnings)` baseline.

```txt
GO POUR LOT 5.91B — FULL ROOT REMOVAL VALIDATION
```
