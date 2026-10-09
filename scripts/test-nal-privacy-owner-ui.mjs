import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile('nal/assets/js/read-privacy-review.js','utf8');
const initialGate = JSON.parse(await readFile('nal/data/read-privacy-review.release.json','utf8'));

class FakeElement {
  constructor(tag = 'div', value = '', cls = '') {
    this.tag=tag;this.textContent=value;this.className=cls;
    this.children=[];this.dataset={};this.hidden=false;this.isConnected=true;
  }
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
  setAttribute(){}
  addEventListener(){}
}

async function simulate({gate=initialGate,mime='application/json',status=200,networkError=false,user=true,role='staff'}={}) {
  const events = [],root=new FakeElement(),statusText = [];
  const account = {
    user:user?{id:'00000000-0000-4000-8000-000000000001'}:null,
    epoch:0,
    ready:Promise.resolve(true),
    onChange:()=>()=>{},
    node:(tag,text='',cls='')=>new FakeElement(tag,text,cls),
    status:(...args)=>statusText.push(args),
    call:async(...args)=>{events.push(['operator-home',...args]);return {role};},
    privacyReview:async(...args)=>{events.push(['privacyReview',...args]);return {requests:[]};},
    date:()=> 'sample'
  };
  const ctx={
    window:{NalAccount:account},
    document:{querySelector:selector=>selector==='[data-account-private]'?root:null},
    fetch:async(url,options)=>{
      events.push(['fetch',url,options?.cache,options?.redirect]);
      if(networkError)throw new Error('simulated blocked network');
      return {ok:status===200,status,headers:{get:()=>mime},json:async()=>structuredClone(gate)};
    },
    AbortSignal,URL,console
  };
  vm.runInNewContext(source,ctx,{timeout:2000});
  for(let n=0;n<8;n++)await new Promise(resolve=>setImmediate(resolve));
  return {events,root,statusText};
}

const approvalKeys=['uiEnabled','ownerAuthBindingReviewed','independentServerGateConfigured','approvedPrivacyNotice','backendDeployed'];
const fullApproval={...initialGate,destructiveApiExposed:false};
for(const key of approvalKeys)fullApproval[key]=true;
const verifyNoPrivilegedCalls = ({events}, label) => {
  assert(!events.some(row=>row[0]==='privacyReview'||row[0]==='operator-home'),
    `Privileged call unexpectedly reached by ${label}: ${JSON.stringify(events)}`);
};

verifyNoPrivilegedCalls(await simulate(), 'currently released OFF manifest');
let scenarios=1;
for(const missing of approvalKeys) {
  const gate={...fullApproval,[missing]:false};
  verifyNoPrivilegedCalls(await simulate({gate}), `missing ${missing}`);
  scenarios++;
}
for (const [label,params] of [
  ['destructive flag true',{gate:{...fullApproval,destructiveApiExposed:true}}],
  ['extra destructive action',{gate:{...fullApproval,actions:[...fullApproval.actions,'execute-journal']}}],
  ['untrusted content type',{gate:fullApproval,mime:'text/html'}],
  ['unavailable gate manifest',{gate:fullApproval,status:503}],
  ['network fails closed',{gate:fullApproval,networkError:true}]
]) {
  verifyNoPrivilegedCalls(await simulate(params), label);
  scenarios++;
}
const anonymous=await simulate({gate:fullApproval,user:false});
assert.equal(anonymous.events.length,0,'Logged out caller must not even fetch owner release manifest');
scenarios++;
const staff=await simulate({gate:fullApproval,role:'staff'});
assert(staff.events.some(x=>x[0]==='operator-home'), 'approved test gate should request role check');
assert(!staff.events.some(x=>x[0]==='privacyReview'), 'staff must not request privacy queue');
scenarios++;
const owner=await simulate({gate:fullApproval,role:'owner'});
assert(owner.events.some(x=>x[0]==='operator-home'),'owner test requires role check');
assert(owner.events.some(x=>x[0]==='privacyReview'&&x[1]==='queue'),'mock owner should only load queue');
assert(!owner.events.some(x=>x[0]==='privacyReview'&&['approve-journal','execute-journal'].includes(x[1])),
  'no destructive client action');
scenarios++;
console.log(`NAL P4 browser owner gate simulation PASS: ${scenarios} disabled, untrusted, staff and mock-owner scenarios; zero real requests`);
