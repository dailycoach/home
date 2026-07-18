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

const collectTextOverflow = (selectors) => selectors.flatMap((selector) =>
  [...document.querySelectorAll(selector)]
    .filter((element) => {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return element.scrollWidth > element.clientWidth + 2
        || (['hidden', 'clip'].includes(style.overflowY) && element.scrollHeight > element.clientHeight + 2);
    })
    .map((element) => ({
      selector,
      text: (element.textContent || '').trim().slice(0, 90),
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight
    }))
);

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
  await page.waitForTimeout(450);

  await page.screenshot({
    path: path.join(outputDir, `self-result-${viewport.name}-viewport.png`),
    fullPage: false
  });
  await page.screenshot({
    path: path.join(outputDir, `self-result-${viewport.name}-full.png`),
    fullPage: true
  });

  const resultMetrics = await page.evaluate((overflowCollectorSource) => {
    const collect = eval(`(${overflowCollectorSource})`);
    const doc = document.documentElement;
    const reportCard = document.querySelector('#reportCard');
    const cover = document.querySelector('.result-cover');
    const body = document.querySelector('.result-body');
    const firstDomain = document.querySelector('.domain');
    const experiment = document.querySelector('.experiment');
    const reportRect = reportCard?.getBoundingClientRect();
    const coverAfter = cover ? getComputedStyle(cover, '::after').content : '';
    const cardStyle = reportCard ? getComputedStyle(reportCard) : null;
    const domainStyle = firstDomain ? getComputedStyle(firstDomain) : null;
    const experimentStyle = experiment ? getComputedStyle(experiment) : null;
    const titleStyle = document.querySelector('.section-title') ? getComputedStyle(document.querySelector('.section-title')) : null;

    const textOverflow = collect([
      '.result-score',
      '.result-band b',
      '.result-band span',
      '.insight b',
      '.insight p',
      '.section-title',
      '.domain-name',
      '.domain-score',
      '.experiment h3',
      '.reflection p',
      '.result-actions .btn'
    ]);

    return {
      viewportWidth: doc.clientWidth,
      documentWidth: doc.scrollWidth,
      horizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
      reportClipped: !reportRect || reportRect.left < -1 || reportRect.right > doc.clientWidth + 1,
      resultBodyOverflow: Boolean(body?.scrollWidth > body?.clientWidth + 1),
      domainCount: document.querySelectorAll('.domain').length,
      insightCount: document.querySelectorAll('.insight').length,
      dayCount: document.querySelectorAll('.day').length,
      editorialCardRadius: cardStyle ? Number.parseFloat(cardStyle.borderRadius) : 99,
      flatDomainRadius: domainStyle ? Number.parseFloat(domainStyle.borderRadius) : 99,
      flatExperimentRadius: experimentStyle ? Number.parseFloat(experimentStyle.borderRadius) : 99,
      sectionTopRule: titleStyle ? Number.parseFloat(titleStyle.borderTopWidth) : 0,
      coverEditorialWord: coverAfter.includes('REPORT'),
      textOverflow
    };
  }, collectTextOverflow.toString());

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

  const coachMetrics = await page.evaluate((overflowCollectorSource) => {
    const collect = eval(`(${overflowCollectorSource})`);
    const doc = document.documentElement;
    const sheet = document.querySelector('.coach-sheet');
    const tabs = document.querySelector('.coach-tabs');
    const activeTab = document.querySelector('.coach-tab.is-active');
    const synthesis = document.querySelector('.coach-synthesis');
    const synthesisCard = document.querySelector('.coach-synthesis-card');
    const stateCard = document.querySelector('.coach-state-card');
    const synthesisCards = [...document.querySelectorAll('.coach-synthesis-card')];
    const perspectiveCards = [...document.querySelectorAll('.coach-state-card')];
    const sessionQuestions = [...document.querySelectorAll('.coach-session-question')];
    const textOverflow = collect([
      '.coach-sheet-title',
      '.coach-sheet-intro',
      '.coach-tab',
      '.coach-status-main',
      '.coach-synthesis-head h3',
      '.coach-synthesis-type',
      '.coach-synthesis-summary strong',
      '.coach-synthesis-card b',
      '.coach-synthesis-card p',
      '.coach-session-plan-head b',
      '.coach-session-question p',
      '.coach-state-analysis-head h4',
      '.coach-state-card p',
      '.coach-clean-details > summary'
    ]);

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
      flatSynthesisRadius: synthesis ? Number.parseFloat(getComputedStyle(synthesis).borderRadius) : 99,
      flatSynthesisCardRadius: synthesisCard ? Number.parseFloat(getComputedStyle(synthesisCard).borderRadius) : 99,
      flatStateCardRadius: stateCard ? Number.parseFloat(getComputedStyle(stateCard).borderRadius) : 99,
      textOverflow
    };
  }, collectTextOverflow.toString());

  const resultPassed = !resultMetrics.horizontalOverflow
    && !resultMetrics.reportClipped
    && !resultMetrics.resultBodyOverflow
    && resultMetrics.domainCount === 5
    && resultMetrics.insightCount === 2
    && resultMetrics.dayCount === 7
    && resultMetrics.editorialCardRadius <= 8
    && resultMetrics.flatDomainRadius === 0
    && resultMetrics.flatExperimentRadius === 0
    && resultMetrics.sectionTopRule >= 3
    && resultMetrics.coverEditorialWord
    && resultMetrics.textOverflow.length === 0;

  const coachPassed = !coachMetrics.horizontalOverflow
    && !coachMetrics.sheetClipped
    && !coachMetrics.contentOverflow
    && !coachMetrics.activeTabClipped
    && coachMetrics.synthesisCardCount >= 2
    && coachMetrics.perspectiveCardCount === 3
    && coachMetrics.sessionQuestionCount === 5
    && coachMetrics.detailExists
    && coachMetrics.flourishFlowAbsent
    && coachMetrics.identityRestored
    && coachMetrics.selectedBadgeCount === 1
    && coachMetrics.minTabHeight >= 35
    && coachMetrics.closeTarget >= 32
    && coachMetrics.coachGuideReady
    && coachMetrics.flatSynthesisRadius === 0
    && coachMetrics.flatSynthesisCardRadius === 0
    && coachMetrics.flatStateCardRadius === 0
    && coachMetrics.textOverflow.length === 0
    && detailsInitiallyCollapsed
    && tabInteractionChanged
    && highStateChanged;

  const passed = resultPassed && coachPassed && consoleErrors.length === 0;

  report.push({
    viewport: viewport.name,
    capture: { width: viewport.width, height: viewport.height },
    detailsInitiallyCollapsed,
    initialDomain,
    changedDomain,
    tabInteractionChanged,
    highStateChanged,
    consoleErrors,
    result: resultMetrics,
    coach: coachMetrics,
    resultPassed,
    coachPassed,
    passed
  });

  await page.close();
  await context.close();
}

await browser.close();

const passed = report.every((item) => item.passed);
const status = {
  version: '9.8.0',
  audit: 'editorial-result-and-kingdom-coach-report',
  passed,
  viewportCount: report.length,
  resultPassCount: report.filter((item) => item.resultPassed).length,
  coachPassCount: report.filter((item) => item.coachPassed).length,
  horizontalOverflowCount: report.filter((item) => item.result.horizontalOverflow || item.coach.horizontalOverflow).length,
  clippedCount: report.filter((item) => item.result.reportClipped || item.coach.sheetClipped).length,
  textOverflowCount: report.reduce((sum, item) => sum + item.result.textOverflow.length + item.coach.textOverflow.length, 0),
  consoleErrorCount: report.reduce((sum, item) => sum + item.consoleErrors.length, 0),
  interactionPassCount: report.filter((item) => item.tabInteractionChanged && item.highStateChanged).length,
  identityPassCount: report.filter((item) => item.coach.identityRestored).length,
  functionPassCount: report.filter((item) => item.coach.flourishFlowAbsent && item.coach.synthesisCardCount >= 2 && item.coach.perspectiveCardCount === 3 && item.coach.sessionQuestionCount === 5).length,
  viewports: report,
  checkedAt: new Date().toISOString()
};

await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(status, null, 2));
await fs.writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`);

console.table(report.map((item) => ({
  viewport: item.viewport,
  passed: item.passed,
  resultPassed: item.resultPassed,
  coachPassed: item.coachPassed,
  resultOverflow: item.result.horizontalOverflow,
  coachOverflow: item.coach.horizontalOverflow,
  resultTextOverflow: item.result.textOverflow.length,
  coachTextOverflow: item.coach.textOverflow.length,
  tabInteraction: item.tabInteractionChanged,
  stateInteraction: item.highStateChanged,
  consoleErrors: item.consoleErrors.length
})));

if (!passed) process.exitCode = 1;