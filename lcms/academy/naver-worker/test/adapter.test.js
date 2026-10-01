import test from 'node:test';
import assert from 'node:assert/strict';
import { NaverAdapter, clientSecretSign, kst } from '../src/naver.js';
import { fixture, setup } from './helpers.js';
const sampleSalt='$2a$10$abcdefghijklmnopqrstuv'; // Public NAVER documentation vector, not a credential.
const config={NAVER_COMMERCE_CLIENT_ID:'aaaabbbbcccc',NAVER_COMMERCE_CLIENT_SECRET:sampleSalt,NAVER_EGRESS_VERIFIED:'true'};
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers});
const token=()=>json({access_token:'synthetic-token',expires_in:10800});

test('official bcrypt/Base64 vector and KST date formatting',async()=>{
  assert.equal(await clientSecretSign('aaaabbbbcccc',sampleSalt,1643961623299),'JDJhJDEwJGFiY2RlZmdoaWprbG1ub3BxcnN0dXVCVldZSk42T0VPdEx1OFY0cDQxa2IuTnpVaUEzbmsy');
  assert.equal(kst(Date.parse('2026-09-22T00:00:00Z')),'2026-09-22T09:00:00.000+09:00');
});

test('K: 401/GW.AUTHN renews once; form payload excludes raw secret and tokens are cached',async()=>{
  let tokenCount=0,detailCount=0;
  const adapter=new NaverAdapter(config,{sleep:async()=>{},fetcher:async(url,opts)=>{
    if(url.endsWith('/token')) {tokenCount++;const form=new URLSearchParams(opts.body);assert.equal(form.get('grant_type'),'client_credentials');assert(!opts.body.toString().includes(sampleSalt));assert(!url.includes('client_id'));return token();}
    detailCount++;return detailCount===1?json({code:'GW.AUTHN'},401):json({data:[fixture()]});
  }});
  await adapter.details(['202609220000001']);await adapter.details(['202609220000001']);assert.equal(tokenCount,2);assert.equal(detailCount,3);
});

test('repeated 401 is bounded, other 401 and 403 never refresh',async()=>{
  for(const [status,code,count] of [[401,'GW.AUTHN',2],[401,'OTHER',1],[403,'FORBIDDEN',1]]) {
    let tokens=0,calls=0;const adapter=new NaverAdapter(config,{fetcher:async url=>url.endsWith('/token')?(tokens++,token()):(calls++,json({code},status)),sleep:async()=>{}});
    await assert.rejects(()=>adapter.details(['202609220000001']),/AUTH_ERROR/);assert.equal(tokens,count);assert.equal(calls,count);
  }
});

test('L: 500, 429 and network failures have bounded backoff; 400 is not retried',async()=>{
  for(const [status,expected,count] of [[500,'NAVER_5XX',3],[429,'RATE_LIMIT',3],[400,'INVALID_ORDER',1],[0,'NETWORK_ERROR',3]]) {
    let calls=0,waits=0;const adapter=new NaverAdapter(config,{fetcher:async url=>{if(url.endsWith('/token'))return token();calls++;if(!status)throw new Error('private provider detail');return json({},status);},sleep:async()=>{waits++;}});
    await assert.rejects(()=>adapter.details(['202609220000001']),new RegExp(expected));assert.equal(calls,count);assert.equal(waits,count-1);
  }
});

test('300-order batching, strict partial-response rejection and quantity claim compatibility',async()=>{
  const lengths=[],ids=Array.from({length:601},(_,i)=>String(202609220000000+i));
  const adapter=new NaverAdapter(config,{fetcher:async(url,opts)=>{if(url.endsWith('/token'))return token();const body=JSON.parse(opts.body);lengths.push(body.productOrderIds.length);assert.equal(body.quantityClaimCompatibility,true);return json({data:body.productOrderIds.map(id=>fixture('PAYED',id))});}});
  assert.equal((await adapter.details(ids)).length,601);assert.deepEqual(lengths,[300,300,1]);
  adapter.fetcher=async()=>json({data:[]});await assert.rejects(()=>adapter.details([ids[0]]),/PARTIAL_RESPONSE/);
});

test('changed page uses official more fields and preserves fixed end',async()=>{
  const adapter=new NaverAdapter(config,{fetcher:async url=>{if(url.endsWith('/token'))return token();const parsed=new URL(url);assert.equal(parsed.searchParams.get('moreSequence'),'4');assert.equal(parsed.searchParams.get('lastChangedTo'),'2026-09-22T10:00:00.000+09:00');return json({data:{count:1,lastChangeStatuses:[{productOrderId:'202609220000001'}],more:{moreFrom:'2026-09-22T09:30:00+09:00',moreSequence:'5'}}});}});
  const result=await adapter.changes({from:'2026-09-22T00:00:00Z',to:'2026-09-22T01:00:00Z',sequence:'4'});assert.equal(result.more.sequence,'5');
});

test('token expiration follows expires_in; SELLER needs account_id; live egress requires verification',async()=>{
  let now=0,calls=0;const adapter=new NaverAdapter(config,{now:()=>now,fetcher:async()=>{calls++;return token();}});
  await adapter.token();now=1000;await adapter.token();assert.equal(calls,1);now=10800000;await adapter.token();assert.equal(calls,2);
  await assert.rejects(()=>new NaverAdapter({...config,NAVER_TOKEN_TYPE:'SELLER'}).token(),/AUTH_CONFIG/);
  await assert.rejects(()=>new NaverAdapter({...config,NAVER_EGRESS_VERIFIED:'false'}).token(),/EXTERNAL_AUTH_REQUIRED/);
});

test('stalled cursors are rejected without checkpoint advancement',async()=>{
  const s=setup();s.service.now=()=>Date.parse('2026-09-22T12:00:00Z');
  const cursor={from:'2026-09-22T00:00:00Z',to:'2026-09-22T11:00:00Z',sequence:'same'};
  await s.storage.put('sync:cursor',cursor);
  s.adapter.changes=async()=>({ids:[],more:{from:cursor.from,sequence:cursor.sequence}});
  await assert.rejects(()=>s.service.sync(),/STALLED/);assert.deepEqual(await s.storage.get('sync:cursor'),cursor);
});
