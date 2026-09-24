// @ts-check

/// <reference lib="webworker" />

/**
 * Service worker global scope alias for JS type checking.
 * Keeps this file as runtime-valid plain JavaScript.
 * @type {ServiceWorkerGlobalScope}
 */
const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

// APP_VERSION is the single authoritative release/version owner. It names the
// installed cache identity (APP_CACHE / RUNTIME_CACHE) for this release
// boundary: MarkmapEditor 0.6.0 — Help and Release Notes foundation
// (permanent Help content, contextual Help, Release Notes viewer, What's New,
// and the canonical release identity module). All changed assets are
// deterministic precache entries, so a new identity ensures installed clients
// receive the complete accepted package.
const APP_VERSION = 'markmap-journal-pwa-0.6.0-help-release-foundation';
// Stable base prefix for every cache this application owns. Activation cleanup
// deletes only caches matching this prefix so unrelated origin caches are
// never touched.
const CACHE_PREFIX = 'markmap-journal-pwa-';
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
  // Release Notes and contextual Help stylesheets (index.html <link> +
  // script-loader.js appendStylesheet). Precached so the 0.6.0 offline shell
  // renders the complete Release Notes and contextual Help surfaces.
  './css/release-notes.css',
  './css/contextual-help.css',
  // Screen Layout runtime stylesheet. Loaded dynamically by script-loader.js
  // (appendStylesheet) — precached here so it is a deterministic release asset
  // instead of a stale-able runtime-cached copy (S4B device-testing finding).
  './css/view-layout.css',
  './js/navigation/navigation-history.js',
  './js/main.js',
  './js/app/script-loader.js',
  // Screen Layout pane registry. Loaded dynamically by script-loader.js before
  // main.js so MME_VIEW_LAYOUT exists when pane adapters register.
  './js/ui/view-layout.js',
  './js/ui/welcome.js',

  './js/ui/help.js',
  // Release foundation (0.6.0 Help and Release Notes). Loaded by
  // script-loader.js in this same order (release identity first).
  './js/release/release.js',
  './js/ui/help-content.js',
  './js/ui/release-notes-content.js',
  './js/ui/release-notes.js',
  './js/ui/contextual-help.js',
  './js/templates/templates-data.js',
  './js/templates/templates-menu.js',
  './js/templates/metadata-templates.js',
  './js/editor/frontmatter-visibility.js',
  './js/links/wiki-links.js',
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
  './js/workspace/workspace-parser.js',
  './js/workspace/workspace-host.js',
  './js/workspace/workspace-capabilities.js',
  './js/workspace/mode-runtime-sessions.js',
  './js/workspace/journal-workspace.js',
  './js/workspace/workspace-index-workspace.js',
  './js/workspace/workspace-index-document.js',
  './js/core/mode-session.js',

  // Dynamically loaded workspace modules (script-loader.js)
  './js/workspace/workspace-parser.js',
  './js/tasks/task-lifecycle.js',
  './js/workspace/workspace-host.js',
  './js/workspace/workspace-capabilities.js',
  './js/workspace/mode-runtime-sessions.js',
  './js/render/render-controller.js',
  './js/editor/editor-visibility.js',
  './js/editor/frontmatter-visibility.js',
  './js/links/wiki-links.js',
  './js/workspace/task-review.js',
  './js/templates/metadata-templates.js',

  // Simple Task Board Quick View (T1B acceptance surface). Loaded via
  // script-loader.js after task-review.js; css loaded via appendStylesheet.
  './js/tasks/task-board.js',
  './css/task-board.css',
  './js/templates/templates-menu.js',
  './js/export/export-actions.js',
  './js/export/export-menu.js',

  // Deterministic Update Ready runtime assets (0.6.1). Loaded via index.html
  // (stylesheet + script before diagnostics.js).
  './css/update-ready.css',
  './js/pwa/update-ready.js',

  // Dynamically loaded Report/Draw.io modules (script-loader.js).
  // Required offline for the Quick Report panel and the Draw.io Report
  // workflow (H1 importer, H2 reconciler, H3/H4 panel). Order follows the
  // script-loader registration order.
  './js/report/report-markdown-import.js',
  './js/report/drawio-report-reconciler.js',
  './js/report/drawio-report-panel.js',
  './js/report/report-dictionary.js',
  './js/report/quick-report-generator.js',
  './js/report/report-panel.js',
];

// Deterministic external dependencies required for offline Markmap rendering
// and offline HTML Preview. Single canonical definition: install precaches
// these into APP_CACHE (CORS copies, which the browser also accepts for the
// classic no-cors element requests) and the fetch route serves them
// cache-first, so online and offline share one identity.
const DETERMINISTIC_CDN_SHELL = [
  // Engine globals (index.html classic script tags).
  'https://cdn.jsdelivr.net/npm/d3@7',
  'https://cdn.jsdelivr.net/npm/markmap-lib',
  'https://cdn.jsdelivr.net/npm/markmap-view',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  // markmap-lib 0.18.12 per-feature assets, resolved at runtime by
  // Transformer.getUsedAssets(features) through the default jsDelivr provider:
  //   hljs  → styles/default.min.css, preloadScripts/highlight.min.js
  //   katex → styles/katex.min.css, preloadScripts/katex.min.js,
  //           scripts/webfontloader.js (defer)
  // These are version-pinned by markmap-lib's own defaults; a markmap-lib
  // upgrade requires re-checking this list (documented review point).
  'https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.11.1/styles/default.min.css',
  'https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.11.1/highlight.min.js',
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/katex.min.css',
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/katex.min.js',
  'https://cdn.jsdelivr.net/npm/webfontloader@1.6.28/webfontloader.js',
];

// Complete static module closure of the CodeMirror importmap graph.
// index.html pins codemirror/ → codemirror_esm@v6.0.1; codemirror-bootstrap.js
// imports 7 entry modules whose full static dependency crawl yields exactly
// these 20 unique modules (single origin, no query strings, no bare
// specifiers). Version-pinned by the importmap; a pin change requires
// re-crawling this list (documented review point).
const DETERMINISTIC_CODEMIRROR_SHELL = [
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/state/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/view/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/commands/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/search/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/lang-markdown/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/language/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/autocomplete/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/node_modules/@lezer/common/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/node_modules/@lezer/highlight/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/node_modules/@lezer/html/dist/index.es.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/node_modules/@lezer/css/dist/index.es.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/node_modules/@lezer/javascript/dist/index.es.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/node_modules/@lezer/lr/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/node_modules/@lezer/markdown/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/lang-html/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/lang-css/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/lang-javascript/dist/index.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/node_modules/style-mod/src/style-mod.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/node_modules/w3c-keyname/index.es.js',
  'https://deno.land/x/codemirror_esm@v6.0.1/esm/node_modules/crelt/index.es.js',
];

// KaTeX offline presentation assets: all 20 WOFF2 files referenced by the
// katex.min.css @font-face src lists. woff2 is the first supported format in
// each src list, so serving it prevents the woff/ttf fallback requests.
// WOFF and TTF are deliberately not cached (browsers stop at the first
// successfully loading source). Version-pinned by katex@0.16.18.
const DETERMINISTIC_KATEX_FONT_SHELL = [
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/fonts/KaTeX_AMS-Regular.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/fonts/KaTeX_Caligraphic-Bold.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/fonts/KaTeX_Caligraphic-Regular.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/fonts/KaTeX_Fraktur-Bold.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/fonts/KaTeX_Fraktur-Regular.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/fonts/KaTeX_Main-Bold.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/fonts/KaTeX_Main-BoldItalic.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/fonts/KaTeX_Main-Italic.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/fonts/KaTeX_Main-Regular.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/fonts/KaTeX_Math-BoldItalic.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/fonts/KaTeX_Math-Italic.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/fonts/KaTeX_SansSerif-Bold.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/fonts/KaTeX_SansSerif-Italic.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/fonts/KaTeX_SansSerif-Regular.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/fonts/KaTeX_Script-Regular.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/fonts/KaTeX_Size1-Regular.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/fonts/KaTeX_Size2-Regular.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/fonts/KaTeX_Size3-Regular.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/fonts/KaTeX_Size4-Regular.woff2',
  'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/fonts/KaTeX_Typewriter-Regular.woff2',
];

// Shiki offline presentation graph (shiki@4.0.2, jsDelivr +esm). The +esm
// entry is NOT self-contained: it statically imports three @shikijs modules
// (proven from the live jsDelivr response Link headers and the bundle source),
// whose transitive static closure is exactly 24 modules, and its bundled
// createHighlighter lazily imports the Oniguruma engine wasm entry
// (engine: () => createOnigurumaEngine(import("/npm/shiki@4.0.2/wasm/+esm"))),
// which is invoked on every HTML Preview startup.
//
// DETERMINISTIC_SHIKI_SHELL (26) = 24 static ESM modules in total (including
// the shiki@4.0.2/+esm entry) + 2 engine/WASM ESM modules
// (shiki@4.0.2/wasm/+esm → @shikijs/engine-oniguruma@4.0.2/wasm-inlined/+esm,
// which carries the base64-inlined oniguruma wasm; no external .wasm fetch,
// no worker, no other runtime asset exists in the graph).
//
// Version pinning is explicit (exact semver + /+esm). A shiki upgrade requires
// re-crawling this closure (documented review point). Runtime
// language/theme data are pinned separately in DETERMINISTIC_SHIKI_GRAMMAR_SHELL
// and DETERMINISTIC_SHIKI_THEME_SHELL because they change with the
// js/main.js initShiki() configuration, not with the module graph.
const DETERMINISTIC_SHIKI_SHELL = [
  'https://cdn.jsdelivr.net/npm/shiki@4.0.2/+esm',
  'https://cdn.jsdelivr.net/npm/@shikijs/core@4.0.2/+esm',
  'https://cdn.jsdelivr.net/npm/@shikijs/engine-javascript@4.0.2/+esm',
  'https://cdn.jsdelivr.net/npm/@shikijs/engine-oniguruma@4.0.2/+esm',
  'https://cdn.jsdelivr.net/npm/shiki@4.0.2/wasm/+esm',
  'https://cdn.jsdelivr.net/npm/@shikijs/engine-oniguruma@4.0.2/wasm-inlined/+esm',
  'https://cdn.jsdelivr.net/npm/@shikijs/primitive@4.0.2/+esm',
  'https://cdn.jsdelivr.net/npm/@shikijs/types@4.0.2/+esm',
  'https://cdn.jsdelivr.net/npm/@shikijs/vscode-textmate@10.0.2/+esm',
  'https://cdn.jsdelivr.net/npm/hast-util-to-html@9.0.5/+esm',
  'https://cdn.jsdelivr.net/npm/ccount@2.0.1/+esm',
  'https://cdn.jsdelivr.net/npm/comma-separated-tokens@2.0.3/+esm',
  'https://cdn.jsdelivr.net/npm/hast-util-whitespace@3.0.0/+esm',
  'https://cdn.jsdelivr.net/npm/html-void-elements@3.0.0/+esm',
  'https://cdn.jsdelivr.net/npm/property-information@7.0.0/+esm',
  'https://cdn.jsdelivr.net/npm/space-separated-tokens@2.0.2/+esm',
  'https://cdn.jsdelivr.net/npm/stringify-entities@4.0.4/+esm',
  'https://cdn.jsdelivr.net/npm/zwitch@2.0.4/+esm',
  'https://cdn.jsdelivr.net/npm/character-entities-html4@2.1.0/+esm',
  'https://cdn.jsdelivr.net/npm/character-entities-legacy@3.0.0/+esm',
  'https://cdn.jsdelivr.net/npm/oniguruma-to-es@4.3.4/+esm',
  'https://cdn.jsdelivr.net/npm/oniguruma-parser@0.12.1/parser/+esm',
  'https://cdn.jsdelivr.net/npm/oniguruma-parser@0.12.1/traverser/+esm',
  'https://cdn.jsdelivr.net/npm/regex-recursion@6.0.2/+esm',
  'https://cdn.jsdelivr.net/npm/regex@6.0.1/internals/+esm',
  'https://cdn.jsdelivr.net/npm/regex-utilities@2.3.0/+esm',
];

// Configured Shiki grammar resources (12): the canonical language modules
// resolved by shiki's own bundledLanguagesAlias map for the langs configured in
// js/main.js initShiki(). 'bash' resolves to id 'shellscript'
// (aliases: bash, sh, shell, zsh); 'text' is a special language
// (isSpecialLang plaintext path) and requires NO resource — jsDelivr serves 404
// for /npm/@shikijs/langs@4.0.2/text/+esm, proving it is never imported.
// These are dynamic imports awaited by createHighlighter, so each one is
// required at normal HTML Preview startup; a missing one rejects initShiki.
// Changing the initShiki() langs array requires re-deriving this list.
const DETERMINISTIC_SHIKI_GRAMMAR_SHELL = [
  'https://cdn.jsdelivr.net/npm/@shikijs/langs@4.0.2/javascript/+esm',
  'https://cdn.jsdelivr.net/npm/@shikijs/langs@4.0.2/jsx/+esm',
  'https://cdn.jsdelivr.net/npm/@shikijs/langs@4.0.2/typescript/+esm',
  'https://cdn.jsdelivr.net/npm/@shikijs/langs@4.0.2/tsx/+esm',
  'https://cdn.jsdelivr.net/npm/@shikijs/langs@4.0.2/python/+esm',
  'https://cdn.jsdelivr.net/npm/@shikijs/langs@4.0.2/shellscript/+esm',
  'https://cdn.jsdelivr.net/npm/@shikijs/langs@4.0.2/json/+esm',
  'https://cdn.jsdelivr.net/npm/@shikijs/langs@4.0.2/markdown/+esm',
  'https://cdn.jsdelivr.net/npm/@shikijs/langs@4.0.2/html/+esm',
  'https://cdn.jsdelivr.net/npm/@shikijs/langs@4.0.2/css/+esm',
  'https://cdn.jsdelivr.net/npm/@shikijs/langs@4.0.2/yaml/+esm',
  'https://cdn.jsdelivr.net/npm/@shikijs/langs@4.0.2/xml/+esm',
];

// Configured Shiki theme resources (2): the themes configured in js/main.js
// initShiki(), both awaited by createHighlighter at startup. Pure data modules
// (no imports, no runtime assets).
const DETERMINISTIC_SHIKI_THEME_SHELL = [
  'https://cdn.jsdelivr.net/npm/@shikijs/themes@4.0.2/github-light/+esm',
  'https://cdn.jsdelivr.net/npm/@shikijs/themes@4.0.2/github-dark/+esm',
];

// Combined unique deterministic resource set: the single canonical identity
// used by request canonicalization, cache matching, and install completeness.
// Expected total: 89 (9 Markmap + 20 CodeMirror + 20 KaTeX fonts
// + 26 Shiki shell + 12 Shiki grammars + 2 Shiki themes, disjoint).
const DETERMINISTIC_DEPENDENCIES = [
  ...DETERMINISTIC_CDN_SHELL,
  ...DETERMINISTIC_CODEMIRROR_SHELL,
  ...DETERMINISTIC_KATEX_FONT_SHELL,
  ...DETERMINISTIC_SHIKI_SHELL,
  ...DETERMINISTIC_SHIKI_GRAMMAR_SHELL,
  ...DETERMINISTIC_SHIKI_THEME_SHELL,
];

// Install-time CDN storage is exactly the deterministic set; Shiki no longer
// carries a separate literal here (it lives in its own deterministic groups and
// is served through the same cache-first deterministic route offline).
const CDN_APP_SHELL = [
  ...DETERMINISTIC_DEPENDENCIES,
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

// Canonical deterministic-dependency identity: returns the canonical href for
// one of DETERMINISTIC_CDN_SHELL, or null. Query strings and fragments are
// ignored so a query variant can never strand a deterministic dependency.
function canonicalDeterministicCdnUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    for (const dep of DETERMINISTIC_DEPENDENCIES) {
      const canonical = new URL(dep);
      if (canonical.origin === url.origin && canonical.pathname === url.pathname) {
        return canonical.href;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function isDeterministicCdnRequest(request) {
  return canonicalDeterministicCdnUrl(request.url) !== null;
}

// The Markmap deterministic dependencies are consumed as classic cross-origin
// <script src> tags, so the browser requests them in no-cors mode and receives
// an opaque response. Offline replay therefore needs an opaque copy: a stored
// CORS copy is unconditional network-error material for a no-cors request.
// Only deterministic dependencies may store opaque responses; every other
// route keeps the strict safe-response contract.
function isSafeToCacheDeterministic(response) {
  if (!response) return false;
  if (response.type === 'opaque') return true;
  return isSafeToCacheResponse(response);
}

// Type compatibility guard (Fetch spec "main fetch" network-error rules):
//   * request mode is not "no-cors"  + response type "opaque"      → network error
//   * request mode is "same-origin"  + response type "cors"        → network error
// A "cors" response IS valid for a "no-cors" request, so one stored CORS copy
// serves both markmap's fetch() (CSS) and the no-cors <link>/<script> element
// loads. An opaque copy is only ever valid for a no-cors request.
function isCacheEntryUsableForMode(response, mode) {
  if (!response) return false;
  const type = response.type || 'default';
  if (type === 'opaque') return mode === 'no-cors';
  if (type === 'opaqueredirect') return mode === 'no-cors';
  if (mode === 'no-cors') return true;
  return type === 'basic' || type === 'cors' || type === 'default';
}

// Cache lookup for a deterministic dependency: exact canonical match first in
// APP_CACHE (the install-time deterministic home) then RUNTIME_CACHE, then a
// query-insensitive normalization pass in both. Only type-compatible entries
// are accepted.
async function matchDeterministicCdn(request, canonicalHref) {
  const cachesToTry = [APP_CACHE, RUNTIME_CACHE];

  for (const ignoreSearch of [false, true]) {
    for (const cacheName of cachesToTry) {
      try {
        const cache = await caches.open(cacheName);
        const found = await cache.match(new Request(canonicalHref), { ignoreSearch });
        if (isCacheEntryUsableForMode(found, request.mode)) return found;
      } catch (err) {
        console.debug('Deterministic CDN cache lookup skipped:', cacheName, canonicalHref, err);
      }
    }
  }

  return null;
}

// Stores a usable deterministic dependency response under the canonical
// request. Only safe responses are stored (200 cors/basic, or the opaque copy
// that matches the app's no-cors script tags), so a failure status can never be
// cached as a valid dependency. Redirected responses are additionally stored
// under their final URL for replay consistency.
async function putDeterministicCdn(canonicalHref, response) {
  if (!isSafeToCacheDeterministic(response)) return;

  try {
    const cache = await caches.open(APP_CACHE);
    await cache.put(new Request(canonicalHref), response.clone());
    console.log('Deterministic dependency cached:', canonicalHref);
  } catch (err) {
    console.warn('Deterministic dependency cache put skipped:', canonicalHref, err);
  }

  try {
    if (response.url && response.url !== canonicalHref) {
      const cache = await caches.open(APP_CACHE);
      await cache.put(new Request(response.url), response.clone());
      console.log('Deterministic dependency cached (final URL):', response.url);
    }
  } catch (err) {
    console.debug('Deterministic dependency final-URL cache skipped:', canonicalHref, err);
  }
}

// Deterministic dependencies are served cache-first: the install-time precache
// (APP_CACHE) plus any stored runtime copy satisfy offline boots without a
// network round trip. Network is used only when no usable copy exists; the
// synthetic failure response is an explicit error marker, never treated as
// usable content, and is never cached.
async function handleDeterministicCdnRequest(request) {
  const canonicalHref = canonicalDeterministicCdnUrl(request.url);

  if (!canonicalHref) {
    return handleExternalRequest(request);
  }

  const cached = await matchDeterministicCdn(request, canonicalHref);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    if (response && (response.ok || response.type === 'opaque')) {
      putDeterministicCdn(canonicalHref, response);
    }

    return response;
  } catch (error) {
    console.warn('Deterministic dependency unavailable and not cached:', canonicalHref, error);

    return new Response(`Offline deterministic dependency unavailable: ${canonicalHref}`, {
      status: 504,
      statusText: 'Offline deterministic dependency unavailable',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}

// Observable completeness of the install-time deterministic precache,
// reported per logical dependency group. Install never fails because of a
// CDN entry, but a partial shell is reported.
async function reportDeterministicCdnCompleteness(cache) {
  const groups = [
    ['Markmap dependencies', DETERMINISTIC_CDN_SHELL],
    ['CodeMirror modules', DETERMINISTIC_CODEMIRROR_SHELL],
    ['KaTeX fonts', DETERMINISTIC_KATEX_FONT_SHELL],
    ['Shiki shell', DETERMINISTIC_SHIKI_SHELL],
    ['Shiki grammars', DETERMINISTIC_SHIKI_GRAMMAR_SHELL],
    ['Shiki themes', DETERMINISTIC_SHIKI_THEME_SHELL],
  ];

  const groupNames = [];
  const allMissing = [];

  for (const [name, list] of groups) {
    const missing = [];

    for (const url of list) {
      try {
        const match = await cache.match(new Request(url));
        if (!match) missing.push(url);
      } catch {
        missing.push(url);
      }
    }

    if (missing.length) {
      allMissing.push(...missing);
      groupNames.push(`${name}: precached ${list.length - missing.length}/${list.length}`);
      console.warn(`Precache incomplete for ${name}:`, missing);
    } else {
      groupNames.push(`${name}: precached ${list.length}/${list.length}`);
    }
  }

  if (allMissing.length) {
    console.warn(
      `Deterministic dependency precache incomplete (${allMissing.length} missing):`,
      groupNames.join(', ')
    );
  } else {
    console.log(
      `Deterministic CDN dependencies precached: ${DETERMINISTIC_DEPENDENCIES.length} (${groupNames.join(', ')})`
    );
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
      // If offline, these will fail gracefully. Deterministic dependencies are
      // precached as CORS copies (accepted by the browser for both markmap's
      // fetch() and the classic no-cors element requests).
      for (const url of CDN_APP_SHELL) {
        await precacheOne(cache, url);
      }

      // Observable deterministic-dependency completeness (install never fails
      // because of a CDN entry, but a partial shell is reported).
      await reportDeterministicCdnCompleteness(cache);
    })
  );

  // 0.6.1 contract: activation is user-controlled. skipWaiting is no longer
  // called unconditionally; the page sends { type: 'SKIP_WAITING' } only
  // after the user authorizes reload (js/pwa/update-ready.js).
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          // Prefix-scoped cleanup: delete only caches owned by this
          // application (old release identities), never unrelated origin
          // caches. The current APP_CACHE and RUNTIME_CACHE always survive.
          .filter(
            (key) =>
              key.startsWith(CACHE_PREFIX) &&
              ![APP_CACHE, RUNTIME_CACHE].includes(key)
          )
          .map((key) => caches.delete(key))
      );
    })
  );

  sw.clients.claim();
});

// Message-gated activation (0.6.1). The page requests activation ONLY after
// the user selects Reload and document safety is resolved. This is the sole
// message type accepted; all other shapes are ignored.
sw.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    sw.skipWaiting();
  }
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
    // Deterministic CDN dependencies (offline Markmap / HTML Preview) are
    // served through the cache-first deterministic route; all other external
    // requests keep the accepted network-first route unchanged.
    if (isDeterministicCdnRequest(request)) {
      event.respondWith(handleDeterministicCdnRequest(request));
      return;
    }

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
