/* Same-origin card assets only. The scope prefix prevents deleting other apps' caches. */
const SCOPE = new URL(self.registration.scope);
const PREFIX = 'dailycoaching-card-' + encodeURIComponent(SCOPE.pathname) + '-';
const CACHE = PREFIX + 'v1.1.1-phone-20260914';
const FILES = ['./assets/brand-hero.webp', './', './index.html', './assets/styles.css', './assets/app.js', './assets/qr.js', './assets/icon-192.png', './assets/icon-512.png', './assets/apple-touch-icon.png', './manifest.webmanifest', './KIM_CHEOL_UNG.vcf'];
const ASSETS = FILES.map(path => new URL(path, SCOPE).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const clean = url.origin + url.pathname;
  if (url.origin !== SCOPE.origin || !ASSETS.includes(clean)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') await cache.put(clean, response.clone());
      return response;
    } catch {
      const cached = await cache.match(clean);
      if (cached) return cached;
      return new Response('오프라인 저장이 준비되지 않았습니다. 인터넷 연결 후 다시 열어주세요.', { status: 503, headers: { 'Content-Type': 'text/plain;charset=utf-8' } });
    }
  })());
});
