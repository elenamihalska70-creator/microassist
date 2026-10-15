import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { normalizeDateValue, pickProfileField, normalizeProfileConflictValue } from "../src/application/profile/profileNormalization.js";

const SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const KEY = "microassist_v1";
const ANSWERS = { entry_status: "micro_yes", activity_type: "services", declaration_frequency: "mensuel", acre: "no", business_start_date: "2026-01-01" };
const RAW = JSON.stringify({ version: 1, answers: ANSWERS, messages: [{ role: "bot", text: "Synthetic draft" }], savedAt: "2026-01-01T00:00:00.000Z" });

function callback(name) {
  const marker = `const ${name} = useCallback(`;
  const start = SOURCE.indexOf(marker) + marker.length;
  const end = SOURCE.indexOf("\n  }, [", start);
  assert.ok(start >= marker.length && end > start);
  return SOURCE.slice(start, end) + "\n  }";
}

function effect(marker) {
  const index = SOURCE.indexOf(marker);
  const start = SOURCE.lastIndexOf("useEffect(() => {", index) + "useEffect(() => {".length;
  const end = SOURCE.indexOf("\n  }, [", index);
  assert.ok(index >= 0 && end > start);
  return `() => {${SOURCE.slice(start, end)}\n}`;
}

function appFunction(name) {
  const start = SOURCE.indexOf(`function ${name}(`);
  assert.ok(start >= 0);
  return SOURCE.slice(start, SOURCE.indexOf("\n}\n", start) + 2);
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function harness({ revenues = "fail", invoices = "fail", reminders = "fail", strategy, initialMemory, remote = null } = {}) {
  const memory = new Map(initialMemory ?? [[KEY, RAW], ["revenues_guest", '[{"amount":100,"date":"2026-01-01"}]'],
    ["guest_invoices", '[{"invoice_number":"SYNTHETIC-1","amount":100}]'], ["microassist_reminder_prefs", '{"email":true}']]);
  if (strategy) memory.set("microassist_profile_conflict_strategy", strategy);
  const operations = [], writes = [], attempts = [], indicators = [], timers = [];
  let remoteValue = remote;
  const storage = {
    getItem(key) { operations.push(["get", key]); return memory.get(key) ?? null; },
    removeItem(key) { operations.push(["remove", key]); memory.delete(key); },
    setItem(key, value) { operations.push(["set", key]); memory.set(key, value); },
  };
  const context = vm.createContext({
    localStorage: storage, LS_KEY: KEY, LS_VERSION: 1, GUEST_REVENUES_KEY: "revenues_guest", GUEST_INVOICES_KEY: "guest_invoices", REMINDER_PREFS_KEY: "microassist_reminder_prefs",
    user: { id: "synthetic-user" }, userProfile: {}, console: { log() {}, warn() {}, error() {} }, Date,
    normalizeDateValue, pickProfileField, normalizeProfileConflictValue,
    sanitizeFiscalAnswers: value => ({ ...value }),
    readLocalDraftAnswers: () => memory.has(KEY) ? JSON.parse(memory.get(KEY)).answers : null,
    readProfileConflictStrategy: () => memory.get("microassist_profile_conflict_strategy") || null,
    writeProfileConflictStrategy: value => memory.set("microassist_profile_conflict_strategy", value),
    fiscalProfileFetchRef: { current: { userId: "synthetic-user", status: "found", lastFetchedAt: 0 } },
    guestMigrationRef: { current: { userId: null, inFlight: null, completedForUserId: null } },
    profileDraftSessionRef: { current: { userId: "synthetic-user", revision: 1, dirty: false } },
    profileConflictOwnerRef: { current: null },
    setFiscalProfile: value => { context.fiscalProfile = value; },
    setFiscalProfileLoad: value => { context.fiscalProfileLoaded = ["found", "absent"].includes(value.status); },
    setProfileConflictState: value => { context.conflict = value; },
    setProfileSyncBlocked: value => { context.profileSyncBlocked = value; },
    setHasDraft: value => indicators.push(["hasDraft", value]), setLastSavedAt: value => indicators.push(["savedAt", value]), setRestoredAt: value => indicators.push(["restoredAt", value]),
    setGuestInvoices() {}, refreshRevenues: async () => {}, refreshInvoices: async () => {}, showSaveNotice() {},
    isInvoiceCompliant: () => true, clearLocalStorageKeys: keys => keys.forEach(key => storage.removeItem(key)),
    answers: { ...ANSWERS }, sanitizedAnswers: { ...ANSWERS }, hydrated: true, messages: [{ role: "bot", text: "Synthetic draft" }],
    stepIndex: 0, userName: "", appView: "landing", hasBlockingFiscalDateError: false, profileSyncBlocked: false,
    fiscalProfileSaveSourceRef: { current: "auto_sync" }, dispatchProfileSave() {},
    writeLocalDraftPayload: payload => storage.setItem(KEY, JSON.stringify(payload)),
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
    setNavigationLocation() {}, resolveNavigationLocation: () => ({}), setFocusMode() {}, setHydrated() {},
    setAnswers: value => { context.answers = value; context.sanitizedAnswers = value; }, setMessages: value => { context.messages = value; }, setUserName() {}, setStepIndex() {},
    supabase: { from(table) { return {
      select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: remoteValue, error: null }),
      insert: async payload => { writes.push(table); return { error: (table === "revenues" ? revenues : invoices) === "ok" ? null : new Error("mock insert failed"), data: payload }; },
      update: () => ({ eq: async () => { writes.push("preferences"); return { error: reminders === "ok" ? null : new Error("mock preference failure") }; } }),
    }; } },
  });
  for (const name of ["normalizeActivityType", "isFacturXDraftInvoice", "buildProfileConflictSnapshot", "hasFiscalProfileConflict", "buildFiscalProfilePayload", "isSameFiscalProfilePayload"]) vm.runInContext(appFunction(name), context);
  vm.runInContext(`globalThis.refreshFiscalProfile = ${callback("refreshFiscalProfile")};`, context);
  context.saveReminderPrefsToSupabase = async prefs => {
    const result = await context.supabase.from("fiscal_profiles").update(prefs).eq("user_id", context.user.id);
    return !result.error;
  };
  const migration = callback("migrateLocalDataToSupabase");
  vm.runInContext(`globalThis.migrate = ${migration}; globalThis.persist = ${effect("const payload = {\n        version: LS_VERSION,")}; globalThis.autosync = ${effect("const canSaveFiscalProfile =")}; globalThis.hydrate = ${effect("const raw = localStorage.getItem(LS_KEY);\n\n      //")};`, context);
  return { context, memory, operations, writes, attempts, indicators, timers, setRemote: value => { remoteValue = value; }, remote: () => remoteValue };
}

function actualHarness({ fiscalResult = "ok", gate, reminderGate, ...options } = {}) {
  const h = harness(options);
  const requests = [], feedback = [];
  const originalFrom = h.context.supabase.from;
  h.context.supabase.from = table => {
    const service = originalFrom(table);
    service.upsert = payload => {
      if (table === "reminders") return reminderGate ? reminderGate.promise : Promise.resolve({ error: null });
      requests.push(payload);
      return { select: () => ({ single: async () => {
        if (gate) await gate.promise;
        if (fiscalResult === "fail") return { error: new Error("mock fiscal error"), data: null };
        if (fiscalResult === "ambiguous") return { error: null, data: null };
        const data = fiscalResult === "mismatch" ? { ...payload, activity_type: "commerce" } : { ...payload };
        h.setRemote(data);
        return { error: null, data };
      } }) };
    };
    return service;
  };
  h.context.MIN_REALISTIC_FISCAL_DATE = "2000-01-01";
  for (const name of ["parseIsoDate", "getTodayIsoDate", "getFiscalDateErrors", "sanitizeFiscalAnswers"]) vm.runInContext(appFunction(name), h.context);
  const answers = h.context.sanitizeFiscalAnswers(ANSWERS);
  h.context.answers = answers;
  h.context.sanitizedAnswers = answers;
  h.context.profileDraftAnswersRef = { current: answers };
  h.context.profileDraftSessionRef.current.answers = answers;
  h.context.fiscalProfile = null;
  h.context.fiscalProfileLoaded = true;
  h.context.calculateNextReminder = () => reminderGate ? "2026-12-31" : null;
  h.context.dispatchProfileSave = action => feedback.push({ ...action });
  vm.runInContext(`globalThis.saveFiscalProfileToSupabase = ${callback("saveFiscalProfileToSupabase")}; globalThis.mark = ${callback("markProfileDraftEdited")};`, h.context);
  return { ...h, requests, feedback };
}

test("characterization: actual fiscal callback returns confirmed data and uses its internally advanced revision", async () => {
  const h = actualHarness();
  const result = await h.context.saveFiscalProfileToSupabase(ANSWERS);
  assert.equal(result.ok, true);
  assert.equal(result.skipped, false);
  assert.equal(h.requests.length, 1);
  assert.equal(h.context.profileDraftSessionRef.current.revision, 2);
  assert.equal(h.feedback.at(-1).type, "remote_saved");
});

test("characterization: actual callback preserves duplicate_ignored public semantics without a write", async () => {
  const h = actualHarness();
  await h.context.saveFiscalProfileToSupabase(ANSWERS);
  const result = await h.context.saveFiscalProfileToSupabase(ANSWERS);
  assert.equal(result.ok, true);
  assert.equal(result.skipped, true);
  assert.equal(result.reason, "duplicate_ignored");
  assert.equal(h.requests.length, 1);
});

test("actual failed fiscal callback retains exact draft when revenues succeed", async () => {
  const h = actualHarness({ fiscalResult: "fail", revenues: "ok" });
  await h.context.migrate({ silent: true });
  assert.equal(h.feedback.at(-1).type, "remote_failed");
  assert.equal(h.memory.get(KEY), RAW);
  assert.deepEqual(h.indicators, []);
});

test("confirmed fiscal save removes its exact snapshot and records the actual revision", async () => {
  const h = actualHarness({ fiscalResult: "ok" });
  assert.equal(await h.context.migrate({ silent: true }), true);
  assert.equal(h.memory.has(KEY), false);
  assert.equal(h.requests.length, 1);
  assert.equal(h.context.profileDraftSessionRef.current.cleanedFiscalDraft.revision, 2);
  assert.deepEqual(h.indicators, [["hasDraft", false], ["savedAt", null], ["restoredAt", null]]);
  assert.equal(h.memory.has("revenues_guest"), false, "remaining legacy non-fiscal cleanup risk is unchanged");
});

for (const category of ["revenues", "invoices", "reminders"]) {
  for (const fiscalResult of ["fail", "ambiguous", "mismatch"]) {
    test(`${category} success cannot authorize fiscal cleanup after ${fiscalResult}`, async () => {
      const h = actualHarness({ fiscalResult, [category]: "ok" });
      await h.context.migrate({ silent: true });
      assert.equal(h.memory.get(KEY), RAW);
      assert.deepEqual(h.indicators, []);
    });
  }
}

test("duplicate_ignored is neither a new migration success nor cleanup authority", async () => {
  const h = actualHarness();
  await h.context.saveFiscalProfileToSupabase(ANSWERS);
  const requests = h.requests.length;
  assert.equal(await h.context.migrate({ silent: true }), false);
  assert.equal(h.requests.length, requests);
  assert.equal(h.memory.get(KEY), RAW);
  assert.equal(h.memory.has("revenues_guest"), true);
  assert.deepEqual(h.indicators, []);
});

test("duplicate_ignored with another success retains the fiscal snapshot and indicators", async () => {
  const h = actualHarness({ revenues: "ok" });
  await h.context.saveFiscalProfileToSupabase(ANSWERS);
  await h.context.migrate({ silent: true });
  assert.equal(h.requests.length, 1);
  assert.equal(h.memory.get(KEY), RAW);
  assert.deepEqual(h.indicators, []);
});

test("skipped and conflict-blocked fiscal saves preserve exact draft", async () => {
  for (const strategy of ["keep_local", "detected", "use_remote"]) {
    const h = actualHarness({ strategy, revenues: "ok" });
    assert.equal(await h.context.migrate(), false);
    assert.equal(h.memory.get(KEY), RAW);
    assert.equal(h.requests.length, 0);
  }
  const h = actualHarness({ revenues: "ok" });
  h.context.fiscalProfileLoaded = false;
  const originalRefresh = h.context.refreshFiscalProfile;
  h.context.refreshFiscalProfile = async options => {
    const result = await originalRefresh(options);
    h.context.fiscalProfileLoaded = false;
    return result;
  };
  await h.context.migrate({ silent: true });
  assert.equal(h.memory.get(KEY), RAW);
  assert.equal(h.requests.length, 0);
});

test("draft mutation during fiscal request invalidates acknowledgement and preserves new source", async () => {
  const gate = deferred();
  const h = actualHarness({ gate, revenues: "ok" });
  const pending = h.context.migrate({ silent: true });
  await new Promise(resolve => setTimeout(resolve, 0));
  const next = { ...ANSWERS, activity_type: "commerce" };
  h.context.mark(next);
  h.context.answers = next;
  h.context.profileDraftAnswersRef.current = next;
  const raw = JSON.stringify({ version: 1, answers: next });
  h.memory.set(KEY, raw);
  gate.resolve();
  await pending;
  assert.equal(h.memory.get(KEY), raw);
  assert.deepEqual(h.indicators, []);
});

for (const mutation of ["source", "answers", "revision", "migration", "account", "same-account-generation", "logout", "conflict", "load"]) {
  test(`${mutation} change after acknowledgement but before cleanup prevents stale removal`, async () => {
    const reminderGate = deferred();
    const h = actualHarness({ reminderGate, revenues: "ok" });
    const pending = h.context.migrate({ silent: true });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(h.feedback.at(-1).type, "remote_saved");
    const expected = mutation === "source" ? RAW + " " : RAW;
    if (mutation === "source") h.memory.set(KEY, expected);
    if (mutation === "answers") h.context.profileDraftAnswersRef.current = { ...h.context.answers, extra: "new edit" };
    if (mutation === "revision") h.context.mark({ ...ANSWERS, activity_type: "commerce" });
    if (mutation === "migration") h.context.guestMigrationRef.current = { userId: "synthetic-user" };
    if (mutation === "account" || mutation === "logout") {
      h.context.profileDraftSessionRef.current = { userId: mutation === "account" ? "other-user" : null, revision: 0, dirty: false };
    }
    if (mutation === "same-account-generation") h.context.profileDraftSessionRef.current = { userId: "synthetic-user", revision: 2, dirty: false };
    if (mutation === "conflict") h.context.fiscalProfileFetchRef.current.conflictPending = true;
    if (mutation === "load") h.context.fiscalProfileFetchRef.current = { userId: "synthetic-user", status: "found" };
    reminderGate.resolve({ error: null });
    await pending;
    assert.equal(h.memory.get(KEY), expected);
    assert.deepEqual(h.indicators, []);
  });
}

test("storage re-read and remove failures retain draft without claiming successful cleanup", async () => {
  for (const method of ["getItem", "removeItem"]) {
    const reminderGate = deferred();
    const h = actualHarness({ reminderGate });
    const pending = h.context.migrate({ silent: true });
    await new Promise(resolve => setTimeout(resolve, 0));
    const original = h.context.localStorage[method];
    h.context.localStorage[method] = key => {
      if (key === KEY) throw new Error("mock storage denied");
      return original(key);
    };
    reminderGate.resolve({ error: null });
    await pending;
    assert.equal(h.memory.get(KEY), RAW);
    assert.deepEqual(h.indicators, []);
    assert.equal(h.context.profileDraftSessionRef.current.cleanedFiscalDraft, undefined);
  }
});

test("cleaned snapshot is not recreated; a genuinely new edit persists normally", async () => {
  const h = actualHarness();
  await h.context.migrate({ silent: true });
  h.context.persist();
  assert.equal(h.memory.has(KEY), false);
  const next = { ...h.context.answers, activity_type: "commerce" };
  h.context.mark(next);
  h.context.answers = next;
  h.context.profileDraftAnswersRef.current = next;
  h.context.persist();
  assert.equal(JSON.parse(h.memory.get(KEY)).answers.activity_type, "commerce");
});

test("reload after confirmed cleanup does not restore a stale snapshot or detect a false conflict", async () => {
  const h = actualHarness();
  await h.context.migrate({ silent: true });
  h.context.persist();
  const reloaded = actualHarness({ initialMemory: [...h.memory], remote: { ...h.remote(), activity_type: "commerce" } });
  reloaded.context.hydrate();
  await reloaded.context.refreshFiscalProfile({ force: true });
  assert.equal(reloaded.context.conflict?.open ?? false, false);
  assert.equal(reloaded.memory.has(KEY), false);
});

test("exception after fiscal acknowledgement does not turn an unsuccessful service result into cleanup authority", async () => {
  const reminderGate = deferred();
  const h = actualHarness({ reminderGate, revenues: "ok" });
  const pending = h.context.migrate({ silent: true });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(h.feedback.at(-1).type, "remote_saved");
  reminderGate.reject(new Error("mock reminder transport failure"));
  await pending;
  assert.equal(h.memory.get(KEY), RAW);
  assert.deepEqual(h.indicators, []);
});

test("persistence after cleanup cannot cause an additional fiscal write; failed payload does not automatically retry", async () => {
  const h = actualHarness();
  await h.context.migrate({ silent: true });
  h.context.persist();
  h.context.autosync();
  assert.equal(h.timers.length, 1);
  h.timers[0]();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(h.requests.length, 1);
  assert.equal(h.memory.has(KEY), false);
  const failed = actualHarness({ fiscalResult: "fail", revenues: "ok" });
  await failed.context.migrate({ silent: true });
  failed.context.autosync();
  assert.equal(failed.timers.length, 0);
});
