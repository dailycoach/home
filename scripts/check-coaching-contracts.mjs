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

function checkScriptSyntax(relativePath) {
  try {
    new vm.Script(read(relativePath), { filename: relativePath });
  } catch (error) {
    fail(`${relativePath}: JavaScript 문법 오류 — ${error.message}`);
  }
}

function checkPageMetadata(relativePath) {
  const html = read(relativePath);
  assert(/<title>[^<]+<\/title>/i.test(html), `${relativePath}: title이 없습니다.`);
  assert(
    /<meta\s+name="description"\s+content="[^"]+"/i.test(html),
    `${relativePath}: meta description이 없습니다.`
  );
  assert(/href="\/"/.test(html), `${relativePath}: 홈 이동 링크가 없습니다.`);
}

function checkTemplateContracts() {
  const commonPath = 'coaching/contracts/templates/common.v1.json';
  const common = JSON.parse(read(commonPath));
  const expectedClauseIds = [
    'common.parties',
    'common.definition_and_purpose',
    'common.scope',
    'common.coach_responsibilities',
    'common.client_responsibilities',
    'common.sponsor_and_third_party',
    'common.goals',
    'common.sessions',
    'common.term',
    'common.fees_and_payment',
    'common.reschedule_lateness_no_show',
    'common.cancellation_and_refund',
    'common.confidentiality',
    'common.confidentiality_exceptions',
    'common.records',
    'common.online_technology',
    'common.recording',
    'common.ai_tools',
    'common.conflicts_and_multiple_roles',
    'common.no_guarantee',
    'common.amendments',
    'common.termination_and_withdrawal',
    'common.electronic_documents',
    'common.disputes',
    'common.privacy',
    'common.optional_consents',
    'common.electronic_signature'
  ];
  const clauseIds = common.clauses?.map((clause) => clause.id) ?? [];
  assert(
    JSON.stringify(clauseIds) === JSON.stringify(expectedClauseIds),
    `${commonPath}: 공통 27개 조항 ID와 순서가 명세와 다릅니다.`
  );
  const orders = common.clauses?.map((clause) => clause.order) ?? [];
  assert(new Set(orders).size === 27, `${commonPath}: 조항 order가 중복되었습니다.`);

  const requiredConsentKeys = [
    'session_recording',
    'ai_assisted_summary',
    'anonymized_case_use',
    'marketing_testimonial'
  ];
  const consents = common.optionalConsents ?? [];
  assert(
    JSON.stringify(consents.map((consent) => consent.key)) === JSON.stringify(requiredConsentKeys),
    `${commonPath}: 독립 선택 동의 4종 키가 명세와 다릅니다.`
  );
  for (const consent of consents) {
    assert(consent.required === false, `${commonPath}: ${consent.key}는 선택 동의여야 합니다.`);
    assert(consent.defaultAccepted === false, `${commonPath}: ${consent.key} 기본값은 false여야 합니다.`);
    assert(consent.independent === true, `${commonPath}: ${consent.key}는 독립 선택이어야 합니다.`);
    assert(Boolean(consent.consentTextVersion), `${commonPath}: ${consent.key} 동의 문구 버전이 없습니다.`);
    assert(consent.serviceAvailableWhenDeclined === true, `${commonPath}: ${consent.key} 거부 시 기본 서비스가 가능해야 합니다.`);
  }
  const aiConsent = consents.find((consent) => consent.key === 'ai_assisted_summary');
  assert(aiConsent?.enabled === false, `${commonPath}: AI 설정 미확정 기본값은 enabled=false여야 합니다.`);
  const marketing = consents.find((consent) => consent.key === 'marketing_testimonial');
  const marketingKeys = marketing?.subSelections?.map((selection) => selection.key) ?? [];
  assert(
    JSON.stringify(marketingKeys) === JSON.stringify([
      'disclose_name',
      'disclose_photo',
      'disclose_organization',
      'disclose_testimonial_text',
      'publication_channels',
      'publication_period'
    ]),
    `${commonPath}: 후기·홍보 하위 선택 6종이 분리되어야 합니다.`
  );

  for (const type of ['life', 'business', 'career']) {
    const templatePath = `coaching/contracts/templates/${type}.v1.json`;
    const template = JSON.parse(read(templatePath));
    assert(template.contractType === type, `${templatePath}: contractType이 ${type}이 아닙니다.`);
    assert(template.audience?.adultsOnly === true, `${templatePath}: 성인 전용 규칙이 없습니다.`);
    assert(template.audience?.minorUseBlocked === true, `${templatePath}: 미성년자 차단 규칙이 없습니다.`);
    const typeIds = template.clauses?.map((clause) => clause.id) ?? [];
    assert(typeIds.length > 0 && new Set(typeIds).size === typeIds.length, `${templatePath}: 유형 조항 ID가 누락되거나 중복됩니다.`);
  }

  const businessPath = 'coaching/contracts/templates/business.v1.json';
  const business = JSON.parse(read(businessPath));
  const prohibited = business.reportingPolicy?.defaultProhibited?.map((item) => item.key) ?? [];
  for (const key of ['session_transcript', 'session_notes', 'client_personal_statements']) {
    assert(prohibited.includes(key), `${businessPath}: 기본 공유 금지 항목 누락 — ${key}`);
  }
  assert(
    business.reportingPolicy?.defaultScope?.id === 'attendance_and_status_only',
    `${businessPath}: 기본 보고 범위는 출석·진행 여부만이어야 합니다.`
  );
  assert(
    business.signingRules?.requiredSignerRolesByMode?.sponsored_three_party?.join(',') === 'coach,client,sponsor',
    `${businessPath}: 3자 계약은 코치·고객·스폰서 서명을 모두 요구해야 합니다.`
  );
}

function checkSecurityBoundaries() {
  const sourcePaths = [
    'coaching/assets/coaching.js',
    'coaching/contracts/assets/api.js',
    'coaching/contracts/assets/contract-renderer.js',
    'coaching/contracts/assets/contract-validation.js',
    'coaching/contracts/assets/contract-admin.js',
    'coaching/contracts/assets/contract-sign.js'
  ];
  const availableSources = sourcePaths.filter((path) => existsSync(join(root, path)));
  const joined = availableSources.map((path) => read(path)).join('\n');
  assert(!/\blocalStorage\s*[.\[]/u.test(joined), '프런트엔드: LocalStorage 저장 코드가 있습니다.');
  assert(!/\bsessionStorage\s*[.\[]/u.test(joined), '프런트엔드: SessionStorage 저장 코드가 있습니다.');
  assert(!/\/v1\/invites\/\$\{|\/v1\/final-access\/\$\{/u.test(joined), '프런트엔드: 원본 토큰을 API URL path에 넣는 코드가 있습니다.');
  assert(!/(?:sk_live|sk_test|sk-proj)-[A-Za-z0-9_-]{12,}/u.test(joined), '프런트엔드: 비밀키 형태의 문자열이 감지되었습니다.');

  for (const relativePath of availableSources) checkScriptSyntax(relativePath);

  const apiSource = existsSync(join(root, 'coaching/contracts/assets/api.js'))
    ? read('coaching/contracts/assets/api.js')
    : '';
  assert(
    /body:\s*(?:mutationBody\()?\{\s*token:/u.test(apiSource),
    'api.js: 원본 초대 토큰은 POST body로 교환해야 합니다.'
  );
  assert(apiSource.includes('/v1/admin/session'), 'api.js: 최소 관리자 세션 확인 endpoint를 사용해야 합니다.');

  const migrationPath = 'workers/coaching-contract-api/migrations/0001_initial.sql';
  if (existsSync(join(root, migrationPath))) {
    const migration = read(migrationPath);
    for (const table of [
      'contracts',
      'contract_parties',
      'contract_versions',
      'contract_consents',
      'contract_invites',
      'contract_audit_events'
    ]) {
      assert(new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? ${table}\\b`, 'i').test(migration), `${migrationPath}: 필수 테이블 누락 — ${table}`);
    }
    assert(/token_hash\s+TEXT\s+NOT NULL/i.test(migration), `${migrationPath}: 초대 토큰 해시 필드가 없습니다.`);
    assert(/pin_hash\s+TEXT\s+NOT NULL/i.test(migration), `${migrationPath}: 확인번호 해시 필드가 없습니다.`);
    assert(/snapshot_hash\s+TEXT/i.test(migration), `${migrationPath}: 문서 해시 필드가 없습니다.`);
  }
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

  for (const pagePath of [
    'coaching/index.html',
    'coaching/contracts/index.html',
    'coaching/contracts/privacy/index.html',
    'coaching/contracts/coach/index.html',
    'coaching/contracts/sign/index.html',
    'coaching/contracts/complete/index.html'
  ]) {
    if (existsSync(join(root, pagePath))) checkPageMetadata(pagePath);
  }

  if ([
    'coaching/contracts/templates/common.v1.json',
    'coaching/contracts/templates/life.v1.json',
    'coaching/contracts/templates/business.v1.json',
    'coaching/contracts/templates/career.v1.json'
  ].every((path) => existsSync(join(root, path)))) {
    checkTemplateContracts();
  }
  checkSecurityBoundaries();
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
