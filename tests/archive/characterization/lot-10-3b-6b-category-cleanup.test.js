import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { normalizeDateValue, pickProfileField, normalizeProfileConflictValue } from "../src/application/profile/profileNormalization.js";

// Reuse the existing synthetic fixture without registering its tests. Its
// callbacks are extracted from current App.jsx, not copied implementations.
const SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const fixture = readFileSync(new URL("./lot-10-3b-5d-fiscal-cleanup.test.js", import.meta.url), "utf8");
const scope = vm.createContext({ assert, vm, SOURCE, normalizeDateValue, pickProfileField, normalizeProfileConflictValue });
const start = fixture.indexOf('const KEY =');
const end = fixture.indexOf('\ntest("characterization:');
assert.ok(start > 0 && end > start);
vm.runInContext(fixture.slice(start, end) + "\nglobalThis.create = actualHarness;", scope);
const create = options => scope.create({ fiscalResult: "fail", ...options });
const R = "revenues_guest", I = "guest_invoices", P = "microassist_reminder_prefs";

for (const [success, lost] of [["revenues", I], ["invoices", R], ["reminders", R], ["reminders", I]]) {
  test(`before fix: ${success} success deletes failed ${lost}`, async () => {
    const h = create({ [success]: "ok" });
    assert.ok(h.memory.has(lost));
    assert.equal(await h.context.migrate(), true);
    assert.equal(h.memory.has(lost), false);
  });
}
test("before fix: confirmed fiscal write deletes failed revenue and invoice sources", async () => {
  const h = create({ fiscalResult: "ok" });
  await h.context.migrate();
  assert.equal(h.memory.has(R), false);
  assert.equal(h.memory.has(I), false);
});
for (const raw of ["{malformed", "{}", "[]"]) {
  test(`before fix: unrelated success removes malformed or skipped invoice source ${raw}`, async () => {
    const h = create({ revenues: "ok" });
    h.memory.set(I, raw);
    await h.context.migrate();
    assert.equal(h.memory.has(I), false);
  });
}
test("all failures retain all sources exactly", async () => {
  const h = create();
  const before = [...h.memory];
  assert.equal(await h.context.migrate(), false);
  assert.deepEqual([...h.memory], before);
});
const mixed = JSON.stringify([{ invoice_number: "SYNTHETIC", amount: 1 }, { id: "synthetic-fx", formatStatus: "facturx_ready_draft", extra: { preserved: true } }]);
test("before fix: mixed invoices lose failed legacy entries while retaining Factur-X", async () => {
  const h = create({ revenues: "ok" });
  h.memory.set(I, mixed);
  await h.context.migrate();
  assert.deepEqual(JSON.parse(h.memory.get(I)), [JSON.parse(mixed)[1]]);
});
test("blocker: invoice success then Factur-X reinsertion failure loses the only local Factur-X source", async () => {
  const h = create({ invoices: "ok" });
  h.memory.set(I, mixed);
  h.context.localStorage.setItem = () => { throw new Error("synthetic quota failure"); };
  await assert.rejects(h.context.migrate(), /synthetic quota failure/);
  assert.equal(h.memory.has(I), false);
  const invoiceOps = h.operations.filter(op => op[1] === I);
  assert.ok(invoiceOps.some(op => op[0] === "remove"));
});
test("before fix: preservation read failure becomes empty residual and deletes Factur-X", async () => {
  const h = create({ invoices: "ok" });
  h.memory.set(I, mixed);
  const get = h.context.localStorage.getItem;
  let reads = 0;
  h.context.localStorage.getItem = key => {
    if (key === I && ++reads === 2) throw new Error("synthetic read failure");
    return get(key);
  };
  await h.context.migrate();
  assert.equal(h.memory.has(I), false);
});
test("before fix: removal failure leaves partially cleaned categories", async () => {
  const h = create({ revenues: "ok" });
  const remove = h.context.localStorage.removeItem;
  h.context.localStorage.removeItem = key => {
    if (key === I) throw new Error("synthetic removal failure");
    remove(key);
  };
  await assert.rejects(h.context.migrate(), /synthetic removal failure/);
  assert.equal(h.memory.has(R), false);
  assert.equal(h.memory.has(I), true);
  assert.equal(h.memory.has(P), true);
});
test("before fix: new local invoice added while insert awaits is deleted", async () => {
  const h = create();
  let release, entered;
  const enteredPromise = new Promise(resolve => { entered = resolve; });
  const pending = new Promise(resolve => { release = resolve; });
  const from = h.context.supabase.from;
  h.context.supabase.from = table => {
    const service = from(table);
    if (table === "invoices") service.insert = async () => { entered(); await pending; return { error: null }; };
    return service;
  };
  const migration = h.context.migrate();
  await enteredPromise;
  h.memory.set(I, JSON.stringify([{ invoice_number: "NEW-UNSENT", amount: 2 }]));
  release();
  await migration;
  assert.equal(h.memory.has(I), false);
});
