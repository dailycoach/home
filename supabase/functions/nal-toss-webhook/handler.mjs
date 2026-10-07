export function createWebhookHandler({ enabled, lookupPayment, reconcile }) {
  return async (request) => {
    const response = (status, value) => new Response(JSON.stringify(value), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
    if (request.method !== 'POST') return response(405, { error: 'Use POST' });
    if (!enabled) return response(503, { error: 'Payments are not connected yet' });
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) return response(415, { error: 'Use JSON' });

    let event;
    try {
      const raw = await request.text();
      if (raw.length > 262144) return response(413, { error: 'Request too large' });
      event = JSON.parse(raw);
    } catch {
      return response(400, { error: 'Invalid JSON' });
    }

    if (event?.eventType !== 'PAYMENT_STATUS_CHANGED') return response(200, { ignored: true });
    const hinted = event?.data;
    if (!hinted || typeof hinted.paymentKey !== 'string' || hinted.paymentKey.length < 1 || hinted.paymentKey.length > 200) {
      return response(400, { error: 'Invalid payment event' });
    }

    let payment;
    try { payment = await lookupPayment(hinted.paymentKey); }
    catch { return response(503, { error: 'Payment verification unavailable' }); }
    if (!payment?.paymentKey || payment.paymentKey !== hinted.paymentKey
      || typeof payment.orderId !== 'string' || !Number.isInteger(payment.totalAmount)
      || typeof payment.status !== 'string') {
      return response(400, { error: 'Invalid verified payment' });
    }

    // BUILD07: ignore only the VERIFIED dedicated READ namespace. Its separate
    // durable receiver handles READ fulfillment. All existing PDF logic stays below.
    if (/^nr_[a-f0-9]{32}$/.test(payment.orderId)) return response(200, { ignored: true, handler: 'nal-read-payments-webhook' });

    try {
      const result = await reconcile(payment.orderId, payment.paymentKey, payment.totalAmount, payment.status);
      return response(200, { ok: true, status: result?.status || 'pending' });
    } catch {
      return response(503, { error: 'Reconciliation unavailable' });
    }
  };
}
