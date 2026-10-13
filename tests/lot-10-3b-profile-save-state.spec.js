import { expect, test } from "@playwright/test";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const REMOTE = { user_id: USER_ID, business_status: "micro_entreprise", activity_type: "services", declaration_frequency: "mensuel", tva_mode: "franchise_en_base", acre: "no", acre_start_date: null, business_start_date: "2026-01-01" };
const DRAFT = { entry_status: "micro_yes", status: "auto_entrepreneur", ...REMOTE, activity_type: "commerce" };

async function openSession(page, { guest = false, conflicting = false, strategy = null } = {}) {
  let remote = { ...REMOTE };
  const writes = [];
  const saves = [];
  await page.route("**://*.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/rest/v1/fiscal_profiles") {
      if (request.method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([remote]) });
      } else {
        const payload = request.postDataJSON();
        writes.push(payload);
        const outcome = await new Promise((resolve) => saves.push(resolve));
        if (!outcome.error) remote = { ...payload };
        await route.fulfill({ status: outcome.error ? 503 : 200, contentType: "application/json", body: JSON.stringify(outcome.error ? { message: "test save failed" } : remote) });
      }
      return;
    }
    if (url.pathname === "/rest/v1/profiles" && request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: USER_ID, plan: "free", email: "returning@example.com" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(url.pathname.includes("/rest/v1/") ? [] : {}) });
  });
  await page.addInitScript(({ guest, strategy, draft, userId }) => {
    localStorage.setItem("beta_seen", "1");
    localStorage.setItem("microassist_v1", JSON.stringify({ version: 1, answers: draft, messages: [{ role: "bot", text: "Saved draft" }], savedAt: "2026-01-01T00:00:00Z" }));
    if (strategy) localStorage.setItem("microassist_profile_conflict_strategy", strategy);
    if (!guest) {
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;
      const encode = (v) => btoa(JSON.stringify(v)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
      const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, aud: "authenticated", exp: expiresAt })}.test-signature`;
      localStorage.setItem("sb-bvymwuokljxgoavfehav-auth-token", JSON.stringify({ access_token: token, refresh_token: "test-refresh-token", token_type: "bearer", expires_in: 3600, expires_at: expiresAt, user: { id: userId, email: "returning@example.com", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, identities: [], created_at: "2026-01-01T00:00:00Z" } }));
    }
  }, { guest, strategy, draft: conflicting || guest ? DRAFT : { ...DRAFT, activity_type: "services" }, userId: USER_ID });
  await page.goto("/");
  if (!guest) await expect(page.getByText("Connectée : returning@example.com")).toBeVisible();
  return { writes, saves };
}

async function openProfileEditor(page) {
  await page.getByRole("button", { name: "Mon espace fiscal", exact: true }).click();
  await page.getByRole("button", { name: "Modifier mon profil", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Que veux-tu modifier ?", exact: true })).toBeVisible();
}

async function changeFrequency(page) {
  await page.getByRole("button", { name: "Déclaration", exact: true }).click();
  await page.getByRole("button", { name: "Trimestriel", exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page.getByRole("button", { name: "Appliquer les changements", exact: true }).click();
}

async function storedAnswers(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem("microassist_v1")).answers);
}

test("keep_local choice survives Assistant, profile editor and a deliberate field edit", async ({ page }) => {
  const h = await openSession(page, { conflicting: true });
  await expect(page.getByRole("heading", { name: "Deux profils différents ont été détectés", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Garder le brouillon local", exact: true }).click();
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  expect((await storedAnswers(page)).activity_type).toBe("commerce");
  await openProfileEditor(page);
  expect((await storedAnswers(page)).activity_type).toBe("commerce");
  await changeFrequency(page);
  await expect(page.getByTestId("profile-save-state")).toContainText("Aucune synchronisation avec le compte");
  await expect.poll(async () => (await storedAnswers(page)).declaration_frequency).toBe("trimestriel");
  expect((await storedAnswers(page)).activity_type).toBe("commerce");
  await page.waitForTimeout(2300);
  expect(h.writes).toEqual([]);
});

test("persisted keep_local selection also preserves the draft after a fresh startup", async ({ page }) => {
  const h = await openSession(page, { conflicting: true, strategy: "keep_local" });
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  await openProfileEditor(page);
  expect((await storedAnswers(page)).activity_type).toBe("commerce");
  await expect(page.getByTestId("profile-save-state")).toContainText("Brouillon conservé sur cet appareil");
  await page.waitForTimeout(2300);
  expect(h.writes).toEqual([]);
});

test("account feedback waits for acknowledgement; a failed save preserves the draft and can retry", async ({ page }) => {
  const h = await openSession(page);
  await openProfileEditor(page);
  await changeFrequency(page);
  await expect.poll(() => h.saves.length).toBe(1);
  const status = page.getByTestId("profile-save-state");
  await expect(status).toContainText("en cours");
  await expect(status).not.toContainText("Profil enregistré dans ton compte");
  h.saves[0]({ error: true });
  await expect(status).toContainText("Enregistrement dans le compte impossible");
  await expect(status).toContainText("conservé sur cet appareil");
  expect((await storedAnswers(page)).declaration_frequency).toBe("trimestriel");
  await page.getByRole("button", { name: "Assistant", exact: true }).click();
  expect((await storedAnswers(page)).declaration_frequency).toBe("trimestriel");
  await page.getByRole("button", { name: "Réessayer l’enregistrement du profil", exact: true }).click();
  await expect.poll(() => h.saves.length).toBe(2);
  h.saves[1]({ error: false });
  await expect(status).toContainText("Profil enregistré dans ton compte");
  await openProfileEditor(page);
  expect((await storedAnswers(page)).declaration_frequency).toBe("trimestriel");
});

test("guest edits are locally preserved without an account save", async ({ page }) => {
  const h = await openSession(page, { guest: true });
  await openProfileEditor(page);
  await changeFrequency(page);
  await expect(page.getByTestId("profile-save-state")).toContainText("Aucune synchronisation avec le compte");
  expect((await storedAnswers(page)).declaration_frequency).toBe("trimestriel");
  expect(h.writes).toEqual([]);
});
