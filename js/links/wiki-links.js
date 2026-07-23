// @ts-nocheck
// R-LINK1 — Wiki Links
// Parser, resolver, and click/open infrastructure for [[WikiLinks]].
// Reuses existing workspace index and file-opening paths.
// ================================

(function () {
  'use strict';

  // ---- Private state ----
  // Element-identity tracking (not stale Booleans)
  let wiredHtmlPane = null;
  let wiredOpenButton = null;
  let wiredCursorHost = null;

  // ---- Private constants ----
  const WIKI_RE = /\[\[([^\[\]\n]+?)\]\]/g;

  // ---- Private helpers ----

  function safeLog(msg) {
    if (typeof globalThis.log === 'function') {
      globalThis.log(msg);
    }
  }

  function getWorkspaceIndex() {
    return (
      globalThis.WORKSPACE_INDEX_STATE ||
      window.WORKSPACE_INDEX_STATE ||
      null
    );
  }

  function getWorkspaceState() {
    return (
      globalThis.WORKSPACE_STATE ||
      window.WORKSPACE_STATE ||
      null
    );
  }

  function isCmdOrCtrlClick(event) {
    if (!event) return false;
    return event.ctrlKey || event.metaKey;
  }

  // ---- Parser ----

  function parseWikiLinks(text) {
    if (!text || typeof text !== 'string') return [];
    const results = [];
    let match;
    WIKI_RE.lastIndex = 0;
    while ((match = WIKI_RE.exec(text)) !== null) {
      const raw = match[0];
      const inner = match[1];
      const from = match.index;
      const to = from + raw.length;
      let target = inner;
      let label = '';
      const pipeIndex = inner.indexOf('|');
      if (pipeIndex !== -1) {
        target = inner.slice(0, pipeIndex);
        label = inner.slice(pipeIndex + 1);
      }
      target = target.trim();
      label = label.trim();
      if (!target) continue;
      results.push({ raw, target, label: label || target, from, to });
    }
    return results;
  }

  // ---- Normalization ----

  function normalizeTarget(raw) {
    return String(raw || '').replace(/\.md$/i, '').trim();
  }

  // ---- Resolver ----

  function resolveTarget(rawTarget) {
    const index = getWorkspaceIndex();
    if (!index || !index.ready || !index.files) {
      return { status: 'not-ready', target: rawTarget };
    }
    const normalized = normalizeTarget(rawTarget);
    if (!normalized) {
      return { status: 'not-ready', target: rawTarget };
    }
    const candidates = [];
    for (const file of index.files) {
      const filePath = String(file.path || '');
      const fileName = String(file.name || '');
      const fileBasename = fileName.replace(/\.md$/i, '');
      const fileTitle = String(file.title || '');
      if (normalizeTarget(filePath) === normalized) { candidates.push(file); continue; }
      if (normalizeTarget(fileName) === normalized) { candidates.push(file); continue; }
      if (fileBasename.toLowerCase() === normalized.toLowerCase()) { candidates.push(file); continue; }
      if (fileTitle && normalizeTarget(fileTitle) === normalized) { candidates.push(file); continue; }
      if (fileTitle && fileTitle.toLowerCase() === normalized.toLowerCase()) { candidates.push(file); continue; }
    }
    const seen = new Set();
    const unique = [];
    for (const f of candidates) {
      if (!seen.has(f.path)) { seen.add(f.path); unique.push(f); }
    }
    if (unique.length === 0) return { status: 'missing', target: rawTarget };
    if (unique.length === 1) return { status: 'resolved', file: unique[0] };
    return { status: 'ambiguous', matches: unique };
  }

  // ---- Open target ----

  async function openTarget(targetOrFile) {
    // Phase 1: Normalize input to a file object
    let file = null;
    const inputType = typeof targetOrFile;
    safeLog('WikiLinks: openTarget called type=' + inputType);

    if (inputType === 'string') {
      const result = resolveTarget(targetOrFile);
      safeLog('WikiLinks: openTarget resolve status=' + result.status + ' target=' + targetOrFile);
      if (result.status === 'missing') {
        globalThis.showToast?.('Wiki link target not found: ' + targetOrFile, 'error', 2600);
        return false;
      }
      if (result.status === 'ambiguous') {
        globalThis.showToast?.('Multiple files match ' + targetOrFile, 'error', 2600);
        return false;
      }
      if (result.status === 'not-ready') {
        globalThis.showToast?.('Workspace index not ready', 'error', 2600);
        return false;
      }
      file = result.file;
    } else if (targetOrFile && typeof targetOrFile.status === 'string' && targetOrFile.file) {
      file = targetOrFile.file;
    } else if (targetOrFile && typeof targetOrFile === 'object' && targetOrFile.path) {
      file = targetOrFile;
    } else if (targetOrFile && typeof targetOrFile === 'object') {
      safeLog('WikiLinks: openTarget unknown object keys=' + Object.keys(targetOrFile).join(','));
      return false;
    } else {
      safeLog('WikiLinks: openTarget invalid input');
      return false;
    }

    if (!file || !file.path) {
      safeLog('WikiLinks: openTarget cannot open - no file path');
      return false;
    }
    safeLog('WikiLinks: openTarget file path=' + file.path + ' name=' + file.name + ' hasHandle=' + Boolean(file.handle));

    // Phase 2: Open using handle or fallback canonical lookup
    var openFn = typeof globalThis.openWorkspaceFile === 'function'
      ? globalThis.openWorkspaceFile
      : typeof window.openWorkspaceFile === 'function'
      ? window.openWorkspaceFile
      : null;

    if (file.handle && openFn) {
      try {
        await openFn(file, file.kind || '', 'wiki link open');
        safeLog('WikiLinks: opened via handle target=' + file.path);
        return true;
      } catch (e) {
        safeLog('WikiLinks: handle open failed: ' + (e && e.message ? e.message : e));
      }
    }

    // Fallback: use canonical lookup from WORKSPACE_STATE (has handles)
    var findFn = typeof globalThis.findWorkspaceFileByPath === 'function'
      ? globalThis.findWorkspaceFileByPath
      : typeof window.findWorkspaceFileByPath === 'function'
      ? window.findWorkspaceFileByPath
      : null;

    if (findFn) {
      var canonicalFile = findFn(file.path);
      if (canonicalFile && canonicalFile.handle && openFn) {
        try {
          await openFn(canonicalFile, canonicalFile.kind || '', 'wiki link open');
          safeLog('WikiLinks: opened via canonical lookup target=' + canonicalFile.path);
          return true;
        } catch (e) {
          safeLog('WikiLinks: canonical lookup open failed: ' + (e && e.message ? e.message : e));
          return false;
        }
      }
      safeLog('WikiLinks: canonical lookup returned no handle for path=' + file.path);
    } else {
      safeLog('WikiLinks: findWorkspaceFileByPath not available');
    }

    safeLog('WikiLinks: openTarget unable to open');
    return false;
  }

  // ---- Missing target check ----

  function isMissingTarget(rawTarget) {
    const result = resolveTarget(rawTarget);
    return result.status === 'missing';
  }

  function isNotReady(rawTarget) {
    const result = resolveTarget(rawTarget);
    return result.status === 'not-ready';
  }

  // ---- CodeMirror decoration refresh ----

  function refreshCodeMirrorDecorations() {
    const index = getWorkspaceIndex();
    const links = index && index.links;
    const linkCount = links ? Array.from(links.keys()).length : 0;
    safeLog('WikiLinks: refresh cm decorations links=' + linkCount + ' indexReady=' + Boolean(index && index.ready));
    if (typeof window.__refreshWikiLinkDecorations === 'function') {
      try { window.__refreshWikiLinkDecorations(); } catch {}
    }
  }

  // ---- HTML Preview integration ----

  function wireHtmlPreviewListener() {
    const htmlPane = document.getElementById('htmlPane');
    if (!htmlPane) return;
    if (wiredHtmlPane === htmlPane) return;

    htmlPane.addEventListener('click', async (event) => {
      const link = event.target && event.target.closest && event.target.closest('[data-wiki-target]');
      if (!link) return;
      event.preventDefault();
      event.stopPropagation();
      const target = link.dataset.wikiTarget || '';
      if (!target) return;
      await openTarget(target);
    });

    htmlPane.addEventListener('auxclick', async (event) => {
      if (event.button !== 1 && !isCmdOrCtrlClick(event)) return;
      const link = event.target && event.target.closest && event.target.closest('[data-wiki-target]');
      if (!link) return;
      event.preventDefault();
      event.stopPropagation();
      const target = link.dataset.wikiTarget || '';
      if (!target) return;
      await openTarget(target);
    });

    wiredHtmlPane = htmlPane;
    safeLog('WikiLinks: HTML preview listener wired');
  }

  // ---- Mobile action button ----

  function getCursorWikiLinkInfo() {
    try {
      const getOffsetFn = typeof window.__cmGetCursorOffset === 'function' ? window.__cmGetCursorOffset : null;
      const getTextFn = typeof window.__cmGetText === 'function' ? window.__cmGetText : null;
      if (!getOffsetFn || !getTextFn) return null;
      const cursorOffset = getOffsetFn();
      if (typeof cursorOffset !== 'number') return null;
      const text = getTextFn();
      if (!text) return null;
      const WIKI_RE = /\[\[([^\[\]\n]+?)\]\]/g;
      let match;
      while ((match = WIKI_RE.exec(text)) !== null) {
        const from = match.index;
        const to = from + match[0].length;
        if (cursorOffset >= from && cursorOffset < to) {
          const inner = match[1];
          const pipeIndex = inner.indexOf('|');
          let target = pipeIndex !== -1 ? inner.slice(0, pipeIndex) : inner;
          target = target.trim();
          if (!target) continue;
          return { target, raw: match[0], from, to };
        }
      }
    } catch {}
    return null;
  }

  function updateOpenWikiLinkButtonState() {
    const btn = document.getElementById('btnOpenWikiLink');
    if (!btn) return;
    const info = getCursorWikiLinkInfo();
    btn.disabled = !info;
    btn.title = info ? ('Open Wiki Link: ' + info.target) : 'Open Wiki Link (cursor not in wiki link)';
    btn.setAttribute('aria-label', btn.title);
  }

  function ensureOpenWikiLinkButton() {
    const toolsPanel = document.getElementById('editorOverlayToolsPanel');
    if (!toolsPanel) return null;
    let btn = document.getElementById('btnOpenWikiLink');
    if (btn) return btn;
    if (wiredOpenButton) return null;
    btn = document.createElement('button');
    btn.id = 'btnOpenWikiLink';
    btn.type = 'button';
    btn.title = 'Open Wiki Link';
    btn.setAttribute('aria-label', 'Open Wiki Link');
    btn.dataset.editorCommand = 'openWikiLink';
    btn.innerHTML = '🔗';
    btn.disabled = true;
    btn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const info = getCursorWikiLinkInfo();
      if (!info) { safeLog('WikiLinks: open button clicked but no wiki link at cursor'); return; }
      safeLog('WikiLinks: opening target from button=' + info.target);
      await openTarget(info.target);
    });
    toolsPanel.appendChild(btn);
    if (!wiredCursorHost) {
      const cmHost = document.getElementById('cmHost');
      if (cmHost) {
        cmHost.addEventListener('keyup', function() { try { updateOpenWikiLinkButtonState(); } catch {} }, true);
        cmHost.addEventListener('mouseup', function() { try { updateOpenWikiLinkButtonState(); } catch {} }, true);
        cmHost.addEventListener('selectionchange', function() { try { updateOpenWikiLinkButtonState(); } catch {} }, true);
      }
      window.addEventListener('cm-ready', function() { try { updateOpenWikiLinkButtonState(); } catch {} });
      wiredCursorHost = cmHost;
    }
    updateOpenWikiLinkButtonState();
    wiredOpenButton = btn;
    return btn;
  }

  // ---- Refresh ----

  function refresh() {
    const index = getWorkspaceIndex();
    const links = index && index.links;
    const linkCount = links ? Array.from(links.keys()).length : 0;
    const resolvedCount = (index && index.ready)
      ? (links ? Array.from(links.values()).flat().length : 0)
      : 0;
    const missingCount = (index && index.ready) ? linkCount - resolvedCount : 0;
    safeLog('WikiLinks: refresh links=' + linkCount + ' resolved=' + resolvedCount + ' missing=' + missingCount + ' indexReady=' + Boolean(index && index.ready));
    refreshCodeMirrorDecorations();
  }

  // ---- Wire ----

  function wire() {
    const cmReady = typeof window.__refreshWikiLinkDecorations === 'function';
    const htmlReady = !!document.getElementById('htmlPane');
    safeLog('WikiLinks: wire requested cm=' + cmReady + ' html=' + htmlReady);
    wireHtmlPreviewListener();
    ensureOpenWikiLinkButton();
    if (!cmReady) {
      safeLog('WikiLinks: wire deferred - CodeMirror extension not yet installed');
      return false;
    }
    safeLog('WikiLinks: wired');
    return true;
  }

  // ---- Lifecycle event listeners ----

  window.addEventListener('mme-workspace-index-ready', function() {
    safeLog('WikiLinks: workspace index ready event received');
    refresh();
  });

  window.addEventListener('cm-ready', function() {
    safeLog('WikiLinks: cm-ready event received');
    wire();
    refresh();
  });

  window.addEventListener('mme-main-ready', function() {
    safeLog('WikiLinks: mme-main-ready event received');
    wire();
    refresh();
  });

  // ---- Expose module API ----

  var MME_WIKI_LINKS = {
    parseWikiLinks: parseWikiLinks,
    normalizeTarget: normalizeTarget,
    resolveTarget: resolveTarget,
    openTarget: openTarget,
    isMissingTarget: isMissingTarget,
    isNotReady: isNotReady,
    refresh: refresh,
    wire: wire
  };

  try {
    window.MME_WIKI_LINKS = MME_WIKI_LINKS;
    globalThis.MME_WIKI_LINKS = MME_WIKI_LINKS;
  } catch {}

  if (typeof window.__refreshWikiLinkDecorations === 'function') {
    wire();
    refresh();
  } else {
    safeLog('WikiLinks: late-load deferred - waiting for cm-ready');
  }

  safeLog('WikiLinks: module loaded');
})();