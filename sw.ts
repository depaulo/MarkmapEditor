/// <reference lib="webworker" />

export {}; // makes TS treat file as a module

declare const self: ServiceWorkerGlobalScope;

const APP_VERSION = 'markmap-editor-pwa-v8';
const APP_CACHE = `${APP_VERSION}-app`;
const RUNTIME_CACHE = `${APP_VERSION}-runtime`;

const LOCAL_APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
];

const CDN_APP_SHELL = [
  'https://cdn.jsdelivr.net/npm/d3@7',
  'https://cdn.jsdelivr.net/npm/markmap-lib',
  'https://cdn.jsdelivr.net/npm/markmap-view',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://cdn.jsdelivr.net/npm/shiki@4.0.2/+esm',

  // CodeMirror modules used by your import map
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/state/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/view/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/commands/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/search/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/lang-markdown/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/language/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/autocomplete/dist/index.js',

  // Dependencies commonly loaded by those modules
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/node_modules/@lezer/markdown/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/node_modules/@lezer/common/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/node_modules/@lezer/highlight/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/node_modules/@lezer/lr/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/node_modules/style-mod/src/style-mod.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/node_modules/w3c-keyname/index.es.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/node_modules/crelt/index.es.js',
];

function isHttpRequest(request) {
  try {
    const url = new URL(request.url);
    return request.method === 'GET' && (url.protocol === 'http:' || url.protocol === 'https:');
  } catch {
    return false;
  }
}

function isSafeToCacheResponse(response) {
  if (!response) return false;

  // Avoid opaque responses. They can break module/CSS requests when replayed offline.
  return (
    response.status === 200 &&
    (response.type === 'basic' || response.type === 'cors' || response.type === 'default')
  );
}

async function putInCache(cacheName, request, response) {
  try {
    if (!isHttpRequest(request)) return;
    if (!isSafeToCacheResponse(response)) return;

    const responseCopy = response.clone();
    const cache = await caches.open(cacheName);
    await cache.put(request, responseCopy);
  } catch (err) {
    console.debug('Cache put skipped:', request.url, err);
  }
}

async function precacheOne(cache, url) {
  try {
    const request = new Request(url, { cache: 'reload' });
    const response = await fetch(request);

    if (isSafeToCacheResponse(response)) {
      await cache.put(request, response.clone());
      console.log('Precached:', url);
    } else {
      console.warn('Precache skipped, unsafe response:', url, response.status, response.type);
    }
  } catch (err) {
    console.warn('Precache skipped:', url, err);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then(async (cache) => {
      // Cache local files first.
      for (const url of LOCAL_APP_SHELL) {
        await precacheOne(cache, url);
      }

      // Cache CDN files opportunistically.
      // If offline, these will fail gracefully.
      for (const url of CDN_APP_SHELL) {
        await precacheOne(cache, url);
      }
    })
  );

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => ![APP_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (!isHttpRequest(request)) {
    return;
  }

  const url = new URL(request.url);
  const isLocal = url.origin === self.location.origin;

  // Navigation fallback.
  // Cache-first for installed PWA stability.
  // This avoids the case where online Netlify returns a bad/empty/404 response,
  // while offline works because cached index.html is available.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cachedApp =
          (await caches.match('./index.html')) ||
          (await caches.match('/index.html')) ||
          (await caches.match('./')) ||
          (await caches.match('/'));

        // Try network in background to refresh runtime cache,
        // but do not let a bad online response break the installed app.
        const networkUpdate = fetch(request)
          .then((response) => {
            const contentType = response.headers.get('content-type') || '';

            if (response && response.ok && contentType.includes('text/html')) {
              putInCache(RUNTIME_CACHE, request, response);
            }

            return response;
          })
          .catch(() => null);

        // If we already have cached app shell, use it immediately.
        if (cachedApp) {
          networkUpdate.catch(() => {});
          return cachedApp;
        }

        // First install / no cache yet: use network if valid.
        const networkResponse = await networkUpdate;

        if (networkResponse && networkResponse.ok) {
          return networkResponse;
        }

        return new Response('Offline and index.html is not cached yet.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        });
      })()
    );

    return;
  }

  // Local files: cache first, then network.
  if (isLocal) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request)
          .then((response) => {
            putInCache(RUNTIME_CACHE, request, response);
            return response;
          })
          .catch(async () => {
            return (
              (await caches.match(request)) ||
              new Response('Local resource unavailable offline.', {
                status: 503,
                headers: { 'Content-Type': 'text/plain' },
              })
            );
          });
      })
    );
    return;
  }

  // External/CDN files: cache first, then network.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          putInCache(RUNTIME_CACHE, request, response);
          return response;
        })
        .catch(() => {
          // Avoid uncaught promise rejection.
          return new Response('', {
            status: 504,
            statusText: 'Offline external resource unavailable',
          });
        });
    })
  );
});
