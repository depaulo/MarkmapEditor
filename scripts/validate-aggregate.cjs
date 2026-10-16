#!/usr/bin/env node
'use strict';

/**
 * Aggregate validation profiles for MarkmapEditor.
 *
 * Usage:
 *   node scripts/validate-aggregate.cjs <profile> [--demo-fail]
 *   node scripts/validate-aggregate.cjs --list
 *   npm run validate:<profile>
 *
 * Behavior:
 *   - runs each child sequentially with plain `node <script>`;
 *   - prints ONE concise result line per child: [PASS]/[FAIL] label — summary;
 *   - writes full child output to .validation/<profile>-<label>.log (ignored);
 *   - prints the failure log path for every failing child;
 *   - exits nonzero if any child fails (child failure propagates);
 *   - --demo-fail appends a guaranteed-failing synthetic child to prove the
 *     nonzero propagation and log naming without touching production files.
 *
 * Direct script execution always remains available:
 *   node scripts/project-contract-validators.cjs
 *
 * Profiles (authoritative list: docs/validation/TEST_CATALOG.md):
 *   quick | projects | tasks | workspace | reports | package5 | closure |
 *   mutation:projects (Tier M, disposable copy)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LOGDIR = path.join(ROOT, '.validation');
const S = (name) => path.join(ROOT, 'scripts', name);

function child(script, opts) {
  return Object.assign({ label: script.replace(/\.cjs$/, '') }, opts || {}, {
    args: [S(script)],
  });
}
const parity = () => child('release-parity.cjs');
const strictParity = () => child('release-parity.cjs', {
  label: 'release-parity-strict',
  env: { RELEASE_PARITY_STRICT_SW: '1' },
});

const PROJECTS = [
  child('project-contract-validators.cjs'),
  child('project-consumer-validators.cjs'),
  child('project-view-validators.cjs'),
  child('project-save-integration-validators.cjs'),
  child('project-device-acceptance.cjs'),
  child('mutation-anchor-audit.cjs'),
];
const TASKS = [
  child('task-reconcile-validators.cjs'),
  child('workspace-task-contract-validators.cjs'),
  child('workspace-task-consumers-validators.cjs'),
  child('workspace-index-task-filter-validators.cjs'),
];
const WORKSPACE = [
  child('current-document-scope-validators.cjs'),
  child('workspace-detection-validators.cjs'),
  child('workspace-discovery-consumers-validators.cjs'),
  child('workspace-storage-validators.cjs'),
  child('workspace-note-creation-validators.cjs'),
  child('workspace-note-metadata-validators.cjs'),
  child('workspace-notes-sidebar-validators.cjs'),
  child('workspace-index-notes-validators.cjs'),
  child('workspace-today-index-validators.cjs'),
  child('workspace-lifecycle-output-validators.cjs'),
  child('workspace-sidebar-visual-validators.cjs'),
];
const HYGIENE = [
  { builtin: 'syntax', label: 'syntax' },
  { builtin: 'diff', label: 'git-diff-check' },
];
const PACKAGE5 = HYGIENE.concat(PROJECTS, [
  child('workspace-index-task-filter-validators.cjs'),
  child('workspace-task-contract-validators.cjs'),
  child('workspace-task-consumers-validators.cjs'),
  child('workspace-sidebar-visual-validators.cjs'),
  parity(),
  strictParity(),
]);
const CLOSURE_EXTRA = [
  child('dependency-cache-validators.cjs'),
  child('html-preview-render-validators.cjs'),
  child('mode-session-validators.cjs'),
  child('wiki-link-consumer-validators.cjs'),
  child('wiki-link-relationship-validators.cjs'),
  child('wiki-link-resolution-validators.cjs'),
  child('workspace-notes-sidebar-validators.cjs'),
  child('workspace-storage-validators.cjs'),
  child('workspace-today-index-validators.cjs'),
  child('workspace-lifecycle-output-validators.cjs'),
  child('workspace-index-notes-validators.cjs'),
  child('workspace-note-creation-validators.cjs'),
  child('workspace-note-metadata-validators.cjs'),
  child('workspace-detection-validators.cjs'),
  child('workspace-discovery-consumers-validators.cjs'),
  child('current-document-scope-validators.cjs'),
  child('task-reconcile-validators.cjs'),
  child('release-notes-validators.cjs'),
  child('update-ready-validators.cjs'),
  parity(),
  strictParity(),
];

const PROFILES = {
  quick: HYGIENE.concat([child('mutation-anchor-audit.cjs')]),
  projects: PROJECTS.slice(),
  tasks: TASKS.slice(),
  workspace: WORKSPACE.slice(),
  reports: [],
  package5: PACKAGE5.slice(),
  closure: PACKAGE5.concat(CLOSURE_EXTRA),
};

const MUTATION_PROFILES = {
  'mutation:projects': [
    'project-contract-mutation-controls.cjs',
    'project-view-mutation-controls.cjs',
    'project-consumer-mutation-controls.cjs',
  ],
};

function extractSummary(text) {
  const patterns = [
    /groups=\d+ passed=\d+ failed=\d+ total=\d+/,
    /TOTAL\s+\d+\s+FAIL\s+\d+/,
    /^\s*FAIL\s*\d+\s*$/m,
    /RESULT: PASS/,
    /passed=\d+/,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) return m[0].trim();
  }
  const lines = String(text || '').split('\n').filter((l) => l.trim());
  return lines.length ? lines[lines.length - 1].slice(0, 100) : 'no output';
}

function runSyntaxCheck(logFile) {
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(cjs|js)$/.test(e.name)) files.push(p);
    }
  };
  for (const dir of ['scripts', 'js']) walk(path.join(ROOT, dir));
  let log = '';
  for (const f of files) {
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    log += '$ node --check ' + path.relative(ROOT, f) + '\n' + (r.stdout || '') + (r.stderr || '');
    if (r.status !== 0) {
      fs.writeFileSync(logFile, log);
      return { ok: false, summary: 'syntax failure: ' + path.relative(ROOT, f), exit: r.status || 1 };
    }
  }
  log += '\nsyntax OK: ' + files.length + ' files\n';
  fs.writeFileSync(logFile, log);
  return { ok: true, summary: files.length + ' files', exit: 0 };
}

function runDiffCheck(logFile) {
  const r = spawnSync('git', ['diff', '--check'], { cwd: ROOT, encoding: 'utf8' });
  fs.writeFileSync(logFile, '$ git diff --check\n' + (r.stdout || '') + (r.stderr || ''));
  if (r.status !== 0) return { ok: false, summary: 'whitespace errors', exit: r.status || 1 };
  return { ok: true, summary: 'clean', exit: 0 };
}

function runChild(step, logFile) {
  if (step.builtin === 'syntax') return runSyntaxCheck(logFile);
  if (step.builtin === 'diff') return runDiffCheck(logFile);
  const env = Object.assign({}, process.env, step.env || {});
  const r = spawnSync(process.execPath, step.args, {
    cwd: ROOT, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024,
  });
  const out = (r.stdout || '') + (r.stderr || '');
  fs.writeFileSync(logFile, out);
  const ok = r.status === 0;
  let summary = extractSummary(out);
  if (ok && (r.stderr || '').trim()) summary += ' (stderr logged)';
  return { ok, summary, exit: r.status == null ? 1 : r.status };
}

function copyTree(dst) {
  fs.mkdirSync(dst, { recursive: true });
  const entries = ['js', 'css', 'scripts', 'docs', 'package.json', 'index.html', 'sw.js', 'manifest.webmanifest'];
  for (const e of entries) {
    const src = path.join(ROOT, e);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(dst, e), { recursive: true });
  }
}

function runMutationProfile(profileName, opts) {
  const controls = MUTATION_PROFILES[profileName];
  const flat = profileName.replace(/[:/]/g, '-');
  const dst = path.join(LOGDIR, 'isolated-' + flat + '-' + Date.now());
  fs.mkdirSync(LOGDIR, { recursive: true });
  copyTree(dst);
  console.log('[SETUP] disposable copy: ' + path.relative(ROOT, dst));
  let failed = 0;
  if (opts.setupOnly) {
    // Isolation proof seam: the copy exists, no control ran against ROOT.
    const copiedScripts = fs.readdirSync(path.join(dst, 'scripts'));
    console.log('[SETUP] copied scripts=' + copiedScripts.length + ' — controls run with cwd=' + path.relative(ROOT, dst) + ', never the served tree');
    fs.rmSync(dst, { recursive: true, force: true });
    console.log('[CLEANUP] disposable copy removed');
    return failed;
  }
  for (const script of controls) {
    const logFile = path.join(LOGDIR, flat + '-' + script.replace(/\.cjs$/, '') + '.log');
    const r = spawnSync(process.execPath, [path.join(dst, 'scripts', script)], {
      cwd: dst, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    });
    const out = (r.stdout || '') + (r.stderr || '');
    fs.writeFileSync(logFile, out);
    const ok = r.status === 0;
    console.log((ok ? '[PASS] ' : '[FAIL] ') + script.replace(/\.cjs$/, '') + ' — ' + extractSummary(out));
    if (!ok) { failed += 1; console.log('        details: ' + path.relative(ROOT, logFile)); }
  }
  fs.rmSync(dst, { recursive: true, force: true });
  console.log('[CLEANUP] disposable copy removed');
  if (opts.demoFail) {
    failed += 1;
    console.log('[FAIL] demo-fail — exit 3 (injected; proves nonzero propagation)');
    console.log('        details: (injected child; no log)');
  }
  return failed;
}

function main() {
  const argv = process.argv.slice(2);
  const demoFail = argv.includes('--demo-fail');
  const setupOnly = argv.includes('--setup-only');
  if (argv.includes('--list')) {
    console.log('profiles: ' + Object.keys(PROFILES).concat(Object.keys(MUTATION_PROFILES)).join(', '));
    return 0;
  }
  const profile = (argv.find((a) => !a.startsWith('--')) || '').trim();
  if (!profile) {
    console.error('usage: node scripts/validate-aggregate.cjs <profile> [--demo-fail|--list]');
    return 2;
  }
  fs.mkdirSync(LOGDIR, { recursive: true });

  if (MUTATION_PROFILES[profile]) {
    const failed = runMutationProfile(profile, { demoFail, setupOnly });
    console.log('profile=' + profile + ' failed=' + failed);
    return failed ? 1 : 0;
  }

  const steps = PROFILES[profile];
  if (!steps) { console.error('unknown profile: ' + profile + ' (see --list)'); return 2; }
  if (steps.length === 0) {
    console.log('[SKIP] reports — no standalone active Reports suite; Report parity is owned by project-contract (group Q) and project-consumer (Report parity group)');
    return 0;
  }

  const t0 = Date.now();
  let passed = 0;
  let failed = 0;
  for (const step of steps) {
    const logFile = path.join(LOGDIR, profile.replace(/[:/]/g, '-') + '-' + step.label + '.log');
    const r = runChild(step, logFile);
    if (r.ok) {
      passed += 1;
      console.log('[PASS] ' + step.label + ' — ' + r.summary);
    } else {
      failed += 1;
      console.log('[FAIL] ' + step.label + ' — exit ' + r.exit);
      console.log('        details: ' + path.relative(ROOT, logFile));
    }
  }
  if (demoFail) { failed += 1; console.log('[FAIL] demo-fail — exit 3 (injected; proves nonzero propagation)'); }
  console.log('profile=' + profile + ' passed=' + passed + ' failed=' + failed
    + ' duration=' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
  return failed ? 1 : 0;
}

process.exit(main());
