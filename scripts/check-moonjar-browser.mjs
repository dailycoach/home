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
  check((await page.locator('#art image').first().getAttribute('href'))?.includes('moonjar-v2/porcelain-day.png'),
    'new guided project begins on porcelain V2; legacy background remains separate');
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

  await page.locator('.mobile-tabs [data-action="panel:palette"]').click();
  await page.locator('[data-action="add:A01"]').click();
  await page.locator('#art [data-node]').first().waitFor({state:'attached'});
  check(await page.locator('#palette-panel.mobile-active').isVisible(),
    'after adding a piece, keep the material palette open for continued filling');
  check(!(await page.locator('#controls-panel').isVisible()),
    'adding a piece should not force the user into the adjust step');
  const editorTray=page.locator('#controls-panel.mobile-active');
  await page.locator('.mobile-tabs [data-action="panel:controls"]').click();
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
  const edgeGuide=page.locator('#nacre-visibility-switch');
  await edgeGuide.waitFor({state:'visible'});
  check(await edgeGuide.getAttribute('aria-pressed')==='false','nacre outline aid must be off by default');
  const nacreImage=page.locator('#art g[data-node] > image[data-id]').first();
  check(await nacreImage.evaluate(el=>getComputedStyle(el).filter)==='none','no guide filter before opt-in');
  const toolbarHeightBefore=(await page.locator('.view-toolbar').boundingBox()).height;
  await edgeGuide.click();
  const toolbarHeightAfter=(await page.locator('.view-toolbar').boundingBox()).height;
  check(Math.abs(toolbarHeightAfter-toolbarHeightBefore)<3,
    `opening the guide must not push the artwork downward: before=${toolbarHeightBefore}, after=${toolbarHeightAfter}`);
  check(await edgeGuide.getAttribute('aria-pressed')==='true','nacre outline aid must be switchable');
  check(await nacreImage.evaluate(el=>getComputedStyle(el).filter)!=='none','guide applies CSS filter only in studio');
  check(await page.locator('#nacre-visibility-note').isVisible(),'guide displays an optional access explanation');
  await page.screenshot({path:`${out}/02c-nacre-visibility-on-390.png`,fullPage:false});
  await edgeGuide.click();
  check(await edgeGuide.getAttribute('aria-pressed')==='false','guide can be disabled');
  check(await nacreImage.evaluate(el=>getComputedStyle(el).filter)==='none','guide clears visual change without editing source');
  await page.locator('[data-action="panel:controls"]').click();
  check(await editorTray.isVisible(),'controls remain reachable from bottom navigation');

  await page.locator('[data-action="panel:look"]').click();
  check(await page.locator('main.studio.paused').count()===1,'look mode should pause editor');
  check(await page.locator('#look-prompt h2').isVisible(),'look mode must display the current reflection question');
  check((await page.locator('#look-prompt h2').innerText()).includes('기준으로'),'first placed piece should trigger actual choice-awareness question, not only arrival');
  await page.screenshot({path:`${out}/03-pause-question-390.png`,fullPage:true});
  await page.locator('#look-prompt [data-action="panel:story"]').click();
  check(await page.locator('main.studio.paused').count()===0,'returning to story should exit pause');

  const optionalChapters=page.locator('.scene-chapters');
  check(await optionalChapters.count()===1 && !(await optionalChapters.evaluate(node=>node.open)),
    'guided story menu is optional and collapsed when decorating');
  await optionalChapters.locator('summary').click();
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

  const reloadGuide=page.locator('#nacre-visibility-switch');
  check(await reloadGuide.getAttribute('aria-pressed')==='false','guide choice is session-only');
  await reloadGuide.click();
  await page.locator('[data-action="save-options"]').click();
  const [download]=await Promise.all([
    page.waitForEvent('download',{timeout:20000}),
    page.locator('dialog [data-action="export-png"]').click(),
  ]);
  check(download.suggestedFilename().endsWith('.png'),'art export must be PNG');
  const savedPath=await download.path();
  check((await stat(savedPath)).size>2000,'PNG export must be non-empty');
  const guidePng=await readFile(savedPath);
  await reloadGuide.click();
  await page.locator('[data-action="save-options"]').click();
  const [normalDownload]=await Promise.all([
    page.waitForEvent('download',{timeout:20000}),
    page.locator('dialog [data-action="export-png"]').click(),
  ]);
  const normalPng=await readFile(await normalDownload.path());
  check(normalPng.equals(guidePng),'editing-only contrast guide must never appear in exported PNG');
  await page.screenshot({path:`${out}/04-reloaded-work-390.png`,fullPage:true});

  // Export opt-in personal card only after a deliberately confirmed preview.
  await page.locator('.studio-bar [data-action="finish"]').click();
  await page.locator('main.result-page').waitFor();
  check(!(await page.locator('#notice').evaluate(el=>el.classList.contains('visible'))),
    'editor toast must not cover the finished artwork gallery');
  check(!(await page.locator('.reflection-recap').evaluate(el=>el.open)),'private reflection recap is collapsed by default');
  check(!(await page.locator('.result-essay').evaluate(el=>el.open)),'long ending essay must be optional');
  check(await page.locator('.result-actions [data-action="card-options"].primary').isVisible(),
    'creating a personal art card is the result page primary action');
  const ctaBox=await page.locator('.result-actions [data-action="card-options"]').boundingBox();
  const actionsBox=await page.locator('.result-actions').boundingBox();
  check(ctaBox && actionsBox && ctaBox.width>actionsBox.width*0.9,
    'artwork card button must actually span the full result row, not only have primary markup');
  await page.screenshot({path:`${out}/05a-artwork-first-result-390.png`,fullPage:true});
  await page.locator('main.result-page [data-action="card-options"]').click();
  await page.locator('#modal .card-preview img').waitFor({state:'visible'});
  const card=page.locator('#modal');
  const cardChecks=card.locator('input[type="checkbox"]');
  check(await cardChecks.count()===2,'card must offer separate title/sentence choices');
  check(await cardChecks.nth(0).isChecked()===false && await cardChecks.nth(1).isChecked()===false,
    'private written words must be excluded by default');
  await page.waitForFunction(()=>document.querySelector('#modal .card-preview img')?.naturalWidth===640,{timeout:20000});
  const footerState=await card.locator('.card-controls').evaluate(el=>{
    const rect=el.getBoundingClientRect(),dialog=el.closest('dialog').getBoundingClientRect();
    return {position:getComputedStyle(el).position,top:rect.top,bottom:rect.bottom,
      dialogTop:dialog.top,dialogBottom:dialog.bottom,viewport:window.innerHeight};
  });
  check(footerState.position==='sticky','mobile art-card save control should remain sticky');
  check(footerState.bottom<=footerState.dialogBottom+2 && footerState.top>=footerState.dialogTop-2,
    `mobile save control should be accessible inside postcard dialog: ${JSON.stringify(footerState)}`);
  await page.screenshot({path:`${out}/06b-mobile-card-sticky-save-390.png`,fullPage:false});
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
  check(await p2.locator('.scene-chapters').count()===0,
    'free-form decorating should not display a seven-stage progress bar');
  check(!(await p2.locator('#scene-lead').isVisible()),'free mode must not force guided lead');
  check(await p2.locator('.story-panel').isVisible(),'desktop story panel should remain available');
  await p2.screenshot({path:`${out}/05-free-desktop-1440.png`,fullPage:true});
  check((await p2.locator('#art image').first().getAttribute('href'))?.includes('/porcelain-day.png'),
    'new free work starts with the original porcelain day');
  await p2.locator('.view-toolbar [data-action="compare"]').click();
  check(await p2.locator('dialog .background-option .comparison-scene').count()===4,
    'picker includes porcelain day/night and original legacy day/night');
  await p2.locator('dialog [data-action="apply-canvas:legacy-outline-v3:light"]').click();
  await p2.waitForFunction(()=>document.querySelector('#art image')?.getAttribute('href')?.includes('canvas_light.png'));
  check((await p2.locator('#art image').first().getAttribute('href'))?.includes('canvas_light.png'),
    'explicit legacy option restores original line-art background');
  await p2.locator('.view-toolbar [data-action="compare"]').click();
  await p2.locator('dialog [data-action="apply-canvas:porcelain-v2:dark"]').click();
  check((await p2.locator('#art image').first().getAttribute('href'))?.includes('canvas_light.png'),
    'previewing a new vessel must not change an existing legacy outline yet');
  check(await p2.locator('dialog [data-action="confirmed"]').isVisible(),
    'legacy-to-porcelain change must require a second explicit confirmation');
  await p2.locator('dialog [data-action="confirmed"]').click();
  await p2.waitForFunction(()=>document.querySelector('#art image')?.getAttribute('href')?.includes('/porcelain-night.png'));
  check((await p2.locator('#art image').first().getAttribute('href'))?.includes('/porcelain-night.png'),
    'explicit moonlit porcelain appears');
  await p2.screenshot({path:`${out}/05b-porcelain-night-workspace-1440.png`,fullPage:true});
  await p2.locator('.view-toolbar [data-action="compare"]').click();
  await p2.locator('dialog [data-action="apply-canvas:porcelain-v2:light"]').click();
  await p2.waitForFunction(()=>document.querySelector('#art image')?.getAttribute('href')?.includes('/porcelain-day.png'));
  check((await p2.locator('#art image').first().getAttribute('href'))?.includes('/porcelain-day.png'),
    'day/night switching returns to daylight V2');

  // Visual stress: several colors and layers. This is test-only composition,
  // never a default psychological "right answer" shown to participants.
  const examples=[
    ['A01',540,460],['A08',900,520],['B02',620,750],['B09',1070,700],
    ['C04',460,960],['F01',845,990],['G03',665,1270],['H07',1060,1310]
  ];
  for(const [index,[id,x,y]] of examples.entries()){
    await p2.locator(`[data-action="palette:${id[0]}"]`).click();
    await p2.locator(`[data-action="add:${id}"]`).click();
    // Asset decoding is asynchronous. Wait for each addition before entering
    // its numeric location: otherwise the last palette may still be loading.
    await p2.waitForFunction(
      expected=>document.querySelectorAll('#art [data-node]').length===expected,
      index+1,{timeout:12000}
    );
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
    const msg=await p2.locator('#notice').textContent();
    check(!/replaceChildren|NotFoundError|Failed to execute|removeChild/.test(msg||''),
      `numeric coordinate edit must not remount a field during blur: ${msg}`);
    check(await p2.locator('[data-coordinate="x"]').count()===1
       && await p2.locator('[data-coordinate="y"]').count()===1,
      'numeric fields must remain available after moving selected nacre');
  }
  check(await p2.locator('#art [data-node]').count()===examples.length,
    'multi-piece composition must retain every selected fragment');
  await p2.screenshot({path:`${out}/08-multi-piece-artwork-desktop-1440.png`,fullPage:true});
  const desktopGuide=p2.locator('#nacre-visibility-switch');
  await desktopGuide.click();
  check(await desktopGuide.getAttribute('aria-pressed')==='true',
    'desktop outline guide is independently available');
  check(await p2.locator('#art g[data-node] > image[data-id]').evaluateAll(images=>
    images.length===8 && images.every(image=>getComputedStyle(image).filter!=='none')
  ),'all eight differently colored fragments receive editing-only edge aid');
  await p2.screenshot({path:`${out}/08b-multi-piece-guide-on-desktop-1440.png`,fullPage:true});
  await desktopGuide.click();
  await p2.locator('.studio-bar [data-action="finish"]').click();
  await p2.locator('main.result-page [data-action="card-options"]').click();
  await p2.waitForFunction(()=>document.querySelector('#modal .card-preview img')?.naturalWidth===640,{timeout:20000});
  await p2.screenshot({path:`${out}/09-multi-piece-card-desktop-1440.png`,fullPage:true});
  await desktop.close(); await context.close();

  // A real V3-format JSON from before porcelain V2 must not be silently upgraded.
  const legacyContext=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
  const p3=await legacyContext.newPage();
  p3.on('pageerror',err=>errors.push(`LEGACY: ${err.message}`));
  await p3.goto(base,{waitUntil:'networkidle'});
  const legacy=await p3.evaluate(async()=>{
    const d=await (await fetch('data/empty.json')).json();
    delete d.scene.canvasVariant;
    d.scene.theme='dark';
    return d;
  });
  await p3.locator('#import-file').setInputFiles({
    name:'original-v3-project.moonjar.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(legacy))
  });
  await p3.locator('dialog [data-action="import-confirm"]').waitFor({state:'visible'});
  await p3.locator('dialog [data-action="import-confirm"]').click();
  await p3.locator('#art').waitFor({state:'visible'});
  check((await p3.locator('#art image').first().getAttribute('href'))?.includes('canvas_dark.png'),
    'an imported pre-V2 dark project must preserve its exact old PNG background');
  await p3.screenshot({path:`${out}/10-old-V3-import-preserved.png`,fullPage:true});
  await p3.locator('.view-toolbar [data-action="compare"]').click();
  check(await p3.locator('dialog .background-option .comparison-scene').count()===4,
    'legacy users can preview V2 without changing their saved work');
  await p3.locator('dialog [data-action="apply-canvas:porcelain-v2:light"]').click();
  check((await p3.locator('#art image').first().getAttribute('href'))?.includes('canvas_dark.png'),
    'legacy import still displays its original dark outline until confirmed');
  await p3.locator('dialog [data-action="confirmed"]').click();
  await p3.waitForFunction(()=>document.querySelector('#art image')?.getAttribute('href')?.includes('porcelain-day.png'));
  check((await p3.locator('#art image').first().getAttribute('href'))?.includes('porcelain-day.png'),
    'legacy work switches only after explicit choice');
  await p3.locator('[data-action="undo"]').click();
  check((await p3.locator('#art image').first().getAttribute('href'))?.includes('canvas_dark.png'),
    'undo restores the legacy background and all piece coordinates');
  await legacyContext.close();

  // Genuine rapid-decorating scenario: cover the vessel without stopping to
  // assign 12 meanings or being redirected to controls after every fragment.
  const carefree=await browser.newContext({viewport:{width:390,height:844},
    deviceScaleFactor:1,isMobile:true,hasTouch:true,acceptDownloads:true});
  const p4=await carefree.newPage();
  p4.on('pageerror',err=>errors.push(`FREEFORM: ${err.message}`));
  await p4.goto(base,{waitUntil:'networkidle'});
  check((await p4.locator('.hero-actions button.primary').getAttribute('data-action'))==='start-free',
    'freely decorating is the first and primary entrance');
  await p4.locator('[data-action="start-free"]').click();
  check(await p4.locator('.scene-chapters').count()===0,'free mode has no stepper');
  const palettePanel=p4.locator('#palette-panel.mobile-active');
  await palettePanel.waitFor({state:'visible'});
  check(await p4.locator('.batch-add').isVisible(),
    'the one-action option to place twelve nacre pieces is available');
  await p4.locator('[data-action="batch:12"]').click();
  await p4.waitForFunction(()=>document.querySelectorAll('#art [data-node]').length===12,{timeout:20000});
  check(await palettePanel.isVisible(),'batch must leave the palette visible');
  check(!(await p4.locator('#controls-panel').isVisible()),'batch must not force an adjust modal');
  check(await p4.locator('#controls-panel .piece-note-button').isVisible()===false,
    'individual message writing is not a required step in the default controls');
  const spread=await p4.locator('#art [data-node]').evaluateAll(groups=>
    new Set(groups.map(g=>g.getAttribute('transform'))).size
  );
  check(spread>=11,'multiple nacre should spread across the vessel instead of invisibly stacking');
  const above=await p4.evaluate(()=>{
    const art=document.querySelector('#art').getBoundingClientRect();
    const sheet=document.querySelector('#palette-panel').getBoundingClientRect();
    return {visible:Math.min(art.bottom,sheet.top,innerHeight)-Math.max(0,art.top),
      paletteTop:sheet.top,paletteBottom:sheet.bottom};
  });
  check(above.visible>=120,`artwork must remain visible above the palette while filling: ${JSON.stringify(above)}`);
  await p4.screenshot({path:`${out}/10-free-12-nacre-mobile-390.png`,fullPage:false});
  await p4.locator('[data-action="batch:12"]').click();
  await p4.waitForFunction(()=>document.querySelectorAll('#art [data-node]').length===24,{timeout:20000});
  await p4.locator('.art-toolbar [data-action="undo"]').click();
  check(await p4.locator('#art [data-node]').count()===12,'whole last batch undoes in one step');
  await p4.locator('.mobile-tabs [data-action="panel:controls"]').click();
  check(await p4.locator('#controls-panel .piece-note-button').isVisible()===false,
    'repeat messages remain tucked away while moving fragments');
  await p4.locator('#controls-panel details > summary').click();
  check(await p4.locator('#controls-panel .piece-note-button').isVisible(),
    'legacy individual notes are still reachable if explicitly requested');
  await p4.locator('.mobile-tabs [data-action="panel:look"]').click();
  check((await p4.locator('#look-prompt h2').innerText()).includes('눈에 들어오는'),
    'free-form looking asks one gentle question, not individual fragment meanings');
  await p4.locator('#look-prompt [data-action="panel:story"]').click();
  check(await p4.locator('#story-panel > .record-field').count()===1,
    'free-mode reflection offers one optional field, not seven questionnaires');
  await p4.locator('.studio-bar [data-action="finish"]').click();
  await p4.locator('main.result-page').waitFor();
  await p4.screenshot({path:`${out}/11-free-12-nacre-finished-390.png`,fullPage:true});
  await carefree.close();

  check(errors.length===0,`browser errors: ${errors.join('; ')}`);
  console.log(`MOONJAR BROWSER PASS: ${checks} assertions. Screenshots: ${out}`);
}catch(error){
  console.error(`MOONJAR BROWSER FAIL after ${checks} assertions: ${error.stack||error}`);
  if(errors.length)console.error('Other browser errors:',errors.join('; '));
  process.exitCode=1;
}finally{await browser.close();}
