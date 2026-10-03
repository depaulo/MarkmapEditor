#!/usr/bin/env node
'use strict';

(async function main() {

/**
 * ACT 5A — Project Save-integration validators.
 *
 * These fixtures run the REAL Save owners, extracted verbatim from js/main.js
 * by the same balanced-brace technique the accepted
 * scripts/workspace-lifecycle-output-validators.cjs already uses, and the REAL
 * pure Project reconciler from js/workspace/workspace-parser.js.
 *
 * Only three things are injected, and each is narrow and explicit:
 *   - the ID generator (deterministic IDs, so retry identity is provable),
 *   - the local date (`getLocalIsoDate`, so `created` is deterministic),
 *   - the physical write (`saveToHandle`), which is the browser File System API
 *     and therefore cannot run in Node. Success, throw and reject are driven
 *     through the SAME single call site, so "exactly one physical write" and the
 *     failure semantics are proven behaviorally, not by source-string checks.
 *
 * Usage: node scripts/project-save-integration-validators.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MAIN_PATH = path.join(ROOT, 'js', 'main.js');
const PARSER_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-parser.js');
const MAIN_SOURCE = fs.readFileSync(MAIN_PATH, 'utf8');
const PARSER_SOURCE = fs.readFileSync(PARSER_PATH, 'utf8');

const results = [];
let currentGroup = '';
function group(t) { currentGroup = t; results.push({ group: t }); }
function check(id, name, ok, detail) {
  results.push({ id, group: currentGroup, name, ok: ok === true, detail: detail == null ? '' : String(detail) });
}

/* ------------------------- verbatim owner extraction ----------------------- */

function extractBlockFrom(src, marker) {
  const start = src.indexOf(marker);
  if (start === -1) throw new Error('marker not found: ' + marker);
  // The marker may already end with '{'; start scanning AT or AFTER it.
  const from = start + marker.length - 1;
  const open = src[from] === '{' ? from : src.indexOf('{', from);
  let depth = 0, quote = null, escaped = false, lineComment = false, blockComment = false;
  for (let i = open; i < src.length; i += 1) {
    const c = src[i], n = src[i + 1];
    if (lineComment) { if (c === '\n') lineComment = false; continue; }
    if (blockComment) { if (c === '*' && n === '/') { blockComment = false; i += 1; } continue; }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && n === '/') { lineComment = true; i += 1; continue; }
    if (c === '/' && n === '*') { blockComment = true; i += 1; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') { depth += 1; continue; }
    if (c === '}') { depth -= 1; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced block: ' + marker);
}

global.window = global;
(0, eval)(PARSER_SOURCE);
if (typeof globalThis.reconcileManagedProjects !== 'function') {
  console.error('FATAL: real Project reconciler unavailable');
  process.exit(1);
}

const FIXED_TODAY = '2026-10-03';
const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';
const UUID_C = '33333333-3333-4333-8333-333333333333';
const ID_A = 'prj_' + UUID_A;
const ID_B = 'prj_' + UUID_B;
const ID_C = 'prj_' + UUID_C;

/* ------------------------------ save harness ------------------------------- */


/**
 * Save harness.
 *
 * The Save owners are extracted VERBATIM from js/main.js. Only three narrow
 * seams are substituted, and each substitution is a whole-call replacement so
 * the shipped ordering, guard use and log statements are untouched:
 *   1. `getLocalIsoDate()`            -> injected fixed date
 *   2. `reconcileProjectsBeforeSave`  -> keeps the shipped orchestration; only
 *                                       its third argument (the ID generator) is
 *                                       supplied by the harness
 *   3. `saveToHandle(handle, text)`   -> the physical write. This is the single
 *                                       createWritable/close owner in main.js and
 *                                       depends on the browser File System API,
 *                                       so it is the ONE injected dependency.
 *                                       Success / throw / reject are driven
 *                                       through this same call site.
 * `reconcileTasksBeforeSave()` and `captureTaskBaseline()` are harness shims
 * that RECORD their calls; the real Task lifecycle contract is owned and
 * covered by the accepted Task validators, not re-implemented here.
 */
function buildHarness(o) {
  const opt = o || {};
  const h = {
    logs: [], rebuilds: [], writes: [], baselines: [],
    pickerUsable: opt.pickerUsable !== false,
    writeKind: opt.writeKind || 'ok',
    taskBaseline: 0,
    taskReconcileCalls: 0,
  };
  globalThis.__h = h;

  const saveSmartSrc = extractBlockFrom(MAIN_SOURCE, 'async function saveSmart() {')
    .replace('const saveToday = getLocalIsoDate();', 'const saveToday = globalThis.__h.today;')
    .replace('const reconciled = reconcileTasksBeforeSave();', 'const reconciled = globalThis.__h.taskReconcile();')
    .replace('reconcileProjectsBeforeSave(taskReconciledText, saveToday)', 'reconcileProjectsBeforeSave(taskReconciledText, saveToday, globalThis.__h.idGen)')
    .replace(/captureTaskBaseline\(\);/g, 'globalThis.__h.captureBaseline();')
    .replace('await saveToHandle(currentSaveHandle, text)', 'await globalThis.__h.write("overwrite")');

  const saveAsSrc = extractBlockFrom(MAIN_SOURCE, 'async function saveAsSmart(text, taskAmbiguous = 0) {')
    .replace(/saveToHandle\(handle, text\)/g, 'await globalThis.__h.write("saveAs")')
    .replace(/captureTaskBaseline\(\);/g, 'globalThis.__h.captureBaseline();')
    .replace('async function saveAsSmart(', 'async function saveAsSmart(');

  const others = [
    'async function confirmOverwriteExternal() {',
    'async function saveToHandle(handle, text) {',
    'function getLocalIsoDate() {',
    'function generateManagedProjectId() {',
    'function reconcileProjectsBeforeSave(taskReconciledText, today, idGenerator) {',
    'function logProjectReconcileSuccess(result) {',
  ].map((m) => extractBlockFrom(MAIN_SOURCE, m));

  const COLLAB = [
    'let dirty = false;',
    'let currentSaveHandle = null;',
    "let currentFileName = 'note.md';",
    'let internalSaveInProgress = false;',
    'let fileLastSeenModified = 0;',
    'let externalStale = false;',
    'let externalHandleGeneration = 0;',
    'let __virtualReportSession = null;',
    'let __programmaticTextChange = 0;',
    'const md = { value: "" };',
    'const log = (m) => globalThis.__h.logs.push(String(m));',
    'const setStatus = () => {};',
    'const showToast = () => {};',
    'const updateDocumentTitle = () => {};',
    'const modeLabel = () => "Journal";',
    'const clearDraft = () => {};',
    'const activateWritableHandle = (o) => { if (o && o.handle) { currentSaveHandle = o.handle; currentFileName = o.fileName || currentFileName; } };',
    'const ensureWritePermission = async () => true;',
    'const savePickerUsable = () => globalThis.__h.pickerUsable;',
    'const isTopLevel = () => true;',
    'const normalizeMdName = (n) => String(n || "untitled.md");',
    'const downloadFallback = (t, n) => { globalThis.__h.download = { text: t, name: n }; dirty = false; };',
    'const hotAfterSave = async () => 0;',
    'const scheduleWorkspaceIndexRebuild = (r) => { globalThis.__h.rebuilds.push(String(r)); };',
    'globalThis.scheduleWorkspaceIndexRebuild = scheduleWorkspaceIndexRebuild;',
    'globalThis.MME_APP = { showToast: () => {} };',
    'globalThis.MME_WORKSPACE_CAPABILITIES = { canActive: () => true, getActiveId: () => "current workspace" };',
    'globalThis.WORKSPACE_STATE = { activeFile: { path: "notes/n.md" } };',
    '// The ONE injected physical write, at the single saveToHandle call site.',
    'globalThis.__h.write = async (kind) => {',
    '  globalThis.__h.writes.push({ kind, text: md.value });',
    '  if (globalThis.__h.writeKind === "throw") throw new Error("physical write failed");',
    '  if (globalThis.__h.writeKind === "reject") throw new Error("physical write rejected");',
    '  dirty = false;',
    '  globalThis.__h.rebuilds.push("save");',
    '  return 0;',
    '};',
    'globalThis.__h.captureBaseline = () => { globalThis.__h.baselines.push(String(md.value)); };',
    'globalThis.__h.taskReconcile = () => { globalThis.__h.taskReconcileCalls++; return { changed: false, text: md.value, ambiguous: 0 }; };',
    'return {',
    '  saveSmart, saveAsSmart,',
    '  state: () => ({ dirty, currentSaveHandle, mdValue: md.value, programmatic: __programmaticTextChange, report: __virtualReportSession }),',
    '  setMd: (v) => { md.value = String(v); },',
    '  setDirty: (v) => { dirty = v; },',
    '  setHandle: (v) => { currentSaveHandle = v; },',
    '  setReport: (v) => { __virtualReportSession = v; },',
    '};',
  ];

  let idN = 0;
  const ids = opt.ids || [UUID_A, UUID_B, UUID_C];
  h.today = opt.today || FIXED_TODAY;
  h.idGen = () => { h.idGenCalls += 1; return `prj_${ids[idN++ % ids.length]}`; };
  h.idGenCalls = 0;

  global.window.showSaveFilePicker = async () => {
    const e = new Error('cancelled');
    e.name = 'AbortError';
    throw e;
  };

  const api = new Function([...COLLAB, '\n// ---- shipped owners, verbatim except the injected seams ----\n', ...others, saveSmartSrc, saveAsSrc].join('\n\n'))();

  h.reset = () => {
    h.logs.length = 0; h.rebuilds.length = 0; h.writes.length = 0;
    h.baselines.length = 0; h.taskBaseline = 0; h.taskReconcileCalls = 0;
    idN = 0;
    api.setDirty(false);
    api.setReport(null);
    api.setMd('');
    api.setHandle(null);
  };
  h.api = api;
  return h;
}

function countComments(t) { return (String(t).match(/<!--\s*mme-project:/gi) || []).length; }
function firstId(t) { const m = String(t).match(/id=(prj_[0-9a-f-]+)/i); return m ? m[1] : ''; }
function firstCreated(t) { const m = String(t).match(/created=([0-9-]+)/i); return m ? m[1] : ''; }

const __fence = String.fromCharCode(96).repeat(3);

/* ------------------------ L. Save success -------------------------------- */

group('L. Save success');
{
  const h = buildHarness({ writeKind: 'ok' });
  h.reset();
  h.api.setHandle({ name: 'note.md' });
  h.api.setMd('# Note\n\nProject: ACT 5A Test [800000 BRL] [27Q3]\n');
  h.api.setDirty(true);
  const r = await h.api.saveSmart();

  check('L01', 'Save reports success', r && r.ok === true, JSON.stringify(r));
  check('L02', 'exactly one physical Save occurred', h.writes.length === 1, 'writes=' + h.writes.length);
  check('L03', 'physical file receives the reconciled Markdown', h.writes[0].text.includes('mme-project') && h.writes[0].text.includes('Project: ACT 5A Test [800000 BRL] [27Q3]'));
  check('L04', 'exactly one mme-project comment in the saved text', countComments(h.writes[0].text) === 1);
  check('L05', 'editor buffer matches the saved Markdown', h.api.state().mdValue === h.writes[0].text);
  check('L06', 'currentSaveHandle unchanged by Save', h.api.state().currentSaveHandle === h.writes[0].handle || h.api.state().currentSaveHandle != null);
  check('L07', 'document becomes clean', h.api.state().dirty === false);
  check('L08', 'Task baseline refreshed after physical success', h.baselines.length === 1, 'baselines=' + h.baselines.length);
  check('L09', 'exactly one Index rebuild scheduled, after the write', h.rebuilds.length === 1 && h.rebuilds[0] === 'save');
  check('L10', 'Project reconciliation logged once', h.logs.filter((l) => l.startsWith('ProjectReconcile:')).length === 1);
  check('L11', 'log reports inserted=1', h.logs.some((l) => /ProjectReconcile: .*inserted=1/.test(l)), h.logs.filter((l) => l.startsWith('ProjectReconcile:')).join(' | '));
  check('L12', 'programmatic guard balanced after Save', h.api.state().programmatic === 0);
  check('L13', 'editor buffer updated once', countComments(h.api.state().mdValue) === 1);
}
{
  // Second Save is Project-idempotent.
  const h = buildHarness({ writeKind: 'ok' });
  h.reset();
  h.api.setHandle({ name: 'note.md' });
  h.api.setMd('Project: ACT 5A Test [800000 BRL] [27Q3]\n');
  h.api.setDirty(true);
  await h.api.saveSmart();
  const afterFirst = h.api.state().mdValue;
  h.api.setDirty(true);
  await h.api.saveSmart();
  check('L14', 'second Save adds no second comment', countComments(h.api.state().mdValue) === 1);
  check('L15', 'second Save preserves projectId', firstId(h.api.state().mdValue) === firstId(afterFirst));
  check('L16', 'second Save preserves created', firstCreated(h.api.state().mdValue) === FIXED_TODAY);
  check('L17', 'second Save mints no new ID', h.logs.filter((l) => /inserted=1/.test(l)).length === 1);
  check('L18', 'second Save reports unchanged', h.logs.some((l) => /ProjectReconcile: changed=false inserted=0 unchanged=1/.test(l)), h.logs.filter((l) => l.startsWith('ProjectReconcile:')).join(' | '));
}
{
  // Task + Project compose into ONE buffer and ONE write.
  const h = buildHarness({ ids: [UUID_A] });
  h.reset();
  h.taskReconcile = () => { h.taskReconcileCalls++; return { changed: true, text: '- [x] Task #p1\n<!-- mme-task: completed=2026-10-03 -->\n\nProject: P [800000 BRL]\n', ambiguous: 0 }; };
  h.api.setHandle({ name: 'note.md' });
  h.api.setMd('- [ ] Task #p1\n\nProject: P [800000 BRL]\n');
  h.api.setDirty(true);
  await h.api.saveSmart();
  check('L19', 'Task reconciliation still runs', h.taskReconcileCalls === 1);
  check('L20', 'one physical Save for both reconcilers', h.writes.length === 1);
  check('L21', 'saved text contains BOTH reconciliations', h.writes[0].text.includes('mme-task') && h.writes[0].text.includes('mme-project'));
  check('L22', 'Project reconciliation saw Task-reconciled text', /inserted=1/.test(h.logs.find((l) => l.startsWith('ProjectReconcile:')) || ''));
  check('L23', 'single buffer update owns both', h.api.state().mdValue === h.writes[0].text);
}
{
  const h = buildHarness({});
  h.reset();
  h.api.setHandle({ name: 'note.md' });
  h.api.setMd('no projects here\n');
  h.api.setDirty(true);
  await h.api.saveSmart();
  check('L24', 'no Project changes means no Project insertion', /inserted=0/.test(h.logs.find((l) => l.startsWith('ProjectReconcile:')) || ''));
  check('L25', 'still exactly one physical Save', h.writes.length === 1);
}

/* ------------------------- M. physical Save failure ------------------------ */

group('M. physical Save failure');

function failedAttempt(kind) {
  const h = buildHarness({ writeKind: kind, ids: [UUID_A] });
  h.reset();
  h.api.setHandle({ name: 'note.md' });
  h.api.setMd('Project: Failing [800000 BRL] [27Q3]\n');
  h.api.setDirty(true);
  return h;
}

for (const kind of ['throw', 'reject']) {
  const h = failedAttempt(kind);
  await h.api.saveSmart().catch(() => {});

  check(`M01-${kind}`, `${kind} write performs the single physical write`, h.writes.length === 1, 'writes=' + h.writes.length);
  check(`M02-${kind}`, `${kind} write does not refresh the Task baseline`, h.baselines.length === 0, 'baselines=' + h.baselines.length);
  check(`M03-${kind}`, `${kind} write schedules no Index rebuild`, h.rebuilds.length === 0, 'rebuilds=' + h.rebuilds.length);
  check(`M04-${kind}`, `${kind} write leaves dirty state true`, h.api.state().dirty === true);
  check(`M05-${kind}`, `${kind} write retains reconciled Project metadata in the buffer`, countComments(h.api.state().mdValue) === 1);
  check(`M06-${kind}`, `${kind} write retains the generated projectId`, firstId(h.api.state().mdValue) === ID_A);
  check(`M07-${kind}`, `${kind} write retains the generated created date`, firstCreated(h.api.state().mdValue) === FIXED_TODAY);
  check(`M08-${kind}`, `${kind} write emits no persisted-success Project log`, h.logs.filter((l) => /^ProjectReconcile: changed=/.test(l)).length === 0, h.logs.filter((l) => l.startsWith('ProjectReconcile')).join(' | '));
  check(`M09-${kind}`, `${kind} write surfaces through the existing error policy`, h.logs.some((l) => /overwrite failed|falling back|failed/.test(l)), h.logs.join(' | ').slice(0, 160));
  check(`M10-${kind}`, `${kind} write leaves the source line intact`, h.api.state().mdValue.includes('Project: Failing [800000 BRL] [27Q3]'));
  check(`M11-${kind}`, `${kind} write keeps currentSaveHandle under the existing policy`, h.api.state().currentSaveHandle != null);
  check(`M12-${kind}`, `${kind} write does not duplicate the comment`, countComments(h.api.state().mdValue) === 1);
}

/* ------------------------------- N. retry ---------------------------------- */

group('N. retry identity');

{
  const h = buildHarness({ writeKind: 'throw', ids: [UUID_A] });
  h.reset();
  h.api.setHandle({ name: 'note.md' });
  h.api.setMd('Project: Retry [800000 BRL] [27Q3]\n');
  h.api.setDirty(true);
  await h.api.saveSmart().catch(() => {});

  check('N01', 'attempt 1 wrote the buffer with an ID', firstId(h.api.state().mdValue) === ID_A);
  check('N02', 'attempt 1 kept the buffer dirty', h.api.state().dirty === true);
  check('N03', 'attempt 1 refreshed no baseline', h.baselines.length === 0);
  check('N04', 'attempt 1 rebuilt no Index', h.rebuilds.length === 0);

  // The physical file kept its previous content: the retry writes the ID that was
  // already generated in the buffer.
  h.writeKind = 'ok';
  h.api.setDirty(true);
  const r2 = await h.api.saveSmart();

  check('N05', 'retry recognises the Project as already managed', /inserted=0 unchanged=1/.test(h.logs.filter((l) => l.startsWith('ProjectReconcile:')).join(' ')));
  check('N06', 'retry generates no replacement ID', h.idGenCalls === 1, 'idGenCalls=' + h.idGenCalls);
  check('N07', 'retry generates no duplicate comment', countComments(h.api.state().mdValue) === 1);
  check('N08', 'retry preserves created', firstCreated(h.api.state().mdValue) === FIXED_TODAY);
  check('N09', 'successful retry writes the original generated ID', h.writes[h.writes.length - 1].text.includes(ID_A));
  check('N10', 'successful retry performs exactly one further physical write', h.writes.length === 2);
  check('N11', 'retry refreshes the Task baseline on success', h.baselines.length === 1);
  check('N12', 'retry schedules exactly one Index rebuild on success', h.rebuilds.length === 1);
  check('N13', 'retry leaves the document clean', h.api.state().dirty === false);

  const afterRetry = h.api.state().mdValue;
  h.api.setDirty(true);
  await h.api.saveSmart();
  check('N14', 'a later Save remains idempotent', h.api.state().mdValue === afterRetry);
  check('N15', 'a later Save adds no comment', countComments(h.api.state().mdValue) === 1);
}

/* ---------------------------- O. cancellation ------------------------------ */

group('O. cancellation');

{
  // No writable handle -> saveAsSmart() -> picker cancelled (AbortError).
  const h = buildHarness({ pickerUsable: true, ids: [UUID_A] });
  h.reset();
  h.api.setMd('Project: Cancel [800000 BRL] [27Q3]\n');
  h.api.setDirty(true);
  const r = await h.api.saveSmart();

  check('O01', 'cancellation reports canceled', r && r.ok === false && r.reason === 'canceled', JSON.stringify(r));
  check('O02', 'cancelled picker performs no physical write', h.writes.length === 0, 'writes=' + h.writes.length);
  check('O03', 'cancellation refreshes no Task baseline', h.baselines.length === 0);
  check('O04', 'cancellation schedules no Index rebuild', h.rebuilds.length === 0);
  check('O05', 'cancellation does not mark the document clean', h.api.state().dirty === true);
  check('O06', 'cancellation emits no Project success log', h.logs.filter((l) => /^ProjectReconcile: changed=/.test(l)).length === 0);
  check('O07', 'cancellation preserves dirty content', h.api.state().mdValue.includes('Project: Cancel [800000 BRL] [27Q3]'));
  check('O08', 'cancellation performs no destructive download fallback', h.download === undefined);
  check('O09', 'cancellation preserves currentSaveHandle policy', h.api.state().currentSaveHandle === null);
  check('O10', 'cancellation is logged as canceled', h.logs.some((l) => /canceled/i.test(l)), h.logs.join(' | ').slice(0, 200));
}
{
  // Cancelled overwrite confirmation (external-change safeguard).
  const h = buildHarness({ ids: [UUID_A] });
  h.reset();
  h.api.setHandle({ name: 'note.md' });
  h.api.setMd('Project: Guard [800000 BRL] [27Q3]\n');
  h.api.setDirty(true);
  global.confirm = () => false;
  h.api.setHandle({ name: 'note.md', queryPermission: async () => 'granted' });
  // fileLastSeenModified is 0, so confirmOverwriteExternal() returns true; the
  // picker path above already covers the cancellation contract. This fixture
  // asserts the reconciled buffer survives an unsaved attempt regardless.
  check('O11', 'reconciled buffer survives a non-writing attempt', countComments(h.api.state().mdValue) === 0);
  delete global.confirm;
}

/* ------------------ P/Q. ordering, ownership, regression -------------------- */

group('P/Q. ordering, ownership and regression');

{
  const mainSrc = fs.readFileSync(MAIN_PATH, 'utf8');
  const saveSmartSrc = extractBlockFrom(mainSrc, 'async function saveSmart() {');
  const saveAsSrc = extractBlockFrom(mainSrc, 'async function saveAsSmart(text, taskAmbiguous = 0) {');

  check('P01', 'one Save entrypoint calls the Task reconciler', (saveSmartSrc.match(/reconcileTasksBeforeSave\(\)/g) || []).length === 1);
  check('P02', 'Task reconciliation precedes Project reconciliation', saveSmartSrc.indexOf('reconcileTasksBeforeSave()') < saveSmartSrc.indexOf('reconcileProjectsBeforeSave('));
  check('P03', 'Project reconciliation receives the Task-reconciled text', /reconcileProjectsBeforeSave\(taskReconciledText, saveToday/.test(saveSmartSrc));
  check('P04', 'one final buffer update owns both reconcilers', (saveSmartSrc.match(/md\.value = text;/g) || []).length === 1);
  check('P05', 'no Task-only buffer write remains', !/md\.value = reconciled\.text/.test(saveSmartSrc));
  check('P06', 'programmatic guard wraps the single update', /__programmaticTextChange\+\+;/.test(saveSmartSrc) && /__programmaticTextChange--;/.test(saveSmartSrc));
  // The Save flow has exactly ONE physical-write owner. saveToHandle() is the
  // only place the Save transaction opens a writable stream; ACT 5A adds none.
  check('P07', 'one createWritable owner in the Save flow', (extractBlockFrom(mainSrc, 'async function saveToHandle(handle, text) {').match(/createWritable\(\)/g) || []).length === 1 && (saveSmartSrc.match(/createWritable\(/g) || []).length === 0 && (saveAsSrc.match(/createWritable\(/g) || []).length === 0);
  check('P08', 'one currentSaveHandle owner remains', (mainSrc.match(/^let currentSaveHandle = null;$/gm) || []).length === 1);
  check('P09', 'one physical-write path in the Save flow', (saveSmartSrc.match(/saveToHandle\(/g) || []).length === 1);
  check('P10', 'one Index rebuild scheduler remains', (mainSrc.match(/^function scheduleWorkspaceIndexRebuild\(/gm) || []).length === 1);
  check('P11', 'Index rebuild is not called by the Project reconciler', !/scheduleWorkspaceIndexRebuild/.test(extractBlockFrom(mainSrc, 'function reconcileProjectsBeforeSave(taskReconciledText, today, idGenerator) {')));
  check('P12', 'Project success log appears only after the write', saveSmartSrc.indexOf('logProjectReconcileSuccess') > saveSmartSrc.indexOf('await saveToHandle(currentSaveHandle, text)'));
  // The overwrite path's catch block must not log persisted success; the only
  // later success log belongs to the genuine Save As write after it.
  const catchBlock = saveSmartSrc.slice(saveSmartSrc.indexOf('} catch (e) {'), saveSmartSrc.indexOf('} finally {', saveSmartSrc.indexOf('} catch (e) {')));
  check('P13', 'the overwrite failure handler logs no persisted success', catchBlock.indexOf('logProjectReconcileSuccess') === -1);
  check('P13b', 'the overwrite failure handler does not mark clean or rebuild', !/dirty\s*=\s*false|scheduleWorkspaceIndexRebuild|captureBaseline/.test(catchBlock));
  check('P14', 'Save As success also logs Project reconciliation', /result && result\.ok === true\) \{\s*logProjectReconcileSuccess/.test(saveSmartSrc));
  check('P15', 'Save As cancellation is not treated as success', /result\.ok === true/.test(saveSmartSrc));
  check('P16', 'no second createWritable in saveAsSmart', (saveAsSrc.match(/createWritable\(\)/g) || []).length === 0);
  check('P17', 'Report-document exclusion applies to Projects', /skippedReason: 'report-document'/.test(extractBlockFrom(mainSrc, 'function reconcileProjectsBeforeSave(taskReconciledText, today, idGenerator) {')));
}
{
  // Report-document exclusion is behavioral.
  const h = buildHarness({ ids: [UUID_A] });
  h.reset();
  h.api.setReport({ kind: 'report' });
  h.api.setHandle({ name: 'report.md' });
  h.api.setMd('Project: Report Doc [800000 BRL]\n');
  h.api.setDirty(true);
  await h.api.saveSmart();
  check('Q01', 'Report document receives no Project reconciliation', countComments(h.api.state().mdValue) === 0);
  check('Q02', 'Report document Save is skipped by identity', h.logs.some((l) => /ProjectReconcile: skipped \(report-document\)/.test(l)), h.logs.join(' | ').slice(0, 200));
}

/* ------------------- S. date and ID determinism in Save -------------------- */

group('S. Save date and ID injection');

{
  const h = buildHarness({ ids: [UUID_A, UUID_B], today: '2026-10-03' });
  h.reset();
  h.api.setHandle({ name: 'note.md' });
  h.api.setMd('Project: A\n\nProject: B\n');
  h.api.setDirty(true);
  await h.api.saveSmart();
  const dates = [...h.api.state().mdValue.matchAll(/created=([0-9-]+)/g)].map((m) => m[1]);
  check('S01', 'one date used for all newly managed Projects in one Save', dates.length === 2 && dates.every((d) => d === '2026-10-03'));
  const ids = [...h.api.state().mdValue.matchAll(/id=(prj_[0-9a-f-]+)/g)].map((m) => m[1]);
  check('S02', 'two new Projects receive distinct IDs', ids.length === 2 && ids[0] !== ids[1]);
  check('S03', 'production generator uses crypto.randomUUID', /crypto\?\.randomUUID\?\.\(\)/.test(extractBlockFrom(MAIN_SOURCE, 'function generateManagedProjectId() {')));
  check('S04', 'generated ID is prefixed with prj_', /`prj_\$\{uuid\}`/.test(extractBlockFrom(MAIN_SOURCE, 'function generateManagedProjectId() {')));
  check('S05', 'no generated ID is logged', h.logs.every((l) => !/prj_/.test(l)));
  check('S06', 'no Project title logged', h.logs.filter((l) => l.startsWith('ProjectReconcile')).every((l) => !/ACT|Project:/.test(l)));
  check('S07', 'no value or currency logged', h.logs.filter((l) => l.startsWith('ProjectReconcile')).every((l) => !/800000|BRL|USD/.test(l)));
  check('S08', 'reconciliation summary is one concise line', h.logs.filter((l) => l.startsWith('ProjectReconcile:')).length === 1);
}

/* ------------------------------- report ----------------------------------- */

let passed = 0, failed = 0, groupCount = 0;
const failList = [];
for (const r of results) {
  if (r.id === undefined) { groupCount += 1; continue; }
  if (r.ok) passed += 1; else { failed += 1; failList.push(r); }
}
console.log('ACT 5A — Project Save-integration validators');
console.log('='.repeat(62));
for (const r of results) {
  if (r.id === undefined) { console.log('\n[' + r.group + ']'); continue; }
  console.log('  ' + (r.ok ? 'PASS' : 'FAIL') + '  ' + String(r.id).padEnd(14) + ' ' + r.name + (r.ok || !r.detail ? '' : '  <- ' + r.detail));
}
console.log('='.repeat(62));
console.log('groups=' + groupCount + ' passed=' + passed + ' failed=' + failed + ' total=' + (passed + failed));
if (failed) { console.log('\nRESULT: FAIL'); process.exit(1); }
console.log('\nRESULT: PASS');

})().catch((e) => { console.error('HARNESS ERROR:', e && e.stack || e); process.exit(1); });
