# LOT 5.12 - First Visible Replacement Gate Review

## 1. Executive Summary

LOT 5.12 is the final documentation gate before authorizing a minimal first visible replacement in a future implementation LOT.

Decision: the first slice is ready for a strictly limited visible replacement implementation LOT.

This decision is based on LOT 5.11 evidence: every approved first-slice scenario passed MATCH, the comparison is deterministic, the intentional MISMATCH control is detected and preserved, and no proof was normalized or corrected to obtain MATCH.

No implementation is performed in LOT 5.12. Legacy remains the only source of truth until a dedicated LOT explicitly performs the replacement.

## 2. Scope and Authority

Authority documents read:

- `docs/LOT_5_5_SHADOW_INTEGRATION_GATE_REVIEW.md`;
- `docs/LOT_5_6_MINIMAL_SHADOW_INTEGRATION_REPORT.md`;
- `docs/LOT_5_7_SHADOW_PARITY_VALIDATION_REPORT.md`;
- `docs/LOT_5_8_PARITY_EVIDENCE_GATE_REVIEW.md`;
- `docs/LOT_5_9_RUNTIME_PARITY_EVIDENCE_IMPLEMENTATION_REPORT.md`;
- `docs/LOT_5_10_FIRST_VISIBLE_REPLACEMENT_GATE_REVIEW.md`;
- `docs/LOT_5_11_ADDITIONAL_PARITY_EVIDENCE_REPORT.md`.

Sources inspected:

- `src/App.jsx`;
- `src/application/adapters/buildFiscalSummaryInput.js`;
- `src/domain/calculations/facade/calculateFiscalSummary.js`;
- `src/application/shadow/runtimeParityEvidence.js`;
- `tests/lot-5-11-additional-parity-evidence.test.js`.

LOT 5.10 defines the first slice candidate. LOT 5.11 defines the additional evidence result. LOT 5.5 defines integration and rollback strategy.

## 3. Current Architecture

Current visible architecture remains Legacy-first:

```text
App.jsx
  -> currentMonthTotal
  -> computed via computeObligations
  -> dashboard/UI visible values
```

Current Shadow architecture remains passive:

```text
App.jsx
  -> buildFiscalSummaryInput
  -> calculateFiscalSummary
  -> createRuntimeParityEvidence
  -> temporary evidence store
  -> no UI, no state, no persistence
```

The Adapter maps App DTO fields into Facade input fields. The Facade orchestrates Revenue, Contributions, and Legacy ACRE. The runtime evidence mechanism compares only the approved first-slice fields.

## 4. Permanent Guards

Permanent Facade Guard: READY. The future replacement does not require facade changes or business calculations in `calculateFiscalSummary`.

Permanent Migration Guard: READY for current state. Legacy remains the source of truth until LOT 5.13 explicitly changes one isolated visible slice.

Permanent Shadow Rule: READY with exception required in LOT 5.13. Shadow is currently read only by approved validation/evidence paths. LOT 5.13 must define a narrow exception for the approved visible slice.

Permanent Deterministic Parity Guard: READY. LOT 5.11 proves deterministic first-slice evidence with fixed dates, repeated inputs, cloned inputs, and distinct references.

Permanent Evidence Integrity Guard: READY. The intentional MISMATCH is preserved and asserted; no tolerance, fallback, hidden normalization, or correction is introduced.

Permanent Slice Isolation Guard: READY. The first slice is exactly five fields and must not expand.

## 5. First Slice Definition

Slice name:

```text
Dashboard fiscal first visible replacement slice
```

Fields:

- `revenue.total`;
- `summary.baseAmount`;
- `summary.finalContributionAmount`;
- `summary.effectiveRate`;
- `acre.status`.

Components concerned:

- `src/App.jsx` dashboard computation area;
- dashboard fiscal cards and declaration helper values that currently read `currentMonthTotal`, `estimatedCharges`, `computed.rate`, or `computed.acreStatus`.

Precise Legacy reads:

- `currentMonthTotal` from `revenues.reduce(...)`;
- `computed.estimatedAmount` from `computeObligations(...)`;
- `computed.rate` from `computeObligations(...)`;
- `computed.acreStatus` from `computeObligations(...)`;
- `estimatedCharges` derived from `currentMonthTotal * computed.rate`.

Shadow equivalents:

- `shadowResult.revenue.total`;
- `shadowResult.summary.baseAmount`;
- `shadowResult.summary.finalContributionAmount`;
- `shadowResult.summary.effectiveRate`;
- `shadowResult.contributions.acre.acreStatus`.

Direct dependencies:

- `revenues`;
- `dashboardAnswers.activity_type`;
- `dashboardAnswers.acre`;
- `dashboardAnswers.acre_start_date`;
- explicit `referenceDate`;
- Adapter;
- Calculation Facade;
- Revenue domain;
- Contributions domain;
- Legacy ACRE domain.

Excluded dependencies:

- TVA;
- CFE;
- deadlines;
- labels;
- assistant messages;
- exports;
- Supabase;
- localStorage;
- invoices;
- reminders;
- dashboard coaching;
- financial health;
- annual projection.

Expected UI impact for LOT 5.13:

- value source changes only for the approved slice;
- labels, layout, interaction, and formatting remain unchanged.

Forbidden UI impact:

- new cards;
- changed labels;
- changed workflows;
- changed exports;
- changed assistant output;
- changed persistence;
- broader dashboard migration.

## 6. Legacy / Shadow Mapping

| Champ | Chemin Legacy | Chemin Shadow | Type | Preuve LOT 5.11 | Statut |
| --- | --- | --- | --- | --- | --- |
| `revenue.total` | `currentMonthTotal` | `shadowResult.revenue.total` | number | MATCH across approved scenarios, no UNKNOWN | READY |
| `summary.baseAmount` | `currentMonthTotal` | `shadowResult.summary.baseAmount` | number | MATCH across approved scenarios, no UNKNOWN | READY |
| `summary.finalContributionAmount` | `computed.estimatedAmount` / visible equivalent currently also derived as `estimatedCharges` | `shadowResult.summary.finalContributionAmount` | number | MATCH across approved scenarios, intentional MISMATCH detected | READY |
| `summary.effectiveRate` | `computed.rate` | `shadowResult.summary.effectiveRate` | number or null | MATCH across approved scenarios, no UNKNOWN | READY |
| `acre.status` | `computed.acreStatus` | `shadowResult.contributions.acre.acreStatus` | string or null | MATCH across ACRE active, expired, boundary, missing start date, inactive | READY |

All fields are READY.

## 7. Evidence Review

LOT 5.11 covered 13 real first-slice scenarios plus one intentional MISMATCH control.

Covered evidence properties:

- real Legacy snapshot;
- real Adapter path;
- real Facade path;
- field-level comparison;
- global MATCH/MISMATCH status;
- deterministic fixed reference date;
- controlled test clock for Legacy date behavior;
- repeated identical input;
- cloned input;
- distinct references with identical values;
- no Legacy mutation;
- no Shadow mutation;
- no input mutation;
- disabled evidence store has no application effect;
- stable evidence order;
- no network;
- no Supabase;
- no localStorage;
- no `Math.random`;
- intentional MISMATCH detection.

This is parity evidence, not only contract evidence.

## 8. Scenario Coverage

Approved scenarios covered by LOT 5.11:

- revenu nul;
- revenu positif simple;
- plusieurs revenus;
- service;
- vente / commerce;
- mixte;
- ACRE inactive;
- ACRE active;
- ACRE expired;
- ACRE boundary still active;
- ACRE missing start date;
- period change with explicit monthly window;
- low amount;
- high amount;
- restored equivalent values;
- repeated input;
- cloned input;
- distinct references with same values.

No approved first-slice scenario remains UNKNOWN.

No real residual MISMATCH remains.

## 9. Runtime Readiness

The future replacement can use Shadow without:

- new network call;
- new Supabase access;
- new localStorage access;
- new persistence;
- new payload;
- new formula;
- new rate;
- new rounding;
- new tolerance;
- new business mapping;
- new hidden normalization.

The future LOT should reuse the already available Adapter and Facade pipeline and expose only selected summary values to the approved visible slice.

New React state is not required for LOT 5.13. The preferred implementation is a local memoized selector or equivalent local value derived from the existing Shadow execution, guarded by an explicit static feature flag.

## 10. UI Readiness

The future replacement is UI-ready only if it preserves:

- current JSX structure;
- labels;
- formatting through existing display helpers;
- interactions;
- workflows;
- persistence behavior;
- export behavior;
- assistant behavior;
- dashboard sections outside the slice.

The future LOT must replace only the data source for the approved values. It must not modify labels, cards, layout, navigation, assistant output, exports, or saved data.

## 11. Double Source of Truth Assessment

Risk: during LOT 5.13, Legacy may still power persistence, exports, assistant messages, and out-of-slice dashboard values while Shadow powers the first visible slice.

Assessment:

- contradiction risk: low if only one visible source is used for each approved value;
- visual divergence risk: low for the approved slice because LOT 5.11 proved MATCH;
- persistence divergence risk: non-blocking if persistence remains Legacy and is clearly out of scope;
- export divergence risk: non-blocking if exports remain Legacy and are not represented as migrated;
- assistant/dashboard inconsistency risk: low to medium because other summaries may still use Legacy wording or derived values.

Mitigation:

- LOT 5.13 must define a single visible source for each approved field;
- LOT 5.13 must not migrate persistence, exports, assistant messages, or out-of-slice dashboard values;
- LOT 5.13 tests must prove only the selected visible slice reads Shadow;
- rollback must restore Legacy reads for those values only.

Status: non-blocking with strict slice isolation.

## 12. Performance Assessment

Current Shadow already performs an additional Adapter and Facade calculation when enabled.

LOT 5.13 performance risk:

- double calculation: low to medium, already present in passive Shadow;
- render cost: low if no JSX structure changes;
- recomputation risk: medium if dependencies are broadened;
- loop risk: low if no state/effect is introduced;
- memoization divergence risk: low to medium if the selector uses the same dependency set as the existing Shadow block.

Mitigation:

- keep `trace: false`;
- keep the replacement local and memoized;
- do not use `useEffect` or `useState`;
- do not write evidence on render outside existing mechanism;
- keep dependencies explicit and narrow.

Status: non-blocking.

## 13. Rollback Readiness

Rollback for LOT 5.13 must be immediate and local:

- restore Legacy read for `revenue.total`;
- restore Legacy read for `summary.baseAmount`;
- restore Legacy read for `summary.finalContributionAmount`;
- restore Legacy read for `summary.effectiveRate`;
- restore Legacy read for `acre.status`;
- remove the visible Shadow selector;
- keep Shadow Pipeline LOT 5.6;
- keep Parity Validation LOT 5.7;
- keep Runtime Evidence LOT 5.9;
- keep LOT 5.11 tests.

Rollback must not require:

- data migration;
- Supabase rollback;
- localStorage rollback;
- payload transformation;
- export correction;
- manual user correction.

Status: READY.

## 14. Risks

| Risk | Niveau | Justification | Mitigation | Statut |
| --- | --- | --- | --- | --- |
| Functional value divergence | Low | LOT 5.11 proves MATCH for approved scenarios | Keep exact first slice only | Non-blocking |
| Fiscal interpretation risk | Medium | Values are fiscal-facing | No formula/rate change; Shadow already matches Legacy | Non-blocking |
| Rounding risk | Low | No new rounding permitted | Use existing Shadow value directly and existing display formatting | Non-blocking |
| Formatting risk | Medium | UI formatting currently wraps Legacy numbers | Reuse existing display helpers and labels | Non-blocking |
| Silent divergence | Medium | Shadow visible while Legacy powers other outputs | Keep parity evidence and add LOT 5.13 visible-source tests | Non-blocking |
| UX risk | Low | No layout/label/workflow change allowed | Snapshot or DOM tests for unchanged surface | Non-blocking |
| Rollback risk | Low | Rollback restores local Legacy reads only | Feature flag and local selector | Non-blocking |
| Maintenance risk | Medium | Legacy and Shadow coexist | Document and test the single-slice exception | Non-blocking |
| Scope risk | High | Expanding beyond five fields would violate guard | Stop condition in LOT 5.13 | Non-blocking if enforced |
| Hidden dependency risk | Medium | Date-sensitive logic exists historically | Use existing explicit Shadow reference date, no new hidden date | Non-blocking |
| Stale state risk | Low | No new state required | Prefer `useMemo` or local selector | Non-blocking |
| Double source of truth risk | Medium | Persistence/exports remain Legacy | Do not claim those surfaces migrated | Non-blocking |
| Screen/persistence inconsistency | Medium | UI slice may be Shadow while saved/exported values remain Legacy | Limit wording to dashboard slice and continue evidence validation | Non-blocking |

No blocking risk remains for authorizing a tightly scoped implementation LOT.

## 15. Feature Flag Decision

A feature flag is required for LOT 5.13.

Required flag properties:

- local;
- explicit;
- static;
- no Supabase;
- no localStorage;
- no persistence;
- no randomness;
- no implicit activation;
- rollbackable by setting it to false or removing the selector.

Recommended flag:

```text
FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED
```

Default recommendation for implementation LOT:

- start as `false` during tests;
- explicitly set to `true` only inside the implementation LOT after tests prove the source switch;
- keep Shadow evidence active and passive.

## 16. LOT 5.13 Proposed Scope

Authorized files:

- `src/App.jsx`;
- one dedicated LOT 5.13 test file;
- `docs/LOT_5_13_FIRST_VISIBLE_REPLACEMENT_REPORT.md`.

Exact replacement location:

- adjacent to existing `computed`, `currentMonthTotal`, and Shadow execution in `src/App.jsx`;
- before dashboard consumers build display values.

Allowed visible values:

- `revenue.total`;
- `summary.baseAmount`;
- `summary.finalContributionAmount`;
- `summary.effectiveRate`;
- `acre.status`.

Preferred implementation shape:

- create a local memoized Shadow summary selector;
- if the feature flag is enabled and Shadow result is available, use Shadow values for the approved slice;
- otherwise use Legacy values;
- do not change labels, formatting, structure, exports, persistence, assistant output, or payloads.

Forbidden:

- domain changes;
- adapter contract changes;
- facade contract changes;
- new formula;
- new rounding;
- new tolerance;
- new persistence;
- new UI structure;
- out-of-slice values.

## 17. Required Tests for LOT 5.13

LOT 5.13 must include tests proving:

- only the approved fields can read Shadow visibly;
- no out-of-slice field reads Shadow visibly;
- feature flag disabled restores Legacy source;
- feature flag enabled uses Shadow source for the approved slice;
- no state write is introduced;
- no Supabase/localStorage/network access is introduced;
- no export or assistant path is changed;
- labels and formatting remain unchanged;
- rollback path is local;
- existing LOT 5.11 parity tests still pass;
- MISMATCH detection remains preserved and unmasked.

Validation required:

- targeted LOT 5.13 tests;
- relevant Node tests;
- build;
- lint, with historical debt documented if unchanged;
- targeted lint for modified files;
- Playwright.

## 18. Stop Conditions

LOT 5.13 must stop if:

- any field outside the approved slice is touched;
- any field mapping is ambiguous;
- any required Shadow value is unavailable;
- any real MISMATCH appears;
- any formula is added;
- any rounding is added;
- any tolerance is added;
- any adapter/facade/domain contract changes;
- any persistence changes;
- any payload changes;
- any export changes;
- any assistant output changes;
- any new React state is required;
- rollback cannot be done by restoring local Legacy reads;
- the feature flag cannot fully disable visible replacement;
- double source of truth appears for the same visible value.

## 19. Rollback

Rollback for this LOT:

- delete `docs/LOT_5_12_FIRST_VISIBLE_REPLACEMENT_GATE_REVIEW.md`.

Rollback for future LOT 5.13:

- disable or remove `FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED`;
- restore approved values to Legacy reads;
- remove visible Shadow selector;
- keep Shadow pipeline;
- keep parity validation;
- keep runtime evidence;
- keep parity evidence tests.

## 20. Final Decision

Scope control confirmations:

- exactly one document created;
- no existing file modified;
- no code modified;
- no test modified;
- no UI modified;
- no persistence modified;
- no payload modified;
- no export modified;
- no dashboard modified;
- no assistant output modified;
- no formula modified;
- no rate modified;
- no rounding modified;
- no business logic modified;
- no user behavior modified.

Legacy remains the only source of truth.

Shadow remains passive.

All fields in the approved first slice are READY.

GO POUR LOT 5.13 — FIRST VISIBLE REPLACEMENT
