const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createDownloadHandler({ enabled, origins, authenticate, reserve, sign, finish, now = () => Date.now() }) {
  return async (request) => {
    const origin = request.headers.get('Origin');
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
    if (origin && origins.includes(origin)) Object.assign(headers, { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' });
    const response = (status, value) => new Response(JSON.stringify(value), { status, headers });
    if (origin && !origins.includes(origin)) return response(403, { error: 'Origin not allowed' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return response(405, { error: 'Use POST' });
    if (!enabled) return response(503, { error: 'Download library is not connected yet' });
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) return response(415, { error: 'Use JSON' });
    const token = request.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (!token) return response(401, { error: 'Verified login required' });
    let actor;
    try { actor = await authenticate(token); } catch { return response(401, { error: 'Verified login required' }); }
    if (!actor?.id || !actor.email_confirmed_at || actor.is_anonymous) return response(401, { error: 'Verified login required' });
    let input;
    try { const raw = await request.text(); if (raw.length > 2048) return response(413, { error: 'Request too large' }); input = JSON.parse(raw); } catch { return response(400, { error: 'Invalid JSON' }); }
    if (!uuid.test(input?.entitlementId || '') || !uuid.test(input?.requestId || '') || Object.keys(input).some(k => !['entitlementId', 'requestId'].includes(k))) return response(400, { error: 'Invalid download request' });
    let grant;
    try { grant = await reserve(actor.id, input.entitlementId, input.requestId); } catch { return response(403, { error: 'Download permission unavailable' }); }
    const cancel = async () => { try { await finish(actor.id, input.entitlementId, input.requestId, false); } catch { /* Stale pending reservations recover on retry. */ } };
    if (grant?.bucket_id !== 'nal-products-private' || !/^[a-z0-9][a-z0-9/_-]*\.pdf$/.test(grant?.object_path || '') || grant.object_path.includes('..')) { await cancel(); return response(503, { error: 'Delivery configuration unavailable' }); }
    const seconds = Math.min(600, Math.floor((Date.parse(grant.expires_at) - now()) / 1000));
    if (!Number.isFinite(seconds) || seconds < 1) { await cancel(); return response(403, { error: 'Download request expired' }); }
    try {
      const url = await sign(grant.bucket_id, grant.object_path, seconds, grant.download_name);
      if (await finish(actor.id, input.entitlementId, input.requestId, true) !== true) throw new Error('Reservation not issued');
      return response(200, { downloadUrl: url, expiresAt: grant.expires_at });
    } catch {
      await cancel();
      return response(503, { error: 'Please try downloading again' });
    }
  };
}
