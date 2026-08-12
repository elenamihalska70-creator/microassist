# LOT 5.23 - Next Consumer Migration Gate Review

## 1. Executive Summary

LOT 5.23 is documentation-only.

No migration was implemented. No application file was modified. No test was created.

The safest next candidate after URSSAF gate stabilization is:

```text
Dashboard progress indicators revenue-presence gate
```

Current Legacy condition:

```text
isFiscalProfileComplete && currentMonthTotal > 0
```

Future candidate condition:

```text
isFiscalProfileComplete && fiscalSummaryVisibleSlice.revenueTotal > 0
```

Recommended LOT 5.24:

```text
NEXT CONSUMER MIGRATION IMPLEMENTATION
```

Reason: this candidate is a local boolean visibility gate, uses only the already proven `revenue.total` field, needs no persistence/payload/export/assistant change, and rolls back by restoring one local expression.

## 2. Scope and Authority

Authority documents read:

- `docs/LOT_5_18_LEGACY_RETENTION_HARDENING_REPORT.md`;
- `docs/LOT_5_19_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md`;
- `docs/LOT_5_20_NEXT_CONSUMER_MIGRATION_IMPLEMENTATION_REPORT.md`;
- `docs/LOT_5_21_NEXT_CONSUMER_MIGRATION_VALIDATION_REPORT.md`;
- `docs/LOT_5_22_NEXT_CONSUMER_STABILIZATION_REPORT.md`;
- `docs/LOT_5_13_FIRST_VISIBLE_REPLACEMENT_REPORT.md`;
- `docs/LOT_5_15_FIRST_SLICE_STABILIZATION_REPORT.md`;
- `docs/LOT_5_17_LEGACY_REMOVAL_GATE_REVIEW.md`.

Inspected:

- `src/App.jsx`;
- `fiscalSummaryVisibleSlice`;
- remaining `currentMonthTotal` consumers;
- contribution amount consumers;
- effective-rate consumers;
- ACRE consumers;
- dashboard cards and gates;
- summary blocks;
- assistant-adjacent state;
- obligations;
- simulator/preview paths;
- exports;
- persistence paths;
- payload builders;
- analytics/feedback;
- invoice-related consumers;
- tests and previous LOT reports.

LOT 5.18 is the authority for authorized Legacy retention. LOT 5.22 is the authority for the stabilized current URSSAF state.

## 3. Current Migration State

Already Shadow-backed through `fiscalSummaryVisibleSlice` when the local flag is ON and Shadow Result exists:

- dashboard revenue display;
- dashboard amount-to-set-aside display for real revenue;
- priority estimated amount via `dashboardChargesDisplay`;
- declaration helper amount;
- URSSAF helper visibility gate.

Approved first-slice fields:

- `revenue.total`;
- `summary.baseAmount`;
- `summary.finalContributionAmount`;
- `summary.effectiveRate`;
- `acre.status`.

Legacy remains retained for rollback, parity, runtime evidence, persistence compatibility, exports, assistant-adjacent state, payload/analytics compatibility and non-migrated dashboard consumers.

## 4. Permanent Guards

Permanent Facade Guard: respected. No Facade change is proposed.

Permanent Migration Guard: respected. This document selects one future consumer only.

Permanent Shadow Rule: respected. No new Shadow read is added in this LOT.

Permanent Deterministic Parity Guard: respected. Candidate assessment relies on already deterministic `revenue.total` evidence.

Permanent Evidence Integrity Guard: respected. No MISMATCH is hidden or transformed.

Permanent Slice Isolation Guard: respected. Exactly one candidate is selected.

Legacy Retention Guard: respected. Legacy remains a compatibility layer and no new Legacy consumer is added.

## 5. Remaining Consumer Inventory

| ID | Category | File / block | Value used | Legacy source | Shadow available | Visible | React dependency | Persistence | Payload | Export | Assistant | Time | Rule dependency | Existing evidence/tests | Rollback | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-02 | Display gate | `src/App.jsx` progress indicators around `isFiscalProfileComplete && currentMonthTotal > 0` | revenue presence | `currentMonthTotal > 0` | yes, `fiscalSummaryVisibleSlice.revenueTotal` | yes | JSX condition | no | no | no | no | no | savings values inside block but not the gate | LOT 5.11, 5.13-5.22 cover revenue total and isolation | one condition restore | Low |
| C-03 | Dashboard card/value | `dashboardAvailableDisplay` / available amount | available cash estimate | `availableAmount` | no approved available field | yes | memo/display | no | indirect analytics/export use | yes indirectly | no | no | formula `currentMonthTotal - estimatedCharges` | not proved as Shadow field | not local enough | High |
| C-04 | Summary | `dashboardMonthlyReflection` | revenue/charges/invoice text | `currentMonthTotal`, `estimatedCharges`, `visibleInvoices` | partial revenue/charge fields | currently unused lint target / summary builder | `useMemo` | no | no | no | assistant-adjacent tone | no | formatter/text composition | partial | local but broad text contract | Medium |
| C-05 | Assistant-adjacent | `simpleAssistantGuidance` | monthly revenue guidance | `currentMonthTotal` | revenue only | yes | `useMemo` | no | no | no | yes | no | guidance tone/rules | partial revenue proof | local but assistant-adjacent | Medium |
| C-06 | Assistant messages/drafts | `readLocalDraftPayload`, `LS_KEY`, message state | answers/messages/profile | localStorage and app state | no direct Shadow contract | yes | state/effects | yes | yes | no | yes | no | workflow | no | not local | High |
| C-07 | Export | `handleExportPDF` | fiscal report values | `currentMonthTotal`, `computed`, `dashboardChargesDisplay`, `dashboardAvailableDisplay` | partial | exported | callback | export counters | analytics after export | yes | no | `new Date()` in export path | multiple rules | partial | not local | High |
| C-08 | Persistence | Supabase/localStorage profile/revenue/invoice sync | source data and stored payloads | persisted Legacy inputs | no | no/direct data | effects/callbacks | yes | yes | no | yes via draft/profile | yes in some paths | workflow | no | not local | High |
| C-09 | Payload/feedback | `feedbackContextSnapshot`, `trackBetaEvent` | total revenues/context | `currentMonthTotal`, `computed`, invoice counts | partial | no/direct | `useMemo`/callback | no | yes | no | no | some time/export context | analytics contract | partial | local but payload change | High |
| C-10 | Feedback UI | beta feedback prompts/events | revenue/profile/invoice context | app Legacy state | partial | yes | state/callbacks | localStorage feedback state | yes | no | no | yes for prompt recency | prompt rules | no | not local | High |
| C-11 | Simulator/preview | revenue modal preview | preview charges/rate/available | `computed?.rate`, `getRevenueContributionRate`, `previewCharges` | effectiveRate partial | yes | multiple `useMemo` | no | no | no | no | no | per-revenue category/rate | partial | formula risk | High |
| C-12 | Obligations | `computeObligations` call | full obligations object | `currentMonthTotal`, YTD, months, profile | Facade exists but not full Legacy output | indirectly | `useMemo` | no | downstream payload/export/assistant | downstream export | downstream assistant | `new Date()` current year | full fiscal rules | partial first slice only | not local | High |
| C-13 | Invoice-related | invoice section and handlers | invoice totals/status/dates | invoice state/helpers | no | yes/exported | state/callbacks | yes | yes | yes | no | dates | invoice rules | no | not local | High |
| C-14 | Smart dashboard | smart alerts/priorities/coaching | alerts/reserve/TVA/ACRE/deadlines | `computed`, `estimatedCharges`, `currentMonthTotal`, `availableAmount` | partial | yes | memo/callbacks | no | analytics | no | no | dates in ACRE/recency | multiple rules | partial | not isolated | High |
| C-15 | TVA diagnostic | TVA modal/revenue fallback | revenue plus TVA status | `currentMonthTotal`, `computed?.tvaStatus` | revenue only | yes | modal state | no | no | no | no | no direct | TVA rules | partial | local but mixed with TVA | Medium |
| C-16 | Contribution fallback | `estimatedCharges` | contribution amount | `Math.round(currentMonthTotal * computed.rate)` | `summary.finalContributionAmount` exists | yes/fallback/export/savings | `useMemo` | no | indirect | yes | no | no | formula/rounding | field proved, but consumer shared | rollback possible but shared | Medium-High |
| C-17 | Effective rate | `computed?.rate` reads | rate/fallback/PDF/simulator | Legacy `computed.rate` | `summary.effectiveRate` exists | yes/export/simulator | memo/callbacks | no | possible | yes | no | no | rate display/rules | proved field, mixed consumers | not one local consumer | Medium-High |
| C-18 | ACRE status | `computed?.acreStatus` / `dashboardAnswers.acre` | status, hints, profile | Legacy computed/profile | `acre.status` exists | yes | memo/JSX | persistence/profile | payload possible | export text | assistant profile | dates | ACRE rules | proved status only | not isolated | Medium-High |
| C-19 | Other dashboard labels | deadlines, TVA, CFE, financial health | labels and warnings | `computed` object | no complete Shadow field set | yes | JSX/memo | no | analytics | export | assistant-adjacent | dates | broad rules | not proved | not local | High |

## 6. Candidate Classification

Safe next candidate:

- C-02 dashboard progress indicators revenue-presence gate.

Promising but not next:

- C-04 dashboard monthly reflection;
- C-05 simple assistant guidance;
- C-15 TVA diagnostic revenue fallback;
- C-16 contribution display fallback, only after shared-consumer review.

Blocked for a simple migration:

- C-03 available amount;
- C-06 assistant messages/drafts;
- C-07 exports;
- C-08 persistence;
- C-09 payload/feedback context;
- C-10 feedback UI/events;
- C-11 simulator;
- C-12 obligations;
- C-13 invoice-related consumers;
- C-14 smart dashboard;
- C-17 effective-rate shared consumers;
- C-18 ACRE shared consumers;
- C-19 broader dashboard labels.

## 7. Scoring Method

Each candidate is scored out of 12:

- 1 point: exact Shadow field already available;
- 1 point: field already covered by parity;
- 1 point: no new calculation;
- 1 point: no persistence;
- 1 point: no payload/analytics contract;
- 1 point: no export;
- 1 point: no assistant dependency;
- 1 point: no new React state/effect/callback;
- 1 point: no new formatter;
- 1 point: rollback local;
- 1 point: low UX/business risk;
- 1 point: isolated to one visible consumer.

Caps:

- any candidate requiring Adapter, Facade, Domain, Rules, formula, rate or rounding changes is capped at 4;
- any candidate requiring persistence, payload, export or assistant changes is capped at 5;
- any candidate requiring several consumers at once is capped at 6.

## 8. Candidate Matrix

| Consumer | Legacy Source | Shadow Source | Parity | UI Risk | Persistence | Payload | Rollback | Isolation | Score |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-02 progress indicators revenue gate | `currentMonthTotal > 0` | `fiscalSummaryVisibleSlice.revenueTotal > 0` | already proved via `revenue.total` | low | none | none | one condition | high | 11/12 |
| C-04 monthly reflection | `currentMonthTotal`, `estimatedCharges` | revenue and contribution fields partial | partial | medium text risk | none | none | local | medium | 8/12 |
| C-05 simple assistant guidance | `currentMonthTotal` | `revenue.total` | proved | medium assistant-adjacent | none | none | local | medium | 7/12 |
| C-15 TVA diagnostic revenue fallback | `currentMonthTotal` plus TVA state | `revenue.total` only | proved for revenue only | medium | none | none | local | medium-low | 7/12 |
| C-16 contribution amount fallback/display | `estimatedCharges` | `finalContributionAmount` | proved | medium | none | indirect/export | local per use, shared globally | medium | 6/12 |
| C-03 available amount | `availableAmount` | none approved | not proved | medium | none | indirect | not safe | low | 3/12 |
| C-07 PDF export | broad Legacy | partial | partial | exported contract | export counters | analytics | not local | low | 3/12 |
| C-09 feedback context | `currentMonthTotal`, `computed` | partial | partial | low UI, high payload | none | yes | local but contract change | medium | 4/12 |
| C-11 simulator preview | `computed?.rate`, per-revenue category | effectiveRate partial | partial | medium | none | none | formula/rate risk | low | 3/12 |
| C-12 obligations | `computeObligations(...)` | no complete equivalent | not complete | high | downstream | downstream | not local | low | 2/12 |
| C-13 invoices | invoice state/helpers | none | no | high | yes | yes | not local | low | 2/12 |

## 9. Excluded Candidates

Excluded from LOT 5.24 implementation:

- exports: require exported-output contract review, include dates, `computed`, current total, charge display, available display and analytics;
- persistence: requires Supabase/localStorage payload and restore semantics;
- payloads/feedback/analytics: any migration changes telemetry-like contracts;
- assistant messages/drafts: localStorage and assistant workflow compatibility;
- simulator/preview: tied to rate selection, per-revenue category and preview formulas;
- obligations: central Legacy calculation source, broad rule surface;
- invoice-related consumers: persistence/export/invoice contract coupling;
- available amount: no approved Shadow `availableAmount` field;
- smart alerts/priorities: broad coupling to computed values, dates, invoices, premium triggers and analytics;
- TVA diagnostic: mixed with TVA status and modal behavior;
- effective-rate and ACRE consumers: fields are proved, but current consumers are shared with export/profile/rule-adjacent paths;
- monthly reflection: text composition and assistant-adjacent tone make it less safe than a boolean gate.

## 10. Parity Evidence Assessment

Already proved fields:

- `revenue.total`;
- `summary.baseAmount`;
- `summary.finalContributionAmount`;
- `summary.effectiveRate`;
- `acre.status`.

C-02 needs only:

```text
revenue.total
```

Existing proof:

- LOT 5.11 compares Legacy revenue totals to Shadow `revenue.total`;
- LOT 5.13 validates the selector field;
- LOT 5.14 validates falsy Shadow values;
- LOT 5.15 stabilizes the first slice;
- LOT 5.20-5.22 validate and stabilize the URSSAF revenue-presence gate;
- runtime evidence remains active and MISMATCH remains observable.

Missing future proof:

- focused source assertion that the progress gate uses `fiscalSummaryVisibleSlice.revenueTotal > 0`;
- flag ON behavior for this gate;
- flag OFF rollback behavior for this gate;
- no other consumer moved.

These are implementation guards, not new parity evidence requirements.

## 11. Consumer Contract Assessment

Serious candidate C-02:

- current condition: `isFiscalProfileComplete && currentMonthTotal > 0`;
- exact Legacy value: `currentMonthTotal`;
- exact Shadow value: `fiscalSummaryVisibleSlice.revenueTotal`;
- formatter: none in the gate;
- fallback: inherited from `fiscalSummaryVisibleSlice`;
- feature flag: existing first-slice visible selector flag through the selector;
- React dependency: JSX condition only;
- visible behavior: controls whether the progress indicator block appears after profile completion and revenue presence;
- values inside block: `savingsProgress` / `savingsGoal`, not migrated in the same step;
- rollback: restore `currentMonthTotal > 0` in the condition.

Ideal future replacement:

```text
isFiscalProfileComplete && currentMonthTotal > 0
```

to:

```text
isFiscalProfileComplete && fiscalSummaryVisibleSlice.revenueTotal > 0
```

No formatter, UI text, style, interaction, formula, rate or rounding change is required.

## 12. Feature Flag Assessment

C-02 should not introduce a new flag.

Reason:

- the candidate uses the same already approved Shadow field, `revenue.total`;
- the existing selector already provides local flag ON/OFF and absent-Shadow rollback;
- the future migration should read `fiscalSummaryVisibleSlice.revenueTotal`, not direct `shadowResult`;
- rollback remains possible either by restoring the condition or by disabling the existing selector flag.

The existing flag properties remain required:

- local;
- explicit;
- deterministic;
- not persisted;
- no Supabase;
- no localStorage;
- no network;
- no user dependency;
- no implicit date dependency.

## 13. Double Source of Truth Assessment

C-02 currently uses Legacy revenue presence while nearby first-slice dashboard values and the stabilized URSSAF gate use the visible selector.

Migrating C-02 would reduce local divergence risk for revenue-presence decisions.

The block content still displays savings progress derived from Legacy-compatible values, but the candidate only changes whether the block appears when revenue is present. It does not change savings formulas or displayed savings values. That separation must be guarded in LOT 5.24.

No duplicate visible value would be created.

## 14. React and State Assessment

C-02 is favorable because it requires:

- no new `useState`;
- no new `useEffect`;
- no new `useMemo`;
- no new context;
- no new callback;
- no second Adapter call;
- no second Facade call;
- no read before initialization.

It reuses the existing `fiscalSummaryVisibleSlice`, which is already computed before the JSX consumer.

Future tests should freeze relevant identifier counts, as LOT 5.20-5.22 did.

## 15. UI / UX Assessment

C-02 is visible but low risk.

Future migration must not change:

- text;
- label;
- unit;
- formatting;
- progress percentage formula;
- progress bar style;
- layout;
- interaction;
- workflow;
- empty/loading/error states.

Visible behavior remains:

- profile incomplete: block hidden;
- profile complete with no visible revenue: block hidden;
- profile complete with visible revenue: block visible.

## 16. Persistence Assessment

C-02 has no Supabase read/write and no localStorage read/write.

Persistence paths that remain excluded:

- profile save/restore;
- revenue save/restore;
- invoice save/restore;
- assistant drafts;
- guest data migration;
- UI preferences;
- export counters.

Future LOT 5.24 must not touch persistence files or persistence blocks.

## 17. Payload Assessment

C-02 does not build an API, feedback or analytics payload.

Excluded payload paths remain:

- `feedbackContextSnapshot`;
- `trackBetaEvent(...)` payloads;
- Supabase payload builders;
- assistant draft payloads;
- export analytics payloads.

## 18. Export Assessment

C-02 does not feed exported output directly.

Exports remain Legacy-compatible and excluded. Future LOT 5.24 must not change:

- `handleExportPDF`;
- PDF content;
- CSV/text-style export helpers;
- Factur-X XML;
- invoice PDF exports;
- export counters.

## 19. Assistant Assessment

C-02 does not feed assistant messages, assistant drafts, assistant profile writes or assistant output.

Assistant-adjacent candidates such as `simpleAssistantGuidance` and `dashboardMonthlyReflection` remain rejected for LOT 5.24 because they touch guidance/text semantics.

## 20. Rollback Assessment

C-02 rollback is local:

```text
isFiscalProfileComplete && fiscalSummaryVisibleSlice.revenueTotal > 0
```

back to:

```text
isFiscalProfileComplete && currentMonthTotal > 0
```

Rollback does not touch:

- data;
- Supabase;
- localStorage;
- Adapter;
- Facade;
- Domain;
- Rules;
- exports;
- payloads;
- assistant;
- savings formulas.

## 21. Recommended Consumer

Recommended consumer:

```text
Dashboard progress indicators revenue-presence gate
```

Why it is the safest next candidate:

- it is a single boolean condition;
- it reads only revenue presence;
- `revenue.total` is already available through Shadow and the visible selector;
- parity for `revenue.total` is already proven;
- it has no persistence, payload, export or assistant dependency;
- it requires no new calculation, formatter, rate, rounding or fallback;
- it requires no new React state/effect/memo;
- rollback is one local expression;
- it is safer than summaries, assistant-adjacent text, simulator, exports, persistence or broad dashboard rules.

## 22. Rejected Consumers

Rejected for LOT 5.24:

- `dashboardAvailableDisplay`: no approved Shadow available field.
- `dashboardMonthlyReflection`: text composition and invoice/assistant-adjacent tone.
- `simpleAssistantGuidance`: assistant-adjacent guidance.
- `feedbackContextSnapshot`: payload contract.
- `handleExportPDF`: export contract.
- simulator preview: rate/category/formula risk.
- obligations: full Legacy calculation/rules surface.
- invoice section: persistence/export/invoice contract.
- TVA diagnostic: mixed revenue and TVA rule state.
- smart alerts/priorities: broad `computed`/date/analytics dependencies.
- effective-rate displays: shared export/simulator/rule dependencies.
- ACRE displays/hints: profile persistence and rule/date dependencies.

## 23. Required Evidence

LOT 5.24 implementation evidence should prove:

- the progress gate uses exactly `fiscalSummaryVisibleSlice.revenueTotal > 0`;
- no direct `currentMonthTotal > 0` remains for that gate;
- flag ON uses Shadow revenue;
- flag OFF uses Legacy fallback;
- absent Shadow Result uses Legacy fallback;
- zero visible revenue hides the block;
- positive visible revenue shows the block;
- no savings formula changed;
- no progress percentage changed;
- no UI text/style/layout changed;
- no other consumer migrated;
- parity and runtime evidence remain intact;
- Legacy retention guards remain strict.

No additional parity evidence LOT is required before implementation because the candidate uses only `revenue.total`, already covered.

## 24. Exact LOT 5.24 Scope

Recommended LOT 5.24 option:

```text
NEXT CONSUMER MIGRATION IMPLEMENTATION
```

Allowed future files:

- `src/App.jsx`, only for the progress-indicators condition;
- `tests/lot-5-24-next-consumer-migration.test.js`;
- `docs/LOT_5_24_NEXT_CONSUMER_MIGRATION_IMPLEMENTATION_REPORT.md`;
- `tests/lot-5-18-legacy-retention-hardening.test.js`, only if reference counts must be adjusted for the approved removal of one direct Legacy read.

Forbidden in LOT 5.24:

- Adapter;
- Facade;
- Revenue;
- Contributions;
- ACRE;
- Rules;
- Domain models;
- obligations;
- persistence;
- payloads;
- exports;
- assistant;
- invoices;
- simulator;
- styles;
- labels;
- formulas;
- rates;
- rounding.

## 25. Future Test Plan

Do not create tests in this LOT.

Future LOT 5.24 should test:

- exact Shadow source for the progress gate;
- absence of direct Legacy source for that gate;
- flag ON;
- flag OFF;
- absent Shadow fallback;
- zero revenue;
- positive revenue;
- positive to zero;
- zero to positive;
- rollback locality;
- no new state;
- no new effect;
- no new memo if not needed;
- no second Adapter;
- no second Facade;
- parity intact;
- runtime evidence intact;
- persistence unchanged;
- payload unchanged;
- export unchanged;
- assistant unchanged;
- no savings formula change;
- no progress display formula change;
- no other consumer migrated;
- full `node --test`;
- `npm run build`;
- targeted ESLint;
- two `npx playwright test --reporter=line` runs.

## 26. Risks

| Risk | Level | Assessment | Mitigation |
| --- | --- | --- | --- |
| Business risk | Low | revenue presence only | use exact `> 0` condition |
| Fiscal risk | Low | no calculation change | no formulas/rates/rounding |
| UI risk | Low | visibility gate only | preserve JSX and styles |
| Formatting risk | Low | no formatter in gate | do not touch displayed values |
| React risk | Low | existing selector available | no new state/effect/memo |
| State stale risk | Low | selector already memoized | source-count guards |
| Double source risk | Low/Medium | savings values remain Legacy-compatible | migrate only gate, not values |
| Persistence risk | None for candidate | no persistence path | guard no localStorage/Supabase |
| Payload risk | None for candidate | no payload path | guard feedback untouched |
| Export risk | None for candidate | no export path | guard exports untouched |
| Assistant risk | None for candidate | no assistant path | guard assistant untouched |
| Rollback risk | Low | one condition restore | document exact rollback |
| Proof risk | Low | `revenue.total` already proved | targeted implementation tests |
| Scope creep risk | Medium | nearby savings formulas tempting | forbid savings migration |

No stop condition is triggered by selecting this candidate.

## 27. Stop Conditions

LOT 5.24 must stop with NO-GO if:

- the progress gate cannot be isolated;
- migration requires savings formula changes;
- migration requires `availableAmount` migration;
- migration requires Adapter, Facade, Domain or Rules changes;
- migration requires new rate, rounding, normalization or fallback;
- persistence must change;
- payloads must change;
- exports must change;
- assistant must change;
- several consumers must migrate together;
- UI text/style/layout/workflow must change;
- rollback is not local;
- parity or runtime evidence changes;
- a real MISMATCH appears.

## 28. Final Decision

Exactly one document created:

- `docs/LOT_5_23_NEXT_CONSUMER_MIGRATION_GATE_REVIEW.md`.

No code modified.

No test created or modified.

No consumer migrated.

No new slice.

No persistence modified.

No payload modified.

No export modified.

No assistant output modified.

No formula modified.

No rate modified.

No rounding modified.

No business logic modified.

No user behavior modified.

Legacy remains a compatibility layer.

No new Legacy consumer added.

GO POUR LOT 5.24 — NEXT CONSUMER MIGRATION IMPLEMENTATION
