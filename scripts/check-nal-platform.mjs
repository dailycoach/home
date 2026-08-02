import assert from 'node:assert/strict';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.cwd());
const nalRoot = path.join(root, 'nal');
const failures = [];
const notes = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

async function json(relative) {
  return JSON.parse(await readFile(path.join(root, relative), 'utf8'));
}

async function exists(relative) {
  try {
    await access(path.join(root, relative));
    return true;
  } catch {
    return false;
  }
}

async function collectHtml(directory, result = []) {
  for (const entry of await readdir(directory)) {
    const full = path.join(directory, entry);
    const info = await stat(full);
    if (info.isDirectory()) await collectHtml(full, result);
    else if (entry === 'index.html') result.push(full);
  }
  return result;
}

async function collectFiles(directory, result = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await collectFiles(full, result);
    else result.push(full);
  }
  return result;
}

function webpDimensions(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (type === 'VP8 ' && data + 10 <= buffer.length) {
      return { width: buffer.readUInt16LE(data + 6) & 0x3fff, height: buffer.readUInt16LE(data + 8) & 0x3fff };
    }
    if (type === 'VP8L' && data + 5 <= buffer.length) {
      const bits = buffer.readUInt32LE(data + 1);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (type === 'VP8X' && data + 10 <= buffer.length) {
      return {
        width: 1 + buffer.readUIntLE(data + 4, 3),
        height: 1 + buffer.readUIntLE(data + 7, 3)
      };
    }
    offset = data + length + (length % 2);
  }
  return null;
}

async function checkCatalogImage(publicPath, expected, maxBytes, label) {
  check(typeof publicPath === 'string' && /^\/nal\/assets\/images\/catalog\/[a-z-]+\/[a-z0-9-]+\.webp$/.test(publicPath), `${label} invalid catalog image path`);
  if (typeof publicPath !== 'string' || !publicPath.startsWith('/')) return;
  const relative = publicPath.slice(1);
  check(await exists(relative), `${label} missing file ${relative}`);
  if (!(await exists(relative))) return;
  const full = path.join(root, relative);
  const info = await stat(full);
  check(info.size <= maxBytes, `${label} exceeds ${maxBytes} bytes (${info.size})`);
  const dimensions = webpDimensions(await readFile(full));
  check(Boolean(dimensions), `${label} unreadable WebP dimensions`);
  if (dimensions) check(dimensions.width === expected[0] && dimensions.height === expected[1], `${label} expected ${expected.join('x')}, found ${dimensions.width}x${dimensions.height}`);
}

const [{ programs }, { products }, { hosts }, { content }, site, launches] = await Promise.all([
  json('nal/data/programs.json'),
  json('nal/data/products.json'),
  json('nal/data/hosts.json'),
  json('nal/data/content.json'),
  json('nal/data/site.json'),
  json('nal/data/launches.json')
]);

const requiredProgram = [
  'id', 'slug', 'type', 'title', 'subtitle', 'summary', 'description', 'category', 'tags', 'coverImage', 'coverImageMobile', 'coverImageAlt', 'gallery',
  'hostId', 'format', 'location', 'address', 'onlineUrl', 'startDate', 'endDate', 'startTime', 'endTime', 'duration',
  'frequency', 'sessionCount', 'capacity', 'remainingSeats', 'price', 'originalPrice', 'status', 'difficulty', 'materials',
  'includedItems', 'activities', 'recommendedFor', 'soloFriendly', 'beginnerFriendly', 'groupChat', 'applicationUrl', 'refundPolicy', 'safetyGuide',
  'productIds', 'relatedContentIds', 'featured', 'featuredOrder', 'published', 'createdAt', 'updatedAt'
];
const requiredProduct = [
  'id', 'slug', 'title', 'subtitle', 'summary', 'description', 'category', 'tags', 'coverImage', 'coverImageAlt', 'gallery', 'galleryAlts', 'price',
  'originalPrice', 'productType', 'deliveryType', 'stock', 'stockStatus', 'options', 'components', 'cardCount', 'pageCount',
  'recommendedFor', 'usageIndividual', 'usageCouple', 'usageGroup', 'precautions', 'visualNote', 'shippingPolicy', 'exchangePolicy',
  'refundPolicy', 'purchaseUrl', 'relatedProgramIds', 'relatedContentIds', 'featured', 'featuredOrder', 'published', 'createdAt', 'updatedAt'
];
const requiredHost = ['id', 'slug', 'name', 'profileImage', 'headline', 'bio', 'fields', 'credentials', 'experience', 'location', 'programIds', 'contentIds', 'socialLinks', 'featured', 'published'];
const requiredContent = ['id', 'slug', 'title', 'summary', 'category', 'coverImage', 'authorId', 'publishedAt', 'readingTime', 'body', 'relatedProgramIds', 'relatedProductIds', 'featured', 'published'];

for (const item of programs) for (const key of requiredProgram) check(Object.hasOwn(item, key), `program ${item.id ?? '?'} missing ${key}`);
for (const item of products) for (const key of requiredProduct) check(Object.hasOwn(item, key), `product ${item.id ?? '?'} missing ${key}`);
for (const item of hosts) for (const key of requiredHost) check(Object.hasOwn(item, key), `host ${item.id ?? '?'} missing ${key}`);
for (const item of content) for (const key of requiredContent) check(Object.hasOwn(item, key), `content ${item.id ?? '?'} missing ${key}`);

const unique = (items, key, label) => check(new Set(items.map((item) => item[key])).size === items.length, `${label} duplicate ${key}`);
for (const [items, label] of [[programs, 'program'], [products, 'product'], [hosts, 'host'], [content, 'content']]) {
  unique(items, 'id', label);
  unique(items, 'slug', label);
}

const programIds = new Set(programs.map((item) => item.id));
const productIds = new Set(products.map((item) => item.id));
const hostIds = new Set(hosts.map((item) => item.id));
const contentIds = new Set(content.map((item) => item.id));

for (const item of programs) {
  check(['gather', 'class'].includes(item.type), `program ${item.id} invalid type ${item.type}`);
  check(['draft', 'comingSoon', 'open', 'closing', 'waiting', 'closed', 'completed'].includes(item.status), `program ${item.id} invalid status ${item.status}`);
  if (item.hostId) check(hostIds.has(item.hostId), `program ${item.id} unknown host ${item.hostId}`);
  for (const id of item.productIds) check(productIds.has(id), `program ${item.id} unknown product ${id}`);
  for (const id of item.relatedContentIds) check(contentIds.has(id), `program ${item.id} unknown content ${id}`);
  if (!item.published) {
    for (const key of ['startDate', 'endDate', 'startTime', 'endTime', 'capacity', 'remainingSeats', 'price', 'originalPrice', 'applicationUrl']) {
      check(item[key] === null, `draft program ${item.id} must keep ${key} null`);
    }
  }
}

for (const item of products) {
  check(
    item.deliveryType === null || ['physical', 'digital', 'physical-and-digital'].includes(item.deliveryType),
    `product ${item.id} invalid deliveryType ${item.deliveryType}`
  );
  for (const id of item.relatedProgramIds) check(programIds.has(id), `product ${item.id} unknown program ${id}`);
  for (const id of item.relatedContentIds) check(contentIds.has(id), `product ${item.id} unknown content ${id}`);
  if (!item.published) {
    for (const key of ['price', 'originalPrice', 'stock']) check(item[key] === null, `draft product ${item.id} must keep ${key} null`);
  }
}

const gatherTargetIds = new Set([
  'emotion-card-dialogue-gather',
  'self-understanding-writing-gather',
  'coaches-dialogue-practice-gather',
  'flowing-river-coach-community'
]);
const classTargetIds = new Set([
  'emotion-card-meets-self-class',
  'art-current-mind-class',
  'relationship-conversation-style-class',
  'yearly-direction-collage-class'
]);
const productTargetIds = new Set(['emotion-card', 'coaching-question-card', 'relationship-question-card', 'strength-card']);
const publicPrograms = programs.filter((item) => item.published);
const publicProducts = products.filter((item) => item.published);
const targetPrograms = programs.filter((item) => gatherTargetIds.has(item.id) || classTargetIds.has(item.id));
const targetProducts = products.filter((item) => productTargetIds.has(item.id));

check(publicPrograms.filter((item) => item.type === 'gather').length === 4, 'expected exactly 4 public gathers');
check(targetPrograms.filter((item) => item.type === 'gather' && item.published).length === 4, 'expected all 4 target gathers public');
check(targetPrograms.filter((item) => item.type === 'class' && item.published).length === 4, 'expected all 4 target classes public');
check(publicPrograms.some((item) => item.id === 'art-psychology-coaching-6week'), 'existing art psychology coaching 6-week program must remain public');
check(publicProducts.length === 4, 'expected exactly 4 public products');
check(targetProducts.filter((item) => item.published).length === 4, 'expected all 4 target products public');

for (const item of targetPrograms) {
  check(item.published, `target program ${item.id} must be public`);
  check(typeof item.coverImageAlt === 'string' && item.coverImageAlt.length >= 12, `target program ${item.id} missing descriptive alt`);
  check(item.gallery.includes(item.coverImage), `target program ${item.id} gallery must include cover`);
  check(item.activities.length >= 3, `target program ${item.id} needs activity content`);
  check(item.recommendedFor.length >= 3, `target program ${item.id} needs recommendedFor content`);
  if (item.id === 'flowing-river-coach-community') {
    check(item.status === 'open', 'flowing river must be open');
    check(item.startDate === '2026-09-10', 'flowing river first Zoom date mismatch');
    check(item.startTime === '20:00' && item.endTime === '21:30', 'flowing river Zoom time mismatch');
    check(item.capacity === 10, 'flowing river capacity must be 10');
    check(item.price === 10000, 'flowing river monthly fee must be 10000');
    check(item.format === 'online', 'flowing river format must be online');
    check(item.location === '카카오톡 단톡방 · Zoom', 'flowing river location mismatch');
    check(item.onlineUrl === null, 'flowing river must not expose a Zoom URL');
    check(item.instagramUrl === 'https://www.instagram.com/daily_coach_ing/', 'flowing river Instagram URL mismatch');
    check(item.flexMoveUrl === '/activities/coaching-flex-move/', 'flowing river FLEX MOVE URL mismatch');
    check(item.zoomRecording === false, 'flowing river Zoom recording must be disabled');
    check(item.applicationUrl === null || /^https:\/\/docs\.google\.com\/forms\//.test(item.applicationUrl), 'flowing river applicationUrl must be null or a Google Form URL');
    check(!String(item.applicationUrl || '').includes('REPLACE_'), 'flowing river applicationUrl contains a placeholder');
    check(item.monthlyFlow?.length === 4, 'flowing river monthly flow must have four stages');
    check(item.participationSteps?.length === 7, 'flowing river participation flow must have seven stages');
    if (item.applicationUrl === null) notes.push('flowing-river-form=pending');
  } else {
    for (const key of ['startDate', 'endDate', 'startTime', 'endTime', 'capacity', 'remainingSeats', 'price', 'originalPrice', 'applicationUrl']) {
      check(item[key] === null, `target program ${item.id} must keep unconfirmed ${key} null`);
    }
  }
  await checkCatalogImage(item.coverImage, [1600, 1000], 250 * 1024, `program ${item.id} cover`);
  await checkCatalogImage(item.coverImageMobile, [900, 1200], 200 * 1024, `program ${item.id} mobile`);
}

for (const item of targetProducts) {
  check(item.published, `target product ${item.id} must be public`);
  check(typeof item.coverImageAlt === 'string' && item.coverImageAlt.length >= 12, `target product ${item.id} missing descriptive alt`);
  check(item.gallery.length === 3, `target product ${item.id} needs exactly 3 catalog visuals`);
  check(item.galleryAlts.length === item.gallery.length, `target product ${item.id} gallery alt mismatch`);
  check(typeof item.visualNote === 'string' && item.visualNote.includes('비주얼 콘셉트'), `target product ${item.id} missing concept disclosure`);
  for (const key of ['price', 'originalPrice', 'stock', 'purchaseUrl']) check(item[key] === null, `target product ${item.id} must keep unconfirmed ${key} null`);
  check(item.stockStatus === 'comingSoon', `target product ${item.id} must remain comingSoon`);
  await checkCatalogImage(item.gallery[0], [1600, 1600], 300 * 1024, `product ${item.id} cover`);
  await checkCatalogImage(item.gallery[1], [1600, 1100], 300 * 1024, `product ${item.id} use`);
  await checkCatalogImage(item.gallery[2], [1200, 1500], 250 * 1024, `product ${item.id} detail`);
}

const catalogFiles = await collectFiles(path.join(root, 'nal/assets/images/catalog'));
check(catalogFiles.length === 28, `expected exactly 28 catalog images, found ${catalogFiles.length}`);
for (const file of catalogFiles) {
  check(file.endsWith('.webp'), `catalog image must be WebP: ${path.relative(root, file)}`);
  check(/^[a-z0-9-]+\.webp$/.test(path.basename(file)), `catalog filename must use lowercase and hyphens: ${path.basename(file)}`);
}

for (const item of hosts) {
  for (const id of item.programIds) check(programIds.has(id), `host ${item.id} unknown program ${id}`);
  for (const id of item.contentIds) check(contentIds.has(id), `host ${item.id} unknown content ${id}`);
}
for (const item of content) {
  if (item.authorId) check(hostIds.has(item.authorId), `content ${item.id} unknown author ${item.authorId}`);
  for (const id of item.relatedProgramIds) check(programIds.has(id), `content ${item.id} unknown program ${id}`);
  for (const id of item.relatedProductIds) check(productIds.has(id), `content ${item.id} unknown product ${id}`);
}

for (const item of programs) {
  const relative = `nal/${item.type}/${item.slug}/index.html`;
  check((await exists(relative)) === item.published, `${relative} publication mismatch`);
}
for (const item of products) check((await exists(`nal/shop/${item.slug}/index.html`)) === item.published, `product ${item.slug} publication mismatch`);
for (const item of hosts) check((await exists(`nal/host/${item.slug}/index.html`)) === item.published, `host ${item.slug} publication mismatch`);
for (const item of content) check((await exists(`nal/note/${item.slug}/index.html`)) === item.published, `content ${item.slug} publication mismatch`);

const htmlFiles = await collectHtml(nalRoot);
check(htmlFiles.length >= 18, `expected at least 18 NAL pages, found ${htmlFiles.length}`);
const canonicals = new Set();
for (const file of htmlFiles) {
  const source = await readFile(file, 'utf8');
  const relative = path.relative(root, file);
  check(/<html lang="ko">/.test(source), `${relative} missing lang`);
  check(/<meta name="description" content="[^"]+">/.test(source), `${relative} missing description`);
  check(/<meta property="og:title"/.test(source), `${relative} missing og:title`);
  check(/<meta property="og:image" content="https:\/\/daily-coach-ing\.com\/[^\"]+\.(?:png|webp)">/.test(source), `${relative} missing same-origin OG image`);
  check(/<a class="nal-skip-link" href="#main-content">/.test(source), `${relative} missing skip link`);
  check(/<main id="main-content" data-page-root/.test(source), `${relative} missing main root`);
  const canonical = source.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
  check(Boolean(canonical), `${relative} missing canonical`);
  if (canonical) {
    check(!canonicals.has(canonical), `${relative} duplicate canonical ${canonical}`);
    canonicals.add(canonical);
  }
  for (const block of source.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(block[1]); } catch { failures.push(`${relative} invalid JSON-LD`); }
  }
}

const [css, runtime, sitemap, robots] = await Promise.all([
  readFile(path.join(root, 'nal/assets/css/nal.css'), 'utf8'),
  readFile(path.join(root, 'nal/assets/js/app.js'), 'utf8'),
  readFile(path.join(root, 'sitemap.xml'), 'utf8'),
  readFile(path.join(root, 'robots.txt'), 'utf8')
]);

for (const color of Object.values(site.designTokens.colors)) check(css.toUpperCase().includes(color.toUpperCase()), `CSS missing color token ${color}`);
check(css.includes(':focus-visible'), 'CSS missing focus-visible');
check(css.includes('prefers-reduced-motion'), 'CSS missing reduced-motion support');
check(css.includes('@media print'), 'CSS missing print styles');
check(
  css.includes('min-height: 44px') ||
    css.includes('min-block-size: 44px') ||
    /--nal-touch-target:\s*2\.75rem/.test(css),
  'CSS missing 44px touch target'
);
check(runtime.includes('localStorage'), 'runtime missing local wishlist/recently viewed');
check(runtime.includes('coverImageMobile') && runtime.includes('<picture'), 'runtime missing responsive catalog pictures');
check(runtime.includes('data-image-fallback'), 'runtime missing image failure fallback');
check(runtime.includes('nal-relation-grid'), 'runtime missing program-product relation module');
check(css.includes('.nal-curation-grid'), 'CSS missing curated home grid');
check(css.includes('.nal-product-gallery'), 'CSS missing product visual gallery');
check(css.includes('.nal-river-launch-hero'), 'CSS missing flowing river launch hero');
check(runtime.includes('FLOWING_RIVER_ID'), 'runtime missing flowing river official launch renderer');
check(runtime.includes('renderFlowingRiverDetail'), 'runtime missing flowing river detail renderer');
check(
  runtime.includes('/nal/data/') ||
    (/DATA_BASE\s*=\s*["']\/nal\/data["']/.test(runtime) && runtime.includes('fetch(`${DATA_BASE}/')),
  'runtime missing NAL data source'
);
check(!/checkout|payment success|결제 완료/i.test(runtime), 'runtime must not fake checkout completion');
check(robots.includes('Sitemap: https://daily-coach-ing.com/sitemap.xml'), 'robots missing sitemap URL');

for (const file of htmlFiles) {
  const source = await readFile(file, 'utf8');
  const canonical = source.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
  const noindex = /name="robots" content="noindex/i.test(source);
  if (canonical) check(noindex || sitemap.includes(`<loc>${canonical}</loc>`), `indexable ${canonical} missing from sitemap`);
  if (canonical) check(!noindex || !sitemap.includes(`<loc>${canonical}</loc>`), `noindex ${canonical} must not be in sitemap`);
}

const textCorpus = [JSON.stringify({ programs, products, hosts, content, site }), runtime].join('\n');
for (const phrase of ['날빛 프로그램', '날빛 아카이브', '날빛 도구실', '날빛 클래스', '날빛 코치', '날빛 모임', '날빛레터', '빛을 찾는 사람들', '밝힘·따뜻함·방향']) {
  check(!textCorpus.includes(phrase), `forbidden brand phrase found: ${phrase}`);
}
for (const phrase of ['치료한다', '진단한다', '우울증을 개선한다', '트라우마를 치유한다', '심리 문제를 해결한다']) {
  check(!textCorpus.includes(phrase), `forbidden efficacy claim found: ${phrase}`);
}

const flowingRiver = programs.find((item) => item.id === 'flowing-river-coach-community');
const flowingRiverCorpus = JSON.stringify({ flowingRiver, launches });
check(launches.items?.length === 1 && launches.items[0]?.id === 'flowing-river-coach-community', 'NOW OPEN must contain only flowing river');
check(!/25[–-]45/.test(flowingRiverCorpus), 'flowing river still contains the former age range');
check(!/mailto:|hello@daily-coach-ing\.com|이메일로/.test(flowingRiverCorpus), 'flowing river launch still contains email guidance');
check(flowingRiverCorpus.includes('daily_coach_ing'), 'flowing river launch missing Instagram DM path');
const flowingDetailHtml = await readFile(path.join(root, 'nal/gather/flowing-river-coaches/index.html'), 'utf8');
check(!/zoom\.us|참여코드\s*[:：]\s*\S+|open\.kakao\.com/.test(flowingDetailHtml), 'flowing river public page exposes a private meeting or chat value');

notes.push(`pages=${htmlFiles.length}`);
notes.push(`programs=${programs.length} (${programs.filter((x) => x.published).length} public)`);
notes.push(`products=${products.length} (${products.filter((x) => x.published).length} public)`);
notes.push(`hosts=${hosts.length} (${hosts.filter((x) => x.published).length} public)`);
notes.push(`content=${content.length} (${content.filter((x) => x.published).length} public)`);

if (failures.length) {
  console.error(`NAL QA failed (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

assert.equal(failures.length, 0);
console.log(`NAL QA passed: ${notes.join(', ')}`);
