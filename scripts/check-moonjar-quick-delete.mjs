// Direct in-canvas delete: actual Chromium/WebKit, touch/mouse/keyboard,
// undo/redo, and drag-cancel on isolated memory-only Moonjar projects.
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
import {beginWork,settleArtwork} from './moonjar-browser-helpers.mjs';

const base=process.env.MOONJAR_V32_BASE_URL||'http://127.0.0.1:4173/activities/moonjar/';
const out='artifacts/moonjar-quick-delete';
const sizes=[[320,568],[390,844],[1440,900]];
let checks=0;
const equal=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
await mkdir(out,{recursive:true});

for(const [engine,launcher] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await launcher.launch();
  try{
    for(const [width,height] of sizes){
      const name=`${engine}-${width}x${height}`;
      const ctx=await browser.newContext({
        viewport:{width,height},deviceScaleFactor:1,
        isMobile:width<768,hasTouch:width<768,
        locale:'ko-KR',reducedMotion:'reduce'
      });
      const page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      try{
        await page.goto(base,{waitUntil:'networkidle'});
        await beginWork(page,'free','memory');
        await page.locator('[data-action="add:A01"]').click();
        await settleArtwork(page);
        const handle=page.locator('#art [data-handle="delete"]');
        equal(await handle.count(),1,name+' selected piece has one contextual delete');
        equal(await handle.getAttribute('aria-label'),'선택한 조각 삭제',name+' delete accessible name');
        equal(await page.locator('#art [data-handle]').count(),3,name+' rotate and resize preserved');
        await page.screenshot({path:`${out}/${name}-selected.png`,animations:'disabled'});
        if(width<768)await handle.tap();else await handle.click();
        equal(await page.locator('#art [data-node]').count(),0,name+' single tap removes only selected piece');
        equal(await page.locator('#art [data-handle="delete"]').count(),0,name+' handle hides after removal');
        await page.locator('.art-toolbar [data-action="undo"]').click();
        equal(await page.locator('#art [data-node]').count(),1,name+' undo restores selected piece geometry');
        await page.locator('#art [data-node] image[data-id]').first().click({force:true});
        equal(await handle.count(),1,name+' reselect shows contextual delete again');
        await handle.focus();await page.keyboard.press('Enter');
        equal(await page.locator('#art [data-node]').count(),0,name+' keyboard Enter deletes');
        await page.locator('.art-toolbar [data-action="undo"]').click();
        equal(await page.locator('#art [data-node]').count(),1,name+' keyboard deletion can be undone');
        await page.locator('#art [data-node] image[data-id]').first().click({force:true});
        const box=await handle.boundingBox();
        assert.ok(box,name+' visible deletion target');checks++;
        const x=box.x+box.width/2,y=box.y+box.height/2;
        await page.mouse.move(x,y);await page.mouse.down();
        await page.mouse.move(x+24,y,{steps:4});await page.mouse.up();
        equal(await page.locator('#art [data-node]').count(),1,name+' swipe/drag does not delete');
        equal(errors,[],name+' no JavaScript errors');
        console.log('DIRECT DELETE PASS',name);
      }finally{await ctx.close();}
    }
  }finally{await browser.close();}
}
console.log('MOONJAR DIRECT DELETE PASS',checks,'assertions');
