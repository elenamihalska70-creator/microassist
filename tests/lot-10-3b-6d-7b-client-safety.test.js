import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { normalizeDateValue, pickProfileField, normalizeProfileConflictValue } from "../src/application/profile/profileNormalization.js";
import { readLocalInvoices, LOCAL_INVOICE_MESSAGES } from "../src/application/invoices/localInvoiceStatus.js";

const SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const fixture = readFileSync(new URL("./lot-10-3b-5d-fiscal-cleanup.test.js", import.meta.url), "utf8");
const scope = vm.createContext({ assert, vm, SOURCE, normalizeDateValue, pickProfileField, normalizeProfileConflictValue });
vm.runInContext(fixture.slice(fixture.indexOf("const KEY ="), fixture.indexOf('\ntest("characterization:')) + "\nglobalThis.create=actualHarness;", scope);
const I = "guest_invoices";
for (const [raw, status] of [[null, "empty"], ["[]", "empty"], ['[{"id":"classic"},{"formatStatus":"facturx_ready_draft"}]', "local"], ["{broken", "invalid"], ["{}", "invalid"], ["[null]", "invalid"]]) {
  test(`read-only status ${status}: ${raw}`, () => {
    assert.equal(readLocalInvoices(() => raw).status, status);
  });
}
test("unavailable storage does not claim preservation", () => {
  assert.equal(readLocalInvoices(() => { throw Error("synthetic"); }).status, "unavailable");
  assert.equal(LOCAL_INVOICE_MESSAGES.unavailable, "L’accès aux factures de cet appareil est indisponible. Aucun import automatique n’est effectué.");
});
for (const scenario of ["single migration callback", "two sequential migration calls", "new harness with the same fixture", "repeat callback in the same harness", "second independent harness", "synthetic account B session", "mixed", "invalid", "storage failure", "partial success"]) {
  test(`zero invoice attempts and raw preservation: ${scenario}`, async () => {
    let attempts = 0;
    const create = () => {
      const h = scope.create({ fiscalResult: "fail", revenues: "ok", invoices: "ok" });
      const from = h.context.supabase.from;
      h.context.supabase.from = table => {
        const service = from(table);
        if (table === "invoices") service.insert = async () => { attempts++; return { error: null }; };
        return service;
      };
      return h;
    };
    const h = create();
    if (scenario === "mixed") h.memory.set(I, '[ {"invoice_number":"CLASSIC"}, {"formatStatus":"facturx_ready_draft","id":"FX"} ]');
    if (scenario === "invalid") h.memory.set(I, "{invalid");
    if (scenario === "synthetic account B session") {
      h.context.user = { id: "synthetic-b" };
      h.context.profileDraftSessionRef.current = { userId: "synthetic-b", revision: 1 };
    }
    if (scenario === "storage failure") {
      const get = h.context.localStorage.getItem;
      h.context.localStorage.getItem = key => { if (key === I) throw Error("synthetic storage"); return get(key); };
    }
    const raw = h.memory.get(I);
    await h.context.migrate({ silent: true });
    if (["two sequential migration calls", "repeat callback in the same harness"].includes(scenario)) await h.context.migrate({ silent: true });
    if (["new harness with the same fixture", "second independent harness"].includes(scenario)) await create().context.migrate({ silent: true });
    assert.equal(attempts, 0);
    assert.equal(h.memory.get(I), raw);
    assert.equal(h.operations.some(([op, key]) => key === I && ["set", "remove"].includes(op)), false);
  });
}
test("migration source contains no invoice writer or invoice storage access", () => {
  const migration = SOURCE.slice(SOURCE.indexOf("const migrateLocalDataToSupabase"), SOURCE.indexOf("// Эффекты с правильными зависимостями"));
  assert.doesNotMatch(migration, /from\(["']invoices["']\)|getItem\(GUEST_INVOICES_KEY\)/);
});
