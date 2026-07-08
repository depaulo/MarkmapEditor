// @ts-check

/// <reference lib="webworker" />

/**
 * Service worker global scope alias for JS type checking.
 * Keeps this file as runtime-valid plain JavaScript.
 * @type {ServiceWorkerGlobalScope}
 */
const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

const APP_VERSION = 'markmap-journal-pwa-v29-editor-visibility-split';
const APP_CACHE = `${APP_VERSION}-app`;
const RUNTIME_CACHE = `${APP_VERSION}-runtime`;

const LOCAL_APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './css/theme.css',
  './css/layout.css',
  './css/toolbar.css',
  './css/editor.css',
  './css/map.css',
  './css/html-preview.css',
  './css/menus.css',
  './css/overlays.css',
  './css/workspace.css',
  './js/main.js',
  './js/app/script-loader.js',
  './js/ui/welcome.js',

  './js/ui/help.js',
  './js/templates/templates-data.js',
  './js/templates/templates-menu.js',
  './js/export/pandoc-layout-engine.js',
  './js/editor/codemirror-bootstrap.js',
  './js/editor/add-image.js',
  './js/editor/editor-visibility.js',
  './js/core/context.js',
  './js/pwa/diagnostics.js',
  './js/workspace/workspace-state.js',
  './js/workspace/workspace-open.js',
  './js/workspace/workspace-scanner.js',
  './js/workspace/workspace-sidebar.js',
  './js/workspace/workspace-actions.js',
  './js/workspace/workspace-highlight.js',
  './js/workspace/workspace-controller.js',
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

function isExternalRequest(request) {
  try {
    const url = new URL(request.url);
    return url.origin !== self.location.origin;
  } catch {
    return false;
  }
}

function isLikelyEssentialExternalModule(request) {
  try {
    const url = new URL(request.url);
    const href = url.href;

    return (
      href.includes('codemirror') ||
      href.includes('@codemirror') ||
      href.includes('markmap') ||
      href.includes('d3') ||
      href.includes('shiki') ||
      href.includes('esm.sh') ||
      href.includes('cdn.jsdelivr.net') ||
      href.includes('unpkg.com') ||
      href.includes('deno.land')
    );
  } catch {
    return false;
  }
}

async function handleExternalRequest(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);

    if (response && response.ok) {
      try {
        await cache.put(request, response.clone());
      } catch (err) {
        console.debug('External cache put skipped:', request.url, err);
      }
    }

    return response;
  } catch (error) {
    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    console.warn('External resource unavailable and not cached:', request.url, error);

    return new Response(`Offline external resource unavailable: ${request.url}`, {
      status: 504,
      statusText: 'Offline external resource unavailable',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
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

sw.addEventListener('install', (event) => {
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

  sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => ![APP_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key))
      );
    })
  );

  sw.clients.claim();
});

sw.addEventListener('fetch', (event) => {
  const request = event.request;

  if (!isHttpRequest(request)) {
    return;
  }

  const url = new URL(request.url);
  const isLocal = url.origin === sw.location.origin;

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

  if (isExternalRequest(request)) {
    event.respondWith(handleExternalRequest(request));
    return;
  }

  // Fallback for other requests.
  event.respondWith(
    fetch(request)
      .then((response) => {
        putInCache(RUNTIME_CACHE, request, response);
        return response;
      })
      .catch(async () => {
        return (
          (await caches.match(request)) ||
          new Response('Resource unavailable offline.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          })
        );
      })
  );
});
