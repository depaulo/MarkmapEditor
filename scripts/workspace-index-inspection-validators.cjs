#!/usr/bin/env node
'use strict';

/**
 * Focused — P6 ACT 2 Slice 2: Workspace Index inspection & return recovery.
 *
 * Loads the REAL js/workspace/workspace-index-workspace.js against the DOM
 * shim with a modeled Host and behaviorally proves, at the rendered
 * interface level (not helper-only):
 *  - the Return row renders escaped with a matching aria-label;
 *  - a successful source open arms the destination-labeled recovery control
 *    and that control is wired to the existing switchTo owner;
 *  - missing source keeps the originating surface (exact-path lookup, no
 *    open attempt, no switch, bounded toast, no arm);
 *  - cancelled / failed / thrown opens roll back to Index with bounded
 *    distinct copy and never arm the control;
 *  - session filter state survives close/reopen;
 *  - no Save entry point is reached and no persistent storage is used.
 *
 * Usage: node scripts/workspace-index-inspection-validators.cjs
 */

const fs = require('fs');
const path = require('path');
const shim = require('./dom-shim.cjs');

const ROOT = path.resolve(__dirname, '..');
const WS_SRC = path.join(ROOT, 'js', 'workspace', 'workspace-index-workspace.js');

const results = [];
let currentGroup = '';
function group(t) { currentGroup = t; results.push({ group: t }); }
function check(id, name, ok, detail) {
  results.push({ id, group: currentGroup, name, ok: ok === true, detail: detail == null ? '' : String(detail) });
}

// ---- modeled environment ---------------------------------------------------
const { document, window } = shim.install();
global.window = window;
global.document = document;

// Toolbar host for the recovery control (#layout already exists in the shim).
const toolbar = document.createElement('div');
toolbar.id = 'toolbar';
document.body.appendChild(toolbar);

const PROJECTION =
  '<section id="ixSection">' +
  '<button type="button" data-action="open-workspace-file" data-path="notes/ix-a.md" data-kind="notes">Open source</button>' +
  '<button type="button" data-project-filter="value" data-project-filter-value="delivered">Delivered</button>' +
  '</section>';

const rec = { kind: 'notes', name: 'ix-a.md', path: 'notes/ix-a.md', handle: {} };
const st = {
  switches: [], toasts: [], opens: [], lookups: [], saves: 0,
  projectionCalls: [], openResult: () => ({ ok: true, ready: true }),
  fileRecord: rec,
};

globalThis.MME_APP = {
  log: () => {},
  showToast: (msg, kind) => { st.toasts.push({ msg: String(msg), kind: String(kind || '') }); },
};
globalThis.APP_MODE_SESSIONS = { journal: { fileName: 'ix <a>.md' } };
globalThis.findWorkspaceFileByPath = (p, k) => {
  st.lookups.push({ p: String(p), k: String(k || '') });
  return st.fileRecord && st.fileRecord.path === p ? st.fileRecord : null;
};
globalThis.openWorkspaceFile = async () => { st.opens.push(1); return st.openResult(); };
// Any Save entry point counts — must stay zero for the whole suite.
globalThis.saveSmart = () => { st.saves += 1; };
globalThis.saveToHandle = async () => { st.saves += 1; };

globalThis.MME_WORKSPACE_INDEX_DOCUMENT = {
  buildProjection: (filters, expanded, task) => {
    st.projectionCalls.push({
      filters: JSON.parse(JSON.stringify(filters || {})),
      task: String(task || ''),
    });
    return PROJECTION;
  },
};

let desc = null;
globalThis.MME_WORKSPACE_HOST = Object.freeze({
  register: (d) => { desc = d; },
  getActiveId: () => 'journal',
  list: () => ['journal', 'workspace-index'],
  RESULT_STATUS: Object.freeze({ ACTIVATED: 'activated' }),
  switchTo: async (id, opts) => {
    st.switches.push({ id: String(id), reason: String((opts && opts.reason) || '') });
    if (id === 'workspace-index' && desc && typeof desc.activate === 'function') await desc.activate();
    return { status: 'activated' };
  },
});

// Load the REAL module (self-registers into the modeled host).
require(path.join(ROOT, 'js', 'workspace', 'workspace-index-workspace.js'));

const tick = async () => { await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0)); };
const container = () => document.getElementById('workspaceIndexView');
const recBtn = () => document.getElementById('mmeWsIndexReturnToIndex');
const click = (el) => el.dispatchEvent({ type: 'click', target: el, preventDefault() {}, stopPropagation() {} });
const openActionBtn = () => container().querySelector('[data-action="open-workspace-file"]');

(async function run() {
  // ---- activation & rendered return grammar -------------------------------
  group('Activation and rendered return grammar');
  await desc.activate();
  const html0 = container() ? container().innerHTML : '';
  check('IX01', 'Return row renders escaped with a matching aria-label', Boolean(container()) && container().hidden === false && html0.includes('Return to ix &lt;a&gt;.md') && html0.includes('aria-label="Return to ix &lt;a&gt;.md"') && !html0.includes('Return to ix <a>'), html0.slice(0, 160));
  check('IX02', 'recovery control is created hidden before any inspection', Boolean(recBtn()) && recBtn().hidden === true && !document.documentElement.hasAttribute('data-workspace-index-inspection'), String(recBtn() && recBtn().hidden));

  // ---- successful inspection arms the recovery control --------------------
  group('Successful inspection arms the recovery control');
  const opensBefore = st.opens.length;
  click(openActionBtn());
  await tick();
  const btn = recBtn();
  check('IX03', 'successful open renders the recovery control, labeled and armed', st.opens.length === opensBefore + 1 && Boolean(btn) && btn.hidden === false && btn.textContent === 'Return to Workspace Index' && btn.getAttribute('aria-label') === 'Return to Workspace Index' && document.documentElement.getAttribute('data-workspace-index-inspection') === 'true', JSON.stringify({ opens: st.opens.length, hidden: btn && btn.hidden }));

  const switchesBefore = st.switches.length;
  click(btn);
  await tick();
  const lastSwitch = st.switches[st.switches.length - 1];
  check('IX04', 'recovery control returns via the existing switchTo owner and dismisses', st.switches.length === switchesBefore + 1 && lastSwitch.id === 'workspace-index' && /inspection return/.test(lastSwitch.reason) && recBtn().hidden === true && !document.documentElement.hasAttribute('data-workspace-index-inspection'), JSON.stringify(lastSwitch));

  // ---- missing source preserves the originating surface -------------------
  group('Missing and failed opens preserve the originating surface');
  st.fileRecord = null;
  const opensB1 = st.opens.length;
  const switchesB1 = st.switches.length;
  click(openActionBtn());
  await tick();
  const toastMiss = st.toasts[st.toasts.length - 1];
  check('IX05', 'missing source: surface stays, exact-path lookup, no open/switch/arm', st.opens.length === opensB1 && st.switches.length === switchesB1 && Boolean(container()) && container().hidden === false && recBtn().hidden === true && Boolean(toastMiss) && /^File not found: /.test(toastMiss.msg) && st.lookups[st.lookups.length - 1].p === 'notes/ix-a.md', JSON.stringify(toastMiss));

  // ---- cancelled open rolls back ------------------------------------------
  st.fileRecord = rec;
  st.openResult = () => ({ ok: false, cancelled: true, reason: 'guard' });
  const switchesB2 = st.switches.length;
  click(openActionBtn());
  await tick();
  const toastCancel = st.toasts[st.toasts.length - 1];
  const switchCancel = st.switches[st.switches.length - 1];
  check('IX06', 'cancelled open rolls back to Index with bounded cancel copy, no arm', st.switches.length === switchesB2 + 2 && st.switches[switchesB2].id === 'journal' && switchCancel.id === 'workspace-index' && Boolean(toastCancel) && toastCancel.msg === 'File open cancelled' && toastCancel.kind === 'warn' && recBtn().hidden === true, JSON.stringify({ attempt: st.switches[switchesB2], switchCancel, toastCancel }));

  // ---- non-cancel failure rolls back with distinct copy --------------------
  st.openResult = () => ({ ok: false, cancelled: false, reason: 'guard' });
  const switchesB3 = st.switches.length;
  click(openActionBtn());
  await tick();
  const toastFail = st.toasts[st.toasts.length - 1];
  const switchFail = st.switches[st.switches.length - 1];
  check('IX07', 'failed open rolls back with distinct failure copy (not cancel, not empty)', st.switches.length === switchesB3 + 2 && st.switches[switchesB3].id === 'journal' && switchFail.id === 'workspace-index' && Boolean(toastFail) && toastFail.msg === 'Source could not be opened' && toastFail.kind === 'error' && recBtn().hidden === true && !/No Projects|empty/i.test(toastFail.msg), JSON.stringify({ attempt: st.switches[switchesB3], switchFail, toastFail }));

  // ---- thrown open rolls back ----------------------------------------------
  st.openResult = () => { throw new Error('open-boom'); };
  const switchesB4 = st.switches.length;
  click(openActionBtn());
  await tick();
  const switchThrow = st.switches[st.switches.length - 1];
  check('IX08', 'thrown open rolls back to Index (never stranded, never arm)', st.switches.length === switchesB4 + 2 && st.switches[switchesB4].id === 'journal' && switchThrow.id === 'workspace-index' && recBtn().hidden === true, JSON.stringify({ attempt: st.switches[switchesB4], last: switchThrow }));
  st.openResult = () => ({ ok: true, ready: true });

  // ---- session state retention across close/reopen -------------------------
  group('Session state retention across close/reopen');
  const vBtn = container().querySelector('[data-project-filter="value"]');
  click(vBtn);
  await tick();
  const afterFilter = st.projectionCalls[st.projectionCalls.length - 1];
  check('IX09', 'value filter change rerenders with the retained filter', afterFilter.filters.valueMode === 'delivered', JSON.stringify(afterFilter.filters));
  desc.deactivate();
  check('IX10', 'deactivate hides the surface (session state kept)', container().hidden === true, String(container().hidden));
  await desc.activate();
  const afterReopen = st.projectionCalls[st.projectionCalls.length - 1];
  check('IX11', 'close/reopen preserves session filters — no reset in activate', afterReopen.filters.valueMode === 'delivered' && afterReopen.task === 'all', JSON.stringify(afterReopen));

  // ---- no Save, no persistence ---------------------------------------------
  group('No Save, no persistence, no mutation');
  const wsSrc = fs.readFileSync(WS_SRC, 'utf8');
  check('IX12', 'no Save entry point was reached during the suite', st.saves === 0, String(st.saves));
  check('IX13', 'workspace module uses no persistent storage', !/localStorage|sessionStorage|indexedDB/.test(wsSrc.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')));
  check('IX14', 'recovery label is static destination text (no dynamic insertion)', wsSrc.includes("b.textContent = 'Return to Workspace Index'") && wsSrc.includes("b.setAttribute('aria-label', 'Return to Workspace Index')"));
  check('IX15', 'failure copy never presents as an empty-workspace state', st.toasts.every((t) => !/empty workspace/i.test(t.msg)));

  /* -------------------------------- report -------------------------------- */
  let passed = 0, failed = 0, groups = 0;
  for (const r of results) {
    if (r.id === undefined) { groups += 1; continue; }
    if (r.ok) passed += 1; else failed += 1;
  }
  console.log('Focused — Workspace Index inspection and return recovery (P6 Slice 2)');
  console.log('='.repeat(62));
  for (const r of results) {
    if (r.id === undefined) { console.log('\n[' + r.group + ']'); continue; }
    console.log('  ' + (r.ok ? 'PASS' : 'FAIL') + '  ' + String(r.id).padEnd(9) + ' ' + r.name + (r.ok || !r.detail ? '' : '  <- ' + r.detail));
  }
  console.log('='.repeat(62));
  console.log('groups=' + groups + ' passed=' + passed + ' failed=' + failed + ' total=' + (passed + failed));
  if (failed) { console.log('\nRESULT: FAIL'); process.exit(1); }
  console.log('\nRESULT: PASS');
})().catch((e) => {
  console.error('SUITE DRIVER ERROR:', e && e.stack || e);
  process.exit(1);
});
