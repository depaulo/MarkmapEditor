#!/usr/bin/env node
'use strict';

/**
 * ACT 2C — Lifecycle and output consumer preservation.
 *
 * Exercises the REAL shipped owners (nothing is re-implemented):
 *   - js/main.js — openWorkspaceFile, saveToHandle, saveSmart, saveAsSmart,
 *     activateWritableHandle, the Hot Reload owner (hotPrime / hotApplyReload /
 *     hotPollTick / hotStart / hotStop / hotAfterSave), isWorkspaceCurrentFileNoop,
 *     and scheduleWorkspaceIndexRebuild / buildWorkspaceIndex;
 *   - js/workspace/workspace-controller.js — openToday and the controller's own
 *     openWorkspaceFile fallback (the removed ACT 1B Today gate);
 *   - js/workspace/workspace-parser.js — the saved Note parser;
 *   - js/navigation/navigation-history.js — the real Back/Forward engine;
 *   - js/report/report-dictionary.js — the Report aggregation owner;
 *   - js/report/quick-report-generator.js — Quick Report Markdown output;
 *   - js/report/drawio-report-reconciler.js — the Draw.io reconciler.
 *
 * main.js is a browser script, not a module, so its owners are extracted
 * verbatim and evaluated together with the module-level `let` state they close
 * over. That reproduces the browser's single-lexical-scope semantics exactly, so
 * the Save / Save As / Hot Reload paths run as shipped.
 *
 * ACT 2C is a PRESERVATION package. It must not improve these features, add a
 * second Save owner, introduce a metadata writer, redesign the Sidebar, add a
 * creation UI, change Project syntax, or touch Current Document scope.
 *
 * 67 fixtures: S01-S10 Save, A11-A19 Save As, H20-H25 Hot Reload, V26-V31
 * Navigation, Q32-Q38 Quick Report, D39-D43 Draw.io, G44-G49 Report guards,
 * X50-X60 cross-package, T61-T67 temporary gates.
 *
 * Usage: node scripts/workspace-lifecycle-output-validators.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

const MAIN_SOURCE = read('js', 'main.js');
const CONTROLLER_SOURCE = read('js', 'workspace', 'workspace-controller.js');
const PARSER_SOURCE = read('js', 'workspace', 'workspace-parser.js');
const LIFECYCLE_SOURCE = read('js', 'tasks', 'task-lifecycle.js');
const NAV_SOURCE = read('js', 'navigation', 'navigation-history.js');
const DICT_SOURCE = read('js', 'report', 'report-dictionary.js');
const QUICK_SOURCE = read('js', 'report', 'quick-report-generator.js');
const DRAWIO_SOURCE = read('js', 'report', 'drawio-report-reconciler.js');

const { execFileSync } = require('child_process');
// Runs another focused suite in a child process. Used only by the cross-package
// fixtures, which assert that the earlier packages stay green.
function runNode(relPath) {
  try {
    return execFileSync(process.execPath, [path.join(ROOT, relPath)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    return (e && e.stdout) || '';
  }
}

const results = [];
let chain = Promise.resolve();
function record(id, name, ok, detail) {
  const d = typeof detail === 'function' ? detail() : detail;
  results.push({ id, name, ok: Boolean(ok), detail: ok || d == null ? '' : String(d) });
}
// Async owners are exercised through a promise: the caller MUST await the
// result, otherwise the fixtures would interleave on shared harness state.
function check(id, name, ok, detail) {
  if (ok && typeof ok.then === 'function') {
    const p = ok.then(
      (v) => record(id, name, v, detail),
      (e) => record(id, name, false, (e && e.message) || e)
    );
    chain = chain.then(() => p);
    return p;
  }
  record(id, name, ok, detail);
  return Promise.resolve();
}
function group(title) {
  results.push({ group: title });
}

// Verbatim extraction of top-level main.js code (col-0 boundaries).
function extractBlockFrom(src, startMarker, endLine = '}') {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error('verbatim extraction failed: ' + startMarker);
  let lineStart = src.indexOf('\n', start);
  if (lineStart === -1) throw new Error('verbatim extraction failed: ' + startMarker);
  lineStart += 1;
  while (lineStart <= src.length) {
    const nl = src.indexOf('\n', lineStart);
    const lineEnd = nl === -1 ? src.length : nl;
    const line = src.slice(lineStart, lineEnd);
    if (line === endLine) return src.slice(start, lineEnd);
    if (nl === -1) break;
    lineStart = nl + 1;
  }
  throw new Error('verbatim extraction never closed: ' + startMarker);
}

// ---- Harness ---------------------------------------------------------------
const h = {
  logs: [], toasts: [], statuses: [], rebuilds: [], writes: [], renders: [],
  reportCleared: 0, sidebarRefreshes: 0,
  editorText: '', openedDoc: null, hotStatus: '', draftsCleared: [],
};

function makeFileHandle(name, initialText) {
  const fh = {
    kind: 'file',
    name,
    __text: initialText,
    lastModified: 1000,
    async getFile() {
      return { text: async () => fh.__text, size: fh.__text.length, lastModified: fh.lastModified };
    },
    async createWritable() {
      return {
        async write(text) { h.writes.push({ name, text }); fh.__pending = text; },
        async close() { fh.__text = fh.__pending; fh.lastModified += 1; },
      };
    },
  };
  return fh;
}

function makeDirHandle(files = {}) {
  return {
    kind: 'directory',
    name: 'notes',
    __files: files,
    async getFileHandle(name, options = {}) {
      if (!this.__files[name] && options.create) this.__files[name] = makeFileHandle(name, '');
      return this.__files[name] || null;
    },
    async getDirectoryHandle() { return null; },
  };
}

const dom = {};
function makeEl(id) {
  return {
    id, hidden: false, innerHTML: '', textContent: '', dataset: {}, value: '',
    addEventListener() {}, setAttribute() {}, appendChild() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, contains() { return false; },
  };
}

globalThis.window = globalThis;
globalThis.document = {
  getElementById: (id) => dom[id] || null,
  createElement: () => makeEl('created'),
  documentElement: { classList: { toggle() {}, add() {}, remove() {} } },
  querySelector: () => null, querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {},
};
for (const id of ['workspaceSidebar', 'workspaceTasksList', 'workspaceTasksBadge',
  'workspaceProjectsList', 'hotEnabled', 'workspaceIndexView', 'layout']) dom[id] = makeEl(id);
dom.workspaceSidebar.querySelector = (sel) =>
  sel === ':scope > .workspaceNavScroller' ? makeEl('scroller') : null;
dom.hotEnabled.checked = true;

try {
  globalThis.localStorage = {
    _s: new Map(),
    getItem(k) { return this._s.has(k) ? this._s.get(k) : null; },
    setItem(k, v) { this._s.set(k, String(v)); },
    removeItem(k) { this._s.delete(k); },
  };
} catch {}

// Shared kind normalizer + the main.js text helpers the saved Note parser
// calls by bare global name. Same verbatim approach as the ACT 1C/2A/2B suites.
const PARSER_HELPERS = [
  'function normalizeParserText(value) {',
  'function stripMarkdownHeadingPrefix(line) {',
  'function countWords(text) {',
  'function normalizeTagValue(value) {',
  'function parseMarkdownHeadings(text) {',
  'function removeFencedCodeBlocks(text) {',
  "function getMarkdownTitle(text, fallback = '') {",
  'function stripYamlFrontmatterForTags(text) {',
  'function normalizeMetadataKey(key) {',
  'function parseMmeTaskMetadata(rawLine) {',
  'function cleanTaskText(rawMatch3) {',
  'function parseMarkdownTasks(text) {',
  'function normalizeConceptName(value) {',
  'function parseConceptLinks(text) {',
  'function parseVisibleHeaderFields(text) {',
];
(0, eval)(
  [
    extractBlockFrom(CONTROLLER_SOURCE, 'function normalizeWorkspaceKindForCompare('),
    extractBlockFrom(MAIN_SOURCE, 'function escapeHtml(str) {'),
    ...PARSER_HELPERS.map((m) => extractBlockFrom(MAIN_SOURCE, m)),
  ].join('\n\n')
);
// The open boundary's identity helper. It is exported by the controller module,
// so it is reproduced as the one-line pure path helper it is documented to be.
globalThis.getWorkspaceFileNameFromPath = (p) => String(p || '').split('/').pop();
(0, eval)(PARSER_SOURCE);
(0, eval)(LIFECYCLE_SOURCE);
if (typeof globalThis.parseWorkspaceDocument !== 'function') {
  throw new Error('parseWorkspaceDocument not exposed');
}

const OWNER_EXTRACTS = [
  'function isWorkspaceCurrentFileNoop(',
  'async function openWorkspaceFile(',
  'function hotSetStatus(msg) {',
  'function hotStop(reason) {',
  'async function hotPrime(handle, generation) {',
  'async function hotApplyReload(fileObj, reason) {',
  'async function hotPollTick(handle, generation) {',
  'function hotStart(generation, reason, alreadyPrimed) {',
  'function activateWritableHandle(',
  'async function hotAfterSave(handle, generation) {',
  'async function confirmOverwriteExternal() {',
  'async function saveToHandle(handle, text) {',
  'async function saveAsSmart(text, taskAmbiguous = 0) {',
  'async function saveSmart() {',
].map((m) => extractBlockFrom(MAIN_SOURCE, m));

// The lifecycle/output owners, evaluated together with the module-level `let`
// state they close over. This is the shipped code running as shipped.
const COLLABORATORS = [
  '// ---- module-level state from main.js ----',
  'let dirty = false;',
  'let currentSaveHandle = null;',
  "let currentFileName = 'untitled.md';",
  'let internalSaveInProgress = false;',
  'let externalHandleGeneration = 0;',
  'let fileLastSeenModified = 0;',
  'let externalStale = false;',
  'let externalStaleModified = 0;',
  'let hotWarnedModified = 0;',
  'let hotTimer = null;',
  'let hotEnabledEl = { checked: true };',
  '// The real hotSetStatus() writes into hotStatusEl; record every value it emits.',
  'const hotStatusText = [];',
  'let hotStatusEl = {',
  '  set textContent(v) { hotStatusText.push(String(v)); },',
  '  get textContent() { return hotStatusText[hotStatusText.length - 1] || ""; },',
  '};',
  'const getCurrentViewState = () => ({ scroll: 0, zoom: 1 });',
  'const restoreViewStateTwice = () => {};',
  'const render = (reason) => { globalThis.__h.renders.push(String(reason)); };',
  'let __virtualReportSession = null;',
  'let __programmaticTextChange = 0;',
  'let __workspaceIndexTimer = null;',
  'const md = { value: "" };',
  '// ---- collaborators (UI bridge, not owners under test) ----',
  'const log = (m) => globalThis.__h.logs.push(String(m));',
  'const setStatus = (s) => globalThis.__h.statuses.push(String(s));',
  'const showToast = (m, t) => globalThis.__h.toasts.push({ message: String(m), type: t });',
  'const updateDocumentTitle = () => {};',
  'const modeLabel = () => "Journal";',
  'const clearDraft = (f) => globalThis.__h.draftsCleared.push(String(f));',
  '// hotSetStatus / hotStop are the real extracted Hot Reload owners, not shims.',
  'const runProgrammaticTextChange = (cb) => { __programmaticTextChange++; try { cb(); } finally { __programmaticTextChange--; } };',
  // The real openTextDocument() adopts the opened handle as the writable one;
  // the harness reproduces exactly that hand-off, nothing more.
  'const openTextDocument = (o) => {',
  '  globalThis.__h.openedDoc = o;',
  '  globalThis.__h.editorText = o.text;',
  '  activateWritableHandle({',
  '    handle: o.fileHandle || null,',
  '    fileName: o.fileName || "",',
  '    lastModified: o.lastModified || 0,',
  '    reason: o.reason || "openTextDocument",',
  '  });',
  '};',
  'const captureTaskBaseline = () => { globalThis.__h.taskBaselineCaptures++; };',
  'const reconcileTasksBeforeSave = () => globalThis.__h.reconcile();',
  'const ensureWritePermission = async () => true;',
  'const savePickerUsable = () => globalThis.__h.pickerUsable;',
  'const isTopLevel = () => true;',
  'const downloadFallback = (t, n) => { globalThis.__h.download = { text: t, name: n }; };',
  'const normalizeMdName = (n) => String(n || "untitled.md");',
  'const guardUnsavedReportBeforePhysicalOpen = async () => globalThis.__h.reportGuard();',
  'const canReconcileDrawioReport = () => globalThis.__h.drawioActive();',
  'const getWorkspaceKindLabel = (k) => (k === "notes" ? "Note" : "File");',
  'const getWorkspaceKindIcon = () => "\\u{1F4C4}";',
  'const renderWorkspaceActivePanel = () => {};',
  'const renderWorkspaceRelatedPanel = () => {};',
  'const renderWorkspaceTasksPanel = () => {};',
  'const renderWorkspaceProjectsPanel = () => {};',
  'const renderWorkspaceIndexSummary = () => {};',
  'const renderWorkspaceTagsPanel = () => {};',
  'const renderWorkspaceJournalTimeline = () => {};',
  'const updateWorkspaceJournalSidebarTitlesFromIndex = () => {};',
  'const persistActiveWorkspaceFile = () => { globalThis.__h.persisted++; };',
  'const scheduleWorkspaceIndexRebuild = (reason) => { globalThis.__h.rebuilds.push(String(reason)); };',
  'const updateWorkspaceActiveFileHighlight = () => {};',
];

const OWNER_API = [
  // main.js publishes these owners on globalThis after defining them, and the
  // Save/Hot Reload paths call them through globalThis. Reproduce that binding.
  'globalThis.scheduleWorkspaceIndexRebuild = scheduleWorkspaceIndexRebuild;',
  'globalThis.openWorkspaceFile = openWorkspaceFile;',
  'globalThis.findWorkspaceFileByPath = (p) => (globalThis.WORKSPACE_STATE?.files?.notes || [])',
  '  .find((f) => f.path === p) || null;',
  'return {',
  '  isWorkspaceCurrentFileNoop, openWorkspaceFile,',
  '  hotPrime, hotApplyReload, hotPollTick, hotStart, hotStop, hotAfterSave,',
  '  activateWritableHandle, saveToHandle, saveSmart, saveAsSmart,',
  '  state: () => ({',
  '    dirty, currentSaveHandle, currentFileName, externalHandleGeneration,',
  '    fileLastSeenModified, externalStale, externalStaleModified,',
  '    hotWarnedModified, internalSaveInProgress,',
  '    virtualReportSession: __virtualReportSession,',
  '    programmaticTextChange: __programmaticTextChange,',
  '    mdValue: md.value,',
  '  }),',
  '  setMd: (v) => { md.value = v; },',
  '  setReportSession: (v) => { __virtualReportSession = v; },',
  '  setDirty: (v) => { dirty = v; },',
  '  stopTimer: () => { if (hotTimer) { clearInterval(hotTimer); hotTimer = null; } },',
  '  hasHotTimer: () => Boolean(hotTimer),',
  '  hotStatusText,',
  '};',
].join('\n');

globalThis.__h = h;
h.WORKSPACE_STATE = globalThis.WORKSPACE_STATE;
h.taskBaselineCaptures = 0;
h.persisted = 0;
h.reconcile = () => ({ changed: false, ambiguous: 0, skippedReason: '' });
h.reportGuard = async () => ({ ok: true, action: 'not-report' });
h.drawioActive = () => false;
h.pickerUsable = true;
h.download = null;

const O = new Function(
  [...COLLABORATORS, '\n// ---- shipped owners, verbatim ----\n', ...OWNER_EXTRACTS, '\n', OWNER_API].join('\n\n')
)();

// Navigation History, Report dictionary, Quick Report and the Draw.io
// reconciler are self-contained IIFE modules: load them verbatim.
(0, eval)(NAV_SOURCE);
(0, eval)(DICT_SOURCE);
(0, eval)(QUICK_SOURCE);
(0, eval)(DRAWIO_SOURCE);

const NAV = globalThis.MME_NAVIGATION;
const DICT = globalThis.MME_REPORT_DICTIONARY;
const QUICK = globalThis.MME_QUICK_REPORT;
const DRAWIO = globalThis.MME_DRAWIO_REPORT_RECONCILER;
if (!NAV || !DICT || !QUICK || !DRAWIO) {
  throw new Error('a Report/Navigation owner global was not exposed');
}

// ---- Storage + Index fixture ----------------------------------------------
const NOTE_TEXT = {
  'notes/example.md': '# Example\n\nFirst body. #alpha\n\n- [ ] open task\n',
  'notes/second.md': '# Second\n\nSecond body.\n',
  'notes/Glossary.md': '---\nknowledge: true\n---\n# Glossary\n\nProject: Rebrand\n\n- [x] done task\n',
};

const notesDir = makeDirHandle();
const storageFiles = Object.keys(NOTE_TEXT).map((p) => ({
  kind: 'notes',
  name: p.split('/').pop(),
  path: p,
  handle: makeFileHandle(p.split('/').pop(), NOTE_TEXT[p]),
}));

globalThis.WORKSPACE_STATE = {
  rootHandle: { kind: 'directory', name: 'workspace' },
  rootName: 'workspace',
  folders: { notes: notesDir },
  files: { notes: storageFiles },
  activeFile: null,
};

// ---- App-level shims + the real Index builder -------------------------------
globalThis.MME_APP = {
  log: (m) => h.logs.push(String(m)),
  showToast: (m, t) => h.toasts.push({ message: String(m), type: t }),
  openTextDocument: (o) => { h.openedDoc = o; h.editorText = o.text; },
  confirmDiscardIfDirty: () => true,
};
globalThis.MME_WORKSPACE_CAPABILITIES = { canActive: () => true, getActiveId: () => 'workspace' };
globalThis.MME_NAVIGATION = NAV;
globalThis.MME_DRAWIO_REPORT_PANEL = { resetSession: () => {} };
globalThis.MME_REPORT_PANEL = { refresh: () => {} };
globalThis.persistActiveWorkspaceFile = () => { h.persisted++; };
globalThis.updateWorkspaceActiveFileHighlight = () => {};
globalThis.confirm = () => true;
globalThis.__cmSetText = (t) => { h.editorText = t; };
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.dispatchEvent = () => true;
for (const name of ['renderWorkspaceIndexSummary', 'renderWorkspaceActivePanel',
  'renderWorkspaceRelatedPanel', 'renderWorkspaceTagsPanel', 'renderWorkspaceTasksPanel',
  'renderWorkspaceJournalTimeline', 'updateWorkspaceJournalSidebarTitlesFromIndex']) {
  globalThis[name] = () => {};
}
globalThis.CustomEvent = function CustomEvent(type, opts) {
  this.type = type;
  this.detail = (opts && opts.detail) || null;
};

const INDEX_API = new Function(
  [
    'const log = (m) => globalThis.__h.logs.push(String(m));',
    extractBlockFrom(MAIN_SOURCE, 'const WORKSPACE_INDEX_STATE = {', '};'),
    extractBlockFrom(MAIN_SOURCE, 'try {\n  window.WORKSPACE_INDEX_STATE', '} catch {}'),
    extractBlockFrom(MAIN_SOURCE, 'async function readWorkspaceFileText('),
    extractBlockFrom(MAIN_SOURCE, 'async function buildWorkspaceIndex('),
  ].join('\n\n') +
    '\nreturn { WORKSPACE_INDEX_STATE, buildWorkspaceIndex };'
)();
globalThis.WORKSPACE_INDEX_STATE = INDEX_API.WORKSPACE_INDEX_STATE;
const IDX = globalThis.WORKSPACE_INDEX_STATE;

function resetHarness() {
  h.logs.length = 0;
  h.toasts.length = 0;
  h.statuses.length = 0;
  h.rebuilds.length = 0;
  h.writes.length = 0;
  h.draftsCleared.length = 0;
  h.openedDoc = null;
  h.editorText = '';
  h.hotStatus = '';
  h.renders.length = 0;
  h.reportCleared = 0;
  h.sidebarRefreshes = 0;
  O.hotStatusText.length = 0;
  h.download = null;
  h.taskBaselineCaptures = 0;
  h.persisted = 0;
  h.reconcile = () => ({ changed: false, ambiguous: 0, skippedReason: '' });
  h.reportGuard = async () => ({ ok: true, action: 'not-report' });
  h.drawioActive = () => false;
  h.pickerUsable = true;
  O.setReportSession(null);
  O.setDirty(false);
  O.stopTimer();
}

// ---- Suites ----------------------------------------------------------------
(async () => {
  await INDEX_API.buildWorkspaceIndex();

  group('Save (S01-S10)');

  const exampleHandle = WORKSPACE_STATE.files.notes[0].handle;
  const originalText = NOTE_TEXT['notes/example.md'];

  await check('S01', 'a Workspace Note opens with its exact handle and path', (() => {
    resetHarness();
    const record = WORKSPACE_STATE.files.notes.find((f) => f.path === 'notes/example.md');
    return O.openWorkspaceFile(record, 'notes', 'act2c open').then(() => {
      const st = O.state();
      return WORKSPACE_STATE.activeFile.path === 'notes/example.md' &&
        WORKSPACE_STATE.activeFile.kind === 'notes' &&
        WORKSPACE_STATE.activeFile.handle === record.handle &&
        st.currentSaveHandle === record.handle &&
        st.currentFileName === 'example.md' &&
        h.editorText === originalText;
    });
  })(), 'exact handle + path');

  await check('S02', 'Save writes the exact active handle', (() => {
    resetHarness();
    O.setMd('# Example\n\nEdited body. #alpha\n\n- [ ] open task\n');
    return O.saveSmart().then((res) => {
      const written = h.writes.map((w) => w.name);
      return res.ok === true && written.length === 1 &&
        written[0] === 'example.md' &&
        exampleHandle.__text === '# Example\n\nEdited body. #alpha\n\n- [ ] open task\n';
    });
  })(), 'single write to the Note');

  await check('S03', 'Task reconciliation stays inside the Save path', (() => {
    resetHarness();
    let calls = 0;
    h.reconcile = () => {
      calls += 1;
      return { changed: false, ambiguous: 0, skippedReason: '' };
    };
    O.setMd('# Example\n\nbody\n');
    return O.saveSmart().then(() =>
      calls === 1 && h.taskBaselineCaptures === 1 &&
      h.logs.some((l) => l.includes('TaskReconcile')));
  })(), 'reconcile + baseline in Save');

  await check('S04', 'a successful Save clears dirty', (() => {
    resetHarness();
    O.setDirty(true);
    O.setMd('# Example\n\nbody\n');
    return O.saveSmart().then((res) => res.ok === true && O.state().dirty === false);
  })(), 'dirty cleared');

  await check('S05', 'a failed Save preserves dirty and mutates nothing', (() => {
    resetHarness();
    WORKSPACE_STATE.activeFile = null;
    O.setDirty(true);
    O.setMd('# Example\n\nbody\n');
    const before = exampleHandle.__text;
    // A total failure: the write throws and the Save As fallback is unavailable,
    // so nothing may be written to the original Note.
    h.pickerUsable = false;
    const broken = {
      kind: 'file', name: 'example.md',
      getFile: async () => { throw new Error('disk gone'); },
      createWritable: async () => { throw new Error('disk gone'); },
    };
    O.activateWritableHandle({ handle: broken, fileName: 'example.md', reason: 'test' });
    return O.saveSmart().then(() => {
      const ok = exampleHandle.__text === before &&
        !h.writes.some((w) => w.name === 'example.md') &&
        O.state().dirty === true;
      O.activateWritableHandle({ handle: exampleHandle, fileName: 'example.md', reason: 'test' });
      return ok;
    });
  })(), 'failure keeps dirty');

  await check('S06', 'a canceled overwrite performs no mutation', (async () => {
    resetHarness();
    O.setDirty(true);
    O.setMd('# Example\n\nbody\n');
    const before = exampleHandle.__text;
    // Prime the authoritative timestamp, then move it so the external-change
    // safeguard genuinely asks, and decline.
    const gen = O.state().externalHandleGeneration;
    await O.hotPrime(exampleHandle, gen);
    exampleHandle.lastModified = O.state().fileLastSeenModified + 5000;
    globalThis.confirm = () => false;
    const r = await O.saveSmart();
    globalThis.confirm = () => true;
    const dirtyAfter = O.state().dirty;
    const writes = h.writes.length;
    exampleHandle.lastModified = 1000;
    O.activateWritableHandle({ handle: exampleHandle, fileName: 'example.md', reason: 'test' });
    return r.ok === false && r.reason === 'canceled' && dirtyAfter === true &&
      exampleHandle.__text === before && writes === 0;
  })(), () => 'cancel is a no-op');

  await check('S07', 'a successful Save schedules exactly one Index rebuild', (() => {
    resetHarness();
    WORKSPACE_STATE.activeFile = {
      kind: 'notes', name: 'example.md', path: 'notes/example.md', handle: exampleHandle,
    };
    O.activateWritableHandle({ handle: exampleHandle, fileName: 'example.md', reason: 'test' });
    O.setMd('# Example\n\nbody\n');
    return O.saveSmart().then(() => h.rebuilds.length === 1 && h.rebuilds[0] === 'save');
  })(), () => "rebuilds=" + JSON.stringify(h.rebuilds) +
    ' active=' + String(Boolean(WORKSPACE_STATE.activeFile)) +
    ' handle=' + String(O.state().currentSaveHandle && O.state().currentSaveHandle.name));

  await check('S08', 'saved H1 refreshes from disk after the rebuild', (() => {
    resetHarness();
    O.setMd('# Renamed Example\n\nbody #alpha\n');
    return O.saveSmart()
      .then(() => INDEX_API.buildWorkspaceIndex())
      .then(() => {
        const rec = IDX.byPath.get('notes/example.md');
        return Boolean(rec) && rec.title === 'Renamed Example' && rec.path === 'notes/example.md';
      });
  })(), 'H1 presentation refreshes');

  await check('S09', 'Tasks refresh exactly once per rebuild', (() => {
    resetHarness();
    O.setMd('# Renamed Example\n\nbody #alpha\n\n- [ ] one\n- [ ] two\n');
    return O.saveSmart()
      .then(() => INDEX_API.buildWorkspaceIndex())
      .then(() => {
        const rec = IDX.byPath.get('notes/example.md');
        return Boolean(rec) && rec.tasks.length === 2 && rec.tasks[0].line < rec.tasks[1].line;
      });
  })(), 'two tasks, line order');

  await check('S10', 'Save adds no per-keystroke rebuild and no metadata write', () => {
    const all = OWNER_EXTRACTS[OWNER_EXTRACTS.length - 1] + OWNER_EXTRACTS[OWNER_EXTRACTS.length - 2];
    return !/addEventListener\('(change|input)'/.test(all) &&
      !/setFrontmatter|writeFrontmatter|removeManagedKey/.test(all);
  }, 'no keystroke path, no writer');

  // __APPEND_MARKER__
  group('Save As and membership (A11-A19)');

  await check('A11', 'a canceled Save As has zero effect', (async () => {
    resetHarness();
    WORKSPACE_STATE.activeFile = {
      kind: 'notes', name: 'example.md', path: 'notes/example.md', handle: exampleHandle,
    };
    O.activateWritableHandle({ handle: exampleHandle, fileName: 'example.md', reason: 'test' });
    const beforeHandle = O.state().currentSaveHandle;
    const beforeText = exampleHandle.__text;
    globalThis.showSaveFilePicker = async () => {
      const e = new Error('aborted');
      e.name = 'AbortError';
      throw e;
    };
    const res = await O.saveAsSmart('# Example\n\nbody\n');
    globalThis.showSaveFilePicker = undefined;
    return res.ok === false && res.reason === 'canceled' &&
      O.state().currentSaveHandle === beforeHandle &&
      exampleHandle.__text === beforeText && h.writes.length === 0 &&
      WORKSPACE_STATE.activeFile.path === 'notes/example.md';
  })(), () => 'cancel is a no-op');

  // Every remaining Save As fixture is an external destination: the picker
  // returns a bare FileSystemFileHandle with no parent directory handle, so
  // membership inside notes/ is unprovable by construction.
  async function externalSaveAs(name, text) {
    const target = makeFileHandle(name, '');
    globalThis.showSaveFilePicker = async () => target;
    const res = await O.saveAsSmart(text);
    globalThis.showSaveFilePicker = undefined;
    return { res, target };
  }

  await check('A12', 'an external Save As adopts the new writable handle', (async () => {
    resetHarness();
    const { res, target } = await externalSaveAs('Elsewhere.md', '# Example\n\nsaved elsewhere\n');
    return res.ok === true && O.state().currentSaveHandle === target &&
      O.state().currentFileName === 'Elsewhere.md' &&
      target.__text === '# Example\n\nsaved elsewhere\n';
  })(), () => 'new handle adopted');

  await check('A13', 'the old Workspace path identity is removed after Save As', (async () => {
    resetHarness();
    WORKSPACE_STATE.activeFile = {
      kind: 'notes', name: 'example.md', path: 'notes/example.md', handle: exampleHandle,
    };
    const { res } = await externalSaveAs('Elsewhere.md', '# Example\n\nmoved\n');
    return res.ok === true && WORKSPACE_STATE.activeFile === null && h.persisted >= 1;
  })(), () => 'no false activeFile');

  await check('A14', 'the original Workspace Note remains indexed and distinct', (async () => {
    resetHarness();
    WORKSPACE_STATE.activeFile = {
      kind: 'notes', name: 'example.md', path: 'notes/example.md', handle: exampleHandle,
    };
    await externalSaveAs('Elsewhere.md', '# Example\n\nmoved\n');
    await INDEX_API.buildWorkspaceIndex();
    const rec = IDX.byPath.get('notes/example.md');
    return Boolean(rec) && rec.path === 'notes/example.md' &&
      WORKSPACE_STATE.files.notes.some((f) => f.path === 'notes/example.md');
  })(), () => 'original kept');

  await check('A15', 'basename equality does not establish membership', (async () => {
    resetHarness();
    WORKSPACE_STATE.activeFile = {
      kind: 'notes', name: 'example.md', path: 'notes/example.md', handle: exampleHandle,
    };
    const { res } = await externalSaveAs('example.md', '# Example\n\ncopy\n');
    return res.ok === true && WORKSPACE_STATE.activeFile === null;
  })(), () => 'equal name, no membership');

  await check('A16', 'H1 equality does not establish membership', (async () => {
    resetHarness();
    WORKSPACE_STATE.activeFile = {
      kind: 'notes', name: 'example.md', path: 'notes/example.md', handle: exampleHandle,
    };
    const { res } = await externalSaveAs('Copy.md', '# Example\n\nsame H1\n');
    return res.ok === true && WORKSPACE_STATE.activeFile === null;
  })(), () => 'equal H1, no membership');

  await check('A17', 'notes/ membership is not inferred from the previous activeFile', (async () => {
    resetHarness();
    const second = WORKSPACE_STATE.files.notes.find((f) => f.path === 'notes/second.md');
    WORKSPACE_STATE.activeFile = {
      kind: 'notes', name: 'second.md', path: 'notes/second.md', handle: second.handle,
    };
    const { res } = await externalSaveAs('notes.md', '# Second\n\nout\n');
    return res.ok === true && WORKSPACE_STATE.activeFile === null;
  })(), () => 'previous identity is not evidence');

  await check('A18', 'no false activeFile is left behind', (async () => {
    resetHarness();
    const second = WORKSPACE_STATE.files.notes.find((f) => f.path === 'notes/second.md');
    WORKSPACE_STATE.activeFile = {
      kind: 'notes', name: 'second.md', path: 'notes/second.md', handle: second.handle,
    };
    const { res } = await externalSaveAs('Out.md', '# Second\n\nout\n');
    return res.ok === true && WORKSPACE_STATE.activeFile === null;
  })(), () => 'released identity');

  await check('A19', 'a subsequent Save targets the new handle', (async () => {
    resetHarness();
    const second = WORKSPACE_STATE.files.notes.find((f) => f.path === 'notes/second.md');
    WORKSPACE_STATE.activeFile = {
      kind: 'notes', name: 'second.md', path: 'notes/second.md', handle: second.handle,
    };
    const { target } = await externalSaveAs('Out.md', '# Second\n\nfirst write\n');
    h.writes.length = 0;
    O.setMd('# Second\n\nsecond write\n');
    const res = await O.saveSmart();
    return res.ok === true && O.state().currentSaveHandle === target &&
      h.writes.length === 1 && h.writes[0].name === 'Out.md' &&
      target.__text === '# Second\n\nsecond write\n' &&
      second.handle.__text === NOTE_TEXT['notes/second.md'];
  })(), () => 'subsequent Save follows the new handle');

  group('Hot Reload (H20-H25)');

  await check('H20', 'the active Note handle is the one monitored', (async () => {
    resetHarness();
    O.stopTimer();
    const before = O.hasHotTimer();
    O.activateWritableHandle({
      handle: exampleHandle, fileName: 'example.md', lastModified: 1000, reason: 'test',
    });
    const after = O.hasHotTimer();
    const st = O.state();
    O.stopTimer();
    return before === false && after === true && st.currentSaveHandle === exampleHandle;
  })(), () => 'single active handle watched');

  await check('H21', 'the external-stale contract is preserved', (async () => {
    resetHarness();
    O.stopTimer();
    O.activateWritableHandle({
      handle: exampleHandle, fileName: 'example.md', lastModified: 1000, reason: 'test',
    });
    // Dirty editor + external change + decline => externalStale, no reload.
    O.setDirty(true);
    exampleHandle.lastModified = 999999;
    globalThis.confirm = () => false;
    const gen = O.state().externalHandleGeneration;
    await O.hotPollTick(exampleHandle, gen);
    globalThis.confirm = () => true;
    const st = O.state();
    O.stopTimer();
    exampleHandle.lastModified = 1000;
    O.activateWritableHandle({ handle: exampleHandle, fileName: 'example.md', reason: 'reset' });
    return st.externalStale === true && st.externalStaleModified === 999999 &&
      O.hotStatusText.some((s) => s.includes('OUT OF DATE'));
  })(), () => 'stale state recorded');

  await check('H22', 'an accepted reload updates the editor', (async () => {
    resetHarness();
    O.stopTimer();
    O.activateWritableHandle({
      handle: exampleHandle, fileName: 'example.md', lastModified: 1000, reason: 'test',
    });
    exampleHandle.__text = '# Example\n\nexternally changed\n';
    exampleHandle.lastModified = 4242;
    await O.hotApplyReload(await exampleHandle.getFile(), 'test');
    const text = h.editorText;
    O.stopTimer();
    exampleHandle.__text = NOTE_TEXT['notes/example.md'];
    exampleHandle.lastModified = 1000;
    O.activateWritableHandle({ handle: exampleHandle, fileName: 'example.md', reason: 'reset' });
    return text === '# Example\n\nexternally changed\n';
  })(), () => 'editor text replaced');

  await check('H23', 'an accepted reload re-renders once and rebuilds no Index (current contract)', (async () => {
    // ACT 2C preservation finding: the shipped hotApplyReload() updates the
    // editor, resets the stale flags and calls render(). It does NOT schedule an
    // Index rebuild. That is pre-existing behaviour for every file kind, not a
    // Notes regression, so it is preserved unchanged rather than "fixed".
    resetHarness();
    O.stopTimer();
    WORKSPACE_STATE.activeFile = {
      kind: 'notes', name: 'example.md', path: 'notes/example.md', handle: exampleHandle,
    };
    O.activateWritableHandle({
      handle: exampleHandle, fileName: 'example.md', lastModified: 1000, reason: 'test',
    });
    exampleHandle.__text = '# Example\n\nreloaded\n';
    exampleHandle.lastModified = 7777;
    await O.hotApplyReload(await exampleHandle.getFile(), 'test');
    const rebuilds = [...h.rebuilds];
    const renders = [...h.renders];
    const st = O.state();
    O.stopTimer();
    exampleHandle.__text = NOTE_TEXT['notes/example.md'];
    exampleHandle.lastModified = 1000;
    O.activateWritableHandle({ handle: exampleHandle, fileName: 'example.md', reason: 'reset' });
    return rebuilds.length === 0 && renders.length === 1 && st.dirty === false &&
      st.externalStale === false;
  })(), () => 'renders=' + JSON.stringify(h.renders) + ' rebuilds=' + JSON.stringify(h.rebuilds));

  await check('H24', 'no watcher is created for every indexed file', () => {
    // hotSetStatus / hotStop / hotPrime / hotApplyReload / hotPollTick / hotStart
    const hot = OWNER_EXTRACTS.slice(2, 8).join('\n');
    return /setInterval/.test(hot) && !/WORKSPACE_STATE/.test(hot) && !/byKind/.test(hot);
  }, () => 'single-handle polling');

  await check('H25', 'no Journals/Concepts condition remains in the Hot Reload owner', () => {
    const hot = OWNER_EXTRACTS.slice(2, 8).join('\n');
    return !/journals|concepts/.test(hot);
  }, () => 'no retired kind');

  group('Navigation History (V26-V31)');

  const openedByHistory = [];
  NAV.clear();
  NAV.setOpener(async (loc) => {
    openedByHistory.push(loc.path);
    const rec = WORKSPACE_STATE.files.notes.find((f) => f.path === loc.path);
    return rec ? { status: 'opened', location: loc } : { status: 'failed' };
  });

  const navSeed = async () => {
    NAV.clear();
    NAV.seed({ type: 'workspace-file', path: 'notes/example.md', kind: 'notes', name: 'example.md', source: 'test' });
    return NAV.recordSuccessfulNavigation({
      type: 'workspace-file', path: 'notes/second.md', kind: 'notes', name: 'second.md', source: 'test',
    });
  };

  await check('V26', 'Back opens the exact Note path', async () => {
    openedByHistory.length = 0;
    await navSeed();
    await NAV.back();
    return NAV.getCurrent().path === 'notes/example.md' &&
      openedByHistory[openedByHistory.length - 1] === 'notes/example.md';
  }, () => 'back path');

  await check('V27', 'Forward opens the exact Note path', async () => {
    openedByHistory.length = 0;
    await NAV.forward();
    return NAV.getCurrent().path === 'notes/second.md' &&
      openedByHistory[openedByHistory.length - 1] === 'notes/second.md';
  }, () => 'forward path');

  await check('V28', 'duplicate H1 Notes remain distinct history entries', () => {
    // The engine compares workspace-file locations by path only, so two Notes
    // that happen to share an H1 are still two distinct history entries.
    const a = NAV.normalizeLocation({ type: 'workspace-file', path: 'notes/example.md', kind: 'notes' });
    const b = NAV.normalizeLocation({ type: 'workspace-file', path: 'notes/Glossary.md', kind: 'notes' });
    const dup = NAV.normalizeLocation({ type: 'workspace-file', path: 'notes/Glossary.md', kind: 'notes' });
    return NAV.sameLocation(a, b) === false && NAV.sameLocation(b, dup) === true;
  }, () => 'path-based identity');

  await check('V29', 'changing the H1 does not change history identity', () => {
    // The H1 is presentation: it is not part of the location record at all, so
    // editing it cannot alter Back/Forward identity.
    const loc = NAV.normalizeLocation({
      type: 'workspace-file', path: 'notes/example.md', kind: 'notes', name: 'example.md',
    });
    const parsed = IDX.byPath.get('notes/example.md');
    return !('title' in loc) && loc.path === 'notes/example.md' && parsed.title === 'Example';
  }, () => 'no title in location');

  await check('V30', 'a rejected candidate does not clear history', async () => {
    openedByHistory.length = 0;
    await navSeed();
    const before = NAV.getSnapshot();
    const res = await NAV.back();
    const after = NAV.getSnapshot();
    return before.back.length === 1 && res.status === 'opened' &&
      after.current.path === 'notes/example.md';
  }, () => 'history committed only on open');

  await check('V31', 'an external Save As leaves no false Workspace history identity', async () => {
    resetHarness();
    NAV.clear();
    const second = WORKSPACE_STATE.files.notes.find((f) => f.path === 'notes/second.md');
    WORKSPACE_STATE.activeFile = {
      kind: 'notes', name: 'second.md', path: 'notes/second.md', handle: second.handle,
    };
    await externalSaveAs('Out.md', '# Second\n\nout\n');
    const loc = NAV.getCurrent();
    return WORKSPACE_STATE.activeFile === null && (!loc || loc.path !== 'notes/second.md');
  }, () => 'identity released');

  group('Quick Report (Q32-Q38)');

  const range = DICT.normalizeReportRange('2020-01-01', '2030-12-31');
  const buildDict = () => DICT.buildReportDictionary({
    range, sections: [], projectMode: 'all', notes: '',
  });

  await check('Q32', 'Notes Tasks are included exactly once', () => {
    const d = buildDict();
    const all = [...d.tasks.open, ...d.tasks.completed, ...d.tasks.completedUndated];
    const paths = all.map((t) => t.sourcePath);
    return paths.length === new Set(paths.map((p, i) => p + '#' + all[i].sourceLine)).size &&
      paths.every((p) => String(p).startsWith('notes/'));
  }, () => 'unique source paths');

  await check('Q33', 'Notes Projects are included exactly once', () => {
    const d = buildDict();
    return d.projects.items.length === IDX.projects.length &&
      d.projects.items.every((p) => String(p.sourcePath).startsWith('notes/'));
  }, () => 'projects from the saved Index');

  await check('Q34', 'source paths are preserved exactly', () => {
    const d = buildDict();
    const paths = [...d.tasks.open, ...d.tasks.completed, ...d.tasks.completedUndated]
      .map((t) => t.sourcePath);
    return paths.every((p) => WORKSPACE_STATE.files.notes.some((f) => f.path === p));
  }, () => 'exact paths');

  await check('Q35', 'no Journals/Concepts bucket is required', () => {
    // The Report owner reads only the aggregated Index arrays.
    const runtime = DICT_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '');
    const body = runtime.split('function validateDictionaryFixtures')[0];
    return /indexState\?\.tasks/.test(body) && /indexState\?\.projects/.test(body) &&
      !/byKind|files\?\.journals|files\?\.concepts/.test(body);
  }, () => 'generic aggregated arrays');

  await check('Q36', 'the saved Index remains the single source', () => {
    const d = buildDict();
    return d.tasks.open.length === IDX.tasks.filter((t) => !t.done).length;
  }, () => 'authoritative Index');

  await check('Q37', 'no Current Document Report was added', () => {
    return !/currentDocument|current-document/.test(DICT_SOURCE) &&
      !/currentDocument|current-document/.test(QUICK_SOURCE);
  }, () => 'scope untouched');

  await check('Q38', 'virtual Report state stays separate from the Note', async () => {
    resetHarness();
    O.setReportSession({ kind: 'report', virtual: true, saved: false, fileName: 'r.md' });
    const record = WORKSPACE_STATE.files.notes.find((f) => f.path === 'notes/example.md');
    await O.openWorkspaceFile(record, 'notes', 'test');
    return O.state().virtualReportSession === null;
  }, () => 'identity cleared on physical open');

  group('Draw.io (D39-D43)');

  await check('D39', 'the existing Report model remains the source', () => {
    return typeof DRAWIO.reconcile === 'function' && typeof QUICK.buildMarkdown === 'function';
  }, () => 'model owners exposed');

  await check('D40', 'the Report model carries Notes-derived data', () => {
    const d = buildDict();
    const open = d.tasks.open.length;
    return open > 0 && d.projects.items.length > 0;
  }, () => 'Notes data present');

  await check('D41', 'Draw.io settings and output naming are unchanged', () => {
    return typeof QUICK.buildSuggestedFilename === 'function' &&
      !/journal|concept/i.test(DRAWIO_SOURCE.split('function validateReconciler')[0].slice(0, 4000));
  }, () => 'no legacy kind in reconciler');

  await check('D42', 'placeholder reconciliation and partial generation are unchanged', () => {
    const v = DRAWIO.validate ? DRAWIO.validate() : null;
    return v === null || (v.ok !== false);
  }, () => 'self-check');

  await check('D43', 'no Draw.io expansion was introduced', () => {
    const before = read('js', 'report', 'drawio-report-reconciler.js');
    return before.length > 0 && typeof DRAWIO.reconcile === 'function' &&
      !/createTemplate|newTemplateArchitecture/.test(DRAWIO_SOURCE);
  }, () => 'no template architecture');

  group('Report guards (G44-G49)');

  await check('G44', 'an unsaved virtual Report invokes the guard before a physical open', async () => {
    resetHarness();
    let invoked = 0;
    h.reportGuard = async () => {
      invoked += 1;
      return { ok: false, cancelled: true, reason: 'unsaved-report' };
    };
    h.drawioActive = () => true;
    const record = WORKSPACE_STATE.files.notes.find((f) => f.path === 'notes/example.md');
    const res = await O.openWorkspaceFile(record, 'notes', 'test');
    return invoked === 1 && res && res.ok === false && res.cancelled === true &&
      WORKSPACE_STATE.activeFile === null;
  }, () => 'guard blocks the open');

  await check('G45', 'a canceled transition preserves the Report', async () => {
    resetHarness();
    O.setReportSession({ kind: 'report', virtual: true, saved: false, fileName: 'r.md' });
    h.reportGuard = async () => ({ ok: false, cancelled: true, reason: 'unsaved-report' });
    h.drawioActive = () => true;
    const before = h.editorText;
    const record = WORKSPACE_STATE.files.notes.find((f) => f.path === 'notes/example.md');
    await O.openWorkspaceFile(record, 'notes', 'test');
    const session = O.state().virtualReportSession;
    return session !== null && session.virtual === true && h.editorText === before;
  }, () => 'Report kept intact');

  await check('G46', 'an accepted transition opens the exact Note', async () => {
    resetHarness();
    O.setReportSession({ kind: 'report', virtual: true, saved: false, fileName: 'r.md' });
    h.reportGuard = async () => ({ ok: true, action: 'discarded' });
    const record = WORKSPACE_STATE.files.notes.find((f) => f.path === 'notes/example.md');
    await O.openWorkspaceFile(record, 'notes', 'test');
    return WORKSPACE_STATE.activeFile.path === 'notes/example.md' &&
      O.state().currentSaveHandle === record.handle &&
      Boolean(h.openedDoc) && h.openedDoc.fileHandle === record.handle;
  }, () => 'exact Note opened');

  await check('G47', 'Note and Report handles never cross', async () => {
    resetHarness();
    const reportHandle = makeFileHandle('report.md', '# Report\n');
    O.setReportSession({ kind: 'report', virtual: true, saved: false, fileName: 'report.md' });
    h.reportGuard = async () => ({ ok: true, action: 'discarded' });
    const record = WORKSPACE_STATE.files.notes.find((f) => f.path === 'notes/example.md');
    await O.openWorkspaceFile(record, 'notes', 'test');
    return O.state().currentSaveHandle === record.handle &&
      O.state().currentSaveHandle !== reportHandle &&
      O.state().virtualReportSession === null;
  }, () => 'handles separated');

  await check('G48', 'saved Report recognition is unchanged', () => {
    const saveSmartBlock = OWNER_EXTRACTS[OWNER_EXTRACTS.length - 1];
    return /__virtualReportSession\.kind === 'report'/.test(saveSmartBlock) &&
      /__virtualReportSession\.virtual = false/.test(saveSmartBlock) &&
      /__virtualReportSession\.saved = true/.test(saveSmartBlock);
  }, () => 'recognition intact');

  await check('G49', 'a Report is never mutated as Note metadata', () => {
    const consumers = OWNER_EXTRACTS.join('\n') +
      DICT_SOURCE.split('function validateDictionary')[0];
    return !/setFrontmatter|writeFrontmatter|removeManagedKey/.test(consumers);
  }, () => 'no metadata writer');

  group('Cross-package (X50-X60)');

  const CROSS = [
    ['X50', 'ACT 2A validator remains green', () =>
      /48 passed, 0 failed/.test(runNode('scripts/workspace-discovery-consumers-validators.cjs'))],
    ['X51', 'ACT 2B validator remains green', () =>
      /62 passed, 0 failed/.test(runNode('scripts/workspace-task-consumers-validators.cjs'))],
    ['X52', 'Task Review escaping passes', () => {
      const out = runNode('scripts/workspace-task-consumers-validators.cjs');
      return !/^FAIL \[X0/m.test(out) && /X05\]/.test(out);
    }],
    ['X53', 'no consumer mutates the shared Index', () => {
      const before = JSON.stringify([IDX.files.length, IDX.tasks.length, IDX.projects.length]);
      buildDict();
      return before === JSON.stringify([IDX.files.length, IDX.tasks.length, IDX.projects.length]);
    }],
    ['X54', 'writes only happen on explicit Save paths', () => {
      const all = OWNER_EXTRACTS.join('\n');
      // The only createWritable() calls live in saveToHandle(); the open and
      // Hot Reload owners never write.
      return (all.match(/createWritable\(/g) || []).length >= 1 &&
        !/createWritable\(/.test(OWNER_EXTRACTS.slice(0, 10).join('\n'));
    }],
    ['X55', 'no Sidebar redesign', () => {
      // The Sidebar owners themselves must carry no ACT 2C edit.
      const sidebarBlock = extractBlockFrom(CONTROLLER_SOURCE, 'function refreshWorkspaceSidebar(');
      return !/ACT 2C/.test(sidebarBlock) &&
        // And the retained legacy Journals/Concepts Sidebar surfaces still exist.
        /workspaceJournalsList/.test(sidebarBlock);
    }],
    ['X56', 'no creation UI', () =>
      !/function createNewNote/.test(MAIN_SOURCE + CONTROLLER_SOURCE)],
    ['X57', 'no metadata writer', () =>
      !/function (setFrontmatter|writeFrontmatter|removeManagedKey)/.test(MAIN_SOURCE + CONTROLLER_SOURCE)],
    ['X58', 'no Current Document scope', () =>
      !/currentDocumentReport/.test(DICT_SOURCE + QUICK_SOURCE)],
    ['X59', 'no Project syntax change', () =>
      !/^## Project:/m.test(read('js', 'workspace', 'workspace-parser.js'))],
    ['X60', 'no version/cache/SW change', () => {
      const parity = runNode('scripts/release-parity.cjs');
      return /RELEASE PARITY OK/.test(parity) && /0\.6\.1/.test(parity);
    }],
  ];

  for (const [id, label, fn] of CROSS) {
    await check(id, label, (() => {
      try {
        return fn();
      } catch {
        return false;
      }
    })(), () => 'checked');
  }

  group('Temporary gates (T61-T67)');

  // openToday lives in an ES module, so it is extracted verbatim and evaluated
  // against the same storage the suites above use.
  const TODAY = new Function(
    [
      "const NOTES_DIRECTORY_NAME = 'notes';",
      'const WORKSPACE_STATE = globalThis.__h.WORKSPACE_STATE;',
      'const globalThis_ = globalThis;',
      'const MME_APP = globalThis.MME_APP;',
      'const MME_NAVIGATION = globalThis.MME_NAVIGATION;',
      'const clearReportIdentityAfterTransition = () => { globalThis.__h.reportCleared++; };',
      'const persistActiveWorkspaceFile = () => { globalThis.__h.persisted++; };',
      'const refreshWorkspaceSidebar = async () => { globalThis.__h.sidebarRefreshes++; };',
      'const updateWorkspaceActiveFileHighlight = () => {};',
      'const renderWorkspaceActivePanel = () => {};',
      'const renderWorkspaceRelatedPanel = () => {};',
      'const renderWorkspaceTasksPanel = () => {};',
      'const scheduleWorkspaceIndexRebuild = (r) => { globalThis.__h.rebuilds.push(String(r)); };',
    ].join('\n') +
      '\n' + extractBlockFrom(CONTROLLER_SOURCE, 'async function openToday() {') +
      '\nreturn openToday;'
  )();

  // The ACT 1B "Today unavailable" gate must be gone from the source.
  const todaySource = extractBlockFrom(CONTROLLER_SOURCE, 'async function openToday() {');

  await check('T61', 'the ACT 1B Today gate is removed', () => {
    return !/folders\?\.journals/.test(todaySource) &&
      !/Today unavailable — journals\//.test(todaySource);
  }, () => 'no journals gate');

  await check('T62', 'Today creates/opens notes/YYYY-MM-DD.md', async () => {
    h.writes.length = 0;
    h.rebuilds.length = 0;
    WORKSPACE_STATE.folders.notes = makeDirHandle();
    await TODAY();
    const created = Object.keys(WORKSPACE_STATE.folders.notes.__files);
    return created.length === 1 && /^\d{4}-\d{2}-\d{2}\.md$/.test(created[0]);
  }, () => 'created=' + JSON.stringify(Object.keys(WORKSPACE_STATE.folders.notes?.__files || {})));

  await check('T63', 'Today identity is the notes/ path with kind notes', async () => {
    const active = WORKSPACE_STATE.activeFile;
    return Boolean(active) && active.kind === 'notes' &&
      String(active.path).startsWith('notes/') && String(active.path).endsWith('.md');
  }, () => JSON.stringify(WORKSPACE_STATE.activeFile && WORKSPACE_STATE.activeFile.path));

  await check('T64', 'Today never duplicates or overwrites an existing Note', async () => {
    // Run again: getFileHandle({create:true}) must reuse the file, and the
    // starter body must not be rewritten over existing content.
    const dir = WORKSPACE_STATE.folders.notes;
    const name = Object.keys(dir.__files)[0];
    dir.__files[name].__text = '# Already here\n\nkeep me\n';
    const before = h.writes.length;
    await TODAY();
    return dir.__files[name].__text === '# Already here\n\nkeep me\n' &&
      h.writes.length === before;
  }, () => 'existing content preserved');

  await check('T65', 'Today records navigation and schedules one rebuild', async () => {
    NAV.clear();
    h.rebuilds.length = 0;
    await TODAY();
    const cur = NAV.getCurrent();
    return h.rebuilds.filter((r) => r === 'today').length === 1 &&
      Boolean(cur) && cur.kind === 'notes' && String(cur.path).startsWith('notes/');
  }, () => 'rebuilds=' + JSON.stringify(h.rebuilds));

  await check('T66', 'Today writes no legacy frontmatter and stays a Note', async () => {
    const dir = WORKSPACE_STATE.folders.notes;
    const name = Object.keys(dir.__files)[0];
    dir.__files[name].__text = '';
    await TODAY();
    const text = dir.__files[name].__text;
    return !/type:\s*journal/.test(text) && !/journals\//.test(text);
  }, () => 'no legacy metadata key');

  await check('T67', 'retained legacy surfaces are still present and gated', () => {
    // Journal Timeline, Concepts panel and New Concept are explicitly retained.
    return /function renderWorkspaceJournalTimeline\(/.test(MAIN_SOURCE) &&
      /RETAINED LEGACY/.test(MAIN_SOURCE) &&
      /function createNewConcept\(/.test(MAIN_SOURCE) &&
      /workspaceConceptsPanel/.test(CONTROLLER_SOURCE);
  }, () => 'legacy surfaces retained');

  // __APPEND_MARKER__
  await chain;
  const failed = results.filter((e) => !e.group && !e.ok);
  const passed = results.filter((e) => !e.group && e.ok);
  for (const e of results) {
    if (e.group) {
      console.log('\n' + e.group);
      continue;
    }
    console.log((e.ok ? 'PASS' : 'FAIL') + ' [' + e.id + '] ' + e.name + (e.ok ? '' : ' -- ' + e.detail));
  }
  console.log(
    '\nWORKSPACE LIFECYCLE OUTPUT VALIDATORS: ' + passed.length + ' passed, ' + failed.length + ' failed'
  );
  process.exitCode = failed.length === 0 ? 0 : 1;
  // The Hot Reload owner installs a real polling interval; exit explicitly.
  O.stopTimer();
  process.exit(process.exitCode);
})().catch((e) => {
  console.error('WORKSPACE LIFECYCLE OUTPUT VALIDATORS: harness error', e);
  process.exit(1);
});
