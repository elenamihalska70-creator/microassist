# LOT 5.89 - Global Lint Baseline Drift Investigation

## 1. Executive Summary

LOT 5.89 investigated the `+1 error` lint delta left open by LOT 5.88 (`51 problems / 22 errors / 29 warnings` vs. the historically validated baseline `50 problems / 21 errors / 29 warnings`).

Investigation-only. No file under `src/`, no test, no guard, no ESLint configuration and no `package.json` script was modified.

Result:

```txt
Root cause identified with direct evidence.
The two symbols named in the LOT 5.89 kickoff (handleExportLimitHit, handleDownloadTxt)
are NOT the cause of the delta -- both are pre-existing dead code that already
existed, unused, in the repository's base commit, long before any LOT 5.x work.

The actual +1 is the root `savingsGoal` declaration itself
(`src/App.jsx:6441`), which became fully unused as a direct, mechanical
consequence of the approved LOT 5.86A PDF migration removing its last
remaining runtime reader.
```

Classification: **A. NEW LOT-RELATED LINT DEBT** (introduced by LOT 5.86A).

## 2. Current Lint Result

Command:

```txt
npm run lint
```

Result:

```txt
51 problems (22 errors, 29 warnings)
```

Full list of the 22 errors:

| # | Location | Symbol | Rule |
| ---: | --- | --- | --- |
| 1 | `src/App.jsx:1312:3` | `trialDaysLeft` | no-unused-vars |
| 2 | `src/App.jsx:1382:10` | `shouldSendTrialEndingEmail` | no-unused-vars |
| 3 | `src/App.jsx:1998:3` | `invoices` | no-unused-vars |
| 4 | `src/App.jsx:1999:3` | `reminderPrefs` | no-unused-vars |
| 5 | `src/App.jsx:3552:9` | `persistedPlan` | no-unused-vars |
| 6 | `src/App.jsx:3566:9` | `trialHasExpired` | no-unused-vars |
| 7 | `src/App.jsx:4276:18` | `saveReminderPreferences` | no-unused-vars |
| 8 | `src/App.jsx:5635:9` | `trustBadgeLabel` | no-unused-vars |
| 9 | `src/App.jsx:5877:9` | `chargesEstimateHelper` | no-unused-vars |
| 10 | `src/App.jsx:5880:9` | `availableEstimateHelper` | no-unused-vars |
| 11 | `src/App.jsx:6078:9` | `dashboardEmptyDataMessage` | no-unused-vars |
| 12 | `src/App.jsx:6107:9` | `reliabilityBadge` | no-unused-vars |
| 13 | `src/App.jsx:6441:9` | `savingsGoal` | no-unused-vars |
| 14 | `src/App.jsx:7055:9` | `dashboardThisWeekInsight` | no-unused-vars |
| 15 | `src/App.jsx:7093:9` | `dashboardPositiveMomentum` | no-unused-vars |
| 16 | `src/App.jsx:8436:9` | `shouldShowDashboardTopNudge` | no-unused-vars |
| 17 | `src/App.jsx:8684:9` | `dashboardMonthlyReflection` | no-unused-vars |
| 18 | `src/App.jsx:8905:10` | `handleReminderToggle` | no-unused-vars |
| 19 | `src/App.jsx:9790:10` | `handleExportLimitHit` | no-unused-vars |
| 20 | `src/App.jsx:10248:12` | `handleDownloadTxt` | no-unused-vars |
| 21 | `src/context/AuthContext.jsx:64:17` | (file export shape) | react-refresh/only-export-components |
| 22 | `src/components/InvoiceGenerator.jsx:73:17` | (file export shape) | react-refresh/only-export-components |

20 `no-unused-vars` errors + 2 `react-refresh/only-export-components` errors = 22 total, matching the `npm run lint` summary line exactly.

## 3. Historical Baseline

`docs/LOT_5_80_EXTENDED_STABILIZATION_REPORT.md`, section 14 ("Global Lint"), states verbatim:

```txt
npm run lint
50 problems
21 errors
29 warnings
```

with the note: *"This matches the expected historical lint baseline. No lint debt was corrected."*

The report does not include an itemized error list, only the totals -- so LOT 5.80 cannot be diffed error-by-error directly. LOT 5.89 instead reconstructed the LOT-5.80-era state of `src/App.jsx` by inspecting what changed in the working tree since then (see section 7).

## 4. Delta

```txt
50 -> 51 problems   (+1)
21 -> 22 errors     (+1)
29 -> 29 warnings   (0)
```

The delta is exactly one new error. Warnings are unchanged, so the drift is isolated to a single `no-unused-vars`-class (or equivalent) error.

## 5. handleExportLimitHit Analysis

Definition (`src/App.jsx:9790`):

```js
function handleExportLimitHit(currentUsage = monthlyExportUsage) {
  const remaining = Math.max(
    0,
    FREE_EXPORTS_PER_MONTH - Number(currentUsage?.total || 0)
  );

  trackEvent("export_limit_hit", {
    source: "exports_limit",
    usedExports: Number(currentUsage?.total || 0),
    remainingExports: remaining,
    totalRevenues: filteredRevenues.length,
    invoiceCount: visibleInvoices.length,
  });
  openPremiumModal("exports_limit");
}
```

Occurrences of `handleExportLimitHit` in current `src/App.jsx`: **1** (the definition only; no call site, no JSX reference, no dependency-array reference anywhere in the file).

Is it really unused: **yes**, confirmed by whole-word search across the full file.

Is this recent in the working-tree diff: **no**. The identical function body exists at line 9668 in the repository's base commit (`622f931`, "chore: stable version before SaaS architecture refactor" -- the commit every LOT 5.x change in this working tree is layered on top of, uncommitted). Occurrence count in that base commit is also exactly **1**.

Which change removed its last usage: **none found in this working tree**. It was already a zero-call-site function in the base commit, before any LOT 5.x work began. It is unrelated to LOT 5.86A or to any migration in this series.

## 6. handleDownloadTxt Analysis

Definition (`src/App.jsx:10248`):

```js
function handleDownloadTxt() {
  const content =
    buildFiscalSummary(answers, computed) +
    "\n\n" +
    buildFiscalChecklist(computed);

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "plan-action-mvp.txt";
  a.click();

  URL.revokeObjectURL(url);
}
```

Occurrences of `handleDownloadTxt` in current `src/App.jsx`: **1** (definition only).

Is it really unused: **yes**, confirmed by whole-word search.

Is this recent in the working-tree diff: **no**. Identical body exists at line 10125 in the base commit `622f931`, also with exactly **1** occurrence there.

Which change removed its last usage: **none found in this working tree**. Same conclusion as section 5 -- pre-existing dead code, unrelated to LOT 5.86A or any LOT 5.x migration.

## 7. Relevant App.jsx Diff Analysis

`handleExportLimitHit` and `handleDownloadTxt` were excluded from further diff analysis once section 5/6 established they are byte-identical, already-unused code present since the base commit.

Instead, the investigation traced the one variable whose usage count actually changed across the LOT 5.x series and that lint now flags: root `savingsGoal`.

Whole-word occurrences of `savingsGoal` in `src/App.jsx`:

Base commit (`622f931`), 9 occurrences:

```txt
6334:  const savingsGoal = useMemo(() => {
6399:      savingsGoal > 0 &&
6400:      savingsProgress < savingsGoal * 0.35
6452:    savingsGoal,
9879:        typeof savingsGoal !== "undefined" && savingsGoal > 0
9880:          ? `${Math.round((savingsProgress / savingsGoal) * 100 || 0)}%`
10009:  savingsGoal,
14534:                          Math.round((savingsProgress / savingsGoal) * 100),
14543:                          width: `${Math.min(100, Math.round((savingsProgress / savingsGoal) * 100))}%`,
```

Current working tree, 1 occurrence:

```txt
6441:  const savingsGoal = useMemo(() => {
```

Every real reader of root `savingsGoal` present in the base commit -- the coaching low-reserve check (line 6399-6400), its `useCallback`/`useMemo` dependency-array entries (6452, 10009), the PDF export percentage (9879-9880), and the JSX savings-progress-bar percentage/width (14534, 14543) -- has been migrated away across the approved LOT 5.x series:

- coaching low-reserve -> `fiscalCoachingSavingsGoal` (approved LOT 5.79A);
- JSX savings-progress-bar -> a Shadow-backed alias (approved LOT 5.37/5.39/5.40 series);
- PDF export percentage -> `pdfSavingsGoal` (approved LOT 5.86A, per `docs/LOT_5_86_SAVINGSGOAL_PDF_MIGRATION_REPORT.md` sections 3-4).

The PDF export was the **last** remaining reader of root `savingsGoal` (LOT 5.86A's own "Consumer Before" block in its report shows `typeof savingsGoal !== "undefined" && savingsGoal > 0 ... savingsProgress / savingsGoal ...`). Once LOT 5.86A replaced that read with `pdfSavingsGoal`, root `savingsGoal` had zero remaining readers anywhere in the file -- only its own declaration -- which is exactly what ESLint's `no-unused-vars` now flags at line 6441.

## 8. LOT 5.86A Attribution Check

At the point of the LOT 5.80 baseline (`50/21/29`), the coaching migration (5.79A) and the JSX progress-bar migration (5.37-5.40 series) had already landed, but the PDF export still read root `savingsGoal` directly (this is confirmed both by the base-commit occurrence list above and by LOT 5.86A's own report, section 3, "Consumer Before"). At that point `savingsGoal` still had a live reader (the PDF export), so ESLint's `no-unused-vars` did not flag it -- consistent with the LOT 5.80 baseline having 21, not 22, errors.

LOT 5.86A (per `docs/LOT_5_86_SAVINGSGOAL_PDF_MIGRATION_REPORT.md`, sections 3-4 and 15) changed exactly the PDF denominator, replacing the direct `savingsGoal` read with `pdfSavingsGoal`. That was the sole and final remaining runtime reader of root `savingsGoal`. Removing it is precisely what caused `savingsGoal` to become unused.

This is an approved, intentional, in-scope change per LOT 5.86A -- it did not touch the `savingsGoal` declaration itself and root `savingsGoal` retention was explicitly preserved (per LOT 5.86A/5.87/5.88, section "Root SavingsGoal Retention" in each). The migration simply had a side effect that the retained declaration is no longer read by anything, which is a new, real, and directly attributable `no-unused-vars` error.

Arithmetic check: 20 current `no-unused-vars` errors minus the newly-unused `savingsGoal` = 19 pre-existing `no-unused-vars` errors, plus the 2 stable `react-refresh/only-export-components` errors (in `src/context/AuthContext.jsx` and `src/components/InvoiceGenerator.jsx`, both confirmed unmodified in this working tree via `git status --short`) = 21, matching the LOT 5.80 baseline exactly. Adding the new `savingsGoal` error back gives the current 22. The arithmetic is internally consistent with a single, isolated, attributable +1.

## 9. ESLint Configuration Check

- `eslint.config.js` (flat config, single file in the repo root) shows **no uncommitted changes**: `git status --short` for `eslint.config.js` returns no output.
- The active rule is confirmed unchanged: `'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }]`, which matches the "Allowed unused vars must match /^[A-Z_]/u" suffix seen on every `no-unused-vars` error message in section 2 -- the rule configuration is exactly what produced both the LOT 5.80 baseline and the current result.
- `package.json`'s `"lint": "eslint ."` script shows **no uncommitted changes**: `git diff -- package.json` returns no output.
- No lint-related dependency (`eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, etc.) shows any uncommitted change in `package.json` / lockfile.

Conclusion: **no configuration drift**. The delta is not caused by a rule, script, or dependency change.

## 10. Root Cause Classification

```txt
A. NEW LOT-RELATED LINT DEBT
```

Evidence summary:

- the delta is exactly `+1` error, `0` warnings;
- `handleExportLimitHit` and `handleDownloadTxt` (the two symbols named in the LOT 5.89 kickoff) are **not** the cause -- both are pre-existing dead code, byte-identical and already zero-call-site in the base commit `622f931`, unrelated to any LOT 5.x migration;
- the real newly-unused symbol is root `savingsGoal` (`src/App.jsx:6441`), which had 9 occurrences (1 declaration + 8 real reads) in the base commit and has exactly 1 (declaration only) in the current working tree;
- every prior reader of `savingsGoal` was migrated away by earlier, already-approved LOTs (coaching at 5.79A, JSX progress bar at 5.37-5.40); the PDF export (migrated at 5.86A) was demonstrably the last one, per LOT 5.86A's own "Consumer Before" documentation;
- ESLint configuration, rule set and lint script are all unchanged;
- the arithmetic (19 pre-existing + 2 stable react-refresh + 1 new `savingsGoal` = 22, vs. 19 + 2 = 21 at LOT 5.80) is internally consistent with a single, isolated, directly attributable new error.

## 11. Runtime Impact

None. This is a static-analysis-only finding.

- Root `savingsGoal` remains declared, computed identically (`Math.max(estimatedCharges * 3, 500)` inside its `useMemo`), and untouched at the source level -- LOT 5.86A did not delete or alter the declaration, only its last caller.
- No test, guard, build, or Playwright result is affected by this finding; LOT 5.88 already confirmed `node --test` 870/870, build PASS, and both Playwright runs 11/11 with this exact `src/App.jsx` state.
- No src/ file, test, guard, or configuration was modified during this investigation.

## 12. Recommended Next LOT

The `+1` is real, isolated, fully attributable to the approved LOT 5.86A migration's side effect, and does not indicate a broader lint-debt or configuration problem. A narrowly scoped follow-up LOT can decide, with full context, whether to:

- remove the now-fully-dead root `savingsGoal` declaration (a genuine follow-up decision, out of scope for an investigation-only LOT), or
- deliberately retain it (per the LOT 5.86A/5.87/5.88 "Root SavingsGoal Retention" guard intent, which may still want the symbol to exist for rollback purposes) and instead adjust the *lint baseline* to `51/22/29` going forward with an explicit rationale recorded.

Both handleExportLimitHit and handleDownloadTxt remain separately-tracked, pre-existing dead code that predates the whole LOT 5.x series and is explicitly out of scope for this delta.

## 13. Final Decision

The `+1` error was demonstrably introduced by the approved LOT 5.86A migration (an in-scope, already-approved change with a mechanical, previously-undocumented side effect on `no-unused-vars`), not by baseline miscounting, not by configuration drift, and not by the two symbols originally suspected.

```txt
GO POUR LOT 5.90 — TARGETED LINT DEBT CORRECTION REVIEW
```
