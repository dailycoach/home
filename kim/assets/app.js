/* DAILYCOACHING mobile card v1.1.1 — framework-free, no tracking or remote QR APIs. */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const profile = JSON.parse($('#profile-data').textContent);
  const toastNode = $('#toast');
  let toastTimer;
  let mode = 'page';
  let qr = null;
  let installEvent = null;
  let wakeLock = null;
  let wakeRequested = false;

  const plain = (value) => String(value ?? '').replace(/[\r\n\x00-\x1f]/g, ' ').trim();
  const escVCard = (value) => String(value ?? '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
  function foldVCard(line) {
    const encoder = new TextEncoder();
    let output = '', current = '', length = 0;
    for (const character of line) {
      const bytes = encoder.encode(character).length;
      if (length + bytes > 75) { output += current + '\r\n'; current = ' '; length = 1; }
      current += character;
      length += bytes;
    }
    return output + current;
  }
  function publicHttps(value) {
    if (!value) return null;
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      if (url.protocol !== 'https:' || url.username || url.password) return null;
      if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || /(^|\.)(localhost|local|test|invalid|example)$/.test(host)) return null;
      url.hash = ''; url.search = '';
      return url.href;
    } catch { return null; }
  }
  const website = publicHttps(profile.website);
  const cardUrl = publicHttps(profile.cardUrl) || publicHttps(location.href);
  function makeVCard() {
    const fields = [
      'BEGIN:VCARD', 'VERSION:3.0',
      `N:${escVCard(profile.familyName)};${escVCard(profile.givenName)};;;`,
      `FN:${escVCard(profile.name)} 코치`,
      `NICKNAME:${escVCard(profile.englishName)}`,
      `ORG:${escVCard(profile.brand)}`,
      `TITLE:${escVCard(profile.title)}`,
      `EMAIL;TYPE=INTERNET,WORK:${plain(profile.email)}`
    ];
    if (plain(profile.phone)) fields.push(`TEL;TYPE=CELL,VOICE:${plain(profile.phone)}`);
    if (website) fields.push(`URL:${website}`);
    fields.push('END:VCARD');
    return fields.map(foldVCard).join('\r\n') + '\r\n';
  }
  const vcard = makeVCard();
  function toast(message) {
    clearTimeout(toastTimer);
    toastNode.textContent = message;
    toastNode.classList.add('show');
    toastTimer = setTimeout(() => toastNode.classList.remove('show'), 4500);
  }
  function triggerDownload(url, filename) {
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
  }
  function saveContact() {
    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, 'KIM_CHEOL_UNG.vcf');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast('연락처 파일을 열고, 연락처 앱에서 저장을 완료해 주세요.');
  }
  function qrSvg(matrix) {
    const n = matrix.getModuleCount(), side = n + 8;
    let path = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (matrix.isDark(r, c)) path += `M${c + 4} ${r + 4}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" aria-hidden="true" shape-rendering="crispEdges"><rect width="${side}" height="${side}" fill="#fff"/><path d="${path}" fill="#111"/></svg>`;
  }
  function renderQR() {
    const payload = mode === 'page' ? cardUrl : vcard;
    if (!payload) return;
    try {
      qr = DailyQR(payload);
      const svg = qrSvg(qr);
      $('#qr-code').innerHTML = svg;
      $('#large-qr').innerHTML = svg;
      $('#qr-type-label').textContent = mode === 'page' ? 'OPEN DIGITAL CARD' : 'SAVE CONTACT';
      $('#qr-state-label').textContent = mode === 'page' ? '명함 페이지' : '오프라인 가능';
      $('#qr-instruction').textContent = mode === 'page' ? '카메라로 스캔하면 명함이 열립니다.' : '카메라로 스캔해 연락처 저장을 진행하세요.';
      $('#large-qr-caption').textContent = mode === 'page' ? '카메라로 스캔하면 모바일 명함이 열립니다.' : '카메라로 스캔해 연락처 저장을 진행하세요.';
      $('#qr-code').setAttribute('aria-label', mode === 'page' ? '김철웅 코치 모바일 명함 페이지 QR 코드' : '김철웅 코치 연락처 QR 코드');
      $('#large-qr').setAttribute('aria-label', mode === 'page' ? '확대된 모바일 명함 페이지 QR 코드' : '확대된 연락처 QR 코드');
    } catch (error) {
      qr = null;
      $('#qr-code').textContent = 'QR을 만들지 못했습니다. 연락처 파일 저장을 이용해 주세요.';
      $('#expand-qr').disabled = true; $('#download-qr').disabled = true;
      console.error('QR creation failed:', error);
    }
  }
  function setMode(next) {
    if (next === 'page' && !cardUrl) { toast('실제 웹주소에 명함을 게시한 뒤 사용할 수 있습니다.'); return; }
    mode = next;
    for (const tab of ['contact', 'page']) {
      const node = $(`#mode-${tab}`);
      node.setAttribute('aria-selected', String(mode === tab));
      node.tabIndex = mode === tab ? 0 : -1;
    }
    $('#qr-panel').setAttribute('aria-labelledby', `mode-${mode}`);
    renderQR();
  }
  function showView(view, moveFocus = false) {
    const safe = ['card', 'qr', 'guide'].includes(view) ? view : 'card';
    $$('.view').forEach(node => { node.hidden = node.id !== `view-${safe}`; });
    $$('[data-nav]').forEach(button => {
      if (button.dataset.view === safe) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    if (moveFocus) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      $('#main').focus({ preventScroll: true });
    }
  }
  function openDialog(node) {
    if (node.open) return;
    if (typeof node.showModal === 'function') node.showModal();
    else { toast('이 브라우저에서는 팝업을 지원하지 않습니다. 최신 브라우저로 열어주세요.'); return; }
  }
  async function acquireWakeLock() {
    if (!wakeRequested || !$('#qr-dialog').open || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
    try {
      if (wakeLock) return;
      const acquired = await navigator.wakeLock.request('screen');
      if (!$('#qr-dialog').open) { await acquired.release(); return; }
      wakeLock = acquired;
      $('#wake-status').textContent = 'QR을 보여주는 동안 화면 켜짐을 유지합니다. 밝기는 직접 조절해 주세요.';
      acquired.addEventListener('release', () => {
        if (wakeLock === acquired) wakeLock = null;
        $('#wake-status').textContent = '화면 밝기를 높이면 인식하기 편합니다.';
      });
    } catch { $('#wake-status').textContent = '화면 밝기를 높이고, 꺼지지 않게 확인해 주세요.'; }
  }
  function releaseWakeLock() {
    wakeRequested = false;
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }
  function drawQR(context, matrix, left, top, cell) {
    const count = matrix.getModuleCount();
    const side = (count + 8) * cell;
    context.fillStyle = '#ffffff'; context.fillRect(left, top, side, side);
    context.fillStyle = '#111111';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (matrix.isDark(r, c)) context.fillRect(left + (c + 4) * cell, top + (r + 4) * cell, cell, cell);
  }
  function downloadQR() {
    if (!qr) { toast('QR을 만들지 못했습니다. 연락처 파일을 저장해 주세요.'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1440;
    const context = canvas.getContext('2d');
    if (!context) { toast('이 브라우저는 이미지 저장을 지원하지 않습니다. 화면 캡처를 이용해 주세요.'); return; }
    context.fillStyle = '#f7f5f0'; context.fillRect(0, 0, 1080, 1440);
    context.fillStyle = '#302a38';
    context.font = '600 34px -apple-system, BlinkMacSystemFont, "Malgun Gothic", "Noto Sans CJK KR", sans-serif';
    context.fillText('DAILYCOACHING', 88, 112);
    context.strokeStyle = '#d5ccde'; context.lineWidth = 2;
    context.beginPath(); context.moveTo(88, 150); context.lineTo(992, 150); context.stroke();
    context.font = '500 82px -apple-system, BlinkMacSystemFont, "Malgun Gothic", "Noto Sans CJK KR", sans-serif';
    context.fillText(profile.name, 85, 266);
    context.font = '400 27px -apple-system, BlinkMacSystemFont, "Malgun Gothic", "Noto Sans CJK KR", sans-serif';
    context.fillStyle = '#686070';
    context.fillText(`${profile.englishName}  /  ${profile.title}`, 90, 321);
    context.fillStyle = '#ffffff';
    context.beginPath();
    if (context.roundRect) context.roundRect(70, 370, 940, 940, 40);
    else context.rect(70, 370, 940, 940);
    context.fill();
    const cell = Math.floor(886 / (qr.getModuleCount() + 8));
    const side = cell * (qr.getModuleCount() + 8);
    drawQR(context, qr, Math.floor((1080 - side) / 2), 370 + Math.floor((940 - side) / 2), cell);
    context.fillStyle = '#62566d';
    context.font = '400 28px -apple-system, BlinkMacSystemFont, "Malgun Gothic", "Noto Sans CJK KR", sans-serif';
    context.textAlign = 'center';
    context.fillText(mode === 'page' ? 'SCAN TO OPEN THE CARD' : 'SCAN TO SAVE CONTACT', 540, 1372);
    triggerDownload(canvas.toDataURL('image/png'), mode === 'page' ? 'DAILYCOACHING_QR_PAGE.png' : 'DAILYCOACHING_QR_CONTACT.png');
    toast('이미지를 받은 뒤 갤러리에서 꺼내 보여주세요.');
  }
  function showShareFallback() {
    $('#share-url').value = cardUrl || website || '';
    $('#share-url-label').textContent = cardUrl ? '공개 모바일 명함 주소' : '기존 홈페이지 주소 (모바일 명함 주소 아님)';
    $('#share-explanation').textContent = cardUrl ? '주소를 복사해 보내거나 연락처 파일을 전달하세요.' : '모바일 명함 페이지는 아직 공개되지 않았습니다. 지금은 연락처 파일을 전달하거나 기존 홈페이지 주소를 공유할 수 있습니다.';
    openDialog($('#share-dialog'));
  }
  async function shareCard() {
    try {
      if (cardUrl && typeof navigator.share === 'function') {
        await navigator.share({ title: `${profile.name} | ${profile.brand}`, text: profile.tagline, url: cardUrl });
        return;
      }
      if (!cardUrl && navigator.share && navigator.canShare && typeof File === 'function') {
        const file = new File([vcard], 'KIM_CHEOL_UNG.vcf', { type: 'text/vcard' });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: `${profile.name} 코치 연락처` }); return; }
      }
    } catch (error) { if (error.name === 'AbortError') return; }
    showShareFallback();
  }
  async function copyURL() {
    const url = $('#share-url').value;
    if (!url) return;
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      toast('주소를 복사했습니다.');
    } catch {
      $('#share-url').focus(); $('#share-url').select();
      toast('선택된 주소를 길게 눌러 복사하거나 Ctrl/Cmd+C를 눌러주세요.');
    }
  }
  function installGuide() {
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    $('#install-state').textContent = standalone ? '현재 홈 화면에 추가된 웹앱으로 열려 있습니다.' : cardUrl ? '공개 명함 주소를 기기의 기본 브라우저에서 열고 추가하세요.' : '현재 파일 미리보기에서는 설치할 수 없습니다. 웹에 게시한 뒤 HTTPS 명함 주소를 브라우저에서 열어주세요.';
    $('#native-install').hidden = !installEvent || standalone;
    openDialog($('#install-dialog'));
  }
  async function nativeInstall() {
    if (!installEvent) return;
    try {
      await installEvent.prompt();
      const result = await installEvent.userChoice;
      installEvent = null;
      $('#native-install').hidden = true;
      if (result.outcome === 'accepted') $('#install-state').textContent = '브라우저의 설치 절차를 완료해 주세요.';
    } catch { toast('브라우저 메뉴의 홈 화면 추가를 이용해 주세요.'); }
  }
  // Apply only known profile fields. Optional contact channels stay hidden until configured.
  $$('[data-profile]').forEach(node => { node.textContent = String(profile[node.dataset.profile] ?? ''); });
  $('.philosophy').textContent = profile.tagline;
  document.title = `${profile.name} | ${profile.brand} 모바일 명함`;
  $('#large-qr-title').textContent = `${profile.name} 코치`;
  if (website) $('#website-link').href = website; else $('#website-link').hidden = true;
  $('#email-link').href = `mailto:${encodeURIComponent(plain(profile.email)).replace(/%40/g, '@')}`;
  if (plain(profile.phone)) {
    $('#phone-link').hidden = false; $('#phone-label').textContent = plain(profile.phone);
    $('#phone-link').href = `tel:${plain(profile.phone).replace(/[^\d+]/g, '')}`;
  }
  const kakao = publicHttps(profile.kakaoUrl);
  if (kakao) { $('#kakao-link').hidden = false; $('#kakao-link').href = kakao; }
  $('#mode-page').disabled = !cardUrl;
  $('#mode-page').title = cardUrl ? '공개 명함 페이지로 연결' : '실제 웹주소에 게시한 뒤 활성화';
  $('#local-notice').hidden = Boolean(cardUrl);
  // Navigation and keyboard access.
  $$('[data-view]').forEach(button => button.addEventListener('click', () => {
    const view = button.dataset.view;
    try { history.replaceState(null, '', `#${view}`); } catch { /* sandbox/file contexts may disallow history. */ }
    showView(view, true);
  }));
  window.addEventListener('hashchange', () => showView(location.hash.slice(1), true));
  $$('[data-save-contact]').forEach(button => button.addEventListener('click', saveContact));
  $('#mode-contact').addEventListener('click', () => setMode('contact'));
  $('#mode-page').addEventListener('click', () => setMode('page'));
  $('.mode-switch').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || !cardUrl) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'page' : event.key === 'End' ? 'contact' : mode === 'contact' ? 'page' : 'contact';
    setMode(next); $(`#mode-${next}`).focus();
  });
  $('#expand-qr').addEventListener('click', () => { if (!qr) return; openDialog($('#qr-dialog')); wakeRequested = true; acquireWakeLock(); });
  $('#qr-dialog').addEventListener('close', releaseWakeLock);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') acquireWakeLock(); });
  $('#download-qr').addEventListener('click', downloadQR);
  $('#large-qr-download').addEventListener('click', downloadQR);
  $('#share-top').addEventListener('click', shareCard);
  $('#copy-url').addEventListener('click', copyURL);
  $$('[data-install]').forEach(button => button.addEventListener('click', installGuide));
  $('#native-install').addEventListener('click', nativeInstall);
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installEvent = event; });
  window.addEventListener('appinstalled', () => { installEvent = null; $('#native-install').hidden = true; });
  $$('[data-close]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  $$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  }));
  window.addEventListener('pagehide', releaseWakeLock);
  renderQR();
  showView(location.hash.slice(1));
  // The standalone file deliberately does not register a service worker.
  if (document.documentElement.dataset.pwa === 'true' && 'serviceWorker' in navigator && window.isSecureContext && location.pathname.startsWith('/kim/') && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/kim/sw.js', { scope: '/kim/', updateViaCache: 'none' }).catch(() => { /* Online card remains usable when offline caching is not available. */ });
    });
  }
})();
