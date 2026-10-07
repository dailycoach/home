(() => {
 'use strict';
 const A=window.NalAccount;if(!A)return;const el=A.node;
 function section(parent,title,text){if(!text?.trim())return;const s=el('section','','nal-program-section');s.append(el('h2',title),el('p',text,'nal-program-copy'));parent.append(s);}
 function book(parent,value){if(!value?.title?.trim())return;const s=el('section','','nal-program-section');s.append(el('p','함께 읽을 책','nal-account-kicker'),el('h2',value.title));
  if(value.author)s.append(el('p',value.author,'nal-account-meta'));if(value.editionNote)s.append(el('p',value.editionNote,'nal-program-copy'));parent.append(s);
 }
 function render(parent,detail){
  const guide=detail.guide;
  if(guide){section(parent,'이런 분과 함께합니다',guide.forWhom);section(parent,'함께 남길 것',guide.takeAway);book(parent,guide.book);section(parent,'책은 이렇게 읽습니다',guide.readingNote);}
  if(detail.weeks?.length){
   const s=el('section','','nal-program-section');s.append(el('h2','주차별로 이어지는 질문'));
   for(const w of detail.weeks){const row=el('article','','nal-program-week');row.append(el('p','WEEK '+String(w.number).padStart(2,'0'),'nal-account-kicker'),el('h3',w.title));
    if(w.subtitle)row.append(el('p',w.subtitle,'nal-program-copy'));row.append(el('p','공개된 DAY '+w.days+'개','nal-account-meta'));s.append(row);}
   parent.append(s);
  }
  if(detail.liveSessions?.length){const s=el('section','','nal-program-section');s.append(el('h2','함께 만나는 시간'));
   for(const live of detail.liveSessions){const item=el('article','','nal-program-week');item.append(el('h3',live.title),el('p',A.date(live.startsAt)+' — '+A.date(live.endsAt)+' (한국 시간)','nal-account-meta'));
    if(live.status==='cancelled')item.append(el('p','취소된 일정','nal-account-note'));s.append(item);}
   s.append(el('p','Zoom 접속 주소는 참가자 LIVE 화면에서 확인합니다.','nal-account-note'));parent.append(s);
  }
  if(guide?.faq?.length){const s=el('section','','nal-program-section');s.append(el('h2','참여 전에 궁금한 것'));
   for(const item of guide.faq){const d=el('details','','nal-order-details');d.append(el('summary',item.question),el('p',item.answer,'nal-program-copy'));s.append(d);}parent.append(s);}
 }
 window.NalProgramSections={render,book,section};
})();
