import { createDownloadHandler } from './handler.mjs';

// Server environment only. No dependencies or private keys are shipped to NAL pages.
const base = Deno.env.get('SUPABASE_URL') || '';
const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
async function rpc(name: string, args: Record<string, unknown>) {
  const result = await fetch(`${base}/rest/v1/rpc/${name}`, { method: 'POST', signal: AbortSignal.timeout(10000), headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  if (!result.ok) throw new Error('Permission unavailable');
  return result.json();
}

Deno.serve(createDownloadHandler({
  enabled: Deno.env.get('NAL_DIGITAL_DELIVERY_ENABLED') === 'true' && /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(base) && Boolean(publicKey && serviceKey),
  origins: (Deno.env.get('NAL_ALLOWED_ORIGINS') || 'https://daily-coach-ing.com').split(',').map(s => s.trim()),
  authenticate: async (token: string) => {
    const result = await fetch(`${base}/auth/v1/user`, { signal: AbortSignal.timeout(10000), headers: { apikey: publicKey, Authorization: `Bearer ${token}` } });
    if (!result.ok) throw new Error('Invalid session');
    return result.json();
  },
  reserve: (user: string, entitlement: string, request: string) => rpc('nal_begin_download', { p_user_id: user, p_entitlement_id: entitlement, p_request_id: request }),
  finish: (user: string, entitlement: string, request: string, issued: boolean) => rpc('nal_finish_download', { p_user_id: user, p_entitlement_id: entitlement, p_request_id: request, p_issued: issued }),
  sign: async (bucket: string, path: string, seconds: number, name: string) => {
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    const result = await fetch(`${base}/storage/v1/object/sign/${bucket}/${encoded}`, { method: 'POST', signal: AbortSignal.timeout(10000), headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: seconds }) });
    if (!result.ok) throw new Error('Storage unavailable');
    const data = await result.json();
    if (!data.signedURL?.startsWith(`/object/sign/${bucket}/`)) throw new Error('Invalid storage response');
    const url = new URL(`${base}/storage/v1${data.signedURL}`);
    url.searchParams.set('download', name);
    return url.href;
  }
}));
