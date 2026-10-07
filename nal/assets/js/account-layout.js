(() => {
 const main=document.querySelector('[data-account-shell]');if(!main)return;
 const h1=main.querySelector('h1')?.textContent||'MY NAL',lead=main.querySelector('p')?.textContent||'';
 // Layout HTML is constant; titles, offers and private data use textContent only.
 main.innerHTML=`<header class="nal-account-header"><a href="/nal/" class="nal-account-brand">NAL · 날빛</a><nav aria-label="날 메뉴"><a href="/nal/shop/">마음도구</a><a href="/nal/shop/read/">NAL READ</a><a href="/nal/my/">MY NAL</a></nav></header>
 <section class="nal-account-hero" data-offer-public><p class="nal-account-kicker">MY SPACE · NAL</p><h1></h1><p class="nal-account-lead"></p></section>
 <section class="nal-account-login-panel" aria-label="계정 연결">
  <div data-account-auth><form data-account-login class="nal-account-form"><label>내 기록을 연결할 이메일<input data-account-login-email type="email" autocomplete="email" required placeholder="name@example.com"></label><button type="submit" class="nal-account-button">이메일 로그인 링크 받기</button></form><p class="nal-account-note">기존에 사용한 이메일로 로그인하면 구매·참여 기록을 이어갈 수 있습니다.</p></div>
  <div data-account-user hidden><span data-account-email></span><button type="button" data-account-signout class="nal-account-link">로그아웃</button></div>
  <p data-account-status role="status" aria-live="polite" hidden></p>
 </section><div data-account-private hidden></div>
 <footer class="nal-account-footer"><a href="/nal/my/local/">이 기기의 찜·최근 본 항목</a><a href="/nal/policy/privacy/">개인정보 안내</a><a href="/nal/policy/cancellation/">취소·환불 안내</a></footer>`;
 main.querySelector('h1').textContent=h1;main.querySelector('.nal-account-lead').textContent=lead;
 // Prevent accidental native form navigation while the asynchronous Auth client initializes.
 main.querySelector('[data-account-login]').addEventListener('submit',e=>e.preventDefault());
})();
