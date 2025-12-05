// Eink-It PWA Service Worker
// Version: 1.0.0

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `eink-it-static-${CACHE_VERSION}`;
const ARTICLE_CACHE = `eink-it-articles-${CACHE_VERSION}`;
const FONT_CACHE = `eink-it-fonts-${CACHE_VERSION}`;

// Static assets to precache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/list.html',
  '/reader.html',
  '/css/common.css',
  '/css/login.css',
  '/css/list.css',
  '/css/reader.css',
  '/js/config.js',
  '/js/auth.js',
  '/js/list.js',
  '/js/reader.js',
  '/js/offline-cache.js',
  '/js/common.js',
  '/lib/supabase.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-180.png',
  '/icons/favicon-96x96.png',
  '/icons/favicon.ico',
  '/icons/favicon.svg'
];

// Install event: Precache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Precaching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Precache failed:', error);
      })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return name.startsWith('eink-it-') &&
                     name !== STATIC_CACHE &&
                     name !== ARTICLE_CACHE &&
                     name !== FONT_CACHE;
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event: Intelligent routing
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Navigation requests: serve shell pages from cache regardless of search params
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(url));
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Strategy 1: Static assets - Cache First
  if (STATIC_ASSETS.some(asset => url.pathname === asset || url.pathname === asset + '/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
  // Strategy 2: Supabase API - Network First (with cache fallback)
  else if (url.hostname.includes('supabase.co')) {
    event.respondWith(networkFirst(request, ARTICLE_CACHE));
  }
  // Strategy 3: CDN fonts - Stale While Revalidate
  else if (url.hostname.includes('googleapis.com') ||
           url.hostname.includes('gstatic.com') ||
           url.hostname.includes('jsdelivr.net')) {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
  }
  // Default: Network only (for other requests)
  else {
    event.respondWith(fetch(request));
  }
});

// Cache First strategy (for static assets)
async function cacheFirst(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    // Try exact match first, then fall back to path-only match (ignoring search)
    const cached = (await cache.match(request)) || (await cache.match(request.url.split('?')[0]));

    if (cached) {
      console.log('[SW] Cache hit:', request.url);
      return cached;
    }

    console.log('[SW] Cache miss, fetching:', request.url);
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache first failed:', error);
    throw error;
  }
}

// Network First strategy (for API requests)
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    console.log('[SW] Network first, fetching:', request.url);
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      console.log('[SW] Caching API response:', request.url);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.warn('[SW] Network failed, trying cache:', request.url);
    const cached = await cache.match(request);

    if (cached) {
      console.log('[SW] Serving from cache:', request.url);
      return cached;
    }

    // Return offline response if no cache available
    console.error('[SW] No cache available for:', request.url);
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'No cached data available. Please check your connection.'
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Stale While Revalidate strategy (for fonts)
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Background fetch and cache update
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        console.log('[SW] Updating font cache:', request.url);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch((error) => {
      console.warn('[SW] Font fetch failed:', request.url, error);
      return cached;
    });

  // Return cached version immediately, or wait for network
  return cached || fetchPromise;
}

// Handle navigation with cached shell fallback (ignores search params)
async function handleNavigationRequest(url) {
  try {
    return await fetch(url.href);
  } catch (error) {
    console.warn('[SW] Navigation network failed, serving shell from cache:', url.href);
    const cache = await caches.open(STATIC_CACHE);
    const fallbackPath = url.pathname.includes('reader') ? '/reader.html' : '/list.html';
    const cached = await cache.match(fallbackPath);
    return cached || Response.error();
  }
}

// Listen for messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name.startsWith('eink-it-'))
            .map((name) => caches.delete(name))
        );
      }).then(() => {
        return self.registration.unregister();
      })
    );
  }
});
