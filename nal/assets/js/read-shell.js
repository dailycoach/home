/* BUILD16 — one location, one visible feedback region; no private values in navigation. */
(() => {
 'use strict';const main=document.querySelector('[data-read-shell]');if(!main)return;
 const title=main.querySelector('h1')?.textContent||'NAL READ',description=main.querySelector('p')?.textContent||'';
 const slug=document.body.dataset.season||'trend-2027';if(!/^[a-z0-9-]{1,120}$/.test(slug))return;
 const page=document.body.dataset.readDailyPage||document.body.dataset.readWorkspacePage||'today';
 const names={before:'BEFORE · 시작 전의 나',day:'DAY · 오늘의 질문',today:'TODAY · 오늘 이어갈 자리',journey:'JOURNEY · 질문 여정',try:'TRY · 작은 실험',live:'LIVE · 함께 대화',my:'MY NAL · 내 문장',report:'MY REPORT · 내 기록 한 권'};
 const modes={before:'작성 중인 답은 초안으로 저장합니다. 답변 기록과 DAY 완료는 직접 선택합니다.',day:'작성 중인 답은 초안으로 저장합니다. 답변 기록과 DAY 완료는 직접 선택합니다.',
  try:'계획과 돌아보기는 저장 버튼을 눌러 남깁니다. 화면을 옮기기 전에 저장 상태를 확인하세요.',
  live:'대화 전후 메모는 나의 개인 기록입니다. 저장은 직접 선택하며 다른 사람에게 자동 전송하지 않습니다.',
  report:'미리보기·파일 저장·보관한 리포트는 다릅니다. 보관하기를 눌러야 서버에 별도 리포트가 남습니다.'};
 main.innerHTML=`<header class="read-topbar"><a class="read-brand" href="/nal/read/">NAL READ</a><nav class="read-actions" aria-label="내 기록 안내"><a class="read-inline-link" href="/nal/my/">전체 MY NAL</a><a class="read-inline-link" data-arrival-link>시작 안내</a><a class="read-inline-link" data-report-link>내 리포트</a><a class="read-inline-link" data-help-link>문의하기</a></nav></header>
 <p class="read-location" data-read-location></p>
 <section class="read-feedback" data-read-feedback aria-label="저장·연결 안내">
  <p class="read-activity" data-read-activity role="status" aria-live="polite" aria-atomic="true" hidden></p>
  <p class="read-network" data-read-network role="status" aria-live="polite" hidden></p>
  <p class="read-unsaved" data-read-unsaved hidden></p>
  <p class="read-status" data-daily-status role="status" aria-live="polite" aria-atomic="true" hidden></p>
  <div class="read-feedback-actions" data-read-recovery hidden><button type="button" data-read-reload>내용 보관 후 다시 불러오기</button><button type="button" data-read-login-focus>로그인 위치로</button><a href="/nal/help/" target="_blank" rel="noopener noreferrer">도움말 새 창으로</a></div>
 </section>
 <section class="read-public-intro"><p class="read-eyebrow">NAL · 날빛</p><h1></h1><p data-description></p></section>
 <p class="read-save-explainer" data-read-save-explainer hidden></p>
 <div data-private-root hidden></div>
 <section class="read-panel read-account-panel" aria-label="내 계정">
  <div data-daily-auth><form class="read-auth-form" data-daily-auth-form><label class="read-field"><span>내 기록을 연결할 이메일</span><input data-daily-login-email type="email" autocomplete="email" required placeholder="name@example.com"></label><button class="read-button secondary" type="submit">이메일 로그인 링크 받기</button></form></div>
  <div class="read-account" data-daily-account hidden><p><b data-daily-email></b>로 로그인했습니다.</p><button class="read-button secondary" type="button" data-daily-signout>로그아웃</button></div>
 </section>`;
 main.querySelector('.read-public-intro h1').textContent=title;main.querySelector('[data-description]').textContent=description;
 main.querySelector('[data-read-location]').textContent=names[page]||'NAL READ';
 const mode=main.querySelector('[data-read-save-explainer]');if(modes[page]){mode.textContent=modes[page];mode.hidden=false;}
 main.querySelector('[data-arrival-link]').href='/nal/read/start/?season='+encodeURIComponent(slug);
 main.querySelector('[data-help-link]').href='/nal/my/help/?tab=new&season='+encodeURIComponent(slug);
 const report=main.querySelector('[data-report-link]');report.href='/nal/read/'+slug+'/report/';if(page==='report')report.setAttribute('aria-current','page');
 if(!document.querySelector('[data-read-nav]')){const nav=document.createElement('nav');nav.className='read-bottom-nav';nav.dataset.readNav='';nav.setAttribute('aria-label','NAL READ 메뉴');document.body.append(nav);}
 // Shared legacy shells receive the same small feedback stylesheet when this source is loaded.
 if(!document.querySelector('[data-read-feedback-style]')){const style=document.createElement('link');style.rel='stylesheet';style.href='/nal/assets/css/nal-read-feedback.css?v=build16';style.dataset.readFeedbackStyle='';document.head.append(style);}
 main.querySelector('[data-daily-auth-form]').addEventListener('submit',e=>e.preventDefault());
})();
