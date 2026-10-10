import { mintReceiptLink } from './receipt-link.mjs';

/**
 * Transactional guest receipt outbox worker contract (SOURCE ONLY).
 * Caller MUST provide a real email adapter and atomic private DB store only
 * after operator/legal approval. No standalone cron or mail service is deployed.
 *
 * takeOne() leases a single verified-paid order job; getPaidGuestOrder() rechecks
 * latest payment/refund state. rotate() stores hash and invalidates prior token.
 * markSent() closes idempotent outbox; markRetry() retains the job on failure.
 */
export async function processOneReceipt({
  release=false,outbox,orders,tokens,mailer,now=Date.now,
}={}) {
  if(release!==true ||
    typeof outbox?.takeOne!=='function' ||
    typeof outbox?.markSent!=='function' ||
    typeof outbox?.markRetry!=='function' ||
    typeof orders?.getPaidGuestOrder!=='function' ||
    typeof tokens?.rotate!=='function' ||
    typeof mailer?.send!=='function') return {state:'disabled'};
  let job=null;
  try {
    job=await outbox.takeOne();
    if(!job)return {state:'empty'};
    const paid=await orders.getPaidGuestOrder(job.orderId);
    // Retry is fail-closed: do not send even an old token after refund.
    if(!paid||paid.status!=='paid'||paid.revoked===true
      ||paid.id!==job.orderId ||typeof paid.email!=='string'
      ||!paid.email.includes('@')) throw Error('ORDER_NOT_AUTHORIZED');
    const receipt=await mintReceiptLink({orderId:paid.id,now:now()});
    if(await tokens.rotate({
      orderId:paid.id,tokenDigest:receipt.tokenDigest,expiresAt:receipt.expiresAt
    })!==true)throw Error('RECEIPT_NOT_STORED');
    await mailer.send({
      to:paid.email,
      subject:'[NAL · 날빛] 구매하신 PDF를 확인하세요',
      text:'구매한 PDF를 안전하게 받을 수 있는 일회용 링크입니다.\n'+
        '45분 이내에 열어 주세요. 링크를 공유하지 마세요.\n'+receipt.url+'\n'
    });
    await outbox.markSent(job.id);
    return {state:'sent',orderId:job.orderId}; // No URL, email or raw token in returned log data.
  } catch {
    if(job) {
      try{await outbox.markRetry(job.id,'DELIVERY_RETRY');}catch{}
    }
    return {state:'retry'}; // Never expose email / order / token in errors.
  }
}
