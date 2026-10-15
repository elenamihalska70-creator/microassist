import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import process from "node:process";
import { normalizeDateValue, pickProfileField, normalizeProfileConflictValue } from "../src/application/profile/profileNormalization.js";

const SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const fixture = readFileSync(new URL("./lot-10-3b-5d-fiscal-cleanup.test.js", import.meta.url), "utf8");
const scope = vm.createContext({ assert, vm, SOURCE, normalizeDateValue, pickProfileField, normalizeProfileConflictValue });
const start = fixture.indexOf("const KEY =");
const end = fixture.indexOf('\ntest("characterization:');
assert.ok(start > 0 && end > start);
vm.runInContext(fixture.slice(start, end) + "\nglobalThis.create = actualHarness;", scope);
const I = "guest_invoices";
const before = process.env.LOT6C_BEFORE === "1";
const mixed = '[ {"invoice_number":"SYNTHETIC","amount":1}, {"id":"fx-1","formatStatus":"facturx_ready_draft","extra":{"untouched":true}}, {"id":"fx-2","formatStatus":"facturx_ready_draft"} ]';
function create(raw = mixed, options = {}) {
  const h = scope.create({ fiscalResult: "fail", revenues: "ok", ...options });
  h.memory.set(I, raw);
  h.invoiceStateUpdates = [];
  h.context.setGuestInvoices = value => h.invoiceStateUpdates.push(value);
  return h;
}
function assertUntouched(h, raw) {
  assert.equal(h.memory.get(I), raw);
  assert.equal(h.operations.some(op => op[1] === I && ["remove", "set"].includes(op[0])), false);
  assert.deepEqual(h.invoiceStateUpdates, []);
}
for (const raw of [mixed, "{malformed", "{}", '[null,{"unknown":true}]', '[{"formatStatus":"unknown","custom":42}]']) {
  test(`unacknowledged invoice source remains byte-for-byte intact: ${raw}`, async () => {
    const h = create(raw);
    await h.context.migrate();
    if (before) assert.notEqual(h.memory.get(I), raw);
    else assertUntouched(h, raw);
  });
}
test("invoice success without per-row acknowledgement cannot remove classic or Factur-X entries", async () => {
  const h = create(mixed, { revenues: "fail", invoices: "ok" });
  await h.context.migrate();
  if (before) assert.notEqual(h.memory.get(I), mixed);
  else assertUntouched(h, mixed);
});
test("write exception cannot follow a destructive invoice removal", async () => {
  const h = create();
  h.context.localStorage.setItem = () => { throw new Error("synthetic quota"); };
  if (before) {
    await assert.rejects(h.context.migrate(), /synthetic quota/);
    assert.equal(h.memory.has(I), false);
  } else {
    await h.context.migrate();
    assertUntouched(h, mixed);
  }
});
test("residual read failure must not become an empty residual", async () => {
  const h = create();
  const get = h.context.localStorage.getItem;
  let reads = 0;
  h.context.localStorage.getItem = key => {
    if (key === I && ++reads > 1) throw new Error("synthetic read denied");
    return get(key);
  };
  await h.context.migrate();
  if (before) assert.equal(h.memory.has(I), false);
  else assertUntouched(h, mixed);
});
test("initial invoice read exception retains source and propagates existing migration rejection", async () => {
  const h = create();
  const get = h.context.localStorage.getItem;
  h.context.localStorage.getItem = key => { if (key === I) throw new Error("synthetic read denied"); return get(key); };
  await assert.rejects(h.context.migrate(), /synthetic read denied/);
  assertUntouched(h, mixed);
});
for (const transition of ["source", "account", "logout", "session", "migration"]) {
  test(`${transition} change during insert cannot delete the current invoice source`, async () => {
    const h = create();
    let release, entered;
    const ready = new Promise(resolve => { entered = resolve; });
    const wait = new Promise(resolve => { release = resolve; });
    const from = h.context.supabase.from;
    h.context.supabase.from = table => {
      const service = from(table);
      if (table === "invoices") service.insert = async () => { entered(); await wait; return { error: null }; };
      return service;
    };
    const migration = h.context.migrate();
    await ready;
    let raw = mixed;
    if (transition === "source") { raw = mixed.slice(0, -1) + ',{"invoice_number":"NEW-UNSENT"}]'; h.memory.set(I, raw); }
    if (transition === "account" || transition === "logout") {
      h.context.profileDraftSessionRef.current = { userId: transition === "account" ? "synthetic-other" : null, revision: 0 };
      h.context.fiscalProfileFetchRef.current = { userId: transition === "account" ? "synthetic-other" : null, status: "loading" };
    }
    if (transition === "session") h.context.profileDraftSessionRef.current = { ...h.context.profileDraftSessionRef.current };
    if (transition === "migration") h.context.guestMigrationRef.current = { userId: "synthetic-user" };
    release();
    await migration;
    if (before) assert.notEqual(h.memory.get(I), raw);
    else assertUntouched(h, raw);
  });
}
