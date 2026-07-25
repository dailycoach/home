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
const expectedTitles = [
  '상담사와 코치를 위한 심리학 개요',
  '진로적성 파악과 자녀지도',
  '성격에 대한 이해',
  '의사소통 유형을 통한 타인 이해',
  '스트레스에 대한 심리학적 이해',
  'MBTI와 학습유형',
  '살면서 느끼는 정서적 문제',
  '우울과 우울검사',
  '이상심리와 정신병리척도',
  '만족하는 부부·커플 관계의 요인',
  '아동청소년과 성인기 발달',
  '수료시험 및 학기말 수료식'
];
course.modules.forEach((module, index) => {
  assert(module.week === index + 1, `Week order mismatch at module ${index + 1}`);
  assert(module.title && module.theory && module.practice, `Week ${index + 1} is missing title, theory, or practice`);
  assert(module.title === expectedTitles[index], `Week ${index + 1} title must match the approved curriculum`);
});
assert(course.completion?.examUrl === '', 'Week 12 exam link must remain an explicit deployment placeholder');
assert(course.completion?.satisfactionSurveyUrl === '', 'Week 12 satisfaction survey link placeholder is missing');
assert(course.completion?.completionApplicationUrl === '', 'Week 12 completion application link placeholder is missing');
assert(Array.isArray(course.completion?.reflectionQuestions) && course.completion.reflectionQuestions.length >= 3, 'Week 12 reflection questions are missing');

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
assert(media.every((item) => ['pending_upload', 'published'].includes(item.status)), 'R2 media status must be pending_upload or published');
assert(media.every((item, index) => item.title === expectedTitles[index]), 'R2 media titles must match weeks 1 through 11');
assert(!media.some((item) => item.week === 12), 'Week 12 must not contain a video');
assert(mediaCatalog.courses?.[course.id]?.completionWeek === 12, 'Completion week metadata is missing');

const accessConfig = read('lcms/academy/access-config.js');
const accessJs = read('lcms/academy/access.js');
const academyJs = read('lcms/academy/academy.js');
const r2Player = read('lcms/academy/r2-player.js');
const r2Css = read('lcms/academy/r2-player.css');
assert(accessConfig.includes("playbackWorkerUrl: ''"), 'Cloudflare Worker URL placeholder must remain explicit before deployment');
assert(!accessConfig.includes('apiUrl'), 'Apps Script URL must not be exposed in static access config');
assert(accessJs.includes("new URL('/access'"), 'Browser authentication must use the Worker /access proxy');
assert(accessJs.includes("method: 'POST'"), 'Browser authentication must use POST JSON');
assert(!/jsonp|callback_prefix|config\.apiUrl/i.test(accessJs), 'Browser authentication must not use JSONP or a public Apps Script URL');
assert(accessJs.includes('studentId'), 'Authenticated browser sessions must retain the opaque student id');
assert(academyJs.includes("PROGRESS_KEY_PREFIX = 'rsedu-academy-progress:v2'"), 'Academy progress must use the per-student v2 namespace');
assert(academyJs.includes('setAuthenticatedStudent(session?.studentId'), 'Academy progress must bind to the validated student session');
assert(academyJs.includes('status: asset.status'), 'Published R2 media status must propagate to lesson UI state');
assert(r2Player.includes("PROGRESS_KEY_PREFIX = 'rsedu-academy-progress:v2'"), 'R2 resume state must use the per-student v2 namespace');
assert(read('lcms/academy/index.html').includes('./access.js'), 'Public Academy index must load session state before showing learner progress');
assert(!read('lcms/academy/lesson.html').includes('rsedu-academy-progress:v1'), 'Lesson resume must not read unscoped legacy progress before authentication');
assert(r2Player.includes('/authorize'), 'R2 player does not request a playback authorization URL');
assert(r2Player.includes("crossOrigin = 'anonymous'"), 'R2 player must send an Origin header for protected media');
assert(r2Player.includes("preload = 'metadata'"), 'R2 player must avoid eager video downloads');
assert(r2Player.includes("controlsList = 'nodownload noremoteplayback'"), 'R2 player download and remote-playback controls are not restricted');
assert(r2Player.includes('disablePictureInPicture = true'), 'R2 player Picture-in-Picture restriction is missing');
assert(r2Player.includes('disableRemotePlayback = true'), 'R2 player remote playback restriction is missing');
assert(r2Player.includes('timeupdate'), 'R2 playback position saving is missing');
assert(r2Player.includes('>= 5'), 'R2 playback position must be saved in five-second intervals');
assert(r2Player.includes('loadedmetadata'), 'R2 playback resume handling is missing');
assert(r2Player.includes('button.click()'), 'R2 ended-event completion bridge is missing');
assert(r2Player.includes('sessionStorage'), 'Short-lived playback URL client cache is missing');
assert(r2Player.includes('4 * 60 * 60 * 1000'), 'Playback URL cache must not be reused beyond four hours');
assert(r2Player.includes("error.code = 'SESSION_INVALID'"), 'Expired playback authorization does not mark the session invalid');
assert(r2Player.includes('redirectToEntry()'), 'Expired playback authorization does not return the learner to entry');
assert(
  /function handleVideoError[\s\S]*failedKey = mountKey;[\s\S]*renderPlayerState\('영상을 재생하지 못했습니다\.', 'error'\)/.test(r2Player),
  'Persistent media errors must enter a stable failed state instead of remounting the same signed URL'
);
assert(r2Css.includes('.r2-video-player'), 'R2 video player CSS is missing');
assert(r2Css.includes('.completion-stage'), 'Week 12 completion-stage CSS is missing');

for (const copy of ['수료시험 안내', '학기말 수료식 안내', '전체 과정 성찰 질문', '과정 만족도 조사', '수료·자격증 발급 안내', '최종 학습 완료']) {
  assert(academyJs.includes(copy), `Week 12 UI copy is missing: ${copy}`);
}
assert(academyJs.includes("active.week === 12"), 'Week 12 does not use a dedicated non-video branch');
assert(academyJs.includes('completionStageMarkup(course, active)'), 'Week 12 completion view is not rendered');

const workerRoot = 'lcms/academy/r2-worker';
for (const file of ['package.json', 'wrangler.jsonc', 'README.md', 'src/index.js']) {
  assert(exists(`${workerRoot}/${file}`), `Missing R2 Worker file: ${file}`);
}
const worker = read(`${workerRoot}/src/index.js`);
const wrangler = JSON.parse(read(`${workerRoot}/wrangler.jsonc`));
assert(worker.includes("url.pathname === '/authorize'"), 'Worker authorization endpoint is missing');
assert(worker.includes("url.pathname === '/access'"), 'Worker browser authentication proxy is missing');
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
const apiScript = read('lcms/academy/apps-script/Api.gs');
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
assert(
  !appScript.includes("setSettingValue_(ss, 'APPS_SCRIPT_WEB_APP_URL'"),
  'ACCESS_API_URL must not be persisted in the operations spreadsheet'
);
assert(appScript.includes("action === 'login' || action === 'validate' || action === 'logout'"), 'Apps Script POST browser-auth actions are missing');
assert(appScript.includes('requireWorkerSharedSecret_(payload)'), 'Apps Script browser-auth proxy requests must require the Worker shared secret');
assert(
  /function suspendStudentRow_[\s\S]*?getScriptLock\(\)[\s\S]*?ACCESS_STATUS\)\.setValue\('정지'\)/.test(appScript),
  'Refund and cancellation suspension must be serialized against access provisioning'
);
assert(/function loginResponse_[\s\S]*?studentId:\s*student\.id/.test(apiScript), 'Browser login response must include the opaque student id');
assert(/function validateResponse_[\s\S]*?studentId:\s*access\.student\.id/.test(apiScript), 'Browser validation response must include the opaque student id');
assert(apiScript.includes("if (action !== 'health')"), 'Apps Script GET must reject credential-bearing browser actions');

const academySource = [
  read('lcms/academy/index.html'),
  read('lcms/academy/course.html'),
  read('lcms/academy/lesson.html'),
  entry,
  academyJs,
  r2Player,
  read('lcms/academy/art-direction.css'),
  read('lcms/academy/access.css'),
  read('lcms/academy/ux-lesson.css'),
  read('lcms/academy/data/courses.json')
].join('\n');
assert(!academySource.includes('KINGDOM 기초 코칭'), 'Legacy KINGDOM sample course returned to Academy');
assert(!/vimeo|google\s*drive|drive-video/i.test(academySource), 'Legacy Vimeo or Google Drive client path returned to Academy');
assert(academySource.includes('LMC 평생진로상담사'), 'LMC course identity is missing');
assert(academySource.includes('mobile-learning-bar'), 'Mobile learning controls are missing');
assert(academySource.includes('Cloudflare R2'), 'R2 course identity is missing');

console.log('LMC Academy private R2 access and automation quality checks passed.');
