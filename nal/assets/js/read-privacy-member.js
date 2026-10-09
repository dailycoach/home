/* BUILD34 — existing MY NAL Auth only. Read/status/withdraw do not perform erasure.
 * Intake form stays absent until an approved privacy notice and server gate exist.
 * No new OAuth client, local persistence, polling, or participant content rendering. */
(() => {
 'use strict';
 const A=window.NalAccount,root=document.querySelector('[data-account-private]');
 if(!A||!root)return;
 const n=A.node,labels={
  answers:'남긴 답변',dayProgress:'DAY 진행 상태',drafts:'작성 중인 문장',experiments:'작은 실험',
  reports:'리포트 보관본',importantMarks:'중요 표시',preparationChecks:'시작 전 준비 확인',liveNotes:'개인 LIVE 메모'
 };
 const requestLabels={'read-journal':'개인 셀프코칭 기록 검토','account-closure-review':'계정·보존 범위 검토'};
 const stateLabels={
  requested:'요청 접수',withdrawn:'요청 철회','under-review':'검토 중',
  'awaiting-retention':'보존 범위 확인 중',fulfilled:'해당 범위 처리 기록',
  declined:'검토 결과 안내 필요'
 };
 let generation=0,inFlight=false;
 const ctx=()=>({generation,epoch:A.epoch,id:A.user?.id});
 const current=c=>c.generation===generation&&c.epoch===A.epoch&&c.id&&c.id===A.user?.id;
 const line=(title,detail)=>{
  const box=n('div','','nal-privacy-metric');
  box.append(n('dt',title),n('dd',detail));return box;
 };
 const section=title=>{const s=n('section','','nal-privacy-section');s.append(n('h2',title));return s;};
 const action=(label,handler)=>{
  const b=n('button',label,'nal-account-button');b.type='button';
  b.addEventListener('click',async()=>{
   if(inFlight)return;
   inFlight=true;b.disabled=true;
   try{await handler();}catch(e){A.status(e.message||'요청 결과를 확인하지 못했습니다.','error');}
   finally{inFlight=false;if(b.isConnected)b.disabled=false;}
  });return b;
 };
 function reviewStatus(s,requests,c){
  if(!Array.isArray(requests))throw new Error('요청 상태를 확인하지 못했습니다.');
  if(!requests.length){
   s.append(n('p','이 계정으로 접수된 검토 요청이 없습니다. 새 요청 접수는 고지와 서버 연결이 확정된 뒤 제공합니다.','nal-account-note'));
   return;
  }
  for(const r of requests){
   if(!r||typeof r!=='object')continue;
   const item=n('article','','nal-privacy-item');
   item.append(n('h3',requestLabels[r.scope]||'개인정보 요청'),n('p',stateLabels[r.state]||'상태 확인 필요','nal-privacy-state'));
   if(r.requestedAt)item.append(n('p','접수: '+A.date(r.requestedAt),'nal-account-meta'));
   item.append(n('p',r.state==='fulfilled'?
    '요청 범위에 대한 처리 기록입니다. Auth·주문·문의·저장소·백업까지 모두 삭제됐다는 뜻은 아닙니다.':
    '접수 상태는 실제 파기 완료와 다릅니다. 기록별 보존 필요성을 별도로 검토해야 합니다.','nal-account-note'));
   if(r.state==='requested'&&typeof r.id==='string'){
    const b=action('이 요청 철회',async()=>{
     if(!current(c))return;
     if(!confirm('아직 검토 중인 요청을 철회할까요? 기록은 삭제되지 않습니다.'))return;
     await A.call('privacy','withdraw',{id:r.id,confirmed:true});
     if(!current(c))return;
     A.status('요청 철회 상태를 저장했습니다. 개인정보를 삭제한 것은 아닙니다.','ok');
     await render();
    });
    b.className='nal-account-link';item.append(b);
   }
   s.append(item);
  }
 }
 async function render(){
  ++generation;root.replaceChildren();
  if(!A.user){root.hidden=true;return;}
  root.hidden=false;const c=ctx();
  const top=section('보관 현황과 요청 처리 상태');
  top.append(n('p','내 기록의 개수만 조회합니다. 글의 내용이나 다른 참가자의 자료는 이 화면으로 불러오지 않습니다.','nal-account-note'));
  const status=n('p','현재 계정의 기록 상태를 확인하고 있습니다.','nal-account-note');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  top.append(status);root.append(top);
  try{
   const [inventory,history]=await Promise.all([
    A.call('privacy','inventory',{}),A.call('privacy','status',{})
   ]);
   if(!current(c))return;
   if(inventory?.noTextIncluded!==true||inventory?.deletionPerformed!==false||!inventory.privateRecords||!Array.isArray(history?.requests)){
    throw new Error('개인정보 조회 결과를 확인하지 못했습니다. 기록이 없다는 뜻은 아닙니다.');
   }
   status.remove();
   const records=section('내 개인 기록'),dl=n('dl','','nal-privacy-counts');
   for(const [key,title] of Object.entries(labels)){
    const value=inventory.privateRecords[key];
    dl.append(line(title,Number.isInteger(value)&&value>=0?value.toLocaleString('ko-KR')+'건':'확인 필요'));
   }
   records.append(dl,n('p','리포트와 실험에는 원문 사본이 별도로 저장될 수 있습니다. 위 개수는 행 수 기준이며 개인정보 삭제 완료 건수가 아닙니다.','nal-account-note'));
   const others=section('별도 보존 판단이 필요한 기록'),other=n('dl','','nal-privacy-counts');
   const separately=inventory.separatelyHandled||{};
   for(const [key,title] of [['orders','주문·거래'],['supportThreads','고객 문의'],['enrollments','프로그램 참여']]){
    const value=separately[key];other.append(line(title,Number.isInteger(value)&&value>=0?value.toLocaleString('ko-KR')+'건':'확인 필요'));
   }
   others.append(other,n('p','거래·분쟁 기록, Auth 계정·세션, 저장소·로그·백업은 셀프코칭 기록과 별도 절차가 필요합니다.','nal-account-note'));
   const requests=section('내가 남긴 검토 요청');reviewStatus(requests,history.requests,c);
   const safe=section('새 요청 안내');
   safe.append(n('p','현재 개인정보처리방침과 실제 파기 범위가 확정되지 않아 이 화면에서는 새 삭제 신청을 보내지 않습니다. 문의로 현재 상황을 남길 수 있습니다.','nal-account-note'),
    A.link('/nal/my/help/','개인정보 관련 문의 남기기','nal-account-button'));
   const actions=n('div','','nal-account-actions');actions.append(action('상태 다시 확인',render),A.link('/nal/my/','MY NAL로 돌아가기','nal-account-link'));
   root.append(records,others,requests,safe,actions);
  }catch(error){
   if(!current(c)||error.name==='AbortError')return;
   status.textContent=error.status===503?
    '개인정보 기록 조회 기능은 현재 비공개 준비 중입니다. 이 상태는 기록이 없거나 파기됐다는 뜻이 아닙니다.':
    (error.status===401?'로그인 확인이 필요합니다.':error.status===403?'이 계정의 기록에 접근할 수 없습니다.':'기록 조회 결과를 확인하지 못했습니다. 내용이 없다는 뜻은 아닙니다.');
   const actions=n('div','','nal-account-actions');actions.append(action('조회 다시 시도',render),A.link('/nal/my/help/','고객지원으로 문의','nal-account-link'));
   top.append(actions);
  }
 }
 A.ready.then(ok=>{if(ok)render();});A.onChange(()=>render());
})();
