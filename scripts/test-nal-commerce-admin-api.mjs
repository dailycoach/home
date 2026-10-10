import assert from 'node:assert/strict';
import {createCommerceAdminHandler,DEFAULT_ADMIN_RELEASE,ADMIN_ACTIONS}
  from '../integration/nal-commerce-os/admin-handler.mjs';

const NOW=Date.parse('2026-10-10T12:00:00Z');
const UID='11111111-1111-4111-8111-111111111111';
const ORDER='22222222-2222-4222-8222-222222222222';
const ORIGIN='https://daily-coach-ing.com';
const TOKEN='eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiIxIn0.signature';
const fullRelease={
 enabled:true,ownerAuthReviewed:true,serverGateConfigured:true,
 privacyNoticeApproved:true,writePermissionsReviewed:true,
 deployed:true,productionApproved:true
};
const actor=(fields={})=>({
 id:UID,userRecordId:UID,role:'authenticated',
 verifiedByAuthServer:true,adminAccountRechecked:true,isAnonymous:false,
 deleted:false,banned:false,emailConfirmedAt:new Date(NOW-60000).toISOString(),
 verifiedAt:new Date(NOW).toISOString(),user_metadata:{role:'owner'},...fields
});
let checks=0;
const defaultRequest=(action,payload={},options={})=>new Request('https://abcdefghijklmnopqrst.supabase.co/functions/v1/nal-commerce-admin',{
 method:options.method||'POST',
 headers:{Origin:options.origin??ORIGIN,Authorization:options.auth??'Bearer '+TOKEN,
   'Content-Type':options.contentType??'application/json'},
 ...(options.method==='GET'||options.method==='OPTIONS'?{}:{body:options.raw??JSON.stringify({action,payload})})
});
const rows={
 'overview':{totalOrders:3,paidOrders:1,pendingOrders:1,refundReviews:1,grossWon:4900,activePrograms:0,
  serverSecret:'must-not-leak'},
 'catalog-list':{items:[{id:'pdf-draft-1',title:'나의 작은 책',kind:'pdf',priceWon:5900,saleStatus:'draft',
   revision:0,version:'draft',secret:'private-bucket'}],total:1,offset:0},
 'orders-list':{items:[{id:ORDER,createdAt:'2026-10-10T10:00:00Z',productTitle:'샘플',
   kind:'pdf',amountWon:4900,state:'paid',fulfillmentState:'issued',
   email:'real-looking@example.invalid',secret:'billing'}],total:1,offset:0},
 'order-detail':{id:ORDER,productTitle:'샘플',kind:'pdf',amountWon:4900,state:'paid',paidAt:null,
   fulfillmentState:'issued',createdAt:'2026-10-10T10:00:00Z',email:'person@example.invalid',
   cardNumber:'should-not-return'},
 'program-list':{items:[],total:0,offset:0},
 'bookings-list':{items:[],total:0,offset:0},
 'delivery-list':{items:[],total:0,offset:0}
};
function fixture(overrides={}){
 const called=[];
 const handler=createCommerceAdminHandler({
  release:fullRelease,now:()=>NOW,
  authenticate:async(token)=>{called.push('auth');return actor();},
  isExistingOwner:async id=>{called.push('owner:'+id);return true;},
  rateLimit:async()=>{called.push('rate');return true;},
  read:async(action,payload,id)=>{called.push('read:'+action);
    assert.equal(id,UID);
    return rows[action];
  },
  writeDraft:async(action,payload,id)=>{
    called.push('write:'+action);
    assert.equal(id,UID);
    assert.equal(payload.published,false);assert.equal(payload.saleStatus,'draft');
    return {id:payload.id,revision:payload.expectedRevision+1,
      saleStatus:'draft',published:false,editorSecret:'internal-only'};
  },
  ...overrides
 });
 return {handler,called};
}
async function expect(handler,action,payload,status,error,options={}){
 const r=await handler(defaultRequest(action,payload,options));
 assert.equal(r.status,status,action+' '+JSON.stringify(await r.clone().json()));
 const b=await r.json();
 if(error)assert.equal(b.error,error);
 assert.equal(r.headers.get('Cache-Control'),'no-store');
 checks++;return b;
}
{
 const f=fixture({release:DEFAULT_ADMIN_RELEASE});
 await expect(f.handler,'overview',{},503,'ADMIN_NOT_RELEASED');
 assert.deepEqual(f.called,[],'no Auth/DB call when admin disabled');
}
for(const key of Object.keys(fullRelease)){
 const f=fixture({release:{...fullRelease,[key]:false}});
 await expect(f.handler,'overview',{},503,'ADMIN_NOT_RELEASED');
 assert.deepEqual(f.called,[]);
}
{
 const f=fixture();
 await expect(f.handler,'overview',{},403,'ORIGIN_DENIED',{origin:'https://evil.invalid'});
 await expect(f.handler,'overview',{},405,'POST_REQUIRED',{method:'GET'});
 await expect(f.handler,'overview',{},401,'LOGIN_REQUIRED',{auth:'Bearer garbage'});
 await expect(f.handler,'overview',{},415,'JSON_REQUIRED',{contentType:'text/plain'});
}
for(const actorOverride of [
 {id:'../../'}, {role:'owner'}, {verifiedByAuthServer:false},
 {adminAccountRechecked:false},{userRecordId:ORDER},
 {isAnonymous:true},{deleted:true},{banned:true},
 {emailConfirmedAt:null},{emailConfirmedAt:new Date(NOW+100000).toISOString()},
 {verifiedAt:new Date(NOW-60000).toISOString()},
 {verifiedAt:new Date(NOW+60000).toISOString()}
]){
 const f=fixture({authenticate:async()=>actor(actorOverride)});
 await expect(f.handler,'overview',{},401,'IDENTITY_NOT_VERIFIED');
}
{
 const f=fixture({authenticate:async()=>{throw Error('invalid JWT');}});
 await expect(f.handler,'overview',{},401,'INVALID_SESSION');
}
{
 const f=fixture({isExistingOwner:async()=>false});
 await expect(f.handler,'overview',{},403,'OWNER_REQUIRED');
}
{
 const f=fixture({isExistingOwner:async()=>{throw Error('DB down');}});
 await expect(f.handler,'overview',{},503,'OWNER_LOOKUP_UNAVAILABLE');
}
{
 const f=fixture({rateLimit:async()=>false});
 await expect(f.handler,'overview',{},429,'RATE_LIMITED');
}
for(const releaseMissing of [
 {authenticate:null},{isExistingOwner:null},{read:null},
 {writeDraft:null},{rateLimit:null}
]){
 const f=fixture(releaseMissing);
 await expect(f.handler,'overview',{},503,'ADMIN_SERVER_UNAVAILABLE');
}
for(const [action,payload] of [
 ['approve-payment',{}],['execute-refund',{}],['refund-approve',{}],
 ['grant-owner',{id:UID}],['publish-live',{}],['sign-download',{}],
 ['set-price-live',{}],['account-create',{}],
 ['order-detail',{orderId:'bad'}],
 ['catalog-list',{offset:0,kind:'bad'}],
 ['orders-list',{state:'paid',offset:-1}],
 ['catalog-draft-save',{id:'pdf1',title:'X'}],
 ['catalog-draft-save',{id:'draft-1',title:'신규',description:'',kind:'pdf',
    priceWon:10,expectedRevision:0,published:true}],
 ['session-draft-save',{id:'session-1',title:'독서모임',kind:'reading_circle',
    startsAt:new Date(NOW-1000).toISOString(),capacity:10,expectedRevision:0}]
]){
 const f=fixture();
 const msg=['approve-payment','execute-refund','refund-approve','grant-owner','publish-live',
   'sign-download','set-price-live','account-create'].includes(action)?'ACTION_NOT_ALLOWED':'INVALID_SCOPE';
 await expect(f.handler,action,payload,400,msg);
 assert(!f.called.some(x=>x.startsWith('write:')),'invalid action must not write');
}
{
 const f=fixture();
 const result=await expect(f.handler,'overview',{},200);
 assert.deepEqual(result.data,{totalOrders:3,paidOrders:1,pendingOrders:1,refundReviews:1,
  grossWon:4900,activePrograms:0});
 assert(!JSON.stringify(result).includes('serverSecret'));
}
{
 const f=fixture();
 const result=await expect(f.handler,'catalog-list',{kind:'all',offset:0},200);
 assert.equal(result.data.items.length,1);
 assert(!JSON.stringify(result).includes('private-bucket'));
}
{
 const f=fixture();
 const result=await expect(f.handler,'orders-list',{state:'all',offset:0},200);
 assert.equal(result.data.items[0].contactMasked,'r***@example.invalid');
 assert(!JSON.stringify(result).includes('real-looking@example.invalid'));
}
{
 const f=fixture();
 const result=await expect(f.handler,'order-detail',{orderId:ORDER},200);
 assert.equal(result.data.contactMasked,'p***@example.invalid');
 assert(!JSON.stringify(result).includes('cardNumber'));
}
{
 const f=fixture();
 const result=await expect(f.handler,'catalog-draft-save',{
  id:'new-ebook',title:'새 PDF 도서',description:'짧은 소개',
  kind:'pdf',priceWon:5900,expectedRevision:0
 },200);
 assert.deepEqual(result.data,{id:'new-ebook',revision:1,saleStatus:'draft',published:false});
}
{
 const f=fixture();
 const result=await expect(f.handler,'session-draft-save',{
  id:'session-1',title:'비공개 독서모임',kind:'reading_circle',
  startsAt:'2099-12-01T12:00:00Z',capacity:12,expectedRevision:1
 },200);
 assert.deepEqual(result.data,{id:'session-1',revision:2,saleStatus:'draft',published:false});
}
{
 const f=fixture({writeDraft:async()=>{const e=Error('revision changed');e.code='CONFLICT_REVISION';throw e;}});
 await expect(f.handler,'catalog-draft-save',{
  id:'new-ebook',title:'새 PDF 도서',description:'',kind:'pdf',priceWon:1000,expectedRevision:0
 },409,'REVISION_CHANGED');
}
{
 const f=fixture({read:async()=>({items:[{email:'sensitive@example.invalid'}],total:1,offset:0})});
 const x=await expect(f.handler,'orders-list',{state:'all',offset:0},200);
 assert(!JSON.stringify(x).includes('sensitive@example.invalid'));
}
{
 const f=fixture({read:async()=>{throw Error('secret-DB');}});
 const result=await expect(f.handler,'overview',{},503,'ADMIN_DATA_UNAVAILABLE');
 assert(!JSON.stringify(result).includes('secret-DB'));
}
{
 let members=0;
 const f=fixture({isExistingOwner:async()=>{members++;return members===1;}});
 await expect(f.handler,'overview',{},200);
 await expect(f.handler,'overview',{},403,'OWNER_REQUIRED');
 assert.equal(members,2,'Owner permission must be rechecked each request');
}
console.log('NAL COMMERCE ADMIN server contract PASS: '+checks+' authorization, projection, drafts, 403/409 and malicious-command cases, no real DB');
