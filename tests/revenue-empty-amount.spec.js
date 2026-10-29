import {test, expect} from '@playwright/test';
import {revenueFixtures, setupRevenueFixture, openFixtureDashboard} from './support/revenues-mobile-fixtures.js';

for (const signedIn of [false, true]) {
  const fixture = {...revenueFixtures[signedIn ? 2 : 1], profile: !signedIn};
  test(`${signedIn ? 'connected' : 'guest'} blank amount preserves data and form, then accepts correction once`, async ({context, page}) => {
    const state = await setupRevenueFixture(context, fixture);
    await context.addInitScript(() => {
      window.__revenueWrites = [];
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === 'revenues_guest') window.__revenueWrites.push(value);
        return setItem.call(this, key, value);
      };
    });
    page.on('pageerror', error => state.errors.push(error.message));
    await openFixtureDashboard(page, fixture, expect);
    const readData = () => page.evaluate(() => ({revenues: localStorage.getItem('revenues_guest'), invoices: localStorage.getItem('guest_invoices')}));
    const before = await readData();
    const writesBefore = await page.evaluate(() => window.__revenueWrites.length);
    await page.locator('#revenues-section').getByRole('button', {name: 'Ajouter un revenu', exact: true}).click();
    const dialog = page.getByRole('dialog', {name: 'Ajouter revenu'});
    const amount = dialog.getByLabel('Montant (€)', {exact: true});
    await dialog.getByLabel('Date', {exact: true}).fill('2026-10-15');
    await dialog.getByRole('button', {name: '+ Ajouter détails', exact: true}).click();
    for (const [label, value] of [['Client', 'Synthetic client'], ['Facture', 'SYNTHETIC-NEW'], ['Note', 'Keep this note']]) {
      await dialog.getByLabel(label, {exact: true}).fill(value);
    }
    const remoteWritesBefore = [...state.writes];
    // Two attempts must remain harmless, without relying on HTML required validation.
    await dialog.getByRole('button', {name: 'Enregistrer', exact: true}).dblclick();
    await expect(dialog).toBeVisible();
    await expect(amount).toHaveAttribute('aria-invalid', 'true');
    await expect(amount).toHaveAccessibleDescription('Merci de saisir un montant.');
    await expect(dialog.getByRole('alert')).toHaveText('Merci de saisir un montant.');
    await expect(dialog.getByLabel('Date', {exact: true})).toHaveValue('2026-10-15');
    for (const [label, value] of [['Client', 'Synthetic client'], ['Facture', 'SYNTHETIC-NEW'], ['Note', 'Keep this note']]) {
      await expect(dialog.getByLabel(label, {exact: true})).toHaveValue(value);
    }
    expect(await readData()).toEqual(before);
    expect(await page.evaluate(() => window.__revenueWrites.length)).toBe(writesBefore);
    expect(state.writes).toEqual(remoteWritesBefore);
    await amount.fill('123.45');
    await expect(amount).not.toHaveAttribute('aria-invalid', 'true');
    await dialog.getByRole('button', {name: 'Enregistrer', exact: true}).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#revenues-section .revenuesList > .revenueItem')).toHaveCount(4);
    if (signedIn) {
      const revenueWrites = state.writes.filter(write => write.path === '/rest/v1/revenues');
      expect(revenueWrites).toHaveLength(1);
      expect(revenueWrites[0]).toMatchObject({method: 'POST', path: '/rest/v1/revenues', body: {amount: 123.45, client: 'Synthetic client', invoice: 'SYNTHETIC-NEW', note: 'Keep this note', revenue_date: '2026-10-15'}});
      expect(await readData()).toEqual(before);
    } else {
      const saved = JSON.parse((await readData()).revenues);
      expect(saved[0]).toMatchObject({amount: 123.45, client: 'Synthetic client', invoice: 'SYNTHETIC-NEW', note: 'Keep this note', date: '2026-10-15'});
      expect(saved.slice(1)).toEqual(JSON.parse(before.revenues));
      expect((await readData()).invoices).toBe(before.invoices);
      expect(state.writes.filter(write => /\/(revenues|invoices)$/.test(write.path))).toEqual([]);
    }
    expect(state.errors).toEqual([]);
    state.release();
  });

  test(`${signedIn ? 'connected' : 'guest'} explicit zero keeps its existing contract`, async ({context, page}) => {
    const state = await setupRevenueFixture(context, fixture);
    await openFixtureDashboard(page, fixture, expect);
    const before = await page.evaluate(() => localStorage.getItem('revenues_guest'));
    await page.locator('#revenues-section').getByRole('button', {name: 'Ajouter un revenu', exact: true}).click();
    const dialog = page.getByRole('dialog', {name: 'Ajouter revenu'});
    await dialog.getByLabel('Montant (€)', {exact: true}).fill('0');
    const alerts = [];
    page.on('dialog', async alert => { alerts.push(alert.message()); await alert.accept(); });
    await dialog.getByRole('button', {name: 'Enregistrer', exact: true}).click();
    if (signedIn) {
      await expect(dialog).toBeVisible();
      expect(alerts).toEqual(['Merci d’indiquer un montant valide.']);
      expect(await page.evaluate(() => localStorage.getItem('revenues_guest'))).toBe(before);
    } else {
      await expect(dialog).toBeHidden();
      const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('revenues_guest')));
      expect(saved[0].amount).toBe(0);
      expect(saved.slice(1)).toEqual(JSON.parse(before));
    }
    expect(state.writes.filter(write => /\/(revenues|invoices)$/.test(write.path))).toEqual([]);
    state.release();
  });
}
