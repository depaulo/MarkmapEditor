#!/usr/bin/env node
'use strict';

/**
 * Bulk Task reconciliation validators (recreated harness).
 *
 * Tests the REAL owners: js/tasks/task-lifecycle.js (matcher + lifecycle writer)
 * and the REAL Markdown Task parser extracted from js/main.js
 * (parseMarkdownTasks + normalizeParserText + normalizeMetadataKey +
 * cleanTaskText + parseMmeTaskMetadata). The save loop run here mirrors the
 * shipped reconcileTasksBeforeSave flow and is bound back to that source by the
 * static checks in this script (see X-series), so the harness cannot drift
 * silently from the product.
 *
 * Proven duplicate contract under test:
 *   SAFE NEW DUPLICATES      baseline absent, all occurrences new -> opened may
 *                            be applied to every occurrence.
 *   TRUE OVERLAP AMBIGUITY   baseline occurrence(s) exist and an extra
 *                            indistinguishable occurrence appears -> existing
 *                            pairs and metadata are preserved, the extra
 *                            occurrence stays untagged (ambiguous).
 *
 * Usage: node scripts/task-reconcile-validators.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MAIN_JS_PATH = path.join(ROOT, 'js', 'main.js');
const LIFECYCLE_PATH = path.join(ROOT, 'js', 'tasks', 'task-lifecycle.js');
const BOARD_PATH = path.join(ROOT, 'js', 'tasks', 'task-board.js');
const REVIEW_PATH = path.join(ROOT, 'js', 'workspace', 'task-review.js');

const results = [];
function check(id, name, ok, detail) {
  results.push({ id, name, ok: Boolean(ok), detail: detail == null ? '' : String(detail) });
}
function group(title) {
  results.push({ group: title });
}

const MAIN_SRC = fs.readFileSync(MAIN_JS_PATH, 'utf8');

/* ------------------------------ real lifecycle ------------------------------ */

require(LIFECYCLE_PATH);
const L = globalThis.MME_TASK_LIFECYCLE;

if (!L || typeof L.matchTasksForSave !== 'function' || typeof L.applySaveLifecycle !== 'function') {
  console.error('FATAL: MME_TASK_LIFECYCLE owner unavailable — cannot validate.');
  process.exit(1);
}

/* --------------------- real parser extracted from main.js -------------------- */

function sliceBalanced(src, openIndex, fromIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  let prev = '';

  for (let i = openIndex; i < src.length; i += 1) {
    const c = src[i];
    const n = src[i + 1];

    if (lineComment) {
      if (c === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (c === '*' && n === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (c === '\\') {
        escaped = true;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && n === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (c === '/' && n === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      continue;
    }
    if (c === '/' && /[=(,:[!&|?{};+\-*%<>~^\n]/.test(prev || '\n')) {
      let inClass = false;
      for (let j = i + 1; j < src.length; j += 1) {
        const rc = src[j];
        if (rc === '\\') {
          j += 1;
          continue;
        }
        if (rc === '\n') {
          i = j;
          break;
        }
        if (rc === '[') inClass = true;
        else if (rc === ']') inClass = false;
        else if (rc === '/' && !inClass) {
          i = j;
          break;
        }
      }
      prev = '/';
      continue;
    }
    if (c === '{') {
      depth += 1;
      prev = c;
      continue;
    }
    if (c === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(fromIndex == null ? openIndex : fromIndex, i + 1);
      prev = c;
      continue;
    }
    if (!/\s/.test(c)) prev = c;
  }

  return null;
}

function findFunctionSource(src, name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  if (start === -1) return null;
  const open = src.indexOf('{', start + marker.length);
  if (open === -1) return null;
  return sliceBalanced(src, open, start);
}

const parserSources = ['normalizeParserText', 'normalizeMetadataKey', 'cleanTaskText', 'parseMmeTaskMetadata', 'parseMarkdownTasks']
  .map((name) => findFunctionSource(MAIN_SRC, name));

const parserFactory = new Function(
  'MME_TASK_LIFECYCLE',
  `${parserSources.join('\n')}\nreturn parseMarkdownTasks;`
);

const parseMarkdownTasks = parserFactory(L);

/* ---------------- save-loop adapter (mirrors reconcileTasksBeforeSave) -------------- */

function reconcileText(text, baselineTasks, today) {
  const currentTasks = parseMarkdownTasks(text);
  const lines = String(text).split('\n');
  let changed = false;
  let completedAdded = 0;
  let completedRemoved = 0;
  let openedAdded = 0;

  if (baselineTasks == null) {
    return {
      changed: false,
      text,
      completedAdded: 0,
      completedRemoved: 0,
      openedAdded: 0,
      ambiguous: 0,
      currentTasks,
      newIndices: [],
      ambiguousIndices: [],
      pairs: [],
      skippedRewrite: false,
    };
  }

  const match = L.matchTasksForSave(baselineTasks, currentTasks);
  const ambiguous = match.ambiguous;

  for (const pair of match.pairs) {
    const baseline = baselineTasks[pair.baseline];
    const current = currentTasks[pair.current];
    if (!baseline || !current) continue;
    if (current.done === baseline.done) continue;

    const res = L.applySaveLifecycle(current.raw, {
      today,
      isNew: false,
      checked: current.done,
      explicitStatus: null,
    });

    if (res.ok && res.changed) {
      const lineIndex = current.line - 1;
      if (lineIndex >= 0 && lineIndex < lines.length) {
        lines[lineIndex] = res.line;
        changed = true;
        if (res.added && res.added.completed) completedAdded += 1;
        if (res.removed && res.removed.completed) completedRemoved += 1;
      }
    }
  }

  for (const newIndex of match.newIndices || []) {
    if (!Number.isInteger(newIndex)) continue;
    const current = currentTasks[newIndex];
    if (!current || typeof current.raw !== 'string' || !current.raw) continue;

    const lineIndex = current.line - 1;
    if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= lines.length) continue;

    const res = L.applySaveLifecycle(current.raw, {
      today,
      isNew: true,
      checked: Boolean(current.done),
      explicitStatus: current.status || null,
    });

    if (res.ok && res.changed) {
      lines[lineIndex] = res.line;
      changed = true;
      if (res.added && res.added.opened) openedAdded += 1;
    }
  }

  return {
    changed,
    text: changed ? lines.join('\n') : text,
    completedAdded,
    completedRemoved,
    openedAdded,
    ambiguous,
    currentTasks,
    newIndices: match.newIndices || [],
    ambiguousIndices: match.ambiguousIndices || [],
    pairs: match.pairs,
    skippedRewrite: match.skippedRewrite,
  };
}

// Full physical-Save simulation: reconcile -> write -> baseline refresh.
function simulateSave(state, today) {
  const res = reconcileText(state.text, state.baseline, today);
  state.text = res.text;
  state.baseline = parseMarkdownTasks(state.text);
  return res;
}

/* ---------------------------------- helpers --------------------------------- */

const TODAY = '2026-09-24';

function openTask(n, prefix) {
  return `- [ ] ${prefix || 'BULK'}-${String(n).padStart(2, '0')}`;
}

function openTaskLines(count, prefix) {
  const out = [];
  for (let i = 1; i <= count; i += 1) out.push(openTask(i, prefix));
  return out;
}

function metadataCommentLines(text) {
  return String(text)
    .split('\n')
    .filter((line) => /<!--\s*mme-task:/i.test(line));
}

function openedCount(text) {
  return metadataCommentLines(text).filter((line) => /opened=\d{4}-\d{2}-\d{2}/.test(line)).length;
}

function linesWithDuplicateComments(text) {
  return metadataCommentLines(text).filter((line) => {
    const matches = line.match(/<!--\s*mme-task:/gi);
    return matches && matches.length > 1;
  });
}

const LIFECYCLE_SRC = fs.readFileSync(LIFECYCLE_PATH, 'utf8');
const BOARD_SRC = fs.readFileSync(BOARD_PATH, 'utf8');

/* ------------------------- R1-R7 reconciliation flow ------------------------- */

group('R1. one newly typed Task');
{
  const base = '- [ ] Existing one\n- [ ] Existing two\n';
  const state = { text: `${base}- [ ] Newly typed task\n`, baseline: parseMarkdownTasks(base) };
  const res = simulateSave(state, TODAY);
  check('R1a', 'single new Task is classified new (opened=1, ambiguous=0)', res.openedAdded === 1 && res.ambiguous === 0 && res.changed === true, JSON.stringify({ opened: res.openedAdded, ambiguous: res.ambiguous }));
  check('R1b', 'canonical opened metadata written', state.text.includes(`- [ ] Newly typed task <!-- mme-task: opened=${TODAY} -->`), state.text);
  const second = simulateSave(state, TODAY);
  check('R1c', 'second save is idempotent', second.changed === false && second.openedAdded === 0 && second.ambiguous === 0);
}

group('R2. ten unique pasted Tasks in one pure-insertion region (owner case)');
{
  const base = '# Journal\n\n- [ ] Anchor one\n- [ ] Anchor two\n';
  const state = { text: `${base}\n${openTaskLines(10).join('\n')}\n`, baseline: parseMarkdownTasks(base) };
  const res = simulateSave(state, TODAY);
  check('R2a', 'all ten Tasks are classified new', res.newIndices.length === 10, JSON.stringify({ newIndices: res.newIndices.length, skipped: res.skippedRewrite }));
  check('R2b', 'opened metadata written to all ten (first physical Save)', res.openedAdded === 10 && openedCount(state.text) === 10, `openedAdded=${res.openedAdded} openedCount=${openedCount(state.text)}`);
  check('R2c', 'ambiguous is zero (owner regression fixed)', res.ambiguous === 0, `ambiguous=${res.ambiguous}`);
  check('R2d', 'anchors are untouched', state.text.includes('- [ ] Anchor one\n') && state.text.includes('- [ ] Anchor two\n'));
}

group('R3. ten Tasks at the end of a large report');
{
  const body = [];
  for (let i = 0; i < 60; i += 1) body.push(`Report paragraph ${i} with **bold** and \`code\`.`);
  const base = `# Report\n\n${body.join('\n')}\n\n- [ ] Known task\n`;
  const state = { text: `${base}\n## New Tasks\n\n${openTaskLines(10, 'REPORT').join('\n')}\n`, baseline: parseMarkdownTasks(base) };
  const res = simulateSave(state, TODAY);
  check('R3a', 'all ten report Tasks receive opened', res.openedAdded === 10 && res.ambiguous === 0, `opened=${res.openedAdded} ambiguous=${res.ambiguous}`);
  check('R3b', 'unrelated report content unchanged', body.every((line) => state.text.includes(line)));
}

group('R4. unique Tasks inserted between existing Tasks');
{
  const base = '- [ ] First\n- [ ] Middle\n- [ ] Last\n';
  const state = { text: '- [ ] First\n- [ ] INSERTED-A\n- [ ] Middle\n- [ ] INSERTED-B\n- [ ] Last\n', baseline: parseMarkdownTasks(base) };
  const res = simulateSave(state, TODAY);
  check('R4a', 'only the new Tasks receive opened', res.openedAdded === 2 && res.ambiguous === 0, `opened=${res.openedAdded} ambiguous=${res.ambiguous}`);
  check('R4b', 'existing Task lines are unmodified', state.text.includes('- [ ] First\n') && state.text.includes('- [ ] Middle\n') && state.text.includes('- [ ] Last\n'));
  check('R4c', 'no metadata backfilled onto existing Tasks', !/- \[ \] First <!--/.test(state.text) && !/- \[ \] Middle <!--/.test(state.text));
}

group('R5. unique Tasks mixed with a duplicate of an existing Task');
{
  const base = '- [ ] Shared label\n';
  const state = { text: '- [ ] Shared label\n- [ ] UNIQUE-ONE\n- [ ] Shared label\n- [ ] UNIQUE-TWO\n', baseline: parseMarkdownTasks(base) };
  const res = simulateSave(state, TODAY);
  check('R5a', 'unique Tasks receive opened', openedCount(state.text) === 2 && state.text.includes('UNIQUE-ONE <!-- mme-task: opened=') && state.text.includes('UNIQUE-TWO <!-- mme-task: opened='), state.text);
  check('R5b', 'the overlapping duplicate stays untagged', !/- \[ \] Shared label <!--/.test(state.text), state.text);
  check('R5c', 'overlap ambiguity is reported', res.ambiguous >= 1, `ambiguous=${res.ambiguous}`);
}

group('R6. genuine duplicate ambiguity (true overlap)');
{
  const base = '- [ ] Duplicate Task\n';
  const state = { text: '- [ ] Duplicate Task\n- [ ] Duplicate Task\n', baseline: parseMarkdownTasks(base) };
  const res = simulateSave(state, TODAY);
  check('R6a', 'no metadata assigned to the extra occurrence', res.openedAdded === 0 && openedCount(state.text) === 0, state.text);
  check('R6b', 'ambiguity remains observable', res.ambiguous >= 1, `ambiguous=${res.ambiguous}`);
  check('R6c', 'duplicate lines are byte-identical to the input', state.text === '- [ ] Duplicate Task\n- [ ] Duplicate Task\n');
}

group('R7. mixed replacement is conservative');
{
  const base = '- [ ] Alpha\n- [ ] Beta\n';
  const state = { text: '- [ ] Alpha replaced\n- [ ] Gamma\n', baseline: parseMarkdownTasks(base) };
  const res = simulateSave(state, TODAY);
  check('R7a', 'no new-Task classification for a replacement', res.openedAdded === 0, `opened=${res.openedAdded}`);
  check('R7b', 'ambiguity reported', res.ambiguous >= 1, `ambiguous=${res.ambiguous}`);
  check('R7c', 'no opened metadata inserted', openedCount(state.text) === 0);
}

/* ---------------------- R8-R12 contract + content --------------------- */

group('R8. boundary values (effective global ceilings)');
{
  const cases = [
    { n: 8, opened: 8, ambiguous: 0 },
    { n: 9, opened: 9, ambiguous: 0 },
    { n: 10, opened: 10, ambiguous: 0 },
    { n: 16, opened: 16, ambiguous: 0 },
    { n: 17, opened: 0, ambiguous: 17 },
    { n: 20, opened: 0, ambiguous: 20 },
    { n: 21, opened: 0, ambiguous: 21 },
  ];
  for (const c of cases) {
    const base = '- [ ] Anchor\n';
    const state = { text: `${base}${openTaskLines(c.n, 'B').join('\n')}\n`, baseline: parseMarkdownTasks(base) };
    const res = simulateSave(state, TODAY);
    check(
      `R8.${c.n}`,
      `${c.n} unique pure-insertion Tasks -> opened=${c.opened}, ambiguous=${c.ambiguous}`,
      res.openedAdded === c.opened && res.ambiguous === c.ambiguous,
      JSON.stringify({ opened: res.openedAdded, ambiguous: res.ambiguous, skipped: res.skippedRewrite })
    );
  }
}

group('R9. above-limit behaviour stays conservative');
{
  const base = '- [ ] Anchor\n';
  const state = { text: `${base}${openTaskLines(17, 'X').join('\n')}\n`, baseline: parseMarkdownTasks(base) };
  const res = simulateSave(state, TODAY);
  check('R9a', 'no metadata assigned above the ceiling', res.openedAdded === 0 && openedCount(state.text) === 0);
  check('R9b', 'result exposes unresolved ambiguity', res.ambiguous === 17 && res.skippedRewrite === true, `ambiguous=${res.ambiguous} skipped=${res.skippedRewrite}`);
  const second = simulateSave(state, TODAY);
  check('R9c', 'no automatic recovery is claimed (second save tags nothing)', second.openedAdded === 0, `opened=${second.openedAdded}`);
}

group('R10. repeated saves after a successful reconciliation');
{
  const base = '# Journal\n\n- [ ] Anchor\n';
  const state = { text: `${base}${openTaskLines(10).join('\n')}\n`, baseline: parseMarkdownTasks(base) };
  simulateSave(state, TODAY);
  const res2 = simulateSave(state, TODAY);
  const res3 = simulateSave(state, TODAY);
  check('R10a', 'second save reports changed=false opened=0 ambiguous=0', res2.changed === false && res2.openedAdded === 0 && res2.ambiguous === 0, JSON.stringify({ changed: res2.changed, opened: res2.openedAdded, ambiguous: res2.ambiguous }));
  check('R10b', 'third save is equally clean', res3.changed === false && res3.openedAdded === 0);
  check('R10c', 'no metadata duplication', linesWithDuplicateComments(state.text).length === 0 && openedCount(state.text) === 10, `openedCount=${openedCount(state.text)}`);
}

group('R11. no duplicate managed comments');
{
  const base = '- [ ] One\n- [ ] Two\n';
  const state = { text: `${base}- [ ] Three\n`, baseline: parseMarkdownTasks(base) };
  simulateSave(state, TODAY);
  state.text = state.text.replace('- [ ] Two', '- [x] Two');
  simulateSave(state, TODAY);
  simulateSave(state, TODAY);
  const duplicateComments = linesWithDuplicateComments(state.text);
  check('R11a', 'no Task line carries two mme-task comments', duplicateComments.length === 0, duplicateComments.join(' | '));
  check('R11b', 'exactly one opened comment and one completed comment', openedCount(state.text) === 1 && (state.text.match(/completed=\d{4}-\d{2}-\d{2}/g) || []).length === 1, state.text);
}

group('R12. exact opened metadata content');
{
  const fresh = L.applySaveLifecycle('- [ ] Exact', { today: TODAY, isNew: true, checked: false, explicitStatus: null });
  check('R12a', 'canonical local date used', fresh.ok === true && fresh.line === `- [ ] Exact <!-- mme-task: opened=${TODAY} -->`, fresh.line);
  const kept = L.applySaveLifecycle('- [ ] Exact <!-- mme-task: opened=2026-01-01 -->', { today: TODAY, isNew: true, checked: false, explicitStatus: null });
  check('R12b', 'existing hand-written opened date preserved (add-only-if-absent)', kept.line === '- [ ] Exact <!-- mme-task: opened=2026-01-01 -->' && kept.changed === false, kept.line);
  const withStatus = L.applySaveLifecycle('- [ ] Exact', { today: TODAY, isNew: true, checked: false, explicitStatus: 'backlog' });
  check('R12c', 'serialization stays valid alongside status', /<!-- mme-task:[^>]*opened=\d{4}-\d{2}-\d{2}/.test(withStatus.line) && /status=backlog/.test(withStatus.line), withStatus.line);
}

/* ------------------- R13-R15 compatibility + logging ------------------- */

group('R13. Task Board compatibility');
{
  const line = `- [ ] Board task <!-- mme-task: opened=${TODAY} -->`;
  let transitions = [];
  try {
    transitions = ['backlog', 'ongoing', 'todo'].map((target) => L.applyTransition(line, { target, today: TODAY }));
  } catch (error) {
    transitions = [];
  }
  check('R13a', 'status transitions accepted by the lifecycle owner', transitions.length === 3 && transitions.every((r) => r && r.ok === true), JSON.stringify(transitions.map((r) => (r ? r.line : null))));
  check('R13b', 'opened metadata survives every transition', transitions.every((r) => r && r.line && r.line.includes(`opened=${TODAY}`)), JSON.stringify(transitions.map((r) => (r ? r.line : null))));
  check('R13c', 'task-board.js has no save reconciliation or metadata writer', !/applySaveLifecycle|matchTasksForSave|buildTaskMetadataComment/.test(BOARD_SRC), 'board must not repair reconciled metadata');
  check('R13d', 'task-board.js consumes lifecycle state read-only (status transitions + openedDate)', /applyTransition/.test(BOARD_SRC) && /openedDate/.test(BOARD_SRC));
}

group('R14. TaskReview compatibility');
{
  const tagged = parseMarkdownTasks('- [ ] Review me <!-- mme-task: opened=2026-01-01 -->')[0];
  const plain = parseMarkdownTasks('- [ ] Review me')[0];
  check('R14a', 'metadata comments do not change the normalized Task text', tagged.text === plain.text && tagged.text === 'Review me', `${tagged.text} vs ${plain.text}`);
  check('R14b', 'tagged and untagged lines still pair during matching', (() => {
    const m = L.matchTasksForSave([plain], [tagged]);
    return m.pairs.length === 1 && m.newIndices.length === 0 && m.ambiguous === 0;
  })());
  check('R14c', 'task-review.js contains no opened-metadata writer', !/applySaveLifecycle|matchTasksForSave|opened=/.test(fs.readFileSync(REVIEW_PATH, 'utf8')));
}

group('R15. reconciliation logging accuracy');
{
  check('R15a', 'unresolved-ambiguity wording exists', MAIN_SRC.includes('TaskReconcile: unresolved Task candidates remain (no metadata assigned)'));
  check('R15b', '"no changes needed" only reachable after the ambiguity branch', MAIN_SRC.indexOf('TaskReconcile: no changes needed') > MAIN_SRC.indexOf('} else if (reconciled.ambiguous > 0) {'));
  check('R15c', 'changed=true result line marks unresolved candidates', /reconciled\.ambiguous > 0[\s\S]{0,40}\(unresolved Task candidates remain; no metadata assigned\)/.test(MAIN_SRC));
  check('R15d', 'baseline refresh logs unresolved ambiguity + no automatic recovery', MAIN_SRC.includes('unresolved Task candidates remain: ambiguous=${reconciled.ambiguous}; no automatic recovery)'));
}

/* ---------------- S. measured duplicate contract (PLAN scenarios) --------------- */

group('S. SAFE NEW DUPLICATES vs TRUE OVERLAP AMBIGUITY');
{
  const dup = '- [ ] S-dup';
  const s1 = L.matchTasksForSave([], parseMarkdownTasks(`${dup}\n${dup}`));
  check('S1', 'SAFE NEW DUPLICATES: baseline 0 -> 2 identical are both new, zero ambiguity', s1.newIndices.length === 2 && s1.ambiguous === 0, JSON.stringify({ new: s1.newIndices, ambiguous: s1.ambiguous }));

  const s2 = L.matchTasksForSave(parseMarkdownTasks(dup), parseMarkdownTasks(`${dup}\n${dup}`));
  check('S2', 'TRUE OVERLAP AMBIGUITY: existing occurrence pairs, extra occurrence ambiguous', s2.pairs.length === 1 && s2.newIndices.length === 0 && s2.ambiguousIndices.length === 1, JSON.stringify(s2));

  const tagged = `${dup} <!-- mme-task: opened=2026-01-01 -->`;
  const s3 = L.matchTasksForSave(parseMarkdownTasks(tagged), parseMarkdownTasks(`${tagged}\n${dup}`));
  check('S3', 'existing metadata stays on its own occurrence (pair 0<->0)', s3.pairs.length === 1 && s3.pairs[0].baseline === 0 && s3.pairs[0].current === 0 && s3.newIndices.length === 0, JSON.stringify(s3.pairs));

  const state4 = { text: `${tagged}\n${tagged}\n${dup}\n`, baseline: parseMarkdownTasks(`${tagged}\n${tagged}\n`) };
  const res4 = simulateSave(state4, TODAY);
  check('S4', 'baseline 2 tagged -> current 3: no new tagging, tagged lines preserved', res4.openedAdded === 0 && state4.text.startsWith(`${tagged}\n${tagged}\n`), state4.text);

  const s5 = L.matchTasksForSave(parseMarkdownTasks(`${dup}\n${dup}`), parseMarkdownTasks(`${dup}\n${dup}`));
  check('S5', 'baseline 2 -> current 2 is idempotent with no backfill', s5.pairs.length === 2 && s5.newIndices.length === 0 && s5.ambiguous === 0, JSON.stringify(s5));

  const s6 = L.matchTasksForSave(parseMarkdownTasks('- [ ] A\n- [ ] D\n- [ ] B'), parseMarkdownTasks('- [ ] A\n- [ ] D\n- [ ] X\n- [ ] D\n- [ ] B'));
  check('S6', 'anchors prove the middle insertion; the extra duplicate stays ambiguous', s6.newIndices.length === 1 && s6.ambiguousIndices.length === 1, JSON.stringify({ new: s6.newIndices, ambiguousIndices: s6.ambiguousIndices }));
}

/* ---------------- X. shipped source contract (no drift / no rejected design) ---------------- */

group('X. shipped source contract');
{
  const recStart = MAIN_SRC.indexOf('function reconcileTasksBeforeSave');
  const recEnd = MAIN_SRC.indexOf('\n}\n', recStart);
  const recSegment = recStart === -1 ? '' : MAIN_SRC.slice(recStart, recEnd === -1 ? MAIN_SRC.length : recEnd);
  const applyTotal = (MAIN_SRC.match(/applySaveLifecycle\(/g) || []).length;
  const applyInReconcile = (recSegment.match(/applySaveLifecycle\(/g) || []).length;

  check('X1', 'per-gap cap folding removed from the matcher', !/MAX_SAFE_NEW_PER_GAP/.test(LIFECYCLE_SRC));
  check('X2', 'global ceilings unchanged (MAX_SAFE_NEW_TOTAL=16, MAX_SAFE_INSERT_TOTAL=20)', /MAX_SAFE_NEW_TOTAL = 16;/.test(LIFECYCLE_SRC) && /MAX_SAFE_INSERT_TOTAL = 20;/.test(LIFECYCLE_SRC));
  check('X3', 'no canonical-text pending/tracking set added', !/__taskUnresolvedTexts|unresolvedTexts|trackedTexts|pendingTexts/.test(MAIN_SRC + LIFECYCLE_SRC));
  check('X4', 'lifecycle metadata writes happen only inside the save reconciliation', applyTotal > 0 && applyInReconcile === applyTotal, `total=${applyTotal} inReconcile=${applyInReconcile}`);
  check('X5', 'adapter mirrors the shipped loop (newIndices + checkbox-authoritative pairs)', /for \(const newIndex of match\.newIndices \|\| \[\]\)/.test(MAIN_SRC) && /if \(current\.done === baseline\.done\) continue;/.test(MAIN_SRC));
  check('X6', 'ambiguous indices are never written by the save loop', !/ambiguousIndices/.test(MAIN_SRC));
  check('X7', 'no stable Task ID or second Task identity model introduced', !/stableTaskId|mme-task-id/.test(MAIN_SRC + LIFECYCLE_SRC + BOARD_SRC));
  check('X8', 'canonical Task text owned by the lifecycle matcher only', /canonicalTaskText/.test(LIFECYCLE_SRC) && !/canonicalTaskText/.test(MAIN_SRC));
  check('X9', 'reconciliation loop extracted from shipped source for the adapter', recSegment.includes('applySaveLifecycle') && recSegment.includes('matchTasksForSave'));
}

/* ------------------------- Y. built-in owner validators ------------------------- */

group('Y. built-in owner validators (regression)');
{
  const lifecycleResult = globalThis.__validateTaskLifecycle();
  check('Y1', 'Task Lifecycle built-in validator all green', lifecycleResult.ok === true && lifecycleResult.failed === 0, `${lifecycleResult.passed}/${lifecycleResult.total}`);

  global.window = global.window || {};
  if (typeof global.window.addEventListener !== 'function') global.window.addEventListener = function () {};
  global.window.__mmeTaskBoardIndexReadyBound = true;
  global.document = global.document || {
    readyState: 'complete',
    addEventListener() {},
    getElementById() {
      return null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    body: { classList: { contains() { return false; }, add() {}, remove() {} } },
    documentElement: { classList: { contains() { return false; }, add() {}, remove() {} } },
  };

  let boardResult = null;
  try {
    require(BOARD_PATH);
    boardResult = globalThis.__validateTaskBoard();
  } catch (error) {
    boardResult = null;
  }

  check('Y2', 'Task Board built-in validator all green', Boolean(boardResult) && boardResult.failed === 0, boardResult ? `${boardResult.passed}/${boardResult.total}` : 'unavailable');
  check('Y3', 'both owner validators reported totals', Boolean(lifecycleResult.total) && Boolean(boardResult && boardResult.total), `lifecycle=${lifecycleResult.passed} board=${boardResult ? boardResult.passed : 0}`);
}

let passed = 0;
let failed = 0;
for (const entry of results) {
  if (entry.group) {
    console.log(`\n--- ${entry.group} ---`);
    continue;
  }
  if (entry.ok) {
    passed += 1;
    console.log(`PASS ${entry.id} ${entry.name}`);
  } else {
    failed += 1;
    console.log(`FAIL ${entry.id} ${entry.name}${entry.detail ? ` :: ${entry.detail}` : ''}`);
  }
}

console.log('\n========================================');
console.log('BULK TASK RECONCILIATION VALIDATORS');
console.log(`${passed} passed, ${failed} failed`);
console.log('========================================');

process.exit(failed ? 1 : 0);
