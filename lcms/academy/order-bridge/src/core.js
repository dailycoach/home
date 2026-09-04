export function normalizePhone(value) {
  let digits = String(value || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('82')) {
    const national = digits.slice(2);
    digits = national.startsWith('0') ? national : `0${national}`;
  }
  return /^01\d{8,9}$/.test(digits) ? digits : '';
}

export function normalizeName(value) {
  return String(value || '').trim().replace(/\s+/g, '').toLocaleLowerCase('ko-KR');
}

export function isMaskedContact(value) {
  return /[*xX]/.test(String(value || ''));
}

export function isClaimBlocking(productOrder) {
  const claimType = String(productOrder?.claimType || '');
  const claimStatus = String(productOrder?.claimStatus || '');
  if (!claimType && !claimStatus) return false;
  if (/(REJECT|HOLDBACK_RELEASE)$/.test(claimStatus)) return false;
  return ['CANCEL', 'RETURN', 'EXCHANGE', 'ADMIN_CANCEL'].includes(claimType) || Boolean(claimStatus);
}

export function classifyOrderDetail(detail, options = {}) {
  const targetProductId = String(options.targetProductId || '');
  const expectedBuyerName = String(options.expectedBuyerName || '');
  const order = detail?.order || {};
  const productOrder = detail?.productOrder || {};
  const productOrderId = String(productOrder.productOrderId || '');

  if (!productOrderId) return { valid: false, reason: 'ORDER_NOT_FOUND' };
  if (String(productOrder.productId || '') !== targetProductId) {
    return { valid: false, reason: 'PRODUCT_MISMATCH', productOrderId };
  }
  if (String(productOrder.productOrderStatus || '') !== 'PAYED') {
    return { valid: false, reason: 'NOT_PAYED', productOrderId };
  }
  if (isClaimBlocking(productOrder)) {
    return { valid: false, reason: 'CLAIM_ACTIVE', productOrderId };
  }

  if (expectedBuyerName && order.ordererName && !/[*xX]/.test(String(order.ordererName))) {
    if (normalizeName(expectedBuyerName) !== normalizeName(order.ordererName)) {
      return { valid: false, reason: 'BUYER_MISMATCH', productOrderId };
    }
  }

  return {
    valid: true,
    reason: 'OK',
    productOrderId,
    orderId: String(order.orderId || ''),
    buyerName: String(order.ordererName || ''),
    phone: normalizePhone(order.ordererTel),
    rawPhone: String(order.ordererTel || ''),
    paymentDate: String(order.paymentDate || ''),
    productName: String(productOrder.productName || ''),
    productId: String(productOrder.productId || '')
  };
}

export function extractPaidChanges(payload) {
  const rows = payload?.data?.lastChangeStatuses;
  if (!Array.isArray(rows)) return [];
  return rows.filter((row) => row?.lastChangedType === 'PAYED' && row?.productOrderStatus === 'PAYED');
}

export function buildRegistrationUrl(formUrl, template, productOrderId) {
  const orderNo = String(productOrderId || '');
  const base = String(formUrl || '').trim();
  const configured = String(template || '').trim();
  if (configured && configured.includes('{productOrderId}')) {
    return configured.replaceAll('{productOrderId}', encodeURIComponent(orderNo));
  }
  return base;
}

export function buildInvitationContent({ buyerName, productOrderId, formUrl, courseName }) {
  const safeName = String(buyerName || '').replace(/[*xX]/g, '').trim();
  const greeting = safeName ? `${safeName}님, ` : '';
  return [
    '[RS에듀컨설팅 LMC ACADEMY]',
    '',
    `${greeting}${courseName || 'LMC 평생진로상담사 2급 과정'}에 함께하게 되신 것을 환영합니다.`,
    '',
    'LMC Academy 입장을 위해 아래 초대장을 열어 수강생 등록을 완료해 주세요.',
    '',
    `상품주문번호: ${productOrderId}`,
    '',
    `초대 수락 / 수강등록: ${formUrl}`,
    '',
    '등록정보와 주문정보가 확인되면 8자리 강의장 입장코드를 이메일로 보내드립니다.',
    '',
    'RS에듀컨설팅 LMC Academy'
  ].join('\n');
}

export function maskPhone(value) {
  const phone = normalizePhone(value);
  if (!phone) return '';
  return phone.length === 11 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : `${phone.slice(0, 3)}***${phone.slice(-4)}`;
}

export function initialPollFrom(nowMs, lookbackMinutes = 15) {
  const minutes = Number(lookbackMinutes);
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? Math.min(minutes, 1440) : 15;
  return new Date(Number(nowMs) - safeMinutes * 60_000).toISOString();
}
