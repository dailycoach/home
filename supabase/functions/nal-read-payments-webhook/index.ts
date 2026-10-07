import {paymentConfig,paymentRuntime} from '../_shared/nal-read-payments-runtime.mjs';
import {readBoundedJson} from '../nal-read-payments/handler.mjs';
const cfg=paymentConfig(Deno.env);
Deno.serve(async(req:Request)=>{
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method!=='POST')return reply(405,{error:'POST required'});
 if(!cfg.enabled||Deno.env.get('NAL_READ_WEBHOOK_ENABLED')!=='true')return reply(503,{error:'READ payment receiver disabled'});
 let event;try{event=await readBoundedJson(req,65536);}catch{return reply(400,{error:'Invalid event'});}
 if(event?.eventType!=='PAYMENT_STATUS_CHANGED')return reply(200,{ignored:true});
 const providerOrderId=event?.data?.orderId;
 if(typeof providerOrderId!=='string'||!/^nr_[a-f0-9]{32}$/.test(providerOrderId))return reply(200,{ignored:true});
 try{
  const runtime=paymentRuntime(cfg);
  // Store only a refresh signal for a previously server-created READ order.
  // Do not consume the hinted amount/status/paymentKey as financial truth.
  const signal=await runtime.processor('hint',{providerOrderId});
  if(signal.ignored)return reply(200,{ignored:true});
  const result=await runtime.process(signal.orderId);
  if(result.pending)return reply(503,{retry:true});
  return reply(200,{received:true});
 }catch{return reply(503,{retry:true});}
});
