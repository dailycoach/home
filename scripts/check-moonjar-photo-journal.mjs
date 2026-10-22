// Browser proof for user-selected photo journal. Synthetic text only;
// no real participant text, real account, or production storage is touched.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {beginWork,settleArtwork} from './moonjar-browser-helpers.mjs';

const base=process.env.MOONJAR_V32_BASE_URL||'http://127.0.0.1:4173/activities/moonjar/';
const output='artifacts/moonjar-photo-journal';
await mkdir(output,{recursive:true});
let checks=0;
function ok(value,message){assert.ok(value,message);checks++;}
const storyText='오늘 내가 만든 달항아리를 조금 더 바라봅니다. '.repeat(35);
for(const [engine,launcher] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await launcher.launch();
  try{
    for(const [width,height] of [[390,844],[1440,900]]){
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,
        isMobile:width<768,hasTouch:width<768,locale:'ko-KR',reducedMotion:'reduce'});
      const page=await context.newPage(),errors=[],external=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173/')&&!r.url().startsWith('blob:'))external.push(r.url());});
      await page.addInitScript(()=>{
        window.__moonjarShares=[];
        Object.defineProperty(navigator,'canShare',{configurable:true,value:({files})=>Array.isArray(files)&&files.every(f=>f.type==='image/png')});
        Object.defineProperty(navigator,'share',{configurable:true,value:({files})=>{
          window.__moonjarShares.push({files:files.map(f=>({name:f.name,size:f.size,type:f.type})),gesture:navigator.userActivation?.isActive});
          return Promise.resolve();
        }});
      });
      const name=`${engine}-${width}x${height}`;
      try{
        await page.goto(base,{waitUntil:'networkidle'});
        await beginWork(page,'free','memory');
        await page.locator('[data-action="add:A01"]').click();
        if(width<768)await page.locator('.mobile-tabs [data-action="panel:story"]').click();
        await page.locator('#story-panel [data-field="noticed"]').fill(storyText);
        await page.locator('#story-panel .more-records > summary').click();
        await page.locator('#story-panel [data-section="title"]').fill('실사용자 테스트를 위한 나의 제목');
        await page.locator('.studio-bar [data-action="finish"]').click();
        await page.locator('main.result-page [data-action="photo-journal"]').click();
        await page.locator('#modal .photo-journal-modal').waitFor();
        ok(await page.locator('#modal [data-photo-field="title"]').isChecked()===false,name+' title opt-out by default');
        ok(await page.locator('#modal [data-photo-field="return.noticed"]').isChecked()===false,name+' writing opt-out by default');
        await page.waitForFunction(()=>document.querySelectorAll('.photo-journal-page').length===1,{timeout:18000});
        ok(await page.locator('.photo-journal-page').count()===1,name+' artwork-only one page');
        await page.locator('#modal [data-photo-field="title"]').check();
        await page.locator('#modal .photo-journal-records > summary').click();
        await page.locator('#modal [data-photo-field="return.noticed"]').check();
        await page.waitForFunction(()=>document.querySelectorAll('.photo-journal-page').length>1,{timeout:25000});
        const n=await page.locator('.photo-journal-page').count();
        ok(n>=2,name+' complete long writing uses multiple PNG pages');
        const dimensions=await page.locator('.photo-journal-page img').evaluateAll(images=>
          images.map(i=>({width:i.naturalWidth,height:i.naturalHeight,complete:i.complete,source:i.src.slice(0,5)})));
        ok(dimensions.length===n&&dimensions.every(i=>i.complete&&i.width===1600&&i.height===2400&&i.source==='blob:'),name+' each high resolution PNG preview renders');
        ok(await page.locator('.photo-journal-page a[download$=".png"]').count()===n,name+' each page is separately downloadable');
        ok(await page.locator('.photo-journal-actions .primary').isEnabled(),name+' native file-share button available after pre-generation');
        await page.locator('.photo-journal-actions .primary').click();
        const shared=await page.evaluate(()=>window.__moonjarShares);
        ok(shared.length===1&&shared[0].files.length===n,name+' one native share receives all selected pages');
        ok(shared[0].files.every(f=>f.name.endsWith('.png')&&f.size>15000&&f.type==='image/png'),name+' share transmits PNG files not PDF or text');
        if(engine==='chromium')ok(shared[0].gesture===true,name+' share requested with live click activation');
        await page.screenshot({path:`${output}/${name}-photo-share.png`,animations:'disabled'});
        // Deselect all personal writing. The artwork remains, and download works.
        await page.locator('#modal .photo-select-actions button').last().click();
        await page.waitForFunction(()=>document.querySelectorAll('.photo-journal-page').length===1,{timeout:18000});
        ok(await page.locator('#modal [data-photo-field="title"]').isChecked()===false,name+' clear action removes title selection');
        ok(await page.locator('#modal [data-photo-field="return.noticed"]').isChecked()===false,name+' clear action removes writing selection');
        ok(errors.length===0,name+' no JS errors '+errors.join(' | '));
        ok(external.length===0,name+' no external network transport '+external.join(' | '));
        await page.locator('#modal-close').click();
        ok(await page.locator('main.result-page [data-action="print-options"]').count()===1,name+' old PDF action preserved');
        console.log('PHOTO JOURNAL PASS',name,n,'pages');
      }catch(error){await page.screenshot({path:`${output}/${name}-failure.png`,animations:'disabled'}).catch(()=>{});throw error;}
      finally{await context.close();}
    }
  }finally{await browser.close();}
}
console.log('MOONJAR PHOTO JOURNAL PASS',checks,'assertions');
