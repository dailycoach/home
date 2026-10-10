/**
 * NAL COMMERCE ADMIN · default-OFF independent owner HTTP contract.
 * Source-only; never deployed or connected to a privileged auth helper.
 * Inject independently reviewed per-request Supabase Auth & private membership
 * verification. Browser/local metadata is NEVER an owner permission source.
 */
export const ADMIN_ACTIONS=Object.freeze([
  'overview','catalog-list','program-list','orders-list','bookings-list',
  'delivery-list','order-detail','catalog-draft-save','session-draft-save'
]);
export const DEFAULT_ADMIN_RELEASE=Object.freeze({
  enabled:false,ownerAuthReviewed:false,serverGateConfigured:false,
  privacyNoticeApproved:false,writePermissionsReviewed:false,
  deployed:false,productionApproved:false
});
const ID=/^[a-z0-9-]{1,120}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const B64_TOKEN=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const KINDS=new Set(['pdf','reading_circle','class_session']);
const STATES=new Set(['pending','paid','refund_requested','refunded','cancelled','review_required']);
const MAX_SIZE=8192;
const columns=(x,keys)=>Object.fromEntries(keys.map(key=>[key,x?.[key]??null]));
const validPage=n=>Number.isSafeInteger(n)&&n>=0&&n<=10000;
const validAmount=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
const keysEqual=(x,names)=>!!x&&typeof x==='object'&&!Array.isArray(x)
  &&Object.keys(x).length===names.length&&names.every(k=>Object.hasOwn(x,k));
const okRelease=x=>x?.enabled===true&&x.ownerAuthReviewed===true
  &&x.serverGateConfigured===true&&x.privacyNoticeApproved===true
  &&x.writePermissionsReviewed===true&&x.deployed===true&&x.productionApproved===true;
const errorReply=(status,code,origin='',allowed=false)=>new Response(
  JSON.stringify({error:code}),{status,headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store','Pragma':'no-cache','Vary':'Origin',
    'X-Content-Type-Options':'nosniff',
    ...(allowed&&origin?{'Access-Control-Allow-Origin':origin}:{})
  }}
);
const reply=(data,origin)=>new Response(JSON.stringify(data),{status:200,headers:{
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store','Pragma':'no-cache','Vary':'Origin',
  'X-Content-Type-Options':'nosniff',
  ...(origin?{'Access-Control-Allow-Origin':origin}:{})
}});
const maskEmail=value=>{
  if(typeof value!=='string'||value.length>254||!value.includes('@'))return null;
  const [name,host,...rest]=value.toLowerCase().split('@');
  if(rest.length||!name||!host)return null;
  return name[0]+'***@'+host;
};
const finiteTime=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
function eligible(actor,now){
  if(!actor||typeof actor!=='object'||!UUID.test(actor.id||'')
    ||actor.role!=='authenticated'||actor.verifiedByAuthServer!==true
    ||actor.adminAccountRechecked!==true||actor.isAnonymous!==false
    ||actor.deleted===true||actor.banned===true
    ||actor.userRecordId!==actor.id||!finiteTime(actor.emailConfirmedAt)
    ||Date.parse(actor.emailConfirmedAt)>now||!finiteTime(actor.verifiedAt))
    return false;
  const verified=Date.parse(actor.verifiedAt);
  return verified>=now-30000&&verified<=now+5000;
}
const readPayload=(action,p)=>{
  if(action==='overview')return keysEqual(p,[])?{}:null;
  if(action==='order-detail')return keysEqual(p,['orderId'])&&UUID.test(p.orderId)?{orderId:p.orderId}:null;
  if(action==='catalog-list'||action==='program-list'||action==='bookings-list'){
    return keysEqual(p,['kind','offset'])
      &&(p.kind==='all'||KINDS.has(p.kind))&&validPage(p.offset)?{kind:p.kind,offset:p.offset}:null;
  }
  if(action==='orders-list'){
    return keysEqual(p,['state','offset'])&&(p.state==='all'||STATES.has(p.state))
      &&validPage(p.offset)?{state:p.state,offset:p.offset}:null;
  }
  if(action==='delivery-list')return keysEqual(p,['offset'])&&validPage(p.offset)?{offset:p.offset}:null;
  return null;
};
const draftPayload=(action,p)=>{
  if(action==='catalog-draft-save'){
    if(!keysEqual(p,['id','title','description','kind','priceWon','expectedRevision'])
      ||!ID.test(p.id||'')||typeof p.title!=='string'||p.title.trim().length<2||p.title.length>120
      ||typeof p.description!=='string'||p.description.length>1200
      ||!KINDS.has(p.kind)||!validAmount(p.priceWon)
      ||!validPage(p.expectedRevision))return null;
    return {...p,title:p.title.trim(),description:p.description.trim(),
      published:false,saleStatus:'draft'}; // never accept direct publication or approval
  }
  if(action==='session-draft-save'){
    if(!keysEqual(p,['id','title','kind','startsAt','capacity','expectedRevision'])
      ||!ID.test(p.id||'')||!['reading_circle','class_session'].includes(p.kind)
      ||typeof p.title!=='string'||p.title.trim().length<2||p.title.length>120
      ||!finiteTime(p.startsAt)||Date.parse(p.startsAt)<=Date.now()
      ||!Number.isSafeInteger(p.capacity)||p.capacity<1||p.capacity>1000
      ||!validPage(p.expectedRevision))return null;
    return {...p,title:p.title.trim(),published:false,saleStatus:'draft'};
  }
  return null;
};
const integer=x=>Number.isSafeInteger(x)&&x>=0;
function sanitized(action,value){
  if(action==='overview'){
    const fields=['totalOrders','paidOrders','pendingOrders','refundReviews','grossWon','activePrograms'];
    if(!value||!fields.every(k=>integer(value[k])))throw Error('Invalid owner overview projection');
    return columns(value,fields);
  }
  if(action==='order-detail'){
    if(!value||!UUID.test(value.id||'')||!STATES.has(value.state)
      ||!validAmount(value.amountWon))throw Error('Invalid owner order');
    return {...columns(value,['id','productTitle','kind','amountWon','state','paidAt','fulfillmentState','createdAt']),
      contactMasked:maskEmail(value.email)};
  }
  if(action==='catalog-draft-save'||action==='session-draft-save'){
    if(!value||!ID.test(value.id||'')||value.published!==false
      ||value.saleStatus!=='draft'||!integer(value.revision))throw Error('Unsafe admin draft write');
    return columns(value,['id','revision','saleStatus','published']);
  }
  const fields={
    'catalog-list':['id','title','kind','priceWon','saleStatus','revision','version'],
    'program-list':['id','title','kind','startsAt','capacity','reserved','saleStatus','revision'],
    'orders-list':['id','createdAt','productTitle','kind','amountWon','state','fulfillmentState'],
    'bookings-list':['id','title','kind','startsAt','capacity','reserved'],
    'delivery-list':['orderId','productTitle','status','attempts','updatedAt']
  }[action];
  if(!fields||!value||!Array.isArray(value.items)||value.items.length>50
    ||!integer(value.total)||!validPage(value.offset))throw Error('Invalid list result');
  const items=value.items.map(record=>{
    if(!record||typeof record!=='object')throw Error('Invalid projected record');
    const item=columns(record,fields);
    if(action==='orders-list')item.contactMasked=maskEmail(record.email);
    return item;
  });
  return {items,total:value.total,offset:value.offset};
}
export function createCommerceAdminHandler({
  release=DEFAULT_ADMIN_RELEASE,
  origins=['https://daily-coach-ing.com'],
  authenticate,
  isExistingOwner,
  read,
  writeDraft,
  rateLimit,
  now=Date.now
}={}) {
  return async request=>{
    const origin=request.headers.get('Origin')||'';
    if(!origin||!origins.includes(origin))return errorReply(403,'ORIGIN_DENIED');
    if(request.method==='OPTIONS')
      return new Response(null,{status:204,headers:{
        'Cache-Control':'no-store','Vary':'Origin',
        'Access-Control-Allow-Origin':origin,
        'Access-Control-Allow-Methods':'POST, OPTIONS',
        'Access-Control-Allow-Headers':'authorization, content-type, apikey'
      }});
    if(request.method!=='POST')return errorReply(405,'POST_REQUIRED',origin,true);
    if(!okRelease(release))return errorReply(503,'ADMIN_NOT_RELEASED',origin,true);
    if(typeof authenticate!=='function'||typeof isExistingOwner!=='function'
      ||typeof read!=='function'||typeof writeDraft!=='function'||typeof rateLimit!=='function')
      return errorReply(503,'ADMIN_SERVER_UNAVAILABLE',origin,true);
    const token=request.headers.get('Authorization')?.match(/^Bearer ([^\s]{1,8192})$/)?.[1];
    if(!token||!B64_TOKEN.test(token))return errorReply(401,'LOGIN_REQUIRED',origin,true);
    if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))
      return errorReply(415,'JSON_REQUIRED',origin,true);
    let who;
    try{who=await authenticate(token);}catch{return errorReply(401,'INVALID_SESSION',origin,true);}
    if(!eligible(who,now()))return errorReply(401,'IDENTITY_NOT_VERIFIED',origin,true);
    try{
      if(await isExistingOwner(who.id)!==true)return errorReply(403,'OWNER_REQUIRED',origin,true);
    }catch{return errorReply(503,'OWNER_LOOKUP_UNAVAILABLE',origin,true);}
    let raw;
    try{raw=await request.text();}catch{return errorReply(400,'INVALID_BODY',origin,true);}
    if(new TextEncoder().encode(raw).byteLength>MAX_SIZE)return errorReply(413,'BODY_TOO_LARGE',origin,true);
    let body;
    try{body=JSON.parse(raw);}catch{return errorReply(400,'INVALID_JSON',origin,true);}
    if(!keysEqual(body,['action','payload'])||!ADMIN_ACTIONS.includes(body.action))
      return errorReply(400,'ACTION_NOT_ALLOWED',origin,true);
    const isWrite=body.action.endsWith('-draft-save');
    const input=isWrite?draftPayload(body.action,body.payload):readPayload(body.action,body.payload);
    if(!input)return errorReply(400,'INVALID_SCOPE',origin,true);
    try{
      if(await rateLimit({actorId:who.id,action:body.action,origin})!==true)
        return errorReply(429,'RATE_LIMITED',origin,true);
      const output=isWrite?await writeDraft(body.action,input,who.id):
        await read(body.action,input,who.id);
      return reply({data:sanitized(body.action,output)},origin);
    }catch(e){
      if(e?.code==='CONFLICT_REVISION')return errorReply(409,'REVISION_CHANGED',origin,true);
      if(e?.code==='NOT_AUTHORIZED')return errorReply(403,'OWNER_REQUIRED',origin,true);
      return errorReply(503,'ADMIN_DATA_UNAVAILABLE',origin,true);
    }
  };
}
