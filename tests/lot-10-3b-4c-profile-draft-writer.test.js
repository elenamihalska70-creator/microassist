import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { parseLocalDraftPayload } from "../src/application/profile/profileStorageCodec.js";

const SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const STORAGE = readFileSync(new URL("../src/application/profile/profileStorage.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "");
const START = SOURCE.indexOf("    if (!hydrated) return;\n    const loadState = fiscalProfileFetchRef.current;");
const END = SOURCE.indexOf("\n  }, [hydrated, stepIndex, answers, messages, userName, appView]);", START);
assert.ok(START >= 0 && END > START);
const EFFECT = SOURCE.slice(START, END);
const NOW = "2026-01-02T03:04:05.000Z";

function harness({ failAt, dirty = true, hydrated = true, messages = [{ role: "bot", text: "Synthetic draft" }],
  load = { userId: "a", status: "found" }, strategy = null } = {}) {
  const events = [], writes = [], feedback = [], warnings = [], savedAt = [];
  const error = new Error(`failure at ${failAt}`);
  const answers = { activity_type: "SALE", business_start_date: "03/02/2026" };
  Object.defineProperty(answers, "toJSON", { value() { events.push("toJSON"); return { activity_type: this.activity_type, business_start_date: this.business_start_date }; } });
  const storage = {};
  Object.defineProperty(storage, "setItem", { get() {
    events.push("method");
    if (failAt === "method") throw error;
    return function (key, value) {
      events.push("setItem");
      assert.strictEqual(this, storage, "setItem receiver is preserved");
      if (failAt === "setItem") throw error;
      writes.push({ key, value });
    };
  } });
  storage.getItem = () => assert.fail("writer must not read storage");
  storage.removeItem = () => assert.fail("writer must not remove storage");
  const context = vm.createContext({
    parseLocalDraftPayload,
    LS_KEY: "microassist_v1", LS_VERSION: 1, hydrated, stepIndex: 3, answers, userName: "Synthetic", messages, appView: "assistant",
    fiscalProfileFetchRef: { current: load },
    profileDraftSessionRef: { current: { userId: "a", revision: 7, dirty } },
    readProfileConflictStrategy: () => strategy,
    dispatchProfileSave: action => feedback.push({ ...action }),
    setLastSavedAt: value => savedAt.push(value),
    console: { warn: (...args) => warnings.push(args) },
    Date: class extends Date { constructor() { super(NOW); } },
    JSON: { stringify(value) {
      events.push("stringify");
      if (failAt === "stringify") throw error;
      return JSON.stringify(value);
    } },
  });
  const browser = {};
  Object.defineProperty(browser, "localStorage", { get() {
    events.push("storage");
    if (failAt === "storage") throw error;
    return storage;
  } });
  context.browser = browser;
  // An object environment preserves thrown getter errors; vm global bindings can mask them.
  vm.runInContext(`globalThis.writeLocalDraftPayload = (() => { with (browser) { ${STORAGE}\nreturn typeof writeLocalDraftPayload === "function" ? writeLocalDraftPayload : undefined; } })();`, context);
  vm.runInContext(`globalThis.persist = () => { with (browser) { ${EFFECT}\n} };`, context);
  assert.deepEqual(events, [], "module declarations and effect installation never access storage");
  return { context, events, writes, feedback, warnings, savedAt, error, answers, messages };
}

test("eligible persistence writes the exact key, field order, unsanitized payload and caller timestamp once", () => {
  const h = harness();
  h.context.persist();
  assert.deepEqual(h.events, ["storage", "method", "stringify", "toJSON", "setItem"]);
  assert.deepEqual(h.writes, [{ key: "microassist_v1", value: '{"version":1,"stepIndex":3,"answers":{"activity_type":"SALE","business_start_date":"03/02/2026"},"userName":"Synthetic","messages":[{"role":"bot","text":"Synthetic draft"}],"appView":"assistant","savedAt":"2026-01-02T03:04:05.000Z"}' }]);
  assert.deepEqual(h.feedback, [{ type: "local_saved", userId: "a", revision: 7 }]);
  assert.deepEqual(h.savedAt, [NOW]);
  assert.deepEqual(h.warnings, []);
  assert.strictEqual(h.context.answers, h.answers);
  assert.strictEqual(h.context.messages, h.messages);
});

for (const [failAt, expected] of [
  ["storage", ["storage"]],
  ["method", ["storage", "method"]],
  ["stringify", ["storage", "method", "stringify"]],
  ["setItem", ["storage", "method", "stringify", "toJSON", "setItem"]],
]) {
  test(`${failAt} exception reaches the existing effect catch and retains the in-memory draft`, () => {
    const h = harness({ failAt });
    h.context.persist();
    assert.deepEqual(h.events, expected);
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.feedback, [{ type: "local_failed", userId: "a", revision: 7 }]);
    assert.deepEqual(h.savedAt, []);
    assert.equal(h.warnings.length, 1);
    assert.equal(h.warnings[0][0], "Save failed:");
    assert.strictEqual(h.warnings[0][1], h.error);
    assert.strictEqual(h.context.answers, h.answers);
    assert.strictEqual(h.context.messages, h.messages);
    assert.equal(h.context.profileDraftSessionRef.current.dirty, true);
  });
}

test("a throwing toJSON preserves lookup order and uses the existing failure feedback", () => {
  const h = harness();
  const error = new Error("toJSON failed");
  const answers = { toJSON() { h.events.push("toJSON"); throw error; } };
  h.context.answers = answers;
  h.context.persist();
  assert.deepEqual(h.events, ["storage", "method", "stringify", "toJSON"]);
  assert.deepEqual(h.writes, []);
  assert.strictEqual(h.warnings[0][1], error);
  assert.equal(h.feedback[0].type, "local_failed");
  assert.strictEqual(h.context.answers, answers);
});

test("existing eligibility guards produce no write, serialization, feedback or removal", () => {
  for (const options of [{ hydrated: false }, { messages: [] }, { load: { userId: "a", status: "loading" } },
    { load: { userId: "a", status: "failed" } }, { load: { userId: "a", status: "found", conflictPending: true }, strategy: "detected" }]) {
    const h = harness(options);
    h.context.persist();
    assert.deepEqual(h.events, []);
    assert.deepEqual(h.feedback, []);
  }
});

test("clean drafts retain existing feedback semantics on successful and failed local writes", () => {
  for (const failAt of [undefined, "setItem"]) {
    const h = harness({ dirty: false, failAt });
    h.context.persist();
    assert.deepEqual(h.feedback, []);
    assert.deepEqual(h.savedAt, failAt ? [] : [NOW]);
    assert.equal(h.writes.length, failAt ? 0 : 1);
  }
});

test("repeated eligible executions each perform one fresh write without retry or caching", () => {
  const h = harness();
  h.context.persist();
  h.context.answers = { acre: "unknown" };
  h.context.persist();
  assert.equal(h.writes.length, 2);
  assert.equal(h.events.filter(value => value === "storage").length, 2);
  assert.equal(h.events.filter(value => value === "setItem").length, 2);
  assert.deepEqual(JSON.parse(h.writes[1].value).answers, { acre: "unknown" });
});
