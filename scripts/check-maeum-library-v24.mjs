import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const coreRoutes = ['', 'essays', 'news', 'library', 'apply', 'connect', 'me', 'gathering', 'privacy', 'terms', 'toss'];
const read = (relative) => readFile(path.join(root, relative), 'utf8');

async function walk(directory) {
  const values = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) values.push(...await walk(target));
    else values.push(target);
  }
  return values;
}

for (const route of coreRoutes) {
  const relative = route ? `maeum-library/${route}/index.html` : 'maeum-library/index.html';
  const html = await read(relative);
  assert.match(html, /<html lang="ko">/i, `${relative}: lang`);
  assert.match(html, /<meta name="viewport"/i, `${relative}: viewport`);
  assert.match(html, /<link rel="canonical"/i, `${relative}: canonical`);
  if (route !== 'news') assert.match(html, /본문 바로가기/i, `${relative}: skip link`);
}

const home = await read('maeum-library/index.html');
const sectionOrder = [
  'rooms-hero',
  'five-concepts',
  'essays-home',
  'simple-doors',
  'interpretation-notice',
].map((marker) => home.indexOf(marker));
assert.ok(sectionOrder.every((index) => index >= 0), 'home sections are complete');
assert.deepEqual(sectionOrder, [...sectionOrder].sort((left, right) => left - right), 'home IA order');
assert.equal((home.match(/<details class="concept-disclosure/g) || []).length, 5, 'five concepts');
assert.equal((home.match(/<details class="room-card"/g) || []).length, 25, 'all 25 rooms preserved');
for (const letter of ['a', 'b', 'c', 'd', 'e']) {
  assert.equal((home.match(new RegExp('id="room-' + letter + '\\d{2}"', 'g')) || []).length, 5, 'five rooms in each concept');
}
assert.match(home, /data-brunch-list/);
assert.doesNotMatch(home, /data-book-news|href="\/maeum-library\/news\/"/);
assert.match(home, /href="\/maeum-library\/toss\/"/);
assert.doesNotMatch(home, /minion\.toss\.im|intoss:\/\//);

const legacyRedirects = [
  'maeum-library/about/index.html',
  'maeum-library/app/index.html',
  'maeum-library/books/index.html',
  'maeum-library/columns/index.html',
  'maeum-library/mind/index.html',
  'maeum-library/stories/before-opening-a-book/index.html',
  'maeum-library/stories/name-the-feeling/index.html',
  'maeum-library/stories/reading-without-finishing/index.html',
  'maeum-library/stories/self-blame-and-next-action/index.html',
  'maeum-library/stories/words-in-relationships/index.html',
  'maeum-library/write/index.html',
];
for (const relative of legacyRedirects) {
  const html = await read(relative);
  assert.match(html, /\/maeum-library\//, `${relative}: points to current Maeum Library`);
  assert.doesNotMatch(html, /minion\.toss\.im|intoss:\/\//, `${relative}: no direct Toss entry`);
}

const apply = await read('maeum-library/apply/index.html');
for (const field of ['name="name"', 'name="email"', 'name="phone"', 'name="ageRange"', 'name="readingRhythm"', 'name="zoomPreference"', 'name="expectation"', 'name="favoriteLine"', 'name="consent"']) {
  assert.match(apply, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `application field ${field}`);
}
assert.doesNotMatch(apply, /minion\.toss\.im|intoss:\/\//);

const news = await read('maeum-library/news/index.html');
assert.match(news, /http-equiv="refresh"/);
assert.match(news, /\/maeum-library\/essays\//);

const essays = await read('maeum-library/essays/index.html');
assert.match(essays, /data-brunch-list/);
assert.match(essays, /href="\/maeum-library\/essays\/"/);
assert.doesNotMatch(essays, /data-news-search|data-book-news/);
const feed = JSON.parse(await read('maeum-library/assets/brunch-posts.json'));
assert.ok(Array.isArray(feed.items), 'feed snapshot has items array');
assert.match(await read('maeum-library/assets/essays.js'), /textContent/, 'essay cards render plain text');

const connect = await read('maeum-library/connect/index.html');
assert.match(connect, /웹 내 기록 열기/);
assert.match(connect, /href="\/maeum-library\/toss\/"/);
assert.doesNotMatch(connect, /minion\.toss\.im|intoss:\/\//);

const app = await read('maeum-library/assets/app.js');
assert.match(app, /https:\/\/maeum-api\.daily-coach-ing\.com/);
assert.match(app, /const TOSS_URL = '\/maeum-library\/toss\/'/);
assert.doesNotMatch(app, /minion\.toss\.im|intoss:\/\//);
assert.match(app, /\/api\/participant\/toss-exchange/);
assert.doesNotMatch(app, /localStorage|sessionStorage/);
assert.doesNotMatch(app, /console\./);

const tossGate = await read('maeum-library/toss/index.html');
assert.match(tossGate, /intoss:\/\/maum-library-entry/);
assert.match(tossGate, /https:\/\/minion\.toss\.im\/FZZaAaJp/);
assert.match(tossGate, /noindex,nofollow/);
assert.match(tossGate, /visibilitychange/);
assert.match(tossGate, /2200/);

const maeumFiles = await walk(path.join(root, 'maeum-library'));
for (const file of maeumFiles) {
  if (/\.(?:webp|png|jpg|jpeg|gif|pdf|woff2?)$/i.test(file)) continue;
  const text = await readFile(file, 'utf8');
  const relative = path.relative(root, file).replaceAll('\\', '/');
  if (relative === 'maeum-library/toss/index.html') continue;
  assert.equal(text.includes('minion.toss.im'), false, `${relative}: direct minion link must use Toss gateway`);
  assert.equal(text.includes('intoss://'), false, `${relative}: direct intoss link must use Toss gateway`);
}

const repositoryFiles = await walk(root);
let repositoryText = '';
for (const file of repositoryFiles) {
  const info = await stat(file);
  if (info.size > 2_000_000 || /\.(?:webp|png|jpg|jpeg|gif|pdf|woff2?)$/i.test(file)) continue;
  repositoryText += await readFile(file, 'utf8');
}
for (const retired of ['https://minion.toss.im/NRHKhVoA', 'https://minion.toss.im/7KNQwHZn']) {
  assert.equal(repositoryText.includes(retired), false, `retired Toss link is absent: ${retired}`);
}

const pages = JSON.parse(await read('pages.json'));
for (const url of ['/maeum-library/', '/maeum-library/essays/', '/maeum-library/library/', '/maeum-library/apply/', '/maeum-library/gathering/']) {
  assert.ok(pages.some((page) => page.url === url), `pages.json includes ${url}`);
}
const sitemap = await read('sitemap.xml');
for (const url of ['/maeum-library/', '/maeum-library/essays/', '/maeum-library/library/', '/maeum-library/apply/', '/maeum-library/gathering/']) {
  assert.match(sitemap, new RegExp(`https://daily-coach-ing\\.com${url.replaceAll('/', '\\/')}`), `sitemap includes ${url}`);
}
assert.doesNotMatch(sitemap, /\/maeum-library\/toss\//, 'Toss gateway stays noindex and out of sitemap');

for (const image of ['hero-reading-desk.webp', 'news-books.webp', 'news-culture.webp', 'news-literature.webp']) {
  assert.ok((await stat(path.join(root, 'maeum-library/assets/images', image))).size > 1_000, `${image} is present`);
}

console.log('마음서재 5개 콘셉트 · 브런치 전환 · Toss gateway 계약: PASS');
