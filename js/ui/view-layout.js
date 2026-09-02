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

  // ---- S4A state (presets + Quick Edit) ----
  const presetState = { defs: new Map(), currentPresetId: null, customized: false };
  let presetApplyDepth = 0;
  let qeState = null; // { originPresetId, previousEditorVisible, keepSurface, closing }
  let lastPresentationSurface = 'markmap';
  let selectorBound = false;

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
    // Final-state edge synchronization: emit() is the choke point for every
    // registry show/hide (pane-local Hide buttons, edge-restore clicks,
    // preset steps). syncMarkmapEdgeTab() was previously reached only through
    // refresh()/configure(), so a markmap hide/show that ended in emit() left
    // #mmeMapEdgeRestore stale until an unrelated refresh. Idempotent and
    // cheap; the preset transaction's final refresh() still runs afterwards.
    syncMarkmapEdgeTab();
    if (presetApplyDepth > 0) {
      // S4A: one meaningful preset event per transaction; update de-dup key so
      // the final event is not swallowed by refresh().
      lastPublished = snapshotKey();
      return;
    }
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
    // S4A: track the last-active Presentation surface and re-evaluate the
    // customized marker. Temporary states (fullscreen CSS suppression, Quick
    // Edit visibility/suppression) are excluded from customized evaluation.
    try {
      syncViewerEmptyState();
    } catch {}
    try {
      if (!fsState && !qeState) {
        if ((paneId === 'markmap' || paneId === 'html') && reason === 'show') {
          lastPresentationSurface = paneId;
        }
        evaluateCustomization();
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
      currentPreset: getCurrentPreset(),
    });
  }

  function refresh() {
    syncMarkmapEdgeTab();
    scheduleEdgeAudit();
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
    // S4A: context change closes Quick Edit first (approved contract).
    if (qeState && nextContextId !== state.contextId) closeQuickEdit({ via: 'context-change' });
    state.contextId = nextContextId;
    // S4A: retain the current preset only when available in the new context;
    // otherwise fall back to Custom. Never auto-apply a preset on context change.
    if (presetState.currentPresetId) {
      const def = getPreset(presetState.currentPresetId);
      if (!def || !def.contexts.includes(state.contextId) || !def.visibility[state.contextId]) {
        presetState.currentPresetId = null;
        presetState.customized = false;
      }
    }
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
    if (typeof document === 'undefined') return;
    const btn = document.getElementById('mmeMapEdgeRestore');
    if (!btn) return;
    const available = isPaneAvailable('markmap');
    const visible = isPaneVisible('markmap');
    btn.hidden = !(available && !visible);
  }

  // ---- One-shot final-state edge audit (anomaly-only) ----
  // Runs only at the final refresh choke point. Logs nothing on valid states;
  // logs once per distinct anomaly: an edge Restore/Open control rendered
  // while its pane is logically visible, or two visible edge controls whose
  // bounding rectangles intersect. No pointermove/resize/continuous logging.

  // Deferred execution: one pending audit at a time, always auditing the
  // LATEST final state. A refresh() that lands inside an owner's synchronous
  // flow (e.g. HTML display change before updateHtmlPreviewButtons) must not
  // classify that unpainted transitional state as a final defect; the single
  // animation frame runs after the whole synchronous flow settles. No
  // timeouts, no polling, no observers; anomaly de-duplication is preserved
  // by auditEdgeStateLog, and no DOM references are retained across frames.
  let edgeAuditScheduled = false;

  function scheduleEdgeAudit() {
    if (typeof requestAnimationFrame !== 'function') {
      auditEdgeState();
      return;
    }
    if (edgeAuditScheduled) return;
    edgeAuditScheduled = true;
    requestAnimationFrame(() => {
      edgeAuditScheduled = false;
      auditEdgeState();
    });
  }

  function auditEdgeState() {
    if (typeof document === 'undefined') return;
    try {
      const specs = [
        { id: 'mmeMapEdgeRestore', pane: 'markmap' },
        { id: 'btnHtmlEdgeOpen', pane: 'html' },
        { id: 'btnEditorEdgeOpen', pane: 'editor' },
      ];
      const shown = [];
      for (const s of specs) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const rendered = !(el.hidden || el.getClientRects().length === 0);
        if (rendered && isPaneVisible(s.pane)) {
          auditEdgeStateLog('edge-visible-while-pane-visible', s.id, el, null);
          return;
        }
        if (rendered) shown.push({ id: s.id, el });
      }
      for (let i = 0; i < shown.length; i++) {
        for (let j = i + 1; j < shown.length; j++) {
          const a = shown[i].el.getBoundingClientRect();
          const b = shown[j].el.getBoundingClientRect();
          const hit = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
          if (hit) {
            auditEdgeStateLog('edge-rect-overlap', shown[i].id, shown[i].el, shown[j].id);
            return;
          }
        }
      }
    } catch {}
  }

  function auditEdgeStateLog(kind, id, el, id2) {
    try {
      const preset = getCurrentPreset();
      const key = [kind, id, id2 || '-', state.contextId, preset ? preset.id : '-'].join('|');
      if (auditEdgeStateLog.__last === key) return; // once per distinct anomaly
      auditEdgeStateLog.__last = key;
      const r = el.getBoundingClientRect();
      const vis = {};
      ['markmap', 'html', 'editor'].forEach((p) => { vis[p] = isPaneVisible(p); });
      globalThis.log?.(
        `ViewLayout edge audit: ${kind} id=${id}${id2 ? '+' + id2 : ''}` +
          ` title="${el.title || el.getAttribute('aria-label') || ''}"` +
          ` hidden=${el.hidden} display=${getComputedStyle(el).display}` +
          ` rect=${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}x${Math.round(r.height)}` +
          ` context=${state.contextId} preset=${preset ? preset.id + (preset.customized ? '*' : '') : '-'}` +
          ` paneVisible=${JSON.stringify(vis)}` +
          ` root=${document.documentElement.className}`
      );
    } catch {}
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
      registerBuiltInPresets();
      if (typeof document !== 'undefined') ensureLayoutSelector();
      if (typeof document !== 'undefined') ensureQuickEditControls();
      syncQuickEditButton();
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
      // S4A: an open Layout menu also owns Escape (closes the menu only).
      return Boolean(
        document.querySelector('dialog[open], [role="dialog"]:not([hidden])') ||
        isLayoutMenuOpen()
      );
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
        // S4A: recompute only the temporary Quick Edit rendered surface on
        // resize; no owner show/hide calls, no preset customization impact.
        if (qeState) qeApplySurface();
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
    // S4A: fullscreen and Quick Edit are mutually exclusive; close Quick Edit
    // before entering fullscreen. (enterFullscreen is called after this guard.)
    if (qeState) closeQuickEdit({ via: 'fullscreen' });
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

  // ===================================================================
  // S4A: contextual presets, Layout selector, and Quick Edit.
  // All composition changes delegate to the existing pane adapters via
  // showPane/hidePane. No second visibility system, no direct owner DOM.
  // ===================================================================

  function cleanPresetDef(def) {
    const visibility = {};
    Object.entries(def.visibility || {}).forEach(([ctx, vis]) => {
      if (vis && typeof vis === 'object') visibility[ctx] = Object.freeze({ ...vis });
    });
    return Object.freeze({
      id: def.id,
      label: def.label || def.id,
      contexts: Object.freeze([...(def.contexts || [])]),
      visibility: Object.freeze(visibility),
      quickEditAvailable: def.quickEditAvailable === true,
      description: def.description || '',
    });
  }

  function registerPreset(def) {
    const id = cleanId(def?.id);
    if (!id) return { ok: false, reason: 'preset-id-required' };
    if (!def?.visibility || typeof def.visibility !== 'object') {
      return { ok: false, presetId: id, reason: 'preset-visibility-required' };
    }
    // Duplicate registration with the same id is deterministic (replace).
    presetState.defs.set(id, cleanPresetDef({ ...def, id }));
    return { ok: true, presetId: id };
  }

  function unregisterPreset(id) {
    const key = cleanId(id);
    return presetState.defs.delete(key)
      ? { ok: true, presetId: key }
      : { ok: false, presetId: key, reason: 'not-registered' };
  }

  function getPreset(id) {
    return presetState.defs.get(cleanId(id)) || null;
  }

  function getAvailablePresets(contextId) {
    const ctx = cleanId(contextId) || state.contextId;
    return [...presetState.defs.values()].filter(
      (p) => p.contexts.includes(ctx) && p.visibility[ctx]
    );
  }

  function getCurrentPreset() {
    if (!presetState.currentPresetId) return null;
    return Object.freeze({ id: presetState.currentPresetId, customized: presetState.customized });
  }

  function clearCurrentPreset(reason) {
    if (!presetState.currentPresetId) return { ok: true, changed: false };
    const prev = presetState.currentPresetId;
    presetState.currentPresetId = null;
    presetState.customized = false;
    syncLayoutSelector();
    syncQuickEditButton();
    emit(null, 'preset-cleared');
    return { ok: true, changed: true, presetId: prev, reason: cleanId(reason) || 'manual' };
  }

  function matchesPresetComposition(presetId, contextId) {
    const def = getPreset(presetId);
    if (!def) return false;
    const ctx = cleanId(contextId) || state.contextId;
    const vis = def.visibility[ctx];
    if (!vis) return false;
    // Only panes that are registered and available in this context can diverge.
    const keys = Object.keys(vis).filter((k) => {
      const pane = getPane(k);
      return pane && isPaneAvailable(k);
    });
    return keys.every((k) => isPaneVisible(k) === Boolean(vis[k]));
  }

  function evaluateCustomization() {
    if (presetApplyDepth > 0 || qeState || fsState) return;
    if (!presetState.currentPresetId) return;
    const match = matchesPresetComposition(presetState.currentPresetId, state.contextId);
    const next = !match;
    if (next !== presetState.customized) {
      presetState.customized = next;
      syncLayoutSelector();
    }
  }

  // ---- S4A FOCUS: derived viewer-empty state ----
  // Pure logical rule: the shared #viewer has visible content only when Map or
  // Preview is logically visible. Regardless of preset label, fullscreen CSS
  // suppression, or Quick Edit suppression, the derived state follows the
  // owners' logical visibility only.
  function isViewerEmpty() {
    return !isPaneVisible('markmap') && !isPaneVisible('html');
  }

  function syncViewerEmptyState() {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('mme-viewer-empty', isViewerEmpty());
  }

  function applyPreset(id, options = {}) {
    const presetId = cleanId(id);
    const def = getPreset(presetId);
    if (!def) return { ok: false, presetId, reason: 'not-registered' };
    const ctx = state.contextId;
    const vis = def.visibility[ctx];
    if (!vis || !def.contexts.includes(ctx)) {
      return { ok: false, presetId, reason: 'unavailable-context' };
    }
    // Approved ordering: exit fullscreen first, then close Quick Edit.
    if (fsState) exitFullscreen({ via: 'preset' });
    if (qeState) closeQuickEdit({ via: 'preset' });

    const snapshot = {};
    getAvailablePanes().forEach((p) => { snapshot[p.id] = isPaneVisible(p.id); });
    const failures = [];
    const applied = [];
    presetApplyDepth++;
    try {
      for (const key of Object.keys(vis)) {
        const pane = getPane(key);
        if (!pane || !isPaneAvailable(key)) continue;
        const desired = Boolean(vis[key]);
        if (isPaneVisible(key) === desired) continue; // no unnecessary transitions
        const res = desired
          ? showPane(key, { viaPreset: presetId, allowEmpty: true })
          : hidePane(key, { viaPreset: presetId, allowEmpty: true });
        if (!res?.ok) {
          failures.push({ paneId: key, reason: res?.reason || 'unknown' });
          break; // stop applying further dependent changes
        }
        applied.push(key);
      }
      const anyUseful = getAvailablePanes().some(
        (p) => p.usefulContent !== false && isPaneVisible(p.id)
      );
      if (failures.length || !anyUseful) {
        // Rollback to the pre-preset composition through the same owners.
        getAvailablePanes().forEach((p) => {
          const want = Boolean(snapshot[p.id]);
          if (isPaneVisible(p.id) === want) return;
          try {
            if (want) showPane(p.id, { viaPresetRollback: true, allowEmpty: true });
            else hidePane(p.id, { viaPresetRollback: true, allowEmpty: true });
          } catch {}
        });
        emit(null, 'preset-failed');
        return {
          ok: false,
          presetId,
          reason: failures[0]?.reason || 'no-useful-pane',
          failures,
          applied,
        };
      }
      // Record the preset only after success (approved contract).
      presetState.currentPresetId = presetId;
      presetState.customized = false;
      if (isPaneVisible('markmap')) lastPresentationSurface = 'markmap';
      if (isPaneVisible('html')) lastPresentationSurface = 'html';
    } finally {
      presetApplyDepth--; // always cleared, including on unexpected errors
    }
    refresh();
    emit(null, 'preset');
    syncLayoutSelector();
    syncQuickEditButton();
    return { ok: true, presetId, changed: true, applied };
  }

  function registerBuiltInPresets() {
    // Stable lowercase IDs; contextual composition helpers per context.
    registerPreset({
      id: 'work', label: 'Work', contexts: ['editor', 'journal', 'slides'],
      quickEditAvailable: false, description: 'Editor and Map',
      visibility: {
        editor: { editor: true, markmap: true, html: false },
        journal: { sidebar: true, editor: true, markmap: true, html: false },
        slides: { editor: true, markmap: true, html: false },
      },
    });
    registerPreset({
      id: 'review', label: 'Review', contexts: ['editor', 'journal', 'slides'],
      quickEditAvailable: false, description: 'Editor, Map and Preview',
      visibility: {
        editor: { editor: true, markmap: true, html: true },
        journal: { sidebar: true, editor: true, markmap: true, html: true },
        slides: { editor: true, markmap: true, html: true },
      },
    });
    registerPreset({
      id: 'presentation', label: 'Presentation', contexts: ['editor', 'journal', 'slides'],
      quickEditAvailable: true, description: 'Map and Preview; Quick Edit available',
      visibility: {
        editor: { editor: false, markmap: true, html: true },
        journal: { sidebar: false, editor: false, markmap: true, html: true },
        slides: { editor: false, markmap: true, html: true },
      },
    });
    registerPreset({
      id: 'focus', label: 'Focus', contexts: ['editor', 'journal', 'slides'],
      quickEditAvailable: false, description: 'Editor only',
      visibility: {
        editor: { editor: true, markmap: false, html: false },
        journal: { sidebar: false, editor: true, markmap: false, html: false },
        slides: { editor: true, markmap: false, html: false },
      },
    });
  }

  // ---- S4A: Quick Edit (real Editor, real CodeMirror; Presentation-local) ----

  function qeContentFitsAll() {
    // Measured capability check (source-proven S1 minimums), NOT the S4B
    // phone breakpoint. Returns true when Editor + Markmap + HTML fit.
    try {
      const viewer = document.getElementById('viewer');
      if (!viewer) return true;
      let need = 12; // two 6px splitters
      ['editor', 'mapPane', 'htmlPane'].forEach((eid) => {
        const el = document.getElementById(eid);
        if (!el) return;
        const mw = parseFloat(getComputedStyle(el).minWidth);
        need += Number.isFinite(mw) ? mw : 0;
      });
      return viewer.clientWidth >= need;
    } catch {
      return true;
    }
  }

  function qeDesiredSurface() {
    // Keep the last-active Presentation surface; suppress the other by CSS only.
    if (lastPresentationSurface === 'html' && isPaneVisible('html')) return 'html';
    if (isPaneVisible('markmap')) return 'markmap';
    if (isPaneVisible('html')) return 'html';
    return null;
  }

  function qeApplySurface() {
    if (!qeState || typeof document === 'undefined') return;
    const root = document.documentElement;
    if (qeContentFitsAll() || !qeDesiredSurface()) {
      delete root.dataset.mmeQuickEditSurface;
      qeState.keepSurface = null;
      return;
    }
    const keep = qeDesiredSurface();
    qeState.keepSurface = keep;
    root.dataset.mmeQuickEditSurface = keep;
  }

  function ensureQuickEditControls() {
    try {
      if (typeof document === 'undefined') return;
      const toolbar = document.getElementById('toolbar');
      if (!toolbar) return;
      // S4B: Quick Edit and Done now live in ONE toolbar group immediately
      // after #grpLayout (beside the Layout selector). No floating content
      // ownership: neither control is appended to #viewer/#mapPane/#htmlPane/
      // #editor or to document.body as an overlay.
      let group = document.getElementById('grpPresentationAction');
      if (!group) {
        group = document.createElement('div');
        group.className = 'btnGroup';
        group.id = 'grpPresentationAction';
        group.hidden = true;
        const grpLayout = document.getElementById('grpLayout');
        if (grpLayout) grpLayout.insertAdjacentElement('afterend', group);
        else toolbar.insertBefore(group, toolbar.querySelector('#grpFile') || null);
      }
      // Reuse-or-create launcher, then ensure it belongs to the group so a
      // pre-existing floating control is migrated (no duplicate id).
      let btn = document.getElementById('mmeQuickEditBtn');
      if (!btn) {
        btn = document.createElement('button');
        btn.id = 'mmeQuickEditBtn';
        btn.type = 'button';
        btn.className = 'mme-quick-edit-launch';
        btn.textContent = '✏️ Quick Edit';
        btn.setAttribute('aria-label', 'Quick Edit');
        btn.hidden = true;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openQuickEdit({ via: 'button' });
        });
      }
      if (btn.parentNode !== group) group.appendChild(btn);
      // Reuse-or-create Done, then ensure it belongs to the group.
      let done = document.getElementById('mmeQuickEditDone');
      if (!done) {
        done = document.createElement('button');
        done.id = 'mmeQuickEditDone';
        done.type = 'button';
        done.textContent = 'Done';
        done.setAttribute('aria-label', 'Close Quick Edit');
        done.hidden = true;
        done.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          closeQuickEdit({ via: 'done' });
        });
      }
      if (done.parentNode !== group) group.appendChild(done);
    } catch {}
  }

  // Group visibility: only visible in Presentation while not in pane fullscreen.
  function syncPresentationActionGroup() {
    try {
      if (typeof document === 'undefined') return;
      const group = document.getElementById('grpPresentationAction');
      if (!group) return;
      const presentationActive =
        presetState.currentPresetId === 'presentation' && !fsState;
      group.hidden = !presentationActive;
    } catch {}
  }

  function syncQuickEditButton() {
    try {
      const btn = document.getElementById('mmeQuickEditBtn');
      const done = document.getElementById('mmeQuickEditDone');
      const available =
        presetState.currentPresetId === 'presentation' &&
        !qeState && !fsState && !isPaneVisible('editor') &&
        isPaneAvailable('editor');
      if (btn) btn.hidden = !available;
      // Done shows only while Quick Edit is active (and only within the group,
      // which itself is hidden outside Presentation/fullscreen).
      if (done) done.hidden = !qeState;
      syncPresentationActionGroup();
    } catch {}
  }

  function openQuickEdit(options = {}) {
    if (qeState) return { ok: true, changed: false, active: true };
    if (typeof document === 'undefined') return { ok: false, reason: 'dom-unavailable' };
    if (fsState) return { ok: false, reason: 'fullscreen-active' };
    if (presetState.currentPresetId !== 'presentation') {
      return { ok: false, reason: 'quick-edit-unavailable' };
    }
    if (isPaneVisible('editor')) return { ok: false, reason: 'editor-visible' };
    // Register the temporary state BEFORE the show so the emit hook skips
    // customized evaluation for the temporary editor visibility.
    qeState = {
      originPresetId: presetState.currentPresetId,
      previousEditorVisible: false,
      keepSurface: null,
      closing: false,
    };
    const shown = showPane('editor', { viaQuickEdit: true });
    if (!shown?.ok) {
      qeState = null;
      return { ok: false, reason: shown?.reason || 'editor-show-failed' };
    }
    document.documentElement.classList.add('mme-quick-edit-active');
    qeApplySurface();
    ensureQuickEditControls();
    try { document.getElementById('mmeQuickEditDone').hidden = false; } catch {}
    syncQuickEditButton();
    refresh();
    emit(null, 'quick-edit');
    return { ok: true, changed: true, active: true };
  }

  function closeQuickEdit(options = {}) {
    if (!qeState) return { ok: true, changed: false, active: false };
    if (qeState.closing) return { ok: true, changed: false, active: true };
    const st = qeState;
    st.closing = true;
    const root = document.documentElement;
    root.classList.remove('mme-quick-edit-active');
    try { delete root.dataset.mmeQuickEditSurface; } catch {}
    try {
      const done = document.getElementById('mmeQuickEditDone');
      if (done) done.hidden = true;
    } catch {}
    // Restore the Presentation baseline editor visibility (hidden). Markmap
    // and HTML stayed logically visible throughout; no owner calls needed for
    // the temporarily suppressed surface — CSS removal restores rendering.
    if (!st.previousEditorVisible) hidePane('editor', { viaQuickEdit: true });
    qeState = null;
    refresh();
    emit(null, 'quick-edit-exit');
    evaluateCustomization();
    syncQuickEditButton();
    return { ok: true, changed: true, active: false, originPresetId: st.originPresetId };
  }

  function isQuickEditOpen() {
    return Boolean(qeState && !qeState.closing);
  }

  function getQuickEditState() {
    if (!qeState) {
      return Object.freeze({
        active: false, originPresetId: null,
        previousEditorVisible: null, keepSurface: null,
      });
    }
    return Object.freeze({
      active: !qeState.closing,
      originPresetId: qeState.originPresetId,
      previousEditorVisible: qeState.previousEditorVisible,
      keepSurface: qeState.keepSurface,
    });
  }

  // ---- S4A: contextual Layout selector (top toolbar; presets only) ----

  function isLayoutMenuOpen() {
    try {
      const menu = document.getElementById('mmeLayoutMenu');
      return Boolean(menu && menu.style.display && menu.style.display !== 'none');
    } catch {
      return false;
    }
  }

  function syncLayoutSelector() {
    try {
      if (typeof document === 'undefined') return;
      const btn = document.getElementById('mmeLayoutBtn');
      if (!btn) return;
      const cur = getCurrentPreset();
      const def = cur ? getPreset(cur.id) : null;
      const label = def ? def.label + (cur.customized ? ' *' : '') : 'Custom';
      btn.textContent = `Layout · ${label}`;
      btn.title = def?.description ? `${def.label} — ${def.description}` : 'Layout preset (Custom)';
      if (isLayoutMenuOpen()) renderLayoutMenu();
    } catch {}
  }

  function renderLayoutMenu() {
    try {
      const menu = document.getElementById('mmeLayoutMenu');
      if (!menu) return;
      menu.textContent = '';
      const cur = getCurrentPreset();
      getAvailablePresets().forEach((p) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'menuItem mme-layout-item';
        item.setAttribute('role', 'menuitem');
        item.dataset.presetId = p.id;
        const isCurrent = cur?.id === p.id;
        item.textContent = p.label + (isCurrent ? (cur.customized ? ' *' : ' ✓') : '');
        if (p.description) item.title = p.description;
        item.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          closeLayoutMenu();
          applyPreset(p.id, { via: 'selector' });
        });
        menu.appendChild(item);
      });
      if (!cur) {
        const custom = document.createElement('div');
        custom.className = 'mme-layout-custom';
        custom.textContent = 'Custom';
        menu.appendChild(custom);
      }
    } catch {}
  }

  function openLayoutMenu() {
    try {
      const menu = document.getElementById('mmeLayoutMenu');
      const btn = document.getElementById('mmeLayoutBtn');
      if (!menu || !btn) return;
      renderLayoutMenu();
      // Position under the button (existing .menu convention: fixed + JS coords).
      const rect = btn.getBoundingClientRect();
      menu.style.top = `${Math.round(rect.bottom + 4)}px`;
      menu.style.left = `${Math.round(rect.left)}px`;
      menu.style.minWidth = '180px';
      menu.style.display = 'flex';
      btn.setAttribute('aria-expanded', 'true');
      const first = menu.querySelector('button');
      if (first) first.focus();
    } catch {}
  }

  function closeLayoutMenu() {
    try {
      const menu = document.getElementById('mmeLayoutMenu');
      const btn = document.getElementById('mmeLayoutBtn');
      if (menu) menu.style.display = 'none';
      if (btn) btn.setAttribute('aria-expanded', 'false');
    } catch {}
  }

  function ensureLayoutSelector() {
    if (selectorBound || typeof document === 'undefined') return;
    try {
      const toolbar = document.getElementById('toolbar');
      const grpContext = document.getElementById('grpContext');
      if (!toolbar || !grpContext) return;
      let group = document.getElementById('grpLayout');
      if (!group) {
        group = document.createElement('div');
        group.className = 'btnGroup';
        group.id = 'grpLayout';
        const btn = document.createElement('button');
        btn.id = 'mmeLayoutBtn';
        btn.type = 'button';
        btn.textContent = 'Layout · Custom';
        btn.setAttribute('aria-haspopup', 'menu');
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', 'mmeLayoutMenu');
        const menu = document.createElement('div');
        menu.id = 'mmeLayoutMenu';
        menu.className = 'menu';
        menu.setAttribute('role', 'menu');
        menu.style.display = 'none';
        menu.addEventListener('keydown', (ev) => {
          // Arrow navigation between preset items.
          if (ev.key !== 'ArrowDown' && ev.key !== 'ArrowUp') return;
          ev.preventDefault();
          const items = [...menu.querySelectorAll('button')];
          const idx = items.indexOf(document.activeElement);
          const next = ev.key === 'ArrowDown'
            ? items[(idx + 1) % items.length]
            : items[(idx - 1 + items.length) % items.length];
          next?.focus();
        });
        group.append(btn, menu);
        grpContext.insertAdjacentElement('afterend', group);
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isLayoutMenuOpen()) closeLayoutMenu();
          else openLayoutMenu();
        });
        // Outside click closes the menu without touching fullscreen state.
        document.addEventListener('pointerdown', (e) => {
          if (!group.contains(e.target) && isLayoutMenuOpen()) closeLayoutMenu();
        });
        // Escape closes only the open Layout menu; the fullscreen Escape path
        // defers to this via fsModalOwnsEscape (menu-open check).
        document.addEventListener('keydown', (ev) => {
          if (ev.key === 'Escape' && isLayoutMenuOpen()) {
            ev.preventDefault();
            closeLayoutMenu();
          }
        });
      }
      selectorBound = true;
      syncLayoutSelector();
    } catch {}
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

    // ---- S4A: presets, transaction, customization (pure/mocked) ----
    const savedCtxId = state.contextId;
    const savedPresetId = presetState.currentPresetId;
    const savedCustomized = presetState.customized;
    const savedSurface = lastPresentationSurface;

    const vctx = '__vl_preset_ctx__';
    const vPaneIds = ['__vl_pe', '__vl_pm', '__vl_ph', '__vl_pfail'];
    vPaneIds.forEach(unregisterPane);
    registerPane({ id: '__vl_pe', contexts: [vctx], usefulContent: true, adapter: makeStub(true) });
    registerPane({ id: '__vl_pm', contexts: [vctx], usefulContent: true, adapter: makeStub(true) });
    registerPane({ id: '__vl_ph', contexts: [vctx], usefulContent: true, adapter: makeStub(false) });
    registerPane({
      id: '__vl_pfail', contexts: [vctx], usefulContent: true,
      adapter: { isAvailable: () => true, isVisible: () => false, show() { return false; }, hide() { return false; } },
    });
    registerPreset({ id: '__vl_work', label: 'Work', contexts: [vctx], visibility: { [vctx]: { __vl_pe: true, __vl_pm: true, __vl_ph: false } } });
    registerPreset({ id: '__vl_pres', label: 'Presentation', contexts: [vctx], quickEditAvailable: true, visibility: { [vctx]: { __vl_pe: false, __vl_pm: true, __vl_ph: true } } });
    registerPreset({ id: '__vl_focus', label: 'Focus', contexts: [vctx], visibility: { [vctx]: { __vl_pe: true, __vl_pm: false, __vl_ph: false } } });
    registerPreset({ id: '__vl_rb', label: 'Rb', contexts: [vctx], visibility: { [vctx]: { __vl_pfail: true, __vl_pe: false, __vl_pm: false, __vl_ph: false } } });

    test('preset register available', getPreset('__vl_work')?.id === '__vl_work');
    registerPreset({ id: '__vl_work', label: 'Work', contexts: [vctx], visibility: { [vctx]: { __vl_pe: true, __vl_pm: true, __vl_ph: false } } });
    test('preset duplicate deterministic', getPreset('__vl_work')?.label === 'Work');
    test('preset requires visibility', registerPreset({ id: '__vl_novis', contexts: [vctx] }).ok === false);
    test('preset unknown rejected', applyPreset('__vl_missing').ok === false);
    test('preset unavailable context rejected', applyPreset('__vl_work').ok === false);
    test('availability by context', getAvailablePresets(vctx).some((p) => p.id === '__vl_work') && !getAvailablePresets(savedCtxId || 'editor').some((p) => p.id === '__vl_work'));
    test('registration does not auto-apply', getCurrentPreset() === null);

    setContext(vctx, { allowEmpty: true });
    let evCount = 0;
    const offEv = subscribe(() => { evCount++; });
    const rWork = applyPreset('__vl_work');
    test('work composition applies', rWork.ok === true && isPaneVisible('__vl_pe') && isPaneVisible('__vl_pm') && !isPaneVisible('__vl_ph'));
    test('one preset event per application', evCount === 1);
    test('current preset recorded', getCurrentPreset()?.id === '__vl_work' && getCurrentPreset()?.customized === false);
    offEv();

    hidePane('__vl_pm');
    test('customized after local change', getCurrentPreset()?.customized === true);
    test('local change not auto-undone', !isPaneVisible('__vl_pm'));
    const rRe = applyPreset('__vl_work');
    test('exact reapply restores and clears customized', rRe.ok === true && isPaneVisible('__vl_pm') && getCurrentPreset()?.customized === false);

    const rFocus = applyPreset('__vl_focus');
    test('focus composition applies', rFocus.ok === true && isPaneVisible('__vl_pe') && !isPaneVisible('__vl_pm') && !isPaneVisible('__vl_ph'));
    const rPres = applyPreset('__vl_pres');
    test('transaction bypasses last-pane guard', rPres.ok === true && !isPaneVisible('__vl_pe') && isPaneVisible('__vl_pm') && isPaneVisible('__vl_ph'));
    test('final useful pane guaranteed', isPaneVisible('__vl_pm') || isPaneVisible('__vl_ph'));

    const rRb = applyPreset('__vl_rb');
    test('failed preset returns structured failure', rRb.ok === false && rRb.reason === 'pane-show-rejected');
    test('failed preset keeps previous preset', getCurrentPreset()?.id === '__vl_pres');
    test('rollback restores previous composition', isPaneVisible('__vl_pm') && isPaneVisible('__vl_ph') && !isPaneVisible('__vl_pe'));

    setContext('editor', { allowEmpty: true });
    test('context change clears unavailable preset to Custom', getCurrentPreset() === null);
    setContext(vctx, { allowEmpty: true });

    // ---- S4A: Quick Edit + fullscreen interaction (DOM-dependent) ----
    if (typeof document !== 'undefined') {
      // Quick Edit is unavailable outside Presentation (current: Custom).
      const q0 = openQuickEdit({});
      test('quick edit unavailable outside presentation', q0.ok === false && q0.reason === 'quick-edit-unavailable');

      // Persistence spy: only keys that look like layout preferences count.
      let storageWrites = 0;
      let spied = false;
      let origSet = null;
      try {
        origSet = window.localStorage.setItem.bind(window.localStorage);
        window.localStorage.setItem = function (k, v) {
          if (/preset|quickedit|layout/i.test(String(k))) storageWrites++;
          return origSet(k, v);
        };
        spied = true;
      } catch {}

      applyPreset('__vl_pres');
      const q1 = openQuickEdit({});
      const q2 = openQuickEdit({});
      const qStateMid = getQuickEditState();
      const q1c = closeQuickEdit({});
      const q4 = closeQuickEdit({});
      if (spied) {
        window.localStorage.setItem = origSet;
        test('no preset or quick-edit persistence', storageWrites === 0);
      }
      test('quick edit opens in presentation', q1.ok === true && q1.changed === true && isPaneVisible('__vl_pe') && isQuickEditOpen() === true);
      test('repeated quick edit open no-change', q2.ok === true && q2.changed === false);
      test('quick edit state shape', qStateMid.active === true && qStateMid.originPresetId === '__vl_pres' && qStateMid.previousEditorVisible === false);
      test('qe temporary editor visibility does not customize', getCurrentPreset()?.customized === false);
      test('qe keeps presentation surfaces logically visible', isPaneVisible('__vl_pm') && isPaneVisible('__vl_ph'));
      test('quick edit closes and restores editor', q1c.ok === true && q1c.changed === true && !isPaneVisible('__vl_pe') && !isQuickEditOpen());
      test('repeated quick edit close no-change', q4.ok === true && q4.changed === false);
      test('qe close restores presentation baseline', isPaneVisible('__vl_pm') && isPaneVisible('__vl_ph') && getCurrentPreset()?.customized === false);

      // Fullscreen interaction with presets (S3 APIs preserved).
      const rFsEnter = enterFullscreen('__vl_pm');
      test('s3 mock fullscreen entered', rFsEnter.ok === true && isFullscreen() === true);
      const rFsPreset = applyPreset('__vl_work');
      test('preset exits fullscreen first', rFsPreset.ok === true && isFullscreen() === false);
      const rFs1 = enterFullscreen('__vl_pe');
      const rFs2 = exitFullscreen({ via: 'validator' });
      test('s3 fullscreen enter/exit round trip preserved', rFs1.ok === true && rFs2.ok === true && isFullscreen() === false);
    }

    // ---- S4A FOCUS: derived viewer-empty logical rule (headless-capable) ----
    const origMk = getPane('markmap');
    const origHt = getPane('html');
    let mMk = false, mHt = false;
    if (getPane('markmap')) unregisterPane('markmap');
    if (getPane('html')) unregisterPane('html');
    registerPane({ id: 'markmap', adapter: { isAvailable: () => true, isVisible: () => mMk, show() { mMk = true; return true; }, hide() { mMk = false; return true; } } });
    registerPane({ id: 'html', adapter: { isAvailable: () => true, isVisible: () => mHt, show() { mHt = true; return true; }, hide() { mHt = false; return true; } } });

    test('viewer empty when both hidden', isViewerEmpty() === true);
    showPane('markmap');
    test('viewer not empty when markmap visible', isViewerEmpty() === false);
    hidePane('markmap');
    test('viewer empty again after markmap re-hidden', isViewerEmpty() === true);
    showPane('html');
    test('viewer not empty when html visible', isViewerEmpty() === false);
    showPane('markmap');
    hidePane('html');
    test('viewer not empty when only markmap visible', isViewerEmpty() === false);
    hidePane('markmap');
    test('viewer empty when only editor remains', isViewerEmpty() === true);
    showPane('html');
    showPane('markmap');
    test('restoring both clears viewer-empty', isViewerEmpty() === false);
    // Fullscreen/QE temporary states must not flip the persistent derived rule.
    const vf0 = isViewerEmpty();
    if (typeof document !== 'undefined') {
      enterFullscreen('markmap');
      test('fullscreen preserved for viewer target', isFullscreen() === true);
      exitFullscreen({ via: 'validator' });
    }
    test('fullscreen round trip leaves derived state unchanged', isViewerEmpty() === vf0);

    unregisterPane('markmap');
    unregisterPane('html');
    if (origMk) registerPane(origMk);
    if (origHt) registerPane(origHt);

    // ---- S4A cleanup: restore real registry state ----
    vPaneIds.forEach(unregisterPane);
    ['__vl_work', '__vl_pres', '__vl_focus', '__vl_rb', '__vl_novis'].forEach((id) => unregisterPreset(id));
    setContext(savedCtxId || 'editor', { allowEmpty: true });
    presetState.currentPresetId = savedPresetId;
    presetState.customized = savedCustomized;
    lastPresentationSurface = savedSurface;
    syncLayoutSelector();
    syncQuickEditButton();

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
    // S4A: presets, Layout selector state, and Quick Edit.
    registerPreset, unregisterPreset, getPreset, getAvailablePresets,
    applyPreset, getCurrentPreset, clearCurrentPreset,
    openQuickEdit, closeQuickEdit, isQuickEditOpen, getQuickEditState,
    restoreAll: notIntegrated('restoreAll'),
  });

  globalThis.MME_VIEW_LAYOUT = api;
  if (typeof window !== 'undefined') window.MME_VIEW_LAYOUT = api;
})();
