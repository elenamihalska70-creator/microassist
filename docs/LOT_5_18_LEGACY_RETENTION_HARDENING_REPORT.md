# LOT 5.18 - Legacy Retention Hardening

## 1. Executive Summary

LOT 5.18 hardens Legacy retention without deleting Legacy, without migrating a new visible slice, and without changing runtime behavior.

Created:

- `tests/lot-5-18-legacy-retention-hardening.test.js`;
- `docs/LOT_5_18_LEGACY_RETENTION_HARDENING_REPORT.md`.

No application file was modified.

Decision: Legacy remains a compatibility and rollback layer. It is retained, controlled, documented and guarded against accidental extension.

## 2. Scope and Authority

Authority documents:

- `docs/LOT_5_13_FIRST_VISIBLE_REPLACEMENT_REPORT.md`;
- `docs/LOT_5_14_FIRST_VISIBLE_REPLACEMENT_VALIDATION_REPORT.md`;
- `docs/LOT_5_15_FIRST_SLICE_STABILIZATION_REPORT.md`;
- `docs/LOT_5_16_PLAYWRIGHT_OOM_EXTENDED_STABILIZATION_REPORT.md`;
- `docs/LOT_5_17_LEGACY_REMOVAL_GATE_REVIEW.md`.

LOT 5.17 is the classification authority for Legacy dependencies.

Inspected:

- `src/App.jsx`;
- runtime parity evidence;
- LOT 5.11, 5.13, 5.14, 5.15, 5.16 tests;
- export, dashboard, feedback and assistant-adjacent paths identified by LOT 5.17.

## 3. Current Legacy Role

Legacy is no longer the target architecture for the approved first visible slice when the feature flag is ON and Shadow Result exists.

Legacy remains required for:

- immediate rollback;
- passive parity validation;
- runtime evidence;
- persistence compatibility;
- exports;
- feedback and analytics compatibility;
- assistant-adjacent state;
- dashboard consumers outside the approved first slice;
- historical characterization tests.

## 4. Permanent Guards

Permanent Facade Guard: respected. `calculateFiscalSummary.js` was not changed.

Permanent Migration Guard: respected. No new visible value was migrated.

Permanent Shadow Rule: respected. Shadow remains limited to parity, evidence and the approved first visible slice.

Permanent Deterministic Parity Guard: respected. Guards are pure source checks and deterministic evidence checks.

Permanent Evidence Integrity Guard: respected. MISMATCH remains observable and uncorrected.

Permanent Slice Isolation Guard: respected. No second slice was added.

## 5. Legacy Responsibility Map

| Category | Files | Variables / functions | Consumers | Retention duration | Future removal criteria | Risks |
| --- | --- | --- | --- | --- | --- | --- |
| A. Rollback | `src/App.jsx` | `currentMonthTotal`, `estimatedCharges`, `computed?.rate`, `computed?.acreStatus`, feature flag | `fiscalSummaryVisibleSlice` flag OFF and absent Shadow Result | Until rollback strategy is explicitly retired | Dedicated gate removes or replaces rollback | Broken immediate rollback |
| B. Parity Validation | `src/App.jsx`, `src/application/shadow/runtimeParityEvidence.js` | `legacySnapshot`, `createRuntimeParityEvidence` | passive Legacy / Shadow comparison | Until parity validation is explicitly retired | Dedicated parity-retirement gate | Loss of comparator |
| C. Runtime Evidence | same | `SHADOW_PARITY_EVIDENCE_STORE`, evidence records | runtime parity evidence | Until evidence strategy changes | Dedicated evidence gate | Hidden mismatch |
| D. Persistence Compatibility | `src/App.jsx` | persisted revenues/profile feeding Legacy calculations | Supabase and localStorage restoration/sync | Until persistence is migrated | Persistence migration gate | State divergence |
| E. Export Compatibility | `src/App.jsx`, invoice export paths | `currentMonthTotal`, `dashboardChargesDisplay`, `dashboardAvailableDisplay`, `computed` | PDF/export output | Until export migration gate | Export parity approval | Export value change |
| F. Feedback / Analytics Compatibility | `src/App.jsx` | `feedbackContextSnapshot`, tracking context | feedback and analytics payload-like context | Until analytics migration gate | Explicit payload contract | Silent payload drift |
| G. Assistant-adjacent Compatibility | `src/App.jsx` | assistant answers/drafts/profile state feeding Legacy | assistant-adjacent state and restoration | Until assistant gate | Assistant migration gate | Draft/profile incompatibility |
| H. Dashboard Compatibility hors slice | `src/App.jsx` | `availableAmount`, smart alerts, monthly reflection, gates | non-migrated dashboard areas | Until each consumer is migrated | Per-consumer migration gate | Second-slice leak |
| I. Tests historiques | `tests/*.test.js` | Legacy characterization and parity fixtures | regression suite | Until replaced by approved tests | Dedicated test-retirement approval | Regression blindness |

## 6. Authorized Legacy Consumers

Authorized reads are limited to the responsibilities confirmed by LOT 5.17:

- rollback fallback in `fiscalSummaryVisibleSlice`;
- `legacySnapshot` for parity and runtime evidence;
- existing export summaries;
- feedback and analytics context;
- assistant-adjacent persisted/profile state;
- dashboard consumers outside the approved first visible slice;
- historical tests.

## 7. Forbidden Legacy Consumers

Legacy must not be used as the default source for:

- new components;
- new dashboards;
- new summaries;
- new payloads;
- new calculations;
- new formatters;
- new business rules;
- new visible slices;
- new persistence or workflows.

## 8. No New Legacy Consumer Guard

Added `tests/lot-5-18-legacy-retention-hardening.test.js`.

The guard:

- checks the authorized Legacy responsibilities from LOT 5.17;
- verifies approved first-slice Shadow selection;
- verifies flag OFF rollback;
- verifies parity and runtime evidence retention;
- freezes current structural reference counts for critical Legacy identifiers after comments are stripped;
- verifies no second slice reads Shadow Result;
- verifies persistence, payload, export and assistant-adjacent boundaries.

Known limit: the reference-count guard is intentionally strict and lexical. It is not a full parser. It is deterministic and designed to fail loudly if a future LOT adds, removes or moves a critical Legacy read without updating the retention map.

## 9. Feature Flag Hardening

`FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED` remains local.

Validated:

- flag ON uses Shadow for approved first-slice values;
- flag OFF immediately rolls back to Legacy;
- absent Shadow Result rolls back to Legacy;
- the flag is not persisted;
- no new behavior was added around the flag.

## 10. Fallback Hardening

Fallback remains limited to global `Boolean(shadowResult)` availability inside `fiscalSummaryVisibleSlice`.

Validated:

- no field-level `||` or `??` fallback;
- falsy Shadow values remain visible;
- no persistence, API, state setter or payload side effect in the selector.

## 11. Parity Retention

Legacy remains available through:

- `legacySnapshot.revenueTotal`;
- `legacySnapshot.estimatedAmount`;
- `legacySnapshot.rate`;
- `legacySnapshot.acreStatus`.

MISMATCH evidence is still preserved without correction.

## 12. Runtime Evidence Retention

`createRuntimeParityEvidence` and `SHADOW_PARITY_EVIDENCE_STORE.record(...)` remain wired to the app shadow block.

The evidence mechanism remains passive and does not replace visible values.

## 13. Persistence Retention

Persistence paths were not modified.

The visible selector remains free of:

- `localStorage`;
- `sessionStorage`;
- `supabase`;
- `fetch`;
- payload writes.

Persistence remains a future dedicated gate, not part of LOT 5.18.

## 14. Export Retention

Exports were not modified.

The report guard confirms export retention of existing Legacy-compatible reads such as:

- `getDisplayValue(currentMonthTotal, "money")`;
- `dashboardChargesDisplay`;
- `dashboardAvailableDisplay`;
- `computed?.rate ? Math.round(computed.rate * 100) : 0`.

## 15. Assistant Retention

Assistant runtime output was not modified.

Assistant-adjacent compatibility remains through existing profile/draft/state paths and dashboard reflection dependencies. Any migration of assistant-facing output requires a dedicated gate.

## 16. Analytics / Feedback Retention

Feedback and analytics paths were not modified.

The guard confirms `feedbackContextSnapshot` still retains `totalRevenues: currentMonthTotal || 0`, as classified by LOT 5.17.

## 17. Dashboard Retention

The approved dashboard first slice still reads:

- `fiscalSummaryVisibleSlice.revenueTotal`;
- `fiscalSummaryVisibleSlice.finalContributionAmount`.

Out-of-slice dashboard compatibility remains Legacy-based, including `availableAmount`, gates and non-migrated dashboard summaries.

## 18. Legacy Lifecycle

Current stage by element:

| Legacy element | Stage |
| --- | --- |
| `currentMonthTotal` | Stage 3 - retained for compatibility |
| `computed` | Stage 3 - retained for compatibility |
| `estimatedCharges` | Stage 3 - retained for compatibility |
| `availableAmount` | Stage 3 - retained for dashboard/export compatibility |
| `legacySnapshot` | Stage 3 - retained for parity/evidence |
| export consumers | Stage 3 - retained for compatibility |
| feedback / analytics consumers | Stage 3 - retained for compatibility |
| assistant-adjacent consumers | Stage 3 - retained for compatibility |

Lifecycle stages:

1. Legacy visible source.
2. Shadow visible source for an isolated slice.
3. Legacy retained for compatibility.
4. Consumers migrated individually.
5. Legacy removal gate.
6. Legacy removal.

## 19. Deprecation Metadata

No runtime annotation was added to `App.jsx`.

Rationale:

- the LOT could be completed with tests and documentation only;
- adding comments to the large component was not necessary;
- the new test file acts as executable metadata for `LEGACY_COMPATIBILITY_ONLY` and `LEGACY_DO_NOT_EXTEND`.

## 20. Tests

Created `tests/lot-5-18-legacy-retention-hardening.test.js`.

Coverage:

- approved first-slice Shadow visibility;
- flag OFF Legacy rollback;
- parity retention;
- runtime evidence retention;
- no new critical Legacy references outside the approved count map;
- fallback limitation;
- no second Shadow slice;
- no new Legacy architecture slice;
- Legacy total formula unchanged;
- Legacy contribution rounding unchanged;
- persistence unchanged;
- export unchanged;
- assistant-adjacent output unchanged;
- payload unchanged;
- deterministic guards;
- immediate rollback.

## 21. Validation Results

Executed:

- `node tests\lot-5-18-legacy-retention-hardening.test.js`: 13 passed.
- `node tests\lot-5-13-first-visible-replacement.test.js`: 8 passed.
- `node tests\lot-5-14-first-visible-replacement-validation.test.js`: 14 passed.
- `node tests\lot-5-15-first-slice-stabilization.test.js`: 13 passed.
- `node tests\lot-5-11-additional-parity-evidence.test.js`: 7 passed.
- `node --test`: 254 passed.
- `npm run build`: passed, with existing Vite large chunk warning.
- `npx eslint tests\lot-5-18-legacy-retention-hardening.test.js`: passed.
- `npm run lint`: failed on historical lint debt, 50 problems: 21 errors and 29 warnings in `src/App.jsx`, `src/components/InvoiceGenerator.jsx`, and `src/context/AuthContext.jsx`.
- `npx playwright test --reporter=line`: 11 passed.
- second `npx playwright test --reporter=line`: 11 passed.

Note: `node --test` required an escalated run because the sandboxed runner failed with `spawn EPERM`.

## 22. Risks

Remaining risks:

- the Legacy retention map is strict and must be updated only by dedicated future LOTs;
- exports remain Legacy-heavy;
- assistant-adjacent state remains Legacy-compatible but not migrated;
- persistence has not been separated from Legacy inputs;
- global lint debt remains historical and outside this LOT.

No risk requires LOT 5.18 rollback.

## 23. Rollback

Rollback for LOT 5.18 is local:

- remove `tests/lot-5-18-legacy-retention-hardening.test.js`;
- remove `docs/LOT_5_18_LEGACY_RETENTION_HARDENING_REPORT.md`.

No rollback step touches:

- first visible slice;
- Legacy calculations;
- Shadow;
- persistence;
- exports;
- assistant;
- payloads.

## 24. Scope Control

No Legacy deletion.

No new visible slice.

No Adapter, Facade, Domain, Rules Engine, ACRE, Revenue or Contribution modification.

No persistence, export, assistant, payload, UI, navigation, label or CSS modification.

No application file was changed.

## 25. Recommended Next LOT

Recommended next LOT: `LOT 5.19 - NEXT CONSUMER MIGRATION GATE REVIEW`.

Reason: Legacy responsibilities are now explicit and guarded. The next safe step is to study one next consumer separately before any migration, likely export, assistant, persistence or another dashboard consumer depending on product priority.

## 26. Final Decision

GO POUR LOT 5.19 — NEXT CONSUMER MIGRATION GATE REVIEW
