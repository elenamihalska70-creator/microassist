# LOT 5.85 - SavingsGoal PDF Migration Gate Review

## 1. Executive Summary

LOT 5.85 is a documentation-only migration gate review for the single PDF/export consumer:

```txt
handleExportPDF -> Projection -> Objectif d epargne percentage
```

No runtime code, `src/App.jsx`, PDF/export output, root `savingsGoal`, tests, Adapter, Facade, Domain, Rules Engine, feature flag, persistence, payload, assistant, feedback or analytics path was modified.

Gate result:

```txt
READY for source-only migration implementation.
```

Recommended next LOT:

```txt
GO POUR LOT 5.86 — SAVINGSGOAL PDF MIGRATION IMPLEMENTATION
```

## 2. Source and Authority

Authority documents read:

- `docs/LOT_5_75_SAVINGSGOAL_DEPENDENCY_ANALYSIS.md`
- `docs/LOT_5_76_SAVINGSGOAL_CONTRACT_HARDENING_REPORT.md`
- `docs/LOT_5_83_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md`
- `docs/LOT_5_84_SAVINGSGOAL_PDF_PARITY_EVIDENCE_REPORT.md`
- `docs/LOT_5_82_SAVINGSGOAL_COACHING_STABILIZATION_REPORT.md`

Inspected:

- `src/App.jsx`
- PDF/export block
- Objectif d epargne percentage output
- `savingsProgress`
- `savingsGoal`
- ratio formula
- fallback
- rounding
- formatter `%`
- labels and export structure
- `fiscalSummaryVisibleSlice.finalContributionAmount`
- feature flag selector
- parity/runtime evidence status

## 3. Consumer Exact

Authorized future consumer:

```txt
src/App.jsx -> handleExportPDF -> drawBox("Projection") -> Objectif d epargne
```

Current Legacy output:

```js
`Objectif d epargne : ${
  typeof savingsGoal !== "undefined" && savingsGoal > 0
    ? `${Math.round((savingsProgress / savingsGoal) * 100 || 0)}%`
    : "Pas encore assez de données"
}`
```

Consumer inventory:

| Field | Value |
| --- | --- |
| file | `src/App.jsx` |
| function | `handleExportPDF` |
| PDF section | `3. Analyse` |
| box | `Projection` |
| label | `Objectif d epargne` |
| output | percentage string |
| numerator | `savingsProgress` |
| denominator | `savingsGoal` |
| fallback | `Pas encore assez de données` |
| rounding | `Math.round(...)` |
| formatter | trailing `%` |
| cap | none |

No other PDF output is authorized.

## 4. Legacy Contract

Exact Legacy ratio formula:

```js
Math.round((savingsProgress / savingsGoal) * 100 || 0)
```

Guard:

```js
typeof savingsGoal !== "undefined" && savingsGoal > 0
```

Formatter:

```txt
`${roundedValue}%`
```

The PDF contract intentionally has no `Math.min(100, ...)` cap.

## 5. Target Shadow Contract

Approved future denominator:

```js
Math.max(
  fiscalSummaryVisibleSlice.finalContributionAmount * 3,
  500,
)
```

The future migration must keep:

- numerator `savingsProgress`;
- ratio structure;
- positive denominator guard;
- `Math.round`;
- `|| 0`;
- `%` formatter;
- fallback text;
- no cap.

## 6. Parity Review

LOT 5.84 evidence result:

```txt
PASS - 18/18
Consumer classification: READY
```

Confirmed:

- denominator parity;
- ratio parity;
- rounding parity;
- formatter parity;
- fallback parity;
- 99%, 100%, 101%, 125% and >200% no-cap behavior;
- intentional denominator/ratio/rounded/formatted mismatch detection;
- same input determinism;
- cloned input determinism;
- immutability;
- no persistence, payload or assistant coupling.

Gate classification:

```txt
READY
```

## 7. Source-Only Requirement

Future implementation must be source-only.

Allowed conceptual replacement:

```txt
savingsGoal
-> Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)
```

An alias is allowed only if it is local, strict and equivalent, for example:

```js
const pdfSavingsGoal = Math.max(
  fiscalSummaryVisibleSlice.finalContributionAmount * 3,
  500,
);
```

Forbidden:

- changing `savingsProgress`;
- changing the ratio;
- changing rounding;
- changing fallback;
- changing formatter;
- adding `Math.min(100, ...)`;
- changing label;
- changing output structure;
- migrating another PDF metric;
- replacing global `savingsGoal`.

## 8. Root SavingsGoal Retention

Root `savingsGoal` remains Legacy after the future migration.

Current root:

```js
const savingsGoal = useMemo(() => {
  return Math.max(estimatedCharges * 3, 500);
}, [estimatedCharges]);
```

The future PDF percentage migration does not authorize:

- deleting `savingsGoal`;
- replacing it globally;
- migrating persistence, payload or assistant paths;
- migrating other PDF outputs.

Root removal requires a separate final dependency review after all direct and dependency reads are handled.

## 9. No-Cap Guard

The future migration must preserve no-cap behavior.

Confirmed current PDF outputs may exceed `100%`:

```txt
101%
125%
201%
```

The future Shadow-backed denominator must allow the same values. Adding `Math.min(100, ...)` would block the migration.

## 10. Fallback / Rounding Guard

Future migration must keep:

- fallback text: `Pas encore assez de données`;
- denominator guard: positive and defined;
- `Math.round`;
- operation order: `(savingsProgress / denominator) * 100`;
- inner fallback: `|| 0`;
- string conversion via template literal;
- suffix: `%`.

No `Math.floor`, `Math.ceil`, `toFixed`, locale formatter or tolerance is authorized.

## 11. PDF Structure Isolation

Future migration requires no change to:

- PDF layout;
- section order;
- labels;
- `Projection` box;
- other exported metrics;
- file generation;
- download behavior;
- export filename.

The PDF generation and export tracking path remain outside the migration scope.

## 12. Feature Flag

Future migration can reuse the existing visible-slice selector:

```js
const usesShadow =
  FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED &&
  Boolean(shadowResult);
```

Behavior:

```txt
Flag ON + Shadow result -> finalContributionAmount from Shadow
Flag OFF or missing Shadow result -> estimatedCharges through the selector
```

No new flag is authorized.

## 13. Shadow Baseline

Current baseline:

```txt
fiscalSummaryVisibleSlice = 14
```

Future implementation expected baseline:

```txt
14 -> 15
```

The 15th occurrence must correspond exactly to:

```txt
PDF/export Objectif d epargne percentage denominator
```

No 16th occurrence is authorized.

LOT 5.85 adds no Shadow read.

## 14. React / State

Future migration must not require:

- new `useState`;
- new `useEffect`;
- unnecessary `useMemo`;
- new Context;
- new business helper;
- second Adapter call;
- second Facade call.

The only expected React-related adjustment is the `handleExportPDF` callback dependency list if the expression no longer reads `savingsGoal` and reads a local PDF denominator or visible-slice field instead.

## 15. Persistence / Payload / Assistant

Future migration must not change:

- Supabase;
- `localStorage`;
- `sessionStorage`;
- payloads;
- assistant;
- feedback;
- analytics.

Current `export_pdf` analytics payload remains unrelated to the percentage:

```js
trackEvent("export_pdf", {
  source: "revenues",
  totalRevenues: revenues.length,
  invoiceCount: visibleInvoices.length,
});
```

If any of these paths need to change, the implementation must stop.

## 16. Rollback

Future rollback must be local:

```txt
Shadow-derived denominator -> savingsGoal
```

Scope:

```txt
src/App.jsx -> handleExportPDF -> Objectif d epargne percentage only
```

No data migration, Supabase change, PDF layout change, Adapter change, Facade change, Rules Engine change, assistant change or payload cleanup is required.

## 17. Future LOT 5.86 Authorization

If LOT 5.86 proceeds, authorized scope:

| Item | Authorization |
| --- | --- |
| file | `src/App.jsx` |
| block | `handleExportPDF` |
| consumer | `Objectif d epargne` percentage only |
| Legacy denominator | `savingsGoal` |
| Shadow denominator | `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` |
| numerator | keep `savingsProgress` |
| formatter | keep `%` |
| rounding | keep `Math.round((...) * 100 || 0)` |
| fallback | keep `Pas encore assez de données` |
| cap | none |
| feature flag | existing `fiscalSummaryVisibleSlice` only |
| baseline | `14 -> 15` |
| rollback | local denominator back to `savingsGoal` |

Expected future targeted tests:

- exact PDF consumer migration;
- baseline `15`;
- no 16th occurrence;
- no-cap behavior;
- fallback behavior;
- rounding boundaries;
- formatted output parity;
- root `savingsGoal` retained;
- other PDF outputs unchanged;
- persistence/payload/assistant isolation;
- rollback local.

Future stop conditions:

- `savingsProgress` must change;
- root `savingsGoal` must change;
- ratio/fallback/rounding/formatter must change;
- `Math.min(100, ...)` is needed;
- PDF layout must change;
- another PDF output must change;
- baseline future is not `15`;
- rollback is not local.

## 18. Scope Control

LOT 5.85 confirms:

- exactly one document created;
- no code modified;
- no test created;
- no test modified;
- no consumer migrated;
- root `savingsGoal` unchanged;
- PDF/export unchanged;
- coaching runtime unchanged;
- persistence unchanged;
- payloads unchanged;
- assistant unchanged;
- baseline Shadow remains `14`;
- no 15th occurrence added in this LOT;
- Legacy remains compatibility layer.

## 19. Lightweight Validation

Validation commands executed for this documentation-only LOT:

```txt
git diff --stat
git status --short
git diff -- docs/LOT_5_85_SAVINGSGOAL_PDF_MIGRATION_GATE_REVIEW.md
git status --short --untracked-files=all -- docs/LOT_5_85_SAVINGSGOAL_PDF_MIGRATION_GATE_REVIEW.md
```

Observed:

```txt
git diff --stat
-> existing tracked worktree changes only:
   playwright.config.js, src/App.jsx, src/utils/obligations.js,
   tests/home.spec.js, tests/premium.spec.js

git status --short
-> existing broader dirty worktree plus untracked docs/, src/application/,
   src/domain/, src/navigation/, src/shell/ and tests/ entries.

git diff -- docs/LOT_5_85_SAVINGSGOAL_PDF_MIGRATION_GATE_REVIEW.md
-> no output because this LOT 5.85 report is a new untracked file.

git status --short --untracked-files=all -- docs/LOT_5_85_SAVINGSGOAL_PDF_MIGRATION_GATE_REVIEW.md
-> ?? docs/LOT_5_85_SAVINGSGOAL_PDF_MIGRATION_GATE_REVIEW.md
```

Not run by scope:

- `node --test`;
- `npm run build`;
- `npm run lint`;
- Playwright;
- application.

## 20. Final Decision

GO POUR LOT 5.86 — SAVINGSGOAL PDF MIGRATION IMPLEMENTATION
