# LOT 5.74 — NEXT CONSUMER MIGRATION GATE REVIEW

## 1. Executive Summary

LOT 5.74 is a documentation-only migration gate review.

No runtime code, test, guard, Adapter, Facade, Domain, Rules Engine, persistence path, payload, export, assistant, coaching, invoice, reminder or dashboard behavior was modified.

Current stable Shadow baseline:

```txt
fiscalSummaryVisibleSlice = 13
```

No fourteenth Shadow consumer is approved or added by this lot.

Gate result: no remaining consumer is `READY + LOW risk` for immediate migration. The safest next meaningful scope is the Legacy `savingsGoal` dependency root, but it requires dependency analysis before any migration.

## 2. Scope and Authority

Authority documents read:

- `docs/LOT_5_18_LEGACY_RETENTION_HARDENING_REPORT.md`
- `docs/LOT_5_67_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md`
- `docs/LOT_5_68_SMART_ALERT_RAWAVAILABLE_REVENUE_PARITY_EVIDENCE_REPORT.md`
- `docs/LOT_5_69_SMART_ALERT_RAWAVAILABLE_REVENUE_MIGRATION_GATE_REVIEW.md`
- `docs/LOT_5_70_SMART_ALERT_RAWAVAILABLE_REVENUE_MIGRATION_REPORT.md`
- `docs/LOT_5_71_EXTENDED_STABILIZATION_REPORT.md`
- `docs/LOT_5_72_SMART_ALERT_RAWAVAILABLE_REVENUE_MIGRATION_VALIDATION_REPORT.md`
- `docs/LOT_5_73_SMART_ALERT_RAWAVAILABLE_REVENUE_STABILIZATION_REPORT.md`
- `docs/LOT_5_29_SAVINGSGOAL_ARCHITECTURE_HARDENING_REPORT.md`
- `docs/LOT_5_30_ISOLATED_SAVINGSGOAL_UI_PARITY_EVIDENCE_REPORT.md`
- `docs/LOT_5_37_OBJECTIF_EPARGNE_PROGRESS_BAR_MIGRATION_REPORT.md`
- `docs/LOT_5_39_OBJECTIF_EPARGNE_PROGRESS_BAR_MIGRATION_VALIDATION_REPORT.md`
- `docs/LOT_5_40_OBJECTIF_EPARGNE_PROGRESS_BAR_STABILIZATION_REPORT.md`

Inspected:

- `src/App.jsx`
- `fiscalSummaryVisibleSlice`
- remaining `currentMonthTotal` usages
- remaining `estimatedCharges` usages
- remaining `savingsGoal` usages
- `summary.baseAmount`
- `summary.finalContributionAmount`
- `summary.effectiveRate`
- `acreStatus`
- remaining smart alerts
- dashboard displays and summaries
- coaching
- obligations
- PDF/export
- assistant-adjacent state
- persistence
- feedback / analytics payload-like context
- simulator / cockpit estimate
- invoice and reminder-adjacent consumers

## 3. Current Migration State

Already migrated and stabilized:

- URSSAF helper gate
- progress indicators gate
- Objectif d'epargne text UI
- Objectif d'epargne progress bar
- weekly recap effective rate
- monthly reflection revenue amount
- monthly reflection charges amount
- smart alert reserve-low charges input
- smart alert reserve-low `rawAvailable` revenue input

Still Legacy by design:

- other `currentMonthTotal` consumers
- other `estimatedCharges` consumers
- global `savingsGoal`
- coaching
- PDF/export
- assistant-adjacent values
- feedback / analytics payload-like values
- obligations
- cockpit estimate
- available amount derivations

## 4. Candidate Inventory

| ID | Consumer exact | File / block | Legacy expression | Shadow candidate | Visible | Parity | Transformation | React dependency | Persistence | Payload | Export | Assistant | Rollback | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-74A | Global `savingsGoal` source | `src/App.jsx` `savingsGoal` `useMemo` | `Math.max(estimatedCharges * 3, 500)` | `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` | yes, via dependents | PARTIAL | existing formula reused, but global source affects multiple consumers | existing `useMemo` | no direct | no direct | yes, through PDF | indirect coaching | source rollback local, consumer impact not local | HIGH |
| C-74B | Coaching low-reserve threshold | `src/App.jsx` `fiscalCoachingCard` | `savingsGoal > 0 && savingsProgress < savingsGoal * 0.35` | Shadow-backed savings denominator plus available derivation | yes | NEEDS EVIDENCE | threshold behavior and available amount coupling | existing `useMemo` | no | no direct | no | coaching behavior | not fully local | HIGH |
| C-74C | PDF Objectif d'epargne percentage | `src/App.jsx` `handleExportPDF` | `Math.round((savingsProgress / savingsGoal) * 100 || 0)` | Shadow-backed denominator | exported | NEEDS EVIDENCE | export contract and percentage output | callback dependency | no | analytics nearby | yes | no | local expression only, export impact not local | BLOCKED |
| C-74D | Dashboard available display | `src/App.jsx` `dashboardAvailableDisplay` | `cockpitEstimate.hasEstimate ? cockpitEstimate.available : availableAmount` | derived from `baseAmount - finalContributionAmount` for real data | yes | NEEDS EVIDENCE | new available derivation and provisional branching | render constants | no | no | export-adjacent display reuse | no | not local | HIGH |
| C-74E | Smart priorities recommended reserve | `src/App.jsx` `buildSmartPriorities(...)` call | `recommendedReserve: availableAmount` | derived Shadow available amount | yes | NEEDS EVIDENCE | new available derivation | existing `useMemo` | no | indirect | no | no | not local | HIGH |
| C-74F | Assistant guidance real revenue | `src/App.jsx` `simpleAssistantGuidance` | `realMonthlyRevenue: currentMonthTotal` | `fiscalSummaryVisibleSlice.revenueTotal` | yes | field READY, consumer not ready | assistant behavior | existing `useMemo` | no | no | no | yes | local expression, assistant impact | BLOCKED |
| C-74G | Feedback context total revenues | `src/App.jsx` `feedbackContextSnapshot` | `totalRevenues: currentMonthTotal || 0` | `fiscalSummaryVisibleSlice.revenueTotal` | no | field READY, payload not ready | payload contract | existing `useMemo` | no direct | yes | no | no | local expression, payload impact | BLOCKED |
| C-74H | PDF revenue summary | `src/App.jsx` `handleExportPDF` | `getDisplayValue(currentMonthTotal, "money")` | `fiscalSummaryVisibleSlice.revenueTotal` | exported | field READY, export not ready | export output contract | callback dependency | no | analytics nearby | yes | no | local expression, export impact | BLOCKED |
| C-74I | Obligations monthly CA input | `src/App.jsx` `computed` / `computeObligations(...)` | `ca_month: currentMonthTotal` | Facade or `fiscalSummaryVisibleSlice.revenueTotal` candidate | indirect | BLOCKED | core obligations input and deadlines | core `useMemo` | no direct | indirect | no | no | not local | BLOCKED |
| C-74J | Cockpit estimate real revenue base | `src/App.jsx` `cockpitEstimate` | `hasRealRevenue ? currentMonthTotal : starterRevenue` | `fiscalSummaryVisibleSlice.revenueTotal` for real data | yes | NEEDS EVIDENCE | mixed real/provisional behavior | existing `useMemo` | no | indirect | export-adjacent | assistant-adjacent | ambiguous | HIGH |

## 5. Automatic Exclusions

Excluded from immediate migration:

- `dashboardAvailableDisplay`: requires a new or newly authorized available-amount derivation.
- `buildSmartPriorities` recommended reserve: depends on `availableAmount`, not a direct Shadow field.
- assistant guidance: assistant-facing behavior requires a dedicated gate.
- feedback context: payload-like contract requires a dedicated gate.
- PDF revenue and savings values: exported output requires export parity.
- obligations: core Legacy obligations engine input and deadlines require an obligations gate.
- cockpit estimate: mixes real revenue with starter/provisional estimates.

All exclusions follow the automatic rules because they require a new formula, affect payload/export/assistant boundaries, touch multiple consumers, or lack a sufficiently local rollback.

## 6. Smart Alerts Review

Remaining smart-alert branches:

- TVA threshold reads `computed?.tvaStatus`.
- ACRE ending reads `answers?.acre` and `answers?.acre_start_date`.
- early tracking reads `revenues.length`.
- all-clear has no fiscal source input.

The reserve-low charges and revenue inputs are already migrated and stabilized.

No remaining smart-alert consumer is selected for LOT 5.75 because the remaining branches do not map cleanly to one direct proven Shadow field. TVA and ACRE are derived behavior, while early tracking is not a fiscal summary field.

## 7. Double Source Visible Review

The next visible-risk cluster is `savingsGoal`:

- Objectif d'epargne UI text: already Shadow-backed with `fiscalSummaryVisibleSlice.finalContributionAmount * 3`.
- Objectif d'epargne progress bar: already Shadow-backed with `fiscalSummaryVisibleSlice.finalContributionAmount * 3`.
- Global `savingsGoal`: still Legacy-backed by `estimatedCharges`.
- Coaching low-reserve threshold: still reads global `savingsGoal`.
- PDF Objectif d'epargne percentage: still reads global `savingsGoal`.

This creates a known architectural split: visible Objectif UI is migrated, while global `savingsGoal` remains a retained Legacy compatibility source for coaching and PDF.

## 8. Parity Review

Available parity evidence:

- `summary.finalContributionAmount` parity exists for isolated Objectif d'epargne UI consumers.
- `revenue.total`, `summary.baseAmount`, `summary.finalContributionAmount`, `summary.effectiveRate`, and ACRE status are visible-slice fields already used in previous lots.
- runtime parity and mismatch evidence remain active.

Missing evidence:

- global `savingsGoal` as a shared source;
- coaching low-reserve behavior when the denominator changes;
- PDF Objectif d'epargne export percentage when the denominator changes;
- combined effects with `savingsProgress` / `availableAmount`, which remains Legacy-derived;
- rollback impact when only one dependent is migrated versus the global source.

Classification:

```txt
Global savingsGoal dependency root: NEEDS ANALYSIS
```

## 9. Selected Consumer

Selected next consumer for study:

```txt
C-74A — Global savingsGoal source
```

Current Legacy expression:

```js
Math.max(estimatedCharges * 3, 500)
```

Candidate Shadow expression:

```js
Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)
```

Selected next lot type:

```txt
SAVINGSGOAL DEPENDENCY ANALYSIS
```

This is not ready for implementation. It is selected because it is the dependency root behind the remaining Objectif d'epargne Legacy boundaries.

## 10. Why This Consumer

`savingsGoal` is the safest next subject to analyze because:

- the Shadow field `finalContributionAmount` is already proven and used by the Objectif d'epargne UI text and progress bar;
- the formula shape `Math.max(amount * 3, 500)` is already characterized;
- the remaining Legacy responsibilities are explicitly documented by LOT 5.29;
- it is the root dependency for both remaining savings-related boundaries: coaching and PDF;
- a dedicated dependency analysis can decide whether to migrate the global source, one dependent consumer, or neither.

It is not ready for migration because changing the global source would affect more than one consumer.

## 11. Required Future Analysis

LOT 5.75 should analyze:

- whether global `savingsGoal` can ever be migrated directly;
- whether coaching and PDF must remain separate migration tracks;
- whether `savingsProgress` / `availableAmount` must be migrated first;
- whether a local alias should be preferred over modifying global `savingsGoal`;
- exact rollback shape for each possible path;
- parity scenarios for low reserve coaching threshold;
- parity scenarios for PDF percentage output;
- no propagation to feedback, analytics, assistant, persistence, invoices or reminders.

No implementation should occur until the dependency graph is resolved.

## 12. Rollback Review

Potential source rollback if a future migration is approved:

```diff
- Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)
+ Math.max(estimatedCharges * 3, 500)
```

However, because global `savingsGoal` feeds coaching and PDF, rollback must be validated at the dependency level before implementation. That is the main reason this candidate is selected for analysis rather than immediate migration.

## 13. Permanent Guards

Permanent Facade Guard: respected. No Facade change was made.

Permanent Migration Guard: respected. No consumer was migrated.

Permanent Shadow Rule: respected. No new Shadow read was added.

Permanent Deterministic Parity Guard: respected. This review selects analysis before evidence or migration.

Permanent Evidence Integrity Guard: respected. No mismatch is hidden or corrected.

Permanent Slice Isolation Guard: respected. Baseline remains `13`; no fourteenth occurrence is added.

Legacy Retention Guard: respected. Legacy remains the compatibility layer for retained consumers.

## 14. Confirmations

Confirmed:

- exactly one document created;
- no code modified;
- no test modified;
- no consumer migrated;
- no new slice;
- baseline Shadow remains `13`;
- no fourteenth occurrence added;
- no persistence modified;
- no payload modified;
- no export modified;
- no assistant modified;
- no formula modified;
- no rate modified;
- no rounding modified;
- Legacy remains compatibility layer;
- no new consumer Legacy added.

## 15. Lightweight Validation

Executed lightweight validation only:

```txt
git diff --stat
git status --short
git diff -- docs/LOT_5_74_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md
git status --short --untracked-files=all -- docs/LOT_5_74_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md
```

Observed:

- `git diff --stat` showed only pre-existing tracked worktree changes; untracked LOT documents are not included in that stat.
- `git status --short` showed the existing dirty worktree plus untracked `docs/`.
- `git diff -- docs/LOT_5_74_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md` produced no output because the LOT 5.74 report is a new untracked file.
- `git status --short --untracked-files=all -- docs/LOT_5_74_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md` returned:

```txt
?? docs/LOT_5_74_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md
```

Not run by scope:

- `node --test`
- `npm run build`
- `npm run lint`
- Playwright
- application

## 16. Risks

No runtime risk was introduced because this lot is documentation-only.

Residual planning risks:

- global `savingsGoal` is shared by coaching and PDF;
- `savingsProgress` still depends on Legacy `availableAmount`;
- PDF export parity has not been proven for a Shadow denominator;
- coaching threshold behavior has not been proven for a Shadow denominator;
- changing the global source would not be a single isolated visible consumer migration.

## 17. Decision for LOT 5.75

Selected next scope:

```txt
Global savingsGoal dependency root
```

Selected next lot:

```txt
GO POUR LOT 5.75 — SAVINGSGOAL DEPENDENCY ANALYSIS
```

## 18. Final Decision

GO POUR LOT 5.75 — SAVINGSGOAL DEPENDENCY ANALYSIS
