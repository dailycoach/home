import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const catalogPath = path.join(root, 'lcms/academy/data/courses.json');
const cachePath = path.join(root, 'lcms/academy/data/youtube-cache.json');
const apiKey = process.env.YOUTUBE_API_KEY?.trim() || '';

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const previousCache = JSON.parse(await readFile(cachePath, 'utf8'));
const courses = Array.isArray(catalog.courses) ? catalog.courses : [];
const syncTargets = courses.filter((course) => typeof course.playlistId === 'string' && course.playlistId.trim());

if (!syncTargets.length) {
  console.log('[RS Academy] No playlist IDs configured. Keeping the existing cache.');
  process.exit(0);
}

if (!apiKey) {
  console.warn('[RS Academy] YOUTUBE_API_KEY is not configured. Playlist sync was skipped.');
  process.exit(0);
}

async function fetchPlaylistItems(playlistId) {
  const videos = [];
  let pageToken = '';

  do {
    const params = new URLSearchParams({
      key: apiKey,
      part: 'snippet,contentDetails,status',
      playlistId,
      maxResults: '50'
    });
    if (pageToken) params.set('pageToken', pageToken);

    const endpoint = `https://www.googleapis.com/youtube/v3/playlistItems?${params.toString()}`;
    const response = await fetch(endpoint, {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`YouTube API ${response.status}: ${errorBody}`);
    }

    const payload = await response.json();
    const items = Array.isArray(payload.items) ? payload.items : [];

    for (const item of items) {
      const snippet = item.snippet || {};
      const videoId = item.contentDetails?.videoId || snippet.resourceId?.videoId;
      const title = snippet.title || '';
      const privacyStatus = item.status?.privacyStatus || 'unknown';

      if (!videoId) continue;
      if (title === 'Deleted video' || title === 'Private video') continue;
      if (privacyStatus === 'private') continue;

      const thumbnails = snippet.thumbnails || {};
      videos.push({
        position: Number.isInteger(snippet.position) ? snippet.position : videos.length,
        videoId,
        title,
        description: snippet.description || '',
        publishedAt: snippet.publishedAt || null,
        privacyStatus,
        thumbnails: {
          default: thumbnails.default?.url || null,
          medium: thumbnails.medium?.url || thumbnails.default?.url || null,
          high: thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || null,
          maxres: thumbnails.maxres?.url || thumbnails.high?.url || thumbnails.medium?.url || null
        }
      });
    }

    pageToken = payload.nextPageToken || '';
  } while (pageToken);

  return videos.sort((a, b) => a.position - b.position);
}

const nextCache = {
  version: '0.2.0',
  syncedAt: new Date().toISOString(),
  source: 'YouTube Data API v3 · playlistItems.list',
  courses: { ...(previousCache.courses || {}) }
};

for (const course of syncTargets) {
  const playlistId = course.playlistId.trim();
  console.log(`[RS Academy] Syncing ${course.id} from playlist ${playlistId}`);

  try {
    const videos = await fetchPlaylistItems(playlistId);
    nextCache.courses[course.id] = {
      playlistId,
      syncedAt: new Date().toISOString(),
      videoCount: videos.length,
      videos
    };
    console.log(`[RS Academy] ${course.id}: ${videos.length} videos`);
  } catch (error) {
    console.error(`[RS Academy] Failed to sync ${course.id}:`, error.message);
    nextCache.courses[course.id] = {
      ...(previousCache.courses?.[course.id] || {}),
      playlistId,
      lastErrorAt: new Date().toISOString(),
      lastError: error.message
    };
  }
}

await writeFile(cachePath, `${JSON.stringify(nextCache, null, 2)}\n`, 'utf8');
console.log(`[RS Academy] Cache updated: ${cachePath}`);
