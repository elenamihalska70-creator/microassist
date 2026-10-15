import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const DRAFT_KEY = "microassist_v1";
const STRATEGY_KEY = "microassist_profile_conflict_strategy";
const CODEC = readFileSync(new URL("../src/application/profile/profileStorageCodec.js", import.meta.url), "utf8").replace(/^export /gm, "");
const STORAGE = readFileSync(new URL("../src/application/profile/profileStorage.js", import.meta.url), "utf8")
  .replace(/^import .*;\r?\n/gm, "").replace(/^export /gm, "");

function installReaders(context) {
  vm.runInContext(`${CODEC}\n${STORAGE}`, context);
  // Keep the adapter functions in a separate scope from the App compatibility wrappers.
  const storedDraft = context.readLocalDraftPayload;
  const storedStrategy = context.readProfileConflictStrategy;
  const wrappers = vm.createContext({ readStoredLocalDraftPayload: storedDraft, readStoredProfileConflictStrategy: storedStrategy });
  vm.runInContext(`${implementation("readLocalDraftPayload")}\n${implementation("readProfileConflictStrategy")}`, wrappers);
  return wrappers;
}

function implementation(name) {
  const start = SOURCE.indexOf(`function ${name}(`);
  assert.ok(start >= 0);
  const end = SOURCE.indexOf("\n}\n", start);
  assert.ok(end > start);
  return SOURCE.slice(start, end + 2);
}

function readers({ values = {}, getterError = false, readError = false } = {}) {
  const calls = [];
  const context = vm.createContext({ LS_KEY: DRAFT_KEY, PROFILE_CONFLICT_STRATEGY_KEY: STRATEGY_KEY });
  Object.defineProperty(context, "localStorage", {
    get() {
      calls.push("storage");
      if (getterError) throw new Error("storage unavailable");
      return {
        getItem(key) {
          calls.push(key);
          if (readError) throw new Error("read denied");
          return values[key] ?? null;
        },
        setItem() { assert.fail("reader must not write"); },
        removeItem() { assert.fail("reader must not remove"); },
      };
    },
  });
  const wrappers = installReaders(context);
  assert.deepEqual(calls, [], "defining the readers does not access storage");
  return { context: wrappers, calls, values };
}

test("draft reader characterizes missing, empty, malformed and scalar JSON as null", () => {
  for (const raw of [undefined, "", " ", "{", "null", "false", "true", "0", "42", '"text"', '""']) {
    const h = readers({ values: { [DRAFT_KEY]: raw } });
    assert.equal(h.context.readLocalDraftPayload(), null, String(raw));
    assert.deepEqual(h.calls, ["storage", DRAFT_KEY]);
  }
});

test("draft reader preserves objects, arrays, unknown versions and unsanitized fields", () => {
  for (const value of [{}, [], [1, null, "x"], { version: 999, answers: { activity_type: "SALE", business_start_date: "03/02/2026" }, extra: true }]) {
    const h = readers({ values: { [DRAFT_KEY]: JSON.stringify(value) } });
    assert.equal(JSON.stringify(h.context.readLocalDraftPayload()), JSON.stringify(value));
    assert.deepEqual(h.calls, ["storage", DRAFT_KEY]);
  }
});

test("both readers catch storage getter and getItem exceptions without further access", () => {
  for (const options of [{ getterError: true }, { readError: true }]) {
    for (const [name, key] of [["readLocalDraftPayload", DRAFT_KEY], ["readProfileConflictStrategy", STRATEGY_KEY]]) {
      const h = readers(options);
      assert.equal(h.context[name](), null);
      assert.deepEqual(h.calls, options.getterError ? ["storage"] : ["storage", key]);
    }
  }
});

test("strategy reader preserves all nonempty strings without parsing or validation", () => {
  for (const raw of [undefined, "", "keep_local", "use_remote", "detected", "unknown-choice", " ", '"keep_local"', "null", "{}", "false"]) {
    const h = readers({ values: { [STRATEGY_KEY]: raw } });
    assert.equal(h.context.readProfileConflictStrategy(), raw || null);
    assert.deepEqual(h.calls, ["storage", STRATEGY_KEY]);
  }
});

test("repeated reads remain lazy, fresh and in caller order without caching parsed objects", () => {
  const h = readers({ values: { [DRAFT_KEY]: '{"version":999}', [STRATEGY_KEY]: "keep_local" } });
  const first = h.context.readLocalDraftPayload();
  const second = h.context.readLocalDraftPayload();
  assert.notStrictEqual(first, second);
  assert.equal(h.context.readProfileConflictStrategy(), "keep_local");
  h.values[STRATEGY_KEY] = "use_remote";
  h.values[DRAFT_KEY] = '{"answers":{"acre":"unknown"}}';
  assert.equal(h.context.readProfileConflictStrategy(), "use_remote");
  assert.equal(JSON.stringify(h.context.readLocalDraftPayload()), h.values[DRAFT_KEY]);
  assert.deepEqual(h.calls, ["storage", DRAFT_KEY, "storage", DRAFT_KEY, "storage", STRATEGY_KEY, "storage", STRATEGY_KEY, "storage", DRAFT_KEY]);
});

test("missing localStorage binding is caught by both existing readers", () => {
  const context = vm.createContext({ LS_KEY: DRAFT_KEY, PROFILE_CONFLICT_STRATEGY_KEY: STRATEGY_KEY });
  const wrappers = installReaders(context);
  assert.equal(wrappers.readLocalDraftPayload(), null);
  assert.equal(wrappers.readProfileConflictStrategy(), null);
});
