import {test,expect} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import process from 'node:process';
import {setupRevenueFixture,openFixtureDashboard,revenueRows} from './support/revenues-mobile-fixtures.js';
const root=process.env.MOBILE_REVIEW_DIR||'test-results/mobile-coherence',audit=process.env.MOBILE_AUDIT_ONLY==='1',stage=audit?'before':'after';
const sample=JSON.parse(await readFile('docs/local-invoice-backup/examples/valid.json','utf8'));
const longName='Élodie François — Київ '+ 'ClientSansEspace'.repeat(8);
const filled={name:'filled',profile:true,premium:true,rows:revenueRows.map((r,i)=>({...r,client:i===0?longName:r.client,note:i===0?'Détail synthétique — '+ 'Prestation'.repeat(12):r.note})),invoices:[{...sample.invoices[0],invoice_number:'FACTURE-'+ 'LONG'.repeat(15),client_name:longName},sample.invoices[1]]};
const empty={name:'empty',guest:true,rows:[]};
async function issues(locator){return locator.evaluate(el=>{
 const root=el.getBoundingClientRect(),out=[];
 if(el.scrollWidth>el.clientWidth+1)out.push({kind:'horizontal-scroll',scroll:el.scrollWidth,client:el.clientWidth});
 for(const e of el.querySelectorAll('h2,h3,h4,p,button,summary,.badge,.revenueAmount,.revenueDate,.chartValue,.historyTotal,.historyMonth')){
  const r=e.getBoundingClientRect(),s=getComputedStyle(e);if(!r.width||!r.height||s.visibility==='hidden')continue;
  if(r.left<Math.max(0,root.left)-1||r.right>Math.min(innerWidth,root.right)+1)out.push({kind:'outside-zone',tag:e.tagName,class:e.className,text:e.textContent.trim().slice(0,100),left:r.left,right:r.right,zoneLeft:root.left,zoneRight:root.right});
  if(['hidden','clip'].includes(s.overflowX)&&e.scrollWidth>e.clientWidth+1)out.push({kind:'clipped-text',tag:e.tagName,text:e.textContent.trim().slice(0,100)});
 }
 return out;
});}
const readData=page=>page.evaluate(()=>({revenues:localStorage.getItem('revenues_guest'),invoices:localStorage.getItem('guest_invoices'),answers:JSON.parse(localStorage.getItem('microassist_v1')||'{}').answers||{},simple:localStorage.getItem('microassist_profile_v1')}));
for(const f of [empty,filled])for(const width of [320,390,768,1440])test(`mobile coherence ${f.name} ${width}`,async({context,page})=>{
 const state=await setupRevenueFixture(context,f),record={fixture:f.name,width,defects:[],checks:[],errors:state.errors};page.on('pageerror',e=>state.errors.push(e.message));page.on('dialog',d=>d.dismiss());
 await page.setViewportSize({width,height:width<768?800:1000});await page.clock.install({time:new Date('2026-10-26T09:00:00Z')});
 await openFixtureDashboard(page,f,expect);await page.reload();
 if(f.guest){const wizard=page.getByRole('dialog',{name:'Configurer ton profil fiscal'});await expect(wizard).toBeVisible();await wizard.getByRole('button',{name:'Fermer l’onboarding'}).click();}
 await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Mon espace fiscal',exact:true}).click();
 if(!f.guest)await expect(page.locator('#revenues-section .revenuesList > .revenueItem')).toHaveCount(f.rows.length);
 const before=await readData(page);await mkdir(root,{recursive:true});
 const zones=[['overview','.cockpitOverview'],['access','.cockpitAccess'],['navigation','.cockpitNavigation'],['revenues','#revenues-section'],['invoices','#invoices-section']];
 for(const [name,selector]of zones){
  const zone=page.locator(selector);if(!await zone.count())continue;await zone.scrollIntoViewIfNeeded();
  record.defects.push(...(await issues(zone)).map(d=>({zone:name,...d})));await zone.screenshot({path:`${root}/${stage}-${f.name}-${width}-${name}.png`});
  const summary=zone.locator('summary');for(const control of await summary.all()){await control.focus();await page.keyboard.press('Enter');await expect(control).toBeFocused();await page.keyboard.press('Space');await expect(control).toBeFocused();}
 }
 const access=page.locator('.cockpitAccess'),toggle=access.locator('button[aria-controls]');await toggle.focus();await page.keyboard.press('Space');await expect(toggle).toHaveAttribute('aria-expanded','true');await page.keyboard.press('Enter');await expect(toggle).toHaveAttribute('aria-expanded','false');await expect(toggle).toBeFocused();record.checks.push('disclosures-keyboard-focus');
 const quick=page.getByRole('navigation',{name:'Actions rapides'}),income=quick.getByRole('button',{name:'Ajouter un revenu',exact:true}),invoice=quick.getByRole('button',{name:'Créer une facture',exact:true});await income.focus();await page.keyboard.press('Tab');await expect(invoice).toBeFocused();
 if(!await invoice.evaluate(el=>getComputedStyle(el).outlineStyle!=='none'&&parseFloat(getComputedStyle(el).outlineWidth)>=2))record.defects.push({zone:'overview',kind:'focus-invisible'});
 const bar=page.locator('.dashboardMobileActionBar'),barBefore=await bar.isVisible();
 await income.click();const revenue=page.getByRole('dialog',{name:'Ajouter revenu'});await expect(revenue).toBeVisible();await expect(bar).toBeHidden();
 await revenue.getByRole('button',{name:'+ Ajouter détails',exact:true}).click();await revenue.getByLabel('Client',{exact:true}).fill(longName);
 record.defects.push(...(await issues(revenue)).map(d=>({zone:'revenue-form',...d})));await revenue.screenshot({path:`${root}/${stage}-${f.name}-${width}-revenue-form.png`});
 await page.emulateMedia({reducedMotion:'reduce'});if(await revenue.getByRole('button',{name:'Enregistrer',exact:true}).evaluate(el=>getComputedStyle(el).transitionDuration!=='0s'))record.defects.push({zone:'revenue-form',kind:'motion-not-reduced'});await page.emulateMedia({reducedMotion:'no-preference'});
 const save=revenue.getByRole('button',{name:'Enregistrer',exact:true});await save.scrollIntoViewIfNeeded();await expect(save).toBeInViewport();await save.focus();await expect(save).toBeFocused();await revenue.getByRole('button',{name:'Annuler',exact:true}).click();expect(await bar.isVisible()).toBe(barBefore);
 await invoice.click();const generator=page.locator('.modalCard').filter({has:page.getByRole('heading',{name:'🧾 Créer une facture',exact:true})});await expect(generator).toBeVisible();await expect(bar).toBeHidden();
 const generate=generator.getByRole('button',{name:'Créer et télécharger PDF + XML',exact:true});await generate.scrollIntoViewIfNeeded();await expect(generate).toBeInViewport();await page.getByLabel('Client *',{exact:true}).fill(longName);
 record.defects.push(...(await issues(generator)).map(d=>({zone:'invoice-form',...d})));await generator.screenshot({path:`${root}/${stage}-${f.name}-${width}-invoice-form.png`});
 await page.emulateMedia({reducedMotion:'reduce'});if(await generator.getByRole('button',{name:'Créer et télécharger PDF + XML',exact:true}).evaluate(el=>getComputedStyle(el).transitionDuration!=='0s'))record.defects.push({zone:'invoice-form',kind:'motion-not-reduced'});await page.emulateMedia({reducedMotion:'no-preference'});
 const cancel=generator.getByRole('button',{name:'Annuler',exact:true});await cancel.click();expect(await bar.isVisible()).toBe(barBefore);record.checks.push('forms-scroll-validation-reachable-cancel-bar');
 await page.emulateMedia({reducedMotion:'reduce'});if(barBefore&&await bar.locator('button').evaluate(el=>getComputedStyle(el).transitionDuration!=='0s'))record.defects.push({zone:'global-bar',kind:'motion-not-reduced'});
 await page.emulateMedia({reducedMotion:'reduce'});for(const [name,selector]of zones){const zone=page.locator(selector);if(await zone.count()){const button=zone.locator('button').first();if(await button.count()&&await button.evaluate(el=>getComputedStyle(el).transitionDuration!=='0s'))record.defects.push({zone:name,kind:'motion-not-reduced'});}}
 const prior=await readData(page);expect(prior).toEqual(before);await page.reload();if(f.guest){const wizard=page.getByRole('dialog',{name:'Configurer ton profil fiscal'});await wizard.getByRole('button',{name:'Fermer l’onboarding'}).click();}await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Mon espace fiscal',exact:true}).click();expect(await readData(page)).toEqual(prior);record.checks.push('data-preserved-navigation-cancel-reload');
 record.interceptedWrites=state.writes.map(({path,method})=>({path,method}));
 expect(state.errors).toEqual([]);expect(state.writes.filter(w=>/\/(invoices|revenues)$/.test(w.path))).toEqual([]);await writeFile(`${root}/${stage}-${f.name}-${width}.json`,JSON.stringify(record,null,2));if(!audit)expect(record.defects).toEqual([]);state.release();
});

for(const width of [320,390,768,1440])test(`revenue toolbar order ${width}`,async({context,page})=>{
 const f=empty,state=await setupRevenueFixture(context,f);await page.setViewportSize({width,height:1000});await openFixtureDashboard(page,f,expect);
 const toolbar=page.locator('#revenues-section > .journalHeader > .dashboardSectionActions');await toolbar.scrollIntoViewIfNeeded();
 const positions=await toolbar.locator(':scope > *').evaluateAll(els=>els.map((e,index)=>{const r=e.getBoundingClientRect();return {index,tag:e.tagName,label:e.getAttribute('aria-label')||e.textContent.trim(),top:r.top,left:r.left,order:getComputedStyle(e).order};}));
 const visual=[...positions].sort((a,b)=>Math.abs(a.top-b.top)>4?a.top-b.top:a.left-b.left).map(e=>e.index),dom=positions.map(e=>e.index);
 const add=toolbar.getByRole('button',{name:'Ajouter un revenu',exact:true}),toggle=toolbar.getByRole('button',{name:'Réduire',exact:true}),filter=toolbar.locator('.monthFilter');
 await add.focus();await page.keyboard.press('Tab');await expect(toggle).toBeFocused();await page.keyboard.press('Tab');await expect(filter).toBeFocused();
 await mkdir(root,{recursive:true});await toolbar.screenshot({path:`${root}/${stage}-toolbar-${width}.png`});await writeFile(`${root}/${stage}-toolbar-${width}.json`,JSON.stringify({width,positions,visual,dom,consistent:JSON.stringify(visual)===JSON.stringify(dom)},null,2));
 if(!audit)expect(visual).toEqual(dom);state.release();
});
