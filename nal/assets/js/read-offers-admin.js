(() => {
 'use strict';const A=window.NalAccount;if(!A)return;const el=A.node,root=document.querySelector('[data-account-private]');let generation=0;
 const field=(label,value='',tag='input')=>{const wrap=el('label',label),input=el(tag);input.value=value??'';wrap.append(input);return{wrap,input};};
 function choose(label,options,value){const x=field(label,'','select');for(const [v,t]of options){const o=el('option',t);o.value=v;x.input.append(o);}x.input.value=value;return x;}
 async function render(){const ticket=++generation;if(!A.user){root.replaceChildren();root.hidden=true;return;}
  try{const data=await A.call('offers-admin','list');if(ticket!==generation)return;root.replaceChildren();root.hidden=false;
   root.append(el('h2','시즌과 상품 연결'),el('p','가격은 기존 카탈로그 값을 사용합니다. 여기서는 결제 설정, READ 공개 스위치, 참가자 권한을 변경하지 않습니다.','nal-account-note'));
   for(const season of data.seasons||[]){const f=season.offer||{},form=el('form','','nal-account-record nal-account-form');form.append(el('h3',season.title));
    let revision=f.revision||0;
    const product=choose('연결할 카탈로그 상품',(data.products||[]).map(p=>[p.id,`${p.title||p.id} · ${p.price==null?'가격 미정':A.money(p.price)} · ${p.published?'공개':'비공개'}`]),f.catalog_id||'');
    const mode=choose('참가권 유형',[['paid','결제 확인 주문 연결'],['free','0원 상품 무료 참여'],['invitation','기존 계정 초대권']],f.mode||'paid');
    const status=choose('상품 안내 상태',[['draft','초안'],['listed','소개만 공개'],['accepting','참가권 연결 허용'],['closed','등록 마감']],f.status||'draft');
    const summary=field('소개 문장',f.summary||'','textarea');summary.input.maxLength=1200;
    const policy=field('참여 안내 버전',f.policy_version||'');policy.input.required=true;policy.input.maxLength=80;
    const notice=field('참여·이용 안내 원문',f.participation_notice||'','textarea');notice.input.required=true;notice.input.maxLength=8000;
    const start=field('등록 시작 (한국 시간)',local(f.starts_at)),end=field('등록 마감 (한국 시간)',local(f.ends_at));start.input.type=end.input.type='datetime-local';
    const days=field('참가권 이용일수 (빈칸은 별도 만료일 없음)',f.access_days||'');days.input.type='number';days.input.min='1';days.input.max='3660';
    [product,mode,status,summary,policy,notice,start,end,days].forEach(x=>form.append(x.wrap));
    const save=el('button','연결 초안 저장','nal-account-button');save.type='submit';form.append(save);
    form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;
     try{const result=await A.call('offers-admin','save',{seasonSlug:season.slug,revision,productId:product.input.value,mode:mode.input.value,status:status.input.value,
      summary:summary.input.value,policyVersion:policy.input.value,notice:notice.input.value,startsAt:iso(start.input.value),endsAt:iso(end.input.value),accessDays:days.input.value||null});
      revision=result.revision;A.status('상품 연결 정보를 저장했습니다. READ 공개나 결제 활성화는 실행하지 않았습니다.','ok');
     }catch(error){A.status(error.message,'error');}finally{save.disabled=false;}
    });root.append(form);
   }
   if(!data.seasons?.length)root.append(el('p','먼저 콘텐츠 편집 화면에서 시즌을 만들어주세요.','nal-account-empty'));root.append(A.link('/nal/read/admin/','콘텐츠 편집으로'));
  }catch(e){if(e.name!=='AbortError')A.status(e.message,'error');}
 }
 function local(v){if(!v)return '';const d=new Date(Date.parse(v)+9*3600000);return d.toISOString().slice(0,16);}
 function iso(v){return v?new Date(v+':00+09:00').toISOString():null;}
 A.ready.then(ok=>{if(ok)render();});A.onChange(render);
})();
