// 灵山胜境 AI导游 - 手机版 Service Worker
const CACHE_NAME = 'lingshan-mobile-v1';
const STATIC_ASSETS = [
  '/mobile/',
  '/mobile/index.html',
  '/mobile/css/mobile.css',
  '/mobile/js/data.js',
  '/mobile/js/mobile-app.js',
  '/mobile/manifest.json',
  '/mobile/icons/favicon-16.png',
  '/mobile/icons/favicon-32.png',
  '/mobile/icons/icon-192.png',
  '/mobile/icons/icon-256.png',
  '/mobile/icons/icon-512.png',
  '/mobile/icons/apple-touch-icon.png',
  '/mobile/icons/maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // API 请求走网络
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ error: 'offline' }), { status: 503 })));
    return;
  }

  // 静态资源优先缓存
  event.respondWith(
    caches.match(request).then(cached => {
      return cached || fetch(request).then(response => {
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
