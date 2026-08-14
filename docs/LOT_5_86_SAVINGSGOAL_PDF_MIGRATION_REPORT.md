# LOT 5.86A - SavingsGoal PDF Migration Report

## 1. Executive Summary

LOT 5.86A migrated exactly one PDF/export consumer:

```txt
handleExportPDF -> Projection -> Objectif d epargne percentage denominator
```

The denominator now reads the Shadow-backed visible slice through a strict local alias:

```js
const pdfSavingsGoal = Math.max(
  fiscalSummaryVisibleSlice.finalContributionAmount * 3,
  500,
);
```

Result:

```txt
PASS - targeted migration implemented and validated.
```

## 2. Scope

Modified:

- `src/App.jsx`
- `tests/lot-5-82-savingsgoal-coaching-stabilization.test.js`
- `tests/lot-5-84-savingsgoal-pdf-parity-evidence.test.js`

Created:

- `tests/lot-5-86-savingsgoal-pdf-migration.test.js`
- `docs/LOT_5_86_SAVINGSGOAL_PDF_MIGRATION_REPORT.md`

No Adapter, Facade, Rules Engine, Domain, persistence, Supabase, localStorage, payload, assistant, analytics payload, feature flag or PDF layout was changed.

## 3. Consumer Before

Before LOT 5.86A:

```js
typeof savingsGoal !== "undefined" && savingsGoal > 0
  ? `${Math.round((savingsProgress / savingsGoal) * 100 || 0)}%`
  : "Pas encore assez de donnees"
```

The numerator was `savingsProgress`. The denominator was root Legacy `savingsGoal`.

## 4. Consumer After

After LOT 5.86A:

```js
typeof pdfSavingsGoal !== "undefined" && pdfSavingsGoal > 0
  ? `${Math.round((savingsProgress / pdfSavingsGoal) * 100 || 0)}%`
  : "Pas encore assez de donnees"
```

Only the denominator source changed.

## 5. Denominator Contract

The migrated denominator is exactly:

```js
Math.max(
  fiscalSummaryVisibleSlice.finalContributionAmount * 3,
  500,
)
```

No fallback, rounding, formatter, cap or persistence was added to the alias.

## 6. Ratio Integrity

Preserved:

- numerator: `savingsProgress`
- division: `savingsProgress / denominator`
- multiplier: `* 100`
- operation order

Only `savingsGoal` became `pdfSavingsGoal` in the denominator position.

## 7. Fallback Integrity

Fallback text remains:

```txt
Pas encore assez de donnees
```

The positive-denominator guard remains structurally identical and now checks `pdfSavingsGoal`.

## 8. Rounding Integrity

Rounding remains:

```js
Math.round((savingsProgress / pdfSavingsGoal) * 100 || 0)
```

No `Math.floor`, `Math.ceil`, `toFixed`, locale formatter or tolerance was introduced.

## 9. No-Cap Integrity

No `Math.min(100, ...)` cap was added.

Guarded examples:

```txt
101%
125%
201%
```

remain allowed by the ratio contract.

## 10. Formatter / Output Integrity

Preserved:

- label: `Objectif d epargne`
- formatter: trailing `%`
- no extra space before `%`
- `Projection` box
- `3. Analyse` section
- filename pattern: `rapport_microassist_*.pdf`
- download behavior: `doc.save(...)`

## 11. Root SavingsGoal Retention

Root `savingsGoal` remains Legacy:

```js
const savingsGoal = useMemo(() => {
  return Math.max(estimatedCharges * 3, 500);
}, [estimatedCharges]);
```

It was not deleted, migrated, or globally replaced.

## 12. Other PDF Outputs Isolation

Unchanged PDF outputs include:

- `Projection annuelle`
- `Taux estime`
- profile lines
- monthly summary lines
- fiscal reference lines
- action lines
- revenue history table
- export analytics payload

## 13. Feature Flag

No new feature flag was created.

The migrated source reuses:

```js
fiscalSummaryVisibleSlice.finalContributionAmount
```

Therefore the existing visible-slice selector still controls Shadow/Legacy behavior.

## 14. No Propagation

No propagation to:

- coaching
- other PDF outputs
- assistant
- persistence
- payloads
- feedback
- analytics
- smart alerts
- invoices
- reminders
- weekly recap

The coaching denominator remains separately guarded as `fiscalCoachingSavingsGoal`.

## 15. Shadow Baseline 14 -> 15

Before LOT 5.86A:

```txt
fiscalSummaryVisibleSlice = 14
```

After LOT 5.86A:

```txt
fiscalSummaryVisibleSlice = 15
```

The new occurrence is the PDF denominator alias.

## 16. Fifteenth Consumer Signature

Approved fifteenth occurrence:

```js
const pdfSavingsGoal = Math.max(
  fiscalSummaryVisibleSlice.finalContributionAmount * 3,
  500,
);
```

The PDF line uses `pdfSavingsGoal`; the export callback does not directly read `fiscalSummaryVisibleSlice`.

## 17. No Sixteenth Occurrence

Targeted guards assert:

```txt
fiscalSummaryVisibleSlice = 15
appWithoutVisibleSlice fiscalSummaryVisibleSlice = 14
pdfSavingsGoal = 5
savingsGoal = 1
```

No sixteenth `fiscalSummaryVisibleSlice` occurrence was added.

## 18. Targeted Tests

Executed:

```txt
node --test tests/lot-5-86-savingsgoal-pdf-migration.test.js
node --test tests/lot-5-84-savingsgoal-pdf-parity-evidence.test.js
node --test tests/lot-5-82-savingsgoal-coaching-stabilization.test.js
node --test tests/shadow-parity-validation.test.js
node --test tests/runtime-parity-evidence.test.js
npx eslint tests/lot-5-86-savingsgoal-pdf-migration.test.js
```

Results:

```txt
PASS - 5.86A migration test: 11/11
PASS - 5.84 PDF parity evidence: 18/18
PASS - 5.82 coaching stabilization: 17/17
PASS - shadow parity validation: 6/6
PASS - runtime parity evidence: 11/11
PASS - eslint targeted file
```

Note: the first sandboxed `node --test` run hit the known `spawn EPERM` condition, then the exact command was relaunched outside the sandbox with approval.

## 19. Rollback

Rollback is local:

```txt
src/App.jsx -> handleExportPDF -> Objectif d epargne denominator
```

Rollback action:

```txt
pdfSavingsGoal -> savingsGoal
```

No data migration, PDF layout change, Adapter change, Facade change, Rules Engine change, assistant change or payload cleanup is required.

## 20. Risks

Residual risks:

- full application validation has not run in this LOT by instruction;
- real browser/PDF rendering was not re-run in this lightweight validation;
- root `savingsGoal` remains intentionally retained until final dependency review.

Mitigations:

- source-level PDF contract guards were added;
- historical guards were updated to baseline 15;
- parity/runtime evidence remains green.

## 21. Final Decision

GO POUR LOT 5.86B — FULL MIGRATION VALIDATION

## 22. FULL MIGRATION VALIDATION

### 1. Pre-Test Integrity Check

PASS by source inspection and targeted guard:

- `pdfSavingsGoal` is exactly `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)`;
- `handleExportPDF -> Objectif d epargne` uses `pdfSavingsGoal`;
- direct `savingsGoal` is no longer the denominator in that PDF consumer;
- root `savingsGoal` remains Legacy and unchanged;
- `savingsProgress` remains unchanged;
- ratio, `Math.round`, fallback, `%` formatter and no-cap behavior remain unchanged;
- baseline guard remains `fiscalSummaryVisibleSlice = 15`;
- targeted LOT 5.86A test remains PASS: `11/11`.

### 2. Full Node Suite

Command:

```txt
node --test
```

Sandbox result:

```txt
FAIL - spawn EPERM
```

The exact command was relaunched outside the sandbox with approval.

Outside-sandbox result:

```txt
FAIL
```

Observed failures include historical guard failures after the PDF migration, including guards that still expect the pre-5.86 PDF Legacy shape or earlier approved counts. Examples surfaced in the output:

- `LOT 5.18 blocks unapproved new Legacy consumers with a deterministic reference count guard`;
- `LOT 5.20 does not add a flag, state, effect, Adapter execution or Facade execution`;
- `LOT 5.21 validates no new state, effect, Adapter or Facade execution`;
- `LOT 5.22 keeps React counts, Adapter execution and Facade execution stable`;
- `LOT 5.81 validates PDF export remains Legacy`, which still expects `typeof savingsGoal !== "undefined" && savingsGoal > 0`.

Per LOT 5.86B stop conditions, no correction was applied.

### 3. Build

Not run.

Reason:

```txt
STOP after full node suite failure.
```

### 4. Global Lint

Not run.

Reason:

```txt
STOP after full node suite failure.
```

### 5. Targeted ESLint

Not run in LOT 5.86B.

Previous LOT 5.86A targeted ESLint was PASS.

Reason:

```txt
STOP after full node suite failure.
```

### 6. Playwright Run 1

Not run.

Reason:

```txt
STOP after full node suite failure.
```

### 7. Playwright Run 2

Not run.

Reason:

```txt
STOP after full node suite failure.
```

### 8. Shadow Baseline = 15

PASS in targeted guard:

```txt
fiscalSummaryVisibleSlice = 15
```

### 9. No 16th Occurrence

PASS in targeted guard:

```txt
No sixteenth fiscalSummaryVisibleSlice occurrence in LOT 5.86A guard.
```

### 10. PDF Ratio Integrity

PASS in source inspection and targeted guard:

```js
Math.round((savingsProgress / pdfSavingsGoal) * 100 || 0)
```

### 11. Fallback Integrity

PASS:

```txt
Pas encore assez de donnees
```

The source retains the existing French fallback text with accents.

### 12. Rounding Integrity

PASS:

```txt
Math.round unchanged
```

### 13. No-Cap Integrity

PASS:

```txt
No Math.min(100, ...) in the targeted PDF percentage consumer.
```

### 14. Formatter / Output Integrity

PASS:

- label remains `Objectif d epargne`;
- formatter remains trailing `%`;
- PDF layout remains unchanged in the targeted source block.

### 15. Root SavingsGoal Retention

PASS:

```js
const savingsGoal = useMemo(() => {
  return Math.max(estimatedCharges * 3, 500);
}, [estimatedCharges]);
```

### 16. Other PDF Outputs Isolation

PASS by source inspection:

- `Projection annuelle` unchanged;
- `Taux estime` unchanged;
- other PDF sections and export filename unchanged.

### 17. Persistence / Payload / Assistant Isolation

PASS in targeted guard:

- assistant isolated;
- persistence isolated;
- feedback/payload-like context isolated;
- export analytics payload unchanged.

### 18. Rollback

Rollback remains local:

```txt
pdfSavingsGoal -> savingsGoal
```

Only in:

```txt
handleExportPDF -> Objectif d epargne percentage denominator
```

### 19. Scope Control

No application code was modified during LOT 5.86B.

Only this report section was appended after the full validation failure.

### 20. Final Decision

NO-GO POUR LOT 5.87
