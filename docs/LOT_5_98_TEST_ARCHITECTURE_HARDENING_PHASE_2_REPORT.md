# LOT 5.98 - Test Architecture Hardening Phase 2 Report

## 1. Executive Summary

LOT 5.98 is the second and final bounded hardening phase over the historical `tests/lot-5-*.test.js` guard suite, working strictly from LOT 5.97's own inventory (Section 18, Remaining Test Debt) rather than rescanning the repository for new fragility categories.

Three of LOT 5.97's four debt categories were reviewed in full:

1. **4 dormant cross-file magic-number couplings** (`lot-5-21`, `22`, `25`, `26` -> `lot-5-18`'s `currentMonthTotal: 24` / `fiscalSummaryVisibleSlice: 15`, same class as the bug already fixed in `lot-5-29`). All 4 were classified **A. MUST HARDEN NOW** and fixed using the exact `new RegExp(...APPROVED_APP_COUNTS...)` pattern LOT 5.97 established.
2. **6 files with unnormalized `src/App.jsx` reads** (`lot-5-13`, `14`, `15`, `18`, `57`, `64`). Every marker/regex in all 6 files was individually inspected for embedded `\n`/`\r\n`. None were found to be line-ending sensitive (the one embedded-`\n` regex, in `lot-5-64`, is a `\s*\n\s*` content check proven CRLF-safe by direct test). All 6 are classified **SAFE TO RETAIN unnormalized** and were not touched.
3. **~19 files with whole-file hook/occurrence-count guards.** 8 files (`lot-5-32`, `35`, `37`, `40`, `79`, `81`, `82`, `86`) -- the direct siblings of `lot-5-29` that already extract the three `savingsGoal` boundary blocks (UI, coaching, PDF) using pre-existing local helper functions -- received the same scoped zero-hook supplement LOT 5.97 added to `lot-5-29`, without touching or weakening any existing whole-file count. The remaining 11 files in the 19-file list do not have this extraction infrastructure already in place and were left as documented debt rather than retrofitted with new extraction logic.

No `src/` file, `package.json`, ESLint config, or Playwright config was touched. No shared test helper module was created.

Result:

```txt
Files modified: 12 (4 cross-file coupling hardening + 8 whole-file count supplements)
Targeted validation: fully clean.
Full node suite: 908/908 PASS, 0 fail (900 baseline + 8 new supplement tests).
npm run build: PASS.
npm run lint: 50 problems (21 errors, 29 warnings) -- exact baseline.
Playwright run 1: 11/11 PASS. Playwright run 2: 11/11 PASS.
```

Zero CRITICAL debt remains (Section 20/21).

## 2. Phase 1 Baseline

State inherited from LOT 5.97 at the start of this LOT, verified before any edit:

```txt
node --test: 900/900 PASS, 0 fail.
npm run build: PASS.
npm run lint: 50 problems (21 errors, 29 warnings).
Playwright: 11/11 PASS (both runs).
```

LOT 5.97's Section 18 (Remaining Test Debt) is this LOT's starting scope:

1. 19 files' whole-file `useState`/`useEffect`/`useMemo` totals unsupplemented (only `lot-5-29` received a supplement in LOT 5.97).
2. 4 dormant cross-file magic-number couplings (`lot-5-21`, `22`, `25`, `26` -> `lot-5-18`).
3. 6 files reading `src/App.jsx` unnormalized but currently safe (`lot-5-13`, `14`, `15`, `18`, `57`, `64`).
4. The `// ==================== PREVIEW POUR MODALE AJOUT REVENU ====================` comment anchor used by 5+ files -- cosmetic, no architectural contract, not touched.
5. Shared-helper decision to be re-derived independently, not assumed.
6. ~30 files outside the `lot-5-18`-`lot-5-91` "savingsGoal era" range not audited in depth.

Item 4 and item 6 are outside this LOT's Step 1-3 scope per the task's explicit instruction ("Only go outside it if you discover a direct, unavoidable dependency while fixing something already in scope") and were not encountered while working items 1-3, so they remain untouched debt (Section 20).

## 3. Cross-File Couplings Reviewed

All 4 dormant instances named in LOT 5.97 Section 6/18 were located and verified against current source before any edit:

| # | Source file | Target file | Literal coupled | Location (test name) |
| --- | --- | --- | --- | --- |
| 1 | `lot-5-21-next-consumer-migration-validation.test.js` | `lot-5-18-legacy-retention-hardening.test.js` | `/currentMonthTotal: 24/`, `/fiscalSummaryVisibleSlice: 15/` | "LOT 5.21 validates Legacy Retention Guard remains adjusted only for the approved gate" |
| 2 | `lot-5-22-next-consumer-stabilization.test.js` | `lot-5-18-legacy-retention-hardening.test.js` | `/currentMonthTotal: 24/`, `/fiscalSummaryVisibleSlice: 15/` | "LOT 5.22 keeps Legacy retention guards strict and adjusted only for the approved gate" |
| 3 | `lot-5-25-next-consumer-migration-validation.test.js` | `lot-5-18-legacy-retention-hardening.test.js` **plus** `lot-5-20`, `lot-5-21`, `lot-5-22`, `lot-5-24` | `/currentMonthTotal: 24/` (x5), `/fiscalSummaryVisibleSlice: 15/` (x1, against `lot-5-18` only) | "LOT 5.25 validates LOT 5.18 through LOT 5.24 guard adjustments stay narrow" |
| 4 | `lot-5-26-next-consumer-stabilization.test.js` | `lot-5-18-legacy-retention-hardening.test.js` | `/currentMonthTotal: 24/`, `/fiscalSummaryVisibleSlice: 15/` | "LOT 5.26 keeps Legacy guards strict" |

For each: historical reason it exists, drift risk, and classification.

**Historical reason**: `lot-5-18`'s `APPROVED_LEGACY_REFERENCES.currentMonthTotal` and `.fiscalSummaryVisibleSlice` are per-identifier reference-count guards. Each of `lot-5-21/22/25/26` -- written in the same "next consumer migration" LOT chain as `lot-5-18` -- independently re-asserts that `lot-5-18`'s guard still contains those exact numbers, as a structural cross-check that the earlier LOT's baseline wasn't silently loosened. `lot-5-25` additionally cross-checks the same literal against 4 sibling files from the same chain (`lot-5-20`, `21`, `22`, `24`), verifying the whole family stayed in sync.

**Drift risk**: `currentMonthTotal` (24 occurrences) is an ACTIVE LEGACY root per LOT 5.96's Legacy Map (Section 3) -- it is a direct positional input to `computeObligations()`, the parity-evidence `legacySnapshot`, the assistant boundary, the feedback context, and a PDF export line. Any future LOT that touches one of those consumers (adds/removes a read, refactors the feedback payload, changes the assistant boundary shape) would shift this count for reasons having nothing to do with `lot-5-21/22/25/26`'s own approved gate -- this is the exact shape of drift that broke `lot-5-29` -> `lot-5-18`'s `estimatedCharges` literal in LOT 5.94 (a legitimate, in-scope `lot-5-18` fix broke an unrelated file with no warning until the full suite ran). `fiscalSummaryVisibleSlice` (15 occurrences) is the Shadow baseline count and is documented as a hard ceiling (Section 8/20 below); it is lower-risk than `currentMonthTotal` in isolation, but the two literals were hardcoded together in every instance found, so they were reviewed and fixed together.

**Classification**: All 4 instances (5 individual assertions, since `lot-5-25` counts as one source file with 2 coupling shapes) are **A. MUST HARDEN NOW** -- same class as the bug already fixed in `lot-5-29`, coupled to an ACTIVE LEGACY root with demonstrated historical drift (`estimatedCharges` changed from 14 to 12 during the `savingsGoal` removal; `currentMonthTotal` has not changed yet, but nothing structurally prevents it from changing on a future, unrelated Legacy-boundary change).

No **B. SAFE TO RETAIN** or **C. HISTORICAL ONLY** instances were found in this set -- unlike LOT 5.97's spot-check of the *other* dozens of cross-file `readFileSync` calls in the suite (Section 6 of that report), which found those to be structural/behavioral (test descriptions, headline strings) rather than magic-number literals. This set is different: it is literally the same numeric-literal-duplication shape as the confirmed break.

## 4. Cross-File Couplings Hardened

All 4 files were hardened using preference (2) from the task's stated order: derive the expectation from a constant already local to the same test file, mirroring the exact pattern LOT 5.97 used for `lot-5-29`.

`lot-5-21`, `lot-5-22`, `lot-5-26` (identical fix in each):

```js
// before
assert.match(LOT_5_18_SOURCE, /currentMonthTotal: 24/);
assert.match(LOT_5_18_SOURCE, /fiscalSummaryVisibleSlice: 15/);

// after
assert.match(
  LOT_5_18_SOURCE,
  new RegExp(`currentMonthTotal:\\s*${APPROVED_APP_COUNTS.currentMonthTotal}\\b`),
);
assert.match(
  LOT_5_18_SOURCE,
  new RegExp(`fiscalSummaryVisibleSlice:\\s*${APPROVED_APP_COUNTS.fiscalSummaryVisibleSlice}\\b`),
);
```

`lot-5-25` (broader fix -- one shared pattern reused across 5 cross-file assertions instead of 5 separate hardcoded literals):

```js
const currentMonthTotalPattern = new RegExp(
  `currentMonthTotal:\\s*${APPROVED_APP_COUNTS.currentMonthTotal}\\b`,
);

assert.match(LOT_5_18_SOURCE, currentMonthTotalPattern);
assert.match(
  LOT_5_18_SOURCE,
  new RegExp(`fiscalSummaryVisibleSlice:\\s*${APPROVED_APP_COUNTS.fiscalSummaryVisibleSlice}\\b`),
);
// ...
assert.match(LOT_5_20_SOURCE, currentMonthTotalPattern);
assert.match(LOT_5_21_SOURCE, currentMonthTotalPattern);
assert.match(LOT_5_22_SOURCE, currentMonthTotalPattern);
assert.match(LOT_5_24_SOURCE, currentMonthTotalPattern);
```

Each file's own `APPROVED_APP_COUNTS.currentMonthTotal` (24) and `.fiscalSummaryVisibleSlice` (15) were already independently re-verified against live `src/App.jsx` by that same file's existing "no new React or pipeline execution surface" style test, so this reuses an already-verified local source of truth rather than introducing a new one. No second hardcoded literal remains in any of the 4 files. Verified independently against current `src/App.jsx`: `currentMonthTotal` = 24, `fiscalSummaryVisibleSlice` = 15 (Section 14).

## 5. Unnormalized Reads Reviewed

Every `extractBlock`/`indexOf` marker and every `assert.match` regex in all 6 files (`lot-5-13`, `14`, `15`, `18`, `57`, `64`) was individually inspected for an embedded `\n` or `\r\n`.

| File | Markers checked | Embedded `\n`/`\r\n` found | Verdict |
| --- | --- | --- | --- |
| `lot-5-13-first-visible-replacement.test.js` | 2 `extractBlock`-style extractions (`extractVisibleSliceBlock`, `extractDashboardDisplayBlock`) | none | SAFE |
| `lot-5-14-first-visible-replacement-validation.test.js` | 3 extractions (`visibleSliceBlock`, `shadowBlock`, `dashboardDisplayBlock`) | none | SAFE |
| `lot-5-15-first-slice-stabilization.test.js` | 3 extractions (same shape as `lot-5-14`) | none | SAFE |
| `lot-5-18-legacy-retention-hardening.test.js` | 6 extractions (`visibleSliceBlock`, `shadowBlock`, `dashboardDisplayBlock`, `objectiveSavingsTextBlock`, `exportBlock`, `feedbackBlock`, `monthlyReflectionBlock`) | none | SAFE |
| `lot-5-57-extended-stabilization.test.js` | 7 extractions (`monthlyReflectionRegion`, `monthlyReflectionBlock`, `visibleSliceBlock`, `smartAlertsBlock`, `coachingBlock`, `exportBlock`, `assistantGuidanceBlock`, `persistenceBlock`) | none | SAFE |
| `lot-5-64-extended-stabilization.test.js` | 2 extractions (`visibleSliceBlock`, `smartAlertsBlock`) | 1 -- but not in a marker (see below) | SAFE (verified) |

`lot-5-64` is the one file with an embedded `\n` anywhere in the file: `assert.match(smartAlerts, /smartAlertEstimatedCharges,\s*\n\s*smartAlertRevenueTotal/)` and a sibling `doesNotMatch` check. This is **not** an `extractBlock` start/end marker -- it is a content regex applied *after* extraction, checking formatting inside the already-extracted `smartAlerts` string. `\s*\n\s*` is CRLF-safe by construction: `\s` matches `\r` as well as `\n`, so the pattern's leading/trailing `\s*` absorb any `\r` around the literal `\n`, and regex backtracking finds a valid split regardless of whether the underlying line break is `\r\n` or `\n`. Verified directly:

```js
node -e "console.log(/,\s*\n\s*b/.test('a,\r\n  b'))"
// true
```

**Conclusion for all 6 files: SAFE TO RETAIN unnormalized.** Every `extractBlock`/`indexOf` marker in all 6 files is single-line with no embedded line-break character, so `indexOf` against an unnormalized (CRLF) `APP_SOURCE` behaves identically to `indexOf` against a normalized (LF) one -- the only place CRLF-vs-LF could matter (a multi-line marker) does not exist in any of the 6 files' extraction logic. No file was touched to standardize style absent a demonstrated risk, per the task's explicit instruction.

## 6. CRLF/LF Hardening

None performed. No file in the 6-file review set required normalization (Section 5). No new CRLF/LF robustness test was added, since none of the 6 files' extraction logic is line-ending sensitive -- adding a robustness test for a risk that does not exist in a given file would not verify anything the file doesn't already guarantee, and would inflate the suite without protective value.

## 7. Whole-File Counts Reviewed

The 19-file list from LOT 5.97 Section 18: `lot-5-21/22/24/25/26/29/32/35/37/40/65/66/70/72/73/79/81/82/86`. `lot-5-29` was already supplemented in LOT 5.97 and is not modified again here.

Two sub-shapes exist across this set, matching LOT 5.97 Section 5's classification, re-confirmed by direct inspection:

1. **Per-identifier reference-count guards** (`fiscalSummaryVisibleSlice`, `currentMonthTotal`, `estimatedCharges`, `savingsGoal`, `buildFiscalSummaryInput`, `calculateFiscalSummary`, `createRuntimeParityEvidence`, etc. inside each file's `APPROVED_APP_COUNTS`/`APPROVED_COUNTS`). **Class A -- SECURITY/SCOPE COUNT.** These are the guards that actually block a new unapproved Legacy/Shadow consumer from being silently added; each is independently re-verified against live `src/App.jsx` by the same test in every file. **No changes made to any of these in this LOT.**
2. **Generic React hook totals** (`useState`, `useEffect`, `useMemo` raw whole-file counts). **Class B -- IMPLEMENTATION COUNT.** These shift on any unrelated hook addition or removal anywhere in the ~15,000-line file, independent of whether the guard's actual protective intent (catching a new hook inside a specific boundary) was violated. This is the class targeted for hardening.

| Files | Already has `savingsGoal`-boundary extraction helpers (`coachingSavingsGoalBranch`/`Block`, `pdfSavingsGoalBranch`/`Block`, `progressIndicatorsBlock`/`progressFillBlock`, `lowReserveBranch`) | Supplement added |
| --- | --- | --- |
| `lot-5-32`, `35`, `37`, `40` | Yes -- all three boundaries (UI, coaching, PDF) | Yes (Section 9) |
| `lot-5-79`, `81`, `82` | Partial -- coaching + PDF alias blocks and `lowReserveBranch`, no UI boundary extractor (these files predate `lot-5-32`'s UI-family scope) | Yes, scoped to what already exists (Section 9) |
| `lot-5-86` | Partial -- coaching alias block, PDF alias block, PDF Objectif line; no UI/coaching-branch extractor (this file is PDF-family only) | Yes, scoped to what already exists (Section 9) |
| `lot-5-21`, `22`, `24`, `25`, `26` | No -- these predate the `savingsGoal` boundary comments (LOT 5.79A/5.86A postdate this "next consumer migration" chain); their whole-file counts protect the URSSAF-gate/progress-gate migration, not the `savingsGoal` boundaries | Not added (Section 20 -- ACCEPTED debt) |
| `lot-5-65`, `66`, `70`, `72`, `73` | No -- these are the smart-alert families; their whole-file counts protect the smart-alert Shadow migration, not the `savingsGoal` boundaries | Not added (Section 20 -- ACCEPTED debt) |

## 8. Counts Retained Intentionally

Every Class A per-identifier reference count in all 19 files (and in `lot-5-18`, which anchors the family) was left completely unchanged in this LOT -- confirmed by `git diff`-equivalent inspection (the files are untracked/new in this branch, so this was confirmed by re-reading each file's `APPROVED_APP_COUNTS`/`APPROVED_LEGACY_REFERENCES` object after editing and diffing against the pre-edit read). No numeric literal inside any of these objects was touched. This includes the Shadow baseline `fiscalSummaryVisibleSlice: 15` and every Legacy-root reference count (`currentMonthTotal: 24`, `estimatedCharges: 12`, `savingsGoal: 0`, `availableAmount: 8`, `legacySnapshot: 2`) everywhere they appear across the 12 modified files.

## 9. Counts Hardened

8 files received one new scoped test each, supplementing (not replacing) their existing whole-file `useState`/`useEffect`/`useMemo` counts, using only each file's own already-present local extraction helpers (no new extraction logic, no shared helper):

| File | Scoped blocks checked | Reason those specific blocks and not others |
| --- | --- | --- |
| `lot-5-32-isolated-savingsgoal-ui-migration.test.js` | `progressIndicatorsBlock()`, `coachingSavingsGoalBranch()`, `pdfSavingsGoalBranch()` | All three `savingsGoal` boundaries already extracted by this file for content checks |
| `lot-5-35-isolated-savingsgoal-ui-stabilization.test.js` | same three | same reason |
| `lot-5-37-objective-savings-progress-bar-migration.test.js` | same three | same reason |
| `lot-5-40-objective-savings-progress-bar-stabilization.test.js` | same three | same reason |
| `lot-5-79-savingsgoal-coaching-migration.test.js` | `coachingSavingsGoalBlock()`, `lowReserveBranch()` | `fiscalCoachingCardBlock()` deliberately excluded -- its own start marker is the `useMemo(` declaration of the coaching card itself, so a zero-count check against it would always fail regardless of actual boundary content |
| `lot-5-81-savingsgoal-coaching-migration-validation.test.js` | `coachingSavingsGoalBlock()`, `lowReserveBranch()` | same reason |
| `lot-5-82-savingsgoal-coaching-stabilization.test.js` | `coachingSavingsGoalBlock()`, `pdfSavingsGoalBlock()`, `lowReserveBranch()` | same reason; this file additionally has its own `pdfSavingsGoalBlock()` |
| `lot-5-86-savingsgoal-pdf-migration.test.js` | `fiscalCoachingSavingsGoalBlock()`, `pdfSavingsGoalBlock()`, `pdfObjectifLineBlock()` | `savingsProgressBlock()` deliberately excluded -- its own start marker is the `useMemo(` declaration of `savingsProgress` (a separate, still-Legacy value, not part of this LOT's approved boundary) |

Each new test is named `"LOT 5.98 supplements the whole-file hook counts with a scoped savingsGoal-boundary check"` and asserts `occurrences(block, /\buseState\(/g) === 0`, `/\buseEffect\(/g === 0`, `/\buseMemo\(/g === 0` for every block in that file's scoped list. This mirrors LOT 5.97's `lot-5-29` supplement byte-for-byte in intent: it independently fails if a new hook is ever introduced *inside* one of these specific boundaries, regardless of what else changes elsewhere in the file, without weakening or replacing the existing whole-file totals.

The remaining 11 files in the 19-file list (`lot-5-21`, `22`, `24`, `25`, `26`, `65`, `66`, `70`, `72`, `73`) were **not** modified -- see Section 7's table and Section 20 for reasoning.

## 10. Comment/Text Anchor Review

No new comment-anchor dependency was introduced by this LOT. The 8 files hardened in Section 9 reuse the same `// LOT 5.79A coaching boundary: source-only denominator migration.` and `// LOT 5.86A PDF boundary: source-only denominator migration.` comment anchors LOT 5.97 Section 7 already reviewed and classified as intentional, permanent-by-design architectural boundary markers (`lowReserveBranch()` in `lot-5-79`/`81`/`82` anchors on the coaching comment; the `pdfSavingsGoalBranch()`-style helpers in `lot-5-32`/`35`/`37`/`40` anchor on both). No harmless-rewording risk was newly created, since this LOT did not add any anchor -- it only added assertions against blocks already extracted by pre-existing anchors.

No other comment-anchor dependency was encountered while performing Steps 1-3 (the cross-file coupling fixes in Section 4 do not use comment anchors at all -- they use `readFileSync` on whole test files and regex against `APPROVED_APP_COUNTS` object literals). Per the task's explicit instruction, no anchor hunting was performed outside what was encountered in Steps 1-3.

## 11. Shared Helper Decision

**Decision: do not create a shared test helper module.** Re-evaluated independently for this phase's actual work, not assumed from LOT 5.97.

Reasoning:

1. The Section 4 fix (cross-file coupling) was applied by copy-pasting a `new RegExp(...APPROVED_APP_COUNTS...)` expression into 4 files -- each file already had its own independently-verified `APPROVED_APP_COUNTS` object; the fix reads from that file's own object, not from a shared module. There is nothing to extract into a helper: the "shared" part is a naming convention (`APPROVED_APP_COUNTS.currentMonthTotal`), not a function.
2. The Section 9 fix (hook-boundary supplement) reused each file's own pre-existing local `extractBlock`-based helper functions (`coachingSavingsGoalBranch()`, `pdfSavingsGoalBlock()`, `lowReserveBranch()`, etc.) -- these already existed in every one of the 8 files before this LOT, for other tests' content checks. The only new code per file is one `test(...)` block with a `for` loop over 2-3 already-extracted strings; there is no duplicated extraction logic to consolidate.
3. A shared helper (e.g. a `assertNoHooksIn(blocks)` utility) would save perhaps 3 lines per file at the cost of introducing exactly the single-point-of-failure risk LOT 5.97 Section 8 already identified: one bug or incompatible signature change in the helper would cascade across 8+ files simultaneously instead of being isolated. The per-file duplication here is a `for` loop over 3 `assert.equal` calls -- not the multi-line, easy-to-get-wrong CRLF-normalization logic LOT 5.92 fixed 4 times independently. The cost/benefit does not clear the bar LOT 5.97 set.
4. No fresh evidence from this phase shows multiple files needing a shared *primitive* with real complexity -- both fixes in this LOT are thin, mechanical, and file-local by nature. The task's own criteria ("no shared helper unless Phase 2 itself reveals multiple files needing the exact same primitive, with a tiny API... and no fragile central registry") is not met: the primitive here (`occurrences(block, /\buseState\(/g) === 0`) is already a one-line call to each file's own pre-existing `occurrences()` function, not a new primitive at all.

## 12. Files Modified

Exactly 12 test files, plus this report. Declared before editing (Step 6), executed as declared:

| File | Fragility class(es) | Reason to modify | Transformation |
| --- | --- | --- | --- |
| `tests/lot-5-21-next-consumer-migration-validation.test.js` | C (cross-file magic-number coupling), class A per Section 3 | Dormant duplicate of the exact bug class fixed in `lot-5-29` | Replace 2 hardcoded literals with `new RegExp(...APPROVED_APP_COUNTS...)` |
| `tests/lot-5-22-next-consumer-stabilization.test.js` | same | same | same |
| `tests/lot-5-25-next-consumer-migration-validation.test.js` | same (5 coupling sites) | same | Same pattern, reused via one shared local `currentMonthTotalPattern` constant across 5 assertions |
| `tests/lot-5-26-next-consumer-stabilization.test.js` | same | same | same |
| `tests/lot-5-32-isolated-savingsgoal-ui-migration.test.js` | B (whole-file hook count) | Direct sibling of `lot-5-29`, already extracts all 3 `savingsGoal` boundaries | Add 1 scoped zero-hook supplement test |
| `tests/lot-5-35-isolated-savingsgoal-ui-stabilization.test.js` | same | same | same |
| `tests/lot-5-37-objective-savings-progress-bar-migration.test.js` | same | same | same |
| `tests/lot-5-40-objective-savings-progress-bar-stabilization.test.js` | same | same | same |
| `tests/lot-5-79-savingsgoal-coaching-migration.test.js` | same | Extracts coaching+PDF alias blocks and the low-reserve branch | Add 1 scoped zero-hook supplement test (2 blocks) |
| `tests/lot-5-81-savingsgoal-coaching-migration-validation.test.js` | same | same | same |
| `tests/lot-5-82-savingsgoal-coaching-stabilization.test.js` | same | Also has its own `pdfSavingsGoalBlock()` | Add 1 scoped zero-hook supplement test (3 blocks) |
| `tests/lot-5-86-savingsgoal-pdf-migration.test.js` | same | PDF-family boundary blocks | Add 1 scoped zero-hook supplement test (3 blocks) |

No file outside this list was opened for writing. No file under `src/` was opened for writing at any point in this LOT (only read, via `readFileSync` inside the test files themselves at test-run time, and via a read-only `node -e` verification script in Section 14).

## 13. Guard Semantics Preserved

| Guard | Before | After | Still enforces |
| --- | --- | --- | --- |
| `currentMonthTotal` == 24 in `lot-5-18` (checked from `lot-5-21`/`22`/`25`/`26`) | hardcoded literal in each of 4-5 files | re-derived from each file's own live-verified `APPROVED_APP_COUNTS.currentMonthTotal` | yes -- a real drift between `lot-5-18` and the checking file's own baseline still fails loudly |
| `fiscalSummaryVisibleSlice` == 15 in `lot-5-18` (same 4 files) | hardcoded literal | re-derived from local `APPROVED_APP_COUNTS.fiscalSummaryVisibleSlice` | yes, same reasoning |
| `lot-5-25`'s cross-check of `lot-5-20`/`21`/`22`/`24`'s `currentMonthTotal` | 4 separate hardcoded literals | 1 shared local pattern reused 4x, still checked against all 4 sibling files independently | yes -- each sibling file individually still must match |
| Whole-file `useState`/`useEffect`/`useMemo` totals in all 12 modified files | asserted via `APPROVED_APP_COUNTS`/`APPROVED_COUNTS` loop | unchanged, same loop, same values | yes |
| No new hook inside the `savingsGoal` boundaries in `lot-5-32`/`35`/`37`/`40`/`79`/`81`/`82`/`86` | not previously checked in isolation in these files (only via whole-file totals) | new scoped test added per file | yes -- stronger than before, not weaker |
| Every existing content/formula/JSX/persistence/payload/assistant assertion in all 12 files | unchanged | unchanged | yes |

No assertion was deleted. No assertion was weakened to a vague check. No existing test name/description was changed except the one being hardened (its assertions' internal implementation changed, its name and intent did not). Every new test is purely additive.

## 14. Targeted Validation

| Step | Command | Result |
| --- | --- | --- |
| A | `node --test` on each of the 4 coupling-hardened files individually, then combined (`lot-5-21`, `22`, `25`, `26`) | PASS - 82/82 |
| B | `node --test` on each of the 8 count-hardened files individually | PASS - `32`:26/26, `35`:32/32, `37`:27/27, `40`:21/21, `79`:17/17, `81`:19/19, `82`:18/18, `86`:12/12 |
| C | Combined run of the full affected guard family (`lot-5-18/20/21/22/24/25/26/29/30/32/34/35/37/39/40/77/79/81/82/84/86/88/91`) | PASS - 422/422 |
| D | `node --test tests/shadow-parity-validation.test.js tests/runtime-parity-evidence.test.js` | PASS - 17/17 |
| E | `npx eslint` on all 12 modified files | PASS - 0 problems |
| F | Independent re-verification of `currentMonthTotal`/`fiscalSummaryVisibleSlice`/`estimatedCharges`/`savingsGoal`/`useState`/`useEffect`/`useMemo` against live `src/App.jsx` via a standalone read-only `node -e` script | `fiscalSummaryVisibleSlice`=15, `currentMonthTotal`=24, `estimatedCharges`=12, `savingsGoal`=0, `useState(`=81, `useEffect(`=58, `useMemo(`=87 -- all match every file's asserted baseline |

No sandboxed `spawn EPERM` was encountered; every command ran directly without `dangerouslyDisableSandbox`.

Steps A-F were fully clean, so full validation (Steps 15-19) proceeded.

## 15. Full Node Suite

```txt
node --test
```

Result:

```txt
tests 908
pass 908
fail 0
```

908 = the LOT 5.97 baseline of 900 plus the 8 new scoped supplement tests added in Section 9 (the 4 coupling-hardening files added no new tests, only hardened existing assertions). Zero failures anywhere in the repository.

## 16. Build

```txt
npm run build
```

Result: `PASS` (`358 modules transformed`, built in `3.98s`). The pre-existing Vite chunk-size-over-500kB warning is present and accepted, not a failure -- unchanged from every prior LOT's baseline.

## 17. Global Lint

```txt
npm run lint
```

Result:

```txt
50 problems (21 errors, 29 warnings)
```

Exact expected baseline, byte-for-byte the same as LOT 5.89/5.95/5.96/5.97 (19 `no-unused-vars` + 2 `react-refresh/only-export-components`). No new lint problem was introduced by this LOT's 12 modified test files.

## 18. Playwright Run 1

```txt
npx playwright test --reporter=line
11 passed (12.5s)
```

## 19. Playwright Run 2

```txt
npx playwright test --reporter=line
11 passed (12.2s)
```

Repeated exactly once more, per instruction; both runs 11/11.

## 20. Remaining Debt

**CRITICAL: 0 remaining.**

**MEDIUM:**

1. **11 files' whole-file `useState`/`useEffect`/`useMemo` totals remain unsupplemented** (`lot-5-21`, `22`, `24`, `25`, `26`, `65`, `66`, `70`, `72`, `73`). These shift on any unrelated hook change anywhere in the file, same as before this LOT. They are MEDIUM, not CRITICAL, because: (a) they are per-identifier-named-message assertions (`assert.equal(..., identifier)`), so a failure is immediately self-explanatory (the failing message names the exact identifier and expected/actual count) rather than a silent false negative; (b) fixing them would require adding new extraction infrastructure these files don't already have, which is a materially larger and more invasive change than reusing existing helpers (Section 7); (c) none of them has ever caused a false failure historically outside the `savingsGoal` chain LOT 5.91A-5.95 already fully resolved.
2. **The `// ==================== PREVIEW POUR MODALE AJOUT REVENU ====================` comment anchor** used by 5+ files, unchanged from LOT 5.97 Section 18 item 4 -- cosmetic UI divider, no architectural contract, never caused a break, not encountered as a dependency while doing Steps 1-3 of this LOT.
3. **~30 files outside the `lot-5-18`-`lot-5-91` "savingsGoal era" range** not audited in this LOT either (same as LOT 5.97 Section 18 item 6) -- out of scope per this LOT's explicit instruction to work from LOT 5.97's inventory only.

**ACCEPTED:**

1. **Duplicated `extractBlock`/`sourceWithoutComments`/`occurrences` helper functions across 47+ files** (LOT 5.97 class E) -- confirmed again in this LOT's Section 11 shared-helper review: the duplication is simple, correct, low-risk, and consolidating it now would introduce a single point of failure with no evidenced bug to justify the risk.
2. **No shared helper module** (Section 11) -- re-affirmed with fresh reasoning specific to this phase's work, not carried over unexamined from LOT 5.97.

## 21. Stop-Hardening Criteria Assessment

| Criterion | Status |
| --- | --- |
| No live CRLF-sensitive guard remains | Confirmed. Section 5 found zero line-ending-sensitive markers in the 6-file review set; LOT 5.92/5.94/5.97's fixes remain intact (re-confirmed passing in Section 14 Step C). |
| No dangerous cross-file magic-number coupling remains (Step 1 class A all resolved) | Confirmed. All 4 dormant instances named in LOT 5.97 were classified A and hardened in Section 4. No class A instance was left unresolved. |
| No comment-only critical anchor remains | Confirmed. Section 10: no new anchor was introduced; the two intentional architectural boundary comments (LOT 5.79A/5.86A) remain correctly classified as intentional per LOT 5.97 Section 7; the one cosmetic anchor (Section 20 item 2) has never caused a break and is not critical. |
| Shadow baseline guard remains strong | Confirmed. `fiscalSummaryVisibleSlice = 15` re-verified against live `src/App.jsx` in Section 14 Step F; every file's own count assertion still passes; no 16th occurrence exists. |
| Legacy retention guards remain explicit | Confirmed. `currentMonthTotal` (24), `estimatedCharges` (12), `savingsGoal` (0) all re-verified against live `src/App.jsx`; no Legacy root, formula, or boundary was touched or turned into a migration-planning artifact. This LOT migrated nothing. |
| Remaining whole-file counts are either intentional scope guards (class A) or documented accepted debt | Confirmed. Section 7/8: every class A per-identifier count remains untouched and enforcing. Section 20: the 11 unsupplemented class B files are explicitly classified MEDIUM, not left silently undocumented. |

All six criteria are satisfied. Zero CRITICAL debt remains.

## 22. Runtime Scope

Confirmed by `git status` and by tracking every file opened for writing during this LOT:

- `src/App.jsx` was not opened for writing at any point in this LOT (only read, via each test file's own `readFileSync` at test-run time and via one standalone read-only `node -e` verification script in Section 14 Step F);
- no file under `src/` (including `src/application/`, `src/domain/`, `src/navigation/`, `src/shell/`, `src/utils/obligations.js`) was modified;
- `package.json`, `eslint.config.js`, and `playwright.config.js` were not modified;
- the pre-existing modified-but-uncommitted state of `src/App.jsx`, `src/utils/obligations.js`, `playwright.config.js`, `tests/home.spec.js`, and `tests/premium.spec.js` shown in `git status` predates this LOT (part of the ongoing, separate SaaS-shell-v2 refactor, already documented in LOT 5.97 Section 17) and was not touched by this LOT;
- `fiscalCoachingSavingsGoal`, `pdfSavingsGoal`, `fiscalSummaryVisibleSlice`, every formula, rate, rounding rule, threshold, message, and fallback in `src/App.jsx` are untouched;
- no consumer migration, Shadow selector change, or Legacy root change occurred;
- the entire change surface of this LOT is: 4 test files' cross-file assertion expected-value construction (magic literal -> derived regex), and 8 test files' addition of one new, purely additive scoped test each.

## 23. Recommended Next Phase

The task's own stop-hardening criteria (Section 21) are all satisfied and zero CRITICAL debt remains. Per the explicit instruction not to recommend a further hardening phase merely to homogenize style, this LOT does **not** recommend a "Phase 3" test-architecture LOT. The remaining MEDIUM/ACCEPTED debt (Section 20) is bounded, documented, self-explanatory on failure (named-identifier assertion messages), and has not caused a false failure outside the already-fully-resolved `savingsGoal` chain.

The suite is fully green, the two-phase hardening effort (LOT 5.97 + LOT 5.98) has addressed every CRITICAL-risk item identified across the `savingsGoal` removal (LOT 5.89-5.96) and its own follow-up review, and no further test-architecture work is required before a release readiness review. The appropriate next step is the Release Stabilization Gate the LOT 5.97/5.98 chain was explicitly scoped to prepare for.

## 24. Final Decision

Every validation gate cleared cleanly: targeted (Steps A-F), full Node suite (908/908, 0 fail), build, lint (exact baseline), and Playwright (11/11 twice). All 4 dormant cross-file magic-number couplings named in LOT 5.97 were reviewed, classified, and hardened. All 6 unnormalized-read files were reviewed and correctly left unchanged (no CRLF-sensitive marker exists in any of them). 8 of the 19 whole-file count files -- the ones with pre-existing, reusable boundary-extraction infrastructure and direct proximity to the historically-demonstrated bug class -- received a scoped, purely additive hardening supplement; the remaining 11 were classified MEDIUM debt with explicit reasoning rather than mechanically retrofitted. No shared test helper was introduced, re-derived independently from this phase's actual (thin, file-local) work rather than assumed from LOT 5.97. No `src/` file, runtime formula, or config file was touched at any point.

Zero CRITICAL debt remains per Section 20/21. This satisfies every stop-hardening criterion in Section 21.

```txt
GO POUR LOT 5.99 — RELEASE STABILIZATION GATE
```
