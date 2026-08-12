# LOT 5.99 - Release Stabilization Gate

## 1. Release Scope

This gate evaluates exactly one bounded layer, not the whole application:

```txt
Calculation / Fiscal Summary Shadow Integration Layer
```

Included:

- Domain calculations: Revenue, Contributions, Legacy ACRE, money/date primitives (`src/domain/calculations/*`);
- Calculation Facade (`calculateFiscalSummary`) and Integration Adapter (`buildFiscalSummaryInput`);
- the visible selector `fiscalSummaryVisibleSlice` and its 15 approved consumers;
- Shadow parity validation (LOT 5.7) and runtime parity evidence (LOT 5.9) mechanisms;
- the feature flag / rollback path (`FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED`);
- the historical guard test suite covering all of the above.

Explicitly excluded from this release candidate designation:

- authentication/routing, premium/pricing, invoice generation, reminders, obligations rate tables beyond their role as Legacy inputs, weekly/monthly reflection beyond their three already-migrated fields, PDF sections other than the one migrated `Objectif d'epargne` denominator, persistence/Supabase/localStorage infrastructure itself, the assistant module, and all UI/UX outside the Objectif d'epargne block;
- these areas are unaffected by this chain and are not covered by this gate's evidence.

## 2. Shadow Architecture Status

Confirmed (source-verified as of LOT 5.96, re-confirmed unchanged by LOT 5.97/5.98's zero-`src/`-change scope, and by this LOT's own `git status` check showing no new `src/App.jsx` diff since):

```txt
fiscalSummaryVisibleSlice = 15 occurrences
no 16th occurrence
every occurrence documented
```

Final list of the 15 consumers (from LOT 5.96's Current Shadow Map, all classified STABLE, none PARTIAL or NEEDS REVIEW):

| # | Consumer | Field | Boundary |
| ---: | --- | --- | --- |
| 1 | `fiscalSummaryVisibleSlice` definition | selector itself | core |
| 2 | `dashboardRevenueDisplay` | `revenueTotal` | UI |
| 3 | `dashboardChargesDisplay` | `finalContributionAmount` | UI |
| 4 | `smartAlertEstimatedCharges` | `finalContributionAmount` | smart alerts |
| 5 | `smartAlertRevenueTotal` | `revenueTotal` | smart alerts |
| 6 | `fiscalCoachingSavingsGoal` | `finalContributionAmount` | coaching |
| 7 | `pdfSavingsGoal` | `finalContributionAmount` | PDF/export |
| 8 | `weeklyRecapEffectiveRate` | `effectiveRate` | weekly recap |
| 9 | `monthlyReflectionRevenueTotal` | `revenueTotal` | monthly reflection |
| 10 | `monthlyReflectionChargesAmount` | `finalContributionAmount` | monthly reflection |
| 11 | URSSAF helper gate | `revenueTotal` | UI |
| 12 | URSSAF helper text | `revenueTotal` | UI |
| 13 | progress indicators gate | `revenueTotal` | UI |
| 14 | Objectif d'epargne text percentage | `finalContributionAmount` | UI |
| 15 | Objectif d'epargne progress bar | `finalContributionAmount` | UI |

No undocumented occurrence exists. Each consumer has a dedicated migration LOT and a dedicated validation/stabilization LOT in the historical record.

## 3. Legacy Retention Status

| Root | Why it remains | Dependent consumers | Not a dead compatibility root because | Future migration |
| --- | --- | --- | --- | --- |
| `currentMonthTotal` | direct positional input to `computeObligations()`, the Legacy Rules Engine call, and to `legacySnapshot` (the Legacy side of the parity mechanism) | Rules Engine, assistant, feedback context, PDF "Revenus cumules" line, `estimatedCharges`/`availableAmount` formulas | it has 24 real reads across UI, export, assistant, and feedback boundaries -- removing it would remove the Legacy side of the parity check itself, not clean up dead code | not justified -- required by the parity architecture by design |
| `estimatedCharges` | Legacy charge estimate, input to `availableAmount` and to the "Disponible ajuste" cockpit line | same boundaries as above, plus smart-alert selector fallback | 12 real reads, verified against live source at every guard checkpoint since LOT 5.91A | not justified -- same reasoning |
| `availableAmount` | numerator source for `savingsProgress`; no approved Shadow field exists for it | cockpit display, `smartPriorities`, PDF export dependency, "Disponible ajuste" line | 8 real reads; LOT 5.75 explicitly found no Shadow candidate, and none has been produced since | optional -- would need a new Shadow field, not currently justified by any concrete need |
| `savingsProgress` | numerator for both remaining Legacy-sourced ratios (coaching threshold, PDF percentage); explicitly flagged `NEEDS PARITY EVIDENCE` in LOT 5.75/5.76/5.84 and never given one | coaching low-reserve branch, PDF percentage, UI text/bar | 8 real reads across coaching and an exported artifact; this is the single most consequential remaining Legacy value, and it was never the target of a migration attempt (every prior LOT migrated a denominator, never this numerator) | optional -- the most plausible next migration target if a future LOT is ever opened, but not required for this release candidate |

No second `savingsGoal`-class orphaned root exists (confirmed by full-file comment scan in LOT 5.96, re-confirmed by LOT 5.97's 50-file inventory finding no new dead-code candidate).

## 4. Parity Status

| Mechanism | Status | Evidence |
| --- | --- | --- |
| Shadow parity validation (LOT 5.7) | GREEN | `SHADOW_PARITY_MATCH`/`SHADOW_PARITY_MISMATCH`, strict `Object.is` comparison, no normalization, no tolerance, passive (result discarded via `void`), Legacy remains sole source of truth |
| Runtime parity evidence (LOT 5.9) | GREEN | `createRuntimeParityEvidence`/`createRuntimeParityEvidenceStore`, deterministic, reproducible, disableable, bounded in-memory store, no persistence, no UI exposure |
| Deterministic mismatch detection | GREEN | both mechanisms proven, in their own dedicated tests and re-exercised in `tests/lot-5-84-savingsgoal-pdf-parity-evidence.test.js`'s "Intentional Mismatch" scenario, to correctly detect and report a real divergence with no auto-correction |
| Feature flag ON/OFF behavior | GREEN | `FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED` gates every one of the 15 consumers through the same `usesShadow` selector; OFF or missing Shadow result falls back to the exact pre-existing Legacy field, per consumer, verified by dedicated flag-ON/flag-OFF/absent-Shadow-result test cases in the migration LOT for each consumer |
| Rollback behavior | GREEN | every migrated consumer has an independently local, single-expression rollback documented in its own migration report; the root removal (LOT 5.91A) rollback is equally local |

```txt
No RED found anywhere in this layer.
```

## 5. Runtime Stability

Three full validation cycles ran consecutively after the `savingsGoal` chain closed, each fully green:

| LOT | node --test | build | lint | Playwright ×2 |
| --- | --- | --- | --- | --- |
| 5.95 | 898/898 | PASS | 50/21/29 | 11/11, 11/11 |
| 5.97 | 900/900 | PASS | 50/21/29 | 11/11, 11/11 |
| 5.98 | 908/908 | PASS | 50/21/29 | 11/11, 11/11 |

The rising test totals (898 -> 900 -> 908) come entirely from new guard/lock-in tests added during hardening (LOT 5.91A, 5.97, 5.98); the lint line held exactly constant across all three cycles, and Playwright's 11/11 count never moved, meaning no test was silently dropped to make a number look stable.

Per this LOT's own instruction, these three cycles were treated as sufficient evidence rather than re-executed. A light `git status`/`git diff --stat` check was run for this LOT and found no `src/App.jsx`, test, or config change since LOT 5.98 -- no contradiction requiring a fresh run was found.

```txt
Three consecutive fully-green cycles, with no contradicting signal since, is treated as sufficient runtime-stability evidence for this gate.
```

## 6. Test Architecture Status

Confirmed from LOT 5.97/5.98, re-verified by this LOT's authority-document read:

```txt
0 CRITICAL
2 MEDIUM
2 ACCEPTED
```

| Item | Class | Detail | Blocks release? |
| --- | --- | --- | --- |
| 11 files' whole-file hook counts without a boundary-extraction helper to attach a scoped supplement to | MEDIUM | `lot-5-21/22/24/25/26/65/66/70/72/73` carry raw `useState`/`useEffect`/`useMemo` totals with no scoped companion check; localized to those files, does not affect release-scope correctness | no -- fragile but not currently broken, and any break it would produce is a false test failure, not a runtime defect |
| one cosmetic `// PREVIEW POUR MODALE AJOUT REVENU` comment used as a block-extraction boundary in several files | MEDIUM | comment carries no architectural contract, purely a formatting anchor; a rewording would break several guards' extraction with no runtime change | no -- same reasoning |
| duplicated `extractBlock`/`sourceWithoutComments` implementations across 47+ guard files | ACCEPTED | a shared helper was evaluated twice (LOT 5.97, 5.98) and declined both times on sound reasoning (a shared module importable by 47+ files would itself become a new single point of cascading fragility) | no -- deliberate, reasoned trade-off, not oversight |
| no shared source-normalization utility | ACCEPTED | same reasoning as above; each file's own local `.replace(/\r\n/g, "\n")` (LOT 5.92 idiom) is the deliberately chosen pattern | no |

None of the four items are corrected in this LOT, per its documentation-only scope.

## 7. Lint Debt Status

```txt
50 problems
21 errors
29 warnings
```

This is explicitly **not** called clean lint. It is a known, pre-existing debt, unchanged in shape since before the `savingsGoal` chain began (LOT 5.80's baseline was already `50/21/29`) and confirmed unchanged through LOT 5.91A-5.98.

Classification of the 21 errors:

| Class | Count | Detail | Release blocking? |
| --- | ---: | --- | --- |
| `no-unused-vars` on declared-but-unread identifiers in `src/App.jsx` | 19 | e.g. `trialDaysLeft`, `handleExportLimitHit`, `handleDownloadTxt`, `dashboardMonthlyReflection`; itemized in full in LOT 5.89's investigation | **non-blocking historical debt** -- none of the 19 identifiers are in this gate's release scope (Shadow/Legacy calculation layer); each predates the `savingsGoal` chain |
| `react-refresh/only-export-components` | 2 | `src/context/AuthContext.jsx`, `src/components/InvoiceGenerator.jsx` co-export non-component values from a component file | **non-blocking historical debt** -- structural to those files' export shape, unrelated to calculation/Shadow architecture, unchanged by this chain |

```txt
0 unknown-classification errors.
21 / 21 errors classified as non-blocking historical debt.
```

The gate's explicit decision: this release candidate is accepted **with** this known lint debt, not despite an unexamined one.

## 8. Persistence / Payload Safety

| Surface | Status | Evidence |
| --- | --- | --- |
| Supabase | UNCHANGED | confirmed at every checkpoint from LOT 5.7 ("aucune persistence ajoutee") through LOT 5.93/5.96 (`supabase.from("revenues")` call unrelated to any Shadow field) |
| localStorage | UNCHANGED | `LS_KEY` read/write paths confirmed unrelated to `fiscalSummaryVisibleSlice` or the removed `savingsGoal` root at every checkpoint |
| Persisted profile | UNCHANGED | no Shadow-derived value found in any persisted-profile path across LOT 5.75, 5.84, 5.91A, 5.93 |
| Payloads (`trackEvent`, export analytics) | UNCHANGED | `export_pdf` event confirmed to still carry only `source`, `totalRevenues`, `invoiceCount` -- no Shadow field, no removed-root field |
| Feedback context | UNCHANGED | `feedbackContextSnapshot`'s `totalRevenues: currentMonthTotal || 0` remains Legacy-sourced, unmodified |

```txt
UNCHANGED across all listed surfaces.
0 UNKNOWN.
```

## 9. Assistant Boundary

```txt
UNCHANGED.
```

`simpleAssistantGuidance({ realMonthlyRevenue: currentMonthTotal, ... })` still reads the Legacy `currentMonthTotal` directly -- no Shadow read was ever introduced into the assistant path, confirmed independently at LOT 5.75, 5.84, 5.91A, 5.93, and 5.96. This is intentional retention, not an oversight: the assistant boundary was explicitly out of scope for every migration LOT in this chain, and this gate confirms it should **remain** explicitly out of scope for any future consumer-migration LOT as well.

## 10. Feature Flag / Rollback

```txt
const FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED = true;
```

- **ON behavior**: each of the 15 `fiscalSummaryVisibleSlice` consumers reads its field from `shadowResult` (the Facade output) when `usesShadow` is true (flag enabled AND a Shadow result exists).
- **OFF behavior**: every consumer falls back to the exact pre-existing Legacy field (`currentMonthTotal`, `estimatedCharges`, `computed?.rate`, `computed?.acreStatus`) it read before any migration in this chain began.
- **Rollback path**: flip the flag to `false`, or rely on the existing `Boolean(shadowResult)` guard if the Shadow computation ever throws (caught and null-returned in `fiscalSummaryShadow`'s `try/catch`). No further action is required per consumer -- each migration's own rollback (documented in its migration report) reduces to "this expression reads the Legacy field again," always a single local expression.
- **Data migration required**: **no**. The Legacy calculation path (`computeObligations`, `currentMonthTotal`, `estimatedCharges`) runs unconditionally regardless of flag state -- it is not lazily computed only when Shadow is off. Nothing needs to be backfilled or migrated to roll back.

```txt
Rollback is local, understood, and requires no data migration -- release candidate rollback requirement met.
```

## 11. Calculation Contract

| Layer | Contract status | Evidence |
| --- | --- | --- |
| Domain calculations (Revenue, Contributions, ACRE, money/date primitives) | STABLE | dedicated test files (`fiscal-summary.test.js`, `revenue-foundations.test.js`, `revenue-periods.test.js`, `contribution-aggregations.test.js`, `standard-contribution.test.js`, `legacy-acre-contribution.test.js`, `calculation-primitives.test.js`, `domain-models.test.js`, `rules-engine.test.js`) all pass, part of the 908 total; unchanged by the entire `savingsGoal` chain |
| Calculation Facade (`calculateFiscalSummary`) | STABLE | contract unchanged since LOT 5.6-5.9; `buildFiscalSummaryInput`/`calculateFiscalSummary` call counts held at exactly 2 across every guard from LOT 5.18 through LOT 5.98 |
| Integration Adapter (`buildFiscalSummaryInput`) | STABLE | `tests/fiscal-summary-input-adapter.test.js` passes; no change across the whole chain |
| Visible selector (`fiscalSummaryVisibleSlice`) | STABLE | 15 consumers, all STABLE per section 2; selector's own definition unchanged since its creation LOT |

```txt
No experimental or unidentified core contract remains in this layer.
```

## 12. Release-Blocking Defects

```txt
NONE
```

No concrete condition was found that would make this layer's release candidate incorrect, unstable, or non-rollbackable: no partial Shadow consumer, no parity RED, no persistence/payload/assistant propagation, no lint regression introduced by this chain, no test-architecture CRITICAL debt, and three consecutive fully-green full-suite/build/lint/Playwright cycles with no contradicting signal since.

## 13. Known Non-Blocking Debt

| Item | Accepted reason | Risk | Future phase |
| --- | --- | --- | --- |
| Lint: 50 problems (21 errors, 29 warnings) | pre-existing, unrelated to this layer, unchanged in shape since before this chain began | low -- static analysis only, no runtime interaction with Shadow/Legacy architecture | optional, independent lint remediation track (not urgent) |
| 2 MEDIUM test-architecture items (Section 6) | fragile but localized, not currently broken | low -- would produce a false test failure, not a runtime defect, if triggered | bounded Phase 3 hardening, only if triggered |
| 2 ACCEPTED test-duplication items (Section 6) | shared-helper cost evaluated twice and declined both times on sound reasoning | low -- duplication is a maintenance cost, not a correctness risk | re-evaluate only if a third, unrelated migration reveals new duplication |
| Remaining Legacy roots (`currentMonthTotal`, `estimatedCharges`, `availableAmount`, `savingsProgress`) | intentional -- two are load-bearing parity inputs, two have no proven Shadow candidate despite being flagged multiple times | low -- these are known, documented, and stable, not silently decaying | optional; `savingsProgress` is the only plausible future migration target, not required |
| Vite chunk-size-over-500kB build warning | pre-existing since before this chain, accepted at every build check from LOT 5.7 onward | low -- build-time warning only, not a runtime defect | optional bundling/code-splitting work, unrelated to this layer |

## 14. Migration Freeze Decision

```txt
YES — FREEZE
```

Rule, effective immediately for this layer:

```txt
No new consumer-migration LOT for the Calculation / Shadow Integration Layer
without a new business need or concrete evidence of real risk.
```

This ratifies, at gate level, the stop-migration criteria LOT 5.96 already established (its section 14) after finding no ready, low-risk migration target following the `savingsGoal` removal. `savingsProgress`/`availableAmount` remain the only plausible future targets, and neither is migrated by default under this freeze.

## 15. Release Candidate Criteria

| Criterion | Status | Evidence | Decision |
| --- | --- | --- | --- |
| Full tests green | PASS | 908/908 at LOT 5.98, 0 fail | met |
| Build green | PASS | `npm run build` PASS at every checkpoint | met |
| Critical parity green | PASS | Section 4, no RED | met |
| Rollback documented | PASS | Section 10, local, no data migration | met |
| No critical test debt | PASS | Section 6, 0 CRITICAL | met |
| No undocumented Shadow consumer | PASS | Section 2, all 15 documented and STABLE | met |
| Persistence safe | PASS | Section 8, UNCHANGED, 0 UNKNOWN | met |
| Payload safe | PASS | Section 8, UNCHANGED | met |
| Assistant boundary understood | PASS | Section 9, UNCHANGED, intentionally excluded | met |
| No release blocker | PASS | Section 12, NONE | met |

```txt
10 / 10 criteria met.
```

## 16. Next Phase

```txt
A. RELEASE CANDIDATE FREEZE
```

Chosen over the alternatives: lint remediation (C) and observability (D) are real but independent, non-urgent tracks unrelated to this layer's stability (Section 13); product/UX stabilization (B) has no evidence or driver surfaced in this gate; documentation/architecture freeze (E) is close in spirit but freeze (A) is the more precise designation given the migration-freeze decision in Section 14 and the fact that the accepted debt is already fully itemized in this report rather than needing a further documentation pass.

## 17. Versioning Recommendation

```txt
Fiscal Calculation Shadow Integration Layer — RC1
```

This designates the state of `fiscalSummaryVisibleSlice` and its 15 consumers, the Calculation Facade/Adapter contract, and the parity/rollback mechanism as of LOT 5.98's validation cycle. No `package.json` version was changed in this LOT.

## 18. GO / NO-GO

```txt
GO — WITH ACCEPTED DEBT
```

Justification: every release-candidate criterion in Section 15 is met with direct evidence, no release-blocking defect was found (Section 12), and the debt that does exist (Section 13) is fully itemized, classified, and judged non-blocking rather than left unexamined. "GO — STABLE RELEASE CANDIDATE" (zero debt) would overstate the state; "NO-GO" would ignore that no criterion actually failed.

## Confirmations

- no code modified;
- no test modified;
- no guard modified;
- no consumer migrated;
- Shadow baseline remains `fiscalSummaryVisibleSlice = 15`, no 16th occurrence;
- runtime unchanged (`git status` shows no new `src/App.jsx` diff since LOT 5.98);
- persistence/payloads unchanged;
- assistant unchanged;
- migration freeze evaluated explicitly (Section 14: YES — FREEZE).

## Final Decision

The gate passes: every criterion in Section 15 is met, no release blocker exists, and the accepted debt (lint, 2 MEDIUM/2 ACCEPTED test items, intentional Legacy retention) is fully documented in this report rather than requiring a further review pass.

```txt
GO POUR LOT 6.0 — RELEASE CANDIDATE FREEZE
```
