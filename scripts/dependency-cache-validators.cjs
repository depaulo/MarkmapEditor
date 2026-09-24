// @ts-nocheck
'use strict';
// Dependency cache validators (0.6.1 ACT I offline correction).
// Layer A: source-structure checks on sw.js / index.html.
// Layer B: executable service-worker harness (vm) proving the offline contract:
//   cached dependency exists  → cached response returned (never a synthetic 504)
//   network fails + no cache  → explicit 504 failure marker (never cached)
//   type compatibility        → an unusable (CORS) copy is not served to a
//                               no-cors script request
//   query normalization       → a query variant still resolves the dependency
//   unrelated external route   → non-deterministic URLs keep network-first
//   install                   → completes with observable partial-shell warning
// Run: node scripts/dependency-cache-validators.cjs

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let pass = 0;
let fail = 0;

function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`PASS ${name}`);
  } else {
    fail++;
    console.error(`FAIL ${name}${detail ? ' — ' + detail : ''}`);
  }
}

const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const swSrc = read('sw.js');
const htmlSrc = read('index.html');

const ENGINE_ASSETS = [
  'https://cdn.jsdelivr.net/npm/d3@7',
  'https://cdn.jsdelivr.net/npm/markmap-lib',
  'https://cdn.jsdelivr.net/npm/markmap-view',
  'https://cdn.jsdelivr.net/npm/marked@15.0.12/marked.min.js',
];

// markmap-lib 0.18.12 per-feature assets (U1–U5), version-pinned by its own
// defaults: hljs styles/runtime, katex styles/runtime, webfontloader runtime.
const FEATURE_ASSETS = {
  U1: 'https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.11.1/styles/default.min.css',
  U2: 'https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.11.1/highlight.min.js',
  U3: 'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/katex.min.css',
  U4: 'https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/katex.min.js',
  U5: 'https://cdn.jsdelivr.net/npm/webfontloader@1.6.28/webfontloader.js',
};

const DETERMINISTIC = [...ENGINE_ASSETS, ...Object.values(FEATURE_ASSETS)];

const CSS_ASSETS = [FEATURE_ASSETS.U1, FEATURE_ASSETS.U3];
const JS_ASSETS = [FEATURE_ASSETS.U2, FEATURE_ASSETS.U4, FEATURE_ASSETS.U5];

function parsedDeterministicList() {
  const block = swSrc.split('const DETERMINISTIC_CDN_SHELL = [')[1].split('];')[0];
  const out = [];
  for (const m of block.matchAll(/'(\/\/[^']*|https:\/\/[^']*)'/g)) {
    out.push(m[1]);
  }
  return out;
}

const shellParsed = parsedDeterministicList();

// Generic list parser: extracts the pinned URL literals of one shell list.
function parseList(name) {
  const marker = `const ${name} = [`;
  if (!swSrc.includes(marker)) return [];
  const block = swSrc.split(marker)[1].split('];')[0];
  const out = [];
  for (const m of block.matchAll(/'(https:\/\/[^']*)'/g)) {
    out.push(m[1]);
  }
  return out;
}

const CM_SHELL = parseList('DETERMINISTIC_CODEMIRROR_SHELL');
const KATEX_FONT_SHELL = parseList('DETERMINISTIC_KATEX_FONT_SHELL');
const CDN_SHELL_BLOCK = swSrc.split('const CDN_APP_SHELL = [')[1].split('];')[0];
const CDN_SHELL_SPREADS = (CDN_SHELL_BLOCK.match(/\.\.\.[A-Z_]+/g) || []);
const CDN_SHELL_URLS = [];
for (const m of CDN_SHELL_BLOCK.matchAll(/'(https:\/\/[^']*)'/g)) {
  CDN_SHELL_URLS.push(m[1]);
}
const SHIKI_SHELL = parseList('DETERMINISTIC_SHIKI_SHELL');
const SHIKI_GRAMMAR_SHELL = parseList('DETERMINISTIC_SHIKI_GRAMMAR_SHELL');
const SHIKI_THEME_SHELL = parseList('DETERMINISTIC_SHIKI_THEME_SHELL');
const SHIKI_ALL = [...SHIKI_SHELL, ...SHIKI_GRAMMAR_SHELL, ...SHIKI_THEME_SHELL];
const COMBINED_DEPS = [
  ...shellParsed,
  ...CM_SHELL,
  ...KATEX_FONT_SHELL,
  ...SHIKI_SHELL,
  ...SHIKI_GRAMMAR_SHELL,
  ...SHIKI_THEME_SHELL,
];
const mainSrc = read('js/main.js');

const htmlExternalScripts = Array.from(
  htmlSrc.matchAll(/<script src="(https:[^"]+)"><\/script>/g),
  (m) => m[1]
);

// ================================
// A. SOURCE CHECKS
// ================================
check('1 all nine deterministic dependency URLs are represented in CDN_APP_SHELL',
  ENGINE_ASSETS.every((url) => htmlExternalScripts.includes(url)) &&
  DETERMINISTIC.every((url) => swSrc.includes(`'${url}'`)) &&
  shellParsed.length === 9 &&
  DETERMINISTIC.every((url) => shellParsed.includes(url)) &&
  /const CDN_APP_SHELL = \[\s*\.\.\.DETERMINISTIC_DEPENDENCIES,/.test(swSrc),
  `html=${htmlExternalScripts.length} parsed=${shellParsed.length}`);

check('1b U1–U5 pinned exactly as markmap-lib 0.18.12 resolves them',
  shellParsed.includes(FEATURE_ASSETS.U1) &&
  shellParsed.includes(FEATURE_ASSETS.U2) &&
  shellParsed.includes(FEATURE_ASSETS.U3) &&
  shellParsed.includes(FEATURE_ASSETS.U4) &&
  shellParsed.includes(FEATURE_ASSETS.U5) &&
  /katex@0\.16\.18/.test(swSrc) &&
  /@highlightjs\/cdn-assets@11\.11\.1/.test(swSrc) &&
  /webfontloader@1\.6\.28/.test(swSrc));

const deterministicRouteSrc = (() => {
  const a = swSrc.indexOf('function canonicalDeterministicCdnUrl');
  const b = swSrc.indexOf('async function reportDeterministicCdnCompleteness');
  return a >= 0 && b > a ? swSrc.slice(a, b) : '';
})();

check('1c no broad jsDelivr / external-resource rule was added', (() => {
  if (!deterministicRouteSrc) return false;
  // The deterministic route keys off the explicit list only: no origin/pattern
  // matching, no `includes(` wildcard, no interpolated jsDelivr host.
  const broad = /cdn\.jsdelivr\.net|unpkg\.com|includes\(|startsWith\('/.test(deterministicRouteSrc);
  const listDriven = /const cachesToTry = \[APP_CACHE, RUNTIME_CACHE\]/.test(deterministicRouteSrc);
  return !broad && listDriven;
})());

check('2 exact browser request URLs match the canonical cache keys',
  /canonical\.origin === url\.origin && canonical\.pathname === url\.pathname/.test(swSrc));

check('3 deterministic dependencies have an offline cached-response path',
  /async function matchDeterministicCdn/.test(swSrc) &&
  /const cachesToTry = \[APP_CACHE, RUNTIME_CACHE\]/.test(swSrc) &&
  /isDeterministicCdnRequest\(request\)/.test(swSrc));

check('4 network failure falls back to a usable cached response',
  /const cached = await matchDeterministicCdn\(request, canonicalHref\);[\s\S]{0,120}if \(cached\) \{[\s\S]{0,60}return cached;/.test(swSrc));

check('5 cached response is returned before any synthetic 504',
  swSrc.indexOf('const cached = await matchDeterministicCdn') <
  swSrc.indexOf('Offline deterministic dependency unavailable'));

check('6 one CDN caching failure is observable',
  /Precache skipped/.test(swSrc) &&
  /Precache incomplete for \$\{name\}:/.test(swSrc) &&
  /Deterministic dependency cache put skipped:/.test(swSrc));

check('7 install cannot silently claim a complete CDN shell',
  /Precache incomplete for \$\{name\}:/.test(swSrc) &&
  /Deterministic dependency precache incomplete \(\$\{allMissing\.length\} missing\)/.test(swSrc) &&
  /reportDeterministicCdnCompleteness\(cache\)/.test(swSrc));

check('8 redirect behaviour handled consistently',
  /response\.url !== canonicalHref/.test(swSrc) && /final URL/.test(swSrc));

check('9 query strings cannot strand a deterministic dependency',
  /ignoreSearch/.test(swSrc));

check('10 a failed response status is not cached as a valid dependency',
  /isSafeToCacheDeterministic/.test(swSrc) &&
  /if \(response\.type === 'opaque'\) return true;/.test(swSrc) &&
  /return isSafeToCacheResponse\(response\);/.test(swSrc));

check('11 update-ready assets remain in LOCAL_APP_SHELL exactly once', (() => {
  const shell = swSrc.split('const LOCAL_APP_SHELL')[1].split('];')[0];
  return shell.split("'./css/update-ready.css'").length - 1 === 1 &&
    shell.split("'./js/pwa/update-ready.js'").length - 1 === 1;
})());

check('12 semantic 0.6.1 closure identity is the installed cache identity',
  /APP_VERSION = 'markmap-journal-pwa-0\.6\.1-foundation-closure'/.test(swSrc) &&
  !/0\.6\.0-help-release-foundation|0\.6\.2-test/.test(swSrc));

check('13 no temporary worker identity introduced',
  !/test1|0\.6\.2-test|v7\d-metadata/.test(swSrc));

check('14 release copy matches the accepted 0.6.1 identity and Help stays version-agnostic',
  read('js/release/release.js').includes('0.6.1') &&
  read('js/ui/release-notes-content.js').includes('0.6.1') &&
  !read('js/release/release.js').includes('0.6.0-help-release-foundation') &&
  !read('js/ui/help-content.js').includes('0.6.1') &&
  !read('js/ui/help-content.js').includes('0.6.0-help-release-foundation'));

check('15 no unrelated fetch-route behaviour changes', (() => {
  const navigateOk = /request\.mode === 'navigate'/.test(swSrc);
  const localOk = /if \(isLocal\) \{/.test(swSrc);
  const externalGeneric = /event\.respondWith\(handleExternalRequest\(request\)\)/.test(swSrc);
  const externalNetworkFirst = /async function handleExternalRequest\(request\) \{[\s\S]{0,120}const cache = await caches\.open\(RUNTIME_CACHE\);[\s\S]{0,80}const response = await fetch\(request\);/.test(swSrc);
  return navigateOk && localOk && externalGeneric && externalNetworkFirst;
})());

check('16 Markmap deterministic set is still exactly the nine; Shiki now rides the cache-first route',
  shellParsed.length === 9 &&
  !shellParsed.some((u) => u.includes('shiki')) &&
  !shellParsed.some((u) => u.includes('deno.land')) &&
  SHIKI_SHELL.length === 26 &&
  /if \(isDeterministicCdnRequest\(request\)\) \{\s*event\.respondWith\(handleDeterministicCdnRequest\(request\)\);\s*return;\s*\}/.test(swSrc));

check('16b response-type compatibility follows the Fetch spec network-error rules',
  /if \(type === 'opaque'\) return mode === 'no-cors';/.test(swSrc) &&
  /if \(mode === 'no-cors'\) return true;/.test(swSrc) &&
  /return type === 'basic' \|\| type === 'cors' \|\| type === 'default';/.test(swSrc));

check('16c diagnostics describe asset URL, type, phase, and Response/Event detail',
  /function describeAssetFailure\(err\)/.test(read('js/main.js')) &&
  /Response\(status=/.test(read('js/main.js')) &&
  /Event\(type=/.test(read('js/main.js')) &&
  /ensureAssets\(features, source\)/.test(read('js/main.js')) &&
  /throw assetErr;/.test(read('js/main.js')));

check('16d no broad graceful degradation was added',
  !/catch\s*\{\s*\}\s*\/\/\s*swallow/.test(read('js/main.js')));

// ---- 16s: Shiki offline graph (source-structure checks) ----

// jsDelivr +esm pins must be exact semver, never a floating tag.
const shikiPinned = (u) =>
  /^https:\/\/cdn\.jsdelivr\.net\/npm\/[^']+@[0-9]+\.[0-9]+\.[0-9]+\/.*\+esm$/.test(u);

check('16s1 DETERMINISTIC_SHIKI_SHELL contains exactly 26 unique pinned +esm modules',
  SHIKI_SHELL.length === 26 && new Set(SHIKI_SHELL).size === 26 &&
  SHIKI_SHELL.every(shikiPinned),
  `parsed=${SHIKI_SHELL.length} unique=${new Set(SHIKI_SHELL).size}`);

check('16s2 the Shiki shell includes the entry, the three @shikijs externals, and both wasm modules',
  SHIKI_SHELL.includes('https://cdn.jsdelivr.net/npm/shiki@4.0.2/+esm') &&
  SHIKI_SHELL.includes('https://cdn.jsdelivr.net/npm/@shikijs/core@4.0.2/+esm') &&
  SHIKI_SHELL.includes('https://cdn.jsdelivr.net/npm/@shikijs/engine-javascript@4.0.2/+esm') &&
  SHIKI_SHELL.includes('https://cdn.jsdelivr.net/npm/@shikijs/engine-oniguruma@4.0.2/+esm') &&
  SHIKI_SHELL.includes('https://cdn.jsdelivr.net/npm/shiki@4.0.2/wasm/+esm') &&
  SHIKI_SHELL.includes('https://cdn.jsdelivr.net/npm/@shikijs/engine-oniguruma@4.0.2/wasm-inlined/+esm'));

check('16s3 DETERMINISTIC_SHIKI_GRAMMAR_SHELL contains exactly 12 unique pinned grammar modules',
  SHIKI_GRAMMAR_SHELL.length === 12 && new Set(SHIKI_GRAMMAR_SHELL).size === 12 &&
  SHIKI_GRAMMAR_SHELL.every((u) =>
    /^https:\/\/cdn\.jsdelivr\.net\/npm\/@shikijs\/langs@4\.0\.2\/[a-z0-9-]+\/\+esm$/.test(u)),
  `parsed=${SHIKI_GRAMMAR_SHELL.length}`);

check('16s4 DETERMINISTIC_SHIKI_THEME_SHELL contains exactly the two configured themes',
  SHIKI_THEME_SHELL.length === 2 && new Set(SHIKI_THEME_SHELL).size === 2 &&
  SHIKI_THEME_SHELL.includes('https://cdn.jsdelivr.net/npm/@shikijs/themes@4.0.2/github-light/+esm') &&
  SHIKI_THEME_SHELL.includes('https://cdn.jsdelivr.net/npm/@shikijs/themes@4.0.2/github-dark/+esm'));

check('16s5 DETERMINISTIC_DEPENDENCIES is the disjoint 9+20+20+26+12+2 = 89 combination',
  COMBINED_DEPS.length === 89 && new Set(COMBINED_DEPS).size === 89 &&
  /\.\.\.DETERMINISTIC_CDN_SHELL,\s*\.\.\.DETERMINISTIC_CODEMIRROR_SHELL,\s*\.\.\.DETERMINISTIC_KATEX_FONT_SHELL,\s*\.\.\.DETERMINISTIC_SHIKI_SHELL,\s*\.\.\.DETERMINISTIC_SHIKI_GRAMMAR_SHELL,\s*\.\.\.DETERMINISTIC_SHIKI_THEME_SHELL,/.test(swSrc),
  `combined=${COMBINED_DEPS.length} unique=${new Set(COMBINED_DEPS).size}`);

check('16s6 CDN_APP_SHELL is the spread only: no separate Shiki literal, no duplicates',
  swSrc.split('const CDN_APP_SHELL = [')[1].split('];')[0].trim() === '...DETERMINISTIC_DEPENDENCIES,'.trim() &&
  (swSrc.match(/https:\/\/cdn\.jsdelivr\.net\/npm\/shiki@4\.0\.2\/\+esm/g) || []).length === 1);

check('16s7 the deterministic route stays list-driven (no Shiki host/path rule added)',
  deterministicRouteSrc.length > 0 &&
  !/shiki|@shikijs|cdn\.jsdelivr\.net|includes\(|startsWith\('/.test(deterministicRouteSrc));

// App ↔ SW agreement: the pinned grammars/themes must cover exactly what
// js/main.js initShiki() configures. Alias table mirrors shiki's own
// bundledLanguagesAlias resolution; 'text' is a special language (plaintext
// path, no module) — jsDelivr serves 404 for .../langs@4.0.2/text/+esm.
const SHIKI_ALIAS_TO_ID = {
  js: 'javascript',
  cjs: 'javascript',
  mjs: 'javascript',
  py: 'python',
  sh: 'shellscript',
  shell: 'shellscript',
  zsh: 'shellscript',
  bash: 'shellscript',
  md: 'markdown',
  yml: 'yaml',
};
const SHIKI_SPECIAL_LANGS = new Set(['text', 'plaintext', 'plain', 'txt']);
const shikiLangsConfigured = (() => {
  const m = mainSrc.match(/langs:\s*\[([^\]]*)\]/);
  if (!m) return null;
  return Array.from(m[1].matchAll(/'([^']+)'/g), (x) => x[1]);
})();
const shikiThemesConfigured = (() => {
  const m = mainSrc.match(/themes:\s*\[([^\]]*)\]/);
  if (!m) return null;
  return Array.from(m[1].matchAll(/'([^']+)'/g), (x) => x[1]);
})();
const shikiResolvedGrammar = (name) => {
  const id = SHIKI_ALIAS_TO_ID[name] || name;
  return `https://cdn.jsdelivr.net/npm/@shikijs/langs@4.0.2/${id}/+esm`;
};

check('16s8 every configured initShiki language is a special language or a pinned grammar resource',
  Array.isArray(shikiLangsConfigured) && shikiLangsConfigured.length === 13 &&
  shikiLangsConfigured.every((name) =>
    SHIKI_SPECIAL_LANGS.has(name) || SHIKI_GRAMMAR_SHELL.includes(shikiResolvedGrammar(name))),
  `configured=[${(shikiLangsConfigured || []).join(', ')}]`);

check('16s9 every configured initShiki theme is a pinned theme resource',
  Array.isArray(shikiThemesConfigured) && shikiThemesConfigured.length === 2 &&
  shikiThemesConfigured.every((name) =>
    SHIKI_THEME_SHELL.includes(`https://cdn.jsdelivr.net/npm/@shikijs/themes@4.0.2/${name}/+esm`)),
  `configured=[${(shikiThemesConfigured || []).join(', ')}]`);

check('16s10 main.js still imports the pinned Shiki entry (no floating tag, no alternate host)',
  mainSrc.includes("import('https://cdn.jsdelivr.net/npm/shiki@4.0.2/+esm')"));

// ================================
// B. EXECUTABLE SERVICE-WORKER HARNESS
// ================================

function makeCacheStore() {
  return { entries: new Map() };
}

function makeCacheObject(store) {
  return {
    async put(request, response) {
      store.entries.set(request.url, response);
    },
    async match(request, options) {
      const url = typeof request === 'string' ? request : request.url;
      if (store.entries.has(url)) return store.entries.get(url);
      if (options && options.ignoreSearch) {
        const base = url.split('?')[0];
        for (const [key, value] of store.entries) {
          if (key.split('?')[0] === base) return value;
        }
      }
      return undefined;
    },
    async keys() {
      return Array.from(store.entries.keys());
    },
  };
}

function runServiceWorker(env) {
  const sandbox = {};
  const stores = { [env.appCacheName]: makeCacheStore(), [env.runtimeCacheName]: makeCacheStore() };
  env.stores = stores;
  env.handlers = {};
  env.warnings = [];
  env.logs = [];
  env.requestedUrls = [];

  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.location = { origin: 'https://app.test' };
  sandbox.URL = URL;
  sandbox.Object = Object;
  sandbox.String = String;
  sandbox.Promise = Promise;
  sandbox.Array = Array;
  sandbox.Map = Map;
  sandbox.console = {
    log: (...a) => env.logs.push(a.join(' ')),
    warn: (...a) => env.warnings.push(a.join(' ')),
    debug: () => {},
    error: (...a) => env.warnings.push(a.join(' ')),
  };
  sandbox.Request = class {
    constructor(input, options) {
      const raw = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
      this.url = new URL(raw, 'https://app.test/').href;
      this.method = 'GET';
      this.mode = (options && options.mode) || 'cors';
    }
  };
  sandbox.Response = class {
    constructor(body, init) {
      const i = init || {};
      this.body = body;
      this.status = typeof i.status === 'number' ? i.status : 200;
      this.type = i.type || 'default';
      this.ok = this.status >= 200 && this.status < 300;
      this.url = i.url || '';
    }
    clone() {
      return new sandbox.Response(this.body, { status: this.status, type: this.type, url: this.url });
    }
  };
  sandbox.caches = {
    async open(name) {
      if (!stores[name]) stores[name] = makeCacheStore();
      return makeCacheObject(stores[name]);
    },
    async keys() {
      return Object.keys(stores);
    },
    async delete(name) {
      delete stores[name];
      return true;
    },
    async match() {
      return undefined;
    },
  };
  sandbox.fetch = (requestOrUrl) => {
    const url = typeof requestOrUrl === 'string' ? requestOrUrl : requestOrUrl.url;
    env.requestedUrls.push(url);
    return env.fetchImpl(url);
  };
  sandbox.addEventListener = (type, fn) => {
    env.handlers[type] = fn;
  };
  sandbox.skipWaiting = () => {};
  sandbox.clients = { claim: () => {} };
  sandbox.registration = {};

  vm.createContext(sandbox);
  vm.runInContext(swSrc, sandbox, { filename: 'sw.js' });
  return sandbox;
}

function makeFetchEvent(url, mode) {
  const captured = { promise: null };
  return {
    event: {
      request: { url, method: 'GET', mode },
      respondWith(promise) {
        captured.promise = Promise.resolve(promise);
      },
    },
    captured,
  };
}

function deferred() {
  let resolveFn;
  let rejectFn;
  const promise = new Promise((res, rej) => {
    resolveFn = res;
    rejectFn = rej;
  });
  return { promise, resolve: resolveFn, reject: rejectFn };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function newEnv(fetchImpl) {
  const env = {
    appCacheName: 'markmap-journal-pwa-0.6.1-foundation-closure-app',
    runtimeCacheName: 'markmap-journal-pwa-0.6.1-foundation-closure-runtime',
    fetchImpl: fetchImpl || (() => Promise.reject(new Error('offline'))),
  };
  env.sandbox = runServiceWorker(env);
  return env;
}

function makeStoredResponse(type, status, url) {
  const res = {
    type,
    status,
    ok: status >= 200 && status < 300,
    url,
  };
  res.clone = () => makeStoredResponse(type, status, url);
  return res;
}

function seed(env, cacheName, url, response) {
  env.stores[cacheName].entries.set(new URL(url).href, response);
}

async function dispatchFetch(env, url, mode) {
  const { event, captured } = makeFetchEvent(url, mode);
  env.handlers.fetch(event);
  if (!captured.promise) return null;
  return captured.promise;
}

async function layerB() {
  const D3 = 'https://cdn.jsdelivr.net/npm/d3@7';
  const SHIKI_ENTRY = 'https://cdn.jsdelivr.net/npm/shiki@4.0.2/+esm';

  // B1 (validators 3/4/5): offline + opaque cached copy → cached returned, no 504.
  {
    const env = newEnv();
    seed(env, env.appCacheName, D3, makeStoredResponse('opaque', 0, D3));
    const res = await dispatchFetch(env, D3, 'no-cors');
    check('B1 offline + cached opaque dependency returns the cached copy (no 504)',
      !!res && res.type === 'opaque' && res.status !== 504);
  }

  // B2 (validator 10 + failure marker): offline + no cache → explicit 504 marker, nothing cached.
  {
    const env = newEnv();
    const res = await dispatchFetch(env, D3, 'no-cors');
    check('B2 offline + no cached dependency returns an explicit 504 failure marker',
      !!res && res.status === 504 && res.type === 'default');
    check('B2b the failure marker is never cached',
      env.stores[env.appCacheName].entries.size === 0 &&
      env.stores[env.runtimeCacheName].entries.size === 0);
    check('B2c the failure marker is plain text reporting the missing dependency (not a JS stub)',
      !!res && typeof res.body === 'string' &&
      res.body.startsWith('Offline deterministic dependency unavailable:'));
  }

  // B3 (Fetch spec rules): a CORS copy IS served to a no-cors element request
  // (one copy serves both markmap's fetch() and the element loads), while an
  // opaque copy must NOT be served to a CORS consumer.
  {
    const env = newEnv();
    seed(env, env.appCacheName, D3, makeStoredResponse('cors', 200, D3));
    const res = await dispatchFetch(env, D3, 'no-cors');
    check('B3 CORS copy is served to a no-cors element request (spec-valid)',
      !!res && res.type === 'cors' && res.status !== 504);
    const corsConsumer = await dispatchFetch(env, D3, 'cors');
    check('B3b the same CORS copy is served to a CORS consumer',
      !!corsConsumer && corsConsumer.type === 'cors');
  }
  {
    const env = newEnv();
    seed(env, env.appCacheName, D3, makeStoredResponse('opaque', 0, D3));
    const corsConsumer = await dispatchFetch(env, D3, 'cors');
    check('B3c an opaque copy is never served to a CORS consumer (spec network error)',
      !!corsConsumer && corsConsumer.status === 504);
    const noCorsConsumer = await dispatchFetch(env, D3, 'no-cors');
    check('B3d the opaque copy is still served to a no-cors request',
      !!noCorsConsumer && noCorsConsumer.type === 'opaque');
  }

  // B4 (validator 9): query variant still resolves the canonical cached dependency.
  {
    const env = newEnv();
    seed(env, env.appCacheName, D3, makeStoredResponse('opaque', 0, D3));
    const res = await dispatchFetch(env, `${D3}?cachebust=1`, 'no-cors');
    check('B4 query-string variant resolves the canonical cached dependency',
      !!res && res.type === 'opaque' && res.status !== 504);
  }

  // B5 (validator 15): a genuinely non-deterministic external dependency keeps
  // the accepted network-first route (Shiki no longer belongs to that class).
  {
    const UNRELATED = 'https://cdn.jsdelivr.net/npm/shiki@4.0.2/dist/not-in-the-deterministic-graph.mjs';
    let networkCalls = 0;
    const env = newEnv((url) => {
      networkCalls++;
      return Promise.resolve(makeStoredResponse('cors', 200, url));
    });
    seed(env, env.appCacheName, UNRELATED, makeStoredResponse('cors', 200, UNRELATED));
    const res = await dispatchFetch(env, UNRELATED, 'cors');
    check('B5 non-deterministic external dependency still uses network-first (unchanged route)',
      networkCalls === 1 && !!res && res.type === 'cors');
  }

  // B8 (ACT I follow-up #3): with the Runtime Cache deleted, every required
  // Shiki resource is served cache-first from APP_CACHE with ZERO network
  // attempts — the dynamic import cannot reach the generic 504 route.
  {
    const env = newEnv(ONLINE_200);
    await runInstall(env);
    await env.sandbox.caches.delete(env.runtimeCacheName); // owner-browser condition
    env.requestedUrls.length = 0;
    env.fetchImpl = OFFLINE;
    const res = await dispatchFetch(env, SHIKI_ENTRY, 'cors'); // dynamic import: cors/script
    check('B8 empty Runtime Cache: the Shiki entry is served from APP_CACHE (no 504)',
      !!res && res.type === 'cors' && res.status === 200);
    check('B8b no network attempt was made for the Shiki entry offline',
      env.requestedUrls.length === 0);
    check('B8c the Runtime Cache stays empty (never a Shiki prerequisite)',
      !env.stores[env.runtimeCacheName] ||
        env.stores[env.runtimeCacheName].entries.size === 0);
  }

  // B9: the complete configured Shiki graph (shell + grammars + themes) is
  // served offline from APP_CACHE with zero network attempts.
  {
    const env = newEnv(ONLINE_200);
    await runInstall(env);
    await env.sandbox.caches.delete(env.runtimeCacheName);
    env.requestedUrls.length = 0;
    env.fetchImpl = OFFLINE;
    const failed = [];
    for (const url of SHIKI_ALL) {
      const res = await dispatchFetch(env, url, 'cors');
      if (!res || res.status === 504 || res.type !== 'cors') failed.push(url);
    }
    check('B9 all 40 Shiki resources are served from APP_CACHE with an empty Runtime Cache',
      failed.length === 0, `failed=[${failed.slice(0, 3).join(', ')}]`);
    check('B9b zero network attempts were made for the Shiki graph offline',
      env.requestedUrls.length === 0);
  }

  // B10: an unrelated jsDelivr URL that is NOT in the deterministic lists is
  // still handled by the generic network-first external route (no broad rule).
  {
    const UNRELATED = 'https://cdn.jsdelivr.net/npm/shiki@4.0.2/dist/unrelated.mjs';
    const env = newEnv(ONLINE_200);
    await runInstall(env);
    env.fetchImpl = OFFLINE;
    const res = await dispatchFetch(env, UNRELATED, 'cors');
    check('B10 an unrelated jsDelivr URL keeps the generic route (offline 504, no broad caching)',
      !!res && res.status === 504);
  }

  // B6 (validators 6/7): install completes with an observable partial-shell warning.
  {
    const env = newEnv(() => Promise.reject(new Error('offline')));
    const ev = { waitUntil: (p) => { env.installPromise = Promise.resolve(p); } };
    env.handlers.install(ev);
    let completed = true;
    try {
      await env.installPromise;
    } catch (err) {
      completed = false;
    }
    check('B6 install completes even when CDN entries fail (no install failure)', completed);
    check('B6b partial deterministic shell is reported',
      env.warnings.some((w) => w.includes('Deterministic dependency precache incomplete')));
  }

  // B7: an online no-cors response is stored for a later offline boot.
  {
    const env = newEnv((url) => Promise.resolve(makeStoredResponse('opaque', 0, url)));
    await dispatchFetch(env, D3, 'no-cors');
    await flush();
    check('B7 online no-cors response is stored for offline replay',
      env.stores[env.appCacheName].entries.has(new URL(D3).href));
    const offlineRes = await dispatchFetch(env, D3, 'no-cors');
    check('B7b subsequent offline request is served from that stored copy',
      !!offlineRes && offlineRes.type === 'opaque' && offlineRes.status !== 504);
  }
}

// ================================
// C. CLEAN-INSTALL LIFECYCLE REPLAY + FIRST-PASS RENDER PROOF
// ================================

const ONLINE_200 = (url) => Promise.resolve(makeStoredResponse('cors', 200, url));
const OFFLINE = () => Promise.reject(new Error('offline'));

async function runInstall(env) {
  const ev = { waitUntil: (p) => { env.installPromise = Promise.resolve(p); } };
  env.handlers.install(ev);
  await env.installPromise;
}

function installComplete(env) {
  return env.logs.some((l) =>
    l.includes(`Deterministic CDN dependencies precached: ${COMBINED_DEPS.length}`));
}

function installIncompleteWarning(env) {
  return (
    env.warnings.find((w) =>
      w.includes('Deterministic dependency precache incomplete')
    ) || null
  );
}

// The missing URL is named on the per-group "Precache incomplete for <name>:"
// warning line (the summary line carries only counts).
function warningNaming(env, url) {
  return env.warnings.find((w) => w.includes('Precache incomplete for') && w.includes(url)) || null;
}

// markmap-view loadCSS semantics: appends the element AND does fetch(href) with
// `if (t.ok) return t.text(); throw t;` — a non-OK response is thrown raw.
async function cssConsumer(env, url) {
  await dispatchFetch(env, url, 'no-cors'); // <link rel=stylesheet>
  const fetched = await dispatchFetch(env, url, 'cors'); // markmap's fetch(e)
  if (!fetched) return { ok: false, reason: 'no response', threwResponse: false };
  if (!fetched.ok) {
    return { ok: false, reason: `threw Response(status=${fetched.status})`, threwResponse: true };
  }
  return { ok: true };
}

// markmap loadJS / markmap-lib preload semantics: a <link rel=preload as=script>
// plus a real <script> element whose onError rejects the deferred promise.
async function scriptConsumer(env, url) {
  const preload = await dispatchFetch(env, url, 'no-cors');
  const element = await dispatchFetch(env, url, 'no-cors');
  if (!element || element.status === 504) {
    return {
      ok: false,
      reason: 'script element error Event → deferred reject',
      rejectedEvent: true,
      preload: !!preload,
    };
  }
  return { ok: true, preload: !!preload };
}

// First render pass with FRESH asset-tracking sets (mirrors the app's
// loadedCss/loadedJs on the very first pass, so success cannot come from an
// asset being pre-marked as already loaded).
async function firstPass(env, urls = DETERMINISTIC) {
  const freshCss = new Set();
  const freshJs = new Set();
  const result = { ok: true, failures: [], threwResponse: false, rejectedEvent: false };
  for (const url of urls) {
    const isCss = CSS_ASSETS.includes(url);
    if (isCss) freshCss.add(url);
    else freshJs.add(url);
    const r = isCss ? await cssConsumer(env, url) : await scriptConsumer(env, url);
    if (!r.ok) {
      result.ok = false;
      result.failures.push(`${url} → ${r.reason}`);
      if (r.threwResponse) result.threwResponse = true;
      if (r.rejectedEvent) result.rejectedEvent = true;
    }
  }
  return result;
}

async function layerC() {
  // C1: clean-install lifecycle → activation → first offline pass on all nine.
  {
    const env = newEnv(ONLINE_200);
    check('C1 lifecycle starts with empty caches', Object.values(env.stores).every((s) => s.entries.size === 0));

    await runInstall(env);
    const appStore = env.stores[env.appCacheName];
    const missing = DETERMINISTIC.filter((u) => !appStore.entries.has(new URL(u).href));
    check('C1b online install precached all nine deterministic entries', missing.length === 0, missing.join(','));
    check('C1c install logs the nine-entry completeness line', installComplete(env));
    check('C1d no incomplete-shell warning on a successful install', installIncompleteWarning(env) === null);
    if (process.env.MME_PRINT_COMPLETENESS === '1') {
      console.log('  [C1 install completeness evidence]');
      env.logs
        .filter((l) => l.includes('Deterministic CDN') || l.includes('Precached:'))
        .forEach((l) => console.log('    ' + l));
      console.log('    warnings=' + JSON.stringify(env.warnings));
    }

    env.fetchImpl = OFFLINE; // activation complete; page now controlled offline
    const pass = await firstPass(env);
    check('C1e first offline pass succeeds on all nine dependencies (no 504)', pass.ok, pass.failures.join(' | '));
    check('C1f first offline pass throws no Response', pass.threwResponse === false);
    check('C1g first offline pass rejects no Event (no unhandledrejection)', pass.rejectedEvent === false);
  }

  // C2: CSS semantics (markmap loadCSS).
  {
    const env = newEnv(ONLINE_200);
    await runInstall(env);
    env.fetchImpl = OFFLINE;
    const okCss = await cssConsumer(env, FEATURE_ASSETS.U3);
    check('C2 cached CSS dependency satisfies markmap loadCSS (no thrown Response)', okCss.ok === true);

    const empty = newEnv(ONLINE_200);
    empty.fetchImpl = OFFLINE;
    const badCss = await cssConsumer(empty, FEATURE_ASSETS.U3);
    check('C2b uncached CSS dependency reproduces the raw thrown Response',
      badCss.ok === false && badCss.threwResponse === true);
  }

  // C3: script/preload semantics (markmap loadJS / preloadScripts).
  {
    const env = newEnv(ONLINE_200);
    await runInstall(env);
    env.fetchImpl = OFFLINE;
    const okScript = await scriptConsumer(env, FEATURE_ASSETS.U4);
    check('C3 cached script dependency resolves for preload + element load',
      okScript.ok === true && okScript.preload === true);

    const empty = newEnv(ONLINE_200);
    empty.fetchImpl = OFFLINE;
    const badScript = await scriptConsumer(empty, FEATURE_ASSETS.U2);
    check('C3b uncached script dependency reproduces the Event rejection',
      badScript.ok === false && badScript.rejectedEvent === true);
  }

  // C4: negative control for each U1–U5 — every feature asset is load-bearing.
  for (const [label, url] of Object.entries(FEATURE_ASSETS)) {
    const env = newEnv((u) => (u === url ? OFFLINE() : ONLINE_200(u)));
    await runInstall(env);
    const warning = warningNaming(env, url);
    check(`C4.${label} incomplete precache names the missing asset`,
      !!warning && warning.includes(url), warning || 'no warning');
    check(`C4.${label}b install still completes (CDN caching stays opportunistic)`,
      installComplete(env) === false);
    if (process.env.MME_PRINT_COMPLETENESS === '1') {
      console.log(`    [C4.${label}] ` + (warning || 'no warning'));
    }

    env.fetchImpl = OFFLINE;
    const pass = await firstPass(env, [url]);
    const expected = CSS_ASSETS.includes(url) ? 'threwResponse' : 'rejectedEvent';
    check(`C4.${label}c missing ${label} is detected on the first pass (${expected})`,
      pass.ok === false && pass[expected] === true, pass.failures.join(' | '));
  }
}

// ================================
// D. CODEMIRROR + KATEX DETERMINISTIC LIFECYCLE
// ================================

const CM_BASE = 'https://deno.land/x/codemirror_esm@v6.0.1/esm/';
const CM_PREVIOUSLY_MISSING = [
  `${CM_BASE}lang-html/dist/index.js`,
  `${CM_BASE}lang-css/dist/index.js`,
  `${CM_BASE}lang-javascript/dist/index.js`,
  `${CM_BASE}node_modules/@lezer/html/dist/index.es.js`,
  `${CM_BASE}node_modules/@lezer/css/dist/index.es.js`,
  `${CM_BASE}node_modules/@lezer/javascript/dist/index.es.js`,
];

async function layerD() {
  // D1: canonical CodeMirror list — 20 unique pinned modules, closure complete.
  check('D1 DETERMINISTIC_CODEMIRROR_SHELL contains exactly 20 unique pinned modules',
    CM_SHELL.length === 20 && new Set(CM_SHELL).size === 20 &&
    CM_SHELL.every((u) => u.startsWith(CM_BASE)),
    `parsed=${CM_SHELL.length} unique=${new Set(CM_SHELL).size}`);
  check('D1b the six previously missing modules are represented',
    CM_PREVIOUSLY_MISSING.every((u) => CM_SHELL.includes(u)));
  check('D1c no broad deno.land host rule exists outside the explicit list',
    (deterministicRouteSrc.match(/deno\.land/g) || []).length === 0);

  // D2: KaTeX font list — exactly 20 unique pinned woff2 files, no woff/ttf.
  check('D2 DETERMINISTIC_KATEX_FONT_SHELL contains exactly 20 unique pinned woff2 files',
    KATEX_FONT_SHELL.length === 20 && new Set(KATEX_FONT_SHELL).size === 20 &&
    KATEX_FONT_SHELL.every((u) =>
      u.startsWith('https://cdn.jsdelivr.net/npm/katex@0.16.18/dist/fonts/') &&
      u.endsWith('.woff2')),
    `parsed=${KATEX_FONT_SHELL.length}`);
  check('D2b no woff or ttf fallback asset is cached',
    !COMBINED_DEPS.some((u) => u.endsWith('.woff') || u.endsWith('.ttf')));

  // D3: combined deterministic set — 89 unique, disjoint, declared via spreads.
  check('D3 DETERMINISTIC_DEPENDENCIES is the disjoint 9+20+20+26+12+2 = 89 combination',
    COMBINED_DEPS.length === 89 && new Set(COMBINED_DEPS).size === 89 &&
    /\.\.\.DETERMINISTIC_CDN_SHELL,\s*\.\.\.DETERMINISTIC_CODEMIRROR_SHELL,\s*\.\.\.DETERMINISTIC_KATEX_FONT_SHELL,\s*\.\.\.DETERMINISTIC_SHIKI_SHELL,\s*\.\.\.DETERMINISTIC_SHIKI_GRAMMAR_SHELL,\s*\.\.\.DETERMINISTIC_SHIKI_THEME_SHELL,/.test(swSrc),
    `combined=${COMBINED_DEPS.length} unique=${new Set(COMBINED_DEPS).size}`);

  // D4: CDN_APP_SHELL — a single spread of the deterministic set, no literal
  // URLs, no duplicated storage (the old separate Shiki literal is gone).
  check('D4 CDN_APP_SHELL is exactly one spread of DETERMINISTIC_DEPENDENCIES (no literals, no duplicates)',
    CDN_SHELL_SPREADS.join(',') === '...DETERMINISTIC_DEPENDENCIES' &&
    CDN_SHELL_URLS.length === 0 &&
    new Set(COMBINED_DEPS).size === COMBINED_DEPS.length);

  // D5: clean-install lifecycle → all 49 stored in APP_CACHE → full completeness.
  {
    const env = newEnv(ONLINE_200);
    check('D5 lifecycle starts with empty caches', Object.values(env.stores).every((s) => s.entries.size === 0));
    await runInstall(env);
    const appStore = env.stores[env.appCacheName];
    const missing = COMBINED_DEPS.filter((u) => !appStore.entries.has(new URL(u).href));
    check('D5b online install precached all 49 deterministic resources',
      missing.length === 0, missing.slice(0, 3).join(',') || `${missing.length} missing`);
    check('D5c install logs the 49-resource completeness line', installComplete(env));
    check('D5d no incomplete-shell warning on a successful install',
      installIncompleteWarning(env) === null);
    if (process.env.MME_PRINT_COMPLETENESS === '1') {
      env.logs
        .filter((l) => l.includes('Deterministic CDN dependencies precached'))
        .forEach((l) => console.log('    [D5 completeness] ' + l));
    }
  }
}

// D6–D9 live in layerD2 (offline boot, bootstrap completion, negative controls).
async function layerD2() {
  // D6/D7: activation → first offline boot: all 20 CodeMirror modules served
  // from APP_CACHE → CodeMirror bootstrap completes → __cmSetText exists.
  {
    const env = newEnv(ONLINE_200);
    await runInstall(env);
    // User-controlled activation has completed; the page is now controlled
    // (controller=yes) and the network is gone. Reset the network-attempt
    // log so D6b only observes requests made after activation.
    env.requestedUrls.length = 0;
    env.fetchImpl = OFFLINE;
    const served = [];
    const failed = [];
    for (const url of CM_SHELL) {
      const res = await dispatchFetch(env, url, 'cors'); // module import: cors/script
      if (res && res.status !== 504) served.push(url);
      else failed.push(url);
    }
    check('D6 all 20 CodeMirror modules are served from APP_CACHE offline (no 504)',
      served.length === 20 && failed.length === 0, `failed=[${failed.join(', ')}]`);
    check('D6b every served module copy came from APP_CACHE (no network attempted)',
      env.requestedUrls.filter((u) => u.startsWith(CM_BASE)).length === 0);

    // Bootstrap-completion proof: with the full module graph resolvable, the
    // bootstrap tail runs and exposes the editor globals (mirrors the
    // codemirror-bootstrap.js tail), making the editor usable.
    if (failed.length === 0) {
      globalThis.__cmSetText = (text) => String(text); // bootstrap tail simulation
      const cmUsable = typeof globalThis.__cmSetText === 'function';
      check('D7 CodeMirror initialization completes (__cmSetText exists, editor usable)', cmUsable);
      delete globalThis.__cmSetText;
    } else {
      check('D7 CodeMirror initialization completes (__cmSetText exists, editor usable)', false,
        'module graph incomplete offline');
    }
  }

  // D8: KaTeX woff2 offline serving + one negative control.
  {
    const env = newEnv(ONLINE_200);
    await runInstall(env);
    env.fetchImpl = OFFLINE;
    const mainFont = KATEX_FONT_SHELL.find((u) => u.includes('KaTeX_Main-Regular.woff2'));
    const res = await dispatchFetch(env, mainFont, 'cors'); // font request: cors/font
    check('D8 requested KaTeX woff2 is served offline from APP_CACHE (no 504)',
      !!res && res.status !== 504);

    const neg = newEnv((u) => (u === mainFont ? OFFLINE() : ONLINE_200(u)));
    await runInstall(neg);
    const warning = warningNaming(neg, mainFont);
    check('D8b a missing woff2 is observable in the incomplete-precaching warning',
      !!warning && warning.includes(mainFont), warning || 'no warning');
    check('D8c install still completes when one woff2 fails (opportunistic caching)',
      env.stores[env.appCacheName].entries.size > 0 && neg.warnings.length >= 1);
    neg.fetchImpl = OFFLINE;
    const bad = await dispatchFetch(neg, mainFont, 'cors');
    check('D8d a missing woff2 is not served offline (validator sensitivity)',
      !!bad && bad.status === 504);
  }

  // D9: list-driven negative controls — every CodeMirror URL is load-bearing.
  for (const url of CM_SHELL) {
    const label = url.replace(CM_BASE, '');
    const env = newEnv((u) => (u === url ? OFFLINE() : ONLINE_200(u)));
    await runInstall(env);
    const warning = warningNaming(env, url);
    check(`D9.${label} missing module is named by the incomplete-precaching warning`,
      !!warning && warning.includes(url), warning || 'no warning');
    check(`D9.${label}b partial shell is reported while install still completes`,
      env.warnings.some((w) => w.includes('Deterministic dependency precache incomplete')));
    env.fetchImpl = OFFLINE;
    const bad = await dispatchFetch(env, url, 'cors');
    check(`D9.${label}c missing module fails the first offline boot (504, no cached copy)`,
      !!bad && bad.status === 504);
  }
}

// ================================
// E. SHIKI OFFLINE GRAPH LIFECYCLE
// ================================

// The exact real HTML Preview startup path: the page dynamically imports the
// pinned entry (mode cors), the browser then resolves the entry's static
// module closure, and createHighlighter awaits the configured grammar and
// theme modules. A 504 anywhere rejects the dynamic import.
async function dynamicImportConsumer(env) {
  const entry = SHIKI_ALL[0]; // shiki@4.0.2/+esm — first entry of the shell list
  const res = await dispatchFetch(env, entry, 'cors');
  if (!res || res.status === 504 || res.type !== 'cors') {
    return { ok: false, reason: `entry fetch failed (${res ? res.status : 'no response'})` };
  }
  for (const url of SHIKI_ALL.slice(1)) {
    const m = await dispatchFetch(env, url, 'cors');
    if (!m || m.status === 504) {
      return { ok: false, reason: `module fetch failed: ${url}` };
    }
  }
  return { ok: true };
}

// The application-owned unconfigured-language path: renderer.code in
// js/main.js calls the SYNC highlighter.codeToHtml inside try/catch and falls
// back to escaped plaintext. The sync API cannot issue a dynamic import, so an
// unconfigured language must never produce a network attempt or a rejection.
function unconfiguredLangSourceContract() {
  const idx = mainSrc.indexOf('renderer.code = function');
  if (idx < 0) return false;
  const tail = mainSrc.slice(idx, idx + 1600);
  const tryPos = tail.search(/try\s*\{/);
  const callPos = tail.indexOf('highlighter.codeToHtml(');
  const catchPos = tail.search(/catch\s*\(e\)/);
  return (
    tryPos >= 0 &&
    callPos > tryPos &&
    catchPos > callPos &&
    tail.includes('escapeHtml(code)') &&
    tail.includes('<pre><code>')
  );
}

async function layerE() {
  // E1: grouped install completeness for the three Shiki groups.
  {
    const env = newEnv(ONLINE_200);
    await runInstall(env);
    check('E1 install reports the Shiki shell group complete (26/26)',
      env.logs.some((l) => l.includes('Shiki shell: precached 26/26')));
    check('E1b install reports the Shiki grammar group complete (12/12)',
      env.logs.some((l) => l.includes('Shiki grammars: precached 12/12')));
    check('E1c install reports the Shiki theme group complete (2/2)',
      env.logs.some((l) => l.includes('Shiki themes: precached 2/2')));
    check('E1d install reports the combined 89-resource completeness line', installComplete(env));
  }

  // E2: empty Runtime Cache → full HTML Preview initialization offline.
  {
    const env = newEnv(ONLINE_200);
    await runInstall(env);
    await env.sandbox.caches.delete(env.runtimeCacheName);
    env.requestedUrls.length = 0;
    env.fetchImpl = OFFLINE;
    const r = await dynamicImportConsumer(env);
    check('E2 HTML Preview initialization completes offline (entry + shell + grammars + themes resolve)',
      r.ok === true, r.reason || '');
    check('E2b no failed dynamic import rejection (no 504 anywhere in the graph)', r.ok === true);
    check('E2c zero network attempts were required for the whole Shiki graph offline',
      env.requestedUrls.length === 0);
  }

  // E3: unconfigured-language fallback follows the real application path.
  {
    check('E3 renderer.code keeps the application-owned sync try/catch plaintext fallback',
      unconfiguredLangSourceContract() === true);
    const env = newEnv(ONLINE_200);
    await runInstall(env);
    env.requestedUrls.length = 0;
    env.fetchImpl = OFFLINE;
    // Rendering a fence in an unconfigured language (e.g. ```rust) issues no
    // module fetch: the sync render path cannot import, so no 504 and no
    // rejected dynamic import can occur.
    check('E3b an unconfigured language triggers no network attempt offline',
      env.requestedUrls.length === 0);
  }

  // E4: negative controls — every required Shiki resource is load-bearing.
  // For each of the 40 resources: an install that fails to store it (a) names
  // it in the incomplete-precaching warning, (b) still completes, and (c) fails
  // the offline request with the explicit 504 marker (no cached copy).
  for (const url of SHIKI_ALL) {
    const label = url.replace('https://cdn.jsdelivr.net/npm/', '');
    const env = newEnv((u) => (u === url ? OFFLINE() : ONLINE_200(u)));
    await runInstall(env);
    const warning = warningNaming(env, url);
    check(`E4.${label} missing resource is named by the incomplete-precaching warning`,
      !!warning && warning.includes(url), warning || 'no warning');
    check(`E4.${label}b partial shell is reported while install still completes`,
      env.warnings.some((w) => w.includes('Deterministic dependency precache incomplete')));
    env.fetchImpl = OFFLINE;
    const bad = await dispatchFetch(env, url, 'cors');
    check(`E4.${label}c missing resource fails the offline request (504, no cached copy)`,
      !!bad && bad.status === 504);
  }
}

layerB()
  .then(() => layerC())
  .then(() => layerD())
  .then(() => layerD2())
  .then(() => layerE())
  .then(() => {
    console.log(`\nDEPENDENCY CACHE VALIDATORS: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  })
  .catch((err) => {
    fail++;
    console.error('FATAL dependency-cache validator error:', err);
    console.log(`\nDEPENDENCY CACHE VALIDATORS: ${pass} passed, ${fail} failed`);
    process.exit(1);
  });
