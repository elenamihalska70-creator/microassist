# LOT 5.63A - Smart Alert Reserve-Low Migration Report

## 1. Executive Summary

LOT 5.63A implemented the approved source-only migration for one consumer:

```txt
Smart alerts - estimated charges input for reserve-low alert
```

Runtime migration:

```txt
estimatedCharges
->
fiscalSummaryVisibleSlice.finalContributionAmount
```

No business logic was changed. No alert threshold, ON/OFF condition, severity, priority, title, message, CTA, `availableAmount`, `savingsGoal`, coaching, PDF/export, persistence, payload, assistant, invoice, reminder, Adapter, Facade, Domain or Rules Engine behavior was changed.

Result:

```txt
Targeted migration PASS.
```

## 2. Scope

Modified:

- `src/App.jsx`
- `tests/lot-5-63-smart-alert-reserve-low-migration.test.js`
- targeted historical guards in:
  - `tests/lot-5-61-smart-alert-reserve-low-parity-evidence.test.js`
  - `tests/lot-5-59-monthly-reflection-charges-stabilization.test.js`

Created:

- `docs/LOT_5_63_SMART_ALERT_RESERVE_LOW_MIGRATION_REPORT.md`

Only the reserve-low charges input source was migrated.

## 3. Consumer Before

Before:

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

Dependency:

```jsx
estimatedCharges,
```

## 4. Consumer After

After:

```jsx
const smartAlertEstimatedCharges =
  fiscalSummaryVisibleSlice.finalContributionAmount;
```

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

Dependency:

```jsx
smartAlertEstimatedCharges,
```

The local alias is structural only: it preserves React dependency correctness while keeping the Shadow baseline at exactly 12 occurrences. It does not introduce a new calculation, helper, fallback or business rule.

## 5. Alert Logic Integrity

Unchanged runtime condition:

```jsx
const rawAvailable = Number(currentMonthTotal || 0) - Number(estimatedCharges || 0);
```

```jsx
if (estimatedCharges > 0 && rawAvailable < estimatedCharges) {
```

No ON/OFF logic was changed.

## 6. Threshold Integrity

Unchanged threshold:

```txt
estimatedCharges > 0 && rawAvailable < estimatedCharges
```

No tolerance, ratio, rounding, `Math.max`, `Math.min`, activity mapping or rate change was introduced.

## 7. Message / Severity / Priority Integrity

Unchanged reserve-low output:

- `id: "reserve-low"`;
- `level: "warning"`;
- `title: "Réserve à renforcer"`;
- `text: "La réserve actuelle couvre moins d’un cycle de charges estimées."`;
- `cta: "Ajouter une dépense"`;
- `action: "profile"`.

Priority remains unchanged:

- TVA threshold alert returns before reserve-low;
- ACRE-ending alert returns before reserve-low;
- reserve-low returns before early-tracking.

## 8. Feature Flag

No flag was created or modified.

The migration reuses:

```jsx
finalContributionAmount: usesShadow
  ? shadowResult.summary.finalContributionAmount
  : estimatedCharges
```

Flag ON:

```txt
smartAlertEstimatedCharges uses Shadow summary.finalContributionAmount
```

Flag OFF or missing Shadow Result:

```txt
smartAlertEstimatedCharges falls back to Legacy estimatedCharges through the visible slice
```

No local fallback was added.

## 9. estimatedCharges Legacy Retention

`estimatedCharges` remains retained for approved Legacy consumers:

- original `estimatedCharges` `useMemo`;
- `availableAmount`;
- `savingsGoal`;
- coaching boundary;
- PDF/export;
- assistant-adjacent state;
- payload / feedback context;
- other dashboard consumers not approved in this lot.

Its formula remains:

```jsx
Math.round(currentMonthTotal * computed.rate)
```

## 10. Other Smart Alerts Isolation

Only the charges input passed into `buildSmartAlerts` was changed.

No other smart alert branch was migrated:

- TVA branch unchanged;
- ACRE-ending branch unchanged;
- early-tracking branch unchanged;
- all-clear branch unchanged.

## 11. No Propagation

Confirmed no propagation to:

- Supabase;
- localStorage;
- payloads;
- feedback;
- analytics;
- exports;
- PDF;
- assistant;
- coaching;
- `savingsGoal`;
- invoices;
- reminders;
- weekly recap.

## 12. Shadow Baseline 11 -> 12

Before LOT 5.63A:

```txt
fiscalSummaryVisibleSlice = 11
```

After LOT 5.63A:

```txt
fiscalSummaryVisibleSlice = 12
```

The migration adds exactly one new approved occurrence.

## 13. Twelfth Consumer Signature

Twelfth occurrence:

```jsx
const smartAlertEstimatedCharges =
  fiscalSummaryVisibleSlice.finalContributionAmount;
```

Consumer use:

```jsx
estimatedCharges: smartAlertEstimatedCharges,
```

This represents one final charges source for the reserve-low input. There is no double source in the migrated consumer.

## 14. No Thirteenth Occurrence

Validated:

```txt
fiscalSummaryVisibleSlice occurrence count = 12
```

No thirteenth occurrence was introduced.

## 15. Targeted Tests

Initial sandbox run:

```txt
node --test tests/lot-5-63-smart-alert-reserve-low-migration.test.js
```

Result:

```txt
FAIL - spawn EPERM
```

Rerun outside sandbox with approved targeted prefix:

```txt
node --test tests/lot-5-63-smart-alert-reserve-low-migration.test.js
tests 12 / pass 12 / fail 0
```

Required targeted validation:

```txt
node --test tests/lot-5-61-smart-alert-reserve-low-parity-evidence.test.js
tests 12 / pass 12 / fail 0
```

```txt
node --test tests/lot-5-59-monthly-reflection-charges-stabilization.test.js
tests 10 / pass 10 / fail 0
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
npx eslint tests/lot-5-63-smart-alert-reserve-low-migration.test.js
PASS - no output
```

Not run by scope:

- full `node --test`;
- `npm run build`;
- global `npm run lint`;
- Playwright.

## 16. Rollback

Rollback is local:

```txt
smartAlertEstimatedCharges
->
estimatedCharges
```

Rollback location:

```txt
src/App.jsx smartAlerts useMemo buildSmartAlerts(...) call
```

The alias can be removed and the dependency restored to `estimatedCharges`.

No data migration, Supabase change, localStorage change, alert threshold change, message change, Adapter change, Facade change, Domain change, Rules change, coaching change, PDF/export change, assistant change or payload change is required.

## 17. Risks

Residual risks:

- reserve-low remains behavior, not display-only;
- priority masking by TVA or ACRE-ending can hide reserve-low in some states;
- a real future mismatch near the threshold could change alert ON/OFF;
- full validation is still required in LOT 5.63B.

No blocking risk was found in the targeted 5.63A validation.

## 18. Final Decision

Migration status:

```txt
PASS
```

The reserve-low charges input now reads from the approved visible slice source while retaining Legacy fallback through the existing feature flag selector.

GO POUR LOT 5.63B - FULL MIGRATION VALIDATION

## 19. FULL MIGRATION VALIDATION

### 19.1 Pre-Test Integrity Check

Pre-test integrity check:

```txt
PASS
```

Confirmed before full validation:

- `smartAlertEstimatedCharges` reads exactly `fiscalSummaryVisibleSlice.finalContributionAmount`;
- reserve-low receives `estimatedCharges: smartAlertEstimatedCharges`;
- direct `estimatedCharges,` is no longer used for this input;
- reserve-low threshold is unchanged;
- reserve-low comparison operator is unchanged;
- reserve-low ON/OFF condition is unchanged;
- reserve-low message is unchanged;
- reserve-low severity is unchanged;
- alert priority order is unchanged;
- `availableAmount` remains Legacy;
- `savingsGoal` remains Legacy;
- other smart alerts remain unchanged;
- `estimatedCharges` remains Legacy elsewhere;
- coaching remains Legacy;
- PDF/export remains Legacy;
- assistant remains unchanged;
- persistence remains unchanged;
- payloads remain unchanged;
- invoices/reminders remain unchanged;
- no new state;
- no new `useEffect`;
- no second Adapter;
- no second Facade;
- baseline `fiscalSummaryVisibleSlice = 12`;
- the twelfth occurrence is `smartAlertEstimatedCharges = fiscalSummaryVisibleSlice.finalContributionAmount`;
- no thirteenth occurrence was found.

### 19.2 Full Node Suite

Initial sandbox run:

```txt
node --test
```

Result:

```txt
FAIL - spawn EPERM
```

Rerun outside sandbox with approved `node --test` prefix:

```txt
node --test
```

Result:

```txt
FAIL
```

Failure class:

```txt
historical guard baseline mismatch
```

Representative failures:

- `tests/lot-5-18-legacy-retention-hardening.test.js` expected the previous Shadow occurrence baseline;
- `tests/lot-5-20-next-consumer-migration.test.js` / `tests/lot-5-21-next-consumer-migration-validation.test.js` / `tests/lot-5-22-next-consumer-stabilization.test.js` still guard earlier Adapter/Facade or Shadow occurrence counts;
- multiple LOT 5.37 through LOT 5.58 historical guards still expect `fiscalSummaryVisibleSlice = 11`;
- `tests/lot-5-56-monthly-reflection-charges-migration.test.js` and `tests/lot-5-58-monthly-reflection-charges-migration-validation.test.js` still expect direct `estimatedCharges,` in the smart-alert call site.

Observed current value:

```txt
fiscalSummaryVisibleSlice = 12
```

This is the approved LOT 5.63A migration baseline, but the full historical suite still contains older guards that were not adjusted in LOT 5.63A.

Per LOT 5.63B stop conditions, no code or test correction was performed.

### 19.3 Build

Not run.

Reason:

```txt
STOP after full node suite failure.
```

### 19.4 Global Lint

Not run.

Reason:

```txt
STOP after full node suite failure.
```

### 19.5 Targeted ESLint

Not run in LOT 5.63B.

Previously passed in LOT 5.63A:

```txt
npx eslint tests/lot-5-63-smart-alert-reserve-low-migration.test.js
PASS
```

### 19.6 Playwright Run 1

Not run.

Reason:

```txt
STOP after full node suite failure.
```

### 19.7 Playwright Run 2

Not run.

Reason:

```txt
STOP after full node suite failure.
```

### 19.8 Shadow Baseline = 12

Confirmed:

```txt
fiscalSummaryVisibleSlice = 12
```

### 19.9 No 13th Occurrence

Confirmed:

```txt
no 13th occurrence found
```

### 19.10 Alert Logic Integrity

Confirmed unchanged:

```jsx
const rawAvailable = Number(currentMonthTotal || 0) - Number(estimatedCharges || 0);
```

```jsx
if (estimatedCharges > 0 && rawAvailable < estimatedCharges) {
```

### 19.11 estimatedCharges Legacy Retention

Confirmed:

- `estimatedCharges` formula remains unchanged;
- `availableAmount` remains Legacy;
- `savingsGoal` remains Legacy;
- PDF/export dependencies still include Legacy values.

### 19.12 Other Smart Alerts Isolation

Confirmed unchanged:

- TVA branch;
- ACRE-ending branch;
- early-tracking branch;
- alert ordering.

### 19.13 Coaching / PDF / SavingsGoal Isolation

Confirmed:

- coaching remains tied to `savingsGoal`;
- `savingsGoal` remains tied to Legacy `estimatedCharges`;
- PDF/export remains Legacy/inchanged.

### 19.14 Persistence / Payload / Assistant Isolation

Confirmed:

- persistence unchanged;
- payload / feedback context unchanged;
- assistant-adjacent state unchanged;
- invoices/reminders unchanged.

### 19.15 Rollback

Rollback remains local:

```txt
smartAlertEstimatedCharges
->
estimatedCharges
```

Only the reserve-low smart alert input and its dependency would need restoration.

### 19.16 Scope Control

No correction was applied after the full-suite failure.

No build, global lint or Playwright run was executed after the stop condition.

### 19.17 Final Decision

The migration itself remains targeted, but LOT 5.63B full validation did not pass because historical guards still expect the previous baseline.

Decision:

```txt
GO POUR LOT 5.64 - EXTENDED STABILIZATION
```
