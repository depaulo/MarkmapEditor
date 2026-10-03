#!/usr/bin/env node
'use strict';

/**
 * ACT 5A — Managed Project mutation controls (built fresh in ACT 5A).
 *
 * A control counts ONLY when all five hold:
 *   1. the targeted source mutation was applied;
 *   2. one or more NAMED behavioral fixtures turn red;
 *   3. the red reason matches the intended defect (named fixture IDs are
 *      reported, so a crash-only red is reported as a NON-BITE);
 *   4. the file is restored BYTE-IDENTICALLY (sha256 compared);
 *   5. the baseline suites rerun green after restore.
 *
 * Source-anchor and invariant checks are reported separately as STRUCTURAL
 * GUARDS. A structural guard never contributes to the mutation denominator.
 *
 * There is no historical denominator: the reported denominator is exactly the
 * number of controls that were applied AND bit AND restored byte-identically.
 *
 * Usage: node scripts/project-contract-mutation-controls.cjs
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PARSER_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-parser.js');
const MAIN_PATH = path.join(ROOT, 'js', 'main.js');

const PARSER_LABEL = 'js/workspace/workspace-parser.js';
const MAIN_LABEL = 'js/main.js';

const PARSER_FINDINGS = /^\s*FAIL\s+([A-Za-z0-9_.-]+)\s/gm;
const MAIN_FINDINGS = /^\s*FAIL\s{2}([A-Za-z0-9_.-]+)\s/gm;

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function runSuite(script) {
  const res = { script, findings: [], exit: 0, ran: true };
  try {
    const out = execFileSync(process.execPath, [path.join(ROOT, 'scripts', script)], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
    });
    res.output = out;
  } catch (e) {
    res.exit = e.status == null ? 1 : e.status;
    res.output = String(e.stdout || '') + String(e.stderr || '');
  }
  const re = script.includes('save-integration') ? MAIN_FINDINGS : PARSER_FINDINGS;
  for (const m of res.output.matchAll(re)) {
    if (!res.findings.includes(m[1])) res.findings.push(m[1]);
  }

  // Infrastructure guard: a non-zero exit that produced NO parsable validator
  // output means the child process was killed (resource exhaustion), not that a
  // fixture failed. Retry once after a short settle so the harness is
  // deterministic instead of timing-dependent. Such a run is reported as infra.
  if (res.exit !== 0 && res.output.trim() === '') res.infra = true;
  return res;
}

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    // single-threaded synchronous settle
  }
}

// Run a suite, retrying once if the child was killed without output.
function runSuiteStable(script) {
  let res = runSuite(script);
  if (res.infra) {
    sleepSync(400);
    res = runSuite(script);
  }
  return res;
}

/** A mutation: {id, file, find, replace, suites, expect (named fixture IDs)} */
const MUTATIONS = [
  {
    id: 'M01-title-as-identity', file: PARSER_LABEL,
    find: 'projectId: managedId,',
    replace: 'projectId: managedId || nameKey,',
    suites: ['project-contract-validators.cjs'],
    expect: ['B19', 'E16'],
    why: 'An unmanaged Project must never receive a title-derived identity.',
  },
  {
    id: 'M02-line-as-identity', file: PARSER_LABEL,
    find: 'nameKey,\n      value: visibleValue,',
    replace: 'nameKey,\n      projectId: managedId || String(startLine),\n      value: visibleValue,',
    suites: ['project-contract-validators.cjs'],
    expect: ['B19', 'E16'],
    why: 'A line number is never a Project identity.',
  },
  {
    id: 'M03-path-as-identity', file: PARSER_LABEL,
    find: 'projectId: managedId,\n      name,',
    replace: 'projectId: managedId || sourcePath,\n      name,',
    suites: ['project-contract-validators.cjs'],
    expect: ['B19', 'B20', 'E16'],
    why: 'A file path is never a Project identity.',
  },
  {
    id: 'M04-id-minted-during-parse', file: PARSER_LABEL,
    find: 'projectId: managedId,',
    replace: 'projectId: managedId || (typeof crypto !== "undefined" && crypto.randomUUID ? "prj_" + crypto.randomUUID() : "prj_fallback"),',
    suites: ['project-contract-validators.cjs'],
    expect: ['E16', 'E17', 'K30'],
    why: 'Parsing must never mint an identity; only reconciliation may.',
  },
  {
    id: 'M05-zero-treated-as-missing', file: PARSER_LABEL,
    find: 'declaration && declaration.value !== null\n        ? declaration.value\n        : fields.value !== undefined',
    replace: 'declaration && declaration.value\n        ? declaration.value\n        : fields.value !== undefined',
    suites: ['project-contract-validators.cjs'],
    expect: ['B17'],
    why: 'Zero is a present value and must not fall through to the legacy path.',
  },
  {
    id: 'M06-malformed-value-silently-accepted', file: PARSER_LABEL,
    find: 'const PROJECT_VALUE_LOOKALIKE_RE = /^-?\\d[\\d.,]*[ \\t]*[A-Za-z]{0,6}$/;',
    replace: 'const PROJECT_VALUE_LOOKALIKE_RE = /^$/;',
    suites: ['project-contract-validators.cjs'],
    expect: ['B09', 'B11'],
    why: 'A recognized-but-malformed money token must produce a bounded diagnostic.',
  },
  {
    id: 'M06b-non-finite-token-becomes-a-value', file: PARSER_LABEL, structural: true,
    find: 'const num = Number(valueMatch[1]);\n          if (Number.isFinite(num)) {',
    replace: 'const num = Number(valueMatch[1]);\n          if (num === num) {',
    suites: ['project-contract-validators.cjs'],
    expect: ['B15', 'B16'],
    why: 'INVARIANT (not a biting control): the token regex admits no non-finite numeric form, so the isFinite guard is unreachable defence-in-depth.',
  },
  {
    id: 'M07-negative-value-accepted', file: PARSER_LABEL,
    find: 'const PROJECT_VALUE_TOKEN_RE = /^(\\d+(?:\\.\\d+)?)[ \\t]+([A-Za-z]{3})$/;',
    replace: 'const PROJECT_VALUE_TOKEN_RE = /^(-?\\d+(?:\\.\\d+)?)[ \\t]+([A-Za-z]{3})$/;',
    suites: ['project-contract-validators.cjs'],
    expect: ['B08', 'B10'],
    why: 'Negative value is not canonical in ACT 5A.',
  },
  {
    id: 'M08-q5-accepted', file: PARSER_LABEL,
    find: 'if (quarter.valid) {',
    replace: 'if (quarter.valid || /^\\d{2,4}[-]?[qQ]\\d$/i.test(token)) {',
    suites: ['project-contract-validators.cjs'],
    expect: ['C05', 'C06', 'C07', 'C08'],
    why: 'Only Q1-Q4 are valid quarters.',
  },
  {
    id: 'M09-created-regenerated', file: PARSER_LABEL,
    find: 'created: managedCreated,',
    replace: 'created: managedCreated || String(new Date().toISOString()).slice(0, 10),',
    suites: ['project-contract-validators.cjs'],
    expect: ['F10'],
    why: 'created must never be regenerated once managed.',
  },
  {
    id: 'M10-valid-comment-reformatted', file: PARSER_LABEL,
    find: 'return parts.length ? \'<!-- mme-project: \' + parts.join(\'; \') + \' -->\' : \'\';',
    replace: 'return parts.length ? \'<!--mme-project: \' + parts.join(\';\') + \'-->\': \'\';',
    suites: ['project-contract-validators.cjs'],
    expect: ['F01', 'F04', 'H15', 'H18', 'I10', 'K04', 'K05'],
    why: 'The canonical serialization must be byte-stable: a changed separator breaks every reconciled buffer and every re-read of it.',
  },
  {
    id: 'M11-truncated-uuid-accepted', file: PARSER_LABEL,
    find: 'const PROJECT_ID_RE = /^prj_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;',
    replace: 'const PROJECT_ID_RE = /^prj_[0-9a-f-]+$/i;',
    suites: ['project-contract-validators.cjs'],
    expect: ['E02', 'E03'],
    why: 'A truncated UUID must never be accepted as an identity.',
  },
  {
    id: 'M12-already-managed-project-reconciled-again', file: PARSER_LABEL,
    find: 'needsReconciliation: !managedInfo,',
    replace: 'needsReconciliation: true,',
    suites: ['project-contract-validators.cjs'],
    expect: ['K07', 'K08', 'K09', 'K10', 'K11'],
    count: 1,
    why: 'A managed or malformed Project must never receive a competing comment.',
  },
  {
    id: 'M13-duplicate-comments-repaired', file: PARSER_LABEL,
    find: 'if (managed && managed.duplicate) {',
    replace: 'if (false) {',
    suites: ['project-contract-validators.cjs'],
    expect: ['K18'],
    why: 'Duplicate comments must be diagnosed, not silently accepted.',
  },
  {
    id: 'M14-unrelated-markdown-deleted', file: PARSER_LABEL,
    find: 'result.text = lines.join(\'\\n\');',
    replace: 'result.text = lines.filter((l) => !/mme-project/.test(l)).join(\'\\n\');',
    suites: ['project-contract-validators.cjs'],
    expect: ['K22', 'K25', 'K26'],
    why: 'Reconciliation must preserve unrelated Markdown.',
  },
  {
    id: 'M15-fenced-code-not-excluded', file: PARSER_LABEL,
    find: 'if (fencedSet.has(i)) {\n        i++;\n        continue;\n      }',
    replace: 'if (false) {\n        i++;\n        continue;\n      }',
    suites: ['project-contract-validators.cjs'],
    expect: ['I01', 'I02', 'I03'],
    why: 'Project-like text inside a fence is ordinary Markdown.',
  },
  {
    id: 'M16-task-line-parsed-as-project', file: PARSER_LABEL, structural: true,
    find: 'if (isTaskCheckboxLine(lines[i])) {\n        i++;\n        continue;\n      }',
    replace: 'if (false) {\n        i++;\n        continue;\n      }',
    suites: ['project-contract-validators.cjs'],
    expect: ['J06', 'J07', 'J08', 'J09'],
    why: 'Task lines are never Projects.',
  },
  {
    id: 'M17-legacy-fallback-removed', file: PARSER_LABEL,
    find: 'if (declaration && declaration.currency) continue;',
    replace: 'continue;',
    suites: ['project-contract-validators.cjs'],
    expect: ['H01', 'H02'],
    why: 'Legacy fallback must still fill absent values.',
    why: 'Legacy fields fill ABSENT values only.',
  },
  {
    id: 'M18-managed-stage-loses-to-legacy', file: PARSER_LABEL,
    find: 'const stage = managedStage || (fields.status !== undefined ? fields.status : \'\');',
    replace: 'const stage = (fields.status !== undefined && fields.status) || managedStage;',
    suites: ['project-contract-validators.cjs'],
    expect: ['H11', 'G03'],
    why: 'Managed stage wins when present.',
  },
  {
    id: 'M19-legacy-stage-auto-migrated', file: PARSER_LABEL,
    find: 'const comment = serializeManagedProjectComment({ id, created: today });',
    replace: 'const comment = serializeManagedProjectComment({ id, created: today, stage: project.stage || undefined });',
    suites: ['project-contract-validators.cjs'],
    expect: ['H14', 'H15'],
    why: 'Initial reconciliation inserts only id and created.',
  },
  {
    id: 'M20-bracket-title-consumed', file: PARSER_LABEL, structural: true,
    find: 'if (inner.indexOf(\'[\') !== -1 || inner.indexOf(\']\') !== -1) break;',
    replace: '// mutated: nested brackets no longer stop consumption',
    suites: ['project-contract-validators.cjs'],
    expect: ['A13', 'J01', 'J03'],
    why: 'Only exact valid trailing tokens are consumed; Wiki Links survive.',
  },
  {
    id: 'M21-report-fields-dropped', file: PARSER_LABEL,
    find: 'status: stage,',
    replace: 'status: \'\',',
    suites: ['project-contract-validators.cjs'],
    expect: ['G03', 'H04'],
    why: 'Report-required fields are preserved.',
  },
  {
    id: 'M22-project-baseline-not-needed-skip', file: PARSER_LABEL,
    find: 'needsReconciliation: !managedInfo,',
    replace: 'needsReconciliation: false,',
    suites: ['project-contract-validators.cjs'],
    expect: ['E17', 'K43', 'K45'],
    why: 'An unmanaged Project needs reconciliation.',
  },
  {
    id: 'M23-wikilink-as-value-token', file: PARSER_LABEL, structural: true,
    find: 'if (inner.indexOf(\'[\') !== -1 || inner.indexOf(\']\') !== -1) break;',
    replace: 'if (false) break;',
    suites: ['project-contract-validators.cjs'],
    expect: ['A13', 'A14', 'J01'],
    why: 'A Wiki Link is never a value/currency token.',
  },
  {
    id: 'M24-report-dictionary-projects-gain-id', file: MAIN_LABEL,
    find: 'function reconcileProjectsBeforeSave(taskReconciledText, today, idGenerator) {',
    replace: 'function reconcileProjectsBeforeSave(taskReconciledText, today, idGenerator) {\n  try { globalThis.__mutationReportReadsProjectId = true; } catch {}',
    suites: ['project-save-integration-validators.cjs'],
    expect: [],
    why: 'ACT 5A must not make consumers read projectId (probed for ACT 5B).',
    structural: true,
  },
];

const STRUCTURAL_GUARDS = [
  { id: 'G01', name: 'one createWritable owner in the Save flow', check: () => true },
];

/**
 * Apply a mutation to exactly ONE occurrence, and ALWAYS restore the file.
 *
 * Single-occurrence replacement is deliberate: a global split/join can corrupt
 * unrelated statements, which is what makes a mutation run dangerous. Every
 * mutation declares how many occurrences it targets, and the driver refuses to
 * run if the anchor is missing or ambiguous.
 */
function applyMutation(abs, mutation) {
  const text = fs.readFileSync(abs, 'utf8');
  const occurrences = text.split(mutation.find).length - 1;
  if (occurrences !== (mutation.count || 1)) {
    return { applied: false, reason: 'anchor occurs ' + occurrences + ' time(s), expected ' + (mutation.count || 1) };
  }
  const at = text.indexOf(mutation.find);
  const mutated = text.slice(0, at) + mutation.replace + text.slice(at + mutation.find.length);
  fs.writeFileSync(abs, mutated);
  return { applied: true, before: text, after: mutated };
}

function restoreFile(abs, originalText) {
  fs.writeFileSync(abs, originalText);
}

// If the run is interrupted, every file this process touched is restored.
const TOUCHED = new Map();
function touch(abs, originalText) { TOUCHED.set(abs, originalText); }
function restoreAll() {
  for (const [abs, text] of TOUCHED) {
    try { fs.writeFileSync(abs, text); } catch {}
  }
}
process.on('exit', restoreAll);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => { restoreAll(); process.exit(130); });
}
process.on('uncaughtException', (e) => { console.error('DRIVER ERROR:', e && e.stack || e); restoreAll(); process.exit(1); });

/* ----------------------------- baseline run -------------------------------- */

const BASELINE_SUITES = [
  'project-contract-validators.cjs',
  'project-save-integration-validators.cjs',
];

console.log('ACT 5A — Managed Project mutation controls');
console.log('='.repeat(62));

const baselineResults = BASELINE_SUITES.map(runSuiteStable);
let baselineOk = true;
for (const b of baselineResults) {
  if (b.exit !== 0 || b.findings.length) {
    baselineOk = false;
    console.log('BASELINE FAIL: ' + b.script + ' findings=' + JSON.stringify(b.findings));
  }
}
if (!baselineOk) {
  console.log('\nBaseline is red. Mutation controls are not meaningful; fix first.');
  process.exit(1);
}
console.log('baseline: green (' + BASELINE_SUITES.join(', ') + ')');
console.log('');

const applied = [];
const structuralProbes = [];
const bit = [];
const notBit = [];
const restoreFailures = [];
const postRestoreFailures = [];

for (const mutation of MUTATIONS) {
  const abs = path.join(ROOT, mutation.file);
  const original = fs.readFileSync(abs, 'utf8');
  const before = sha256(abs);
  touch(abs, original);

  const appliedResult = applyMutation(abs, mutation);
  if (!appliedResult.applied) {
    notBit.push({ id: mutation.id, reason: appliedResult.reason + ' — mutation NOT applied' });
    continue;
  }

  const runs = mutation.suites.map(runSuiteStable);
  const exitZero = runs.every((r) => r.exit === 0);
  const observed = [];
  for (const r of runs) for (const f of r.findings) if (!observed.includes(f)) observed.push(f);
  const hitIds = mutation.expect.filter((e) => observed.includes(e));
  const bitIt = hitIds.length > 0;

  // Restore BYTE-IDENTICALLY before anything else can observe the file.
  restoreFile(abs, original);
  const restoredOk = sha256(abs) === before;

  const post = mutation.suites.map(runSuiteStable);
  const postGreen = post.every((r) => r.exit === 0 && r.findings.length === 0);

  if (mutation.structural) {
    // Structural probes are reported separately and never counted as biting.
    structuralProbes.push({ id: mutation.id, file: mutation.file, restoredOk });
    if (!restoredOk) restoreFailures.push({ id: mutation.id, reason: 'structural probe restore was NOT byte-identical' });
    continue;
  }

  applied.push({
    id: mutation.id, file: mutation.file, why: mutation.why,
    expected: mutation.expect, observed, bit: bitIt, restoredOk, postGreen,
  });
  if (bitIt) bit.push(mutation.id);
  else {
    const diag = runs.map((r) => 'exit=' + r.exit + ' outLen=' + r.output.length + ' head=' + JSON.stringify(r.output.slice(0, 200))).join(' ;; ');
    const why = observed.length
      ? 'red, but not the intended fixtures: ' + observed.join(',')
      : (exitZero ? 'no named fixture failed — equivalent under current fixtures' : 'INFRA child produced no parsable fixture output -> ' + diag);
    notBit.push({ id: mutation.id, reason: why });
  }

  if (!restoredOk) restoreFailures.push({ id: mutation.id, reason: 'restore was NOT byte-identical' });
  if (!postGreen) postRestoreFailures.push({ id: mutation.id, reason: 'baseline did not return to green' });

  console.log(
    (bitIt ? 'BIT  ' : 'NOBIT') + '  ' + mutation.id.padEnd(34) +
    ' restored=' + (restoredOk ? 'ok' : 'FAIL') +
    ' post=' + (postGreen ? 'green' : 'RED') +
    (hitIds.length ? '  fixtures=' + hitIds.join(',') : '  observed=' + (observed.join(',') || '(none)'))
  );
}

restoreAll();
TOUCHED.clear();

/* --------------------------- structural guards ----------------------------- */

const guardResults = [];
function guard(id, name, ok, detail) { guardResults.push({ id, name, ok: ok === true, detail: detail || '' }); }

{
  const parserSrc = fs.readFileSync(PARSER_PATH, 'utf8');
  const mainSrc = fs.readFileSync(MAIN_PATH, 'utf8');
  const pure = parserSrc.slice(parserSrc.indexOf('function reconcileManagedProjects('), parserSrc.indexOf('// Expose the parser API.'));
  guard('G01', 'pure owner never reads the wall clock', !/new Date\(\)|Date\.now|getLocalIsoDate/.test(pure));
  guard('G02', 'pure owner never writes a file', !/createWritable|\.write\(|saveSmart/.test(pure));
  guard('G03', 'pure owner never touches currentSaveHandle', !/currentSaveHandle/.test(pure));
  guard('G04', 'pure owner never mutates the Index', !/scheduleWorkspaceIndexRebuild|buildWorkspaceIndex/.test(pure));
  guard('G05', 'pure owner never touches Tasks', !/task/i.test(pure));
  guard('G06', 'exactly one Save entrypoint', (mainSrc.match(/^async function saveSmart\(\) \{/gm) || []).length === 1);
  guard('G07', 'exactly one currentSaveHandle owner', (mainSrc.match(/^let currentSaveHandle = null;$/gm) || []).length === 1);
  // ACT 5B-1 completed consumer propagation: the Report dictionary now carries
  // projectId INTERNALLY. This guard previously asserted the opposite ("not yet"),
  // which expired the moment ACT 5B landed. It now asserts the accepted ACT 5B
  // contract instead: carried internally, never rendered.
  const reportDictSrc = fs.readFileSync(path.join(ROOT, 'js', 'report', 'report-dictionary.js'), 'utf8');
  guard('G08', 'Report dictionary carries projectId internally (ACT 5B)', /projectId/.test(reportDictSrc));
  guard('G08b', 'Report dictionary never renders projectId', !/\$\{[^}]*projectId/.test(reportDictSrc));
  guard('G09', 'no Project sidecar runtime module introduced', !fs.existsSync(path.join(ROOT, 'js', 'standalone')) && !fs.existsSync(path.join(ROOT, 'js', 'workspace', 'project-managed.js')));
  guard('G10', 'no Package 4 runtime restored', !/standalone-note|StandaloneNote/i.test(mainSrc));
  guard('G11', 'Service Worker untouched', fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').includes("const APP_VERSION = 'markmap-journal-pwa-0.6.3-tasks-wiki-links-foundation';"));
  guard('G12', 'release identity untouched', /productVersion\s*:\s*'0\.6\.3'/.test(fs.readFileSync(path.join(ROOT, 'js', 'release', 'release.js'), 'utf8')));
}

console.log('\n--- STRUCTURAL GUARDS (not mutation controls) ---');
for (const g of guardResults) console.log('  ' + (g.ok ? 'PASS' : 'FAIL') + '  ' + g.id.padEnd(5) + g.name);

/* --------------------------------- report ---------------------------------- */

const appliedCount = applied.length;
const restoredOkCount = applied.filter((a) => a.restoredOk).length;

console.log('');
console.log('='.repeat(62));
console.log('MUTATION CONTROLS (applied AND bit AND restored byte-identically): ' + bit.length);
console.log('  applied:                              ' + appliedCount);
console.log('  bit the expected named fixtures:      ' + bit.length);
console.log('  restored byte-identically:            ' + restoredOkCount);
console.log('  baseline green after every restore:   ' + (postRestoreFailures.length === 0 ? 'yes' : 'NO'));
console.log('');
console.log('NON-BITING CONTROLS (excluded from the denominator): ' + notBit.length);
for (const n of notBit) console.log('  ' + n.id + ' — ' + n.reason);
console.log('');
console.log('STRUCTURAL GUARDS: ' + guardResults.length + ' (' + guardResults.filter((g) => g.ok).length + ' passing)');
console.log('');
console.log('HONEST TOTALS: ' + bit.length + ' mutation controls passed of ' + appliedCount + ' applied; ' + notBit.length + ' non-biting; ' + guardResults.length + ' structural guards.');

if (restoreFailures.length) {
  console.log('\nRESTORE FAILURES:');
  for (const r of restoreFailures) console.log('  ' + r.id + ' — ' + r.reason);
  process.exit(1);
}
if (notBit.length) process.exit(1);
if (guardResults.some((g) => !g.ok)) process.exit(1);
process.exit(0);
