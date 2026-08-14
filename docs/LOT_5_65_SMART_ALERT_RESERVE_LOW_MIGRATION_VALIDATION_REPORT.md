# LOT 5.65 - SMART ALERT RESERVE-LOW MIGRATION VALIDATION REPORT

## 1. Executive Summary

LOT 5.65 validates the completed reserve-low smart alert migration.

No runtime file was modified. `src/App.jsx` remains unchanged in this lot.

Created:

- `tests/lot-5-65-smart-alert-reserve-low-migration-validation.test.js`
- `docs/LOT_5_65_SMART_ALERT_RESERVE_LOW_MIGRATION_VALIDATION_REPORT.md`

## 2. Consumer Scope

Validated consumer:

```txt
Smart alerts - reserve-low estimated charges input
```

The only migrated source remains:

```txt
estimatedCharges -> smartAlertEstimatedCharges
```

where:

```js
smartAlertEstimatedCharges =
  fiscalSummaryVisibleSlice.finalContributionAmount
```

## 3. Source Validation

Validated exact alias:

```js
const smartAlertEstimatedCharges =
  fiscalSummaryVisibleSlice.finalContributionAmount;
```

Validated exact consumer:

```js
estimatedCharges: smartAlertEstimatedCharges
```

## 4. Legacy Direct Read Removal

The smart alert call site no longer passes direct:

```js
estimatedCharges,
```

for the reserve-low input.

`estimatedCharges` remains present inside `buildSmartAlerts` as the function parameter that drives the unchanged reserve-low contract.

## 5. Alert Logic Integrity

Validated unchanged:

```js
const rawAvailable = Number(currentMonthTotal || 0) - Number(estimatedCharges || 0);
```

```js
if (estimatedCharges > 0 && rawAvailable < estimatedCharges)
```

No ratio, rounding, fallback, `Math.max`, `Math.min`, threshold or comparison change was introduced.

## 6. Alert Output Integrity

Validated unchanged reserve-low output:

- `id: "reserve-low"`
- `level: "warning"`
- `title: "Réserve à renforcer"`
- `text: "La réserve actuelle couvre moins d’un cycle de charges estimées."`
- `cta: "Ajouter une dépense"`
- `action: "profile"`

Priority remains TVA, ACRE-ending, reserve-low, early-tracking, all-clear.

## 7. Boundary Scenario Validation

Validated deterministic ON/OFF scenarios:

- charges = 0
- low amount
- medium amount
- high amount
- just below threshold
- exactly at threshold
- just above threshold
- ACRE inactive
- ACRE active
- revenue = 0
- revenue positive
- multiple revenues
- same input twice
- cloned input

The strict threshold behavior remains:

```txt
currentMonthTotal < 2 * chargesInput => ALERT_ON
currentMonthTotal >= 2 * chargesInput => ALERT_OFF
```

## 8. Feature Flag

Validated existing visible slice behavior:

```js
finalContributionAmount: usesShadow
  ? shadowResult.summary.finalContributionAmount
  : estimatedCharges
```

Flag ON returns Shadow `summary.finalContributionAmount`.

Flag OFF or missing Shadow Result returns Legacy `estimatedCharges`.

No new flag and no local fallback were added.

## 9. Shadow Baseline

Validated:

```txt
fiscalSummaryVisibleSlice = 12 occurrences
```

No thirteenth occurrence was found.

The smart alert block contains no direct `fiscalSummaryVisibleSlice.finalContributionAmount` read.

## 10. estimatedCharges Legacy Retention

Validated retained Legacy roles:

- original `estimatedCharges` `useMemo`
- `availableAmount`
- global `savingsGoal`
- coaching dependency through `savingsGoal`
- PDF/export values
- assistant-adjacent `currentMonthTotal`
- feedback/payload revenue context

## 11. Other Smart Alerts Isolation

Validated unchanged smart alert branches:

- TVA threshold
- ACRE ending
- early tracking
- all clear

No other smart alert uses `smartAlertEstimatedCharges` or `fiscalSummaryVisibleSlice`.

## 12. React / Pipeline Stability

Validated source counts:

- `useState = 82`
- `useEffect = 59`
- `useMemo = 89`
- `buildFiscalSummaryInput = 2`
- `calculateFiscalSummary = 2`

The smart alert call block does not execute Adapter, Facade, new state or new effect logic.

## 13. Parity / Runtime Evidence

Validated intact:

- LOT 5.61 strict input MATCH evidence
- intentional mismatch visibility
- shadow parity strict identity
- runtime evidence MISMATCH without hidden normalization or tolerance

## 14. No Propagation

Validated no propagation to:

- Supabase
- localStorage / sessionStorage
- payloads / feedback
- analytics
- exports / PDF
- assistant
- coaching
- savingsGoal
- weekly recap

## 15. Rollback

Rollback remains local:

```txt
estimatedCharges: smartAlertEstimatedCharges
-> estimatedCharges
```

No data, persistence, Adapter, Facade, Domain, Rules, export, assistant or coaching rollback is required.

## 16. Targeted Tests

Initial sandbox run:

```txt
node --test tests/lot-5-65-smart-alert-reserve-low-migration-validation.test.js
FAIL - spawn EPERM
```

Escalated exact rerun:

```txt
node --test tests/lot-5-65-smart-alert-reserve-low-migration-validation.test.js
14/14 PASS
```

Required targeted validation:

```txt
node --test tests/lot-5-63-smart-alert-reserve-low-migration.test.js
12/12 PASS
```

```txt
node --test tests/lot-5-61-smart-alert-reserve-low-parity-evidence.test.js
12/12 PASS
```

```txt
node --test tests/lot-5-59-monthly-reflection-charges-stabilization.test.js
10/10 PASS
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
npx eslint tests/lot-5-65-smart-alert-reserve-low-migration-validation.test.js
PASS
```

Not run by scope:

- full `node --test`
- `npm run build`
- global `npm run lint`
- Playwright

## 17. Risks

Residual risk is limited to the normal reserve-low behavioral sensitivity near its threshold.

No real mismatch was found. No rollback is required.

## 18. Final Decision

The reserve-low migration is validated.

GO POUR LOT 5.66 — SMART ALERT RESERVE-LOW STABILIZATION
