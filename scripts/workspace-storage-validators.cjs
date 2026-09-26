#!/usr/bin/env node
'use strict';

/**
 * ACT 1B — Workspace initialization + notes/ storage validators.
 *
 * Executes the REAL shipped owners in Node (package.json is type=module):
 *   - js/workspace/workspace-open.js       (detection + the only ACT 1B writer)
 *   - js/workspace/workspace-scanner.js    (notes/ storage scanner)
 *   - js/workspace/workspace-state.js      (canonical storage state)
 *   - js/workspace/workspace-controller.js (openWorkspace() transaction)
 *
 * Nothing is re-implemented: the controller is driven through its own global
 * WORKSPACE_API against a shimmed window/document, directory handles are
 * recording traps (every mutating API records instead of executing), and the
 * scanner/state owners are imported directly.
 *
 * Contract under test (ACT 1B):
 *   - WORKSPACE_STATE is exactly { rootHandle, rootName, folders.notes,
 *     files.notes, activeFile } with no legacy fields, aliases or getters;
 *   - `empty` and `uninitialized` require an explicit confirmation, and only
 *     then is exactly one directory created: notes/;
 *   - a valid notes/ Workspace reuses the detected handle (no create, no handle
 *     request) and is activated at one controlled boundary;
 *   - the scan is read-only, direct, .md-only and metadata-free;
 *   - every rejected, declined, failed or canceled outcome preserves the
 *     previously active Workspace, editor buffer, currentSaveHandle, navigation
 *     history, Sidebar lists and localStorage;
 *   - no consumer adaptation; the controller never invokes the parser itself,
 *     and exactly one Workspace Index build is requested only AFTER a
 *     successful storage activation (the narrow ACT 1C lifecycle wiring).
 *
 * Usage: node scripts/workspace-storage-validators.cjs
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const OPEN_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-open.js');
const SCANNER_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-scanner.js');
const STATE_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-state.js');
const CONTROLLER_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-controller.js');
const SW_PATH = path.join(ROOT, 'sw.js');
const INDEX_PATH = path.join(ROOT, 'index.html');

const OPEN_SOURCE = fs.readFileSync(OPEN_PATH, 'utf8');
const SCANNER_SOURCE = fs.readFileSync(SCANNER_PATH, 'utf8');
const STATE_SOURCE = fs.readFileSync(STATE_PATH, 'utf8');
const CONTROLLER_SOURCE = fs.readFileSync(CONTROLLER_PATH, 'utf8');
const SW_SOURCE = fs.readFileSync(SW_PATH, 'utf8');
const INDEX_SOURCE = fs.readFileSync(INDEX_PATH, 'utf8');

// ACT 1B must not change the release identity or the offline shell.
const APP_VERSION_BASELINE = 'markmap-journal-pwa-0.6.1-foundation-closure';

const results = [];
function check(id, name, ok, detail) {
  results.push({ id, name, ok: Boolean(ok), detail: detail == null ? '' : String(detail) });
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

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) return '';

  const end = endMarker ? source.indexOf(endMarker, start) : -1;

  return source.slice(start, end === -1 ? undefined : end);
}

// ---------------------------------------------------------------
// Recording handles (every mutating API records instead of executing)
// ---------------------------------------------------------------

function makeFileHandle(name, recorder) {
  return {
    kind: 'file',
    name,
    async getFile() {
      recorder.contentReads.push(`getFile(${name})`);
      throw new Error('ACT 1B must not read file content');
    },
    async createWritable() {
      recorder.writeCalls.push(`file.createWritable(${name})`);
      throw new Error('file.createWritable is not authorized in ACT 1B');
    },
  };
}

// A directory handle whose every mutating API is recorded instead of executed.
function makeDirectoryHandle({ name, entries = [], recorder, options = {} }) {
  const handle = {
    kind: 'directory',
    name,
    async *values() {
      recorder.iterations.push(name);

      if (options.permissionError) {
        const error = new Error('simulated permission failure');
        error.name = options.permissionError;
        throw error;
      }

      let seen = 0;

      for (const entry of entries) {
        if (options.throwAfter !== undefined && seen >= options.throwAfter) {
          throw new Error('simulated iteration failure');
        }
        seen += 1;
        recorder.entryNames.push(`${name}/${entry.name}`);
        yield entry;
      }

      if (options.throwAtEnd) throw new Error('simulated iteration failure');
    },
    async getDirectoryHandle(childName, opts) {
      if (opts && opts.create) {
        recorder.created.push(childName);
        recorder.writeCalls.push(`getDirectoryHandle(${childName},{create:true})`);

        if (options.createError) {
          const error = new Error('simulated creation failure');
          error.name = options.createError;
          throw error;
        }

        const created = (options.createdChildren || {})[childName];

        if (!created) {
          throw new Error(`unexpected creation of ${childName}`);
        }

        return created;
      }

      recorder.directoryHandles.push(childName);
      throw new Error(
        `getDirectoryHandle(${childName}) without create is not authorized in ACT 1B`
      );
    },
    async getFileHandle(childName, opts) {
      recorder.fileHandles.push(`${childName}${opts && opts.create ? ',create' : ''}`);
      recorder.writeCalls.push(`getFileHandle(${childName})`);
      throw new Error('getFileHandle is not authorized in ACT 1B');
    },
    async removeEntry(childName) {
      recorder.writeCalls.push(`removeEntry(${childName})`);
      throw new Error('removeEntry is not authorized in ACT 1B');
    },
    async createWritable() {
      recorder.writeCalls.push(`createWritable(${name})`);
      throw new Error('createWritable is not authorized in ACT 1B');
    },
    async queryPermission() {
      recorder.permissions.push('queryPermission');
      return 'granted';
    },
    async requestPermission() {
      recorder.permissions.push('requestPermission');
      return 'granted';
    },
  };

  return handle;
}

function makeNotesDirectory(recorder, fileNames, options = {}) {
  return makeDirectoryHandle({
    name: 'notes',
    entries: fileNames.map((entryName) => makeFileHandle(entryName, recorder)),
    recorder,
    options,
  });
}

// ---------------------------------------------------------------
// window / document / MME_APP shims with mutation recording
// ---------------------------------------------------------------

const SIDEBAR_LIST_IDS = [
  'workspaceJournalsList',
  'workspaceConceptsList',
  'workspaceJournalsBadge',
  'workspaceConceptsBadge',
  'workspaceJournalsTimeline',
  'workspaceConceptsTimeline',
];

const SIDEBAR_PANEL_IDS = ['workspaceJournalsPanel', 'workspaceConceptsPanel'];

function createRecorder() {
  return {
    iterations: [],
    entryNames: [],
    directoryHandles: [],
    fileHandles: [],
    created: [],
    writeCalls: [],
    contentReads: [],
    permissions: [],
  };
}
function installBrowserShims() {
  const state = {
    domReads: [],
    listDomWrites: [],
    statusDomWrites: [],
    toasts: [],
    logs: [],
    textDocuments: [],
    confirmPrompts: [],
    confirmAnswer: false,
    storageWrites: [],
    indexBuilds: [],
    parserCalls: [],
    navigation: { clear: 0, seed: 0, restore: 0 },
  };

  // Node >= 22 exposes some browser globals (navigator, localStorage) as
  // getter-only accessors, so define them instead of assigning.
  function defineGlobal(name, value) {
    try {
      globalThis[name] = value;
      if (globalThis[name] === value) return;
    } catch {
      // fall through to defineProperty
    }

    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }

  function makeRecordedElement(id, bucket) {
    const element = {
      id,
      value: '',
      style: {},
      dataset: {},
      addEventListener() {},
      removeEventListener() {},
      appendChild() {},
      remove() {},
      focus() {},
      setAttribute() {},
      getAttribute: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      classList: {
        add: (token) => bucket.push(`${id}:classList.add(${token})`),
        remove: (token) => bucket.push(`${id}:classList.remove(${token})`),
        contains: () => false,
        toggle: (token) => bucket.push(`${id}:classList.toggle(${token})`),
      },
    };

    Object.defineProperty(element, 'innerHTML', {
      get: () => element.__innerHTML || '',
      set: (value) => {
        element.__innerHTML = String(value);
        bucket.push(`${id}:innerHTML`);
      },
    });

    Object.defineProperty(element, 'textContent', {
      get: () => element.__textContent || '',
      set: (value) => {
        element.__textContent = String(value);
        bucket.push(`${id}:textContent`);
      },
    });

    Object.defineProperty(element, 'disabled', {
      get: () => Boolean(element.__disabled),
      set: (value) => {
        element.__disabled = Boolean(value);
        bucket.push(`${id}:disabled=${Boolean(value)}`);
      },
    });

    return element;
  }

  const elements = new Map();
  const elementFor = (id) => {
    if (!elements.has(id)) {
      const isSidebarList = SIDEBAR_LIST_IDS.includes(id) || SIDEBAR_PANEL_IDS.includes(id);
      elements.set(
        id,
        makeRecordedElement(id, isSidebarList ? state.listDomWrites : state.statusDomWrites)
      );
    }

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
    getElementById(id) {
      state.domReads.push(`getElementById(${id})`);
      return elementFor(id);
    },
    querySelector(selector) {
      state.domReads.push(`querySelector(${selector})`);
      return elementFor(`selector:${selector}`);
    },
    querySelectorAll: () => [],
    createElement: () => makeRecordedElement('created', state.statusDomWrites),
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
    body: makeRecordedElement('body', state.statusDomWrites),
    documentElement: makeRecordedElement('html', state.statusDomWrites),
  };


  defineGlobal('navigator', { userAgent: 'node-validator' });
  defineGlobal('localStorage', {
    _store: new Map(),
    getItem(key) {
      return this._store.has(key) ? this._store.get(key) : null;
    },
    setItem(key, value) {
      state.storageWrites.push(`setItem(${key})`);
      this._store.set(key, String(value));
    },
    removeItem(key) {
      state.storageWrites.push(`removeItem(${key})`);
      this._store.delete(key);
    },
  });

  globalThis.MME_APP = {
    log: (message) => state.logs.push(String(message)),
    showToast: (message, type, ms) => state.toasts.push({ message: String(message), type, ms }),
    openTextDocument: (payload) => state.textDocuments.push(payload),
    confirmDiscardIfDirty: () => true,
    setCurrentEditorTextSafe: () => true,
  };

  globalThis.MME_NAVIGATION = {
    isNavigationInProgress: () => false,
    clear: () => {
      state.navigation.clear += 1;
    },
    seed: () => {
      state.navigation.seed += 1;
    },
    restore: () => {
      state.navigation.restore += 1;
    },
  };

  // The Index lifecycle owner and the ACT 1C parser must never be reached by
  // the controller itself; both would be silent in a normal run, so they are
  // recorded loudly. A build entry may appear ONLY after a successful
  // activation (the ACT 1C wiring asserted as exactly one build below).
  globalThis.scheduleWorkspaceIndexRebuild = () => {
    state.indexBuilds.push('scheduleWorkspaceIndexRebuild');
  };
  globalThis.buildWorkspaceIndex = () => {
    state.indexBuilds.push('buildWorkspaceIndex');
    return null;
  };
  globalThis.parseWorkspaceDocument = () => {
    state.parserCalls.push('parseWorkspaceDocument');
    throw new Error('ACT 1B must not invoke the parser');
  };

  defineGlobal('confirm', (message) => {
    state.confirmPrompts.push(String(message));
    return state.confirmAnswer === true;
  });

  globalThis.window.addEventListener = () => {};
  globalThis.window.removeEventListener = () => {};
  globalThis.window.dispatchEvent = () => true;

  return state;
}

function resetShimState(state) {
  state.domReads.length = 0;
  state.listDomWrites.length = 0;
  state.statusDomWrites.length = 0;
  state.toasts.length = 0;
  state.logs.length = 0;
  state.textDocuments.length = 0;
  state.confirmPrompts.length = 0;
  state.confirmAnswer = false;
  state.storageWrites.length = 0;
  state.indexBuilds.length = 0;
  state.parserCalls.length = 0;
  state.navigation.clear = 0;
  state.navigation.seed = 0;
  state.navigation.restore = 0;
  return state;
}

// ---------------------------------------------------------------
// Workspace A (previously active) + structural state snapshot
// ---------------------------------------------------------------

function createWorkspaceAHandles() {
  return {
    root: { kind: 'directory', name: 'WorkspaceA' },
    notes: { kind: 'directory', name: 'notes' },
    noteFile: { kind: 'file', name: 'alpha.md' },
  };
}

function seedWorkspaceA(workspaceState) {
  const handles = createWorkspaceAHandles();

  workspaceState.rootHandle = handles.root;
  workspaceState.rootName = 'WorkspaceA';
  workspaceState.folders.notes = handles.notes;
  workspaceState.files.notes = [
    { kind: 'notes', name: 'alpha.md', path: 'notes/alpha.md', handle: handles.noteFile },
  ];
  workspaceState.activeFile = {
    kind: 'notes',
    name: 'alpha.md',
    path: 'notes/alpha.md',
    handle: handles.noteFile,
  };

  return handles;
}

// Structural snapshot: values plus handle identity, so a replaced-but-equal
// handle is still detected as a mutation.
function snapshotWorkspace(state) {
  const handleIds = new Map();
  let nextId = 0;

  function handleId(value) {
    if (value == null || typeof value !== 'object') return null;
    if (!handleIds.has(value)) {
      nextId += 1;
      handleIds.set(value, `handle#${nextId}`);
    }
    return handleIds.get(value);
  }

  const describe = (value) => {
    if (value == null) return null;
    if (typeof value !== 'object') return `${typeof value}:${String(value)}`;
    return `${value.kind || '?'}:${value.name || '?'}#${handleId(value)}`;
  };

  return JSON.stringify({
    rootHandle: describe(state.rootHandle),
    rootName: state.rootName,
    folders: Object.keys(state.folders)
      .sort()
      .map((key) => [key, describe(state.folders[key])]),
    files: Object.keys(state.files)
      .sort()
      .map((key) => [
        key,
        (Array.isArray(state.files[key]) ? state.files[key] : []).map((record) => ({
          kind: record?.kind ?? null,
          name: record?.name ?? null,
          path: record?.path ?? null,
          handle: describe(record?.handle),
        })),
      ]),
    activeFile: state.activeFile
      ? {
          kind: state.activeFile.kind ?? null,
          name: state.activeFile.name ?? null,
          path: state.activeFile.path ?? null,
          handle: describe(state.activeFile.handle),
        }
      : null,
  });
}

// ---------------------------------------------------------------
// Candidate harness (real openWorkspace() through WORKSPACE_API)
// ---------------------------------------------------------------

const SAVE_HANDLE_SENTINEL = { kind: 'file', name: 'save-sentinel.md' };

function restoreConfirm(shimState) {
  Object.defineProperty(globalThis, 'confirm', {
    configurable: true,
    writable: true,
    value: (message) => {
      shimState.confirmPrompts.push(String(message));
      return shimState.confirmAnswer === true;
    },
  });
}

function toRootHandle(entry, recorder) {
  return entry.kind === 'directory'
    ? makeDirectoryHandle({ name: entry.name, entries: [], recorder })
    : makeFileHandle(entry.name, recorder);
}

async function runCandidate(fixture, shimState, workspaceState) {
  const recorder = createRecorder();

  const notesDir = fixture.notesFiles
    ? makeNotesDirectory(recorder, fixture.notesFiles, fixture.notesOptions || {})
    : null;

  const createdNotesDir = makeNotesDirectory(recorder, [], fixture.createdNotesOptions || {});

  const extraEntries = (fixture.extraEntries || []).map((entry) => toRootHandle(entry, recorder));
  const rootEntries = [...(notesDir ? [notesDir] : []), ...extraEntries];

  const candidateRoot = makeDirectoryHandle({
    name: 'WorkspaceB',
    entries: rootEntries,
    recorder,
    options: { ...(fixture.rootOptions || {}), createdChildren: { notes: createdNotesDir } },
  });

  const workspaceA = seedWorkspaceA(workspaceState);

  resetShimState(shimState);
  shimState.confirmAnswer = fixture.confirmAnswer === true;

  globalThis.currentSaveHandle = SAVE_HANDLE_SENTINEL;

  globalThis.window.showDirectoryPicker = fixture.pickerError
    ? () => Promise.reject(fixture.pickerError)
    : () => Promise.resolve(candidateRoot);

  const before = snapshotWorkspace(workspaceState);

  if (fixture.confirmUnavailable) delete globalThis.confirm;

  await globalThis.WORKSPACE_API.openWorkspace();

  if (fixture.confirmUnavailable) restoreConfirm(shimState);

  const after = snapshotWorkspace(workspaceState);

  return {
    recorder,
    workspaceA,
    candidateRoot,
    createdNotesDir,
    notesHandle: notesDir,
    expectedNotesHandle: notesDir || createdNotesDir,
    rootEntryNames: rootEntries.map((entry) => entry.name),
    before,
    after,
  };
}

function workspaceStateHandleCheck(workspaceA) {
  return (
    WORKSPACE_STATE.rootHandle === workspaceA.root &&
    WORKSPACE_STATE.rootName === 'WorkspaceA' &&
    WORKSPACE_STATE.folders.notes === workspaceA.notes &&
    WORKSPACE_STATE.activeFile?.handle === workspaceA.noteFile &&
    WORKSPACE_STATE.activeFile?.path === 'notes/alpha.md'
  );
}

// The standard "nothing outside the transaction moved" proof, applied to every
// outcome that must preserve the previously active Workspace.
function preservationChecks(id, label, context, shimState) {
  const { recorder, workspaceA, before, after } = context;

  check(
    `${id}s`,
    `${label}: previously active Workspace A deep-unchanged (values + handle identity)`,
    before === after,
    after
  );
  check(
    `${id}a`,
    `${label}: Workspace A remains active`,
    workspaceStateHandleCheck(workspaceA),
    `${WORKSPACE_STATE.rootName}/${WORKSPACE_STATE.activeFile?.path}`
  );
  check(
    `${id}h`,
    `${label}: currentSaveHandle unchanged`,
    globalThis.currentSaveHandle === SAVE_HANDLE_SENTINEL
  );
  check(
    `${id}n`,
    `${label}: navigation history untouched (no clear/seed/restore)`,
    shimState.navigation.clear === 0 &&
      shimState.navigation.seed === 0 &&
      shimState.navigation.restore === 0,
    JSON.stringify(shimState.navigation)
  );
  check(
    `${id}e`,
    `${label}: editor buffer untouched (no document replaced)`,
    shimState.textDocuments.length === 0
  );
  check(
    `${id}l`,
    `${label}: localStorage untouched (no active-file write)`,
    shimState.storageWrites.length === 0,
    shimState.storageWrites.join(', ')
  );
  check(
    `${id}i`,
    `${label}: no Workspace Index build and no parser invocation`,
    shimState.indexBuilds.length === 0 && shimState.parserCalls.length === 0,
    `${shimState.indexBuilds.join(',')}|${shimState.parserCalls.join(',')}`
  );
  check(
    `${id}m`,
    `${label}: no Sidebar list/panel/badge DOM mutation`,
    shimState.listDomWrites.length === 0,
    shimState.listDomWrites.join(', ')
  );
  check(
    `${id}r`,
    `${label}: no file content read and no permission prompt`,
    recorder.contentReads.length === 0 && recorder.permissions.length === 0,
    `${recorder.contentReads.join(',')}|${recorder.permissions.join(',')}`
  );
}



// Storage-level activation proof shared by every successful fixture.
function activationChecks(id, label, context, shimState, expectedRecordNames, expectedWrites) {
  const { recorder, workspaceA, candidateRoot, expectedNotesHandle } = context;

  check(
    `${id}p`,
    `${label}: folders.notes holds the notes/ handle used for the scan`,
    WORKSPACE_STATE.folders.notes === expectedNotesHandle &&
      WORKSPACE_STATE.folders.notes !== workspaceA.notes,
    String(WORKSPACE_STATE.folders.notes?.name)
  );
  check(
    `${id}f`,
    `${label}: files.notes is the scanned storage record array`,
    Array.isArray(WORKSPACE_STATE.files.notes) &&
      JSON.stringify(WORKSPACE_STATE.files.notes.map((record) => record.name)) ===
        JSON.stringify(expectedRecordNames) &&
      WORKSPACE_STATE.files.notes.every(
        (record) =>
          record.kind === 'notes' &&
          record.path === `notes/${record.name}` &&
          typeof record.handle === 'object'
      ),
    JSON.stringify(WORKSPACE_STATE.files.notes.map((record) => record.path))
  );
  check(
    `${id}o`,
    `${label}: rootHandle/rootName are the selected folder and activeFile is null`,
    WORKSPACE_STATE.rootHandle === candidateRoot &&
      WORKSPACE_STATE.rootName === 'WorkspaceB' &&
      WORKSPACE_STATE.activeFile === null,
    `${WORKSPACE_STATE.rootName}/${String(WORKSPACE_STATE.activeFile)}`
  );
  check(
    `${id}x`,
    `${label}: no legacy folder/file field became authoritative state`,
    JSON.stringify(Object.keys(WORKSPACE_STATE.folders)) === JSON.stringify(['notes']) &&
      JSON.stringify(Object.keys(WORKSPACE_STATE.files)) === JSON.stringify(['notes']) &&
      !('journals' in WORKSPACE_STATE.folders) &&
      !('concepts' in WORKSPACE_STATE.folders) &&
      !('assets' in WORKSPACE_STATE.folders) &&
      !('archive' in WORKSPACE_STATE.folders) &&
      !('system' in WORKSPACE_STATE.folders) &&
      !('journals' in WORKSPACE_STATE.files) &&
      !('concepts' in WORKSPACE_STATE.files)
  );
  check(
    `${id}t`,
    `${label}: exactly one neutral index-ready toast, no success claim`,
    shimState.toasts.length === 1 &&
      shimState.toasts[0].type === 'warn' &&
      shimState.toasts[0].message === WORKSPACE_INDEX_READY_MESSAGE,
    JSON.stringify(shimState.toasts)
  );
  check(
    `${id}g`,
    `${label}: storage activation logged`,
    shimState.logs.some((line) => line.includes('storage activated')),
    shimState.logs.join(' | ')
  );
  check(
    `${id}q`,
    `${label}: no editor mutation, no save-handle change, no navigation, no localStorage write`,
    shimState.textDocuments.length === 0 &&
      globalThis.currentSaveHandle === SAVE_HANDLE_SENTINEL &&
      shimState.navigation.clear === 0 &&
      shimState.navigation.seed === 0 &&
      shimState.storageWrites.length === 0,
    JSON.stringify(shimState.storageWrites)
  );
  check(
    `${id}u`,
    `${label}: exactly one Index build requested after activation; the parser stays untouched`,
    JSON.stringify(shimState.indexBuilds) === JSON.stringify(['buildWorkspaceIndex']) &&
      shimState.parserCalls.length === 0,
    `${shimState.indexBuilds.join(',')}|${shimState.parserCalls.join(',')}`
  );
  check(
    `${id}m`,
    `${label}: no Sidebar list/panel/badge DOM mutation`,
    shimState.listDomWrites.length === 0,
    shimState.listDomWrites.join(', ')
  );
  check(
    `${id}w`,
    `${label}: the only filesystem mutation is the authorized one`,
    JSON.stringify(recorder.writeCalls) === JSON.stringify(expectedWrites) &&
      recorder.permissions.length === 0 &&
      recorder.contentReads.length === 0,
    JSON.stringify(recorder.writeCalls)
  );
}

// Expected user-facing texts, restated here as an independent expectation.
// ACT 1C: a successful activation now reports index-ready (the build ran at
// the activation boundary); failure/decline paths keep their own texts.
const WORKSPACE_INDEX_READY_MESSAGE =
  'Workspace notes/ index ready. Existing feature adaptation continues in the next package.';

// Assigned once the real workspace-state.js module is imported below, so the
// shared helpers can address the shipped object.
let WORKSPACE_STATE = null;

const ABORT_ERROR = Object.assign(new Error('The user aborted a request.'), {
  name: 'AbortError',
});

const WORKSPACE_DECLINED_MESSAGE = 'Initialization cancelled — nothing was changed.';

const EMPTY_FOLDER_PROMPT =
  'Initialize a new MarkmapEditor Workspace here?\n\n' +
  'A notes/ folder will be created.\n' +
  'No other folders will be created.';

const UNINITIALIZED_FOLDER_PROMPT =
  'This folder is not yet a MarkmapEditor Workspace.\n\n' +
  'Initialize it by creating notes/?\n\n' +
  'Existing files and folders will remain untouched.';

const AUTHORIZED_CREATION_WRITE = 'getDirectoryHandle(notes,{create:true})';

(async () => {
  const shimState = installBrowserShims();

  const openModule = await import(pathToFileURL(OPEN_PATH).href);
  const scannerModule = await import(pathToFileURL(SCANNER_PATH).href);
  const stateModule = await import(pathToFileURL(STATE_PATH).href);

  // The real controller is imported once so WORKSPACE_API and WORKSPACE_STATE
  // are the shipped objects (not a copy).
  await import(pathToFileURL(CONTROLLER_PATH).href);

  WORKSPACE_STATE = stateModule.WORKSPACE_STATE;
  const api = globalThis.WORKSPACE_API;

  // -------------------------------------------------------------
  // Group A — canonical ACT 1B storage state
  // -------------------------------------------------------------

  group('Group A — canonical ACT 1B storage state (real workspace-state.js)');

  check(
    'A01',
    'controller publishes the same WORKSPACE_STATE object as workspace-state.js',
    globalThis.WORKSPACE_STATE === WORKSPACE_STATE &&
      globalThis.window.WORKSPACE_STATE === WORKSPACE_STATE
  );
  check(
    'A02',
    'WORKSPACE_STATE top-level keys are exactly the ACT 1B target shape',
    JSON.stringify(Object.keys(WORKSPACE_STATE)) ===
      JSON.stringify(['rootHandle', 'rootName', 'folders', 'files', 'activeFile']),
    JSON.stringify(Object.keys(WORKSPACE_STATE))
  );
  check(
    'A03',
    'folders/files contain notes only, with the documented initial values',
    JSON.stringify(Object.keys(WORKSPACE_STATE.folders)) === JSON.stringify(['notes']) &&
      JSON.stringify(Object.keys(WORKSPACE_STATE.files)) === JSON.stringify(['notes']) &&
      WORKSPACE_STATE.rootHandle === null &&
      WORKSPACE_STATE.rootName === '' &&
      WORKSPACE_STATE.folders.notes === null &&
      Array.isArray(WORKSPACE_STATE.files.notes) &&
      WORKSPACE_STATE.files.notes.length === 0 &&
      WORKSPACE_STATE.activeFile === null
  );
  check(
    'A04',
    'no legacy folder/file field, alias or transitional getter exists',
    ['journals', 'concepts', 'assets', 'archive', 'system'].every(
      (key) => !(key in WORKSPACE_STATE.folders)
    ) &&
      ['journals', 'concepts'].every((key) => !(key in WORKSPACE_STATE.files)) &&
      ['journals', 'concepts', 'assets', 'archive', 'system'].every(
        (key) => !(key in WORKSPACE_STATE)
      )
  );

  const STATE_CODE = stripComments(STATE_SOURCE);

  check(
    'A05',
    'workspace-state.js declares no legacy field, alias or accessor',
    !/\bjournals\b|\bconcepts\b|\bassets\b|\barchive\b|\bsystem\b/.test(STATE_CODE) &&
      !/Object\.defineProperty/.test(STATE_CODE) &&
      !/\bget\s+\w+\s*\(/.test(STATE_CODE),
    STATE_CODE.replace(/\s+/g, ' ').slice(0, 120)
  );
  check(
    'A06',
    'isWorkspaceReady derives readiness from rootHandle only',
    stateModule.isWorkspaceReady({ rootHandle: null }) === false &&
      stateModule.isWorkspaceReady({ rootHandle: {} }) === true &&
      stateModule.isWorkspaceReady({ rootHandle: {}, folders: { notes: {} } }) === true
  );
  check(
    'A07',
    'WORKSPACE_FORMAT is frozen and exposes the ACT 1A statuses plus uninitialized',
    Object.isFrozen(openModule.WORKSPACE_FORMAT) &&
      JSON.stringify(Object.keys(openModule.WORKSPACE_FORMAT).sort()) ===
        JSON.stringify([
          'CANCELED',
          'EMPTY',
          'PERMISSION_FAILURE',
          'REJECTED_INVALID_NOTES_ENTRY',
          'REJECTED_LEGACY',
          'REJECTED_MIXED',
          'UNINITIALIZED',
          'VALID_NOTES',
        ]) &&
      openModule.WORKSPACE_FORMAT.UNINITIALIZED === 'uninitialized'
  );
  check(
    'A08',
    'empty and uninitialized are split by entry count, legacy markers still reject',
    openModule.classifyWorkspaceEntries([]).status === 'empty' &&
      openModule.classifyWorkspaceEntries([]).entryCount === 0 &&
      openModule.classifyWorkspaceEntries([{ kind: 'file', name: 'README.md' }]).status ===
        'uninitialized' &&
      openModule.classifyWorkspaceEntries([{ kind: 'directory', name: 'Notes' }]).status ===
        'uninitialized' &&
      openModule.classifyWorkspaceEntries([{ kind: 'directory', name: 'journals' }]).status ===
        'rejected-legacy',
    openModule.classifyWorkspaceEntries([{ kind: 'file', name: 'README.md' }]).status
  );



  // -------------------------------------------------------------
  // Group B — notes/ scanner contract
  // -------------------------------------------------------------

  group('Group B — notes/ storage scanner (real scanNotesFolder)');

  const scanRecorder = createRecorder();
  const eligibleCandidates = ['beta.md', 'Alpha.md', 'gamma.MD', 'NOTE.Md'];
  const ineligibleCandidates = [
    'notes.txt',
    'report.markdown',
    'drawing.drawio',
    'photo.png',
    'archive.zip',
  ];

  const scanEntries = [
    ...eligibleCandidates.map((name) => makeFileHandle(name, scanRecorder)),
    ...ineligibleCandidates.map((name) => makeFileHandle(name, scanRecorder)),
    makeDirectoryHandle({ name: 'drafts', entries: [], recorder: scanRecorder }),
    makeDirectoryHandle({ name: 'nested', entries: [], recorder: scanRecorder }),
  ];

  const scanDir = makeDirectoryHandle({
    name: 'notes',
    entries: scanEntries,
    recorder: scanRecorder,
  });

  const scanRecords = await scannerModule.scanNotesFolder(scanDir);
  const scannedNames = scanRecords.map((record) => record.name);

  check(
    'B01',
    'notes/ scan returns only eligible .md files',
    JSON.stringify(scannedNames.slice().sort()) ===
      JSON.stringify(eligibleCandidates.slice().sort()),
    JSON.stringify(scannedNames)
  );
  check(
    'B02',
    'extension matching is explicit for .MD/.Md (case-insensitive, name preserved)',
    scannedNames.includes('gamma.MD') &&
      scannedNames.includes('NOTE.Md') &&
      scannerModule.NOTES_FILE_EXTENSION === '.md' &&
      scannerModule.isEligibleNoteEntry({ kind: 'file', name: 'x.MD' }) === true &&
      scannerModule.isEligibleNoteEntry({ kind: 'file', name: 'x.md' }) === true &&
      scannerModule.isEligibleNoteEntry({ kind: 'file', name: 'x.markdown' }) === false &&
      scannerModule.isEligibleNoteEntry({ kind: 'file', name: 'x.txt' }) === false &&
      scannerModule.isEligibleNoteEntry({ kind: 'file', name: 'md' }) === false &&
      scannerModule.isEligibleNoteEntry({ kind: 'file', name: '' }) === false &&
      scannerModule.isEligibleNoteEntry({ kind: 'directory', name: 'x.md' }) === false,
    JSON.stringify(scannedNames)
  );
  check(
    'B03',
    'unrelated extensions, Draw.io files, images and directories are ignored',
    scanRecords.length === eligibleCandidates.length &&
      !scannedNames.includes('drafts') &&
      !scannedNames.includes('nested')
  );
  check(
    'B04',
    'storage records contain kind/name/path/handle only',
    scanRecords.every(
      (record) =>
        JSON.stringify(Object.keys(record)) ===
          JSON.stringify(['kind', 'name', 'path', 'handle']) &&
        record.kind === 'notes' &&
        record.path === `notes/${record.name}`
    ),
    JSON.stringify(scanRecords.map((record) => Object.keys(record)))
  );
  check(
    'B05',
    'each record handle is the discovered entry handle (no wrapper, no re-read)',
    scanRecords.every((record) =>
      scanEntries.some((entry) => entry === record.handle && entry.name === record.name)
    ) && scannedNames.every((name) => !name.includes('/'))
  );

  const orderRecorder = createRecorder();
  const orderDir = makeDirectoryHandle({
    name: 'notes',
    entries: ['c.md', 'a.md', 'b.md'].map((name) => makeFileHandle(name, orderRecorder)),
    recorder: orderRecorder,
  });
  const orderedRecords = await scannerModule.scanNotesFolder(orderDir);

  check(
    'B06',
    'deterministic ascending name order (no timeline or metadata sorting)',
    JSON.stringify(orderedRecords.map((record) => record.name)) ===
      JSON.stringify(['a.md', 'b.md', 'c.md']),
    JSON.stringify(orderedRecords.map((record) => record.name))
  );

  const emptyRecorder = createRecorder();
  const emptyRecords = await scannerModule.scanNotesFolder(
    makeDirectoryHandle({ name: 'notes', entries: [], recorder: emptyRecorder })
  );

  check(
    'B07',
    'an empty notes/ folder scans to an empty record array',
    Array.isArray(emptyRecords) && emptyRecords.length === 0
  );
  check(
    'B08',
    'the scanner is read-only: no write, no handle request, no content read, no permission prompt',
    scanRecorder.writeCalls.length === 0 &&
      scanRecorder.directoryHandles.length === 0 &&
      scanRecorder.fileHandles.length === 0 &&
      scanRecorder.contentReads.length === 0 &&
      scanRecorder.permissions.length === 0 &&
      orderRecorder.writeCalls.length === 0 &&
      emptyRecorder.writeCalls.length === 0,
    JSON.stringify(scanRecorder)
  );

  let scanFailure = '';
  try {
    await scannerModule.scanNotesFolder(null);
  } catch (error) {
    scanFailure = String(error?.message || error);
  }

  check(
    'B09',
    'an unusable notes/ handle fails explicitly instead of returning a partial scan',
    scanFailure.includes('notes/ handle'),
    scanFailure
  );

  const SCANNER_ACT1B_CODE = stripComments(
    sliceBetween(SCANNER_SOURCE, '// ACT 1B — notes/ storage scanner', undefined)
  );

  check(
    'B10',
    'the scanner adds no write/content API and no metadata vocabulary',
    SCANNER_ACT1B_CODE.length > 0 &&
      !/(getDirectoryHandle|getFileHandle|createWritable|removeEntry|getFile)\s*\(/.test(
        SCANNER_ACT1B_CODE
      ) &&
      !/title|tags|tasks|projects|links|pinned|archived|knowledge/i.test(SCANNER_ACT1B_CODE),
    SCANNER_ACT1B_CODE.replace(/\s+/g, ' ').slice(0, 160)
  );

  // -------------------------------------------------------------
  // Group C — valid notes/ Workspace activation
  // -------------------------------------------------------------

  group('Group C — valid notes/ Workspace activates without creating anything');

  const validContext = await runCandidate(
    {
      notesFiles: ['alpha.md', 'beta.md', 'readme.txt', 'photo.png'],
      extraEntries: [{ kind: 'file', name: 'README.md' }, { kind: 'directory', name: 'drafts' }],
    },
    shimState,
    WORKSPACE_STATE
  );

  check(
    'C01',
    'notes/ plus unrelated content is detected as valid-notes',
    shimState.logs.some((line) => line.includes('detection status=valid-notes')),
    shimState.logs.join(' | ')
  );
  activationChecks(
    'C02',
    'valid notes/ workspace',
    validContext,
    shimState,
    ['alpha.md', 'beta.md'],
    []
  );
  check(
    'C03',
    'no notes/ creation and no getDirectoryHandle request (detected handle reused)',
    validContext.recorder.created.length === 0 &&
      validContext.recorder.writeCalls.length === 0 &&
      validContext.recorder.directoryHandles.length === 0,
    JSON.stringify(validContext.recorder)
  );
  check(
    'C04',
    'only the direct contents of notes/ are scanned, exactly once each',
    JSON.stringify(validContext.recorder.iterations) ===
      JSON.stringify(['WorkspaceB', 'notes']) &&
      JSON.stringify(validContext.recorder.entryNames.filter((name) => name.startsWith('WorkspaceB/'))) ===
        JSON.stringify(['WorkspaceB/notes', 'WorkspaceB/README.md', 'WorkspaceB/drafts']),
    JSON.stringify(validContext.recorder.iterations)
  );

  const snapshotProbe = api.buildNotesWorkspaceSnapshot({
    rootHandle: validContext.candidateRoot,
    notesHandle: validContext.expectedNotesHandle,
    notesRecords: WORKSPACE_STATE.files.notes.slice(),
  });

  check(
    'C05',
    'the real snapshot builder/validator accept the activated storage',
    api.validateNotesWorkspaceSnapshot(snapshotProbe) === '' &&
      snapshotProbe.activeFile === null &&
      snapshotProbe.rootName === 'WorkspaceB' &&
      snapshotProbe.notesRecords.length === 2
  );
  check(
    'C06',
    'malformed snapshots are rejected before any assignment',
    api.validateNotesWorkspaceSnapshot(null) === 'missing-root-handle' &&
      api.validateNotesWorkspaceSnapshot({ rootHandle: {} }) === 'missing-notes-handle' &&
      api.validateNotesWorkspaceSnapshot({ rootHandle: {}, notesHandle: {} }) ===
        'invalid-notes-records' &&
      api.validateNotesWorkspaceSnapshot({
        rootHandle: {},
        notesHandle: {},
        notesRecords: [{}],
      }) === 'invalid-note-record'
  );

  // -------------------------------------------------------------
  // Group D — empty folder initialization
  // -------------------------------------------------------------

  group('Group D — empty folder: confirmed initialization creates notes/ once');

  const emptyContext = await runCandidate({ confirmAnswer: true }, shimState, WORKSPACE_STATE);

  check(
    'D01',
    'the empty-folder confirmation is exactly the E1 text',
    shimState.confirmPrompts.length === 1 && shimState.confirmPrompts[0] === EMPTY_FOLDER_PROMPT,
    JSON.stringify(shimState.confirmPrompts)
  );
  check(
    'D02',
    'exactly one directory is created, and it is notes/',
    JSON.stringify(emptyContext.recorder.created) === JSON.stringify(['notes']) &&
      JSON.stringify(emptyContext.recorder.writeCalls) ===
        JSON.stringify([AUTHORIZED_CREATION_WRITE]),
    JSON.stringify(emptyContext.recorder.writeCalls)
  );
  check(
    'D03',
    'the created notes/ folder is scanned exactly once (empty listing)',
    JSON.stringify(emptyContext.recorder.iterations) === JSON.stringify(['WorkspaceB', 'notes']),
    JSON.stringify(emptyContext.recorder.iterations)
  );
  activationChecks(
    'D04',
    'empty folder initialization',
    emptyContext,
    shimState,
    [],
    [AUTHORIZED_CREATION_WRITE]
  );
  check(
    'D05',
    'no other folder, file or sidecar is created and nothing is removed',
    emptyContext.recorder.created.length === 1 &&
      emptyContext.recorder.fileHandles.length === 0 &&
      !emptyContext.recorder.writeCalls.some(
        (call) => call.includes('removeEntry') || call.includes('createWritable')
      )
  );
  check(
    'D06',
    'the initialization is logged as a creation',
    shimState.logs.some((line) => line.includes('created=true')),
    shimState.logs.join(' | ')
  );


  // -------------------------------------------------------------
  // Group E — uninitialized folder initialization
  // -------------------------------------------------------------

  group('Group E — uninitialized folder: confirmed initialization leaves content alone');

  const uninitializedContext = await runCandidate(
    {
      confirmAnswer: true,
      extraEntries: [{ kind: 'file', name: 'README.md' }, { kind: 'directory', name: 'drafts' }],
    },
    shimState,
    WORKSPACE_STATE
  );

  check(
    'E01',
    'a folder with unrelated content is detected as uninitialized',
    shimState.logs.some((line) => line.includes('detection status=uninitialized')),
    shimState.logs.join(' | ')
  );
  check(
    'E02',
    'the uninitialized confirmation is exactly the E2 text',
    shimState.confirmPrompts.length === 1 &&
      shimState.confirmPrompts[0] === UNINITIALIZED_FOLDER_PROMPT,
    JSON.stringify(shimState.confirmPrompts)
  );
  check(
    'E03',
    'exactly one directory is created and every existing entry is left untouched',
    JSON.stringify(uninitializedContext.recorder.created) === JSON.stringify(['notes']) &&
      JSON.stringify(uninitializedContext.rootEntryNames) ===
        JSON.stringify(['README.md', 'drafts']) &&
      !uninitializedContext.recorder.writeCalls.some(
        (call) =>
          call.includes('removeEntry') ||
          call.includes('README.md') ||
          call.includes('drafts') ||
          call.includes('createWritable')
      ),
    JSON.stringify(uninitializedContext.recorder.writeCalls)
  );
  activationChecks(
    'E04',
    'uninitialized folder initialization',
    uninitializedContext,
    shimState,
    [],
    [AUTHORIZED_CREATION_WRITE]
  );

  const caseVariantContext = await runCandidate(
    { confirmAnswer: false, extraEntries: [{ kind: 'directory', name: 'Notes' }] },
    shimState,
    WORKSPACE_STATE
  );

  check(
    'E05',
    'a case-variant Notes/ folder asks with the E2 text plus an explicit capitalisation hint',
    shimState.confirmPrompts.length === 1 &&
      shimState.confirmPrompts[0].startsWith(UNINITIALIZED_FOLDER_PROMPT) &&
      shimState.confirmPrompts[0].includes('"Notes"') &&
      shimState.confirmPrompts[0].includes('"notes"') &&
      caseVariantContext.recorder.created.length === 0,
    JSON.stringify(shimState.confirmPrompts)
  );

  // -------------------------------------------------------------
  // Group F — declined and canceled initialization
  // -------------------------------------------------------------

  group('Group F — declined / canceled initialization mutates nothing');

  const declinedEmptyContext = await runCandidate(
    { confirmAnswer: false },
    shimState,
    WORKSPACE_STATE
  );

  check(
    'F01',
    'the confirmation was requested, and declining creates and scans nothing',
    shimState.confirmPrompts.length === 1 &&
      declinedEmptyContext.recorder.created.length === 0 &&
      declinedEmptyContext.recorder.writeCalls.length === 0 &&
      JSON.stringify(declinedEmptyContext.recorder.iterations) === JSON.stringify(['WorkspaceB']),
    JSON.stringify(declinedEmptyContext.recorder)
  );
  check(
    'F02',
    'declining reports a neutral normalized cancel and no error toast',
    shimState.toasts.length === 1 &&
      shimState.toasts[0].type === 'warn' &&
      shimState.toasts[0].message === WORKSPACE_DECLINED_MESSAGE &&
      shimState.logs.some((line) => line.includes('initialization declined')),
    JSON.stringify(shimState.toasts)
  );
  preservationChecks('F03', 'declined empty folder', declinedEmptyContext, shimState);

  const declinedUninitializedContext = await runCandidate(
    { confirmAnswer: false, extraEntries: [{ kind: 'file', name: 'README.md' }] },
    shimState,
    WORKSPACE_STATE
  );

  check(
    'F04',
    'declining an uninitialized folder performs no write and no scan',
    declinedUninitializedContext.recorder.created.length === 0 &&
      declinedUninitializedContext.recorder.writeCalls.length === 0 &&
      JSON.stringify(declinedUninitializedContext.recorder.iterations) ===
        JSON.stringify(['WorkspaceB'])
  );
  preservationChecks('F05', 'declined uninitialized folder', declinedUninitializedContext, shimState);

  const unavailableConfirmContext = await runCandidate(
    { confirmUnavailable: true },
    shimState,
    WORKSPACE_STATE
  );

  check(
    'F06',
    'an unavailable confirmation is treated as a decline (zero writes, nothing prompts)',
    unavailableConfirmContext.recorder.created.length === 0 &&
      shimState.confirmPrompts.length === 0 &&
      shimState.logs.some((line) => line.includes('confirmation unavailable')),
    shimState.logs.join(' | ')
  );
  preservationChecks('F07', 'confirmation unavailable', unavailableConfirmContext, shimState);

  const pickerCancelContext = await runCandidate(
    { pickerError: ABORT_ERROR, confirmAnswer: true },
    shimState,
    WORKSPACE_STATE
  );

  check(
    'F08',
    'picker cancellation keeps the ACT 1A behavior: no toast, no prompt, no write',
    shimState.toasts.length === 0 &&
      shimState.confirmPrompts.length === 0 &&
      pickerCancelContext.recorder.created.length === 0 &&
      shimState.logs.some((line) => line.includes('detection status=canceled')),
    shimState.logs.join(' | ')
  );
  preservationChecks('F09', 'picker cancellation', pickerCancelContext, shimState);


  // -------------------------------------------------------------
  // Group G — failure preservation
  // -------------------------------------------------------------

  group('Group G — creation, scan and rejection failures preserve Workspace A');

  const scanFailureContext = await runCandidate(
    { notesFiles: ['alpha.md', 'beta.md'], notesOptions: { throwAfter: 1 } },
    shimState,
    WORKSPACE_STATE
  );

  check(
    'G01',
    'a failed notes/ scan never activates a partial Workspace',
    WORKSPACE_STATE.rootName === 'WorkspaceA' &&
      WORKSPACE_STATE.files.notes.length === 1 &&
      shimState.toasts.length === 1 &&
      shimState.toasts[0].type === 'error' &&
      /folder read failed/.test(shimState.toasts[0].message) &&
      shimState.logs.some((line) => line.includes('reason=iteration')),
    JSON.stringify(shimState.toasts)
  );
  preservationChecks('G02', 'notes/ scan failure', scanFailureContext, shimState);

  const notesPermissionContext = await runCandidate(
    { notesFiles: [], notesOptions: { permissionError: 'NotAllowedError' } },
    shimState,
    WORKSPACE_STATE
  );

  check(
    'G03',
    'a notes/ permission failure reports reason=permission',
    shimState.logs.some((line) => line.includes('reason=permission')) &&
      shimState.toasts.length === 1 &&
      /permission denied/.test(shimState.toasts[0].message),
    JSON.stringify(shimState.toasts)
  );
  preservationChecks('G04', 'notes/ permission failure', notesPermissionContext, shimState);

  const createFailureContext = await runCandidate(
    { confirmAnswer: true, rootOptions: { createError: 'NotAllowedError' } },
    shimState,
    WORKSPACE_STATE
  );

  check(
    'G05',
    'a failed creation attempts notes/ only and reports the failure',
    JSON.stringify(createFailureContext.recorder.created) === JSON.stringify(['notes']) &&
      createFailureContext.recorder.writeCalls.length === 1 &&
      shimState.toasts.length === 1 &&
      shimState.toasts[0].type === 'error' &&
      /permission denied/.test(shimState.toasts[0].message),
    JSON.stringify(createFailureContext.recorder.writeCalls)
  );
  preservationChecks('G06', 'creation failure', createFailureContext, shimState);

  const createdThenFailedScanContext = await runCandidate(
    { confirmAnswer: true, createdNotesOptions: { throwAtEnd: true } },
    shimState,
    WORKSPACE_STATE
  );

  check(
    'G07',
    'creation succeeded but the scan failed: nothing activates and the created folder is reported',
    createdThenFailedScanContext.recorder.created.length === 1 &&
      shimState.logs.some((line) => line.includes('notesCreated=true')) &&
      /was created in the selected folder/.test(shimState.toasts[0].message),
    JSON.stringify(shimState.toasts)
  );
  preservationChecks('G08', 'creation + scan failure', createdThenFailedScanContext, shimState);

  const rootPermissionContext = await runCandidate(
    { rootOptions: { permissionError: 'NotAllowedError' } },
    shimState,
    WORKSPACE_STATE
  );

  check(
    'G09',
    'a root read failure never prompts and never writes',
    shimState.confirmPrompts.length === 0 &&
      rootPermissionContext.recorder.writeCalls.length === 0 &&
      shimState.logs.some((line) => line.includes('detection status=permission-failure')),
    shimState.logs.join(' | ')
  );
  preservationChecks('G10', 'root permission failure', rootPermissionContext, shimState);

  const rejectedLegacyContext = await runCandidate(
    { extraEntries: [{ kind: 'directory', name: 'journals' }] },
    shimState,
    WORKSPACE_STATE
  );

  check(
    'G11',
    'rejected legacy keeps the ACT 1A message and never prompts',
    shimState.toasts.length === 1 &&
      /Legacy workspace rejected/.test(shimState.toasts[0].message) &&
      shimState.confirmPrompts.length === 0,
    JSON.stringify(shimState.toasts)
  );
  preservationChecks('G12', 'rejected legacy', rejectedLegacyContext, shimState);

  const rejectedMixedContext = await runCandidate(
    {
      notesFiles: ['alpha.md'],
      extraEntries: [{ kind: 'directory', name: 'archive' }],
    },
    shimState,
    WORKSPACE_STATE
  );

  check(
    'G13',
    'rejected mixed keeps the ACT 1A message',
    /Mixed workspace rejected/.test(String(shimState.toasts[0]?.message || '')),
    JSON.stringify(shimState.toasts)
  );
  preservationChecks('G14', 'rejected mixed', rejectedMixedContext, shimState);

  const invalidNotesEntryContext = await runCandidate(
    { extraEntries: [{ kind: 'file', name: 'notes' }] },
    shimState,
    WORKSPACE_STATE
  );

  check(
    'G15',
    'a `notes` file keeps the ACT 1A message and writes nothing',
    /is a file, not a folder/.test(String(shimState.toasts[0]?.message || '')) &&
      invalidNotesEntryContext.recorder.writeCalls.length === 0,
    JSON.stringify(shimState.toasts)
  );
  preservationChecks('G16', 'rejected invalid notes entry', invalidNotesEntryContext, shimState);


  // -------------------------------------------------------------
  // Group H — static ACT 1B boundary and non-touch proof
  // -------------------------------------------------------------

  group('Group H — static ACT 1B write boundary and non-touch proof');

  const OPEN_ACT1B_CODE = stripComments(
    sliceBetween(OPEN_SOURCE, '// ACT 1B — Workspace initialization', undefined)
  );
  const CONTROLLER_ACT1B_CODE = stripComments(
    sliceBetween(
      CONTROLLER_SOURCE,
      '// ACT 1B — explicit initialization',
      'async function openWorkspace() {'
    )
  );
  const OPEN_SLICE_CODE = stripComments(
    sliceBetween(
      CONTROLLER_SOURCE,
      'async function openWorkspace() {',
      'async function activateWorkspaceAtExistingBoundary('
    )
  );
  const CONTROLLER_CODE = stripComments(CONTROLLER_SOURCE);

  check(
    'H01',
    'the ACT 1B section of workspace-open.js holds exactly one write expression',
    OPEN_ACT1B_CODE.length > 0 &&
      (OPEN_ACT1B_CODE.match(/getDirectoryHandle\s*\(/g) || []).length === 1 &&
      (OPEN_ACT1B_CODE.match(/create:\s*true/g) || []).length === 1 &&
      !/(createWritable|removeEntry|getFileHandle)\s*\(/.test(OPEN_ACT1B_CODE),
    OPEN_ACT1B_CODE.replace(/\s+/g, ' ').slice(0, 160)
  );
  check(
    'H02',
    'createNotesDirectory creates the literal notes/ name, never a parameter name',
    /async function createNotesDirectory\(rootHandle\)/.test(OPEN_ACT1B_CODE) &&
      OPEN_ACT1B_CODE.includes('getDirectoryHandle(NOTES_DIRECTORY_NAME, { create: true })')
  );
  check(
    'H03',
    'the controller ACT 1B section performs no filesystem call of its own',
    CONTROLLER_ACT1B_CODE.length > 0 &&
      !/(getDirectoryHandle|getFileHandle|createWritable|removeEntry)\s*\(/.test(
        CONTROLLER_ACT1B_CODE
      ) &&
      !/create:\s*true/.test(CONTROLLER_ACT1B_CODE) &&
      !CONTROLLER_ACT1B_CODE.includes('ensureSubfolder(')
  );
  check(
    'H04',
    'the controller reaches the writer only through createNotesDirectory()',
    CONTROLLER_ACT1B_CODE.includes('await createNotesDirectory(rootHandle)')
  );
  check(
    'H05',
    'openWorkspace() has no filesystem call and assigns no WORKSPACE_STATE field itself',
    OPEN_SLICE_CODE.length > 0 &&
      !/(getDirectoryHandle|getFileHandle|createWritable|removeEntry)\s*\(/.test(OPEN_SLICE_CODE) &&
      !/WORKSPACE_STATE\.(rootHandle|rootName|folders|files|activeFile)\s*=/.test(OPEN_SLICE_CODE) &&
      !OPEN_SLICE_CODE.includes('ensureSubfolder(') &&
      OPEN_SLICE_CODE.includes('openWorkspaceCandidate()')
  );
  check(
    'H06',
    'activateWorkspaceStorage is the single WORKSPACE_STATE assignment boundary',
    sliceBetween(CONTROLLER_SOURCE, 'function activateWorkspaceStorage(snapshot) {', undefined)
      .includes('WORKSPACE_STATE.folders.notes = snapshot.notesHandle') &&
      CONTROLLER_ACT1B_CODE.includes('function activateWorkspaceStorage(snapshot) {')
  );
  check(
    'H07',
    'the legacy activation sequence is still never invoked',
    (CONTROLLER_CODE.match(/activateWorkspaceAtExistingBoundary\s*\(/g) || []).length === 1 &&
      !CONTROLLER_ACT1B_CODE.includes('activateWorkspaceAtExistingBoundary') &&
      !OPEN_SLICE_CODE.includes('activateWorkspaceAtExistingBoundary')
  );
  check(
    'H08',
    'no new runtime module was added for notes/ storage',
    !fs.existsSync(path.join(ROOT, 'js', 'workspace', 'workspace-storage.js')) &&
      !fs.existsSync(path.join(ROOT, 'js', 'workspace', 'notes-scanner.js')) &&
      !fs.existsSync(path.join(ROOT, 'js', 'workspace', 'workspace-notes.js')) &&
      !fs.existsSync(path.join(ROOT, 'js', 'workspace', 'workspace-index.js'))
  );
  check(
    'H09',
    'service worker keeps the same cache identity and the four ACT 1A/1B owners',
    new RegExp(`const APP_VERSION = '${APP_VERSION_BASELINE}';`).test(SW_SOURCE) &&
      SW_SOURCE.includes("'./js/workspace/workspace-state.js'") &&
      SW_SOURCE.includes("'./js/workspace/workspace-scanner.js'") &&
      SW_SOURCE.includes("'./js/workspace/workspace-open.js'") &&
      SW_SOURCE.includes("'./js/workspace/workspace-controller.js'")
  );
  check(
    'H10',
    'index.html declares no new notes/ module or markup',
    INDEX_SOURCE.includes('./js/workspace/workspace-controller.js') &&
      !/notes-scanner|workspace-storage|workspace-notes/.test(INDEX_SOURCE)
  );
  check(
    'H11',
    'the scanner keeps a single dependency edge (workspace-open.js)',
    JSON.stringify(SCANNER_SOURCE.match(/from '[^']+'/g) || []) ===
      JSON.stringify(["from './workspace-open.js'"])
  );
  check(
    'H12',
    'the controller adds no dependency edge to unrelated owners',
    JSON.stringify(
      (CONTROLLER_SOURCE.match(/^import[\s\S]*?from '[^']+';$/gm) || []).map(
        (line) => (line.match(/from '([^']+)'/) || [])[1]
      ).sort()
    ) ===
      JSON.stringify([
        './workspace-actions.js',
        './workspace-open.js',
        './workspace-scanner.js',
        './workspace-sidebar.js',
        './workspace-state.js',
      ]),
    JSON.stringify(CONTROLLER_SOURCE.match(/from '[^']+'/g))
  );

  // -------------------------------------------------------------
  // Group I — harness negative controls (the checks are not vacuous)
  // -------------------------------------------------------------

  group('Group I — harness negative controls');

  const probeState = {
    rootHandle: {},
    rootName: 'Probe',
    folders: { notes: {} },
    files: { notes: [] },
    activeFile: null,
  };
  const probeBefore = snapshotWorkspace(probeState);

  probeState.rootName = 'ProbeChanged';

  check(
    'I01',
    'negative control: the structural snapshot detects a changed field',
    snapshotWorkspace(probeState) !== probeBefore
  );

  const probeHandleBefore = snapshotWorkspace(probeState);
  probeState.folders.notes = { kind: 'directory', name: 'notes' };

  check(
    'I02',
    'negative control: the structural snapshot detects a replaced handle',
    snapshotWorkspace(probeState) !== probeHandleBefore
  );

  const controlRecorder = createRecorder();
  const controlNotes = makeDirectoryHandle({
    name: 'notes',
    entries: [],
    recorder: controlRecorder,
  });
  const controlRoot = makeDirectoryHandle({
    name: 'ControlRoot',
    entries: [],
    recorder: controlRecorder,
    options: { createdChildren: { notes: controlNotes } },
  });

  await controlRoot.getDirectoryHandle('notes', { create: true });

  check(
    'I03',
    'negative control: the recording trap reports a creation and a write',
    controlRecorder.created.length === 1 &&
      controlRecorder.writeCalls.length === 1 &&
      (await controlRoot.values().next()).done === true,
    JSON.stringify(controlRecorder)
  );

  const controlScan = await scannerModule.scanNotesFolder(controlNotes);

  check(
    'I04',
    'negative control: the scanner accepts a plain (non-trap) empty directory handle',
    Array.isArray(controlScan) && controlScan.length === 0
  );

  // -------------------------------------------------------------
  // Report
  // -------------------------------------------------------------

  const failed = results.filter((entry) => !entry.group && !entry.ok);
  const passed = results.filter((entry) => !entry.group && entry.ok);

  for (const entry of results) {
    if (entry.group) {
      console.log(`\n${entry.group}`);
      continue;
    }

    console.log(
      `${entry.ok ? 'PASS' : 'FAIL'} [${entry.id}] ${entry.name}${entry.ok ? '' : ` — ${entry.detail}`}`
    );
  }

  console.log(`\nWORKSPACE STORAGE VALIDATORS: ${passed.length} passed, ${failed.length} failed`);
  process.exitCode = failed.length === 0 ? 0 : 1;
})().catch((error) => {
  console.error('WORKSPACE STORAGE VALIDATORS: harness error', error);
  process.exitCode = 1;
});
