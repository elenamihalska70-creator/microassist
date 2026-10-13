import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { resolveNavigationLocation } from "../src/navigation/navigationLocation.js";
import {
  INITIAL_PROFILE_SAVE_STATE,
  canUseRemoteProfileForEntry,
  profileSaveReducer,
  profileSaveMessage,
} from "../src/application/profile/profileDraftState.js";

const SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const REMOTE = { entry_status: "micro_yes", activity_type: "services", declaration_frequency: "mensuel", acre: "no", business_start_date: "2026-01-01" };
const DRAFT = { ...REMOTE, activity_type: "commerce" };

function callback(name) {
  const marker = `const ${name} = useCallback(`;
  const markerIndex = SOURCE.indexOf(marker);
  const start = markerIndex + marker.length;
  const end = SOURCE.indexOf("\n  }, [", start);
  assert.ok(markerIndex >= 0 && end > start);
  return SOURCE.slice(start, end) + "\n  }";
}

function harness({ strategy = null, guest = false, loadStatus = "found" } = {}) {
  const writes = [];
  const notices = [];
  const requests = [];
  const timers = [];
  let state = { ...INITIAL_PROFILE_SAVE_STATE, userId: guest ? null : "user-a" };
  const context = vm.createContext({
    user: guest ? null : { id: "user-a" },
    answers: { ...DRAFT },
    fiscalProfile: { user_id: "user-a", ...REMOTE },
    fiscalProfileLoaded: ["found", "absent"].includes(loadStatus),
    fiscalProfileLoadStatus: loadStatus,
    profileDraftSessionRef: { current: { userId: guest ? null : "user-a", revision: 0, dirty: false } },
    fiscalProfileFetchRef: { current: { userId: "user-a", status: loadStatus } },
    fiscalProfileSaveSourceRef: { current: "auto_sync" },
    readProfileConflictStrategy: () => strategy,
    readLocalDraftAnswers: () => context.answers,
    dispatchProfileSave: (action) => { state = profileSaveReducer(state, action); },
    sanitizeFiscalAnswers: (value) => ({ ...value }),
    buildFiscalProfilePayload: (userId, answers) => ({ user_id: userId, ...answers }),
    isSameFiscalProfilePayload: (payload, snapshot) => Boolean(snapshot) &&
      Object.entries(payload).every(([key, value]) => snapshot[key] === value),
    getAssistantAnswersFromProfile: (profile) => ({ ...profile }),
    canUseRemoteProfileForEntry,
    setAnswers: (value) => { context.answers = value; },
    setFiscalProfile: (value) => { context.fiscalProfile = value; },
    setFiscalProfileLoad: (value) => { context.fiscalProfileLoadStatus = value.status; },
    showSaveNotice: (value) => notices.push(value),
    calculateNextReminder: () => "2026-12-31",
    console: { error() {} },
    trackBetaEvent() {},
    setNavigationLocation() {},
    resolveNavigationLocation,
    setAssistantEditMode() {},
    setAssistantCollapsed() {},
    setProfileEditMode() {},
    setSelectedProfileField() {},
    setProfileEditDraft() {},
    setStepIndex() {},
    setHelpOpen() {},
    setInput() {},
    setAssistantFieldError() {},
    setMessages() {},
    goToView() {},
    assistantRef: { current: null },
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    clearTimeout() {},
    requestAnimationFrame: (fn) => fn(),
    sanitizedAnswers: DRAFT,
    hasBlockingFiscalDateError: false,
    profileSyncBlocked: strategy === "keep_local",
    supabase: {
      from(table) {
        return {
          upsert(payload) {
            writes.push({ table, payload });
            if (table === "reminders") return Promise.resolve({ error: null });
            return {
              select: () => ({ single: () => new Promise((resolve, reject) => requests.push({ resolve, reject, payload })) }),
            };
          },
        };
      },
    },
  });
  vm.runInContext(`globalThis.save = ${callback("saveFiscalProfileToSupabase")}; globalThis.enter = ${callback("goToAssistant")}; globalThis.mark = ${callback("markProfileDraftEdited")};`, context);
  const editStart = SOURCE.indexOf("  function handleEditProfile() {");
  const editEnd = SOURCE.indexOf("\n  function handleOpenTvaConfiguration", editStart);
  vm.runInContext(SOURCE.slice(editStart, editEnd) + "\nglobalThis.edit = handleEditProfile;", context);
  const syncMarker = SOURCE.indexOf("const canSaveFiscalProfile =");
  const syncStart = SOURCE.lastIndexOf("useEffect(() => {", syncMarker) + "useEffect(() => {".length;
  const syncEnd = SOURCE.indexOf("\n  }, [", syncMarker);
  vm.runInContext(`globalThis.autosync = () => {${SOURCE.slice(syncStart, syncEnd)}\n};`, context);
  return { context, writes, notices, requests, timers, state: () => state };
}

test("keep_local survives Assistant and profile editing until the user actually edits", () => {
  const h = harness({ strategy: "keep_local" });
  h.context.enter();
  h.context.edit();
  assert.deepEqual(h.context.answers, DRAFT);
  assert.equal(h.writes.length, 0);
  h.context.mark({ ...DRAFT, declaration_frequency: "trimestriel" });
  assert.deepEqual(h.context.answers, DRAFT, "marking an edit never replaces the editable answers");
  assert.equal(h.state().status, "edited");
  h.context.autosync();
  assert.equal(h.writes.length, 0);
});

test("resolved remote profile with no selected/dirty draft retains normal entry behaviour", () => {
  const h = harness();
  h.context.enter();
  assert.equal(h.context.answers.activity_type, REMOTE.activity_type);
  h.context.answers = DRAFT;
  h.context.edit();
  assert.equal(h.context.answers.activity_type, REMOTE.activity_type);
});

test("unsaved edits are retained on entry even without a conflict strategy", () => {
  const h = harness();
  h.context.mark(DRAFT);
  h.context.enter();
  h.context.edit();
  assert.deepEqual(h.context.answers, DRAFT);
});

test("loading and failed reads allow neither autosync nor manual retry writes", async () => {
  for (const loadStatus of ["loading", "failed"]) {
    const h = harness({ loadStatus });
    h.context.mark(DRAFT);
    h.context.enter();
    h.context.edit();
    h.context.autosync();
    assert.deepEqual(h.context.answers, DRAFT);
    assert.equal(h.writes.length, 0);
    assert.equal((await h.context.save(DRAFT)).reason, "profile_not_loaded");
    assert.equal(h.writes.length, 0);
  }
});

test("a scheduled callback cannot write after an account switch or newer draft revision", () => {
  for (const switchAccount of [true, false]) {
    const h = harness();
    h.context.mark(DRAFT);
    h.context.autosync();
    assert.equal(h.timers.length, 1);
    if (switchAccount) h.context.profileDraftSessionRef.current = { userId: "user-b", revision: 0 };
    else h.context.mark({ ...DRAFT, declaration_frequency: "trimestriel" });
    h.timers[0]();
    assert.equal(h.writes.length, 0);
  }
});

test("account-saved feedback and remote snapshot update require actual acknowledgement", async () => {
  const h = harness();
  h.context.mark(DRAFT);
  h.context.dispatchProfileSave({ type: "local_saved", userId: "user-a", revision: 1 });
  const pending = h.context.save(DRAFT, { showSuccessNotice: true });
  assert.equal(h.state().status, "remote_pending");
  assert.equal(h.notices.length, 0);
  assert.equal(h.context.fiscalProfile.activity_type, REMOTE.activity_type);
  h.requests[0].resolve({ data: { user_id: "user-a", ...DRAFT }, error: null });
  assert.equal((await pending).ok, true);
  assert.equal(h.state().status, "remote_saved");
  assert.equal(h.context.fiscalProfile.activity_type, DRAFT.activity_type);
  assert.equal(h.notices.length, 1);
});

test("remote failure retains the draft and remote snapshot, exposes failure, and supports retry", async () => {
  const h = harness();
  h.context.mark(DRAFT);
  h.context.dispatchProfileSave({ type: "local_saved", userId: "user-a", revision: 1 });
  let pending = h.context.save(DRAFT, { showSuccessNotice: true });
  h.requests[0].reject(new Error("offline"));
  assert.equal((await pending).ok, false);
  assert.equal(h.state().status, "remote_failed");
  assert.equal(h.state().localSaved, true);
  assert.deepEqual(h.context.answers, DRAFT);
  assert.equal(h.context.fiscalProfile.activity_type, REMOTE.activity_type);
  assert.equal(h.notices.length, 0);
  h.context.autosync();
  assert.equal(h.timers.length, 0, "failed saves await retry rather than an automatic retry loop");
  pending = h.context.save(DRAFT, { draftRevision: 1 });
  h.requests[1].resolve({ data: DRAFT, error: null });
  assert.equal((await pending).ok, true);
  assert.equal(h.state().status, "remote_saved");
});

test("an old-account acknowledgement cannot change snapshot, feedback, or write reminders", async () => {
  const h = harness();
  h.context.mark(DRAFT);
  const pending = h.context.save(DRAFT, { showSuccessNotice: true });
  h.context.profileDraftSessionRef.current = { userId: "user-b", revision: 0 };
  h.context.dispatchProfileSave({ type: "session", userId: "user-b" });
  h.context.fiscalProfile = { activity_type: "user-b-snapshot" };
  h.requests[0].resolve({ data: DRAFT, error: null });
  assert.equal((await pending).reason, "stale_save");
  assert.equal(h.context.fiscalProfile.activity_type, "user-b-snapshot");
  assert.equal(h.state().userId, "user-b");
  assert.equal(h.state().status, "idle");
  assert.equal(h.notices.length, 0);
  assert.equal(h.writes.filter(({ table }) => table === "reminders").length, 0);
});

test("a newer draft remains dirty when an older revision is acknowledged", async () => {
  const h = harness();
  h.context.mark(DRAFT);
  const pending = h.context.save(DRAFT);
  h.context.mark({ ...DRAFT, declaration_frequency: "trimestriel" });
  h.requests[0].resolve({ data: DRAFT, error: null });
  assert.equal((await pending).reason, "stale_save");
  assert.equal(h.state().revision, 2);
  assert.equal(h.state().status, "edited");
  assert.equal(h.context.profileDraftSessionRef.current.dirty, true);
});

test("guest editing and explicit local-only strategy never write the account", async () => {
  for (const options of [{ guest: true }, { strategy: "keep_local" }, { strategy: "detected" }]) {
    const h = harness(options);
    h.context.mark(DRAFT);
    h.context.edit();
    h.context.autosync();
    assert.equal((await h.context.save(DRAFT)).ok, false);
    assert.equal(h.writes.length, 0);
  }
});

test("save-state reducer rejects old revisions and accounts; local acknowledgement preserves remote failure", () => {
  let state = profileSaveReducer(INITIAL_PROFILE_SAVE_STATE, { type: "session", userId: "a" });
  state = profileSaveReducer(state, { type: "edited", userId: "a", revision: 2 });
  assert.strictEqual(profileSaveReducer(state, { type: "remote_saved", userId: "a", revision: 1 }), state);
  assert.strictEqual(profileSaveReducer(state, { type: "remote_saved", userId: "b", revision: 2 }), state);
  state = profileSaveReducer(state, { type: "remote_failed", userId: "a", revision: 2 });
  state = profileSaveReducer(state, { type: "local_saved", userId: "a", revision: 2 });
  assert.equal(state.status, "remote_failed");
  assert.match(profileSaveMessage(state, { userId: "a", loadStatus: "found" }), /conservé sur cet appareil/);
});

test("matching account data does not claim a new successful save or leave pending feedback", async () => {
  const h = harness();
  h.context.mark(DRAFT);
  h.context.fiscalProfile = { user_id: "user-a", ...DRAFT };
  assert.equal((await h.context.save(DRAFT)).reason, "duplicate_ignored");
  assert.equal(h.writes.length, 0);
  assert.equal(h.state().status, "remote_unchanged");
  assert.doesNotMatch(profileSaveMessage(h.state(), { userId: "user-a", loadStatus: "found" }), /Profil enregistré/);
});

test("local-only setting feedback does not change the remote draft revision or interrupt a pending save", () => {
  let state = profileSaveReducer(INITIAL_PROFILE_SAVE_STATE, { type: "session", userId: "a" });
  state = profileSaveReducer(state, { type: "edited", userId: "a", revision: 1 });
  state = profileSaveReducer(state, { type: "remote_pending", userId: "a", revision: 1 });
  state = profileSaveReducer(state, { type: "local_setting_saved", userId: "a", revision: 1 });
  assert.equal(state.status, "remote_pending");
  assert.equal(state.revision, 1);
  state = profileSaveReducer(state, { type: "remote_saved", userId: "a", revision: 1 });
  assert.match(profileSaveMessage(state, { userId: "a", loadStatus: "found" }), /TVA reste conservé uniquement/);
});

test("newer saves are serialized behind an in-flight request and only the latest draft is acknowledged", async () => {
  const h = harness();
  h.context.mark(DRAFT);
  const first = h.context.save(DRAFT, { draftRevision: 1 });
  const newer = { ...DRAFT, declaration_frequency: "trimestriel" };
  h.context.mark(newer);
  const second = h.context.save(newer, { draftRevision: 2 });
  assert.equal(h.requests.length, 1);
  h.requests[0].resolve({ data: DRAFT, error: null });
  assert.equal((await first).reason, "stale_save");
  assert.equal(h.requests.length, 2);
  h.requests[1].resolve({ data: newer, error: null });
  assert.equal((await second).ok, true);
  assert.equal(h.state().revision, 2);
  assert.equal(h.state().status, "remote_saved");
});

test("a conflict appearing during a save prevents its acknowledgement and follow-up writes", async () => {
  const h = harness();
  h.context.mark(DRAFT);
  const pending = h.context.save(DRAFT, { showSuccessNotice: true });
  h.context.fiscalProfileFetchRef.current.conflictPending = true;
  h.requests[0].resolve({ data: DRAFT, error: null });
  assert.equal((await pending).reason, "stale_save");
  assert.equal(h.context.fiscalProfile.activity_type, REMOTE.activity_type);
  assert.equal(h.notices.length, 0);
  assert.equal(h.writes.filter(({ table }) => table === "reminders").length, 0);
});
