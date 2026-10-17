import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import process from "node:process";
import { normalizeDateValue, pickProfileField, normalizeProfileConflictValue } from "../src/application/profile/profileNormalization.js";

const SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const fixture = readFileSync(new URL("./lot-10-3b-5d-fiscal-cleanup.test.js", import.meta.url), "utf8");
const scope = vm.createContext({ assert, vm, SOURCE, normalizeDateValue, pickProfileField, normalizeProfileConflictValue });
vm.runInContext(fixture.slice(fixture.indexOf("const KEY ="), fixture.indexOf('\ntest("characterization:')) + "\nglobalThis.create=actualHarness;", scope);
const before = process.env.LOT6B_BEFORE === "1";
const R = "revenues_guest", P = "microassist_reminder_prefs", I = "guest_invoices";
function create(options = {}) {
  const h = scope.create({ fiscalResult: "fail", remote: { user_id: "synthetic-user" }, ...options });
  h.context.isFiscalProfileComplete = true;
  h.context.hasSmsPremiumAccess = false;
  const start = SOURCE.indexOf("async function saveReminderPrefsToSupabase(");
  const end = SOURCE.indexOf("\n  async function saveReminderPreferences(", start);
  assert.ok(start > 0 && end > start);
  vm.runInContext(`globalThis.saveReminderPrefsToSupabase=${SOURCE.slice(start, end)};`, h.context);
  return h;
}
function preserved(h, expected) {
  for (const [key, raw] of expected) assert.equal(h.memory.get(key), raw, key);
  assert.equal(h.operations.some(op => [R, P, I].includes(op[1]) && ["remove", "set"].includes(op[0])), false);
}
for (let mask = 0; mask < 16; mask++) {
  test(`category outcome matrix ${mask}: local sources survive regardless of reported success`, async () => {
    const h = create({ revenues: mask & 1 ? "ok" : "fail", invoices: mask & 2 ? "ok" : "fail", fiscalResult: mask & 4 ? "ok" : "fail", reminders: mask & 8 ? "ok" : "fail" });
    const original = [R, P, I].map(key => [key, h.memory.get(key)]);
    assert.equal(await h.context.migrate({ silent: true }), mask !== 0);
    if (before && mask) {
      assert.equal(h.memory.has(R), false);
      assert.equal(h.memory.has(P), false);
      assert.equal(h.memory.get(I), original[2][1]);
    } else preserved(h, original);
    assert.equal(h.memory.has("microassist_v1"), !(mask & 4), "fiscal cleanup retains its own acknowledgement contract");
  });
}
for (const [key, raw] of [[R, "{malformed"], [P, "{malformed"], [R, "{}"], [R, "[]"], [P, '{"unknown":{"preserve":42}}']]) {
  test(`malformed, ignored or unknown ${key} ${raw} survives another category success`, async () => {
    const h = create({ invoices: "ok" });
    h.memory.set(key, raw);
    await h.context.migrate();
    assert.equal(h.memory.get(key), before ? undefined : raw);
  });
}
test("skipped preference save cannot authorize preference source deletion", async () => {
  const h = create({ revenues: "ok", reminders: "ok" });
  h.context.isFiscalProfileComplete = false;
  const raw = h.memory.get(P);
  await h.context.migrate();
  assert.equal(h.memory.get(P), before ? undefined : raw);
});
for (const response of ["lost", "empty"]) {
  test(`${response} revenue acknowledgement grants no deletion authority`, async () => {
    const h = create({ invoices: "ok" });
    const from = h.context.supabase.from;
    h.context.supabase.from = name => {
      const service = from(name);
      if (name === "revenues") service.insert = async () => {
        if (response === "lost") throw new Error("synthetic lost acknowledgement");
        return { error: null };
      };
      return service;
    };
    const raw = h.memory.get(R);
    await h.context.migrate();
    assert.equal(h.memory.get(R), before ? undefined : raw);
  });
}
test("new revenue and preference snapshots during invoice await remain exact", async () => {
  const h = create({ revenues: "ok", reminders: "ok" });
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { entered = resolve; });
  const from = h.context.supabase.from;
  h.context.supabase.from = name => {
    const service = from(name);
    if (name === "invoices") service.insert = async () => { entered(); await gate; return { error: null }; };
    return service;
  };
  const migration = h.context.migrate();
  await ready;
  const nextR = '[ {"id":"NEW-UNSENT","amount":999,"unknown":true} ]';
  const nextP = '{ "email":false,"unknown":{"preserve":42} }';
  h.memory.set(R, nextR);
  h.memory.set(P, nextP);
  release();
  await migration;
  assert.equal(h.memory.get(R), before ? undefined : nextR);
  assert.equal(h.memory.get(P), before ? undefined : nextP);
});
for (const key of [R, P]) {
  test(`${key} read exception preserves all local sources and the existing rejection`, async () => {
    const h = create({ revenues: "ok" });
    const original = [R, P, I].map(key => [key, h.memory.get(key)]);
    const get = h.context.localStorage.getItem;
    h.context.localStorage.getItem = name => { if (name === key) throw new Error("synthetic read failure"); return get(name); };
    await assert.rejects(h.context.migrate(), /synthetic read failure/);
    preserved(h, original);
  });
  test(`${key} removal exception is no longer reachable from migration cleanup`, async () => {
    const h = create({ invoices: "ok" });
    const original = [R, P, I].map(key => [key, h.memory.get(key)]);
    const remove = h.context.localStorage.removeItem;
    h.context.localStorage.removeItem = name => { if (name === key) throw new Error("synthetic removal failure"); return remove(name); };
    if (before) await assert.rejects(h.context.migrate(), /synthetic removal failure/);
    else { await h.context.migrate(); preserved(h, original); }
  });
}
test("no replacement write or source creation is introduced", async () => {
  const h = create({ fiscalResult: "ok" });
  h.memory.delete(R);
  h.memory.delete(P);
  h.context.localStorage.setItem = () => { throw new Error("synthetic write failure"); };
  await h.context.migrate();
  assert.equal(h.memory.has(R), false);
  assert.equal(h.memory.has(P), false);
});
test("sequential migration calls can repeat inserts and still retain local sources", async () => {
  if (before) return;
  const h = create({ revenues: "ok", invoices: "ok" });
  const original = [R, P, I].map(key => [key, h.memory.get(key)]);
  await h.context.migrate();
  await h.context.migrate();
  assert.equal(h.writes.filter(name => name === "revenues").length, 2);
  assert.equal(h.writes.filter(name => name === "invoices").length, 2);
  preserved(h, original);
});
