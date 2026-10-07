/* BUILD18 — open one verified season offer; changing screens never saves it. */
(() => {
 'use strict';const A=window.NalAccount,C=window.NalAdminContext;if(!A)return;
 const el=A.node,root=document.querySelector('[data-account-private]');let generation=0,dispose=()=>{};
 const field=(label,value='',tag='input')=>{const wrap=el('label',label),input=el(tag);input.value=value??'';wrap.append(input);return{wrap,input};};
 function choose(label,options,value){const x=field(label,'','select');for(const[v,t]of options){const o=el('option',t);o.value=v;x.input.append(o);}x.input.value=value;return x;}
 async function render(){const ticket=++generation,epoch=A.epoch;dispose();dispose=()=>{};root.replaceChildren();
  if(!A.user){root.hidden=true;return;}root.hidden=false;
  try{
   if(!C)throw new Error('운영 화면 연결 파일을 다시 불러와 주세요.');const selected=C.read().seasonSlug;
   const data=await A.call('offers-admin','list');if(ticket!==generation||epoch!==A.epoch)return;
   if(!Array.isArray(data.seasons)||!Array.isArray(data.products))throw new Error('시즌·상품 목록을 확인하지 못했습니다. 빈 설정으로 대신 표시하지 않습니다.');
   root.append(el('h2','선택한 기수의 상품 연결'),el('p','가격은 기존 카탈로그 값을 사용합니다. 여기서는 결제 설정, READ 공개 스위치, 참가자 권한을 변경하지 않습니다.','nal-account-note'));
   const picker=choose('작업할 시즌',[['','시즌을 선택하세요'],...data.seasons.map(s=>[s.slug,s.title+' · '+s.slug])],selected||'');picker.wrap.classList.add('nal-admin-season-select');root.append(picker.wrap);
   picker.input.addEventListener('change',()=>{if(!C.mayLeave()){picker.input.value=selected||'';return;}C.set(picker.input.value||null);render();});
   if(!selected){root.append(el('p',data.seasons.length?'시즌을 선택하면 그 기수의 상품 설정만 엽니다.':'먼저 원고 편집에서 시즌을 만들어주세요.','nal-account-empty'),A.link('/nal/read/admin/','원고 편집으로'));return;}
   const season=data.seasons.find(s=>s.slug===selected);
   if(!season){root.append(el('p','선택한 시즌을 현재 목록에서 찾지 못했습니다. 다른 시즌을 대신 열지 않습니다. 위에서 다시 선택해 주세요.','nal-account-empty'));return;}
   C.info(season.title);const f=season.offer||{},form=el('form','','nal-account-record nal-account-form');form.append(el('h3',season.title));let revision=f.revision||0;
   const product=choose('연결할 카탈로그 상품',data.products.map(p=>[p.id,`${p.title||p.id} · ${p.price==null?'가격 미정':A.money(p.price)} · ${p.published?'공개':'비공개'}`]),f.catalog_id||'');
   const mode=choose('참가권 유형',[['paid','결제 확인 주문 연결'],['free','0원 상품 무료 참여'],['invitation','기존 계정 초대권']],f.mode||'paid');
   const status=choose('상품 안내 상태',[['draft','초안'],['listed','소개만 공개'],['accepting','참가권 연결 허용'],['closed','등록 마감']],f.status||'draft');
   const summary=field('소개 문장',f.summary||'','textarea');summary.input.maxLength=1200;
   const policy=field('참여 안내 버전',f.policy_version||'');policy.input.required=true;policy.input.maxLength=80;
   const notice=field('참여·이용 안내 원문',f.participation_notice||'','textarea');notice.input.required=true;notice.input.maxLength=8000;
   const start=field('등록 시작 (한국 시간)',local(f.starts_at)),end=field('등록 마감 (한국 시간)',local(f.ends_at));start.input.type=end.input.type='datetime-local';
   const days=field('참가권 이용일수 (빈칸은 별도 만료일 없음)',f.access_days||'');days.input.type='number';days.input.min='1';days.input.max='3660';
   [product,mode,status,summary,policy,notice,start,end,days].forEach(x=>form.append(x.wrap));
   const save=el('button','연결 초안 저장','nal-account-button');save.type='submit';form.append(save);const edit=C.track(form);dispose=edit.dispose;
   form.addEventListener('submit',async e=>{e.preventDefault();
    const payload={seasonSlug:season.slug,revision,productId:product.input.value,mode:mode.input.value,status:status.input.value,
     summary:summary.input.value,policyVersion:policy.input.value,notice:notice.input.value,startsAt:iso(start.input.value),endsAt:iso(end.input.value),accessDays:days.input.value||null};
    try{await edit.run(async()=>{const result=await A.call('offers-admin','save',payload);if(ticket!==generation||epoch!==A.epoch)return;
     revision=result.revision;edit.saved();A.status('이 기수의 상품 연결 정보를 저장했습니다. READ 공개나 결제 활성화는 실행하지 않았습니다.','ok');});}
    catch(error){if(ticket===generation&&epoch===A.epoch)A.status(error.message,'error');}
   });root.append(form,A.link(C.href('/nal/read/admin/cohorts/'),'이 기수의 일정·정원'),A.link(C.href('/nal/read/admin/'),'이 시즌 원고 편집'));
  }catch(e){if(ticket===generation&&e.name!=='AbortError')A.status(e.message,'error');}
 }
 function local(v){return v?new Date(Date.parse(v)+9*3600000).toISOString().slice(0,16):'';}
 function iso(v){return v?new Date(v+':00+09:00').toISOString():null;}
 A.ready.then(ok=>{if(ok)render();});A.onChange(render);window.addEventListener('popstate',render);
})();
