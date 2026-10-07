/* BUILD18: keep operator season scope in lists, conversation pages and return links.
 * Member messaging and explicit mutation endpoints are unchanged. */
(() => {
 'use strict';
 const A=window.NalAccount,C=window.NalAdminContext;if(!A)return;
 const root=document.querySelector('[data-account-private]');if(!root)return;
 const el=A.node,staff=document.body.dataset.supportRole==='staff';
 const base=staff?'/nal/read/admin/support/':'/nal/my/help/';
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const CATEGORIES={account:'계정·로그인',read:'READ 이용·기수',payment:'주문·결제 문의',live:'LIVE 참여',technical:'화면·저장 문제',other:'기타 문의'};
 const STATES={open:'운영자 답변 대기',answered:'답변 도착',resolved:'해결됨'};
 let generation=0,owner=null,dirty=false,busy=false,lastRefresh=0;
 const drafts=new Map();
 const context=()=>({generation,epoch:A.epoch,id:A.user?.id});
 const current=c=>c.generation===generation&&c.epoch===A.epoch&&!!c.id&&c.id===A.user?.id;
 const act=(action,payload={})=>{
  if(typeof A.support!=='function')return Promise.reject(new Error('문의 계정 연결 파일을 다시 불러와 주세요.'));
  if(staff){
   if(!C)return Promise.reject(new Error('운영 화면 연결 파일을 다시 불러와 주세요.'));
   C.read();
   if(action==='list'||action==='get')return C.query(action==='list'?'support':'support-thread',payload,()=>A.support('admin-'+action,payload));
  }
  return A.support((staff?'admin-':'')+action,payload);
 };
 function report(error,c){if(c&&!current(c))return;
  if(staff&&[401,403].includes(error.status))root.replaceChildren();
  A.status(error.name==='AbortError'?'응답을 받지 못했습니다. 같은 내용으로 다시 시도하거나 내 문의 목록을 확인해 주세요.':error.message,'error');
 }
 function mayLeave(){
  if(busy){A.status('문의 저장 결과를 확인 중입니다. 중복 제출하지 말고 현재 화면에서 확인해 주세요.');return false;}
  return !dirty||confirm('아직 보내지 않은 내용이 있습니다. 화면을 떠나면 미전송 내용이 사라질 수 있습니다. 이동할까요?');
 }
 function button(label,fn,minor=false){const b=el('button',label,minor?'nal-account-link':'nal-account-button');b.type='button';
  b.addEventListener('click',async()=>{const c=context();b.disabled=true;try{await fn(c);}catch(e){report(e,c);}finally{if(b.isConnected)b.disabled=false;}});return b;
 }
 function field(label,value='',max=120,multi=false){const wrap=el('label','','nal-support-field'),input=el(multi?'textarea':'input');
  input.value=value;input.maxLength=max;if(multi)input.rows=6;wrap.append(el('span',label),input);return{wrap,input};
 }
 function select(label,options,value=''){const wrap=el('label','','nal-support-field'),input=el('select');
  for(const[v,t]of options){const o=el('option',t);o.value=v;input.append(o);}input.value=value;wrap.append(el('span',label),input);return{wrap,input};
 }
 function row(){return el('div','','nal-account-actions');}
 function pageHref(params={}){if(staff){if(!C)throw new Error('운영 경로를 다시 불러와 주세요.');return C.href(base,params);}const u=new URL(base,location.origin);for(const[k,v]of Object.entries(params))if(v)u.searchParams.set(k,v);return u.pathname+u.search;}
 function navigate(params){if(!mayLeave())return;history.pushState({},'',pageHref(params||{}));render();}
 function threadLink(t){const a=A.link(pageHref({id:t.id}),t.subject,'nal-support-subject');a.addEventListener('click',e=>{if(e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();navigate({id:t.id});});return a;}
 function privacyText(){return el('p','직접 작성한 내용과 선택한 기수·주문 정보만 운영자에게 전달됩니다. 비밀번호·인증번호·카드번호·개인 코칭 답변을 적지 마세요. 파일이나 화면 내용은 자동 첨부하지 않습니다.','nal-support-privacy');}
 function drawContext(parent,ctx){const box=el('section','','nal-support-context');box.append(el('h3','문의에 함께 남긴 정보'));
  if(ctx?.season)box.append(el('p',[ctx.season.title,ctx.season.cohortLabel].filter(Boolean).join(' · ')));
  if(ctx?.order)box.append(el('p',ctx.order.title),el('code',ctx.order.id));
  if(!ctx?.season&&!ctx?.order)box.append(el('p','기수·주문을 연결하지 않은 문의입니다.','nal-account-note'));
  box.append(el('p','선택 당시의 안내 정보입니다. 현재 결제·환불 결과를 뜻하지 않습니다.','nal-account-note'));parent.append(box);
 }
 function controlsLocked(form){const inputs=[...form.querySelectorAll('input,select,textarea,button')].map(x=>[x,x.disabled]);inputs.forEach(([x])=>x.disabled=true);return()=>inputs.forEach(([x,was])=>{if(x.isConnected)x.disabled=was;});}
 function requestFor(holder,data){const signature=JSON.stringify(data);if(holder.signature!==signature){holder.signature=signature;holder.requestId=crypto.randomUUID();}return{...data,requestId:holder.requestId};}
 async function list(c){
  const params=new URLSearchParams(location.search);let state=params.get('tab');if(!['open','answered','resolved'].includes(state))state='all';
  root.replaceChildren();root.hidden=false;
  const actions=row();if(!staff)actions.append(button('새 문의 남기기',()=>navigate({tab:'new'})));
  actions.append(A.link('/nal/help/','이용 도움말'),button('목록 새로 불러오기',()=>render(),true));root.append(actions);
  if(staff&&C.read().seasonSlug)root.append(el('p','선택한 기수에 연결된 문의만 조회합니다. 일반 문의까지 보려면 상단에서 기수 선택을 해제하세요.','nal-account-note'));
  const filters=el('form','','nal-support-filters');
  const byState=select('처리 상태',[['all','전체'],...Object.entries(STATES)],state),byCategory=select('문의 분류',[['all','전체 분류'],...Object.entries(CATEGORIES)],'all');
  const search=el('button','목록 보기','nal-account-button');search.type='submit';filters.append(byState.wrap,byCategory.wrap,search);root.append(filters);
  const items=el('div','','nal-support-list'),pager=row();root.append(items,pager);let offset=0,loading=false;
  async function load(reset=false){
   if(loading)return;loading=true;search.disabled=true;if(reset){offset=0;items.replaceChildren();pager.replaceChildren();}
   try{
    const data=await act('list',{offset,state:byState.input.value,category:byCategory.input.value});if(!current(c))return;
    if(!Array.isArray(data.threads))throw new Error('문의 목록을 확인하지 못했습니다. 빈 목록으로 대신 표시하지 않습니다.');
    const batch=data.threads.slice(0,50);offset+=batch.length;
    if(staff&&!root.querySelector('[data-support-scope]')){const notice=el('p',data.role==='owner'?'소유자 권한으로 현재 조회 범위의 문의를 표시합니다.':'현재 계정에 배정된 문의만 표시됩니다.','nal-account-note');notice.dataset.supportScope='';root.prepend(notice);}
    for(const t of batch){const item=el('article','','nal-support-item'),meta=el('p','','nal-account-meta');
     meta.textContent=(CATEGORIES[t.category]||'문의')+' · '+(STATES[t.state]||'상태 확인')+' · '+A.date(t.updatedAt);
     item.append(meta,threadLink(t));if(!staff&&t.unread)item.append(el('span','읽지 않은 답변','nal-support-unread'));
     if(staff)item.append(el('p',t.displayName||'참가자','nal-account-meta'));
     if(t.context?.season)item.append(el('p',t.context.season.cohortLabel||t.context.season.title,'nal-account-meta'));items.append(item);
    }
    if(!offset)items.append(el('p',staff?'이 조건에 맞는 문의가 없습니다.':'아직 이 조건에 맞는 문의가 없습니다. 필요한 내용을 새 문의로 남겨주세요.','nal-account-empty'));
    pager.replaceChildren();if(data.threads.length>50)pager.append(button('문의 더 보기',()=>load(),true));
   }catch(e){report(e,c);}finally{loading=false;if(search.isConnected)search.disabled=false;}
  }
  filters.addEventListener('submit',e=>{e.preventDefault();load(true);});await load();
 }
 async function compose(c){
  const data=await act('contexts');if(!current(c))return;
  const params=new URLSearchParams(location.search),saved=drafts.get('new')||{};
  root.replaceChildren();root.hidden=false;root.append(el('h2','어디에서 도움이 필요했나요?'),privacyText());
  const form=el('form','','nal-account-form nal-support-compose');
  const subject=field('제목',saved.subject||'',120),category=select('문의 분류',Object.entries(CATEGORIES),saved.category||'read');subject.input.required=true;
  const validSlug=data.seasons?.some(x=>x.slug===params.get('season'))?params.get('season'):'';
  const validOrder=data.orders?.some(x=>x.id===params.get('order'))?params.get('order'):'';
  const season=select('관련 기수 (선택)',[['','연결하지 않음'],...(data.seasons||[]).map(x=>[x.slug,[x.title,x.label].filter(Boolean).join(' · ')])],saved.seasonSlug||validSlug);
  const order=select('관련 주문 (선택)',[['','연결하지 않음'],...(data.orders||[]).map(x=>[x.id,x.title+' · '+A.date(x.createdAt)])],saved.orderId||validOrder);
  if(!season.input.value)season.input.value='';if(!order.input.value)order.input.value='';
  const body=field('상황과 필요한 도움',saved.body||'',4000,true);body.input.required=true;
  body.input.placeholder='어느 화면에서 무엇을 하려 했나요?\n실제로 보인 안내와 필요한 도움을 적어주세요.\n개인 답변이나 비밀번호는 옮겨 적지 않아도 됩니다.';
  const count=el('p','','nal-account-meta'),share=el('label','','nal-account-check'),check=el('input');check.type='checkbox';check.required=true;
  share.append(check,document.createTextNode('내가 적은 내용과 선택한 기수·주문 정보를 운영자가 확인하는 것에 동의합니다.'));
  const submit=el('button','문의 보내기','nal-account-button');submit.type='submit';const state=el('p','','nal-support-feedback');state.setAttribute('role','status');state.setAttribute('aria-live','polite');
  for(const f of [subject,category,season,order,body])form.append(f.wrap);
  form.append(count,el('p',`기수·주문 목록은 최근 ${data.limit||100}개입니다. 찾는 항목이 없으면 연결하지 않고 상황을 설명해 주세요.`,'nal-account-note'),share,submit,state);
  const holder={},snapshot=()=>({subject:subject.input.value,category:category.input.value,seasonSlug:season.input.value||null,orderId:order.input.value||null,body:body.input.value});
  function edited(){dirty=true;drafts.set('new',snapshot());count.textContent=body.input.value.length+' / 4,000자';}
  form.addEventListener('input',edited);form.addEventListener('change',edited);count.textContent=body.input.value.length+' / 4,000자';
  form.addEventListener('submit',async e=>{
   e.preventDefault();if(busy||!check.checked||!body.input.value.trim())return;
   const ctx=context(),payload=requestFor(holder,{...snapshot(),shareConfirmed:true}),unlock=controlsLocked(form);busy=true;state.textContent='문의 저장 결과를 확인하고 있습니다.';
   try{const result=await act('create',payload);if(!current(ctx))return;dirty=false;drafts.delete('new');history.replaceState({},'',base+'?id='+encodeURIComponent(result.thread.id));await render();A.status('문의를 남겼습니다. 답변은 내 문의에서 확인해 주세요.','ok');}
   catch(error){if(current(ctx)){state.textContent=error.message||'결과를 확인하지 못했습니다. 같은 내용으로 다시 시도해 주세요.';report(error,ctx);}}
   finally{busy=false;unlock();}
  });
  root.append(form,el('p','문자나 이메일을 자동으로 보내지 않습니다. 이곳에서 문의 상태와 운영자 답변을 확인해 주세요.','nal-account-note'),button('내 문의 목록',()=>navigate({}),true));
 }
 async function thread(id,c){
  let data=await act('get',{id,afterSeq:0});if(!current(c))return;
  let ticket=data.thread,lastSeq=0,hasMore=true,loading=false;const messageSet=new Set();
  root.replaceChildren();root.hidden=false;root.append(button('목록으로',()=>navigate({}),true));
  const header=el('section','','nal-support-thread-header'),heading=el('h2',ticket.subject),meta=el('p','','nal-account-meta');header.append(heading,meta);root.append(header);drawContext(root,ticket.context);
  const messages=el('section','','nal-support-messages');messages.setAttribute('aria-label','문의와 답변');
  const pagination=row(),editor=el('section','','nal-support-reply'),operations=row();root.append(messages,pagination,editor,operations);
  const updateHeader=()=>{meta.textContent=(CATEGORIES[ticket.category]||'문의')+' · '+(STATES[ticket.state]||'상태 확인')+' · '+A.date(ticket.updatedAt);};
  async function accept(page){
   ticket=page.thread;lastSeq=page.lastSeq;hasMore=page.hasMore;updateHeader();
   for(const m of page.messages||[]){if(messageSet.has(m.seq))continue;messageSet.add(m.seq);const item=el('article','','nal-support-message '+(m.author==='staff'?'from-staff':'from-member'));
    item.append(el('p',(m.author==='staff'?'날 운영자':'문의자')+' · '+A.date(m.createdAt),'nal-account-meta'),el('p',m.body,'nal-support-message-body'));messages.append(item);
   }
   pagination.replaceChildren();if(hasMore)pagination.append(button('이어서 남긴 대화 보기',async()=>{
    if(loading)return;loading=true;try{const next=await act('get',{id,afterSeq:lastSeq});if(current(c))await accept(next);}finally{loading=false;}
   },true));
   if(!staff&&current(c)){try{await act('read',{id,throughSeq:lastSeq});}catch(e){if(current(c))A.status('대화는 열었지만 읽음 표시를 저장하지 못했습니다.','error');}}
   if(current(c)&&!hasMore)await paintEditor();
  }
  async function lifecycle(action){
   if(!mayLeave())return;
   if(!confirm(action==='resolve'?'이 문의를 해결됨으로 표시할까요? 메시지 기록은 남으며 결제나 참가권은 바뀌지 않습니다.':'이 문의를 다시 열까요?'))return;
   const ctx=context();busy=true;
   try{await act(action,{id,revision:ticket.revision,confirmed:true,requestId:crypto.randomUUID()});if(current(ctx)){dirty=false;await render();}}finally{busy=false;}
  }
  async function paintEditor(){
   editor.replaceChildren();operations.replaceChildren();
   if(ticket.state==='resolved'){editor.append(el('p','해결됨으로 표시된 문의입니다. 내용은 그대로 남아 있습니다. 추가 질문이 있으면 다시 열어주세요.','nal-account-note'));operations.append(button('문의 다시 열기',()=>lifecycle('reopen'),true));}
   else{
    const form=el('form','','nal-account-form'),draftKey='reply:'+id;
    const body=field(staff?'참가자에게 보낼 답변':'이어 남길 내용',drafts.get(draftKey)||'',4000,true);body.input.required=true;
    const state=el('p','','nal-support-feedback');state.setAttribute('role','status');
    const check=el('input');check.type='checkbox';check.required=true;const agreement=el('label','','nal-account-check');agreement.append(check,document.createTextNode(staff?'이 답변을 문의자에게 공개합니다. 내부 메모나 다른 참가자 정보를 포함하지 않았습니다.':'내가 작성한 내용을 운영자에게 보냅니다.'));
    const submit=el('button',staff?'답변 보내기':'내용 추가하기','nal-account-button');submit.type='submit';form.append(body.wrap,agreement,submit,state);const holder={};
    body.input.addEventListener('input',()=>{dirty=true;drafts.set(draftKey,body.input.value);});
    form.addEventListener('submit',async e=>{
     e.preventDefault();if(busy||!check.checked||!body.input.value.trim())return;const ctx=context();busy=true;const unlock=controlsLocked(form);
     const payload=requestFor(holder,{id,revision:ticket.revision,body:body.input.value,shareConfirmed:true});
     try{await act('reply',payload);if(current(ctx)){dirty=false;drafts.delete(draftKey);await render();A.status(staff?'답변을 문의함에 남겼습니다. 외부 메시지는 보내지 않았습니다.':'추가 내용을 남겼습니다.','ok');}}
     catch(error){if(current(ctx)){state.textContent=error.message;report(error,ctx);}}finally{busy=false;unlock();}
    });editor.append(form,privacyText());operations.append(button('해결됨으로 표시',()=>lifecycle('resolve'),true));
   }
   operations.append(button('최신 대화 다시 불러오기',async()=>{
    if(busy)return;if(Date.now()-lastRefresh<1000)return;lastRefresh=Date.now();const hadDraft=dirty;dirty=false;await render();if(hadDraft)dirty=true;
   },true));
   if(staff&&data.role==='owner'){
    const candidates=await act('staff');if(!current(c))return;const box=el('section','','nal-support-assignment');box.append(el('h3','답변 담당자'));
    const selected=select('이 문의를 볼 담당자',[['','소유자만 처리'],...(candidates.staff||[]).map(x=>[x.id,x.label+' · '+(x.role==='owner'?'소유자':'운영자')])],ticket.assignedTo||'');
    box.append(selected.wrap,el('p','배정된 운영자만 이 문의를 열 수 있습니다. 기존 운영자 권한을 새로 부여하는 기능은 아닙니다.','nal-account-note'),button('담당자 저장',async()=>{
     if(!mayLeave()||!confirm('선택한 담당자에게 이 문의 내용을 볼 수 있도록 배정할까요?'))return;
     const ctx=context();busy=true;try{await act('assign',{id,revision:ticket.revision,assignedTo:selected.input.value||null,confirmed:true,requestId:crypto.randomUUID()});if(current(ctx))await render();}finally{busy=false;}
    }));editor.append(box);
   }
  }
  await accept(data);
 }
 async function render(){
  ++generation;const id=A.user?.id;if(owner!==id){drafts.clear();dirty=false;owner=id||null;}else dirty=false;
  root.replaceChildren();if(!id){root.hidden=true;return;}root.hidden=false;const c=context();
  if(typeof A.support!=='function'){root.append(el('h2','문의 기능을 연결하고 있습니다.'),el('p','공통 계정 파일과 문의 화면의 버전을 다시 확인해 주세요. 현재는 문의를 보내지 않습니다.','nal-account-note'),A.link('/nal/help/','로그인 없이 이용 도움말 보기'));return;}
  try{
   if(staff){if(!C)throw new Error('운영 화면 연결 파일을 다시 불러와 주세요.');C.read();}
   const params=new URLSearchParams(location.search),ticketId=params.get('id');
   if(ticketId){if(!UUID.test(ticketId))throw new Error('문의 주소를 확인해 주세요.');await thread(ticketId,c);}
   else if(!staff&&params.get('tab')==='new')await compose(c);else await list(c);
  }catch(error){report(error,c);if(current(c)&&!root.children.length){root.hidden=false;root.append(button('다시 불러오기',()=>render(),true),A.link('/nal/help/','이용 도움말'));}}
 }
 document.addEventListener('click',e=>{const target=e.target instanceof Element?e.target.closest('a[href],[data-account-signout]'):null;if(!target||target.target==='_blank')return;if(!mayLeave()){e.preventDefault();e.stopImmediatePropagation();}},true);
 window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});
 window.addEventListener('popstate',()=>{if(dirty)A.status('미전송 내용은 이 탭이 열린 동안 임시로 유지됩니다. 서버 초안으로 저장된 것은 아닙니다.');render();});
 A.ready.then(ok=>{if(ok)render();});A.onChange(render);
})();
