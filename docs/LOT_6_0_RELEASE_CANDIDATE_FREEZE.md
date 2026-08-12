# LOT 6.0 - Release Candidate Freeze

## 1. Freeze Scope

This freeze covers exactly the layer LOT 5.99 gated, no more and no less:

```txt
Fiscal Calculation Shadow Integration Layer — RC1
```

Included:

- Domain calculations: Revenue, Contributions, Legacy ACRE, money/date primitives (`src/domain/calculations/*`);
- Calculation Facade (`calculateFiscalSummary`) and Integration Adapter (`buildFiscalSummaryInput`);
- Shadow integration (`fiscalSummaryShadow`) and the visible selector (`fiscalSummaryVisibleSlice`);
- the 15 approved `fiscalSummaryVisibleSlice` consumers;
- Shadow parity validation (LOT 5.7) and runtime parity evidence (LOT 5.9);
- the feature flag / rollback path (`FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED`).

Explicitly excluded from this freeze -- changes in these areas are governed by ordinary project process, not this freeze's reopen criteria:

- unrelated product UI (dashboard sections outside the Objectif d'epargne block, onboarding, navigation shell);
- authentication/routing;
- billing/premium/pricing;
- assistant evolution (the assistant boundary itself is frozen as Legacy-only per Section 4, but *new* assistant features are not governed by this freeze);
- future observability work;
- future UX improvements;
- the unrelated lint debt catalogued in Section 6 (its existence is frozen as accepted, but fixing it is not blocked or required by this freeze).

## 2. Shadow Freeze

```txt
fiscalSummaryVisibleSlice baseline = 15
```

Post-freeze rule:

```txt
No 16th occurrence without a new, approved migration gate review.
```

Any future addition to `fiscalSummaryVisibleSlice`'s consumer set must independently produce, in this order: dedicated parity evidence for that consumer -> a migration gate review -> an implementation LOT -> full validation (targeted + full suite + build + lint + Playwright x2) -> a stabilization LOT -> a documented local rollback. This mirrors exactly how each of the 15 current consumers was actually migrated (LOT 5.13 through LOT 5.86A) -- no consumer in the current baseline skipped any of these steps, and none may in the future.

## 3. Legacy Freeze

The following roots are frozen as **intentional, load-bearing retention**, not debt:

| Root | Role | Dependencies | Why retained | Migration status | Reopen criteria |
| --- | --- | --- | --- | --- | --- |
| `currentMonthTotal` | direct input to `computeObligations()` (Legacy Rules Engine) and to `legacySnapshot` (the Legacy side of the parity mechanism) | Rules Engine, assistant, feedback context, PDF "Revenus cumules" line, `estimatedCharges`/`availableAmount` formulas | required by the parity architecture itself -- removing it removes the Legacy comparison baseline, not dead code | not migratable without dismantling the parity mechanism | only if the parity mechanism itself is retired by a dedicated architecture decision |
| `estimatedCharges` | Legacy charge estimate | same boundaries as above, plus smart-alert selector fallback and "Disponible ajuste" cockpit line | same reasoning as `currentMonthTotal` | same | same |
| `availableAmount` | numerator source for `savingsProgress` | cockpit display, `smartPriorities`, PDF export dependency, "Disponible ajuste" line | no approved Shadow field exists; none has been produced since first flagged at LOT 5.75 | optional, not required | a new Shadow "available" field is proposed with dedicated parity evidence |
| `savingsProgress` | numerator for the coaching threshold and the PDF percentage, the two remaining Legacy-sourced ratios | coaching low-reserve branch, PDF percentage, UI text/bar | explicitly flagged `NEEDS PARITY EVIDENCE` at LOT 5.75/5.76/5.84, never produced | optional, the single most plausible future target, not required | dedicated parity evidence is produced for this specific numerator |

These four are not called dette in this freeze -- they are documented, intentional, currently-necessary Legacy surface. No dead `savingsGoal`-class root exists anywhere in scope (confirmed at LOT 5.96, re-confirmed by LOT 5.97's full 50-file inventory).

## 4. Active Shadow Boundaries

The canonical source for the full 15-consumer matrix (consumer, field, block, origin LOT, status) is `docs/LOT_5_99_RELEASE_STABILIZATION_GATE.md`, Section 2, itself built from `docs/LOT_5_96_POST_SAVINGSGOAL_ARCHITECTURE_GATE_REVIEW.md`, Section 2. Not duplicated here in full; summarized:

| Boundary | Consumers | Status | Rollback available |
| --- | ---: | --- | --- |
| UI (dashboard, URSSAF helper, Objectif d'epargne) | 8 | STABLE | YES |
| Coaching | 1 (`fiscalCoachingSavingsGoal`) | STABLE | YES |
| PDF/export | 1 (`pdfSavingsGoal`) | STABLE | YES |
| Smart alerts | 2 | STABLE | YES |
| Weekly recap | 1 | STABLE | YES |
| Monthly reflection | 2 | STABLE | YES |
| Core selector definition | 1 | STABLE | YES |

```txt
15 / 15 STABLE. 15 / 15 rollback available.
```

## 5. Active Aliases

```txt
fiscalCoachingSavingsGoal
pdfSavingsGoal
```

Both documented as intentional, boundary-separated aliases sharing the same formula (`Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)`) by coincidence of contract, not by shared implementation. Each has its own independent rollback, its own guard suite, and its own migration history (coaching: LOT 5.77-5.82; PDF: LOT 5.84-5.86).

**Rule**: do not merge these aliases without a dedicated architectural review. A merge would couple two independently-rollback-able consumers, which is exactly the risk the original `savingsGoal` root retention guard existed to prevent before its removal (LOT 5.91A). This rule is frozen, not merely a suggestion.

## 6. Accepted Debt Register

| Item | Category | Severity | Release blocking? | Accepted reason | Revisit trigger |
| --- | --- | --- | --- | --- | --- |
| 50 lint problems total | lint | low | no | pre-existing since before this chain (LOT 5.80 baseline was already 50/21/29), unrelated to release scope | any delta from `50/21/29` blocks release per Section 7 |
| 21 lint errors (19 `no-unused-vars`, 2 `react-refresh/only-export-components`) | lint | low | no | none of the 21 identifiers/files are in the frozen scope | new error appears (delta), or a dedicated lint remediation LOT is opened |
| 29 lint warnings | lint | low | no | historical, `react-hooks/exhaustive-deps` and similar, unrelated to Shadow/Legacy architecture | new warning appears (delta) |
| 2 MEDIUM test-architecture items (11 files' unsupplemented whole-file hook counts; 1 cosmetic comment anchor) | test architecture | low | no | fragile but localized, not currently broken; a break would produce a false test failure, not a runtime defect | the specific file breaks on an unrelated change, mirroring LOT 5.93/5.94's discovery pattern |
| 2 ACCEPTED test-duplication items (no shared `extractBlock`/normalization helper across 47+ guard files) | test architecture | low | no | shared-helper cost evaluated twice (LOT 5.97, 5.98), declined both times -- a shared module would itself become a new single point of cascading fragility | a third, unrelated migration reveals new, larger-scale duplication than already assessed |
| Vite chunk-size-over-500kB build warning | build | low | no | accepted at every build check since at least LOT 5.7 | the warning becomes a hard build failure (Vite config change), or bundle size becomes a measured performance problem |
| `currentMonthTotal`, `estimatedCharges`, `availableAmount`, `savingsProgress` retained as Legacy | architecture | none (intentional) | no | Section 3 | Section 3's per-item reopen criteria |

## 7. Release Blocker Policy

Effective immediately, any of the following blocks progression from RC1 to a release stable designation:

```txt
- full Node suite failure
- build failure
- any lint delta from 50/21/29 (increase or unexplained decrease)
- Playwright regression (any run below 11/11)
- a parity mismatch classified GREEN turning YELLOW or RED
- an undocumented Shadow consumer (a 16th fiscalSummaryVisibleSlice occurrence without a completed migration chain)
- a persistence or payload regression (any surface in Section 8 of LOT 5.99 moving from UNCHANGED to CHANGED or UNKNOWN)
- an assistant boundary regression (a Shadow read appearing in the assistant path)
- the rollback path becoming non-local (requiring more than a single local expression change or a flag flip)
- a data migration becoming unexpectedly required for rollback
```

Any one of these, if it occurs, requires a dedicated investigation LOT before release stable can be declared -- it does not automatically revert RC1 status, but it must be resolved or explicitly re-gated first.

## 8. Post-Freeze Change Policy

| Class | Definition | Requires reopening the architecture gate? |
| --- | --- | --- |
| A. SAFE DOCUMENTATION | new or corrected documentation, no code change | no |
| B. TEST-ONLY HARDENING | test/guard changes with zero semantics change (e.g. CRLF normalization, cross-file coupling removal, exactly the LOT 5.97/5.98 pattern) | no, but must run targeted + full validation before merging |
| C. BUG FIX | a concrete, reproducible defect inside the frozen scope | no gate reopening, but requires targeted validation scoped to the affected consumer plus the full validation pipeline |
| D. CALCULATION / SHADOW CHANGE | any change to a formula, a Facade/Adapter contract, a feature-flag selector, or an existing consumer's Shadow field | **yes** -- requires reopening this gate (a new LOT 5.99-equivalent review) before implementation |
| E. NEW SHADOW CONSUMER | any 16th+ `fiscalSummaryVisibleSlice` occurrence, or any new Legacy-to-Shadow migration | **yes** -- requires the full migration chain: dependency analysis, contract hardening, parity evidence, migration gate review, implementation, validation, stabilization (mirroring LOT 5.75-5.86A) |

## 9. Migration Reopen Criteria

Legacy migration for this layer stays frozen (Section 14 of LOT 5.99) unless at least one of the following is concretely true:

```txt
- a new business need requires it;
- a concrete, reproducible bug requires it;
- a measurable UX issue requires it;
- a real parity gap requires it (a MATCH/MISMATCH mechanism finds an actual divergence);
- a performance issue requires it;
- a regulatory/compliance requirement requires it;
- a direct architectural simplification is proposed with demonstrated value evidence.
```

"Reducing Legacy" as a goal in itself is explicitly **not** sufficient justification on its own -- this was the exact stop-migration finding of LOT 5.96 and is now a frozen rule, not merely a past recommendation.

## 10. Rollback Policy

- **Feature flag path**: `FISCAL_SUMMARY_FIRST_SLICE_VISIBLE_REPLACEMENT_ENABLED`, currently `true`. Setting it `false` reverts every one of the 15 consumers to its pre-migration Legacy field simultaneously.
- **Local rollback**: each individual consumer also has its own single-expression rollback documented in its own migration report, usable independently of the global flag if only one consumer needs reverting.
- **No data migration**: the Legacy calculation path (`computeObligations`, `currentMonthTotal`, `estimatedCharges`) runs unconditionally regardless of flag state -- nothing needs to be backfilled to roll back.
- **Legacy calculation still available**: confirmed still executing on every render, not lazily gated behind the flag.
- **Rollback ownership**: whoever discovers the triggering condition (Section 7) owns opening the investigation LOT; the rollback action itself (flag flip or single local expression edit) requires no architectural approval, only the standard targeted-validation pass for the affected file(s).
- **Rollback validation minimum**: `node --test` on the affected consumer's guard file(s), `node --test tests/shadow-parity-validation.test.js`, `node --test tests/runtime-parity-evidence.test.js`, and a full `node --test` pass before considering the rollback complete.

## 11. RC1 Validation Snapshot

Last validated state (LOT 5.98, re-confirmed unchanged by LOT 5.99's light check and by this LOT's own `git status`/`git diff --stat`, which found no `src/App.jsx`, test, or config change since):

```txt
Full Node:    908/908 PASS
Build:        PASS
Lint:         50 problems (21 errors, 29 warnings)
Playwright:   11/11 PASS, 11/11 PASS
Shadow:       15 occurrences, no 16th
Release blockers: NONE
```

No heavy validation was re-run in this LOT, per its own instruction; the light check found no contradiction.

## 12. RC1 Checklist

- [x] release scope documented (Section 1)
- [x] Shadow baseline documented (Section 2)
- [x] Legacy retention documented (Section 3)
- [x] parity GREEN (LOT 5.99 Section 4, no RED found, re-confirmed unchanged)
- [x] rollback documented (Section 10)
- [x] accepted debt documented (Section 6)
- [x] no release blocker (LOT 5.99 Section 12: NONE; re-confirmed by this LOT's Section 7 policy with no new trigger found)
- [x] migration freeze active (Section 9; ratified at LOT 5.99 Section 14)
- [x] change policy defined (Section 8)
- [x] next phase defined (Section 14 below)

```txt
10 / 10 checklist items satisfied with real evidence.
```

## 13. Versioning

```txt
Fiscal Calculation Shadow Integration Layer — RC1
```

`package.json` version, git tag, release branch, and GitHub Release are explicitly **not** touched in this LOT. Materializing RC1 in Git (a commit checkpoint, a tag, or both) is a separate concern addressed in Section 14.

## 14. Next Phase

Before choosing between product/UX stabilization, release observability, or lint prioritization, one fact dominates the risk picture and must be addressed first:

```txt
git status --short --untracked-files=all: 235 entries (230 untracked, 5 modified)
git log: HEAD is still 622f931, "chore: stable version before SaaS architecture refactor"
```

**Every single LOT in this entire chain -- the full SaaS-shell-v2 refactor, the Domain/Facade/Adapter layer, all ~60 `tests/lot-5-*.test.js` guard files, every document from LOT 0 through this one -- exists only in the uncommitted working tree.** There is no commit capturing any of it. This is the single largest concrete risk to the RC1 designation just established: an IDE crash, an accidental `git checkout`/`git clean`, a disk failure, or any destructive git operation run without care would erase the entire release candidate with no recovery point. A "Release Candidate" that cannot be checked out, diffed against a real baseline, or tagged in Git is a designation that exists only in documentation, not in source control.

```txt
GO POUR LOT 6.1 — RC1 GIT CHECKPOINT REVIEW
```

Chosen explicitly per this LOT's own decision rule: the working tree is not merely large, it is **entirely uncommitted** relative to the last real commit, which is the exact condition that rule names as the deciding factor. Product/UX stabilization and the other options remain valid future phases, but none of them are safe to build on top of until RC1 itself has a real, inspectable, taggable Git checkpoint.

## Final Decision

RC1 freeze is internally coherent: scope, Shadow/Legacy boundaries, accepted debt, rollback, and change policy are all documented with direct evidence, and the checklist is 10/10. The one condition that changes the next-phase recommendation -- an uncommitted working tree of this size -- is confirmed true.

```txt
GO POUR LOT 6.1 — RC1 GIT CHECKPOINT REVIEW
```
