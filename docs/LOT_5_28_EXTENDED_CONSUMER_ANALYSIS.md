# LOT 5.28 - Extended Consumer Analysis

## 1. Executive Summary

LOT 5.28 is documentary extended analysis only.

No migration was implemented. No application file, test, runtime calculation, Adapter, Facade, Domain, Rules Engine, persistence path, payload, export or assistant path was modified.

Analyzed candidate:

```text
savingsGoal
```

Current Legacy source:

```text
estimatedCharges
```

Candidate Shadow source:

```text
fiscalSummaryVisibleSlice.finalContributionAmount
```

Conclusion: `summary.finalContributionAmount` is plausibly comparable to `estimatedCharges` for the monthly contribution amount, but `savingsGoal` currently mixes multiple responsibilities. It feeds pure UI, fiscal coaching and PDF export percentage output. A global migration is therefore not isolated enough.

Decision: GO POUR LOT 5.29 — SAVINGSGOAL ARCHITECTURE HARDENING.

## 2. Scope and Authority

Authority documents read:

- `docs/LOT_5_18_LEGACY_RETENTION_HARDENING_REPORT.md`
- `docs/LOT_5_27_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md`
- `docs/LOT_5_26_NEXT_CONSUMER_STABILIZATION_REPORT.md`

Inspected:

- `src/App.jsx`
- all `savingsGoal` occurrences
- all `estimatedCharges` occurrences
- `fiscalSummaryVisibleSlice.finalContributionAmount`
- fiscal coaching
- PDF export
- percentages derived from `savingsGoal`
- assistant-adjacent state
- payload builders
- persistence paths
- dashboard consumers
- summary consumers
- tests and evidence around `estimatedCharges` and `summary.finalContributionAmount`

## 3. Current savingsGoal Definition

Location:

```text
src/App.jsx
const savingsGoal = useMemo(() => {
  // Objectif d'épargne recommandé: 3 mois de charges
  return Math.max(estimatedCharges * 3, 500);
}, [estimatedCharges]);
```

Formula:

```text
Math.max(estimatedCharges * 3, 500)
```

Dependencies:

- `estimatedCharges`

Type:

- number

Unit:

- euros

Rounding:

- no direct rounding in `savingsGoal`;
- inherits any rounding already present in `estimatedCharges`;
- downstream percentages apply `Math.round(...)`.

Fallback:

- floor of `500`;
- if `estimatedCharges` is `0`, the result is `500`.

Recalculation:

- React `useMemo`;
- recalculates when `estimatedCharges` changes.

Business role:

- recommended savings reserve equal to three months of estimated charges, with a minimum reserve of `500`.

## 4. estimatedCharges Analysis

Location:

```text
src/App.jsx
const estimatedCharges = useMemo(() => {
  if (computed?.rate) {
    return Math.round(currentMonthTotal * computed.rate);
  }
  return 0;
}, [currentMonthTotal, computed?.rate]);
```

Formula:

```text
Math.round(currentMonthTotal * computed.rate)
```

Applied rules:

- uses Legacy `currentMonthTotal`;
- uses Legacy `computed?.rate`;
- rounds to the nearest euro with `Math.round`;
- returns `0` when `computed?.rate` is falsy.

Consumers:

- `availableAmount`;
- `fiscalSummaryVisibleSlice` fallback for `finalContributionAmount`;
- `smartAlerts`;
- fiscal score / dashboard context blocks;
- `savingsGoal`;
- `dashboardMonthlyReflection`;
- PDF export callback dependency list;
- cash-impact modal adjusted available amount.

Status:

- Legacy pure calculation;
- retained by LOT 5.18 for rollback, dashboard compatibility, export compatibility and non-migrated consumers;
- partially replaced only where `fiscalSummaryVisibleSlice.finalContributionAmount` is already used for approved visible display.

## 5. finalContributionAmount Analysis

Runtime selector:

```text
finalContributionAmount: usesShadow
  ? shadowResult.summary.finalContributionAmount
  : estimatedCharges
```

Facade source:

```text
summary.finalContributionAmount = acreContribution.acreContributionAmount
```

Unit:

- euros

Rounding:

- produced by the contribution / ACRE domain path;
- parity evidence compares it to Legacy `estimatedAmount`.

Period:

- same fiscal summary period as the Shadow input;
- in the current app integration, the input is built from current dashboard revenue/profile state.

ACRE:

- includes the ACRE-adjusted final contribution amount through the Facade result.

Parity:

- `runtimeParityEvidence.js` compares `legacySnapshot.estimatedAmount` to `shadowResult.summary.finalContributionAmount`;
- `runtime-parity-evidence.test.js` validates MATCH for `summary.finalContributionAmount`;
- `lot-5-11-additional-parity-evidence.test.js` validates intentional MISMATCH remains observable.

Comparable to `estimatedCharges`:

- plausible and already approved as visible `dashboardChargesDisplay` source for real revenue;
- not sufficient by itself to migrate `savingsGoal` globally because `savingsGoal` has downstream coaching and export responsibilities.

## 6. Semantic Comparison Matrix

| Aspect | estimatedCharges | finalContributionAmount | Equivalent ? |
| --- | --- | --- | --- |
| period | current app monthly total via `currentMonthTotal` | Shadow summary period from current app input | PARTIAL |
| base | `currentMonthTotal` | Facade revenue base / `summary.baseAmount` | EQUIVALENT |
| activity type | through `computed?.rate` | through Facade contribution and ACRE domains | EQUIVALENT |
| ACRE | through Legacy `computed?.rate` | through ACRE-adjusted final contribution amount | EQUIVALENT |
| taux | Legacy `computed?.rate` | `summary.effectiveRate` / ACRE contribution path | EQUIVALENT |
| arrondi | `Math.round(...)` in App | domain-calculated euro amount | PARTIAL |
| zéro | returns `0` when no truthy rate or zero base | Shadow may return `0` and selector preserves falsy values | EQUIVALENT |
| absence de revenu | usually `0`, then `savingsGoal` floor becomes `500` | Shadow `finalContributionAmount` can be `0` | EQUIVALENT |
| fallback | direct `0` fallback if no rate | selector falls back globally to `estimatedCharges` when flag OFF or Shadow absent | DIFFERENT |
| profil incomplet | `computed` may return profile-completion outputs / rate unavailable | Shadow depends on valid adapter/facade input availability | PARTIAL |
| statut fiscal | broad Legacy `computed` object | structured Facade result | PARTIAL |
| warning | no warning attached to `estimatedCharges` itself | Facade result can carry warnings outside the selector field | DIFFERENT |
| trace | none | Facade can produce trace, but app call uses `{ trace: false }` | DIFFERENT |

Conclusion: equivalent enough for amount parity investigation, not enough for immediate global `savingsGoal` migration.

## 7. Consumer Graph

```text
savingsGoal
  ├── UI
  │   ├── progress indicators percentage text
  │   └── progress indicators fill width
  ├── coaching fiscal
  │   └── fiscalCoachingCard low-reserve threshold
  ├── PDF export
  │   └── "Objectif d epargne" percentage in PDF analysis section
  ├── assistant
  │   └── no direct savingsGoal read found
  ├── analytics / payload
  │   └── no direct savingsGoal read found
  ├── persistence
  │   └── no direct savingsGoal read found
  └── other
      └── handleExportPDF dependency list captures savingsGoal
```

| Branch | Consumer exact | Visible | Source actuelle | Impact if savingsGoal changes | Rollback | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| UI | progress percentage text | yes | `Math.round((savingsProgress / savingsGoal) * 100)` | visible percentage may change | local if isolated | MEDIUM |
| UI | progress fill width | yes | `Math.min(100, Math.round((savingsProgress / savingsGoal) * 100))` | visible bar width may change | local if isolated | MEDIUM |
| coaching | low-reserve card | yes, when selected | `savingsProgress < savingsGoal * 0.35` | coaching message may appear/disappear | not isolated if global | HIGH |
| PDF export | objective percentage | exported | `Math.round((savingsProgress / savingsGoal) * 100 || 0)` | exported report value may change | not isolated if global | HIGH |
| assistant | none direct | no | none | no direct impact found | n/a | LOW |
| analytics / payload | none direct | no | none | no direct impact found | n/a | LOW |
| persistence | none direct | no | none | no direct impact found | n/a | LOW |

## 8. UI Consumers

Purely visual consumers found:

- progress indicator percentage text;
- progress indicator progress bar fill width.

Both use `savingsGoal` only as denominator with `savingsProgress`.

They are visible and local to the progress indicators block, but they are not isolated from the global variable because the same `savingsGoal` also feeds fiscal coaching and PDF export.

Isolability:

- a future isolated UI migration is possible only if a separate UI-only read or derived variable is introduced;
- changing global `savingsGoal` is not an isolated UI migration.

## 9. Fiscal Coaching

Location:

```text
fiscalCoachingCard
```

Relevant logic:

```text
!smartAlertIds.has("reserve-low") &&
savingsGoal > 0 &&
savingsProgress < savingsGoal * 0.35
```

Behavior:

- compares available reserve progress against 35 percent of `savingsGoal`;
- if true, returns the low-reserve coaching text.

Classification:

```text
BLOCKED
```

Reason:

- this is not pure display;
- it is a behavioral threshold that can change which coaching card appears;
- it competes with other coaching branches ordered before and after it;
- migration requires explicit coaching contract evidence.

## 10. PDF Export

Location:

```text
handleExportPDF
```

PDF section:

```text
Objectif d epargne : ${
  typeof savingsGoal !== "undefined" && savingsGoal > 0
    ? `${Math.round((savingsProgress / savingsGoal) * 100 || 0)}%`
    : "Pas encore assez de données"
}
```

Classification:

- consumer derived;
- exported-output consumer;
- business-facing report value;
- dependent on an additional percentage calculation.

The PDF does not export the raw `savingsGoal` amount. It exports a percentage derived from:

- numerator: `savingsProgress`;
- denominator: `savingsGoal`.

No export should be modified before an export contract review or explicit isolation from the global `savingsGoal`.

## 11. PDF Percentage Detail

Formula:

```text
Math.round((savingsProgress / savingsGoal) * 100 || 0)
```

Numerator:

```text
savingsProgress
```

Numerator source:

```text
availableAmount
```

Denominator:

```text
savingsGoal
```

Denominator source:

```text
Math.max(estimatedCharges * 3, 500)
```

Rounding:

- `Math.round(...)`.

Fallback:

- if `savingsGoal` is undefined or not positive: `"Pas encore assez de données"`;
- inside the percentage expression, `|| 0` converts falsy `NaN` / `0` to `0`.

Display:

- exported text line in the PDF "Projection" box.

Risks:

- export value can change even if UI intent was the only migration target;
- `savingsProgress` still depends on `availableAmount`, which has no approved Shadow equivalent;
- export contracts are retained Legacy by LOT 5.18.

## 12. Persistence / Payload / Assistant

Direct `savingsGoal` usage:

- no Supabase read/write found;
- no localStorage read/write found;
- no analytics payload field found;
- no feedback context field found;
- no assistant output field found;
- yes, PDF export derived percentage.

`estimatedCharges` usage:

- no direct Supabase/localStorage payload field tied only to `estimatedCharges` was selected for migration;
- retained in smart alerts, available amount, monthly reflection, PDF export dependencies and other dashboard compatibility paths;
- export and assistant-adjacent summaries remain Legacy-retained per LOT 5.18.

Classification:

- persistence: not directly touched by `savingsGoal`;
- payload / analytics: not directly touched by `savingsGoal`;
- assistant: not directly touched by `savingsGoal`;
- export: directly affected through derived percentage.

## 13. Isolation Assessment

Question A: can only a UI display of `savingsGoal` be migrated without touching coaching, PDF, assistant or persistence?

Answer:

```text
Yes, but not by migrating global savingsGoal.
```

It would require a separate UI-only derived value or read, with explicit guards that:

- `savingsGoal` global remains Legacy;
- fiscal coaching remains Legacy;
- PDF export remains Legacy;
- `savingsProgress` remains Legacy;
- `availableAmount` remains Legacy.

Question B: is global `savingsGoal` too central for isolated migration?

Answer:

```text
Yes.
```

Global `savingsGoal` currently combines UI denominator, coaching threshold and PDF export denominator responsibilities.

## 14. Architectural Options

| Option | Description | Pros | Cons | Decision |
| --- | --- | --- | --- | --- |
| A | Migrate `savingsGoal` globally | simple expression swap | changes UI, coaching and PDF together | reject |
| B | Create a Shadow-backed read for one UI consumer, leaving global `savingsGoal` Legacy | isolates progress UI | requires naming and guard discipline | possible after hardening |
| C | Keep `savingsGoal` Legacy and migrate only a derived UI denominator | protects coaching/PDF | may introduce duplicate denominator concepts | possible after hardening |
| D | Block all migration until coaching/PDF migration gates | safest for contracts | delays small UI progress | too broad for next step |

Recommended option:

```text
Option B, but only after architecture hardening.
```

The hardening should separate responsibilities before any migration:

- Legacy `savingsGoal` for coaching and export;
- explicit UI-only savings goal denominator candidate;
- deterministic guards proving no export/coaching behavior changes.

## 15. Candidate for LOT 5.29

Chosen next step:

```text
LOT 5.29 — SAVINGSGOAL ARCHITECTURE HARDENING
```

Reason:

- equivalence between `estimatedCharges` and `finalContributionAmount` is plausible but not the main blocker;
- the main blocker is responsibility mixing;
- a direct migration would violate slice isolation by affecting UI, coaching and PDF export together;
- parity evidence alone would not solve the export/coaching coupling.

LOT 5.29 should not migrate yet unless explicitly authorized after hardening.

## 16. Required Future Evidence

Before any migration, future tests or analysis must prove:

- global `savingsGoal` source remains unchanged when hardening only;
- UI-only denominator, if introduced, has a single consumer;
- coaching still reads the Legacy savings threshold;
- PDF export still reads the Legacy savings threshold;
- `savingsProgress` and `availableAmount` are not migrated;
- no persistence, payload, assistant or export contract changes occur;
- `summary.finalContributionAmount` parity evidence remains intact;
- rollback is local and deterministic.

## 17. Scope Control

Confirmed for LOT 5.28:

- exactly one document created;
- no code modified;
- no test modified;
- `savingsGoal` unchanged;
- `estimatedCharges` unchanged;
- `finalContributionAmount` unchanged;
- coaching unchanged;
- PDF unchanged;
- assistant unchanged;
- persistence unchanged;
- no consumer migrated;
- no formula modified;
- no rate modified;
- no rounding modified.

## 18. Final Decision

GO POUR LOT 5.29 — SAVINGSGOAL ARCHITECTURE HARDENING
