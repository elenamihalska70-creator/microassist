# LOT 5.95 - Extended Guard Hardening Report

## 1. Executive Summary

LOT 5.95 fixed the single remaining historical guard failure left by LOT 5.94: a cross-file text assertion in `tests/lot-5-29-savingsgoal-architecture-hardening.test.js` that still expected `tests/lot-5-18-legacy-retention-hardening.test.js`'s source to contain the literal string `estimatedCharges: 14`, even though LOT 5.94 had already correctly updated that baseline to `12`.

No runtime code, `src/App.jsx`, `lot-5-18`, formulas, rates, persistence, payloads, or the assistant were modified. Only one line in one test file changed.

Result:

```txt
Full stabilization complete.
node --test: 898/898 PASS, 0 fail.
npm run build: PASS.
npm run lint: 50 problems (21 errors, 29 warnings) -- exact baseline.
Playwright run 1: 11/11 PASS. Playwright run 2: 11/11 PASS.
```

## 2. Single Remaining Failure

Before this LOT, the full suite reported (per LOT 5.94):

```txt
tests 898
pass 897
fail 1
```

The one failure:

```txt
tests/lot-5-29-savingsgoal-architecture-hardening.test.js
"LOT 5.29 keeps Legacy retention and prior analysis intact"
```

## 3. Cross-File Guard Root Cause

`lot-5-29` reads `lot-5-18`'s raw source as a string (`LOT_5_18_SOURCE`) and asserts against its literal text, rather than against live `src/App.jsx` state:

```js
const LOT_5_18_SOURCE = readFileSync(
  new URL("./lot-5-18-legacy-retention-hardening.test.js", import.meta.url),
  "utf8",
);
...
test("LOT 5.29 keeps Legacy retention and prior analysis intact", () => {
  assert.match(LOT_5_18_SOURCE, /estimatedCharges: 14/);
  ...
});
```

LOT 5.94 correctly updated `lot-5-18`'s own `APPROVED_LEGACY_REFERENCES.estimatedCharges` from `14` to `12` (the approved post-LOT-5.91A baseline). That correct, in-scope edit mechanically broke this separate, out-of-scope cross-file text check in `lot-5-29`, which had no reason to be touched by LOT 5.94 since it wasn't one of that LOT's four authorized files. This is historical cross-file guard drift, not a runtime issue.

## 4. Old Expectation

```js
assert.match(LOT_5_18_SOURCE, /estimatedCharges: 14/);
```

## 5. New Approved Expectation

```js
assert.match(LOT_5_18_SOURCE, /estimatedCharges: 12/);
```

Verified before editing: `tests/lot-5-18-legacy-retention-hardening.test.js:28` currently reads `estimatedCharges: 12,` inside `APPROVED_LEGACY_REFERENCES`, and `12` is confirmed consistent with live `src/App.jsx` (`grep -o '\bestimatedCharges\b' src/App.jsx | wc -l` = `12`).

## 6. File Modified

Exactly one file, the only one authorized:

```txt
tests/lot-5-29-savingsgoal-architecture-hardening.test.js
```

The only change is the literal in the one `assert.match` call, plus a one-line explanatory comment. `lot-5-18` and every other file were not opened for writing.

## 7. Guard Integrity

The `"LOT 5.29 keeps Legacy retention and prior analysis intact"` test still asserts, unchanged:

- `LOT_5_18_SOURCE` contains `blocks unapproved new Legacy consumers` (lot-5-18's guard title/contract is still present);
- `LOT_5_28_REPORT` contains the expected historical narration strings.

Every other test in `lot-5-29` -- including its own `savingsGoal` root-absence, `fiscalCoachingSavingsGoal`, `pdfSavingsGoal`, Shadow baseline `= 15`, and no-16th-occurrence guards (added in LOT 5.91A) -- was not touched and continues to pass, confirmed by the full 16/16 run in section 8.

## 8. Targeted Validation

| Command | Result |
| --- | --- |
| `node --test tests/lot-5-29-savingsgoal-architecture-hardening.test.js` | PASS - 16/16 |
| combined: `lot-5-18, 20, 21, 22, 24, 25, 26, 29, 91` | PASS - 164/164 |
| `npx eslint tests/lot-5-29-savingsgoal-architecture-hardening.test.js` | PASS - 0 problems |

No sandboxed `spawn EPERM` was encountered.

## 9. Full Node Suite

```txt
node --test
```

Result:

```txt
tests 898
pass 898
fail 0
```

Zero failures anywhere in the repository.

## 10. Build

```txt
npm run build
```

Result: `PASS` (`358 modules transformed`, built in `4.40s`). The pre-existing Vite chunk-size-over-500kB warning is present and accepted, not a failure.

## 11. Global Lint

```txt
npm run lint
```

Result:

```txt
50 problems (21 errors, 29 warnings)
```

Exact expected baseline. Unchanged from LOT 5.91A's restored baseline.

## 12. Playwright Run 1

```txt
npx playwright test --reporter=line
11 passed (14.2s)
```

## 13. Playwright Run 2

```txt
npx playwright test --reporter=line
11 passed (12.6s)
```

Repeated exactly; both runs 11/11.

## 14. Root Removal Integrity

Re-confirmed by direct source inspection:

- `savingsGoal` whole-word count in `src/App.jsx`: `0`;
- `fiscalCoachingSavingsGoal` present, exact formula `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` (lines 6444-6447);
- `pdfSavingsGoal` present, exact formula `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` (lines 6448-6451);
- `estimatedCharges` whole-word count: `12`, matching the guard baseline now asserted consistently in `lot-5-18`, `lot-5-20`, and `lot-5-29`;
- `useMemo` whole-word count: `88`, matching the guard baseline asserted in `lot-5-22`.

## 15. Shadow Baseline

```txt
fiscalSummaryVisibleSlice = 15
no 16th occurrence
```

Confirmed unchanged. This LOT's edit was a single regex literal inside a test file; it could not and did not affect any Shadow read.

## 16. Scope Control

Confirmed:

- the only file modified is `tests/lot-5-29-savingsgoal-architecture-hardening.test.js`;
- `src/`, `lot-5-18`, `lot-5-20`, `lot-5-21`, `lot-5-22`, `lot-5-24/25/26`, `package.json`, ESLint config, and Playwright config are all byte-for-byte unchanged (confirmed by `git status`);
- no assertion was deleted or weakened -- the cross-file guard still checks the same contract, only its expected literal was corrected;
- `fiscalCoachingSavingsGoal`, `pdfSavingsGoal`, `fiscalSummaryVisibleSlice`, formulas, rates, persistence, payloads, and the assistant are untouched.

## 17. Final Decision

Every gate cleared cleanly: targeted validation, full Node suite (898/898), build, lint (exact baseline), and both Playwright runs (11/11 each). No historical guard failure remains anywhere in the repository, and no runtime regression was found at any point across this removal chain (LOT 5.91A through 5.95).

```txt
GO POUR LOT 5.96 — POST-SAVINGSGOAL ARCHITECTURE GATE REVIEW
```
