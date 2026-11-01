import {test,expect} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import process from 'node:process';
import {setupRevenueFixture,revenueFixtures,openFixtureDashboard} from './support/revenues-mobile-fixtures.js';

const root='output/residual-theme',before=process.env.RESIDUAL_STAGE==='before';
const widths=[320,390,768,1440];
function contrast(a,b){
 const luminance=rgb=>rgb.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
const rgb=value=>value.match(/[\d.]+/g).map(Number);
async function fits(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
async function palette(page,selector){
 const node=page.locator(selector).first();await expect(node).toBeVisible();
 return node.evaluate(el=>{const s=getComputedStyle(el);return{background:s.backgroundColor,color:s.color,border:s.borderTopColor};});
}
async function identity(page){return page.evaluate(()=>({
 footer:Array.from(document.querySelectorAll('.siteFooter,.siteFooter a,.siteFooter h2,.siteFooter h3,.siteFooterBottom,.siteFooter .brandMicro,.siteFooter .brandAssist,.siteFooter .brandDot')).map(el=>({text:el.textContent,color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor,href:el.getAttribute('href')})),
 logo:Array.from(document.querySelectorAll('.topbar .brandMicro,.topbar .brandAssist,.topbar .brandDot')).map(el=>getComputedStyle(el).color),
}));}

test('residual surfaces and approved identity across widths',async({context,page})=>{
 test.setTimeout(90000);
 const fixture=revenueFixtures[1],state=await setupRevenueFixture(context,fixture);
 page.on('pageerror',e=>state.errors.push(e.message));await page.clock.install({time:new Date('2026-10-26T09:00:00Z')});
 await openFixtureDashboard(page,fixture,expect);await mkdir(root,{recursive:true});
 const data=()=>page.evaluate(()=>[localStorage.getItem('revenues_guest'),localStorage.getItem('guest_invoices')]);
 const original=await data(),nav=page.getByRole('navigation',{name:'Navigation principale'}),snapshots=[];
 for(const width of widths){
  await page.setViewportSize({width,height:900});
  await nav.getByRole('button',{name:'Mon espace fiscal',exact:true}).click();
  const snapshot={width,identity:await identity(page),chart:await page.locator('.chartValue').allTextContents(),surfaces:{}};
  const record=async(name,selector)=>{snapshot.surfaces[name]=await palette(page,selector);};
  await record('revenue','#revenues-section');
  await page.getByRole('navigation',{name:'Actions rapides'}).getByRole('button',{name:'Ajouter un revenu',exact:true}).click();
  const revenue=page.getByRole('dialog',{name:'Ajouter revenu'});await expect(revenue).toBeVisible();await revenue.locator('input[type="number"]').fill('120');await record('revenue-preview','.revenuePreview');
  if(!before){
   const field=await revenue.locator('input').first().evaluate(el=>{const s=getComputedStyle(el);return{background:s.backgroundColor,border:s.borderTopColor};});
   expect(contrast(rgb(field.background),rgb(field.border))).toBeGreaterThanOrEqual(3);
   const info=await palette(page,'.revenuePreview');expect(info.background).toBe('rgb(240, 236, 227)');
  }
  if(!before||[320,1440].includes(width))await revenue.screenshot({path:`${root}/${before?'before':'after'}-revenue-${width}.png`});
  await revenue.getByRole('button',{name:'Annuler',exact:true}).click();
  await page.getByRole('navigation',{name:'Actions rapides'}).getByRole('button',{name:'Créer une facture',exact:true}).click();
  const invoice=page.locator('.invoiceGeneratorModal');await expect(invoice).toBeVisible();await record('invoice-preview','.invoiceGeneratorModal .revenuePreview');
  await invoice.getByRole('button',{name:'Annuler',exact:true}).click();
  await page.locator('.cockpitAccountAction').click();const auth=page.locator('.authModal');await expect(auth).toBeVisible();
  await record('auth-help','.authPathHint');await auth.getByRole('button',{name:'Connexion',exact:true}).click();
  if(!before){
   await expect(page.locator('.authModeButton.isActive')).toHaveCSS('background-color','rgb(6, 86, 64)');
   await expect(page.locator('.authModeButton.isActive')).toHaveCSS('color','rgb(255, 255, 255)');
   const active=await palette(page,'.authModeButton.isActive');expect(contrast(rgb(active.color),rgb(active.background))).toBeGreaterThanOrEqual(4.5);
  }
  await auth.locator('.authClose').click();
  await nav.getByRole('button',{name:'Assistant',exact:true}).click();
  await record('assistant','.assistantSummaryBox');
  const assistant=page.locator('.assistantSummaryBox').filter({has:page.getByRole('heading',{name:'Mon profil',exact:true})});
  await assistant.getByRole('button',{name:'Modifier',exact:true}).click();
  const wizard=page.getByRole('dialog',{name:'Configurer ton profil fiscal'});await expect(wizard).toBeVisible();
  await record('selected','.simpleChoiceButton.isSelected');
  if(!before){
   const selected=await palette(page,'.simpleChoiceButton.isSelected');expect(selected.background).toBe('rgb(232, 239, 231)');expect(selected.border).toBe('rgb(6, 86, 64)');
   expect(contrast(rgb(selected.color),rgb(selected.background))).toBeGreaterThanOrEqual(4.5);
  }
  await page.keyboard.press('Escape');await expect(wizard).toBeHidden();
  await nav.getByRole('button',{name:'Tarifs',exact:true}).click();await record('pricing','.pricingBetaAccess');
  if([320,1440].includes(width))await page.locator('.pricingBetaCard').screenshot({path:`${root}/${before?'before':'after'}-pricing-${width}.png`});
  await nav.getByRole('button',{name:'Accueil',exact:true}).click();await record('home','.heroSaaS');
  await fits(page);await nav.getByRole('button',{name:'Mon espace fiscal',exact:true}).click();await fits(page);
  if(!before||[320,1440].includes(width))await page.locator('.cockpitOverview').screenshot({path:`${root}/${before?'before':'after'}-cockpit-${width}.png`});
  if(!before){
   const secondary=page.getByRole('navigation',{name:'Actions rapides'}).getByRole('button',{name:'Créer une facture',exact:true});
   await secondary.hover();await expect(secondary).toHaveCSS('background-color','rgb(232, 239, 231)');
   await secondary.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(secondary).toBeFocused();
   expect(await secondary.evaluate(el=>getComputedStyle(el).outlineStyle)).not.toBe('none');
  }
  expect(await data()).toEqual(original);snapshots.push(snapshot);
 }
 if(before)await writeFile(`${root}/before.json`,JSON.stringify(snapshots,null,2));
 else{
  const prior=JSON.parse(await readFile(`${root}/before.json`,'utf8'));
  for(let i=0;i<snapshots.length;i++){expect(snapshots[i].identity).toEqual(prior[i].identity);expect(snapshots[i].chart).toEqual(prior[i].chart);}
  await writeFile(`${root}/after.json`,JSON.stringify(snapshots,null,2));
 }
 await page.reload({waitUntil:'domcontentloaded'});expect(await data()).toEqual(original);
 expect(state.errors).toEqual([]);expect(state.writes).toEqual([]);
});

for(const invalid of [false,true])test(`local invoice information ${invalid?'unreadable':'filled'}`,async({context,page})=>{
 test.setTimeout(60000);
 const raw=invalid?'{synthetic-unreadable':'[{"id":"synthetic-theme","invoice_number":"THEME-01","client_name":"Client synthétique","amount":120}]';
 const state=await setupRevenueFixture(context,revenueFixtures[1]);
 await context.addInitScript(raw=>{if(!localStorage.getItem('theme_invoice_seeded')){localStorage.setItem('guest_invoices',raw);localStorage.setItem('theme_invoice_seeded','1');}},raw);
 page.on('pageerror',e=>state.errors.push(e.message));await openFixtureDashboard(page,revenueFixtures[1],expect);
 for(const width of widths){
  await page.setViewportSize({width,height:900});const status=page.getByTestId('local-invoice-status');await expect(status).toBeVisible();
  await expect(status).toContainText(invalid?'Ne réinitialise pas':'dans ce navigateur');
  const colors=await palette(page,'[data-testid="local-invoice-status"]');expect(colors.background).toBe('rgb(240, 236, 227)');expect(contrast(rgb(colors.color),rgb(colors.background))).toBeGreaterThanOrEqual(4.5);
  await page.getByRole('button',{name:'Restaurer une sauvegarde',exact:true}).click();
  const region=page.getByRole('region',{name:'Restauration locale',exact:true});await expect(region).toBeVisible();
  await region.getByRole('button',{name:'Annuler la restauration',exact:true}).click();await expect(region).toBeHidden();await fits(page);
 }
 await page.reload({waitUntil:'domcontentloaded'});expect(await page.evaluate(()=>localStorage.getItem('guest_invoices'))).toBe(raw);
 expect(state.errors).toEqual([]);expect(state.writes).toEqual([]);
});

test('legal surfaces inherit warm palette without changing routes',async({context,page})=>{
 test.setTimeout(90000);const state=await setupRevenueFixture(context,revenueFixtures[1]);
 page.on('pageerror',e=>state.errors.push(e.message));
 for(const width of widths){
  await page.setViewportSize({width,height:900});
  for(const slug of ['privacy','terms','cookies','mentions','accessibility','security']){
   await page.goto('/legal/'+slug);await expect(page.locator('.legalHero h1')).toBeVisible();await fits(page);
   const section=await palette(page,'.legalSection');expect(section.background).toBe('rgb(240, 236, 227)');
   const text=await palette(page,'.legalSection p');expect(contrast(rgb(text.color),rgb(section.background))).toBeGreaterThanOrEqual(4.5);
  }
 }
 expect(state.errors).toEqual([]);expect(state.writes).toEqual([]);
});
