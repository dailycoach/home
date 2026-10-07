// BUILD12: explicit support messages only. No log/URL/token/answer collection.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG=/^[a-z0-9-]{1,120}$/;
const CATEGORIES=new Set(['account','read','payment','live','technical','other']);
const USER=new Set(['contexts','list','get','create','reply','resolve','reopen','read']);
const STAFF=new Set(['list','get','staff','reply','resolve','reopen','assign']);
const FIELDS={contexts:[],staff:[],list:['offset','state','category'],get:['id','afterSeq'],read:['id','throughSeq'],
 create:['requestId','subject','category','body','seasonSlug','orderId','shareConfirmed'],
 reply:['id','requestId','revision','body','shareConfirmed'],resolve:['id','requestId','revision','confirmed'],
 reopen:['id','requestId','revision','confirmed'],assign:['id','requestId','revision','assignedTo','confirmed']};
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const integer=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi;
async function boundedJson(req){
 const reader=req.body?.getReader();if(!reader)throw new Error('body');let length=0;const chunks=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;
  if(length>24576){await reader.cancel();throw new Error('large');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const data=new Uint8Array(length);let at=0;for(const value of chunks){data.set(value,at);at+=value.byteLength;}
 return JSON.parse(new TextDecoder().decode(data));
}
export function createSupportHandler({enabled,origins,authenticate,operate}){
 return async req=>{
  const origin=req.headers.get('origin')||'';
  const reply=(status,data)=>new Response(status===204?null:JSON.stringify(data),{status,headers:{
   'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',Vary:'Origin',
   ...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{}),
   'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type'}});
  if(origin&&!origins.includes(origin))return reply(403,{error:'허용되지 않은 요청입니다.'});
  if(req.method==='OPTIONS')return reply(204,null);
  if(req.method!=='POST')return reply(405,{error:'개인 문의는 로그인한 계정으로 요청해 주세요.'});
  const header=req.headers.get('authorization')||'';
  if(!header.startsWith('Bearer ')||!header.slice(7))return reply(401,{error:'개인 문의를 보려면 로그인해 주세요.'});
  if(!enabled)return reply(503,{error:'개인 문의 연결은 아직 준비 중입니다. 이용 안내는 로그인 없이 볼 수 있습니다.'});
  let user;try{user=await authenticate(header.slice(7));}catch{return reply(401,{error:'로그인을 다시 확인해 주세요.'});}
  if(!UUID.test(user?.id||''))return reply(401,{error:'로그인을 다시 확인해 주세요.'});
  if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')||''))return reply(415,{error:'입력 형식을 확인해 주세요.'});
  let body;try{body=await boundedJson(req);}catch(e){return reply(e.message==='large'?413:400,{error:'입력 내용을 확인해 주세요.'});}
  if(!plain(body)||typeof body.action!=='string'||!plain(body.payload))return reply(400,{error:'입력 내용을 확인해 주세요.'});
  const staff=body.action.startsWith('admin-'),action=staff?body.action.slice(6):body.action,p=body.payload;
  if(!(staff?STAFF:USER).has(action))return reply(400,{error:'지원하지 않는 문의 작업입니다.'});
  if(Object.keys(p).some(k=>!FIELDS[action].includes(k)))return reply(400,{error:'문의에 필요한 정보만 보내주세요.'});
  if(['get','reply','resolve','reopen','read','assign'].includes(action)&&!UUID.test(p.id||''))return reply(400,{error:'문의 번호를 확인해 주세요.'});
  if(['create','reply','resolve','reopen','assign'].includes(action)&&!UUID.test(p.requestId||''))return reply(400,{error:'요청 번호를 확인해 주세요.'});
  if(['reply','resolve','reopen','assign'].includes(action)&&!integer(p.revision,1,2147483646))return reply(400,{error:'문의의 최신 내용을 먼저 확인해 주세요.'});
  if(['resolve','reopen','assign'].includes(action)&&p.confirmed!==true)return reply(400,{error:'변경 내용을 먼저 확인해 주세요.'});
  if(['create','reply'].includes(action)&&(typeof p.body!=='string'||!p.body.trim()||p.body.length>4000||p.shareConfirmed!==true))return reply(400,{error:'공유할 문의 내용을 확인해 주세요. 본문은 4,000자까지입니다.'});
  if(action==='create'){
   if(typeof p.subject!=='string'||!p.subject.trim()||p.subject.length>120||!CATEGORIES.has(p.category)
    ||(p.seasonSlug!=null&&(typeof p.seasonSlug!=='string'||!SLUG.test(p.seasonSlug)))
    ||(p.orderId!=null&&!UUID.test(p.orderId)))return reply(400,{error:'제목·분류·선택한 기수와 주문을 확인해 주세요.'});
  }
  if(action==='assign'&&p.assignedTo!=null&&!UUID.test(p.assignedTo))return reply(400,{error:'현재 운영자를 선택해 주세요.'});
  if(action==='list'&&((p.offset!==undefined&&!integer(p.offset,0,10000))
   ||(p.state!==undefined&&!['all','open','answered','resolved'].includes(p.state))
   ||(p.category!==undefined&&p.category!=='all'&&!CATEGORIES.has(p.category))))return reply(400,{error:'문의 목록 조건을 확인해 주세요.'});
  if(action==='get'&&p.afterSeq!==undefined&&!integer(p.afterSeq,0,1000))return reply(400,{error:'대화 위치를 확인해 주세요.'});
  if(action==='read'&&!integer(p.throughSeq,0,1000))return reply(400,{error:'읽은 답변 범위를 확인해 주세요.'});
  try{return reply(200,await operate(user.id,staff,action,p));}
  catch(error){
   if(error.code==='42501')return reply(403,{error:'본인 문의 또는 배정된 문의만 볼 수 있습니다. 선택한 주문·기수도 확인해 주세요.'});
   if(error.code==='40001')return reply(409,{error:'새 답변이나 변경이 있습니다. 작성한 내용을 보관한 뒤 최신 대화를 다시 불러와 주세요.'});
   if(error.code==='P0120')return reply(429,{error:'짧은 시간에 여러 문의가 등록되었습니다. 기존 문의에 이어 쓰거나 잠시 후 다시 시도해 주세요.'});
   if(['22023','22P02','23505','23514','23502'].includes(error.code))return reply(400,{error:'문의 내용·요청 번호·연결한 주문과 기수를 확인해 주세요.'});
   return reply(503,{error:'저장 여부를 확인하지 못했습니다. 같은 내용으로 다시 시도하면 기존 요청을 먼저 확인합니다.',recoverable:true});
  }
 };
}
