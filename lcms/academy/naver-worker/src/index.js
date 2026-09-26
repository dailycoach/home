import { IntegrationService } from './service.js';
import { NaverAdapter } from './naver.js';
import { AppsScriptBridge } from './bridge.js';
import { readJson, requireAdmin, hmac, fail } from './security.js';
import { adminHtml, adminJs, adminCss } from './admin.js';

const securityHeaders = {
  'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
};
const json = (value, status = 200, origin = '') => new Response(JSON.stringify(value), { status, headers: { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8', ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}) } });
function errorResponse(error, origin = '') {
  // Never log requests, secrets, raw provider errors, tokens or learner data.
  return json({ ok: false, code: error.code || 'INTEGRATION_ERROR', retryable: Boolean(error.retryable) }, error.status || 500, origin);
}
function stub(env) { return env.INTEGRATION.get(env.INTEGRATION.idFromName('lmc-naver-v1')); }
function forwardJson(request, body) {
  const headers = new Headers(request.headers); headers.delete('Content-Length');
  return new Request(request, { headers, body: JSON.stringify(body) });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url), requestedOrigin = request.headers.get('Origin');
    const origin = requestedOrigin === env.REGISTRATION_ORIGIN ? requestedOrigin : '';
    try {
      if (url.pathname === '/health' && request.method === 'GET') return json({ ok: true, service: 'lmc-naver-integration' });
      if (url.pathname.startsWith('/admin')) {
        await requireAdmin(request, env);
        if (request.method === 'POST' && (requestedOrigin !== url.origin || request.headers.get('X-LMC-Admin') !== '1')) fail('ADMIN_ORIGIN', false, 403);
        if (url.pathname === '/admin' || url.pathname === '/admin/') {
          if (request.method !== 'GET') fail('METHOD_NOT_ALLOWED', false, 405);
          return new Response(adminHtml, { headers: { ...securityHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
        }
        for (const [path, content, type] of [['/admin/app.js', adminJs, 'text/javascript'], ['/admin/style.css', adminCss, 'text/css']]) {
          if (url.pathname === path && request.method === 'GET') return new Response(content, { headers: { ...securityHeaders, 'Content-Type': type + '; charset=utf-8' } });
        }
        if (!/^\/admin\/api\/(orders|detail|resync|reconcile|reissue|suspend|review)$/.test(url.pathname)) fail('NOT_FOUND', false, 404);
        const read = /\/(orders|detail)$/.test(url.pathname);
        if (request.method !== (read ? 'GET' : 'POST')) fail('METHOD_NOT_ALLOWED', false, 405);
        if (!read) {
          const body = await readJson(request);
          return await stub(env).fetch(forwardJson(request, body));
        }
        return await stub(env).fetch(request);
      }
      if (!['/registration/verify', '/registration/complete'].includes(url.pathname)) fail('NOT_FOUND', false, 404);
      if (!origin) fail('ORIGIN_DENIED', false, 403);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...securityHeaders, 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } });
      if (request.method !== 'POST') fail('METHOD_NOT_ALLOWED', false, 405);
      const body = await readJson(request);
      return await stub(env).fetch(forwardJson(request, body));
    } catch (error) { return errorResponse(error, origin); }
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(stub(env).fetch('https://internal/sync', { method: 'POST' }));
  }
};

export class NaverIntegration {
  constructor(ctx, env) {
    this.env = env; this.storage = ctx.storage;
    this.service = new IntegrationService(ctx.storage, new NaverAdapter(env), new AppsScriptBridge(env), env);
  }
  async publicOrder(order) {
    const ref = await hmac(`admin:${order.productOrderId}`, this.env.REGISTRATION_SECRET);
    await this.storage.put(`ref:${ref}`, order.productOrderId);
    const { productOrderId, ...safe } = order;
    return { ...safe, ref, maskedOrderId: '••••' + productOrderId.slice(-4) };
  }
  async fetch(request) {
    return this.service.exclusive(async () => {
      const url = new URL(request.url), origin = request.headers.get('Origin') === this.env.REGISTRATION_ORIGIN ? this.env.REGISTRATION_ORIGIN : '';
      try {
        if (url.pathname === '/sync') {
          const result = await this.service.sync();
          await this.storage.put('sync:lastResult', { ok: true, at: new Date().toISOString(), ...result });
          return json(result);
        }
        if (url.pathname === '/admin/api/orders') {
          const after = url.searchParams.get('after');
          const afterId = after ? await this.storage.get(`ref:${after}`) : '';
          if (after && !afterId) fail('INVALID_CURSOR');
          const orders = await this.service.store.list(afterId, 50), safe = [];
          for (const order of orders) safe.push(await this.publicOrder(order));
          return json({ orders: safe, next: safe.length === 50 ? safe.at(-1).ref : '', sync: await this.storage.get('sync:lastResult') || null });
        }
        if (url.pathname === '/admin/api/detail') {
          const id = await this.storage.get(`ref:${url.searchParams.get('id')}`);
          if (!id) fail('INVALID_ORDER');
          return json(await this.publicOrder(await this.service.store.get(id)));
        }
        const body = await readJson(request);
        if (url.pathname.startsWith('/admin/api/')) {
          const id = await this.storage.get(`ref:${body.ref}`); if (!id) fail('INVALID_ORDER');
          return json(await this.publicOrder(await this.service.admin(url.pathname.split('/').at(-1), { ...body, productOrderId: id })));
        }
        const ip = request.headers.get('CF-Connecting-IP');
        if (!ip) fail('CLIENT_ADDRESS_REQUIRED', false, 403);
        const result = url.pathname === '/registration/verify' ? await this.service.verify(body, ip) : await this.service.register(body, ip);
        return json({ ok: true, ...result }, 200, origin);
      } catch (error) {
        if (url.pathname === '/sync') await this.storage.put('sync:lastResult', { ok: false, code: error.code || 'SYNC_ERROR', at: new Date().toISOString() });
        return errorResponse(error, origin);
      }
    });
  }
}
