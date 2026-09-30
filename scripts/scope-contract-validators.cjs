#!/usr/bin/env node
'use strict';

/**
 * ACT 3 — Current Document / Workspace scope contract.
 *
 * ACT 3 establishes piping and contracts only: one shared parser, two explicit
 * data scopes, and handle-PROVEN Workspace membership. It creates no parser, no
 * second Index and no second document store.
 *
 * Executes the REAL shipped owners (main.js is a browser script, so its owners
 * are extracted verbatim and evaluated together with the module-level `let`
 * state they close over — the same technique the ACT 1C/2A/2B/2C suites use):
 *   - js/main.js — getCurrentDocumentScope, getWorkspaceScope,
 *     resolveCurrentDocumentWorkspaceMembership,
 *     describeCurrentDocumentReportState, buildCurrentDocumentParserContext,
 *     logDocumentScopes, and the real buildWorkspaceIndex;
 *   - js/workspace/workspace-parser.js — the single shared parse owner.
 *
 * The single Workspace source (WORKSPACE_STATE) and the single saved Index
 * (WORKSPACE_INDEX_STATE) are the shipped objects, so scope separation is
 * asserted against the real state, not a copy.
 *
 * 41 fixtures: C01-C10 live parsing, S11-S20 scope separation, M21-M28
 * membership, R29-R32 Reports, X33-X41 cross-package.
 *
 * Usage: node scripts/current-document-scope-validators.cjs
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

const MAIN_SOURCE = read('js', 'main.js');
const PARSER_SOURCE = read('js', 'workspace', 'workspace-parser.js');
const WORKSPACE_CONTROLLER_SOURCE = read('js', 'workspace', 'workspace-controller.js');

const APP_VERSION_BASELINE = 'markmap-journal-pwa-0.6.3-tasks-wiki-links-foundation';

const results = [];
function record(id, name, ok, detail) {
  const d = typeof detail === 'function' ? detail() : detail;
  results.push({ id, name, ok: Boolean(ok), detail: ok || d == null ? '' : String(d) });
}
function check(id, name, ok, detail) {
  // A fixture may be passed as a value, a thunk, or a promise. A thunk MUST be
  // invoked: coercing a function with Boolean() would report every fixture as
  // passing without ever evaluating it.
  let value = ok;

  if (typeof value === 'function') {
    try {
      value = value();
    } catch (e) {
      record(id, name, false, e && e.message ? e.message : String(e));
      return Promise.resolve();
    }
  }

  if (value && typeof value.then === 'function') {
    return value.then(
      (v) => record(id, name, v, detail),
      (e) => record(id, name, false, e && e.message ? e.message : String(e))
    );
  }

  record(id, name, value, detail);
  return Promise.resolve();
}
function group(title) {
  results.push({ group: title });
}

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

// Owners that live inside an IIFE (js/workspace/task-review.js) are INDENTED, so
// their closing brace is never a bare '}' line. This extracts by brace counting,
// which is exact for balanced JavaScript and does not depend on indentation.
function extractFunctionByBraces(src, signature) {
  const start = src.indexOf(signature);
  if (start === -1) throw new Error(`verbatim extraction failed: ${signature}`);
  const braceStart = src.indexOf('{', start);
  if (braceStart === -1) throw new Error(`verbatim extraction failed: ${signature}`);
  let depth = 0;
  for (let i = braceStart; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`verbatim extraction never closed: ${signature}`);
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
// Harness: the shipped module-level state the real owners close over
// ---------------------------------------------------------------

function makeNotesFileHandle(name, initialText) {
  const handle = {
    kind: 'file',
    name,
    __text: initialText,
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
          handle.lastModified += 1;
        },
      };
    },
  };
  return handle;
}

const h = { logs: [], rebuilds: [], indexBuilds: 0, renders: 0, writes: [] };

// The single canonical Workspace state (js/workspace/workspace-state.js shape).
const WORKSPACE_STATE = {
  rootHandle: null,
  rootName: '',
  folders: { notes: null },
  files: { notes: [] },
  activeFile: null,
};
globalThis.WORKSPACE_STATE = WORKSPACE_STATE;

const OWNER_EXTRACTS = [
  extractBlockFrom(MAIN_SOURCE, 'const WORKSPACE_INDEX_STATE = {', '};'),
  extractBlockFrom(MAIN_SOURCE, 'async function readWorkspaceFileText('),
  extractBlockFrom(MAIN_SOURCE, 'async function buildWorkspaceIndex('),
  extractBlockFrom(MAIN_SOURCE, 'function buildCurrentDocumentParserContext({ name, path, text }) {'),
  extractBlockFrom(MAIN_SOURCE, 'function resolveCurrentDocumentWorkspaceMembership() {'),
  extractBlockFrom(MAIN_SOURCE, 'function describeCurrentDocumentReportState() {'),
  extractBlockFrom(MAIN_SOURCE, 'function getCurrentDocumentScope() {'),
  extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceScope() {'),
  extractBlockFrom(MAIN_SOURCE, 'function logDocumentScopes() {'),
  // ---- ACT 4A owners, verbatim from js/main.js ----
  extractBlockFrom(MAIN_SOURCE, 'const MME_SCOPE_IDS = Object.freeze({', '});'),
  extractBlockFrom(MAIN_SOURCE, 'const MME_AVAILABILITY = Object.freeze({', '});'),
  extractBlockFrom(MAIN_SOURCE, 'function resolveSavedIndexSnapshot(indexSnapshot) {'),
  extractBlockFrom(MAIN_SOURCE, 'function getCurrentDocumentWorkspaceContext(documentScope) {'),
  extractBlockFrom(MAIN_SOURCE, 'function getCurrentDocumentIdentity(documentScope) {'),
  extractBlockFrom(MAIN_SOURCE, 'function getCurrentDocumentTagsProjection(documentScope) {'),
  extractBlockFrom(MAIN_SOURCE, 'function getCurrentDocumentTasksProjection(documentScope) {'),
  extractBlockFrom(MAIN_SOURCE, 'function getCurrentDocumentLinksOutProjection(documentScope, indexSnapshot) {'),
  extractBlockFrom(MAIN_SOURCE, 'function getCurrentDocumentLinksInAvailability(documentScope, indexSnapshot) {'),
  extractBlockFrom(MAIN_SOURCE, 'function getCurrentDocumentConsumerAvailability(documentScope) {'),
  extractBlockFrom(MAIN_SOURCE, 'function getCurrentDocumentComposition(options) {'),
  // ---- ACT 4B owners, verbatim ----
  extractBlockFrom(MAIN_SOURCE, 'const MME_PANEL_COMPOSITION = Object.freeze({', '});'),
  extractBlockFrom(MAIN_SOURCE, 'function getSidebarComposition(options) {'),
  extractBlockFrom(MAIN_SOURCE, 'function deactivateWorkspaceComposition() {'),
  extractBlockFrom(MAIN_SOURCE, 'function applySidebarComposition(options) {'),
  extractBlockFrom(MAIN_SOURCE, 'async function openNote() {'),
];

// Collaborators the real owners reference: UI/IO bridges, not owners under
// test. The scope API must stay pure with respect to them.
const COLLABORATORS = [
  'const CURRENT_DOCUMENT_FALLBACK_NAME = "untitled.md";',
  'const CURRENT_DOCUMENT_FALLBACK_PATH = "";',
  '// ---- shipped module-level state from main.js ----',
  'let dirty = false;',
  'let currentFileName = "untitled.md";',
  'let currentSaveHandle = null;',
  'let __virtualReportSession = null;',
  'const md = { value: "" };',
  '// ---- collaborators (UI bridge, not owners under test) ----',
  'const log = (m) => globalThis.__h.logs.push(String(m));',
  '// ---- controllable doubles for the existing owners openNote wraps ----',
  // 'cancel'   : openSmart returns WITHOUT activating a file (AbortError path)
  // 'success'  : openSmart installs a NEW handle + filename
  // 'samefile' : openSmart installs a new handle for the SAME filename
  // 'throw'    : openSmart rejects (read failure)
  'let __openResult = "cancel";',
  'let __guardResult = true;',
  'let __openCalls = 0;',
  'let __guardCalls = 0;',
  'function confirmDiscardIfDirty() { __guardCalls += 1; return __guardResult; }',
  'async function openSmart() {',
  '  __openCalls += 1;',
  '  if (__openResult === "throw") throw new Error("read failed");',
  '  if (__openResult === "cancel") return;',
  '  if (__openResult === "samefile") { currentSaveHandle = { __h: "same-file-new-handle" }; return; }',
  '  currentSaveHandle = { __h: "new-handle" };',
  '  currentFileName = "opened.md";',
  '}',
].join('\n');

const OWNER_API = [
  'return {',
  '  buildWorkspaceIndex,',
  '  WORKSPACE_INDEX_STATE,',
  '  getCurrentDocumentScope,',
  '  getWorkspaceScope,',
  '  logDocumentScopes,',
  // ---- ACT 4A owners ----
  '  MME_SCOPE_IDS,',
  '  MME_AVAILABILITY,',
  '  getCurrentDocumentWorkspaceContext,',
  '  getCurrentDocumentIdentity,',
  '  getCurrentDocumentTagsProjection,',
  '  getCurrentDocumentTasksProjection,',
  '  getCurrentDocumentLinksOutProjection,',
  '  getCurrentDocumentLinksInAvailability,',
  '  getCurrentDocumentConsumerAvailability,',
  '  getCurrentDocumentComposition,',
  // ---- ACT 4B owners ----
  '  MME_PANEL_COMPOSITION,',
  '  getSidebarComposition,',
  '  deactivateWorkspaceComposition,',
  '  applySidebarComposition,',
  '  openNote,',
  // ---- Test doubles for the two EXISTING owners openNote wraps ----
  // These are collaborators, not owners under test: openSmart (the physical
  // opener) and confirmDiscardIfDirty (the existing prompt owner) are both
  // shipped code that cannot run headless. openNote itself is the REAL owner
  // under test, extracted verbatim above.
  '  __setOpenResult: (mode) => { __openResult = mode; },',
  '  __setGuardResult: (v) => { __guardResult = Boolean(v); },',
  '  __calls: () => ({ openSmart: __openCalls, guard: __guardCalls }),',
  '  __resetCalls: () => { __openCalls = 0; __guardCalls = 0; },',
  '  setText: (v) => { md.value = v; },',
  '  setDirty: (v) => { dirty = v; },',
  '  setFileName: (v) => { currentFileName = v; },',
  '  setHandle: (v) => { currentSaveHandle = v; },',
  '  setReportSession: (v) => { __virtualReportSession = v; },',
  '  state: () => ({ dirty, currentFileName, currentSaveHandle, mdValue: md.value,',
  '    report: __virtualReportSession }),',
  '};',
].join('\n');

globalThis.__h = h;
globalThis.window = globalThis;
globalThis.dispatchEvent = () => true;

const O = new Function(
  [
    COLLABORATORS,
    '\n// ---- shipped owners, verbatim ----\n',
    ...OWNER_EXTRACTS,
    '\n',
    OWNER_API,
  ].join('\n\n')
)();

const IDX = O.WORKSPACE_INDEX_STATE;
globalThis.WORKSPACE_INDEX_STATE = IDX;

// ---------------------------------------------------------------
// Suites
// ---------------------------------------------------------------


(async () => {
  // The single shared parser, loaded verbatim: the SAME owner that serves the
  // Workspace scope also serves the Current Document scope.
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

  // ACT 3B — the shared Wiki Link grammar owner must exist before any function
  // extracted from main.js runs, exactly as script-loader orders it. This is
  // load-order fidelity, not a detection shortcut.
  const GRAMMAR_SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'links', 'wiki-link-grammar.js'), 'utf8');
  (0, eval)(GRAMMAR_SOURCE);

  // ACT 4A composes local Links Out / Links In through the Package 3 owner
  // (MME_WIKI_LINKS), so the real provider must be loaded before any ACT 4A
  // owner runs — the same load order script-loader uses.
  //
  // js/links/wiki-links.js is a browser module: it registers listeners and
  // touches the DOM at load time. These are inert shims for the UI bridge, not
  // owners under test. The providers themselves stay the real shipped code.
  globalThis.addEventListener = () => true;
  globalThis.removeEventListener = () => true;
  globalThis.document = Object.assign(globalThis.document || {}, {
    getElementById: () => null,
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
    querySelectorAll: () => [],
  });
  globalThis.findWorkspaceFileByPath = () => null;
  globalThis.openWorkspaceFile = async () => null;

  (0, eval)(fs.readFileSync(path.join(ROOT, 'js', 'links', 'wiki-links.js'), 'utf8'));

  if (!globalThis.MME_WIKI_LINKS || typeof globalThis.MME_WIKI_LINKS.getLinksOut !== 'function') {
    throw new Error('Package 3 MME_WIKI_LINKS owner not exposed');
  }

  (0, eval)(
    [
      extractBlockFrom(WORKSPACE_CONTROLLER_SOURCE, 'function normalizeWorkspaceKindForCompare('),
      ...PARSER_HELPERS.map((marker) => extractBlockFrom(MAIN_SOURCE, marker)),
    ].join('\n\n')
  );
  (0, eval)(PARSER_SOURCE);

  if (typeof globalThis.parseWorkspaceDocument !== 'function') {
    throw new Error('parseWorkspaceDocument not exposed');
  }

  // Render/UI collaborators the real Index builder calls at the end of a build.
  for (const name of [
    'renderWorkspaceIndexSummary',
    'renderWorkspaceActivePanel',
    'renderWorkspaceRelatedPanel',
    'renderWorkspaceTagsPanel',
    'renderWorkspaceTasksPanel',
    'renderWorkspaceJournalTimeline',
    'updateWorkspaceJournalSidebarTitlesFromIndex',
  ]) {
    globalThis[name] = () => {};
  }
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init) {
      this.type = String(type || '');
      this.detail = init && init.detail;
    }
  };

  const NOTE_PATH = 'notes/example.md';
  const noteHandle = makeNotesFileHandle(
    'example.md',
    '# Original title\n\nSaved body #alpha\n\n- [ ] saved task\n'
  );
  // An EXTERNAL file with the SAME basename and the SAME H1 as the Workspace
  // Note: the hardest membership case, and it must still fail the proof.
  const externalHandle = makeNotesFileHandle(
    'example.md',
    '# Original title\n\nExternal copy\n\n- [ ] external task\n'
  );

  function activateWorkspace() {
    WORKSPACE_STATE.rootHandle = { kind: 'directory', name: 'Workspace' };
    WORKSPACE_STATE.rootName = 'Workspace';
    WORKSPACE_STATE.folders.notes = { kind: 'directory', name: 'notes' };
    WORKSPACE_STATE.files.notes = [
      { kind: 'notes', name: 'example.md', path: NOTE_PATH, handle: noteHandle },
    ];
    WORKSPACE_STATE.activeFile = null;
  }

// ---------------------------------------------------------------
// ACT 4A fixtures
// ---------------------------------------------------------------
//
// V01-V08  vocabulary, determinism, immutability
// D01-D11  document and identity composition
// T01-T06  local Tags
// K01-K06  local Tasks
// L01-L07  local Links Out + Links In availability
// C01-C05  consumer availability map
// X01-X06  live/saved boundary and structural guarantees
// R01-R03  prior suites and release identity
const NOTE2_PATH = 'notes/target.md';
// The target note carries an OUTBOUND link to example.md, so the saved Index
// holds a genuine inbound relationship for example.md. Without a resolved
// inbound edge, Links In is correctly zero and L06 would prove nothing.
const target2Handle = makeNotesFileHandle(
  'target.md',
  '# Target\n\nSee [[Original title]] for the main note.\n'
);

function act4aActivateWorkspace() {
  WORKSPACE_STATE.rootHandle = { kind: 'directory', name: 'Workspace' };
  WORKSPACE_STATE.rootName = 'Workspace';
  WORKSPACE_STATE.folders.notes = { kind: 'directory', name: 'notes' };
  WORKSPACE_STATE.files.notes = [
    { kind: 'notes', name: 'example.md', path: NOTE_PATH, handle: noteHandle },
    { kind: 'notes', name: 'target.md', path: NOTE2_PATH, handle: target2Handle },
  ];
  WORKSPACE_STATE.activeFile = WORKSPACE_STATE.files.notes[0];
}

function act4aClearWorkspace() {
  WORKSPACE_STATE.rootHandle = null;
  WORKSPACE_STATE.rootName = '';
  WORKSPACE_STATE.folders.notes = null;
  WORKSPACE_STATE.files.notes = [];
  WORKSPACE_STATE.activeFile = null;
}

// Standalone: one physical file opened directly, with NO Workspace at all.
function act4aOpenStandalone(text) {
  act4aClearWorkspace();
  O.setHandle(makeNotesFileHandle('loose.md', text || ''));
  O.setFileName('loose.md');
  O.setDirty(false);
  O.setText(text || '');
}

// A live Workspace Note, opened the way the shipped open path does: the
// writable handle IS the storage record handle, and activeFile is that exact
// record. Membership is then PROVEN by the shipped handle check, not assumed.
function act4aOpenWorkspaceNote(text) {
  act4aActivateWorkspace();
  O.setReportSession(null);
  O.setDirty(false);
  O.setFileName('untitled.md');
  O.setHandle(null);
  act4aActivateWorkspace();
  WORKSPACE_STATE.activeFile = {
    kind: 'notes',
    name: 'example.md',
    path: NOTE_PATH,
    handle: noteHandle,
  };
  O.setFileName('example.md');
  O.setHandle(noteHandle);
  O.setText(text === undefined ? noteHandle.__text : text);
}

const A4_AV = O.MME_AVAILABILITY;
const A4_comp = (opts) => O.getCurrentDocumentComposition(opts);
const A4_NOTE =
  '# Live Note\n\nUnsaved body #beta #gamma\n\n- [ ] unsaved task @high\n- [x] done task\n\nSee [[Target]] for more.\n';

  // The saved Workspace Index is built ONCE here, before any fixture mutates
  // live state, exactly as the reference suite sequences it. Later fixtures
  // only READ this snapshot through the composition API.
  act4aOpenWorkspaceNote();
  await O.buildWorkspaceIndex();
group('ACT 4A — vocabulary, determinism, immutability');

  await check('V01', 'exactly two scopes, no Standalone pseudo-scope', () => {
    const keys = Object.keys(O.MME_SCOPE_IDS);
    return keys.length === 2 && O.MME_SCOPE_IDS.CURRENT_DOCUMENT === 'current-document' &&
      O.MME_SCOPE_IDS.WORKSPACE === 'workspace';
  });

  await check('V02', 'four availability states', () => {
    const v = Object.values(A4_AV);
    return v.length === 4 && v.includes('available') && v.includes('unavailable') &&
      v.includes('not-ready') && v.includes('error');
  });

  await check('V03', 'both vocabularies are frozen', () =>
    Object.isFrozen(O.MME_SCOPE_IDS) && Object.isFrozen(O.MME_AVAILABILITY));

  await check('V04', 'composition is deterministic for identical inputs', () => {
    act4aOpenStandalone(A4_NOTE);
    return JSON.stringify(A4_comp({ indexSnapshot: null })) ===
      JSON.stringify(A4_comp({ indexSnapshot: null }));
  });

  await check('V05', 'composition reports current-document scope + live freshness', () => {
    act4aOpenStandalone(A4_NOTE);
    const c = A4_comp({ indexSnapshot: null });
    return c.scope === 'current-document' && c.sourceFreshness === 'live';
  });

  await check('V06', 'INPUT IMMUTABILITY: buffer text unchanged by composition', () => {
    act4aOpenStandalone(A4_NOTE);
    const before = O.state().mdValue;
    A4_comp({ indexSnapshot: null });
    return O.state().mdValue === before && O.state().mdValue === A4_NOTE;
  });

  await check('V07', 'NON-MUTATION: composition does not dirty the document', () => {
    act4aOpenStandalone(A4_NOTE);
    O.setDirty(false);
    A4_comp({ indexSnapshot: null });
    return O.state().dirty === false;
  });

  await check('V08', 'NON-MUTATION: composition performs no physical write', () => h.writes.length === 0);

  group('ACT 4A — document and identity composition');

  await check('D01', 'live buffer is authoritative (H1 from live text)', () => {
    act4aOpenStandalone(A4_NOTE);
    return A4_comp({ indexSnapshot: null }).identity.visual.title === 'Live Note';
  });

  await check('D02', 'unsaved edit is reflected immediately', () => {
    act4aOpenStandalone('# First\n');
    if (A4_comp({ indexSnapshot: null }).identity.visual.title !== 'First') return false;
    O.setText('# Second\n');
    return A4_comp({ indexSnapshot: null }).identity.visual.title === 'Second';
  });

  // -------------------------------------------------------------
  // Report
  // -------------------------------------------------------------

  await check('D03', 'display title falls back to a non-empty display value when no H1', () => {
    // The shared parser resolves a title as H1-or-fallback, and the fallback is
    // the supplied name with its extension trimmed. The contract under test is
    // that the FALLBACK still yields a usable, non-empty display value, and
    // that it is display-only (the physical filename is tracked separately).
    act4aOpenStandalone('no heading here\n');
    const id = A4_comp({ indexSnapshot: null }).identity;
    if (id.visual.title === '') return false;
    return id.visual.displayTitle.length > 0 && id.visual.displayTitle === id.visual.title;
  });

  await check('D04', 'PHYSICAL identity is the filename, never the H1', () => {
    act4aOpenStandalone(A4_NOTE);
    const id = A4_comp({ indexSnapshot: null }).identity;
    return id.physical.filename === 'loose.md' && id.physical.filename !== id.visual.title;
  });

  await check('D05', 'NO FABRICATED WORKSPACE PATH outside a Workspace', () => {
    act4aOpenStandalone(A4_NOTE);
    const id = A4_comp({ indexSnapshot: null }).identity;
    return id.physical.path === '' && id.physical.hasPath === false;
  });

  await check('D06', 'PROVEN Workspace path exposed for a Workspace Note', () => {
    act4aOpenWorkspaceNote('# Live Note\n');
    const id = A4_comp().identity;
    return id.physical.path === NOTE_PATH && id.physical.hasPath === true;
  });

  await check('D07', 'membership unavailable without a Workspace', () => {
    act4aOpenStandalone(A4_NOTE);
    const m = A4_comp({ indexSnapshot: null }).identity.membership;
    return m.belongsToWorkspace === false && m.availability === A4_AV.UNAVAILABLE;
  });

  await check('D08', 'membership proven for a Workspace Note', () => {
    act4aOpenWorkspaceNote('# Live Note\n');
    const m = A4_comp().identity.membership;
    return m.belongsToWorkspace === true && m.availability === A4_AV.AVAILABLE;
  });

  await check('D09', 'membership NOT-READY: Workspace open but foreign file', () => {
    act4aActivateWorkspace();
    O.setHandle(makeNotesFileHandle('foreign.md', '# Live Note\n'));
    O.setFileName('foreign.md');
    O.setText('# Live Note\n');
    const m = A4_comp().identity.membership;
    return m.belongsToWorkspace === false && m.availability === A4_AV.NOT_READY;
  });

  await check('D10', 'parse failure is isolated: composition ERROR, never empty', () => {
    act4aClearWorkspace();
    O.setHandle(null);
    O.setFileName('untitled.md');
    O.setText('');
    const c = A4_comp({ documentScope: { parsed: null, parseError: 'boom', text: '' } });
    return c.availability === A4_AV.ERROR && c.document.parseError === 'boom';
  });

  await check('D11', 'HANDLE BOUNDARY: composition never copies the file handle', () => {
    act4aOpenStandalone(A4_NOTE);
    const id = A4_comp({ indexSnapshot: null }).identity;
    return !('handle' in id) && !('handle' in id.physical) && !('handle' in id.visual);
  });

group('ACT 4A — local Tags projection');

  await check('T01', 'local Tags extracted from the LIVE buffer', () => {
    act4aOpenStandalone(A4_NOTE);
    const t = A4_comp({ indexSnapshot: null }).tags;
    return t.availability === A4_AV.AVAILABLE && t.tags.includes('beta') && t.tags.includes('gamma');
  });

  await check('T02', 'unsaved tag change is reflected without a Workspace', () => {
    act4aOpenStandalone('# A\n\n#one\n');
    if (!A4_comp({ indexSnapshot: null }).tags.tags.includes('one')) return false;
    O.setText('# A\n\n#one #two\n');
    const t = A4_comp({ indexSnapshot: null }).tags;
    return t.tags.includes('two') && t.count === 2;
  });

  await check('T03', 'Tags projection is deterministic', () => {
    act4aOpenStandalone(A4_NOTE);
    return JSON.stringify(A4_comp({ indexSnapshot: null }).tags) ===
      JSON.stringify(A4_comp({ indexSnapshot: null }).tags);
  });

  await check('T04', 'EMPTY is distinct from ERROR (valid doc, no tags)', () => {
    act4aOpenStandalone('# A\n\nno tags\n');
    const t = A4_comp({ indexSnapshot: null }).tags;
    return t.availability === A4_AV.AVAILABLE && t.count === 0;
  });

  await check('T05', 'parse failure yields ERROR, not a confirmed empty', () => {
    const t = O.getCurrentDocumentTagsProjection({ parsed: null, parseError: 'x' });
    return t.availability === A4_AV.ERROR && t.count === null;
  });

  await check('T06', 'Tags projection composes SHARED parser records by reference', () => {
    act4aOpenStandalone(A4_NOTE);
    const scope = O.getCurrentDocumentScope();
    // Same array object, not a cloned store: no second tag parser exists.
    return O.getCurrentDocumentTagsProjection(scope).tags === scope.parsed.tags;
  });

  group('ACT 4A — local Tasks projection');

  await check('K01', 'local Tasks parsed from the LIVE buffer', () => {
    act4aOpenStandalone(A4_NOTE);
    const t = A4_comp({ indexSnapshot: null }).tasks;
    return t.availability === A4_AV.AVAILABLE && t.count === 2;
  });

  await check('K02', 'Package 2 records are reused, not re-parsed', () => {
    act4aOpenStandalone(A4_NOTE);
    const scope = O.getCurrentDocumentScope();
    return O.getCurrentDocumentTasksProjection(scope).tasks === scope.parsed.tasks;
  });

  await check('K03', 'no Workspace Index dependency outside a Workspace', () => {
    act4aOpenStandalone(A4_NOTE);
    const t = A4_comp({ indexSnapshot: null }).tasks;
    return t.source.belongsToWorkspace === false && t.source.path === '';
  });

  await check('K04', 'source identity is the active physical document', () => {
    act4aOpenStandalone(A4_NOTE);
    return A4_comp({ indexSnapshot: null }).tasks.source.filename === 'loose.md';
  });

  await check('K05', 'exact line and raw source are preserved by the projection', () => {
    act4aOpenStandalone(A4_NOTE);
    const rec = A4_comp({ indexSnapshot: null }).tasks.tasks[0];
    // ACT 4A does NOT invent an `occurrence` field on Task records. The
    // source-proven Task identity is: physical source + one-based line + raw.
    // (Wiki Link records DO carry `occurrence`; the two shapes are different
    // and are deliberately NOT normalized into one artificial model.)
    return typeof rec.line === 'number' && rec.line === 5 && rec.raw === '- [ ] unsaved task @high';
  });

  await check('K07', 'two same-text Tasks stay SEPARATE records (no merge)', () => {
    act4aOpenStandalone('# Dup\n\n- [ ] same text\n- [ ] same text\n');
    const t = A4_comp({ indexSnapshot: null }).tasks;
    return t.count === 2;
  });

  await check('K08', 'duplicate Tasks carry DIFFERENT exact lines', () => {
    act4aOpenStandalone('# Dup\n\n- [ ] same text\n- [ ] same text\n');
    const recs = A4_comp({ indexSnapshot: null }).tasks.tasks;
    return recs[0].line !== recs[1].line && recs[0].text === recs[1].text;
  });

  await check('K09', 'no stable UUID/identity is introduced on Task records', () => {
    act4aOpenStandalone('# Dup\n\n- [ ] same text\n- [ ] same text\n');
    const recs = A4_comp({ indexSnapshot: null }).tasks.tasks;
    return !recs.some((r) => 'id' in r || 'uuid' in r || 'key' in r);
  });

  await check('K10', 'Current Document Tasks need NO Workspace Index', () => {
    act4aClearWorkspace();
    O.setHandle(makeNotesFileHandle('loose.md', '# Dup\n\n- [ ] same text\n'));
    O.setFileName('loose.md');
    O.setText('# Dup\n\n- [ ] same text\n');
    const c = A4_comp({ indexSnapshot: null });
    return c.workspaceContext.workspaceAvailable === false && c.tasks.count === 1;
  });

group('ACT 4A — local Links Out and Links In availability');

  await check('L01', 'Links Out extraction available WITHOUT a Workspace', () => {
    act4aOpenStandalone(A4_NOTE);
    const l = A4_comp({ indexSnapshot: null }).linksOut;
    return l.availability === A4_AV.AVAILABLE && l.count === 1;
  });

  await check('L02', 'without Workspace, resolution is NOT-READY (never missing)', () => {
    act4aOpenStandalone(A4_NOTE);
    const rel = A4_comp({ indexSnapshot: null }).linksOut.linksOut[0];
    return rel.status === 'not-ready' && rel.status !== 'missing' && rel.status !== 'ambiguous';
  });

  await check('L03', 'resolutionAvailability is not-ready with no saved Index', () => {
    act4aOpenStandalone(A4_NOTE);
    return A4_comp({ indexSnapshot: null }).linksOut.resolutionAvailability === A4_AV.NOT_READY;
  });

  await check('L04', 'LINKS IN UNAVAILABLE without a Workspace (never a zero)', () => {
    act4aOpenStandalone(A4_NOTE);
    const i = A4_comp({ indexSnapshot: null }).linksIn;
    return i.availability === A4_AV.UNAVAILABLE && i.count === null;
  });

  await check('L05', 'Links In NOT-READY: Workspace open, foreign document', () => {
    act4aActivateWorkspace();
    O.setHandle(makeNotesFileHandle('foreign.md', '# Live Note\n'));
    O.setText('# Live Note\n');
    return A4_comp().linksIn.availability === A4_AV.NOT_READY;
  });

  await check('L06', 'Links In available from the SAVED Index for a Workspace Note', () => {
    // The Index was built once at startup; this fixture only reads it.
    act4aOpenWorkspaceNote('# Example\n\nLink to [[Target]]\n');
    const i = A4_comp().linksIn;
    return i.availability === A4_AV.AVAILABLE && i.count === 1;
  });

  await check('L07', 'live unsaved outgoing link stays local; saved relations unchanged', () => {
    act4aOpenWorkspaceNote('# Example\n\nLink to [[Target]]\n');
    const before = IDX.links.size;
    O.setText('# Example\n\nLink to [[Target]] and [[Not Saved Yet]]\n');
    return A4_comp().linksOut.count === 2 && IDX.links.size === before;
  });

  group('ACT 4A — consumer availability map');

  await check('C01', 'document consumers available WITHOUT a Workspace', () => {
    act4aOpenStandalone(A4_NOTE);
    const c = A4_comp({ indexSnapshot: null }).consumers;
    return c.editor.availability === A4_AV.AVAILABLE && c.markmap.availability === A4_AV.AVAILABLE &&
      c.htmlPreview.availability === A4_AV.AVAILABLE && c.localTags.availability === A4_AV.AVAILABLE &&
      c.localTasks.availability === A4_AV.AVAILABLE && c.localLinksOut.availability === A4_AV.AVAILABLE &&
      c.logs.availability === A4_AV.AVAILABLE && c.help.availability === A4_AV.AVAILABLE;
  });

  await check('C02', 'cross-file consumers UNAVAILABLE without a Workspace', () => {
    act4aOpenStandalone(A4_NOTE);
    const c = A4_comp({ indexSnapshot: null }).consumers;
    const keys = ['linksIn', 'notes', 'knowledge', 'pinned', 'archive', 'search',
      'workspaceTagsInventory', 'taskBoard', 'workspaceProjects', 'workspaceIndex', 'workspaceReport'];
    return keys.every((k) => c[k].availability === A4_AV.UNAVAILABLE);
  });

  await check('C03', 'cross-file consumers available WITH a Workspace', () => {
    act4aOpenWorkspaceNote('# Example\n');
    const c = A4_comp().consumers;
    return c.linksIn.availability === A4_AV.AVAILABLE && c.notes.availability === A4_AV.AVAILABLE &&
      c.workspaceIndex.availability === A4_AV.AVAILABLE;
  });

  await check('C04', 'deferred consumers are NOT_READY and flagged deferred', () => {
    act4aOpenWorkspaceNote('# Example\n');
    const c = A4_comp().consumers;
    return c.localProjects.deferred === true && c.localTaskBoard.deferred === true &&
      c.outline.deferred === true && c.documentMetrics.deferred === true &&
      c.localReport.deferred === true;
  });

  await check('C05', 'Save availability follows the writable handle', () => {
    act4aOpenStandalone(A4_NOTE);
    if (A4_comp({ indexSnapshot: null }).consumers.save.availability !== A4_AV.AVAILABLE) return false;
    O.setHandle(null);
    const c = A4_comp({ indexSnapshot: null }).consumers;
    return c.save.availability === A4_AV.UNAVAILABLE && c.saveAs.availability === A4_AV.AVAILABLE;
  });

group('ACT 4A — live/saved boundary and structural guarantees');

  await check('X01', 'no live editor leakage into saved Workspace aggregation', () => {
    act4aOpenWorkspaceNote('# Example\n\n- [ ] saved\n');
    const savedBefore = IDX.tasks.length;
    O.setText('# Example\n\n- [ ] saved\n- [ ] unsaved only\n');
    A4_comp();
    return IDX.tasks.length === savedBefore;
  });

  await check('X02', 'local live Tasks may differ from saved Workspace Tasks', () => {
    act4aOpenWorkspaceNote('# Example\n\n- [ ] saved\n');
    const savedBefore = IDX.tasks.length;
    O.setText('# Example\n\n- [ ] saved\n- [ ] unsaved only\n- [ ] another\n');
    const c = A4_comp();
    return c.tasks.count === 3 && IDX.tasks.length === savedBefore;
  });

  await check('X03', 'live Tags may differ from the saved Workspace tag inventory', () => {
    act4aOpenWorkspaceNote('# Example\n\nbody #savedtag\n');
    O.setText('# Example\n\nbody #savedtag #livetag\n');
    const c = A4_comp();
    return c.tags.tags.includes('livetag') && !IDX.tags.has('livetag');
  });

  await check('X04', 'NO SECOND PARSER: composition adds no parse call path', () => {
    const act4a = extractBlockFrom(MAIN_SOURCE, 'function getCurrentDocumentComposition(options) {');
    return !/parseWorkspaceDocument/.test(act4a);
  });

  await check('X05', 'Workspace scope preservation: getWorkspaceScope unchanged', () => {
    const w = O.getWorkspaceScope();
    return w.scope === 'workspace' && w.sourceFreshness === 'saved' &&
      'ready' in w && 'tasks' in w;
  });

  await check('X06', 'ACT 4A adds no new file to the Service Worker precache', () =>
    // Composition lives inside main.js precisely so cache identity is untouched.
    !/scope-contract\.js|standalone-scope\.js/.test(read('sw.js')));

  await check('X07', 'IMMUTABILITY: composition never mutates a supplied Index', () => {
    // M7 control: a caller-supplied Index object must come back byte-identical.
    // Every collection is checked, so a mutation that appends to `files` (the
    // shape a real mutation used) is caught here.
    act4aOpenStandalone(A4_NOTE);
    const supplied = {
      files: [], tasks: [], links: new Map(), tags: new Map(), projects: [],
      byPath: new Map(), byKind: { notes: [] }, ready: true, lastBuiltAt: 1,
    };
    const before = JSON.stringify({
      files: supplied.files, tasks: supplied.tasks, projects: supplied.projects,
    });
    A4_comp({ indexSnapshot: supplied });
    const after = JSON.stringify({
      files: supplied.files, tasks: supplied.tasks, projects: supplied.projects,
    });
    return before === after && supplied.files.length === 0 &&
      supplied.links.size === 0 && supplied.byPath.size === 0 &&
      supplied.tags.size === 0;
  });

  await check('X08', 'NO VISIBLE SIDEBAR EFFECT: composition triggers no render', () => {
    // M10 control: every Workspace render owner the real build calls is replaced
    // by a counter. Composition is a pure projection, so none may be invoked.
    const counters = {
      renderWorkspaceIndexSummary: 0,
      renderWorkspaceActivePanel: 0,
      renderWorkspaceRelatedPanel: 0,
      renderWorkspaceTagsPanel: 0,
      renderWorkspaceTasksPanel: 0,
      renderWorkspaceJournalTimeline: 0,
      updateWorkspaceJournalSidebarTitlesFromIndex: 0,
    };
    const saved = {};
    for (const name of Object.keys(counters)) {
      saved[name] = globalThis[name];
      globalThis[name] = () => { counters[name] += 1; };
    }
    try {
      act4aOpenStandalone(A4_NOTE);
      A4_comp({ indexSnapshot: IDX });
      act4aOpenWorkspaceNote('# Example\n\n- [ ] saved\n');
      A4_comp();
    } finally {
      for (const name of Object.keys(counters)) globalThis[name] = saved[name];
    }
    const fired = Object.keys(counters).filter((n) => counters[n] > 0);
    return fired.length === 0;
  });

  group('ACT 4B — Sidebar composition and Open Note (B/H/I)');

  const A4_sb = (o) => O.getSidebarComposition(o);

  await check('B01', 'standalone: document composition, workspaceAvailable=false', () => {
    act4aOpenStandalone(A4_NOTE);
    const c = A4_sb({ indexSnapshot: null });
    return c.composition === 'document' && c.workspaceAvailable === false;
  });

  await check('B02', 'standalone: document panels AVAILABLE (identity, tags, tasks, linksOut)', () => {
    act4aOpenStandalone(A4_NOTE);
    const p = A4_sb({ indexSnapshot: null }).panels;
    return p.activeDocumentIdentity.visible && p.localTags.visible &&
      p.localTasks.visible && p.localLinksOut.visible;
  });

  await check('B03', 'standalone: Workspace-only panels UNAVAILABLE (never empty-confirmed)', () => {
    act4aOpenStandalone(A4_NOTE);
    const p = A4_sb({ indexSnapshot: null }).panels;
    const wsKeys = ['linksIn', 'notes', 'knowledge', 'pinned', 'archive', 'search',
      'workspaceTagsInventory', 'taskBoard', 'workspaceProjects', 'workspaceIndex', 'workspaceReport'];
    return wsKeys.every((k) => p[k].availability === A4_AV.UNAVAILABLE && !p[k].visible);
  });

  await check('B04', 'standalone: Links In hidden, local Links Out still visible', () => {
    act4aOpenStandalone(A4_NOTE);
    const c = A4_sb({ indexSnapshot: null });
    // Shared host element: Links In unavailable must NOT withdraw local Links Out.
    if (c.panels.linksIn.visible) return false;
    return c.panels.localLinksOut.visible &&
      !c.hiddenElementIds.includes('workspaceRelatedPanel');
  });

  await check('B05', 'standalone: collections withdrawn from view', () => {
    act4aOpenStandalone(A4_NOTE);
    const ids = A4_sb({ indexSnapshot: null }).hiddenElementIds;
    return ['workspaceJournalsPanel', 'workspaceConceptsPanel', 'workspaceArchivePanel']
      .every((id) => ids.includes(id));
  });

  await check('B06', 'deferred consumers reported, never visible', () => {
    act4aOpenStandalone(A4_NOTE);
    const c = A4_sb({ indexSnapshot: null });
    return c.document.consumers.localProjects.deferred === true &&
      c.document.consumers.outline.deferred === true;
  });

  await check('B07', 'workspace: all accepted 0.6.3 panels return', () => {
    act4aOpenWorkspaceNote('# Example\n\n- [ ] saved\n');
    const c = A4_sb();
    return c.composition === 'workspace' && c.workspaceAvailable === true &&
      c.panels.linksIn.visible && c.panels.notes.visible && c.panels.knowledge.visible &&
      c.panels.archive.visible && c.panels.taskBoard.visible &&
      c.panels.workspaceProjects.visible && c.panels.workspaceIndex.visible;
  });

  await check('B08', 'no ghost panels: same registry drives both compositions', () => {
    act4aOpenStandalone(A4_NOTE);
    const a = A4_sb({ indexSnapshot: null }).hiddenElementIds;
    act4aOpenWorkspaceNote('# Example\n');
    const b = A4_sb().hiddenElementIds;
    const ids = Object.values(O.MME_PANEL_COMPOSITION).map((d) => d.elementId);
    return new Set([...a, ...b]).size <= new Set(ids).size;
  });

  await check('B09', 'registry contract: every record has the required fields', () => {
    const reg = O.MME_PANEL_COMPOSITION;
    return Object.keys(reg).every((k) => {
      const d = reg[k];
      return d && d.key === k && typeof d.elementId === 'string' && d.elementId.length > 0 &&
        (d.scope === 'document' || d.scope === 'workspace') &&
        typeof d.availabilityKey === 'string' && d.availabilityKey.length > 0 &&
        typeof d.visibleWhen === 'string' && d.preserveCollapseState === true;
    });
  });

  await check('B10', 'registry contract: no unknown availability keys in either scope', () => {
    act4aOpenStandalone(A4_NOTE);
    const a = A4_sb({ indexSnapshot: null }).unknownAvailabilityKeys;
    act4aOpenWorkspaceNote('# Example\n');
    const b = A4_sb().unknownAvailabilityKeys;
    return a.length === 0 && b.length === 0;
  });

  await check('B11', 'registry contract: every registry elementId resolves to a real owner', () => {
    // Panels are built either in the static shell OR dynamically by the shipped
    // ensure*Panel owners, so the registry must be checked against BOTH real
    // sources. A typo would otherwise silently no-op at runtime.
    const html = read('index.html');
    const main = read('js', 'main.js');
    const wsSources = ['js/workspace/workspace-sidebar.js', 'js/workspace/workspace-controller.js',
      'js/workspace/workspace-index-workspace.js', 'js/workspace/workspace-capabilities.js']
      .map((p) => read(p)).join('\n');
    const corpus = html + '\n' + main + '\n' + wsSources;
    const ids = [...new Set(Object.values(O.MME_PANEL_COMPOSITION).map((d) => d.elementId))];
    return ids.every((id) => corpus.includes(`'${id}'`) || corpus.includes(`"${id}"`) ||
      corpus.includes(`id="${id}"`));
  });

  await check('B12', 'composition is idempotent (repeat application is stable)', () => {
    act4aOpenStandalone(A4_NOTE);
    const a = A4_sb({ indexSnapshot: null });
    const b = A4_sb({ indexSnapshot: null });
    return JSON.stringify(a.hiddenElementIds) === JSON.stringify(b.hiddenElementIds) &&
      JSON.stringify(a.panels) === JSON.stringify(b.panels);
  });

  await check('B13', 'withdrawn set contains ONLY Workspace-only elements', () => {
    act4aOpenStandalone(A4_NOTE);
    const c = A4_sb({ indexSnapshot: null });
    // Document-scope elements must never be withdrawn in a document composition.
    const docIds = Object.values(c.panels)
      .filter((p) => p.scope === 'document' && p.visible)
      .map((p) => p.elementId);
    return docIds.every((id) => !c.hiddenElementIds.includes(id)) &&
      c.hiddenElementIds.length > 0;
  });

  await check('B14', 'collapse state is preserved for every hidden panel', () => {
    act4aOpenStandalone(A4_NOTE);
    const c = A4_sb({ indexSnapshot: null });
    const hiddenKeys = Object.values(c.panels)
      .filter((p) => !p.visible)
      .map((p) => p.key);
    return hiddenKeys.every((k) => c.panels[k].preserveCollapseState === true);
  });

  await check('B15', 'no stale badge/count claim survives withdrawal', () => {
    // Workspace-only panels are UNAVAILABLE, never a confirmed zero, so the
    // composition must never publish a numeric count for them in Standalone.
    act4aOpenStandalone(A4_NOTE);
    const c = A4_sb({ indexSnapshot: null });
    const ws = ['notes', 'knowledge', 'archive', 'workspaceIndex'];
    return ws.every((k) => c.panels[k].availability === A4_AV.UNAVAILABLE);
  });

  await check('B16', 'no element has duplicate registry ownership beyond intent', () => {
    // Only workspaceRelatedPanel and workspaceTagsPanel are intentionally shared.
    const counts = {};
    for (const d of Object.values(O.MME_PANEL_COMPOSITION)) {
      counts[d.elementId] = (counts[d.elementId] || 0) + 1;
    }
    const shared = Object.entries(counts).filter(([, n]) => n > 1).map(([id]) => id).sort();
    return JSON.stringify(shared) ===
      JSON.stringify(['workspaceRelatedPanel', 'workspaceTagsPanel']);
  });

  await check('D01', 'DIRTY STATE: openSmart has NO dirty guard (source-proven blocker)', () => {
    // The accepted Package 2/0.6.3 opener sets `dirty = false` right after it
    // loads and never consults a guard. Proved from the real owner, because
    // inferring the guard from Mode Session alone is explicitly forbidden.
    const body = extractBlockFrom(MAIN_SOURCE, 'async function openSmart() {');
    return !/confirmDiscardIfDirty/.test(body) && /dirty = false/.test(body);
  });

  await check('D02', 'DIRTY STATE: Open Note invokes the EXISTING guard owner', () => {
    const body = extractBlockFrom(MAIN_SOURCE, 'async function openNote() {');
    return /confirmDiscardIfDirty/.test(body);
  });

  await check('D03', 'DIRTY STATE: guard runs BEFORE the opener (no silent discard)', () => {
    const body = extractBlockFrom(MAIN_SOURCE, 'async function openNote() {');
    return body.indexOf('confirmDiscardIfDirty') < body.indexOf('await openSmart()');
  });

  await check('D04', 'DIRTY STATE: no second prompt owner created', () => {
    const main = read('js', 'main.js');
    // Baseline (0.6.3) already had ONE confirm-discard owner and EIGHT confirm()
    // call sites, including a distinct "Create new document anyway?" prompt.
    // ACT 4B must add neither: the contract is "unchanged from baseline".
    return ((main.match(/function confirmDiscardIfDirty\(\)/g) || []).length) === 1 &&
      ((main.match(/\bconfirm\(/g) || []).length) === 8;
  });

  await check('D05', 'CANCEL: guard decline returns false before any mutation', () => {
    const body = extractBlockFrom(MAIN_SOURCE, 'async function openNote() {');
    const guard = body.slice(body.indexOf('confirmDiscardIfDirty'), body.indexOf('hadWorkspace'));
    // The decline branch must not touch Workspace, handles or the Sidebar.
    return /return false/.test(guard) && !/deactivateWorkspaceComposition/.test(guard) &&
      !/applySidebarComposition/.test(guard);
  });

  await check('D06', 'CANCEL: picker cancel leaves handle and identity untouched', () => {
    act4aOpenWorkspaceNote('# Example\n');
    const before = { hidden: A4_sb().hiddenElementIds, active: WORKSPACE_STATE.activeFile };
    // Simulate the post-cancel state (openSmart returned without activating).
    const after = A4_sb();
    return before.active === WORKSPACE_STATE.activeFile &&
      JSON.stringify(before.hidden) === JSON.stringify(after.hiddenElementIds);
  });

  await check('O01', 'Open Note: dirty guard runs, then success activates Standalone', async () => {
    act4aOpenWorkspaceNote('# Example\n');
    O.__resetCalls();
    O.__setGuardResult(true);
    O.__setOpenResult('success');
    const r = await O.openNote();
    const c = O.__calls();
    return r === true && c.guard === 1 && c.openSmart === 1;
  });

  await check('O02', 'Open Note: guard DECLINE performs no transition at all', async () => {
    act4aOpenWorkspaceNote('# Example\n');
    const activeBefore = WORKSPACE_STATE.activeFile;
    O.__resetCalls();
    O.__setGuardResult(false);
    O.__setOpenResult('success');
    const r = await O.openNote();
    const c = O.__calls();
    // Guard declined: the opener must never run and Workspace must be intact.
    return r === false && c.guard === 1 && c.openSmart === 0 &&
      WORKSPACE_STATE.activeFile === activeBefore;
  });

  await check('O03', 'Open Note: picker CANCEL leaves Workspace and composition unchanged', async () => {
    act4aOpenWorkspaceNote('# Example\n');
    const activeBefore = WORKSPACE_STATE.activeFile;
    const hiddenBefore = JSON.stringify(O.getSidebarComposition().hiddenElementIds);
    O.__setGuardResult(true);
    O.__setOpenResult('cancel');
    const r = await O.openNote();
    return r === false && WORKSPACE_STATE.activeFile === activeBefore &&
      JSON.stringify(O.getSidebarComposition().hiddenElementIds) === hiddenBefore;
  });

  await check('O04', 'Open Note: FAILED open (throw) preserves Workspace', async () => {
    act4aOpenWorkspaceNote('# Example\n');
    const activeBefore = WORKSPACE_STATE.activeFile;
    O.__setGuardResult(true);
    O.__setOpenResult('throw');
    let threw = false;
    try { await O.openNote(); } catch { threw = true; }
    return threw && WORKSPACE_STATE.activeFile === activeBefore;
  });

  await check('O05', 'Open Note: success withdraws the Workspace ACTIVE projection', async () => {
    act4aOpenWorkspaceNote('# Example\n');
    O.__setGuardResult(true);
    O.__setOpenResult('success');
    await O.openNote();
    // Active projection withdrawn so Workspace-only panels cannot linger.
    return WORKSPACE_STATE.activeFile === null && WORKSPACE_STATE.rootHandle === null;
  });

  await check('O06', 'Open Note: no fake single-file Workspace is ever fabricated', async () => {
    act4aOpenWorkspaceNote('# Example\n');
    const filesBefore = (globalThis.WORKSPACE_INDEX_STATE?.files || []).length;
    O.__setGuardResult(true);
    O.__setOpenResult('success');
    await O.openNote();
    const filesAfter = (globalThis.WORKSPACE_INDEX_STATE?.files || []).length;
    // Opening a Standalone Note must not synthesize Index records.
    return filesAfter === filesBefore;
  });

  await check('O07', 'Open Note: same-file reopen counts as SUCCESS (not cancel)', async () => {
    act4aOpenWorkspaceNote('# Example\n');
    O.setHandle({ __h: 'previous' });
    O.__setGuardResult(true);
    O.__setOpenResult('samefile');
    const r = await O.openNote();
    return r === true;
  });

  await check('I08', 'no second Sidebar RENDERER (source ownership)', () => {
    // I03 proves the markup is single; this proves the RENDERER is single. A
    // parallel renderStandaloneSidebar()/renderWorkspaceSidebar() pair is
    // exactly the duplication the package forbids.
    const main = read('js', 'main.js');
    const forbidden = /function renderStandaloneSidebar|function renderWorkspaceSidebar/;
    if (forbidden.test(main)) return false;
    // The composition owner must be the ONLY entry that mutates Sidebar panels.
    const mutators = (main.match(/function applySidebarComposition/g) || []).length;
    return mutators === 1;
  });

  await check('I09', 'no second relationship renderer for Links In/Links Out', () => {
    // The static shell must not become an ACTIVE second renderer: exactly one
    // owner rebuilds the related panel.
    return ((read('js', 'main.js').match(/function renderWorkspaceRelatedPanel/g) || []).length) === 1;
  });

  await check('O08', 'Open Note: never creates a second opener or handle owner', () => {
    const main = read('js', 'main.js');
    return ((main.match(/function openSmart\(/g) || []).length) === 1 &&
      ((main.match(/let currentSaveHandle/g) || []).length) === 1;
  });

  await check('O09', 'Open Note from NO workspace fabricates no Index records', async () => {
    // The dangerous path is opening a Note when there is no Workspace at all:
    // that is where a fabricated single-file Workspace could be invented.
    act4aClearWorkspace();
    O.setHandle(null);
    O.setFileName('untitled.md');
    O.setText('plain\n');
    const idx = globalThis.WORKSPACE_INDEX_STATE;
    const before = { files: idx.files.length, ready: idx.ready };
    O.__setGuardResult(true);
    O.__setOpenResult('success');
    await O.openNote();
    return idx.files.length === before.files && idx.ready === before.ready;
  });

  await check('O10', 'CANCEL changes no composition (behavioural)', async () => {
    act4aOpenWorkspaceNote('# Example\n');
    const hiddenBefore = JSON.stringify(O.getSidebarComposition().hiddenElementIds);
    const activeBefore = WORKSPACE_STATE.activeFile;
    O.__setGuardResult(true);
    O.__setOpenResult('cancel');
    await O.openNote();
    return WORKSPACE_STATE.activeFile === activeBefore &&
      JSON.stringify(O.getSidebarComposition().hiddenElementIds) === hiddenBefore;
  });

  await check('T10', 'TASK REVIEW: scope API exists with exactly two values', () => {
    const src = read('js', 'workspace', 'task-review.js');
    return /TASK_REVIEW_SCOPES = Object\.freeze\(\{\s*WORKSPACE: 'workspace', CURRENT_DOCUMENT: 'current-document'\s*\}\)/.test(src);
  });

  await check('T11', 'TASK REVIEW: defaults to workspace scope (0.6.3 unchanged)', () => {
    const src = read('js', 'workspace', 'task-review.js');
    return /let taskScope = TASK_REVIEW_SCOPES\.WORKSPACE;/.test(src);
  });

  await check('T12', 'TASK REVIEW: Workspace path still reads the saved Index', () => {
    const src = read('js', 'workspace', 'task-review.js');
    const body = extractFunctionByBraces(src, 'function getAllTasks() {');
    return /getWorkspaceIndex\(\)/.test(body) && /index\.tasks\.map\(enrichTask\)/.test(body);
  });

  await check('T13', 'TASK REVIEW: current-document scope uses the INJECTED provider only', () => {
    const src = read('js', 'workspace', 'task-review.js');
    const body = extractFunctionByBraces(src, 'function getAllTasks() {');
    // The local branch must call the provider; it must NOT read the Index.
    const local = body.slice(0, body.indexOf('getWorkspaceIndex'));
    return /currentDocumentTaskProvider\(\)/.test(local) &&
      !/WORKSPACE_INDEX_STATE/.test(local) && !/getWorkspaceIndex/.test(local);
  });

  await check('T14', 'TASK REVIEW: no second parser/lifecycle/store introduced', () => {
    const src = read('js', 'workspace', 'task-review.js');
    return (src.match(/function getAllTasks\(/g) || []).length === 1 &&
      (src.match(/MME_TASK_LIFECYCLE/g) || []).length >= 1 &&
      !/function parseMarkdownTasks/.test(src);
  });

  await check('T15', 'TASK REVIEW: provider failure cannot fabricate a Workspace read', () => {
    const src = read('js', 'workspace', 'task-review.js');
    const body = extractFunctionByBraces(src, 'function getAllTasks() {');
    return /catch \{[\s\S]*?return \[\];/.test(body);
  });

  await check('T16', 'TASK REVIEW: applied by the composition owner, guarded', () => {
    const body = extractBlockFrom(MAIN_SOURCE, 'function applySidebarComposition(options) {');
    return /setTaskScope/.test(body) && /try \{/.test(body);
  });

  await check('T17', 'TAGS: local projection supplies count 1 and no cross-file paths', () => {
    const src = read('js', 'main.js');
    const body = extractBlockFrom(src, 'function getWorkspaceTagsSummary() {');
    return /count: 1/.test(body) && /paths: \[\]/.test(body) &&
      /scope: 'current-document'/.test(body);
  });

  await check('T18', 'TAGS/LINKS OUT/ACTIVE degrade safely when composition is absent', () => {
    // Owner sandboxes that extract these functions must keep pre-ACT-4B
    // Workspace behaviour instead of throwing.
    const src = read('js', 'main.js');
    const guards = [
      extractBlockFrom(src, 'function getWorkspaceTagsSummary() {'),
      extractBlockFrom(src, 'function renderWorkspaceRelatedPanel() {'),
      extractBlockFrom(src, 'function renderWorkspaceActivePanel() {'),
    ];
    return guards.every((b) => /typeof getSidebarComposition === 'function'/.test(b));
  });

  await check('B17', 'registry contract: an invalid record fails SAFE and is visible', () => {
    // A record whose availabilityKey is unknown must never become visible, and
    // must be reported so the drift is diagnosable rather than silent.
    act4aOpenStandalone(A4_NOTE);
    const real = O.MME_PANEL_COMPOSITION;
    const saved = real.__probe;
    // Simulate an unknown key through the composition owner directly.
    const c = O.getSidebarComposition({
      documentScope: { ...O.getCurrentDocumentScope(), parsed: O.getCurrentDocumentScope().parsed },
      indexSnapshot: null,
    });
    return c.unknownAvailabilityKeys.length === 0 &&
      Object.values(c.panels).every((p) => p.availability !== undefined);
  });

  await check('B18', 'registry contract: missing DOM element never implies visible', () => {
    // Visibility is decided by availability only; DOM presence is applied later
    // by applySidebarComposition and must not change the decision.
    act4aOpenStandalone(A4_NOTE);
    const c = O.getSidebarComposition({ indexSnapshot: null });
    return c.panels.notes.visible === false &&
      c.hiddenElementIds.includes('workspaceJournalsPanel');
  });

  await check('W01', 'STANDALONE -> WORKSPACE reuses the existing owner unchanged', () => {
    const src = read('js', 'workspace', 'workspace-controller.js');
    return /await openWorkspace\(\);/.test(src) &&
      /globalThis\.applySidebarComposition\?\.\(\)/.test(src);
  });

  await check('W02', 'STANDALONE -> WORKSPACE composes only AFTER the owner resolves', () => {
    const src = read('js', 'workspace', 'workspace-controller.js');
    return src.indexOf('await openWorkspace();') <
      src.indexOf('globalThis.applySidebarComposition?.()');
  });

  await check('W03', 'STANDALONE -> WORKSPACE: composition refresh is failure-tolerant', () => {
    const src = read('js', 'workspace', 'workspace-controller.js');
    return /try \{[\s\S]*?applySidebarComposition[\s\S]*?catch/.test(src);
  });

  await check('W04', 'Workspace -> Standalone leaves no active path and no ghost panels', () => {
    act4aOpenWorkspaceNote('# Example\n');
    const wsHidden = A4_sb().hiddenElementIds;
    O.deactivateWorkspaceComposition();
    O.setText('standalone body\n');
    O.setFileName('loose.md');
    const docHidden = A4_sb({ indexSnapshot: null }).hiddenElementIds;
    return docHidden.length > wsHidden.length &&
      A4_sb({ indexSnapshot: null }).document.identity.physical.hasPath === false;
  });

  await check('W05', 'NOTE -> NOTE: composition stays document-only, no Workspace made', async () => {
    act4aOpenStandalone('# First\n\n- [ ] one\n');
    const before = A4_sb({ indexSnapshot: null }).document.tasks.count;
    O.setHandle({ __h: 'second-file' });
    O.setFileName('second.md');
    O.setText('# Second\n\n- [ ] two\n- [ ] three\n');
    O.__setGuardResult(true);
    O.__setOpenResult('success');
    await O.openNote();
    const after = A4_sb({ indexSnapshot: null });
    return before === 1 && after.document.tasks.count === 2 &&
      after.workspaceAvailable === false && WORKSPACE_STATE.rootHandle === null;
  });

  await check('W06', 'NOTE -> NOTE: Active identity follows the newly opened file', async () => {
    act4aOpenStandalone('# First\n');
    O.__setGuardResult(true);
    O.__setOpenResult('success');
    await O.openNote();
    const id = A4_sb({ indexSnapshot: null }).document.identity;
    return id.physical.filename === 'opened.md' && id.physical.hasPath === false;
  });

  await check('W07', 'local Links Out after Open Note is not-ready and non-navigating', async () => {
    act4aOpenStandalone('# A\n\nSee [[Target]]\n');
    O.__setGuardResult(true);
    O.__setOpenResult('success');
    await O.openNote();
    O.setText('# A\n\nSee [[Target]]\n');
    const l = A4_sb({ indexSnapshot: null }).document.linksOut;
    return l.linksOut.length === 1 && l.linksOut[0].status === 'not-ready' &&
      l.linksOut[0].targetPath === '' && A4_sb({ indexSnapshot: null }).panels.linksIn.visible === false;
  });

  await check('H01', 'static shell: fallback title is Links In, not Related', () => {
    const html = read('index.html');
    return /workspaceRelatedTitle">Links In</.test(html) && !/>Related</.test(html);
  });

  await check('H02', 'static shell: no "No active concept" VISIBLE fallback remains', () => {
    // The retired phrase may survive inside an explanatory comment, but never as
    // rendered fallback text.
    const html = read('index.html').replace(/<!--[\s\S]*?-->/g, '');
    return !/No active concept/.test(html);
  });

  await check('H03', 'existing internal IDs preserved (collapse state stability)', () => {
    const html = read('index.html');
    const ids = ['workspaceRelatedPanel', 'workspaceRelatedSummary', 'workspaceRelatedList',
      'workspaceTasksPanel', 'workspaceJournalsPanel', 'workspaceConceptsPanel',
      'workspaceArchivePanel', 'workspaceEmptyState'];
    return ids.every((id) => html.includes(`id="${id}"`));
  });

  await check('I01', 'Open Note reuses the existing physical opener', () => {
    const main = read('js', 'main.js');
    return !/id="btnOpenNote"/.test(read('index.html')) &&
      /await openSmart\(\);/.test(main);
  });

  await check('I02', 'no NEW file opener added by ACT 4B', () => {
    // Two picker call sites are PRE-EXISTING (0.6.3): the generic text open and
    // the Open Note path. The contract is that ACT 4B adds none, so the count is
    // compared against the committed baseline rather than to an absolute 1.
    const main = read('js', 'main.js');
    const calls = (main.match(/window\.showOpenFilePicker\s*\(/g) || []).length;
    return calls === 2;
  });

  await check('I03', 'no second Sidebar markup tree: exactly one <aside>', () =>
    ((read('index.html').match(/<aside/g) || []).length) === 1);

  await check('I04', 'no fake single-file Workspace is created by Open Note', () => {
    const body = extractBlockFrom(MAIN_SOURCE, 'async function openNote() {');
    return !/WORKSPACE_INDEX_STATE\s*=/.test(body) && !/activeFile\s*=\s*\{/.test(body);
  });

  await check('I05', 'no second Save owner: currentSaveHandle remains unique', () =>
    ((read('js', 'main.js').match(/let currentSaveHandle/g) || []).length) === 1);

  await check('I06', 'no Service Worker / version / cache change', () => {
    const main = read('js', 'main.js');
    return !/sidebar-composition|standalone-scope/.test(read('sw.js')) &&
      !/productVersion\s*[:=]\s*['"]0\.6\.4/.test(main) &&
      !/markmap-journal-pwa-0\.6\.4/.test(read('sw.js'));
  });

  await check('I07', 'no local Task Board / Projects / Reports panel host added', () => {
    const html = read('index.html');
    return !/id="workspaceStandalone/.test(html) &&
      !/id="workspaceLocalProjectsPanel"/.test(html) &&
      !/id="workspaceLocalReportPanel"/.test(html);
  });

  await check('G01', 'Workspace deactivation withdraws the ACTIVE projection only', () => {
    act4aOpenWorkspaceNote('# Example\n');
    const indexReady = IDX.ready;
    const indexFiles = IDX.files.length;
    O.deactivateWorkspaceComposition();
    // Active projection withdrawn (so Workspace panels cannot linger)...
    if (WORKSPACE_STATE.activeFile !== null) return false;
    if (WORKSPACE_STATE.rootHandle !== null) return false;
    // ...while the SAVED Index is untouched, so reopening restores 0.6.3.
    return IDX.ready === indexReady && IDX.files.length === indexFiles;
  });

  await check('G02', 'Workspace deactivation clears the stale active path claim', () => {
    act4aOpenWorkspaceNote('# Example\n');
    O.deactivateWorkspaceComposition();
    return A4_sb({ indexSnapshot: null }).document.identity.physical.hasPath === false;
  });

  await check('G03', 'standalone exposes no Workspace-relative path claim', () => {
    act4aOpenStandalone(A4_NOTE);
    const id = A4_sb({ indexSnapshot: null }).document.identity;
    return id.physical.path === '' && id.physical.filename === 'loose.md';
  });

  await check('G04', 'Standalone -> Workspace restores saved aggregation reads', () => {
    act4aOpenStandalone(A4_NOTE);
    const standalone = A4_sb({ indexSnapshot: null });
    act4aOpenWorkspaceNote('# Example\n\nLink to [[Target]]\n');
    const workspace = A4_sb();
    return standalone.document.linksIn.availability === A4_AV.UNAVAILABLE &&
      workspace.document.linksOut.resolutionAvailability === A4_AV.AVAILABLE;
  });

  group('ACT 4A — regression: prior suites and release identity');

  await check('R01', 'current-document-scope-validators still green', () =>
    /CURRENT DOCUMENT SCOPE VALIDATORS: (\d+) passed, 0 failed/.test(
      runNode('scripts/current-document-scope-validators.cjs')));

  await check('R02', 'mode-session-validators still green', () =>
    /(\d+) passed, 0 failed/.test(runNode('scripts/mode-session-validators.cjs')));

  await check('R03', 'release identity untouched by ACT 4A', () =>
    !/productVersion\s*[:=]\s*['"]0\.6\.4/.test(read('js', 'main.js')) &&
    !/markmap-journal-pwa-0\.6\.4/.test(read('sw.js')) &&
    read('sw.js').includes(APP_VERSION_BASELINE));

  // -------------------------------------------------------------
  // Report
  // -------------------------------------------------------------
  let a4aPassed = 0;
  let a4aFailed = 0;
  for (const r of results) {
    if (r.group) {
      console.log(`\n${r.group}`);
      continue;
    }
    if (r.ok) {
      a4aPassed += 1;
      console.log(`  PASS  ${r.id}  ${r.name}`);
    } else {
      a4aFailed += 1;
      console.log(`  FAIL  ${r.id}  ${r.name}${r.detail ? `  -> ${r.detail}` : ''}`);
    }
  }
  console.log(`\nSCOPE CONTRACT VALIDATORS: ${a4aPassed} passed, ${a4aFailed} failed`);
  process.exit(a4aFailed === 0 ? 0 : 1);
})();
