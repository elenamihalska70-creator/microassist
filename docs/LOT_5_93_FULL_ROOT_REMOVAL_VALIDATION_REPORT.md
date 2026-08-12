# LOT 5.93 - Full Root Removal Validation Report

## 1. Executive Summary

LOT 5.93 ran full-suite validation after the LOT 5.91A `savingsGoal` root removal and the LOT 5.92 CRLF test-helper fix.

Result:

```txt
STOP at the Full Node Suite gate.
895 tests, 875 pass, 20 fail.
```

All 20 failures are guard/test-only, in four files never touched by LOT 5.90/5.91A/5.92 (`lot-5-18`, `lot-5-20`, `lot-5-21`, `lot-5-22`). None involve `src/App.jsx`, business logic, formulas, Shadow data, persistence, payloads, or the assistant. Per this LOT's explicit rule ("Si full Node echoue reellement: STOP. Ne pas corriger."), no fix was applied and `npm run build`, `npm run lint`, targeted ESLint, and Playwright were not run, since each is explicitly gated on the full Node suite passing first.

The static, non-suite-dependent confirmations (root removal integrity, active boundary integrity, contracts, Shadow baseline, no-propagation, rollback) were all completed independently by direct source inspection and are documented below -- they do not depend on the suite result and all passed.

## 2. Pre-Test Integrity

All 15 required conditions were confirmed by direct source inspection of `src/App.jsx` before any suite was run:

| # | Condition | Result |
| --- | --- | --- |
| 1 | whole-word `savingsGoal` count in `src/App.jsx` | `0` |
| 2 | old root declaration (`const savingsGoal = useMemo`) | absent |
| 3 | `fiscalCoachingSavingsGoal` present | yes, line 6444 |
| 4 | `fiscalCoachingSavingsGoal` exact formula | `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` -- exact |
| 5 | `pdfSavingsGoal` present | yes, line 6448 |
| 6 | `pdfSavingsGoal` exact formula | `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` -- exact |
| 7 | coaching low-reserve uses `fiscalCoachingSavingsGoal` | confirmed, lines 6507-6511 |
| 8 | PDF `Objectif d'epargne` percentage uses `pdfSavingsGoal` | confirmed, lines 9996-9997 |
| 9 | UI `Objectif d'epargne` stays Shadow-derived | confirmed, `fiscalSummaryVisibleSlice.finalContributionAmount * 3` at lines 14568 (text) and 14586 (progress bar) |
| 10 | `fiscalSummaryVisibleSlice` count | `15` |
| 11 | no 16th occurrence | confirmed |
| 12 | persistence unchanged | no `savingsGoal` reference in any `localStorage`/Supabase code |
| 13 | payloads unchanged | no `savingsGoal` reference in `trackEvent`/payload code |
| 14 | assistant unchanged | no `savingsGoal` reference in assistant-context code |
| 15 | no new savingsGoal-like alias reintroducing the root | only `fiscalCoachingSavingsGoal` and `pdfSavingsGoal` exist, both pre-existing and unchanged |

No STOP condition was triggered by pre-test integrity. Full Node validation proceeded.

## 3. Full Node Suite

Command:

```txt
node --test
```

No sandboxed `spawn EPERM` was encountered; the command ran directly.

Result:

```txt
tests 895
pass 875
fail 20
```

All 20 failures are in four files, none of which were modified by LOT 5.90, 5.91A, or 5.92:

| File | Failures | Failure class |
| --- | ---: | --- |
| `tests/lot-5-18-legacy-retention-hardening.test.js` | 1 | stale hardcoded `estimatedCharges` count (`14`, actual is now lower) |
| `tests/lot-5-20-next-consumer-migration.test.js` | 5 | 3 CRLF `urssafHelperBlock()` marker misses + 2 stale `estimatedCharges` count |
| `tests/lot-5-21-next-consumer-migration-validation.test.js` | 6 | CRLF `urssafHelperBlock()` marker misses |
| `tests/lot-5-22-next-consumer-stabilization.test.js` | 8 | 7 CRLF `urssafHelperBlock()` marker misses + 1 stale `useMemo` count |

Breakdown by root cause:

```txt
17 failures: same CRLF/LF marker bug diagnosed and fixed by LOT 5.92 (urssafHelperBlock end-marker
             uses hardcoded bare \n against a CRLF-only src/App.jsx), present in these four files'
             own unfixed copies of the same helper pattern.
 3 failures: stale hardcoded estimatedCharges/useMemo counts left over from before the LOT 5.91A
             root removal (the removal dropped estimatedCharges reads by 2 and one useMemo hook).
```

Both categories are guard/test-only. Neither touches `src/App.jsx`, runtime logic, formulas, Shadow data, persistence, payloads, or the assistant. `lot-5-24`, `lot-5-25`, and `lot-5-26` (fixed in LOT 5.92) reported zero failures in this same run, confirming that fix holds.

### Why these four files were missed by LOT 5.90/5.91A

LOT 5.90's guard inventory and LOT 5.91A's audit were both built around a `savingsGoal` token search (`grep -rl '\bsavingsGoal\b' tests/`). `lot-5-18`, `lot-5-20`, `lot-5-21`, and `lot-5-22` do not mention the literal token `savingsGoal` anywhere -- their own "reference count" guards track `estimatedCharges`/`useMemo` counts independently, as part of an unrelated `APPROVED_APP_COUNTS`-style inventory. They were therefore never in scope for a `savingsGoal`-token-driven audit, and LOT 5.92's fix was scoped narrowly to the three files that had actually failed in LOT 5.91A's own targeted 28-file run (`lot-5-24/25/26`), not to every file sharing the same helper pattern.

Per this LOT's explicit rule, no correction was applied here. This is documented as a finding for the next LOT, not fixed in this one.

## 4. Build

```txt
NOT RUN
```

Reason: explicitly gated on Full Node passing ("Seulement si full Node PASS: npm run build"). Full Node did not pass.

## 5. Global Lint

```txt
NOT RUN
```

Reason: explicitly gated on Build passing. Build was not run.

## 6. Targeted ESLint

```txt
NOT RUN
```

Reason: sequenced after Global Lint in this LOT's gate chain, which did not clear.

## 7. Playwright Run 1

```txt
NOT RUN
```

Reason: explicitly gated on Node/build/lint gates ("Seulement si Node/build/lint gates conformes"). They did not clear.

## 8. Playwright Run 2

```txt
NOT RUN
```

Reason: same as Run 1; a second run was never reached.

## 9. Root Removal Integrity

Re-confirmed by direct source inspection (independent of the suite result):

- `savingsGoal` root absent: confirmed, `0` whole-word occurrences;
- no direct consumer: confirmed, nothing in coaching/PDF/JSX/smart alerts/dashboard/weekly recap/monthly reflection/obligations/invoices/reminders reads it;
- no indirect consumer: confirmed, nothing derives a variable from it (it does not exist);
- no dependency-array read: confirmed;
- no persistence read: confirmed;
- no payload read: confirmed;
- no assistant read: confirmed.

## 10. Active Boundary Integrity

| Boundary | Alias | Status |
| --- | --- | --- |
| Coaching | `fiscalCoachingSavingsGoal` | independent, unchanged formula, own consumer (`fiscalCoachingCard` low-reserve) |
| PDF | `pdfSavingsGoal` | independent, unchanged formula, own consumer (`handleExportPDF` `Objectif d'epargne`) |
| UI | inline `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` | independent, unchanged, Shadow-derived in both the text and progress-bar consumers |

No boundary was merged. No shared helper was introduced (also locked in by `tests/lot-5-91-obsolete-savingsgoal-root-removal.test.js`, which passed in this run).

## 11. Coaching Contract

Confirmed unchanged at the source (`src/App.jsx:6507-6511`):

```js
if (
  !smartAlertIds.has("reserve-low") &&
  fiscalCoachingSavingsGoal > 0 &&
  savingsProgress < fiscalCoachingSavingsGoal * 0.35
) {
```

- numerator: `savingsProgress` -- unchanged;
- denominator formula: `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` -- unchanged;
- coefficient: `* 3` -- unchanged;
- minimum floor: `500` -- unchanged;
- threshold: `* 0.35` -- unchanged;
- comparator: strict `<` -- unchanged;
- branch guard: `!smartAlertIds.has("reserve-low")` -- unchanged;
- message: unchanged (not touched by this or prior LOTs in this chain).

## 12. PDF Contract

Confirmed unchanged at the source (`src/App.jsx:9996-9997`):

```js
typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0
  ? `${Math.round((savingsProgress / pdfSavingsGoal) * 100 || 0)}%`
  : "Pas encore assez de donnees"
```

- `savingsProgress`: unchanged numerator;
- ratio: `savingsProgress / pdfSavingsGoal`, unchanged;
- `Math.round`: unchanged;
- inner fallback `|| 0`: unchanged;
- fallback text: unchanged;
- formatter: trailing `%`, unchanged;
- no-cap behavior: no `Math.min(100, ...)` present, unchanged;
- labels, layout, output structure: unchanged (not touched by this LOT).

## 13. Shadow Baseline

```txt
fiscalSummaryVisibleSlice = 15
no 16th occurrence
```

Confirmed by direct count. The root `savingsGoal` removal touched no Shadow read: its removed formula (`Math.max(estimatedCharges * 3, 500)`) never referenced `fiscalSummaryVisibleSlice`.

## 14. CRLF Test Stability

`lot-5-24`, `lot-5-25`, and `lot-5-26` (the three files fixed in LOT 5.92) reported zero failures in this LOT's full-suite run -- their fix holds. Their CRLF-to-LF normalization remains confined to the test module's own `APP_SOURCE` read step:

```js
const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
```

No runtime normalization was added anywhere in `src/`. This LOT did not modify these three files further.

The same unnormalized-CRLF pattern was found, in this LOT, to still be present and still failing in three *other* files (`lot-5-20`, `lot-5-21`, `lot-5-22`) that were out of LOT 5.92's scope -- see section 3. This is a newly surfaced finding, not a regression of the LOT 5.92 fix itself.

## 15. No Propagation

Confirmed no change to any of: Supabase, `localStorage`, payloads, assistant, feedback, analytics, smart alerts, invoices, reminders, weekly recap, monthly reflection, `src/utils/obligations.js`. This LOT made zero edits anywhere; the confirmation is by inspection of current source state, consistent with LOT 5.91A's own no-propagation findings.

## 16. Rollback

Confirmed still local: restoring the removed root declaration would only mean re-adding the exact removed block to `src/App.jsx`:

```js
// LOT 5.29: Legacy savings goal source retained for UI, coaching and PDF boundaries.
const savingsGoal = useMemo(() => {
  // Objectif d'épargne recommandé: 3 mois de charges
  return Math.max(estimatedCharges * 3, 500);
}, [estimatedCharges]);
```

No consumer needs restoring (nothing currently reads it). No data migration. No Shadow read to modify. Rollback scope is unchanged from LOT 5.91A's own rollback description.

## 17. Scope Control

Confirmed:

- no file under `src/` was modified by this LOT;
- no test, guard, or doc file other than this report was created or modified;
- no `node --test` failure was corrected;
- `npm run build`, `npm run lint`, targeted ESLint, and Playwright were not run, per their explicit pass-gated ordering;
- no dependency was installed;
- no commit/reset/restore/stash command was run.

## 18. Final Decision

The full Node suite did not pass, but every one of the 20 failures is guard/test-only: 17 are the same CRLF/LF marker bug already correctly diagnosed and fixed in three sibling files by LOT 5.92, now found unfixed in `lot-5-20/21/22`; 3 are stale hardcoded `estimatedCharges`/`useMemo` counts in `lot-5-18/20/22`, left over from the LOT 5.91A root removal, in files that fell outside its `savingsGoal`-token-driven audit scope. No `savingsGoal` reappearance, no alias change, no Shadow baseline drift, no runtime/business-logic change, and no persistence/payload/assistant change was found anywhere.

```txt
GO POUR LOT 5.94 — EXTENDED STABILIZATION
```
