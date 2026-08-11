import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const COURSE_ID = 'lmc-lifetime-management-counselor';
const EXPECTED_BY_WEEK = new Map([
  [1, 5], [2, 7], [3, 8], [4, 6], [5, 8], [6, 7],
  [7, 7], [8, 8], [9, 7], [10, 7], [11, 7]
]);

const args = parseArgs(process.argv.slice(2));
const week = Number(args.week);
const expectedParts = EXPECTED_BY_WEEK.get(week);
if (!expectedParts) throw new Error('--week must be an integer from 1 to 11');

const execute = Boolean(args.execute);
const catalogPath = path.resolve(args.catalog || path.join(ROOT, 'lcms/academy/data/media-catalog.json'));
const technicalPath = requirePath(args['technical-qa'], '--technical-qa');
const remotePath = requirePath(args['remote-qa'], '--remote-qa');
const overwritePath = requirePath(args['r2-report'], '--r2-report');
const artifactRoot = path.resolve(args['artifact-root'] || path.join(ROOT, 'artifacts/lmc-privacy-rework'));
const workerCatalogPath = path.join(ROOT, 'lcms/academy/r2-worker/src/media-catalog.js');
const uploadJsonPath = path.join(ROOT, 'lcms/academy/r2-worker/upload/video-upload-map.json');
const uploadCsvPath = path.join(ROOT, 'lcms/academy/r2-worker/upload/video-upload-map.csv');
const checksumsPath = path.join(ROOT, 'lcms/academy/r2-worker/upload/LMC_77_SHA256SUMS.txt');

const [catalog, technical, remote, overwrite] = await Promise.all([
  readJson(catalogPath),
  readJson(technicalPath),
  readJson(remotePath),
  readJson(overwritePath)
]);

const media = catalog.courses?.[COURSE_ID]?.media;
assert(Array.isArray(media) && media.length === 77, `Expected 77 catalog rows, got ${media?.length ?? 0}`);
const weekMedia = media.filter((item) => Number(item.week) === week);
assert(weekMedia.length === expectedParts, `WEEK-${pad(week)} catalog count ${weekMedia.length}/${expectedParts}`);
assert(weekMedia.every((item) => item.status === 'published'), `WEEK-${pad(week)} catalog rows must stay published`);
assert(weekMedia.every((item) => item.accessPolicy === 'PRIVATE_WORKER_SIGNED_URL'), `WEEK-${pad(week)} access policy changed`);

validateTechnicalQa(technical, week, expectedParts, weekMedia);
validateRemoteQa(remote, week, expectedParts, weekMedia);
validateOverwriteReport(overwrite, week, expectedParts, weekMedia);

const technicalById = new Map(technical.results.map((item) => [item.mediaId, item]));
const integrityById = new Map(remote.remoteObjectIntegrity.parts.map((item) => [item.mediaId, item]));
const httpById = new Map(remote.httpVerification.parts.map((item) => [item.mediaId, item]));
const uploadedById = new Map(overwrite.uploaded.map((item) => [item.mediaId, item]));
const changes = [];

const nextMedia = media.map((item) => {
  if (Number(item.week) !== week) return item;

  const qa = technicalById.get(item.mediaId);
  const integrity = integrityById.get(item.mediaId);
  const http = httpById.get(item.mediaId);
  const uploaded = uploadedById.get(item.mediaId);

  assert(qa.currentObjectKey === item.objectKey, `${item.mediaId}: technical QA objectKey mismatch`);
  assert(qa.sourceFilename === item.sourceFilename, `${item.mediaId}: technical QA filename mismatch`);
  assert(uploaded.currentObjectKey === item.objectKey, `${item.mediaId}: overwrite objectKey mismatch`);
  assert(uploaded.sizeBytes === qa.sizeBytes, `${item.mediaId}: overwrite size differs from technical QA`);
  assert(uploaded.sha256 === qa.sha256, `${item.mediaId}: overwrite SHA differs from technical QA`);
  assert(integrity.sizeBytes === qa.sizeBytes, `${item.mediaId}: remote R2 size differs from technical QA`);
  assert(integrity.sha256 === qa.sha256, `${item.mediaId}: remote R2 SHA differs from technical QA`);
  assert(http.contentLength === qa.sizeBytes, `${item.mediaId}: signed HEAD size differs from technical QA`);
  assert(http.headStatus === 200 && http.rangeStatus === 206, `${item.mediaId}: signed HTTP verification failed`);
  assert(http.contentType === 'video/mp4' && http.acceptRanges === 'bytes', `${item.mediaId}: signed HTTP headers failed`);
  assert(http.contentRange === `bytes 0-0/${qa.sizeBytes}` && http.rangeBodyBytes === 1, `${item.mediaId}: signed Range response failed`);

  changes.push({
    mediaId: item.mediaId,
    objectKey: item.objectKey,
    previousSizeBytes: item.sizeBytes,
    nextSizeBytes: qa.sizeBytes,
    previousSha256: item.sha256,
    nextSha256: qa.sha256
  });

  return {
    ...item,
    sha256: qa.sha256,
    sizeBytes: qa.sizeBytes,
    technical: {
      actualDurationSeconds: qa.actualDurationSeconds,
      durationDeltaSeconds: qa.durationDeltaSeconds,
      width: qa.width,
      height: qa.height,
      fps: qa.fps,
      videoCodec: qa.videoCodec,
      audioCodec: qa.audioCodec,
      fastStart: qa.fastStart
    }
  };
});

const nextCatalog = {
  ...catalog,
  updatedAt: String(remote.generatedAt || new Date().toISOString()).slice(0, 10),
  courses: {
    ...catalog.courses,
    [COURSE_ID]: {
      ...catalog.courses[COURSE_ID],
      media: nextMedia
    }
  }
};

const uploadMap = nextMedia.map((item) => ({
  week: item.week,
  part: item.part,
  mediaId: item.mediaId,
  title: item.title,
  localFilename: item.sourceFilename,
  objectKey: item.objectKey,
  durationSeconds: item.durationSeconds,
  actualDurationSeconds: item.technical.actualDurationSeconds,
  durationDeltaSeconds: item.technical.durationDeltaSeconds,
  sizeBytes: item.sizeBytes,
  sha256: item.sha256,
  width: item.technical.width,
  height: item.technical.height,
  fps: item.technical.fps,
  videoCodec: item.technical.videoCodec,
  audioCodec: item.technical.audioCodec,
  fastStart: item.technical.fastStart,
  status: item.status
}));

const csvFields = [
  'week', 'part', 'mediaId', 'title', 'localFilename', 'objectKey',
  'durationSeconds', 'actualDurationSeconds', 'durationDeltaSeconds',
  'sizeBytes', 'sha256', 'width', 'height', 'fps', 'videoCodec',
  'audioCodec', 'fastStart', 'status'
];
const csv = [
  csvFields.join(','),
  ...uploadMap.map((row) => csvFields.map((field) => csvEscape(row[field])).join(','))
].join('\n') + '\n';
const workerCatalog = `// Generated from lcms/academy/data/media-catalog.json.\n// Regenerate only while preparing the catalog; published status changes require review.\nexport const MEDIA_CATALOG = new Map(${JSON.stringify(nextMedia, null, 2)}.map((item) => [\`\${item.week}:\${item.part}\`, item]));\n`;
const checksums = uploadMap.map((item) => `${item.sha256}  ${item.localFilename}`).join('\n') + '\n';

console.log(`LMC privacy WEEK-${pad(week)} catalog sync: ${changes.length} rows`);
console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY_RUN'}`);
for (const item of changes) {
  console.log(`${item.mediaId} | ${item.nextSizeBytes} | ${item.nextSha256} | ${item.objectKey}`);
}

if (!execute) {
  console.log('Dry run only. Catalog files were not changed.');
  process.exit(0);
}

await Promise.all([
  fs.writeFile(catalogPath, `${JSON.stringify(nextCatalog, null, 2)}\n`),
  fs.writeFile(workerCatalogPath, workerCatalog),
  fs.writeFile(uploadJsonPath, `${JSON.stringify(uploadMap, null, 2)}\n`),
  fs.writeFile(uploadCsvPath, csv),
  fs.writeFile(checksumsPath, checksums)
]);

const reportPath = path.join(artifactRoot, `week-${pad(week)}`, `week-${pad(week)}-catalog-sync-report.json`);
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  week,
  status: 'PASS',
  syncedCount: changes.length,
  sourceFiles: {
    technicalQa: path.relative(ROOT, technicalPath).replaceAll('\\', '/'),
    remoteQa: path.relative(ROOT, remotePath).replaceAll('\\', '/'),
    r2Report: path.relative(ROOT, overwritePath).replaceAll('\\', '/')
  },
  outputs: [
    path.relative(ROOT, catalogPath),
    path.relative(ROOT, workerCatalogPath),
    path.relative(ROOT, uploadJsonPath),
    path.relative(ROOT, uploadCsvPath),
    path.relative(ROOT, checksumsPath)
  ].map((item) => item.replaceAll('\\', '/')),
  changes
}, null, 2)}\n`);

console.log(`Catalog sync report: ${reportPath}`);

function validateTechnicalQa(qa, number, expected, rows) {
  assert(Number(qa.week) === number && qa.pass === true, `WEEK-${pad(number)} technical QA is not PASS`);
  assert(qa.technicalPassCount === expected && Array.isArray(qa.results), `WEEK-${pad(number)} technical QA count mismatch`);
  assertExactIds('technical QA', qa.results, rows);
  for (const item of qa.results) {
    assert(Number(item.week) === number && item.pass === true, `${item.mediaId}: technical QA failed`);
    assert(Number.isInteger(item.sizeBytes) && item.sizeBytes > 0, `${item.mediaId}: invalid sizeBytes`);
    assertSha(item.sha256, `${item.mediaId}: invalid SHA-256`);
    assert(item.videoCodec === 'h264' && item.audioCodec === 'aac', `${item.mediaId}: codec mismatch`);
    assert(item.fastStart === true, `${item.mediaId}: Fast Start failed`);
    assert(Math.abs(item.actualDurationSeconds - item.durationBefore) <= 2, `${item.mediaId}: duration tolerance exceeded`);
  }
}

function validateRemoteQa(qa, number, expected, rows) {
  assert(Number(qa.week) === number && qa.overallStatus === 'PASS', `WEEK-${pad(number)} remote QA is not PASS`);
  assert(qa.workerHealth?.status === 200 && qa.workerHealth?.bodyOk === true, 'Worker health check failed');
  assert(qa.remoteObjectIntegrity?.status === 'PASS' && qa.remoteObjectIntegrity?.verifiedCount === expected, 'Remote R2 integrity check failed');
  assert(qa.httpVerification?.status === 'PASS' && qa.httpVerification?.head200 === expected && qa.httpVerification?.range206 === expected, 'Signed HEAD/Range verification failed');
  assert(qa.signedPlayback?.status === 'PASS', 'Signed playback verification failed');
  assert(qa.catalogSyncAllowed === true, 'Remote QA did not allow catalog sync');
  assertExactIds('remote integrity', qa.remoteObjectIntegrity.parts, rows);
  assertExactIds('remote HTTP', qa.httpVerification.parts, rows);
  assert(rows[0] && rows.at(-1), 'Signed playback boundary rows are missing');
  const signedIds = new Set(qa.signedPlayback.parts?.map((item) => item.mediaId));
  assert(signedIds.has(rows[0].mediaId) && signedIds.has(rows.at(-1).mediaId), 'Signed playback must include first and last PART');
}

function validateOverwriteReport(report, number, expected, rows) {
  assert(Number(report.week) === number && report.bucket === 'rsedu-lmc-videos', `WEEK-${pad(number)} overwrite report mismatch`);
  assert(report.uploadedCount === expected && Array.isArray(report.uploaded), `WEEK-${pad(number)} overwrite count mismatch`);
  assertExactIds('R2 overwrite', report.uploaded, rows);
}

function assertExactIds(label, actualRows, expectedRows) {
  assert(Array.isArray(actualRows) && actualRows.length === expectedRows.length, `${label}: row count mismatch`);
  const actual = [...new Set(actualRows.map((item) => item.mediaId))].sort();
  const expected = expectedRows.map((item) => item.mediaId).sort();
  assert(actual.length === expected.length && actual.every((id, index) => id === expected[index]), `${label}: mediaId set mismatch`);
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (key === 'execute') {
      values[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
    values[key] = value;
    index += 1;
  }
  return values;
}

function requirePath(value, flag) {
  if (!value) throw new Error(`${flag} is required`);
  return path.resolve(value);
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

function assertSha(value, message) {
  assert(/^[a-f0-9]{64}$/.test(value || ''), message);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function pad(value) {
  return String(value).padStart(2, '0');
}
