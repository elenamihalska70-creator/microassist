import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";

const mixed = '[ {"id":"classic","invoice_number":"CLASSIC","amount":10}, {"id":"fx","invoice_number":"FX","amount":20,"formatStatus":"facturx_ready_draft","localOnly":true} ]';
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


import process from 'node:process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const artifactDir = process.env.PDF_ARTIFACT_DIR || 'test-results/invoice-pdf-artifacts';
async function syntheticSellerEmail(page) {
  // Keep review artifacts wholly synthetic, regardless of local .env seller defaults.
  await page.route('**/src/components/InvoiceGenerator.jsx*', async route => {
    const response = await route.fetch();
    const source = await response.text();
    expect(source).toMatch(/const SELLER_EMAIL = [^\n]+/);
    await route.fulfill({ response, body: source.replace(/const SELLER_EMAIL = [^\n]+/, 'const SELLER_EMAIL = "elodie@example.test";') });
  });
}
const fixtures = {
  short: { invoiceNumber: 'UNICODE-COURT', issueDate: '2026-10-23', dueDate: '2026-11-23',
    seller: {name:'Élodie François',email:'elodie@example.test',address:'10 rue de la République, Besançon',siret:'12345678901234'},
    buyer: {name:'тест\nТестовий клієнт — Київ, ї є ґ і',address:'тест',email:'synthetic@example.test'},
    lines:[{description:'тест — Élodie François',quantity:1,unitPrice:9.96,totalHT:9.96,totalTVA:0,totalTTC:9.96,vatRate:0}],
    totals:{totalHT:9.96,totalTVA:0,totalTTC:9.96} },
};
fixtures.long = structuredClone(fixtures.short);
fixtures.long.invoiceNumber = 'UNICODE-LONG';
fixtures.long.seller.name = 'Élodie François ' .repeat(18);
fixtures.long.buyer.name += '\n' + 'Довге ім’я клієнта з Києва '.repeat(16);
fixtures.long.seller.address = Array.from({length:55},(_,i)=>`Adresse vendeur ${i+1} — République, Besançon`).join('\n');
fixtures.long.buyer.address = Array.from({length:65},(_,i)=>`Адреса ${i+1} — тест, Київ, ї є ґ і`).join('\n');
fixtures.long.lines[0].description = Array.from({length:130},(_,i)=>`Prestation ${i+1} — тест — Élodie François`).join('\n')+'\n'+'БЕЗПРОБІЛІВ'.repeat(20)+'\nFIN-DESCRIPTION';

for (const [name, invoice] of Object.entries(fixtures)) {
  test(`synthetic PDF and XML ${name}`, async ({context,page}) => {
    const attempts=await setup(context,'[]');
    await syntheticSellerEmail(page);
    await page.goto('/');
    const downloadPromise=page.waitForEvent('download');
    await page.evaluate(async invoice=>{
      const {generateB2CInvoicePdf}=await import('/src/components/InvoiceGenerator.jsx');
      generateB2CInvoicePdf(invoice);
    },invoice);
    await mkdir(artifactDir,{recursive:true});
    await (await downloadPromise).saveAs(`${artifactDir}/${name}.pdf`);
    const xml=await page.evaluate(async invoice=>(await import('/src/utils/facturx.js')).generateFacturXXml(invoice),invoice);
    await writeFile(`${artifactDir}/${name}.xml`,xml);
    await writeFile(`${artifactDir}/${name}.json`,JSON.stringify(invoice,null,2));
    expect(xml).toContain('тест');expect(xml).toContain('Élodie François');expect(attempts).toEqual([]);
  });
}

test('Unicode creation and list redownload preserve PDF/XML and local invoice data',async({context,page})=>{
  const attempts=await setup(context,'[]');
  await syntheticSellerEmail(page);
  const fontRequests=[];
  page.on('request',r=>{if(/\.ttf|fonts\.google|fonts\.gstatic/.test(r.url()) && !['127.0.0.1','localhost'].includes(new URL(r.url()).hostname))fontRequests.push(r.url());});
  await page.goto('/');await openInvoices(page);
  await page.getByRole('button',{name:'Créer une facture',exact:true}).first().click();
  await page.getByLabel('Client *',{exact:true}).fill('Тестовий клієнт — Київ, ї є ґ і');
  await page.getByLabel('Adresse client',{exact:true}).fill('тест');
  await page.getByLabel('Prestation *',{exact:true}).fill('тест — Élodie François');
  await page.getByLabel('Prix unitaire HT (€) *',{exact:true}).fill('9.96');
  await page.getByLabel('SIRET vendeur',{exact:true}).fill('12345678901234');
  await page.getByLabel('Raison sociale vendeur',{exact:true}).fill('Élodie François');
  await page.getByLabel('Adresse vendeur',{exact:true}).fill('10 rue de la République, Besançon');
  const downloads=[];page.on('download',d=>downloads.push(d));
  await page.getByRole('button',{name:'Créer facture compatible 2026',exact:true}).click();
  await expect.poll(()=>downloads.length).toBe(2);
  await mkdir(artifactDir,{recursive:true});
  await downloads.find(d=>d.suggestedFilename().endsWith('.pdf')).saveAs(`${artifactDir}/created.pdf`);
  const xmlDownload=downloads.find(d=>d.suggestedFilename().endsWith('.xml'));
  await xmlDownload.saveAs(`${artifactDir}/created.xml`);
  const raw=await page.evaluate(()=>localStorage.getItem('guest_invoices'));
  const [invoice]=JSON.parse(raw);
  expect(invoice.buyer.name).toBe('Тестовий клієнт — Київ, ї є ґ і');
  expect(invoice.buyer.address).toBe('тест');expect(invoice.localOnly).toBe(true);
  const card=page.locator('.revenueItem').filter({has:page.getByText(`N° ${invoice.invoice_number}`,{exact:true})});
  const pdfAgain=page.waitForEvent('download');await card.getByRole('button',{name:'PDF',exact:true}).click();
  await(await pdfAgain).saveAs(`${artifactDir}/list.pdf`);
  const xmlAgain=page.waitForEvent('download');await card.getByRole('button',{name:'XML',exact:true}).click();
  await(await xmlAgain).saveAs(`${artifactDir}/list.xml`);
  expect(await page.evaluate(()=>localStorage.getItem('guest_invoices'))).toBe(raw);
  expect(await readFile(`${artifactDir}/list.xml`,'utf8')).toBe(await readFile(`${artifactDir}/created.xml`,'utf8'));
  expect(fontRequests).toEqual([]);expect(attempts).toEqual([]);
});

test('unsupported glyph fails explicitly instead of silently substituting text', async ({context,page}) => {
  await setup(context,'[]'); await syntheticSellerEmail(page); await page.goto('/');
  const error = await page.evaluate(async invoice => {
    try { (await import('/src/components/InvoiceGenerator.jsx')).generateB2CInvoicePdf(invoice); }
    catch (error) { return error.message; }
  }, {...fixtures.short, buyer:{name:'🙂'}});
  expect(error).toContain('U+1F642');
});
