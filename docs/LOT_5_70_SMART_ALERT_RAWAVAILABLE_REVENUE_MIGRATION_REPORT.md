# LOT 5.70A - Smart Alert rawAvailable Revenue Migration Report

## 1. Executive Summary

LOT 5.70A migrated exactly one consumer:

```txt
Smart alerts - revenue input for reserve-low rawAvailable
```

Migration type:

```txt
source-only
```

No business formula was changed. No `rawAvailable` formula, threshold, ON/OFF logic, severity, priority, message, persistence path, payload, export, assistant, coaching, invoice or reminder behavior was modified.

## 2. Scope

Authorized runtime file:

```txt
src/App.jsx
```

Created:

- `tests/lot-5-70-smart-alert-rawavailable-revenue-migration.test.js`
- `docs/LOT_5_70_SMART_ALERT_RAWAVAILABLE_REVENUE_MIGRATION_REPORT.md`

Historical guards adjusted because their prior Shadow baseline and call-site expectations were obsolete after the approved 13th occurrence:

- `tests/lot-5-64-extended-stabilization.test.js`
- `tests/lot-5-65-smart-alert-reserve-low-migration-validation.test.js`
- `tests/lot-5-66-smart-alert-reserve-low-stabilization.test.js`
- `tests/lot-5-68-smart-alert-rawavailable-revenue-parity-evidence.test.js`

## 3. Consumer Before

Before LOT 5.70A:

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

The revenue input for `rawAvailable` was the direct Legacy value:

```txt
currentMonthTotal
```

## 4. Consumer After

After LOT 5.70A:

```jsx
const smartAlertRevenueTotal = fiscalSummaryVisibleSlice.revenueTotal;
```

```jsx
buildSmartAlerts({
  answers: dashboardAnswers,
  computed,
  revenues,
  invoices: visibleInvoices,
  reminderPrefs,
  estimatedCharges: smartAlertEstimatedCharges,
  currentMonthTotal: smartAlertRevenueTotal,
})
```

The `buildSmartAlerts` internal parameter remains named `currentMonthTotal`, preserving the internal function contract and the existing `rawAvailable` formula.

## 5. Revenue Source

New source:

```jsx
fiscalSummaryVisibleSlice.revenueTotal
```

Local alias:

```jsx
const smartAlertRevenueTotal = fiscalSummaryVisibleSlice.revenueTotal;
```

The alias:

- calculates nothing;
- normalizes nothing;
- formats nothing;
- persists nothing;
- creates no fallback;
- creates no new `useMemo`;
- creates no state.

## 6. rawAvailable Formula Integrity

Unchanged formula:

```jsx
const rawAvailable = Number(currentMonthTotal || 0) - Number(estimatedCharges || 0);
```

Unchanged threshold condition:

```jsx
if (estimatedCharges > 0 && rawAvailable < estimatedCharges)
```

No `Math.max`, `Math.min`, `Math.round`, new fallback, tolerance or new clamp was introduced.

## 7. smartAlertEstimatedCharges Integrity

Unchanged prior migration:

```jsx
const smartAlertEstimatedCharges =
  fiscalSummaryVisibleSlice.finalContributionAmount;
```

Unchanged call-site input:

```jsx
estimatedCharges: smartAlertEstimatedCharges
```

No charges input was migrated or refactored in this lot.

## 8. Alert Logic Integrity

Unchanged reserve-low output:

- `id: "reserve-low"`
- `level: "warning"`
- `title: "Réserve à renforcer"`
- `text: "La réserve actuelle couvre moins d’un cycle de charges estimées."`
- `cta: "Ajouter une dépense"`
- `action: "profile"`

Unchanged priority:

```txt
TVA threshold -> ACRE ending -> reserve-low -> early-tracking -> all-clear
```

Boundary behavior remains:

```txt
revenue < 2 * estimatedCharges => ALERT_ON
revenue >= 2 * estimatedCharges => ALERT_OFF
```

## 9. Feature Flag

No feature flag was created or modified.

The migrated source reuses the existing visible selector:

```jsx
revenueTotal: usesShadow
  ? shadowResult.revenue.total
  : currentMonthTotal
```

Behavior:

```txt
Flag ON + Shadow Result -> Shadow revenue.total
Flag OFF -> Legacy currentMonthTotal
Missing Shadow Result -> Legacy currentMonthTotal
```

## 10. currentMonthTotal Legacy Retention

`currentMonthTotal` remains Legacy elsewhere.

Retained examples:

```jsx
realMonthlyRevenue: currentMonthTotal
```

```jsx
totalRevenues: currentMonthTotal || 0
```

```jsx
getDisplayValue(currentMonthTotal, "money")
```

```jsx
ca_month: currentMonthTotal
```

```jsx
return Math.max(0, currentMonthTotal - estimatedCharges);
```

No other `currentMonthTotal` consumer was migrated.

## 11. Other Smart Alerts Isolation

Unchanged branches:

- TVA threshold;
- ACRE ending;
- early tracking;
- all clear.

`buildSmartAlerts` itself does not read `fiscalSummaryVisibleSlice`, `smartAlertRevenueTotal` or `smartAlertEstimatedCharges`.

## 12. No Propagation

Confirmed no propagation to:

- Supabase;
- `localStorage`;
- `sessionStorage`;
- payloads;
- feedback;
- analytics;
- exports;
- PDF;
- assistant;
- coaching;
- savingsGoal;
- invoices;
- reminders;
- weekly recap.

## 13. Shadow Baseline 12 -> 13

Before LOT 5.70A:

```txt
fiscalSummaryVisibleSlice = 12 occurrences
```

After LOT 5.70A:

```txt
fiscalSummaryVisibleSlice = 13 occurrences
```

The increase is exactly one approved occurrence.

## 14. Thirteenth Consumer Signature

The approved 13th occurrence is:

```jsx
const smartAlertRevenueTotal = fiscalSummaryVisibleSlice.revenueTotal;
```

It feeds only:

```jsx
currentMonthTotal: smartAlertRevenueTotal
```

inside the smart-alert call site.

## 15. No Fourteenth Occurrence

Validated:

```txt
fiscalSummaryVisibleSlice = 13
```

No 14th occurrence was introduced.

## 16. Dependency Array

Before:

```jsx
smartAlertEstimatedCharges,
currentMonthTotal,
```

After:

```jsx
smartAlertEstimatedCharges,
smartAlertRevenueTotal,
```

No unrelated dependency was added.

No new `useMemo`, `useState`, `useEffect`, Adapter execution or Facade execution was introduced.

## 17. Targeted Tests

Initial sandbox runs:

```txt
node --test tests/lot-5-70-smart-alert-rawavailable-revenue-migration.test.js
FAIL - spawn EPERM
```

```txt
node --test tests/lot-5-68-smart-alert-rawavailable-revenue-parity-evidence.test.js
FAIL - spawn EPERM
```

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
node --test tests/lot-5-70-smart-alert-rawavailable-revenue-migration.test.js
12/12 PASS
```

```txt
node --test tests/lot-5-68-smart-alert-rawavailable-revenue-parity-evidence.test.js
14/14 PASS
```

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

Historical guard adjusted and validated:

```txt
node --test tests/lot-5-64-extended-stabilization.test.js
1/1 PASS
```

Targeted ESLint:

```txt
npx eslint tests/lot-5-70-smart-alert-rawavailable-revenue-migration.test.js
PASS
```

Not run by scope:

- full `node --test`;
- `npm run build`;
- global `npm run lint`;
- Playwright.

## 18. Rollback

Rollback is local:

```diff
- currentMonthTotal: smartAlertRevenueTotal,
+ currentMonthTotal,
```

and dependency rollback:

```diff
- smartAlertRevenueTotal,
+ currentMonthTotal,
```

Then remove:

```jsx
const smartAlertRevenueTotal = fiscalSummaryVisibleSlice.revenueTotal;
```

No data migration, persistence rollback, Adapter rollback, Facade rollback, Domain rollback, Rules rollback, export rollback, assistant rollback or message rollback is required.

## 19. Risks

No real parity mismatch appeared.

Residual risk remains limited to the existing reserve-low threshold sensitivity:

```txt
one euro around revenue = 2 * estimatedCharges can change ALERT ON/OFF
```

That risk was already characterized by LOT 5.68 and remains detectable.

## 20. FULL MIGRATION VALIDATION

### 20.1 Pre-Test Integrity Check

Inspection before full validation confirmed:

- `smartAlertRevenueTotal` reads exactly `fiscalSummaryVisibleSlice.revenueTotal`;
- `buildSmartAlerts` receives `currentMonthTotal: smartAlertRevenueTotal`;
- dependency array uses `smartAlertRevenueTotal`;
- `smartAlertEstimatedCharges` remains `fiscalSummaryVisibleSlice.finalContributionAmount`;
- `rawAvailable` formula remains `Number(currentMonthTotal || 0) - Number(estimatedCharges || 0)`;
- threshold remains `estimatedCharges > 0 && rawAvailable < estimatedCharges`;
- reserve-low message, severity and priority remain unchanged;
- `currentMonthTotal` remains retained elsewhere for Legacy consumers.

Shadow baseline remains:

```txt
fiscalSummaryVisibleSlice = 13
```

The approved 13th occurrence is:

```jsx
const smartAlertRevenueTotal = fiscalSummaryVisibleSlice.revenueTotal;
```

No 14th occurrence was approved or observed in the inspected migration block.

### 20.2 Full Node Suite

Sandbox run:

```txt
node --test
FAIL - spawn EPERM
```

Escalated exact rerun:

```txt
node --test
FAIL
```

Observed failure class:

```txt
Historical guard expectations obsolete after approved Shadow baseline 13.
```

Representative failures:

- LOT 5.18 / 5.20 / 5.21 / 5.22 / 5.24 historical React or Shadow-count guards;
- LOT 5.37 through LOT 5.59 historical guards still expecting `fiscalSummaryVisibleSlice = 12`;
- LOT 5.61 and LOT 5.63 guards still expecting direct `currentMonthTotal,` in the smart alert call;
- affected assertions compare current approved baseline `13` against historical expected `12`, or expect the pre-5.70A call-site revenue source.

No automatic correction was performed, per LOT 5.70B stop condition.

### 20.3 Build

Not run.

Reason:

```txt
STOP after full node suite failed outside the known sandbox EPERM case.
```

### 20.4 Global Lint

Not run.

Reason:

```txt
STOP after full node suite failed outside the known sandbox EPERM case.
```

### 20.5 Targeted ESLint

Not run in LOT 5.70B after the full-suite stop.

Prior LOT 5.70A targeted ESLint result:

```txt
npx eslint tests/lot-5-70-smart-alert-rawavailable-revenue-migration.test.js
PASS
```

### 20.6 Playwright Run 1

Not run.

Reason:

```txt
STOP after full node suite failed outside the known sandbox EPERM case.
```

### 20.7 Playwright Run 2

Not run.

Reason:

```txt
STOP after full node suite failed outside the known sandbox EPERM case.
```

### 20.8 Boundary Check

The migration state remains:

- reserve-low rawAvailable revenue input -> Shadow `revenueTotal`;
- reserve-low charges input -> Shadow `finalContributionAmount`;
- other `currentMonthTotal` consumers -> Legacy;
- other `estimatedCharges` consumers -> Legacy;
- other smart alerts -> unchanged;
- threshold -> unchanged;
- ON/OFF logic -> unchanged;
- message/severity/priority -> unchanged;
- feedback/analytics/export/PDF/assistant/persistence/payloads -> unchanged by LOT 5.70B.

### 20.9 Rollback

Rollback remains local:

```diff
- currentMonthTotal: smartAlertRevenueTotal,
+ currentMonthTotal,
```

and:

```diff
- smartAlertRevenueTotal,
+ currentMonthTotal,
```

then remove:

```jsx
const smartAlertRevenueTotal = fiscalSummaryVisibleSlice.revenueTotal;
```

No data, Supabase, localStorage, Adapter, Facade, Rules Engine, threshold, message or severity rollback is required.

### 20.10 Scope Control

LOT 5.70B did not modify application code.

No additional consumer was migrated.

No historical guard was corrected automatically after the full-suite failure.

## 21. Final Decision

GO POUR LOT 5.71 — EXTENDED STABILIZATION
