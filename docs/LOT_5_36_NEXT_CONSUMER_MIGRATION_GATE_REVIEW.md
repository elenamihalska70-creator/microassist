# LOT 5.36 - Next Consumer Migration Gate Review

## 1. Executive Summary

LOT 5.36 is documentation-only.

No migration was implemented. No application code, test, runtime calculation, Adapter, Facade, Domain, Rules Engine, persistence path, payload, export or assistant path was modified.

Selected next consumer:

```txt
Objectif d'épargne progress bar fill width
```

Current Legacy expression:

```txt
Math.min(100, Math.round((savingsProgress / savingsGoal) * 100))
```

Candidate Shadow-backed expression:

```txt
Math.min(
  100,
  Math.round(
    (savingsProgress /
      Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)) *
      100,
  ),
)
```

Decision: GO POUR LOT 5.37 - NEXT CONSUMER MIGRATION IMPLEMENTATION.

Reason: this consumer is a visible UI-only sibling of the already migrated `Objectif d'épargne` text percentage. It can use the same approved Shadow field, the same multiplier, the same floor, the same rounding and the same local rollback pattern without touching global `savingsGoal`, coaching, PDF, persistence, payloads or assistant behavior.

## 2. Scope and Authority

Authority documents read:

- `docs/LOT_5_18_LEGACY_RETENTION_HARDENING_REPORT.md`
- `docs/LOT_5_27_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md`
- `docs/LOT_5_28_EXTENDED_CONSUMER_ANALYSIS.md`
- `docs/LOT_5_29_SAVINGSGOAL_ARCHITECTURE_HARDENING_REPORT.md`
- `docs/LOT_5_30_ISOLATED_SAVINGSGOAL_UI_PARITY_EVIDENCE_REPORT.md`
- `docs/LOT_5_31_ISOLATED_SAVINGSGOAL_UI_MIGRATION_GATE_REVIEW.md`
- `docs/LOT_5_32_ISOLATED_SAVINGSGOAL_UI_MIGRATION_REPORT.md`
- `docs/LOT_5_34_ISOLATED_SAVINGSGOAL_UI_MIGRATION_VALIDATION_REPORT.md`
- `docs/LOT_5_35_ISOLATED_SAVINGSGOAL_UI_STABILIZATION_REPORT.md`

Inspected:

- `src/App.jsx`
- `fiscalSummaryVisibleSlice`
- remaining `currentMonthTotal` usages
- remaining `estimatedCharges` usages
- remaining `savingsGoal` usages
- contribution amount usages
- `computed?.rate` usages
- `computed?.acreStatus` / `acre.status` usages
- dashboard consumers
- summaries
- obligations
- assistant-adjacent state
- exports
- persistence
- payload-like feedback / analytics
- simulator / revenue modal preview
- invoice-related consumers

## 3. Current Migration State

Already Shadow-backed through `fiscalSummaryVisibleSlice` when the existing local flag is ON and Shadow Result exists:

- dashboard revenue display
- dashboard amount-to-set-aside display for real revenue
- URSSAF helper amount and revenue-presence gate
- progress indicators revenue-presence gate
- `Objectif d'épargne` UI text percentage denominator

Still Legacy:

- global `savingsGoal`
- `Objectif d'épargne` progress bar fill width
- fiscal coaching low-reserve threshold
- PDF `Objectif d epargne` percentage
- exports
- feedback / analytics payload-like context
- assistant-adjacent state
- persistence
- simulator preview

Approved Shadow fields remain:

- `revenue.total`
- `summary.baseAmount`
- `summary.finalContributionAmount`
- `summary.effectiveRate`
- `acre.status`

Legacy remains a compatibility and rollback layer.

## 4. Short Candidate Inventory

| ID | Consumer | File / block | Legacy source | Shadow candidate | Visible | Parity | Transformation | React dependency | Persistence | Payload | Export | Assistant | Rollback | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-36A | `Objectif d'épargne` progress bar fill width | `src/App.jsx` progress indicators `progressFill` style | `savingsGoal` -> `estimatedCharges` | `fiscalSummaryVisibleSlice.finalContributionAmount` | yes | READY | existing `Math.max(* 3, 500)` denominator, same as text consumer | no new hook | no | no | no | no | local expression | LOW |
| C-36B | fiscal coaching low-reserve threshold | `fiscalCoachingCard` | `savingsGoal` | `summary.finalContributionAmount` derived denominator | yes | partial | threshold behavior `* 0.35` | existing memo | no | no | no | no | not UI-local | HIGH |
| C-36C | PDF `Objectif d epargne` percentage | `handleExportPDF` | `savingsGoal` | `summary.finalContributionAmount` derived denominator | exported | partial | export percentage contract | callback deps | export counters nearby | analytics nearby | yes | no | not local enough | BLOCKED |
| C-36D | weekly charges recap | `dashboardWeeklyRecap` | `computed?.rate` + weekly revenue formula | `fiscalSummaryVisibleSlice.effectiveRate` | yes | rate only | week-local formula remains | `useMemo` with dates/invoices | no | no | no | no | broader than source swap | MEDIUM |
| C-36E | revenue modal preview charges/rate | `previewCharges`, `previewRateLabel` | category rate fallback + `computed?.rate` | `effectiveRate` partial | yes | partial | category-specific rate resolution | multiple memos | no | no | no | no | not isolated | HIGH |
| C-36F | dashboard available display | `dashboardAvailableDisplay` | `availableAmount` / `cockpitEstimate.available` | no approved available field | yes | none | unavailable Shadow field | expression | no | indirect | export display helper | no | not possible | BLOCKED |
| C-36G | feedback context revenue total | `feedbackContextSnapshot` | `currentMonthTotal` | `fiscalSummaryVisibleSlice.revenueTotal` | no direct UI | READY for field | payload-like contract | `useMemo` | no | yes | no | no | payload review needed | BLOCKED |
| C-36H | monthly reflection | `dashboardMonthlyReflection` | `currentMonthTotal`, `estimatedCharges` | revenue + final contribution fields | visible text | partial | text contract | `useMemo` | no | no | no | assistant-adjacent tone | broad text behavior | HIGH |
| C-36I | assistant guidance | `simpleAssistantGuidance` | `currentMonthTotal` | `revenue.total` | visible guidance | READY for field | guidance semantics | `useMemo` | no | no | no | yes | assistant gate needed | BLOCKED |

The inventory is intentionally short and limited to plausible remaining consumers.

## 5. Candidate Matrix

| Consumer | Legacy | Shadow | Parity | Transformation | Isolation | Rollback | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C-36A progress bar fill width | `savingsGoal` | `fiscalSummaryVisibleSlice.finalContributionAmount` | READY | existing denominator formula only | UI-local | local | LOW |
| C-36B coaching threshold | `savingsGoal` | derived from `finalContributionAmount` | NEEDS EVIDENCE | behavior threshold | coupled | not local enough | HIGH |
| C-36C PDF percentage | `savingsGoal` | derived from `finalContributionAmount` | NEEDS EVIDENCE | export percentage | exported contract | not local enough | BLOCKED |
| C-36D weekly recap charges | `computed?.rate` | `effectiveRate` | NEEDS EVIDENCE | weekly formula remains | date/invoice coupled | medium | MEDIUM |
| C-36E preview charges/rate | category fallback + `computed?.rate` | `effectiveRate` partial | NEEDS EVIDENCE | category formula | modal-coupled | medium | HIGH |
| C-36F available display | `availableAmount` | none approved | BLOCKED | would need new field | not isolated | blocked | BLOCKED |
| C-36G feedback context | `currentMonthTotal` | `revenue.total` | READY | none | payload-like | risky | BLOCKED |
| C-36H monthly reflection | `currentMonthTotal`, `estimatedCharges` | partial | NEEDS EVIDENCE | text behavior | broad | medium | HIGH |
| C-36I assistant guidance | `currentMonthTotal` | `revenue.total` | READY | guidance behavior | assistant-adjacent | risky | BLOCKED |

## 6. Exclusions

Excluded from the next implementation LOT:

- global `savingsGoal`: still feeds coaching and PDF.
- coaching low-reserve threshold: behavioral branch, not pure UI.
- PDF objective percentage: exported output contract.
- weekly recap charges: week-local aggregation, date dependency and invoice-adjacent context.
- simulator / revenue modal preview: category-specific rate fallback and preview formulas.
- dashboard available display: no approved Shadow `availableAmount` field.
- feedback context: payload-like analytics contract.
- monthly reflection: visible text contract and mixed dependencies.
- assistant guidance: assistant-adjacent behavior.
- obligations / `computeObligations`: broad Legacy rules surface, not a source-only consumer.
- invoice-related consumers: persistence/export/invoice coupling.

All exclusions follow the automatic exclusion rules because they require new evidence, a non-local rollback, a payload/export/assistant review, unapproved fields or broader behavior contracts.

## 7. Selected Consumer

Selected consumer:

```txt
C-36A - Objectif d'épargne progress bar fill width
```

File / block:

```txt
src/App.jsx
progressIndicators -> progressBar progressBarPremium -> progressFill style.width
```

Current expression:

```js
width: `${Math.min(100, Math.round((savingsProgress / savingsGoal) * 100))}%`,
```

Legacy source:

```txt
savingsGoal
```

Legacy source chain:

```txt
estimatedCharges =
  computed?.rate
    ? Math.round(currentMonthTotal * computed.rate)
    : 0

savingsGoal =
  Math.max(estimatedCharges * 3, 500)
```

Shadow candidate:

```txt
fiscalSummaryVisibleSlice.finalContributionAmount
```

Candidate future expression:

```js
width: `${Math.min(
  100,
  Math.round(
    (savingsProgress /
      Math.max(
        fiscalSummaryVisibleSlice.finalContributionAmount * 3,
        500,
      )) *
      100,
  ),
)}%`,
```

## 8. Why This Consumer

C-36A is the lowest-risk next consumer because:

- it is visible UI only;
- it is adjacent to the already migrated `Objectif d'épargne` text percentage;
- it uses the same conceptual denominator as the stabilized text consumer;
- it can read an approved Shadow field already present in `fiscalSummaryVisibleSlice`;
- it requires no new Adapter, Facade, Domain, Rules or slice;
- it requires no new state, effect or memo;
- it requires no persistence, payload, export or assistant change;
- it keeps global `savingsGoal` Legacy;
- it keeps coaching Legacy;
- it keeps PDF Legacy;
- rollback is a local expression restoration.

This choice also reduces the intentionally documented text/bar double-source divergence from LOT 5.31 through LOT 5.35 while staying inside the same isolated UI card.

## 9. Parity Review

Field parity status:

```txt
READY
```

Existing evidence covers:

- `summary.finalContributionAmount` vs Legacy estimated contribution amount;
- strict MATCH behavior;
- intentional MISMATCH preservation;
- deterministic same-input and cloned-input behavior;
- ACRE inactive / active / expired coverage;
- zero and positive revenue coverage;
- decimal and multiple revenue coverage;
- runtime evidence integrity.

Evidence sources:

- `runtimeParityEvidence.js`
- `shadow-parity-validation.test.js`
- `runtime-parity-evidence.test.js`
- `tests/lot-5-30-isolated-savingsgoal-ui-parity-evidence.test.js`
- `tests/lot-5-34-isolated-savingsgoal-ui-migration-validation.test.js`
- `tests/lot-5-35-isolated-savingsgoal-ui-stabilization.test.js`

No new Shadow field is needed.

## 10. Transformation Review

The future migration would not introduce a new business formula.

The denominator formula is already approved and stabilized in the text consumer:

```txt
Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)
```

The progress bar keeps:

- `Math.min(100, ...)`
- `Math.round(...)`
- `savingsProgress` numerator
- `* 100`
- `%` CSS unit
- `progressBar progressBarPremium`
- `progressFill`

No rate, formula, fallback, normalization or rounding change is authorized.

## 11. Double Source Visible Review

Current double source:

- text percentage: Shadow-backed denominator via `fiscalSummaryVisibleSlice.finalContributionAmount`;
- progress bar fill width: Legacy denominator via `savingsGoal`.

Same information displayed:

```txt
Objectif d'épargne progress percentage
```

Risk today:

- text and bar can diverge if Shadow and Legacy differ;
- this divergence was accepted temporarily by LOT 5.31 through LOT 5.35.

Candidate effect:

- align the visible text and visible bar width on the same Shadow-backed denominator;
- keep global `savingsGoal`, coaching and PDF Legacy.

Double-source risk after candidate migration:

```txt
LOW
```

The remaining divergence would be only between the isolated UI card and non-UI/export/coaching Legacy boundaries, which are explicitly retained.

## 12. Feature Flag Review

Future implementation should reuse the existing source path:

```txt
fiscalSummaryVisibleSlice.finalContributionAmount
```

That slice already applies:

```txt
FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED
```

No new feature flag is needed for LOT 5.37.

No flag persistence is needed.

## 13. Rollback Review

Rollback is local:

```txt
Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)
-> savingsGoal
```

Allowed rollback location:

```txt
src/App.jsx progressFill style.width only
```

Rollback does not require:

- Supabase
- localStorage
- data migration
- Adapter
- Facade
- Domain
- Rules
- payload
- export
- assistant
- coaching
- PDF

## 14. Future LOT 5.37 Scope

Authorized future file:

```txt
src/App.jsx
```

Authorized future block:

```txt
progressIndicators -> progressBar progressBarPremium -> progressFill style.width
```

Authorized source replacement:

```txt
savingsGoal
-> Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)
```

Files likely needed for the implementation LOT:

- `src/App.jsx`
- a targeted `tests/lot-5-37-...test.js`
- a short implementation report

No other runtime, persistence, payload, export, assistant, Adapter, Facade, Domain or Rules file should be modified.

## 15. Future LOT 5.37 Tests Needed

Future implementation tests should cover:

- exact selected progress bar consumer;
- text consumer remains unchanged;
- progress bar reads `fiscalSummaryVisibleSlice.finalContributionAmount`;
- global `savingsGoal` remains Legacy;
- coaching remains Legacy;
- PDF remains Legacy;
- `savingsProgress` remains Legacy;
- `availableAmount` remains Legacy;
- formula preserves `Math.max`, `* 3`, `500`, `Math.round`, `Math.min(100, ...)` and `%`;
- flag ON uses Shadow through the existing visible slice;
- flag OFF rolls back through the existing visible slice;
- rollback of the bar is local to `savingsGoal`;
- no new state, effect, memo, Adapter or Facade execution;
- no persistence, payload, export or assistant propagation;
- parity and runtime evidence remain intact;
- Legacy Retention Guards remain adjusted only for the approved consumer.

## 16. Permanent Guards

Permanent Facade Guard: respected. No Facade change is proposed.

Permanent Migration Guard: respected. LOT 5.36 selects one future consumer only.

Permanent Shadow Rule: respected. No runtime Shadow read is added by this document.

Permanent Deterministic Parity Guard: respected. Selection relies on existing deterministic parity evidence.

Permanent Evidence Integrity Guard: respected. No mismatch is hidden or corrected.

Permanent Slice Isolation Guard: respected. Exactly one future UI consumer is selected.

Legacy Retention Guard: respected. Legacy remains compatibility layer for rollback, coaching, PDF, exports, assistant, persistence and other retained consumers.

## 17. Scope Control

Confirmed for LOT 5.36:

- exactly one document created;
- no code modified;
- no test modified;
- no consumer migrated;
- no new slice;
- no new Shadow read in runtime;
- no new Legacy consumer;
- no persistence modified;
- no payload modified;
- no export modified;
- no assistant modified;
- no formula modified;
- no rate modified;
- no rounding modified;
- Legacy remains a compatibility layer.

## 18. Remaining Risks

Remaining risks:

- future LOT 5.37 must keep the progress bar migration local and not touch the text consumer, coaching or PDF;
- historical guard counts will need targeted updates only if the approved source replacement changes lexical baselines;
- global `savingsGoal` will remain shared by coaching and PDF after the UI bar migration;
- export and assistant consumers remain blocked pending dedicated gate reviews.

No risk blocks an implementation LOT for C-36A.

## 19. Decision for LOT 5.37

C-36A satisfies the implementation criteria:

- consumer isolated;
- Shadow direct through an existing approved field;
- parity sufficient;
- no new business transformation;
- rollback local;
- risk LOW.

Final decision:

```txt
GO POUR LOT 5.37 — NEXT CONSUMER MIGRATION IMPLEMENTATION
```
