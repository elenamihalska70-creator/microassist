# LOT 5.43 - Weekly Rate Mismatch Investigation Report

## 1. Executive Summary

LOT 5.43 investigated the three strict mismatches surfaced by LOT 5.42 for the selected consumer:

```txt
Dashboard weekly recap - estimated rate source for weekly estimated charges
```

No migration was implemented. No runtime code, existing test, formula, rate table, fallback, mapping, payload, persistence, assistant, export, Adapter, Facade, Domain or Rules file was modified.

Conclusion:

- `computed.rate = 0` is not a rate parity failure. It is a contract difference between the weekly Legacy UI fallback and the raw Shadow/domain effective rate.
- unknown activity is a contract difference: Legacy UI fallback masks it as `0.22`, while Rules/Shadow explicitly preserve unknown activity as zero-rate with warnings/fallback metadata.
- missing activity is a reachable incomplete-profile state in the dashboard; Legacy weekly recap currently still falls back to `0.22`.

The weekly rate contract is clarifiable without changing business rules: a future weekly recap migration must preserve the existing weekly fallback semantics explicitly, instead of replacing the source with the raw Shadow field alone.

## 2. Scope

In scope:

- `computed?.rate`
- `getEstimatedRate(dashboardAnswers.activity_type)`
- `fiscalSummaryVisibleSlice.effectiveRate`
- weekly recap rate source
- contribution rate rules
- unknown/missing activity behavior
- ACRE influence assessment
- reachability and business impact classification

Out of scope:

- changing `src/App.jsx`
- replacing `||` with `??`
- changing `getEstimatedRate`
- changing `effectiveRate`
- changing Rules Engine fallbacks
- adding mappings
- adding normalization
- migrating the weekly recap consumer
- modifying existing tests

No LOT 5.43 characterization test was created because LOT 5.42 plus source/rule inspection already provide the needed evidence.

## 3. Legacy Rate Contract

Weekly recap Legacy source:

```jsx
computed?.rate || getEstimatedRate(dashboardAnswers.activity_type)
```

Legacy semantics:

- truthy `computed.rate` wins;
- `0` falls through;
- `null` falls through;
- `undefined` falls through;
- unknown/missing activity is handled by `getEstimatedRate`;
- `getEstimatedRate` normalizes missing activity to `services`;
- default fallback is `0.22`.

Legacy `getEstimatedRate` mapping:

```txt
services/service -> 0.22
commerce/vente/sale/sales -> 0.123
mixte/mix/mixed -> 0.18
unknown -> 0.22
missing -> 0.22
```

This is a UI helper fallback contract, not the Rules Engine contract.

## 4. Shadow Rate Contract

Visible slice source:

```jsx
effectiveRate: usesShadow
  ? shadowResult.summary.effectiveRate
  : computed?.rate
```

Domain / Rules behavior:

- known activities use the contribution table;
- unknown activity resolves to rate `0`;
- missing activity produces warning/fallback behavior and rate `0`;
- zero is preserved as a valid numeric output of the domain fallback path;
- the selector does not apply `getEstimatedRate`.

Rules Engine evidence:

- `getContributionRule({ activityType: "unknown" }).value === 0`
- `getContributionRule({ activityType: null }).value === 0`
- fallback marker: `unknown_activity_rate_zero`
- `calculateStandardContribution` emits `MISSING_ACTIVITY_TYPE` and/or `UNKNOWN_ACTIVITY_TYPE` warnings for those paths.

## 5. computed.rate = 0 Investigation

Observed mismatch:

```txt
Legacy: computed?.rate || getEstimatedRate("services") -> 0.22
Shadow: fiscalSummaryVisibleSlice.effectiveRate -> 0
```

Why it happens:

- `0` is falsy in JavaScript.
- The Legacy weekly expression intentionally or historically uses `||`.
- Therefore `0` is treated like absence of rate and replaced by the activity fallback.

Can `0` happen?

- Yes, theoretically and through domain/Rules unknown activity paths.
- In ordinary valid profile states (`services`, `commerce`, `mixte`), `computed.rate` is positive.
- For incomplete profile states, `computed.rate` is usually `null`, not `0`.
- For a non-empty but unsupported `activity_type`, `computeObligations` can return rate `0`.

Classification:

```txt
C. SHADOW CONTRACT DIFFERENCE
```

Secondary classification:

```txt
B. INTENTIONAL LEGACY FALLBACK
```

Reason: Shadow/domain preserves zero-rate fallback; weekly Legacy helper masks zero with a UI fallback. This is not an ACRE issue and not a rounding issue.

## 6. Unknown Activity Investigation

Observed mismatch:

```txt
Legacy: getEstimatedRate("unknown") -> 0.22
Shadow / Rules: unknown activity -> 0
```

Legacy behavior:

- `normalizeActivityType("unknown")` returns `"unknown"`.
- `getEstimatedRate("unknown")` falls through to default `0.22`.

Rules / Shadow behavior:

- `getContributionRule({ activityType: "unknown" })` returns rate `0`.
- fallback is explicitly marked `unknown_activity_rate_zero`.
- `calculateStandardContribution` treats the contribution as not calculable and exposes warnings.

Reachability:

- normal UI selects known activity values;
- sanitized unknown strings are not converted to `services`;
- persisted, imported, manually edited or legacy corrupted state can theoretically carry an unknown non-empty value;
- `hasProfileCore` only requires a truthy activity value and declaration frequency, so an unknown non-empty value can pass the core gate.

Classification:

```txt
C. SHADOW CONTRACT DIFFERENCE
```

Secondary classification:

```txt
D. INPUT CONTRACT VIOLATION
```

Reason: unknown activity is outside the valid domain activity set, but the Legacy weekly UI helper historically masks it as services.

## 7. Missing Activity Investigation

Observed mismatch:

```txt
Legacy: getEstimatedRate(undefined) -> 0.22
Shadow/domain raw rate: absent activity -> 0 or null depending path
```

Legacy behavior:

- `normalizeActivityType(undefined)` returns `"services"`.
- `getEstimatedRate(undefined)` returns `0.22`.

App behavior:

- when `hasProfileCore` is false, `computed.rate` is `null`;
- Shadow runtime block does not execute unless `hasProfileCore` is true;
- visible slice effectiveRate falls back to `computed?.rate`, therefore `null` in incomplete profile mode;
- weekly recap can still render if weekly revenue, invoices or reminders provide useful weekly data.

Reachability:

- reachable in incomplete-profile dashboard states;
- especially plausible for a user who has revenues/invoices/reminders but has not completed activity/frequency;
- not blocked by weekly recap itself.

Classification:

```txt
B. INTENTIONAL LEGACY FALLBACK
```

Secondary classification:

```txt
E. UNSUPPORTED STATE
```

Reason: incomplete profile is supported by the dashboard, but reliable fiscal rate computation is not available. Legacy weekly recap currently chooses a default display fallback.

## 8. Reachability Matrix

| Scenario | Reachable | Legacy | Shadow | Risk | Classification |
| --- | --- | --- | --- | --- | --- |
| `computed.rate = 0` | theoretically reachable; legacy/corrupt/unknown activity path | falls back to `0.22` for services/missing-like fallback | preserves `0` | medium: visible weekly charges can change from nonzero to zero | C. SHADOW CONTRACT DIFFERENCE / B. INTENTIONAL LEGACY FALLBACK |
| unknown activity | theoretically reachable; normal UI mostly blocks, persisted bad state can pass `hasProfileCore` | default `0.22` | explicit zero-rate fallback with warnings | medium: masks invalid activity today | C. SHADOW CONTRACT DIFFERENCE / D. INPUT CONTRACT VIOLATION |
| missing activity | reachable in incomplete profile dashboard states | default `0.22` | `null` via visible slice fallback or zero in domain raw path | medium: weekly recap may show charges despite incomplete profile | B. INTENTIONAL LEGACY FALLBACK / E. UNSUPPORTED STATE |

## 9. Business Impact

If migrated naively to raw:

```jsx
fiscalSummaryVisibleSlice.effectiveRate
```

the weekly recap could change:

- weekly estimated charges from `220 €` to `0 €` for `1000 €` weekly revenue in zero-rate mismatch cases;
- visible dashboard interpretation from "estimated charges exist" to "0 charge";
- helper text remains the same, creating possible trust confusion.

No direct impact found on:

- coaching;
- reminders;
- invoices;
- PDF/export;
- persistence;
- payloads;
- assistant.

The mismatch is visible only in the weekly recap charge amount if the consumer is migrated without preserving the Legacy fallback.

## 10. Rules Engine Assessment

Rules Engine already documents and guards:

- known activity rates: `services = 0.22`, `commerce = 0.123`, `mixte = 0.18`;
- unknown activity fallback: `unknown_activity_rate_zero`;
- null/incomplete historical data tolerance;
- simple assistant has a separate fallback contract and is not equivalent to weekly recap.

Important distinction:

- Rules/Shadow unknown activity fallback is zero-rate;
- weekly Legacy UI `getEstimatedRate` fallback is services-like `0.22`.

This is a real contract split, not a missing assertion.

## 11. ACRE Assessment

ACRE does not cause the three mismatches.

LOT 5.42 showed:

- ACRE inactive: `0.22` vs `0.22`, MATCH;
- ACRE active: `0.11` vs `0.11`, MATCH.

ACRE can validly reduce a known activity rate, but the mismatch cases are driven by fallback semantics for zero/unknown/missing rate source.

## 12. Input Contract

Current inferred weekly recap input contract:

- `computed.rate` is optional;
- `dashboardAnswers.activity_type` is optional from the weekly recap's point of view;
- valid activity values are `services`, `commerce`, `mixte` plus UI aliases before normalization;
- unknown non-empty activity is invalid for domain calculation but can exist in historical/persisted state;
- `0` is a valid domain fallback value but treated as absent by the Legacy weekly UI expression;
- weekly recap may render when useful weekly data exists, even if fiscal profile is incomplete.

Clear future contract, without changing business rules:

```txt
weekly recap rate source = selected fiscal rate if truthy, otherwise existing getEstimatedRate fallback
```

For any future Shadow migration, the candidate should therefore be assessed as:

```jsx
fiscalSummaryVisibleSlice.effectiveRate || getEstimatedRate(dashboardAnswers.activity_type)
```

not as raw:

```jsx
fiscalSummaryVisibleSlice.effectiveRate
```

This preserves the existing weekly UI fallback while allowing the selected rate source to come through the visible slice.

## 13. Risk Classification

| Mismatch | Risk | Why |
| --- | --- | --- |
| `computed.rate = 0` | MEDIUM | naive raw Shadow migration changes visible weekly charges |
| unknown activity | MEDIUM | invalid state can be masked by Legacy but exposed by Shadow/domain |
| missing activity | MEDIUM | incomplete-profile dashboard can still render weekly recap |

Overall migration readiness:

```txt
NOT READY for raw effectiveRate migration
```

Contract hardening readiness:

```txt
READY
```

## 14. Migration Feasibility

Naive migration:

```jsx
computed?.rate || getEstimatedRate(...)
-> fiscalSummaryVisibleSlice.effectiveRate
```

is not safe.

Contract-preserving migration candidate:

```jsx
computed?.rate || getEstimatedRate(dashboardAnswers.activity_type)
-> fiscalSummaryVisibleSlice.effectiveRate || getEstimatedRate(dashboardAnswers.activity_type)
```

appears feasible, but must first be specified and guarded as the approved weekly rate contract.

This would preserve:

- `0` fallback behavior;
- missing activity fallback behavior;
- unknown activity fallback behavior;
- weekly formula;
- labels;
- invoices;
- reminders;
- persistence;
- payloads;
- assistant;
- export.

No runtime change is authorized in LOT 5.43.

## 15. Recommended Next LOT

Recommended next lot:

```txt
LOT 5.44 - Weekly Rate Contract Hardening
```

Purpose:

- document the future approved weekly recap rate source contract;
- prove that `fiscalSummaryVisibleSlice.effectiveRate || getEstimatedRate(dashboardAnswers.activity_type)` preserves Legacy weekly fallback behavior;
- keep the consumer unmigrated until a later migration gate review;
- avoid changing Rules Engine or business formulas.

## 16. Final Decision

GO POUR LOT 5.44 — WEEKLY RATE CONTRACT HARDENING
