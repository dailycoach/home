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

const requiredPages = ['index.html', 'course.html', 'lesson.html', 'enter.html'];
const requiredStyles = ['./ux-core.css', './ux-course.css', './ux-lesson.css', './art-direction.css'];
for (const page of requiredPages) assert(exists(`lcms/academy/${page}`), `Missing Academy page: ${page}`);
for (const file of ['lcms/academy/index.html', 'lcms/academy/course.html', 'lcms/academy/lesson.html']) {
  const html = read(file);
  for (const style of requiredStyles) assert(html.includes(style), `${file} is missing ${style}`);
  assert(html.includes('../cip-art-direction.css'), `${file} is missing shared CIP art direction`);
  assert(html.includes('./academy.js'), `${file} is missing academy.js`);
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
assert(entry.includes('Google 계정 이메일'), 'Student entry Google account field is missing');
assert(entry.includes('8자리 입장코드'), 'Student entry access-code field is missing');
assert(entry.includes('./access-config.js') && entry.includes('./access.js'), 'Student entry auth scripts are missing');

const mediaCatalog = JSON.parse(read('lcms/academy/data/media-catalog.json'));
const media = mediaCatalog.courses?.[course.id]?.media || [];
assert(media.length === 2, 'Initial Drive catalog must contain the verified week 8 and 9 videos only');
assert(media.map((item) => item.week).join(',') === '8,9', 'Drive media weeks must be mapped by week, not list index');
assert(media.every((item) => item.provider === 'DRIVE'), 'Initial media must use Google Drive');
assert(media.every((item) => item.accessPolicy === 'RESTRICTED'), 'Drive media must remain restricted');
assert(media.every((item) => item.status === 'published'), 'Verified Drive media must be published in the catalog');
assert(media[0].fileId === '1qu3q3BD4JfNeXmj1cgANwsjnzdoZnKeI', 'Week 8 Drive ID changed unexpectedly');
assert(media[1].fileId === '1GLYAPV9N7GRvEognYXJVYTVgz971WmYW', 'Week 9 Drive ID changed unexpectedly');

const academyIndex = read('lcms/academy/index.html');
const sharedCss = read('lcms/cip-art-direction.css');
const trendCss = read('lcms/cip-2026-trends.css');
const overridesCss = read('lcms/cip-2026-overrides.css');
assert(academyIndex.includes('academy-art-word'), 'Academy typographic hero is missing');
assert(academyIndex.includes('academy-art-poster'), 'Academy editorial poster is missing');
assert(academyIndex.includes('12<br />WEEKS') || academyIndex.includes('12 WEEKS'), 'Academy 12-week poster data is missing');
assert(academyIndex.includes('./enter.html'), 'Academy student-entry CTA is missing');
assert(sharedCss.includes('cip-2026-trends.css'), 'Academy is missing the shared 2026 trend import');
assert(sharedCss.includes('cip-2026-overrides.css'), 'Academy is missing the 2026 override import');
assert(trendCss.includes('trend-type-breathe'), 'Kinetic typography treatment is missing');
assert(trendCss.includes('prefers-reduced-motion'), 'Reduced motion fallback is missing');
for (const token of ['LMC 12 WEEKS', 'Learning note', 'cip-strip-shift', 'cip-blob-warp']) {
  assert(overridesCss.includes(token), `Academy 2026 treatment missing: ${token}`);
}

const academyJs = read('lcms/academy/academy.js');
const accessJs = read('lcms/academy/access.js');
const accessConfig = read('lcms/academy/access-config.js');
assert(academyJs.includes("const MEDIA_PATH = './data/media-catalog.json'"), 'Academy is not using the Drive media catalog');
assert(!academyJs.includes('youtube-cache.json'), 'Legacy YouTube cache is still the primary media source');
assert(academyJs.includes("provider === 'drive'"), 'Drive player branch is missing');
assert(academyJs.includes("provider === 'youtube_public'"), 'Public-only YouTube branch is missing');
assert(academyJs.includes('drive.google.com/file/d/'), 'Drive preview player is missing');
assert(academyJs.includes('RSEduAcademyAccess.guard'), 'Protected Academy guard is missing');
assert(accessJs.includes("action', action"), 'Access API request builder is missing');
assert(accessJs.includes('localStorage'), 'Access session storage is missing');
assert(accessConfig.includes("apiUrl: ''"), 'Deployment URL placeholder must remain explicit until Apps Script is deployed');

const appScriptFiles = ['Code.gs', 'Provisioning.gs', 'Api.gs', 'DataHelpers.gs'];
for (const file of appScriptFiles) assert(exists(`lcms/academy/apps-script/${file}`), `Missing Apps Script module: ${file}`);
const appScript = appScriptFiles.map((file) => read(`lcms/academy/apps-script/${file}`)).join('\n');
assert(exists('lcms/academy/apps-script/appsscript.json'), 'Apps Script manifest is missing');
assert(exists('lcms/academy/apps-script/README.md'), 'Apps Script installation guide is missing');
assert(exists('lcms/academy/SMARTSTORE_COPY.md'), 'SmartStore registration copy is missing');
for (const fn of ['setupAcademyAutomation', 'handleFormSubmit', 'handlePaymentEdit', 'provisionStudentRow_', 'doGet', 'doPost']) {
  assert(appScript.includes(`function ${fn}`), `Apps Script function is missing: ${fn}`);
}
assert(appScript.includes('addViewer(email)'), 'Drive permission grant is missing');
assert(appScript.includes('revokePermissions(email)'), 'Drive permission revoke is missing');
assert(appScript.includes('setConfirmationMessage'), 'Google Form completion message is missing');
assert(appScript.includes('MailApp.sendEmail'), 'Automatic access-code email is missing');
assert(appScript.includes('Script Properties'), 'Secret-storage guidance is missing');

const academySource = [
  academyIndex,
  read('lcms/academy/course.html'),
  read('lcms/academy/lesson.html'),
  entry,
  academyJs,
  read('lcms/academy/art-direction.css'),
  read('lcms/academy/data/courses.json')
].join('\n');
assert(!academySource.includes('KINGDOM 기초 코칭'), 'Legacy KINGDOM sample course returned to Academy');
assert(!academySource.includes('KGM210 결과해석 실무'), 'Legacy KGM210 sample course returned to Academy');
assert(academySource.includes('LMC 평생진로상담사'), 'LMC course identity is missing');
assert(academySource.includes('mobile-learning-bar'), 'Mobile learning controls are missing');
assert(academySource.includes('course-quicknav'), 'Course quick navigation is missing');
assert(academySource.includes('note-save-status'), 'Autosave status UI is missing');
assert(academySource.includes('art-academy-hero'), 'Academy contemporary art hero class is missing');

console.log('LMC Academy Drive access and automation quality checks passed.');
