import {test, expect} from '@playwright/test';
import {readFile, mkdir} from 'node:fs/promises';
import process from 'node:process';
import {revenueFixtures, setupRevenueFixture, openFixtureDashboard} from './support/revenues-mobile-fixtures.js';

const before = process.env.THEME_STAGE === 'before';
const captures = 'output/interface-20261027';
const longName = 'Élodie François — Київ — ' + 'ClientSansEspace'.repeat(8);
const invoices = JSON.parse(await readFile('docs/local-invoice-backup/examples/valid.json', 'utf8')).invoices;
const fixtures = [revenueFixtures[0], {...revenueFixtures[1], rows: revenueFixtures[1].rows.map((r, i) => ({...r, client: i ? r.client : longName})), invoices}, revenueFixtures[6], revenueFixtures[7]];
const data = page => page.evaluate(() => ({revenues: localStorage.getItem('revenues_guest'), invoices: localStorage.getItem('guest_invoices')}));
async function fits(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function focus(page, control) {
  await control.focus();
  await expect(control).toBeFocused();
  // Keyboard modality makes :focus-visible measurable, including after mouse use.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(control).toBeFocused();
  expect(await control.evaluate(e => getComputedStyle(e).outlineStyle)).not.toBe('none');
}
for (const fixture of fixtures) test(`shared theme ${fixture.name}`, async ({context, page}) => {
  const state = await setupRevenueFixture(context, fixture);
  page.on('pageerror', e => state.errors.push(e.message));
  await page.clock.install({time: new Date('2026-10-26T09:00:00Z')});
  await openFixtureDashboard(page, fixture, expect);
  const original = await data(page);
  await mkdir(captures, {recursive: true});
  const footerLinks = await page.locator('.siteFooter a').evaluateAll(els => els.map(e => [e.textContent, e.getAttribute('href')]));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({width, height: 900});
    await fits(page);
    await expect(page.locator('.cockpitOverview')).toBeVisible();
    const footer = page.locator('.siteFooter');
    if (!before) {
      await expect(footer.locator('address')).toContainText('Besançon, France');
      await expect(footer.locator('address')).toContainText('SIRET : 10575928600021');
      await expect(footer).not.toContainText('Belfort');
      for (const heading of await footer.locator('h2, h3').all()) {
        expect(await heading.evaluate(e => getComputedStyle(e).color)).toBe('rgb(255, 253, 248)');
      }
      expect(await footer.evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(0, 81, 61)');
      expect(await page.locator('.page').evaluate(e => getComputedStyle(e).backgroundColor)).toBe('rgb(247, 244, 238)');
    }
    for (const section of [page.locator('#revenues-section'), page.locator('#invoices-section'), footer]) {
      await section.scrollIntoViewIfNeeded();
      expect(await section.evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
    }
    if (fixture.name === 'guest-filled') {
      const nav = page.getByRole('navigation', {name: 'Navigation principale'});
      await nav.getByRole('button', {name: 'Mon espace fiscal', exact: true}).click();
      if ([390, 1440].includes(width)) await page.screenshot({path: `${captures}/${before ? 'before' : 'after'}-dashboard-${width}.png`});
      if (width === 390) {await footer.scrollIntoViewIfNeeded(); await footer.screenshot({path: `${captures}/${before ? 'before' : 'after'}-footer-390.png`});}
      const add = page.locator('#revenues-section .journalHeader').getByRole('button', {name: 'Ajouter un revenu', exact: true});
      await focus(page, add);
      await add.click();
      const dialog = page.getByRole('dialog', {name: 'Ajouter revenu'});
      await expect(page.locator('.dashboardMobileActionBar')).toBeHidden();
      await dialog.getByRole('button', {name: '+ Ajouter détails', exact: true}).click();
      await dialog.getByLabel('Client', {exact: true}).fill(longName);
      const cancel = dialog.getByRole('button', {name: 'Annuler', exact: true});
      await cancel.scrollIntoViewIfNeeded(); await expect(cancel).toBeInViewport();
      await fits(page);
      await page.emulateMedia({reducedMotion: 'reduce'});
      expect(await cancel.evaluate(e => getComputedStyle(e).transitionDuration)).toBe('0s');
      await cancel.click();
      await page.emulateMedia({reducedMotion: 'no-preference'});
      await nav.getByRole('button', {name: 'Accueil', exact: true}).click();
      await fits(page);
      if (width === 390) await page.screenshot({path: `${captures}/${before ? 'before' : 'after'}-home-390.png`});
      await nav.getByRole('button', {name: 'Assistant', exact: true}).click(); await fits(page);
      await nav.getByRole('button', {name: 'Tarifs', exact: true}).click(); await fits(page);
      await expect(page.locator('.pricingBetaCard')).toBeVisible();
      await nav.getByRole('button', {name: 'Mon espace fiscal', exact: true}).click();
    }
    expect(await page.locator('.siteFooter a').evaluateAll(els => els.map(e => [e.textContent, e.getAttribute('href')]))).toEqual(footerLinks);
    expect(await data(page)).toEqual(original);
  }
  if (fixture.loading) state.release();
  expect(state.errors).toEqual([]);
  expect(state.writes.filter(w => /\/(revenues|invoices)$/.test(w.path))).toEqual([]);
  state.release();
});
