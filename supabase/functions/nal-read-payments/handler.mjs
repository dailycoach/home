const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS=new Set(['create','get','list','launch','confirm','confirm-recover','refresh','refund-request','refund-withdraw','admin-list','admin-refresh','refund-approve','refund-reject','refund-execute']);
export async function readBoundedJson(req,max=32768){
 const reader=req.body?.getReader();if(!reader)throw new Error('body');let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw new Error('large');}chunks.push(value);}}finally{reader.releaseLock();}
 const out=new Uint8Array(size);let at=0;for(const c of chunks){out.set(c,at);at+=c.length;}return JSON.parse(new TextDecoder().decode(out));
}
export function createReadPaymentsHandler({enabled,checkoutEnabled,refundsEnabled,clientKey,mode,merchantId,origins,authenticate,user,admin,process}){
 return async req=>{
  const origin=req.headers.get('origin')||'';
  const reply=(status,body)=>new Response(status===204?null:JSON.stringify(body),{status,headers:{
   ...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{}),'Vary':'Origin','Cache-Control':'no-store',
   'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'}});
  if(origin&&!origins.includes(origin))return reply(403,{error:'허용되지 않은 요청입니다.'});
  if(req.method==='OPTIONS')return reply(204,null);
  if(req.method==='GET')return reply(200,{enabled,checkoutEnabled:enabled&&checkoutEnabled,mode,methods:['CARD']});
  if(req.method!=='POST')return reply(405,{error:'POST 요청이 필요합니다.'});
  if(!enabled)return reply(503,{error:'READ 결제 연결을 준비하고 있습니다.'});
  const bearer=req.headers.get('authorization')||'';
  if(!bearer.startsWith('Bearer ')||!bearer.slice(7))return reply(401,{error:'로그인이 필요합니다.'});
  let who;try{who=await authenticate(bearer.slice(7));}catch{return reply(401,{error:'로그인을 다시 확인해 주세요.'});}
  let b;try{b=await readBoundedJson(req);}catch(e){return reply(e.message==='large'?413:400,{error:'입력 내용을 확인해 주세요.'});}
  if(!b||typeof b!=='object'||!ACTIONS.has(b.action)||!b.payload||typeof b.payload!=='object'||Array.isArray(b.payload))return reply(400,{error:'입력 내용을 확인해 주세요.'});
  const p=b.payload,action=b.action;
  if(!['create','list','admin-list'].includes(action)&&!UUID.test(p.orderId||''))return reply(400,{error:'주문을 확인해 주세요.'});
  if(['create','refund-request'].includes(action)&&!UUID.test(p.requestId||''))return reply(400,{error:'요청 번호를 확인해 주세요.'});
  if(['refund-withdraw','refund-approve','refund-reject','refund-execute'].includes(action)&&!UUID.test(p.refundId||''))return reply(400,{error:'환불 요청을 확인해 주세요.'});
  if(['refund-approve','refund-reject','refund-execute'].includes(action)&&(!Number.isInteger(p.revision)||p.revision<1))return reply(400,{error:'최신 환불 요청을 다시 열어주세요.'});
  if(['list','admin-list'].includes(action)&&p.offset!==undefined&&(!Number.isInteger(p.offset)||p.offset<0||p.offset>10000))return reply(400,{error:'페이지를 확인해 주세요.'});
  if(['create','launch','confirm','confirm-recover'].includes(action)&&!checkoutEnabled)return reply(503,{error:'새 결제는 아직 열리지 않았습니다. 결제 내역은 MY NAL에서 확인할 수 있습니다.'});
  if(action==='refund-execute'&&!refundsEnabled)return reply(503,{error:'실제 환불 실행은 비활성 상태입니다. 요청과 검토 내용은 보관됩니다.'});
  try{
   if(action==='create'){
    if(!/^[a-z0-9-]{1,120}$/.test(p.seasonSlug||'')||!Number.isInteger(p.expectedAmount)||p.accepted!==true||typeof p.policyVersion!=='string')return reply(400,{error:'가격과 참여 안내를 확인해 주세요.'});
    return reply(200,await user(who.id,'create',{requestId:p.requestId,seasonSlug:p.seasonSlug,expectedAmount:p.expectedAmount,accepted:true,policyVersion:p.policyVersion,mode,merchantId}));
   }
   if(action==='launch'){
    if(!origins.includes(origin)||!origin.startsWith('https://'))return reply(403,{error:'결제할 사이트 주소를 확인해 주세요.'});
    const q=await user(who.id,'launch',{orderId:p.orderId});if(q.mode!==mode)return reply(409,{error:'결제 환경이 변경됐습니다. 운영자에게 확인해 주세요.'});
    return reply(200,{order:q,clientKey,customerKey:q.customerKey,payment:{method:'CARD',amount:{currency:'KRW',value:q.amount},
     orderId:q.providerOrderId,orderName:q.title,successUrl:origin+'/nal/read/checkout/success/?order='+q.orderId,
     failUrl:origin+'/nal/read/checkout/fail/?order='+q.orderId}});
   }
   if(action==='confirm'||action==='confirm-recover'){
    if(action==='confirm'){
     if(typeof p.paymentKey!=='string'||!p.paymentKey||p.paymentKey.length>200||!/^nr_[a-f0-9]{32}$/.test(p.providerOrderId||'')||!Number.isInteger(p.amount))return reply(400,{error:'결제 인증 결과를 확인해 주세요.'});
     await user(who.id,'queue-confirm',{orderId:p.orderId,paymentKey:p.paymentKey,providerOrderId:p.providerOrderId,amount:p.amount});
    }else{
     if(p.accepted!==true||!Number.isInteger(p.amount))return reply(400,{error:'기존 결제의 금액과 승인 진행을 확인해 주세요.'});
     await user(who.id,'queue-confirm-recovery',{orderId:p.orderId,accepted:true,amount:p.amount});
    }
    await process(p.orderId);await authenticate(bearer.slice(7));
    return reply(200,await user(who.id,'get',{orderId:p.orderId}));
   }
   if(action==='refresh'){
    await user(who.id,'queue-refresh',{orderId:p.orderId});await process(p.orderId);await authenticate(bearer.slice(7));
    return reply(200,await user(who.id,'get',{orderId:p.orderId}));
   }
   if(action==='admin-list')return reply(200,await admin(who.id,'list',{offset:p.offset||0,filter:p.filter==='attention'?'attention':'all'}));
   if(action==='admin-refresh'){
    const q=await admin(who.id,'refresh',{orderId:p.orderId});await process(q.orderId);return reply(200,{updated:true});
   }
   if(['refund-approve','refund-reject','refund-execute'].includes(action)){
    if(p.confirmed!==true||(['refund-approve','refund-execute'].includes(action)&&(!Number.isInteger(p.amount)||p.amount<1)))return reply(400,{error:'금액과 실행 여부를 명시적으로 확인해 주세요.'});
    const result=await admin(who.id,action,{orderId:p.orderId,refundId:p.refundId,revision:p.revision,confirmed:true,amount:p.amount,note:p.note});
    if(action==='refund-execute')await process(result.orderId);return reply(200,{saved:true});
   }
   return reply(200,await user(who.id,action,action==='refund-request'?{orderId:p.orderId,requestId:p.requestId,reason:p.reason}:
    action==='refund-withdraw'?{orderId:p.orderId,refundId:p.refundId}:action==='list'?{offset:p.offset||0}:{orderId:p.orderId}));
  }catch(e){
   if(e.code==='42501')return reply(403,{error:'주문 소유권·참가 조건·운영 권한을 확인해 주세요.'});
   if(e.code==='40001')return reply(409,{error:'다른 요청이 처리 중이거나 내용이 바뀌었습니다. 다시 불러온 뒤 확인해 주세요.'});
   if(['22023','22P02','23505','23514','23502'].includes(e.code))return reply(400,{error:'주문·가격·참여 안내 또는 환불 상태가 달라졌습니다. 새로고침 후 확인해 주세요.'});
   return reply(503,{error:'결제 결과 확인이 지연되고 있습니다. 다시 결제하지 말고 주문 내역에서 상태를 새로 확인해 주세요.',recoverable:true});
  }
 };
}
