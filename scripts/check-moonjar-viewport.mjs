import {beginWork,settleArtwork} from './moonjar-browser-helpers.mjs';
// Moonjar viewport regression. Real Chromium/WebKit pages, NOT physical phones.
// Ensures the editorial one-screen interaction does not hide tabs, journal,
// tactile material selection, or the finished artwork at compact sizes.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const ROOT='http://127.0.0.1:4173/activities/moonjar/';
const DIR='artifacts/moonjar-viewport';
await mkdir(DIR,{recursive:true});
const sizes=[
  [320,568,'small-phone'],
  [390,844,'mobile'],
  [768,900,'tablet-boundary'],
  [844,390,'small-landscape'],
  [1024,768,'tablet-landscape'],
  [1440,900,'desktop'],
];
let assertions=0;
const results=[];
function ok(value,message){assert.ok(value,message);assertions++;}
async function geometry(page){
  return page.evaluate(()=>{
    const rect=(sel)=>{
      const el=document.querySelector(sel);
      if(!el)return null;
      const r=el.getBoundingClientRect();
      const cs=getComputedStyle(el);
      return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,
        display:cs.display,visibility:cs.visibility,overflow:cs.overflow};
    };
    return {viewport:{width:innerWidth,height:innerHeight},scrollY,
      bodyOverflow:getComputedStyle(document.body).overflow,
      main:rect('#main'),stage:rect('.stage-area'),shell:rect('#stage-shell'),
      art:rect('#art'),palette:rect('#palette-panel'),
      notes:rect('#story-panel'),tabs:rect('.mobile-tabs'),
      result:rect('.result-layout')};
  });
}
async function run(name,browser,width,height,label){
  const isPhone=width<768;
  const compact=width<1200;
  const context=await browser.newContext({viewport:{width,height},
    isMobile:isPhone,hasTouch:compact,deviceScaleFactor:1,
    acceptDownloads:true,locale:'ko-KR',reducedMotion:'reduce'});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push('JS '+e.message));
  page.on('requestfailed',req=>errors.push('REQUEST '+req.url()+' '+req.failure()?.errorText));
  const id=name+'-'+label;
  let result={id};
  try{
    await page.goto(ROOT,{waitUntil:'networkidle',timeout:30000});
    await page.locator('.hero-cta').waitFor();
    let home=await geometry(page);
    ok(home.scrollY===0&&home.bodyOverflow==='hidden',id+' first scene does not scroll the document');
    ok(home.main.bottom<=height+1,id+' intro is a bounded composition');
    await beginWork(page,'free');
    await page.locator('#art').waitFor({state:'visible',timeout:12000});
    let start=await geometry(page);
    ok(start.bodyOverflow==='hidden'&&start.scrollY===0,id+' studio is one screen');
    ok(start.main.bottom<=height+2,id+' studio fits viewport');
    ok(start.art?.w>=70&&start.art?.h>=75,id+' actual jar must remain visible: '+JSON.stringify(start));
    if(compact){
      ok(await page.locator('.mobile-tabs [data-action="panel:story"]').isVisible(),id+' journal tab available');
    }else{
      ok(await page.locator('#story-panel').isVisible(),id+' desktop journal stays visible');
    }
    if(isPhone){
      ok(await page.locator('#palette-panel.mobile-active').isVisible(),id+' materials dock visible');
      await page.locator('#palette-panel.mobile-active [data-action="add:A01"]').click();
      await page.locator('#art [data-node]').first().waitFor({state:'attached'});
      const afterAdd=await geometry(page);
      ok(afterAdd.scrollY===0&&afterAdd.art.h>=75,id+' no scroll jump on material placement');
      if(height>=740&&name==='chromium'&&label==='mobile'){
        await settleArtwork(page);
  await page.screenshot({path:DIR+'/'+id+'-palette.png',animations:'disabled'});
      }
    }else{
      await page.locator('#palette-panel [data-action="add:A01"]').click();
      await page.locator('#art [data-node]').first().waitFor({state:'attached'});
      if(width>=1200){
        const withInspector=await geometry(page);
        ok(withInspector.art.h>=start.art.h*0.88,
          id+' selecting a piece must NOT steal the art area for an inspector: '+
          JSON.stringify({before:start.art,after:withInspector.art}));
        ok(withInspector.notes?.h>120,id+' journal remains visible under the right-hand editor inspector');
      }
    }
    ok(!(await page.locator('#notice').evaluate(el=>el.classList.contains('visible'))),
      id+' feedback must never cover the art and toolbar');
    if(compact&&!isPhone){
      await page.locator('.mobile-tabs [data-action="panel:controls"]').click();
      const inspector=page.locator('#controls-panel');
      ok(await inspector.isVisible(),id+' tool inspector reachable on tablet/landscape');
      const before=await page.locator('#art [data-node]').first().getAttribute('transform');
      await inspector.locator('[data-action="move:24:0"]').click();
      const after=await page.locator('#art [data-node]').first().getAttribute('transform');
      ok(before!==after,id+' tablet/landscape inspector moves a real fragment');
      const selected=await geometry(page);
      ok(selected.art?.h>=75&&selected.art.y>=selected.stage.y-3
        && selected.art.bottom<=selected.stage.bottom+4,
        id+' selected inspector must leave the real vessel on screen: '+JSON.stringify(selected));
      ok(await page.evaluate(()=>document.querySelector('.workspace').scrollTop===0
        && document.querySelector('.stage-area').scrollTop===0),
        id+' no hidden programmatic scroll of the workspace or stage');
      ok(selected.scrollY===0,id+' tool editing keeps page stationary');
      if(name==='chromium'&&label==='small-landscape'){
        await settleArtwork(page);
  await page.screenshot({path:DIR+'/'+id+'-inspector.png',animations:'disabled'});
      }
    }
    if(compact){
      await page.locator('.mobile-tabs [data-action="panel:story"]').click();
      const notes=page.locator('#story-panel.mobile-active');
      await notes.waitFor({state:'visible'});
      ok(await page.locator('.stage-area').evaluate(el=>el.inert),id+' artwork blocked while writing');
      ok((await geometry(page)).scrollY===0,id+' switching to journal does not scroll body');
      await notes.locator('[data-field="noticed"]').fill('나는 오늘 나만의 속도로 꾸미기를 선택했다.');
      const noteRect=await geometry(page);
      ok(noteRect.notes?.bottom<=height+1,id+' journal fits inside canvas station');
      if(name==='chromium'&&(label==='tablet-boundary'||label==='small-landscape')){
        await settleArtwork(page);
  await page.screenshot({path:DIR+'/'+id+'-journal.png',animations:'disabled'});
      }
      await page.locator('.mobile-tabs [data-action="panel:palette"]').click();
      ok(!(await page.locator('.stage-area').evaluate(el=>el.inert)),
        id+' exiting journal returns art interactions');
      const afterReturn=await geometry(page);
      ok(afterReturn.scrollY===0&&afterReturn.art.h>=75,
        id+' return to art without page movement');
    }else{
      const input=page.locator('#story-panel [data-field="noticed"]');
      await input.fill('오늘은 고르는 일을 즐겼다.');
    }
    if(name==='chromium'&&['mobile','desktop','small-landscape'].includes(label)){
      await settleArtwork(page);
  await page.screenshot({path:DIR+'/'+id+'-studio.png',animations:'disabled'});
    }
    await page.locator('.studio-bar [data-action="finish"]').click();
    await page.locator('main.result-page').waitFor({state:'visible'});
    const finish=await geometry(page);
    ok(finish.bodyOverflow==='hidden'&&finish.main.bottom<=height+1,
      id+' result in a single bounded screen');
    ok(await page.locator('main.result-page [data-action="card-options"]').count()===1,
      id+' result still includes opt-in art card');
    if(name==='chromium'&&['mobile','desktop'].includes(label)){
      await settleArtwork(page);
  await page.screenshot({path:DIR+'/'+id+'-result.png',animations:'disabled'});
    }
    ok(errors.length===0,id+' browser errors: '+errors.join(' | '));
    result={id,status:'PASS',artStart:start.art,artAfter:finish.main,journal:compact};
    console.log('VIEWPORT PASS: '+id);
  }catch(e){
    result={id,status:'FAIL',error:String(e),errors};
    console.error('VIEWPORT FAIL: '+id+' '+(e.stack||e));
    throw e;
  }finally{results.push(result);await context.close();}
}

let failed=null;
try{
  for(const [name,launcher] of [['chromium',chromium],['webkit',webkit]]){
    const browser=await launcher.launch({headless:true});
    try { for(const [w,h,label] of sizes)await run(name,browser,w,h,label); }
    finally { await browser.close(); }
  }
}catch(error){failed=error;process.exitCode=1;}
finally{
  await writeFile(DIR+'/results.json',JSON.stringify({
    assertions,results,passed:!failed,runDate:new Date().toISOString(),
    caveat:'Simulated Chromium and WebKit engines, not physical iOS/Android; virtual keyboard behavior is not verified.'
  },null,2));
  console.log('MOONJAR VIEWPORT MATRIX: '+assertions+' assertions, '+
    results.filter(r=>r.status==='PASS').length+'/'+results.length+' scenarios; '+(failed?'FAILED':'PASSED'));
}
