import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const PROFILE = { activity_type: "services", declaration_frequency: "mensuel", acre: "no", business_start_date: "2026-01-01" };

// Execute the production callbacks with controlled I/O, rather than a duplicate state machine.
function callback(name) {
  const start = SOURCE.indexOf(`const ${name} = useCallback(`) + `const ${name} = useCallback(`.length;
  const end = SOURCE.indexOf("\n  }, [", start);
  assert.ok(start > 0 && end > start, `callback ${name} exists`);
  return SOURCE.slice(start, end) + "\n  }";
}

function effect(marker) {
  const markerIndex = SOURCE.indexOf(marker);
  const start = SOURCE.lastIndexOf("useEffect(() => {", markerIndex) + "useEffect(() => {".length;
  const end = SOURCE.indexOf("\n  }, [", markerIndex);
  assert.ok(markerIndex >= 0 && end > start);
  return `() => {${SOURCE.slice(start, end)}\n}`;
}

function harness({ draft = null, guest = false, strategy = null } = {}) {
  let resolveRead;
  const reads = [];
  const writes = [];
  const timers = [];
  let savedStrategy = strategy;
  const state = { profile: null, load: { status: "loading", userId: null }, conflict: { open: false }, onboarding: false, answers: draft, blocked: false };
  const context = vm.createContext({
    user: guest ? null : { id: "returning-user" },
    fiscalProfileFetchRef: { current: { inFlight: null, userId: null, lastFetchedAt: 0, lastData: null } },
    console: { error() {} },
    Date,
    normalizeActivityType: (value) => value,
    sanitizeFiscalAnswers: (value) => value,
    readLocalDraftAnswers: () => draft,
    readProfileConflictStrategy: () => savedStrategy,
    writeProfileConflictStrategy: (value) => { savedStrategy = value; },
    setFiscalProfile: (value) => { state.profile = value; context.fiscalProfile = value; },
    setFiscalProfileLoad: (value) => { state.load = value; context.fiscalProfileLoaded = value.status === "found" || value.status === "absent"; },
    setProfileConflictState: (value) => { state.conflict = value; },
    setProfileSyncBlocked: (value) => { state.blocked = value; context.profileSyncBlocked = value; },
    setShowSimpleOnboarding: (value) => { state.onboarding = value; },
    setAnswers: (value) => { state.answers = typeof value === "function" ? value(state.answers) : value; },
    fiscalProfileLoaded: false,
    fiscalProfile: null,
    hydrated: true,
    authLoading: false,
    appView: "landing",
    hasProfileCore: Boolean(draft?.activity_type && draft?.declaration_frequency),
    simpleAssistantProfile: null,
    profileSyncBlocked: false,
    sanitizedAnswers: { entry_status: "micro_yes", ...PROFILE },
    hasBlockingFiscalDateError: false,
    fiscalProfileSaveSourceRef: { current: "auto_sync" },
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    clearTimeout() {},
    buildFiscalProfilePayload: (userId, answers) => ({ user_id: userId, ...answers }),
    isSameFiscalProfilePayload: () => false,
    debugLog() {},
    showSaveNotice() {},
    calculateNextReminder: () => null,
    supabase: {
      from(table) {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle() {
            reads.push(table);
            return new Promise((resolve) => { resolveRead = resolve; });
          },
          upsert(payload) {
            writes.push({ table, payload });
            return { select: () => ({ single: async () => ({ data: payload, error: null }) }) };
          },
        };
      },
    },
  });
  const helpers = SOURCE.slice(SOURCE.indexOf("function pickProfileField("), SOURCE.indexOf("function haveStructuredFiscalFieldsChanged("));
  const dateHelperStart = SOURCE.indexOf("function normalizeDateValue(");
  const dateHelperEnd = SOURCE.indexOf("\n}\n", dateHelperStart) + 2;
  vm.runInContext(SOURCE.slice(dateHelperStart, dateHelperEnd), context);
  vm.runInContext(helpers, context);
  vm.runInContext(`globalThis.refresh = ${callback("refreshFiscalProfile")}; globalThis.saveFiscalProfileToSupabase = ${callback("saveFiscalProfileToSupabase")};`, context);
  vm.runInContext(`globalThis.onboard = ${effect('if (appView === "dashboard") {\n      setShowSimpleOnboarding(false);')}; globalThis.autosync = ${effect("const canSaveFiscalProfile =")};`, context);
  return { context, state, reads, writes, timers, resolve: (result) => resolveRead(result) };
}

test("returning user without a draft waits for delayed remote profile, then stays out of onboarding", async () => {
  const h = harness();
  const pending = h.context.refresh();
  h.context.onboard();
  h.context.autosync();
  assert.equal(h.state.load.status, "loading");
  assert.equal(h.state.onboarding, false);
  assert.equal(h.timers.length, 0);
  assert.equal(h.writes.length, 0);
  h.resolve({ data: PROFILE, error: null });
  await pending;
  h.context.onboard();
  assert.equal(h.state.load.status, "found");
  assert.equal(h.state.profile.activity_type, PROFILE.activity_type);
  assert.equal(h.state.onboarding, false);
  assert.equal(h.state.answers, null);
});

test("only successful confirmed absence permits onboarding and a profile save", async () => {
  const h = harness();
  const pending = h.context.refresh();
  assert.equal((await h.context.saveFiscalProfileToSupabase(PROFILE)).reason, "profile_not_loaded");
  h.resolve({ data: null, error: null });
  await pending;
  h.context.onboard();
  assert.equal(h.state.load.status, "absent");
  assert.equal(h.state.onboarding, true);
  assert.equal((await h.context.saveFiscalProfileToSupabase(PROFILE)).ok, true);
  assert.equal(h.writes.length, 1);
});

test("confirmed absence preserves an incomplete existing local draft", async () => {
  const draft = { activity_type: "vente" };
  const h = harness({ draft });
  h.context.simpleAssistantProfile = { activity_type: "services", declaration_frequency: "mensuel" };
  const pending = h.context.refresh();
  h.resolve({ data: null, error: null });
  await pending;
  h.context.onboard();
  assert.equal(h.state.onboarding, false);
  assert.deepEqual(h.state.answers, draft);
});

test("empty normalized date fields are not mistaken for an existing profile draft", async () => {
  const h = harness({ draft: { business_start_date: null, acre_start_date: null } });
  const pending = h.context.refresh();
  h.resolve({ data: null, error: null });
  await pending;
  h.context.onboard();
  assert.equal(h.state.onboarding, true);
});

test("failed read preserves the draft, blocks all profile writes, and can retry successfully", async () => {
  const draft = { ...PROFILE };
  const h = harness({ draft });
  const pending = h.context.refresh();
  h.resolve({ data: null, error: { message: "network unavailable" } });
  await pending;
  h.context.onboard();
  h.context.autosync();
  assert.equal(h.state.load.status, "failed");
  assert.equal(h.state.onboarding, false);
  assert.equal(h.timers.length, 0);
  assert.equal((await h.context.saveFiscalProfileToSupabase(draft)).reason, "profile_not_loaded");
  assert.equal(h.writes.length, 0);
  assert.deepEqual(h.state.answers, draft);
  const retry = h.context.refresh({ force: true });
  assert.equal(h.state.load.status, "loading");
  h.resolve({ data: PROFILE, error: null });
  await retry;
  assert.equal(h.state.load.status, "found");
  assert.equal(h.reads.length, 2);
});

test("genuine local/remote conflict remains protected on returning-user startup", async () => {
  const draft = { ...PROFILE, activity_type: "vente" };
  const h = harness({ draft });
  const pending = h.context.refresh();
  h.resolve({ data: PROFILE, error: null });
  await pending;
  h.context.autosync();
  assert.equal(h.state.conflict.open, true);
  assert.equal(h.state.blocked, true);
  assert.deepEqual(h.state.conflict.localAnswers, draft);
  assert.equal(h.state.conflict.remoteProfile.activity_type, PROFILE.activity_type);
  assert.equal(h.timers.length, 0);
  assert.equal((await h.context.saveFiscalProfileToSupabase(draft)).reason, "profile_conflict");
  assert.equal(h.writes.length, 0);
});

test("guest onboarding still works without any remote read or profile write", () => {
  const h = harness({ guest: true });
  h.context.onboard();
  h.context.autosync();
  assert.equal(h.state.onboarding, true);
  assert.equal(h.reads.length, 0);
  assert.equal(h.timers.length, 0);
});

test("an already scheduled autosync cannot write during a subsequent read or after its failure", async () => {
  const h = harness();
  let pending = h.context.refresh();
  h.resolve({ data: null, error: null });
  await pending;
  h.context.autosync();
  assert.equal(h.timers.length, 1);
  pending = h.context.refresh({ force: true });
  // Simulate an old React callback retaining loaded=true while the ref changes synchronously.
  h.context.fiscalProfileLoaded = true;
  h.timers[0]();
  assert.equal(h.writes.length, 0);
  h.resolve({ data: null, error: { message: "read failed" } });
  await pending;
  h.context.fiscalProfileLoaded = true;
  h.timers[0]();
  assert.equal(h.writes.length, 0);
});

test("a stale response after an account change cannot complete hydration or enable writes", async () => {
  const h = harness();
  const pending = h.context.refresh();
  h.context.fiscalProfileFetchRef.current = { userId: "another-user", status: "loading", inFlight: null };
  h.resolve({ data: PROFILE, error: null });
  await pending;
  assert.equal(h.state.load.status, "loading");
  assert.equal(h.state.profile, null);
  h.context.fiscalProfileLoaded = true;
  assert.equal((await h.context.saveFiscalProfileToSupabase(PROFILE)).reason, "profile_not_loaded");
  assert.equal(h.writes.length, 0);
});

test("a synchronous read exception also leaves retry available", async () => {
  const h = harness();
  const originalFrom = h.context.supabase.from;
  h.context.supabase.from = () => { throw new Error("client unavailable"); };
  await h.context.refresh();
  assert.equal(h.state.load.status, "failed");
  assert.equal(h.context.fiscalProfileFetchRef.current.inFlight, null);
  h.context.supabase.from = originalFrom;
  const retry = h.context.refresh({ force: true });
  h.resolve({ data: PROFILE, error: null });
  await retry;
  assert.equal(h.state.load.status, "found");
});

test("a later read failure preserves the last successful remote profile and disables writes", async () => {
  const h = harness();
  let pending = h.context.refresh();
  h.resolve({ data: PROFILE, error: null });
  await pending;
  pending = h.context.refresh({ force: true });
  h.resolve({ data: null, error: { message: "network failed" } });
  await pending;
  assert.equal(h.state.profile.activity_type, PROFILE.activity_type);
  assert.equal(h.state.load.status, "failed");
  assert.equal((await h.context.saveFiscalProfileToSupabase(PROFILE)).reason, "profile_not_loaded");
  assert.equal(h.writes.length, 0);
});

test("guest migration exits before all data writes and draft cleanup when the profile read fails", async () => {
  const h = harness({ draft: PROFILE });
  h.context.guestMigrationRef = { current: { inFlight: null, userId: null } };
  h.context.refreshFiscalProfile = h.context.refresh;
  vm.runInContext(`globalThis.migrate = ${callback("migrateLocalDataToSupabase")};`, h.context);
  const pending = h.context.migrate({ silent: true });
  h.resolve({ data: null, error: { message: "read failed" } });
  assert.equal(await pending, false);
  assert.equal(h.writes.length, 0);
  assert.deepEqual(h.state.answers, PROFILE);
});
