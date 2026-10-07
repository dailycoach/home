const ACTIONS=new Set(['drafts','draft-save','draft-commit','experiments','experiment-save','experiment-from-answer','live','live-save','live-join','archive','mark']);
const SLUG=/^[a-z0-9-]{1,120}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function boundedJson(request){
 const reader=request.body?.getReader();if(!reader)throw new Error('body');let size=0;const chunks=[];
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768){await reader.cancel();throw new Error('large');}chunks.push(value);}}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.byteLength;}
 return JSON.parse(new TextDecoder().decode(bytes));
}
export function createWorkspaceHandler({enabled,origins,authenticate,operate}){
 return async request=>{
  const origin=request.headers.get('origin')||'';
  const reply=(status,body)=>new Response(status===204?null:JSON.stringify(body),{status,headers:{
   ...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{}),
   'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS',
   'Cache-Control':'no-store','Content-Type':'application/json; charset=utf-8',Vary:'Origin'}});
  if(origin&&!origins.includes(origin))return reply(403,{error:'허용되지 않은 요청입니다.'});
  if(request.method==='OPTIONS')return reply(204,null);
  if(request.method!=='POST')return reply(405,{error:'POST 요청이 필요합니다.'});
  const header=request.headers.get('authorization')||'';
  if(!header.startsWith('Bearer ')||!header.slice(7))return reply(401,{error:'로그인이 필요합니다.'});
  if(!enabled)return reply(503,{error:'READ 개발 연결은 아직 열리지 않았습니다.'});
  let user;try{user=await authenticate(header.slice(7));}catch{return reply(401,{error:'로그인을 다시 확인해 주세요.'});}
  if(!UUID.test(user?.id||''))return reply(401,{error:'로그인을 다시 확인해 주세요.'});
  let body;try{body=await boundedJson(request);}catch(e){return reply(e.message==='large'?413:400,{error:'입력 내용을 확인해 주세요.'});}
  if(!body||typeof body!=='object'||Array.isArray(body)||!ACTIONS.has(body.action)
   ||typeof body.seasonSlug!=='string'||!SLUG.test(body.seasonSlug)||!body.payload
   ||typeof body.payload!=='object'||Array.isArray(body.payload))return reply(400,{error:'입력 내용을 확인해 주세요.'});
  const p=body.payload,from=body.action==='experiment-from-answer';
  if((body.action.startsWith('draft')||from)&&(!Number.isInteger(p.dayNumber)||p.dayNumber<(from?1:0)||p.dayNumber>366))return reply(400,{error:'DAY를 확인해 주세요.'});
  if((['draft-save','draft-commit'].includes(body.action)||from)&&(!Number.isInteger(p.stepOrder)||p.stepOrder<1||p.stepOrder>100))return reply(400,{error:'질문을 확인해 주세요.'});
  if((['draft-save','draft-commit','experiment-save','live-save'].includes(body.action)||from)&&(!Number.isInteger(p.revision)||p.revision<(from?1:0)))return reply(400,{error:'기록 버전을 확인해 주세요.'});
  if(['experiment-save','live-save','live-join','mark'].includes(body.action)&&!UUID.test(p.id||''))return reply(400,{error:'기록을 확인해 주세요.'});
  if(from&&(!UUID.test(p.answerId||'')||Object.keys(p).some(k=>!['dayNumber','stepOrder','revision','answerId'].includes(k))))return reply(400,{error:'저장한 TRY 답변만 실험으로 연결할 수 있습니다.'});
  if(body.action==='live-join'&&Object.hasOwn(p,'revision')&&(!Number.isInteger(p.revision)||p.revision<0))return reply(400,{error:'대화 메모를 다시 확인해 주세요.'});
  try{return reply(200,await operate(user.id,body.seasonSlug,body.action,p));}
  catch(error){
   if(error.code==='40001')return reply(409,{error:'다른 탭에서 기록이 바뀌었습니다. 작성한 내용을 보관한 뒤 최신 기록을 다시 열어주세요.'});
   if(error.code==='42501')return reply(403,{error:'이 기록을 열 수 있는 권한이 없거나 아직 열리지 않았습니다.'});
   if(['22023','22P02','23514','23505','22007','22008','23502'].includes(error.code))return reply(400,{error:'입력 내용·연결할 기록 또는 공개 시간을 확인해 주세요.'});
   return reply(500,{error:'기록을 저장하지 못했습니다. 작성한 내용은 화면에 남아 있습니다.'});
  }
 };
}
