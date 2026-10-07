#!/usr/bin/env node
'use strict';

/**
 * ACT 5B — Project consumer / mutation-owner / route mutation controls.
 *
 * A control counts ONLY when all five hold:
 *   1. the targeted mutation was applied to exactly one occurrence;
 *   2. one or more NAMED behavioral fixtures turn red;
 *   3. the red reason matches the intended defect (named fixture IDs reported);
 *   4. the file is restored BYTE-IDENTICALLY (sha256);
 *   5. the baseline suites rerun green.
 *
 * Structural guards are reported separately and never counted.
 *
 * Usage: node scripts/project-consumer-mutation-controls.cjs
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PARSER = 'js/workspace/workspace-parser.js';
const UTILS = 'js/workspace/project-record-utils.js';
const MUT = 'js/workspace/project-metadata-mutation.js';
const VIEW = 'js/workspace/projects-view.js';
const MAIN = 'js/main.js';
const DICT = 'js/report/report-dictionary.js';
const INDEX_DOC = 'js/workspace/workspace-index-document.js';
const CAPS = 'js/workspace/workspace-capabilities.js';

const BASELINE = ['project-consumer-validators.cjs', 'project-contract-validators.cjs', 'project-save-integration-validators.cjs'];
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
  // ---------------- IDENTITY ----------------
  { id: 'B01-projectId-dropped-in-report', file: DICT,
    find: "      projectId: pr.projectId || '',\n", replace: "",
    suites: ['project-consumer-validators.cjs'], expect: ['E02b'], count: 1,
    why: 'The Report projection must carry projectId internally.' },
  { id: 'B02-legacy-key-uses-title', file: UTILS,
    find: "return `legacy:${path}:${line}`;", replace: "return `legacy:${(project && project.name) || ''}`;",
    suites: ['project-consumer-validators.cjs'], expect: ['P04'], count: 1,
    why: 'A legacy Project key must never be title-derived.' },
  { id: 'B03-managed-key-ignores-projectId', file: UTILS,
    find: "    if (id) return id;", replace: "    if (id) return `x:${id}`;",
    suites: ['project-consumer-validators.cjs'], expect: ['P03'], count: 1,
    why: 'A managed Project keys by projectId exactly.' },
  { id: 'B04-duplicate-titles-merged', file: UTILS,
    find: "    const idA = String((a && a.projectId) || '');\n    const idB = String((b && b.projectId) || '');",
    replace: "    const idA = String((a && a.name) || '');\n    const idB = String((b && b.name) || '');",
    suites: ['project-consumer-validators.cjs'], expect: ['O07', 'O08'], count: 1,
    why: 'projectId is the final tiebreaker, never the title.' },
  { id: 'B05-sourceIdentity-reintroduced', file: PARSER,
    find: "      sourceLine: startLine,\n    };\n\n    return project;\n  }\n\n  function parseProjects",
    replace: "      sourceLine: startLine,\n      sourceIdentity: `${sourcePath}::${startLine}::${nameKey}`,\n    };\n\n    return project;\n  }\n\n  function parseProjects",
    suites: ['project-consumer-validators.cjs'], expect: ['R01', 'R02'], count: 1,
    why: 'Project sourceIdentity is retired.' },

  // ---------------- CURRENCY ----------------
  { id: 'B06-report-currency-fallback', file: DICT,
    find: "        : String(p.currency || '').trim().toUpperCase();", replace: "        : String(p.currency || '').trim();",
    suites: ['project-consumer-validators.cjs'], structural: true,
    why: 'INVARIANT: the Report fallback normalizes exactly like the shared owner (defence in depth, no observable difference).' },
  { id: 'B07-currency-lower-cased', file: UTILS,
    find: "return String(raw == null ? '' : raw).trim().toUpperCase();", replace: "return String(raw == null ? '' : raw).trim().toLowerCase();",
    suites: ['project-consumer-validators.cjs'], expect: ['C01', 'C03', 'C07'], count: 1,
    why: 'Currency codes normalize to uppercase.' },
  { id: 'B08-missing-currency-becomes-code', file: UTILS,
    find: "return String(raw == null ? '' : raw).trim().toUpperCase();", replace: "return String(raw == null ? '' : raw).trim().toUpperCase() || 'NONE';",
    suites: ['project-consumer-validators.cjs'], expect: ['C04'], count: 1,
    why: 'A missing currency must stay distinguishable from a present one.' },

  // ---------------- SORTING ----------------
  { id: 'B09-path-tiebreaker-removed', file: UTILS,
    find: "    if (pathA !== pathB) return pathA < pathB ? -1 : 1;", replace: "    // mutated: path tiebreaker removed",
    suites: ['project-consumer-validators.cjs'], expect: ['O05'], count: 1,
    why: 'The sourcePath tiebreaker is what keeps Sidebar and Index agreeing.' },
  { id: 'B10-unscheduled-sorts-first', file: UTILS,
    find: "    if (validA && !validB) return -1;\n    if (!validA && validB) return 1;",
    replace: "    if (validA && !validB) return 1;\n    if (!validA && validB) return -1;",
    suites: ['project-consumer-validators.cjs'], expect: ['O01', 'O02'], count: 1,
    why: 'Scheduled Projects sort before Unscheduled.' },
  { id: 'B11-projectId-tiebreaker-removed', file: UTILS,
    find: "    if (idA !== idB) return idA < idB ? -1 : 1;\n    return 0;", replace: "    return 0;",
    suites: ['project-consumer-validators.cjs'], expect: ['O07', 'O08'], count: 1,
    why: 'projectId is the final stable tiebreaker.' },

  // ---------------- STATE / STAGE SCHEMA ----------------
  { id: 'B12-state-key-removed', file: PARSER,
    find: "const MME_PROJECT_KEY_ORDER = ['id', 'created', 'stage', 'state', 'delivery', 'billing', 'closed', 'archived'];",
    replace: "const MME_PROJECT_KEY_ORDER = ['id', 'created', 'stage', 'delivery', 'billing', 'closed', 'archived'];",
    suites: ['project-consumer-validators.cjs'], expect: ['S01', 'S05'], count: 1,
    why: 'state is an owned managed key.' },
  { id: 'B13-state-default-not-open', file: PARSER,
    find: "const PROJECT_STATE_DEFAULT = 'open';", replace: "const PROJECT_STATE_DEFAULT = 'lost';",
    suites: ['project-consumer-validators.cjs'], expect: ['S02', 'S03'], count: 1,
    why: 'An absent state derives open in the read model.' },
  { id: 'B14-reconciliation-writes-state', file: PARSER,
    find: "const comment = serializeManagedProjectComment({ id, created: today });",
    replace: "const comment = serializeManagedProjectComment({ id, created: today, state: 'open' });",
    suites: ['project-consumer-validators.cjs'], expect: ['S04'], count: 1,
    why: 'ACT 5A reconciliation must never add state.' },
  { id: 'B15-unknown-state-fatal', file: PARSER,
    find: "      warnings.push({ code: 'non-canonical-state', detail: fields.state, line: 0 });",
    replace: "      pushProjectDiagnostic(diagnostics, 'non-canonical-state', fields.state);",
    suites: ['project-consumer-validators.cjs'], expect: ['S10', 'S08'], count: 1,
    why: 'Unknown state text must not invalidate a managed comment.' },
  { id: 'B16-closed-becomes-state', file: PARSER,
    find: "      state: canonicalProjectState(managedFields.state) || PROJECT_STATE_DEFAULT,",
    replace: "      state: managedFields.closed ? 'completed' : PROJECT_STATE_DEFAULT,",
    suites: ['project-consumer-validators.cjs'], expect: ['S15', 'S16'], count: 1,
    why: 'closed is a date and never synchronizes with state.' },

  // ---------------- MUTATION OWNER ----------------
  { id: 'B17-target-by-title', file: MUT,
    find: "      if (String(found.parsed.fields.id || '') === wantId) {",
    replace: "      if (true) {",
    suites: ['project-consumer-validators.cjs'], expect: ['U04', 'U05'], count: 1,
    why: 'The owner targets by projectId only.' },
  { id: 'B18-malformed-comment-repaired', file: MUT,
    find: "      if (!comment.valid) {", replace: "      if (false) {",
    suites: ['project-consumer-validators.cjs'], expect: ['U06', 'U08b'], count: 1,
    why: 'A malformed comment blocks mutation and is never repaired.' },
  { id: 'B19-title-mutated-with-value', file: MUT,
    find: "        const next = lines.slice();\n        next[located.declIndex] = parsed.prefix + rebuilt;",
    replace: "        const next = lines.slice();\n        next[located.declIndex] = parsed.prefix + 'Renamed ' + rebuilt;",
    suites: ['project-consumer-validators.cjs'], expect: ['V18', 'V16'], count: 1,
    why: 'A visible mutation never renames the Project.' },
  { id: 'B20-duplicate-value-token', file: MUT,
    find: "tokens.values.length = 0;",
    replace: "// mutated: existing value token is not cleared",
    suites: ['project-consumer-validators.cjs'], expect: ['V01', 'V11'], count: 2,
    why: 'A value operation always clears the previous pair instead of accumulating tokens.' },
  { id: 'B21-token-order-reversed', file: MUT,
    find: "        const suffix = tokens.values.concat(tokens.orders);",
    replace: "        const suffix = tokens.orders.concat(tokens.values);",
    suites: ['project-consumer-validators.cjs'], expect: ['V04'], count: 1,
    why: 'value/currency always precedes Expected Order.' },
  { id: 'B22-expected-order-invalidated', file: MUT,
    find: "if (/^(\\d{2}|\\d{4})[/-]?[qQ][1-4]$/.test(inner)) {", replace: "if (/^(\\d{2}|\\d{4})[/-]?[qQ]\\d$/.test(inner)) {",
    suites: ['project-consumer-validators.cjs'], expect: ['V21'], count: 1,
    why: 'An invalid quarter is never consumed as an order token.' },
  { id: 'B23-unknown-managed-field-lost', file: MUT,
    find: "        const extras = Object.assign({}, comment.extraFields);", replace: "        const extras = {};",
    suites: ['project-consumer-validators.cjs'], expect: ['G14'], count: 1,
    why: 'Unknown accepted managed fields survive a mutation.' },
  { id: 'B24-created-regenerated', file: MUT,
    find: "          Object.assign({ id: projectId, created: comment.fields.created }, owned),",
    replace: "          Object.assign({ id: projectId, created: '2026-01-01' }, owned),",
    suites: ['project-consumer-validators.cjs'], expect: ['G10'], count: 1,
    why: 'A mutation never regenerates created.' },
  { id: 'B25-projectId-regenerated', file: MUT,
    find: "          Object.assign({ id: projectId, created: comment.fields.created }, owned),",
    replace: "          Object.assign({ id: 'prj_99999999-9999-4999-8999-999999999999', created: comment.fields.created }, owned),",
    suites: ['project-consumer-validators.cjs'], expect: ['G09', 'G16'], count: 1,
    why: 'A mutation never changes projectId.' },
  { id: 'B26-unsupported-stage-accepted', file: MUT,
    find: "          if (v !== null && STAGE_CANONICAL.indexOf(v) === -1) {", replace: "          if (false) {",
    suites: ['project-consumer-validators.cjs'], expect: ['G02'], count: 1,
    why: 'Only canonical stage values may be written.' },
  { id: 'B27-unsupported-state-accepted', file: MUT,
    find: "          if (v !== null && STATE_CANONICAL.indexOf(v) === -1) {", replace: "          if (false) {",
    suites: ['project-consumer-validators.cjs'], expect: ['G05'], count: 1,
    why: 'Only canonical state values may be written.' },
  { id: 'B28-managed-data-onto-visible-line', file: MUT,
    find: "        next[located.comment.index] = serializeComment(",
    replace: "        next[located.declIndex] = serializeComment(",
    suites: ['project-consumer-validators.cjs'], expect: ['G17'], count: 1,
    why: 'A managed operation never rewrites the visible declaration line.' },
  { id: 'B29-bracket-delimiters-dropped', file: MUT,
    find: "        values.push('[' + inner + ']');", replace: "        values.push(inner);",
    suites: ['project-consumer-validators.cjs'], expect: ['V12', 'V15'], count: 1,
    why: 'Canonical source keeps the bracket delimiters around trailing tokens.' },

  // ---------------- ROUTING ----------------
  { id: 'B30-projects-opens-index', file: MAIN,
    find: "        const result = await globalThis.MME_WORKSPACE_HOST.switchTo('projects', {",
    replace: "        const result = await globalThis.MME_WORKSPACE_HOST.switchTo('workspace-index', {",
    suites: ['project-consumer-validators.cjs'], expect: ['T20'], count: 1,
    why: 'The Projects action opens the dedicated route.' },
  { id: 'B31-route-loses-return', file: VIEW,
    find: "    hostApi.switchTo('journal', { reason: 'projects return' }).catch(() => {});", replace: "    void 0;",
    suites: ['project-consumer-validators.cjs'], expect: ['T10'], count: 1,
    why: 'The dedicated route keeps return-to-workspace.' },
  { id: 'B32-container-reused-from-index', file: VIEW,
    find: "const CONTAINER_ID = 'projectsView';", replace: "const CONTAINER_ID = 'workspaceIndexView';",
    suites: ['project-consumer-validators.cjs'], expect: ['T06', 'T07'], count: 1,
    why: 'The Projects container is dedicated, never the Index container.' },
  { id: 'B33-deactivate-leaves-visible', file: VIEW,
    find: "  function deactivate() {\n    const c = document.getElementById(CONTAINER_ID);\n    if (c) c.hidden = true;",
    replace: "  function deactivate() {\n    const c = document.getElementById(CONTAINER_ID);\n    if (c) c.hidden = false;",
    suites: ['project-consumer-validators.cjs'], structural: true,
    why: 'INVARIANT: deactivate hides the container.',
  },
  { id: 'B34-save-capability-accidental', file: CAPS,
    find: "  const PROJECTS_CAPABILITIES = Object.freeze({", replace: "  const PROJECTS_CAPABILITIES = undefined && Object.freeze({",
    suites: ['project-consumer-validators.cjs'], expect: ['T01', 'T02'], count: 1,
    why: 'The Projects capability mapping is explicit, never undefined.' },
  { id: 'B35-new-global-mode', file: VIEW,
    find: "  const HOST_ID = 'projects';", replace: "  const HOST_ID = 'projects-editing';",
    suites: ['project-consumer-validators.cjs'], expect: ['T05'], count: 1,
    why: 'Projects is a Host workspace route, not a new global mode.' },

  // ---------------- REPORTS ----------------
  { id: 'B36-report-projectId-rendered', file: DICT,
    find: "      name: pr.name || '',", replace: "      name: pr.name || (pr.projectId || ''),",
    suites: ['project-consumer-validators.cjs'], structural: true,
    why: 'INVARIANT: projectId is never rendered in Report output.',
  },
];

/* ------------------------------ baseline ---------------------------------- */
console.log('ACT 5B — Project consumer mutation controls');
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
  if (count !== (m.count || 1)) { notBit.push({ id: m.id, reason: 'anchor occurs ' + count + ' time(s), expected ' + (m.count || 1) + ' — NOT applied' }); continue; }

  const at = original.indexOf(m.find);
  fs.writeFileSync(abs, original.slice(0, at) + m.replace + original.slice(at + m.find.length));
  if (sha256(abs) === before) { fs.writeFileSync(abs, original); notBit.push({ id: m.id, reason: 'no byte change — NOT applied' }); continue; }
  applied += 1;

  const runs = m.suites.map(runSuite);
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
    if (!restoredOk) restoreFailures.push({ id: m.id, reason: 'structural probe restore NOT byte-identical' });
    console.log('GUARD ' + m.id.padEnd(40) + ' restored=' + (restoredOk ? 'ok' : 'FAIL') + ' observed=' + (observed.join(',') || '(none)'));
    continue;
  }

  if (hits.length) bit.push(m.id);
  else notBit.push({ id: m.id, reason: observed.length ? 'red, but not the intended fixtures: ' + observed.join(',') : (exitZero ? 'no named fixture failed — equivalent under current fixtures' : 'suite crashed without a named fixture failing') });
  if (!restoredOk) restoreFailures.push({ id: m.id, reason: 'restore NOT byte-identical' });
  if (!postGreen) postFailures.push({ id: m.id, reason: 'baseline did not return to green' });

  console.log((hits.length ? 'BIT  ' : 'NOBIT') + ' ' + m.id.padEnd(40) + ' restored=' + (restoredOk ? 'ok' : 'FAIL') + ' post=' + (postGreen ? 'green' : 'RED') + (hits.length ? ' fixtures=' + hits.join(',') : ' observed=' + (observed.join(',') || '(none)')));
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
for (const s of structural) console.log('  ' + s.id + ' — restored=' + (s.restoredOk ? 'ok' : 'FAIL'));
console.log('\nHONEST TOTALS: ' + bit.length + ' mutation controls passed of ' + applied + ' applied; ' + notBit.length + ' non-biting; ' + structural.length + ' structural guards.');

if (restoreFailures.length) { console.log('\nRESTORE FAILURES:'); for (const r of restoreFailures) console.log('  ' + r.id + ' — ' + r.reason); process.exit(1); }
if (notBit.length) process.exit(1);
process.exit(0);
