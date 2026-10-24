import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";

const mixed = '[ {"id":"classic","invoice_number":"CLASSIC","amount":10}, {"id":"fx","invoice_number":"FX","amount":20,"formatStatus":"facturx_ready_draft","localOnly":true} ]';
async function setup(context, raw = mixed, onProfileRead = () => {}) {
  const attempts = [];
  // No external request may reach a real service, including Supabase.
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (["127.0.0.1", "localhost"].includes(url.hostname)) return route.continue();
    if ((url.pathname === "/rest/v1/invoices" && !["GET","HEAD"].includes(route.request().method())) || (url.pathname.includes("/rpc/") && /invoice|factur/i.test(url.pathname))) attempts.push(url.pathname);
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


import {readFile} from 'node:fs/promises';
const validText=await readFile('docs/local-invoice-backup/examples/valid.json','utf8');
const sample=JSON.parse(validText),[classic,fx]=sample.invoices;
const payload=(text=validText,name='backup.json')=>({name,mimeType:'application/json',buffer:Buffer.from(text)});
async function select(page,text=validText,name='backup.json') {
  const region=page.getByRole('region',{name:'Restauration locale',exact:true});
  if(!await region.isVisible())await page.getByRole('button',{name:'Restaurer une sauvegarde',exact:true}).click();
  await region.getByLabel('Fichier de sauvegarde JSON').setInputFiles(payload(text,name));
  return region;
}
const raw=page=>page.evaluate(()=>localStorage.getItem('guest_invoices'));
const confirm=page=>page.getByRole('button',{name:'Confirmer la restauration locale',exact:true});
const errors=new WeakMap();
test.beforeEach(async({page})=>{const items=[];errors.set(page,items);page.on('pageerror',e=>items.push(e.message));});
test.afterEach(async({page})=>expect(errors.get(page)).toEqual([]));

test('export only local raw invoices, restore in a separate guest context, repeat, reload and download',async({context,page,browser})=>{
 const attempts=await setup(context,JSON.stringify(sample.invoices));
 await context.route('**/rest/v1/invoices*',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:'remote',invoice_number:'REMOTE-NOT-EXPORTED',amount:20}])}):r.fallback());
 await page.goto('/');await openInvoices(page);
 await page.evaluate(()=>{localStorage.setItem('backup_other','protected');localStorage.setItem('revenues_guest','[{"amount":123}]');localStorage.setItem('some_token_key','synthetic-do-not-export');});
 const before=await raw(page);const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'Sauvegarder les factures de cet appareil',exact:true}).click();
 const exported=await readFile(await(await download).path(),'utf8'),data=JSON.parse(exported);
 expect(data.format).toBe('microassist.local-invoices');expect(data.version).toBe(1);expect(data.invoices).toEqual(sample.invoices);
 expect(exported).not.toContain('REMOTE-NOT-EXPORTED');expect(exported).not.toContain('synthetic-do-not-export');expect(exported).not.toContain('access_token');expect(await raw(page)).toBe(before);
 expect(await page.evaluate(()=>localStorage.getItem('revenues_guest'))).toBe('[{"amount":123}]');
 const guest=await browser.newContext();
 try {
  const guestAttempts=await setup(guest,null);await guest.addInitScript(()=>{localStorage.removeItem('sb-bvymwuokljxgoavfehav-auth-token');localStorage.removeItem('microassist_pending_auth_success');});
  const other=await guest.newPage();await other.goto('/');
  const onboarding=other.getByRole('dialog',{name:'Configurer ton profil fiscal'});await onboarding.getByRole('button',{name:'Fermer l’onboarding'}).click();
  await other.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Factures',exact:true}).click();
  await select(other,exported);await expect(other.getByText(/2 ajout\(s\) possible\(s\)/)).toBeVisible();expect(await raw(other)).toBeNull();
  await confirm(other).click();await expect.poll(()=>raw(other).then(JSON.parse)).toEqual(sample.invoices);
  await expect(other.getByTestId('local-invoice-status')).toContainText('restent sur cet appareil');
  await select(other,exported);await expect(other.getByText(/0 ajout\(s\).*2 doublon\(s\)/)).toBeVisible();await expect(confirm(other)).toBeDisabled();
  await other.getByRole('button',{name:'Annuler la restauration',exact:true}).click();
  await other.reload();await onboarding.getByRole('button',{name:'Fermer l’onboarding'}).click();
  await other.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Factures',exact:true}).click();
  const card=other.locator('.revenueItem').filter({hasText:'Brouillon Factur-X'});
  const pdf=other.waitForEvent('download');await card.getByRole('button',{name:'PDF',exact:true}).click();expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/);
  const xml=other.waitForEvent('download');await card.getByRole('button',{name:'XML',exact:true}).click();expect(await readFile(await(await xml).path(),'utf8')).toContain('тест');
  expect(JSON.parse(await raw(other))).toEqual(sample.invoices);expect(guestAttempts).toEqual([]);
 } finally {await guest.close();}
 expect(attempts).toEqual([]);
});

test('preview resolves duplicates/conflicts/refusals without HTML rendering or automatic writes',async({context,page})=>{
 const attempts=await setup(context,JSON.stringify([classic]));await page.goto('/');await openInvoices(page);
 const items=[classic,{...classic,amount:12},fx,fx,{invoice_number:'NO-ID'}, {...classic,id:'unsafe',metadata:JSON.parse('{"__proto__":{"polluted":true}}')}, {...fx,id:'html',invoiceNumber:'<img src=x onerror=alert(1)>'}];
 await select(page,JSON.stringify({...sample,invoices:items}));
 await expect(page.getByText(/2 ajout\(s\).*1 doublon\(s\).*2 conflit\(s\).*2 entrée\(s\)/)).toBeVisible();
 await expect(page.getByText('<img src=x onerror=alert(1)>',{exact:false})).toBeVisible();expect(await page.locator('[aria-label="Aperçu de la restauration"] img').count()).toBe(0);
 await page.getByRole('region',{name:'Sauvegarde des factures locales',exact:true}).screenshot({path:'test-results/local-backup-preview-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('region',{name:'Sauvegarde des factures locales',exact:true}).screenshot({path:'test-results/local-backup-preview-mobile.png'});
 expect(JSON.parse(await raw(page))).toEqual([classic]);await confirm(page).click();
 const stored=JSON.parse(await raw(page));expect(stored[0]).toEqual(classic);expect(stored).toHaveLength(3);expect(attempts).toEqual([]);
});

test('source changed after preview requires renewed confirmation and reconciles another tab',async({context,page})=>{
 const attempts=await setup(context,'[]');await page.goto('/');await openInvoices(page);await select(page);
 const other=await context.newPage();await other.goto('/');
 await other.evaluate(()=>localStorage.setItem('guest_invoices',JSON.stringify([{id:'other-tab',invoice_number:'OTHER-TAB',amount:1}])));
 await expect(page.getByText('N° OTHER-TAB',{exact:true})).toBeVisible();
 await confirm(page).click();await expect(page.getByText(/changé depuis l’aperçu/)).toBeVisible();expect(JSON.parse(await raw(page))).toHaveLength(1);
 await confirm(page).click();await expect.poll(()=>raw(page).then(JSON.parse).then(x=>x.length)).toBe(3);
 await other.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Factures',exact:true}).click();
 await expect(other.getByTestId('local-invoice-status')).toContainText('restent sur cet appareil');expect(JSON.parse(await raw(other))).toHaveLength(3);expect(attempts).toEqual([]);
});

for(const broken of ['invalid-current','inaccessible','quota']) {
 test(`restore blocks safely on ${broken}`,async({context,page})=>{
  const before=broken==='invalid-current'?'{broken':broken==='quota'?JSON.stringify([{id:'kept',invoice_number:'KEPT',amount:1}]):'[]';
  await setup(context,before);
  await context.addInitScript(()=>{
   const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
   Storage.prototype.getItem=function(key){if(key==='guest_invoices'&&window.__backupReadFail)throw Error('synthetic read failure');return get.call(this,key);};
   Storage.prototype.setItem=function(key,value){if(key==='guest_invoices'&&window.__backupWriteFail)throw new DOMException('synthetic quota','QuotaExceededError');return set.call(this,key,value);};
  });
  const downloads=[];page.on('download',d=>downloads.push(d));await page.goto('/');await openInvoices(page);
  if(broken==='inaccessible')await page.evaluate(()=>{window.__backupReadFail=true;});
  if(broken!=='quota'){
   await page.getByRole('button',{name:'Sauvegarder les factures de cet appareil',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();expect(downloads).toEqual([]);
   await select(page);await expect(page.getByRole('alert')).toBeVisible();await expect(confirm(page)).toHaveCount(0);
   await page.evaluate(()=>{window.__backupReadFail=false;});expect(await raw(page)).toBe(broken==='invalid-current'?'{broken':'[]');
  }else{
   await select(page);await page.evaluate(()=>{window.__backupWriteFail=true;});await confirm(page).click();
   await expect(page.getByRole('alert')).toContainText('quota');expect(await raw(page)).toBe(before);await expect(page.getByText('N° KEPT',{exact:true})).toBeVisible();await expect(page.getByText('N° SAME-NUMBER',{exact:true})).toHaveCount(0);
   await page.evaluate(()=>{window.__backupWriteFail=false;});await confirm(page).click();await expect.poll(()=>raw(page).then(JSON.parse).then(x=>x.length)).toBe(3);
  }
 });
}

test('invalid JSON, unsupported version and excessive file are rejected before any write',async({context,page})=>{
 await setup(context,'[]');await page.goto('/');await openInvoices(page);
 for(const text of ['{broken',JSON.stringify({...sample,version:99}),' '.repeat(5*1024*1024+1)]){
  await select(page,text);await expect(page.getByRole('alert')).toBeVisible();await expect(confirm(page)).toHaveCount(0);expect(await raw(page)).toBe('[]');
 }
});

for(const action of ['cancel','auth-transition']) {
 test(`late file read is invalidated by ${action}`,async({context,page})=>{
  const attempts=await setup(context,'[]');
  await context.addInitScript(()=>{
   const original=File.prototype.text;
   File.prototype.text=function(){const file=this;return new Promise((resolve,reject)=>{window.__finishBackupRead=()=>original.call(file).then(resolve,reject);});};
  });
  await page.goto('/');await openInvoices(page);await select(page,validText,'delayed.json');await expect(page.getByText('Lecture de la sauvegarde… Aucune écriture n’est effectuée.')).toBeVisible();
  if(action==='cancel')await page.getByRole('button',{name:'Annuler la restauration',exact:true}).click();
  else{
   await page.evaluate(async()=>{
    const {supabase}=await import('/src/lib/supabase.js');const id='22222222-2222-4222-8222-222222222222',exp=Math.floor(Date.now()/1000)+3600;
    const encode=v=>btoa(JSON.stringify(v)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
    const {error}=await supabase.auth.setSession({access_token:`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:id,aud:'authenticated',role:'authenticated',exp})}.${encode('synthetic-signature')}`,refresh_token:'synthetic-b'});if(error)throw error;
   });
   await expect(page.getByText('Connectée : synthetic-22222222-2222-4222-8222-222222222222@example.test',{exact:true})).toBeVisible();await openInvoices(page);
  }
  await expect(page.getByRole('region',{name:'Restauration locale',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Restaurer une sauvegarde',exact:true}).click();
  await page.evaluate(async()=>{await window.__finishBackupRead();await new Promise(r=>setTimeout(r,0));});
  await expect(page.getByRole('heading',{name:'Aperçu de la restauration',exact:true})).toHaveCount(0);expect(await raw(page)).toBe('[]');await expect(confirm(page)).toHaveCount(0);expect(attempts).toEqual([]);
 });
}
