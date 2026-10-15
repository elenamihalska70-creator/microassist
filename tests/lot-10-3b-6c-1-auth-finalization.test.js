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
const before = process.env.LOT6C1_BEFORE === "1";
const PENDING = "microassist_pending_auth_success";
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function create(options = {}) {
  const h = scope.create({ fiscalResult: "fail", invoices: "ok", ...options });
  const c = h.context;
  c.migrateLocalDataToSupabase = c.migrate;
  h.memory.set(PENDING, "manual_auth");
  Object.assign(c, { authLoading: false, isRecoveryFlow: false, PENDING_AUTH_SUCCESS_KEY: PENDING, BETA_SEEN_KEY: "beta_seen", authFinalizationRef: { current: null },
    setShowBetaNotice() {}, deepLinkViewPendingRef: { current: null }, goToDashboard() {}, cleanAuthCallbackUrl() {},
    authProfileResolutionMessage: () => "synthetic", window: { location: { hash: "", search: "" } }, URLSearchParams });
  const index = SOURCE.indexOf("const pendingAuthSuccess = localStorage.getItem(PENDING_AUTH_SUCCESS_KEY)");
  const start = SOURCE.lastIndexOf("useEffect(() => {", index) + "useEffect(() => {".length;
  const end = SOURCE.indexOf("\n}, [", index);
  assert.ok(start > 0 && end > start);
  vm.runInContext(`globalThis.effect=()=>{${SOURCE.slice(start, end)}\n};`, c);
  const from = c.supabase.from;
  h.invoiceAttempts = 0;
  c.supabase.from = table => {
    const service = from(table);
    const insert = service.insert;
    service.insert = async payload => { if (table === "invoices") h.invoiceAttempts++; return insert(payload); };
    return service;
  };
  return h;
}
test("effect rerun during post-migration refresh does not start another invoice insert", async () => {
  const h = create();
  const refreshGate = deferred();
  let reads = 0;
  h.context.refreshRevenues = async () => { if (++reads > 1) await refreshGate.promise; };
  const cleanup = h.context.effect();
  for (let i = 0; i < 8; i++) await tick();
  assert.equal(h.invoiceAttempts, 1);
  assert.ok(h.memory.has(PENDING));
  cleanup?.();
  h.context.effect();
  for (let i = 0; i < 8; i++) await tick();
  assert.equal(h.invoiceAttempts, before ? 2 : 1);
  refreshGate.resolve();
  for (let i = 0; i < 8; i++) await tick();
  assert.equal(h.memory.has(PENDING), false);
});
for (const transition of ["account", "logout", "generation"]) {
  test(`${transition} during revenues prevents subsequent invoice writes and stale marker consumption`, async () => {
    const h = create();
    const gate = deferred(), entered = deferred();
    const from = h.context.supabase.from;
    h.context.supabase.from = table => {
      const service = from(table);
      if (table === "revenues") service.insert = async () => { entered.resolve(); await gate.promise; return { error: null }; };
      return service;
    };
    h.context.effect();
    await entered.promise;
    h.context.profileDraftSessionRef.current = { userId: transition === "account" ? "other" : transition === "logout" ? null : "synthetic-user", revision: 0 };
    h.memory.set(PENDING, "new-marker");
    gate.resolve();
    for (let i = 0; i < 10; i++) await tick();
    assert.equal(h.invoiceAttempts, before ? 1 : 0);
    if (!before) assert.equal(h.memory.get(PENDING), "new-marker");
  });
}

test("concurrent migration callers share the active insert; sequential direct calls are not deduplicated", async () => {
  const h = create();
  const gate = deferred(), entered = deferred();
  const from = h.context.supabase.from;
  h.context.supabase.from = table => {
    const service = from(table);
    const insert = service.insert;
    if (table === "invoices") service.insert = async payload => { entered.resolve(); await gate.promise; return insert(payload); };
    return service;
  };
  const first = h.context.migrate();
  await entered.promise;
  const joined = h.context.migrate();
  gate.resolve();
  await Promise.all([first, joined]);
  assert.equal(h.invoiceAttempts, 1);
  await h.context.migrate();
  assert.equal(h.invoiceAttempts, 2);
});

test("ambiguous insert is attempted only once through repeated finalization effects", async () => {
  const h = create({ invoices: "fail" });
  const original = h.memory.get("guest_invoices");
  for (let i = 0; i < 5; i++) { h.context.effect(); await tick(); }
  for (let i = 0; i < 8; i++) await tick();
  assert.equal(h.invoiceAttempts, 1);
  assert.equal(h.memory.get("guest_invoices"), original);
  assert.equal(h.memory.has(PENDING), false);
});

for (const response of ["lost", "empty"]) {
  test(`${response} invoice acknowledgement is not automatically retried`, async () => {
    const h = create();
    const from = h.context.supabase.from;
    h.context.supabase.from = table => {
      const service = from(table);
      if (table === "invoices") service.insert = async () => {
        h.invoiceAttempts++;
        if (response === "lost") throw new Error("synthetic response lost after write");
        return { error: null };
      };
      return service;
    };
    const raw = h.memory.get("guest_invoices");
    for (let i = 0; i < 6; i++) { h.context.effect(); await tick(); }
    for (let i = 0; i < 8; i++) await tick();
    assert.equal(h.invoiceAttempts, 1);
    assert.equal(h.memory.get("guest_invoices"), raw);
  });
}

test("failed refresh retains marker but effect reruns are not automatic retries", async () => {
  const h = create();
  h.context.refreshRevenues = async () => { throw new Error("synthetic refresh failure"); };
  h.context.effect();
  for (let i = 0; i < 8; i++) await tick();
  assert.equal(h.context.authFinalizationRef.current.status, "failed");
  assert.equal(h.memory.has(PENDING), true);
  h.context.effect();
  for (let i = 0; i < 8; i++) await tick();
  assert.equal(h.invoiceAttempts, 1);
});

test("post-migration session invalidation preserves the next account marker", async () => {
  const h = create();
  const gate = deferred();
  let reads = 0;
  h.context.refreshRevenues = async () => { if (++reads > 1) await gate.promise; };
  h.context.effect();
  for (let i = 0; i < 8; i++) await tick();
  h.context.profileDraftSessionRef.current = { userId: "other", revision: 0 };
  h.memory.set(PENDING, "next-account");
  gate.resolve();
  for (let i = 0; i < 8; i++) await tick();
  assert.equal(h.memory.get(PENDING), "next-account");
  assert.equal(h.invoiceAttempts, 1);
});

test("completed finalization does not restart on rerender; a new session may legitimately finalize", async () => {
  const h = create();
  h.context.effect();
  for (let i = 0; i < 8; i++) await tick();
  h.context.effect();
  await tick();
  assert.equal(h.invoiceAttempts, 1);
  h.context.profileDraftSessionRef.current = { userId: "synthetic-user", revision: 0 };
  h.memory.set(PENDING, "manual_auth");
  h.context.effect();
  for (let i = 0; i < 8; i++) await tick();
  assert.equal(h.invoiceAttempts, 2);
  assert.equal(h.memory.has(PENDING), false);
});
