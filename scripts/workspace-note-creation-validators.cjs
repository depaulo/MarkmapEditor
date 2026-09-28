#!/usr/bin/env node
'use strict';

/**
 * ACT 5 — Unified Note creation.
 *
 * Exercises the REAL shipped owners (package.json is type=module, so the
 * controller is imported directly):
 *   - js/workspace/workspace-scanner.js    — the ACT 1B notes/ scanner
 *   - js/workspace/workspace-controller.js — buildNamedNoteFileName,
 *     buildNamedNoteStarterMarkdown, refreshWorkspaceNotesStorage,
 *     openNamedNoteModal, closeNamedNoteModal, createNamedNote, openToday
 *   - js/workspace/workspace-parser.js      — the saved parse owner
 *   - js/main.js                            — the real buildWorkspaceIndex()
 *
 * Nothing is re-implemented. notes/ is a faithful fake File System Access
 * directory, the controller runs as shipped through WORKSPACE_API, and the
 * Index is the real builder reading the real WORKSPACE_STATE.files.notes.
 *
 * 34 fixtures: C01-C09 filename validation, M10-M17 modal + starter,
 * T18-T26 transaction, S27-S30 Today preservation, N31-N34 non-touch.
 *
 * Usage: node scripts/workspace-note-creation-validators.cjs
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

const MAIN_SOURCE = read('js', 'main.js');
const CONTROLLER_SOURCE = read('js', 'workspace', 'workspace-controller.js');
const PARSER_SOURCE = read('js', 'workspace', 'workspace-parser.js');
const INDEX_HTML = read('index.html');

const SCANNER_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-scanner.js');
const STATE_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-state.js');
const CONTROLLER_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-controller.js');

const APP_VERSION_BASELINE = 'markmap-journal-pwa-0.6.1-foundation-closure';

const results = [];
function record(id, name, ok, detail) {
  const d = typeof detail === 'function' ? detail() : detail;
  results.push({ id, name, ok: Boolean(ok), detail: ok || d == null ? '' : String(d) });
}
async function check(id, name, ok, detail) {
  // A fixture may be a value, a thunk or a promise. A thunk MUST be invoked:
  // coercing a function with Boolean() would report it passing unevaluated.
  let value = ok;

  if (typeof value === 'function') {
    try {
      value = value();
    } catch (e) {
      record(id, name, false, e && e.message ? e.message : String(e));
      return;
    }
  }

  if (value && typeof value.then === 'function') {
    try {
      record(id, name, await value, detail);
    } catch (e) {
      record(id, name, false, e && e.message ? e.message : String(e));
    }
    return;
  }

  record(id, name, value, detail);
}
function group(title) {
  results.push({ group: title });
}

function extractBlockFrom(src, startMarker, endLine = '}') {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error(`verbatim extraction failed: ${startMarker}`);
  let lineStart = src.indexOf('\n', start) + 1;
  while (lineStart <= src.length) {
    const nl = src.indexOf('\n', lineStart);
    const lineEnd = nl === -1 ? src.length : nl;
    if (src.slice(lineStart, lineEnd) === endLine) return src.slice(start, lineEnd);
    if (nl === -1) break;
    lineStart = nl + 1;
  }
  throw new Error(`verbatim extraction never closed: ${startMarker}`);
}

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

// ---------------------------------------------------------------
// Harness: a faithful notes/ directory + browser shims
// ---------------------------------------------------------------

function makeNotesFileHandle(name, initialText = '') {
  const handle = {
    kind: 'file',
    name,
    __text: initialText,
    __writeCount: 0,
    lastModified: 1000,
    async getFile() {
      return {
        name,
        size: handle.__text.length,
        lastModified: handle.lastModified,
        text: async () => handle.__text,
      };
    },
    async createWritable() {
      return {
        async write(text) {
          handle.__pending = text;
        },
        async close() {
          handle.__text = handle.__pending;
          handle.__writeCount += 1;
          handle.lastModified += 1;
        },
      };
    },
  };
  return handle;
}

function makeNotesDirectory(name = 'notes') {
  const dir = {
    kind: 'directory',
    name,
    __files: new Map(),
    __getFileHandleCalls: [],
    __scanCount: 0,
    __scanError: null,
    async getFileHandle(childName, options = {}) {
      dir.__getFileHandleCalls.push(`${childName}${options.create ? ',create' : ''}`);

      if (!dir.__files.has(childName)) {
        if (!options.create) {
          const error = new Error(`${childName} not found`);
          error.name = 'NotFoundError';
          throw error;
        }
        dir.__files.set(childName, makeNotesFileHandle(childName, ''));
      }

      return dir.__files.get(childName);
    },
    async *values() {
      dir.__scanCount += 1;
      if (dir.__scanError) throw dir.__scanError;
      for (const handle of dir.__files.values()) yield handle;
    },
  };
  return dir;
}

const h = { logs: [], toasts: [], opened: [], navigations: [], rebuilds: [], reports: 0 };
globalThis.__h = h;

const dom = {};
function makeEl(id) {
  const el = {
    id,
    value: '',
    style: { display: '' },
    dataset: {},
    hidden: false,
    innerHTML: '',
    textContent: '',
    checked: false,
    disabled: false,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    remove() {},
    setAttribute() {},
    getAttribute: () => null,
    focus() {},
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  return el;
}

for (const id of [
  'namedNoteModal', 'namedNoteName', 'namedNoteDate', 'namedNoteKnowledge',
  'namedNoteError', 'namedNoteCreate', 'namedNoteCancel', 'namedNoteClose',
  'btnJournalToday', 'btnNewConcept', 'btnArchiveActive', 'workspaceTitle',
  'workspaceJournalsList', 'workspaceConceptsList', 'workspaceJournalsBadge',
  'workspaceConceptsBadge',
]) {
  dom[id] = makeEl(id);
}

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
  activeElement: null,
};
globalThis.MME_NAVIGATION = {
  isNavigationInProgress: () => false,
  recordSuccessfulNavigation: (loc) => h.navigations.push(loc),
};
globalThis.guardUnsavedReportBeforeDocumentSwitch = async () => ({ ok: true, action: 'not-report' });
globalThis.clearReportIdentityAfterTransition = () => {
  h.reports += 1;
};
globalThis.updateWorkspaceActiveFileHighlight = () => {};
globalThis.scheduleWorkspaceIndexRebuild = (reason) => h.rebuilds.push(String(reason));
globalThis.MME_APP = {
  log: (m) => h.logs.push(String(m)),
  showToast: (m, t) => h.toasts.push({ message: String(m), type: t }),
  openTextDocument: (o) => {
    h.opened.push(o);
    h.currentSaveHandle = o.fileHandle || null;
  },
  confirmDiscardIfDirty: () => h.discardAllowed !== false,
  isDirty: () => false,
  setWritableHandleForCurrentFile: () => {},
};

(async () => {
  // The shared parser + helpers, verbatim (the real saved parse owner).
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
      ...PARSER_HELPERS.map((m) => extractBlockFrom(MAIN_SOURCE, m)),
    ].join('\n\n')
  );
  (0, eval)(PARSER_SOURCE);

  if (typeof globalThis.parseWorkspaceDocument !== 'function') {
    throw new Error('parseWorkspaceDocument not exposed');
  }

  globalThis.__indexLogs = [];

  // The REAL Index builder, verbatim, reading the REAL WORKSPACE_STATE.
  const INDEX_API = new Function(
    [
      'const log = (m) => globalThis.__indexLogs.push(String(m));',
      extractBlockFrom(MAIN_SOURCE, 'const WORKSPACE_INDEX_STATE = {', '};'),
      extractBlockFrom(MAIN_SOURCE, 'try {\n  window.WORKSPACE_INDEX_STATE', '} catch {}'),
      extractBlockFrom(MAIN_SOURCE, 'async function readWorkspaceFileText('),
      extractBlockFrom(MAIN_SOURCE, 'async function buildWorkspaceIndex('),
    ].join('\n\n') + '\nreturn { WORKSPACE_INDEX_STATE, buildWorkspaceIndex };'
  )();

  globalThis.WORKSPACE_INDEX_STATE = INDEX_API.WORKSPACE_INDEX_STATE;
  const IDX = globalThis.WORKSPACE_INDEX_STATE;

  for (const name of [
    'renderWorkspaceIndexSummary', 'renderWorkspaceActivePanel',
    'renderWorkspaceRelatedPanel', 'renderWorkspaceTagsPanel',
    'renderWorkspaceTasksPanel', 'renderWorkspaceJournalTimeline',
    'renderWorkspaceKnowledgePanel', 'updateWorkspaceJournalSidebarTitlesFromIndex',
  ]) {
    globalThis[name] = () => {};
  }
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init) {
      this.type = String(type || '');
      this.detail = init && init.detail;
    }
  };
  globalThis.dispatchEvent = () => true;

  const scannerModule = await import(pathToFileURL(SCANNER_PATH).href);
  await import(pathToFileURL(STATE_PATH).href);
  await import(pathToFileURL(CONTROLLER_PATH).href);

  const WORKSPACE_STATE = globalThis.WORKSPACE_STATE;
  const API = globalThis.WORKSPACE_API;

  if (!WORKSPACE_STATE || !API || typeof API.createNamedNote !== 'function') {
    throw new Error('the real controller did not expose the ACT 5 creation owners');
  }

  function resetHarness() {
    h.logs.length = 0;
    h.toasts.length = 0;
    h.opened.length = 0;
    h.navigations.length = 0;
    h.rebuilds.length = 0;
    h.reports = 0;
    h.discardAllowed = true;
    h.currentSaveHandle = null;
    dom.namedNoteName.value = '';
    dom.namedNoteDate.value = '';
    dom.namedNoteKnowledge.checked = false;
    dom.namedNoteError.textContent = '';
    dom.namedNoteModal.style.display = 'none';
  }

  async function openWorkspaceWith(dir) {
    WORKSPACE_STATE.rootHandle = { kind: 'directory', name: 'Workspace' };
    WORKSPACE_STATE.rootName = 'Workspace';
    WORKSPACE_STATE.folders.notes = dir;
    WORKSPACE_STATE.files.notes = await scannerModule.scanNotesFolder(dir);
    WORKSPACE_STATE.activeFile = null;
    resetHarness();
    return WORKSPACE_STATE.files.notes;
  }

  group('Filename validation (C01-C09)');

  const name = API.buildNamedNoteFileName;
  const starter = API.buildNamedNoteStarterMarkdown;

  await check('C01', 'a plain name is accepted and .md is appended', () => {
    const r = name('Project plan');
    return r.ok === true && r.fileName === 'Project plan.md' && r.title === 'Project plan';
  }, () => 'appended');

  await check('C02', 'an existing .md extension is not doubled', () => {
    const r = name('Project plan.md');
    return r.ok === true && r.fileName === 'Project plan.md';
  }, () => 'idempotent extension');

  await check('C03', 'an empty or whitespace-only name is rejected', () => {
    return name('').ok === false && name('   ').ok === false &&
      name('   ').reason === 'empty-name' && name(null).ok === false;
  }, () => 'empty rejected');

  await check('C04', 'filesystem-invalid characters are rejected', () => {
    const bad = ['a/b', 'a:b', 'a*b', 'a?b', 'a"b', 'a<b', 'a>b', 'a|b'];
    return bad.every((v) => name(v).ok === false && name(v).reason === 'invalid-characters');
  }, () => 'all invalid chars rejected');

  await check('C05', 'meaningful Unicode names are preserved', () => {
    const r = name('Café notes — 日本語');
    return r.ok === true && r.fileName === 'Café notes — 日本語.md' && r.title === 'Café notes — 日本語';
  }, () => 'unicode preserved');

  await check('C06', 'the reserved Today filename pattern is rejected', () => {
    return name('2026-03-04').reason === 'reserved-today-name' &&
      name('2026-03-04.md').reason === 'reserved-today-name' &&
      name('2026-03-04.MD').reason === 'reserved-today-name';
  }, () => 'today reserved');

  await check('C07', 'reserved device basenames are rejected', () => {
    return name('CON').reason === 'reserved-name' && name('lpt1').reason === 'reserved-name';
  }, () => 'device names rejected');

  await check('C08', 'no automatic numeric suffix is ever invented', () => {
    const r = name('2026-03-04');
    return r.ok === false && !/\d-\d\.md$/.test(String(r.fileName));
  }, () => 'no suffix');

  await check('C09', 'validation is pure: no handle, no state', () => {
    const dir = makeNotesDirectory();
    const before = dir.__getFileHandleCalls.length;
    name('Anything');
    name('bad/name');
    return dir.__getFileHandleCalls.length === before;
  }, () => 'no filesystem access during validation');

  group('Starter and modal (M10-M17)');

  await check('M10', 'a dated note writes date-only frontmatter', () => {
    const text = starter({ title: 'Plan', date: '2026-03-04', knowledge: false });
    return text.startsWith('---\ndate: 2026-03-04\n---\n') && text.includes('# Plan');
  }, () => 'date only');

  await check('M11', 'a cleared date produces an Undated note with no frontmatter', () => {
    const text = starter({ title: 'Plan', date: '', knowledge: false });
    return !text.startsWith('---') && !/date:/.test(text) && text.startsWith('# Plan');
  }, () => 'undated');

  await check('M12', 'knowledge true is written only when selected', () => {
    const on = starter({ title: 'P', date: '', knowledge: true });
    const off = starter({ title: 'P', date: '', knowledge: false });
    return on.includes('knowledge: true') && !off.includes('knowledge:');
  }, () => 'knowledge flag');

  await check('M13', 'no required type key is written', () => {
    const text = starter({ title: 'P', date: '2026-01-01', knowledge: true });
    return !/type:\s*note/.test(text) && !/type:/.test(text);
  }, () => 'no type key');

  await check('M14', 'pin is never written by creation', () => {
    const text = starter({ title: 'P', date: '', knowledge: true });
    return !/pinned/.test(text);
  }, () => 'no automatic pin');

  await check('M15', 'opening the modal creates no file and no handle', async () => {
    const dir = makeNotesDirectory();
    await openWorkspaceWith(dir);
    const before = dir.__getFileHandleCalls.length;
    const opened = API.openNamedNoteModal();
    return opened === true && dir.__getFileHandleCalls.length === before &&
      dir.__files.size === 0 && dom.namedNoteModal.style.display === 'block';
  }, () => 'modal open is inert');

  await check('M16', 'the modal defaults date to local today and clears knowledge', async () => {
    const dir = makeNotesDirectory();
    await openWorkspaceWith(dir);
    API.openNamedNoteModal();
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
    return dom.namedNoteDate.value === expected && dom.namedNoteKnowledge.checked === false &&
      dom.namedNoteName.value === '';
  }, () => 'defaults correct');

  await check('M17', 'Cancel closes with zero side effects', async () => {
    const dir = makeNotesDirectory();
    await openWorkspaceWith(dir);
    API.openNamedNoteModal();
    dom.namedNoteName.value = 'Should not exist';
    const before = {
      files: dir.__files.size,
      handles: dir.__getFileHandleCalls.length,
      storage: WORKSPACE_STATE.files.notes.length,
    };
    API.closeNamedNoteModal();
    return dom.namedNoteModal.style.display === 'none' &&
      dir.__files.size === before.files &&
      dir.__getFileHandleCalls.length === before.handles &&
      WORKSPACE_STATE.files.notes.length === before.storage;
  }, () => 'cancel is a pure close');

  group('Creation transaction (T18-T26)');

  // --- Scenario 1: successful dated Named Note ------------------------------
  const dirA = makeNotesDirectory();
  await openWorkspaceWith(dirA);
  dom.namedNoteName.value = 'Project plan';
  dom.namedNoteDate.value = '2026-03-04';
  dom.namedNoteKnowledge.checked = false;
  const created = await API.createNamedNote();

  await check('T18', 'creation succeeds and returns the exact path', () =>
    created.ok === true && created.path === 'notes/Project plan.md' &&
    created.fileName === 'Project plan.md',
  () => JSON.stringify(created));

  await check('T19', 'the starter is written exactly once', () =>
    dirA.__files.get('Project plan.md').__writeCount === 1 && dirA.__files.size === 1,
  () => `writes=${dirA.__files.get('Project plan.md')?.__writeCount}`);

  await check('T20', 'the storage record is added exactly once', () =>
    WORKSPACE_STATE.files.notes.length === 1 &&
    WORKSPACE_STATE.files.notes[0].path === 'notes/Project plan.md' &&
    WORKSPACE_STATE.files.notes[0].kind === 'notes',
  () => JSON.stringify(WORKSPACE_STATE.files.notes.map((r) => r.path)));

  await INDEX_API.buildWorkspaceIndex();

  await check('T21', 'the Index record is added exactly once', () =>
    IDX.files.filter((f) => f.path === 'notes/Project plan.md').length === 1 &&
    IDX.byPath.has('notes/Project plan.md') && IDX.byKind.notes.length === 1,
  () => `files=${IDX.files.length}`);

  await check('T22', 'the exact path is opened and the handle adopted', () =>
    h.opened.length === 1 &&
    h.opened[0].fileName === 'Project plan.md' &&
    h.opened[0].fileHandle === dirA.__files.get('Project plan.md') &&
    h.currentSaveHandle === dirA.__files.get('Project plan.md') &&
    WORKSPACE_STATE.activeFile.path === 'notes/Project plan.md',
  () => 'opened + adopted');

  await check('T23', 'exactly one Index rebuild is scheduled', () =>
    h.rebuilds.length === 1 && h.rebuilds[0] === 'named note',
  () => JSON.stringify(h.rebuilds));

  await check('T24', 'navigation is recorded by path, never by H1', () =>
    h.navigations.length === 1 &&
    h.navigations[0].path === 'notes/Project plan.md' &&
    h.navigations[0].type === 'workspace-file' &&
    !('title' in h.navigations[0]),
  () => JSON.stringify(h.navigations[0] || null));

  await check('T25', 'creation writes no other file', () =>
    dirA.__files.size === 1 && [...dirA.__files.keys()].every((k) => k === 'Project plan.md'),
  () => JSON.stringify([...dirA.__files.keys()]));

  await check('T26', 'an existing filename is rejected and never overwritten', async () => {
    resetHarness();
    dom.namedNoteName.value = 'Project plan';
    const beforeText = dirA.__files.get('Project plan.md').__text;
    const beforeWrites = dirA.__files.get('Project plan.md').__writeCount;
    const res = await API.createNamedNote();
    return res.ok === false && res.reason === 'name-exists' &&
      dirA.__files.get('Project plan.md').__text === beforeText &&
      dirA.__files.get('Project plan.md').__writeCount === beforeWrites &&
      WORKSPACE_STATE.files.notes.length === 1;
  }, () => 'collision rejected');

  // --- Scenario 2: Knowledge Named Note -------------------------------------
  const dirB = makeNotesDirectory();
  await openWorkspaceWith(dirB);
  dom.namedNoteName.value = 'Reference';
  dom.namedNoteDate.value = '';
  dom.namedNoteKnowledge.checked = true;
  const knowledgeRes = await API.createNamedNote();
  await INDEX_API.buildWorkspaceIndex();

  await check('T27', 'a Knowledge Named Note is created in notes/, never concepts/', () => {
    const record = IDX.byPath.get('notes/Reference.md');
    return knowledgeRes.ok === true && dirB.__files.has('Reference.md') &&
      record.knowledge === true && record.path === 'notes/Reference.md';
  }, () => 'knowledge in notes');

  await check('T28', 'an Undated Knowledge Note has no date', () => {
    const record = IDX.byPath.get('notes/Reference.md');
    return record.date === '' && !/date:/.test(dirB.__files.get('Reference.md').__text);
  }, () => 'undated');

  await check('T29', 'an empty name creates no handle and no file', async () => {
    const dir = makeNotesDirectory();
    await openWorkspaceWith(dir);
    dom.namedNoteName.value = '   ';
    const res = await API.createNamedNote();
    return res.ok === false && res.reason === 'empty-name' && dir.__files.size === 0 &&
      dir.__getFileHandleCalls.length === 0;
  }, () => 'no handle requested');

  await check('T30', 'a failed storage refresh publishes no false record', async () => {
    const dir = makeNotesDirectory();
    await openWorkspaceWith(dir);
    dir.__scanError = new Error('simulated scan failure');
    dom.namedNoteName.value = 'Rollback';
    const res = await API.createNamedNote();
    return WORKSPACE_STATE.files.notes.every((r) => r.path !== 'notes/Rollback.md') &&
      h.rebuilds.length === 0 && res.ok === true;
  }, () => 'refresh failed -> no rebuild, no false record');

  group('Today preservation (T31-T33)');

  const todayName = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}.md`;
  })();

  const dirT = makeNotesDirectory();
  await openWorkspaceWith(dirT);
  await API.openToday();

  await check('T31', 'Today still creates and opens notes/YYYY-MM-DD.md', () =>
    dirT.__files.size === 1 && dirT.__files.has(todayName) &&
    WORKSPACE_STATE.activeFile.path === `notes/${todayName}` &&
    WORKSPACE_STATE.files.notes.length === 1,
  () => JSON.stringify([...dirT.__files.keys()]));

  const todayWrites = dirT.__files.get(todayName).__writeCount;
  const todayText = dirT.__files.get(todayName).__text;

  await check('T32', 'a second Today does not duplicate or rewrite', async () => {
    resetHarness();
    await API.openToday();
    return dirT.__files.size === 1 &&
      dirT.__files.get(todayName).__writeCount === todayWrites &&
      dirT.__files.get(todayName).__text === todayText &&
      WORKSPACE_STATE.files.notes.length === 1;
  }, () => 'no duplicate');

  await check('T33', 'Today and Named Note share one storage model', () => {
    const record = WORKSPACE_STATE.files.notes[0];
    return record.kind === 'notes' && record.path === `notes/${todayName}` &&
      /^\d{4}-\d{2}-\d{2}\.md$/.test(record.name);
  }, () => 'same canonical model');

  group('Non-touch (N34-N35)');

  await check('N34', 'the creation path never touches concepts/ or moves files', () => {
    const creation =
      extractBlockFrom(CONTROLLER_SOURCE, 'function buildNamedNoteFileName(rawName) {') +
      extractBlockFrom(CONTROLLER_SOURCE, 'async function createNamedNote() {');
    return !/concepts/.test(creation) && !/\bremoveEntry\b|\brename\b/.test(creation);
  }, () => 'no concepts, no move');

  await check('N35', 'creation adds no metadata writer and no metadata actions', () => {
    // ACT 5 forbade a premature metadata writer because ACT 6 had not landed.
    // ACT 6 now owns exactly ONE writer, so the contract becomes narrower and
    // stricter: creation itself must still contain no writer, and there must be
    // exactly one patcher in the codebase.
    const creation = extractBlockFrom(CONTROLLER_SOURCE, 'async function createNamedNote() {') +
      extractBlockFrom(CONTROLLER_SOURCE, 'function buildNamedNoteStarterMarkdown({ title, date, knowledge }) {');
    const writers = (MAIN_SOURCE + CONTROLLER_SOURCE)
      .match(/function patchNoteMetadata\(/g) || [];
    return !/patchNoteMetadata|removeManagedKey/.test(creation) &&
      !/function (setFrontmatter|writeFrontmatter|removeManagedKey)/.test(creation) &&
      writers.length === 1;
  }, () => 'single writer, not used by creation');

  const failed = results.filter((e) => !e.group && !e.ok);
  const passed = results.filter((e) => !e.group && e.ok);

  for (const e of results) {
    if (e.group) {
      console.log('\n' + e.group);
      continue;
    }
    console.log(`${e.ok ? 'PASS' : 'FAIL'} [${e.id}] ${e.name}${e.ok ? '' : ` — ${e.detail}`}`);
  }

  console.log(`\nWORKSPACE NOTE CREATION VALIDATORS: ${passed.length} passed, ${failed.length} failed`);
  process.exitCode = failed.length === 0 ? 0 : 1;
})().catch((error) => {
  console.error('WORKSPACE NOTE CREATION VALIDATORS: harness error', error);
  process.exit(1);
});
