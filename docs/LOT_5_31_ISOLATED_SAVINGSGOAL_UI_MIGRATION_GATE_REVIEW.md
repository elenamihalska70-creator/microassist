# LOT 5.31 - Isolated SavingsGoal UI Migration Gate Review

## 1. Executive Summary

LOT 5.31 is a documentary gate review only.

No migration, UI modification, runtime change, test change, calculation change, persistence change, payload change, assistant change, PDF change or coaching change was performed.

Gate decision: the isolated `savingsGoal` UI percentage text consumer is READY for a source-only migration in the next LOT.

## 2. Authority References

Authority documents reviewed:

- `docs/LOT_5_28_EXTENDED_CONSUMER_ANALYSIS.md`
- `docs/LOT_5_29_SAVINGSGOAL_ARCHITECTURE_HARDENING_REPORT.md`
- `docs/LOT_5_30_ISOLATED_SAVINGSGOAL_UI_PARITY_EVIDENCE_REPORT.md`

Source inspected:

- `src/App.jsx`

## 3. Exact UI Consumer

Selected consumer: one visible text read inside the `progressIndicators` block.

File:

```txt
src/App.jsx
```

Block:

```jsx
{isFiscalProfileComplete && fiscalSummaryVisibleSlice.revenueTotal > 0 && (
  <div className="progressIndicators">
    <div className="progressItem">
      <div className="progressItemHeader">
        <span>💰 Objectif d'épargne</span>
        <span>
          {Math.min(
            100,
            Math.round((savingsProgress / savingsGoal) * 100),
          )}
          %
        </span>
      </div>
    </div>
  </div>
)}
```

Consumer selected for LOT 5.32:

```js
Math.round((savingsProgress / savingsGoal) * 100)
```

Do not select the progress fill width in the same LOT. It is another visible UI read and must remain Legacy unless explicitly included in a later gate.

## 4. Legacy Read

Current Legacy denominator:

```js
savingsGoal
```

Current Legacy source chain:

```js
estimatedCharges =
  computed?.rate
    ? Math.round(currentMonthTotal * computed.rate)
    : 0

savingsGoal =
  Math.max(estimatedCharges * 3, 500)
```

Current percentage expression:

```js
Math.min(100, Math.round((savingsProgress / savingsGoal) * 100))
```

Formatter:

```txt
None beyond Math.round, Math.min and literal "%"
```

Label:

```txt
💰 Objectif d'épargne
```

Unit:

```txt
%
```

Display condition:

```js
isFiscalProfileComplete &&
fiscalSummaryVisibleSlice.revenueTotal > 0
```

React dependencies for current upstream values:

- `estimatedCharges`: `[currentMonthTotal, computed?.rate]`
- `savingsGoal`: `[estimatedCharges]`
- `savingsProgress`: `[availableAmount]`
- `fiscalSummaryVisibleSlice`: `[computed?.acreStatus, computed?.rate, currentMonthTotal, estimatedCharges, fiscalSummaryShadow]`

## 5. Shadow Read

Expected Shadow candidate:

```js
fiscalSummaryVisibleSlice.finalContributionAmount
```

The candidate already belongs to the visible fiscal slice and already uses:

```js
FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED
```

No new Shadow read should be introduced in LOT 5.32.

The future denominator should be derived only from the existing candidate:

```js
Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)
```

This is source replacement only if it remains local to the selected UI text read.

## 6. Mapping Matrix

| Element | Legacy | Shadow | Equivalent | Proof | Status |
| --- | --- | --- | --- | --- | --- |
| Contribution amount feeding UI denominator | `estimatedCharges` | `fiscalSummaryVisibleSlice.finalContributionAmount` | Yes | LOT 5.30: 15/15 MATCH | READY |
| Savings floor | `Math.max(amount * 3, 500)` | Same formula with Shadow amount | Yes if formula unchanged | LOT 5.29 value contract, LOT 5.30 amount parity | READY |
| UI text percentage | `Math.min(100, Math.round((savingsProgress / savingsGoal) * 100))` | Same expression with local Shadow-backed denominator | Yes if formatter unchanged | Source inspection | READY |
| Progress fill width | `Math.min(100, Math.round((savingsProgress / savingsGoal) * 100))` | Not selected | Not reviewed for migration in LOT 5.31 | Source inspection | PARTIAL |
| Coaching threshold | `savingsProgress < savingsGoal * 0.35` | Not allowed | Not a migration target | LOT 5.29 boundary | READY as Legacy |
| PDF percentage | `Math.round((savingsProgress / savingsGoal) * 100 || 0)` | Not allowed | Not a migration target | LOT 5.29 boundary | READY as Legacy |
| Persistence | None direct from selected UI read | None | Yes | LOT 5.29 / LOT 5.30 inspections | READY |
| Payload / assistant | None direct from selected UI read | None | Yes | LOT 5.29 / LOT 5.30 inspections | READY |

## 7. Parity Review

LOT 5.30 evidence is sufficient for this gate:

- approved scenarios: `15/15 MATCH`;
- intentional mismatch detected and preserved;
- same input produced same result;
- cloned input produced same result;
- distinct references with same values produced same result;
- successive revenue changes remained deterministic;
- no Legacy input mutation;
- no Shadow input mutation;
- no hidden normalization;
- no tolerance;
- no new rounding;
- no new fallback.

No new parity evidence was created in LOT 5.31.

## 8. Coaching Isolation

Coaching must remain Legacy.

The current low-reserve branch is:

```js
savingsGoal > 0 &&
savingsProgress < savingsGoal * 0.35
```

LOT 5.32 must not change:

- `fiscalCoachingCard`;
- coaching branch order;
- low-reserve threshold `0.35`;
- coaching copy;
- recommendation logic.

Status: READY as isolated Legacy retention.

## 9. PDF Isolation

PDF export must remain Legacy.

The current PDF percentage is:

```js
Math.round((savingsProgress / savingsGoal) * 100 || 0)
```

LOT 5.32 must not change:

- `handleExportPDF`;
- PDF text `Objectif d epargne`;
- PDF formula;
- PDF rounding;
- export builder;
- export callback dependencies.

Status: READY as isolated Legacy retention.

## 10. Persistence / Payload / Assistant Isolation

The selected UI text consumer:

- does not write Supabase;
- does not write localStorage;
- does not feed a persistence payload;
- does not feed assistant output;
- does not feed PDF export;
- does not feed critical analytics.

Status: READY.

## 11. Feature Flag Review

The future LOT should reuse the existing visible fiscal slice flag:

```js
FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED
```

Reason:

- the candidate is already part of `fiscalSummaryVisibleSlice`;
- the selected consumer is a visible fiscal dashboard consumer;
- the flag is local, deterministic, non-persisted, network-free, user-free and date-free.

No new flag should be created in LOT 5.32.

## 12. Double Source Visible Review

The same visible percentage expression currently appears twice in the progress indicators block:

- text value: selected for LOT 5.32;
- progress fill width: not selected for LOT 5.32.

This creates a possible visible divergence if only the text migrates while the bar remains Legacy.

Gate decision: GO remains acceptable only because LOT 5.32 must be explicitly limited to the text read and must document that the progress fill remains Legacy. If that divergence is considered unacceptable during implementation review, LOT 5.32 must stop and request an expanded UI-pair gate.

Status:

- selected text read: READY;
- paired progress fill read: PARTIAL, not authorized for migration in LOT 5.32.

## 13. React / UI Review

LOT 5.32 must not introduce:

- new `useState`;
- new `useEffect`;
- new `useMemo`;
- new formatter;
- new business calculation;
- new fallback;
- new label;
- layout change;
- interaction change.

The only acceptable implementation shape is a local source replacement in the selected JSX text expression.

## 14. Rollback Review

Rollback must be local:

```txt
Shadow-backed denominator -> Legacy savingsGoal
```

Allowed rollback location:

```txt
src/App.jsx progressIndicators text percentage read only
```

No rollback may require:

- Supabase action;
- localStorage action;
- payload correction;
- assistant change;
- coaching change;
- PDF change;
- data migration.

Status: READY.

## 15. Permanent Guards

Gate review result:

- Permanent Facade Guard: respected, no Facade change.
- Permanent Migration Guard: respected, no migration in LOT 5.31.
- Permanent Shadow Rule: respected, no new Shadow read added.
- Permanent Deterministic Parity Guard: satisfied by LOT 5.30 evidence.
- Permanent Evidence Integrity Guard: respected, no invented evidence.
- Permanent Slice Isolation Guard: respected if LOT 5.32 limits itself to one UI text read.
- Legacy Retention Guard: respected, coaching/PDF/global `savingsGoal` remain Legacy.

## 16. Authorized Future Scope For LOT 5.32

Authorized file:

```txt
src/App.jsx
```

Authorized block:

```txt
progressIndicators -> progressItemHeader -> Objectif d'épargne text percentage
```

Legacy expression:

```js
Math.round((savingsProgress / savingsGoal) * 100)
```

Authorized Shadow source:

```js
fiscalSummaryVisibleSlice.finalContributionAmount
```

Required existing feature flag:

```js
FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED
```

Rollback:

```txt
restore savingsGoal as the denominator for the selected text read
```

Targeted tests expected:

- LOT 5.30 isolated UI parity evidence;
- LOT 5.29 savingsGoal architecture hardening;
- shadow parity validation;
- runtime parity evidence;
- targeted ESLint for any new or modified LOT 5.32 test.

Stop conditions for LOT 5.32:

- progress fill migration is attempted without a new gate;
- coaching changes;
- PDF changes;
- new state/effect/memo is needed;
- new fallback is needed;
- new rounding is needed;
- new formatter is needed;
- parity mismatch appears;
- rollback is no longer local.

## 17. Remaining Risks

Primary risk: the text percentage and the progress fill width display the same conceptual percentage. Migrating only one read can create a visible text/bar divergence if Shadow and Legacy ever differ.

Mitigation for LOT 5.32:

- keep the LOT limited to one text read;
- preserve mismatch detection;
- stop if reviewer requires both text and fill to move together;
- do not change coaching or PDF to remove divergence.

No current blocker prevents a source-only implementation attempt.

## 18. Final Decision

The selected isolated UI text consumer is READY for source-only migration review in LOT 5.32.

GO POUR LOT 5.32 — ISOLATED SAVINGSGOAL UI MIGRATION IMPLEMENTATION
