import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const COURSE_ID = 'lmc-lifetime-management-counselor';
const EXPECTED_BY_WEEK = new Map([[1, 5], [2, 7], [3, 8], [4, 6], [5, 8], [6, 7], [7, 7], [8, 8], [9, 7], [10, 7], [11, 7]]);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_CATALOG = path.join(REPO_ROOT, 'lcms/academy/data/media-catalog.json');
const DEFAULT_CONFIG = path.join(REPO_ROOT, 'artifacts/lmc-privacy-rework/inputs/LMC_77_PART_MASK_INTERVALS_v1.0.json');
const DEFAULT_ARTIFACT_ROOT = path.join(REPO_ROOT, 'artifacts/lmc-privacy-rework');
const FFMPEG = process.env.LMC_FFMPEG || 'ffmpeg';

const [command = 'help', ...rest] = process.argv.slice(2);
const args = parseArgs(rest);

if (command === 'help' || args.help) {
  printHelp();
  process.exit(0);
}

const week = requireWeek(args.week);
const configPath = path.resolve(args.config || DEFAULT_CONFIG);
const catalogPath = path.resolve(args.catalog || DEFAULT_CATALOG);
const artifactRoot = path.resolve(args['artifact-root'] || DEFAULT_ARTIFACT_ROOT);
const execution = await loadExecutionMap(configPath, catalogPath);
const weekRows = execution.filter((row) => row.week === week);
assertWeekCount(week, weekRows);

if (command === 'contract-test') {
  await runContractTests(execution, configPath);
} else if (command === 'map') {
  const report = path.resolve(args.report || path.join(artifactRoot, 'execution-map.json'));
  await writeJson(report, execution);
  console.log(`Execution map: ${report} (${execution.length} rows)`);
} else if (command === 'preflight') {
  await writeExecutionMap(execution, artifactRoot);
  await runPreflight({ week, rows: weekRows, args, artifactRoot });
} else if (command === 'apply') {
  await writeExecutionMap(execution, artifactRoot);
  await applyWeek({ week, rows: weekRows, args, artifactRoot });
} else if (command === 'qa') {
  await writeExecutionMap(execution, artifactRoot);
  await qaWeek({ week, rows: weekRows, args, artifactRoot });
} else {
  throw new Error(`Unknown command: ${command}`);
}

async function loadExecutionMap(maskFile, catalogFile) {
  const mask = JSON.parse(await fs.readFile(maskFile, 'utf8'));
  const catalog = JSON.parse(await fs.readFile(catalogFile, 'utf8'));
  const maskRows = mask.media;
  const catalogRows = catalog.courses?.[COURSE_ID]?.media;
  if (!Array.isArray(maskRows) || maskRows.length !== 77) {
    throw new Error(`MASK JSON must contain exactly 77 media rows; got ${maskRows?.length ?? 0}`);
  }
  if (!Array.isArray(catalogRows) || catalogRows.length !== 77) {
    throw new Error(`Current catalog must contain exactly 77 media rows; got ${catalogRows?.length ?? 0}`);
  }
  assertUnique(maskRows, 'MASK JSON');
  assertUnique(catalogRows, 'catalog');
  const byId = new Map(catalogRows.map((row) => [row.mediaId, row]));
  const mapped = maskRows.map((maskRow) => {
    const current = byId.get(maskRow.mediaId);
    if (!current) throw new Error(`MASK JSON mediaId missing from current catalog: ${maskRow.mediaId}`);
    if (Number(maskRow.week) !== Number(current.week) || Number(maskRow.part) !== Number(current.part)) {
      throw new Error(`${maskRow.mediaId}: week/part mismatch between MASK JSON and current catalog`);
    }
    if (current.status !== 'published') throw new Error(`${maskRow.mediaId}: catalog status must remain published`);
    if (maskRow.filename !== current.sourceFilename) {
      throw new Error(`${maskRow.mediaId}: filename does not match current catalog sourceFilename`);
    }
    validateDecision(maskRow);
    return {
      mediaId: current.mediaId,
      week: Number(current.week),
      part: Number(current.part),
      sourceFilename: current.sourceFilename,
      currentObjectKey: current.objectKey,
      status: current.status,
      decision: maskRow.decision,
      durationSeconds: Number(maskRow.durationSeconds),
      intervals: maskRow.intervals
    };
  });
  const mappedIds = new Set(mapped.map((row) => row.mediaId));
  const extras = catalogRows.filter((row) => !mappedIds.has(row.mediaId));
  if (extras.length) throw new Error(`Current catalog has mediaIds absent from MASK JSON: ${extras.map((x) => x.mediaId).join(', ')}`);
  for (const [number, expected] of EXPECTED_BY_WEEK) {
    const rows = mapped.filter((row) => row.week === number);
    if (rows.length !== expected) throw new Error(`WEEK-${pad(number)} expected ${expected} rows; got ${rows.length}`);
  }
  return mapped.sort((a, b) => a.week - b.week || a.part - b.part);
}

function validateDecision(row) {
  if (!['MASK', 'NO_MASK'].includes(row.decision)) throw new Error(`${row.mediaId}: invalid decision ${row.decision}`);
  if (!Array.isArray(row.intervals)) throw new Error(`${row.mediaId}: intervals must be an array`);
  if (row.decision === 'NO_MASK' && row.intervals.length) throw new Error(`${row.mediaId}: NO_MASK cannot contain intervals`);
  if (row.decision === 'MASK' && !row.intervals.length) throw new Error(`${row.mediaId}: MASK requires intervals`);
  for (const interval of row.intervals) {
    const start = Number(interval.startSeconds);
    const end = Number(interval.endSeconds);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
      throw new Error(`${row.mediaId}: invalid local interval ${interval.startSeconds}-${interval.endSeconds}`);
    }
    if (!['RIGHT_PANEL', 'FULL_FRAME'].includes(interval.maskType)) {
      throw new Error(`${row.mediaId}: invalid maskType ${interval.maskType}`);
    }
    if (!interval.coordinate || !Number.isFinite(Number(interval.coordinate.xStart))) {
      throw new Error(`${row.mediaId}: interval requires final coordinate.xStart`);
    }
  }
}

async function runPreflight({ week, rows, args: options, artifactRoot: root }) {
  const inputRoot = requirePath(options['input-root'], '--input-root');
  assertBinary();
  const results = [];
  for (const row of rows) {
    const input = safeJoin(inputRoot, row.sourceFilename);
    let result;
    try {
      await fs.access(input);
      const metadata = probe(input);
      const expectedWidth = week === 5 ? 1212 : 1280;
      const durationDeltaSeconds = Math.abs(metadata.durationSeconds - row.durationSeconds);
      const checks = {
        filename: path.basename(input) === row.sourceFilename,
        videoStream: metadata.videoCodec !== null,
        audioStream: metadata.audioCodec !== null,
        videoCodec: metadata.videoCodec === 'h264',
        audioCodec: metadata.audioCodec === 'aac',
        fps: Math.abs(metadata.fps - 25) <= 0.1,
        width: metadata.width === expectedWidth,
        height: metadata.height === 720,
        durationRecommended: durationDeltaSeconds <= 0.75,
        durationAbsolute: durationDeltaSeconds <= 2,
        coordinateBounds: coordinatesMatchFrame(row, metadata),
        intervalTimes: row.intervals.every((interval) => Number(interval.startSeconds) < metadata.durationSeconds && Number(interval.endSeconds) <= metadata.durationSeconds + 2)
      };
      const pass = Object.values(checks).every(Boolean);
      result = { ...rowIdentity(row), input, expectedDurationSeconds: row.durationSeconds, ...metadata, durationDeltaSeconds, checks, pass };
    } catch (error) {
      result = { ...rowIdentity(row), input, pass: false, error: errorMessage(error) };
    }
    results.push(result);
    console.log(`${row.mediaId} | PREFLIGHT ${result.pass ? 'PASS' : 'FAIL'}`);
  }
  const pass = results.length === rows.length && results.every((row) => row.pass);
  const report = path.resolve(options.report || path.join(root, `week-${pad(week)}`, `week-${pad(week)}-source-preflight.json`));
  await writeJson(report, { generatedAt: new Date().toISOString(), week, expectedParts: EXPECTED_BY_WEEK.get(week), pass, results });
  console.log(`Source preflight: ${report}`);
  if (!pass) process.exitCode = 1;
  return { pass, results, report };
}

function coordinatesMatchFrame(row, metadata) {
  return row.intervals.every((interval) => {
    const coordinate = interval.coordinate;
    if (interval.maskType === 'FULL_FRAME') {
      return Number(coordinate.xStart) === 0 && Number(coordinate.yStart) === 0 && Number(coordinate.xEnd) === metadata.width - 1 && Number(coordinate.yEnd) === metadata.height - 1 && Number(coordinate.width) === metadata.width && Number(coordinate.height) === metadata.height;
    }
    const x = Number(coordinate.xStart);
    return Number.isInteger(x) && x >= 0 && x < metadata.width && Number(coordinate.xEnd) === metadata.width - 1 && Number(coordinate.yStart) === 0 && Number(coordinate.yEnd) === metadata.height - 1 && Number(coordinate.width) === metadata.width - x && Number(coordinate.height) === metadata.height;
  });
}

async function applyWeek({ week, rows, args: options, artifactRoot: root }) {
  const inputRoot = requirePath(options['input-root'], '--input-root');
  const outputRoot = requirePath(options['output-root'], '--output-root');
  const dryRun = Boolean(options['dry-run']);
  assertBinary();
  const preflight = await runPreflight({ week, rows, args: { ...options, report: path.join(root, `week-${pad(week)}`, `week-${pad(week)}-source-preflight.json`) }, artifactRoot: root });
  if (!preflight.pass) throw new Error(`WEEK-${pad(week)} source preflight failed; render blocked`);
  const jobs = positiveInteger(options.jobs, 1);
  const render = async (row) => {
    const input = safeJoin(inputRoot, row.sourceFilename);
    const output = objectPath(outputRoot, row.currentObjectKey);
    const metadata = probe(input);
    const filterGraph = row.decision === 'MASK' ? buildFilterGraph(row, metadata) : null;
    if (dryRun) {
      console.log(`${row.mediaId} | DRY RUN | ${filterGraph || 'byte-for-byte copy'}`);
      return { ...rowIdentity(row), action: row.decision === 'MASK' ? 'MASK' : 'COPY_NO_MASK', input, output, filterGraph };
    }
    await fs.mkdir(path.dirname(output), { recursive: true });
    if (options.resume && await validExistingOutput(output, metadata)) {
      console.log(`${row.mediaId} | RESUME | existing verified output retained`);
      return { ...rowIdentity(row), action: 'RETAINED_VERIFIED_OUTPUT', output, sizeBytes: (await fs.stat(output)).size, sha256: await sha256File(output), filterGraph };
    }
    if (row.decision === 'NO_MASK') {
      const { outputSha256 } = await copyNoMask(input, output, row.mediaId);
      console.log(`${row.mediaId} | NO_MASK | COMPLETE`);
      return { ...rowIdentity(row), action: 'COPIED_NO_MASK', output, sizeBytes: (await fs.stat(output)).size, sha256: outputSha256 };
    } else {
      await runFfmpegAsync(['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-map', '0:v:0', '-map', '0:a:0', '-vf', filterGraph, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', output]);
      console.log(`${row.mediaId} | MASK | COMPLETE`);
      return { ...rowIdentity(row), action: 'MASKED', output, sizeBytes: (await fs.stat(output)).size, sha256: await sha256File(output), filterGraph };
    }
  };
  const results = dryRun ? await mapLimit(rows, 1, render) : await mapLimit(rows, jobs, render);
  const report = path.resolve(options.report || path.join(root, `week-${pad(week)}`, `week-${pad(week)}-${dryRun ? 'render-dry-run' : 'render-report'}.json`));
  await writeJson(report, { generatedAt: new Date().toISOString(), week, dryRun, expectedParts: EXPECTED_BY_WEEK.get(week), results });
  console.log(`Render report: ${report}`);
}

async function validExistingOutput(output, inputMetadata) {
  try {
    const stat = await fs.stat(output);
    if (stat.size < 1024 * 1024) return false;
    const existing = probe(output);
    return existing.videoCodec === 'h264' && existing.audioCodec === inputMetadata.audioCodec && existing.width === inputMetadata.width && existing.height === inputMetadata.height && Math.abs(existing.durationSeconds - inputMetadata.durationSeconds) <= 0.75 && await isFastStart(output);
  } catch { return false; }
}

function buildFilterGraph(row, metadata) {
  return row.intervals.map((interval) => {
    const start = Number(interval.startSeconds);
    const end = Number(interval.endSeconds);
    const enable = interval.endIsFileEnd ? `gte(t,${number(start)})` : `between(t,${number(start)},${number(end)})`;
    if (interval.maskType === 'FULL_FRAME') {
      return `drawbox=x=0:y=0:w=iw:h=ih:color=black@1.0:t=fill:enable='${enable}'`;
    }
    const x = Number(interval.coordinate.xStart);
    if (!Number.isInteger(x) || x < 0 || x >= metadata.width) throw new Error(`${row.mediaId}: xStart ${x} is outside ${metadata.width}px frame`);
    return `drawbox=x=${x}:y=0:w=iw-${x}:h=ih:color=black@1.0:t=fill:enable='${enable}'`;
  }).join(',');
}

async function runContractTests(mapped, sourceConfigPath) {
  const source = JSON.parse(await fs.readFile(sourceConfigPath, 'utf8'));
  const sourceById = new Map(source.media.map((row) => [row.mediaId, row]));
  if (mapped.length !== 77) throw new Error('Contract test: execution map must contain 77 rows');
  if (mapped.filter((row) => row.decision === 'MASK').length !== 75) throw new Error('Contract test: expected 75 MASK rows');
  if (mapped.filter((row) => row.decision === 'NO_MASK').length !== 2) throw new Error('Contract test: expected 2 NO_MASK rows');
  for (const row of mapped) {
    const legacy = sourceById.get(row.mediaId)?.objectKey;
    if (row.currentObjectKey === legacy) throw new Error(`Contract test: legacy MASK objectKey leaked into execution map for ${row.mediaId}`);
  }
  const right = { mediaId: 'test-right', intervals: [{ startSeconds: 1, endSeconds: 9, endIsFileEnd: false, maskType: 'RIGHT_PANEL', coordinate: { xStart: 1123 } }] };
  const rightGraph = buildFilterGraph(right, { width: 1280, height: 720 });
  if (rightGraph !== "drawbox=x=1123:y=0:w=iw-1123:h=ih:color=black@1.0:t=fill:enable='between(t,1,9)'") throw new Error(`Contract test: RIGHT_PANEL graph changed: ${rightGraph}`);
  const full = { mediaId: 'test-full', intervals: [{ startSeconds: 5.25, endSeconds: 10, endIsFileEnd: true, maskType: 'FULL_FRAME', coordinate: { xStart: 0 } }] };
  const fullGraph = buildFilterGraph(full, { width: 1280, height: 720 });
  if (!fullGraph.includes('x=0:y=0:w=iw:h=ih') || !fullGraph.includes("gte(t,5.25)")) throw new Error(`Contract test: FULL_FRAME/tail graph changed: ${fullGraph}`);
  let traversalBlocked = false;
  try { safeJoin(path.join(REPO_ROOT, 'tmp'), '..', 'escape.mp4'); } catch { traversalBlocked = true; }
  if (!traversalBlocked) throw new Error('Contract test: path traversal was not blocked');
  const temp = await fs.mkdtemp(path.join(REPO_ROOT, '.lmc-contract-test-'));
  try {
    const input = path.join(temp, 'input.bin');
    const output = path.join(temp, 'output.bin');
    await fs.writeFile(input, crypto.randomBytes(1024));
    const hashes = await copyNoMask(input, output, 'test-no-mask');
    if (hashes.inputSha256 !== hashes.outputSha256) throw new Error('Contract test: NO_MASK byte preservation failed');
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
  if (technicalChecksPass({ fastStart: false, noMaskSha: true }, [])) {
    throw new Error('Contract test: non-Fast-Start output passed without an explicit waiver');
  }
  if (!technicalChecksPass({ fastStart: false, noMaskSha: true }, ['fastStart'])) {
    throw new Error('Contract test: explicit Fast Start waiver was not honored');
  }
  if (technicalChecksPass({ fastStart: true, noMaskSha: false }, ['fastStart'])) {
    throw new Error('Contract test: Fast Start waiver incorrectly bypassed NO_MASK SHA identity');
  }
  console.log('LMC privacy contract tests passed: 77 JOIN, current objectKey, counts, no-padding RIGHT_PANEL, FULL_FRAME, tail, path traversal.');
}

async function qaWeek({ week, rows, args: options, artifactRoot: root }) {
  const inputRoot = requirePath(options['input-root'], '--input-root');
  const outputRoot = requirePath(options['output-root'], '--output-root');
  const allowNoMaskNonFastStart = Boolean(options['allow-no-mask-non-faststart']);
  assertBinary();
  const weekRoot = path.join(root, `week-${pad(week)}`);
  const qaFramesRoot = path.join(weekRoot, 'qa-frames');
  const results = [];
  const contactImages = [];
  for (const row of rows) {
    const input = safeJoin(inputRoot, row.sourceFilename);
    const output = objectPath(outputRoot, row.currentObjectKey);
    let result;
    try {
      await fs.access(input);
      await fs.access(output);
      const before = probe(input);
      const after = probe(output);
      const durationDeltaSeconds = Math.abs(after.durationSeconds - row.durationSeconds);
      const inputSha256 = await sha256File(input);
      const sha256 = await sha256File(output);
      const fastStart = await isFastStart(output);
      const noMaskShaPass = row.decision !== 'NO_MASK' || inputSha256 === sha256;
      const fastStartWaiverApplied = row.decision === 'NO_MASK' && !fastStart && allowNoMaskNonFastStart;
      const checks = {
        size: (await fs.stat(output)).size > 0,
        videoStream: after.videoCodec !== null,
        audioStream: after.audioCodec !== null,
        videoCodec: after.videoCodec === 'h264',
        audioCodec: after.audioCodec === before.audioCodec,
        width: after.width === before.width,
        height: after.height === before.height,
        fps: Math.abs(after.fps - before.fps) <= 0.01,
        durationRecommended: durationDeltaSeconds <= 0.75,
        durationAbsolute: durationDeltaSeconds <= 2,
        fastStart,
        noMaskSha: noMaskShaPass
      };
      const screenshots = row.decision === 'MASK'
        ? await generateQaFrames(row, output, after.durationSeconds, qaFramesRoot)
        : await generateNoMaskFrames(row, output, after.durationSeconds, qaFramesRoot);
      const partContact = path.join(qaFramesRoot, row.mediaId, 'part-contact-sheet.jpg');
      await buildContactSheet(screenshots.map((relative) => ({ file: path.join(qaFramesRoot, ...relative.split('/')) })), partContact, 5);
      contactImages.push({ mediaId: row.mediaId, file: partContact });
      const waivedChecks = fastStartWaiverApplied ? ['fastStart'] : [];
      const pass = technicalChecksPass(checks, waivedChecks);
      result = {
        ...rowIdentity(row),
        pass,
        checks,
        waivedChecks,
        fastStartWaiverApplied,
        waiverReason: fastStartWaiverApplied
          ? 'Human approved pristine byte preservation for this NO_MASK source; remuxing would change the required input/output SHA identity.'
          : null,
        durationBefore: before.durationSeconds,
        actualDurationSeconds: after.durationSeconds,
        durationDeltaSeconds,
        width: after.width,
        height: after.height,
        fps: after.fps,
        videoCodec: after.videoCodec,
        audioCodec: after.audioCodec,
        fastStart,
        sizeBytes: (await fs.stat(output)).size,
        inputSha256,
        sha256,
        screenshots
      };
    } catch (error) {
      result = { ...rowIdentity(row), pass: false, error: errorMessage(error) };
    }
    results.push(result);
    console.log(`${row.mediaId} | TECHNICAL QA ${result.pass ? 'PASS' : 'FAIL'}`);
  }
  const pass = results.length === rows.length && results.every((row) => row.pass);
  const report = path.resolve(options.report || path.join(weekRoot, `week-${pad(week)}-technical-qa.json`));
  await writeJson(report, {
    generatedAt: new Date().toISOString(),
    week,
    expectedParts: EXPECTED_BY_WEEK.get(week),
    pass,
    technicalPassCount: results.filter((row) => row.pass).length,
    noMaskNonFastStartWaiverAuthorized: allowNoMaskNonFastStart,
    waivedTechnicalCheckCount: results.reduce((total, row) => total + (row.waivedChecks?.length || 0), 0),
    results
  });
  if (contactImages.length === rows.length) await buildWeekContactSheet(contactImages, path.join(weekRoot, `week-${pad(week)}-contact-sheet.jpg`));
  await writeApprovalTemplate(week, rows, path.join(weekRoot, `week-${pad(week)}-visual-approval.json`));
  console.log(`Technical QA: ${report}`);
  if (!pass) process.exitCode = 1;
}

async function generateQaFrames(row, output, duration, qaFramesRoot) {
  const dir = path.join(qaFramesRoot, row.mediaId);
  await fs.mkdir(dir, { recursive: true });
  const generated = [];
  for (let index = 0; index < row.intervals.length; index += 1) {
    const interval = row.intervals[index];
    const times = visualSampleTimes(interval, duration);
    for (let sample = 0; sample < times.length; sample += 1) {
      const filename = `interval-${String(index + 1).padStart(2, '0')}-${String(sample + 1).padStart(2, '0')}-${number(times[sample])}s.jpg`;
      const file = path.join(dir, filename);
      captureFrame(output, times[sample], file, 1280);
      generated.push(path.relative(qaFramesRoot, file).replaceAll(path.sep, '/'));
    }
  }
  return generated;
}

async function generateNoMaskFrames(row, output, duration, qaFramesRoot) {
  const dir = path.join(qaFramesRoot, row.mediaId);
  await fs.mkdir(dir, { recursive: true });
  const times = [0.1, duration / 2, Math.max(0, duration - 0.1)];
  const generated = [];
  for (let index = 0; index < times.length; index += 1) {
    const filename = `no-mask-${String(index + 1).padStart(2, '0')}-${number(times[index])}s.jpg`;
    const file = path.join(dir, filename);
    captureFrame(output, times[index], file, 1280);
    generated.push(path.relative(qaFramesRoot, file).replaceAll(path.sep, '/'));
  }
  return generated;
}

function visualSampleTimes(interval, duration) {
  const start = Number(interval.startSeconds);
  const end = Math.min(Number(interval.endSeconds), duration);
  const candidates = [Math.max(0, start - 0.5), Math.min(duration - 0.001, start + 0.1), (start + end) / 2, Math.max(0, end - 0.1)];
  if (interval.endIsFileEnd) candidates.push(Math.max(0, end - 1), Math.max(0, end - 0.1));
  else if (end + 0.5 < duration) candidates.push(end + 0.5);
  return [...new Set(candidates.map((value) => Math.max(0, Math.min(duration - 0.001, Number(value.toFixed(3))))))].sort((a, b) => a - b);
}

function captureFrame(input, seconds, output, width) {
  runFfmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-ss', number(seconds), '-i', input, '-frames:v', '1', '-vf', `scale=${width}:-2`, '-q:v', '2', output]);
}

async function buildContactSheet(images, output, columns = 3) {
  const rows = Math.ceil(images.length / columns);
  const inputs = images.flatMap((item) => ['-i', item.file]);
  const filters = images.map((_, i) => `[${i}:v]scale=400:-2,pad=400:250:(ow-iw)/2:(oh-ih)/2:black[v${i}]`);
  const layout = images.map((_, i) => `${(i % columns) * 400}_${Math.floor(i / columns) * 250}`).join('|');
  filters.push(`${images.map((_, i) => `[v${i}]`).join('')}xstack=inputs=${images.length}:layout=${layout}:fill=black[out]`);
  await fs.mkdir(path.dirname(output), { recursive: true });
  runFfmpeg(['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-frames:v', '1', '-q:v', '2', output]);
}

async function buildWeekContactSheet(images, output) {
  const inputs = images.flatMap((item) => ['-i', item.file]);
  const filters = images.map((_, index) => `[${index}:v]scale=1200:-2[v${index}]`);
  filters.push(`${images.map((_, index) => `[v${index}]`).join('')}vstack=inputs=${images.length}[out]`);
  await fs.mkdir(path.dirname(output), { recursive: true });
  runFfmpeg(['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[out]', '-frames:v', '1', '-q:v', '2', output]);
}

async function writeApprovalTemplate(week, rows, file) {
  try { await fs.access(file); return; } catch {}
  await writeJson(file, { week, approved: false, approvedAt: null, reviewer: null, parts: rows.map((row) => ({ mediaId: row.mediaId, privacyVisualPass: false, reviewNote: '' })) });
}

function probe(file) {
  const result = spawnSync(FFMPEG, ['-hide_banner', '-i', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw result.error;
  const text = `${result.stdout || ''}\n${result.stderr || ''}`;
  const durationMatch = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const videoLine = text.split(/\r?\n/).find((line) => line.includes('Video:'));
  const audioLine = text.split(/\r?\n/).find((line) => line.includes('Audio:'));
  if (!durationMatch || !videoLine) throw new Error(`Unable to probe video: ${file}`);
  const size = videoLine.match(/(\d{2,5})x(\d{2,5})/);
  const fps = videoLine.match(/([\d.]+)\s*fps/);
  const videoCodec = videoLine.match(/Video:\s*([^,\s]+)/)?.[1] || null;
  const audioCodec = audioLine?.match(/Audio:\s*([^,\s]+)/)?.[1] || null;
  return {
    durationSeconds: Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]),
    width: size ? Number(size[1]) : null,
    height: size ? Number(size[2]) : null,
    fps: fps ? Number(fps[1]) : null,
    videoCodec,
    audioCodec
  };
}

async function isFastStart(file) {
  const stat = await fs.stat(file);
  const handle = await fs.open(file, 'r');
  try {
    let offset = 0;
    let moov = null;
    let mdat = null;
    while (offset + 8 <= stat.size && offset < 64 * 1024 * 1024) {
      const header = Buffer.alloc(16);
      const { bytesRead } = await handle.read(header, 0, 16, offset);
      if (bytesRead < 8) break;
      let size = header.readUInt32BE(0);
      const type = header.toString('ascii', 4, 8);
      if (size === 1) size = Number(header.readBigUInt64BE(8));
      else if (size === 0) size = stat.size - offset;
      if (!Number.isFinite(size) || size < 8) break;
      if (type === 'moov' && moov === null) moov = offset;
      if (type === 'mdat' && mdat === null) mdat = offset;
      if (moov !== null && mdat !== null) return moov < mdat;
      offset += size;
    }
    return false;
  } finally { await handle.close(); }
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
  } finally { await handle.close(); }
  return hash.digest('hex');
}

async function copyNoMask(input, output, mediaId) {
  await fs.copyFile(input, output);
  const inputSha256 = await sha256File(input);
  const outputSha256 = await sha256File(output);
  if (inputSha256 !== outputSha256) throw new Error(`${mediaId}: NO_MASK copy SHA mismatch`);
  return { inputSha256, outputSha256 };
}

async function writeExecutionMap(execution, root) {
  await writeJson(path.join(root, 'execution-map.json'), execution);
}

async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function objectPath(root, objectKey) {
  return safeJoin(root, ...String(objectKey).split('/'));
}

function safeJoin(root, ...segments) {
  const base = path.resolve(root);
  const candidate = path.resolve(base, ...segments);
  if (candidate !== base && !candidate.startsWith(`${base}${path.sep}`)) throw new Error(`Unsafe output path: ${segments.join('/')}`);
  return candidate;
}

function runFfmpeg(argv) {
  const result = spawnSync(FFMPEG, argv, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`FFmpeg failed (${result.status}): ${result.stderr || result.stdout}`.trim());
  return result;
}

function runFfmpegAsync(argv) {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG, argv, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg failed (${code}): ${stderr}`.trim()));
    });
  });
}

async function mapLimit(values, limit, worker) {
  const results = new Array(values.length);
  let next = 0;
  async function runNext() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= values.length) return;
      results[index] = await worker(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, runNext));
  return results;
}

function assertBinary() {
  const result = spawnSync(FFMPEG, ['-version'], { encoding: 'utf8', stdio: 'ignore' });
  if (result.error || result.status !== 0) throw new Error(`FFmpeg is required; set LMC_FFMPEG to its absolute path`);
}

function assertUnique(rows, label) {
  const seen = new Set();
  for (const row of rows) {
    if (!row.mediaId) throw new Error(`${label}: missing mediaId`);
    if (seen.has(row.mediaId)) throw new Error(`${label}: duplicate mediaId ${row.mediaId}`);
    seen.add(row.mediaId);
  }
}

function assertWeekCount(week, rows) {
  const expected = EXPECTED_BY_WEEK.get(week);
  if (rows.length !== expected) throw new Error(`WEEK-${pad(week)} expected ${expected} rows; got ${rows.length}`);
}

function rowIdentity(row) {
  return { mediaId: row.mediaId, week: row.week, part: row.part, sourceFilename: row.sourceFilename, currentObjectKey: row.currentObjectKey, decision: row.decision };
}

function technicalChecksPass(checks, waivedChecks) {
  const waived = new Set(waivedChecks);
  return Object.entries(checks).every(([check, value]) => value || waived.has(check));
}

function requireWeek(value) {
  const week = Number(value);
  if (!Number.isInteger(week) || !EXPECTED_BY_WEEK.has(week)) throw new Error('--week must be an integer from 1 through 11');
  return week;
}

function requirePath(value, flag) {
  if (!value) throw new Error(`${flag} is required`);
  return path.resolve(value);
}

function positiveInteger(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) throw new Error('--jobs must be an integer from 1 through 4');
  return parsed;
}

function parseArgs(values) {
  const parsed = {};
  for (let i = 0; i < values.length; i += 1) {
    const token = values[i];
    if (!token.startsWith('--')) continue;
    const equal = token.indexOf('=');
    if (equal > 2) { parsed[token.slice(2, equal)] = token.slice(equal + 1); continue; }
    const key = token.slice(2);
    const next = values[i + 1];
    if (!next || next.startsWith('--')) parsed[key] = true;
    else { parsed[key] = next; i += 1; }
  }
  return parsed;
}

function number(value) { return Number(value).toFixed(3).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1'); }
function pad(value) { return String(value).padStart(2, '0'); }
function errorMessage(error) { return error instanceof Error ? error.message : String(error); }

function printHelp() {
  console.log(`LMC 77-part Zoom tile privacy pipeline\n\nCommands:\n  contract-test --week N --config <json> --catalog <json>\n  map       --week N --config <json> --catalog <json> --report <execution-map.json>\n  preflight --week N --config <json> --catalog <json> --input-root <pristine> --report <json>\n  apply     --week N --config <json> --catalog <json> --input-root <pristine> --output-root <privacy> --report <json> [--dry-run] [--jobs 1..4] [--resume]\n  qa        --week N --config <json> --catalog <json> --input-root <pristine> --output-root <privacy> --artifact-root <dir> --report <json> [--allow-no-mask-non-faststart]\n\nRules:\n  - MASK JSON objectKey is ignored; current catalog objectKey is authoritative.\n  - RIGHT_PANEL uses final coordinate.xStart with zero additional padding.\n  - FULL_FRAME covers the full frame and endIsFileEnd uses gte(t,start).\n  - A non-Fast-Start NO_MASK source can pass only with the explicit waiver flag; the report keeps fastStart=false and records the waiver.\n  - R2 replacement remains blocked until a human visual approval is supplied.\n`);
}
