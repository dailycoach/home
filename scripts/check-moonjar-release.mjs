// WAVE 5 browser verification on the actual local static app, never production.
// Chromium mobile emulation and WebKit engine are NOT physical Android/iPhone tests.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';

const HOST='http://127.0.0.1:4173';
const PATH='/activities/moonjar/';
const ART='artifacts/moonjar-release-matrix';
await mkdir(ART,{recursive:true});
const record=[];
let checks=0;
function verify(expr,message) { assert.ok(expr,message); checks++; }
function recordResult(name,result,extra={}) {record.push({name,result,...extra});console.log(`W5 ${result}: ${name}`);}
function attachEvents(page,errors) {
  page.on('pageerror',e=>errors.push(`JS: ${e.message}`));
  page.on('requestfailed',r=>errors.push(`REQUEST: ${r.url()} ${r.failure()?.errorText}`));
  page.on('request',r=>{const u=new URL(r.url());if(u.hostname!=='127.0.0.1')errors.push(`REMOTE: ${r.url()}`);});
}
async function ensureNoOverflow(page,name){
  const values=await page.evaluate(()=>({
    doc:document.documentElement.scrollWidth,
    body:document.body.scrollWidth,
    inner:innerWidth,
    outer:document.documentElement.clientWidth,
    height:innerHeight
  }));
  verify(values.doc <= values.inner+2,`${name} overflows viewport: ${JSON.stringify(values)}`);
}
async function screenshot(page,name) {
  await page.screenshot({path:`${ART}/${name}.png`,fullPage:false,animations:'disabled'});
}
async function entryMatrix(browser,engine,width,height) {
  const context=await browser.newContext({
    viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true,
    locale:'ko-KR',acceptDownloads:true,reducedMotion:'reduce'
  });
  const page=await context.newPage(),errors=[];
  attachEvents(page,errors);
  const name=`${engine}-${width}`;
  try {
    await page.goto(HOST+PATH,{waitUntil:'networkidle',timeout:30000});
    const hero=page.locator('.hero-figure img');
    await hero.evaluate(img=>img.decode());
    verify(await hero.evaluate(img=>img.naturalWidth>0 && img.naturalHeight>0),`${name} hero asset`);
    await ensureNoOverflow(page,`${name} entry`);
    const buttons=page.locator('.hero-actions [data-action="start-guided"], .hero-actions [data-action="start-free"]');
    verify(await buttons.count()===2,`${name} two start options`);
    await page.locator('[data-action="start-guided"]').click();
    await page.locator('#art').waitFor({state:'visible'});
    verify(await page.locator('#save-state').getAttribute('role')==='status'
      && await page.locator('#save-state').getAttribute('aria-live')==='polite',
      `${name} save status must be announced accessibly`);
    verify(await page.locator('#scene-lead').isVisible(),`${name} guided scene visible`);
    await ensureNoOverflow(page,`${name} guided studio`);
    await page.locator('[data-action="panel:palette"]').click();
    await page.locator('.piece-choice[data-action="add:A01"]').tap();
    const tray=page.locator('#controls-panel.mobile-active');
    await tray.waitFor({state:'visible',timeout:10000});
    const svg=page.locator('#art');
    const initial=await svg.locator('[data-node]').first().getAttribute('transform');
    await tray.locator('[data-action="move:24:0"]').tap();
    const changed=await svg.locator('[data-node]').first().getAttribute('transform');
    verify(initial!==changed,`${name} touch-based button moves selected nacre`);
    const position=await page.evaluate(()=>{
      const a=document.querySelector('#art').getBoundingClientRect();
      const p=document.querySelector('#controls-panel').getBoundingClientRect();
      const visible=Math.max(0,Math.min(a.bottom,p.top,innerHeight)-Math.max(a.top,0));
      const chip=document.querySelector('#art [data-id]').getBoundingClientRect();
      return {visible,chip:(chip.top+chip.bottom)/2,tray:p.top};
    });
    verify(position.visible>=135,`${name} artwork visible above drawer: ${JSON.stringify(position)}`);
    verify(position.chip>0 && position.chip<position.tray,`${name} selected nacre visible: ${JSON.stringify(position)}`);
    await ensureNoOverflow(page,`${name} editor`);
    await screenshot(page,`studio-${name}`);

    // Touch the real artwork after closing the tool drawer.
    await tray.locator('[data-action="panel:canvas"]').tap();
    verify(await page.locator('#stage-shell').evaluate(node=>document.activeElement===node),
      `${name} focus must return to artwork after closing controls`);
    await svg.locator('[data-id]').first().scrollIntoViewIfNeeded();
    const b=await svg.locator('[data-id]').first().boundingBox();
    await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);
    verify(await svg.locator('.selection').count()===1,`${name} finger tap selects nacre`);

    // The guided reflection remains optional and the current doc survives reload.
    await page.locator('.mobile-tabs [data-action="panel:story"]').tap();
    await page.locator('.scene-nav [data-action="scene:return"]').tap();
    const note=page.locator('#story-panel [data-field="noticed"]');
    await note.fill(`테스트 ${engine} ${width} 알아차림`);
    await note.blur();
    await page.waitForFunction(()=>document.querySelector('#save-state')?.textContent?.includes('이 기기에 저장됨'),{timeout:10000});
    await page.reload({waitUntil:'networkidle'});
    verify(await page.locator('#art [data-node]').count()===1,`${name} artwork restored`);
    verify(await page.locator('#story-panel [data-field="noticed"]').inputValue()===`테스트 ${engine} ${width} 알아차림`,`${name} reflection restored`);
    await ensureNoOverflow(page,`${name} restored`);
    await screenshot(page,`restored-${name}`);
    const meta=await page.locator('#art').evaluate(el=>({
      images:el.querySelectorAll('image').length,nodes:el.querySelectorAll('[data-node]').length
    }));
    await page.locator('[data-action="projects"]').click();
    await page.locator('.projects-page .project-card').first().waitFor({state:'visible',timeout:12000});
    verify(await page.locator('.projects-page .project-card').count()===1,
      `${name} one saved project should produce exactly one list card`);
    recordResult(name,'PASS',{position,meta});
    verify(errors.length===0,`${name} browser errors: ${errors.join(' | ')}`);
  }catch(error){
    recordResult(name,'FAIL',{error:String(error),errors});
    throw error;
  }finally{await context.close();}
}
async function privacyMatrix(browser,engine){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,acceptDownloads:true});
  const page=await context.newPage(),errors=[];attachEvents(page,errors);
  try{
    await page.goto(HOST+PATH,{waitUntil:'networkidle'});
    await page.locator('#storage-memory').check();
    await page.locator('[data-action="start-free"]').tap();
    await page.locator('[data-action="panel:palette"]').tap();
    await page.locator('[data-action="add:A01"]').tap();
    await page.locator('#art [data-node]').first().waitFor({state:'attached',timeout:12000});
    verify(await page.locator('#art [data-node]').count()===1,`${engine} memory work created`);
    await page.reload({waitUntil:'networkidle'});
    await page.locator('.hero-actions [data-action="start-free"]').waitFor({state:'visible'});
    verify(await page.locator('#art [data-node]').count()===0,`${engine} private mode intentionally does not restore on reload`);
    await page.locator('[data-action="projects"]').click();
    await page.locator('.projects-page .empty-state').first().waitFor({state:'visible',timeout:12000});
    verify((await page.locator('.projects-page .empty-state').count())===1,
      `${engine} project list must render exactly once and contain no memory-mode artwork`);
    verify(errors.length===0,`${engine} privacy browser errors: ${errors.join(' | ')}`);
    recordResult(`${engine}-non-persistent`,'PASS');
  }catch(e){recordResult(`${engine}-non-persistent`,'FAIL',{error:String(e),errors});throw e}
  finally{await context.close();}
}
async function stress(browser){
  const context=await browser.newContext({viewport:{width:1366,height:850},acceptDownloads:true});
  const page=await context.newPage();
  try{
    await page.goto(HOST+PATH,{waitUntil:'networkidle'});
    const result=await page.evaluate(async()=>{
      const [{Editor,newProject},{renderSVG,Materials},manifest,empty]=await Promise.all([
        import('./src/domain.js'),import('./src/rendering.js'),
        fetch('./data/manifest.json').then(r=>r.json()),fetch('./data/empty.json').then(r=>r.json())
      ]);
      const editor=new Editor(newProject(empty,'free'),manifest);
      const ids=manifest.pieces.map(p=>p.id);
      const start=performance.now();
      for(let i=0;i<160;i++)editor.add(ids[i%ids.length]);
      const buildMs=performance.now()-start;
      const materials=new Materials(manifest);
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 1600 1800');
      const t0=performance.now();
      renderSVG(svg,editor.doc.scene,materials);
      const renderMs=performance.now()-t0;
      return {buildMs,renderMs,nodes:svg.querySelectorAll('[data-node]').length,pieces:editor.doc.scene.nodes.length,undoDepth:editor.past.length};
    });
    verify(result.nodes===160 && result.pieces===160,'160-piece composition renders completely');
    verify(result.undoDepth===100,'bounded undo history remains limited to 100 actions');
    verify(result.renderMs<5000,`160-piece SVG rendering exceeds 5s: ${JSON.stringify(result)}`);
    recordResult('desktop-160-piece-stress','PASS',result);
  }catch(e){recordResult('desktop-160-piece-stress','FAIL',{error:String(e)});throw e}
  finally{await context.close();}
}
const browsers=[['chromium',chromium],['webkit',webkit]];
let failure=null;
try{
  for(const [engine,launcher] of browsers){
    const browser=await launcher.launch({headless:true});
    try{
      for(const width of [320,360,390,430])await entryMatrix(browser,engine,width,844);
      await privacyMatrix(browser,engine);
      if(engine==='chromium')await stress(browser);
    }finally{await browser.close()}
  }
}catch(e){failure=e;console.error('WAVE5 RELEASE MATRIX FAILED:',e.stack||String(e));process.exitCode=1}
finally {
  await writeFile(`${ART}/results.json`,JSON.stringify({
    generatedAt:new Date().toISOString(),checks,results:record,
    note:'Chromium mobile emulation and Playwright WebKit engine only. No physical iPhone/Android device has been tested.'
  },null,2));
  console.log(`WAVE5 MATRIX: ${checks} assertions across ${record.length} scenarios. ${failure?'FAILED':'PASSED'}`);
}
