# LOT 5.47 - Extended Stabilization Report

## 1. Executive Summary

LOT 5.47 stabilized only historical guards that still expected the pre-LOT 5.46 baseline:

```txt
fiscalSummaryVisibleSlice = 8
```

The approved baseline after LOT 5.46A is now:

```txt
fiscalSummaryVisibleSlice = 9
```

No runtime code was changed. No new consumer was migrated. No formula, date, invoice, reminder, persistence, payload, export, assistant, Adapter, Facade, Rules Engine, rate or rounding behavior was changed.

Result:

```txt
Full validation PASS.
```

## 2. Original 19 Failures

LOT 5.46B full node suite result:

```txt
tests 566
pass 547
fail 19
```

Failure class:

```txt
Historical guards still expected fiscalSummaryVisibleSlice = 8.
Actual approved baseline was fiscalSummaryVisibleSlice = 9.
```

Affected test files:

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

Some files contained multiple obsolete assertions, for 19 total failures.

## 3. Historical Guards Updated

Updated only historical guard expectations related directly to:

- `fiscalSummaryVisibleSlice = 8 -> 9`;
- wording that said there was no 9th occurrence;
- references to the LOT 5.18 guard baseline inside later stabilization tests.

Created:

```txt
tests/lot-5-47-extended-stabilization.test.js
```

Purpose:

- lock the 9th occurrence signature;
- prove no 10th occurrence exists;
- prove weekly rate source uses `resolveWeeklyEstimatedRate`;
- preserve weekly formula/date/invoice/reminder boundaries.

## 4. Old Baseline = 8

The old baseline was valid before LOT 5.46A:

```txt
fiscalSummaryVisibleSlice = 8
```

It became obsolete because LOT 5.46A intentionally added one approved weekly recap rate consumer.

## 5. New Approved Baseline = 9

Final baseline:

```txt
fiscalSummaryVisibleSlice = 9
```

Confirmed by source inspection and tests.

## 6. Ninth Consumer Signature

The 9th occurrence is exactly:

```js
const weeklyRecapEffectiveRate = fiscalSummaryVisibleSlice.effectiveRate;
```

It feeds:

```js
resolveWeeklyEstimatedRate({
  effectiveRate: weeklyRecapEffectiveRate,
  legacyFallbackRate: getEstimatedRate(dashboardAnswers.activity_type),
})
```

## 7. No Tenth Occurrence

Confirmed:

```txt
No 10th fiscalSummaryVisibleSlice occurrence.
```

The new guard fails if another occurrence is introduced.

## 8. Weekly Contract Integrity

Preserved:

- helper `resolveWeeklyEstimatedRate(...)`;
- selected effective rate via `weeklyRecapEffectiveRate`;
- Legacy fallback `getEstimatedRate(dashboardAnswers.activity_type)`;
- no inline duplicate `effectiveRate || legacyFallbackRate` in `App.jsx`;
- rollback remains local.

## 9. Formula / Date Integrity

Weekly formula unchanged:

```js
Math.round(weeklyRevenueTotal * estimatedRate)
```

Date/week logic unchanged:

- `parseIsoDate(getTodayIsoDate())`;
- `new Date(today)`;
- Monday boundary calculation;
- `weekStart.setHours(0, 0, 0, 0)`.

## 10. Invoice / Reminder Isolation

Unchanged:

- invoice count stays on `visibleInvoices.filter(...)`;
- invoice date parsing stays on `parseIsoDate(invoice.invoice_date)`;
- reminder count stays on `activeReminderItems.length`;
- reminder helper text remains unchanged.

## 11. Targeted Validation

Initial targeted sandbox run:

```txt
FAIL - spawn EPERM
```

Relance hors sandbox approuvee:

```bash
node --test [15 historical guard files] tests/lot-5-47-extended-stabilization.test.js
```

```txt
tests 288
pass 288
fail 0
duration_ms 847.3915
```

Regression validation:

```bash
node --test tests/lot-5-46-weekly-rate-migration.test.js
```

```txt
tests 11
pass 11
fail 0
duration_ms 132.2006
```

```bash
node --test tests/lot-5-44-weekly-rate-contract-hardening.test.js
```

```txt
tests 13
pass 13
fail 0
duration_ms 136.6505
```

```bash
node --test tests/lot-5-42-weekly-recap-effective-rate-parity-evidence.test.js
```

```txt
tests 15
pass 15
fail 0
duration_ms 125.3274
```

```bash
node --test tests/shadow-parity-validation.test.js
```

```txt
tests 6
pass 6
fail 0
duration_ms 140.4403
```

```bash
node --test tests/runtime-parity-evidence.test.js
```

```txt
tests 11
pass 11
fail 0
duration_ms 135.7374
```

Targeted ESLint:

```bash
npx eslint [all modified LOT 5.47 test files]
```

```txt
PASS - no output
```

## 12. Full Node Suite

Initial sandbox run:

```bash
node --test
```

```txt
FAIL - spawn EPERM
```

Relance hors sandbox approuvee:

```bash
node --test
```

```txt
tests 568
pass 568
fail 0
duration_ms 1852.9076
```

## 13. Build

```bash
npm run build
```

```txt
PASS
```

Vite warning accepted by scope:

```txt
Some chunks are larger than 500 kB after minification.
```

## 14. Global Lint

```bash
npm run lint
```

Historical baseline observed:

```txt
50 problems
21 errors
29 warnings
```

This matches the expected LOT 5.47 baseline. No lint issue was corrected.

## 15. Playwright Run 1

```bash
npx playwright test --reporter=line
```

```txt
11 passed
duration 18.6s
```

## 16. Playwright Run 2

```bash
npx playwright test --reporter=line
```

```txt
11 passed
duration 13.9s
```

## 17. Rollback

Rollback remains local to the weekly recap rate source:

```js
const estimatedRate =
  computed?.rate || getEstimatedRate(dashboardAnswers.activity_type);
```

Then remove the helper import and `weeklyRecapEffectiveRate` alias if unused.

No data migration, Supabase change, localStorage change, Adapter change, Facade change, Rules Engine change, invoice change or reminder change is required.

## 18. Scope Control

Confirmed:

- no `src/App.jsx` modification in LOT 5.47;
- no `resolveWeeklyEstimatedRate.js` modification;
- no weekly runtime modification;
- no `getEstimatedRate` modification;
- no fiscal selector modification;
- no Adapter/Facade/Rules/Domain modification;
- no dates/invoices/reminders modification;
- no persistence/payload/export/assistant modification;
- no new consumer migration.

## 19. Final Decision

GO POUR LOT 5.48 - WEEKLY RATE MIGRATION VALIDATION
