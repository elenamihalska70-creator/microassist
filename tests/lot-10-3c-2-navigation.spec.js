import { expect, test } from "@playwright/test";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE = { user_id: USER_ID, business_status: "micro_entreprise", activity_type: "services", declaration_frequency: "mensuel", tva_mode: "franchise_en_base", acre: "no", acre_start_date: null, business_start_date: "2026-01-01" };
const ANSWERS = { entry_status: "micro_yes", status: "auto_entrepreneur", activity_type: "services", declaration_frequency: "mensuel", acre: "no", business_start_date: "2026-01-01" };

async function startup(page, { authenticated = false, url = "/" } = {}) {
  const writes = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**://*.supabase.co/**", async (route) => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (!["GET", "OPTIONS"].includes(request.method())) writes.push(path);
    const data = path === "/rest/v1/fiscal_profiles" ? [PROFILE]
      : path === "/rest/v1/profiles" ? { id: USER_ID, email: "navigation@example.com", plan: "free" }
      : path.includes("/rest/v1/") ? [] : {};
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
  await page.addInitScript(({ authenticated, answers, userId }) => {
    localStorage.setItem("beta_seen", "1");
    // A saved view still must not override the existing landing-first reload policy.
    localStorage.setItem("microassist_v1", JSON.stringify({ version: 1, answers, appView: "pricing", messages: [{ role: "bot", text: "Synthetic navigation fixture" }] }));
    if (authenticated) {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const encode = (v) => btoa(JSON.stringify(v)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
      const access_token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, aud: "authenticated", exp })}.fixture`;
      const user = { id: userId, email: "navigation@example.com", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, identities: [], created_at: "2026-01-01T00:00:00Z" };
      localStorage.setItem("sb-bvymwuokljxgoavfehav-auth-token", JSON.stringify({ access_token, refresh_token: "fixture-refresh", token_type: "bearer", expires_at: exp, expires_in: 3600, user }));
    }
  }, { authenticated, answers: ANSWERS, userId: USER_ID });
  await page.goto(url);
  try {
    await expect(page.locator(".topbar")).toBeVisible();
  } catch (error) {
    throw new Error(errors.join("\n") || error.message);
  }
  expect(errors).toEqual([]);
  if (authenticated) await expect(page.getByText("Connectée : navigation@example.com")).toBeVisible();
  return writes;
}

const nav = (page) => page.getByRole("navigation", { name: "Navigation principale" });
async function current(page, label) {
  await expect(nav(page).locator('[aria-current="location"]')).toHaveCount(1);
  await expect(nav(page).getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-current", "location");
  await expect(nav(page).locator(".isCurrent")).toHaveCount(1);
}
async function click(page, label) { await nav(page).getByRole("button", { name: label, exact: true }).click(); }

test("landing-first startup and all six destinations have exactly one active item; pricing is neutral outside pricing", async ({ page }) => {
  await startup(page);
  await current(page, "Accueil");
  for (const label of ["Services", "Assistant", "Mon espace fiscal", "Factures", "Tarifs", "Accueil"]) {
    await click(page, label);
    await current(page, label);
  }
  const pricing = nav(page).getByRole("button", { name: "Tarifs", exact: true });
  await expect(pricing).toHaveClass("navLink");
  const backgrounds = await nav(page).evaluate((el) => {
    const buttons = Array.from(el.querySelectorAll("button"));
    return ["Services", "Tarifs"].map((label) => getComputedStyle(buttons.find((b) => b.textContent.trim() === label)).backgroundColor);
  });
  expect(backgrounds[0]).toBe(backgrounds[1]);
  await click(page, "Tarifs");
  await expect(page.locator(".appStatusBadge")).toHaveText("Tarifs");
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
  await current(page, "Accueil");
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("microassist_v1")).appView)).toBe("landing");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("microassist_v1")));
  expect(stored).not.toHaveProperty("navigationLocation");
  expect(stored).not.toHaveProperty("section");
});

test("header/footer invoices agree on destination while their existing history behavior is preserved", async ({ page }) => {
  await startup(page);
  await click(page, "Mon espace fiscal");
  const length = await page.evaluate(() => history.length);
  await click(page, "Factures");
  await current(page, "Factures");
  expect(await page.evaluate(() => history.length)).toBe(length);
  await page.getByRole("navigation", { name: "Liens produit" }).getByRole("link", { name: "Factures", exact: true }).click();
  await current(page, "Factures");
  expect(await page.evaluate(() => history.length)).toBe(length + 1);
  expect(await page.evaluate(() => history.state)).toEqual({ appView: "dashboard" });
  // History has no invoice target metadata: Back/Forward retain the legacy dashboard default.
  await page.goBack();
  await current(page, "Mon espace fiscal");
  await page.goForward();
  await current(page, "Mon espace fiscal");
  expect(new URL(page.url()).pathname).toBe("/");
});

test("profile editing and completion select their actual views while restored focus remains independent", async ({ page }) => {
  await startup(page);
  await click(page, "Mon espace fiscal");
  await page.getByRole("button", { name: "Modifier mon profil", exact: true }).click();
  await current(page, "Assistant");
  await click(page, "Assistant");
  await page.locator(".assistantSummaryBox").filter({ has: page.getByRole("heading", { name: "Mon profil", exact: true }) })
    .getByRole("button", { name: "Modifier", exact: true }).click();
  await current(page, "Assistant");
  const wizard = page.getByRole("dialog", { name: "Configurer ton profil fiscal" });
  await wizard.getByRole("button", { name: "Services", exact: true }).click();
  await wizard.getByRole("button", { name: "Mensuelle", exact: true }).click();
  await wizard.getByLabel("Début d’activité", { exact: true }).fill("2026-01-01");
  await wizard.getByRole("button", { name: "Continuer", exact: true }).click();
  await wizard.getByRole("button", { name: "Non concerné", exact: true }).click();
  await wizard.getByRole("button", { name: "Franchise en base", exact: true }).click();
  await wizard.getByRole("button", { name: "Valider", exact: true }).click();
  await current(page, "Mon espace fiscal");
  await page.getByRole("dialog", { name: "Ton espace fiscal est prêt" }).getByRole("button", { name: "Continuer sans compte" }).click();
  await current(page, "Mon espace fiscal");
  const home = nav(page).getByRole("button", { name: "Accueil", exact: true });
  await expect(home).toBeFocused();
  await expect(home).not.toHaveAttribute("aria-current");
});

test("a revenue overlay retains fiscal identity on open and close", async ({ page }) => {
  const writes = await startup(page);
  await click(page, "Mon espace fiscal");
  await page.locator(".dashboardQuickActionsList").getByRole("button", { name: "+ Ajouter un revenu", exact: true }).click();
  await current(page, "Mon espace fiscal");
  const dialog = page.getByRole("dialog", { name: "Ajouter revenu" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
  await expect(dialog).toBeHidden();
  await current(page, "Mon espace fiscal");
  expect(writes).toEqual([]);
});

test("mobile wrapping and native keyboard activation retain a distinct visible focus indicator", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startup(page);
  await nav(page).getByRole("button", { name: "Services", exact: true }).focus();
  await page.keyboard.press("Enter");
  await current(page, "Services");
  await page.keyboard.press("Tab");
  const assistant = nav(page).getByRole("button", { name: "Assistant", exact: true });
  await expect(assistant).toBeFocused();
  expect(await assistant.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Space");
  await current(page, "Assistant");
  expect(await nav(page).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("view history and null-entry limitation remain unchanged; reload returns to home", async ({ page }) => {
  await startup(page);
  expect(await page.evaluate(() => history.state)).toBeNull();
  await click(page, "Assistant");
  await click(page, "Tarifs");
  await page.goBack();
  await current(page, "Assistant");
  await page.goBack();
  // The original entry has no appView, so the existing handler leaves the view unchanged.
  await current(page, "Assistant");
  await page.reload();
  await current(page, "Accueil");
});

test("authenticated restoration remains landing-first and navigation does not write profile data", async ({ page }) => {
  const writes = await startup(page, { authenticated: true });
  await current(page, "Accueil");
  await click(page, "Mon espace fiscal");
  await current(page, "Mon espace fiscal");
  await click(page, "Accueil");
  await current(page, "Accueil");
  await page.waitForTimeout(2300);
  expect(writes.filter((path) => ["/rest/v1/fiscal_profiles", "/rest/v1/profiles"].includes(path))).toEqual([]);
});

for (const [view, label] of [["assistant", "Assistant"], ["dashboard", "Mon espace fiscal"], ["pricing", "Tarifs"]]) {
  test(`supported ${view} deep link keeps its existing behavior and selects the matching menu item`, async ({ page }) => {
    await startup(page, { url: `/?view=${view}` });
    await current(page, label);
    expect(new URL(page.url()).search).toBe("");
    expect(await page.evaluate(() => history.state)).toEqual({ appView: view });
  });
}
