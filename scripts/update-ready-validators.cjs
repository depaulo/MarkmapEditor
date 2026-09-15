// @ts-nocheck
'use strict';
// Update Ready focused validators (0.6.1 ACT H).
// Two layers:
//   A. source-structure checks (regex on owner files);
//   B. executable DOM/JS-stub validation of js/pwa/update-ready.js
//      (idempotency, Later, Reload, controllerchange, recovery, check owner).
// Run: node scripts/update-ready-validators.cjs

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
const urSrc = read('js/pwa/update-ready.js');
const diagSrc = read('js/pwa/diagnostics.js');
const mainSrc = read('js/main.js');
const htmlSrc = read('index.html');
const relSrc = read('js/release/release.js');
const rncSrc = read('js/ui/release-notes-content.js');
// Code-only views (comments stripped) prevent doc-comment false positives.
const urCode = urSrc.replace(/\/\/[^\n]*/g, '');

const shellBlock = swSrc.split('const LOCAL_APP_SHELL')[1].split('];')[0];
const countInShell = (a) => shellBlock.split(`'./${a}'`).length - 1;

// ================================
// SERVICE WORKER (44-50)
// ================================
check('44 install event has no unconditional skipWaiting',
  !/install'[\s\S]{0,600}?sw\.skipWaiting\(\)/.test(swSrc));
check('45 message handler accepts SKIP_WAITING',
  /addEventListener\('message'[\s\S]{0,200}SKIP_WAITING[\s\S]{0,120}sw\.skipWaiting\(\)/.test(swSrc));
check('46 sw.js has exactly one message listener',
  swSrc.match(/addEventListener\('message'/g).length === 1);
check('47 clients.claim remains present', swSrc.includes('sw.clients.claim();'));
check('48 prefix cleanup remains present', /CACHE_PREFIX/.test(swSrc) && /caches\.delete/.test(swSrc));
check('49 fetch handler remains present', swSrc.includes("addEventListener('fetch'"));
check('50 sw.js APP_VERSION remains semantic 0.6.0',
  swSrc.includes("APP_VERSION = 'markmap-journal-pwa-0.6.0-help-release-foundation'"));
check('68 update-ready assets in LOCAL_APP_SHELL exactly once',
  countInShell('css/update-ready.css') === 1 && countInShell('js/pwa/update-ready.js') === 1,
  `css=${countInShell('css/update-ready.css')} js=${countInShell('js/pwa/update-ready.js')}`);
check('69 validator scripts not in LOCAL_APP_SHELL',
  !shellBlock.includes('validators'));
check('70 no temporary test identity exists',
  !/test1|0\.6\.2-test|v7\d-/.test(swSrc));

// ================================
// UPDATE CHECK OWNER (1-15)
// ================================
check('1 registration.update() through one centralized owner',
  urSrc.match(/registration\.update\(\)/g).length === 1);
check('2 diagnostics passes the existing registration to initUpdateReady',
  /MME_UPDATE_READY\??\.initUpdateReady\(reg\)/.test(diagSrc));
check('2b diagnostics performs exactly one register call',
  diagSrc.match(/serviceWorker\.register\(/g).length === 1);
check('3 startup requests a check', urSrc.includes("requestUpdateCheck('startup'"));
check('4 visible-return requests a check', urSrc.includes("requestUpdateCheck('visible'"));
check('5 online event requests a check', urSrc.includes("requestUpdateCheck('online'"));
check('6 exactly one periodic timer exists',
  urSrc.match(/setInterval\(/g).length === 1 && urSrc.match(/setTimeout\(/g).length === 1);
check('7 interval centralized as one constant',
  urSrc.match(/UPDATE_CHECK_INTERVAL_MS\s*=\s*[^;]+;/g).length === 1);
check('8 initial interval is 60 minutes',
  /UPDATE_CHECK_INTERVAL_MS\s*=\s*60 \* 60 \* 1000/.test(urSrc));
check('9 all triggers share one throttle',
  urSrc.match(/UPDATE_CHECK_THROTTLE_MS/g).length >= 2 && urSrc.includes('reason=throttled'));
check('10 all triggers share one in-flight owner',
  urSrc.includes('check already in progress') && urSrc.match(/checkInFlight/g).length >= 4);
check('11 offline skips checks', urSrc.includes('reason=offline') && urSrc.includes('navigator.onLine'));
check('13 update checks never reload',
  !/check[\s\S]{0,400}location\.reload/.test(urSrc));
check('14 update checks never modify Markdown',
  !/md\.value|setMarkdown|__cmSetText/.test(urSrc));
check('15 update checks never write mme:lastSeenRelease',
  !urSrc.includes('lastSeenRelease') && !urSrc.includes('lastSeenKey'));
check('check-owner diagnostics present',
  urSrc.includes('Update: new worker found') && urSrc.includes('Update: worker installing') &&
  urSrc.includes('Update: waiting worker ready') && urSrc.includes('Update: check complete') &&
  urSrc.includes('Update: registration inspected'));

// ================================
// CARD / LATER (22-32)
// ================================
check('22 card is non-modal (no backdrop/dialog/aria-modal/focus trap)',
  !/updateReadyBackdrop|aria-modal|role="dialog"|\.focus\(\)/.test(urSrc) &&
  !/aria-modal/.test(htmlSrc.slice(htmlSrc.indexOf('updateReadyCard'))));
check('23 card has role=status', /id="updateReadyCard"[\s\S]{0,200}role="status"/.test(htmlSrc));
check('24 approved card aria-label', htmlSrc.includes('aria-label="MarkmapEditor update ready"'));
check('25 Reload aria-label verbatim',
  htmlSrc.includes('aria-label="Reload MarkmapEditor to apply the update"'));
check('26 Later aria-label verbatim',
  htmlSrc.includes('aria-label="Apply the MarkmapEditor update later"'));
check('27 Later sends no worker message', !/deferred[\s\S]{0,100}postMessage/.test(urSrc));
check('28 Later reloads nothing', !/deferred[\s\S]{0,200}location\.reload/.test(urSrc));
check('29 Later writes no storage',
  !/localStorage|sessionStorage/.test(urCode));
check('30 Escape routes to Later', /Escape/.test(urSrc) && /onLater\(\);/.test(urSrc));
check('31 no toolbar update icon exists', !htmlSrc.includes('updateToolbarIcon') && !/id="btnUpdate/.test(htmlSrc));
check('32 no Update Settings UI exists', !htmlSrc.includes('updateSettings') && !urSrc.includes('updateSettings'));
check('approved applying copy', htmlSrc.includes('Applying update…'));
check('approved failure copy',
  htmlSrc.includes('The update could not be applied. Your current work was not changed.'));
check('css link present', htmlSrc.includes('./css/update-ready.css'));
check('script load order: update-ready before diagnostics',
  htmlSrc.indexOf('js/pwa/update-ready.js') < htmlSrc.lastIndexOf('js/pwa/diagnostics.js'));

// ================================
// DOCUMENT SAFETY (33-43)
// ================================
check('33 update module calls the one MME_APP safety coordinator',
  urCode.match(/resolveBeforeApplicationReload\(/g).length === 1);
check('33b main.js exposes the coordinator on MME_APP',
  mainSrc.includes('resolveBeforeApplicationReload,') &&
  mainSrc.match(/function resolveBeforeApplicationReload/g).length === 1);
check('34 update module never reads/writes dirty directly',
  !/\bdirty\b/.test(urSrc.replace(/\/\/[^\n]*/g, '')));
check('35 update module does not inspect Report identity',
  !/report|drawio/i.test(urSrc.replace(/\/\/[^\n]*/g, '')));
check('36 update module contains no Draw.io reset',
  !/reconcil/i.test(urSrc.replace(/\/\/[^\n]*/g, '')));
check('40-42 cancel/failure paths send no activation message',
  !/cancel[\s\S]{0,300}postMessage/.test(urSrc) && !/failed safety[\s\S]{0,300}postMessage/.test(urSrc));
check('43 safety resolved per Reload (no cached decision)',
  !/cachedSafety|lastSafetyResult/.test(urSrc));

// ================================
// RELOAD GUARD (51-60)
// ================================
check('51 guard set before postMessage',
  urSrc.indexOf('updateReloadRequested = true;') < urSrc.indexOf("postMessage({ type: 'SKIP_WAITING' })"));
check('54 active-update sends no SKIP_WAITING',
  !/active-update[\s\S]{0,400}SKIP_WAITING/.test(urCode));
check('56 recovery timeout never reloads',
  !/recoveryTimer[\s\S]{0,600}location\.reload/.test(urSrc));
check('57 recovery timeout clears the local transaction',
  /recoveryTimer = setTimeout\(function \(\) \{[\s\S]{0,600}updateReloadRequested = false;[\s\S]{0,300}ACTIVATION_RECOVERY_TIMEOUT_MS\);/.test(urSrc));
check('59 location.reload in guarded paths only',
  urSrc.match(/location\.reload\(\)/g).length === 2);
check('16 updatefound wired once', urCode.match(/updatefound/g).length === 1);
check('60 one controllerchange listener registration',
  /addEventListener\('controllerchange'/g.test(urSrc) &&
  urSrc.match(/addEventListener\('controllerchange'/g).length === 1);
check('one visibilitychange listener', urCode.match(/visibilitychange/g).length === 1);
check('one online listener', urSrc.match(/addEventListener\('online'/g).length === 1);
check('no focus listener', !urSrc.includes("'focus'"));

// ================================
// RELEASE INTEGRITY (61-67)
// ================================
check('61 no lastSeenKey write in update module', !/lastSeen/.test(urSrc));
check('63 Release Notes content has no 0.6.1 entry', !rncSrc.includes('0.6.1'));
check('64 productVersion remains 0.6.0', relSrc.includes("productVersion: '0.6.0'"));
check('65 release cache identity remains semantic 0.6.0',
  relSrc.includes("cacheIdentity: 'markmap-journal-pwa-0.6.0-help-release-foundation'"));

// ================================
// EXECUTABLE STUB VALIDATION (js/pwa/update-ready.js)
// ================================

function makeElementStub() {
  const handlers = {};
  const children = {};
  const el = {
    hidden: true,
    textContent: '',
    addEventListener(type, fn) {
      (handlers[type] = handlers[type] || []).push(fn);
    },
    dispatch(type, ev) {
      (handlers[type] || []).forEach((fn) =>
        fn(ev || { preventDefault() {}, stopPropagation() {}, key: '' })
      );
    },
    querySelector(sel) {
      if (!children[sel]) children[sel] = { hidden: true, textContent: '' };
      return children[sel];
    },
  };
  return { el, handlers, children };
}

function runUpdateReadyModule(env) {
  const sandbox = {};
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.console = console;
  sandbox.Promise = Promise;
  sandbox.Date = Date;
  sandbox.Object = Object;
  sandbox.String = String;
  sandbox.setTimeout = (fn, ms) => { env.timeouts.push({ fn, ms }); return env.timeouts.length; };
  sandbox.clearTimeout = (id) => { if (env.timeouts[id - 1]) env.timeouts[id - 1].cleared = true; };
  sandbox.setInterval = (fn, ms) => { env.intervals.push({ fn, ms }); return env.intervals.length; };
  sandbox.clearInterval = () => {};
  sandbox.document = env.document;
  sandbox.window = env.window;
  sandbox.navigator = env.navigator;
  sandbox.MME_APP = env.mmeApp; // mutable holder; tests mutate its methods
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/pwa/update-ready.js'), 'utf8'), sandbox, {
    filename: 'update-ready.js',
  });
  return sandbox.MME_UPDATE_READY;
}

function stubEnvironment({ online = true, controller = { scriptURL: 'old.js' } } = {}) {
  const env = {
    timeouts: [],
    intervals: [],
    docListeners: {},
    winListeners: {},
    regListeners: {},
    swListeners: {},
    reloadCalls: 0,
    checkCalls: 0,
  };
  env.document = {
    visibilityState: 'visible',
    addEventListener(type, fn) { (env.docListeners[type] = env.docListeners[type] || []).push(fn); },
    getElementById(id) {
      if (id === 'updateReadyCard') return env.card.el;
      if (id === 'updateReadyReload') return env.btnReload.el;
      if (id === 'updateReadyLater') return env.btnLater.el;
      if (id === 'updateReadyClose') return env.btnClose.el;
      return null;
    },
  };
  env.window = {
    addEventListener(type, fn) { (env.winListeners[type] = env.winListeners[type] || []).push(fn); },
    location: { reload() { env.reloadCalls++; } },
  };
  env.navigator = {
    onLine: online,
    serviceWorker: {
      controller,
      addEventListener(type, fn) { (env.swListeners[type] = env.swListeners[type] || []).push(fn); },
    },
  };
  env.card = makeElementStub();
  env.btnReload = makeElementStub();
  env.btnLater = makeElementStub();
  env.btnClose = makeElementStub();
  env.mmeApp = {}; // mutated per test: resolveBeforeApplicationReload
  env.makeRegistration = (waiting) => ({
    waiting: waiting || null,
    installing: null,
    active: null,
    update() { env.checkCalls++; return Promise.resolve(); },
    addEventListener(type, fn) { (env.regListeners[type] = env.regListeners[type] || []).push(fn); },
  });
  env.makeWorker = (scriptURL) => {
    const w = { scriptURL, state: 'installing', listeners: {}, postMessageCalls: [] };
    w.addEventListener = (type, fn) => { (w.listeners[type] = w.listeners[type] || []).push(fn); };
    w.setState = (s) => { w.state = s; (w.listeners.statechange || []).forEach((fn) => fn()); };
    w.postMessage = (msg) => { w.postMessageCalls.push(msg); };
    return w;
  };
  return env;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

async function stubValidation() {
  // 17/12/19/27-30: boot card, idempotent init, Later.
  {
    const env = stubEnvironment();
    const M = runUpdateReadyModule(env);
    const waiting = env.makeWorker('new.js');
    const reg = env.makeRegistration(waiting);
    M.initUpdateReady(reg);
    await flush();
    check('17 waiting worker at boot shows one card', env.card.el.hidden === false);
    check('17b condition is waiting-update', M.getCondition() === 'waiting-update');
    check('3b startup requested a check', env.checkCalls === 1);

    const timersBefore = env.intervals.length;
    const ufBefore = env.regListeners.updatefound.length;
    M.initUpdateReady(reg);
    check('12 repeated init adds no timer/listener',
      env.intervals.length === timersBefore && env.regListeners.updatefound.length === ufBefore);

    env.regListeners.updatefound.forEach((fn) => fn()); // updatefound with no installing
    check('19 duplicate updatefound without installing is safe', M.getState() !== 'reloading');

    env.btnLater.el.dispatch('click');
    check('27/28/29 Later hides card, no message, no reload',
      env.card.el.hidden === true && env.reloadCalls === 0 && waiting.postMessageCalls.length === 0);
    check('Later state is dismissed', M.getState() === 'dismissed');

    const inst = env.makeWorker('new.js');
    reg.installing = inst;
    env.regListeners.updatefound.forEach((fn) => fn());
    inst.setState('installed');
    check('same dismissed worker does not immediately re-show',
      env.card.el.hidden === true || M.getState() === 'dismissed');
  }

  // 16: first install guarded.
  {
    const env = stubEnvironment({ controller: null });
    const M = runUpdateReadyModule(env);
    const reg = env.makeRegistration(null);
    M.initUpdateReady(reg);
    const inst = env.makeWorker('first.js');
    reg.installing = inst;
    env.regListeners.updatefound.forEach((fn) => fn());
    inst.setState('installed');
    check('16 first installation does not show card', env.card.el.hidden === true);
    check('16b first-install condition is not waiting-update', M.getCondition() !== 'waiting-update');
  }

  // 18/21: updatefound path; newer worker replaces reference and re-shows.
  {
    const env = stubEnvironment();
    const M = runUpdateReadyModule(env);
    const reg = env.makeRegistration(null);
    M.initUpdateReady(reg);
    const inst = env.makeWorker('new2.js');
    reg.installing = inst;
    env.regListeners.updatefound.forEach((fn) => fn());
    reg.waiting = inst; // browser promotes installed → waiting before statechange fires
    inst.setState('installed');
    check('18 updatefound + installed + controller shows card', env.card.el.hidden === false);
    env.btnLater.el.dispatch('click');
    check('18b dismissed after first detection', env.card.el.hidden === true);
    const inst2 = env.makeWorker('newer.js');
    reg.installing = inst2;
    env.regListeners.updatefound.forEach((fn) => fn());
    reg.waiting = inst2;
    inst2.setState('installed');
    check('21 newer waiting worker replaces reference and re-shows',
      env.card.el.hidden === false && M.getCondition() === 'waiting-update');
  }

  // 37/40/51/52: clean proceed → one SKIP_WAITING → controllerchange reloads once.
  {
    const env = stubEnvironment();
    const M = runUpdateReadyModule(env);
    const waiting = env.makeWorker('new.js');
    const reg = env.makeRegistration(waiting);
    env.mmeApp.resolveBeforeApplicationReload = () => Promise.resolve('proceed-clean');
    M.initUpdateReady(reg);
    await flush();
    env.btnReload.el.dispatch('click');
    await flush();
    check('37 clean proceed activates with one SKIP_WAITING',
      waiting.postMessageCalls.length === 1 && waiting.postMessageCalls[0].type === 'SKIP_WAITING');
    check('37b state is activating', M.getState() === 'activating');
    env.swListeners.controllerchange.forEach((fn) => fn());
    check('52 controllerchange reloads exactly once after local request', env.reloadCalls === 1);
    env.swListeners.controllerchange.forEach((fn) => fn());
    check('52b repeated controllerchange does not reload again', env.reloadCalls === 1);
  }

  // 53/55: active-update handling.
  {
    const env = stubEnvironment();
    const M = runUpdateReadyModule(env);
    const reg = env.makeRegistration(null);
    M.initUpdateReady(reg);
    await flush();
    env.swListeners.controllerchange.forEach((fn) => fn());
    check('53 controllerchange without request does not reload', env.reloadCalls === 0);
    check('53b active-update condition entered', M.getCondition() === 'active-update');
    check('53c card shown for later direct reload', env.card.el.hidden === false);
    env.mmeApp.resolveBeforeApplicationReload = () => Promise.resolve('proceed-clean');
    env.btnReload.el.dispatch('click');
    await flush();
    check('55 active-update Reload reloads directly once, no SKIP_WAITING', env.reloadCalls === 1);
  }

  // 40/43: cancel; safety re-resolved per attempt.
  {
    const env = stubEnvironment();
    const M = runUpdateReadyModule(env);
    const waiting = env.makeWorker('new.js');
    const reg = env.makeRegistration(waiting);
    let safetyCalls = 0;
    env.mmeApp.resolveBeforeApplicationReload = () => { safetyCalls++; return Promise.resolve('cancel'); };
    M.initUpdateReady(reg);
    await flush();
    env.btnReload.el.dispatch('click');
    await flush();
    check('40 cancel sends no activation message and returns to ready',
      waiting.postMessageCalls.length === 0 && M.getState() === 'ready');
    env.btnReload.el.dispatch('click');
    await flush();
    check('43 safety resolved again on every Reload attempt', safetyCalls === 2);
  }

  // 41: failure path sends no message.
  {
    const env = stubEnvironment();
    const M = runUpdateReadyModule(env);
    const waiting = env.makeWorker('new.js');
    const reg = env.makeRegistration(waiting);
    env.mmeApp.resolveBeforeApplicationReload = () => Promise.resolve('failure');
    M.initUpdateReady(reg);
    await flush();
    env.btnReload.el.dispatch('click');
    await flush();
    check('41 failure sends no activation message',
      waiting.postMessageCalls.length === 0 && M.getState() === 'failed');
  }

  // 56/57/58: recovery timeout; late controllerchange.
  {
    const env = stubEnvironment();
    const M = runUpdateReadyModule(env);
    const waiting = env.makeWorker('new.js');
    const reg = env.makeRegistration(waiting);
    env.mmeApp.resolveBeforeApplicationReload = () => Promise.resolve('proceed-clean');
    M.initUpdateReady(reg);
    await flush();
    env.btnReload.el.dispatch('click');
    await flush();
    const to = env.timeouts[env.timeouts.length - 1];
    to.fn();
    check('56/57 timeout enters failed, clears transaction, never reloads',
      env.reloadCalls === 0 && M.getState() === 'failed' && waiting.postMessageCalls.length === 1);
    env.swListeners.controllerchange.forEach((fn) => fn());
    check('58 late controllerchange after timeout follows active-update (no reload)',
      env.reloadCalls === 0 && M.getCondition() === 'active-update');
  }

  // 11/10/9: offline skip; shared in-flight; shared throttle.
  {
    const env = stubEnvironment({ online: false });
    const M = runUpdateReadyModule(env);
    const reg = env.makeRegistration(null);
    M.initUpdateReady(reg);
    await flush();
    check('11 offline skips even the startup check', env.checkCalls === 0);

    const env2 = stubEnvironment();
    const M2 = runUpdateReadyModule(env2);
    let resolveUpdate;
    const reg2 = {
      waiting: null, installing: null, active: null,
      update() { env2.checkCalls++; return new Promise((r) => { resolveUpdate = r; }); },
      addEventListener() {},
    };
    M2.initUpdateReady(reg2);
    const p1 = M2.requestUpdateCheck('visible');
    const p2 = M2.requestUpdateCheck('interval');
    check('10b concurrent triggers share one in-flight promise', p1 === p2);
    resolveUpdate();
    await flush();
    await M2.requestUpdateCheck('online');
    check('9b second trigger within throttle window is throttled', env2.checkCalls === 1);
  }
}

stubValidation()
  .then(() => {
    console.log(`\nUPDATE READY VALIDATORS: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  })
  .catch((err) => {
    fail++;
    console.error('FATAL stub validation error:', err);
    console.log(`\nUPDATE READY VALIDATORS: ${pass} passed, ${fail} failed`);
    process.exit(1);
  });


