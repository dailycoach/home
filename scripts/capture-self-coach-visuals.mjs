import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = 'http://127.0.0.1:4173';
const outputDir = path.resolve('artifacts/self-coach-visual-audit');
const statusPath = path.resolve('tests/self/visual-audit-status-v971.json');

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

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(`${root}/tests/self/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => {
    const order = Array.from({ length: 60 }, (_, index) => index);
    const draft = {
      answers: Array(60).fill(4),
      current: 59,
      order,
      company: 'VISUAL QA',
      name: 'COACH',
      savedAt: Date.now()
    };
    localStorage.clear();
    localStorage.setItem('selfinc_check_v9_order', JSON.stringify(order));
    localStorage.setItem('selfinc_check_v9_draft', JSON.stringify(draft));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('#startBtn').click();
  await page.waitForSelector('#resultScreen.active', { timeout: 8000 });
  await page.locator('#coachViewBtn').click();
  await page.waitForSelector('#coachDialog:not([hidden]) .coach-synthesis', { timeout: 8000 });
  await page.waitForSelector('#coachContent[data-coach-guide-ready="true"]', { timeout: 8000 });
  await page.waitForTimeout(450);

  const detailsInitiallyCollapsed = await page.locator('.coach-clean-details').evaluate((element) => !element.open);
  const initialDomain = (await page.locator('.coach-status-main strong').textContent())?.trim() || '';

  await page.screenshot({
    path: path.join(outputDir, `self-coach-${viewport.name}-viewport.png`),
    fullPage: false
  });

  const tabs = page.locator('#coachTabs .coach-tab');
  const tabCount = await tabs.count();
  const targetTab = tabs.nth(Math.min(3, tabCount - 1));
  await targetTab.click();
  await page.waitForTimeout(400);
  const changedDomain = (await page.locator('.coach-status-main strong').textContent())?.trim() || '';
  const tabInteractionChanged = Boolean(initialDomain && changedDomain && initialDomain !== changedDomain);

  await page.locator('.coach-clean-details > summary').click();
  await page.waitForTimeout(120);
  const highButton = page.locator('[data-coach-state="high"]');
  await highButton.click();
  await page.waitForTimeout(400);
  const highStateChanged = await highButton.getAttribute('aria-pressed') === 'true';

  await page.screenshot({
    path: path.join(outputDir, `self-coach-${viewport.name}-interaction.png`),
    fullPage: false
  });

  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const sheet = document.querySelector('.coach-sheet');
    const tabs = document.querySelector('.coach-tabs');
    const activeTab = document.querySelector('.coach-tab.is-active');
    const synthesisCards = [...document.querySelectorAll('.coach-synthesis-card')];
    const perspectiveCards = [...document.querySelectorAll('.coach-state-card')];
    const sessionQuestions = [...document.querySelectorAll('.coach-session-question')];
    const selectors = [
      '.coach-sheet-title',
      '.coach-sheet-intro',
      '.coach-tab',
      '.coach-status-main',
      '.coach-synthesis-head h3',
      '.coach-synthesis-type',
      '.coach-synthesis-card b',
      '.coach-session-plan-head b',
      '.coach-state-analysis-head h4',
      '.coach-clean-details > summary'
    ];

    const textOverflow = selectors.flatMap((selector) =>
      [...document.querySelectorAll(selector)]
        .filter((element) => {
          const style = getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          return element.scrollWidth > element.clientWidth + 2
            || (['hidden', 'clip'].includes(style.overflowY) && element.scrollHeight > element.clientHeight + 2);
        })
        .map((element) => ({
          selector,
          text: (element.textContent || '').trim().slice(0, 80),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight
        }))
    );

    const sheetRect = sheet?.getBoundingClientRect();
    const tabsRect = tabs?.getBoundingClientRect();
    const activeRect = activeTab?.getBoundingClientRect();
    const tabHeights = [...document.querySelectorAll('.coach-tab')].map((element) => element.getBoundingClientRect().height);
    const closeRect = document.querySelector('.coach-close')?.getBoundingClientRect();

    return {
      viewportWidth: doc.clientWidth,
      documentWidth: doc.scrollWidth,
      horizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
      sheetClipped: !sheetRect || sheetRect.left < -1 || sheetRect.right > doc.clientWidth + 1,
      contentOverflow: Boolean(document.querySelector('.coach-body')?.scrollWidth > document.querySelector('.coach-body')?.clientWidth + 1),
      activeTabClipped: !tabsRect || !activeRect || activeRect.left < tabsRect.left - 1 || activeRect.right > tabsRect.right + 1,
      synthesisCardCount: synthesisCards.length,
      perspectiveCardCount: perspectiveCards.length,
      sessionQuestionCount: sessionQuestions.length,
      detailExists: Boolean(document.querySelector('.coach-clean-details')),
      flourishFlowAbsent: !document.querySelector('.coach-flourish-flow'),
      identityRestored: document.querySelector('.coach-sheet-head .eyebrow')?.textContent?.trim() === 'KINGDOM COACH GUIDE',
      selectedBadgeCount: document.querySelectorAll('.coach-tab[aria-pressed="true"]').length,
      minTabHeight: tabHeights.length ? Math.min(...tabHeights) : 0,
      closeTarget: closeRect ? Math.min(closeRect.width, closeRect.height) : 0,
      coachGuideReady: document.querySelector('#coachContent')?.dataset.coachGuideReady === 'true',
      textOverflow
    };
  });

  const passed = !metrics.horizontalOverflow
    && !metrics.sheetClipped
    && !metrics.contentOverflow
    && !metrics.activeTabClipped
    && metrics.synthesisCardCount >= 2
    && metrics.perspectiveCardCount === 3
    && metrics.sessionQuestionCount === 5
    && metrics.detailExists
    && metrics.flourishFlowAbsent
    && metrics.identityRestored
    && metrics.selectedBadgeCount === 1
    && metrics.minTabHeight >= 35
    && metrics.closeTarget >= 32
    && metrics.coachGuideReady
    && metrics.textOverflow.length === 0
    && consoleErrors.length === 0
    && detailsInitiallyCollapsed
    && tabInteractionChanged
    && highStateChanged;

  report.push({
    viewport: viewport.name,
    capture: { width: viewport.width, height: viewport.height },
    detailsInitiallyCollapsed,
    initialDomain,
    changedDomain,
    tabInteractionChanged,
    highStateChanged,
    consoleErrors,
    ...metrics,
    passed
  });

  await page.close();
  await context.close();
}

await browser.close();

const passed = report.every((item) => item.passed);
const status = {
  version: '9.7.1',
  audit: 'kingdom-coach-design-only',
  passed,
  viewportCount: report.length,
  horizontalOverflowCount: report.filter((item) => item.horizontalOverflow).length,
  clippedSheetCount: report.filter((item) => item.sheetClipped).length,
  clippedActiveTabCount: report.filter((item) => item.activeTabClipped).length,
  textOverflowCount: report.reduce((sum, item) => sum + item.textOverflow.length, 0),
  consoleErrorCount: report.reduce((sum, item) => sum + item.consoleErrors.length, 0),
  interactionPassCount: report.filter((item) => item.tabInteractionChanged && item.highStateChanged).length,
  identityRestorePassCount: report.filter((item) => item.identityRestored).length,
  functionRollbackPassCount: report.filter((item) => item.flourishFlowAbsent && item.synthesisCardCount >= 2 && item.perspectiveCardCount === 3 && item.sessionQuestionCount === 5).length,
  viewports: report,
  checkedAt: new Date().toISOString()
};

await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(status, null, 2));
await fs.writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`);

console.table(report.map((item) => ({
  viewport: item.viewport,
  passed: item.passed,
  horizontalOverflow: item.horizontalOverflow,
  sheetClipped: item.sheetClipped,
  activeTabClipped: item.activeTabClipped,
  synthesisCards: item.synthesisCardCount,
  perspectiveCards: item.perspectiveCardCount,
  sessionQuestions: item.sessionQuestionCount,
  identityRestored: item.identityRestored,
  flourishFlowAbsent: item.flourishFlowAbsent,
  textOverflow: item.textOverflow.length,
  consoleErrors: item.consoleErrors.length
})));

if (!passed) process.exitCode = 1;