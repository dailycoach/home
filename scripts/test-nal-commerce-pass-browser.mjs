import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile('nal/assets/js/nal-commerce-pass.js','utf8');
const release=JSON.parse(await readFile('nal/data/commerce-pass.release.json','utf8'));
const ORDER='11111111-1111-4111-8111-111111111111';
const SLOT='22222222-2222-4222-8222-222222222222';
const CLAIM='P'.repeat(43);
const NOW=Date.now();
const gate={...release,
 uiEnabled:true,serverReady:true,passClaimReviewed:true,guestProofReviewed:true,
 providerSettlementReviewed:true,programSaleApproved:true,
 programClaimPageApproved:true,buyerPrivacyApproved:true,productionApproved:true,
 resendEnabled:true,resendRateLimitReviewed:true,emailSenderConnected:true
};
class FakeElement {
 constructor(tag='div'){
  this.tag=tag;this.hidden=true;this.disabled=true;this.textContent='';
  this.dataset={};this.events={};this.value='';this.attributes={};
 }
 addEventListener(event,handler){this.events[event]=handler;}
}
function scenario({approval=release,withProof=true,backendReady=true}={}){
 const targets=new Map(),calls=[],history=[];
 const el=id=>{if(!targets.has(id))targets.set(id,new FakeElement());return targets.get(id);};
 const uri='https://abcdefghijklmnopqrst.supabase.co';
 const backend={enabled:backendReady,url:uri,publishableKey:'sb_publishable_'+('k'.repeat(24))};
 let pathname='/nal/commerce/pass/';
 const ctx={
  URL,URLSearchParams,Date,Intl,AbortSignal,console,
  location:{hash:'#order='+ORDER+'&token='+CLAIM,pathname,search:'',origin:'https://daily-coach-ing.com'},
  history:{replaceState:(_a,_b,url)=>{history.push(url);ctx.location.hash='';}},
  sessionStorage:{getItem:()=>withProof?JSON.stringify({
    orderId:ORDER,claimToken:'C'.repeat(43),savedAt:Date.now()
  }):null},
  crypto:{randomUUID:()=> '33333333-3333-4333-8333-333333333333'},
  fetch:async(url,options)=>{
   calls.push({url,method:options.method??'GET',body:options.body??null});
   if(url==='/nal/data/commerce-pass.release.json')return {ok:true,json:async()=>approval};
   if(url==='/nal/data/backend.json')return {ok:true,json:async()=>backend};
   if(url===uri+'/functions/v1/nal-commerce-pass'){
    const data=JSON.parse(options.body);
    if(data.action==='verify')return {ok:true,json:async()=>({
      orderId:ORDER,slotId:SLOT,kind:'reading_pass',
      title:'가상 테스트 독서모임',startsAt:new Date(NOW+86400000).toISOString(),
      state:'confirmed'
    })};
    if(data.action==='confirm')return {ok:true,json:async()=>({state:'confirmed'})};
    if(data.action==='resend')return {ok:true,json:async()=>({accepted:true})};
   }
   throw Error('Unexpected network '+url);
  },
  document:{
   readyState:'complete',body:el('body'),
   querySelector:id=>el(id)
  }
 };
 ctx.globalThis=ctx;
 vm.runInNewContext(source,ctx,{timeout:2000});
 return {ctx,targets,history,calls,el};
}
async function flush(){for(let i=0;i<9;i++)await new Promise(resolve=>setImmediate(resolve));}
let checks=0;const eq=(v,w,msg)=>{assert.equal(v,w,msg);checks++;};
{
 const off=scenario();await flush();
 eq(off.history[0],'/nal/commerce/pass/','wipe receipt fragment before any async work');
 eq(off.ctx.location.hash,'','no secret in address bar');
 eq(off.calls.length,1,'OFF only reads public release gate');
 eq(off.calls[0].url,'/nal/data/commerce-pass.release.json','OFF no buyer API');
 eq(off.el('#np-verify').hidden,true,'no fake pass confirmation');
 eq(off.el('#np-pass-details').hidden,true,'no exposed attendee record');
 eq(off.el('#np-resend').disabled,true,'resend OFF');
 eq(off.ctx.NALPassPage.approved(release),false,'release must reject');
}
for(const key of [
 'uiEnabled','serverReady','passClaimReviewed','guestProofReviewed',
 'providerSettlementReviewed','programSaleApproved',
 'programClaimPageApproved','buyerPrivacyApproved','productionApproved'
]){
 const x=scenario({approval:{...gate,[key]:false}});await flush();
 eq(x.calls.length,1,'missing gate blocks API: '+key);
 eq(x.el('#np-pass-details').hidden,true,'no private data for '+key);
}
{
 const x=scenario({approval:gate,backendReady:false});await flush();
 eq(x.el('#np-pass-details').hidden,true,'backend not connected never confirms');
 eq(x.calls.filter(c=>c.url.includes('functions/v1')).length,0,'no HTTP if backend not configured');
}
{
 const x=scenario({approval:gate});await flush();
 eq(x.history.length,1,'fragment removed once');
 eq(x.el('#np-verify').hidden,false,'released proof can be inspected by action');
 eq(x.calls.filter(c=>c.url.includes('functions/v1')).length,0,'no automatic token consumption');
 await x.el('#np-verify').events.click();
 eq(x.el('#np-pass-details').hidden,false,'verified safe ticket appears');
 eq(x.el('#np-title').textContent,'가상 테스트 독서모임','server title not a fake');
 eq(x.el('#np-confirm').hidden,false,'confirmation requires deliberate action');
 await x.el('#np-confirm').events.click();
 eq(x.el('#np-state').textContent,'확인 완료','one-use token consumed only after action');
 eq(x.el('#np-ticket-status').textContent,'확인 완료','visible success');
 eq(x.el('#np-resend').disabled,false,'same-browser proof enables resend');
 await x.el('#np-resend').events.click();
 const sent=x.calls.filter(c=>c.url.includes('functions/v1')).map(c=>JSON.parse(c.body));
 eq(sent.length,3,'verify, confirm and authorized resend only');
 eq(sent[0].action,'verify','first event verify');
 eq(sent[1].action,'confirm','second event confirm');
 eq(sent[2].action,'resend','third event resend');
 eq(sent[2].claimToken,'C'.repeat(43),'only original buyer proof used');
 eq(x.el('#np-resend-status').textContent.includes('접수되었습니다'),true,'resend generic outcome');
}
{
 const x=scenario({approval:gate,withProof:false});await flush();
 eq(x.el('#np-resend').disabled,true,'without original buyer proof resend remains locked');
}
assert(!/innerHTML|document\.write|localStorage/.test(source),'no unsafe HTML or persistent bearer storage');checks++;
console.log('NAL P7-E guest pass browser VM PASS: '+checks+
 ' checks, URL token wiped, no fake status, OFF blocks API, verified actions and proof-gated resend');
