// V3 acceptance: real UI and isolated, disposable browser repositories only.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {beginWork,settleArtwork,menuAction} from './moonjar-browser-helpers.mjs';
const base='http://127.0.0.1:4173/activities/moonjar/';
const out='artifacts/moonjar-atelier-v3';await mkdir(out,{recursive:true});
let checks=0;const results=[];function ok(condition,message){assert.ok(condition,message);checks++;}
const sizes=[[320,568],[360,800],[390,844],[430,932],[768,1024],[1024,768],[1440,900],[844,390]];
async function shot(page,name){await settleArtwork(page);await page.screenshot({path:`${out}/${name}.png`,animations:'disabled'});}
async function bounded(page,name){
 const g=await page.evaluate(()=>({w:innerWidth,sw:document.documentElement.scrollWidth,y:scrollY,h:innerHeight,main:document.querySelector('main').getBoundingClientRect().bottom}));
 ok(g.sw<=g.w+1&&g.y===0&&g.main<=g.h+1,name+' bounded app '+JSON.stringify(g));
}
async function scenario(browser,engine,width,height){
 const name=`${engine}-${width}x${height}`,ctx=await browser.newContext({viewport:{width,height},isMobile:width<768,hasTouch:width<1200,locale:'ko-KR',deviceScaleFactor:1,acceptDownloads:true,reducedMotion:'reduce'});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET'||new URL(r.url()).origin!==new URL(base).origin)errors.push('Unexpected transport '+r.url());});
 page.on('dialog',d=>d.accept());
 try{
  await page.goto(base,{waitUntil:'networkidle'});await bounded(page,name+' intro');
  const cta=await page.locator('.hero-cta').boundingBox();ok(cta.y+cta.height<=height,name+' intro CTA visible');
  ok(await page.locator('.brand-seal').count()===0,name+' no emblem');
  ok(await page.locator('.hero-actions>.primary').count()===1,name+' single primary CTA');
  await shot(page,name+'-intro');
  await page.locator('.hero-cta').click();await page.locator('.start-form').waitFor();
  await page.locator('#mode-guided').check();await page.locator('#storage-memory').check();
  await page.reload({waitUntil:'networkidle'});
  ok(await page.locator('#mode-guided').isChecked()&&await page.locator('#storage-memory').isChecked(),name+' explicit choices survive reload');
  await page.goBack();await page.locator('.hero-cta').waitFor();
  await page.locator('.hero-cta').click();await page.locator('.start-form').waitFor();await shot(page,name+'-start');
  await page.locator('.start-actions [type=submit]').click();await page.locator('#art').waitFor();await settleArtwork(page);
  await bounded(page,name+' studio');
  if(width<768&&height<=650){await page.locator('.compact-view').click();ok(await page.locator('#modal [data-action=compare]').isVisible(),name+' compact view tools accessible');await page.locator('#modal-close').click();}
  const art=await page.locator('#art').boundingBox();ok(art.width>=72&&art.height>=80,name+' real artwork remains visible');
  await shot(page,name+'-materials');
  await page.locator('[data-action="add:A01"]').click();await page.locator('#art [data-node]').waitFor();
  await page.locator('[data-action="batch:12"]').click();await page.waitForFunction(()=>document.querySelectorAll('#art [data-node]').length===13);ok(await page.locator('#art [data-node]').count()===13,name+' twelve more original fragments');
  await page.locator('.art-toolbar [data-action=undo]').click();ok(await page.locator('#art [data-node]').count()===1,name+' batch undo atomic');
  await page.locator('.art-toolbar [data-action=redo]').click();ok(await page.locator('#art [data-node]').count()===13,name+' batch redo');
  if(width<1200)await page.locator('[data-action="panel:controls"]').click();
  const before=await page.locator('#art [data-node]').last().getAttribute('transform');
  await page.locator('#controls-panel [data-action="move:24:0"]').click();
  ok(await page.locator('#art [data-node]').last().getAttribute('transform')!==before,name+' inspector updates actual scene');
  await shot(page,name+'-studio');await bounded(page,name+' controls');
  await page.waitForFunction(()=>document.querySelector('#save-state')?.textContent==='이 기기에 저장됨');
  const hash=await page.evaluate(()=>location.hash);
  await page.reload({waitUntil:'networkidle'});await page.locator('#art').waitFor();
  ok(await page.locator('#art [data-node]').count()===13,name+' persistent project restored');
  ok(await page.evaluate(()=>location.hash)===hash,name+' hash identity restored');
  // Use the visible viewing action on every viewport, after closing the dock.
  if(width<1200)await page.locator('[data-action="panel:look"]').click();else await page.locator('[data-action=pause]').click();await page.locator('.paused').waitFor();await shot(page,name+'-reflection');
  ok(!(await page.locator('.art-toolbar').isVisible()),name+' reflection hides editor tools');
  await page.locator('#look-prompt [data-action="panel:palette"]').click();
  ok(await page.locator('#art [data-node]').count()===13,name+' return from reflection loses nothing');
  await page.locator('[data-action=finish]').first().click();await page.locator('.result-layout').waitFor();await shot(page,name+'-gallery');await bounded(page,name+' gallery');
  ok(await page.locator('.result-actions button').count()===5,name+' all five completion actions');
  await page.locator('[data-action=card-options]').click();await page.locator('.card-modal').waitFor();
  ok(await page.locator('.card-modal input:checked').count()===0,name+' card private text opt-in');await page.locator('#modal-close').click();
  await page.locator('.site-header [data-action=projects]').click();await page.locator('.project-card').waitFor();await shot(page,name+'-archive');
  await page.locator('[data-action^="rename:"]').click();await page.locator('.rename-input').fill('나의 작은 공방');
  await page.locator('#modal [type=submit]').click();await page.locator('.project-card h2').filter({hasText:'나의 작은 공방'}).waitFor();
  ok(await page.locator('.project-card').count()===1,name+' rename keeps document identity');
  await menuAction(page,'guide');await page.locator('.facilitator-guide').waitFor();await shot(page,name+'-guide');
  ok(await page.locator('.guide-principle').count()===5,name+' DAILY preserved');
  await menuAction(page,'materials');await page.locator('.materials-guide').waitFor();
  ok(await page.locator('.materials-item').count()===9,name+' original nine information entries');await shot(page,name+'-help');
  ok(errors.length===0,name+' no browser JS or remote transport errors '+errors.join('|'));
  results.push({name,result:'PASS',art});console.log('ATELIER PASS',name);
 }catch(e){await shot(page,name+'-failure').catch(()=>{});results.push({name,result:'FAIL',error:String(e),errors});throw e;}
 finally{await ctx.close();}
}
async function contracts(browser){
 const ctx=await browser.newContext({viewport:{width:390,height:844},acceptDownloads:true}),page=await ctx.newPage();
 page.on('dialog',d=>d.accept());await page.goto(base,{waitUntil:'networkidle'});
 const fixture=JSON.parse(await readFile('tests/moonjar/fixtures/valid_six_pieces.moonjar.json','utf8'));
 // Seed an existing-schema work in a fresh test context, never a user's browser.
 await page.evaluate(async doc=>{const {openRepository}=await import('./src/persistence.js'),r=await openRepository();await r.save(doc,null);r.close();},fixture);
 await page.goto(base+'#/studio/'+fixture.projectId,{waitUntil:'networkidle'});
 ok(await page.locator('#art [data-node]').count()===6,'legacy IndexedDB document opened');
 const compatibility=await page.evaluate(async()=>{const {openRepository}=await import('./src/persistence.js'),r=await openRepository(),docs=await r.list();r.close();return docs;});
 ok(JSON.stringify(compatibility[0])===JSON.stringify(fixture),'opening does not migrate or rewrite legacy document');
 // Real SVG -> full-resolution raster and the unchanged PNG exporter agree.
 const pixels=await page.evaluate(async()=>{
  const {openRepository}=await import('./src/persistence.js'),{exportPNG,exportCardPNG,Materials}=await import('./src/rendering.js');
  const repo=await openRepository(),doc=(await repo.list())[0];repo.close();
  const manifest=await fetch('./data/manifest.json').then(r=>r.json()),m=new Materials(manifest),png=await exportPNG(doc.scene,m),card=await exportCardPNG(doc.scene,m);
  const output=await createImageBitmap(png),c=document.createElement('canvas');c.width=1600;c.height=1800;const x=c.getContext('2d');x.drawImage(output,0,0);const expected=x.getImageData(0,0,1600,1800).data;
  const svg=document.querySelector('#art').cloneNode(true);svg.querySelector('.selection')?.remove();svg.setAttribute('width','1600');svg.setAttribute('height','1800');
  for(const img of svg.querySelectorAll('image')){const blob=await fetch(img.getAttribute('href')).then(r=>r.blob());const data=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob);});img.setAttribute('href',data);}
  const src=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'})),image=new Image();image.src=src;await image.decode();x.clearRect(0,0,1600,1800);x.drawImage(image,0,0);URL.revokeObjectURL(src);const actual=x.getImageData(0,0,1600,1800).data;
  let different=0;for(let i=0;i<actual.length;i+=4)if(Math.max(...[0,1,2,3].map(k=>Math.abs(actual[i+k]-expected[i+k])))>3)different++;
  const bitmap=await createImageBitmap(card);return {png:[output.width,output.height],card:[bitmap.width,bitmap.height],different,total:1600*1800};
 });
 ok(pixels.png.join('x')==='1600x1800','original PNG dimensions');ok(pixels.card.join('x')==='1600x2400','original card dimensions');ok(pixels.different/pixels.total<.01,'SVG/canvas pixel difference <1% '+JSON.stringify(pixels));
 // JSON export uses the actual guarded download flow.
 await page.locator('.art-toolbar [data-action=save-options]').click();await shot(page,'chromium-390x844-save');
 await page.locator('.save-option [data-action=export-json]').click();
 const downloadEvent=page.waitForEvent('download');await page.locator('[data-action=download-json]').click();const download=await downloadEvent;
 const exported=JSON.parse(await readFile(await download.path(),'utf8'));
 ok(JSON.stringify(exported)===JSON.stringify(fixture),'JSON export preserves all legacy reflection and layout fields');
 await page.locator('.site-header [data-action=projects]').click();await page.locator('.project-card').waitFor();
 await page.locator('#import-file').setInputFiles({name:'legacy.moonjar.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
 await page.locator('[data-action=import-confirm]').click();await page.waitForFunction(()=>document.querySelector('#save-state')?.textContent==='이 기기에 저장됨');
 const docs=await page.evaluate(async()=>{const {openRepository}=await import('./src/persistence.js'),r=await openRepository(),d=await r.list();r.close();return d;});
 ok(docs.length===2&&docs.some(d=>d.projectId===fixture.projectId),'JSON import forks a new ID without overwriting original');
 // A second repository writer causes a real revision conflict in the current UI.
 await page.evaluate(async()=>{const {openRepository}=await import('./src/persistence.js'),r=await openRepository(),id=location.hash.split('/').at(-1),d=await r.get(id),v=d.revision;d.revision++;d.title='다른 탭의 제목';await r.save(d,v);r.close();});
 await page.locator('.mobile-tabs [data-action="panel:palette"]').click();
 await page.locator('[data-action="add:A01"]').click();
 await page.waitForFunction(()=>document.querySelector('#save-state')?.textContent.includes('저장 충돌'));
 ok(await page.locator('#storage-warning [data-action=export-json]').isVisible(),'conflict keeps manual backup accessible');
 ok((await page.locator('#save-state').innerText()).includes('덮어쓰지'),'conflict never reports saved');
 results.push({name:'legacy-export-import-pixels-conflict',result:'PASS',pixels});await ctx.close();
 // Explicit non-persistent UI, native cancellation and refresh behavior.
 const memory=await browser.newContext({viewport:{width:390,height:844}}),p=await memory.newPage();await p.goto(base,{waitUntil:'networkidle'});await beginWork(p,'free','memory');await p.locator('[data-action="add:A01"]').click();
 p.once('dialog',d=>d.dismiss());await p.locator('.site-header [data-action=projects]').click();await p.waitForFunction(()=>location.hash.startsWith('#/studio/'));
 ok(await p.locator('#art [data-node]').count()===1,'cancel unsafe navigation retains in-memory work');
 p.on('dialog',d=>d.accept());await p.reload({waitUntil:'networkidle'});await p.locator('.hero-cta').waitFor();
 await p.locator('.site-header [data-action=projects]').click();await p.locator('.archive-empty').waitFor();ok(await p.locator('.project-card').count()===0,'memory project is not automatically restored or listed');
 results.push({name:'memory-and-navigation',result:'PASS'});await memory.close();
 // Actual IDB put failure, not a mocked status label.
 const failure=await browser.newContext({viewport:{width:390,height:844}}),f=await failure.newPage();
 await f.addInitScript(()=>{const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...rest){if(this.name==='projects'&&value.revision>0)throw new DOMException('Test quota exceeded','QuotaExceededError');return put.call(this,value,...rest);};});
 await f.goto(base,{waitUntil:'networkidle'});await beginWork(f);await f.waitForFunction(()=>document.querySelector('#save-state')?.textContent==='이 기기에 저장됨');await f.locator('[data-action="add:A01"]').click();await f.waitForFunction(()=>document.querySelector('#save-state')?.textContent==='저장하지 못했어요');
 ok(await f.locator('#art [data-node]').count()===1,'quota failure preserves visible artwork');ok(await f.locator('#storage-warning [data-action=export-json]').isVisible(),'quota failure provides backup');
 results.push({name:'real-idb-quota-failure',result:'PASS'});await failure.close();
}
let error=null;
try{
 const browser=await chromium.launch();try{if(!process.env.MOONJAR_CONTRACTS_ONLY)for(const [w,h]of sizes)await scenario(browser,'chromium',w,h);await contracts(browser);}finally{await browser.close();}
 if(!process.env.MOONJAR_CHROMIUM_ONLY){const browser=await webkit.launch();try{for(const [w,h]of [[320,568],[390,844],[844,390]])await scenario(browser,'webkit',w,h);}finally{await browser.close();}}
}catch(e){error=e;console.error(e.stack);process.exitCode=1;}
finally{await writeFile(`${out}/results.json`,JSON.stringify({checks,results,passed:!error,error:error?.message||null,notes:'Real browser engines, simulated viewports. Physical Android/iPhone and assistive technology not tested.'},null,2));console.log('ATELIER V3',checks,'assertions',results.length,'scenarios',error?'FAILED':'PASS');}
