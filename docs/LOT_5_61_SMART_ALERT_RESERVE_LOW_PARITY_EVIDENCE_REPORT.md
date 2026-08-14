# LOT 5.61 - Smart Alert Reserve-Low Parity Evidence Report

## 1. Executive Summary

LOT 5.61 produced targeted parity evidence for the selected consumer:

```txt
Smart alerts - estimated charges input for reserve-low alert
```

No migration was implemented. `src/App.jsx` was not modified. No alert formula, threshold, priority, severity, text, persistence path, payload, export, assistant, coaching, invoice or reminder behavior was changed.

Result:

```txt
Input parity sufficient for the reserve-low charges input.
```

Recommended next lot:

```txt
LOT 5.62 - Smart Alert Reserve-Low Migration Gate Review
```

## 2. Consumer Scope

Only the charges input passed to the reserve-low smart alert was studied.

Current call site:

```jsx
buildSmartAlerts({
  answers: dashboardAnswers,
  computed,
  revenues,
  invoices: visibleInvoices,
  reminderPrefs,
  estimatedCharges,
  currentMonthTotal,
})
```

In scope:

- `estimatedCharges` as reserve-low charges input;
- `fiscalSummaryVisibleSlice.finalContributionAmount` as Shadow candidate;
- strict input equality;
- reserve-low ON/OFF boundary sensitivity.

Out of scope:

- other smart alerts;
- TVA alert migration;
- ACRE alert migration;
- alert text, severity, priority and CTA;
- `currentMonthTotal`;
- `availableAmount`;
- `savingsGoal`;
- coaching;
- PDF/export;
- assistant;
- persistence;
- payloads;
- invoices and reminders.

## 3. Legacy Input Contract

Legacy input:

```jsx
estimatedCharges
```

Dashboard source:

```jsx
const estimatedCharges = useMemo(() => {
  if (computed?.rate) {
    return Math.round(currentMonthTotal * computed.rate);
  }
  return 0;
}, [currentMonthTotal, computed?.rate]);
```

Reserve-low usage:

```jsx
const rawAvailable = Number(currentMonthTotal || 0) - Number(estimatedCharges || 0);
```

```jsx
if (estimatedCharges > 0 && rawAvailable < estimatedCharges) {
  return [{ id: "reserve-low", ... }];
}
```

Characterization:

- used directly in the `estimatedCharges > 0` gate;
- combined with `currentMonthTotal` to compute `rawAvailable`;
- compared strictly against `rawAvailable`;
- no ratio is calculated;
- no extra rounding is applied inside `buildSmartAlerts`;
- fallback is the function default `estimatedCharges = 0`;
- current dashboard rounding remains the pre-existing `Math.round(currentMonthTotal * computed.rate)`.

## 4. Shadow Input Contract

Shadow candidate:

```jsx
fiscalSummaryVisibleSlice.finalContributionAmount
```

Visible-slice selector:

```jsx
finalContributionAmount: usesShadow
  ? shadowResult.summary.finalContributionAmount
  : estimatedCharges
```

Contract:

- source is `shadowResult.summary.finalContributionAmount` when the existing visible replacement flag is ON and a Shadow Result exists;
- fallback is Legacy `estimatedCharges` when the flag is OFF or no Shadow Result exists;
- unit is euros as a numeric amount;
- period follows the same fiscal summary input period used by the existing Shadow pipeline;
- rounding is performed by the existing calculation pipeline, not by the smart alert;
- ACRE behavior is included in `summary.finalContributionAmount`;
- zero remains `0`;
- null/undefined were not introduced by this lot;
- warnings remain inside the Shadow Result and are not consumed by the smart alert.

## 5. Reachability

Reserve-low can be evaluated whenever `buildSmartAlerts(...)` runs and neither higher-priority TVA nor ACRE-ending branches return first.

| State | Reachability | Notes |
| --- | --- | --- |
| revenue = 0 | reachable in production | evaluated but charges input is `0`, alert OFF |
| revenue positive | reachable in production | normal dashboard path |
| multiple revenues | reachable in production | normal dashboard path |
| service | reachable in production | supported activity |
| commerce | reachable in production | supported activity |
| mixte | reachable in production | supported activity |
| ACRE inactive | reachable in production | supported profile state |
| ACRE active | reachable in production | supported profile state |
| incomplete profile | incomplete profile | may produce zero or non-actionable charge input |
| unknown activity | unknown | not selected for migration readiness in this lot |
| forced mismatch | test-only edge | evidence-integrity control |

## 6. Scenario Matrix

| Scenario | Legacy input | Shadow candidate | Result | Reachability |
| --- | ---: | ---: | --- | --- |
| revenue = 0 | 0 | 0 | MATCH | reachable |
| revenue positif | 220 | 220 | MATCH | reachable |
| plusieurs revenus | 292 | 292 | MATCH | reachable |
| service | 220 | 220 | MATCH | reachable |
| commerce | 123 | 123 | MATCH | reachable |
| mixte | 180 | 180 | MATCH | reachable |
| ACRE inactive | 220 | 220 | MATCH | reachable |
| ACRE active | 110 | 110 | MATCH | reachable |
| contribution amount = 0 | 0 | 0 | MATCH | reachable |
| montant decimal | 272 | 272 | MATCH | reachable |
| faible contribution | 6 | 6 | MATCH | reachable |
| contribution elevee | 5500 | 5500 | MATCH | reachable |
| ajout revenu - before | 220 | 220 | MATCH | reachable |
| ajout revenu - after | 330 | 330 | MATCH | reachable |
| suppression revenu - before | 330 | 330 | MATCH | reachable |
| suppression revenu - after | 220 | 220 | MATCH | reachable |
| suppression dernier revenu - before | 110 | 110 | MATCH | reachable |
| suppression dernier revenu - after | 0 | 0 | MATCH | reachable |
| same input twice | stable | stable | MATCH | test evidence |
| cloned input | stable | stable | MATCH | test evidence |

All comparisons use strict `Object.is` semantics through the test evidence. No epsilon, tolerance, normalization or extra rounding was added.

## 7. ACRE Assessment

ACRE inactive:

```txt
Legacy estimatedCharges = 220
Shadow finalContributionAmount = 220
Result = MATCH
```

ACRE active:

```txt
Legacy estimatedCharges = 110
Shadow finalContributionAmount = 110
Result = MATCH
```

No ACRE-specific mismatch was found in the targeted reserve-low input evidence.

## 8. Threshold Boundary Analysis

The reserve-low condition is:

```txt
estimatedCharges > 0 && (currentMonthTotal - estimatedCharges) < estimatedCharges
```

Equivalent boundary:

```txt
currentMonthTotal < 2 * estimatedCharges
```

Tested with `chargesInput = 100`:

| currentMonthTotal | rawAvailable | State |
| ---: | ---: | --- |
| 199 | 99 | ALERT_ON |
| 200 | 100 | ALERT_OFF |
| 201 | 101 | ALERT_OFF |

No threshold was changed. No tolerance was introduced.

## 9. MATCH Results

MATCH was proven for:

- zero revenue;
- positive revenue;
- multiple revenues;
- service;
- commerce;
- mixte;
- ACRE inactive;
- ACRE active;
- zero contribution;
- decimal amount;
- low contribution;
- high contribution;
- revenue addition;
- revenue removal;
- last revenue removal;
- same input;
- cloned input.

For all real covered scenarios, using the Shadow candidate as the charges input would preserve the reserve-low ON/OFF result.

## 10. MISMATCH Results

An intentional mismatch was created:

```txt
Legacy input = 100
Shadow candidate = 101
Status = MISMATCH
```

The mismatch remained visible. It was not corrected, normalized, rounded, tolerated or hidden.

Boundary impact for the intentional mismatch:

```txt
currentMonthTotal = 201
Legacy input 100 -> ALERT_OFF
Shadow input 101 -> ALERT_ON
```

This proves that a real input mismatch could change alert ON/OFF behavior. No real mismatch was found in the covered scenarios.

## 11. Alert Behavior Impact

Observed impact:

- real MATCH scenarios: no reserve-low ON/OFF change;
- intentional mismatch scenario: can change ON/OFF near the boundary;
- severity, message and priority were not modified or recomputed.

Classification:

```txt
Input parity sufficient; boundary sensitivity requires a migration gate before implementation.
```

## 12. Feature Flag

No flag was created or modified.

Confirmed conceptually:

```txt
Flag ON + Shadow Result -> finalContributionAmount comes from Shadow summary
Flag OFF or missing Shadow Result -> finalContributionAmount falls back to estimatedCharges
```

The future migration, if approved, should reuse the existing visible slice and must not introduce new flag persistence.

## 13. Determinism

Confirmed:

- pure evidence helpers;
- same input gives the same result;
- cloned input gives the same result;
- no `Date.now()`;
- no implicit `new Date()`;
- no `Math.random()`;
- no network;
- no Supabase;
- no localStorage;
- no sessionStorage.

The Shadow calculation receives explicit `referenceDate = "2026-07-20"`.

## 14. Mutation Safety

Confirmed:

- scenario fixture not mutated;
- revenues fixture not mutated;
- Shadow input not mutated;
- Shadow result not mutated.

The test uses frozen fixtures for mutation safety.

## 15. No Propagation

Confirmed no LOT 5.61 propagation to:

- smart alert runtime;
- alert state;
- payload;
- persistence;
- assistant;
- feedback;
- analytics;
- export;
- PDF;
- coaching;
- invoices;
- reminders.

The existing `reminderPrefs` argument remains present in the smart-alert call site and was not changed.

## 16. Targeted Tests

Initial sandbox run:

```txt
node --test tests/lot-5-61-smart-alert-reserve-low-parity-evidence.test.js
```

Result:

```txt
FAIL - spawn EPERM
```

Rerun outside sandbox with approved targeted prefix:

```txt
tests 12
pass 12
fail 0
```

Required targeted regressions:

```txt
node --test tests/lot-5-59-monthly-reflection-charges-stabilization.test.js
tests 10 / pass 10 / fail 0
```

```txt
node --test tests/lot-5-58-monthly-reflection-charges-migration-validation.test.js
tests 11 / pass 11 / fail 0
```

```txt
node --test tests/shadow-parity-validation.test.js
tests 6 / pass 6 / fail 0
```

```txt
node --test tests/runtime-parity-evidence.test.js
tests 11 / pass 11 / fail 0
```

Targeted ESLint:

```txt
npx eslint tests/lot-5-61-smart-alert-reserve-low-parity-evidence.test.js
PASS - no output
```

Not run by scope:

- full `node --test`;
- `npm run build`;
- global `npm run lint`;
- Playwright;
- application.

## 17. Risks

Residual risks:

- reserve-low is behavior, not a display-only consumer;
- a real mismatch near the threshold can change alert ON/OFF;
- TVA and ACRE-ending smart alerts have priority and can mask reserve-low;
- future implementation would add a twelfth `fiscalSummaryVisibleSlice` occurrence and requires guard stabilization.

No runtime rollback is needed because LOT 5.61 made no runtime change.

## 18. Recommended Next LOT

Recommended next lot:

```txt
LOT 5.62 - Smart Alert Reserve-Low Migration Gate Review
```

Purpose:

- decide whether the input parity evidence is sufficient to authorize a later migration lot;
- re-check rollout, rollback and priority masking before implementation;
- keep migration separate from the evidence lot.

## 19. Final Decision

Legacy remains retained.

Shadow remains passive.

No smart alert was migrated.

No runtime condition was changed.

No threshold was changed.

No severity, priority, message or CTA was changed.

No persistence, payload, assistant, export, PDF, coaching, invoice or reminder path was changed.

Input parity is sufficient for a migration gate review.

GO POUR LOT 5.62 - SMART ALERT RESERVE-LOW MIGRATION GATE REVIEW
