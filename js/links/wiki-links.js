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

  // ==================================================================
  // ACT 3A — CANONICAL TARGET-RESOLUTION CONTRACT (single pure owner)
  //
  // For a raw Wiki Link target this decides resolved / missing / ambiguous /
  // not-ready, and WHICH exact physical path is named. Every consumer must call
  // this; no consumer may reimplement precedence.
  //
  // Pure with respect to its input: it reads the PASSED Index and returns a
  // plain object. It never opens a file, never scans, never mutates the Index,
  // never consults a clock, and never invents a target. Navigation is a
  // separate downstream concern (openTarget).
  // ==================================================================

  // Precedence, strongest physical identity first. Derived from source, not
  // preference: 'path' and 'filename' name a file that exists on disk and are
  // what openWorkspaceFile/findWorkspaceFileByPath take directly, so they are
  // authoritative. 'h1' is a saved VISUAL title that two Notes may legitimately
  // share, so it can never override a physical key.
  //
  // A stronger tier resolves on its own; a weaker tier is consulted ONLY when
  // every stronger tier yielded zero candidates. That is the defect ACT 3A
  // corrects: the previous resolver pooled every key into one candidate list, so
  // a target matching one filename AND another Note's H1 was reported
  // 'ambiguous' — a resolution failure presented as ambiguity.
  const WIKI_RESOLUTION_KINDS = Object.freeze(['path', 'filename', 'h1']);

  function stripMdExtension(value) {
    return String(value == null ? '' : value).replace(/\.md$/i, '');
  }

  // Physical keys compare case-SENSITIVELY. A case-insensitive physical key
  // would make Alpha.md reachable by "alpha.md", which the physical opener cannot
  // honour on a case-sensitive filesystem. Only the weaker visual H1 key is
  // case-insensitive, documented per-key rather than applied globally.
  function normalizePhysicalKey(value) {
    return stripMdExtension(value).trim();
  }

  function normalizeVisualKey(value) {
    return normalizePhysicalKey(value).toLowerCase();
  }

  // Candidates for ONE key tier, de-duplicated by exact physical path.
  // index.files is the single Workspace file collection, so a Note classified
  // as Knowledge/Pinned/Archived is still ONE row and can never become two
  // candidates (ACT 3A classification contract).
  function candidatesForTier(files, tier, normalized) {
    if (!normalized) return [];

    const seen = new Set();
    const out = [];

    for (const file of files) {
      if (!file) continue;

      const filePath = String(file.path || '');
      if (!filePath) continue;

      let hit = false;

      if (tier === 'path') {
        hit = normalizePhysicalKey(filePath) === normalized;
      } else if (tier === 'filename') {
        const name = String(file.name || '');
        hit =
          normalizePhysicalKey(name) === normalized ||
          normalizePhysicalKey(stripMdExtension(name)) === normalized;
      } else if (tier === 'h1') {
        const title = String(file.title || '');
        if (title) {
          // Case-insensitive, and NOT merged: two Notes sharing a title BOTH
          // remain candidates.
          hit = normalizeVisualKey(title) === normalized;
        }
      }

      if (hit && !seen.has(filePath)) {
        seen.add(filePath);
        out.push(file);
      }
    }

    return out;
  }

  /**
   * Canonical Wiki Link target resolution.
   * @param {string} rawTarget       text between brackets, alias already stripped
   * @param {object} [indexSnapshot] saved Workspace Index; defaults to the
   *                                 global. Passing it explicitly is what makes
   *                                 this function pure and testable.
   * @returns {{status,rawTarget,normalizedTarget,targetPath,targetTitle,
   *            candidates,resolutionKind,diagnostic}}
   */
  function resolveWikiTarget(rawTarget, indexSnapshot) {
    const raw = String(rawTarget == null ? '' : rawTarget);
    const index =
      indexSnapshot === undefined ? getWorkspaceIndex() : indexSnapshot;

    const notReady = (diagnostic) => ({
      status: 'not-ready',
      rawTarget: raw,
      normalizedTarget: '',
      targetPath: '',
      targetTitle: '',
      candidates: [],
      resolutionKind: '',
      diagnostic: diagnostic || 'workspace-index-unavailable',
    });

    const terminal = (status, candidates, resolutionKind, diagnostic) => ({
      status,
      rawTarget: raw,
      normalizedTarget: normalizePhysicalKey(raw),
      targetPath: status === 'resolved' ? String(candidates[0].path || '') : '',
      targetTitle: status === 'resolved' ? String(candidates[0].title || '') : '',
      candidates,
      resolutionKind,
      diagnostic: diagnostic || '',
    });

    // NOT-READY never degrades into 'missing': without a saved Index we cannot
    // know whether the target exists.
    if (!index || !index.ready || !Array.isArray(index.files)) {
      return notReady();
    }

    const normalized = normalizePhysicalKey(raw);
    if (!normalized) return notReady('empty-target');

    // Strongest tier first. The FIRST tier that yields candidates decides.
    for (const tier of WIKI_RESOLUTION_KINDS) {
      const key = tier === 'h1' ? normalized.toLowerCase() : normalized;
      const candidates = candidatesForTier(index.files, tier, key);
      if (candidates.length === 0) continue;

      if (candidates.length === 1) {
        return terminal('resolved', candidates, tier, '');
      }

      // Genuine ambiguity: >1 distinct physical path in the SAME tier. All safe
      // candidate paths are returned and nothing is selected — never first
      // match, never Index insertion order.
      return terminal('ambiguous', candidates, tier, `${candidates.length}-candidates`);
    }

    return terminal('missing', [], '', 'no-candidate');
  }

  // ---- Compatibility wrapper ----
  //
  // Existing consumers (CodeMirror status, openTarget, isMissingTarget,
  // isNotReady) already call resolveTarget(). It now delegates to the canonical
  // owner so they cannot drift from it. The legacy `file` / `matches` fields are
  // preserved so no existing call site breaks.
  function resolveTarget(rawTarget) {
    const result = resolveWikiTarget(rawTarget);
    if (result.status === 'resolved') {
      return {
        status: 'resolved',
        file: result.candidates[0],
        target: result.rawTarget,
      };
    }
    if (result.status === 'ambiguous') {
      return {
        status: 'ambiguous',
        matches: result.candidates,
        target: result.rawTarget,
      };
    }
    return { status: result.status, target: result.rawTarget };
  }

  // ---- Legacy resolver (pre-ACT 3A), retained ONLY for validator proof ----
  //
  // ACT 3A does not delete the old algorithm silently. Keeping it lets the
  // focused suite execute BOTH and prove the defect it replaced: a target
  // matching one filename and another Note's H1 is reported 'ambiguous' by the
  // pooled implementation. It is exported only for that proof and NO consumer
  // calls it — openTarget and every status consumer go through resolveTarget.
  function resolveTargetLegacyPooled(rawTarget) {
    const index = getWorkspaceIndex();
    if (!index || !index.ready || !index.files) {
      return { status: 'not-ready', target: rawTarget };
    }
    const normalized = normalizeTarget(rawTarget);
    if (!normalized) return { status: 'not-ready', target: rawTarget };
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
  //
  // ACT 3A does NOT change navigation. openTarget already used the exact
  // physical path plus the existing safe opener, and that is the accepted
  // contract. It is now driven only by the canonical status: a resolved target
  // carries targetPath, and missing / ambiguous / not-ready never reach the
  // opener at all.

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
    const ready = Boolean(index && index.ready);
    // index.links is a Map: key = unique link target, value = array of source
    // paths referencing that target. Flattened values are therefore SOURCE
    // OCCURRENCES, not resolved targets — subtracting them from the unique
    // target count mixes units and produced impossible negative "missing"
    // diagnostics. Classification below counts the SAME unique-target set
    // through the existing resolver, so the units are compatible:
    //   resolvedTargets + ambiguousTargets + missingTargets + notReadyTargets
    //     === uniqueTargets
    // sourceOccurrences stays a separate informational metric and is never
    // subtracted from anything.
    const uniqueTargets = links ? links.size : 0;
    const sourceOccurrences = links
      ? Array.from(links.values()).reduce(
          (n, v) => n + (Array.isArray(v) ? v.length : 0),
          0
        )
      : 0;
    let resolvedTargets = 0;
    let ambiguousTargets = 0;
    let missingTargets = 0;
    let notReadyTargets = 0;
    if (ready && links) {
      for (const key of links.keys()) {
        const result = resolveTarget(key);
        if (result.status === 'resolved') resolvedTargets++;
        else if (result.status === 'ambiguous') ambiguousTargets++;
        else if (result.status === 'missing') missingTargets++;
        else notReadyTargets++;
      }
    } else {
      notReadyTargets = uniqueTargets;
    }
    safeLog(
      'WikiLinks: refresh' +
        ' uniqueTargets=' + uniqueTargets +
        ' resolvedTargets=' + resolvedTargets +
        ' ambiguousTargets=' + ambiguousTargets +
        ' missingTargets=' + missingTargets +
        ' notReadyTargets=' + notReadyTargets +
        ' sourceOccurrences=' + sourceOccurrences +
        ' indexReady=' + ready
    );
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
    // ACT 3A canonical owner.
    resolveWikiTarget: resolveWikiTarget,
    normalizePhysicalKey: normalizePhysicalKey,
    normalizeVisualKey: normalizeVisualKey,
    WIKI_RESOLUTION_KINDS: WIKI_RESOLUTION_KINDS,
    // Pre-ACT 3A pooled algorithm, exported ONLY so the focused suite can prove
    // the defect it replaced. No consumer calls it.
    resolveTargetLegacyPooled: resolveTargetLegacyPooled,
    // Back-compat wrapper now delegating to the canonical owner.
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