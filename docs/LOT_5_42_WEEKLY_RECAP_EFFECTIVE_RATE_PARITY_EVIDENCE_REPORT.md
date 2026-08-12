# LOT 5.42 - Weekly Recap Effective Rate Parity Evidence Report

## 1. Executive Summary

LOT 5.42 produced targeted parity evidence for the selected LOT 5.41 consumer:

```txt
Dashboard weekly recap - estimated rate source for weekly estimated charges
```

No runtime migration was implemented. `src/App.jsx` was not modified. No weekly recap, dates, invoices, reminders, UI, persistence, payload, assistant, export, Adapter, Facade, Domain, Rules, rate, formula or rounding behavior was changed.

Result:

- known activity rates match;
- positive `computed.rate` priority matches;
- ACRE inactive and active effective rates match;
- weekly revenue amount does not alter the rate comparison;
- strict mismatches are detected and preserved for `computed.rate = 0`, unknown activity and missing activity.

Because real contract mismatches are now characterized for fallback/zero/unknown cases, the recommended next lot is mismatch investigation before any migration gate.

## 2. Consumer Scope

Only consumer studied:

```txt
Dashboard weekly recap - rate source for weekly estimated charges
```

Current block:

```jsx
const estimatedRate =
  computed?.rate || getEstimatedRate(dashboardAnswers.activity_type);
const weeklyEstimatedCharges =
  weeklyRevenueCount > 0 && Number.isFinite(estimatedRate)
    ? Math.round(weeklyRevenueTotal * estimatedRate)
    : null;
```

Out of scope:

- other weekly recap values;
- invoices;
- reminders;
- coaching;
- PDF/export;
- persistence;
- payloads;
- assistant;
- other `effectiveRate` consumers.

## 3. Legacy Rate Contract

Legacy rate source:

```jsx
computed?.rate || getEstimatedRate(dashboardAnswers.activity_type)
```

Contract:

- `computed?.rate` has priority when truthy;
- `0`, `null`, `undefined`, `false` and other falsy values fall back;
- fallback is `getEstimatedRate(dashboardAnswers.activity_type)`;
- `services` fallback returns `0.22`;
- `commerce` fallback returns `0.123`;
- `mixte` / `mix` / `mixed` fallback returns `0.18`;
- `vente` / `sale` / `sales` normalize to `commerce`;
- unknown or missing activity falls back to `services`, therefore `0.22`;
- no extra rounding is applied to the rate source.

The `||` behavior is historical and was preserved exactly in the evidence.

## 4. Shadow Rate Contract

Candidate Shadow source:

```jsx
fiscalSummaryVisibleSlice.effectiveRate
```

Selector contract:

```jsx
effectiveRate: usesShadow
  ? shadowResult.summary.effectiveRate
  : computed?.rate
```

Contract:

- source is `shadowResult.summary.effectiveRate` when the existing visible-slice flag is ON and Shadow Result exists;
- source falls back to `computed?.rate` when Shadow Result is absent or flag OFF;
- no activity fallback is applied inside `fiscalSummaryVisibleSlice.effectiveRate`;
- zero remains zero;
- `null` / `undefined` remain whatever the selected source provides;
- ACRE can affect the effective rate when the calculation result applies reduced rate logic;
- no extra rounding is applied by the selector.

## 5. Scenario Matrix

| Scenario | Legacy rate | Shadow rate | Result | Reason |
| --- | ---: | ---: | --- | --- |
| service standard | 0.22 | 0.22 | MATCH | service rate matches |
| vente / commerce standard | 0.123 | 0.123 | MATCH | commerce rate matches |
| mixte standard | 0.18 | 0.18 | MATCH | mixed rate matches |
| computed.rate positive | 0.11 | 0.11 | MATCH | positive computed rate wins over activity fallback |
| computed.rate = 0 | 0.22 | 0 | MISMATCH | Legacy `||` fallback turns zero into services fallback |
| computed.rate = null | 0.123 | 0.123 | MATCH | Legacy falls back to commerce rate |
| computed.rate = undefined | 0.22 | 0.22 | MATCH | Legacy falls back to services rate |
| activity_type known alias `vente` | 0.123 | 0.123 | MATCH | Legacy alias normalizes to commerce |
| activity_type unknown | 0.22 | 0 | MISMATCH | Legacy unknown activity falls back to services while Shadow can expose zero |
| activity_type absent | 0.22 | 0 | MISMATCH | Legacy missing activity falls back to services while Shadow can expose zero |
| ACRE inactive | 0.22 | 0.22 | MATCH | inactive ACRE keeps standard rate |
| ACRE active | 0.11 | 0.11 | MATCH | active ACRE effective rate matches |
| revenu nul | 0.22 | 0.22 | MATCH | rate independent from weekly revenue amount |
| revenu positif | 0.22 | 0.22 | MATCH | rate independent from weekly revenue amount |
| plusieurs revenus | 0.22 | 0.22 | MATCH | rate independent from weekly revenue amount |

## 6. computed.rate = 0 Analysis

Critical behavior:

```jsx
computed?.rate || getEstimatedRate(dashboardAnswers.activity_type)
```

When `computed.rate = 0`, Legacy does not keep `0`. It falls through to `getEstimatedRate(...)`.

For `services`, the Legacy rate becomes:

```txt
0.22
```

If Shadow effective rate is strictly:

```txt
0
```

the result is:

```txt
MISMATCH
```

This was not normalized or corrected. The mismatch remains visible in the evidence.

## 7. Activity Mapping

Legacy `getEstimatedRate` mapping:

| Input | Normalized | Rate |
| --- | --- | ---: |
| `services` / `service` | `services` | 0.22 |
| `commerce` / `vente` / `sale` / `sales` | `commerce` | 0.123 |
| `mixte` / `mix` / `mixed` | `mixte` | 0.18 |
| unknown | unknown | 0.22 |
| missing | `services` | 0.22 |

The unknown and missing activity fallbacks are not equivalent to the Shadow/domain unknown activity behavior when Shadow exposes `0`.

## 8. ACRE Assessment

ACRE scenarios covered:

- inactive ACRE: `0.22` vs `0.22`, MATCH;
- active ACRE: `0.11` vs `0.11`, MATCH.

No ACRE-specific mismatch was found in the targeted weekly rate evidence.

## 9. Weekly Context Isolation

The weekly recap combines rate with:

- current week date logic;
- weekly revenue filtering;
- invoice count;
- reminder count;
- next action label;
- helper text.

LOT 5.42 isolates only the rate source. It does not compare the full weekly recap object.

The evidence keeps `weeklyEstimatedCharges` as a derived demonstration only:

```jsx
Math.round(weeklyRevenueTotal * estimatedRate)
```

No weekly formula was changed.

## 10. Date Determinism

The rate comparison requires no date.

The test does not introduce:

- `Date.now()`;
- implicit `new Date()`;
- timezone dependency;
- locale dependency.

The production weekly block still has date logic, but this evidence deliberately isolates the rate source and does not execute weekly date filtering.

## 11. Invoice Isolation

The evidence:

- does not modify invoices;
- does not read or write invoice persistence;
- does not call Supabase;
- does not call invoice mutation handlers;
- does not include invoice state in the rate decision.

The production weekly block's invoice count remains out of scope.

## 12. Reminder Isolation

The evidence:

- does not modify reminders;
- does not read or write reminder persistence;
- does not call reminder handlers;
- does not include reminder state in the rate decision.

The production weekly block's reminder count remains out of scope.

## 13. MATCH Results

MATCH scenarios:

- service standard;
- commerce standard;
- mixte standard;
- positive `computed.rate`;
- `computed.rate = null` with commerce fallback;
- `computed.rate = undefined` with services fallback;
- known alias `vente`;
- ACRE inactive;
- ACRE active;
- zero weekly revenue;
- positive weekly revenue;
- multiple weekly revenues.

All MATCH comparisons use strict identity through `Object.is`.

## 14. MISMATCH Results

MISMATCH scenarios:

- `computed.rate = 0`: Legacy returns fallback `0.22`, Shadow candidate remains `0`;
- unknown activity: Legacy returns fallback `0.22`, Shadow candidate can expose `0`;
- missing activity: Legacy returns fallback `0.22`, Shadow candidate can expose `0`.

These mismatches are now characterized as real contract differences for fallback behavior. They are not corrected, rounded, tolerated, normalized or hidden.

## 15. Determinism

Validated:

- same input twice;
- cloned input;
- different references with identical values;
- stable MATCH/MISMATCH classification.

No mutable external state is used.

## 16. Mutation Safety

Validated:

- Legacy input is not mutated;
- Shadow input is not mutated;
- invoice fixture is not mutated;
- reminder fixture is not mutated.

The test uses frozen fixtures for mutation safety.

## 17. Tests

Initial sandbox run:

```bash
node --test tests/lot-5-42-weekly-recap-effective-rate-parity-evidence.test.js
```

Sandbox result:

```text
FAIL - spawn EPERM
```

The same command was rerun outside sandbox with the approved `node --test` prefix.

Final targeted results:

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
duration_ms 148.4075
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
duration_ms 110.1686
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
duration_ms 169.2062
```

```bash
node --test tests/lot-5-40-objective-savings-progress-bar-stabilization.test.js
```

```text
tests 20
suites 0
pass 20
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 160.1071
```

```bash
npx eslint tests/lot-5-42-weekly-recap-effective-rate-parity-evidence.test.js
```

```text
PASS - no output
```

Not run by scope:

- full `node --test`;
- `npm run build`;
- global `npm run lint`;
- Playwright;
- application.

## 18. Risks

Risks before migration:

- migrating this consumer directly would change behavior for `computed.rate = 0`;
- unknown activity and missing activity can diverge between Legacy fallback and Shadow zero-rate behavior;
- the weekly block has date/invoice/reminder neighbors even though rate evidence is isolated;
- future migration would add a 9th `fiscalSummaryVisibleSlice` occurrence and requires a dedicated gate.

No runtime rollback is needed because LOT 5.42 made no runtime change.

## 19. Recommended Next LOT

Recommended next lot:

```txt
LOT 5.43 - Weekly Rate Mismatch Investigation
```

Purpose:

- determine whether the `computed.rate = 0`, unknown activity and missing activity divergences are acceptable historical fallback behavior, real business mismatches, or migration blockers;
- decide whether the future migration must preserve the Legacy `|| getEstimatedRate(...)` fallback around `fiscalSummaryVisibleSlice.effectiveRate`;
- do this without changing runtime code unless a later implementation lot explicitly authorizes it.

## 20. Final Decision

GO POUR LOT 5.43 — WEEKLY RATE MISMATCH INVESTIGATION
