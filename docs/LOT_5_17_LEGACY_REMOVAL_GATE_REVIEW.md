# LOT 5.17 - Legacy Removal Gate Review

## 1. Executive Summary

LOT 5.17 is a documentation-only gate review.

Decision: no Legacy element linked to the first slice is ready for removal in the next LOT.

Reason: the first visible slice now reads Shadow for approved dashboard values, but the Legacy values remain active dependencies for rollback, parity validation, runtime evidence, exports, feedback context, smart alerts, dashboard gates, and other non-migrated consumers.

No code was removed.

No application file was modified.

Exactly one document was created:

- `docs/LOT_5_17_LEGACY_REMOVAL_GATE_REVIEW.md`.

## 2. Scope and Authority

Authority documents read:

- `docs/LOT_5_12_FIRST_VISIBLE_REPLACEMENT_GATE_REVIEW.md`;
- `docs/LOT_5_13_FIRST_VISIBLE_REPLACEMENT_REPORT.md`;
- `docs/LOT_5_14_FIRST_VISIBLE_REPLACEMENT_VALIDATION_REPORT.md`;
- `docs/LOT_5_15_FIRST_SLICE_STABILIZATION_REPORT.md`;
- `docs/LOT_5_16_PLAYWRIGHT_OOM_EXTENDED_STABILIZATION_REPORT.md`;
- `docs/LOT_5_7_SHADOW_PARITY_VALIDATION_REPORT.md`;
- `docs/LOT_5_9_RUNTIME_PARITY_EVIDENCE_IMPLEMENTATION_REPORT.md`;
- `docs/LOT_5_11_ADDITIONAL_PARITY_EVIDENCE_REPORT.md`.

Inspected:

- `src/App.jsx`;
- `src/application/adapters/buildFiscalSummaryInput.js`;
- `src/domain/calculations/facade/calculateFiscalSummary.js`;
- Revenue calculation modules;
- Contribution calculation modules;
- Legacy ACRE calculation;
- `src/application/shadow/runtimeParityEvidence.js`;
- LOT 5.11 to LOT 5.16 tests;
- Supabase and localStorage paths in `src/App.jsx`;
- export paths in `src/App.jsx` and `src/components/InvoiceGenerator.jsx`;
- assistant message persistence and dashboard consumers.

This LOT did not run tests, build, lint, Playwright or the app, per the gate-review instruction.

## 3. Current First Slice Architecture

Visible first slice:

```text
App.jsx
  -> fiscalSummaryShadow
  -> calculateFiscalSummary(...)
  -> fiscalSummaryVisibleSlice
  -> approved dashboard visible reads
```

Legacy remains in parallel:

```text
App.jsx
  -> currentMonthTotal
  -> computed via computeObligations(...)
  -> estimatedCharges
  -> availableAmount
  -> legacySnapshot
  -> parity/evidence/fallback/exports/assistant/dashboard consumers
```

Approved first-slice fields:

- `revenue.total`;
- `summary.baseAmount`;
- `summary.finalContributionAmount`;
- `summary.effectiveRate`;
- `acre.status`.

## 4. Permanent Guards

Permanent Facade Guard: respected. No Facade change is proposed or authorized.

Permanent Migration Guard: respected. Shadow remains visible only for the first slice. Legacy remains source of truth for non-migrated areas.

Permanent Shadow Rule: respected. Shadow Result remains limited to parity, runtime evidence and approved visible slice usage.

Permanent Deterministic Parity Guard: respected. The parity mechanism still depends on Legacy snapshots.

Permanent Evidence Integrity Guard: respected. Removing Legacy parity sources now would remove evidence rather than preserve it.

Permanent Slice Isolation Guard: respected. No second slice is included in a removal decision.

## 5. Legacy Inventory

| Legacy ID | Source | Valeur | Consommateurs | Rôle actuel | Suppression possible | Justification |
| --- | --- | --- | --- | --- | --- | --- |
| L-01 | `src/App.jsx` `currentMonthTotal` around line 5406 | revenue total | computeObligations, parity snapshot, fallback, dashboard gates, exports, feedback, smart alerts | Legacy revenue reference | No | required by rollback, parity and multiple non-migrated consumers |
| L-02 | `src/App.jsx` `computed` around line 5431 | obligations summary, rate, ACRE status, labels, deadlines | parity snapshot, fallback, dashboard, exports, assistant-adjacent summaries, TVA/CFE/deadlines | central Legacy calculation result | No | broad cross-domain consumer set |
| L-03 | `src/App.jsx` `estimatedCharges` around line 5657 | contribution estimate | fallback, dashboard, savings, monthly reflection, exports | Legacy contribution amount | No | required for fallback and out-of-slice calculations |
| L-04 | `src/App.jsx` `availableAmount` around line 5664 | available amount | dashboard, smart priorities, exports | out-of-slice derived value | No | not part of first slice removal |
| L-05 | `src/App.jsx` `legacySnapshot` around line 5551 | parity reference | runtime evidence | Legacy parity source | No | required for evidence integrity |
| L-06 | `src/App.jsx` `dashboardChargesDisplay` around line 6088 | formatted charge display | visible dashboard and PDF export | mixed Shadow/Legacy-facing formatter | No | uses Shadow for first slice but also feeds exports/UI |
| L-07 | `src/App.jsx` declaration gate `currentMonthTotal > 0` around line 13138 | visibility condition | dashboard declaration helper | Legacy UI condition | No | visible gate still depends on Legacy revenue presence |
| L-08 | `src/App.jsx` PDF export around line 9938 | exported fiscal summary | PDF report | export consumer | No | exports are not migrated |
| L-09 | `src/App.jsx` feedback context around line 8445 | tracking/feedback values | beta feedback analytics | payload-like consumer | No | not migrated to Shadow |
| L-10 | `src/App.jsx` smart alerts around line 6319 | alert inputs | dashboard alerts | other dashboard consumer | No | outside first visible slice |

## 6. Legacy Calculation Inventory

| ID | Calculation | Formula / source | First-slice relation | Status |
| --- | --- | --- | --- | --- |
| C-01 | `currentMonthTotal` | `revenues.reduce(... Number(item.amount || 0))` | Legacy revenue total and base amount | KEEP FOR PARITY / ROLLBACK / OTHER CONSUMER |
| C-02 | `computed` | `computeObligations({ ca_month: currentMonthTotal, ca_ytd, months_with_data, ... })` | Legacy rate, ACRE status, estimated amount | KEEP FOR OTHER CONSUMER |
| C-03 | `estimatedCharges` | `Math.round(currentMonthTotal * computed.rate)` | Legacy final contribution fallback | KEEP FOR ROLLBACK / OTHER CONSUMER |
| C-04 | `availableAmount` | `Math.max(0, currentMonthTotal - estimatedCharges)` | downstream non-slice amount | KEEP FOR OTHER CONSUMER |
| C-05 | `savingsGoal` | `Math.max(estimatedCharges * 3, 500)` | not first-slice, charge-dependent | KEEP FOR OTHER CONSUMER |
| C-06 | `dashboardMonthlyReflection` | text from `currentMonthTotal` and `estimatedCharges` | summary text, not migrated | KEEP FOR OTHER CONSUMER |

No calculation is a REMOVE NOW candidate.

## 7. Legacy Read Inventory

| ID | Read | Consumer | Current role | Decision |
| --- | --- | --- | --- | --- |
| R-01 | `currentMonthTotal` in `legacySnapshot.revenueTotal` | runtime evidence | parity reference | KEEP FOR PARITY |
| R-02 | `computed?.estimatedAmount` in `legacySnapshot.estimatedAmount` | runtime evidence | parity reference | KEEP FOR PARITY |
| R-03 | `computed?.rate` in `legacySnapshot.rate` | runtime evidence and fallback | parity / rollback | KEEP FOR PARITY |
| R-04 | `computed?.acreStatus` in `legacySnapshot.acreStatus` | runtime evidence and fallback | parity / rollback | KEEP FOR PARITY |
| R-05 | `currentMonthTotal` fallback in `fiscalSummaryVisibleSlice` | flag OFF behavior | rollback | KEEP FOR ROLLBACK |
| R-06 | `estimatedCharges` fallback in `fiscalSummaryVisibleSlice` | flag OFF behavior | rollback | KEEP FOR ROLLBACK |
| R-07 | `currentMonthTotal > 0` declaration helper gate | dashboard UI condition | still visible logic | KEEP FOR OTHER CONSUMER |
| R-08 | `currentMonthTotal` in PDF report | export | Legacy export source | KEEP FOR OTHER CONSUMER |
| R-09 | `estimatedCharges` in monthly reflection | dashboard summary | non-migrated summary | KEEP FOR OTHER CONSUMER |
| R-10 | `currentMonthTotal` in feedback context | analytics/feedback context | payload-like consumer | KEEP FOR OTHER CONSUMER |

No read can be removed without either changing behavior or weakening rollback/parity.

## 8. Legacy Formatting Inventory

Formatting paths:

- `getDisplayValue(fiscalSummaryVisibleSlice.revenueTotal, "money")`: approved Shadow visible formatting.
- `getDisplayValue(fiscalSummaryVisibleSlice.finalContributionAmount, "money")`: approved Shadow visible formatting.
- `getDisplayValue(currentMonthTotal, "money")` in PDF export: export remains Legacy.
- `currentMonthTotal.toLocaleString("fr-FR")` in monthly reflection: dashboard summary remains Legacy.
- `estimatedCharges.toLocaleString("fr-FR")` in monthly reflection: dashboard summary remains Legacy.
- `computed?.rate ? Math.round(computed.rate * 100) : 0` in PDF export: export remains Legacy.

Formatting alone is not removable because it is attached to active consumers.

## 9. Feature Flag and Rollback Dependencies

Flag:

```text
FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED
```

The flag must remain.

Required Legacy paths when flag is OFF:

- `currentMonthTotal` for `revenue.total`;
- `currentMonthTotal` for `summary.baseAmount`;
- `estimatedCharges` for `summary.finalContributionAmount`;
- `computed?.rate` for `summary.effectiveRate`;
- `computed?.acreStatus` for `acre.status`.

Removing any of these would break immediate rollback.

Fallback cannot be removed yet because no LOT has authorized replacing rollback with another mechanism.

## 10. Parity Dependencies

Parity requires:

- `legacySnapshot.revenueTotal`;
- `legacySnapshot.estimatedAmount`;
- `legacySnapshot.rate`;
- `legacySnapshot.acreStatus`;
- `shadowResult`;
- `shadowInput`.

The Legacy reference remains necessary for:

- passive parity validation;
- LOT 5.11 additional evidence;
- LOT 5.13 visible replacement guard;
- LOT 5.14 validation guard;
- LOT 5.15 stabilization guard;
- MISMATCH detection.

Stopping parity requires a dedicated authorization. It is not approved here.

## 11. Runtime Evidence Dependencies

Runtime evidence depends on:

- `createRuntimeParityEvidence`;
- `createRuntimeParityEvidenceStore`;
- `legacySnapshot`;
- `shadowResult`;
- `shadowInput`;
- fixed ordered first-slice fields.

If Legacy snapshot construction is removed, runtime evidence can no longer prove MATCH/MISMATCH against Legacy. That would violate the Evidence Integrity Guard unless replaced by an approved evidence strategy.

Decision: keep.

## 12. Persistence Dependencies

Observed persistence paths:

- Supabase profile reads/writes;
- Supabase revenues reads/writes;
- Supabase invoices reads/writes;
- Supabase reminders;
- localStorage assistant draft under `LS_KEY`;
- localStorage guest revenues;
- localStorage guest invoices;
- localStorage profile conflict and UI preferences;
- localStorage export usage counters;
- localStorage assistant messages.

First-slice computed values are not directly persisted as Shadow values.

However, Legacy inputs and derived values remain connected to persisted state through:

- revenues loaded from localStorage/Supabase feeding `currentMonthTotal`;
- fiscal profile loaded from localStorage/Supabase feeding `computed`;
- assistant drafts preserving answers and messages;
- guest revenue migration to Supabase.

Deletion is blocked until persistence is explicitly confirmed independent or migrated in a dedicated LOT.

## 13. Payload Dependencies

Payload-like consumers include:

- `trackEvent(...)` / feedback context;
- beta micro feedback context snapshot;
- premium CTA event context;
- Supabase payload builders for profile/revenue/invoice migration;
- assistant local draft payload.

`feedbackContextSnapshot` still includes `totalRevenues: currentMonthTotal || 0`.

These are outside the first visible slice and not authorized for Shadow replacement.

Decision: keep Legacy.

## 14. Export Dependencies

Exports remain active Legacy consumers:

- PDF fiscal report in `src/App.jsx`;
- invoice PDF/XML exports in `src/components/InvoiceGenerator.jsx`;
- export usage counters in localStorage.

The PDF report uses:

- `currentMonthTotal`;
- `dashboardChargesDisplay`;
- `dashboardAvailableDisplay`;
- `computed`;
- `savingsGoal`;
- `savingsProgress`;
- revenue history.

Although `dashboardChargesDisplay` can include the Shadow first-slice visible value, the export as a whole is not migrated and still contains broad Legacy consumers.

Decision: keep Legacy; export migration requires a dedicated gate.

## 15. Assistant Dependencies

Assistant-related paths include:

- `messages`;
- assistant draft persistence under `LS_KEY`;
- `submitAnswer`;
- assistant profile edits;
- localStorage restoration;
- assistant UI state.

The first visible slice is not directly injected into assistant output by LOT 5.13.

However, assistant state and profile answers feed the Legacy calculation inputs. Removing Legacy would risk profile/update behavior and local draft compatibility.

Decision: keep.

## 16. Other Consumer Dependencies

Other non-migrated consumers:

- smart alerts;
- smart priorities;
- savings goal;
- savings progress;
- dashboard monthly reflection;
- premium trigger context;
- TVA labels and warnings;
- CFE alerts;
- declaration deadline labels;
- first revenue onboarding;
- dashboard gates;
- invoices and reminders.

These consumers depend on `currentMonthTotal`, `computed`, `estimatedCharges`, or `availableAmount`.

They are not first-slice removal candidates.

## 17. Double Source of Truth Assessment

Current coexistence:

- Shadow visible for the first slice;
- Legacy still used for rollback;
- Legacy still used for parity;
- Legacy still used for runtime evidence;
- Legacy still used for persistence inputs;
- Legacy still used for exports;
- Legacy still used for assistant-adjacent state;
- Legacy still used for out-of-slice dashboard.

Assessment:

- intentional: yes;
- temporary: yes;
- safe: yes, because LOT 5.13-5.16 tests validate isolation;
- removable now: no.

The coexistence is not a contradiction, but it blocks Legacy deletion.

## 18. Dead Code Candidates

No first-slice Legacy element is a confirmed dead-code candidate.

Potentially obsolete visible Legacy reads were checked:

- primary dashboard revenue display no longer directly reads `currentMonthTotal`;
- primary dashboard charge display no longer directly reads `estimatedCharges` for real revenue;
- declaration helper amount no longer directly formats `currentMonthTotal`.

However:

- the underlying values are still used by fallback;
- the same variables remain used elsewhere;
- the declaration helper still gates on `currentMonthTotal > 0`;
- exports and summaries still consume Legacy.

Decision: no `DEAD CODE CANDIDATE` promoted to removal.

## 19. Hidden Dependency Assessment

Hidden dependency categories checked:

- closures;
- `useMemo`;
- `useEffect`;
- callbacks;
- destructuring;
- intermediary objects;
- JSX conditions;
- summary builders;
- assistant message persistence;
- payload builders;
- export builders;
- formatters;
- feature flag fallback.

Known hidden-risk examples:

- `dashboardChargesDisplay` is a shared display value consumed beyond the first slice;
- `currentMonthTotal` is both calculation input and UI condition;
- `computed` contains first-slice values and non-slice values together;
- PDF export mixes visible slice-adjacent values with non-migrated report sections.

These risks block removal.

## 20. Removal Classification Matrix

| Element | Category | Reason |
| --- | --- | --- |
| `currentMonthTotal` | B / C / E | rollback, parity, dashboard/export/feedback consumers |
| `computed` | C / E | parity, rate/ACRE fallback, deadlines, TVA, CFE, labels |
| `computed.estimatedAmount` | C | runtime evidence Legacy value |
| `computed.rate` | B / C / E | fallback, parity, PDF rate and other calculations |
| `computed.acreStatus` | B / C | fallback and parity |
| `estimatedCharges` | B / E | fallback, dashboard summaries, savings, exports |
| `availableAmount` | E | out-of-slice dashboard and export consumers |
| `legacySnapshot` | C | runtime evidence |
| `dashboardChargesDisplay` | E | shared visible/export display value |
| `currentMonthTotal > 0` declaration gate | E | dashboard condition |
| PDF export Legacy reads | E | export not migrated |
| feedback context Legacy reads | E | analytics/feedback not migrated |

No `REMOVE NOW CANDIDATE`.

No `UNKNOWN` is proposed for deletion.

## 21. Safe Removal Candidates

None.

Rationale:

- visible reads were already redirected in LOT 5.13;
- remaining Legacy values are not merely obsolete reads;
- every candidate still supports rollback, parity, evidence, export, assistant-adjacent state or another dashboard consumer.

## 22. Blocked Removal Candidates

Blocked:

- `currentMonthTotal`: rollback, parity, exports, feedback and non-slice dashboard.
- `computed`: broad Legacy obligations object.
- `estimatedCharges`: rollback and out-of-slice consumers.
- `computed.rate`: rollback, parity and export.
- `computed.acreStatus`: rollback and parity.
- `legacySnapshot`: evidence integrity.
- PDF export reads: export not migrated.
- dashboard summary reads: second-slice / non-slice area.

Reason for block: removing any of these now would violate at least one stop condition.

## 23. Proposed Removal Order

No removal should happen in LOT 5.18.

Recommended order instead:

1. Harden Legacy retention responsibilities and labels in tests/docs.
2. Add explicit guards that Legacy fallback/parity/export responsibilities remain intentional.
3. Inventory export and assistant consumers in separate gates.
4. Migrate persistence/export/assistant only through dedicated LOTs if approved.
5. Only then consider removing first-slice Legacy fallback.
6. Remove the feature flag last, in a dedicated LOT after rollback strategy changes.

## 24. Future Test Plan

Before any future removal:

- visible slice remains Shadow;
- flag OFF behavior remains defined or explicitly retired;
- parity remains functional or explicitly retired;
- runtime evidence remains functional or explicitly retired;
- persistence unchanged;
- payloads unchanged;
- exports unchanged;
- assistant unchanged;
- no other slice affected;
- build green;
- Node suite green;
- two Playwright runs green;
- targeted lint green;
- rollback local.

No test was created in this gate review.

## 25. Risks

| Risk | Level | Evidence | Mitigation | Blocking |
| --- | --- | --- | --- | --- |
| Premature deletion of `currentMonthTotal` | High | many runtime consumers | keep and harden ownership | Yes |
| Hidden dashboard consumer | High | shared display and summary values | require retention guard | Yes |
| Rollback breakage | High | flag OFF uses Legacy values | keep fallback | Yes |
| Parity breakage | High | `legacySnapshot` requires Legacy | keep parity source | Yes |
| Persistence ambiguity | Medium | persisted inputs feed Legacy calculations | persistence gate required | Yes |
| Export divergence | High | PDF report still Legacy-heavy | export migration gate required | Yes |
| Assistant state compatibility | Medium | assistant drafts and answers feed calculations | keep Legacy | Yes |
| Double source confusion | Medium | Shadow visible but Legacy elsewhere | document as intentional | Non-blocking if guarded |
| Loss of evidence | High | removing Legacy removes comparator | keep evidence | Yes |
| React dependency risk | Medium | consumers inside hooks/callbacks | no removal without tests | Yes |

## 26. Rollback Strategy

Future removal rollback must:

- restore the removed local reads/calculations;
- restore feature flag fallback if touched;
- restore parity references if touched;
- require no Supabase migration;
- require no localStorage migration;
- require no user action.

Since no safe removal candidate exists, rollback for LOT 5.17 is simply deleting this document.

## 27. Exact LOT 5.18 Scope

Recommended next LOT:

```text
LOT 5.18 - Legacy Retention Hardening
```

Scope:

- no Legacy deletion;
- no slice expansion;
- no persistence migration;
- add or strengthen guards documenting which Legacy values must remain;
- make rollback/parity/export ownership explicit;
- prevent accidental deletion of `currentMonthTotal`, `computed`, `estimatedCharges`, and `legacySnapshot`.

## 28. Stop Conditions

Removal is blocked because:

- parity still depends on Legacy;
- rollback still depends on Legacy;
- exports still depend on Legacy;
- assistant-adjacent state still depends on Legacy inputs;
- dashboard out-of-slice consumers still depend on Legacy;
- persistence has not been migrated or confirmed independent;
- removing Legacy would require broader slices or consumer migrations;
- rollback after removal is not yet defined.

No Permanent Guard is compromised by keeping Legacy.

## 29. Final Decision

Exactly one document created.

No existing file modified.

No code removed.

No code moved.

No test modified.

No UI modified.

No persistence modified.

No payload modified.

No export modified.

No assistant output modified.

No formula modified.

No rate modified.

No rounding modified.

No business logic modified.

No user behavior modified.

No second slice concerned.

GO POUR LOT 5.18 — LEGACY RETENTION HARDENING
