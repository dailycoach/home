/**
 * NAL P4-B review-only owner authorization CONTRACT.
 *
 * Not a deployed Edge Function, not a replacement for the previously blocked
 * shared Auth patch. No secrets, database calls, Auth calls or network access.
 * verifyAuthenticatedUser() and isCurrentOwner() are trusted server-only
 * dependencies supplied by a separately approved implementation.
 *
 * NEVER call this module with "verified user" data received from a client.
 * The only source for authenticatedUser must be fresh Supabase Auth results.
 */

export const REVIEW_RPC = 'nal_read_privacy_admin';
export const SAFE_ACTIONS = Object.freeze(['queue','preview','start-review']);
export const DEFAULT_RELEASE = Object.freeze({
  enabled: false,
  ownerAuthReviewed: false,
  privacyNoticeApproved: false,
  backendApproved: false,
  destructiveApiExposed: false
});
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MAX_BODY_BYTES = 3000;
const MAX_BEARER_BYTES = 8192;
const deny = (status,code) => Object.freeze({ok:false,status,code});

function exactKeys(obj,keys) {
  return obj !== null && typeof obj === 'object' && !Array.isArray(obj)
    && Object.keys(obj).length === keys.length
    && keys.every(k => Object.hasOwn(obj,k));
}
function allowedRelease(x) {
  // Reject unreviewed or misspelled server flags instead of treating them as harmless.
  return exactKeys(x,Object.keys(DEFAULT_RELEASE)) && x.enabled === true && x.ownerAuthReviewed === true
    && x.privacyNoticeApproved === true && x.backendApproved === true
    && x.destructiveApiExposed === false;
}
function validIdentity(user,now) {
  if (!user || typeof user !== 'object' || Array.isArray(user)) return false;
  if (!UUID_V4.test(user.id || '') || user.authenticated !== true
      || user.role !== 'authenticated' || user.isAnonymous !== false
      || user.deleted === true || user.banned === true
      || user.verifiedByAuthServer !== true || user.adminAccountRechecked !== true
      || user.userRecordId !== user.id) return false;
  if(typeof user.emailConfirmedAt !== 'string' || typeof user.verifiedAt !== 'string') return false;
  const confirmed = Date.parse(user.emailConfirmedAt);
  const verified = Date.parse(user.verifiedAt);
  return Number.isFinite(confirmed) && confirmed <= now
    && Number.isFinite(verified) && verified >= now - 30000
    && verified <= now + 5000;
}
function parsedInput(body) {
  if (typeof body !== 'string' || Buffer.byteLength(body,'utf8') > MAX_BODY_BYTES) return null;
  let data;
  try { data=JSON.parse(body); } catch { return null; }
  if (!exactKeys(data,['action','payload']) || !SAFE_ACTIONS.includes(data.action)) return null;
  const payload=data.payload;
  if (data.action==='queue' && exactKeys(payload,[])) return {action:data.action,payload:{}};
  if (data.action==='preview' && exactKeys(payload,['requestId'])
    && UUID_V4.test(payload.requestId||'')) return {action:data.action,payload:{requestId:payload.requestId.toLowerCase()}};
  if (data.action==='start-review' && exactKeys(payload,['requestId','confirmed'])
    && UUID_V4.test(payload.requestId||'') && payload.confirmed === true)
    return {action:data.action,payload:{requestId:payload.requestId.toLowerCase(),confirmed:true}};
  return null;
}

/**
 * Produce an internal request binding, not an RPC call or HTTP response.
 * Header values and request.body are untrusted. The identity and membership
 * callbacks MUST be server-only, fresh, and independently security reviewed.
 */
export async function prepareOwnerReviewBinding({
  method, origin, contentType, authorization, body
}, {
  release = DEFAULT_RELEASE,
  allowedOrigin = 'https://daily-coach-ing.com',
  verifyAuthenticatedUser,
  isCurrentOwner,
  now = Date.now
} = {}) {
  if (!allowedRelease(release)) return deny(503,'REVIEW_NOT_RELEASED');
  if (method !== 'POST') return deny(405,'METHOD_NOT_ALLOWED');
  // Origin is a hardening condition, never authentication.
  if (typeof origin !== 'string' || origin !== allowedOrigin) return deny(403,'ORIGIN_BLOCKED');
  if (typeof contentType !== 'string' || contentType.split(';')[0].trim().toLowerCase() !== 'application/json')
    return deny(415,'JSON_REQUIRED');
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer '))
    return deny(401,'LOGIN_REQUIRED');
  const token=authorization.slice(7);
  if (!JWT_SHAPE.test(token) || Buffer.byteLength(token,'utf8') > MAX_BEARER_BYTES)
    return deny(401,'INVALID_USER_TOKEN');
  const parsed=parsedInput(body);
  if(!parsed)return deny(400,'INVALID_REVIEW_REQUEST');
  if(typeof verifyAuthenticatedUser!=='function'||typeof isCurrentOwner!=='function'||typeof now!=='function')
    return deny(503,'OWNER_SERVER_NOT_CONFIGURED');

  let actor;
  try { actor=await verifyAuthenticatedUser(token); }
  catch { return deny(401,'AUTH_VERIFICATION_FAILED'); }
  const time=now();
  if (!Number.isFinite(time) || !validIdentity(actor,time)) return deny(401,'USER_NOT_ELIGIBLE');

  let owner=false;
  try { owner=await isCurrentOwner(actor.id); }
  catch { return deny(503,'OWNER_MEMBERSHIP_UNAVAILABLE'); }
  if(owner!==true) return deny(403,'OWNER_REQUIRED');

  // Client supplied role, p_user_id and p_owner_id are never accepted above.
  // The server MUST make its own fresh verified-header context for PostgREST.
  // Do not send this internal binding to the caller.
  return Object.freeze({
    ok:true,
    internalOnly:true,
    rpcName:REVIEW_RPC,
    rpcArgs:Object.freeze({
      p_owner_id:actor.id.toLowerCase(),
      p_action:parsed.action,
      p_payload:Object.freeze(parsed.payload)
    })
  });
}
