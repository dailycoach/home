import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture, setup, registration, student, MemoryStorage } from './helpers.js';
import { normalizeOrder, COURSE_ID } from '../src/domain.js';
import { IntegrationService } from '../src/service.js';
import { hmac, digest } from '../src/security.js';
import r2Worker from '../../r2-worker/src/index.js';

test('A/B/I: 100 concurrent deliveries/registrations create one student, one code, one initial email',async()=>{
  const s=setup(), r=await registration(s);
  const results=await Promise.all(Array.from({length:100},()=>r.complete()));
  assert(results.every(x=>x.state==='ACTIVE'));
  assert.equal(s.gas.sheets.get('수강생').getLastRow(),3);assert.equal(s.gas.issueCount,1);assert.equal(s.gas.mail.length,1);assert.equal(s.gas.locked,false);
  for(let i=0;i<100;i++) await s.service.exclusive(()=>s.service.observe(normalizeOrder(fixture())));
  assert.equal(s.gas.issueCount,1);assert.equal(s.gas.mail.length,1);
  const serialized=JSON.stringify([...s.storage.map]);
  assert(!serialized.includes(student.email));assert(!serialized.includes(student.studentName));assert(!serialized.includes('01000000000'));assert(!serialized.includes(r.token));
  const code=s.gas.mail[0].body.match(/입장코드: ([A-Z0-9]{8})/)[1];
  assert(!JSON.stringify(s.gas.sheets.get('수강생').rows).includes(code));
});

for (const [label,status,extra,want] of [
  ['C','PAYED',{productId:'OTHER'},'IGNORED'],['D','PAYMENT_WAITING',{},'NAVER_DETECTED'],
  ['E','CANCELED',{},'CANCELED'],['F','RETURNED',{},'RETURNED'],['G','CANCELED_BY_NOPAYMENT',{},'CANCELED_BY_NOPAYMENT'],
  ['P','PAYED',{quantity:2},'MANUAL_REVIEW'],['exchange','EXCHANGED',{},'MANUAL_REVIEW'],
  ['claim','PAYED',{claimStatus:'CANCEL_REQUEST'},'MANUAL_REVIEW'],['gift','PAYED',{giftReceivingStatus:'WAIT_FOR_RECEIVING'},'MANUAL_REVIEW'],
  ['unknown','UNRECOGNIZED',{},'MANUAL_REVIEW']
]) test(`${label}: ${status} ${JSON.stringify(extra)} cannot provision`,async()=>{
  const detail=fixture(status,undefined,extra),s=setup([detail]);
  assert.equal((await s.service.observe(normalizeOrder(detail))).state,want);
  await assert.rejects(()=>registration(s),/ORDER_VERIFICATION_FAILED/);assert.equal(s.gas.issueCount,0);
});

test('H/C7: real GS provisioning → MailApp capture → login → actual R2 authorize; cancellation revokes code/session',async()=>{
  const s=setup(), r=await registration(s);await r.complete();
  const ctx=s.gas.context,code=s.gas.mail[0].body.match(/입장코드: ([A-Z0-9]{8})/)[1];
  const login=ctx.loginResponse_({email:student.email,code,courseId:COURSE_ID,ua:'LMC-test'});
  assert(login.token);assert.equal(ctx.validateResponse_({token:login.token,courseId:COURSE_ID,ua:'LMC-test'}).studentId,login.studentId);
  const oldFetch=globalThis.fetch;
  globalThis.fetch=s.gas.fetcher;
  try {
    const request=()=>new Request('https://r2.example.test/authorize',{method:'POST',headers:{Origin:'https://daily-coach-ing.com','Content-Type':'application/json','User-Agent':'LMC-test'},body:JSON.stringify({token:login.token,courseId:COURSE_ID,week:1,part:1})});
    const env={COURSE_ID,ACCESS_API_URL:'https://script.google.com/macros/s/mock-only/exec',ACCESS_API_SECRET:s.gas.props.get('WORKER_SHARED_SECRET'),PLAYBACK_SECRET:randomUUID()+randomUUID()};
    assert.equal((await r2Worker.fetch(request(),env)).status,200);
    s.adapter.orders.set('202609220000001',normalizeOrder(fixture('CANCELED')));
    await s.service.observe(normalizeOrder(fixture('CANCELED')));
    assert.equal((await r2Worker.fetch(request(),env)).status,401);
    assert.throws(()=>ctx.loginResponse_({email:student.email,code,courseId:COURSE_ID,ua:'LMC-test'}));
    assert.equal(s.gas.sheets.get('세션').rows[2][7],'종료');
    assert.equal(s.gas.sheets.get('수강생').rows[2][13],'');
    await s.service.observe(normalizeOrder(fixture('PAYED')));
    assert.equal((await s.service.store.get('202609220000001')).state,'SUSPENDED');
  } finally {globalThis.fetch=oldFetch;}
});

for(const status of ['RETURNED','CANCELED_BY_NOPAYMENT']) test(`${status} after issuance revokes active access`,async()=>{
  const s=setup();await(await registration(s)).complete();await s.service.observe(normalizeOrder(fixture(status)));
  assert.equal(s.gas.sheets.get('수강생').rows[2][16],'정지');assert.equal(s.gas.sheets.get('수강생').rows[2][13],'');
});

for(const mode of ['failMail','failAfterMail']) test(`J: ${mode} is quarantined without a second code or automatic send`,async()=>{
  const s=setup();s.gas.state[mode]=true;const r=await registration(s);
  assert.equal((await r.complete()).state,'MANUAL_REVIEW');
  for(let i=0;i<100;i++) await s.bridge.call('naverRegister',{productOrderId:'202609220000001',courseId:COURSE_ID,naverStatus:'PAYED',quantity:1,consentVersion:'lmc-registration-v1',...student});
  assert.equal(s.gas.issueCount,1);assert.equal(s.gas.mail.length,mode==='failMail'?0:1);
});

test('M: GAS commits but response times out; repeat and reconciliation do not issue again',async()=>{
  const s=setup(),r=await registration(s),original=s.bridge.fetcher;
  s.bridge.fetcher=async(...args)=>{await original(...args);throw new Error('MOCK_TIMEOUT');};
  await assert.rejects(r.complete,/APPS_SCRIPT_TIMEOUT/);assert.equal(s.gas.mail.length,1);
  s.bridge.fetcher=original;await s.service.reconcile('202609220000001');await r.complete();
  assert.equal(s.gas.issueCount,1);assert.equal(s.gas.mail.length,1);
});

test('N/O: invalid, expired, wrong-client and changed-payload registration sessions fail',async()=>{
  const s=setup(),r=await registration(s);
  await assert.rejects(()=>s.service.register({...student,token:'bad'},'192.0.2.1'),/SESSION_INVALID/);
  await assert.rejects(()=>s.service.register({...student,token:r.token},'192.0.2.2'),/SESSION_INVALID/);
  await r.complete();
  await assert.rejects(()=>s.service.register({...student,email:'other@example.test',token:r.token},'192.0.2.1'),/ALREADY_CLAIMED/);
  s.service.now=()=>Date.now()+901000;
  await assert.rejects(r.complete,/SESSION_INVALID/);
});

test('cancel between verification and registration blocks issuance',async()=>{
  const s=setup(),r=await registration(s);s.adapter.orders.set('202609220000001',normalizeOrder(fixture('CANCELED')));
  await assert.rejects(r.complete,/VERIFICATION_FAILED/);assert.equal(s.gas.issueCount,0);
});

test('name AND full phone required; masked buyers denied; per-order rate limit survives service recreation',async()=>{
  const s=setup();
  for(let i=0;i<5;i++) await assert.rejects(()=>s.service.verify({productOrderId:'202609220000001',buyerName:'wrong',buyerPhone:'01000000000'},'192.0.2.'+i),/VERIFICATION_FAILED/);
  const restarted=new IntegrationService(s.storage,s.adapter,s.bridge,s.env);
  await assert.rejects(()=>restarted.verify({productOrderId:'202609220000001',buyerName:'테스트 주문자',buyerPhone:'01000000000'},'192.0.2.99'),/RATE_LIMIT/);
  const masked=fixture();masked.order.ordererTel='010****0000';
  assert.equal((await setup([masked]).service.observe(normalizeOrder(masked))).state,'MANUAL_REVIEW');
});

test('GAS HMAC rejects bad signature, stale timestamp, mutated body and missing flags',async()=>{
  const s=setup(),action='naverRegister',timestamp=Date.now(),body=JSON.stringify({productOrderId:'202609220000001',courseId:COURSE_ID});
  const signature=await hmac(`${action}\n${timestamp}\n${body}`,s.env.APPS_SCRIPT_SHARED_SECRET);
  for(const envelope of [{action,timestamp,body,signature:'bad'},{action,timestamp:timestamp-400000,body,signature},{action,timestamp,body:body+' ',signature}]) assert.equal(s.gas.context.naverIntegrationResponse_(envelope).ok,false);
  s.gas.props.set('NAVER_AUTO_PROVISION_ENABLED','false');const r=await registration(s);await assert.rejects(r.complete,/APPS_SCRIPT_ERROR/);assert.equal(s.gas.issueCount,0);
});

test('DRY_RUN records orders but blocks registrations, suspensions and admin reissue',async()=>{
  const s=setup();s.env.DRY_RUN='true';await s.service.observe(normalizeOrder(fixture()));
  await assert.rejects(()=>registration(s),/NOT_OPEN/);
  await s.service.observe(normalizeOrder(fixture('CANCELED')));
  assert.equal(s.gas.sheets.get('네이버연동').getLastRow(),2);
  await assert.rejects(()=>s.service.admin('reissue',{productOrderId:'202609220000001'}),/DISABLED/);
});

test('admin reissue dedupes operation id, retains 180-day expiry, cannot revive suspended enrollment',async()=>{
  const s=setup();await(await registration(s)).complete();const expiry=s.gas.sheets.get('수강생').rows[2][15].getTime();
  const body={productOrderId:'202609220000001',operationId:randomUUID()};
  await s.service.admin('reissue',body);await s.service.admin('reissue',body);
  assert.equal(s.gas.issueCount,2);assert.equal(s.gas.mail.length,2);assert.equal(s.gas.sheets.get('수강생').rows[2][15].getTime(),expiry);
  await s.service.admin('suspend',body);
  await assert.rejects(()=>s.service.admin('reissue',{...body,operationId:randomUUID()}));
  assert.equal(s.gas.issueCount,2);
});

test('GAS crash after durable ATTEMPTED marker does not regenerate on recovery',async()=>{
  const s=setup();const original=s.gas.context.provisionStudentRow_;
  s.gas.context.provisionStudentRow_=()=>{throw new Error('MOCK_CRASH_BEFORE_CODE');};
  assert.equal((await(await registration(s)).complete()).state,'MANUAL_REVIEW');
  s.gas.context.provisionStudentRow_=original;
  const result=await s.bridge.call('naverRegister',{productOrderId:'202609220000001',courseId:COURSE_ID,naverStatus:'PAYED',quantity:1,consentVersion:'lmc-registration-v1',...student});
  assert.equal(result.state,'MANUAL_REVIEW');assert.equal(s.gas.issueCount,0);
});

test('retention clears only expired new registration contacts, preserving ledger and live course',async()=>{
  const s=setup();await(await registration(s)).complete();const sheet=s.gas.sheets.get('수강생');
  sheet.rows.push([...sheet.rows[2]]);sheet.rows[3][0]='LEGACY';sheet.rows[3][9]='동의';
  sheet.rows[2][15]=new Date(Date.now()-31*86400000);s.gas.context.purgeNaverContactData();
  assert.equal(sheet.rows[2][7],'');assert.equal(sheet.rows[2][8],'');assert.equal(sheet.rows[3][7],student.email);assert.equal(sheet.rows[2][3],'202609220000001');
});

test('durable cursor resumes page after restart; does not checkpoint a failed detail page',async()=>{
  const s=setup();s.service.now=()=>Date.parse('2026-09-22T12:00:00Z');
  let calls=0,detailCalls=0;
  s.adapter.changes=async cursor=>{calls++;return calls===1?{ids:['202609220000001'],more:{from:'2026-09-22T01:00:00Z',sequence:'2'}}:{ids:['202609220000001'],more:null};};
  const details=s.adapter.details.bind(s.adapter);s.adapter.details=async ids=>{detailCalls++;if(detailCalls===2)throw new Error('MOCK_FAILURE');return details(ids);};
  await assert.rejects(()=>s.service.sync(),/MOCK_FAILURE/);
  const saved=await s.storage.get('sync:cursor');assert.equal(saved.sequence,'2');assert.equal(saved.from,'2026-09-22T01:00:00Z');
  const restart=new IntegrationService(s.storage,s.adapter,s.bridge,s.env,()=>Date.parse('2026-09-22T12:00:00Z'));
  const result=await restart.sync();assert.equal(result.pages,1);assert.equal((await s.storage.get('sync:cursor')).sequence,null);
  assert.equal(s.gas.issueCount,0);
});

test('bounded cancellation recovery survives toggle and upstream outage',async()=>{
  const s=setup();await(await registration(s)).complete();s.env.NAVER_AUTO_SUSPEND_ENABLED='false';
  await s.service.observe(normalizeOrder(fixture('RETURNED')));assert.equal(s.gas.sheets.get('수강생').rows[2][16],'활성');
  s.env.NAVER_AUTO_SUSPEND_ENABLED='true';await s.service.drainPending();assert.equal(s.gas.sheets.get('수강생').rows[2][16],'정지');
});

test('legacy Google Form and Naver registration share one canonical row',async()=>{
  const s=setup(),answers=[['스마트스토어 상품주문번호를 입력해 주세요.','202609220000001'],['스마트스토어 주문자명을 입력해 주세요.','테스트 주문자'],['수강생 성함을 입력해 주세요.',student.studentName],['입장코드를 받을 이메일을 입력해 주세요.',student.email],['휴대전화 번호를 입력해 주세요.',student.phone],['개인정보 수집·이용에 동의합니다.','동의합니다']];
  const event={response:{getTimestamp:()=>new Date(),getItemResponses:()=>answers.map(([title,value])=>({getItem:()=>({getTitle:()=>title}),getResponse:()=>value}))}};
  s.gas.context.handleFormSubmit(event);assert.equal(s.gas.sheets.get('수강생').rows[2][10],'결제대기');
  await(await registration(s)).complete();s.gas.context.handleFormSubmit(event);
  assert.equal(s.gas.sheets.get('수강생').getLastRow(),3);assert.equal(s.gas.issueCount,1);
  assert.equal(s.gas.sheets.get('수강생').rows[2][9],'동의');
});

test('new bridge logs mask order numbers and omit learner email and provider errors',async()=>{
  const s=setup();s.gas.state.failMail=true;await(await registration(s)).complete();
  const logs=JSON.stringify(s.gas.sheets.get('발송로그').rows);
  assert(!logs.includes(student.email));assert(!logs.includes('202609220000001'));assert(!logs.includes('MOCK_MAIL_FAILURE'));
});

test('cancellation retry stops after five failures and requires explicit operator retry',async()=>{
  const s=setup();await(await registration(s)).complete();let calls=0,now=Date.now();s.service.now=()=>now;
  s.bridge.fetcher=async()=>{calls++;throw new Error('MOCK_DOWN');};
  for(let i=0;i<20;i++) {await s.service.observe(normalizeOrder(fixture('CANCELED')));now+=3600001;}
  assert.equal(calls,5);assert.equal((await s.storage.get('deadletter:202609220000001')).attempts,5);
  await s.service.admin('resync',{productOrderId:'202609220000001'});assert.equal(calls,6);
});

test('missing mapping, masked buyer and changed buyer info never auto-claim',async()=>{
  const s=setup(),r=await registration(s);
  s.adapter.orders.get('202609220000001').buyerPhone='01011111111';await assert.rejects(r.complete,/VERIFICATION_FAILED/);
  s.env.PRODUCT_MAPPING_VERIFIED='false';await assert.rejects(()=>registration(s),/NOT_OPEN/);assert.equal(s.gas.issueCount,0);
});

test('canary permits only the chosen order; suspension OFF closes new registration',async()=>{
  const s=setup();s.env.REGISTRATION_MODE='canary';s.env.CANARY_ORDER_HASHES='[]';
  await assert.rejects(()=>registration(s),/NOT_OPEN/);
  s.env.CANARY_ORDER_HASHES=JSON.stringify([await digest('202609220000001')]);
  const r=await registration(s);s.env.NAVER_AUTO_SUSPEND_ENABLED='false';await assert.rejects(r.complete,/NOT_OPEN/);
  s.env.NAVER_AUTO_SUSPEND_ENABLED='true';assert.equal((await r.complete()).state,'ACTIVE');
});
