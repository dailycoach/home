import { createWebhookHandler } from './handler.mjs';

const base = Deno.env.get('SUPABASE_URL') || '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const secretKey = Deno.env.get('TOSS_SECRET_KEY') || '';
const enabled = Deno.env.get('NAL_TOSS_PAYMENTS_ENABLED') === 'true'
  && /^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(base)
  && /^(?:test|live)_(?:g?sk)_/.test(secretKey)
  && Boolean(serviceKey);

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

async function lookupPayment(paymentKey: string) {
  const result = await fetch(`https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}`, {
    signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Basic ${btoa(`${secretKey}:`)}` }
  });
  if (!result.ok) throw new Error('Toss Payments lookup failed');
  return result.json();
}

Deno.serve(createWebhookHandler({
  enabled,
  lookupPayment,
  reconcile: (order: string, payment: string, amount: number, status: string) =>
    rpc('nal_reconcile_toss_payment', { p_order_id: order, p_payment_key: payment, p_amount_won: amount, p_toss_status: status })
}));
