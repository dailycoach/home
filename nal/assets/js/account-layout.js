(() => {
 const main=document.querySelector('[data-account-shell]');if(!main)return;
 const h1=main.querySelector('h1')?.textContent||'MY NAL',lead=main.querySelector('p')?.textContent||'';
 main.innerHTML=`<header class="nal-account-header"><a href="/nal/" class="nal-account-brand">NAL · 날빛</a><nav aria-label="날 메뉴"><a href="/nal/shop/">마음도구</a><a href="/nal/read/cohorts/">READ 기수</a><a href="/nal/my/">MY NAL</a><a href="/nal/my/payments/">내 주문</a><a href="/nal/my/help/">내 문의</a><a href="/nal/my/privacy/">개인정보 요청</a></nav></header>
 <section class="nal-account-hero" data-offer-public><p class="nal-account-kicker">MY SPACE · NAL</p><h1></h1><p class="nal-account-lead"></p></section>
 <section class="nal-account-login-panel" aria-label="계정 연결">
  <div data-account-auth><form data-account-login class="nal-account-form"><label>내 기록을 연결할 이메일<input data-account-login-email type="email" autocomplete="email" required placeholder="name@example.com"></label><button type="submit" class="nal-account-button">이메일 로그인 링크 받기</button></form><p class="nal-account-note">기존에 사용한 이메일로 로그인하면 구매·참여 기록을 이어갈 수 있습니다.</p></div>
  <div data-account-user hidden><span data-account-email></span><button type="button" data-account-signout class="nal-account-link">로그아웃</button></div>
  <p data-account-status role="status" aria-live="polite" hidden></p>
 </section><div data-account-private hidden></div>
 <footer class="nal-account-footer"><a href="/nal/help/">이용 도움말</a><a href="/nal/my/waitlist/">내 대기 신청</a><a href="/nal/my/local/">이 기기의 찜·최근 본 항목</a><a href="/nal/policy/privacy/">개인정보 안내</a><a href="/nal/my/privacy/">개인정보 요청 상태</a><a href="/nal/policy/cancellation/">취소·환불 안내</a><a href="/nal/read/admin/home/">운영 홈</a><a href="/nal/read/admin/studio/">진행자 스튜디오</a><a href="/nal/read/admin/cohorts/">운영자 기수 관리</a><a href="/nal/read/admin/support/">운영자 문의함</a></footer>`;
 main.querySelector('h1').textContent=h1;main.querySelector('.nal-account-lead').textContent=lead;
 main.querySelector('[data-account-login]').addEventListener('submit',e=>e.preventDefault());
 // Return navigation is not authorization. All operation pages retain their server checks.
 if(location.pathname.startsWith('/nal/read/admin/')&&location.pathname!=='/nal/read/admin/home/'){
  const nav=document.createElement('nav');nav.className='nal-admin-return';nav.setAttribute('aria-label','운영 작업 이동');
  const a=document.createElement('a'),url=new URL('/nal/read/admin/home/',location.origin),q=new URLSearchParams(location.search);
  if(/^[a-z0-9-]{1,120}$/.test(q.get('season')||''))url.searchParams.set('season',q.get('season'));
  if(/^[1-4]$/.test(q.get('week')||''))url.searchParams.set('week',q.get('week'));
  a.href=url.pathname+url.search;a.textContent='← 운영 홈으로';a.className='nal-account-link';nav.append(a);
  main.querySelector('.nal-account-header').after(nav);
 }
})();
