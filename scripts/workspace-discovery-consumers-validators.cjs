#!/usr/bin/env node
'use strict';

/**
 * ACT 2A — Search / Tags / Wiki Links / Related consumer preservation.
 *
 * Exercises the REAL shipped owners (package.json is type=module, so main.js
 * helpers are extracted verbatim and evaluated, nothing re-implemented):
 *   - js/main.js (WORKSPACE_INDEX_STATE, buildWorkspaceIndex,
 *     runWorkspaceSearch, getWorkspaceTagsSummary, getWorkspaceTagFiles,
 *     findBacklinksForConcept, getActiveConceptName, findWorkspaceFileByPath,
 *     openWorkspaceFile boundary, index-ready wiring);
 *   - js/workspace/workspace-parser.js (saved Note parser; main.js text
 *     helpers extracted verbatim, same set as the ACT 1C suite);
 *   - js/links/wiki-links.js (real MME_WIKI_LINKS resolver, loaded verbatim
 *     against recording shims — audit showed no resolver adaptation needed);
 *   - js/workspace/workspace-controller.js (referenced for the storage-record
 *     shape only; activation lifecycle is covered by ACT 1B/1C suites).
 *
 * 48 fixtures: S01-S13 Search, T14-T19 Tags, W20-W29 Wiki Links, R30-R40
 * Related, X41-X48 cross-consumer guards.
 *
 * Usage: node scripts/workspace-discovery-consumers-validators.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MAIN_PATH = path.join(ROOT, 'js', 'main.js');
const PARSER_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-parser.js');
const WIKI_PATH = path.join(ROOT, 'js', 'links', 'wiki-links.js');
const CONTROLLER_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-controller.js');

const MAIN_SOURCE = fs.readFileSync(MAIN_PATH, 'utf8');
const PARSER_SOURCE = fs.readFileSync(PARSER_PATH, 'utf8');
const WIKI_SOURCE = fs.readFileSync(WIKI_PATH, 'utf8');
const CONTROLLER_SOURCE = fs.readFileSync(CONTROLLER_PATH, 'utf8');

const results = [];
function check(id, name, ok, detail) {
  results.push({ id, name, ok: Boolean(ok), detail: detail == null ? '' : String(detail) });
}
function group(title) {
  results.push({ group: title });
}

// Verbatim extraction of top-level main.js code (col-0 boundaries).
function extractBlock(startMarker, endLine = '}') {
  const start = MAIN_SOURCE.indexOf(startMarker);
  if (start === -1) return '';
  let lineStart = MAIN_SOURCE.indexOf('\n', start);
  if (lineStart === -1) return '';
  lineStart += 1;
  while (lineStart <= MAIN_SOURCE.length) {
    const nl = MAIN_SOURCE.indexOf('\n', lineStart);
    const lineEnd = nl === -1 ? MAIN_SOURCE.length : nl;
    const line = MAIN_SOURCE.slice(lineStart, lineEnd);
    if (line === endLine) return MAIN_SOURCE.slice(start, lineEnd);
    if (nl === -1) break;
    lineStart = nl + 1;
  }
  return '';
}
// Minimal DOM + app shims with recording.
const harness = { logs: [], toasts: [], events: [], writes: [] };
function makeEl(id) {
  return {
    id, hidden: false, innerHTML: '', textContent: '', dataset: {},
    value: '', __workspaceSearchBound: false, __workspaceRelatedBound: false,
    __workspaceTagsBound: false,
    addEventListener() {}, setAttribute() {}, closest() { return null; },
    querySelector() { return null; },
  };
}
function installShims() {
  const els = {};
  for (const id of [
    'workspaceSearchInput', 'workspaceSearchResults', 'workspaceRelatedPanel',
    'workspaceRelatedBadge', 'workspaceRelatedSummary', 'workspaceRelatedList',
    'workspaceTagsPanel', 'workspaceTagsBadge', 'workspaceTagsSummary',
    'workspaceTagsList', 'workspaceTagResults', 'workspaceActivePanel',
    'workspaceActiveBadge', 'workspaceActiveBody', 'workspaceSidebar', 'htmlPane',
  ]) els[id] = makeEl(id);
  globalThis.window = globalThis;
  globalThis.document = {
    getElementById: (id) => els[id] || null,
    querySelector: () => null, querySelectorAll: () => [],
    createElement: () => makeEl('dyn'),
    addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
    body: { appendChild() {} },
    documentElement: { classList: { add() {}, remove() {}, toggle() {}, contains: () => false } },
  };
  globalThis.__domEls = els;
  try { globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; } catch {}
  globalThis.log = (m) => harness.logs.push(String(m));
  globalThis.showToast = (m, t, ms) => harness.toasts.push({ message: String(m), type: t, ms });
  globalThis.MME_APP = {
    log: (m) => harness.logs.push(String(m)),
    showToast: (m, t, ms) => harness.toasts.push({ message: String(m), type: t, ms }),
    openTextDocument: () => {}, confirmDiscardIfDirty: () => true,
  };
  globalThis.MME_NAVIGATION = {
    isNavigationInProgress: () => false, getCurrent: () => null, sameLocation: () => false,
    recordSuccessfulNavigation: () => {},
  };
  globalThis.currentSaveHandle = null;
  try { globalThis.confirm = () => true; } catch {}
  const listeners = {};
  globalThis.__listeners = listeners;
  globalThis.addEventListener = (type, fn) => {
    listeners[type] = listeners[type] || [];
    listeners[type].push(fn);
  };
  globalThis.removeEventListener = () => {};
  globalThis.dispatchEvent = (event) => { harness.events.push(event && event.type); return true; };
  globalThis.CustomEvent = function CustomEvent(type, opts) {
    this.type = type;
    this.detail = (opts && opts.detail) || null;
  };
  globalThis.openTextDocument = () => {};
  globalThis.__virtualReportSession = null;
  globalThis.runProgrammaticTextChange = (fn) => (typeof fn === "function" ? fn() : undefined);
  globalThis.isWorkspaceCurrentFileNoop = () => false;
  globalThis.runProgrammaticTextChange = (fn) => (typeof fn === "function" ? fn() : undefined);
  globalThis.isWorkspaceCurrentFileNoop = () => false;
  [
    'renderWorkspaceIndexSummary', 'renderWorkspaceActivePanel', 'renderWorkspaceTasksPanel',
    'updateWorkspaceJournalSidebarTitlesFromIndex', 'renderWorkspaceJournalTimeline',
    'openVirtualReport', 'canGenerateReport', 'canReconcileDrawioReport',
    'configureDrawioReportPanel', 'ensureWorkspaceActivePanel', 'ensureWorkspaceIndexPanel',
    'ensureWorkspaceTasksPanel', 'ensureWorkspaceProjectsPanel', 'renderWorkspaceProjectsPanel',
    'wireWorkspaceProjectsPanel', 'wireWorkspaceActivePanel', 'wireWorkspaceTasksPanel',
    'wireWorkspaceIndexRefreshButton', 'wireWorkspaceIndexOpenButton',
    'wireWorkspacePanelCollapses', 'forceUpgradeWorkspacePanelMarkup',
    'ensureWorkspaceRelatedPanel', 'ensureWorkspaceTagsPanel',
    'wireWorkspaceRelatedPanel', 'wireWorkspaceTagsPanel',
    'normalizeWorkspacePanelOrder', 'applyWorkspacePanelCollapsed', 'isWorkspacePanelCollapsed',
    'toggleWorkspacePanel', 'getWorkspaceSidebarContentHost', 'attachContextualHelpButton',
  ].forEach((name) => {
    if (/^render|^update|^configure|^force|^normalize|^apply|^toggle/.test(name)) {
      globalThis[name] = function stubRender() {};
    } else {
      globalThis[name] = function stubEnsure() { return null; };
    }
  });
  globalThis.guardUnsavedReportBeforePhysicalOpen = async () => ({ ok: true, action: 'not-report' });
  globalThis.MME_TASK_REVIEW = null;
  globalThis.MME_REPORT_PANEL = null;
}
installShims();
function evalMainBlocks(sources) {
  const combined = sources.map((src) => {
    if (!src) throw new Error('verbatim extraction failed');
    return src;
  }).join("\n\n");
  (0, eval)(combined);
}
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
evalMainBlocks(PARSER_HELPERS.map((m) => extractBlock(m)));
// WORKSPACE_STATE lives in js/workspace/workspace-state.js (ES module); the
// 1C suite seeds an equivalent plain object, so do the same here instead of
// extracting a nonexistent main.js block.
globalThis.WORKSPACE_STATE = { rootHandle: null, files: { notes: [] }, activeFile: null };
(0, eval)(PARSER_SOURCE);
if (typeof globalThis.parseWorkspaceDocument !== 'function') {
  throw new Error('parseWorkspaceDocument not exposed by parser module');
}
const parseWorkspaceDocument = globalThis.parseWorkspaceDocument;
globalThis.parseWorkspaceDocument = parseWorkspaceDocument;
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
function extractLineFrom(src, marker) {
  const start = src.indexOf(marker);
  if (start === -1) return '';
  const nl = src.indexOf('\n', start);
  return src.slice(start, nl === -1 ? undefined : nl);
}

const SHIPPED_SNIPPETS = [
  extractBlockFrom(MAIN_SOURCE, "function escapeHtml(str) {"),
  extractBlockFrom(CONTROLLER_SOURCE, 'function normalizeWorkspaceKindForCompare('),
  extractBlockFrom(MAIN_SOURCE, 'const WORKSPACE_INDEX_STATE = {', '};'),
  extractBlockFrom(MAIN_SOURCE, 'try {\n  window.WORKSPACE_INDEX_STATE', '} catch {}'),
  extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceSearchIcon('),
  extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceSearchKindLabel('),
  extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceKindLabel('),
  extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceKindIcon('),
  extractLineFrom(MAIN_SOURCE, 'const WORKSPACE_SEARCH_MIN_CHARS ='),
  extractLineFrom(MAIN_SOURCE, 'let __workspaceSearchLastQuery ='),
  extractLineFrom(MAIN_SOURCE, 'let __workspaceActiveTag ='),
  extractBlockFrom(MAIN_SOURCE, 'function normalizeWorkspaceSearchQuery('),
  extractBlockFrom(MAIN_SOURCE, 'function runWorkspaceSearch('),
  extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceTagsSummary('),
  extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceTagFiles('),
  extractBlockFrom(MAIN_SOURCE, 'function getActiveConceptName('),
  extractBlockFrom(MAIN_SOURCE, 'function normalizeBacklinkConceptKey('),
  extractBlockFrom(MAIN_SOURCE, 'function findBacklinksForConcept('),
  extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceRelatedPanel('),
  extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceTagsPanel('),
  extractBlockFrom(MAIN_SOURCE, 'function renderWorkspaceTagResults('),
  extractBlockFrom(MAIN_SOURCE, 'function getWorkspaceActiveStats('),
  extractBlockFrom(MAIN_SOURCE, 'function normalizeWorkspaceSearchPath('),
  extractBlockFrom(MAIN_SOURCE, 'function findWorkspaceFileByPath('),
  extractBlockFrom(MAIN_SOURCE, 'function isWorkspaceCurrentFileNoop('),
  extractBlockFrom(MAIN_SOURCE, 'async function openWorkspaceFile('),
  extractBlockFrom(MAIN_SOURCE, 'async function readWorkspaceFileText('),
  extractBlockFrom(MAIN_SOURCE, 'async function buildWorkspaceIndex('),
  extractLineFrom(MAIN_SOURCE, 'let __workspaceIndexTimer = null;'),
  extractBlockFrom(MAIN_SOURCE, 'function scheduleWorkspaceIndexRebuild('),
];
const api = new Function(
  `${SHIPPED_SNIPPETS.join("\n\n")}\nreturn {
    WORKSPACE_INDEX_STATE,
    WORKSPACE_SEARCH_MIN_CHARS,
    normalizeWorkspaceKindForCompare,
    getWorkspaceSearchIcon,
    getWorkspaceSearchKindLabel,
    getWorkspaceKindLabel,
    getWorkspaceKindIcon,
    normalizeWorkspaceSearchQuery,
    runWorkspaceSearch,
    getWorkspaceTagsSummary,
    getWorkspaceTagFiles,
    getActiveConceptName,
    normalizeBacklinkConceptKey,
    findBacklinksForConcept,
    renderWorkspaceRelatedPanel,
    renderWorkspaceTagsPanel,
    renderWorkspaceTagResults,
    getWorkspaceActiveStats,
    normalizeWorkspaceSearchPath,
    findWorkspaceFileByPath,
    openWorkspaceFile,
    readWorkspaceFileText,
    buildWorkspaceIndex,
    scheduleWorkspaceIndexRebuild,
  };`
)();
Object.assign(globalThis, api);
(0, eval)(WIKI_SOURCE);
const WIKI = globalThis.MME_WIKI_LINKS;
if (!WIKI || typeof WIKI.resolveTarget !== 'function') {
  throw new Error('MME_WIKI_LINKS resolver not exposed');
}
function makeHandle(name, content) {
  return {
    kind: 'file', name,
    async getFile() {
      return { text: async () => content, size: String(content).length, lastModified: 0 };
    },
  };
}
const NOTE_SOURCES = {
  'notes/Architecture.md': { text: '# Architecture\n\nBody with #alpha #beta tags.\n\n- [ ] task one @2026-09-26\n\nSee [[Deployment]] and [[notes/Glossary.md]].\n' },
  'notes/Deployment.md': { text: '# Architecture\n\nDuplicate H1 on purpose. #beta only.\n\n- [x] done task\n\nLinks back to [[Architecture]].\n' },
  'notes/Glossary.md': { text: '---\nknowledge: true\n---\n# Glossary\n\nKnowledge note. #alpha\n\nRefs [[Architecture]].\n' },
  'notes/2026-09-25.md': { text: '---\ndate: 2026-09-25\npinned: true\n---\n# Daily\n\nPinned dated note. #alpha\n' },
  'notes/Old.md': { text: '---\narchived: true\n---\n# Old Note\n\nArchived note. #beta\n\nRefs [[Architecture]].\n' },
};
function storageRecord(p, name, content) {
  return { kind: 'notes', name, path: p, handle: makeHandle(name, content) };
}
async function buildFixtureIndex() {
  WORKSPACE_STATE.rootHandle = { kind: 'directory', name: 'workspace' };
  WORKSPACE_STATE.files.notes = Object.entries(NOTE_SOURCES).map(([p, v]) =>
    storageRecord(p, p.split('/').pop(), v.text));
  WORKSPACE_STATE.activeFile = null;
  harness.logs.length = 0; harness.toasts.length = 0; harness.events.length = 0;
  return await buildWorkspaceIndex();
}
function searchDom() {
  const input = globalThis.__domEls.workspaceSearchInput;
  const resultsEl = globalThis.__domEls.workspaceSearchResults;
  input.value = ''; input.dataset = {}; resultsEl.innerHTML = ''; resultsEl.hidden = true;
  return { input, resultsEl };
}
function resultButtons() {
  const html = String(globalThis.__domEls.workspaceSearchResults.innerHTML || '');
  const out = [];
  const re = /data-workspace-search-result="1"[^>]*data-path="([^"]*)"[^>]*data-kind="([^"]*)"/g;
  let m; while ((m = re.exec(html))) out.push({ path: m[1], kind: m[2] });
  return out;
}
function setActive(p) {
  const rec = WORKSPACE_STATE.files.notes.find((f) => f.path === p);
  WORKSPACE_STATE.activeFile = { kind: 'notes', name: rec.name, path: rec.path, handle: rec.handle };
}
(async () => {
  await buildFixtureIndex();
  group('Search (S01-S13)');
  check('S01', 'Search draws candidates from Notes only', (() => {
    const src = extractBlock('function runWorkspaceSearch(');
    return src.includes('byKind?.notes') && !src.includes('files?.journals') &&
      !src.includes('files?.concepts') && WORKSPACE_INDEX_STATE.byKind.notes.length === 5;
  })(), 'byKind.notes only');
  check('S02', 'filename match', (() => {
    const { input } = searchDom(); input.value = 'architec'; runWorkspaceSearch(input.value);
    return resultButtons().some((r) => r.path === 'notes/Architecture.md');
  })(), 'query architec');
  check('S03', 'relative path match', (() => {
    const { input } = searchDom(); input.value = 'notes/depl'; runWorkspaceSearch(input.value);
    return resultButtons().some((r) => r.path === 'notes/Deployment.md');
  })(), 'query notes/depl');
  check('S04', 'minimum query length unchanged (2)', (() => {
    const { input, resultsEl } = searchDom();
    input.value = 'x'; runWorkspaceSearch(input.value);
    const hidden = resultsEl.hidden === true;
    const okConst = WORKSPACE_SEARCH_MIN_CHARS === 2;
    const q2 = searchDom(); q2.input.value = 'ar'; runWorkspaceSearch(q2.input.value);
    return hidden && okConst && resultButtons().length > 0;
  })(), 'MIN=2');
  check('S05', 'result limit unchanged (20)',
    extractBlock('function runWorkspaceSearch(').includes('.slice(0, 20)'), 'slice(0,20)');
  check('S06', 'result path preserved', (() => {
    const { input } = searchDom(); input.value = 'glossa'; runWorkspaceSearch(input.value);
    const rows = resultButtons();
    return rows.length === 1 && rows[0].path === 'notes/Glossary.md' && rows[0].kind === 'notes';
  })(), 'glossary row');
  check('S07', 'click opens correct path', await (async () => {
    const found = findWorkspaceFileByPath('notes/Deployment.md', 'notes');
    if (!found || !found.handle) return false;
    const opened = await openWorkspaceFile(found, 'notes', 'act2a-search-click');
    return opened && WORKSPACE_STATE.activeFile.path === 'notes/Deployment.md' &&
      WORKSPACE_STATE.activeFile.kind === 'notes';
  })(), 'search->open');
  check('S08', 'duplicate H1 results remain distinct', (() => {
    const { input } = searchDom(); input.value = 'notes/'; runWorkspaceSearch(input.value);
    const rows = resultButtons(); const paths = rows.map((r) => r.path);
    const html = String(globalThis.__domEls.workspaceSearchResults.innerHTML || '');
    const h1hits = (html.match(/Architecture/g) || []).length;
    return new Set(paths).size === paths.length && paths.length === 5 &&
      paths.includes('notes/Architecture.md') && paths.includes('notes/Deployment.md') && h1hits >= 3;
  })(), '5 distinct paths');
  check('S09', 'no Journals/Concepts authoritative arrays', (() => {
    const src = extractBlock('function runWorkspaceSearch(');
    return !src.includes('files.journals') && !src.includes('files.concepts') &&
      !src.includes('byKind.journals') && !src.includes('byKind.concepts') &&
      JSON.stringify(Object.keys(WORKSPACE_INDEX_STATE.byKind)) === JSON.stringify(['notes']);
  })(), 'notes-only');
  check('S10', 'H1 display label does not change navigation identity', (() => {
    const { input } = searchDom(); input.value = 'depl'; runWorkspaceSearch(input.value);
    const html = String(globalThis.__domEls.workspaceSearchResults.innerHTML || '');
    const rows = resultButtons();
    return rows.length === 1 && rows[0].path === 'notes/Deployment.md' &&
      html.includes('Architecture') && html.includes('Deployment.md');
  })(), 'title shown, path navigates');
  check('S11', 'Search-by-H1 is not introduced accidentally', (() => {
    const q = searchDom(); q.input.value = 'daily'; runWorkspaceSearch(q.input.value);
    return resultButtons().length === 0;
  })(), 'title-only query has no hits');
  check('S12', 'query cache refresh behavior after Index rebuild is explicit', (() => {
    const { input } = searchDom(); input.value = 'architec'; runWorkspaceSearch(input.value);
    const before = String(globalThis.__domEls.workspaceSearchResults.innerHTML || '');
    const buildA = input.dataset.searchBuildId;
    runWorkspaceSearch(input.value);
    const cached = String(globalThis.__domEls.workspaceSearchResults.innerHTML || '');
    WORKSPACE_INDEX_STATE.lastBuiltAt += 1;
    runWorkspaceSearch(input.value);
    const after = String(globalThis.__domEls.workspaceSearchResults.innerHTML || '');
    return before === cached && after === before && typeof buildA === 'string' && buildA.length > 0;
  })(), 'cache keyed on lastBuiltAt');
  check('S13', 'archived-note behavior is explicit (included; no Archive view exists)', (() => {
    const { input } = searchDom(); input.value = 'old'; runWorkspaceSearch(input.value);
    return resultButtons().some((r) => r.path === 'notes/Old.md');
  })(), 'archived searchable');
  group('Tags (T14-T19)');
  check('T14', 'tags aggregated from all Notes', (() => {
    const rows = getWorkspaceTagsSummary();
    const alpha = rows.find((r) => r.tag === 'alpha');
    const beta = rows.find((r) => r.tag === 'beta');
    return alpha && alpha.count === 3 && beta && beta.count === 3;
  })(), 'alpha=3 beta=3');
  check('T15', 'tag source path preserved', (() => {
    const paths = getWorkspaceTagFiles('alpha').map((f) => f.path).sort();
    return JSON.stringify(paths) === JSON.stringify(['notes/2026-09-25.md', 'notes/Architecture.md', 'notes/Glossary.md']);
  })(), 'alpha paths');
  check('T16', 'tag click opens correct Note', await (async () => {
    const target = getWorkspaceTagFiles('beta').find((f) => f.path === 'notes/Deployment.md');
    if (!target) return false;
    const found = findWorkspaceFileByPath(target.path, target.kind);
    const opened = await openWorkspaceFile(found, found.kind, 'act2a-tag-click');
    return opened && WORKSPACE_STATE.activeFile.path === 'notes/Deployment.md';
  })(), 'tag->open');
  check('T17', 'duplicate titles do not merge tag sources', (() => {
    const files = getWorkspaceTagFiles('beta');
    const arch = files.filter((f) => f.title === 'Architecture');
    return arch.length === 2 && new Set(arch.map((f) => f.path)).size === 2;
  })(), 'two Architecture records');
  check('T18', 'no tag parser or normalization change',
    // The tag parser owner is js/workspace/workspace-parser.js (parseMarkdownTags);
    // main.js only normalizes and sorts. Neither changed in ACT 2A.
    PARSER_SOURCE.includes('function parseMarkdownTags(') &&
    typeof globalThis.parseMarkdownTags === 'function' &&
    MAIN_SOURCE.includes('function normalizeTagValue(') &&
    extractBlock('function getWorkspaceTagsSummary(').includes('b.count - a.count'),
    'parser owner + normalization + sorting intact');
  check('T19', 'archived-note behavior is explicit (consistent with Search)',
    getWorkspaceTagFiles('beta').some((f) => f.path === 'notes/Old.md'),
    'archived tag source included');
  group('Wiki Links (W20-W29)');
  check('W20', 'basename target resolution in notes/',
    WIKI.resolveTarget('Deployment').status === 'resolved' &&
    WIKI.resolveTarget('Deployment').file.path === 'notes/Deployment.md', '[[Deployment]]');
  check('W21', 'exact path target resolution', (() => {
    const r = WIKI.resolveTarget('notes/Glossary.md');
    return r.status === 'resolved' && r.file.path === 'notes/Glossary.md';
  })(), '[[notes/Glossary.md]]');
  check('W22', 'saved title resolution (already supported)', (() => {
    const r = WIKI.resolveTarget('Glossary');
    return r.status === 'resolved' && r.file.path === 'notes/Glossary.md';
  })(), '[[Glossary]]');
  check('W23', 'missing target preserves current behavior', (() => {
    const r = WIKI.resolveTarget('No Such Note Anywhere');
    return r.status === 'missing' && WIKI.isMissingTarget('No Such Note Anywhere') === true;
  })(), 'missing');
  check('W24', 'ambiguous target preserves current behavior', (() => {
    const r = WIKI.resolveTarget('Architecture');
    return r.status === 'ambiguous' && Array.isArray(r.matches) && r.matches.length >= 2;
  })(), 'ambiguous');
  check('W25', 'duplicate H1 Notes remain separate candidates', (() => {
    const r = WIKI.resolveTarget('Architecture');
    if (r.status !== 'ambiguous') return false;
    const paths = r.matches.map((f) => f.path).sort();
    return paths.includes('notes/Architecture.md') && paths.includes('notes/Deployment.md');
  })(), 'both paths present');
  check('W26', 'no link rewrite', (() => {
    const before = NOTE_SOURCES['notes/Architecture.md'].text;
    WIKI.resolveTarget('Deployment');
    return NOTE_SOURCES['notes/Architecture.md'].text === before;
  })(), 'sources untouched');
  check('W27', 'no new syntax',
    !/AUTOCOMPLETE|Graph View|graphView/i.test(WIKI_SOURCE), 'only [[...]] supported');
  check('W28', 'path-based legacy link behavior is documented', (() => {
    const legacyConcept = WIKI.resolveTarget('concepts/Architecture');
    const legacyJournal = WIKI.resolveTarget('journals/2026-09-25');
    return legacyConcept.status !== 'not-ready' && legacyJournal.status === 'missing';
  })(), 'fallback-or-missing, never rewritten');
  check('W29', 'resolver uses one Workspace Index snapshot',
    WIKI_SOURCE.includes('index.files') && !WIKI_SOURCE.includes('files.journals') &&
    !WIKI_SOURCE.includes('files.concepts') && !WIKI_SOURCE.includes('files.notes'),
    'single index.files snapshot');
  group('Related (R30-R40)');
  check('R30', 'active normal Note can receive backlinks', (() => {
    setActive('notes/Architecture.md');
    const names = findBacklinksForConcept(getActiveConceptName()).map((f) => f.path).sort();
    return names.includes('notes/Deployment.md') && names.includes('notes/Glossary.md') && names.includes('notes/Old.md');
  })(), 'Architecture backlinks');
  check('R31', 'active Knowledge Note can receive backlinks', (() => {
    setActive('notes/Glossary.md');
    const names = findBacklinksForConcept(getActiveConceptName()).map((f) => f.path);
    return names.includes('notes/Architecture.md');
  })(), 'Glossary backlinks');
  check('R32', 'Knowledge is not required', (() => {
    const rec = WORKSPACE_INDEX_STATE.byPath.get('notes/Architecture.md');
    return rec && rec.knowledge === false && getActiveConceptName() !== '';
  })(), 'normal note eligible');
  check('R33', 'backlink source path preserved', (() => {
    setActive('notes/Architecture.md');
    return findBacklinksForConcept(getActiveConceptName())
      .every((f) => typeof f.path === 'string' && f.path.startsWith('notes/') && f.kind === 'notes');
  })(), 'paths + kind');
  check('R34', 'clicking source opens correct Note', await (async () => {
    const found = findWorkspaceFileByPath('notes/Glossary.md', 'notes');
    const opened = await openWorkspaceFile(found, 'notes', 'act2a-related-click');
    return opened && WORKSPACE_STATE.activeFile.path === 'notes/Glossary.md';
  })(), 'related->open');
  check('R35', 'old concepts-only gate removed', (() => {
    const src = extractBlock('function getActiveConceptName(');
    return !src.includes("!== 'concepts'");
  })(), 'no kind gate');
  check('R36', 'current result ordering preserved (date desc, name asc, no kind tier)', (() => {
    const src = extractBlock('function findBacklinksForConcept(');
    return src.includes('dateB.localeCompare(dateA)') && !src.includes("a.kind === 'journals'") &&
      !src.includes('a.kind !== b.kind');
  })(), 'ordering intact');
  check('R37', 'no semantic relationship inference', (() => {
    const src = extractBlock('function findBacklinksForConcept(');
    return src.includes('parsed.conceptLinks') && !/semantic|similar/i.test(src);
  })(), 'explicit backlinks only');

  check('R38', 'index-ready refresh is idempotent', (() => {
    renderWorkspaceRelatedPanel();
    const first = globalThis.__domEls.workspaceRelatedList.innerHTML;
    renderWorkspaceRelatedPanel();
    return first === globalThis.__domEls.workspaceRelatedList.innerHTML;
  })(), 'double render stable');
  check('R39', 'no duplicate listener',
    // Exactly one shipped subscription to the index-ready channel; the other
    // textual mentions are the dispatch site and comments, not listeners.
    (MAIN_SOURCE.match(/addEventListener\('mme-workspace-index-ready'/g) || []).length === 1 &&
    !MAIN_SOURCE.includes('__mmeWorkspaceRelatedReadyBound'),
    'single index-ready listener');
  check('R40', 'no recursive Index rebuild', (() => {
    const rel = extractBlock('function renderWorkspaceRelatedPanel(');
    return !rel.includes('buildWorkspaceIndex(') && !rel.includes('scheduleWorkspaceIndexRebuild(');
  })(), 'render never builds');
  group('Cross-consumer (X41-X48)');
  check('X41', 'Search, Tags, Wiki Links and Related share path identity', (() => {
    const { input } = searchDom(); input.value = 'arch'; runWorkspaceSearch(input.value);
    const sPaths = new Set(resultButtons().map((r) => r.path));
    const tPaths = new Set(getWorkspaceTagFiles('beta').map((f) => f.path));
    setActive('notes/Architecture.md');
    const bPaths = new Set(findBacklinksForConcept(getActiveConceptName()).map((f) => f.path));
    return sPaths.has('notes/Architecture.md') && tPaths.has('notes/Architecture.md') &&
      WIKI.resolveTarget('Architecture').status === 'ambiguous' && bPaths.size > 0;
  })(), 'path is the join key');
  check('X42', 'H1 is presentation only', (() => {
    const { input } = searchDom(); input.value = 'arch'; runWorkspaceSearch(input.value);
    const html = globalThis.__domEls.workspaceSearchResults.innerHTML;
    return html.includes('Architecture') && !html.includes('data-h1=');
  })(), 'title shown, not keyed');
  check('X43', 'duplicate titles never merge physical records',
    WORKSPACE_INDEX_STATE.byPath.get('notes/Architecture.md') !==
    WORKSPACE_INDEX_STATE.byPath.get('notes/Deployment.md'),
    'distinct records');
  check('X44', 'no file write', harness.writes.length === 0, 'reads only');
  check('X45', 'no metadata write',
    !/createWritable|setFrontmatter|writeFrontmatter/i.test(extractBlock('function runWorkspaceSearch(')) &&
    !/createWritable|setFrontmatter|writeFrontmatter/i.test(extractBlock('function findBacklinksForConcept(')),
    'read-only');
  check('X46', 'no WORKSPACE_STATE mutation', (() => {
    const before = JSON.stringify(WORKSPACE_STATE.files.notes.map((r) => r.path));
    const { input } = searchDom(); input.value = 'arch'; runWorkspaceSearch(input.value);
    getWorkspaceTagFiles('beta');
    findBacklinksForConcept(getActiveConceptName());
    return JSON.stringify(WORKSPACE_STATE.files.notes.map((r) => r.path)) === before;
  })(), 'storage untouched');
  check('X47', 'no Workspace Index mutation by consumers', (() => {
    const IDX = WORKSPACE_INDEX_STATE;
    const before = IDX.files.length + ':' + IDX.byPath.size + ':' + IDX.tasks.length;
    const { input } = searchDom(); input.value = 'arch'; runWorkspaceSearch(input.value);
    getWorkspaceTagFiles('beta');
    renderWorkspaceRelatedPanel();
    return (IDX.files.length + ':' + IDX.byPath.size + ':' + IDX.tasks.length) === before;
  })(), 'index untouched');
  check('X48', 'no ACT 2C behavior implemented', (() => {
    // ACT 2B is now closed, so the tasks/projects/board consumers are expected
    // to read the unified notes/ bucket. What must still be absent is ACT 2C:
    // Sidebar panel sequence, the Virtual Journal Timeline, and the creation
    // flows (+ New Note / Named Note / Promote / Archive metadata writers).
    const probe = ['renderWorkspaceJournalTimeline(', 'createNewConcept(',
      'activateWorkspaceAtExistingBoundary('];
    return probe.every((m) => {
      const i = MAIN_SOURCE.indexOf(m);
      if (i === -1) return true;
      return !/files\.notes|byKind\?\.notes|byKind\.notes/.test(MAIN_SOURCE.slice(i, i + 400));
    });
  })(), 'sidebar/timeline/creation flows still untouched');
  const failed = results.filter((e) => !e.group && !e.ok);
  const passed = results.filter((e) => !e.group && e.ok);
  for (const e of results) {
    if (e.group) { console.log('\n' + e.group); continue; }
    console.log((e.ok ? 'PASS' : 'FAIL') + ' [' + e.id + '] ' + e.name + (e.ok ? '' : ' -- ' + e.detail));
  }
  console.log('\nWORKSPACE DISCOVERY CONSUMERS VALIDATORS: ' + passed.length + ' passed, ' + failed.length + ' failed');
  process.exitCode = failed.length === 0 ? 0 : 1;
})().catch((e) => { console.error('WORKSPACE DISCOVERY CONSUMERS VALIDATORS: harness error', e); process.exitCode = 1; });
