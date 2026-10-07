(() => {
 'use strict';
 const main=document.querySelector('[data-read-shell]');if(!main)return;
 const title=main.querySelector('h1')?.textContent||'NAL READ';
 const description=main.querySelector('p')?.textContent||'';
 const slug=document.body.dataset.season||'trend-2027';
 if(!/^[a-z0-9-]{1,120}$/.test(slug))return;
 // Only fixed layout is HTML. Manuscripts and private records use textContent.
 main.innerHTML=`<header class="read-topbar"><a class="read-brand" href="/nal/read/">NAL READ</a><a class="read-inline-link" href="/nal/my/">전체 MY NAL</a><a class="read-inline-link" data-report-link>MY REPORT →</a></header>
 <section class="read-public-intro"><p class="read-eyebrow">NAL · 날빛</p><h1></h1><p data-description></p></section>
 <div data-private-root hidden></div>
 <section class="read-panel read-account-panel" aria-label="내 계정">
  <div data-daily-auth><form class="read-auth-form" data-daily-auth-form><label class="read-field"><span>내 기록을 연결할 이메일</span><input data-daily-login-email type="email" autocomplete="email" required placeholder="name@example.com"></label><button class="read-button secondary" type="submit">이메일 로그인 링크 받기</button></form></div>
  <div class="read-account" data-daily-account hidden><p><b data-daily-email></b>로 로그인했습니다.</p><button class="read-button secondary" type="button" data-daily-signout>로그아웃</button></div>
  <p class="read-status" data-daily-status role="status" aria-live="polite">내 기록을 준비하고 있습니다.</p>
 </section>`;
 main.querySelector('.read-public-intro h1').textContent=title;
 main.querySelector('[data-description]').textContent=description;
 const report=main.querySelector('[data-report-link]');report.href='/nal/read/'+slug+'/report/';
 if(document.body.dataset.readWorkspacePage==='report')report.setAttribute('aria-current','page');
 const nav=document.createElement('nav');nav.className='read-bottom-nav';nav.dataset.readNav='';nav.setAttribute('aria-label','NAL READ 메뉴');document.body.append(nav);
})();
