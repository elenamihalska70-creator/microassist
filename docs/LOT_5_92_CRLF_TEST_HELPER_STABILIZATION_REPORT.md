# LOT 5.92 - CRLF Test Helper Stabilization Report

## 1. Executive Summary

LOT 5.92 fixed a line-ending sensitivity bug in three historical guard test files (`lot-5-24`, `lot-5-25`, `lot-5-26`) that caused their `urssafHelperBlock()` extraction to fail against the current, fully-CRLF `src/App.jsx`.

No runtime code, `src/App.jsx`, business assertion, expected value, marker text, or JSX target was changed. Only the raw-source read step in the three test files was normalized.

Result:

```txt
All three previously-failing tests now pass.
Combined targeted run (24 + 25 + 26 + 91): 74/74 PASS.
Targeted ESLint on all three modified files: 0 problems.
```

## 2. Original Failures

Before this LOT, running the three files together produced:

```txt
tests 49
pass 46
fail 3
```

One failure per file, always the same test:

| File | Failing test |
| --- | --- |
| `tests/lot-5-24-next-consumer-migration.test.js` | `LOT 5.24 keeps the URSSAF helper as the only earlier revenue gate migration` |
| `tests/lot-5-25-next-consumer-migration-validation.test.js` | `LOT 5.25 validates visible selector and URSSAF gate remain within approved Shadow list` |
| `tests/lot-5-26-next-consumer-stabilization.test.js` | `LOT 5.26 keeps approved Shadow consumers limited and no new consumer appears` |

All three failures originated in the same shared helper shape: `urssafHelperBlock()`, via `extractBlock()`'s `end` search returning `-1`.

## 3. Root Cause

Each of the three files read `src/App.jsx` with:

```js
const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
```

No CRLF-to-LF normalization was applied. `src/App.jsx` is CRLF end-to-end in the current working tree (confirmed: zero bare-LF line endings anywhere in the file).

`urssafHelperBlock()`'s end marker is a multi-line literal containing bare `\n`:

```js
"                        </>\n                      ) : (\n                        <>\n                          <button"
```

Because the file's actual line breaks are `\r\n` and the marker's line breaks are `\n`, `APP_SOURCE.indexOf(endText, start)` could never match, regardless of whether the target JSX text was present. Every other marker in these files is single-line (no embedded newline), so only this one multi-line marker was affected -- which is exactly why only one test per file failed.

This is unrelated to the LOT 5.91A `savingsGoal` removal: the target JSX (`dashboardDeclareHelper`, around `src/App.jsx` line ~13180) is far from the removal site (~line 6440), and the removal changed no byte of that region.

## 4. CRLF/LF Evidence

Direct reproduction before the fix (`node -e`, run against the real file):

```txt
start index: 427837
end index (LF search):   -1
end index (CRLF search): 429441
has CRLF in file: true
has bare LF (not preceded by CR) in file: false
```

This confirms the target text exists, byte-identical in content, at a fixed offset -- only the newline convention of the search string was wrong.

## 5. Files Modified

Exactly the three authorized files, no others:

```txt
tests/lot-5-24-next-consumer-migration.test.js
tests/lot-5-25-next-consumer-migration-validation.test.js
tests/lot-5-26-next-consumer-stabilization.test.js
```

Created:

```txt
docs/LOT_5_92_CRLF_TEST_HELPER_STABILIZATION_REPORT.md
```

No other file was created, and no other test/doc/config file was touched.

## 6. Extraction Logic Before

```js
const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
...
function extractBlock(startText, endText) {
  const start = APP_SOURCE.indexOf(startText);
  assert.notEqual(start, -1, startText);
  const end = APP_SOURCE.indexOf(endText, start);
  assert.notEqual(end, -1, endText);
  return APP_SOURCE.slice(start, end);
}
```

`APP_SOURCE` carried the file's raw CRLF line endings unchanged into every marker search.

## 7. Extraction Logic After

Only the source-read line changed, in all three files identically:

```js
// LOT 5.92: normalize CRLF to LF so line-ending style never affects marker search.
const APP_SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n",
);
```

`extractBlock()`, `urssafHelperBlock()`, every other block-extraction helper, and every existing marker string are untouched -- they now simply operate on an always-LF `APP_SOURCE`, which matches the LF convention already hardcoded in every multi-line marker (this is the same pattern already used by `tests/lot-5-88-extended-stabilization.test.js`, reused here rather than inventing a new approach).

This is the minimal fix: one `.replace(/\r\n/g, "\n")` at the single point where the file enters each test module, rather than special-casing the one multi-line marker.

## 8. Assertion Integrity

Confirmed no assertion, expected value, marker string, or JSX target changed:

- `urssafHelperBlock()`'s `startText` and `endText` literals are byte-identical to before.
- Every other `extractBlock()`-based helper (`fiscalSummaryVisibleSliceBlock`, `fiscalSummaryShadowBlock`, `progressIndicatorsBlock`, `objectiveSavingsTextBlock`, `feedbackBlock`, `monthlyReflectionBlock`, `exportBlock`, `assistantDraftBlock`, `fiscalProfileCompletenessBlock`) is untouched.
- No `assert.*` call's expected value changed anywhere in the three files.
- `src/App.jsx` was not opened for writing at any point in this LOT.

The only new code is one added test per file (section 9's robustness check) plus the one-line source-normalization change.

## 9. Robustness Check

Each of the three files now also contains:

```txt
LOT 5.92 urssafHelperBlock extraction is identical for CRLF and LF source line endings
```

This test independently re-reads the real `src/App.jsx`, forces one copy to strict CRLF and derives a second copy in strict LF from it, runs the exact same `startText`/`endText` markers through a local extraction routine against both, and asserts:

1. the block extracted from the CRLF copy equals the block extracted from the LF copy;
2. that block equals what the file's own (now-fixed) `urssafHelperBlock()` returns.

This is a test-only, local, inline check -- no new runtime helper was created or exported, per the LOT's constraint. It demonstrates the invariant holds regardless of which line-ending style the raw file happens to have at read time.

## 10. Targeted Validation

| Command | Result |
| --- | --- |
| `node --test tests/lot-5-24-next-consumer-migration.test.js` | PASS - 17/17 |
| `node --test tests/lot-5-25-next-consumer-migration-validation.test.js` | PASS - 16/16 |
| `node --test tests/lot-5-26-next-consumer-stabilization.test.js` | PASS - 19/19 |
| `node --test tests/lot-5-24-...js tests/lot-5-25-...js tests/lot-5-26-...js tests/lot-5-91-obsolete-savingsgoal-root-removal.test.js` (combined) | PASS - 74/74 |

No sandboxed `spawn EPERM` was encountered; all commands ran directly.

Each file's test count increased by exactly 1 (the new robustness test in section 9) versus its pre-LOT-5.92 count; no other test was added, removed, or renamed.

## 11. ESLint

```txt
npx eslint tests/lot-5-24-next-consumer-migration.test.js tests/lot-5-25-next-consumer-migration-validation.test.js tests/lot-5-26-next-consumer-stabilization.test.js
```

Result:

```txt
PASS - 0 problems
```

Global `npm run lint`, full `node --test`, `npm run build`, and Playwright were not run in this LOT, per its authorized-commands scope.

## 12. Runtime Scope

Confirmed:

- `src/App.jsx` was not modified;
- no file under `src/` was modified;
- `package.json`, `eslint.config.js`, and the Playwright config were not modified;
- `fiscalCoachingSavingsGoal`, `pdfSavingsGoal`, `fiscalSummaryVisibleSlice`, and every business formula, rate, rounding, threshold, message, and fallback are untouched;
- no consumer migration occurred;
- the fix is confined to how three test files read a file from disk before searching it, not to what they search for or assert.

## 13. Final Decision

The three guards pass without any runtime modification, the combined targeted run is clean, and ESLint is clean on all three modified files.

```txt
GO POUR LOT 5.93 — FULL ROOT REMOVAL VALIDATION
```
