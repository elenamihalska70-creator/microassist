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
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function harness({ fiscal = "fail", revenues = "fail", invoices = "fail", reminders = "fail", strategy,
  preserveCandidate = false, initialMemory, remote = null, fiscalGate } = {}) {
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
  context.saveFiscalProfileToSupabase = async answers => {
    attempts.push("fiscal");
    if (fiscalGate) await fiscalGate.promise;
    if (fiscal === "fail") return { ok: false, error: new Error("mock fiscal failure") };
    if (fiscal === "skip") return { ok: false, skipped: true, reason: "profile_not_loaded" };
    const payload = context.buildFiscalProfilePayload(context.user.id, answers);
    if (context.isSameFiscalProfilePayload(payload, remoteValue)) return { ok: true, skipped: true, reason: "duplicate_ignored" };
    writes.push("fiscal"); remoteValue = payload;
    return { ok: true, skipped: false, data: payload };
  };
  context.saveReminderPrefsToSupabase = async prefs => {
    const result = await context.supabase.from("fiscal_profiles").update(prefs).eq("user_id", context.user.id);
    return !result.error;
  };
  let migration = callback("migrateLocalDataToSupabase");
  if (preserveCandidate) {
    // In-memory experiment only: no production file is changed.
    migration = migration.replace("          LS_KEY,\n", "")
      .replace("        setHasDraft(false);\n        setLastSavedAt(null);\n        setRestoredAt(null);\n", "");
  }
  vm.runInContext(`globalThis.migrate = ${migration}; globalThis.persist = ${effect("const payload = {\n        version: LS_VERSION,")}; globalThis.autosync = ${effect("const canSaveFiscalProfile =")}; globalThis.hydrate = ${effect("const raw = localStorage.getItem(LS_KEY);\n\n      //")};`, context);
  return { context, memory, operations, writes, attempts, indicators, timers, setRemote: value => { remoteValue = value; }, remote: () => remoteValue };
}

for (const category of ["revenues", "invoices", "reminders"]) {
  test(`characterization: ${category} success deletes the original draft despite failed fiscal save`, async () => {
    const gate = deferred();
    const h = harness({ [category]: "ok", fiscalGate: gate });
    const pending = h.context.migrate({ silent: true });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(h.memory.get(KEY), RAW, "draft exists before fiscal result");
    gate.resolve();
    assert.equal(await pending, true);
    assert.equal(h.memory.has(KEY), false);
    assert.deepEqual(h.indicators.slice(0, 3), [["hasDraft", false], ["savedAt", null], ["restoredAt", null]]);
  });
}

test("characterization: skipped fiscal save is deleted by unrelated success", async () => {
  const h = harness({ fiscal: "skip", revenues: "ok" });
  await h.context.migrate({ silent: true });
  assert.equal(h.memory.has(KEY), false);
});

test("characterization: fiscal success also clears categories whose migration failed", async () => {
  const h = harness({ fiscal: "ok" });
  await h.context.migrate({ silent: true });
  assert.equal(h.memory.has(KEY), false);
  assert.equal(h.memory.has("revenues_guest"), false);
  assert.equal(h.memory.has("guest_invoices"), false);
});

test("all failed or skipped categories preserve the exact draft and indicators", async () => {
  for (const fiscal of ["fail", "skip"]) {
    const h = harness({ fiscal });
    assert.equal(await h.context.migrate({ silent: true }), false);
    assert.equal(h.memory.get(KEY), RAW);
    assert.deepEqual(h.indicators, []);
  }
});

test("keep_local and detected stop all migration writes and cleanup", async () => {
  for (const strategy of ["keep_local", "detected"]) {
    const h = harness({ strategy, fiscal: "ok", revenues: "ok" });
    assert.equal(await h.context.migrate(), false);
    assert.equal(h.memory.get(KEY), RAW);
    assert.deepEqual(h.writes, []);
  }
});

test("authenticated reload after current successful fiscal migration has no saved draft conflict", async () => {
  const h = harness({ fiscal: "ok" });
  await h.context.migrate({ silent: true });
  const reloaded = harness({ initialMemory: [...h.memory], remote: { ...h.remote(), activity_type: "commerce" } });
  reloaded.context.hydrate();
  await reloaded.context.refreshFiscalProfile({ force: true });
  assert.equal(reloaded.context.conflict?.open ?? false, false);
});

test("existing persistence recreates a local draft and autosync remains scheduled after migration", async () => {
  const h = harness({ fiscal: "ok" });
  await h.context.migrate({ silent: true });
  h.context.persist();
  assert.deepEqual(JSON.parse(h.memory.get(KEY)).answers, ANSWERS);
  h.context.autosync();
  assert.equal(h.timers.length, 1);
});

test("unconditional-preservation experiment: a later remote update is re-detected as a draft conflict on reload", async () => {
  const h = harness({ fiscal: "ok", preserveCandidate: true });
  await h.context.migrate({ silent: true });
  assert.equal(h.memory.get(KEY), RAW);
  const reloaded = harness({ initialMemory: [...h.memory], remote: { ...h.remote(), activity_type: "commerce" } });
  reloaded.context.hydrate();
  await reloaded.context.refreshFiscalProfile({ force: true });
  assert.equal(reloaded.context.conflict.open, true);
  assert.equal(reloaded.memory.get("microassist_profile_conflict_strategy"), "detected");
});

test("unconditional-preservation experiment: unchanged saved fiscal draft triggers repeated cleanup of failed revenues", async () => {
  for (const preserveCandidate of [false, true]) {
    const h = harness({ fiscal: "ok", preserveCandidate });
    await h.context.migrate({ silent: true });
    h.memory.set("revenues_guest", '[{"amount":200,"date":"2026-01-02"}]');
    const second = await h.context.migrate({ silent: true });
    assert.equal(second, preserveCandidate);
    assert.equal(h.memory.has("revenues_guest"), !preserveCandidate);
    assert.equal(h.writes.filter(table => table === "fiscal").length, 1, "second fiscal result is duplicate_ignored, not a new write");
  }
});
