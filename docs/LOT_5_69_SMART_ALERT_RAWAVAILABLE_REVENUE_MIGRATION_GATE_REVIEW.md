# LOT 5.69 - Smart Alert rawAvailable Revenue Migration Gate Review

## 1. Executive Summary

LOT 5.69 is a documentation-only migration gate review.

No migration was implemented. `src/App.jsx` was not modified. No smart alert formula, threshold, ON/OFF logic, severity, priority, message, persistence path, payload, export, assistant, coaching, invoice or reminder behavior was changed.

Reviewed consumer:

```txt
Smart alerts - currentMonthTotal revenue input for reserve-low rawAvailable
```

Gate result:

```txt
READY
```

The consumer can proceed to a source-only migration implementation because LOT 5.68 proved revenue input parity, `rawAvailable` parity and reserve-low ON/OFF parity for covered supported scenarios.

## 2. Consumer Exact

File:

```txt
src/App.jsx
```

Block:

```txt
smartAlerts useMemo / buildSmartAlerts(...) call
```

Current Legacy expression:

```jsx
currentMonthTotal
```

Current call site:

```jsx
buildSmartAlerts({
  answers: dashboardAnswers,
  computed,
  revenues,
  invoices: visibleInvoices,
  reminderPrefs,
  estimatedCharges: smartAlertEstimatedCharges,
  currentMonthTotal,
})
```

Authorized future Shadow expression:

```jsx
currentMonthTotal: fiscalSummaryVisibleSlice.revenueTotal
```

`buildSmartAlerts` parameter remains:

```jsx
currentMonthTotal = 0
```

This keeps the internal function contract unchanged while changing only the source passed by the call site.

## 3. Downstream Formula and Alert Contract

Current `rawAvailable` formula:

```jsx
const rawAvailable = Number(currentMonthTotal || 0) - Number(estimatedCharges || 0);
```

Current ON/OFF condition:

```jsx
if (estimatedCharges > 0 && rawAvailable < estimatedCharges)
```

Reserve-low output remains:

- `id: "reserve-low"`
- `level: "warning"`
- `title: "Réserve à renforcer"`
- `text: "La réserve actuelle couvre moins d’un cycle de charges estimées."`
- `cta: "Ajouter une dépense"`
- `action: "profile"`

Priority remains:

```txt
TVA threshold -> ACRE ending -> reserve-low -> early-tracking -> all-clear
```

## 4. Parity Review

LOT 5.68 confirmed:

- revenue input parity;
- `rawAvailable` parity;
- threshold below/exact/above parity;
- alert ON/OFF parity;
- same reserve-low severity and message;
- ACRE inactive parity;
- ACRE active parity;
- same input determinism;
- cloned input determinism;
- mutation safety;
- intentional mismatch visibility.

Validated targeted results:

```txt
LOT 5.68: 14/14 PASS
LOT 5.66: 15/15 PASS
LOT 5.65: 14/14 PASS
shadow parity: 6/6 PASS
runtime evidence: 11/11 PASS
targeted ESLint: PASS
```

Classification:

```txt
READY
```

## 5. rawAvailable Formula Isolation

The future migration does not require changes to:

- `rawAvailable` formula;
- operators;
- subtraction/addition;
- `Number(...)` fallback;
- `Math.max`;
- `Math.min`;
- `Math.round`;
- `smartAlertEstimatedCharges`;
- threshold;
- `availableAmount` global.

Required future implementation shape is source-only:

```diff
- currentMonthTotal,
+ currentMonthTotal: fiscalSummaryVisibleSlice.revenueTotal,
```

No new computation is approved.

## 6. Alert Boundary Safety

LOT 5.68 validated boundary behavior with `chargesInput = 100`:

| Revenue input | rawAvailable | State | Result |
| ---: | ---: | --- | --- |
| 199 | 99 | ALERT_ON | MATCH |
| 200 | 100 | ALERT_OFF | MATCH |
| 201 | 101 | ALERT_OFF | MATCH |

Additional supported states validated:

- revenue = 0;
- positive revenue;
- decimal revenue;
- multiple revenues;
- charges = 0;
- charges positive;
- low reserve;
- high reserve;
- ACRE inactive;
- ACRE active.

No real boundary mismatch was found.

## 7. Feature Flag

The future migration can reuse the existing visible selector:

```jsx
revenueTotal: usesShadow
  ? shadowResult.revenue.total
  : currentMonthTotal
```

Behavior:

```txt
Flag ON + Shadow Result -> Shadow revenue.total
Flag OFF -> Legacy currentMonthTotal
Missing Shadow Result -> Legacy currentMonthTotal
```

No new feature flag is required or approved for LOT 5.70.

## 8. Shadow Baseline

Current baseline:

```txt
fiscalSummaryVisibleSlice = 12 occurrences
```

Expected future baseline after LOT 5.70 implementation:

```txt
fiscalSummaryVisibleSlice = 13 occurrences
```

The only approved new occurrence is the smart-alert revenue input:

```jsx
currentMonthTotal: fiscalSummaryVisibleSlice.revenueTotal
```

No 14th occurrence is approved.

## 9. currentMonthTotal Legacy Retention

`currentMonthTotal` must remain Legacy in all other retained consumers.

This gate does not authorize migration of:

- feedback;
- analytics;
- exports;
- PDF;
- assistant-adjacent values;
- other dashboard consumers;
- calculations;
- persistence;
- payloads;
- obligations;
- cockpit estimate;
- any other smart alert.

Known retained examples:

```jsx
realMonthlyRevenue: currentMonthTotal
```

```jsx
totalRevenues: currentMonthTotal || 0
```

```jsx
getDisplayValue(currentMonthTotal, "money")
```

## 10. Dependency Array

Current dependencies:

```jsx
[
  dashboardAnswers,
  computed,
  revenues,
  visibleInvoices,
  reminderPrefs,
  smartAlertEstimatedCharges,
  currentMonthTotal,
]
```

Future migration should update dependencies minimally.

Expected dependency impact:

```diff
- currentMonthTotal,
+ fiscalSummaryVisibleSlice.revenueTotal,
```

Do not add unrelated dependencies.

After replacing the call-site revenue input, `currentMonthTotal` should remain in this dependency array only if it is still read inside the `smartAlerts` `useMemo` block. The currently reviewed block shows no other direct `currentMonthTotal` read in that `useMemo`.

## 11. No Propagation

The selected consumer does not:

- write Supabase;
- write `localStorage`;
- write `sessionStorage`;
- construct payloads;
- feed assistant output;
- feed exports;
- feed PDF;
- alter invoice state;
- alter reminder state.

LOT 5.70 must preserve this isolation.

## 12. React / State

The future migration does not require:

- new `useState`;
- new `useEffect`;
- new `useMemo`;
- new Context;
- new business helper;
- second Adapter execution;
- second Facade execution.

The existing visible slice is already computed upstream and is sufficient for the approved source replacement.

## 13. Rollback

Future rollback must be local to the `smartAlerts` call site:

```diff
- currentMonthTotal: fiscalSummaryVisibleSlice.revenueTotal,
+ currentMonthTotal,
```

Rollback must not touch:

- `buildSmartAlerts`;
- `rawAvailable`;
- threshold;
- severity;
- message;
- priority;
- data migration;
- persistence;
- Adapter;
- Facade;
- Domain;
- Rules Engine.

## 14. Future LOT 5.70 Instructions

If LOT 5.70 proceeds, authorized file:

```txt
src/App.jsx
```

Authorized block:

```txt
smartAlerts useMemo / buildSmartAlerts(...) call
```

Expression replacement:

```diff
- currentMonthTotal,
+ currentMonthTotal: fiscalSummaryVisibleSlice.revenueTotal,
```

Dependency replacement:

```diff
- currentMonthTotal,
+ fiscalSummaryVisibleSlice.revenueTotal,
```

Expected source baseline:

```txt
fiscalSummaryVisibleSlice: 12 -> 13
```

Required targeted tests for LOT 5.70:

- LOT 5.68 rawAvailable revenue parity evidence;
- LOT 5.66 reserve-low stabilization;
- LOT 5.65 reserve-low migration validation;
- shadow parity validation;
- runtime parity evidence;
- targeted lint for any new or modified test if LOT 5.70 creates one.

Do not run full suite, build, global lint, Playwright or application unless the LOT 5.70 brief explicitly requests it.

## 15. Stop Conditions for LOT 5.70

Stop if implementation requires:

- changing `rawAvailable`;
- changing `smartAlertEstimatedCharges`;
- changing threshold;
- changing ON/OFF logic;
- changing severity/message/priority;
- new calculation;
- new rounding;
- new fallback;
- new feature flag;
- persistence/payload/assistant change;
- non-local rollback;
- additional Shadow consumer beyond the approved 13th occurrence;
- any Permanent Guard violation.

## 16. Risks

No real parity or boundary mismatch was found.

Residual risk is limited to the existing reserve-low threshold sensitivity:

```txt
revenue < 2 * chargesInput => ALERT_ON
revenue >= 2 * chargesInput => ALERT_OFF
```

LOT 5.68 already proved that a real mismatch near this boundary would be visible through revenue mismatch, `rawAvailable` mismatch and ON/OFF divergence. No such real mismatch was observed.

## 17. Validation

Per LOT 5.69 scope, only lightweight validation is authorized:

```txt
git diff --stat
git status --short
git diff -- docs/LOT_5_69_SMART_ALERT_RAWAVAILABLE_REVENUE_MIGRATION_GATE_REVIEW.md
git status --short --untracked-files=all -- docs/LOT_5_69_SMART_ALERT_RAWAVAILABLE_REVENUE_MIGRATION_GATE_REVIEW.md
```

Not authorized:

- `node --test`;
- `npm run build`;
- `npm run lint`;
- Playwright;
- application run.

## 18. Final Decision

GO POUR LOT 5.70 — SMART ALERT RAWAVAILABLE REVENUE MIGRATION IMPLEMENTATION
