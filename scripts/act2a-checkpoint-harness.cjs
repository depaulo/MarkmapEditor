#!/usr/bin/env node
'use strict';

/**
 * ACT 2A — mobile-checkpoint harness (scenarios A-I).
 *
 * WHAT THIS IS: a deterministic replay of the exact S22/DeX checkpoint script in
 * the ACT 2A brief, executed against the REAL shipped owners. It prints the
 * exact physical Markdown before and after every step, so the device run becomes
 * a confirmation rather than a discovery.
 *
 * WHAT THIS IS NOT: it is NOT a substitute for the physical checkpoint. It never
 * touches a browser, the File System Access API, a real Save or a real Index
 * rebuild. Those remain the human S22/DeX step.
 *
 * Real owners used, extracted verbatim:
 *   - js/tasks/task-lifecycle.js  -> applyPriority, applySaveLifecycle,
 *                                     applyTransition, toNormalizedTask
 *   - js/workspace/task-review.js -> findActualTaskLine,
 *                                     normalizeTaskTextForComparison
 *   - js/main.js                  -> parseMarkdownTasks (the Index read model)
 *
 * The editor bridge, the Save call and the Index rebuild replay the same
 * sequence the shipped owners use; they are stubbed so the harness is
 * deterministic and clock-free.
 *
 * Usage: node scripts/act2a-checkpoint-harness.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

const LIFECYCLE_SOURCE = read('js', 'tasks', 'task-lifecycle.js');
const REVIEW_SOURCE = read('js', 'workspace', 'task-review.js');
const MAIN_SOURCE = read('js', 'main.js');

const results = [];
function step(id, name, ok, detail) {
  results.push({ id, name, ok: Boolean(ok), detail: ok || detail == null ? '' : String(detail) });
  console.log((ok ? 'PASS ' : 'FAIL ') + '[' + id + '] ' + name + (ok || detail == null ? '' : '  -> ' + detail));
}
function show(label, value) {
  console.log('       ' + label.padEnd(24) + value);
}

function extractBlockFrom(src, startMarker, endLine = '}') {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error('verbatim extraction failed: ' + startMarker);
  let lineStart = src.indexOf('\n', start) + 1;
  while (lineStart <= src.length) {
    const nl = src.indexOf('\n', lineStart);
    const lineEnd = nl === -1 ? src.length : nl;
    if (src.slice(lineStart, lineEnd) === endLine) return src.slice(start, lineEnd);
    if (nl === -1) break;
    lineStart = nl + 1;
  }
  throw new Error('verbatim extraction never closed: ' + startMarker);
}
function extractIndentedFunction(src, startMarker) {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error('verbatim extraction failed: ' + startMarker);
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced body for: ' + startMarker);
}

globalThis.window = globalThis;
globalThis.document = { getElementById: () => null };
(0, eval)(LIFECYCLE_SOURCE);
const L = globalThis.MME_TASK_LIFECYCLE;
if (!L) throw new Error('MME_TASK_LIFECYCLE missing');

const parseMarkdownTasks = new Function([
  extractBlockFrom(MAIN_SOURCE, 'function normalizeParserText(value) {'),
  extractBlockFrom(MAIN_SOURCE, 'function stripMarkdownHeadingPrefix(line) {'),
  extractBlockFrom(MAIN_SOURCE, 'function normalizeMetadataKey(key) {'),
  extractBlockFrom(MAIN_SOURCE, 'function parseMmeTaskMetadata(rawLine) {'),
  extractBlockFrom(MAIN_SOURCE, 'function cleanTaskText(rawMatch3) {'),
  extractBlockFrom(MAIN_SOURCE, 'function parseMarkdownTasks(text) {'),
  'return { parseMarkdownTasks };',
].join('\n\n'))().parseMarkdownTasks;

// The REAL occurrence resolver used by the shipped priority path.
const findActualTaskLine = new Function([
  'const safeLog = () => {};',
  'const stripPriorityTokens = (t) => globalThis.MME_TASK_LIFECYCLE.removePriorityTokens(t);',
  extractIndentedFunction(REVIEW_SOURCE, 'function normalizeTaskTextForComparison(text) {'),
  extractIndentedFunction(REVIEW_SOURCE, 'function findActualTaskLine(getLineText, indexedLine, expectedText) {'),
  'return findActualTaskLine;',
].join('\n\n'))();

const TODAY = '2026-03-10';

const INITIAL = [
  '# ACT 2A checkpoint',
  '',
  '- [ ] Standard priority task #p2',
  '- [ ] Legacy priority task <!-- mme-task: priority=p2 -->',
  '- [ ] Tagged task #customer',
  '- [ ] Review <b>客户</b> & proposal',
  '- [ ] Duplicate task',
  '- [ ] Duplicate task',
  '',
].join('\n');

// A simulated editor: 1-based lines, the same shape the CodeMirror bridge
// exposes to the shipped owners.
function makeEditor(text) {
  const lines = text.split('\n');
  return {
    lines,
    getLineText: (n) => (n >= 1 && n <= lines.length ? lines[n - 1] : null),
    replaceLine: (n, newText) => {
      if (n < 1 || n > lines.length) return false;
      lines[n - 1] = newText;
      return true;
    },
  };
}

// Rebuild the saved Index from the document, exactly like Save -> rebuild does.
function rebuildIndex(editor, sourcePath) {
  const records = parseMarkdownTasks(editor.lines.join('\n'));
  for (const r of records) {
    r.filePath = sourcePath;
    r.fileKind = 'notes';
    r.fileName = sourcePath.split('/').pop();
  }
  return { tasks: records };
}

const readPriority = (r) => L.toNormalizedTask(r).priority;
const readDisplay = (r) => L.toNormalizedTask(r).displayText;
const readStatus = (r) => L.toNormalizedTask(r).effectiveStatus;

// The FULL shipped priority path replayed: resolve the exact occurrence with the
// real ambiguity guard, patch with the real owner, Save, rebuild the Index.
function priorityEdit(editor, index, sourcePath, targetLine, newPriority) {
  const t = { refused: null, saved: false, indexRebuilt: false, noop: false };
  const indexedTask = index.tasks.find((x) => x.filePath === sourcePath && x.line === targetLine);
  if (!indexedTask) { t.refused = 'task not in index'; return t; }

  const actual = findActualTaskLine(editor.getLineText, targetLine, indexedTask.text);
  if (actual === null) { t.refused = 'task not found near indexed line'; return t; }
  if (actual && actual.ambiguous) { t.refused = 'multiple matching tasks; refusing'; return t; }

  const lineText = editor.getLineText(actual);
  if (lineText === null) { t.refused = 'line not found'; return t; }

  const patch = L.applyPriority(lineText, { value: newPriority });
  if (!patch.ok) { t.refused = patch.reason; return t; }
  if (!patch.changed) { t.noop = true; t.line = actual; t.after = lineText; return t; }

  editor.replaceLine(actual, patch.line);
  t.saved = true;
  t.indexRebuilt = true;
  t.line = actual;
  t.after = patch.line;
  return t;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
const findLine = (index, frag) => {
  const r = index.tasks.find((x) => String(x.text).includes(frag));
  return r ? r.line : -1;
};

const PATH = 'notes/act2a-checkpoint.md';
let editor = makeEditor(INITIAL);
let index = rebuildIndex(editor, PATH);

console.log('\n=== A. BASELINE ===');
show('physical line 3', editor.getLineText(3));
show('physical line 4', editor.getLineText(4));
step('A1', 'Task Review count matches the Index', index.tasks.length === 6,
  'index tasks=' + index.tasks.length);
step('A2', 'Open and Done counts are unchanged', (() => {
  const open = index.tasks.filter((t) => readStatus(t) !== 'done').length;
  const done = index.tasks.filter((t) => readStatus(t) === 'done').length;
  show('open/done', open + '/' + done);
  return open === 6 && done === 0;
})());
step('A3', 'no Task is duplicated by Note classification',
  new Set(index.tasks.map((t) => t.line)).size === index.tasks.length);
step('A4', 'every Task is Todo (four Board columns intact)',
  index.tasks.every((t) => readStatus(t) === 'todo'));
step('A5', 'both priority read forms resolve; the rest have none', (() => {
  const p2 = index.tasks.filter((t) => readPriority(t) === 'p2').map((t) => t.line);
  const none = index.tasks.filter((t) => readPriority(t) === null).map((t) => t.line);
  show('p2 lines', JSON.stringify(p2));
  show('no-priority lines', JSON.stringify(none));
  return p2.join(',') === '3,4' && none.length === 4;
})());

console.log('\n=== B. EXISTING CANONICAL PRIORITY (#p2 token) ===');
{
  const rec = index.tasks.find((t) => t.line === 3);
  show('Review reads', readPriority(rec));
  show('display text', '"' + readDisplay(rec) + '"');
  show('physical line', '"' + editor.getLineText(3) + '"');
  step('B1', 'Task Review shows P2', readPriority(rec) === 'p2');
  step('B2', 'visible display does NOT show #p2', readDisplay(rec).indexOf('#p2') === -1);
  step('B3', 'physical Markdown still contains #p2', editor.getLineText(3).indexOf('#p2') !== -1);
  step('B4', 'display text is the clean visible text', readDisplay(rec) === 'Standard priority task');
  step('B5', 'exact source identity is addressable', rec.filePath === PATH && rec.line === 3);
}

console.log('\n=== C. CLEAR CANONICAL PRIORITY ===');
{
  show('BEFORE', '"' + editor.getLineText(3) + '"');
  const t = priorityEdit(editor, index, PATH, 3, '');
  show('AFTER ', '"' + editor.getLineText(3) + '"');
  step('C1', 'Clear was not refused', t.refused === null);
  step('C2', '#p2 removed', editor.getLineText(3).indexOf('#p2') === -1);
  step('C3', 'no priority metadata remains', editor.getLineText(3).indexOf('priority=') === -1);
  step('C4', 'checkbox unchanged', editor.getLineText(3).indexOf('- [ ]') === 0);
  step('C5', 'visible Task text unchanged', editor.getLineText(3) === '- [ ] Standard priority task');
  step('C6', 'Save and Index rebuild completed', t.saved === true && t.indexRebuilt === true);
  index = rebuildIndex(editor, PATH);
  const rec = index.tasks.find((x) => x.line === 3);
  step('C7', 'Task now reads as No priority', readPriority(rec) === null);
  step('C8', 'Review, Board and filter agree',
    readPriority(rec) === null &&
    index.tasks.filter((x) => readPriority(x) === 'p2').length === 1);
}

console.log('\n=== D. LEGACY PRIORITY CONVERSION (mme-task priority=p2) ===');
{
  const rec = index.tasks.find((t) => t.line === 4);
  show('BEFORE', '"' + editor.getLineText(4) + '"');
  step('D1', 'before mutation the Task reads as P2', readPriority(rec) === 'p2');
  step('D2', 'metadata is hidden from display text', readDisplay(rec) === 'Legacy priority task');

  const t = priorityEdit(editor, index, PATH, 4, 'p1');
  show('AFTER ', '"' + editor.getLineText(4) + '"');
  const after = editor.getLineText(4);
  step('D3', 'write was not refused', t.refused === null);
  step('D4', 'visible #p1 exists exactly once', (after.match(/#p1/g) || []).length === 1);
  step('D5', 'legacy priority=p2 is ABSENT', after.indexOf('priority=p2') === -1);
  step('D6', 'no second priority representation exists', after.indexOf('priority=') === -1);
  step('D7', 'Save and rebuild completed', t.saved === true && t.indexRebuilt === true);
  index = rebuildIndex(editor, PATH);
  const rec2 = index.tasks.find((x) => x.line === 4);
  step('D8', 'Review shows P1', readPriority(rec2) === 'p1');
  step('D9', 'P1 filter includes the Task',
    index.tasks.filter((x) => readPriority(x) === 'p1').length === 1);
  step('D10', 'display text is unchanged by conversion', readDisplay(rec2) === 'Legacy priority task');
}

console.log('\n=== E. CLEAR CONVERTED LEGACY PRIORITY ===');
{
  priorityEdit(editor, index, PATH, 4, '');
  show('AFTER clear', '"' + editor.getLineText(4) + '"');
  step('E1', '#p1 absent', editor.getLineText(4).indexOf('#p1') === -1);
  step('E2', 'legacy priority key absent', editor.getLineText(4).indexOf('priority=') === -1);
  index = rebuildIndex(editor, PATH);
  const rec = index.tasks.find((x) => x.line === 4);
  step('E3', 'Task reads as No priority', readPriority(rec) === null);
  const t2 = priorityEdit(editor, index, PATH, 4, '');
  step('E4', 'repeated Clear is a no-op', t2.noop === true && t2.saved === false);
  step('E5', 'Review, Board and filter agree',
    index.tasks.filter((x) => readPriority(x) !== null).length === 0);
}

console.log('\n=== F. ORDINARY HASHTAG PRESERVATION (#customer) ===');
{
  show('BEFORE', '"' + editor.getLineText(5) + '"');
  const t = priorityEdit(editor, index, PATH, 5, 'p3');
  const after = editor.getLineText(5);
  show('AFTER ', '"' + after + '"');
  step('F1', 'physical line contains BOTH #customer and #p3',
    after.indexOf('#customer') !== -1 && after.indexOf('#p3') !== -1);
  step('F2', 'not refused', t.refused === null);
  index = rebuildIndex(editor, PATH);
  const rec2 = index.tasks.find((x) => x.line === 5);
  step('F3', 'display text RETAINS #customer', readDisplay(rec2).indexOf('#customer') !== -1);
  step('F4', 'display text HIDES #p3', readDisplay(rec2).indexOf('#p3') === -1);
  priorityEdit(editor, index, PATH, 5, '');
  show('AFTER clear', '"' + editor.getLineText(5) + '"');
  step('F5', 'clearing removes ONLY #p3',
    editor.getLineText(5).indexOf('#p3') === -1 &&
    editor.getLineText(5).indexOf('#customer') !== -1);
  index = rebuildIndex(editor, PATH);
}

console.log('\n=== G. DISPLAY SAFETY (HTML + Unicode) ===');
{
  const rec = index.tasks.find((t) => t.line === 6);
  const raw = readDisplay(rec);
  const once = esc(raw);
  show('raw display', '"' + raw + '"');
  show('escaped once', '"' + once + '"');
  step('G1', 'Unicode is preserved', raw.indexOf('客户') !== -1);
  step('G2', 'owner output is raw (escaping is a consumer concern)',
    raw.indexOf('<b>') !== -1 && raw.indexOf('&lt;') === -1);
  step('G3', 'escaped once at the HTML boundary',
    once.indexOf('&lt;b&gt;') !== -1 && once.indexOf('&amp;') !== -1);
  step('G4', 'no double-escaping artifact',
    once.indexOf('&amp;lt;') === -1 && once.indexOf('&amp;amp;') === -1);
  step('G5', 'source navigation remains exact', rec.filePath === PATH && rec.line === 6);
}

console.log('\n=== H. DUPLICATE OCCURRENCE SAFETY ===');
{
  const dupLines = index.tasks.filter((t) => String(t.text) === 'Duplicate task').map((t) => t.line);
  const untouchedLine = dupLines[0];
  const targetLine = dupLines[1];
  show('duplicate lines', JSON.stringify(dupLines));
  const beforeUntouched = editor.getLineText(untouchedLine);
  const beforeTarget = editor.getLineText(targetLine);
  const t = priorityEdit(editor, index, PATH, targetLine, 'p1');
  show('line ' + untouchedLine + ' BEFORE', '"' + beforeUntouched + '"');
  show('line ' + untouchedLine + ' AFTER ', '"' + editor.getLineText(untouchedLine) + '"');
  show('line ' + targetLine + ' BEFORE', '"' + beforeTarget + '"');
  show('line ' + targetLine + ' AFTER ', '"' + editor.getLineText(targetLine) + '"');
  step('H1', 'the INTENDED occurrence changed',
    editor.getLineText(targetLine).indexOf('#p1') !== -1);
  step('H2', 'the other occurrence is UNCHANGED',
    editor.getLineText(untouchedLine) === beforeUntouched);
  step('H3', 'neither was corrupted and the write was not refused', t.refused === null);
  index = rebuildIndex(editor, PATH);
  step('H4', 'Index reflects exactly one prioritized duplicate',
    index.tasks.filter((x) => readDisplay(x) === 'Duplicate task' && readPriority(x) === 'p1').length === 1 &&
    index.tasks.filter((x) => readDisplay(x) === 'Duplicate task' && readPriority(x) === null).length === 1);
}

console.log('\n=== I. LIFECYCLE REGRESSION (disposable Task) ===');
{
  const line = 7;
  // The real checkbox flip lives in the CONSUMER (Task Review toggle), not in
  // the lifecycle owner: applySaveLifecycle manages metadata for a checkbox
  // state the caller has already observed. The harness therefore flips the
  // marker exactly as that shipped consumer does, then calls the owner.
  const flip = (src, done) => src.replace(/^(\s*[-*+]\s+\[)[ xX](\])/, done ? '$1X$2' : '$1 $2');

  show('START', '"' + editor.getLineText(line) + '"');
  const t1 = L.applyTransition(editor.getLineText(line), { target: 'ongoing', today: TODAY });
  editor.replaceLine(line, t1.line);
  show('ONGOING', '"' + editor.getLineText(line) + '"');
  step('I1', 'Todo -> Ongoing writes started', t1.ok && /started=2026-03-10/.test(t1.line));
  index = rebuildIndex(editor, PATH);
  step('I2', 'Review and Board agree: ongoing',
    readStatus(index.tasks.find((x) => x.line === line)) === 'ongoing');

  const t2 = L.applySaveLifecycle(flip(editor.getLineText(line), true), {
    today: TODAY, isNew: false, checked: true, explicitStatus: 'ongoing',
  });
  editor.replaceLine(line, t2.line);
  show('DONE', '"' + editor.getLineText(line) + '"');
  step('I3', 'completion writes completed and drops the open status',
    t2.added.completed === true && /completed=2026-03-10/.test(t2.line) && !/status=ongoing/.test(t2.line));
  index = rebuildIndex(editor, PATH);
  step('I4', 'Review and Board agree: done',
    readStatus(index.tasks.find((x) => x.line === line)) === 'done');

  // Reopen: the line no longer carries an open status, so the caller passes none.
  const t3 = L.applySaveLifecycle(flip(editor.getLineText(line), false), {
    today: TODAY, isNew: false, checked: false, explicitStatus: '',
  });
  editor.replaceLine(line, t3.line);
  show('REOPENED', '"' + editor.getLineText(line) + '"');
  step('I5', 'reopen removes completed', t3.removed.completed === true && !/completed=/.test(t3.line));
  step('I6', 'reopen preserves started', /started=2026-03-10/.test(t3.line));
  step('I7', 'reopen leaves no stale open status', !/status=ongoing/.test(t3.line));
  index = rebuildIndex(editor, PATH);
  const rec = index.tasks.find((x) => x.line === line);
  step('I8', 'normalized record: not done, completedDate null',
    rec.effectiveStatus !== 'done' && L.toNormalizedTask(rec).completedDate === null);
  step('I9', 'normalized record: startedDate preserved', L.toNormalizedTask(rec).startedDate === '2026-03-10');
}

console.log('\n=== FINAL DOCUMENT ===');
editor.lines.forEach((l, i) => {
  if (l.trim()) console.log(String(i + 1).padStart(3) + ' | ' + l);
});

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);
console.log('\nACT 2A CHECKPOINT HARNESS: ' + passed + ' passed, ' + failed.length + ' failed');
process.exitCode = failed.length ? 1 : 0;
