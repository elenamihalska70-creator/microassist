# LOT 5.68 - Smart Alert rawAvailable Revenue Parity Evidence Report

## 1. Executive Summary

LOT 5.68 produced targeted parity evidence for:

```txt
Smart alerts - currentMonthTotal revenue input for reserve-low rawAvailable
```

No migration was implemented. `src/App.jsx` was not modified. No runtime formula, threshold, ON/OFF condition, alert priority, severity, message, persistence path, payload, export, assistant, coaching, invoice or reminder behavior was changed.

Result:

```txt
Revenue input parity, rawAvailable parity and reserve-low alert behavior parity are sufficient for a migration gate review.
```

## 2. Consumer Scope

Only this revenue input was studied:

```jsx
currentMonthTotal
```

as used by:

```jsx
const rawAvailable = Number(currentMonthTotal || 0) - Number(estimatedCharges || 0);
```

Out of scope:

- `smartAlertEstimatedCharges`
- threshold and comparison logic
- reserve-low severity, priority and message
- global `availableAmount`
- `savingsGoal`
- coaching
- PDF/export
- persistence
- payloads
- assistant
- other smart alerts

## 3. Legacy Revenue Input

Legacy revenue input:

```jsx
currentMonthTotal
```

Current smart-alert call:

```jsx
buildSmartAlerts({
  answers: dashboardAnswers,
  computed,
  revenues,
  invoices: visibleInvoices,
  reminderPrefs,
  estimatedCharges: smartAlertEstimatedCharges,
  currentMonthTotal,
})
```

Characterization:

- unit: euros as a numeric revenue total;
- period: current visible dashboard month;
- fallback: `currentMonthTotal = 0` function default, then `Number(currentMonthTotal || 0)` in `rawAvailable`;
- no extra rounding inside `buildSmartAlerts`;
- no `Math.max` / `Math.min` in the reserve-low `rawAvailable` formula;
- no `parseFloat`, `toFixed`, `toLocaleString`, tolerance or display formatting in the reserve-low formula.

## 4. Shadow Revenue Input

Candidate Shadow input:

```jsx
fiscalSummaryVisibleSlice.revenueTotal
```

Visible selector:

```jsx
revenueTotal: usesShadow
  ? shadowResult.revenue.total
  : currentMonthTotal
```

Characterization:

- source: `shadowResult.revenue.total` when the existing visible replacement flag is ON and Shadow Result exists;
- fallback: Legacy `currentMonthTotal` when the flag is OFF or Shadow Result is absent;
- unit: euros as a numeric revenue total;
- period: the same fiscal summary visible slice period;
- zero remains `0`;
- decimals are preserved by the revenue total path;
- no local fallback, flag or normalization was added in LOT 5.68.

## 5. rawAvailable Formula Characterization

Current formula:

```jsx
const rawAvailable = Number(currentMonthTotal || 0) - Number(estimatedCharges || 0);
```

Alert condition:

```jsx
if (estimatedCharges > 0 && rawAvailable < estimatedCharges)
```

Equivalent threshold:

```txt
currentMonthTotal < 2 * estimatedCharges
```

LOT 5.68 did not change this formula.

## 6. Scenario Matrix

| Scenario | Legacy revenue | Shadow revenue | Result |
| --- | ---: | ---: | --- |
| revenue = 0 | 0 | 0 | MATCH |
| positive revenue | 1000 | 1000 | MATCH |
| decimal revenue | 1249.75 | 1249.75 | MATCH |
| multiple revenues | 1325 | 1325 | MATCH |
| add revenue before | 1000 | 1000 | MATCH |
| add revenue after | 1500 | 1500 | MATCH |
| remove revenue before | 1500 | 1500 | MATCH |
| remove revenue after | 1000 | 1000 | MATCH |
| last revenue removal before | 1000 | 1000 | MATCH |
| last revenue removal after | 0 | 0 | MATCH |
| zero to positive before | 0 | 0 | MATCH |
| zero to positive after | 333 | 333 | MATCH |
| positive to zero before | 333 | 333 | MATCH |
| positive to zero after | 0 | 0 | MATCH |
| charges = 0 | 0 | 0 | MATCH |
| charges positive | 1000 | 1000 | MATCH |
| low reserve | 199 | 199 | MATCH |
| high reserve | 1000 | 1000 | MATCH |
| ACRE inactive | 1000 | 1000 | MATCH |
| ACRE active | 1000 | 1000 | MATCH |

All comparisons use strict `Object.is` semantics. No tolerance, rounding or corrective normalization was introduced.

## 7. Revenue Input Parity

Validated:

```txt
currentMonthTotal === fiscalSummaryVisibleSlice.revenueTotal
```

for all covered reachable scenarios.

No real revenue input mismatch was found.

## 8. rawAvailable Parity

For every covered scenario, the test computed:

```txt
Legacy rawAvailable = Number(currentMonthTotal || 0) - Number(chargesInput || 0)
Shadow rawAvailable = Number(fiscalSummaryVisibleSlice.revenueTotal || 0) - Number(chargesInput || 0)
```

All non-revenue inputs were held identical.

Result:

```txt
rawAvailable MATCH for all covered reachable scenarios.
```

## 9. Threshold Boundary Analysis

Validated with `chargesInput = 100`:

| Revenue input | rawAvailable | Expected state | Result |
| ---: | ---: | --- | --- |
| 199 | 99 | ALERT_ON | MATCH |
| 200 | 100 | ALERT_OFF | MATCH |
| 201 | 101 | ALERT_OFF | MATCH |

No tolerance was used. The exact boundary remains:

```txt
revenue < 2 * chargesInput => ALERT_ON
revenue >= 2 * chargesInput => ALERT_OFF
```

## 10. Alert ON/OFF Parity

Validated:

- ALERT ON parity below threshold;
- ALERT OFF parity at threshold;
- ALERT OFF parity above threshold;
- same reserve-low `id`;
- same severity `warning`;
- same title;
- same message;
- same CTA;
- same action.

No alert behavior divergence was found for matched revenue inputs.

## 11. ACRE Assessment

ACRE inactive:

```txt
Legacy revenue = 1000
Shadow revenue = 1000
Result = MATCH
```

ACRE active:

```txt
Legacy revenue = 1000
Shadow revenue = 1000
Result = MATCH
```

The ACRE-ending branch remains a higher-priority smart alert and was not migrated or modified.

## 12. Intentional Mismatch

Test-only mismatch:

```txt
Legacy revenue = 200
Shadow revenue = 199
chargesInput = 100
```

Detected:

- revenue input mismatch;
- rawAvailable mismatch;
- ON/OFF divergence.

Observed behavior:

```txt
Legacy state = ALERT_OFF
Shadow state = ALERT_ON
```

This confirms mismatch visibility. No automatic correction, tolerance, rounding or hidden normalization masks the divergence.

## 13. Feature Flag

Existing visible selector behavior:

```txt
Flag ON + Shadow Result => revenueTotal from shadowResult.revenue.total
Flag OFF => revenueTotal from currentMonthTotal
Missing Shadow Result => revenueTotal from currentMonthTotal
```

LOT 5.68 did not create or modify any flag.

## 14. Determinism

Validated:

- same input produces the same output;
- cloned input produces the same output;
- all covered comparisons are pure helper calculations;
- no `Date.now()`;
- no implicit `new Date()`;
- no `Math.random()`;
- no network access.

## 15. Mutation Safety

Validated with frozen input fixtures:

```txt
No scenario mutation detected.
```

The evidence helpers do not mutate revenue arrays, scenario objects or comparison results.

## 16. No Propagation

Confirmed no LOT 5.68 change to:

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
- reminders;
- weekly recap.

Retained Legacy consumers remain retained, including:

```jsx
realMonthlyRevenue: currentMonthTotal
```

```jsx
totalRevenues: currentMonthTotal || 0
```

```jsx
getDisplayValue(currentMonthTotal, "money")
```

## 17. Targeted Tests

Initial sandbox run:

```txt
node --test tests/lot-5-68-smart-alert-rawavailable-revenue-parity-evidence.test.js
FAIL - spawn EPERM
```

Escalated exact rerun after assertion corrections:

```txt
node --test tests/lot-5-68-smart-alert-rawavailable-revenue-parity-evidence.test.js
14/14 PASS
```

Required targeted validation, initial sandbox:

```txt
node --test tests/lot-5-66-smart-alert-reserve-low-stabilization.test.js
FAIL - spawn EPERM
```

```txt
node --test tests/lot-5-65-smart-alert-reserve-low-migration-validation.test.js
FAIL - spawn EPERM
```

```txt
node --test tests/shadow-parity-validation.test.js
FAIL - spawn EPERM
```

```txt
node --test tests/runtime-parity-evidence.test.js
FAIL - spawn EPERM
```

Escalated exact reruns:

```txt
node --test tests/lot-5-66-smart-alert-reserve-low-stabilization.test.js
15/15 PASS
```

```txt
node --test tests/lot-5-65-smart-alert-reserve-low-migration-validation.test.js
14/14 PASS
```

```txt
node --test tests/shadow-parity-validation.test.js
6/6 PASS
```

```txt
node --test tests/runtime-parity-evidence.test.js
11/11 PASS
```

Targeted ESLint:

```txt
npx eslint tests/lot-5-68-smart-alert-rawavailable-revenue-parity-evidence.test.js
PASS
```

Not run by scope:

- full `node --test`;
- `npm run build`;
- global `npm run lint`;
- Playwright;
- application.

## 18. Risks

No real mismatch was found.

Residual risk is limited to the known threshold sensitivity of the existing reserve-low alert:

```txt
One euro around revenue = 2 * chargesInput can change ALERT ON/OFF.
```

That sensitivity is already characterized and covered by the intentional mismatch test.

## 19. Recommended Next LOT

Recommended next lot:

```txt
LOT 5.69 - Smart Alert rawAvailable Revenue Migration Gate Review
```

Purpose:

```txt
Decide whether the local smart-alert revenue input can be migrated from currentMonthTotal to fiscalSummaryVisibleSlice.revenueTotal.
```

## 20. Final Decision

GO POUR LOT 5.69 — SMART ALERT RAWAVAILABLE REVENUE MIGRATION GATE REVIEW
