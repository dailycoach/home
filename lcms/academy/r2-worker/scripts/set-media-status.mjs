import fs from 'node:fs/promises';

const COURSE_ID = 'lmc-lifetime-management-counselor';
const ALLOWED_STATUSES = new Set([
  'pending_upload',
  'uploaded_unverified',
  'verified',
  'published',
  'disabled'
]);

const targetStatus = String(process.argv[2] || '').trim();
const fromArgument = process.argv.slice(3).find((value) => value.startsWith('--from='));
const expectedStatus = fromArgument ? fromArgument.slice('--from='.length) : '';

if (!ALLOWED_STATUSES.has(targetStatus) || !ALLOWED_STATUSES.has(expectedStatus)) {
  throw new Error(
    'Usage: node scripts/set-media-status.mjs <target-status> --from=<expected-status>'
  );
}

const catalogUrl = new URL('../../data/media-catalog.json', import.meta.url);
const workerCatalogUrl = new URL('../src/media-catalog.js', import.meta.url);
const catalog = JSON.parse(await fs.readFile(catalogUrl, 'utf8'));
const course = catalog.courses?.[COURSE_ID];
const media = course?.media;

if (!Array.isArray(media) || media.length !== 77) {
  throw new Error(`Expected exactly 77 media rows, got ${media?.length ?? 0}`);
}

const currentStatuses = new Set(media.map((item) => item.status));
if (currentStatuses.size !== 1 || !currentStatuses.has(expectedStatus)) {
  throw new Error(
    `Refusing transition: expected all rows to be ${expectedStatus}, found ${[
      ...currentStatuses
    ].join(', ')}`
  );
}

for (const item of media) item.status = targetStatus;
catalog.updatedAt = new Date().toISOString().slice(0, 10);

const workerCatalog = `// Generated from lcms/academy/data/media-catalog.json.\n// Regenerate only while preparing the catalog; published status changes require review.\nexport const MEDIA_CATALOG = new Map(${JSON.stringify(media, null, 2)}.map((item) => [\`\${item.week}:\${item.part}\`, item]));\n`;

await Promise.all([
  fs.writeFile(catalogUrl, `${JSON.stringify(catalog, null, 2)}\n`),
  fs.writeFile(workerCatalogUrl, workerCatalog)
]);

console.log(
  JSON.stringify({
    ok: true,
    courseId: COURSE_ID,
    mediaCount: media.length,
    from: expectedStatus,
    to: targetStatus
  })
);
