# LOT 5.56 - Monthly Reflection Charges Migration Report

## 1. Executive Summary

LOT 5.56A migrated the dashboard monthly reflection charges amount from the Legacy direct read to the approved visible Shadow slice.

Created:

- `tests/lot-5-56-monthly-reflection-charges-migration.test.js`
- `docs/LOT_5_56_MONTHLY_REFLECTION_CHARGES_MIGRATION_REPORT.md`

Updated targeted historical guards to accept the approved eleventh `fiscalSummaryVisibleSlice` occurrence.

Result:

```txt
Targeted migration PASS.
```

## 2. Scope

Migrated consumer:

```txt
Dashboard monthly reflection - charges amount in the month summary text
```

Only the charges amount source in the monthly reflection text was in scope.

Out of scope and unchanged by this lot:

- business calculation rules;
- text wording;
- locale and money formatting;
- feature flag behavior;
- coaching;
- PDF export;
- assistant guidance;
- persistence;
- payloads;
- weekly rate behavior;
- savings goal behavior.

## 3. Consumer Before

The approved pre-migration source was:

```jsx
estimatedCharges.toLocaleString("fr-FR")
```

This was a direct Legacy read inside the monthly reflection summary text.

## 4. Consumer After

The monthly reflection charges amount now reads from:

```jsx
monthlyReflectionChargesAmount.toLocaleString("fr-FR")
```

The sentence still keeps the same wording, punctuation, invoice label and helper behavior.

## 5. Alias Boundary

The migration introduces one local monthly reflection alias:

```jsx
const monthlyReflectionChargesAmount =
  fiscalSummaryVisibleSlice.finalContributionAmount;
```

The alias is scoped beside the existing monthly reflection revenue alias and consumed only by the monthly reflection block and its dependency list.

## 6. Charges Source

The source is the existing visible slice:

```jsx
fiscalSummaryVisibleSlice.finalContributionAmount
```

No new calculation was introduced. No alternate local fallback was added.

## 7. Formatting Integrity

Confirmed unchanged:

- `.toLocaleString("fr-FR")`;
- locale `"fr-FR"`;
- no `Math.round`;
- no `Number(...)`;
- no `Intl.NumberFormat`;
- no `getDisplayValue`;
- no extra fallback.

## 8. Text Integrity

Confirmed unchanged around the migrated value:

```txt
Tu as enregistré ... € de revenus, prévu ... € de charges et créé ...
```

The already migrated revenue amount remains sourced by:

```jsx
monthlyReflectionRevenueTotal.toLocaleString("fr-FR")
```

## 9. Feature Flag

No new feature flag was added.

The existing slice remains the only feature-flag boundary:

```jsx
FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED
```

With the flag ON, the monthly reflection charges amount follows Shadow through the slice. With the flag OFF, it follows the Legacy fallback already owned by the slice.

## 10. Legacy estimatedCharges Retention

`estimatedCharges` remains retained for approved Legacy roles outside the migrated monthly reflection amount.

Confirmed retained boundaries include savings goal, coaching, PDF and approved non-migrated consumers. The monthly reflection text no longer directly calls:

```jsx
estimatedCharges.toLocaleString("fr-FR")
```

## 11. Coaching / PDF Isolation

Confirmed no migration propagation into:

- `fiscalCoachingCard`;
- `savingsGoal`;
- `savingsProgress`;
- PDF export;
- assistant guidance;
- persistence.

The Legacy savings goal and coaching boundaries remain explicit.

## 12. No Propagation

The migration did not alter adjacent consumers:

- weekly recap;
- dashboard charges display;
- URSSAF declaration helper;
- objective epargne progress;
- revenue monthly reflection amount;
- invoices and reminders;
- runtime parity evidence collection.

## 13. Shadow Baseline 10 -> 11

The approved Shadow visible-slice baseline changes from 10 to 11 because one new consumer now reads the existing visible slice.

Confirmed:

```txt
fiscalSummaryVisibleSlice = 11
```

## 14. Eleventh Consumer Signature

The eleventh occurrence is exactly:

```jsx
const monthlyReflectionChargesAmount =
  fiscalSummaryVisibleSlice.finalContributionAmount;
```

This matches the consumer selected by LOT 5.55.

## 15. No Twelfth Occurrence

Targeted tests confirm there is no twelfth `fiscalSummaryVisibleSlice` occurrence and no duplicate charges alias.

Confirmed counts:

```txt
monthlyReflectionChargesAmount assignment = 1
monthlyReflectionChargesAmount references = 3
```

## 16. Targeted Tests

Executed and passed:

```txt
node --test tests/lot-5-56-monthly-reflection-charges-migration.test.js
```

Executed and passed:

```txt
node --test tests/lot-5-56-monthly-reflection-charges-migration.test.js tests/lot-5-54-monthly-reflection-revenue-stabilization.test.js tests/lot-5-53-monthly-reflection-revenue-migration-validation.test.js tests/shadow-parity-validation.test.js tests/runtime-parity-evidence.test.js tests/lot-5-49-weekly-rate-stabilization.test.js
```

Result:

```txt
tests 64
pass 64
fail 0
```

Executed and passed:

```txt
npx eslint tests/lot-5-56-monthly-reflection-charges-migration.test.js
```

Note: `node --test` was executed outside the sandbox after the sandbox runner failed with `spawn EPERM`.

## 17. Rollback

Rollback is local:

```jsx
monthlyReflectionChargesAmount.toLocaleString("fr-FR")
```

can be reverted to:

```jsx
estimatedCharges.toLocaleString("fr-FR")
```

and the local alias plus guard baseline can be removed or restored to the previous count.

## 18. Risks

Residual risks are limited to later full-suite validation:

- broad UI snapshots were not executed in this lot;
- full build was not executed in this lot;
- Playwright was not executed in this lot.

These exclusions match the LOT 5.56A brief.

## 19. Final Decision

```txt
GO POUR LOT 5.56B — FULL MIGRATION VALIDATION
```
