import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const failures = [];
const requireLock = (ok, label) => { if (!ok) failures.push(label); };
const read = async name => readFile(path.resolve(process.cwd(), name), 'utf8');
const exists = async name => { try { await access(path.resolve(process.cwd(), name)); return true; } catch { return false; } };

const release = JSON.parse(await read('nal/data/read-privacy-review.release.json'));
requireLock(release.schemaVersion === 1 && release.module === 'nal-read-owner-privacy-review',
  'owner UI release schema changed');
for (const key of ['uiEnabled', 'ownerAuthBindingReviewed', 'independentServerGateConfigured', 'approvedPrivacyNotice', 'backendDeployed', 'destructiveApiExposed']) {
  requireLock(release[key] === false, `owner review release ${key} must remain false`);
}
const expected = ['queue', 'preview', 'start-review'].sort();
requireLock(Array.isArray(release.actions) && release.actions.length === 3 &&
  JSON.stringify([...release.actions].sort()) === JSON.stringify(expected),
  'owner review actions must be queue/preview/start-review only');

const staging = JSON.parse(await read('nal/data/read-backend.staging.json'));
requireLock(staging.enabled === false && staging.url === '' && staging.publishableKey === '',
  'READ staging backend must remain disconnected');
const seasons = JSON.parse(await read('nal/data/read-seasons.json')).seasons;
requireLock(Array.isArray(seasons) && seasons.every(s=>s.status==='draft' && s.published===false),
  'READ seasons must remain unpublished drafts');

for (const name of ['nal/read/admin/privacy/index.html','nal/my/privacy/index.html']) {
  const html = await read(name);
  requireLock(/<meta\s+name="robots"\s+content="noindex,nofollow,noarchive"/i.test(html),
    `privacy route must remain noindex/noarchive: ${name}`);
  requireLock(/<main\s/i.test(html), `privacy route must retain main landmark: ${name}`);
}

const review = await read('nal/assets/js/read-privacy-review.js');
requireLock(/if\s*\(\s*!await reviewUiReleased\(\)\s*\)/.test(review),
  'owner UI must stop before any server call when release check fails');
for (const condition of [
  'gate?.uiEnabled===true', 'gate?.ownerAuthBindingReviewed===true',
  'gate?.independentServerGateConfigured===true',
  'gate?.approvedPrivacyNotice===true','gate?.backendDeployed===true',
  'gate?.destructiveApiExposed===false'
]) requireLock(review.includes(condition), `owner UI approval precondition lost: ${condition}`);
requireLock(review.includes("cache:'no-store'") && review.includes("redirect:'error'"),
  'owner UI must load release gate without cache or redirect');
requireLock(review.includes("home?.role!=='owner'"), 'owner UI must visibly reject non-owner role');
const browserActions = [...review.matchAll(/A\.privacyReview\(\s*['"]([^'"]+)['"]/g)].map(m=>m[1]).sort();
requireLock(JSON.stringify(browserActions)===JSON.stringify(expected),
  'owner UI must only invoke queue, preview, start-review');

const session = await read('nal/assets/js/account-session.js');
requireLock(session.includes("['queue','preview','start-review'].includes(action)"),
  'browser transport must keep exact allowlist of owner review commands');
requireLock(session.includes("request('nal-read-privacy-admin',{action,payload})"),
  'owner transport path unexpectedly changed');
const member = await read('nal/assets/js/read-privacy-member.js');
const memberActions = [...member.matchAll(/A\.call\('privacy'\s*,\s*'([^']+)'/g)].map(x=>x[1]).sort();
requireLock(JSON.stringify(memberActions)===JSON.stringify(['inventory','status','withdraw'].sort()),
  'member UI must not initiate new privacy request or deletion before legal approval');

requireLock(!(await exists('supabase/functions/nal-read-privacy-admin/index.ts')),
  'unreviewed privileged privacy owner Edge endpoint appeared in source');
const site=JSON.parse(await read('nal/data/site.json'));
for(const flag of ['account','checkout','storePurchase','secureDownload']) {
  requireLock(site.features?.[flag]===false,`site feature ${flag} must remain OFF`);
}

if(failures.length) {
  console.error(`NAL P4 privacy lock FAIL (${failures.length})`);
  for(const failure of failures) console.error('- '+failure);
  process.exit(1);
}
console.log('NAL P4 privacy lock PASS: owner gate OFF, 3 read-only/review actions, no Edge owner endpoint, member intake blocked, READ/account/payments disabled');
