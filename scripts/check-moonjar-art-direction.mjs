// V3.2 real geometry and interactions; disposable browser repositories only.
// --baseline captures V3.1 evidence and never reports QA PASS.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {beginWork,settleArtwork} from './moonjar-browser-helpers.mjs';
const baseline=process.argv.includes('--baseline');
const base=process.env.MOONJAR_V32_BASE_URL||'http://127.0.0.1:4173/activities/moonjar/';
const out=`artifacts/moonjar-art-direction-v32${baseline?'-baseline':''}`;
const sizes=[[320,568],[360,800],[390,844],[430,932],[768,1024],[1024,768],[1440,900],[844,390]];
const editingSizes=[[320,568],[390,844],[430,932],[844,390],[1440,900]];
const fixture=JSON.parse(await readFile('tests/moonjar/fixtures/valid_six_pieces.moonjar.json','utf8'));
const results=[],geometry=[];let checks=0,failure=null;await mkdir(out,{recursive:true});
function ok(value,message){assert.ok(value,message);checks++;}
async function shot(page,name,fullPage=false){await settleArtwork(page);await page.screenshot({path:`${out}/${name}.png`,fullPage,animations:'disabled'});}
async function context(browser,width,height){
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<768,hasTouch:width<1200,locale:'ko-KR',timezoneId:'UTC',reducedMotion:'reduce'});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(`${r.url()}: ${r.failure()?.errorText}`));page.on('dialog',d=>d.accept());
 return {ctx,page,errors};
}
async function intro(browser,engine,width,height){
 const name=`${engine}-${width}x${height}-intro`,{ctx,page,errors}=await context(browser,width,height);
 try{
  await page.goto(base,{waitUntil:'networkidle'});await settleArtwork(page);
  const g=await page.evaluate(()=>{
   const box=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
   const figure=box(document.querySelector('.hero-figure')),svg=document.querySelector('.hero-figure svg'),matrix=svg.getScreenCTM(),v=svg.viewBox.baseVal;
   const corners=[[v.x,v.y],[v.x+v.width,v.y],[v.x,v.y+v.height],[v.x+v.width,v.y+v.height]].map(([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(matrix);return {x:p.x,y:p.y};});
   const letters=[...document.querySelectorAll('.hero-copy h1,.hero-copy .eyebrow,.hero-lead,.hero-start>.micro,.atelier-links span')].flatMap(el=>{
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),boxes=[];let node;
    while(node=walker.nextNode())for(let i=0;i<node.length;i++)if(node.textContent[i].trim()){const range=document.createRange();range.setStart(node,i);range.setEnd(node,i+1);boxes.push(box(range));}return boxes;
   });
   const buttons=[...document.querySelectorAll('.hero-cta,.atelier-links button')].map(el=>({...box(el),text:el.textContent.trim(),hit:(()=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})()}));
   return {figure,corners,letters,buttons,scale:{x:matrix.a,y:matrix.d},overflow:document.documentElement.scrollWidth-innerWidth,images:[...svg.querySelectorAll('image')].map(el=>el.getAttribute('href'))};
  });
  if(!baseline){
   ok(g.overflow<=1,name+' no horizontal overflow');
   ok(g.letters.length>35&&g.letters.every(r=>r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=height+1),name+' every actual title/body glyph remains visible');
   ok(g.letters.every(r=>r.right<=g.figure.x||r.x>=g.figure.right||r.bottom<=g.figure.y||r.y>=g.figure.bottom),name+' no glyph crosses artwork frame');
   ok(g.buttons.length===4&&g.buttons.every(b=>b.h>=44&&b.y>=0&&b.bottom<=height+1&&b.hit),name+' primary and three touchable destinations visible');
   ok(g.images.length===13&&g.images[0].endsWith('porcelain-night.png'),name+' original porcelain plus twelve original nacre');
   ok(Math.abs(g.scale.x-g.scale.y)<.001,name+' source is uniformly scaled');
   if(width<768){
    ok(g.corners.every(p=>p.x>=g.figure.x-.5&&p.x<=g.figure.right+.5&&p.y>=g.figure.y-.5&&p.y<=g.figure.bottom+.5),name+' all four source corners fit without a narrow crop');
    ok(g.corners[1].x-g.corners[0].x>=200,name+' whole original scene at least 200px wide');
   }
   ok(errors.length===0,name+' no JS/resource errors '+errors.join('|'));
  }
  await shot(page,name);results.push({name,status:baseline?'CAPTURE ONLY':'PASS',geometry:g});
 }catch(e){await shot(page,name+'-failure').catch(()=>{});throw e;}finally{await ctx.close();}
}
async function artwork(page,name,width,enforce=true){
 await settleArtwork(page);
 const g=await page.evaluate(()=>{
  const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
  const art=box('#art'),shell=box('#stage-shell'),tools=box('.art-toolbar'),tray=document.querySelector('.controls-panel.mobile-active,.palette-panel.mobile-active'),t=tray?.getBoundingClientRect(),overlaps=t&&t.left<art.right&&t.right>art.x;
  return {art,shell,tools,gap:tools.y-art.bottom,empty:shell.bottom-art.bottom,trayTop:overlaps?t.top:null,scrollY,overflow:document.documentElement.scrollWidth-innerWidth,viewBox:document.querySelector('#art').getAttribute('viewBox'),paused:document.querySelector('main').classList.contains('paused')};
 });
 geometry.push({name,...g});
 if(!baseline&&enforce){
  ok(g.scrollY===0&&g.overflow<=1,name+' stationary workspace');
  ok(g.art.y>=g.shell.y&&g.art.bottom<=g.shell.bottom+.5&&(!g.trayTop||g.art.bottom<=g.trayTop+.5),name+' full SVG inside frame above tray '+JSON.stringify(g));
  ok(Math.abs(g.art.w/g.art.h-8/9)<.002&&g.viewBox==='0 0 1600 1800',name+' original ratio/coordinates');
  ok(g.art.h>=(width===320&&!g.paused?190:80),name+' usable artwork height '+g.art.h);
  if(!g.paused){ok(g.empty<=11&&g.empty>=0,name+' no unused lower mat '+g.empty);ok(g.gap>=0&&g.gap<=22,name+' toolbar adjacent '+g.gap);ok(Math.abs(g.tools.x+g.tools.w/2-g.art.x-g.art.w/2)<1,name+' center axis aligned');}
 }
 return g;
}
async function editing(browser,engine,width,height,mode,storage){
 const name=`${engine}-${width}x${height}-${mode}-${storage}`,{ctx,page,errors}=await context(browser,width,height),capture=storage==='personal'&&mode==='free';
 try{
  await page.goto(base,{waitUntil:'networkidle'});await beginWork(page,mode,storage);
  if(mode==='guided'&&width<1200)await page.locator('.mobile-tabs [data-action="panel:palette"]').click();
  await page.locator('[data-action="add:A01"]').click();
  if(width<1200)await page.locator('[data-action="panel:controls"]').click();
  const initial=await artwork(page,name+' selected',width);if(capture)await shot(page,name+'-selected');
  if(!baseline){
   ok(await page.locator('.studio').evaluate((el,m)=>el.classList.contains('mode-'+m),mode),name+' explicit content mode retained');
   // Exercise magnification before changing the single A01 scene. This catches
   // frame growth that ordinary fit-mode geometry assertions cannot detect.
   const originalNodes=await page.locator('#art [data-node]').evaluateAll(nodes=>nodes.map(n=>n.outerHTML));
   async function view(action){
    if(width<768)await page.locator('.compact-view').click();
    await page.locator(`${width<768?'#modal':'.stage-area .view-toolbar'} [data-action="${action}"]`).click();await settleArtwork(page);
   }
   for(let i=0;i<4;i++)await view('zoom-in');
   const zoomed=await page.evaluate(()=>{
    const s=document.querySelector('#stage-shell'),stage=document.querySelector('.stage-area').getBoundingClientRect(),r=s.getBoundingClientRect(),t=document.querySelector('.art-toolbar').getBoundingClientRect();
    return {top:r.top,bottom:r.bottom,stageTop:stage.top,stageBottom:stage.bottom,toolsTop:t.top,toolsBottom:t.bottom,clientW:s.clientWidth,clientH:s.clientHeight,scrollW:s.scrollWidth,scrollH:s.scrollHeight,paper:document.querySelector('#paper').getBoundingClientRect().width};
   });
   ok(zoomed.top>=zoomed.stageTop&&zoomed.bottom<=zoomed.stageBottom&&zoomed.toolsTop>=0&&zoomed.toolsBottom<=height,name+' zoom frame and history/save tools remain on screen');
   ok(zoomed.scrollW>zoomed.clientW+40&&zoomed.scrollH>zoomed.clientH+40,name+' zoom creates a real two-axis scroll viewport');
   ok(JSON.stringify(await page.locator('#art [data-node]').evaluateAll(nodes=>nodes.map(n=>n.outerHTML)))===JSON.stringify(originalNodes),name+' zoom changes no scene node');
   if(capture)await shot(page,name+'-zoom');
   const scrollBefore=await page.locator('#stage-shell').evaluate(s=>({x:s.scrollLeft,y:s.scrollTop}));
   // Playwright mobile WebKit cannot send wheel input. Its programmatic scroll
   // proves the real viewport scroll range; physical finger panning is unverified.
   if(engine==='webkit'&&width<768)await page.locator('#stage-shell').evaluate(s=>s.scrollBy(80,80));
   else{await page.locator('#stage-shell').hover();await page.mouse.wheel(80,80);}
   await page.waitForFunction(p=>{const s=document.querySelector('#stage-shell');return s.scrollLeft>p.x+10&&s.scrollTop>p.y+10;},scrollBefore);
   ok(await page.evaluate(()=>scrollY===0),name+' viewport scroll moves both axes without moving document');
   await view('zoom-out');
   ok((await page.locator('#paper').boundingBox()).width<zoomed.paper,name+' zoom-out reduces actual artwork');
   await view('fit');
   const fitted=await artwork(page,name+' fit after zoom',width);
   ok(Math.abs(fitted.art.h-initial.art.h)<2,name+' whole-view action restores original fitted size');
   ok(JSON.stringify(await page.locator('#art [data-node]').evaluateAll(nodes=>nodes.map(n=>n.outerHTML)))===JSON.stringify(originalNodes),name+' zoom roundtrip preserves scene nodes');
   let previous=await page.locator('#art [data-node]').evaluate(el=>el.outerHTML);
   for(const [tab,action]of [['move','move:24:0'],['rotate','rotate:15'],['size','size:1.1']]){
    await page.locator(`#controls-panel [data-action="control:${tab}"]`).click();
    const b=page.locator(`#controls-panel [data-action="${action}"]`);await b.focus();await page.keyboard.press('Enter');
    const next=await page.locator('#art [data-node]').evaluate(el=>el.outerHTML);ok(next!==previous,name+' focused '+tab+' changes actual SVG');previous=next;
    await artwork(page,name+' '+tab,width);if(capture&&[320,390].includes(width))await shot(page,name+'-'+tab);
   }
   await page.locator('.art-toolbar [data-action=undo]').click();ok(await page.locator('#art [data-node]').evaluate(el=>el.outerHTML)!==previous,name+' undo changes actual transform');
   await page.locator('.art-toolbar [data-action=redo]').click();ok(await page.locator('#art [data-node]').evaluate(el=>el.outerHTML)===previous,name+' redo restores exact transform');await artwork(page,name+' history',width);
   const advanced=page.locator('#controls-panel [data-action="control:advanced"]');if(await advanced.isVisible())await advanced.click();else await page.locator('#controls-panel details summary').click();
   await page.locator('#controls-panel [data-action=duplicate]').click();ok(await page.locator('#art [data-node]').count()===2,name+' duplicate reachable');
   await page.locator('#controls-panel [data-action=lock]').click();ok(await page.locator('#controls-panel [data-action=lock]').innerText()==='잠금 해제',name+' lock reachable');await artwork(page,name+' advanced',width);
   if(capture&&[320,390].includes(width))await shot(page,name+'-advanced');
   await page.locator('#controls-panel [data-action=lock]').click();await page.locator('#controls-panel [data-action="control:move"]').click();
   if(width<768){
    await page.locator('.compact-view').click();
    if(mode==='guided'&&height<=650)ok(await page.locator('#modal .scene-nav button').count()===7,name+' seven stories retained in compact viewing menu');
    await page.locator('#modal-close').click();const restored=await artwork(page,name+' viewing menu closed',width);ok(Math.abs(restored.art.h-initial.art.h)<2,name+' viewing menu preserves artwork height');
   }
   await page.locator('.art-toolbar [data-action=save-options]').click();ok(await page.locator('#modal [data-action=export-json]').isVisible(),name+' actual backup available');await page.locator('#modal-close').click();await artwork(page,name+' save dialog closed',width);
   if(storage==='personal')await page.waitForFunction(()=>document.querySelector('#save-state')?.textContent==='이 기기에 저장됨');else await page.waitForFunction(()=>document.querySelector('#save-state')?.textContent==='화면에만 유지 중');
   const saved=await page.evaluate(async()=>{const {openRepository}=await import('./src/persistence.js');const r=await openRepository(),d=await r.list();r.close();return d;});
   ok(storage==='personal'?saved.length===1&&saved[0].scene.nodes.length===2:saved.length===0,name+' actual repository matches storage choice');
   if(width<1200)await page.locator('[data-action="panel:look"]').click();else await page.locator('[data-action=pause]').click();
   await page.locator('.paused').waitFor();await artwork(page,name+' reflection',width);ok(await page.locator('#look-prompt').isVisible(),name+' DAILY viewing reachable');
   if(capture&&[320,390].includes(width))await shot(page,name+'-reflection');
   await page.locator('#look-prompt [data-action="panel:palette"]').click();await artwork(page,name+' return to materials',width);
   ok(errors.length===0,name+' no JS/resource errors '+errors.join('|'));
  }
  results.push({name,status:baseline?'CAPTURE ONLY':'PASS',initial});console.log(baseline?'CAPTURE':'ART DIRECTION PASS',name);
 }catch(e){await shot(page,name+'-failure').catch(()=>{});throw e;}finally{await ctx.close();}
}
function archiveFixtures(kind){
 if(kind==='empty')return [];
 const legacy=structuredClone(fixture),porcelain=structuredClone(fixture);porcelain.projectId='v32-porcelain';porcelain.scene.canvasVariant='porcelain-v2';porcelain.title='손끝에 남은 빛';porcelain.updatedAt='2026-10-16T12:30:00Z';
 const long=structuredClone(porcelain);long.projectId='v32-long-title';long.title=('오늘의 작은 빛을 모아 나에게 남기는 조용한 이야기, ').repeat(4).slice(0,80);long.updatedAt='2026-10-17T12:30:00Z';
 return kind==='legacy'?[legacy]:kind==='porcelain'?[porcelain]:kind==='long-title'?[long]:[long,porcelain,legacy];
}
async function archive(browser,engine,width,kind){
 const height=width===1440?900:844,name=`${engine}-${width}x${height}-archive-${kind}`,{ctx,page,errors}=await context(browser,width,height),docs=archiveFixtures(kind);
 try{
  await page.goto(base,{waitUntil:'networkidle'});
  await page.evaluate(async documents=>{const {openRepository}=await import('./src/persistence.js');const r=await openRepository();for(const d of documents)await r.save(d,null);r.close();},docs);
  await page.goto(base+'#/projects',{waitUntil:'networkidle'});await settleArtwork(page);
  if(!baseline){
   ok(await page.locator('.project-card').count()===docs.length,name+' correct fixture count');
   ok((await page.locator('main').innerText()).includes('자동으로 다른 기기와 동기화되지 않습니다'),name+' browser-local meaning preserved');
   ok((await page.locator('.archive-privacy').innerText()).includes('공용 기기'),name+' shared-browser privacy preserved');
   ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),name+' no overflow even for eighty-character title');
   if(!docs.length)ok(await page.locator('.archive-empty button').count()===2&&await page.locator('.project-list').count()===0,name+' empty gallery two clear actions and no empty grid');
   else{
    const b=await page.locator('.project-card > .comparison-scene').first().boundingBox(),minimumWidth=width===390?340:docs.length===1?400:300;
    ok(b.width>=minimumWidth&&b.height>=300,name+' artwork is the leading exhibition surface');ok(await page.locator('.project-card time[datetime]').count()===docs.length,name+' semantic last-edited times');
    for(const button of await page.locator('.project-card-actions').first().locator('button').all()){await button.focus();ok(await button.evaluate(el=>document.activeElement===el&&el.getBoundingClientRect().height>=44),name+' each action has focus and 44px target');}
    await page.evaluate(()=>document.activeElement?.blur());
   }
  }
  await shot(page,name,true);
  const stored=await page.evaluate(async()=>{const {openRepository}=await import('./src/persistence.js');const r=await openRepository(),d=await r.list();r.close();return d;}),canonical=d=>JSON.stringify(d.toSorted((a,b)=>a.projectId.localeCompare(b.projectId)));
  if(!baseline){
   ok(canonical(stored)===canonical(docs),name+' gallery never rewrites source notes/geometry/document');
   if(docs.length){
    const first=await page.locator('.project-card .primary').first().getAttribute('data-action'),id=first.slice(5);
    await page.locator('.project-card .primary').first().click();await page.locator('#art [data-node]').first().waitFor();
    ok(await page.evaluate(()=>location.hash)==='#/studio/'+id,name+' resume keeps original identity');ok(await page.locator('#art [data-node]').count()===6,name+' all six source fragments render');
    const opened=await page.evaluate(async id=>{const {openRepository}=await import('./src/persistence.js');const r=await openRepository(),d=await r.get(id);r.close();return d;},id);
    ok(JSON.stringify(opened)===JSON.stringify(docs.find(d=>d.projectId===id)),name+' resume does not migrate or rewrite fields');
    await page.goBack();await page.locator('.project-card').first().waitFor();ok(await page.evaluate(()=>location.hash)==='#/projects',name+' browser Back returns to gallery');
    await page.locator('[data-action^="delete-project:"]').first().click();await page.locator('#modal [data-action=cancel]').click();ok(await page.locator('.project-card').count()===docs.length,name+' delete cancel preserves all works');
   }
   ok(errors.length===0,name+' no JS/resource errors '+errors.join('|'));
  }
  results.push({name,status:baseline?'CAPTURE ONLY':'PASS',projectIds:docs.map(d=>d.projectId)});console.log(baseline?'CAPTURE':'ART DIRECTION PASS',name);
 }catch(e){await shot(page,name+'-failure',true).catch(()=>{});throw e;}finally{await ctx.close();}
}
try{
 for(const [engine,launcher]of [['chromium',chromium],['webkit',webkit]]){
  const browser=await launcher.launch();try{
   for(const [width,height]of sizes)await intro(browser,engine,width,height);
   for(const [width,height]of editingSizes)for(const [mode,storage]of baseline?[['free','personal']]:[['free','personal'],['free','memory'],['guided','personal'],['guided','memory']])await editing(browser,engine,width,height,mode,storage);
   for(const kind of ['empty','legacy','porcelain','long-title','multiple'])await archive(browser,engine,390,kind);
   for(const kind of ['porcelain','multiple'])await archive(browser,engine,1440,kind);
  }finally{await browser.close();}
 }
}catch(e){failure=e;console.error(e.stack);process.exitCode=1;}
finally{
 await writeFile(`${out}/results.json`,JSON.stringify({checks,status:failure?'FAIL':baseline?'CAPTURE ONLY':'PASS',results,error:failure?.message||null,notes:'Real Chromium/WebKit, emulated viewports, isolated synthetic and legacy fixture data. Counts include repeated geometry and overlap prior regression. No design approval or physical-device/AT/200%-text/OS-print claim.'},null,2));
 await writeFile(`${out}/geometry.json`,JSON.stringify(geometry,null,2));console.log('ART DIRECTION V3.2',checks,'assertions',results.length,'scenarios',failure?'FAIL':baseline?'CAPTURE ONLY':'PASS');
}
