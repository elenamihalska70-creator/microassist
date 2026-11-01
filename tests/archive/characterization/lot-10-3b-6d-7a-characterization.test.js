import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { setImmediate } from "node:timers";
import { normalizeDateValue, pickProfileField, normalizeProfileConflictValue } from "../src/application/profile/profileNormalization.js";

// Current-behavior characterization only. Successful assertions below include
// reproduced unsafe behavior; they are not future safety acceptance criteria.
const SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const fixture = readFileSync(new URL("./lot-10-3b-6c-1-auth-finalization.test.js", import.meta.url), "utf8");
const fiscalFixture = readFileSync(new URL("./lot-10-3b-5d-fiscal-cleanup.test.js", import.meta.url), "utf8");
const scope = vm.createContext({ assert, vm, SOURCE, normalizeDateValue, pickProfileField, normalizeProfileConflictValue,
  readFileSync: () => fiscalFixture, URL, process: { env: {} }, setImmediate, URLSearchParams });
const start = fixture.indexOf("const fixture =");
const end = fixture.indexOf('\ntest("effect rerun');
assert.ok(start > 0 && end > start);
// Existing harness extracts real migration, fiscal, and finalization callbacks.
vm.runInContext(fixture.slice(start, end).replaceAll("import.meta.url", '"file:///synthetic/test.js"') + "\nglobalThis.make=create;", scope);
const I = "guest_invoices", P = "microassist_pending_auth_success";
function make(options) {
  const h = scope.make(options);
  h.payloads = [];
  const from = h.context.supabase.from;
  h.context.supabase.from = table => {
    const service = from(table), insert = service.insert;
    service.insert = async payload => {
      if (table === "invoices") h.payloads.push(JSON.parse(JSON.stringify(payload)));
      return insert(payload);
    };
    return service;
  };
  return h;
}
const settle = async h => {
  for (let n = 0; n < 25; n++) await new Promise(resolve => setImmediate(resolve));
  await h.context.authFinalizationRef.current?.promise;
};
test("CURRENT: initial login inserts once, retains source, consumes marker", async () => {
  const h = make(), raw = h.memory.get(I);
  h.context.effect(); await settle(h);
  assert.equal(h.invoiceAttempts, 1);
  assert.equal(h.memory.get(I), raw);
  assert.equal(h.memory.has(P), false);
});
test("CURRENT DEFECT: repeat login marker re-enters insert after success", async () => {
  const h = make();
  h.context.effect(); await settle(h);
  h.memory.set(P, "second-login"); h.context.effect(); await settle(h);
  assert.equal(h.invoiceAttempts, 2);
});
for (const scenario of ["reload", "two tabs"]) {
  test(`CURRENT DEFECT: ${scenario} with independent refs repeats the same source`, async () => {
    const a = make(), b = make();
    assert.equal(a.memory.get(I), b.memory.get(I));
    // Independent runtimes initialized from identical origin storage snapshots.
    // For two tabs, start both before either removes the shared pending marker.
    if (scenario === "reload") { a.context.effect(); await settle(a); b.context.effect(); }
    else { a.context.effect(); b.context.effect(); }
    await Promise.all([settle(a), settle(b)]);
    assert.equal(a.invoiceAttempts + b.invoiceAttempts, 2);
  });
}
test("CURRENT: rerenders after completed finalization do not insert again", async () => {
  const h = make(); h.context.effect(); await settle(h);
  for (let n = 0; n < 5; n++) h.context.effect();
  await settle(h); assert.equal(h.invoiceAttempts, 1);
});
test("CURRENT DEFECT: new account claims unchanged historical source in payload", async () => {
  const h = make(), raw = h.memory.get(I);
  h.context.user = { id: "synthetic-account-b" };
  h.context.profileDraftSessionRef.current = { userId: "synthetic-account-b", revision: 1, dirty: false };
  h.context.effect(); await settle(h);
  assert.equal(h.payloads.length, 1);
  assert.equal(h.payloads[0][0].user_id, "synthetic-account-b");
  assert.equal(h.memory.get(I), raw);
});
test("CURRENT: mixed source sends classic only and preserves exact raw bytes", async () => {
  const h = make(), raw = '[ {"invoice_number":"CLASSIC","amount":1}, {"formatStatus":"facturx_ready_draft","id":"FX"} ]';
  h.memory.set(I, raw); await h.context.migrate();
  assert.equal(h.payloads[0].length, 1);
  assert.equal(h.payloads[0][0].invoice_number, "CLASSIC");
  assert.equal(h.memory.get(I), raw);
});
test("CURRENT: malformed JSON is retained; no invoice attempt", async () => {
  const h = make(); h.memory.set(I, "{invalid");
  h.context.effect(); await settle(h);
  assert.equal(h.invoiceAttempts, 0); assert.equal(h.memory.get(I), "{invalid");
  assert.equal(h.memory.has(P), false);
});
test("CURRENT: invoice storage read failure escapes migration and leaves failed finalization", async () => {
  const h = make(), get = h.context.localStorage.getItem;
  h.context.localStorage.getItem = key => { if (key === I) throw new Error("synthetic storage read"); return get(key); };
  h.context.effect(); await settle(h);
  assert.equal(h.invoiceAttempts, 0);
  assert.equal(h.context.authFinalizationRef.current.status, "failed");
  assert.equal(h.memory.has(P), true);
});
test("CURRENT: authentication storage write failure occurs after invoice attempt", async () => {
  const h = make(), raw = h.memory.get(I);
  h.context.localStorage.setItem = () => { throw new Error("synthetic storage write"); };
  h.context.effect(); const operation = h.context.authFinalizationRef.current; await settle(h);
  assert.equal(h.invoiceAttempts, 1); assert.equal(h.memory.get(I), raw);
  assert.equal(operation.status, "failed");
  assert.equal(h.context.authFinalizationRef.current, null);
  assert.equal(h.memory.has(P), false, "marker was already consumed before beta flag write failed");
});
test("CURRENT DEFECT: denied invoice plus revenue success returns true and completes login", async () => {
  const h = make({ invoices: "fail", revenues: "ok" }), raw = h.memory.get(I);
  let result;
  h.context.migrateLocalDataToSupabase = async options => (result = await h.context.migrate(options));
  h.context.effect(); await settle(h);
  assert.equal(result, true); assert.equal(h.invoiceAttempts, 1);
  assert.equal(h.memory.has(P), false); assert.equal(h.memory.get(I), raw);
});
test("CURRENT: migration does not write or remove invoice storage even when writes would fail", async () => {
  const h = make(), raw = h.memory.get(I), set = h.context.localStorage.setItem;
  h.context.localStorage.setItem = (key, value) => { if (key === I) throw new Error("synthetic quota"); return set(key, value); };
  await h.context.migrate();
  assert.equal(h.memory.get(I), raw);
  assert.equal(h.operations.some(([op, key]) => key === I && ["set", "remove"].includes(op)), false);
});
