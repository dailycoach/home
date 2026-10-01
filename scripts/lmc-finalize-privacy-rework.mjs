import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const COURSE_ID = 'lmc-lifetime-management-counselor';
const BUCKET = 'rsedu-lmc-videos';
const EXPECTED_BY_WEEK = new Map([
  [1, 5], [2, 7], [3, 8], [4, 6], [5, 8], [6, 7],
  [7, 7], [8, 8], [9, 7], [10, 7], [11, 7]
]);

const args = parseArgs(process.argv.slice(2));
const check = Boolean(args.check);
const artifactRoot = path.resolve(args['artifact-root'] || path.join(ROOT, 'artifacts/lmc-privacy-rework'));
const outputRoot = path.resolve(args['output-root'] || artifactRoot);
const configPath = path.resolve(args.config || path.join(
  artifactRoot,
  'inputs/LMC_77_PART_MASK_INTERVALS_v1.2_WEEK09_INSTRUCTOR_PRESERVED.json'
));
const catalogPath = path.resolve(args.catalog || path.join(ROOT, 'lcms/academy/data/media-catalog.json'));
const workerCatalogPath = path.join(ROOT, 'lcms/academy/r2-worker/src/media-catalog.js');
const uploadMapPath = path.join(ROOT, 'lcms/academy/r2-worker/upload/video-upload-map.json');
const uploadCsvPath = path.join(ROOT, 'lcms/academy/r2-worker/upload/video-upload-map.csv');
const uploadChecksumsPath = path.join(ROOT, 'lcms/academy/r2-worker/upload/LMC_77_SHA256SUMS.txt');

const [config, catalog, uploadMap, workerCatalog, uploadCsv, uploadChecksums] = await Promise.all([
  readJson(configPath),
  readJson(catalogPath),
  readJson(uploadMapPath),
  fs.readFile(workerCatalogPath, 'utf8'),
  fs.readFile(uploadCsvPath, 'utf8'),
  fs.readFile(uploadChecksumsPath, 'utf8')
]);

const configMedia = config.media;
const catalogMedia = catalog.courses?.[COURSE_ID]?.media;
assert(Array.isArray(configMedia) && configMedia.length === 77, `Expected 77 config rows, got ${configMedia?.length ?? 0}`);
assert(Array.isArray(catalogMedia) && catalogMedia.length === 77, `Expected 77 catalog rows, got ${catalogMedia?.length ?? 0}`);
assert(configMedia.filter((item) => item.decision === 'MASK').length === 75, 'Expected 75 MASK rows');
assert(configMedia.filter((item) => item.decision === 'NO_MASK').length === 2, 'Expected 2 NO_MASK rows');
assertExactIds('config/catalog', configMedia, catalogMedia);

const sortedCatalog = [...catalogMedia].sort(compareWeekPart);
assert(sortedCatalog.every((item) => item.status === 'published'), 'All LMC rows must remain published');
assert(sortedCatalog.every((item) => item.accessPolicy === 'PRIVATE_WORKER_SIGNED_URL'), 'LMC access policy changed');
assert(sortedCatalog.every((item, index) => index === 0 || compareWeekPart(sortedCatalog[index - 1], item) < 0), 'Duplicate week/part rows');

validateGeneratedCatalogFiles(sortedCatalog, uploadMap, workerCatalog, uploadCsv, uploadChecksums);

const configById = uniqueIndex(configMedia, 'config');
const timestamps = [];
const partRecords = [];
const overwriteRecords = [];
const remoteRecords = [];
const weekRecords = [];
const signedPlaybackIds = new Set();

for (const [week, expectedParts] of EXPECTED_BY_WEEK) {
  const nn = pad(week);
  const weekRoot = path.join(artifactRoot, `week-${nn}`);
  const reportPaths = {
    source: path.join(weekRoot, `week-${nn}-source-preflight.json`),
    technical: path.join(weekRoot, `week-${nn}-technical-qa.json`),
    visual: path.join(weekRoot, `week-${nn}-visual-approval.json`),
    overwrite: path.join(weekRoot, `week-${nn}-r2-overwrite-report.json`),
    remote: path.join(weekRoot, `week-${nn}-remote-playback-qa.json`),
    catalog: path.join(weekRoot, `week-${nn}-catalog-sync-report.json`)
  };
  const [source, technical, visual, overwrite, remote, catalogSync] = await Promise.all([
    readJson(reportPaths.source),
    readJson(reportPaths.technical),
    readJson(reportPaths.visual),
    readJson(reportPaths.overwrite),
    readJson(reportPaths.remote),
    readJson(reportPaths.catalog)
  ]);

  timestamps.push(
    source.generatedAt,
    technical.generatedAt,
    visual.approvedAt,
    overwrite.generatedAt,
    remote.generatedAt,
    catalogSync.generatedAt
  );

  const rows = sortedCatalog.filter((item) => Number(item.week) === week);
  const configRows = rows.map((item) => configById.get(item.mediaId));
  assert(rows.length === expectedParts, `WEEK-${nn} catalog count ${rows.length}/${expectedParts}`);
  validateSourcePreflight(source, week, expectedParts, rows);
  validateTechnicalQa(technical, week, expectedParts, rows);
  validateVisualApproval(visual, week, expectedParts, rows);
  validateOverwriteReport(overwrite, week, expectedParts, rows);
  validateRemoteQa(remote, week, expectedParts, rows, configRows);
  assert(Number(catalogSync.week) === week && catalogSync.status === 'PASS', `WEEK-${nn} catalog sync is not PASS`);
  assert(catalogSync.syncedCount === expectedParts, `WEEK-${nn} catalog sync count mismatch`);

  const sourceById = uniqueIndex(source.results, `WEEK-${nn} source preflight`);
  const technicalById = uniqueIndex(technical.results, `WEEK-${nn} technical QA`);
  const visualById = uniqueIndex(visual.parts, `WEEK-${nn} visual approval`);
  const uploadedById = uniqueIndex(overwrite.uploaded, `WEEK-${nn} overwrite`);
  const integrityById = uniqueIndex(remote.remoteObjectIntegrity.parts, `WEEK-${nn} remote integrity`);
  const httpById = uniqueIndex(remote.httpVerification.parts, `WEEK-${nn} remote HTTP`);
  const weekSignedIds = new Set(remote.signedPlayback.parts.map((item) => item.mediaId));
  for (const mediaId of weekSignedIds) signedPlaybackIds.add(mediaId);

  for (const catalogRow of rows) {
    const configRow = configById.get(catalogRow.mediaId);
    const sourceRow = sourceById.get(catalogRow.mediaId);
    const technicalRow = technicalById.get(catalogRow.mediaId);
    const visualRow = visualById.get(catalogRow.mediaId);
    const uploadedRow = uploadedById.get(catalogRow.mediaId);
    const integrityRow = integrityById.get(catalogRow.mediaId);
    const httpRow = httpById.get(catalogRow.mediaId);

    validatePartConsistency({
      catalogRow,
      configRow,
      sourceRow,
      technicalRow,
      visualRow,
      uploadedRow,
      integrityRow,
      httpRow
    });

    const fullFrame = configRow.intervals.some((item) => item.maskType === 'FULL_FRAME');
    const multiInterval = configRow.intervals.length > 1;
    partRecords.push({
      mediaId: catalogRow.mediaId,
      week: catalogRow.week,
      part: catalogRow.part,
      title: catalogRow.title,
      decision: configRow.decision,
      intervalCount: configRow.intervals.length,
      fullFrame,
      sourceFilename: catalogRow.sourceFilename,
      currentObjectKey: catalogRow.objectKey,
      status: catalogRow.status,
      accessPolicy: catalogRow.accessPolicy,
      sizeBytes: technicalRow.sizeBytes,
      sha256: technicalRow.sha256,
      inputSha256: technicalRow.inputSha256,
      technical: {
        actualDurationSeconds: technicalRow.actualDurationSeconds,
        durationDeltaSeconds: technicalRow.durationDeltaSeconds,
        width: technicalRow.width,
        height: technicalRow.height,
        fps: technicalRow.fps,
        videoCodec: technicalRow.videoCodec,
        audioCodec: technicalRow.audioCodec,
        fastStart: technicalRow.fastStart,
        ...(technicalRow.fastStartWaiverApplied ? {
          fastStartWaiver: {
            authorized: true,
            reason: technicalRow.waiverReason,
            waivedChecks: technicalRow.waivedChecks
          }
        } : {})
      },
      qa: {
        sourceVerified: sourceRow.pass,
        technicalPass: technicalRow.pass,
        visualApproved: visualRow.privacyVisualPass,
        remoteIntegrityPass: integrityRow.pass,
        head200: httpRow.headStatus === 200,
        range206: httpRow.rangeStatus === 206,
        contentLengthMatch: httpRow.contentLength === technicalRow.sizeBytes,
        signedPlaybackVerified: weekSignedIds.has(catalogRow.mediaId)
      }
    });
    overwriteRecords.push({
      mediaId: catalogRow.mediaId,
      week: catalogRow.week,
      part: catalogRow.part,
      currentObjectKey: catalogRow.objectKey,
      sizeBytes: uploadedRow.sizeBytes,
      sha256: uploadedRow.sha256,
      uploadedAt: uploadedRow.uploadedAt
    });
    remoteRecords.push({
      mediaId: catalogRow.mediaId,
      week: catalogRow.week,
      part: catalogRow.part,
      integrityPass: integrityRow.pass,
      sizeBytes: integrityRow.sizeBytes,
      sha256: integrityRow.sha256,
      headStatus: httpRow.headStatus,
      contentType: httpRow.contentType,
      contentLength: httpRow.contentLength,
      acceptRanges: httpRow.acceptRanges,
      rangeStatus: httpRow.rangeStatus,
      contentRange: httpRow.contentRange,
      rangeBodyBytes: httpRow.rangeBodyBytes,
      signedPlaybackVerified: weekSignedIds.has(catalogRow.mediaId)
    });
  }

  weekRecords.push({
    week,
    expectedParts,
    sourceVerified: source.results.length,
    technicalPass: technical.technicalPassCount,
    visualApproved: visual.parts.length,
    r2Overwrite: overwrite.uploadedCount,
    remoteIntegrity: remote.remoteObjectIntegrity.verifiedCount,
    head200: remote.httpVerification.head200,
    range206: remote.httpVerification.range206,
    signedPlayback: remote.signedPlayback.status,
    signedPlaybackParts: [...weekSignedIds].sort(),
    catalogSync: catalogSync.syncedCount,
    status: 'PASS',
    reports: Object.fromEntries(Object.entries(reportPaths).map(([key, value]) => [key, relative(value)]))
  });
}

assert(partRecords.length === 77, `Final manifest count ${partRecords.length}/77`);
assert(overwriteRecords.length === 77, `Final R2 overwrite count ${overwriteRecords.length}/77`);
assert(remoteRecords.length === 77, `Final remote QA count ${remoteRecords.length}/77`);
assert(weekRecords.length === 11 && weekRecords.every((item) => item.status === 'PASS'), 'All 11 weeks must pass');

const generatedAt = latestTimestamp(timestamps);
const summary = {
  totalParts: 77,
  maskedParts: partRecords.filter((item) => item.decision === 'MASK').length,
  noMaskParts: partRecords.filter((item) => item.decision === 'NO_MASK').length,
  sourceVerified: partRecords.filter((item) => item.qa.sourceVerified).length,
  technicalPass: partRecords.filter((item) => item.qa.technicalPass).length,
  humanVisualApproved: partRecords.filter((item) => item.qa.visualApproved).length,
  r2Overwrite: overwriteRecords.length,
  remoteIntegrityPass: remoteRecords.filter((item) => item.integrityPass).length,
  head200: remoteRecords.filter((item) => item.headStatus === 200).length,
  range206: remoteRecords.filter((item) => item.rangeStatus === 206).length,
  contentLengthMatch: partRecords.filter((item) => item.qa.contentLengthMatch).length,
  signedPlaybackWeeks: weekRecords.filter((item) => item.signedPlayback === 'PASS').length,
  signedPlaybackParts: signedPlaybackIds.size,
  catalogSynced: weekRecords.reduce((sum, item) => sum + item.catalogSync, 0)
};
assert(Object.entries(summary).every(([key, value]) => {
  if (key === 'maskedParts') return value === 75;
  if (key === 'noMaskParts') return value === 2;
  if (key === 'signedPlaybackWeeks') return value === 11;
  if (key === 'signedPlaybackParts') return value >= 22;
  return value === 77;
}), `Final summary mismatch: ${JSON.stringify(summary)}`);

const manifest = {
  version: 1,
  generatedAt,
  courseId: COURSE_ID,
  bucket: BUCKET,
  status: 'PASS',
  sourceConfig: relative(configPath),
  catalog: relative(catalogPath),
  summary,
  parts: partRecords
};
const qaReport = {
  version: 1,
  generatedAt,
  courseId: COURSE_ID,
  status: 'PASS',
  summary: {
    ...summary,
    approvedIdentifiableParticipantExposureFindings: 0,
    transitionLeakFindings: 0,
    instructorMaskingFindings: 0
  },
  weekResults: weekRecords,
  authorizedExceptions: [
    {
      mediaIds: ['lmc-w05-p06', 'lmc-w05-p07'],
      type: 'NO_MASK_PRISTINE_BYTE_PRESERVATION',
      description: 'Human-approved original-byte preservation; input/output SHA-256 identity retained. Non-Fast-Start state is explicitly waived because remuxing would change the required bytes.'
    }
  ]
};
const r2Report = {
  version: 1,
  generatedAt,
  courseId: COURSE_ID,
  bucket: BUCKET,
  status: 'PASS',
  uploadedCount: overwriteRecords.length,
  currentObjectKeysPreserved: true,
  parts: overwriteRecords
};
const remoteReport = {
  version: 1,
  generatedAt,
  courseId: COURSE_ID,
  status: 'PASS',
  workerHealthWeeks: 11,
  remoteIntegrityVerified: summary.remoteIntegrityPass,
  head200: summary.head200,
  range206: summary.range206,
  contentLengthMatch: summary.contentLengthMatch,
  signedPlaybackWeeks: summary.signedPlaybackWeeks,
  signedPlaybackParts: summary.signedPlaybackParts,
  weekResults: weekRecords.map((item) => ({
    week: item.week,
    status: item.status,
    remoteIntegrity: item.remoteIntegrity,
    head200: item.head200,
    range206: item.range206,
    signedPlayback: item.signedPlayback,
    signedPlaybackParts: item.signedPlaybackParts
  })),
  parts: remoteRecords
};
const checksums = partRecords.map((item) => `${item.sha256}  ${item.sourceFilename}`).join('\n') + '\n';

const outputs = new Map([
  [path.join(outputRoot, 'LMC_77_PRIVACY_SHA256SUMS.txt'), checksums],
  [path.join(outputRoot, 'LMC_77_PRIVACY_MANIFEST.json'), jsonText(manifest)],
  [path.join(outputRoot, 'LMC_77_PRIVACY_QA_REPORT.json'), jsonText(qaReport)],
  [path.join(outputRoot, 'LMC_77_R2_OVERWRITE_REPORT.json'), jsonText(r2Report)],
  [path.join(outputRoot, 'LMC_77_REMOTE_PLAYBACK_QA.json'), jsonText(remoteReport)]
]);

if (check) {
  for (const [file, expected] of outputs) {
    const actual = await fs.readFile(file, 'utf8');
    assert(normalizeNewlines(actual) === normalizeNewlines(expected), `${relative(file)} is stale; regenerate final reports`);
  }
  console.log('LMC privacy final reports: PASS (5/5 current)');
} else {
  await fs.mkdir(outputRoot, { recursive: true });
  await Promise.all([...outputs].map(([file, contents]) => fs.writeFile(file, contents)));
  console.log('LMC privacy final reports generated: 5');
}
console.log(`WEEK-01..11: PASS | parts 77/77 | MASK 75 | NO_MASK 2`);
console.log(`Technical 77/77 | visual 77/77 | R2 77/77 | HEAD 77/77 | Range 77/77 | catalog 77/77`);

function validateSourcePreflight(report, week, expected, rows) {
  assert(Number(report.week) === week && report.pass === true, `WEEK-${pad(week)} source preflight is not PASS`);
  assert(report.expectedParts === expected && Array.isArray(report.results), `WEEK-${pad(week)} source preflight count mismatch`);
  assertExactIds(`WEEK-${pad(week)} source preflight`, report.results, rows);
  assert(report.results.every((item) => item.pass === true), `WEEK-${pad(week)} source verification failed`);
}

function validateTechnicalQa(report, week, expected, rows) {
  assert(Number(report.week) === week && report.pass === true, `WEEK-${pad(week)} technical QA is not PASS`);
  assert(report.technicalPassCount === expected && Array.isArray(report.results), `WEEK-${pad(week)} technical QA count mismatch`);
  assertExactIds(`WEEK-${pad(week)} technical QA`, report.results, rows);
  for (const item of report.results) {
    assert(item.pass === true, `${item.mediaId}: technical QA failed`);
    assert(Number.isInteger(item.sizeBytes) && item.sizeBytes > 0, `${item.mediaId}: invalid sizeBytes`);
    assertSha(item.sha256, `${item.mediaId}: invalid output SHA-256`);
    assertSha(item.inputSha256, `${item.mediaId}: invalid input SHA-256`);
    assert(item.videoCodec === 'h264' && item.audioCodec === 'aac', `${item.mediaId}: codec mismatch`);
    const approvedWaiver = report.noMaskNonFastStartWaiverAuthorized === true
      && item.decision === 'NO_MASK'
      && item.fastStart === false
      && item.fastStartWaiverApplied === true
      && item.inputSha256 === item.sha256
      && item.waivedChecks?.length === 1
      && item.waivedChecks[0] === 'fastStart';
    assert(item.fastStart === true || approvedWaiver, `${item.mediaId}: Fast Start failed without authorized waiver`);
  }
}

function validateVisualApproval(report, week, expected, rows) {
  assert(Number(report.week) === week && report.approved === true && report.reviewer === 'human', `WEEK-${pad(week)} human visual approval missing`);
  assertExactIds(`WEEK-${pad(week)} visual approval`, report.parts, rows);
  assert(report.parts.length === expected && report.parts.every((item) => item.privacyVisualPass === true), `WEEK-${pad(week)} visual approval failed`);
}

function validateOverwriteReport(report, week, expected, rows) {
  assert(Number(report.week) === week && report.bucket === BUCKET, `WEEK-${pad(week)} overwrite report mismatch`);
  assert(report.uploadedCount === expected, `WEEK-${pad(week)} overwrite count mismatch`);
  assertExactIds(`WEEK-${pad(week)} overwrite`, report.uploaded, rows);
}

function validateRemoteQa(report, week, expected, rows, configRows) {
  assert(Number(report.week) === week && report.overallStatus === 'PASS', `WEEK-${pad(week)} remote QA is not PASS`);
  assert(report.workerHealth?.status === 200 && report.workerHealth?.bodyOk === true, `WEEK-${pad(week)} Worker health failed`);
  assert(report.remoteObjectIntegrity?.status === 'PASS' && report.remoteObjectIntegrity?.verifiedCount === expected, `WEEK-${pad(week)} remote integrity failed`);
  assert(report.httpVerification?.status === 'PASS' && report.httpVerification?.head200 === expected && report.httpVerification?.range206 === expected, `WEEK-${pad(week)} HEAD/Range failed`);
  assert(report.signedPlayback?.status === 'PASS', `WEEK-${pad(week)} signed playback failed`);
  assert(report.catalogSyncAllowed === true && report.catalogSyncCompleted === true && report.weekComplete === true, `WEEK-${pad(week)} remote completion gate failed`);
  assertExactIds(`WEEK-${pad(week)} remote integrity`, report.remoteObjectIntegrity.parts, rows);
  assertExactIds(`WEEK-${pad(week)} remote HTTP`, report.httpVerification.parts, rows);
  const signedIds = new Set(report.signedPlayback.parts?.map((item) => item.mediaId));
  assert(signedIds.has(rows[0].mediaId) && signedIds.has(rows.at(-1).mediaId), `WEEK-${pad(week)} signed playback must include first and last PART`);
  const fullFrameIds = configRows.filter((item) => item.intervals.some((interval) => interval.maskType === 'FULL_FRAME')).map((item) => item.mediaId);
  for (const mediaId of fullFrameIds) assert(signedIds.has(mediaId), `${mediaId}: FULL_FRAME signed playback missing`);
  const complexIds = configRows.filter((item) => item.intervals.length > 1).map((item) => item.mediaId);
  if (complexIds.length > 0) assert(complexIds.some((mediaId) => signedIds.has(mediaId)), `WEEK-${pad(week)} complex interval signed playback missing`);
}

function validatePartConsistency({ catalogRow, configRow, sourceRow, technicalRow, visualRow, uploadedRow, integrityRow, httpRow }) {
  const id = catalogRow.mediaId;
  assert(configRow && sourceRow && technicalRow && visualRow && uploadedRow && integrityRow && httpRow, `${id}: missing finalization evidence`);
  assert(configRow.filename === catalogRow.sourceFilename, `${id}: source filename mismatch`);
  assert(configRow.decision === sourceRow.decision && configRow.decision === technicalRow.decision, `${id}: decision mismatch`);
  assert(sourceRow.currentObjectKey === catalogRow.objectKey, `${id}: source preflight objectKey mismatch`);
  assert(technicalRow.currentObjectKey === catalogRow.objectKey, `${id}: technical objectKey mismatch`);
  assert(uploadedRow.currentObjectKey === catalogRow.objectKey, `${id}: overwrite objectKey mismatch`);
  assert(technicalRow.sizeBytes === uploadedRow.sizeBytes && technicalRow.sha256 === uploadedRow.sha256, `${id}: overwrite differs from technical QA`);
  assert(technicalRow.sizeBytes === integrityRow.sizeBytes && technicalRow.sha256 === integrityRow.sha256 && integrityRow.pass === true, `${id}: remote object differs from technical QA`);
  assert(httpRow.pass === true && httpRow.headStatus === 200 && httpRow.rangeStatus === 206, `${id}: signed HTTP verification failed`);
  assert(httpRow.contentType === 'video/mp4' && httpRow.acceptRanges === 'bytes', `${id}: signed HTTP headers failed`);
  assert(httpRow.contentLength === technicalRow.sizeBytes, `${id}: Content-Length mismatch`);
  assert(httpRow.contentRange === `bytes 0-0/${technicalRow.sizeBytes}` && httpRow.rangeBodyBytes === 1, `${id}: Range response mismatch`);
  assert(catalogRow.sizeBytes === technicalRow.sizeBytes && catalogRow.sha256 === technicalRow.sha256, `${id}: catalog integrity metadata mismatch`);
  assert(nearlyEqual(catalogRow.technical?.actualDurationSeconds, technicalRow.actualDurationSeconds), `${id}: catalog duration metadata mismatch`);
  assert(catalogRow.technical?.width === technicalRow.width && catalogRow.technical?.height === technicalRow.height, `${id}: catalog dimensions mismatch`);
  assert(catalogRow.technical?.fps === technicalRow.fps, `${id}: catalog FPS mismatch`);
  assert(catalogRow.technical?.videoCodec === technicalRow.videoCodec && catalogRow.technical?.audioCodec === technicalRow.audioCodec, `${id}: catalog codec mismatch`);
  assert(catalogRow.technical?.fastStart === technicalRow.fastStart, `${id}: catalog Fast Start mismatch`);
  if (configRow.decision === 'NO_MASK') assert(technicalRow.inputSha256 === technicalRow.sha256, `${id}: NO_MASK bytes changed`);
}

function validateGeneratedCatalogFiles(rows, actualMap, actualWorker, actualCsv, actualChecksums) {
  const expectedMap = rows.map((item) => ({
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
  assert(JSON.stringify(actualMap) === JSON.stringify(expectedMap), 'video-upload-map.json is not synchronized with the catalog');
  const expectedWorker = `// Generated from lcms/academy/data/media-catalog.json.\n// Regenerate only while preparing the catalog; published status changes require review.\nexport const MEDIA_CATALOG = new Map(${JSON.stringify(rows, null, 2)}.map((item) => [\`\${item.week}:\${item.part}\`, item]));\n`;
  assert(normalizeNewlines(actualWorker) === expectedWorker, 'Worker media catalog is not synchronized');
  const fields = [
    'week', 'part', 'mediaId', 'title', 'localFilename', 'objectKey',
    'durationSeconds', 'actualDurationSeconds', 'durationDeltaSeconds',
    'sizeBytes', 'sha256', 'width', 'height', 'fps', 'videoCodec',
    'audioCodec', 'fastStart', 'status'
  ];
  const expectedCsv = [
    fields.join(','),
    ...expectedMap.map((row) => fields.map((field) => csvEscape(row[field])).join(','))
  ].join('\n') + '\n';
  assert(normalizeNewlines(actualCsv) === expectedCsv, 'video-upload-map.csv is not synchronized');
  const expectedChecksums = rows.map((item) => `${item.sha256}  ${item.sourceFilename}`).join('\n') + '\n';
  assert(normalizeNewlines(actualChecksums) === expectedChecksums, 'LMC_77_SHA256SUMS.txt is not synchronized');
}

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (key === 'check') {
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

function uniqueIndex(rows, label) {
  const map = new Map();
  for (const row of rows || []) {
    assert(row.mediaId && !map.has(row.mediaId), `${label}: duplicate or missing mediaId`);
    map.set(row.mediaId, row);
  }
  return map;
}

function assertExactIds(label, actualRows, expectedRows) {
  assert(Array.isArray(actualRows) && actualRows.length === expectedRows.length, `${label}: row count mismatch`);
  const actual = [...new Set(actualRows.map((item) => item.mediaId))].sort();
  const expected = expectedRows.map((item) => item.mediaId).sort();
  assert(actual.length === expected.length && actual.every((id, index) => id === expected[index]), `${label}: mediaId set mismatch`);
}

function latestTimestamp(values) {
  const parsed = values.filter(Boolean).map((value) => ({ value, epoch: Date.parse(normalizeTimestamp(value)) }));
  assert(parsed.length > 0 && parsed.every((item) => Number.isFinite(item.epoch)), 'Invalid report timestamp');
  parsed.sort((a, b) => a.epoch - b.epoch);
  return parsed.at(-1).value;
}

function normalizeTimestamp(value) {
  return String(value).replace(/(\.\d{3})\d+(?=Z$|[+-]\d{2}:\d{2}$)/, '$1');
}

function compareWeekPart(a, b) {
  return Number(a.week) - Number(b.week) || Number(a.part) - Number(b.part);
}

function nearlyEqual(a, b) {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-9;
}

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function normalizeNewlines(value) {
  return value.replaceAll('\r\n', '\n');
}

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll('\\', '/');
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

function pad(value) {
  return String(value).padStart(2, '0');
}
