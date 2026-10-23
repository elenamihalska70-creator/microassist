import assert from 'node:assert/strict';
import test from 'node:test';
import { InvoicePdfError, invoicePdfErrorMessage } from '../src/utils/invoicePdfErrors.js';

const valid = new Uint8Array([0,1,0,0,8,9]);
let instance = 0;
async function loader() { return import(`../src/utils/invoicePdfFonts.js?test=${instance++}`); }

test('font loading is lazy, concurrent requests share the same promise and success is reused', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async url => { calls.push(url); return {ok:true,arrayBuffer:async()=>valid.buffer}; };
  try {
    const {loadInvoicePdfFonts:load}=await loader();
    assert.equal(calls.length,0);
    const first=load();assert.equal(load(),first);
    const result=await first;
    assert.equal(calls.length,2);assert.equal(result.length,2);
    assert.ok(calls.every(url=>url.endsWith('.ttf')));
    assert.equal(await load(),result);assert.equal(calls.length,2);
  } finally {globalThis.fetch=original;}
});

for(const failure of ['http','network','invalid-font']) {
  test(`failed ${failure} font batch settles, is shared, and can be retried`,async()=>{
    const original=globalThis.fetch;let calls=0,fail=true;
    globalThis.fetch=async()=>{
      calls++;
      if(fail&&failure==='network')throw Error('synthetic connection failure');
      return {ok:!(fail&&failure==='http'),arrayBuffer:async()=>fail&&failure==='invalid-font'?new Uint8Array([60,104,116,109]).buffer:valid.buffer};
    };
    try {
      const {loadInvoicePdfFonts:load}=await loader();
      const first=load();assert.equal(load(),first);
      await assert.rejects(first,error=>error.code==='font-load');assert.equal(calls,2);
      fail=false;await load();assert.equal(calls,4);await load();assert.equal(calls,4);
    }finally{globalThis.fetch=original;}
  });
}

test('unsupported character error identifies character and field with context-appropriate guidance',()=>{
  const error=new InvoicePdfError('unsupported-glyph',{character:'🙂',field:'Client'});
  const create=invoicePdfErrorMessage(error,{editable:true});
  assert.match(create,/🙂.*U\+1F642.*Client/);assert.match(create,/Corrige ce champ/);assert.match(create,/conservées/);
  const historical=invoicePdfErrorMessage(error);
  assert.match(historical,/🙂.*Client/);assert.match(historical,/n’est pas modifiable ici/);assert.doesNotMatch(historical,/Corrige|modifie le champ/i);
});
test('load and generic errors offer retry without exposing internal errors or claiming success',()=>{
  assert.match(invoicePdfErrorMessage(new InvoicePdfError('font-load')),/polices.*réessaie/);
  const message=invoicePdfErrorMessage(Error('internal details'));
  assert.match(message,/échoué.*Réessaie/);assert.doesNotMatch(message,/internal details|succès/);
});
