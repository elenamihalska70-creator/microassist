# LOT 5.16 - Playwright OOM & Extended Stabilization Report

## 1. Executive Summary

LOT 5.16 diagnoses and stabilizes the full Playwright command:

```text
npx playwright test --reporter=line
```

Root cause: Playwright was configured with `testDir: './tests'` and no `testMatch`, so it imported Node `*.test.js` files during Playwright collection. Those files use `node:test`, so their tests executed during Playwright discovery before the browser phase. The browser phase then started after the full Node suite had already consumed memory and time.

Factor aggravant: local browser parallelism with 3 workers caused Chromium launch instability after the collection issue was fixed.

Correction:

- restrict Playwright to browser specs with `testMatch: '**/*.spec.js'`;
- set `workers: 1` for deterministic local browser execution;
- add a LOT 5.16 guard test.

Result:

- two consecutive exact full Playwright runs passed;
- no OOM after correction;
- no Vite/Node crash after correction;
- no significant orphan process after final validation;
- Node suite remains green;
- build remains green;
- coverage is preserved.

## 2. Scope and Authority

Authority documents read:

- `docs/LOT_5_13_FIRST_VISIBLE_REPLACEMENT_REPORT.md`;
- `docs/LOT_5_14_FIRST_VISIBLE_REPLACEMENT_VALIDATION_REPORT.md`;
- `docs/LOT_5_15_FIRST_SLICE_STABILIZATION_REPORT.md`;
- `docs/LOT_0_1_ROUTING_READINESS_REPORT.md`;
- `docs/CODING_STANDARDS_V3.md`.

Inspected:

- `playwright.config.js`;
- `package.json`;
- `vite.config.js`;
- browser Playwright specs;
- Node tests in `tests/`;
- Playwright `webServer`;
- `testDir`;
- `testMatch`;
- worker behavior;
- process lifecycle on Windows.

`src/App.jsx` was not modified.

## 3. Initial Failure

LOT 5.15 observed:

- exact full Playwright command failed during browser startup;
- Node tests inside the Playwright command passed first;
- browser phase then failed with Vite/Node OOM and `ERR_CONNECTION_REFUSED`;
- browser-only series passed 11/11.

No functional mismatch was detected.

## 4. Reproduction Steps

Commands used:

- `npx playwright test --list`;
- `npx playwright test --reporter=line`;
- `npx playwright test --reporter=line --workers=2`;
- `npx playwright test --reporter=line` twice after correction;
- `Get-CimInstance Win32_Process ...` process checks;
- Node regression tests;
- `npm run build`;
- `npm run lint`;
- targeted ESLint.

Key observation before correction:

- `npx playwright test --list` printed Node `*.test.js` execution output before listing the browser specs.

## 5. Test Collection Inventory

Files under `tests/`:

- 3 browser specs: `auth-routing.spec.js`, `home.spec.js`, `premium.spec.js`;
- 16 Node test files with `*.test.js`, including LOT 5.11, 5.13, 5.14, 5.15 and 5.16 guards.

After correction:

```text
Total: 11 tests in 3 files
```

`--list` no longer executes Node test output.

## 6. Node / Playwright Separation

Before LOT 5.16:

```js
testDir: './tests'
```

No `testMatch` was present in the effective LOT 5.15 config.

After LOT 5.16:

```js
testDir: './tests',
testMatch: '**/*.spec.js',
```

Result:

- Node tests remain run by `node`;
- Playwright runs only browser/end-to-end specs;
- suites are no longer executed twice accidentally;
- coverage is preserved, not reduced.

## 7. Worker Analysis

Observed:

- default Playwright run used 3 workers and failed after collection was fixed with Chromium `spawn UNKNOWN` and a navigation timeout;
- `--workers=2` passed 11/11 after collection separation;
- `workers: 1` passed twice with the exact required command.

Chosen value:

```js
workers: 1
```

Reason:

- minimum deterministic local setting;
- already stable in LOT 5.15 browser-only validation;
- satisfies the requirement for two consecutive exact full runs.

## 8. WebServer Analysis

Effective webServer remains:

```js
webServer: {
  command: 'npm run dev -- --host 127.0.0.1 --port 5174',
  url: 'http://127.0.0.1:5174',
  reuseExistingServer: false,
  timeout: 120000,
}
```

This preserves the LOT 0.1 correction:

- local Microassist server;
- explicit host;
- explicit port;
- no accidental validation against another localhost app;
- no reuse of stale server.

No webServer command change was needed.

## 9. Process Lifecycle Analysis

Process checks were performed before and after runs.

Findings:

- interrupted previous runs could leave Playwright/Vite processes active;
- those were manually identified and stopped before LOT 5.16 diagnostic continuation;
- after final LOT 5.16 validation, no significant `microassist`, Playwright, Vite or Chromium process remained.

The permanent fix is not process killing; it is preventing Playwright from importing and executing Node suites during browser runs.

## 10. Memory Behavior

Before correction:

- Playwright command first executed Node tests during collection;
- browser phase started after unnecessary Node workload;
- Vite/Node OOM occurred in LOT 5.15 exact full command;
- subsequent browser failures were connection refusal after server crash.

After correction:

- Playwright starts only 11 browser tests;
- no Node test output appears in Playwright collection;
- no Vite/Node OOM appears in two consecutive exact runs.

The large `App.jsx` / Vite chunk remains an aggravating load factor, but it is not the root cause and was not modified.

## 11. Hypothesis Matrix

| Hypothesis | Status | Evidence | Impact |
| --- | --- | --- | --- |
| A. Playwright collects Node tests | CONFIRMED | `--list` executed Node `*.test.js` output before fix | Root cause |
| B. `testDir` / `testMatch` too broad | CONFIRMED | no `testMatch`, all `tests/` imported | Root cause |
| C. Node tests replayed by Playwright | CONFIRMED | Node suite output appeared in Playwright command | Root cause |
| D. Too many workers load browser/App | CONFIRMED | 3 workers failed after separation; 1 and 2 passed | Aggravating factor |
| E. `fullyParallel` active | REJECTED | no `fullyParallel` configured | None |
| F. Vite starts multiple times | REJECTED | one configured webServer | None found |
| G. `reuseExistingServer` reuses wrong server | REJECTED | `reuseExistingServer: false` | None |
| H. Server not stopped cleanly | PARTIAL | interrupted runs left processes; final clean run did not | Symptom, not root cause |
| I. One browser suite leaks | REJECTED | browser suite passed 11/11 in series and exact runs after fix | None found |
| J. Tests stable isolated but not global | CONFIRMED before fix | browser-only passed while full command failed | Explained by collection |
| K. Large App bundle amplifies parallelism | CONFIRMED as factor | Vite deopt/chunk warning persists | Aggravating factor only |

## 12. Root Cause

Primary root cause:

```text
Playwright imported Node test files because the config scoped testDir too broadly without testMatch.
```

Why this exhausted memory:

- Node `*.test.js` files execute `node:test` registrations at module import;
- Playwright collection imported those files;
- Node tests ran before browser tests;
- Vite then loaded the large app bundle for browser specs;
- the combined unnecessary Node workload plus browser startup pushed local Node/Vite into OOM.

Secondary factor:

- 3 browser workers were not stable on this local environment with the large bundle.

Confidence: high.

## 13. Chosen Correction

Minimal correction:

```js
testMatch: '**/*.spec.js',
workers: 1,
```

`testMatch` addresses the root cause.

`workers: 1` makes the exact command deterministic and avoids local browser launch instability.

No app code was modified.

## 14. Rejected Corrections

Rejected:

- increasing Node heap with `NODE_OPTIONS`;
- modifying `src/App.jsx`;
- shrinking UI or bundle through application changes;
- disabling tests;
- deleting tests;
- weakening assertions;
- allowing stale server reuse;
- making scripts hide failures;
- changing business logic.

These would either mask the problem or violate LOT scope.

## 15. Files Modified

Modified:

- `playwright.config.js`.

Added:

- `tests/lot-5-16-playwright-stabilization.test.js`;
- `docs/LOT_5_16_PLAYWRIGHT_OOM_EXTENDED_STABILIZATION_REPORT.md`.

No business, UI, domain, Adapter, Facade, persistence, export or assistant file was modified.

## 16. Playwright Configuration Before / After

Effective LOT 5.15 config before correction:

```js
testDir: './tests',
webServer: {
  command: 'npm run dev -- --host 127.0.0.1 --port 5174',
  url: 'http://127.0.0.1:5174',
  reuseExistingServer: false,
  timeout: 120000,
}
```

LOT 5.16 config after correction:

```js
testDir: './tests',
testMatch: '**/*.spec.js',
workers: 1,
webServer: {
  command: 'npm run dev -- --host 127.0.0.1 --port 5174',
  url: 'http://127.0.0.1:5174',
  reuseExistingServer: false,
  timeout: 120000,
}
```

## 17. Test Coverage Preservation

Browser coverage preserved:

- 11 browser tests;
- 3 browser spec files;
- auth routing;
- recovery;
- landing;
- pricing.

Node coverage preserved:

- all `*.test.js` files remain in `tests/`;
- all Node tests run through direct Node execution;
- LOT 5.11, 5.13, 5.14, 5.15 and 5.16 guards remain active.

No useful suite was ignored.

## 18. Full Run Results

Before correction:

- `npx playwright test --reporter=line`: FAIL after Node-suite output and browser/server instability.

After `testMatch` only:

- `npx playwright test --reporter=line`: FAIL with 3 workers due Chromium `spawn UNKNOWN` and timeout, no OOM.

After final correction:

- `npx playwright test --reporter=line`: PASS, 11/11.
- `npx playwright test --reporter=line`: PASS, 11/11.
- `npx playwright test --reporter=line --workers=2`: PASS, 11/11 diagnostic.

## 19. Consecutive Stability Runs

Required exact command:

```text
npx playwright test --reporter=line
```

Run 1:

- 11 tests;
- 1 worker;
- PASS 11/11;
- duration about 29.5s;
- no OOM.

Run 2:

- 11 tests;
- 1 worker;
- PASS 11/11;
- duration about 29.1s;
- no OOM.

Final process check:

- no significant orphan process for `microassist`, Playwright, Vite or Chromium.

## 20. Node Regression Results

Executed:

- `node tests/lot-5-16-playwright-stabilization.test.js`: PASS, 2/2.
- `node tests/lot-5-15-first-slice-stabilization.test.js`: PASS, 13/13.
- `node tests/lot-5-14-first-visible-replacement-validation.test.js`: PASS, 14/14.
- `node tests/lot-5-13-first-visible-replacement.test.js`: PASS, 8/8.
- `node tests/lot-5-11-additional-parity-evidence.test.js`: PASS, 7/7.
- `node tests/shadow-parity-validation.test.js`: PASS, 6/6.
- `node tests/runtime-parity-evidence.test.js`: PASS, 11/11.
- Sequential Node suite: PASS.

## 21. Build and Lint Results

Build:

- `npm run build`: PASS, with existing Vite chunk-size warning.

Lint:

- `npm run lint`: FAIL on historical baseline, 50 problems:
  - `src/App.jsx`: existing unused variables and hook dependency warnings;
  - `src/components/InvoiceGenerator.jsx`: existing `react-refresh/only-export-components`;
  - `src/context/AuthContext.jsx`: existing `react-refresh/only-export-components`.

Targeted lint:

- `npx eslint playwright.config.js tests/lot-5-16-playwright-stabilization.test.js`: PASS.

No LOT 5.16 lint issue was introduced.

## 22. Performance Assessment

Before correction:

- Playwright command imported and executed Node suites before browser tests;
- browser phase then attempted 11 specs;
- memory pressure led to OOM/crashes.

After correction:

- Playwright collects 11 browser tests only;
- exact run duration around 29s;
- diagnostic `--workers=2` duration around 27s;
- configured `workers: 1` is slightly slower but more deterministic.

No benchmark complexity was added.

## 23. Remaining Risks

| Risk | Status | Mitigation |
| --- | --- | --- |
| Large app bundle | Existing | documented Vite warning, not changed in this infra lot |
| Local browser launch instability with higher workers | Controlled | configured `workers: 1` |
| Historical lint debt | Existing | documented, not expanded |
| Future config broadening | Controlled | LOT 5.16 guard test |

No blocking risk remains for restoring the full Playwright command.

## 24. Rollback

Rollback LOT 5.16:

- remove `testMatch: '**/*.spec.js'`;
- remove `workers: 1`;
- delete `tests/lot-5-16-playwright-stabilization.test.js`;
- delete this report.

Functional coverage tests remain available.

No migration, user data correction, Supabase action, localStorage action or business rollback is required.

## 25. Scope Control

Confirmed:

- no new slice migrated;
- no Legacy removed;
- no UI modified;
- no `src/App.jsx` modified;
- no calculation modified;
- no formula modified;
- no rate modified;
- no rounding modified;
- no persistence modified;
- no payload modified;
- no export modified;
- no assistant output modified;
- no business dependency modified;
- Playwright coverage preserved;
- Node coverage preserved;
- OOM treated at test infrastructure level.

## 26. Recommended Next LOT

Recommended next LOT:

LOT 5.17 - Legacy Removal Gate Review.

Scope should remain documentation/gate oriented until it explicitly authorizes any removal. The first slice remains stable and rollbackable.

## 27. Final Decision

GO POUR LOT 5.17 — LEGACY REMOVAL GATE REVIEW
