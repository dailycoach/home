// Isolated release QA: fixtures and generated routes never enter the production catalog.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.NAL_PLAYWRIGHT_MODULE || 'playwright');
const axe = require(process.env.NAL_AXE_MODULE || 'axe-core');
const root = process.cwd();
const output = path.resolve(process.env.NAL_QA_OUTPUT || 'artifacts/nal-mind-store-03');
const temporary = await mkdtemp(path.join(tmpdir(), 'nal-release-qa-'));
const failures = [], checks = [], browserErrors = [];
const record = (ok, name, details) => { checks.push({ name, pass: Boolean(ok), ...(details ? { details } : {}) }); if (!ok) failures.push(name); };
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
const base = (await json(path.join(root, 'nal/data/pdf-ebook-product-template.json'))).product;
const program = (await json(path.join(root, 'nal/data/programs.json'))).programs.find(p => p.published);
const fixtures = [
  { ...base, id: 'qa-pdf', slug: 'qa-pdf', title: 'QA 전용 · 감정과 관계를 기록하는 PDF 전자책', subtitle: '부제검색확인', author: '테스트저자', summary: '워크북과 코칭 자료의 화면 검증용입니다. 실제 판매 상품이 아닙니다.', description: '설명검색확인 · 감정 언어를 찾고 관계를 기록하는 테스트 자료입니다.', category: 'PDF 전자책', tags: ['감정', '태그검색확인'], topics: ['관계'], audiences: ['개인', '코치'], coverImage: '/nal/qa/cover.svg', coverImageAlt: 'QA 전용 PDF 테스트 표지, 실제 판매 상품 아님', price: 100, pageCount: 8, fileSizeMB: 0.01, tableOfContents: ['01. 시작하기', '02. 감정 알아차리기', '03. 목차검색확인'], sampleUrl: '/nal/qa/sample.pdf', purchaseUrl: '/nal/qa/purchase', deliveryMethod: 'digital-download', licenseType: 'personal-use', printingAllowed: true, downloadLimit: 3, accessPeriod: 'QA 전용 테스트 기간', fulfillmentNote: 'QA 전용 전달 조건', refundPolicy: 'QA 전용 환불 문구', precautions: '테스트 화면이며 구매할 수 없습니다.', relatedProgramIds: [program.id], stockStatus: 'available', policyStatus: 'reviewed', published: true, featured: true, featuredOrder: 0, createdAt: '2026-10-03', updatedAt: '2026-10-03' },
];
fixtures.push(
  { ...fixtures[0], id: 'qa-no-preview', slug: 'qa-no-preview', title: 'QA · 미리보기 없는 PDF', sampleUrl: null, price: 200, createdAt: '2026-10-02', featuredOrder: 1 },
  { ...fixtures[0], id: 'qa-pending', slug: 'qa-pending', title: 'QA · 가격·저자·쪽수·표지 준비 중', price: null, author: null, pageCount: null, fileSizeMB: null, coverImage: null, sampleUrl: null, stockStatus: 'comingSoon', createdAt: '2026-10-01', featuredOrder: 2 },
  { ...fixtures[0], id: 'qa-sold-out', slug: 'qa-sold-out', title: 'QA · 아주 긴 상품명으로 화면 줄바꿈과 가격 및 버튼의 겹침을 검증하는 감정 관계 자기이해 코칭 PDF 전자책', price: 300, stockStatus: 'soldOut', createdAt: '2026-09-30', featuredOrder: 3 },
  { ...fixtures[0], id: 'qa-draft', slug: 'qa-draft', title: 'QA비공개검색어', published: false }
);
let server, browser;
try {
  await mkdir(output, { recursive: true });
  await mkdir(path.join(temporary, 'nal/data'), { recursive: true });
  await mkdir(path.join(temporary, 'nal/assets/js'), { recursive: true });
  for (const name of ['products', 'programs', 'hosts', 'content']) await copyFile(path.join(root, `nal/data/${name}.json`), path.join(temporary, `nal/data/${name}.json`));
  const products = await json(path.join(temporary, 'nal/data/products.json'));
  products.products.push(...fixtures);
  await writeFile(path.join(temporary, 'nal/data/products.json'), JSON.stringify(products));
  await writeFile(path.join(temporary, 'nal/data/backend.json'), JSON.stringify({ enabled: false }));
  await promisify(execFile)(process.execPath, [path.join(root, 'scripts/generate-nal-pages.mjs')], { cwd: temporary });
  record(!(await stat(path.join(temporary, 'nal/shop/qa-draft/index.html')).catch(() => null)), 'unpublished fixture has no generated route');
  await mkdir(path.join(temporary, 'nal/qa'), { recursive: true });
  await writeFile(path.join(temporary, 'nal/qa/cover.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800"><rect width="600" height="800" fill="#dce5df"/><path d="M50 60H550V740H50Z" fill="none" stroke="#234b3b" stroke-width="2"/><text x="85" y="130" font-family="sans-serif" font-size="24" fill="#234b3b">NAL · QA FIXTURE</text><text x="85" y="320" font-family="sans-serif" font-size="48" fill="#234b3b">MIND TOOLS</text><text x="85" y="390" font-family="sans-serif" font-size="30" fill="#234b3b">PDF SCREEN TEST</text><text x="85" y="670" font-family="sans-serif" font-size="22" fill="#234b3b">NOT FOR SALE</text></svg>');
  // Minimal valid public sample, created only in this temporary test build.
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const stream = 'BT /F1 18 Tf 30 350 Td (NAL QA SAMPLE - NOT FOR SALE) Tj ET';
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let pdf = '%PDF-1.4\n', offsets = [0];
  objects.forEach((s, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${s}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  await writeFile(path.join(temporary, 'nal/qa/sample.pdf'), pdf);
  const mime = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
  server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      if (pathname === '/nal/qa/purchase') { response.writeHead(200, { 'Content-Type': 'text/html' }); return response.end('<h1>QA purchase link destination — no payment</h1>'); }
      const sharedAsset = pathname.startsWith('/programs/art-psychology-coaching/assets/') && /\.(?:webp|png|woff2)$/.test(pathname);
      if ((!pathname.startsWith('/nal/') && !sharedAsset) || pathname.includes('..')) throw new Error('outside test scope');
      let file = path.join(temporary, pathname);
      let info = await stat(file).catch(() => null);
      if (!info) { file = path.join(root, pathname); info = await stat(file); }
      if (info.isDirectory()) file = path.join(file, 'index.html');
      const body = await readFile(file);
      response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); response.end(body);
    } catch { response.writeHead(404); response.end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const launch = { headless: true, ...(process.env.NAL_BROWSER_EXECUTABLE ? { executablePath: process.env.NAL_BROWSER_EXECUTABLE } : {}) };
  browser = await chromium.launch(launch);
  const version = browser.version();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
  const page = await context.newPage();
  page.on('pageerror', e => browserErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') browserErrors.push(m.text()); });
  const goto = async (route) => { const r = await page.goto(origin + route, { waitUntil: 'networkidle' }); await page.locator('[data-site-header] .nal-site-header').waitFor(); await page.evaluate(() => document.fonts.ready); return r; };
  const capture = async (name) => { await page.evaluate(async () => { const imgs = [...document.images]; imgs.forEach(i => i.loading = 'eager'); await Promise.all(imgs.map(i => i.complete ? null : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 2000); }))); for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) { scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); } scrollTo(0, 0); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }); await page.screenshot({ path: path.join(output, name), fullPage: true, animations: 'disabled' }); };
  const layout = async (name) => {
    const data = await page.evaluate(() => {
      const overflow = [...document.querySelectorAll('main *')].filter(n => { const r = n.getBoundingClientRect(), s = getComputedStyle(n); return r.width && (r.right > innerWidth + 1 || r.left < -1) && s.position !== 'absolute' && !n.closest('.nal-commerce-tabs,.nal-commerce-breadcrumb'); }).slice(0, 12).map(n => n.tagName + '.' + n.className);
      return { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, overflow, grid: getComputedStyle(document.querySelector('.card-grid') || document.body).gridTemplateColumns, ctas: [...document.querySelectorAll('.nal-commerce-buy,.nal-commerce-preview,.nal-sticky-cta a')].filter(n => n.getBoundingClientRect().width).map(n => ({ text: n.textContent, height: n.getBoundingClientRect().height, scrollWidth: n.scrollWidth, width: n.clientWidth })) };
    });
    record(data.scrollWidth <= data.viewport + 1 && data.overflow.length === 0, `${name}: no page overflow`, data);
    record(data.ctas.every(c => c.height >= 44 && c.scrollWidth <= c.width + 1), `${name}: CTA touch area and text fit`, data.ctas);
    return data;
  };
  const widths = [320, 390, 768, 1024, 1440];
  const physical = ['emotion-cards', 'coaching-question-cards', 'relationship-question-cards', 'strength-cards'];
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await goto('/nal/shop/');
    const cards = page.locator('.nal-card--product');
    record(await cards.count() === 8, `${width}: four physical and four public PDF fixtures visible`);
    record(await cards.first().getAttribute('data-catalog-id') === 'qa-pdf', `${width}: digital first`);
    const dims = await page.evaluate(() => [...document.querySelectorAll('.nal-card--product')].map(n => { const r = n.querySelector('.nal-card__media').getBoundingClientRect(); return { digital: n.classList.contains('nal-card--digital'), ratio: r.width / r.height }; }));
    record(dims.every(d => Math.abs(d.ratio - (d.digital ? .75 : 1)) < .02), `${width}: PDF 3:4 and physical 1:1`, dims);
    const metrics = await layout(`shop ${width}`);
    if (width <= 390) record(metrics.grid.split(' ').length === (width === 320 ? 1 : 2), `${width}: mobile grid columns`, metrics.grid);
    await capture(`shop-${width}.png`);
    await goto('/nal/shop/qa-pdf/'); await layout(`PDF detail ${width}`);
    if ([390, 1440].includes(width)) await capture(`pdf-detail-${width}.png`);
    for (const slug of physical) {
      await goto(`/nal/shop/${slug}/`); await layout(`${slug} ${width}`);
      record((await page.locator('#product-delivery').innerText()).includes('배송·교환') && !(await page.locator('main').innerText()).includes('본 상품은 디지털 파일'), `${slug} ${width}: physical delivery retained`);
      if (slug === physical[0] && [390, 1440].includes(width)) await capture(`physical-detail-${width}.png`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await goto('/nal/shop/qa-pdf/');
  const detail = await page.locator('main').innerText();
  for (const text of ['테스트저자', '100원', 'PDF', '8쪽', '0.01 MB', '디지털 다운로드', '개인 이용', '가능', '목차검색확인', '다운로드 가능 횟수: 3회', 'QA 전용 테스트 기간', '관련 프로그램']) record(detail.includes(text), `PDF detail: ${text}`);
  record(await page.locator('.nal-commerce-panel a.nal-commerce-buy').innerText() === '구매하기', 'available PDF purchase CTA');
  record(await page.locator('.nal-commerce-panel a.nal-commerce-preview').count() === 1, 'available PDF preview CTA');
  const sample = await context.request.get(origin + '/nal/qa/sample.pdf');
  record(sample.status() === 200 && (await sample.body()).subarray(0, 5).toString() === '%PDF-', 'sample link returns actual public PDF fixture');
  await page.locator('.nal-commerce-panel a.nal-commerce-buy').click();
  record(new URL(page.url()).pathname === '/nal/qa/purchase', 'purchase CTA resolves test destination');
  await goto('/nal/shop/qa-no-preview/');
  record(await page.locator('.nal-commerce-preview,#product-preview,a[href="#product-preview"]').count() === 0, 'missing preview hides CTA and section');
  await goto('/nal/shop/qa-pending/');
  record(!(await page.locator('.nal-commerce-price').innerText()).includes('원') && (await page.locator('.nal-commerce-price').innerText()).includes('준비 중'), 'unknown price has no fabricated price');
  record(await page.locator('.nal-commerce-author').count() === 0 && !(await page.locator('.nal-commerce-facts').first().innerText()).includes('쪽'), 'unknown author/pages omitted');
  record(await page.locator('.nal-commerce-gallery__main .nal-media-placeholder').count() === 1, 'missing cover has fallback');
  await goto('/nal/shop/qa-sold-out/'); record(await page.locator('.nal-commerce-panel button.nal-commerce-buy:disabled').count() === 1, 'sold out CTA disabled with reason'); await layout('long title sold-out mobile');
  record((await context.request.get(origin + '/nal/shop/qa-draft/')).status() === 404, 'private product route 404');
  await goto('/nal/shop/?q=QA비공개검색어'); record(await page.locator('.nal-card--product').count() === 0, 'private product absent from list');
  await goto('/nal/search/?q=QA비공개검색어'); record(await page.locator('.nal-card--product').count() === 0, 'private product absent from search');

  // Theme control is exercised through its visible mobile drawer, including system changes.
  for (const preference of ['dark', 'light', 'system']) {
    await goto('/nal/shop/'); await page.locator('[data-drawer-open]').click();
    await page.locator('.nal-drawer-theme [data-nal-theme]').selectOption(preference); await page.keyboard.press('Escape');
    if (preference === 'system') await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, preference === 'light' ? 'light' : 'dark');
    record(await page.locator('html').getAttribute('data-theme') === (preference === 'light' ? 'light' : 'dark'), `${preference}: resolved theme`);
    if (preference === 'dark') {
      await capture('dark-shop-390.png'); await goto('/nal/shop/qa-pdf/'); await capture('dark-pdf-detail-390.png');
      await page.addScriptTag({ content: axe.source });
      const a = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
      await writeFile(path.join(output, 'axe-dark-pdf.json'), JSON.stringify(a.violations, null, 2));
      record(a.violations.length === 0, 'dark PDF accessibility and contrast', a.violations.map(v => ({ id: v.id, impact: v.impact, targets: v.nodes.map(n => n.target) })));
    }
  }
  await page.emulateMedia({ colorScheme: 'light' });
  // Actual rendered text-only resize: double every computed font, without changing CSS viewport.
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of ['/nal/shop/', '/nal/shop/qa-pdf/', '/nal/shop/qa-sold-out/']) {
      await goto(route);
      await page.evaluate(() => { const fonts = [...document.querySelectorAll('body *')].map(n => [n, parseFloat(getComputedStyle(n).fontSize)]); for (const [n, size] of fonts) if (size) n.style.fontSize = `${size * 2}px`; });
      await layout(`200% text ${width} ${route}`);
      const safeBottom = await page.evaluate(() => { scrollTo(0, document.documentElement.scrollHeight); const bar = document.querySelector('.nal-sticky-cta'), footer = document.querySelector('.nal-site-footer'); if (!bar || !bar.getBoundingClientRect().height) return true; const last = footer?.querySelector('a:last-of-type'); return !last || last.getBoundingClientRect().bottom <= bar.getBoundingClientRect().top; });
      record(safeBottom, `200% text ${width} ${route}: footer reachable above sticky CTA`);
      if (width === 390) await capture(route.includes('qa-pdf') ? 'text-200-pdf-390.png' : route === '/nal/shop/' ? 'text-200-shop-390.png' : 'text-200-long-title-390.png');
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await goto('/nal/shop/');
  const select = async (name, value) => { await page.locator(`select[name="${name}"]`).selectOption(value); record(new URL(page.url()).searchParams.get(name) === value, `filter URL ${name}=${value}`); };
  await select('format', 'physical'); record(await page.locator('.nal-card--product').count() === 4 && await page.locator('.nal-card--digital').count() === 0, 'physical filter');
  await select('format', 'pdfEbook'); record(await page.locator('.nal-card--product').count() === 4, 'PDF filter');
  for (const form of ['workbook', 'guide']) { await select('format', form); record(await page.locator('.nal-card--product').count() === 0, `${form} empty filter`); }
  await select('format', 'pdfEbook'); await select('topic', '감정'); await select('audience', '코치'); record(await page.locator('[data-catalog-id="qa-pdf"]').count() === 1, 'topic and audience combined filter');
  for (const sort of ['recommended', 'newest', 'lowPrice', 'highPrice']) {
    await select('sort', sort); const ids = await page.locator('.nal-card--product').evaluateAll(nodes => nodes.map(n => n.dataset.catalogId));
    record(ids[0] === (sort === 'highPrice' ? 'qa-sold-out' : 'qa-pdf') && (sort === 'recommended' || sort === 'newest' || ids.at(-1) === 'qa-pending'), `sort order ${sort}`, ids);
  }
  await page.goBack(); record(new URL(page.url()).searchParams.get('sort') === 'lowPrice', 'filter history back');
  await goto('/nal/shop/'); await page.locator('input[name="q"]').fill('不存在QA결과'); await page.locator('input[name="q"]').press('Enter'); record(await page.locator('.nal-card--product').count() === 0 && (await page.locator('main').innerText()).includes('결과'), 'list search empty result');
  for (const term of ['감정', '관계', '워크북', '코칭', '테스트저자', '부제검색확인', '설명검색확인', '태그검색확인', '목차검색확인', 'PDF 전자책', '개인']) {
    await goto('/nal/search/'); await page.locator('#nalSearch').fill(term); await page.locator('#nalSearch').press('Enter');
    record(await page.locator('[data-catalog-id="qa-pdf"]').count() === 1, `search corpus: ${term}`);
  }
  await goto('/nal/shop/qa-pdf/'); await page.locator('.nal-commerce-panel [data-wish-key]').click();
  record(await page.locator('.nal-commerce-panel [data-wish-key]').getAttribute('aria-pressed') === 'true', 'wishlist toggle');
  await goto('/nal/my/'); record(await page.locator('[data-catalog-id="qa-pdf"]').count() >= 1, 'MY NAL wishlist/recent PDF preserved'); record(await page.locator('#purchased-materials[data-state="not-connected"]').count() === 1, 'purchase library slot honest');
  await goto('/nal/shop/'); await page.locator('[data-drawer-open]').focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Escape');
  record(await page.locator('#nalDrawer').getAttribute('aria-hidden') === 'true' && await page.locator('[data-drawer-open]').evaluate(n => n === document.activeElement), 'keyboard drawer ESC and focus return');
  for (const route of ['/nal/shop/', '/nal/shop/qa-pdf/', '/nal/shop/qa-sold-out/']) {
    await page.setViewportSize({ width: 1440, height: 1000 }); await goto(route);
    const expected = await page.locator('a[href],button:not(:disabled),select,input').evaluateAll(nodes => nodes.filter(n => n.getBoundingClientRect().width && !n.closest('[aria-hidden="true"]')).length);
    const visited = [];
    for (let i = 0; i < expected + 2; i++) { await page.keyboard.press('Tab'); visited.push(await page.evaluate(() => { const n = document.activeElement, s = getComputedStyle(n); return { tag: n.tagName, text: n.textContent.trim().slice(0, 40), href: n.getAttribute('href'), name: n.getAttribute('name'), outline: s.outlineStyle, shadow: s.boxShadow, disabled: n.disabled }; })); }
    record(visited.some(n => n.href === '#main-content') && visited.some(n => n.tag === 'SELECT') && visited.some(n => n.href?.includes('/nal/policy/')), `${route}: keyboard reaches skip/header/controls/footer without trap`, visited);
    record(visited.filter(n => n.tag !== 'BODY').every(n => !n.disabled && (n.outline !== 'none' || n.shadow !== 'none')), `${route}: visible focus and disabled CTA skipped`);
    if (route.includes('qa-pdf')) record(visited.some(n => n.href === '/nal/qa/sample.pdf') && visited.some(n => n.href === '/nal/qa/purchase') && visited.some(n => n.href === '#product-delivery'), 'keyboard reaches preview/buy/detail tabs');
  }
  for (const route of ['/nal/', '/nal/gather/', '/nal/class/', '/nal/shop/', '/nal/note/', '/nal/host/', '/nal/my/', '/nal/search/', `/nal/${program.type === 'gather' ? 'gather' : 'class'}/${program.slug}/`]) {
    const response = await goto(route); record(response.status() === 200 && await page.locator('main#main-content').count() === 1 && await page.locator('main h1').count() === 1, `regression ${route}`);
  }
  for (const route of ['/nal/shop/', '/nal/shop/qa-pdf/', '/nal/shop/emotion-cards/']) {
    await goto(route); await page.addScriptTag({ content: axe.source });
    const a = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
    record(a.violations.length === 0, `light accessibility ${route}`, a.violations.map(v => ({ id: v.id, impact: v.impact, targets: v.nodes.map(n => n.target) })));
    await writeFile(path.join(output, `axe-${route.split('/').filter(Boolean).at(-1)}.json`), JSON.stringify(a.violations, null, 2));
  }
  await goto('/nal/shop/qa-pdf/');
  const seo = await page.evaluate(() => ({ title: document.title, description: document.querySelector('meta[name="description"]')?.content, canonical: document.querySelector('link[rel="canonical"]')?.href, og: ['title', 'description', 'image'].map(k => document.querySelector(`meta[property="og:${k}"]`)?.content), jsonld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(n => JSON.parse(n.textContent)) }));
  record(seo.title.includes(fixtures[0].title) && seo.description && seo.canonical === 'https://daily-coach-ing.com/nal/shop/qa-pdf/' && seo.og.every(Boolean) && seo.jsonld.some(o => o['@type'] === 'Product'), 'PDF SEO metadata and Product JSON-LD', seo);
  const html = await (await context.request.get(origin + '/nal/shop/qa-pdf/')).text();
  const unsafe = /originalPdfUrl|privateStoragePath|entitlement_id|download_token|storage\/v1\/object\/(?:public|sign)\/nal-products-private|service_role|[?&](?:token|signature|access_token)=/i;
  record(!unsafe.test(html) && !unsafe.test(JSON.stringify(products)), 'public HTML/catalog excludes private file credentials');
  record(browserErrors.length === 0, 'no browser JavaScript/console errors', browserErrors);
  await writeFile(path.join(output, 'results.json'), JSON.stringify({ run: 'NAL-MIND-STORE-03', browser: version, fixtureIsolation: 'temporary generated build; backend disabled only in test server', textResize: 'all computed text font sizes doubled in actual Chromium at fixed CSS viewport; not device pixel scaling', checks, failures, browserErrors }, null, 2));
  console.log(JSON.stringify({ browser: version, checks: checks.length, failures, output }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); await rm(temporary, { recursive: true, force: true }); }
