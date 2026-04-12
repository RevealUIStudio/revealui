// @ts-nocheck  -  plain JavaScript service worker (not processed by TypeScript)

var CACHE_NAME = 'revealui-admin-v1';

var PRE_CACHE_URLS = ['/', '/admin', '/login'];

// ---------- Install ----------

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRE_CACHE_URLS)));
  // Activate immediately without waiting for existing clients to close.
  self.skipWaiting();
});

// ---------- Activate ----------

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))),
      ),
  );
  // Claim all open clients so the new SW takes effect immediately.
  self.clients.claim();
});

// ---------- Fetch ----------

/**
 * Check whether a URL path starts with /api/.
 */
function isApiRequest(url) {
  var parsed = new URL(url);
  return parsed.pathname.startsWith('/api/');
}

/**
 * Check whether a URL looks like a static asset based on its file extension.
 */
function isStaticAsset(url) {
  var pathname = new URL(url).pathname;
  return (
    pathname.endsWith('.js') ||
    pathname.endsWith('.css') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.jpeg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.webp') ||
    pathname.endsWith('.avif') ||
    pathname.endsWith('.woff') ||
    pathname.endsWith('.woff2') ||
    pathname.endsWith('.ico')
  );
}

/**
 * Check whether the request is a navigation (HTML page load).
 */
function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

self.addEventListener('fetch', (event) => {
  var request = event.request;

  // Only handle GET requests  -  mutations go straight to the network.
  if (request.method !== 'GET') {
    return;
  }

  // --- API requests: network-first, fall back to cache ---
  if (isApiRequest(request.url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache a clone for offline fallback.
          var clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // --- Static assets: cache-first, fall back to network ---
  if (isStaticAsset(request.url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request).then((response) => {
          var clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
          return response;
        });
      }),
    );
    return;
  }

  // --- Navigation (HTML): network-first, fall back to cached app shell ---
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          var clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
          return response;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }
});
