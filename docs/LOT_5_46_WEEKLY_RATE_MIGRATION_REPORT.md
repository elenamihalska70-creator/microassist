# LOT 5.46A - Weekly Rate Migration Report

## 1. Executive Summary

LOT 5.46A migrated exactly one consumer:

```txt
Dashboard weekly recap - estimated rate source for weekly estimated charges
```

The migration is source-only. It replaces the Legacy direct rate expression with the LOT 5.44 hardened helper contract.

No weekly formula, date logic, invoice logic, reminder logic, coaching, PDF, persistence, payload, assistant, export, Adapter, Facade, Rules Engine, rate table or rounding behavior was changed.

Result:

```txt
GO for full migration validation.
```

## 2. Scope

Modified files:

- `src/App.jsx`
- `tests/lot-5-46-weekly-rate-migration.test.js`
- `tests/lot-5-42-weekly-recap-effective-rate-parity-evidence.test.js`
- `tests/lot-5-44-weekly-rate-contract-hardening.test.js`
- `docs/LOT_5_46_WEEKLY_RATE_MIGRATION_REPORT.md`

The LOT 5.42 and LOT 5.44 tests were updated only to reflect the approved Shadow baseline change from 8 to 9 occurrences and the single approved weekly effective-rate read.

## 3. Consumer Before

Legacy weekly recap rate source:

```js
const estimatedRate =
  computed?.rate || getEstimatedRate(dashboardAnswers.activity_type);
```

Downstream formula:

```js
const weeklyEstimatedCharges =
  weeklyRevenueCount > 0 && Number.isFinite(estimatedRate)
    ? Math.round(weeklyRevenueTotal * estimatedRate)
    : null;
```

## 4. Consumer After

The weekly recap now reads the visible Shadow/Legacy selected rate once:

```js
const weeklyRecapEffectiveRate = fiscalSummaryVisibleSlice.effectiveRate;
```

Then resolves the final weekly rate through the hardened helper:

```js
const estimatedRate = resolveWeeklyEstimatedRate({
  effectiveRate: weeklyRecapEffectiveRate,
  legacyFallbackRate: getEstimatedRate(dashboardAnswers.activity_type),
});
```

The alias keeps the approved `fiscalSummaryVisibleSlice` baseline at 9 by avoiding a second occurrence in the `useMemo` dependency list.

## 5. Helper Usage

Imported helper:

```js
import { resolveWeeklyEstimatedRate } from "./application/weekly/resolveWeeklyEstimatedRate.js";
```

The helper is called once in `src/App.jsx`.

No local duplication of:

```js
effectiveRate || legacyFallbackRate
```

was added to `App.jsx`.

## 6. Zero / Null / Undefined Semantics

Preserved by helper contract:

- positive `effectiveRate` wins;
- `effectiveRate = 0` falls back to Legacy;
- `effectiveRate = null` falls back to Legacy;
- `effectiveRate = undefined` falls back to Legacy.

No `??` semantics were introduced.

## 7. Unknown / Missing Activity Semantics

Unknown and missing activity behavior remains delegated to:

```js
getEstimatedRate(dashboardAnswers.activity_type)
```

No additional normalization was added.

## 8. Formula Preservation

Unchanged:

```js
Math.round(weeklyRevenueTotal * estimatedRate)
```

Also unchanged:

- `weeklyRevenueCount > 0`;
- `Number.isFinite(estimatedRate)`;
- `null` fallback for unavailable charges;
- charge label and helper text.

## 9. Date Isolation

Unchanged:

- `parseIsoDate(getTodayIsoDate())`;
- `weekStart`;
- Monday boundary calculation;
- `weekStart.setHours(0, 0, 0, 0)`;
- revenue date filtering.

## 10. Invoice / Reminder Isolation

Unchanged:

- `visibleInvoices.filter(...)`;
- `parseIsoDate(invoice.invoice_date)`;
- `activeReminderItems.length`;
- reminder title fallback;
- weekly recap visibility condition.

## 11. Feature Flag

No new flag was created.

The consumer follows the existing visible slice:

- flag ON: `fiscalSummaryVisibleSlice.effectiveRate` comes from approved Shadow result;
- flag OFF or no Shadow result: `fiscalSummaryVisibleSlice.effectiveRate` falls back through selector to Legacy `computed?.rate`.

The weekly fallback `getEstimatedRate(...)` remains available in both modes.

## 12. Shadow Baseline 8 -> 9

Approved baseline before LOT 5.46A:

```txt
fiscalSummaryVisibleSlice = 8
```

Actual baseline after LOT 5.46A:

```txt
fiscalSummaryVisibleSlice = 9
```

The single new occurrence is:

```js
const weeklyRecapEffectiveRate = fiscalSummaryVisibleSlice.effectiveRate;
```

There is no 10th occurrence.

## 13. Tests

Created:

```txt
tests/lot-5-46-weekly-rate-migration.test.js
```

The test covers:

- exact migrated consumer;
- helper import and single usage;
- Shadow effective rate injection;
- Legacy fallback injection;
- removal of the direct Legacy expression for this consumer;
- positive, zero, null and undefined semantics;
- unknown and missing activity fallback;
- weekly formula preservation;
- date isolation;
- invoice/reminder isolation;
- feature flag isolation;
- no new state/effect;
- no second Adapter/Facade;
- parity and runtime evidence intact;
- no persistence/payload/assistant/export change;
- Shadow baseline 9 and no 10th occurrence;
- local rollback expression.

Historical guards updated:

- `tests/lot-5-42-weekly-recap-effective-rate-parity-evidence.test.js`
- `tests/lot-5-44-weekly-rate-contract-hardening.test.js`

Only the approved baseline and migrated consumer assertions changed.

## 14. Targeted Validation

Initial sandbox runs:

```bash
node --test tests/lot-5-46-weekly-rate-migration.test.js
node --test tests/lot-5-44-weekly-rate-contract-hardening.test.js
node --test tests/lot-5-42-weekly-recap-effective-rate-parity-evidence.test.js
node --test tests/shadow-parity-validation.test.js
node --test tests/runtime-parity-evidence.test.js
```

Sandbox result:

```txt
FAIL - spawn EPERM
```

Relance hors sandbox approuvee:

```bash
node --test tests/lot-5-46-weekly-rate-migration.test.js
```

```txt
tests 11
pass 11
fail 0
duration_ms 136.9001
```

```bash
node --test tests/lot-5-44-weekly-rate-contract-hardening.test.js
```

```txt
tests 13
pass 13
fail 0
duration_ms 126.9845
```

```bash
node --test tests/lot-5-42-weekly-recap-effective-rate-parity-evidence.test.js
```

```txt
tests 15
pass 15
fail 0
duration_ms 210.7893
```

```bash
node --test tests/shadow-parity-validation.test.js
```

```txt
tests 6
pass 6
fail 0
duration_ms 117.1436
```

```bash
node --test tests/runtime-parity-evidence.test.js
```

```txt
tests 11
pass 11
fail 0
duration_ms 144.4977
```

```bash
npx eslint tests/lot-5-46-weekly-rate-migration.test.js src/application/weekly/resolveWeeklyEstimatedRate.js
```

```txt
PASS - no output
```

Not run by scope:

- full `node --test`;
- `npm run build`;
- global lint;
- Playwright;
- application runtime.

## 15. Risks

Residual risk is limited to full-suite integration confidence, deferred to LOT 5.46B.

No known business mismatch remains in the migrated source contract because the Legacy fallback remains injected explicitly.

## 16. Rollback

Rollback is local:

```js
const estimatedRate =
  computed?.rate || getEstimatedRate(dashboardAnswers.activity_type);
```

Then remove the `resolveWeeklyEstimatedRate` import and the `weeklyRecapEffectiveRate` alias if unused.

No date, invoice, reminder, persistence, payload, assistant, export, Adapter, Facade, Rules Engine or rate-table rollback is required.

## 17. Final Decision

GO POUR LOT 5.46B - FULL MIGRATION VALIDATION

## 18. FULL MIGRATION VALIDATION

### 18.1 Pre-Test Integrity Check

Pre-test integrity check result:

```txt
PASS
```

Confirmed before full validation:

- weekly recap uses `resolveWeeklyEstimatedRate(...)`;
- the selected effective rate comes from `fiscalSummaryVisibleSlice.effectiveRate`;
- the effective rate is read once through `weeklyRecapEffectiveRate`;
- Legacy fallback remains exactly `getEstimatedRate(dashboardAnswers.activity_type)`;
- weekly estimated charges formula remains `Math.round(weeklyRevenueTotal * estimatedRate)`;
- date/week logic remains unchanged;
- invoice logic remains unchanged;
- reminder logic remains unchanged;
- no new React state was added by this validation lot;
- no second Adapter was added by this validation lot;
- no second Facade was added by this validation lot;
- `fiscalSummaryVisibleSlice` baseline is exactly `9`;
- the 9th occurrence is the weekly recap rate consumer;
- no 10th occurrence was found.

### 18.2 Full Node Suite

Initial sandbox run:

```bash
node --test
```

Sandbox result:

```txt
FAIL - spawn EPERM
```

The command was rerun exactly outside sandbox with the approved `node --test` prefix.

Final full-suite result:

```txt
tests 566
pass 547
fail 19
duration_ms 2002.9653
```

Failure class:

```txt
Historical baseline guards still expecting fiscalSummaryVisibleSlice = 8.
Actual approved baseline after LOT 5.46A is fiscalSummaryVisibleSlice = 9.
```

Failing guards:

- `tests/lot-5-18-legacy-retention-hardening.test.js`
- `tests/lot-5-20-next-consumer-migration.test.js`
- `tests/lot-5-21-next-consumer-migration-validation.test.js`
- `tests/lot-5-22-next-consumer-stabilization.test.js`
- `tests/lot-5-24-next-consumer-migration.test.js`
- `tests/lot-5-25-next-consumer-migration-validation.test.js`
- `tests/lot-5-26-next-consumer-stabilization.test.js`
- `tests/lot-5-29-savingsgoal-architecture-hardening.test.js`
- `tests/lot-5-30-isolated-savingsgoal-ui-parity-evidence.test.js`
- `tests/lot-5-32-isolated-savingsgoal-ui-migration.test.js`
- `tests/lot-5-34-isolated-savingsgoal-ui-migration-validation.test.js`
- `tests/lot-5-35-isolated-savingsgoal-ui-stabilization.test.js`
- `tests/lot-5-37-objective-savings-progress-bar-migration.test.js`
- `tests/lot-5-39-objective-savings-progress-bar-migration-validation.test.js`
- `tests/lot-5-40-objective-savings-progress-bar-stabilization.test.js`

Some files contain multiple failing assertions, for 19 total failures.

Per LOT 5.46B instructions, no guard was modified after the full-suite failure.

### 18.3 Build

Not run.

Reason:

```txt
STOP condition reached at full node suite.
```

### 18.4 Global Lint

Not run.

Reason:

```txt
STOP condition reached at full node suite.
```

### 18.5 Targeted ESLint

Not rerun in LOT 5.46B.

Last LOT 5.46A targeted ESLint result:

```txt
PASS
```

### 18.6 Playwright Run 1

Not run.

Reason:

```txt
STOP condition reached at full node suite.
```

### 18.7 Playwright Run 2

Not run.

Reason:

```txt
STOP condition reached at full node suite.
```

### 18.8 Shadow Baseline = 9

Confirmed:

```txt
fiscalSummaryVisibleSlice = 9
```

### 18.9 No 10th Occurrence

Confirmed:

```txt
No 10th fiscalSummaryVisibleSlice occurrence found.
```

### 18.10 Weekly Formula Integrity

Confirmed unchanged:

```js
Math.round(weeklyRevenueTotal * estimatedRate)
```

### 18.11 Date / Invoice / Reminder Isolation

Confirmed unchanged:

- weekly date boundary logic remains local to the recap;
- invoice count remains based on `visibleInvoices.filter(...)`;
- reminder count remains based on `activeReminderItems.length`.

### 18.12 Parity / Runtime Evidence

The dedicated 5.46A validation had already passed:

- LOT 5.46 targeted test: 11/11 PASS;
- LOT 5.44 contract hardening: 13/13 PASS;
- LOT 5.42 parity evidence: 15/15 PASS;
- shadow parity: 6/6 PASS;
- runtime evidence: 11/11 PASS.

The full suite did not invalidate a business parity assertion. It stopped on historical reference-count guards expecting the pre-5.46 baseline.

### 18.13 Rollback

Rollback remains local:

```js
const estimatedRate =
  computed?.rate || getEstimatedRate(dashboardAnswers.activity_type);
```

No migration of data, Supabase, localStorage, Adapter, Facade, Rules Engine, invoices or reminders is required.

### 18.14 Scope Control

LOT 5.46B made no runtime code change and did not migrate any additional consumer.

Only this report was completed after the STOP condition.

### 18.15 Final Decision

GO POUR LOT 5.47 - EXTENDED STABILIZATION
