# LOT 5.10 - First Visible Replacement Gate Review

## 1. Summary

LOT 5.10 evaluates whether the project is ready for a first visible replacement of a Legacy value by a Shadow / Calculation Facade value.

Decision: not ready for visible replacement.

The project now has a Domain Layer, Calculation Facade, Adapter, Shadow Integration, Passive Parity Validation, and Runtime Parity Evidence mechanism. These are important foundations, but LOT 5.9 explicitly concludes that current runtime evidence proves the evidence mechanism, not full business parity for every real Legacy scenario.

The next safe step is additional parity evidence, focused on date-controlled full parity fixtures.

## 2. Scope

This review is documentation-only.

Reviewed authority sources:

- LOT 5.5 - Shadow Integration Gate Review.
- LOT 5.6 - Minimal Shadow Integration.
- LOT 5.7 - Shadow Parity Validation.
- LOT 5.8 - Parity Evidence Gate Review.
- LOT 5.9 - Runtime Parity Evidence Implementation Report.

No implementation is performed in this LOT.

## 3. Permanent Guards

### Permanent Facade Guard

No facade code is modified. No business calculation is added to the facade.

Status: respected.

### Permanent Migration Guard

Legacy remains the only source of truth for every user-visible, persisted, exported, assistant, dashboard, summary, and payload value.

Status: respected.

### Permanent Shadow Rule

Shadow may execute, compare, and produce temporary evidence. Shadow must not replace Legacy.

Status: respected.

### Permanent Deterministic Parity Guard

Parity must be deterministic, pure, reproducible, and side-effect free before it can support migration.

LOT 5.9 proves determinism for the evidence module and evidence store. It does not yet prove full App-level Legacy-vs-Shadow parity with all date-sensitive dependencies controlled.

Status: not sufficient for visible replacement.

### Permanent Evidence Integrity Guard

Evidence must be reproducible, auditable, and sufficient for the decision it supports.

LOT 5.9 evidence supports the mechanism. It does not yet support a visible replacement decision.

Status: additional evidence required.

## 4. Evidence Assessment

Current evidence is sufficient to say:

- the runtime evidence mechanism can collect records;
- collection can be active or disabled;
- MATCH can be recorded;
- MISMATCH can be recorded;
- field order is stable;
- compared fields are explicit;
- reproduction data is captured;
- the evidence module avoids UI, state, persistence, network, Supabase, localStorage, `Date.now`, `new Date`, and `Math.random`;
- the evidence module does not mutate Legacy snapshots, Shadow results, or Shadow inputs.

Current evidence is not sufficient to say:

- the first visible replacement is safe;
- all real App-level first-slice scenarios match;
- ACRE-sensitive parity is proven with explicit dates;
- Legacy current-date behavior is fully controlled during parity evidence;
- no real residual MISMATCH exists across the first slice;
- a Shadow value can replace a Legacy value in UI or persistence.

## 5. First Slice Candidate

The first slice candidate remains the minimal fiscal dashboard parity slice:

| Field | Legacy origin | Shadow origin | Candidate status |
| --- | --- | --- | --- |
| `revenue.total` | `currentMonthTotal` | `shadowResult.revenue.total` | Candidate only |
| `summary.baseAmount` | `currentMonthTotal` | `shadowResult.summary.baseAmount` | Candidate only |
| `summary.finalContributionAmount` | `computed.estimatedAmount` | `shadowResult.summary.finalContributionAmount` | Candidate only |
| `summary.effectiveRate` | `computed.rate` | `shadowResult.summary.effectiveRate` | Candidate only |
| `acre.status` | `computed.acreStatus` | `shadowResult.contributions.acre.acreStatus` | Candidate only |

No field is approved for replacement in this LOT.

## 6. Dependencies

The first slice depends on:

- application revenue state;
- fiscal profile answers;
- Legacy `computeObligations`;
- current Legacy dashboard snapshot;
- Adapter DTO mapping;
- Calculation Facade orchestration;
- Revenue domain;
- Contributions domain;
- Legacy ACRE domain;
- explicit reference date handling.

The unresolved dependency is date control across the full Legacy-vs-Shadow comparison path.

## 7. Known Matches

Known mechanism-level MATCH examples exist from LOT 5.9 tests.

Known full App-level business MATCH coverage is not sufficient for visible replacement.

Status: partial.

## 8. Known Mismatches

LOT 5.9 includes a MISMATCH recording proof to validate the evidence mechanism.

No documented residual real-world MISMATCH is approved or investigated enough to classify as a migration blocker requiring formula changes.

Status: no confirmed real residual MISMATCH, but coverage is insufficient.

## 9. Unknown Scenarios

Unknown or insufficiently proven scenarios remain:

- real App-level ACRE active parity with explicit date control;
- real App-level ACRE expired parity with explicit date control;
- missing ACRE start date parity in the complete path;
- boundary dates around ACRE expiration;
- multiple revenue inputs in the complete App parity path;
- empty revenue state in the complete App parity path;
- cloned and repeated complete App parity runs with all dates controlled.

These unknowns block first visible replacement.

## 10. Risk Analysis

| Risk | Assessment |
| --- | --- |
| Functional risk | Medium: first-slice values are user-facing fiscal values. |
| Business risk | High: contribution amount and ACRE status affect user trust. |
| UX risk | Medium: a visible replacement could show unexpected fiscal differences. |
| Performance risk | Low to medium: Shadow evidence is bounded, but App-level execution still runs alongside Legacy. |
| Rollback risk | Low if replacement is not started; higher after UI wiring. |
| Maintenance risk | Medium: Legacy and Shadow date behavior still differ in control points. |
| Technical debt risk | Medium: global lint debt remains historical and unresolved. |
| Determinism risk | Medium: evidence module is deterministic, but full App parity still needs date-controlled proof. |
| Evidence coverage risk | High: current evidence is mechanism-level, not full migration-level. |

## 11. Mandatory Criteria

| Criterion | Result |
| --- | --- |
| Sufficient proof for visible replacement | Refused |
| Determinism | Partial |
| No mutation | Confirmed for evidence module |
| No side effect | Confirmed for evidence module |
| Simple rollback | Confirmed before replacement |
| Stable comparison | Confirmed for first-slice evidence module |
| No hidden dependency | Not fully confirmed for complete App parity |
| No Permanent Guard violation | Confirmed for current passive state |

## 12. Rollback

Rollback for this LOT is only:

- delete `docs/LOT_5_10_FIRST_VISIBLE_REPLACEMENT_GATE_REVIEW.md`.

No code rollback is required because this LOT does not modify code.

Future rollback for a visible replacement must be defined before any replacement is implemented.

## 13. Impact Assessment

Current LOT impact:

- no code modified;
- no tests modified;
- no business logic modified;
- no UI modified;
- no persistence modified;
- no payload modified;
- no export modified;
- no dashboard behavior modified;
- no assistant behavior modified;
- no user-visible behavior modified.

Project state after this review:

- Legacy remains source of truth;
- Shadow remains passive;
- evidence remains temporary and non-visible;
- visible replacement remains forbidden.

## 14. Recommendation for LOT 5.11

Recommended next LOT:

LOT 5.11 - Additional Parity Evidence.

Required focus:

- date-controlled full parity harness;
- explicit reference dates for every scenario;
- real Legacy snapshot versus real Shadow output evidence;
- first-slice field assertions;
- ACRE active, expired, missing start date, and boundary scenarios;
- repeated identical input proof for the complete path;
- cloned input proof for the complete path;
- no visible replacement;
- no persistence;
- no payload change.

## 15. Confirmations

Exactly one document is created.

No code is modified.

No test is modified.

No business logic is modified.

No UI is modified.

No persistence is modified.

No user behavior is modified.

Legacy remains the only source of truth.

Shadow remains passive.

The project is evaluated without functional modification.

GO POUR LOT 5.11 — ADDITIONAL PARITY EVIDENCE
