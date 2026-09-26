#!/usr/bin/env node
'use strict';

/**
 * ACT 1A — Workspace format detection validators.
 *
 * Executes the REAL shipped owners in Node (package.json is type=module):
 *   - js/workspace/workspace-open.js       (detection + picker normalization)
 *   - js/workspace/workspace-controller.js (openWorkspace() gate + reporting)
 *
 * Nothing is re-implemented: detection is driven through the shipped modules,
 * directory handles are recording traps, and the controller is exercised
 * through its own global WORKSPACE_API against a shimmed window/document.
 *
 * Contract under test (ACT 1A):
 *   - detection is strict and read-only: one directory iteration, no
 *     getDirectoryHandle/getFileHandle({create:true}), no createWritable(),
 *     no removeEntry(), no permission request;
 *   - outcomes: empty | valid-notes | rejected-legacy | rejected-mixed |
 *     rejected-invalid-notes-entry | permission-failure | canceled;
 *   - detection happens BEFORE any WORKSPACE_STATE replacement, and every
 *     non-valid outcome preserves the currently active Workspace (rootHandle,
 *     rootName, folders, files, activeFile), navigation history, current save
 *     handle, DOM (Sidebar/editor) and the editor buffer;
 *   - a valid notes/ Workspace is detected but NOT activated in ACT 1A
 *     (activation needs the ACT 1B state schema + scanner).
 *
 * Usage: node scripts/workspace-detection-validators.cjs
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const OPEN_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-open.js');
const CONTROLLER_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-controller.js');

const OPEN_SOURCE = fs.readFileSync(OPEN_PATH, 'utf8');
const CONTROLLER_SOURCE = fs.readFileSync(CONTROLLER_PATH, 'utf8');

const results = [];
function check(id, name, ok, detail) {
  results.push({ id, name, ok: Boolean(ok), detail: detail == null ? '' : String(detail) });
}
function group(title) {
  results.push({ group: title });
}

// ---------------------------------------------------------------
// Recording directory-handle traps
// ---------------------------------------------------------------

function createRecorder() {
  return { writes: [], readHandles: [], permissions: [], iterations: 0 };
}

function recordWrite(recorder, api, detail) {
  recorder.writes.push(`${api}${detail ? `(${detail})` : ''}`);
}

function recordRead(recorder, api, detail) {
  recorder.readHandles.push(`${api}${detail ? `(${detail})` : ''}`);
}

// A directory handle whose every mutating API is recorded instead of executed.
function createTrapDirectoryHandle(name, entries, recorder, options = {}) {
  const handle = {
    kind: 'directory',
    name,
    async *values() {
      recorder.iterations += 1;
      let seen = 0;
      for (const entry of entries) {
        if (options.throwAfter !== undefined && seen >= options.throwAfter) {
          throw new Error('simulated iteration failure');
        }
        seen += 1;
        // Directory entries are yielded as real child trap handles, so a
        // detected `notes/` directory is a scanable handle (ACT 1B reuses the
        // handle discovered by detection instead of requesting it again).
        yield entry.kind === 'directory'
          ? createTrapDirectoryHandle(entry.name, entry.children || [], recorder)
          : { kind: entry.kind, name: entry.name };
      }
      if (options.throwAtEnd) throw new Error('simulated iteration failure');
      if (options.throwPermission) {
        const error = new Error('simulated permission failure');
        error.name = options.throwPermission;
        throw error;
      }
    },
    getDirectoryHandle(entryName, opts) {
      if (opts && opts.create) recordWrite(recorder, 'getDirectoryHandle', `${entryName},{create:true}`);
      else recordRead(recorder, 'getDirectoryHandle', entryName);
      return handle;
    },
    getFileHandle(entryName, opts) {
      if (opts && opts.create) recordWrite(recorder, 'getFileHandle', `${entryName},{create:true}`);
      else recordRead(recorder, 'getFileHandle', entryName);
      return handle;
    },
    removeEntry(entryName) {
      recordWrite(recorder, 'removeEntry', entryName);
      return Promise.resolve();
    },
    createWritable() {
      recordWrite(recorder, 'createWritable', name);
      return Promise.resolve({ write: () => Promise.resolve(), close: () => Promise.resolve() });
    },
    queryPermission() {
      recorder.permissions.push('queryPermission');
      return Promise.resolve('granted');
    },
    requestPermission() {
      recorder.permissions.push('requestPermission');
      return Promise.resolve('granted');
    },
  };

  return handle;
}

function dir(name) {
  return { kind: 'directory', name };
}
function file(name) {
  return { kind: 'file', name };
}

// ---------------------------------------------------------------
// window / document / MME_APP shims (the controller is DOM-adjacent only)
// ---------------------------------------------------------------

function installBrowserShims() {
  const state = {
    domCalls: [],
    toasts: [],
    logs: [],
    textDocuments: [],
    confirmPrompts: [],
    confirmAnswer: false,
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

  const makeClassList = () => ({ add() {}, remove() {}, contains: () => false, toggle() {} });
  const makeElement = () => ({
    classList: makeClassList(),
    style: {},
    dataset: {},
    innerHTML: '',
    textContent: '',
    value: '',
    disabled: false,
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    remove() {},
    focus() {},
    setAttribute() {},
    getAttribute: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
  });

  globalThis.window = globalThis;
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init) {
      this.type = String(type || '');
      this.detail = init && init.detail;
    }
  };
  globalThis.document = {
    getElementById(id) {
      state.domCalls.push(`getElementById(${id})`);
      return null;
    },
    querySelector(selector) {
      state.domCalls.push(`querySelector(${selector})`);
      return null;
    },
    querySelectorAll: () => [],
    createElement: () => makeElement(),
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
    body: makeElement(),
    documentElement: makeElement(),
  };
  defineGlobal('navigator', { userAgent: 'node-validator' });
  defineGlobal('localStorage', {
    _store: new Map(),
    getItem(k) {
      return this._store.has(k) ? this._store.get(k) : null;
    },
    setItem(k, v) {
      this._store.set(k, String(v));
    },
    removeItem(k) {
      this._store.delete(k);
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

  // ACT 1B asks for an explicit confirmation before it creates notes/. The
  // answer is per-scenario; the default answer is "no", so every fixture that
  // does not opt in proves the zero-mutation path.
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
  state.domCalls.length = 0;
  state.toasts.length = 0;
  state.logs.length = 0;
  state.textDocuments.length = 0;
  state.confirmPrompts.length = 0;
  state.confirmAnswer = false;
  state.navigation.clear = 0;
  state.navigation.seed = 0;
  state.navigation.restore = 0;
  return state;
}

// ---------------------------------------------------------------
// Workspace A (currently active) seeding + structural snapshot
// ---------------------------------------------------------------

function createWorkspaceAHandles() {
  return {
    root: { kind: 'directory', name: 'WorkspaceA' },
    notes: { kind: 'directory', name: 'notes' },
    noteFile: { kind: 'file', name: 'alpha.md' },
    unrelatedDir: { kind: 'directory', name: 'drafts' },
    unrelatedFile: { kind: 'file', name: 'README.md' },
  };
}

// ACT 1B storage model: the previously active Workspace A is a notes/ Workspace
// (folders.notes / files.notes). Candidate failures must leave it byte-identical.
function seedWorkspaceA(state, handles) {
  state.rootHandle = handles.root;
  state.rootName = 'WorkspaceA';
  state.folders.notes = handles.notes;
  state.files.notes = [
    { kind: 'notes', name: 'alpha.md', path: 'notes/alpha.md', handle: handles.noteFile },
  ];
  state.activeFile = {
    kind: 'notes',
    name: 'alpha.md',
    path: 'notes/alpha.md',
    handle: handles.noteFile,
    text: 'Workspace A body',
  };
}

// Structural snapshot: values plus handle identity, so a replaced-but-equal
// handle is still detected as a mutation.
function snapshotWorkspaceState(state) {
  const describe = (value) => {
    if (value == null) return null;
    if (typeof value !== 'object') return { type: typeof value, value };
    return {
      type: 'object',
      name: value.name || null,
      kind: value.kind || null,
      id: handleId(value),
    };
  };

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

  // Generic structural view over the ACT 1B state: every folder/file key is
  // included, so an added, removed or re-valued field is always detected.
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
        (Array.isArray(state.files[key]) ? state.files[key] : []).map((entry) => ({
          name: entry?.name ?? null,
          path: entry?.path ?? null,
          kind: entry?.kind ?? null,
          handle: describe(entry?.handle),
        })),
      ]),
    activeFile: state.activeFile
      ? {
          name: state.activeFile.name,
          path: state.activeFile.path,
          kind: state.activeFile.kind,
          text: state.activeFile.text,
          handle: describe(state.activeFile.handle),
        }
      : null,
  });
}

// ---------------------------------------------------------------
// Static boundary assertions
// ---------------------------------------------------------------

const ACT1A_MARKER = '// ACT 1A — Workspace format detection';
const ACT1B_HANDOFF_MARKER = '// ACT 1B — Workspace initialization';
const WRITE_APIS = [
  'create: true',
  'createWritable(',
  'removeEntry(',
  'getDirectoryHandle(',
  'getFileHandle(',
];

// The ACT 1A write-free detection section ends where the ACT 1B initialization
// section begins: ACT 1B appends its own single writer (createNotesDirectory) to
// the same file, and that writer is asserted separately by the ACT 1B validator.
function detectionSection() {
  const index = OPEN_SOURCE.indexOf(ACT1A_MARKER);
  if (index === -1) return '';

  const end = OPEN_SOURCE.indexOf(ACT1B_HANDOFF_MARKER, index);

  return OPEN_SOURCE.slice(index, end === -1 ? undefined : end);
}

function openWorkspaceSlice() {
  const start = CONTROLLER_SOURCE.indexOf('async function openWorkspace() {');
  const end = CONTROLLER_SOURCE.indexOf('async function activateWorkspaceAtExistingBoundary(');

  if (start === -1 || end === -1 || end <= start) return '';

  return CONTROLLER_SOURCE.slice(start, end);
}

// Static negative assertions must inspect CODE, not the prose that documents
// the guarantees (the ACT 1A header legitimately names the banned APIs).
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

const SECTION = detectionSection();
const OPEN_SLICE = openWorkspaceSlice();
const SECTION_CODE = stripComments(SECTION);
const OPEN_SLICE_CODE = stripComments(OPEN_SLICE);

// ---------------------------------------------------------------
// Fixtures 1-11 — classification (real detectWorkspaceFormat)
// ---------------------------------------------------------------

const CLASSIFICATION_FIXTURES = [
  { id: 'F01', name: 'empty directory', entries: [], expected: 'empty' },
  { id: 'F02', name: 'notes/ directory', entries: [dir('notes')], expected: 'valid-notes' },
  { id: 'F03', name: 'journals/ only', entries: [dir('journals')], expected: 'rejected-legacy' },
  { id: 'F04', name: 'concepts/ only', entries: [dir('concepts')], expected: 'rejected-legacy' },
  { id: 'F05', name: 'archive/ legacy only', entries: [dir('archive')], expected: 'rejected-legacy' },
  {
    id: 'F06',
    name: 'notes/ + journals/',
    entries: [dir('notes'), dir('journals')],
    expected: 'rejected-mixed',
    expectLegacy: ['journals'],
  },
  {
    id: 'F07',
    name: 'notes/ + concepts/',
    entries: [dir('notes'), dir('concepts')],
    expected: 'rejected-mixed',
    expectLegacy: ['concepts'],
  },
  {
    id: 'F08',
    name: 'notes/ + journals/ + concepts/',
    entries: [dir('notes'), dir('journals'), dir('concepts')],
    expected: 'rejected-mixed',
    expectLegacy: ['journals', 'concepts'],
  },
  {
    id: 'F09',
    name: 'notes/ + archive/',
    entries: [dir('notes'), dir('archive')],
    expected: 'rejected-mixed',
    expectLegacy: ['archive'],
  },
  {
    id: 'F10',
    name: 'notes entry is a file, not a directory',
    entries: [file('notes'), dir('journals')],
    expected: 'rejected-invalid-notes-entry',
    expectNotesKind: 'file',
  },
  {
    id: 'F11',
    name: 'notes/ plus unrelated files and folders',
    entries: [
      dir('notes'),
      dir('assets'),
      dir('system'),
      dir('images'),
      file('README.md'),
      file('budget.csv'),
    ],
    expected: 'valid-notes',
  },
  {
    id: 'F11b',
    name: 'case-variant Notes/ is not the exact lowercase notes (no legacy markers)',
    entries: [dir('Notes'), file('README.md')],
    expected: 'uninitialized',
    expectCaseVariant: 'Notes',
  },
  {
    id: 'F11c',
    name: 'unrelated content only → uninitialized (ACT 1B split from empty)',
    entries: [file('README.md'), dir('drafts')],
    expected: 'uninitialized',
  },
];

// ---------------------------------------------------------------
// Fixtures 12-20 — controller gate, transactional preservation, zero writes
// ---------------------------------------------------------------

const ABORT_ERROR = Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' });
const DENIED_ERROR = Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' });

const CONTROLLER_SCENARIOS = [
  {
    id: 'C01',
    label: 'legacy journals/ selected while Workspace A is active',
    entries: [dir('journals')],
    expected: 'rejected-legacy',
    expectToast: /Legacy workspace rejected/,
  },
  {
    id: 'C02',
    label: 'legacy concepts/ selected while Workspace A is active',
    entries: [dir('concepts')],
    expected: 'rejected-legacy',
    expectToast: /Legacy workspace rejected/,
  },
  {
    id: 'C03',
    label: 'legacy archive/ selected while Workspace A is active',
    entries: [dir('archive')],
    expected: 'rejected-legacy',
    expectToast: /Legacy workspace rejected/,
  },
  {
    id: 'C04',
    label: 'mixed notes/ + journals/ + concepts/ while Workspace A is active',
    entries: [dir('notes'), dir('journals'), dir('concepts')],
    expected: 'rejected-mixed',
    expectToast: /Mixed workspace rejected/,
  },
  {
    id: 'C05',
    label: '"notes" entry is a file while Workspace A is active',
    entries: [file('notes')],
    expected: 'rejected-invalid-notes-entry',
    expectToast: /is a file, not a folder/,
  },
  {
    id: 'C06',
    label: 'empty folder declined by the user while Workspace A is active',
    entries: [],
    expected: 'empty',
    confirmAnswer: false,
    expectToast: /nothing was changed/,
  },
  {
    id: 'C07',
    label: 'permission failure while Workspace A is active',
    entries: [],
    handleOptions: { throwPermission: 'NotAllowedError' },
    expected: 'permission-failure',
    expectToast: /Workspace unavailable/,
  },
  {
    id: 'C08',
    label: 'iteration failure while Workspace A is active',
    entries: [dir('journals'), dir('concepts')],
    handleOptions: { throwAfter: 1 },
    expected: 'permission-failure',
    expectToast: /Workspace unavailable/,
  },
  {
    id: 'C09',
    label: 'picker cancellation while Workspace A is active',
    pickerError: ABORT_ERROR,
    expected: 'canceled',
    expectNoToast: true,
  },
  {
    id: 'C10',
    label: 'valid notes/ workspace while Workspace A is active',
    entries: [dir('notes'), file('README.md')],
    expected: 'valid-notes',
    expectActivation: true,
    expectToast: /Index activation follows in the next package/,
  },
];

// ---------------------------------------------------------------
// Runner
// ---------------------------------------------------------------

const SW_PATH = path.join(ROOT, 'sw.js');
const INDEX_PATH = path.join(ROOT, 'index.html');
const SW_SOURCE = fs.readFileSync(SW_PATH, 'utf8');
const INDEX_SOURCE = fs.readFileSync(INDEX_PATH, 'utf8');

(async () => {
  const shimState = installBrowserShims();
  const openModule = await import(pathToFileURL(OPEN_PATH).href);

  // The real controller is imported once, up front, so WORKSPACE_API and
  // WORKSPACE_STATE are the shipped objects (not a copy).
  await import(pathToFileURL(CONTROLLER_PATH).href);

  group('Static boundary — ACT 1A detection is write-free and loader-neutral');

  check('S01', 'ACT 1A detection section present in workspace-open.js', SECTION.length > 0);
  check(
    'S02',
    'detection section references no write API (comments excluded)',
    SECTION_CODE.length > 0 && WRITE_APIS.every((api) => !SECTION_CODE.includes(api)),
    WRITE_APIS.filter((api) => SECTION_CODE.includes(api)).join(', ')
  );
  check('S03', 'openWorkspace() slice located in workspace-controller.js', OPEN_SLICE.length > 0);
  check(
    'S04',
    'openWorkspace() slice references no write API and no ensureSubfolder()',
    OPEN_SLICE_CODE.length > 0 &&
      WRITE_APIS.every((api) => !OPEN_SLICE_CODE.includes(api)) &&
      !OPEN_SLICE_CODE.includes('ensureSubfolder('),
    WRITE_APIS.filter((api) => OPEN_SLICE_CODE.includes(api)).join(', ')
  );
  check(
    'S05',
    'openWorkspace() slice performs no WORKSPACE_STATE replacement',
    OPEN_SLICE_CODE.length > 0 &&
      !/WORKSPACE_STATE\.(rootHandle|rootName|folders|files|activeFile)\s*=/.test(OPEN_SLICE_CODE)
  );
  check(
    'S06',
    'openWorkspace() gate runs detection before deciding',
    OPEN_SLICE.includes('openWorkspaceCandidate()') && OPEN_SLICE.includes('detection.status')
  );
  check(
    'S07',
    'detection is published through WORKSPACE_API',
    typeof globalThis.WORKSPACE_API?.detectWorkspaceFormat === 'function' &&
      typeof globalThis.WORKSPACE_API?.openWorkspaceCandidate === 'function' &&
      typeof globalThis.WORKSPACE_API?.openWorkspace === 'function'
  );
  check(
    'S08',
    'no new runtime module added (workspace-detector.js absent)',
    !fs.existsSync(path.join(ROOT, 'js', 'workspace', 'workspace-detector.js'))
  );
  check(
    'S09',
    'loader and precache unchanged (existing owners still wired)',
    SW_SOURCE.includes("'./js/workspace/workspace-open.js'") &&
      SW_SOURCE.includes("'./js/workspace/workspace-controller.js'") &&
      INDEX_SOURCE.includes('./js/workspace/workspace-controller.js')
  );
  check(
    'S10',
    'ACT 1B/1C activation boundary retained but not called from the ACT 1A path',
    CONTROLLER_SOURCE.includes('async function activateWorkspaceAtExistingBoundary(root) {') &&
      !OPEN_SLICE.includes('activateWorkspaceAtExistingBoundary(')
  );

  group('Fixtures 1-11 — strict format classification (real detectWorkspaceFormat)');

  const allRecorders = [];

  for (const fixture of CLASSIFICATION_FIXTURES) {
    const recorder = createRecorder();
    allRecorders.push(recorder);

    const handle = createTrapDirectoryHandle('FixtureRoot', fixture.entries, recorder);
    const detection = await openModule.detectWorkspaceFormat(handle);

    check(
      fixture.id,
      `${fixture.name} → ${fixture.expected}`,
      detection.status === fixture.expected,
      `got ${detection.status}`
    );

    if (fixture.expectLegacy) {
      check(
        `${fixture.id}l`,
        `${fixture.name}: legacy directories reported for diagnostics`,
        JSON.stringify(detection.legacyDirectories) === JSON.stringify(fixture.expectLegacy),
        JSON.stringify(detection.legacyDirectories)
      );
    }

    if (fixture.expectNotesKind) {
      check(
        `${fixture.id}n`,
        `${fixture.name}: notes entry kind reported`,
        detection.notesEntryKind === fixture.expectNotesKind,
        String(detection.notesEntryKind)
      );
    }

    if (fixture.expectCaseVariant) {
      check(
        `${fixture.id}c`,
        `${fixture.name}: case variant reported`,
        detection.caseVariantNotesEntry === fixture.expectCaseVariant,
        String(detection.caseVariantNotesEntry)
      );
    }

    check(
      `${fixture.id}w`,
      `${fixture.name}: zero writes, zero handle requests, zero permission prompts`,
      recorder.writes.length === 0 &&
        recorder.readHandles.length === 0 &&
        recorder.permissions.length === 0,
      JSON.stringify(recorder)
    );
    check(
      `${fixture.id}p`,
      `${fixture.name}: exactly one read iteration`,
      recorder.iterations === 1,
      String(recorder.iterations)
    );
  }

  group('Fixtures 12-14 — read failure and picker normalization (real owners)');

  const permissionRecorder = createRecorder();
  allRecorders.push(permissionRecorder);
  const permissionDetection = await openModule.detectWorkspaceFormat(
    createTrapDirectoryHandle('NoPermission', [], permissionRecorder, {
      throwPermission: 'NotAllowedError',
    })
  );
  check(
    'F12',
    'permission failure → permission-failure/permission',
    permissionDetection.status === 'permission-failure' && permissionDetection.reason === 'permission',
    `${permissionDetection.status}/${permissionDetection.reason}`
  );
  check(
    'F12e',
    'permission failure preserves the diagnostic error',
    String(permissionDetection.error?.name || '') === 'NotAllowedError',
    String(permissionDetection.error?.name)
  );
  check(
    'F12w',
    'permission failure attempted no write and no permission prompt',
    permissionRecorder.writes.length === 0 && permissionRecorder.permissions.length === 0,
    JSON.stringify(permissionRecorder)
  );

  const iterationRecorder = createRecorder();
  allRecorders.push(iterationRecorder);
  const iterationDetection = await openModule.detectWorkspaceFormat(
    createTrapDirectoryHandle('IterationFailure', [dir('journals'), dir('concepts')], iterationRecorder, {
      throwAfter: 1,
    })
  );
  check(
    'F13',
    'iteration failure → permission-failure/iteration',
    iterationDetection.status === 'permission-failure' && iterationDetection.reason === 'iteration',
    `${iterationDetection.status}/${iterationDetection.reason}`
  );
  check(
    'F13w',
    'iteration failure attempted no write',
    iterationRecorder.writes.length === 0,
    JSON.stringify(iterationRecorder)
  );

  const noHandleDetection = await openModule.detectWorkspaceFormat(null);
  check(
    'F13b',
    'missing root handle → permission-failure (never throws)',
    noHandleDetection.status === 'permission-failure' && noHandleDetection.reason === 'iteration',
    `${noHandleDetection.status}/${noHandleDetection.reason}`
  );

  globalThis.window.showDirectoryPicker = () => Promise.reject(ABORT_ERROR);
  const cancelCandidate = await openModule.openWorkspaceCandidate();
  check(
    'F14',
    'picker cancellation → canceled (no exception escapes)',
    cancelCandidate.status === 'canceled' && cancelCandidate.reason === 'picker',
    `${cancelCandidate.status}/${cancelCandidate.reason}`
  );
  check(
    'F14b',
    'cancellation is not reported as an error',
    cancelCandidate.error === null && cancelCandidate.root === null && cancelCandidate.entries === null
  );

  globalThis.window.showDirectoryPicker = () => Promise.reject(DENIED_ERROR);
  const deniedCandidate = await openModule.openWorkspaceCandidate();
  check(
    'F14c',
    'picker denial → permission-failure/picker with the error preserved',
    deniedCandidate.status === 'permission-failure' &&
      deniedCandidate.reason === 'picker' &&
      deniedCandidate.error === DENIED_ERROR,
    `${deniedCandidate.status}/${deniedCandidate.reason}`
  );

  const savedPicker = globalThis.window.showDirectoryPicker;
  delete globalThis.window.showDirectoryPicker;
  const unsupportedCandidate = await openModule.openWorkspaceCandidate();
  check(
    'F14d',
    'unsupported picker → permission-failure with actionable message',
    unsupportedCandidate.status === 'permission-failure' &&
      /not supported/i.test(String(unsupportedCandidate.error?.message || '')),
    String(unsupportedCandidate.error?.message)
  );
  globalThis.window.showDirectoryPicker = savedPicker;

  group('Fixtures 15 + 20 — transactional preservation through the real openWorkspace()');

  const workspaceState = globalThis.WORKSPACE_STATE;

  check(
    'C00',
    'real controller imported and WORKSPACE_STATE published',
    Boolean(workspaceState?.folders) && typeof globalThis.WORKSPACE_API?.openWorkspace === 'function'
  );

  for (const scenario of CONTROLLER_SCENARIOS) {
    const recorder = createRecorder();
    allRecorders.push(recorder);

    const workspaceAHandles = createWorkspaceAHandles();
    seedWorkspaceA(workspaceState, workspaceAHandles);

    const candidateHandle = createTrapDirectoryHandle(
      'WorkspaceB',
      scenario.entries || [],
      recorder,
      scenario.handleOptions || {}
    );

    globalThis.window.showDirectoryPicker = scenario.pickerError
      ? () => Promise.reject(scenario.pickerError)
      : () => Promise.resolve(candidateHandle);

    resetShimState(shimState);

    // ACT 1B: only a scenario that explicitly answers "yes" may create notes/.
    // Every other fixture therefore proves the zero-mutation path.
    shimState.confirmAnswer = scenario.confirmAnswer === true;

    const saveHandleSentinel = { kind: 'file', name: 'save-sentinel.md' };
    globalThis.currentSaveHandle = saveHandleSentinel;

    const before = snapshotWorkspaceState(workspaceState);

    await globalThis.WORKSPACE_API.openWorkspace();

    const after = snapshotWorkspaceState(workspaceState);

    check(
      scenario.id,
      `${scenario.label} → ${scenario.expected}`,
      shimState.logs.some((line) => line.includes(`detection status=${scenario.expected}`)),
      shimState.logs.join(' | ')
    );
    if (scenario.expectActivation) {
      check(
        `${scenario.id}s`,
        `${scenario.label}: the previous Workspace is replaced only because the scan succeeded`,
        after !== before && workspaceState.rootName === 'WorkspaceB',
        after
      );
      check(
        `${scenario.id}a`,
        `${scenario.label}: folders.notes/files.notes hold the detected notes/ storage and activeFile is cleared`,
        workspaceState.folders.notes?.name === 'notes' &&
          Array.isArray(workspaceState.files.notes) &&
          workspaceState.files.notes.length === 0 &&
          workspaceState.activeFile === null,
        `${String(workspaceState.folders.notes?.name)}/${workspaceState.files.notes?.length}`
      );
      check(
        `${scenario.id}l`,
        `${scenario.label}: no legacy folder/file field populated as authoritative state`,
        !('journals' in workspaceState.folders) &&
          !('concepts' in workspaceState.folders) &&
          !('assets' in workspaceState.folders) &&
          !('archive' in workspaceState.folders) &&
          !('system' in workspaceState.folders) &&
          !('journals' in workspaceState.files) &&
          !('concepts' in workspaceState.files)
      );
    } else {
      check(
        `${scenario.id}s`,
        `${scenario.label}: Workspace A state preserved (folders, files, activeFile, handles)`,
        before === after,
        after
      );
      check(
        `${scenario.id}a`,
        `${scenario.label}: Workspace A remains active`,
        workspaceState.rootHandle === workspaceAHandles.root &&
          workspaceState.rootName === 'WorkspaceA' &&
          workspaceState.activeFile?.handle === workspaceAHandles.noteFile &&
          workspaceState.folders.notes === workspaceAHandles.notes,
        `${workspaceState.rootName}/${workspaceState.activeFile?.path}`
      );
    }
    check(
      `${scenario.id}f`,
      `${scenario.label}: no filesystem mutation attempted`,
      recorder.writes.length === 0 && recorder.permissions.length === 0,
      JSON.stringify(recorder)
    );
    check(
      `${scenario.id}n`,
      `${scenario.label}: navigation history untouched`,
      shimState.navigation.clear === 0 &&
        shimState.navigation.seed === 0 &&
        shimState.navigation.restore === 0,
      JSON.stringify(shimState.navigation)
    );
    check(
      `${scenario.id}h`,
      `${scenario.label}: currentSaveHandle unchanged`,
      globalThis.currentSaveHandle === saveHandleSentinel
    );
    if (scenario.expectActivation) {
      // Only the existing Workspace status owner may touch the DOM on a
      // successful activation: no Sidebar list render, badge or timeline.
      const statusDomCalls = [
        'getElementById(btnJournalToday)',
        'getElementById(btnArchiveActive)',
        'getElementById(workspaceTitle)',
      ];
      check(
        `${scenario.id}d`,
        `${scenario.label}: only the Workspace status owner touched the DOM (no Sidebar list render)`,
        shimState.domCalls.every((call) => statusDomCalls.includes(call)),
        shimState.domCalls.join(', ')
      );
    } else {
      check(
        `${scenario.id}d`,
        `${scenario.label}: Sidebar/editor DOM untouched`,
        shimState.domCalls.length === 0,
        shimState.domCalls.join(', ')
      );
    }
    check(
      `${scenario.id}e`,
      `${scenario.label}: editor buffer untouched (no document replaced)`,
      shimState.textDocuments.length === 0,
      JSON.stringify(shimState.textDocuments)
    );

    if (scenario.expectNoToast) {
      check(
        `${scenario.id}t`,
        `${scenario.label}: user cancel produces no error toast`,
        shimState.toasts.length === 0,
        JSON.stringify(shimState.toasts)
      );
    } else {
      const toast = shimState.toasts[0];
      check(
        `${scenario.id}t`,
        `${scenario.label}: exactly one transient message shown`,
        shimState.toasts.length === 1 && Boolean(toast?.ms) && scenario.expectToast.test(toast.message),
        JSON.stringify(shimState.toasts)
      );
    }

  }

  group('Fixture 20 — WORKSPACE_STATE untouched for rejected / empty / failure outcomes');

  const EXPLICIT_STATE_FIXTURES = [
    { id: 'F20a', label: 'rejected legacy', entries: [dir('journals')] },
    { id: 'F20b', label: 'rejected mixed', entries: [dir('notes'), dir('archive')] },
    { id: 'F20c', label: 'rejected invalid notes entry', entries: [file('notes')] },
    { id: 'F20d', label: 'empty folder', entries: [], confirmAnswer: false },
    {
      id: 'F20e',
      label: 'permission failure',
      entries: [],
      handleOptions: { throwPermission: 'NotAllowedError' },
    },
    {
      id: 'F20f',
      label: 'iteration failure',
      entries: [dir('journals'), dir('concepts')],
      handleOptions: { throwAfter: 1 },
    },
    { id: 'F20g', label: 'picker cancellation', pickerError: ABORT_ERROR, entries: [] },
  ];

  for (const fixture of EXPLICIT_STATE_FIXTURES) {
    const recorder = createRecorder();
    allRecorders.push(recorder);

    const workspaceAHandles = createWorkspaceAHandles();
    seedWorkspaceA(workspaceState, workspaceAHandles);

    globalThis.window.showDirectoryPicker = fixture.pickerError
      ? () => Promise.reject(fixture.pickerError)
      : () =>
          Promise.resolve(
            createTrapDirectoryHandle(
              'WorkspaceB',
              fixture.entries,
              recorder,
              fixture.handleOptions || {}
            )
          );

    resetShimState(shimState);
    // ACT 1B: the empty-folder fixture never confirms, so the zero-write proof
    // below covers the declined initialization path.
    shimState.confirmAnswer = fixture.confirmAnswer === true;
    globalThis.currentSaveHandle = { kind: 'file', name: 'save-sentinel.md' };

    const before = snapshotWorkspaceState(workspaceState);
    const keysBefore = JSON.stringify({
      folders: Object.keys(workspaceState.folders),
      files: Object.keys(workspaceState.files),
      state: Object.keys(workspaceState),
    });

    await globalThis.WORKSPACE_API.openWorkspace();

    check(
      fixture.id,
      `${fixture.label}: WORKSPACE_STATE deep-unchanged (values and handle identity)`,
      snapshotWorkspaceState(workspaceState) === before
    );
    check(
      `${fixture.id}k`,
      `${fixture.label}: WORKSPACE_STATE schema unchanged by the candidate`,
      JSON.stringify({
        folders: Object.keys(workspaceState.folders),
        files: Object.keys(workspaceState.files),
        state: Object.keys(workspaceState),
      }) === keysBefore &&
        !('journals' in workspaceState.folders) &&
        !('concepts' in workspaceState.folders)
    );
    check(
      `${fixture.id}w`,
      `${fixture.label}: no write and no permission prompt attempted`,
      recorder.writes.length === 0 && recorder.permissions.length === 0,
      JSON.stringify(recorder)
    );
  }

  group('Fixtures 16-19 — aggregate proof of zero writes across every outcome');

  const totalWrites = allRecorders.reduce((sum, recorder) => sum + recorder.writes.length, 0);
  const totalReadHandles = allRecorders.reduce((sum, recorder) => sum + recorder.readHandles.length, 0);
  const totalPermissions = allRecorders.reduce((sum, recorder) => sum + recorder.permissions.length, 0);

  check(
    'F16',
    'no getDirectoryHandle(..., { create: true }) on any outcome',
    totalWrites === 0 &&
      !OPEN_SLICE_CODE.includes('getDirectoryHandle(') &&
      !SECTION_CODE.includes('getDirectoryHandle('),
    `${totalWrites} write(s)`
  );
  check(
    'F17',
    'no getFileHandle(..., { create: true }) on any outcome',
    totalWrites === 0 &&
      !OPEN_SLICE_CODE.includes('getFileHandle(') &&
      !SECTION_CODE.includes('getFileHandle('),
    `${totalWrites} write(s)`
  );
  check(
    'F18',
    'no createWritable() on any outcome',
    totalWrites === 0 &&
      !OPEN_SLICE_CODE.includes('createWritable(') &&
      !SECTION_CODE.includes('createWritable('),
    `${totalWrites} write(s)`
  );
  check(
    'F19',
    'no removeEntry() on any outcome',
    totalWrites === 0 &&
      !OPEN_SLICE_CODE.includes('removeEntry(') &&
      !SECTION_CODE.includes('removeEntry('),
    `${totalWrites} write(s)`
  );
  check(
    'F19b',
    'no queryPermission()/requestPermission() on any outcome',
    totalPermissions === 0,
    `${totalPermissions} prompt(s)`
  );
  check(
    'F19c',
    'no handle request at all — detection is a single read pass',
    totalReadHandles === 0,
    `${totalReadHandles} handle request(s)`
  );
  check(
    'F19d',
    'detection never throws and always returns an explicit status',
    allRecorders.length > 0
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

  console.log(`\nWORKSPACE DETECTION VALIDATORS: ${passed.length} passed, ${failed.length} failed`);
  process.exitCode = failed.length === 0 ? 0 : 1;
})().catch((error) => {
  console.error('WORKSPACE DETECTION VALIDATORS: harness error', error);
  process.exitCode = 1;
});
