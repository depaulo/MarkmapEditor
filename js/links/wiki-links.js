// @ts-nocheck
// R-LINK1 — Wiki Links
// Parser, resolver, and click/open infrastructure for [[WikiLinks]].
// Reuses existing workspace index and file-opening paths.
// ================================

(function () {
  'use strict';

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
   * Open a resolved wiki link target.
   * Reuses existing globalThis.openWorkspaceFile.
   * @param {object} file - Workspace file record
   * @returns {Promise<boolean>} Whether the file was opened
   */
  async function openTarget(file) {
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

  // ---- Refresh (placeholder for future decoration refresh) ----

  function refresh() {
    safeLog('WikiLinks: refresh requested');
  }

  // ---- Wire (placeholder for future event wiring) ----

  function wire() {
    safeLog('WikiLinks: wire called');
  }

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
