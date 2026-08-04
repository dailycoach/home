import crypto from 'node:crypto';
import fs from 'node:fs/promises';

const COURSE_ID = 'lmc-lifetime-management-counselor';
const DEFAULT_WORKER_URL = 'https://lmc-r2-video-gateway.ros2468.workers.dev';
const DEFAULT_ORIGIN = 'https://daily-coach-ing.com';
const CONCURRENCY = 6;

const workerUrl = new URL(process.env.LMC_WORKER_URL || DEFAULT_WORKER_URL);
const origin = String(process.env.LMC_ALLOWED_ORIGIN || DEFAULT_ORIGIN);
const secret = String(process.env.LMC_PLAYBACK_SECRET || '');

if (workerUrl.protocol !== 'https:') throw new Error('LMC_WORKER_URL must use HTTPS');
if (secret.length < 32) throw new Error('LMC_PLAYBACK_SECRET must be at least 32 characters');

const catalogUrl = new URL('../../data/media-catalog.json', import.meta.url);
const catalog = JSON.parse(await fs.readFile(catalogUrl, 'utf8'));
const media = catalog.courses?.[COURSE_ID]?.media;

if (!Array.isArray(media) || media.length !== 77) {
  throw new Error(`Expected exactly 77 media rows, got ${media?.length ?? 0}`);
}
if (media.some((item) => item.status !== 'published')) {
  throw new Error('All 77 media rows must be published before remote verification');
}

const expiresAt = Math.floor(Date.now() / 1000) + 600;
const failures = [];
let nextIndex = 0;

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= media.length) return;
      const item = media[index];

      try {
        const result = await verifyMedia(item);
        console.log(
          `${item.mediaId} | HEAD 200 | Range 206 | ${result.size} bytes | video/mp4`
        );
      } catch (error) {
        failures.push(`${item.mediaId}: ${error instanceof Error ? error.message : error}`);
      }
    }
  })
);

if (failures.length) {
  throw new Error(`Published media verification failed:\n${failures.join('\n')}`);
}

console.log(
  JSON.stringify({
    ok: true,
    courseId: COURSE_ID,
    mediaCount: media.length,
    head200: media.length,
    range206: media.length
  })
);

async function verifyMedia(item) {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(
      `${COURSE_ID}|${item.week}|${item.part}|${item.mediaId}|${item.objectKey}|${expiresAt}`
    )
    .digest('base64url');
  const url = new URL(
    `/media/${encodeURIComponent(COURSE_ID)}/${item.week}/${item.part}`,
    workerUrl
  );
  url.searchParams.set('exp', String(expiresAt));
  url.searchParams.set('sig', signature);

  const head = await fetch(url, {
    method: 'HEAD',
    headers: { Origin: origin, 'Cache-Control': 'no-store' }
  });
  const size = Number(head.headers.get('Content-Length'));
  assertResponse(head.status === 200, `HEAD returned ${head.status}`);
  assertResponse(Number.isSafeInteger(size) && size > 0, 'invalid HEAD Content-Length');
  assertResponse(head.headers.get('Content-Type') === 'video/mp4', 'invalid HEAD Content-Type');
  assertResponse(head.headers.get('Accept-Ranges') === 'bytes', 'missing Accept-Ranges');
  assertResponse(
    head.headers.get('Access-Control-Allow-Origin') === origin,
    'invalid HEAD CORS origin'
  );

  const range = await fetch(url, {
    headers: {
      Origin: origin,
      Range: 'bytes=0-0',
      'Cache-Control': 'no-store'
    }
  });
  const rangeBody = new Uint8Array(await range.arrayBuffer());
  assertResponse(range.status === 206, `Range returned ${range.status}`);
  assertResponse(rangeBody.byteLength === 1, `Range returned ${rangeBody.byteLength} bytes`);
  assertResponse(range.headers.get('Content-Length') === '1', 'invalid Range Content-Length');
  assertResponse(
    range.headers.get('Content-Range') === `bytes 0-0/${size}`,
    `invalid Content-Range ${range.headers.get('Content-Range')}`
  );
  assertResponse(range.headers.get('Content-Type') === 'video/mp4', 'invalid Range Content-Type');
  assertResponse(
    range.headers.get('Access-Control-Allow-Origin') === origin,
    'invalid Range CORS origin'
  );

  return { size };
}

function assertResponse(condition, message) {
  if (!condition) throw new Error(message);
}
