#!/usr/bin/env node

import { closeSync, existsSync, openSync, readSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const EXPECTED_FILES = Array.from(
  { length: 11 },
  (_, index) => `week-${String(index + 1).padStart(2, '0')}.mp4`
);
const EXPECTED_SET = new Set(EXPECTED_FILES);
const MAX_TOTAL_BYTES = 4_000_000_000;
const WRANGLER_MAX_BYTES = 315_000_000;

const videoDirectory = process.argv[2] ? resolve(process.argv[2]) : null;
const errors = [];
const reports = [];

if (!videoDirectory) {
  fail('사용법: npm run preflight:videos -- /영상/폴더');
}
if (!existsSync(videoDirectory) || !statSync(videoDirectory).isDirectory()) {
  fail(`영상 폴더를 찾을 수 없습니다: ${videoDirectory}`);
}

const ffprobeCheck = spawnSync('ffprobe', ['-version'], { encoding: 'utf8' });
if (ffprobeCheck.error?.code === 'ENOENT') {
  fail('ffprobe를 찾을 수 없습니다. FFmpeg를 설치한 뒤 다시 실행하세요.');
}
if (ffprobeCheck.status !== 0) {
  fail('ffprobe 실행 상태를 확인하지 못했습니다.');
}

const directoryEntries = readdirSync(videoDirectory, { withFileTypes: true });
const presentFiles = new Set(
  directoryEntries.filter((entry) => entry.isFile()).map((entry) => entry.name)
);
const unexpectedWeekFiles = [...presentFiles]
  .filter((name) => /^week-\d+\.mp4$/i.test(name) && !EXPECTED_SET.has(name))
  .sort();

for (const name of EXPECTED_FILES) {
  if (!presentFiles.has(name)) errors.push(`누락: ${name}`);
}
for (const name of unexpectedWeekFiles) {
  errors.push(
    name.toLowerCase() === 'week-12.mp4'
      ? '12주차는 영상이 없으므로 week-12.mp4를 업로드하면 안 됩니다.'
      : `허용되지 않은 주차 파일: ${name}`
  );
}

let totalBytes = 0;
for (const name of EXPECTED_FILES) {
  if (!presentFiles.has(name)) continue;
  const path = resolve(videoDirectory, name);
  const size = statSync(path).size;
  totalBytes += size;

  const probe = probeVideo(path);
  const atomOrder = inspectTopLevelAtomOrder(path);
  const videoCodecs = probe.streams
    .filter((stream) => stream.codec_type === 'video')
    .map((stream) => stream.codec_name);
  const audioCodecs = probe.streams
    .filter((stream) => stream.codec_type === 'audio')
    .map((stream) => stream.codec_name);
  const formatNames = String(probe.format?.format_name || '').split(',');

  if (!formatNames.includes('mp4')) errors.push(`${name}: MP4 컨테이너가 아닙니다.`);
  if (!videoCodecs.includes('h264')) errors.push(`${name}: H.264 비디오 트랙이 없습니다.`);
  if (!audioCodecs.includes('aac')) errors.push(`${name}: AAC 오디오 트랙이 없습니다.`);
  if (!atomOrder.hasMoov) errors.push(`${name}: moov atom을 찾지 못했습니다.`);
  if (!atomOrder.hasMdat) errors.push(`${name}: mdat atom을 찾지 못했습니다.`);
  if (atomOrder.hasMoov && atomOrder.hasMdat && !atomOrder.fastStart) {
    errors.push(`${name}: Fast Start가 아닙니다(moov atom이 mdat 뒤에 있음).`);
  }

  reports.push({
    name,
    size,
    format: formatNames.join(',') || '-',
    video: videoCodecs.join(',') || '-',
    audio: audioCodecs.join(',') || '-',
    fastStart: atomOrder.fastStart,
    upload: size <= WRANGLER_MAX_BYTES ? 'Wrangler' : 'multipart(rclone/AWS CLI)'
  });
}

if (totalBytes >= MAX_TOTAL_BYTES) {
  errors.push(
    `전체 영상이 4GB 미만이어야 합니다: ${formatBytes(totalBytes)} / 제한 ${formatBytes(MAX_TOTAL_BYTES)}`
  );
}

console.log('\nLMC R2 영상 업로드 사전점검');
console.log(`폴더: ${videoDirectory}`);
for (const report of reports) {
  console.log(
    [
      report.name.padEnd(15),
      formatBytes(report.size).padStart(10),
      `video=${report.video}`,
      `audio=${report.audio}`,
      `fast-start=${report.fastStart ? 'yes' : 'no'}`,
      `upload=${report.upload}`
    ].join(' | ')
  );
}
console.log(`전체 용량: ${formatBytes(totalBytes)} / 4GB 미만`);

if (errors.length) {
  console.error('\n점검 실패');
  errors.forEach((message) => console.error(`- ${message}`));
  console.error('\nmedia-catalog.json은 변경하지 않았습니다.');
  process.exit(1);
}

console.log('\n점검 통과: 11개 파일이 업로드 기술 조건을 충족합니다.');
console.log('이 스크립트는 업로드와 media-catalog.json 변경을 수행하지 않습니다.');

function probeVideo(path) {
  const result = spawnSync(
    'ffprobe',
    [
      '-v', 'error',
      '-show_entries', 'format=format_name,duration,size:stream=codec_type,codec_name',
      '-of', 'json',
      path
    ],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }
  );
  if (result.status !== 0) {
    errors.push(`${path}: ffprobe 실패 — ${compact(result.stderr)}`);
    return { streams: [], format: {} };
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    errors.push(`${path}: ffprobe JSON 결과를 해석하지 못했습니다.`);
    return { streams: [], format: {} };
  }
}

function inspectTopLevelAtomOrder(path) {
  const fileSize = statSync(path).size;
  const descriptor = openSync(path, 'r');
  let offset = 0;
  let moovOffset = null;
  let mdatOffset = null;

  try {
    while (offset + 8 <= fileSize) {
      const header = Buffer.alloc(16);
      const bytesRead = readSync(descriptor, header, 0, 16, offset);
      if (bytesRead < 8) break;

      let atomSize = header.readUInt32BE(0);
      const atomType = header.toString('ascii', 4, 8);
      let headerSize = 8;
      if (atomSize === 1) {
        if (bytesRead < 16) break;
        const extendedSize = header.readBigUInt64BE(8);
        if (extendedSize > BigInt(Number.MAX_SAFE_INTEGER)) break;
        atomSize = Number(extendedSize);
        headerSize = 16;
      } else if (atomSize === 0) {
        atomSize = fileSize - offset;
      }

      if (atomSize < headerSize || offset + atomSize > fileSize) break;
      if (atomType === 'moov' && moovOffset === null) moovOffset = offset;
      if (atomType === 'mdat' && mdatOffset === null) mdatOffset = offset;
      if (moovOffset !== null && mdatOffset !== null) break;
      offset += atomSize;
    }
  } finally {
    closeSync(descriptor);
  }

  return {
    hasMoov: moovOffset !== null,
    hasMdat: mdatOffset !== null,
    fastStart: moovOffset !== null && mdatOffset !== null && moovOffset < mdatOffset
  };
}

function formatBytes(bytes) {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function compact(value) {
  return String(value || '알 수 없는 오류').replace(/\s+/g, ' ').trim().slice(0, 240);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
