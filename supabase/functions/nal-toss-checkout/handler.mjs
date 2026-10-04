const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const productId = /^[a-z0-9-]{1,120}$/;

export function createCheckoutHandler({
  enabled,
  origins,
  authenticate,
  createOrder,
  getOrder,
  confirmPayment,
  reconcile,
  clientKey,
  successUrl,
  failUrl
}) {
  return async (request) => {
    const origin = request.headers.get('Origin');
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin' };
    if (origin && origins.includes(origin)) Object.assign(headers, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    });
    const response = (status, value) => new Response(JSON.stringify(value), { status, headers });

    if (origin && !origins.includes(origin)) return response(403, { error: 'Origin not allowed' });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return response(405, { error: 'Use POST' });
    if (!enabled) return response(503, { error: 'Payments are not connected yet' });
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) return response(415, { error: 'Use JSON' });

    const token = request.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (!token) return response(401, { error: 'Verified login required' });
    let actor;
    try { actor = await authenticate(token); } catch { return response(401, { error: 'Verified login required' }); }
    if (!actor?.id || !actor.email_confirmed_at || actor.is_anonymous) return response(401, { error: 'Verified login required' });

    let input;
    try {
      const raw = await request.text();
      if (raw.length > 4096) return response(413, { error: 'Request too large' });
      input = JSON.parse(raw);
    } catch {
      return response(400, { error: 'Invalid JSON' });
    }

    if (input?.action === 'create-order') {
      if (!productId.test(input.productId || '') || !uuid.test(input.requestId || '')
        || Object.keys(input).some(k => !['action', 'productId', 'requestId'].includes(k))) {
        return response(400, { error: 'Invalid order request' });
      }
      try {
        const order = await createOrder(actor.id, input.productId, input.requestId);
        if (!uuid.test(order?.orderId || '') || !Number.isInteger(order?.amount) || order.amount < 100 || !order?.orderName) {
          throw new Error('Invalid order state');
        }
        return response(200, {
          orderId: order.orderId,
          orderName: String(order.orderName).slice(0, 100),
          amount: order.amount,
          currency: 'KRW',
          clientKey,
          successUrl,
          failUrl
        });
      } catch {
        return response(409, { error: 'Product checkout is unavailable' });
      }
    }

    if (input?.action === 'confirm') {
      if (!uuid.test(input.orderId || '') || typeof input.paymentKey !== 'string' || input.paymentKey.length < 1 || input.paymentKey.length > 200
        || !Number.isInteger(input.amount) || input.amount < 100
        || Object.keys(input).some(k => !['action', 'orderId', 'paymentKey', 'amount'].includes(k))) {
        return response(400, { error: 'Invalid confirmation request' });
      }
      let order;
      try { order = await getOrder(actor.id, input.orderId); } catch { return response(403, { error: 'Order unavailable' }); }
      if (!order || order.userId !== actor.id || order.orderId !== input.orderId || !Number.isInteger(order.amount)
        || order.amount !== input.amount || !['pending', 'paid'].includes(order.status)) {
        return response(409, { error: 'Order verification failed' });
      }

      let payment;
      try { payment = await confirmPayment(input.paymentKey, order.orderId, order.amount); }
      catch { return response(502, { error: 'Payment approval failed' }); }
      if (payment?.paymentKey !== input.paymentKey || payment?.orderId !== order.orderId
        || payment?.totalAmount !== order.amount || payment?.status !== 'DONE') {
        return response(502, { error: 'Payment verification failed' });
      }

      try {
        const result = await reconcile(order.orderId, payment.paymentKey, payment.totalAmount, payment.status);
        return response(200, { status: result?.status || 'paid', orderId: order.orderId, entitlementId: result?.entitlementId || null });
      } catch {
        return response(503, { error: 'Payment was approved but delivery reconciliation is pending', orderId: order.orderId });
      }
    }

    return response(400, { error: 'Unknown action' });
  };
}
