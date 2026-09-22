// One object per integration environment. The caller serializes whole operations,
// including network awaits. A productOrderId has exactly one durable key.
export class OrderStore {
  constructor(storage) { this.storage = storage; }
  get(id) { return this.storage.get(`order:${id}`); }
  async save(order, event = '') {
    const previous = await this.get(order.productOrderId);
    const audit = [...(previous?.audit || [])];
    if (event) audit.push({ at: new Date().toISOString(), event });
    const record = { ...order, audit: audit.slice(-100) };
    await this.storage.put(`order:${order.productOrderId}`, record);
    return record;
  }
  async list(after = '', limit = 50) {
    const entries = await this.storage.list({ prefix: 'order:', ...(after ? { startAfter: `order:${after}` } : {}), limit });
    return [...entries.values()];
  }
  async pending(id, operation) { await this.storage.put(`pending:${id}`, { operation, attempts: 0, nextAt: 0 }); }
}
