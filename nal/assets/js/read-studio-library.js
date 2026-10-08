(() => {
 'use strict';
 const A=window.NalAccount;if(!A)return;const el=A.node;
 const PRESET='nal-read-01-trend-2027-v1';
 function download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
 function section(title,body){const s=el('section','','nal-library-section');s.append(el('h3',title),el('p',body,'nal-program-copy'));return s;}
 function plainText(pack){
  const g=pack.guide,w=pack.week;
  return ['NAL READ 01 · 편집 원고 v'+pack.version,pack.common.notice,'\n# 참가자 안내',g.headline,g.introduction,
   '## 함께하는 분',g.forWhom,'## 남길 기록',g.takeAway,'## 읽기 안내',g.readingNote,
   '## 시작 전',g.beforeStart,'## 도서',g.book.title+' / '+g.book.author,g.book.editionNote,
   '## 준비 항목',...g.prepare.map(x=>x.title+'\n'+x.detail),
   '## 질문과 답변',...g.faq.map(x=>x.question+'\n'+x.answer),
   '\n# WEEK '+w.number+' '+w.code+' · '+w.minutes+'분 진행안',w.title,
   '읽기 길잡이: '+w.reading.chapterLabels.join(' / '),w.reading.scope,w.reading.question,
   '진행 목적',w.source.aim,'시작 멘트',w.source.opening,
   ...w.source.agenda.flatMap((x,i)=>['## '+(i+1)+'. '+x.title+' · '+x.minutes+'분',x.prompt,'[진행자 참고] '+x.notes]),
   '마치는 질문',w.source.closing,'실험 연결',w.source.followUp,'남길 기록',w.participantOutput,'대화 후 질문',w.afterLiveQuestion,
   '## 진행 약속',...pack.common.facilitatorCare,pack.common.mirrorTalk,
   '## 원고 연결',...w.anchors.map(a=>'DAY '+a.day+' / '+a.key+' — '+a.use),
   pack.common.origin.manuscript+' @ '+pack.common.origin.manuscriptBlob,
   '## 도서 확인 범위',pack.common.origin.bookScope,...pack.common.bibliography.sources.map(s=>s.url+' — '+s.scope)
  ].join('\n\n');
 }
 function mount(options){
  const {root,seasonSlug,weekNumber,isCurrent,applyGuide,applyPlan}=options;
  if(!root||!isCurrent())return;
  root.className='nal-studio-library';
  root.append(el('p','NAL READ 01 · FIRST SEASON','nal-account-kicker'),el('h2','빈칸에서 시작하지 않아도 됩니다.'),
   el('p','트렌드2027 참가자 안내와 4주·90분 진행 원고를 미리 보고 가져옵니다. 현재 선택한 주차만 불러오며, 서버 저장과 공개는 별도입니다.','nal-account-note'));
  const target=el('p',`대상: ${seasonSlug} / WEEK ${weekNumber}`,'nal-account-meta');root.append(target);
  const status=el('p','','nal-account-note');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const preview=el('div');let pack=null,busy=false;
  function button(text,action){const b=el('button',text,'nal-account-button');b.type='button';b.addEventListener('click',async()=>{
   if(busy||!isCurrent())return;busy=true;b.disabled=true;
   try{await action();}catch(e){if(isCurrent()&&e.name!=='AbortError')status.textContent=e.message;}
   finally{busy=false;if(b.isConnected)b.disabled=false;}
  });return b;}
  function paint(){
   preview.replaceChildren();
   preview.append(el('p',pack.common.rhythm,'nal-library-rhythm'));
   if(seasonSlug!==pack.intendedSeason)preview.append(el('p','다른 기수에 가져오는 중입니다. 책·주차·대상에 맞게 수정한 뒤 저장하세요. 원고가 자동으로 이 기수에 맞춰지는 것은 아닙니다.','nal-library-warning'));
   preview.append(el('p',pack.common.scheduleRule,'nal-account-note'));
   const outline=el('ol','','nal-library-outline');for(const w of pack.outline){const item=el('li',`WEEK ${w.number} ${w.code} · ${w.title}`);if(w.number===weekNumber)item.setAttribute('aria-current','true');outline.append(item);}preview.append(outline);
   const guide=el('details','','nal-order-details');guide.append(el('summary','참가자 안내 원고 전체 읽기'));
   for(const [key,label]of [['headline','소개 제목'],['introduction','프로그램 소개'],['forWhom','함께하는 분'],['takeAway','남길 기록'],['readingNote','읽기 안내'],['beforeStart','시작 전 안내']])guide.append(section(label,pack.guide[key]));
   guide.append(section('책',pack.guide.book.title+' · '+pack.guide.book.author+'\n'+pack.guide.book.editionNote));
   const prep=section('준비 체크','');for(const x of pack.guide.prepare)prep.append(el('h4',x.title),el('p',x.detail,'nal-program-copy'));guide.append(prep);
   const faq=section('질문과 답변','');for(const x of pack.guide.faq)faq.append(el('h4',x.question),el('p',x.answer,'nal-program-copy'));guide.append(faq);preview.append(guide);
   const w=pack.week,runbook=el('details','','nal-order-details');runbook.open=true;
   runbook.append(el('summary',`WEEK ${w.number} ${w.code} · ${w.minutes}분 진행 원고`),section(w.title,w.source.aim),section('시작 멘트',w.source.opening),
    section('책에서 읽을 곳 찾기',w.reading.chapterLabels.join(' / ')+'\n'+w.reading.question+'\n'+w.reading.scope));
   let minute=0;
   for(const part of w.source.agenda){const s=el('section','','nal-library-section');
    s.append(el('p',`${minute}–${minute+part.minutes}분 · ${part.title}`,'nal-account-kicker'),el('blockquote',part.prompt,'nal-program-copy'));
    minute+=part.minutes;const notes=el('details');notes.append(el('summary','진행자 멘트·운영 참고'),el('p',part.notes,'nal-program-copy'));s.append(notes);runbook.append(s);}
   runbook.append(section('대화 뒤 남길 기록',w.participantOutput+'\n'+w.afterLiveQuestion),section('실험 이어가기',w.source.followUp));
   const anchors=section('기존 DAY와의 연결','');for(const a of w.anchors)anchors.append(el('p',`DAY ${a.day} / ${a.key} — ${a.use}`,'nal-account-meta'));runbook.append(anchors);
   preview.append(runbook);
   const care=el('details','','nal-order-details');care.append(el('summary','2~3인 대화 운영과 진행 약속'),section('MIRROR TALK',pack.common.mirrorTalk));
   for(const text of pack.common.facilitatorCare)care.append(el('p',text,'nal-program-copy'));preview.append(care);
   const actions=el('div','','nal-account-actions');
   actions.append(button('참가자 안내를 편집창에 가져오기',()=>{
    if(!confirm(`${seasonSlug}\n현재 안내 편집 내용을 READ 01 안내 원고로 바꿀까요? 미저장 변경이 있다면 덮어씁니다. 서버 저장본·공개본은 지금 바뀌지 않습니다.`))return;
    if(!isCurrent())return;applyGuide(structuredClone(pack.guide));status.textContent='참가자 안내를 편집창에 가져왔습니다. 내용을 다듬고 초안 저장 후 별도로 공개를 승인하세요.';
   }),button(`WEEK ${weekNumber} 90분 진행안 가져오기`,()=>{
    if(!confirm(`${seasonSlug} / WEEK ${weekNumber}\n현재 진행 순서와 멘트를 이 원고로 바꿀까요? 기존 운영 회고와 선택한 LIVE는 유지하고 작성 상태는 초안으로 바꿉니다. 서버 저장은 하지 않습니다.`))return;
    if(!isCurrent())return;applyPlan(structuredClone(pack.week.source));status.textContent='이번 주 90분 진행안을 편집창에 가져왔습니다. 기존 운영 회고와 LIVE 선택은 유지했습니다. 시간을 맞춰보고 진행안 저장을 눌러주세요.';
   }),button('현재 원고 텍스트 보관',()=>{
    if(!isCurrent())return;download('NAL-READ01-W'+weekNumber+'-editorial-v'+pack.version+'.txt',plainText(pack));
   }));preview.append(actions,el('p','텍스트 파일은 이번 원고의 진행자 참고를 포함합니다. 참가자 개인정보나 실제 회고 기록을 추출하는 기능은 아닙니다.','nal-account-note'));
  }
  const load=button('READ 01 안내·이번 주 원고 미리 보기',async()=>{
   status.textContent='편집 원고를 불러오고 있습니다.';
   const result=await A.companion('studio-preset',seasonSlug,{presetId:PRESET,weekNumber});
   if(!isCurrent())return;
   if(result.id!==PRESET||result.week?.number!==weekNumber||result.reviewStatus!=='draft'||!Array.isArray(result.week.source?.agenda))throw new Error('원고 응답을 확인하지 못했습니다. 다시 열어주세요.');
   pack=result;paint();status.textContent='미리보기만 열었습니다. 참가자 안내·진행안·공개본은 아직 바뀌지 않았습니다.';
  });root.append(load,status,preview);
 }
 window.NalReadStudioLibrary={mount};
})();
