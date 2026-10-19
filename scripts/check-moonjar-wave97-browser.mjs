// WAVE 9.7: real opt-in A-only editor artifact validation with source app.
// Chromium/WebKit emulation cannot substitute for actual Android/iOS hardware.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium,webkit} from 'playwright';

const HOST='http://127.0.0.1:4173/activities/moonjar/';
const OUT='artifacts/moonjar-wave97-browser';
await mkdir(OUT,{recursive:true});
let checks=0;
const results=[];
function ok(v,msg){assert.ok(v,msg);checks++;}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function getRevision(page){
  return page.evaluate(async()=>{
    const {openRepository}=await import('./src/persistence.js');
    const db=await openRepository();
    const list=await db.list();
    return list.length?list.at(-1).revision:null;
  });
}
async function run(kind,launcher,width,height){
  const name=kind+'-'+width+'x'+height;
  const browser=await launcher.launch({headless:true});
  const ctx=await browser.newContext({viewport:{width,height},
    isMobile:width<767,hasTouch:width<767,deviceScaleFactor:1,
    acceptDownloads:true,locale:'ko-KR',reducedMotion:'reduce'});
  const page=await ctx.newPage();
  // Observe the exact browser-owned Blob before object URLs are revoked.
  // CSP intentionally blocks fetch(blob:); never weaken production connect-src.
  await page.addInitScript(()=>{
    const make=URL.createObjectURL.bind(URL);
    const revoke=URL.revokeObjectURL.bind(URL);
    const objects=new Map();
    Object.defineProperty(window,'__moonjarQABlobs',{value:objects});
    URL.createObjectURL=(blob)=>{const url=make(blob);objects.set(url,blob);return url;};
    URL.revokeObjectURL=url=>{objects.delete(url);return revoke(url);};
  });
  const errors=[];
  page.on('pageerror',e=>errors.push('JS '+e.message));
  page.on('requestfailed',r=>errors.push('LOAD '+r.url()+' '+r.failure()?.errorText));
  page.on('request',r=>{
    if(!r.url().startsWith('http://127.0.0.1:4173/')&&!/^(data|blob):/.test(r.url()))
      errors.push('REMOTE '+r.url());
  });
  try{
    await page.goto(HOST,{waitUntil:'networkidle'});
    ok(await page.locator('.craft-a-preview-trigger').count()===0,
      name+' original editor does not show research mode by default');
    await page.goto(HOST+'?artStudy=craft-a',{waitUntil:'networkidle'});
    ok(await page.locator('.craft-a-preview-trigger').count()===0,
      name+' homepage does not distract with study before a project exists');
    const hero=page.locator('[data-action="start-free"]');
    await hero.click();
    await page.locator('#art').waitFor({state:'visible'});
    ok(await page.locator('.craft-a-preview-trigger').count()===1,
      name+' only one A-only study button is visible in the studio');
    ok(await page.locator('#art [data-node]').count()===0,
      name+' before study a new empty vessel has zero pieces');

    await page.locator('.piece-choice[data-action="add:A01"]').click();
    await page.locator('#art [data-node]').first().waitFor({state:'attached',timeout:12000});
    // The original autosave queue must have settled BEFORE this study opens.
    // Otherwise an unrelated pending write may complete during the dialog,
    // making the revision comparison falsely attribute it to art preview.
    await page.waitForFunction(()=>{
      const text=document.querySelector('#save-state')?.textContent||'';
      return text.includes('이 기기에 저장됨');
    },{timeout:15000});
    const revisionBefore=await getRevision(page);
    const native=await page.locator('#art image').first().getAttribute('href');
    ok(native.includes('porcelain-day.png'),name+' native canvas still uses existing V2 background');
    const appOverlay=page.locator('.craft-a-preview-trigger').first();
    await appOverlay.click();
    const dialog=page.locator('#modal:has(.craft-a-dialog)');
    await dialog.waitFor({state:'visible'});
    const status=dialog.locator('.craft-a-side > p[role="status"]');
    await page.waitForFunction(()=>document.querySelector('.craft-a-figure img')?.naturalWidth===1600,{timeout:20000});
    ok(await dialog.locator('.craft-a-figure img').evaluate(img=>img.naturalWidth===1600&&img.naturalHeight===1800),
      name+' previews THE SAME real user scene at full resolution');
    ok((await status.innerText()).includes('같은 이미지'),name+' generated A image is ready');
    ok(await dialog.locator('.craft-a-copy .check-row input:checked').count()===0,
      name+' user/private words are excluded by default');
    const previewURL=await dialog.locator('.craft-a-figure img').getAttribute('src');
    const previewBuffer=await page.evaluate(async src=>Array.from(new Uint8Array(await window.__moonjarQABlobs.get(src).arrayBuffer())),previewURL);
    const previewHash=sha(Buffer.from(previewBuffer));
    if(kind==='chromium')await page.screenshot({path:OUT+'/'+name+'-art.png',animations:'disabled'});
    const requestedPNG=page.waitForEvent('download');
    await dialog.locator('[data-action="save-a-png"]').click();
    const downloaded=await requestedPNG;
    const artFile=OUT+'/'+name+'-study-art.png';
    await downloaded.saveAs(artFile);
    const saved=await readFile(artFile);
    ok(saved.readUInt32BE(16)===1600&&saved.readUInt32BE(20)===1800,
      name+' A artwork PNG retains full size');
    ok(sha(saved)===previewHash,
      name+' the A preview blob and saved PNG are BYTE-IDENTICAL');

    await dialog.locator('[data-action="preview-original"]').click();
    await page.waitForFunction(()=>document.querySelector('.craft-a-figure img')?.naturalWidth===1600
      && document.querySelector('.craft-a-figure figcaption')?.textContent?.includes('기존 도안'),{timeout:15000});
    const originalHash=await page.evaluate(async()=>{
      const img=document.querySelector('.craft-a-figure img');
      const ab=await window.__moonjarQABlobs.get(img.src).arrayBuffer();
      const raw=await crypto.subtle.digest('SHA-256',ab);
      return [...new Uint8Array(raw)].map(n=>n.toString(16).padStart(2,'0')).join('');
    });
    ok(originalHash!==previewHash,name+' default legacy art is not silently replaced by A research');

    await dialog.locator('[data-action="preview-card"]').click();
    await page.waitForFunction(()=>document.querySelector('.craft-a-figure img')?.naturalWidth===1600
      && document.querySelector('.craft-a-figure img')?.naturalHeight===2400,{timeout:20000});
    ok((await dialog.locator('.craft-a-figure img').getAttribute('src')).startsWith('blob:'),
      name+' card preview is generated locally');
    if(kind==='chromium')await page.screenshot({path:OUT+'/'+name+'-card.png',animations:'disabled'});
    const cardJob=page.waitForEvent('download');
    await dialog.locator('[data-action="save-a-card"]').click();
    const cardFile=OUT+'/'+name+'-study-card.png';
    await (await cardJob).saveAs(cardFile);
    const card=await readFile(cardFile);
    ok(card.readUInt32BE(16)===1600&&card.readUInt32BE(20)===2400,
      name+' A card saves at full 1600x2400');

    // Verify A art pixels match the image drawn inside the card exactly.
    const parity=await page.evaluate(async bytes=>{
      const picture=new Blob([Uint8Array.from(bytes)],{type:'image/png'});
      const artwork=await createImageBitmap(picture);
      const cardsrc=document.querySelector('.craft-a-figure img').src;
      const card=await createImageBitmap(window.__moonjarQABlobs.get(cardsrc));
      const a=document.createElement('canvas');a.width=1600;a.height=2400;
      const x=a.getContext('2d',{willReadFrequently:true});
      x.drawImage(artwork,140,218,1320,1485);
      const b=document.createElement('canvas');b.width=1600;b.height=2400;
      const y=b.getContext('2d',{willReadFrequently:true});y.drawImage(card,0,0);
      const spots=[[250,440],[600,550],[950,720],[650,1000],[1190,1360],[410,1620]];
      let max=0;
      for(const [px,py] of spots){
        const A=x.getImageData(px,py,1,1).data,B=y.getImageData(px,py,1,1).data;
        max=Math.max(max,...[0,1,2].map(i=>Math.abs(A[i]-B[i])));
      }
      artwork.close();card.close();return max;
    },[...saved]);
    ok(parity<=2,name+' A artwork pixels embedded in card share the same Canvas master, max delta='+parity);

    await dialog.locator('[aria-label="작품 제목 포함"]').check();
    const title=dialog.locator('.craft-a-copy input[type=text]');
    await title.fill('나의 달항아리');
    await dialog.locator('[data-action="preview-card"]').click();
    await page.waitForFunction(()=>document.querySelector('.craft-a-side > p[role="status"]')?.textContent?.includes('같은 이미지'),
      {timeout:15000});
    ok(!await dialog.locator('[data-action="save-a-card"]').isDisabled(),
      name+' optional explicit card title is accepted');

    await dialog.locator('[aria-label="한 문장 포함"]').check();
    await dialog.locator('.craft-a-copy textarea').fill('이것은 오직 내가 선택한 문장입니다.');
    await page.waitForFunction(()=>{
      const button=document.querySelector('.craft-a-dialog [data-action="save-a-card"]');
      const status=document.querySelector('.craft-a-side > p[role="status"]')?.textContent||'';
      return !!button&&!button.disabled&&status.includes('같은 이미지');
    },{timeout:20000});
    ok(!await dialog.locator('[data-action="save-a-card"]').isDisabled(),
      name+' user-opt-in sentence can be included');
    await dialog.locator('.craft-a-copy textarea').fill('첫째\n둘째\n셋째');
    await page.waitForFunction(()=>document.querySelector('.craft-a-side > p[role="status"]')?.textContent?.includes('두 줄'),{timeout:20000});
    ok(await dialog.locator('[data-action="save-a-card"]').isDisabled(),
      name+' illegal 3 line text is never silently cropped');

    await page.locator('#modal-close').click();
    await dialog.waitFor({state:'hidden'});
    ok((await page.locator('#art [data-node]').count())===1,
      name+' real SVG editor retains its original placed piece after study');
    const revisionAfter=await getRevision(page);
    ok(revisionAfter===revisionBefore,
      name+' opening preview, comparing and generating art never modifies or persists a project: before='+
      revisionBefore+' after='+revisionAfter);
    await page.locator('.art-toolbar [data-action="save-options"]').click();
    const downloadDialog=page.locator('#modal');
    await downloadDialog.waitFor({state:'visible'});
    await downloadDialog.locator('[data-action="export-json"]').click();
    await downloadDialog.locator('[data-action="download-json"]').waitFor({state:'visible'});
    const normalDownload=page.waitForEvent('download');
    await downloadDialog.locator('[data-action="download-json"]').click();
    const docFile=OUT+'/'+name+'-backup.moonjar.json';
    await (await normalDownload).saveAs(docFile);
    const backup=JSON.parse(await readFile(docFile,'utf8'));
    ok(backup.scene.canvasVariant==='porcelain-v2'
      && !JSON.stringify(backup).includes('craft-a')
      && backup.scene.nodes.length===1,
      name+' exported document is unchanged and contains NO A study property');
    ok(errors.length===0,name+' no remote requests or runtime errors: '+errors.join(' | '));
    results.push({name,passed:true,previewHash,pixelParityMaxDelta:parity});
    console.log('W9.7 STUDIO PASS: '+name);
  }catch(e){
    results.push({name,passed:false,error:String(e),errors});
    console.error('W9.7 STUDIO FAIL: '+name+' '+(e.stack||e));
    throw e;
  }finally{await ctx.close();await browser.close();}
}
let failed=null;
try{
  for(const args of [['chromium',chromium,1440,900],['chromium',chromium,390,844],['webkit',webkit,390,844]])
    await run(...args);
}catch(e){failed=e;process.exitCode=1}
finally{
  await writeFile(OUT+'/results.json',JSON.stringify({checks,results,
    note:'Chromium/WebKit emulation only, not physical Android/iOS. A is a study-only runtime and not W9.5 Python PBR.'
  },null,2));
  console.log('W9.7 A-ONLY EDITOR MATRIX: '+checks+' assertions across '+results.length+' scenarios '+(failed?'FAILED':'PASSED'));
}
