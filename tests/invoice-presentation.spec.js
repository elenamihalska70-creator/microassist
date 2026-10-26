import {test,expect} from '@playwright/test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {Buffer} from 'node:buffer';
import process from 'node:process';
const baseline=process.env.INVOICE_PRESENTATION_BASELINE==='1';
const root=process.env.INVOICE_PRESENTATION_REVIEW_DIR||'test-results/invoice-presentation';
const sample=JSON.parse(await readFile('docs/local-invoice-backup/examples/valid.json','utf8'));
const classic={...sample.invoices[0],id:'collision',invoice_number:'LOCAL-CLASSIC',status:'unpaid',paid_at:null};
delete classic.localOnly;
const fx={...sample.invoices[1],id:'synthetic-fx',invoice_number:'LOCAL-FX',invoiceNumber:'LOCAL-FX'};
const remote={...classic,invoice_number:'REMOTE-COLLISION',localOnly:true};
const id='11111111-1111-4111-8111-111111111111';
const fixtures=[{name:'empty',raw:null},{name:'mixed',raw:JSON.stringify([classic,fx])},{name:'legacy',raw:JSON.stringify([classic])},{name:'collision',raw:JSON.stringify([classic,fx]),signedIn:true,remote:[remote]},{name:'invalid',raw:'{invalid'},{name:'unavailable',raw:JSON.stringify([classic]),inaccessible:true},{name:'revenue-warning',raw:null,signedIn:true,revenue:true}];
async function setup(context,f){
 const writes=[],errors=[];let remoteRows=structuredClone(f.remote||[]);
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());if(['127.0.0.1','localhost'].includes(u.hostname))return route.continue();
  if(!['GET','HEAD','OPTIONS'].includes(req.method())){
   writes.push({path:u.pathname,method:req.method(),query:u.search,body:req.postDataJSON()});
   if(u.pathname==='/rest/v1/invoices'&&req.method()==='PATCH')remoteRows=remoteRows.map(row=>({...row,...req.postDataJSON()}));
  }
  const user={id,email:'synthetic@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},identities:[]};
  const body=u.pathname==='/auth/v1/user'?user:u.pathname==='/rest/v1/profiles'?{id,onboarding_completed:true}:u.pathname==='/rest/v1/fiscal_profiles'?{user_id:id,activity_type:'services',declaration_frequency:'mensuel',acre:'no',business_start_date:'2026-01-01'}:u.pathname==='/rest/v1/invoices'?remoteRows:u.pathname==='/rest/v1/revenues'?(f.revenue?[{id:'synthetic-revenue',amount:100,date:'2026-10-01',activity_type:'services'}]:[]):u.pathname.includes('/rest/v1/')?[]:{};
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await context.addInitScript(({f,id})=>{
  const original=Storage.prototype.getItem;
  window.__invoiceRaw=()=>original.call(localStorage,'guest_invoices');
  if(!original.call(localStorage,'presentation_seeded')){
   localStorage.setItem('presentation_seeded','1');localStorage.setItem('beta_seen','1');
   if(f.raw!==null)localStorage.setItem('guest_invoices',f.raw);
   if(f.signedIn){
    const exp=4102444800,enc=v=>btoa(JSON.stringify(v)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
    const user={id,email:'synthetic@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},identities:[]};
    localStorage.setItem('sb-bvymwuokljxgoavfehav-auth-token',JSON.stringify({access_token:`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:id,aud:'authenticated',exp})}.synthetic`,refresh_token:'synthetic-refresh',token_type:'bearer',expires_at:exp,expires_in:3600,user}));localStorage.setItem('microassist_pending_auth_success','manual_auth');
   }
  }
  if(f.inaccessible)Storage.prototype.getItem=function(key){if(key==='guest_invoices')throw new DOMException('Synthetic unavailable','SecurityError');return original.call(this,key);};
 },{f,id});
 return {writes,errors};
}
async function open(page,f){
 await page.goto('/');
 if(f.signedIn){await expect.poll(()=>page.evaluate(()=>localStorage.getItem('microassist_pending_auth_success'))).toBeNull();await expect(page.getByText('Connexion réussie. Le profil fiscal du compte a été chargé.',{exact:true})).toHaveCount(0,{timeout:10000});}
 else{const wizard=page.getByRole('dialog',{name:'Configurer ton profil fiscal'});await expect(wizard).toBeVisible();await wizard.getByRole('button',{name:'Fermer l’onboarding'}).click();}
 await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Factures',exact:true}).click();await expect(page.getByTestId('local-invoice-status')).toBeAttached();
}
const raw=page=>page.evaluate(()=>window.__invoiceRaw());
for(const f of fixtures)test(`invoice presentation ${f.name}`,async({context,page})=>{
 const state=await setup(context,f);page.on('pageerror',e=>state.errors.push(e.message));await page.clock.install({time:new Date('2026-10-26T09:00:00Z')});await open(page,f);
 const section=page.locator('#invoices-section'),cards=section.locator('.revenueItem');
 const snapshot=await cards.evaluateAll(els=>els.map(el=>{
  const norm=s=>s.replace(/\s+/g,' ').trim();
  return {number:el.querySelector('.revenueDate').textContent.trim(),amount:el.querySelector('.revenueAmount').textContent.trim(),badges:[...el.querySelectorAll('.badge')].map(e=>norm(e.textContent)),actions:[...el.querySelectorAll('button')].map(e=>norm(e.textContent)),facts:[...el.querySelectorAll('.revenueMeta > div')].map(e=>norm(e.textContent)).filter(t=>!/^Statut :|^Mention :|^Cet indicateur/.test(t))};
 }));
 const status=await page.getByTestId('local-invoice-status').textContent();expect(await raw(page)).toBe(f.raw);
 await mkdir(root,{recursive:true});
 if(!baseline&&process.env.INVOICE_PRESENTATION_REVIEW_DIR){const before=JSON.parse(await readFile(`${root}/baseline-${f.name}.json`,'utf8'));expect(snapshot).toEqual(before.cards);expect(status).toBe(before.status);expect(await raw(page)).toBe(before.raw);}
 await writeFile(`${root}/${baseline?'baseline':'candidate'}-${f.name}.json`,JSON.stringify({cards:snapshot,status,raw:await raw(page)},null,2));
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000});await section.scrollIntoViewIfNeeded();
  if(!baseline){
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const overflow=await section.locator('button,summary,.badge,.revenueDate').evaluateAll(els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.width>0&&(r.left<-.5||r.right>innerWidth+.5);}).map(el=>el.textContent));expect(overflow).toEqual([]);
   const tools=section.getByRole('region',{name:'Sauvegarde des factures locales'}),main=section.locator('.revenuesList,.emptyRevenueState').first();
   expect(await main.evaluate((el,toolsTop)=>el.getBoundingClientRect().bottom<=toolsTop,await tools.evaluate(el=>el.getBoundingClientRect().top))).toBe(true);
   await expect(section.locator('.journalHeader').getByRole('button',{name:'Créer une facture',exact:true})).toHaveCount(1);
  }
  await section.screenshot({path:`${root}/${baseline?'before':'after'}-${f.name}-${width}.png`});
  if(!baseline){
   const details=section.locator('details.invoiceExplanation');expect(await details.count()).toBe(2);
   for(const disclosure of await details.all()){
    const summary=disclosure.locator('summary');await summary.focus();await page.keyboard.press('Enter');await expect(disclosure).toHaveAttribute('open','');await expect(summary).toBeFocused();await page.keyboard.press('Space');await expect(disclosure).not.toHaveAttribute('open','');await expect(summary).toBeFocused();await expect(disclosure.locator('p').first()).toBeHidden();
   }
   const creation=section.locator('.journalHeader').getByRole('button',{name:'Créer une facture',exact:true});await creation.click();await expect(page.getByLabel('Client *',{exact:true})).toBeVisible();await expect(page.locator('.dashboardMobileActionBar')).toBeHidden();await page.getByRole('button',{name:'Annuler',exact:true}).click();
   expect(await creation.evaluate(el=>el.getBoundingClientRect().height)).toBeLessThan(90);
  }
 }
 if(!baseline&&['invalid','unavailable'].includes(f.name)){
  await expect(page.getByTestId('local-invoice-status')).toBeVisible();
  await section.getByRole('button',{name:'Sauvegarder les factures de cet appareil',exact:true}).click();await expect(section.getByRole('alert')).toBeVisible();expect(await raw(page)).toBe(f.raw);
 }
 if(!baseline&&f.revenue)await expect(section.getByRole('button',{name:'Créer une facture depuis un revenu',exact:true})).toBeVisible();
 if(!baseline&&f.name==='collision'){
  const card=number=>cards.filter({has:page.getByText(`N° ${number}`,{exact:true})});
  await card('LOCAL-CLASSIC').getByRole('button',{name:'Marquer comme payée',exact:true}).click();const paid=JSON.parse(await raw(page));expect(paid[0].status).toBe('paid');expect(paid[0].paid_at).toBeTruthy();expect(paid[1]).toEqual(fx);expect(state.writes.filter(w=>w.path==='/rest/v1/invoices')).toEqual([]);
  await card('REMOTE-COLLISION').getByRole('button',{name:'Marquer comme payée',exact:true}).click();await expect.poll(()=>state.writes.filter(w=>w.path==='/rest/v1/invoices').length).toBe(1);const patch=state.writes.find(w=>w.path==='/rest/v1/invoices');expect(patch.method).toBe('PATCH');expect(patch.query).toContain('id=eq.collision');expect(patch.query).toContain(`user_id=eq.${id}`);expect(await raw(page)).toBe(JSON.stringify(paid));
 }
 if(!baseline){const cta=section.locator('.journalHeader .btnActionPrimary');expect(await cta.evaluate(el=>{const lum=c=>{const x=c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>(v/=255)<=.04045?v/12.92:((v+.055)/1.055)**2.4);return x[0]*.2126+x[1]*.7152+x[2]*.0722;};const s=getComputedStyle(el),a=lum(s.color),b=lum(s.backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);})).toBeGreaterThanOrEqual(4.5);await page.emulateMedia({reducedMotion:'reduce'});expect(await cta.evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');}
 expect(state.writes.filter(w=>w.path==='/rest/v1/invoices'&&w.method==='POST')).toEqual([]);expect(state.errors).toEqual([]);
});

test('explanations never hide restoration preview, confirmation, errors or result',async({context,page})=>{
 test.skip(baseline,'New disclosure presentation only');
 const f=fixtures[0],state=await setup(context,f);page.on('pageerror',e=>state.errors.push(e.message));await open(page,f);
 const section=page.locator('#invoices-section');await section.getByRole('button',{name:'Restaurer une sauvegarde',exact:true}).click();
 const restore=section.getByRole('region',{name:'Restauration locale',exact:true});
 await restore.getByLabel('Fichier de sauvegarde JSON').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(sample))});
 const preview=section.locator('[aria-label="Aperçu de la restauration"]'),confirm=section.getByRole('button',{name:'Confirmer la restauration locale',exact:true});await expect(preview).toBeVisible();await expect(confirm).toBeEnabled();expect(await raw(page)).toBeNull();
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000});
  for(const summary of await section.locator('details.invoiceExplanation > summary').all()){await summary.click();await summary.click();await expect(preview).toBeVisible();await expect(confirm).toBeVisible();}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await restore.screenshot({path:`${root}/restore-preview-${width}.png`});
 }
 await confirm.click();await expect(section.getByRole('status').filter({hasText:'restaurée(s)'})).toBeVisible();expect(JSON.parse(await raw(page))).toEqual(sample.invoices);
 await section.getByRole('button',{name:'Restaurer une sauvegarde',exact:true}).click();await restore.getByLabel('Fichier de sauvegarde JSON').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{bad')});await expect(section.getByRole('alert')).toBeVisible();
 for(const summary of await section.locator('details.invoiceExplanation > summary').all()){await summary.click();await summary.click();await expect(section.getByRole('alert')).toBeVisible();}
 expect(JSON.parse(await raw(page))).toEqual(sample.invoices);expect(state.writes.filter(w=>w.path==='/rest/v1/invoices')).toEqual([]);expect(state.errors).toEqual([]);
});
