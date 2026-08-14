# LOT 5.21 - Next Consumer Migration Validation

## 1. Executive Summary

LOT 5.21 validates the LOT 5.20 migration of exactly one consumer:

```text
Dashboard URSSAF declaration helper availability gate
```

Validation result: the migrated gate is stable, isolated and validated.

The gate uses exactly:

```text
fiscalSummaryVisibleSlice.revenueTotal > 0
```

No runtime application code was modified in this LOT. No new migration, consumer, slice, business rule, persistence path, payload, export or assistant path was added.

## 2. Scope and Authority

Authority documents read:

- `docs/LOT_5_18_LEGACY_RETENTION_HARDENING_REPORT.md`;
- `docs/LOT_5_19_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md`;
- `docs/LOT_5_20_NEXT_CONSUMER_MIGRATION_IMPLEMENTATION_REPORT.md`;
- `docs/LOT_5_13_FIRST_VISIBLE_REPLACEMENT_REPORT.md`;
- `docs/LOT_5_14_FIRST_VISIBLE_REPLACEMENT_VALIDATION_REPORT.md`;
- `docs/LOT_5_15_FIRST_SLICE_STABILIZATION_REPORT.md`;
- `docs/LOT_5_16_PLAYWRIGHT_OOM_EXTENDED_STABILIZATION_REPORT.md`.

Inspected:

- `src/App.jsx`;
- `fiscalSummaryVisibleSlice`;
- the existing feature flag;
- Shadow, runtime evidence and parity blocks;
- the URSSAF helper JSX;
- all remaining `currentMonthTotal` occurrences;
- LOT 5.18 and LOT 5.20 tests;
- LOT 5.11 parity harness;
- Playwright browser specs and config.

LOT 5.19 remains the authority for the authorized consumer. LOT 5.20 remains the authority for the implementation under validation.

## 3. Consumer Under Validation

Only consumer under validation:

- file: `src/App.jsx`;
- block: dashboard priority URSSAF declaration helper;
- purpose: boolean branch deciding whether detailed helper content is visible;
- previous source: direct Legacy `currentMonthTotal > 0`;
- current source: `fiscalSummaryVisibleSlice.revenueTotal > 0`.

## 4. Permanent Guards

Permanent Facade Guard: respected. `calculateFiscalSummary` remains an orchestration facade and is called once in `App.jsx`.

Permanent Migration Guard: respected. Shadow visibility remains limited to the approved first slice and the approved URSSAF gate.

Permanent Shadow Rule: respected. No new direct `shadowResult` visible consumer was added.

Permanent Deterministic Parity Guard: respected. Same deterministic input keeps deterministic evidence.

Permanent Evidence Integrity Guard: respected. MISMATCH remains observable and uncorrected.

Permanent Slice Isolation Guard: respected. No second consumer was migrated.

Legacy Retention Guard: respected. Legacy remains a controlled compatibility layer.

## 5. Condition Before / After

Before LOT 5.20:

```text
currentMonthTotal > 0
```

After LOT 5.20 and validated by LOT 5.21:

```text
fiscalSummaryVisibleSlice.revenueTotal > 0
```

No intermediate calculation, rounding, coercion, `Boolean`, `Number`, `parseFloat`, `parseInt`, `|| 0`, `?? 0` or business fallback was added to the gate.

## 6. Feature Flag Validation

Existing flag:

```text
FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED
```

Confirmed:

- flag ON uses Shadow via `fiscalSummaryVisibleSlice`;
- flag OFF rolls back to Legacy via the same selector;
- absent Shadow Result rolls back to Legacy;
- no new flag exists;
- no URSSAF-specific flag exists;
- no declaration-specific flag exists;
- the flag is local, static and deterministic;
- no localStorage, Supabase, network, user or time dependency was added.

## 7. Zero and Positive Value Behavior

Validated by `tests/lot-5-21-next-consumer-migration-validation.test.js`:

- `revenueTotal = 0`: helper detail hidden;
- positive `revenueTotal`: helper detail visible;
- negative `revenueTotal`: helper detail hidden;
- positive decimal `revenueTotal`: helper detail visible;
- successive transitions `0 -> positive -> positive -> 0 -> decimal positive -> 0` produce the expected visibility sequence.

No business contract was changed to manufacture these scenarios.

## 8. Visible Source Validation

The helper visibility and displayed amount now use the same visible source:

- visibility: `fiscalSummaryVisibleSlice.revenueTotal > 0`;
- displayed amount: `getDisplayValue(fiscalSummaryVisibleSlice.revenueTotal, "money")`.

Legacy remains calculated for rollback, parity, runtime evidence and non-migrated consumers, but it no longer directly drives this helper gate when the selector is Shadow-backed.

## 9. Helper Integrity

Confirmed unchanged around the helper:

- same `dashboardDeclareHelper` class;
- same displayed amount formatter;
- same `Période concernée` text;
- same `Échéance estimée` text;
- same official URSSAF reminder text;
- same empty-state text;
- same surrounding actions;
- no style, layout, link, button or interaction was changed in LOT 5.21.

Only the source of the principal boolean condition is migrated.

## 10. Other currentMonthTotal Consumers

Remaining `currentMonthTotal` occurrences are retained and authorized:

| Location / role | Consumer | LOT 5.18 authorization | Modified by LOT 5.20 | Reason retained |
| --- | --- | --- | --- | --- |
| `currentMonthTotal` `useMemo` | Legacy revenue total | compatibility layer | no | source for rollback, parity and non-migrated consumers |
| `computeObligations` `ca_month` | Legacy obligations | other consumer | no | obligations migration not authorized |
| `legacySnapshot.revenueTotal` | parity/runtime evidence | parity and evidence | no | required comparator |
| `fiscalSummaryVisibleSlice` fallback | rollback | rollback | no | flag OFF and absent Shadow rollback |
| `estimatedCharges` formula | contribution fallback | other consumer | no | calculation not migrated |
| `availableAmount` formula | dashboard available amount | other consumer | no | no approved Shadow available field |
| `simpleAssistantGuidance` | assistant-adjacent state | assistant-adjacent compatibility | no | assistant migration excluded |
| feedback context | payload-like context | feedback / analytics compatibility | no | payload migration excluded |
| dashboard monthly reflection | dashboard text | dashboard outside slice | no | summary text migration excluded |
| PDF export | export output | export compatibility | no | export migration excluded |
| progress indicators gate | dashboard progress | dashboard outside slice | no | depends on savings values outside approved slice |

No other occurrence was migrated accidentally.

## 11. Double Source of Truth Assessment

No double source remains for the helper visibility.

The helper no longer uses Legacy `currentMonthTotal` for its gate while displaying Shadow-backed `revenueTotal`. Visibility and displayed amount now share `fiscalSummaryVisibleSlice.revenueTotal`.

## 12. React and State Assessment

Confirmed:

- no new `useState`;
- no new `useEffect`;
- no new context;
- no mutation;
- no render loop;
- no stale-state pattern introduced;
- no second Adapter execution;
- no second Facade execution;
- no additional calculation solely for the gate.

The gate reuses the existing memoized `fiscalSummaryVisibleSlice`.

## 13. Parity Assessment

Confirmed intact:

- Legacy Result;
- Shadow Result;
- passive parity validation;
- LOT 5.11 harness;
- intentional MISMATCH detection;
- compared fields;
- deterministic order;
- no MISMATCH masking.

The migration does not alter Legacy values, Shadow values, input DTOs, traces, warnings or fixtures.

## 14. Runtime Evidence Assessment

Runtime evidence remains wired:

- `createRuntimeParityEvidence(...)`;
- `SHADOW_PARITY_EVIDENCE_STORE.record(shadowParityEvidence)`;
- MATCH and MISMATCH statuses remain strict and observable.

LOT 5.21 created deterministic evidence in tests and confirmed intentional revenue mismatch remains `MISMATCH`.

## 15. Legacy Retention Assessment

LOT 5.18 guards remain correct after the approved LOT 5.20 adjustment:

- approved `currentMonthTotal` count remains 28;
- approved `fiscalSummaryVisibleSlice` count remains 5;
- the approved gate reads `fiscalSummaryVisibleSlice.revenueTotal > 0`;
- the remaining direct `currentMonthTotal > 0` is the separate progress/dashboard consumer.

The No New Legacy Consumer Guard was not weakened.

## 16. Persistence Assessment

No persistence path changed.

Confirmed unchanged:

- Supabase reads;
- Supabase writes;
- localStorage reads;
- localStorage writes;
- save and restore paths;
- synchronization;
- history.

The URSSAF gate and visible selector contain no persistence access.

## 17. Payload Assessment

No payload path changed.

Feedback and analytics context remain Legacy-compatible, including `totalRevenues: currentMonthTotal || 0`.

## 18. Export Assessment

No export path changed.

PDF/export paths retain existing Legacy-compatible reads such as `getDisplayValue(currentMonthTotal, "money")`, `dashboardChargesDisplay`, and `dashboardAvailableDisplay`.

## 19. Assistant Assessment

No assistant output, message, draft, local state or assistant-adjacent persistence path changed.

Assistant-adjacent consumers remain Legacy-compatible and excluded from this migration.

## 20. UI Validation

Validated by source inspection and browser suite:

- detailed helper visible when visible revenue is positive;
- detailed helper hidden when visible revenue is zero;
- no helper text changed;
- no label changed;
- no unit changed;
- no style changed;
- no layout changed;
- no interaction changed;
- no workflow changed;
- no other block visibility was migrated.

No global snapshot was added. Existing Playwright browser coverage remained stable.

## 21. Corrections Applied

No application correction was applied.

Created:

- `tests/lot-5-21-next-consumer-migration-validation.test.js`;
- `docs/LOT_5_21_NEXT_CONSUMER_MIGRATION_VALIDATION_REPORT.md`.

The only adjustment during this LOT was inside the newly created validation test before final validation, to align assertions with actual source contracts.

## 22. Tests

Created test file:

- `tests/lot-5-21-next-consumer-migration-validation.test.js`.

Coverage includes:

- exact Shadow condition;
- absence of direct Legacy condition for the helper gate;
- zero, positive, negative and decimal value behavior;
- successive revenue changes;
- flag ON Shadow behavior;
- flag OFF Legacy rollback;
- absent Shadow Result rollback;
- no new flag;
- no new state or effect;
- no second Adapter or Facade execution;
- helper integrity;
- remaining `currentMonthTotal` consumers;
- no other consumer migration;
- parity and runtime evidence integrity;
- intentional MISMATCH detection;
- persistence, payload, export and assistant boundaries;
- Legacy Retention Guard;
- rollback locality;
- deterministic validation.

Targeted results:

- `node --test tests/lot-5-21-next-consumer-migration-validation.test.js`: 19 passed.
- `node --test tests/lot-5-20-next-consumer-migration.test.js`: 13 passed.
- `node --test tests/lot-5-18-legacy-retention-hardening.test.js`: 13 passed.
- `node --test tests/lot-5-15-first-slice-stabilization.test.js`: 13 passed.
- `node --test tests/lot-5-14-first-visible-replacement-validation.test.js`: 14 passed.
- `node --test tests/lot-5-13-first-visible-replacement.test.js`: 8 passed.
- `node --test tests/lot-5-11-additional-parity-evidence.test.js`: 7 passed.
- `node --test tests/shadow-parity-validation.test.js`: 6 passed.
- `node --test tests/runtime-parity-evidence.test.js`: 11 passed.

Note: sandboxed `node --test` returned `spawn EPERM`, so Node test commands were run with approved escalated execution.

## 23. Node Full Suite Result

Executed:

```text
node --test
```

Result:

- tests: 286;
- pass: 286;
- fail: 0;
- cancelled: 0;
- skipped: 0;
- todo: 0;
- duration: about 0.92 seconds.

## 24. Build and Lint Results

Build:

- `npm run build`: passed;
- Vite emitted the existing large chunk warning.

Global lint:

- `npm run lint`: failed on the documented historical baseline;
- 50 problems total;
- 21 errors;
- 29 warnings;
- files: `src/App.jsx`, `src/components/InvoiceGenerator.jsx`, `src/context/AuthContext.jsx`.

Targeted lint:

- `npx eslint tests/lot-5-21-next-consumer-migration-validation.test.js`: passed.

No LOT 5.21 lint issue was introduced.

## 25. Playwright Consecutive Runs

Executed twice:

```text
npx playwright test --reporter=line
```

Run 1:

- 11 tests detected;
- 11 passed;
- 1 worker;
- no Node tests collected;
- no OOM;
- no Vite crash;
- no Node crash.

Run 2:

- 11 tests detected;
- 11 passed;
- 1 worker;
- no Node tests collected;
- no OOM;
- no Vite crash;
- no Node crash.

Final process check after both runs showed no significant Microassist/Vite/Playwright/Chromium orphan. Remaining Node processes were Codex runtime `node_repl` processes.

## 26. Risks

Residual risks:

- global lint debt remains historical and outside this LOT;
- `src/App.jsx` remains large and still triggers the Babel deoptimization note;
- future LOTs must continue to prevent consumer creep.

No risk requires rollback or migration hardening.

## 27. Rollback Validation

Rollback remains immediate and local:

```text
fiscalSummaryVisibleSlice.revenueTotal > 0
```

can be restored to:

```text
currentMonthTotal > 0
```

only at the URSSAF helper gate.

Rollback keeps:

- first visible Shadow slice;
- Adapter;
- Facade;
- Shadow Pipeline;
- parity validation;
- runtime evidence;
- Legacy Retention Guards;
- other consumers.

No data migration, Supabase action, localStorage action or user correction is required.

## 28. Scope Control

Confirmed:

- only the approved URSSAF gate uses the migrated `revenueTotal` source;
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
- no workflow changed;
- rollback is immediate and local.

## 29. Recommended Next LOT

Recommended next LOT:

```text
LOT 5.22 - Next Consumer Stabilization
```

Reason: the migration is validated by source inspection, targeted tests, full Node suite, build, targeted lint and two consecutive Playwright runs.

## 30. Final Decision

GO POUR LOT 5.22 — NEXT CONSUMER STABILIZATION
