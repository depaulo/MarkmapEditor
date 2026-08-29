// @ts-nocheck
// MarkmapEditor Screen Layout - S2 Pane Registry and Edge Restore.
// Orchestrator / state observer. Delegates show/hide/isVisible to per-pane
// visibility owners. Does NOT directly own pane geometry.

(function () {
  'use strict';

  const paneDefinitions = new Map();
  const listeners = new Set();
  let acting = false;
  let initializing = false;
  let observersBound = false;
  let lastPublished = null;

  const state = { contextId: null };

  function cleanId(value) {
    return String(value ?? '').trim();
  }

  function clonePaneDefinition(def) {
    return Object.freeze({
      id: def.id,
      label: def.label || def.id,
      contexts: Object.freeze([...(def.contexts || [])]),
      edge: def.edge || 'right',
      usefulContent: def.usefulContent !== false,
      elementId: def.elementId || '',
      splitterId: def.splitterId || '',
      adapter: def.adapter || {},
    });
  }

  function registerPane(input) {
    const id = cleanId(input?.id);
    if (!id) return { ok: false, reason: 'pane-id-required' };
    if (!input?.adapter) return { ok: false, reason: 'pane-adapter-required' };
    paneDefinitions.set(id, clonePaneDefinition({ ...input, id }));
    return { ok: true, paneId: id };
  }

  function unregisterPane(id) {
    const key = cleanId(id);
    return paneDefinitions.delete(key)
      ? { ok: true, paneId: key }
      : { ok: false, paneId: key, reason: 'not-registered' };
  }

  function getPane(id) {
    return paneDefinitions.get(cleanId(id)) || null;
  }

  function isPaneAvailable(id) {
    const pane = getPane(id);
    if (!pane) return false;
    const context = state.contextId;
    if (pane.contexts.length && !pane.contexts.includes(context)) return false;
    try {
      return pane.adapter.isAvailable?.() !== false;
    } catch {
      return true;
    }
  }

  function getAvailablePanes() {
    const context = state.contextId;
    return [...paneDefinitions.values()].filter(
      (p) => p.contexts.length === 0 || p.contexts.includes(context)
    );
  }

  function isPaneVisible(id) {
    const pane = getPane(id);
    if (!pane) return false;
    try {
      return pane.adapter.isVisible?.() !== false;
    } catch {
      return false;
    }
  }

  function isUsefulPaneVisible(id) {
    const pane = getPane(id);
    return Boolean(pane && pane.usefulContent !== false && isPaneVisible(id));
  }

  function snapshotKey() {
    const avail = getAvailablePanes().filter((p) => isPaneAvailable(p.id)).map((p) => p.id).sort();
    const vis = getAvailablePanes().filter((p) => isPaneVisible(p.id)).map((p) => p.id).sort();
    return JSON.stringify([state.contextId, avail, vis]);
  }

  function emit(paneId, reason) {
    const avail = getAvailablePanes().filter((p) => isPaneAvailable(p.id)).map((p) => p.id);
    const visible = getAvailablePanes().filter((p) => isPaneVisible(p.id)).map((p) => p.id);
    const detail = {
      contextId: state.contextId,
      ...(paneId ? { paneId } : {}),
      available: avail,
      visible,
      reason: reason || 'change',
    };
    lastPublished = snapshotKey();
    listeners.forEach((fn) => { try { fn(detail); } catch {} });
    try {
      if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
        window.dispatchEvent(new CustomEvent('mme-view-layout-changed', { detail }));
      }
    } catch {}
  }

  function finishAction(paneId, visible, changed) {
    if (changed) emit(paneId, changed === 'show' ? 'show' : 'hide');
    return { ok: true, paneId, visible, changed: Boolean(changed) };
  }

  function showPane(id, options = {}) {
    const pane = getPane(id);
    if (!pane) return { ok: false, paneId: cleanId(id), reason: 'not-registered' };
    if (!isPaneAvailable(id)) return { ok: false, paneId: pane.id, reason: 'unavailable' };
    const before = isPaneVisible(id);
    acting = true;
    let rejected = false;
    try { rejected = pane.adapter.show?.(options) === false; } catch { rejected = true; }
    finally { acting = false; }
    if (rejected) return { ok: false, paneId: pane.id, reason: 'pane-show-rejected' };
    const visible = isPaneVisible(id);
    return finishAction(pane.id, visible, visible !== before ? 'show' : false);
  }

  function hidePane(id, options = {}) {
    const pane = getPane(id);
    if (!pane) return { ok: false, paneId: cleanId(id), reason: 'not-registered' };
    if (!isPaneAvailable(id)) return { ok: false, paneId: pane.id, reason: 'unavailable' };
    const before = isPaneVisible(id);
    if (pane.usefulContent !== false && options.allowEmpty !== true && before) {
      const anyOther = getAvailablePanes().some((c) => c.id !== pane.id && c.usefulContent !== false && isPaneVisible(c.id));
      if (!anyOther) return { ok: false, paneId: pane.id, reason: 'last-useful-pane' };
    }
    acting = true;
    let rejected = false;
    try { rejected = pane.adapter.hide?.(options) === false; } catch { rejected = true; }
    finally { acting = false; }
    if (rejected) return { ok: false, paneId: pane.id, reason: 'pane-hide-rejected' };
    const visible = isPaneVisible(id);
    return finishAction(pane.id, visible, visible !== before ? 'hide' : false);
  }

  function togglePane(id, options = {}) {
    return isPaneVisible(id) ? hidePane(id, options) : showPane(id, options);
  }

  function getState() {
    return Object.freeze({
      contextId: state.contextId,
      availablePaneIds: Object.freeze(getAvailablePanes().filter((p) => isPaneAvailable(p.id)).map((p) => p.id)),
      visiblePaneIds: Object.freeze(getAvailablePanes().filter((p) => isPaneVisible(p.id)).map((p) => p.id)),
    });
  }

  function refresh() {
    syncMarkmapEdgeTab();
    if (acting || initializing) return getState();
    if (snapshotKey() === lastPublished) return getState();
    emit(null, 'refresh');
    return getState();
  }

  function getCurrentContextId() {
    try {
      if (typeof globalThis.currentAppContextId === 'string' && globalThis.currentAppContextId) {
        return globalThis.currentAppContextId;
      }
      const d = document.documentElement.dataset.appContext;
      if (d) return String(d);
      const sel = document.getElementById('appContextSelect');
      if (sel && sel.value) return String(sel.value);
    } catch {}
    return 'editor';
  }

  function setContext(contextId, options = {}) {
    const nextContextId = cleanId(contextId) || 'editor';
    // Context change exits fullscreen first (approved S3 contract).
    if (fsState && nextContextId !== state.contextId) exitFullscreen({ via: 'context-change' });
    state.contextId = nextContextId;
    const useful = getAvailablePanes().filter((p) => p.usefulContent !== false);
    const anyVisible = useful.some((p) => isPaneVisible(p.id));
    if (!anyVisible && options.allowEmpty !== true) {
      const fallback =
        useful.find((p) => p.id === 'editor') ||
        useful.find((p) => p.id === 'markmap') ||
        useful.find((p) => p.id === 'html') ||
        null;
      if (fallback) {
        acting = true;
        try { fallback.adapter.show?.({}); } catch {}
        acting = false;
      }
    }
    emit(null, 'context');
    return getState();
  }

  function subscribe(listener) {
    if (typeof listener === 'function') {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
    return () => {};
  }

  function ensureMarkmapEdgeTab() {
    try {
      if (document.getElementById('mmeMapEdgeRestore')) return;
      const viewer = document.getElementById('viewer');
      if (!viewer) return;
      const btn = document.createElement('button');
      btn.id = 'mmeMapEdgeRestore';
      btn.type = 'button';
      btn.className = 'mme-pane-edge-restore';
      btn.setAttribute('data-edge', 'right');
      btn.setAttribute('aria-label', 'Show Map');
      btn.setAttribute('title', 'Show Map');
      btn.hidden = true;
      btn.textContent = '\u{1F5FA}';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showPane('markmap');
      });
      viewer.appendChild(btn);
    } catch {}
  }

  function syncMarkmapEdgeTab() {
    const btn = document.getElementById('mmeMapEdgeRestore');
    if (!btn) return;
    const available = isPaneAvailable('markmap');
    const visible = isPaneVisible('markmap');
    btn.hidden = !(available && !visible);
  }

  function bindContextObserver() {
    if (observersBound || typeof MutationObserver !== 'function') return;
    observersBound = true;
    try {
      const obs = new MutationObserver(() => {
        const ctx = getCurrentContextId();
        if (ctx !== state.contextId) setContext(ctx);
        else refresh();
      });
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-app-context'] });
    } catch {}
  }

  function configure() {
    if (initializing) return getState();
    initializing = true;
    try {
      state.contextId = getCurrentContextId();
      bindContextObserver();
      if (typeof document !== 'undefined') ensureMarkmapEdgeTab();
      syncMarkmapEdgeTab();
      emit(null, 'init');
    } finally {
      initializing = false;
    }
    return getState();
  }

  // ---- S3: application-local pane fullscreen (registry-owned orchestration) ----
  let fsState = null; // { paneId, hiddenBefore, snapshot, enteredAt, el }
  let escapeBound = false;
  let fsResizeBound = false;

  function fsTargetElement(pane) {
    try {
      return document.getElementById(pane.elementId || '') || null;
    } catch {
      return null;
    }
  }

  function fsUpdateTopVar() {
    try {
      const bar = document.getElementById('toolbar');
      const h = bar ? Math.round(bar.getBoundingClientRect().height) : 0;
      document.documentElement.style.setProperty('--mme-fs-top', (h > 0 ? h : 0) + 'px');
    } catch {}
  }

  function fsModalOwnsEscape() {
    try {
      // A visible <dialog> or role=dialog surface consumes Escape first.
      return Boolean(document.querySelector('dialog[open], [role="dialog"]:not([hidden])'));
    } catch {
      return false;
    }
  }

  function ensureFsExitControl(pane) {
    try {
      if (document.getElementById('mmePaneFullscreenExit')) return;
      const host = fsTargetElement(pane) || document.body;
      const btn = document.createElement('button');
      btn.id = 'mmePaneFullscreenExit';
      btn.type = 'button';
      btn.title = 'Exit Fullscreen';
      btn.setAttribute('aria-label', 'Exit Fullscreen');
      btn.textContent = 'Exit Fullscreen';
      btn.addEventListener('click', () => exitFullscreen({ via: 'button' }));
      host.appendChild(btn);
    } catch {}
  }

  function removeFsExitControl() {
    try {
      document.getElementById('mmePaneFullscreenExit')?.remove();
    } catch {}
  }

  function captureFsSnapshot(paneId) {
    const visible = {};
    try {
      paneDefinitions.forEach((_def, id) => { visible[id] = isPaneVisible(id); });
    } catch {}
    let targetLayout = null;
    try { targetLayout = getPane(paneId)?.adapter.captureLayout?.({ mode: 'enter' }) ?? null; } catch {}
    let activeElement = null;
    try { activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null; } catch {}
    return { contextId: state.contextId, visible, targetLayout, activeElement };
  }

  function bindFsListeners() {
    if (escapeBound || typeof document === 'undefined') return;
    escapeBound = true;
    // Bubble phase: modal/menu handlers run first; respect defaultPrevented.
    document.addEventListener('keydown', (ev) => {
      if (!fsState || ev.key !== 'Escape' || ev.defaultPrevented) return;
      if (fsModalOwnsEscape()) return;
      ev.preventDefault();
      exitFullscreen({ via: 'escape' });
    });
    if (!fsResizeBound) {
      fsResizeBound = true;
      window.addEventListener('resize', () => {
        if (fsState) fsUpdateTopVar();
      });
    }
  }

  function enterFullscreen(id, options = {}) {
    const pane = getPane(id);
    if (!pane) return { ok: false, paneId: cleanId(id), reason: 'not-registered' };
    if (!isPaneAvailable(id)) return { ok: false, paneId: pane.id, reason: 'unavailable' };
    if (fsState && fsState.paneId === pane.id) {
      return { ok: true, paneId: pane.id, active: true, changed: false };
    }
    if (typeof document === 'undefined') return { ok: false, paneId: pane.id, reason: 'dom-unavailable' };
    // One fullscreen target only: restore previous composition, then enter.
    if (fsState) exitFullscreen({ via: 'switch' });
    const snapshot = captureFsSnapshot(pane.id);
    const hiddenBefore = !isPaneVisible(pane.id);
    if (hiddenBefore) {
      acting = true;
      try { pane.adapter.show?.({ viaFullscreen: true }); } catch {}
      acting = false;
    }
    const el = fsTargetElement(pane);
    const root = document.documentElement;
    root.classList.add('mme-pane-fullscreen-active');
    try { root.dataset.mmeFullscreenPane = pane.id; } catch {}
    if (el) el.classList.add('mme-pane-fullscreen-target');
    fsUpdateTopVar();
    ensureFsExitControl(pane);
    fsState = { paneId: pane.id, hiddenBefore, snapshot, enteredAt: Date.now(), el };
    try { pane.adapter.applyLayout?.({ mode: 'enter', baselineLayout: snapshot.targetLayout }); } catch {}
    try { snapshot.activeElement?.blur?.(); } catch {}
    emit(pane.id, 'enter-fullscreen');
    return { ok: true, paneId: pane.id, active: true, changed: true };
  }

  function exitFullscreen(options = {}) {
    if (!fsState) return { ok: true, paneId: null, active: false, changed: false };
    const fs = fsState;
    fsState = null;
    const pane = getPane(fs.paneId);
    // Capture fullscreen-mode layout (e.g. zoom/pan changed during fullscreen).
    let fullscreenLayout = null;
    try { fullscreenLayout = pane?.adapter.captureLayout?.({ mode: 'exit' }) ?? null; } catch {}
    const root = document.documentElement;
    root.classList.remove('mme-pane-fullscreen-active');
    try { delete root.dataset.mmeFullscreenPane; } catch {}
    if (fs.el) fs.el.classList.remove('mme-pane-fullscreen-target');
    removeFsExitControl();
    // Undo temporary visibility changes made for fullscreen entry only.
    if (fs.hiddenBefore && pane) {
      acting = true;
      try { pane.adapter.hide?.({ viaFullscreen: true }); } catch {}
      acting = false;
    }
    // Restore pre-fullscreen geometry/state; fullscreenLayout wins when valid.
    try {
      pane?.adapter.restoreLayout?.({
        mode: 'exit',
        fullscreenLayout,
        baselineLayout: fs.snapshot.targetLayout,
      });
    } catch {}
    try { fs.snapshot.activeElement?.focus?.(); } catch {}
    emit(fs.paneId, 'exit-fullscreen');
    return { ok: true, paneId: fs.paneId, active: false, changed: true };
  }

  function isFullscreen() {
    return Boolean(fsState);
  }

  function getFullscreenState() {
    if (!fsState) return Object.freeze({ active: false, paneId: null, enteredAt: null });
    return Object.freeze({ active: true, paneId: fsState.paneId, enteredAt: fsState.enteredAt });
  }

  function notIntegrated(name) {
    return function () { return { ok: false, reason: 'not-integrated', capability: name }; };
  }

  // ---- Dormant validator (never runs automatically) ----
  function validateViewLayout() {
    const results = [];
    const test = (name, pass) => results.push({ name, pass: Boolean(pass) });

    const makeStub = (visible) => ({
      visible,
      isAvailable: () => true,
      isVisible() { return this.visible; },
      show() { this.visible = true; return true; },
      hide() { this.visible = false; return true; },
    });
    const pid = '__vl_validator_test__';

    test('api exists', typeof globalThis.MME_VIEW_LAYOUT === 'object');
    test('api frozen', Object.isFrozen(globalThis.MME_VIEW_LAYOUT));
    test('register requires adapter', registerPane({ id: pid }).ok === false);
    test('register blank id rejected', registerPane({ adapter: makeStub(true) }).ok === false);
    test('register pane', registerPane({ id: pid, adapter: makeStub(true) }).ok === true);
    test('register duplicate replaced', registerPane({ id: pid, adapter: makeStub(true) }).ok === true);
    test('getPane', getPane(pid)?.id === pid);
    test('isPaneVisible true', isPaneVisible(pid) === true);
    test('unknown result shape', showPane('__missing__').reason === 'not-registered');
    test('known pane registered', getPane('editor')?.id === 'editor');

    // Unregister synthetic pane so real registry unaffected.
    unregisterPane(pid);
    test('unregister removes', getPane(pid) === null);

    const fail = results.filter((r) => !r.pass);
    return Object.freeze({
      ok: fail.length === 0,
      passed: results.length - fail.length,
      total: results.length,
      failed: fail.length,
      results: Object.freeze(results.map((r) => Object.freeze({ ...r }))),
    });
  }

  function isPaneActing() {
    return acting;
  }

  const api = Object.freeze({
    registerPane, unregisterPane, getPane,
    isPaneAvailable, getAvailablePanes, isPaneVisible,
    showPane, hidePane, togglePane, getState, setContext, refresh, subscribe,
    configure, syncMarkmapEdgeTab, validateViewLayout, isPaneActing,
    enterFullscreen, exitFullscreen, isFullscreen, getFullscreenState,
    registerPreset: notIntegrated('registerPreset'),
    applyPreset: notIntegrated('applyPreset'),
    restoreAll: notIntegrated('restoreAll'),
  });

  globalThis.MME_VIEW_LAYOUT = api;
  if (typeof window !== 'undefined') window.MME_VIEW_LAYOUT = api;
})();
