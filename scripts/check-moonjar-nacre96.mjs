// WAVE 8: verify all 96 original nacre PNGs against both porcelain themes.
// Includes real rendered SVG screenshots and bit-identical ON/OFF exported art.
// Browser simulation, not a replacement for actual Android/iPhone hardware QA.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const url='http://127.0.0.1:4173/activities/moonjar/';
const output='artifacts/moonjar-nacre96';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
let checks=0;
const results=[];
const fail=(condition,message)=>{assert.ok(condition,message);checks++;};
let context;
try{
  context=await browser.newContext({
    viewport:{width:1950,height:2150},deviceScaleFactor:1,
    locale:'ko-KR',acceptDownloads:true
  });
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('requestfailed',request=>errors.push(request.url()+': '+request.failure()?.errorText));
  await page.goto(url,{waitUntil:'networkidle',timeout:30000});
  await page.locator('[data-action="start-free"]').click();
  await page.locator('#nacre-visibility-switch').waitFor({state:'visible',timeout:15000});

  const initial=await page.evaluate(async()=>{
    const [{Materials,renderSVG,exportPNG},{newProject},manifest,empty]=await Promise.all([
      import('./src/rendering.js'),
      import('./src/domain.js'),
      fetch('./data/manifest.json').then(r=>r.json()),
      fetch('./data/empty.json').then(r=>r.json())
    ]);
    const codes=manifest.pieces;
    const nodes=codes.map((piece,i)=>{
      const scale=Math.min(106/piece.width,142/piece.height);
      return {
        instanceId:'quality-'+piece.id, assetId:piece.id,
        width:piece.width*scale,height:piece.height*scale,
        x:78+(i%12)*132,y:110+Math.floor(i/12)*188,
        rotation:0,locked:false
      };
    });
    const scene={...newProject(empty,'free').scene,
      canvasVariant:'porcelain-v2',theme:'light',nodes};
    const materials=new Materials(manifest);
    // Force every material to decode before rendering: 96 full-resolution PNGs.
    await materials.forScene(scene);
    const svg=document.querySelector('#art');
    function makeTheme(theme){
      scene.theme=theme;
      renderSVG(svg,scene,materials);
      const NS='http://www.w3.org/2000/svg';
      nodes.forEach((n,i)=>{
        const label=document.createElementNS(NS,'text');
        label.textContent=n.assetId;
        label.setAttribute('x',String(n.x));
        label.setAttribute('y',String(n.y+n.height/2+18));
        label.setAttribute('font-size','18');
        label.setAttribute('font-weight','600');
        label.setAttribute('text-anchor','middle');
        label.setAttribute('fill',theme==='dark'?'#355d63':'#39574b');
        label.setAttribute('data-qa-caption',n.assetId);
        svg.append(label);
      });
      return svg.querySelectorAll('g[data-node] > image[data-id]').length;
    }
    Object.defineProperty(globalThis,'__moonjarWave8QA',{
      value:{materials,scene,nodes,makeTheme,exportPNG,svg},configurable:true
    });
    const paper=document.querySelector('#paper');
    const shell=document.querySelector('#stage-shell');
    paper.style.width='1600px';
    paper.style.maxWidth='none';
    shell.style.overflow='visible';
    shell.style.maxHeight='none';
    shell.style.width='1640px';
    shell.style.maxWidth='none';
    svg.style.width='1600px';
    return {count:codes.length,palettes:[...new Set(codes.map(c=>c.paletteId))],nodes:nodes.length};
  });
  fail(initial.count===96,'manifest must have exactly 96 original nacre PNGs');
  fail(initial.nodes===96,'all 96 original nacre nodes must be present');
  fail(initial.palettes.length===8,'exactly 8 palettes should appear');

  for(const theme of ['light','dark']){
    const nodes=await page.evaluate(theme=>globalThis.__moonjarWave8QA.makeTheme(theme),theme);
    fail(nodes===96,theme+' must show 96 SVG original nacre images');
    fail(await page.locator('#art [data-qa-caption]').count()===96,
      theme+' visual QA needs the 96 piece identifiers');
    fail(await page.locator('#nacre-visibility-switch').getAttribute('aria-pressed')==='false',
      'visibility guide starts off');

    // Actual app-rendered images, NOT an offline approximation of CSS.
    await page.locator('#art').screenshot({
      path:`${output}/${theme}-96-original.png`,animations:'disabled',timeout:20000
    });
    const normal=await page.evaluate(async()=>{
      const {scene,materials,exportPNG}=globalThis.__moonjarWave8QA;
      const blob=await exportPNG(scene,materials);
      const data=await blob.arrayBuffer();
      const digest=await crypto.subtle.digest('SHA-256',data);
      return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
    });

    await page.locator('#nacre-visibility-switch').click();
    const shadowCount=await page.locator('#art g[data-node] > image[data-id]')
      .evaluateAll(els=>els.filter(el=>getComputedStyle(el).filter!=='none').length);
    fail(shadowCount===96,theme+' should give all 96 fragments the temporary edge effect');
    const normalCount=await page.locator('#art g[data-node] > image[data-id]').count();
    fail(normalCount===96,'no piece should be removed when guide is shown');
    await page.locator('#art').screenshot({
      path:`${output}/${theme}-96-guide.png`,animations:'disabled',timeout:20000
    });
    const guided=await page.evaluate(async()=>{
      const {scene,materials,exportPNG}=globalThis.__moonjarWave8QA;
      const blob=await exportPNG(scene,materials);
      const data=await blob.arrayBuffer();
      const digest=await crypto.subtle.digest('SHA-256',data);
      return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
    });
    fail(guided===normal,theme+' export PNG hash must be IDENTICAL with or without the guide');
    await page.locator('#nacre-visibility-switch').click();
    const backToNormal=await page.locator('#art g[data-node] > image[data-id]')
      .evaluateAll(els=>els.every(el=>getComputedStyle(el).filter==='none'));
    fail(backToNormal,theme+' must restore fully unmodified normal preview');
    results.push({theme,pieces:nodes,cssGuided:shadowCount,exportSha256:normal,
      privateNotesExported:false, screenshots:[`${theme}-96-original.png`,`${theme}-96-guide.png`]});
  }
  fail(errors.length===0,'there must be no browser or request errors: '+errors.join(' | '));
  console.log('MOONJAR NACRE96 PASS: '+checks+' assertions; '+results.length+' themes');
  await writeFile(`${output}/results.json`,JSON.stringify({
    checks,palettes:initial.palettes,results,errors,
    notice:'Screenshots contain testing-only A01…H12 identifiers. Exported art is checked separately and must not include these labels or editor-only visual guide. Chromium only, not a real phone.'
  },null,2));
}catch(error){
  console.error('MOONJAR NACRE96 FAIL after '+checks+' assertions:',error.stack||String(error));
  process.exitCode=1;
}finally{
  if(context)await context.close();
  await browser.close();
}
