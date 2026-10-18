import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import process from "node:process";
import { setImmediate } from "node:timers";
import { normalizeDateValue, pickProfileField, normalizeProfileConflictValue } from "../src/application/profile/profileNormalization.js";

const SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const fixture = readFileSync(new URL("./lot-10-3b-5d-fiscal-cleanup.test.js", import.meta.url), "utf8");
const scope = vm.createContext({ assert, vm, SOURCE, normalizeDateValue, pickProfileField, normalizeProfileConflictValue });
vm.runInContext(fixture.slice(fixture.indexOf("const KEY ="), fixture.indexOf('\ntest("characterization:')) + "\nglobalThis.create=actualHarness;", scope);
const before = process.env.LOT6C2_BEFORE === "1";
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function create(options = {}) {
  const h = scope.create({ fiscalResult: "fail", revenues: "ok", invoices: "ok", ...options });
  const c = h.context;
  c.migrateLocalDataToSupabase = c.migrate;
  h.memory.set("pending", "manual_auth");
  Object.assign(c, { authLoading: false, isRecoveryFlow: false, PENDING_AUTH_SUCCESS_KEY: "pending", BETA_SEEN_KEY: "beta_seen", authFinalizationRef: { current: null },
    setShowBetaNotice() {}, deepLinkViewPendingRef: { current: null }, goToDashboard() {}, cleanAuthCallbackUrl() {},
    authProfileResolutionMessage: () => "synthetic", window: { location: { hash: "", search: "" } }, URLSearchParams });
  const index = SOURCE.indexOf("const pendingAuthSuccess = localStorage.getItem(PENDING_AUTH_SUCCESS_KEY)");
  const start = SOURCE.lastIndexOf("useEffect(() => {", index) + "useEffect(() => {".length;
  vm.runInContext(`globalThis.effect=()=>{${SOURCE.slice(start, SOURCE.indexOf("\n}, [", index))}\n};`, c);
  const cleanupIndex = SOURCE.indexOf("if (authFinalizationRef.current?.session === session) authFinalizationRef.current = null;");
  const cleanupStart = SOURCE.lastIndexOf("useLayoutEffect(() => {", cleanupIndex) + "useLayoutEffect(() => {".length;
  vm.runInContext(`globalThis.layout=()=>{${SOURCE.slice(cleanupStart, SOURCE.indexOf("\n  }, [user?.id]);", cleanupIndex))}\n};`, c);
  h.unmount = c.layout();
  return h;
}
for (const table of ["revenues", "preferences"]) {
  for (const outcome of ["ok", "error", "throw"]) {
    test(`actual layout cleanup during ${table} ${outcome} stops later writes and cleanup`, async () => {
      const h = create();
      const gate = deferred(), entered = deferred();
      const from = h.context.supabase.from;
      const calls = [];
      h.context.supabase.from = name => {
        const service = from(name);
        const insert = service.insert;
        service.insert = async payload => {
          calls.push(name);
          if (name !== table) return insert(payload);
          entered.resolve();
          await gate.promise;
          if (outcome === "throw") throw new Error("synthetic lost response");
          return { error: outcome === "error" ? new Error("synthetic failure") : null };
        };
        return service;
      };
      if (table === "preferences") h.context.saveReminderPrefsToSupabase = async () => {
        calls.push("preferences"); entered.resolve(); await gate.promise;
        if (outcome === "throw") throw new Error("synthetic lost preference response");
        return outcome === "ok";
      };
      const original = [...h.memory];
      h.context.effect();
      await entered.promise;
      const operation = h.context.authFinalizationRef.current;
      const session = h.context.profileDraftSessionRef.current;
      const migration = h.context.guestMigrationRef.current;
      h.unmount();
      assert.equal(h.context.authFinalizationRef.current, null);
      assert.equal(h.context.profileDraftSessionRef.current, session);
      assert.equal(h.context.guestMigrationRef.current, migration);
      gate.resolve();
      await operation.promise;
      if (before) {
        if (table === "revenues") assert.ok(calls.includes("invoices"));
        assert.equal(h.memory.has("revenues_guest"), false);
      } else {
        assert.deepEqual(calls, table === "revenues" ? ["revenues"] : ["revenues", "preferences"]);
        assert.equal(calls.includes("invoices"), false);
        assert.equal(h.requests.length, table === "preferences" ? 1 : 0, "no subsequent fiscal upsert");
        assert.deepEqual([...h.memory], original);
        assert.equal(h.operations.some(op => ["remove", "set"].includes(op[0])), false);
      }
    });
  }
}
test("dependency rerun keeps operation valid without invoking layout cleanup", async () => {
  const h = create();
  const gate = deferred(), entered = deferred();
  const from = h.context.supabase.from;
  let revenues = 0;
  h.context.supabase.from = name => {
    const service = from(name);
    if (name === "revenues") service.insert = async () => { revenues++; entered.resolve(); await gate.promise; return { error: null }; };
    return service;
  };
  h.context.effect();
  await entered.promise;
  const operation = h.context.authFinalizationRef.current;
  h.context.effect();
  assert.equal(h.context.authFinalizationRef.current, operation);
  gate.resolve();
  await operation.promise;
  assert.equal(revenues, 1);
  assert.equal(h.writes.includes("invoices"), false);
  assert.equal(h.memory.has("pending"), false);
});
test("invalid finalization guard denies migration before the initial remote read", async () => {
  if (before) return;
  const h = create();
  let reads = 0;
  h.context.refreshFiscalProfile = async () => { reads++; };
  assert.equal(await h.context.migrate({ isFinalizationCurrent: () => false }), false);
  assert.equal(reads, 0);
  await tick();
});

test("unmount during actual fiscal upsert prevents the subsequent reminder write and all cleanup", async () => {
  const gate = deferred();
  const h = create({ fiscalResult: "ok", gate, reminderGate: deferred() });
  const from = h.context.supabase.from;
  let reminderWrites = 0;
  h.context.supabase.from = name => {
    const service = from(name);
    if (name === "reminders") service.upsert = async () => { reminderWrites++; return { error: null }; };
    return service;
  };
  const original = [...h.memory];
  h.context.effect();
  for (let i = 0; i < 8; i++) await tick();
  assert.equal(h.requests.length, 1);
  const operation = h.context.authFinalizationRef.current;
  h.unmount();
  gate.resolve();
  await operation.promise;
  assert.equal(reminderWrites, 0);
  assert.deepEqual([...h.memory], original);
  assert.equal(h.operations.some(op => ["remove", "set"].includes(op[0])), false);
});

test("unmount during initial profile read prevents any insert", async () => {
  const h = create();
  const gate = deferred(), entered = deferred();
  const from = h.context.supabase.from;
  h.context.supabase.from = name => {
    const service = from(name);
    const read = service.maybeSingle;
    service.maybeSingle = async () => { entered.resolve(); await gate.promise; return read(); };
    return service;
  };
  const original = [...h.memory];
  h.context.effect();
  await entered.promise;
  const operation = h.context.authFinalizationRef.current;
  h.unmount();
  gate.resolve();
  await operation.promise;
  assert.equal(h.writes.length, 0);
  assert.deepEqual([...h.memory], original);
});

test("unmount during preference save prevents entry into cleanup", async () => {
  const h = create();
  const gate = deferred(), entered = deferred();
  h.context.saveReminderPrefsToSupabase = async () => { entered.resolve(); await gate.promise; return true; };
  const original = [...h.memory];
  h.context.effect();
  await entered.promise;
  const operation = h.context.authFinalizationRef.current;
  h.unmount();
  gate.resolve();
  await operation.promise;
  assert.deepEqual([...h.memory], original);
  assert.equal(h.operations.some(op => ["remove", "set"].includes(op[0])), false);
});

test("actual preference service does not refresh after its operation is invalidated", async () => {
  const h = create();
  const c = h.context;
  const start = SOURCE.indexOf("async function saveReminderPrefsToSupabase(");
  const end = SOURCE.indexOf("\n  async function saveReminderPreferences(", start);
  assert.ok(start > 0 && end > start);
  vm.runInContext(`globalThis.savePrefs=${SOURCE.slice(start, end)};`, c);
  c.isFiscalProfileComplete = true;
  c.hasSmsPremiumAccess = false;
  c.fiscalProfile = { user_id: c.user.id };
  const operation = { session: c.profileDraftSessionRef.current };
  c.authFinalizationRef.current = operation;
  const gate = deferred(), entered = deferred();
  c.supabase = { from: () => ({ update: () => ({ eq: async () => { entered.resolve(); await gate.promise; return { error: null }; } }) }) };
  let refreshes = 0;
  c.refreshFiscalProfile = async () => { refreshes++; };
  const save = c.savePrefs({ email: true }, () => c.authFinalizationRef.current === operation);
  await entered.promise;
  h.unmount();
  gate.resolve();
  assert.equal(await save, false);
  assert.equal(refreshes, 0);
});
