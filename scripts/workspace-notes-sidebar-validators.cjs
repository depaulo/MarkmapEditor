#!/usr/bin/env node
'use strict';

/**
 * ACT 4 — Notes / Knowledge Sidebar adaptation.
 *
 * Exercises the REAL shipped Sidebar owners in Node (main.js is a browser
 * script, so its owners are extracted verbatim and evaluated together with the
 * module-level `let` state they close over — the same technique the ACT
 * 1C/2A/2B/2C and ACT 3 suites already use):
 *   - js/main.js — buildWorkspaceNotesViewModel, getWorkspaceNoteDate,
 *     getWorkspaceNoteTitle, getWorkspaceNoteSecondaryIdentity,
 *     compareWorkspaceNotesForList, getWorkspaceNoteRowMarkup,
 *     getWorkspaceNoteRowOptions, renderWorkspaceNotesPanel,
 *     renderWorkspaceKnowledgePanel, the retained renderWorkspaceJournalTimeline
 *     alias and the real renderWorkspaceActivePanel;
 *   - js/workspace/workspace-scanner.js — the ACT 1B notes/ scanner, used to
 *     prove the projections run off the real saved Index;
 *   - js/workspace/workspace-parser.js — the single saved parse owner.
 *
 * The view model is PURE: it is asserted directly against synthesized Index
 * records, and it is also asserted end-to-end through the real parser + scanner
 * so a "works by accident" projection cannot pass.
 *
 * 53 fixtures: V01-V15 view model, T16-T23 title/identity, G24-G28 grouping,
 * R29-R35 refresh, K36-K40 knowledge, A41-A44 active panel, S45-S53 safety.
 *
 * Usage: node scripts/workspace-notes-sidebar-validators.cjs
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

const MAIN_SOURCE = read('js', 'main.js');
const PARSER_SOURCE = read('js', 'workspace', 'workspace-parser.js');
const CONTROLLER_SOURCE = read('js', 'workspace', 'workspace-controller.js');
const SCANNER_SOURCE = read('js', 'workspace', 'workspace-scanner.js');
const INDEX_HTML = read('index.html');
const CSS_SOURCE = read('css', 'workspace.css');

const APP_VERSION_BASELINE = 'markmap-journal-pwa-0.6.3-tasks-wiki-links-foundation';

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

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
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
// Harness
// ---------------------------------------------------------------

const h = { logs: [], rebuilds: 0, renders: 0, writes: [] };

// Minimal recording DOM: the Sidebar hosts, plus containers whose innerHTML is
// captured so the rendered rows/groups can be asserted.
const dom = {};

function makeEl(id) {
  return {
    id,
    value: '',
    style: {},
    dataset: {},
    hidden: false,
    innerHTML: '',
    textContent: '',
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    remove() {},
    setAttribute() {},
    getAttribute: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}

for (const id of [
  'workspaceJournalsList', 'workspaceJournalsBadge',
  'workspaceConceptsList', 'workspaceConceptsBadge',
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
globalThis.updateWorkspaceActiveFileHighlight = () => {
  h.renders += 1;
};
globalThis.__h = h;

const WORKSPACE_STATE = {
  rootHandle: { kind: 'directory', name: 'Workspace' },
  rootName: 'Workspace',
  folders: { notes: { kind: 'directory', name: 'notes' } },
  files: { notes: [] },
  activeFile: null,
};
globalThis.WORKSPACE_STATE = WORKSPACE_STATE;

const OWNER_EXTRACTS = [
  extractBlockFrom(MAIN_SOURCE, 'const WORKSPACE_INDEX_STATE = {', '};'),
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
  extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceJournalTimeline() {'),
  extractBlockFrom(MAIN_SOURCE, 'function escapeHtml(str) {'),
];

const OWNER_API = [
  'return {',
  '  WORKSPACE_INDEX_STATE,',
  '  buildWorkspaceNotesViewModel,',
  '  getWorkspaceNoteDate,',
  '  getWorkspaceNoteTitle,',
  '  getWorkspaceNoteSecondaryIdentity,',
  '  getWorkspaceNoteRowMarkup,',
  '  getWorkspaceNoteRowOptions,',
  '  renderWorkspaceNotesPanel,',
  '  renderWorkspaceKnowledgePanel,',
  '  renderWorkspaceJournalTimeline,',
  '  setIndex: (next) => {',
  '    WORKSPACE_INDEX_STATE.files = next.files;',
  '    WORKSPACE_INDEX_STATE.byKind = next.byKind;',
  '    WORKSPACE_INDEX_STATE.ready = next.ready;',
  '  },',
  '};',
].join('\n');

const O = new Function(
  [
    'const log = (m) => globalThis.__h.logs.push(String(m));',
    ...OWNER_EXTRACTS,
    OWNER_API,
  ].join('\n\n')
)();

const IDX = O.WORKSPACE_INDEX_STATE;
globalThis.WORKSPACE_INDEX_STATE = IDX;

// ---------------------------------------------------------------
// Suites
// ---------------------------------------------------------------

(async () => {

// A Note record shaped exactly like an ACT 1C parsed record.
function note(path, extra = {}) {
  const name = String(path).split('/').pop();
  return {
    kind: 'notes',
    name,
    path,
    title: '',
    date: '',
    knowledge: false,
    pinned: false,
    archived: false,
    ...extra,
  };
}

function useIndex(records) {
  O.setIndex({ files: records, byKind: { notes: records }, ready: true });
  return records;
}

function view() {
  return O.buildWorkspaceNotesViewModel();
}

const notesHtml = () => dom.workspaceJournalsList.innerHTML;
const knowledgeHtml = () => dom.workspaceConceptsList.innerHTML;
const countRows = (html) => (html.match(/data-workspace-file="1"/g) || []).length;
const pathsIn = (html) => Array.from(html.matchAll(/data-path="([^"]*)"/g)).map((m) => m[1]);

group('View model (V01-V15)');

await check('V01', 'zero Notes yields empty projections', () => {
  useIndex([]);
  const v = view();
  return v.activeNotes.length === 0 && v.pinnedNotes.length === 0 &&
    v.knowledgeNotes.length === 0 && v.chronologicalNotes.length === 0 &&
    v.datedGroups.length === 0 && v.undatedNotes.length === 0;
}, () => 'all empty');

await check('V02', 'one dated Note', () => {
  useIndex([note('notes/2026-03-04.md', { date: '2026-03-04', title: 'March note' })]);
  const v = view();
  return v.activeNotes.length === 1 && v.datedGroups.length === 1 &&
    v.datedGroups[0].notes.length === 1 && v.undatedNotes.length === 0;
}, () => 'single dated group');

await check('V03', 'several dated Notes group by month, newest first', () => {
  useIndex([
    note('notes/2026-03-04.md', { date: '2026-03-04' }),
    note('notes/2026-01-02.md', { date: '2026-01-02' }),
    note('notes/2026-03-09.md', { date: '2026-03-09' }),
  ]);
  const v = view();
  return v.datedGroups.length === 2 &&
    v.datedGroups[0].label === 'March 2026' &&
    v.datedGroups[1].label === 'January 2026' &&
    v.datedGroups[0].notes.length === 2;
}, () => 'month groups descending');

await check('V04', 'one Undated Note', () => {
  useIndex([note('notes/scratch.md', { title: 'Scratch' })]);
  const v = view();
  return v.undatedNotes.length === 1 && v.datedGroups.length === 0;
}, () => 'undated only');

await check('V05', 'several Undated Notes', () => {
  useIndex([note('notes/a.md'), note('notes/b.md'),
    note('notes/2026-02-02.md', { date: '2026-02-02' })]);
  const v = view();
  return v.undatedNotes.length === 2 && v.datedGroups.length === 1;
}, () => 'undated alongside dated');

await check('V06', 'a Knowledge Note also appears in Notes', () => {
  useIndex([note('notes/k.md', { knowledge: true, title: 'K' })]);
  const v = view();
  return v.knowledgeNotes.length === 1 && v.activeNotes.length === 1 &&
    v.chronologicalNotes.length === 1;
}, () => 'knowledge stays in notes');

await check('V07', 'a Knowledge Note appears in Knowledge', () => {
  useIndex([note('notes/k.md', { knowledge: true })]);
  return view().knowledgeNotes.length === 1;
}, () => 'knowledge projection');

await check('V08', 'a normal Note does not appear in Knowledge', () => {
  useIndex([note('notes/plain.md')]);
  return view().knowledgeNotes.length === 0;
}, () => 'no false knowledge');

await check('V09', 'a Pinned normal Note appears in Pinned', () => {
  useIndex([note('notes/p.md', { pinned: true })]);
  const v = view();
  return v.pinnedNotes.length === 1 && v.activeNotes.length === 1;
}, () => 'pinned derived');

await check('V10', 'a Pinned Knowledge Note appears in both Pinned and Knowledge', () => {
  useIndex([note('notes/pk.md', { pinned: true, knowledge: true })]);
  const v = view();
  return v.pinnedNotes.length === 1 && v.knowledgeNotes.length === 1 &&
    v.activeNotes.length === 1;
}, () => 'independent flags');

await check('V11', 'a Pinned Note is not repeated in the chronological list', () => {
  useIndex([note('notes/p.md', { pinned: true, date: '2026-03-01' })]);
  const v = view();
  return v.chronologicalNotes.length === 0 && v.datedGroups.length === 0 &&
    v.pinnedNotes.length === 1;
}, () => 'pinned excluded from chronology');

await check('V12', 'an Archived Note appears in no active projection', () => {
  useIndex([note('notes/a.md', { archived: true, date: '2026-03-01' })]);
  const v = view();
  return v.activeNotes.length === 0 && v.pinnedNotes.length === 0 &&
    v.knowledgeNotes.length === 0 && v.chronologicalNotes.length === 0 &&
    v.undatedNotes.length === 0 && v.archivedNotes.length === 1;
}, () => 'archived excluded everywhere');

await check('V13', 'archived + pinned appears in no active projection', () => {
  useIndex([note('notes/ap.md', { archived: true, pinned: true })]);
  const v = view();
  return v.activeNotes.length === 0 && v.pinnedNotes.length === 0 &&
    v.archivedNotes.length === 1;
}, () => 'archived wins over pinned');

await check('V14', 'archived + knowledge appears in no active projection', () => {
  useIndex([note('notes/ak.md', { archived: true, knowledge: true })]);
  const v = view();
  return v.activeNotes.length === 0 && v.knowledgeNotes.length === 0 &&
    v.archivedNotes.length === 1;
}, () => 'archived wins over knowledge');

await check('V15', 'source Note records are never mutated', () => {
  const records = [
    note('notes/a.md', { title: 'A', date: '2026-03-01' }),
    note('notes/p.md', { title: 'P', pinned: true }),
    note('notes/z.md', { title: 'Z', archived: true, knowledge: true }),
  ];
  const before = JSON.stringify(records);
  useIndex(records);
  view();
  view();
  O.renderWorkspaceNotesPanel();
  O.renderWorkspaceKnowledgePanel();
  return JSON.stringify(records) === before;
}, () => 'records byte-identical');

group('Title and physical identity (T16-T23)');

await check('T16', 'saved H1 is the primary title', () => {
  useIndex([note('notes/file.md', { title: 'Real H1' })]);
  O.renderWorkspaceNotesPanel();
  return notesHtml().includes('>Real H1<');
}, () => 'h1 rendered');

await check('T17', 'basename is the fallback title without H1', () => {
  useIndex([note('notes/no-here.md', { title: '' })]);
  O.renderWorkspaceNotesPanel();
  return notesHtml().includes('>no-here<');
}, () => 'basename fallback');

await check('T18', 'duplicate H1 entries remain separate', () => {
  useIndex([note('notes/alpha.md', { title: 'Shared' }),
    note('notes/beta.md', { title: 'Shared' })]);
  O.renderWorkspaceNotesPanel();
  return countRows(notesHtml()) === 2;
}, () => 'two rows');

await check('T19', 'duplicate H1 entries expose distinct physical identity', () => {
  useIndex([note('notes/alpha.md', { title: 'Shared' }),
    note('notes/beta.md', { title: 'Shared' })]);
  O.renderWorkspaceNotesPanel();
  const html = notesHtml();
  return html.includes('data-secondary="notes/alpha.md"') &&
    html.includes('data-secondary="notes/beta.md"');
}, () => 'path badges shown');

await check('T20', 'Unicode H1 is preserved', () => {
  useIndex([note('notes/u.md', { title: 'Título — 日本語 ✅' })]);
  O.renderWorkspaceNotesPanel();
  return notesHtml().includes('Título — 日本語 ✅');
}, () => 'unicode intact');

await check('T21', 'each row carries the exact click-contract attributes', () => {
  useIndex([note('notes/alpha.md', { title: 'A' })]);
  O.renderWorkspaceNotesPanel();
  const html = notesHtml();
  return html.includes('data-path="notes/alpha.md"') &&
    html.includes('data-name="alpha.md"') &&
    html.includes('data-kind="notes"') &&
    html.includes('data-workspace-file="1"');
}, () => 'click contract');

await check('T22', 'H1 is never used as navigation identity', () => {
  useIndex([note('notes/alpha.md', { title: 'Shared' })]);
  O.renderWorkspaceNotesPanel();
  const html = notesHtml();
  return !/data-title=/.test(html) && !/data-h1=/.test(html) &&
    /data-path="notes\/alpha\.md"/.test(html);
}, () => 'no title identity');

await check('T23', 'uppercase .MD fallback behaves consistently', () => {
  useIndex([note('notes/UPPER.MD', { title: '' })]);
  O.renderWorkspaceNotesPanel();
  const html = notesHtml();
  return html.includes('>UPPER<') && html.includes('data-path="notes/UPPER.MD"');
}, () => 'uppercase extension');

group('Grouping (G24-G28)');

await check('G24', 'dated Notes keep descending chronology', () => {
  useIndex([
    note('notes/a.md', { date: '2026-01-01' }),
    note('notes/b.md', { date: '2026-05-05' }),
    note('notes/c.md', { date: '2026-03-03' }),
  ]);
  O.renderWorkspaceNotesPanel();
  const paths = pathsIn(notesHtml());
  return paths[0] === 'notes/b.md' && paths[1] === 'notes/c.md' && paths[2] === 'notes/a.md';
}, () => 'newest first');

await check('G25', 'same-date ordering is deterministic', () => {
  const records = [note('notes/zz.md', { date: '2026-03-01' }),
    note('notes/aa.md', { date: '2026-03-01' })];
  useIndex(records);
  O.renderWorkspaceNotesPanel();
  const first = pathsIn(notesHtml()).join(',');
  useIndex([...records].reverse());
  O.renderWorkspaceNotesPanel();
  return first === 'notes/aa.md,notes/zz.md' && first === pathsIn(notesHtml()).join(',');
}, () => 'stable by name');

await check('G26', 'Undated appears after the dated groups', () => {
  useIndex([note('notes/u.md'), note('notes/2026-03-01.md', { date: '2026-03-01' })]);
  O.renderWorkspaceNotesPanel();
  const html = notesHtml();
  const paths = pathsIn(html);
  return html.indexOf('data-notes-group="dated"') < html.indexOf('data-notes-group="undated"') &&
    paths[paths.length - 1] === 'notes/u.md';
}, () => 'undated last');

await check('G27', 'Pinned order is deterministic and rendered first', () => {
  useIndex([
    note('notes/2026-03-01.md', { date: '2026-03-01' }),
    note('notes/p2.md', { pinned: true }),
    note('notes/p1.md', { pinned: true }),
  ]);
  O.renderWorkspaceNotesPanel();
  const html = notesHtml();
  const start = html.indexOf('data-notes-group="pinned"');
  const end = html.indexOf('data-notes-group="dated"');
  const pinnedPaths = pathsIn(html.slice(start, end));
  return start < end && pinnedPaths.join(',') === 'notes/p1.md,notes/p2.md';
}, () => 'pinned sorted by name');

await check('G28', 'no monthly-calendar behaviour is added', () => {
  useIndex([note('notes/2026-03-01.md', { date: '2026-03-01' })]);
  O.renderWorkspaceNotesPanel();
  return !/calendar/i.test(notesHtml()) &&
    !/function renderWorkspaceMonthCalendar/.test(MAIN_SOURCE);
}, () => 'no calendar');

group('Refresh (R29-R35)');

await check('R29', 'an unsaved H1 never changes the saved Sidebar title', () => {
  useIndex([note('notes/a.md', { title: 'Saved title' })]);
  O.renderWorkspaceNotesPanel();
  const before = notesHtml();
  // The editor buffer changes; the Index (and therefore the Sidebar) does not.
  O.renderWorkspaceNotesPanel();
  return notesHtml() === before && before.includes('>Saved title<');
}, () => 'title stable while unsaved');

await check('R30', 'a rebuilt Index (Save path) changes the Sidebar title', () => {
  useIndex([note('notes/a.md', { title: 'Saved title' })]);
  O.renderWorkspaceNotesPanel();
  useIndex([note('notes/a.md', { title: 'Edited title' })]);
  O.renderWorkspaceNotesPanel();
  return notesHtml().includes('>Edited title<') && !notesHtml().includes('>Saved title<');
}, () => 'title follows rebuild');

await check('R31', 'index-ready refresh is idempotent', () => {
  useIndex([note('notes/a.md', { title: 'A' }), note('notes/b.md', { title: 'B' })]);
  O.renderWorkspaceNotesPanel();
  const first = notesHtml();
  for (let i = 0; i < 4; i += 1) O.renderWorkspaceNotesPanel();
  return notesHtml() === first;
}, () => 'stable across repeated renders');

await check('R32', 'exactly one index-ready listener owns the refresh', () => {
  const guards = MAIN_SOURCE.match(/__mmeWorkspaceIndexReadyFinalizerBound/g) || [];
  return guards.length === 2 &&
    /window\.addEventListener\('mme-workspace-index-ready'/.test(MAIN_SOURCE);
}, () => 'single guarded registration');

await check('R33', 'rendering never triggers a recursive Index build', () => {
  useIndex([note('notes/a.md')]);
  const renderers =
    extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceNotesPanel() {') +
    extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceKnowledgePanel() {') +
    extractBlockFrom(MAIN_SOURCE, 'function buildWorkspaceNotesViewModel() {');
  return !/buildWorkspaceIndex|scheduleWorkspaceIndexRebuild|refreshWorkspaceNotesStorage/.test(renderers);
}, () => 'no rebuild from render');

await check('R34', 'rendering triggers no Workspace scan or file access', () => {
  const renderers =
    extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceNotesPanel() {') +
    extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceKnowledgePanel() {') +
    extractBlockFrom(MAIN_SOURCE, 'function buildWorkspaceNotesViewModel() {') +
    extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceNoteRowMarkup(note, options = {}) {');
  return !/(scanNotesFolder|getFileHandle|createWritable|getDirectoryHandle|\.getFile\s*\()/.test(renderers);
}, () => 'no filesystem access');

await check('R35', 'a newly created Today Note appears without a Workspace reopen', () => {
  // The real Today create path: the ACT 2C.1 refresh publishes the new file and
  // the real builder produces the record, so the Sidebar sees it immediately.
  useIndex([]);
  O.renderWorkspaceNotesPanel();
  const emptyHtml = notesHtml();

  const today = new Date();
  const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate()
  ).padStart(2, '0')}`;

  useIndex([note(`notes/${stamp}.md`, { title: stamp, date: stamp })]);
  O.renderWorkspaceNotesPanel();

  return emptyHtml.includes('No notes') &&
    notesHtml().includes(`notes/${stamp}.md`);
}, () => 'today visible immediately');

group('Knowledge adaptation (K36-K40)');

await check('K36', 'the existing Concepts host now renders Knowledge', () => {
  useIndex([note('notes/k.md', { knowledge: true, title: 'K' })]);
  O.renderWorkspaceKnowledgePanel();
  return knowledgeHtml().includes('>K<') && knowledgeHtml().includes('data-path="notes/k.md"') &&
    Boolean(dom.workspaceConceptsList);
}, () => 'concepts host reused');

await check('K37', 'no physical concepts collection is consumed', () => {
  const renderer = extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceKnowledgePanel() {');
  return !/files\.concepts|folders\.concepts|concepts\//.test(renderer) &&
    /buildWorkspaceNotesViewModel/.test(renderer);
}, () => 'derived from notes');

await check('K38', 'Knowledge owns no second store', () => {
  const knowledge = extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceKnowledgePanel() {') +
    extractBlockFrom(MAIN_SOURCE, 'function buildWorkspaceNotesViewModel() {');
  return !/WORKSPACE_STATE\.[a-zA-Z.]*=\s/.test(knowledge) &&
    !/KNOWLEDGE_STATE|knowledgeNotes\s*=/.test(knowledge.replace(/const knowledgeNotes = [^;]+;/, ''));
}, () => 'no authoritative array');

await check('K39', 'no Promote/Remove Knowledge action is introduced', () => {
  return !/promoteToKnowledge|removeKnowledge|setKnowledge|toggleKnowledge/i.test(MAIN_SOURCE) &&
    !/data-action="knowledge/i.test(notesHtml());
}, () => 'no knowledge actions');

await check('K40', 'Named Note is the Knowledge/Note creation workflow, not New Concept', () => {
  // ACT 4 froze New Concept as a disabled placeholder. ACT 5 replaced that
  // placeholder with the real Named Note entry point, so the control is now
  // enabled and opens the modal. What must NOT come back is the legacy
  // createNewConcept() concepts/ path.
  const enabledNewNote =
    /id="btnNewConcept"[\s\S]{0,400}?>/.test(INDEX_HTML) &&
    !/id="btnNewConcept"[\s\S]{0,400}?disabled/.test(INDEX_HTML) &&
    /class="workspaceLabel">New Note</.test(INDEX_HTML);
  const wiredToNamedNote = /onNewConcept: openNamedNoteModal/.test(CONTROLLER_SOURCE);
  const legacyConceptPathNotWired = !/onNewConcept: createNewConcept/.test(CONTROLLER_SOURCE);
  return enabledNewNote && wiredToNamedNote && legacyConceptPathNotWired;
}, () => 'named note creation entry');

group('Active panel (A41-A44)');

const ACTIVE_PANEL = extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceActivePanel() {');

await check('A41', 'Active uses the saved H1 title, not a live one', () => {
  return /parsed\?\.title \|\| active\.name/.test(ACTIVE_PANEL) &&
    !/getCurrentDocumentScope/.test(ACTIVE_PANEL) && !/md\.value/.test(ACTIVE_PANEL);
}, () => 'saved title only');

await check('A42', 'Active exposes the physical path/filename', () => {
  return /active\.path \|\| active\.name/.test(ACTIVE_PANEL);
}, () => 'physical identity shown');

await check('A43', 'Active Note kind renders as Note, not Journal/Concept', () => {
  const label = extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceKindLabel(kind) {');
  return /if \(normalized === 'notes'\) return 'Note';/.test(label) &&
    !/getWorkspaceKindLabel\('journals'\)|getWorkspaceKindLabel\('concepts'\)/.test(ACTIVE_PANEL);
}, () => 'kind = Note');

await check('A44', 'Active navigation remains path-based', () => {
  const clickOwner = extractBlockFrom(CONTROLLER_SOURCE, 'function handleSidebarClick(event) {');
  return /WORKSPACE_STATE\.files\?\.notes/.test(clickOwner) &&
    /file\.path === path/.test(clickOwner) &&
    !/title/.test(clickOwner);
}, () => 'resolved by exact path');

group('Archive panel collapse (C54-C61)');

  // The Archive panel header, toggle key, aria state, persisted key and
  // delegated click wiring are all shared with the working Notes (journals) and
  // Knowledge (concepts) panels. The bug was that the two collapse OWNERS were
  // never extended to the new panel: toggleWorkspacePanel() had no 'archive'
  // branch, so the click resolved to null and returned before touching state,
  // and WORKSPACE_PANEL_DEFAULT_COLLAPSED had no 'archive' key, so no persisted
  // state existed to restore. These fixtures execute the real shipped owners
  // against a minimal DOM double, including repeated collapse/expand, an Index
  // rebuild (a re-render) and a simulated reopen (state re-read from storage).
  const COLLAPSE_SNIPPETS = [
    extractBlockFrom(MAIN_SOURCE, 'const WORKSPACE_PANEL_COLLAPSE_STORAGE_KEY ='),
    extractBlockFrom(MAIN_SOURCE, 'function getWorkspacePanelCollapsedState() {'),
    extractBlockFrom(MAIN_SOURCE, 'function setWorkspacePanelCollapsedState(panelId, collapsed) {'),
    extractBlockFrom(MAIN_SOURCE, 'function isWorkspacePanelCollapsed(panelId) {'),
    extractBlockFrom(MAIN_SOURCE, 'function applyWorkspacePanelCollapsed(panelEl, panelId, collapsed) {'),
    extractBlockFrom(MAIN_SOURCE, 'function toggleWorkspacePanel(panelId) {'),
  ].join('\n\n');

  function makeCollapseHarness() {
    // Survives "reopen": storage is a plain object, so a fresh owner instance
    // reading the same store reproduces the post-reopen state.
    const store = {};
    const makePanel = (id, toggleKey) => {
      const btn = {
        attrs: { 'aria-expanded': 'true' },
        dataset: { workspacePanelToggle: toggleKey },
        setAttribute(k, v) {
          this.attrs[k] = v;
        },
      };
      const panel = {
        id,
        classes: new Set(),
        dataset: {},
        btn,
        classList: {
          toggle(name, on) {
            if (on) panel.classes.add(name);
            else panel.classes.delete(name);
          },
          contains(name) {
            return panel.classes.has(name);
          },
        },
        querySelector(sel) {
          return sel === '[data-workspace-panel-toggle]' ? btn : null;
        },
        // Real Element.contains() is a classList check here, matching how the
        // shipped owner reads the collapsed state.
        contains(name) {
          return panel.classes.has(name);
        },
      };
      return panel;
    };

    const panels = {
      journals: makePanel('workspaceJournalsPanel', 'journals'),
      concepts: makePanel('workspaceConceptsPanel', 'concepts'),
      archive: makePanel('workspaceArchivePanel', 'archive'),
    };

    const documentDouble = {
      getElementById(id) {
        return Object.values(panels).find((p) => p.id === id) || null;
      },
    };
    const localStorageDouble = {
      getItem(k) {
        return k in store ? store[k] : null;
      },
      setItem(k, v) {
        store[k] = String(v);
      },
    };

    const makeOwner = () =>
      new Function(
        'document',
        'localStorage',
        'log',
        `${COLLAPSE_SNIPPETS}\n  return {
          toggleWorkspacePanel,
          applyWorkspacePanelCollapsed,
          isWorkspacePanelCollapsed,
        };`
      )(documentDouble, localStorageDouble, () => {});

    return { store, panels, makeOwner };
  }

  const harness = makeCollapseHarness();
  const collapseOwner = harness.makeOwner();
  const archivePanel = harness.panels.archive;

  await check('C54', 'the Archive panel has the same header contract as Notes/Knowledge', () => {
    const at = (id) => INDEX_HTML.slice(INDEX_HTML.indexOf(id), INDEX_HTML.indexOf(id) + 1200);
    const archiveBlock = at('id="workspaceArchivePanel"');
    const journalsBlock = at('id="workspaceJournalsPanel"');
    return (
      /data-workspace-panel-toggle="archive"/.test(archiveBlock) &&
      /aria-expanded="true"/.test(archiveBlock) &&
      /workspacePanelHeaderButton/.test(archiveBlock) &&
      /workspacePanelChevron/.test(archiveBlock) &&
      /workspacePanelBody/.test(archiveBlock) &&
      /id="workspaceArchiveBadge"/.test(archiveBlock) &&
      /data-workspace-panel-toggle="journals"/.test(journalsBlock)
    );
  }, () => 'header, chevron, badge, aria');

  await check('C55', 'toggleWorkspacePanel resolves the Archive panel element', () => {
    // The exact defect: this returned null before the fix, so the click was a
    // silent no-op and the panel never collapsed at all.
    collapseOwner.toggleWorkspacePanel('archive');
    return (
      archivePanel.classes.has('workspacePanelCollapsed') &&
      archivePanel.dataset.collapsed === '1' &&
      archivePanel.btn.attrs['aria-expanded'] === 'false'
    );
  }, () => 'null -> workspaceArchivePanel');

  await check('C56', 'Archive expands again, repeatedly, without drift', () => {
    for (let i = 0; i < 3; i += 1) {
      collapseOwner.toggleWorkspacePanel('archive'); // expand
      if (archivePanel.classes.has('workspacePanelCollapsed')) return false;
      if (archivePanel.btn.attrs['aria-expanded'] !== 'true') return false;
      collapseOwner.toggleWorkspacePanel('archive'); // collapse
      if (!archivePanel.classes.has('workspacePanelCollapsed')) return false;
      if (archivePanel.btn.attrs['aria-expanded'] !== 'false') return false;
    }
    return archivePanel.dataset.collapsed === '1';
  }, () => '3 collapse/expand cycles');

  await check('C57', 'Archive does not disturb the Notes or Knowledge panels', () => {
    const journalsBefore = harness.panels.journals.contains('workspacePanelCollapsed');
    const conceptsBefore = harness.panels.concepts.contains('workspacePanelCollapsed');
    collapseOwner.toggleWorkspacePanel('archive');
    collapseOwner.toggleWorkspacePanel('archive');
    return (
      harness.panels.journals.contains('workspacePanelCollapsed') === journalsBefore &&
      harness.panels.concepts.contains('workspacePanelCollapsed') === conceptsBefore
    );
  }, () => 'panels are independent');

  await check('C58', 'the collapsed state is persisted under the archive key', () => {
    // Make the precondition explicit instead of assuming the shared harness
    // state, so this fixture cannot silently depend on the toggle parity left
    // behind by C56/C57.
    if (!collapseOwner.isWorkspacePanelCollapsed('archive')) {
      collapseOwner.toggleWorkspacePanel('archive'); // -> collapsed
    }
    if (!archivePanel.classes.has('workspacePanelCollapsed')) return false;
    const raw = harness.store['markmap:workspace:panelCollapsed'];
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed.archive === true && 'journals' in parsed && 'concepts' in parsed;
  }, () => 'localStorage archive:true');

  await check('C59', 'archive has a default collapsed key like the other panels', () => {
    const defaults = extractBlockFrom(
      MAIN_SOURCE,
      'const WORKSPACE_PANEL_DEFAULT_COLLAPSED = {',
      '};'
    );
    return (
      /archive:\s*false/.test(defaults) &&
      /journals:\s*false/.test(defaults) &&
      /concepts:\s*false/.test(defaults)
    );
  }, () => 'default key present');

  await check('C60', 'an Index rebuild re-applies the persisted Archive state', () => {
    // A rebuild re-renders the panel, which previously left the class untouched.
    archivePanel.classes.delete('workspacePanelCollapsed');
    archivePanel.dataset.collapsed = '0';
    archivePanel.btn.attrs['aria-expanded'] = 'true';
    collapseOwner.applyWorkspacePanelCollapsed(
      archivePanel,
      'archive',
      collapseOwner.isWorkspacePanelCollapsed('archive')
    );
    return (
      archivePanel.classes.has('workspacePanelCollapsed') &&
      archivePanel.btn.attrs['aria-expanded'] === 'false'
    );
  }, () => 'stays collapsed after rebuild');

  await check('C61', 'a Workspace reopen restores the collapsed Archive', () => {
    // Fresh owner + same storage = post-reopen state.
    const reopened = harness.makeOwner();
    const reopenedPanel = harness.panels.archive;
    reopenedPanel.classes.delete('workspacePanelCollapsed');
    reopenedPanel.btn.attrs['aria-expanded'] = 'true';
    const collapsed = reopened.isWorkspacePanelCollapsed('archive');
    reopened.applyWorkspacePanelCollapsed(reopenedPanel, 'archive', collapsed);
    return (
      collapsed === true &&
      reopenedPanel.classes.has('workspacePanelCollapsed') &&
      reopenedPanel.btn.attrs['aria-expanded'] === 'false'
    );
  }, () => 'reopen restores collapsed');

  await check('C62', 'the Archive renderer restores persisted state on every render', () => {
    // renderWorkspaceArchivePanel() must re-apply the state, otherwise the class
    // set by a click is lost on the next Index rebuild.
    const renderer = extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceArchivePanel() {');
    const applyIdx = renderer.indexOf('applyWorkspacePanelCollapsed(');
    const badgeIdx = renderer.indexOf('view.archivedNotes.length');
    const emptyIdx = renderer.indexOf('No archived notes');
    return (
      /isWorkspacePanelCollapsed\('archive'\)/.test(renderer) &&
      applyIdx !== -1 &&
      applyIdx < badgeIdx &&
      applyIdx < emptyIdx
    );
  }, () => 'restore precedes every return');

  await check('C63', 'hasWorkspacePanelMarkup recognizes the Archive panel', () => {
    const owner = extractBlockFrom(MAIN_SOURCE, 'function hasWorkspacePanelMarkup(panelId) {');
    return (
      /panelId === 'archive'/.test(owner) &&
      /workspaceArchivePanel/.test(owner) &&
      /data-workspace-panel-toggle/.test(owner)
    );
  }, () => 'markup contract recognized');

  await check('C64', 'the delegated click wiring reaches the Archive toggle', () => {
    const handler = extractBlockFrom(
      MAIN_SOURCE,
      'function handleWorkspacePanelCollapseClick(event) {'
    );
    const wiring = extractBlockFrom(MAIN_SOURCE, 'function wireWorkspacePanelCollapses() {');
    return (
      /data-workspace-panel-toggle/.test(handler) &&
      /toggleWorkspacePanel\(panelId\)/.test(handler) &&
      /addEventListener\('click', handleWorkspacePanelCollapseClick\)/.test(wiring)
    );
  }, () => 'delegated click intact');

  await check('C65', 'collapse styling is generic, so Archive needs no special CSS', () =>
    /\.workspacePanelCollapsed \.workspacePanelBody/.test(CSS_SOURCE) &&
    /\.workspacePanelCollapsed \.workspacePanelChevron/.test(CSS_SOURCE) &&
    !/#workspaceArchivePanel\.workspacePanelCollapsed/.test(CSS_SOURCE),
  () => 'shared rules cover Archive');

  group('Safety and non-touch (S45-S53)');

const ACT4_SOURCES = MAIN_SOURCE + CONTROLLER_SOURCE + INDEX_HTML + CSS_SOURCE;

await check('S45', 'no file write or metadata write is introduced', () => {
  const act4 =
    extractBlockFrom(MAIN_SOURCE, 'function buildWorkspaceNotesViewModel() {') +
    extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceNotesPanel() {') +
    extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceKnowledgePanel() {') +
    extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceNoteRowMarkup(note, options = {}) {');
  return !/createWritable|writeFile|setFrontmatter|writeFrontmatter|removeManagedKey/.test(act4) &&
    !/function (setFrontmatter|writeFrontmatter|removeManagedKey)/.test(ACT4_SOURCES);
}, () => 'no writer');

await check('S46', 'no file move and no removeEntry is introduced', () => {
  // Comments are stripped first: a prose word like "removed" must not be
  // mistaken for a filesystem API call.
  const act4 = stripComments(
    extractBlockFrom(MAIN_SOURCE, 'function buildWorkspaceNotesViewModel() {') +
    extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceNotesPanel() {') +
    extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceKnowledgePanel() {')
  );
  return !/\bremoveEntry\b|\bmove\b|\brename\b|\bcreateWritable\b/.test(act4) &&
    !/removeEntry/.test(CSS_SOURCE);
}, () => 'no filesystem mutation');

await check('S47', 'no Wiki Link rewrite', () => {
  return !/conceptLinks\s*=|normalizeConceptName\s*\(/.test(
    extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceNoteRowMarkup(note, options = {}) {')
  );
}, () => 'links untouched');

await check('S48', 'no Current Document scope mutation', () => {
  return !/getCurrentDocumentScope|logDocumentScopes/.test(
    extractBlockFrom(MAIN_SOURCE, 'function buildWorkspaceNotesViewModel() {') +
    extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceNotesPanel() {') +
    extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceKnowledgePanel() {')
  );
}, () => 'act3 scopes untouched');

await check('S49', 'no Tasks/Projects/Report changes', () => {
  const owners = [
    'function renderWorkspaceTasksPanel', 'function renderWorkspaceProjectsPanel',
    'function renderWorkspaceRelatedPanel', 'function openVirtualReport',
  ];
  return owners.every((m) => MAIN_SOURCE.indexOf(m) !== -1) &&
    !/renderWorkspace(Tasks|Projects|Related)Panel/.test(
      extractBlockFrom(MAIN_SOURCE, 'function buildWorkspaceNotesViewModel() {') +
      extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceNotesPanel() {') +
      extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceKnowledgePanel() {')
    );
}, () => 'other panels untouched');

await check('S50', 'no version, cache or Service Worker change', () => {
  const parity = runNode('scripts/release-parity.cjs');
  return /RELEASE PARITY OK/.test(parity) && parity.includes(APP_VERSION_BASELINE) &&
    !/ACT 4/.test(read('sw.js'));
}, () => 'identity unchanged');

await check('S51', 'the Sidebar host was adapted, not recreated', () => {
  return /id="workspaceJournalsPanel"/.test(INDEX_HTML) &&
    /id="workspaceConceptsPanel"/.test(INDEX_HTML) &&
    /data-workspace-panel-toggle="journals"/.test(INDEX_HTML) &&
    /data-workspace-panel-toggle="concepts"/.test(INDEX_HTML) &&
    /id="workspaceJournalsList"/.test(INDEX_HTML) &&
    /id="workspaceConceptsList"/.test(INDEX_HTML) &&
    /workspaceJournalsList|workspaceConceptsList/.test(CONTROLLER_SOURCE);
}, () => 'hosts reused');

await check('S52', 'Journal mode is not removed', () => {
  return /journal/i.test(INDEX_HTML) && !/removeJournalMode|deleteJournalMode/.test(ACT4_SOURCES);
}, () => 'journal retained');

await check('S53', 'no Rename File, no extra writer and no Project syntax change', () => {
  // ACT 4 froze this while creation was deferred. ACT 5 added Named Note
  // creation and ACT 6 added exactly one managed writer, so what must still
  // hold is: no Rename File, exactly one writer, and no Project syntax change.
  const writers = (MAIN_SOURCE + CONTROLLER_SOURCE).match(/function patchNoteMetadata\(/g) || [];
  return !/function renameFile|function renameNote/.test(ACT4_SOURCES) &&
    !/function (setFrontmatter|writeFrontmatter|removeManagedKey)/.test(ACT4_SOURCES) &&
    writers.length === 1 &&
    !/^## Project:/m.test(PARSER_SOURCE);
}, () => 'no rename, single writer, no project change');

const failed = results.filter((e) => !e.group && !e.ok);
const passed = results.filter((e) => !e.group && e.ok);

for (const e of results) {
  if (e.group) {
    console.log('\n' + e.group);
    continue;
  }
  console.log(`${e.ok ? 'PASS' : 'FAIL'} [${e.id}] ${e.name}${e.ok ? '' : ` — ${e.detail}`}`);
}

console.log(`\nWORKSPACE NOTES SIDEBAR VALIDATORS: ${passed.length} passed, ${failed.length} failed`);
process.exitCode = failed.length === 0 ? 0 : 1;
})().catch((error) => {
  console.error('WORKSPACE NOTES SIDEBAR VALIDATORS: harness error', error);
  process.exit(1);
});
