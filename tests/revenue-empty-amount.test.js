import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const handlers = source.slice(source.indexOf('  async function saveRevenueEntry()'), source.indexOf('  function formatRevenueDate('));

for (const signedIn of [false, true]) {
  for (const amount of ['', '   ', '\t\n']) {
    test(`${signedIn ? 'connected' : 'guest'} rejects ${JSON.stringify(amount)} before conversion or writes, including repeated submission`, async () => {
      const form = {amount, date: '2026-10-27', client: 'Synthetic client', invoice: 'SYNTHETIC', note: 'Keep this note'};
      const before = structuredClone(form);
      const writes = [], errors = [];
      const unexpected = () => { throw new Error('Blank amount reached conversion or persistence'); };
      const context = vm.createContext({
        revenueForm: form, user: signedIn ? {id: 'synthetic'} : null,
        revenues: [{id: 'existing', amount: 42}], dashboardAnswers: {},
        isMixedActivityValue: () => false, isFiscalProfileComplete: true,
        setRevenueAmountError: value => errors.push(value),
        Number: unexpected, saveRevenueToSupabase: unexpected,
        revenueAmount: 0, setRevenues: value => writes.push(value),
        localStorage: {setItem: (...args) => writes.push(args)}, GUEST_REVENUES_KEY: 'revenues_guest',
        setShowAddRevenue() {}, resetRevenueForm() {}, trackBetaEvent() {}, trackEvent() {},
        visibleInvoices: [], showSuccessToast() {}, showSaveNotice() {}, alert: unexpected,
      });
      vm.runInContext(handlers, context);
      await context.handleSaveRevenue();
      await context.handleSaveRevenue();
      assert.deepEqual(writes, []);
      assert.deepEqual(form, before);
      assert.equal(errors.length, 2);
      assert.equal(errors[0], 'Merci de saisir un montant.');
    });
  }
}
