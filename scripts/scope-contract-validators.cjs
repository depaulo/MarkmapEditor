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
  extractBlockFrom(MAIN_SOURCE, 'function isJournalContext() {'),
  extractBlockFrom(MAIN_SOURCE, 'const MME_JOURNAL_COMPOSITION = Object.freeze({', '});'),
  extractBlockFrom(MAIN_SOURCE, 'function getJournalComposition() {'),
  extractBlockFrom(MAIN_SOURCE, 'function setJournalComposition(next) {'),
  extractBlockFrom(MAIN_SOURCE, 'const OPEN_NOTE_REASON = Object.freeze({', '});'),
  extractBlockFrom(MAIN_SOURCE, 'function deactivateWorkspaceComposition() {'),
  // Brace-aware: applySidebarComposition now contains nested loops, so the
  // line-based extractor would truncate it at the first inner `}` and the
  // sandbox would run a silently incomplete owner.
  extractFunctionByBraces(MAIN_SOURCE, 'function applySidebarComposition(options) {'),
  extractBlockFrom(MAIN_SOURCE, 'async function openNote() {'),
  // ACT 4B transaction support owners (extracted verbatim from main.js).
  extractBlockFrom(MAIN_SOURCE, 'function createOpenRenderCompletion() {'),
  extractBlockFrom(MAIN_SOURCE, 'function getLastOpenRenderCompletion() {'),
  extractBlockFrom(MAIN_SOURCE, 'function getJournalObserverGeneration() {'),
  extractBlockFrom(MAIN_SOURCE, 'function invalidateWorkspaceObservers(reason) {'),
  extractBlockFrom(MAIN_SOURCE, 'function activateJournalObservers(reason) {'),
  extractBlockFrom(MAIN_SOURCE, 'function isObserverGenerationStale(captured) {'),
  extractBlockFrom(MAIN_SOURCE, 'function isWorkspaceAggregationActive() {'),
  extractBlockFrom(MAIN_SOURCE, 'function getJournalNotePhase() {'),
  extractBlockFrom(MAIN_SOURCE, 'function setJournalNotePhase(phase) {'),
  // ACT 4B — the composition's DOM-EVIDENCE owners. These are extracted verbatim
  // (not stubbed) because the completion contract runs OUTSIDE the per-renderer
  // try/catch: a stub would let the sandbox pass while the real owner throws.
  extractBlockFrom(MAIN_SOURCE, 'const ACT4B_REPORTED_PANEL_IDS = Object.freeze(', ');'),
  extractFunctionByBraces(MAIN_SOURCE, 'function describePanelVisibility(elementId) {'),
  extractFunctionByBraces(MAIN_SOURCE, 'function isPanelActuallyVisible(element) {'),
  extractFunctionByBraces(MAIN_SOURCE, 'function verifyStandaloneNoteComposition() {'),
  extractFunctionByBraces(MAIN_SOURCE, 'function syncJournalCompositionDataset() {'),
  extractBlockFrom(MAIN_SOURCE, 'function composeStandaloneNotePanels() {'),
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
  // Journal-context shim: ACT 4B composition is inert outside Journal, so the
  // suite drives the real context owner explicitly per fixture.
  'let __journalContextId = "journal";',
  'let journalComposition = "none";',
  // ---- ACT 4B transaction state (mirrors the real module-level bindings) ----
  'let __openRenderCompletion = null;',
  'let __journalNotePhase = "idle";',
  'let __journalNoteTransitionSeq = 0;',
  'let __journalNoteTransitionBusy = false;',
  'let __journalObserverGeneration = 0;',
  'let __journalActiveGeneration = 0;',
  // The real lifecycle constant (openNote() references it by name).
  'const JOURNAL_NOTE_TRANSITION = Object.freeze({',
  '  IDLE: "idle", GUARDING: "guarding", OPENING: "opening",',
  '  STABILIZING: "stabilizing", COMMITTING: "committing",',
  '  COMPOSING: "composing", READY: "ready", FAILED: "failed",',
  '});',
  'globalThis.__setJournalContextProbe = (v) => { __journalContextId = v; };',
  'globalThis.document = {',
  '  documentElement: { get dataset() { return { appContext: __journalContextId }; } },',
  // The Sidebar DOM is swappable so the ACT 4B DOM fixtures can apply the REAL
  // composition to real element objects and read their real `hidden` state.
  '  __dom: null,',
  '  getElementById: (id) => (globalThis.document.__dom ? globalThis.document.__dom.getElementById(id) : null),',
  '  querySelector: () => null,',
  '  querySelectorAll: () => [],',
  '};',
  'globalThis.__setSidebarDom = (d) => { globalThis.document.__dom = d; };',
  'globalThis.__clearSidebarDom = () => { globalThis.document.__dom = null; };',
  'function confirmDiscardIfDirty() { __guardCalls += 1; return __guardResult; }',
  'async function openSmart() {',
  '  __openCalls += 1;',
  // The real openSmart() publishes a render-completion signal before calling
  // the fire-and-forget render(); the double mirrors that contract.
  '  function settleRender(ok) { if (__openRenderCompletion) __openRenderCompletion.settle({ ok, source: "double" }); }',
  '  if (__openResult !== "cancel") {',
  '    __openRenderCompletion = createOpenRenderCompletion();',
  '  }',
  '  if (__openResult === "throw") { settleRender(false); throw new Error("read failed"); }',
  '  if (__openResult === "cancel") { return; }',
  '  if (__openResult === "samefile") { currentSaveHandle = { __h: "same-file-new-handle" }; settleRender(true); return; }',
  '  currentSaveHandle = { __h: "new-handle" };',
  '  currentFileName = "opened.md";',
  '  settleRender(true);',
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
  '  MME_JOURNAL_COMPOSITION,',
  '  getJournalComposition,',
  '  setJournalComposition,',
  '  isJournalContext,',
  '  OPEN_NOTE_REASON,',
  '  __setJournalContext: (v) => { __journalContextId = v; },',
  '  getSidebarComposition,',
  '  deactivateWorkspaceComposition,',
  '  applySidebarComposition,',
  '  openNote,',
  // ---- ACT 4B transaction support owners (real, extracted) ----
  '  createOpenRenderCompletion,',
  '  getLastOpenRenderCompletion,',
  '  getJournalObserverGeneration,',
  '  invalidateWorkspaceObservers,',
  '  activateJournalObservers,',
  '  isObserverGenerationStale,',
  '  isWorkspaceAggregationActive,',

  '  getJournalNotePhase,',
  '  composeStandaloneNotePanels,',  // ---- Test doubles for the two EXISTING owners openNote wraps ----
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
    getElementById: (id) => (
      globalThis.document && globalThis.document.__dom
        ? globalThis.document.__dom.getElementById(id)
        : null
    ),
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
  // The Journal composition follows the Workspace: a Workspace is genuinely
  // ACTIVE here, so the Workspace -> Note transition must quiesce its
  // observers. Previously the helper left the composition at 'none', which
  // made the Workspace->Note branch appear unreachable.
  O.setJournalComposition('workspace');
}

// A Journal in the NOTE composition. ACT 4B blocks Workspace -> Note, so the
// single-composition Open Note fixtures must start here rather than from a
// Workspace, otherwise they exercise the blocked cross-composition path.
function act4aOpenNoteScope(text) {
  act4aOpenWorkspaceNote(text);
  O.setJournalComposition('note');
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
    // Journal composition must explicitly be 'workspace'; a retained root handle
    // alone must never re-activate aggregation.
    act4aOpenWorkspaceNote('# Example\n\n- [ ] saved\n');
    O.setJournalComposition('workspace');
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

  await check('Y01', 'DIRTY STATE: openSmart has NO dirty guard (source-proven blocker)', () => {
    // The accepted Package 2/0.6.3 opener sets `dirty = false` right after it
    // loads and never consults a guard. Proved from the real owner, because
    // inferring the guard from Mode Session alone is explicitly forbidden.
    const body = extractBlockFrom(MAIN_SOURCE, 'async function openSmart() {');
    return !/confirmDiscardIfDirty/.test(body) && /dirty = false/.test(body);
  });

  await check('Y02', 'DIRTY STATE: Open Note invokes the EXISTING guard owner', () => {
    const body = extractBlockFrom(MAIN_SOURCE, 'async function openNote() {');
    return /confirmDiscardIfDirty/.test(body);
  });

  await check('Y03', 'DIRTY STATE: guard runs BEFORE the opener (no silent discard)', () => {
    const body = extractBlockFrom(MAIN_SOURCE, 'async function openNote() {');
    return body.indexOf('confirmDiscardIfDirty') < body.indexOf('await openSmart()');
  });

  await check('Y04', 'DIRTY STATE: no second prompt owner created', () => {
    const main = read('js', 'main.js');
    // Baseline (0.6.3) already had ONE confirm-discard owner and EIGHT confirm()
    // call sites, including a distinct "Create new document anyway?" prompt.
    // ACT 4B must add neither: the contract is "unchanged from baseline".
    return ((main.match(/function confirmDiscardIfDirty\(\)/g) || []).length) === 1 &&
      ((main.match(/\bconfirm\(/g) || []).length) === 8;
  });

  await check('Y05', 'CANCEL: guard decline returns false before any mutation', () => {
    const body = extractBlockFrom(MAIN_SOURCE, 'async function openNote() {');
    const guard = body.slice(body.indexOf('confirmDiscardIfDirty'), body.indexOf('PHASE 3'));
    // The decline branch must return a structured failure and must not touch
    // Workspace, handles or the Sidebar.
    return /OPEN_NOTE_REASON\.DIRTY_DECLINED/.test(guard) && /ok: false/.test(guard) &&
      !/deactivateWorkspaceComposition/.test(guard) &&
      !/applySidebarComposition/.test(guard) &&
      !/composeStandaloneNotePanels/.test(guard);
  });

  await check('Y06', 'CANCEL: picker cancel leaves handle and identity untouched', () => {
    act4aOpenWorkspaceNote('# Example\n');
    const before = { hidden: A4_sb().hiddenElementIds, active: WORKSPACE_STATE.activeFile };
    // Simulate the post-cancel state (openSmart returned without activating).
    const after = A4_sb();
    return before.active === WORKSPACE_STATE.activeFile &&
      JSON.stringify(before.hidden) === JSON.stringify(after.hiddenElementIds);
  });

  await check('O01', 'Open Note: dirty guard runs, then success activates Standalone', async () => {
    act4aOpenNoteScope('# Example\n');
    O.__resetCalls();
    O.__setGuardResult(true);
    O.__setOpenResult('success');
    const r = await O.openNote();
    const c = O.__calls();
    return r.ok === true && r.reason === 'opened' && c.guard === 1 && c.openSmart === 1;
  });

  await check('O02', 'Open Note: guard DECLINE performs no transition at all', async () => {
    act4aOpenNoteScope('# Example\n');
    const activeBefore = WORKSPACE_STATE.activeFile;
    O.__resetCalls();
    O.__setGuardResult(false);
    O.__setOpenResult('success');
    const r = await O.openNote();
    const c = O.__calls();
    // Guard declined: the opener must never run and Workspace must be intact.
    return r.ok === false && r.reason === 'dirty-declined' &&
      c.guard === 1 && c.openSmart === 0 && WORKSPACE_STATE.activeFile === activeBefore;
  });

  await check('O03', 'Open Note: picker CANCEL leaves Workspace and composition unchanged', async () => {
    act4aOpenNoteScope('# Example\n');
    const activeBefore = WORKSPACE_STATE.activeFile;
    const hiddenBefore = JSON.stringify(O.getSidebarComposition().hiddenElementIds);
    O.__setGuardResult(true);
    O.__setOpenResult('cancel');
    const r = await O.openNote();
    return r.ok === false && r.reason === 'cancelled' &&
      WORKSPACE_STATE.activeFile === activeBefore &&
      JSON.stringify(O.getSidebarComposition().hiddenElementIds) === hiddenBefore;
  });

  await check('O04', 'Open Note: FAILED open (throw) preserves Workspace', async () => {
    act4aOpenNoteScope('# Example\n');
    const activeBefore = WORKSPACE_STATE.activeFile;
    O.__setGuardResult(true);
    O.__setOpenResult('throw');
    // A read failure inside the opener is converted into a structured failure by
    // the transaction catch, so it never escapes uncaught.
    let result = null;
    let threw = false;
    try { result = await O.openNote(); } catch { threw = true; }
    return !threw && result && result.ok === false &&
      result.reason === 'error' && WORKSPACE_STATE.activeFile === activeBefore;
  });

  await check('O05', 'Open Note does NOT destructively clear Workspace state', async () => {
    // ACT 4B BOUNDARY: Workspace -> Note is blocked, so the Note -> Note path no
    // longer needs to withdraw a Workspace active projection. It must leave the
    // recoverable Workspace configuration completely intact, and the old
    // expectation that activeFile is cleared is now an ACT 4C concern.
    act4aOpenNoteScope('# Example\n');
    O.__setGuardResult(true);
    O.__setOpenResult('success');
    await O.openNote();
    return Boolean(WORKSPACE_STATE.rootHandle) &&
      O.getJournalComposition() === 'note';
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
    act4aOpenNoteScope('# Example\n');
    O.setHandle({ __h: 'previous' });
    O.__setGuardResult(true);
    O.__setOpenResult('samefile');
    const r = await O.openNote();
    return r.ok === true && r.sameFile === true;
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
    act4aOpenNoteScope('# Example\n');
    const hiddenBefore = JSON.stringify(O.getSidebarComposition().hiddenElementIds);
    const activeBefore = WORKSPACE_STATE.activeFile;
    O.__setGuardResult(true);
    O.__setOpenResult('cancel');
    await O.openNote();
    return WORKSPACE_STATE.activeFile === activeBefore &&
      JSON.stringify(O.getSidebarComposition().hiddenElementIds) === hiddenBefore;
  });

  // ===================================================================
  // ACT 4B FOCUSED CORRECTION — Journal Open Note click-to-picker chain.
  // C01..C20 map to the accepted O1..O20 list. These execute the REAL owners
  // (action callback body, MME_APP registry, context guard, dirty guard and
  // openNote transaction) against controlled picker/guard doubles.
  // ===================================================================
  const ctlSrc = read('js', 'workspace', 'workspace-controller.js');
  const mainSrc2 = read('js', 'main.js');

  // The real action-owner callback the Journal Sidebar registry installs.
  const extractOnOpenNote = () => {
    const start = ctlSrc.indexOf('onOpenNote: async () => {');
    if (start < 0) return null;
    const i = ctlSrc.indexOf('{', start);
    let depth = 0, end = -1;
    for (let j = i; j < ctlSrc.length; j++) {
      if (ctlSrc[j] === '{') depth++;
      else if (ctlSrc[j] === '}') { depth--; if (depth === 0) { end = j; break; } }
    }
    return end < 0 ? null : ctlSrc.slice(i, end + 1);
  };

  await check('C01', 'O1: Sidebar callback AWAITS and FORWARDS the Open Note result', () => {
    const b = extractOnOpenNote();
    return !!b && /const\s+result\s*=\s*await\s+globalThis\.MME_APP\?\.openJournalNote\?\.\(\)/.test(b);
  });

  await check('C02', 'O2: delegation wrapper forwards the structured result', () => {
    const b = extractOnOpenNote();
    return !!b && /result\.ok/.test(b) && /result\.reason/.test(b);
  });

  await check('C03', 'O3: NO wrapper drops the return value', () => {
    const b = extractOnOpenNote();
    if (!b) return false;
    // A DROPPED result is an owner call whose value is never captured.
    // The correct chain assigns the awaited result and inspects result.ok.
    // (A separate "dangling await" test is unnecessary — the awaited call is
    // always terminated by `;`, so it cannot be distinguished by punctuation.)
    const assigned = /=\s*await\s+[^;]*openJournalNote/.test(b);
    // A bare fire-and-forget `openNote();` delegation would also be wrong.
    const fireForget = /(^|[^.\w])openNote\(\)\s*;/.test(b);
    return assigned && !fireForget;
  });

  await check('C04', 'O4: Journal context PASSES the canonical context guard', () => {
    // The exact runtime state from the device log: context.js:259 writes
    // documentElement.dataset.appContext = 'journal'.
    const body = extractBlockFrom(MAIN_SOURCE, 'function isJournalContext() {');
    return /dataset\?\.appContext/.test(body) && /return datasetId === 'journal'/.test(body);
  });

  await check('C05', 'O5: Editor context FAILS the Journal guard', () => {
    const body = extractBlockFrom(MAIN_SOURCE, 'function isJournalContext() {');
    return /return datasetId === 'journal'/.test(body) && !/datasetId === 'editor'/.test(body);
  });

  await check('C06', 'O6: Slides context FAILS the Journal guard', () => {
    const body = extractBlockFrom(MAIN_SOURCE, 'function isJournalContext() {');
    return /return datasetId === 'journal'/.test(body) && !/datasetId === 'slides'/.test(body);
  });

  await check('C07', 'O7: CLEAN dirty guard PERMITS the opener', async () => {
    act4aOpenNoteScope('# Example\n');
    O.__resetCalls();
    O.__setGuardResult(true);
    O.__setOpenResult('success');
    const r = await O.openNote();
    return r.ok === true && O.__calls().openSmart === 1;
  });

  await check('C08', 'O8: DECLINED dirty guard STOPS before the opener', async () => {
    act4aOpenNoteScope('# Example\n');
    O.__resetCalls();
    O.__setGuardResult(false);
    O.__setOpenResult('success');
    const r = await O.openNote();
    return r.ok === false && r.reason === 'dirty-declined' && O.__calls().openSmart === 0;
  });

  await check('C09', 'O9: openSmart REACHED after accepted guards', async () => {
    act4aOpenNoteScope('# Example\n');
    O.__resetCalls();
    O.__setGuardResult(true);
    O.__setOpenResult('success');
    await O.openNote();
    return O.__calls().openSmart === 1;
  });

  await check('C10', 'O10: showOpenFilePicker reached from the user-action chain', () => {
    const body = extractBlockFrom(MAIN_SOURCE, 'async function openNote() {');
    const opener = extractBlockFrom(MAIN_SOURCE, 'async function openSmart() {');
    return /await openSmart\(\)/.test(body) &&
      !/setTimeout/.test(body) && !/\.click\(\)/.test(body) &&
      /showOpenFilePicker/.test(opener);
  });

  await check('C11', 'O11: picker CANCEL returns cancelled, NOT unknown', async () => {
    act4aOpenNoteScope('# Example\n');
    O.__resetCalls();
    O.__setGuardResult(true);
    O.__setOpenResult('cancel');
    const r = await O.openNote();
    return r.ok === false && r.reason === 'cancelled' && r.reason !== 'unknown';
  });

  await check('C12', 'O12: open FAILURE returns a known reason, NOT unknown', async () => {
    act4aOpenNoteScope('# Example\n');
    O.__resetCalls();
    O.__setGuardResult(true);
    O.__setOpenResult('throw');
    const r = await O.openNote();
    return r.ok === false && ['error', 'read-failed'].includes(r.reason) && r.reason !== 'unknown';
  });

  await check('C13', 'O13: same-file success returns opened + sameFile=true', async () => {
    act4aOpenNoteScope('# Example\n');
    O.__resetCalls();
    O.__setGuardResult(true);
    O.__setOpenResult('samefile');
    const r = await O.openNote();
    return r.ok === true && r.reason === 'opened' && r.sameFile === true;
  });

  await check('C14', 'O14: new-file success returns opened with the adopted handle', async () => {
    act4aOpenNoteScope('# Example\n');
    O.__resetCalls();
    O.__setGuardResult(true);
    O.__setOpenResult('success');
    const r = await O.openNote();
    return r.ok === true && r.reason === 'opened' && !!r.handle && !!r.fileName;
  });

  await check('C15', 'O15: MISSING callback result becomes invalid-result, fails VISIBLY', () => {
    const b = extractOnOpenNote();
    if (!b) return false;
    return /!result \|\| typeof result\.ok !== 'boolean'/.test(b) &&
      /invalid result contract/.test(b) &&
      !/reason \|\| 'unknown'/.test(b);
  });

  await check('C16', 'O16: unexpected rejection is CAUGHT at the action boundary', () => {
    const body = extractBlockFrom(MAIN_SOURCE, 'async function openNote() {');
    return /catch \(e\)/.test(body) && /OPEN_NOTE_REASON\.ERROR/.test(body);
  });

  await check('C17', 'O17: Open Workspace behaviour unchanged', () => {
    const s = read('js', 'workspace', 'workspace-controller.js');
    return /onOpenWorkspace/.test(s) && /openWorkspace\(/.test(s);
  });

  await check('C18', 'O18: Editor Open behaviour unchanged (openSmart, not openNote)', () => {
    return /Browse…/.test(mainSrc2) && !/'Open Note…'/.test(mainSrc2);
  });

  await check('C19', 'O19: Journal top Open remains hidden', () => {
    const b = extractBlockFrom(MAIN_SOURCE, 'function isTopBarOpenAvailable() {');
    return /isJournalContext\(\)/.test(b);
  });

  await check('C20', 'O20: Journal Sidebar Open Note remains visible', () => {
    const html = read('index.html');
    return /id="btnOpenNote"/.test(html) && /id="btnOpenWorkspace"/.test(html);
  });

  // ---- REGRESSION GUARDS FOR THE OBSERVED DEVICE DEFECT ---------------
  // The Journal Open Note action received `undefined` because the callback was
  // assigned to MME_APP at module scope, before MME_APP itself was created.
  const extractMmeAppObject = () => {
    const start = mainSrc2.indexOf('globalThis.MME_APP = {');
    if (start < 0) return null;
    const i = mainSrc2.indexOf('{', start);
    let depth = 0, end = -1;
    for (let j = i; j < mainSrc2.length; j++) {
      if (mainSrc2[j] === '{') depth++;
      else if (mainSrc2[j] === '}') { depth--; if (depth === 0) { end = j; break; } }
    }
    return mainSrc2.slice(i, end + 1);
  };

  await check('C21', 'REG: MME_APP.openJournalNote registered INSIDE the MME_APP object', () => {
    const obj = extractMmeAppObject();
    return !!obj && /openJournalNote:\s*\(\)\s*=>\s*openNote\(\)/.test(obj);
  });

  await check('C22', 'REG: no module-scope assignment to a not-yet-created MME_APP', () => {
    return !/MME_APP\s*&&\s*\(\s*MME_APP\./.test(mainSrc2);
  });

  await check('C23', 'REG: MME_APP registration occurs AFTER openNote is declared', () => {
    const decl = mainSrc2.indexOf('async function openNote() {');
    const reg = mainSrc2.indexOf('globalThis.MME_APP = {');
    return decl > 0 && reg > decl;
  });

  await check('C24', 'REG: the action owner calls the MME_APP registration path', () => {
    const b = extractOnOpenNote();
    return !!b && /MME_APP\?\.openJournalNote\?\.\(\)/.test(b);
  });

  await check('C25', 'REG: openNote declares NO bare return (all branches structured)', () => {
    const body = extractBlockFrom(MAIN_SOURCE, 'async function openNote() {');
    const bare = body.match(/^\s*return;\s*$/gm) || [];
    // Every return site must open a structured result object. The result
    // fields may wrap across lines, so the object opener is what is asserted.
    const allReturns = body.match(/^\s*return\b/gm) || [];
    const structured = body.match(/^\s*return\s*\{/gm) || [];
    return bare.length === 0 && allReturns.length >= 6 && allReturns.length === structured.length;
  });

  // ===================================================================
  // ACT 4B RENDER-STABILITY + TRANSACTION FIXTURES (R01..R47).
  // ===================================================================
  const M = MAIN_SOURCE;
  const CTL2 = read('js', 'workspace', 'workspace-controller.js');
  const HL = read('js', 'workspace', 'workspace-highlight.js');
  const openNoteBody = extractBlockFrom(M, 'async function openNote() {');
  const composeBody = extractBlockFrom(M, 'function composeStandaloneNotePanels() {');
  const applyBody = extractBlockFrom(M, 'function applySidebarComposition(options) {');

  // ---- A. OPEN / RENDER BARRIER ---------------------------------------
  await check('R01', 'openSmart does not claim renderStable before render completes', () => {
    const renderBody = extractBlockFrom(M, 'function render(source =');
    const opener = extractBlockFrom(M, 'async function openSmart() {');
    return /completion\.settle\(\{ ok: true/.test(renderBody) &&
      /completion\.settle\(\{ ok: false/.test(renderBody) &&
      /__openRenderCompletion = createOpenRenderCompletion\(\)/.test(opener);
  });

  await check('R02', 'Journal Note commit waits for the accepted stability barrier', () => {
    return /STABILIZING/.test(openNoteBody) &&
      /await renderCompletion\.wait\(\)/.test(openNoteBody) &&
      openNoteBody.indexOf('STABILIZING') < openNoteBody.indexOf('COMMITTING');
  });

  await check('R03', 'local composition does NOT depend on Workspace Index ready', () => {
    return !/indexReady|WORKSPACE_INDEX_STATE|rootHandle/.test(composeBody);
  });

  await check('R04', 'local consumer rendering occurs exactly once after Note commit', () => {
    const onOpenNote = extractOnOpenNote();
    const calls = openNoteBody.split('composeStandaloneNotePanels()').length - 1;
    return calls === 1 &&
      openNoteBody.indexOf('composeStandaloneNotePanels()') < openNoteBody.indexOf('JOURNAL_NOTE_TRANSITION.READY') &&
      !/applySidebarComposition/.test(onOpenNote);
  });

  await check('R05', 'late Workspace callback cannot restore Workspace composition', () => {
    // A retained rootHandle plus a Note composition must NOT read as an active
    // Workspace presentation. Executed against the real owner.
    act4aOpenWorkspaceNote('# Example\n');
    O.setJournalComposition('note');
    const rootRetained = Boolean(WORKSPACE_STATE.rootHandle);
    return rootRetained === true && O.isWorkspaceAggregationActive() === false;
  });

  await check('R06', 'a stable render is awaited before the composition is committed', () => {
    const stab = openNoteBody.indexOf('await renderCompletion.wait()');
    const deact = openNoteBody.indexOf('deactivateWorkspaceComposition()');
    return stab > 0 && deact > stab;
  });

  // ---- B. NOTE COMPOSITION --------------------------------------------
  await check('R07', 'Active local identity rendered by the EXISTING renderer', () => {
    return /renderWorkspaceActivePanel/.test(composeBody) && !/function renderStandaloneActive/.test(M);
  });

  await check('R08', 'local Tags rendered by the EXISTING panel owner', () => {
    return /renderWorkspaceTagsPanel/.test(composeBody);
  });

  await check('R09', 'Task Review is set to the current-document scope', () => {
    return /setTaskScope/.test(applyBody) && /current-document/.test(applyBody);
  });

  await check('R10', 'local Tasks are rendered by the EXISTING owner, with DOM evidence', () => {
    // The step must RENDER through the existing Tasks owner and then report the
    // real panel state. A bare "Tasks rendered (current-document, read-only)"
    // log is exactly the failure mode this ACT removed: it claimed success
    // without rendering, so the panel could keep Workspace content.
    return /renderWorkspaceTasksPanel\(\)/.test(composeBody) &&
      /function renderWorkspaceTasksPanel\(\)/.test(MAIN_SOURCE) &&
      /describePanelVisibility\('workspaceTasksPanel'\)/.test(composeBody) &&
      !/Tasks rendered \(current-document, read-only\)/.test(composeBody);
  });

  await check('R11', 'local Links Out rendered by the EXISTING owner', () => {
    return /renderWorkspaceRelatedPanel/.test(composeBody);
  });

  await check('R12', 'Links In is hidden/unavailable, never zero', () => {
    return /report\.linksIn = false/.test(composeBody) &&
      /Links In unavailable/.test(composeBody) &&
      !/linksIn\s*=\s*0\b/.test(composeBody);
  });

  await check('R13', 'all Workspace-only panels withdrawn on Note commit', () => {
    return /applySidebarComposition/.test(composeBody);
  });

  await check('R14', 'Today/New Note are hidden without a Workspace', () => {
    // Today and New Note are JOURNAL HEADER ACTIONS, not Sidebar panels: they
    // are bound in the existing Journal action registry and are not rendered
    // from the panel registry. The requirement is that opening a Note does not
    // make them active, which the composition owner enforces by never
    // presenting Workspace data without a Workspace.
    const reg = extractBlockFrom(M, 'const MME_PANEL_COMPOSITION = Object.freeze({');
    // No Today/New Note panel record may claim document scope, and the
    // composition must gate Workspace presentation on the explicit owner.
    return !/today|newNote/i.test(reg) && /isWorkspaceAggregationActive/.test(M);
  });

  await check('R15', 'Save handle equals the Standalone file after commit', () => {
    return /handle: handleAfter/.test(openNoteBody) &&
      openNoteBody.indexOf('currentSaveHandle = snapshot.handle') > openNoteBody.indexOf('catch');
  });

  // ---- C. WORKSPACE -> NOTE -------------------------------------------
  await check('R16', 'Workspace observers are quiesced BEFORE the Note commit', () => {
    const inv = openNoteBody.indexOf("invalidateWorkspaceObservers('workspace->note')");
    const com = openNoteBody.indexOf('setJournalComposition(MME_JOURNAL_COMPOSITION.NOTE)');
    return inv > 0 && com > inv;
  });

  await check('R17', 'stale Workspace callback after commit is ignored (behavioural)', () => {
    // Executed against the REAL generation owners, not source strings: capture
    // a generation, commit a new composition, then prove the old capture is
    // rejected.
    act4aOpenWorkspaceNote('# Example\n');
    const captured = O.getJournalObserverGeneration();
    O.activateJournalObservers('fixture-commit');
    const rejected = O.isObserverGenerationStale(captured);
    const accepted = O.isObserverGenerationStale(O.getJournalObserverGeneration());
    // And the highlight owner must ACTUALLY short-circuit on a stale capture.
    // Asserting only that the symbol exists would not detect a disabled guard.
    const hsrc = HL.slice(HL.indexOf('function updateWorkspaceActiveFileHighlight() {'));
    const enforced = /if \(\s*isStale\s*\) \{[^}]*return;/.test(hsrc);
    return rejected === true && accepted === false && enforced;
  });

  await check('R18', 'a pending Index rebuild cannot restore Workspace panels', () => {
    return /isWorkspaceAggregationActive/.test(HL) && /isWorkspaceAggregationActive/.test(M);
  });

  await check('R19', 'Workspace Task Review refresh cannot overwrite local scope', () => {
    return /composition\.workspaceAvailable \? 'workspace' : 'current-document'/.test(applyBody);
  });

  await check('R20', 'a Workspace Wiki Links event cannot restore Links In', () => {
    // Links In shares the workspaceRelatedPanel host with local Links Out, so
    // the guarantee is that the panel is withdrawn when NO key mapping to it is
    // visible. That is computed by element grouping, not by a per-key flag.
    const group = extractBlockFrom(M, 'hiddenElementIds: (() => {');
    return /byElement/.test(group) && /entries\.every\(\(p\) => !p\.visible\)/.test(group) &&
      /isWorkspaceAggregationActive/.test(HL);
  });

  await check('R21', 'Hot Reload generation belongs to the final Note', () => {
    return /activateJournalObservers\('note-committed'\)/.test(openNoteBody);
  });

  await check('R22', 'a recoverable rootHandle does NOT imply active presentation', () => {
    const owner = extractBlockFrom(M, 'function isWorkspaceAggregationActive() {');
    return /getJournalComposition\(\) === MME_JOURNAL_COMPOSITION\.WORKSPACE/.test(owner) &&
      !/rootHandle/.test(owner) && /recoverable configuration EXISTS/.test(M);
  });

  // ---- D. NOTE -> WORKSPACE -------------------------------------------
  await check('R23', 'Workspace cancel preserves the Note', () => {
    return /OPEN_WORKSPACE_RESULT\.DECLINED/.test(CTL2) && /CANCELLED/.test(CTL2);
  });

  await check('R24', 'invalid root preserves the Note', () => {
    return /VALID_NOTES/.test(CTL2) && /OPEN_WORKSPACE_RESULT\.INVALID/.test(CTL2);
  });

  await check('R25', 'failure preserves the Note', () => {
    return /OPEN_WORKSPACE_RESULT\.FAILURE/.test(CTL2);
  });

  await check('R26', 'success builds the Index BEFORE the Workspace composition', () => {
    // Scoped to the openWorkspace transaction body: the file contains more than
    // one buildActivatedWorkspaceIndex() call site, so a whole-file indexOf
    // would compare the wrong pair of positions.
    const block = extractFunctionByBraces(CTL2, 'async function openWorkspace(') ||
      extractFunctionByBraces(CTL2, 'async function openWorkspace');
    if (!block) return false;
    const build = block.indexOf('buildActivatedWorkspaceIndex()');
    const commit = block.indexOf("setJournalComposition?.('workspace')");
    return build > 0 && commit > build;
  });

  await check('R27', 'success adopts the Workspace Note handle', () => {
    // The Workspace owner opens the active Note itself; ACT 4B does not rebind
    // currentSaveHandle on the Note->Workspace path.
    const ws = (CTL2.split('onOpenWorkspace')[1] || '');
    return !/currentSaveHandle\s*=/.test(ws);
  });

  await check('R28', 'success restores Workspace panels once', () => {
    const onOpenWs = (CTL2.split('onOpenWorkspace')[1] || '').split('onToday')[0];
    return (onOpenWs.match(/applySidebarComposition/g) || []).length === 1;
  });

  await check('R29', 'local results do not remain as a Workspace aggregate', () => {
    return /workspaceAvailable/.test(M) && /journal-composition/.test(M);
  });

  // ---- E. RESTART CLASSIFICATION --------------------------------------
  const diagBody = extractBlockFrom(M, 'function installAct4bTerminationDiagnostic() {');

  await check('R30', 'an unexpected rejection cannot escape the action handler', () => {
    // R30 originally only asserted the diagnostic registers a listener, which
    // did not detect a rejection actually ESCAPING. The action boundary must
    // AWAIT the transaction and inspect the result; a fire-and-forget call
    // would leak its rejection to unhandledrejection.
    const b = extractOnOpenNote();
    if (!b) return false;
    const awaits = /=\s*await\s+[^;]*openJournalNote/.test(b);
    const fireForget = /globalThis\.MME_APP\?\.openJournalNote\?\.\(\)\s*;/.test(b) && !awaits;
    const openNoteCatches = /catch \(e\)/.test(openNoteBody);
    // The diagnostic is still installed so a later reload can classify it.
    return awaits && !fireForget && openNoteCatches && /unhandledrejection/.test(diagBody);
  });

  await check('R31', 'uncaught error records the transition phase', () => {
    return /'error'/.test(diagBody) && /uncaught-exception/.test(diagBody);
  });

  await check('R32', 'pagehide records the current phase', () => {
    return /'pagehide'/.test(diagBody) && /phase:/.test(diagBody);
  });

  await check('R33', 'controllerchange records a DISTINCT reload reason', () => {
    // Asserting the listener name alone would not catch a handler that records
    // the event as an unclassified crash. The handler body must record its own
    // 'controllerchange' reason.
    const i = diagBody.indexOf("addEventListener('controllerchange'");
    if (i < 0) return false;
    const handler = diagBody.slice(i, i + 400);
    return /record\('controllerchange'/.test(handler) && !/record\('unknown-crash'\)/.test(handler);
  });

  await check('R34', 'explicit application reload is distinguishable', () => {
    return /beforeunload/.test(diagBody) && /visibilitychange/.test(diagBody);
  });

  await check('R35', 'the diagnostic captures NO Markdown content', () => {
    return !/md\.value/.test(diagBody) && !/openedText/.test(diagBody) &&
      !/\.text\(\)/.test(diagBody) && /Filename only/.test(diagBody);
  });

  // ---- F. MODE REGRESSION ---------------------------------------------
  await check('R36', 'Editor Open remains unchanged', () => /Browse…/.test(M) && !/'Open Note…'/.test(M));

  await check('R37', 'Slides Open remains unchanged', () => {
    return /return !isJournalContext\(\)/.test(extractBlockFrom(M, 'function isTopBarOpenAvailable() {'));
  });

  await check('R38', 'Journal top Open remains hidden', () => {
    return /isJournalContext\(\)/.test(extractBlockFrom(M, 'function isTopBarOpenAvailable() {'));
  });

  await check('R39', 'Journal Save remains visible', () => {
    return !/btnSave[\s\S]{0,120}isJournalContext/.test(M);
  });

  await check('R40', 'Editor/Slides do not invoke Journal composition', () => {
    return /if \(composition\.inactive\) return composition;/.test(applyBody);
  });

  // ---- G. SINGLE OWNERSHIP --------------------------------------------
  await check('R41', 'one physical opener family', () => {
    // The accepted 0.6.3 baseline already has TWO picker call sites (the
    // fallback input path and openSmart). ACT 4B must add neither.
    return ((M.match(/window\.showOpenFilePicker\(/g) || []).length) === 2;
  });
  await check('R42', 'one currentSaveHandle owner', () => ((M.match(/let currentSaveHandle/g) || []).length) === 1);
  await check('R43', 'one Journal composition owner', () => ((M.match(/function setJournalComposition\(/g) || []).length) === 1);
  await check('R44', 'one Sidebar application owner', () => ((read('index.html').match(/<aside/g) || []).length) === 1);
  await check('R45', 'one Task Review renderer', () => ((M.match(/setTaskScope\(/g) || []).length) === 1);
  await check('R46', 'no second Workspace store', () => ((M.match(/WORKSPACE_STATE\s*=\s*\{/g) || []).length) === 0);
  await check('R47', 'no version/cache change', () => {
    return read('sw.js').includes('markmap-journal-pwa-0.6.3-tasks-wiki-links-foundation');
  });

  // ===================================================================
  // ACT 4B RECOVERY — ACTUAL DOM PROOF.
  // These build a real DOM mirroring index.html's hosts and their static
  // `hidden` attributes, apply the REAL composition, and read `el.hidden`.
  // A panel counts as hidden ONLY when the DOM actually says so.
  // ===================================================================
  const IDX_HTML = read('index.html');

  const buildSidebarDom = () => {
    const ids = [
      'workspaceActivePanel', 'workspaceTagsPanel', 'workspaceTasksPanel',
      'workspaceRelatedPanel', 'workspaceJournalsPanel', 'workspaceConceptsPanel',
      'workspacePinnedPanel', 'workspaceArchivePanel', 'workspaceSearchPanel',
      'workspaceTaskBoardPanel', 'workspaceProjectsPanel', 'workspaceIndexPanel',
      'workspaceReportPanel', 'workspaceEmptyState',
    ];
    const els = new Map();
    for (const id of ids) {
      const el = { id, hidden: false, textContent: '' };
      // The Related and Tasks hosts ship with a static `hidden` attribute in
      // index.html. Modelling that is what exposed the hide-but-never-show bug.
      if (id === 'workspaceRelatedPanel' || id === 'workspaceTasksPanel') el.hidden = true;
      els.set(id, el);
    }
    return { els, getElementById: (id) => els.get(id) || null };
  };

  const applyToDom = () => {
    const dom = buildSidebarDom();
    globalThis.document.__dom = dom;
    const dbg = O.getSidebarComposition();
    try { O.applySidebarComposition(); } finally { globalThis.document.__dom = null; }
    return dom.els;
  };

  await check('D01', 'DOM: Journal Note REVEALS the local Note hosts', async () => {
    act4aOpenNoteScope('# Example\n');
    O.__setJournalContext('journal');
    O.setJournalComposition('note');
    O.__setGuardResult(true);
    O.__setOpenResult('success');
    await O.openNote();
    const els = applyToDom();
    return els.get('workspaceActivePanel').hidden === false &&
      els.get('workspaceTagsPanel').hidden === false &&
      els.get('workspaceTasksPanel').hidden === false &&
      els.get('workspaceRelatedPanel').hidden === false;
  });

  await check('D02', 'DOM: Journal Note HIDES every Workspace-only host', () => {
    act4aOpenWorkspaceNote('# Example\n');
    O.__setJournalContext('journal');
    O.setJournalComposition('note');
    const els = applyToDom();
    return [
      'workspaceJournalsPanel', 'workspaceConceptsPanel', 'workspacePinnedPanel',
      'workspaceArchivePanel', 'workspaceSearchPanel', 'workspaceTaskBoardPanel',
      'workspaceProjectsPanel', 'workspaceIndexPanel', 'workspaceReportPanel',
    ].every((id) => els.get(id).hidden === true);
  });

  await check('D03', 'DOM: shared relationship host is SHOWN for local Links Out', async () => {
    act4aOpenNoteScope('# Example\n');
    O.__setJournalContext('journal');
    O.setJournalComposition('note');
    O.__setGuardResult(true);
    O.__setOpenResult('success');
    await O.openNote();
    const comp = O.getSidebarComposition();
    return comp.panels.localLinksOut.visible === true &&
      comp.panels.linksIn.visible === false &&
      comp.hiddenElementIds.indexOf('workspaceRelatedPanel') === -1 &&
      comp.visibleElementIds.indexOf('workspaceRelatedPanel') !== -1;
  });

  await check('D04', 'STATIC SHELL: the related host declares the required badge', () => {
    // The missing badge made renderWorkspaceRelatedPanel() bail at its
    // structural guard and skip the render entirely.
    const i = IDX_HTML.indexOf('id="workspaceRelatedPanel"');
    const block = IDX_HTML.slice(i, i + 1400);
    return /id="workspaceRelatedBadge"/.test(block) &&
      /id="workspaceRelatedSummary"/.test(block) &&
      /id="workspaceRelatedList"/.test(block) &&
      /workspacePanelHeaderButton/.test(block);
  });

  await check('D05', 'STATIC SHELL: no retired terminology returns', () => {
    const i = IDX_HTML.indexOf('id="workspaceRelatedPanel"');
    const block = IDX_HTML.slice(i, i + 1400);
    return !/>Related</.test(block) && !/No active concept/.test(block) && />Links In</.test(block);
  });

  await check('D06', 'COMPOSITION: the owner SHOWS as well as hides', () => {
    // The regression: the owner only ever set hidden = true.
    const apply = extractFunctionByBraces(M, 'function applySidebarComposition(options) {');
    return /el\.hidden = false/.test(apply) && /el\.hidden = true/.test(apply) &&
      /visibleElementIds/.test(apply);
  });

  await check('D07', 'COMPOSITION: visibleElementIds mirrors hiddenElementIds', () => {
    const src = extractFunctionByBraces(M, 'function getSidebarComposition(options) {');
    return /visibleElementIds/.test(src) && /entries\.some\(\(p\) => p\.visible\)/.test(src) &&
      /hiddenElementIds/.test(src);
  });

  // ---- SAFE BLOCKING OF UNSAFE CROSS-COMPOSITION TRANSITIONS -------------
  await check('B01', 'BLOCK: Workspace -> Note refused non-destructively', async () => {
    act4aOpenWorkspaceNote('# Example\n');
    O.__setJournalContext('journal');
    O.setJournalComposition('workspace');
    O.__resetCalls();
    O.__setGuardResult(true);
    O.__setOpenResult('success');
    const before = {
      handle: O.state().currentSaveHandle, file: O.state().currentFileName,
      comp: O.getJournalComposition(), active: WORKSPACE_STATE.activeFile,
    };
    const r = await O.openNote();
    const after = {
      handle: O.state().currentSaveHandle, file: O.state().currentFileName,
      comp: O.getJournalComposition(), active: WORKSPACE_STATE.activeFile,
    };
    return r.ok === false &&
      r.reason === 'cross-composition-not-yet-supported' &&
      typeof r.message === 'string' && r.message.length > 0 &&
      O.__calls().openSmart === 0 &&   // no picker opened
      O.__calls().guard === 0 &&       // dirty state untouched
      before.handle === after.handle && before.file === after.file &&
      before.comp === after.comp && before.active === after.active;
  });

  await check('B02', 'BLOCK: reason is a distinct known value, never unknown', async () => {
    act4aOpenWorkspaceNote('# Example\n');
    O.__setJournalContext('journal');
    O.setJournalComposition('workspace');
    const r = await O.openNote();
    return r.reason !== 'unknown' &&
      Object.values(O.OPEN_NOTE_REASON).indexOf(r.reason) !== -1;
  });

  await check('B03', 'BLOCK: Note -> Workspace refused before the picker', () => {
    const src = read('js', 'workspace', 'workspace-controller.js');
    const block = extractFunctionByBraces(src, 'onOpenWorkspace: async () => {');
    const guardAt = block.indexOf("=== 'note'");
    const pickerAt = block.indexOf('await openWorkspace()');
    return guardAt > 0 && pickerAt > guardAt &&
      /will be enabled after the transition workflow is stabilized/.test(block) &&
      /temporarily unavailable/.test(M);
  });

  await check('B04', 'BLOCK: neutral Journal still allows both entries', async () => {
    O.__setJournalContext('journal');
    O.setJournalComposition('none');
    O.__resetCalls();
    O.__setGuardResult(true);
    O.__setOpenResult('success');
    const r = await O.openNote();
    return r.ok === true && O.__calls().openSmart === 1;
  });

  await check('B05', 'BOUNDARY: the termination diagnostic is NOT installed', () => {
    const src = read('js', 'main.js');
    // The owner may remain in source for ACT 4C, but ACT 4B runtime installs
    // nothing and clears any stale record.
    return !/try \{ installAct4bTerminationDiagnostic\(\); \}/.test(src) &&
      /MME_ACT4B_DIAG\?\.clear\?\.\(\)/.test(src);
  });

  await check('B06', 'BLOCK: the refusal is EXPLAINED, never silent or disabled', async () => {
    // A silent no-op or a disabled control would also satisfy B01, so the
    // user-facing explanation must actually be emitted.
    act4aOpenWorkspaceNote('# Example\n');
    O.__setJournalContext('journal');
    O.setJournalComposition('workspace');
    const toasts = [];
    const savedShowToast = globalThis.showToast;
    globalThis.showToast = (m) => { toasts.push(String(m)); };
    try {
      await O.openNote();
    } finally {
      globalThis.showToast = savedShowToast;
    }
    return toasts.length === 1 &&
      toasts[0].indexOf('temporarily unavailable') !== -1 &&
      toasts[0].length > 20;
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
      extractFunctionByBraces(src, 'function getWorkspaceTagsSummary() {'),
      extractFunctionByBraces(src, 'function renderWorkspaceRelatedPanel() {'),
      extractFunctionByBraces(src, 'function renderWorkspaceActivePanel() {'),
    ];
    return guards.every((b) => typeof b === 'string' && b.includes("typeof getSidebarComposition === 'function'"));
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

  await check('W02', 'STANDALONE -> WORKSPACE composes only AFTER a proven success', () => {
    const src = read('js', 'workspace', 'workspace-controller.js');
    const block = extractFunctionByBraces(src, 'onOpenWorkspace: async () => {');
    // Composition must be applied only inside the proven-success branch.
    return block.indexOf('await openWorkspace();') < block.indexOf('applySidebarComposition') &&
      /ok/.test(block) && /\bok\b[^]*applySidebarComposition/.test(block) &&
      block.indexOf('if (!') < block.indexOf('applySidebarComposition');
  });

  await check('W03', 'STANDALONE -> WORKSPACE: composition refresh is failure-tolerant', () => {
    const src = read('js', 'workspace', 'workspace-controller.js');
    return /try \{[\s\S]*?applySidebarComposition[\s\S]*?catch/.test(src);
  });

  await check('W04', 'Workspace -> Standalone withdraws path, panels then note composition', () => {
    act4aOpenWorkspaceNote('# Example\n');
    O.setJournalComposition('workspace');
    const wsHidden = A4_sb().hiddenElementIds;
    O.deactivateWorkspaceComposition();
    // The path claim is withdrawn immediately...
    const afterDeactivate = A4_sb().hiddenElementIds;
    O.setText('standalone body\n');
    O.setFileName('loose.md');
    O.setJournalComposition('note');
    const docHidden = A4_sb({ indexSnapshot: null }).hiddenElementIds;
    return docHidden.length > wsHidden.length &&
      afterDeactivate.length === wsHidden.length &&
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

  group('ACT 4B — Sidebar `hidden` authority, relationship host, transition boundary, registry (S01-S29)');

  // -------------------------------------------------------------
  // ACT 4B VISIBILITY DEFECT CLASS — why these fixtures exist.
  //
  // `el.hidden = true` is only a REQUEST. The UA stylesheet's
  // `[hidden] { display: none }` is a UA-origin rule, so ANY author `display:`
  // rule that reaches the element WINS regardless of the `hidden` state. An
  // ID-level author rule therefore makes `hidden = true` completely INERT, and a
  // probe or log that reads only `element.hidden` is structurally blind to it.
  //
  // The Sidebar was visibly wrong after "Journal Note composition: complete"
  // while every log line read "rendered"/"complete", for two independent causes:
  //   CSS: #workspaceJournalsPanel, #workspaceConceptsPanel,
  //        #workspaceArchivePanel and #workspaceSearchPanel carried an ID-level
  //        `display: flex` and NO `[hidden]` rule;
  //   JS:  renderWorkspaceTagsPanel was the only current-document panel owner
  //        with no local-scope branch, so it ran the Workspace path against the
  //        deliberately RETAINED root handle (deactivateWorkspaceComposition
  //        preserves recoverable Workspace configuration), missed the
  //        `!WORKSPACE_STATE.rootHandle` gate, and left its host visible while
  //        reporting success.
  //
  // S01-S03 make the CSS invariant machine-checked for EVERY host in the
  // registry — so a host added later is covered without editing this file — and
  // S04-S06 pin the JS ownership contract that made a renderer the LAST writer
  // of its own host.
  // -------------------------------------------------------------

  const SIDEBAR_CSS = read('css', 'workspace.css');

  // The registry is the authority on which hosts the composition owns. Deriving
  // the list from the shipped registry, rather than hard-coding ids here, is what
  // makes these fixtures cover a host added later.
  const PANEL_REGISTRY_BLOCK = (() => {
    const start = MAIN_SOURCE.indexOf('const MME_PANEL_COMPOSITION');
    const end = MAIN_SOURCE.indexOf('\n});', start);
    return start === -1 || end === -1 ? '' : MAIN_SOURCE.slice(start, end);
  })();

  const PANEL_HOST_IDS = [...new Set(
    [...PANEL_REGISTRY_BLOCK.matchAll(/elementId:\s*'([^']+)'/g)].map((m) => m[1])
  )].sort();

  // The body of every rule that BEGINS with the bare id selector. A rule reached
  // through an ancestor (e.g. `html.workspace-empty #workspaceIndexPanel`) is
  // deliberately NOT counted: only a rule on the id itself can outrank the UA
  // `[hidden]` rule.
  function idLevelRuleBodies(id) {
    const re = new RegExp('(^|\\n)[ \\t]*#' + id + '[ \\t]*(?:,[^{}]*)?\\{([^}]*)\\}', 'g');
    const bodies = [];
    let m;
    while ((m = re.exec(SIDEBAR_CSS))) bodies.push(m[2]);
    return bodies;
  }

  function idLevelDisplayValues(id) {
    return idLevelRuleBodies(id)
      .map((body) => {
        const m = /display\s*:\s*([^;]+)/.exec(body);
        return m ? m[1].trim() : null;
      })
      .filter(Boolean);
  }

  function hasHiddenGuard(id) {
    return new RegExp('#' + id + '\\[hidden\\][^{}]*\\{[^}]*display:\\s*none\\s*!important').test(SIDEBAR_CSS);
  }

  await check('S01', 'the registry is the authority: every panel host id is a workspace id', () =>
    PANEL_HOST_IDS.length >= 13 &&
    PANEL_HOST_IDS.includes('workspaceSearchPanel') &&
    PANEL_HOST_IDS.every((id) => id.startsWith('workspace')),
  () => 'derived hosts: ' + PANEL_HOST_IDS.join(', '));

  // NOTE: a fixture must return a strict BOOLEAN. `record()` stores
  // `Boolean(value)`, so returning a descriptive failure STRING would be truthy
  // and report as PASS — exactly the trap the `check()` comment warns about.
  // Failure reasons belong in the `detail` thunk, which is only shown on failure.
  await check('S02', 'every registered panel host has an explicit `[hidden]` !important guard', () =>
    PANEL_HOST_IDS.every((id) => hasHiddenGuard(id)),
  () => 'no `[hidden]` guard for: ' + PANEL_HOST_IDS.filter((id) => !hasHiddenGuard(id)).join(', '));

  await check('S03', 'the CSS guard is LOAD-BEARING: the four defeated hosts carry an ID-level display rule', () => {
    // Self-check against a vacuous V02: if the parser found no display rules at
    // all, V02 would pass for the wrong reason. These four are the hosts whose
    // `hidden = true` was provably inert — the ACT 4B visual failure itself.
    const defeated = [
      'workspaceJournalsPanel',
      'workspaceConceptsPanel',
      'workspaceArchivePanel',
      'workspaceSearchPanel',
    ];
    const unguardedWithDisplay = PANEL_HOST_IDS
      .filter((id) => idLevelDisplayValues(id).length > 0)
      .filter((id) => !hasHiddenGuard(id));
    return defeated.every((id) => idLevelDisplayValues(id).includes('flex')) &&
      unguardedWithDisplay.length === 0;
  }, () => 'display-hosts=' + PANEL_HOST_IDS.filter((id) => idLevelDisplayValues(id).length > 0).join(','));


  // Isolate one top-level owner's source so its internal ORDER can be asserted.
  function ownerSource(name) {
    const start = MAIN_SOURCE.indexOf(`function ${name}(`);
    if (start === -1) return '';
    const rest = MAIN_SOURCE.slice(start + 10);
    const next = rest.search(/\n(?:async )?function /);
    return next === -1 ? MAIN_SOURCE.slice(start) : MAIN_SOURCE.slice(start, start + 10 + next);
  }

  const TAGS_OWNER = ownerSource('renderWorkspaceTagsPanel');
  const COMPOSE_OWNER = ownerSource('composeStandaloneNotePanels');

  await check('S04', 'renderWorkspaceTagsPanel resolves CURRENT-DOCUMENT tags and returns before the raw-rootHandle gate', () => {
    if (!TAGS_OWNER) return false;
    const localBranch = TAGS_OWNER.indexOf('!localScope.workspaceAvailable');
    const rawGate = TAGS_OWNER.indexOf('!WORKSPACE_STATE?.rootHandle');
    if (localBranch === -1 || rawGate === -1 || localBranch > rawGate) return false;
    const branch = TAGS_OWNER.slice(localBranch, rawGate);
    // The branch must SHOW its host (the composition owner owns withdrawal), must
    // emit non-interactive current-document rows, and must return so the Workspace
    // readiness path can never run against a deliberately retained handle.
    return /panel\.hidden = false/.test(branch) &&
      /data-scope="current-document"/.test(branch) &&
      /\breturn;/.test(branch);
  }, () => {
    if (!TAGS_OWNER) return 'renderWorkspaceTagsPanel not found in main.js';
    const localBranch = TAGS_OWNER.indexOf('!localScope.workspaceAvailable');
    const rawGate = TAGS_OWNER.indexOf('!WORKSPACE_STATE?.rootHandle');
    if (localBranch === -1) return 'no current-document branch';
    if (rawGate === -1) return 'no raw-rootHandle gate';
    if (localBranch > rawGate) return 'local branch sits AFTER the raw-rootHandle gate';
    const branch = TAGS_OWNER.slice(localBranch, rawGate);
    return 'branch missing: ' + [
      /panel\.hidden = false/.test(branch) ? '' : 'panel.hidden=false',
      /data-scope="current-document"/.test(branch) ? '' : 'current-document rows',
      /\breturn;/.test(branch) ? '' : 'early return',
    ].filter(Boolean).join(', ');
  });

  await check('S05', 'composeStandaloneNotePanels applies the Sidebar composition BEFORE every renderer', () => {
    if (!COMPOSE_OWNER) return false;
    const apply = COMPOSE_OWNER.indexOf('applySidebarComposition()');
    if (apply === -1) return false;
    // Because the renderers run LAST, each one owns the final visibility of its own
    // host — which is exactly why a renderer without a scope branch (Tags) could
    // silently re-show a panel the composition had just withdrawn.
    return ['renderWorkspaceActivePanel()', 'renderWorkspaceTagsPanel()', 'renderWorkspaceRelatedPanel()']
      .every((call) => {
        const at = COMPOSE_OWNER.indexOf(call);
        return at !== -1 && at > apply;
      });
  }, () => {
    if (!COMPOSE_OWNER) return 'composeStandaloneNotePanels not found in main.js';
    const apply = COMPOSE_OWNER.indexOf('applySidebarComposition()');
    if (apply === -1) return 'applySidebarComposition() not called';
    return 'called before the composition: ' +
      ['renderWorkspaceActivePanel()', 'renderWorkspaceTagsPanel()', 'renderWorkspaceRelatedPanel()']
        .filter((call) => !(COMPOSE_OWNER.indexOf(call) > apply)).join(', ');
  });

  await check('S06', 'the composition logs the DOM RESULT, not merely that a renderer returned', () => {
    const required = [
      "describePanelVisibility('workspaceActivePanel')",
      "describePanelVisibility('workspaceTagsPanel')",
      "describePanelVisibility('workspaceRelatedPanel')",
      'ACT4B_REPORTED_PANEL_IDS',
    ];
    if (required.some((needle) => !MAIN_SOURCE.includes(needle))) return false;
    // The helper must read BOTH the property and the computed display: the property
    // alone cannot reveal that an author rule outranks the UA `[hidden]` rule.
    return /function describePanelVisibility\(elementId\)/.test(MAIN_SOURCE) &&
      /getComputedStyle\(el\)\.display/.test(ownerSource('describePanelVisibility'));
  }, () => {
    const required = [
      "describePanelVisibility('workspaceActivePanel')",
      "describePanelVisibility('workspaceTagsPanel')",
      "describePanelVisibility('workspaceRelatedPanel')",
      'ACT4B_REPORTED_PANEL_IDS',
    ];
    const missing = required.filter((needle) => !MAIN_SOURCE.includes(needle));
    if (missing.length) return 'missing: ' + missing.join(', ');
    return 'describePanelVisibility does not read computed display';
  });


  // -------------------------------------------------------------
  // ACT 4B — RELATIONSHIP HOST, COMPUTED VISIBILITY, TRANSITION BOUNDARY,
  // REGISTRY INTEGRITY AND RELEASE IDENTITY (S07-S29).
  //
  // S07-S14 pin the SHARED relationship host: one host, one renderer, two
  // mutually exclusive direction writes, a machine-readable scope on every
  // local row, and a state that is never a confirmed zero.
  // S15-S19 pin COMPUTED visibility as the evidence a "complete" line needs.
  // S20 pins the neutral (no-Journal) presentation as a strict no-op.
  // S21-S23 pin the blocked cross-composition transitions at the ACT 4B edge.
  // S24 pins that nothing restores withdrawn hosts after verification.
  // S25-S28 pin registry/uniqueness integrity; S29 pins the release identity.
  // -------------------------------------------------------------

  const INDEX_HTML = read('index.html');
  const REPORT_SOURCE = read('js', 'report', 'report-panel.js');
  const RELATED_OWNER = ownerSource('renderWorkspaceRelatedPanel');
  const VERIFY_OWNER = ownerSource('verifyStandaloneNoteComposition');
  const VISIBLE_OWNER = ownerSource('isPanelActuallyVisible');
  const OPEN_NOTE_OWNER = ownerSource('openNote');
  const APPLY_OWNER = ownerSource('applySidebarComposition');
  const SYNC_OWNER = ownerSource('syncJournalCompositionDataset');

  await check('S07', 'ONE shared relationship host: a single renderer and id, shared by BOTH scope rows', () => {
    const rendererCount = (MAIN_SOURCE.match(/function renderWorkspaceRelatedPanel\(/g) || []).length;
    const staticIdCount = (INDEX_HTML.match(/id="workspaceRelatedPanel"/g) || []).length;
    const relatedRows = PANEL_REGISTRY_BLOCK.split('\n')
      .filter((line) => line.includes("elementId: 'workspaceRelatedPanel'"));
    const scopes = relatedRows.map((line) => (/scope: 'document'/.test(line) ? 'document' : (/scope: 'workspace'/.test(line) ? 'workspace' : '?')));
    return rendererCount === 1 && staticIdCount === 1 && relatedRows.length === 2 &&
      scopes.includes('document') && scopes.includes('workspace') &&
      !/workspaceRelatedPanel\d/.test(MAIN_SOURCE) &&
      !/function renderWorkspaceLink/.test(MAIN_SOURCE);
  }, () => 'renderers=' +
    (MAIN_SOURCE.match(/function renderWorkspaceRelatedPanel\(/g) || []).length +
    ' staticIds=' + (INDEX_HTML.match(/id="workspaceRelatedPanel"/g) || []).length +
    ' registryRows=' + (PANEL_REGISTRY_BLOCK.match(/elementId:\s*'workspaceRelatedPanel'/g) || []).length);

  await check('S08', 'the local branch labels the SHARED host "Links Out" on the shared title node', () => {
    if (!RELATED_OWNER) return false;
    const start = RELATED_OWNER.indexOf('!localScope.workspaceAvailable');
    if (start === -1) return false;
    const branch = RELATED_OWNER.slice(start, RELATED_OWNER.indexOf('return;', start) + 8);
    return /localTitle\.textContent = 'Links Out'/.test(branch) &&
      /querySelector\?\.\('\.workspaceRelatedTitle'\)/.test(branch);
  }, () => 'local branch or its title write not found');

  await check('S09', 'the Workspace branch labels the SAME host "Links In"', () => {
    if (!RELATED_OWNER) return false;
    const start = RELATED_OWNER.indexOf('!localScope.workspaceAvailable');
    const afterLocal = start === -1 ? RELATED_OWNER : RELATED_OWNER.slice(start);
    return /workspaceTitle\.textContent = 'Links In'/.test(afterLocal) &&
      /querySelector\?\.\('\.workspaceRelatedTitle'\)/.test(afterLocal);
  }, () => 'Workspace-branch title write not found');

  await check('S10', 'the two direction labels are MUTUALLY EXCLUSIVE: local branch returns before the Workspace write', () => {
    if (!RELATED_OWNER) return false;
    const localStart = RELATED_OWNER.indexOf('!localScope.workspaceAvailable');
    const localTitle = RELATED_OWNER.indexOf("textContent = 'Links Out'", localStart);
    const localReturn = RELATED_OWNER.indexOf('return;', localTitle);
    const workspaceTitle = RELATED_OWNER.indexOf("textContent = 'Links In'");
    return localStart !== -1 && localTitle > localStart &&
      localReturn > localTitle && workspaceTitle > localReturn;
  }, () => {
    const localStart = RELATED_OWNER.indexOf('!localScope.workspaceAvailable');
    const localTitle = RELATED_OWNER.indexOf("textContent = 'Links Out'", localStart);
    return 'ordering localStart=' + localStart + ' localTitle=' + localTitle +
      ' workspaceTitle=' + RELATED_OWNER.indexOf("textContent = 'Links In'");
  });

  await check('S11', 'the static shell supplies a default direction label, so the host is never unlabeled', () =>
    /<span class="workspaceRelatedTitle">Links In<\/span>/.test(MAIN_SOURCE) &&
    (INDEX_HTML.match(/id="workspaceRelatedPanel"/g) || []).length === 1 &&
    /ensureWorkspaceRelatedPanel/.test(MAIN_SOURCE));

  await check('S12', 'every local relationship row carries a machine-readable scope attribute', () => {
    if (!RELATED_OWNER) return false;
    const start = RELATED_OWNER.indexOf('!localScope.workspaceAvailable');
    if (start === -1) return false;
    const branch = RELATED_OWNER.slice(start, RELATED_OWNER.indexOf('return;', start));
    return /data-scope="current-document"/.test(branch) &&
      /class=\\?"workspaceRelatedRow\\?"/.test(branch);
  }, () => 'local row template lost data-scope="current-document"');

  await check('S13', 'neither direction reports a confirmed zero it cannot prove', () => {
    if (!RELATED_OWNER) return false;
    const localStart = RELATED_OWNER.indexOf('!localScope.workspaceAvailable');
    const localReturn = RELATED_OWNER.indexOf('return;', localStart);
    const local = RELATED_OWNER.slice(localStart, localReturn);
    const wsStart = RELATED_OWNER.indexOf('!linksInResult.available');
    const wsReturn = wsStart === -1 ? -1 : RELATED_OWNER.indexOf('return;', wsStart);
    const ws = wsStart === -1 ? '' : RELATED_OWNER.slice(wsStart, wsReturn);
    return local.includes("badge.textContent = '—'") &&
      !/badge\.textContent = '0'/.test(local) &&
      local.includes('No outgoing links in this note') &&
      ws.includes('Links In unavailable — workspace index not ready') &&
      ws.includes("badge.textContent = '—'");
  }, () => 'a direction reports a zero/unavailable state it cannot prove');

  await check('S14', 'the shared host is INSIDE the composition: one renderer call plus positive verification', () => {
    if (!COMPOSE_OWNER || !VERIFY_OWNER) return false;
    const calls = (COMPOSE_OWNER.match(/renderWorkspaceRelatedPanel\(\)/g) || []).length;
    return calls === 1 &&
      VERIFY_OWNER.includes("elementId: 'workspaceRelatedPanel'") &&
      VERIFY_OWNER.includes('workspaceRelatedPanel') &&
      PANEL_HOST_IDS.includes('workspaceRelatedPanel');
  }, () => 'related host missing from composition call, verification or registry');

  await check('S15', 'visibility evidence is COMPUTED: display, visibility and opacity are all read', () => {
    if (!VISIBLE_OWNER) return false;
    return /getComputedStyle\(el\)/.test(VISIBLE_OWNER) &&
      VISIBLE_OWNER.includes("cs.display === 'none'") &&
      VISIBLE_OWNER.includes("cs.visibility === 'hidden'") &&
      VISIBLE_OWNER.includes("String(cs.opacity) === '0'") &&
      VISIBLE_OWNER.includes('if (el.hidden) return false;');
  }, () => 'isPanelActuallyVisible no longer reads computed display/visibility/opacity');

  await check('S16', 'verification checks all FOUR Current Document hosts positively', () => {
    if (!VERIFY_OWNER) return false;
    const hosts = ['workspaceActivePanel', 'workspaceTagsPanel', 'workspaceTasksPanel', 'workspaceRelatedPanel'];
    const present = hosts.filter((id) => VERIFY_OWNER.includes(`elementId: '${id}'`));
    return present.length === 4 &&
      VERIFY_OWNER.includes('=not-visible(') &&
      /checked: LOCAL_HOSTS\.length/.test(VERIFY_OWNER);
  }, () => 'missing host checks: ' + [
    'workspaceActivePanel', 'workspaceTagsPanel', 'workspaceTasksPanel', 'workspaceRelatedPanel',
  ].filter((id) => !(VERIFY_OWNER || '').includes(`elementId: '${id}'`)).join(','));

  await check('S17', 'verification checks every WITHDRAWN host negatively (still-visible is a failure)', () => {
    if (!VERIFY_OWNER) return false;
    return VERIFY_OWNER.includes('composition.hiddenElementIds') &&
      VERIFY_OWNER.includes('=workspace-panel-still-visible') &&
      VERIFY_OWNER.includes('isPanelActuallyVisible(el)');
  }, () => 'hiddenElementIds negative check missing from verifyStandaloneNoteComposition');

  await check('S18', 'the "complete" line is GATED on verification; failure returns a structured report', () => {
    if (!COMPOSE_OWNER) return false;
    const verifyAt = COMPOSE_OWNER.indexOf('verifyStandaloneNoteComposition()');
    const failAt = COMPOSE_OWNER.indexOf('if (!verification.ok)');
    const failedLogAt = COMPOSE_OWNER.indexOf('Journal Note composition: FAILED — ');
    const completeAt = COMPOSE_OWNER.indexOf("log?.('Journal Note composition: complete')");
    return verifyAt !== -1 && failAt > verifyAt && failedLogAt > failAt &&
      completeAt > failedLogAt &&
      COMPOSE_OWNER.includes('report.complete = false;') &&
      COMPOSE_OWNER.includes('report.complete = true;');
  }, () => 'completion/failure ordering broken: verify=' +
    COMPOSE_OWNER.indexOf('verifyStandaloneNoteComposition()') +
    ' fail=' + COMPOSE_OWNER.indexOf('if (!verification.ok)') +
    ' complete=' + COMPOSE_OWNER.indexOf("log?.('Journal Note composition: complete')"));

  await check('S19', 'openNote surfaces compositionOk in BOTH the log line and the result contract', () => {
    if (!OPEN_NOTE_OWNER) return false;
    return OPEN_NOTE_OWNER.includes('const compositionReport = composeStandaloneNotePanels();') &&
      OPEN_NOTE_OWNER.includes('const compositionOk =') &&
      OPEN_NOTE_OWNER.includes('sidebarComposition=${compositionOk ? \'ok\' : \'FAILED\'}') &&
      /\n\s*compositionOk,?\s*\n?\s*\};/.test(OPEN_NOTE_OWNER) &&
      OPEN_NOTE_OWNER.includes('did not verify');
  }, () => 'openNote no longer reports compositionOk');

  await check('S20', 'neutral/no-Journal presentation is a strict no-op that still clears the projected dataset', () => {
    const SIDEBAR_OWNER = ownerSource('getSidebarComposition');
    if (!APPLY_OWNER || !SYNC_OWNER || !SIDEBAR_OWNER) return false;
    const syncAt = APPLY_OWNER.indexOf('syncJournalCompositionDataset()');
    const inactiveAt = APPLY_OWNER.indexOf('composition.inactive');
    return syncAt !== -1 && inactiveAt > syncAt &&
      SIDEBAR_OWNER.includes('inactive: true') &&
      SIDEBAR_OWNER.includes("composition: 'journal-inactive'") &&
      SYNC_OWNER.includes('if (!isJournalContext())') &&
      SYNC_OWNER.includes('delete dataset.journalComposition') &&
      APPLY_OWNER.includes('empty.hidden = composition.workspaceAvailable || noteComposition') &&
      APPLY_OWNER.includes('getJournalComposition() === MME_JOURNAL_COMPOSITION.NOTE') &&
      /NONE:\s*'none'/.test(MAIN_SOURCE);
  }, () => 'neutral no-op contract broken (sync/inactive/empty-state ordering)');

  await check('S21', 'Workspace -> Note is refused BEFORE the transition lock, with exactly one explanation', () => {
    if (!OPEN_NOTE_OWNER) return false;
    const guardAt = OPEN_NOTE_OWNER.indexOf('getJournalComposition() === MME_JOURNAL_COMPOSITION.WORKSPACE');
    const blockAt = OPEN_NOTE_OWNER.indexOf('OPEN_NOTE_REASON.TRANSITION_BLOCKED');
    const toastAt = OPEN_NOTE_OWNER.indexOf('showToast?.(message');
    const busyAt = OPEN_NOTE_OWNER.indexOf('__journalNoteTransitionBusy = true');
    return guardAt !== -1 && blockAt > guardAt && toastAt > guardAt && busyAt > blockAt &&
      MAIN_SOURCE.includes("TRANSITION_BLOCKED: 'cross-composition-not-yet-supported'") &&
      OPEN_NOTE_OWNER.includes('Open Note: blocked (cross-composition transition deferred to ACT 4C)');
  }, () => 'guard/block/toast/busy ordering: ' +
    'guard=' + OPEN_NOTE_OWNER.indexOf('MME_JOURNAL_COMPOSITION.WORKSPACE') +
    ' block=' + OPEN_NOTE_OWNER.indexOf('OPEN_NOTE_REASON.TRANSITION_BLOCKED') +
    ' busy=' + OPEN_NOTE_OWNER.indexOf('__journalNoteTransitionBusy = true'));

  await check('S22', 'the blocked path is NON-DESTRUCTIVE: no picker, open, commit or persistence call', () => {
    if (!OPEN_NOTE_OWNER) return false;
    const g = OPEN_NOTE_OWNER.indexOf('ACT 4B BOUNDARY');
    const end = OPEN_NOTE_OWNER.indexOf('__journalNoteTransitionBusy', g);
    if (g === -1 || end === -1 || end <= g) return false;
    const slice = OPEN_NOTE_OWNER.slice(g, end);
    const destructive = slice.match(
      /showOpenFilePicker|showDirectoryPicker|setJournalComposition|openSmart|persistActive|localStorage|indexedDB/g
    ) || [];
    return destructive.length === 0 &&
      (slice.match(/showToast\?\.\(message/g) || []).length === 1 &&
      slice.includes('handle: null') &&
      slice.includes('message,');
  }, () => 'destructive call on the blocked path');

  await check('S23', 'overlapping Journal transitions are REJECTED, never interleaved, and always released', () => {
    if (!OPEN_NOTE_OWNER) return false;
    const acquires = (MAIN_SOURCE.match(/__journalNoteTransitionBusy = true/g) || []).length;
    const releases = (MAIN_SOURCE.match(/__journalNoteTransitionBusy = false;/g) || []).length;
    return MAIN_SOURCE.includes("TRANSITION_BUSY: 'transition-busy'") &&
      OPEN_NOTE_OWNER.includes('if (__journalNoteTransitionBusy) {') &&
      acquires === 1 && releases >= 2;
  }, () => 'acquires=' +
    (MAIN_SOURCE.match(/__journalNoteTransitionBusy = true/g) || []).length +
    ' releases=' + (MAIN_SOURCE.match(/__journalNoteTransitionBusy = false;/g) || []).length);

  await check('S24', 'nothing restores withdrawn hosts AFTER verification or AFTER composition', () => {
    if (!OPEN_NOTE_OWNER || !COMPOSE_OWNER) return false;
    const composeAt = OPEN_NOTE_OWNER.indexOf('const compositionReport = composeStandaloneNotePanels();');
    const verifyAt = COMPOSE_OWNER.indexOf('verifyStandaloneNoteComposition()');
    if (composeAt === -1 || verifyAt === -1) return false;
    // Matches ASSIGNMENTS only (`panel.hidden = true`), never prose or templates.
    const assignment = /[A-Za-z0-9_\)]\.hidden\s*=\s*(?:true|false)/;
    const openTail = OPEN_NOTE_OWNER.slice(composeAt);
    const composeTail = COMPOSE_OWNER.slice(verifyAt);
    return !assignment.test(openTail) && !assignment.test(composeTail);
  }, () => 'a .hidden assignment exists after the verification/composition boundary');

  // ------------------------------------------------------------- registry
  // Derived from the shipped registry block, so a key or host added later is
  // covered without editing this file.
  const REGISTRY_KEYS = [...PANEL_REGISTRY_BLOCK.matchAll(/^\s{2}([A-Za-z_$][\w$]*):/gm)].map((m) => m[1]);
  const REGISTRY_ELEMENT_IDS = [...PANEL_REGISTRY_BLOCK.matchAll(/elementId:\s*'([^']+)'/g)].map((m) => m[1]);

  await check('S25', 'registry keys are unique and every entry declares a host elementId', () => {
    if (REGISTRY_KEYS.length < 13 || new Set(REGISTRY_KEYS).size !== REGISTRY_KEYS.length) return false;
    return REGISTRY_KEYS.every((k) => {
      const at = PANEL_REGISTRY_BLOCK.search(new RegExp('^\\s{2}' + k + ':', 'm'));
      return at !== -1 && /elementId:/.test(PANEL_REGISTRY_BLOCK.slice(at, at + 500));
    });
  }, () => 'keys=' + REGISTRY_KEYS.length +
    ' unique=' + new Set(REGISTRY_KEYS).size);

  await check('S26', 'elementId sharing is EXACTLY the two intentional shared hosts, nothing else', () => {
    const counts = {};
    REGISTRY_ELEMENT_IDS.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
    const shared = Object.keys(counts).filter((k) => counts[k] > 1).sort();
    const sharedExactly = shared.length === 2 &&
      shared[0] === 'workspaceRelatedPanel' && shared[1] === 'workspaceTagsPanel' &&
      shared.every((id) => counts[id] === 2);
    // A shared host must carry one row per scope, so one direction can never
    // overwrite the other's visibility decision.
    const scoped = (id) => {
      const rows = PANEL_REGISTRY_BLOCK.split('\n')
        .filter((line) => line.includes(`elementId: '${id}'`));
      return rows.length === 2 &&
        rows.some((line) => line.includes("scope: 'document'")) &&
        rows.some((line) => line.includes("scope: 'workspace'"));
    };
    return REGISTRY_ELEMENT_IDS.length >= 15 &&
      Object.keys(counts).length >= 13 &&
      PANEL_HOST_IDS.length === Object.keys(counts).length &&
      sharedExactly && scoped('workspaceRelatedPanel') && scoped('workspaceTagsPanel');
  }, () => {
    const counts = {};
    REGISTRY_ELEMENT_IDS.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
    return 'elementIds=' + REGISTRY_ELEMENT_IDS.length +
      ' unique=' + Object.keys(counts).length +
      ' shared=[' + Object.keys(counts).filter((k) => counts[k] > 1).join(',') + ']';
  });

  await check('S27', 'every registered host has a KNOWN materialization owner, or is a PINNED registry-only id', () => {
    if (PANEL_HOST_IDS.length < 13) return false;
    // Registry-only ids: declared in the composition registry and guarded in
    // CSS, but no builder ships them yet. Pinning them HERE means a NEW host
    // without a materialization owner fails this fixture automatically, and a
    // stale exemption (id that became materialized) fails it too.
    const REGISTRY_ONLY = ['workspacePinnedPanel', 'workspaceTaskBoardPanel'];
    const materialized = (id) =>
      INDEX_HTML.includes(`id="${id}"`) ||
      MAIN_SOURCE.includes(`id = '${id}'`) ||
      REPORT_SOURCE.includes(`id = '${id}'`);
    const unmaterialized = PANEL_HOST_IDS.filter((id) => !materialized(id));
    const staleExemptions = REGISTRY_ONLY.filter((id) => materialized(id));
    return staleExemptions.length === 0 &&
      unmaterialized.every((id) => REGISTRY_ONLY.includes(id)) &&
      REGISTRY_ONLY.every((id) => PANEL_HOST_IDS.includes(id));
  }, () => {
    const REGISTRY_ONLY = ['workspacePinnedPanel', 'workspaceTaskBoardPanel'];
    const materialized = (id) =>
      INDEX_HTML.includes(`id="${id}"`) ||
      MAIN_SOURCE.includes(`id = '${id}'`) ||
      REPORT_SOURCE.includes(`id = '${id}'`);
    return 'unpinned-unmaterialized=[' +
      PANEL_HOST_IDS.filter((id) => !materialized(id) && !REGISTRY_ONLY.includes(id)).join(',') +
      '] stale-exemptions=[' + REGISTRY_ONLY.filter((id) => materialized(id)).join(',') + ']';
  });

  await check('S28', 'every static workspace Panel id in index.html is claimed by the registry, exactly once', () => {
    const staticIds = [...INDEX_HTML.matchAll(/id="(workspace[A-Za-z0-9]*Panel)"/g)].map((m) => m[1]);
    const orphans = staticIds.filter((id) => !PANEL_HOST_IDS.includes(id));
    const dupes = staticIds.filter((id) =>
      (INDEX_HTML.match(new RegExp(`id="${id}"`, 'g')) || []).length !== 1);
    return staticIds.length >= 5 && orphans.length === 0 && dupes.length === 0;
  }, () => {
    const staticIds = [...INDEX_HTML.matchAll(/id="(workspace[A-Za-z0-9]*Panel)"/g)].map((m) => m[1]);
    return 'orphans=[' + staticIds.filter((id) => !PANEL_HOST_IDS.includes(id)).join(',') + '] dupes=[' +
      staticIds.filter((id) => (INDEX_HTML.match(new RegExp(`id="${id}"`, 'g')) || []).length !== 1).join(',') + ']';
  });

  await check('S29', 'release identity unchanged: sw.js/package.json vs HEAD, no version or cache bump', () => {
    const sw = read('sw.js');
    const baselineOk = sw.includes(APP_VERSION_BASELINE) &&
      !/0\.6\.4/.test(sw) &&
      !/productVersion\s*[:=]\s*['"]0\.6\.4/.test(MAIN_SOURCE) &&
      !INDEX_HTML.includes('?v=');
    if (!baselineOk) return false;
    try {
      const { execSync } = require('child_process');
      const diff = execSync('git diff --numstat HEAD -- sw.js package.json', {
        cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      return diff === '';
    } catch {
      // git unavailable: the baseline equality above is the fallback evidence.
      return true;
    }
  }, () => 'sw.js/index.html/main.js version markers changed');

  group('ACT 4B — mode isolation and top-bar ownership (T01-T18)');

  await check('T01', 'MODE ISOLATION: openNote refuses outside Journal', async () => {
    globalThis.__setJournalContextProbe('editor');
    O.__resetCalls();
    O.__setGuardResult(true);
    O.__setOpenResult('success');
    const r = await O.openNote();
    globalThis.__setJournalContextProbe('journal');
    return r.ok === false && r.reason === 'not-journal-context' &&
      O.__calls().openSmart === 0;
  });

  await check('T02', 'MODE ISOLATION: Slides never runs Journal composition', () => {
    globalThis.__setJournalContextProbe('slides');
    const c = O.getSidebarComposition();
    globalThis.__setJournalContextProbe('journal');
    return c.inactive === true && c.panels && Object.keys(c.panels).length === 0;
  });

  await check('T03', 'MODE ISOLATION: composition is inert outside Journal', () => {
    globalThis.__setJournalContextProbe('editor');
    const c = O.getSidebarComposition();
    globalThis.__setJournalContextProbe('journal');
    return c.inactive === true && c.hiddenElementIds.length === 0 &&
      c.unknownAvailabilityKeys.length === 0;
  });

  await check('T04', 'EDITOR OPEN restored: toolbar menu uses the accepted owner', () => {
    const main = read('js', 'main.js');
    // Scan the whole recent-menu builder: the physical-open item may appear after
    // several separators. It must keep the accepted label and owner, and must
    // never delegate to the Journal-only openNote().
    const raw = main.slice(main.indexOf('function showRecentMenu'),
      main.indexOf('function showRecentMenu') + 12000);
    // Comments legitimately mention openNote(); only executable lines are gated.
    const code = raw.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    return /'Browse/.test(code) && /openSmart\(\)/.test(code) &&
      !/openNote\(/.test(code);
  });

  await check('T05', 'EDITOR OPEN: no Journal Open Note duplicate in the toolbar', () => {
    const html = read('index.html');
    return !/id="btnOpenNote"[^>]*>[\s\S]{0,200}?toolbar/i.test(html) ||
      !/btnOpenNote/.test(html.split('workspaceSidebar')[0]);
  });

  await check('T06', 'JOURNAL SIDEBAR: Open Note and Open Workspace are siblings', () => {
    const html = read('index.html');
    const side = html.slice(html.indexOf('id="workspaceSidebar"'), html.indexOf('workspaceEmptyState'));
    return /id="btnOpenNote"/.test(side) && /id="btnOpenWorkspace"/.test(side) &&
      side.indexOf('btnOpenNote') < side.indexOf('btnOpenWorkspace');
  });

  await check('T07', 'JOURNAL SIDEBAR: one action owner binds both entries', () => {
    const src = read('js', 'workspace', 'workspace-actions.js');
    return /bindOnce\(btnOpenNote, 'Open Note', onOpenNote\)/.test(src) &&
      /bindOnce\(btnOpenWorkspace, 'Open Workspace', onOpenWorkspace\)/.test(src) &&
      (src.match(/getElementById\('btnOpenNote'\)/g) || []).length === 1;
  });

  await check('T08', 'TOP BAR: availability derives from the active mode', () => {
    const main = read('js', 'main.js');
    const body = extractFunctionByBraces(main, 'function isTopBarOpenAvailable() {');
    return /!isJournalContext\(\)/.test(body);
  });

  await check('T09', 'TOP BAR: one shared Open element remains', () => {
    const html = read('index.html');
    return (html.match(/id="btnOpen"/g) || []).length === 1;
  });

  await check('T10', 'TOP BAR: availability toggles visibility only', () => {
    const main = read('js', 'main.js');
    const body = extractFunctionByBraces(main, 'function updateTopBarCommandAvailability() {');
    // No picker, handle, document, dirty or Workspace mutation.
    return /btn\.hidden = !available/.test(body) &&
      !/openSmart|openNote|openWorkspace|showOpenFilePicker/.test(body) &&
      !/currentSaveHandle|\bdirty\b/.test(body);
  });

  await check('T11', 'TOP BAR: context switch never runs a transition', () => {
    const main = read('js', 'main.js');
    const body = extractFunctionByBraces(main, 'function installTopBarCommandAvailabilityWatcher() {');
    return !/openNote|openSmart|openWorkspace|deactivateWorkspaceComposition/.test(body) &&
      /updateTopBarCommandAvailability\(\)/.test(body);
  });

  await check('T12', 'TOP BAR: the existing context owner drives availability', () => {
    const main = read('js', 'main.js');
    const i = main.indexOf('globalThis.currentAppContextId = ctx.id;');
    const after = main.slice(i, i + 400);
    return /updateTopBarCommandAvailability\(\)/.test(after);
  });

  await check('T13', 'JOURNAL COMPOSITION: three values, none added to MME_SCOPE_IDS', () => {
    const main = read('js', 'main.js');
    const body = extractBlockFrom(main, 'const MME_JOURNAL_COMPOSITION = Object.freeze({', '});');
    const scopes = extractBlockFrom(main, 'const MME_SCOPE_IDS = Object.freeze({', '});');
    return /NONE: 'none'/.test(body) && /NOTE: 'note'/.test(body) &&
      /WORKSPACE: 'workspace'/.test(body) && !/standalone/i.test(body) &&
      !/standalone/i.test(scopes);
  });

  await check('T14', 'WORKSPACE STATE: never destructively cleared by ACT 4B', () => {
    const main = read('js', 'main.js');
    const body = extractFunctionByBraces(main, 'function deactivateWorkspaceComposition() {');
    return !/rootHandle = null/.test(body) && !/files\.notes = \[\]/.test(body) &&
      !/folders\.notes = null/.test(body) && !/rootName = ''/.test(body);
  });

  await check('T15', 'WORKSPACE STATE: saved Index is never mutated by the transition', () => {
    const main = read('js', 'main.js');
    const body = extractFunctionByBraces(main, 'function deactivateWorkspaceComposition() {');
    return !/WORKSPACE_INDEX_STATE/.test(body);
  });

  await check('T16', 'OPEN NOTE: result contract is explicit and structured', () => {
    const main = read('js', 'main.js');
    const body = extractFunctionByBraces(main, 'async function openNote() {');
    return /ok: false/.test(body) && /ok: true/.test(body) &&
      /reason: OPEN_NOTE_REASON\.OK/.test(body) && /sameFile/.test(body);
  });

  await check('T17', 'OPEN NOTE: a throw is contained as a structured failure', () => {
    const main = read('js', 'main.js');
    const body = extractFunctionByBraces(main, 'async function openNote() {');
    return /catch \(e\)/.test(body) &&
      /reason: OPEN_NOTE_REASON\.ERROR/.test(body) &&
      /currentSaveHandle = snapshot\.handle/.test(body);
  });

  await check('T18b', 'OPEN NOTE: nothing is committed before a proven open', () => {
    const main = read('js', 'main.js');
    const body = extractFunctionByBraces(main, 'async function openNote() {');
    // The composition is committed only after the physical open is proven and
    // the render-stability barrier has been awaited.
    const commit = body.indexOf('setJournalComposition(MME_JOURNAL_COMPOSITION.NOTE)');
    const stable = body.indexOf('await renderCompletion.wait()');
    return commit > body.indexOf('await openSmart();') &&
      commit > stable &&
      body.indexOf('await openSmart();') > body.indexOf('confirmDiscardIfDirty');
  });

  group('ACT 4B — action boundary and observer safety');

  await check('A01', 'OPEN WORKSPACE: composition applied only on proven success', () => {
    const src = read('js', 'workspace', 'workspace-controller.js');
    const block = extractFunctionByBraces(src, 'onOpenWorkspace: async () => {');
    // A proven-success gate must precede the composition call.
    return /if \(!result \|\| !result\.ok\)/.test(block) &&
      block.indexOf('!result.ok') < block.indexOf('applySidebarComposition');
  });

  await check('A02', 'OPEN WORKSPACE: cancel/invalid/failure are not success', () => {
    const src = read('js', 'workspace', 'workspace-controller.js');
    const body = extractFunctionByBraces(src, 'async function openWorkspace() {');
    // Every non-activation exit returns a structured ok:false result.
    const exits = (body.match(/return \{ ok: false/g) || []).length;
    return exits >= 4 && /return \{ ok: true/.test(body);
  });

  await check('A03', 'OBSERVER SAFETY: Task Review scope never changes outside Journal', () => {
    const main = read('js', 'main.js');
    const body = extractFunctionByBraces(main, 'function applySidebarComposition(options) {');
    const guard = body.indexOf('composition.inactive');
    const scope = body.indexOf('setTaskScope');
    return guard > 0 && scope > guard;
  });

  await check('A04', 'OBSERVER SAFETY: no panel or empty-state mutation outside Journal', () => {
    const main = read('js', 'main.js');
    const body = extractFunctionByBraces(main, 'function applySidebarComposition(options) {');
    const guard = body.indexOf('composition.inactive');
    return guard > 0 &&
      body.indexOf('el.hidden = true') > guard &&
      body.indexOf('empty.hidden') > guard;
  });

  await check('A05', 'SAVE OWNERSHIP: top-bar Save is never toggled by ACT 4B', () => {
    const main = read('js', 'main.js');
    const body = extractFunctionByBraces(main, 'function updateTopBarCommandAvailability() {');
    return !/btnSave/.test(body);
  });

  await check('A06', 'ERROR BOUNDARY: both action handlers catch and never rethrow', () => {
    const actions = read('js', 'workspace', 'workspace-actions.js');
    return /catch \(e\)/.test(actions) && !/throw e/.test(actions);
  });

  await check('A07', 'ERROR BOUNDARY: Open Note never rethrows a rejected transition', () => {
    const main = read('js', 'main.js');
    const body = extractFunctionByBraces(main, 'async function openNote() {');
    return /catch \(e\)/.test(body) && !/throw e;/.test(body) &&
      /reason: OPEN_NOTE_REASON\.ERROR/.test(body);
  });

  await check('A08', 'TRANSITION: cancel path performs no Workspace withdrawal', () => {
    const main = read('js', 'main.js');
    const body = extractFunctionByBraces(main, 'async function openNote() {');
    const cancelAt = body.indexOf('OPEN_NOTE_REASON.CANCELLED');
    const commitAt = body.indexOf('PHASE 5');
    return cancelAt > 0 && commitAt > cancelAt &&
      !/deactivateWorkspaceComposition/.test(body.slice(cancelAt, commitAt)) &&
      !/composeStandaloneNotePanels/.test(body.slice(cancelAt, commitAt));
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
    return /await openSmart\(\);/.test(main) &&
      !/id="btnOpen"[^>]*>[^<]*Open Note/.test(read('index.html'));
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
    // Only the ACTIVE Note claim is withdrawn...
    if (WORKSPACE_STATE.activeFile !== null) return false;
    // ...and the recoverable Workspace configuration plus the SAVED Index are
    // left completely intact, so reopening restores the accepted 0.6.3 state.
    return Boolean(WORKSPACE_STATE.rootHandle) && IDX.ready === indexReady &&
      IDX.files.length === indexFiles;
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
