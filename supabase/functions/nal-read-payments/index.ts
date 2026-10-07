import {createReadAuthBoundary} from '../_shared/nal-read-auth.mjs';
import {paymentConfig,paymentRuntime} from '../_shared/nal-read-payments-runtime.mjs';
import {createReadPaymentsHandler} from './handler.mjs';
const config=paymentConfig(Deno.env);
Deno.serve((req:Request)=>{
 const auth=createReadAuthBoundary(config);
 const runtime=paymentRuntime(config);
 return createReadPaymentsHandler({...config,authenticate:(token:string)=>auth.authenticate(token),
  user:(id:string,action:string,payload:unknown)=>auth.rpc(id,'nal_read_payment_user',{p_action:action,p_payload:payload}),
  admin:(id:string,action:string,payload:unknown)=>auth.rpc(id,'nal_read_payment_admin',{p_action:action,p_payload:payload}),
  process:runtime.process
 })(req);
});
