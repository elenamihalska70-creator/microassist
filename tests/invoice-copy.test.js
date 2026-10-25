import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {generateFacturXXml,getInvoiceComplianceScore,FACTURX_PREPARATION_LABEL,INVOICE_DOCUMENTS_NOTE,PDP_ROADMAP_NOTE} from '../src/utils/facturx.js';
import {LOCAL_INVOICE_MESSAGES} from '../src/application/invoices/localInvoiceStatus.js';
const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const generator=readFileSync(new URL('../src/components/InvoiceGenerator.jsx',import.meta.url),'utf8');
const fx=JSON.parse(readFileSync(new URL('../docs/local-invoice-backup/examples/valid.json',import.meta.url),'utf8')).invoices[1];

test('storage badge follows provenance, including historical entries without localOnly',()=>{
 assert.match(app,/origin === "local" && \([\s\S]*?Enregistrée dans ce navigateur/);
 assert.doesNotMatch(app,/invoice\.localOnly &&/);
 assert.match(LOCAL_INVOICE_MESSAGES.local,/dans ce navigateur, même après connexion/);
});
test('presentation copy makes no electronic certification or future transmission promise',()=>{
 assert.equal(FACTURX_PREPARATION_LABEL,'PDF et brouillon XML séparés');
 assert.match(INVOICE_DOCUMENTS_NOTE,/sans validation de conformité fiscale ni certification Factur-X\/PDF\/A-3/);
 assert.equal(PDP_ROADMAP_NOTE,'La transmission via une plateforme agréée n’est pas disponible dans cette version.');
 assert.match(generator,/Créer et télécharger PDF \+ XML/);
 assert.match(generator,/Téléchargements du PDF et du brouillon XML déclenchés/);
 assert.doesNotMatch(generator,/ont été téléchargés|facture conforme|compatible 2026/);
});
test('completeness technical values are unchanged and missing SIRET wording makes no guarantee',()=>{
 const before=structuredClone(fx),complete=getInvoiceComplianceScore(fx);
 assert.equal(complete.score,100);assert.equal(complete.status,'conforme');assert.deepEqual(complete.missingItems,[]);
 const incomplete=getInvoiceComplianceScore({...fx,seller:{...fx.seller,siret:''}});
 assert.equal(incomplete.score,90);assert.equal(incomplete.status,'a_completer');assert.deepEqual(incomplete.missingItems,['SIRET vendeur']);
 assert.match(incomplete.alerts.join(' '),/Un SIRET ne suffit pas/);assert.deepEqual(fx,before);
 assert.match(app,/Indicateur de complétude/);assert.match(app,/Champs contrôlés renseignés/);
});
test('synthetic XML remains byte-identical to baseline 99103b8',()=>{
 const expected=readFileSync(new URL('../docs/invoice-copy/xml-baseline.sha256',import.meta.url),'utf8').trim();
 assert.equal(createHash('sha256').update(generateFacturXXml(fx),'utf8').digest('hex'),expected);
});
