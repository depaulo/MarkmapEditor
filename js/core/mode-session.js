// @ts-nocheck
// R-SPLIT1 — Mode Session Manager.
// Also hosts R-MULTI3 separate-mode helpers.
// Extracted from main.js to centralize mode/session logic.
//
// Helpers that are NOT defined here (window.__cmSetText, globalThis.MME_APP,
// globalThis.cm, document.getElementById('md')) are provided by main.js and are
// resolved at call time.

(function () {
  'use strict';

  const APP_MODE_IDS = ['editor', 'journal', 'slides'];

  const APP_MODE_SESSIONS = globalThis.APP_MODE_SESSIONS || {
    editor: {},
    journal: {},
    slides: {},
  };

  globalThis.APP_MODE_SESSIONS = APP_MODE_SESSIONS;

  function normalizeAppModeId(mode) {
    const value = String(mode || '').toLowerCase();
    return APP_MODE_IDS.includes(value) ? value : 'editor';
  }

  function getCurrentModeIdSafe() {
    return normalizeAppModeId(
      globalThis.currentAppContextId ||
        document.documentElement?.dataset?.appContext ||
        'editor'
    );
  }

  function getCurrentEditorTextSafe() {
    try {
      if (globalThis.MME_APP?.getText) return globalThis.MME_APP.getText();
    } catch {}

    try {
      if (globalThis.cm?.getValue) return globalThis.cm.getValue();
    } catch {}

    try {
      const textarea = document.getElementById('md');
      if (textarea) return textarea.value || '';
    } catch {}

    return '';
  }

  function setCurrentEditorTextSafe(text) {
    try {
      if (globalThis.MME_APP?.setText) {
        globalThis.MME_APP.setText(String(text || ''));
        return true;
      }
    } catch {}

    try {
      if (globalThis.__cmSetText) {
        globalThis.__cmSetText(String(text || ''));
        return true;
      }
    } catch {}

    try {
      if (globalThis.cm?.setValue) {
        globalThis.cm.setValue(String(text || ''));
        return true;
      }
    } catch {}

    try {
      const textarea = document.getElementById('md');
      if (textarea) {
        textarea.value = String(text || '');
        return true;
      }
    } catch {}

    return false;
  }

  function captureCurrentModeSession(reason = 'capture') {
    const mode = getCurrentModeIdSafe();
    const session = APP_MODE_SESSIONS[mode] || {};

    session.mode = mode;
    session.text = getCurrentEditorTextSafe();
    session.fileName =
      globalThis.currentFileName ||
      globalThis.MME_APP?.currentFileName ||
      '';

    session.dirty =
      Boolean(globalThis.isDirty) ||
      Boolean(globalThis.MME_APP?.isDirty?.());

    session.htmlOpen =
      document.body.classList.contains('html-open') ||
      document.documentElement.classList.contains('html-open') ||
      Boolean(document.getElementById('htmlPane')?.classList.contains('open'));

    session.editorHidden =
      document.body.classList.contains('editor-hidden') ||
      document.documentElement.classList.contains('editor-hidden');

    session.timestamp = Date.now();

    APP_MODE_SESSIONS[mode] = session;

    globalThis.log?.(
      `ModeSession: captured mode=${mode} reason=${reason} file=${session.fileName || '(none)'} dirty=${session.dirty}`
    );

    return session;
  }

  function restoreModeSession(modeInput, reason = 'restore') {
    const mode = normalizeAppModeId(modeInput);
    const session = APP_MODE_SESSIONS[mode];

    if (!session || typeof session.text !== 'string') {
      globalThis.log?.(`ModeSession: no session to restore mode=${mode} reason=${reason}`);
      return false;
    }

    // Conservative Journal restore protection:
    // Do not restore stale text over an active workspace file.
    if (mode === 'journal' && globalThis.WORKSPACE_STATE?.activeFile) {
      globalThis.log?.('ModeSession: journal restore skipped because workspace activeFile exists');
      return false;
    }

    setCurrentEditorTextSafe(session.text);

    globalThis.log?.(
      `ModeSession: restored mode=${mode} reason=${reason} file=${session.fileName || '(none)'}`
    );

    return true;
  }

  function getModeStoragePrefix(modeInput) {
    const mode = normalizeAppModeId(modeInput);
    return `mme:${mode}:`;
  }

  function getModeStorageKey(modeInput, key) {
    return `${getModeStoragePrefix(modeInput)}${key}`;
  }

  // ---- R-MULTI3 — separate current mode helpers ----

  function getUrlSessionParam() {
    try {
      const url = new URL(window.location.href);
      const value = String(url.searchParams.get('session') || '').trim();
      return value || '';
    } catch {}

    return '';
  }

  function buildSeparateModeUrl(modeInput) {
    const mode = normalizeAppModeId(modeInput);

    const url = new URL(window.location.href);
    url.searchParams.set('mode', mode);

    // Future R-MULTI4 will use session-aware storage.
    // For now, add a stable session name to the URL.
    url.searchParams.set('session', `${mode}-main`);

    return url.toString();
  }

  function separateCurrentMode() {
    const mode = getCurrentModeIdSafe();

    try {
      captureCurrentModeSession('separate mode');
    } catch {}

    const url = buildSeparateModeUrl(mode);

    globalThis.log?.(`ModeWindow: opening mode=${mode} url=${url}`);

    const win = window.open(url, '_blank', 'noopener,noreferrer');

    if (!win) {
      globalThis.MME_APP?.showToast?.(
        'Popup blocked. Allow popups to open this mode in a new window.',
        'error',
        5000
      );
      globalThis.log?.('ModeWindow: window.open blocked');
      return false;
    }

    globalThis.MME_APP?.showToast?.(`Opened ${mode} in a new window`, 'ok', 2200);
    return true;
  }

  function wireSeparateModeButton() {
    const btn = document.getElementById('btnSeparateMode');
    if (!btn || btn.__separateModeBound) return;

    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      separateCurrentMode();
    });

    btn.__separateModeBound = true;
    globalThis.log?.('ModeWindow: Separate Mode button wired');
  }

  // Expose module API.
  const MME_MODE_SESSION = {
    APP_MODE_IDS,
    APP_MODE_SESSIONS,
    normalizeAppModeId,
    getCurrentModeIdSafe,
    captureCurrentModeSession,
    restoreModeSession,
    getModeStoragePrefix,
    getModeStorageKey,
    getUrlSessionParam,
    buildSeparateModeUrl,
    separateCurrentMode,
    wireSeparateModeButton,
  };

  try {
    window.MME_MODE_SESSION = MME_MODE_SESSION;
    globalThis.MME_MODE_SESSION = MME_MODE_SESSION;
  } catch {}

  // Compatibility globals for existing main.js callers.
  try {
    globalThis.APP_MODE_SESSIONS = APP_MODE_SESSIONS;
    globalThis.normalizeAppModeId = normalizeAppModeId;
    globalThis.getCurrentModeIdSafe = getCurrentModeIdSafe;
    globalThis.captureCurrentModeSession = captureCurrentModeSession;
    globalThis.restoreModeSession = restoreModeSession;
    globalThis.getModeStoragePrefix = getModeStoragePrefix;
    globalThis.getModeStorageKey = getModeStorageKey;
    globalThis.getUrlSessionParam = getUrlSessionParam;
    globalThis.buildSeparateModeUrl = buildSeparateModeUrl;
    globalThis.separateCurrentMode = separateCurrentMode;
    globalThis.wireSeparateModeButton = wireSeparateModeButton;
  } catch {}

  // Boot: log session param if present (R-MULTI3 PART C).
  try {
    const sessionParam = getUrlSessionParam();
    if (sessionParam) {
      globalThis.log?.(`ModeWindow: session=${sessionParam}`);
    }
  } catch {}

  // Wire the separate-mode button during normal UI boot.
  function __wireSeparateModeOnReady() {
    try {
      wireSeparateModeButton();
    } catch (e) {
      globalThis.log?.(`ModeWindow: wire failed: ${e?.message || e}`);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', __wireSeparateModeOnReady);
  } else {
    __wireSeparateModeOnReady();
  }
})();
