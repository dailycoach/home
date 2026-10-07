const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG=/^[a-z0-9-]{1,120}$/;
const MAX_BODY_BYTES=32768;
function reply(status,body,origin,origins){
  const empty=status===204;
  return new Response(empty?null:JSON.stringify(body),{status,headers:{
    ...(!empty?{'Content-Type':'application/json; charset=utf-8'}:{}),
    ...(origins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{}),
    'Access-Control-Allow-Headers':'authorization, apikey, content-type',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Cache-Control':'no-store',Vary:'Origin'
  }});
}
async function readBody(request){
  const reader=request.body?.getReader();
  if(!reader)throw new Error('Invalid request body');
  let size=0;const chunks=[];
  try{
    while(true){
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>MAX_BODY_BYTES){await reader.cancel();throw new Error('Request too large');}
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  const data=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder().decode(data));
}
export function createReadDailyHandler(deps){
  const {enabled,origins,authenticate,bootstrap,getDay,saveAnswer,completeDay}=deps;
  return async function handler(request){
    const origin=request.headers.get('origin')||'';
    const respond=(status,body)=>reply(status,body,origin,origins);
    if(origin&&!origins.includes(origin))return respond(403,{error:'Origin not allowed'});
    if(request.method==='OPTIONS')return respond(204,null);
    if(request.method!=='POST')return respond(405,{error:'Method not allowed'});
    const raw=request.headers.get('authorization')||'';
    const token=raw.startsWith('Bearer ')?raw.slice(7):'';
    if(!token)return respond(401,{error:'Login required'});
    if(!enabled)return respond(503,{error:'NAL READ daily engine is not enabled'});
    let user;
    try{user=await authenticate(token);}catch{return respond(401,{error:'Invalid session'});}
    if(!UUID.test(user?.id||''))return respond(401,{error:'Invalid session'});
    let body;
    try{body=await readBody(request);}catch(error){
      return respond(error.message==='Request too large'?413:400,{error:'Invalid request body'});
    }
    if(!body||typeof body!=='object'||Array.isArray(body))return respond(400,{error:'Invalid request body'});
    const {seasonSlug,action,dayNumber,stepOrder}=body;
    if(typeof seasonSlug!=='string'||!SLUG.test(seasonSlug))return respond(400,{error:'Invalid season'});
    if(!['bootstrap','day','save-answer','complete-day'].includes(action))return respond(400,{error:'Unknown action'});
    if(action!=='bootstrap'&&(!Number.isInteger(dayNumber)||dayNumber<0||dayNumber>366))return respond(400,{error:'Invalid day'});
    if(action==='save-answer'){
      if(!Number.isInteger(stepOrder)||stepOrder<1||stepOrder>100)return respond(400,{error:'Invalid answer target'});
      if(body.answerText!=null&&(typeof body.answerText!=='string'||body.answerText.length>5000))return respond(400,{error:'Invalid answer text'});
      if(body.answerJson!=null&&(typeof body.answerJson!=='object'||Array.isArray(body.answerJson)))return respond(400,{error:'Invalid answer payload'});
    }
    try{
      if(action==='bootstrap')return respond(200,await bootstrap(user.id,seasonSlug));
      if(action==='day')return respond(200,await getDay(user.id,seasonSlug,dayNumber));
      if(action==='save-answer')return respond(200,await saveAnswer(user.id,seasonSlug,dayNumber,stepOrder,body.answerText??null,body.answerJson??null));
      return respond(200,await completeDay(user.id,seasonSlug,dayNumber));
    }catch(error){
      const message=error instanceof Error?error.message:'';
      if(error?.code==='42501'||/Read access unavailable|Read day locked/i.test(message))return respond(403,{error:'Read access unavailable or day locked'});
      if(error?.code==='22023'||/Invalid answer|Valid required answers missing|Required answers missing|Read (?:day|week|step) unavailable|Answer too long|Step does not accept/i.test(message))return respond(400,{error:'Invalid answer or unavailable content'});
      return respond(500,{error:'Read daily operation unavailable'});
    }
  };
}
