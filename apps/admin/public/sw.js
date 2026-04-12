// @ts-nocheck  -  plain JavaScript service worker (not processed by TypeScript)

var CACHE_NAME = 'revealui-admin-v2';
var MUTATION_STORE = 'revealui-offline-mutations';

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

  // Queue offline mutations (POST/PUT/PATCH/DELETE to /api/) for replay on reconnect.
  if (request.method !== 'GET' && isApiRequest(request.url)) {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        // Network unavailable: queue the mutation for later replay
        var body = await request.clone().text();
        var mutation = {
          url: request.url,
          method: request.method,
          headers: Object.fromEntries(request.headers.entries()),
          body: body,
          timestamp: Date.now(),
        };
        var db = await openMutationStore();
        var tx = db.transaction(MUTATION_STORE, 'readwrite');
        tx.objectStore(MUTATION_STORE).add(mutation);
        return new Response(JSON.stringify({ queued: true }), {
          status: 202,
          headers: { 'Content-Type': 'application/json' },
        });
      }),
    );
    return;
  }

  // Only handle GET requests for caching strategies.
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

// ---------- Offline Mutation Store (IndexedDB) ----------

function openMutationStore() {
  return new Promise((resolve, reject) => {
    var request = indexedDB.open('revealui-sw', 1);
    request.onupgradeneeded = () => {
      var db = request.result;
      if (!db.objectStoreNames.contains(MUTATION_STORE)) {
        db.createObjectStore(MUTATION_STORE, { autoIncrement: true });
      }
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
}

// ---------- Flush Offline Mutations on Reconnect ----------

async function flushMutations() {
  try {
    const db = await openMutationStore();
    const tx = db.transaction(MUTATION_STORE, 'readonly');
    const store = tx.objectStore(MUTATION_STORE);

    const allKeys = await new Promise((resolve, reject) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    const allMutations = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    // Replay mutations in order (FIFO)
    for (let i = 0; i < allMutations.length; i++) {
      const mutation = allMutations[i];
      try {
        await fetch(mutation.url, {
          method: mutation.method,
          headers: mutation.headers,
          body: mutation.body || undefined,
        });
        // Remove successfully replayed mutation
        const deleteTx = db.transaction(MUTATION_STORE, 'readwrite');
        deleteTx.objectStore(MUTATION_STORE).delete(allKeys[i]);
      } catch (_err) {
        // Network still down or server error: stop replaying, try again later
        break;
      }
    }
  } catch (_err) {
    // IndexedDB not available: nothing to flush
  }
}

// Flush queued mutations when the browser comes back online
self.addEventListener('message', (event) => {
  if (event.origin !== self.location.origin) return;
  if (event.data && event.data.type === 'FLUSH_MUTATIONS') {
    flushMutations();
  }
});
