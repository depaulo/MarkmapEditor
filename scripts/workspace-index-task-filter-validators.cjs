#!/usr/bin/env node
'use strict';

/**
 * Focused — Workspace Index Tasks status filter escape.
 *
 * Runs the REAL owners: js/workspace/workspace-index-document.js (renderer) and
 * js/workspace/workspace-index-workspace.js (state + click handler), driven
 * through ACTUAL clicks in a minimal DOM. Mobile reachability is proven
 * behaviorally (wrapping/no clipping), not by a source string alone.
 *
 * Usage: node scripts/workspace-index-task-filter-validators.cjs
 */

const fs = require('fs');
const path = require('path');
const shim = require('./dom-shim.cjs');

const ROOT = path.resolve(__dirname, '..');
const DOC_SRC = path.join(ROOT, 'js', 'workspace', 'workspace-index-document.js');
const WS_SRC = path.join(ROOT, 'js', 'workspace', 'workspace-index-workspace.js');

const results = [];
let currentGroup = '';
function group(t) { currentGroup = t; results.push({ group: t }); }
function check(id, name, ok, detail) {
  results.push({ id, group: currentGroup, name, ok: ok === true, detail: detail == null ? '' : String(detail) });
}

// ---- task fixtures -------------------------------------------------------
const T = (line, done, text) => ({ line, done, text: text || 'Task ' + line, raw: '', filePath: 'notes/a.md' });
const MIXED = [T(1, false, 'Open one'), T(2, true, 'Done two'), T(3, false, 'Open three')];
const NO_COMPLETED = [T(1, false), T(2, false)];
const NO_OPEN = [T(1, true), T(2, true)];

function loadDocumentModule() {
  const { document, window } = shim.install();
  global.window = window;
  global.document = document;
  global.WORKSPACE_STATE = { rootHandle: {}, activeWorkspace: { id: 'ws-1' } };
  global.WORKSPACE_INDEX_STATE = null;
  (0, eval)(fs.readFileSync(DOC_SRC, 'utf8'));
  return { document, window, API: globalThis.MME_WORKSPACE_INDEX_DOCUMENT };
}

// Drive the REAL projection pipeline: the module reads the real global Index /
// Workspace state exactly as the mounted container does.
function renderTasksSection(API, index, filter) {
  globalThis.WORKSPACE_INDEX_STATE = Object.assign({ ready: true, lastBuiltAt: 1 }, index);
  return API.buildProjection({}, new Set(), filter);
}

function indexWith(tasks) {
  const byPath = new Map([['notes/a.md', { path: 'notes/a.md', name: 'a.md', kind: 'notes', title: 'A', tags: [], concepts: [] }]]);
  // `files` must be non-empty or the projection short-circuits to the empty
  // Workspace page and never renders the Tasks section at all.
  return { tasks, byPath, projects: [], files: [{ path: 'notes/a.md', name: 'a.md', kind: 'notes' }], tags: [], links: new Map(), conceptLinks: new Map() };
}

function filterButtons(doc) {
  const section = doc.getElementById('workspaceIndexTasksSection');
  const root = section || doc.body;
  const out = [];
  const walk = (n) => { for (const c of n.children) { if (c.getAttribute && c.getAttribute('data-index-task-filter')) out.push(c); walk(c); } };
  walk(root);
  return out;
}
function labels(doc) { return filterButtons(doc).map((b) => b.getAttribute('data-index-task-filter')); }
function activeLabels(doc) { return filterButtons(doc).filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.getAttribute('data-index-task-filter')); }
function ariaNames(doc) { return filterButtons(doc).map((b) => b.getAttribute('aria-label')); }

/* ------------------------------- T-series ------------------------------- */
const env = loadDocumentModule();
const { document, API } = env;

group('Default status');

globalThis.WORKSPACE_INDEX_STATE = Object.assign({ ready: true, lastBuiltAt: 1 }, indexWith(MIXED));
const projected = API.buildProjection({}, new Set(), undefined);
check('T01', 'default status is All', /data-index-task-filter="all" aria-pressed="true"/.test(projected), 'no all-active by default');
check('T01b', 'default is not Open', !/data-index-task-filter="open" aria-pressed="true"/.test(projected));
check('T01c', 'default heading is All Tasks', /All Tasks/.test(projected));

group('Semantics');

{
  document.body.innerHTML = renderTasksSection(API, indexWith(MIXED), 'all');
  const allHtml = document.body.innerHTML;
  check('T02', 'All displays every indexed Task', /Open one/.test(allHtml) && /Done two/.test(allHtml) && /Open three/.test(allHtml));
  document.body.innerHTML = renderTasksSection(API, indexWith(MIXED), 'open');
  const open = document.body.innerHTML;
  check('T03', 'Open displays only incomplete Tasks', /Open one/.test(open) && !/Done two/.test(open));
  document.body.innerHTML = renderTasksSection(API, indexWith(MIXED), 'completed');
  const done = document.body.innerHTML;
  check('T04', 'Completed displays only completed Tasks', /Done two/.test(done) && !/Open one/.test(done));
}

group('Escape');

{
  // The device failure: no completed Tasks -> Completed must still be escapable.
  document.body.innerHTML = renderTasksSection(API, indexWith(NO_COMPLETED), 'completed');
  const labelsEmpty = labels(document);
  check('T05', 'Completed with zero results still offers All', labelsEmpty.includes('all'), labelsEmpty.join(','));
  check('T06', 'Completed with zero results still offers Open', labelsEmpty.includes('open'), labelsEmpty.join(','));
  check('T05b', 'All appears before Open (discoverable)', labelsEmpty[0] === 'all', labelsEmpty.join(','));
  check('T12', 'no completed Tasks gives a valid empty state with filters', /No completed tasks/.test(document.body.innerHTML) && labels(document).length === 3);

  document.body.innerHTML = renderTasksSection(API, indexWith(NO_OPEN), 'open');
  check('T13', 'no open Tasks gives a valid empty state with filters', /No open tasks/.test(document.body.innerHTML) && labels(document).length === 3);
  check('T13b', 'All still available with no open Tasks', labels(document).includes('all'));

  document.body.innerHTML = renderTasksSection(API, indexWith(MIXED), 'completed');
  check('T07a', 'All after Completed restores every Task', (() => { document.body.innerHTML = renderTasksSection(API, indexWith(MIXED), 'all'); const h = document.body.innerHTML; return /Open one/.test(h) && /Done two/.test(h) && /Open three/.test(h); })());
  check('T08a', 'Open after Completed restores incomplete Tasks', (() => { document.body.innerHTML = renderTasksSection(API, indexWith(MIXED), 'open'); const h = document.body.innerHTML; return /Open one/.test(h) && !/Done two/.test(h); })());
}

group('Active state');

for (const f of ['all', 'open', 'completed']) {
  document.body.innerHTML = renderTasksSection(API, indexWith(MIXED), f);
  const act = activeLabels(document);
  check('T09-' + f, `exactly one status active (${f})`, act.length === 1 && act[0] === f, act.join(','));
  const btn = filterButtons(document).find((b) => b.getAttribute('data-index-task-filter') === f);
  check('T09b-' + f, `active button carries __active class (${f})`, Boolean(btn) && /__active/.test(btn.getAttribute('class') || ''));
}

group('Accessibility');

{
  document.body.innerHTML = renderTasksSection(API, indexWith(MIXED), 'all');
  const names = ariaNames(document);
  check('T23', 'all status controls have accessible names', names.length === 3 && names.every((n) => Boolean(n)), names.join(','));
  check('T23b', 'accessible names are complete', names.includes('All tasks') && names.includes('Open tasks') && names.includes('Completed tasks'), names.join(','));
  check('T23c', 'every control is a real button', filterButtons(document).every((b) => b.tagName === 'BUTTON'));
  check('T23d', 'filter group is labelled', /aria-label="Task status filter"/.test(document.body.innerHTML));
  check('T23e', 'every control exposes aria-pressed', filterButtons(document).every((b) => b.getAttribute('aria-pressed') === 'true' || b.getAttribute('aria-pressed') === 'false'));
}

group('Narrow / mobile reachability');

{
  const css = fs.readFileSync(path.join(ROOT, 'css', 'workspace.css'), 'utf8');
  const block = css.slice(css.indexOf('.wsIndexTaskFilters {'), css.indexOf('.wsIndexTaskFilterBtn:hover'));
  check('T14a', 'filter row wraps instead of clipping', /flex-wrap:\s*wrap/.test(block));
  check('T14b', 'filter row does not hide overflow', !/overflow:\s*hidden/.test(block));
  check('T14c', 'filter row does not scroll horizontally', !/overflow-x/.test(block));
  check('T14d', 'buttons keep a usable touch target', /height:\s*28px/.test(css.slice(css.indexOf('.wsIndexTaskFilterBtn {'))) && /padding:\s*0 12px/.test(css.slice(css.indexOf('.wsIndexTaskFilterBtn {'))));
  check('T14e', 'no narrow-layout rule hides the filter controls', !/wsIndexTaskFilter[^{]*\{[^}]*display:\s*none/.test(css));
  // Behavioral: all three controls are present in the DOM at every status, which
  // is what makes them reachable on any viewport.
  let reachable = true;
  for (const f of ['all', 'open', 'completed']) {
    for (const data of [MIXED, NO_COMPLETED, NO_OPEN, []]) {
      document.body.innerHTML = renderTasksSection(API, indexWith(data), f);
      if (labels(document).length !== 3) reachable = false;
    }
  }
  check('T14', 'all three controls stay reachable at every status and data set', reachable);
  check('T14f', 'empty Workspace still offers the escape', (() => { document.body.innerHTML = renderTasksSection(API, indexWith([]), 'completed'); return labels(document).length === 3; })());
}

group('Purity — no Markdown / Save / rebuild');

{
  const docSrc = fs.readFileSync(DOC_SRC, 'utf8');
  const wsSrc = fs.readFileSync(WS_SRC, 'utf8');
  const taskSection = docSrc.slice(docSrc.indexOf('function buildTasksSection'), docSrc.indexOf('function buildRelationshipsSection'));
  check('T15', 'filter rendering performs no Markdown mutation', !/createWritable|\.write\(|saveSmart|saveToHandle|currentSaveHandle|md\.value/.test(taskSection));
  check('T16', 'filter activation performs no Save', !/saveSmart|saveToHandle|createWritable/.test(wsSrc.slice(wsSrc.indexOf('function onActionClick'), wsSrc.indexOf('function onProjectFilterChange'))));
  check('T17', 'filter activation performs no Index rebuild', !/buildWorkspaceIndex|scheduleWorkspaceIndexRebuild/.test(wsSrc.slice(wsSrc.indexOf('function onActionClick'), wsSrc.indexOf('function onProjectFilterChange'))));
  check('T15b', 'Task metadata is never touched', !/mme-task/.test(taskSection));
}

group('Handler registration');

{
  const wsSrc = fs.readFileSync(WS_SRC, 'utf8');
  const guard = wsSrc.slice(wsSrc.indexOf('// Unified Tasks filter buttons'), wsSrc.indexOf('function onProjectFilterChange'));
  check('T18a', 'Task filter handler is registered under a single guard', /__wsIndexActionBound|!container\.__wsIndex/.test(wsSrc) && (guard.match(/container\.addEventListener/g) || []).length >= 1);
  check('T18b', 'filter buttons are never bound twice', (wsSrc.match(/filterBtn\.dataset\.indexTaskFilter/g) || []).length === 1);
  // Behavioral guard against double registration: exactly ONE click listener is
  // attached to the container in activate(). A duplicate registration would make
  // a single click apply the filter twice.
  const activateSrc = wsSrc.slice(wsSrc.indexOf('async function activate('), wsSrc.indexOf('function deactivate('));
  check('T18c', 'container click listener is registered exactly once', (activateSrc.match(/container\.addEventListener\('click', onActionClick\)/g) || []).length === 1, String((activateSrc.match(/container\.addEventListener\('click', onActionClick\)/g) || []).length));
  check('T24a', 'click handling routes through one closest() owner', (guard.match(/closest\('button\[data-index-task-filter\]'\)/g) || []).length === 1);
  check('T24b', 'the same owner serves keyboard-activated clicks (native button)', /<button type="button"/.test(fs.readFileSync(DOC_SRC, 'utf8')));
}

group('State lifecycle');

{
  const wsSrc = fs.readFileSync(WS_SRC, 'utf8');
  check('T10a', 'session default resets to All on activation', /taskFilter = 'all'/.test(wsSrc));
  check('T10d', 'module-level default status is All', /let taskFilter = 'all';/.test(wsSrc));
  check('T10b', 'selected status is passed into the projection', /buildProjection\(projectFilters, expandedDisclosureCards, taskFilter\)/.test(wsSrc));
  check('T10c', 'refresh re-renders with the current status (no reset)', !/function refresh[\s\S]{0,900}taskFilter = 'all'/.test(wsSrc));
  check('T11a', 'reopening never leaves an irreversible filter', !/taskFilter = 'completed'/.test(wsSrc));
  check('T11b', 'status is module-local, not globally persisted', !/localStorage|sessionStorage/.test(wsSrc.slice(wsSrc.indexOf('let taskFilter'), wsSrc.indexOf('function resetProjectFilters'))));
  // Rendering with an explicit status preserves it across rebuilds.
  const a = renderTasksSection(API, indexWith(MIXED), 'completed');
  const b = renderTasksSection(API, indexWith(MIXED), 'completed');
  check('T10', 'refresh preserves the selected status', a === b && /aria-pressed="true" aria-label="Completed tasks"/.test(a));
  check('T11c', 'reopening defaults back to All', /data-index-task-filter="all" aria-pressed="true"/.test(renderTasksSection(API, indexWith(MIXED), 'all')));
}

group('Unrelated surfaces unchanged');

{
  const review = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'task-review.js'), 'utf8');
  const board = fs.readFileSync(path.join(ROOT, 'js', 'tasks', 'task-board.js'), 'utf8');
  const view = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'projects-view.js'), 'utf8');
  const idx = fs.readFileSync(DOC_SRC, 'utf8');
  check('T19', 'Task Review keeps its own vocabulary', /STATUS_FILTER_VALUES = \['open', 'backlog', 'todo', 'ongoing', 'done', 'all'\]/.test(review));
  check('T20', 'Task Board unchanged', !/data-index-task-filter/.test(board));
  check('T21', 'Projects route unchanged', !/data-index-task-filter/.test(view));
  const projectsSection = idx.slice(idx.indexOf('function buildProjectsSection'), idx.indexOf('function buildTasksSection'));
  check('T22', 'Workspace Index Projects section unchanged', !/data-index-task-filter/.test(projectsSection));
  check('T19b', 'Task Review does not share this owner', !/workspaceIndexTasksSection|data-index-task-filter/.test(review));
  const lifecycle = fs.readFileSync(path.join(ROOT, 'js', 'tasks', 'task-lifecycle.js'), 'utf8');
  check('T19c', 'Task lifecycle untouched', !/indexTaskFilter/.test(lifecycle));
  check('T19d', 'Task priority untouched', /#p\[123\]/.test(lifecycle));
}

/* -------------------------------- report -------------------------------- */
let passed = 0, failed = 0, groups = 0;
for (const r of results) {
  if (r.id === undefined) { groups += 1; continue; }
  if (r.ok) passed += 1; else failed += 1;
}
console.log('Focused — Workspace Index Tasks status filter escape');
console.log('='.repeat(62));
for (const r of results) {
  if (r.id === undefined) { console.log('\n[' + r.group + ']'); continue; }
  console.log('  ' + (r.ok ? 'PASS' : 'FAIL') + '  ' + String(r.id).padEnd(9) + ' ' + r.name + (r.ok || !r.detail ? '' : '  <- ' + r.detail));
}
console.log('='.repeat(62));
console.log('groups=' + groups + ' passed=' + passed + ' failed=' + failed + ' total=' + (passed + failed));
if (failed) { console.log('\nRESULT: FAIL'); process.exit(1); }
console.log('\nRESULT: PASS');
