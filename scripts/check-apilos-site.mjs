import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const failures = [];
const warnings = [];
const fail = (msg) => failures.push(msg);
const warn = (msg) => warnings.push(msg);
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const pages = [
  'apilos/index.html',
  'apilos/center/index.html',
  'apilos/programs/index.html',
  'apilos/programs/professional-academy/index.html',
  'apilos/programs/youth-family-school/index.html',
  'apilos/programs/pastoral-coaching/index.html',
  'apilos/programs/professional-network/index.html',
  'apilos/programs/social-impact/index.html',
  'apilos/programs/research-publication/index.html',
  'apilos/archive/index.html',
  'apilos/books/index.html',
  'apilos/books/sachungi-coaching-psychology/index.html',
  'apilos/news/index.html',
  'apilos/404/index.html'
];

const mustContain = (html, needle, file, label = needle) => {
  if (!html.includes(needle)) fail(`${file}: missing ${label}`);
};

const localTarget = (url) => {
  if (!url.startsWith('/')) return null;
  const clean = url.split('#')[0].split('?')[0];
  if (!clean || clean === '/') return 'index.html';
  const rel = clean.replace(/^\//, '');
  if (/\.[a-z0-9]{1,8}$/i.test(rel)) return rel;
  return rel.endsWith('/') ? `${rel}index.html` : `${rel}/index.html`;
};

for (const file of pages) {
  if (!exists(file)) { fail(`${file}: file missing`); continue; }
  const html = read(file);
  mustContain(html, '<html lang="ko"', file, 'lang=ko');
  mustContain(html, 'name="viewport"', file, 'viewport meta');
  mustContain(html, '<title>', file, 'title');
  mustContain(html, 'name="description"', file, 'description meta');
  mustContain(html, '/apilos/favicon.svg', file, 'favicon');
  mustContain(html, '/apilos/app.js', file, 'global app.js');

  if (!file.includes('/404/')) {
    mustContain(html, 'rel="canonical"', file, 'canonical');
    mustContain(html, 'property="og:title"', file, 'og:title');
    mustContain(html, 'property="og:description"', file, 'og:description');
    mustContain(html, 'property="og:url"', file, 'og:url');
    mustContain(html, 'property="og:image"', file, 'og:image');
    mustContain(html, 'name="twitter:card"', file, 'twitter:card');
  }

  if (/href="\/apilos\/programs\/"[^>]*>\s*프로그램\s*</.test(html) || /<span>프로그램<\/span>/.test(html)) {
    fail(`${file}: stale navigation label '프로그램'`);
  }
  if (/\/apilos\/assets\/[^"')\s]+\.jpg\b/i.test(html)) fail(`${file}: active JPG reference found; use WebP`);

  const refs = [...html.matchAll(/(?:href|src)=["']([^"']+)["']/g)].map(m => m[1]);
  for (const ref of refs) {
    const target = localTarget(ref);
    if (target && !exists(target)) fail(`${file}: broken internal reference ${ref} -> ${target}`);
  }

  for (const m of html.matchAll(/<a\b([^>]*)>/gi)) {
    const attrs = m[1];
    if (/target=["']_blank["']/i.test(attrs) && !/rel=["'][^"']*noopener/i.test(attrs)) {
      fail(`${file}: target=_blank without rel=noopener`);
    }
  }
}

if (!exists('404.html')) fail('root 404.html missing (GitHub Pages custom 404 gate)');
if (exists('apilos/archive/index-v2.html')) fail('staging file apilos/archive/index-v2.html still present');
if (!exists('apilos/qa.css')) fail('apilos/qa.css missing');

const responsiveCss = [
  'apilos/style.css','apilos/qa.css','apilos/ecosystem.css','apilos/business.css','apilos/evidence.css',
  'apilos/center/center.css','apilos/archive/archive.css','apilos/books/books.css','apilos/news/news.css'
];
for (const file of responsiveCss) {
  if (!exists(file)) { fail(`${file}: stylesheet missing`); continue; }
  if (!read(file).includes('@media')) warn(`${file}: no responsive media query found`);
}
if (!read('apilos/qa.css').includes('orientation:landscape')) fail('apilos/qa.css: landscape hardening missing');
if (!read('apilos/qa.css').includes('prefers-reduced-motion')) fail('apilos/qa.css: reduced-motion hardening missing');

const webps = [
  'apilos/assets/career-camp.webp','apilos/assets/iin-classroom.webp','apilos/assets/iin-living-lab.webp',
  'apilos/assets/stress-lecture.webp','apilos/assets/woosung-living-lab.webp','apilos/assets/sachungi-coaching-psychology-cover.webp'
];
for (const file of webps) if (!exists(file)) fail(`${file}: expected visual asset missing`);

if (exists('apilos/news/blog.json')) {
  try {
    const feed = JSON.parse(read('apilos/news/blog.json'));
    const posts = Array.isArray(feed.posts) ? feed.posts : [];
    if (posts.length < 4) fail('blog.json: fewer than 4 RSS posts');
    if (posts.length > 16) fail('blog.json: more than 16 RSS posts');
    for (let i = 1; i < posts.length; i++) if ((posts[i-1].publishedAt || 0) < (posts[i].publishedAt || 0)) fail('blog.json: posts not newest-first');
    for (const post of posts) if (!String(post.url || '').startsWith('https://blog.naver.com/')) fail(`blog.json: non-Naver or non-HTTPS URL ${post.url}`);
  } catch (e) { fail(`blog.json: invalid JSON (${e.message})`); }
} else fail('apilos/news/blog.json missing');

if (exists('apilos/assets/ycc-logo.webp')) {
  const b = fs.readFileSync(path.join(ROOT,'apilos/assets/ycc-logo.webp'));
  if (b.subarray(0,4).toString('ascii') !== 'RIFF' || b.subarray(8,12).toString('ascii') !== 'WEBP') fail('ycc-logo.webp: invalid WebP header');
} else warn('ycc-logo.webp not materialized yet; one-shot workflow should create it');

console.log(`APILOS QA: ${pages.length} pages, ${failures.length} failures, ${warnings.length} warnings`);
for (const w of warnings) console.log(`WARN: ${w}`);
for (const f of failures) console.error(`FAIL: ${f}`);
if (failures.length) process.exit(1);
