# LOT 5.96 - Post-SavingsGoal Architecture Gate Review

## 1. Executive Summary

LOT 5.96 is a documentation-only architectural review of `src/App.jsx` now that the `savingsGoal` removal chain (LOT 5.89 through 5.95) is closed and fully green (`node --test` 898/898, build PASS, lint at the historical `50/21/29` baseline, Playwright 11/11 twice).

No runtime code, test, or guard was modified in this LOT. Only source inspection was performed.

Headline finding: the 15 `fiscalSummaryVisibleSlice` consumers are all stable, single-purpose, and already validated by dedicated LOTs. The remaining Legacy roots (`currentMonthTotal`, `estimatedCharges`, `availableAmount`, `savingsProgress`) are **not** dead-compatibility candidates like `savingsGoal` was -- they are the live inputs to the Legacy `computeObligations()` calculation engine, which still runs in parallel with the Shadow `calculateFiscalSummary()` facade specifically to produce parity evidence and to preserve an instant feature-flag rollback path. No other `savingsGoal`-style orphaned root was found anywhere in the file.

The more urgent, concretely evidenced risk is not remaining Legacy code -- it is the guard/test architecture itself: this single `savingsGoal` removal surfaced three distinct, previously-latent test bugs (a CRLF/LF marker bug affecting six files, a cross-file text-literal coupling bug, and cascading global occurrence-count guards) that had nothing to do with the runtime change being made.

Recommendation:

```txt
GO POUR LOT 5.97 — TEST ARCHITECTURE HARDENING
```

## 2. Current Shadow Map

All 15 current `fiscalSummaryVisibleSlice` occurrences in `src/App.jsx`:

| # | Line | Block / consumer | Field read | Purpose | Visible | Origin LOT (by evidence) | Status |
| ---: | ---: | --- | --- | --- | --- | --- | --- |
| 1 | 5669 | `fiscalSummaryVisibleSlice` definition | n/a (defines the selector itself) | flag-gated Legacy/Shadow selector | n/a | LOT 5.9-5.13 (runtime parity evidence / first slice) | STABLE |
| 2 | 6083 | `dashboardRevenueDisplay` | `revenueTotal` | cockpit revenue display | yes | LOT 5.13/5.14 (first visible replacement) | STABLE |
| 3 | 6095 | `dashboardChargesDisplay` | `finalContributionAmount` | cockpit charges display | yes | LOT 5.13/5.14 | STABLE |
| 4 | 6313 | `smartAlertEstimatedCharges` | `finalContributionAmount` | smart alert charges input | no (input only) | LOT 5.61-5.66 (reserve-low) / 5.68-5.73 (rawAvailable revenue) | STABLE |
| 5 | 6314 | `smartAlertRevenueTotal` | `revenueTotal` | smart alert revenue input | no (input only) | LOT 5.68-5.73 | STABLE |
| 6 | 6445 | `fiscalCoachingSavingsGoal` | `finalContributionAmount` | coaching low-reserve denominator | indirect (drives a boolean branch) | LOT 5.79A | STABLE |
| 7 | 6449 | `pdfSavingsGoal` | `finalContributionAmount` | PDF `Objectif d'epargne` denominator | exported | LOT 5.86A | STABLE |
| 8 | 6938 | `weeklyRecapEffectiveRate` | `effectiveRate` | weekly recap rate input | yes | LOT 5.42-5.49 | STABLE |
| 9 | 8675 | `monthlyReflectionRevenueTotal` | `revenueTotal` | monthly reflection revenue input | yes | LOT 5.51-5.54 | STABLE |
| 10 | 8677 | `monthlyReflectionChargesAmount` | `finalContributionAmount` | monthly reflection charges input | yes | LOT 5.56-5.59 | STABLE |
| 11 | 13153 | `dashboardDeclareHelper` (URSSAF helper) | `revenueTotal` (gate) | conditional helper visibility | yes | LOT 5.18-5.22 (predates 5.24, per LOT 5.24's own "only earlier revenue gate migration" guard) | STABLE |
| 12 | 13156 | `dashboardDeclareHelper` text | `revenueTotal` (display) | "Montant a declarer" amount | yes | same as #11 | STABLE |
| 13 | 14554 | progress indicators gate | `revenueTotal` (gate) | shows/hides the Objectif d'epargne UI block | yes | LOT 5.20-5.26 (next consumer migration) | STABLE |
| 14 | 14568 | Objectif d'epargne text percentage | `finalContributionAmount` | UI percentage denominator | yes | LOT 5.37/5.39/5.40 | STABLE |
| 15 | 14586 | Objectif d'epargne progress bar width | `finalContributionAmount` | UI progress-bar denominator | yes | LOT 5.37/5.39/5.40 | STABLE |

All 15 are classified **STABLE**: each has a dedicated migration LOT, a dedicated validation/stabilization LOT, an isolated rollback path (documented per-consumer in its own migration report), and passing coverage today. No occurrence is `PARTIAL` or `NEEDS REVIEW` -- there is no half-migrated consumer currently in the file.

## 3. Current Legacy Map

| Root | Read count (whole-word) | Main consumer blocks | Boundaries touched | Shadow candidate | Parity evidence | Coupling | Risk |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| `currentMonthTotal` | 24 | `computeObligations()` input (`ca_month`), `fiscalSummaryShadow` legacy snapshot, `estimatedCharges`/`availableAmount` formulas, feedback context, assistant (`simpleAssistantGuidance`), PDF export ("Revenus cumules"), smart-alert fallback path | UI, export, assistant, feedback, Rules Engine input | `fiscalSummaryVisibleSlice.revenueTotal` (already the Shadow read for every *display* consumer) | yes, via `createRuntimeParityEvidence` legacySnapshot | HIGH -- it is a direct positional argument to `computeObligations()`, the Legacy Rules Engine call | migrating this root itself, not just its display consumers, would remove the Legacy side of the parity check |
| `estimatedCharges` | 12 | Legacy `useMemo` definition, `availableAmount` formula, Legacy-selector fallback inside `fiscalSummaryVisibleSlice`, smart-alert input alias, "Disponible ajuste" cockpit calculation, PDF export dependency | UI, export, smart alerts | `fiscalSummaryVisibleSlice.finalContributionAmount` (already the Shadow read for display consumers) | yes, same mechanism as above | HIGH -- feeds `availableAmount`, which feeds `savingsProgress`, which is the PDF/coaching numerator | same reasoning as `currentMonthTotal` |
| `availableAmount` | 8 | Legacy `useMemo` definition, cockpit "Disponible" display, `smartPriorities` (`recommendedReserve`), `savingsProgress` source, PDF export dependency, "Disponible ajuste" line | UI, smart alerts, export | none approved -- LOT 5.75 explicitly found "no approved direct `availableAmount` field" in the Shadow facade | none dedicated | MEDIUM -- narrower blast radius than `currentMonthTotal`/`estimatedCharges`, but still the numerator source for `savingsProgress` | not currently migratable without a new Shadow field |
| `savingsProgress` | 8 | Legacy `useMemo` (`return availableAmount`), coaching threshold comparison, PDF percentage numerator, UI text/bar numerator, dependency arrays | coaching, PDF, UI | none approved -- explicitly flagged `NEEDS PARITY EVIDENCE` in LOT 5.75/5.76/5.84 and never given one | none dedicated | MEDIUM-HIGH -- it is the numerator in every remaining Legacy-sourced ratio (coaching threshold, PDF percentage) | this is the one Legacy value still directly driving both an exported artifact (PDF) and a coaching branch |

## 4. Dead Compatibility Candidates

A full-file scan for retention-style comments (`Legacy`, `compatibility`, case-insensitive) found exactly 5 hits, none of them a `savingsGoal`-style orphaned root:

| Line | Text | Classification |
| --- | --- | --- |
| 1157-1158 | `legacyValue` -- export-usage migration variable | unrelated, local, actively used |
| 4397-4400 | `legacyInvoicesToMigrate` -- invoice migration payload builder | unrelated, local, actively used |
| 5552-5560 | `legacySnapshot` -- parity-evidence input, by design | intentional, part of the Shadow/parity mechanism itself |
| 6962 | `legacyFallbackRate` -- weekly rate fallback | unrelated, local, actively used |

No second `// LOT X.XX: Legacy ... retained for compatibility` boundary comment exists anywhere in the file -- the one that existed for `savingsGoal` (added at LOT 5.29, removed at LOT 5.91A) was unique. Classification of the remaining Legacy roots:

- `currentMonthTotal`, `estimatedCharges`: **ACTIVE LEGACY** -- genuine, load-bearing Rules Engine inputs, not compatibility shims.
- `availableAmount`, `savingsProgress`: **COMPATIBILITY LAYER** -- Legacy-derived values with no approved Shadow equivalent yet, actively read by real consumers (not dead).
- No **OBSOLETE COMPATIBILITY** or **DEAD CODE CANDIDATE** was found. `savingsGoal` was the only variable of that shape, and it is now removed.

## 5. currentMonthTotal Review

Real, non-display consumers confirmed by direct inspection:

- `computeObligations({ ..., ca_month: currentMonthTotal, ... })` -- direct positional input to the Legacy Rules Engine call (line 5515). This is the single most load-bearing use: it is not a display value, it drives the entire `computed` object (rate, deadlines, TVA status, treasury recommendation, etc.).
- `fiscalSummaryShadow`'s `legacySnapshot.revenueTotal` (line 5553) -- feeds `createRuntimeParityEvidence`, i.e. it is the Legacy side of the ongoing parity check between the Legacy engine and the Shadow facade.
- `simpleAssistantGuidance({ realMonthlyRevenue: currentMonthTotal, ... })` -- assistant boundary (line 6013).
- `feedbackContextSnapshot`'s `totalRevenues: currentMonthTotal || 0` -- feedback/analytics-adjacent boundary (line 8456).
- PDF export text `Revenus cumules : ${getDisplayValue(currentMonthTotal, ...)}` -- a *different* PDF field than the already-migrated `Objectif d'epargne` percentage; still fully Legacy (line 9952).
- Its own `useMemo` definition and dependency arrays for `estimatedCharges`, `fiscalSummaryVisibleSlice`, and several `useCallback`/`useMemo` hooks.

None of these are dead. `currentMonthTotal` is not a leftover convenience alias -- it is one of the two roots (with `computed`) that the entire Legacy calculation path is built on, and it is deliberately still exercised so the Shadow/Legacy parity mechanism has something real to compare against.

## 6. estimatedCharges Review

Baseline guard: 12 occurrences (post-LOT-5.91A).

- Business-critical: the `estimatedCharges` `useMemo` itself (`Math.round(currentMonthTotal * computed.rate)`) and its role as `availableAmount`'s subtrahend are core Legacy calculation, not incidental.
- Export/assistant: feeds the PDF export dependency list and the "Disponible ajuste" cockpit line (`availableAmount - Math.max(estimatedCharges, treasuryRecommended)`), a UI calculation with no Shadow equivalent today.
- Smart alerts: `smartAlertEstimatedCharges` is already a Shadow-backed alias (`fiscalSummaryVisibleSlice.finalContributionAmount`) -- the raw `estimatedCharges` module variable is not what smart alerts consume, only its Legacy-selector fallback path inside `fiscalSummaryVisibleSlice` itself still touches it.
- Non-proven usages: the "Disponible ajuste" line and `availableAmount`/`savingsProgress` are the only remaining paths where a raw `estimatedCharges` read has no dedicated Shadow candidate or parity evidence.

No migration performed or recommended in this LOT.

## 7. availableAmount Review

- Definition: `Math.max(0, currentMonthTotal - estimatedCharges)`.
- Real consumers: cockpit "Disponible" display (via `dashboardAvailableDisplay`, itself gated by `cockpitEstimate`), `smartPriorities({ recommendedReserve: availableAmount })`, the "Disponible ajuste" line, `savingsProgress`'s source, and a PDF export dependency-array entry.
- LOT 5.75 already documented that no approved Shadow field exists for `availableAmount` -- this remains true today; nothing changed it.
- Architecturally still necessary: it is the sole numerator source for `savingsProgress`, which is itself the numerator for both remaining Legacy-sourced ratios (coaching threshold and PDF percentage). Removing it would require a Shadow-side "available" concept that does not exist in the Domain facade yet.

## 8. savingsProgress Review

- Definition: `useMemo(() => availableAmount, [availableAmount])` -- a thin Legacy-derived alias, not a new calculation.
- Reads: coaching threshold comparison (`savingsProgress < fiscalCoachingSavingsGoal * 0.35`), PDF percentage numerator, UI text/progress-bar numerator, and dependency-array entries for the coaching `useMemo` and the PDF `useCallback`.
- No UI-only "display the raw value" consumer exists -- every read is a ratio numerator.
- Shadow candidate: none exists. LOT 5.75, 5.76, and 5.84 all explicitly flagged this as `NEEDS PARITY EVIDENCE` / `not ready`, and no LOT since has produced that evidence.
- Current role: this is the one Legacy value still directly shaping both an exported document (PDF) and a user-facing coaching branch. It is the most consequential remaining Legacy dependency in the file, precisely because it was never the target of a migration -- every prior LOT migrated the *denominator*, never the numerator.

## 9. Boundary Review

| Boundary | Shadow maturity | Legacy dependency | Migration risk | Recommended action |
| --- | --- | --- | --- | --- |
| UI (dashboard, Objectif d'epargne) | high -- every UI *display* consumer already reads `fiscalSummaryVisibleSlice` | only the "Disponible ajuste" line and the Objectif numerator (`savingsProgress`) remain Legacy | low for display, medium for the numerator | none needed now |
| Coaching | high for denominator (`fiscalCoachingSavingsGoal`) | numerator (`savingsProgress`) remains Legacy | medium -- would require dedicated coaching-numerator parity evidence, never produced | leave as-is |
| PDF/export | high for the one migrated denominator (`pdfSavingsGoal`); every other PDF field (`Revenus cumules`, `Disponible estime`, etc.) is still fully Legacy | numerator (`savingsProgress`) and several other PDF lines remain Legacy | high -- exported artifact, external observability | leave as-is; do not expand PDF migration scope without new dedicated evidence |
| Smart alerts | high -- both charge and revenue inputs are already Shadow-backed | none beyond the selector's own internal Legacy fallback | low | none needed |
| Weekly/monthly summary | high -- all three fields (`effectiveRate`, `revenueTotal`, `finalContributionAmount`) already Shadow-backed | none | low | none needed |
| Feedback/analytics | none migrated | `currentMonthTotal` feeds `feedbackContextSnapshot` and `trackEvent` payloads directly | low blast radius, but zero existing Shadow field for this exact shape | not worth migrating on its own |
| Assistant | none migrated | `currentMonthTotal` feeds `simpleAssistantGuidance` | low blast radius | not worth migrating on its own |
| Persistence/payloads | not applicable | none found (confirmed across LOT 5.75, 5.84, 5.91A, 5.93, and re-confirmed in this review) | n/a | n/a |

## 10. Migration Saturation Assessment

```txt
B. STOP HERE AND HARDEN ARCHITECTURE (with C as the concrete next action)
```

Reasoning: options A (continue consumer-by-consumer) and D (remove other dead roots) both require a target, and this review found none. `savingsGoal` was a leaf-node convenience alias with zero remaining readers -- an unusually clean case. Every remaining Legacy root (`currentMonthTotal`, `estimatedCharges`, `availableAmount`, `savingsProgress`) is either a genuine Rules Engine input feeding the parity mechanism by design, or a numerator with no Shadow candidate ever produced despite three separate LOTs (5.75, 5.76, 5.84) explicitly flagging the gap. Continuing "consumer-by-consumer" migration from here would mean migrating the parity baseline itself or inventing a new Shadow field speculatively -- a materially different, higher-risk kind of change than anything done in the `savingsGoal` chain, and not justified by any concrete failure or need surfaced in this review.

## 11. Alias Duplication Review

`fiscalCoachingSavingsGoal` and `pdfSavingsGoal` are byte-identical in formula:

```js
Math.max(fiscalSummaryVisibleSlice.finalContributionAmount * 3, 500)
```

This duplication is intentional and should remain:

- each alias belongs to a different boundary (coaching vs. PDF export) with its own independent rollback path, its own guard suite, and its own historical parity-evidence LOT (5.77-5.82 for coaching, 5.84-5.86 for PDF);
- LOT 5.85's migration gate explicitly forbade merging boundaries ("Ne pas fusionner ces frontières" was carried through every LOT since);
- a shared helper would couple two independently-rollback-able consumers, which is exactly the risk the `savingsGoal` root retention guard existed to prevent before removal.

Recommendation: document this duplication as permanent-by-design (this report is that documentation); do not consolidate now or later unless a third identical boundary appears and a dedicated review re-evaluates the tradeoff at that time.

## 12. Test Architecture Review

Concrete, first-hand evidence from this exact `savingsGoal` removal (LOT 5.91A-5.95), not a hypothetical:

- **CRLF/LF sensitivity**: `urssafHelperBlock()`-style multi-line marker strings, hardcoded with bare `\n`, against a `src/App.jsx` that is CRLF end-to-end. This bug existed, latent, in at least six files (`lot-5-20/21/22/24/25/26`) and was discovered piecemeal across three separate LOTs (5.91A found 3, 5.93/5.94 found 3 more) rather than in one pass -- strong evidence the pattern is copy-pasted per file rather than shared, so any latent bug in it is multiplied by every file that copied it.
- **Cross-file text-literal coupling**: `lot-5-29` asserted against `lot-5-18`'s raw source text as a string, rather than against live `src/App.jsx` state or a shared constant. A correct, in-scope fix to `lot-5-18` broke an unrelated file with no warning until the full suite ran.
- **Cascading global occurrence-count guards**: many historical files hardcode whole-file counts (`estimatedCharges: 14`, `useMemo: 89`, etc.) that mechanically shift on any unrelated hook addition or removal, regardless of whether that guard's actual protective intent (blocking a *new* migration) was violated.

None of these three bug classes were caused by, or related to, the `savingsGoal` runtime change itself -- they are pre-existing structural weaknesses in how ~40 historical guard files were each independently authored. Continuing to add more guards in the same idiom for a future migration would keep multiplying this fragility rather than reducing it.

Proposed hardening direction (not implemented in this LOT): a shared, tested source-loading/comment-stripping/CRLF-normalizing utility used by every guard file instead of each file re-implementing its own `readFileSync`/`extractBlock`/`sourceWithoutComments`; and preferring block-scoped or semantically-anchored counts over whole-file magic-number counts where feasible. This is a recommendation for LOT 5.97 to scope, not something decided here.

## 13. Lint / Code Health

Current baseline: `50 problems (21 errors, 29 warnings)`.

The 21 errors are, per the itemized inventory already produced in LOT 5.89: 19 `no-unused-vars` (declared-but-unread identifiers such as `trialDaysLeft`, `handleExportLimitHit`, `handleDownloadTxt`, `dashboardMonthlyReflection`, etc.) plus 2 `react-refresh/only-export-components` warnings-as-errors on files that co-export non-component values (`AuthContext.jsx`, `InvoiceGenerator.jsx`).

Assessment: this is unused-declaration debt, not structural debt. None of the 21 errors block, obscure, or interact with the Shadow/Legacy architecture reviewed in this LOT -- they are independent, pre-existing, and were already present (in equivalent form) at the LOT 5.80 baseline, well before the `savingsGoal` chain began. They do not need to be resolved before any future migration decision; they are a separate, lower-priority cleanup candidate structurally similar in spirit to the `savingsGoal` removal (dead-declaration removal) but with no interaction with Shadow/Legacy parity and therefore no urgency tied to this review.

## 14. Stop-Migration Criteria

Established here, explicitly, for future LOTs to apply:

1. Stop migrating a given root when every remaining direct reader either (a) is itself part of the Legacy/Shadow parity mechanism by design (e.g. `legacySnapshot` inputs to `createRuntimeParityEvidence`), or (b) has no approved Shadow field and no LOT has produced dedicated parity evidence for it after being explicitly flagged more than once (this is now true for `savingsProgress` and `availableAmount`, each flagged in three-plus prior LOTs with no follow-up evidence).
2. Stop migrating a boundary once its Shadow coverage already handles every *display* consumer, even if some *calculation* consumers remain Legacy (true today for UI, coaching, PDF, smart alerts, weekly/monthly summary).
3. Persistence, assistant, and feedback/analytics boundaries are deliberately left Legacy -- they were never in scope for `fiscalSummaryVisibleSlice`-style Shadow migration and re-confirmed clean (no `savingsGoal`-class dead code) in this review; do not open them without a specific, separate justification.
4. Stop when the cost of the guard suite protecting a migration exceeds the runtime risk it defends against -- concretely demonstrated in section 12: three real test bugs surfaced from removing one already-dead, zero-risk variable.
5. Do not resume "next consumer" migration until either a genuinely orphaned root (`savingsGoal`-class, zero real readers) is found, or dedicated parity evidence is produced for `savingsProgress`/`availableAmount` specifically -- general "let's keep migrating" is not sufficient justification per this LOT's stated priority order (architecture stability first).

## 15. Next Phase Options

| Option | Fit given current evidence |
| --- | --- |
| A. Next consumer migration | not supported -- no ready, low-risk target exists; `savingsProgress`/`availableAmount` were repeatedly flagged as not-ready and never given evidence |
| B. Legacy root dead-code review | not supported -- this review is that check, and it found no second `savingsGoal`-class root |
| C. Test architecture hardening | supported -- three concrete, evidenced bug classes (CRLF, cross-file coupling, cascading counts) directly slowed down and complicated the just-completed removal |
| D. Shadow selector consolidation review | not supported now -- section 11 found the current duplication (`fiscalCoachingSavingsGoal`/`pdfSavingsGoal`) is intentional and should not be consolidated |
| E. Release stabilization gate | partially supported -- the suite is fully green for the first time in this chain, but there is no evidence of a pending release event driving this option, and it wouldn't address the concrete guard fragility found in section 12 |

## 16. Recommended Next Phase

```txt
GO POUR LOT 5.97 — TEST ARCHITECTURE HARDENING
```

This is chosen over Option E because the evidence in this review is specific and actionable (three named bug classes, six-plus affected files) rather than a general "ship now" signal, and over Option A/B/D because each of those was checked directly in this review and found to have no ready target. Hardening the guard architecture now, while the codebase is fully green, reduces the chance that the *next* migration (whenever a real target appears) repeats the same three bug classes across another six-plus files.

## 17. Risks

| Risk | Level | Mitigation |
| --- | --- | --- |
| Treating "no more easy migrations" as "nothing left to do" and losing momentum entirely | low | this review documents concrete stop-migration criteria (section 14) rather than an open-ended pause |
| Test architecture hardening scope creep into a large refactor of ~40 guard files at once | medium | LOT 5.97 should scope narrowly (a shared utility + a migration plan) rather than rewriting every guard file in one pass |
| `savingsProgress`/`availableAmount` remaining un-migrated indefinitely | low | explicitly documented as a legitimate long-term Legacy retention, not an oversight, per sections 7-8 |
| Lint debt (21 errors) accumulating further before a dedicated cleanup | low | none of it interacts with Shadow/Legacy architecture; independent, lower-priority track |

## 18. Final Decision

No runtime code, test, or guard was modified. The Shadow map is fully stable, no dead-compatibility root was found beyond the one already removed, and the concrete, evidenced risk going forward is test-architecture fragility rather than remaining Legacy surface area.

```txt
GO POUR LOT 5.97 — TEST ARCHITECTURE HARDENING
```
