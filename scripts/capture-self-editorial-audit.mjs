import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = 'http://127.0.0.1:4173';
const outputDir = path.resolve('artifacts/self-coach-visual-audit');
const statusPath = path.resolve('tests/self/visual-audit-status-v980.json');
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'mobile-wide', width: 430, height: 932 },
  { name: 'tablet', width: 1024, height: 900 },
  { name: 'desktop', width: 1440, height: 1000 }
];

await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = [];

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference'
  });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(`${root}/tests/self/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => {
    const order = Array.from({ length: 60 }, (_, index) => index);
    localStorage.clear();
    localStorage.setItem('selfinc_check_v9_order', JSON.stringify(order));
    localStorage.setItem('selfinc_check_v9_draft', JSON.stringify({
      answers: Array(60).fill(4), current: 59, order, company: 'VISUAL QA', name: 'COACH', savedAt: Date.now()
    }));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#startBtn').click();
  await page.waitForSelector('#resultScreen.active', { timeout: 8000 });
  await page.waitForTimeout(400);

  await page.screenshot({ path: path.join(outputDir, `self-result-${viewport.name}-viewport.png`), fullPage: false });
  await page.screenshot({ path: path.join(outputDir, `self-result-${viewport.name}-full.png`), fullPage: true });

  const result = await page.evaluate(() => {
    const doc = document.documentElement;
    const card = document.querySelector('#reportCard');
    const body = document.querySelector('.result-body');
    const firstDomain = document.querySelector('.domain');
    const experiment = document.querySelector('.experiment');
    const sectionTitle = document.querySelector('.section-title');
    const rect = card?.getBoundingClientRect();
    const overflowSelectors = ['.result-score','.result-band b','.result-band span','.insight b','.insight p','.section-title','.domain-name','.domain-score','.experiment h3','.reflection p','.result-actions .btn'];
    const textOverflow = overflowSelectors.flatMap((selector) => [...document.querySelectorAll(selector)]
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && element.scrollWidth > element.clientWidth + 2;
      })
      .map((element) => ({ selector, text: (element.textContent || '').trim().slice(0, 80) })));
    return {
      horizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
      cardClipped: !rect || rect.left < -1 || rect.right > doc.clientWidth + 1,
      bodyOverflow: Boolean(body?.scrollWidth > body?.clientWidth + 1),
      domainCount: document.querySelectorAll('.domain').length,
      insightCount: document.querySelectorAll('.insight').length,
      dayCount: document.querySelectorAll('.day').length,
      cardRadius: card ? Number.parseFloat(getComputedStyle(card).borderRadius) : 99,
      domainRadius: firstDomain ? Number.parseFloat(getComputedStyle(firstDomain).borderRadius) : 99,
      experimentRadius: experiment ? Number.parseFloat(getComputedStyle(experiment).borderRadius) : 99,
      sectionRule: sectionTitle ? Number.parseFloat(getComputedStyle(sectionTitle).borderTopWidth) : 0,
      coverWord: getComputedStyle(document.querySelector('.result-cover'), '::after').content.includes('REPORT'),
      textOverflow
    };
  });

  await page.locator('#coachViewBtn').click();
  await page.waitForSelector('#coachDialog:not([hidden]) .coach-synthesis', { timeout: 8000 });
  await page.waitForSelector('#coachContent[data-coach-guide-ready="true"]', { timeout: 8000 });
  await page.waitForTimeout(400);

  const detailsInitiallyCollapsed = await page.locator('.coach-clean-details').evaluate((element) => !element.open);
  const initialDomain = (await page.locator('.coach-status-main strong').textContent())?.trim() || '';
  await page.screenshot({ path: path.join(outputDir, `self-coach-${viewport.name}-viewport.png`), fullPage: false });

  const tabs = page.locator('#coachTabs .coach-tab');
  await tabs.nth(Math.min(3, (await tabs.count()) - 1)).click();
  await page.waitForTimeout(350);
  const changedDomain = (await page.locator('.coach-status-main strong').textContent())?.trim() || '';
  const tabInteractionChanged = Boolean(initialDomain && changedDomain && initialDomain !== changedDomain);

  await page.locator('.coach-clean-details > summary').click();
  const highButton = page.locator('[data-coach-state="high"]');
  await highButton.click();
  await page.waitForTimeout(350);
  const highStateChanged = await highButton.getAttribute('aria-pressed') === 'true';
  await page.screenshot({ path: path.join(outputDir, `self-coach-${viewport.name}-interaction.png`), fullPage: false });

  const coach = await page.evaluate(() => {
    const doc = document.documentElement;
    const sheet = document.querySelector('.coach-sheet');
    const tabs = document.querySelector('.coach-tabs');
    const activeTab = document.querySelector('.coach-tab.is-active');
    const sheetRect = sheet?.getBoundingClientRect();
    const tabsRect = tabs?.getBoundingClientRect();
    const activeRect = activeTab?.getBoundingClientRect();
    const closeRect = document.querySelector('.coach-close')?.getBoundingClientRect();
    const tabHeights = [...document.querySelectorAll('.coach-tab')].map((element) => element.getBoundingClientRect().height);
    const overflowSelectors = ['.coach-sheet-title','.coach-sheet-intro','.coach-tab','.coach-status-main','.coach-synthesis-head h3','.coach-synthesis-type','.coach-synthesis-summary strong','.coach-synthesis-card b','.coach-synthesis-card p','.coach-session-plan-head b','.coach-session-question p','.coach-state-analysis-head h4','.coach-clean-details > summary'];
    const textOverflow = overflowSelectors.flatMap((selector) => [...document.querySelectorAll(selector)]
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden' && element.scrollWidth > element.clientWidth + 2;
      })
      .map((element) => ({ selector, text: (element.textContent || '').trim().slice(0, 80) })));
    return {
      horizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
      sheetClipped: !sheetRect || sheetRect.left < -1 || sheetRect.right > doc.clientWidth + 1,
      contentOverflow: Boolean(document.querySelector('.coach-body')?.scrollWidth > document.querySelector('.coach-body')?.clientWidth + 1),
      activeTabClipped: !tabsRect || !activeRect || activeRect.left < tabsRect.left - 1 || activeRect.right > tabsRect.right + 1,
      synthesisCardCount: document.querySelectorAll('.coach-synthesis-card').length,
      perspectiveCardCount: document.querySelectorAll('.coach-state-card').length,
      perspectiveExpanderCount: document.querySelectorAll('.coach-state-card .coach-card-expand').length,
      sessionQuestionCount: document.querySelectorAll('.coach-session-question').length,
      detailExists: Boolean(document.querySelector('.coach-clean-details')),
      flourishFlowAbsent: !document.querySelector('.coach-flourish-flow'),
      identityRestored: document.querySelector('.coach-sheet-head .eyebrow')?.textContent?.trim() === 'KINGDOM COACH GUIDE',
      selectedCount: document.querySelectorAll('.coach-tab[aria-pressed="true"]').length,
      minTabHeight: tabHeights.length ? Math.min(...tabHeights) : 0,
      closeTarget: closeRect ? Math.min(closeRect.width, closeRect.height) : 0,
      guideReady: document.querySelector('#coachContent')?.dataset.coachGuideReady === 'true',
      synthesisRadius: Number.parseFloat(getComputedStyle(document.querySelector('.coach-synthesis')).borderRadius),
      synthesisCardRadius: Number.parseFloat(getComputedStyle(document.querySelector('.coach-synthesis-card')).borderRadius),
      stateCardRadius: Number.parseFloat(getComputedStyle(document.querySelector('.coach-state-card')).borderRadius),
      textOverflow
    };
  });

  const resultPassed = !result.horizontalOverflow && !result.cardClipped && !result.bodyOverflow
    && result.domainCount === 5 && result.insightCount === 2 && result.dayCount === 7
    && result.cardRadius <= 8 && result.domainRadius === 0 && result.experimentRadius === 0
    && result.sectionRule >= 3 && result.coverWord && result.textOverflow.length === 0;

  const coachPassed = !coach.horizontalOverflow && !coach.sheetClipped && !coach.contentOverflow && !coach.activeTabClipped
    && coach.synthesisCardCount >= 2 && coach.perspectiveCardCount === 3 && coach.perspectiveExpanderCount === 3
    && coach.sessionQuestionCount === 5 && coach.detailExists && coach.flourishFlowAbsent && coach.identityRestored
    && coach.selectedCount === 1 && coach.minTabHeight >= 35 && coach.closeTarget >= 32 && coach.guideReady
    && coach.synthesisRadius === 0 && coach.synthesisCardRadius === 0 && coach.stateCardRadius === 0
    && coach.textOverflow.length === 0 && detailsInitiallyCollapsed && tabInteractionChanged && highStateChanged;

  const passed = resultPassed && coachPassed && consoleErrors.length === 0;
  report.push({ viewport: viewport.name, capture: viewport, result, coach, detailsInitiallyCollapsed, initialDomain, changedDomain, tabInteractionChanged, highStateChanged, consoleErrors, resultPassed, coachPassed, passed });
  await page.close();
  await context.close();
}

await browser.close();
const passed = report.every((item) => item.passed);
const status = {
  version: '9.8.0', audit: 'editorial-result-and-kingdom-coach-report', passed,
  viewportCount: report.length,
  resultPassCount: report.filter((item) => item.resultPassed).length,
  coachPassCount: report.filter((item) => item.coachPassed).length,
  horizontalOverflowCount: report.filter((item) => item.result.horizontalOverflow || item.coach.horizontalOverflow).length,
  clippedCount: report.filter((item) => item.result.cardClipped || item.coach.sheetClipped).length,
  textOverflowCount: report.reduce((sum, item) => sum + item.result.textOverflow.length + item.coach.textOverflow.length, 0),
  consoleErrorCount: report.reduce((sum, item) => sum + item.consoleErrors.length, 0),
  interactionPassCount: report.filter((item) => item.tabInteractionChanged && item.highStateChanged).length,
  identityPassCount: report.filter((item) => item.coach.identityRestored).length,
  functionPassCount: report.filter((item) => item.coach.flourishFlowAbsent && item.coach.synthesisCardCount >= 2 && item.coach.perspectiveCardCount === 3 && item.coach.sessionQuestionCount === 5).length,
  viewports: report, checkedAt: new Date().toISOString()
};
await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(status, null, 2));
await fs.writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`);
console.table(report.map((item) => ({ viewport: item.viewport, passed: item.passed, resultPassed: item.resultPassed, coachPassed: item.coachPassed, resultTextOverflow: item.result.textOverflow.length, coachTextOverflow: item.coach.textOverflow.length, tabInteraction: item.tabInteractionChanged, stateInteraction: item.highStateChanged, consoleErrors: item.consoleErrors.length })));
if (!passed) process.exitCode = 1;