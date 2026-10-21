// V3.1: independently reproducible geometry, actual actions and rendered evidence.
// Isolated browser data only; never production, a real user's DB, or a mockup.
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {settleArtwork,beginWork} from './moonjar-browser-helpers.mjs';
const base='http://127.0.0.1:4173/activities/moonjar/';
const out='artifacts/moonjar-refinement-v31';await mkdir(out,{recursive:true});
let checks=0;const results=[];
function ok(value,message){assert.ok(value,message);checks++;}
async function shot(page,name,fullPage=false){await settleArtwork(page);await page.screenshot({path:`${out}/${name}.png`,fullPage,animations:'disabled'});}
async function visibleArtwork(page,name,width){
 await settleArtwork(page);
 const g=await page.evaluate(()=>{
  const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom};};
  const art=box('#art'),shell=box('#stage-shell'),tray=document.querySelector('.controls-panel.mobile-active,.palette-panel.mobile-active');
  const t=tray?.getBoundingClientRect();
  const edge=t&&t.left<art.x+art.w&&t.right>art.x?t.top:shell.bottom;
  return {art,shell,edge,y:scrollY,overflow:document.documentElement.scrollWidth-innerWidth};
 });
 ok(g.y===0&&g.overflow<=1,name+' document remains stationary without overflow');
 ok(g.art.y>=g.shell.y-1&&g.art.bottom<=g.edge+1,name+' real SVG stays above tray '+JSON.stringify(g));
 if(width===320)ok(g.art.h>=190,name+' small-phone artwork >=190px '+g.art.h);
 else ok(g.art.h>=80,name+' artwork remains visible');
 return g.art;
}
async function inspect(launcher,engine,width,height){
 const name=`${engine}-${width}x${height}`;
 const browser=await launcher.launch(),ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<768,hasTouch:width<1200,locale:'ko-KR',acceptDownloads:true,reducedMotion:'reduce'}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));page.on('dialog',d=>d.accept());
 try{
  await page.goto(base,{waitUntil:'networkidle'});await settleArtwork(page);
  const intro=await page.evaluate(()=>{
   const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};};
   const frame=rect(document.querySelector('.hero-figure'));
   const letters=[...document.querySelectorAll('.hero-copy h1,.hero-lead')].flatMap(el=>{
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),boxes=[];let node;
    while(node=walker.nextNode())for(let i=0;i<node.length;i++)if(node.textContent[i].trim()){const r=document.createRange();r.setStart(node,i);r.setEnd(node,i+1);boxes.push(rect(r));}return boxes;
   });
   return {frame,letters,overflow:document.documentElement.scrollWidth-innerWidth,cta:rect(document.querySelector('.hero-cta')),links:rect(document.querySelector('.atelier-links'))};
  });
  ok(intro.overflow<=1,name+' intro does not overflow');
  ok(intro.cta.bottom<=height&&intro.links.bottom<=height,name+' CTA and destinations visible initially');
  ok(intro.letters.every(r=>r.right<=intro.frame.x||r.x>=intro.frame.right||r.bottom<=intro.frame.y||r.y>=intro.frame.bottom),name+' every title/body glyph is separate from original image');
  await shot(page,name+'-intro');
  await page.locator('.hero-cta').click();await settleArtwork(page);
  const start=await page.locator('.start-actions [type=submit]').boundingBox();ok(start.y>=0&&start.y+start.height<=height,name+' start CTA visible without scrolling');
  ok((await page.locator('.start-choice small').allTextContents()).join(' ').includes('새로고침하면 사라집니다'),name+' non-persistence warning preserved');
  ok((await page.locator('.start-choice small').allTextContents()).join(' ').includes('동기화되지 않습니다'),name+' local-only meaning preserved');
  await shot(page,name+'-start');
  await page.locator('.start-actions [type=submit]').click();await page.locator('#art').waitFor();
  let art=await visibleArtwork(page,name+' materials',width);await shot(page,name+'-materials');
  await page.locator('[data-action="add:A01"]').click();await page.locator('#art [data-node]').waitFor();await visibleArtwork(page,name+' placed',width);
  if(width<1200)await page.locator('[data-action="panel:controls"]').click();
  art=await visibleArtwork(page,name+' controls',width);
  let transform=await page.locator('#art [data-node]').evaluate(el=>el.outerHTML);
  for(const [kind,action] of [['move','move:24:0'],['rotate','rotate:15'],['size','size:1.1']]){
   await page.locator(`#controls-panel [data-action="control:${kind}"]`).click();
   await page.locator(`#controls-panel [data-action="${action}"]`).click();
   const next=await page.locator('#art [data-node]').evaluate(el=>el.outerHTML);ok(next!==transform,name+' '+kind+' changes actual geometry');transform=next;await visibleArtwork(page,name+' '+kind,width);
  }
  await page.locator('.art-toolbar [data-action=undo]').click();ok(await page.locator('#art [data-node]').evaluate(el=>el.outerHTML)!==transform,name+' undo works from controls');await visibleArtwork(page,name+' undo',width);
  await page.locator('.art-toolbar [data-action=redo]').click();ok(await page.locator('#art [data-node]').evaluate(el=>el.outerHTML)===transform,name+' redo restores geometry');await visibleArtwork(page,name+' redo',width);
  await page.locator('#controls-panel [data-action="control:move"]').click();await shot(page,name+'-studio');
  if(width<768){
   await page.locator('#controls-panel [data-action="control:advanced"]').click();
   await page.locator('#controls-panel [data-action=duplicate]').click();ok(await page.locator('#art [data-node]').count()===2,name+' advanced duplicate remains accessible');await visibleArtwork(page,name+' advanced',width);
   await page.locator('#controls-panel [data-action=lock]').click();ok(await page.locator('#controls-panel [data-action=lock]').innerText()==='잠금 해제',name+' lock preserved');await page.locator('#controls-panel [data-action=lock]').click();
   await page.locator('#controls-panel [data-action="control:move"]').click();
   const before=await page.locator('#art').boundingBox();
   await page.locator('.compact-view').click();await page.locator('#modal #nacre-visibility-switch').waitFor();
   ok(await page.locator('#nacre-visibility-switch').count()===1,name+' real outline control is reused exactly once');
   await page.locator('#nacre-visibility-switch').click();ok(await page.locator('#nacre-visibility-switch').getAttribute('aria-pressed')==='true',name+' outline aid accessible from viewing menu');
   await page.locator('#nacre-visibility-switch').click();await page.locator('#modal-close').click();await page.locator('#modal').waitFor({state:'hidden'});
   await page.locator('.stage-area #nacre-visibility-switch').waitFor({state:'attached'});
   ok(await page.locator('.stage-area #nacre-visibility-switch').count()===1,name+' original viewing controls returned on dialog close');
   ok(Math.abs((await page.locator('#art').boundingBox()).height-before.height)<2,name+' viewing options do not shrink artwork');
   await page.locator('.art-toolbar [data-action=save-options]').click();ok(await page.locator('#modal [data-action=export-json]').isVisible(),name+' manual backup reachable while adjusting');await shot(page,name+'-save');await page.locator('#modal-close').click();await visibleArtwork(page,name+' save',width);
  }
  await page.waitForFunction(()=>document.querySelector('#save-state')?.textContent==='이 기기에 저장됨');
  const id=await page.evaluate(()=>location.hash);await page.reload({waitUntil:'networkidle'});await page.locator('#art [data-node]').first().waitFor();ok(await page.evaluate(()=>location.hash)===id,name+' existing storage identity survives reload');
  if(width<1200)await page.locator('[data-action="panel:look"]').click();else await page.locator('[data-action=pause]').click();
  await page.locator('.paused').waitFor();await shot(page,name+'-reflection');
  await page.locator('#look-prompt [data-action="panel:palette"]').click();await page.locator('.studio-bar [data-action=finish]').click();await page.locator('.result-page').waitFor();await shot(page,name+'-gallery');
  await page.locator('.site-header [data-action=projects]').click();await page.locator('.project-card').waitFor();
  const thumbnail=await page.locator('.project-card > .comparison-scene').boundingBox();if(width===390)ok(thumbnail.width>=320&&thumbnail.height>=300,name+' archive exhibits large artwork before metadata');
  await shot(page,name+'-archive',true);
  await page.locator('[data-action^="rename:"]').click();await page.locator('.rename-input').fill('조용한 빛을 모으는 나의 아주 작은 공방');await page.locator('#modal [type=submit]').click();await page.locator('.project-card h2').filter({hasText:'조용한 빛'}).waitFor();
  ok(await page.locator('.project-card').count()===1,name+' rename keeps saved work');
  await page.locator('.project-card .primary').click();await page.locator('#art [data-node]').first().waitFor();ok(await page.evaluate(()=>location.hash)===id,name+' gallery resume preserves original project');
  ok(errors.length===0,name+' no JS/resource errors '+errors.join('|'));
  results.push({name,status:'PASS',art,thumbnail,intro});console.log('REFINEMENT PASS',name,'art',Math.round(art.w)+'×'+Math.round(art.h));
 }catch(e){await shot(page,name+'-failure').catch(()=>{});results.push({name,status:'FAIL',error:e.message,errors});throw e;}
 finally{await ctx.close();await browser.close();}
}
let failed=null;
try{
 for(const [engine,launcher]of [['chromium',chromium],['webkit',webkit]]){
  if(process.env.MOONJAR_CHROMIUM_ONLY&&engine==='webkit')continue;
  for(const [w,h]of [[320,568],[360,800],[390,844],[430,932],[768,1024],[1024,768],[1440,900],[844,390]])await inspect(launcher,engine,w,h);
 }
}catch(e){failed=e;console.error(e.stack);process.exitCode=1;}
finally{await writeFile(`${out}/results.json`,JSON.stringify({checks,results,passed:!failed,error:failed?.message||null,notes:'Real Chromium/WebKit, simulated viewports. Glyph/image non-overlap is supplemented with visual review. Physical phones, screen readers and Work preview are separate gates.'},null,2));console.log('REFINEMENT',checks,'assertions',results.length,'scenarios',failed?'FAIL':'PASS');}
