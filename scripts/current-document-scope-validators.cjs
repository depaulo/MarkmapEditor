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
].join('\n');

const OWNER_API = [
  'return {',
  '  buildWorkspaceIndex,',
  '  WORKSPACE_INDEX_STATE,',
  '  getCurrentDocumentScope,',
  '  getWorkspaceScope,',
  '  logDocumentScopes,',
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
  (0, eval)(fs.readFileSync(path.join(ROOT, 'js', 'links', 'wiki-link-grammar.js'), 'utf8'));

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

  function resetLive() {
    h.logs.length = 0;
    h.rebuilds.length = 0;
    h.indexBuilds = 0;
    O.setReportSession(null);
    O.setDirty(false);
    O.setFileName('untitled.md');
    O.setHandle(null);
  }

  // Open the Workspace Note the way the shipped open path does: the writable
  // handle IS the storage record handle, and activeFile is the exact record.
  function openWorkspaceNote() {
    activateWorkspace();
    resetLive();
    WORKSPACE_STATE.activeFile = {
      kind: 'notes',
      name: 'example.md',
      path: NOTE_PATH,
      handle: noteHandle,
    };
    O.setFileName('example.md');
    O.setHandle(noteHandle);
    O.setText(noteHandle.__text);
  }

  openWorkspaceNote();
  await O.buildWorkspaceIndex();

  group('Current Document parsing (C01-C10)');

  const LIVE_TEXT = [
    '# Live title',
    '',
    'Body with a tag #beta and a link to [[Other Note]].',
    '',
    '- [ ] live task one',
    '- [x] live task two',
    '',
    'Project: Live Project',
    'Order: 26Q1',
    '',
  ].join('\n');

  resetLive();
  O.setText(LIVE_TEXT);
  const live = O.getCurrentDocumentScope();

  await check('C01', 'parses the live H1', () => live.parsed?.title === 'Live title',
    () => live.parsed?.title);
  await check('C02', 'parses the live Tasks', () => live.parsed?.tasks.length === 2,
    () => JSON.stringify(live.parsed?.tasks?.map((t) => t.text)));
  await check('C03', 'parses the live tags', () => (live.parsed?.tags || []).includes('beta'),
    () => JSON.stringify(live.parsed?.tags));
  await check('C04', 'parses the outgoing Wiki Links',
    () => (live.parsed?.conceptLinks || []).includes('Other Note'),
    () => JSON.stringify(live.parsed?.conceptLinks));
  await check('C05', 'parses current Projects using the current syntax',
    () => live.parsed?.projects.length === 1 &&
      live.parsed.projects[0].name === 'Live Project' &&
      live.parsed.projects[0].expectedOrder?.canonical === '2026-Q1',
    () => JSON.stringify(live.parsed?.projects?.map((p) => p.name)));
  await check('C06', 'preserves Unicode', () => {
    O.setText('# Título — Ünicode ✅\n\nCafé naïve 日本語\n');
    const u = O.getCurrentDocumentScope();
    return u.parsed?.title === 'Título — Ünicode ✅' && u.text.includes('日本語');
  }, () => 'unicode title + body');
  await check('C07', 'an H1 inside a fenced code block never becomes the title', () => {
    O.setText('# Real title\n\n```\n# Not a title\n```\n');
    return O.getCurrentDocumentScope().parsed?.title === 'Real title';
  }, () => 'fence excluded');
  await check('C08', 'no physical handle still yields a parsed live record', () => {
    resetLive();
    O.setText('# Brand new\n\n- [ ] fresh task\n');
    const s = O.getCurrentDocumentScope();
    return s.hasWritableHandle === false && s.handle === null &&
      s.parsed?.title === 'Brand new' && s.parsed?.tasks.length === 1;
  }, () => 'unsaved document parses');
  await check('C09', 'dirty state is exposed correctly', () => {
    resetLive();
    O.setText('# d\n');
    O.setDirty(false);
    const clean = O.getCurrentDocumentScope().dirty;
    O.setDirty(true);
    const dirtyNow = O.getCurrentDocumentScope().dirty;
    return clean === false && dirtyNow === true;
  }, () => 'dirty false then true');
  await check('C10', 'writable-handle availability is exposed correctly', () => {
    resetLive();
    O.setText('# h\n');
    O.setHandle(externalHandle);
    const withHandle = O.getCurrentDocumentScope();
    O.setHandle(null);
    const withoutHandle = O.getCurrentDocumentScope();
    return withHandle.hasWritableHandle === true && withHandle.handle === externalHandle &&
      withoutHandle.hasWritableHandle === false && withoutHandle.handle === null;
  }, () => 'handle presence');

  group('Scope separation: live versus saved (S11-S20)');

  // The canonical live/saved case: a saved Workspace Note is edited in the
  // editor but NOT saved.
  openWorkspaceNote();
  await O.buildWorkspaceIndex();

  O.setText('# Edited title\n\nEdited body #alpha\n\n- [ ] edited task\n');
  O.setDirty(true);

  const scopeLive = O.getCurrentDocumentScope();
  const scopeSaved = O.getWorkspaceScope();
  const savedRecordDuringEdit = IDX.byPath.get(NOTE_PATH);

  await check('S11', 'Current Document is labelled as the live source',
    () => scopeLive.scope === 'current-document' && scopeLive.sourceFreshness === 'live',
    () => `${scopeLive.scope}/${scopeLive.sourceFreshness}`);
  await check('S12', 'Workspace is labelled as the saved source',
    () => scopeSaved.scope === 'workspace' && scopeSaved.sourceFreshness === 'saved',
    () => `${scopeSaved.scope}/${scopeSaved.sourceFreshness}`);
  await check('S13', 'an unsaved H1 differs between the two scopes',
    () => scopeLive.parsed?.title === 'Edited title' &&
      scopeSaved.files.find((f) => f.path === NOTE_PATH)?.title === 'Original title',
    () => `live=${scopeLive.parsed?.title} saved=${scopeSaved.files[0]?.title}`);
  await check('S14', 'an unsaved Task differs between the two scopes',
    () => scopeLive.parsed?.tasks.length === 1 &&
      scopeLive.parsed.tasks[0].text !== savedRecordDuringEdit.tasks[0].text,
    () => `live=${scopeLive.parsed?.tasks?.[0]?.text} saved=${savedRecordDuringEdit?.tasks?.[0]?.text}`);
  await check('S15', 'parsing Current Document does not mutate the Index', () => {
    const before = JSON.stringify([
      IDX.files.length, IDX.tasks.length, IDX.lastBuiltAt, IDX.byPath.get(NOTE_PATH).title,
    ]);
    for (let i = 0; i < 5; i += 1) O.getCurrentDocumentScope();
    const after = JSON.stringify([
      IDX.files.length, IDX.tasks.length, IDX.lastBuiltAt, IDX.byPath.get(NOTE_PATH).title,
    ]);
    return before === after;
  }, () => 'index snapshot identical after repeated live parses');
  await check('S16', 'parsing Current Document does not mutate WORKSPACE_STATE', () => {
    const snap = () => JSON.stringify({
      root: WORKSPACE_STATE.rootName,
      files: WORKSPACE_STATE.files.notes.map((r) => r.path),
      active: WORKSPACE_STATE.activeFile?.path,
    });
    const before = snap();
    O.getCurrentDocumentScope();
    O.getCurrentDocumentScope();
    return before === snap();
  }, () => 'storage state identical');
  await check('S17', 'Current Document parsing never rebuilds the Index', () => {
    const buildsBefore = h.indexBuilds;
    O.getCurrentDocumentScope();
    O.getCurrentDocumentScope();
    return h.indexBuilds === buildsBefore && h.rebuilds.length === 0;
  }, () => 'no rebuild requested while typing/parsing');
  await check('S18', 'no second persistent store is introduced', () => {
    const keys = Object.keys(globalThis).filter((k) =>
      /CURRENT_DOCUMENT|CURRENTDOC|SCOPE_STORE|LIVE_INDEX|LIVE_DOCUMENT/i.test(k));
    return keys.length === 0;
  }, () => 'no live-state global');
  await check('S19', 'no duplicate parser is introduced', () => {
    // Exactly one parse owner is referenced by both scopes, and no new parse
    // function is defined anywhere in the shipped sources.
    const bothUseSharedParser =
      extractBlockFrom(MAIN_SOURCE, 'function getCurrentDocumentScope() {')
        .includes('parseWorkspaceDocument(') &&
      extractBlockFrom(MAIN_SOURCE, 'async function buildWorkspaceIndex(')
        .includes('parseWorkspaceDocument(');
    const noNewParser =
      !/function (parseCurrentDocument|parseLiveDocument|parseEditorDocument)/.test(MAIN_SOURCE) &&
      !/function (parseCurrentDocument|parseLiveDocument)/.test(PARSER_SOURCE);
    return bothUseSharedParser && noNewParser;
  }, () => 'one shared parse owner');
  await check('S20', 'a physical Save plus rebuild reconciles both scopes', async () => {
    // The real Save contract: write the live text to the physical handle, then
    // rebuild the saved Index.
    const writable = await noteHandle.createWritable();
    await writable.write(O.state().mdValue);
    await writable.close();
    O.setText(noteHandle.__text);
    O.setDirty(false);
    await O.buildWorkspaceIndex();

    const liveAfter = O.getCurrentDocumentScope();
    const savedAfter = O.getWorkspaceScope();
    return liveAfter.parsed?.title === 'Edited title' &&
      savedAfter.files.find((f) => f.path === NOTE_PATH)?.title === 'Edited title' &&
      savedAfter.files.find((f) => f.path === NOTE_PATH)?.tasks.length === 1;
  }, () => 'live and saved agree after Save + rebuild');

  group('Workspace membership (M21-M28)');

  await check('M21', 'a Workspace Note belongs to the Workspace', () => {
    openWorkspaceNote();
    const s = O.getCurrentDocumentScope();
    return s.belongsToWorkspace === true && s.workspaceAvailable === true &&
      s.workspacePath === NOTE_PATH && s.membershipReason === 'proven-handle-match';
  }, () => 'proven by handle identity');

  await check('M22', 'an external standalone file does not belong', () => {
    openWorkspaceNote();
    // The shipped external-open shape: a writable handle that is NOT the
    // storage record handle, and no active Workspace record.
    WORKSPACE_STATE.activeFile = null;
    O.setHandle(externalHandle);
    O.setFileName('example.md');
    O.setText(externalHandle.__text);
    const s = O.getCurrentDocumentScope();
    return s.belongsToWorkspace === false && s.workspacePath === null &&
      s.workspaceAvailable === true;
  }, () => 'no membership without proof');

  await check('M23', 'an external file with a matching basename does not belong', () => {
    openWorkspaceNote();
    // Same basename AND same H1 as the Workspace Note, different handle object.
    O.setHandle(externalHandle);
    const s = O.getCurrentDocumentScope();
    return externalHandle.name === 'example.md' && s.belongsToWorkspace === false;
  }, () => 'basename is not proof');

  await check('M24', 'an external file with a matching H1 does not belong', () => {
    openWorkspaceNote();
    O.setHandle(externalHandle);
    O.setText('# Original title\n\nDifferent file entirely.\n');
    const s = O.getCurrentDocumentScope();
    return s.parsed?.title === 'Original title' && s.belongsToWorkspace === false;
  }, () => 'H1 is not proof');

  await check('M25', 'Save As outside notes/ releases membership', () => {
    openWorkspaceNote();
    // The shipped Save As contract: the external handle is adopted and the
    // previous Workspace identity is released (activeFile cleared).
    const before = O.getCurrentDocumentScope();
    WORKSPACE_STATE.activeFile = null;
    O.setHandle(externalHandle);
    const after = O.getCurrentDocumentScope();
    return before.belongsToWorkspace === true && after.belongsToWorkspace === false &&
      after.workspacePath === null;
  }, () => 'membership released on external Save As');

  await check('M26', 'workspaceAvailable is distinct from membership', () => {
    // A Workspace IS available, but the active document is a brand-new
    // unsaved one: available true, membership false.
    openWorkspaceNote();
    WORKSPACE_STATE.activeFile = null;
    O.setHandle(null);
    O.setText('# Scratch\n');
    const s = O.getCurrentDocumentScope();
    // And with no Workspace at all, both are false.
    WORKSPACE_STATE.rootHandle = null;
    const none = O.getCurrentDocumentScope();
    return s.workspaceAvailable === true && s.belongsToWorkspace === false &&
      none.workspaceAvailable === false && none.belongsToWorkspace === false;
  }, () => 'available != member');

  await check('M27', 'no handle produces a safe membership false', () => {
    openWorkspaceNote();
    // The active record survives, but there is no writable handle at all: the
    // scope must report false, never a stale "true".
    O.setHandle(null);
    const s = O.getCurrentDocumentScope();
    return s.belongsToWorkspace === false && s.workspacePath === null &&
      s.membershipReason === 'no-writable-handle';
  }, () => 'unknown resolves to false');

  await check('M28', 'a rejected Workspace candidate does not change membership', () => {
    openWorkspaceNote();
    const before = O.getCurrentDocumentScope().belongsToWorkspace;
    // A rejected detection never mutates WORKSPACE_STATE, so the currently
    // active Note keeps its proven membership.
    WORKSPACE_STATE.rootHandle = null;
    const after = O.getCurrentDocumentScope();
    return before === true && after.belongsToWorkspace === false &&
      after.workspaceAvailable === false;
  }, () => 'rejection is honest, not sticky');

  group('Report exclusion (R29-R32)');

  await check('R29', 'a virtual Report is identified separately', () => {
    openWorkspaceNote();
    O.setText('---\ntype: report\n---\n\n# Weekly Report\n');
    O.setReportSession({ kind: 'report', virtual: true, saved: false, sourcePath: null });
    O.setHandle(null);
    WORKSPACE_STATE.activeFile = null;
    const s = O.getCurrentDocumentScope();
    return s.isReport === true && s.isVirtualReport === true && s.isSavedReport === false &&
      s.documentCategory === 'report';
  }, () => 'virtual report flags');

  await check('R30', 'a saved Report is identified according to the current owner', () => {
    openWorkspaceNote();
    O.setText('---\ntype: report\n---\n\n# Saved Report\n');
    O.setReportSession({ kind: 'report', virtual: false, saved: true, sourcePath: null });
    O.setHandle(null);
    const s = O.getCurrentDocumentScope();
    return s.isReport === true && s.isSavedReport === true && s.isVirtualReport === false;
  }, () => 'saved report flags');

  await check('R31', 'a Report is excluded from future Note metadata eligibility', () => {
    openWorkspaceNote();
    O.setText('# Ordinary note\n');
    O.setReportSession(null);
    O.setHandle(noteHandle);
    const note = O.getCurrentDocumentScope();

    O.setReportSession({ kind: 'report', virtual: true, saved: false, sourcePath: null });
    const report = O.getCurrentDocumentScope();

    return note.noteMetadataEligible === true && report.noteMetadataEligible === false;
  }, () => 'eligibility excludes reports');

  await check('R32', 'ACT 3 changes no Report lifecycle', () => {
    const scopeBlock = extractBlockFrom(MAIN_SOURCE, 'function getCurrentDocumentScope() {');
    const reportBlock = extractBlockFrom(
      MAIN_SOURCE, 'function describeCurrentDocumentReportState() {'
    );
    // Read-only: the scope API never assigns Report identity, never saves and
    // never clears it, and no metadata writer is introduced.
    return !/__virtualReportSession\s*=/.test(scopeBlock + reportBlock) &&
      !/openVirtualReport|saveSmart|clearReportIdentity/.test(scopeBlock + reportBlock) &&
      !/function (setFrontmatter|writeFrontmatter|removeManagedKey)/.test(MAIN_SOURCE);
  }, () => 'report owners untouched');

  group('Cross-package (X33-X41)');

  const CROSS = [
    ['X33', 'Today creation Index correction remains green', () =>
      /WORKSPACE TODAY INDEX VALIDATORS: 31 passed, 0 failed/.test(
        runNode('scripts/workspace-today-index-validators.cjs')
      )],
    ['X34', 'ACT 1A/1B storage validators remain green', () =>
      /WORKSPACE STORAGE VALIDATORS: 199 passed, 0 failed/.test(
        runNode('scripts/workspace-storage-validators.cjs')
      )],
    ['X35', 'ACT 1C Index validators remain green', () =>
      /WORKSPACE INDEX NOTES VALIDATORS: 58 passed, 0 failed/.test(
        runNode('scripts/workspace-index-notes-validators.cjs')
      )],
    ['X36', 'ACT 2A discovery consumers remain green', () =>
      /WORKSPACE DISCOVERY CONSUMERS VALIDATORS: 52 passed, 0 failed/.test(
        runNode('scripts/workspace-discovery-consumers-validators.cjs')
      )],
    ['X37', 'ACT 2B task consumers remain green', () =>
      /WORKSPACE TASK CONSUMERS VALIDATORS: 62 passed, 0 failed/.test(
        runNode('scripts/workspace-task-consumers-validators.cjs')
      )],
    ['X38', 'ACT 2C lifecycle/output consumers remain green', () =>
      /WORKSPACE LIFECYCLE OUTPUT VALIDATORS: 67 passed, 0 failed/.test(
        runNode('scripts/workspace-lifecycle-output-validators.cjs')
      )],
    ['X39', 'detection, cache, session, task, update and report suites remain green',
      () => [
        'scripts/workspace-detection-validators.cjs',
        'scripts/dependency-cache-validators.cjs',
        'scripts/mode-session-validators.cjs',
        'scripts/task-reconcile-validators.cjs',
        'scripts/update-ready-validators.cjs',
        'scripts/release-notes-validators.cjs',
      ].every((f) => !/^FAIL \[/m.test(runNode(f)))],
    ['X40', 'no Sidebar redesign, no Named Note and no metadata writer', () => {
      const sidebar = extractBlockFrom(
        WORKSPACE_CONTROLLER_SOURCE, 'function refreshWorkspaceSidebar('
      );
      return !/ACT 2C\.1|ACT 3/.test(sidebar) &&
        !/function createNewNote/.test(MAIN_SOURCE + WORKSPACE_CONTROLLER_SOURCE) &&
        !/function (setFrontmatter|writeFrontmatter|removeManagedKey)/.test(
          MAIN_SOURCE + WORKSPACE_CONTROLLER_SOURCE
        );
    }, () => 'sidebar/creation/writer untouched'],
    ['X41', 'no Project syntax change and no version/cache change', () => {
      const parity = runNode('scripts/release-parity.cjs');
      return !/^## Project:/m.test(PARSER_SOURCE) &&
        /RELEASE PARITY OK/.test(parity) && parity.includes(APP_VERSION_BASELINE);
    }, () => 'parser and identity unchanged'],
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

  console.log(
    `\nCURRENT DOCUMENT SCOPE VALIDATORS: ${passed.length} passed, ${failed.length} failed`
  );
  process.exitCode = failed.length === 0 ? 0 : 1;
})().catch((error) => {
  console.error('CURRENT DOCUMENT SCOPE VALIDATORS: harness error', error);
  process.exit(1);
});
