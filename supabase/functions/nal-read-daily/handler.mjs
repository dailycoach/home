const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG=/^[a-z0-9-]{1,120}$/;

function cors(origin,allowed){
  const accepted=allowed.includes(origin)?origin:"";
  return {
    ...(accepted?{"Access-Control-Allow-Origin":accepted}:{}),
    "Access-Control-Allow-Headers":"authorization, apikey, content-type",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    "Vary":"Origin"
  };
}
function response(status,body,origin,allowed){
  const empty=status===204;
  return new Response(empty?null:JSON.stringify(body),{
    status,
    headers:{...(!empty?{"Content-Type":"application/json; charset=utf-8"}:{}),...cors(origin,allowed)}
  });
}
export function createReadDailyHandler(deps){
  const {enabled,origins,authenticate,bootstrap,getDay,saveAnswer,completeDay}=deps;
  return async function handler(request){
    const origin=request.headers.get("origin")||"";
    if(request.method==="OPTIONS"){
      if(origin&&!origins.includes(origin))return response(403,{error:"Origin not allowed"},origin,origins);
      return response(204,null,origin,origins);
    }
    if(request.method!=="POST")return response(405,{error:"Method not allowed"},origin,origins);
    if(origin&&!origins.includes(origin))return response(403,{error:"Origin not allowed"},origin,origins);
    if(!enabled)return response(503,{error:"NAL READ daily engine is not enabled"},origin,origins);

    const raw=request.headers.get("authorization")||"";
    const token=raw.startsWith("Bearer ")?raw.slice(7):"";
    if(!token)return response(401,{error:"Login required"},origin,origins);
    let user;
    try{user=await authenticate(token)}catch{return response(401,{error:"Invalid session"},origin,origins)}
    if(!UUID.test(user?.id||""))return response(401,{error:"Invalid session"},origin,origins);

    let body;
    try{body=await request.json()}catch{return response(400,{error:"Invalid request body"},origin,origins)}
    const seasonSlug=body?.seasonSlug||"";
    if(!SLUG.test(seasonSlug))return response(400,{error:"Invalid season"},origin,origins);

    try{
      if(body.action==="bootstrap"){
        return response(200,await bootstrap(user.id,seasonSlug),origin,origins);
      }
      if(body.action==="day"){
        const dayNumber=Number(body.dayNumber);
        if(!Number.isInteger(dayNumber)||dayNumber<0||dayNumber>366)return response(400,{error:"Invalid day"},origin,origins);
        return response(200,await getDay(user.id,seasonSlug,dayNumber),origin,origins);
      }
      if(body.action==="save-answer"){
        const dayNumber=Number(body.dayNumber),stepOrder=Number(body.stepOrder);
        if(!Number.isInteger(dayNumber)||dayNumber<0||dayNumber>366||!Number.isInteger(stepOrder)||stepOrder<1||stepOrder>100){
          return response(400,{error:"Invalid answer target"},origin,origins);
        }
        const answerText=body.answerText==null?null:String(body.answerText);
        if(answerText&&answerText.length>5000)return response(400,{error:"Answer too long"},origin,origins);
        const answerJson=body.answerJson==null?null:body.answerJson;
        return response(200,await saveAnswer(user.id,seasonSlug,dayNumber,stepOrder,answerText,answerJson),origin,origins);
      }
      if(body.action==="complete-day"){
        const dayNumber=Number(body.dayNumber);
        if(!Number.isInteger(dayNumber)||dayNumber<0||dayNumber>366)return response(400,{error:"Invalid day"},origin,origins);
        return response(200,await completeDay(user.id,seasonSlug,dayNumber),origin,origins);
      }
      return response(400,{error:"Unknown action"},origin,origins);
    }catch(error){
      const message=error instanceof Error?error.message:"Read daily operation unavailable";
      if(/access unavailable|locked/i.test(message))return response(403,{error:message},origin,origins);
      if(/unavailable|missing|too long|does not accept/i.test(message))return response(400,{error:message},origin,origins);
      return response(500,{error:"Read daily operation unavailable"},origin,origins);
    }
  };
}
