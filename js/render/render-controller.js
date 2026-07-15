// @ts-nocheck
// R-SPLIT4 + R-RENDER1 — Render Controller
// Centralizes render orchestration for the app.
// Extracted from js/main.js to avoid duplicate timers and scattered render calls.

(function () {
  'use strict';

  // ---- Internal state ----
  let renderTimer = null;
  let renderInProgress = false;
  let lastRenderReason = '';

  const RENDER_DEBOUNCE_MS = 1000;

  // ---- Safe logger ----
  function safeLog(message) {
    try {
      if (typeof globalThis.log === 'function') {
        globalThis.log(message);
      }
    } catch {}
  }

  // ---- Public API ----

  function cancelPendingRender() {
    if (renderTimer) {
      clearTimeout(renderTimer);
      renderTimer = null;
      safeLog('RenderController: cancelled pending render');
    }
  }

  function renderNow(reason) {
    const r = String(reason || 'renderNow').trim();

    cancelPendingRender();

    if (renderInProgress) {
      safeLog(`RenderController: render already in progress, skipping reason=${r}`);
      return;
    }

    renderInProgress = true;
    lastRenderReason = r;

    safeLog(`RenderController: begin reason=${r}`);

    try {
      if (typeof globalThis.render === 'function') {
        globalThis.render(r);
      } else if (typeof window.render === 'function') {
        window.render(r);
      } else {
        safeLog(`RenderController: render() not available for reason=${r}`);
      }
    } catch (e) {
      safeLog(`RenderController: error reason=${r} err=${e?.message || e}`);
    } finally {
      renderInProgress = false;
      safeLog(`RenderController: end reason=${r}`);
    }
  }

  function scheduleRender(reason) {
    const r = String(reason || 'scheduleRender').trim();

    cancelPendingRender();

    safeLog(`RenderController: schedule reason=${r} delay=${RENDER_DEBOUNCE_MS}ms`);

    renderTimer = setTimeout(() => {
      renderTimer = null;
      renderNow(r);
    }, RENDER_DEBOUNCE_MS);
  }

  // ---- Exports ----

  const MME_RENDER = {
    scheduleRender,
    renderNow,
    cancelPendingRender,
  };

  try {
    window.MME_RENDER = MME_RENDER;
    globalThis.MME_RENDER = MME_RENDER;
  } catch {}

  safeLog('RenderController: initialized');
})();
