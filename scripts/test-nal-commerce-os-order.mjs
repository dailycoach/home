import assert from 'node:assert/strict';
import {quoteNalItem,noClientPriceOverride,planVerifiedSettlement,summarizeSafeOrders}
  from '../integration/nal-commerce-os/order-engine.mjs';
const AT=Date.parse('2026-10-10T01:00:00Z');
const TIME=new Date(AT+172800000).toISOString();
const CUT=new Date(AT+86400000).toISOString();
const base={kind:'pdf',id:'nal-ebook-001',title:'오늘의 마음을 살피는 질문',priceWon:3900,currency:'KRW',
  published:true,saleStatus:'available',policyApproved:true,termsApproved:true,version:'v1-approved',
  fileApproved:true,privateFileReady:true,licenseType:'personal-use'};
const session={id:'session-001',published:true,startsAt:TIME,registrationDeadline:CUT,capacity:10,reserved:9};
const reading={...base,kind:'reading_circle',id:'nal-read-001',priceWon:19000,session,hostApproved:true};
const workshop={...reading,kind:'class_session',id:'nal-class-001',priceWon:35000};
const context={at:AT,providerMinimumWon:100};
let checks=0;
function pass(name,item,expected){
 const q=quoteNalItem(item,context);
 assert.equal(q.ok,true,name+' '+JSON.stringify(q));
 assert.equal(q.quote.fulfillmentKind,expected);
 assert.equal(q.quote.unitAmountWon,item.priceWon);
 assert.equal(q.quote.quantity,1);
 assert.equal(q.quote.totalAmountWon,item.priceWon);
 assert.equal(q.quote.currency,'KRW');
 checks++;return q;
}
function reject(name,item,reason,options=context){
 assert.deepEqual(quoteNalItem(item,options),{ok:false,reason},name);checks++;
}
const pdf=pass('PDF direct',base,'private_pdf');
const circle=pass('reading seat',reading,'reading_pass');
const cls=pass('class seat',workshop,'class_pass');
assert.equal(circle.quote.requiresAtomicInventory,true);
assert.equal(cls.quote.licenseType,'single-participant');checks+=2;
assert.equal(noClientPriceOverride(pdf,{id:base.id}),true);
assert.equal(noClientPriceOverride(circle,{id:reading.id,sessionId:session.id}),true);
for(const obj of [{id:base.id,amountWon:1},{id:base.id,discount:99},{id:base.id,role:'owner'},
 {id:reading.id,sessionId:'someone-else'},{id:reading.id,quantity:2},{}]){
 assert.equal(noClientPriceOverride(obj.id===reading.id?circle:pdf,obj),false);checks++;
}
for(const [name,item,why,opts] of [
 ['unpublished',{...base,published:false},'NOT_FOR_SALE'],
 ['coming soon',{...base,saleStatus:'comingSoon'},'NOT_FOR_SALE'],
 ['policy pending',{...base,policyApproved:false},'NOT_FOR_SALE'],
 ['terms pending',{...base,termsApproved:false},'NOT_FOR_SALE'],
 ['zero price',{...base,priceWon:0},'PRICE_OR_TITLE_NOT_READY'],
 ['provider minimum',{...base,priceWon:100},'PRICE_OR_TITLE_NOT_READY',{at:AT,providerMinimumWon:1000}],
 ['client currency',{...base,currency:'USD'},'PRICE_OR_TITLE_NOT_READY'],
 ['fraction price',{...base,priceWon:33.5},'PRICE_OR_TITLE_NOT_READY'],
 ['title short',{...base,title:'a'},'PRICE_OR_TITLE_NOT_READY'],
 ['edition missing',{...base,version:null},'EDITION_NOT_APPROVED'],
 ['file unapproved',{...base,fileApproved:false},'PDF_NOT_READY'],
 ['private file absent',{...base,privateFileReady:false},'PDF_NOT_READY'],
 ['invalid license',{...base,licenseType:'organization-use'},'PDF_NOT_READY'],
 ['unknown kind',{...base,kind:'unregistered-kind'},'INVALID_ITEM'],
 ['invalid item ID',{...base,id:'../../'},'INVALID_ITEM'],
 ['past start',{...reading,session:{...session,startsAt:new Date(AT-86400000).toISOString()}},'SESSION_FULL_OR_NOT_READY'],
 ['past registration end',{...reading,session:{...session,registrationDeadline:new Date(AT-86400000).toISOString()}},'SESSION_FULL_OR_NOT_READY'],
 ['deadline after start',{...reading,session:{...session,registrationDeadline:new Date(AT+5*86400000).toISOString()}},'SESSION_FULL_OR_NOT_READY'],
 ['full seats',{...reading,session:{...session,reserved:10}},'SESSION_FULL_OR_NOT_READY'],
 ['over-reserved',{...reading,session:{...session,reserved:12}},'SESSION_FULL_OR_NOT_READY'],
 ['zero capacity',{...reading,session:{...session,capacity:0}},'SESSION_FULL_OR_NOT_READY'],
 ['unpublished session',{...reading,session:{...session,published:false}},'SESSION_FULL_OR_NOT_READY'],
 ['invalid session',{...reading,session:{...session,id:'../../'}},'SESSION_FULL_OR_NOT_READY'],
 ['host pending',{...reading,hostApproved:false},'HOST_REVIEW_REQUIRED']
])reject(name,item,why,opts||context);

const order={id:'synthetic-order',kind:'pdf',status:'pending',amountWon:3900,currency:'KRW',
 providerOrderId:'provider-synthetic-id',merchantId:'synthetic-merchant',paymentKey:null,
 revoked:false,fileApprovedAtOrder:true,inventoryReservationConfirmed:false};
const observation={authoritative:true,source:'provider-server-lookup',orderId:order.id,
 providerOrderId:order.providerOrderId,merchantId:order.merchantId,
 currency:'KRW',amountWon:3900,status:'DONE',paymentKey:'synthetic-pay-key'};
function settled(name,prior,payment,expected){assert.deepEqual(planVerifiedSettlement(prior,payment),expected,name);checks++;}
for(const [name,o,p,want] of [
 ['paid PDF',order,observation,{ok:true,nextStatus:'paid',effect:'issue_pdf',reason:'VERIFIED_DONE'}],
 ['paid reading',{...order,kind:'reading_circle',inventoryReservationConfirmed:true},observation,{ok:true,nextStatus:'paid',effect:'issue_reading_pass',reason:'VERIFIED_DONE'}],
 ['paid class',{...order,kind:'class_session',inventoryReservationConfirmed:true},observation,{ok:true,nextStatus:'paid',effect:'issue_class_pass',reason:'VERIFIED_DONE'}],
 ['seat not reserved',{...order,kind:'reading_circle'},observation,{ok:false,reason:'NO_ATOMIC_SEAT_RESERVATION'}],
 ['PDF not approved',{...order,fileApprovedAtOrder:false},observation,{ok:false,reason:'FILE_EDITION_NOT_READY'}],
 ['repeat paid',{...order,status:'paid',paymentKey:observation.paymentKey},observation,{ok:true,nextStatus:'paid',effect:'none',reason:'IDEMPOTENT'}],
 ['replay after refund',{...order,status:'refunded',revoked:true},observation,{ok:false,reason:'NO_REGRANT_AFTER_TERMINAL'}],
 ['replay after partial refund',{...order,status:'refund_requested',revoked:true},observation,{ok:false,reason:'NO_REGRANT_AFTER_TERMINAL'}],
 ['replay after cancelled',{...order,status:'cancelled'},observation,{ok:false,reason:'NO_REGRANT_AFTER_TERMINAL'}],
 ['replay after terminal review',{...order,status:'review_required'},observation,{ok:false,reason:'NO_REGRANT_AFTER_TERMINAL'}],
 ['replay after revocation',{...order,status:'paid',revoked:true},observation,{ok:false,reason:'NO_REGRANT_AFTER_TERMINAL'}],
 ['full refund',{...order,status:'paid'},{...observation,status:'CANCELED'},{ok:true,nextStatus:'refunded',effect:'revoke_entitlement_and_pass',reason:'VERIFIED_REFUND'}],
 ['partial refund',{...order,status:'paid'},{...observation,status:'PARTIAL_CANCELED'},{ok:true,nextStatus:'refund_requested',effect:'revoke_entitlement_and_pass',reason:'VERIFIED_REFUND'}],
 ['repeat refund',{...order,status:'refunded'},{...observation,status:'CANCELED'},{ok:true,nextStatus:'refunded',effect:'none',reason:'REPEAT_REFUND'}],
 ['expired pending',order,{...observation,status:'EXPIRED'},{ok:true,nextStatus:'cancelled',effect:'release_pending_reservation',reason:'PAYMENT_EXPIRED'}],
 ['aborted pending',order,{...observation,status:'ABORTED'},{ok:true,nextStatus:'cancelled',effect:'release_pending_reservation',reason:'PAYMENT_EXPIRED'}],
 ['late expired',{...order,status:'paid'},{...observation,status:'EXPIRED'},{ok:false,reason:'STALE_PAYMENT_EVENT'}],
 ['provider ready',order,{...observation,status:'READY'},{ok:true,nextStatus:'pending',effect:'none',reason:'PAYMENT_PENDING'}],
 ['in progress',order,{...observation,status:'IN_PROGRESS'},{ok:true,nextStatus:'pending',effect:'none',reason:'PAYMENT_PENDING'}],
 ['nonfinal after paid',{...order,status:'paid'},{...observation,status:'READY'},{ok:false,reason:'NONFINAL_AFTER_SETTLEMENT'}]
])settled(name,o,p,want);
for(const [name,wrong] of [
 ['forged merchant',{merchantId:'another'}],
 ['forged provider order',{providerOrderId:'different'}],
 ['forged local order',{orderId:'different'}],
 ['untrusted provider',{authoritative:false}],
 ['untrusted source',{source:'browser-redirect'}],
 ['wrong currency',{currency:'USD'}],
 ['wrong amount',{amountWon:900}],
 ['payment key mismatch',{paymentKey:'other'}],
 ['unknown provider status',{status:'ERROR'}]
]){
 const prior={...order,...(name==='payment key mismatch'?{paymentKey:'earlier'}:{})};
 settled(name,prior,{...observation,...wrong},{ok:false,reason:'PAYMENT_BINDING_REJECTED'});
}
settled('invalid order',{...order,status:'something'},observation,{ok:false,reason:'INVALID_ORDER'});
assert.deepEqual(summarizeSafeOrders([
 {kind:'pdf',status:'paid',amountWon:3900},
 {kind:'reading_circle',status:'paid',amountWon:19000},
 {kind:'class_session',status:'pending',amountWon:35000},
 {kind:'pdf',status:'refund_requested',amountWon:3900}
]),{ok:true,summary:{totalOrders:4,paidOrders:2,pendingOrders:1,refundReviews:1,
 paidGrossWon:22900,byKind:{pdf:1,reading_circle:1,class_session:0}}});checks++;
assert.equal(summarizeSafeOrders([{kind:'unknown',status:'paid',amountWon:50}]).ok,false);checks++;
console.log('NAL ORDER ENGINE PASS: '+checks+' pure pricing, seat gating, provider-binding, refunds and KPI cases; no DB or provider calls');
