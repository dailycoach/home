import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const playwright = require(process.env.NAL_PLAYWRIGHT_MODULE || 'playwright');
const axe = require(process.env.NAL_AXE_MODULE || 'axe-core');
let baseUrl = (process.env.NAL_BASE_URL || '').replace(/\/$/, '');
const outputDir = path.resolve(process.cwd(), process.env.NAL_QA_OUTPUT || 'docs/nal-qa');
const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 768, height: 1024 },
  { width: 1280, height: 900 },
  { width: 1440, height: 1000 }
];
const publicRoutes = [
  '/nal/',
  '/nal/gather/',
  '/nal/class/',
  '/nal/class/art-psychology-coaching-6week/',
  '/nal/shop/',
  '/nal/note/',
  '/nal/note/art-psychology-coaching-guide/',
  '/nal/host/',
  '/nal/host/park-jia/',
  '/nal/host/kim-cheol-woong/',
  '/nal/my/',
  '/nal/search/',
  '/nal/notice/',
  '/nal/faq/',
  '/nal/partnership/',
  '/nal/policy/terms/',
  '/nal/policy/privacy/',
  '/nal/policy/cancellation/',
  '/nal/policy/shipping/'
];

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};
let server = null;

if (!baseUrl) {
  const serveRoot = path.resolve(process.cwd());
  server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
      const decodedPath = decodeURIComponent(requestUrl.pathname);
      const safePath = path.resolve(serveRoot, `.${decodedPath}`);
      if (!safePath.startsWith(`${serveRoot}${path.sep}`) && safePath !== serveRoot) throw new Error('unsafe path');
      let filePath = safePath;
      const fileStat = await stat(filePath);
      if (fileStat.isDirectory()) filePath = path.join(filePath, 'index.html');
      const body = await readFile(filePath);
      response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
}

await mkdir(outputDir, { recursive: true });
const browser = await playwright.chromium.launch({ headless: true });
const failures = [];
const results = { baseUrl, routes: [], viewports: [], interactions: [], noJavaScript: [], accessibility: [], failures };

function record(condition, message) {
  if (!condition) failures.push(message);
  return condition;
}

async function trackedPage(context) {
  const page = await context.newPage();
  const issues = [];
  page.on('console', (message) => {
    if (message.type() === 'error') issues.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => issues.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || ''}`));
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().startsWith(baseUrl)) {
      issues.push(`http ${response.status()}: ${response.url()}`);
    }
  });
  return { page, issues };
}

try {
  const routeContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  for (const route of publicRoutes) {
    const { page, issues } = await trackedPage(routeContext);
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
    const title = await page.title();
    const mainCount = await page.locator('main#main-content').count();
    results.routes.push({ route, status: response?.status() || 0, title, issues });
    record(response?.status() === 200, `${route} returned ${response?.status() || 'no response'}`);
    record(mainCount === 1, `${route} missing one main landmark`);
    record(title.length > 0, `${route} missing document title`);
    record(issues.length === 0, `${route} browser issues: ${issues.join('; ')}`);
    await page.close();
  }
  await routeContext.close();

  const noJsContext = await browser.newContext({ viewport: { width: 1280, height: 900 }, javaScriptEnabled: false });
  for (const [route, expectedText] of [
    ['/nal/', '오늘, 조금 다른 사람들과'],
    ['/nal/class/', '미술심리코칭 6주 과정'],
    ['/nal/class/art-psychology-coaching-6week/', '미술심리코칭 6주 과정']
  ]) {
    const page = await noJsContext.newPage();
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'load' });
    const content = await page.locator('main#main-content').textContent();
    const passed = response?.status() === 200 && Boolean(content?.includes(expectedText));
    results.noJavaScript.push({ route, status: response?.status() || 0, expectedText, passed });
    record(passed, `${route} JavaScript-free fallback missing ${expectedText}`);
    await page.close();
  }
  await noJsContext.close();

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const { page, issues } = await trackedPage(context);
    await page.goto(`${baseUrl}/nal/`, { waitUntil: 'networkidle' });
    const layout = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      heading: document.querySelector('h1')?.textContent?.trim() || '',
      bodyFont: getComputedStyle(document.body).fontSize
    }));
    results.viewports.push({ ...viewport, ...layout, issues });
    record(layout.scrollWidth <= layout.clientWidth, `${viewport.width}px home has horizontal overflow (${layout.scrollWidth}/${layout.clientWidth})`);
    record(Boolean(layout.heading), `${viewport.width}px home missing h1`);
    record(issues.length === 0, `${viewport.width}px home issues: ${issues.join('; ')}`);
    if (viewport.width === 390 || viewport.width === 1440) {
      await page.screenshot({ path: path.join(outputDir, `home-${viewport.width}.png`) });
    }
    await context.close();
  }

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const { page: mobile, issues: mobileIssues } = await trackedPage(mobileContext);
  await mobile.goto(`${baseUrl}/nal/`, { waitUntil: 'networkidle' });
  const opener = mobile.locator('[data-drawer-open]');
  await opener.click();
  const drawerOpen = await mobile.locator('#nalDrawer').getAttribute('aria-hidden');
  await mobile.keyboard.press('Escape');
  const drawerClosed = await mobile.locator('#nalDrawer').getAttribute('aria-hidden');
  const focusReturned = await opener.evaluate((node) => node === document.activeElement);
  results.interactions.push({ name: 'mobile drawer', drawerOpen, drawerClosed, focusReturned });
  record(drawerOpen === 'false', 'mobile drawer did not open');
  record(drawerClosed === 'true', 'mobile drawer did not close with Escape');
  record(focusReturned, 'mobile drawer did not return focus');

  await mobile.goto(`${baseUrl}/nal/class/`, { waitUntil: 'networkidle' });
  await mobile.locator('select[name="status"]').selectOption('comingSoon');
  await mobile.waitForLoadState('networkidle');
  const filterUrl = new URL(mobile.url());
  results.interactions.push({ name: 'class filter', url: filterUrl.href });
  record(filterUrl.searchParams.get('status') === 'comingSoon', 'class filter state was not written to URL');

  await mobile.goto(`${baseUrl}/nal/class/art-psychology-coaching-6week/`, { waitUntil: 'networkidle' });
  await mobile.screenshot({ path: path.join(outputDir, 'class-detail-390.png') });
  const wishlistButton = mobile.locator('[data-wish-key]').first();
  await wishlistButton.click();
  const pressed = await wishlistButton.getAttribute('aria-pressed');
  await mobile.waitForFunction(() => !document.querySelector('[data-toast]')?.classList.contains('is-visible'));
  const skipLinkState = await mobile.locator('.nal-skip-link').evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      active: node === document.activeElement,
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      translate: getComputedStyle(node).translate
    };
  });
  await mobile.goto(`${baseUrl}/nal/my/`, { waitUntil: 'networkidle' });
  const wishText = await mobile.locator('#wishlist').textContent();
  results.interactions.push({ name: 'local wishlist', pressed, visibleInMy: wishText?.includes('미술심리') || false, skipLinkState });
  record(pressed === 'true', 'wishlist button did not persist pressed state');
  record(Boolean(wishText?.includes('미술심리')), 'wishlist item was not visible in MY NAL');

  await mobile.goto(`${baseUrl}/nal/search/`, { waitUntil: 'networkidle' });
  await mobile.locator('[data-search-form] input').fill('미술');
  await mobile.locator('[data-search-form]').evaluate((form) => form.requestSubmit());
  await mobile.waitForLoadState('networkidle');
  const searchContent = await mobile.locator('[data-page-root]').textContent();
  results.interactions.push({ name: 'search', url: mobile.url(), hasResult: searchContent?.includes('미술심리') || false });
  record(new URL(mobile.url()).searchParams.get('q') === '미술', 'search query was not written to URL');
  record(Boolean(searchContent?.includes('미술심리')), 'search did not return the public art program');
  record(mobileIssues.length === 0, `mobile interaction issues: ${mobileIssues.join('; ')}`);
  await mobileContext.close();

  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const { page: desktop, issues: desktopIssues } = await trackedPage(desktopContext);
  await desktop.goto(`${baseUrl}/nal/class/art-psychology-coaching-6week/`, { waitUntil: 'networkidle' });
  const desktopLayout = await desktop.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  await desktop.screenshot({ path: path.join(outputDir, 'class-detail-1440.png') });
  record(desktopLayout.scrollWidth <= desktopLayout.clientWidth, '1440px class detail has horizontal overflow');
  record(desktopIssues.length === 0, `desktop detail issues: ${desktopIssues.join('; ')}`);
  await desktopContext.close();

  for (const target of [
    { route: '/nal/', width: 390, height: 844 },
    { route: '/nal/class/', width: 390, height: 844 },
    { route: '/nal/class/art-psychology-coaching-6week/', width: 1440, height: 1000 },
    { route: '/nal/faq/', width: 390, height: 844 }
  ]) {
    const context = await browser.newContext({ viewport: { width: target.width, height: target.height } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}${target.route}`, { waitUntil: 'networkidle' });
    await page.addScriptTag({ content: axe.source });
    const audit = await page.evaluate(async () => window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }
    }));
    const violations = audit.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      description: violation.description,
      nodes: violation.nodes.map((node) => node.target.join(' '))
    }));
    results.accessibility.push({ ...target, violations });
    const blocking = violations.filter((violation) => ['critical', 'serious'].includes(violation.impact));
    record(blocking.length === 0, `${target.route} ${target.width}px accessibility: ${blocking.map((item) => item.id).join(', ')}`);
    await context.close();
  }
} finally {
  await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
}

await writeFile(path.join(outputDir, 'browser-results.json'), `${JSON.stringify(results, null, 2)}\n`, 'utf8');

if (failures.length) {
  console.error(`NAL browser QA failed (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`NAL browser QA passed: ${publicRoutes.length} routes, ${viewports.length} viewports, ${results.interactions.length} interaction flows, ${results.accessibility.length} accessibility scans`);
}
