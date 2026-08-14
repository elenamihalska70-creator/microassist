# LOT 5.75 — SAVINGSGOAL DEPENDENCY ANALYSIS

## 1. Executive Summary

LOT 5.75 is a documentation-only architectural analysis of the Legacy `savingsGoal` dependency root.

No runtime code, test, helper, slice, formula, rate, rounding, coaching behavior, PDF/export behavior, persistence path, payload, assistant path or consumer was modified.

Conclusion:

```txt
Do not replace global savingsGoal now.
```

The remaining direct consumers are not UI-only anymore. The Objectif d'epargne text and progress bar are already Shadow-backed. The remaining `savingsGoal` consumers are:

- coaching low-reserve condition;
- PDF/export Objectif d'epargne percentage;
- React dependency captures for those consumers.

Recommended next step:

```txt
GO POUR LOT 5.76 — SAVINGSGOAL CONTRACT HARDENING
```

Reason: before producing new parity evidence, the retained Legacy contract should be formalized around three distinct boundaries: root amount, coaching threshold and PDF/export percentage.

## 2. Source and Scope

Authority documents read:

- `docs/LOT_5_28_EXTENDED_CONSUMER_ANALYSIS.md`
- `docs/LOT_5_29_SAVINGSGOAL_ARCHITECTURE_HARDENING_REPORT.md`
- `docs/LOT_5_30_ISOLATED_SAVINGSGOAL_UI_PARITY_EVIDENCE_REPORT.md`
- `docs/LOT_5_31_ISOLATED_SAVINGSGOAL_UI_MIGRATION_GATE_REVIEW.md`
- `docs/LOT_5_32_ISOLATED_SAVINGSGOAL_UI_MIGRATION_REPORT.md`
- `docs/LOT_5_34_ISOLATED_SAVINGSGOAL_UI_MIGRATION_VALIDATION_REPORT.md`
- `docs/LOT_5_35_ISOLATED_SAVINGSGOAL_UI_STABILIZATION_REPORT.md`
- `docs/LOT_5_36_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md`
- `docs/LOT_5_37_OBJECTIF_EPARGNE_PROGRESS_BAR_MIGRATION_REPORT.md`
- `docs/LOT_5_39_OBJECTIF_EPARGNE_PROGRESS_BAR_MIGRATION_VALIDATION_REPORT.md`
- `docs/LOT_5_40_OBJECTIF_EPARGNE_PROGRESS_BAR_STABILIZATION_REPORT.md`
- `docs/LOT_5_74_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md`

Inspected:

- `src/App.jsx`
- root `savingsGoal`
- all direct `savingsGoal` reads
- `savingsProgress`
- `availableAmount`
- Objectif d'epargne UI
- progress bar
- coaching
- PDF/export
- assistant-adjacent code
- feedback and analytics contexts
- persistence and payload builders
- localStorage / sessionStorage / Supabase usage
- invoices, reminders, weekly and monthly summaries

## 3. Root Definition

File:

```txt
src/App.jsx
```

Root definition:

```js
const savingsGoal = useMemo(() => {
  // Objectif d'épargne recommandé: 3 mois de charges
  return Math.max(estimatedCharges * 3, 500);
}, [estimatedCharges]);
```

Value type:

```txt
number, euros
```

Formula:

```txt
Math.max(estimatedCharges * 3, 500)
```

Contract:

- multiplier: `* 3`
- floor: `500`
- direct rounding: none inside `savingsGoal`
- inherited rounding: from `estimatedCharges`
- fallback: minimum `500` even when `estimatedCharges` is `0`
- hook: `useMemo`
- dependency array: `[estimatedCharges]`

## 4. Input Dependency Graph

Current upstream graph:

```txt
revenues
  ↓
currentMonthTotal = sum(Number(item.amount || 0))
  ↓
computed.rate = computeObligations(...).rate
  ↓
estimatedCharges = computed?.rate ? Math.round(currentMonthTotal * computed.rate) : 0
  ↓
savingsGoal = Math.max(estimatedCharges * 3, 500)
```

Input matrix:

| Input | Origin | Legacy / Shadow | Formula / transformation | Fallback | Shadow availability | Parity |
| --- | --- | --- | --- | --- | --- | --- |
| `currentMonthTotal` | `revenues.reduce(...)` in `src/App.jsx` | Legacy | sum `Number(item.amount || 0)` | empty revenues -> `0` | `fiscalSummaryVisibleSlice.revenueTotal` | proven for several migrated revenue consumers |
| `computed?.rate` | `computeObligations(...)` | Legacy | Rules-derived effective contribution rate | falsy -> no charge calc | `fiscalSummaryVisibleSlice.effectiveRate` | proven for weekly effective rate consumer only |
| `estimatedCharges` | local `useMemo` | Legacy | `Math.round(currentMonthTotal * computed.rate)` | falsy rate -> `0` | `fiscalSummaryVisibleSlice.finalContributionAmount` | proven for Objectif UI amount consumers and smart alert charges input |
| `availableAmount` | local `useMemo` | Legacy | `Math.max(0, currentMonthTotal - estimatedCharges)` | clamp to `0` | no approved direct `availableAmount` field | missing |
| `savingsProgress` | local `useMemo` | Legacy-derived | returns `availableAmount` | none beyond `availableAmount` | no approved direct equivalent | missing |

Important separation:

```txt
amount parity does not prove percentage, coaching or export parity.
```

## 5. Direct Consumers

Direct `savingsGoal` reads found in `src/App.jsx`:

| Consumer | Block | Expression | Boundary | Visible | Formatter / downstream | Side effect | Feature flag | Rollback potential |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| root definition | `savingsGoal` `useMemo` | `Math.max(estimatedCharges * 3, 500)` | root amount | indirect | none | no | none | restore Legacy formula |
| coaching threshold guard | `fiscalCoachingCard` | `savingsGoal > 0` | coaching | yes, conditionally | boolean guard | affects selected coaching card | none local | local only if consumer-specific |
| coaching threshold comparison | `fiscalCoachingCard` | `savingsProgress < savingsGoal * 0.35` | coaching | yes, conditionally | boolean threshold | affects low-reserve message | none local | local only if consumer-specific |
| coaching dependency | `fiscalCoachingCard` deps | `savingsGoal` | React dependency | no | memo invalidation | no direct side effect | none | dependency rollback with consumer |
| PDF export availability guard | `handleExportPDF` | `typeof savingsGoal !== "undefined" && savingsGoal > 0` | PDF/export | exported | output branch | exported document value | none local | local only if PDF-specific |
| PDF export percentage | `handleExportPDF` | `Math.round((savingsProgress / savingsGoal) * 100 || 0)` | PDF/export | exported | `Math.round`, `%`, `|| 0` | exported document value | none local | local only if PDF-specific |
| PDF callback dependency | `handleExportPDF` deps | `savingsGoal` | React dependency | no | callback identity | no direct side effect | none | dependency rollback with consumer |

No direct `savingsGoal` read was found in:

- Supabase persistence
- localStorage / sessionStorage persistence
- feedback context fields
- analytics payloads
- assistant output / prompt context
- invoices
- reminders
- weekly recap
- monthly reflection
- Objectif d'epargne visible text
- Objectif d'epargne progress bar

## 6. Indirect Consumers

Derived graph:

```txt
savingsGoal
  ↓
coaching low-reserve boolean
  ↓
fiscalCoachingCard
  ↓
dashboard coaching card rendering
```

```txt
savingsGoal
  ↓
PDF Objectif d epargne percentage
  ↓
handleExportPDF
  ↓
downloaded PDF report
```

`savingsProgress` is a sibling dependency for both remaining consumers:

```txt
availableAmount = Math.max(0, currentMonthTotal - estimatedCharges)
  ↓
savingsProgress = availableAmount
```

This matters because a future Shadow denominator alone would not make the whole ratio fully Shadow-backed.

## 7. UI Boundary

Objectif d'epargne UI state:

- text percentage: Shadow-backed and stabilized;
- progress bar fill width: Shadow-backed and stabilized;
- display gate: uses `fiscalSummaryVisibleSlice.revenueTotal > 0`.

Current UI expressions:

```js
Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)
```

appears in both Objectif UI consumers.

Result:

```txt
No remaining direct UI savingsGoal consumer found.
```

The UI boundary should not be remigrated.

## 8. Coaching Boundary

Coaching block:

```js
if (
  !smartAlertIds.has("reserve-low") &&
  savingsGoal > 0 &&
  savingsProgress < savingsGoal * 0.35
) {
  return {
    text: roleBasedTips.dailyFiscalTip.lowReserve,
  };
}
```

Consumer classification:

| Aspect | Value |
| --- | --- |
| input exact | `savingsGoal`, `savingsProgress`, `smartAlertIds` |
| condition | reserve-low smart alert absent, goal positive, progress below 35% |
| comparison | `savingsProgress < savingsGoal * 0.35` |
| percentage | implicit `35%` threshold |
| message | `roleBasedTips.dailyFiscalTip.lowReserve` |
| formatter | none |
| downstream | controls which coaching card appears |
| side effect | no write, but visible behavioral branch |
| classification | `NEEDS PARITY EVIDENCE` |

Coaching uses:

- A. raw `savingsGoal` amount in a positive guard;
- C. boolean condition;
- D. multiple forms when combined with `savingsProgress` and `smartAlertIds`.

It does not display the raw amount.

## 9. PDF / Export Boundary

PDF block:

```js
`Objectif d epargne : ${
  typeof savingsGoal !== "undefined" && savingsGoal > 0
    ? `${Math.round((savingsProgress / savingsGoal) * 100 || 0)}%`
    : "Pas encore assez de données"
}`
```

PDF/export classification:

| Aspect | Value |
| --- | --- |
| exported value | percentage |
| raw `savingsGoal` exported | no |
| denominator | `savingsGoal` |
| numerator | `savingsProgress` |
| rounding | `Math.round(...)` |
| fallback | `"Pas encore assez de données"` if goal missing / non-positive |
| inner fallback | `|| 0` |
| label | `Objectif d epargne` |
| order | PDF section `3. Analyse`, `Projection` box |
| dependency to revenue | indirect through `savingsProgress` and `estimatedCharges` |
| dependency to charges | denominator via `estimatedCharges` |
| classification | `NEEDS PARITY EVIDENCE` |

PDF/export consumes a derived ratio, not a raw amount. It is not ready for migration without export-specific parity evidence.

## 10. Persistence

Result:

```txt
NO direct persistence usage of savingsGoal or a named savingsGoal-derived value.
```

Checked surfaces:

- localStorage
- sessionStorage
- Supabase
- saved draft state
- persisted profile payloads
- migration payloads
- history / restoration paths

No path stores `savingsGoal`.

## 11. Payloads / Network

Result:

```txt
NO direct payload/network usage of savingsGoal outside PDF export output.
```

Checked surfaces:

- `fetch`
- Supabase payloads
- feedback payloads
- analytics / `trackEvent`
- assistant-adjacent values
- export payloads

Findings:

- `feedbackContextSnapshot` uses `totalRevenues: currentMonthTotal || 0`, not `savingsGoal`.
- `trackEvent("export_pdf", ...)` sends revenue/invoice counts, not `savingsGoal`.
- PDF output includes a derived `savingsGoal` percentage.

## 12. Assistant Boundary

Classification:

```txt
NONE
```

No direct or indirect `savingsGoal` input was found in:

- `buildSimpleAssistantGuidance(...)`
- assistant summary blocks
- assistant prompt-like profile state
- assistant navigation / view state

The assistant remains unchanged and outside the `savingsGoal` dependency root.

## 13. Formula Contract

Legacy root contract:

```txt
savingsGoal = max(three months of estimated charges, 500 euros)
```

Exact formula:

```js
Math.max(estimatedCharges * 3, 500)
```

Conceptual Shadow amount:

```txt
fiscalSummaryVisibleSlice.finalContributionAmount
```

Contract separation:

| Contract | Status |
| --- | --- |
| A. amount equivalence | PARTIAL / PROVEN for approved UI and smart-alert charge consumers |
| B. percentage equivalence | PROVEN for Objectif UI text/bar, missing for PDF |
| C. behavioral equivalence | MISSING for coaching low-reserve branch |
| D. export equivalence | MISSING for PDF output |
| E. coaching equivalence | MISSING |

Do not infer global interchangeability from amount parity alone.

## 14. Existing Evidence Matrix

| Consumer | Legacy source | Shadow candidate | Evidence | Status |
| --- | --- | --- | --- | --- |
| Objectif text percentage | `savingsGoal` denominator | `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` | LOT 5.30, 5.32, 5.34, 5.35 | PROVEN |
| Objectif progress bar width | `savingsGoal` denominator | `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` | LOT 5.37, 5.39, 5.40 | PROVEN |
| global `savingsGoal` root | `Math.max(estimatedCharges * 3, 500)` | `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` | architecture only | PARTIAL |
| coaching low-reserve condition | `savingsGoal > 0 && savingsProgress < savingsGoal * 0.35` | Shadow denominator candidate | none dedicated | MISSING |
| PDF Objectif percentage | `Math.round((savingsProgress / savingsGoal) * 100 || 0)` | Shadow denominator candidate | none dedicated | MISSING |
| persistence | none | not applicable | LOT 5.29 / inspections | NOT APPLICABLE |
| payload / analytics | none direct | not applicable | LOT 5.29 / inspections | NOT APPLICABLE |
| assistant | none | not applicable | LOT 5.29 / inspections | NOT APPLICABLE |

## 15. Migration Strategies

### Strategy A — Root Replacement

Replace global `savingsGoal` with a Shadow-backed root.

Evaluation:

- risk: HIGH
- blast radius: coaching + PDF/export + callback dependencies
- rollback: syntactically local but behaviorally broad
- coaching impact: can change low-reserve coaching visibility
- PDF impact: can change exported percentage

Decision:

```txt
Reject for now.
```

### Strategy B — Consumer-by-Consumer

Keep root `savingsGoal` Legacy and migrate each remaining consumer separately.

Evaluation:

- risk: MEDIUM
- isolation: strong if each consumer receives its own parity evidence
- rollback: local per consumer
- temporary dual architecture: yes, but already accepted for prior UI migrations
- evidence: needed per boundary

Decision:

```txt
Viable, but requires contracts first.
```

### Strategy C — Boundary-by-Boundary

Keep root Legacy and treat each boundary as its own contract:

1. UI
2. coaching
3. PDF/export
4. persistence / payload / assistant checks

Evaluation:

- safety: highest
- complexity: moderate
- observability: strong
- rollback: local by boundary
- compatibility: preserves Legacy as root until all dependents are handled

Decision:

```txt
Recommended.
```

## 16. Recommended Architecture

Recommended strategy:

```txt
Strategy C — Boundary-by-Boundary
```

Rationale:

- UI boundary is already migrated and stabilized.
- Remaining consumers are not raw display reads.
- Coaching is behavioral.
- PDF/export is an exported contract.
- `savingsProgress` / `availableAmount` remain Legacy-derived and influence both remaining ratios.
- Root replacement would couple two boundaries at once.

Priority order:

```txt
correctness > isolation > rollback > simplicity > Legacy reduction
```

## 17. Root Retention Decision

Decision:

```txt
A. root savingsGoal must remain Legacy for now.
```

Future possibility:

```txt
B. it may be replaced later only after all direct consumers are migrated or explicitly retired.
```

It cannot be replaced now because:

- it still controls coaching behavior;
- it still controls PDF/export percentage output;
- no dedicated parity evidence exists for those boundaries;
- global replacement would migrate multiple consumers together.

## 18. Next Isolatable Consumer

Most plausible next consumer:

```txt
Coaching low-reserve condition
```

Current Legacy expression:

```js
savingsGoal > 0 &&
savingsProgress < savingsGoal * 0.35
```

Candidate Shadow denominator:

```js
Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)
```

Transformations:

- keep `* 0.35`;
- keep `savingsProgress` unchanged unless a future lot explicitly scopes available amount;
- keep branch order and message unchanged.

Evidence existing:

- amount evidence: partial / indirect;
- UI percentage evidence: proven for visible Objectif UI.

Evidence missing:

- coaching ON/OFF parity;
- branch priority interactions with smart alerts and other coaching branches;
- threshold below / exact / above;
- same input and cloned input determinism;
- intentional mismatch visibility.

Risk:

```txt
MEDIUM-HIGH
```

Rollback:

```txt
restore savingsGoal in the coaching condition only
```

This consumer is isolable after contract hardening, but not ready for migration or parity evidence until the retained contract is formalized.

## 19. Shadow Baseline

Baseline before LOT 5.75:

```txt
fiscalSummaryVisibleSlice = 13
```

Baseline after LOT 5.75:

```txt
fiscalSummaryVisibleSlice = 13
```

No fourteenth occurrence was added.

## 20. Legacy Retention

Confirmed unchanged:

- root `savingsGoal`
- `estimatedCharges`
- `currentMonthTotal`
- `savingsProgress`
- `availableAmount`
- coaching
- PDF/export
- assistant
- persistence
- payloads

Legacy remains the compatibility layer.

## 21. Risk Matrix

| Boundary | Consumer | Risk | Parity | Rollback | Recommendation |
| --- | --- | --- | --- | --- | --- |
| UI | Objectif text percentage | LOW | PROVEN | already local | no further migration |
| UI | Objectif progress bar | LOW | PROVEN | already local | no further migration |
| coaching | low-reserve condition | MEDIUM-HIGH | MISSING | local if consumer-specific | contract hardening, then parity evidence |
| PDF/export | Objectif percentage | HIGH | MISSING | local if consumer-specific | contract hardening before parity evidence |
| persistence | none direct | LOW | NOT APPLICABLE | none | retain unchanged |
| payload | none direct | LOW | NOT APPLICABLE | none | retain unchanged |
| assistant | none | LOW | NOT APPLICABLE | none | retain unchanged |
| root | global `savingsGoal` | HIGH | PARTIAL | broad behavior impact | keep Legacy |

## 22. LOT 5.76 Decision

The next smallest safe step is not immediate coaching evidence yet. The remaining boundaries need an executable or documentary contract that freezes:

- root `savingsGoal` formula;
- `savingsProgress` / `availableAmount` relationship;
- coaching low-reserve condition;
- PDF Objectif percentage formula;
- no persistence / payload / assistant usage.

Selected next lot:

```txt
GO POUR LOT 5.76 — SAVINGSGOAL CONTRACT HARDENING
```

## 23. Confirmations

Confirmed:

- exactly one document created;
- no code modified;
- no test created;
- no test modified;
- no consumer migrated;
- root `savingsGoal` unchanged;
- coaching unchanged;
- PDF/export unchanged;
- persistence unchanged;
- payloads unchanged;
- assistant unchanged;
- baseline Shadow remains `13`;
- no fourteenth occurrence added;
- Legacy remains compatibility layer.

## 24. Lightweight Validation

Executed lightweight validation only:

```txt
git diff --stat
git status --short
git diff -- docs/LOT_5_75_SAVINGSGOAL_DEPENDENCY_ANALYSIS.md
git status --short --untracked-files=all -- docs/LOT_5_75_SAVINGSGOAL_DEPENDENCY_ANALYSIS.md
```

Observed:

- `git diff --stat` showed only pre-existing tracked worktree changes; untracked LOT documents are not included in that stat.
- `git status --short` showed the existing dirty worktree plus untracked `docs/`.
- `git diff -- docs/LOT_5_75_SAVINGSGOAL_DEPENDENCY_ANALYSIS.md` produced no output because the LOT 5.75 report is a new untracked file.
- `git status --short --untracked-files=all -- docs/LOT_5_75_SAVINGSGOAL_DEPENDENCY_ANALYSIS.md` returned:

```txt
?? docs/LOT_5_75_SAVINGSGOAL_DEPENDENCY_ANALYSIS.md
```

Not run by scope:

- `node --test`
- `npm run build`
- `npm run lint`
- Playwright
- application

## 25. Final Decision

GO POUR LOT 5.76 — SAVINGSGOAL CONTRACT HARDENING
