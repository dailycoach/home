import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(root, relative));
const json = (relative) => JSON.parse(read(relative));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const courseId = 'lmc-lifetime-management-counselor';
const expectedCounts = [5, 7, 8, 6, 8, 7, 7, 8, 7, 7, 7];
const expectedWeekTitles = [
  '나와 타인 그리고 세상을 보는 눈',
  '적성의 다요인 종합분석기법을 활용한 진로적성검사',
  '성격 이해와 16PF 검사 해석',
  '의사소통 유형의 이해와 검사 해석',
  '스트레스의 이해와 RS-스트레스 검사 활용',
  '학습검사의 이해와 활용: 학습양식 및 학습정서',
  '정서검사의 이해와 활용: 정서척도 및 결과 해석',
  '행복지수(우울)검사의 이해와 활용',
  '심리건강(이상심리)검사의 이해와 활용',
  '부부커플검사의 이해와 활용: 결혼만족도 및 결과 해석',
  '발달진단검사의 이해와 활용: 아동·청소년 및 성인',
  '수료시험 및 과정 통합'
];

const courses = json('lcms/academy/data/courses.json');
assert(Array.isArray(courses.courses) && courses.courses.length === 1, 'Academy must contain one primary LMC course');
const course = courses.courses[0];
assert(course.id === courseId, 'Unexpected LMC course id');
assert(course.qualificationNumber === '민간자격 제2013-1058호', 'LMC qualification number changed');
assert(course.estimatedMinutes === 1440, 'Official curriculum must remain 24 hours');
assert(course.videoPartCount === 77, 'Course videoPartCount must be 77');
assert(course.releasePolicy?.mode === 'all_open', 'Default release policy must be all_open');
assert(!('modules' in course), 'Legacy one-module-per-week model must be removed');
assert(Array.isArray(course.weeks) && course.weeks.length === 12, 'Course must contain 12 weeks');
course.weeks.forEach((week, index) => {
  assert(week.week === index + 1, `Week order mismatch at ${index + 1}`);
  assert(week.id === `week-${String(index + 1).padStart(2, '0')}`, `Week id mismatch at ${index + 1}`);
  assert(week.title === expectedWeekTitles[index], `Week ${index + 1} title mismatch`);
  assert(week.title && week.theory && week.practice, `Week ${index + 1} content missing`);
  const expected = index < 11 ? expectedCounts[index] : 0;
  assert(Array.isArray(week.parts) && week.parts.length === expected, `Week ${index + 1} part count ${week.parts?.length}/${expected}`);
});
assert(course.weeks[11].videoSeconds === 0, 'WEEK-12 video duration must be zero');
assert(course.completion?.examUrl === '', 'WEEK-12 exam link must remain an empty operating placeholder');
assert(course.completion?.satisfactionSurveyUrl === '', 'WEEK-12 survey link must remain empty');
assert(course.completion?.completionApplicationUrl === '', 'WEEK-12 completion link must remain empty');

const mediaCatalog = json('lcms/academy/data/media-catalog.json');
const r2ObjectKeyMap = json('scripts/lmc-r2-object-key-map.json').objects || {};
const media = mediaCatalog.courses?.[courseId]?.media || [];
const parts = course.weeks.slice(0, 11).flatMap((week) => week.parts);
assert(parts.length === 77, `Course part total ${parts.length}/77`);
assert(media.length === 77, `Media total ${media.length}/77`);
assert(mediaCatalog.courses?.[courseId]?.videoWeeks === 11, 'Media videoWeeks must be 11');
assert(mediaCatalog.courses?.[courseId]?.completionWeek === 12, 'Completion week metadata missing');
assert(!media.some((item) => item.week === 12), 'WEEK-12 must not contain media');
const allowedMediaStatuses = new Set(['pending_upload', 'uploaded_unverified', 'verified', 'published', 'disabled']);
const mediaStatuses = new Set(media.map((item) => item.status));
assert(mediaStatuses.size === 1, `All 77 media items must share one lifecycle status: ${[...mediaStatuses].join(', ')}`);
const mediaStatus = [...mediaStatuses][0];
assert(allowedMediaStatuses.has(mediaStatus), `Unsupported media lifecycle status: ${mediaStatus}`);
assert(media.every((item) => item.provider === 'R2'), 'All media must use R2');
assert(media.every((item) => item.accessPolicy === 'PRIVATE_WORKER_SIGNED_URL'), 'All media must use signed Worker access');
assert(media.every((item) => Number.isInteger(item.sizeBytes) && item.sizeBytes > 0), 'All media must contain preflight sizeBytes');
assert(media.every((item) => /^[a-f0-9]{64}$/.test(item.sha256 || '')), 'All media must contain preflight SHA-256');
assert(media.every((item) => item.technical?.videoCodec === 'h264' && item.technical?.audioCodec === 'aac'), 'All media must contain H.264/AAC preflight metadata');
const approvedNonFastStartMedia = new Set(['lmc-w05-p06', 'lmc-w05-p07']);
assert(media.every((item) => item.technical?.fastStart === true || (
  approvedNonFastStartMedia.has(item.mediaId)
  && item.technical?.fastStart === false
  && item.technical?.fastStartWaiver?.type === 'NO_MASK_PRISTINE_BYTE_PRESERVATION'
  && item.technical?.fastStartWaiver?.authorized === true
  && Array.isArray(item.technical?.fastStartWaiver?.waivedChecks)
  && item.technical.fastStartWaiver.waivedChecks.length === 1
  && item.technical.fastStartWaiver.waivedChecks[0] === 'fastStart'
)), 'All media must pass Fast Start preflight or carry the approved WEEK-05 NO_MASK byte-preservation waiver');
assert(media.every((item) => Math.abs(item.technical?.actualDurationSeconds - item.durationSeconds) <= 2), 'All media must pass the two-second duration tolerance');
assert(Object.keys(r2ObjectKeyMap).length === 77, 'R2 object key inventory must contain 77 entries');
for (let week = 1; week <= 11; week += 1) assert(media.filter((item) => item.week === week).length === expectedCounts[week - 1], `WEEK-${week} media count mismatch`);
for (const [index, item] of media.entries()) {
  const source = parts[index];
  assert(item.mediaId === source.mediaId, `${item.mediaId}: course/media mediaId mismatch`);
  assert(item.partId === source.id, `${item.mediaId}: partId mismatch`);
  assert(item.title === source.title, `${item.mediaId}: title mismatch`);
  assert(item.durationSeconds === source.durationSeconds, `${item.mediaId}: duration mismatch`);
  assert(item.objectKey === r2ObjectKeyMap[item.mediaId], `${item.mediaId}: objectKey does not match the R2 inventory`);
  const keyMatch = item.objectKey.match(/^lmc\/v2\/week-(\d{2})\/LMC_WEEK(\d{2})_P(\d{2})_[A-Za-z0-9()_-]+\.mp4$/);
  assert(keyMatch && Number(keyMatch[1]) === item.week && Number(keyMatch[2]) === item.week && Number(keyMatch[3]) === item.part, `${item.mediaId}: objectKey format mismatch`);
  assert(/^LMC_WEEK\d{2}_P\d{2}_[a-z0-9-]+\.mp4$/.test(item.sourceFilename), `${item.mediaId}: sourceFilename mismatch`);
}
for (const [name, values] of [['mediaId', media.map((item) => item.mediaId)], ['partId', media.map((item) => item.partId)], ['objectKey', media.map((item) => item.objectKey)], ['sourceFilename', media.map((item) => item.sourceFilename)]]) assert(new Set(values).size === 77, `${name} must be unique`);
const durationSeconds = media.reduce((sum, item) => sum + item.durationSeconds, 0);
assert(Math.abs(durationSeconds - 74665) <= 5, `Video duration ${durationSeconds}s is outside the approved approximate total`);
assert(course.videoDurationSeconds === durationSeconds, 'Course and media total video duration differ');

const uploadJson = json('lcms/academy/r2-worker/upload/video-upload-map.json');
const uploadCsv = read('lcms/academy/r2-worker/upload/video-upload-map.csv').trim().split(/\r?\n/);
const uploadCommands = read('lcms/academy/r2-worker/upload/upload-commands.sh');
const checksumLines = read('lcms/academy/r2-worker/upload/LMC_77_SHA256SUMS.txt').trim().split(/\r?\n/);
assert(uploadJson.length === 77, 'Upload JSON must contain 77 rows');
assert(uploadCsv.length === 78, 'Upload CSV must contain header plus 77 rows');
assert(uploadCsv[0] === 'week,part,mediaId,title,localFilename,objectKey,durationSeconds,actualDurationSeconds,durationDeltaSeconds,sizeBytes,sha256,width,height,fps,videoCodec,audioCodec,fastStart,status', 'Upload CSV header mismatch');
assert(uploadJson.every((row, index) => row.mediaId === media[index].mediaId && row.objectKey === media[index].objectKey), 'Upload map must match catalog order');
assert(uploadJson.every((row, index) => row.sizeBytes === media[index].sizeBytes && row.sha256 === media[index].sha256), 'Upload map preflight metadata must match catalog');
assert(checksumLines.length === 77, 'SHA-256 checksum file must contain 77 rows');
assert(checksumLines.every((line, index) => line === `${media[index].sha256}  ${media[index].sourceFilename}`), 'SHA-256 checksum file must match catalog order');
assert((uploadCommands.match(/npx wrangler r2 object put/g) || []).length === 77, 'Upload commands must contain 77 Wrangler commands');
assert(!/(api[_-]?token|access[_-]?key|secret[_-]?key)\s*=/i.test(uploadCommands), 'Upload commands must not contain credentials');

const requiredPages = ['index.html', 'course.html', 'lesson.html', 'enter.html'];
for (const page of requiredPages) assert(exists(`lcms/academy/${page}`), `Missing Academy page: ${page}`);
for (const page of ['index.html', 'course.html', 'lesson.html']) {
  const html = read(`lcms/academy/${page}`);
  for (const style of ['./ux-core.css', './ux-course.css', './ux-lesson.css', './art-direction.css', './r2-player.css']) assert(html.includes(style), `${page} missing ${style}`);
  assert(html.includes('./academy.js') && html.includes('./r2-player.js'), `${page} missing Academy scripts`);
}
for (const page of ['course.html', 'lesson.html']) {
  const html = read(`lcms/academy/${page}`);
  assert(html.includes('./access-config.js') && html.includes('./access.js'), `${page} missing access scripts`);
  assert(html.includes('data-access-required="true"'), `${page} must require access`);
  assert(html.includes('noindex,nofollow'), `${page} must not be indexed`);
}
const indexHtml = read('lcms/academy/index.html');
assert(indexHtml.includes('77<br />PARTS') && indexHtml.includes('총 77개 파트'), 'Academy home must show 77 parts');
assert(indexHtml.includes('총 24시간') && indexHtml.includes('약 20시간 44분'), 'Official and video hours must be distinguished');
assert(!indexHtml.includes('11<br />VIDEOS') && !indexHtml.includes('총 11개 영상'), 'Legacy 11-video copy must be removed');

const academyJs = read('lcms/academy/academy.js');
const player = read('lcms/academy/r2-player.js');
assert(academyJs.includes("PROGRESS_KEY_PREFIX = 'rsedu-academy-progress:v2'"), 'Per-student progress namespace missing');
assert(academyJs.includes('setAuthenticatedStudent(session?.studentId'), 'Progress must bind to validated student id');
assert(academyJs.includes('courseWeeks(course, mediaCatalog)'), 'Course→Week→Part model missing');
assert(academyJs.includes('aria-current="page"'), 'Current part accessibility state missing');
assert(academyJs.includes('WEEK 12') && academyJs.includes('LMC FINAL WEEK'), 'Dedicated WEEK-12 screen missing');
assert(academyJs.includes('최종 완료는 운영자 확인 후 반영됩니다.'), 'WEEK-12 operator confirmation notice missing');
assert(academyJs.includes('브라우저 진도는 학습 편의를 위한 기록'), 'Progress evidence limitation missing');
assert(player.includes('part: asset.part'), 'Authorize request must include part');
assert(player.includes('/${asset.week}/${asset.part}') || player.includes('${asset.week}/${asset.part}'), 'Expected part media path missing');
assert(player.includes("preload = 'metadata'"), 'Player preload policy missing');
assert(player.includes("controlsList = 'nodownload'"), 'Player nodownload UI hint missing');
assert(player.includes('>= 0.9'), '90% completion rule missing');
assert(player.includes('pagehide'), 'pagehide progress save missing');
assert(player.includes('authorizationCache = new Map()'), 'Signed URL memory cache missing');
assert(!player.includes('sessionStorage'), 'Signed URLs must not be stored in sessionStorage');
assert(!/localStorage\.setItem\([^\n]*url/i.test(player), 'Signed URLs must not be stored in localStorage');

const workerRoot = 'lcms/academy/r2-worker';
for (const file of ['package.json', 'wrangler.jsonc', 'README.md', 'src/index.js', 'src/media-catalog.js', 'scripts/preflight-segmented-videos.mjs']) assert(exists(`${workerRoot}/${file}`), `Missing Worker file: ${file}`);
const worker = read(`${workerRoot}/src/index.js`);
const workerCatalog = read(`${workerRoot}/src/media-catalog.js`);
const wrangler = json(`${workerRoot}/wrangler.jsonc`);
assert(worker.includes("url.pathname === '/authorize'") && worker.includes("url.pathname === '/access'"), 'Worker endpoints missing');
assert(worker.includes('mediaCatalogEntry(week, part)'), 'Worker week/part allowlist lookup missing');
assert(worker.includes("media.status !== 'published'"), 'Worker published-status gate missing');
assert(worker.includes('range: request.headers'), 'Worker Range forwarding missing');
assert(worker.includes('signaturePayload(courseId, week, part, media.mediaId, objectKey, expiresAt)'), 'Worker signature must bind week, part, mediaId and object key');
assert(!worker.includes('LESSON_OBJECTS'), 'Legacy week-only allowlist must be removed');
assert(!worker.includes('lmc/week-01.mp4'), 'Legacy week-only object keys must be removed');
assert((workerCatalog.match(/"mediaId":/g) || []).length === 77, 'Worker catalog must contain 77 media entries');
assert((workerCatalog.match(new RegExp(`"status": "${mediaStatus}"`, 'g')) || []).length === 77, 'Worker catalog lifecycle status must match media-catalog.json');
assert(wrangler.r2_buckets?.[0]?.binding === 'VIDEOS' && wrangler.r2_buckets?.[0]?.bucket_name === 'rsedu-lmc-videos', 'R2 binding mismatch');

const accessConfig = read('lcms/academy/access-config.js');
const accessJs = read('lcms/academy/access.js');
const deployedWorkerUrl = 'https://lmc-r2-video-gateway.ros2468.workers.dev';
if (mediaStatus === 'published') {
  assert(accessConfig.includes(`playbackWorkerUrl: '${deployedWorkerUrl}'`), 'Published media requires the deployed Worker URL');
} else {
  assert(accessConfig.includes("playbackWorkerUrl: ''") || accessConfig.includes(`playbackWorkerUrl: '${deployedWorkerUrl}'`), 'Unexpected Worker URL configuration');
}
assert(!accessConfig.includes('apiUrl'), 'Apps Script URL must not be exposed');
assert(accessJs.includes("new URL('/access'") && accessJs.includes("method: 'POST'"), 'Browser auth must use Worker POST /access');

const appScriptFiles = ['Code.gs', 'Provisioning.gs', 'Api.gs', 'DataHelpers.gs', 'Expiry.gs'];
for (const file of appScriptFiles) assert(exists(`lcms/academy/apps-script/${file}`), `Missing Apps Script module: ${file}`);
const appScript = appScriptFiles.map((file) => read(`lcms/academy/apps-script/${file}`)).join('\n');
for (const fn of ['setupAcademyAutomation', 'handleFormSubmit', 'handlePaymentEdit', 'provisionStudentRow_', 'expireStudentAccesses', 'ensureExpiryTrigger_', 'doGet', 'doPost']) assert(appScript.includes(`function ${fn}`), `Apps Script function missing: ${fn}`);
assert(!appScript.includes('addViewer(email)') && !appScript.includes('revokePermissions(email)'), 'Drive permissions must not return');
assert(appScript.includes('requireWorkerSharedSecret_(payload)'), 'Worker shared secret validation missing');

const publicSource = [indexHtml, read('lcms/academy/course.html'), read('lcms/academy/lesson.html'), academyJs, player, read('lcms/academy/data/courses.json')].join('\n');
assert(!/vimeo|google\s*drive|drive-video|youtube-cache|youtube\.com|youtu\.be/i.test(publicSource), 'Legacy video provider dependency returned');
assert(publicSource.includes('LMC 평생진로상담사') && publicSource.includes('mobile-learning-bar'), 'LMC identity or mobile learning bar missing');

console.log(`LMC Academy v2 quality checks passed: 12 weeks, 77 ${mediaStatus} parts, ${durationSeconds} video seconds.`);
