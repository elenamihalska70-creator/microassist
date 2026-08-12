# LOT 5.76 - SavingsGoal Contract Hardening Report

## 1. Executive Summary

LOT 5.76 is a documentation-only contract hardening pass for the retained Legacy `savingsGoal` root.

No runtime code, helper, test, UI, coaching, PDF/export, persistence, payload, assistant, Adapter, Facade, Domain, Rules Engine, rate, rounding or Shadow field was modified.

The retained root remains:

```js
const savingsGoal = useMemo(() => {
  // Objectif d'epargne recommande: 3 mois de charges
  return Math.max(estimatedCharges * 3, 500);
}, [estimatedCharges]);
```

The core decision is unchanged from LOT 5.75: do not migrate the global `savingsGoal` root while it still feeds non-UI boundaries. The remaining direct runtime consumers are the coaching low-reserve condition, the PDF/export `Objectif d epargne` percentage, and React dependency lists for those boundaries.

## 2. Root Contract

`savingsGoal` is a Legacy compatibility root.

Contract:

```txt
savingsGoal = max(estimatedCharges * 3, 500)
```

Current source chain:

```txt
revenues
  -> currentMonthTotal
  -> estimatedCharges
  -> savingsGoal
```

Exact source facts:

```js
const currentMonthTotal = useMemo(() => {
  return revenues.reduce((sum, item) => {
    return sum + Number(item.amount || 0);
  }, 0);
}, [revenues]);

const estimatedCharges = useMemo(() => {
  if (computed?.rate) {
    return Math.round(currentMonthTotal * computed.rate);
  }
  return 0;
}, [currentMonthTotal, computed?.rate]);

const availableAmount = useMemo(() => {
  return Math.max(0, currentMonthTotal - estimatedCharges);
}, [currentMonthTotal, estimatedCharges]);

const savingsProgress = useMemo(() => {
  // Epargne actuelle = disponible estime
  return availableAmount;
}, [availableAmount]);
```

Root retention rule:

```txt
The global savingsGoal root must remain Legacy until every non-UI consumer has
dedicated parity evidence and a consumer-specific migration gate.
```

## 3. Amount Contract

The `savingsGoal` amount is a recommended reserve amount, not a payable charge.

Amount formula:

```txt
recommended reserve = max(three months of estimated charges, 500 euros)
```

Input:

```txt
estimatedCharges = round(currentMonthTotal * computed.rate)
```

Fallback:

```txt
if computed.rate is falsy, estimatedCharges = 0
if estimatedCharges = 0, savingsGoal = 500
```

Rounding:

```txt
No direct rounding is performed inside savingsGoal.
savingsGoal inherits the integer nature of estimatedCharges.
```

Floor:

```txt
The minimum savingsGoal is 500.
```

Examples:

| estimatedCharges | savingsGoal |
| ---: | ---: |
| 0 | 500 |
| 1 | 500 |
| 100 | 500 |
| 166 | 500 |
| 167 | 501 |
| 300 | 900 |
| 1000 | 3000 |

This amount contract is already proven for the migrated `Objectif d'epargne` UI text and progress bar amount denominator through previous UI-focused lots, but it is not sufficient to prove coaching or PDF/export parity.

## 4. Percentage Contract

There are three distinct percentage or threshold contracts. They must not be collapsed into the root amount contract.

### UI Text Percentage

Current UI text source:

```js
Math.min(
  100,
  Math.round(
    (savingsProgress /
      Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)) *
      100
  )
)
```

Contract:

```txt
Visible UI text percentage uses a Shadow-backed denominator through
fiscalSummaryVisibleSlice.finalContributionAmount.
It is rounded with Math.round and capped at 100.
```

Status: already migrated and stabilized.

### UI Progress Bar Width

Current progress bar width source:

```js
`${Math.min(
  100,
  Math.round(
    (savingsProgress /
      Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)) *
      100
  )
)}%`
```

Contract:

```txt
Visible progress fill width uses the same Shadow-backed denominator as the UI text.
It is rounded with Math.round, capped at 100, then serialized as a percent width string.
```

Status: already migrated and stabilized.

### PDF / Export Percentage

Current PDF/export source:

```js
typeof savingsGoal !== "undefined" && savingsGoal > 0
  ? `${Math.round((savingsProgress / savingsGoal) * 100 || 0)}%`
  : "Pas encore assez de donnees"
```

Contract:

```txt
PDF/export percentage remains Legacy.
It uses savingsProgress as numerator and savingsGoal as denominator.
It uses Math.round.
It uses || 0 inside the rounded expression.
It serializes the result with a trailing percent sign.
It does not cap the result at 100.
```

Status: not ready for migration. It needs PDF/export-specific parity evidence.

## 5. Input Contract

| Input | Current source | Role in savingsGoal contract | Shadow candidate | Current evidence |
| --- | --- | --- | --- | --- |
| `currentMonthTotal` | `revenues.reduce(...Number(item.amount || 0))` | charge base and available amount base | `fiscalSummaryVisibleSlice.revenueTotal` | proven for several migrated revenue display consumers, not sufficient for available ratio |
| `computed?.rate` | Legacy obligation computation | charge rate | `fiscalSummaryVisibleSlice.effectiveRate` | proven for weekly effective rate consumer only |
| `estimatedCharges` | `Math.round(currentMonthTotal * computed.rate)` | direct `savingsGoal` input | `fiscalSummaryVisibleSlice.finalContributionAmount` | proven for Objectif UI amount consumers and smart-alert charges inputs |
| `availableAmount` | `Math.max(0, currentMonthTotal - estimatedCharges)` | `savingsProgress` source | no approved direct field | not ready |
| `savingsProgress` | `availableAmount` | numerator for UI/PDF ratios and coaching threshold | no approved direct field | not ready |
| `savingsGoal` | `Math.max(estimatedCharges * 3, 500)` | Legacy denominator and coaching threshold source | derived from `fiscalSummaryVisibleSlice.finalContributionAmount` | UI amount proven; root not globally ready |

Important boundary:

```txt
Replacing the denominator alone does not prove a full ratio migration because
the numerator remains savingsProgress, which is derived from availableAmount.
```

## 6. Coaching Contract

The coaching low-reserve contract remains Legacy.

Current condition:

```js
!smartAlertIds.has("reserve-low") &&
savingsGoal > 0 &&
savingsProgress < savingsGoal * 0.35
```

Contract:

```txt
If no reserve-low smart alert is already present,
and the Legacy savingsGoal is positive,
and available reserve progress is below 35 percent of Legacy savingsGoal,
then the low-reserve coaching card may be selected.
```

Classification:

| Dimension | Status |
| --- | --- |
| Consumer type | behavioral coaching branch |
| Output | selected coaching message |
| Raw amount displayed | no |
| Percentage displayed | no |
| Threshold | `savingsGoal * 0.35` |
| Numerator | `savingsProgress` |
| Denominator | `savingsGoal` |
| Guard interaction | skipped when `reserve-low` smart alert already exists |
| Risk | medium-high |
| Migration readiness | needs dedicated parity evidence |

Coaching must not be migrated by changing the global `savingsGoal` root. A future migration must be scoped to the coaching condition only and must prove branch ON/OFF parity, smart-alert interaction, and branch priority behavior.

## 7. PDF / Export Contract

The PDF/export `Objectif d epargne` contract remains Legacy.

Current exported line:

```js
`Objectif d epargne : ${
  typeof savingsGoal !== "undefined" && savingsGoal > 0
    ? `${Math.round((savingsProgress / savingsGoal) * 100 || 0)}%`
    : "Pas encore assez de donnees"
}`
```

Contract:

| Dimension | Status |
| --- | --- |
| Consumer type | exported output |
| Section | PDF analysis / projection block |
| Raw `savingsGoal` exported | no |
| Derived value exported | yes, percentage |
| Numerator | `savingsProgress` |
| Denominator | `savingsGoal` |
| Positive guard | `typeof savingsGoal !== "undefined" && savingsGoal > 0` |
| Formatter | template string with trailing `%` |
| Rounding | `Math.round` |
| Fallback | `"Pas encore assez de donnees"` |
| Cap at 100 | no |
| Risk | high |
| Migration readiness | needs PDF/export-specific parity evidence |

PDF/export should remain after coaching in the migration order because it is a downloaded artifact contract and has a higher external-observability risk than an in-app coaching branch.

## 8. Root Retention Guard

The root retention guard is now:

```txt
Never replace global savingsGoal while either of these remains true:
- fiscalCoachingCard reads savingsGoal;
- handleExportPDF reads savingsGoal.
```

Current retained direct reads:

| Boundary | Direct read | Required state |
| --- | --- | --- |
| root definition | `savingsGoal` | Legacy |
| coaching | `savingsGoal > 0` | Legacy |
| coaching | `savingsProgress < savingsGoal * 0.35` | Legacy |
| coaching deps | `savingsGoal` | Legacy dependency |
| PDF/export | `typeof savingsGoal !== "undefined" && savingsGoal > 0` | Legacy |
| PDF/export | `Math.round((savingsProgress / savingsGoal) * 100 || 0)` | Legacy |
| PDF/export deps | `savingsGoal` | Legacy dependency |

This guard protects against a broad root swap that would silently change coaching selection and exported PDF values together.

## 9. Helper Decision

No helper was created in LOT 5.76.

Reason:

```txt
A standalone helper would not be connected to an actual migrated consumer yet.
Creating it now would either duplicate a simple formula or introduce a new
conceptual Shadow savings goal before a boundary is authorized to consume it.
```

The current contracts are more safely captured as documentation until the next LOT selects a specific behavioral or export boundary.

Allowed future helper shape, only if justified by a consumer migration:

```txt
consumer-specific denominator builder
input: approved contribution amount
output: max(amount * 3, 500)
scope: one boundary only
```

Disallowed helper shape:

```txt
global replacement for savingsGoal
```

## 10. Contract Tests

No contract test was added in LOT 5.76.

Reason:

```txt
No helper, runtime function, parser, adapter or consumer behavior was created or changed.
The executable guard would be artificial unless tied to a selected consumer.
```

Existing guard history remains the reference:

| Prior LOT | Coverage |
| --- | --- |
| LOT 5.29 | root retention, UI/coaching/PDF boundary separation |
| LOT 5.30 | Objectif UI text parity evidence |
| LOT 5.32 | Objectif UI text migration guards |
| LOT 5.34 / 5.35 | Objectif UI text validation and stabilization |
| LOT 5.37 / 5.39 / 5.40 | Objectif progress bar migration, validation and stabilization |
| LOT 5.75 | remaining dependency root analysis |

The next executable evidence should be created for a real consumer boundary, preferably the coaching low-reserve branch.

Verification commands executed for this documentation-only LOT:

```txt
git diff --stat
git status --short
git diff -- docs/LOT_5_76_SAVINGSGOAL_CONTRACT_HARDENING_REPORT.md
git status --short --untracked-files=all -- docs/LOT_5_76_SAVINGSGOAL_CONTRACT_HARDENING_REPORT.md
```

Observed result:

```txt
git diff --stat: existing tracked worktree changes only; the untracked LOT 5.76 report is not included.
git status --short: existing broader worktree changes plus untracked docs/ and tests/ entries.
git diff -- docs/LOT_5_76_SAVINGSGOAL_CONTRACT_HARDENING_REPORT.md: no output because the report is untracked.
scoped status: ?? docs/LOT_5_76_SAVINGSGOAL_CONTRACT_HARDENING_REPORT.md
```

## 11. Coaching Readiness

Coaching is not ready for migration, but it is the best next evidence target.

Readiness matrix:

| Requirement | Status |
| --- | --- |
| exact Legacy condition known | ready |
| Shadow denominator candidate known | ready |
| full numerator parity proven | missing |
| branch ON/OFF parity proven | missing |
| `reserve-low` smart-alert interaction proven | missing |
| branch priority interaction proven | missing |
| rollback scope identified | ready, if consumer-specific |

Recommended evidence target:

```txt
Legacy condition:
savingsGoal > 0 && savingsProgress < savingsGoal * 0.35

Candidate condition:
shadowDerivedGoal > 0 && savingsProgress < shadowDerivedGoal * 0.35
```

The evidence LOT should not change runtime behavior. It should only prove whether the two conditions agree across representative fixtures.

## 12. PDF Readiness

PDF/export is not ready for migration.

Readiness matrix:

| Requirement | Status |
| --- | --- |
| exact Legacy expression known | ready |
| Shadow denominator candidate known | ready |
| PDF output line known | ready |
| denominator parity for UI amount | proven |
| full exported percentage parity | missing |
| fallback branch parity | missing |
| no-100-cap behavior preserved | missing |
| PDF regression guard | missing |

PDF/export should remain Legacy until after the coaching boundary has dedicated evidence or is explicitly deferred by a gate review.

## 13. Shadow Baseline

The current retained Shadow baseline from LOT 5.75 is:

```txt
fiscalSummaryVisibleSlice = 13
```

LOT 5.76 adds no runtime Shadow read and no `src/App.jsx` change.

Expected baseline state:

```txt
fiscalSummaryVisibleSlice remains 13
no 14th occurrence introduced by this LOT
```

## 14. No Propagation

No propagation occurred in LOT 5.76.

Unaffected boundaries:

| Boundary | Status |
| --- | --- |
| `src/App.jsx` | unchanged by this LOT |
| global `savingsGoal` root | unchanged |
| `estimatedCharges` | unchanged |
| `currentMonthTotal` | unchanged |
| `availableAmount` | unchanged |
| `savingsProgress` | unchanged |
| Objectif UI text | unchanged, already Shadow-backed |
| Objectif progress bar | unchanged, already Shadow-backed |
| coaching | unchanged, Legacy |
| PDF/export | unchanged, Legacy |
| persistence | unchanged |
| payload / analytics | unchanged |
| assistant | unchanged |
| tests | unchanged |

## 15. Risks

| Risk | Level | Mitigation |
| --- | --- | --- |
| global root replacement changes coaching and PDF together | high | root retention guard |
| denominator-only parity hides numerator differences | medium-high | require consumer-specific parity evidence |
| coaching branch changes selected message | medium-high | next LOT should test ON/OFF and branch interaction |
| PDF exported percentage changes silently | high | keep PDF after dedicated export evidence |
| helper created too early becomes a second root | medium | no helper created in LOT 5.76 |
| Shadow baseline drift | medium | no runtime changes, preserve `fiscalSummaryVisibleSlice = 13` |

## 16. Recommended Next LOT

Recommended next LOT:

```txt
GO POUR LOT 5.77 - SAVINGSGOAL COACHING PARITY EVIDENCE
```

Reason:

```txt
The Objectif UI consumers are already migrated and stabilized.
The remaining smallest non-export boundary is coaching.
Coaching has a known local condition and a local rollback path if it is ever migrated consumer-by-consumer.
PDF/export should wait because it is an exported artifact contract.
The global savingsGoal root must remain Legacy.
```

Expected LOT 5.77 scope:

| Area | Expected action |
| --- | --- |
| runtime | no change |
| coaching | parity evidence only |
| PDF/export | no change |
| root `savingsGoal` | no change |
| helper | only if directly justified by evidence fixtures |
| tests | allowed if they assert coaching condition parity without runtime migration |

## 17. Final Decision

GO POUR LOT 5.77 - SAVINGSGOAL COACHING PARITY EVIDENCE
