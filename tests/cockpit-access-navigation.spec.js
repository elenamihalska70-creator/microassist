import {test,expect} from '@playwright/test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import process from 'node:process';
import {installOfflineSockets} from './support/offline-services.js';
const baseline=process.env.ACCESS_NAV_BASELINE==='1';
const root=process.env.ACCESS_NAV_REVIEW_DIR || 'test-results/access-navigation';
const id='11111111-1111-4111-8111-111111111111';
const fiscal={user_id:id,activity_type:'services',declaration_frequency:'mensuel',acre:'no',business_start_date:'2026-01-01'};
const invoice={id:'synthetic-preserved',invoice_number:'SYNTHETIC',amount:10,client_name:'Client synthétique'};
const fixtures=[
 {name:'guest-empty',guest:true},
 {name:'guest-profile',guest:true,draft:true},
 {name:'free'},
 {name:'trial-active',trial:'2026-11-05T09:00:00Z'},
 {name:'trial-ending',trial:'2026-11-02T09:00:00Z'},
 {name:'trial-expired',trial:'2026-10-20T09:00:00Z'},
 {name:'premium',premium:true},
 {name:'founder-premium',premium:true,founder:true},
 {name:'founder-trial',founder:true,trial:'2027-01-19T09:00:00Z'},
 {name:'qa-premium',guest:true,draft:true,qa:true},
];
async function setup(context,f){
 await installOfflineSockets(context);
 const writes=[],errors=[];
 const user={id,email:'synthetic@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},identities:[]};
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();
  if(!['GET','HEAD','OPTIONS'].includes(req.method()))writes.push({path:url.pathname,method:req.method()});
  const body=url.pathname==='/auth/v1/user'?user:url.pathname==='/rest/v1/profiles'?{id,onboarding_completed:true,is_founder:!!f.founder,is_premium:!!f.premium,subscription_status:f.premium?'active':null,trial_ends_at:f.trial||null}:url.pathname==='/rest/v1/fiscal_profiles'?fiscal:url.pathname==='/rest/v1/revenues'?[{id:'synthetic-revenue',amount:1200,date:'2026-10-05',created_at:'2026-10-05T10:00:00Z',activity_type:'services'}]:url.pathname.includes('/rest/v1/')?[]:{};
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await context.addInitScript(({f,user,invoice,fiscal})=>{
  if(localStorage.getItem('access_seeded'))return;
  localStorage.setItem('access_seeded','1');localStorage.setItem('beta_seen','1');
  if(f.qa)localStorage.setItem('microassist_is_premium','1');
  localStorage.setItem('guest_invoices',JSON.stringify([invoice]));
  if(f.draft)localStorage.setItem('microassist_v1',JSON.stringify({version:1,answers:{entry_status:'micro_yes',status:'auto_entrepreneur',...fiscal},messages:[]}));
  if(!f.guest){
   const exp=4102444800,enc=v=>btoa(JSON.stringify(v)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
   localStorage.setItem('sb-bvymwuokljxgoavfehav-auth-token',JSON.stringify({access_token:`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:user.id,aud:'authenticated',exp})}.synthetic`,refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:3600,expires_at:exp,user}));
   localStorage.setItem('microassist_pending_auth_success','manual_auth');
  }
 },{f,user,invoice,fiscal});
 return {writes,errors};
}
const normalize=s=>s.replace(/\s+/g,' ').trim();
async function closeOverlay(page){
 if(await page.locator('.authOverlay').count())await page.keyboard.press('Escape');
 else await page.locator('.modalOverlay').getByRole('button',{name:/^(✕|Fermer)$/}).click();
 await expect(page.locator('.modalOverlay,.authOverlay')).toHaveCount(0);
}
for(const f of fixtures)test(`access and navigation ${f.name}`,async({context,page})=>{
 const state=await setup(context,f);page.on('pageerror',e=>state.errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-26T09:00:00Z')});
 await page.goto('/');
 if(f.guest&&!f.draft){const dialog=page.getByRole('dialog',{name:'Configurer ton profil fiscal'});await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Fermer l’onboarding'}).click();}
 if(!f.guest){
  await expect(page.getByText('Connectée : synthetic@example.test',{exact:true})).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('microassist_pending_auth_success'))).toBeNull();
  await expect(page.getByText('Connexion réussie. Le profil fiscal du compte a été chargé.',{exact:true})).toHaveCount(0,{timeout:10000});
 }
 await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Mon espace fiscal',exact:true}).click();
 const dashboard=page.locator('.dashboardCard');
 const access=page.getByRole('region',{name:'Mon accès',exact:true});
const nav=baseline?dashboard.locator('.dashboardQuickActions, .dashboardInternalNav'):page.getByRole('navigation',{name:'Navigation du cockpit'});
 const raw=await page.evaluate(()=>localStorage.getItem('guest_invoices'));
 const summary=await page.getByRole('region',{name:'Vue d’ensemble du cockpit'}).innerText();
 await mkdir(root,{recursive:true});
 let texts=[];
 if(baseline){
  const surfaces=dashboard.locator('.dashboardFounderBanner,.discoveryBanner,.dashboardProtectionCard');
  texts=(await surfaces.allInnerTexts()).flatMap(t=>t.split('\n')).map(normalize).filter(Boolean);
  // Read the original label, independently of the old pill's CSS text-transform.
  texts.push(...(await dashboard.locator('.dashboardTrustPill').filter({hasNotText:'Profil sauvé'}).locator('.dashboardTrustPillLabel,.dashboardTrustPillText').allTextContents()).map(normalize));
  // Billing has no dedicated class in the baseline: use its existing callback button.
  const billing=dashboard.locator('.sectionHead').filter({hasText:/Tester sans compte|Phase de test active|Premium actif|Premium QA actif|Rappels en phase de test/});
  texts.push(...(await billing.allInnerTexts()).flatMap(t=>t.split('\n')).map(normalize).filter(Boolean));
 }else{
  await expect(access).toHaveCount(1);await expect(nav).toHaveCount(f.name==='guest-empty'?0:1);
  const toggle=access.locator('button[aria-controls]');
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  const details=page.locator(`[id="${await toggle.getAttribute('aria-controls')}"]`);
  await expect(details).toBeHidden();await toggle.focus();await page.keyboard.press('Tab');
  expect(await details.evaluate(el=>el.contains(document.activeElement))).toBe(false);
  await toggle.focus();await page.keyboard.press('Space');await expect(toggle).toHaveAttribute('aria-expanded','true');await expect(details).toBeVisible();
  texts=(await access.innerText()).split('\n').map(normalize).filter(Boolean);
  if(process.env.ACCESS_NAV_REVIEW_DIR){
   const before=JSON.parse(await readFile(`${root}/baseline-${f.name}.json`,'utf8'));
   const all=normalize(await access.innerText());for(const text of before.texts)expect(all).toContain(text);
   expect(summary).toBe(before.summary);expect(raw).toBe(before.invoices);
  }
  await toggle.focus();await page.keyboard.press('Enter');await expect(details).toBeHidden();await expect(toggle).toBeFocused();
  await expect(nav.getByRole('button',{name:'Ajouter un revenu',exact:true})).toHaveCount(0);
  await expect(nav.getByRole('button',{name:'Créer une facture',exact:true})).toHaveCount(0);
 }
 const links=await nav.locator('button,a').allTextContents();
 if(!baseline&&process.env.ACCESS_NAV_REVIEW_DIR){
  const before=JSON.parse(await readFile(`${root}/baseline-${f.name}.json`,'utf8'));
  // Preserve the unique destinations from both original navigation surfaces.
  expect([...new Set(links.map(normalize))].sort()).toEqual([...new Set(before.links.map(normalize))].sort());
 }
 await writeFile(`${root}/${baseline?'baseline':'candidate'}-${f.name}.json`,JSON.stringify({texts,links,summary,invoices:raw},null,2));
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000});await dashboard.evaluate(el=>el.scrollIntoView({block:'start'}));
  if(!baseline){
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   const overflow=await access.locator('p,h3,button').evaluateAll(els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.width&&(r.left<0||r.right>innerWidth+.5);}).map(el=>el.tagName));expect(overflow).toEqual([]);
  }
  await page.screenshot({path:`${root}/${baseline?'before':'after'}-${f.name}-${width}.png`});
  if(await nav.count()){
   for(let i=0;i<await nav.count();i++)await nav.nth(i).screenshot({path:`${root}/navigation-${baseline?'before':'after'}-${f.name}-${width}-${i}.png`});
  }
  if(!baseline){
   await access.screenshot({path:`${root}/access-${f.name}-${width}.png`});
   await access.getByRole('button',{name:'Voir les détails de mon accès',exact:true}).click();
   await access.screenshot({path:`${root}/details-${f.name}-${width}.png`});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await access.getByRole('button',{name:'Masquer les détails de mon accès',exact:true}).click();
  }
 }
 if(!baseline){
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await access.locator('button').first().evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
  if(f.name!=='guest-empty'){
   const targets=[['Revenus','.dashboardOrderRevenues'],['Factures','.dashboardOrderInvoices'],['Analyse','.dashboardOrderAnalysis'],['Priorités','.dashboardOrderSmartPriorities'],['Partager avec conseiller','#advisor-share-section'],['Mes rappels actifs','#reminders-section']];
   for(const [label,selector]of targets){
    await nav.getByRole('button',{name:label,exact:true}).click();
    const target=page.locator(selector);if(await target.count())await expect.poll(()=>target.first().evaluate(el=>{const r=el.getBoundingClientRect();return r.top<innerHeight&&r.bottom>=0;})).toBe(true);
   }
   if(f.guest){
    await nav.getByRole('button',{name:'Comprendre l’URSSAF',exact:true}).click();await expect(page.locator('.modalOverlay')).toBeVisible();await closeOverlay(page);
   }else{
    const popupPromise=page.waitForEvent('popup');await nav.getByRole('link',{name:'Ouvrir mon espace URSSAF',exact:true}).click();const popup=await popupPromise;expect(popup.url()).toContain('autoentrepreneur.urssaf.fr');await popup.close();
   }
   await nav.getByRole('button',{name:'Modifier mon profil',exact:true}).click();
   await expect(page.getByRole('heading',{name:'Modifier mon profil fiscal',exact:true})).toBeVisible();
   await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Mon espace fiscal',exact:true}).click();
  }
  await access.getByRole('button',{name:'Voir les détails de mon accès',exact:true}).click();
  const billing=access.getByRole('region',{name:'Détails de facturation'});await billing.getByRole('button').click();
  await expect(page.locator('.modalOverlay,.authOverlay')).toBeVisible();await expect(page.locator('.dashboardMobileActionBar')).toBeHidden();await closeOverlay(page);
  const discovery=access.getByRole('region',{name:'Détails de découverte'});
  if(await discovery.count()){
   await discovery.getByRole('button').click();
   if(['trial-active','founder-trial'].includes(f.name))await expect.poll(()=>page.locator('.dashboardOrderSmartPriorities').evaluate(el=>el.getBoundingClientRect().top<innerHeight)).toBe(true);
   else{await expect(page.locator('.modalOverlay')).toBeVisible();await closeOverlay(page);}
  }
  const protection=access.getByRole('region',{name:'Présentation Premium'});
  if(await protection.count()){await protection.getByRole('button').click();await expect(page.locator('.modalOverlay')).toBeVisible();await closeOverlay(page);}
  await page.reload();
  if(f.guest&&!f.draft){
   const wizard=page.getByRole('dialog',{name:'Configurer ton profil fiscal'});
   await expect(wizard).toBeVisible();await wizard.getByRole('button',{name:'Fermer l’onboarding'}).click();
  }
  await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Mon espace fiscal',exact:true}).click();
  await expect(access).toBeVisible();expect(await page.evaluate(()=>localStorage.getItem('guest_invoices'))).toBe(raw);
 }
 expect(state.writes.filter(w=>w.path==='/rest/v1/invoices')).toEqual([]);expect(state.errors).toEqual([]);
 await writeFile(`${root}/interceptions-${baseline?'before':'after'}-${f.name}.json`,JSON.stringify(state.writes,null,2));
});

test('revenue exports remain accessible through the cockpit navigation',async({context,page})=>{
 const state=await setup(context,{name:'exports',premium:true});
 page.on('pageerror',e=>state.errors.push(e.message));
 await page.goto('/');
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('microassist_pending_auth_success'))).toBeNull();
 await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Mon espace fiscal',exact:true}).click();
 const nav=baseline?page.getByRole('navigation',{name:'Navigation interne'}):page.getByRole('navigation',{name:'Navigation du cockpit'});
 if(!baseline){
  // Also exercise the original callbacks with normal motion (the matrix covers reduced motion).
  for(const [name,selector]of [['Revenus','.dashboardOrderRevenues'],['Factures','.dashboardOrderInvoices'],['Analyse','.dashboardOrderAnalysis'],['Priorités','.dashboardOrderSmartPriorities'],['Partager avec conseiller','#advisor-share-section'],['Mes rappels actifs','#reminders-section']]){
   await nav.getByRole('button',{name,exact:true}).click();
   const target=page.locator(selector);await expect(target).toHaveCount(1);
   await expect.poll(()=>target.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=-1&&r.top<innerHeight;})).toBe(true);
  }
 }
 await nav.getByRole('button',{name:'Revenus',exact:true}).click();
 for(const [name,extension]of [[/Export CSV/,'.csv'],[/Export PDF/,'.pdf']]){
  const pending=page.waitForEvent('download');
  await page.locator('.dashboardOrderRevenues').getByRole('button',{name}).click();
  const download=await pending;expect(download.suggestedFilename().endsWith(extension)).toBe(true);expect(await download.failure()).toBeNull();
 }
 expect(state.writes.filter(w=>w.path==='/rest/v1/invoices')).toEqual([]);expect(state.errors).toEqual([]);
});
