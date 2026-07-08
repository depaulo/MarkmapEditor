// @ts-nocheck
// R-SPLIT3 — Editor Visibility Controls
// Centralized editor hide/show logic shared by:
//   - top toolbar editor toggle (#btnToggleEditor)
//   - editor hide handle (#editorBtnHide)
//   - editor edge open handle (#btnEditorEdgeOpen)
// This module owns the editor-hidden state, width save/restore, and control wiring.

(function () {
  'use strict';

  let editorWasVisible = true;
  let lastEditorWidth = null;

  function getEditorEl() {
    return document.getElementById('editor');
  }

  function getSplitEditorEl() {
    return document.getElementById('splitEditor');
  }

  function getToolbarBtn() {
    return document.getElementById('btnToggleEditor');
  }

  function getHideBtn() {
    return document.getElementById('editorBtnHide');
  }

  function getEdgeOpenBtn() {
    return document.getElementById('btnEditorEdgeOpen');
  }

  function isEditorHidden() {
    return document.body.classList.contains('editor-hidden');
  }

  function setShowHideLabelSafe(btnId, isVisible, name) {
    try {
      if (typeof globalThis.setShowHideLabel === 'function') {
        globalThis.setShowHideLabel(btnId, isVisible, name);
        return;
      }
    } catch {}
    const btn = document.getElementById(btnId);
    if (btn) btn.textContent = `${isVisible ? 'Hide' : 'Show'} ${name}`;
  }

  function syncToolbarHeightSafe() {
    try {
      if (typeof globalThis.syncToolbarHeight === 'function') {
        globalThis.syncToolbarHeight();
      }
    } catch {}
  }

  function logSafe(msg) {
    try {
      if (typeof globalThis.log === 'function') {
        globalThis.log(msg);
        return;
      }
    } catch {}
    try {
      console.log(msg);
    } catch {}
  }

  function hideEditor() {
    try {
      const editorEl = getEditorEl();
      const splitEditorEl = getSplitEditorEl();
      if (!editorEl) return;

      editorWasVisible = false;
      lastEditorWidth = editorEl.style.width || editorEl.getBoundingClientRect().width + 'px';

      editorEl.style.display = 'none';
      if (splitEditorEl) splitEditorEl.style.display = 'none';

      document.body.classList.add('editor-hidden');

      logSafe(`Editor HIDE (saved width=${lastEditorWidth})`);
      setShowHideLabelSafe('btnToggleEditor', false, 'Editor');
      syncToolbarHeightSafe();
      updateEditorVisibilityControls();
    } catch (e) {
      logSafe(`❌ hideEditor() failed: ${e?.message || e}`);
    }
  }

  function showEditor() {
    try {
      const editorEl = getEditorEl();
      const splitEditorEl = getSplitEditorEl();
      if (!editorEl) return;

      editorWasVisible = true;

      editorEl.style.display = 'block';
      if (splitEditorEl) splitEditorEl.style.display = 'block';

      document.body.classList.remove('editor-hidden');

      if (lastEditorWidth) editorEl.style.width = lastEditorWidth;

      logSafe(`Editor SHOW (restored width=${lastEditorWidth || '(default)'})`);
      setShowHideLabelSafe('btnToggleEditor', true, 'Editor');
      syncToolbarHeightSafe();
      updateEditorVisibilityControls();
    } catch (e) {
      logSafe(`❌ showEditor() failed: ${e?.message || e}`);
    }
  }

  function toggleEditor() {
    try {
      if (isEditorHidden()) {
        showEditor();
      } else {
        hideEditor();
      }
    } catch (e) {
      logSafe(`❌ toggleEditor() failed: ${e?.message || e}`);
    }
  }

  function updateEditorVisibilityControls() {
    const hidden = isEditorHidden();
    const hideBtn = getHideBtn();
    const edgeBtn = getEdgeOpenBtn();

    if (hideBtn) {
      hideBtn.style.display = hidden ? 'none' : '';
      hideBtn.textContent = '‹';
    }

    if (edgeBtn) {
      edgeBtn.style.display = hidden ? '' : 'none';
      edgeBtn.hidden = !hidden;
      edgeBtn.textContent = '›';
    }
  }

  function wireEditorVisibilityControls() {
    const toolbarBtn = getToolbarBtn();
    const hideBtn = getHideBtn();
    const edgeBtn = getEdgeOpenBtn();

    if (toolbarBtn && !toolbarBtn.__editorVisibilityBound) {
      toolbarBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleEditor();
      });
      toolbarBtn.__editorVisibilityBound = true;
    }

    if (hideBtn && !hideBtn.__editorVisibilityBound) {
      hideBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        logSafe('Editor overlay hide clicked');
        toggleEditor();
      });
      hideBtn.__editorVisibilityBound = true;
    }

    if (edgeBtn && !edgeBtn.__editorVisibilityBound) {
      edgeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        logSafe('Editor edge open clicked');
        toggleEditor();
      });
      edgeBtn.__editorVisibilityBound = true;
    }

    // Defer initial sync so layout/DOM is settled.
    setTimeout(updateEditorVisibilityControls, 0);

    logSafe('Editor visibility controls wired (R-SPLIT3)');
  }

  const api = {
    hideEditor,
    showEditor,
    toggleEditor,
    isEditorHidden,
    wireEditorVisibilityControls,
    updateEditorVisibilityControls,
  };

  window.MME_EDITOR_VISIBILITY = api;

  globalThis.MME_EDITOR_VISIBILITY = api;
  globalThis.hideEditor = hideEditor;
  globalThis.showEditor = showEditor;
  globalThis.toggleEditor = toggleEditor;
  globalThis.isEditorHidden = isEditorHidden;
  globalThis.updateEditorVisibilityControls = updateEditorVisibilityControls;
  globalThis.wireEditorVisibilityControls = wireEditorVisibilityControls;

  // Auto-wire when DOM is ready (script may load before/after main.js).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireEditorVisibilityControls);
  } else {
    wireEditorVisibilityControls();
  }
})();
