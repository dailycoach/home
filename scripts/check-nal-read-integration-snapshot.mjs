import assert from 'node:assert/strict';
import { readFile, readdir, stat, access } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const manifest = JSON.parse(await readFile('integration/nal-stabilization-03/source-manifest.json', 'utf8'));
assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.customerReleaseApproved, false);
assert.equal(manifest.sourceReadFiles.length, 88, 'expected 88 current READ source paths');
assert.equal(manifest.preservedBaseFiles.length, 130, 'expected 130 untouched base NAL paths');

const errors = [];
const check = (value, message) => { if (!value) errors.push(message); };
const text = (p) => readFile(path.resolve(root, p), 'utf8');
const exists = async (p) => { try { await access(path.resolve(root, p)); return true; } catch { return false; } };
const blobSha = bytes => createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
const checkBlob = async ({ path: filename, sha }, category) => {
  if (!/^nal\/[a-zA-Z0-9_./-]+$/.test(filename) || filename.includes('..')) {
    errors.push(`${category}: disallowed path ${filename}`);
    return;
  }
  try {
    const bytes = await readFile(path.resolve(root, filename));
    check(blobSha(bytes) === sha, `${category}: bytes changed ${filename}`);
  } catch {
    errors.push(`${category}: missing ${filename}`);
  }
};

const imported = new Set(manifest.sourceReadFiles.map(x=>x.path));
const protectedFiles = new Set(manifest.preservedBaseFiles.map(x=>x.path));
check(imported.size === 88, 'READ manifest paths duplicated');
check(protectedFiles.size === 130, 'protected storefront manifest paths duplicated');
for(const filename of imported) check(!protectedFiles.has(filename), `protected storefront overwritten ${filename}`);
check(imported.has(manifest.onlyBaseFileReplaced), 'MY NAL account home replacement untracked');
for (const x of manifest.sourceReadFiles) await checkBlob(x, 'READ source');
for (const x of manifest.preservedBaseFiles) await checkBlob(x, 'protected base');

async function allFiles(dir, found = []) {
  for (const entry of await readdir(dir, { withFileTypes:true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await allFiles(full, found);
    else if (entry.isFile()) found.push(path.relative(root, full).split(path.sep).join('/'));
  }
  return found;
}
const actual = new Set(await allFiles(path.resolve(root, 'nal')));
// P6: only these NEW staged commerce-lite paths are outside the original
// 88 READ / 130 preserved NAL snapshots. No legacy asset may be overwritten.
const commerceLitePaths = Object.freeze([
  'nal/assets/css/nal-commerce-lite.css',
  'nal/assets/js/nal-commerce-lite.js',
  'nal/data/commerce-lite.release.json',
  'nal/commerce/index.html',
  'nal/commerce/complete/index.html',
  'nal/commerce/claim/index.html'
]);
for(const filename of commerceLitePaths) {
  check(!imported.has(filename) && !protectedFiles.has(filename),
    'commerce-lite path overlaps original READ or protected NAL source: '+filename);
  check(actual.has(filename),'staged commerce-lite path missing: '+filename);
}
// P7: add ONLY the four private Commerce Admin source assets on this Draft
// stack. READ 88, protected storefront 130 and original Commerce Lite 6
// retain unchanged Git blob SHA verification and do not acquire privileges.
const commerceAdminPaths = Object.freeze([
  'nal/commerce/admin/index.html',
  'nal/assets/css/nal-commerce-admin.css',
  'nal/assets/js/nal-commerce-admin.js',
  'nal/data/commerce-admin.release.json'
]);
for(const filename of commerceAdminPaths){
  check(!imported.has(filename)&&!protectedFiles.has(filename)
    &&!commerceLitePaths.includes(filename),
    'Commerce Admin path overlaps protected source: '+filename);
  check(actual.has(filename),'staged Commerce Admin path missing: '+filename);
}
const expected = new Set([...imported, ...protectedFiles, ...commerceLitePaths, ...commerceAdminPaths]);
check(actual.size === expected.size, `NAL file count drift expected ${expected.size} got ${actual.size}`);
for (const filename of actual) check(expected.has(filename), `untracked NAL path in integration: ${filename}`);

const pages = manifest.sourceReadFiles.map(x=>x.path).filter(x=>x.endsWith('/index.html'));
for (const filename of pages) {
  const html = await text(filename);
  check(/<meta\s+name="robots"\s+content="noindex/i.test(html),
    `READ staging route must not be indexed: ${filename}`);
  // Static local stylesheet/script dependencies must be available from the candidate itself.
  for (const match of html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="(\/nal\/[^"?#]+\.(?:js|mjs|css))(?:[?#][^"]*)?"[^>]*>/gi)) {
    check(await exists(match[1].slice(1)), `missing local dependency ${filename} → ${match[1]}`);
  }
}

const rootMy = await text('nal/my/index.html');
const originalMy = await text('nal/my/local/index.html');
check(rootMy.includes("location.hash === '#wishlist'"), 'MY NAL legacy hash redirect lost');
check(rootMy.includes("/nal/my/local/#wishlist"), 'MY NAL legacy target lost');
check(originalMy.includes('data-page="my"'), 'original MY NAL local UI missing');
check(originalMy.includes('nal-free-ux-20261008'), 'original MY NAL free-store script/version lost');

const draftSeasons = JSON.parse(await text('nal/data/read-seasons.json')).seasons;
check(Array.isArray(draftSeasons) && draftSeasons.every(x => x.published === false && x.status === 'draft'),
  'READ staging season must remain unpublished draft');

const stage = JSON.parse(await text('nal/data/read-backend.staging.json'));
check(stage.enabled === false && !stage.url && !stage.publishableKey, 'staging backend configuration must remain disconnected');

const privacy = JSON.parse(await text('nal/data/read-privacy-review.release.json'));
for (const [key,value] of Object.entries(manifest.requiredPrivacyInterlocks)) {
  check(privacy[key] === value, `READ owner privacy interlock altered: ${key}`);
}
check(privacy.schemaVersion===1 && privacy.module==='nal-read-owner-privacy-review','privacy gate contract malformed');
check(JSON.stringify([...privacy.actions].sort()) === JSON.stringify(['preview','queue','start-review'].sort()),
  'destructive action unexpectedly exposed in privacy gate');

const site = JSON.parse(await text('nal/data/site.json'));
for (const key of ['checkout','storePurchase','secureDownload']) {
  check(site.features[key] === false, `NAL paid feature ${key} activated before approval`);
}

if(errors.length){
  console.error(`NAL READ integration guard FAIL (${errors.length})`);
  for(const error of errors) console.error('- '+error);
  process.exit(1);
}
console.log(`NAL READ integration guard PASS: 88 latest source blobs, 130 preserved storefront blobs, ${pages.length} noindex pages, dependencies, MY NAL legacy, privacy and sales OFF`);
