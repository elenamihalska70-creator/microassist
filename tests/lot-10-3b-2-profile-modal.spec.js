import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const REMOTE = { user_id: A, business_status: "micro_entreprise", activity_type: "services", declaration_frequency: "mensuel", tva_mode: "franchise_en_base", acre: "no", acre_start_date: null, business_start_date: "2026-01-01" };
const DRAFT = { entry_status: "micro_yes", status: "auto_entrepreneur", activity_type: "services", declaration_frequency: "mensuel", acre: "no", business_start_date: "2026-06-10" };
const authUser = (id) => ({ id, email: `${id === A ? "first" : "second"}@example.com`, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, identities: [], created_at: "2026-01-01T00:00:00Z" });

async function startup(page, { guest = false, draft = null, strategy = null, absent = false, failed = false, pendingAuth = false } = {}) {
  let remote = absent ? null : { ...REMOTE }, readFailed = failed, held = false;
  const reads = [], writes = [], saves = [];
  await page.route("**://*.supabase.co/**", async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname === "/auth/v1/user") {
      const token = request.headers().authorization.split(" ")[1];
      const id = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).sub;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(authUser(id)) });
      return;
    }
    if (url.pathname === "/rest/v1/fiscal_profiles") {
      if (request.method() === "GET") {
        if (held) await new Promise((resolve) => reads.push(resolve));
        await route.fulfill({ status: readFailed ? 503 : 200, contentType: "application/json", body: JSON.stringify(readFailed ? { message: "fixture unavailable" } : remote ? [remote] : []) });
      } else {
        const payload = request.postDataJSON();
        writes.push(payload);
        const outcome = await new Promise((resolve) => saves.push(resolve));
        if (!outcome.error) remote = { ...payload };
        await route.fulfill({ status: outcome.error ? 503 : 200, contentType: "application/json", body: JSON.stringify(outcome.error ? { message: "fixture save failed" } : remote) });
      }
      return;
    }
    if (url.pathname === "/rest/v1/profiles" && request.method() === "GET") {
      const id = url.searchParams.get("id")?.replace("eq.", "") || A;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id, email: authUser(id).email, plan: "free" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(url.pathname.includes("/rest/v1/") ? [] : {}) });
  });
  await page.addInitScript(({ guest, draft, strategy, user, pendingAuth }) => {
    localStorage.setItem("beta_seen", "1");
    if (draft) localStorage.setItem("microassist_v1", JSON.stringify({ version: 1, answers: draft, messages: [{ role: "bot", text: "Synthetic draft" }] }));
    if (strategy) localStorage.setItem("microassist_profile_conflict_strategy", strategy);
    if (pendingAuth) localStorage.setItem("microassist_pending_auth_success", "manual_auth");
    if (!guest) {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const enc = (v) => btoa(JSON.stringify(v)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
      const access_token = `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: user.id, aud: "authenticated", exp })}.fixture`;
      localStorage.setItem("sb-bvymwuokljxgoavfehav-auth-token", JSON.stringify({ access_token, refresh_token: "fixture-refresh", token_type: "bearer", expires_at: exp, expires_in: 3600, user }));
    }
  }, { guest, draft, strategy, user: authUser(A), pendingAuth });
  await page.goto("/");
  if (!guest) await expect(page.getByText("Connectée : first@example.com")).toBeVisible();
  return {
    writes, saves, reads,
    holdReads() { held = true; },
    resolveReads(profile = remote) { remote = profile; readFailed = false; held = false; reads.splice(0).forEach((resolve) => resolve()); },
    fixRead() { readFailed = false; },
    failRead() { readFailed = true; },
    async refresh() { await page.evaluate(async () => { const { supabase } = await import("/src/lib/supabase.js"); const token = (await supabase.auth.getSession()).data.session.access_token; await supabase.auth.setSession({ access_token: token, refresh_token: "fixture-refresh" }); }); },
  };
}

async function changeAccount(page, id) {
  await page.evaluate(async ({ id }) => {
    const { supabase } = await import("/src/lib/supabase.js");
    const enc = (v) => btoa(JSON.stringify(v)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = `${enc({ alg: "HS256", typ: "JWT" })}.${enc({ sub: id, aud: "authenticated", exp })}.fixture`;
    const { error } = await supabase.auth.setSession({ access_token: token, refresh_token: "fixture-refresh" });
    if (error) throw error;
  }, { id });
}

async function wizard(page, date = "2026-06-10") {
  const dialog = page.getByRole("dialog", { name: "Configurer ton profil fiscal" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Services", exact: true }).click();
  await dialog.getByRole("button", { name: "Mensuelle", exact: true }).click();
  await dialog.getByLabel("Début d’activité", { exact: true }).fill(date);
  await dialog.getByRole("button", { name: "Continuer", exact: true }).click();
  await dialog.getByRole("button", { name: "Non concerné", exact: true }).click();
  await dialog.getByRole("button", { name: "Franchise en base", exact: true }).click();
  await dialog.getByRole("button", { name: "Valider", exact: true }).click();
}

async function editWizard(page) {
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await page.locator(".assistantSummaryBox").filter({ has: page.getByRole("heading", { name: "Mon profil", exact: true }) })
    .getByRole("button", { name: "Modifier", exact: true }).click();
}

test("guest completion keeps both actions; account action opens auth and Escape restores the dashboard", async ({ page }) => {
  const h = await startup(page, { guest: true });
  await wizard(page);
  let dialog = page.getByRole("dialog", { name: "Ton espace fiscal est prêt" });
  await expect(dialog.getByRole("button", { name: "Créer mon compte", exact: true })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Continuer sans compte", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await dialog.getByRole("button", { name: "Créer mon compte", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Créer un compte" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await editWizard(page);
  await wizard(page);
  dialog = page.getByRole("dialog", { name: "Ton espace fiscal est prêt" });
  await dialog.getByRole("button", { name: "Continuer sans compte", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(h.writes).toEqual([]);
});

test("signed-in found profile edits show draft/pending feedback until server acknowledgement", async ({ page }) => {
  const h = await startup(page, { draft: { ...DRAFT, business_start_date: REMOTE.business_start_date } });
  await editWizard(page);
  await wizard(page);
  const dialog = page.getByRole("dialog", { name: "Ton profil a été appliqué au brouillon" });
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toContainText("Créer mon compte");
  await expect(dialog).not.toContainText("sans compte");
  await expect(dialog).not.toContainText("temporaires");
  await expect(dialog).not.toContainText("Profil enregistré dans ton compte");
  await expect.poll(() => h.saves.length).toBe(1);
  await expect(dialog).toContainText("en cours");
  h.saves[0]({ error: false });
  await expect(dialog).toContainText("Profil enregistré dans ton compte");
  await expect(dialog).toContainText("Le réglage TVA reste conservé uniquement sur cet appareil");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("signed-in confirmed absence permits wizard completion without signup claims", async ({ page }) => {
  const h = await startup(page, { absent: true });
  await wizard(page);
  const dialog = page.getByRole("dialog", { name: "Ton profil a été appliqué au brouillon" });
  await expect(dialog.getByRole("button", { name: "Retour à mon espace fiscal" })).toBeVisible();
  await expect(dialog).not.toContainText("Créer mon compte");
  await expect.poll(() => h.saves.length).toBe(1);
  h.saves[0]({ error: false });
  await expect(dialog).toContainText("Profil enregistré dans ton compte");
});

test("authentication arriving during guest completion hides stale guest actions while profile reads wait", async ({ page }) => {
  const h = await startup(page, { guest: true });
  await wizard(page);
  h.holdReads();
  await changeAccount(page, A);
  await expect(page.getByText("Connectée : first@example.com")).toBeVisible();
  await expect.poll(() => h.reads.length).toBeGreaterThan(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(h.writes).toEqual([]);
  h.resolveReads(REMOTE);
  await expect(page.getByRole("dialog", { name: "Deux profils différents ont été détectés" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
});

test("failed read exposes retry and never opens completion or writes a replacement", async ({ page }) => {
  const h = await startup(page, { failed: true, pendingAuth: true });
  await expect(page.getByRole("alert")).toContainText("Impossible de charger");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Connexion réussie. Le profil fiscal n’a pas pu être chargé. Réessaie son chargement." })).toBeVisible();
  expect(h.writes).toEqual([]);
  h.fixRead();
  await page.getByRole("button", { name: "Réessayer le chargement du profil" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await editWizard(page);
  await expect(page.getByRole("dialog", { name: "Configurer ton profil fiscal" })).toBeVisible();
});

test("conflict replaces completion; Escape preserves the choice and keep_local retains date precedence", async ({ page }) => {
  const h = await startup(page, { draft: { ...DRAFT, business_start_date: REMOTE.business_start_date } });
  await editWizard(page);
  await wizard(page);
  // A failed read hides completion and releases its scroll lock; retry may reveal a conflict.
  h.failRead();
  await h.refresh();
  await expect(page.getByRole("alert")).toContainText("Impossible de charger");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  h.fixRead();
  await page.getByRole("button", { name: "Réessayer le chargement du profil" }).click();
  const conflict = page.getByRole("dialog", { name: "Deux profils différents ont été détectés" });
  await expect(conflict).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(conflict.getByRole("button", { name: "Utiliser le profil du compte" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(conflict).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(conflict.getByRole("button", { name: "Garder le brouillon local" })).toBeFocused();
  await conflict.getByRole("button", { name: "Garder le brouillon local" }).click();
  const completion = page.getByRole("dialog", { name: "Ton profil a été appliqué au brouillon" });
  await expect(completion).toContainText("2026-06-10");
  await expect(completion).toContainText("Aucune synchronisation avec le compte");
  await page.waitForTimeout(2200);
  expect(h.writes).toEqual([]);
});

test("persisted keep_local retains local/remote date precedence and never saves account profile", async ({ page }) => {
  const h = await startup(page, { draft: DRAFT, strategy: "keep_local" });
  await editWizard(page);
  const input = page.getByRole("dialog").getByLabel("Début d’activité", { exact: true });
  await page.getByRole("dialog").getByRole("button", { name: "Services", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Mensuelle", exact: true }).click();
  await expect(input).toHaveValue("2026-06-10");
  await page.keyboard.press("Escape");
  await editWizard(page);
  await wizard(page);
  await expect(page.getByRole("dialog")).toContainText("Aucune synchronisation avec le compte");
  await page.waitForTimeout(2200);
  expect(h.writes).toEqual([]);
});

test("account transition invalidates open conflict choices until the new account resolves", async ({ page }) => {
  const h = await startup(page, { draft: DRAFT });
  await expect(page.getByRole("dialog", { name: "Deux profils différents ont été détectés" })).toBeVisible();
  h.holdReads();
  await changeAccount(page, B);
  await expect(page.getByText("Connectée : second@example.com")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => h.reads.length).toBeGreaterThan(0);
  expect(h.writes).toEqual([]);
  h.resolveReads({ ...REMOTE, user_id: B });
  await expect(page.getByRole("dialog", { name: "Deux profils différents ont été détectés" })).toBeVisible();
  await page.getByRole("button", { name: "Utiliser le profil du compte" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("account transition also invalidates a signed-in completion without writing its draft to the new account", async ({ page }) => {
  const h = await startup(page, { draft: { ...DRAFT, business_start_date: REMOTE.business_start_date } });
  await editWizard(page);
  await wizard(page);
  await expect(page.getByRole("dialog", { name: "Ton profil a été appliqué au brouillon" })).toBeVisible();
  h.holdReads();
  await changeAccount(page, B);
  await expect(page.getByText("Connectée : second@example.com")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => h.reads.length).toBeGreaterThan(0);
  expect(h.writes).toEqual([]);
  h.resolveReads({ ...REMOTE, user_id: B });
  await expect(page.getByRole("dialog", { name: "Deux profils différents ont été détectés" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
});

test("mobile wizard scrolls, traps focus, restores focus after navigation and keeps background inert", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 360 });
  await startup(page, { guest: true, draft: DRAFT });
  await editWizard(page);
  const dialog = page.getByRole("dialog", { name: "Configurer ton profil fiscal" });
  await expect(dialog.getByRole("button", { name: "Fermer l’onboarding" })).toBeFocused();
  expect(await page.getByRole("button", { name: "Assistant", exact: true }).evaluate((el) => Boolean(el.closest("[inert]")))).toBe(true);
  const overflow = await dialog.evaluate((el) => ({ overflow: getComputedStyle(el.parentElement).overflowY, height: el.parentElement.clientHeight, scrollHeight: el.parentElement.scrollHeight }));
  expect(overflow.overflow).toBe("auto");
  expect(overflow.scrollHeight).toBeGreaterThan(overflow.height);
  await dialog.getByRole("button", { name: "Mixte", exact: true }).scrollIntoViewIfNeeded();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Accueil", exact: true })).toBeFocused();
  expect(await page.getByRole("button", { name: "Assistant", exact: true }).evaluate((el) => Boolean(el.closest("[inert]")))).toBe(false);
});
