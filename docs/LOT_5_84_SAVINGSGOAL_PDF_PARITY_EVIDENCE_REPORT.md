# LOT 5.84 - SavingsGoal PDF Parity Evidence Report

## 1. Executive Summary

LOT 5.84 produced deterministic parity evidence for the PDF/export `Objectif d epargne` percentage consumer.

Created files:

- `tests/lot-5-84-savingsgoal-pdf-parity-evidence.test.js`
- `docs/LOT_5_84_SAVINGSGOAL_PDF_PARITY_EVIDENCE_REPORT.md`

No runtime code, `src/App.jsx`, PDF/export output, root `savingsGoal`, feature flag, Adapter, Facade, Domain, Rules Engine, persistence, payload, assistant, feedback, analytics or historical guard was modified.

Result:

```txt
PDF/export Objectif d epargne percentage evidence PASS.
Consumer classification: READY for migration gate review.
```

## 2. PDF Consumer Scope

Exact consumer:

```txt
src/App.jsx -> handleExportPDF -> 3. Analyse -> Projection -> Objectif d epargne
```

Current exported line:

```js
`Objectif d epargne : ${
  typeof savingsGoal !== "undefined" && savingsGoal > 0
    ? `${Math.round((savingsProgress / savingsGoal) * 100 || 0)}%`
    : "Pas encore assez de données"
}`
```

This LOT measures that consumer only.

## 3. Numerator Contract

Numerator:

```txt
savingsProgress
```

Current source:

```js
const savingsProgress = useMemo(() => {
  return availableAmount;
}, [availableAmount]);
```

Contract:

- unit: euros;
- source status: Legacy-derived;
- upstream: `availableAmount`;
- no rounding inside `savingsProgress`;
- no Shadow replacement in LOT 5.84.

## 4. Legacy Denominator Contract

Legacy denominator:

```txt
savingsGoal
```

Root:

```js
const savingsGoal = useMemo(() => {
  return Math.max(estimatedCharges * 3, 500);
}, [estimatedCharges]);
```

Contract:

- `Math.max`;
- multiplier `* 3`;
- minimum `500`;
- no direct rounding inside the root;
- inherits `estimatedCharges`.

## 5. Shadow Denominator Candidate

Candidate denominator for a future migration:

```js
Math.max(
  fiscalSummaryVisibleSlice.finalContributionAmount * 3,
  500,
)
```

Amount parity is already supported by prior UI/coaching evidence and is rechecked in this LOT for the PDF ratio context.

## 6. Legacy Ratio Formula

Exact current formula:

```js
Math.round((savingsProgress / savingsGoal) * 100 || 0)
```

The formula is inside a positive denominator guard:

```js
typeof savingsGoal !== "undefined" && savingsGoal > 0
```

## 7. Fallback Contract

Fallback output:

```txt
Pas encore assez de données
```

Fallback is selected when:

```txt
typeof savingsGoal === "undefined" or savingsGoal <= 0
```

When `savingsProgress = 0` and `savingsGoal > 0`, the exported value is:

```txt
0%
```

No Shadow-specific fallback was invented.

## 8. Rounding Contract

Rounding:

```txt
Math.round
```

Order:

```txt
(savingsProgress / savingsGoal) * 100
then Math.round(...)
then "% " is not added; only "%" is appended
```

There is no `Math.floor`, `Math.ceil`, `toFixed`, locale formatter or tolerance.

## 9. No-Cap Contract

Confirmed:

```txt
PDF/export does not use Math.min(100, ...)
```

Validated no-cap examples:

| Scenario | Output |
| --- | --- |
| 99% | `99%` |
| 100% | `100%` |
| 101% | `101%` |
| 125% | `125%` |
| > 200% | `201%` |

The future candidate must preserve this behavior and must not add a cap.

## 10. Formatter Contract

Formatter:

```txt
number -> string with trailing "%"
```

There is:

- no locale formatting;
- no extra space before `%`;
- no `toFixed`;
- no `Intl.NumberFormat`;
- fallback text only when the denominator guard fails.

## 11. Scenario Matrix

Covered:

| Scenario | Result |
| --- | --- |
| `savingsProgress = 0` | parity |
| low `savingsProgress` | parity |
| `savingsProgress = denominator / 2` | parity |
| `savingsProgress = denominator` | parity |
| `savingsProgress > denominator` | parity |
| 99% | parity |
| 100% | parity |
| 101% | parity |
| 125% | parity |
| denominator minimum `500` | parity |
| denominator above `500` | parity |
| `finalContributionAmount = 0` | parity |
| positive `finalContributionAmount` | parity |
| ACRE inactive | parity |
| ACRE active | parity |
| same input twice | deterministic |
| cloned input | deterministic |

## 12. Ratio Parity

The test compares:

```txt
Legacy ratio = savingsProgress / savingsGoal
Shadow candidate ratio = savingsProgress / Math.max(finalContributionAmount * 3, 500)
```

The numerator remains exactly the same `savingsProgress`.

Result:

```txt
strict ratio parity PASS
```

## 13. Rounding Boundary Parity

Boundary scenarios:

| Scenario | Output |
| --- | --- |
| 49.49% | `49%` |
| 49.50% | `50%` |
| 49.51% | `50%` |

Legacy and Shadow candidate values match strictly for raw ratio, rounded value and formatted output.

## 14. Formatted Output Parity

The formatted output matches strictly across approved scenarios.

Examples:

| Scenario | Output |
| --- | --- |
| zero progress | `0%` |
| half progress | `50%` |
| denominator reached | `100%` |
| above denominator | `101%`, `125%`, `201%` |

No hidden normalization or tolerance was introduced.

## 15. ACRE Assessment

ACRE inactive:

```txt
revenue 1000, services, ACRE no
Legacy estimatedCharges = 220
Shadow finalContributionAmount = 220
effectiveRate = 0.22
acreStatus = inactive
PDF denominator = 660
```

ACRE active:

```txt
revenue 1000, services, ACRE yes, start 2026-01-15
Legacy estimatedCharges = 110
Shadow finalContributionAmount = 110
effectiveRate = 0.11
acreStatus = active
PDF denominator = 500
```

Result:

```txt
ACRE PDF denominator, ratio, rounded value and formatted output parity PASS.
```

## 16. Intentional Mismatch

Intentional mismatch:

```txt
savingsProgress = 500
Legacy charges = 220 -> denominator 660 -> 76%
Shadow candidate finalContributionAmount = 110 -> denominator 500 -> 100%
```

Detected:

- denominator mismatch;
- ratio mismatch;
- rounded output mismatch;
- formatted output mismatch.

No automatic correction, fallback or tolerance masked the mismatch.

## 17. Feature Flag

Existing visible-slice contract remains:

```txt
Flag ON + Shadow result -> shadowResult.summary.finalContributionAmount
Flag OFF or no Shadow result -> estimatedCharges
```

LOT 5.84 creates no new flag and no persisted flag.

## 18. Root SavingsGoal Retention

Root `savingsGoal` remains Legacy and unchanged.

Even with this PDF percentage parity evidence, LOT 5.84 does not authorize removing the root. Root removal needs its own final dependency review after every direct and dependency consumer is handled.

## 19. PDF Output Isolation

Confirmed unchanged:

- PDF structure;
- `3. Analyse` section;
- `Projection` box;
- `Objectif d epargne` label;
- formula;
- fallback;
- rounding;
- formatter;
- file generation;
- download behavior;
- export analytics payload.

## 20. Persistence / Payload / Assistant Isolation

No propagation found to:

- Supabase;
- `localStorage`;
- `sessionStorage`;
- payloads;
- assistant;
- feedback;
- analytics fields.

The `export_pdf` analytics event still contains only:

```txt
source, totalRevenues, invoiceCount
```

## 21. Determinism

Evidence properties:

- pure helpers;
- same input -> same output;
- cloned input -> same output;
- no mutation;
- no `Date.now`;
- no implicit `new Date`;
- no `Math.random`;
- no network;
- no persistence.

The domain Shadow checks use a fixed `referenceDate`.

## 22. Migration Readiness

Classification:

```txt
READY
```

Reason:

- denominator parity proved;
- ratio parity proved;
- rounding parity proved;
- no-cap parity proved;
- formatted output parity proved;
- fallback contract identified;
- intentional mismatch detected;
- rollback is local to the PDF expression;
- no persistence, payload or assistant coupling found.

This does not mean the migration is authorized in LOT 5.84. It means the next step should be a migration gate review.

## 23. Risks

| Risk | Level | Mitigation |
| --- | --- | --- |
| exported PDF value changes silently | medium | gate review before implementation |
| future migration accidentally caps at 100 | high | no-cap evidence guard |
| root removed too early | high | root retention remains required |
| formatter drift | medium | formatted output parity guard |
| hidden mismatch masked | medium | intentional mismatch guard |

No real mismatch was found in the approved evidence scenarios.

## 24. Recommended Next LOT

Recommended next LOT:

```txt
GO POUR LOT 5.85 — SAVINGSGOAL PDF MIGRATION GATE REVIEW
```

Scope should remain documentation-only and decide whether the single PDF/export percentage consumer can be migrated source-only.

## 25. Final Decision

GO POUR LOT 5.85 — SAVINGSGOAL PDF MIGRATION GATE REVIEW
