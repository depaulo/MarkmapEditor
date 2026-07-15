// @ts-nocheck
// R-META3 — Frontmatter Visibility
// Visual-only hide/collapse of frontmatter in CodeMirror.
// Preserves complete Markdown source in the editor.
// ================================

(function () {
  'use strict';

  // ---- Private state ----

  let currentRange = null;
  let currentDecoration = null;
  let isHidden = false;
  let wired = false;

  // ---- Private helpers ----

  function safeLog(msg) {
    if (typeof globalThis.log === 'function') {
      globalThis.log(msg);
    }
  }

  function getEditorView() {
    if (typeof globalThis.cm === 'object' && globalThis.cm !== null) {
      return globalThis.cm;
    }
    if (typeof globalThis.MME_APP === 'object' && globalThis.MME_APP !== null) {
      const view = globalThis.MME_APP.cm;
      if (view && typeof view === 'object') {
        return view;
      }
    }
    return null;
  }

  function getDocument() {
    const view = getEditorView();
    if (view && typeof view.state === 'object' && view.state.doc) {
      return view.state.doc;
    }
    return null;
  }

  function detectFrontmatterRange(doc) {
    if (!doc || typeof doc.toString !== 'function') {
      return null;
    }

    const text = doc.toString();

    if (!text.startsWith('---')) {
      return null;
    }

    const endIndex = text.indexOf('---', 3);
    if (endIndex === -1) {
      return null;
    }

    const from = 0;
    const to = endIndex + 3;

    if (to <= from) {
      return null;
    }

    return { from, to };
  }

  function getPlaceholderWidget() {
    const el = document.createElement('div');
    el.className = 'frontmatterPlaceholder';
    el.textContent = 'Metadata';
    el.style.cssText = 'color: var(--text); opacity: 0.5; font-style: italic;';
    return el;
  }

  function applyDecoration(range) {
    const view = getEditorView();
    if (!view || !range) {
      return false;
    }

    try {
      if (currentDecoration) {
        view.dispatch({
          decorations: currentDecoration.update([]),
        });
        currentDecoration = null;
      }

      const state = view.state;
      const widget = getPlaceholderWidget();

      currentDecoration = state.field(Decoration, {});
      const newDecoration = Decoration.replace({
        widget,
        inclusive: false,
      }).range(range.from, range.to);

      view.dispatch({
        decorations: currentDecoration.update([newDecoration]),
      });

      currentDecoration = currentDecoration.update([newDecoration]);
      return true;
    } catch (e) {
      safeLog('FrontmatterVisibility: apply decoration failed: ' + (e?.message || e));
      return false;
    }
  }

  function removeDecoration() {
    const view = getEditorView();
    if (!view) {
      return;
    }

    try {
      if (currentDecoration) {
        view.dispatch({
          decorations: currentDecoration.update([]),
        });
      }
      currentDecoration = null;
    } catch (e) {
      safeLog('FrontmatterVisibility: remove decoration failed: ' + (e?.message || e));
    }
  }

  // ---- Public API ----

  function hide() {
    const doc = getDocument();
    if (!doc) {
      return false;
    }

    const range = detectFrontmatterRange(doc);
    if (!range) {
      safeLog('FrontmatterVisibility: no valid frontmatter to hide');
      return false;
    }

    currentRange = range;
    isHidden = true;

    const applied = applyDecoration(range);
    if (applied) {
      safeLog('FrontmatterVisibility: hidden');
    }
    return applied;
  }

  function show() {
    if (!isHidden) {
      return true;
    }

    removeDecoration();
    currentRange = null;
    isHidden = false;

    safeLog('FrontmatterVisibility: visible');
    return true;
  }

  function toggle() {
    if (isHidden) {
      return show();
    }
    return hide();
  }

  function isHiddenState() {
    return isHidden;
  }

  function refresh() {
    if (!isHidden) {
      return;
    }

    const doc = getDocument();
    if (!doc) {
      return;
    }

    const range = detectFrontmatterRange(doc);
    if (!range) {
      show();
      return;
    }

    currentRange = range;
    applyDecoration(range);
  }

  function wire() {
    if (wired) {
      return;
    }

    const view = getEditorView();
    if (!view) {
      safeLog('FrontmatterVisibility: wire skipped, editor not ready');
      return;
    }

    try {
      view.dom.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isHidden) {
          show();
        }
      });

      wired = true;
      safeLog('FrontmatterVisibility: wired');
    } catch (e) {
      safeLog('FrontmatterVisibility: wire failed: ' + (e?.message || e));
    }
  }

  // ---- Expose module API ----

  const MME_FRONTMATTER_VISIBILITY = {
    show,
    hide,
    toggle,
    isHidden: isHiddenState,
    refresh,
    wire,
  };

  try {
    window.MME_FRONTMATTER_VISIBILITY = MME_FRONTMATTER_VISIBILITY;
    globalThis.MME_FRONTMATTER_VISIBILITY = MME_FRONTMATTER_VISIBILITY;
  } catch {}

  // ---- Boot ----

  safeLog('FrontmatterVisibility: module loaded');
})();
