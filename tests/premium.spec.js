import { test, expect } from '@playwright/test';

test('landing page shows pricing access blocks', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('beta_seen', '1');
  });
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Tarifs & accès' })).toBeVisible();
  await expect(page.getByText('Compte gratuit')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créer mon compte' })).toBeVisible();
});
