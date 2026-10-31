import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import process from 'node:process';
import {setupRevenueFixture,revenueFixtures} from './support/revenues-mobile-fixtures.js';
const before=process.env.BUSINESS_FOCUS_BEFORE==='1',root='output/business-modal-focus';
const settle=page=>page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
async function start(context,page,width){await page.setViewportSize({width,height:900});const state=await setupRevenueFixture(context,revenueFixtures[1]);page.on('pageerror',e=>state.errors.push(e.message));await page.goto("/?view=dashboard");return state;}
async function trap(page,dialog){
 const items=dialog.locator('button,a[href],input,select,textarea,[tabindex]').filter({visible:true});
 await items.first().focus();await page.keyboard.press('Shift+Tab');await expect(items.last()).toBeFocused();
 await page.keyboard.press('Tab');await expect(items.first()).toBeFocused();
 for(let i=0;i<8;i++){await page.keyboard.press('Tab');expect(await dialog.evaluate(e=>e.contains(document.activeElement))).toBe(true);}
}
for(const width of [320,1440])test(`business forms focus ${width}`,async({context,page})=>{
 const state=await start(context,page,width),records=[];
 for(const [label,selector]of [['Ajouter un revenu','[aria-labelledby="add-revenue-title"]'],['Créer une facture','.invoiceGeneratorModal']]){
  const trigger=page.getByRole('navigation',{name:'Actions rapides'}).getByRole('button',{name:label,exact:true});await trigger.click();
  const dialog=page.locator(selector);await expect(dialog).toBeVisible();await settle(page);
  const record={label,initialInside:await dialog.evaluate(e=>e.contains(document.activeElement))};
  if(before)expect(record.initialInside).toBe(false);else{expect(record.initialInside).toBe(true);await trap(page,dialog);}
  await dialog.getByRole('button',{name:'Annuler',exact:true}).click();await expect(dialog).toBeHidden();await settle(page);
  record.restored=await trigger.evaluate(e=>e===document.activeElement);record.activeTag=await page.evaluate(()=>document.activeElement.tagName);
  if(before){expect(record.restored).toBe(false);expect(record.activeTag).toBe('BODY');}else await expect(trigger).toBeFocused();
  records.push(record);
 }
 await mkdir(root,{recursive:true});await writeFile(`${root}/${before?'before':'after'}-${width}.json`,JSON.stringify(records,null,2));
 expect(state.errors).toEqual([]);expect(state.writes).toEqual([]);
});

test('shared profile boundary retains Escape and fallback',async({context,page})=>{
 const state=await start(context,page,1440);
 await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Assistant',exact:true}).click();
 await page.locator('.assistantSummaryBox').filter({has:page.getByRole('heading',{name:'Mon profil',exact:true})})
  .getByRole('button',{name:'Modifier',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Configurer ton profil fiscal'});
 await expect(dialog.getByRole('button',{name:'Fermer l’onboarding'})).toBeFocused();
 await trap(page,dialog);await page.keyboard.press('Escape');await expect(dialog).toBeHidden();
 await expect(page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Accueil',exact:true})).toBeFocused();
 expect(await page.evaluate(()=>document.querySelectorAll('[inert]').length)).toBe(0);
 expect(state.errors).toEqual([]);expect(state.writes).toEqual([]);
});

for(const width of [320,1440])test(`application fallback and view ownership ${width}`,async({context,page})=>{
 const state=await start(context,page,width);
 const quick=page.getByRole('navigation',{name:'Actions rapides'});
 const add=quick.getByRole('button',{name:'Ajouter un revenu',exact:true});
 await add.focus();await page.keyboard.press('Enter');
 const dialog=page.getByRole('dialog',{name:'Ajouter revenu'});await expect(dialog).toBeVisible();
 await add.evaluate(el=>{el.hidden=true;});
 await dialog.getByRole('button',{name:'Annuler',exact:true}).click();
 await expect(quick.getByRole('button',{name:'Créer une facture',exact:true})).toBeFocused();
 await page.locator('.cockpitActions button').first().evaluate(el=>{el.hidden=false;});
 await add.click();await expect(dialog).toBeVisible();
 for(const view of ['landing','dashboard']){
  await page.evaluate(v=>{const state={appView:v};history.pushState(state,'',`/?view=${v}`);dispatchEvent(new PopStateEvent('popstate',{state}));},view);
  await settle(page);
  if(view==='landing')await expect(page.locator('.dashboardCard')).toBeHidden();
  else await expect(page.locator('.dashboardCard')).toBeVisible();
 }
 await dialog.getByRole('button',{name:'Annuler',exact:true}).click();await settle(page);
 await expect(add).not.toBeFocused();
 expect(state.errors).toEqual([]);expect(state.writes).toEqual([]);
});


for(const width of [320,1440])test(`entry points and closing modes ${width}`,async({context,page})=>{
 const state=await start(context,page,width);
 const original=await page.evaluate(()=>[localStorage.getItem('revenues_guest'),localStorage.getItem('guest_invoices')]);
 const entries=[
  [page.locator('#revenues-section').getByRole('button',{name:'Ajouter un revenu',exact:true}),'[aria-labelledby="add-revenue-title"]'],
  [page.locator('#invoices-section .journalHeader').getByRole('button',{name:'Cr\u00e9er une facture',exact:true}),'.invoiceGeneratorModal'],
  [page.getByRole('button',{name:'Cr\u00e9er une facture depuis un revenu',exact:true}),'.invoiceGeneratorModal'],
 ];
 if(width===320)entries.push([page.locator('.dashboardMobileActionBar button'),'[aria-labelledby="add-revenue-title"]']);
 for(const [trigger,selector]of entries){
  for(const close of ['cross','backdrop']){
   await trigger.click();const dialog=page.locator(selector);await expect(dialog).toBeVisible();await settle(page);
   expect(await dialog.evaluate(e=>e.contains(document.activeElement))).toBe(true);
   await trap(page,dialog);
   if(width===320)await expect(page.locator('.dashboardMobileActionBar')).toBeHidden();
   if(close==='cross')await dialog.locator('button.iconBtn').first().click();
   else await dialog.locator('..').click({position:{x:2,y:2}});
   await expect(dialog).toBeHidden();await expect(trigger).toBeFocused();
  }
 }
 expect(await page.evaluate(()=>[localStorage.getItem('revenues_guest'),localStorage.getItem('guest_invoices')])).toEqual(original);
 expect(state.errors).toEqual([]);expect(state.writes).toEqual([]);
});

for(const width of [320,1440])test(`restoration lifecycle ${width}`,async({context,page})=>{
 const state=await start(context,page,width);
 // Exercise the real boundary independently of business handlers; no auth or data mutation.
 await page.evaluate(async()=>{
  const reactModule=await import('/node_modules/.vite/deps/react.js');
  const clientModule=await import('/node_modules/.vite/deps/react-dom_client.js');
  const domModule=await import('/node_modules/.vite/deps/react-dom.js');
  const React=reactModule.default || reactModule;
  const {createRoot}=clientModule.default || clientModule;
  const {flushSync}=domModule.default || domModule;
  const {default:Boundary}=await import('/src/components/profile/ModalFocusBoundary.jsx');
  document.getElementById('root').hidden=true;
  const e=React.createElement,host=document.createElement('div');document.body.append(host);
  const root=createRoot(host),owner={current:null};let modal=null,trigger=true,scope='original',nested=false;
  function render(){flushSync(()=>root.render(e('div',null,
   trigger&&e('button',{id:'fixture-trigger',onClick:()=>open('one')},'Open fixture'),
   e('div',{className:'topbar'},e('button',{id:'fixture-fallback'},'Fixture fallback')),
   e('button',{id:'fixture-sentinel'},'New view focus'),
   modal&&e(Boundary,{key:modal,returnFocusRef:owner,canRestoreFocus:o=>o.scope===scope},
    e('div',{role:'dialog','aria-label':'Fixture '+modal},e('button',{id:'fixture-first'},'First'),e('button',{id:'fixture-last'},'Last'),
     nested&&e(Boundary,null,e('div',{role:'dialog','aria-label':'Nested fixture'},e('button',null,'Nested first'),e('button',null,'Nested last')))))
  )));}
  function open(name){owner.current={trigger:document.activeElement,scope};modal=name;render();}
  window.focusFixture={open,close(){modal=null;render();},remove(){trigger=false;render();},
   closeWithChild(){modal=null;nested=false;render();document.getElementById('fixture-sentinel').focus();},
   change(next){scope=next;modal=null;render();document.getElementById('fixture-sentinel').focus();},
   nest(value){nested=value;render();},
   replace(){modal=null;render();open('two');},cleanup(){flushSync(()=>root.unmount());host.remove();}};
  render();
 });
 const trigger=page.locator('#fixture-trigger'),fallback=page.locator('#fixture-fallback');
 await trigger.click();let dialog=page.getByRole('dialog',{name:'Fixture one'});await trap(page,dialog);
 await page.locator('#fixture-last').focus();await page.evaluate(()=>window.focusFixture.nest(true));
 await trap(page,page.getByRole('dialog',{name:'Nested fixture'}));
 await page.evaluate(()=>window.focusFixture.nest(false));await expect(page.locator('#fixture-last')).toBeFocused();
 await page.evaluate(()=>window.focusFixture.nest(true));await page.evaluate(()=>window.focusFixture.closeWithChild());
 await settle(page);await expect(page.locator('#fixture-sentinel')).toBeFocused();
 await trigger.click();await page.evaluate(()=>window.focusFixture.nest(false));
 await page.evaluate(()=>window.focusFixture.remove());await page.evaluate(()=>window.focusFixture.close());await expect(fallback).toBeFocused();
 for(const scope of ['view-change','user-change']){
  await fallback.focus();await page.evaluate(()=>window.focusFixture.open('one'));
  await page.evaluate(s=>window.focusFixture.change(s),scope);await settle(page);await expect(page.locator('#fixture-sentinel')).toBeFocused();
 }
 await page.evaluate(()=>window.focusFixture.open('one'));await page.evaluate(()=>window.focusFixture.replace());
 dialog=page.getByRole('dialog',{name:'Fixture two'});await settle(page);await expect(dialog.locator('button').first()).toBeFocused();await trap(page,dialog);
 await page.evaluate(()=>window.focusFixture.cleanup());await settle(page);
 expect(state.errors).toEqual([]);expect(state.writes).toEqual([]);
});
