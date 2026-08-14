# LOT 5.11 - Additional Parity Evidence Report

## 1. Executive Summary

LOT 5.11 adds deterministic, test-only parity evidence for the first slice candidate identified by LOT 5.10.

The added evidence compares real Legacy snapshots produced through `computeObligations` with real Shadow outputs produced through `buildFiscalSummaryInput` and `calculateFiscalSummary`.

No visible migration is implemented. No business logic is modified. Legacy remains the only source of truth.

Result: the first slice now has sufficient additional evidence to return to a first visible replacement gate review.

## 2. LOT 5.10 Findings Addressed

LOT 5.10 identified these missing proofs:

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

LOT 5.11 addresses these findings with `tests/lot-5-11-additional-parity-evidence.test.js`.

## 3. Scope

In scope:

- additional parity evidence tests;
- deterministic fixtures;
- test-only date control;
- first-slice field comparison;
- report documentation.

Out of scope:

- visible replacement;
- UI wiring;
- state changes;
- persistence;
- Supabase;
- localStorage;
- payloads;
- exports;
- business formulas;
- rates;
- rounding rules;
- Adapter contract changes;
- Facade contract changes.

## 4. Permanent Guards

Permanent Facade Guard: respected. No facade code was modified.

Permanent Migration Guard: respected. Legacy remains the source of truth.

Permanent Shadow Rule: respected. Shadow is read only by validation and evidence mechanisms.

Permanent Deterministic Parity Guard: respected for the added evidence. The harness uses an explicit fixed reference date and a controlled test clock.

Permanent Evidence Integrity Guard: respected. MISMATCH is preserved and asserted without normalization or correction.

Permanent Slice Isolation Guard: respected. Only the five approved first-slice fields are compared.

## 5. First Slice Candidate

The first slice remains:

- `revenue.total`;
- `summary.baseAmount`;
- `summary.finalContributionAmount`;
- `summary.effectiveRate`;
- `acre.status`.

No field was added.

No field was removed.

No field was connected to UI.

## 6. Missing Evidence Before LOT 5.11

Before this LOT, the project had mechanism-level evidence but still lacked:

- complete date-controlled Legacy-vs-Shadow parity fixtures;
- scenario-level MATCH proof for first-slice fields;
- real ACRE active proof;
- real ACRE expired proof;
- real missing ACRE start date proof;
- real boundary ACRE proof;
- complete repeated-input proof;
- complete cloned-input proof;
- complete distinct-reference proof;
- full first-slice readiness matrix.

## 7. Added Evidence Mechanism

Added test file:

- `tests/lot-5-11-additional-parity-evidence.test.js`

The harness:

- builds deterministic app DTOs;
- builds Shadow input through the existing Adapter;
- executes Shadow through the existing Calculation Facade;
- builds Legacy snapshots through existing `computeObligations`;
- controls the Legacy implicit current date in the test process;
- creates evidence through the LOT 5.9 runtime evidence module;
- asserts field-level MATCH or MISMATCH;
- asserts no mutation and no side effect.

No application instrumentation was added.

## 8. Added Scenarios

Scenarios covered:

- revenu nul;
- revenu positif simple;
- plusieurs revenus;
- type d'activite service;
- type d'activite vente;
- activite mixte;
- ACRE inactive;
- ACRE active;
- expiration ACRE;
- valeur limite ACRE encore active;
- changement de periode;
- montant faible;
- montant eleve;
- donnees optionnelles absentes;
- etat restaure;
- changements successifs through stable ordered store recording;
- meme input execute plusieurs fois;
- input clone;
- references differentes avec valeurs identiques.

No scenario was marked covered without execution.

## 9. Deterministic Fixtures

All fixtures use:

- fixed reference date: `2026-07-30`;
- fixed observed marker: `LOT_5_11_FIXED_OBSERVATION`;
- fixed test clock: `2026-07-30T12:00:00.000Z`;
- explicit revenues;
- explicit activity type;
- explicit ACRE state;
- explicit ACRE start date where applicable;
- explicit period where the period-change scenario requires it.

The observation marker is excluded from the parity decision. It identifies the evidence record only.

## 10. Compared Fields

The compared fields are exactly:

| Field | Legacy value source | Shadow value source |
| --- | --- | --- |
| `revenue.total` | deterministic test revenue total | `shadowResult.revenue.total` |
| `summary.baseAmount` | deterministic test revenue total | `shadowResult.summary.baseAmount` |
| `summary.finalContributionAmount` | `computeObligations().estimatedAmount` | `shadowResult.summary.finalContributionAmount` |
| `summary.effectiveRate` | `computeObligations().rate` | `shadowResult.summary.effectiveRate` |
| `acre.status` | `computeObligations().acreStatus` | `shadowResult.contributions.acre.acreStatus` |

Comparison remains strict through `Object.is`.

No tolerance is introduced.

## 11. Field-by-Field Results

| Field | MATCH proof | MISMATCH proof | UNKNOWN | Status |
| --- | --- | --- | --- | --- |
| `revenue.total` | Yes | Intentional mismatch framework covers detection path | No | SUFFICIENT |
| `summary.baseAmount` | Yes | Intentional mismatch framework covers detection path | No | SUFFICIENT |
| `summary.finalContributionAmount` | Yes | Yes, intentional mismatch preserved | No | SUFFICIENT |
| `summary.effectiveRate` | Yes | Intentional mismatch framework covers detection path | No | SUFFICIENT |
| `acre.status` | Yes | Intentional mismatch framework covers detection path | No | SUFFICIENT |

No real residual MISMATCH was detected in the approved scenarios.

## 12. Scenario-by-Scenario Results

| Scenario | Global result | Notes |
| --- | --- | --- |
| `revenue-null-service-acre-inactive` | MATCH | Empty revenue state covered |
| `revenue-positive-service-acre-inactive` | MATCH | Simple positive service revenue |
| `multiple-revenues-service-acre-inactive` | MATCH | Multiple revenues |
| `commerce-acre-inactive` | MATCH | Vente / commerce rate path |
| `mixed-activity-acre-inactive` | MATCH | Mixte rate path |
| `service-acre-active` | MATCH | Active ACRE with explicit date |
| `service-acre-expired` | MATCH | Expired ACRE with explicit date |
| `service-acre-boundary-active` | MATCH | Boundary still active |
| `service-acre-missing-start-date` | MATCH | Optional start date absent |
| `service-amount-low` | MATCH | Low amount |
| `service-amount-high` | MATCH | High amount |
| `period-change-month-window` | MATCH | Explicit period window |
| `restored-state-equivalent-values` | MATCH | Restored equivalent values |
| `intentional-mismatch-final-contribution` | MISMATCH | Deliberate evidence integrity check |

## 13. Known Matches

Known MATCH scenarios:

- all approved first-slice scenarios listed in section 12 except the intentional mismatch control.

The MATCH evidence includes field-level Legacy and Shadow values in the runtime evidence records created by the test harness.

## 14. Known Mismatches

Known MISMATCH:

- `intentional-mismatch-final-contribution`;
- field: `summary.finalContributionAmount`;
- Legacy value: `999`;
- Shadow value: `220`;
- classification: intentional evidence-integrity control;
- impact: not a real business mismatch.

No real business MISMATCH was detected in LOT 5.11.

## 15. Remaining Unknowns

For the first slice candidate:

- no UNKNOWN remains in the added deterministic test scope.

Outside the first slice:

- TVA remains out of scope;
- CFE remains out of scope;
- deadlines remain out of scope;
- labels remain out of scope;
- assistant messages remain out of scope;
- exports remain out of scope;
- dashboard UX values remain out of scope.

These are not blockers for the first-slice gate because the Slice Isolation Guard forbids expanding scope in LOT 5.11.

## 16. Mutation and Side-Effect Assessment

The added tests assert:

- no mutation of Legacy scenario data;
- no mutation of app DTO input;
- no mutation of Shadow input;
- no mutation of Shadow result;
- disabled evidence store records nothing;
- store reads return stable ordered evidence;
- no localStorage;
- no sessionStorage;
- no Supabase;
- no network;
- no React state;
- no App state.

No side effect is introduced into application behavior.

## 17. Determinism Assessment

The added tests assert:

- same input executed twice produces the same evidence;
- cloned input produces the same evidence;
- distinct references with identical values produce the same evidence;
- evidence field order remains stable;
- scenario order remains stable;
- current date is controlled in the test process;
- Shadow receives explicit `referenceDate`;
- no `Date.now` or `new Date` dependency exists in the evidence module;
- no `Math.random` dependency exists in the evidence module or LOT 5.11 test harness.

The legacy date behavior is controlled only inside the test harness. No production behavior is changed.

## 18. Performance Impact

Runtime application impact: none.

Test impact:

- one dedicated Node test file;
- deterministic fixtures;
- no network;
- no persistence;
- no browser dependency for LOT 5.11 evidence itself.

## 19. First Slice Readiness Matrix

| Champ du slice | Scenarios requis | MATCH prouves | MISMATCH | UNKNOWN | Statut |
| --- | --- | --- | --- | --- | --- |
| `revenue.total` | Revenue nul, positif, multiple, period change, restored state | Yes | No real mismatch | No | SUFFICIENT |
| `summary.baseAmount` | Revenue nul, positif, multiple, period change, restored state | Yes | No real mismatch | No | SUFFICIENT |
| `summary.finalContributionAmount` | Service, vente, mixte, low, high, ACRE inactive, active, expired, missing date | Yes | No real mismatch | No | SUFFICIENT |
| `summary.effectiveRate` | Service, vente, mixte, ACRE inactive, active, expired, missing date | Yes | No real mismatch | No | SUFFICIENT |
| `acre.status` | Inactive, active, expired, boundary, missing start date | Yes | No real mismatch | No | SUFFICIENT |

All first-slice fields are marked SUFFICIENT.

## 20. Risks

Remaining risks:

- first visible replacement still needs a dedicated gate review;
- production App still uses the existing Shadow runtime path and remains passive;
- global lint debt remains historical and outside this LOT;
- future visible wiring must define rollback before implementation;
- only the first slice is covered.

No blocking risk was found for returning to a first visible replacement gate review.

## 21. Rollback

Rollback LOT 5.11:

- delete `tests/lot-5-11-additional-parity-evidence.test.js`;
- delete `docs/LOT_5_11_ADDITIONAL_PARITY_EVIDENCE_REPORT.md`.

After rollback:

- Shadow Pipeline LOT 5.6 remains intact;
- Parity Validation LOT 5.7 remains intact;
- Runtime Evidence LOT 5.9 remains intact;
- no user-visible behavior changes.

## 22. Recommended Next LOT

Recommended next LOT:

LOT 5.12 - First Visible Replacement Gate Review.

The next LOT should remain documentation-only and decide whether the first visible replacement can begin. It must not itself implement replacement unless explicitly authorized by a later implementation LOT.

## 23. Final Decision

Legacy remains the only source of truth.

Shadow remains passive.

No visible field is replaced.

No state is modified.

No persistence is modified.

No payload is modified.

No export is modified.

No dashboard is modified.

No assistant output is modified.

No formula is modified.

No rate is modified.

No rounding is modified.

No business logic is modified.

No implicit tolerance is added.

No mismatch is masked.

The first slice remains isolated.

GO POUR LOT 5.12 — FIRST VISIBLE REPLACEMENT GATE REVIEW
