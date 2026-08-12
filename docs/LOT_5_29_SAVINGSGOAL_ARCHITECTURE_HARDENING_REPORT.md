# LOT 5.29 - SavingsGoal Architecture Hardening Report

## 1. Executive Summary

LOT 5.29 hardens the architecture around `savingsGoal` without migrating any consumer and without changing the current value.

No business formula, rate, rounding, percentage, persistence path, payload, assistant path, PDF output or Shadow read was changed.

## 2. Current SavingsGoal Responsibilities

Current source remains:

```text
Math.max(estimatedCharges * 3, 500)
```

Responsibilities are now explicitly marked in `src/App.jsx`:

- UI presentation: progress percentage text and progress fill width;
- fiscal coaching: low-reserve threshold;
- PDF export: exported objective percentage;
- other direct persistence, payload or assistant usage: none found.

## 3. UI Boundary

The progress indicators block is marked as the LOT 5.29 UI boundary.

It still reads:

```text
savingsProgress / savingsGoal
```

No UI migration was performed.

## 4. Coaching Boundary

The low-reserve branch in `fiscalCoachingCard` is marked as the LOT 5.29 coaching boundary.

It still reads the same Legacy `savingsGoal` and keeps:

```text
savingsProgress < savingsGoal * 0.35
```

No coaching text, rule, branch order or behavior was changed.

## 5. PDF Boundary

The PDF "Objectif d epargne" line is marked as the LOT 5.29 PDF boundary.

It still exports:

```text
Math.round((savingsProgress / savingsGoal) * 100 || 0)
```

No PDF output contract was changed.

## 6. Other Consumers

No direct `savingsGoal` read was found in:

- Supabase persistence;
- localStorage persistence;
- feedback payloads;
- analytics payloads;
- assistant output.

Exports remain a direct derived consumer through the PDF percentage.

## 7. Hardening Applied

Applied hardening:

- added targeted architectural comments at the Legacy source, UI boundary, coaching boundary and PDF boundary;
- created `tests/lot-5-29-savingsgoal-architecture-hardening.test.js`;
- added deterministic no-cross-consumer coupling guards.

No value extraction or alias was introduced, to avoid adding a new consumer or changing existing guard counts.

## 8. Value Preservation

The value remains:

```text
Math.max(estimatedCharges * 3, 500)
```

Examples guarded:

- `0 -> 500`;
- `166 -> 500`;
- `167 -> 501`;
- `264 -> 792`.

## 9. Formula Preservation

Preserved:

- multiplier `* 3`;
- floor `500`;
- UI percentage formula;
- PDF percentage formula;
- coaching threshold `* 0.35`;
- `estimatedCharges` formula and dependency list.

## 10. No Shadow Usage

LOT 5.29 does not replace `estimatedCharges`.

The `savingsGoal`, UI, coaching and PDF savings boundaries do not read:

- `fiscalSummaryVisibleSlice.finalContributionAmount`;
- `shadowResult.summary.finalContributionAmount`;
- any new Shadow value.

## 11. Cross-Consumer Guard

The new guard verifies that:

- UI boundary does not include coaching, PDF, assistant, persistence or payload access;
- coaching boundary does not include PDF or UI progress fill logic;
- PDF boundary does not include coaching or UI progress fill logic;
- future migration must not couple UI migration to coaching or PDF.

## 12. Tests

Created:

- `tests/lot-5-29-savingsgoal-architecture-hardening.test.js`

Coverage includes:

- `savingsGoal` value preservation;
- formula preservation;
- `estimatedCharges` preservation;
- UI boundary;
- coaching boundary;
- PDF boundary;
- no Shadow read;
- no `finalContributionAmount` migration;
- no new rounding, percentage or fallback;
- persistence, assistant and payload boundaries;
- export output contract;
- no cross-consumer coupling;
- Legacy retention;
- no new consumer.

Validation results:

- `node --test tests/lot-5-29-savingsgoal-architecture-hardening.test.js`: 16/16 PASS
- `node --test tests/lot-5-26-next-consumer-stabilization.test.js`: 18/18 PASS
- `node --test tests/lot-5-25-next-consumer-migration-validation.test.js`: 15/15 PASS
- `node --test tests/shadow-parity-validation.test.js`: 6/6 PASS
- `node --test tests/runtime-parity-evidence.test.js`: 11/11 PASS
- `npx eslint tests/lot-5-29-savingsgoal-architecture-hardening.test.js`: PASS

Sandbox note: Node targeted tests hit the known sandbox `spawn EPERM` issue and were rerun outside the sandbox. No full `node --test`, build, global lint or Playwright run was executed.

## 13. Risks

Remaining risks:

- `savingsGoal` still globally feeds UI, coaching and PDF;
- future UI migration still needs dedicated parity evidence and a separate migration LOT;
- PDF and coaching must remain Legacy until explicitly reviewed.

No risk requires rollback.

## 14. Rollback

Rollback is structural only:

- remove the LOT 5.29 architectural comments from `src/App.jsx`;
- remove `tests/lot-5-29-savingsgoal-architecture-hardening.test.js`;
- remove this report.

No data migration, Supabase action, localStorage action or value correction is required.

## 15. Recommended Next LOT

Recommended next LOT:

```text
LOT 5.30 - Isolated SavingsGoal UI Parity Evidence
```

Purpose:

- prove whether a future UI-only savings denominator can use `finalContributionAmount`;
- keep coaching and PDF on Legacy;
- avoid global `savingsGoal` migration.

## 16. Final Decision

GO POUR LOT 5.30 — ISOLATED SAVINGSGOAL UI PARITY EVIDENCE
