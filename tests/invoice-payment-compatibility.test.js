import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf('async function handleMarkInvoicePaid('), source.indexOf('\nfunction openReminderManager('));
function harness({ local = false, signedIn = true, error = null } = {}) {
  const rows = [{ id: 'a', invoice_number: 'A', status: 'draft' }, { id: 'b', invoice_number: 'B', status: 'draft' }];
  const calls = [];
  let state = structuredClone(rows), stored, notice, refreshes = 0;
  const chain = { update(payload) { calls.push(['update', payload]); return this; }, eq(key, value) { calls.push(['eq', key, value]); return this; }, then(resolve) { resolve({ error }); } };
  const context = vm.createContext({ Date, console: { error() {} }, user: signedIn ? { id: 'owner' } : null,
    GUEST_INVOICES_KEY: 'guest_invoices', localStorage: { setItem(key, value) { stored = [key, JSON.parse(value)]; } },
    setGuestInvoices(fn) { state = fn(state); }, setInvoices(fn) { state = fn(state); },
    setInvoiceNotice(value) { notice = value; }, refreshInvoices() { refreshes++; },
    supabase: { from(table) { calls.push(['from', table]); return chain; } },
  });
  vm.runInContext(handler, context);
  return { run: (invoice = { ...rows[0], localOnly: local }) => context.handleMarkInvoicePaid(invoice),
    result: () => ({ state, stored, notice, refreshes, calls }) };
}
for (const options of [{ local: true }, { signedIn: false }, {}]) {
  test(`only selected invoice becomes paid: ${JSON.stringify(options)}`, async () => {
    const h = harness(options); await h.run();
    const r = h.result();
    assert.equal(r.state[0].status, 'paid');
    assert.ok(!Number.isNaN(Date.parse(r.state[0].paid_at)));
    assert.equal(r.state[1].status, 'draft');
    assert.equal(r.state[1].paid_at, undefined);
    if (options.local || options.signedIn === false) {
      assert.equal(r.calls.length, 0); assert.equal(r.stored[0], 'guest_invoices');
    } else {
      assert.equal(r.stored, undefined);
      assert.equal(r.calls[0][1], 'invoices');
      assert.deepEqual(Object.keys(r.calls[1][1]).sort(), ['paid_at', 'status']);
      assert.deepEqual(r.calls.slice(2), [['eq', 'id', 'a'], ['eq', 'user_id', 'owner']]);
    }
  });
}
test('remote service error reports failure and refreshes invoices', async () => {
  const h = harness({ error: { message: 'synthetic rejected write' } }); await h.run();
  assert.equal(h.result().refreshes, 1);
  assert.match(h.result().notice, /Impossible/);
});
test('missing identifier produces no payment write', async () => {
  const h = harness(); await h.run({}); assert.equal(h.result().calls.length, 0);
});
