import { hmac, fail } from './security.js';
export class AppsScriptBridge {
  constructor(env, fetcher = fetch) { this.env = env; this.fetcher = fetcher; }
  async call(action, payload) {
    const url = this.env.APPS_SCRIPT_ACCESS_URL;
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url || '')) fail('EXTERNAL_AUTH_REQUIRED', false, 503);
    const body = JSON.stringify(payload), timestamp = Date.now();
    const signature = await hmac(`${action}\n${timestamp}\n${body}`, this.env.APPS_SCRIPT_SHARED_SECRET);
    let response;
    try {
      response = await this.fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, timestamp, body, signature }), signal: AbortSignal.timeout(30000), redirect: 'follow' });
    } catch { fail('APPS_SCRIPT_TIMEOUT', true, 502); }
    let result;
    try { result = await response.json(); } catch { fail('APPS_SCRIPT_ERROR', true, 502); }
    if (!response.ok || result?.ok !== true || !result.result || typeof result.result.state !== 'string') fail('APPS_SCRIPT_ERROR', true, 502);
    // Upstream student names/email/code hashes are deliberately excluded.
    const r = result.result;
    return { state: r.state, studentId: String(r.studentId || ''), accessStatus: String(r.accessStatus || ''), mailStatus: String(r.mailStatus || ''), error: String(r.error || '') };
  }
}
