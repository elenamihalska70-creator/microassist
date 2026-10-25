import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

// Offline review tooling, installed outside the application (see review README).
const tools = process.env.PDF_TOOLS_DIR;
assert.ok(tools, 'Set PDF_TOOLS_DIR to the directory containing pdfjs-dist and @napi-rs/canvas');
const canvasModule = await import(pathToFileURL(join(tools, 'node_modules/@napi-rs/canvas/index.js')));
Object.assign(globalThis, { DOMMatrix: canvasModule.DOMMatrix, ImageData: canvasModule.ImageData, Path2D: canvasModule.Path2D });
const pdfjs = await import(pathToFileURL(join(tools, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs')));
const root = resolve(process.env.PDF_REVIEW_DIR || 'output/pdf/invoice-unicode-review');
const summaries = {};
const readPdf = async path => pdfjs.getDocument({ data: new Uint8Array(await readFile(path)),
  standardFontDataUrl: join(tools, 'node_modules/pdfjs-dist/standard_fonts').replaceAll('\\', '/') + '/',
  useSystemFonts: false }).promise;

for (const name of ['short','long','created','list']) {
  test(`real PDF text, geometry and rendered pages: ${name}`, async () => {
    const document = await readPdf(join(root,'fixed',`${name}.pdf`));
    const pdfBytes = await readFile(join(root,'fixed',`${name}.pdf`),'latin1');
    assert.equal((pdfBytes.match(/\/FontFile2 /g) || []).length,2,'both regular and bold TTF faces are embedded');
    const pages = [], allText = [], allItems = [];
    for (let p=1;p<=document.numPages;p++) {
      const page = await document.getPage(p);
      const content = await page.getTextContent();
      const items = content.items.filter(item => item.str?.trim());
      allItems.push(...items);
      const text = items.map(item=>item.str).join(' ');
      allText.push(text);
      const [,,w,h] = page.view;
      const tableHeader = items.find(item => item.str === 'Prestation');
      if (tableHeader) assert.ok(items.some(item =>
        Math.abs(item.transform[4] - 25 * 72 / 25.4) < 1 &&
        item.transform[5] < tableHeader.transform[5] && item.transform[5] > 100),
      'table header is never orphaned from its first row');
      for (const item of items) {
        assert.ok(item.transform[4] >= -0.5 && item.transform[4]+item.width <= w+0.5, `horizontal clipping: ${item.str}`);
        assert.ok(item.transform[5] >= 0 && item.transform[5]+item.height <= h+0.5, `vertical clipping: ${item.str}`);
      }
      // Distinct text runs must not paint over one another, including the total box text and note.
      for(let a=0;a<items.length;a++) for(let b=a+1;b<items.length;b++) {
        const x=items[a],y=items[b];
        const overlapX=Math.min(x.transform[4]+x.width,y.transform[4]+y.width)-Math.max(x.transform[4],y.transform[4]);
        const overlapY=Math.min(x.transform[5]+x.height*.8,y.transform[5]+y.height*.8)-Math.max(x.transform[5]-x.height*.15,y.transform[5]-y.height*.15);
        assert.ok(overlapX<=0.6 || overlapY<=0.6, `text overlap page ${p}: ${x.str} / ${y.str}`);
      }
      const viewport=page.getViewport({scale:1.25});
      const canvas=canvasModule.createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
      await page.render({canvasContext:canvas.getContext('2d'),viewport,canvas}).promise;
      const png=join(root,'renders',`${name}-${p}.png`);
      await mkdir(join(root,'renders'),{recursive:true});
      await writeFile(png,canvas.toBuffer('image/png'));
      pages.push({page:p,items:items.length,text,png});
    }
    const text=allText.join(' ').replace(/\s+/g,' ');
    for(const expected of ['тест','Тестовий клієнт — Київ, ї є ґ і','Élodie François','9,96 €']) assert.ok(text.includes(expected),`missing exact text: ${expected}`);
    assert.ok(text.includes('PDF et brouillon XML séparés'));
    assert.ok(text.includes('sans validation de conformité fiscale ni certification Factur-X/PDF/A-3.'));
    assert.ok(text.includes('La transmission via une plateforme agréée n’est pas disponible dans cette version.'));
    if(name==='long') { assert.ok(document.numPages>1);assert.ok(text.includes('FIN-DESCRIPTION')); }
    else assert.equal(document.numPages,1);
    if (['short','long'].includes(name)) {
      const fixture = JSON.parse(await readFile(join(root,'fixed',`${name}.json`),'utf8'));
      const compact = value => value.replace(/\s+/g,'');
      const columnText = x => compact(allItems.filter(item => Math.abs(item.transform[4]-x*72/25.4)<1).map(item=>item.str).join(''));
      for (const [party,x] of [[fixture.seller,20],[fixture.buyer,112]]) {
        for (const value of [party.name,party.address]) assert.ok(columnText(x).includes(compact(value)), 'complete party text survives wrapping and pagination');
      }
      const description = allItems.filter(item => Math.abs(item.transform[4]-25*72/25.4)<1 && item.str!=='Prestation').map(item=>item.str).join('');
      assert.equal(compact(description),compact(fixture.lines[0].description),'complete description survives pagination, including unbroken words');
    }
    const xml=await readFile(join(root,'fixed',`${name}.xml`),'utf8');
    assert.ok(xml.includes('тест'));
    if (['short','long'].includes(name)) assert.equal(xml,await readFile(join(root,'baseline',`${name}.xml`),'utf8'),'XML is byte-identical across the PDF correction');
    summaries[name]={pages:document.numPages,text,geometry:'no clipped or overlapping text runs',renderedPages:pages.map(p=>p.png)};
    await writeFile(join(root,'fixed',`${name}.txt`),allText.join('\n\f\n'));
    await document.cleanup();
  });
}

test('baseline reproduces lost Cyrillic and note overlapping the total area',async()=>{
  const document=await readPdf(join(root,'baseline','short.pdf'));
  const page=await document.getPage(1);
  const items=(await page.getTextContent()).items;
  const text=items.map(i=>i.str).join(' ');
  assert.ok(!text.includes('тест'));
  const note=items.find(i=>i.str?.startsWith('Ce document contient'));
  const total=items.find(i=>i.str==='TOTAL À PAYER');
  assert.ok(note && total);
  assert.ok(Math.abs(note.transform[5]-total.transform[5])<14,'note and total occupy the same vertical band');
  const viewport=page.getViewport({scale:1.25});
  const canvas=canvasModule.createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
  await page.render({canvasContext:canvas.getContext('2d'),viewport,canvas}).promise;
  await writeFile(join(root,'renders','baseline-short.png'),canvas.toBuffer('image/png'));
  await writeFile(join(root,'baseline','short.txt'),text);
  summaries.baseline={lostCyrillic:true,noteTotalBaselineDistancePt:Math.abs(note.transform[5]-total.transform[5])};
  await document.cleanup();
  const long = await readPdf(join(root,'baseline','long.pdf'));
  assert.equal(long.numPages,1,'baseline does not paginate long content');
  const longPage = await long.getPage(1);
  const longViewport = longPage.getViewport({scale:1.25});
  const longCanvas = canvasModule.createCanvas(Math.ceil(longViewport.width),Math.ceil(longViewport.height));
  await longPage.render({canvasContext:longCanvas.getContext('2d'),viewport:longViewport,canvas:longCanvas}).promise;
  await writeFile(join(root,'renders','baseline-long.png'),longCanvas.toBuffer('image/png'));
  await long.cleanup();
});

test.after(async()=>{await writeFile(join(root,'pdf-validation.json'),JSON.stringify(summaries,null,2));});
