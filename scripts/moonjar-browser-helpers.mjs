// One real UI entry path shared by all browser regressions after V3 START.
// Do not set editor state, storage flags or hidden DOM values in these helpers.
export async function beginWork(page,mode='free',storage='personal'){
 await page.locator('.hero-cta').click();
 await page.locator('.start-form').waitFor();
 await page.locator(`#mode-${mode}`).check();
 await page.locator(`#storage-${storage}`).check();
 await page.locator('.start-actions [type="submit"]').click();
 await page.locator('#art').waitFor({state:'visible'});
}
export async function settleArtwork(page){
 await page.evaluate(async()=>{
  await document.fonts.ready;
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
 });
}

export async function menuAction(page,action){
 await page.locator('.site-header [data-action="menu"]').click();
 await page.locator(`#modal .menu-links [data-action="${action}"]`).click();
}
