import { expect, test } from "@playwright/test";

const PROFILE = {
  user_id: "11111111-1111-4111-8111-111111111111",
  activity_type: "services",
  declaration_frequency: "mensuel",
  acre: "no",
  business_start_date: "2026-01-01",
};

async function startup(page, { draft = null, guest = false, pendingAuth = false } = {}) {
  const writes = [];
  const pendingReads = [];
  let result;
  await page.route("**://*.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET" && request.method() !== "OPTIONS") {
      writes.push({ path: url.pathname, method: request.method() });
    }
    if (url.pathname === "/rest/v1/fiscal_profiles" && request.method() === "GET") {
      if (!result) await new Promise((resolve) => pendingReads.push(resolve));
      await route.fulfill({ status: result.error ? 503 : 200, contentType: "application/json", body: JSON.stringify(result.error ? { message: "temporarily unavailable", code: "test_failure" } : result.profile ? [result.profile] : []) });
      return;
    }
    if (url.pathname === "/rest/v1/profiles" && request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: PROFILE.user_id, email: "returning@example.com", plan: "free", onboarding_completed: true }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(url.pathname.includes("/rest/v1/") ? [] : {}) });
  });
  await page.addInitScript(({ draft, guest, pendingAuth, userId }) => {
    localStorage.setItem("beta_seen", "1");
    if (draft) {
      localStorage.setItem("microassist_v1", JSON.stringify({ version: 1, answers: draft, messages: [{ role: "assistant", text: "Saved draft" }], savedAt: "2026-01-01T00:00:00Z" }));
    }
    if (pendingAuth) localStorage.setItem("microassist_pending_auth_success", "signed_in");
    if (!guest) {
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      const user = { id: userId, email: "returning@example.com", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, identities: [], created_at: "2026-01-01T00:00:00Z" };
      const encode = (value) => btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
      const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, aud: "authenticated", exp: expiresAt })}.test-signature`;
      localStorage.setItem("sb-bvymwuokljxgoavfehav-auth-token", JSON.stringify({ access_token: token, refresh_token: "test-refresh-token", token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user }));
    }
  }, { draft, guest, pendingAuth, userId: PROFILE.user_id });
  await page.goto("/");
  if (!guest) await expect(page.getByText("Connectée : returning@example.com")).toBeVisible();
  return {
    writes,
    async resolveRead(nextResult) {
      result = nextResult;
      for (const resolve of pendingReads.splice(0)) resolve();
    },
    async waitForRead() { await expect.poll(() => pendingReads.length).toBeGreaterThan(0); },
  };
}

function profileWrites(h) {
  return h.writes.filter(({ path }) => path === "/rest/v1/fiscal_profiles");
}

test("restored session without a draft waits for a delayed remote profile", async ({ page }) => {
  const h = await startup(page);
  await h.waitForRead();
  await expect(page.getByRole("heading", { name: "Configurer ton profil fiscal" })).toBeHidden();
  await page.waitForTimeout(2300);
  expect(profileWrites(h)).toEqual([]);
  await h.resolveRead({ profile: PROFILE });
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await expect(page.getByText("Ton profil est prêt", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Configurer ton profil fiscal" })).toBeHidden();
});

test("confirmed absence permits onboarding only after the response", async ({ page }) => {
  const h = await startup(page);
  await h.waitForRead();
  await expect(page.getByRole("heading", { name: "Configurer ton profil fiscal" })).toBeHidden();
  await h.resolveRead({ profile: null });
  await expect(page.getByRole("heading", { name: "Configurer ton profil fiscal" })).toBeVisible();
  expect(profileWrites(h)).toEqual([]);
});

test("failed read preserves a local draft, prevents migration writes, and exposes retry", async ({ page }) => {
  const draft = { entry_status: "micro_yes", ...PROFILE };
  const h = await startup(page, { draft, pendingAuth: true });
  await h.waitForRead();
  await h.resolveRead({ error: true });
  const retry = page.getByRole("button", { name: "Réessayer le chargement du profil" });
  await expect(retry).toBeVisible();
  await expect(page.getByRole("heading", { name: "Configurer ton profil fiscal" })).toBeHidden();
  await page.waitForTimeout(2500);
  expect(profileWrites(h)).toEqual([]);
  expect(h.writes.filter(({ path }) => /\/rest\/v1\/(revenues|invoices|reminders)$/.test(path))).toEqual([]);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("microassist_v1")).answers);
  expect(stored.activity_type).toBe(draft.activity_type);
  expect(stored.business_start_date).toBe(draft.business_start_date);
  await h.resolveRead({ profile: PROFILE });
  await retry.click();
  await expect(retry).toBeHidden();
  await expect(page.getByRole("heading", { name: "Configurer ton profil fiscal" })).toBeHidden();
});

test("returning-user conflict keeps the saved draft and blocks automatic writes", async ({ page }) => {
  const draft = { entry_status: "micro_yes", ...PROFILE, activity_type: "commerce" };
  const h = await startup(page, { draft });
  await h.waitForRead();
  await h.resolveRead({ profile: PROFILE });
  await expect(page.getByRole("heading", { name: "Deux profils différents ont été détectés", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Utiliser le profil du compte" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Garder le brouillon local" })).toBeVisible();
  await page.waitForTimeout(2500);
  expect(profileWrites(h)).toEqual([]);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("microassist_v1")).answers.activity_type)).toBe("commerce");
});

test("confirmed absence does not replace a partial saved draft with starter defaults", async ({ page }) => {
  const h = await startup(page, { draft: { activity_type: "commerce" } });
  await h.waitForRead();
  await h.resolveRead({ profile: null });
  await page.waitForTimeout(2300);
  await expect(page.getByRole("heading", { name: "Configurer ton profil fiscal" })).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("microassist_v1")).answers.activity_type)).toBe("commerce");
  expect(profileWrites(h)).toEqual([]);
});

test("guest still receives starter onboarding without a remote profile read", async ({ page }) => {
  const h = await startup(page, { guest: true });
  await expect(page.getByRole("heading", { name: "Configurer ton profil fiscal" })).toBeVisible();
  expect(profileWrites(h)).toEqual([]);
});
