import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'lcms/academy/data/media-catalog.json'), 'utf8'));
const courseId = 'lmc-lifetime-management-counselor';
const bucket = 'rsedu-lmc-videos';
const media = catalog.courses?.[courseId]?.media || [];
const args = process.argv.slice(2);
const execute = args.includes('--execute');
const dirArg = args.find((v) => v.startsWith('--dir='));
const inputDir = path.resolve(dirArg ? dirArg.slice(6) : 'artifacts/lmc-privacy-77');

if (media.length !== 77) throw new Error(`Expected 77 catalog media rows, got ${media.length}`);
if (!fs.existsSync(inputDir)) throw new Error(`Input directory not found: ${inputDir}`);

const rows = media.map((item) => {
  const file = path.join(inputDir, item.sourceFilename);
  if (!fs.existsSync(file)) throw new Error(`Missing privacy file: ${item.mediaId} ${item.sourceFilename}`);
  const size = fs.statSync(file).size;
  if (!size) throw new Error(`Empty privacy file: ${item.sourceFilename}`);
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  return { item, file, size, sha256 };
});

console.log(`LMC privacy overwrite plan: ${rows.length} files`);
console.log(`Bucket: ${bucket}`);
console.log(`Input: ${inputDir}`);
console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY RUN'}`);

if (!execute) {
  for (const { item, file, size, sha256 } of rows) {
    console.log(`${item.mediaId} | ${size} | ${sha256} | ${bucket}/${item.objectKey} | ${file}`);
  }
  console.log('Dry run only. Re-run with --execute after privacy QA approval.');
  process.exit(0);
}

const whoami = spawnSync('npx', ['wrangler', 'whoami'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
if (whoami.status !== 0) throw new Error('Wrangler authentication check failed. Run npx wrangler login in this environment.');

for (const [index, row] of rows.entries()) {
  const objectPath = `${bucket}/${row.item.objectKey}`;
  console.log(`[${index + 1}/77] overwrite ${row.item.mediaId} -> ${objectPath}`);
  const put = spawnSync('npx', [
    'wrangler', 'r2', 'object', 'put', objectPath,
    '--remote', '--force', '--content-type', 'video/mp4', '--file', row.file
  ], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (put.status !== 0) throw new Error(`R2 overwrite failed: ${row.item.mediaId}`);
}

const manifest = {
  generatedAt: new Date().toISOString(),
  courseId,
  bucket,
  files: rows.map(({ item, size, sha256 }) => ({
    mediaId: item.mediaId,
    sourceFilename: item.sourceFilename,
    objectKey: item.objectKey,
    sizeBytes: size,
    sha256
  }))
};
const out = path.join(inputDir, 'LMC_PRIVACY_R2_OVERWRITE_MANIFEST.json');
fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
console.log(`Overwrite complete. Manifest: ${out}`);
