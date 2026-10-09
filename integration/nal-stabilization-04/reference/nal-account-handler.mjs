const ACTIONS={account:new Set(['home','operator-home','operator-context','profile','profile-save','files','orders','programs','registrations','reports']),join:new Set(['options','claim','welcome']),'offers-admin':new Set(['list','save']),privacy:new Set(['inventory','status','request','withdraw'])};
const SLUG=/^[a-z0-9-]{1,120}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function readBody(req){
 const r=req.body?.getReader();if(!r)throw new Error('body');let n=0;const parts=[];
 try{for(;;){const {done,value}=await r.read();if(done)break;n+=value.byteLength;if(n>24576){await r.cancel();throw new Error('large');}parts.push(value);}}finally{r.releaseLock();}
 const out=new Uint8Array(n);let at=0;for(const p of parts){out.set(p,at);at+=p.byteLength;}return JSON.parse(new TextDecoder().decode(out));
}
export function createAccountHandler({enabled,privacyEnabled=false,origins,authenticate,catalog,operate}){
 return async req=>{
  const origin=req.headers.get('origin')||'';
  const reply=(status,b)=>new Response(status===204?null:JSON.stringify(b),{status,headers:{
   ...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{}),'Vary':'Origin','Cache-Control':'no-store',
   'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'}});
  if(origin&&!origins.includes(origin))return reply(403,{error:'허용되지 않은 요청입니다.'});
  if(req.method==='OPTIONS')return reply(204,null);
  if(!['GET','POST'].includes(req.method))return reply(405,{error:'지원하지 않는 요청입니다.'});
  if(!enabled)return reply(503,{error:'MY NAL 계정 연결은 아직 준비 중입니다.'});
  if(req.method==='GET'){
   const q=new URL(req.url).searchParams;
   if(q.get('action')!=='offers'||(q.has('season')&&!SLUG.test(q.get('season'))))return reply(400,{error:'프로그램 주소를 확인해 주세요.'});
   try{return reply(200,await catalog(q.get('season')));}catch{return reply(503,{error:'프로그램 목록을 준비하고 있습니다.'});}
  }
  const bearer=req.headers.get('authorization')||'';
  if(!bearer.startsWith('Bearer ')||!bearer.slice(7))return reply(401,{error:'로그인이 필요합니다.'});
  let user;try{user=await authenticate(bearer.slice(7));}catch{return reply(401,{error:'로그인을 다시 확인해 주세요.'});}
  let b;try{b=await readBody(req);}catch(e){return reply(e.message==='large'?413:400,{error:'입력 내용을 확인해 주세요.'});}
  if(!b||typeof b!=='object'||Array.isArray(b)||!Object.hasOwn(ACTIONS,b.area)||!ACTIONS[b.area].has(b.action)
   ||!b.payload||typeof b.payload!=='object'||Array.isArray(b.payload)||(b.area==='join'&&!SLUG.test(b.seasonSlug||'')))return reply(400,{error:'입력 내용을 확인해 주세요.'});
  if(b.area==='privacy'&&!privacyEnabled)return reply(503,{error:'개인정보 요청 접수는 아직 준비 중입니다. 기존 고객지원 채널을 이용해 주세요.'});
  if(b.area==='privacy'&&b.seasonSlug!==undefined)return reply(400,{error:'개인정보 요청은 기수에 종속되지 않습니다.'});
  if(b.area==='account'&&b.action==='home'&&Object.keys(b.payload).length)return reply(400,{error:'홈은 추가 정보 없이 현재 계정으로 불러옵니다.'});
  if(b.area==='account'&&b.action==='operator-home'){
   const p=b.payload;
   if(Object.keys(p).some(k=>!['seasonSlug','search','offset'].includes(k))
    ||(p.seasonSlug!==undefined&&p.seasonSlug!==null&&(typeof p.seasonSlug!=='string'||!SLUG.test(p.seasonSlug)))
    ||(p.search!==undefined&&(typeof p.search!=='string'||p.search.length>120)))return reply(400,{error:'운영 홈은 시즌·검색어·목록 위치만 지정할 수 있습니다.'});
  }
  if(b.area==='account'&&b.action==='operator-context'){
   const p=b.payload,fields={orders:['kind','seasonSlug','offset','filter'],support:['kind','seasonSlug','offset','state','category'],'support-thread':['kind','seasonSlug','id','afterSeq']};
   if(!Object.hasOwn(fields,p.kind)||Object.keys(p).some(k=>!fields[p.kind].includes(k))||typeof p.seasonSlug!=='string'||!SLUG.test(p.seasonSlug))return reply(400,{error:'선택한 기수와 조회 범위를 확인해 주세요.'});
   if(p.kind==='orders'&&p.filter!==undefined&&p.filter!=='all')return reply(400,{error:'주문 조회 조건을 확인해 주세요.'});
   if(p.kind==='support'&&((p.state!==undefined&&!['all','open','answered','resolved'].includes(p.state))||(p.category!==undefined&&!['all','account','read','payment','live','technical','other'].includes(p.category))))return reply(400,{error:'문의 조회 조건을 확인해 주세요.'});
   if(p.kind==='support-thread'&&(!UUID.test(p.id||'')||(p.afterSeq!==undefined&&(!Number.isInteger(p.afterSeq)||p.afterSeq<0||p.afterSeq>1000))))return reply(400,{error:'선택한 기수의 문의와 대화 위치를 확인해 주세요.'});
  }
  if(Object.hasOwn(b.payload,'offset')&&(!Number.isInteger(b.payload.offset)||b.payload.offset<0||b.payload.offset>10000))return reply(400,{error:'페이지 범위를 확인해 주세요.'});
  try{return reply(200,await operate(user.id,b.area,b.action,b.seasonSlug,b.payload));}
  catch(e){
   if(b.area==='privacy'){
    if(e.code==='42501')return reply(403,{error:'본인 확인을 다시 진행해 주세요.'});
    if(e.code==='40001')return reply(409,{error:'검토가 시작된 요청은 여기에서 철회할 수 없습니다.'});
    if(['22023','22P02','23505'].includes(e.code))return reply(400,{error:'요청 종류·본인 확인·접수 번호를 확인해 주세요.'});
    return reply(503,{error:'요청을 접수하거나 조회하지 못했습니다. 파기가 완료된 것으로 표시하지 않습니다.'});
   }
   if(b.area==='account'&&b.action==='operator-context'){
    if(e.code==='42501')return reply(403,{error:'선택한 기수의 기록을 볼 수 있는 운영 권한이나 문의 배정을 확인해 주세요.'});
    if(['22023','22P02'].includes(e.code))return reply(400,{error:'해당 기수 또는 조회 조건을 찾지 못했습니다. 다른 기수로 대신 표시하지 않습니다.'});
    return reply(503,{error:'기수별 조회 연결을 확인하지 못했습니다. 전체 목록이나 빈 기록으로 대신 표시하지 않습니다.'});
   }
   if(b.area==='account'&&b.action==='operator-home'){
    if(e.code==='42501')return reply(403,{error:'운영 홈은 기존 소유자·운영자 계정만 사용할 수 있습니다. 이 화면은 권한을 새로 부여하지 않습니다.'});
    if(['22023','22P02'].includes(e.code))return reply(400,{error:'선택한 시즌이나 목록 조건을 다시 확인해 주세요.'});
    return reply(503,{error:'운영 정보를 불러오지 못했습니다. 준비가 완료됐거나 기록이 없는 것으로 판단하지 않습니다.'});
   }
   if(e.code==='40001')return reply(409,{error:'다른 화면에서 변경됐습니다. 내용을 보관한 뒤 다시 열어주세요.'});
   if(e.code==='42501')return reply(403,{error:'참가권·공개 상태·관리 권한을 확인해 주세요. 자동으로 권한을 복구하지 않습니다.'});
   if(['22023','22P02','22007','22008','23505','23514','23502'].includes(e.code))return reply(400,{error:'연결 상품·신청 안내 버전·참가 조건이 달라졌습니다. 새로고침 후 확인해 주세요.'});
   return reply(500,{error:'연결하지 못했습니다. 기록은 유지되며 다시 시도할 수 있습니다.'});
  }
 };
}
