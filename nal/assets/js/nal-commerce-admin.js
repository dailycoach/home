/* NAL COMMERCE ADMIN — source-only progressive enhancement.
 * OFF => fetch only public OFF manifest, NEVER sign in, contact admin API or
 * render guessed sales numbers. Trusted server bridge is injected only after
 * independently reviewed Auth + existing owner membership are implemented.
 */
(()=>{
  'use strict';
  const $=q=>document.querySelector(q);
  const node=(tag,text='',cls='')=>{
    const e=document.createElement(tag);e.textContent=String(text);
    if(cls)e.className=cls;return e;
  };
  const NAV=Object.freeze({
    overview:{title:'운영현황',action:'overview'},
    catalog:{title:'마음도구',action:'catalog-list'},
    programs:{title:'모임·클래스',action:'program-list'},
    bookings:{title:'참가·예약',action:'bookings-list'},
    orders:{title:'주문·결제',action:'orders-list'},
    delivery:{title:'파일 전달',action:'delivery-list'}
  });
  const FILTERS={
    catalog:[['all','전체'],['pdf','마음도구 PDF'],['reading_circle','독서모임'],['class_session','클래스']],
    programs:[['all','전체'],['reading_circle','독서모임'],['class_session','클래스']],
    bookings:[['all','전체'],['reading_circle','독서모임'],['class_session','클래스']],
    orders:[['all','전체'],['pending','결제 대기'],['paid','결제 완료'],
      ['refund_requested','환불 검토'],['refunded','환불 완료'],['cancelled','취소'],['review_required','재확인']],
    delivery:[]
  };
  const WON=new Intl.NumberFormat('ko-KR');
  const money=x=>Number.isSafeInteger(x)&&x>=0?WON.format(x)+'원':'확인 필요';
  const num=x=>Number.isSafeInteger(x)&&x>=0?WON.format(x):'확인 필요';
  const dt=x=>{
    if(typeof x!=='string'||!Number.isFinite(Date.parse(x)))return '일정 미정';
    return new Intl.DateTimeFormat('ko-KR',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Seoul'}).format(new Date(x));
  };
  const labels={pdf:'PDF 마음도구',reading_circle:'독서모임',class_session:'클래스',
    pending:'결제 대기',paid:'결제 완료',refund_requested:'환불 검토',refunded:'환불 완료',
    cancelled:'취소',review_required:'관리자 확인',draft:'비공개 초안'};
  const approved=x=>x?.schemaVersion===1&&x.module==='nal-commerce-admin'
    &&x.uiEnabled===true&&x.ownerAuthReviewed===true&&x.serverGateConfigured===true
    &&x.privacyNoticeApproved===true&&x.writePermissionsReviewed===true
    &&x.backendDeployed===true&&x.productionApproved===true;
  const app={released:false,bridge:null,current:'overview',offset:0,filter:'all',
    total:null,generation:0,loaded:false,editRevision:0};
  const status=(message)=>{const el=$('#na-message');if(el)el.textContent=message;};
  const clearPrivate=()=>{
    app.loaded=false;app.generation++;
    const panel=$('#na-private');if(panel){panel.hidden=true;}
    for(const target of document.querySelectorAll('[data-metric]'))target.textContent='—';
    const list=$('#na-list-records');if(list)list.replaceChildren();
    const detail=$('#na-order-fields');if(detail)detail.replaceChildren();
  };
  function showMenu(tab){
    if(!Object.hasOwn(NAV,tab))return;
    app.current=tab;
    for(const b of document.querySelectorAll('[data-admin-nav]')){
      if(b.dataset.adminNav===tab)b.setAttribute('aria-current','page');
      else b.removeAttribute('aria-current');
    }
  }
  function tabParams(){
    if(app.current==='overview')return {};
    if(app.current==='orders')return {state:app.filter,offset:app.offset};
    if(app.current==='delivery')return {offset:app.offset};
    return {kind:app.filter,offset:app.offset};
  }
  async function call(action,payload){
    if(!app.released||!app.bridge||typeof app.bridge.request!=='function')
      throw Error('운영자 인증이 아직 연결되지 않았습니다.');
    // The production bridge must verify real Auth; no client-side user role.
    const raw=await app.bridge.request(action,payload);
    if(!raw||!Object.hasOwn(raw,'data'))throw Error('서버 결과를 확인하지 못했습니다.');
    return raw.data;
  }
  function showSection(tab){
    showMenu(tab);
    const overview=$('#na-overview'),list=$('#na-list'),draft=$('#na-draft'),details=$('#na-order-detail');
    if(overview)overview.hidden=tab!=='overview';
    if(list)list.hidden=tab==='overview';
    if(draft)draft.hidden=!['catalog','programs'].includes(tab);
    if(details)details.hidden=true;
    const title=$('#na-list-title');if(title)title.textContent=NAV[tab].title;
    const description=$('#na-list-desc');
    if(description)description.textContent={
      catalog:'상품 공개 여부와 가격을 확인하고 비공개 초안을 편집합니다.',
      programs:'독서모임과 클래스의 운영 일정·정원을 확인합니다.',
      bookings:'참가권과 예약 현황입니다. 참석자 정보는 별도 인증 후 조회합니다.',
      orders:'주문과 결제 상태만 조회합니다. 환불·정산 실행은 제공하지 않습니다.',
      delivery:'결제된 자료의 전달 상태입니다. 파일의 원본 주소는 표시하지 않습니다.'
    }[tab]||'';
    const editing=tab==='catalog'||tab==='programs';
    const dtTitle=$('#na-draft-title');if(dtTitle)dtTitle.textContent=tab==='programs'?'모임·클래스 비공개 초안':'마음도구 비공개 초안';
    for(const id of ['na-draft-description-field','na-draft-price-field']){
      const el=$('#'+id);if(el)el.hidden=tab==='programs';
    }
    for(const id of ['na-draft-starts-field','na-draft-capacity-field']){
      const el=$('#'+id);if(el)el.hidden=tab!=='programs';
    }
    const selector=$('#na-draft-kind');if(selector&&editing){
      const choices=tab==='catalog'?FILTERS.catalog.slice(1):FILTERS.programs.slice(1);
      selector.replaceChildren();
      for(const [value,label] of choices){const option=node('option',label);option.value=value;selector.append(option);}
    }
    const filter=$('#na-filter');
    if(filter&&tab!=='overview'){
      filter.replaceChildren();
      for(const [value,label] of FILTERS[tab]||[]){
        const opt=node('option',label);opt.value=value;filter.append(opt);
      }
      filter.hidden=tab==='delivery';const label=document.querySelector('label[for="na-filter"]');
      if(label)label.hidden=tab==='delivery';
      filter.value=app.filter;
    }
    if(!editing){const form=$('#na-draft-form');if(form)form.reset();}
  }
  function renderOverview(data){
    const metrics=['totalOrders','paidOrders','pendingOrders','refundReviews','grossWon','activePrograms'];
    if(!data||!metrics.every(x=>Number.isSafeInteger(data[x])&&data[x]>=0))
      throw Error('운영현황 정보를 확인하지 못했습니다.');
    for(const key of metrics){
      const el=document.querySelector('[data-metric="'+key+'"]');
      if(el)el.textContent=key==='grossWon'?money(data[key]):num(data[key]);
    }
    status('인증된 운영자 계정의 최신 자료입니다. 데이터가 없을 경우에만 0으로 표시합니다.');
  }
  function listMeta(tab,record){
    if(tab==='catalog')return [labels[record.kind]||'상품',record.saleStatus||'상태 미정','rev '+num(record.revision)];
    if(tab==='programs')return [labels[record.kind]||'프로그램',dt(record.startsAt),'정원 '+num(record.capacity)];
    if(tab==='bookings')return [labels[record.kind]||'예약',dt(record.startsAt),'확정 '+num(record.reserved)+' / '+num(record.capacity)];
    if(tab==='orders')return [labels[record.kind]||'주문',labels[record.state]||'상태 확인',record.contactMasked||'연락처 비공개'];
    return [record.status||'전달상태 미확인',dt(record.updatedAt),'재시도 '+num(record.attempts)];
  }
  function renderList(tab,result){
    if(!result||!Array.isArray(result.items)||!Number.isSafeInteger(result.total)
      ||!Number.isSafeInteger(result.offset))throw Error('목록을 불러오지 못했습니다.');
    const root=$('#na-list-records');if(!root)return;
    root.replaceChildren();
    if(!result.items.length)root.append(node('p','조회 결과가 없습니다. 다른 조건으로 확인해 보세요.','na-empty'));
    else for(const record of result.items){
      const card=node('article','','na-record');
      const left=node('div');
      const title=record.title||record.productTitle||record.id||record.orderId||'이름 미확인';
      left.append(node('h3',title));
      left.append(node('p',listMeta(tab,record).filter(Boolean).join('  ·  ')));
      const right=node('div');
      if(tab==='orders' || tab==='catalog' || tab==='programs'){
        const value=tab==='orders'?record.amountWon:tab==='catalog'?record.priceWon:record.reserved;
        right.append(node('strong',tab==='programs'?'예약 '+num(value):money(value)));
        const button=node('button',tab==='orders'?'주문 확인':'초안 편집');
        button.type='button';
        if(tab!=='orders'&&record.saleStatus!=='draft'){button.disabled=true;button.title='공개상품 편집은 별도 승인 절차가 필요합니다.';}
        button.addEventListener('click',()=>{if(tab==='orders')void openOrder(record.id);else editDraft(tab,record);});
        right.append(button);
      }else{
        right.append(node('strong',tab==='bookings'?num(record.reserved)+' / '+num(record.capacity):String(record.status||'대기')));
      }
      card.append(left,right);root.append(card);
    }
    app.total=result.total;
    const per=50;
    const page=$('#na-page-caption');if(page)page.textContent=num(result.total)+'건 중 '+num(Math.min(result.offset+1,result.total))+'–'+num(Math.min(result.offset+result.items.length,result.total));
    const prev=$('#na-prev'),next=$('#na-next');
    if(prev)prev.disabled=result.offset<=0;
    if(next)next.disabled=result.items.length===0||result.offset+result.items.length>=result.total||result.items.length>=50&&result.offset>=10000;
    status(NAV[tab].title+' 자료를 확인했습니다. 결제·환불 실행은 제공하지 않습니다.');
  }
  function editDraft(tab,record){
    if(!app.released||!record||record.saleStatus!=='draft')return;
    const f=$('#na-draft-form');if(!f)return;
    f.elements.id.value=record.id||'';
    f.elements.title.value=record.title||'';
    f.elements.kind.value=record.kind||'pdf';
    const desc=$('#na-draft-description'),price=$('#na-draft-price');
    if(desc)desc.value=record.description||'';
    if(price)price.value=Number.isSafeInteger(record.priceWon)?record.priceWon:0;
    const starts=$('#na-draft-starts'),capacity=$('#na-draft-capacity');
    if(starts)starts.value=typeof record.startsAt==='string'&&record.startsAt?record.startsAt.slice(0,16):'';
    if(capacity)capacity.value=Number.isSafeInteger(record.capacity)?record.capacity:10;
    app.editRevision=Number.isSafeInteger(record.revision)?record.revision:0;
    const message=$('#na-draft-status');if(message)message.textContent='기존 비공개 초안을 열었습니다. 판매·모집을 시작하지 않습니다.';
    f.scrollIntoView?.({block:'nearest',behavior:'smooth'});
  }
  async function openOrder(id){
    const tab=app.current,mark=++app.generation;
    try{
      const data=await call('order-detail',{orderId:id});
      if(mark!==app.generation||app.current!==tab)return;
      const root=$('#na-order-fields');if(!root)return;root.replaceChildren();
      const fields=[['주문번호','id'],['상품','productTitle'],['유형','kind'],['결제 금액','amountWon'],
        ['결제 상태','state'],['전달 상태','fulfillmentState'],['연락처 일부','contactMasked'],['주문일','createdAt']];
      for(const [title,key] of fields){
        root.append(node('dt',title));
        root.append(node('dd',key==='amountWon'?money(data[key]):key==='createdAt'?dt(data[key]):
          labels[data[key]]||String(data[key]??'확인 필요')));
      }
      $('#na-order-detail').hidden=false;
      $('#na-order-detail').scrollIntoView?.({block:'nearest'});
    }catch{status('주문 확인을 진행할 수 없습니다. 운영자 권한과 서버 연결을 확인해 주세요.');}
  }
  async function load(){
    if(!app.released)return;
    const mark=++app.generation,tab=app.current;
    showSection(tab);
    status(NAV[tab].title+' 정보를 안전하게 확인하고 있습니다.');
    const records=$('#na-list-records');
    if(tab!=='overview'&&records)records.replaceChildren(node('p','서버에 조회 중입니다.','na-empty'));
    try{
      const data=await call(NAV[tab].action,tabParams());
      if(mark!==app.generation||tab!==app.current)return;
      if(tab==='overview')renderOverview(data);
      else renderList(tab,data);
    }catch{
      if(mark!==app.generation)return;
      clearPrivate();
      status('운영자 인증 또는 데이터 연결을 확인할 수 없습니다. 빈 주문으로 대신 표시하지 않습니다.');
      const access=$('#na-access-label');if(access)access.textContent='연결 확인 필요';
    }
  }
  async function saveDraft(event){
    event.preventDefault();
    if(!app.released)return;
    const form=event.currentTarget;
    if(!form.reportValidity?.())return;
    const kind=form.elements.kind.value;
    const id=form.elements.id.value.trim().toLowerCase();
    const title=form.elements.title.value.trim();
    const isProgram=app.current==='programs';
    const request=isProgram?{
      id,title,kind,startsAt:new Date($('#na-draft-starts').value).toISOString(),
      capacity:Number($('#na-draft-capacity').value),expectedRevision:app.editRevision
    }:{
      id,title,kind,description:$('#na-draft-description').value,
      priceWon:Number($('#na-draft-price').value),expectedRevision:app.editRevision
    };
    const button=$('#na-save'),message=$('#na-draft-status');
    button.disabled=true;if(message)message.textContent='서버에서 비공개 초안을 확인하고 있습니다.';
    try{
      const result=await call(isProgram?'session-draft-save':'catalog-draft-save',request);
      if(result?.saleStatus!=='draft'||result?.published!==false
        ||!Number.isSafeInteger(result.revision))throw Error('Unsafe result');
      app.editRevision=result.revision;
      if(message)message.textContent='비공개 초안으로 저장했습니다. 결제·모집은 열리지 않습니다.';
      await load();
    }catch{
      if(message)message.textContent='저장하지 못했습니다. 권한·수정 버전 또는 서버 연결을 확인해 주세요.';
    }finally{button.disabled=false;}
  }
  async function boot(){
    const nav=document.querySelectorAll('[data-admin-nav]');
    for(const button of nav)button.addEventListener('click',()=>{
      const tab=button.dataset.adminNav;if(!Object.hasOwn(NAV,tab))return;
      if(!app.released){showMenu(tab);return;}
      app.filter='all';app.offset=0;void loadTab(tab);
    });
    const releaseUrl='/nal/data/commerce-admin.release.json';
    let gate;
    try{
      const result=await fetch(releaseUrl,{
        method:'GET',cache:'no-store',redirect:'error',credentials:'same-origin',
        signal:AbortSignal.timeout(8000)
      });
      if(!result.ok || !String(result.headers.get('content-type')||'')
        .toLowerCase().includes('application/json'))throw Error('gate unavailable');
      gate=await result.json();
    }catch{
      status('운영자 전용 연결 상태를 확인할 수 없습니다. 실제 고객·결제 자료에 접근하지 않습니다.');
      return;
    }
    if(!approved(gate)){
      clearPrivate();
      status('이 화면은 아직 운영에 연결되지 않았습니다. 인증·법적 고지·DB 권한을 검토한 뒤에만 관리기능을 제공합니다.');
      return;
    }
    // This separate trusted Auth/session adapter is NOT installed in this draft.
    // Never accept a browser role claim or auto-grant "owner" from email.
    const bridge=globalThis.NALCommerceAdminBridge;
    if(!bridge||typeof bridge.request!=='function'){
      clearPrivate();
      status('운영자 보안 인증 경계가 아직 연결되지 않았습니다. 권한을 새로 발급하지 않습니다.');
      return;
    }
    app.bridge=bridge;app.released=true;
    $('#na-private').hidden=false;
    $('#na-access-label').textContent='서버 권한 확인 필요';
    const filter=$('#na-filter');if(filter)filter.addEventListener('change',()=>{
      app.filter=filter.value;app.offset=0;void load();
    });
    const refresh=$('#na-refresh');if(refresh)refresh.addEventListener('click',()=>void load());
    const prev=$('#na-prev');if(prev)prev.addEventListener('click',()=>{
      app.offset=Math.max(0,app.offset-50);void load();
    });
    const next=$('#na-next');if(next)next.addEventListener('click',()=>{
      if(app.total!==null&&app.offset+50<app.total){app.offset+=50;void load();}
    });
    const close=$('#na-order-close');if(close)close.addEventListener('click',()=>{
      $('#na-order-detail').hidden=true;
    });
    const form=$('#na-draft-form');
    if(form){form.addEventListener('submit',event=>{void saveDraft(event);});
      form.addEventListener('reset',()=>{app.editRevision=0;const message=$('#na-draft-status');if(message)message.textContent='새 비공개 초안을 준비합니다.';});}
    await load();
  }
  async function loadTab(tab){showMenu(tab);await load();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{void boot();},{once:true});
  else void boot();
  globalThis.NALCommerceAdmin=Object.freeze({approved});
})();
