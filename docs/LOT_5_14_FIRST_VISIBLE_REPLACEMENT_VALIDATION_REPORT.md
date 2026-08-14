# LOT 5.14 - First Visible Replacement Validation Report

## 1. Executive Summary

LOT 5.14 validates the LOT 5.13 first visible replacement.

Decision: the replacement can remain enabled for the approved first slice.

No implementation extension was performed. No application file was modified in this LOT.

Added validation only:

- `tests/lot-5-14-first-visible-replacement-validation.test.js`;
- `docs/LOT_5_14_FIRST_VISIBLE_REPLACEMENT_VALIDATION_REPORT.md`.

## 2. Scope and Authority

Authority documents read:

- `docs/LOT_5_12_FIRST_VISIBLE_REPLACEMENT_GATE_REVIEW.md`;
- `docs/LOT_5_13_FIRST_VISIBLE_REPLACEMENT_REPORT.md`;
- `docs/LOT_5_7_SHADOW_PARITY_VALIDATION_REPORT.md`;
- `docs/LOT_5_9_RUNTIME_PARITY_EVIDENCE_IMPLEMENTATION_REPORT.md`;
- `docs/LOT_5_11_ADDITIONAL_PARITY_EVIDENCE_REPORT.md`.

Inspected:

- `src/App.jsx`;
- `fiscalSummaryShadow`;
- `fiscalSummaryVisibleSlice`;
- LOT 5.13 visible dashboard reads;
- Adapter call;
- Facade call;
- runtime evidence mechanism;
- LOT 5.11, 5.13 and 5.14 tests;
- Playwright UI tests.

## 3. Implementation Under Validation

LOT 5.13 introduced:

- local flag `FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED`;
- local memoized selector `fiscalSummaryVisibleSlice`;
- Shadow reads for the approved visible dashboard slice;
- Legacy fallback when the flag is disabled or Shadow Result is absent;
- no second Facade execution;
- no new state;
- no persistence.

Approved fields:

- `revenue.total`;
- `summary.baseAmount`;
- `summary.finalContributionAmount`;
- `summary.effectiveRate`;
- `acre.status`.

## 4. Permanent Guards

Permanent Facade Guard: respected. `calculateFiscalSummary` was not modified and remains covered by the facade architectural test.

Permanent Migration Guard: respected. Shadow is visible only for the LOT 5.13 slice. Legacy remains source of truth for persistence, exports, payloads, assistant output and out-of-slice values.

Permanent Shadow Rule: respected. Shadow Result is read only by parity, runtime evidence and the approved first visible slice.

Permanent Deterministic Parity Guard: respected. LOT 5.11 and runtime evidence tests still pass.

Permanent Evidence Integrity Guard: respected. Intentional MISMATCH remains detected and incomplete Shadow structures remain observable as MISMATCH evidence.

Permanent Slice Isolation Guard: respected. No second slice was migrated.

## 5. Feature Flag Validation

Flag:

```text
FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED
```

Validation result:

- local: yes;
- explicit: yes;
- deterministic: yes;
- no persistence: yes;
- no Supabase: yes;
- no localStorage: yes;
- no network: yes;
- no user dependency: yes;
- no `Date.now()`: yes;
- no `new Date()`: yes;
- no `Math.random()`: yes.

Tested behavior:

- flag ON reads Shadow;
- flag OFF reads Legacy;
- rollback by flag is immediate and local.

## 6. Fallback Authorization Review

LOT 5.12 explicitly authorized the preferred shape:

```text
if the feature flag is enabled and Shadow result is available, use Shadow values;
otherwise use Legacy values.
```

LOT 5.13 implemented that policy.

The fallback is authorized only when:

- the feature flag is disabled;
- or the global Shadow Result is absent.

It is not a field-level fallback.

## 7. Fallback Runtime Behavior

Fallback mechanism:

```text
Boolean(shadowResult)
```

It uses an explicit global presence check.

It does not use:

- nullish coalescing on business fields;
- logical OR on business fields;
- zero fallback;
- field-by-field correction;
- tolerance;
- normalization.

It cannot confuse these Shadow field values with absence:

- `0`;
- `null` status;
- effective rate `0`;
- contribution amount `0`;
- revenue total `0`.

It does not modify parity evidence. It does not transform MISMATCH into MATCH. Incomplete Shadow structures are still observable as MISMATCH in runtime evidence.

## 8. Selector Review

Selector reviewed:

```text
fiscalSummaryVisibleSlice
```

Confirmed:

- no formula;
- no rate resolution;
- no rounding;
- no business normalization;
- no result reconstruction;
- no object mutation;
- no side effect;
- no second Adapter call;
- no second Facade call;
- no network call;
- no persistence read;
- no state write;
- only source selection.

## 9. Field-by-Field Validation

| Champ | Source flag ON | Source flag OFF | Valeur falsy testée | Parité | Statut |
| --- | --- | --- | --- | --- | --- |
| `revenue.total` | `shadowResult.revenue.total` | `currentMonthTotal` | `0` | MATCH in LOT 5.11 | VALIDATED |
| `summary.baseAmount` | `shadowResult.summary.baseAmount` | `currentMonthTotal` | `0` | MATCH in LOT 5.11 | NOT VISIBLE |
| `summary.finalContributionAmount` | `shadowResult.summary.finalContributionAmount` | `estimatedCharges` | `0` | MATCH in LOT 5.11 | VALIDATED |
| `summary.effectiveRate` | `shadowResult.summary.effectiveRate` | `computed.rate` | `0` | MATCH in LOT 5.11 | NOT VISIBLE |
| `acre.status` | `shadowResult.contributions.acre.acreStatus` | `computed.acreStatus` | `null` | MATCH in LOT 5.11 | NOT VISIBLE |

`NOT VISIBLE` means the field is included in the approved selector for source integrity but LOT 5.13 did not create a new UI surface for that field.

No `UNKNOWN` remains.

## 10. Falsy Values Assessment

Validated:

- Shadow `revenue.total = 0` stays `0`;
- Shadow `summary.baseAmount = 0` stays `0`;
- Shadow `summary.finalContributionAmount = 0` stays `0`;
- Shadow `summary.effectiveRate = 0` stays `0`;
- Shadow `acre.status = null` stays `null`;
- ACRE statuses `inactive`, `active`, `expired`, and `null` are selected from Shadow when flag is ON.

The selector does not contain a field-level `||` or `??` fallback that could replace falsy values with Legacy.

## 11. Visible Source Proof

When the flag is ON and Shadow Result exists:

- dashboard revenue display reads `fiscalSummaryVisibleSlice.revenueTotal`;
- amount-to-set-aside display reads `fiscalSummaryVisibleSlice.finalContributionAmount` for real revenue;
- priority estimated amount reads `dashboardChargesDisplay`;
- declaration helper reads `fiscalSummaryVisibleSlice.revenueTotal`.

The existing formatter is preserved:

```text
getDisplayValue(..., "money")
```

No new rounding or mapping was added.

## 12. Double Source of Truth Assessment

For each replaced visible value, the visible source is single:

- Shadow when flag ON and Shadow Result exists;
- Legacy when flag OFF or Shadow Result absent.

No visible value combines Legacy for one part and Shadow for another part.

Out-of-scope surfaces remain Legacy:

- persistence;
- exports;
- payloads;
- assistant output;
- dashboard values outside the slice;
- TVA;
- CFE;
- deadlines;
- invoices;
- reminders.

No incoherent visible duplication was found.

## 13. React and State Assessment

Confirmed:

- no new `useState`;
- no new `useEffect`;
- no mutation;
- no render loop;
- no duplicated Facade call;
- no duplicated Adapter call;
- selector is computed after `estimatedCharges`, `availableAmount`, and `fiscalSummaryShadow` are available;
- selector dependencies are explicit.

Historical hook lint warnings remain in `App.jsx`, but they predate LOT 5.14 and were not changed in this lot.

## 14. Persistence Assessment

No persistence path was changed.

Confirmed unchanged:

- Supabase;
- localStorage;
- sessionStorage;
- save paths;
- restore paths;
- synchronization;
- user data;
- snapshots;
- history.

The new visible selector is not referenced by persistence code.

## 15. Payload and Export Assessment

No payload or export path was changed.

Confirmed no Shadow injection into:

- API payloads;
- saved objects;
- PDF exports;
- CSV exports;
- JSON-style outputs;
- reports;
- assistant payloads;
- analytics paths.

## 16. UI Validation

Confirmed:

- texts unchanged;
- labels unchanged;
- units unchanged;
- existing money formatter reused;
- interactions unchanged;
- workflows unchanged;
- no card added;
- no card removed;
- no layout change in LOT 5.14;
- no navigation change in LOT 5.14.

Playwright validation:

- first exact `npx playwright test --reporter=line` run had two transient landing/pricing timeouts;
- isolated serial rerun passed 11/11;
- final exact `npx playwright test --reporter=line` rerun passed 11/11.

No reproducible UI regression remains.

## 17. Parity Safety

Confirmed intact:

- Legacy Result;
- Shadow Result;
- Adapter;
- Facade;
- passive parity validation;
- runtime evidence;
- LOT 5.11 harness;
- intentional MISMATCH detection.

The visible replacement does not modify:

- Legacy snapshot;
- Shadow Result;
- MATCH/MISMATCH result;
- evidence order;
- fixtures;
- inputs.

## 18. Performance Assessment

Confirmed:

- one Adapter call in `App.jsx`;
- one Facade call in `App.jsx`;
- no second calculation for rendering;
- no new effect loop;
- no new state update;
- no persistence;
- no network.

The visible selector adds only local source selection.

## 19. Corrections Applied

No application correction was applied in LOT 5.14.

Added only:

- dedicated LOT 5.14 validation test;
- LOT 5.14 validation report.

No `src/App.jsx` edit was needed.

## 20. Tests and Results

Executed:

- `node tests/lot-5-14-first-visible-replacement-validation.test.js`: PASS, 14/14.
- `node tests/lot-5-13-first-visible-replacement.test.js`: PASS, 8/8.
- `node tests/lot-5-11-additional-parity-evidence.test.js`: PASS, 7/7.
- `node tests/shadow-parity-validation.test.js`: PASS, 6/6.
- `node tests/runtime-parity-evidence.test.js`: PASS, 11/11.
- Sequential Node suite: PASS.
- `npm run build`: PASS, with existing Vite chunk-size warning.
- `npm run lint`: FAIL on historical lint debt.
- `npx eslint tests/lot-5-14-first-visible-replacement-validation.test.js`: PASS.
- `npx eslint src/App.jsx tests/lot-5-14-first-visible-replacement-validation.test.js tests/lot-5-13-first-visible-replacement.test.js`: FAIL on historical `App.jsx` debt only.
- `npx playwright test tests/home.spec.js tests/premium.spec.js tests/auth-routing.spec.js --workers=1 --reporter=line`: PASS, 11/11.
- Final `npx playwright test --reporter=line`: PASS, 11/11 browser specs after Node tests.

Historical lint debt:

- `src/App.jsx`: 19 errors and 29 warnings in targeted lint;
- global lint: 21 errors and 29 warnings;
- `src/components/InvoiceGenerator.jsx`: `react-refresh/only-export-components`;
- `src/context/AuthContext.jsx`: `react-refresh/only-export-components`.

This debt is unchanged from LOT 5.13 validation and outside LOT 5.14.

## 21. Risks

| Risk | Status | Assessment |
| --- | --- | --- |
| Falsy Shadow value replaced by Legacy | Controlled | Selector gates only on global Shadow Result presence |
| Fallback masking MISMATCH | Controlled | Evidence comparison is independent and MISMATCH remains detected |
| Incomplete Shadow contract hidden | Controlled | Runtime evidence reports incomplete structures as MISMATCH |
| Double source visible value | Controlled | Visible reads use selector consistently |
| Scope expansion | Controlled | Test checks first-slice isolation |
| UI regression | Controlled | Playwright final run passed |
| Lint debt | Historical | Documented, not introduced by LOT 5.14 |

No blocking risk remains.

## 22. Rollback Validation

Rollback is immediate and local:

- set `FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED` to `false`;
- or restore local Legacy reads for the approved visible values.

Rollback keeps:

- Adapter;
- Facade;
- Shadow Pipeline;
- Parity Validation;
- Runtime Evidence;
- proof tests.

Rollback does not require:

- migration;
- data correction;
- Supabase action;
- localStorage action;
- user correction.

## 23. Scope Control

Confirmed:

- only the first slice is visible via Shadow;
- no second slice is migrated;
- Legacy remains source of truth outside the slice;
- Shadow remains passive outside the slice;
- fallback is explicitly audited;
- no MISMATCH is masked;
- no valid falsy value is replaced by Legacy;
- no persistence is modified;
- no payload is modified;
- no export is modified;
- no assistant output is modified;
- no formula is modified;
- no rate is modified;
- no rounding is modified;
- no business logic is modified;
- no workflow is modified;
- rollback is immediate.

## 24. Recommended Next LOT

Recommended next LOT:

LOT 5.15 - First Slice Stabilization.

Suggested focus:

- keep the first slice enabled;
- monitor stability;
- keep runtime evidence intact;
- do not expand to a second slice without a dedicated gate.

## 25. Final Decision

GO POUR LOT 5.15 — FIRST SLICE STABILIZATION
