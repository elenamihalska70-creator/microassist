import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const handler = source.slice(source.indexOf('async function handleMarkInvoicePaid('), source.indexOf('\nfunction openReminderManager('));
function harness({ signedIn = true, error = null } = {}) {
  // Same identifiers and invoice numbers deliberately exist in both collections.
  const rows = [{ id: 'a', invoice_number: 'SAME', status: 'draft' }, { id: 'b', invoice_number: 'SAME', status: 'draft' }];
  const calls = [];
  let local = structuredClone(rows), remote = structuredClone(rows), stored, notice, refreshes = 0;
  const chain = { update(payload) { calls.push(['update', payload]); return this; }, eq(key, value) { calls.push(['eq', key, value]); return this; }, then(resolve) { resolve({ error }); } };
  const context = vm.createContext({ Date, console: { error() {} }, user: signedIn ? { id: 'owner' } : null,
    GUEST_INVOICES_KEY: 'guest_invoices', localStorage: { setItem(key, value) { stored = [key, JSON.parse(value)]; } },
    setGuestInvoices(fn) { local = fn(local); }, setInvoices(fn) { remote = fn(remote); },
    setInvoiceNotice(value) { notice = value; }, refreshInvoices() { refreshes++; },
    supabase: { from(table) { calls.push(['from', table]); return chain; } },
  });
  vm.runInContext(handler, context);
  return { run: (invoice, origin) => context.handleMarkInvoicePaid(invoice, origin),
    result: () => ({ local, remote, stored, notice, refreshes, calls }) };
}
for (const options of [{}, { signedIn: false }, { localOnly: true, formatStatus: 'facturx_ready_draft' }]) {
  test(`local provenance preserves only selected local invoice: ${JSON.stringify(options)}`, async () => {
    const h = harness(options);
    await h.run({ id: 'a', ...options }, 'local');
    const r = h.result();
    assert.equal(r.local[0].status, 'paid');
    assert.ok(!Number.isNaN(Date.parse(r.local[0].paid_at)));
    assert.equal(r.local[1].status, 'draft');
    assert.equal(r.local[1].paid_at, undefined);
    assert.deepEqual(r.remote.map(row => row.status), ['draft', 'draft']);
    assert.equal(r.calls.length, 0);
    assert.equal(r.stored[0], 'guest_invoices');
    assert.equal(r.stored[1][0].status, 'paid');
    assert.equal(Object.hasOwn(r.stored[1][0], 'origin'), false);
    assert.equal(Object.hasOwn(r.stored[1][0], 'localOnly'), false);
  });
}
test('remote provenance updates exact id and owner without touching local collection, regardless of legacy fields', async () => {
  const h = harness();
  await h.run({ id: 'a', localOnly: true, user_id: 'untrusted' }, 'remote');
  const r = h.result();
  assert.equal(r.remote[0].status, 'paid'); assert.equal(r.remote[1].status, 'draft');
  assert.deepEqual(r.local.map(row => row.status), ['draft', 'draft']);
  assert.equal(r.stored, undefined);
  assert.equal(r.calls[0][1], 'invoices');
  assert.deepEqual(Object.keys(r.calls[1][1]).sort(), ['paid_at', 'status']);
  assert.deepEqual(r.calls.slice(2), [['eq', 'id', 'a'], ['eq', 'user_id', 'owner']]);
});
for (const origin of [undefined, null, '', 'invalid', {}, 'LOCAL']) {
  test(`invalid provenance never writes: ${JSON.stringify(origin)}`, async () => {
    const h = harness(); await h.run({ id: 'a' }, origin);
    const r = h.result();
    assert.equal(r.calls.length, 0); assert.equal(r.stored, undefined);
    assert.deepEqual(r.local.map(row => row.status), ['draft', 'draft']);
    assert.deepEqual(r.remote.map(row => row.status), ['draft', 'draft']);
  });
}
test('remote provenance without authenticated owner never writes', async () => {
  const h = harness({ signedIn: false }); await h.run({ id: 'a' }, 'remote');
  assert.equal(h.result().calls.length, 0); assert.equal(h.result().stored, undefined);
});
test('remote service error reports failure and refreshes invoices', async () => {
  const h = harness({ error: { message: 'synthetic rejected write' } });
  await h.run({ id: 'a' }, 'remote');
  assert.equal(h.result().refreshes, 1); assert.match(h.result().notice, /Impossible/);
  assert.equal(h.result().stored, undefined);
  assert.deepEqual(h.result().local.map(row => row.status), ['draft', 'draft']);
});
test('missing identifier produces no payment write', async () => {
  const h = harness(); await h.run({}, 'remote'); assert.equal(h.result().calls.length, 0);
});
