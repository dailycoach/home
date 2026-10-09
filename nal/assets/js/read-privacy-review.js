/* BUILD35: owner-only, fail-closed privacy review UI — source-only.
 * The backend route nal-read-privacy-admin is NOT DEPLOYED, feature gate defaults OFF.
 * Client can request queue, preview and start-review ONLY. No approve, execute or
 * erasure-toggle route, journal text rendering, local cache, fake counts or polling. */
(() => {
 'use strict';
 const A=window.NalAccount,root=document.querySelector('[data-account-private]');
 if(!A||!root)return;
 const el=A.node;
 // Frontend release interlock only; this is NOT an authorization decision.
 // No runtime call is made while the reviewed deployment manifest is absent or OFF.
 const reviewGateUrl='/nal/data/read-privacy-review.release.json';
 async function reviewUiReleased(){
  try{
   const response=await fetch(reviewGateUrl,{method:'GET',cache:'no-store',credentials:'same-origin',redirect:'error',signal:AbortSignal.timeout(8000)});
   if(!response.ok||!String(response.headers.get('content-type')||'').toLowerCase().includes('application/json'))return false;
   const gate=await response.json();
   return gate?.schemaVersion===1&&gate?.module==='nal-read-owner-privacy-review'&&
    gate?.uiEnabled===true&&gate?.ownerAuthBindingReviewed===true&&
    gate?.independentServerGateConfigured===true&&gate?.approvedPrivacyNotice===true&&
    gate?.backendDeployed===true&&gate?.destructiveApiExposed===false&&
    Array.isArray(gate.actions)&&gate.actions.length===3&&
    ['queue','preview','start-review'].every(x=>gate.actions.includes(x));
  }catch{return false;}
 }
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
 const UUID_V4=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const scopes={'read-journal':'개인 기록 검토','account-closure-review':'계정·법정 보존 검토'};
 const states={requested:'요청 접수',withdrawn:'철회됨','under-review':'범위 검토 승인됨',
  'awaiting-retention':'법정 보존 범위 검토 중',fulfilled:'해당 범위 처리 기록',declined:'처리 불가 판정'};
 const counts={answers:'답변',dayProgress:'DAY 진행',drafts:'초안',experiments:'실험',
  importantMarks:'중요 표시',reports:'리포트 보관본',preparationChecks:'시작 준비 체크',liveNotes:'개인 LIVE 메모'};
 const copies={experimentSourceSnapshots:'실험에 보관된 답변 사본',reportSnapshots:'리포트 내용 보관본',
  reportRequestBodies:'리포트 생성 요청 사본'};
 const separate={orders:'주문·거래 (별도 보존 검토)',supportThreads:'고객 문의 (별도 보존 검토)',
  enrollments:'참가 등록 (별도 처리)'};
 let generation=0,selected=null,busy=false;
 const context=()=>({generation,epoch:A.epoch,userId:A.user?.id});
 const current=c=>c.generation===generation&&c.epoch===A.epoch&&c.userId===A.user?.id&&!!c.userId;
 const section=title=>{const s=el('section','','nal-review-section');s.append(el('h2',title));return s;};
 const note=(s,content)=>s.append(el('p',content,'nal-account-note'));
 const button=(label,fn)=>{
  const b=el('button',label,'nal-account-button');b.type='button';
  b.addEventListener('click',async()=>{
   if(busy)return;busy=true;b.disabled=true;
   try{await fn();}catch(e){A.status(e?.message||'처리 결과를 확인하지 못했습니다.','error');}
   finally{busy=false;if(b.isConnected)b.disabled=false;}
  });
  return b;
 };
 function rows(parent,map,source){
  const d=el('dl','','nal-review-counts');
  for(const [k,label] of Object.entries(map)){
   const pair=el('div','','nal-review-count');
   const value=source?.[k];
   pair.append(el('dt',label),el('dd',Number.isInteger(value)&&value>=0?value.toLocaleString('ko-KR')+'건':'확인 필요'));
   d.append(pair);
  }
  parent.append(d);
 }
 function unavailable(s,error){
  const reason=error?.status===401?'로그인이 필요합니다.':
   error?.status===403?'현재 계정에는 이 검토 정보를 볼 소유자 권한이 없습니다.':
   error?.status===404||error?.status===503?
   '관리자 검토 API가 아직 연결되지 않았거나 서버에서 기능을 열지 않았습니다. 접수 0건이라는 뜻이 아닙니다.':
   '운영자 검토 기록을 확인하지 못했습니다. 자료가 없다고 표시하지 않습니다.';
  note(s,reason);
 }
 async function showRequest(row,owner){
  const ctx=context();
  if(!current(ctx)||!UUID_V4.test(row.id||''))return;
  selected=row.id;
  const detail=document.querySelector('[data-privacy-review-detail]');if(!detail)return;
  detail.replaceChildren(el('h2','요청 범위 확인'),el('p','요청 ID를 확인하고 있습니다.','nal-account-note'));
  try{
   const response=await A.privacyReview('preview',{requestId:row.id});
   if(!current(ctx)||selected!==row.id)return;
   if(response?.id!==row.id||!response?.plan||response.plan.noPersonalTextIncluded!==true||
      typeof response.plan.fingerprint!=='string'||!Object.hasOwn(response.plan,'counts'))
    throw new Error('검토 범위 응답을 확인하지 못했습니다.');
   detail.replaceChildren(el('h2','요청 범위 확인'));
   note(detail,'검토 대상: '+(scopes[response.scope]||'범위 확인')+' · '+(states[response.state]||'상태 확인'));
   note(detail,'이 화면은 기록 건수와 사본의 위치만 보여줍니다. 개인 답변 문장과 리포트 본문은 열지 않습니다.');
   const first=el('h3','개인 기록 범위');detail.append(first);rows(detail,counts,response.plan.counts);
   detail.append(el('h3','중복 저장된 개인 문장'));rows(detail,copies,response.plan.derivedCopyRows);
   detail.append(el('h3','별도 보존 검토 대상'));rows(detail,separate,response.plan.separateForRetentionReview);
   note(detail,'주문·고객 분쟁·Auth·Storage·백업·로그는 별도 절차로 검토해야 합니다. 삭제 승인은 이 화면에서 할 수 없습니다.');
   if(row.scope==='read-journal'&&row.state==='requested'&&response.reviewState!=='reviewing'){
    detail.append(button('운영자 검토 시작',async()=>{
     if(!current(ctx)||selected!==row.id)return;
     if(!confirm('이 요청의 검토를 시작할까요? 개인정보는 삭제되지 않고, 요청자의 철회도 검토 승인 전까지 가능합니다.'))return;
     const next=await A.privacyReview('start-review',{requestId:row.id,confirmed:true});
     if(!current(ctx)||selected!==row.id)return;
     if(next?.deletionPerformed!==false)throw new Error('검토 시작 결과를 확인하지 못했습니다.');
     A.status('요청 범위 검토를 시작했습니다. 삭제 승인은 실행되지 않았습니다.','ok');
     await render();
    }));
   }else note(detail,row.scope==='account-closure-review'?
     '계정 탈퇴와 법정 보존 판단은 이 화면에서 처리할 수 없습니다.': 
     '이미 검토 중이거나 접수 상태가 변경된 요청입니다. 추가 조치는 별도 승인 절차가 필요합니다.');
  }catch(error){if(current(ctx)&&selected===row.id){detail.replaceChildren(el('h2','요청 범위 확인'));unavailable(detail,error);}}
 }
 async function render(){
  generation++;selected=null;root.replaceChildren();
  if(!A.user){root.hidden=true;return;}
  root.hidden=false;const ctx=context();
  const status=section('운영 검토 연결'),message=el('p','기존 소유자 권한을 확인하고 있습니다.','nal-account-note');
  message.setAttribute('role','status');message.setAttribute('aria-live','polite');status.append(message);root.append(status);
  try{
   // Never invoke a dormant owner API solely because someone opens this URL.
   if(!await reviewUiReleased()){
    if(current(ctx))message.textContent='개인정보 검토 기능은 보안 및 고지 검토가 완료된 뒤 연결됩니다. 이 화면은 아직 요청 목록을 조회하거나 검토를 시작하지 않습니다.';
    return;
   }
   if(!current(ctx))return;
   const home=await A.call('account','operator-home',{});
   if(!current(ctx))return;
   if(home?.role!=='owner'){message.textContent='이 화면은 기존 소유자 계정에만 제공됩니다. 운영자 권한은 새로 발급되지 않습니다.';return;}
   message.textContent='소유자 계정으로 확인했습니다. 개인정보 검토 서버의 연결 상태를 확인합니다.';
   const result=await A.privacyReview('queue',{});
   if(!current(ctx))return;
   if(!Array.isArray(result?.requests))throw new Error('요청 목록 형태를 확인하지 못했습니다.');
   status.replaceChildren(el('h2','개인정보 요청 검토'));
   note(status,'요청 대기 목록은 최근 50건 범위이며 자동 새로고침하지 않습니다. 파기 승인·실행은 제공되지 않습니다.');
   const actions=el('div','','nal-account-actions');actions.append(button('요청 목록 다시 불러오기',render));status.append(actions);
   const queue=section('검토가 필요한 요청');
   if(!result.requests.length)note(queue,'현재 반환된 검토 요청이 없습니다. 서버가 반환한 빈 목록입니다.');
   for(const item of result.requests){
    if(!item||!UUID_V4.test(item.id||''))continue;
    const entry=el('article','','nal-review-item');
    entry.append(el('h3',scopes[item.scope]||'개인정보 요청'));
    entry.append(el('p',(states[item.state]||'상태 확인')+' · '+A.date(item.requested_at||item.requestedAt),'nal-account-meta'));
    const detail=button('기록 범위 보기',()=>showRequest(item,home.role));
    detail.className='nal-account-link';
    entry.append(detail);queue.append(entry);
   }
   root.append(queue);
   const detail=section('선택한 요청');detail.dataset.privacyReviewDetail='';note(detail,'위 목록에서 요청을 선택하면 개인 기록의 건수와 별도 보존 필요성을 보여줍니다.');root.append(detail);
  }catch(error){
   if(!current(ctx)||error?.name==='AbortError')return;
   message.textContent='';
   unavailable(status,error);
   status.append(button('연결 다시 확인',render));
  }
 }
 A.ready.then(ok=>{if(ok)render();});A.onChange(()=>render());
})();
