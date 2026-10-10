import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const code=await readFile('nal/assets/js/nal-commerce-lite.js','utf8');
const source=JSON.parse(await readFile('nal/data/products.json','utf8'));
const release=JSON.parse(await readFile('nal/data/commerce-lite.release.json','utf8'));
const fullRelease={
  ...release,clientEnabled:true,serverReady:true,pgConfigured:true,
  approvedPrivacyNotice:true,approvedTermsAndRefunds:true,
  settlementGuardReviewed:true,fulfillmentReady:true,emailReceiptReady:true,
  customerReleaseApproved:true,provider:'synthetic-provider',
  minimumAmountWon:100,allowedCheckoutOrigins:['https://pay.example.invalid']
};
class FakeElement {
  constructor(tag='div'){
    this.tag=tag;this.children=[];this.dataset={};this.hidden=false;this.textContent='';
    this.className='';this.attributes={};this.events={};this.disabled=false;
  }
  append(child){this.children.push(child);}
  replaceChildren(...children){this.children=[...children];}
  setAttribute(name,value){this.attributes[name]=value;}
  addEventListener(name,listener){this.events[name]=listener;}
}
function ctx({page=null,hash='',released=release}={}){
  const events=[],elements=new Map();
  const el=(key)=>{if(!elements.has(key))elements.set(key,new FakeElement());return elements.get(key);};
  let changedUrl=null;
  const context={
    URL,URLSearchParams,Intl,AbortSignal,Date,console,
    location:{origin:'https://daily-coach-ing.com',search:'',pathname:'/nal/commerce/'+(page==='claim'?'claim/':''),
      hash,assign:()=>{events.push('nav');}},
    history:{replaceState:(_x,_y,value)=>{changedUrl=value;events.push('history');}},
    sessionStorage:{getItem:()=>null,setItem:()=>events.push('session'),removeItem:()=>events.push('clear')},
    fetch:async (url)=>{
      events.push(String(url));
      if(url==='/nal/data/commerce-lite.release.json')return {ok:true,json:async()=>released};
      if(url==='/nal/data/products.json')return {ok:true,json:async()=>source};
      throw Error('Unexpected network call: '+url);
    },
    crypto:{randomUUID:()=> '22222222-2222-4222-8222-222222222222'},
    document:page?{
      readyState:'complete',body:{dataset:{commercePage:page}},
      querySelector:el,createElement:(tag)=>new FakeElement(tag)
    }:undefined
  };
  vm.runInNewContext(code,context,{timeout:2000});
  return {ctx:context,events,elements,changed:()=>changedUrl};
}
let cases=0;
{
 const x=ctx();
 const c=x.ctx.NALCommerceLite;
 assert.equal(c.canRelease(release),false);
 assert.equal(c.canRelease(fullRelease),true);
 cases+=2;
 for(const key of ['clientEnabled','serverReady','pgConfigured','approvedPrivacyNotice','approvedTermsAndRefunds',
 'settlementGuardReviewed','fulfillmentReady','emailReceiptReady','customerReleaseApproved']){
  assert.equal(c.canRelease({...fullRelease,[key]:false}),false,key);
  cases++;
 }
 const p=source.products.find(x=>x.id==='nal-small-book-01-mind-reset');
 assert.equal(c.safeFreeLink(p),p.purchaseUrl);cases++;
 assert.equal(c.safeFreeLink({...p,price:100}),null);cases++;
 assert.equal(c.safeFreeLink({...p,purchaseUrl:'https://attacker.invalid/free.pdf'}),null);cases++;
 const paid=source.products.find(x=>x.id==='dailycoaching-awareness-1000');
 assert.equal(c.validProduct(paid,fullRelease),false,'comingSoon must not be purchasable');cases++;
 assert.equal(c.validProduct({...paid,stockStatus:'available'},fullRelease),true);cases++;
 assert.equal(c.safeCheckout('https://pay.example.invalid/pay/123',fullRelease),'https://pay.example.invalid/pay/123');cases++;
 for(const evil of ['http://pay.example.invalid/pay','https://attacker.invalid/pay',
 'https://pay.example.invalid@attacker.invalid/pay',
 'https://pay.example.invalid/pay/#token=foo',
 'javascript:alert(1)','//pay.example.invalid/checkout']){
  assert.equal(c.safeCheckout(evil,fullRelease),null,evil);cases++;
 }
 const selected=c.selectProducts('dailycoaching-awareness-1000',source.products);
 assert.equal(selected.paid.length,3);assert.equal(selected.free.length,3);assert.equal(selected.selected.id,'dailycoaching-awareness-1000');
 cases+=3;
}
async function settle(){for(let n=0;n<18;n++)await new Promise(resolve=>setImmediate(resolve));}
{
 const x=ctx({page:'checkout'});
 await settle();
 assert.deepEqual(x.events,['/nal/data/commerce-lite.release.json','/nal/data/products.json']);
 const button=x.elements.get('#ncl-buy');
 assert.equal(button.disabled,true);
 assert.equal(button.textContent,'판매 연결 준비 중');
 assert(x.elements.get('#ncl-products').children.length>0,'free and paid cards rendered');
 assert(!x.events.includes('/nal/data/backend.json'),'OFF gate must not read buyer backend');
 cases+=4;
}
{
 const x=ctx({page:'complete'});
 await settle();
 assert.deepEqual(x.events,['/nal/data/commerce-lite.release.json']);
 assert(!x.events.includes('session'),'OFF gate must not read buyer session proof');
 cases+=2;
}
{
 const x=ctx({page:'claim',hash:'#order=11111111-1111-4111-8111-111111111111&token=short'});
 await settle();
 assert.equal(x.changed(),'/nal/commerce/claim/');
 assert.equal(x.events.filter(y=>y.startsWith('/nal/data/')).length,1,'claim OFF must not call backend');
 assert(!x.events.some(y=>y.includes('functions/v1')),'no private token sent while feature OFF');
 cases+=3;
}
console.log('NAL COMMERCE LITE client/disabled-route simulation PASS: '+cases+' checks; no actual buyer API, no emailed token or payment');
