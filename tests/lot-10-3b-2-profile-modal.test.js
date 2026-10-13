import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { selectProfileModal, canApplyProfileConflictChoice, authProfileResolutionMessage } from "../src/application/profile/profileModalState.js";
import { profileSaveMessage } from "../src/application/profile/profileDraftState.js";

const SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const BASE = { hydrated: true, userId: "a", loadStatus: "found", completion: true, completionCurrent: true };

test("only resolved authenticated profiles or guests may show their current completion", () => {
  for (const loadStatus of ["found", "absent"]) assert.equal(selectProfileModal({ ...BASE, loadStatus }), "completion");
  for (const loadStatus of ["loading", "failed"]) assert.equal(selectProfileModal({ ...BASE, loadStatus }), null);
  assert.equal(selectProfileModal({ ...BASE, userId: null, loadStatus: "loading" }), "completion");
  assert.equal(selectProfileModal({ ...BASE, authLoading: true }), null);
  assert.equal(selectProfileModal({ ...BASE, hydrated: false }), null);
  assert.equal(selectProfileModal({ ...BASE, completionCurrent: false }), null);
});

test("auth/recovery wins over conflict; conflict wins over all other profile modals", () => {
  const overlapping = { ...BASE, conflictOpen: true, conflictCurrent: true, conflictPending: true, beta: true, structured: true, onboarding: true };
  assert.equal(selectProfileModal(overlapping), "conflict");
  assert.equal(selectProfileModal({ ...overlapping, authOpen: true }), "auth");
  assert.equal(selectProfileModal({ ...overlapping, recovery: true, authLoading: true }), "auth");
  assert.equal(selectProfileModal({ ...overlapping, loadStatus: "failed", beta: false }), null);
});

test("unresolved conflicts cannot reveal completion; keep_local remains eligible without enabling writes", () => {
  assert.equal(selectProfileModal({ ...BASE, strategy: "detected" }), null);
  assert.equal(selectProfileModal({ ...BASE, conflictPending: true }), null);
  assert.equal(selectProfileModal({ ...BASE, strategy: "keep_local" }), "completion");
  assert.equal(selectProfileModal({ ...BASE, userId: null, strategy: "detected" }), "completion");
  assert.equal(selectProfileModal({ ...BASE, onboarding: true, structured: true }), "structured");
  assert.equal(selectProfileModal({ ...BASE, onboarding: true }), "onboarding");
});

test("conflict choice requires the original account generation and resolved remote owner", () => {
  const owner = { userId: "a" };
  const input = { owner, currentSession: owner, userId: "a", remoteUserId: "a", loadUserId: "a", loadStatus: "found" };
  assert.equal(canApplyProfileConflictChoice(input), true);
  for (const patch of [{ currentSession: { userId: "a" } }, { userId: "b" }, { remoteUserId: "b" }, { loadUserId: "b" }, { loadStatus: "loading" }, { loadStatus: "failed" }, { loadStatus: "absent" }, { userId: null }]) {
    assert.equal(canApplyProfileConflictChoice({ ...input, ...patch }), false);
  }
});

test("both real conflict callbacks reject a switched account without applying data or strategy", () => {
  for (const name of ["handleUseRemoteProfile", "handleKeepLocalDraft"]) {
    const start = SOURCE.indexOf(`const ${name} = useCallback(`) + `const ${name} = useCallback(`.length;
    const end = SOURCE.indexOf("\n  }, [", start);
    const owner = { userId: "a" }, applied = [];
    const context = vm.createContext({ canApplyProfileConflictChoice, profileConflictOwner: owner,
      profileDraftSessionRef: { current: { userId: "b" } }, user: { id: "a" },
      profileConflictState: { localAnswers: { business_start_date: "2026-06-10" }, remoteProfile: { user_id: "a" } },
      fiscalProfileFetchRef: { current: { userId: "b", status: "found" } },
      getAssistantAnswersFromProfile: () => { applied.push("remote"); },
      markProfileDraftEdited: () => applied.push("edited"), setAnswers: () => applied.push("answers"),
      writeProfileConflictStrategy: () => applied.push("strategy"),
    });
    vm.runInContext(`const run = ${SOURCE.slice(start, end)}\n}; run();`, context);
    assert.deepEqual(applied, []);
  }
});

test("real wizard save rejects stale callbacks and failed/unresolved reads before local writes", () => {
  const start = SOURCE.indexOf("  function handleSimpleOnboardingSave() {");
  const end = SOURCE.indexOf("\n  function handleProfileMissingAcreChange", start);
  for (const status of ["loading", "failed", "switched", "conflict"]) {
    const owner = { userId: "a" }, writes = [];
    const context = vm.createContext({
      profileModalSession: owner, profileDraftSessionRef: { current: status === "switched" ? { userId: "b" } : owner },
      authLoading: false, user: { id: "a" }, fiscalProfileFetchRef: { current: { userId: "a", status: status === "switched" || status === "conflict" ? "found" : status } },
      profileConflictState: { open: status === "conflict" }, readProfileConflictStrategy: () => null,
      localStorage: { setItem: () => writes.push("local") },
    });
    vm.runInContext(SOURCE.slice(start, end) + "\nhandleSimpleOnboardingSave();", context);
    assert.deepEqual(writes, []);
  }
});

test("login notices report found, absent, failed and chosen local outcomes without a save claim", () => {
  assert.match(authProfileResolutionMessage({ loadStatus: "failed" }), /n’a pas pu être chargé/);
  assert.match(authProfileResolutionMessage({ loadStatus: "absent" }), /Aucun profil/);
  assert.match(authProfileResolutionMessage({ loadStatus: "found" }), /a été chargé/);
  assert.match(authProfileResolutionMessage({ loadStatus: "found", conflictPending: true }), /choix/);
  assert.match(authProfileResolutionMessage({ loadStatus: "found", conflictPending: true, strategy: "keep_local" }), /sans synchronisation/);
  for (const loadStatus of [undefined, "loading", "failed", "absent", "found"]) assert.doesNotMatch(authProfileResolutionMessage({ loadStatus }), /est prêt|sauvegardé/);
});

test("completion feedback can claim account save only from acknowledged save state", () => {
  for (const status of ["edited", "local_saved", "remote_pending", "remote_failed"]) {
    assert.doesNotMatch(profileSaveMessage({ userId: "a", status, localSaved: true }, { userId: "a", loadStatus: "found" }), /Profil enregistré dans ton compte/);
  }
  assert.match(profileSaveMessage({ userId: "a", status: "remote_saved" }, { userId: "a", loadStatus: "found" }), /Profil enregistré dans ton compte/);
});
