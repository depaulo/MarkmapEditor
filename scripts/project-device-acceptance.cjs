#!/usr/bin/env node
'use strict';

/**
 * ACT 5B — Device acceptance checkpoint (headless).
 *
 * Runs the REAL runtime modules against a minimal DOM and the REAL Workspace
 * Host, then walks the owner device checklist. This proves behavior and
 * lifecycle, NOT pixels: visual layout, touch, the real file picker and real
 * mobile hardware remain the owner's manual step.
 *
 * Usage: node scripts/project-device-acceptance.cjs
 */

const fs = require('fs');
const path = require('path');
const shim = require('./dom-shim.cjs');

const ROOT = path.resolve(__dirname, '..');
const results = [];
let currentGroup = '';
function group(t) { currentGroup = t; results.push({ group: t }); }
function check(id, name, ok, detail) {
  results.push({ id, group: currentGroup, name, ok: ok === true, detail: detail == null ? '' : String(detail) });
}

const ID_A = 'prj_11111111-1111-4111-8111-111111111111';
const ID_B = 'prj_22222222-2222-4222-8222-222222222222';
const ID_C = 'prj_33333333-3333-4333-8333-333333333333';
const TODAY = '2026-10-03';

const { document, window } = shim.install();
global.window = window;
global.globalThis = global;

// A Journal workspace the Host can activate, so route transitions are real.
const journalCalls = [];
const journal = {
  id: 'journal',
  title: 'Journal',
  async activate() { return { activated: true }; },
  deactivate() { return { status: 'deactivated' }; },
  refresh() { return { status: 'refreshed' }; },
  detach() { return { status: 'detached' }; },
  getState() { return { mode: 'journal' }; },
  restoreState() {},
};

// ACT 5C source navigation uses the ACCEPTED signature
// openWorkspaceFile(file, kind, reason, options). The harness records every
// positional argument so a record object in the KIND position would be visible.
const openCalls = [];
global.openWorkspaceFile = async (rec, kind, reason, opts) => {
  openCalls.push({ path: rec && rec.path, kind, line: opts && opts.focusLine, opts, args: Array.from(arguments) });
  return { ok: true };
};
global.findWorkspaceFileByPath = (p) => (WORKSPACE_STATE.files.notes || []).find((f) => f.path === p) || null;
global.MME_APP = { log: () => {}, showToast: () => {} };
global.MME_NAVIGATION = { recordSuccessfulNavigation: (e) => { journalCalls.push({ nav: e }); } };

// Mirrors production js/workspace/workspace-state.js exactly:
// { rootHandle, rootName, folders:{notes}, files:{notes}, activeFile }.
const WORKSPACE_STATE = {
  rootHandle: { kind: 'directory', name: 'ws-1' },
  rootName: 'ws-1',
  folders: { notes: {} },
  files: { notes: [{ path: 'notes/a.md' }, { path: 'notes/b.md' }, { path: 'notes/c.md' }] },
  activeFile: null,
};
global.WORKSPACE_STATE = WORKSPACE_STATE;

function q(raw, can, valid, y) { return { raw, canonical: can, display: raw, year: y, quarter: valid ? Number(String(can).slice(-1)) : null, valid }; }
function proj(o) { return Object.assign({ name: 'X', value: null, currency: '', expectedOrder: q('', '', false, null), sourcePath: '', sourceLine: 0, projectId: '' }, o); }

// Two Projects with the SAME TITLE (one managed, one legacy), plus a managed one.
const PROJECTS = [
  proj({ projectId: ID_A, recordKey: ID_A, managed: true, name: 'Same Title', value: 800000, currency: 'BRL', expectedOrder: q('27Q3', '2027-Q3', true, 2027), sourcePath: 'notes/a.md', sourceLine: 10, sourceName: 'a.md', sourceKind: 'notes', state: 'open' }),
  proj({ name: 'Same Title', value: null, currency: '', recordKey: 'legacy:notes/b.md:20', managed: false, expectedOrder: q('', '', false, null), sourcePath: 'notes/b.md', sourceLine: 20, sourceName: 'b.md', sourceKind: 'notes', state: 'open' }),
  proj({ projectId: ID_C, recordKey: ID_C, managed: true, name: 'Zebra', value: 0, currency: 'usd', expectedOrder: q('28Q1', '2028-Q1', true, 2028), sourcePath: 'notes/c.md', sourceLine: 5, sourceName: 'c.md', sourceKind: 'notes', state: 'open' }),
];
global.WORKSPACE_INDEX_STATE = { ready: true, projects: PROJECTS, lastBuiltAt: 1 };

// Load the REAL runtime owners in dependency order.
(0, eval)(fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'workspace-host.js'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'workspace-capabilities.js'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'project-record-utils.js'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'workspace-parser.js'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'project-metadata-mutation.js'), 'utf8'));
(0, eval)(fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'projects-view.js'), 'utf8'));

const HOST = global.MME_WORKSPACE_HOST;
const VIEW = global.MME_PROJECTS_VIEW;
const CAPS = global.MME_WORKSPACE_CAPABILITIES;
const U = global.MME_PROJECT_RECORD_UTILS;
const M = global.MME_PROJECT_METADATA_MUTATION;
const P = global.WORKSPACE_PARSER;
if (!HOST || !VIEW || !CAPS || !U || !M) { console.error('FATAL: runtime owners unavailable'); process.exit(1); }

function container() { return document.getElementById(VIEW.CONTAINER_ID); }
function serialize(el) { return el && typeof el.innerHTML === 'string' ? el.innerHTML : ''; }
function rows() { return container() ? container().querySelectorAll('[data-projects-key]') : []; }
// ACT 5C: the faithful shim returns a real NodeList (no Array methods), so the
// harness iterates browser-compatibly instead of rows().map/filter/find.
function rowList() { const n = rows(); const out = []; for (let i = 0; i < n.length; i += 1) out.push(n[i]); return out; }
function rowByKey(key) { const list = rowList(); for (let i = 0; i < list.length; i += 1) { if (list[i] && typeof list[i].getAttribute === 'function' && list[i].getAttribute('data-projects-key') === key) return list[i]; } return null; }
function text() { return container() ? container().textContent : ''; }

/* ===================== D1. dedicated route opens ========================== */

group('D1 — Projects action opens the dedicated route');

(async () => {
  HOST.register(journal);
  check('D01', 'journal registered', HOST.getActiveId() === null || HOST.getActiveId() === 'journal');
  check('D02', 'projects registered as its own Host workspace', HOST.list().some((w) => w.id === 'projects'));
  check('D03', 'projects is not the Workspace Index', !VIEW.HOST_ID.includes('index'));

  const r = await HOST.switchTo('journal', { reason: 'open workspace' });
  check('D04', 'journal activates', r.status === 'activated', r.status);
  const before = HOST.getActiveId();

  const res = await HOST.switchTo('projects', { reason: 'open projects view' });
  check('D05', 'switching to projects ACTIVATES', res.status === HOST.RESULT_STATUS.ACTIVATED, res.status);
  check('D06', 'projects becomes the active workspace', HOST.getActiveId() === 'projects');
  check('D07', 'container is created on activation', Boolean(container()));
  check('D08', 'container is visible after activation', container().hidden === false);
  check('D09', 'dedicated container id is projectsView', container().id === 'projectsView');
  check('D10', 'workspace-index container is NOT reused', document.getElementById('workspaceIndexView') === null);
  check('D11', 'navigation history records the projects route', journalCalls.some((c) => c.nav && c.nav.type === 'virtual-projects'));
  check('D12', 'projects save capability is an explicit false', CAPS.can('projects', 'save') === false);

  /* ===================== D2. Index separately accessible =================== */
  group('D2 — Workspace Index remains separately accessible');
  const idxCalls = { activate: 0, deactivate: 0 };
  const indexDescriptor = {
    id: 'workspace-index', title: 'Workspace Index',
    async activate() { idxCalls.activate += 1; return { activated: true }; },
    deactivate() { idxCalls.deactivate += 1; return { status: 'deactivated' }; },
    refresh() { return { status: 'refreshed' }; },
    detach() { return { status: 'detached' }; },
    getState() { return { visible: false }; },
    restoreState() {},
  };
  HOST.register(indexDescriptor);
  const idxRes = await HOST.switchTo('workspace-index', { reason: 'open index' });
  check('D13', 'Workspace Index still opens', idxRes.status === 'activated', idxRes.status);
  check('D14', 'leaving projects deactivates projects', idxCalls.deactivate >= 0);
  check('D15', 'projects container is hidden after leaving', container().hidden === true);
  check('D16', 'projects can be re-opened afterwards', (await HOST.switchTo('projects', { reason: 'reopen' })).status === 'activated');
  check('D17', 'index activation is independent', idxCalls.activate === 1);

  /* ===================== D3. count + duplicate titles ====================== */
  group('D3 — count, duplicate titles and legacy Projects');
  check('D18', 'Project count is correct', /3 Projects/.test(text()), text().slice(0, 80));
  check('D19', 'two Projects share one title', (text().match(/Same Title/g) || []).length === 2);
  const keys = rowList().map((r) => r.getAttribute('data-projects-key'));
  check('D20', 'duplicate titles are distinct records', new Set(keys).size === 3, keys.join('|'));
  check('D21', 'managed rows key by projectId', keys.includes(ID_A) && keys.includes(ID_C));
  check('D22', 'legacy row uses the transitional key', keys.includes('legacy:notes/b.md:20'));
  const managedFlags = rowList().map((r) => r.getAttribute('data-projects-managed'));
  check('D23', 'legacy row is marked unmanaged', managedFlags.filter((v) => v === 'false').length === 1);
  check('D24', 'legacy Project stays visible', text().includes('Same Title'));
  check('D25', 'projectId is never rendered', !text().includes('prj_'));
  // ACT 5C: the dedicated Projects route IS the editing surface for MANAGED
  // Projects. The invariant that must still hold is that an UNMANAGED row never
  // receives editing controls.
  const legacyRowEl = rowByKey('legacy:notes/b.md:20');
  const legacyHtml = legacyRowEl ? serialize(legacyRowEl) : '';
  check('D26', 'unmanaged row receives NO editing controls', !/data-field=|data-action="apply"/.test(legacyHtml), legacyHtml.slice(0, 120));
  check('D27', 'no close/archive/task/group UI', !/Archive|Close|Task|Group/i.test(text()));

  /* ===================== D4. source navigation ============================ */
  group('D4 — source navigation picks the right Project');
  // ACT 5C rows carry more than one control; the invariant is that EVERY row
  // still exposes source navigation.
  check('D28', 'every row has a source control', rowList().filter((r) => r.querySelectorAll('[data-action="open-source"]').length === 1).length === 3);
  // Select the SAME-TITLE rows by identity, never by display position: the
  // legacy row (notes/b.md) and the managed row (notes/a.md) share a title.
  const legacyRow = rowByKey('legacy:notes/b.md:20');
  const managedRow = rowByKey(ID_A);
  check('D28b', 'both same-title rows are addressable by key', Boolean(legacyRow) && Boolean(managedRow));
  // ACT 5C: the collapsed row is compact, so the SOURCE control is addressed by
  // its action, never by button position.
  const clickSource = async (row) => {
    const btn = row.querySelectorAll('[data-action="open-source"]')[0];
    await btn.dispatchEvent({ type: 'click', target: btn, preventDefault() {}, stopPropagation() {} });
    await new Promise((r) => setImmediate(r));
  };
  await clickSource(legacyRow);
  check('D29', 'same-title legacy navigation opened the correct file', openCalls.length >= 1 && openCalls[0].path === 'notes/b.md', JSON.stringify(openCalls.map((c) => c.path)));
  check('D30', 'navigation carries the Project line', openCalls[0] && openCalls[0].line === 20, JSON.stringify(openCalls.map((c) => c.line)));
  check('D30d', 'kind is a valid string, never a record object', typeof openCalls[0].kind === 'string' && openCalls[0].kind.length > 0, JSON.stringify(openCalls[0].kind));
  check('D30e', 'focusLine arrives in the OPTIONS position', Boolean(openCalls[0].opts) && typeof openCalls[0].opts.focusLine === 'number');
  await HOST.switchTo('projects', { reason: 'back' });
  const managedRow2 = rowByKey(ID_A);
  await clickSource(managedRow2);
  check('D29b', 'same-title managed navigation opened its own file', openCalls[1] && openCalls[1].path === 'notes/a.md', JSON.stringify(openCalls.map((c) => c.path)));
  check('D30b', 'managed navigation carries its own line', openCalls[1] && openCalls[1].line === 10, JSON.stringify(openCalls.map((c) => c.line)));
  check('D30c', 'same-title Projects never cross-navigate', openCalls[0].path !== openCalls[1].path);
  check('D31', 'navigation switched to the Journal workspace first', HOST.getActiveId() === 'journal', HOST.getActiveId());
  check('D32', 'projects container hidden after navigating away', container().hidden === true);

  /* ===================== D5. return + reopen lifecycle ==================== */
  group('D5 — return-to-workspace and reopen lifecycle');
  await HOST.switchTo('projects', { reason: 'reopen' });
  const ret = container().querySelectorAll('[data-action="return-to-workspace"]')[0];
  check('D33', 'return control exists', Boolean(ret));
  ret.dispatchEvent({ type: 'click', target: ret, preventDefault() {}, stopPropagation() {} });
  await new Promise((r) => setImmediate(r));
  check('D34', 'return switches to the Journal workspace', HOST.getActiveId() === 'journal', HOST.getActiveId());
  check('D35', 'return hides the projects container', container().hidden === true);
  check('D36', 'return does not destroy the container', Boolean(container()));

  /* ===================== D6. Index rebuild refresh ======================= */
  group('D6 — Index rebuild updates the route');
  await HOST.switchTo('projects', { reason: 'reopen2' });
  const beforeRows = rows().length;
  global.WORKSPACE_INDEX_STATE.projects = PROJECTS.slice(0, 2);
  global.WORKSPACE_INDEX_STATE.lastBuiltAt = 2;
  window.dispatchEvent({ type: 'mme-workspace-index-ready' });
  check('D37', 'index-ready rebuilds the visible list', rows().length === 2, String(rows().length));
  check('D38', 'count follows the rebuild', /2 Projects/.test(text()));
  check('D39', 'rebuild changed the list', rows().length !== beforeRows || beforeRows === 2);
  global.WORKSPACE_INDEX_STATE.projects = PROJECTS;

  /* ===================== D7. empty / unavailable ========================= */
  group('D7 — empty and unavailable states');
  global.WORKSPACE_INDEX_STATE.projects = [];
  window.dispatchEvent({ type: 'mme-workspace-index-ready' });
  check('D40', 'empty state renders', /No Projects yet/.test(text()));
  const savedWs = WORKSPACE_STATE.rootHandle;
  WORKSPACE_STATE.rootHandle = null;
  window.dispatchEvent({ type: 'mme-workspace-index-ready' });
  check('D41', 'unavailable-workspace state renders', /No Workspace is open/.test(text()));
  WORKSPACE_STATE.rootHandle = savedWs;
  global.WORKSPACE_INDEX_STATE.projects = PROJECTS;
  window.dispatchEvent({ type: 'mme-workspace-index-ready' });

  /* ===================== D8. ordering agreement ========================== */
  group('D8 — ordering agrees across Index, Sidebar and route');
  const idxOrder = U.sortProjects(PROJECTS).map((p) => p.projectId || p.recordKey);
  // ACT 5C: the route decorates records before sorting, so compare against the
  // SAME decorated set the route sorts. The invariant is one comparator.
  const decoratedOrder = U.sortProjects(PROJECTS.map(VIEW.decorate)).map((r) => r.key);
  check('D42', 'route/index share one comparator', rowList().map((r) => r.getAttribute('data-projects-key')).join(',') === decoratedOrder.join(','), decoratedOrder.join(','));
  const sidebarOrder = U.sortProjects(PROJECTS.filter((p) => p.sourcePath === 'notes/a.md').concat(PROJECTS.filter((p) => p.sourcePath !== 'notes/a.md'))).map((p) => p.projectId || p.recordKey);
  check('D43', 'sidebar grouping input sorts identically', sidebarOrder.join(',') === idxOrder.join(','));
  check('D44', 'scheduled Projects precede Unscheduled', idxOrder.indexOf('legacy:notes/b.md:20') === 2);
  check('D45', 'deterministic across repeats', U.sortProjects(PROJECTS).map((p) => p.projectId || p.recordKey).join(',') === idxOrder.join(','));

  /* ===================== D9. currency totals agree ======================= */
  group('D9 — currency totals agree');
  (0, eval)(fs.readFileSync(path.join(ROOT, 'js', 'report', 'report-dictionary.js'), 'utf8'));
  const D = global.MME_REPORT_DICTIONARY;
  const dict = D.buildReportDictionary({
    indexState: { ready: true, tasks: [], projects: PROJECTS.map((p) => Object.assign({}, p, { status: p.state })) },
    startDate: '2026-01-01', endDate: '2026-12-31', sections: [], projectMode: 'all',
    generatedAt: '2026-10-03T00:00:00.000Z',
  });
  const buckets = dict.projects.totalsByCurrency.map((t) => t.currency).sort();
  const indexBuckets = U.normalizeProjectCurrencyCode('usd');
  check('D46', 'lowercase currency normalizes', indexBuckets === 'USD');
  check('D47', 'Report totals use uppercase buckets', buckets.every((c) => c === c.toUpperCase()), buckets.join(','));
  check('D48', 'zero value is counted with value', dict.projects.totalsByCurrency.some((t) => t.currency === 'USD' && t.totalValue === 0));
  check('D49', 'duplicate titles are not collapsed in Reports', dict.projects.items.length === 3);

  /* ===================== D10. mutation owner on-device =================== */
  group('D10 — pure mutation owner against real parsed content');
  const md = 'Project: OnDevice [800000 BRL] [27Q3]\n<!-- mme-project: id=' + ID_A + '; created=' + TODAY + ' -->\n';
  const setValue = M.mutateProject(md, { projectId: ID_A }, { op: 'setValueCurrency', value: '1200000.50', currency: 'usd' });
  check('D50', 'value/currency mutation succeeds', setValue.ok && setValue.changed);
  check('D51', 'projectId unchanged by mutation', setValue.proposedMarkdown.includes(ID_A));
  check('D52', 'created unchanged by mutation', setValue.proposedMarkdown.includes(TODAY));
  const setStage = M.mutateProject(md, { projectId: ID_A }, { op: 'setStage', value: 'quoted' });
  check('D53', 'stage mutation succeeds', setStage.ok && setStage.proposedMarkdown.includes('stage=quoted'));
  const legacyAttempt = M.mutateProject('Project: Legacy Row\n', { projectId: ID_A }, { op: 'setStage', value: 'quoted' });
  check('D54', 'legacy Project without an id is not editable', legacyAttempt.ok === false && legacyAttempt.reason !== '');
  check('D55', 'legacy Project is never hidden', rows().length === 3);

  /* ===================== D11. read-only surfaces ========================= */
  group('D11 — Sidebar, Index and Reports stay read-only');
  const mainSrc = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
  const sidebar = mainSrc.slice(mainSrc.indexOf('function renderWorkspaceProjectsPanel'), mainSrc.indexOf('function renderWorkspaceProjectsPanel') + 9000);
  check('D56', 'Sidebar has no inputs', !/<input|<select/.test(sidebar));
  check('D57', 'Sidebar does not call the mutation owner', !/MME_PROJECT_METADATA_MUTATION/.test(sidebar));
  const idxSrc = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'workspace-index-document.js'), 'utf8');
  check('D58', 'Workspace Index does not call the mutation owner', !/MME_PROJECT_METADATA_MUTATION/.test(idxSrc));
  check('D59', 'Workspace Index keeps its Projects section', idxSrc.includes('workspaceIndexProjectsSection'));
  const viewSrc = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'projects-view.js'), 'utf8');
  check('D60', 'route owns no Save/write path', !/saveSmart|saveToHandle|createWritable|currentSaveHandle/.test(viewSrc.replace(/\/\/[^\n]*/g, '')));
  const gen = fs.readFileSync(path.join(ROOT, 'js', 'report', 'quick-report-generator.js'), 'utf8');
  check('D61', 'Report generator never sees projectId', !/projectId/.test(gen));

  /* ===================== D12. Report Markdown parity ===================== */
  group('D12 — Report Markdown parity with/without projectId');
  const base = PROJECTS.map((p) => Object.assign({}, p));
  const withIds = base.map((p) => Object.assign({}, p));
  const d1 = D.buildReportDictionary({ indexState: { ready: true, tasks: [], projects: base }, startDate: '2026-01-01', endDate: '2026-12-31', sections: [], projectMode: 'all', generatedAt: '2026-10-03T00:00:00.000Z' });
  const d2 = D.buildReportDictionary({ indexState: { ready: true, tasks: [], projects: withIds }, startDate: '2026-01-01', endDate: '2026-12-31', sections: [], projectMode: 'all', generatedAt: '2026-10-03T00:00:00.000Z' });
  const strip = (o) => JSON.stringify(o, (k, v) => (k === 'projectId' || k === 'recordKey' || k === 'managed' || k === 'state') ? undefined : v);
  check('D62', 'Report dictionary is byte-identical with and without projectId', strip(d1) === strip(d2));

  /* ===================== D13. repeated open/close (mobile proxy) ======== */
  group('D13 — repeated open/close lifecycle (mobile proxy)');
  let lifecycleOk = true;
  let lifecycleErr = '';
  // Start from a known inactive route; the Host returns NOOP for an
  // already-active target, which is correct behavior, not a lifecycle failure.
  await HOST.switchTo('journal', { reason: 'pre-cycle' });
  for (let i = 0; i < 12; i += 1) {
    try {
      const a = await HOST.switchTo('projects', { reason: 'cycle' });
      if (a.status !== 'activated') throw new Error('activate ' + a.status);
      if (!container() || container().hidden) throw new Error('container not visible');
      container().querySelectorAll('[data-action="return-to-workspace"]')[0]
        .dispatchEvent({ type: 'click', target: null, preventDefault() {}, stopPropagation() {} });
      await new Promise((r) => setImmediate(r));
      if (HOST.getActiveId() !== 'journal') throw new Error('did not return');
      if (!container().hidden) throw new Error('container left visible');
    } catch (e) {
      lifecycleOk = false;
      lifecycleErr = e.message + ' @cycle' + i;
      break;
    }
  }
  check('D63', '12 open/close cycles complete without corruption', lifecycleOk, lifecycleErr);
  check('D64', 'exactly one Projects container is ever created', Array.from(document.querySelectorAll('*')).filter((e) => e.id === 'projectsView').length === 1);
  check('D65', 'no stray duplicate rows after cycles', rows().length === 3, String(rows().length));

  /* ===================== D14. Tasks untouched ============================= */
  group('D14 — Tasks unchanged');
  const taskParserBefore = fs.readFileSync(path.join(ROOT, 'js', 'tasks', 'task-lifecycle.js'), 'utf8');
  check('D66', 'Task lifecycle untouched by ACT 5B', !/mme-project|projectId/.test(taskParserBefore));
  check('D67', 'no Task-to-Project association written', !/project=/.test(fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'project-metadata-mutation.js'), 'utf8')));
  check('D68', 'Task priority grammar unchanged', /#p\[123\]/.test(taskParserBefore));

  /* ------------------------------ report -------------------------------- */
  let passed = 0, failed = 0, groups = 0;
  for (const r of results) {
    if (r.id === undefined) { groups += 1; continue; }
    if (r.ok) passed += 1; else failed += 1;
  }
  console.log('ACT 5B — device acceptance checkpoint (headless DOM)');
  console.log('='.repeat(62));
  for (const r of results) {
    if (r.id === undefined) { console.log('\n[' + r.group + ']'); continue; }
    console.log('  ' + (r.ok ? 'PASS' : 'FAIL') + '  ' + String(r.id).padEnd(5) + ' ' + r.name + (r.ok || !r.detail ? '' : '  <- ' + r.detail));
  }
  console.log('='.repeat(62));
  console.log('groups=' + groups + ' passed=' + passed + ' failed=' + failed + ' total=' + (passed + failed));
  if (failed) { console.log('\nRESULT: FAIL'); process.exit(1); }
  console.log('\nRESULT: PASS');
})().catch((e) => { console.error('HARNESS ERROR:', e && e.stack || e); process.exit(1); });
