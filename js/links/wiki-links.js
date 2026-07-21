// @ts-nocheck
// R-LINK1 — Wiki Links
// Parser, resolver, and click/open infrastructure for [[WikiLinks]].
// Reuses existing workspace index and file-opening paths.
// ================================

(function () {
  'use strict';

  // ---- Private state ----
  let wired = false;
  let htmlListenerAttached = false;

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

  /**
   * Parse wiki links from Markdown text.
   * @param {string} text - Markdown source text
   * @returns {Array<{raw: string, target: string, label: string, from: number, to: number}>}
   */
  function parseWikiLinks(text) {
    if (!text || typeof text !== 'string') return [];

    const results = [];
    let match;

    // Reset regex state
    WIKI_RE.lastIndex = 0;

    while ((match = WIKI_RE.exec(text)) !== null) {
      const raw = match[0];        // e.g. [[AlibabaCloud|Alibaba Cloud]]
      const inner = match[1];      // e.g. AlibabaCloud|Alibaba Cloud
      const from = match.index;
      const to = from + raw.length;

      let target = inner;
      let label = '';

      // Check for alias syntax [[target|label]]
      const pipeIndex = inner.indexOf('|');
      if (pipeIndex !== -1) {
        target = inner.slice(0, pipeIndex);
        label = inner.slice(pipeIndex + 1);
      }

      target = target.trim();
      label = label.trim();

      if (!target) continue;

      results.push({
        raw,
        target,
        label: label || target,
        from,
        to,
      });
    }

    return results;
  }

  // ---- Normalization ----

  /**
   * Normalize a wiki link target for lookup.
   * Removes .md extension, trims, converts to lower case for comparison.
   */
  function normalizeTarget(raw) {
    return String(raw || '')
      .replace(/\.md$/i, '')
      .trim();
  }

  // ---- Resolver ----

  /**
   * Resolve a wiki link target to a workspace file record.
   * @param {string} rawTarget - The raw [[target]] value
   * @returns {{ status: 'resolved', file: object } | { status: 'missing', target: string } | { status: 'ambiguous', matches: Array<object> }}
   */
  function resolveTarget(rawTarget) {
    const index = getWorkspaceIndex();
    if (!index || !index.ready || !index.files) {
      return { status: 'missing', target: rawTarget };
    }

    const normalized = normalizeTarget(rawTarget);
    if (!normalized) {
      return { status: 'missing', target: rawTarget };
    }

    const candidates = [];

    for (const file of index.files) {
      const filePath = String(file.path || '');
      const fileName = String(file.name || '');
      const fileBasename = fileName.replace(/\.md$/i, '');
      const fileTitle = String(file.title || '');

      // 1. Exact workspace-relative path match
      if (normalizeTarget(filePath) === normalized) {
        candidates.push(file);
        continue;
      }

      // 2. Exact filename including .md
      if (normalizeTarget(fileName) === normalized) {
        candidates.push(file);
        continue;
      }

      // 3. Exact basename without .md
      if (fileBasename.toLowerCase() === normalized.toLowerCase()) {
        candidates.push(file);
        continue;
      }

      // 4. Exact document title/H1
      if (fileTitle && normalizeTarget(fileTitle) === normalized) {
        candidates.push(file);
        continue;
      }

      // 5. Case-insensitive basename fallback
      if (fileBasename.toLowerCase() === normalized.toLowerCase()) {
        candidates.push(file);
        continue;
      }

      // 6. Case-insensitive title fallback
      if (fileTitle && fileTitle.toLowerCase() === normalized.toLowerCase()) {
        candidates.push(file);
        continue;
      }
    }

    // Deduplicate by path
    const seen = new Set();
    const unique = [];
    for (const f of candidates) {
      if (!seen.has(f.path)) {
        seen.add(f.path);
        unique.push(f);
      }
    }

    if (unique.length === 0) {
      return { status: 'missing', target: rawTarget };
    }

    if (unique.length === 1) {
      return { status: 'resolved', file: unique[0] };
    }

    return { status: 'ambiguous', matches: unique };
  }

  // ---- Open target ----

  /**
   * Open a wiki link target.
   * Accepts either a string target or a file object.
   * @param {string|object} targetOrFile - The target name or file record
   * @returns {Promise<boolean>} Whether the file was opened
   */
  async function openTarget(targetOrFile) {
    let file = null;

    // If string, resolve it
    if (typeof targetOrFile === 'string') {
      const result = resolveTarget(targetOrFile);
      if (result.status === 'missing') {
        safeLog(`WikiLinks: missing target=${targetOrFile}`);
        globalThis.showToast?.(`Wiki link target not found: ${targetOrFile}`, 'error', 2600);
        return false;
      }
      if (result.status === 'ambiguous') {
        safeLog(`WikiLinks: ambiguous target=${targetOrFile} matches=${result.matches?.length || 0}`);
        globalThis.showToast?.(`Multiple files match ${targetOrFile}`, 'error', 2600);
        return false;
      }
      file = result.file;
    } else {
      file = targetOrFile;
    }

    if (!file || !file.handle) {
      safeLog('WikiLinks: openTarget called without a valid file record');
      return false;
    }

    const openFn =
      typeof globalThis.openWorkspaceFile === 'function'
        ? globalThis.openWorkspaceFile
        : typeof window.openWorkspaceFile === 'function'
        ? window.openWorkspaceFile
        : null;

    if (!openFn) {
      safeLog('WikiLinks: openWorkspaceFile not available');
      return false;
    }

    try {
      await openFn(file, file.kind || '', 'wiki link open');
      safeLog(`WikiLinks: opening target=${file.path || file.name}`);
      return true;
    } catch (e) {
      safeLog('WikiLinks: openTarget failed: ' + (e?.message || e));
      return false;
    }
  }

  // ---- Missing target check ----

  function isMissingTarget(rawTarget) {
    const result = resolveTarget(rawTarget);
    return result.status === 'missing';
  }

  // ---- CodeMirror decoration refresh ----

  function refreshCodeMirrorDecorations() {
    const index = getWorkspaceIndex();
    const links = index?.links;
    const linkCount = links ? Array.from(links.keys()).length : 0;
    safeLog(`WikiLinks: refresh cm decorations links=${linkCount} indexReady=${Boolean(index?.ready)}`);

    // Trigger CodeMirror decoration refresh if available
    if (typeof window.__refreshWikiLinkDecorations === 'function') {
      try {
        window.__refreshWikiLinkDecorations();
      } catch {}
    }
  }

  // ---- HTML Preview integration ----

  function wireHtmlPreviewListener() {
    if (htmlListenerAttached) return;

    const htmlPane = document.getElementById('htmlPane');
    if (!htmlPane) return;

    // Use event delegation on the HTML preview container
    htmlPane.addEventListener('click', async (event) => {
      const link = event.target?.closest?.('[data-wiki-target]');
      if (!link) return;

      event.preventDefault();
      event.stopPropagation();

      const target = link.dataset.wikiTarget || '';
      if (!target) return;

      await openTarget(target);
    });

    htmlPane.addEventListener('auxclick', async (event) => {
      // Middle-click or Ctrl+Click on wiki links in HTML preview
      if (event.button !== 1 && !isCmdOrCtrlClick(event)) return;

      const link = event.target?.closest?.('[data-wiki-target]');
      if (!link) return;

      event.preventDefault();
      event.stopPropagation();

      const target = link.dataset.wikiTarget || '';
      if (!target) return;

      await openTarget(target);
    });

    htmlListenerAttached = true;
    safeLog('WikiLinks: HTML preview listener wired');
  }

  // ---- Mobile action button ----

  let openWikiLinkBtnCursorTracker = null;

  function getCursorWikiLinkInfo() {
    try {
      const getTextFn = typeof window.__cmGetText === 'function' ? window.__cmGetText : null;
      const getCursorLineFn = typeof window.__cmGetCursorLine === 'function' ? window.__cmGetCursorLine : null;

      if (!getTextFn || !getCursorLineFn) return null;

      const text = getTextFn();
      const cursorLine = getCursorLineFn(); // 0-based

      if (typeof cursorLine !== 'number' || !text) return null;

      // Find wiki link on the current line
      const lines = text.split('\n');
      const lineIndex = Math.max(0, Math.min(lines.length - 1, cursorLine));
      const lineText = lines[lineIndex] || '';

      const WIKI_RE = /\[\[([^\[\]\n]+?)\]\]/g;
      let match;
      while ((match = WIKI_RE.exec(lineText)) !== null) {
        const inner = match[1];
        const pipeIndex = inner.indexOf('|');
        let target = pipeIndex !== -1 ? inner.slice(0, pipeIndex) : inner;
        target = target.trim();
        if (!target) continue;

        // Check if cursor is within this wiki link
        const linkStart = match.index;
        const linkEnd = linkStart + match[0].length;
        // We don't have exact cursor column, so if there's only one wiki link on the line, use it
        return { target, raw: match[0] };
      }
    } catch {}

    return null;
  }

  function updateOpenWikiLinkButtonState() {
    const btn = document.getElementById('btnOpenWikiLink');
    if (!btn) return;

    const info = getCursorWikiLinkInfo();
    btn.disabled = !info;
    btn.title = info ? `Open Wiki Link: ${info.target}` : 'Open Wiki Link (cursor not in wiki link)';
    btn.setAttribute('aria-label', btn.title);
  }

  function ensureOpenWikiLinkButton() {
    const toolsPanel = document.getElementById('editorOverlayToolsPanel');
    if (!toolsPanel) return null;

    let btn = document.getElementById('btnOpenWikiLink');
    if (btn) return btn;

    btn = document.createElement('button');
    btn.id = 'btnOpenWikiLink';
    btn.type = 'button';
    btn.title = 'Open Wiki Link';
    btn.setAttribute('aria-label', 'Open Wiki Link');
    btn.dataset.editorCommand = 'openWikiLink';
    btn.innerHTML = '🔗';
    btn.disabled = true;

    // Click handler
    btn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const info = getCursorWikiLinkInfo();
      if (!info) {
        safeLog('WikiLinks: open button clicked but no wiki link at cursor');
        return;
      }

      safeLog(`WikiLinks: opening target from button=${info.target}`);
      await openTarget(info.target);
    });

    // Add to the tools panel
    toolsPanel.appendChild(btn);

    // Track cursor changes to update button state
    if (!openWikiLinkBtnCursorTracker) {
      openWikiLinkBtnCursorTracker = true;

      // Use CodeMirror's update listener if available
      const cmHost = document.getElementById('cmHost');
      if (cmHost) {
        cmHost.addEventListener('keyup', () => {
          try {
            updateOpenWikiLinkButtonState();
          } catch {}
        }, true);

        cmHost.addEventListener('mouseup', () => {
          try {
            updateOpenWikiLinkButtonState();
          } catch {}
        }, true);

        cmHost.addEventListener('selectionchange', () => {
          try {
            updateOpenWikiLinkButtonState();
          } catch {}
        }, true);
      }

      // Also update on CodeMirror ready
      window.addEventListener('cm-ready', () => {
        try {
          updateOpenWikiLinkButtonState();
        } catch {}
      });
    }

    // Initial state update
    updateOpenWikiLinkButtonState();

    return btn;
  }

  // ---- Refresh ----

  function refresh() {
    const index = getWorkspaceIndex();
    const links = index?.links;
    const linkCount = links ? Array.from(links.keys()).length : 0;
    const resolvedCount = index?.ready ? (links ? Array.from(links.values()).flat().length : 0) : 0;
    const missingCount = index?.ready ? linkCount - resolvedCount : 0;

    safeLog(`WikiLinks: refresh links=${linkCount} resolved=${resolvedCount} missing=${missingCount} indexReady=${Boolean(index?.ready)}`);

    refreshCodeMirrorDecorations();
  }

  // ---- Wire ----

  function wire() {
    if (wired) return true;

    // Check if CodeMirror is ready
    const cmReady = typeof window.__cmGetText === 'function';
    // Check if HTML preview container exists
    const htmlReady = !!document.getElementById('htmlPane');

    safeLog(`WikiLinks: wire cm=${cmReady} html=${htmlReady} mobileAction=${true}`);

    // Wire HTML preview listener
    wireHtmlPreviewListener();

    // Ensure mobile action button exists
    ensureOpenWikiLinkButton();

    wired = true;
    safeLog('WikiLinks: wired');
    return true;
  }

  // ---- Lifecycle event listeners ----

  // Listen for workspace index ready
  window.addEventListener('mme-workspace-index-ready', () => {
    safeLog('WikiLinks: workspace index ready event received');
    refresh();
  });

  // Listen for CodeMirror ready
  window.addEventListener('cm-ready', () => {
    safeLog('WikiLinks: cm-ready event received');
    refresh();
  });

  // Listen for main ready
  window.addEventListener('mme-main-ready', () => {
    safeLog('WikiLinks: mme-main-ready event received');
    wire();
  });

  // ---- Expose module API ----

  const MME_WIKI_LINKS = {
    parseWikiLinks,
    normalizeTarget,
    resolveTarget,
    openTarget,
    isMissingTarget,
    refresh,
    wire,
  };

  try {
    window.MME_WIKI_LINKS = MME_WIKI_LINKS;
    globalThis.MME_WIKI_LINKS = MME_WIKI_LINKS;
  } catch {}

  safeLog('WikiLinks: module loaded');
})();