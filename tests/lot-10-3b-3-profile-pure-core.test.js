import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import {
  normalizeDateValue,
  pickProfileField,
  normalizeProfileConflictValue,
} from "../src/application/profile/profileNormalization.js";
import { canUseRemoteProfileForEntry } from "../src/application/profile/profileDraftState.js";

const SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");

function appFunction(name) {
  const start = SOURCE.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} remains in App`);
  return SOURCE.slice(start, SOURCE.indexOf("\n}\n", start) + 2);
}

function appHelpers() {
  const logs = [];
  const context = vm.createContext({
    normalizeDateValue, pickProfileField, normalizeProfileConflictValue,
    console: { log: (...args) => logs.push(args) },
  });
  for (const name of ["normalizeActivityType", "buildProfileConflictSnapshot", "hasFiscalProfileConflict",
    "haveStructuredFiscalFieldsChanged", "buildFiscalProfilePayload", "isSameFiscalProfilePayload"]) {
    vm.runInContext(appFunction(name), context);
  }
  return { context, logs };
}

test("date normalization preserves missing, unknown, ISO and French values without validating dates", () => {
  for (const [input, expected] of [
    [undefined, ""], [null, ""], [false, ""], [0, ""], ["  ", ""],
    ["2026-02-03", "2026-02-03"], [" 03/02/2026 ", "2026-02-03"],
    ["31/02/2026", "2026-02-31"], ["3/2/2026", "3/2/2026"],
    ["unknown", "unknown"], ["2026-02-03T12:00:00Z", "2026-02-03T12:00:00Z"],
  ]) assert.equal(normalizeDateValue(input), expected);
});

test("field precedence skips only undefined, null and empty strings", () => {
  for (const source of [undefined, null, "text", 0]) {
    assert.equal(pickProfileField(source, ["first", "second"]), null);
  }
  for (const value of [false, 0, " ", "unknown"]) {
    assert.equal(pickProfileField(Object.freeze({ first: value, second: "fallback" }), ["first", "second"]), value);
  }
  for (const first of [undefined, null, ""]) {
    assert.equal(pickProfileField({ first, second: "fallback" }, ["first", "second"]), "fallback");
  }
  assert.equal(pickProfileField({}, ["first"]), null);
});

test("conflict normalization preserves booleanish aliases and unknown values", () => {
  for (const value of [undefined, null, ""]) assert.equal(normalizeProfileConflictValue(value), null);
  for (const value of [true, "true", "yes"]) assert.equal(normalizeProfileConflictValue(value, "booleanish"), "yes");
  for (const value of [false, "false", "no"]) assert.equal(normalizeProfileConflictValue(value, "booleanish"), "no");
  for (const [value, expected] of [[" TRUE ", "true"], [" YES ", "yes"], [0, "0"], [" Unknown ", "unknown"], [" ", ""]]) {
    assert.equal(normalizeProfileConflictValue(value, "booleanish"), expected);
  }
  assert.equal(normalizeProfileConflictValue("03/02/2026", "date"), "2026-02-03");
  assert.equal(normalizeProfileConflictValue(" Invalid ", "date"), "Invalid");
  assert.equal(normalizeProfileConflictValue(" VALUE ", "unknown-type"), "value");
});

test("local/remote conflicts preserve alias precedence, missing fields and ignored fields", () => {
  const { context: h } = appHelpers();
  const local = Object.freeze({ activity: "sale", activity_type: "services", declarationFrequency: " MENSUEL ", acre: true, startDate: "03/02/2026" });
  const remote = Object.freeze({ activity_type: "commerce", declaration_frequency: "mensuel", acre: "yes", business_start_date: "2026-02-03" });
  assert.equal(h.hasFiscalProfileConflict(local, remote), false);
  assert.equal(h.hasFiscalProfileConflict(undefined, null), false);
  assert.equal(h.hasFiscalProfileConflict({}, remote), true);
  for (const [key, value] of [["activity_type", "services"], ["declaration_frequency", "trimestriel"], ["acre", "no"], ["business_start_date", "2026-02-04"]]) {
    assert.equal(h.hasFiscalProfileConflict(local, { ...remote, [key]: value }), true);
  }
  assert.equal(h.hasFiscalProfileConflict(local, { ...remote, acre_start_date: "different", tva_mode: "different" }), false);
  assert.equal(h.haveStructuredFiscalFieldsChanged(
    { activity_type: "sale", declaration_frequency: " Mensuel ", acre: false, business_start_date: "03/02/2026" },
    { activity_type: "commerce", declaration_frequency: "mensuel", acre: "no", business_start_date: "2026-02-03" },
  ), false);
});

test("payload shape, serialization, owner and equality remain exact", () => {
  const { context: h, logs } = appHelpers();
  const answers = Object.freeze({ entry_status: "micro_yes", activity_type: "sale", declaration_frequency: "mensuel", acre: "yes", acre_start_date: "2026-02-03", business_start_date: "2026-02-03" });
  const expected = { user_id: "owner-a", business_status: "micro_entreprise", activity_type: "commerce", declaration_frequency: "mensuel", tva_mode: "franchise_en_base", acre: "yes", acre_start_date: "2026-02-03", business_start_date: "2026-02-03" };
  const payload = h.buildFiscalProfilePayload("owner-a", answers);
  assert.equal(JSON.stringify(payload), JSON.stringify(expected));
  assert.equal(logs.length, 1, "activity normalization retains its existing logging side effect");
  assert.equal(h.isSameFiscalProfilePayload(payload, { ...expected, activity_type: "sales", id: "ignored" }), true);
  for (const key of Object.keys(expected)) assert.equal(h.isSameFiscalProfilePayload(payload, { ...expected, [key]: "different" }), false, key);
  assert.equal(h.isSameFiscalProfilePayload(null, expected), false);
  assert.equal(h.isSameFiscalProfilePayload(payload, null), false);
  assert.equal(JSON.stringify(h.buildFiscalProfilePayload("owner-b", {})), JSON.stringify({ user_id: "owner-b", business_status: "other", activity_type: null, declaration_frequency: null, tva_mode: "franchise_en_base", acre: null, acre_start_date: null, business_start_date: null }));
  assert.equal(h.isSameFiscalProfilePayload(h.buildFiscalProfilePayload("owner-b", {}), { user_id: "owner-b", business_status: "other", tva_mode: "franchise_en_base", acre: false }), true);
  assert.equal(h.isSameFiscalProfilePayload(payload, { ...expected, business_start_date: "03/02/2026" }), false, "payload equality does not normalize dates");
});

test("keep_local/use_remote entry semantics retain unresolved-load and dirty-draft guards", () => {
  for (const strategy of ["keep_local", "detected", "use_remote", null]) {
    for (const loadStatus of ["loading", "failed", "absent", "found"]) {
      for (const hasUnsavedDraft of [false, true]) {
        assert.equal(canUseRemoteProfileForEntry({ strategy, loadStatus, hasUnsavedDraft }),
          loadStatus === "found" && !hasUnsavedDraft && strategy !== "keep_local" && strategy !== "detected");
      }
    }
  }
});
