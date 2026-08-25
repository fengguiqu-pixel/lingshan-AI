/**
 * 灵山胜境 AI 导游 - PWA Service Worker
 * 缓存策略：
 *   - HTML 页面：网络优先（保证内容最新），失败时回退到缓存
 *   - 静态资源（CSS/JS）：网络优先（保证代码最新），失败时回退到缓存
 *   - 图片/字体/图标：缓存优先（秒开）
 *   - API 请求：网络优先，不缓存（保证数据实时）
 */

const CACHE_VERSION = 'v2.7.0';
const STATIC_CACHE = `lingshan-static-${CACHE_VERSION}`;
const PAGES_CACHE = `lingshan-pages-${CACHE_VERSION}`;

// 安装时预缓存核心资源
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/admin',
  '/admin/',
  '/admin/visualization',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/css/style.css',
  '/js/app.js',
  '/js/ar-tour.js',
  '/js/data.js',
];

self.addEventListener('install', (event) => {
  console.log('[SW] Installing version:', CACHE_VERSION);
  event.waitUntil(
    caches.open(PAGES_CACHE).then((cache) => {
      // 不强求预缓存全部成功，缺失的文件不会阻塞安装
      return Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(url).catch(() => null))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== PAGES_CACHE)
          .map((key) => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 跳过非 GET 请求
  if (req.method !== 'GET') return;

  // 跳过 WebSocket / chrome-extension 等
  if (!url.protocol.startsWith('http')) return;

  // 跳过 API 请求（让浏览器直接走网络，保证数据实时）
  if (url.pathname.startsWith('/api/')) return;

  // 跳过 Live2D / 3D 模型等大文件（用浏览器默认缓存即可）
  if (url.pathname.includes('/live2d-models/')) return;
  if (url.pathname.includes('/vendor/')) return;

  // TTS 流式响应不缓存
  if (url.pathname.includes('/tts')) return;

  // 静态资源分类处理
  const isJS = /\.js(\?|$)/i.test(url.pathname);
  const isCSS = /\.css(\?|$)/i.test(url.pathname);
  const isImage = /\.(png|jpg|jpeg|svg|webp|ico|gif|woff2?|ttf|otf)$/i.test(url.pathname);

  if (isJS || isCSS) {
    // JS/CSS：网络优先（确保代码最新），失败回退缓存
    event.respondWith(networkFirst(req));
  } else if (isImage) {
    // 图片/字体：缓存优先（秒开）
    event.respondWith(cacheFirst(req));
  } else {
    // HTML / 页面：网络优先，失败回退到缓存
    event.respondWith(networkFirst(req));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    // 后台异步更新缓存（不阻塞返回）
    fetch(request)
      .then((res) => res && res.ok && caches.open(STATIC_CACHE).then((c) => c.put(request, res)))
      .catch(() => {});
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // 完全离线时返回兜底
    return new Response('离线资源不可用', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      // 仅缓存同源 GET 200 响应
      if (response.type === 'basic') {
        const cache = await caches.open(PAGES_CACHE);
        cache.put(request, response.clone());
      }
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // 兜底：导航请求返回主页
    if (request.mode === 'navigate') {
      const indexCache = await caches.match('/') || await caches.match('/index.html');
      if (indexCache) return indexCache;
    }
    return new Response('离线模式，请连接网络后重试', {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

// 接收页面消息：跳过等待（新版本立即生效）
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
