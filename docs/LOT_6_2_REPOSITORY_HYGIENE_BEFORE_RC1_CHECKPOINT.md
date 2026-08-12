# LOT 6.2 - Repository Hygiene Before RC1 Checkpoint

## 1. Executive Summary

LOT 6.2 hardened `.gitignore` only, closing the four portability gaps LOT 6.1 identified before the RC1 checkpoint is created. No source, test, doc, or config file besides `.gitignore` was touched. No file was staged, committed, or removed from tracking.

Result:

```txt
.gitignore now explicitly ignores: .claude/, test-results/, playwright-report/, coverage/
All 4 target patterns verified working via git check-ignore.
The one pre-existing tracked file (test-results/.last-run.json) remains tracked, unaffected -- expected git behavior.
All 231 RC1-candidate untracked files remain untracked and visible (none accidentally hidden).
```

## 2. Previous Gitignore State

Before this LOT, `.gitignore` covered: log files, `node_modules`, `dist`/`dist-ssr`, `*.local` (covers `.env.local`), `.vscode/*` (with an `extensions.json` exception), `.idea`, OS/editor files, and `.env`/`.env.local` explicitly.

Not covered: `.claude/`, `test-results/`, `playwright-report/`, `coverage/`.

`.claude/settings.local.json` was, before this LOT, protected only by this machine's *global* git ignore (`C:\Users\Lenovo/.config/git/ignore`, pattern `**/.claude/settings.local.json`) -- not by the project's own `.gitignore`. Verified via `git check-ignore -v .claude/settings.local.json`, which named that global file as the source, not `.gitignore`. This also means, before this LOT, the bare `.claude/` directory itself was not matched by any pattern at all -- only that one specific filename was protected, and only on this machine.

## 3. Added Ignore Rules

Exact diff:

```diff
 .env
-.env.local
+.env.local
+
+# Local tooling
+.claude/
+
+# Generated test/build output
+test-results/
+playwright-report/
+coverage/
```

`.cache/` and `.vite/` were evaluated per the LOT's instruction and deliberately **not added**: neither exists at the repository root, and Vite's own cache directory (`node_modules/.vite`) is already covered by the existing `node_modules` ignore rule. Adding unused, speculative patterns was avoided per the LOT's own principle of not masking legitimate paths with generic, unjustified rules.

## 4. Claude Local Protection

```txt
.claude/
```

added to the project's own `.gitignore`. Verified after the change:

```txt
git check-ignore -v .claude
-> .gitignore:29:.claude/	.claude
git check-ignore -v .claude/settings.local.json
-> .gitignore:29:.claude/	.claude/settings.local.json
```

The directory is now protected by the project itself, not only by this machine's global config -- a teammate or CI machine cloning this repository is now equally protected. `.claude/settings.local.json` was not opened for its contents beyond confirming (in LOT 6.1) it holds only a `permissions` key structurally; it was not staged, read for secret values, or copied anywhere in this LOT.

## 5. Playwright Artifact Protection

```txt
test-results/
playwright-report/
```

both added. Verified:

```txt
git check-ignore -v test-results/somefile.txt
-> .gitignore:32:test-results/	test-results/somefile.txt   (would be ignored)
git check-ignore -v playwright-report/index.html
-> .gitignore:33:playwright-report/	playwright-report/index.html   (would be ignored)
```

Any future Playwright run's output (`.last-run.json` updates, failure screenshots/videos/traces, or an HTML report) will no longer be a candidate for accidental staging via a future `git add .`/`git add -A`.

## 6. Coverage Protection

```txt
coverage/
```

added. Verified:

```txt
git check-ignore -v coverage/lcov.info
-> .gitignore:34:coverage/	coverage/lcov.info   (would be ignored)
```

No coverage tool currently runs in this project's `package.json` scripts, but the pattern is now in place preemptively, matching the LOT's instruction to close this gap before the checkpoint rather than after a coverage tool is added later.

## 7. Existing Environment Protection

Re-verified unchanged and intact after the edit:

```txt
git check-ignore -v .env.local
-> .gitignore:26:.env.local	.env.local
```

`.env`, `.env.local`, and `*.local` patterns were not touched, reordered, or weakened. No secret-related rule was modified.

## 8. Historical Tracked Artifact

```txt
git ls-files test-results/
-> test-results/.last-run.json
```

This file remains tracked, exactly as it was before this LOT. Per the LOT's explicit instruction, `git rm`/`git rm --cached` was **not** run. Adding `test-results/` to `.gitignore` does not retroactively untrack an already-committed file -- confirmed directly: `git check-ignore -v test-results/.last-run.json` returns not-ignored (exit 1), because gitignore rules never apply to files already in the index, while a hypothetical new file in the same directory (`test-results/somefile.txt`) correctly returns ignored (exit 0). This is expected, standard git behavior, not a defect in the new rule.

```txt
Classification: TRACKED HISTORICAL ARTIFACT.
```

Proposed future treatment (not executed in this LOT): a dedicated, explicitly-scoped follow-up (e.g. an early step of LOT 6.3, or its own micro-LOT) should run `git rm --cached test-results/.last-run.json` with a clear commit message noting it as a hygiene cleanup, after confirming no consumer depends on its presence in the tree. It must not be bundled silently into the RC1 checkpoint commit itself, since that commit's purpose is to capture the SaaS-shell-v2 refactor, not to perform unrelated history hygiene.

## 9. Candidate RC1 Safety Check

```txt
git status --short --untracked-files=all | grep "^??" | wc -l
-> 231   (unchanged from LOT 6.1)
```

None of the 231 untracked RC1-candidate files (across `docs/`, `src/`, `tests/`) live under `.claude/`, `test-results/`, `playwright-report/`, or `coverage/` -- all four new patterns are scoped to directories with zero overlap with the candidate set. No source file, no test file, and no RC1 documentation file became ignored as a side effect of this change.

## 10. Files Modified

```txt
.gitignore   (only file modified)
```

Created:

```txt
docs/LOT_6_2_REPOSITORY_HYGIENE_BEFORE_RC1_CHECKPOINT.md
```

Nothing under `src/`, `tests/`, historical `docs/`, `playwright.config.js`, `package.json`, or `package-lock.json` was touched.

## 11. Validation

```txt
git diff -- .gitignore                                    -> shown in Section 3, minimal additive diff
git status --short                                         -> .gitignore added to the modified-file list; all other entries unchanged from LOT 6.1
git status --ignored --short                                -> .claude/, dist/, node_modules/ still listed;
                                                                 test-results/, playwright-report/, coverage/ now also correctly excluded (no untracked content to show since none currently has new files)
git check-ignore -v .claude/settings.local.json              -> now matches project .gitignore:29 (previously only the machine-global ignore)
git check-ignore -v test-results/somefile.txt (hypothetical) -> matches .gitignore:32
git check-ignore -v playwright-report/index.html (hypothetical) -> matches .gitignore:33
git check-ignore -v coverage/lcov.info (hypothetical)         -> matches .gitignore:34
git check-ignore -v .env.local                                -> unchanged, still matches .gitignore:26
```

Confirmed:

- `.claude/` ignored by the project `.gitignore` -- yes;
- `test-results/` ignored for new content -- yes (pre-existing tracked file unaffected, as expected);
- `playwright-report/` ignored -- yes;
- `coverage/` ignored -- yes;
- `.env.local` remains ignored -- yes;
- no RC1-candidate source/test/doc became accidentally ignored -- confirmed, 231 untracked entries unchanged.

## 12. Remaining Hygiene Debt

| Item | Status | Blocks RC1 checkpoint? |
| --- | --- | --- |
| `test-results/.last-run.json` tracked historically | documented, not removed (Section 8) | no -- untouched by, and unrelated to, the pending RC1 staging set |
| No coverage tool currently configured | `coverage/` pattern added preemptively | no |
| `.cache/`, `.vite/` | evaluated, not added (no real output at repo root) | no |

No new hygiene debt was introduced. No existing debt outside `.gitignore`'s scope was found.

## 13. Final Decision

`.gitignore` hardening is complete and verified: all four requested exclusions are active, the one pre-existing tracked artifact is documented rather than silently altered, secret protections are unweakened, and none of the 231 RC1-candidate files were affected.

```txt
GO POUR LOT 6.3 — RC1 CHECKPOINT EXECUTION
```
