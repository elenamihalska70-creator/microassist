# LOT 5.97 - Test Architecture Hardening Report

## 1. Executive Summary

LOT 5.97 is a bounded, read-mostly hardening pass over the historical `tests/lot-5-*.test.js` guard suite, following LOT 5.96's recommendation to reduce the three fragility classes it found evidence of during the `savingsGoal` removal (LOT 5.89-5.95): CRLF/LF marker sensitivity, cross-file text-literal coupling, and cascading whole-file occurrence-count guards.

Per its own scope instruction, this LOT did **not** rewrite all ~40 guard files. Step 1 inventoried every file in the LOT's authority-document scope (41 named families) plus the full `tests/lot-5-*.test.js` set (50 files) for the five fragility patterns (A-E). That inventory found one previously undocumented, live fragility instance -- `tests/lot-5-29-savingsgoal-architecture-hardening.test.js` read `src/App.jsx` unnormalized and hardcoded literal `\r\n` sequences directly into two of its own block-extraction markers to compensate, which only worked because the file happens to be CRLF today -- plus confirmed the already-known cross-file coupling bug in the same file (fixed in LOT 5.95, but still coupled via a duplicated magic number). Both were fixed in this single file, which also received a scoped supplement to its whole-file hook-count guard. No other file in the 50-file set carries an unfixed instance of the CRLF marker bug; the LOT 5.92/5.94 fixes remain the only other occurrences and are confirmed intact.

Result:

```txt
Files modified: 1 (tests/lot-5-29-savingsgoal-architecture-hardening.test.js)
Targeted validation (Step 5, A-D): fully clean.
Full node suite (Step 5E): 900/900 PASS, 0 fail (898 baseline + 2 new tests).
npm run build: PASS.
npm run lint: 50 problems (21 errors, 29 warnings) -- exact baseline.
Playwright run 1: 11/11 PASS. Playwright run 2: 11/11 PASS.
```

No runtime code, `src/`, `package.json`, ESLint config, or Playwright config was touched. Significant, catalogued fragility remains deliberately out of scope for this LOT (Section 18) -- most notably ~19 files' whole-file `useState`/`useEffect`/`useMemo` totals and 4 files' dormant (currently-passing, same-class) cross-file magic-number couplings.

## 2. Fragility Inventory

Legend: A = line-ending sensitive, B = whole-file count, C = cross-file text-literal, D = comment-anchor dependent, E = block extraction by string marker, F = stable scoped contract check (no action).

| File | Helper/test area | Pattern class(es) | Risk | Recommended action |
| --- | --- | --- | --- | --- |
| `lot-5-18-legacy-retention-hardening` | `extractBlock`, `APPROVED_LEGACY_REFERENCES` loop | B, E | low (unnormalized read, but only single-line markers -- verified no `\n`/`\r\n` embedded in any marker) | none now; document unnormalized read as latent debt (Section 18) |
| `lot-5-20/21/22-next-consumer-*` | `urssafHelperBlock`, `extractBlock`, `APPROVED_*_COUNTS` | A (fixed LOT 5.94), B, C (dormant, `currentMonthTotal: 24`/`fiscalSummaryVisibleSlice: 15`), E | A: resolved. C: low (values unchanged since removal, not currently broken) | none now; C is Remaining Test Debt |
| `lot-5-24/25/26-next-consumer-*` | same shape as above | A (fixed LOT 5.92), B, C (dormant, same as above; `lot-5-25` additionally cross-reads `lot-5-20/21/22/24`) | A: resolved. C: low | none now; Remaining Test Debt |
| `lot-5-29-savingsgoal-architecture-hardening` | `extractBlock`, `APPROVED_APP_COUNTS`, `LOT_5_18_SOURCE` cross-read | A-variant (CRLF hardcoded into markers, unnormalized read), B, C (`estimatedCharges: 12` magic number vs. `lot-5-18`), D (intentional boundary comments), E | HIGH before this LOT (the one file with a live, previously-undocumented A-variant bug, plus the one confirmed C break in the removal chain) | **FIXED in this LOT** (Section 9) |
| `lot-5-30/32/34/35-isolated-savingsgoal-ui-*` | `progressFillBlock`, `pdfSavingsGoalBranch`, `APPROVED_APP_COUNTS` | B, C (structural cross-reads only, no magic-number literal), D (intentional), E | low -- already CRLF-normalized, already uses bare `\n` markers consistently | none |
| `lot-5-37/39/40-objective-savings-progress-bar-*` | `progressFillBlock`/`appBlock`, `APPROVED_APP_COUNTS` | B, D (intentional), E | low -- normalized | none |
| `lot-5-42/44/46/47/48/49-weekly-rate-*` | `extractBlock`, structural cross-file reads | B, E | low -- normalized, cross-file reads are structural/behavioral, not magic-number | none |
| `lot-5-51/53/54-monthly-reflection-revenue-*` | `extractBlock`, structural cross-file reads | B, E | low -- normalized | none |
| `lot-5-56/57/58/59-monthly-reflection-charges-*` | `extractBlock`; `lot-5-57` reads `src/App.jsx` unnormalized | A-adjacent (low, single-line markers only), B, E | low | none now; unnormalized read noted as debt |
| `lot-5-61/63/64/65/66-smart-alert-reserve-low-*` | `extractBlock`, `APPROVED_APP_COUNTS`; `lot-5-64` reads `src/App.jsx` unnormalized | A-adjacent (low), B, E | low | none now; unnormalized read noted as debt |
| `lot-5-68/70/72/73-smart-alert-rawavailable-revenue-*` | `extractBlock`, `APPROVED_APP_COUNTS` | B, E | low -- normalized | none |
| `lot-5-77/79/81/82-savingsgoal-coaching-*` | `extractBlock`, `APPROVED_APP_COUNTS` | B, D (intentional), E | low -- normalized | none |
| `lot-5-84/86/88-savingsgoal-pdf-*` | `extractBlock`, `APPROVED_APP_COUNTS` | B, D (intentional), E | low -- normalized | none |
| `lot-5-91-obsolete-savingsgoal-root-removal` | `extractBlock`, `APPROVED_APP_COUNTS` | B, D (intentional), E | low -- normalized, this is the removal LOT's own guard | none |
| `lot-5-13/14/15-first-visible-replacement-*` | `extractBlock`; reads `src/App.jsx` unnormalized | A-adjacent (low, single-line markers only), E | low | none now; unnormalized read noted as debt |
| `shadow-parity-validation`, `runtime-parity-evidence` | scoped, semantic assertions on isolated modules, no `src/App.jsx` read | F | none | none |

Counts across the full 50-file `tests/lot-5-*.test.js` set (48 of which read `src/App.jsx`):

| Pattern | Files affected (approx.) | Status after this LOT |
| --- | ---: | --- |
| A (CRLF/LF marker mismatch, would break today) | 0 remaining (was 6, fixed LOT 5.92/5.94; the 1 A-variant found in `lot-5-29` is fixed in this LOT) | resolved |
| A-adjacent (reads `src/App.jsx` unnormalized, currently safe because only single-line markers) | 6 (`lot-5-13`, `14`, `15`, `18`, `57`, `64`) | unaddressed, documented as debt |
| B (whole-file occurrence count) | ~28 files carry at least one whole-file count; 19 of those carry the most generic form (`useState`/`useEffect`/`useMemo` raw totals) | 1 file (`lot-5-29`) received a scoped supplement; rest unaddressed, documented as debt |
| C (cross-file text-literal magic number) | 1 confirmed live break, now fixed (`lot-5-29` -> `lot-5-18`); 4 dormant same-class instances found (`lot-5-21/22/25/26` -> `lot-5-18`, `currentMonthTotal: 24` / `fiscalSummaryVisibleSlice: 15`) | 1 fixed; 4 dormant instances documented as debt |
| D (comment-anchor dependent extraction) | ~15+ files rely on `// LOT 5.79A coaching boundary...`, `// LOT 5.86A PDF boundary...`, or `// ==================== PREVIEW...` as extraction anchors | all classified intentional (Section 7); none changed |
| E (generic block extraction, `extractBlock`/`appBlock`) | 47 files | not fragile on its own; noted, not modified |
| F (already stable/scoped) | `shadow-parity-validation.test.js`, `runtime-parity-evidence.test.js`, and most of each file's semantic/formula assertions | no action needed |

## 3. Line Ending Findings

Direct verification (Node script comparing a CRLF-forced copy and an LF-derived copy of `src/App.jsx` against every marker pair) confirmed:

- The 6 files LOT 5.92/5.94 already fixed (`lot-5-20/21/22/24/25/26`) remain correctly normalized; re-run and re-confirmed passing in this LOT's Step 5B combined run.
- `lot-5-29-savingsgoal-architecture-hardening.test.js` was the **only** file in the entire 50-file set that read `src/App.jsx` unnormalized *and* used a marker containing an embedded line break -- but instead of breaking (like the original LOT 5.92 bug), it worked around the mismatch by hardcoding literal `\r\n` directly into its own marker strings (`"    if (\r\n      !smartAlertIds.has(\"acre-ending\")"`, `"    ],\r\n    soft\r\n  );"`). This is not a currently-failing bug, but it hides the same fragile assumption the LOT 5.92 fix eliminated everywhere else: if `src/App.jsx`'s line endings ever normalize to LF (a plausible future event -- editor re-save, `.gitattributes` change, cross-platform checkout), these two markers would silently stop matching with no warning until the suite ran, exactly like the original bug.
- 6 files (`lot-5-13`, `14`, `15`, `18`, `57`, `64`) read `src/App.jsx` unnormalized but use only single-line markers with no embedded `\n`/`\r\n` -- confirmed by direct inspection of every `extractBlock`/`indexOf` call site in each file. These are not currently at risk, but they are one careless copy-paste away from reintroducing the bug class if a multi-line marker is ever added to them.
- Every other file that reads `src/App.jsx` (41 before this LOT, 42 after) already applies the exact LOT 5.92 `.replace(/\r\n/g, "\n")` pattern and uses bare `\n` markers consistently.

## 4. Block Extraction Findings

`extractBlock(startText, endText)` (or the identically-shaped `appBlock`) is duplicated, near byte-for-byte, across 47 of the 50 files. This is class E: not fragile by itself (the function's logic -- `indexOf`, `assert.notEqual(-1)`, `slice` -- is simple and correct), but it is the delivery mechanism for both A and D fragility, since every marker string passed into it is a raw literal with no shared validation.

No `extractBlock` implementation itself was found buggy anywhere in the 50-file set; every failure traced in this and prior LOTs came from the *markers* passed to it (unnormalized source + multi-line marker), not the helper's own logic.

## 5. Whole-File Count Findings

Two distinct sub-shapes exist:

1. **Per-identifier reference-count guard** (`APPROVED_LEGACY_REFERENCES` in `lot-5-18`, `APPROVED_APP_COUNTS` in `lot-5-20` through `lot-5-91`): a `Object.entries(...)` loop that asserts each named identifier's whole-file occurrence count individually, with the identifier name itself as the assertion message. This is the guard that actually blocks a new unauthorized Legacy or Shadow consumer from being silently added -- per the hard rule, this class of count is kept, since removing it would remove real protective value with no equivalent scoped replacement.
2. **Generic React hook totals** (`useState: 82`, `useEffect: 59`, `useMemo: 88` and their per-LOT variants) bundled into the same object as (1). These are the most fragile sub-case: they shift on **any** hook added or removed anywhere in the ~15,000-line file, regardless of whether it has anything to do with `savingsGoal`, Legacy retention, or Shadow migration. 19 files carry this generic form (see Section 2's table).

This LOT added one scoped supplement in `lot-5-29` (Section 9) that independently checks the three `savingsGoal` boundary blocks (UI, coaching, PDF) contain zero `useState`/`useEffect`/`useMemo` calls, so a future unrelated hook addition elsewhere in the file cannot silently satisfy this specific boundary's guard by coincidence, and a new hook *inside* one of these three boundaries is caught immediately by a check with a narrow, semantically obvious blast radius -- independent of the whole-file total. The whole-file totals themselves were left in place, unweakened, in all 19 files (including `lot-5-29`), per the "supplement, don't replace" instruction.

## 6. Cross-File Coupling Findings

`tests/lot-5-29-savingsgoal-architecture-hardening.test.js` previously asserted `assert.match(LOT_5_18_SOURCE, /estimatedCharges: 12/)` -- a literal regex against another test file's raw source, duplicating a magic number `lot-5-29` already independently re-derives from live `src/App.jsx` via its own `APPROVED_APP_COUNTS.estimatedCharges`. This is the exact bug LOT 5.94 discovered and LOT 5.95 patched by updating the literal from `14` to `12` -- but the patch kept the duplication, so the same class of break remains possible on the next legitimate `estimatedCharges` count change. Fixed in this LOT (Section 9).

Four additional, currently-dormant instances of the same pattern were found: `lot-5-21`, `lot-5-22`, `lot-5-25`, `lot-5-26` each assert `assert.match(LOT_5_18_SOURCE, /currentMonthTotal: 24/)` and/or `/fiscalSummaryVisibleSlice: 15/)`, and `lot-5-25` additionally asserts `/currentMonthTotal: 24/` against `lot-5-20`, `lot-5-21`, `lot-5-22`, and `lot-5-24`'s raw source. None of these have broken yet because `currentMonthTotal` (24) and `fiscalSummaryVisibleSlice` (15) are both unaffected by the `savingsGoal` removal and have not changed. They carry the same latent risk as the `estimatedCharges` case did before it broke. Left unmodified in this LOT (Section 18: Remaining Test Debt) to keep scope bounded to the one file with a live, evidenced break.

Every other cross-file `readFileSync` in the 50-file set (dozens of instances -- e.g. `lot-5-48` reading `lot-5-42`/`44`/`47`, `lot-5-35` reading `lot-5-30`/`32`/`34`) was spot-checked and found to assert against **structural or behavioral** text (test descriptions, `GO POUR LOT X.YY` headline strings, formula regexes) rather than a magic-number literal -- these are stable because a renamed guard or removed headline is itself a meaningful signal, not incidental drift.

## 7. Comment Anchor Findings

Two categories of comment-anchored extraction exist:

- `// LOT 5.79A coaching boundary: source-only denominator migration.` and `// LOT 5.86A PDF boundary: source-only denominator migration.` in `src/App.jsx` are used as `extractBlock` start markers by roughly 15 files across the `lot-5-29` through `lot-5-91` range. These are genuine architectural boundary markers -- they are the literal text multiple independent guard files agree on as the start of the coaching/PDF `savingsGoal` boundary, and LOT 5.96 Section 11 explicitly documents these boundaries as permanent-by-design. Changing or removing either comment would be a real architectural change requiring coordinated updates across every dependent guard, which is exactly the signal a comment-anchor guard should produce. **Left unchanged, documented as intentional.**
- `// ==================== PREVIEW POUR MODALE AJOUT REVENU ====================` is used as the end marker for `visibleSliceBlock()`/similar in `lot-5-14`, `lot-5-15`, `lot-5-18`, `lot-5-57`, `lot-5-64`, and others. This is purely a UI section divider comment with no architectural contract behind it -- but it was **not** changed in this LOT because none of these files broke on it, changing it would touch 5+ files for a cosmetic-risk reduction with no evidenced bug, and it falls outside this LOT's bounded scope (Section 3's priority list did not surface a live failure here). Documented as low-priority Remaining Test Debt (Section 18).

No comment anchor was found where the underlying comment had already caused a break.

## 8. Shared Helper Decision

**Decision: do not create a shared test helper module.**

Reasoning:

1. Only one file (`lot-5-29`) required a source-read/marker fix in this LOT. There is no fresh, first-hand evidence in this LOT of *multiple* files currently duplicating a *buggy* copy of the pattern -- the inventory (Section 3) confirms 42 of 48 `src/App.jsx`-reading files already correctly self-normalize following the LOT 5.92 idiom, independently, without a shared module, and have done so cleanly since LOT 5.92/5.94/5.95 with zero regressions.
2. A shared helper imported by dozens of guard files would itself become the single point of fragility this LOT exists to reduce: one bug in the helper -- or one incompatible signature change made for a future LOT -- would cascade across every importing file simultaneously, rather than being isolated to the one file that has a problem today. The task's own criteria flag this risk explicitly.
3. The root cause of the historical bugs was never "the normalization code is hard to write" (it is one line: `.replace(/\r\n/g, "\n")`) -- it was **inconsistent application**: some files added it, some didn't, and each was authored independently over many LOTs. A shared helper does not fix "did this call site remember to use it" any more than a documented, consistently-copy-pasted one-line idiom does; retrofitting an import into 40+ already-green files to enforce that consistency is itself the "large rewrite of ~40 files at once" this LOT is explicitly instructed to avoid.
4. The established LOT 5.92 pattern (inline `.replace(/\r\n/g, "\n")` on each file's own `APP_SOURCE` read, plus a local, per-file CRLF/LF robustness test) has now been applied identically in 10 files across four LOTs (5.92, 5.94, and now 5.97) with a 100% success rate and zero cross-file side effects. Continuing that idiom is lower-risk than introducing a new shared module this late, with 41 files still not using it.

This LOT's `lot-5-29` fix follows the established inline pattern exactly, including its own local CRLF/LF robustness test (Section 9), rather than introducing `tests/helpers/sourceGuards.js` or any equivalent.

## 9. Files Modified

Exactly one file, plus this report:

```txt
tests/lot-5-29-savingsgoal-architecture-hardening.test.js
```

Changes made, in order:

1. **CRLF normalization** -- `APP_SOURCE` now reads `.replace(/\r\n/g, "\n")` (byte-for-byte the LOT 5.92 pattern), removing the file's prior unnormalized read.
2. **Marker fix** -- `coachingSavingsGoalBranch()`'s end marker changed from `"    if (\r\n      !smartAlertIds.has(\"acre-ending\")"` to `"    if (\n      !smartAlertIds.has(\"acre-ending\")"`; `pdfSavingsGoalBranch()`'s end marker changed from `"    ],\r\n    soft\r\n  );"` to `"    ],\n    soft\n  );"`. Verified with a standalone Node script (before editing) that both markers extract byte-identical blocks against the real, current `src/App.jsx` before and after normalization -- the block content is unchanged, only the marker's line-ending assumption was removed.
3. **Cross-file coupling fix** -- `assert.match(LOT_5_18_SOURCE, /estimatedCharges: 12/)` replaced with `assert.match(LOT_5_18_SOURCE, new RegExp(\`estimatedCharges:\\s*${APPROVED_APP_COUNTS.estimatedCharges}\\b\`))`, so the expected count now comes from this file's own independently-live-verified `APPROVED_APP_COUNTS.estimatedCharges` rather than a second hardcoded literal. The existing `assert.match(LOT_5_18_SOURCE, /blocks unapproved new Legacy consumers/)` check (verifying `lot-5-18`'s guard still exists and still enforces a count) was kept unchanged.
4. **New scoped supplement** -- one new test asserts zero `useState`/`useEffect`/`useMemo` calls inside each of the three `savingsGoal` boundary blocks (UI, coaching, PDF), supplementing (not replacing) the existing whole-file `useState: 82` / `useEffect: 59` / `useMemo: 88` counts in `APPROVED_APP_COUNTS`.
5. **New CRLF/LF robustness test** -- copied from the established LOT 5.92/5.94 idiom, applied locally to this file's own extraction, with no shared helper introduced.

No other file (test, `src/`, config, or otherwise) was opened for writing.

## 10. Guard Semantics Preserved

| Guard | Before | After | Still enforces |
| --- | --- | --- | --- |
| `estimatedCharges` count == 12 | hardcoded twice (`lot-5-29` and `lot-5-18`) | hardcoded once (`lot-5-18`'s `APPROVED_LEGACY_REFERENCES`), `lot-5-29` re-derives and cross-checks | yes -- both files must still agree; a real drift between them still fails loudly |
| `lot-5-18`'s guard still exists and still blocks unapproved Legacy consumers | `assert.match(LOT_5_18_SOURCE, /blocks unapproved new Legacy consumers/)` | unchanged | yes |
| Coaching/PDF boundary block content (formulas, rounding, no cross-consumer coupling) | 8 existing tests, byte-identical assertions | unchanged | yes |
| No new hook inside the 3 `savingsGoal` boundaries | not previously checked in isolation (only via whole-file totals) | new scoped test added | yes -- stronger than before, not weaker |
| Whole-file `useState`/`useEffect`/`useMemo`/`estimatedCharges`/etc. totals | asserted via `APPROVED_APP_COUNTS` loop | unchanged, same loop, same values | yes |
| CRLF/LF marker extraction of the coaching/PDF blocks | worked only because file is CRLF today (hidden assumption) | works for either line-ending style (explicit, tested) | yes -- strictly more robust, same block extracted |

No assertion was deleted. No assertion was weakened to a vague check (e.g. `toBeTruthy()`-style, or a loosened regex). Every existing test name/description was preserved unchanged; only the internal implementation of the two marker strings and the one cross-file assertion changed.

## 11. Targeted Validation

| Step | Command | Result |
| --- | --- | --- |
| A | `node --test tests/lot-5-29-savingsgoal-architecture-hardening.test.js` | PASS - 18/18 (was 16, +2 new tests) |
| B | Combined: `lot-5-18, 20, 21, 22, 24, 25, 26, 29, 30, 91` | PASS - 185/185 |
| C | `node --test tests/shadow-parity-validation.test.js tests/runtime-parity-evidence.test.js` | PASS - 17/17 |
| D | `npx eslint tests/lot-5-29-savingsgoal-architecture-hardening.test.js` | PASS - 0 problems |

No sandboxed `spawn EPERM` was encountered; every command ran directly without `dangerouslyDisableSandbox`.

Steps A-D were fully clean, so full validation (Step 5 E-H) proceeded.

## 12. Full Node Suite

```txt
node --test
```

Result:

```txt
tests 900
pass 900
fail 0
```

900 = the LOT 5.95 baseline of 898 plus the 2 new tests added in `lot-5-29` (the scoped hook-boundary supplement and the CRLF/LF robustness check). Zero failures anywhere in the repository.

## 13. Build

```txt
npm run build
```

Result: `PASS` (`358 modules transformed`, built in `4.08s`). The pre-existing Vite chunk-size-over-500kB warning is present and accepted, not a failure -- unchanged from every prior LOT's baseline.

## 14. Global Lint

```txt
npm run lint
```

Result:

```txt
50 problems (21 errors, 29 warnings)
```

Exact expected baseline, byte-for-byte the same itemized inventory documented in LOT 5.89/5.96 (19 `no-unused-vars` + 2 `react-refresh/only-export-components`). No new lint problem was introduced by this LOT's one modified test file.

## 15. Playwright Run 1

```txt
npx playwright test --reporter=line
11 passed (13.7s)
```

## 16. Playwright Run 2

```txt
npx playwright test --reporter=line
11 passed (12.2s)
```

Repeated exactly once more, per instruction; both runs 11/11.

## 17. Runtime Scope

Confirmed by `git status` and by tracking every file opened for writing during this LOT:

- `src/App.jsx` was not opened for writing at any point in this LOT (only read, for marker verification via a standalone Node script and by the test file itself at test-run time);
- no file under `src/` (including `src/application/`, `src/domain/`, `src/navigation/`, `src/shell/`, `src/utils/obligations.js`) was modified;
- `package.json`, `eslint.config.js`, and `playwright.config.js` were not modified;
- the pre-existing modified-but-uncommitted state of `src/App.jsx`, `src/utils/obligations.js`, `playwright.config.js`, `tests/home.spec.js`, and `tests/premium.spec.js` shown in `git status` predates this LOT (part of the ongoing, separate SaaS-shell-v2 refactor) and was not touched by this LOT;
- `fiscalCoachingSavingsGoal`, `pdfSavingsGoal`, `fiscalSummaryVisibleSlice`, every formula, rate, rounding rule, threshold, message, and fallback in `src/App.jsx` are untouched;
- no consumer migration, Shadow selector change, or Legacy root change occurred;
- the entire change surface of this LOT is: one test file's source-read normalization, two marker string literals (content-equivalent, verified), one cross-file assertion's expected-value construction, and two new test cases in that same file.

## 18. Remaining Test Debt

Explicitly not addressed in this bounded LOT, for a future LOT to pick up:

1. **19 files' whole-file `useState`/`useEffect`/`useMemo` totals** (`lot-5-21/22/24/25/26/29/32/35/37/40/65/66/70/72/73/79/81/82/86`) remain unsupplemented by a scoped check. Only `lot-5-29` received the scoped-boundary supplement in this LOT. These are the most fragile guards in the suite (Section 5) -- they shift on any unrelated hook change anywhere in the ~15,000-line file.
2. **4 dormant cross-file magic-number couplings** (`lot-5-21`, `22`, `25`, `26` -> `lot-5-18`'s `currentMonthTotal: 24`/`fiscalSummaryVisibleSlice: 15`; `lot-5-25` additionally -> `lot-5-20/21/22/24`'s `currentMonthTotal: 24`) carry the same bug class as the one fixed in `lot-5-29`, but have not broken yet because those two values have not changed since the values were set. Left unfixed to keep this LOT's scope to the one file with a *live* break.
3. **6 files reading `src/App.jsx` unnormalized but currently safe** (`lot-5-13`, `14`, `15`, `18`, `57`, `64`) -- no embedded multi-line marker exists in any of them today, so no active bug, but each is one careless copy-pasted multi-line marker away from reintroducing the exact LOT 5.92 bug class.
4. **The `// ==================== PREVIEW POUR MODALE AJOUT REVENU ====================` comment anchor** used by 5+ files (`lot-5-14`, `15`, `18`, `57`, `64`, others) is a cosmetic divider with no architectural contract, unlike the two boundary comments documented as intentional in Section 7 -- but it was not touched since it has never caused a break and doing so would ripple across those files for no evidenced benefit.
5. **No shared test helper was created** (Section 8) -- the inline-normalization idiom remains the accepted pattern; a future LOT revisiting this decision should re-derive it from fresh evidence, not assume this LOT's reasoning still holds if the fragility picture changes materially (e.g., if a fifth or sixth independent CRLF bug is found).
6. This LOT did not audit the ~30 files outside the `lot-5-18` through `lot-5-91` "savingsGoal era" range for the same fragility classes in exhaustive depth (e.g., `lot-5-11`, `lot-5-16`) -- a quick grep pass found no `src/App.jsx` read or extraction pattern of concern in those two specifically, but a future LOT should re-verify if they are ever modified.

## 19. Recommended Next Phase

A future LOT should pick up item 1 from Section 18 first (the 19-file whole-file hook-count fragility) since it is both the largest blast radius and the most mechanically repetitive to supplement (the same three-line scoped-boundary pattern added to `lot-5-29` in this LOT can likely be adapted per-file), followed by item 2 (the 4 dormant cross-file couplings, using the exact `new RegExp(...APPROVED_*_COUNTS...)` pattern established here). Both are bounded, well-understood, low-risk mechanical follow-ups rather than open-ended exploration.

## 20. Final Decision

This LOT's one modified file passed every validation gate cleanly: targeted (A-D), full Node suite (900/900, 0 fail), build, lint (exact baseline), and Playwright (11/11 twice). The one live, previously-undocumented fragility instance found in Step 1 (`lot-5-29`'s CRLF-hardcoded markers) and the one confirmed cross-file coupling instance were both fixed with a verified, non-regressive change, and a scoped supplement was added without weakening any existing guard. No `src/` file, runtime formula, or config file was touched at any point.

At the same time, the inventory in Sections 2-7 found substantial, catalogued fragility that this LOT deliberately left unaddressed to stay within its bounded scope: 19 files' generic whole-file hook counts, 4 dormant cross-file magic-number couplings of the same class as the one just fixed, and 6 files with a latent (currently inactive) CRLF read risk. This is meaningfully more stable than before this LOT, but not a closed case -- a next phase with the same shape as this one (pick a small, high-risk, representative subset; fix; validate; document debt) is the appropriate continuation rather than either declaring the architecture fully hardened or treating this as a runtime concern.

```txt
GO POUR LOT 5.98 — TEST ARCHITECTURE HARDENING PHASE 2
```
