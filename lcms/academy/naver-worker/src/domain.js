import { fail } from './security.js';
export const COURSE_ID = 'lmc-lifetime-management-counselor';
export const TERMINAL = new Set(['CANCELED', 'RETURNED', 'CANCELED_BY_NOPAYMENT']);
export const PAID = new Set(['PAYED', 'DELIVERING', 'DELIVERED', 'PURCHASE_DECIDED']);
export function orderId(value) {
  if (typeof value !== 'string' || !/^\d{8,30}$/.test(value)) fail('INVALID_ORDER');
  return value;
}
export const phone = value => String(value || '').replace(/[\s()+-]/g, '').replace(/^82(?=1)/, '0');
export const name = value => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
export function normalizeOrder(detail) {
  const p = detail?.productOrder, o = detail?.order;
  if (!p || !o) fail('NAVER_SCHEMA', true, 502);
  return {
    productOrderId: orderId(p.productOrderId),
    status: String(p.productOrderStatus || ''),
    productId: String(p.productId || ''), originalProductId: String(p.originalProductId || ''), sellerProductCode: String(p.sellerProductCode || ''),
    quantity: Number(p.initialQuantity ?? p.quantity), remainQuantity: p.remainQuantity == null ? null : Number(p.remainQuantity),
    claim: Boolean(p.claimStatus || p.claimType || detail.currentClaim || detail.completedClaims?.length),
    purchasedAt: o.paymentDate || o.orderDate || '',
    // These verification fields are never persisted by the order store.
    buyerName: name(o.ordererName), buyerPhone: phone(o.ordererTel), gift: Boolean(p.giftReceivingStatus)
  };
}
export function mappingFor(order, mappings) {
  const allowed = ['productId', 'originalProductId', 'sellerProductCode'];
  if (!Array.isArray(mappings) || mappings.some(x => !allowed.includes(x.field) || typeof x.value !== 'string' || !x.value || x.courseId !== COURSE_ID)) fail('MAPPING_INVALID', false, 503);
  return mappings.find(x => order[x.field] === x.value) || null;
}
export function decision(order, old, mapping) {
  if (TERMINAL.has(order.status)) return { state: old?.terminalStatus ? old.state : order.status, reason: old?.revocationConfirmed ? '' : old?.error || order.status };
  if (old?.terminalStatus) return { state: old.state, reason: old.terminalStatus };
  if (!mapping) return { state: 'IGNORED', reason: 'PRODUCT_MISMATCH' };
  if (order.quantity !== 1 || (order.remainQuantity != null && order.remainQuantity !== 1)) return { state: 'MANUAL_REVIEW', reason: 'QUANTITY_REVIEW' };
  if (order.gift || !order.buyerName || /[*＊]/.test(order.buyerName) || !/^01\d{8,9}$/.test(order.buyerPhone)) return { state: 'MANUAL_REVIEW', reason: 'BUYER_INFO_UNAVAILABLE' };
  if (order.status === 'EXCHANGED' || order.claim) return { state: 'MANUAL_REVIEW', reason: 'CLAIM_REVIEW' };
  if (order.status === 'PAYMENT_WAITING') return { state: 'NAVER_DETECTED', reason: 'PAYMENT_WAITING' };
  if (!PAID.has(order.status)) return { state: 'MANUAL_REVIEW', reason: 'UNKNOWN_STATUS' };
  // An explicit admin suspension or uncertain issuance must not be undone by sync.
  if (old && ['SUSPENDED', 'MANUAL_REVIEW', 'REGISTERED', 'ACTIVE'].includes(old.state)) return { state: old.state, reason: old.error || '' };
  return { state: 'REGISTRATION_PENDING', reason: '' };
}
export function studentInput(value) {
  const student = { studentName: name(value.studentName), email: String(value.email || '').trim().toLowerCase(), phone: phone(value.phone), consent: value.consent === true, consentVersion: 'lmc-registration-v1' };
  if (!student.studentName || student.studentName.length > 80 || /[\x00-\x1f]/.test(student.studentName) || student.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email) || !/^01\d{8,9}$/.test(student.phone) || !student.consent) fail('INVALID_STUDENT');
  return student;
}
