// WAVE 10.0 — first visit → work → finish → keep → return.
// Tests permanent vs ephemeral storage without collecting private content.
// Emulated Chromium/WebKit are not a substitute for real phone/AT QA.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const BASE='http://127.0.0.1:4173/activities/moonjar/';
const OUT='artifacts/moonjar-w100-first-to-return';
await mkdir(OUT,{recursive:true});
let checks=0;const matrix=[];
function ok(v,message){assert.ok(v,message);checks++;}
function listen(page){
 const errors=[];
 page.on('pageerror',e=>errors.push('JS '+e.message));
 page.on('requestfailed',r=>errors.push('Request '+r.url()+' '+r.failure()?.errorText));
 page.on('request',r=>{
   if(!r.url().startsWith('http://127.0.0.1:4173/')&&!/^(data|blob):/.test(r.url()))
     errors.push('Third-party call '+r.url());
 });
 return errors;
}
async function session(engine,launcher,width,height){
 const tag=engine+'-'+width+'x'+height;
 const browser=await launcher.launch({headless:true});
 try{
  // Start with a deliberately temporary session.
  const memory=await browser.newContext({viewport:{width,height},locale:'ko-KR',
      isMobile:width<768,hasTouch:width<768,deviceScaleFactor:1,acceptDownloads:true});
  const page=await memory.newPage(),errors=listen(page);
  await page.goto(BASE,{waitUntil:'networkidle',timeout:30000});
  ok(await page.locator('.hero').count()===1,tag+' keeps the original art-led entry');
  const steps=await page.locator('.journey-path').innerText();
  ok(steps.includes('①')&&steps.includes('②')&&steps.includes('③'),tag+' describes the three optional creative stages');
  ok((await page.locator('.hero-start>.micro').count())>=2,tag+' retains login and record-optional disclosure');
  const cta=await page.locator('.hero-actions [data-action="start-free"]').boundingBox();
  if(height>=800)ok(cta&&cta.y>=0&&cta.y+cta.height<=height+1,tag+' first start CTA remains on-screen');
  await page.screenshot({path:OUT+'/'+tag+'-home.png'});
  await page.locator('#storage-memory').check();
  await page.locator('.hero-actions [data-action="start-free"]').click();
  await page.locator('#art').waitFor({state:'visible'});
  ok(await page.evaluate(()=>getComputedStyle(document.body).overflow==='hidden'),tag+' original one-screen editor retained');
  await page.locator('#palette-panel [data-action="add:A01"]').click();
  await page.locator('#art [data-node]').first().waitFor();
  await page.locator('.studio-bar [data-action="finish"]').click();
  await page.locator('main.result-page.result-memory-only').waitFor();
  const notice=await page.locator('.result-memory-reminder').innerText();
  ok(notice.includes('화면에만')&&notice.includes('다시 열 수 없어요'),tag+' no misleading claim of permanent storage');
  ok(notice.includes('개인 기록도 포함'),tag+' non-encrypted personal backup privacy explicit');
  ok(await page.locator('.result-actions button').count()===5,tag+' five original completion choices, no duplicate CTA');
  const strongBorder=await page.locator('.result-actions [data-action="export-json"]').evaluate(
     e=>getComputedStyle(e).borderTopColor
  );
  ok(strongBorder==='rgb(163, 140, 98)',tag+' ephemeral project backup option visually distinguishable');
  ok((await page.locator('#save-state').innerText()).includes('화면에만'),tag+' accurate save state shown');
  const art=page.locator('.result-layout>.comparison-scene');
  ok(await art.count()===1,tag+' creative result unchanged');
  await page.screenshot({path:OUT+'/'+tag+'-memory-finish.png'});
  await page.locator('.result-actions [data-action="export-json"]').click();
  await page.locator('#modal [data-action="download-json"]').waitFor({state:'visible'});
  const downloadJob=page.waitForEvent('download');
  await page.locator('#modal [data-action="download-json"]').click();
  const dl=await downloadJob, filepath=OUT+'/'+tag+'-private-project.moonjar.json';
  await dl.saveAs(filepath);
  const restored=JSON.parse(await readFile(filepath,'utf8'));
  ok(restored.scene.nodes.length===1&&restored.scene.canvasVariant==='porcelain-v2',
     tag+' explicit exported editing file remains restorable and keeps original art');
  ok(!JSON.stringify(restored).includes('result-memory-only'),tag+' no UX-only style in saved project');
  await page.goto(BASE+'#/projects',{waitUntil:'networkidle'});
  await page.locator('.archive-empty').waitFor({state:'visible'});
  ok(await page.locator('.project-card').count()===0,tag+' memory-only work is truly absent after reload');
  ok(errors.length===0,tag+' no remote calls or script errors '+errors.join(' | '));
  await memory.close();

  // Separate browser context: the default persistent path still works.
  const saved=await browser.newContext({viewport:{width,height},locale:'ko-KR',
      isMobile:width<768,hasTouch:width<768,acceptDownloads:true});
  const persistPage=await saved.newPage(),persistErrors=listen(persistPage);
  await persistPage.goto(BASE,{waitUntil:'networkidle'});
  ok(await persistPage.locator('#storage-personal').isChecked(),tag+' personal local storage remains default');
  await persistPage.locator('.hero-actions [data-action="start-free"]').click();
  await persistPage.locator('#art').waitFor();
  await persistPage.locator('#palette-panel [data-action="add:A01"]').click();
  await persistPage.locator('#art [data-node]').first().waitFor();
  await persistPage.locator('.studio-bar [data-action="finish"]').click();
  await persistPage.locator('main.result-page:not(.result-memory-only)').waitFor();
  ok(await persistPage.locator('.result-memory-reminder').count()===0,tag+' no false storage warning for persistent work');
  await persistPage.waitForFunction(()=>document.querySelector('#save-state')?.textContent?.includes('저장됨'),null,{timeout:15000});
  await persistPage.screenshot({path:OUT+'/'+tag+'-persistent-finish.png'});
  await persistPage.goto(BASE+'#/projects',{waitUntil:'networkidle'});
  await persistPage.locator('.project-card').first().waitFor();
  ok(await persistPage.locator('.project-card').count()===1,tag+' persistent artwork reopens in personal archive');
  const resume=persistPage.locator('.project-card [data-action^="open:"]').first();
  await resume.click();
  await persistPage.locator('#art [data-node]').first().waitFor();
  ok(await persistPage.locator('#art [data-node]').count()===1,tag+' original nacre position survives re-open');
  ok(persistErrors.length===0,tag+' persisted flow has no runtime errors '+persistErrors.join(' | '));
  await saved.close();
  matrix.push({name:tag,passed:true});
  console.log('MOONJAR W10 FIRST-TO-RETURN PASS',tag);
 }catch(err){
  matrix.push({name:tag,passed:false,error:String(err)});
  console.error('MOONJAR W10 FIRST-TO-RETURN FAIL',tag,err.stack||String(err));
  throw err;
 }finally{await browser.close();}
}
let failure=null;
try{
 for(const [launcher,engine,width,height] of [
  [chromium,'chromium',320,568],[chromium,'chromium',390,844],
  [chromium,'chromium',1440,900],[webkit,'webkit',390,844]
 ])await session(engine,launcher,width,height);
}catch(e){failure=e;process.exitCode=1;}
finally{
 await writeFile(OUT+'/RESULTS.json',JSON.stringify({
  checks,matrix,privacy:'All work is local to this browser, no telemetry.',
  limitations:'Emulated desktop/mobile browsers only. No actual participant acceptance or physical iOS/Android QA.'
 },null,2));
 console.log('MOONJAR W10 FLOW',checks,'assertions',matrix.filter(x=>x.passed).length+'/4',
    failure?'FAILED':'PASSED');
}
