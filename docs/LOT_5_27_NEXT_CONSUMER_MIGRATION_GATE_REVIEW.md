# LOT 5.27 - Next Consumer Migration Gate Review

## 1. Executive Summary

LOT 5.27 is documentation-only.

No migration was implemented. No application file, test, runtime calculation, Adapter, Facade, Domain, Rules Engine, persistence path, payload, export or assistant path was modified.

The next candidate selected for deeper review is:

```text
Progress indicators savings goal charge base
```

Current Legacy expression:

```text
Math.max(estimatedCharges * 3, 500)
```

Candidate Shadow expression:

```text
Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)
```

Decision: GO POUR LOT 5.28 — EXTENDED CONSUMER ANALYSIS.

Reason: `summary.finalContributionAmount` exists and has parity evidence, but this consumer is not LOW risk yet because `savingsGoal` is shared with progress UI, fiscal coaching, and PDF export percentage output.

## 2. Scope and Authority

Authority documents read:

- `docs/LOT_5_18_LEGACY_RETENTION_HARDENING_REPORT.md`
- `docs/LOT_5_23_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md`
- `docs/LOT_5_24_NEXT_CONSUMER_MIGRATION_IMPLEMENTATION_REPORT.md`
- `docs/LOT_5_25_NEXT_CONSUMER_MIGRATION_VALIDATION_REPORT.md`
- `docs/LOT_5_26A_STABILIZATION_ANALYSIS_REPORT.md`
- `docs/LOT_5_26_NEXT_CONSUMER_STABILIZATION_REPORT.md`

Inspected:

- `src/App.jsx`
- `fiscalSummaryVisibleSlice`
- `currentMonthTotal`
- `estimatedCharges`
- `availableAmount`
- `dashboardChargesDisplay`
- `dashboardAvailableDisplay`
- `computed?.rate`
- `computed?.acreStatus`
- remaining dashboard consumers
- summary consumers
- obligations
- assistant-adjacent state
- exports
- persistence
- feedback / analytics
- simulator / preview
- invoice-related consumers

## 3. Current Migration State

Already Shadow-backed through `fiscalSummaryVisibleSlice` when the feature flag is ON and Shadow Result exists:

- dashboard revenue display
- dashboard amount-to-set-aside display for real revenue
- URSSAF helper amount and revenue-presence gate
- progress indicators revenue-presence gate

Approved Shadow fields remain:

- `revenue.total`
- `summary.baseAmount`
- `summary.finalContributionAmount`
- `summary.effectiveRate`
- `acre.status`

Legacy remains retained as a compatibility layer for rollback, parity, runtime evidence, persistence compatibility, payloads, exports, assistant-adjacent state and non-migrated dashboard consumers.

## 4. Permanent Guards

Permanent Facade Guard: respected. No Facade change is proposed.

Permanent Migration Guard: respected. This LOT selects one future candidate only.

Permanent Shadow Rule: respected. No new Shadow read is added in runtime code.

Permanent Deterministic Parity Guard: respected. Candidate assessment uses existing deterministic evidence for `summary.finalContributionAmount`.

Permanent Evidence Integrity Guard: respected. No MISMATCH is hidden or corrected.

Permanent Slice Isolation Guard: respected. Exactly one candidate is selected for future analysis.

Legacy Retention Guard: respected. Legacy remains a compatibility layer and no new Legacy consumer is added.

## 5. Short Remaining Consumer Inventory

| ID | Consumer | File / block | Legacy value | Shadow value | Visible | Parity | React dependency | Persistence | Payload | Export | Assistant | Rollback | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-20 | Progress indicators savings goal charge base | `src/App.jsx` `savingsGoal` | `estimatedCharges` in `Math.max(estimatedCharges * 3, 500)` | `fiscalSummaryVisibleSlice.finalContributionAmount` available | yes, via progress percentage | yes for `summary.finalContributionAmount` | `useMemo` | no | no | yes, indirect through PDF percentage | no | local expression possible | MEDIUM |
| C-21 | Dashboard available display | `dashboardAvailableDisplay` | `availableAmount` / `cockpitEstimate.available` | no approved available field | yes | no approved field parity | display expression | no | indirect | yes, indirect | no | not local enough | BLOCKED |
| C-22 | Weekly recap estimated charges | `dashboardWeeklyRecap` | `computed?.rate` plus weekly revenue formula | `fiscalSummaryVisibleSlice.effectiveRate` available | yes | yes for rate only | `useMemo` with date and invoices | no | no | no | no | local rate read only, formula remains | MEDIUM |
| C-23 | Simulator preview rate / charges | revenue modal preview | `computed?.rate`, category rate fallback, `previewCharges` | `effectiveRate` partial only | yes | partial | multiple `useMemo` | no | no | no | no | not isolated | HIGH |
| C-24 | Monthly reflection | `dashboardMonthlyReflection` | `currentMonthTotal`, `estimatedCharges`, invoices | revenue and contribution fields partial | currently summary text | partial | `useMemo` | no | no | no | assistant-adjacent tone | local but broad text contract | HIGH |
| C-25 | Feedback context | `feedbackContextSnapshot` | `currentMonthTotal`, `computed`, profile context | partial | no direct UI | partial | `useMemo` | no | yes | no | no | payload contract change | BLOCKED |
| C-26 | PDF export summary | `handleExportPDF` | `currentMonthTotal`, `computed`, display helpers, savings values | partial | exported | partial | callback | export counters | analytics after export | yes | no | not local | BLOCKED |
| C-27 | Assistant guidance | `simpleAssistantGuidance` | `currentMonthTotal` | `revenue.total` available | yes | yes | `useMemo` | no | no | no | yes | local technically, but assistant-adjacent | BLOCKED |
| C-28 | Obligations | `computeObligations(...)` | `currentMonthTotal`, YTD, months, profile | no complete approved equivalent | indirect | no complete proof | `useMemo` | no direct | downstream | downstream | downstream | not local | BLOCKED |

The inventory is intentionally short. Broader invoice, TVA, smart priority, ACRE profile, persistence and export groups remain excluded because they require multiple consumers, unapproved fields, dates, payloads, exports, assistant state or wider rule contracts.

## 6. Short Matrix

| Consumer | Legacy | Shadow | Parity | Isolation | Rollback | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| C-20 savings goal charge base | LOW | LOW | LOW | MEDIUM | LOW | MEDIUM |
| C-21 dashboard available display | HIGH | BLOCKED | BLOCKED | HIGH | HIGH | BLOCKED |
| C-22 weekly recap estimated charges | MEDIUM | LOW | LOW for rate only | MEDIUM | MEDIUM | MEDIUM |
| C-23 simulator preview | HIGH | MEDIUM | MEDIUM | HIGH | HIGH | HIGH |
| C-24 monthly reflection | MEDIUM | MEDIUM | MEDIUM | HIGH | MEDIUM | HIGH |
| C-25 feedback context | HIGH | MEDIUM | MEDIUM | BLOCKED | HIGH | BLOCKED |
| C-26 PDF export summary | HIGH | MEDIUM | MEDIUM | BLOCKED | HIGH | BLOCKED |
| C-27 assistant guidance | LOW | LOW | LOW | BLOCKED | MEDIUM | BLOCKED |
| C-28 obligations | HIGH | BLOCKED | BLOCKED | BLOCKED | HIGH | BLOCKED |

## 7. Excluded Candidates

Excluded from LOT 5.28 implementation:

- `dashboardAvailableDisplay`: no approved Shadow `availableAmount` field.
- `dashboardWeeklyRecap`: uses week-local revenue aggregation, injected current date helper, invoices and a weekly formula; the Shadow field covers rate only.
- simulator preview: category-specific rate fallback and preview formulas are not isolated.
- `dashboardMonthlyReflection`: text composition and assistant-adjacent tone risk.
- `feedbackContextSnapshot`: payload-like analytics contract.
- `handleExportPDF`: exported output contract, dates and counters.
- `simpleAssistantGuidance`: assistant-adjacent behavior.
- `computeObligations`: broad Legacy rules surface with no complete approved Shadow replacement.
- invoice-related consumers: persistence/export/invoice coupling.
- ACRE profile/status UI: profile persistence and date-sensitive semantics.

## 8. Selected Consumer

Selected consumer:

```text
C-20 Progress indicators savings goal charge base
```

File / block:

```text
src/App.jsx
const savingsGoal = useMemo(() => {
  return Math.max(estimatedCharges * 3, 500);
}, [estimatedCharges]);
```

Legacy value:

```text
estimatedCharges
```

Shadow candidate:

```text
fiscalSummaryVisibleSlice.finalContributionAmount
```

Candidate future expression:

```text
Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)
```

The candidate uses an already approved field but keeps the existing multiplier and floor. No new formula is needed, but the existing formula is part of the consumer contract and must be guarded before any migration.

## 9. Why This Candidate Was Chosen

C-20 is the smallest remaining candidate that uses an approved Shadow field and does not require Adapter, Facade, Domain, Rules, persistence, Supabase, localStorage, payload, assistant or invoice changes.

It is safer than `availableAmount` because `availableAmount` has no approved Shadow field.

It is safer than `computed?.rate` consumers because rate consumers are usually coupled to formulas, simulator behavior, exports or weekly date windows.

It is safer than assistant or feedback candidates because those are contract-bearing user guidance or payload paths.

It is not safe enough for immediate migration because `savingsGoal` is shared outside the progress indicators visual block.

## 10. Existing Evidence

Existing parity covers:

```text
summary.finalContributionAmount
```

Evidence sources:

- `runtimeParityEvidence.js` compares `summary.finalContributionAmount`.
- `shadow-parity-validation.test.js` validates passive MATCH / MISMATCH behavior.
- `runtime-parity-evidence.test.js` validates runtime evidence and intentional MISMATCH handling.
- LOT 5.13 through LOT 5.15 validate visible selector behavior for `finalContributionAmount`.
- LOT 5.24 through LOT 5.26 keep the visible selector and runtime evidence intact.

No new parity field is required for the charge base itself.

Missing evidence:

- focused proof that `savingsGoal` can migrate without changing export output expectations;
- focused proof that `fiscalCoachingCard` behavior remains unchanged or is explicitly scoped;
- focused proof that progress percentage behavior remains unchanged except for the approved source selection.

## 11. Isolation Assessment

Direct block:

- `savingsGoal` is a `useMemo`.
- It depends on `estimatedCharges`.
- It is used by progress percentage display.

Known downstream users:

- progress indicators percentage;
- progress fill width;
- `fiscalCoachingCard` threshold check;
- PDF export objective percentage.

This means the consumer is not isolated enough for an immediate migration implementation.

## 12. Double Source Assessment

The charge amount itself is already visible elsewhere through:

```text
dashboardChargesDisplay
```

For real revenue, `dashboardChargesDisplay` already reads:

```text
fiscalSummaryVisibleSlice.finalContributionAmount
```

Current divergence risk:

- displayed charge amount can be Shadow-backed;
- `savingsGoal` still uses Legacy `estimatedCharges`;
- progress percentage and export objective percentage can therefore remain Legacy-derived while the displayed charge amount is Shadow-derived.

Migrating C-20 could reduce that double source, but only if the export and coaching side effects are explicitly bounded.

## 13. Feature Flag Assessment

C-20 logically belongs near the existing first visible fiscal summary slice because it uses the same contribution amount already exposed as:

```text
fiscalSummaryVisibleSlice.finalContributionAmount
```

It should reuse the existing feature flag through `fiscalSummaryVisibleSlice`.

No new flag should be created unless LOT 5.28 proves the shared export/coaching dependencies require separate rollout control.

## 14. Rollback Assessment

Candidate rollback is local at the expression level:

```text
Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)
```

back to:

```text
Math.max(estimatedCharges * 3, 500)
```

Rollback would not require data migration, Supabase, localStorage, Adapter, Facade, Domain, Rules, payload or assistant changes.

However, rollback locality must also account for the `useMemo` dependency list and shared downstream users.

## 15. Exact Future Scope to Analyze

Recommended LOT 5.28 scope:

```text
EXTENDED CONSUMER ANALYSIS
```

Analyze only:

- `savingsGoal`;
- progress indicators percentage and fill width;
- `fiscalCoachingCard` dependency on `savingsGoal`;
- PDF export dependency on `savingsGoal`;
- `dashboardChargesDisplay` as the neighboring Shadow-backed charge display;
- rollback expression and dependency list.

Do not analyze as implementation:

- `savingsProgress`;
- `availableAmount`;
- dashboard available display;
- simulator preview;
- feedback payloads;
- assistant guidance;
- obligations;
- invoice paths;
- ACRE UI.

## 16. Potential Future Files

If LOT 5.28 is only extended analysis:

- `docs/LOT_5_28_EXTENDED_CONSUMER_ANALYSIS.md`

If a later implementation is approved after extended analysis:

- `src/App.jsx`, only around `savingsGoal`;
- a targeted test file for the approved savings-goal migration;
- a short implementation report.

No implementation is authorized by LOT 5.27.

## 17. Tests Required Before Any Future Migration

Future proof should cover:

- exact `savingsGoal` source;
- existing multiplier `* 3` unchanged;
- existing floor `500` unchanged;
- progress percentage unchanged for equal Legacy / Shadow values;
- progress fill width unchanged for equal Legacy / Shadow values;
- flag ON uses Shadow-backed final contribution amount;
- flag OFF restores Legacy `estimatedCharges`;
- absent Shadow Result restores Legacy `estimatedCharges`;
- no `savingsProgress` migration;
- no `availableAmount` migration;
- no export payload or PDF contract change unless explicitly approved;
- no assistant change;
- no persistence change;
- no Adapter or Facade change;
- parity and runtime evidence intact;
- Legacy Retention Guards intact;
- rollback local and deterministic.

## 18. Scope Control

Confirmed for LOT 5.27:

- exactly one document created;
- no code modified;
- no test modified;
- no consumer migrated;
- no new slice;
- no new Shadow read in runtime;
- no new Legacy consumer;
- no persistence modified;
- no payload modified;
- no export modified;
- no assistant modified;
- no formula modified;
- no rate modified;
- no rounding modified;
- Legacy remains a compatibility layer.

## 19. Decision for LOT 5.28

C-20 is the selected consumer, but not approved for immediate implementation because its dependencies are not yet isolated enough.

Final decision:

```text
GO POUR LOT 5.28 — EXTENDED CONSUMER ANALYSIS
```
