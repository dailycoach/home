// Read-only staging tool. Inject credentials from the approved secret manager.
// Output intentionally excludes order id, buyer identity, phone and addresses.
import { NaverAdapter } from '../src/naver.js';
import { digest } from '../src/security.js';
try {
  const id = process.env.NAVER_SAMPLE_PRODUCT_ORDER_ID;
  if (!id) throw new Error('EXTERNAL_AUTH_REQUIRED');
  const adapter = new NaverAdapter(process.env);
  const [order] = await adapter.details([id]);
  console.log(JSON.stringify({
    productId: order.productId, originalProductId: order.originalProductId, sellerProductCode: order.sellerProductCode,
    naverStatus: order.status, quantity: order.quantity, remainQuantity: order.remainQuantity,
    maskedBuyer: !/^01\d{8,9}$/.test(order.buyerPhone) || /[*＊]/.test(order.buyerName),
    mappingAutomaticallyChanged: false,
    canaryOrderHash: await digest(id)
  }, null, 2));
} catch (error) {
  console.error(error.code || 'EXTERNAL_AUTH_REQUIRED'); process.exitCode = 1;
}
