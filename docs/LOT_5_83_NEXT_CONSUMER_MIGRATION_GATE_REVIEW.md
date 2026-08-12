# LOT 5.83 - Next Consumer Migration Gate Review

## 1. Executive Summary

LOT 5.83 is a documentation-only gate review.

No runtime code, test, helper, source file, Adapter, Facade, Domain, Rules Engine, feature flag, coaching behavior, PDF/export behavior, persistence, payload, assistant path or Shadow read was modified.

Current state:

```txt
fiscalSummaryVisibleSlice = 14
no 15th Shadow occurrence
fiscalCoachingCard low-reserve denominator migrated and stabilized
root savingsGoal retained as Legacy compatibility layer
PDF/export remains Legacy
```

Gate result:

```txt
Next candidate: PDF/export Objectif d epargne percentage.
Status: NEEDS EVIDENCE.
```

Recommended next LOT:

```txt
GO POUR LOT 5.84 — SAVINGSGOAL PDF PARITY EVIDENCE
```

## 2. Source and Authority

Authority documents read:

- `docs/LOT_5_75_SAVINGSGOAL_DEPENDENCY_ANALYSIS.md`
- `docs/LOT_5_76_SAVINGSGOAL_CONTRACT_HARDENING_REPORT.md`
- `docs/LOT_5_77_SAVINGSGOAL_COACHING_PARITY_EVIDENCE_REPORT.md`
- `docs/LOT_5_78_SAVINGSGOAL_COACHING_MIGRATION_GATE_REVIEW.md`
- `docs/LOT_5_79_SAVINGSGOAL_COACHING_MIGRATION_REPORT.md`
- `docs/LOT_5_80_EXTENDED_STABILIZATION_REPORT.md`
- `docs/LOT_5_81_SAVINGSGOAL_COACHING_MIGRATION_VALIDATION_REPORT.md`
- `docs/LOT_5_82_SAVINGSGOAL_COACHING_STABILIZATION_REPORT.md`

Inspected:

- `src/App.jsx`
- remaining `savingsGoal` reads
- `fiscalCoachingSavingsGoal`
- `fiscalCoachingCard`
- PDF/export block
- `currentMonthTotal`
- `estimatedCharges`
- `availableAmount`
- `savingsProgress`
- `fiscalSummaryVisibleSlice`
- assistant, persistence, payload and analytics-adjacent boundaries

## 3. Remaining SavingsGoal Consumers

Current `savingsGoal` reads in `src/App.jsx`:

| Line | Block | Expression | Boundary | Type | Formatter / rounding | Side effect | Rollback |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 6441 | root definition | `const savingsGoal = useMemo(...)` | Legacy root | amount root | none inside root | none | keep Legacy |
| 9998 | `handleExportPDF` | `typeof savingsGoal !== "undefined" && savingsGoal > 0` | PDF/export | availability guard | fallback selection | exported output branch | local to PDF expression |
| 9999 | `handleExportPDF` | `Math.round((savingsProgress / savingsGoal) * 100 || 0)` | PDF/export | ratio percentage | `Math.round`, `|| 0`, `%` | exported PDF value | local to PDF expression |
| 10128 | `handleExportPDF` deps | `savingsGoal` | React callback dependency | dependency | none | callback identity only | local to callback deps |

No remaining direct `savingsGoal` read was found in:

- coaching runtime
- Supabase persistence
- `localStorage`
- `sessionStorage`
- feedback payload
- analytics payload
- assistant guidance
- smart alerts
- invoices
- reminders
- weekly recap
- monthly reflection

## 4. Remaining Coaching Review

The previously selected coaching consumer is complete:

```txt
fiscalCoachingCard -> low-reserve denominator
```

Current migrated source:

```js
const fiscalCoachingSavingsGoal = Math.max(
  fiscalSummaryVisibleSlice.finalContributionAmount * 3,
  500,
);
```

Current migrated branch:

```js
fiscalCoachingSavingsGoal > 0 &&
savingsProgress < fiscalCoachingSavingsGoal * 0.35
```

Other coaching branches:

| Branch | SavingsGoal dependency | Shadow candidate | Classification |
| --- | --- | --- | --- |
| irregular revenue | none | not applicable | not a SavingsGoal consumer |
| TVA watch | none | not applicable | not a SavingsGoal consumer |
| missing expenses | none | not applicable | not a SavingsGoal consumer |
| deadline | none | not applicable | not a SavingsGoal consumer |
| ACRE ending | none | not applicable | not a SavingsGoal consumer |
| guest history | none | not applicable | not a SavingsGoal consumer |
| first invoice | none | not applicable | not a SavingsGoal consumer |

Conclusion:

```txt
No remaining coaching SavingsGoal consumer is available.
```

## 5. PDF / Export Inventory

PDF/export block:

```js
`Objectif d epargne : ${
  typeof savingsGoal !== "undefined" && savingsGoal > 0
    ? `${Math.round((savingsProgress / savingsGoal) * 100 || 0)}%`
    : "Pas encore assez de données"
}`
```

Inventory:

| Field | Value |
| --- | --- |
| file | `src/App.jsx` |
| function | `handleExportPDF` |
| section | `3. Analyse` |
| box | `Projection` |
| label | `Objectif d epargne` |
| output type | exported percentage string |
| numerator | `savingsProgress` |
| denominator | `savingsGoal` |
| availability guard | `typeof savingsGoal !== "undefined" && savingsGoal > 0` |
| rounding | `Math.round(...)` |
| inner fallback | `|| 0` |
| formatter | template literal with trailing `%` |
| cap | none; no `Math.min(100, ...)` |
| fallback label | `Pas encore assez de données` |

## 6. PDF Amount Candidates

No PDF/export consumer currently exports the raw `savingsGoal` amount.

The PDF uses other amount values in nearby lines:

- `currentMonthTotal` through `getDisplayValue(...)`;
- `dashboardChargesDisplay`;
- `dashboardAvailableDisplay`;
- `revenueStats.monthlyAverage`;
- `computed.annualNet`;
- `computed.rate`.

Those are not direct `savingsGoal` consumers and are not candidates for this gate.

Classification:

```txt
No simple PDF savingsGoal amount consumer found.
```

## 7. PDF Percentage Candidate

Selected serious candidate:

```txt
PDF/export Objectif d epargne percentage
```

Legacy expression:

```js
typeof savingsGoal !== "undefined" && savingsGoal > 0
  ? `${Math.round((savingsProgress / savingsGoal) * 100 || 0)}%`
  : "Pas encore assez de données"
```

Candidate denominator:

```js
Math.max(
  fiscalSummaryVisibleSlice.finalContributionAmount * 3,
  500,
)
```

Candidate expression shape for a future evidence LOT only:

```txt
same numerator, same rounding, same formatter, same fallback,
with the denominator derived from fiscalSummaryVisibleSlice.finalContributionAmount.
```

Important:

```txt
amount parity does not prove exported percentage parity.
```

Reason:

- numerator remains `savingsProgress`;
- `savingsProgress` is Legacy-derived from `availableAmount`;
- PDF output is a downloaded artifact contract;
- PDF has no `Math.min(100, ...)` cap, unlike visible Objectif UI percentage.

Classification:

```txt
NEEDS EVIDENCE
```

## 8. Root SavingsGoal Retention

Root `savingsGoal` must remain Legacy.

Current root:

```js
const savingsGoal = useMemo(() => {
  // Objectif d'épargne recommandé: 3 mois de charges
  return Math.max(estimatedCharges * 3, 500);
}, [estimatedCharges]);
```

LOT 5.83 does not authorize deleting or replacing this root.

Even if the PDF/export consumer is later migrated, root removal must wait for a separate review proving no remaining direct or dependency consumers still require it.

## 9. Parity Status

| Candidate | Legacy source | Shadow candidate | Existing evidence | Missing evidence | Status |
| --- | --- | --- | --- | --- | --- |
| PDF/export Objectif d epargne percentage | `savingsProgress / savingsGoal` | `savingsProgress / Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` | denominator amount parity from UI/coaching; runtime Shadow evidence for final contribution | PDF-specific percentage parity, fallback parity, no-cap parity, exported string parity, deterministic mismatch detection | NEEDS EVIDENCE |
| global `savingsGoal` root | `Math.max(estimatedCharges * 3, 500)` | Shadow-backed root | partial amount parity | global blast radius proof and all consumers retired | BLOCKED |
| other coaching consumers | none | none | not applicable | no Legacy `savingsGoal` dependency | not candidate |

No known real mismatch is documented for the PDF candidate, but no consumer-specific proof exists yet.

## 10. Source-Only Requirement

The future PDF candidate can only become migrable if evidence proves a source-only denominator change is sufficient.

Forbidden future changes:

- no label change;
- no formatter change;
- no rounding change;
- no `Math.min(100, ...)` cap;
- no numerator change;
- no fallback change;
- no root replacement;
- no PDF layout restructure;
- no persistence or payload change.

## 11. Feature Flag

A future PDF migration could use the existing visible slice:

```txt
Flag ON + Shadow result -> fiscalSummaryVisibleSlice.finalContributionAmount from Shadow
Flag OFF or no Shadow result -> estimatedCharges through the existing selector
```

LOT 5.83 creates no new flag and no new Shadow read.

If a future migration is approved, the expected Shadow baseline would move:

```txt
14 -> 15
```

Only the PDF/export consumer-specific read would be authorized.

## 12. Shadow Baseline

Current source inspection:

```txt
fiscalSummaryVisibleSlice = 14
```

The current 14th occurrence remains:

```js
fiscalSummaryVisibleSlice.finalContributionAmount * 3
```

inside:

```txt
fiscalCoachingSavingsGoal
```

LOT 5.83 adds no 15th occurrence.

## 13. Persistence / Payload / Assistant Guard

The PDF candidate does not feed:

- Supabase writes;
- `localStorage`;
- `sessionStorage`;
- assistant guidance;
- feedback context;
- analytics payload fields.

The PDF completion path tracks:

```js
trackEvent("export_pdf", {
  source: "revenues",
  totalRevenues: revenues.length,
  invoiceCount: visibleInvoices.length,
});
```

This analytics payload does not include `savingsGoal`, `savingsProgress` or the exported percentage.

Risk remains high because the output is an exported artifact, not because it propagates to persistence.

## 14. Rollback

Potential rollback for a future PDF migration would be local:

```txt
Shadow-derived denominator -> savingsGoal
```

Scope:

```txt
src/App.jsx -> handleExportPDF -> Objectif d epargne percentage
```

Expected dependency rollback:

```txt
restore or keep savingsGoal in the handleExportPDF dependency array as required
```

No data migration, Supabase change, Adapter change, Facade change, Rules Engine change, assistant change or global PDF structure change should be needed.

## 15. Final Consumer Choice

Chosen consumer:

```txt
PDF/export Objectif d epargne percentage
```

Exact Legacy expression:

```js
typeof savingsGoal !== "undefined" && savingsGoal > 0
  ? `${Math.round((savingsProgress / savingsGoal) * 100 || 0)}%`
  : "Pas encore assez de données"
```

Exact Shadow candidate:

```js
Math.max(
  fiscalSummaryVisibleSlice.finalContributionAmount * 3,
  500,
)
```

Classification:

| Dimension | Decision |
| --- | --- |
| boundary | PDF/export |
| output | percentage string |
| amount / ratio / condition | ratio with availability guard |
| risk | HIGH |
| evidence | insufficient |
| status | NEEDS EVIDENCE |
| feature flag | existing visible slice only |
| rollback | local to PDF expression |
| future files potentially concerned | `tests/lot-5-84-savingsgoal-pdf-parity-evidence.test.js`, `docs/LOT_5_84_SAVINGSGOAL_PDF_PARITY_EVIDENCE_REPORT.md` |

## 16. Future Evidence Requirements

LOT 5.84 should be evidence-only.

Future targeted proof should cover:

- exported percentage parity;
- fallback parity;
- denominator minimum `500`;
- denominator above `500`;
- `savingsProgress = 0`;
- positive `savingsProgress`;
- percentage below `100`;
- percentage equal or above `100` because PDF has no cap;
- revenue `0`;
- low revenue;
- high revenue;
- charges `0`;
- charges positive;
- ACRE inactive;
- ACRE active;
- same input twice;
- cloned input;
- intentional mismatch detection;
- no persistence, payload, assistant or analytics propagation.

## 17. Scope Control

LOT 5.83 made no application change.

Confirmed:

- no `src/App.jsx` edit;
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
- no 15th occurrence;
- Legacy remains compatibility layer.

## 18. Lightweight Validation

Validation commands executed for this documentation-only LOT:

```txt
git diff --stat
git status --short
git diff -- docs/LOT_5_83_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md
git status --short --untracked-files=all -- docs/LOT_5_83_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md
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

git diff -- docs/LOT_5_83_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md
-> no output because this LOT 5.83 report is a new untracked file.

git status --short --untracked-files=all -- docs/LOT_5_83_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md
-> ?? docs/LOT_5_83_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md
```

Not run by scope:

- `node --test`
- `npm run build`
- `npm run lint`
- Playwright
- application

## 19. Risks

| Risk | Level | Mitigation |
| --- | --- | --- |
| PDF exported percentage changes silently | HIGH | require LOT 5.84 parity evidence before any migration |
| amount parity mistaken for percentage parity | HIGH | classify candidate as NEEDS EVIDENCE |
| root removed too early | HIGH | retain Legacy root |
| accidental 15th Shadow read in gate review | MEDIUM | no code change in LOT 5.83 |
| analytics or persistence coupling missed | MEDIUM | inspected export tracking and persistence boundaries |

## 20. Final Decision

GO POUR LOT 5.84 — SAVINGSGOAL PDF PARITY EVIDENCE
