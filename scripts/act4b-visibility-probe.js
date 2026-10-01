/* =====================================================================
 * ACT 4B — JOURNAL SIDEBAR VISIBILITY PROBE
 * (DIAGNOSTIC ONLY — never loaded in production, never referenced by the app)
 * =====================================================================
 *
 * WHY THIS EXISTS
 * ---------------
 * "Journal Note composition: complete" is a LOG, not a DOM fact, and the
 * `hidden` PROPERTY is a REQUEST, not a rendering result. Three independent
 * owners can each make the Sidebar wrong while every log line reads "rendered":
 *
 *   1. an ID-level author `display:` rule outranks the UA `[hidden]` rule, so
 *      `hidden = true` can be completely inert;
 *   2. a class on <html> (`workspace-empty`, `journal-sidebar-collapsed`)
 *      suppresses a host by ANCESTOR rule even with `hidden = false`;
 *   3. a LATER owner re-applies a composition after the Note composition ran.
 *
 * A `.hidden`-only log is structurally blind to all three. This probe reports
 * COMPUTED STYLE plus the enumerable DOM facts, and watches for later writers.
 *
 * HOW TO RUN (device)
 * -------------------
 *   Option A — DevTools: Console -> paste this file -> Enter.
 *   Option B — no DevTools: paste, then call
 *              __ACT4B_PROBE__.installDevButton() and press the floating
 *              "ACT4B snapshot" button at each step.
 *
 *   Snapshot at each scenario:
 *     A  __ACT4B_PROBE__.snapshot('A neutral Journal')
 *     B  __ACT4B_PROBE__.snapshot('B neutral -> Open Note')
 *     C  __ACT4B_PROBE__.snapshot('C neutral -> Open Workspace')
 *     D  __ACT4B_PROBE__.snapshot('D after blocked cross-transition')
 *     report: __ACT4B_PROBE__.report()   stop: __ACT4B_PROBE__.stop()
 *
 * GUARANTEES (what this probe will NOT do)
 * ----------------------------------------
 *   - it never writes to the DOM: no attribute, class, text or panel state is
 *     changed; every access is a read;
 *   - it never writes to localStorage / IndexedDB / files;
 *   - it never reads or logs file CONTENT, handles or absolute paths: the file
 *     NAME is the only document-derived identifier, and the only content-derived
 *     value in the whole report is a 24-character-truncated row label;
 *   - it creates no timer and no listener except one MutationObserver, removed
 *     by stop();
 *   - the wrapper functions it installs for phase attribution are restored by
 *     stop().
 *
 * REMOVAL: stop() removes the observer, the wrappers and the dev button; a page
 * reload removes everything. No temporary wiring exists in app source.
 * ===================================================================== */
(function act4bVisibilityProbe() {
  'use strict';

  const PROBE_KEY = '__ACT4B_PROBE__';
  const previous = globalThis[PROBE_KEY];
  if (previous && typeof previous.stop === 'function') {
    try { previous.stop(); } catch (e) {}
  }

  // Fallback list only: the live authority is the shipped registry, read below.
  const FALLBACK_HOST_IDS = [
    'workspaceActivePanel',
    'workspaceTagsPanel',
    'workspaceTasksPanel',
    'workspaceRelatedPanel',
    'workspaceJournalsPanel',
    'workspaceConceptsPanel',
    'workspacePinnedPanel',
    'workspaceSearchPanel',
    'workspaceArchivePanel',
    'workspaceTaskBoardPanel',
    'workspaceProjectsPanel',
    'workspaceIndexPanel',
    'workspaceReportPanel',
  ];

  // The Current Document hosts a Journal Note composition must SHOW.
  const NOTE_LOCAL_IDS = [
    'workspaceActivePanel',
    'workspaceTagsPanel',
    'workspaceTasksPanel',
    'workspaceRelatedPanel',
  ];

  const snapshots = [];
  const mutations = [];
  const restores = [];
  let observer = null;
  let devButton = null;
  let stopped = false;
  let lastPhase = { at: 0, name: '(none)' };

  // ------------------------------------------------------------- helpers
  const safe = (fn, fallback) => {
    try {
      const v = fn();
      return v === undefined ? fallback : v;
    } catch (e) {
      return fallback;
    }
  };

  const now = () => safe(() => Math.round(performance.now()), Date.now());

  function basenameOnly(value) {
    try {
      const s = String(value || '');
      if (!s) return '';
      const parts = s.split(/[\\/]/);
      return parts[parts.length - 1] || '';
    } catch (e) {
      return '';
    }
  }

  // The only content-derived value in the whole report: a bounded label. Never a
  // path, never a full line of Markdown, never a file body.
  function boundedLabel(value) {
    try {
      return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 24);
    } catch (e) {
      return '';
    }
  }

  function registryIds() {
    const reg = safe(() => globalThis.MME_PANEL_COMPOSITION, null);
    if (!reg) return FALLBACK_HOST_IDS.slice();
    const ids = Object.keys(reg)
      .map((k) => safe(() => reg[k].elementId, null))
      .filter(Boolean);
    return ids.length ? ids : FALLBACK_HOST_IDS.slice();
  }

  function composed(el) {
    try {
      return typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
    } catch (e) {
      return null;
    }
  }

  function parentChain(element) {
    const chain = [];
    let node = element ? element.parentElement : null;
    let guard = 0;
    while (node && guard < 8) {
      guard += 1;
      const cs = composed(node);
      chain.push({
        tag: String(node.tagName || '').toLowerCase(),
        id: node.id || '',
        classList: node.classList ? Array.prototype.slice.call(node.classList).join('.') : '',
        display: cs ? cs.display : '?',
        visibility: cs ? cs.visibility : '?',
      });
      node = node.parentElement;
    }
    return chain;
  }

  function describeHost(id) {
    if (typeof document === 'undefined' || !document.getElementById) return { id, exists: false };
    const el = document.getElementById(id);
    if (!el) return { id, exists: false, note: 'no DOM element' };

    const cs = composed(el);
    const classList = el.classList ? Array.prototype.slice.call(el.classList).join(' ') : '';
    const rows = el.querySelectorAll
      ? el.querySelectorAll('[data-scope], .workspaceRelatedRow, .workspaceTagItem, li').length
      : 0;
    const heading = safe(() => {
      const node = el.querySelector(
        '.workspaceRelatedTitle, .workspaceTagsTitle, .workspaceTasksTitle, .workspaceActiveTitle'
      );
      return node ? String(node.textContent || '').trim() : '';
    }, '');
    const badge = safe(() => {
      const node = el.querySelector('.workspacePanelBadge, .workspaceActiveBadge');
      return node ? String(node.textContent || '').trim() : '(none)';
    }, '(none)');
    const summary = safe(() => {
      const node = el.querySelector(
        '.workspaceRelatedSummary, .workspaceIndexSummary, .workspaceTagsSummary'
      );
      return node ? String(node.textContent || '').trim().slice(0, 60) : '(none)';
    }, '(none)');
    const firstRow = safe(() => {
      const node = el.querySelector('[data-scope], .workspaceRelatedRow, li');
      return node ? boundedLabel(node.textContent) : '';
    }, '');

    return {
      id,
      exists: true,
      hiddenProperty: Boolean(el.hidden),
      hasHiddenAttribute: Boolean(el.hasAttribute && el.hasAttribute('hidden')),
      ariaHidden: (el.getAttribute && el.getAttribute('aria-hidden')) || '',
      display: cs ? cs.display : '?',
      visibility: cs ? cs.visibility : '?',
      opacity: cs ? cs.opacity : '?',
      clientWidth: Number(el.clientWidth || 0),
      clientHeight: Number(el.clientHeight || 0),
      hasOffsetParent: el.offsetParent !== null && el.offsetParent !== undefined,
      classList,
      parentChain: parentChain(el),
      heading,
      badge,
      summary,
      rowCount: rows,
      firstRowText: firstRow,
      // Derived from COMPUTED STYLE plus layout geometry — never from `hidden`.
      effectiveVisible: !el.hidden && !!cs && cs.display !== 'none' &&
        cs.visibility !== 'hidden' && Number(el.clientHeight || 0) > 0,
      contradiction: Boolean(el.hidden) && !!cs && cs.display !== 'none'
        ? 'hidden=true but computed display=' + cs.display +
          ' (an author rule outranks the UA [hidden] rule)'
        : (!el.hidden && !!cs && cs.display === 'none'
          ? 'hidden=false but computed display=none (an ancestor class or rule suppresses it)'
          : ''),
    };
  }

  function context() {
    const sidebar = safe(() => (typeof getSidebarComposition === 'function'
      ? getSidebarComposition() : null), null);
    const relatedHost = typeof document.getElementById === 'function'
      ? document.getElementById('workspaceRelatedPanel')
      : null;
    const relatedTitle = relatedHost && relatedHost.querySelector
      ? String((relatedHost.querySelector('.workspaceRelatedTitle') || {}).textContent || '').trim()
      : '';

    return {
      appContext: safe(() => document.documentElement.dataset.appContext, ''),
      journalComposition: safe(() => (typeof getJournalComposition === 'function'
        ? getJournalComposition() : '?'), '?'),
      journalCompositionDataset: safe(() => document.documentElement.dataset.journalComposition, ''),
      workspaceAggregationActive: safe(() => (typeof isWorkspaceAggregationActive === 'function'
        ? isWorkspaceAggregationActive() : '?'), '?'),
      taskReviewScope: safe(() => globalThis.MME_TASK_REVIEW?.getTaskScope?.(), '?'),
      htmlClassList: safe(() => Array.prototype.slice.call(document.documentElement.classList).join(' '), ''),
      currentFileName: basenameOnly(safe(() => globalThis.MME_APP?.getCurrentDocumentRuntimeState?.().fileName, '')),
      hasRootHandle: safe(() => Boolean(globalThis.WORKSPACE_STATE?.rootHandle), false),
      sidebarComposition: sidebar
        ? {
          composition: sidebar.composition,
          workspaceAvailable: Boolean(sidebar.workspaceAvailable),
          visibleElementIds: (sidebar.visibleElementIds || []).slice(),
          hiddenElementIds: (sidebar.hiddenElementIds || []).slice(),
          unknownAvailabilityKeys: (sidebar.unknownAvailabilityKeys || []).slice(),
        }
        : null,
      // The single shared relationship host states its own direction in its title.
      relationshipTitle: relatedTitle,
      relationshipDirection: /links\s*out/i.test(relatedTitle)
        ? 'links-out'
        : (/links\s*in/i.test(relatedTitle) ? 'links-in' : 'unknown'),
      noteLocalHostsExpectedVisible: NOTE_LOCAL_IDS.slice(),
    };
  }
  function snapshot(label) {
    const ids = registryIds();
    const known = new Set(FALLBACK_HOST_IDS);
    const hosts = ids.map(describeHost);

    const record = {
      label: String(label || 'snapshot'),
      at: now(),
      lastPhase: { name: lastPhase.name, at: lastPhase.at },
      context: context(),
      hosts,
      visibleElementIds: hosts.filter((h) => h.effectiveVisible).map((h) => h.id),
      hiddenElementIds: hosts.filter((h) => !h.effectiveVisible).map((h) => h.id),
      // Coverage facts, including the latent registry/host gap.
      unknownRegistryElementIds: ids.filter((id) => !known.has(id)),
      registryIdsWithoutDomElement: hosts.filter((h) => !h.exists).map((h) => h.id),
      contradictions: hosts
        .filter((h) => h.contradiction)
        .map((h) => h.id + ': ' + h.contradiction),
      watchedMutations: mutations.length,
      watchedMutationTail: mutations.slice(-12),
    };

    snapshots.push(record);
    printSnapshot(record);
    return record;
  }

  function printSnapshot(record) {
    if (typeof console === 'undefined' || !console.groupCollapsed) return;
    console.groupCollapsed('ACT4B[' + record.label + '] at ' + record.at +
      ' phase=' + record.lastPhase.name);
    try {
      console.log('context', JSON.parse(JSON.stringify(record.context)));
      const rows = record.hosts.map((h) => ({
        id: h.id,
        exists: h.exists,
        hiddenProp: h.hiddenProperty,
        hiddenAttr: h.hasHiddenAttribute,
        ariaHidden: h.ariaHidden,
        display: h.display,
        visibility: h.visibility,
        opacity: h.opacity,
        w: h.clientWidth,
        h: h.clientHeight,
        offsetParent: h.hasOffsetParent,
        rows: h.rowCount,
        heading: h.heading,
        visible: h.effectiveVisible,
        contradiction: h.contradiction,
      }));
      if (console.table) console.table(rows);
      console.log('visibleElementIds', record.visibleElementIds.join(','));
      console.log('hiddenElementIds', record.hiddenElementIds.join(','));
      console.log('unknownRegistryElementIds',
        record.unknownRegistryElementIds.join(',') || '(none)');
      console.log('registryIdsWithoutDomElement',
        record.registryIdsWithoutDomElement.join(',') || '(none)');
      console.log('contradictions', record.contradictions.join(' | ') || '(none)');
      console.log('watchedMutations', record.watchedMutations);
      if (record.watchedMutationTail.length) console.log('last mutations', record.watchedMutationTail);
    } finally {
      console.groupEnd();
    }
  }
  // --------------------------------------------------- phase attribution
  // §9: wrappers record WHEN each relevant owner runs. Only globals the app
  // already exposes are wrapped; module-scoped renderers are attributed by the
  // enclosing phase marker (source-proven), not by monkey-patching internals.
  function wrapFunction(object, key, phaseName) {
    if (!object) return;
    const original = object[key];
    if (typeof original !== 'function') return;
    let wrapper;
    try {
      wrapper = function act4bPhaseMarkerWrapper() {
        lastPhase = { at: now(), name: phaseName };
        try {
          return original.apply(this, arguments);
        } finally {
          lastPhase = { at: now(), name: phaseName + ':done' };
        }
      };
      object[key] = wrapper;
      restores.push(() => { object[key] = original; });
    } catch (e) {}
  }

  function installPhaseMarkers() {
    const G = globalThis;
    [
      ['applySidebarComposition', 'applySidebarComposition'],
      ['composeStandaloneNotePanels', 'composeStandaloneNotePanels'],
      ['setupWorkspacePanels', 'setupWorkspacePanels'],
      ['applyAppContextUi', 'applyAppContextUi'],
      ['updateWorkspaceUiState', 'updateWorkspaceUiState'],
      ['updateWorkspaceActiveFileHighlight', 'updateWorkspaceActiveFileHighlight'],
      ['refreshWorkspaceSidebar', 'refreshWorkspaceSidebar'],
      ['renderWorkspaceActivePanel', 'renderWorkspaceActivePanel'],
      ['renderWorkspaceTagsPanel', 'renderWorkspaceTagsPanel'],
      ['render', 'render (editor/input callback)'],
      ['updateMindmap', 'updateMindmap'],
      ['buildWorkspaceIndex', 'Workspace Index ready handler'],
      ['scheduleWorkspaceIndexRebuild', 'Workspace Index ready handler'],
    ].forEach(([key, name]) => wrapFunction(G, key, name));

    if (G.MME_TASK_REVIEW) {
      wrapFunction(G.MME_TASK_REVIEW, 'refresh', 'MME_TASK_REVIEW.refresh');
      wrapFunction(G.MME_TASK_REVIEW, 'setTaskScope', 'MME_TASK_REVIEW.setTaskScope');
    }
    if (G.MME_WIKI_LINKS) wrapFunction(G.MME_WIKI_LINKS, 'refresh', 'MME_WIKI_LINKS.refresh');
  }

  // --------------------------------------------------- mutation watch
  // §9: a MutationObserver records every later writer so "who changed it" is
  // answerable with evidence instead of by speculation.
  function describeRecord(type, target, attributeName, oldValue) {
    const el = target || {};
    const rawNew = el.getAttribute ? el.getAttribute(attributeName) : null;
    // For `hidden` the meaningful new value is the PROPERTY (what the owner
    // requested); the attribute is a boolean reflection whose new value is ''.
    const newValue = attributeName === 'hidden' && typeof el.hidden === 'boolean'
      ? String(el.hidden)
      : String(rawNew === null ? '' : rawNew);
    return {
      at: now(),
      type,
      id: el.id || '',
      class: el.classList ? Array.prototype.slice.call(el.classList).join(' ') : '',
      attr: attributeName || '',
      oldValue: typeof oldValue === 'string' ? oldValue.slice(0, 40) : null,
      newValue: newValue.slice(0, 40),
      phase: lastPhase.name,
    };
  }

  function watch() {
    if (observer || typeof MutationObserver === 'undefined') return observer;
    try {
      observer = new MutationObserver((records) => {
        records.forEach((r) => {
          mutations.push(describeRecord(
            r.type, r.target, r.attributeName, r.oldValue
          ));
          if (mutations.length > 500) mutations.shift();
        });
      });
      observer.observe(document.documentElement, {
        subtree: true,
        attributes: true,
        attributeFilter: ['hidden', 'class', 'style', 'aria-hidden', 'data-app-context',
          'data-journal-composition'],
        childList: true,
        characterData: false,
      });
    } catch (e) {
      observer = null;
    }
    return observer;
  }
  // ------------------------------------------------------ report / control
  function compare(before, after) {
    const a = new Set((before && before.hosts || []).filter((h) => h.effectiveVisible).map((h) => h.id));
    const b = new Set((after && after.hosts || []).filter((h) => h.effectiveVisible).map((h) => h.id));
    const becameVisible = Array.from(b).filter((id) => !a.has(id));
    const becameHidden = Array.from(a).filter((id) => !b.has(id));
    const contrast = { becameVisible, becameHidden, equal: becameVisible.length === 0 && becameHidden.length === 0 };
    if (typeof console !== 'undefined') {
      console.log('ACT4B compare("' + ((before && before.label) || '?') + '" -> "' +
        ((after && after.label) || '?') + '")', contrast);
    }
    return contrast;
  }

  function report() {
    const out = {
      snapshots: snapshots.slice(),
      mutations: mutations.slice(),
      contrastNoteVsWorkspace: null,
      contrastNeutralVsNote: null,
    };
    const findLabel = (prefix) => snapshots.find((s) => s.label.indexOf(prefix) === 0) || null;
    if (findLabel('B') && findLabel('C')) out.contrastNoteVsWorkspace = compare(findLabel('B'), findLabel('C'));
    if (findLabel('A') && findLabel('B')) out.contrastNeutralVsNote = compare(findLabel('A'), findLabel('B'));
    if (typeof console !== 'undefined' && console.log) {
      console.log('ACT4B report', JSON.parse(JSON.stringify(out)));
    }
    return out;
  }

  function installDevButton() {
    if (devButton || typeof document === 'undefined') return devButton;
    try {
      devButton = document.createElement('button');
      devButton.id = 'act4bProbeButton';
      devButton.type = 'button';
      devButton.textContent = 'ACT4B snapshot';
      devButton.setAttribute('aria-label', 'ACT 4B visibility snapshot (diagnostic)');
      devButton.style.cssText =
        'position:fixed;right:8px;bottom:8px;z-index:99999;font:12px monospace;' +
        'background:#111;color:#0f0;border:1px solid #0f0;padding:6px 8px;opacity:.85;';
      devButton.addEventListener('click', () => snapshot('manual ' + snapshots.length));
      document.body && document.body.appendChild(devButton);
    } catch (e) {
      devButton = null;
    }
    return devButton;
  }

  function removeDevButton() {
    if (!devButton) return;
    try { devButton.parentNode && devButton.parentNode.removeChild(devButton); } catch (e) {}
    devButton = null;
  }

  function stop() {
    stopped = true;
    if (observer) { try { observer.disconnect(); } catch (e) {} observer = null; }
    while (restores.length) {
      const restore = restores.pop();
      try { restore(); } catch (e) {}
    }
    removeDevButton();
    return { stopped: true, snapshots: snapshots.length, mutations: mutations.length };
  }

  function start() {
    if (stopped) return false;
    installPhaseMarkers();
    watch();
    return true;
  }

  if (typeof console !== 'undefined' && console.log) {
    console.log('ACT 4B visibility probe installed (read-only, diagnostic). ' +
      'Snapshot with __ACT4B_PROBE__.snapshot(label); scenario A/B/C/D then ' +
      '__ACT4B_PROBE__.report(); remove with __ACT4B_PROBE__.stop().');
  }
  start();

  globalThis[PROBE_KEY] = Object.freeze({
    snapshot,
    report,
    compare,
    watch,
    start,
    stop,
    installDevButton,
    removeDevButton,
    mutations,
    snapshots,
    watchedHostIds: registryIds,
    noteLocalHostIds: NOTE_LOCAL_IDS.slice(),
  });
})();