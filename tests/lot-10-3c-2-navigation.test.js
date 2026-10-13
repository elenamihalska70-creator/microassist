import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { resolveNavigationLocation } from "../src/navigation/navigationLocation.js";

const SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
function callback(name) {
  const marker = `const ${name} = useCallback(`, index = SOURCE.indexOf(marker);
  const start = index + marker.length, end = SOURCE.indexOf("\n  }, [", start);
  assert.ok(index >= 0 && end > start);
  return SOURCE.slice(start, end) + "\n  }";
}

test("all six menu destinations resolve to one compatible view/section record", () => {
  for (const [view, section] of [["landing", "home"], ["landing", "services"], ["assistant", "assistant"], ["dashboard", "fiscal"], ["dashboard", "invoices"], ["pricing", "pricing"]]) {
    assert.deepEqual(resolveNavigationLocation(view, section), { view, section });
  }
});

test("view-only transitions retain the existing landing, assistant, fiscal and pricing defaults", () => {
  for (const [view, section] of [["landing", "home"], ["assistant", "assistant"], ["dashboard", "fiscal"], ["pricing", "pricing"]]) {
    assert.deepEqual(resolveNavigationLocation(view), { view, section });
  }
});

test("incompatible sections and invalid inputs cannot produce contradictory menu identity", () => {
  assert.deepEqual(resolveNavigationLocation("dashboard", "services"), { view: "dashboard", section: "fiscal" });
  for (const invalid of [undefined, null, "unknown", "toString", "__proto__"]) {
    assert.deepEqual(resolveNavigationLocation(invalid, "invoices"), { view: "landing", section: "home" });
    assert.deepEqual(resolveNavigationLocation("landing", invalid), { view: "landing", section: "home" });
  }
});

test("resolver is pure and returns independent records without retaining the previous section", () => {
  const first = resolveNavigationLocation("dashboard", "invoices");
  first.section = "home";
  assert.deepEqual(resolveNavigationLocation("dashboard", "invoices"), { view: "dashboard", section: "invoices" });
  assert.deepEqual(resolveNavigationLocation("dashboard"), { view: "dashboard", section: "fiscal" });
});

test("real shared handler updates identity atomically without changing URL/history payload semantics", () => {
  const pushed = [], location = { pathname: "/", search: "" }, assigned = [], modes = [];
  const context = vm.createContext({ resolveNavigationLocation,
    window: { location, history: { pushState: (...args) => pushed.push(args) } },
    setNavigationLocation: (value) => assigned.push(value), setCurrentPath() {},
    setFocusMode: (value) => modes.push(value), setAssistantCollapsed() {},
  });
  vm.runInContext(`const run = ${callback("goToView")}; run("dashboard", { section: "invoices", focus: true }); run("landing", { section: "services", push: false });`, context);
  assert.deepEqual(assigned, [{ view: "dashboard", section: "invoices" }, { view: "landing", section: "services" }]);
  assert.equal(pushed.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(pushed[0])), [{ appView: "dashboard" }, "", ""]);
  assert.deepEqual(modes, [true, false]);
});

test("real landing handler distinguishes home/services without adding history entries", () => {
  const assigned = [], scheduled = [];
  const context = vm.createContext({ resolveNavigationLocation,
    setNavigationLocation: (value) => assigned.push(value), setFocusMode() {},
    setTimeout: (fn) => scheduled.push(fn),
  });
  vm.runInContext(`const run = ${callback("goToLandingSection")}; run("services"); run("home");`, context);
  assert.deepEqual(assigned, [{ view: "landing", section: "services" }, { view: "landing", section: "home" }]);
  assert.equal(scheduled.length, 2);
});

test("existing popstate limitations are preserved: view-only defaults, no null-state fallback or new history writes", () => {
  const marker = SOURCE.indexOf("const handlePopState = (event) => {");
  const start = SOURCE.lastIndexOf("useEffect(() => {", marker) + "useEffect(() => {".length;
  const end = SOURCE.indexOf("\n  }, []);", marker);
  assert.ok(marker >= 0 && end > start);
  let handler, current = resolveNavigationLocation("pricing");
  const context = vm.createContext({ resolveNavigationLocation,
    window: { location: { pathname: "/" }, addEventListener: (_type, fn) => { handler = fn; }, removeEventListener() {} },
    setCurrentPath() {}, setNavigationLocation: (value) => { current = value; }, setFocusMode() {}, setAssistantCollapsed() {},
  });
  vm.runInContext(`(function() { ${SOURCE.slice(start, end)}\n})();`, context);
  handler({ state: { appView: "dashboard" } });
  assert.deepEqual(current, { view: "dashboard", section: "fiscal" });
  handler({ state: null });
  assert.deepEqual(current, { view: "dashboard", section: "fiscal" });
});
