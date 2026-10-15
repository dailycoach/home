// Browser smoke for the real Moonjar app (local static serving).
// Node 22+, Playwright Chromium. Captures screenshots and does not mutate production.
import assert from 'node:assert/strict';
import {mkdir,stat} from 'node:fs/promises';
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
  await page.locator('[data-action="start-guided"]').click();
  await page.locator('#scene-lead').waitFor({state:'visible'});
  const lead=page.locator('#scene-lead');
  const leadRect=await lead.boundingBox();
  const canvasRect=await page.locator('#art').boundingBox();
  check(leadRect && canvasRect && leadRect.y<canvasRect.y,'guided story question should precede canvas on mobile');
  check((await lead.innerText()).includes('지금 이 자리에 온 나는 어떤 상태인가요'),'arrival focus question missing');
  await page.screenshot({path:`${out}/01-guided-arrival-390.png`,fullPage:true});

  await page.locator('[data-action="panel:palette"]').click();
  await page.locator('[data-action="add:A01"]').click();
  await page.locator('#controls-panel.mobile-active .control-live-preview').waitFor({state:'visible'});
  check(await page.locator('#art [data-node]').count()===1,'one piece must be present');
  const before=await page.locator('#art [data-node]').first().getAttribute('transform');
  await page.locator('[data-action="move:24:0"]').click();
  const after=await page.locator('#art [data-node]').first().getAttribute('transform');
  const live=await page.locator('.control-live-preview svg [data-node]').first().getAttribute('transform');
  check(before!==after,'move button should alter selected node');
  check(after===live,'control preview must show the latest composition transform');
  await page.screenshot({path:`${out}/02-live-preview-390.png`,fullPage:true});

  await page.locator('[data-action="panel:look"]').click();
  check(await page.locator('main.studio.paused').count()===1,'look mode should pause editor');
  check(await page.locator('#look-prompt h2').isVisible(),'look mode must display the current reflection question');
  check((await page.locator('#look-prompt h2').innerText()).includes('상태인가요'),'reflection question should match current scene');
  await page.screenshot({path:`${out}/03-pause-question-390.png`,fullPage:true});
  await page.locator('#look-prompt [data-action="panel:story"]').click();
  check(await page.locator('main.studio.paused').count()===0,'returning to story should exit pause');

  await page.locator('[data-action="scene:return"]').click();
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

  const desktop=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,acceptDownloads:true});
  const p2=await desktop.newPage();
  p2.on('pageerror',err=>errors.push(`DESKTOP: ${err.message}`));
  await p2.goto(base,{waitUntil:'networkidle'});
  await p2.locator('[data-action="start-free"]').click();
  await p2.locator('main.studio #story-panel').waitFor({state:'visible',timeout:10000});
  check(!(await p2.locator('#scene-lead').isVisible()),'free mode must not force guided lead');
  check(await p2.locator('.story-panel').isVisible(),'desktop story panel should remain available');
  await p2.screenshot({path:`${out}/05-free-desktop-1440.png`,fullPage:true});
  await desktop.close(); await context.close();
  check(errors.length===0,`browser errors: ${errors.join('; ')}`);
  console.log(`MOONJAR BROWSER PASS: ${checks} assertions. Screenshots: ${out}`);
}catch(error){
  console.error(`MOONJAR BROWSER FAIL after ${checks} assertions: ${error.stack||error}`);
  if(errors.length)console.error('Other browser errors:',errors.join('; '));
  process.exitCode=1;
}finally{await browser.close();}
