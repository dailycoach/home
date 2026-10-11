/* NAL P7-E private pass confirmation. Source-only; customer release OFF.
 * No user enrollment is inferred from a landing page or from URL parameters.
 * One-time bearer fragment is wiped before any asynchronous request.
 */
(function(scope){
'use strict';
const ORDER=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BEARER=/^[A-Za-z0-9_-]{43}$/;
const ALLOWED_KINDS=new Set(['reading_pass','class_pass']);
const endpoint='/functions/v1/nal-commerce-pass';
const proofKey='nal-commerce-lite:tab-proof:v1';
const $=key=>scope.document?.querySelector(key);
const approved=g=>g?.schemaVersion===1&&g.module==='nal-commerce-pass'
 &&g.uiEnabled===true&&g.serverReady===true
 &&g.passClaimReviewed===true&&g.guestProofReviewed===true
 &&g.providerSettlementReviewed===true&&g.programSaleApproved===true
 &&g.programClaimPageApproved===true&&g.buyerPrivacyApproved===true
 &&g.productionApproved===true;
const resendApproved=g=>approved(g)&&g.resendEnabled===true
 &&g.resendRateLimitReviewed===true&&g.emailSenderConnected===true;
function wipeUrlFragment(){
 const text=scope.location?.hash||'';
 // Remove secret even if malformed. Do not put it in search, history or logs.
 if(text){
  try{scope.history.replaceState(null,'',scope.location.pathname+scope.location.search);}catch{}
 }
 try{
  const params=new URLSearchParams(text.replace(/^#/,''));
  const keys=[...params.keys()];
  if(keys.length!==2||keys.some(k=>!['order','token'].includes(k)))return null;
  const orderId=params.get('order'),token=params.get('token');
  if(!ORDER.test(orderId||'')||!BEARER.test(token||''))return null;
  return {orderId,receiptToken:token};
 }catch{return null;}
}
const claim=wipeUrlFragment();
function storedBuyerProof(){
 try{
  const p=JSON.parse(scope.sessionStorage?.getItem(proofKey)||'null');
  if(!ORDER.test(p?.orderId||'')||!BEARER.test(p?.claimToken||'')
    ||!Number.isSafeInteger(p.savedAt)
    ||Date.now()-p.savedAt>3600000||p.savedAt-Date.now()>60000)return null;
  return {orderId:p.orderId,claimToken:p.claimToken};
 }catch{return null;}
}
function status(msg,selector='#np-message',error=false){
 const el=$(selector);if(el){el.textContent=msg;el.dataset.error=error?'true':'false';}
}
function setTicket(label){const el=$('#np-ticket-status');if(el)el.textContent=label;}
const publicJson=async url=>{
 const result=await scope.fetch(url,{
  method:'GET',credentials:'omit',redirect:'error',cache:'no-store'
 });
 if(!result.ok)throw Error('NOT_AVAILABLE');
 return result.json();
};
function safeBackend(config){
 return !!config&&config.enabled===true
  &&typeof config.url==='string'
  &&/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(config.url)
  &&typeof config.publishableKey==='string'
  &&/^(sb_publishable_[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{16,})$/.test(config.publishableKey);
}
async function post(config,action,fields){
 if(!safeBackend(config))throw Error('SERVER_NOT_CONNECTED');
 const result=await scope.fetch(config.url+endpoint,{
  method:'POST',redirect:'error',cache:'no-store',credentials:'omit',
  headers:{apikey:config.publishableKey,'Content-Type':'application/json'},
  body:JSON.stringify({action,...fields}),
  signal:AbortSignal.timeout(12000)
 });
 const value=await result.json().catch(()=>null);
 if(!result.ok){
  if(result.status===429)throw Error('TOO_MANY');
  if(result.status===503)throw Error('SERVER_NOT_CONNECTED');
  throw Error('NOT_VERIFIED');
 }
 return value;
}
function validatePass(data){
 return data?.state==='confirmed'
  &&ALLOWED_KINDS.has(data.kind)
  &&typeof data.title==='string'&&data.title.length>=2&&data.title.length<=120
  &&typeof data.startsAt==='string'&&Number.isFinite(Date.parse(data.startsAt))
  &&Date.parse(data.startsAt)>Date.now()
  &&ORDER.test(data.orderId||'')
  &&ORDER.test(data.slotId||'');
}
const dateText=raw=>new Intl.DateTimeFormat('ko-KR',{
 dateStyle:'full',timeStyle:'short',timeZone:'Asia/Seoul'
}).format(new Date(raw));
function showPass(data){
 const root=$('#np-pass-details');if(!root)return;
 const targets={
  '#np-kind':data.kind==='reading_pass'?'독서모임':'클래스',
  '#np-title':data.title,
  '#np-starts':dateText(data.startsAt),
  '#np-state':'참가 확인 대기'
 };
 for(const [id,value] of Object.entries(targets)){
  const el=$(id);if(el)el.textContent=value;
 }
 root.hidden=false;setTicket('확인 대기');
}
async function boot(){
 if(!$('body')&&!scope.document?.body)return;
 let gate;
 try{gate=await publicJson('/nal/data/commerce-pass.release.json');}
 catch{status('참가권 연결 상태를 확인할 수 없습니다. 실제 참가 정보를 표시하지 않습니다.',undefined,true);return;}
 if(!approved(gate)){
  status('현재 참가권 확인 서비스는 준비 중입니다. 실제 결제·예약·이메일 재발송은 열려 있지 않습니다.');
  setTicket('연결 준비 중');return;
 }
 if(!claim){
  status('이용 가능한 참가권 확인 링크를 찾지 못했습니다. 구매 당시 안내받은 이메일 링크를 확인해 주세요.',undefined,true);
  setTicket('확인 링크 필요');
 }else{
  let config;
  try{config=await publicJson('/nal/data/backend.json');}catch{}
  if(!safeBackend(config)){
   status('참가권 서버가 아직 준비되지 않았습니다. 고객지원에 문의해 주세요.',undefined,true);
   return;
  }
  const verify=$('#np-verify'),confirm=$('#np-confirm');
  if(verify){
   verify.hidden=false;verify.disabled=false;
   verify.addEventListener('click',async()=>{
    verify.disabled=true;status('구매 및 참가권 상태를 확인하고 있습니다.');
    try{
     const result=await post(config,'verify',claim);
     if(!validatePass(result)||result.orderId!==claim.orderId)
      throw Error('NOT_VERIFIED');
     showPass(result);verify.hidden=true;
     if(confirm){confirm.hidden=false;confirm.disabled=false;}
     status('본인의 참가권입니다. 아래에서 확인을 완료해 주세요.');
    }catch{
     status('참가권 확인에 실패했습니다. 링크가 만료되었거나 이미 사용됐을 수 있습니다.',undefined,true);
     setTicket('확인 불가');verify.hidden=true;
    }
   },{once:true});
  }
  if(confirm)confirm.addEventListener('click',async()=>{
   confirm.disabled=true;status('참가권의 확인 완료를 기록하고 있습니다.');
   try{
    const result=await post(config,'confirm',claim);
    if(result?.state!=='confirmed')throw Error('NOT_VERIFIED');
    const state=$('#np-state');if(state)state.textContent='확인 완료';
    status('참가권 확인이 완료되었습니다. 동일 링크를 다시 사용할 수 없습니다.');
    setTicket('확인 완료');confirm.hidden=true;
   }catch{
    status('이 참가권 확인을 완료하지 못했습니다. 문의 시 주문 정보를 준비해 주세요.',undefined,true);
    setTicket('확인 필요');
   }
  },{once:true});
 }
 if(resendApproved(gate)){
  const proof=storedBuyerProof(),button=$('#np-resend');
  if(!proof||!button)return;
  let config;
  try{config=await publicJson('/nal/data/backend.json');}catch{}
  if(!safeBackend(config))return;
  button.disabled=false;button.textContent='구매 이메일로 안내 재발송 요청';
  button.addEventListener('click',async()=>{
   button.disabled=true;
   try{
    await post(config,'resend',{...proof,requestId:scope.crypto.randomUUID()});
    status('요청이 접수되었습니다. 발송 조건을 만족하는 주문이라면 기존 구매 이메일로 안내됩니다.','#np-resend-status');
   }catch{
    status('재발송 요청을 접수하지 못했습니다. 잠시 후 다시 확인해 주세요.','#np-resend-status',true);
   }
  },{once:true});
 }
}
scope.NALPassPage=Object.freeze({approved,resendApproved,validatePass});
if(scope.document){
 if(scope.document.readyState==='loading'){
  scope.document.addEventListener('DOMContentLoaded',()=>{void boot();},{once:true});
 }else void boot();
}
})(globalThis);
