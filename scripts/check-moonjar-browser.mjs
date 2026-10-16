// Browser smoke for the real Moonjar app (local static serving).
// Node 22+, Playwright Chromium. Captures screenshots and does not mutate production.
import assert from 'node:assert/strict';
import {mkdir,stat,readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const base='http://127.0.0.1:4173/activities/moonjar/';
const out='artifacts/moonjar-mobile-ux-qa';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const errors=[];
let checks=0;
function check(condition,message){assert.ok(condition,message);checks++;}
try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,acceptDownloads:true,locale:'ko-KR'});
  const page=await context.newPage();
  page.on('pageerror',err=>errors.push(`PAGE: ${err.message}`));
  page.on('requestfailed',req=>errors.push(`LOAD: ${req.url()} ${req.failure()?.errorText}`));
  await page.goto(base,{waitUntil:'networkidle',timeout:30000});
  const mobileHero=page.locator('.hero-figure img');
  await mobileHero.evaluate(img=>img.decode());
  check((await mobileHero.getAttribute('src')).endsWith('assets/moonjar-original.svg'),
    'mobile entry must use original SVG, not the removed photo');
  check(await mobileHero.evaluate(img=>img.naturalWidth===780 && img.naturalHeight===920),
    'new self-drawn illustration must load at its 780×920 viewBox');
  check(await page.locator('a[href*="museum.go.kr"]').count()===0,
    'no institution image source link should appear in published app');
  // The revised first screen must make the primary action discoverable without
  // scrolling past a giant hero picture or storage form.
  const firstCTA=await page.locator('.hero-actions [data-action="start-guided"]').boundingBox();
  check(firstCTA && firstCTA.y+firstCTA.height <= 844,
    `mobile first start button should fit initial 390x844 viewport, got ${JSON.stringify(firstCTA)}`);
  check(await page.locator('link[href*="refinement.css"]').count()===1,'refinement CSS must be loaded');

  await page.screenshot({path:`${out}/00-original-hero-mobile-390.png`,fullPage:true});
  await page.locator('[data-action="start-guided"]').click();
  await page.locator('#scene-lead').waitFor({state:'visible'});
  const lead=page.locator('#scene-lead');
  const leadRect=await lead.boundingBox();
  const canvasRect=await page.locator('#art').boundingBox();
  check(leadRect && canvasRect && leadRect.y<canvasRect.y,'guided story question should precede canvas on mobile');
  check((await lead.innerText()).includes('지금 이 자리에 온 나는 어떤 상태인가요'),'arrival focus question missing');
  await page.screenshot({path:`${out}/01-guided-arrival-390.png`,fullPage:true});
  const beforeFold = await lead.boundingBox();
  await lead.locator('[data-action="toggle-lead"]').click();
  check(await lead.evaluate(el=>el.classList.contains('is-collapsed')),'guided story should collapse without leaving the scene');
  const afterFold = await lead.boundingBox();
  check(afterFold.height < beforeFold.height * 0.7,'folded scene should visibly release space for artwork');
  await page.screenshot({path:`${out}/01b-guided-focus-390.png`,fullPage:true});
  await lead.locator('[data-action="toggle-lead"]').click();
  check(!(await lead.evaluate(el=>el.classList.contains('is-collapsed'))),'guided story should expand again');

  await page.locator('[data-action="panel:palette"]').click();
  await page.locator('[data-action="add:A01"]').click();
  const editorTray=page.locator('#controls-panel.mobile-active');
  await editorTray.waitFor({state:'visible'});
  check(await page.locator('#art [data-node]').count()===1,'one piece must be present');
  check(await editorTray.locator('[data-action="panel:canvas"]').isVisible(),
    'editor tray must have a way to return to just the artwork');
  check(await editorTray.locator('.control-live-preview').count()===0,
    'mobile drawer must not duplicate the art in a tiny SVG');
  const before=await page.locator('#art [data-node]').first().getAttribute('transform');
  await editorTray.locator('[data-action="move:24:0"]').click();
  const after=await page.locator('#art [data-node]').first().getAttribute('transform');
  check(before!==after,'move button should alter selected node');
  const view=await page.evaluate(()=>{
    const art=document.querySelector('#art').getBoundingClientRect();
    const tray=document.querySelector('#controls-panel').getBoundingClientRect();
    const visiblePixels=Math.max(0,Math.min(art.bottom,tray.top,innerHeight)-Math.max(0,art.top));
    const nacre=document.querySelector('#art [data-id]').getBoundingClientRect();
    const selectedCenter=(nacre.top+nacre.bottom)/2;
    return {visiblePixels,selectedCenter,artTop:art.top,artBottom:art.bottom,trayTop:tray.top,trayBottom:tray.bottom,viewport:innerHeight};
  });
  check(view.visiblePixels>=260,`at least most of the actual artwork must remain visible: ${JSON.stringify(view)}`);
  check(view.selectedCenter>0 && view.selectedCenter<view.trayTop-12,
    `the selected nacre must be visible outside the controls, not hidden under the panel: ${JSON.stringify(view)}`);
  check(view.trayBottom<=view.viewport-40,'editor drawer must not cover the bottom toolbar');
  await page.screenshot({path:`${out}/02-canvas-first-editor-390.png`,fullPage:true});
  await page.screenshot({path:`${out}/02b-editor-actual-viewport-390.png`,fullPage:false});
  await editorTray.locator('[data-action="panel:canvas"]').click();
  check(!(await editorTray.isVisible()),'close control should restore uncluttered artwork');
  await page.locator('[data-action="panel:controls"]').click();
  check(await editorTray.isVisible(),'controls remain reachable from bottom navigation');

  await page.locator('[data-action="panel:look"]').click();
  check(await page.locator('main.studio.paused').count()===1,'look mode should pause editor');
  check(await page.locator('#look-prompt h2').isVisible(),'look mode must display the current reflection question');
  check((await page.locator('#look-prompt h2').innerText()).includes('기준으로'),'first placed piece should trigger actual choice-awareness question, not only arrival');
  await page.screenshot({path:`${out}/03-pause-question-390.png`,fullPage:true});
  await page.locator('#look-prompt [data-action="panel:story"]').click();
  check(await page.locator('main.studio.paused').count()===0,'returning to story should exit pause');

  await page.locator('[data-action="scene:name"]').click();
  const titleInput=page.locator('#story-panel [data-section="title"][data-field="title"]');
  await titleInput.fill('오늘의 이름은 내게 남겨두기');
  await page.locator('.scene-nav [data-action="scene:return"]').click();
  check((await page.locator('#scene-lead').innerText()).includes('오늘 알아차린 것을 삶에 적용해본다면'),'DAILY return question missing');
  check(await page.locator('#story-panel .mobile-record-title').isVisible(),'mobile guided reflection should have a concise record heading');
  check(!(await page.locator('#story-panel > .short-essay').isVisible()),'mobile guided reflection should not repeat the introductory essay');
  const noticed=page.locator('#story-panel > .record-field [data-field="noticed"]');
  check(await noticed.count()===1,'return focus field should be noticed, not action');
  await noticed.fill('오늘은 나를 더 천천히 바라보려고 한다.');
  await noticed.blur();
  await page.waitForFunction(()=>document.querySelector('#save-state')?.textContent?.includes('이 기기에 저장됨'),{timeout:10000});
  const projectURL=page.url();
  await page.reload({waitUntil:'networkidle'});
  await page.locator('#art [data-node]').first().waitFor();
  check(await page.locator('#art [data-node]').count()===1,'saved artwork must survive reload');
  await page.locator('#story-panel [data-field="noticed"]').waitFor();
  check(await page.locator('#story-panel [data-field="noticed"]').inputValue()==='오늘은 나를 더 천천히 바라보려고 한다.','saved reflection must survive reload');
  check(page.url()===projectURL,'reloaded project route should remain stable');

  await page.locator('[data-action="save-options"]').click();
  const [download]=await Promise.all([
    page.waitForEvent('download',{timeout:20000}),
    page.locator('dialog [data-action="export-png"]').click(),
  ]);
  check(download.suggestedFilename().endsWith('.png'),'art export must be PNG');
  const savedPath=await download.path();
  check((await stat(savedPath)).size>2000,'PNG export must be non-empty');
  await page.screenshot({path:`${out}/04-reloaded-work-390.png`,fullPage:true});

  // Export opt-in personal card only after a deliberately confirmed preview.
  await page.locator('.studio-bar [data-action="finish"]').click();
  await page.locator('main.result-page').waitFor();
  check(!(await page.locator('.reflection-recap').evaluate(el=>el.open)),'private reflection recap is collapsed by default');
  check(!(await page.locator('.result-essay').evaluate(el=>el.open)),'long ending essay must be optional');
  check(await page.locator('.result-actions [data-action="card-options"].primary').isVisible(),
    'creating a personal art card is the result page primary action');
  await page.screenshot({path:`${out}/05a-artwork-first-result-390.png`,fullPage:true});
  await page.locator('main.result-page [data-action="card-options"]').click();
  await page.locator('#modal .card-preview img').waitFor({state:'visible'});
  const card=page.locator('#modal');
  const cardChecks=card.locator('input[type="checkbox"]');
  check(await cardChecks.count()===2,'card must offer separate title/sentence choices');
  check(await cardChecks.nth(0).isChecked()===false && await cardChecks.nth(1).isChecked()===false,
    'private written words must be excluded by default');
  await page.waitForFunction(()=>document.querySelector('#modal .card-preview img')?.naturalWidth===640,{timeout:20000});
  check(!(await card.locator('.card-field').first().isVisible()),'card title editor should be hidden until opt-in');
  check(await card.locator('.card-preview').evaluate(el =>
    Boolean(el.compareDocumentPosition(document.querySelector('#modal [data-action="download-card"]')) & Node.DOCUMENT_POSITION_FOLLOWING)
  ),'card preview must precede final download in reading order');
  await page.screenshot({path:`${out}/06-card-private-default-390.png`,fullPage:true});

  await cardChecks.nth(0).check();
  await cardChecks.nth(1).check();
  // Deliberately too much text must be rejected without hidden ellipsis.
  await card.locator('.card-field textarea').fill('가'.repeat(100));
  await page.waitForFunction(()=>document.querySelector('#modal .card-preview p[role="status"]')?.textContent?.includes('짧게 다듬어'),{timeout:20000});
  check(await card.locator('[data-action="download-card"]').isDisabled(),
    'overlong personal text must not silently ellipsize and export');
  await card.locator('.card-field input').fill('나만의 작품 제목');
  await card.locator('.card-field textarea').fill('오늘 나를 한 걸음 더 알아보았다.');
  await page.waitForFunction(()=>document.querySelector('#modal .card-preview img')?.naturalWidth===640
    && document.querySelector('#modal [data-action="download-card"]')?.disabled===false,{timeout:20000});
  check(await card.locator('.card-field').first().isVisible(),'only opted title should show input');
  await page.screenshot({path:`${out}/07-card-opt-in-preview-390.png`,fullPage:true});
  await card.locator('.card-preview img').scrollIntoViewIfNeeded();
  await page.screenshot({path:`${out}/07b-card-reviewed-before-save-390.png`,fullPage:false});
  const [cardDownload]=await Promise.all([
    page.waitForEvent('download',{timeout:30000}),
    card.locator('[data-action="download-card"]').click()
  ]);
  const cardBytes=await readFile(await cardDownload.path());
  check(cardDownload.suggestedFilename().endsWith('.card.png'),'card name must be distinguishable from artwork-only PNG');
  check(cardBytes.readUInt32BE(16)===1600 && cardBytes.readUInt32BE(20)===2400,
    'card must export full-resolution 1600×2400 PNG');
  check(cardBytes.length>4000,'card PNG must contain rendered artwork');

  const desktop=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,acceptDownloads:true});
  const p2=await desktop.newPage();
  p2.on('pageerror',err=>errors.push(`DESKTOP: ${err.message}`));
  await p2.goto(base,{waitUntil:'networkidle'});
  await p2.locator('.hero-figure img').evaluate(img=>img.decode());
  check(await p2.locator('.hero-figure img[src$="moonjar-original.svg"]').count()===1,
    'desktop entry must display the original artwork');
  await p2.screenshot({path:`${out}/00-original-hero-desktop-1440.png`,fullPage:true});
  await p2.locator('[data-action="start-free"]').click();
  await p2.locator('main.studio #story-panel').waitFor({state:'visible',timeout:10000});
  check(!(await p2.locator('#scene-lead').isVisible()),'free mode must not force guided lead');
  check(await p2.locator('.story-panel').isVisible(),'desktop story panel should remain available');
  await p2.screenshot({path:`${out}/05-free-desktop-1440.png`,fullPage:true});

  // Visual stress: several colors and layers. This is test-only composition,
  // never a default psychological "right answer" shown to participants.
  const examples=[
    ['A01',540,460],['A08',900,520],['B02',620,750],['B09',1070,700],
    ['C04',460,960],['F01',845,990],['G03',665,1270],['H07',1060,1310]
  ];
  for(const [id,x,y] of examples){
    await p2.locator(`[data-action="palette:${id[0]}"]`).click();
    await p2.locator(`[data-action="add:${id}"]`).click();
    // Numerical positions are intentionally an advanced disclosure; open it
    // as a person would before editing the test-only example arrangement.
    const geometry=p2.locator('#controls-panel details');
    if(!(await geometry.evaluate(el=>el.open))) await geometry.locator('summary').click();
    const xField=p2.locator('[data-coordinate="x"]');
    await xField.fill(String(x));
    await xField.press('Tab');
    const yField=p2.locator('[data-coordinate="y"]');
    await yField.fill(String(y));
    await yField.press('Tab');
  }
  check(await p2.locator('#art [data-node]').count()===examples.length,
    'multi-piece composition must retain every selected fragment');
  await p2.screenshot({path:`${out}/08-multi-piece-artwork-desktop-1440.png`,fullPage:true});
  await p2.locator('.studio-bar [data-action="finish"]').click();
  await p2.locator('main.result-page [data-action="card-options"]').click();
  await p2.waitForFunction(()=>document.querySelector('#modal .card-preview img')?.naturalWidth===640,{timeout:20000});
  await p2.screenshot({path:`${out}/09-multi-piece-card-desktop-1440.png`,fullPage:true});
  await desktop.close(); await context.close();
  check(errors.length===0,`browser errors: ${errors.join('; ')}`);
  console.log(`MOONJAR BROWSER PASS: ${checks} assertions. Screenshots: ${out}`);
}catch(error){
  console.error(`MOONJAR BROWSER FAIL after ${checks} assertions: ${error.stack||error}`);
  if(errors.length)console.error('Other browser errors:',errors.join('; '));
  process.exitCode=1;
}finally{await browser.close();}
