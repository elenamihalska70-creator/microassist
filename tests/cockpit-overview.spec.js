import {test,expect} from '@playwright/test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import process from 'node:process';
const baseline=process.env.COCKPIT_BASELINE==='1';
const root=process.env.COCKPIT_REVIEW_DIR || 'test-results/cockpit';
const id='11111111-1111-4111-8111-111111111111';
const complete={user_id:id,activity_type:'services',declaration_frequency:'mensuel',acre:'no',business_start_date:'2026-01-01'};
const revenue=amount=>({id:'synthetic-revenue',amount,date:'2026-10-05',created_at:'2026-10-05T10:00:00Z',activity_type:'services'});
const localInvoice={id:'synthetic-local',invoice_number:'SYNTHETIC',amount:10,client_name:'Client synthétique'};
const fixtures=[
 {name:'guest-empty',guest:true},
 {name:'guest-invoice',guest:true,invoices:[localInvoice]},
 {name:'partial',profile:{...complete,business_start_date:null}},
 {name:'complete',profile:complete,revenues:[revenue(1200)]},
 {name:'zero',profile:complete,revenues:[revenue(0)]},
 {name:'provisional',guest:true,draft:{entry_status:'micro_yes',status:'auto_entrepreneur',...complete},simple:{activity_type:'services',declaration_frequency:'mensuel',starter_monthly_revenue:1800,monthly_revenue:1800,data_quality:'estimated'}},
 {name:'loading',loading:true},
 {name:'error',error:true},
];
async function setup(context,f){
 const invoiceWrites=[],errors=[];let reads=0,release;
 const gate=new Promise(resolve=>{release=resolve;});
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();
  if(url.pathname==='/rest/v1/invoices'&&!['GET','HEAD'].includes(req.method()))invoiceWrites.push(req.method());
  const user={id,email:'synthetic@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},identities:[],created_at:'2026-01-01T00:00:00Z'};
  let body=url.pathname==='/auth/v1/user'?user:url.pathname==='/rest/v1/profiles'?{id,onboarding_completed:true}:url.pathname==='/rest/v1/revenues'?(f.revenues||[]):url.pathname.includes('/rest/v1/')?[]:{};
  if(url.pathname==='/rest/v1/fiscal_profiles'&&req.method()==='GET'){
   reads++;if(f.loading)await gate;
   if(f.error)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'synthetic unavailable'})});
   body=f.profile||null;
  }
  try{return await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});}catch{ /* Context may close a held synthetic response. */ }
 });
 await context.addInitScript(({f,id})=>{
  if(localStorage.getItem('cockpit_seeded'))return;
  localStorage.setItem('cockpit_seeded','1');localStorage.setItem('beta_seen','1');
  localStorage.setItem('guest_invoices',JSON.stringify(f.invoices||[]));
  if(f.draft)localStorage.setItem('microassist_v1',JSON.stringify({version:1,answers:f.draft,messages:[]}));
  if(f.simple)localStorage.setItem('microassist_profile_v1',JSON.stringify(f.simple));
  if(!f.guest){
   // Independent of init-script ordering relative to the fixed browser clock.
   const exp=4102444800;
   const enc=v=>btoa(JSON.stringify(v)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
   const user={id,email:'synthetic@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},identities:[],created_at:'2026-01-01T00:00:00Z'};
   localStorage.setItem('sb-bvymwuokljxgoavfehav-auth-token',JSON.stringify({access_token:`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:id,aud:'authenticated',exp})}.synthetic`,refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:3600,expires_at:exp,user}));
   if(!f.loading&&!f.error)localStorage.setItem('microassist_pending_auth_success','manual_auth');
  }
 },{f,id});
 return {invoiceWrites,errors,reads:()=>reads,release};
}
for(const f of fixtures)test(`cockpit ${f.name}`,async({context,page})=>{
 const state=await setup(context,f);page.on('pageerror',e=>state.errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-26T10:00:00+01:00')});
 await page.goto('/');
 if(f.guest&&!f.draft){const wizard=page.getByRole('dialog',{name:'Configurer ton profil fiscal'});await expect(wizard).toBeVisible();await wizard.getByRole('button',{name:'Fermer l’onboarding'}).click();}
 if(!f.guest){
  await expect(page.getByText('Connectée : synthetic@example.test',{exact:true})).toBeVisible({timeout:10000});
  await expect.poll(state.reads).toBeGreaterThan(0);
  if(!f.loading&&!f.error)await expect.poll(()=>page.evaluate(()=>localStorage.getItem('microassist_pending_auth_success'))).toBeNull();
  if(!f.loading&&!f.error)await expect(page.getByText('Connexion réussie. Le profil fiscal du compte a été chargé.',{exact:true})).toHaveCount(0,{timeout:10000});
  if(f.error)await expect(page.getByRole('alert').filter({hasText:'Impossible de charger ton profil fiscal'})).toBeVisible();
 }
 await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Mon espace fiscal',exact:true}).click();
 const dashboard=page.locator('.dashboardCard'),overview=page.getByRole('region',{name:'Vue d’ensemble du cockpit'});
 const raw=await page.evaluate(()=>localStorage.getItem('guest_invoices'));
 const priority=dashboard.locator('section.priorityCard');
 const priorityText=await priority.count()?await priority.innerText():null;
 let metrics;
 if(baseline)metrics=await dashboard.locator('.fiscalDashboard .fiscalValue').allTextContents();
 else {
  await expect(overview).toBeVisible();
  await expect(overview.getByRole('heading',{name:'Mon espace fiscal',exact:true})).toHaveCount(1);
  metrics=await Promise.all(['revenue','reserve','available'].map(key=>overview.getByTestId(`cockpit-${key}`).textContent()));
  // Optional forensic comparison; the test also runs without review artefacts in CI.
  if(process.env.COCKPIT_REVIEW_DIR){
   const previous=JSON.parse(await readFile(`${root}/baseline-${f.name}.json`,'utf8'));
   expect(priorityText).toBe(previous.priority);
   for(let i=0;i<3;i++)if(/\d/.test(previous.metrics[i]))expect(metrics[i]).toBe(previous.metrics[i]);else expect(metrics[i]).toBe('—');
   expect(await page.evaluate(()=>localStorage.getItem('guest_invoices'))).toBe(previous.invoices);
  }
  if(f.name==='guest-empty'||f.name==='guest-invoice'||f.loading||f.error)expect(metrics).toEqual(['—','—','—']);
  if(f.name==='zero')expect(metrics.every(value=>/^0\s*€$/.test(value))).toBe(true);
  await expect(overview.locator('.cockpitProfile')).toHaveCount(f.loading||f.error||f.name==='complete'||f.name==='zero'||f.name==='provisional'?0:1);
  await expect(overview).not.toContainText('Profil à compléter');
  if(f.name==='partial')await expect(overview.locator('.cockpitProfile')).toContainText('date de début d’activité');
  if(await overview.locator('.cockpitProfile').count())await expect(overview.locator('.cockpitProfile')).not.toContainText('SIRET');
  if(f.name==='provisional')await expect(overview).toContainText('Estimation provisoire');
  if(f.name==='complete') {
   expect(metrics[0].replace(/\s/g,'')).toContain('1200');
   await expect(priority).not.toContainText('Tu n’as pas déclaré');
  }
 }
 await mkdir(root,{recursive:true});
 await writeFile(`${root}/${baseline?'baseline':'candidate'}-${f.name}.json`,JSON.stringify({metrics,priority:priorityText,invoices:raw},null,2));
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000});
  await dashboard.evaluate(el=>el.scrollIntoView({block:'start'}));
  if(!baseline){
   const overflow=await overview.evaluate(el=>[...el.querySelectorAll('h2,h3,h4,p,button,dd')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left<-.5||r.right>innerWidth+.5);}).map(e=>e.tagName));
   expect(overflow).toEqual([]);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   // The new zone's DOM order is also its vertical visual order.
   const positions=await overview.evaluate(el=>[...el.children].map(e=>e.getBoundingClientRect().top));
   expect(positions).toEqual([...positions].sort((a,b)=>a-b));
  }
  await page.screenshot({path:`${root}/${baseline?'before':'after'}-${f.name}-${width}.png`});
 }
 if(!baseline&&!f.loading&&!f.error){
  const actions=overview.getByRole('navigation',{name:'Actions rapides'});
  const add=actions.getByRole('button',{name:'Ajouter un revenu',exact:true}),invoice=actions.getByRole('button',{name:'Créer une facture',exact:true});
  await add.focus();await page.keyboard.press('Tab');await expect(invoice).toBeFocused();
  expect(await invoice.evaluate(el=>getComputedStyle(el).outlineStyle!=='none'&&parseFloat(getComputedStyle(el).outlineWidth)>=2)).toBe(true);
  await invoice.click();
  await expect(page.getByLabel('Client *',{exact:true})).toBeVisible();
  await expect(page.locator('.dashboardMobileActionBar')).toBeHidden();
  await page.getByRole('button',{name:'Annuler',exact:true}).click();
  await add.click();await expect(page.getByRole('dialog',{name:'Ajouter revenu'})).toBeVisible();
  await page.getByRole('dialog',{name:'Ajouter revenu'}).getByRole('button',{name:'Fermer',exact:true}).click();
  const fallback=overview.locator('.cockpitPrimary');
  if(await fallback.count()){
   await fallback.click();await expect(page.getByRole('dialog',{name:'Ajouter revenu'})).toBeVisible();
   await page.getByRole('dialog',{name:'Ajouter revenu'}).getByRole('button',{name:'Fermer',exact:true}).click();
  }
  const profile=overview.locator('.cockpitProfile');
  if(await profile.count()){
   await profile.getByRole('button',{name:'Compléter mon profil fiscal',exact:true}).click();
   if(f.guest){
    await expect(page.getByRole('dialog',{name:'Configurer ton profil fiscal'})).toBeVisible();
    await expect(page.locator('.dashboardMobileActionBar')).toBeHidden();
    await page.getByRole('button',{name:'Fermer l’onboarding',exact:true}).click();
   }else{
    await expect(page.getByRole('heading',{name:'Modifier mon profil fiscal',exact:true})).toBeVisible();
    await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Mon espace fiscal',exact:true}).click();
   }
  }
  const confirmation=priority.getByRole('button',{name:/J.ai.*déclar/});
  if(await confirmation.count()){
   await confirmation.click();
   const dialog=page.locator('.modalCard').filter({has:page.getByRole('heading',{name:'J’ai fait ma déclaration',exact:true})});
   if(f.guest)await expect(dialog).toHaveCount(0); // Existing user-id guard is a no-op for guests.
   else {
    await expect(dialog).toBeVisible();await expect(page.locator('.dashboardMobileActionBar')).toBeHidden();
    await dialog.getByRole('button',{name:'Annuler',exact:true}).click();
   }
  }
  expect(await page.evaluate(()=>localStorage.getItem('guest_invoices'))).toBe(raw);
 }
 if(!baseline){
  const contrast=await overview.locator('button,a.btn').evaluateAll(elements=>{
   const lum=value=>{const c=value.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
   return elements.map(el=>{const s=getComputedStyle(el),a=lum(s.color),b=lum(s.backgroundColor);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);});
  });
  expect(contrast.every(ratio=>ratio>=4.5)).toBe(true);
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await overview.locator('button').first().evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
 }
 expect(state.invoiceWrites).toEqual([]);expect(state.errors).toEqual([]);state.release();
});
