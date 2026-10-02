/* TEMPORARY ACT 4B mutation controls (SM1-SM37 + MCC1-MCC6 + MGC1-MGC7).
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
// A case may name the validator it targets: the static read-only contract lives
// in scope-contract-validators.cjs, while the RENDERED/CALLED behaviour is
// covered by the Task consumers harness that loads the real owner verbatim.
const validatorFor = (c) => path.join(__dirname, c.validator || 'scope-contract-validators.cjs');

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

  // ---- ACT 4B FINAL POLISH — read-only Task Review, local navigation, --------
  // ---- identity and the resize diagnostic. ----------------------------------
  // Each mutation reintroduces exactly ONE of the device-review defects; the
  // fixture that exists for it must FAIL, and the file must come back
  // byte-identical.
  {
    id: 'SM13', file: 'js/workspace/task-review.js', expect: ['S30'],
    apply: (src) => plainReplace(src,
      'applyTaskReviewReadonlyChrome(scopedToCurrentDocument);',
      '/* mutated: the read-only chrome is never applied */'),
    note: 'the renderer no longer applies the read-only chrome',
  },
  {
    id: 'SM14', file: 'js/workspace/task-review.js', expect: ['S31'],
    apply: (src) => positionalReplace(src,
      'function applyTaskReviewReadonlyChrome(enabled) {',
      "panel.dataset.taskReviewReadonly = on ? '1' : '0';",
      "panel.dataset.taskReviewReadonly = on ? '1' : '0';",
      "panel.dataset.taskReviewReadonly = on ? '1' : '0';\n    panel.innerHTML = '<div class=\"workspaceTaskRow\"></div>';"),
    note: 'the chrome owner starts writing row markup (second row renderer)',
  },
  {
    id: 'SM15', file: 'js/workspace/task-review.js', expect: ['S32'],
    apply: (src) => plainReplace(src,
      'class="workspaceTaskStatusState"',
      'class="workspaceTaskStatusBtn"'),
    note: 'a local read-only row becomes an interactive status control',
  },
  {
    id: 'SM16', file: 'js/workspace/task-review.js', expect: ['S32'],
    apply: (src) => plainReplace(src,
      'data-current-document-line="${line}"',
      'data-path="${filePath}"'),
    note: 'a local row claims a Workspace path instead of a local line',
  },
  {
    id: 'SM17', file: 'js/workspace/task-review.js', expect: ['S33'],
    apply: (src) => plainReplace(src,
      'class="workspaceTaskGroupHeading" data-workspace-task-group="0"',
      'class="workspaceTaskGroupHeader" data-workspace-task-group="0"'),
    note: 'the local group heading becomes the interactive Workspace control',
  },
  {
    id: 'SM18', file: 'js/workspace/task-review.js', expect: ['P09'],
    validator: 'workspace-task-consumers-validators.cjs',
    // Anchored INSIDE the local branch: the file also contains
    // `scrollToLine(actualLine - 1)` in openTaskSource (the Workspace owner),
    // so a plain replace would mutate the wrong owner and prove nothing.
    apply: (src) => positionalReplace(src,
      "const localLineBtn = event.target?.closest?.('.workspaceTaskCurrentDocLine');",
      'const line = Number(localLineBtn.dataset.currentDocumentLine || 0);',
      'scrollToLine(line - 1);',
      'scrollToLine(line);'),
    note: 'local navigation is off by one line',
  },
  {
    id: 'SM19', file: 'js/workspace/task-review.js', expect: ['P05'],
    validator: 'workspace-task-consumers-validators.cjs',
    apply: (src) => plainReplace(src,
      "panel.querySelector?.('.workspaceSectionTitle')",
      "panel.querySelector?.('.workspaceTasksTitle')"),
    note: 'the title hook points at a class the shipped shell does not have',
  },
  {
    id: 'SM20', file: 'js/workspace/task-review.js', expect: ['P03'],
    validator: 'workspace-task-consumers-validators.cjs',
    apply: (src) => plainReplace(src,
      'data-current-document-line="${line}"',
      'data-source-line="${line}"'),
    note: 'the local line control loses its machine-readable line contract',
  },
  {
    id: 'SM21', file: 'index.html', expect: ['S36'],
    apply: (src) => plainReplace(src,
      '<aside id="workspaceSidebar" aria-label="Journal">',
      '<aside id="workspaceSidebar" aria-label="Notes workspace">'),
    note: 'the Journal shell advertises the retired Notes workspace identity',
  },
  {
    id: 'SM22', file: 'js/main.js', expect: ['S37'],
    apply: (src) => plainReplace(src,
      'facts.storedWidth = localStorage.getItem(WORKSPACE_SIDEBAR_WIDTH_STORAGE_KEY);',
      "localStorage.setItem(WORKSPACE_SIDEBAR_WIDTH_STORAGE_KEY, '300');"),
    note: 'the read-only resize diagnostic starts persisting a width',
  },
  {
    id: 'SM23', file: 'js/workspace/task-review.js', expect: ['P10'],
    validator: 'workspace-task-consumers-validators.cjs',
    apply: (src) => plainReplace(src,
      'safeLog(`TaskReview: local source navigation line=${line}`);',
      'globalThis.MME_APP?.openTextDocument?.();'),
    note: 'a local line click starts opening a document',
  },
  {
    id: 'SM24', file: 'js/workspace/task-review.js', expect: ['P11'],
    validator: 'workspace-task-consumers-validators.cjs',
    apply: (src) => positionalReplace(src,
      "const localLineBtn = event.target?.closest?.('.workspaceTaskCurrentDocLine');",
      'const line = Number(localLineBtn.dataset.currentDocumentLine || 0);',
      'if (line > 0) {',
      'if (line >= 0) {'),
    note: 'a record without a line fabricates a navigation to line 1',
  },
  {
    id: 'SM25', file: 'js/workspace/task-review.js', expect: ['P07'],
    validator: 'workspace-task-consumers-validators.cjs',
    // Anchored INSIDE the zero branch: the summary no longer repeats the empty
    // text, so the count is now the only line there.
    apply: (src) => positionalReplace(
      src,
      'if (scopedToCurrentDocument && filtered.length === 0) {',
      "badge.textContent = '0';",
      "badge.textContent = '0';",
      "badge.textContent = '1';"),
    note: 'an empty Current Document reports a fabricated count',
  },
  {
    id: 'SM26', file: 'js/workspace/task-review.js', expect: ['P08'],
    validator: 'workspace-task-consumers-validators.cjs',
    // The ROW's own source path, not the group header's: P08 asserts the
    // status control deep-links to the exact task source.
    apply: (src) => positionalReplace(src,
      'class="workspaceTaskStatusBtn"',
      'data-path="${filePath}"',
      'data-path="${filePath}"',
      'data-path=""'),
    note: 'the accepted Workspace row loses its source path',
  },
  {
    id: 'SM27', file: 'js/main.js', expect: ['S39'],
    apply: (src) => plainReplace(src,
      '        logAct4bResizeSnapshot();',
      '        /* mutated: the temporary Logs action does nothing */'),
    note: 'the temporary Logs command no longer calls the diagnostic owner',
  },
  {
    id: 'SM28', file: 'js/main.js', expect: ['S40'],
    apply: (src) => plainReplace(src,
      'const facts = collectWorkspaceSidebarResizeDiagnostics();',
      "const facts = collectWorkspaceSidebarResizeDiagnostics();\n    localStorage.setItem('markmap:act4b:probe', '1');"),
    note: 'the snapshot action starts writing to storage',
  },
  {
    id: 'SM29', file: 'js/main.js', expect: ['S41'],
    apply: (src) => plainReplace(src,
      'facts.handleVisibility = cs.visibility;',
      '/* mutated: the handle visibility fact is dropped */'),
    note: 'the diagnostic owner stops reporting a required snapshot fact',
  },
  {
    id: 'SM30', file: 'js/main.js', expect: ['S42'],
    // Adds a SECOND log call to the pointermove path: exactly the "log every
    // pointermove" regression the bounded evidence exists to prevent.
    apply: (src) => plainReplace(src,
      '      act4bResizeEvidence.final = move;',
      '      act4bResizeEvidence.final = move;\n      logAct4bResizeMove(\'move\', move);'),
    note: 'the resize evidence starts logging EVERY pointermove',
  },
  {
    id: 'SM31', file: 'js/main.js', expect: ['S43'],
    apply: (src) => plainReplace(src,
      'const result = toggleWorkspacePanel(panelId);',
      'const result = null; toggleWorkspacePanel(panelId);'),
    note: 'the collapse owner stops recording the before/after states',
  },
  {
    id: 'SM32', file: 'css/workspace.css', expect: ['S44'],
    apply: (src) => plainReplace(src,
      "html[data-journal-composition='note'] #workspaceWorkspaceSection {",
      "html[data-journal-composition='none'] #workspaceWorkspaceSection {"),
    note: 'the Note composition no longer withdraws the Workspace section',
  },
  {
    id: 'SM33', file: 'css/workspace.css', expect: ['P12'],
    validator: 'workspace-task-consumers-validators.cjs',
    apply: (src) => plainReplace(src,
      '#workspaceTasksPanel.workspaceTaskReviewReadonly .workspaceTaskFilterRow,\n',
      ''),
    note: 'the read-only scope stops withdrawing the status/priority filters',
  },
  {
    id: 'SM34', file: 'js/workspace/task-review.js', expect: ['P13'],
    validator: 'workspace-task-consumers-validators.cjs',
    apply: (src) => plainReplace(src,
      "${line ? `Line ${line}` : 'No line'}",
      "${fileName}${line ? `:${line}` : ''}"),
    note: 'a local row repeats the filename on every source line again',
  },
  {
    id: 'SM35', file: 'js/workspace/task-review.js', expect: ['P14'],
    validator: 'workspace-task-consumers-validators.cjs',
    apply: (src) => plainReplace(src,
      'providerCount=${result.providerCount ?? 0}',
      'providerCount=0'),
    note: 'the refresh result reports a hardcoded count again',
  },
  {
    id: 'SM36', file: 'js/workspace/task-review.js', expect: ['P15'],
    validator: 'workspace-task-consumers-validators.cjs',
    apply: (src) => plainReplace(src,
      'const filtered = scopedToCurrentDocument ? all : applyTaskFilters(all, filterState);',
      'const filtered = applyTaskFilters(all, filterState);'),
    note: 'a stale Workspace filter decides which local rows a Note shows',
  },
  {
    id: 'SM37', file: 'js/workspace/task-review.js', expect: ['P07'],
    validator: 'workspace-task-consumers-validators.cjs',
    apply: (src) => plainReplace(src,
      "summary.textContent = '';",
      "summary.textContent = 'No tasks.';"),
    note: 'the zero-task Note shows the same empty message twice',
  },
  // ---- ACT 4B COLLAPSE CORRECTION -------------------------------------------
  {
    id: 'MCC1', file: 'js/main.js', expect: ['CC02', 'CC07'],
    validator: 'collapse-validators.cjs',
    apply: (src) => positionalReplace(
      src,
      'function applySidebarComposition(options) {',
      'wireWorkspacePanelCollapses();',
      'wireWorkspacePanelCollapses();',
      '/* mutated: the shared Journal boundary no longer wires collapse delegation */'),
    note: 'remove shared delegation from Standalone initialization',
  },
  {
    id: 'MCC2', file: 'js/main.js', expect: ['CC03'],
    validator: 'collapse-validators.cjs',
    apply: (src) => plainReplace(src,
      'data-workspace-panel-toggle="active"',
      'data-workspace-panel-toggle="activePanel"'),
    note: 'give Active an incompatible toggle key',
  },
  {
    id: 'MCC3', file: 'index.html', expect: ['CC04'],
    validator: 'collapse-validators.cjs',
    apply: (src) => plainReplace(src,
      'data-workspace-panel-toggle="related"',
      'data-workspace-panel-toggle="linksOut"'),
    note: 'give Links Out an incompatible toggle key',
  },
  {
    id: 'MCC4', file: 'js/main.js', expect: ['CC09'],
    validator: 'collapse-validators.cjs',
    apply: (src) => plainReplace(src,
      "btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');",
      '/* mutated: aria-expanded is no longer updated */'),
    note: 'stop aria-expanded updates on the shared toggle',
  },
  {
    id: 'MCC5', file: 'js/main.js', expect: ['CC11'],
    validator: 'collapse-validators.cjs',
    apply: (src) => plainReplace(src,
      '    wireWorkspacePanelCollapses();',
      "    wireWorkspacePanelCollapses();\n    try { setWorkspacePanelCollapsedState('active', false); } catch {}"),
    note: 'reset local panel state during the Note composition',
  },
  {
    id: 'MCC6', file: 'js/main.js', expect: ['CC13'],
    validator: 'collapse-validators.cjs',
    apply: (src) => positionalReplace(
      src,
      'function finalizeWorkspaceSidebar() {',
      'wireWorkspacePanelCollapses();',
      'wireWorkspacePanelCollapses();',
      '/* mutated: the Workspace boundary no longer wires collapse delegation */'),
    note: 'break Workspace child collapse',
  },
  {
    id: 'MGC1', file: 'css/workspace.css', expect: ['GC04'],
    validator: 'collapse-validators.cjs',
    apply: (src) => plainReplace(src,
      'html.journal-sidebar-collapsed .workspaceCompositionLabel,\nhtml.journal-sidebar-collapsed .workspaceCompositionName,\n',
      ''),
    note: 'allow the identity line and filename while globally collapsed',
  },
  {
    id: 'MGC2', file: 'css/workspace.css', expect: ['GC03'],
    validator: 'collapse-validators.cjs',
    apply: (src) => plainReplace(src,
      'html.journal-sidebar-collapsed .workspaceNavScroller > :not(.workspaceHeader) {',
      'html.journal-sidebar-collapsed .workspaceNavScrollerNever > :not(.workspaceHeader) {'),
    note: 'allow panel hosts while globally collapsed',
  },
  {
    id: 'MGC3', file: 'css/workspace.css', expect: ['GC02'],
    validator: 'collapse-validators.cjs',
    apply: (src) => plainReplace(src,
      'html.journal-sidebar-collapsed .workspaceWorkspaceSection #btnNewConcept {\n  margin-left: 0;\n}',
      'html.journal-sidebar-collapsed .workspaceWorkspaceSection #btnNewConcept {\n  margin-left: 0;\n  display: none;\n}'),
    note: 'hide the Today / New Note icons in a collapsed Workspace',
  },
  {
    id: 'MGC4', file: 'index.html', expect: ['GC06'],
    validator: 'collapse-validators.cjs',
    apply: (src) => plainReplace(src,
      '<button id="btnOpenNote" type="button" aria-label="Open Note, single Markdown file">',
      '<button id="btnOpenNote" type="button">'),
    note: 'remove a compact action accessible name',
  },
  {
    id: 'MGC5', file: 'js/workspace/workspace-controller.js', expect: ['GC09', 'GC10'],
    validator: 'collapse-validators.cjs',
    apply: (src) => plainReplace(src,
      "  setLocalStorageValue(JOURNAL_SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');",
      "  setLocalStorageValue(JOURNAL_SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');\n  try { localStorage.setItem('markmap:workspace:panelCollapsed', '{}'); } catch {}"),
    note: 'global collapse clears the child-panel states',
  },
  {
    id: 'MGC6', file: 'js/workspace/workspace-controller.js', expect: ['GC11'],
    validator: 'collapse-validators.cjs',
    apply: (src) => plainReplace(src,
      "  setLocalStorageValue(JOURNAL_SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');",
      "  setLocalStorageValue(JOURNAL_SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');\n  try { storeWorkspaceSidebarWidth?.(52); } catch {}"),
    note: 'persist 52px as the expanded width',
  },
  {
    id: 'MGC7', file: 'js/main.js', expect: ['GC12'],
    validator: 'collapse-validators.cjs',
    apply: (src) => plainReplace(src,
      'function setStatus(s) {',
      "function setStatus(s) {\n  document.documentElement.classList.toggle('journal-sidebar-collapsed', false);"),
    note: 'introduce another global collapse owner',
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

// PREFLIGHT — a lock file marks a run as in progress. A previous run that was
// killed mid-case (or a concurrent run) would otherwise leave a mutated source
// behind, and every later result would be unreadable. Refuse loudly instead.
const LOCK = path.join(ROOT, '.act4b-mutation.lock');
if (fs.existsSync(LOCK)) {
  console.error(
    'MUTATION CONTROLS: REFUSED — ' + path.basename(LOCK) + ' exists, so a previous run did not finish.\n' +
    'Restore the mutated sources (git checkout -- js css index.html sw.js) and delete the lock file.'
  );
  process.exit(2);
}
fs.writeFileSync(LOCK, String(process.pid), 'utf8');
function releaseLock() {
  try { fs.unlinkSync(LOCK); } catch {}
}
process.on('exit', releaseLock);

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
      const run = spawnSync(process.execPath, [validatorFor(c)], {
        encoding: 'utf8', cwd: ROOT, maxBuffer: 32 * 1024 * 1024,
      });
      const text = (run.stdout || '') + (run.stderr || '');
      observed = [...new Set([...text.matchAll(/^\s*FAIL\s+(\S+)/gm)].map((m) => m[1].replace(/^\[|\]$/g, '')))];
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
