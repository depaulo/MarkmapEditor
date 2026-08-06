// @ts-nocheck
// Mode Runtime Sessions — memory-only registry for non-cloneable live resources.
//
// This registry holds FileSystemHandle references, hot reload state, and external
// stale tracking that MUST NOT enter:
//   - Host getState snapshots
//   - localStorage
//   - structuredClone
//   - JSON serialization
//
// Journal special rule:
//   When WORKSPACE_STATE.activeFile exists, the physical Journal workspace file
//   remains authoritative. We do not copy its handle into a competing generic
//   registry. The journal mode entry may hold a reference for restore purposes,
//   but WORKSPACE_STATE.activeFile is the source of truth for Journal.
//
// Editor and Slides standalone handles may remain here exclusively.

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

  const MODE_IDS = ['editor', 'journal', 'slides'];

  const RUNTIME_SESSIONS = {
    editor: {
      saveHandle: null,
      fileLastSeenModified: 0,
      externalStale: false,
      externalStaleModified: 0,
      hotReloadEnabled: false,
    },
    journal: {
      saveHandle: null,
      fileLastSeenModified: 0,
      externalStale: false,
      externalStaleModified: 0,
      hotReloadEnabled: false,
    },
    slides: {
      saveHandle: null,
      fileLastSeenModified: 0,
      externalStale: false,
      externalStaleModified: 0,
      hotReloadEnabled: false,
    },
  };

  function normalizeMode(mode) {
    const value = String(mode || '').toLowerCase();
    return MODE_IDS.includes(value) ? value : 'editor';
  }

  function getRuntime(mode) {
    const m = normalizeMode(mode);
    return RUNTIME_SESSIONS[m] || null;
  }

  function captureCurrentRuntime(mode) {
    const m = normalizeMode(mode);
    const entry = RUNTIME_SESSIONS[m];
    if (!entry) return null;

    // Capture from main.js lexical state via MME_APP bridge if available.
    const bridge = globalThis.MME_APP;
    if (bridge && typeof bridge.getCurrentDocumentRuntimeState === 'function') {
      try {
        const state = bridge.getCurrentDocumentRuntimeState();
        if (state) {
          entry.saveHandle = state.saveHandle ?? null;
          entry.fileLastSeenModified = state.fileLastSeenModified ?? 0;
          entry.externalStale = Boolean(state.externalStale);
          entry.externalStaleModified = state.externalStaleModified ?? 0;
          entry.hotReloadEnabled = Boolean(state.hotReloadEnabled);
        }
      } catch (e) {
        safeLog(`ModeRuntime: capture failed for ${m}: ${e?.message || e}`);
      }
    }

    safeLog(
      `ModeRuntime: captured mode=${m} hasHandle=${Boolean(entry.saveHandle)} stale=${entry.externalStale}`
    );

    return { ...entry };
  }

  function restoreRuntime(mode) {
    const m = normalizeMode(mode);
    const entry = RUNTIME_SESSIONS[m];
    if (!entry) return false;

    const bridge = globalThis.MME_APP;
    if (bridge && typeof bridge.applyCurrentDocumentRuntimeState === 'function') {
      try {
        bridge.applyCurrentDocumentRuntimeState({
          saveHandle: entry.saveHandle,
          fileLastSeenModified: entry.fileLastSeenModified,
          externalStale: entry.externalStale,
          externalStaleModified: entry.externalStaleModified,
          hotReloadEnabled: entry.hotReloadEnabled,
        });

        safeLog(
          `ModeRuntime: restored mode=${m} hasHandle=${Boolean(entry.saveHandle)} stale=${entry.externalStale}`
        );

        return true;
      } catch (e) {
        safeLog(`ModeRuntime: restore failed for ${m}: ${e?.message || e}`);
      }
    }

    return false;
  }

  function clearRuntime(mode) {
    const m = normalizeMode(mode);
    const entry = RUNTIME_SESSIONS[m];
    if (!entry) return;

    entry.saveHandle = null;
    entry.fileLastSeenModified = 0;
    entry.externalStale = false;
    entry.externalStaleModified = 0;
    entry.hotReloadEnabled = false;

    safeLog(`ModeRuntime: cleared mode=${m}`);
  }

  const MME_MODE_RUNTIME_SESSIONS = {
    MODE_IDS,
    RUNTIME_SESSIONS,
    normalizeMode,
    getRuntime,
    captureCurrentRuntime,
    restoreRuntime,
    clearRuntime,
  };

  // Freeze the public API object to prevent accidental mutation.
  Object.freeze(MME_MODE_RUNTIME_SESSIONS);

  try {
    window.MME_MODE_RUNTIME_SESSIONS = MME_MODE_RUNTIME_SESSIONS;
    globalThis.MME_MODE_RUNTIME_SESSIONS = MME_MODE_RUNTIME_SESSIONS;
  } catch {}

  safeLog('ModeRuntime: registry ready');
})();
