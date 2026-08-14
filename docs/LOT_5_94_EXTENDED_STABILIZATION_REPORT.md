# LOT 5.94 - Extended Stabilization Report

## 1. Executive Summary

LOT 5.94 fixed the 20 historical guard failures LOT 5.93 found in four test files (`lot-5-18`, `lot-5-20`, `lot-5-21`, `lot-5-22`) that fell outside every prior `savingsGoal`-token-driven audit. Re-derived directly from the current suite (not copied from LOT 5.93's report), the failures split into two classes: an unnormalized-CRLF `urssafHelperBlock()` marker-search bug (same root cause LOT 5.92 fixed in three sibling files) and stale hardcoded `estimatedCharges`/`useMemo` counts left over from the LOT 5.91A root removal.

Result:

```txt
All 20 original failures fixed across the 4 authorized files.
Targeted validation (Step 5): fully clean.
Full node suite (Step 6): 898 tests, 897 pass, 1 fail -- a single, pre-existing,
out-of-scope cross-file guard coupling in tests/lot-5-29-savingsgoal-architecture-hardening.test.js
(not one of this LOT's 4 authorized files), discovered as a side effect of correctly
fixing lot-5-18's stale count.
```

No `src/` file, config file, or file outside the four authorized test files was modified. Because Step 6 did not clear cleanly, build/lint/Playwright were not run, per the LOT's explicit stop rule.

## 2. Original 20 Failures

Re-derived by running each of the four files individually before any edit (ground truth, not assumed from LOT 5.93's report):

| File | Failures found | LOT 5.93 report predicted |
| --- | ---: | ---: |
| `tests/lot-5-18-legacy-retention-hardening.test.js` | 1 | 1 |
| `tests/lot-5-20-next-consumer-migration.test.js` | 5 | 5 |
| `tests/lot-5-21-next-consumer-migration-validation.test.js` | 6 | 6 |
| `tests/lot-5-22-next-consumer-stabilization.test.js` | 8 | 8 |
| **Total** | **20** | **20** |

Totals matched exactly. The class breakdown within `lot-5-20` differed slightly from LOT 5.93's estimate: the report guessed "3 CRLF + 2 stale count," the actual run showed **4 CRLF + 1 stale count** (only one assertion in `lot-5-20` reads the `estimatedCharges` key from `APPROVED_REFERENCE_COUNTS`, so only one test failed on that count; the other four failing tests were all CRLF/`urssafHelperBlock()` misses). `lot-5-18`, `lot-5-21`, and `lot-5-22`'s breakdowns matched the report exactly.

## 3. CRLF Failure Class

Present in `lot-5-20`, `lot-5-21`, `lot-5-22` (not `lot-5-18`, which has no `urssafHelperBlock()` helper at all). Identical root cause to LOT 5.92: each file's `APP_SOURCE` was read with `readFileSync(..., "utf8")` and no CRLF-to-LF normalization, while `urssafHelperBlock()`'s end marker is a multi-line literal hardcoded with bare `\n`:

```js
"                        </>\n                      ) : (\n                        <>\n                          <button"
```

Since `src/App.jsx` is CRLF end-to-end, `APP_SOURCE.indexOf(endText, start)` always returned `-1`, and every test that (directly or via another helper) called `urssafHelperBlock()` failed with `actual: -1, expected: -1` on `assert.notEqual`.

| File | Tests affected by this class |
| --- | ---: |
| `tests/lot-5-20-next-consumer-migration.test.js` | 4 |
| `tests/lot-5-21-next-consumer-migration-validation.test.js` | 6 |
| `tests/lot-5-22-next-consumer-stabilization.test.js` | 7 |
| **Total** | **17** |

## 4. Stale Count Failure Class

| File | Identifier | Old (hardcoded) | Actual (live source) | Test affected |
| --- | --- | ---: | ---: | --- |
| `tests/lot-5-18-legacy-retention-hardening.test.js` | `estimatedCharges` | 14 | 12 | "blocks unapproved new Legacy consumers with a deterministic reference count guard" |
| `tests/lot-5-20-next-consumer-migration.test.js` | `estimatedCharges` | 14 | 12 | "does not add a flag, state, effect, Adapter execution or Facade execution" |
| `tests/lot-5-22-next-consumer-stabilization.test.js` | `useMemo` | 89 | 88 | "keeps React counts, Adapter execution and Facade execution stable" |

All three failures showed `AssertionError [ERR_ASSERTION]` with the exact old/new values above (`12 !== 14` twice, `88 !== 89` once) -- confirmed directly from the pre-fix `node --test` runs, not assumed.

## 5. Files Modified

Exactly the four authorized files, no others:

```txt
tests/lot-5-18-legacy-retention-hardening.test.js       -- count fix only
tests/lot-5-20-next-consumer-migration.test.js          -- CRLF fix + count fix + robustness test
tests/lot-5-21-next-consumer-migration-validation.test.js -- CRLF fix + robustness test (no stale count)
tests/lot-5-22-next-consumer-stabilization.test.js      -- CRLF fix + count fix + robustness test
```

`git status` after all edits shows these four files as the only test/doc changes from this LOT (plus this report). `src/App.jsx` and `src/utils/obligations.js` show as modified in `git status`, but that reflects the pre-existing, already-uncommitted SaaS-shell-v2 refactor diff present in the working tree before this LOT began -- neither file was opened for writing at any point in this LOT.

## 6. CRLF Normalization

Applied the exact LOT 5.92 pattern, byte-for-byte, to the `APP_SOURCE` read line in `lot-5-20`, `lot-5-21`, `lot-5-22` -- nothing else on that line touched:

```js
// LOT 5.92: normalize CRLF to LF so line-ending style never affects marker search.
const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
```

No marker text, `extractBlock()` logic, or business assertion was changed. `lot-5-18` needed no CRLF fix (it has no `urssafHelperBlock()` function).

Each of the three files also received the same local, inline robustness test LOT 5.92 added to `lot-5-24/25/26` (copied verbatim from `lot-5-24`'s idiom, not shared as a new helper module):

```txt
LOT 5.92 urssafHelperBlock extraction is identical for CRLF and LF source line endings
```

It independently re-reads `src/App.jsx`, forces one copy to strict CRLF and derives an LF copy from it, extracts the `urssafHelperBlock()` region from both using a local extraction routine, and asserts the two extractions are identical and match the file's own (now-fixed) `urssafHelperBlock()` output.

## 7. estimatedCharges Count Update

Old value `14`, new value `12`, delta `-2`, updated in `lot-5-18`'s `APPROVED_LEGACY_REFERENCES` and `lot-5-20`'s `APPROVED_REFERENCE_COUNTS`:

```js
// LOT 5.91A: root savingsGoal removed, dropping 2 estimatedCharges reads (formula body + dependency array) and 1 useMemo hook.
estimatedCharges: 12,
```

Verified independently against live `src/App.jsx`:

```txt
occurrences(sourceWithoutComments(APP_SOURCE), /\bestimatedCharges\b/g) = 12
```

Arithmetic: the removed `savingsGoal` `useMemo` hook read `estimatedCharges` exactly twice -- once in its formula body (`Math.max(estimatedCharges * 3, 500)`) and once in its own dependency array (`[estimatedCharges]`). `14 - 2 = 12`, matching both the live count and the identical fix already applied to `lot-5-24/25/26` in LOT 5.91A (`estimatedCharges: 12` with the same comment).

## 8. useMemo Count Update

Old value `89`, new value `88`, delta `-1`, updated in `lot-5-22`'s `APPROVED_APP_COUNTS`:

```js
// LOT 5.91A: root savingsGoal removed, dropping 2 estimatedCharges reads (formula body + dependency array) and 1 useMemo hook.
useMemo: 88,
```

Verified independently against live `src/App.jsx`:

```txt
occurrences(sourceWithoutComments(APP_SOURCE), /\buseMemo\b/g) = 88
```

Arithmetic: exactly one `useMemo` hook (the removed `savingsGoal` declaration) disappeared; `89 - 1 = 88`, matching the live count and the identical fix already applied to sibling files in LOT 5.91A.

`lot-5-18` and `lot-5-20` do not assert a `useMemo` count, so no change was needed there. `lot-5-21` does not assert `useMemo` either (its `APPROVED_APP_COUNTS` block has no `useMemo` key), confirmed by direct inspection -- no false negative was missed.

## 9. Guard Integrity

After the fixes, each modified file's guards still verify, unweakened:

| Guard | lot-5-18 | lot-5-20 | lot-5-21 | lot-5-22 |
| --- | :---: | :---: | :---: | :---: |
| `estimatedCharges` retention in Legacy consumers | yes (12) | yes (12) | n/a (not asserted) | n/a (not asserted) |
| no `savingsGoal` root (`doesNotMatch(uiText, /\bsavingsGoal\b/)`) | yes | yes | yes | yes |
| `fiscalCoachingSavingsGoal` / `pdfSavingsGoal` untouched | yes (not referenced by these 4 files; verified separately in section 17) | yes | yes | yes |
| Shadow baseline `fiscalSummaryVisibleSlice = 15` | yes | yes | yes | yes |
| no 16th Shadow occurrence | yes (exact-count assertion) | yes (exact-count assertion) | yes (exact-count assertion) | yes (exact-count assertion) |
| URSSAF gate assertions (Shadow-only, no Legacy fallback) | n/a | yes | yes | yes |

No assertion was deleted, weakened to a vague check (e.g. `toBeTruthy()`-style), or had its regex loosened. Only the two numeric literals (`estimatedCharges`, `useMemo`) and the `APP_SOURCE` read line were changed, plus one new test added per CRLF-affected file.

## 10. Targeted Validation

| Step | Command | Result |
| --- | --- | --- |
| 1 | `node --test tests/lot-5-18-legacy-retention-hardening.test.js` | PASS - 13/13 |
| 2 | `node --test tests/lot-5-20-next-consumer-migration.test.js` | PASS - 14/14 |
| 3 | `node --test tests/lot-5-21-next-consumer-migration-validation.test.js` | PASS - 20/20 |
| 4 | `node --test tests/lot-5-22-next-consumer-stabilization.test.js` | PASS - 27/27 |
| 5 | Combined: `lot-5-20/21/22/24/25/26` | PASS - 113/113 |
| 6 | `lot-5-91-obsolete-savingsgoal-root-removal`, `shadow-parity-validation`, `runtime-parity-evidence` | PASS - 39/39 |
| 7 | Targeted ESLint on all 4 modified files | PASS - 0 problems |

No sandboxed `spawn EPERM` was encountered; all `node --test` and `npx eslint` invocations ran directly.

Step 5 was fully clean, so Step 6 (full validation) was attempted.

## 11. Full Node Suite

```txt
node --test
```

Result:

```txt
tests 898
pass 897
fail 1
```

The single failure:

```txt
tests/lot-5-29-savingsgoal-architecture-hardening.test.js
"LOT 5.29 keeps Legacy retention and prior analysis intact"
  assert.match(LOT_5_18_SOURCE, /estimatedCharges: 14/);
  -- LOT_5_18_SOURCE is the raw text of tests/lot-5-18-legacy-retention-hardening.test.js,
     read via readFileSync and cross-checked with a literal regex.
```

**This is a newly discovered, out-of-scope finding, not a mistake in this LOT's edits.** `tests/lot-5-29-savingsgoal-architecture-hardening.test.js` -- a file outside this LOT's four-file authorization -- contains a hardcoded cross-file text assertion that mirror-quotes `lot-5-18`'s old (stale, incorrect) `estimatedCharges: 14` literal instead of verifying `lot-5-18`'s guard by structure or behavior. Correcting `lot-5-18`'s stale count to the factually correct `12` (required by this LOT's explicit instructions and independently verified against live `src/App.jsx` in section 7) necessarily broke this unrelated mirror-assertion in `lot-5-29`.

`lot-5-29` is not one of the four files this LOT is authorized to modify, so no edit was made there. This is documented as a blocking discovery for a future LOT, exactly per the hard rule: "if it looks like a real dependency you missed, STOP -- do not force a workaround, document it as a blocking discovery instead."

Confirmed by direct inspection that no other file's cross-reference to `lot-5-18/20/21/22`'s source broke: `lot-5-21`, `lot-5-22`, `lot-5-25`, `lot-5-26` all also read one or more of these four files' raw source via `readFileSync`, but their own cross-checks use structural/behavioral regexes (`/currentMonthTotal: 24/`, `/fiscalSummaryVisibleSlice: 15/`, `/blocks unapproved new Legacy consumers/`, etc.) that remained valid -- the full-suite run's single failure count confirms this is the only casualty.

Per this LOT's explicit gating rule, Step 6 stops here: build, global lint, targeted ESLint (repeat), and both Playwright runs were **not** executed.

## 12. Build

```txt
NOT RUN
```

Reason: gated on the full Node suite passing cleanly. It did not (897/898).

## 13. Global Lint

```txt
NOT RUN
```

Reason: gated on Build passing. Build was not run.

## 14. Targeted ESLint

Already run once in section 10 (PASS, 0 problems, on all 4 modified files). Not re-run a second time in the Step 6 sequence, since Step 6 stopped at its first sub-step (full Node suite).

## 15. Playwright Run 1

```txt
NOT RUN
```

Reason: gated on Node/build/lint gates clearing. They did not.

## 16. Playwright Run 2

```txt
NOT RUN
```

Reason: same as Run 1; a second run was never reached.

## 17. Root Removal Integrity

Re-confirmed by direct, read-only source inspection of `src/App.jsx` after all edits (no file under `src/` was opened for writing at any point in this LOT):

| Condition | Result |
| --- | --- |
| `savingsGoal` whole-word count | `0` |
| `fiscalCoachingSavingsGoal` present, exact formula | yes -- `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` |
| `pdfSavingsGoal` present, exact formula | yes -- `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` |
| Both formulas byte-identical to LOT 5.91A/5.93 documentation | confirmed |
| `estimatedCharges` count matches fixed guards | `12`, matches section 7 |
| `useMemo` count matches fixed guard | `88`, matches section 8 |
| CRLF normalization exists only in test files | confirmed -- `.replace(/\r\n/g, "\n")` appears only in `lot-5-20/21/22` (and pre-existing in `lot-5-24/25/26`), never in `src/` |
| Coaching / PDF / persistence / payload / assistant | unchanged; not touched by this LOT |

## 18. Shadow Baseline

```txt
fiscalSummaryVisibleSlice = 15   (unchanged before and after this LOT)
no 16th occurrence
```

Confirmed by every fixed guard's own exact-count assertion (`fiscalSummaryVisibleSlice: 15` in `lot-5-18`/`lot-5-20`/`lot-5-21`/`lot-5-22`'s approved-count blocks, all of which pass) and independently by direct source inspection. This LOT touched no Shadow-related formula, alias, or consumer.

## 19. Scope Control

Confirmed:

- the only files modified are the four authorized test files: `tests/lot-5-18-legacy-retention-hardening.test.js`, `tests/lot-5-20-next-consumer-migration.test.js`, `tests/lot-5-21-next-consumer-migration-validation.test.js`, `tests/lot-5-22-next-consumer-stabilization.test.js`, plus this new report;
- no file under `src/` was modified;
- `package.json`, ESLint config, and Playwright config were not modified;
- `fiscalCoachingSavingsGoal`, `pdfSavingsGoal`, `fiscalSummaryVisibleSlice`, coaching logic, PDF logic, UI logic, Adapter/Facade/Domain/Rules-Engine code, persistence, payloads, assistant code, formulas, rates, and rounding are untouched;
- no assertion was weakened to a vague check; every changed numeric literal is still a specific, independently-recomputed count;
- the CRLF fix is byte-for-byte the LOT 5.92 pattern, applied only to the `APP_SOURCE` read line;
- the CRLF robustness test is a local, inline, per-file test copied from the established `lot-5-24/25/26` idiom -- no shared runtime helper or shared test module was created;
- `lot-5-29-savingsgoal-architecture-hardening.test.js` was not modified, even though it is the one file whose own latent cross-file coupling bug surfaced as a side effect of this LOT's (correct, in-scope) `lot-5-18` fix -- left untouched per the hard rule restricting modification to the four named files.

## 20. Final Decision

All 20 originally-diagnosed failures in the four authorized files were fixed with independently-recomputed, non-guessed values, matching the established LOT 5.91A/5.92 methodology and cross-checked against the live `src/App.jsx` source. Targeted validation (Step 5) is fully clean: all four files pass individually, the six-file combined run passes (113/113), the root-removal/shadow-parity/runtime-parity suite passes (39/39), and targeted ESLint is clean.

The full Node suite (Step 6) surfaced exactly one failure, in a file this LOT is not authorized to touch (`lot-5-29-savingsgoal-architecture-hardening.test.js`), caused by that file's own latent hardcoded cross-file text assertion mirroring `lot-5-18`'s now-corrected (previously stale/wrong) count. This is a guard-only, out-of-scope discovery -- no `savingsGoal` reappearance, no alias change, no Shadow baseline drift, and no runtime/business-logic change was found anywhere. Per the Step 6 stop rule, build, lint, and Playwright were not run.

```txt
GO POUR LOT 5.95 — EXTENDED GUARD HARDENING
```
