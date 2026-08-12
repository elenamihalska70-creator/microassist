# LOT 5.8 - Parity Evidence Gate Review

## 1. Executive Summary

This review assesses whether the current Shadow Mode parity mechanism provides enough evidence to authorize any visible migration from Legacy to the Calculation Facade.

Decision: the current evidence is not sufficient for visible replacement.

The Shadow Mode path exists, the compared fields are explicitly listed, and the comparison helper is static, ordered, and side-effect free in source. However, the parity result is not observable at runtime, no deterministic parity evidence harness exists, no scenario matrix proves real MATCH/MISMATCH outcomes, and implicit current-date usage remains a determinism concern for ACRE-sensitive comparisons.

Legacy must remain the single source of truth for UI, persistence, exports, assistant messages, dashboards, summaries, and API payloads.

## 2. Scope and Authority

Scope reviewed:

- LOT 5.0 Calculation Facade Architecture.
- LOT 5.1 Minimal Calculation Facade.
- LOT 5.2 Facade Contract and Boundary Hardening.
- LOT 5.3 Integration Adapter Gate Review.
- LOT 5.4 Minimal Integration Adapter.
- LOT 5.5 Shadow Integration Gate Review.
- LOT 5.6 Minimal Shadow Integration.
- LOT 5.7 Shadow Parity Validation.
- Current adapter, facade, App shadow integration, and related tests.

Authority:

- Permanent Migration Guard.
- Permanent Deterministic Parity Guard.
- Calculation Facade architectural guard.
- LOT 5.8 request constraints.

This document does not approve visible migration.

## 3. Current Shadow Architecture

Current production architecture remains Legacy-first.

Legacy computes user-visible values through existing App logic and `computeObligations`. Shadow Mode builds a DTO through `buildFiscalSummaryInput`, executes `calculateFiscalSummary`, creates a parity report, and discards the local report with `void`.

The current Shadow path:

- reads the same local application inputs used by the dashboard;
- builds a facade input DTO;
- calls the Calculation Facade;
- compares a fixed first-slice set of Legacy and Shadow fields;
- does not write React state;
- does not write persistence;
- does not update Supabase;
- does not update localStorage;
- does not update exports;
- does not update visible UI.

This satisfies the Migration Guard for non-replacement, but it does not yet provide sufficient parity evidence.

## 4. Permanent Architectural Guards

### Permanent Migration Guard

Legacy remains the only source of truth until parity is explicitly validated.

Current assessment:

- UI replacement: absent.
- Persistence replacement: absent.
- Export replacement: absent.
- API payload replacement: absent.
- Dashboard replacement: absent.
- Assistant-message replacement: absent.

Status: respected for the reviewed Shadow implementation.

### Permanent Deterministic Parity Guard

Parity validation must be deterministic, pure, reproducible, and side-effect free.

Current assessment:

- The comparison helper itself is structurally deterministic in source.
- The compared field order is explicit.
- Comparison uses exact equality through `Object.is`.
- The helper does not contain rounding, tolerance, persistence, UI access, or logging.
- The full runtime parity pipeline is not proven deterministic because current App-level inputs include implicit current-date sources.

Status: insufficient evidence for deterministic parity validation.

### Calculation Facade Guard

The facade must orchestrate existing domains and must not directly calculate fiscal business values.

Current assessment:

- Previous facade hardening and tests provide static and unit evidence that direct formulas are not placed in the facade.
- LOT 5.8 did not re-open facade implementation for changes.

Status: no new violation identified in this review.

## 5. Compared Fields Inventory

| Field | Legacy source | Shadow source | Type | Criticality |
| --- | --- | --- | --- | --- |
| `revenue.total` | `currentMonthTotal` in `src/App.jsx` | `shadowResult.revenue.total` | number | Critical |
| `summary.baseAmount` | `currentMonthTotal` in `src/App.jsx` | `shadowResult.summary.baseAmount` | number | Critical |
| `summary.finalContributionAmount` | `computed.estimatedAmount` | `shadowResult.summary.finalContributionAmount` | number | Critical |
| `summary.effectiveRate` | `computed.rate` | `shadowResult.summary.effectiveRate` | number or null | Critical |
| `acre.status` | `computed.acreStatus` | `shadowResult.contributions.acre.acreStatus` | string or null | Critical for ACRE cases |

The first slice is intentionally narrow. It covers revenue total, contribution base, final amount, effective rate, and ACRE status.

## 6. Evidence Classification

| Evidence class | Current status | Confidence |
| --- | --- | --- |
| Static source evidence | Present for comparison structure and Shadow passivity | PARTIAL |
| Unit evidence | Present for adapter, facade, domains, and static parity checks | PARTIAL |
| Integration evidence | Build and Playwright previously passed with Shadow enabled | WEAK |
| Runtime parity evidence | No observable captured parity report | NONE |
| Scenario parity evidence | No Legacy-vs-Shadow scenario matrix for compared fields | NONE |
| Deterministic parity evidence | No repeated-run or cloned-input evidence for the full parity path | NONE |
| Visible replacement evidence | Not applicable; replacement remains forbidden | NONE |

## 7. Field-by-Field Evidence Matrix

| Field | Static comparison exists | Runtime MATCH proven | Runtime MISMATCH proven | Deterministic proof | Confidence |
| --- | --- | --- | --- | --- | --- |
| `revenue.total` | Yes | No | No | No | PARTIAL |
| `summary.baseAmount` | Yes | No | No | No | PARTIAL |
| `summary.finalContributionAmount` | Yes | No | No | No | WEAK |
| `summary.effectiveRate` | Yes | No | No | No | WEAK |
| `acre.status` | Yes | No | No | No | WEAK |

`revenue.total` and `summary.baseAmount` have stronger structural evidence because both sides are intended to represent the same revenue base in the current first slice. They still lack runtime evidence.

`summary.finalContributionAmount`, `summary.effectiveRate`, and `acre.status` remain more exposed because they depend on contribution, ACRE, rate, and date-sensitive behavior.

## 8. Scenario Coverage Matrix

| Scenario | Domain tests exist | Adapter tests exist | Facade tests exist | Legacy-vs-Shadow parity scenario exists | Confidence |
| --- | --- | --- | --- | --- | --- |
| Standard non-ACRE activity | Yes | Yes | Yes | No | PARTIAL |
| ACRE active | Yes | Yes | Yes | No | WEAK |
| ACRE expired | Yes | Yes | Yes | No | WEAK |
| Missing ACRE start date | Yes | Yes | Yes | No | WEAK |
| Multiple revenues | Yes | Yes | Yes | No | PARTIAL |
| Empty revenues | Yes | Yes | Yes | No | PARTIAL |
| Invalid DTO shape | Yes | Yes | Yes | No | PARTIAL |
| Repeated identical input | No for full parity path | No for full parity path | No for full parity path | No | NONE |
| Cloned identical input | No for full parity path | No for full parity path | No for full parity path | No | NONE |

Existing tests verify pieces of the pipeline. They do not prove end-to-end Legacy-vs-Shadow parity.

## 9. Determinism Assessment

The parity comparison helper is deterministic by structure:

- fixed field list;
- fixed field order;
- exact `Object.is` comparison;
- no implicit tolerance;
- no hidden rounding;
- no persistence;
- no logging;
- no React state mutation.

The full parity validation path is not yet proven deterministic:

- Shadow input currently receives `referenceDate` from an App helper based on the current date.
- Legacy obligation calculation uses current-date behavior internally.
- ACRE-related fields may be sensitive to date boundaries.
- No test executes the same complete parity input twice and proves identical output.
- No test executes cloned inputs and proves identical output.
- No test freezes or injects all date inputs for the full Legacy-vs-Shadow comparison.

Assessment: deterministic comparison mechanism is PARTIAL; deterministic parity validation evidence is NONE.

## 10. Runtime Observability Assessment

The current parity report is created locally and intentionally discarded.

Observed current behavior:

- no UI display;
- no persistence;
- no export;
- no API payload;
- no permanent logs;
- no state mutation;
- no test-visible artifact.

This preserves Shadow Mode passivity, but it prevents proof collection.

Answer to the gate question: no, the project does not currently know from evidence whether a real application scenario produced MATCH or MISMATCH.

## 11. Static Test Assessment

`tests/shadow-parity-validation.test.js` provides useful static evidence:

- MATCH and MISMATCH constants exist.
- `Object.is` is used for exact comparison.
- first-slice field names are present.
- the Shadow block calls the adapter, facade, and parity report helper.
- the Shadow block voids the report and result.
- forbidden side effects are absent from the inspected Shadow block.
- rounding and implicit default normalization are absent from the inspected comparison area.

Limitations:

- it does not execute the comparison helper;
- it does not import App runtime behavior;
- it does not observe real parity reports;
- it does not test repeated execution;
- it does not test cloned inputs;
- it does not prove immutable Legacy or Shadow values at runtime;
- it does not prove date independence.

Confidence: PARTIAL.

## 12. Existing Test Suite Assessment

Existing adapter, facade, domain, and UI tests are valuable regression coverage.

They support these conclusions:

- adapter mapping is structurally covered;
- facade contract and orchestration are covered;
- contribution and ACRE domain behavior have focused tests;
- Shadow Mode does not visibly break the app in existing Playwright coverage;
- global build previously succeeded with Shadow integration present.

They do not support these conclusions:

- real Legacy-vs-Shadow parity is proven;
- all first-slice fields match for approved scenarios;
- mismatch ordering is captured and stable in evidence;
- ACRE-sensitive comparisons are deterministic across dates;
- same input produces same parity report twice;
- no mutation occurs across repeated full parity runs.

Confidence: PARTIAL for component correctness; NONE for full parity evidence.

## 13. Known Matches

No runtime-proven field-level MATCH is currently available.

Static source suggests intended matches for:

- `revenue.total`;
- `summary.baseAmount`;
- `summary.finalContributionAmount`;
- `summary.effectiveRate`;
- `acre.status`.

Static intent is not parity evidence.

Confidence: NONE for runtime-proven matches.

## 14. Known Mismatches

No runtime-proven field-level MISMATCH is currently available.

Potential mismatch areas requiring evidence:

- exact amount rounding;
- exact effective-rate representation;
- ACRE active or expired status;
- missing ACRE start date behavior;
- date boundary behavior;
- revenue period interpretation.

Confidence: NONE for runtime-proven mismatches.

## 15. Unknown or Missing Evidence

Missing evidence:

- observable parity report in a test or approved evidence harness;
- deterministic fixture set;
- explicit reference date for every parity scenario;
- repeated-run proof;
- cloned-input proof;
- different-reference same-value proof;
- no Legacy mutation proof;
- no Shadow mutation proof;
- no side-effect-between-runs proof;
- field-by-field evidence files or assertions;
- approved scenario matrix;
- ACRE edge-case parity proof;
- known MATCH examples;
- known MISMATCH examples.

This is the primary blocker for any migration beyond Shadow Mode.

## 16. First Slice Evidence Assessment

The first slice is well chosen, but not yet proven.

Strengths:

- small field set;
- fixed order;
- critical business values included;
- exact comparison;
- no implicit tolerance;
- no visible replacement.

Weaknesses:

- no runtime evidence;
- no deterministic full-path evidence;
- no scenario evidence;
- no stored or test-captured parity report;
- no date-controlled comparison harness.

Assessment: suitable first slice for evidence implementation, not suitable for migration.

## 17. Minimum Evidence Criteria

Before any visible replacement can be considered, the project needs at least:

- deterministic fixture inputs;
- explicit reference dates;
- Legacy and Shadow values captured by tests;
- same input executed twice with identical result;
- cloned input executed with identical result;
- different object references with identical values producing identical result;
- no mutation of Legacy input or result;
- no mutation of Shadow input or result;
- no side effects between runs;
- fixed field ordering;
- field-level MATCH and MISMATCH reporting;
- ACRE active, expired, missing-date, and non-ACRE scenarios;
- zero use of implicit current date in parity comparison evidence;
- zero visible replacement.

These are minimum criteria, not final migration approval.

## 18. Risks

| Risk | Impact | Confidence |
| --- | --- | --- |
| Runtime parity result is never observed | Cannot prove MATCH or MISMATCH | SUFFICIENT |
| Date-sensitive ACRE behavior is not controlled | Same logical scenario may differ over time | PARTIAL |
| Exact numeric comparison has no tolerance | Minor representation differences become MISMATCH | PARTIAL |
| Revenue period semantics may diverge | Base amounts may appear aligned without proof | PARTIAL |
| Static tests may give false confidence | Source shape can pass while runtime parity fails | SUFFICIENT |
| Visible migration before evidence | User-visible regression risk | SUFFICIENT |

## 19. Stop Conditions

Visible migration must stop if any of the following remain true:

- no deterministic parity evidence exists;
- parity results are not observable in tests or an approved harness;
- implicit current date influences comparison results;
- same input can produce different reports;
- cloned input can produce different reports;
- Legacy values are mutated;
- Shadow values are mutated;
- field order is not stable;
- tolerance is introduced without an approved dedicated LOT;
- any Shadow value replaces a Legacy-visible or persisted value.

Current status: visible migration is stopped.

## 20. Rollback

No rollback is required for LOT 5.8 because this is a documentation-only gate review.

If a future parity evidence implementation introduces side effects or visible replacement, rollback should remove the evidence mechanism from production paths and restore Shadow Mode to passive execution only.

Rollback principle:

- preserve Legacy source of truth;
- remove unsafe parity evidence wiring;
- keep deterministic pure test utilities only if they do not affect runtime state;
- do not alter fiscal formulas as part of rollback unless the offending LOT changed them.

## 21. Recommended Next LOT

Recommended next LOT:

LOT 5.9 - Parity Evidence Implementation.

Required scope:

- create an approved deterministic evidence harness;
- use explicit fixture inputs and explicit dates;
- execute the same input twice;
- execute cloned identical inputs;
- compare different object references with identical values;
- assert no mutation of Legacy values;
- assert no mutation of Shadow values;
- assert no side effects between runs;
- capture field-level parity reports in tests;
- include non-ACRE and ACRE scenarios;
- keep Legacy as the only source of truth;
- avoid UI, persistence, Supabase, localStorage, exports, and API payload changes.

Forbidden scope:

- visible replacement;
- hidden normalization;
- implicit tolerance;
- implicit current date;
- logging as evidence;
- persistence as evidence;
- network or Supabase as evidence;
- changing fiscal formulas to force parity.

## 22. Final Decision

The current Shadow Mode parity mechanism is useful, passive, and narrow, but the evidence is not sufficient for visible migration.

The next safe step is not replacement. The next safe step is deterministic parity evidence implementation.

GO POUR LOT 5.9 — PARITY EVIDENCE IMPLEMENTATION
