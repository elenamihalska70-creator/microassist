import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

async function setup(context, signedIn) {
  const invoiceWrites = [];
  const id = '11111111-1111-4111-8111-111111111111';
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) return route.continue();
    if (url.pathname === '/rest/v1/invoices' && !['GET', 'HEAD'].includes(request.method())) {
      invoiceWrites.push(request.method());
    }
    const user = { id, email: 'synthetic@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, identities: [], created_at: '2026-01-01T00:00:00Z' };
    const body = url.pathname === '/auth/v1/user' ? user
      : url.pathname === '/rest/v1/profiles' ? { id, onboarding_completed: true }
      : url.pathname === '/rest/v1/fiscal_profiles' ? { user_id: id, activity_type: 'services', declaration_frequency: 'mensuel', acre: 'no', business_start_date: '2026-01-01' }
      : url.pathname.includes('/rest/v1/') ? [] : {};
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await context.addInitScript(({ signedIn, id }) => {
    if (localStorage.getItem('action_bar_seeded')) return;
    localStorage.setItem('action_bar_seeded', '1');
    localStorage.setItem('beta_seen', '1');
    localStorage.setItem('guest_invoices', '[]');
    if (signedIn) {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const encode = value => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
      const user = { id, email: 'synthetic@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, identities: [], created_at: '2026-01-01T00:00:00Z' };
      localStorage.setItem('microassist_pending_auth_success', 'manual_auth');
      localStorage.setItem('sb-bvymwuokljxgoavfehav-auth-token', JSON.stringify({ access_token: `${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:id,aud:'authenticated',exp})}.synthetic`, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, expires_at: exp, user }));
    }
  }, { signedIn, id });
  return invoiceWrites;
}

async function invoices(page, signedIn) {
  await page.goto('/');
  if (signedIn) {
    await expect.poll(() => page.evaluate(() => localStorage.getItem('microassist_pending_auth_success')), { timeout: 10000 }).toBeNull();
    await expect(page.getByText('Connectée : synthetic@example.test', { exact: true })).toBeVisible();
  }
  const onboarding = page.getByRole('dialog', { name: 'Configurer ton profil fiscal' });
  if (!signedIn) {
    await expect(onboarding).toBeVisible();
    await expect(page.locator('.dashboardMobileActionBar')).toBeHidden();
  }
  if (await onboarding.isVisible()) await onboarding.getByRole('button', { name: 'Fermer l’onboarding' }).click();
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Factures', exact: true }).click();
}

const generator = page => page.locator('.modalCard').filter({ has: page.getByRole('heading', { name: '🧾 Créer une facture', exact: true }) });
const openGenerator = page => page.locator('#invoices-section').getByRole('button', { name: 'Créer une facture', exact: true }).first().click();
async function fill(page) {
  await page.getByLabel('Client *', { exact: true }).fill('Élodie — тест');
  await page.getByLabel('Prestation *', { exact: true }).fill('Contrôle synthétique');
  await page.getByLabel('Prix unitaire HT (€) *', { exact: true }).fill('12.34');
  await page.getByLabel('SIRET vendeur', { exact: true }).fill('12345678901234');
}

for (const [width, height, signedIn] of [[390, 844, false], [320, 568, false], [1440, 1000, false], [390, 844, true]]) {
  test(`global action and generator ${width}px ${signedIn ? 'account' : 'guest'}`, async ({ context, page }) => {
    await page.setViewportSize({ width, height });
    const writes = await setup(context, signedIn), errors = [], downloads = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('download', download => downloads.push(download));
    await invoices(page, signedIn);
    const bar = page.locator('.dashboardMobileActionBar');
    if (width <= 520) {
      await expect(bar).toBeVisible();
      expect(await bar.evaluate(el => getComputedStyle(el).position)).toBe('static');
      const footer = page.locator('.dashboardFooterLinks');
      await bar.scrollIntoViewIfNeeded();
      const barBox = await bar.boundingBox(), footerBox = await footer.boundingBox();
      expect(barBox.y).toBeGreaterThanOrEqual(footerBox.y + footerBox.height);
      // The real action still opens the revenue form; closing restores eligibility.
      await bar.getByRole('button').click();
      await expect(page.getByRole('dialog', { name: 'Ajouter revenu' })).toBeVisible();
      await expect(bar).toBeHidden();
      await page.getByRole('dialog', { name: 'Ajouter revenu' }).getByRole('button', { name: 'Fermer', exact: true }).click();
      await expect(bar).toBeVisible();
    } else await expect(bar).toBeHidden();

    const raw = await page.evaluate(() => localStorage.getItem('guest_invoices'));
    await openGenerator(page);
    await expect(bar).toBeHidden();
    await fill(page);
    await page.getByLabel('Client *', { exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Adresse client', { exact: true })).toBeFocused();
    await expect(page.getByLabel('Client *', { exact: true })).toHaveValue('Élodie — тест');
    await generator(page).getByRole('button', { name: 'Annuler', exact: true }).click();
    expect(await page.evaluate(() => localStorage.getItem('guest_invoices'))).toBe(raw);
    expect(downloads).toHaveLength(0);
    if (width <= 520) await expect(bar).toBeVisible();
    await openGenerator(page);
    await generator(page).getByRole('button', { name: '✕', exact: true }).click();
    if (width <= 520) await expect(bar).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('guest_invoices'))).toBe(raw);
    await openGenerator(page);
    await fill(page);
    const create = generator(page).getByRole('button', { name: 'Créer et télécharger PDF + XML', exact: true });
    await page.getByLabel('SIRET vendeur', { exact: true }).fill('');
    await create.click();
    const warning = page.getByRole('dialog', { name: 'SIRET manquant', exact: true });
    await expect(warning).toBeVisible();
    await expect(bar).toBeHidden();
    expect(downloads).toHaveLength(0);
    expect(await page.evaluate(() => localStorage.getItem('guest_invoices'))).toBe(raw);
    await warning.getByRole('button', { name: '✕', exact: true }).click();
    await expect(page.getByLabel('Client *', { exact: true })).toHaveValue('Élodie — тест');
    await page.getByLabel('SIRET vendeur', { exact: true }).fill('12345678901234');
    await create.scrollIntoViewIfNeeded();
    await expect(bar).toBeHidden();
    await create.focus();
    await expect(create).toBeFocused();
    // Hit testing plus a real, unforced click: no test hides the bar or changes z-index.
    expect(await create.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
    await mkdir('test-results/action-bar', { recursive: true });
    await page.screenshot({ path: `test-results/action-bar/generator-${width}-${signedIn ? 'account' : 'guest'}.png` });
    await create.click();
    await expect.poll(() => downloads.length).toBe(2);
    expect(downloads.map(d => d.suggestedFilename().split('.').pop()).sort()).toEqual(['pdf', 'xml']);
    await expect(generator(page)).toHaveCount(0);
    const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('guest_invoices')));
    expect(saved).toHaveLength(1);
    expect(saved[0].buyer.name).toBe('Élodie — тест');
    expect(saved[0].totals.totalTTC).toBe(12.34);
    expect(saved[0].localOnly).toBe(true);
    await page.reload();
    if (!signedIn) {
      const onboarding = page.getByRole('dialog', { name: 'Configurer ton profil fiscal' });
      await expect(onboarding).toBeVisible();
      await expect(bar).toBeHidden();
      await onboarding.getByRole('button', { name: 'Fermer l’onboarding' }).click();
    }
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Factures', exact: true }).click();
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('guest_invoices')))).toEqual(saved);
    if (width <= 520) {
      await expect(bar).toBeVisible();
      await bar.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `test-results/action-bar/footer-${width}-${signedIn ? 'account' : 'guest'}.png` });
    }
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Accueil', exact: true }).click();
    await expect(bar).toHaveCount(0);
    if (!signedIn) {
      const onboarding = page.getByRole('dialog', { name: 'Configurer ton profil fiscal' });
      await expect(onboarding).toBeVisible();
      await onboarding.getByRole('button', { name: 'Fermer l’onboarding' }).click();
    }
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('button', { name: 'Factures', exact: true }).click();
    if (width <= 520) await expect(bar).toBeVisible();
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
  });
}
