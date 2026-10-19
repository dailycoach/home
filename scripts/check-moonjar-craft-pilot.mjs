// WAVE9.6 A-only archival art studio: real browser and privacy regression.
// This is a pilot experience, not a test of real customer satisfaction.
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {chromium,webkit} from 'playwright';

const base=resolve('artifacts/moonjar-craft-pilot');
const evidence=resolve('artifacts/moonjar-craft-pilot/qa');
await mkdir(evidence,{recursive:true});
let checks=0;
const results=[];
function check(value,message){assert.ok(value,message);checks++;}

async function scenario(browser,engine,width,height,files=false){
  const name=engine+'-'+width+'x'+height;
  const ctx=await browser.newContext({viewport:{width,height},
    isMobile:width<767,hasTouch:width<767,acceptDownloads:true,locale:'ko-KR'});
  const page=await ctx.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push('JS '+e.message));
  page.on('requestfailed',r=>errors.push('NETWORK '+r.url()));
  page.on('request',r=>{
    // Offline-only: a pilot must not send names, responses, or images to a server.
    if(!/^file:|^data:|^blob:/.test(r.url()))errors.push('REMOTE '+r.url());
  });
  try{
    const url='file://'+base+'/index.html';
    await page.goto(url,{waitUntil:'load',timeout:45000});
    await page.locator('#art-image').evaluate(el=>el.decode());
    check(await page.locator('#art-image').evaluate(e=>e.naturalWidth===1600 && e.naturalHeight===1800),
      name+' loads the actual original scene dimensions');
    check(await page.locator('.mode-tabs [data-tab]').count()===3,
      name+' three A-only modes, no dual/B art selection');
    check(!(await page.locator('body').innerText()).includes('콜라주형'),
      name+' retired B concept absent');
    check(await page.evaluate(()=>scrollY===0&&getComputedStyle(document.body).overflow==='hidden'),
      name+' no page-level scroll');
    const box=await page.locator('#preview-stage').boundingBox();
    check(box&&box.y>=0&&box.y+box.height<=height+2,
      name+' artwork within viewport: '+JSON.stringify(box));
    await page.locator('[data-count="96"]').click();
    check((await page.locator('#art-caption').innerText()).includes('96개'),name+' density toggle works');
    await page.locator('[data-theme="night"]').click();
    check((await page.locator('#art-caption').innerText()).includes('밤'),name+' night mode works');
    await page.locator('[data-tab="card"]').click();
    const preview=page.locator('#card-preview');
    await page.waitForFunction(()=>document.querySelector('#card-status')?.textContent?.includes('준비되었'),{timeout:15000});
    check(await preview.evaluate(e=>e.width===1600&&e.height===2400),
      name+' full-resolution card preview');
    check(await page.locator('#include-copy').isChecked()===false,
      name+' optional notes default excluded');
    await page.locator('#card-title').fill('나의 작은 달항아리');
    await page.locator('#card-line').fill('여백을 남기기로 했다');
    await page.locator('#include-copy').check();
    await page.waitForTimeout(220);
    if(files){
      const cardJob=page.waitForEvent('download');
      await page.locator('#download-card').click();
      const card=await cardJob;
      const cardPath=evidence+'/'+name+'-card.png';
      await card.saveAs(cardPath);
      const bytes=await readFile(cardPath);
      check(bytes.subarray(1,4).toString()==='PNG' && bytes.readUInt32BE(16)===1600 && bytes.readUInt32BE(20)===2400,
        name+' explicit card export is a 1600x2400 PNG');
      const originalJob=page.waitForEvent('download');
      await page.locator('#download-original').click();
      const original=await originalJob;
      const originalPath=evidence+'/'+name+'-original.png';
      await original.saveAs(originalPath);
      const png=await readFile(originalPath);
      check(png.readUInt32BE(16)===1600&&png.readUInt32BE(20)===1800,
        name+' native artwork PNG dimensions preserved');
    }
    await page.screenshot({path:evidence+'/'+name+'-card-view.png',animations:'disabled',fullPage:false});
    await page.locator('[data-tab="pilot"]').click();
    await page.locator('#score-keep').fill('7');
    await page.locator('#pilot-comment').fill('달항아리의 형태가 좀 더 자연스럽기를 바랍니다.');
    await page.locator('input[name="willingness"][value="30000"]').check();
    if(files){
      const reviewJob=page.waitForEvent('download');
      await page.locator('#download-review').click();
      const review=await reviewJob;
      const reviewPath=evidence+'/'+name+'-review.json';
      await review.saveAs(reviewPath);
      const answer=JSON.parse(await readFile(reviewPath,'utf8'));
      check(answer.schema==='MOONJAR_A_STUDY_V1'
        && answer.ratings.keep===7 && answer.priceHypothesis==='30000'
        && answer.scene.theme==='night'&&answer.scene.pieceCount===96,
        name+' opt-in local JSON matches participant-selected values');
      check(!('name' in answer)&&!('email' in answer)&&!('phone' in answer),
        name+' personal contact info not collected');
    }
    await page.screenshot({path:evidence+'/'+name+'-pilot-view.png',animations:'disabled',fullPage:false});
    check(errors.length===0,name+' no browser errors or remote requests: '+errors.join(' | '));
    results.push({name,status:'PASS',width,height});
    console.log('A-ONLY PILOT PASS',name);
  }catch(e){results.push({name,status:'FAIL',error:String(e),errors});throw e}
  finally{await ctx.close();}
}
const matrix=[
  ['chromium',chromium,[390,844],true],
  ['chromium',chromium,[320,568],false],
  ['chromium',chromium,[1440,900],true],
  ['webkit',webkit,[390,844],false]
];
let failed=null;
try{
for(const [engine,launcher,[width,height],files] of matrix){
  const browser=await launcher.launch({headless:true});
  try{await scenario(browser,engine,width,height,files)}finally{await browser.close()}
}
}catch(e){failed=e;console.error('A-ONLY PILOT MATRIX FAILED:',e.stack||String(e));process.exitCode=1}
finally{
console.log('A-ONLY PILOT MATRIX',checks,'assertions',results.filter(x=>x.status==='PASS').length+'/'+matrix.length,failed?'FAILED':'PASSED');
await import('node:fs/promises').then(fs=>fs.writeFile(evidence+'/results.json',JSON.stringify({checks,results,notice:'Browser simulation only. No physical phone or real participant survey.'},null,2)));
}
