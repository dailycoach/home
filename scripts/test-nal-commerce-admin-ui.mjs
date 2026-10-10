import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source=await readFile('nal/assets/js/nal-commerce-admin.js','utf8');
const original=JSON.parse(await readFile('nal/data/commerce-admin.release.json','utf8'));
const approval={...original,uiEnabled:true,ownerAuthReviewed:true,serverGateConfigured:true,
 privacyNoticeApproved:true,writePermissionsReviewed:true,backendDeployed:true,productionApproved:true};
const views=['overview','catalog','programs','bookings','orders','delivery'];
const detail='22222222-2222-4222-8222-222222222222';
class Element{
 constructor(tag='div'){
  this.tagName=tag.toUpperCase();this.dataset={};this.attributes={};this.children=[];this.events={};
  this.hidden=true;this.textContent='';this.value='';this.disabled=false;this.style={};
 }
 append(...els){this.children.push(...els);}
 replaceChildren(...els){this.children=[...els];}
 addEventListener(key,fn){this.events[key]=fn;}
 setAttribute(key,value){this.attributes[key]=value;}
 removeAttribute(key){delete this.attributes[key];}
 scrollIntoView(){}
}
function fake({gate=original,bridge=null,rejectGate=false}={}){
 const calls=[],elements=new Map();
 const get=name=>{if(!elements.has(name))elements.set(name,new Element());return elements.get(name);};
 const tabs=views.map(v=>{const e=get('tab-'+v);e.dataset.adminNav=v;return e;});
 get('#na-private').hidden=true;
 const doc={
  readyState:'complete',
  querySelector:get,
  querySelectorAll:q=>q==='[data-admin-nav]'?tabs:q==='[data-metric]'?
   ['totalOrders','paidOrders','pendingOrders','refundReviews','grossWon','activePrograms'].map(x=>get('metric-'+x)):[],
  createElement:tag=>new Element(tag)
 };
 const context={document:doc,globalThis:null,fetch:async(url,options)=>{
  calls.push({url,options});
  if(rejectGate)throw Error('unavailable');
  if(url!=='/nal/data/commerce-admin.release.json')throw Error('Unexpected backend access');
  return {ok:true,headers:{get:()=> 'application/json'},json:async()=>gate};
 },AbortSignal,Date,Intl,console};
 if(bridge)context.NALCommerceAdminBridge=bridge;
 context.globalThis=context;
 vm.runInNewContext(source,context,{timeout:1500});
 return {context,elements,get,calls,tabs};
}
async function tick(){for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));}
let checks=0;
{
 const env=fake();
 await tick();
 assert.deepEqual(env.calls.map(x=>x.url),['/nal/data/commerce-admin.release.json']);
 assert.equal(env.get('#na-private').hidden,true);
 assert.match(env.get('#na-message').textContent,/연결되지 않았습니다/);
 assert.equal(env.get('#na-access-label').textContent,'');
 assert.equal(env.context.NALCommerceAdmin.approved(original),false);
 assert.equal(env.context.NALCommerceAdmin.approved(approval),true);
 checks+=5;
}
{
 const env=fake({gate:approval});
 await tick();
 assert.equal(env.get('#na-private').hidden,true);
 assert.match(env.get('#na-message').textContent,/보안 인증 경계/);
 assert.equal(env.calls.length,1);
 checks+=3;
}
for(const prop of ['uiEnabled','ownerAuthReviewed','serverGateConfigured',
 'privacyNoticeApproved','writePermissionsReviewed','backendDeployed','productionApproved']){
 const env=fake({gate:{...approval,[prop]:false},bridge:{request:async()=>{throw Error('Must not call');}}});
 await tick();
 assert.equal(env.get('#na-private').hidden,true,prop);
 assert.equal(env.calls.length,1,prop);
 checks++;
}
{
 const env=fake({rejectGate:true,bridge:{request:async()=>{throw Error('Must not call');}}});
 await tick();
 assert.equal(env.get('#na-private').hidden,true);
 assert.match(env.get('#na-message').textContent,/접근하지 않습니다/);
 checks+=2;
}
const mocked={
 overview:{totalOrders:5,paidOrders:2,pendingOrders:1,refundReviews:1,grossWon:24800,activePrograms:0},
 'catalog-list':{items:[{id:'ebook-draft',title:'합성 테스트 PDF',kind:'pdf',priceWon:4900,saleStatus:'draft',
 revision:0,version:'v1'}],total:1,offset:0},
 'program-list':{items:[],total:0,offset:0},
 'orders-list':{items:[{id:detail,productTitle:'합성 주문',
 kind:'pdf',amountWon:4900,state:'pending',contactMasked:'t***@example.invalid'}],total:1,offset:0},
 'bookings-list':{items:[],total:0,offset:0},
 'delivery-list':{items:[],total:0,offset:0}
};
{
 const called=[];
 const env=fake({gate:approval,bridge:{request:async(action,payload)=>{
  called.push({action,payload});return {data:mocked[action]??{}};
 }}});
 await tick();
 assert.equal(env.get('#na-private').hidden,false);
 assert.equal(called[0].action,'overview');
 assert.match(env.get('#na-message').textContent,/최신 자료/);
 for(const tab of ['catalog','programs','bookings','orders','delivery']){
  const button=env.tabs.find(x=>x.dataset.adminNav===tab);
  assert.equal(typeof button.events.click,'function','navigation must exist: '+tab);
  button.events.click();await tick();
  const expected={catalog:'catalog-list',programs:'program-list',bookings:'bookings-list',
   orders:'orders-list',delivery:'delivery-list'}[tab];
  assert(called.some(x=>x.action===expected),'expected real bridge request '+expected);
  assert.equal(env.get('#na-private').hidden,false);
  checks+=3;
 }
 checks+=3;
}
assert(!/\binnerHTML\b/.test(source),'admin source should use textContent instead of raw HTML');
assert(!/\blocalStorage\b/.test(source),'admin must not persist privileged session');
assert(!/service_role|SUPABASE_SERVICE_ROLE_KEY/.test(source),'no privileged API keys in browser');
checks+=3;
console.log('NAL COMMERCE ADMIN browser default-OFF & authorized bridge simulation PASS: '+checks+' checks, no actual owner login/PG/API calls');
