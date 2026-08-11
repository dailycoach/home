import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COURSE_ID = 'lmc-lifetime-management-counselor';
const BUCKET = 'rsedu-lmc-videos';
const EXPECTED_BY_WEEK = new Map([[1, 5], [2, 7], [3, 8], [4, 6], [5, 8], [6, 7], [7, 7], [8, 8], [9, 7], [10, 7], [11, 7]]);
const args = parseArgs(process.argv.slice(2));
if (args['self-test']) {
  runGateSelfTest();
  process.exit(0);
}
const week = requireWeek(args.week);
const execute = Boolean(args.execute);
const inputDir = requirePath(args.dir, '--dir');
const catalogPath = path.resolve(args.catalog || path.join(ROOT, 'lcms/academy/data/media-catalog.json'));
const technicalPath = requirePath(args['technical-qa'], '--technical-qa');
const approvalPath = requirePath(args['visual-approval'], '--visual-approval');
const artifactRoot = path.resolve(args['artifact-root'] || path.join(ROOT, 'artifacts/lmc-privacy-rework'));

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const allMedia = catalog.courses?.[COURSE_ID]?.media;
if (!Array.isArray(allMedia) || allMedia.length !== 77) throw new Error(`Expected 77 current catalog rows, got ${allMedia?.length ?? 0}`);
assertUnique(allMedia, 'current catalog');
const media = allMedia.filter((row) => Number(row.week) === week).sort((a, b) => Number(a.part) - Number(b.part));
const expected = EXPECTED_BY_WEEK.get(week);
if (media.length !== expected) throw new Error(`WEEK-${pad(week)} expected ${expected} catalog rows, got ${media.length}`);

const technical = JSON.parse(fs.readFileSync(technicalPath, 'utf8'));
const approval = JSON.parse(fs.readFileSync(approvalPath, 'utf8'));
validateQaGates(week, media, technical, approval);

const qaById = new Map(technical.results.map((row) => [row.mediaId, row]));
const approvalById = new Map(approval.parts.map((row) => [row.mediaId, row]));
const rows = media.map((item) => {
  if (item.status !== 'published') throw new Error(`${item.mediaId}: status must remain published`);
  const file = objectPath(inputDir, item.objectKey);
  if (!fs.existsSync(file)) throw new Error(`Missing object-key mirror output: ${item.mediaId} ${file}`);
  const stat = fs.statSync(file);
  if (!stat.size) throw new Error(`Empty privacy output: ${item.mediaId}`);
  const actualSha256 = sha256File(file);
  const qa = qaById.get(item.mediaId);
  assertFileMatchesQa(item.mediaId, stat.size, actualSha256, qa);
  return {
    mediaId: item.mediaId,
    currentObjectKey: item.objectKey,
    sourceFilename: item.sourceFilename,
    file,
    newSizeBytes: stat.size,
    newSha256: actualSha256,
    technicalPass: qa.pass === true,
    privacyVisualPass: approvalById.get(item.mediaId)?.privacyVisualPass === true
  };
});

const cutoverPlanPath = path.resolve(args.report || path.join(artifactRoot, `week-${pad(week)}`, `week-${pad(week)}-cutover-plan.json`));
writeJson(cutoverPlanPath, {
  generatedAt: new Date().toISOString(),
  courseId: COURSE_ID,
  bucket: BUCKET,
  week,
  expectedUploads: expected,
  mode: execute ? 'EXECUTE' : 'DRY_RUN',
  rows: rows.map(({ file, ...row }) => row)
});

console.log(`LMC privacy WEEK-${pad(week)} cutover plan: ${rows.length} files`);
console.log(`Bucket: ${BUCKET}`);
console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY_RUN'}`);
for (const row of rows) console.log(`${row.mediaId} | ${row.newSizeBytes} | ${row.newSha256} | ${BUCKET}/${row.currentObjectKey}`);
console.log(`Cutover plan: ${cutoverPlanPath}`);

if (!execute) {
  console.log('Dry run only. R2 was not changed.');
  process.exit(0);
}

runWrangler(['--version']);
runWrangler(['whoami']);
const uploaded = [];
for (const [index, row] of rows.entries()) {
  console.log(`[${index + 1}/${rows.length}] overwrite ${row.mediaId} -> ${BUCKET}/${row.currentObjectKey}`);
  runWrangler(['r2', 'object', 'put', `${BUCKET}/${row.currentObjectKey}`, '--file', row.file, '--content-type', 'video/mp4', '--remote']);
  uploaded.push({ mediaId: row.mediaId, currentObjectKey: row.currentObjectKey, sizeBytes: row.newSizeBytes, sha256: row.newSha256, uploadedAt: new Date().toISOString() });
}

if (uploaded.length !== expected) throw new Error(`Upload count mismatch: expected ${expected}, uploaded ${uploaded.length}`);
const overwriteReport = path.join(artifactRoot, `week-${pad(week)}`, `week-${pad(week)}-r2-overwrite-report.json`);
writeJson(overwriteReport, { generatedAt: new Date().toISOString(), courseId: COURSE_ID, bucket: BUCKET, week, uploadedCount: uploaded.length, uploaded });
console.log(`R2 overwrite report: ${overwriteReport}`);

function validateQaGates(number, rows, qa, approval) {
  if (Number(qa.week) !== number || qa.pass !== true || !Array.isArray(qa.results)) throw new Error(`WEEK-${pad(number)} technical QA is not fully PASS`);
  if (Number(approval.week) !== number || approval.approved !== true || approval.reviewer !== 'human' || !Array.isArray(approval.parts)) {
    throw new Error(`WEEK-${pad(number)} human visual approval is missing`);
  }
  const expectedIds = new Set(rows.map((row) => row.mediaId));
  const qaIds = new Set(qa.results.filter((row) => row.pass === true).map((row) => row.mediaId));
  const approvedIds = new Set(approval.parts.filter((row) => row.privacyVisualPass === true).map((row) => row.mediaId));
  for (const id of expectedIds) {
    if (!qaIds.has(id)) throw new Error(`${id}: technical QA PASS missing`);
    if (!approvedIds.has(id)) throw new Error(`${id}: privacy visual PASS missing`);
  }
  if (qa.results.length !== rows.length || approval.parts.length !== rows.length) throw new Error(`WEEK-${pad(number)} QA/approval part count mismatch`);
}

function runGateSelfTest() {
  const media = [{ mediaId: 'lmc-w01-p01' }];
  const technical = { week: 1, pass: true, results: [{ mediaId: 'lmc-w01-p01', pass: true }] };
  const missing = { week: 1, approved: false, reviewer: null, parts: [{ mediaId: 'lmc-w01-p01', privacyVisualPass: false }] };
  let blocked = false;
  try { validateQaGates(1, media, technical, missing); } catch { blocked = true; }
  if (!blocked) throw new Error('Self-test: missing human approval was not blocked');
  const approved = { week: 1, approved: true, reviewer: 'human', parts: [{ mediaId: 'lmc-w01-p01', privacyVisualPass: true }] };
  validateQaGates(1, media, technical, approved);
  let shaBlocked = false;
  try { assertFileMatchesQa('lmc-w01-p01', 10, 'actual', { sizeBytes: 10, sha256: 'expected' }); } catch { shaBlocked = true; }
  if (!shaBlocked) throw new Error('Self-test: technical QA SHA mismatch was not blocked');
  console.log('R2 overwrite gate self-test passed: missing approval blocked, complete human approval accepted.');
}

function assertFileMatchesQa(mediaId, size, actualSha256, qa) {
  if (actualSha256 !== qa.sha256) throw new Error(`${mediaId}: actual output SHA does not match technical QA`);
  if (size !== Number(qa.sizeBytes)) throw new Error(`${mediaId}: actual output size does not match technical QA`);
}

function runWrangler(argv) {
  const wranglerJs = process.env.LMC_WRANGLER_JS;
  const command = wranglerJs ? process.execPath : (process.platform === 'win32' ? 'npx.cmd' : 'npx');
  const commandArgs = wranglerJs ? [wranglerJs, ...argv] : ['wrangler', ...argv];
  const result = spawnSync(command, commandArgs, { cwd: ROOT, encoding: 'utf8', stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Wrangler failed (${result.status}): ${argv.join(' ')}`);
}

function sha256File(file) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(file, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    while (true) {
      const bytes = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (!bytes) break;
      hash.update(buffer.subarray(0, bytes));
    }
  } finally { fs.closeSync(fd); }
  return hash.digest('hex');
}

function objectPath(root, objectKey) {
  const base = path.resolve(root);
  const candidate = path.resolve(base, ...String(objectKey).split('/'));
  if (candidate !== base && !candidate.startsWith(`${base}${path.sep}`)) throw new Error(`Unsafe object key path: ${objectKey}`);
  return candidate;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function assertUnique(rows, label) {
  const ids = new Set();
  for (const row of rows) {
    if (ids.has(row.mediaId)) throw new Error(`${label}: duplicate mediaId ${row.mediaId}`);
    ids.add(row.mediaId);
  }
}

function requireWeek(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || !EXPECTED_BY_WEEK.has(number)) throw new Error('--week must be an integer from 1 through 11');
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
    const equal = token.indexOf('=');
    if (equal > 2) { parsed[token.slice(2, equal)] = token.slice(equal + 1); continue; }
    const key = token.slice(2);
    const next = values[i + 1];
    if (!next || next.startsWith('--')) parsed[key] = true;
    else { parsed[key] = next; i += 1; }
  }
  return parsed;
}

function pad(value) { return String(value).padStart(2, '0'); }
