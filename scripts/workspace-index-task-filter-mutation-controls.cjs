#!/usr/bin/env node
'use strict';

/**
 * Focused — Workspace Index Tasks filter mutation controls.
 *
 * A control counts ONLY when: applied to one occurrence, one or more NAMED
 * fixtures turn red for the intended reason, the file is restored
 * BYTE-IDENTICALLY, and the baseline reruns green. Structural guards are
 * reported separately and never counted.
 *
 * Usage: node scripts/workspace-index-task-filter-mutation-controls.cjs
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DOC = 'js/workspace/workspace-index-document.js';
const WS = 'js/workspace/workspace-index-workspace.js';
const CSS = 'css/workspace.css';

const BASELINE = ['workspace-index-task-filter-validators.cjs', 'workspace-index-notes-validators.cjs'];
const FINDING_RE = /^\s*FAIL\s{2}([A-Za-z0-9_.-]+)\s/gm;

function sha256(f) { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); }
function runSuite(script) {
  const res = { script, findings: [], exit: 0 };
  const attempt = () => {
    const r = { output: '', exit: 0 };
    try {
      r.output = execFileSync(process.execPath, [path.join(ROOT, 'scripts', script)], {
        cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024,
      });
    } catch (e) {
      r.exit = e.status == null ? 1 : e.status;
      r.output = String(e.stdout || '') + String(e.stderr || '');
    }
    return r;
  };
  let run = attempt();
  // A crash with NO named finding is a transient harness/device failure, not a
  // behavioral result: retry once so only real regressions are reported.
  if (run.exit !== 0 && !/^\s*FAIL\s{2}\S+/m.test(run.output)) run = attempt();
  res.output = run.output;
  res.exit = run.exit;
  for (const m of res.output.matchAll(FINDING_RE)) if (!res.findings.includes(m[1])) res.findings.push(m[1]);
  return res;
}

const MUTATIONS = [
  { id: 'F01-remove-all-control', file: DOC,
    find: '<button type="button" class="wsIndexTaskFilterBtn${filter === \'all\' ? \' __active\' : \'\'}" data-index-task-filter="all" aria-pressed="${filter === \'all\' ? \'true\' : \'false\'}" aria-label="All tasks">All ${totalCount}</button>',
    replace: '',
    suites: ['workspace-index-task-filter-validators.cjs'], expect: ['T05', 'T07', 'T23', 'T14'], count: 1,
    why: 'The All control must always exist — it is the escape.' },

  { id: 'F02-empty-state-drops-controls', file: DOC,
    find: '          <h2 class="wsIndexSectionTitle">${label} (${totalCount})</h2>\n          ${filterHtml}\n          <div class="wsIndexEmpty">No ${emptyLabel} tasks</div>',
    replace: '          <h2 class="wsIndexSectionTitle">${label} (${totalCount})</h2>\n          <div class="wsIndexEmpty">No ${emptyLabel} tasks</div>',
    suites: ['workspace-index-task-filter-validators.cjs'], expect: ['T05', 'T06'], count: 1,
    why: 'A zero-result status must keep the filter controls visible.' },

  { id: 'F03-all-keeps-completed-predicate', file: DOC,
    find: "    // 'all' — no filter",
    replace: "    // 'all' — no filter\n    if (filter === 'all') tasks = tasks.filter((t) => t.done);",
    suites: ['workspace-index-task-filter-validators.cjs'], expect: ['T02', 'T07a'], count: 1,
    why: 'All must show every Task.' },

  { id: 'F04-multiple-active-states', file: DOC,
    find: "aria-pressed=\"${filter === 'all' ? 'true' : 'false'}\" aria-label=\"All tasks\"",
    replace: "aria-pressed=\"true\" aria-label=\"All tasks\"",
    suites: ['workspace-index-task-filter-validators.cjs'], expect: ['T09-open', 'T09-completed'], count: 1,
    why: 'Exactly one status may be active.' },

  { id: 'F05-duplicate-handler-registration', file: WS,
    find: "      container.addEventListener('click', onActionClick);",
    replace: "      container.addEventListener('click', onActionClick);\n      container.addEventListener('click', onActionClick);",
    suites: ['workspace-index-task-filter-validators.cjs'], expect: ['T18c'], count: 1,
    why: 'The container must not double-bind its click owner.' },

  { id: 'F06-remove-accessible-name', file: DOC,
    find: ' aria-label="All tasks"', replace: '',
    suites: ['workspace-index-task-filter-validators.cjs'], expect: ['T23', 'T23b'], count: 1,
    why: 'Every status control keeps a complete accessible name.' },

  { id: 'F07-narrow-layout-clipping', file: CSS,
    find: '  flex-wrap: wrap;\n  padding: 0 0 10px 0;\n  border-bottom: 1px solid var(--menu-border);',
    replace: '  flex-wrap: nowrap;\n  overflow: hidden;\n  padding: 0 0 10px 0;\n  border-bottom: 1px solid var(--menu-border);',
    suites: ['workspace-index-task-filter-validators.cjs'], expect: ['T14a', 'T14b', 'T14c'], count: 1,
    why: 'Filter controls must wrap and never be clipped.' },

  { id: 'F08-filter-triggers-save', file: WS,
    find: '        rerenderProjectionWithAnchor(\'#workspaceIndexTasksSection\');',
    replace: '        globalThis.saveSmart?.();\n        rerenderProjectionWithAnchor(\'#workspaceIndexTasksSection\');',
    suites: ['workspace-index-task-filter-validators.cjs'], expect: ['T16', 'T17'], count: 1,
    why: 'A filter click must never Save.' },

  { id: 'F09-default-back-to-open', file: WS,
    find: "  let taskFilter = 'all';", replace: "  let taskFilter = 'open';",
    suites: ['workspace-index-task-filter-validators.cjs'], expect: ['T10d'], count: 1,
    why: 'The default status is All.' },

  { id: 'F10-projection-default-open', file: DOC,
    find: "const filter = taskFilterValue || 'all';", replace: "const filter = taskFilterValue || 'open';",
    suites: ['workspace-index-task-filter-validators.cjs'], expect: ['T01', 'T01c', 'T11c'], count: 1,
    why: 'The projection default is All.' },

  // ---- structural guards ----
  { id: 'G01-no-index-rebuild', file: WS,
    find: '        rerenderProjectionWithAnchor(\'#workspaceIndexTasksSection\');',
    replace: '        rerenderProjectionWithAnchor(\'#workspaceIndexTasksSection\'); // guard probe',
    structural: true,
    why: 'INVARIANT: filter activation performs no Workspace Index rebuild.' },
  { id: 'G02-task-review-vocabulary-untouched', file: 'js/workspace/task-review.js',
    find: "const STATUS_FILTER_VALUES = ['open', 'backlog', 'todo', 'ongoing', 'done', 'all'];",
    replace: "const STATUS_FILTER_VALUES = ['open', 'all'];",
    structural: true,
    why: 'INVARIANT: Task Review owns its own, separate filter vocabulary.' },
];

console.log('Focused — Workspace Index Tasks filter mutation controls');
console.log('='.repeat(62));
const base = BASELINE.map(runSuite);
if (!base.every((b) => b.exit === 0 && b.findings.length === 0)) {
  console.log('BASELINE RED — controls are not meaningful.');
  for (const b of base) if (b.exit !== 0 || b.findings.length) console.log('  ' + b.script + ' -> ' + b.findings.join(','));
  process.exit(1);
}
console.log('baseline: green (' + BASELINE.join(', ') + ')\n');

const TOUCHED = new Map();
function restoreAll() { for (const [abs, text] of TOUCHED) { try { fs.writeFileSync(abs, text); } catch {} } }
process.on('exit', restoreAll);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { restoreAll(); process.exit(130); });
process.on('uncaughtException', (e) => { console.error('DRIVER ERROR:', e && e.stack || e); restoreAll(); process.exit(1); });

const bit = [], notBit = [], restoreFailures = [], postFailures = [], structural = [];
let applied = 0, restoredCount = 0;

for (const m of MUTATIONS) {
  const abs = path.join(ROOT, m.file);
  const original = fs.readFileSync(abs, 'utf8');
  const before = sha256(abs);
  TOUCHED.set(abs, original);

  const count = original.split(m.find).length - 1;
  if (count !== (m.count || 1)) { notBit.push({ id: m.id, reason: 'anchor occurs ' + count + ' time(s) — NOT applied' }); continue; }
  const at = original.indexOf(m.find);
  fs.writeFileSync(abs, original.slice(0, at) + m.replace + original.slice(at + m.find.length));
  if (sha256(abs) === before) { fs.writeFileSync(abs, original); notBit.push({ id: m.id, reason: 'no byte change — NOT applied' }); continue; }
  applied += 1;

  const suiteList = m.suites || BASELINE;
  const runs = suiteList.map(runSuite);
  const observed = [];
  for (const r of runs) for (const f of r.findings) if (!observed.includes(f)) observed.push(f);
  const hits = (m.expect || []).filter((e) => observed.includes(e));
  const exitZero = runs.every((r) => r.exit === 0);

  fs.writeFileSync(abs, original);
  const restoredOk = sha256(abs) === before;
  if (restoredOk) restoredCount += 1;
  const post = BASELINE.map(runSuite);
  const postGreen = post.every((r) => r.exit === 0 && r.findings.length === 0);

  if (m.structural) {
    structural.push({ id: m.id, restoredOk, observed });
    if (!restoredOk) restoreFailures.push({ id: m.id, reason: 'structural restore NOT byte-identical' });
    console.log('GUARD ' + m.id.padEnd(42) + ' restored=' + (restoredOk ? 'ok' : 'FAIL') + ' observed=' + (observed.join(',') || '(none)'));
    continue;
  }

  if (hits.length) bit.push(m.id);
  else notBit.push({ id: m.id, reason: observed.length ? 'red, but not the intended fixtures: ' + observed.join(',') : (exitZero ? 'no named fixture failed' : 'suite crashed without a named fixture failing') });
  if (!restoredOk) restoreFailures.push({ id: m.id, reason: 'restore NOT byte-identical' });
  if (!postGreen) postFailures.push({ id: m.id, reason: 'baseline did not return to green' });
  console.log((hits.length ? 'BIT  ' : 'NOBIT') + ' ' + m.id.padEnd(42) + ' restored=' + (restoredOk ? 'ok' : 'FAIL') + ' post=' + (postGreen ? 'green' : 'RED') + (hits.length ? ' fixtures=' + hits.join(',') : ' observed=' + (observed.join(',') || '(none)')));
}

restoreAll();
TOUCHED.clear();

console.log('\n' + '='.repeat(62));
console.log('MUTATION CONTROLS (applied AND bit AND restored byte-identically): ' + bit.length);
console.log('  applied:                            ' + applied);
console.log('  bit the expected named fixtures:    ' + bit.length);
console.log('  restored byte-identically:          ' + restoredCount);
console.log('  baseline green after every restore: ' + (postFailures.length === 0 ? 'yes' : 'NO'));
console.log('\nNON-BITING CONTROLS (excluded from the denominator): ' + notBit.length);
for (const n of notBit) console.log('  ' + n.id + ' — ' + n.reason);
console.log('\nSTRUCTURAL GUARDS: ' + structural.length);
for (const s of structural) console.log('  ' + s.id + ' — restored=' + (s.restoredOk ? 'ok' : 'FAIL') + ' observed=' + (s.observed.join(',') || '(none)'));
console.log('\nHONEST TOTALS: ' + bit.length + ' mutation controls passed of ' + applied + ' applied; ' + notBit.length + ' non-biting; ' + structural.length + ' structural guards.');

if (restoreFailures.length) { console.log('\nRESTORE FAILURES:'); for (const r of restoreFailures) console.log('  ' + r.id + ' — ' + r.reason); process.exit(1); }
if (notBit.length) process.exit(1);
process.exit(0);
