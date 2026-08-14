# LOT 5.15 - First Slice Stabilization Report

## 1. Executive Summary

LOT 5.15 stabilizes the first visible replacement slice introduced in LOT 5.13 and validated in LOT 5.14.

No application code was modified in this LOT.

Added:

- `tests/lot-5-15-first-slice-stabilization.test.js`;
- `docs/LOT_5_15_FIRST_SLICE_STABILIZATION_REPORT.md`.

Result: the first slice remains stable, isolated, deterministic and rollbackable. Because the exact full Playwright command hit a local Vite/Node OOM during browser startup, the next LOT should continue stabilization rather than proceed directly to Legacy removal gate review.

## 2. Scope

In scope:

- stabilization tests for the approved first slice;
- fallback stability validation;
- parity evidence stability validation;
- UI stability validation through existing browser specs;
- Legacy dependency inventory;
- future Legacy removal criteria.

Out of scope:

- new slice migration;
- application refactoring;
- domain changes;
- Adapter or Facade changes;
- rates;
- formulas;
- rounding;
- persistence;
- payloads;
- exports;
- assistant output;
- UI structure, navigation, workflows, labels or business text.

## 3. Permanent Guards

Permanent Facade Guard: respected. The Facade was not modified.

Permanent Migration Guard: respected. Shadow remains visible only for the approved first slice. Legacy remains available outside the slice and for rollback.

Permanent Shadow Rule: respected. Shadow is read by parity, evidence and the first visible slice only.

Permanent Deterministic Parity Guard: respected. Same input, cloned input and distinct references remain deterministic in the LOT 5.15 test.

Permanent Evidence Integrity Guard: respected. MISMATCH remains observable and uncorrected.

Permanent Slice Isolation Guard: respected. No second slice was migrated.

## 4. Slice Definition

Approved first slice:

- `revenue.total`;
- `summary.baseAmount`;
- `summary.finalContributionAmount`;
- `summary.effectiveRate`;
- `acre.status`.

Visible reads remain limited to:

- dashboard revenue display;
- amount-to-set-aside display for real revenue;
- priority estimated amount through the existing dashboard display value;
- declaration helper amount.

No new UI surface was added.

## 5. Feature Flag Stability

Flag:

```text
FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED
```

Confirmed:

- local;
- deterministic;
- not persisted;
- no network dependency;
- no Supabase dependency;
- no localStorage dependency;
- no date dependency;
- no user dependency;
- immediate rollback by setting the flag to `false`.

Test coverage:

- flag ON keeps Shadow as visible source;
- flag OFF restores Legacy values.

## 6. Fallback Stability

Fallback remains tied only to global Shadow Result availability:

```text
Boolean(shadowResult)
```

Confirmed:

- no fallback based on business field truthiness;
- no valid zero replacement;
- no valid rate zero replacement;
- no valid status replacement;
- no MISMATCH masking;
- no runtime evidence mutation;
- no comparison mutation.

Falsy values tested:

- `revenue.total = 0`;
- `summary.baseAmount = 0`;
- `summary.finalContributionAmount = 0`;
- `summary.effectiveRate = 0`;
- `acre.status = null`.

## 7. Parity Stability

Confirmed active:

- Shadow Pipeline;
- Passive Parity Validation;
- Runtime Evidence;
- Additional Parity Evidence;
- intentional MISMATCH detection.

The LOT 5.15 test confirms:

- same input repeated;
- cloned input;
- distinct references;
- zero values;
- null status;
- MATCH remains MATCH;
- intentional MISMATCH remains MISMATCH.

LOT 5.11 scenarios remain valid.

## 8. UI Stability

Confirmed through inspection and browser tests:

- formatting unchanged;
- labels unchanged;
- units unchanged;
- interactions unchanged;
- workflows unchanged;
- navigation unchanged;
- no new card;
- no removed card;
- no layout change in LOT 5.15.

Browser validation:

- exact `npx playwright test --reporter=line`: Node tests passed, browser phase failed after Vite/Node OOM and `ERR_CONNECTION_REFUSED`;
- isolated failing auth spec rerun: PASS 1/1;
- browser spec suite rerun in series: PASS 11/11.

No reproducible UI regression was found, but the exact full command instability remains a stabilization concern.

## 9. React Stability

Confirmed:

- no new `useState`;
- no new `useEffect`;
- no state stale issue introduced by LOT 5.15;
- no loop introduced;
- no second Facade execution;
- no second Adapter execution;
- no selector read before initialization;
- selector remains local and memoized.

Historical React hook lint warnings remain in `App.jsx`.

## 10. Persistence Stability

No persistence path was modified.

Confirmed unchanged:

- Supabase;
- localStorage;
- save paths;
- restore paths;
- synchronization;
- history;
- user data.

The visible selector is not referenced by persistence code.

## 11. Payload and Export Stability

No payload or export path was modified.

Confirmed unchanged:

- payloads;
- exports;
- assistant output;
- PDF paths;
- CSV / text style paths;
- invoice generation paths;
- analytics-style paths.

Shadow visible selector is not injected into these paths.

## 12. Legacy Dependency Inventory

| Dependency | Location | Role | Current use | Future removal possibility | Removal risk | Tests needed before removal |
| --- | --- | --- | --- | --- | --- | --- |
| `currentMonthTotal` | `src/App.jsx` | Legacy revenue total | parity snapshot, fallback, out-of-slice values | Possible only after all consumers migrate | High | full UI, persistence, export, assistant parity |
| `computed` | `src/App.jsx` | Legacy obligations result | parity snapshot, fallback fields, deadlines, TVA/CFE and labels | Not yet possible | High | broad obligation migration suite |
| `estimatedCharges` | `src/App.jsx` | Legacy visible contribution fallback | fallback for first slice and other UI | Possible after fallback alternative exists | Medium | flag OFF, rollback, visible amount tests |
| `computed.rate` | `src/App.jsx` | Legacy effective rate fallback | first-slice fallback and other calculations | Not yet possible | High | rate parity and downstream consumer inventory |
| `computed.acreStatus` | `src/App.jsx` | Legacy ACRE status fallback | parity and fallback | Not yet possible | Medium | ACRE UI/export/persistence consumer tests |
| `legacySnapshot` | `src/App.jsx` Shadow block | parity evidence | runtime MATCH/MISMATCH comparison | Not before evidence replacement | High | evidence replacement and audit tests |

No Legacy dependency was removed in this LOT.

## 13. Remaining Legacy Consumers

Legacy remains consumed by:

- parity snapshots;
- fallback;
- persistence-adjacent app state;
- exports;
- assistant messages;
- dashboard values outside the first slice;
- TVA;
- CFE;
- deadlines;
- invoices;
- reminders;
- premium and access logic.

These consumers are explicitly outside LOT 5.15.

## 14. Tests

Added:

- `tests/lot-5-15-first-slice-stabilization.test.js`.

Coverage:

- Shadow visible source remains active;
- flag OFF restores Legacy;
- fallback is global Shadow Result availability only;
- zero values remain zero;
- null status remains null;
- MISMATCH remains observable;
- selector stays within the approved slice;
- no second slice is migrated;
- no payload, persistence, export or assistant path uses Shadow selector;
- no new React state or effect in the selector;
- no double Adapter or Facade execution;
- rollback remains immediate;
- LOT 5.11, 5.13 and 5.14 proof coverage remains active.

## 15. Validation Results

Executed:

- `node tests/lot-5-15-first-slice-stabilization.test.js`: PASS, 13/13.
- `node tests/lot-5-14-first-visible-replacement-validation.test.js`: PASS, 14/14.
- `node tests/lot-5-13-first-visible-replacement.test.js`: PASS, 8/8.
- `node tests/lot-5-11-additional-parity-evidence.test.js`: PASS, 7/7.
- `node tests/shadow-parity-validation.test.js`: PASS, 6/6.
- `node tests/runtime-parity-evidence.test.js`: PASS, 11/11.
- Sequential Node suite: PASS.
- `npm run build`: PASS, with existing Vite chunk-size warning.
- `npm run lint`: FAIL on historical lint debt.
- `npx eslint tests/lot-5-15-first-slice-stabilization.test.js`: PASS.
- `npx eslint src/App.jsx tests/lot-5-15-first-slice-stabilization.test.js`: FAIL on historical `App.jsx` debt only.
- `npx playwright test --reporter=line`: FAIL during browser phase after Vite/Node OOM and connection refusal; Node tests inside the command passed.
- `npx playwright test tests/auth-routing.spec.js -g "signin displays a simulated auth error" --workers=1 --reporter=line`: PASS, 1/1.
- `npx playwright test tests/home.spec.js tests/premium.spec.js tests/auth-routing.spec.js --workers=1 --reporter=line`: PASS, 11/11.

Historical lint debt:

- `src/App.jsx`: 19 errors and 29 warnings in targeted lint;
- global lint: 21 errors and 29 warnings;
- `src/components/InvoiceGenerator.jsx`: `react-refresh/only-export-components`;
- `src/context/AuthContext.jsx`: `react-refresh/only-export-components`.

This debt predates LOT 5.15 and was not corrected by this LOT.

## 16. Risks

| Risk | Status | Assessment |
| --- | --- | --- |
| Real mismatch | Not observed | LOT 5.11, 5.14 and 5.15 proofs remain green |
| Fallback masks anomaly | Controlled | MISMATCH evidence remains independent |
| Second slice migration | Controlled | Tests assert isolation |
| Valid zero replaced by Legacy | Controlled | Zero and null values tested |
| Persistence or payload change | Controlled | No Shadow selector injection found |
| UI regression | Low but watch | Browser specs pass in series |
| Exact Playwright command instability | Open | Full command hit local Vite/Node OOM |
| Legacy removal readiness | Not yet complete | Remaining consumers inventory requires gate review after more stable runs |

## 17. Rollback

Rollback remains:

- local;
- immediate;
- no migration;
- no data correction;
- no Supabase action;
- no localStorage action;
- no durable user impact.

Rollback action:

- set `FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED` to `false`;
- or restore local Legacy reads for the approved visible values.

Adapter, Facade, Shadow Pipeline, Parity Validation, Runtime Evidence and tests can remain.

## 18. Future Legacy Removal Criteria

Legacy removal must not begin until all criteria are met:

- repeated stable full validation runs;
- no real MISMATCH;
- exact full Playwright command stability or an approved deterministic replacement command;
- complete consumer inventory;
- persistence confirmed migrated or independent;
- exports confirmed migrated or independent;
- assistant output confirmed migrated or independent;
- dashboard out-of-slice consumers confirmed;
- rollback alternative defined without current Legacy reads;
- no behavior change from removing each Legacy dependency;
- dedicated Legacy Removal Gate Review approval.

No Legacy removal is authorized by LOT 5.15.

## 19. Recommended Next LOT

Recommended next LOT:

LOT 5.16 - Extended Stabilization.

Focus:

- repeat validation in a clean process;
- stabilize or split the exact Playwright command;
- keep first slice enabled;
- keep Legacy rollback;
- keep runtime evidence;
- do not remove Legacy yet.

## 20. Final Decision

GO POUR LOT 5.16 — EXTENDED STABILIZATION
