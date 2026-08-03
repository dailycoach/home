import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const COURSE_ID = 'lmc-lifetime-management-counselor';
const manifestArgument = process.argv[2];

if (!manifestArgument) {
  throw new Error('Usage: node scripts/apply-lmc-preflight-manifest.mjs /absolute/path/to/LMC_77_UPLOAD_MANIFEST_FINAL.json');
}

const manifestPath = path.resolve(manifestArgument);
const catalogPath = path.join(ROOT, 'lcms/academy/data/media-catalog.json');
const uploadDirectory = path.join(ROOT, 'lcms/academy/r2-worker/upload');
const uploadJsonPath = path.join(uploadDirectory, 'video-upload-map.json');
const uploadCsvPath = path.join(uploadDirectory, 'video-upload-map.csv');
const workerCatalogPath = path.join(ROOT, 'lcms/academy/r2-worker/src/media-catalog.js');
const checksumsPath = path.join(uploadDirectory, 'LMC_77_SHA256SUMS.txt');

const [manifestText, catalogText] = await Promise.all([
  fs.readFile(manifestPath, 'utf8'),
  fs.readFile(catalogPath, 'utf8')
]);
const manifest = JSON.parse(manifestText);
const catalog = JSON.parse(catalogText);
const measured = Array.isArray(manifest.media) ? manifest.media : [];
const media = catalog.courses?.[COURSE_ID]?.media || [];

assert(manifest.courseId === COURSE_ID, `Unexpected courseId: ${manifest.courseId}`);
assert(manifest.status === 'pending_upload', 'Preflight import must not publish media');
assert(manifest.totalFiles === 77 && measured.length === 77, `Expected 77 manifest rows, got ${measured.length}`);
assert(media.length === 77, `Expected 77 catalog rows, got ${media.length}`);

const measuredById = new Map(measured.map((item) => [item.mediaId, item]));
assert(measuredById.size === 77, 'Manifest mediaId values must be unique');

const nextMedia = media.map((item) => {
  const result = measuredById.get(item.mediaId);
  assert(result, `${item.mediaId}: missing from manifest`);
  assert(result.week === item.week && result.part === item.part, `${item.mediaId}: week/part mismatch`);
  assert(result.objectKey === item.objectKey, `${item.mediaId}: objectKey mismatch`);
  assert(result.localFilename === item.sourceFilename, `${item.mediaId}: filename mismatch`);
  assert(result.title === item.title, `${item.mediaId}: title mismatch`);
  assert(result.expectedDurationSeconds === item.durationSeconds, `${item.mediaId}: expected duration mismatch`);
  assert(result.status === 'pending_upload', `${item.mediaId}: status must remain pending_upload`);
  assert(Number.isInteger(result.sizeBytes) && result.sizeBytes > 0, `${item.mediaId}: invalid sizeBytes`);
  assert(/^[a-f0-9]{64}$/.test(result.sha256 || ''), `${item.mediaId}: invalid sha256`);
  assert(result.videoCodec === 'h264' && result.audioCodec === 'aac', `${item.mediaId}: codec mismatch`);
  assert(result.fastStart === true, `${item.mediaId}: Fast Start not verified`);
  assert(Math.abs(result.actualDurationSeconds - item.durationSeconds) <= 2, `${item.mediaId}: duration tolerance exceeded`);

  return {
    ...item,
    status: 'pending_upload',
    sha256: result.sha256,
    sizeBytes: result.sizeBytes,
    technical: {
      actualDurationSeconds: result.actualDurationSeconds,
      durationDeltaSeconds: result.durationDeltaSeconds,
      width: result.width,
      height: result.height,
      fps: result.fps,
      videoCodec: result.videoCodec,
      audioCodec: result.audioCodec,
      fastStart: result.fastStart
    }
  };
});

const totalBytes = nextMedia.reduce((sum, item) => sum + item.sizeBytes, 0);
const actualDurationSeconds = nextMedia.reduce((sum, item) => sum + item.technical.actualDurationSeconds, 0);
assert(totalBytes === manifest.totalBytes, `Total bytes mismatch: ${totalBytes}/${manifest.totalBytes}`);
assert(Math.abs(actualDurationSeconds - manifest.actualDurationSeconds) < 0.000001, 'Actual duration total mismatch');

const nextCatalog = {
  ...catalog,
  version: '4.1.0',
  updatedAt: String(manifest.generatedAt || '').slice(0, 10),
  courses: {
    ...catalog.courses,
    [COURSE_ID]: {
      ...catalog.courses[COURSE_ID],
      preflight: {
        verifiedAt: manifest.generatedAt,
        totalFiles: manifest.totalFiles,
        totalBytes: manifest.totalBytes,
        expectedDurationSeconds: manifest.expectedDurationSeconds,
        actualDurationSeconds: manifest.actualDurationSeconds,
        videoCodec: 'h264',
        audioCodec: 'aac',
        fastStartFiles: 77,
        durationToleranceSeconds: 2
      },
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

await fs.mkdir(uploadDirectory, { recursive: true });
await Promise.all([
  fs.writeFile(catalogPath, JSON.stringify(nextCatalog, null, 2) + '\n'),
  fs.writeFile(uploadJsonPath, JSON.stringify(uploadMap, null, 2) + '\n'),
  fs.writeFile(uploadCsvPath, csv),
  fs.writeFile(workerCatalogPath, workerCatalog),
  fs.writeFile(checksumsPath, checksums)
]);

console.log(JSON.stringify({
  imported: nextMedia.length,
  totalBytes,
  expectedDurationSeconds: manifest.expectedDurationSeconds,
  actualDurationSeconds,
  status: 'pending_upload'
}, null, 2));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
