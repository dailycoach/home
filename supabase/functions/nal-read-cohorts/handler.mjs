const SLUG=/^[a-z0-9-]{1,120}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USER=new Set(['status','mine','wait','withdraw']);
const ADMIN=new Set(['list','save','roster','offer-next','offer-cancel','attendance']);
async function bounded(req){
 const reader=req.body?.getReader();if(!reader)throw new Error('body');let bytes=0;const parts=[];
 try{for(;;){const{done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>16384){await reader.cancel();throw new Error('large');}parts.push(value);}}finally{reader.releaseLock();}
 const data=new Uint8Array(bytes);let offset=0;for(const p of parts){data.set(p,offset);offset+=p.byteLength;}return JSON.parse(new TextDecoder().decode(data));
}
export function createCohortHandler({enabled,origins,authenticate,list,operate}){
 return async req=>{
  const origin=req.headers.get('origin')||'';
  const reply=(status,data)=>new Response(status===204?null:JSON.stringify(data),{status,headers:{
   'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',Vary:'Origin',
   ...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{}),
   'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'}});
  if(origin&&!origins.includes(origin))return reply(403,{error:'허용되지 않은 요청입니다.'});
  if(req.method==='OPTIONS')return reply(204,null);
  if(!enabled)return reply(503,{error:'기수·대기 신청 연결은 아직 준비 중입니다.'});
  if(req.method==='GET'){
   const q=new URL(req.url).searchParams,program=q.get('program'),season=q.get('season');
   if((program!==null&&(!SLUG.test(program)||program.length>100))||(season!==null&&!SLUG.test(season)))return reply(400,{error:'프로그램 주소를 확인해 주세요.'});
   try{return reply(200,await list(program,season));}catch{return reply(503,{error:'기수 목록을 불러오지 못했습니다.'});}
  }
  if(req.method!=='POST')return reply(405,{error:'POST 요청이 필요합니다.'});
  const token=req.headers.get('authorization')||'';if(!token.startsWith('Bearer ')||!token.slice(7))return reply(401,{error:'로그인이 필요합니다.'});
  let user;try{user=await authenticate(token.slice(7));}catch{return reply(401,{error:'로그인을 다시 확인해 주세요.'});}
  if(!UUID.test(user?.id||''))return reply(401,{error:'로그인을 다시 확인해 주세요.'});
  let b;try{b=await bounded(req);}catch(e){return reply(e.message==='large'?413:400,{error:'입력 내용을 확인해 주세요.'});}
  if(!b||typeof b!=='object'||Array.isArray(b)||typeof b.action!=='string'||!b.payload||typeof b.payload!=='object'||Array.isArray(b.payload))return reply(400,{error:'입력 내용을 확인해 주세요.'});
  const admin=b.action.startsWith('admin-'),action=admin?b.action.slice(6):b.action,p=b.payload;
  if(!(admin?ADMIN:USER).has(action))return reply(400,{error:'지원하지 않는 기수 요청입니다.'});
  if(!['mine','list'].includes(action)&&(typeof p.seasonSlug!=='string'||!SLUG.test(p.seasonSlug)))return reply(400,{error:'기수를 선택해 주세요.'});
  if(['save','withdraw','offer-next','offer-cancel','attendance'].includes(action)&&(!Number.isInteger(p.revision)||p.revision<0))return reply(400,{error:'기록을 다시 열어주세요.'});
  if(p.offset!==undefined&&(!Number.isInteger(p.offset)||p.offset<0||p.offset>10000))return reply(400,{error:'페이지 범위를 확인해 주세요.'});
  if(['offer-next','offer-cancel'].includes(action)&&!UUID.test(p.userId||''))return reply(400,{error:'대기 신청을 확인해 주세요.'});
  if(action==='attendance'&&(!UUID.test(p.enrollmentId||'')||!UUID.test(p.sessionId||'')))return reply(400,{error:'참가자와 LIVE를 확인해 주세요.'});
  if(admin&&action==='save'&&(!Number.isInteger(p.capacity)||p.capacity<1||p.capacity>5000
   ||!Number.isInteger(p.cohortNumber)||p.cohortNumber<1||p.cohortNumber>9999
   ||!Number.isInteger(p.waitOfferHours)||p.waitOfferHours<1||p.waitOfferHours>168
   ||typeof p.waitlistEnabled!=='boolean'||typeof p.programKey!=='string'||!SLUG.test(p.programKey)||p.programKey.length>100))return reply(400,{error:'기수 번호·정원·대기 설정을 확인해 주세요.'});
  try{return reply(200,await operate(user.id,admin,action,p));}
  catch(e){
   if(e.code==='42501')return reply(403,{error:'로그인·운영 권한 또는 공개 상태를 확인해 주세요.'});
   if(e.code==='40001')return reply(409,{error:'다른 화면에서 변경됐습니다. 새로 불러온 내용으로 확인해 주세요.'});
   if(['22023','22P02','22007','22008','23505','23514','23502'].includes(e.code)){
    let message='정원·모집 기간·참가 상태 또는 입력 내용을 다시 확인해 주세요.';
    if(/first waiting/i.test(e.message))message='앞 순서의 대기자부터 참가 기회를 열어주세요.';
    if(/dates|new cohort|rewrite a cohort|LIVE sessions/i.test(e.message))message='신청자에게 안내된 일정은 덮어쓰지 않습니다. 기존 일정 또는 새 기수를 확인해 주세요.';
    if(/committed places/i.test(e.message))message='이미 참가·결제 중인 인원보다 정원을 줄일 수 없습니다.';
    if(/resolve|unresolved/i.test(e.message))message='진행 중인 참가권이나 결제를 먼저 확인해 주세요. 대기 철회는 환불이 아닙니다.';
    return reply(400,{error:message});
   }
   return reply(500,{error:'처리하지 못했습니다. 현재 신청 상태를 다시 확인해 주세요.'});
  }
 };
}
