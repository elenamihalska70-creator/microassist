# LOT 5.20 - Next Consumer Migration Implementation

## 1. Executive Summary

LOT 5.20 migrates exactly one approved consumer:

```text
Dashboard URSSAF declaration helper availability gate
```

The helper gate no longer reads `currentMonthTotal > 0` directly.

It now reads:

```text
fiscalSummaryVisibleSlice.revenueTotal > 0
```

No business calculation, formula, rate, rounding, formatter, text, persistence, payload, export, assistant output, Adapter, Facade, Domain, CSS, navigation or workflow was changed.

## 2. Scope and Authority

Authority:

- `docs/LOT_5_18_LEGACY_RETENTION_HARDENING_REPORT.md`;
- `docs/LOT_5_19_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md`;
- `docs/LOT_5_13_FIRST_VISIBLE_REPLACEMENT_REPORT.md`;
- `docs/LOT_5_14_FIRST_VISIBLE_REPLACEMENT_VALIDATION_REPORT.md`;
- `docs/LOT_5_15_FIRST_SLICE_STABILIZATION_REPORT.md`.

LOT 5.19 approved only the URSSAF helper boolean gate.

## 3. Approved Consumer

Approved consumer:

- file: `src/App.jsx`;
- block: dashboard URSSAF declaration helper;
- previous condition: `currentMonthTotal > 0`;
- new condition: `fiscalSummaryVisibleSlice.revenueTotal > 0`;
- field used: approved first-slice `revenue.total`;
- rollback: restore the single condition.

## 4. Permanent Guards

Permanent Facade Guard: respected. Facade untouched.

Permanent Migration Guard: respected. Only the explicitly approved consumer was migrated.

Permanent Shadow Rule: respected. The consumer reads the existing visible selector, not `shadowResult` directly.

Permanent Deterministic Parity Guard: respected. Parity/evidence tests remain deterministic.

Permanent Evidence Integrity Guard: respected. Intentional MISMATCH remains detected.

Permanent Slice Isolation Guard: respected. No second slice was introduced.

Legacy Retention Guard: respected. Legacy remains available for rollback, parity, runtime evidence and other authorized consumers.

## 5. Legacy Condition Before

Before:

```text
currentMonthTotal > 0
```

This meant the helper detail visibility used Legacy directly while the amount displayed inside the same helper already used `fiscalSummaryVisibleSlice.revenueTotal`.

## 6. Shadow Condition After

After:

```text
fiscalSummaryVisibleSlice.revenueTotal > 0
```

The condition now follows the same visible source as the displayed amount.

No fallback was added.

No conversion was added.

No normalization was added.

## 7. Feature Flag Behavior

The existing local flag is reused indirectly through `fiscalSummaryVisibleSlice`.

Flag ON and Shadow available:

- `fiscalSummaryVisibleSlice.revenueTotal` comes from Shadow `revenue.total`;
- the URSSAF helper gate uses Shadow-visible revenue.

Flag OFF or Shadow absent:

- `fiscalSummaryVisibleSlice.revenueTotal` falls back to Legacy `currentMonthTotal`;
- rollback remains local and immediate.

No new flag was added.

## 8. Falsy Value Behavior

Validated by `tests/lot-5-20-next-consumer-migration.test.js`:

- `revenueTotal = 0` masks the helper detail;
- `revenueTotal > 0` shows the helper detail;
- `revenueTotal < 0` does not show the helper detail;
- absent Shadow Result follows existing Legacy fallback through `fiscalSummaryVisibleSlice`.

No `|| 0`, `?? 0`, `Boolean(...)`, `Number(...)`, `parseFloat(...)` or `parseInt(...)` was added to the migrated gate.

## 9. Double Source of Truth Assessment

The local double-source risk is reduced.

Before:

- helper gate: direct Legacy;
- helper displayed amount: visible selector.

After:

- helper gate: visible selector;
- helper displayed amount: visible selector.

Legacy remains active elsewhere only for authorized compatibility purposes.

## 10. Scope Isolation

Only one runtime condition was changed.

Not changed:

- helper text;
- helper amount formatter;
- helper dates;
- helper buttons;
- helper links;
- other dashboard blocks;
- summaries;
- assistant;
- persistence;
- payloads;
- exports;
- formulas;
- rates;
- rounding;
- Adapter;
- Facade;
- Domain.

The LOT 5.18 retention guard was updated only to reflect the approved removal of one direct `currentMonthTotal` consumer and the corresponding addition of one `fiscalSummaryVisibleSlice` read.

## 11. Parity Safety

Parity remains intact.

Validated:

- LOT 5.11 additional parity evidence: passed;
- shadow parity validation tests: passed;
- runtime parity evidence tests: passed;
- intentional MISMATCH still detected.

The migrated field is `revenue.total`, already covered by first-slice evidence.

## 12. Persistence Assessment

No persistence path changed.

No Supabase access was added or modified.

No localStorage access was added or modified.

## 13. Payload Assessment

No payload path changed.

Feedback and analytics context remain Legacy-compatible and outside this migration.

## 14. Export Assessment

No export path changed.

PDF/export consumers remain Legacy-compatible and outside this migration.

## 15. Assistant Assessment

No assistant output, draft, message, state or persistence path changed.

Assistant-adjacent consumers remain outside this migration.

## 16. Tests Added

Created:

- `tests/lot-5-20-next-consumer-migration.test.js`.

Coverage:

- URSSAF helper gate no longer uses direct `currentMonthTotal > 0`;
- gate uses exactly `fiscalSummaryVisibleSlice.revenueTotal > 0`;
- zero, positive and negative revenue behavior;
- flag ON Shadow behavior;
- flag OFF Legacy fallback through the selector;
- absent Shadow fallback;
- no new flag;
- no new state/effect;
- no second Adapter or Facade execution;
- no fallback or normalization;
- no other currentMonthTotal consumer migration;
- no other slice migration;
- parity and runtime evidence intact;
- persistence, payload, exports and assistant unchanged.

Updated:

- `tests/lot-5-18-legacy-retention-hardening.test.js` count guard and dashboard compatibility assertion, strictly to reflect the approved LOT 5.20 consumer migration.

## 17. Validation Results

Passed:

- `node tests\lot-5-20-next-consumer-migration.test.js`: 13 passed.
- `node tests\lot-5-18-legacy-retention-hardening.test.js`: 13 passed.
- `node tests\lot-5-15-first-slice-stabilization.test.js`: 13 passed.
- `node tests\lot-5-14-first-visible-replacement-validation.test.js`: 14 passed.
- `node tests\lot-5-13-first-visible-replacement.test.js`: 8 passed.
- `node tests\lot-5-11-additional-parity-evidence.test.js`: 7 passed.
- `node tests\shadow-parity-validation.test.js`: 6 passed.
- `node tests\runtime-parity-evidence.test.js`: 11 passed.
- `npm run build`: passed, with existing Vite large chunk warning.
- `npx eslint tests\lot-5-18-legacy-retention-hardening.test.js tests\lot-5-20-next-consumer-migration.test.js`: passed.

Blocked:

- `node --test`: not executed to completion because the required escalated execution was rejected by the approval system with a usage-limit message. No workaround was attempted.

Lint debt:

- `npx eslint src\App.jsx tests\lot-5-18-legacy-retention-hardening.test.js tests\lot-5-20-next-consumer-migration.test.js`: failed on historical `src/App.jsx` debt, 48 problems: 19 errors and 29 warnings.
- `npm run lint`: failed on historical debt, 50 problems: 21 errors and 29 warnings in `src/App.jsx`, `src/components/InvoiceGenerator.jsx`, and `src/context/AuthContext.jsx`.

No new lint issue was reported in the LOT 5.20 test file.

## 18. Playwright Stability

Playwright full run 1:

- `npx playwright test --reporter=line`: 11 passed.

Playwright full run 2:

- `npx playwright test --reporter=line`: 11 passed.

LOT 5.16 Playwright/Node separation remains intact.

## 19. Risks

Remaining risks:

- global Node suite could not be completed due approval system usage-limit rejection;
- global lint debt remains historical and outside this LOT;
- App.jsx remains large, causing Babel deoptimization notes;
- future LOTs must avoid expanding this migration beyond the single gate.

No runtime mismatch was observed in executed parity/evidence validations.

## 20. Rollback

Rollback is local:

```text
fiscalSummaryVisibleSlice.revenueTotal > 0
```

back to:

```text
currentMonthTotal > 0
```

at the URSSAF helper gate only.

No data migration, Supabase action, localStorage action, Adapter change, Facade change, Domain change, parity change or runtime evidence change is required.

## 21. Files Modified

Modified:

- `src/App.jsx`;
- `tests/lot-5-18-legacy-retention-hardening.test.js`.

Created:

- `tests/lot-5-20-next-consumer-migration.test.js`;
- `docs/LOT_5_20_NEXT_CONSUMER_MIGRATION_IMPLEMENTATION_REPORT.md`.

## 22. Recommended Next LOT

Recommended next LOT:

```text
LOT 5.21 - Next Consumer Migration Validation
```

Purpose:

- validate the migrated URSSAF gate as a visible consumer;
- decide whether it remains migrated, is rolled back, or needs additional investigation because the full Node suite could not be completed in this environment.

## 23. Final Decision

GO POUR LOT 5.21 — NEXT CONSUMER MIGRATION VALIDATION
