# LOT 5.25 - Next Consumer Migration Validation

## 1. Executive Summary

LOT 5.25 validates the LOT 5.24 migration of exactly one consumer:

```text
Dashboard progress indicators revenue-presence gate
```

Validation result: the migrated gate is stable, isolated, deterministic and rollbackable.

Current condition:

```text
isFiscalProfileComplete && fiscalSummaryVisibleSlice.revenueTotal > 0
```

No runtime application code was modified in this LOT. No new migration, consumer, slice, business rule, persistence path, payload, export or assistant path was added.

## 2. Scope and Authority

Authority documents read:

- `docs/LOT_5_18_LEGACY_RETENTION_HARDENING_REPORT.md`;
- `docs/LOT_5_20_NEXT_CONSUMER_MIGRATION_IMPLEMENTATION_REPORT.md`;
- `docs/LOT_5_21_NEXT_CONSUMER_MIGRATION_VALIDATION_REPORT.md`;
- `docs/LOT_5_22_NEXT_CONSUMER_STABILIZATION_REPORT.md`;
- `docs/LOT_5_23_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md`;
- `docs/LOT_5_24_NEXT_CONSUMER_MIGRATION_IMPLEMENTATION_REPORT.md`.

LOT 5.23 remains the authority for the selected consumer. LOT 5.24 remains the authority for the implementation under validation.

## 3. Consumer Under Validation

Only consumer under validation:

- file: `src/App.jsx`;
- block: dashboard progress indicators;
- purpose: boolean visibility of the progress indicators block;
- previous source: direct Legacy `currentMonthTotal > 0`;
- current source: `fiscalSummaryVisibleSlice.revenueTotal > 0`;
- retained source: `isFiscalProfileComplete`.

## 4. Permanent Guards

Permanent Facade Guard: respected. `calculateFiscalSummary` remains a single orchestration facade call in `App.jsx`.

Permanent Migration Guard: respected. Shadow-visible reads remain limited to the approved first slice, URSSAF gate and progress indicators gate.

Permanent Shadow Rule: respected. The progress gate reads `fiscalSummaryVisibleSlice`, not `shadowResult` directly.

Permanent Deterministic Parity Guard: respected. Same input keeps same evidence.

Permanent Evidence Integrity Guard: respected. MISMATCH remains observable and uncorrected.

Permanent Slice Isolation Guard: respected. No additional consumer was migrated.

Legacy Retention Guard: respected. Legacy remains a compatibility layer for rollback, parity, runtime evidence and authorized non-migrated consumers.

## 5. Gate Before / After

Before LOT 5.24:

```text
isFiscalProfileComplete && currentMonthTotal > 0
```

After LOT 5.24 and validated by LOT 5.25:

```text
isFiscalProfileComplete && fiscalSummaryVisibleSlice.revenueTotal > 0
```

No intermediate variable, fallback, coercion, normalization, rate, formula or rounding was added.

## 6. isFiscalProfileComplete Integrity

Validated unchanged:

- `hasProfileCore`;
- `requiresAcreStartDate`;
- `isFiscalProfileComplete` definition;
- initialization order before `currentMonthTotal`, Shadow and the JSX gate;
- use inside the progress gate.

The progress gate keeps:

```text
isFiscalProfileComplete &&
```

as the first part of the condition.

## 7. Value Matrix

Validated:

| Profile complete | revenueTotal | Expected | Result |
| --- | --- | --- | --- |
| false | 0 | hidden | pass |
| false | positive | hidden | pass |
| true | 0 | hidden | pass |
| true | positive | visible | pass |
| true | positive decimal | visible | pass |
| true | negative | hidden | pass |

Transition validation:

- `0 -> positive -> positive -> decimal positive -> 0`;
- positive to zero;
- zero to positive;
- profile incomplete to complete;
- profile complete to incomplete;
- last revenue removed.

All transitions are deterministic.

## 8. Feature Flag Validation

Existing flag:

```text
FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED
```

Validated:

- flag ON and Shadow Result present: `fiscalSummaryVisibleSlice.revenueTotal` uses Shadow `revenue.total`;
- flag OFF: `fiscalSummaryVisibleSlice.revenueTotal` falls back to Legacy `currentMonthTotal`;
- absent Shadow Result: global selector fallback restores Legacy;
- no new flag;
- no dashboard-specific flag;
- no persistence, Supabase, localStorage, network, user or time dependency.

## 9. Visible Source Validation

The progress indicators visibility source is exactly:

```text
fiscalSummaryVisibleSlice.revenueTotal > 0
```

The source appears in exactly two runtime gates:

- approved URSSAF helper gate;
- approved progress indicators gate.

Direct runtime `currentMonthTotal > 0` occurrence count is zero.

## 10. Progress Indicators Integrity

Confirmed unchanged:

- JSX structure;
- `progressIndicators`, `progressItem`, `progressItemHeader`, `progressBar progressBarPremium`, `progressFill`;
- `Objectif d'épargne` label;
- progress percentage formula;
- `savingsProgress / savingsGoal`;
- `Math.min` and `Math.round` behavior;
- styles, classes, labels, interactions and layout.

Only the revenue source in the outer visibility gate was changed by LOT 5.24.

## 11. Legacy Occurrence Inventory

Remaining `currentMonthTotal` consumers are retained and authorized:

| Location / role | Consumer | LOT 5.18 authorization | Modified by LOT 5.24 | Reason retained |
| --- | --- | --- | --- | --- |
| `currentMonthTotal` `useMemo` | Legacy revenue total | compatibility layer | no | source for rollback, parity and non-migrated consumers |
| `ca_month: currentMonthTotal` | obligations input | dashboard/obligations compatibility | no | obligations migration excluded |
| `legacySnapshot.revenueTotal` | parity/runtime evidence | parity and evidence | no | required comparator |
| `fiscalSummaryVisibleSlice` fallback | rollback | rollback | no | flag OFF and absent Shadow fallback |
| `estimatedCharges` formula | Legacy contribution fallback | dashboard/export compatibility | no | formula migration excluded |
| `availableAmount` formula | available cash estimate | dashboard compatibility | no | no approved Shadow available field |
| `simpleAssistantGuidance` | assistant-adjacent guidance | assistant-adjacent compatibility | no | assistant migration excluded |
| `feedbackContextSnapshot` | feedback/analytics payload-like context | payload compatibility | no | payload migration excluded |
| `dashboardMonthlyReflection` | dashboard text | dashboard compatibility | no | text migration excluded |
| `handleExportPDF` summary | export | export compatibility | no | export migration excluded |

No direct `currentMonthTotal > 0` runtime gate remains.

## 12. Double Source of Truth Assessment

The progress indicators visibility is no longer simultaneously driven by Legacy and Shadow revenue presence.

When flag ON and Shadow Result exists:

- visible revenue source: Shadow through `fiscalSummaryVisibleSlice`;
- direct Legacy revenue source in this gate: none.

Legacy remains calculated only for authorized compatibility roles.

## 13. React and State Assessment

Validated counts remain stable:

- `useState`: 82;
- `useEffect`: 59;
- `useMemo`: 89;
- `buildFiscalSummaryInput`: 2 lexical references;
- `calculateFiscalSummary`: 2 lexical references;
- `createRuntimeParityEvidence`: 2 lexical references.

No new context, state, effect, memo, render loop, stale state pattern, read-before-initialization pattern, second Adapter call or second Facade call was introduced.

## 14. Parity Assessment

Confirmed intact:

- Legacy Result;
- Shadow Result;
- passive parity validation;
- LOT 5.11 harness;
- MATCH evidence;
- intentional MISMATCH detection;
- deterministic evidence;
- stable evidence order;
- immutability.

The progress gate does not alter DTOs, warnings, trace, fixtures, Legacy values or Shadow values.

## 15. Runtime Evidence Assessment

Runtime evidence remains wired:

- `createRuntimeParityEvidence(...)`;
- `SHADOW_PARITY_EVIDENCE_STORE.record(shadowParityEvidence)`;
- `shadowInput`, `shadowResult`, `shadowParityEvidence`.

LOT 5.25 confirms intentional revenue mismatch remains `MISMATCH`.

## 16. Legacy Retention Assessment

Legacy retention guards remain strict:

- `currentMonthTotal` count: 27;
- `fiscalSummaryVisibleSlice` count: 6;
- direct `currentMonthTotal > 0` count: 0.

The guard update reflects only approved migrations:

- LOT 5.20 URSSAF helper gate;
- LOT 5.24 progress indicators gate.

No new Legacy consumer was added.

## 17. Persistence Assessment

No persistence path changed.

Confirmed unchanged:

- Supabase reads;
- Supabase writes;
- localStorage reads;
- localStorage writes;
- save;
- restore;
- synchronization;
- history/cache paths.

The progress gate and visible selector contain no persistence access.

## 18. Payload Assessment

No payload path changed.

Feedback and analytics remain Legacy-compatible, including:

```text
totalRevenues: currentMonthTotal || 0
```

## 19. Export Assessment

No export path changed.

Export paths retain Legacy-compatible reads such as:

- `getDisplayValue(currentMonthTotal, "money")`;
- `dashboardChargesDisplay`;
- `dashboardAvailableDisplay`.

## 20. Assistant Assessment

No assistant message, draft, output, state or assistant-adjacent persistence path changed.

Assistant-adjacent consumers remain Legacy-compatible and out of scope.

## 21. UI Validation

Validated by source and browser suite:

- profile incomplete + revenue positive: indicators hidden;
- profile complete + zero revenue: indicators hidden;
- profile complete + revenue positive: indicators visible;
- profile incomplete + zero revenue: indicators hidden;
- no text change;
- no label change;
- no style change;
- no calculated value change;
- no layout change;
- no interaction change;
- no other dashboard block visibility changed.

No global snapshot was added.

## 22. Guard Adjustments Review

Reviewed guard adjustments in:

- `tests/lot-5-18-legacy-retention-hardening.test.js`;
- `tests/lot-5-20-next-consumer-migration.test.js`;
- `tests/lot-5-21-next-consumer-migration-validation.test.js`;
- `tests/lot-5-22-next-consumer-stabilization.test.js`;
- `tests/lot-5-24-next-consumer-migration.test.js`.

Confirmed:

- no No New Legacy Consumer Guard weakening;
- no expanded Shadow list beyond approved consumers;
- no authorization of unapproved consumer;
- no useful persistence/payload/export/assistant guard removed;
- count changes match approved LOT 5.24 delta.

## 23. Corrections Applied

No application correction was applied.

Created:

- `tests/lot-5-25-next-consumer-migration-validation.test.js`;
- `docs/LOT_5_25_NEXT_CONSUMER_MIGRATION_VALIDATION_REPORT.md`.

One correction was made inside the newly created LOT 5.25 test before final validation: a helper was connected to the Legacy inventory assertion so targeted ESLint remained clean. No runtime code changed.

## 24. Tests

Created test file:

- `tests/lot-5-25-next-consumer-migration-validation.test.js`.

Coverage includes:

- exact Shadow-backed gate;
- absence of direct Legacy gate;
- `isFiscalProfileComplete` integrity;
- value matrix and transitions;
- flag ON, flag OFF and absent Shadow;
- no new flag/state/effect/memo;
- one Adapter and one Facade execution;
- progress indicator JSX integrity;
- remaining Legacy inventory;
- no other consumer migration;
- parity and runtime evidence;
- intentional MISMATCH;
- Legacy Retention Guard;
- persistence, payload, export and assistant boundaries;
- local rollback;
- deterministic harness.

Targeted results:

- `node --test tests/lot-5-25-next-consumer-migration-validation.test.js`: 15 passed.
- `node --test tests/lot-5-24-next-consumer-migration.test.js`: 16 passed.
- `node --test tests/lot-5-22-next-consumer-stabilization.test.js`: 26 passed.
- `node --test tests/lot-5-21-next-consumer-migration-validation.test.js`: 19 passed.
- `node --test tests/lot-5-20-next-consumer-migration.test.js`: 13 passed.
- `node --test tests/lot-5-18-legacy-retention-hardening.test.js`: 13 passed.
- `node --test tests/lot-5-15-first-slice-stabilization.test.js`: 13 passed.
- `node --test tests/lot-5-14-first-visible-replacement-validation.test.js`: 14 passed.
- `node --test tests/lot-5-13-first-visible-replacement.test.js`: 8 passed.
- `node --test tests/lot-5-11-additional-parity-evidence.test.js`: 7 passed.
- `node --test tests/shadow-parity-validation.test.js`: 6 passed.
- `node --test tests/runtime-parity-evidence.test.js`: 11 passed.

## 25. Full Node Suite Result

Executed after the final LOT 5.25 test correction:

```text
node --test
```

Result:

- tests: 343;
- pass: 343;
- fail: 0;
- cancelled: 0;
- skipped: 0;
- todo: 0;
- duration: about 1.45 seconds.

Node commands were run with approved escalated execution because sandboxed Node test execution previously failed with `spawn EPERM`.

## 26. Build and Lint Results

Build:

- `npm run build`: passed;
- existing Vite large chunk warning remains.

Global lint:

- `npm run lint`: failed on historical baseline only;
- 50 problems;
- 21 errors;
- 29 warnings;
- files: `src/App.jsx`, `src/components/InvoiceGenerator.jsx`, `src/context/AuthContext.jsx`.

Targeted lint:

- `npx eslint tests/lot-5-25-next-consumer-migration-validation.test.js`: passed.

No LOT 5.25 lint issue remains.

## 27. Consecutive Playwright Runs

Executed twice:

```text
npx playwright test --reporter=line
```

Run 1:

- 11 tests detected;
- 11 passed;
- no Node tests collected;
- no OOM;
- no Vite crash;
- no Node crash.

Run 2:

- 11 tests detected;
- 11 passed;
- no Node tests collected;
- no OOM;
- no Vite crash;
- no Node crash.

Post-run process check showed no significant Microassist/Vite/Playwright/Chromium orphan. Remaining Node processes were Codex `node_repl` processes.

## 28. Risks

Residual risks:

- global lint debt remains historical and outside this LOT;
- `src/App.jsx` remains large and continues to trigger Babel deoptimization notes;
- future migrations must continue one-consumer-at-a-time discipline.

No risk requires rollback, mismatch investigation or hardening.

## 29. Rollback Validation

Rollback is local:

```text
isFiscalProfileComplete && fiscalSummaryVisibleSlice.revenueTotal > 0
```

back to:

```text
isFiscalProfileComplete && currentMonthTotal > 0
```

only at the progress indicators gate.

Rollback keeps:

- first visible Shadow slice;
- URSSAF gate;
- Adapter;
- Facade;
- parity;
- runtime evidence;
- Legacy Retention Guards;
- all other consumers.

No data migration, Supabase action, localStorage action or user correction is required.

## 30. Scope Control

Confirmed:

- only the approved progress indicators gate was validated;
- `isFiscalProfileComplete` is unchanged;
- no other consumer migrated;
- no new visible slice;
- Legacy remains a compatibility layer;
- no new Legacy consumer;
- no formula changed;
- no rate changed;
- no rounding changed;
- no persistence changed;
- no payload changed;
- no export changed;
- no assistant output changed;
- no UI structure or workflow changed;
- rollback remains immediate and local.

## 31. Recommended Next LOT

Recommended next LOT:

```text
LOT 5.26 - Next Consumer Stabilization
```

Purpose:

- stabilize the migrated progress indicators gate after validation;
- confirm transition durability and guard stability before the next Gate Review.

## 32. Final Decision

GO POUR LOT 5.26 — NEXT CONSUMER STABILIZATION
