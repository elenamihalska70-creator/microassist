import {test,expect} from '@playwright/test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {Buffer} from 'node:buffer';
const fixture=JSON.parse(await readFile('docs/local-invoice-backup/examples/valid.json','utf8'));
const old={...fixture.invoices[0],id:'copy-old',invoice_number:'COPY-OLD',status:'unpaid',paid_at:null};
const recent={...fixture.invoices[1],id:'copy-recent',invoiceNumber:'COPY-RECENT',invoice_number:'COPY-RECENT'};
const remote={...recent,id:'copy-remote',invoiceNumber:'COPY-REMOTE',invoice_number:'COPY-REMOTE',status:'unpaid',paid_at:null,localOnly:true};
async function setup(context,signedIn){
 const insertAttempts=[],patches=[];let remoteInvoice=structuredClone(remote);
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());if(['127.0.0.1','localhost'].includes(u.hostname))return route.continue();
  if(u.pathname==='/rest/v1/invoices'){
   if(req.method()==='POST'||req.method()==='PUT')insertAttempts.push(req.method());
   if(req.method()==='PATCH'){patches.push({query:u.search,body:req.postDataJSON()});remoteInvoice={...remoteInvoice,...req.postDataJSON()};return route.fulfill({status:204,body:''});}
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([remoteInvoice])});
  }
  const id='11111111-1111-4111-8111-111111111111';
  const body=u.pathname==='/auth/v1/user'?{id,email:'synthetic@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},identities:[],created_at:'2026-01-01T00:00:00Z'}
   :u.pathname==='/rest/v1/profiles'?{id,onboarding_completed:true}
   :u.pathname==='/rest/v1/fiscal_profiles'?{user_id:id,activity_type:'services',declaration_frequency:'mensuel',acre:'no',business_start_date:'2026-01-01'}
   :u.pathname.includes('/rest/v1/')?[]:{};
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 await context.addInitScript(({signedIn,invoices})=>{
  if(localStorage.getItem('copy_seeded'))return;
  localStorage.setItem('copy_seeded','1');localStorage.setItem('beta_seen','1');localStorage.setItem('guest_invoices',JSON.stringify(invoices));
  if(signedIn){
   const id='11111111-1111-4111-8111-111111111111',exp=Math.floor(Date.now()/1000)+3600;
   const encode=v=>btoa(JSON.stringify(v)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
   const user={id,email:'synthetic@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},identities:[],created_at:'2026-01-01T00:00:00Z'};
   localStorage.setItem('microassist_pending_auth_success','manual_auth');
   localStorage.setItem('sb-bvymwuokljxgoavfehav-auth-token',JSON.stringify({access_token:`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:id,aud:'authenticated',exp})}.synthetic`,refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:3600,expires_at:exp,user}));
  }
 },{signedIn,invoices:[old,recent]});
 return {insertAttempts,patches};
}
async function navigate(page,signedIn){
 if(signedIn)await expect.poll(()=>page.evaluate(()=>localStorage.getItem('microassist_pending_auth_success'))).toBeNull();
 const dialog=page.getByRole('dialog',{name:'Configurer ton profil fiscal'});
 if(!signedIn)await expect(dialog).toBeVisible();
 if(await dialog.isVisible())await dialog.getByRole('button',{name:'Fermer l’onboarding'}).click();
 await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Factures',exact:true}).click();
 await expect(page.getByTestId('local-invoice-status')).toContainText('même après connexion');
}
for(const signedIn of [false,true])test(`copy and provenance, ${signedIn?'signed in':'guest'}`,async({context,page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const {insertAttempts,patches}=await setup(context,signedIn);
 await page.goto('/');await navigate(page,signedIn);
 const section=page.locator('#invoices-section');
 const card=number=>section.locator('.revenueItem').filter({has:page.getByText(`N° ${number}`,{exact:true})});
 for(const number of ['COPY-OLD','COPY-RECENT'])await expect(card(number).getByText('Enregistrée dans ce navigateur',{exact:true})).toBeVisible();
 await expect(card('COPY-RECENT')).toContainText('Champs contrôlés renseignés');
 await expect(section).toContainText('Indicateur de complétude');
 await expect(section).toContainText('Cet indicateur ne valide pas la conformité fiscale ni Factur-X/PDF/A-3.');
 await expect(section).toContainText('exporte une sauvegarde JSON puis restaure-la à destination');
 await expect(section).not.toContainText('sera ajoutée');
 if(signedIn){await expect(card('COPY-REMOTE')).toBeVisible();await expect(card('COPY-REMOTE').getByText('Enregistrée dans ce navigateur',{exact:true})).toHaveCount(0);}
 else await expect(card('COPY-REMOTE')).toHaveCount(0);
 const before=await page.evaluate(()=>localStorage.getItem('guest_invoices'));expect(JSON.parse(before)).toEqual([old,recent]);
 if(signedIn)await expect(page.getByText('Connexion réussie. Le profil fiscal du compte a été chargé.',{exact:true})).toHaveCount(0,{timeout:10000});
 await mkdir('test-results/invoice-copy',{recursive:true});
 if(!signedIn){
  const styles=await page.evaluate(()=>{
   const read=e=>{const s=getComputedStyle(e);return{background:s.backgroundColor,color:s.color,font:s.fontFamily,padding:s.padding,radius:s.borderRadius,border:s.border,shadow:s.boxShadow};};
   return {body:read(document.body),title:read(document.querySelector('#invoices-section h3')),card:read(document.querySelector('#invoices-section .revenueItem')),button:read(document.querySelector('#invoices-section button'))};
  });
  await writeFile('test-results/invoice-copy/app-styles.json',JSON.stringify(styles,null,2));
 }
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  await page.setViewportSize({width,height});await section.scrollIntoViewIfNeeded();
  const overflow=await section.evaluate(el=>[...el.querySelectorAll('p,span,strong,button')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&getComputedStyle(e).visibility!=='hidden'&&(r.left<-.5||r.right>innerWidth+.5);}).map(e=>e.tagName));
  expect(overflow).toEqual([]);
  await section.screenshot({path:`test-results/invoice-copy/${signedIn?'account':'guest'}-${name}.png`});
 }
 await card('COPY-OLD').getByRole('button',{name:'Marquer comme payée',exact:true}).click();
 const changed=await page.evaluate(()=>JSON.parse(localStorage.getItem('guest_invoices')));
 expect(changed[0].status).toBe('paid');expect(changed[0].paid_at).toBeTruthy();expect(changed[1]).toEqual(recent);expect(patches).toEqual([]);
 if(signedIn){
  await card('COPY-REMOTE').getByRole('button',{name:'Marquer comme payée',exact:true}).click();
  await expect.poll(()=>patches.length).toBe(1);expect(patches[0].query).toContain('id=eq.copy-remote');expect(patches[0].query).toContain('user_id=eq.11111111');
  expect(patches[0].body.status).toBe('paid');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('guest_invoices')))).toEqual(changed);
 }
 await section.getByRole('button',{name:'Créer une facture',exact:true}).click();
 await expect(page.getByRole('button',{name:'Créer et télécharger PDF + XML',exact:true})).toBeVisible();
 await expect(page.locator('.modalCard').filter({has:page.getByText('🧾 Créer une facture',{exact:true})})).toContainText('sans validation de conformité fiscale ni certification Factur-X/PDF/A-3');
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  await page.setViewportSize({width,height});
  const modal=page.locator('.modalCard').filter({has:page.getByText('🧾 Créer une facture',{exact:true})});
  await modal.evaluate(e=>{e.scrollTop=e.scrollHeight;});
  expect(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
  await modal.screenshot({path:`test-results/invoice-copy/generator-${signedIn?'account':'guest'}-${name}.png`});
 }
 expect(insertAttempts).toEqual([]);expect(errors).toEqual([]);
});
