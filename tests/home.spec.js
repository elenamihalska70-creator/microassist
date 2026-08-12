import { test, expect } from '@playwright/test';

test('landing page opens', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('beta_seen', '1');
  });
  await page.goto('/');

  const main = page.getByRole('main');

  await expect(
    main.getByRole('heading', {
      name: /Ne rate plus jamais une déclaration URSSAF/,
    }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Découvrir mon suivi' })).toBeVisible();
});
