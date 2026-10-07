const ACTIONS={account:new Set(['profile','profile-save','files','orders','programs','registrations','reports']),join:new Set(['options','claim','welcome']),'offers-admin':new Set(['list','save'])};
const SLUG=/^[a-z0-9-]{1,120}$/;
async function readBody(req){
 const r=req.body?.getReader();if(!r)throw new Error('body');let n=0;const parts=[];
 try{for(;;){const {done,value}=await r.read();if(done)break;n+=value.byteLength;if(n>24576){await r.cancel();throw new Error('large');}parts.push(value);}}finally{r.releaseLock();}
 const out=new Uint8Array(n);let at=0;for(const p of parts){out.set(p,at);at+=p.byteLength;}return JSON.parse(new TextDecoder().decode(out));
}
export function createAccountHandler({enabled,origins,authenticate,catalog,operate}){
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
  if(Object.hasOwn(b.payload,'offset')&&(!Number.isInteger(b.payload.offset)||b.payload.offset<0||b.payload.offset>10000))return reply(400,{error:'페이지 범위를 확인해 주세요.'});
  try{return reply(200,await operate(user.id,b.area,b.action,b.seasonSlug,b.payload));}
  catch(e){
   if(e.code==='40001')return reply(409,{error:'다른 화면에서 변경됐습니다. 내용을 보관한 뒤 다시 열어주세요.'});
   if(e.code==='42501')return reply(403,{error:'참가권·공개 상태·관리 권한을 확인해 주세요. 자동으로 권한을 복구하지 않습니다.'});
   if(['22023','22P02','22007','22008','23505','23514','23502'].includes(e.code))return reply(400,{error:'연결 상품·신청 안내 버전·참가 조건이 달라졌습니다. 새로고침 후 확인해 주세요.'});
   return reply(500,{error:'연결하지 못했습니다. 기록은 유지되며 다시 시도할 수 있습니다.'});
  }
 };
}
