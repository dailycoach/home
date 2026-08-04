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
const catalogDetails = [
  { route: '/nal/gather/emotion-card-conversation/', id: 'emotion-card-dialogue-gather', title: '감정카드 대화모임', capture: 'gather-detail-1440.png' },
  { route: '/nal/gather/self-understanding-writing/', id: 'self-understanding-writing-gather', title: '자기이해 글쓰기 모임' },
  { route: '/nal/gather/coaches-dialogue-practice/', id: 'coaches-dialogue-practice-gather', title: '코치들의 대화와 실습 모임' },
  { route: '/nal/gather/flowing-river-coaches/', id: 'flowing-river-coach-community', title: '흐르는 강물처럼', capture: 'flowing-river-detail-1440.png' },
  { route: '/nal/class/meet-myself-with-emotion-cards/', id: 'emotion-card-meets-self-class', title: '감정카드로 만나는 나' },
  { route: '/nal/class/art-current-mind/', id: 'art-current-mind-class', title: '미술로 그리는 현재의 마음', capture: 'class-detail-1440.png' },
  { route: '/nal/class/relationship-dialogue-style/', id: 'relationship-conversation-style-class', title: '관계 속 나의 대화 방식' },
  { route: '/nal/class/direction-collage/', id: 'yearly-direction-collage-class', title: '올해의 방향 콜라주' },
  { route: '/nal/shop/emotion-cards/', id: 'emotion-card', title: '감정카드', capture: 'shop-detail-1440.png' },
  { route: '/nal/shop/coaching-question-cards/', id: 'coaching-question-card', title: '코칭 질문카드' },
  { route: '/nal/shop/relationship-question-cards/', id: 'relationship-question-card', title: '관계 질문카드' },
  { route: '/nal/shop/strength-cards/', id: 'strength-card', title: '강점카드' }
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
  '/nal/policy/shipping/',
  ...catalogDetails.map((item) => item.route)
];
const layoutRoutes = [
  '/nal/',
  '/nal/gather/',
  '/nal/class/',
  '/nal/shop/',
  ...catalogDetails.map((item) => item.route),
  '/nal/search/',
  '/nal/my/'
];
const captureListings = new Map([
  ['/nal/', 'home'],
  ['/nal/gather/', 'gather-list'],
  ['/nal/class/', 'class-list'],
  ['/nal/shop/', 'shop-list']
]);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2'
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
const browser = await playwright.chromium.launch({
  headless: true,
  ...(process.env.NAL_BROWSER_EXECUTABLE ? { executablePath: process.env.NAL_BROWSER_EXECUTABLE } : {})
});
const failures = [];
const results = {
  baseUrl: process.env.NAL_BASE_URL ? baseUrl : 'http://127.0.0.1:<ephemeral>',
  routes: [],
  viewports: [],
  interactions: [],
  noJavaScript: [],
  accessibility: [],
  failures
};

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

async function installVitals(context) {
  await context.addInitScript(() => {
    window.__nalVitals = { cls: 0, lcp: 0 };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__nalVitals.cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length) window.__nalVitals.lcp = entries.at(-1).startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // Older engines may not expose these entry types; layout checks still run.
    }
  });
}

async function settleCatalogImages(page) {
  await page.evaluate(async () => {
    const images = [...document.querySelectorAll('img[src*="/catalog/"]')];
    images.forEach((image) => { image.loading = 'eager'; });
    await Promise.all(images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        const done = () => resolve();
        image.addEventListener('load', done, { once: true });
        image.addEventListener('error', done, { once: true });
        setTimeout(done, 3000);
      });
    }));
  });
}

async function primeFullPagePaint(page) {
  await page.evaluate(async () => {
    const waitFrame = () => new Promise((resolve) => setTimeout(resolve, 45));
    const step = Math.max(420, Math.floor(window.innerHeight * 0.75));
    const limit = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    for (let y = 0; y < limit; y += step) {
      window.scrollTo(0, y);
      await waitFrame();
    }
    window.scrollTo(0, limit);
    await waitFrame();
    window.scrollTo(0, 0);
    await waitFrame();
  });
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
    ['/nal/', '코칭을 사랑하는 사람들이'],
    ['/nal/gather/', '감정카드 대화모임'],
    ['/nal/class/', '미술로 그리는 현재의 마음'],
    ['/nal/shop/', '코칭 질문카드'],
    ['/nal/gather/emotion-card-conversation/', '감정카드 대화모임'],
    ['/nal/class/art-current-mind/', '미술로 그리는 현재의 마음'],
    ['/nal/shop/emotion-cards/', '감정카드']
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
    await installVitals(context);
    for (const route of layoutRoutes) {
      const { page, issues } = await trackedPage(context);
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      await settleCatalogImages(page);
      const layout = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('[data-catalog-id]')];
        const lineCounts = cards.map((card) => {
          const title = card.querySelector('.nal-card__title');
          if (!title) return 0;
          const lineHeight = Number.parseFloat(getComputedStyle(title).lineHeight) || 1;
          return Math.round(title.getBoundingClientRect().height / lineHeight * 10) / 10;
        });
        const wishes = cards.map((card) => card.querySelector('[data-wish-key]')).filter(Boolean);
        const touchTargets = wishes.map((button) => {
          const rect = button.getBoundingClientRect();
          return Math.min(rect.width, rect.height);
        });
        const overlap = cards.some((card) => {
          const badges = card.querySelector('.nal-card__badges')?.getBoundingClientRect();
          const wish = card.querySelector('.nal-card__wish')?.getBoundingClientRect();
          return Boolean(badges && wish && badges.left < wish.right && badges.right > wish.left && badges.top < wish.bottom && badges.bottom > wish.top);
        });
        const catalogImages = [...document.querySelectorAll('img[src*="/catalog/"]')];
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          heading: document.querySelector('h1')?.textContent?.trim() || '',
          bodyFont: Number.parseFloat(getComputedStyle(document.body).fontSize),
          maxTitleLines: lineCounts.length ? Math.max(...lineCounts) : 0,
          minWishTarget: touchTargets.length ? Math.min(...touchTargets) : 0,
          badgeWishOverlap: overlap,
          catalogImageCount: catalogImages.length,
          failedCatalogImages: catalogImages.filter((image) => !image.complete || image.naturalWidth === 0).length,
          catalogPlaceholders: document.querySelectorAll('[data-catalog-id] .nal-media-placeholder, .nal-detail-hero .nal-media-placeholder').length,
          vitals: window.__nalVitals || { cls: 0, lcp: 0 }
        };
      });
      results.viewports.push({ route, ...viewport, status: response?.status() || 0, ...layout, issues });
      record(response?.status() === 200, `${route} ${viewport.width}px returned ${response?.status() || 'no response'}`);
      record(layout.scrollWidth <= layout.clientWidth, `${route} ${viewport.width}px has horizontal overflow (${layout.scrollWidth}/${layout.clientWidth})`);
      record(Boolean(layout.heading), `${route} ${viewport.width}px missing h1`);
      record(issues.length === 0, `${route} ${viewport.width}px issues: ${issues.join('; ')}`);
      record(layout.failedCatalogImages === 0, `${route} ${viewport.width}px has ${layout.failedCatalogImages} failed catalog images`);
      record(layout.catalogPlaceholders === 0, `${route} ${viewport.width}px exposed catalog placeholder`);
      record(layout.vitals.cls <= 0.1, `${route} ${viewport.width}px CLS ${layout.vitals.cls.toFixed(3)} exceeds 0.1`);
      if (layout.vitals.lcp) record(layout.vitals.lcp <= 2500, `${route} ${viewport.width}px local LCP ${Math.round(layout.vitals.lcp)}ms exceeds 2500ms`);
      if (viewport.width <= 412) {
        record(layout.bodyFont >= 16, `${route} ${viewport.width}px body font is ${layout.bodyFont}px`);
        record(layout.maxTitleLines <= 2.1, `${route} ${viewport.width}px catalog title exceeds 2 lines (${layout.maxTitleLines})`);
        if (layout.minWishTarget) record(layout.minWishTarget >= 44, `${route} ${viewport.width}px wishlist target is ${layout.minWishTarget}px`);
        record(!layout.badgeWishOverlap, `${route} ${viewport.width}px badge overlaps wishlist`);
      }
      const captureName = captureListings.get(route);
      if (captureName && (viewport.width === 390 || viewport.width === 1440)) {
        await primeFullPagePaint(page);
        await page.screenshot({ path: path.join(outputDir, `${captureName}-${viewport.width}.png`), fullPage: true });
      }
      const detailCapture = catalogDetails.find((item) => item.route === route)?.capture;
      if (detailCapture && viewport.width === 1440) {
        await primeFullPagePaint(page);
        await page.screenshot({ path: path.join(outputDir, detailCapture), fullPage: true });
      }
      await page.close();
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
  results.interactions.push({ name: 'class filter', url: `${filterUrl.pathname}${filterUrl.search}` });
  record(filterUrl.searchParams.get('status') === 'comingSoon', 'class filter state was not written to URL');

  await mobile.goto(`${baseUrl}/nal/gather/flowing-river-coaches/`, { waitUntil: 'networkidle' });
  const riverContent = await mobile.locator('[data-page-root]').textContent();
  const riverInstagram = await mobile.locator('a[href="https://www.instagram.com/daily_coach_ing/"]').count();
  const riverPrivateLeak = await mobile.locator('body').evaluate((node) => /zoom\.us|open\.kakao\.com|참여코드\s*[:：]\s*\S+/.test(node.textContent || ''));
  const riverApplication = await mobile.locator('a[href*="docs.google.com/forms/"]').count();
  const riverPending = await mobile.locator('[aria-disabled="true"]').filter({ hasText: '설문 연결 전' }).count();
  results.interactions.push({ name: 'flowing river launch', instagramLinks: riverInstagram, applicationLinks: riverApplication, pendingApplicationControls: riverPending, privateLeak: riverPrivateLeak });
  record(Boolean(riverContent?.includes('창립 멤버 10명')), 'flowing river missing founding member capacity');
  record(Boolean(riverContent?.includes('월 10,000원')), 'flowing river missing monthly fee');
  record(Boolean(riverContent?.includes('COACHING FLEX MOVE')), 'flowing river missing FLEX MOVE content');
  record(riverInstagram >= 1, 'flowing river missing Instagram inquiry link');
  record(!riverPrivateLeak, 'flowing river exposes a private meeting or Kakao value');
  record(riverApplication >= 1 || riverPending >= 1, 'flowing river missing application state');

  await mobile.goto(`${baseUrl}/nal/gather/emotion-card-conversation/`, { waitUntil: 'networkidle' });
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
  const recentText = await mobile.locator('[data-page-root]').textContent();
  results.interactions.push({ name: 'local wishlist and recent', pressed, visibleInMy: wishText?.includes('감정카드 대화모임') || false, visibleInRecent: recentText?.includes('감정카드 대화모임') || false, skipLinkState });
  record(pressed === 'true', 'wishlist button did not persist pressed state');
  record(Boolean(wishText?.includes('감정카드 대화모임')), 'wishlist item was not visible in MY NAL');
  record(Boolean(recentText?.includes('감정카드 대화모임')), 'recent item was not visible in MY NAL');

  const searchChecks = [];
  for (const item of catalogDetails) {
    await mobile.goto(`${baseUrl}/nal/search/?q=${encodeURIComponent(item.title)}`, { waitUntil: 'networkidle' });
    const searchContent = await mobile.locator('[data-page-root]').textContent();
    const passed = Boolean(searchContent?.includes(item.title));
    searchChecks.push({ title: item.title, passed });
    record(passed, `search did not return ${item.title}`);
  }
  results.interactions.push({ name: 'catalog search coverage', checked: searchChecks.length, passed: searchChecks.every((item) => item.passed) });
  record(mobileIssues.length === 0, `mobile interaction issues: ${mobileIssues.join('; ')}`);
  await mobileContext.close();

  for (const target of [
    { route: '/nal/', width: 390, height: 844 },
    { route: '/nal/gather/', width: 390, height: 844 },
    { route: '/nal/class/', width: 390, height: 844 },
    { route: '/nal/shop/', width: 390, height: 844 },
    { route: '/nal/gather/flowing-river-coaches/', width: 390, height: 844 },
    { route: '/nal/gather/flowing-river-coaches/', width: 1440, height: 1000 },
    { route: '/nal/gather/emotion-card-conversation/', width: 1440, height: 1000 },
    { route: '/nal/class/art-current-mind/', width: 1440, height: 1000 },
    { route: '/nal/shop/emotion-cards/', width: 1440, height: 1000 },
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
