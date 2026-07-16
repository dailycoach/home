import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = 'http://127.0.0.1:4173';
const outputDir = path.resolve('artifacts/cip-visual-audit');

const pages = [
  { name: 'business', url: '/lcms/business-achievements.html' },
  { name: 'academy', url: '/lcms/academy/' },
  { name: 'course', url: '/lcms/academy/course.html?course=lmc-lifetime-management-counselor' },
  { name: 'lesson', url: '/lcms/academy/lesson.html?course=lmc-lifetime-management-counselor' }
];

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 1024, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
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

  for (const target of pages) {
    const page = await context.newPage();
    const url = `${root}${target.url}`;
    const consoleErrors = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(error.message));

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1600);

    const prefix = `${target.name}-${viewport.name}`;
    await page.screenshot({
      path: path.join(outputDir, `${prefix}-viewport.png`),
      fullPage: false
    });
    await page.screenshot({
      path: path.join(outputDir, `${prefix}-full.png`),
      fullPage: true
    });

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const selectors = [
        '.cip-header', '.experience-hero', '.art-hero-index', '.trend-note',
        '.academy-hero', '.academy-art-poster', '.academy-jump-nav',
        '.course-quicknav', '.course-detail-hero', '.lesson-layout',
        '.mobile-learning-bar', '.archive-grid', '.art-timeline'
      ];

      const elements = selectors.flatMap((selector) =>
        [...document.querySelectorAll(selector)].map((element, index) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            selector,
            index,
            display: style.display,
            position: style.position,
            zIndex: style.zIndex,
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            overflowX: element.scrollWidth > element.clientWidth + 1,
            clippedLeft: rect.left < -1,
            clippedRight: rect.right > doc.clientWidth + 1
          };
        })
      );

      const textOverflow = [...document.querySelectorAll('h1,h2,h3,strong,p,a,span')]
        .filter((element) => {
          const style = getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          return element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2;
        })
        .slice(0, 40)
        .map((element) => ({
          tag: element.tagName,
          className: element.className,
          text: (element.textContent || '').trim().slice(0, 90),
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight
        }));

      return {
        title: document.title,
        viewport: { width: doc.clientWidth, height: window.innerHeight },
        document: { width: doc.scrollWidth, height: doc.scrollHeight },
        horizontalOverflow: doc.scrollWidth > doc.clientWidth + 1,
        elements,
        textOverflow
      };
    });

    report.push({
      page: target.name,
      url: target.url,
      viewport,
      consoleErrors,
      ...metrics
    });

    await page.close();
  }

  await context.close();
}

await browser.close();
await fs.writeFile(path.join(outputDir, 'report.json'), JSON.stringify(report, null, 2));

const summary = report.map((item) => ({
  page: item.page,
  viewport: item.viewport.name,
  horizontalOverflow: item.horizontalOverflow,
  documentWidth: item.document.width,
  viewportWidth: item.viewport.width,
  consoleErrors: item.consoleErrors.length,
  clippedElements: item.elements.filter((element) => element.clippedLeft || element.clippedRight).length,
  textOverflow: item.textOverflow.length
}));

console.table(summary);
if (report.some((item) => item.consoleErrors.length)) process.exitCode = 1;
