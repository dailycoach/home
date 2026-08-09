import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const COURSE_ID = 'lmc-lifetime-management-counselor';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const CATALOG_PATH = path.join(REPO_ROOT, 'lcms/academy/data/media-catalog.json');
const DEFAULT_CONFIG = path.join(REPO_ROOT, 'lcms/academy/privacy/zoom-tile-masks.json');
const VALID_DECISIONS = new Set(['REVIEW_REQUIRED', 'NO_MASK', 'MASK']);

const [command = 'help', ...rest] = process.argv.slice(2);
const args = parseArgs(rest);

if (command === 'help' || args.help) {
  printHelp();
  process.exit(0);
}

const catalog = JSON.parse(await fs.readFile(CATALOG_PATH, 'utf8'));
const media = catalog.courses?.[COURSE_ID]?.media;
if (!Array.isArray(media) || media.length !== 77) {
  throw new Error(`Expected 77 LMC media rows, got ${media?.length ?? 0}`);
}

if (command === 'init') {
  await initConfig(args.config || DEFAULT_CONFIG);
} else if (command === 'apply') {
  await applyMasks(args);
} else if (command === 'qa') {
  await runQa(args);
} else {
  throw new Error(`Unknown command: ${command}`);
}

async function initConfig(configPath) {
  const output = path.resolve(configPath);
  await fs.mkdir(path.dirname(output), { recursive: true });
  const config = {
    version: 1,
    generatedAt: new Date().toISOString(),
    courseId: COURSE_ID,
    maskColor: '#111111',
    defaultPadding: 8,
    media: Object.fromEntries(
      media.map((item) => [
        item.mediaId,
        {
          week: item.week,
          part: item.part,
          objectKey: item.objectKey,
          decision: 'REVIEW_REQUIRED',
          intervals: []
        }
      ])
    )
  };
  await fs.writeFile(output, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Created privacy review config: ${output}`);
  console.log('All 77 rows are REVIEW_REQUIRED. Review every video before apply.');
}

async function applyMasks(options) {
  const inputRoot = requirePath(options['input-root'], '--input-root');
  const outputRoot = requirePath(options['output-root'], '--output-root');
  const configPath = path.resolve(options.config || DEFAULT_CONFIG);
  const reportPath = path.resolve(
    options.report || path.join(outputRoot, 'privacy-apply-report.json')
  );
  const config = await loadAndValidateConfig(configPath, { final: true });
  assertBinary('ffmpeg');
  assertBinary('ffprobe');

  const results = [];
  for (const item of media) {
    const decision = config.media[item.mediaId];
    const input = objectPath(inputRoot, item.objectKey);
    const output = objectPath(outputRoot, item.objectKey);
    await fs.access(input);
    await fs.mkdir(path.dirname(output), { recursive: true });

    const original = probe(input);
    if (decision.decision === 'NO_MASK') {
      await fs.copyFile(input, output);
      results.push(await buildResult(item, input, output, original, 'COPIED_NO_MASK'));
      console.log(`${item.mediaId} | NO_MASK | copied`);
      continue;
    }

    const filters = buildDrawboxFilters(decision, original, config);
    if (!filters.length) {
      throw new Error(`${item.mediaId}: MASK requires at least one valid region`);
    }

    run('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-i', input,
      '-map', '0:v:0',
      '-map', '0:a?',
      '-vf', filters.join(','),
      '-c:v', 'libx264',
      '-preset', 'slow',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      output
    ]);

    results.push(await buildResult(item, input, output, original, 'MASKED'));
    console.log(`${item.mediaId} | MASK | ${decision.intervals.length} intervals`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    courseId: COURSE_ID,
    inputRoot,
    outputRoot,
    mediaCount: results.length,
    masked: results.filter((x) => x.action === 'MASKED').length,
    noMask: results.filter((x) => x.action === 'COPIED_NO_MASK').length,
    results
  };
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Apply report: ${reportPath}`);
}

async function runQa(options) {
  const inputRoot = requirePath(options['input-root'], '--input-root');
  const outputRoot = requirePath(options['output-root'], '--output-root');
  const configPath = path.resolve(options.config || DEFAULT_CONFIG);
  const artifactRoot = path.resolve(
    options['artifact-root'] || path.join(outputRoot, '_privacy_qa')
  );
  const reportPath = path.resolve(
    options.report || path.join(artifactRoot, 'privacy-report.json')
  );
  const config = await loadAndValidateConfig(configPath, { final: true });
  assertBinary('ffmpeg');
  assertBinary('ffprobe');

  await fs.mkdir(artifactRoot, { recursive: true });
  const rows = [];
  const failures = [];

  for (const item of media) {
    const input = objectPath(inputRoot, item.objectKey);
    const output = objectPath(outputRoot, item.objectKey);
    const decision = config.media[item.mediaId];
    try {
      await fs.access(input);
      await fs.access(output);
      const before = probe(input);
      const after = probe(output);
      const durationDelta = Math.abs(after.duration - before.duration);
      const sameResolution = before.width === after.width && before.height === after.height;
      const videoOk = after.videoCodec === 'h264';
      const audioOk = before.audioCodec ? after.audioCodec === before.audioCodec : true;
      const durationOk = durationDelta <= 0.75;
      const fastStart = await isFastStart(output);
      const sha256 = await sha256File(output);
      const stat = await fs.stat(output);
      const screenshots = [];

      if (decision.decision === 'MASK') {
        const mediaArtifactDir = path.join(artifactRoot, item.mediaId);
        await fs.mkdir(mediaArtifactDir, { recursive: true });
        for (let i = 0; i < decision.intervals.length; i += 1) {
          const interval = decision.intervals[i];
          const samples = sampleTimes(interval.start, interval.end);
          for (let j = 0; j < samples.length; j += 1) {
            const filename = `interval-${String(i + 1).padStart(2, '0')}-${['start', 'mid', 'end'][j]}.jpg`;
            const screenshot = path.join(mediaArtifactDir, filename);
            run('ffmpeg', [
              '-hide_banner',
              '-loglevel', 'error',
              '-y',
              '-ss', String(samples[j]),
              '-i', output,
              '-frames:v', '1',
              '-q:v', '2',
              screenshot
            ]);
            screenshots.push(path.relative(artifactRoot, screenshot));
          }
        }
      }

      const technicalPass = sameResolution && videoOk && audioOk && durationOk && fastStart;
      if (!technicalPass) {
        failures.push(`${item.mediaId}: technical QA failed`);
      }
      rows.push({
        mediaId: item.mediaId,
        week: item.week,
        part: item.part,
        objectKey: item.objectKey,
        decision: decision.decision,
        technicalPass,
        visualReviewRequired: decision.decision === 'MASK',
        durationBefore: before.duration,
        durationAfter: after.duration,
        durationDelta,
        width: after.width,
        height: after.height,
        videoCodec: after.videoCodec,
        audioCodec: after.audioCodec,
        fastStart,
        sizeBytes: stat.size,
        sha256,
        screenshots
      });
      console.log(`${item.mediaId} | QA ${technicalPass ? 'PASS' : 'FAIL'} | ${decision.decision}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${item.mediaId}: ${message}`);
      rows.push({
        mediaId: item.mediaId,
        week: item.week,
        part: item.part,
        objectKey: item.objectKey,
        decision: decision.decision,
        technicalPass: false,
        error: message
      });
      console.error(`${item.mediaId} | QA FAIL | ${message}`);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    courseId: COURSE_ID,
    mediaCount: rows.length,
    maskedCount: rows.filter((x) => x.decision === 'MASK').length,
    noMaskCount: rows.filter((x) => x.decision === 'NO_MASK').length,
    technicalPassCount: rows.filter((x) => x.technicalPass).length,
    technicalFailCount: rows.filter((x) => !x.technicalPass).length,
    visualReviewRequiredCount: rows.filter((x) => x.visualReviewRequired).length,
    r2ReplacementAllowed: failures.length === 0 && rows.length === 77,
    note: 'MASK rows still require human visual approval of generated QA frames before R2 replacement.',
    failures,
    rows
  };
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`QA report: ${reportPath}`);
  if (failures.length) process.exitCode = 1;
}

async function loadAndValidateConfig(configPath, { final }) {
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  if (config.courseId && config.courseId !== COURSE_ID) {
    throw new Error(`Config courseId must be ${COURSE_ID}`);
  }
  if (!config.media || typeof config.media !== 'object') {
    throw new Error('Config must contain media object');
  }

  for (const item of media) {
    const row = config.media[item.mediaId];
    if (!row) throw new Error(`Missing config row: ${item.mediaId}`);
    if (!VALID_DECISIONS.has(row.decision)) {
      throw new Error(`${item.mediaId}: invalid decision ${row.decision}`);
    }
    if (final && row.decision === 'REVIEW_REQUIRED') {
      throw new Error(`${item.mediaId}: REVIEW_REQUIRED remains; final processing is blocked`);
    }
    if (!Array.isArray(row.intervals)) {
      throw new Error(`${item.mediaId}: intervals must be an array`);
    }
    if (row.decision === 'NO_MASK' && row.intervals.length) {
      throw new Error(`${item.mediaId}: NO_MASK cannot contain intervals`);
    }
    if (row.decision === 'MASK' && !row.intervals.length) {
      throw new Error(`${item.mediaId}: MASK requires intervals`);
    }
    for (const interval of row.intervals) validateInterval(item.mediaId, interval);
  }
  return config;
}

function validateInterval(mediaId, interval) {
  const start = Number(interval.start);
  const end = Number(interval.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
    throw new Error(`${mediaId}: invalid interval ${interval.start}-${interval.end}`);
  }
  if (!Array.isArray(interval.regions) || !interval.regions.length) {
    throw new Error(`${mediaId}: interval requires regions`);
  }
  for (const region of interval.regions) {
    for (const key of ['x', 'y', 'w', 'h']) {
      if (!Number.isFinite(Number(region[key]))) {
        throw new Error(`${mediaId}: region ${key} must be numeric`);
      }
    }
    if (Number(region.w) <= 0 || Number(region.h) <= 0) {
      throw new Error(`${mediaId}: region width/height must be positive`);
    }
  }
}

function buildDrawboxFilters(decision, original, config) {
  const color = ffmpegColor(config.maskColor || '#111111');
  const defaultPadding = nonNegativeNumber(config.defaultPadding, 8);
  const filters = [];
  for (const interval of decision.intervals) {
    for (const region of interval.regions) {
      const pad = nonNegativeNumber(region.padding, defaultPadding);
      const x = Math.max(0, Math.floor(Number(region.x) - pad));
      const y = Math.max(0, Math.floor(Number(region.y) - pad));
      const maxW = Math.max(1, original.width - x);
      const maxH = Math.max(1, original.height - y);
      const w = Math.min(maxW, Math.ceil(Number(region.w) + pad * 2));
      const h = Math.min(maxH, Math.ceil(Number(region.h) + pad * 2));
      filters.push(
        `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${color}@1.0:t=fill:enable='between(t,${Number(interval.start)},${Number(interval.end)})'`
      );
    }
  }
  return filters;
}

function probe(file) {
  const result = run('ffprobe', [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    file
  ]);
  const value = JSON.parse(result.stdout);
  const video = value.streams?.find((stream) => stream.codec_type === 'video');
  const audio = value.streams?.find((stream) => stream.codec_type === 'audio');
  if (!video) throw new Error(`No video stream: ${file}`);
  const duration = Number(value.format?.duration ?? video.duration);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Invalid duration: ${file}`);
  return {
    duration,
    width: Number(video.width),
    height: Number(video.height),
    videoCodec: video.codec_name || null,
    audioCodec: audio?.codec_name || null
  };
}

async function buildResult(item, input, output, before, action) {
  const after = probe(output);
  const stat = await fs.stat(output);
  return {
    mediaId: item.mediaId,
    objectKey: item.objectKey,
    action,
    durationBefore: before.duration,
    durationAfter: after.duration,
    durationDelta: Math.abs(after.duration - before.duration),
    width: after.width,
    height: after.height,
    videoCodec: after.videoCodec,
    audioCodec: after.audioCodec,
    sizeBytes: stat.size,
    sha256: await sha256File(output)
  };
}

async function sha256File(file) {
  const handle = await fs.open(file, 'r');
  const hash = crypto.createHash('sha256');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let position = 0;
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
      if (!bytesRead) break;
      hash.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
  } finally {
    await handle.close();
  }
  return hash.digest('hex');
}

async function isFastStart(file) {
  const stat = await fs.stat(file);
  const handle = await fs.open(file, 'r');
  try {
    let offset = 0;
    let moovOffset = null;
    let mdatOffset = null;
    while (offset + 8 <= stat.size && offset < 64 * 1024 * 1024) {
      const header = Buffer.alloc(16);
      const { bytesRead } = await handle.read(header, 0, 16, offset);
      if (bytesRead < 8) break;
      let size = header.readUInt32BE(0);
      const type = header.toString('ascii', 4, 8);
      let headerSize = 8;
      if (size === 1) {
        if (bytesRead < 16) break;
        size = Number(header.readBigUInt64BE(8));
        headerSize = 16;
      } else if (size === 0) {
        size = stat.size - offset;
      }
      if (!Number.isFinite(size) || size < headerSize) break;
      if (type === 'moov' && moovOffset === null) moovOffset = offset;
      if (type === 'mdat' && mdatOffset === null) mdatOffset = offset;
      if (moovOffset !== null && mdatOffset !== null) return moovOffset < mdatOffset;
      offset += size;
    }
    return false;
  } finally {
    await handle.close();
  }
}

function sampleTimes(startValue, endValue) {
  const start = Number(startValue);
  const end = Number(endValue);
  const epsilon = Math.min(0.25, Math.max(0.02, (end - start) / 10));
  const values = [start + epsilon, (start + end) / 2, end - epsilon];
  return values.map((value) => Math.max(start, Math.min(end, value)));
}

function objectPath(root, objectKey) {
  const base = path.resolve(root);
  const candidate = path.resolve(base, ...String(objectKey).split('/'));
  if (candidate !== base && !candidate.startsWith(`${base}${path.sep}`)) {
    throw new Error(`Unsafe object key path: ${objectKey}`);
  }
  return candidate;
}

function run(binary, argv) {
  const result = spawnSync(binary, argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${binary} failed (${result.status}): ${result.stderr || result.stdout}`.trim());
  }
  return result;
}

function assertBinary(binary) {
  const result = spawnSync(binary, ['-version'], { encoding: 'utf8', stdio: 'ignore' });
  if (result.error || result.status !== 0) throw new Error(`${binary} is required`);
}

function ffmpegColor(value) {
  const text = String(value).trim();
  if (/^#[0-9a-f]{6}$/i.test(text)) return `0x${text.slice(1)}`;
  if (/^[A-Za-z]+$/.test(text)) return text;
  throw new Error(`Invalid maskColor: ${value}`);
}

function nonNegativeNumber(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`Expected non-negative number, got ${value}`);
  return number;
}

function requirePath(value, flag) {
  if (!value) throw new Error(`${flag} is required`);
  return path.resolve(value);
}

function parseArgs(values) {
  const parsed = {};
  for (let i = 0; i < values.length; i += 1) {
    const token = values[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = values[i + 1];
    if (!next || next.startsWith('--')) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function printHelp() {
  console.log(`LMC Zoom tile privacy pipeline\n\nCommands:\n  init  --config <json>\n  apply --input-root <dir> --output-root <dir> [--config <json>] [--report <json>]\n  qa    --input-root <dir> --output-root <dir> [--config <json>] [--artifact-root <dir>] [--report <json>]\n\nWorkflow:\n  1. init creates 77 REVIEW_REQUIRED rows.\n  2. Review every video and set each row to NO_MASK or MASK.\n  3. MASK intervals contain full Zoom participant tile rectangles.\n  4. apply creates the privacy-safe 77-file tree.\n  5. qa checks technical integrity and writes QA screenshots for every MASK interval.\n  6. Human visual approval is still required before R2 replacement.\n`);
}
