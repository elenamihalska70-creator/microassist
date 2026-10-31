import {test,expect} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import process from 'node:process';
import {setupRevenueFixture,revenueFixtures,openFixtureDashboard} from './support/revenues-mobile-fixtures.js';
const root='output/cockpit-composition',before=process.env.COMPOSITION_BEFORE==='1';
const fixtures=[revenueFixtures[0],revenueFixtures[1],{...revenueFixtures[0],name:'unavailable',rows:[{id:'synthetic',amount:80,date:'2026-10-01'}]}, {...revenueFixtures[1],name:'zero',rows:[{id:'zero',amount:0,date:'2026-10-01'}]},revenueFixtures[5]];
for(const fixture of fixtures)test(`composition ${fixture.name}`,async({context,page})=>{
 const state=await setupRevenueFixture(context,fixture);page.on('pageerror',e=>state.errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-26T09:00:00Z')});
 await openFixtureDashboard(page,fixture,expect);
 if(!before){
  await page.reload({waitUntil:'domcontentloaded'});
  if(!fixture.profile)await page.getByRole('button',{name:'Fermer l’onboarding'}).click();
  await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Mon espace fiscal',exact:true}).click();
 }
 const dashboard=page.locator('.dashboardCard');
 const data=()=>page.evaluate(()=>Object.fromEntries(['revenues_guest','guest_invoices','microassist_v1','microassist_profile_v1'].map(k=>[k,localStorage.getItem(k)])));
 const normalize=d=>{const copy={...d};if(copy.microassist_v1){copy.microassist_v1=JSON.parse(copy.microassist_v1);delete copy.microassist_v1.savedAt;}return copy;};
 const business=normalize(await data());
 const snapshot={metrics:await dashboard.locator('[data-testid^="cockpit-"]').allTextContents(),priority:await dashboard.locator('.cockpitNow').innerText(),actions:(await dashboard.locator('button').allTextContents()).map(s=>s.trim()).filter(s=>!['✕','Voir tout','Réduire','Voir les montants par mois'].includes(s)).sort(),footer:await page.locator('.siteFooter a').evaluateAll(es=>es.map(e=>[e.textContent,e.getAttribute('href')]))};
 await mkdir(root,{recursive:true});
 if(before)await writeFile(`${root}/before-${fixture.name}.json`,JSON.stringify(snapshot,null,2));
 else expect(snapshot).toEqual(JSON.parse(await readFile(`${root}/before-${fixture.name}.json`,'utf8')));
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:900});await dashboard.scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(!before){
   const aside=page.locator('.cockpitResults'),work=page.locator('.cockpitWorkspace');
   const a=await aside.boundingBox(),w=await work.boundingBox();
   const quick=page.getByRole('navigation',{name:'Actions rapides'}),q=await quick.boundingBox();
   await expect(quick).toHaveCount(1);await expect(quick.getByRole('button')).toHaveCount(2);
   expect(await page.locator('.cockpitComposition').evaluate(e=>e.firstElementChild.classList.contains('cockpitActions'))).toBe(true);
   if(width>=1100){expect(w.x).toBeLessThan(a.x);expect(Math.abs(q.y-a.y)).toBeLessThan(2);expect(w.y-q.y-q.height).toBeLessThanOrEqual(30);const insights=await page.locator('.cockpitInsights').boundingBox();expect(insights.y-a.y-a.height).toBeLessThanOrEqual(30);}else {expect(q.y+q.height).toBeLessThanOrEqual(a.y);expect(a.y+a.height).toBeLessThanOrEqual(w.y+2);}
   await expect(page.getByRole('figure',{name:'Évolution des revenus encaissés'})).toHaveCount(1);
   const actions=page.getByRole('navigation',{name:'Actions rapides'});const buttons=actions.getByRole('button');await buttons.first().focus();await page.keyboard.press('Tab');await expect(buttons.nth(1)).toBeFocused();expect(await buttons.nth(1).evaluate(e=>getComputedStyle(e).outlineStyle)).not.toBe('none');
   if(width<1100){await page.locator('.cockpitHeading button').focus();await page.keyboard.press('Tab');await expect(buttons.first()).toBeFocused();}
   await page.emulateMedia({reducedMotion:'reduce'});expect(await buttons.first().evaluate(e=>getComputedStyle(e).transitionDuration)).toBe('0s');await page.emulateMedia({reducedMotion:'no-preference'});
   for(const brand of await page.locator('.brandMark').all())await expect(brand).toHaveAccessibleName('MicroAssist');
   const footer=page.locator('.siteFooter');await footer.scrollIntoViewIfNeeded();
   const contrast=async locator=>locator.evaluateAll(es=>es.map(e=>{
    const lum=c=>{const v=c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return v[0]*.2126+v[1]*.7152+v[2]*.0722;};
    let n=e,bg;while(n){bg=getComputedStyle(n).backgroundColor;if(!['rgba(0, 0, 0, 0)','transparent'].includes(bg))break;n=n.parentElement;}
    const a=lum(getComputedStyle(e).color),b=lum(bg);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   }));
   expect((await contrast(footer.locator('h3,a,.brandMicro,.brandAssist'))).every(v=>v>=4.5)).toBe(true);
   expect(await page.locator('.topbar .brandMark').evaluate(e=>{const s=getComputedStyle(e);return parseFloat(s.fontSize)>=24&&Number(s.fontWeight)>=700;})).toBe(true);
   expect((await contrast(page.locator('.topbar .brandMicro,.topbar .brandAssist'))).every(v=>v>=3)).toBe(true);
   const link=footer.locator('a').first();await link.hover();expect((await contrast(link))[0]).toBeGreaterThanOrEqual(4.5);await link.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');await expect(link).toBeFocused();expect(await link.evaluate(e=>getComputedStyle(e).outlineStyle)).not.toBe('none');
   if(fixture.name==='guest-filled'&&[320,1440].includes(width)){
    await footer.screenshot({path:`${root}/footer-${width}.png`});
    const figure=page.getByRole('figure',{name:'Évolution des revenus encaissés'});await figure.screenshot({path:`${root}/encaissements-${width}.png`});
    await expect(figure.locator('.historyList')).toContainText('1 234,56 €');
    await expect(figure.locator('.historyList')).toContainText('78,9 €');
   }
   await dashboard.scrollIntoViewIfNeeded();
   if(['unavailable','guest-empty'].includes(fixture.name))await expect(dashboard.locator('.cockpitAllocation')).toHaveCount(0);
   if(fixture.name==='zero'){expect(snapshot.metrics.every(t=>/^0\s*€$/.test(t))).toBe(true);await expect(dashboard.locator('.cockpitAllocation')).toHaveCount(0);}
   if(fixture.name==='provisional')await expect(dashboard.locator('.cockpitMarkers')).toContainText('Estimation provisoire');
  }
  if([320,1440].includes(width)&&['guest-filled','guest-empty','unavailable'].includes(fixture.name))await page.screenshot({path:`${root}/${before?'before':'after'}-${fixture.name}-${width}.png`});
 }
 if(!before){
  if(fixture.name==='guest-filled'){
   await page.locator('.siteFooter').getByRole('link',{name:'Factures',exact:true}).click();
   await expect.poll(()=>page.locator('#invoices-section').evaluate(e=>{const r=e.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;})).toBe(true);
   await page.locator('.siteFooter').getByRole('link',{name:'Politique de confidentialité',exact:true}).click();
   await expect(page.locator('.legalHero h1')).toHaveText('Politique de confidentialité');
   await page.getByRole('link',{name:'Retour à Microassist',exact:true}).click();
   await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Mon espace fiscal',exact:true}).click();
  }
  const add=page.getByRole('navigation',{name:'Actions rapides'}).getByRole('button',{name:'Ajouter un revenu',exact:true});await add.click();const modal=page.getByRole('dialog',{name:'Ajouter revenu'});await expect(modal).toBeVisible();await expect(page.locator('.dashboardMobileActionBar')).toBeHidden();await modal.getByRole('button',{name:'Annuler',exact:true}).click();
  await page.reload({waitUntil:'domcontentloaded'});if(!fixture.profile){await page.getByRole('button',{name:'Fermer l’onboarding'}).click();}await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Mon espace fiscal',exact:true}).click();await expect(dashboard).toBeVisible();expect(normalize(await data())).toEqual(business);
 }
 expect(state.errors).toEqual([]);expect(state.writes).toEqual([]);
});

test('chart long amounts and zero at 320',async({context,page})=>{
 const rows=[123456789.12,0,999999999.12,1,50000,10].map((amount,i)=>({id:`long-${i}`,amount,date:`2026-${String(i+5).padStart(2,'0')}-01`}));
 const state=await setupRevenueFixture(context,{...revenueFixtures[1],rows});page.on('pageerror',e=>state.errors.push(e.message));
 await page.setViewportSize({width:320,height:900});await openFixtureDashboard(page,revenueFixtures[1],expect);
 const chart=page.getByRole('figure',{name:'Évolution des revenus encaissés'});
 await chart.locator('summary').click();await expect(chart.locator('details')).not.toHaveAttribute('open');
 const labels=chart.locator('.chartValue');await expect(labels).toHaveText(['123 456 789,12 €','0 €','999 999 999,12 €','1 €','50 000 €','10 €']);
 const viewport=chart.locator('.revenueChartViewport');
 for(const label of await labels.all()){
  await label.scrollIntoViewIfNeeded();await expect(label).toBeInViewport();
  expect(await label.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
  expect(await label.evaluate(e=>e.getBoundingClientRect().bottom<=e.nextElementSibling.getBoundingClientRect().top)).toBe(true);
 }
 await chart.screenshot({path:`${root}/chart-long-zero-320.png`});
 await labels.first().scrollIntoViewIfNeeded();await viewport.focus();const left=await viewport.evaluate(e=>e.scrollLeft);await page.keyboard.press('ArrowRight');await expect.poll(()=>viewport.evaluate(e=>e.scrollLeft)).toBeGreaterThan(left);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(state.errors).toEqual([]);expect(state.writes).toEqual([]);
});
