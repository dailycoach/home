/* BUILD15 — preserve where an experiment started, without rewriting stored editions. */
(() => {
 'use strict';const N=window.NalRead;if(!N)return;
 const root=document.querySelector('[data-private-root]'),el=N.node;
 let generation=0,source=null,edition=null,marker={},pendingRequest=null,busy=false;
 const context=()=>({generation,epoch:N.epoch}),current=c=>c.generation===generation&&c.epoch===N.epoch&&!!N.user;
 const call=(action,payload={})=>N.api('report',action,{payload});
 const route=(view,params={})=>{const q=new URLSearchParams({season:N.slug,view});for(const[k,v]of Object.entries(params))if(v!=null)q.set(k,String(v));return '/nal/read/open/?'+q;};
 const text=a=>a.text??(Array.isArray(a.value?.values)?a.value.values.join(', '):a.value?.value!=null?String(a.value.value):'');
 const button=(label,fn,secondary=true)=>{const b=el('button',label,'read-button'+(secondary?' secondary':''));b.type='button';b.addEventListener('click',async()=>{if(busy)return;const c=context();b.disabled=true;try{await fn(c);}catch(e){if(current(c))N.error(e);}finally{if(b.isConnected)b.disabled=false;}});return b;};
 function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type})),a=el('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
 function section(parent,title){const s=el('section','','nal-report-section');s.append(el('h2',title));parent.append(s);return s;}
 function records(parent,items){if(!items.length){parent.append(el('p','아직 남긴 기록이 없습니다.','read-empty'));return;}
  for(const a of items){const item=el('article','','nal-report-entry');item.append(el('p',a.prompt||a.dayTitle,'nal-report-question'),el('blockquote',text(a)||'기록 없음','read-own-sentence'));parent.append(item);}}
 function renderSnapshot(snap,target){
  target.replaceChildren();target.className='nal-personal-report';
  const cover=el('header','','nal-report-cover');cover.append(el('p',snap.seasonTitle||'NAL READ','read-eyebrow'),el('h1',snap.cover?.title||'MY 2027'));
  if(snap.cover?.displayName)cover.append(el('p',snap.cover.displayName,'nal-report-name'));
  cover.append(el('p',snap.stage==='complete'?'28일의 기록':`현재까지의 기록 · ${snap.completedDays||0}/${snap.plannedDays||28} DAY`),el('p',N.date(snap.generatedAt),'read-meta'));
  target.append(cover,el('p',snap.notice||'내가 직접 남긴 기록입니다.','nal-report-notice'));
  const answers=snap.answers||[],comparison=section(target,'01 · 그때와 지금의 나');
  const scales=answers.filter(a=>a.type==='SCALE'&&a.measureKey&&[0,28].includes(a.dayNumber)),pairs=new Map();
  for(const a of scales){const k=a.measureKey+'@'+a.measureVersion,p=pairs.get(k)||{};p[a.dayNumber===0?'before':'after']=a;pairs.set(k,p);}
  if(!pairs.size)comparison.append(el('p','비교할 시작·마지막 문항이 아직 없습니다.'));
  else{const table=el('table','','nal-report-comparison');table.append(el('caption','동일 문항에 대해 내가 선택한 1~5 값'));
   const tr=el('tr');for(const t of ['문항','처음','지금']){const th=el('th',t);th.scope='col';tr.append(th);}const thead=el('thead');thead.append(tr);table.append(thead);const tbody=el('tbody');
   for(const {before,after}of pairs.values()){
    const row=el('tr'),label=el('th',before?.prompt||after?.prompt||'');label.scope='row';row.append(label);
    const valid=a=>Number.isInteger(a?.value?.value)&&a.value.value>=1&&a.value.value<=5,matched=!before||!after||before.prompt===after.prompt;
    row.append(el('td',valid(before)?String(before.value.value):'기록 없음'),el('td',matched?(valid(after)?String(after.value.value):'기록 없음'):'문항 변경 · 비교하지 않음'));tbody.append(row);
   }table.append(tbody);comparison.append(table);
  }
  comparison.append(el('p','점수의 높고 낮음으로 성장이나 효과를 판정하지 않습니다. 기록하지 않은 값은 0으로 바꾸지 않습니다.','read-meta'));
  records(section(target,'02 · 내가 알아차린 삶의 신호'),answers.filter(a=>a.dayNumber>=1&&a.dayNumber<=7&&a.type!=='MULTI_SELECT'));
  const experiments=section(target,'03 · 생각하고, 해보고, 돌아본 것');
  if(!(snap.experiments||[]).length)experiments.append(el('p','아직 저장한 실험이 없습니다.'));
  const states={planned:'생각해둔 일',started:'해보는 중',paused:'잠시 멈춤',completed:'해봤어요',cancelled:'다르게 선택했어요'};
  for(const x of snap.experiments||[]){const a=el('article','','nal-report-entry');a.append(el('h3',x.title),el('p',`WEEK ${x.week_number} · ${states[x.status]||x.status}`,'read-meta'));
   const origin=x.source_snapshot;
   if(origin?.version===1){
    a.append(el('p','이 실험의 출발점 · DAY '+origin.dayNumber+' / STEP '+origin.stepOrder,'nal-report-question'));
    if(origin.prompt)a.append(el('p',origin.prompt));if(origin.text)a.append(el('blockquote',origin.text,'read-own-sentence'));
    a.append(el('p','실험을 만들 당시의 문장입니다. 리포트의 다른 DAY 답변은 이 리포트를 모은 시점의 기록일 수 있습니다.','read-meta'));
   }
   if(x.intention)a.append(el('p','해보려던 일'),el('p',x.intention));
   a.append(el('p','해보고 알게 된 것'),el('blockquote',x.reflection||'돌아보기는 아직 남기지 않았습니다.','read-own-sentence'));experiments.append(a);
  }
  records(section(target,'04 · AI × ME × TOGETHER'),answers.filter(a=>['work-ai','work-me','work-together','work-priority','work-responsibility'].includes(a.reportKey)));
  records(section(target,'05 · 나의 감각과 선택'),answers.filter(a=>a.dayNumber>=22&&a.dayNumber<=26&&a.type==='QUESTION'));
  const chosenIds=Array.isArray(snap.selectedAnswerIds)?snap.selectedAnswerIds:answers.filter(a=>a.starred).slice(0,12).map(a=>a.id);
  records(section(target,'06 · 내가 중요하게 남긴 문장'),chosenIds.map(id=>answers.find(a=>a.id===id)).filter(Boolean));
  const conversation=section(target,'07 · 대화에서 남은 것');
  for(const l of snap.liveNotes||[]){const a=el('article','','nal-report-entry');a.append(el('h3',l.title),el('p','WEEK '+l.weekNumber+' · 개인 대화 메모','read-meta'));
   if(l.beforeNote)a.append(el('p','대화 전'),el('blockquote',l.beforeNote,'read-own-sentence'));
   if(l.afterNote)a.append(el('p','대화 뒤'),el('blockquote',l.afterNote,'read-own-sentence'));conversation.append(a);}
  if(!(snap.liveNotes||[]).length)conversation.append(el('p','아직 남긴 대화 메모가 없습니다.'));
  conversation.append(el('p','개인 메모가 있다는 사실은 실제 참석이나 다른 사람에게 내용을 공유했다는 확인이 아닙니다.','read-meta'));
  records(section(target,'08 · MY NEXT MOVE'),answers.filter(a=>a.dayNumber===27));
  records(section(target,'09 · 나에게 남기는 마지막 문장'),answers.filter(a=>a.dayNumber===28&&a.type==='QUESTION'));
  if(snap.cover?.closingNote)section(target,'이 기록을 다시 읽으며').append(el('blockquote',snap.cover.closingNote,'read-own-sentence'));
  target.append(el('footer','NAL READ · 이 문장들은 내가 직접 남긴 기록입니다.','nal-report-footer'));
 }
 function setupComposer(snapshot,container){
  source=snapshot;edition=null;pendingRequest=null;const form=el('fieldset','','read-report-controls');form.append(el('legend','내 리포트 구성'));
  function field(title,val,max,multi=false){const w=el('label','','read-field'),input=el(multi?'textarea':'input');input.value=val;input.maxLength=max;if(multi)input.rows=4;w.append(el('span',title),input);form.append(w);return input;}
  const title=field('표지 제목',N.slug==='trend-2027'?'MY 2027':'MY NAL',120),name=field('표지에 남길 이름','',80),closing=field('지금 이 기록을 다시 읽으며 남길 말','',3000,true);
  const selections=el('details','','read-report-selection');selections.append(el('summary','중요한 문장 고르기 · 최대 12개'));
  for(const a of snapshot.answers||[]){if(!text(a).trim())continue;const w=el('label','','read-local-option'),c=el('input');c.type='checkbox';c.value=a.id;c.checked=!!a.starred&&selections.querySelectorAll('input:checked').length<12;
   w.append(c,document.createTextNode(`DAY ${a.dayNumber} · ${text(a).slice(0,120)}`));selections.append(w);}
  form.append(selections);
  const report=el('div'),actions=el('div','','read-actions'),history=el('section','','read-panel');container.append(form,actions,history,report);
  const compose=()=>({...source,cover:{title:title.value.trim()||'MY NAL',displayName:name.value.trim(),closingNote:closing.value},selectedAnswerIds:[...selections.querySelectorAll('input:checked')].map(x=>x.value)});
  const checked=()=>{const data=compose();if(data.selectedAnswerIds.length>12)throw new Error('중요한 문장은 12개까지 골라주세요.');return data;};
  const changed=()=>{N.setDirty(marker,true);pendingRequest=null;edition=null;};form.addEventListener('input',changed);form.addEventListener('change',changed);
  actions.append(button('현재 기록 미리보기',()=>{edition=null;renderSnapshot(checked(),report);report.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}));
  actions.append(button('이 시점의 리포트 보관',async c=>{
   const data=checked();form.disabled=true;busy=true;
   try{pendingRequest??=crypto.randomUUID();const result=await call('save',{requestId:pendingRequest,...data.cover,selectedAnswerIds:data.selectedAnswerIds});if(!current(c))return;
    edition=result;N.setDirty(marker,false);renderSnapshot(result.snapshot,report);N.status('현재 기록을 별도 리포트로 보관했습니다. 이전 보관본은 다시 쓰지 않습니다.','ok');await loadHistory(c);
   }finally{busy=false;if(form.isConnected)form.disabled=false;}
  },false));
  actions.append(button('인쇄 / PDF 저장',()=>{renderSnapshot(edition?.snapshot||checked(),report);window.print();}));
  actions.append(button('기록 JSON 저장',()=>download('NAL-'+N.slug+'-report.json',JSON.stringify(edition?.snapshot||checked(),null,2),'application/json;charset=utf-8')));
  actions.append(button('리포트 HTML 저장',()=>{
   const view=el('div');renderSnapshot(edition?.snapshot||checked(),view);
   const html='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NAL · 내 기록</title><style>body{font-family:system-ui,sans-serif;max-width:780px;margin:3rem auto;padding:0 1.5rem;line-height:1.9}h1{font-size:3rem}section{padding:2rem 0;border-top:1px solid #ccc}blockquote{margin:1rem 0;padding-left:1rem;border-left:2px solid;white-space:pre-wrap}p{white-space:pre-wrap}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:.6rem;text-align:left}@media print{section{break-before:page}article{break-inside:avoid}}</style><body>'+view.innerHTML+'</body></html>';
   download('NAL-'+N.slug+'-report.html',html,'text/html;charset=utf-8');
  }));
  const loadHistory=async c=>{
   const data=await call('list');if(!current(c))return;history.replaceChildren(el('h2','보관한 리포트'));
   if(!data.editions?.length)history.append(el('p','아직 보관한 리포트가 없습니다. 미리보기와 파일 저장은 지금도 사용할 수 있습니다.'));
   for(const x of data.editions||[])history.append(button(`${N.date(x.created_at)} · ${x.title} · ${x.stage==='complete'?'28일 기록':'중간 기록'}`,async ctx=>{
    const opened=await call('open',{id:x.id});if(!current(ctx))return;edition=opened;renderSnapshot(opened.snapshot,report);N.status('보관된 시점의 기록입니다. 당시 없던 실험 연결은 나중에 덧붙이지 않습니다.','ok');
   }));
  };
  renderSnapshot(compose(),report);const c=context();loadHistory(c).catch(e=>{if(current(c))N.error(e);});
 }
 async function render(){const ticket=++generation;source=null;edition=null;pendingRequest=null;N.setDirty(marker,false);marker={};root.replaceChildren();root.hidden=true;if(!N.user)return;
  try{const result=await call('source');if(ticket!==generation)return;root.hidden=false;root.append(el('p','MY REPORT','read-eyebrow'),el('h1','내 기록이 한 권이 됩니다.','read-step-prompt'),el('p','내 답·실험·대화 기록을 모읍니다. 생각만 해둔 일과 직접 해본 일을 구분해서 남깁니다.','read-step-copy'));
   const routes=el('div','','read-actions');routes.append(N.link(route('my'),'내 답 다시 읽기'),N.link(route('try'),'실험 돌아보기'),N.link(route('live'),'LIVE 메모로 돌아가기'));root.append(routes);
   setupComposer(result.snapshot,root);N.status('');
  }catch(e){if(ticket===generation)N.error(e);}
 }
 N.ready.then(ok=>{if(ok)render();});window.addEventListener('nal:session',render);
})();
