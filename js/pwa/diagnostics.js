// @ts-nocheck
// ================================
// PWA diagnostics + service worker registration
// Uses existing log() panel through pwaDebugLog()
// ================================

async function pwaFetchCheck(url, label) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    const contentType = res.headers.get('content-type') || '';

    if (res.ok) {
      pwaDebugLog(`✅ ${label} reachable`, {
        url,
        status: res.status,
        contentType,
      });
    } else {
      pwaDebugLog(`❌ ${label} failed`, {
        url,
        status: res.status,
        statusText: res.statusText,
        contentType,
      });
    }

    return res;
  } catch (err) {
    pwaDebugLog(`❌ ${label} fetch error`, {
      url,
      error: String(err),
    });
    return null;
  }
}

function pwaImageCheck(url, label) {
  return new Promise((resolve) => {
    const img = new Image();

    img.onload = () => {
      pwaDebugLog(`✅ ${label} image loaded`, {
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
      resolve(true);
    };

    img.onerror = () => {
      pwaDebugLog(`❌ ${label} image failed to load`, { url });
      resolve(false);
    };

    img.src = url + (url.includes('?') ? '&' : '?') + 'pwa_diag=' + Date.now();
  });
}

async function checkPwaManifest() {
  pwaDebugLog('Checking manifest...');

  const link = document.querySelector('link[rel="manifest"]');

  if (!link) {
    pwaDebugLog('❌ No <link rel="manifest"> found');
    return;
  }

  const href = link.getAttribute('href');
  const manifestUrl = new URL(href, location.href).href;

  pwaDebugLog('✅ Manifest link found', {
    href,
    manifestUrl,
  });

  const res = await pwaFetchCheck(manifestUrl, 'Manifest');
  if (!res || !res.ok) return;

  let manifest;

  try {
    manifest = await res.json();
    pwaDebugLog('✅ Manifest JSON parsed', manifest);
  } catch (err) {
    pwaDebugLog('❌ Manifest JSON parse failed', {
      error: String(err),
    });
    return;
  }

  if (manifest.start_url) {
    const startUrl = new URL(manifest.start_url, manifestUrl).href;
    pwaDebugLog('✅ Manifest start_url resolved', { startUrl });
    await pwaFetchCheck(startUrl, 'Manifest start_url');
  } else {
    pwaDebugLog('⚠️ Manifest has no start_url');
  }

  if (manifest.scope) {
    pwaDebugLog('✅ Manifest scope resolved', {
      scope: new URL(manifest.scope, manifestUrl).href,
    });
  } else {
    pwaDebugLog('⚠️ Manifest has no scope');
  }

  if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    pwaDebugLog('❌ Manifest has no icons');
    return;
  }

  for (const icon of manifest.icons) {
    if (!icon.src) {
      pwaDebugLog('❌ Manifest icon has no src', icon);
      continue;
    }

    const iconUrl = new URL(icon.src, manifestUrl).href;

    pwaDebugLog('✅ Manifest icon entry found', {
      src: icon.src,
      resolvedUrl: iconUrl,
      sizes: icon.sizes,
      type: icon.type,
      purpose: icon.purpose,
    });

    await pwaFetchCheck(iconUrl, 'Manifest icon');
    await pwaImageCheck(iconUrl, 'Manifest icon');
  }
}

async function checkPwaServiceWorker() {
  pwaDebugLog('Checking service worker...');

  if (!('serviceWorker' in navigator)) {
    pwaDebugLog('❌ Service workers are not supported in this browser');
    return;
  }

  pwaDebugLog('✅ Service worker API available', {
    isSecureContext: window.isSecureContext,
    protocol: location.protocol,
    host: location.host,
  });

  try {
    const regs = await navigator.serviceWorker.getRegistrations();

    pwaDebugLog(
      'Service worker registrations found',
      regs.map((reg) => ({
        scope: reg.scope,
        active: reg.active ? reg.active.scriptURL : null,
        waiting: reg.waiting ? reg.waiting.scriptURL : null,
        installing: reg.installing ? reg.installing.scriptURL : null,
      }))
    );
  } catch (err) {
    pwaDebugLog('❌ Could not read service worker registrations', {
      error: String(err),
    });
  }

  if (navigator.serviceWorker.controller) {
    pwaDebugLog('✅ Current page is controlled by a service worker', {
      scriptURL: navigator.serviceWorker.controller.scriptURL,
      state: navigator.serviceWorker.controller.state,
    });
  } else {
    pwaDebugLog('⚠️ Current page is not controlled yet. Refresh once after registration.');
  }

  try {
    const ready = await navigator.serviceWorker.ready;

    pwaDebugLog('✅ navigator.serviceWorker.ready resolved', {
      scope: ready.scope,
      active: ready.active ? ready.active.scriptURL : null,
    });
  } catch (err) {
    pwaDebugLog('❌ navigator.serviceWorker.ready failed', {
      error: String(err),
    });
  }
}

async function checkPwaCaches() {
  pwaDebugLog('Checking Cache Storage...');

  if (!('caches' in window)) {
    pwaDebugLog('❌ Cache Storage API is not available');
    return;
  }

  let cacheNames = [];

  try {
    cacheNames = await caches.keys();
    pwaDebugLog('✅ Cache storage keys found', {
      caches: cacheNames,
    });
  } catch (err) {
    pwaDebugLog('❌ Could not read cache keys', {
      error: String(err),
    });
    return;
  }

  const criticalUrls = [
    new URL('./', location.href).href,
    new URL('./index.html', location.href).href,
    new URL('./manifest.webmanifest', location.href).href,
    new URL('./sw.js', location.href).href,
    new URL('./icon.svg', location.href).href,
    new URL('./icon-192.png', location.href).href,
    new URL('./icon-512.png', location.href).href,
  ];

  for (const cacheName of cacheNames) {
    try {
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();

      pwaDebugLog(`Cache inspected: ${cacheName}`, {
        entries: requests.length,
      });

      for (const url of criticalUrls) {
        const match = await cache.match(url);

        if (match) {
          pwaDebugLog('✅ Critical file found in cache', {
            cacheName,
            url,
            status: match.status,
            type: match.type,
          });
        }
      }
    } catch (err) {
      pwaDebugLog(`⚠️ Could not inspect cache: ${cacheName}`, {
        error: String(err),
      });
    }
  }
}

async function runPwaDiagnostics() {
  if (typeof PWA_DEBUG_LOGS !== 'undefined' && !PWA_DEBUG_LOGS) return;

  pwaDebugLog('Starting PWA diagnostics...', {
    href: location.href,
    origin: location.origin,
    pathname: location.pathname,
    online: navigator.onLine,
    secureContext: window.isSecureContext,
  });

  await pwaFetchCheck(new URL('./index.html', location.href).href, 'index.html');
  await pwaFetchCheck(
    new URL('./manifest.webmanifest', location.href).href,
    'manifest.webmanifest'
  );
  await pwaFetchCheck(new URL('./sw.js', location.href).href, 'sw.js');
  await checkPwaManifest();
  await checkPwaServiceWorker();
  await checkPwaCaches();

  pwaDebugLog('PWA diagnostics finished.');
}

window.runPwaDiagnostics = runPwaDiagnostics;

window.addEventListener('online', () => {
  pwaDebugLog('Browser went online.');
});

window.addEventListener('offline', () => {
  pwaDebugLog('Browser went offline.');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', {
        scope: './',
        updateViaCache: 'none',
      });

      pwaDebugLog('✅ Service worker registered', {
        scope: reg.scope,
        active: reg.active ? reg.active.scriptURL : null,
        waiting: reg.waiting ? reg.waiting.scriptURL : null,
        installing: reg.installing ? reg.installing.scriptURL : null,
      });
    } catch (err) {
      pwaDebugLog('❌ Service worker registration failed', {
        error: String(err),
      });
    }

    if (typeof PWA_DEBUG_LOGS !== 'undefined' && PWA_DEBUG_LOGS) {
      setTimeout(runPwaDiagnostics, 1000);
    }
  });
}
