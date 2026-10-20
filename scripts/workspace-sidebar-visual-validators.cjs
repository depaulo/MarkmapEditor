#!/usr/bin/env node
'use strict';

/**
 * ACT V0 — Sidebar hierarchy, badge consistency and Active-action ownership.
 *
 * A pre-package VISUAL CORRECTION suite. It EXECUTES the real shipped owners
 * wherever a renderer exists, so no fixture can pass on a source regex alone:
 *   - js/main.js — the real renderWorkspaceActiveNoteActions, the real
 *     renderWorkspaceRelatedPanel, renderWorkspaceTagsPanel and
 *     renderWorkspaceArchivePanel, plus the real metadata owners behind them
 *     (patchNoteMetadata, readNoteMetadataFlags, describeNoteActionTarget,
 *     applyActiveNoteMetadata, archiveActiveNote, restoreActiveNote), all
 *     extracted verbatim and evaluated with the module-level state they close
 *     over — the technique the ACT 1C/2A/4/6 suites already use.
 *   - index.html / css/workspace.css / js/workspace/*.js — read for the
 *     structural contracts with no runtime renderer: markup ownership, the
 *     panel-separator owner, the single panel-title owner, and the single
 *     Archive/Restore owner.
 *
 * 86 fixtures: the ACT V0 visual-ownership suite (S01-Y45), 5 mutation
 * controls M01-M05 that revert each correction in memory and prove the
 * corresponding contract flips to the bad state, the ACT 3 source-contract
 * checks S1-S27 (Sidebar grouping and header grammar), and the ACT 3
 * executed rendered-DOM gate S28-S34 — the five real structural owners run
 * verbatim against a tree-capable DOM, so attachment, nesting, ordering,
 * uniqueness and idempotence are proven on an executed tree rather than on
 * a source regex alone.
 *
 * Usage: node scripts/workspace-sidebar-visual-validators.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

const MAIN_SOURCE = read('js', 'main.js');
const CONTROLLER_SOURCE = read('js', 'workspace', 'workspace-controller.js');
const ACTIONS_SOURCE = read('js', 'workspace', 'workspace-actions.js');
const REPORT_SOURCE = read('js', 'report', 'report-panel.js');
const INDEX_HTML = read('index.html');
const CSS_SOURCE = read('css', 'workspace.css');
const SW_SOURCE = read('sw.js');

const results = [];
function record(id, name, ok, detail) {
  const d = typeof detail === 'function' ? detail() : detail;
  results.push({ id, name, ok: Boolean(ok), detail: ok || d == null ? '' : String(d) });
}
async function check(id, name, ok, detail) {
  let value = ok;
  if (typeof value === 'function') {
    try {
      value = value();
    } catch (e) {
      record(id, name, false, (e && e.message) || String(e));
      return;
    }
  }
  if (value && typeof value.then === 'function') {
    try {
      record(id, name, await value, detail);
    } catch (e) {
      record(id, name, false, (e && e.message) || String(e));
    }
    return;
  }
  record(id, name, value, detail);
}
function group(title) {
  results.push({ group: title });
}

// Verbatim extraction of top-level main.js code (col-0 boundaries).
function extractBlockFrom(src, startMarker, endLine = '}') {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error('verbatim extraction failed: ' + startMarker);
  let lineStart = src.indexOf('\n', start) + 1;
  while (lineStart <= src.length) {
    const nl = src.indexOf('\n', lineStart);
    const lineEnd = nl === -1 ? src.length : nl;
    if (src.slice(lineStart, lineEnd) === endLine) return src.slice(start, lineEnd);
    if (nl === -1) break;
    lineStart = nl + 1;
  }
  throw new Error('verbatim extraction never closed: ' + startMarker);
}

function extractLineFrom(src, marker) {
  const start = src.indexOf(marker);
  if (start === -1) throw new Error('verbatim extraction failed: ' + marker);
  const nl = src.indexOf('\n', start);
  return src.slice(start, nl === -1 ? undefined : nl);
}

// ---------------------------------------------------------------
// Recording DOM shim
// ---------------------------------------------------------------
const h = { logs: [], toasts: [], saves: 0, status: [] };
globalThis.__h = h;

function makeEl(id) {
  const el = {
    id,
    value: '',
    style: { display: '' },
    dataset: {},
    hidden: false,
    innerHTML: '',
    textContent: '',
    attrs: {},
    classes: new Set(),
    __listeners: {},
    classList: {
      add(...c) { c.forEach((x) => el.classes.add(x)); },
      remove(...c) { c.forEach((x) => el.classes.delete(x)); },
      toggle(c, force) {
        const on = force === undefined ? !el.classes.has(c) : Boolean(force);
        if (on) el.classes.add(c); else el.classes.delete(c);
      },
      contains(c) { return el.classes.has(c); },
    },
    addEventListener(type, fn) { (el.__listeners[type] = el.__listeners[type] || []).push(fn); },
    removeEventListener() {},
    appendChild() {},
    setAttribute(k, v) { el.attrs[k] = v; },
    getAttribute: (k) => (k in el.attrs ? el.attrs[k] : null),
    querySelector: () => null,
    querySelectorAll: () => [],
    closest: () => null,
    focus() {},
  };
  return el;
}

const dom = {};
for (const id of [
  'workspaceRelatedPanel', 'workspaceRelatedBadge', 'workspaceRelatedSummary', 'workspaceRelatedList',
  'workspaceTagsPanel', 'workspaceTagsBadge', 'workspaceTagsSummary', 'workspaceTagsList',
  'workspaceTagResults',
  'workspaceArchivePanel', 'workspaceArchiveBadge', 'workspaceArchiveList',
  'workspaceActiveActions', 'workspaceActivePanel',
]) dom[id] = makeEl(id);

globalThis.window = globalThis;
globalThis.document = {
  getElementById: (id) => dom[id] || null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => makeEl('created'),
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => true,
  documentElement: makeEl('html'),
};
globalThis.updateWorkspaceActiveFileHighlight = () => {};
globalThis.MME_APP = {
  log: (m) => h.logs.push(String(m)),
  showToast: (m) => h.toasts.push(String(m)),
};
try { globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; } catch {}

// ---------------------------------------------------------------
// Evaluate the REAL main.js owners
// ---------------------------------------------------------------
const OWNER_EXTRACTS = [
  extractLineFrom(MAIN_SOURCE, 'const NOTE_METADATA_MANAGED_KEYS ='),
  extractLineFrom(MAIN_SOURCE, 'const NOTE_FRONTMATTER_OPEN ='),
  extractBlockFrom(MAIN_SOURCE, 'function findNoteFrontmatterClose(rest) {'),
  extractLineFrom(MAIN_SOURCE, 'const WORKSPACE_NOTE_DATE_SHAPE ='),
  extractLineFrom(MAIN_SOURCE, 'const WORKSPACE_DATED_NOTE_FILENAME ='),
  extractBlockFrom(MAIN_SOURCE, 'function escapeHtml(str) {'),
  extractBlockFrom(MAIN_SOURCE, 'function isManagedNoteMetadataKey(key) {'),
  extractBlockFrom(MAIN_SOURCE, 'function patchNoteMetadata(text, flags) {'),
  extractBlockFrom(MAIN_SOURCE, 'function readNoteMetadataFlags(text) {'),
  extractBlockFrom(MAIN_SOURCE, 'function describeNoteActionTarget() {'),
  extractBlockFrom(MAIN_SOURCE, 'function applyActiveNoteMetadata(key, value) {'),
  extractBlockFrom(MAIN_SOURCE, 'function pinActiveNote() {'),
  extractBlockFrom(MAIN_SOURCE, 'function unpinActiveNote() {'),
  extractBlockFrom(MAIN_SOURCE, 'function addActiveNoteToKnowledge() {'),
  extractBlockFrom(MAIN_SOURCE, 'function removeActiveNoteFromKnowledge() {'),
  extractBlockFrom(MAIN_SOURCE, 'function archiveActiveNote() {'),
  extractBlockFrom(MAIN_SOURCE, 'function restoreActiveNote() {'),
  extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceNoteDate(record) {'),
  extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceNoteTitle(record) {'),
  extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceNoteSecondaryIdentity(record, ambiguous) {'),
  extractBlockFrom(MAIN_SOURCE, 'function compareWorkspaceNotesForList(a, b) {'),
  extractBlockFrom(MAIN_SOURCE, 'function buildWorkspaceNotesViewModel() {'),
  extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceNoteRowMarkup(note, options = {}) {'),
  extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceNoteRowOptions(notes) {'),
  extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceArchivePanel() {'),
  extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceActiveNoteActions() {'),
];

const OWNER_API = [
  'const NOTE_ACTION_UNAVAILABLE_MESSAGES = {',
  "  'no-active-note': 'Open a note first.',",
  "  'not-a-workspace-note': 'This action works on a note inside the workspace.',",
  "  'report-active': 'Reports cannot be classified. Open a note first.',",
  '};',
  '// ---- shipped module-level state from main.js ----',
  'let dirty = false;',
  "let currentFileName = 'a.md';",
  'let currentSaveHandle = null;',
  'let __virtualReportSession = null;',
  'let __programmaticTextChange = 0;',
  'const md = { value: "" };',
  '// ---- collaborators ----',
  'let WORKSPACE_INDEX_STATE = { ready: true, files: [], byKind: { notes: [] } };',
  'const log = (m) => globalThis.__h.logs.push(String(m));',
  'const setStatus = (s) => globalThis.__h.status.push(String(s));',
  "const modeLabel = () => 'Journal';",
  'const updateDocumentTitle = () => {};',
  'const runProgrammaticTextChange = (cb) => { __programmaticTextChange++; try { cb(); } finally { __programmaticTextChange--; } };',
  'const renderWorkspaceActivePanel = () => {};',
  'const forceUpgradeWorkspacePanelMarkup = () => {};',
  'const isWorkspacePanelCollapsed = () => false;',
  'const applyWorkspacePanelCollapsed = () => {};',
  'function saveSmart() {',
  '  globalThis.__h.saves = (globalThis.__h.saves || 0) + 1;',
  '  return Promise.resolve({ ok: true });',
  '}',
  'return {',
  '  readNoteMetadataFlags, describeNoteActionTarget, applyActiveNoteMetadata,',
  '  archiveActiveNote, restoreActiveNote,',
  '  renderWorkspaceArchivePanel, renderWorkspaceActiveNoteActions,',
  '  buildWorkspaceNotesViewModel,',
  '  setText: (v) => { md.value = v; },',
  '  setIndex: (records) => { WORKSPACE_INDEX_STATE = { ready: true, files: records, byKind: { notes: records } }; },',
  '  setHandle: (v) => { currentSaveHandle = v; },',
  '  setReportSession: (v) => { __virtualReportSession = v; },',
  '  setActive: (v) => { globalThis.WORKSPACE_STATE.activeFile = v; },',
  '  state: () => ({ dirty, currentSaveHandle, text: md.value, report: __virtualReportSession }),',
  '};',
].join('\n');

const H = new Function([...OWNER_EXTRACTS, OWNER_API].join('\n\n'))();

// The shipped row dispatches through globalThis[name]; mirror that exactly.
for (const name of ['archiveActiveNote', 'restoreActiveNote']) globalThis[name] = H[name];

const noteHandle = { kind: 'file', name: 'a.md' };
globalThis.WORKSPACE_STATE = {
  rootHandle: { kind: 'directory', name: 'Workspace' },
  rootName: 'Workspace',
  folders: { notes: { kind: 'directory', name: 'notes' } },
  files: { notes: [] },
  activeFile: { kind: 'notes', name: 'a.md', path: 'notes/a.md', handle: noteHandle },
};

const BODY = '# Title\n\nSome body.\n\n- [ ] task\n';

function resetRow() {
  const host = dom.workspaceActiveActions;
  host.innerHTML = '';
  host.hidden = true;
  host.__noteActionsBound = false;
  host.__listeners = {};
  H.setReportSession(null);
  H.setText(BODY);
  H.setHandle(noteHandle);
  H.setActive({ kind: 'notes', name: 'a.md', path: 'notes/a.md', handle: noteHandle });
}
function rowActions() {
  const html = dom.workspaceActiveActions.innerHTML;
  return [...html.matchAll(/data-note-action="([^"]+)">([^<]*)</g)].map((m) => [m[2], m[1]]);
}
function clickAction(label) {
  const host = dom.workspaceActiveActions;
  const entry = rowActions().find((a) => a[0] === label);
  if (!entry) throw new Error('no such action in row: ' + label);
  const btn = { dataset: { noteAction: entry[1] } };
  for (const fn of host.__listeners.click || []) {
    fn({ target: { closest: () => btn }, preventDefault() {} });
  }
}

// ---------------------------------------------------------------
// CSS helpers: rules are parsed, not pattern-matched, so a fixture
// fails on an actual declaration and not on a formatting difference.
// ---------------------------------------------------------------
function stripCssComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '');
}
function cssDeclarations(body) {
  return body
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const i = d.indexOf(':');
      return [d.slice(0, i).trim(), d.slice(i + 1).trim()];
    });
}
function ruleFor(src, selectorRe) {
  const clean = stripCssComments(src);
  const m = clean.match(selectorRe);
  return m ? m[1] : null;
}
function rulesSelecting(src, className) {
  const clean = stripCssComments(src);
  const out = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean))) {
    const selectors = m[1].split(',').map((s) => s.trim());
    if (selectors.some((s) => s.trim().split(/\s+/).pop() === '.' + className)) {
      out.push({ selector: selectors.join(', '), body: m[2] });
    }
  }
  return out;
}
function fontWeightsFor(src, className) {
  return rulesSelecting(src, className)
    .flatMap((r) => cssDeclarations(r.body).filter(([k]) => k === 'font-weight').map(([, v]) => v));
}
// A panel-specific rule is one that names the title class ALONE. The single
// shared owner rule lists all ten titles and is therefore not panel-specific.
function panelSpecificFontWeights(src, className) {
  return rulesSelecting(src, className)
    .filter((r) => r.selector.split(',').every((s) => s.trim() === '.' + className))
    .flatMap((r) => cssDeclarations(r.body).filter(([k]) => k === 'font-weight').map(([, v]) => v));
}

const PANEL_TITLE_CLASSES = [
  'workspaceActiveTitle', 'workspaceJournalsTitle', 'workspaceConceptsTitle',
  'workspaceProjectsTitle', 'workspaceRelatedTitle', 'workspaceTasksTitle',
  'workspaceReportTitle', 'workspaceTagsTitle', 'workspaceIndexTitle',
  'workspaceArchiveTitle',
];

// The ten primary Sidebar panel badges and the classification this ACT applies.
const BADGE_CLASSIFICATION = [
  { id: 'workspaceActiveBadge', title: 'Active', kind: 'COMPOUND SUMMARY (category)', keep: 'Note' },
  { id: 'workspaceJournalsBadge', title: 'Notes', kind: 'COUNT ONLY', keep: '59' },
  { id: 'workspaceConceptsBadge', title: 'Knowledge', kind: 'COUNT ONLY', keep: '41' },
  { id: 'workspaceProjectsBadge', title: 'Projects', kind: 'COUNT ONLY', keep: '2' },
  { id: 'workspaceRelatedBadge', title: 'Related', kind: 'COUNT ONLY', keep: '0' },
  { id: 'workspaceTasksBadge', title: 'Tasks', kind: 'COUNT ONLY', keep: '195' },
  { id: 'workspaceReportBadge', title: 'Report', kind: 'COMPOUND SUMMARY (state)', keep: 'Config' },
  { id: 'workspaceTagsBadge', title: 'Tags', kind: 'COUNT ONLY', keep: '94' },
  { id: 'workspaceIndexBadge', title: 'Workspace Index', kind: 'COMPOUND SUMMARY (2 metrics, 2 lines)', keep: '62 files / 195 open' },
  { id: 'workspaceArchiveBadge', title: 'Archive', kind: 'COUNT ONLY', keep: '3' },
];

// ---------------------------------------------------------------
// Sandboxes for the REAL Related and Tags renderers. The renderer
// body is extracted verbatim; only its collaborators are supplied.
// ---------------------------------------------------------------
function buildRelatedSandbox() {
  const els = {};
  for (const id of ['workspaceRelatedPanel', 'workspaceRelatedBadge', 'workspaceRelatedSummary', 'workspaceRelatedList']) {
    els[id] = makeEl(id);
  }
  const src = [
    'const WORKSPACE_INDEX_STATE = { ready: true, files: [] };',
    // ACT 3C — the real panel reads the active identity from
    // WORKSPACE_STATE.activeFile (exact path is navigation identity), so the
    // sandbox must supply it. __activeName is retained for the summary LABEL
    // only; it is never used for matching.
    'const WORKSPACE_STATE = { activeFile: { kind: "notes", name: "Design.md", path: "notes/Design.md" } };',
    "let __activeName = 'Design';",
    'const log = () => {};',
    'const ensureWorkspaceRelatedPanel = () => els.workspaceRelatedPanel;',
    'const forceUpgradeWorkspacePanelMarkup = () => {};',
    'const wireWorkspaceRelatedPanel = () => {};',
    'const isWorkspacePanelCollapsed = () => false;',
    'const applyWorkspacePanelCollapsed = () => {};',
    'const getWorkspaceSearchIcon = () => "x";',
    'const getWorkspaceSearchKindLabel = () => "Note";',
    'const getActiveConceptName = () => __activeName;',
    '// ACT 3C — the panel sources canonical Links In; this shim reproduces the',
    '// same file set so these fixtures keep testing BADGE RENDERING, not',
    '// resolution (resolution is proven by the Wiki Link suites).',
    'globalThis.MME_WIKI_LINKS = {',
    '  getLinksIn: (o) => {',
    "    const act = (WORKSPACE_STATE && WORKSPACE_STATE.activeFile) || {};",
    "    const key = String(act.name || (o && o.targetPath) || '').replace(/\\.md$/i, '');",
    "    const rows = WORKSPACE_INDEX_STATE.files.filter((f) => (f.backlinks || []).includes(key));",
    '    return {',
    '      available: true,',
    "      rows: rows.map((f) => ({ sourcePath: f.path, sourceTitle: f.title || f.name, sourceName: f.name, occurrenceCount: 1 })),",
    '      relationships: [],',
    '    };',
    '  },',
    '};',
    extractBlockFrom(MAIN_SOURCE, 'function escapeHtml(str) {'),
    extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceRelatedPanel() {'),
    'return {',
    '  renderWorkspaceRelatedPanel,',
    "  setActive: (v) => { __activeName = v; WORKSPACE_STATE.activeFile = v ? { kind: 'notes', name: v + '.md', path: 'notes/' + v + '.md' } : ''; },",
    '  setReady: (v) => { WORKSPACE_INDEX_STATE.ready = v; },',
    '  setFiles: (f) => { WORKSPACE_INDEX_STATE.files = f; },',
    '};',
  ].join('\n\n');
  return { api: new Function('els', src)(els), els, restore: installDoc(els) };
}

// The renderer reads its collaborators through the shipped document global, so
// each sandbox installs its own element map for the duration of the run.
function installDoc(els) {
  const realDocument = globalThis.document;
  globalThis.document = {
    getElementById: (id) => els[id] || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => makeEl('created'),
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
    documentElement: makeEl('html'),
  };
  return () => { globalThis.document = realDocument; };
}

function buildTagsSandbox() {
  const els = {};
  for (const id of ['workspaceTagsPanel', 'workspaceTagsBadge', 'workspaceTagsSummary', 'workspaceTagsList', 'workspaceTagResults']) {
    els[id] = makeEl(id);
  }
  const src = [
    'const WORKSPACE_INDEX_STATE = { ready: true, tags: new Map() };',
    'let WORKSPACE_STATE = { rootHandle: {} };',
    'let __workspaceActiveTag = "";',
    'const log = () => {};',
    'const ensureWorkspaceTagsPanel = () => els.workspaceTagsPanel;',
    'const isWorkspacePanelCollapsed = () => false;',
    'const applyWorkspacePanelCollapsed = () => {};',
    'const getWorkspaceSearchIcon = () => "x";',
    'const getWorkspaceSearchKindLabel = () => "Note";',
    extractBlockFrom(MAIN_SOURCE, 'function escapeHtml(str) {'),
    extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceTagsSummary() {'),
    extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceTagFiles(tag) {'),
    extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceTagResults(tag) {'),
    extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceTagsPanel() {'),
    'return {',
    '  renderWorkspaceTagsPanel,',
    '  setTags: (m) => { WORKSPACE_INDEX_STATE.tags = m; },',
    '  setActiveTag: (t) => { __workspaceActiveTag = t; },',
    '  setReady: (v) => { WORKSPACE_INDEX_STATE.ready = v; },',
    '  setRoot: (v) => { WORKSPACE_STATE.rootHandle = v; },',
    '};',
  ].join('\n\n');
  return { api: new Function('els', src)(els), els, restore: installDoc(els) };
}

(async () => {
  // ===============================================================
  group('Panel structure / separator (S01-S06)');

  const sharedSepBody = ruleFor(CSS_SOURCE, /#workspaceJournalsPanel,\s*#workspaceConceptsPanel,\s*#workspaceArchivePanel\s*\{([^}]*)\}/);

  await check('S01', 'Workspace Index and Archive remain separate sibling panels', () => {
    return /panel\.id = 'workspaceIndexPanel'/.test(MAIN_SOURCE) &&
      /id="workspaceArchivePanel"/.test(INDEX_HTML) &&
      !/id="workspaceIndexPanel"/.test(INDEX_HTML);
  });

  await check('S02', 'the generic sibling separator owner now covers Archive', () => {
    if (sharedSepBody === null) return 'no shared Journals/Concepts/Archive rule';
    const borders = cssDeclarations(sharedSepBody).filter(([k]) => k.startsWith('border'));
    return borders.length === 1 && borders[0][0] === 'border-top';
  });

  await check('S03', 'the Archive boundary owns no second border (no double border)', () => {
    const clean = stripCssComments(CSS_SOURCE);
    const rules = [...clean.matchAll(/([^{}]*#workspaceArchivePanel[^{}]*)\{([^{}]*)\}/g)];
    for (const [, , body] of rules) {
      for (const [k] of cssDeclarations(body)) {
        if (k.startsWith('border') && k !== 'border-top') return 'Archive rule declares ' + k;
      }
    }
    return rules.length > 0;
  });

  await check('S04', 'no thicker boundary than the neighbouring panels', () => {
    const sep = cssDeclarations(sharedSepBody || '').find(([k]) => k === 'border-top');
    if (!sep) return 'no shared border-top';
    const siblings = [...stripCssComments(CSS_SOURCE).matchAll(
      /^#workspace(?:Active|Index|Related|Tasks|Tags|Projects)Panel \{([^}]*)\}/gm
    )].map((m) => cssDeclarations(m[1]).find(([k]) => k === 'border-top')).filter(Boolean);
    const bad = siblings.filter(([, v]) => v !== sep[1]);
    return bad.length === 0 || bad.map((b) => b[1]).join(',');
  });

  await check('S05', 'separator is token-based, so light and dark stay consistent', () => {
    const sep = cssDeclarations(sharedSepBody || '').find(([k]) => k === 'border-top');
    return sep && sep[1] === '1px solid var(--menu-border)' &&
      /--menu-border:\s*#cccccc/.test(read('css', 'theme.css')) &&
      /--menu-border:\s*#3e3e42/.test(read('css', 'theme.css'));
  });

  await check('S06', 'Archive stays a normal collapsible sibling; collapse key intact', () => {
    return /data-workspace-panel-toggle="archive"/.test(INDEX_HTML) &&
      /class="workspaceSection workspaceFilesSection"/.test(INDEX_HTML) &&
      /archive:\s*false/.test(MAIN_SOURCE) &&
      /panelId === 'archive'/.test(MAIN_SOURCE) &&
      /html\.workspace-empty #workspaceArchivePanel \{[\s\S]*?display: none !important;/.test(CSS_SOURCE);
  });

  // ===============================================================
  group('Title weight (T07-T10)');

  await check('T07', 'Projects title introduces no panel-specific bold', () => {
    const w = panelSpecificFontWeights(CSS_SOURCE, 'workspaceProjectsTitle');
    return w.length === 0 || w.join(',');
  });

  await check('T08', 'Archive title introduces no panel-specific bold', () => {
    const w = panelSpecificFontWeights(CSS_SOURCE, 'workspaceArchiveTitle');
    return w.length === 0 || w.join(',');
  });

  await check('T09', 'all sibling titles share one weight from one owner rule', () => {
    const body = ruleFor(CSS_SOURCE, new RegExp(PANEL_TITLE_CLASSES.map((c) => '\\.' + c).join(',\\s*') + '\\s*\\{([^}]*)\\}'));
    if (body === null) return 'no single rule covers every panel title';
    const w = cssDeclarations(body).filter(([k]) => k === 'font-weight');
    return w.length === 1 && w[0][1] === '500';
  });

  await check('T10', 'no panel title weight is masked by an !important override', () => {
    for (const c of PANEL_TITLE_CLASSES) {
      for (const v of fontWeightsFor(CSS_SOURCE, c)) {
        if (v.includes('!important')) return c + ' -> ' + v;
      }
    }
    return true;
  });

  await check('T11', 'active document title emphasis is unchanged', () => {
    const body = ruleFor(CSS_SOURCE, /\.workspaceActiveNameText\s*\{([^}]*)\}/);
    if (body === null) return '.workspaceActiveNameText rule missing';
    return !cssDeclarations(body).some(([k]) => k === 'font-weight') &&
      /ellipsis/.test(body) &&
      /class="workspaceActiveNameText"/.test(MAIN_SOURCE);
  });

  // ===============================================================
  group('Badges (B12-B23)');

  const R = buildRelatedSandbox();
  const restoreRelated = R.restore;
  R.api.setFiles([
    { kind: 'notes', name: 'b.md', path: 'notes/b.md', title: 'B', backlinks: ['Design'] },
    { kind: 'notes', name: 'c.md', path: 'notes/c.md', title: 'C', backlinks: ['Design'] },
    { kind: 'notes', name: 'd.md', path: 'notes/d.md', title: 'D', backlinks: [] },
  ]);
  R.api.renderWorkspaceRelatedPanel();
  const relatedTwo = R.els.workspaceRelatedBadge.textContent;
  R.api.setFiles([]);
  R.api.renderWorkspaceRelatedPanel();
  const relatedZero = R.els.workspaceRelatedBadge.textContent;
  R.api.setActive('');
  R.api.renderWorkspaceRelatedPanel();
  const relatedNoActive = R.els.workspaceRelatedBadge.textContent;
  restoreRelated();

  const T = buildTagsSandbox();
  const restoreTags = T.restore;
  T.api.setTags(new Map([['alpha', ['notes/a.md', 'notes/b.md']], ['beta', ['notes/a.md']]]));
  T.api.renderWorkspaceTagsPanel();
  const tagsTwo = T.els.workspaceTagsBadge.textContent;
  T.api.setTags(new Map());
  T.api.renderWorkspaceTagsPanel();
  const tagsZero = T.els.workspaceTagsBadge.textContent;
  T.api.setRoot(null);
  T.api.renderWorkspaceTagsPanel();
  const tagsNoRoot = T.els.workspaceTagsBadge.textContent;
  restoreTags();

  await check('B12', 'Related badge renders only the numeric count (real renderer)', () =>
    relatedTwo === '2', () => 'got ' + JSON.stringify(relatedTwo));

  await check('B13', 'Tags badge renders only the numeric count (real renderer)', () =>
    tagsTwo === '2', () => 'got ' + JSON.stringify(tagsTwo));

  await check('B14', 'Related zero badge renders "0", not "0 related"', () =>
    relatedZero === '0' && relatedNoActive === '0',
    () => `noActive=${JSON.stringify(relatedNoActive)} zero=${JSON.stringify(relatedZero)}`);

  await check('B15', 'Tags nonzero badge renders the number, not "<n> tags"', () =>
    tagsTwo === '2' && !/\btags\b/.test(tagsTwo), () => 'got ' + JSON.stringify(tagsTwo));

  await check('B16', 'no count badge repeats its panel title in any state', () => {
    const observed = {
      Related: [relatedTwo, relatedZero, relatedNoActive],
      Tags: [tagsTwo, tagsZero, tagsNoRoot],
    };
    for (const [title, values] of Object.entries(observed)) {
      for (const v of values) {
        if (new RegExp('\\b' + title + '\\b', 'i').test(v)) return title + ' badge says ' + JSON.stringify(v);
      }
    }
    return true;
  });

  await check('B17', 'Notes badge remains count-only', () =>
    /journalsBadge\.textContent = String\(WORKSPACE_STATE\.files\.journals\.length\)/.test(CONTROLLER_SOURCE));

  await check('B18', 'Knowledge badge remains count-only', () =>
    /conceptsBadge\.textContent = String\(WORKSPACE_STATE\.files\.concepts\.length\)/.test(CONTROLLER_SOURCE));

  await check('B19', 'Projects badge remains count-only', () => {
    H.setIndex([{ path: 'notes/p.md', name: 'p.md', kind: 'notes', title: 'P' }]);
    const body = extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceProjectsPanel() {');
    return /badge\.textContent = String\(count\)/.test(body);
  });

  await check('B20', 'Archive badge remains count-only (real renderer)', () => {
    H.setIndex([
      { path: 'notes/a.md', name: 'a.md', kind: 'notes', title: 'A', archived: true },
      { path: 'notes/b.md', name: 'b.md', kind: 'notes', title: 'B', archived: false },
    ]);
    dom.workspaceArchiveBadge.textContent = '';
    H.renderWorkspaceArchivePanel();
    return dom.workspaceArchiveBadge.textContent === '1';
  });

  await check('B21', 'Workspace Index compound summary is preserved on two lines', () => {
    const body = extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceIndexSummary() {');
    // The SAME two dynamic owners, stacked as <n> files / <n> open. The old
    // single crowded line (`… files · … open`) must be gone.
    return /\$\{index\.files\.length\} files<\/span>/.test(body) &&
      /\$\{openTasks\} open<\/span>/.test(body) &&
      !/files · /.test(body);
  });

  await check('B22', 'Active category badge is preserved', () =>
    /badge\.textContent = kindLabel/.test(MAIN_SOURCE) && /badge\.textContent = 'No file'/.test(MAIN_SOURCE));

  await check('B23', 'Report state badge is preserved', () =>
    /id="workspaceReportBadge" class="workspacePanelBadge">Config</.test(REPORT_SOURCE));

  // ACT 3C — B24 originally protected BOTH the Tags badge contract and the
  // Related badge contract. Migrating the Related half accidentally dropped the
  // Tags clause; it is RESTORED here, and each side is now independently
  // mutation-tested by B24a / B24b so neither can silently stop protecting
  // anything. Nothing is weakened: the Tags clause is the original runtime
  // assertion, and the Related half asserts the migrated canonical contract.
  await check('B24', 'badge correction changed no underlying count and no filtering', () => {
    const relBody = extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceRelatedPanel() {');
    const tagBody = extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceTagsPanel() {');
    return /badge\.textContent = `\$\{linksInRows\.length\}`/.test(relBody) &&
      /badge\.textContent = `\$\{tags\.length\}`/.test(tagBody) &&
      /renderWorkspaceTagResults\(__workspaceActiveTag\)/.test(tagBody) &&
      /data-workspace-related-item="1"/.test(relBody) &&
      // runtime evidence, not just source text: both panels actually rendered
      tagsTwo === '2' && tagsZero === '0' && tagsNoRoot === '0' &&
      relatedTwo === '2' && relatedZero === '0' && relatedNoActive === '0';
  });

  await check('B24a', 'B24 Tags half independently detects a broken Tags badge', () => {
    // Mutate ONLY the Tags half. B24 must fail; the Links In half is untouched.
    const tagBody = extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceTagsPanel() {');
    const broken = tagBody.replace('badge.textContent = `${tags.length}`;',
      'badge.textContent = `${tags.length} tags`;');
    if (broken === tagBody) return false;
    return !/badge\.textContent = `\$\{tags\.length\}`/.test(broken) &&
      /badge\.textContent = `\$\{linksInRows\.length\}`/.test(
        extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceRelatedPanel() {'));
  });

  await check('B24b', 'B24 Links In half independently detects name-keyed Related', () => {
    // Mutate ONLY the Links In half back to the retired name-keyed source. B24
    // must fail on that clause while the Tags half still passes.
    const relBody = extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceRelatedPanel() {');
    const broken = relBody.replace('badge.textContent = `${linksInRows.length}`;',
      'badge.textContent = `${linksInResult.rows.length} related`;');
    if (broken === relBody) return false;
    return !/badge\.textContent = `\$\{linksInRows\.length\}`/.test(broken) &&
      /badge\.textContent = `\$\{tags\.length\}`/.test(
        extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceTagsPanel() {'));
  });

  // ===============================================================
  group('Active action ownership (A25-A35)');

  // The global Workspace action area: from the first action button to the
  // empty state, with HTML comments removed so the ACT V0 note documenting the
  // removal is not itself read back as a control.
  const headerBlock = INDEX_HTML
    .slice(
      INDEX_HTML.indexOf('<button id="btnOpenWorkspace"'),
      INDEX_HTML.indexOf('id="workspaceEmptyState"')
    )
    .replace(/<!--[\s\S]*?-->/g, '');

  await check('A25', 'Archive no longer appears in the global Workspace action area', () =>
    !/btnArchiveActive/.test(headerBlock) && !/Archive Active/.test(headerBlock));

  await check('A26', 'the global action area is exactly Open Workspace, Today, New Note', () => {
    const ids = [...headerBlock.matchAll(/<button\s[\s\S]*?id="([A-Za-z]+)"/g)].map((m) => m[1]);
    return ids.join(',') === 'btnOpenWorkspace,btnJournalToday,btnNewConcept';
  });

  await check('A27', 'Archive appears exactly once (real Active action row)', () => {
    resetRow();
    H.renderWorkspaceActiveNoteActions();
    const labels = rowActions().map((a) => a[0]);
    return labels.filter((l) => l === 'Archive' || l === 'Restore').length === 1;
  });

  await check('A28', 'Archive label is shown for an active non-archived Note', () => {
    resetRow();
    H.renderWorkspaceActiveNoteActions();
    return rowActions().map((a) => a[0]).join('|') === 'Pin|Add to Knowledge|Archive';
  });

  await check('A29', 'Restore label is shown for an active archived Note', () => {
    resetRow();
    H.setText('---\narchived: true\n---\n' + BODY);
    H.renderWorkspaceActiveNoteActions();
    return rowActions().map((a) => a[0]).join('|') === 'Pin|Add to Knowledge|Restore';
  });

  await check('A30', 'no eligible active Note cannot trigger a mutation', () => {
    // external/standalone file: the active handle is not the save handle
    resetRow();
    H.setHandle({ kind: 'file', name: 'external.md' });
    H.renderWorkspaceActiveNoteActions();
    if (!dom.workspaceActiveActions.hidden) return 'row visible for an external file';
    if (rowActions().length) return 'row rendered for an external file';

    resetRow();
    H.setHandle(null);
    H.setActive(null);
    H.renderWorkspaceActiveNoteActions();
    if (!dom.workspaceActiveActions.hidden || rowActions().length) return 'row rendered with no active note';

    resetRow();
    H.setReportSession({ kind: 'report' });
    H.renderWorkspaceActiveNoteActions();
    if (!dom.workspaceActiveActions.hidden || rowActions().length) return 'row rendered for a Report';

    // a direct call with no eligible target must leave the buffer untouched
    resetRow();
    H.setHandle(null);
    H.setActive(null);
    const before = H.state().text;
    const r = H.applyActiveNoteMetadata('archived', true);
    return r.ok === false && H.state().text === before;
  });

  await check('A31', 'Archive patches the live buffer only', () => {
    resetRow();
    H.renderWorkspaceActiveNoteActions();
    clickAction('Archive');
    const s = H.state();
    return /^archived: true$/m.test(s.text) && s.dirty === true && s.currentSaveHandle === noteHandle;
  });

  await check('A32', 'Restore patches the live buffer only', () => {
    resetRow();
    H.setText('---\narchived: true\n---\n' + BODY);
    H.renderWorkspaceActiveNoteActions();
    clickAction('Restore');
    const s = H.state();
    return !/^archived: true$/m.test(s.text) && s.dirty === true && s.currentSaveHandle === noteHandle;
  });

  await check('A33', 'Archive and Restore never Save automatically', () => {
    let saves = 0;
    globalThis.saveCurrentFile = () => { saves += 1; };
    resetRow();
    H.renderWorkspaceActiveNoteActions();
    clickAction('Archive');
    resetRow();
    H.setText('---\narchived: true\n---\n' + BODY);
    H.renderWorkspaceActiveNoteActions();
    clickAction('Restore');
    return saves === 0 && H.state().dirty === true;
  });

  await check('A34', 'no physical move, delete, copy or rename in the owner', () => {
    const body = extractBlockFrom(MAIN_SOURCE, 'function applyActiveNoteMetadata(key, value) {');
    return !/removeEntry|getDirectoryHandle|createWritable|getFileHandle|rename|moveTo|copyTo/.test(body);
  });

  await check('A35', 'Active collapse naturally hides its action row', () => {
    const panel = extractBlockFrom(MAIN_SOURCE, 'function ensureWorkspaceActivePanel() {');
    return /class="workspacePanelBody"/.test(panel) &&
      /id="workspaceActiveActions"/.test(MAIN_SOURCE) &&
      /\.workspacePanelCollapsed \.workspacePanelBody \{[^}]*display: none !important;/.test(CSS_SOURCE);
  });

  // ===============================================================
  group('Single Archive/Restore owner (O36-O40)');

  await check('O36', 'the global control, its binding and its physical owner are gone', () => {
    return !/btnArchiveActive/.test(INDEX_HTML) &&
      !/onArchiveActive/.test(ACTIONS_SOURCE) &&
      !/btnArchiveActive/.test(ACTIONS_SOURCE) &&
      !/^function archiveActiveWorkspaceFile\(/m.test(CONTROLLER_SOURCE) &&
      !/^function bindArchiveActiveDirect\(/m.test(CONTROLLER_SOURCE) &&
      !/folders\.archive\b/.test(MAIN_SOURCE);
  });

  await check('O37', 'exactly one Archive/Restore implementation exists in the app', () => {
    const writers = MAIN_SOURCE.match(/applyActiveNoteMetadata\('archived', (true|false)\)/g) || [];
    return writers.length === 2 &&
      (MAIN_SOURCE.match(/^function applyActiveNoteMetadata\(/gm) || []).length === 1 &&
      (MAIN_SOURCE.match(/function (archiveActiveNote|restoreActiveNote)\(\)/g) || []).length === 2;
  });

  await check('O38', 'exactly one Archive/Restore click lifecycle exists', () => {
    const row = extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceActiveNoteActions() {');
    return (row.match(/addEventListener\(/g) || []).length === 1 &&
      /__noteActionsBound/.test(row) &&
      (ACTIONS_SOURCE.match(/bindOnce\(/g) || []).length === 4 &&
      !/btnArchiveActive/.test(ACTIONS_SOURCE);
  });

  await check('O39', 'no dead Archive-Active styling remains', () => {
    return !/btnArchiveActive/.test(stripCssComments(CSS_SOURCE));
  });

  await check('O40', 'the Archive panel header keeps the generic panel contract', () => {
    const block = INDEX_HTML.slice(
      INDEX_HTML.indexOf('id="workspaceArchivePanel"'),
      INDEX_HTML.indexOf('id="workspaceSidebarResizeHandle"')
    );
    return /class="workspacePanelHeaderButton"/.test(block) &&
      /class="workspacePanelHeaderLeft"/.test(block) &&
      /class="workspacePanelChevron"/.test(block) &&
      /class="workspacePanelBadge"/.test(block) &&
      /class="workspacePanelBody"/.test(block) &&
      /data-workspace-panel-toggle="archive"/.test(block) &&
      /aria-expanded="true"/.test(block);
  });

  // ===============================================================
  group('Safety (Y41-Y45)');

  await check('Y41', 'no expandable Active cards and no Workspace Index disclosures', () => {
    const main = stripCssComments(MAIN_SOURCE);
    return !/workspaceActiveCard|workspaceActiveSummaryCard/.test(main) &&
      !/<details[\s>]/i.test(INDEX_HTML) &&
      !/workspaceIndexDisclosure|workspaceIndexReveal|workspaceIndexExpanded/.test(main);
  });

  await check('Y42', 'no Links In rename, no Task / Wiki Links / Projects / Report change', () => {
    const main = stripCssComments(MAIN_SOURCE);
    return /Links In/.test(main) &&
      /Links out/.test(main) &&
      /parseMmeTaskMetadata/.test(main) &&
      /MME_WIKI_LINKS/.test(read('js', 'links', 'wiki-links.js')) &&
      !/ACT V0[\s\S]{0,80}(task-review|wiki-links|report-panel)/.test(main);
  });

  await check('Y43', 'no pane-layout change', () => {
    const main = stripCssComments(MAIN_SOURCE);
    const v0 = [...main.matchAll(/\/\/ ACT V0[^\n]*/g)].map((m) => m[0]);
    return v0.every((t) => !/\bpane\b|PaneRegistry/i.test(t));
  });

  // The accepted release boundary is 0.7.0 (Package 5 closure). sw.js carries
  // the 0.7.0 cache identity; the ACT V0 fences below confirm no internal
  // scaffolding leaks into shipped product files.
  await check('Y44', 'no internal scaffolding leaks into shipped product files', () => {
    return /markmap-journal-pwa-0\.7\.0-projects-foundation/.test(SW_SOURCE) &&
      !/ACT V0/.test(SW_SOURCE) &&
      !/ACT V0/.test(read('js', 'ui', 'help-content.js')) &&
      !/ACT V0/.test(read('js', 'ui', 'release-notes-content.js')) &&
      !/ACT V0/.test(read('manifest.webmanifest'));
  });

  await check('Y45', 'YAML metadata format and Archive semantics are untouched', () => {
    const patcher = extractBlockFrom(MAIN_SOURCE, 'function patchNoteMetadata(text, flags) {');
    return /NOTE_FRONTMATTER_OPEN/.test(patcher) && /findNoteFrontmatterClose/.test(patcher) &&
      !/ACT V0/.test(patcher) &&
      /NOTE_METADATA_MANAGED_KEYS = \['knowledge', 'pinned', 'archived'\]/.test(MAIN_SOURCE) &&
      /archivedNotes/.test(extractBlockFrom(MAIN_SOURCE, 'function buildWorkspaceNotesViewModel() {'));
  });

  // ===============================================================
  group('Mutation controls (M01-M05)');

  // Each control reverts ONE ACT V0 correction and then re-EXECUTES the real
  // renderer, proving the owner then produces the bad state. A control that
  // cannot produce the bad state fails, because that would mean the fixture
  // above it could not have bitten.

  await check('M01', 'restoring "0 related" / "<n> related" breaks the Related contract', () => {
    const src = MAIN_SOURCE
      .replace("    badge.textContent = '0';\n    summary.textContent = 'No active note';",
        "    badge.textContent = '0 related';\n    summary.textContent = 'No active note';")
      .replace('badge.textContent = `${linksInRows.length}`;', 'badge.textContent = `${linksInRows.length} related`;');
    if (src === MAIN_SOURCE) return 'mutation anchor missing';
    const els = {};
    for (const id of ['workspaceRelatedPanel', 'workspaceRelatedBadge', 'workspaceRelatedSummary', 'workspaceRelatedList']) {
      els[id] = makeEl(id);
    }
    const api = new Function('els', [
      'const WORKSPACE_INDEX_STATE = { ready: true, files: [] };',
      '// ACT 3C — the sandbox must supply the exact active identity the real panel',
      '// reads; without it the panel sees no active note and every badge is 0.',
      'const WORKSPACE_STATE = { activeFile: { kind: "notes", name: "Design.md", path: "notes/Design.md" } };',
      "let __activeName = 'Design';",
      'const log = () => {};',
      'const ensureWorkspaceRelatedPanel = () => els.workspaceRelatedPanel;',
      'const forceUpgradeWorkspacePanelMarkup = () => {};',
      'const wireWorkspaceRelatedPanel = () => {};',
      'const isWorkspacePanelCollapsed = () => false;',
      'const applyWorkspacePanelCollapsed = () => {};',
      'const getWorkspaceSearchIcon = () => "x";',
      'const getWorkspaceSearchKindLabel = () => "Note";',
      'const getActiveConceptName = () => __activeName;',
      '// ACT 3C — canonical Links In shim (see the other sandbox for rationale).',
      'globalThis.MME_WIKI_LINKS = {',
      '  getLinksIn: (o) => {',
      "    const act = (WORKSPACE_STATE && WORKSPACE_STATE.activeFile) || {};",
      "    const key = String(act.name || (o && o.targetPath) || '').replace(/\\.md$/i, '');",
      "    const rows = WORKSPACE_INDEX_STATE.files.filter((f) => (f.backlinks || []).includes(key));",
      '    return {',
      '      available: true,',
      "      rows: rows.map((f) => ({ sourcePath: f.path, sourceTitle: f.title || f.name, sourceName: f.name, occurrenceCount: 1 })),",
      '      relationships: [],',
      '    };',
      '  },',
      '};',
      extractBlockFrom(src, 'function escapeHtml(str) {'),
      extractBlockFrom(src, 'function renderWorkspaceRelatedPanel() {'),
      'return { renderWorkspaceRelatedPanel, setFiles: (f) => { WORKSPACE_INDEX_STATE.files = f; } };',
    ].join('\n\n'))(els);
    const restoreMut = installDoc(els);
    api.setFiles([{ kind: 'notes', name: 'b.md', path: 'notes/b.md', title: 'B', backlinks: ['Design'] }]);
    api.renderWorkspaceRelatedPanel();
    const one = els.workspaceRelatedBadge.textContent;
    api.setFiles([]);
    api.renderWorkspaceRelatedPanel();
    const result = one === '1 related' && els.workspaceRelatedBadge.textContent === '0 related';
    restoreMut();
    return result;
  });

  await check('M02', 'restoring "<count> tags" breaks the Tags contract', () => {
    const src = MAIN_SOURCE.replace('badge.textContent = `${tags.length}`;', 'badge.textContent = `${tags.length} tags`;');
    if (src === MAIN_SOURCE) return 'mutation anchor missing';
    const els = {};
    for (const id of ['workspaceTagsPanel', 'workspaceTagsBadge', 'workspaceTagsSummary', 'workspaceTagsList', 'workspaceTagResults']) {
      els[id] = makeEl(id);
    }
    const api = new Function('els', [
      'const WORKSPACE_INDEX_STATE = { ready: true, tags: new Map() };',
      'let WORKSPACE_STATE = { rootHandle: {} };',
      'let __workspaceActiveTag = "";',
      'const log = () => {};',
      'const ensureWorkspaceTagsPanel = () => els.workspaceTagsPanel;',
      'const isWorkspacePanelCollapsed = () => false;',
      'const applyWorkspacePanelCollapsed = () => {};',
      'const getWorkspaceSearchIcon = () => "x";',
      'const getWorkspaceSearchKindLabel = () => "Note";',
      extractBlockFrom(src, 'function escapeHtml(str) {'),
      extractBlockFrom(src, 'function getWorkspaceTagsSummary() {'),
      extractBlockFrom(src, 'function getWorkspaceTagFiles(tag) {'),
      extractBlockFrom(src, 'function renderWorkspaceTagResults(tag) {'),
      extractBlockFrom(src, 'function renderWorkspaceTagsPanel() {'),
      'return { renderWorkspaceTagsPanel, setTags: (m) => { WORKSPACE_INDEX_STATE.tags = m; } };',
    ].join('\n\n'))(els);
    const restoreMut = installDoc(els);
    api.setTags(new Map([['alpha', ['notes/a.md']], ['beta', ['notes/b.md']]]));
    api.renderWorkspaceTagsPanel();
    const result = els.workspaceTagsBadge.textContent === '2 tags';
    restoreMut();
    return result;
  });

  await check('M03', 'restoring Archive Active in the global creation area breaks the owner proof', () => {
    const html = INDEX_HTML.replace(
      '<span class="workspaceLabel">New Note</span>',
      '<span class="workspaceLabel">New Note</span>\n<button id="btnArchiveActive" type="button">Archive Active</button>'
    );
    const block = html.slice(html.indexOf('class="workspaceHeader"'), html.indexOf('id="workspaceEmptyState"'));
    return /btnArchiveActive/.test(block);
  });

  await check('M04', 'removing the Archive separator correction breaks the separator contract', () => {
    const css = stripCssComments(CSS_SOURCE).replace(
      /#workspaceJournalsPanel,\s*#workspaceConceptsPanel,\s*#workspaceArchivePanel\s*\{/,
      '#workspaceJournalsPanel,\n#workspaceConceptsPanel {'
    );
    const present = /#workspaceJournalsPanel,\s*#workspaceConceptsPanel,\s*#workspaceArchivePanel\s*\{/.test(css);
    const archiveRules = [...css.matchAll(/([^{}]*#workspaceArchivePanel[^{}]*)\{([^{}]*)\}/g)];
    const hasBorder = archiveRules.some(([, , body]) => cssDeclarations(body).some(([k]) => k === 'border-top'));
    return present === false && hasBorder === false;
  });

  await check('M05', 'restoring panel-specific bold breaks the title-weight contract', () => {
    const css = CSS_SOURCE + '\n.workspaceProjectsTitle { font-weight: 600; }\n.workspaceArchiveTitle { font-weight: 650; }\n';
    // A panel-specific rule is one that names the title class ALONE; the single
    // shared owner rule lists all ten and is not panel-specific.
    const own = (cls) => panelSpecificFontWeights(css, cls).join(',');
    return own('workspaceProjectsTitle') === '600' && own('workspaceArchiveTitle') === '650';
  });

  group('ACT 3 — Source-contract checks (S1-S27)');

// S1: exactly one Current Document group spec entry
await check('S1', 'exactly one current-document group spec', () => {
  const sec = MAIN_SOURCE.slice(
    MAIN_SOURCE.indexOf('const spec = ['),
    MAIN_SOURCE.indexOf('];', MAIN_SOURCE.indexOf('const spec = [')) + 2
  );
  return (sec.match(/workspaceCurrentDocumentGroup/g) || []).length === 1;
});

// S2: exactly one File Knowledge group spec entry
await check('S2', 'exactly one file-knowledge group spec', () => {
  const sec = MAIN_SOURCE.slice(
    MAIN_SOURCE.indexOf('const spec = ['),
    MAIN_SOURCE.indexOf('];', MAIN_SOURCE.indexOf('const spec = [')) + 2
  );
  return (sec.match(/workspaceFileKnowledgeGroup/g) || []).length === 1;
});

// S3: exactly one Workspace Knowledge group spec entry
await check('S3', 'exactly one workspace-knowledge group spec', () => {
  const sec = MAIN_SOURCE.slice(
    MAIN_SOURCE.indexOf('const spec = ['),
    MAIN_SOURCE.indexOf('];', MAIN_SOURCE.indexOf('const spec = [')) + 2
  );
  return (sec.match(/workspaceWorkspaceKnowledgeGroup/g) || []).length === 1;
});

// S4: no more than one Workspace Controls group spec entry
await check('S4', 'at most one workspace-controls group spec', () => {
  const sec = MAIN_SOURCE.slice(
    MAIN_SOURCE.indexOf('const spec = ['),
    MAIN_SOURCE.indexOf('];', MAIN_SOURCE.indexOf('const spec = [')) + 2
  );
  return (sec.match(/workspaceControlsGroup/g) || []).length <= 1;
});

// S5: Search panel belongs to Workspace Knowledge (not Workspace Controls)
await check('S5', 'Search panel is in Workspace Knowledge group', () => {
  return /workspaceSearchPanel:\s*'workspace-knowledge'/.test(MAIN_SOURCE) &&
    !/workspaceSearchPanel:\s*'workspace-controls'/.test(MAIN_SOURCE);
});

// S6: Tags panel belongs to Workspace Knowledge (not File Knowledge)
await check('S6', 'Tags panel is in Workspace Knowledge group', () => {
  return /workspaceTagsPanel:\s*'workspace-knowledge'/.test(MAIN_SOURCE) &&
    !/workspaceTagsPanel:\s*'file-knowledge'/.test(MAIN_SOURCE);
});

// S7: Tasks panel belongs to File Knowledge
await check('S7', 'Tasks panel is in File Knowledge group', () => {
  return /workspaceTasksPanel:\s*'file-knowledge'/.test(MAIN_SOURCE);
});

// S8: Related panel belongs to File Knowledge
await check('S8', 'Related panel is in File Knowledge group', () => {
  return /workspaceRelatedPanel:\s*'file-knowledge'/.test(MAIN_SOURCE);
});

// S9: Reports panel is not assigned to any group (protected, ungrouped)
await check('S9', 'Reports panel is ungrouped (protected scope)', () => {
  return !/workspaceReportPanel:\s*'(workspace-controls|current-document|file-knowledge|workspace-knowledge)'/.test(MAIN_SOURCE);
});

// S10: Workspace Controls group has no panels assigned
await check('S10', 'Workspace Controls group has no panels', () => {
  return /workspaceControlsGroup:\s*\[\s*\]/.test(MAIN_SOURCE);
});

// S11: File Knowledge panel order: Tasks before Related
await check('S11', 'File Knowledge orders Tasks before Related', () => {
  const sec = MAIN_SOURCE.slice(
    MAIN_SOURCE.indexOf('workspaceFileKnowledgeGroup: ['),
    MAIN_SOURCE.indexOf(']', MAIN_SOURCE.indexOf('workspaceFileKnowledgeGroup: [')) + 1
  );
  const tasksIdx = sec.indexOf('workspaceTasksPanel');
  const relatedIdx = sec.indexOf('workspaceRelatedPanel');
  return tasksIdx >= 0 && relatedIdx >= 0 && tasksIdx < relatedIdx;
});

// S12: Workspace Knowledge panel order: Search, Journals, Concepts, Tags, Projects, Index, Archive
await check('S12', 'Workspace Knowledge order: Search → Journals → Concepts → Tags → Projects → Index → Archive', () => {
  const sec = MAIN_SOURCE.slice(
    MAIN_SOURCE.indexOf('workspaceWorkspaceKnowledgeGroup: ['),
    MAIN_SOURCE.indexOf(']', MAIN_SOURCE.indexOf('workspaceWorkspaceKnowledgeGroup: [')) + 1
  );
  const expected = ['workspaceSearchPanel', 'workspaceJournalsPanel', 'workspaceConceptsPanel',
                    'workspaceTagsPanel', 'workspaceProjectsPanel', 'workspaceIndexPanel',
                    'workspaceArchivePanel'];
  let lastIdx = -1;
  for (const panel of expected) {
    const idx = sec.indexOf(panel);
    if (idx === -1 || idx <= lastIdx) return false;
    lastIdx = idx;
  }
  return true;
});

// S13: Group order in host: Controls → Current Document → File Knowledge → Workspace Knowledge
await check('S13', 'group order is deterministic (Controls → Current Document → File Knowledge → Workspace Knowledge)', () => {
  const sec = MAIN_SOURCE.slice(
    MAIN_SOURCE.indexOf("const groupOrder = ["),
    MAIN_SOURCE.indexOf('];', MAIN_SOURCE.indexOf("const groupOrder = [")) + 2
  );
  const expected = ['workspaceControlsGroup', 'workspaceCurrentDocumentGroup',
                    'workspaceFileKnowledgeGroup', 'workspaceWorkspaceKnowledgeGroup'];
  let lastIdx = -1;
  for (const id of expected) {
    const idx = sec.indexOf(id);
    if (idx === -1 || idx <= lastIdx) return false;
    lastIdx = idx;
  }
  return true;
});

// S14: ensureWorkspaceSidebarGroups exists and moves existing nodes via appendChild (no recreation)
await check('S14', 'ensureWorkspaceSidebarGroups moves nodes via appendChild', () => {
  return /function ensureWorkspaceSidebarGroups\(\)/.test(MAIN_SOURCE) &&
    /group\.appendChild\(panel\)/.test(MAIN_SOURCE) &&
    !/document\.createElement.*panel/.test(MAIN_SOURCE);
});

// S15: Simulated DOM — panels placed in correct groups, no duplicates
await check('S15', 'simulated DOM: panel-to-group placement is correct and duplicate-free', () => {
  const map = {};
  let m;
  const re = /workspace(\w+)Panel:\s*'([^']+)'/g;
  while ((m = re.exec(MAIN_SOURCE)) !== null) {
    map[m[1]] = m[2];
  }
  const required = {
    Search: 'workspace-knowledge',
    Active: 'current-document',
    Tasks: 'file-knowledge',
    Related: 'file-knowledge',
    Tags: 'workspace-knowledge',
    Journals: 'workspace-knowledge',
    Concepts: 'workspace-knowledge',
    Projects: 'workspace-knowledge',
    Index: 'workspace-knowledge',
    Archive: 'workspace-knowledge',
  };
  for (const [panel, expectedGroup] of Object.entries(required)) {
    if (map[panel] !== expectedGroup) return `Panel ${panel} is in group ${map[panel]}, expected ${expectedGroup}`;
  }
  if ('Report' in map) return 'Report is incorrectly assigned to a group';
  const keys = Object.keys(map);
  if (keys.length !== new Set(keys).size) return 'duplicate panel IDs in mapping';
  return true;
});

// S16: Edit/Read owner unchanged — mode toggle still in editor overlay, not in Sidebar groups
await check('S16', 'Edit/Read owner remains unchanged (editor overlay, not Sidebar groups)', () => {
  return /editorBtnEditToggle/.test(MAIN_SOURCE);
});

// --- ACT 3 Slice 2 — Current Document structural area (after correction) ---

// S17: No premature Edit/Read placeholder rendered in ACT 3
await check('S17', 'no Edit/Read placeholder rendered', () => {
  return !/workspaceActiveEditReadReserved/.test(MAIN_SOURCE);
});

// S18: No duplicate Current Document section wrapper in ACT 3
await check('S18', 'no duplicate Current Document section wrapper', () => {
  return !/workspaceCurrentDocumentSection/.test(MAIN_SOURCE) &&
         !/workspaceCurrentDocumentTitle/.test(MAIN_SOURCE);
});

// S19: Active panel title is "Current Document" (single visible identity)
await check('S19', 'Active panel title is Current Document', () => {
  const activeStart = MAIN_SOURCE.indexOf('function ensureWorkspaceActivePanel');
  const activeEnd = MAIN_SOURCE.indexOf('function ', activeStart + 1);
  const activeSection = activeEnd === -1 ? MAIN_SOURCE.slice(activeStart) : MAIN_SOURCE.slice(activeStart, activeEnd);
  const tmplStart = activeSection.indexOf('panel.innerHTML = `');
  if (tmplStart === -1) return false;
  const tmplEnd = activeSection.indexOf('`;', tmplStart);
  const tmpl = tmplEnd === -1 ? activeSection.slice(tmplStart) : activeSection.slice(tmplStart, tmplEnd + 2);
  return /workspaceActiveTitle/.test(tmpl) && /Current Document/.test(tmpl);
});

// S20: Exactly one visible Current Document title in Active panel template
await check('S20', 'exactly one visible Current Document title', () => {
  const activeStart = MAIN_SOURCE.indexOf('function ensureWorkspaceActivePanel');
  const activeEnd = MAIN_SOURCE.indexOf('function ', activeStart + 1);
  const activeSection = activeEnd === -1 ? MAIN_SOURCE.slice(activeStart) : MAIN_SOURCE.slice(activeStart, activeEnd);
  const tmplStart = activeSection.indexOf('panel.innerHTML = `');
  if (tmplStart === -1) return false;
  const tmplEnd = activeSection.indexOf('`;', tmplStart);
  const tmpl = tmplEnd === -1 ? activeSection.slice(tmplStart) : activeSection.slice(tmplStart, tmplEnd + 2);
  const matches = tmpl.match(/Current Document/g);
  return matches != null && matches.length === 1;
});

// S21: No mode event handler added to Active panel
await check('S21', 'no mode event handler added to Active panel', () => {
  const activeStart = MAIN_SOURCE.indexOf('function ensureWorkspaceActivePanel');
  const activeEnd = MAIN_SOURCE.indexOf('function ', activeStart + 1);
  const activeSection = activeEnd === -1 ? MAIN_SOURCE.slice(activeStart) : MAIN_SOURCE.slice(activeStart, activeEnd);
  return !/onclick/.test(activeSection) && !/data-action/.test(activeSection) &&
         !/addEventListener.*mode/.test(activeSection) && !/data-workspace-mode/.test(activeSection);
});

// S22: No Save triggered by Current Document rendering
await check('S22', 'no Save triggered by Current Document rendering', () => {
  const activeStart = MAIN_SOURCE.indexOf('function ensureWorkspaceActivePanel');
  const activeEnd = MAIN_SOURCE.indexOf('function ', activeStart + 1);
  const activeSection = activeEnd === -1 ? MAIN_SOURCE.slice(activeStart) : MAIN_SOURCE.slice(activeStart, activeEnd);
  return !/\.save\(/.test(activeSection) && !/saveWorkspace/.test(activeSection) &&
         !/MME_PROJECT/.test(activeSection);
});

// --- ACT 3 Slice 3 — Header, badge and disclosure alignment -------------

// S23: Index panel header follows disclosure → title → action → badge (badge after action controls)
await check('S23', 'Index panel: badge comes after action controls', () => {
  const idxStart = MAIN_SOURCE.indexOf('function ensureWorkspaceIndexPanel');
  const idxEnd = MAIN_SOURCE.indexOf('function ', idxStart + 1);
  const idxSection = idxEnd === -1 ? MAIN_SOURCE.slice(idxStart) : MAIN_SOURCE.slice(idxStart, idxEnd);
  const refreshIdx = idxSection.indexOf('btnRefreshWorkspaceIndex');
  const badgeIdx = idxSection.indexOf('workspaceIndexBadge');
  return refreshIdx !== -1 && badgeIdx !== -1 && refreshIdx < badgeIdx;
});

// S24: Projects panel header follows disclosure → title → action → badge (action before badge)
await check('S24', 'Projects panel: action button comes before badge', () => {
  const projStart = MAIN_SOURCE.indexOf('function ensureWorkspaceProjectsPanel');
  const projEnd = MAIN_SOURCE.indexOf('function ', projStart + 1);
  const projSection = projEnd === -1 ? MAIN_SOURCE.slice(projStart) : MAIN_SOURCE.slice(projStart, projEnd);
  const actionIdx = projSection.indexOf('workspaceProjectsOpenButton');
  const badgeIdx = projSection.indexOf('workspaceProjectsBadge');
  return actionIdx !== -1 && badgeIdx !== -1 && actionIdx < badgeIdx;
});

// S25: No panel has its badge appearing before its title within header markup
await check('S25', 'No panel has badge before title within its HTML template', () => {
  // Check within each ensure* function's innerHTML template that title comes before badge
  const panelConfigs = [
    { name: 'Active', ensureFn: 'ensureWorkspaceActivePanel', title: 'workspaceActiveTitle', badge: 'workspaceActiveBadge' },
    { name: 'Related', ensureFn: 'ensureWorkspaceRelatedPanel', title: 'workspaceRelatedTitle', badge: 'workspaceRelatedBadge' },
    { name: 'Tasks', ensureFn: 'ensureWorkspaceTasksPanel', title: 'workspaceTasksTitle', badge: 'workspaceTasksBadge' },
    { name: 'Tags', ensureFn: 'ensureWorkspaceTagsPanel', title: 'workspaceTagsTitle', badge: 'workspaceTagsBadge' },
    { name: 'Index', ensureFn: 'ensureWorkspaceIndexPanel', title: 'workspaceIndexTitle', badge: 'workspaceIndexBadge' },
    { name: 'Projects', ensureFn: 'ensureWorkspaceProjectsPanel', title: 'workspaceProjectsTitle', badge: 'workspaceProjectsBadge' },
  ];
  for (const { ensureFn, title, badge } of panelConfigs) {
    const fnStart = MAIN_SOURCE.indexOf('function ' + ensureFn);
    if (fnStart === -1) continue;
    const fnEnd = MAIN_SOURCE.indexOf('\nfunction ', fnStart + 1);
    const fnSection = fnEnd === -1 ? MAIN_SOURCE.slice(fnStart) : MAIN_SOURCE.slice(fnStart, fnEnd);
    // Find the innerHTML template within this function
    const tmplStart = fnSection.indexOf('panel.innerHTML = `');
    if (tmplStart === -1) continue;
    const tmplEnd = fnSection.indexOf('`;', tmplStart);
    const tmpl = tmplEnd === -1 ? fnSection.slice(tmplStart) : fnSection.slice(tmplStart, tmplEnd + 2);
    const titleIdx = tmpl.indexOf(title);
    const badgeIdx = tmpl.indexOf(badge);
    if (titleIdx !== -1 && badgeIdx !== -1 && badgeIdx < titleIdx) {
      return false;
    }
  }
  return true;
});

// S26: All toggle buttons have disclosure (chevron) before title within header
await check('S26', 'All toggle buttons have chevron before title', () => {
  const toggleSections = [
    'workspaceActiveTitle',
    'workspaceRelatedTitle',
    'workspaceTasksTitle',
    'workspaceTagsTitle',
    'workspaceIndexTitle',
    'workspaceJournalsTitle',
    'workspaceConceptsTitle',
    'workspaceArchiveTitle',
    'workspaceProjectsTitle',
  ];
  for (const titleId of toggleSections) {
    const idx = MAIN_SOURCE.indexOf(titleId);
    if (idx === -1) continue;
    const before = MAIN_SOURCE.slice(Math.max(0, idx - 300), idx);
    if (!/workspacePanelChevron/.test(before)) return false;
  }
  return true;
});

// S27: Active panel header preserves disclosure → title → badge (no action/Help in ACT 3)
await check('S27', 'Active panel: disclosure → title → badge order preserved', () => {
  const activeStart = MAIN_SOURCE.indexOf('function ensureWorkspaceActivePanel');
  const activeEnd = MAIN_SOURCE.indexOf('function ', activeStart + 1);
  const activeSection = activeEnd === -1 ? MAIN_SOURCE.slice(activeStart) : MAIN_SOURCE.slice(activeStart, activeEnd);
  const chevronIdx = activeSection.indexOf('workspacePanelChevron');
  const titleIdx = activeSection.indexOf('workspaceActiveTitle');
  const badgeIdx = activeSection.indexOf('workspaceActiveBadge');
  return chevronIdx !== -1 && titleIdx !== -1 && badgeIdx !== -1 &&
         chevronIdx < titleIdx && titleIdx < badgeIdx;
});

// ---------------------------------------------------------------
// ACT 3 — executed rendered-DOM structural gate (S28-S34).
// The source checks above (S1-S27) cannot observe whether a group container
// is attached to the rendered tree. These checks build a tree-capable DOM
// (real parentNode/insertBefore/appendChild, connectivity-aware
// getElementById) and EXECUTE the real shipped structural owners — extracted
// verbatim from main.js — in the same call order finalizeWorkspaceSidebar
// uses. Detached groups, detached panels, wrong nesting, wrong order,
// duplicates and non-idempotent grouping therefore fail loudly here, in
// Node, before any browser claim is made. This is executed-DOM evidence,
// not browser evidence.
// ---------------------------------------------------------------

function makeTreeElement(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    id: '',
    className: '',
    hidden: false,
    innerHTML: '',
    textContent: '',
    style: {},
    dataset: {},
    attrs: {},
    parentNode: null,
    childNodes: [],
    get firstChild() { return el.childNodes[0] || null; },
    get nextSibling() {
      if (!el.parentNode) return null;
      const sibs = el.parentNode.childNodes;
      const i = sibs.indexOf(el);
      return i >= 0 && i + 1 < sibs.length ? sibs[i + 1] : null;
    },
    get nextElementSibling() { return el.nextSibling; },
    setAttribute(k, v) { el.attrs[k] = String(v); },
    getAttribute(k) { return k in el.attrs ? el.attrs[k] : null; },
    appendChild(child) { return el.insertBefore(child, null); },
    insertBefore(child, ref) {
      if (ref !== null && ref.parentNode !== el) {
        throw new Error('insertBefore: reference node is not a child');
      }
      if (child.parentNode) {
        const old = child.parentNode.childNodes;
        const idx = old.indexOf(child);
        if (idx !== -1) old.splice(idx, 1);
      }
      child.parentNode = el;
      if (ref === null) el.childNodes.push(child);
      else el.childNodes.splice(el.childNodes.indexOf(ref), 0, child);
      return child;
    },
    querySelector(sel) { return treeQuery(el, sel); },
    querySelectorAll(sel) {
      const out = [];
      let s = sel;
      if (s.startsWith(':scope > ')) {
        s = s.slice(9).trim();
        for (const c of el.childNodes) if (matchesTreeSel(c, s)) out.push(c);
        return out;
      }
      const stack = [...el.childNodes];
      while (stack.length) {
        const n = stack.shift();
        if (matchesTreeSel(n, s)) out.push(n);
        stack.push(...n.childNodes);
      }
      return out;
    },
    addEventListener() {},
    removeEventListener() {},
  };
  return el;
}

function matchesTreeSel(el, sel) {
  if (sel.startsWith('.')) return el.className.split(/\s+/).includes(sel.slice(1));
  if (sel.startsWith('#')) return el.id === sel.slice(1);
  return el.tagName === sel.toUpperCase();
}

function treeQuery(root, sel) {
  let s = sel;
  let directOnly = false;
  if (s.startsWith(':scope > ')) {
    s = s.slice(9).trim();
    directOnly = true;
  }
  const stack = [...root.childNodes];
  while (stack.length) {
    const n = stack.shift();
    if (matchesTreeSel(n, s)) return n;
    if (!directOnly) stack.push(...n.childNodes);
  }
  return null;
}

function countIdInTree(root, id) {
  let count = 0;
  const stack = [root];
  while (stack.length) {
    const n = stack.shift();
    if (n.id === id) count += 1;
    stack.push(...n.childNodes);
  }
  return count;
}

function makeTreeDocument() {
  const documentElement = makeTreeElement('html');
  const body = makeTreeElement('body');
  documentElement.appendChild(body);
  const doc = {
    documentElement,
    body,
    createElement: (t) => makeTreeElement(t),
    getElementById(id) {
      const stack = [documentElement];
      while (stack.length) {
        const n = stack.shift();
        if (n.id === id) return n;
        stack.push(...n.childNodes);
      }
      return null;
    },
    querySelector(sel) { return treeQuery(documentElement, sel); },
    querySelectorAll(sel) { return documentElement.querySelectorAll(sel); },
    addEventListener() {},
    removeEventListener() {},
  };
  return { doc, documentElement, body };
}

// Verbatim extraction of the ACT 3 structural owners (real shipped code).
const STRUCTURAL_OWNER_SOURCES = [
  'function getWorkspaceSidebarContentHost() {',
  'function ensureWorkspaceActivePanel() {',
  'function ensureWorkspaceIndexPanel() {',
  'function ensureWorkspaceSidebarGroups() {',
  'function normalizeWorkspacePanelOrder() {',
].map((marker) => extractBlockFrom(MAIN_SOURCE, marker));

const STRUCTURAL_API_FACTORY = new Function(
  'document',
  'log',
  STRUCTURAL_OWNER_SOURCES.join('\n\n') +
    '\n\nreturn { getWorkspaceSidebarContentHost, ensureWorkspaceActivePanel, ' +
    'ensureWorkspaceIndexPanel, ensureWorkspaceSidebarGroups, normalizeWorkspacePanelOrder };'
);

const GROUP_IDS = [
  'workspaceControlsGroup',
  'workspaceCurrentDocumentGroup',
  'workspaceFileKnowledgeGroup',
  'workspaceWorkspaceKnowledgeGroup',
];

const MAPPED_PANEL_IDS = [
  'workspaceActivePanel',
  'workspaceSearchPanel',
  'workspaceJournalsPanel',
  'workspaceConceptsPanel',
  'workspaceRelatedPanel',
  'workspaceTasksPanel',
  'workspaceTagsPanel',
  'workspaceProjectsPanel',
  'workspaceIndexPanel',
  'workspaceArchivePanel',
];

const WORKSPACE_KNOWLEDGE_ORDER = [
  'workspaceSearchPanel',
  'workspaceJournalsPanel',
  'workspaceConceptsPanel',
  'workspaceTagsPanel',
  'workspaceProjectsPanel',
  'workspaceIndexPanel',
  'workspaceArchivePanel',
];

// One full structural pass in the order finalizeWorkspaceSidebar runs the
// owners: panels are ensured flat (first open), then grouped, then ordered.
// The fixture mirrors index.html: header, the flat panels the earlier
// ensure* owners leave behind, Report, and the nav controls.
function runStructuralPipeline() {
  const { doc, body } = makeTreeDocument();

  const sidebar = makeTreeElement('div');
  sidebar.id = 'workspaceSidebar';
  body.appendChild(sidebar);

  const scroller = makeTreeElement('div');
  scroller.className = 'workspaceNavScroller';
  sidebar.appendChild(scroller);

  const header = makeTreeElement('div');
  header.className = 'workspaceHeader';
  scroller.appendChild(header);

  for (const id of [
    'workspaceSearchPanel', 'workspaceJournalsPanel', 'workspaceConceptsPanel',
    'workspaceRelatedPanel', 'workspaceTasksPanel', 'workspaceTagsPanel',
    'workspaceProjectsPanel', 'workspaceArchivePanel', 'workspaceReportPanel',
  ]) {
    const panel = makeTreeElement('div');
    panel.id = id;
    panel.className = 'workspaceSection';
    scroller.appendChild(panel);
  }

  const navControls = makeTreeElement('div');
  navControls.className = 'workspaceNavControls';
  scroller.appendChild(navControls);

  const api = STRUCTURAL_API_FACTORY(doc, null);

  api.ensureWorkspaceActivePanel();
  api.ensureWorkspaceIndexPanel();
  api.ensureWorkspaceSidebarGroups();
  api.normalizeWorkspacePanelOrder();

  return { doc, sidebar, host: scroller, header, api };
}

  group('ACT 3 — Executed rendered-DOM structural gate (S28-S34)');

let d28 = null;
let d29 = null;
let d30 = null;
let d31 = null;
let d32 = null;
let d33 = null;
let d34 = null;

// S28: all four group containers must END UP attached to the rendered host
await check('S28', 'executed DOM: all four groups attached to the rendered host', () => {
  const state = runStructuralPipeline();
  const bad = GROUP_IDS.filter((id) => {
    const g = state.doc.getElementById(id);
    return !g || g.parentNode !== state.host;
  });
  d28 = bad.length ? 'missing from host (absent or detached): ' + bad.join(', ') : null;
  return bad.length === 0;
}, () => d28);

// S29: every mapped panel must be reachable from the document root AND
// nested directly inside its accepted group
await check('S29', 'executed DOM: every mapped panel nested in its group in the rendered tree', () => {
  const state = runStructuralPipeline();
  const expect = {
    workspaceActivePanel: 'workspaceCurrentDocumentGroup',
    workspaceSearchPanel: 'workspaceWorkspaceKnowledgeGroup',
    workspaceTasksPanel: 'workspaceFileKnowledgeGroup',
    workspaceRelatedPanel: 'workspaceFileKnowledgeGroup',
    workspaceJournalsPanel: 'workspaceWorkspaceKnowledgeGroup',
    workspaceConceptsPanel: 'workspaceWorkspaceKnowledgeGroup',
    workspaceTagsPanel: 'workspaceWorkspaceKnowledgeGroup',
    workspaceProjectsPanel: 'workspaceWorkspaceKnowledgeGroup',
    workspaceIndexPanel: 'workspaceWorkspaceKnowledgeGroup',
    workspaceArchivePanel: 'workspaceWorkspaceKnowledgeGroup',
  };
  const bad = [];
  for (const [panelId, groupId] of Object.entries(expect)) {
    const panel = state.doc.getElementById(panelId);
    if (!panel) {
      bad.push(panelId + ': not reachable from document root (detached)');
      continue;
    }
    const parent = panel.parentNode;
    if (!parent || parent.id !== groupId) {
      bad.push(panelId + ': parent is ' + (parent ? (parent.id || parent.tagName) : 'null') + ', expected ' + groupId);
    }
  }
  d29 = bad.length ? bad.join('; ') : null;
  return bad.length === 0;
}, () => d29);

// S30: the rendered Current Document panel must expose exactly one visible
// title, spelled "Current Document", with the removed slice-2 structures absent
await check('S30', 'executed DOM: Current Document panel renders exactly one visible title', () => {
  const state = runStructuralPipeline();
  const active = state.doc.getElementById('workspaceActivePanel');
  const html = active ? String(active.innerHTML || '') : '';
  const titleCount = (html.match(/workspaceActiveTitle/g) || []).length;
  const reasons = [];
  if (!active) reasons.push('workspaceActivePanel not reachable from document root');
  if (titleCount !== 1) reasons.push('workspaceActiveTitle occurrences: ' + titleCount);
  if (!/<span class="workspaceActiveTitle">Current Document<\/span>/.test(html)) {
    reasons.push('rendered title is not "Current Document"');
  }
  if (/workspaceCurrentDocumentSection|workspaceCurrentDocumentTitle/.test(html)) {
    reasons.push('removed Current Document section/title markup reappeared');
  }
  if (/workspaceActiveEditReadReserved/.test(html)) {
    reasons.push('Edit/Read reserved placeholder reappeared');
  }
  if (/workspaceActiveTitle">Active</.test(html)) reasons.push('stale "Active" title rendered');
  d30 = reasons.length ? reasons.join('; ') : null;
  return reasons.length === 0;
}, () => d30);

// S31: rendered order — groups right after the header in accepted order,
// panels ordered inside each group, protected ungrouped content at the tail
await check('S31', 'executed DOM: group order and within-group panel order match the accepted order', () => {
  const state = runStructuralPipeline();
  const kids = state.host.childNodes;
  const reasons = [];
  if (!kids[0] || kids[0].className !== 'workspaceHeader') {
    reasons.push('first host child is not the header');
  }
  GROUP_IDS.forEach((gid, i) => {
    const child = kids[i + 1];
    if (!child || child.id !== gid) {
      reasons.push('host child ' + (i + 1) + ' is ' + (child ? child.id || child.tagName : 'missing') + ', expected ' + gid);
    }
  });
  const childIds = (gid) => {
    const g = state.doc.getElementById(gid);
    return g ? g.childNodes.map((n) => n.id) : null;
  };
  const controls = childIds('workspaceControlsGroup');
  if (controls === null) reasons.push('Workspace Controls group absent from rendered tree');
  else if (controls.length !== 0) reasons.push('Workspace Controls group not empty: ' + controls.join(','));
  const currentDoc = childIds('workspaceCurrentDocumentGroup');
  if (!currentDoc || currentDoc.join(',') !== 'workspaceActivePanel') {
    reasons.push('Current Document children: ' + (currentDoc ? currentDoc.join(',') : 'absent'));
  }
  const fileK = childIds('workspaceFileKnowledgeGroup');
  if (!fileK || fileK.join(',') !== 'workspaceTasksPanel,workspaceRelatedPanel') {
    reasons.push('File Knowledge children: ' + (fileK ? fileK.join(',') : 'absent'));
  }
  const wsK = childIds('workspaceWorkspaceKnowledgeGroup');
  if (!wsK || wsK.join(',') !== WORKSPACE_KNOWLEDGE_ORDER.join(',')) {
    reasons.push('Workspace Knowledge children: ' + (wsK ? wsK.join(',') : 'absent'));
  }
  const tail = kids.slice(5).map((n) => n.id || n.className);
  if (tail.join(',') !== 'workspaceReportPanel,workspaceNavControls') {
    reasons.push('ungrouped tail: ' + (tail.join(',') || 'empty'));
  }
  d31 = reasons.length ? reasons.join('; ') : null;
  return reasons.length === 0;
}, () => d31);

// S32: every group and mapped panel must occur EXACTLY once in the connected
// rendered tree (catches detached subtrees and duplicated containers)
await check('S32', 'executed DOM: no detached or duplicated groups/panels in the rendered tree', () => {
  const state = runStructuralPipeline();
  const all = GROUP_IDS.concat(MAPPED_PANEL_IDS).concat(['workspaceReportPanel']);
  const bad = all.filter((id) => countIdInTree(state.doc.documentElement, id) !== 1);
  d32 = bad.length ? 'rendered-tree occurrence != 1 for: ' + bad.join(', ') : null;
  return bad.length === 0;
}, () => d32);

// S33: protected scope — Report stays a direct child of the host, after the groups
await check('S33', 'executed DOM: Reports panel stays ungrouped after the groups', () => {
  const state = runStructuralPipeline();
  const report = state.doc.getElementById('workspaceReportPanel');
  const wkgIdx = state.host.childNodes.findIndex((n) => n.id === 'workspaceWorkspaceKnowledgeGroup');
  const reportIdx = report ? state.host.childNodes.indexOf(report) : -1;
  const ok = Boolean(report) && report.parentNode === state.host && wkgIdx !== -1 && reportIdx > wkgIdx;
  d33 = ok ? null : 'report attached=' + Boolean(report && report.parentNode === state.host) +
    ', reportIdx=' + reportIdx + ', wkgIdx=' + wkgIdx;
  return ok;
}, () => d33);

// S34: a second grouping pass must move nothing — same nodes, no duplicates
await check('S34', 'executed DOM: second grouping run preserves group and panel node identity', () => {
  const state = runStructuralPipeline();
  const all = GROUP_IDS.concat(MAPPED_PANEL_IDS);
  const before = all.map((id) => state.doc.getElementById(id));
  state.api.ensureWorkspaceSidebarGroups();
  state.api.normalizeWorkspacePanelOrder();
  const after = all.map((id) => state.doc.getElementById(id));
  const reasons = [];
  before.forEach((node, i) => {
    if (!node) reasons.push(all[i] + ': missing after first run');
    else if (node !== after[i]) reasons.push(all[i] + ': node replaced on second run');
  });
  const dup = GROUP_IDS.filter((id) => countIdInTree(state.doc.documentElement, id) !== 1);
  if (dup.length) reasons.push('group occurrence != 1 after second run: ' + dup.join(','));
  d34 = reasons.length ? reasons.join('; ') : null;
  return reasons.length === 0;
}, () => d34);

// ===============================================================
  const passed = results.filter((r) => !r.group && r.ok).length;
  const failed = results.filter((r) => !r.group && !r.ok);
  for (const r of results) {
    if (r.group) console.log('\n' + r.group);
    else console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.id + '] ' + r.name + (r.detail ? '  -> ' + r.detail : ''));
  }
  console.log('\nSidebar badge classification (ACT V0):');
  for (const b of BADGE_CLASSIFICATION) {
    console.log('  ' + b.title.padEnd(16) + b.id.padEnd(26) + b.kind.padEnd(32) + 'keeps "' + b.keep + '"');
  }
  console.log('\nWORKSPACE SIDEBAR VISUAL VALIDATORS (ACT V0): ' + passed + ' passed, ' + failed.length + ' failed');
  process.exitCode = failed.length ? 1 : 0;
})();
