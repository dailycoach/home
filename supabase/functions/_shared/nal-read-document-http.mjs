const EDITOR=['list','get','save','review','approve','publish','history','history-open','schedule-save'];
const REPORT=['source','save','list','open'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function bodyJson(req,limit){
 const reader=req.body?.getReader();if(!reader)throw new Error('body');const parts=[];let count=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;count+=value.byteLength;if(count>limit){await reader.cancel();throw new Error('large');}parts.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(count);let pos=0;for(const p of parts){bytes.set(p,pos);pos+=p.byteLength;}return JSON.parse(new TextDecoder().decode(bytes));
}
export function createDocumentHandler({kind,enabled,origins,authenticate,operate}){
 const actions=new Set(kind==='editorial'?EDITOR:REPORT);
 return async request=>{
  const origin=request.headers.get('origin')||'';
  const reply=(status,body)=>new Response(status===204?null:JSON.stringify(body),{status,headers:{
   ...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{}),'Content-Type':'application/json; charset=utf-8',
   'Cache-Control':'no-store','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS',Vary:'Origin'}});
  if(origin&&!origins.includes(origin))return reply(403,{error:'허용되지 않은 요청입니다.'});
  if(request.method==='OPTIONS')return reply(204,null);
  if(request.method!=='POST')return reply(405,{error:'POST 요청이 필요합니다.'});
  const raw=request.headers.get('authorization')||'';if(!raw.startsWith('Bearer ')||!raw.slice(7))return reply(401,{error:'로그인이 필요합니다.'});
  if(!enabled)return reply(503,{error:'이 개발 기능은 아직 서버에 연결되지 않았습니다.'});
  let user;try{user=await authenticate(raw.slice(7));}catch{return reply(401,{error:'로그인을 다시 확인해 주세요.'});}
  if(!UUID.test(user?.id||''))return reply(401,{error:'로그인을 다시 확인해 주세요.'});
  let b;try{b=await bodyJson(request,kind==='editorial'?640000:30000);}catch(e){return reply(e.message==='large'?413:400,{error:'파일 형식 또는 크기를 확인해 주세요.'});}
  if(!b||typeof b!=='object'||Array.isArray(b)||!actions.has(b.action)||typeof b.seasonSlug!=='string'
   ||!/^[a-z0-9-]{1,120}$/.test(b.seasonSlug)||!b.payload||typeof b.payload!=='object'||Array.isArray(b.payload))return reply(400,{error:'입력 형식을 확인해 주세요.'});
  if(['open','history-open','schedule-save'].includes(b.action)&&!UUID.test(b.payload.id||''))return reply(400,{error:'기록 번호를 확인해 주세요.'});
  try{return reply(200,await operate(user.id,b.seasonSlug,b.action,b.payload));}
  catch(e){
   if(e.code==='40001')return reply(409,{error:'다른 편집자가 수정했습니다. 현재 원고를 파일로 보관한 뒤 최신 버전을 다시 열어주세요.'});
   if(e.code==='42501')return reply(403,{error:'편집 권한·참가 권한 또는 공개 제한을 확인해 주세요.'});
   if(['22023','22P02','22007','22008','23514','23502','23505'].includes(e.code))return reply(400,{error:'저장 조건을 확인해 주세요. 원고 형식, 승인 버전, 진행 중 시즌, 일정 중복 또는 리포트 보관 한도가 맞지 않을 수 있습니다.'});
   return reply(500,{error:'처리하지 못했습니다. 화면의 내용을 보관한 뒤 다시 시도해 주세요.'});
  }
 };
}
