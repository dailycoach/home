import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(root, relative));
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const catalog = JSON.parse(read('lcms/academy/data/courses.json'));
assert(Array.isArray(catalog.courses), 'courses.json: courses must be an array');
assert(catalog.courses.length === 1, 'Academy must contain exactly one primary LMC course before expansion approval');

const course = catalog.courses[0];
assert(course.id === 'lmc-lifetime-management-counselor', 'Unexpected primary course id');
assert(course.qualificationNumber === '민간자격 제2013-1058호', 'LMC qualification number is missing or changed');
assert(Array.isArray(course.modules) && course.modules.length === 12, 'LMC curriculum must contain 12 modules');
course.modules.forEach((module, index) => {
  assert(module.week === index + 1, `Week order mismatch at module ${index + 1}`);
  assert(module.title && module.theory && module.practice, `Week ${index + 1} is missing title, theory, or practice`);
});
assert(/수료시험/.test(course.modules[11].title), 'Week 12 must remain the completion exam and ceremony week');

const requiredPages = ['index.html', 'course.html', 'lesson.html', 'enter.html'];
const requiredStyles = ['./ux-core.css', './ux-course.css', './ux-lesson.css', './art-direction.css'];
for (const page of requiredPages) assert(exists(`lcms/academy/${page}`), `Missing Academy page: ${page}`);
for (const file of ['lcms/academy/index.html', 'lcms/academy/course.html', 'lcms/academy/lesson.html']) {
  const html = read(file);
  for (const style of requiredStyles) assert(html.includes(style), `${file} is missing ${style}`);
  assert(html.includes('../cip-art-direction.css'), `${file} is missing shared CIP art direction`);
  assert(html.includes('./academy.js'), `${file} is missing academy.js`);
  assert(html.includes('./r2-player.js'), `${file} is missing the R2 playback adapter`);
  assert(html.includes('./r2-player.css'), `${file} is missing the R2 player styles`);
}

for (const file of ['lcms/academy/course.html', 'lcms/academy/lesson.html']) {
  const html = read(file);
  assert(html.includes('./access-config.js'), `${file} is missing access-config.js`);
  assert(html.includes('./access.js'), `${file} is missing access.js`);
  assert(html.includes('data-access-required="true"'), `${file} is not marked as access protected`);
  assert(html.includes('noindex,nofollow'), `${file} must not be indexed`);
}

const entry = read('lcms/academy/enter.html');
assert(entry.includes('academyEntryForm'), 'Student entry form is missing');
assert(entry.includes('등록 이메일'), 'Student entry email field is missing');
assert(entry.includes('8자리 입장코드'), 'Student entry access-code field is missing');
assert(entry.includes('Cloudflare R2'), 'Student entry R2 playback notice is missing');

const mediaCatalog = JSON.parse(read('lcms/academy/data/media-catalog.json'));
const media = mediaCatalog.courses?.[course.id]?.media || [];
assert(media.length === 11, 'LMC must contain 11 R2 video slots');
assert(media.map((item) => item.week).join(',') === '1,2,3,4,5,6,7,8,9,10,11', 'R2 video weeks must be 1 through 11');
assert(media.every((item) => item.provider === 'R2'), 'All paid course videos must use R2');
assert(media.every((item) => item.objectKey === `lmc/week-${String(item.week).padStart(2, '0')}.mp4`), 'R2 object keys must follow the fixed week pattern');
assert(media.every((item) => item.accessPolicy === 'PRIVATE_WORKER_SIGNED_URL'), 'R2 media must use signed Worker access');
assert(!media.some((item) => item.week === 12), 'Week 12 must not contain a video');
assert(mediaCatalog.courses?.[course.id]?.completionWeek === 12, 'Completion week metadata is missing');

const accessConfig = read('lcms/academy/access-config.js');
const r2Player = read('lcms/academy/r2-player.js');
const r2Css = read('lcms/academy/r2-player.css');
assert(accessConfig.includes("playbackWorkerUrl: ''"), 'Cloudflare Worker URL placeholder must remain explicit before deployment');
assert(r2Player.includes('/authorize'), 'R2 player does not request a playback authorization URL');
assert(r2Player.includes("crossOrigin = 'anonymous'"), 'R2 player must send an Origin header for protected media');
assert(r2Player.includes('timeupdate'), 'R2 playback position saving is missing');
assert(r2Player.includes('button.click()'), 'R2 ended-event completion bridge is missing');
assert(r2Css.includes('.r2-video-player'), 'R2 video player CSS is missing');

const workerRoot = 'lcms/academy/r2-worker';
for (const file of ['package.json', 'wrangler.jsonc', 'README.md', 'src/index.js']) {
  assert(exists(`${workerRoot}/${file}`), `Missing R2 Worker file: ${file}`);
}
const worker = read(`${workerRoot}/src/index.js`);
const wrangler = JSON.parse(read(`${workerRoot}/wrangler.jsonc`));
assert(worker.includes("url.pathname === '/authorize'"), 'Worker authorization endpoint is missing');
assert(worker.includes("url.pathname.startsWith('/media/')"), 'Worker media endpoint is missing');
assert(worker.includes('range: request.headers'), 'Worker does not pass Range headers to R2');
assert(worker.includes('PLAYBACK_SECRET'), 'Worker playback HMAC secret is missing');
assert(worker.includes('ACCESS_API_URL'), 'Worker Apps Script session validation is missing');
assert(worker.includes('LESSON_OBJECTS'), 'Worker fixed lesson allowlist is missing');
assert(!/12:\s*'lmc\/week-12/.test(worker), 'Worker must not map a week 12 video');
assert(wrangler.r2_buckets?.[0]?.binding === 'VIDEOS', 'R2 Worker binding must be named VIDEOS');
assert(wrangler.r2_buckets?.[0]?.bucket_name === 'rsedu-lmc-videos', 'Unexpected R2 bucket name');

const appScriptFiles = ['Code.gs', 'Provisioning.gs', 'Api.gs', 'DataHelpers.gs', 'Expiry.gs'];
for (const file of appScriptFiles) assert(exists(`lcms/academy/apps-script/${file}`), `Missing Apps Script module: ${file}`);
const appScript = appScriptFiles.map((file) => read(`lcms/academy/apps-script/${file}`)).join('\n');
assert(exists('lcms/academy/apps-script/appsscript.json'), 'Apps Script manifest is missing');
const manifest = JSON.parse(read('lcms/academy/apps-script/appsscript.json'));
assert(!manifest.oauthScopes?.includes('https://www.googleapis.com/auth/drive'), 'Drive OAuth scope must not return in R2 mode');
for (const fn of ['setupAcademyAutomation', 'handleFormSubmit', 'handlePaymentEdit', 'provisionStudentRow_', 'expireStudentAccesses', 'ensureExpiryTrigger_', 'doGet', 'doPost']) {
  assert(appScript.includes(`function ${fn}`), `Apps Script function is missing: ${fn}`);
}
assert(!appScript.includes('addViewer(email)'), 'Drive permission grants must not return in R2 mode');
assert(!appScript.includes('revokePermissions(email)'), 'Drive permission revocation must not return in R2 mode');
assert(appScript.includes('MailApp.sendEmail'), 'Automatic access-code email is missing');
assert(appScript.includes('.timeBased()'), 'Daily expiration trigger is missing');

const academySource = [
  read('lcms/academy/index.html'),
  read('lcms/academy/course.html'),
  read('lcms/academy/lesson.html'),
  entry,
  r2Player,
  read('lcms/academy/art-direction.css'),
  read('lcms/academy/data/courses.json')
].join('\n');
assert(!academySource.includes('KINGDOM 기초 코칭'), 'Legacy KINGDOM sample course returned to Academy');
assert(academySource.includes('LMC 평생진로상담사'), 'LMC course identity is missing');
assert(academySource.includes('mobile-learning-bar'), 'Mobile learning controls are missing');
assert(academySource.includes('Cloudflare R2'), 'R2 course identity is missing');

console.log('LMC Academy private R2 access and automation quality checks passed.');
