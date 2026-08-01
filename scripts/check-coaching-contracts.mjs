import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const routesOnly = process.argv.includes('--routes-only');
const errors = [];
const warnings = [];

function read(relativePath) {
  return readFileSync(join(root, relativePath), 'utf8');
}

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function extractRouteMap(html, relativePath) {
  const match = html.match(
    /const\s+DAILYCOACHING_ROUTES\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\);/
  );
  if (!match) {
    fail(`${relativePath}: DAILYCOACHING_ROUTES 객체를 찾지 못했습니다.`);
    return { keys: [], map: new Map(), duplicates: [] };
  }

  const keys = [];
  const map = new Map();
  const duplicates = [];
  const propertyPattern = /^\s*([A-Za-z_$][\w$]*)\s*:\s*(['"])(.*?)\2\s*,?\s*$/gm;

  for (const property of match[1].matchAll(propertyPattern)) {
    const [, key, , value] = property;
    if (map.has(key)) duplicates.push(key);
    keys.push(key);
    map.set(key, value);
  }

  if (keys.length === 0) {
    fail(`${relativePath}: 라우트 객체에서 정적 라우트 키를 읽지 못했습니다.`);
  }

  return { keys, map, duplicates };
}

function extractDataRoutes(html) {
  const routes = [];
  const pattern = /\bdata-route\s*=\s*(['"])([^'"]+)\1/g;
  for (const match of html.matchAll(pattern)) routes.push(match[2]);
  return routes;
}

function extractAttribute(tag, attribute) {
  const pattern = new RegExp(`\\b${attribute}\\s*=\\s*(['"])([^'"]+)\\1`, 'i');
  return tag.match(pattern)?.[2] ?? null;
}

function checkRouteContract(relativePath) {
  const html = read(relativePath);
  const dataRoutes = extractDataRoutes(html);
  const routeKeys = new Set(dataRoutes);
  const { keys, map, duplicates } = extractRouteMap(html, relativePath);
  const missing = [...routeKeys].filter((key) => !map.has(key)).sort();
  const unused = [...new Set(keys)].filter((key) => !routeKeys.has(key)).sort();

  if (missing.length) {
    fail(`${relativePath}: data-route 대응 키 누락 — ${missing.join(', ')}`);
  }
  if (duplicates.length) {
    fail(`${relativePath}: DAILYCOACHING_ROUTES 중복 키 — ${[...new Set(duplicates)].join(', ')}`);
  }
  if (unused.length) {
    warn(`${relativePath}: 사용되지 않는 라우트 키 — ${unused.join(', ')}`);
  }

  const hrefMismatches = [];
  for (const anchor of html.matchAll(/<a\b[^>]*>/gi)) {
    const tag = anchor[0];
    const routeKey = extractAttribute(tag, 'data-route');
    if (!routeKey || !map.has(routeKey)) continue;
    const href = extractAttribute(tag, 'href');
    if (href !== map.get(routeKey)) {
      hrefMismatches.push(`${routeKey}: href=${href ?? '(없음)'}, route=${map.get(routeKey)}`);
    }
  }
  if (hrefMismatches.length) {
    fail(`${relativePath}: href와 라우트 값 불일치 — ${hrefMismatches.join(' | ')}`);
  }

  const categoryValues = [...html.matchAll(/\bdata-category\s*=\s*(['"])([^'"]+)\1/g)].map(
    (match) => match[2]
  );
  const duplicateCategories = categoryValues.filter(
    (value, index) => categoryValues.indexOf(value) !== index
  );
  if (duplicateCategories.length) {
    fail(`${relativePath}: 전체 메뉴 data-category 중복 — ${[...new Set(duplicateCategories)].join(', ')}`);
  }

  return { html, dataRoutes, keys, unused };
}

function checkInlineScriptSyntax(relativePath) {
  const html = read(relativePath);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];

  scripts.forEach(([, attributes, source], index) => {
    const type = extractAttribute(`<script ${attributes}>`, 'type');
    if (type && !['text/javascript', 'application/javascript'].includes(type)) return;
    try {
      new vm.Script(source, { filename: `${relativePath}#inline-script-${index + 1}` });
    } catch (error) {
      fail(`${relativePath}: 인라인 JavaScript 문법 오류 — ${error.message}`);
    }
  });
}

const homepage = checkRouteContract('index-source-disc.html');
const loader = read('index.html');
const company = read('company/index.html');
const coach = read('coach/index.html');

const requiredHomepageFragments = [
  'data-category="coaching"',
  'data-route="coachingGuide"',
  'data-route="coachingContracts"',
  'data-route="flourishAwareness"',
  'data-route="disc16"',
  'data-route="disc16Youth"',
  'data-route="careerDeductionGame"',
  'data-route="coachingFlexMove"',
  'data-route="valueScene"',
  'data-route="operator"'
];

for (const fragment of requiredHomepageFragments) {
  assert(homepage.html.includes(fragment), `index-source-disc.html: 필수 통합 항목 누락 — ${fragment}`);
}

assert(
  loader.includes("fetch('/index-source-disc.html?v=20260801-coaching-v1'"),
  'index.html: 코칭 시스템 캐시 버전이 적용된 원본 fetch를 찾지 못했습니다.'
);
for (const forbidden of [
  'replaceAll(anchor',
  'desktopActivityAnchor',
  'panelActivityAnchor',
  'operatorFooterLink',
  'careerGameUrl'
]) {
  assert(!loader.includes(forbidden), `index.html: 제거해야 할 문자열 치환 코드가 남아 있습니다 — ${forbidden}`);
}

assert(
  count(company, /<a\s+href="\/coaching\/">코칭안내<\/a>/g) >= 2,
  'company/index.html: 상단 메뉴와 모바일 접근 가능한 푸터에 코칭안내 링크가 모두 필요합니다.'
);
assert(
  count(coach, /<a\s+href="\/coaching\/">코칭안내<\/a>/g) >= 2,
  'coach/index.html: 상단 메뉴와 푸터 또는 빠른 이동 영역에 코칭안내 링크가 모두 필요합니다.'
);

for (const relativePath of [
  'index.html',
  'index-source-disc.html',
  'company/index.html',
  'coach/index.html'
]) {
  checkInlineScriptSyntax(relativePath);
}

let pages;
try {
  pages = JSON.parse(read('pages.json'));
  assert(Array.isArray(pages), 'pages.json: 최상위 값은 배열이어야 합니다.');
} catch (error) {
  fail(`pages.json: JSON.parse 실패 — ${error.message}`);
}

if (Array.isArray(pages)) {
  const requiredPages = new Map([
    ['/coaching/', '코칭안내'],
    ['/coaching/contracts/', '코칭계약']
  ]);
  const urls = pages.map((page) => page?.url).filter(Boolean);
  const duplicateUrls = urls.filter((url, index) => urls.indexOf(url) !== index);
  if (duplicateUrls.length) {
    fail(`pages.json: 중복 URL — ${[...new Set(duplicateUrls)].join(', ')}`);
  }
  for (const [url, title] of requiredPages) {
    const page = pages.find((candidate) => candidate?.url === url);
    assert(page, `pages.json: ${url} 항목이 없습니다.`);
    if (page) {
      assert(page.title === title, `pages.json: ${url} 제목은 "${title}"이어야 합니다.`);
      assert(page.category === 'coaching', `pages.json: ${url} category는 coaching이어야 합니다.`);
    }
  }
}

const requiredPaths = [
  '.gitignore',
  'coaching/index.html',
  'coaching/assets/coaching.css',
  'coaching/assets/coaching.js',
  'coaching/contracts/index.html',
  'coaching/contracts/privacy/index.html',
  'coaching/contracts/coach/index.html',
  'coaching/contracts/sign/index.html',
  'coaching/contracts/complete/index.html',
  'coaching/contracts/assets/contracts.css',
  'coaching/contracts/assets/api.js',
  'coaching/contracts/assets/contract-renderer.js',
  'coaching/contracts/assets/contract-validation.js',
  'coaching/contracts/assets/contract-admin.js',
  'coaching/contracts/assets/contract-sign.js',
  'coaching/contracts/templates/common.v1.json',
  'coaching/contracts/templates/life.v1.json',
  'coaching/contracts/templates/business.v1.json',
  'coaching/contracts/templates/career.v1.json',
  'workers/coaching-contract-api/package.json',
  'workers/coaching-contract-api/wrangler.toml',
  'workers/coaching-contract-api/.env.example',
  'workers/coaching-contract-api/src/index.ts',
  'workers/coaching-contract-api/src/auth.ts',
  'workers/coaching-contract-api/src/crypto.ts',
  'workers/coaching-contract-api/src/contracts.ts',
  'workers/coaching-contract-api/src/documents.ts',
  'workers/coaching-contract-api/src/validation.ts',
  'workers/coaching-contract-api/src/audit.ts',
  'workers/coaching-contract-api/migrations/0001_initial.sql',
  'workers/coaching-contract-api/README.md'
];

if (!routesOnly) {
  const missingPaths = requiredPaths.filter((relativePath) => !existsSync(join(root, relativePath)));
  if (missingPaths.length) {
    fail(`신규 필수 경로 누락 — ${missingPaths.join(', ')}`);
  }

  for (const templatePath of requiredPaths.filter((path) => path.endsWith('.json'))) {
    if (!existsSync(join(root, templatePath))) continue;
    try {
      JSON.parse(read(templatePath));
    } catch (error) {
      fail(`${templatePath}: JSON.parse 실패 — ${error.message}`);
    }
  }
} else {
  warn('--routes-only: 다른 작업군의 신규 필수 경로 검사를 건너뛰었습니다. 최종 QA에서는 옵션 없이 실행하세요.');
}

const shownRoot = relative(process.cwd(), root) || '.';
console.log(`코칭안내·코칭계약 구조 QA (${shownRoot})`);
console.log(`- data-route 사용: ${new Set(homepage.dataRoutes).size}개 키 / ${homepage.dataRoutes.length}개 요소`);
console.log(`- DAILYCOACHING_ROUTES: ${homepage.keys.length}개 키`);
console.log(`- 사용되지 않는 라우트 키: ${homepage.unused.length ? homepage.unused.join(', ') : '없음'}`);
console.log(`- pages.json: ${Array.isArray(pages) ? `${pages.length}개 항목 파싱` : '파싱 실패'}`);
console.log(`- 신규 필수 경로 검사: ${routesOnly ? '건너뜀(--routes-only)' : `${requiredPaths.length}개`}`);

for (const message of warnings) console.warn(`WARN: ${message}`);
for (const message of errors) console.error(`FAIL: ${message}`);

if (errors.length) {
  console.error(`QA 실패: ${errors.length}건`);
  process.exitCode = 1;
} else {
  console.log('QA 통과');
}
