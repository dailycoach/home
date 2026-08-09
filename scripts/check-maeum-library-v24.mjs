import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const coreRoutes = ['', 'news', 'library', 'apply', 'connect', 'me', 'gathering', 'privacy', 'terms'];
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
  assert.match(html, /본문 바로가기/i, `${relative}: skip link`);
}

const home = await read('maeum-library/index.html');
const sectionOrder = [
  'v24-hero',
  'news-home',
  'ONE LINE TALK · RECORD',
  'HOW IT WORKS · READ',
  'participation-band',
  'gathering-card',
  'final-cta',
].map((marker) => home.indexOf(marker));
assert.ok(sectionOrder.every((index) => index >= 0), 'home sections are complete');
assert.deepEqual(sectionOrder, [...sectionOrder].sort((left, right) => left - right), 'home IA order');
assert.doesNotMatch(home, /읽을거리|마음읽기 전체|책읽기|코치의 서재/);
assert.match(home, /data-book-news/);
assert.match(home, /data-home-entries/);

for (const relative of [
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
]) {
  const html = await read(relative);
  const navigation = html.match(/<nav class="mediaNav"[\s\S]*?<\/nav>/)?.[0] || '';
  assert.doesNotMatch(navigation, /마음읽기|책읽기|코치의 서재/, `${relative}: archive navigation`);
  for (const href of ['/maeum-library/', '/maeum-library/news/', '/maeum-library/library/', '/maeum-library/gathering/']) {
    assert.match(navigation, new RegExp(href.replaceAll('/', '\\/')), `${relative}: final navigation ${href}`);
  }
}

const apply = await read('maeum-library/apply/index.html');
for (const field of ['name="name"', 'name="email"', 'name="phone"', 'name="ageRange"', 'name="readingRhythm"', 'name="zoomPreference"', 'name="expectation"', 'name="favoriteLine"', 'name="consent"']) {
  assert.match(apply, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `application field ${field}`);
}
assert.match(apply, /연락 및 참여자 식별용 이메일/);
assert.doesNotMatch(apply, /ChatGPT 로그인에 사용하는 이메일/);

const news = await read('maeum-library/news/index.html');
assert.match(news, /후보 수집은 자동으로/);
assert.match(news, /공개 결정은 사람의 판단으로/);
assert.match(news, /data-news-search/);
assert.match(news, /data-news-filters/);

const connect = await read('maeum-library/connect/index.html');
assert.match(connect, /웹 내 기록 열기/);
assert.doesNotMatch(connect, /data-connect-form|참여 코드 8자리/);
const write = await read('maeum-library/write/index.html');
assert.match(write, /새 한줄톡은[\s\S]*토스 마음서재/);
assert.doesNotMatch(write, /<form|data-entry-form/);

const app = await read('maeum-library/assets/app.js');
assert.match(app, /https:\/\/maeum-api\.daily-coach-ing\.com/);
assert.match(app, /https:\/\/minion\.toss\.im\/NRHKhVoA/);
assert.match(app, /\/api\/participant\/toss-exchange/);
assert.doesNotMatch(app, /\/api\/participant\/connect/);
assert.doesNotMatch(app, /\/api\/participant\/entries['"`]/);
assert.doesNotMatch(app, /localStorage|sessionStorage/);
assert.doesNotMatch(app, /console\./);
assert.match(app, /article\.id = `news-\$\{anchor\}`/);

const pages = JSON.parse(await read('pages.json'));
for (const url of ['/maeum-library/', '/maeum-library/news/', '/maeum-library/library/', '/maeum-library/apply/', '/maeum-library/gathering/']) {
  assert.ok(pages.some((page) => page.url === url), `pages.json includes ${url}`);
}
const sitemap = await read('sitemap.xml');
for (const url of ['/maeum-library/', '/maeum-library/news/', '/maeum-library/library/', '/maeum-library/apply/', '/maeum-library/gathering/']) {
  assert.match(sitemap, new RegExp(`https://daily-coach-ing\\.com${url.replaceAll('/', '\\/')}`), `sitemap includes ${url}`);
}

const repositoryFiles = await walk(root);
let repositoryText = '';
for (const file of repositoryFiles) {
  const info = await stat(file);
  if (info.size > 2_000_000 || /\.(?:webp|png|jpg|jpeg|gif|pdf|woff2?)$/i.test(file)) continue;
  repositoryText += await readFile(file, 'utf8');
}
const retiredTossLink = ['https://minion.toss.im/', '7KNQw', 'HZn'].join('');
assert.equal(repositoryText.includes(retiredTossLink), false, 'retired Toss link is absent');

for (const image of ['hero-reading-desk.webp', 'news-books.webp', 'news-culture.webp', 'news-literature.webp']) {
  assert.ok((await stat(path.join(root, 'maeum-library/assets/images', image))).size > 1_000, `${image} is present`);
}

console.log('마음서재 v2.4 static contract: PASS');
