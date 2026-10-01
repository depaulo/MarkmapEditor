/* TEMPORARY ACT 4B mutation controls (SM1-SM12).
 * Not part of the app. For each case: mutate ONE shipped source in exactly one
 * place, run scripts/scope-contract-validators.cjs, assert that the fixtures the
 * mutation targets FAIL (the fixture is load-bearing), then restore the file and
 * verify it is byte-identical to its original (no residue).
 * Run: node scripts/act4b-mutation-controls.cjs
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const VALIDATORS = path.join(__dirname, 'scope-contract-validators.cjs');

const sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

function positionalReplace(src, anchor, afterNeedle, victim, replacement) {
  const a = src.indexOf(anchor);
  if (a === -1) return { src, error: 'anchor missing: ' + anchor };
  const b = src.indexOf(afterNeedle, a);
  if (b === -1) return { src, error: 'needle missing after anchor: ' + afterNeedle };
  const v = src.indexOf(victim, b);
  if (v === -1) return { src, error: 'victim missing after needle: ' + victim };
  return { src: src.slice(0, v) + replacement + src.slice(v + victim.length), error: null };
}

function plainReplace(src, find, replacement, { all = false } = {}) {
  const count = src.split(find).length - 1;
  if (count === 0) return { src, error: 'find missing: ' + JSON.stringify(find.slice(0, 70)) };
  return {
    src: all ? src.split(find).join(replacement) : src.replace(find, replacement),
    error: null,
    count,
  };
}

const CASES = [
  {
    id: 'SM1', file: 'css/workspace.css', expect: ['S02', 'S03'],
    apply: (src) => plainReplace(src,
      '#workspaceJournalsPanel[hidden],\n#workspaceConceptsPanel[hidden],',
      '#workspaceConceptsPanel[hidden],'),
    note: 'drop Journals from the [hidden] !important guard selector list',
  },
  {
    id: 'SM2', file: 'js/main.js', expect: ['S04'],
    apply: (src) => positionalReplace(src,
      'function renderWorkspaceTagsPanel(', '!localScope.workspaceAvailable',
      'panel.hidden = false;', '/* mutated: show withdrawn */'),
    note: 'remove the Tags local-branch show (panel.hidden = false)',
  },
  {
    id: 'SM3', file: 'js/main.js', expect: ['S05'],
    apply: (src) => plainReplace(src,
      "if (typeof applySidebarComposition === 'function') applySidebarComposition();",
      '/* mutated: no composition call */'),
    note: 'composeStandaloneNotePanels no longer applies the Sidebar composition',
  },
  {
    id: 'SM4', file: 'js/main.js', expect: ['S06'],
    apply: (src) => plainReplace(src,
      "describePanelVisibility('workspaceTagsPanel')", "'tags-panel'", { all: true }),
    note: 'composition log no longer reports Tags computed visibility',
  },
  {
    id: 'SM5', file: 'js/main.js', expect: ['S08', 'S10'],
    apply: (src) => plainReplace(src,
      "localTitle.textContent = 'Links Out';", "localTitle.textContent = 'Links In';"),
    note: 'local relationship branch mislabels direction as Links In',
  },
  {
    id: 'SM6', file: 'js/main.js', expect: ['S10'],
    apply: (src) => positionalReplace(src,
      'function renderWorkspaceRelatedPanel(', "textContent = 'Links Out'",
      'return;', '/* mutated: local branch no longer returns */'),
    note: 'local relationship branch does not return before the Workspace label write',
  },
  {
    id: 'SM7', file: 'js/main.js', expect: ['S15'],
    apply: (src) => plainReplace(src,
      "if (cs.display === 'none') return false;", '/* mutated: hidden-property only */'),
    note: 'isPanelActuallyVisible stops reading computed display',
  },
  {
    id: 'SM8', file: 'js/main.js', expect: ['S17'],
    apply: (src) => plainReplace(src,
      'failures.push(`${id}=workspace-panel-still-visible`);',
      "failures.push('silenced');"),
    note: 'verification no longer fails a still-visible withdrawn host',
  },
  {
    id: 'SM9', file: 'js/main.js', expect: ['S18'],
    apply: (src) => plainReplace(src,
      'const verification = verifyStandaloneNoteComposition();',
      'const verification = { ok: true, failures: [], checked: 4, withdrawn: 0 };'),
    note: 'completion gated on a hardcoded result instead of DOM verification',
  },
  {
    id: 'SM10', file: 'js/main.js', expect: ['S19'],
    apply: (src) => plainReplace(src,
      '      renderStable,\n      compositionOk,\n    };',
      '      renderStable,\n    };'),
    note: 'openNote result drops compositionOk',
  },
  {
    id: 'SM11', file: 'js/main.js', expect: ['S24'],
    apply: (src) => plainReplace(src,
      'const compositionOk = !compositionReport || compositionReport.complete !== false;',
      'const compositionOk = !compositionReport || compositionReport.complete !== false;\n' +
      '    { const el = document.getElementById(\'workspaceTagsPanel\'); if (el) el.hidden = false; }'),
    note: 'a hidden=false restore appears AFTER composition',
  },
  {
    id: 'SM12', file: 'sw.js', expect: ['S29', 'R03'],
    apply: (src) => plainReplace(src,
      'markmap-journal-pwa-0.6.3-tasks-wiki-links-foundation',
      'markmap-journal-pwa-0.6.4-tasks-wiki-links-foundation'),
    note: 'service-worker cache identity bumped to 0.6.4',
  },
];

// Optional CLI filter: `node act4b-mutation-controls.cjs SM1 SM2 ...`
const only = process.argv.slice(2);
const activeCases = only.length
  ? CASES.filter((c) => only.some((o) => c.id === o))
  : CASES;
if (!activeCases.length) {
  console.error('no cases match: ' + only.join(','));
  process.exit(2);
}

const files = [...new Set(activeCases.map((c) => c.file))];
const originals = {};
const hashes = {};
files.forEach((f) => {
  const p = path.join(ROOT, f);
  originals[f] = fs.readFileSync(p, 'utf8');
  hashes[f] = sha(p);
});

const rows = [];
let controlsFailed = 0;

try {
  for (const c of activeCases) {
    const p = path.join(ROOT, c.file);
    let result;
    try {
      result = c.apply(originals[c.file]);
    } catch (e) {
      result = { src: originals[c.file], error: e.message };
    }
    if (result.error) {
      controlsFailed += 1;
      rows.push({ id: c.id, status: 'MUTATION-REFUSED', error: result.error, expect: c.expect, observed: [], missing: c.expect.slice(), residue: 'no' });
      continue;
    }
    fs.writeFileSync(p, result.src, 'utf8');
    let observed = [];
    let runError = null;
    try {
      const run = spawnSync(process.execPath, [VALIDATORS], {
        encoding: 'utf8', cwd: ROOT, maxBuffer: 32 * 1024 * 1024,
      });
      const text = (run.stdout || '') + (run.stderr || '');
      observed = [...new Set([...text.matchAll(/^\s*FAIL\s+(\S+)/gm)].map((m) => m[1]))];
      // A crash (e.g. an invalid mutation) must be reported, not read as "no failures".
      if (!run.stdout && run.status !== 0) {
        runError = 'validators crashed, exit=' + run.status + ': ' +
          String(run.stderr || '').split('\n').find((l) => l.trim()) ;
      }
    } catch (e) {
      runError = e.message;
    } finally {
      fs.writeFileSync(p, originals[c.file], 'utf8');
    }
    const residue = sha(p) !== hashes[c.file];
    const missing = c.expect.filter((id) => !observed.includes(id));
    const ok = !runError && missing.length === 0 && !residue;
    if (!ok) controlsFailed += 1;
    rows.push({
      id: c.id, status: ok ? 'PASS' : 'FAIL', note: c.note,
      expect: c.expect, observed, missing, residue, error: runError,
    });
  }
} finally {
  // Hard guarantee: every file is back to its original bytes.
  files.forEach((f) => fs.writeFileSync(path.join(ROOT, f), originals[f], 'utf8'));
}

rows.forEach((r) => {
  console.log(`${r.status}  ${r.id}  expected=[${r.expect.join(',')}] observed=[${r.observed.join(',')}]` +
    ` missing=[${r.missing.join(',')}] residue=${r.residue}${r.error ? ' error=' + r.error : ''}`);
  if (r.note) console.log(`        ${r.note}`);
});
const finalCheck = files.map((f) => `${f}:${sha(path.join(ROOT, f)) === hashes[f] ? 'restored' : 'DIRTY'}`);
console.log('final: ' + finalCheck.join('  '));
console.log(controlsFailed === 0
  ? 'MUTATION CONTROLS: ALL ' + activeCases.length + ' PASSED'
  : 'MUTATION CONTROLS: ' + controlsFailed + ' FAILED');
process.exit(controlsFailed === 0 ? 0 : 1);
