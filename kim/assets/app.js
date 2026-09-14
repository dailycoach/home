/* DAILYCOACHING mobile card v1.2.0 — framework-free, no tracking or remote QR APIs. */
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
    try {
      qr = DailyQR(mode === 'page' ? cardUrl : vcard);
      $('#large-qr').innerHTML = qrSvg(qr);
      $('#large-qr').setAttribute('aria-label', mode === 'page' ? '김철웅 모바일 명함 QR 코드' : '김철웅 연락처 저장 QR 코드');
      $$('[data-download-qr]').forEach(node => { node.disabled = false; });
    } catch {
      qr = null;
      $('#large-qr').textContent = 'QR을 불러오지 못했습니다. 명함에서 연락처를 저장해 주세요.';
      $$('[data-download-qr]').forEach(node => { node.disabled = true; });
    }
  }
  function setMode(next) {
    mode = next === 'contact' ? 'contact' : 'page';
    ['page', 'contact'].forEach(value => {
      const node = $('#mode-' + value);
      node.setAttribute('aria-selected', String(mode === value));
      node.tabIndex = mode === value ? 0 : -1;
    });
    $('#qr-panel').setAttribute('aria-labelledby', 'mode-' + mode);
    renderQR();
  }
  function openDialog(dialog) {
    if (dialog.open) return;
    if (typeof dialog.showModal !== 'function') {
      toast('최신 브라우저에서 열어 주세요. 연락처 파일은 바로 저장할 수 있습니다.');
      return;
    }
    dialog.showModal();
    document.body.classList.add('dialog-open');
  }
  function openQR() {
    setMode('page');
    openDialog($('#qr-dialog'));
    if ($('#qr-dialog').open) {
      wakeRequested = true;
      acquireWakeLock();
      try { history.replaceState(null, '', '#qr'); } catch {}
    }
  }
  async function acquireWakeLock() {
    if (!wakeRequested || wakeLock || !$('#qr-dialog').open || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
    try {
      const acquired = await navigator.wakeLock.request('screen');
      if (!$('#qr-dialog').open) { await acquired.release(); return; }
      wakeLock = acquired;
      $('#wake-status').textContent = 'QR 화면 켜짐 유지';
      acquired.addEventListener('release', () => { if (wakeLock === acquired) wakeLock = null; });
    } catch {}
  }
  function releaseWakeLock() {
    wakeRequested = false;
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
    $('#wake-status').textContent = '';
  }
  function drawQR(context, matrix, left, top, cell) {
    const count = matrix.getModuleCount();
    context.fillStyle = '#fff'; context.fillRect(left, top, (count + 8) * cell, (count + 8) * cell);
    context.fillStyle = '#111';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (matrix.isDark(r, c)) context.fillRect(left + (c + 4) * cell, top + (r + 4) * cell, cell, cell);
  }
  async function downloadQR() {
    if (!$('#qr-dialog').open) setMode('page');
    if (!qr) return;
    const savedQR = qr, savedMode = mode;
    const canvas = document.createElement('canvas');
    canvas.width = 1080; canvas.height = 1920;
    const context = canvas.getContext('2d');
    if (!context) { toast('화면 캡처로 QR을 저장해 주세요.'); return; }
    context.fillStyle = '#f5f1e8'; context.fillRect(0, 0, 1080, 1920);
    try {
      const art = new Image(); art.src = './assets/signature-qr-v12.webp'; await art.decode();
      context.drawImage(art, 0, 0, 1080, 1920);
    } catch {}
    context.fillStyle = '#37332c'; context.textAlign = 'center';
    const font = '-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",sans-serif';
    context.font = '500 76px ' + font; context.fillText(profile.name, 540, 285);
    context.font = '400 28px ' + font; context.fillText(profile.englishName, 540, 349);
    context.fillStyle = '#fff'; context.fillRect(82, 455, 916, 916);
    const cell = Math.floor(880 / (savedQR.getModuleCount() + 8));
    const side = cell * (savedQR.getModuleCount() + 8);
    drawQR(context, savedQR, Math.floor((1080 - side) / 2), 455 + Math.floor((916 - side) / 2), cell);
    context.fillStyle = '#6d665c'; context.font = '400 28px ' + font;
    context.fillText('SCAN TO CONNECT', 540, 1460);
    context.font = '400 34px ' + font;
    context.fillText(savedMode === 'page' ? '명함 페이지' : '연락처 저장', 540, 1540);
    context.font = '500 27px ' + font; context.fillText('DAILYCOACHING', 540, 1770);
    triggerDownload(canvas.toDataURL('image/png'), savedMode === 'page' ? 'DAILYCOACHING_QR_PAGE.png' : 'DAILYCOACHING_QR_CONTACT.png');
    toast('QR 이미지를 저장했습니다.');
  }
  async function shareCard() {
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: profile.name + ' | ' + profile.brand, text: profile.tagline, url: cardUrl });
        return;
      }
    } catch (error) { if (error.name === 'AbortError') return; }
    $('#share-url').value = cardUrl;
    openDialog($('#share-dialog'));
  }
  async function copyURL() {
    try {
      await navigator.clipboard.writeText(cardUrl);
      toast('명함 주소를 복사했습니다.');
    } catch {
      $('#share-url').focus(); $('#share-url').select();
      toast('선택된 주소를 복사해 주세요.');
    }
  }
  function installGuide() {
    const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    $('#install-state').textContent = standalone ? '홈 화면에 추가된 명함으로 열려 있습니다.' : '휴대폰 브라우저에서 아래 메뉴를 선택하세요.';
    $('#native-install').hidden = !installEvent || standalone;
    openDialog($('#install-dialog'));
  }
  async function nativeInstall() {
    if (!installEvent) return;
    try {
      await installEvent.prompt(); await installEvent.userChoice;
      installEvent = null; $('#native-install').hidden = true;
    } catch { toast('브라우저 메뉴에서 홈 화면에 추가해 주세요.'); }
  }
  $('#show-qr').addEventListener('click', openQR);
  $$('[data-save-contact]').forEach(node => node.addEventListener('click', event => { event.preventDefault(); saveContact(); }));
  $$('[data-download-qr]').forEach(node => node.addEventListener('click', downloadQR));
  $('#mode-page').addEventListener('click', () => setMode('page'));
  $('#mode-contact').addEventListener('click', () => setMode('contact'));
  $('.mode-switch').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'page' : event.key === 'End' ? 'contact' : mode === 'page' ? 'contact' : 'page';
    setMode(next); $('#mode-' + next).focus();
  });
  $('#qr-dialog').addEventListener('close', () => {
    releaseWakeLock();
    if (location.hash === '#qr') { try { history.replaceState(null, '', location.pathname + location.search); } catch {} }
  });
  $('#share-top').addEventListener('click', shareCard);
  $('#copy-url').addEventListener('click', copyURL);
  $$('[data-install]').forEach(node => node.addEventListener('click', installGuide));
  $('#native-install').addEventListener('click', nativeInstall);
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installEvent = event; });
  window.addEventListener('appinstalled', () => { installEvent = null; $('#native-install').hidden = true; });
  $$('[data-close]').forEach(node => node.addEventListener('click', () => node.closest('dialog').close()));
  $$('dialog').forEach(dialog => {
    dialog.addEventListener('close', () => { if (!$$('dialog').some(node => node.open)) document.body.classList.remove('dialog-open'); });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') acquireWakeLock(); });
  window.addEventListener('pagehide', releaseWakeLock);
  window.addEventListener('hashchange', () => { if (location.hash === '#qr') openQR(); else if ($('#qr-dialog').open) $('#qr-dialog').close(); });
  renderQR();
  if (location.hash === '#qr') openQR();
  if ('serviceWorker' in navigator && window.isSecureContext && location.pathname.startsWith('/kim/')) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('/kim/sw.js', { scope: '/kim/', updateViaCache: 'none' }).catch(() => {}); });
  }
})();
