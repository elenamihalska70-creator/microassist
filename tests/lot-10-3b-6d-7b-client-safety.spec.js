import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";

const key = "guest_invoices";
const mixed = '[ {"id":"classic","invoice_number":"CLASSIC","amount":10}, {"id":"fx","invoice_number":"FX","amount":20,"formatStatus":"facturx_ready_draft","localOnly":true} ]';
const message = "Tes factures restent sur cet appareil et n’ont pas été importées dans ton compte.";
async function setup(context, raw = mixed, onProfileRead = () => {}) {
  const attempts = [];
  // No external request may reach a real service, including Supabase.
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (["127.0.0.1", "localhost"].includes(url.hostname)) return route.continue();
    if (url.pathname === "/rest/v1/invoices" && route.request().method() === "POST") attempts.push(url.pathname);
    const authorization = route.request().headers().authorization;
    const claims = authorization?.split(".")[1];
    const id = claims ? JSON.parse(Buffer.from(claims, "base64url").toString()).sub : "11111111-1111-4111-8111-111111111111";
    if (url.pathname === "/rest/v1/fiscal_profiles") onProfileRead(id);
    const body = url.pathname === "/auth/v1/user" ? { id, email: `synthetic-${id}@example.test`, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, identities: [], created_at: "2026-01-01T00:00:00Z" }
      : url.pathname === "/rest/v1/profiles" ? { id, onboarding_completed: true }
      : url.pathname === "/rest/v1/fiscal_profiles" ? { user_id: id, activity_type: "services", declaration_frequency: "mensuel", acre: "no", business_start_date: "2026-01-01" }
      : url.pathname.includes("/rest/v1/") ? [] : {};
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await context.addInitScript(({ raw }) => {
    // Preserve modifications across reload and between pages in this context.
    if (!localStorage.getItem("synthetic_seeded")) {
      localStorage.setItem("synthetic_seeded", "1");
      if (raw !== null) localStorage.setItem("guest_invoices", raw);
      localStorage.setItem("beta_seen", "1");
      localStorage.setItem("microassist_pending_auth_success", "manual_auth");
      const id = "11111111-1111-4111-8111-111111111111", exp = Math.floor(Date.now() / 1000) + 3600;
      const encode = value => btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
      const user = { id, email: "synthetic@example.com", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, identities: [], created_at: "2026-01-01T00:00:00Z" };
      localStorage.setItem("sb-bvymwuokljxgoavfehav-auth-token", JSON.stringify({ access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, aud: "authenticated", exp })}.synthetic`, refresh_token: "synthetic-refresh", token_type: "bearer", expires_in: 3600, expires_at: exp, user }));
    }
  }, { raw });
  return attempts;
}
async function openInvoices(page) {
  await expect.poll(() => page.evaluate(() => localStorage.getItem("microassist_pending_auth_success"))).toBeNull();
  await expect(page.getByRole("button", { name: "Déconnexion", exact: true })).toBeVisible();
  const onboarding = page.getByRole("dialog", { name: "Configurer ton profil fiscal" });
  if (await onboarding.isVisible()) await onboarding.getByRole("button", { name: "Fermer l’onboarding" }).click();
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("button", { name: "Factures", exact: true }).click();
  await expect(page.getByTestId("local-invoice-status")).toBeAttached();
}

async function holdInitialAuthentication(context, page) {
  await context.addInitScript(() => {
    window.__authGate = new Promise(resolve => { window.__releaseAuth = resolve; });
  });
  await page.route("**/src/context/AuthContext.jsx*", async route => {
    const response = await route.fetch();
    const source = await response.text();
    expect(source).toContain("await supabase.auth.getSession()");
    await route.fulfill({ response, body: source.replace("await supabase.auth.getSession()", "(await window.__authGate, await supabase.auth.getSession())")
      .replace("setSession(nextSession ?? null);", "window.__authGate.then(() => setSession(nextSession ?? null));")
      .replaceAll("setLoading(false);", "window.__authGate.then(() => setLoading(false));") });
  });
}

async function downloadBytes(download) {
  const stream = await download.createReadStream();
  expect(stream).not.toBeNull();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

test("SDK SIGNED_IN notification switches mounted account A to B without reload", async ({ context, page }) => {
  const accountsRead = [];
  const attempts = await setup(context, mixed, id => accountsRead.push(id));
  await page.goto("/");
  await openInvoices(page);
  await expect(page.getByText("N° CLASSIC", { exact: true })).toBeVisible();
  await expect(page.getByText("N° FX", { exact: true })).toBeVisible();
  const mountedDocument = await page.evaluateHandle(() => document);
  let navigations = 0;
  page.on("framenavigated", frame => { if (frame === page.mainFrame()) navigations++; });
  const result = await page.evaluate(async () => {
    // Public API of the same singleton used by AuthProvider. No React setters,
    // localStorage-only event simulation, reload, or replacement app root.
    const { supabase } = await import("/src/lib/supabase.js");
    const id = "22222222-2222-4222-8222-222222222222";
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const encode = value => btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    const events = [];
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") events.push({ event, id: session?.user.id });
    });
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, aud: "authenticated", role: "authenticated", exp })}.${encode("synthetic-signature")}`,
        refresh_token: "synthetic-account-b-refresh",
      });
      return { id: data.user?.id, error: error?.message ?? null, events };
    } finally { subscription.unsubscribe(); }
  });
  expect(result).toEqual({ id: "22222222-2222-4222-8222-222222222222", error: null,
    events: [{ event: "SIGNED_IN", id: "22222222-2222-4222-8222-222222222222" }] });
  await expect(page.getByText("Connectée : synthetic-22222222-2222-4222-8222-222222222222@example.test", { exact: true })).toBeVisible();
  await expect.poll(() => accountsRead.includes("22222222-2222-4222-8222-222222222222")).toBe(true);
  await openInvoices(page);
  await expect(page.getByText("N° CLASSIC", { exact: true })).toBeVisible();
  await expect(page.getByText("N° FX", { exact: true })).toBeVisible();
  await expect(page.getByTestId("local-invoice-status")).toHaveText(message);
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(mixed);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).every(invoice => !Object.hasOwn(invoice, "user_id")), key)).toBe(true);
  expect(await mountedDocument.evaluate(original => original === document)).toBe(true);
  expect(navigations).toBe(0);
  expect(attempts).toEqual([]);
});

test("login, repeated login, reload, shared tabs and account transition preserve local invoices", async ({ context, page }) => {
  const accountsRead = [];
  const attempts = await setup(context, mixed, id => accountsRead.push(id));
  await page.goto("/");
  await openInvoices(page);
  const notice = page.getByTestId("local-invoice-status");
  await expect(notice).toHaveText(message);
  await expect(notice).toHaveAttribute("role", "status");
  await expect(notice).toHaveAttribute("aria-live", "polite");
  await expect(page.getByRole("button", { name: "Créer une facture", exact: true }).first()).toBeVisible();
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("button", { name: "Mon espace fiscal", exact: true }).click();
  await openInvoices(page);
  await expect(notice).toHaveText(message);
  await page.reload();
  await openInvoices(page);
  await expect(notice).toHaveText(message);
  const other = await context.newPage(); await other.goto("/"); await openInvoices(other);
  await expect(other.getByTestId("local-invoice-status")).toHaveText(message);
  await page.evaluate(() => {
    localStorage.setItem("microassist_pending_auth_success", "second-login");
    const authKey = "sb-bvymwuokljxgoavfehav-auth-token";
    const session = JSON.parse(localStorage.getItem(authKey));
    session.user.id = "22222222-2222-4222-8222-222222222222";
    const encode = value => btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    session.access_token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: session.user.id, aud: "authenticated", exp: session.expires_at })}.synthetic`;
    localStorage.setItem(authKey, JSON.stringify(session));
  });
  await page.reload();
  await openInvoices(page);
  await expect.poll(() => accountsRead.includes("22222222-2222-4222-8222-222222222222")).toBe(true);
  await expect(notice).toHaveText(message);
  await expect(page.getByText("N° CLASSIC", { exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(mixed);
  expect(await other.evaluate(key => localStorage.getItem(key), key)).toBe(mixed);
  expect(attempts).toEqual([]);
});
test("storage updates change the notice without moving focus or assigning ownership", async ({ context, page }) => {
  const attempts = await setup(context);
  await page.goto("/");
  await openInvoices(page);
  const notice = page.getByTestId("local-invoice-status");
  await expect(notice).toHaveText(message);
  const navigation = page.getByRole("navigation", { name: "Navigation principale" });
  const button = navigation.getByRole("button", { name: "Factures", exact: true });
  await button.focus();
  const other = await context.newPage(); await other.goto("/");
  await other.evaluate(() => localStorage.setItem("guest_invoices", "[]"));
  await expect(notice).toHaveText("");
  await expect(page.getByText("N° CLASSIC", { exact: true })).toHaveCount(0);
  expect(await button.evaluate(node => node === document.activeElement)).toBe(true);
  await other.evaluate(raw => localStorage.setItem("guest_invoices", raw), mixed);
  await expect(notice).toHaveText(message);
  await expect(page.getByText("N° CLASSIC", { exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(mixed);
  await navigation.getByRole("button", { name: "Mon espace fiscal", exact: true }).click();
  await other.evaluate(() => localStorage.setItem("guest_invoices", "[]"));
  await openInvoices(page);
  await expect(notice).toHaveText("");
  await expect(page.getByText("N° CLASSIC", { exact: true })).toHaveCount(0);
  expect(attempts).toEqual([]);
});
test("local Factur-X creation still produces a draft and downloads", async ({ context, page }) => {
  const attempts = await setup(context, "[]");
  await page.goto("/");
  await openInvoices(page);
  await page.getByRole("button", { name: "Créer une facture", exact: true }).first().click();
  await page.getByLabel("Client *", { exact: true }).fill("Synthetic buyer");
  await page.getByLabel("Prestation *", { exact: true }).fill("Synthetic service");
  await page.getByLabel("Prix unitaire HT (€) *", { exact: true }).fill("10");
  await page.getByLabel("SIRET vendeur", { exact: true }).fill("12345678901234");
  await expect(page.getByLabel("Client *", { exact: true })).toHaveValue("Synthetic buyer");
  await expect(page.getByLabel("Prestation *", { exact: true })).toHaveValue("Synthetic service");
  await expect(page.getByLabel("Prix unitaire HT (€) *", { exact: true })).toHaveValue("10");
  const downloads = [];
  page.on("download", download => downloads.push(download));
  await page.getByRole("button", { name: "Créer facture compatible 2026", exact: true }).click();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("guest_invoices"))).then(items => items.length)).toBe(1);
  const [invoice] = await page.evaluate(() => JSON.parse(localStorage.getItem("guest_invoices")));
  expect(invoice.formatStatus).toBe("facturx_ready_draft");
  expect(invoice.localOnly).toBe(true);
  expect(invoice.user_id).toBeUndefined();
  await expect.poll(() => downloads.length).toBe(2);
  const pdfDownload = downloads.find(download => download.suggestedFilename().endsWith(".pdf"));
  const xmlDownload = downloads.find(download => download.suggestedFilename().endsWith(".xml"));
  expect(pdfDownload).toBeDefined();
  expect(xmlDownload).toBeDefined();
  const pdf = await downloadBytes(pdfDownload);
  const xml = await downloadBytes(xmlDownload);
  expect(pdf.length).toBeGreaterThan(5);
  expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  expect(xml.length).toBeGreaterThan(0);
  const parsed = await page.evaluate(text => {
    const document = new DOMParser().parseFromString(text, "application/xml");
    const element = (parent, name) => parent?.getElementsByTagNameNS("*", name)[0];
    const value = (parent, name) => element(parent, name)?.textContent;
    const totals = element(document, "SpecifiedTradeSettlementHeaderMonetarySummation");
    return {
      errors: document.getElementsByTagName("parsererror").length,
      root: document.documentElement.localName,
      number: value(element(document, "ExchangedDocument"), "ID"),
      buyer: value(element(document, "BuyerTradeParty"), "Name"),
      lineTotal: value(totals, "LineTotalAmount"), tax: value(totals, "TaxTotalAmount"),
      grandTotal: value(totals, "GrandTotalAmount"), due: value(totals, "DuePayableAmount"),
    };
  }, xml.toString("utf8"));
  // Content smoke checks only: no Factur-X or PDF/A-3 certification claim.
  expect(parsed).toEqual({ errors: 0, root: "CrossIndustryInvoice", number: invoice.invoice_number,
    buyer: "Synthetic buyer", lineTotal: "10.00", tax: "0.00", grandTotal: "10.00", due: "10.00" });
  await expect(page.getByTestId("local-invoice-status")).toHaveText(message);
  expect(attempts).toEqual([]);
});
test("early invoice entry cannot open a form that the initial account transition would discard", async ({ context, page }) => {
  const attempts = await setup(context, "[]");
  await holdInitialAuthentication(context, page);
  await page.goto("/");
  await page.getByRole("button", { name: "Créer une facture", exact: true }).first().click();
  await expect(page.getByText("La connexion est en cours. Réessaie dans un instant.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Client *", { exact: true })).toHaveCount(0);
  await page.evaluate(() => window.__releaseAuth());
  await openInvoices(page);
  await page.getByRole("button", { name: "Créer une facture", exact: true }).first().click();
  await page.getByLabel("Client *", { exact: true }).fill("Synthetic early-entry buyer");
  await expect(page.getByLabel("Client *", { exact: true })).toHaveValue("Synthetic early-entry buyer");
  expect(await page.evaluate(() => localStorage.getItem("guest_invoices"))).toBe("[]");
  expect(attempts).toEqual([]);
});
test("latest-revenue invoice entry respects real pending authentication then opens a usable prefilled form", async ({ context, page }) => {
  const attempts = await setup(context, "[]");
  await context.addInitScript(() => localStorage.setItem("revenues_guest", JSON.stringify([
    { id: "synthetic-revenue", amount: 42, date: "2026-01-01", client: "Synthetic revenue buyer", note: "Synthetic revenue service" },
  ])));
  await context.route("**/rest/v1/revenues*", route => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify(route.request().method() === "GET" ? [
      { id: "synthetic-revenue", user_id: "11111111-1111-4111-8111-111111111111", amount: 42, revenue_date: "2026-01-01", client: "Synthetic revenue buyer", note: "Synthetic revenue service" },
    ] : []) }));
  await holdInitialAuthentication(context, page);
  await page.goto("/");
  await page.getByRole("navigation", { name: "Navigation principale" }).getByRole("button", { name: "Factures", exact: true }).click();
  const action = page.getByRole("button", { name: "Créer une facture depuis un revenu", exact: true });
  await expect(action).toBeVisible();
  await action.click();
  await expect(page.getByRole("status").getByText("La connexion est en cours. Réessaie dans un instant.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Client *", { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("microassist_pending_auth_success"))).toBe("manual_auth");
  await page.evaluate(() => window.__releaseAuth());
  await openInvoices(page);
  await expect(action).toBeVisible();
  await action.click();
  const client = page.getByLabel("Client *", { exact: true });
  await expect(client).toHaveValue("Synthetic revenue buyer");
  await expect(page.getByLabel("Prestation *", { exact: true })).toHaveValue("Synthetic revenue service");
  await expect(page.getByLabel("Prix unitaire HT (€) *", { exact: true })).toHaveValue("42");
  await client.fill("Synthetic edited buyer");
  await expect(client).toHaveValue("Synthetic edited buyer");
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe("[]");
  expect(attempts).toEqual([]);
});
for (const [raw, text] of [["{invalid", "Les données locales de factures n’ont pas pu être lues. Elles n’ont pas été importées. Ne réinitialise pas les données de cet appareil."], ["[]", ""]]) {
  test(`durable notice for ${raw}`, async ({ context, page }) => {
    const attempts = await setup(context, raw);
    await page.goto("/");
  await openInvoices(page);
    await expect(page.getByTestId("local-invoice-status")).toHaveText(text);
    await page.reload();
    await openInvoices(page);
    await expect(page.getByTestId("local-invoice-status")).toHaveText(text);
    expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(raw);
    expect(attempts).toEqual([]);
  });
}
test("inaccessible invoice storage has an honest status", async ({ context, page }) => {
  const attempts = await setup(context);
  await context.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) { if (key === "guest_invoices") throw Error("synthetic storage"); return get.call(this, key); };
  });
  await page.goto("/");
  await openInvoices(page);
  await expect(page.getByTestId("local-invoice-status")).toHaveText("L’accès aux factures de cet appareil est indisponible. Aucun import automatique n’est effectué.");
  expect(attempts).toEqual([]);
});
