#!/usr/bin/env node
'use strict';

/**
 * ACT 2B — Task Review / Task Board / Projects / Index-projection consumer
 * preservation.
 *
 * Exercises the REAL shipped owners (package.json is type=module, so main.js
 * helpers are extracted verbatim and evaluated; nothing is re-implemented):
 *   - js/main.js (WORKSPACE_INDEX_STATE, buildWorkspaceIndex,
 *     getOpenWorkspaceTasks, getGroupedOpenWorkspaceTasks,
 *     getWorkspaceTaskFileDisplayName, renderWorkspaceTasksPanel legacy
 *     fallback, renderWorkspaceProjectsPanel, escapeHtml);
 *   - js/workspace/workspace-parser.js (saved Note parser, loaded verbatim);
 *   - js/workspace/workspace-controller.js
 *     (normalizeWorkspaceKindForCompare, the shared kind normalizer);
 *   - js/tasks/task-lifecycle.js (MME_TASK_LIFECYCLE, the shared Task
 *     lifecycle owner Task Review consumes);
 *   - js/workspace/workspace-index-document.js (MME_WORKSPACE_INDEX_DOCUMENT
 *     projection, loaded verbatim);
 *   - js/workspace/task-review.js (MME_TASK_REVIEW, loaded verbatim, including
 *     its own shipped runValidator);
 *   - js/tasks/task-board.js (MME_TASK_BOARD, loaded verbatim, including its
 *     own shipped runValidator).
 *
 * ACT 2B is a PRESERVATION act. It removes the retired journals/concepts kind
 * split from the Task and Projects consumers and from the Index projection. It
 * must not improve a feature, and it must not touch Notes creation, the
 * Sidebar redesign, metadata writing, the journal timeline, Report mode or
 * Projects metadata. The Y-series asserts those boundaries.
 *
 * 62 fixtures: N01-N14 Task Review, D14-D23 Index projection, P24-P33
 * Projects, B34-B40 Task Board, Y41-Y48 cross-consumer / read-only guards, X01-X13
 * Task Review escapeHtml preflight.
 *
 * Usage: node scripts/workspace-task-consumers-validators.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MAIN_PATH = path.join(ROOT, 'js', 'main.js');
const PARSER_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-parser.js');
const CONTROLLER_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-controller.js');
const LIFECYCLE_PATH = path.join(ROOT, 'js', 'tasks', 'task-lifecycle.js');
const INDEX_DOC_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-index-document.js');
const TASK_REVIEW_PATH = path.join(ROOT, 'js', 'workspace', 'task-review.js');
const TASK_BOARD_PATH = path.join(ROOT, 'js', 'tasks', 'task-board.js');

const MAIN_SOURCE = fs.readFileSync(MAIN_PATH, 'utf8');
const PARSER_SOURCE = fs.readFileSync(PARSER_PATH, 'utf8');
const CONTROLLER_SOURCE = fs.readFileSync(CONTROLLER_PATH, 'utf8');
const LIFECYCLE_SOURCE = fs.readFileSync(LIFECYCLE_PATH, 'utf8');
const INDEX_DOC_SOURCE = fs.readFileSync(INDEX_DOC_PATH, 'utf8');
const TASK_REVIEW_SOURCE = fs.readFileSync(TASK_REVIEW_PATH, 'utf8');
const TASK_BOARD_SOURCE = fs.readFileSync(TASK_BOARD_PATH, 'utf8');

const results = [];
function check(id, name, ok, detail) {
  results.push({ id, name, ok: Boolean(ok), detail: detail == null ? '' : String(detail) });
}
function group(title) {
  results.push({ group: title });
}

// Verbatim extraction of top-level main.js code (col-0 boundaries).
function extractBlockFrom(src, startMarker, endLine = '}') {
  const start = src.indexOf(startMarker);
  if (start === -1) return '';
  let lineStart = src.indexOf('\n', start);
  if (lineStart === -1) return '';
  lineStart += 1;
  while (lineStart <= src.length) {
    const nl = src.indexOf('\n', lineStart);
    const lineEnd = nl === -1 ? src.length : nl;
    const line = src.slice(lineStart, lineEnd);
    if (line === endLine) return src.slice(start, lineEnd);
    if (nl === -1) break;
    lineStart = nl + 1;
  }
  return '';
}

// ---- DOM + app shims -------------------------------------------------------
const harness = { logs: [], toasts: [] };
const dom = {};

function makeEl(id) {
  return {
    id,
    hidden: false,
    innerHTML: '',
    textContent: '',
    dataset: {},
    value: '',
    disabled: false,
    parentNode: null,
    // ACT 4B — the read-only chrome owner toggles a scope class on the panel, so
    // the stub element exposes a RECORDING classList: the fixtures assert the
    // class was really applied, not that a toggle method exists.
    classList: {
      __set: new Set(),
      toggle(cls, force) {
        const on = force === undefined ? !this.__set.has(cls) : Boolean(force);
        if (on) this.__set.add(cls);
        else this.__set.delete(cls);
        return on;
      },
      add(cls) { this.__set.add(cls); },
      remove(cls) { this.__set.delete(cls); },
      contains(cls) { return this.__set.has(cls); },
    },
    // ACT 4B — the delegated click owner must be CALLABLE by a fixture, so
    // listeners are recorded and can be dispatched with a synthetic event.
    listeners: {},
    addEventListener(type, fn) {
      (this.listeners[type] = this.listeners[type] || []).push(fn);
    },
    setAttribute() {},
    appendChild() {},
    removeChild() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; },
    contains() { return false; },
  };
}

function installShims() {
  const ids = [
    // Task Review panel
    'workspaceSidebar', 'workspaceTasksPanel', 'workspaceTasksBadge',
    'workspaceTasksSummary', 'workspaceTasksList', 'workspaceTaskSearchInput',
    'workspaceTaskStatusFilter', 'workspaceTaskPriorityFilter', 'workspaceTaskBoardBtn',
    // Projects panel
    'workspaceProjectsPanel', 'workspaceProjectsBadge', 'workspaceProjectsSummary',
    'workspaceProjectsList', 'workspaceProjectsOpenButton',
    // Misc collaborators referenced by the extracted consumers
    'workspaceRelatedPanel', 'workspaceActivePanel', 'workspaceActiveBadge',
    'workspaceActiveBody', 'workspaceTagResults', 'workspaceSearchInput',
    'workspaceSearchResults', 'workspaceRelatedList',
  ];
  for (const id of ids) dom[id] = makeEl(id);

  // The Sidebar scroller hosts the panels (Task Review discovers it this way).
  dom.workspaceSidebar.querySelector = function (sel) {
    return sel === ':scope > .workspaceNavScroller' ? makeEl('workspaceNavScroller') : null;
  };

  // ACT 4B — the shipped #workspaceTasksPanel carries exactly one static
  // section title (`.workspaceSectionTitle`), which is the read-only chrome's
  // title hook. The stub resolves it the same way the browser does.
  dom.workspaceTasksTitle = makeEl('workspaceTasksTitle');
  dom.workspaceTasksTitle.textContent = 'Open Tasks';
  dom.workspaceTasksPanel.querySelector = function (sel) {
    return sel === '.workspaceSectionTitle' ? dom.workspaceTasksTitle : null;
  };

  globalThis.document = {
    getElementById: (id) => dom[id] || null,
    createElement: (tag) => makeEl(`created-${tag}`),
    documentElement: { classList: { toggle() {}, add() {}, remove() {} } },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.window = globalThis;
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.requestAnimationFrame = (fn) => {
    if (typeof fn === 'function') fn();
    return 1;
  };
  globalThis.log = (m) => harness.logs.push(String(m));
  globalThis.showToast = (m, t, ms) => harness.toasts.push({ message: String(m), type: t, ms });
  globalThis.MME_APP = {
    log: (m) => harness.logs.push(String(m)),
    showToast: (m, t, ms) => harness.toasts.push({ message: String(m), type: t, ms }),
    openTextDocument: () => {},
    confirmDiscardIfDirty: () => true,
  };
  globalThis.getLocalIsoDate = () => '2026-09-26';
  // Sidebar collaborators used by the extracted Projects/Tasks renderers.
  globalThis.isWorkspacePanelCollapsed = () => false;
  globalThis.applyWorkspacePanelCollapsed = () => {};
  globalThis.forceUpgradeWorkspacePanelMarkup = () => {};
  globalThis.ensureWorkspaceProjectsPanel = () => dom.workspaceProjectsPanel;
  globalThis.ensureWorkspaceTasksPanel = () => dom.workspaceTasksPanel;
  // buildWorkspaceIndex ends with a fan-out to every Sidebar/Index renderer.
  // Those surfaces belong to the Sidebar redesign (deferred), so the fan-out
  // targets are defined as no-ops here; renderWorkspaceTasksPanel is NOT stubbed
  // because its ACT 2B edit is asserted (N13).
  globalThis.renderWorkspaceIndexSummary = () => {};
  globalThis.renderWorkspaceActivePanel = () => {};
  globalThis.renderWorkspaceRelatedPanel = () => {};
  globalThis.renderWorkspaceTagsPanel = () => {};
  globalThis.updateWorkspaceJournalSidebarTitlesFromIndex = () => {};
  globalThis.renderWorkspaceJournalTimeline = () => {};
  // Mutation-path collaborators (unused by these read-only fixtures, defined so
  // the verbatim modules resolve the same globals they do in the browser).
  globalThis.findWorkspaceFileByPath = () => null;
  globalThis.openWorkspaceFile = async () => {};
  globalThis.__cmGetLineText = () => '';
  globalThis.__cmReplaceLine = () => false;
  globalThis.saveSmart = async () => true;
  globalThis.MME_RENDER = { scheduleRender: () => {} };
  globalThis.persistActiveWorkspaceFile = () => {};
  globalThis.updateWorkspaceActiveFileHighlight = () => {};
  globalThis.getLastActiveFileKey = () => 'markmap:workspace:lastActiveFile';
  globalThis.getTaskCloseDate = () => '';
  globalThis.__cmScrollToLine = () => {};
  globalThis.__cmFocus = () => {};
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
}
installShims();

function evalVerbatim(sources) {
  const combined = sources
    .map((src) => {
      if (!src) throw new Error('verbatim extraction failed');
      return src;
    })
    .join('\n\n');
  (0, eval)(combined);
}

// ---- Load the real modules, verbatim ---------------------------------------

// Shared kind normalizer (workspace-controller.js). It is a bare top-level
// function in an ES module, so the same verbatim-extraction approach is used.
evalVerbatim([extractBlockFrom(CONTROLLER_SOURCE, 'function normalizeWorkspaceKindForCompare(')]);
if (typeof globalThis.normalizeWorkspaceKindForCompare !== 'function') {
  throw new Error('normalizeWorkspaceKindForCompare not extracted');
}

// The saved Note parser (js/workspace/workspace-parser.js) is a self-contained
// module but, by design, owns no text helpers: it calls the main.js text
// helpers by bare global name. Those helpers are extracted verbatim (the same
// set the ACT 1C/2A suites use) and published as globals before the parser is
// loaded, so the parser runs against the real implementations.
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

// The saved Note parser owns parseWorkspaceDocument; main.js calls it as a
// bare global, so re-publish it after the verbatim module load.
evalVerbatim(PARSER_HELPERS.map((m) => extractBlockFrom(MAIN_SOURCE, m)));
(0, eval)(PARSER_SOURCE);
if (typeof globalThis.parseWorkspaceDocument !== 'function') {
  throw new Error('parseWorkspaceDocument not exposed by parser module');
}

// main.js helpers used by the Task/Project consumers, evaluated together so
// they share one lexical scope exactly as the browser script does.
const api = new Function(
  [
    extractBlockFrom(MAIN_SOURCE, 'function escapeHtml(str) {'),
    extractBlockFrom(MAIN_SOURCE, 'const WORKSPACE_INDEX_STATE = {', '};'),
    extractBlockFrom(MAIN_SOURCE, 'try {\n  window.WORKSPACE_INDEX_STATE', '} catch {}'),
    extractBlockFrom(MAIN_SOURCE, 'async function readWorkspaceFileText('),
    extractBlockFrom(MAIN_SOURCE, 'async function buildWorkspaceIndex('),
    extractBlockFrom(MAIN_SOURCE, 'function getOpenWorkspaceTasks('),
    extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceTaskFileDisplayName('),
    extractBlockFrom(MAIN_SOURCE, 'function getGroupedOpenWorkspaceTasks('),
    extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceKindLabel('),
    extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceKindIcon('),
  ].join('\n\n') +
    '\nreturn {\n' +
    '  escapeHtml,\n' +
    '  WORKSPACE_INDEX_STATE,\n' +
    '  buildWorkspaceIndex,\n' +
    '  getOpenWorkspaceTasks,\n' +
    '  getWorkspaceTaskFileDisplayName,\n' +
    '  getGroupedOpenWorkspaceTasks,\n' +
    '  getWorkspaceKindLabel,\n' +
    '  getWorkspaceKindIcon,\n' +
    '};'
)();
Object.assign(globalThis, api);

// The legacy Workspace Tasks renderer is a top-level main.js function; it is
// loaded verbatim so the ACT 2B icon/grouping edit is covered in the same file
// that also owns the Task Review edit.
evalVerbatim([extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceTasksPanel(')]);
evalVerbatim([extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceProjectsPanel(')]);

// IIFE modules publishing an owner global: load verbatim.
(0, eval)(LIFECYCLE_SOURCE);
(0, eval)(INDEX_DOC_SOURCE);
(0, eval)(TASK_REVIEW_SOURCE);
(0, eval)(TASK_BOARD_SOURCE);

const DOC = globalThis.MME_WORKSPACE_INDEX_DOCUMENT;
const REVIEW = globalThis.MME_TASK_REVIEW;
const BOARD = globalThis.MME_TASK_BOARD;
const LIFECYCLE = globalThis.MME_TASK_LIFECYCLE;

if (!DOC || typeof DOC.buildProjection !== 'function') {
  throw new Error('MME_WORKSPACE_INDEX_DOCUMENT.buildProjection not exposed');
}
if (!REVIEW || typeof REVIEW.refresh !== 'function') {
  throw new Error('MME_TASK_REVIEW not exposed');
}
if (!BOARD || typeof BOARD.cardHtml !== 'function') {
  throw new Error('MME_TASK_BOARD not exposed');
}
if (!LIFECYCLE || typeof LIFECYCLE.effectiveStatusOf !== 'function') {
  throw new Error('MME_TASK_LIFECYCLE not exposed');
}

// ---- Fixture ---------------------------------------------------------------
//
// Five saved Notes, all in notes/:
//   Architecture.md  two open Tasks, a body tag, a Wiki Link
//   Deployment.md    the SAME H1 as Architecture.md (records must stay
//                    distinct) plus one completed Task and a backlink
//   Glossary.md      Knowledge-classified Note carrying a Project block
//   2026-09-25.md    dated + Pinned Note (classification stays a field)
//   Old.md           archived Note (still indexed, not a bucket)

function makeHandle(name, content) {
  return {
    kind: 'file',
    name,
    async getFile() {
      return { text: async () => content, size: String(content).length, lastModified: 0 };
    },
  };
}

const NOTE_SOURCES = {
  'notes/Architecture.md': {
    text: '# Architecture\n\nBody with #alpha #beta tags.\n\n- [ ] task one\n- [ ] task two\n\nSee [[Deployment]].\n',
  },
  'notes/Deployment.md': {
    text: '# Architecture\n\nDuplicate H1 on purpose. #beta only.\n\n- [x] done task\n\nRefs [[Architecture]].\n',
  },
  'notes/Glossary.md': {
    text: '---\nknowledge: true\n---\n# Glossary\n\nKnowledge note. #alpha\n\nProject: Rebrand\n\n- [ ] project task\n',
  },
  'notes/2026-09-25.md': {
    text: '---\ndate: 2026-09-25\npinned: true\n---\n# Daily\n\nPinned dated note. #alpha\n\n- [ ] daily task\n',
  },
  'notes/Old.md': {
    text: '---\narchived: true\n---\n# Old Note\n\nArchived note. #beta\n',
  },
};

const NOTE_PATHS = Object.keys(NOTE_SOURCES);

// WORKSPACE_STATE lives in js/workspace/workspace-state.js (ES module); seed an
// equivalent plain object holding the ACT 1B storage records, which is the only
// input buildWorkspaceIndex reads.
globalThis.WORKSPACE_STATE = { rootHandle: null, files: { notes: [] }, activeFile: null };

async function buildFixtureIndex() {
  WORKSPACE_STATE.rootHandle = { kind: 'directory', name: 'workspace' };
  WORKSPACE_STATE.files.notes = Object.keys(NOTE_SOURCES).map((p) => ({
    kind: 'notes',
    name: p.split('/').pop(),
    path: p,
    handle: makeHandle(p.split('/').pop(), NOTE_SOURCES[p].text),
  }));
  WORKSPACE_STATE.activeFile = null;
  harness.logs.length = 0;
  harness.toasts.length = 0;
  return buildWorkspaceIndex();
}

// ---- Assertion helpers -----------------------------------------------------
function taskListHtml() {
  return String(dom.workspaceTasksList.innerHTML || '');
}

function groupTitles() {
  const out = [];
  const re = /<span class="workspaceTaskGroupTitleText">([^<]*)<\/span>/g;
  let m;
  while ((m = re.exec(taskListHtml()))) out.push(m[1]);
  return out;
}

function indexProjection() {
  return String(DOC.buildProjection({}, new Set(), 'open'));
}

function sectionOf(html, id) {
  const re = new RegExp('<section class="wsIndexSection" id="' + id + '"[\\s\\S]*?</section>');
  return (html.match(re) || [''])[0];
}

function attrValues(html, attr) {
  const re = new RegExp(attr + '="([^"]*)"', 'g');
  const out = [];
  let m;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function resetTaskDom(status) {
  dom.workspaceTasksBadge.textContent = '';
  dom.workspaceTasksSummary.textContent = '';
  dom.workspaceTasksList.innerHTML = '';
  dom.workspaceTaskSearchInput.value = '';
  dom.workspaceTaskStatusFilter.value = status || 'all';
  dom.workspaceTaskPriorityFilter.value = 'all';
  REVIEW.setSearchQuery('');
  REVIEW.setPriorityFilter('all');
  REVIEW.setStatusFilter(status || 'all');
}

// ---- Suites ----------------------------------------------------------------
(async () => {
  await buildFixtureIndex();
  const IDX = globalThis.WORKSPACE_INDEX_STATE;

  group('Task Review / legacy Tasks panel (N01-N14)');

  check('N01', 'Index carries exactly one byKind bucket (notes)', (() => {
    const kinds = Object.keys(IDX.byKind);
    return kinds.length === 1 && kinds[0] === 'notes' && IDX.byKind.notes.length === 5;
  })(), 'byKind=' + JSON.stringify(Object.keys(IDX.byKind)));

  check('N02', 'every indexed record is a Note keyed by its exact path', (() => {
    const paths = IDX.byKind.notes.map((r) => r.path).sort();
    return IDX.byKind.notes.every((r) => r.kind === 'notes') &&
      IDX.byPath.size === 5 &&
      JSON.stringify(paths) === JSON.stringify(NOTE_PATHS.slice().sort());
  })(), 'byPath.size=' + IDX.byPath.size);

  check('N03', 'duplicate H1 Notes stay separate records', (() => {
    const a = IDX.byPath.get('notes/Architecture.md');
    const d = IDX.byPath.get('notes/Deployment.md');
    return Boolean(a && d) && a.title === d.title && a.path !== d.path;
  })(), 'same title, distinct paths');

  check('N04', 'open Tasks are enumerated from the Index', (() => {
    const open = getOpenWorkspaceTasks();
    return open.length === 4 && open.every((t) => t.fileKind === 'notes') &&
      open.every((t) => String(t.filePath).startsWith('notes/'));
  })(), 'open=' + getOpenWorkspaceTasks().length);

  check('N05', 'Task source display name prefers the parsed title',
    getWorkspaceTaskFileDisplayName('notes/Glossary.md', 'glossary.md') === 'Glossary',
    'title wins');

  check('N06', 'display name falls back when the path is unknown',
    getWorkspaceTaskFileDisplayName('notes/Nope.md', 'nope.md') === 'nope.md', 'fallback');

  check('N07', 'legacy grouping keeps every open Task, one group per path', (() => {
    const groups = getGroupedOpenWorkspaceTasks();
    const total = groups.reduce((n, g) => n + g.tasks.length, 0);
    return total === 4 && groups.length === 3 && groups.every((g) => g.kind === 'notes');
  })(), '4 tasks / 3 groups');

  check('N08', 'grouping is date descending then title ascending (journals-first retired)', (() => {
    const titles = getGroupedOpenWorkspaceTasks().map((g) => g.title);
    // Only notes/2026-09-25.md carries a date, so it sorts first; the rest keep
    // title-ascending order.
    return JSON.stringify(titles) === JSON.stringify(['Daily', 'Architecture', 'Glossary']);
  })(), JSON.stringify(getGroupedOpenWorkspaceTasks().map((g) => g.title)));

  check('N09', 'Tasks inside a group stay in line order', (() => {
    const arch = getGroupedOpenWorkspaceTasks().find((g) => g.path === 'notes/Architecture.md');
    return Boolean(arch) && arch.tasks.length === 2 && arch.tasks[0].line < arch.tasks[1].line;
  })(), 'line order');

  check('N10', 'Task Review groups by path and renders one Note icon', (() => {
    resetTaskDom('all');
    const html = taskListHtml();
    return groupTitles().length === 4 &&
      !html.includes('📝') && !html.includes('🧠') && html.includes('📄');
  })(), JSON.stringify(groupTitles()));

  check('N11', 'Task Review group and row identities are always kind=notes', (() => {
    const kinds = new Set(attrValues(taskListHtml(), 'data-kind'));
    return kinds.size === 1 && kinds.has('notes');
  })(), JSON.stringify([...new Set(attrValues(taskListHtml(), 'data-kind'))]));

  check('N12', 'Task Review badge/summary count the filtered Tasks', (() => {
    resetTaskDom('open');
    REVIEW.refresh();
    const openBadge = dom.workspaceTasksBadge.textContent === '4';
    const openSummary = String(dom.workspaceTasksSummary.textContent).includes('Showing 4 of 5');
    resetTaskDom('done');
    REVIEW.refresh();
    const doneBadge = dom.workspaceTasksBadge.textContent === '1';
    resetTaskDom('all');
    return openBadge && openSummary && doneBadge;
  })(), 'open=4 done=1 of 5');

  check('N13', 'legacy Workspace Tasks renderer delegates to Task Review', (() => {
    resetTaskDom('all');
    dom.workspaceTasksList.innerHTML = '';
    renderWorkspaceTasksPanel();
    return taskListHtml().length > 0 &&
      harness.logs.some((l) => l.includes('legacy renderer bypassed'));
  })(), 'delegation preserved');

  check('N14', 'no kind-conditional icon survives in the Task renderers', (() => {
    // Behaviour alone cannot catch this: with 'notes' as the only kind both
    // branches of a ternary would render the same glyph, so the retired branch is
    // asserted at the source level in both Task renderers.
    const renderers = TASK_REVIEW_SOURCE +
      extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceTasksPanel(');
    const iconLines = renderers
      .split('\n')
      .filter((l) => /\bicon\b\s*=/.test(l) && !/^\s*(\/\/|\*)/.test(l));
    return iconLines.length > 0 &&
      iconLines.every((l) => !/journals|concepts/.test(l));
  })(), 'single Note icon owner');

  group('Index document projection (D14-D23)');

  const projection = indexProjection();

  check('D14', 'projection has no retired Journals/Concepts sections',
    !projection.includes('workspaceIndexJournalsSection') &&
      !projection.includes('workspaceIndexConceptsSection'), 'sections retired');

  check('D15', 'Notes section is present and counts every Note', (() => {
    const sec = sectionOf(projection, 'workspaceIndexNotesSection');
    return sec.includes('Notes (5)') && sec.includes('aria-label="Notes"');
  })(), 'Notes (5)');

  check('D16', 'navigator links to Notes exactly once', (() => {
    const nav = (projection.match(/<nav class="wsIndexNavigator"[\s\S]*?<\/nav>/) || [''])[0];
    const notesLinks = attrValues(nav, 'href').filter((h) => h === '#workspaceIndexNotesSection');
    return notesLinks.length === 1 && !nav.includes('Journals') && !nav.includes('Concepts');
  })(), 'nav links');

  check('D17', 'Summary reports a single Notes metric', (() => {
    const summary = sectionOf(projection, 'workspaceIndexSummarySection');
    return summary.includes('Notes') && !summary.includes('Journals') &&
      !summary.includes('Concepts') &&
      /<div class="wsIndexMetricLabel">Notes<\/div>/.test(summary);
  })(), 'metric label');

  check('D18', 'Notes section is ordered by path descending', (() => {
    const paths = attrValues(sectionOf(projection, 'workspaceIndexNotesSection'), 'data-path');
    const sorted = paths.slice().sort((a, b) => b.localeCompare(a));
    return paths.length === 5 && JSON.stringify(paths) === JSON.stringify(sorted);
  })(), 'deterministic order');

  check('D19', 'every projected open-workspace-file action carries kind=notes', (() => {
    const buttons = projection.match(/data-action="open-workspace-file"[^>]*>/g) || [];
    const kinds = new Set(buttons.map((b) => (b.match(/data-kind="([^"]*)"/) || [, ''])[1]));
    return buttons.length > 0 && kinds.size === 1 && kinds.has('notes');
  })(), 'single kind');

  check('D20', 'Index document uses the single Note icon throughout',
    !projection.includes('📝') && !projection.includes('🧠'), 'no retired icons');

  check('D21', 'empty-workspace copy is Note-only', (() => {
    const saved = IDX.files;
    IDX.files = [];
    const html = indexProjection();
    IDX.files = saved;
    return html.includes('No Notes found in the workspace.') &&
      !html.includes('journals or concepts');
  })(), 'empty copy');

  check('D22', 'not-ready projection unchanged by ACT 2B', (() => {
    const before = IDX.ready;
    IDX.ready = false;
    const html = indexProjection();
    IDX.ready = before;
    return html.includes('wsIndexNotReady');
  })(), 'index not ready');

  check('D23', 'Index document does not rebuild or mutate the shared Index', (() => {
    const snapshot = () => JSON.stringify({
      files: IDX.files.length,
      byKind: IDX.byKind.notes.length,
      tasks: IDX.tasks.length,
      projects: IDX.projects.length,
      tags: [...IDX.tags.keys()].sort(),
      links: [...IDX.links.keys()].sort(),
    });
    const before = snapshot();
    DOC.buildProjection({}, new Set(), 'done');
    DOC.buildProjection({}, new Set(), 'open');
    return before === snapshot();
  })(), 'read-only projection');

  group('Projects (P24-P33)');

  const projectsSource = extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceProjectsPanel(');

  check('P24', 'Project discovered in a Note reaches the shared Index', (() => {
    return IDX.projects.length === 1 && IDX.projects[0].name === 'Rebrand' &&
      IDX.projects[0].sourcePath === 'notes/Glossary.md' &&
      IDX.projects[0].sourceKind === 'notes';
  })(), JSON.stringify(IDX.projects.map((p) => p.name)));

  check('P25', 'Projects panel renders the discovered Project', (() => {
    dom.workspaceProjectsList.innerHTML = '';
    renderWorkspaceProjectsPanel();
    return dom.workspaceProjectsBadge.textContent === '1' &&
      dom.workspaceProjectsSummary.textContent === '1 Project' &&
      dom.workspaceProjectsList.innerHTML.includes('Rebrand');
  })(), 'badge=' + dom.workspaceProjectsBadge.textContent);

  check('P26', 'Project row opens a notes/ source by path', (() => {
    const html = String(dom.workspaceProjectsList.innerHTML || '');
    return html.includes('data-path="notes/Glossary.md"') && html.includes('data-kind="notes"');
  })(), 'source identity');

  check('P27', 'Project renderer never reads the retired buckets',
    !/byKind\?\.journals|byKind\?\.concepts|files\?\.journals|files\?\.concepts/.test(projectsSource),
    'no retired bucket reads');

  check('P28', 'Project empty state renders exactly one message', (() => {
    const saved = IDX.projects;
    IDX.projects = [];
    dom.workspaceProjectsList.innerHTML = '';
    renderWorkspaceProjectsPanel();
    // The summary carries only the count; the human-readable message appears
    // once, in the list body. Asserting the ABSENCE of a duplicate is the
    // point of this fixture.
    const summary = dom.workspaceProjectsSummary.textContent;
    const list = dom.workspaceProjectsList.innerHTML;
    const occurrences =
      (String(summary).match(/No Projects found/g) || []).length +
      (String(list).match(/No Projects found/g) || []).length;
    const ok = summary === '0 Projects' &&
      list.includes('workspaceProjectsEmpty') &&
      occurrences === 1;
    IDX.projects = saved;
    return ok;
  })(), 'empty, single message');

  check('P29', 'Project not-ready state preserved', (() => {
    const before = IDX.ready;
    IDX.ready = false;
    dom.workspaceProjectsList.innerHTML = '';
    renderWorkspaceProjectsPanel();
    const ok = dom.workspaceProjectsSummary.textContent === 'Index not ready';
    IDX.ready = before;
    return ok;
  })(), 'not ready');

  check('P30', 'Project source resolution still uses the shared owners', (() => {
    // The click wiring lives in the sibling top-level function.
    const wiring = extractBlockFrom(MAIN_SOURCE, 'function wireWorkspaceProjectsPanel(');
    return /findWorkspaceFileByPath/.test(projectsSource + wiring) &&
      /openWorkspaceFile/.test(projectsSource + wiring);
  })(), 'same owners');

  check('P31', 'Project grouping and value rendering unchanged by ACT 2B',
    projectsSource.includes('Unscheduled') && projectsSource.includes('yearGroups') &&
      projectsSource.includes('p.value') && projectsSource.includes('p.currency'),
    'unscheduled/year groups + value/currency');

  check('P32', 'Project sort contract still scheduled-before-unscheduled', (() => {
    const block = extractBlockFrom(MAIN_SOURCE, 'projects.sort(function (a, b) {');
    return block.includes('orderA') && block.includes('validA && !validB') &&
      block.includes('a.sourcePath') && block.includes('a.sourceLine');
  })(), 'sort unchanged');

  check('P33', 'no alternative Project declaration syntax was introduced', (() => {
    // The canonical plan (section 11) keeps `## Project:` as a FUTURE syntax and
    // forbids frontmatter Projects. ACT 2B must not touch either.
    return !/projectFrontmatter|projectsFrontmatter/i.test(PARSER_SOURCE) &&
      !/^## Project:/m.test(PARSER_SOURCE);
  })(), 'Project syntax untouched');

  group('Task Board (B34-B40)');

  const boardByPath = new Map();
  for (const rec of IDX.byKind.notes) boardByPath.set(rec.path, rec);
  const noteTask = {
    text: 'Alpha Note',
    done: false,
    filePath: 'notes/Architecture.md',
    fileName: 'Architecture.md',
    fileKind: 'notes',
    line: 3,
  };

  check('B34', 'Task Board self-test validator still passes', (() => {
    const v = BOARD.validate();
    return v.ok === true && v.failed === 0;
  })(), 'MME_TASK_BOARD.validate()');

  check('B35', 'Task Board source label resolves from the shared Index byPath',
    BOARD.resolveSourceLabel(noteTask, boardByPath) === 'Architecture',
    'parsed title wins');

  check('B36', 'Task Board card carries Note path/kind identity', (() => {
    const html = BOARD.cardHtml(noteTask, 'todo', new Map());
    return html.includes('data-path="notes/Architecture.md"') &&
      html.includes('data-kind="notes"');
  })(), 'path + kind');

  check('B37', 'Task Board never branches on the retired kinds',
    !/kind === 'journals'|kind === 'concepts'/.test(TASK_BOARD_SOURCE), 'no retired kind branches');

  check('B38', 'Task Board carries no per-kind icon branch', (() => {
    // The Board labels a card with its resolved source label + priority badge;
    // ACT 2B removed the last kind-dependent icon from it.
    return !TASK_BOARD_SOURCE.includes('📝') && !TASK_BOARD_SOURCE.includes('🧠') &&
      !/=== 'journals'|=== 'concepts'/.test(TASK_BOARD_SOURCE);
  })(), 'no kind icon');

  check('B39', 'Task Board consumes the shared Index and never builds one',
    /WORKSPACE_INDEX_STATE/.test(TASK_BOARD_SOURCE) &&
      /index\?\.byPath/.test(TASK_BOARD_SOURCE) &&
      !/buildWorkspaceIndex\(/.test(TASK_BOARD_SOURCE), 'read-only consumer');

  check('B40', 'Task Board file comparator and column grouping are preserved', (() => {
    const sorted = BOARD.sortColumn([
      { id: 'c', filePath: 'notes/b/day.md', fileName: 'day.md', line: 3, text: 'Zebra' },
      { id: 'a', filePath: 'notes/a/week.md', fileName: 'week.md', line: 1, text: 'Alpha' },
      { id: 'b', filePath: 'notes/a/week.md', fileName: 'week.md', line: 2, text: 'Beta' },
    ], 'file');
    const columns = BOARD.groupTasks([noteTask, { ...noteTask, done: true }]);
    return sorted.map((t) => t.id).join('') === 'abc' &&
      columns.todo.length === 1 && columns.done.length === 1 &&
      columns.todo[0].filePath === 'notes/Architecture.md';
  })(), 'file comparator unchanged');

  group('Cross-consumer and read-only guards (Y41-Y48)');

  const CONSUMER_SOURCES = TASK_REVIEW_SOURCE + INDEX_DOC_SOURCE + TASK_BOARD_SOURCE;

  check('Y41', 'no Task/Index consumer rebuilds the shared Index', (() => {
    // A consumer may only ask the main.js scheduler for a rebuild; it must never
    // call the builder itself nor define a second builder.
    const withoutOwnerCalls = CONSUMER_SOURCES
      .replace(/globalThis\.scheduleWorkspaceIndexRebuild\(/g, '');
    return !/buildWorkspaceIndex\(/.test(withoutOwnerCalls) &&
      !/function buildWorkspaceIndex/.test(CONSUMER_SOURCES) &&
      !/function scheduleWorkspaceIndexRebuild/.test(CONSUMER_SOURCES);
  })(), 'no consumer-owned rebuild');

  check('Y42', 'no consumer introduced a frontmatter/metadata writer',
    !/setFrontmatter|writeFrontmatter|removeManagedKey/.test(CONSUMER_SOURCES), 'no metadata writer');

  check('Y43', 'Index document stays a pure projection (no I/O)',
    !/getDirectoryHandle\(|createWritable\(/.test(INDEX_DOC_SOURCE), 'no workspace I/O');

  check('Y44', 'the Index projection is the only Notes section owner', (() => {
    return (projection.match(/id="workspaceIndexNotesSection"/g) || []).length === 1 &&
      !/workspaceIndexJournalsSection|workspaceIndexConceptsSection/.test(INDEX_DOC_SOURCE);
  })(), 'single section');

  check('Y45', 'the ACT 2B runtime files keep no journals/concepts data-bucket access', (() => {
    const runtime = TASK_REVIEW_SOURCE + INDEX_DOC_SOURCE +
      extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceTasksPanel(') +
      extractBlockFrom(MAIN_SOURCE, 'function getGroupedOpenWorkspaceTasks(') +
      extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceProjectsPanel(') +
      extractBlockFrom(MAIN_SOURCE, 'function buildWorkspaceIndex(');
    return !/byKind[?.]*\.?journals|byKind[?.]*\.?concepts|files[?.]*\.?journals|files[?.]*\.?concepts/.test(runtime);
  })(), 'no bucket access in the migrated consumers');

  check('Y46', 'persisted panel-collapse payload keys are kept for old localStorage', (() => {
    const block = extractBlockFrom(MAIN_SOURCE, 'const WORKSPACE_PANEL_DEFAULT_COLLAPSED = {', '};');
    return /journals:\s*false/.test(block) && /concepts:\s*false/.test(block) &&
      /projects:\s*false/.test(block);
  })(), 'legacy keys retained');

  check('Y47', 'creation stays deferred while the Sidebar is adapted', (() => {
    // ACT 2B froze the Journal timeline AND New Concept creation. ACT 4 is the
    // authorized Sidebar migration, so only the CREATION side stays frozen:
    //   - New Concept must not read the notes/ collection (Named Note is ACT 5);
    //   - the retained renderWorkspaceJournalTimeline() name is now a thin
    //     delegating alias, so the real notes/ read lives in
    //     renderWorkspaceNotesPanel(), not in the legacy name.
    const creation = MAIN_SOURCE.indexOf('function createNewConcept(');
    const creationStillFrozen =
      creation === -1 ||
      !/files\?\.notes|byKind\?\.notes|byKind\.notes/.test(MAIN_SOURCE.slice(creation, creation + 600));

    const alias = MAIN_SOURCE.indexOf('function renderWorkspaceJournalTimeline() {');
    const aliasIsThinDelegation =
      alias !== -1 &&
      /^\s*renderWorkspaceNotesPanel\(\);\s*$/m.test(MAIN_SOURCE.slice(alias, alias + 400));

    const notesProjectionOwnsIt =
      /function renderWorkspaceNotesPanel\(\)/.test(MAIN_SOURCE) &&
      /function buildWorkspaceNotesViewModel\(\)/.test(MAIN_SOURCE);

    return creationStillFrozen && aliasIsThinDelegation && notesProjectionOwnsIt;
  })(), 'sidebar adapted; creation still legacy');

  check('Y48', 'no version, cache or Service Worker change slipped into ACT 2B', (() => {
    // Guarded by the repository diff, asserted here as the runtime-facing half:
    // the migrated consumers must not reference a build/cache identity.
    return !/CACHE_NAME|SERVICE_WORKER|APP_VERSION/.test(CONSUMER_SOURCES);
  })(), 'no cache identity in consumers');

  group('Task Review escapeHtml preflight (X01-X13)');

  // The shipped helper is extracted verbatim, so these assertions run against
  // the exact implementation Task Review interpolates with. Its closing brace is
  // indented (it is a module-private helper, not a top-level main.js function),
  // so the col-0 boundary used elsewhere does not apply here.
  const ESC = new Function(
    extractBlockFrom(TASK_REVIEW_SOURCE, 'function escapeHtml(str) {', '  }') +
      '\nreturn escapeHtml;'
  )();

  check('X01', 'ordinary text is unchanged',
    ESC('Architecture') === 'Architecture' && ESC('') === '' && ESC('a b, c. #tag') === 'a b, c. #tag',
    'plain passthrough');

  check('X02', 'Unicode is preserved byte for byte',
    ESC('Ünïcode — 日本語 ✅ 𝕏 Ünïcödé') === 'Ünïcode — 日本語 ✅ 𝕏 Ünïcödé',
    'unicode intact');

  check('X03', 'ampersand is escaped first (no double-decoding)', (() => {
    return ESC('&') === '&amp;' && ESC('&lt;') === '&amp;lt;' && ESC('&amp;') === '&amp;amp;';
  })(), 'ampersand first');

  check('X04', 'full HTML-significant mapping is applied', (() => {
    const raw = `<a href="x" title='y'>&`;
    const got = ESC(raw);
    return got === '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;';
  })(), ESC(`<a href="x" title='y'>&`));

  const SPECIAL_PATH = 'notes/Special.md';
  const SPECIAL_TITLE = `A & B <script>alert(1)</script> "q" 's'`;
  const SPECIAL_TASK = `5 < 6 & "x" 'y'`;
  const SPECIAL_TEXT = `# ${SPECIAL_TITLE}\n\n- [ ] ${SPECIAL_TASK}\n`;

  // Re-index with one HTML-bearing Note, then restore the original fixture.
  const restoreSnapshot = JSON.stringify({
    files: IDX.files.length,
    tasks: IDX.tasks.length,
  });
  NOTE_SOURCES[SPECIAL_PATH] = { text: SPECIAL_TEXT };
  await buildFixtureIndex();
  const SPECIAL_INDEX = globalThis.WORKSPACE_INDEX_STATE;
  const specialRec = SPECIAL_INDEX.byPath.get(SPECIAL_PATH);

  const indexSnapshot = () => JSON.stringify({
    files: SPECIAL_INDEX.files.length,
    byKind: SPECIAL_INDEX.byKind.notes.length,
    tasks: SPECIAL_INDEX.tasks.length,
    tags: [...SPECIAL_INDEX.tags.keys()].sort(),
  });
  const beforeRender = indexSnapshot();

  resetTaskDom('all');
  REVIEW.refresh();
  const specialHtml = taskListHtml();
  const specialTitles = groupTitles();

  check('X05', 'an HTML-like Note title is rendered as text, never interpreted', (() => {
    return specialRec.title === SPECIAL_TITLE &&
      specialHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;') &&
      !specialHtml.includes('<script>') &&
      !/onerror=/.test(specialHtml);
  })(), 'title escaped');

  check('X06', 'HTML-like Task text is rendered as text', (() => {
    const rows = [];
    const re = /<span class="workspaceTaskRowText">([\s\S]*?)<\/span>/g;
    let m;
    while ((m = re.exec(specialHtml))) rows.push(m[1]);
    const escapedOnce = '5 &lt; 6 &amp; &quot;x&quot; &#39;y&#39;';
    // NOTE: renderPanel() escapes task.displayText, but enrichTask() has already
    // escaped it, so the shipped markup encodes Task text twice. That is a
    // pre-existing display defect, not an injection risk, and changing it is out
    // of ACT 2C scope. The property asserted here is the security one: the row
    // carries no live markup, whether the encoding is applied once or twice.
    const encode = (s) => String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const encodedTwice = encode(encode('5 < 6 & "x" \'y\''));
    return rows.some((r) => r === escapedOnce || r === encodedTwice) &&
      rows.every((r) => !/[<>]/.test(r)) &&
      !specialHtml.includes('<script>');
  })(), 'task text escaped');

  check('X07', 'Note path is unchanged by escaping', (() => {
    return specialHtml.includes('data-path="' + SPECIAL_PATH + '"') &&
      SPECIAL_INDEX.byPath.get(SPECIAL_PATH).path === SPECIAL_PATH;
  })(), 'exact path preserved');

  check('X08', 'navigation identity is unchanged', (() => {
    const kinds = new Set(attrValues(specialHtml, 'data-kind'));
    const groupHeaders = specialHtml.match(/data-workspace-task-group="1"/g) || [];
    return kinds.size === 1 && kinds.has('notes') && groupHeaders.length > 0;
  })(), 'path + kind identity intact');

  check('X09', 'ordering and grouping are unchanged', (() => {
    // Two distinct, pre-existing contracts must both still hold:
    //  - Task Review groups by path and orders title-ascending (its `date` field
    //    is intentionally never resolved there);
    //  - the legacy main.js grouping orders date-descending, then title.
    const taskReviewSorted = specialTitles.slice().sort();
    const legacy = getGroupedOpenWorkspaceTasks().map((g) => g.title);
    return specialTitles.length === 5 &&
      JSON.stringify(specialTitles) === JSON.stringify(taskReviewSorted) &&
      legacy[0] === 'Daily' &&
      SPECIAL_INDEX.byPath.get('notes/2026-09-25.md').date === '2026-09-25';
  })(), JSON.stringify(specialTitles));

  check('X10', 'the stored Markdown is byte-identical', (() => {
    // Escaping is a render concern only: nothing rewrites the physical Note.
    return NOTE_SOURCES[SPECIAL_PATH].text === SPECIAL_TEXT &&
      SPECIAL_INDEX.byPath.get(SPECIAL_PATH).title === SPECIAL_TITLE;
  })(), 'source untouched');

  check('X11', 'rendering does not mutate the Workspace Index', (() => {
    return beforeRender === indexSnapshot();
  })(), 'read-only render');

  check('X12', 'Task lifecycle behaviour is unchanged', (() => {
    const v = REVIEW.validate();
    const open = LIFECYCLE.effectiveStatusOf(false, '');
    const done = LIFECYCLE.effectiveStatusOf(true, 'ongoing');
    return v.ok === true && v.failed === 0 && open === 'todo' && done === 'done';
  })(), 'lifecycle owner unchanged');

  // Restore the original fixture and prove the restore is exact.
  delete NOTE_SOURCES[SPECIAL_PATH];
  await buildFixtureIndex();
  check('X13', 'fixture restore is exact after the escaping probe',
    JSON.stringify({ files: IDX.files.length, tasks: IDX.tasks.length }) === restoreSnapshot,
    'probe was non-destructive');

  // ---- ACT 4B FINAL POLISH: the RENDERED Current Document panel -------------
  //
  // The N/X fixtures above prove the Workspace (saved-Index) consumer is
  // unchanged. The fixtures below render the REAL Task Review owner in its
  // CURRENT-DOCUMENT scope and assert what the panel actually RENDERS and what
  // a real click actually CALLS — the read-only contract, the local line
  // navigation and the honest zero.

  group('ACT 4B FINAL POLISH — read-only Current Document Task Review (P01-P11)');

  const LOCAL_TASKS = [
    { id: 't1', text: 'local one #p1', done: false, line: 5, filePath: '', fileName: 'note.md', fileKind: 'notes' },
    { id: 't2', text: 'local two', done: true, line: 9, filePath: '', fileName: 'note.md', fileKind: 'notes' },
  ];

  function scopeToLocalCurrentDocument(tasks) {
    REVIEW.setTaskScope(REVIEW.TASK_REVIEW_SCOPES.CURRENT_DOCUMENT, () => tasks);
    REVIEW.refresh();
  }

  function scopeToWorkspace() {
    REVIEW.setTaskScope(REVIEW.TASK_REVIEW_SCOPES.WORKSPACE, null);
  }

  resetTaskDom('all');
  scopeToLocalCurrentDocument(LOCAL_TASKS);
  const localHtml = taskListHtml();

  check('P01', 'CURRENT-DOCUMENT rows render READ-ONLY: no Workspace path, no mutation control',
    localHtml.includes('workspaceTaskRowReadonly') &&
    localHtml.includes('data-readonly="1"') &&
    !localHtml.includes('data-path=') &&
    !localHtml.includes('workspaceTaskStatusBtn') &&
    !localHtml.includes('workspaceTaskPriorityAction') &&
    !localHtml.includes('workspaceTaskOpenBtn') &&
    !localHtml.includes('data-kind=') &&
    localHtml.includes('workspaceTaskStatusState'),
    'readonly=' + localHtml.includes('workspaceTaskRowReadonly'));

  check('P02', 'CURRENT-DOCUMENT rows keep the priority badge visible (read-only, not hidden)',
    localHtml.includes('workspaceTaskPriorityBadge priority-p1') &&
    localHtml.includes('workspaceTaskRowText'),
    'badge kept');

  check('P03', 'CURRENT-DOCUMENT rows expose a local line control with the exact source line',
    localHtml.includes('workspaceTaskCurrentDocLine') &&
    localHtml.includes('data-current-document="1"') &&
    JSON.stringify(attrValues(localHtml, 'data-current-document-line')) === JSON.stringify(['5', '9']),
    JSON.stringify(attrValues(localHtml, 'data-current-document-line')));

  check('P04', 'CURRENT-DOCUMENT group heading is NOT a Workspace open control',
    localHtml.includes('workspaceTaskGroupHeading') &&
    localHtml.includes('data-workspace-task-group="0"') &&
    // no interactive group CONTROL is rendered in this scope at all
    !/<button[^>]*workspaceTaskGroupHeader/.test(localHtml) &&
    !/data-workspace-task-group="1"/.test(localHtml) &&
    !localHtml.includes('Open note.md'),
    'heading=' + localHtml.includes('workspaceTaskGroupHeading') +
      ' header=' + localHtml.includes('workspaceTaskGroupHeader') +
      ' groupAttr=' + localHtml.includes('data-workspace-task-group="0"') +
      ' openTitle=' + localHtml.includes('Open note.md'));

  check('P05', 'READ-ONLY chrome is APPLIED to the real panel: class, flag, title, Board action',
    dom.workspaceTasksPanel.classList.contains('workspaceTaskReviewReadonly') === true &&
    dom.workspaceTasksPanel.dataset.taskReviewReadonly === '1' &&
    dom.workspaceTasksTitle.textContent === 'Tasks in this Note' &&
    dom.workspaceTaskBoardBtn.disabled === true,
    'title=' + dom.workspaceTasksTitle.textContent);

  check('P06', 'CURRENT-DOCUMENT summary/badge state the local read-only contract',
    dom.workspaceTasksBadge.textContent === '2' &&
    dom.workspaceTasksSummary.textContent === '2 local tasks — read-only',
    JSON.stringify(dom.workspaceTasksSummary.textContent));

  check('P07', 'an empty Current Document is an AVAILABLE EMPTY, never a failure', (() => {
    resetTaskDom('all');
    scopeToLocalCurrentDocument([]);
    const html = taskListHtml();
    return dom.workspaceTasksBadge.textContent === '0' &&
      // ACT 4B (zero-state correction): ONE visible empty-state message only —
      // the BODY owns the canonical local text, the summary does not repeat it.
      dom.workspaceTasksSummary.textContent === '' &&
      html.includes('data-empty-state="tasks"') &&
      html.includes('No tasks.') &&
      // the read-only chrome survives the empty render
      dom.workspaceTasksPanel.classList.contains('workspaceTaskReviewReadonly') === true;
  })(), 'honest zero');

  check('P08', 'switching scope back to Workspace restores the accepted interactive surface',
    (() => {
      resetTaskDom('all');
      scopeToWorkspace();
      REVIEW.refresh();
      const html = taskListHtml();
      return html.includes('workspaceTaskStatusBtn') &&
        // the ROW's status control deep-links to the exact Task source (not just
        // the group header, which also carries a path)
        /class="workspaceTaskStatusBtn"[\s\S]{0,140}?data-path="notes\/Architecture\.md"/.test(html) &&
        /class="workspaceTaskOpenBtn"[\s\S]{0,140}?data-path="notes\/Architecture\.md"/.test(html) &&
        html.includes('workspaceTaskGroupHeader') &&
        !html.includes('workspaceTaskRowReadonly') &&
        dom.workspaceTasksPanel.classList.contains('workspaceTaskReviewReadonly') === false &&
        dom.workspaceTasksTitle.textContent === 'Open Tasks' &&
        dom.workspaceTaskBoardBtn.disabled === false &&
        !dom.workspaceTasksSummary.textContent.includes('read-only');
    })(),
    'workspace scope intact');

  // ---- ACT 4B FINAL POLISH: the local line-navigation CALL -------------------
  //
  // The click owner is the REAL delegated handler wired by wire(). It is
  // dispatched with a synthetic event whose target claims the local line
  // control, and the editors' navigation owner is a spy — so the fixture proves
  // the CALL, not the markup.

  resetTaskDom('all');
  scopeToLocalCurrentDocument(LOCAL_TASKS);

  const localNav = await (async () => {
    const handlers = dom.workspaceTasksPanel.listeners.click || [];
    const handler = handlers[handlers.length - 1];
    if (typeof handler !== 'function') return { error: 'no click handler wired' };

    const calls = [];
    const saved = {
      scroll: globalThis.__cmScrollToLine,
      focus: globalThis.__cmFocus,
      open: globalThis.MME_APP.openTextDocument,
    };
    let opened = 0;
    globalThis.__cmScrollToLine = (n) => calls.push(['scroll', n]);
    globalThis.__cmFocus = () => calls.push(['focus']);
    globalThis.MME_APP.openTextDocument = () => { opened += 1; };

    const clickOn = (selector, dataset) => {
      const target = {
        dataset: dataset || {},
        closest: (sel) => (sel === selector ? target : null),
      };
      return { target, preventDefault() {}, stopPropagation() {} };
    };
    const emptyPathLogs = () => harness.logs.filter((l) => l.includes('empty path')).length;

    harness.logs.length = 0;
    await handler(clickOn('.workspaceTaskCurrentDocLine', { currentDocumentLine: '5' }));
    const afterLine = calls.slice();
    const emptyPaths = emptyPathLogs();
    const pickerCalls = opened;

    // A record with no usable line must NOT navigate anywhere.
    calls.length = 0;
    await handler(clickOn('.workspaceTaskCurrentDocLine', {}));
    const afterNoLine = calls.slice();
    const skipped = harness.logs.filter((l) => l.includes('no line')).length;

    globalThis.__cmScrollToLine = saved.scroll;
    globalThis.__cmFocus = saved.focus;
    globalThis.MME_APP.openTextDocument = saved.open;
    return { afterLine, afterNoLine, emptyPaths, pickerCalls, skipped };
  })();

  check('P09', 'a local line click reaches the ACTIVE document through the ONE editor owner',
    JSON.stringify(localNav.afterLine) === JSON.stringify([['scroll', 4], ['focus']]),
    JSON.stringify(localNav));

  check('P10', 'a local line click never opens a document, picks a file or logs an empty path',
    localNav.emptyPaths === 0 && localNav.pickerCalls === 0,
    'emptyPathLogs=' + localNav.emptyPaths + ' opened=' + localNav.pickerCalls);

  check('P11', 'a local record without a usable line is an honest no-op (no fabricated navigation)',
    JSON.stringify(localNav.afterNoLine) === JSON.stringify([]) && localNav.skipped === 1,
    JSON.stringify(localNav));

  scopeToWorkspace();
  resetTaskDom('all');
  REVIEW.refresh();

  // ---- ACT 4B DEVICE DIAGNOSTIC RETEST — local presentation + count log -----
  //
  // The device review of the isolated Note reported the CURRENT-DOCUMENT panel
  // still SHOWING the Workspace filter surface (Open/Backlog/Todo/Ongoing/Done/
  // All + priority), a repeated active-filename group heading and a repeated
  // filename on every row, while the runtime logged `tasks=0`. These fixtures
  // assert the corrections as RENDERED or LOGGED behaviour: which controls the
  // read-only scope withdraws, the compact line cue, the refresh count result
  // and the single zero-state message.
  group('ACT 4B DEVICE DIAGNOSTIC RETEST — local Task presentation, refresh count, zero state (P12-P17)');

  const LOCAL_PRESENTATION_CSS = fs.readFileSync(path.join(ROOT, 'css', 'workspace.css'), 'utf8');
  const READONLY_PREFIX = '#workspaceTasksPanel.workspaceTaskReviewReadonly';

  function lastRefreshLog() {
    const lines = harness.logs.filter((l) => l.includes('TaskReview: refresh'));
    return String(lines[lines.length - 1] || '');
  }

  // NOTE: this suite's `check` coerces its third argument, so every fixture
  // below is an INVOKED IIFE (not a thunk) — a thunk would coerce to `true` and
  // silently assert nothing.

  check('P12', 'CURRENT-DOCUMENT presentation withdraws status/priority filters, search, Board and Workspace grouping', (() => {
    resetTaskDom('all');
    scopeToLocalCurrentDocument(LOCAL_TASKS);

    // The rule block that withdraws the Workspace surface, selected by the ONE
    // scope class the read-only chrome owner applies.
    const start = LOCAL_PRESENTATION_CSS.indexOf(`${READONLY_PREFIX} #workspaceTaskSearchRow`);
    const end = start === -1 ? -1 : LOCAL_PRESENTATION_CSS.indexOf('}', start);
    const block = start === -1 ? '' : LOCAL_PRESENTATION_CSS.slice(start, end);

    return dom.workspaceTasksPanel.classList.contains('workspaceTaskReviewReadonly') === true &&
      block.includes(`${READONLY_PREFIX} .workspaceTaskFilterRow`) &&
      block.includes(`${READONLY_PREFIX} .workspaceTaskGroupHeading`) &&
      /display:\s*none;/.test(block) &&
      LOCAL_PRESENTATION_CSS.includes(`${READONLY_PREFIX} .workspaceTaskBoardButton`) &&
      // exactly three scope-gated selectors in the block, so the Workspace
      // scope (which never carries the class) can never match one of them
      (block.match(/#workspaceTasksPanel\.workspaceTaskReviewReadonly/g) || []).length === 3;
  })(), () => 'Workspace filter surface still reachable in the read-only scope');

  check('P13', 'CURRENT-DOCUMENT rows carry a compact Line N cue, never a repeated filename label', (() => {
    resetTaskDom('all');
    scopeToLocalCurrentDocument(LOCAL_TASKS);
    const html = taskListHtml();
    return html.includes('Line 5') &&
      html.includes('Line 9') &&
      !/note\.md:/.test(html) &&
      // in-buffer navigation affordance is retained
      html.includes('title="Go to line 5 in this Note"') &&
      JSON.stringify(attrValues(html, 'data-current-document-line')) === JSON.stringify(['5', '9']);
  })(), 'repeated filename source label still rendered');

  check('P14', 'the refresh result reports scope-correct provider/filtered/rendered counts', (() => {
    resetTaskDom('all');
    harness.logs.length = 0;
    scopeToLocalCurrentDocument(LOCAL_TASKS);
    const line = lastRefreshLog();
    return /scope=current-document/.test(line) &&
      /providerCount=2/.test(line) &&
      /filteredCount=2/.test(line) &&
      /renderedCount=2/.test(line) &&
      /emptyStateVisible=false/.test(line) &&
      // the old Workspace-index-count log line is gone
      !/\btasks=/.test(line);
  })(), lastRefreshLog());

  check('P15', 'a stale Workspace status filter cannot hide Current Document rows', (() => {
    resetTaskDom('all');
    // A persisted Workspace preference (one local record is Done) ...
    REVIEW.setStatusFilter('done');
    // ... must not decide which local rows a Note shows: the controls that set
    // it are withdrawn from the read-only scope.
    scopeToLocalCurrentDocument(LOCAL_TASKS);
    const badge = String(dom.workspaceTasksBadge.textContent);
    const rows = (taskListHtml().match(/data-task-id=/g) || []).length;
    REVIEW.setStatusFilter('all');
    return badge === '2' && rows === 2;
  })(), () => 'badge=' + dom.workspaceTasksBadge.textContent);

  check('P16', 'Workspace scope keeps the accepted interactive filter equation', (() => {
    resetTaskDom('all');
    scopeToWorkspace();
    REVIEW.refresh();
    REVIEW.setStatusFilter('done');
    const summary = String(dom.workspaceTasksSummary.textContent);
    const rows = (taskListHtml().match(/data-task-id=/g) || []).length;
    REVIEW.setStatusFilter('all');
    return /Showing 1 of 5 tasks/.test(summary) && rows === 1;
  })(), 'workspace filtering changed');

  check('P17', 'the zero render logs emptyStateVisible=true with renderedCount=0 and ONE message', (() => {
    resetTaskDom('all');
    harness.logs.length = 0;
    scopeToLocalCurrentDocument([]);
    const line = lastRefreshLog();
    return /providerCount=0/.test(line) &&
      /filteredCount=0/.test(line) &&
      /renderedCount=0/.test(line) &&
      /emptyStateVisible=true/.test(line) &&
      dom.workspaceTasksBadge.textContent === '0' &&
      dom.workspaceTasksSummary.textContent === '' &&
      taskListHtml().includes('No tasks.');
  })(), lastRefreshLog());

  scopeToWorkspace();
  resetTaskDom('all');
  REVIEW.refresh();

  // ---- Report ---------------------------------------------------------------
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
    '\nWORKSPACE TASK CONSUMERS VALIDATORS: ' + passed.length + ' passed, ' + failed.length + ' failed'
  );
  process.exitCode = failed.length === 0 ? 0 : 1;
})().catch((e) => {
  console.error('WORKSPACE TASK CONSUMERS VALIDATORS: harness error', e);
  process.exitCode = 1;
});
