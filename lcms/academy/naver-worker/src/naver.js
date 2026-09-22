import bcrypt from 'bcryptjs';
import { fail, IntegrationError, enabled } from './security.js';
import { normalizeOrder, orderId } from './domain.js';

const BASE = 'https://api.commerce.naver.com/external';
export const kst = milliseconds => new Date(milliseconds + 9 * 3600000).toISOString().replace('Z', '+09:00');
export async function clientSecretSign(clientId, secret, timestamp) {
  return btoa(await bcrypt.hash(`${clientId}_${timestamp}`, secret));
}
export class NaverAdapter {
  constructor(env, { fetcher = fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), now = Date.now } = {}) {
    this.env = env; this.fetcher = fetcher; this.sleep = sleep; this.now = now; this.cached = null;
  }
  async token(force = false) {
    if (!enabled(this.env.NAVER_EGRESS_VERIFIED)) fail('EXTERNAL_AUTH_REQUIRED', false, 503);
    if (!force && this.cached?.until > this.now() + 60000) return this.cached.token;
    const e = this.env, timestamp = this.now();
    if (!e.NAVER_COMMERCE_CLIENT_ID || !e.NAVER_COMMERCE_CLIENT_SECRET) fail('EXTERNAL_AUTH_REQUIRED', false, 503);
    const type = e.NAVER_TOKEN_TYPE || 'SELF';
    if (!['SELF', 'SELLER'].includes(type) || (type === 'SELLER' && !e.NAVER_COMMERCE_ACCOUNT_ID)) fail('NAVER_AUTH_CONFIG', false, 503);
    const body = new URLSearchParams({ client_id: e.NAVER_COMMERCE_CLIENT_ID, timestamp: String(timestamp), grant_type: 'client_credentials', type,
      client_secret_sign: await clientSecretSign(e.NAVER_COMMERCE_CLIENT_ID, e.NAVER_COMMERCE_CLIENT_SECRET, timestamp) });
    if (type === 'SELLER') body.set('account_id', e.NAVER_COMMERCE_ACCOUNT_ID);
    const data = await this.request('/v1/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }, false);
    if (typeof data.access_token !== 'string' || !data.access_token || !Number.isFinite(data.expires_in) || data.expires_in <= 0) fail('NAVER_AUTH_SCHEMA', false, 502);
    this.cached = { token: data.access_token, until: this.now() + data.expires_in * 1000 };
    return data.access_token;
  }
  async request(path, options, authenticated = true) {
    let refreshed = false, retry = 0;
    for (;;) {
      let response, data;
      const token = authenticated ? await this.token() : null;
      try {
        response = await this.fetcher(BASE + path, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000), headers: { ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      } catch { if (retry >= 2) fail('NETWORK_ERROR', true, 502); await this.sleep(250 * 2 ** retry++); continue; }
      try { data = await response.json(); } catch { data = {}; }
      if (response.ok) return data;
      if (authenticated && response.status === 401 && data.code === 'GW.AUTHN' && !refreshed) { refreshed = true; await this.token(true); continue; }
      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && retry < 2) {
        const seconds = Number(response.headers.get('Retry-After'));
        if (seconds > 5) fail('RATE_LIMIT', true, 429);
        await this.sleep(Math.max(250 * 2 ** retry++, (seconds || 0) * 1000) + Math.floor(Math.random() * 100)); continue;
      }
      throw new IntegrationError(response.status === 429 ? 'RATE_LIMIT' : response.status >= 500 ? 'NAVER_5XX' : [401, 403].includes(response.status) ? 'AUTH_ERROR' : 'INVALID_ORDER', retryable, 502);
    }
  }
  async changes({ from, to, sequence }) {
    const params = new URLSearchParams({ lastChangedFrom: kst(Date.parse(from)), lastChangedTo: kst(Date.parse(to)), limitCount: '300' });
    if (sequence != null) params.set('moreSequence', String(sequence));
    const result = await this.request(`/v1/pay-order/seller/product-orders/last-changed-statuses?${params}`, { method: 'GET' });
    const data = result?.data;
    if (!data || !Array.isArray(data.lastChangeStatuses) || data.lastChangeStatuses.length > 300 || data.count !== data.lastChangeStatuses.length) fail('NAVER_SCHEMA', true, 502);
    const more = data.more;
    if (more && (!Number.isFinite(Date.parse(more.moreFrom)) || more.moreSequence == null)) fail('NAVER_CURSOR', true, 502);
    return { ids: [...new Set(data.lastChangeStatuses.map(x => orderId(x.productOrderId)))], more: more ? { from: more.moreFrom, sequence: more.moreSequence } : null };
  }
  async details(ids) {
    const unique = [...new Set(ids.map(orderId))], results = [];
    for (let i = 0; i < unique.length; i += 300) {
      const chunk = unique.slice(i, i + 300);
      const data = await this.request('/v1/pay-order/seller/product-orders/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productOrderIds: chunk, quantityClaimCompatibility: true }) });
      if (!Array.isArray(data?.data)) fail('NAVER_SCHEMA', true, 502);
      const orders = data.data.map(normalizeOrder);
      if (orders.length !== chunk.length || new Set(orders.map(x => x.productOrderId)).size !== chunk.length || chunk.some(id => !orders.some(x => x.productOrderId === id))) fail('NAVER_PARTIAL_RESPONSE', true, 502);
      results.push(...orders);
    }
    return results;
  }
}
// Injected only by tests/local tools; production HTTP has no fixture ingestion route.
export class MockNaverAdapter {
  constructor(details = [], pages = []) { this.orders = new Map(details.map(x => { const n = normalizeOrder(x); return [n.productOrderId, n]; })); this.pages = pages; this.calls = 0; }
  async changes() { return this.pages[this.calls++] || { ids: [...this.orders.keys()], more: null }; }
  async details(ids) { return ids.map(id => { if (!this.orders.has(id)) fail('INVALID_ORDER'); return structuredClone(this.orders.get(id)); }); }
}
