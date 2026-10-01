import { enabled, digest, hmac, equal, randomToken, fail } from './security.js';
import { COURSE_ID, TERMINAL, PAID, orderId, phone, name, mappingFor, decision, studentInput } from './domain.js';
import { OrderStore } from './store.js';

export class IntegrationService {
  constructor(storage, adapter, bridge, env, now = Date.now) {
    this.storage = storage; this.store = new OrderStore(storage); this.adapter = adapter; this.bridge = bridge; this.env = env; this.now = now;
    this.tail = Promise.resolve();
  }
  // Also guards against interleaving during fetch. Cloudflare input gates alone
  // only protect storage awaits, not arbitrary external calls.
  exclusive(fn) { const next = this.tail.then(fn); this.tail = next.catch(() => {}); return next; }
  mappings() {
    if (!enabled(this.env.PRODUCT_MAPPING_VERIFIED)) return [];
    try { return JSON.parse(this.env.PRODUCT_MAPPINGS); } catch { fail('MAPPING_INVALID', false, 503); }
  }
  writable(flag) { return !enabled(this.env.DRY_RUN) && enabled(this.env[flag]); }
  async registrationGate(id) {
    if (!enabled(this.env.PRIVACY_POLICY_VERIFIED) || !enabled(this.env.PRODUCT_MAPPING_VERIFIED) || !this.writable('NAVER_AUTO_PROVISION_ENABLED') || !enabled(this.env.NAVER_AUTO_SUSPEND_ENABLED)) fail('REGISTRATION_NOT_OPEN', false, 503);
    if (this.env.REGISTRATION_MODE === 'production') return;
    let allowed;
    try { allowed = JSON.parse(this.env.CANARY_ORDER_HASHES || '[]'); } catch { fail('CANARY_CONFIG', false, 503); }
    if (this.env.REGISTRATION_MODE !== 'canary' || !Array.isArray(allowed) || !allowed.includes(await digest(id))) fail('REGISTRATION_NOT_OPEN', false, 503);
  }
  async observe(order) {
    const old = await this.store.get(order.productOrderId);
    const mapping = mappingFor(order, this.mappings()), d = decision(order, old, mapping);
    const record = {
      productOrderId: order.productOrderId, courseId: mapping?.courseId || old?.courseId || '',
      productId: order.productId, originalProductId: order.originalProductId, sellerProductCode: order.sellerProductCode,
      quantity: order.quantity, purchasedAt: order.purchasedAt, naverStatus: order.status,
      terminalStatus: old?.terminalStatus || (TERMINAL.has(order.status) ? order.status : ''),
      state: d.state, error: d.reason, studentId: old?.studentId || '', accessStatus: old?.accessStatus || '', mailStatus: old?.mailStatus || '',
      lastSync: new Date(this.now()).toISOString(), reviewAt: old?.reviewAt || '', revocationConfirmed: old?.revocationConfirmed || false
    };
    const changed = !old || old.naverStatus !== order.status || old.state !== record.state;
    await this.store.save(record, changed ? (TERMINAL.has(order.status) ? 'CANCEL_DETECTED' : mapping ? 'PRODUCT_MATCHED' : 'PRODUCT_MISMATCH') : '');
    if (record.terminalStatus) {
      // Legacy Form registrations may exist even if this Worker never saw PAYED.
      if (!old?.revocationConfirmed) {
        if (await this.storage.get(`deadletter:${order.productOrderId}`)) return this.store.get(order.productOrderId);
        if (!await this.storage.get(`pending:${order.productOrderId}`)) await this.store.pending(order.productOrderId, 'suspend');
        const job = await this.storage.get(`pending:${order.productOrderId}`);
        if (this.writable('NAVER_AUTO_SUSPEND_ENABLED') && job.attempts < 5 && job.nextAt <= this.now()) {
          try { await this.suspend(record); }
          catch (error) { await this.pendingFailure(`pending:${order.productOrderId}`, job, record, error); }
        }
      }
    }
    return (await this.store.get(order.productOrderId));
  }
  async applyBridge(id, result) {
    const order = await this.store.get(id);
    const state = order.terminalStatus ? (result.accessStatus === '정지' ? 'SUSPENDED' : order.terminalStatus) : result.state;
    return this.store.save({ ...order, ...result, state }, result.accessStatus === '정지' ? 'ACCESS_SUSPENDED' : result.state === 'ACTIVE' ? 'MAIL_SUCCESS' : result.state === 'MANUAL_REVIEW' ? 'ERROR' : 'REGISTRATION_COMPLETED');
  }
  async suspend(order) {
    if (!this.writable('NAVER_AUTO_SUSPEND_ENABLED')) return order;
    const result = await this.bridge.call('naverSuspend', { productOrderId: order.productOrderId, courseId: COURSE_ID, naverStatus: order.terminalStatus || 'ADMIN_SUSPEND' });
    if (order.terminalStatus === 'ADMIN_SUSPEND') await this.store.save(order, 'ADMIN_SUSPEND_REQUESTED');
    await this.applyBridge(order.productOrderId, result);
    await this.store.save({ ...(await this.store.get(order.productOrderId)), revocationConfirmed: !result.error }, '');
    await this.storage.delete(`pending:${order.productOrderId}`);
    return this.store.get(order.productOrderId);
  }
  async reconcile(id) {
    const order = await this.store.get(id); if (!order) fail('INVALID_ORDER');
    if (enabled(this.env.DRY_RUN)) return order;
    if (order.terminalStatus) return this.suspend(order);
    return this.applyBridge(id, await this.bridge.call('naverOrderStatus', { productOrderId: id, courseId: COURSE_ID }));
  }
  async drainPending() {
    const after = await this.storage.get('queue:scan-cursor');
    const entries = await this.storage.list({ prefix: 'pending:', ...(after ? { startAfter: after } : {}), limit: 20 });
    for (const [key, job] of entries) {
      if (job.nextAt > this.now() || job.attempts >= 5) continue;
      const id = key.slice(8), order = await this.store.get(id);
      if (!order || enabled(this.env.DRY_RUN) || (job.operation === 'suspend' && !this.writable('NAVER_AUTO_SUSPEND_ENABLED'))) continue;
      try {
        await this.reconcile(id);
        await this.storage.delete(key);
      } catch (error) {
        await this.pendingFailure(key, job, order, error);
      }
    }
    if (entries.size === 20) await this.storage.put('queue:scan-cursor', [...entries.keys()].at(-1));
    else await this.storage.delete('queue:scan-cursor');
  }
  async pendingFailure(key, job, order, error) {
    const updated = { ...job, attempts: job.attempts + 1, nextAt: this.now() + Math.min(3600000, 60000 * 2 ** job.attempts) };
    if (updated.attempts >= 5) {
      await this.storage.put(`deadletter:${order.productOrderId}`, updated);
      await this.storage.delete(key);
    } else await this.storage.put(key, updated);
    await this.store.save({ ...order, error: error.code || 'INTEGRATION_ERROR', ...(job.attempts >= 4 ? { state: 'MANUAL_REVIEW' } : {}) }, 'ERROR');
  }
  async sync() {
    await this.cleanup();
    if (!enabled(this.env.NAVER_SYNC_ENABLED)) return { disabled: true };
    await this.drainPending();
    let cursor = await this.storage.get('sync:cursor');
    if (!cursor) {
      if (!Number.isFinite(Date.parse(this.env.SYNC_START_AT))) fail('SYNC_START_REQUIRED', false, 503);
      cursor = { from: this.env.SYNC_START_AT, to: null, sequence: null };
    }
    const deadline = this.now() + 45000;
    let pages = 0;
    while (pages < 5 && this.now() < deadline) {
      if (!cursor.to) {
        const end = Math.min(Date.parse(cursor.from) + 86400000, this.now() - 30000);
        if (end <= Date.parse(cursor.from)) break;
        cursor = { ...cursor, to: new Date(end).toISOString() };
        await this.storage.put('sync:cursor', cursor);
      }
      const page = await this.adapter.changes(cursor);
      const orders = await this.adapter.details(page.ids);
      for (const order of orders) await this.observe(order);
      if (page.more) {
        const next = { ...page.more, to: cursor.to };
        if (Date.parse(next.from) < Date.parse(cursor.from) || Date.parse(next.from) > Date.parse(cursor.to) || (next.from === cursor.from && String(next.sequence) === String(cursor.sequence))) fail('NAVER_CURSOR_STALLED', true, 502);
        cursor = next;
      } else {
        // Inclusive overlap is intentional; storage/bridge idempotency absorbs it.
        const caughtUp = Date.parse(cursor.to) >= this.now() - 30000;
        cursor = { from: new Date(Date.parse(cursor.to) - 60000).toISOString(), to: null, sequence: null };
        await this.storage.put('sync:cursor', cursor); pages++;
        if (caughtUp) break;
        continue;
      }
      await this.storage.put('sync:cursor', cursor); pages++;
    }
    return { pages, cursor };
  }
  async rate(key, limit) {
    const now = this.now(), current = await this.storage.get(`rate:${key}`);
    const value = current && current.until > now ? current : { count: 0, until: now + 600000 };
    if (value.count >= limit) fail('RATE_LIMIT', false, 429);
    await this.storage.put(`rate:${key}`, { ...value, count: value.count + 1 });
  }
  async verify(body, ip) {
    await this.registrationGate(String(body.productOrderId || ''));
    const ipHash = await hmac(`ip:${ip}`, this.env.REGISTRATION_SECRET);
    await this.rate(ipHash, 20);
    const id = orderId(body.productOrderId);
    await this.rate(await hmac(`order:${id}`, this.env.REGISTRATION_SECRET), 5);
    const [order] = await this.adapter.details([id]);
    const record = await this.observe(order);
    const verified = equal(order.buyerName, name(body.buyerName)) && equal(order.buyerPhone, phone(body.buyerPhone));
    if (!verified || !['REGISTRATION_PENDING', 'ACTIVE', 'REGISTERED'].includes(record.state) || record.terminalStatus || !PAID.has(order.status)) fail('ORDER_VERIFICATION_FAILED', false, 403);
    const token = randomToken(), tokenHash = await digest(token);
    const session = { productOrderId: id, ipHash, buyerHash: await hmac(`${order.buyerName}|${order.buyerPhone}`, this.env.REGISTRATION_SECRET), expiresAt: this.now() + 900000, claimHash: '' };
    await this.storage.put(`session:${tokenHash}`, session);
    await this.store.save(record, 'REGISTRATION_STARTED');
    return { token, expiresAt: new Date(session.expiresAt).toISOString() };
  }
  async register(body, ip) {
    if (!/^[a-f0-9]{64}$/.test(body.token || '')) fail('REGISTRATION_SESSION_INVALID', false, 403);
    const key = `session:${await digest(body.token)}`, session = await this.storage.get(key);
    if (!session || session.expiresAt <= this.now() || !equal(session.ipHash, await hmac(`ip:${ip}`, this.env.REGISTRATION_SECRET))) fail('REGISTRATION_SESSION_INVALID', false, 403);
    await this.registrationGate(session.productOrderId);
    const student = studentInput(body), claimHash = await hmac(JSON.stringify(student), this.env.REGISTRATION_SECRET);
    if (session.claimHash && !equal(session.claimHash, claimHash)) fail('REGISTRATION_ALREADY_CLAIMED', false, 409);
    const [order] = await this.adapter.details([session.productOrderId]);
    const record = await this.observe(order);
    if (record.terminalStatus || !['REGISTRATION_PENDING', 'REGISTERED', 'ACTIVE'].includes(record.state) || !PAID.has(order.status) || !equal(session.buyerHash, await hmac(`${order.buyerName}|${order.buyerPhone}`, this.env.REGISTRATION_SECRET))) fail('ORDER_VERIFICATION_FAILED', false, 403);
    await this.storage.put(key, { ...session, claimHash });
    await this.store.save({ ...record, state: record.state === 'ACTIVE' ? 'ACTIVE' : 'REGISTERED' }, 'REGISTRATION_COMPLETED');
    // No PII is placed on a retry queue. GAS holds canonical student data.
    await this.store.pending(order.productOrderId, 'reconcile');
    try {
      const result = await this.bridge.call('naverRegister', { productOrderId: order.productOrderId, courseId: COURSE_ID, naverStatus: order.status, quantity: order.quantity, ...student });
      await this.applyBridge(order.productOrderId, result);
      await this.storage.delete(`pending:${order.productOrderId}`);
      return { state: result.state, mailStatus: result.mailStatus };
    } catch (error) {
      await this.store.save({ ...(await this.store.get(order.productOrderId)), error: error.code || 'APPS_SCRIPT_ERROR' }, 'ERROR');
      throw error;
    }
  }
  async admin(action, body) {
    const id = orderId(body.productOrderId);
    if (action === 'resync') {
      const pending = await this.storage.get(`pending:${id}`) || await this.storage.get(`deadletter:${id}`);
      if (pending) await this.store.pending(id, pending.operation);
      await this.storage.delete(`deadletter:${id}`);
      const [order] = await this.adapter.details([id]); return this.observe(order);
    }
    if (action === 'reconcile') return this.reconcile(id);
    const record = await this.store.get(id); if (!record) fail('INVALID_ORDER');
    if (action === 'review') return this.store.save({ ...record, reviewAt: new Date(this.now()).toISOString() }, 'MANUAL_REVIEW_RECORDED');
    if (action === 'suspend') {
      if (!this.writable('NAVER_AUTO_SUSPEND_ENABLED')) fail('MUTATION_DISABLED', false, 409);
      return this.suspend({ ...record, terminalStatus: record.terminalStatus || 'ADMIN_SUSPEND' });
    }
    if (action === 'reissue') {
      if (!this.writable('NAVER_AUTO_PROVISION_ENABLED')) fail('MUTATION_DISABLED', false, 409);
      const [fresh] = await this.adapter.details([id]);
      await this.observe(fresh);
      if (record.terminalStatus || !PAID.has(fresh.status) || fresh.quantity !== 1 || fresh.claim || fresh.gift || !mappingFor(fresh, this.mappings())) fail('REISSUE_NOT_ALLOWED', false, 409);
      if (!/^[a-f0-9-]{36}$/.test(body.operationId || '')) fail('OPERATION_ID_REQUIRED');
      return this.applyBridge(id, await this.bridge.call('naverReissue', { productOrderId: id, courseId: COURSE_ID, operationId: body.operationId }));
    }
    fail('UNSUPPORTED_ACTION');
  }
  async cleanup() {
    for (const prefix of ['session:', 'rate:']) {
      const afterKey = `cleanup:${prefix}`, after = await this.storage.get(afterKey);
      const entries = await this.storage.list({ prefix, ...(after ? { startAfter: after } : {}), limit: 200 });
      for (const [key, value] of entries) if ((value.expiresAt || value.until) <= this.now()) await this.storage.delete(key);
      const keys = [...entries.keys()];
      if (keys.length === 200) await this.storage.put(afterKey, keys.at(-1)); else await this.storage.delete(afterKey);
    }
  }
}
