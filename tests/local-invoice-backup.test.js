import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { getInvoiceComplianceScore, getInvoiceTotals, generateFacturXXml } from '../src/utils/facturx.js';
import {BACKUP_FORMAT,MAX_BACKUP_BYTES,MAX_INVOICES,createBackup,parseBackup,readCurrentInvoices,previewRestore,confirmRestore,canonical} from '../src/application/invoices/localInvoiceBackup.js';
const classic={id:'classic',invoice_number:'SAME',client_name:'Тестовий клієнт — Київ, ї є ґ і',description:'тест — Élodie François',amount:9.96,invoice_date:'2026-10-24',status:'paid',paid_at:'2026-10-24T10:00:00Z',notes:{custom:'préservé'}};
const fx={id:'fx',invoiceNumber:'SAME',buyer:{name:'тест',address:'Київ'},seller:{name:'Élodie François'},lines:[{description:'тест',quantity:1,unitPrice:9.96,totalHT:9.96,totalTVA:0,totalTTC:9.96}],totals:{totalTTC:9.96},localOnly:true,formatStatus:'facturx_ready_draft',transmissionStatus:'not_transmitted',statuses:['Brouillon']};
const file=invoices=>JSON.stringify({format:BACKUP_FORMAT,version:1,exportedAt:'2026-10-24T10:00:00Z',invoices});
const state=invoices=>readCurrentInvoices(()=>invoices===null?null:JSON.stringify(invoices));

test('export reads once, preserves all compatible JSON fields, Unicode, paid status and sources',()=>{
 const raw=JSON.stringify([classic,fx,{invoice_number:'NO-ID',description:'historique'}]);let reads=0;
 const json=createBackup(()=>{reads++;return raw;},'2026-10-24T10:00:00Z');
 assert.equal(reads,1);assert.deepEqual(parseBackup(json),JSON.parse(raw));
 assert.equal(JSON.stringify(JSON.parse(raw)),raw);assert.ok(!json.includes('access_token'));
});
test('empty, inaccessible or invalid source never produces a misleading empty backup',()=>{
 for(const read of [()=>null,()=>'[]',()=>'{broken',()=>{throw Error();},()=>'{}',()=>'[{"amount":"oops"}]'])assert.throws(()=>createBackup(read));
});
test('restore into empty storage then repeat never duplicates and never adds ownership or flags',()=>{
 let raw=null,writes=0;const incoming=parseBackup(file([classic,fx]));
 const preview=previewRestore(incoming,readCurrentInvoices(()=>raw));assert.equal(raw,null);assert.equal(preview.counts.additions,2);
 const result=confirmRestore(preview,()=>raw,value=>{writes++;raw=value;});assert.equal(result.kind,'written');assert.deepEqual(JSON.parse(raw),[classic,fx]);
 const repeat=previewRestore(incoming,readCurrentInvoices(()=>raw));assert.deepEqual(repeat.counts,{additions:0,duplicates:2,conflicts:0,refused:0});
 assert.equal(confirmRestore(repeat,()=>raw,()=>{writes++;}).kind,'nothing');assert.equal(writes,1);
 assert.ok(!Object.hasOwn(JSON.parse(raw)[0],'localOnly'));assert.ok(!Object.hasOwn(JSON.parse(raw)[0],'user_id'));
});
test('object key order is ignored but numbers are not used as identities',()=>{
 const reordered=Object.fromEntries(Object.entries(classic).reverse());assert.equal(canonical(classic),canonical(reordered));
 assert.equal(previewRestore([reordered,fx],state([classic])).counts.additions,1);
});
test('all members of an internally conflicting id group are withheld, regardless of order',()=>{
 for(const entries of [[classic,{...classic,amount:12},classic],[{...classic,amount:12},classic,classic]]){
  const p=previewRestore(entries,state([]));assert.equal(p.counts.conflicts,3);assert.equal(p.additions.length,0);
 }
});
test('internal identical duplicates and existing conflicts are counted conservatively',()=>{
 const p=previewRestore([classic,classic,fx],state([{...fx,description:'different'}]));assert.deepEqual(p.counts,{additions:1,duplicates:1,conflicts:1,refused:0});
 const existingConflict=previewRestore([classic],state([classic,{...classic,amount:12}]));assert.equal(existingConflict.counts.conflicts,1);
});
test('numeric historical ids are retained, numeric/string collision becomes conflict',()=>{
 const p=previewRestore([{...classic,id:42}],state([]));assert.equal(p.additions[0].id,42);
 assert.equal(previewRestore([{...classic,id:'42'}],state([{...classic,id:42}])).counts.conflicts,1);
});
test('missing unusable id, ownership and malformed entries are refused without altering valid entries',()=>{
 const incoming=[{}, {...classic,id:' '},{...classic,user_id:'account'},{...classic,amount:'9.96'},{...classic,invoice_date:'2026-02-30'},null,fx];
 const p=previewRestore(incoming,state([]));assert.equal(p.counts.refused,6);assert.deepEqual(p.additions,[fx]);
});
for(const bad of ['{bad',JSON.stringify({format:BACKUP_FORMAT,version:2,invoices:[]}),file(Array(MAX_INVOICES+1).fill(classic)),' '.repeat(MAX_BACKUP_BYTES+1)]) {
 test(`unsupported/malformed/excessive file rejected (${bad.length} bytes/chars)`,()=>assert.throws(()=>parseBackup(bad)));
}
test('prototype keys, session/token aliases and unsafe nested data are never copied',()=>{
 for(const key of ['__proto__','constructor','prototype','refreshToken','access_token','session','apiKey']){
  const entry=JSON.parse(`{"id":"bad","metadata":{"${key}":"private"}}`);
  assert.equal(previewRestore([entry],state([])).counts.refused,1);
  assert.throws(()=>createBackup(()=>JSON.stringify([entry])));
 }
 assert.equal({}.polluted,undefined);
});
test('source change requires a new preview and a new confirmation',()=>{
 let raw='[]',writes=0;const p=previewRestore([classic],readCurrentInvoices(()=>raw));raw=JSON.stringify([fx]);
 const changed=confirmRestore(p,()=>raw,()=>writes++);assert.equal(changed.kind,'changed');assert.equal(writes,0);assert.equal(changed.preview.counts.additions,1);
 confirmRestore(changed.preview,()=>raw,value=>{writes++;raw=value;});assert.equal(writes,1);assert.deepEqual(JSON.parse(raw),[fx,classic]);
});
test('invalid/inaccessible current source blocks confirmation, quota does not announce or mutate',()=>{
 const p=previewRestore([classic],state([]));let raw='[]';
 for(const read of [()=>'{bad',()=>{throw Error();}])assert.throws(()=>confirmRestore(p,read,()=>assert.fail('must not write')));
 assert.throws(()=>confirmRestore(p,()=>raw,()=>{throw Error('quota');}),/quota/);assert.equal(raw,'[]');
});
test('combined count, text complexity and nested field types are bounded',()=>{
 const current=Array.from({length:1000},(_,i)=>({...classic,id:String(i)}));
 assert.throws(()=>previewRestore([fx],state(current)),/1 000/);
 for(const entry of [{...fx,buyer:[]},{...fx,lines:[null]},{...classic,client_name:'x'.repeat(20001)},{...classic,status:'invalid'},{...fx,lines:[{quantity:-1}]}])assert.equal(previewRestore([entry],state([])).counts.refused,1);
});

test('a refused entry blocks other entries with its identity instead of silently selecting one',()=>{
 const p=previewRestore([classic,{...classic,amount:'invalid'},fx],state([]));
 assert.deepEqual(p.counts,{additions:1,duplicates:0,conflicts:1,refused:1});
 assert.deepEqual(p.additions,[fx]);
});

const regression = parseBackup(readFileSync(new URL('../docs/local-invoice-backup/examples/malformed-consumer.json', import.meta.url), 'utf8'));
test('exact P1 fixture is refused before confirmation without changing prior storage',()=>{
 const before=JSON.stringify([classic]);let raw=before,writes=0;
 const p=previewRestore(regression,readCurrentInvoices(()=>raw));
 assert.deepEqual(p.counts,{additions:0,duplicates:0,conflicts:0,refused:1});
 assert.match(p.issues[0].reason,/facture\.seller_siret/);
 assert.equal(confirmRestore(p,()=>raw,()=>writes++).kind,'nothing');
 assert.equal(writes,0);assert.equal(raw,before);
});

// Independent inventory of consumer reads: App.jsx, InvoiceGenerator.jsx,
// facturx.js, and the payment compatibility contract. Do not derive this from
// the validator's sets: a newly omitted consumer field must fail this matrix.
const textPaths = [
 ...['invoiceNumber','invoice_number','number','client_name','client_address','client_email','seller_siret','seller_name','seller_address','description','vatExemptionReason','paymentTerms','formatStatus','transmissionStatus'].map(key=>[key]),
 ...['seller','buyer','client'].flatMap(part=>['name','address','email','siret','vatNumber'].map(key=>[part,key])),
 ['lines',0,'description'],
];
const numberPaths = [
 ...['amount','vatRate'].map(key=>[key]),
 ...['quantity','unitPrice','vatRate','totalHT','totalTVA','totalTTC'].map(key=>['lines',0,key]),
 ...['totalHT','totalTVA','totalTTC'].map(key=>['totals',key]),
];
const booleanPaths = [['localOnly'],['is_compliant']];
const datePaths = ['issueDate','invoice_date','dueDate','due_date'].map(key=>[key]);
const timestampPaths = [['paid_at'],['paidAt']];
function withPath(path,value) {
 const invoice=structuredClone(fx);let target=invoice;
 for(const key of path.slice(0,-1))target=target[key]??= {};
 target[path.at(-1)]=value;return invoice;
}
for(const [kind,paths,bad] of [
 ['text',textPaths,[{},[],true,42]],
 ['number',numberPaths,[{},[],true,'10']],
 ['boolean',booleanPaths,[{},[],1,'true']],
 ['date',datePaths,[{},[],true,42,'2026-02-30']],
 ['timestamp',timestampPaths,[{},[],true,42,'not-a-date']],
]) {
 test(`consumed ${kind} fields reject incompatible types and retain historical nulls`,()=>{
  for(const path of paths){
   for(const value of bad){
    const p=previewRestore([withPath(path,value)],state([]));
    assert.equal(p.counts.refused,1,`${path.join('.')}=${JSON.stringify(value)}`);
    assert.equal(p.counts.additions,0);
   }
   const nullable=withPath(path,null),p=previewRestore([nullable],state([]));
   assert.equal(p.counts.additions,1,`${path.join('.')} null is a historical fallback`);
   assert.deepEqual(p.additions[0],nullable);
   assert.doesNotThrow(()=>getInvoiceComplianceScore(nullable));
   assert.doesNotThrow(()=>getInvoiceTotals(nullable));
   assert.doesNotThrow(()=>generateFacturXXml(nullable));
  }
 });
}
test('payment status and all consumed structures reject incompatible shapes',()=>{
 for(const id of [{toString:null},[],true,null,0])assert.equal(previewRestore([{...classic,id}],state([])).counts.refused,1);
 for(const value of [{},[],true,42,'unknown'])assert.equal(previewRestore([{...classic,status:value}],state([])).counts.refused,1);
 for(const key of ['seller','buyer','client','totals']){
  for(const value of [[],true,42,'text'])assert.equal(previewRestore([{...fx,[key]:value}],state([])).counts.refused,1,key);
  assert.equal(previewRestore([{...fx,[key]:null}],state([])).counts.additions,1);
 }
 for(const value of [{},true,42,'text',[null],[true],[[]],['text']])assert.equal(previewRestore([{...fx,lines:value}],state([])).counts.refused,1);
 for(const value of [{},true,42,'text',[null],[{}],[true]])assert.equal(previewRestore([{...fx,statuses:value}],state([])).counts.refused,1);
 for(const key of ['lines','statuses','status'])assert.equal(previewRestore([{...fx,[key]:null}],state([])).counts.additions,1);
});
test('mixed import retains valid historical fields and inert extensions verbatim',()=>{
 const historical={...classic,id:42,seller_siret:'12345678901234',seller_name:'Élodie — тест',seller_address:'Київ',
  metadata:{toString:null,seller_siret:{custom:true},amount:['extension',false,null]},
  seller:{name:'Élodie',seller_siret:{inert:true},extra:{name:{toString:null}}},lines:null,totals:null};
 const p=previewRestore([...regression,historical,fx],state([]));
 assert.deepEqual(p.counts,{additions:2,duplicates:0,conflicts:0,refused:1});
 let raw='[]';confirmRestore(p,()=>raw,value=>{raw=value;});
 assert.deepEqual(JSON.parse(raw),[historical,fx]);
 for(const invoice of JSON.parse(raw)){
  assert.doesNotThrow(()=>getInvoiceComplianceScore(invoice));
  assert.doesNotThrow(()=>generateFacturXXml(invoice));
 }
 assert.deepEqual(previewRestore([...regression,historical,fx],readCurrentInvoices(()=>raw)).counts,{additions:0,duplicates:2,conflicts:0,refused:1});
});
test('confirmation revalidates incoming data and recalculates payload before any write',()=>{
 let raw='[]',writes=0;const incoming=[structuredClone(classic),structuredClone(fx)];
 const p=previewRestore(incoming,readCurrentInvoices(()=>raw));
 incoming[0].seller_siret={toString:null};
 const result=confirmRestore(p,()=>raw,()=>writes++);
 assert.equal(result.kind,'changed');assert.equal(writes,0);assert.equal(raw,'[]');
 assert.deepEqual(result.preview.counts,{additions:1,duplicates:0,conflicts:0,refused:1});
 confirmRestore(result.preview,()=>raw,value=>{writes++;raw=value;});
 assert.equal(writes,1);assert.deepEqual(JSON.parse(raw),[fx]);
 const cached=previewRestore([classic],state([]));cached.serialized=JSON.stringify(regression);cached.additions=regression;
 const recalculated=confirmRestore(cached,()=>'[]',()=>assert.fail('stale payload must not be written'));
 assert.equal(recalculated.kind,'changed');assert.deepEqual(recalculated.preview.additions,[classic]);
});
