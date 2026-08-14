# LOT 5.19 - Next Consumer Migration Gate Review

## 1. Executive Summary

LOT 5.19 is a documentation-only gate review.

No migration was implemented.

No application file was modified.

No test was created.

Recommended next consumer: the dashboard URSSAF declaration helper availability gate currently reading `currentMonthTotal > 0` in `src/App.jsx`.

Recommended LOT 5.20: migrate this single gate to the existing first-slice visible selector, because it depends only on the already-proven `revenue.total` field, has no persistence, payload, export or assistant dependency, and can be rolled back locally.

## 2. Scope and Authority

Authority documents:

- `docs/LOT_5_13_FIRST_VISIBLE_REPLACEMENT_REPORT.md`;
- `docs/LOT_5_14_FIRST_VISIBLE_REPLACEMENT_VALIDATION_REPORT.md`;
- `docs/LOT_5_15_FIRST_SLICE_STABILIZATION_REPORT.md`;
- `docs/LOT_5_17_LEGACY_REMOVAL_GATE_REVIEW.md`;
- `docs/LOT_5_18_LEGACY_RETENTION_HARDENING_REPORT.md`;
- `docs/LOT_5_9_RUNTIME_PARITY_EVIDENCE_IMPLEMENTATION_REPORT.md`;
- `docs/LOT_5_11_ADDITIONAL_PARITY_EVIDENCE_REPORT.md`.

Inspected:

- `src/App.jsx`;
- dashboard consumers;
- summaries;
- assistant-adjacent state;
- exports;
- payload builders;
- persistence paths;
- feedback and analytics;
- obligations;
- simulator / preview paths;
- invoice-related consumers;
- consumers authorized by LOT 5.18.

LOT 5.18 remains the authority on authorized Legacy retention.

## 3. Current Migration State

The first visible slice is already Shadow-backed through `fiscalSummaryVisibleSlice` when the local flag is ON and Shadow Result exists.

Approved first-slice fields:

- `revenue.total`;
- `summary.baseAmount`;
- `summary.finalContributionAmount`;
- `summary.effectiveRate`;
- `acre.status`.

Legacy remains active as compatibility layer for rollback, parity, runtime evidence, persistence, exports, assistant-adjacent state, dashboard consumers outside the slice, payloads, and historical tests.

## 4. Permanent Guards

Permanent Facade Guard: no Facade change is proposed.

Permanent Migration Guard: no new migration happened in this LOT.

Permanent Shadow Rule: only one future consumer is selected for study.

Permanent Deterministic Parity Guard: candidate evidence is tied to deterministic LOT 5.11 and LOT 5.18 proof.

Permanent Evidence Integrity Guard: no mismatch can be hidden by this document.

Permanent Slice Isolation Guard: only one consumer is recommended.

Legacy Retention Guard: Legacy remains retained and is not extended.

## 5. Remaining Consumer Inventory

| ID | Category | File / block | Value consumed | Legacy source | Shadow available | User visible | React state | Persistence | Payload | Export | Assistant | Time | Rule dependency | Tests / evidence | Rollback | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-01 | Dashboard hors first slice | `App.jsx` dashboard URSSAF helper around `currentMonthTotal > 0` | revenue presence gate | `currentMonthTotal` | yes, `fiscalSummaryVisibleSlice.revenueTotal` / `revenue.total` | yes | JSX only | no | no | no | no | no | no new rule | LOT 5.11, 5.13-5.18 | local one-line rollback | Low |
| C-02 | Dashboard hors first slice | `App.jsx` progress indicators `isFiscalProfileComplete && currentMonthTotal > 0` | revenue presence plus savings progress | `currentMonthTotal`, `savingsProgress`, `savingsGoal` | revenue only | yes | JSX | no | no | no | no | no | savings values not Shadow | partial | local but adjacent values unproved | Medium |
| C-03 | Dashboard hors first slice | `dashboardAvailableDisplay` | available amount | `availableAmount` | no approved `availableAmount` field | yes | derived display | no | no | yes indirectly | no | no | formula | no | not safe | High |
| C-04 | Summary hors first slice | `dashboardMonthlyReflection` | revenue and charges text | `currentMonthTotal`, `estimatedCharges` | yes for fields, but summary not approved | potentially yes / currently lint-reported unused | useMemo | no | no | no | assistant-adjacent tone | no | formatter/text | partial | local | Medium |
| C-05 | Assistant-adjacent state | `simpleAssistantGuidance` | real monthly revenue | `currentMonthTotal` | yes for revenue | yes | useMemo | no | no | no | yes | no | assistant guidance rules | partial | local but assistant-adjacent | Medium |
| C-06 | Assistant messages | local assistant draft / `LS_KEY` paths | answers/messages/profile | local draft state | no | yes | state + localStorage | yes | yes | no | yes | no | workflow | no | not local | High |
| C-07 | Exports | PDF fiscal report | revenue, charges, available, deadlines, TVA/CFE | `currentMonthTotal`, `computed`, displays | partial | exported | callback | no direct write except file | analytics after export | yes | no | `new Date()` in export | multiple rules | partial | not local | High |
| C-08 | Persistence | Supabase / localStorage profile and revenue sync | source data and payloads | persisted Legacy inputs | no direct Shadow replacement | no / data | useEffect/callbacks | yes | yes | no | yes via drafts | yes in some paths | workflow | no | not local | High |
| C-09 | Payloads | `feedbackContextSnapshot`, `trackEvent` | total revenues, annual projection, TVA state | `currentMonthTotal`, `computed` | partial | no direct UI | useMemo/callback | no | yes | no | no | yes for ACRE remaining | multiple rules | partial | local but payload change | High |
| C-10 | Feedback / Analytics | beta feedback prompts and events | revenue count, invoices, context | Legacy app state | partial | yes | state/callbacks | localStorage feedback state | yes | no | no | yes | prompt rules | no | not local | High |
| C-11 | Simulator | revenue modal preview | preview charges, available, rate label | `computed?.rate`, `getRevenueContributionRate` | effectiveRate partial; per-revenue category not first slice | yes | useMemo | no | no | no | no | no | new formula/rate risk | no | not safe | High |
| C-12 | Obligations | `computeObligations` call | full obligation object | `currentMonthTotal`, `dashboardAnswers`, YTD/months | Facade exists but not full Legacy output | indirectly | useMemo | no | no | yes/assistant/dashboard downstream | yes | `new Date()` in Legacy | full fiscal rules | partial first slice only | not local | High |
| C-13 | Invoice-related | invoices section, invoice PDF/XML, invoice persistence | invoice totals/status/dates | invoice state and invoice helpers | no | yes/exported | state/callbacks | yes | yes | yes | no | dates | invoice rules | no | not local | High |
| C-14 | Other dashboard | smart alerts / smart priorities / coaching | alerts, reserve, TVA, ACRE, deadlines | `computed`, `estimatedCharges`, `currentMonthTotal`, `availableAmount` | partial | yes | useMemo/effects/logging | no | analytics | no | no | dates in ACRE/recency | multiple rules | partial | not isolated | High |
| C-15 | Other dashboard | TVA diagnostic modal CA fallback | `currentMonthTotal` and TVA state | `currentMonthTotal`, `computed?.tvaStatus` | revenue only | yes | modal state | no | no | no | no | no direct but TVA rules | partial | local but mixed | Medium |

## 6. Consumer Classification

Safe candidate:

- C-01 dashboard URSSAF declaration helper availability gate.

Promising but not next:

- C-02 progress indicators;
- C-04 monthly reflection;
- C-05 simple assistant guidance;
- C-15 TVA diagnostic CA fallback.

Blocked:

- C-03 available amount;
- C-06 assistant messages;
- C-07 exports;
- C-08 persistence;
- C-09 payloads;
- C-10 feedback / analytics;
- C-11 simulator;
- C-12 obligations;
- C-13 invoices;
- C-14 smart alerts / priorities.

## 7. Candidate Scoring Method

Score out of 10:

- 2 points: isolated to one local consumer;
- 1 point: Shadow field already exists;
- 1 point: parity evidence already exists;
- 1 point: no persistence;
- 1 point: no payload;
- 1 point: no export;
- 1 point: no assistant dependency;
- 1 point: rollback local;
- 1 point: low UI / business risk.

Any candidate requiring Domain, Adapter, Facade, formula, rate, rounding, persistence, payload, export or assistant changes is capped at 4.

## 8. Candidate Matrix

| Consumer | Valeur métier | Source Legacy | Source Shadow | Parité | Persistence | Payload | UI Risk | Rollback | Score |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-01 URSSAF helper availability gate | revenue presence | `currentMonthTotal > 0` | `fiscalSummaryVisibleSlice.revenueTotal > 0` | existing `revenue.total` proof | none | none | low | one local condition | 10 |
| C-02 progress indicators gate | revenue presence + savings progress | `currentMonthTotal`, savings values | revenue only | partial | none | none | medium | local but adjacent formulas | 6 |
| C-04 monthly reflection | revenue + charges text | `currentMonthTotal`, `estimatedCharges` | fields exist | partial for text/format | none | none | medium | local | 7 |
| C-05 simple assistant guidance | monthly revenue guidance | `currentMonthTotal` | revenue exists | field proof only | none | none | medium | local but assistant-adjacent | 6 |
| C-07 PDF export summary | exported fiscal summary | broad Legacy | partial | no write but export output | analytics | high | not local | 3 |
| C-09 feedback context | analytics values | `currentMonthTotal`, `computed` | partial | none | yes | low UI, high payload | local but payload | 4 |
| C-11 revenue preview simulator | charge preview/rate | `computed?.rate`, per-revenue rate | partial | none | none | medium | formula risk | 3 |
| C-14 smart alerts | alerts/reserve/deadlines | broad Legacy | partial | none | analytics downstream | high | not isolated | 3 |
| C-15 TVA diagnostic CA fallback | revenue fallback in modal | `currentMonthTotal` | revenue exists | field proof only | none | none | medium | local but mixed TVA | 6 |

## 9. Excluded Consumers

Excluded for the next migration:

- exports: require export output migration and include `new Date()` formatting, `computed`, `dashboardChargesDisplay`, `dashboardAvailableDisplay`, TVA/CFE/deadlines and analytics;
- persistence: requires Supabase/localStorage and payload contract changes;
- payloads / feedback / analytics: changing them is explicitly blocked for simple visible migration;
- assistant messages and assistant-adjacent persistence: require assistant compatibility review;
- simulator / preview: would touch rate selection, rounding, per-revenue categories and formulas;
- obligations: would require changing the central Legacy calculation source;
- invoice-related consumers: include invoice state, persistence, exports and invoice contracts;
- available amount / savings: Shadow has no approved `availableAmount` field;
- smart alerts / priorities: broad coupling to computed values, dates, invoices, premium triggers and analytics;
- progress indicators: visually local but dependent on `savingsGoal` and `savingsProgress`, which are not first-slice fields;
- TVA diagnostic CA fallback: local but mixed with TVA status and modal logic, so less isolated than C-01.

## 10. Parity Evidence Assessment

Already proved fields:

- `revenue.total`;
- `summary.baseAmount`;
- `summary.finalContributionAmount`;
- `summary.effectiveRate`;
- `acre.status`.

C-01 requires only `revenue.total`.

Existing evidence:

- LOT 5.11 compares `currentMonthTotal`-equivalent deterministic Legacy revenue totals to `shadowResult.revenue.total`;
- LOT 5.13 validates declaration helper amount already reads `fiscalSummaryVisibleSlice.revenueTotal`;
- LOT 5.14 validates fallback and falsy Shadow values;
- LOT 5.15 validates stability;
- LOT 5.18 guards the remaining Legacy `currentMonthTotal > 0` consumer.

Missing evidence for implementation:

- a focused guard that the helper visibility condition uses the visible selector;
- zero revenue behavior;
- positive revenue behavior;
- absent Shadow fallback behavior;
- no other consumer migrated.

These are implementation tests, not additional parity evidence.

## 11. Consumer Contract Assessment

Candidate C-01 current contract:

- location: dashboard priority hero URSSAF declaration helper;
- current input: React render state already available in `App.jsx`;
- Legacy read: `currentMonthTotal > 0`;
- visible amount: already `getDisplayValue(fiscalSummaryVisibleSlice.revenueTotal, "money")`;
- possible Shadow read: `fiscalSummaryVisibleSlice.revenueTotal > 0`;
- formatter: unchanged;
- fallback: inherited from `fiscalSummaryVisibleSlice`;
- feature flag: existing local flag only;
- React dependencies: none beyond render variables;
- visible behavior: chooses detailed declaration helper vs "Ajoute un revenu";
- rollback: restore `currentMonthTotal > 0`.

This can replace the gate value without changing formatter, labels, persistence, payloads, exports, assistant, Adapter, Facade, Domain, formulas, rates or rounding.

## 12. Double Source of Truth Assessment

C-01 reduces double-source risk because the visible amount in the same helper already reads `fiscalSummaryVisibleSlice.revenueTotal`.

Using Legacy for the gate while Shadow supplies the displayed amount leaves a small local inconsistency risk. Moving the gate to the same selector aligns the condition with the displayed amount.

No adjacent persistence, export, assistant or payload receives the migrated value.

## 13. UI / UX Assessment

C-01 does not require:

- label change;
- formatter change;
- unit change;
- loading state;
- empty state redesign;
- error state redesign;
- layout change;
- interaction change.

Possible visible difference is limited to the condition deciding which existing helper text appears when Legacy and Shadow revenue totals diverge. That divergence is already covered by parity evidence and fallback behavior.

## 14. React and State Assessment

C-01 uses existing render data:

- `fiscalSummaryVisibleSlice`;
- existing local flag through the selector;
- existing Shadow `useMemo`;
- existing Legacy fallback.

It requires no:

- `useState`;
- `useEffect`;
- new context;
- new callback;
- new Facade execution;
- new Adapter execution;
- new double calculation.

## 15. Persistence Assessment

C-01 has no Supabase read/write and no localStorage read/write.

The future migration must not alter:

- revenue persistence;
- fiscal profile persistence;
- invoice persistence;
- assistant draft persistence;
- feedback persistence;
- export counters.

## 16. Payload Assessment

C-01 does not feed a payload.

The future migration must not alter:

- `trackEvent`;
- beta feedback context;
- Supabase payload builders;
- assistant draft payloads;
- export analytics payloads.

## 17. Export Assessment

C-01 does not feed exports.

Exports remain Legacy-compatible and explicitly excluded.

## 18. Assistant Assessment

C-01 does not feed assistant messages, assistant drafts, assistant state or assistant output.

Assistant-adjacent consumers remain excluded.

## 19. Feature Flag Decision

Use the existing local feature flag indirectly through `fiscalSummaryVisibleSlice`.

Do not create a new flag.

Rationale:

- the selected gate belongs to the already-approved first slice;
- the selector already contains deterministic Shadow/Legacy fallback;
- rollback remains immediate;
- no persistence or global configuration is introduced.

## 20. Rollback Assessment

Rollback for the future implementation:

- restore the helper condition from `fiscalSummaryVisibleSlice.revenueTotal > 0` to `currentMonthTotal > 0`;
- leave Legacy calculations untouched;
- leave Shadow untouched;
- leave Adapter, Facade, Domain and Rules untouched;
- leave persistence, payloads, exports and assistant untouched.

Rollback is local and does not require data migration.

## 21. Recommended Consumer

Recommended consumer:

```text
Dashboard URSSAF declaration helper availability gate
```

Current Legacy expression:

```text
currentMonthTotal > 0
```

Future candidate expression:

```text
fiscalSummaryVisibleSlice.revenueTotal > 0
```

Why this consumer:

- depends only on `revenue.total`;
- uses a field already present in Shadow;
- parity is already proved for that field;
- amount displayed in the same helper already uses the visible selector;
- no persistence, payload, export or assistant dependency;
- no new state;
- no formula, rate or rounding change;
- rollback is one local condition.

## 22. Rejected Candidates

Rejected for LOT 5.20 implementation:

- `dashboardAvailableDisplay`: Shadow lacks approved available amount.
- progress indicators: tied to savings formulas and percentage rendering.
- `dashboardMonthlyReflection`: summary text, invoices and assistant-adjacent tone make it less isolated.
- `simpleAssistantGuidance`: assistant-adjacent guidance requires a dedicated assistant gate.
- PDF export: export output change is forbidden for simple next consumer migration.
- feedback context: payload change is forbidden.
- revenue modal preview: touches rates and rounding.
- smart alerts / priorities: broad rules and date dependencies.
- obligations: central Legacy calculation, not a consumer-only swap.
- invoices: persistence/export/invoice contract coupling.
- TVA diagnostic modal: mixed with TVA status and modal behavior.

## 23. Required Evidence

No additional parity evidence LOT is required before implementation because C-01 uses only `revenue.total`, already covered.

Required implementation evidence in LOT 5.20:

- selector field remains `fiscalSummaryVisibleSlice.revenueTotal`;
- flag ON uses Shadow for the gate;
- flag OFF uses Legacy through selector fallback;
- zero Shadow revenue keeps empty helper behavior;
- positive Shadow revenue keeps declaration helper detail;
- formatter remains unchanged;
- no persistence, payload, export or assistant change;
- no new state/effect;
- no second consumer migrated;
- no new Legacy consumer added;
- LOT 5.18 retention guard updated only if necessary and justified.

## 24. Exact LOT 5.20 Scope

Recommended exact scope:

- modify only the URSSAF declaration helper availability gate in `src/App.jsx`;
- replace only the gate source from direct Legacy to the existing visible selector;
- keep all labels, formatting, CTA, links and JSX structure unchanged;
- add a focused LOT 5.20 test;
- update the LOT 5.18 Legacy retention guard if the approved `currentMonthTotal` reference count changes;
- create a LOT 5.20 report.

Out of scope:

- exports;
- persistence;
- payloads;
- assistant;
- available amount;
- savings;
- TVA/CFE/deadlines;
- simulator;
- invoices;
- Adapter;
- Facade;
- Domain;
- formulas;
- rates;
- rounding;
- CSS/navigation/workflow changes.

Chosen option: Consumer Migration Implementation.

## 25. Future Test Plan

LOT 5.20 tests should verify:

- Shadow source visible for the gate when flag ON;
- Legacy source reachable through selector fallback when flag OFF or Shadow absent;
- zero revenue behavior unchanged;
- positive revenue behavior unchanged;
- formatting unchanged;
- UI text unchanged;
- no new React state;
- no new Facade execution;
- persistence unchanged;
- payload unchanged;
- export unchanged;
- assistant unchanged;
- MISMATCH evidence remains observable;
- no other consumer migrated.

## 26. Risks

Risk assessment for C-01:

- business risk: low, revenue presence only;
- fiscal risk: low, no calculation change;
- UI risk: low, existing branch only;
- formatting risk: none, formatter unchanged;
- React risk: low, no new state or effect;
- state stale risk: low, selector already memoized;
- double source risk: reduced locally;
- persistence risk: none;
- payload risk: none;
- export risk: none;
- assistant risk: none;
- rollback risk: low;
- absence of proof risk: low for `revenue.total`;
- scope extension risk: medium, must be guarded by a one-consumer LOT 5.20.

## 27. Stop Conditions

No stop condition is triggered for C-01.

Stop conditions that would trigger NO-GO for LOT 5.20:

- more than one consumer is migrated;
- implementation needs a new field outside `revenue.total`;
- implementation changes persistence, payloads, exports or assistant;
- implementation changes Adapter, Facade, Domain or Rules;
- implementation adds a formula, rate or rounding;
- rollback becomes non-local;
- visible text or UI structure changes;
- evidence cannot preserve MATCH/MISMATCH.

## 28. Final Decision

GO POUR LOT 5.20 — NEXT CONSUMER MIGRATION IMPLEMENTATION
