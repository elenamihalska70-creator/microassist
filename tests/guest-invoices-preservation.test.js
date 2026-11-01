import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import {
  LOCAL_INVOICE_KEY,
  confirmRestore,
  createBackup,
  parseBackup,
  previewRestore,
  readCurrentInvoices,
} from "../src/application/invoices/localInvoiceBackup.js";

// `guest_invoices` is the only copy of every invoice created in the app (they
// are never inserted in Supabase), so no routine path may delete or rewrite
// it. The explicit "Tout réinitialiser" action is the one documented exception.
// Migration cleanup is covered by lot-10-3b-6b-conservative-cleanup.test.js.

const SOURCE = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");

const KEY_CONSTANTS = [
  "LS_KEY", "CHART_KEY", "GUEST_REVENUES_KEY", "GUEST_INVOICES_KEY", "PREMIUM_STATUS_KEY",
  "REMINDER_PREFS_KEY", "DASHBOARD_REMINDERS_DISMISSED_KEY", "DASHBOARD_SECTIONS_KEY",
  "DASHBOARD_TOP_NUDGE_DISMISSED_KEY", "DASHBOARD_CHECKLIST_COLLAPSED_KEY",
  "FIRST_REVENUE_ONBOARDING_SEEN_KEY", "BETA_MICRO_FEEDBACK_KEY", "EMAIL_EVENT_KEY_PREFIX",
  "PROFILE_CONFLICT_STRATEGY_KEY", "PENDING_AUTH_SUCCESS_KEY", "SIMPLE_PROFILE_KEY",
  "FULL_RESET_LOCAL_STORAGE_KEYS",
];

function topLevelConst(name) {
  const start = SOURCE.indexOf(`\nconst ${name} =`);
  assert.notEqual(start, -1, `constant ${name} not found`);
  return SOURCE.slice(start, SOURCE.indexOf(";\n", start) + 1);
}

function componentFunction(name) {
  const start = SOURCE.indexOf(`  function ${name}(`);
  assert.notEqual(start, -1, `function ${name} not found`);
  return SOURCE.slice(start, SOURCE.indexOf("\n  }\n", start) + 4);
}

function storageWith(entries) {
  const memory = new Map(entries);
  return {
    memory,
    get length() { return memory.size; },
    key: (index) => [...memory.keys()][index] ?? null,
    getItem: (key) => memory.get(key) ?? null,
  };
}

const INVOICES = [
  { id: "local-1", invoice_number: "F-2026-001", amount: 120, status: "unpaid" },
  { id: "local-2", invoice_number: "F-2026-002", amount: 80, status: "paid", paid_at: "2026-10-01T10:00:00.000Z" },
];

function keysClearedByProfileRestart() {
  const localStorage = storageWith([
    [LOCAL_INVOICE_KEY, JSON.stringify(INVOICES)],
    ["microassist_v1", "{}"],
    ["revenues_guest", "[]"],
    ["microassist_email_event_synthetic", "1"],
  ]);
  const context = vm.createContext({ localStorage });
  vm.runInContext(
    `${KEY_CONSTANTS.map(topLevelConst).join("\n")}\n${componentFunction("collectB2CLocalStorageKeys")}\n` +
      "globalThis.keys = collectB2CLocalStorageKeys();",
    context,
  );
  return context.keys;
}

test("restarting the profile journey clears the keys it collects", () => {
  assert.match(
    componentFunction("handleLocalProfileRestart"),
    /const keysToClear = collectB2CLocalStorageKeys\(\);\s*clearLocalStorageKeys\(keysToClear\);/,
  );
  const keys = keysClearedByProfileRestart();
  assert.ok(keys.includes("microassist_v1"), "the profile draft is still reset");
});

test("restarting the profile journey never clears guest_invoices", () => {
  assert.equal(keysClearedByProfileRestart().includes(LOCAL_INVOICE_KEY), false);
});

// With the storage kept, an emptied in-memory list would be written back over
// it by the next invoice save (`[invoice, ...prev]`), so the list shown after a
// restart must be re-read from storage.
test("restarting the profile journey keeps the invoices shown, so the next save cannot overwrite them", () => {
  const restart = componentFunction("handleLocalProfileRestart");
  assert.doesNotMatch(restart, /setGuestInvoices\(\[\]\)/);
  assert.match(
    restart,
    /setGuestInvoices\(readLocalInvoices\(\(\) => localStorage\.getItem\(GUEST_INVOICES_KEY\)\)\.items\)/,
  );
});

test("logging out keeps guest_invoices", () => {
  const start = SOURCE.indexOf("      if (clearLocalSessionKeys) {");
  assert.notEqual(start, -1, "session key cleanup not found");
  const list = SOURCE.slice(start, SOURCE.indexOf("]);", start));
  assert.match(list, /clearLocalStorageKeys\(\[/);
  assert.doesNotMatch(list, /GUEST_INVOICES_KEY|guest_invoices/);
});

test("only the explicit full reset lists guest_invoices for removal", () => {
  assert.match(topLevelConst("FULL_RESET_LOCAL_STORAGE_KEYS"), /GUEST_INVOICES_KEY/);
  assert.match(SOURCE, /Supprime le profil, les revenus, les factures, les rappels/);
});

test("restoring a backup keeps every existing invoice, in order and unchanged", () => {
  const stored = JSON.stringify(INVOICES);
  const conflicting = { ...INVOICES[0], amount: 999 };
  const added = { id: "local-3", invoice_number: "F-2026-003", amount: 50, status: "draft" };
  const backup = JSON.stringify({
    format: "microassist.local-invoices",
    version: 1,
    exportedAt: "2026-11-01T09:00:00.000Z",
    invoices: [conflicting, added, INVOICES[1]],
  });
  let written = null;
  const read = () => written ?? stored;
  const preview = previewRestore(parseBackup(backup), readCurrentInvoices(read));
  assert.deepEqual(preview.counts, { additions: 1, duplicates: 1, conflicts: 1, refused: 0 });

  const result = confirmRestore(preview, read, (value) => { written = value; });
  assert.equal(result.kind, "written");
  const after = JSON.parse(written);
  assert.deepEqual(after.slice(0, INVOICES.length), INVOICES);
  assert.deepEqual(after.slice(INVOICES.length), [added]);
});

test("a failed restore write leaves guest_invoices untouched", () => {
  const stored = JSON.stringify(INVOICES);
  const backup = JSON.stringify({
    format: "microassist.local-invoices",
    version: 1,
    exportedAt: "2026-11-01T09:00:00.000Z",
    invoices: [{ id: "local-9", invoice_number: "F-2026-009", amount: 10 }],
  });
  const preview = previewRestore(parseBackup(backup), readCurrentInvoices(() => stored));
  assert.throws(
    () => confirmRestore(preview, () => stored, () => { throw new Error("QuotaExceededError"); }),
    /Les factures précédentes sont conservées/,
  );
  assert.equal(readCurrentInvoices(() => stored).raw, stored);
});

test("exporting then restoring on an empty device recreates the same invoices", () => {
  const exported = createBackup(() => JSON.stringify(INVOICES), "2026-11-01T09:00:00.000Z");
  let written = null;
  const read = () => written;
  const preview = previewRestore(parseBackup(exported), readCurrentInvoices(read));
  confirmRestore(preview, read, (value) => { written = value; });
  assert.deepEqual(JSON.parse(written), INVOICES);
});
