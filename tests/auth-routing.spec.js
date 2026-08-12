import { expect, test } from '@playwright/test';

const SUPABASE_URL_PATTERN = '**://bvymwuokljxgoavfehav.supabase.co/**';

async function installSupabaseAuthMock(page, options = {}) {
  const {
    signIn = 'error',
    signUp = 'confirmation',
    updateUser = 'success',
  } = options;

  await page.route(SUPABASE_URL_PATTERN, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname.includes('/auth/v1/token')) {
      if (signIn === 'success') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            access_token: 'test-access-token',
            refresh_token: 'test-refresh-token',
            token_type: 'bearer',
            expires_in: 3600,
            user: {
              id: 'test-user-id',
              email: 'demo@example.com',
              aud: 'authenticated',
              role: 'authenticated',
              email_confirmed_at: new Date().toISOString(),
            },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid login credentials' }),
      });
      return;
    }

    if (url.pathname.includes('/auth/v1/signup')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'signup-user-id',
            email: 'new@example.com',
            identities: signUp === 'existing' ? [] : [{ id: 'identity-id' }],
          },
          session: null,
        }),
      });
      return;
    }

    if (url.pathname.includes('/auth/v1/recover')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
      return;
    }

    if (url.pathname.includes('/auth/v1/user') && method === 'PUT') {
      await route.fulfill({
        status: updateUser === 'success' ? 200 : 400,
        contentType: 'application/json',
        body: JSON.stringify(
          updateUser === 'success'
            ? {
                user: {
                  id: 'recovery-user-id',
                  email: 'demo@example.com',
                  aud: 'authenticated',
                  role: 'authenticated',
                },
              }
            : { message: 'Password should be at least 8 characters' },
        ),
      });
      return;
    }

    if (url.pathname.includes('/rest/v1/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
}

async function openMicroassistLanding(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('beta_seen', '1');
    window.localStorage.setItem(
      'microassist_profile_v1',
      JSON.stringify({
        activity_type: 'services',
        declaration_frequency: 'mensuel',
        acre: 'unknown',
        tva_status: 'unknown',
      }),
    );
  });
  await installSupabaseAuthMock(page);
  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      name: /Ne rate plus jamais une déclaration URSSAF/,
    }),
  ).toBeVisible();

  const onboardingClose = page.getByRole('button', { name: 'Fermer l’onboarding' });
  if (await onboardingClose.isVisible().catch(() => false)) {
    await onboardingClose.click({ force: true });
    await expect(onboardingClose).toBeHidden();
  }
}

async function openAuthModal(page, mode = 'signup') {
  await openMicroassistLanding(page);

  if (mode === 'signup') {
    await page.getByRole('button', { name: 'Créer mon compte' }).first().click();
    await expect(page.getByRole('heading', { name: 'Créer un compte' })).toBeVisible();
    return;
  }

  await page.getByRole('button', { name: 'Créer mon compte' }).first().click();
  await page.getByRole('button', { name: 'Connexion' }).click();
  await expect(
    page.getByRole('heading', { name: 'Connexion à ton espace' }),
  ).toBeVisible();
}

test('auth modal displays signin form and switches from signup', async ({ page }) => {
  await openAuthModal(page, 'signin');

  await expect(page.locator('#auth-email')).toBeVisible();
  await expect(page.locator('#auth-password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
});

test('signin form exposes forgot password and validates missing email locally', async ({ page }) => {
  await openAuthModal(page, 'signin');

  await page.getByRole('button', { name: 'Mot de passe oublié ?' }).click();

  await expect(
    page.getByText('Merci d’indiquer ton email pour recevoir le lien de réinitialisation.'),
  ).toBeVisible();
});

test('signup form keeps native required field validation for empty submit', async ({ page }) => {
  await openAuthModal(page, 'signup');

  await page.getByRole('button', { name: 'Créer mon compte' }).last().click();

  await expect(page.locator('#auth-email')).toBeFocused();
  await expect
    .poll(() => page.locator('#auth-email').evaluate((input) => input.validity.valueMissing))
    .toBe(true);
});

test('signin displays a simulated auth error without real Supabase account', async ({ page }) => {
  await openAuthModal(page, 'signin');

  await page.locator('#auth-email').fill('demo@example.com');
  await page.locator('#auth-password').fill('wrong-password');
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await expect(page.getByText('Email ou mot de passe incorrect.')).toBeVisible();
});

test('signup displays confirmation email state after simulated signup', async ({ page }) => {
  await openAuthModal(page, 'signup');

  await page.locator('#auth-email').fill('new@example.com');
  await page.locator('#auth-password').fill('password123');
  await page.getByRole('button', { name: 'Créer mon compte' }).last().click();

  await expect(
    page.getByText('Compte créé. Vérifie ton email pour confirmer l’inscription.'),
  ).toBeVisible();
});

test('recovery URL opens the password reset state instead of normal signin', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('beta_seen', '1');
  });
  await installSupabaseAuthMock(page);

  await page.goto('/?type=recovery');

  await expect(
    page.getByRole('heading', { name: 'Réinitialiser mon mot de passe' }),
  ).toBeVisible();
  await expect(page.locator('#auth-new-password')).toBeVisible();
  await expect(page.locator('#auth-confirm-password')).toBeVisible();
});

test('recovery form validates matching passwords locally', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('beta_seen', '1');
  });
  await installSupabaseAuthMock(page);
  await page.goto('/?type=recovery');

  await page.locator('#auth-new-password').fill('password123');
  await page.locator('#auth-confirm-password').fill('password456');
  await page.getByRole('button', { name: 'Mettre à jour mon mot de passe' }).click();

  await expect(page.getByText('Les deux mots de passe doivent être identiques.')).toBeVisible();
});

test('guest dashboard remains discovery mode and is not treated as connected session', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('beta_seen', '1');
  });
  await installSupabaseAuthMock(page);

  await page.goto('/?view=dashboard');

  await expect(page.getByText(/Session temporaire/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créer mon compte' }).first()).toBeVisible();
});

test('unknown URL keeps rendering a non-empty public surface', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('beta_seen', '1');
  });
  await installSupabaseAuthMock(page);

  await page.goto('/route-inconnue');

  await expect(page.getByRole('main')).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: /Ne rate plus jamais une déclaration URSSAF/,
    }),
  ).toBeVisible();
});
