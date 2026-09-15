// @ts-nocheck
// ================================
// MarkmapEditor Update Ready (0.6.1)
// Detection, state owner, explicit update-check owner, non-modal card,
// application-owned reload safety, message-gated activation, reload-once.
// Owned states: idle | installing | ready | resolving-document | activating |
//               reloading | dismissed | failed
// Update conditions: waiting-update | active-update
// This module owns ONLY the update flow. It never inspects Report identity,
// dirty state, or Draw.io internals; document safety is resolved through
// MME_APP.resolveBeforeApplicationReload({ reason: 'update' }).
// ================================

(function () {
  'use strict';

  // Centralized constants (owner-review values; single definition each).
  var UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes
  var UPDATE_CHECK_THROTTLE_MS = 5 * 60 * 1000; // shared throttle window
  var ACTIVATION_RECOVERY_TIMEOUT_MS = 15 * 1000; // UI recovery timeout only

  var COPY = Object.freeze({
    title: 'Update ready',
    body: 'A new MarkmapEditor version has been downloaded. Reload to use it.',
    reload: 'Reload',
    later: 'Later',
    cardLabel: 'MarkmapEditor update ready',
    reloadLabel: 'Reload MarkmapEditor to apply the update',
    laterLabel: 'Apply the MarkmapEditor update later',
    applying: 'Applying update…',
    failure: 'The update could not be applied. Your current work was not changed.'
  });

  function log(msg) {
    try {
      if (typeof globalThis.log === 'function') globalThis.log(msg);
      else console.log(msg);
    } catch (e) { /* logging must never block the update flow */ }
  }

  // ----- module state -----
  var wired = false; // idempotent init guard (listeners + timer)
  var registration = null;
  var state = 'idle';
  var updateCondition = null; // 'waiting-update' | 'active-update' | null
  var trackedWaiting = null; // the one tracked waiting-worker reference
  var trackedInstalling = null; // installing worker currently watched
  var cardWired = false;
  var dismissedWorker = null; // worker deferred by the user this page session

  // Reload-once transaction guard.
  var updateReloadRequested = false;
  var reloadTriggered = false;

  // Activation recovery timer.
  var recoveryTimer = null;

  // Explicit update-check owner state (one throttle, one in-flight promise).
  var lastCheckAt = 0;
  var checkInFlight = null;

  function el(id) { return document.getElementById(id); }

  function sameWorker(a, b) {
    return !!a && !!b && a.scriptURL === b.scriptURL;
  }

  function setState(next) {
    if (state !== next) state = next;
  }

  // ================================
  // Card (ACT E) — non-modal, no focus trap, no backdrop
  // ================================

  function card() { return el('updateReadyCard'); }

  function wireCard() {
    var c = card();
    if (!c || cardWired) return;
    cardWired = true;

    var btnReload = el('updateReadyReload');
    var btnLater = el('updateReadyLater');
    var btnClose = el('updateReadyClose');

    function bind(btn, fn) {
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        fn();
      });
    }
    bind(btnReload, onReloadSelected);
    bind(btnLater, onLater);
    bind(btnClose, onLater); // close icon behaves exactly as Later

    // Escape while the card is visible behaves as Later. Scoped check against
    // visibility; never traps or steals focus.
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (!c || c.hidden) return;
      onLater();
    });
  }

  function showCard() {
    var c = card();
    if (!c) { log('Update: card host missing'); return; }
    wireCard();
    showReadyBody();
    c.hidden = false;
  }

  function hideCard() {
    var c = card();
    if (c) c.hidden = true;
  }

  function showReadyBody() {
    var c = card();
    if (!c) return;
    var body = c.querySelector('.updateReadyBody');
    var actions = c.querySelector('.updateReadyActions');
    var applying = c.querySelector('.updateReadyApplying');
    var failure = c.querySelector('.updateReadyFailure');
    if (body) body.hidden = false;
    if (actions) actions.hidden = false;
    if (applying) applying.hidden = true;
    if (failure) failure.hidden = true;
  }

  function showApplying() {
    var c = card();
    if (!c) return;
    var body = c.querySelector('.updateReadyBody');
    var actions = c.querySelector('.updateReadyActions');
    var applying = c.querySelector('.updateReadyApplying');
    var failure = c.querySelector('.updateReadyFailure');
    if (body) body.hidden = true;
    if (actions) actions.hidden = true;
    if (failure) failure.hidden = true;
    if (applying) applying.hidden = false;
  }

  function showFailure() {
    var c = card();
    if (!c) return;
    var body = c.querySelector('.updateReadyBody');
    var actions = c.querySelector('.updateReadyActions');
    var applying = c.querySelector('.updateReadyApplying');
    var failure = c.querySelector('.updateReadyFailure');
    if (body) body.hidden = true;
    if (actions) actions.hidden = false;
    if (applying) applying.hidden = true;
    if (failure) failure.hidden = false;
  }

  // ================================
  // Waiting-worker tracking and detection (ACT D)
  // ================================

  function enterReadyWaiting(worker) {
    trackedWaiting = worker;
    setState('ready');
    updateCondition = 'waiting-update';
    log('Update: waiting worker ready');
    showCard();
  }

  function enterActiveUpdate() {
    trackedWaiting = null;
    setState('ready');
    updateCondition = 'active-update';
    showCard(); // same approved copy for 0.6.1
  }

  function setWaitingWorker(worker) {
    if (!worker) return;
    if (sameWorker(worker, trackedWaiting)) return; // idempotent per instance
    if (state === 'dismissed' && sameWorker(worker, dismissedWorker)) return;
    // A genuinely different (newer) worker replaces the tracked reference.
    enterReadyWaiting(worker);
  }

  function inspectBootWaiting() {
    if (!registration) return;
    var waiting = registration.waiting;
    var hasController = !!navigator.serviceWorker.controller;
    log(
      'Update: registration inspected waiting=' + (waiting ? 'yes' : 'no') +
      ' controller=' + (hasController ? 'yes' : 'no')
    );
    if (waiting && hasController) {
      // Existing controller + real waiting worker = application update.
      enterReadyWaiting(waiting);
    }
    // No controller at boot: first-ever installation lifecycle; no card.
  }

  function onInstallStateChange(worker) {
    if (!trackedInstalling || trackedInstalling.worker !== worker) return;
    if (worker.state === 'installed') {
      var hasController = !!navigator.serviceWorker.controller;
      var waiting = registration ? registration.waiting : null;
      if (hasController && waiting) {
        setWaitingWorker(waiting);
      } else if (!hasController) {
        // First-ever installation; do not show Update ready.
        setState('idle');
        updateCondition = null;
      }
      return;
    }
    if (worker.state === 'redundant') {
      if (sameWorker(worker, trackedWaiting)) {
        // The tracked waiting worker disappeared.
        trackedWaiting = null;
        setState('idle');
        updateCondition = null;
        hideCard();
      }
      if (trackedInstalling && trackedInstalling.worker === worker) {
        trackedInstalling = null;
        if (state === 'installing') setState('idle');
      }
    }
  }

  function watchInstalling(worker) {
    if (!worker) return;
    if (trackedInstalling && trackedInstalling.worker === worker) return; // same instance
    trackedInstalling = { worker: worker };
    setState('installing');
    log('Update: worker installing');
    worker.addEventListener('statechange', function () {
      onInstallStateChange(worker);
    });
  }

  function onRegistrationUpdateFound() {
    if (!registration) return;
    log('Update: new worker found');
    var installing = registration.installing;
    if (installing) watchInstalling(installing);
  }

  // ================================
  // controllerchange (single listener; reload-once guard)
  // ================================

  function onControllerChange() {
    if (updateReloadRequested && !reloadTriggered) {
      // Local activation transaction confirmed → reload exactly once.
      reloadTriggered = true;
      updateReloadRequested = false;
      clearRecoveryTimer();
      setState('reloading');
      log('Update: controller changed');
      log('Update: reload requested');
      try {
        window.location.reload();
      } catch (err) {
        log('Update: activation failed reload-error');
      }
      return;
    }
    if (state === 'reloading') return;
    // No local transaction: another tab or a browser action activated the
    // update. Preserve current work; offer a later document-safe reload.
    log('Update: controller changed (active-update)');
    enterActiveUpdate();
  }

  // ================================
  // Activation recovery (UI-only; never reloads on timeout)
  // ================================

  function clearRecoveryTimer() {
    if (recoveryTimer) {
      clearTimeout(recoveryTimer);
      recoveryTimer = null;
    }
  }

  function armRecoveryTimer() {
    clearRecoveryTimer();
    recoveryTimer = setTimeout(function () {
      recoveryTimer = null;
      if (!updateReloadRequested) return;
      // UI recovery only: never reload, never claim success, no doc mutation.
      updateReloadRequested = false;
      reloadTriggered = false;
      setState('failed');
      showFailure();
      log('Update: activation failed no-controllerchange');
    }, ACTIVATION_RECOVERY_TIMEOUT_MS);
  }

  // ================================
  // Reload safety consumption + Reload actions (ACT F/G)
  // ================================

  function resolveSafety() {
    var app = globalThis.MME_APP;
    if (!app || typeof app.resolveBeforeApplicationReload !== 'function') {
      log('Update: activation failed safety-owner-missing');
      return Promise.resolve('failure');
    }
    try {
      return Promise.resolve(app.resolveBeforeApplicationReload({ reason: 'update' }));
    } catch (err) {
      log('Update: activation failed safety-error');
      return Promise.resolve('failure');
    }
  }

  function onReloadSelected() {
    if (state === 'resolving-document' || state === 'activating') return;
    var isWaitingUpdate =
      updateCondition === 'waiting-update' &&
      !!trackedWaiting &&
      !!registration &&
      sameWorker(registration.waiting, trackedWaiting);

    setState('resolving-document');
    // Safety is resolved freshly on EVERY Reload attempt (never cached).
    resolveSafety().then(function (result) {
      if (result === 'cancel') {
        setState('ready');
        showReadyBody();
        log('Update: document transition cancelled');
        return;
      }
      if (
        result !== 'proceed-clean' &&
        result !== 'proceed-after-save' &&
        result !== 'proceed-after-discard'
      ) {
        setState('failed');
        showFailure();
        log('Update: activation failed safety-' + String(result || 'unknown'));
        return;
      }

      if (isWaitingUpdate) {
        startWaitingUpdateActivation();
        return;
      }

      // active-update path: another tab already activated the update.
      // Safety resolved again above; reload directly once; no SKIP_WAITING.
      updateReloadRequested = false;
      reloadTriggered = false;
      setState('reloading');
      log('Update: reload requested');
      try {
        window.location.reload();
      } catch (err) {
        setState('failed');
        showFailure();
      }
    });
  }

  function startWaitingUpdateActivation() {
    // Re-verify the tracked worker is still the current waiting worker.
    var waiting = registration ? registration.waiting : null;
    if (!waiting || !sameWorker(waiting, trackedWaiting)) {
      setState('failed');
      showFailure();
      log('Update: activation failed waiting-worker-gone');
      return;
    }
    // Guard set BEFORE postMessage.
    updateReloadRequested = true;
    reloadTriggered = false;
    setState('activating');
    showApplying();
    log('Update: activation requested');
    armRecoveryTimer();
    try {
      waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch (err) {
      updateReloadRequested = false;
      clearRecoveryTimer();
      setState('failed');
      showFailure();
      log('Update: activation failed postMessage');
    }
  }

  // ================================
  // Later (ACT E)
  // ================================

  function onLater() {
    // This page session only: no worker message, no reload, no Save, no
    // localStorage preference, no release seen-state write; Markdown is
    // byte-for-byte unchanged.
    dismissedWorker = trackedWaiting;
    setState('dismissed');
    hideCard();
    log('Update: deferred');
  }

  // ================================
  // Explicit update-check owner (ACT D)
  // One owner, one throttle, one in-flight promise shared by all triggers.
  // ================================

  function requestUpdateCheck(reason, options) {
    if (!registration || typeof registration.update !== 'function') {
      return Promise.resolve(null);
    }
    if (!navigator.onLine) {
      log('Update: check skipped reason=offline');
      return Promise.resolve(null);
    }
    if (checkInFlight) {
      log('Update: check already in progress');
      return checkInFlight;
    }
    var immediate = !!(options && options.immediate);
    var now = Date.now();
    if (!immediate && now - lastCheckAt < UPDATE_CHECK_THROTTLE_MS) {
      log('Update: check skipped reason=throttled');
      return Promise.resolve(null);
    }

    log('Update: check requested reason=' + reason);
    lastCheckAt = now;
    checkInFlight = registration.update().then(function () {
      checkInFlight = null;
      log('Update: check complete');
      return null;
    }, function (err) {
      checkInFlight = null;
      log('Update: check complete (failed: ' + String((err && err.message) || err) + ')');
      return null;
    });
    return checkInFlight;
  }

  // ================================
  // Initialization (idempotent; one of each listener/timer ever)
  // ================================

  function initUpdateReady(reg) {
    if (!reg) return;
    if (wired && registration === reg) return; // same registration: full no-op
    if (wired) return; // never rewire to a second registration owner

    registration = reg;
    wired = true;

    // Single controllerchange listener.
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    // Single updatefound listener on the existing registration.
    reg.addEventListener('updatefound', onRegistrationUpdateFound);

    // Visible-return trigger (visibilitychange only; no focus listener).
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        requestUpdateCheck('visible');
      }
    });

    // Online-return trigger.
    window.addEventListener('online', function () {
      requestUpdateCheck('online');
    });

    // Exactly one periodic timer (page teardown destroys it naturally).
    setInterval(function () {
      requestUpdateCheck('interval');
    }, UPDATE_CHECK_INTERVAL_MS);

    wireCard();

    // Boot-time waiting inspection, then the startup check (startup is
    // immediate; every other trigger shares the centralized throttle).
    inspectBootWaiting();
    requestUpdateCheck('startup', { immediate: true });
  }

  // Public surface.
  try {
    globalThis.MME_UPDATE_READY = {
      initUpdateReady: initUpdateReady,
      requestUpdateCheck: requestUpdateCheck,
      getState: function () { return state; },
      getCondition: function () { return updateCondition; },
      COPY: COPY,
      UPDATE_CHECK_INTERVAL_MS: UPDATE_CHECK_INTERVAL_MS,
      ACTIVATION_RECOVERY_TIMEOUT_MS: ACTIVATION_RECOVERY_TIMEOUT_MS
    };
  } catch (e) { /* export must never block boot */ }
})();
