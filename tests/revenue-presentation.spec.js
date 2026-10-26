import {test,expect} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import process from 'node:process';
import {revenueFixtures,setupRevenueFixture,openFixtureDashboard} from './support/revenues-mobile-fixtures.js';
const baseline=process.env.REVENUE_BASELINE==='1',root=process.env.REVENUE_REVIEW_DIR||'test-results/revenue-presentation';
const digest=text=>createHash('sha256').update(text).digest('hex');
async function snapshot(section,page){return {title:await section.locator('.dashboardSectionTitle').first().textContent(),summary:await section.locator('.dashboardSectionSubtitle').first().textContent(),cards:await section.locator('.revenuesList > .revenueItem').allTextContents(),months:await section.locator('.monthFilter option').allTextContents(),selected:await section.locator('.monthFilter').inputValue(),csvDisabled:await section.getByRole('button',{name:'Export CSV',exact:true}).isDisabled(),pdfDisabled:await section.getByRole('button',{name:'📄 Export PDF',exact:true}).isDisabled(),history:await section.locator('.monthlyHistory').count()?await section.locator('.monthlyHistory').textContent():null,raw:await page.evaluate(()=>({revenues:localStorage.getItem('revenues_guest'),invoices:localStorage.getItem('guest_invoices')}))};}
for(const f of revenueFixtures)test(`revenue presentation ${f.name}`,async({context,page})=>{
 const state=await setupRevenueFixture(context,f);page.on('pageerror',e=>state.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')state.consoleErrors.push(m.text());});
 await page.clock.install({time:new Date('2026-10-26T09:00:00Z')});await openFixtureDashboard(page,f,expect);
 const section=page.locator('#revenues-section');await expect(section).toBeVisible();
 if(f.rows.length&&!f.loading&&!f.error)await expect(section.locator('.revenuesList > .revenueItem')).toHaveCount(f.rows.length);
 const initial=await snapshot(section,page);await mkdir(root,{recursive:true});
 if(!baseline&&process.env.REVENUE_REVIEW_DIR)expect(initial).toEqual(JSON.parse(await readFile(`${root}/baseline-${f.name}.json`,'utf8')).initial);
 const record={initial,exports:[],filtered:null};
 for(const width of [1440,768,390,320]){
  await page.setViewportSize({width,height:1000});await section.scrollIntoViewIfNeeded();
  if(!baseline){
   expect(await section.evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
   const overflow=await section.locator('button,summary,select,.revenueAmount,.revenueDate').evaluateAll(els=>els.filter(el=>{const r=el.getBoundingClientRect();return r.width&&(r.left<-.5||r.right>innerWidth+.5);}).map(e=>e.textContent));expect(overflow).toEqual([]);
   const summary=section.locator('details.revenueExplanation > summary');await summary.focus();await page.keyboard.press('Enter');await expect(summary.locator('..')).toHaveAttribute('open','');await page.keyboard.press('Space');await expect(summary.locator('..')).not.toHaveAttribute('open','');await expect(summary).toBeFocused();
  }
  await section.screenshot({path:`${root}/${baseline?'before':'after'}-${f.name}-${width}.png`});
 }
 const options=await section.locator('.monthFilter option').evaluateAll(els=>els.map(e=>e.value));
 if(options.length>1){await section.locator('.monthFilter').selectOption(options[1]);record.filtered=await snapshot(section,page);await section.locator('.monthFilter').selectOption('all');}
 if(!f.loading&&!f.error){
  for(const [name,type]of [['Export CSV','csv'],['📄 Export PDF','pdf']]){
   const button=section.getByRole('button',{name,exact:true});
   if(await button.isEnabled()){
    const pending=page.waitForEvent('download');await button.click();const download=await pending;const bytes=await readFile(await download.path());expect(await download.failure()).toBeNull();
    const content=type==='csv'?bytes.toString('utf8'):bytes.toString('latin1').replace(/\/CreationDate \([^)]*\)/g,'/CreationDate (fixed)').replace(/\/ID\s*\[\s*<[A-Fa-f0-9]+>\s*<[A-Fa-f0-9]+>\s*\]/g,'/ID [fixed]');
    record.exports.push({type,name:download.suggestedFilename(),contentSha256:digest(content)});await writeFile(`${root}/${baseline?'baseline':'candidate'}-${f.name}.${type}`,bytes);
   }else record.exports.push({type,disabled:true});
  }
  // Opening/closing is checked in both versions, addition remains local or entirely mocked.
  const add=baseline?section.getByRole('button',{name:'Ajouter un revenu',exact:true}):section.locator('.journalHeader').getByRole('button',{name:'Ajouter un revenu',exact:true});
  if(!baseline||await add.count()){
   await add.click();const dialog=page.getByRole('dialog',{name:'Ajouter revenu'});await expect(dialog).toBeVisible();await expect(page.locator('.dashboardMobileActionBar')).toBeHidden();await dialog.getByRole('button',{name:'Fermer',exact:true}).click();
  }
 }
 if(!baseline&&process.env.REVENUE_REVIEW_DIR){const before=JSON.parse(await readFile(`${root}/baseline-${f.name}.json`,'utf8'));expect(record.filtered).toEqual(before.filtered);expect(record.exports).toEqual(before.exports);}
 expect(await page.evaluate(()=>localStorage.getItem('guest_invoices'))).toBe(initial.raw.invoices);expect(await page.evaluate(()=>localStorage.getItem('revenues_guest'))).toBe(initial.raw.revenues);
 expect(state.writes.filter(w=>w.path==='/rest/v1/invoices')).toEqual([]);expect(state.errors).toEqual([]);if(f.error)expect(state.consoleErrors.some(t=>t.includes('Synthetic revenue read unavailable'))).toBe(true);else expect(state.consoleErrors).toEqual([]);
 record.consoleErrors=state.consoleErrors;await writeFile(`${root}/${baseline?'baseline':'candidate'}-${f.name}.json`,JSON.stringify(record,null,2));state.release();
});

test('add a synthetic revenue and keep the invoice link action',async({context,page})=>{
 const f={...revenueFixtures[1],rows:[]},state=await setupRevenueFixture(context,f);await openFixtureDashboard(page,f,expect);
 const section=page.locator('#revenues-section');await section.getByRole('button',{name:'Ajouter un revenu',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Ajouter revenu'});await dialog.getByLabel('Montant (€)',{exact:true}).fill('123.45');await dialog.getByRole('button',{name:'Enregistrer',exact:true}).click();await expect(dialog).toBeHidden();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('revenues_guest')));expect(saved).toHaveLength(1);expect(saved[0].amount).toBe(123.45);await expect(page.locator('#invoices-section').getByRole('button',{name:'Créer une facture depuis un revenu',exact:true})).toBeVisible();
 await page.locator('#invoices-section').getByRole('button',{name:'Créer une facture depuis un revenu',exact:true}).click();await expect(page.getByLabel('Client *',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Annuler',exact:true}).click();
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('revenues_guest')))).toEqual(saved);expect(state.writes).toEqual([]);state.release();
});
