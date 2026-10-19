// Whole-journey browser QA: screens beyond porcelain and nacre art.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const base='http://127.0.0.1:4173/activities/moonjar/',out='artifacts/moonjar-journey-design';
await mkdir(out,{recursive:true});
let checks=0;const results=[];
function ok(x,msg){assert.ok(x,msg);checks++;}
async function shot(page,name,stage){await page.screenshot({path:out+'/'+name+'-'+stage+'.png',fullPage:['guide','materials','archive','projects'].includes(stage)})}
async function noOverflow(page,name){
 const width=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
 ok(width<=2,name+' no document horizontal overflow: '+width);
}
async function scenario(browserType,engine,width,height){
 const name=engine+'-'+width+'x'+height;
 const browser=await browserType.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,
   isMobile:width<768,hasTouch:width<768,locale:'ko-KR',acceptDownloads:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('requestfailed',r=>errors.push(r.url()+' '+r.failure()?.errorText));
 try{
  await page.goto(base,{waitUntil:'networkidle',timeout:35000});
  ok(await page.locator('.hero').count()===1,name+' original artistic homepage intact');
  ok(await page.evaluate(()=>getComputedStyle(document.body).overflow==='hidden'),name+' one-screen home');
  await shot(page,name,'home');

  // The desktop header intentionally hides facilitator-only navigation on phones.
  // Mobile participants still reach it from the visible materials/privacy page.
  await page.locator('.site-header [data-action="materials"]').click();
  await page.locator('main.materials-guide').waitFor();
  await page.locator('.materials-related-links a[href="#/guide"]').click();
  await page.locator('main.facilitator-guide').waitFor();
  ok(await page.locator('.facilitator-timing tbody tr').count()>=6,name+' all coaching schedule stages preserved');
  ok(await page.locator('.guide-principle').count()===5,name+' 5 DAILY dimensions present');
  ok((await page.locator('.guide-safety').innerText()).includes('의미를 부여하지 않습니다'),name+' ethical guidance retained');
  await noOverflow(page,name+' guide');
  ok(await page.locator('.guide-toc button').count()===3,name+' three chapter jump links');
  const originalRoute=await page.evaluate(()=>location.hash);
  await page.locator('.guide-toc button').nth(1).click();
  ok(await page.evaluate(()=>document.activeElement?.id==='guide-daily'),
     name+' keyboard focus follows DAILY shortcut');
  ok(await page.evaluate(()=>location.hash)===originalRoute,
     name+' chapter shortcuts do not accidentally leave hash-routed guide');
  await page.locator('.guide-toc button').nth(2).click();
  ok(await page.evaluate(()=>document.activeElement?.id==='guide-ethics'),
     name+' ethical principles shortcut remains accessible');
  const rowType=await page.locator('.facilitator-timing tbody tr').first().evaluate(e=>getComputedStyle(e).display);
  ok(width<=767?rowType==='grid':rowType==='table-row',name+' timetable responsive without hidden rows');
  await shot(page,name,'guide');

  await page.locator('.site-header [data-action="materials"]').click();
  await page.locator('main.materials-guide').waitFor();
  ok(await page.locator('.materials-item').count()===9,name+' material/privacy paragraphs preserved');
  ok(await page.locator('.materials-section').count()===4,name+' grouped sections and attribution');
  ok((await page.locator('main').innerText()).includes('IndexedDB'),name+' local storage warning visible');
  ok(await page.locator('.materials-disclosure').count()===9,
     name+' all 9 help paragraphs are native disclosure content');
  const opens=await page.locator('.materials-disclosure').evaluateAll(nodes=>nodes.filter(n=>n.open).length);
  ok(width<=767?opens===4:opens===9,
     name+' mobile starts with four private-data facts visible, desktop all 9: '+opens);
  ok((await page.locator('.materials-key-note').innerText()).includes('개인 기록'),
     name+' critical archive privacy note always visible');
  const first=page.locator('.materials-disclosure').first();
  const before=await first.evaluate(el=>el.open);
  await first.locator('summary').focus();
  await page.keyboard.press('Enter');
  ok((await first.evaluate(el=>el.open))!==before,name+' native keyboard disclosure toggles');
  await page.keyboard.press('Enter');
  ok((await first.evaluate(el=>el.open))===before,name+' second Enter restores disclosure');
  ok(await page.locator('.materials-disclosure>p').count()===9,
     name+' no original disclosures silently removed');
  const beforeSymbol=await first.locator('summary').evaluate(el=>getComputedStyle(el,'::before').content);
  ok(beforeSymbol==='none'||beforeSymbol==='normal',
     name+' legacy left-side +/- removed; no doubled collapse symbol: '+beforeSymbol);
  await page.evaluate(()=>document.activeElement?.blur?.());
  await noOverflow(page,name+' materials');
  await shot(page,name,'materials');

  await page.locator('.site-header [data-action="projects"]').click();
  await page.locator('main.projects-page').waitFor();
  await page.locator('.archive-empty').waitFor();
  ok(await page.locator('.archive-empty [data-action="home"]').count()===1,name+' first-work empty state actionable');
  await noOverflow(page,name+' empty archive');
  await shot(page,name,'archive');

  await page.locator('.archive-empty [data-action="home"]').click();
  await page.locator('main.home').waitFor();
  await page.locator('main.home [data-action="start-free"]').click();
  await page.locator('#art').waitFor({state:'visible'});
  ok(await page.evaluate(()=>getComputedStyle(document.body).overflow==='hidden'),name+' original editor layout unchanged');
  await page.locator('#palette-panel [data-action="add:A01"]').click();
  await page.locator('#art [data-node]').first().waitFor();
  await page.locator('.art-toolbar [data-action="save-options"]').click();
  await page.locator('#modal .save-options-grid').waitFor({state:'visible'});
  ok(await page.locator('.save-option').count()===4,name+' four saves separated by outcome');
  ok((await page.locator('.save-options-intro').innerText()).includes('개인 기록은 자동'),name+' private data notice at saving');
  const cols=await page.locator('.save-options-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').filter(Boolean).length);
  ok(width<=767?cols===1:cols===2,name+' responsive save dialog');
  const saveBounds=await page.evaluate(()=>{
    const d=document.querySelector('#modal'),last=document.querySelector('#modal .save-option:last-child'),
      v=d.getBoundingClientRect(),b=last.getBoundingClientRect();
    return {modalTop:v.top,modalBottom:v.bottom,lastTop:b.top,lastBottom:b.bottom,
      clientHeight:d.clientHeight,scrollHeight:d.scrollHeight,viewport:innerHeight};
  });
  if(width===390&&height>=800){
    ok(saveBounds.lastBottom<=Math.min(saveBounds.modalBottom-4,height-4),
      name+' all four save outcomes visible without hidden last CTA: '+JSON.stringify(saveBounds));
  }
  if(width<=350){
    await page.locator('.save-option').last().scrollIntoViewIfNeeded();
    const visible=await page.locator('.save-option').last().boundingBox();
    ok(visible&&visible.y>=0&&visible.y+visible.height<=height,
       name+' 320px short phone can scroll dialog to last save option');
  }
  await shot(page,name,'save-choices');
  await page.locator('#modal-close').click();

  await page.locator('.studio-bar [data-action="finish"]').click();
  await page.locator('main.result-page').waitFor();
  ok(await page.locator('.result-actions-label').innerText()==='작품을 간직하는 방법',name+' completion action hierarchy');
  ok(await page.locator('.result-actions button').count()===5,name+' legacy completion options intact');
  await shot(page,name,'result');
  await page.locator('.result-actions [data-action="card-options"]').click();
  await page.locator('#modal .card-modal').waitFor();
  ok(await page.locator('#modal .card-modal input[type="checkbox"]:checked').count()===0,name+' private text opt-in remains off');
  await shot(page,name,'card-modal');
  await page.locator('#modal-close').click();

  await page.locator('.site-header [data-action="projects"]').click();
  await page.locator('.project-card').first().waitFor({state:'visible'});
  ok(await page.locator('.project-card-info').count()>=1,name+' saved art editorial overview');
  ok(await page.locator('.project-card-actions button').count()>=3,name+' resume rename delete controls intact');
  ok(await page.locator('.project-card-actions [data-action^="delete-project:"]').count()>=1,name+' delete action recognizable');
  await noOverflow(page,name+' saved archive');
  await shot(page,name,'projects');
  ok(errors.length===0,name+' no uncaught browser errors '+errors.join(' | '));
  results.push({name,passed:true});
  console.log('MOONJAR JOURNEY PASS',name);
 }catch(e){results.push({name,passed:false,error:String(e),errors});console.error('MOONJAR JOURNEY FAIL',name,e.stack||String(e));throw e;}
 finally{await ctx.close();await browser.close();}
}
let error=null;
try{for(const [driver,engine,width,height] of [
 [chromium,'chromium',320,568],[chromium,'chromium',390,844],[chromium,'chromium',1440,900],[webkit,'webkit',390,844]
])await scenario(driver,engine,width,height);}
catch(e){error=e;process.exitCode=1;}
finally{
 await writeFile(out+'/results.json',JSON.stringify({checks,results,note:'Browser simulation only, not physical mobile or AT evaluation.'},null,2));
 console.log('MOONJAR JOURNEY QA',checks,'checks;',results.filter(r=>r.passed).length+'/4 passed',error?'FAILED':'PASSED');
}
