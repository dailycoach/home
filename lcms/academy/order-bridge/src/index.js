import {
  buildInvitationContent,
  buildRegistrationUrl,
  classifyOrderDetail,
  extractPaidChanges,
  initialPollFrom,
  maskPhone
} from './core.js';
import { createNaverCommerceClient } from './naver.js';
import { sendInvitationLms } from './sens.js';

const CURSOR_KEY = 'cursor:lastChangedFrom';
const INVITE_PREFIX = 'invite:';
const DEFAULT_PROVISION_WINDOW_DAYS = 14;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function configured(env, key) {
  return Boolean(String(env[key] || '').trim());
}

async function timingSafeEqual(a, b) {
  const left = new TextEncoder().encode(String(a || ''));
  const right = new TextEncoder().encode(String(b || ''));
  if (left.length !== right.length || left.length === 0) return false;
  const key = await crypto.subtle.importKey('raw', left, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const [sigA, sigB] = await Promise.all([
    crypto.subtle.sign('HMAC', key, left),
    crypto.subtle.sign('HMAC', key, right)
  ]);
  const aa = new Uint8Array(sigA);
  const bb = new Uint8Array(sigB);
  let diff = 0;
  for (let i = 0; i < aa.length; i += 1) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

async function requireBridgeAuth(request, env) {
  const expected = String(env.BRIDGE_SHARED_SECRET || '');
  const supplied = String(request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  return expected.length >= 32 && (await timingSafeEqual(supplied, expected));
}

function logEvent(event, fields = {}) {
  console.log(JSON.stringify({ event, ...fields, at: new Date().toISOString() }));
}

async function confirmPaymentInAppsScript(env, orderNo) {
  const baseUrl = String(env.APPS_SCRIPT_URL || '').trim();
  const secret = String(env.APPS_SCRIPT_SYNC_SECRET || '').trim();
  if (!baseUrl || !secret) return { configured: false, ok: false };
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'confirmPayment', orderNo, secret })
  });
  const body = await response.json().catch(() => ({}));
  return { configured: true, ok: response.ok && body?.ok === true, status: response.status, body };
}

async function retryPendingProvisions(env) {
  const configuredForProvision = configured(env, 'APPS_SCRIPT_URL') && configured(env, 'APPS_SCRIPT_SYNC_SECRET');
  if (!configuredForProvision) return { configured: false, checked: 0, provisioned: 0, pending: 0 };

  const windowDays = Math.max(1, Math.min(30, Number(env.INVITE_PROVISION_WINDOW_DAYS || DEFAULT_PROVISION_WINDOW_DAYS)));
  const cutoff = Date.now() - windowDays * 86_400_000;
  let cursor;
  let checked = 0;
  let provisioned = 0;
  let pending = 0;

  do {
    const page = await env.ORDER_STATE.list({ prefix: INVITE_PREFIX, cursor, limit: 200 });
    for (const key of page.keys) {
      const state = await env.ORDER_STATE.get(key.name, 'json');
      if (!state || state.status !== 'SENT' || state.provisioned === true) continue;
      const sentAt = Date.parse(state.sentAt || '');
      if (Number.isFinite(sentAt) && sentAt < cutoff) continue;
      const orderNo = key.name.slice(INVITE_PREFIX.length);
      checked += 1;
      try {
        const result = await confirmPaymentInAppsScript(env, orderNo);
        const next = {
          ...state,
          provisionAttempts: Number(state.provisionAttempts || 0) + 1,
          lastProvisionAttemptAt: new Date().toISOString()
        };
        if (result.ok) {
          next.provisioned = true;
          next.provisionedAt = new Date().toISOString();
          provisioned += 1;
          logEvent('student_provisioned', { orderNo });
        } else {
          pending += 1;
        }
        await env.ORDER_STATE.put(key.name, JSON.stringify(next));
      } catch (error) {
        pending += 1;
        logEvent('provision_retry_error', { orderNo, message: String(error?.message || error) });
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return { configured: true, checked, provisioned, pending };
}

async function pollPaidOrders(env) {
  const client = createNaverCommerceClient(env);
  const targetProductId = String(env.TARGET_PRODUCT_ID || '').trim();
  if (!targetProductId) throw new Error('MISSING_ENV_TARGET_PRODUCT_ID');
  const now = new Date();
  const lastChangedTo = now.toISOString();
  let lastChangedFrom = (await env.ORDER_STATE.get(CURSOR_KEY)) || initialPollFrom(now.getTime(), env.POLL_LOOKBACK_MINUTES);
  let moreSequence = '';
  let seen = 0;
  let target = 0;
  let sent = 0;
  let skipped = 0;

  for (let page = 0; page < 20; page += 1) {
    const changesPayload = await client.getPaidChanges({ lastChangedFrom, lastChangedTo, moreSequence });
    const paidChanges = extractPaidChanges(changesPayload);
    seen += paidChanges.length;
    const ids = paidChanges.map((row) => row.productOrderId).filter(Boolean);
    const details = ids.length ? await client.queryProductOrders(ids) : [];

    for (const detail of details) {
      const classified = classifyOrderDetail(detail, { targetProductId });
      if (!classified.valid) continue;
      target += 1;
      const inviteKey = `${INVITE_PREFIX}${classified.productOrderId}`;
      if (await env.ORDER_STATE.get(inviteKey)) {
        skipped += 1;
        continue;
      }
      if (!classified.phone || /[*xX]/.test(classified.rawPhone)) {
        await env.ORDER_STATE.put(inviteKey, JSON.stringify({ status: 'MANUAL_CONTACT_REQUIRED', at: now.toISOString() }));
        logEvent('invite_skipped_phone', { orderNo: classified.productOrderId });
        skipped += 1;
        continue;
      }

      const formUrl = buildRegistrationUrl(env.FORM_URL, env.FORM_PREFILL_URL_TEMPLATE, classified.productOrderId);
      if (!formUrl) throw new Error('MISSING_ENV_FORM_URL');
      const content = buildInvitationContent({
        buyerName: classified.buyerName,
        productOrderId: classified.productOrderId,
        formUrl,
        courseName: String(env.COURSE_NAME || 'LMC 평생진로상담사 2급 과정')
      });
      const result = await sendInvitationLms(env, {
        to: classified.phone,
        subject: 'LMC Academy 초대',
        content
      });
      await env.ORDER_STATE.put(inviteKey, JSON.stringify({
        status: 'SENT',
        requestId: result.requestId || '',
        sentAt: now.toISOString(),
        phone: maskPhone(classified.phone),
        provisioned: false,
        provisionAttempts: 0
      }));
      logEvent('invite_sent', { orderNo: classified.productOrderId, phone: maskPhone(classified.phone) });
      sent += 1;
    }

    const more = changesPayload?.data?.more;
    if (!more?.moreFrom || !more?.moreSequence) break;
    lastChangedFrom = more.moreFrom;
    moreSequence = more.moreSequence;
  }

  await env.ORDER_STATE.put(CURSOR_KEY, lastChangedTo);
  const provisioning = await retryPendingProvisions(env);
  const summary = { ok: true, lastChangedTo, seen, target, sent, skipped, provisioning };
  logEvent('poll_complete', summary);
  return summary;
}

async function verifyOrder(request, env) {
  if (!(await requireBridgeAuth(request, env))) return json({ ok: false, valid: false, reason: 'UNAUTHORIZED' }, 401);
  const body = await request.json().catch(() => ({}));
  const orderNo = String(body.orderNo || '').trim();
  const buyerName = String(body.buyerName || '').trim();
  if (!/^\d{10,20}$/.test(orderNo)) return json({ ok: true, valid: false, reason: 'INVALID_ORDER_NO' });

  const client = createNaverCommerceClient(env);
  const details = await client.queryProductOrders([orderNo]);
  const detail = details.find((item) => String(item?.productOrder?.productOrderId || '') === orderNo);
  const classified = classifyOrderDetail(detail, {
    targetProductId: String(env.TARGET_PRODUCT_ID || ''),
    expectedBuyerName: buyerName
  });
  return json({
    ok: true,
    valid: classified.valid,
    reason: classified.reason,
    orderNo,
    paymentDate: classified.valid ? classified.paymentDate : ''
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === 'GET' && url.pathname === '/health') {
        return json({
          ok: true,
          service: 'lmc-order-bridge',
          targetProductId: String(env.TARGET_PRODUCT_ID || ''),
          commerceConfigured: configured(env, 'NAVER_CLIENT_ID') && configured(env, 'NAVER_CLIENT_SECRET'),
          sensConfigured: configured(env, 'SENS_SERVICE_ID') && configured(env, 'SENS_ACCESS_KEY') && configured(env, 'SENS_SECRET_KEY') && configured(env, 'SENS_FROM'),
          formConfigured: configured(env, 'FORM_URL'),
          appsScriptConfigured: configured(env, 'APPS_SCRIPT_URL') && configured(env, 'APPS_SCRIPT_SYNC_SECRET'),
          timestamp: new Date().toISOString()
        });
      }
      if (request.method === 'POST' && url.pathname === '/verify-order') return verifyOrder(request, env);
      if (request.method === 'POST' && url.pathname === '/admin/poll') {
        if (!(await requireBridgeAuth(request, env))) return json({ ok: false, reason: 'UNAUTHORIZED' }, 401);
        return json(await pollPaidOrders(env));
      }
      return json({ ok: false, reason: 'NOT_FOUND' }, 404);
    } catch (error) {
      logEvent('request_error', { path: url.pathname, message: String(error?.message || error) });
      return json({ ok: false, reason: 'INTERNAL_ERROR' }, 500);
    }
  },

  async scheduled(_controller, env) {
    await pollPaidOrders(env);
  }
};
