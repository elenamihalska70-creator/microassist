# LOT 5.72 — SMART ALERT RAWAVAILABLE REVENUE MIGRATION VALIDATION REPORT

## 1. Executive Summary

LOT 5.72 validates the completed LOT 5.70A source-only migration for the smart alert reserve-low `rawAvailable` revenue input.

No runtime code was changed. No historical guard was modified. This lot created only:

- `tests/lot-5-72-smart-alert-rawavailable-revenue-migration-validation.test.js`
- `docs/LOT_5_72_SMART_ALERT_RAWAVAILABLE_REVENUE_MIGRATION_VALIDATION_REPORT.md`

## 2. Consumer Scope

Validated consumer:

```txt
Smart alerts — reserve-low rawAvailable revenue input
```

Only the call-site revenue source is in scope. Other dashboard, feedback, analytics, export, assistant, persistence, invoice, reminder and smart-alert consumers remain out of scope.

## 3. Source Validation

Confirmed exact alias:

```js
const smartAlertRevenueTotal = fiscalSummaryVisibleSlice.revenueTotal;
```

This alias reads the existing visible slice. It does not calculate, normalize, format, persist, fallback, or create a new flag.

## 4. buildSmartAlerts Call-Site

Confirmed exact call-site:

```js
estimatedCharges: smartAlertEstimatedCharges,
currentMonthTotal: smartAlertRevenueTotal,
```

The internal `buildSmartAlerts` parameter remains named `currentMonthTotal`, preserving the function contract and keeping the migration source-only.

## 5. Legacy Direct Read Removal

Confirmed the smart alert reserve-low revenue input no longer receives direct Legacy `currentMonthTotal` at this call-site.

Confirmed no `currentMonthTotal: currentMonthTotal` or shorthand `currentMonthTotal,` remains in the `buildSmartAlerts` call.

## 6. rawAvailable Formula Integrity

Confirmed unchanged formula:

```js
const rawAvailable = Number(currentMonthTotal || 0) - Number(estimatedCharges || 0);
```

Confirmed no new rounding, tolerance, clamp, display formatting, local fallback, or Shadow read inside the formula.

## 7. Alert Logic Integrity

Confirmed unchanged reserve-low condition:

```js
if (estimatedCharges > 0 && rawAvailable < estimatedCharges)
```

Confirmed unchanged alert output:

- `id: "reserve-low"`
- `level: "warning"`
- `title: "Réserve à renforcer"`
- `text: "La réserve actuelle couvre moins d’un cycle de charges estimées."`
- `cta: "Ajouter une dépense"`
- `action: "profile"`

Confirmed priority order remains:

```txt
TVA threshold -> ACRE ending -> reserve-low -> early-tracking -> all-clear
```

## 8. Revenue Scenario Validation

Validated deterministically:

- revenue = 0
- positive revenue
- decimal revenue
- multiple revenues
- add revenue
- remove revenue
- remove last revenue
- zero to positive
- positive to zero
- same input twice
- cloned input

All covered scenarios matched between Legacy revenue totals and Shadow `revenue.total`.

## 9. Threshold Boundary Validation

Validated with no tolerance:

```txt
revenue 199, charges 100 -> ALERT_ON
revenue 200, charges 100 -> ALERT_OFF
revenue 201, charges 100 -> ALERT_OFF
```

The existing boundary remains:

```txt
revenue < 2 * estimatedCharges => ALERT_ON
revenue >= 2 * estimatedCharges => ALERT_OFF
```

## 10. Feature Flag

Confirmed existing selector behavior:

```js
revenueTotal: usesShadow
  ? shadowResult.revenue.total
  : currentMonthTotal
```

Validated:

- Flag ON + Shadow Result -> Shadow revenue total
- Flag OFF -> Legacy `currentMonthTotal`
- Missing Shadow Result -> Legacy `currentMonthTotal`

No local fallback and no new flag were introduced.

## 11. Shadow Baseline

Confirmed:

```txt
fiscalSummaryVisibleSlice = 13 occurrences
```

Confirmed the approved thirteenth consumer:

```js
const smartAlertRevenueTotal = fiscalSummaryVisibleSlice.revenueTotal;
```

No fourteenth occurrence was found.

## 12. currentMonthTotal Legacy Retention

Confirmed `currentMonthTotal` remains retained for other approved Legacy consumers, including:

- obligations input: `ca_month: currentMonthTotal`
- available amount: `currentMonthTotal - estimatedCharges`
- feedback context: `totalRevenues: currentMonthTotal || 0`
- assistant guidance: `realMonthlyRevenue: currentMonthTotal`
- PDF/export display: `getDisplayValue(currentMonthTotal, "money")`
- core computed dependencies still using `currentMonthTotal`

## 13. smartAlertEstimatedCharges Integrity

Confirmed unchanged:

```js
const smartAlertEstimatedCharges =
  fiscalSummaryVisibleSlice.finalContributionAmount;
```

Confirmed call-site remains:

```js
estimatedCharges: smartAlertEstimatedCharges
```

LOT 5.72 did not modify the charges input.

## 14. React / Pipeline Stability

Confirmed stable counts:

```txt
useState = 81
useEffect = 58
useMemo = 88
buildFiscalSummaryInput = 2
calculateFiscalSummary = 2
```

Confirmed the smart-alert block has no new state, effect, adapter execution, facade execution, or extra memo. Dependency array remains:

```js
smartAlertEstimatedCharges,
smartAlertRevenueTotal,
```

## 15. Parity / Runtime Evidence

Confirmed intact:

- LOT 5.68 rawAvailable revenue parity evidence
- intentional mismatch detection
- shadow parity evidence
- runtime parity evidence
- determinism
- immutability

## 16. No Propagation

Confirmed no propagation from the migrated smart-alert revenue input to:

- Supabase
- `localStorage`
- `sessionStorage`
- payloads
- feedback
- analytics
- exports
- PDF
- assistant
- coaching
- savingsGoal
- invoices
- reminders
- weekly recap
- other smart alerts

## 17. Rollback

Rollback remains local to the `buildSmartAlerts` call-site:

```diff
- currentMonthTotal: smartAlertRevenueTotal,
+ currentMonthTotal,
```

Then remove:

```js
const smartAlertRevenueTotal = fiscalSummaryVisibleSlice.revenueTotal;
```

No persistence, data, adapter, facade, domain, export, assistant, threshold, message, severity, or priority rollback is required.

## 18. Targeted Tests

Initial sandbox run:

```txt
node --test tests/lot-5-72-smart-alert-rawavailable-revenue-migration-validation.test.js
FAIL - spawn EPERM
```

Escalated exact rerun after test assertion tightening:

```txt
node --test tests/lot-5-72-smart-alert-rawavailable-revenue-migration-validation.test.js
tests 12
pass 12
fail 0
```

Required targeted regressions:

```txt
node --test tests/lot-5-70-smart-alert-rawavailable-revenue-migration.test.js
tests 12
pass 12
fail 0

node --test tests/lot-5-68-smart-alert-rawavailable-revenue-parity-evidence.test.js
tests 14
pass 14
fail 0

node --test tests/lot-5-66-smart-alert-reserve-low-stabilization.test.js
tests 15
pass 15
fail 0

node --test tests/shadow-parity-validation.test.js
tests 6
pass 6
fail 0

node --test tests/runtime-parity-evidence.test.js
tests 11
pass 11
fail 0
```

Targeted ESLint:

```txt
npx eslint tests/lot-5-72-smart-alert-rawavailable-revenue-migration-validation.test.js
PASS
```

Not run by scope:

- full `node --test`
- `npm run build`
- global `npm run lint`
- Playwright

## 19. Risks

No real mismatch was found.

Residual risk remains limited to the already-known reserve-low threshold sensitivity around:

```txt
revenue = 2 * estimatedCharges
```

That sensitivity is expected existing behavior and remains covered by boundary and intentional mismatch evidence.

## 20. Final Decision

GO POUR LOT 5.73 — SMART ALERT RAWAVAILABLE REVENUE STABILIZATION
