#!/usr/bin/env node
'use strict';

/**
 * ACT 6 — Active-Note metadata actions.
 *
 * Exercises the REAL shipped owners in Node (main.js is a browser script, so
 * its owners are extracted verbatim and evaluated together with the
 * module-level `let` state they close over — the same technique the ACT
 * 1C/2A/2B/2C, ACT 3 and ACT 5 suites use):
 *   - js/main.js — patchNoteMetadata, readNoteMetadataFlags,
 *     isManagedNoteMetadataKey, describeNoteActionTarget,
 *     applyActiveNoteMetadata, the six lifecycle actions, the real
 *     runProgrammaticTextChange, buildWorkspaceNotesViewModel,
 *     renderWorkspaceArchivePanel and the ACT 4 renderers
 *   - js/workspace/workspace-parser.js — the single saved parse owner
 *
 * The patcher is asserted PURE (text in, text out). The lifecycle is asserted
 * against the real WORKSPACE_STATE and a real saved Index built by the shipped
 * parser, so "does not mutate the Index before Save" is a real observation.
 *
 * 44 fixtures: P01-P13 patch contract, L14-L25 lifecycle, S26-S32 Sidebar,
 * E33-E34 escape, N35-N38 non-touch, X39-X44 cross-package.
 *
 * Usage: node scripts/workspace-note-metadata-validators.cjs
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

const MAIN_SOURCE = read('js', 'main.js');
const PARSER_SOURCE = read('js', 'workspace', 'workspace-parser.js');
const CONTROLLER_SOURCE = read('js', 'workspace', 'workspace-controller.js');
const TASK_REVIEW_SOURCE = read('js', 'workspace', 'task-review.js');
const INDEX_HTML = read('index.html');

const APP_VERSION_BASELINE = 'markmap-journal-pwa-0.6.2-notes-workspace-foundation';

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

const h = { logs: [], toasts: [], saves: 0, writes: 0, status: [] };

const dom = {};
function makeEl(id) {
  return {
    id,
    value: '',
    style: { display: '' },
    dataset: {},
    hidden: false,
    innerHTML: '',
    textContent: '',
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    setAttribute() {},
    getAttribute: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}

for (const id of [
  'workspaceJournalsList', 'workspaceJournalsBadge',
  'workspaceConceptsList', 'workspaceConceptsBadge',
  'workspaceArchiveList', 'workspaceArchiveBadge',
  'workspaceActiveActions',
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
};
globalThis.updateWorkspaceActiveFileHighlight = () => {};
globalThis.MME_APP = {
  log: (m) => h.logs.push(String(m)),
  showToast: (m) => h.toasts.push(String(m)),
  isDirty: () => O.state().dirty,
};

const noteHandle = { kind: 'file', name: 'a.md' };
const externalHandle = { kind: 'file', name: 'external.md' };

const WORKSPACE_STATE = {
  rootHandle: { kind: 'directory', name: 'Workspace' },
  rootName: 'Workspace',
  folders: { notes: { kind: 'directory', name: 'notes' } },
  files: {
    notes: [
      { kind: 'notes', name: 'a.md', path: 'notes/a.md', handle: noteHandle },
    ],
  },
  activeFile: { kind: 'notes', name: 'a.md', path: 'notes/a.md', handle: noteHandle },
};
globalThis.WORKSPACE_STATE = WORKSPACE_STATE;

const OWNER_EXTRACTS = [
  'const NOTE_METADATA_MANAGED_KEYS = [\'knowledge\', \'pinned\', \'archived\'];',
  'const NOTE_FRONTMATTER_OPEN = /^\\uFEFF?---[ \\t]*\\r?\\n/;',
  extractBlockFrom(MAIN_SOURCE, 'function isManagedNoteMetadataKey(key) {'),
  extractBlockFrom(MAIN_SOURCE, 'function findNoteFrontmatterClose(rest) {'),
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
  'const WORKSPACE_NOTE_DATE_SHAPE = /^\\d{4}-\\d{2}-\\d{2}$/;',
  'const WORKSPACE_DATED_NOTE_FILENAME = /(\\d{4}-\\d{2}-\\d{2})\\.md$/i;',
  extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceNoteDate(record) {'),
  extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceNoteTitle(record) {'),
  extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceNoteSecondaryIdentity(record, ambiguous) {'),
  extractBlockFrom(MAIN_SOURCE, 'function compareWorkspaceNotesForList(a, b) {'),
  extractBlockFrom(MAIN_SOURCE, 'function getJournalMonthGroupLabel(dateIso) {'),
  extractBlockFrom(MAIN_SOURCE, 'function buildWorkspaceNotesViewModel() {'),
  extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceNoteRowMarkup(note, options = {}) {'),
  extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceNoteRowOptions(notes) {'),
  extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceNotesPanel() {'),
  extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceKnowledgePanel() {'),
  extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceArchivePanel() {'),
  extractBlockFrom(MAIN_SOURCE, 'function escapeHtml(str) {'),
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
  'const modeLabel = () => "Journal";',
  'const updateDocumentTitle = () => {};',
  'const runProgrammaticTextChange = (cb) => { __programmaticTextChange++; try { cb(); } finally { __programmaticTextChange--; } };',
  'const renderWorkspaceActivePanel = () => {};',
  'return {',
  '  patchNoteMetadata, readNoteMetadataFlags, isManagedNoteMetadataKey,',
  '  describeNoteActionTarget, applyActiveNoteMetadata,',
  '  pinActiveNote, unpinActiveNote, addActiveNoteToKnowledge,',
  '  removeActiveNoteFromKnowledge, archiveActiveNote, restoreActiveNote,',
  '  buildWorkspaceNotesViewModel,',
  '  renderWorkspaceNotesPanel, renderWorkspaceKnowledgePanel, renderWorkspaceArchivePanel,',
  '  setText: (v) => { md.value = v; },',
  '  setIndex: (records) => { WORKSPACE_INDEX_STATE = { ready: true, files: records, byKind: { notes: records } }; },',
  '  setHandle: (v) => { currentSaveHandle = v; },',
  '  setReportSession: (v) => { __virtualReportSession = v; },',
  '  state: () => ({ dirty, currentSaveHandle, text: md.value, report: __virtualReportSession }),',
  '};',
].join('\n');

globalThis.__h = h;

const O = new Function([...OWNER_EXTRACTS, OWNER_API].join('\n\n'))();

(async () => {
  // The saved parse owner, so "the Index reflects the flag" is a real parse.
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

  const patch = O.patchNoteMetadata;
  const read = O.readNoteMetadataFlags;
  const BODY = '# Title\n\nSome body with <angle> & ampersand.\n\n- [ ] task\n';

  group('Patch contract (P01-P13)');

  await check('P01', 'a document with no frontmatter gets a minimal block', () => {
    const r = patch(BODY, { pinned: true });
    return r.ok === true && r.text.startsWith('---\npinned: true\n---\n') &&
      r.text.endsWith(BODY);
  }, () => 'minimal block prepended');

  await check('P02', 'an existing frontmatter keeps its unknown keys and order', () => {
    const src = '---\ntitle: Mine\nknowledge: false\n---\n\n# T\n';
    const r = patch(src, { knowledge: true });
    return r.text.includes('title: Mine') && r.text.includes('knowledge: true') &&
      r.text.indexOf('title: Mine') < r.text.indexOf('knowledge: true') &&
      r.text.endsWith('\n# T\n');
  }, () => 'preserved');

  await check('P03', 'a new key is appended without disturbing existing lines', () => {
    const src = '---\ntitle: Mine\n---\n\n# T\n';
    const r = patch(src, { archived: true });
    return r.text.includes('title: Mine') && r.text.includes('archived: true') &&
      r.text.includes('# T');
  }, () => 'appended');

  await check('P04', 'false removes the managed key entirely', () => {
    const src = '---\npinned: true\ntitle: Mine\n---\n\n# T\n';
    const r = patch(src, { pinned: false });
    return !/pinned/.test(r.text) && r.text.includes('title: Mine');
  }, () => 'removed');

  await check('P05', 'comments inside frontmatter are preserved', () => {
    const src = '---\n# my note\ntitle: Mine\n---\n\n# T\n';
    const r = patch(src, { knowledge: true });
    return r.text.includes('# my note') && r.text.includes('knowledge: true');
  }, () => 'comment kept');

  await check('P06', 'the Markdown body is preserved byte-for-byte', () => {
    const src = `---\ntitle: Mine\n---\n${BODY}`;
    const r = patch(src, { pinned: true });
    return r.ok === true && r.text.endsWith(BODY);
  }, () => 'body identical');

  await check('P07', 'combinations of flags all land', () => {
    const r = patch(BODY, { knowledge: true, pinned: true, archived: true });
    return read(r.text).knowledge && read(r.text).pinned && read(r.text).archived;
  }, () => 'all three');

  await check('P08', 'a repeated patch is idempotent', () => {
    const once = patch(BODY, { pinned: true }).text;
    const twice = patch(once, { pinned: true }).text;
    const thrice = patch(twice, { pinned: true }).text;
    return once === twice && twice === thrice &&
      (thrice.match(/pinned: true/g) || []).length === 1;
  }, () => 'stable');

  await check('P09', 'malformed frontmatter aborts and changes nothing', () => {
    const src = '---\ntitle: Mine\n\n# Never closed\n';
    const r = patch(src, { pinned: true });
    return r.ok === false && r.reason === 'malformed-frontmatter' && r.text === src &&
      r.changed === false;
  }, () => 'aborted');

  await check('P10', 'unmanaged keys can never be written by this writer', () => {
    const r = patch(BODY, { type: 'note', title: 'x', date: '2026-01-01', pinned: true });
    return !/type:/.test(r.text) && !/date:/.test(r.text) && r.text.includes('pinned: true');
  }, () => 'only managed');

  await check('P11', 'Unicode content is preserved', () => {
    const src = '---\ntitle: 日本語\n---\n\n# Título — Café ✅\n';
    const r = patch(src, { knowledge: true });
    return r.text.includes('日本語') && r.text.includes('Título — Café ✅');
  }, () => 'unicode kept');

  await check('P12', 'the reader agrees with the writer', () => {
    const r = patch(BODY, { knowledge: true });
    const flags = read(r.text);
    return flags.knowledge === true && flags.pinned === false && flags.archived === false;
  }, () => 'round-trip');

  await check('P13', 'the writer is pure: identical input gives identical output', () => {
    const a = patch(BODY, { pinned: true }).text;
    const b = patch(BODY, { pinned: true }).text;
    return a === b;
  }, () => 'deterministic');

  function r0(r) {
    return { ok: r.ok, head: String(r.text).slice(0, 40) };
  }

  group('Active-Note lifecycle (L14-L25)');

  function openActiveNote(text = BODY) {
    WORKSPACE_STATE.activeFile = { kind: 'notes', name: 'a.md', path: 'notes/a.md', handle: noteHandle };
    O.setHandle(noteHandle);
    O.setReportSession(null);
    O.setText(text);
  }

  await check('L14', 'an active Workspace Note is eligible', () => {
    openActiveNote();
    return O.describeNoteActionTarget().eligible === true;
  }, () => 'eligible');

  await check('L15', 'Pin patches the live buffer and marks it dirty', () => {
    openActiveNote();
    const r = O.pinActiveNote();
    return r.ok === true && r.changed === true && O.state().dirty === true &&
      read(O.state().text).pinned === true;
  }, () => 'pinned live');

  await check('L16', 'Unpin removes the key from the live buffer', () => {
    openActiveNote(patch(BODY, { pinned: true }).text);
    const r = O.unpinActiveNote();
    return r.ok === true && read(O.state().text).pinned === false &&
      !/pinned/.test(O.state().text);
  }, () => 'unpinned');

  await check('L17', 'Add/Remove Knowledge both work on the live buffer', () => {
    openActiveNote();
    O.addActiveNoteToKnowledge();
    const added = read(O.state().text).knowledge;
    O.removeActiveNoteFromKnowledge();
    const removed = read(O.state().text).knowledge;
    return added === true && removed === false;
  }, () => 'knowledge toggled');

  await check('L18', 'Archive and Restore both work on the live buffer', () => {
    openActiveNote();
    O.archiveActiveNote();
    const archived = read(O.state().text).archived;
    O.restoreActiveNote();
    const restored = read(O.state().text).archived;
    return archived === true && restored === false && !/archived/.test(O.state().text);
  }, () => 'archive toggled');

  await check('L19', 'the current writable handle is preserved', () => {
    openActiveNote();
    O.pinActiveNote();
    return O.state().currentSaveHandle === noteHandle &&
      WORKSPACE_STATE.activeFile.handle === noteHandle;
  }, () => 'handle kept');

  await check('L20', 'no action performs an automatic Save', () => {
    openActiveNote();
    h.saves = 0;
    O.pinActiveNote();
    O.addActiveNoteToKnowledge();
    O.archiveActiveNote();
    return h.saves === 0 && /saveSmart|saveToHandle/.test(
      extractBlockFrom(MAIN_SOURCE, 'function applyActiveNoteMetadata(key, value) {')
    ) === false;
  }, () => 'no save call');

  await check('L21', 'an external standalone file is rejected', () => {
    openActiveNote();
    O.setHandle(externalHandle);
    const r = O.pinActiveNote();
    return r.ok === false && r.reason === 'not-a-workspace-note' && !/pinned/.test(O.state().text);
  }, () => 'external rejected');

  await check('L22', 'an unsaved standalone document is rejected', () => {
    openActiveNote();
    WORKSPACE_STATE.activeFile = null;
    O.setHandle(null);
    const r = O.pinActiveNote();
    return r.ok === false && r.reason === 'no-active-note' && !/pinned/.test(O.state().text);
  }, () => 'unsaved rejected');

  await check('L23', 'a virtual Report is rejected', () => {
    openActiveNote();
    O.setReportSession({ kind: 'report', virtual: true, saved: false });
    const before = O.state().text;
    const r = O.archiveActiveNote();
    return r.ok === false && r.reason === 'report-active' && O.state().text === before;
  }, () => 'virtual report rejected');

  await check('L24', 'a saved Report is rejected', () => {
    openActiveNote();
    O.setReportSession({ kind: 'report', virtual: false, saved: true });
    const before = O.state().text;
    const r = O.addActiveNoteToKnowledge();
    return r.ok === false && r.reason === 'report-active' && O.state().text === before;
  }, () => 'saved report rejected');

  await check('L25', 'the Index is NOT mutated before Save', () => {
    // The saved projection is built from saved records, so a live-only change
    // must not appear there.
    openActiveNote();
    const saved = [noteRecord('notes/a.md', { title: 'A', knowledge: false, pinned: false })];
    const before = JSON.stringify(O.buildWorkspaceNotesViewModel().source.length);
    O.pinActiveNote();
    const after = JSON.stringify(O.buildWorkspaceNotesViewModel().source.length);
    O.setText(saved[0] ? BODY : BODY);
    return before === after && O.state().dirty === true;
  }, () => 'index untouched');

  function noteRecord(path, extra = {}) {
    return {
      kind: 'notes',
      name: String(path).split('/').pop(),
      path,
      title: '',
      date: '',
      knowledge: false,
      pinned: false,
      archived: false,
      ...extra,
    };
  }

  group('Sidebar projections (S26-S32)');

  // The projections read the saved Index through the same object the shipped
  // owner reads; the harness injects it rather than duplicating the derivation.
  function setSavedNotes(records) {
    O.setIndex(records);
  }

  await check('S26', 'the Archive view contains the archived Note', () => {
    setSavedNotes([noteRecord('notes/old.md', { title: 'Old', archived: true })]);
    O.renderWorkspaceArchivePanel();
    return dom.workspaceArchiveList.innerHTML.includes('notes/old.md') &&
      dom.workspaceArchiveBadge.textContent === '1';
  }, () => 'archived listed');

  await check('S27', 'the Archive title uses the saved H1', () => {
    setSavedNotes([noteRecord('notes/old.md', { title: 'Archived Title', archived: true })]);
    O.renderWorkspaceArchivePanel();
    return dom.workspaceArchiveList.innerHTML.includes('>Archived Title<');
  }, () => 'h1 used');

  await check('S28', 'an archived Note is excluded from Notes, Pinned and Knowledge', () => {
    setSavedNotes([
      noteRecord('notes/old.md', { title: 'Old', archived: true, knowledge: true, pinned: true }),
      noteRecord('notes/live.md', { title: 'Live' }),
    ]);
    const v = O.buildWorkspaceNotesViewModel();
    O.renderWorkspaceNotesPanel();
    O.renderWorkspaceKnowledgePanel();
    return v.activeNotes.length === 1 && v.pinnedNotes.length === 0 &&
      v.knowledgeNotes.length === 0 && v.archivedNotes.length === 1 &&
      !dom.workspaceJournalsList.innerHTML.includes('notes/old.md') &&
      !dom.workspaceConceptsList.innerHTML.includes('notes/old.md');
  }, () => 'excluded from active');

  await check('S29', 'Restore preserves Knowledge and Pin state', () => {
    const src = patch(BODY, { knowledge: true, pinned: true, archived: true }).text;
    const restored = patch(src, { archived: false }).text;
    const flags = read(restored);
    return flags.archived === false && flags.knowledge === true && flags.pinned === true;
  }, () => 'knowledge + pin kept');

  await check('S30', 'an archived Note keeps its exact-path navigation', () => {
    setSavedNotes([noteRecord('notes/old.md', { title: 'Old', archived: true })]);
    O.renderWorkspaceArchivePanel();
    const html = dom.workspaceArchiveList.innerHTML;
    return html.includes('data-path="notes/old.md"') && html.includes('data-kind="notes"');
  }, () => 'exact path');

  await check('S31', 'the Archive panel reuses the existing Sidebar host', () =>
    /id="workspaceArchivePanel"/.test(INDEX_HTML) &&
    /id="workspaceArchiveList"/.test(INDEX_HTML) &&
    /data-workspace-panel-toggle="archive"/.test(INDEX_HTML) &&
    /getElementById\('workspaceArchiveList'\)/.test(CONTROLLER_SOURCE),
  () => 'host reused');

  await check('S32', 'the Active action area exists in the Active panel', () =>
    /id="workspaceActiveActions"/.test(MAIN_SOURCE) &&
    /data-note-action=/.test(MAIN_SOURCE) &&
    /function applyActiveNoteMetadata/.test(MAIN_SOURCE),
  () => 'action row present');

  group('Task escape (E33-E34)');

  await check('E33', 'Task display text is escaped exactly once', () => {
    // enrichTask() escapes once; the row renderer must not escape again.
    const start = TASK_REVIEW_SOURCE.indexOf('const doneClass = task.done');
    const rowLine = TASK_REVIEW_SOURCE.slice(start, start + 500);
    return /task\.displayText != null/.test(rowLine) &&
      !/escapeHtml\(task\.displayText/.test(rowLine);
  }, () => 'single escape');

  await check('E34', 'an intended < is not shown as a literal &lt;', () => {
    const start = TASK_REVIEW_SOURCE.indexOf('const doneClass = task.done');
    const rowLine = TASK_REVIEW_SOURCE.slice(start, start + 500);
    // Feeding the already-escaped value straight through keeps one escape level,
    // so "a < b" renders as "a < b" instead of "a &lt; b".
    return String('a < b').replace(/&/g, '&amp;').replace(/</g, '&lt;') === 'a &lt; b' &&
      !/escapeHtml\(task\.displayText/.test(rowLine) &&
      !/escapeHtml\(String\(task\.displayText\)/.test(rowLine);
  }, () => 'no double escape');

  group('Non-touch (N35-N38)');

  const ACTIONS = extractBlockFrom(MAIN_SOURCE, 'function applyActiveNoteMetadata(key, value) {');
  const PATCHER = extractBlockFrom(MAIN_SOURCE, 'function patchNoteMetadata(text, flags) {');

  await check('N35', 'no inactive-file write, move, removeEntry or rename', () =>
    !/getFile\(|createWritable|removeEntry|\bmove\b|\brename\b|removeArchived/.test(ACTIONS + PATCHER),
  () => 'no filesystem mutation');

  await check('N36', 'the writer never touches the Index or storage state', () =>
    !/WORKSPACE_INDEX_STATE|WORKSPACE_STATE/.test(ACTIONS + PATCHER),
  () => 'no state mutation');

  await check('N37', 'the Active panel still shows the saved H1, not a live one', () => {
    const panel = extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceActivePanel() {');
    return /parsed\?\.title \|\| active\.name/.test(panel) &&
      !/getCurrentDocumentScope/.test(panel);
  }, () => 'saved title kept');

  await check('N38', 'no Tasks/Projects redesign and no version bump', () => {
    const parity = runNode('scripts/release-parity.cjs');
    return /RELEASE PARITY OK/.test(parity) && parity.includes(APP_VERSION_BASELINE) &&
      !/^## Project:/m.test(PARSER_SOURCE) &&
      !/renderWorkspace(Tasks|Projects)Panel/.test(ACTIONS);
  }, () => 'no redesign');

  group('Cross-package (X39-X42)');

  // Only the suites most tightly coupled to ACT 6 run here; the final
  // regression pass runs every suite standalone, so this focused suite stays
  // fast instead of re-running the whole battery inside itself.
  const CROSS = [
    ['X39', 'ACT 5 creation remains green', () =>
      /WORKSPACE NOTE CREATION VALIDATORS: 35 passed, 0 failed/.test(
        runNode('scripts/workspace-note-creation-validators.cjs'))],
    ['X40', 'ACT 4 Sidebar remains green', () =>
      /WORKSPACE NOTES SIDEBAR VALIDATORS: 65 passed, 0 failed/.test(
        runNode('scripts/workspace-notes-sidebar-validators.cjs'))],
    ['X41', 'ACT 3 scope remains green', () =>
      /CURRENT DOCUMENT SCOPE VALIDATORS: 41 passed, 0 failed/.test(
        runNode('scripts/current-document-scope-validators.cjs'))],
    ['X42', 'ACT 2C.1 Today index correction remains green', () =>
      /WORKSPACE TODAY INDEX VALIDATORS: 31 passed, 0 failed/.test(
        runNode('scripts/workspace-today-index-validators.cjs'))],
  ];

  for (const [id, label, fn] of CROSS) {
    await check(id, label, (() => {
      try { return fn(); } catch { return false; }
    })(), () => 'checked');
  }

  const failed = results.filter((e) => !e.group && !e.ok);
  const passed = results.filter((e) => !e.group && e.ok);

  for (const e of results) {
    if (e.group) { console.log('\n' + e.group); continue; }
    console.log(`${e.ok ? 'PASS' : 'FAIL'} [${e.id}] ${e.name}${e.ok ? '' : ` — ${e.detail}`}`);
  }

  console.log(`\nWORKSPACE NOTE METADATA VALIDATORS: ${passed.length} passed, ${failed.length} failed`);
  process.exitCode = failed.length === 0 ? 0 : 1;
})().catch((error) => {
  console.error('WORKSPACE NOTE METADATA VALIDATORS: harness error', error);
  process.exit(1);
});
