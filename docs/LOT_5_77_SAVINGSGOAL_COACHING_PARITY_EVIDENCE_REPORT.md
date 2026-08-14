# LOT 5.77 - SavingsGoal Coaching Parity Evidence Report

## 1. Executive Summary

LOT 5.77 adds deterministic parity evidence for the coaching boundary that still consumes the Legacy `savingsGoal` root.

Changes created:

- `tests/lot-5-77-savingsgoal-coaching-parity-evidence.test.js`
- `docs/LOT_5_77_SAVINGSGOAL_COACHING_PARITY_EVIDENCE_REPORT.md`

No runtime code, `src/App.jsx`, root `savingsGoal`, coaching message, threshold, PDF/export, assistant, persistence, payload, analytics, Adapter, Facade, Domain, Rules Engine, feature flag or visible UI was modified.

Result:

```txt
The coaching low-reserve consumer is READY for a migration gate review.
It is not migrated in LOT 5.77.
```

## 2. Coaching Consumer Inventory

Direct coaching consumer found:

| Consumer | File / block | Expression | Direct / indirect | Type | Threshold | Message | Downstream effect | Visible |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `fiscalCoachingCard` low-reserve branch | `src/App.jsx`, `const fiscalCoachingCard = useMemo(...)` | `!smartAlertIds.has("reserve-low") && savingsGoal > 0 && savingsProgress < savingsGoal * 0.35` | direct | mixed condition / ratio threshold | 35% of `savingsGoal` | `roleBasedTips.dailyFiscalTip.lowReserve` | selects the coaching card text | yes, if branch wins |
| React dependency | `fiscalCoachingCard` dependency array | `savingsGoal` | direct | memo dependency | none | none | callback recomputation only | no |

No other coaching block with a direct `savingsGoal` read was found.

## 3. Legacy Coaching Contract

Current Legacy contract:

```js
!smartAlertIds.has("reserve-low") &&
savingsGoal > 0 &&
savingsProgress < savingsGoal * 0.35
```

Source chain:

```txt
currentMonthTotal -> estimatedCharges -> savingsGoal
currentMonthTotal + estimatedCharges -> availableAmount -> savingsProgress
```

Contract details:

| Item | Contract |
| --- | --- |
| `savingsGoal` | `Math.max(estimatedCharges * 3, 500)` |
| `estimatedCharges` | `Math.round(currentMonthTotal * computed.rate)` when rate truthy, else `0` |
| `savingsProgress` | `Math.max(0, currentMonthTotal - estimatedCharges)` |
| numerator | `savingsProgress` |
| denominator | `savingsGoal` |
| comparator | strict `<` |
| threshold | `savingsGoal * 0.35` |
| rounding | inherited from `estimatedCharges`; no threshold rounding |
| selected output | `{ text: roleBasedTips.dailyFiscalTip.lowReserve }` |

## 4. Shadow Candidate Mapping

| Legacy input | Shadow candidate | Evidence status |
| --- | --- | --- |
| `currentMonthTotal` | `fiscalSummaryVisibleSlice.revenueTotal` / `shadowResult.revenue.total` | already proven in prior revenue consumers |
| `computed?.rate` | `fiscalSummaryVisibleSlice.effectiveRate` / `shadowResult.summary.effectiveRate` | proven for rate-focused lots |
| `estimatedCharges` | `fiscalSummaryVisibleSlice.finalContributionAmount` / `shadowResult.summary.finalContributionAmount` | proven for Objectif UI and now coaching scenarios |
| `savingsGoal` denominator | `Math.max(shadowResult.summary.finalContributionAmount * 3, 500)` | proven in LOT 5.77 fixtures |
| `savingsProgress` | no approved direct Shadow field | retained Legacy numerator |

Important limit:

```txt
LOT 5.77 proves the coaching candidate by replacing only the denominator candidate.
It does not authorize a global root replacement and does not create a Shadow savingsProgress.
```

## 5. Amount Parity

The test compares explicit Legacy expected charges with `shadowResult.summary.finalContributionAmount`.

Covered examples:

| Scenario | Legacy expected charge | Shadow final contribution | Result |
| --- | ---: | ---: | --- |
| revenue zero | 0 | 0 | MATCH |
| services 1000 | 220 | 220 | MATCH |
| low revenue floor case | 22 | 22 | MATCH |
| high revenue | 2200 | 2200 | MATCH |
| multiple revenues | 292 | 292 | MATCH |
| commerce inactive ACRE | 123 | 123 | MATCH |
| services active ACRE | 110 | 110 | MATCH |
| unknown activity | 0 | 0 | MATCH |

The derived coaching denominator also matches:

```txt
Legacy: Math.max(estimatedCharges * 3, 500)
Shadow candidate: Math.max(finalContributionAmount * 3, 500)
```

## 6. Ratio Parity

The coaching ratio is not displayed, but it drives the threshold.

Contract:

```txt
ratio = savingsProgress / savingsGoal
threshold = ratio < 0.35
```

LOT 5.77 proves ratio parity separately from amount parity by comparing:

```txt
savingsProgress / Legacy savingsGoal
savingsProgress / Shadow candidate goal
```

Result: MATCH on all positive-charge approved scenarios.

## 7. Threshold / Boolean Parity

Boundary scenarios:

| Scenario | savingsProgress | threshold | Expected |
| --- | ---: | ---: | --- |
| just below | 230 | 231 | low-reserve selected |
| exact | 231 | 231 | not selected |
| just above | 232 | 231 | not selected |

The strict `<` comparator is preserved. Exact threshold does not select the branch.

Boolean parity result:

```txt
Legacy branch === Shadow-candidate branch for the matched scenarios.
```

## 8. Message Integrity

For matched low-reserve scenarios, the selected branch remains exactly:

```js
{
  text: roleBasedTips.dailyFiscalTip.lowReserve
}
```

No title, severity, CTA or handler is added by this branch.

The test confirms:

- same branch selection;
- same text key;
- no title;
- no severity;
- no CTA.

## 9. Scenario Matrix

Minimum requested coverage:

| Required scenario | Covered |
| --- | --- |
| revenue = 0 | yes |
| revenue positif | yes |
| faible revenue | yes |
| revenue élevé | yes |
| plusieurs revenus | yes |
| estimatedCharges = 0 | yes |
| charges positives | yes |
| faible savingsGoal | yes, floor `500` |
| savingsGoal élevé | yes |
| ACRE inactive | yes |
| ACRE active | yes |
| zero -> positive | yes |
| positive -> zero | yes |
| same input twice | yes |
| cloned input | yes |
| threshold below | yes |
| threshold exact | yes |
| threshold above | yes |
| intentional mismatch | yes |

## 10. ACRE Assessment

ACRE inactive:

```txt
revenue 1000, services, ACRE no
Legacy estimatedCharges = 220
Shadow finalContributionAmount = 220
effectiveRate = 0.22
acreStatus = inactive
```

ACRE active:

```txt
revenue 1000, services, ACRE yes, start 2026-01-15, reference 2026-07-20
Legacy estimatedCharges = 110
Shadow finalContributionAmount = 110
effectiveRate = 0.11
acreStatus = active
```

Result: MATCH.

## 11. Intentional Mismatch

Intentional mismatch scenario:

```txt
Legacy estimatedCharges = 220
Legacy savingsGoal = 660
Legacy savingsProgress = 230
Shadow finalContributionAmount = 110
Shadow candidate goal = 500
```

Observed:

| Check | Result |
| --- | --- |
| amount mismatch | detected |
| ratio mismatch | detected |
| branch mismatch | detected |
| hidden correction | none |
| tolerance | none |
| fallback masking | none |

This proves the evidence can fail when the candidate diverges.

## 12. Reachability

No real production mismatch was found in the tested scenarios.

Reachability classification:

| Case | Classification |
| --- | --- |
| matched regular scenarios | reachable in production |
| ACRE active matched scenario | reachable with valid ACRE profile |
| unknown activity charge zero | incomplete profile / fallback |
| intentional mismatch | test-only edge |
| branch mismatch from intentional candidate difference | test-only edge |

## 13. Feature Flag

Current visible slice contract:

```js
const usesShadow =
  FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED &&
  Boolean(shadowResult);
```

Conceptual behavior:

| Flag state | Candidate availability |
| --- | --- |
| ON with Shadow result | `fiscalSummaryVisibleSlice.finalContributionAmount` resolves to Shadow |
| OFF or missing Shadow result | visible slice falls back to Legacy `estimatedCharges` |

LOT 5.77 creates no new flag and no `SAVINGSGOAL_COACHING` flag.

## 14. Root SavingsGoal Retention

The root remains Legacy:

```js
const savingsGoal = useMemo(() => {
  return Math.max(estimatedCharges * 3, 500);
}, [estimatedCharges]);
```

The test confirms the root does not read:

- `fiscalSummaryVisibleSlice`;
- `shadowResult`;
- `finalContributionAmount`.

Passing coaching parity evidence does not authorize deleting or replacing the root.

## 15. PDF / Export Isolation

PDF/export remains Legacy and out of LOT 5.77 scope:

```js
Math.round((savingsProgress / savingsGoal) * 100 || 0)
```

The test confirms the PDF block still contains the Legacy `Objectif d epargne` percentage and does not read `fiscalSummaryVisibleSlice` or `shadowResult`.

## 16. Assistant / Persistence Isolation

The proof confirms no propagation to:

- assistant guidance;
- persistence;
- feedback payload;
- analytics;
- Supabase;
- `localStorage`;
- `sessionStorage`.

The coaching block itself contains no persistence, network, payload, analytics or assistant access.

## 17. Determinism

Evidence properties:

| Property | Result |
| --- | --- |
| pure helpers | PASS |
| same input -> same output | PASS |
| cloned input -> same output | PASS |
| no mutation | PASS |
| no `Date.now()` | PASS |
| no `new Date()` in evidence helpers | PASS |
| no `Math.random()` | PASS |
| no network | PASS |
| no persistence | PASS |

The domain Shadow calculation is called with a fixed `referenceDate`.

## 18. Best Isolatable Coaching Consumer

Selected consumer:

```txt
fiscalCoachingCard low-reserve condition
```

Classification:

| Field | Value |
| --- | --- |
| Status | READY |
| Legacy expression | `!smartAlertIds.has("reserve-low") && savingsGoal > 0 && savingsProgress < savingsGoal * 0.35` |
| Shadow candidate | `Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)` as denominator |
| Numerator | retained Legacy `savingsProgress` |
| Parity result | amount, ratio and branch parity PASS |
| Message impact | same `roleBasedTips.dailyFiscalTip.lowReserve` branch |
| Rollback | restore `savingsGoal` in the coaching condition only |
| Risk | medium |

This consumer is ready for a gate review, not immediate migration without that gate.

## 19. Risks

| Risk | Level | Mitigation |
| --- | --- | --- |
| branch priority can mask low-reserve | medium | gate review must keep branch order unchanged |
| `reserve-low` smart alert suppresses coaching branch | medium | gate review must preserve `!smartAlertIds.has("reserve-low")` |
| numerator remains Legacy `savingsProgress` | medium | migrate denominator only, or require separate numerator evidence |
| PDF/export still uses global `savingsGoal` | high | keep root Legacy and leave PDF out of scope |
| global root swap would affect multiple boundaries | high | explicitly forbidden |

## 20. Recommended Next LOT

Recommended next LOT:

```txt
GO POUR LOT 5.78 - SAVINGSGOAL COACHING MIGRATION GATE REVIEW
```

Reason:

```txt
The exact coaching consumer is identified.
The Shadow denominator candidate is known.
Amount parity, ratio parity, threshold parity and message integrity pass.
The next safe step is a gate review that decides whether this single coaching condition can be migrated without touching the root or PDF/export.
```

Validation executed:

```txt
node --test tests/lot-5-77-savingsgoal-coaching-parity-evidence.test.js
PASS - 18/18

node --test tests/lot-5-73-smart-alert-rawavailable-revenue-stabilization.test.js
PASS - 12/12

node --test tests/lot-5-72-smart-alert-rawavailable-revenue-migration-validation.test.js
PASS - 12/12

node --test tests/shadow-parity-validation.test.js
PASS - 6/6

node --test tests/runtime-parity-evidence.test.js
PASS - 11/11

npx eslint tests/lot-5-77-savingsgoal-coaching-parity-evidence.test.js
PASS - no output
```

Note: the first sandboxed `node --test tests/lot-5-77-savingsgoal-coaching-parity-evidence.test.js` attempt failed with the known `spawn EPERM`; the targeted Node commands were then run outside the sandbox as requested by the LOT instructions.

## 21. Final Decision

GO POUR LOT 5.78 - SAVINGSGOAL COACHING MIGRATION GATE REVIEW
