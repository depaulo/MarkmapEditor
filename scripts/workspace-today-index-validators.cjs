#!/usr/bin/env node
'use strict';

/**
 * ACT 2C.1 — Today creation Index correction.
 *
 * The Today-created Note must enter the canonical physical collection and the
 * saved Index in the SAME turn, with no Workspace reopen.
 *
 * Executes the REAL shipped owners (package.json is type=module, so the ES
 * modules are imported directly and only the browser-script main.js helpers are
 * extracted verbatim, exactly as the ACT 1C/2A/2B/2C suites already do):
 *   - js/workspace/workspace-scanner.js    — the ACT 1B notes/ scanner
 *   - js/workspace/workspace-controller.js — refreshWorkspaceNotesStorage() and
 *     the real openToday() driven through WORKSPACE_API
 *   - js/workspace/workspace-parser.js      — the single parse owner
 *   - js/main.js                            — the real buildWorkspaceIndex()
 *
 * Nothing is re-implemented. The notes/ directory is a faithful fake File System
 * Access directory (getFileHandle with create + async values()), the controller
 * runs as shipped, and the Index is built by the real builder reading the real
 * WORKSPACE_STATE.files.notes.
 *
 * Contract under test (ACT 2C.1):
 *   - a newly created Today file enters files.notes immediately, exactly once;
 *   - the Index rebuilt from that list contains it exactly once — files,
 *     byPath and byKind.notes — with no Workspace reopen;
 *   - an existing Today file is not rewritten, not duplicated on the file, the
 *     storage record or the Index record, and triggers no extra physical scan;
 *   - starter content is written only on the initial creation;
 *   - a failed scan publishes no storage record and preserves the previous
 *     storage AND Index snapshots; a failed write publishes nothing at all;
 *   - no additional folder is created, no Sidebar markup changes, no Named Note
 *     and no new runtime module is added.
 *
 * 31 fixtures: T01-T10 immediate storage/Index visibility, D11-D16
 * no-duplicate proof, F17-F20 failure preservation, S21-S24 static boundary,
 * X25-X30 cross-package, N31 negative control.
 *
 * Usage: node scripts/workspace-today-index-validators.cjs
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

const SCANNER_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-scanner.js');
const STATE_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-state.js');
const CONTROLLER_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-controller.js');

// ACT 2C.1 must not change the release identity.
const APP_VERSION_BASELINE = 'markmap-journal-pwa-0.6.2-notes-workspace-foundation';

const results = [];
function record(id, name, ok, detail) {
  const d = typeof detail === 'function' ? detail() : detail;
  results.push({ id, name, ok: Boolean(ok), detail: ok || d == null ? '' : String(d) });
}
async function check(id, name, ok, detail) {
  // A fixture may be passed as a value, a thunk, or a promise. A thunk MUST be
  // invoked: coercing a function with Boolean() would report every fixture as
  // passing without ever evaluating it.
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
      const v = await value;
      record(id, name, v, detail);
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

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

// Verbatim extraction of top-level source (col-0 boundaries), identical to the
// helper the ACT 2C suite already uses.
function extractBlockFrom(src, startMarker, endLine = '}') {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error(`verbatim extraction failed: ${startMarker}`);
  let lineStart = src.indexOf('\n', start);
  if (lineStart === -1) throw new Error(`verbatim extraction failed: ${startMarker}`);
  lineStart += 1;
  while (lineStart <= src.length) {
    const nl = src.indexOf('\n', lineStart);
    const lineEnd = nl === -1 ? src.length : nl;
    const line = src.slice(lineStart, lineEnd);
    if (line === endLine) return src.slice(start, lineEnd);
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
// A faithful notes/ directory: getFileHandle({create}) + async values()
// ---------------------------------------------------------------
function makeNotesDirectory(name = 'notes') {
  const dir = {
    kind: 'directory',
    name,
    __files: new Map(),
    __scanCount: 0,
    __getFileHandleCalls: [],
    __scanError: null,

    async getFileHandle(childName, options = {}) {
      dir.__getFileHandleCalls.push(`${childName}${options.create ? ',create' : ''}`);

      if (!dir.__files.has(childName)) {
        if (!options.create) {
          const error = new Error(`${childName} not found`);
          error.name = 'NotFoundError';
          throw error;
        }
        dir.__files.set(childName, makeNotesFile(childName, ''));
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

function makeNotesFile(name, initialText) {
  const file = {
    kind: 'file',
    name,
    __text: initialText,
    __writeCount: 0,
    __writeError: null,
    lastModified: 1000,

    async getFile() {
      return {
        name,
        size: file.__text.length,
        lastModified: file.lastModified,
        text: async () => file.__text,
      };
    },

    async createWritable() {
      if (file.__writeError) throw file.__writeError;
      return {
        async write(text) {
          file.__pending = text;
        },
        async close() {
          file.__text = file.__pending;
          file.__writeCount += 1;
          file.lastModified += 1;
        },
      };
    },
  };

  return file;
}

// ---------------------------------------------------------------
// Browser shims
// ---------------------------------------------------------------

function installBrowserShims(state) {
  function defineGlobal(name, value) {
    try {
      globalThis[name] = value;
      if (globalThis[name] === value) return;
    } catch {
      /* fall through to defineProperty */
    }
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }

  function makeElement(id) {
    return {
      id,
      value: '',
      style: {},
      dataset: {},
      hidden: false,
      innerHTML: '',
      textContent: '',
      addEventListener() {},
      removeEventListener() {},
      appendChild() {},
      remove() {},
      setAttribute() {},
      getAttribute: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    };
  }

  const elements = new Map();
  const elementFor = (id) => {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  };

  globalThis.window = globalThis;
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init) {
      this.type = String(type || '');
      this.detail = init && init.detail;
    }
  };
  globalThis.document = {
    getElementById: (id) => elementFor(id),
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => makeElement('created'),
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
    body: makeElement('body'),
    documentElement: makeElement('html'),
  };

  defineGlobal('localStorage', {
    _store: new Map(),
    getItem(key) {
      return this._store.has(key) ? this._store.get(key) : null;
    },
    setItem(key, value) {
      this._store.set(key, String(value));
    },
    removeItem(key) {
      this._store.delete(key);
    },
  });

  globalThis.MME_APP = {
    log: (message) => state.logs.push(String(message)),
    showToast: (message, type) => state.toasts.push({ message: String(message), type }),
    openTextDocument: (payload) => {
      state.opened.push(payload);
      state.editorText = payload.text;
    },
    confirmDiscardIfDirty: () => state.discardAllowed,
  };

  globalThis.MME_NAVIGATION = {
    isNavigationInProgress: () => false,
    recordSuccessfulNavigation: (loc) => state.navigations.push(loc),
  };

  globalThis.guardUnsavedReportBeforeDocumentSwitch = async () => ({ ok: true, action: 'not-report' });
  globalThis.clearReportIdentityAfterTransition = () => {
    state.reportCleared += 1;
  };

  // The real Index lifecycle owner is debounced by the browser, so the recorded
  // reasons prove exactly how many rebuilds were requested.
  globalThis.scheduleWorkspaceIndexRebuild = (reason) => {
    state.rebuilds.push(String(reason));
  };
  globalThis.buildWorkspaceIndex = () => {
    state.indexBuilds += 1;
    return null;
  };

  for (const name of [
    'renderWorkspaceIndexSummary',
    'renderWorkspaceActivePanel',
    'renderWorkspaceRelatedPanel',
    'renderWorkspaceTagsPanel',
    'renderWorkspaceTasksPanel',
    'renderWorkspaceJournalTimeline',
    'updateWorkspaceJournalSidebarTitlesFromIndex',
    'updateWorkspaceActiveFileHighlight',
  ]) {
    globalThis[name] = () => {};
  }

  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  globalThis.dispatchEvent = () => true;
  globalThis.confirm = () => true;
  if (!globalThis.navigator) {
    defineGlobal('navigator', { userAgent: 'node-validator' });
  }
}

function resetShimState(state) {
  state.logs.length = 0;
  state.toasts.length = 0;
  state.opened.length = 0;
  state.navigations.length = 0;
  state.rebuilds.length = 0;
  state.indexBuilds = 0;
  state.reportCleared = 0;
  state.discardAllowed = true;
  state.editorText = '';
  return state;
}

function todayFileName() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}.md`;
}
// ---------------------------------------------------------------
// Suites
// ---------------------------------------------------------------

(async () => {
  const shimState = resetShimState({
    logs: [],
    toasts: [],
    opened: [],
    navigations: [],
    rebuilds: [],
    indexBuilds: 0,
    reportCleared: 0,
    discardAllowed: true,
    editorText: '',
  });
  installBrowserShims(shimState);

  // The shared kind normalizer + the main.js text helpers the saved Note parser
  // resolves by bare global name. Same verbatim approach as the existing suites.
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
      ...PARSER_HELPERS.map((marker) => extractBlockFrom(MAIN_SOURCE, marker)),
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

  const scannerModule = await import(pathToFileURL(SCANNER_PATH).href);
  await import(pathToFileURL(STATE_PATH).href);
  await import(pathToFileURL(CONTROLLER_PATH).href);

  const WORKSPACE_STATE = globalThis.WORKSPACE_STATE;
  const API = globalThis.WORKSPACE_API;

  if (!WORKSPACE_STATE || !API || typeof API.openToday !== 'function') {
    throw new Error('the real controller did not expose WORKSPACE_STATE / WORKSPACE_API');
  }

  // A freshly activated Workspace for each scenario: the ACT 1B activation
  // snapshot is taken with the real scanner, exactly as activation does it.
  async function openWorkspaceWith(dir) {
    WORKSPACE_STATE.rootHandle = { kind: 'directory', name: 'Workspace' };
    WORKSPACE_STATE.rootName = 'Workspace';
    WORKSPACE_STATE.folders.notes = dir;
    WORKSPACE_STATE.files.notes = await scannerModule.scanNotesFolder(dir);
    WORKSPACE_STATE.activeFile = null;
    resetShimState(shimState);
    return WORKSPACE_STATE.files.notes;
  }

  const today = todayFileName();
  const todayPath = `notes/${today}`;
  const todayDate = today.replace(/\.md$/, '');

  group('Immediate storage and Index visibility (T01-T10)');

  // --- Scenario 1: the first Today on an empty notes/ -----------------------
  const dir1 = makeNotesDirectory();
  await openWorkspaceWith(dir1);
  await API.openToday();

  const afterFirst = WORKSPACE_STATE.files.notes;

  await check(
    'T01',
    'the created file exists on disk exactly once',
    () =>
      dir1.__files.size === 1 &&
      dir1.__files.has(today) &&
      dir1.__getFileHandleCalls.filter((c) => c === `${today},create`).length === 1,
    () => JSON.stringify([...dir1.__files.keys()])
  );

  await check(
    'T02',
    'the new Today file enters files.notes immediately, without a reopen',
    () =>
      afterFirst.length === 1 &&
      afterFirst[0].kind === 'notes' &&
      afterFirst[0].name === today &&
      afterFirst[0].path === todayPath &&
      Boolean(afterFirst[0].handle),
    () => JSON.stringify(afterFirst.map((r) => r.path))
  );

  await check(
    'T03',
    'exactly one Index rebuild is scheduled for this Today',
    () => shimState.rebuilds.filter((r) => r === 'today').length === 1,
    () => JSON.stringify(shimState.rebuilds)
  );

  // The REAL Index build, straight after Today, with no reopen in between.
  await INDEX_API.buildWorkspaceIndex();

  await check(
    'T04',
    'the Index rebuilt immediately reports files=1 notes=1',
    () => IDX.ready === true && IDX.files.length === 1 && IDX.byKind.notes.length === 1,
    () => `ready=${IDX.ready} files=${IDX.files.length} notes=${IDX.byKind.notes.length}`
  );

  await check(
    'T05',
    'the Index contains the Today file exactly once',
    () => IDX.files.filter((f) => f.path === todayPath).length === 1,
    () => JSON.stringify(IDX.files.map((f) => f.path))
  );

  await check(
    'T06',
    'byPath contains the Today path exactly once',
    () =>
      IDX.byPath.has(todayPath) &&
      [...IDX.byPath.keys()].filter((p) => p === todayPath).length === 1,
    () => JSON.stringify([...IDX.byPath.keys()])
  );

  await check(
    'T07',
    'byKind.notes contains the Today Note exactly once',
    () => IDX.byKind.notes.filter((f) => f.path === todayPath).length === 1,
    () => JSON.stringify(IDX.byKind.notes.map((f) => f.path))
  );

  await check(
    'T08',
    'the parsed Index record is the real saved Note, with the starter title',
    () => {
      const record = IDX.byPath.get(todayPath);
      return Boolean(record) && record.kind === 'notes' && record.name === today &&
        record.title === todayDate && record.date === todayDate;
    },
    () => JSON.stringify((IDX.byPath.get(todayPath) || {}).title)
  );

  await check(
    'T09',
    'the active Note resolves to the exact created file and path',
    () => {
      const active = WORKSPACE_STATE.activeFile;
      return Boolean(active) && active.path === todayPath && active.kind === 'notes' &&
        active.handle === dir1.__files.get(today) &&
        afterFirst[0].handle === dir1.__files.get(today);
    },
    () => JSON.stringify(WORKSPACE_STATE.activeFile && WORKSPACE_STATE.activeFile.path)
  );

  await check(
    'T10',
    'the Today document was actually opened with the created file',
    () =>
      shimState.opened.length === 1 &&
      shimState.opened[0].fileName === today &&
      shimState.opened[0].fileHandle === dir1.__files.get(today),
    () => JSON.stringify(shimState.opened.map((o) => o.fileName))
  );

  group('No duplication on a second Today (D11-D16)');

  const writesAfterFirst = dir1.__files.get(today).__writeCount;
  const scansAfterFirst = dir1.__scanCount;
  const storageAfterFirst = WORKSPACE_STATE.files.notes.length;
  const firstText = dir1.__files.get(today).__text;

  resetShimState(shimState);
  await API.openToday();

  await check(
    'D11',
    'a second Today creates no second file',
    () => dir1.__files.size === 1,
    () => JSON.stringify([...dir1.__files.keys()])
  );

  await check(
    'D12',
    'a second Today does not rewrite the existing file',
    () =>
      dir1.__files.get(today).__writeCount === writesAfterFirst &&
      dir1.__files.get(today).__text === firstText,
    () => `writes=${dir1.__files.get(today).__writeCount}`
  );

  await check(
    'D13',
    'a second Today introduces no extra physical scan',
    () => dir1.__scanCount === scansAfterFirst,
    () => `scans=${dir1.__scanCount} (after first: ${scansAfterFirst})`
  );

  await check(
    'D14',
    'a second Today does not duplicate the storage record',
    () =>
      WORKSPACE_STATE.files.notes.length === storageAfterFirst &&
      WORKSPACE_STATE.files.notes.filter((r) => r.path === todayPath).length === 1,
    () => JSON.stringify(WORKSPACE_STATE.files.notes.map((r) => r.path))
  );

  await INDEX_API.buildWorkspaceIndex();

  await check(
    'D15',
    'a second Today does not duplicate the Index record',
    () =>
      IDX.files.filter((f) => f.path === todayPath).length === 1 &&
      IDX.byKind.notes.filter((f) => f.path === todayPath).length === 1 &&
      IDX.files.length === 1,
    () => `files=${IDX.files.length} notes=${IDX.byKind.notes.length}`
  );

  await check(
    'D16',
    'starter content was written only on the initial creation',
    () =>
      dir1.__files.get(today).__writeCount === 1 &&
      new RegExp(`^# ${todayDate}`).test(firstText),
    () => `writeCount=${dir1.__files.get(today).__writeCount}`
  );

  group('Failure preservation (F17-F20)');

  // --- Scenario 2: the starter write fails ----------------------------------
  const dir2 = makeNotesDirectory();
  await openWorkspaceWith(dir2);
  // The failure is injected on the handle Today creates, so createWritable throws.
  const originalGetFileHandle = dir2.getFileHandle.bind(dir2);
  dir2.getFileHandle = async (name, options = {}) => {
    const handle = await originalGetFileHandle(name, options);
    handle.__writeError = new Error('simulated write failure');
    return handle;
  };

  resetShimState(shimState);
  await API.openToday();

  await check(
    'F17',
    'a failed starter write publishes no storage record',
    () => WORKSPACE_STATE.files.notes.every((r) => r.path !== todayPath),
    () => JSON.stringify(WORKSPACE_STATE.files.notes.map((r) => r.path))
  );

  await check(
    'F18',
    'a failed starter write opens no document and schedules no rebuild',
    () =>
      shimState.opened.length === 0 &&
      shimState.rebuilds.length === 0 &&
      WORKSPACE_STATE.activeFile === null,
    () => `opened=${shimState.opened.length} rebuilds=${JSON.stringify(shimState.rebuilds)}`
  );

  // --- Scenario 3: the scan fails -------------------------------------------
  const dir3 = makeNotesDirectory();
  // One pre-existing Note, so there is a real previous storage snapshot.
  const alpha = await dir3.getFileHandle('alpha.md', { create: true });
  alpha.__text = '# Alpha\n\nbody\n';

  await openWorkspaceWith(dir3);
  const storageBefore = JSON.stringify(WORKSPACE_STATE.files.notes.map((r) => r.path));
  await INDEX_API.buildWorkspaceIndex();
  const indexBefore = JSON.stringify({
    files: IDX.files.map((f) => f.path),
    ready: IDX.ready,
  });

  dir3.__scanError = new Error('simulated iteration failure');
  resetShimState(shimState);
  await API.openToday();

  await check(
    'F19',
    'a failed scan preserves the previous storage snapshot exactly',
    () => JSON.stringify(WORKSPACE_STATE.files.notes.map((r) => r.path)) === storageBefore,
    () =>
      `${storageBefore} -> ${JSON.stringify(WORKSPACE_STATE.files.notes.map((r) => r.path))}`
  );

  await check(
    'F20',
    'a failed scan schedules no Index rebuild and preserves the published Index',
    () =>
      shimState.rebuilds.length === 0 &&
      JSON.stringify({ files: IDX.files.map((f) => f.path), ready: IDX.ready }) === indexBefore,
    () => `rebuilds=${JSON.stringify(shimState.rebuilds)} index=${indexBefore}`
  );

  group('Static boundary and non-touch (S21-S24)');

  const todayBlock = extractBlockFrom(CONTROLLER_SOURCE, 'async function openToday() {');
  const refreshBlock = extractBlockFrom(
    CONTROLLER_SOURCE,
    'async function refreshWorkspaceNotesStorage() {'
  );
  const todayCode = stripComments(todayBlock);
  const refreshCode = stripComments(refreshBlock);

  await check(
    'S21',
    'the refresh reuses the existing scanner and the ACT 1B validator, one assignment',
    () =>
      /scanNotesFolder\(/.test(refreshCode) &&
      /validateNotesWorkspaceSnapshot\(/.test(refreshCode) &&
      /buildNotesWorkspaceSnapshot\(/.test(refreshCode) &&
      // no parallel authoritative list: exactly one assignment to the collection
      (refreshCode.match(/WORKSPACE_STATE\.files\.notes\s*=/g) || []).length === 1,
    () => 'scanner + ACT 1B validator, single assignment'
  );

  await check(
    'S22',
    'the refresh never re-opens the root, never creates notes/ and never reads content',
    () =>
      !/(getDirectoryHandle|getFileHandle|createWritable|removeEntry)\s*\(/.test(refreshCode) &&
      !/create:\s*true/.test(refreshCode) &&
      !/\.getFile\s*\(/.test(refreshCode),
    () => refreshCode.replace(/\s+/g, ' ').slice(0, 200)
  );

  await check(
    'S23',
    'Today performs one refresh and one rebuild, and adds no creation or Sidebar surface',
    () =>
      (todayCode.match(/scheduleWorkspaceIndexRebuild/g) || []).length === 1 &&
      (todayCode.match(/refreshWorkspaceNotesStorage\(/g) || []).length === 1 &&
      !/function createNewNote/.test(MAIN_SOURCE + CONTROLLER_SOURCE) &&
      !/ACT 2C\.1/.test(
        extractBlockFrom(CONTROLLER_SOURCE, 'function refreshWorkspaceSidebar(')
      ),
    () => 'one refresh, one rebuild, no new creation UI, Sidebar untouched'
  );

  await check(
    'S24',
    'no new runtime module, no version/cache change and no metadata writer',
    () =>
      !fs.existsSync(path.join(ROOT, 'js', 'workspace', 'workspace-today.js')) &&
      read('sw.js').includes(APP_VERSION_BASELINE) &&
      !/function (setFrontmatter|writeFrontmatter|removeManagedKey)/.test(
        MAIN_SOURCE + CONTROLLER_SOURCE
      ),
    () => 'no new module; sw.js identity unchanged'
  );

  group('Cross-package (X25-X30)');

  const CROSS = [
    ['X25', 'ACT 1A/1B storage validators remain green', () =>
      /WORKSPACE STORAGE VALIDATORS: 199 passed, 0 failed/.test(
        runNode('scripts/workspace-storage-validators.cjs')
      )],
    ['X26', 'ACT 1C Index validators remain green', () =>
      /WORKSPACE INDEX NOTES VALIDATORS: 58 passed, 0 failed/.test(
        runNode('scripts/workspace-index-notes-validators.cjs')
      )],
    ['X27', 'ACT 2A discovery consumers remain green', () =>
      /WORKSPACE DISCOVERY CONSUMERS VALIDATORS: 52 passed, 0 failed/.test(
        runNode('scripts/workspace-discovery-consumers-validators.cjs')
      )],
    ['X28', 'ACT 2B task consumers remain green', () =>
      /WORKSPACE TASK CONSUMERS VALIDATORS: 62 passed, 0 failed/.test(
        runNode('scripts/workspace-task-consumers-validators.cjs')
      )],
    ['X29', 'ACT 2C lifecycle/output consumers remain green', () =>
      /WORKSPACE LIFECYCLE OUTPUT VALIDATORS: 67 passed, 0 failed/.test(
        runNode('scripts/workspace-lifecycle-output-validators.cjs')
      )],
    ['X30', 'release parity holds at the current accepted identity', () => {
      const out = runNode('scripts/release-parity.cjs');
      return (
        /RELEASE PARITY OK/.test(out) &&
        out.includes('0.6.2') &&
        out.includes(APP_VERSION_BASELINE)
      );
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

  // Negative control: the T04/T05 assertions are not vacuous. Without the
  // refresh, the storage list stays stale and the Index is empty.
  group('Harness negative control (N31)');

  await check(
    'N31',
    'without the refresh the same Index build is empty (proves the fixtures bite)',
    async () => {
      const dirN = makeNotesDirectory();
      await openWorkspaceWith(dirN);

      // Create the physical file WITHOUT running Today (no refresh): this is
      // exactly the pre-fix state — storage stale, Index empty.
      await dirN.getFileHandle(today, { create: true });
      await INDEX_API.buildWorkspaceIndex();

      return dirN.__files.size === 1 && IDX.files.length === 0;
    },
    () => 'stale storage yields an empty Index'
  );

  const failed = results.filter((entry) => !entry.group && !entry.ok);
  const passed = results.filter((entry) => !entry.group && entry.ok);

  for (const entry of results) {
    if (entry.group) {
      console.log('\n' + entry.group);
      continue;
    }
    console.log(
      `${entry.ok ? 'PASS' : 'FAIL'} [${entry.id}] ${entry.name}${entry.ok ? '' : ` — ${entry.detail}`}`
    );
  }

  console.log(`\nWORKSPACE TODAY INDEX VALIDATORS: ${passed.length} passed, ${failed.length} failed`);
  process.exitCode = failed.length === 0 ? 0 : 1;
})().catch((error) => {
  console.error('WORKSPACE TODAY INDEX VALIDATORS: harness error', error);
  process.exit(1);
});
