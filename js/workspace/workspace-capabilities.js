// @ts-nocheck
// Workspace Capabilities — explicit capability policy outside Workspace Host core.
//
// This module provides a small, frozen capability map per workspace.
// It does NOT register EditorWorkspace or SlidesWorkspace.
// It does NOT modify workspace-host.js.
//
// Future declarations for editor/slides are included but must not become
// active workspaces until their adapters are implemented.

(function () {
  'use strict';

  function safeLog(message) {
    try {
      if (typeof globalThis.log === 'function') {
        globalThis.log(message);
        return;
      }

      if (typeof console !== 'undefined' && typeof console.info === 'function') {
        console.info(message);
      }
    } catch {}
  }

  // Capability records are frozen to prevent accidental mutation.
  const JOURNAL_CAPABILITIES = Object.freeze({
    edit: true,
    open: true,
    save: true,
    saveAs: true,
    draft: true,
    htmlPreview: true,
    markmap: true,
    archive: true,
    workspaceFiles: true,
    exportSlides: false,
  });

  const WORKSPACE_INDEX_CAPABILITIES = Object.freeze({
    edit: false,
    open: false,
    save: false,
    saveAs: false,
    draft: false,
    htmlPreview: false,
    markmap: false,
    archive: false,
    workspaceFiles: false,
    exportSlides: false,
    navigation: true,
    refresh: true,
  });

  // Future declarations — not yet active workspaces.
  const EDITOR_CAPABILITIES = Object.freeze({
    edit: true,
    open: true,
    save: true,
    saveAs: true,
    draft: true,
    htmlPreview: true,
    markmap: true,
    archive: false,
    workspaceFiles: false,
    exportSlides: false,
  });

  const SLIDES_CAPABILITIES = Object.freeze({
    edit: true,
    open: true,
    save: true,
    saveAs: true,
    draft: true,
    htmlPreview: true,
    markmap: true,
    archive: false,
    workspaceFiles: false,
    exportSlides: true,
  });

  const REGISTRY = Object.freeze({
    journal: JOURNAL_CAPABILITIES,
    'workspace-index': WORKSPACE_INDEX_CAPABILITIES,
    editor: EDITOR_CAPABILITIES,
    slides: SLIDES_CAPABILITIES,
  });

  function get(workspaceId) {
    const id = String(workspaceId || '').trim();
    return REGISTRY[id] || null;
  }

  function can(workspaceId, command) {
    const caps = get(workspaceId);
    if (!caps) return false;
    return Boolean(caps[command]);
  }

  function canActive(command) {
    const host = globalThis.MME_WORKSPACE_HOST;
    if (!host || typeof host.getActiveId !== 'function') return false;
    return can(host.getActiveId(), command);
  }

  function getActiveId() {
    const host = globalThis.MME_WORKSPACE_HOST;
    if (!host || typeof host.getActiveId !== 'function') return '';
    return String(host.getActiveId() || '');
  }

  const MME_WORKSPACE_CAPABILITIES = Object.freeze({
    REGISTRY,
    get,
    can,
    canActive,
    getActiveId,
  });

  try {
    window.MME_WORKSPACE_CAPABILITIES = MME_WORKSPACE_CAPABILITIES;
    globalThis.MME_WORKSPACE_CAPABILITIES = MME_WORKSPACE_CAPABILITIES;
  } catch {}

  safeLog('WorkspaceCapabilities: ready');
})();
