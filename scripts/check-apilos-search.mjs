import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ORIGIN = 'https://daily-coach-ing.com';
const SITEMAP_URL = `${ORIGIN}/sitemap.xml`;
const failures = [];
const fail = (message) => failures.push(message);
const exists = (file) => fs.existsSync(path.join(ROOT, file));
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const pages = [
  ['/apilos/', 'apilos/index.html'],
  ['/apilos/center/', 'apilos/center/index.html'],
  ['/apilos/programs/', 'apilos/programs/index.html'],
  ['/apilos/programs/professional-academy/', 'apilos/programs/professional-academy/index.html'],
  ['/apilos/programs/youth-family-school/', 'apilos/programs/youth-family-school/index.html'],
  ['/apilos/programs/pastoral-coaching/', 'apilos/programs/pastoral-coaching/index.html'],
  ['/apilos/programs/professional-network/', 'apilos/programs/professional-network/index.html'],
  ['/apilos/programs/social-impact/', 'apilos/programs/social-impact/index.html'],
  ['/apilos/programs/research-publication/', 'apilos/programs/research-publication/index.html'],
  ['/apilos/archive/', 'apilos/archive/index.html'],
  ['/apilos/books/', 'apilos/books/index.html'],
  ['/apilos/books/sachungi-coaching-psychology/', 'apilos/books/sachungi-coaching-psychology/index.html'],
  ['/apilos/news/', 'apilos/news/index.html']
];

const parseAttributes = (tag) => {
  const attributes = new Map();
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gs)) {
    attributes.set(match[1].toLowerCase(), match[3]);
  }
  return attributes;
};

const tags = (html, tagName) => [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, 'gi'))].map((match) => ({
  raw: match[0],
  index: match.index,
  attributes: parseAttributes(match[0])
}));

const metaContent = (head, attribute, value) => {
  const match = tags(head, 'meta').find((tag) => tag.attributes.get(attribute) === value);
  return match?.attributes.get('content')?.trim() || '';
};

const pathToFile = (pathname) => {
  const clean = decodeURIComponent(pathname).replace(/^\/+/, '');
  if (!clean) return 'index.html';
  if (/\.[a-z0-9]{1,10}$/i.test(clean)) return clean;
  return clean.endsWith('/') ? `${clean}index.html` : `${clean}/index.html`;
};

const localReference = (reference, sourcePath) => {
  if (!reference || /^(?:#|mailto:|tel:|javascript:|data:)/i.test(reference)) return null;
  let resolved;
  try {
    resolved = new URL(reference, `${ORIGIN}${sourcePath}`);
  } catch {
    return null;
  }
  if (resolved.origin !== ORIGIN) return null;
  return { pathname: resolved.pathname, file: pathToFile(resolved.pathname) };
};

const parseRobotsGroups = (robots) => {
  const groups = [];
  let group = null;
  let hasRules = false;
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const directive = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (directive === 'user-agent') {
      if (!group || hasRules) {
        group = { agents: [], rules: [] };
        groups.push(group);
        hasRules = false;
      }
      group.agents.push(value.toLowerCase());
    } else if ((directive === 'allow' || directive === 'disallow') && group) {
      hasRules = true;
      group.rules.push({ directive, value });
    }
  }
  return groups;
};

const robotsBlocks = (groups, agent, pathname) => {
  const normalizedAgent = agent.toLowerCase();
  const exact = groups.filter((group) => group.agents.includes(normalizedAgent));
  const applicable = exact.length ? exact : groups.filter((group) => group.agents.includes('*'));
  const rules = applicable
    .flatMap((group) => group.rules)
    .filter((rule) => rule.value && pathname.startsWith(rule.value.replace(/\*.*$/, '')))
    .sort((a, b) => b.value.length - a.value.length || (a.directive === 'allow' ? -1 : 1));
  return rules[0]?.directive === 'disallow';
};

if (!exists('robots.txt')) {
  fail('robots.txt: file missing');
} else {
  const robots = read('robots.txt');
  if (!new RegExp(`^Sitemap:\\s*${SITEMAP_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'im').test(robots)) {
    fail(`robots.txt: missing exact sitemap declaration ${SITEMAP_URL}`);
  }
  const groups = parseRobotsGroups(robots);
  for (const agent of ['Googlebot', 'Yeti']) {
    if (robotsBlocks(groups, agent, '/apilos/')) fail(`robots.txt: ${agent} is blocked from /apilos/`);
  }
}

if (!exists('sitemap.xml')) {
  fail('sitemap.xml: file missing');
} else {
  const sitemap = read('sitemap.xml');
  const entries = [...sitemap.matchAll(/<url>\s*([\s\S]*?)\s*<\/url>/gi)].map((match) => {
    const block = match[1];
    return {
      loc: block.match(/<loc>\s*([^<]+?)\s*<\/loc>/i)?.[1]?.trim() || '',
      lastmod: block.match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/i)?.[1]?.trim() || ''
    };
  });
  const counts = new Map();
  for (const entry of entries) counts.set(entry.loc, (counts.get(entry.loc) || 0) + 1);
  for (const [url, count] of counts) if (count > 1) fail(`sitemap.xml: duplicate URL ${url}`);

  for (const [publicPath] of pages) {
    const expected = `${ORIGIN}${publicPath}`;
    if (counts.get(expected) !== 1) fail(`sitemap.xml: expected exactly one ${expected}`);
  }

  const forbiddenSegments = new Set(['private', 'staging', 'preview', 'dev', 'test', 'testing', 'qa']);
  for (const entry of entries) {
    let url;
    try {
      url = new URL(entry.loc);
    } catch {
      fail(`sitemap.xml: invalid URL ${entry.loc || '(empty loc)'}`);
      continue;
    }
    if (url.origin !== ORIGIN || url.protocol !== 'https:') fail(`sitemap.xml: non-production HTTPS URL ${entry.loc}`);
    if (url.search || url.hash) fail(`sitemap.xml: URL contains query or fragment ${entry.loc}`);
    const segments = url.pathname.toLowerCase().split('/').filter(Boolean);
    if (segments.some((segment) => forbiddenSegments.has(segment)) || /__(?:qa|search|test)/i.test(url.pathname)) {
      fail(`sitemap.xml: private/test/staging-like URL exposed ${entry.loc}`);
    }
    if (entry.lastmod && !/^\d{4}-\d{2}-\d{2}$/.test(entry.lastmod)) fail(`sitemap.xml: invalid lastmod ${entry.loc} (${entry.lastmod})`);
    if (url.origin === ORIGIN && !exists(pathToFile(url.pathname))) fail(`sitemap.xml: local target missing for ${entry.loc}`);
  }
}

const inboundLinks = new Set();
for (const [publicPath, file] of pages) {
  if (!exists(file)) {
    fail(`${file}: public page file missing`);
    continue;
  }
  const html = read(file);
  const headMatch = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  const head = headMatch?.[1] || '';
  if (!head) fail(`${file}: head missing`);

  const title = head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
  if (!title) fail(`${file}: title missing or empty`);
  if (!metaContent(head, 'name', 'description')) fail(`${file}: meta description missing or empty`);

  const robots = metaContent(head, 'name', 'robots');
  if (/\bnoindex\b/i.test(robots)) fail(`${file}: public page contains noindex`);

  const canonicals = tags(head, 'link')
    .filter((tag) => (tag.attributes.get('rel') || '').toLowerCase().split(/\s+/).includes('canonical'))
    .map((tag) => tag.attributes.get('href'));
  const expectedUrl = `${ORIGIN}${publicPath}`;
  if (canonicals.length !== 1) fail(`${file}: expected one canonical, found ${canonicals.length}`);
  else if (canonicals[0] !== expectedUrl) fail(`${file}: canonical mismatch (${canonicals[0]} !== ${expectedUrl})`);

  for (const property of ['og:title', 'og:description', 'og:url', 'og:image']) {
    const value = metaContent(head, 'property', property);
    if (!value) fail(`${file}: ${property} missing or empty`);
    if (property === 'og:url' && value !== expectedUrl) fail(`${file}: og:url mismatch (${value} !== ${expectedUrl})`);
    if (property === 'og:image' && value && !value.startsWith('https://')) fail(`${file}: og:image must use HTTPS`);
  }
  if (!metaContent(head, 'name', 'twitter:card')) fail(`${file}: twitter:card missing or empty`);

  const verificationNames = ['google-site-verification', 'naver-site-verification'];
  for (const verificationName of verificationNames) {
    const matching = tags(html, 'meta').filter((tag) => tag.attributes.get('name') === verificationName);
    for (const meta of matching) {
      const value = meta.attributes.get('content')?.trim() || '';
      if (meta.index > (headMatch?.index ?? -1) + (headMatch?.[0]?.length ?? 0)) fail(`${file}: ${verificationName} meta is outside head`);
      if (value.length < 12 || /(?:placeholder|actual[_ -]?token|xxxx|your[_ -]?token|todo|change\s*me)/i.test(value)) {
        fail(`${file}: ${verificationName} contains an empty or placeholder token`);
      }
    }
  }

  const jsonLdBlocks = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attributes = parseAttributes(match[1]);
    if ((attributes.get('type') || '').toLowerCase() !== 'application/ld+json') continue;
    try {
      jsonLdBlocks.push(JSON.parse(match[2]));
    } catch (error) {
      fail(`${file}: malformed JSON-LD (${error.message})`);
    }
  }
  if (publicPath === '/apilos/') {
    const organizations = jsonLdBlocks.flatMap((value) => Array.isArray(value) ? value : [value]);
    const organization = organizations.find((value) => ['Organization', 'EducationalOrganization'].includes(value?.['@type']));
    if (!organization) fail(`${file}: Organization/EducationalOrganization JSON-LD missing`);
    else {
      if (organization.name !== '글로벌미래교육원 상담코칭센터') fail(`${file}: JSON-LD organization name mismatch`);
      if (organization.url !== expectedUrl) fail(`${file}: JSON-LD organization URL mismatch`);
    }
  }

  const visibleRoot = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || '';
  const visibleText = visibleRoot
    .replace(/<(?:script|style|noscript)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript)>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (visibleText.length < 100) fail(`${file}: insufficient core text without JavaScript`);

  for (const tag of tags(html, '(?:a|link|script|img|source)')) {
    const reference = tag.attributes.get('href') || tag.attributes.get('src') || tag.attributes.get('srcset');
    if (!reference || reference.includes(',')) continue;
    const local = localReference(reference, publicPath);
    if (local && !exists(local.file)) fail(`${file}: broken internal URL ${reference} -> ${local.file}`);
  }
  for (const anchor of tags(html, 'a')) {
    const local = localReference(anchor.attributes.get('href'), publicPath);
    if (local) inboundLinks.add(local.pathname);
  }
}

for (const [publicPath] of pages) {
  if (!inboundLinks.has(publicPath)) fail(`${publicPath}: no inbound link from APILOS public HTML`);
}

if (!exists('404.html')) {
  fail('404.html: root custom 404 missing');
} else {
  const html = read('404.html');
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '';
  const robots = metaContent(head, 'name', 'robots');
  if (!/\bnoindex\b/i.test(robots) || !/\bfollow\b/i.test(robots)) fail('404.html: expected noindex,follow');
}

console.log(`APILOS search QA: ${pages.length} public pages, ${failures.length} failures`);
for (const message of failures) console.error(`FAIL: ${message}`);
if (failures.length) process.exit(1);
