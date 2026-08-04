#!/usr/bin/env node

import { closeSync, createReadStream, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CATALOG_PATH = resolve(SCRIPT_DIR, '../../data/media-catalog.json');
const COURSE_ID = 'lmc-lifetime-management-counselor';
const EXPECTED_COUNTS = { 1: 5, 2: 7, 3: 8, 4: 6, 5: 8, 6: 7, 7: 7, 8: 8, 9: 7, 10: 7, 11: 7 };
const MAX_TOTAL_BYTES = 4_000_000_000;
const WRANGLER_MAX_BYTES = 315_000_000;
const DURATION_TOLERANCE_SECONDS = 2;
const catalogOnly = process.argv.includes('--catalog-only');
const directoryArgument = process.argv.slice(2).find((value) => !value.startsWith('--'));
const videoDirectory = directoryArgument ? resolve(directoryArgument) : null;
const errors = [];
const reports = [];

const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
const media = catalog.courses?.[COURSE_ID]?.media || [];
validateCatalog(media);

if (catalogOnly) finishCatalogOnly();
if (!videoDirectory) fail('사용법: node scripts/preflight-segmented-videos.mjs /영상/폴더 또는 --catalog-only');
if (!existsSync(videoDirectory) || !statSync(videoDirectory).isDirectory()) fail(`영상 폴더를 찾을 수 없습니다: ${videoDirectory}`);

const ffprobeCheck = spawnSync('ffprobe', ['-version'], { encoding: 'utf8' });
if (ffprobeCheck.error?.code === 'ENOENT') fail('ffprobe를 찾을 수 없습니다. FFmpeg를 설치한 뒤 다시 실행하세요.');
if (ffprobeCheck.status !== 0) fail('ffprobe 실행 상태를 확인하지 못했습니다.');

const expectedFiles = new Set(media.map((item) => item.sourceFilename));
const presentFiles = new Set(readdirSync(videoDirectory, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name));
for (const name of expectedFiles) if (!presentFiles.has(name)) errors.push(`누락: ${name}`);
for (const name of presentFiles) {
  if (/WEEK12|week-12/i.test(name) && /\.mp4$/i.test(name)) errors.push(`WEEK-12 영상 금지: ${name}`);
  else if (/^LMC_WEEK\d+_P\d+_.+\.mp4$/i.test(name) && !expectedFiles.has(name)) errors.push(`카탈로그에 없는 분할영상: ${name}`);
}

let totalBytes = 0;
for (const item of media) {
  if (!presentFiles.has(item.sourceFilename)) continue;
  const filePath = resolve(videoDirectory, item.sourceFilename);
  const sizeBytes = statSync(filePath).size;
  totalBytes += sizeBytes;
  const probe = probeVideo(filePath);
  const atomOrder = inspectTopLevelAtomOrder(filePath);
  const videoStreams = probe.streams.filter((stream) => stream.codec_type === 'video');
  const audioStreams = probe.streams.filter((stream) => stream.codec_type === 'audio');
  const videoCodecs = videoStreams.map((stream) => stream.codec_name);
  const audioCodecs = audioStreams.map((stream) => stream.codec_name);
  const formatNames = String(probe.format?.format_name || '').split(',');
  const actualDuration = Number(probe.format?.duration || 0);
  const durationDelta = Math.abs(actualDuration - item.durationSeconds);
  if (!formatNames.includes('mp4')) errors.push(`${item.sourceFilename}: MP4 컨테이너가 아닙니다.`);
  if (!videoStreams.length) errors.push(`${item.sourceFilename}: 비디오 트랙이 없습니다.`);
  if (!audioStreams.length) errors.push(`${item.sourceFilename}: 오디오 트랙이 없습니다.`);
  if (!videoCodecs.includes('h264')) errors.push(`${item.sourceFilename}: H.264 비디오 트랙이 없습니다.`);
  if (!audioCodecs.includes('aac')) errors.push(`${item.sourceFilename}: AAC 오디오 트랙이 없습니다.`);
  if (!atomOrder.hasMoov) errors.push(`${item.sourceFilename}: moov atom을 찾지 못했습니다.`);
  if (!atomOrder.hasMdat) errors.push(`${item.sourceFilename}: mdat atom을 찾지 못했습니다.`);
  if (atomOrder.hasMoov && atomOrder.hasMdat && !atomOrder.fastStart) errors.push(`${item.sourceFilename}: Fast Start가 아닙니다.`);
  if (!Number.isFinite(actualDuration) || durationDelta > DURATION_TOLERANCE_SECONDS) errors.push(`${item.sourceFilename}: 러닝타임 오차 ${durationDelta.toFixed(2)}초(허용 ${DURATION_TOLERANCE_SECONDS}초).`);
  const primaryVideo = videoStreams[0] || {};
  reports.push({
    mediaId: item.mediaId,
    name: item.sourceFilename,
    objectKey: item.objectKey,
    sizeBytes,
    sha256: await sha256(filePath),
    durationSeconds: actualDuration,
    expectedDurationSeconds: item.durationSeconds,
    width: Number(primaryVideo.width || 0),
    height: Number(primaryVideo.height || 0),
    fps: primaryVideo.r_frame_rate || '',
    video: videoCodecs.join(',') || '-',
    audio: audioCodecs.join(',') || '-',
    fastStart: atomOrder.fastStart,
    upload: sizeBytes <= WRANGLER_MAX_BYTES ? 'Wrangler' : 'multipart(rclone/S3)'
  });
}

if (totalBytes >= MAX_TOTAL_BYTES) errors.push(`전체 영상이 4GB 미만이어야 합니다: ${formatBytes(totalBytes)}.`);
console.log('\nLMC 77파트 R2 업로드 사전점검');
console.log(`폴더: ${videoDirectory}`);
for (const report of reports) console.log(`${report.mediaId} | ${formatBytes(report.sizeBytes)} | ${report.width}x${report.height} | fps=${report.fps} | video=${report.video} | audio=${report.audio} | fast-start=${report.fastStart ? 'yes' : 'no'} | sha256=${report.sha256}`);
console.log(`전체 용량: ${formatBytes(totalBytes)} / 4GB 미만`);
if (errors.length) {
  console.error('\n점검 실패');
  errors.forEach((message) => console.error(`- ${message}`));
  console.error('\n업로드·카탈로그 상태 변경은 수행하지 않았습니다.');
  process.exit(1);
}
console.log('\n점검 통과: 77개 분할영상이 업로드 기술 조건을 충족합니다.');
console.log('이 스크립트는 업로드와 media-catalog.json 변경을 수행하지 않습니다.');

function validateCatalog(items) {
  if (!Array.isArray(items) || items.length !== 77) errors.push(`카탈로그 영상 수: ${items.length || 0}/77`);
  const ids = new Set();
  const partIds = new Set();
  const keys = new Set();
  const names = new Set();
  for (const item of items) {
    if (item.courseId !== COURSE_ID) errors.push(`${item.mediaId}: courseId 불일치`);
    if (!Number.isInteger(item.week) || item.week < 1 || item.week > 11) errors.push(`${item.mediaId}: week 범위 오류`);
    if (!Number.isInteger(item.part) || item.part < 1) errors.push(`${item.mediaId}: part 범위 오류`);
    if (!item.title || !Number.isInteger(item.durationSeconds) || item.durationSeconds <= 0) errors.push(`${item.mediaId}: 제목 또는 러닝타임 누락`);
    if (!/^lmc-w\d{2}-p\d{2}$/.test(item.mediaId || '')) errors.push(`${item.mediaId}: mediaId 형식 오류`);
    if (!/^week-\d{2}-part-\d{2}$/.test(item.partId || '')) errors.push(`${item.mediaId}: partId 형식 오류`);
    const keyMatch = item.objectKey?.match(/^lmc\/v2\/week-(\d{2})\/LMC_WEEK(\d{2})_P(\d{2})_[A-Za-z0-9()_-]+\.mp4$/);
    if (!keyMatch || Number(keyMatch[1]) !== item.week || Number(keyMatch[2]) !== item.week || Number(keyMatch[3]) !== item.part) errors.push(`${item.mediaId}: objectKey 규칙 불일치`);
    if (!/^LMC_WEEK\d{2}_P\d{2}_[a-z0-9-]+\.mp4$/.test(item.sourceFilename || '')) errors.push(`${item.mediaId}: sourceFilename 형식 오류`);
    if (!['pending_upload', 'uploaded_unverified', 'verified', 'published', 'disabled'].includes(item.status)) errors.push(`${item.mediaId}: 허용되지 않은 상태 ${item.status}`);
    if (ids.has(item.mediaId)) errors.push(`mediaId 중복: ${item.mediaId}`); ids.add(item.mediaId);
    if (partIds.has(item.partId)) errors.push(`partId 중복: ${item.partId}`); partIds.add(item.partId);
    if (keys.has(item.objectKey)) errors.push(`objectKey 중복: ${item.objectKey}`); keys.add(item.objectKey);
    if (names.has(item.sourceFilename)) errors.push(`sourceFilename 중복: ${item.sourceFilename}`); names.add(item.sourceFilename);
  }
  for (const [week, count] of Object.entries(EXPECTED_COUNTS)) {
    const actual = items.filter((item) => item.week === Number(week)).length;
    if (actual !== count) errors.push(`WEEK-${String(week).padStart(2, '0')} 개수: ${actual}/${count}`);
  }
  if (items.some((item) => item.week === 12)) errors.push('WEEK-12에는 영상이 없어야 합니다.');
  const catalogDuration = items.reduce((sum, item) => sum + Number(item.durationSeconds || 0), 0);
  if (Math.abs(catalogDuration - 74665) > 5) errors.push(`전체 러닝타임이 약 20시간 44분 25초 범위를 벗어났습니다: ${catalogDuration}초`);
}

function finishCatalogOnly() {
  if (errors.length) { errors.forEach((message) => console.error(`- ${message}`)); process.exit(1); }
  console.log(`LMC segmented catalog check passed: ${media.length} parts, ${media.reduce((sum, item) => sum + item.durationSeconds, 0)} seconds.`);
  process.exit(0);
}

function probeVideo(filePath) {
  const result = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=format_name,duration,size:stream=codec_type,codec_name,width,height,r_frame_rate', '-of', 'json', filePath], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) { errors.push(`${filePath}: ffprobe 실패 — ${compact(result.stderr)}`); return { streams: [], format: {} }; }
  try { return JSON.parse(result.stdout); } catch { errors.push(`${filePath}: ffprobe JSON 결과를 해석하지 못했습니다.`); return { streams: [], format: {} }; }
}

function inspectTopLevelAtomOrder(filePath) {
  const fileSize = statSync(filePath).size;
  const descriptor = openSync(filePath, 'r');
  let offset = 0; let moovOffset = null; let mdatOffset = null;
  try {
    while (offset + 8 <= fileSize) {
      const header = Buffer.alloc(16); const bytesRead = readSync(descriptor, header, 0, 16, offset); if (bytesRead < 8) break;
      let atomSize = header.readUInt32BE(0); const atomType = header.toString('ascii', 4, 8); let headerSize = 8;
      if (atomSize === 1) { if (bytesRead < 16) break; const extended = header.readBigUInt64BE(8); if (extended > BigInt(Number.MAX_SAFE_INTEGER)) break; atomSize = Number(extended); headerSize = 16; }
      else if (atomSize === 0) atomSize = fileSize - offset;
      if (atomSize < headerSize || offset + atomSize > fileSize) break;
      if (atomType === 'moov' && moovOffset === null) moovOffset = offset;
      if (atomType === 'mdat' && mdatOffset === null) mdatOffset = offset;
      if (moovOffset !== null && mdatOffset !== null) break;
      offset += atomSize;
    }
  } finally { closeSync(descriptor); }
  return { hasMoov: moovOffset !== null, hasMdat: mdatOffset !== null, fastStart: moovOffset !== null && mdatOffset !== null && moovOffset < mdatOffset };
}

function sha256(filePath) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash('sha256');
    const input = createReadStream(filePath);
    input.on('error', reject); input.on('data', (chunk) => hash.update(chunk)); input.on('end', () => resolveHash(hash.digest('hex')));
  });
}

function formatBytes(bytes) { return bytes >= 1_000_000_000 ? `${(bytes / 1_000_000_000).toFixed(2)} GB` : `${(bytes / 1_000_000).toFixed(1)} MB`; }
function compact(value) { return String(value || '알 수 없는 오류').replace(/\s+/g, ' ').trim().slice(0, 240); }
function fail(message) { console.error(message); process.exit(1); }
