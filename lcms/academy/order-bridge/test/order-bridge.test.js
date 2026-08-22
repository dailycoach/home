import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInvitationContent,
  buildRegistrationUrl,
  classifyOrderDetail,
  extractPaidChanges,
  initialPollFrom,
  normalizePhone
} from '../src/core.js';

const targetProductId = '13702661269';

function detail(overrides = {}) {
  return {
    order: {
      orderId: '2026081812345678',
      ordererName: '김철웅',
      ordererTel: '010-1234-5678',
      paymentDate: '2026-08-18T18:00:00+09:00',
      ...(overrides.order || {})
    },
    productOrder: {
      productOrderId: '2026081812345671',
      productId: targetProductId,
      productOrderStatus: 'PAYED',
      productName: 'LMC 평생진로상담사 2급',
      ...(overrides.productOrder || {})
    }
  };
}

test('normalizes Korean phone numbers', () => {
  assert.equal(normalizePhone('010-1234-5678'), '01012345678');
  assert.equal(normalizePhone('+82 10-1234-5678'), '01012345678');
  assert.equal(normalizePhone('****'), '');
});

test('accepts the paid target product and buyer name', () => {
  const result = classifyOrderDetail(detail(), { targetProductId, expectedBuyerName: '김 철 웅' });
  assert.equal(result.valid, true);
  assert.equal(result.phone, '01012345678');
});

test('rejects wrong product, unpaid, active claim, and buyer mismatch', () => {
  assert.equal(classifyOrderDetail(detail({ productOrder: { productId: '1' } }), { targetProductId }).reason, 'PRODUCT_MISMATCH');
  assert.equal(classifyOrderDetail(detail({ productOrder: { productOrderStatus: 'CANCELED' } }), { targetProductId }).reason, 'NOT_PAYED');
  assert.equal(classifyOrderDetail(detail({ productOrder: { claimType: 'CANCEL', claimStatus: 'CANCEL_REQUEST' } }), { targetProductId }).reason, 'CLAIM_ACTIVE');
  assert.equal(classifyOrderDetail(detail(), { targetProductId, expectedBuyerName: '다른사람' }).reason, 'BUYER_MISMATCH');
});

test('extracts only PAYED changes', () => {
  const rows = extractPaidChanges({
    data: {
      lastChangeStatuses: [
        { productOrderId: '1', lastChangedType: 'PAYED', productOrderStatus: 'PAYED' },
        { productOrderId: '2', lastChangedType: 'CLAIM_REQUESTED', productOrderStatus: 'PAYED' }
      ]
    }
  });
  assert.deepEqual(rows.map((row) => row.productOrderId), ['1']);
});

test('uses prefilled template when configured', () => {
  assert.equal(
    buildRegistrationUrl('https://form.example/plain', 'https://form.example/?entry={productOrderId}', '2026 01'),
    'https://form.example/?entry=2026%2001'
  );
  assert.equal(buildRegistrationUrl('https://form.example/plain', '', '1'), 'https://form.example/plain');
});

test('builds an invitation with order number and form URL', () => {
  const content = buildInvitationContent({
    buyerName: '김철웅',
    productOrderId: '2026081812345671',
    formUrl: 'https://form.example',
    courseName: 'LMC 평생진로상담사 2급 과정'
  });
  assert.match(content, /2026081812345671/);
  assert.match(content, /https:\/\/form\.example/);
  assert.match(content, /8자리/);
});

test('initial cursor uses bounded lookback', () => {
  const now = Date.parse('2026-08-18T09:00:00Z');
  assert.equal(initialPollFrom(now, 15), '2026-08-18T08:45:00.000Z');
});
