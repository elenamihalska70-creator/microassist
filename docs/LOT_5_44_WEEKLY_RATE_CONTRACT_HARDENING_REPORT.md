# LOT 5.44 - Weekly Rate Contract Hardening Report

## 1. Executive Summary

LOT 5.44 hardened the weekly recap rate contract without migrating the visible consumer.

Created:

- `src/application/weekly/resolveWeeklyEstimatedRate.js`
- `tests/lot-5-44-weekly-rate-contract-hardening.test.js`
- `docs/LOT_5_44_WEEKLY_RATE_CONTRACT_HARDENING_REPORT.md`

No `src/App.jsx` change was made. The dashboard weekly recap still uses its Legacy source:

```jsx
computed?.rate || getEstimatedRate(dashboardAnswers.activity_type)
```

The hardened future contract is:

```jsx
resolveWeeklyEstimatedRate({
  effectiveRate: fiscalSummaryVisibleSlice.effectiveRate,
  legacyFallbackRate: getEstimatedRate(dashboardAnswers.activity_type),
})
```

The helper only preserves `effectiveRate || legacyFallbackRate`. It contains no rate, mapping, formula, date, React, persistence, Rules, ACRE or UI behavior.

## 2. Current Legacy Contract

Current visible weekly recap source:

```jsx
const estimatedRate =
  computed?.rate || getEstimatedRate(dashboardAnswers.activity_type);
```

Semantics:

- positive `computed.rate` wins;
- `0` falls back;
- `null` falls back;
- `undefined` falls back;
- fallback remains the historical `getEstimatedRate(...)` path;
- no weekly formula, labels, invoice logic or reminder logic were changed.

## 3. Shadow Contract

Current visible slice field:

```jsx
effectiveRate: usesShadow
  ? shadowResult.summary.effectiveRate
  : computed?.rate
```

Raw Shadow/domain semantics preserve zero-rate cases. LOT 5.43 showed that raw `fiscalSummaryVisibleSlice.effectiveRate` alone is not safe for this weekly UI consumer because the Legacy weekly path historically uses `||`.

## 4. Hardened Contract

Helper:

```js
resolveWeeklyEstimatedRate({
  effectiveRate,
  legacyFallbackRate,
})
```

Implementation:

```js
return effectiveRate || legacyFallbackRate;
```

This formalizes:

```txt
Shadow/selected effective rate first, Legacy fallback second, with exact || semantics.
```

No business logic was added.

## 5. Zero Semantics

`effectiveRate = 0` falls back:

```txt
0 || legacyFallbackRate -> legacyFallbackRate
```

This intentionally preserves the current Legacy weekly behavior.

## 6. Null / Undefined Semantics

`null` and `undefined` fall back:

```txt
null || legacyFallbackRate -> legacyFallbackRate
undefined || legacyFallbackRate -> legacyFallbackRate
```

No `??` semantics were introduced.

## 7. Unknown Activity Semantics

The helper does not know activity mappings.

Unknown activity behavior is preserved by injecting the Legacy fallback rate produced outside the helper:

```txt
legacyFallbackRate = getEstimatedRate(activity_type)
```

Thus unknown activity keeps the historical weekly UI fallback contract.

## 8. Missing Activity Semantics

Missing activity follows the same injected fallback path. The helper does not normalize missing activity and does not decide a default rate itself.

## 9. Helper Architecture

Location:

```txt
src/application/weekly/resolveWeeklyEstimatedRate.js
```

Reason:

- weekly recap is application/UI-facing behavior;
- the helper is an application contract boundary, not a domain fiscal rule;
- it avoids adding rates or mappings to the domain layer;
- it can be tested independently from React and `App.jsx`.

## 10. Business Logic Guard

The helper contains no:

- hard-coded rate;
- activity switch;
- rounding;
- multiplication;
- division;
- ACRE rule;
- TVA rule;
- date;
- fallback invention;
- React hook;
- persistence/network access.

It only orchestrates:

```txt
effectiveRate || legacyFallbackRate
```

## 11. Weekly Context Isolation

The hardened contract does not depend on:

- week start;
- current day;
- invoices;
- reminders;
- `visibleInvoices`;
- overdue status;
- UI state.

The weekly date/invoice/reminder recap remains out of the rate contract.

## 12. Parity Results

The hardened contract reproduced Legacy weekly rate source on all approved scenarios:

- positive primary rate;
- primary `0`;
- primary `null`;
- primary `undefined`;
- fallback positive;
- fallback `0`;
- services;
- commerce;
- mixte;
- unknown activity;
- missing activity;
- ACRE inactive;
- ACRE active;
- same input;
- cloned input.

## 13. Intentional Mismatch

The test preserves mismatch detection by injecting an intentionally wrong fallback:

```txt
Legacy: 0.22
Hardened: 0.123
Result: MISMATCH
```

No correction or normalization is performed.

## 14. Determinism

Validated:

- same input twice;
- cloned input;
- no input mutation;
- no implicit time;
- no React;
- no persistence;
- no weekly context dependency.

## 15. Scope Control

Confirmed:

- no `src/App.jsx` modification;
- no visible weekly recap migration;
- no new visible Shadow read;
- no formula change;
- no rate change;
- no fallback change;
- no mapping change;
- no Rules Engine change;
- no Adapter/Facade/Domain Model change;
- no persistence/payload/assistant/export change;
- Legacy remains compatibility layer.

Current App baseline remains guarded by the test:

```txt
fiscalSummaryVisibleSlice = 8
fiscalSummaryVisibleSlice.effectiveRate consumers outside selector = 0
```

## 16. Validation

Initial sandbox run:

```bash
node --test tests/lot-5-44-weekly-rate-contract-hardening.test.js
```

Sandbox result:

```text
FAIL - spawn EPERM
```

The same command was rerun outside sandbox with the approved `node --test` prefix.

Final targeted validation:

```bash
node --test tests/lot-5-44-weekly-rate-contract-hardening.test.js
```

```text
tests 13
suites 0
pass 13
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 164.1167
```

```bash
node --test tests/lot-5-42-weekly-recap-effective-rate-parity-evidence.test.js
```

```text
tests 15
suites 0
pass 15
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 158.6737
```

```bash
node --test tests/shadow-parity-validation.test.js
```

```text
tests 6
suites 0
pass 6
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 125.6608
```

```bash
node --test tests/runtime-parity-evidence.test.js
```

```text
tests 11
suites 0
pass 11
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 205.8487
```

```bash
npx eslint tests/lot-5-44-weekly-rate-contract-hardening.test.js src/application/weekly/resolveWeeklyEstimatedRate.js
```

```text
PASS - no output
```

Not run by scope:

- full `node --test`;
- build;
- global lint;
- Playwright.

## 17. Risks

Remaining risks:

- the visible weekly recap is not migrated yet;
- a future migration will add a 9th `fiscalSummaryVisibleSlice` occurrence and must update guards intentionally;
- future implementation must inject `getEstimatedRate(dashboardAnswers.activity_type)` as the fallback and must not inline new rate logic.

No risk blocks a migration gate review.

## 18. Recommended Next LOT

Recommended next lot:

```txt
LOT 5.45 - Weekly Rate Migration Gate Review
```

Purpose:

- decide whether the visible weekly recap can migrate from Legacy source to the hardened contract;
- keep migration decision separate from contract hardening;
- define exact source replacement and guard updates before implementation.

## 19. Final Decision

GO POUR LOT 5.45 — WEEKLY RATE MIGRATION GATE REVIEW
