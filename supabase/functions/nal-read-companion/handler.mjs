const SLUG=/^[a-z0-9-]{1,120}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MEMBER=new Set(['arrival','check-save']);
const STUDIO=new Set(['seasons','get','preset','guide-save','guide-publish','plan-save']);
async function readBody(req){
 const reader=req.body?.getReader();if(!reader)throw new Error('body');const chunks=[];let length=0;
 try{for(;;){const{done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>65536){await reader.cancel();throw new Error('large');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength;}
 return JSON.parse(new TextDecoder().decode(bytes));
}
export function createCompanionHandler({enabled,origins,authenticate,publicDetail,member,studio}){
 return async req=>{
  const origin=req.headers.get('origin')||'';
  const reply=(status,body)=>new Response(status===204?null:JSON.stringify(body),{status,headers:{
   'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',Vary:'Origin',
   ...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{}),
   'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type'}});
  if(origin&&!origins.includes(origin))return reply(403,{error:'허용되지 않은 요청입니다.'});
  if(req.method==='OPTIONS')return reply(204,null);
  if(req.method==='GET'){
   if(!enabled)return reply(503,{error:'프로그램 안내 연결은 아직 준비 중입니다.'});
   const slug=new URL(req.url).searchParams.get('season');if(!SLUG.test(slug||''))return reply(400,{error:'시즌을 선택해 주세요.'});
   try{return reply(200,await publicDetail(slug));}catch{return reply(503,{error:'공개된 프로그램 안내를 불러오지 못했습니다.'});}
  }
  if(req.method!=='POST')return reply(405,{error:'POST 요청이 필요합니다.'});
  const authorization=req.headers.get('authorization')||'';
  if(!authorization.startsWith('Bearer ')||!authorization.slice(7))return reply(401,{error:'로그인이 필요합니다.'});
  if(!enabled)return reply(503,{error:'시작 안내·진행자 공간을 준비하고 있습니다.'});
  let user;try{user=await authenticate(authorization.slice(7));}catch{return reply(401,{error:'로그인을 다시 확인해 주세요.'});}
  if(!UUID.test(user?.id||''))return reply(401,{error:'로그인을 다시 확인해 주세요.'});
  let body;try{body=await readBody(req);}catch(e){return reply(e.message==='large'?413:400,{error:'입력 내용을 확인해 주세요.'});}
  if(!body||typeof body!=='object'||Array.isArray(body)||typeof body.action!=='string'
   ||!body.payload||typeof body.payload!=='object'||Array.isArray(body.payload))return reply(400,{error:'입력 내용을 확인해 주세요.'});
  const staff=body.action.startsWith('studio-'),action=staff?body.action.slice(7):body.action,p=body.payload;
  if(!(staff?STUDIO:MEMBER).has(action))return reply(400,{error:'지원하지 않는 작업입니다.'});
  if(action!=='seasons'&&(typeof body.seasonSlug!=='string'||!SLUG.test(body.seasonSlug)))return reply(400,{error:'시즌을 선택해 주세요.'});
  if(['check-save','guide-save','guide-publish','plan-save'].includes(action)&&(!Number.isInteger(p.revision)||p.revision<0))return reply(400,{error:'최신 버전을 다시 열어주세요.'});
  if(['get','preset','plan-save'].includes(action)&&(!Number.isInteger(p.weekNumber)||p.weekNumber<1||p.weekNumber>4))return reply(400,{error:'주차를 확인해 주세요.'});
  if(action==='preset'&&p.presetId!=='nal-read-01-trend-2027-v1')return reply(400,{error:'불러올 원고를 선택해 주세요.'});
  if(action==='check-save'&&(!Number.isInteger(p.guideRevision)||p.guideRevision<1))return reply(400,{error:'현재 준비 안내를 다시 열어주세요.'});
  if(action==='plan-save'&&p.sessionId!=null&&p.sessionId!==''&&!UUID.test(p.sessionId))return reply(400,{error:'이번 주 LIVE를 선택해 주세요.'});
  try{return reply(200,await (staff?studio:member)(user.id,body.seasonSlug||null,action,p));}
  catch(e){
   if(e.code==='42501')return reply(403,{error:'참가권 또는 진행자 권한을 확인해 주세요.'});
   if(e.code==='40001')return reply(409,{error:'다른 화면에서 내용이 바뀌었습니다. 작성한 내용을 보관한 뒤 다시 열어주세요.'});
   if(['22023','22P02','23514','23502','23505'].includes(e.code))return reply(400,{error:'원고·필수 항목·진행 시간·연결한 LIVE를 다시 확인해 주세요.'});
   return reply(500,{error:'요청을 처리하지 못했습니다. 작성한 내용을 보관한 채 다시 시도해 주세요.'});
  }
 };
}
