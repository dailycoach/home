import assert from 'node:assert/strict';
import { processOneReceipt } from '../integration/nal-commerce-lite/server/receipt-outbox.mjs';

const ID='11111111-1111-4111-8111-111111111111';
const time=Date.parse('2026-10-10T04:30:00.000Z');
function fixture({paid=true,revoked=false,failSend=false,failRecord=false}={}){
  let done=false;
  const calls=[];
  const deps={
    release:true,now:()=>time,
    outbox:{
      takeOne:async()=>{calls.push('take');return done?null:{id:'job1',orderId:ID};},
      markSent:async()=>{calls.push('sent');done=true;},
      markRetry:async(_,code)=>{calls.push('retry:'+code);}
    },
    orders:{
      getPaidGuestOrder:async()=>{calls.push('paid');
        return {id:ID,email:'synthetic@example.invalid',status:paid?'paid':'refunded',revoked};}
    },
    tokens:{
      issue:async t=>{calls.push('issue');if(failRecord)return false;
        assert.equal(t.orderId,ID);assert.match(t.tokenDigest,/^[0-9a-f]{64}$/);
        assert.equal(t.expiresAt,new Date(time+45*60000).toISOString());
        return true;}
    },
    mailer:{
      send:async mail=>{
        calls.push('send');
        assert.equal(mail.to,'synthetic@example.invalid');
        assert(!JSON.stringify(mail).includes('service_role'));
        assert(mail.text.includes('/nal/commerce/claim/#order='));
        const link=mail.text.split('\n').find(x=>x.includes('/nal/commerce/claim/'));
        assert(!new URL(link).searchParams.has('token'));
        if(failSend)throw Error('synthetic offline email failure');
      }
    }
  };
  return {deps,calls};
}
let checks=0;
{
 const f=fixture();
 assert.deepEqual(await processOneReceipt({...f.deps,release:false}),{state:'disabled'});
 assert.deepEqual(f.calls,[]);checks++;
}
{
 const f=fixture();
 assert.deepEqual(await processOneReceipt({release:true}),{state:'disabled'});
 assert.deepEqual(f.calls,[]);checks++;
}
{
 const f=fixture();
 assert.deepEqual(await processOneReceipt(f.deps),{state:'sent',orderId:ID});
 assert.deepEqual(f.calls,['take','paid','issue','send','sent']);
 assert.deepEqual(await processOneReceipt(f.deps),{state:'empty'});
 assert.equal(f.calls.filter(x=>x==='send').length,1);checks+=2;
}
for(const opt of [{paid:false},{revoked:true},{failSend:true},{failRecord:true}]){
 const f=fixture(opt);
 const result=await processOneReceipt(f.deps);
 assert.deepEqual(result,{state:'retry'});
 assert(f.calls.includes('retry:DELIVERY_RETRY'));
 if(!opt.paid||opt.revoked)assert(!f.calls.includes('send'));
 checks++;
}
console.log('NAL COMMERCE LITE email receipt outbox simulation PASS: '+checks+' cases, no real emails or private file delivery');
