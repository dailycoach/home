import assert from 'node:assert/strict';
import { createCheckoutHandler } from '../supabase/functions/nal-toss-checkout/handler.mjs';
import { createWebhookHandler } from '../supabase/functions/nal-toss-webhook/handler.mjs';

const user = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email_confirmed_at: '2026-10-04T00:00:00Z', is_anonymous: false };
const order = { orderId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', userId: user.id, amount: 1000, orderName: '반응에서 선택으로', status: 'pending' };
const tokenHeaders = { Authorization: 'Bearer test-token', 'Content-Type': 'application/json', Origin: 'https://daily-coach-ing.com' };

function checkout(overrides = {}) {
  return createCheckoutHandler({
    enabled: true,
    origins: ['https://daily-coach-ing.com'],
    clientKey: 'test_gck_docs',
    successUrl: 'https://daily-coach-ing.com/nal/checkout/success/',
    failUrl: 'https://daily-coach-ing.com/nal/checkout/fail/',
    authenticate: async () => user,
    createOrder: async () => ({ orderId: order.orderId, amount: order.amount, orderName: order.orderName, status: 'pending' }),
    getOrder: async () => order,
    confirmPayment: async (paymentKey, orderId, amount) => ({ paymentKey, orderId, totalAmount: amount, status: 'DONE' }),
    reconcile: async () => ({ status: 'paid', entitlementId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }),
    ...overrides
  });
}

async function json(response) { return [response.status, await response.json()]; }

{
  const handler = checkout({ enabled: false });
  const [status] = await json(await handler(new Request('https://x/functions/v1/nal-toss-checkout', { method: 'POST', headers: tokenHeaders, body: JSON.stringify({ action: 'create-order', productId: 'p', requestId: crypto.randomUUID() }) })));
  assert.equal(status, 503);
}
{
  const handler = checkout();
  const [status] = await json(await handler(new Request('https://x/functions/v1/nal-toss-checkout', { method: 'POST', headers: { ...tokenHeaders, Origin: 'https://evil.example' }, body: '{}' })));
  assert.equal(status, 403);
}
{
  const handler = checkout();
  const [status] = await json(await handler(new Request('https://x/functions/v1/nal-toss-checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create-order', productId: 'p', requestId: crypto.randomUUID() }) })));
  assert.equal(status, 401);
}
{
  const handler = checkout();
  const requestId = crypto.randomUUID();
  const [status, body] = await json(await handler(new Request('https://x/functions/v1/nal-toss-checkout', { method: 'POST', headers: tokenHeaders, body: JSON.stringify({ action: 'create-order', productId: 'dailycoaching-awareness-1000', requestId }) })));
  assert.equal(status, 200);
  assert.equal(body.orderId, order.orderId);
  assert.equal(body.amount, 1000);
  assert.equal(body.clientKey, 'test_gck_docs');
}
{
  let confirmed = false;
  const handler = checkout({ confirmPayment: async () => { confirmed = true; throw new Error('should not run'); } });
  const [status] = await json(await handler(new Request('https://x/functions/v1/nal-toss-checkout', { method: 'POST', headers: tokenHeaders, body: JSON.stringify({ action: 'confirm', orderId: order.orderId, paymentKey: 'pk_test', amount: 999 }) })));
  assert.equal(status, 409);
  assert.equal(confirmed, false);
}
{
  const handler = checkout();
  const [status, body] = await json(await handler(new Request('https://x/functions/v1/nal-toss-checkout', { method: 'POST', headers: tokenHeaders, body: JSON.stringify({ action: 'confirm', orderId: order.orderId, paymentKey: 'pk_test', amount: 1000 }) })));
  assert.equal(status, 200);
  assert.equal(body.status, 'paid');
  assert.ok(body.entitlementId);
}
{
  const handler = checkout({ confirmPayment: async () => ({ paymentKey: 'other', orderId: order.orderId, totalAmount: 1000, status: 'DONE' }) });
  const [status] = await json(await handler(new Request('https://x/functions/v1/nal-toss-checkout', { method: 'POST', headers: tokenHeaders, body: JSON.stringify({ action: 'confirm', orderId: order.orderId, paymentKey: 'pk_test', amount: 1000 }) })));
  assert.equal(status, 502);
}

function webhook(overrides = {}) {
  return createWebhookHandler({
    enabled: true,
    lookupPayment: async paymentKey => ({ paymentKey, orderId: order.orderId, totalAmount: 1000, status: 'DONE' }),
    reconcile: async (_order, _payment, _amount, status) => ({ status: status === 'DONE' ? 'paid' : 'refunded' }),
    ...overrides
  });
}
{
  const handler = webhook({ enabled: false });
  const [status] = await json(await handler(new Request('https://x/functions/v1/nal-toss-webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })));
  assert.equal(status, 503);
}
{
  const handler = webhook();
  const [status, body] = await json(await handler(new Request('https://x/functions/v1/nal-toss-webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: 'OTHER' }) })));
  assert.equal(status, 200);
  assert.equal(body.ignored, true);
}
{
  let reconciled;
  const handler = webhook({ reconcile: async (...args) => { reconciled = args; return { status: 'paid' }; } });
  const [status, body] = await json(await handler(new Request('https://x/functions/v1/nal-toss-webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: 'PAYMENT_STATUS_CHANGED', data: { paymentKey: 'pk_real', status: 'CANCELED', orderId: 'forged' } }) })));
  assert.equal(status, 200);
  assert.equal(body.status, 'paid');
  assert.deepEqual(reconciled, [order.orderId, 'pk_real', 1000, 'DONE']);
}
{
  let reconciled;
  const handler = webhook({
    lookupPayment: async paymentKey => ({ paymentKey, orderId: order.orderId, totalAmount: 1000, status: 'CANCELED' }),
    reconcile: async (...args) => { reconciled = args; return { status: 'refunded' }; }
  });
  const [status, body] = await json(await handler(new Request('https://x/functions/v1/nal-toss-webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: 'PAYMENT_STATUS_CHANGED', data: { paymentKey: 'pk_cancel' } }) })));
  assert.equal(status, 200);
  assert.equal(body.status, 'refunded');
  assert.equal(reconciled[3], 'CANCELED');
}

console.log('NAL Toss payment handlers: PASS');
