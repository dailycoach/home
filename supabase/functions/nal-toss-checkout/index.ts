import { createCheckoutHandler } from './handler.mjs';

const base = Deno.env.get('SUPABASE_URL') || '';
const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const clientKey = Deno.env.get('TOSS_CLIENT_KEY') || '';
const secretKey = Deno.env.get('TOSS_SECRET_KEY') || '';
const enabled = Deno.env.get('NAL_TOSS_PAYMENTS_ENABLED') === 'true'
  && /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(base)
  && /^(?:test|live)_(?:g?ck)_/.test(clientKey)
  && /^(?:test|live)_(?:g?sk)_/.test(secretKey)
  && Boolean(publicKey && serviceKey);

async function rpc(name: string, args: Record<string, unknown>) {
  const result = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  if (!result.ok) throw new Error('Database operation unavailable');
  return result.json();
}

async function toss(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Basic ${btoa(`${secretKey}:`)}`);
  headers.set('Content-Type', 'application/json');
  const result = await fetch(`https://api.tosspayments.com${path}`, { ...init, headers, signal: AbortSignal.timeout(10000) });
  if (!result.ok) throw new Error('Toss Payments request failed');
  return result.json();
}

Deno.serve(createCheckoutHandler({
  enabled,
  origins: (Deno.env.get('NAL_ALLOWED_ORIGINS') || 'https://daily-coach-ing.com').split(',').map(s => s.trim()).filter(Boolean),
  clientKey,
  successUrl: Deno.env.get('NAL_TOSS_SUCCESS_URL') || 'https://daily-coach-ing.com/nal/checkout/success/',
  failUrl: Deno.env.get('NAL_TOSS_FAIL_URL') || 'https://daily-coach-ing.com/nal/checkout/fail/',
  authenticate: async (token: string) => {
    const result = await fetch(`${base}/auth/v1/user`, {
      signal: AbortSignal.timeout(10000),
      headers: { apikey: publicKey, Authorization: `Bearer ${token}` }
    });
    if (!result.ok) throw new Error('Invalid session');
    return result.json();
  },
  createOrder: (user: string, product: string, request: string) =>
    rpc('nal_create_product_order', { p_user_id: user, p_product_id: product, p_request_id: request }),
  getOrder: (user: string, order: string) =>
    rpc('nal_get_product_order', { p_user_id: user, p_order_id: order }),
  confirmPayment: (paymentKey: string, orderId: string, amount: number) =>
    toss('/v1/payments/confirm', {
      method: 'POST',
      headers: { 'Idempotency-Key': orderId },
      body: JSON.stringify({ paymentKey, orderId, amount })
    }),
  reconcile: (order: string, payment: string, amount: number, status: string) =>
    rpc('nal_reconcile_toss_payment', { p_order_id: order, p_payment_key: payment, p_amount_won: amount, p_toss_status: status })
}));
