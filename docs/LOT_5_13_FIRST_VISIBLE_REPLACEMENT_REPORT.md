# LOT 5.13 - First Visible Replacement Report

## 1. Executive Summary

LOT 5.13 implements the first visible replacement approved by LOT 5.12.

The visible source for the approved dashboard fiscal slice now reads from the Shadow / Calculation Facade result when the local feature flag is enabled.

The replacement is limited to:

- `revenue.total`;
- `summary.baseAmount`;
- `summary.finalContributionAmount`;
- `summary.effectiveRate`;
- `acre.status`.

No calculation, rate, rounding, Adapter contract, Facade contract, domain rule, persistence, payload, export, assistant output, UI structure, label, workflow, or navigation was modified.

## 2. Scope and Authority

Authority:

- LOT 5.5 integration and rollback strategy;
- LOT 5.6 Shadow Pipeline;
- LOT 5.7 passive parity validation;
- LOT 5.8 parity evidence gate;
- LOT 5.9 runtime evidence mechanism;
- LOT 5.10 first visible replacement gate;
- LOT 5.11 additional parity evidence;
- LOT 5.12 final gate review.

Modified files:

- `src/App.jsx`;
- `tests/lot-5-13-first-visible-replacement.test.js`;
- `docs/LOT_5_13_FIRST_VISIBLE_REPLACEMENT_REPORT.md`.

No Adapter, Facade, Revenue, Contributions, ACRE, Rules Engine, Domain Model, persistence, payload, export, assistant, navigation, CSS, or workflow file was modified.

## 3. Permanent Guards

Permanent Facade Guard: respected. `calculateFiscalSummary` remains orchestration-only and was not modified.

Permanent Migration Guard: local exception applied only to the approved visible slice. Legacy remains source of truth for persistence, Supabase, localStorage, payloads, exports, assistant, dashboard outside the slice, and all other values.

Permanent Shadow Rule: respected. Shadow is read by parity, evidence, and the approved visible slice only.

Permanent Deterministic Parity Guard: respected. LOT 5.11 tests still pass.

Permanent Evidence Integrity Guard: respected. MATCH/MISMATCH behavior remains functional and the intentional MISMATCH remains detected.

Permanent Slice Isolation Guard: respected. No field outside the approved slice was migrated.

## 4. Approved Slice

Approved slice:

```text
Dashboard fiscal first visible replacement slice
```

Fields:

- `revenue.total`;
- `summary.baseAmount`;
- `summary.finalContributionAmount`;
- `summary.effectiveRate`;
- `acre.status`.

Visible readings replaced in this LOT:

- dashboard revenue display;
- dashboard amount-to-set-aside display;
- dashboard priority estimated amount display;
- dashboard declaration helper amount.

Fields `summary.baseAmount`, `summary.effectiveRate`, and `acre.status` are included in the local visible slice selector for approved parity/source integrity, but no new UI surface was created for them.

## 5. Pre-Change Legacy Read Inventory

| Visible value | Component area | Legacy path before LOT 5.13 | Shadow path after LOT 5.13 |
| --- | --- | --- | --- |
| Dashboard revenue display | Fiscal dashboard card | `currentMonthTotal` | `fiscalSummaryVisibleSlice.revenueTotal` |
| Amount to set aside | Fiscal dashboard card | `estimatedCharges` / `cockpitEstimate.charges` | `fiscalSummaryVisibleSlice.finalContributionAmount` for real revenue |
| Priority estimated amount | Dashboard priority hero | `cockpitEstimate.charges` or `computed.amountEstimatedLabel` | `dashboardChargesDisplay` |
| Declaration helper amount | Dashboard declaration helper | `currentMonthTotal` | `fiscalSummaryVisibleSlice.revenueTotal` |

Excluded from this replacement:

- persistence;
- payloads;
- exports;
- assistant output;
- TVA;
- CFE;
- deadlines;
- financial health;
- annual projections;
- reminders;
- invoices;
- premium triggers.

## 6. Shadow Mapping

| Field | Legacy fallback | Shadow source |
| --- | --- | --- |
| `revenue.total` | `currentMonthTotal` | `shadowResult.revenue.total` |
| `summary.baseAmount` | `currentMonthTotal` | `shadowResult.summary.baseAmount` |
| `summary.finalContributionAmount` | `estimatedCharges` | `shadowResult.summary.finalContributionAmount` |
| `summary.effectiveRate` | `computed.rate` | `shadowResult.summary.effectiveRate` |
| `acre.status` | `computed.acreStatus` | `shadowResult.contributions.acre.acreStatus` |

The mapping is implemented in `fiscalSummaryVisibleSlice`.

## 7. Implementation

Implementation shape:

- added local static feature flag `FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED`;
- changed the existing Shadow `useMemo` to return `shadowInput`, `shadowResult`, and `shadowParityEvidence`;
- added `fiscalSummaryVisibleSlice` as a local memoized selector;
- reused the existing Shadow result;
- did not add a second Facade execution;
- did not add React state;
- did not add `useEffect`;
- did not add persistence or network access.

## 8. Visible Source Replacement

Before:

```text
visible value -> Legacy value
```

After:

```text
visible approved slice value -> Shadow value when flag enabled
visible approved slice value -> Legacy fallback when flag disabled or Shadow unavailable
```

No visible value uses Legacy and Shadow simultaneously as its source.

## 9. Feature Flag

Feature flag:

```text
FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED
```

Properties:

- local;
- static;
- deterministic;
- not persisted;
- no Supabase;
- no localStorage;
- no network;
- rollbackable by setting the flag to `false` or removing the visible selector.

## 10. Double Source of Truth Assessment

For the approved visible slice, the display source is Shadow when the flag is enabled.

Legacy remains calculated for:

- parity;
- evidence;
- persistence;
- exports;
- assistant;
- out-of-slice dashboard values.

This does not create a double source for the same visible slice value because each replaced visible value reads the local visible selector.

## 11. Formatting Preservation

Formatting remains unchanged:

- existing `getDisplayValue(..., "money")` is reused;
- labels are unchanged;
- text is unchanged;
- units are unchanged;
- no new formatter was added;
- no new rounding was added;
- no new fallback was added.

## 12. State and React Assessment

No new React state was introduced.

No new App state was introduced.

No new `useEffect` was introduced.

No mutation was introduced.

The replacement uses `useMemo` and existing dependencies only.

## 13. Persistence Assessment

No persistence was modified:

- no Supabase write changed;
- no Supabase read changed;
- no localStorage write changed;
- no localStorage read changed;
- no restore path changed;
- no saved user data changed.

## 14. Payload and Export Assessment

No payload or export was modified:

- API payloads unchanged;
- PDF exports unchanged;
- CSV exports unchanged;
- XML exports unchanged;
- assistant payloads unchanged;
- analytics payloads unchanged.

## 15. Parity Safety

Parity safety remains active:

- Legacy result still exists;
- Shadow result still exists;
- runtime evidence still records;
- MATCH/MISMATCH mechanism still works;
- LOT 5.11 scenarios still pass MATCH;
- intentional MISMATCH remains detected.

The visible slice does not influence parity results.

## 16. Tests Added

Added:

- `tests/lot-5-13-first-visible-replacement.test.js`.

Coverage:

- local feature flag exists;
- only one `calculateFiscalSummary` execution exists in `App.jsx`;
- visible selector maps only approved fields;
- dashboard visible reads use the visible slice;
- no state, persistence, payload, export, network, or Supabase side effect in the selector;
- no new rounding, fallback, or normalization in the selector;
- LOT 5.11 MATCH/MISMATCH tests remain present;
- runtime evidence MATCH/MISMATCH behavior remains functional.

## 17. Validation Results

Executed:

- `node tests/lot-5-13-first-visible-replacement.test.js`: PASS, 8/8.
- `node tests/shadow-parity-validation.test.js`: PASS, 6/6.
- `node tests/runtime-parity-evidence.test.js`: PASS, 11/11.
- `node tests/lot-5-11-additional-parity-evidence.test.js`: PASS, 7/7.
- Sequential Node test suite: PASS.
- `npm run build`: PASS, with existing Vite chunk-size warning.
- `npm run lint`: FAIL on historical lint debt.
- `npx eslint src/App.jsx tests/lot-5-13-first-visible-replacement.test.js`: FAIL on historical `App.jsx` debt.
- `npx eslint tests/lot-5-13-first-visible-replacement.test.js`: PASS.
- `npx playwright test --reporter=line`: PASS, 11/11 browser specs.

Historical lint debt remains:

- `src/App.jsx`: pre-existing unused variables and hook dependency warnings;
- `src/components/InvoiceGenerator.jsx`: pre-existing `react-refresh/only-export-components`;
- `src/context/AuthContext.jsx`: pre-existing `react-refresh/only-export-components`.

No new lint issue was introduced in the LOT 5.13 test file. The `App.jsx` lint debt remains outside this LOT.

## 18. Performance

Performance impact is limited:

- no second Facade execution;
- no new effect loop;
- no new state update;
- no persistence;
- no network;
- one local memoized selector.

The Shadow calculation cost already existed before this LOT.

## 19. Risks

| Risk | Status | Mitigation |
| --- | --- | --- |
| Scope expansion | Controlled | Static LOT 5.13 test checks approved selector fields |
| Double source visible value | Controlled | Replaced display reads use `fiscalSummaryVisibleSlice` |
| Runtime mismatch | Controlled | Evidence stays active and MISMATCH remains preserved |
| Rollback complexity | Low | Local feature flag and selector rollback |
| Formatting drift | Low | Existing formatter reused |
| Hidden persistence change | None found | Persistence/export code untouched |
| Lint debt | Historical | Documented, targeted LOT 5.13 test lint passes |

No blocking risk remains.

## 20. Rollback

Rollback is local:

- set `FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED` to `false`;
- or remove `fiscalSummaryVisibleSlice` and restore direct Legacy reads for the approved visible values;
- keep Adapter;
- keep Facade;
- keep Shadow Pipeline;
- keep Parity Validation;
- keep Runtime Evidence;
- keep proof tests.

No data migration or user correction is required.

## 21. Scope Control

Confirmed:

- only the approved slice is migrated visibly;
- no other visible field is migrated;
- Legacy remains source of truth outside the slice;
- Shadow becomes visible source only for the slice;
- no persistence is modified;
- no payload is modified;
- no export is modified;
- no assistant output is modified;
- no formula is modified;
- no rate is modified;
- no rounding is modified;
- no business logic is modified;
- no UI structure is modified;
- no workflow is modified;
- rollback is immediate and local.

## 22. Recommended Next LOT

Recommended next LOT:

LOT 5.14 - First Visible Replacement Validation.

The next LOT should validate the live visible replacement behavior, confirm no unintended surface changed, and decide whether to keep, rollback, or investigate.

## 23. Final Decision

GO POUR LOT 5.14 — FIRST VISIBLE REPLACEMENT VALIDATION
