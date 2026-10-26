import {installOfflineSockets} from './offline-services.js';
export const accountId='11111111-1111-4111-8111-111111111111';
export const fiscalProfile={user_id:accountId,activity_type:'services',declaration_frequency:'mensuel',acre:'no',business_start_date:'2026-01-01'};
export const revenueRows=[
 {id:'r-oct',amount:1234.56,date:'2026-10-05',revenue_category:'service',client:'Élodie François — Київ',invoice:'SYNTHETIC-É-01',note:'Prestation synthétique — тест'},
 {id:'r-zero',amount:0,date:'2026-10-01',client:'Client zéro',invoice:'ZERO',note:''},
 {id:'r-sep',amount:78.9,date:'2026-09-20',client:'Client septembre',invoice:'SYNTHETIC-02',note:'À conserver'},
];
export const revenueFixtures=[
 {name:'guest-empty',guest:true,rows:[]},
 {name:'guest-filled',guest:true,profile:true,rows:revenueRows},
 {name:'free',profile:true,rows:revenueRows},
 {name:'premium',profile:true,premium:true,rows:revenueRows},
 {name:'quota',profile:true,quota:3,rows:revenueRows},
 {name:'provisional',guest:true,profile:true,estimated:true,rows:[]},
 {name:'loading',profile:true,loading:true,rows:revenueRows},
 {name:'error',profile:true,error:true,rows:revenueRows},
];
export async function setupRevenueFixture(context,f){
 await installOfflineSockets(context);
 const writes=[],errors=[],consoleErrors=[];let release;
 const gate=new Promise(resolve=>{release=resolve;});
 let rows=(f.rows||[]).map(row=>({...row,revenue_date:row.date,created_at:'2026-10-05T10:00:00Z'}));
 const user={id:accountId,email:f.email||'synthetic@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},identities:[]};
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(['127.0.0.1','localhost'].includes(url.hostname))return route.continue();
  if(!['GET','HEAD','OPTIONS'].includes(req.method())){
   let body;try{body=req.postDataJSON();}catch{body=null;}
   writes.push({path:url.pathname,method:req.method(),query:url.search,body});
   if(url.pathname==='/rest/v1/revenues'&&req.method()==='POST'){
    const row={...body,id:'synthetic-added',created_at:'2026-10-26T09:00:00Z'};rows=[row,...rows];return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(row)});
   }
   if(url.pathname==='/rest/v1/revenues'&&req.method()==='DELETE')rows=rows.filter(row=>!url.search.includes('id=eq.'+row.id));
  }
  if(url.pathname==='/rest/v1/revenues'&&f.loading)await gate;
  if(url.pathname==='/rest/v1/revenues'&&f.error)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Synthetic revenue read unavailable'})});
  const body=url.pathname==='/auth/v1/user'?user:url.pathname==='/rest/v1/profiles'?{id:accountId,onboarding_completed:true,is_premium:!!f.premium,subscription_status:f.premium?'active':null}:url.pathname==='/rest/v1/fiscal_profiles'?fiscalProfile:url.pathname==='/rest/v1/revenues'?rows:url.pathname.includes('/rest/v1/')?[]:{};
  try{return await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});}catch{ /* Held requests can close with their synthetic context. */ }
 });
 await context.addInitScript(({f,user,fiscalProfile})=>{
  if(localStorage.getItem('revenue_fixture_seeded'))return;
  localStorage.setItem('revenue_fixture_seeded','1');localStorage.setItem('beta_seen','1');
  localStorage.setItem('revenues_guest',JSON.stringify(f.guest?f.rows||[]:[]));
  localStorage.setItem('guest_invoices',JSON.stringify(f.invoices||[]));
  if(f.profile)localStorage.setItem('microassist_v1',JSON.stringify({version:1,answers:{entry_status:'micro_yes',status:'auto_entrepreneur',...fiscalProfile},messages:[]}));
  if(f.estimated)localStorage.setItem('microassist_profile_v1',JSON.stringify({activity_type:'services',declaration_frequency:'mensuel',starter_monthly_revenue:1800,monthly_revenue:1800,data_quality:'estimated'}));
  if(f.quota)localStorage.setItem('microassist_exports_2026_10',JSON.stringify({csv:0,pdf:f.quota,total:f.quota}));
  if(!f.guest){
   const exp=4102444800,enc=v=>btoa(JSON.stringify(v)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
   localStorage.setItem('sb-bvymwuokljxgoavfehav-auth-token',JSON.stringify({access_token:`${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:user.id,aud:'authenticated',exp})}.synthetic`,refresh_token:'synthetic-refresh',token_type:'bearer',expires_at:exp,expires_in:3600,user}));if(!f.loading)localStorage.setItem('microassist_pending_auth_success','manual_auth');
  }
 },{f,user,fiscalProfile});
 return {writes,errors,consoleErrors,release};
}

export async function openFixtureDashboard(page,f,expect){
 await page.goto('/');
 if(f.guest&&!f.profile){const wizard=page.getByRole('dialog',{name:'Configurer ton profil fiscal'});await expect(wizard).toBeVisible();await wizard.getByRole('button',{name:'Fermer l’onboarding'}).click();}
 if(!f.guest){await expect(page.getByText(`Connectée : ${f.email||'synthetic@example.test'}`,{exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>localStorage.getItem('microassist_pending_auth_success'))).toBeNull();await expect(page.getByText('Connexion réussie. Le profil fiscal du compte a été chargé.',{exact:true})).toHaveCount(0,{timeout:10000});}
 await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'Mon espace fiscal',exact:true}).click();
}
