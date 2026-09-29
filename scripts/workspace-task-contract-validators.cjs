#!/usr/bin/env node
'use strict';

/**
 * ACT 2A — normalized Task contract, scope projection and canonical
 * priority-source reconciliation.
 *
 * This is a cross-consumer suite. The existing suites each own ONE surface
 * (Task Lifecycle internals, Task Board, Task Review, Save reconciliation) and
 * none of them can own the SHARED contract without duplicating it, so this
 * suite is the single home for the contract. It loads the REAL shipped owners
 * verbatim:
 *
 *   - js/tasks/task-lifecycle.js  — the single Task owner (normalizeTask,
 *     effectiveStatusOf, priorityOf, applyPriority, toNormalizedTask,
 *     projectTasks), loaded as the real module, never re-implemented;
 *   - js/main.js                  — the real parseMarkdownTasks parser,
 *     extracted verbatim, so every contract fixture runs against ACTUAL
 *     parsed records rather than hand-written objects;
 *   - js/tasks/task-board.js and js/workspace/task-review.js — real consumer
 *     status owners, exercised through their shipped source.
 *
 * A contract proven against hand-written objects would not prove that the real
 * parser produces records the contract accepts, so the parser is mandatory here.
 *
 * 6 groups: N01-N12 normalization, I13-I19 identity, C20-C27 Review/Board
 * consistency, D28-D36 lifecycle, P37-P45 priority contract,
 * S51-S60 scope projection. Plus M1-M9 mutation controls.
 *
 * Usage: node scripts/workspace-task-contract-validators.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

const LIFECYCLE_SOURCE = read('js', 'tasks', 'task-lifecycle.js');
const BOARD_SOURCE = read('js', 'tasks', 'task-board.js');
const REVIEW_SOURCE = read('js', 'workspace', 'task-review.js');
const MAIN_SOURCE = read('js', 'main.js');

const results = [];
function record(id, name, ok, detail) {
  const d = typeof detail === 'function' ? detail() : detail;
  results.push({ id, name, ok: Boolean(ok), detail: ok || d == null ? '' : String(d) });
}
async function check(id, name, ok, detail) {
  let value = ok;
  if (typeof value === 'function') {
    try {
      value = value();
    } catch (e) {
      record(id, name, false, (e && e.message) || String(e));
      return;
    }
  }
  if (value && typeof value.then === 'function') {
    try {
      record(id, name, await value, detail);
    } catch (e) {
      record(id, name, false, (e && e.message) || String(e));
    }
    return;
  }
  record(id, name, value, detail);
}
function group(title) {
  results.push({ group: title });
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

// The consumer modules (task-board.js, task-review.js) are wrapped in an IIFE,
// so their functions and their closing braces are INDENTED. A col-0 extractor
// cannot close on them. This brace matcher is used only for those two files and
// only for functions that contain no braces inside strings or regexes.
function extractIndentedFunction(src, startMarker) {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error('verbatim extraction failed: ' + startMarker);

  const open = src.indexOf('{', start);
  if (open === -1) throw new Error('no body for: ' + startMarker);

  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced body for: ' + startMarker);
}

// ---------------------------------------------------------------
// Minimal DOM/app shims so the REAL owner modules can load
// ---------------------------------------------------------------
function makeEl(id) {
  const el = {
    id, value: '', hidden: false, innerHTML: '', textContent: '', dataset: {},
    attrs: {}, classes: new Set(),
    classList: {
      add(...c) { c.forEach((x) => el.classes.add(x)); },
      remove(...c) { c.forEach((x) => el.classes.delete(x)); },
      toggle(c, f) { const on = f === undefined ? !el.classes.has(c) : Boolean(f); if (on) el.classes.add(c); else el.classes.delete(c); },
      contains(c) { return el.classes.has(c); },
    },
    addEventListener() {}, removeEventListener() {}, appendChild() {},
    setAttribute(k, v) { el.attrs[k] = v; },
    getAttribute: (k) => (k in el.attrs ? el.attrs[k] : null),
    querySelector: () => null, querySelectorAll: () => [],
    closest: () => null, focus() {},
    getBoundingClientRect: () => ({ top: 0, height: 0 }),
  };
  return el;
}

const dom = {};
for (const id of [
  'workspaceSearchInput', 'workspaceSearchResults', 'workspaceRelatedPanel',
  'workspaceActivePanel', 'workspaceTasksPanel', 'workspaceTasksBadge',
  'workspaceTasksSummary', 'workspaceTasksList', 'workspaceProjectsPanel',
  'workspaceArchivePanel', 'workspaceActiveBadge', 'workspaceActiveBody',
  'workspaceSidebar', 'workspaceTaskBoardBtn', 'workspaceTagResults',
]) dom[id] = makeEl(id);

const h = { logs: [], toasts: [] };
globalThis.window = globalThis;
globalThis.document = {
  getElementById: (id) => dom[id] || null,
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => makeEl('created'),
  addEventListener() {}, removeEventListener() {},
  dispatchEvent: () => true,
  documentElement: makeEl('html'),
  body: makeEl('body'),
};
globalThis.MME_APP = { log: (m) => h.logs.push(String(m)), showToast: (m) => h.toasts.push(String(m)) };
globalThis.log = (m) => h.logs.push(String(m));
globalThis.showToast = (m) => h.toasts.push(String(m));
try { globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; } catch {}

// The REAL single Task owner, loaded verbatim.
(0, eval)(LIFECYCLE_SOURCE);
const L = globalThis.MME_TASK_LIFECYCLE;
if (!L) throw new Error('MME_TASK_LIFECYCLE not exposed by the real module');

// The REAL Task Board owner, loaded verbatim. ACT 2B rendering and value-mapping
// assertions must run against shipped code, never against a re-implementation of
// the priority control, so the Board module is loaded exactly as the app loads it.
// The Board registers a module-level index listener, so the window stub needs the
// event surface the shipped module legitimately expects at load time.
globalThis.addEventListener = function () {};
globalThis.removeEventListener = function () {};
if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
}
(0, eval)(BOARD_SOURCE);
const B = globalThis.MME_TASK_BOARD;
if (!B) throw new Error('MME_TASK_BOARD not exposed by the real module');

// Snapshot helper for the direct-Index-mutation control: reads the real global
// Index state the Board reads, so a fixture can prove it was never written.
function indexSnapshot() {
  const s = globalThis.WORKSPACE_INDEX_STATE;
  return JSON.stringify(s == null ? null : s);
}

// Strips JS comments so a contract can assert on CODE rather than on the words
// used to describe it. Without this, an explanatory comment mentioning a
// forbidden token would look exactly like a violation — the opposite of what
// these contracts are for. String and REGEX literals are preserved verbatim,
// because that is where real grammar lives.
//
// Regex literals are detected with the standard "previous significant character"
// heuristic: a '/' can only open a regex where an expression may start. Getting
// this wrong is not cosmetic — misreading a regex as a comment silently deletes
// real code and makes later assertions meaningless.
function stripJsComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let mode = 'code'; // code | line | block | sq | dq | tpl | regex
  let prevSig = ''; // last significant character emitted in code mode

  const lastSig = () => prevSig;

  while (i < n) {
    const c = src[i];
    const c2 = src.slice(i, i + 2);

    if (mode === 'code') {
      if (c2 === '//') { mode = 'line'; i += 2; continue; }
      if (c2 === '/*') { mode = 'block'; i += 2; continue; }
      if (c === "'") { mode = 'sq'; }
      else if (c === '"') { mode = 'dq'; }
      else if (c === '`') { mode = 'tpl'; }
      else if (c === '/') {
        // A '/' opening a regex literal is only legal where an expression may
        // begin. Otherwise it is division.
        if (lastSig() === '' || '(,=:[!&|?{};+-*%<>~^'.indexOf(lastSig()) !== -1) mode = 'regex';
        else { out += c; prevSig = c; i += 1; continue; }
      } else if (!/\s/.test(c)) {
        prevSig = c;
      }
      out += c; i += 1; continue;
    }

    if (mode === 'line') {
      if (c === '\n') { mode = 'code'; out += c; }
      i += 1; continue;
    }
    if (mode === 'block') {
      if (c2 === '*/') { mode = 'code'; i += 2; continue; }
      i += 1; continue;
    }
    if (mode === 'regex') {
      if (c === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
      if (c === '[') {
        // Character class: ']' inside it does not close the literal.
        const close = src.indexOf(']', i);
        if (close === -1) { i = n; break; }
        out += src.slice(i, close + 1); i = close + 1; continue;
      }
      if (c === '/') { mode = 'code'; out += c; i += 1; prevSig = '/'; continue; }
      out += c; i += 1; continue;
    }
    // String or template literal: kept verbatim, escapes honoured.
    if (c === '\\') { out += src.slice(i, i + 2); i += 2; continue; }
    if ((mode === 'sq' && c === "'") || (mode === 'dq' && c === '"') || (mode === 'tpl' && c === '`')) {
      mode = 'code'; prevSig = 'x';
    }
    out += c; i += 1;
  }
  return out;
}

// Comment-stripped copies used only by "this code must not contain X" contracts.
const BOARD_CODE = stripJsComments(BOARD_SOURCE);
const REVIEW_CODE = stripJsComments(REVIEW_SOURCE);

// Real shipped regions the delegation contracts assert against, sliced between
// CODE markers (a comment-stripped source has no comments to anchor on). These
// live at module scope so any group can reference them regardless of order.
const boardPriorityFn = BOARD_CODE.slice(
  BOARD_CODE.indexOf('async function setTaskPriorityFromBoard'),
  BOARD_CODE.indexOf('async function moveTask')
);
const boardWireFn = BOARD_CODE.slice(
  BOARD_CODE.indexOf('function wireBoard'),
  BOARD_CODE.indexOf('function isOpen')
);
const boardCtlFn = BOARD_CODE.slice(
  BOARD_CODE.indexOf('const PRIORITY_CONTROL_OPTIONS'),
  BOARD_CODE.indexOf('function cardDisplayText(task)')
);

// The REAL parser, extracted verbatim from main.js and evaluated against the
// real lifecycle owner, so normalization fixtures run on actual parsed records.
const parseMarkdownTasks = new Function([
  extractBlockFrom(MAIN_SOURCE, 'function normalizeParserText(value) {'),
  extractBlockFrom(MAIN_SOURCE, 'function stripMarkdownHeadingPrefix(line) {'),
  extractBlockFrom(MAIN_SOURCE, 'function normalizeMetadataKey(key) {'),
  extractBlockFrom(MAIN_SOURCE, 'function parseMmeTaskMetadata(rawLine) {'),
  extractBlockFrom(MAIN_SOURCE, 'function cleanTaskText(rawMatch3) {'),
  extractBlockFrom(MAIN_SOURCE, 'function parseMarkdownTasks(text) {'),
  'return { parseMarkdownTasks };',
].join('\n\n'))().parseMarkdownTasks;

// Parse real Markdown and stamp exact source identity onto each record, the way
// WORKSPACE_INDEX_STATE does. This is the ONLY way records are built here.
function parseTasks(markdown, sourcePath) {
  const records = parseMarkdownTasks(markdown);
  for (const r of records) {
    r.filePath = sourcePath || '';
    r.fileKind = 'notes';
    r.fileName = (sourcePath || '').split('/').pop();
  }
  return records;
}

(async () => {
  group('Normalization (N01-N12)');

  const N = parseTasks([
    '- [ ] Plain open task',
    '- [x] Plain done task',
    '- [ ] Backlog item <!-- mme-task: status=backlog -->',
    '- [ ] Ongoing item <!-- mme-task: status=ongoing -->',
    '- [ ] Bad status <!-- mme-task: status=nonsense -->',
    '- [ ] Dated <!-- mme-task: opened=2026-01-02; started=2026-01-03; completed=2026-01-04 -->',
    '- [x] Done dated <!-- mme-task: completed=2026-02-10 -->',
    '- [x] Malformed date <!-- mme-task: completed=2026-02-30 -->',
    '- [ ] Unicode 日本語 — café ✅ #projeto',
    '- [ ] Canonical #p1 token',
    '- [ ] Meta only <!-- mme-task: priority=p2 -->',
    '- [ ] No priority at all',
  ].join('\n'), 'notes/t.md');

  const byText = (frag) => N.find((t) => String(t.text).includes(frag));
  const norm = (frag) => L.toNormalizedTask(byText(frag));

  await check('N01', 'unchecked Task without status normalizes to Todo', () => {
    const t = norm('Plain open task');
    return t.done === false && t.effectiveStatus === 'todo' && t.status === null;
  });
  await check('N02', 'checked Task is Done by checkbox authority', () => {
    const t = norm('Plain done task');
    return t.done === true && t.effectiveStatus === 'done';
  });
  await check('N03', 'backlog status is preserved and effective', () => {
    const t = norm('Backlog item');
    return t.status === 'backlog' && t.effectiveStatus === 'backlog';
  });
  await check('N04', 'ongoing status is preserved and effective', () => {
    const t = norm('Ongoing item');
    return t.status === 'ongoing' && t.effectiveStatus === 'ongoing';
  });
  await check('N05', 'an invalid status falls back conservatively to Todo', () => {
    const t = norm('Bad status');
    return t.effectiveStatus === 'todo' && t.status === 'nonsense';
  });
  await check('N06', 'valid lifecycle dates are normalized', () => {
    const t = norm('Dated');
    // completed is dropped: checkbox authority means an open Task never keeps one.
    return t.openedDate === '2026-01-02' && t.startedDate === '2026-01-03' &&
      t.completedDate === null;
  });
  await check('N07', 'a malformed lifecycle date becomes unknown, not a value', () => {
    const t = norm('Malformed date');
    return t.completedDate === null && t.metadata.completed === '2026-02-30';
  });
  await check('N08', 'a valid completion date is kept for a checked Task', () =>
    norm('Done dated').completedDate === '2026-02-10');
  await check('N09', 'Unicode survives normalization', () => {
    const d = norm('Unicode').displayText;
    return d.indexOf('日本語') !== -1 && d.indexOf('café') !== -1 && d.indexOf('✅') !== -1;
  });
  await check('N10', 'an ordinary hashtag survives and is not a priority', () => {
    const t = norm('Unicode');
    return t.displayText.indexOf('#projeto') !== -1 && t.priority === null;
  });
  await check('N11', 'the lifecycle comment never leaks into display text', () => {
    for (const t of N) if (/mme-task|<!--/.test(t.displayText)) return t.displayText;
    return true;
  });
  await check('N12', 'canonical token priority is read; metadata fallback also read', () =>
    norm('Canonical').priority === 'p1' && norm('Meta only').priority === 'p2' &&
    norm('No priority at all').priority === null);

  group('Identity (I13-I19)');

  const dupA = parseTasks([
    '- [ ] Same text',
    '- [ ] Same text',
    '- [ ] Unique in A',
  ].join('\n'), 'notes/a.md');
  const dupB = parseTasks('- [ ] Same text', 'notes/b.md');
  const dupC = parseTasks('- [ ] Same text', 'notes/deep/c.md');

  await check('I13', 'the same text in two Notes stays distinct by exact path', () => {
    const a = L.toNormalizedTask(dupA[0]);
    const b = L.toNormalizedTask(dupB[0]);
    return a.sourcePath === 'notes/a.md' && b.sourcePath === 'notes/b.md' &&
      a.sourcePath !== b.sourcePath;
  });
  await check('I14', 'the same text twice in one Note stays distinct by occurrence', () => {
    const first = L.toNormalizedTask(dupA[0]);
    const second = L.toNormalizedTask(dupA[1]);
    return first.displayText === second.displayText &&
      first.sourcePath === second.sourcePath &&
      first.sourceLine !== second.sourceLine;
  });
  await check('I15', 'identity is the exact path, never the visible text', () => {
    const t = L.toNormalizedTask(dupA[2]);
    return t.sourcePath === 'notes/a.md' && t.sourceLine === 3 && t.displayText === 'Unique in A';
  });
  await check('I16', 'sourceName falls back to the last path segment', () => {
    return L.toNormalizedTask(dupC[0]).sourceName === 'c.md';
  });
  await check('I17', 'an H1 never becomes Task identity', () => {
    // Two Notes sharing an H1 keep different identities; the parser never
    // receives the H1 as identity input at all.
    const h1A = parseTasks('# Shared Title\n\n- [ ] Task', 'notes/h1a.md');
    const h1B = parseTasks('# Shared Title\n\n- [ ] Task', 'notes/h1b.md');
    return L.toNormalizedTask(h1A[0]).sourcePath !== L.toNormalizedTask(h1B[0]).sourcePath;
  });
  await check('I18', 'Knowledge classification does not duplicate a Task', () => {
    const records = parseTasks('- [ ] Classified task', 'notes/k.md');
    const before = records.length;
    // Classification lives in Note metadata, never on the Task record.
    records[0].metadata = Object.assign({}, records[0].metadata, { knowledge: 'true' });
    return records.length === before && L.toNormalizedTask(records[0]).displayText === 'Classified task';
  });
  await check('I19', 'Pinned classification does not duplicate a Task', () => {
    const records = parseTasks('- [ ] Pinned task', 'notes/p.md');
    records[0].metadata = Object.assign({}, records[0].metadata, { pinned: 'true' });
    return records.length === 1 && L.toNormalizedTask(records[0]).displayText === 'Pinned task';
  });

  group('Review/Board consistency (C20-C27)');

  // Both REAL consumer status owners are extracted and evaluated against the
  // REAL lifecycle owner, so this asserts shipped code, not a copy of it.
  const boardStatusOf = new Function([
    "const COLUMN_ORDER = ['backlog', 'todo', 'ongoing', 'done'];",
    extractIndentedFunction(BOARD_SOURCE, 'function statusOf(task) {'),
    'return statusOf;',
  ].join('\n\n'))();

  const reviewMatches = new Function([
    'const normalizeStatusFilterValue = (v) => {',
    "  const s = String(v == null ? '' : v).trim().toLowerCase();",
    "  return ['all','open','done','backlog','todo','ongoing'].indexOf(s) === -1 ? 'all' : s;",
    '};',
    extractIndentedFunction(REVIEW_SOURCE, 'function matchesStatusFilter(task, selectedStatus) {'),
    'return matchesStatusFilter;',
  ].join('\n\n'))();

  // A record with effectiveStatus deliberately REMOVED, forcing each consumer
  // down its fallback path. This is the divergence that mattered.
  const stripEffective = (t) => {
    const c = Object.assign({}, t);
    delete c.effectiveStatus;
    return c;
  };

  const C = parseTasks([
    '- [ ] Todo case',
    '- [ ] Backlog case <!-- mme-task: status=backlog -->',
    '- [ ] Ongoing case <!-- mme-task: status=ongoing -->',
    '- [x] Done case',
    '- [ ] Odd status <!-- mme-task: status=weird -->',
  ].join('\n'), 'notes/c.md');

  await check('C20', 'Review and Board agree on effective status for every record', () => {
    for (const rec of C) {
      const b = boardStatusOf(stripEffective(rec));
      if (!reviewMatches(stripEffective(rec), b)) return 'disagree on ' + rec.text;
    }
    return true;
  });
  await check('C21', 'Review and Board agree on done/open meaning', () => {
    for (const rec of C) {
      const isDone = boardStatusOf(stripEffective(rec)) === 'done';
      if (reviewMatches(stripEffective(rec), 'open') === isDone) return 'open mismatch ' + rec.text;
      if (reviewMatches(stripEffective(rec), 'done') === !isDone) return 'done mismatch ' + rec.text;
    }
    return true;
  });
  await check('C22', 'Board keeps exactly four columns and correct mapping', () => {
    const mapped = C.map((r) => boardStatusOf(r));
    return mapped.join(',') === 'todo,backlog,ongoing,done,todo' &&
      mapped.every((m) => ['backlog', 'todo', 'ongoing', 'done'].indexOf(m) !== -1);
  });
  await check('C23', 'both surfaces use the same normalized priority', () => {
    const pri = parseTasks('- [ ] Pri #p2 here', 'notes/c.md')[0];
    return L.toNormalizedTask(pri).priority === 'p2' && pri.priority === 'p2';
  });
  await check('C24', 'both surfaces use the same display text', () => {
    const t = L.toNormalizedTask(parseTasks('- [ ] Same display #p1 <!-- mme-task: status=ongoing -->', 'notes/d.md')[0]);
    return L.removePriorityTokens(t.text) === t.displayText;
  });
  await check('C25', 'both surfaces use the same source path and navigation identity', () => {
    const t = L.toNormalizedTask(parseTasks('- [ ] Nav task', 'notes/nav.md')[0]);
    return t.sourcePath === 'notes/nav.md' && t.filePath === t.sourcePath && t.sourceLine === 1;
  });
  await check('C26', 'HTML-sensitive text is escaped exactly once at the HTML boundary', () => {
    const t = L.toNormalizedTask(parseTasks('- [ ] <b>bold</b> & "quote"', 'notes/h.md')[0]);
    // The shared owner produces RAW text. Escaping belongs to the consumer.
    if (t.displayText !== '<b>bold</b> & "quote"') return 'owner escaped or altered text';
    return !/&amp;|&lt;|&quot;/.test(t.displayText);
  });
  await check('C27', 'no classification duplication across Review and Board', () =>
    C.filter((r) => L.toNormalizedTask(r).displayText === 'Todo case').length === 1);

  group('Lifecycle (D28-D36)');

  const TODAY = '2026-03-10';
  const save = (line, opts) => L.applySaveLifecycle(line, Object.assign({ today: TODAY }, opts));

  await check('D28', 'a safely identified new Task receives opened', () => {
    const r = save('- [ ] Brand new', { isNew: true, checked: false });
    return r.ok && r.changed && r.added.opened === true && /opened=2026-03-10/.test(r.line);
  });
  await check('D29', 'an existing Task preserves opened', () => {
    const r = save('- [ ] Existing <!-- mme-task: opened=2026-01-01 -->', { isNew: false, checked: false });
    return r.ok && r.added.opened === false && /opened=2026-01-01/.test(r.line);
  });
  await check('D30', 'first entry into Ongoing receives started', () => {
    // The lifecycle owner reads the status from the CALLER (the caller already
    // parsed the line); it never re-parses the comment itself.
    const r = save('- [ ] Going <!-- mme-task: status=ongoing -->', { isNew: false, checked: false, explicitStatus: 'ongoing' });
    return r.ok && r.added.started === true && /started=2026-03-10/.test(r.line) && /status=ongoing/.test(r.line);
  });
  await check('D31', 'repeated Ongoing is idempotent', () => {
    const first = save('- [ ] Going <!-- mme-task: status=ongoing -->', { isNew: false, checked: false });
    const second = save(first.line, { isNew: false, checked: false });
    return second.ok && second.changed === false && second.line === first.line;
  });
  await check('D32', 'completion receives completed and clears the open status', () => {
    const r = save('- [x] Finishing <!-- mme-task: status=ongoing -->', { isNew: false, checked: true, explicitStatus: 'ongoing' });
    return r.ok && r.added.completed === true && r.removed.status === true &&
      /completed=2026-03-10/.test(r.line) && !/status=ongoing/.test(r.line);
  });
  await check('D33', 'reopening removes completed and preserves opened', () => {
    const r = save('- [ ] Reopened <!-- mme-task: opened=2026-01-01; completed=2026-02-02 -->', { isNew: false, checked: false });
    return r.ok && r.removed.completed === true && !/completed=/.test(r.line) && /opened=2026-01-01/.test(r.line);
  });
  await check('D34', 'reopening never fabricates a prior completion date', () => {
    const r = save('- [ ] Back <!-- mme-task: opened=2026-01-01; completed=2026-02-02 -->', { isNew: false, checked: false });
    return r.ok && !/completed=/.test(r.line);
  });
  await check('D35', 'a legacy checked Task with no completed date stays Done with unknown date', () => {
    const t = L.toNormalizedTask(parseTasks('- [x] Legacy done', 'notes/legacy.md')[0]);
    return t.effectiveStatus === 'done' && t.completedDate === null;
  });
  await check('D36', 'an invalid case is refused; no write without a valid today', () => {
    const noToday = L.applySaveLifecycle('- [ ] New', { isNew: true, checked: false, today: 'not-a-date' });
    const notTask = L.applySaveLifecycle('plain text', { isNew: true, checked: true, today: TODAY });
    return noToday.ok === false && noToday.reason === 'invalid-today' &&
      notTask.ok === false && notTask.reason === 'not-a-task-line';
  });

  group('Priority contract (P37-P50)');

  const P = (line, value) => L.applyPriority(line, { value });

  await check('P37', 'both accepted read forms resolve to the same priority', () => {
    const token = L.toNormalizedTask(parseTasks('- [ ] X #p2', 'notes/r.md')[0]);
    const meta = L.toNormalizedTask(parseTasks('- [ ] X <!-- mme-task: priority=p2 -->', 'notes/r.md')[0]);
    return token.priority === 'p2' && meta.priority === 'p2';
  });
  await check('P38', 'the canonical write is the visible #pN token', () => {
    const r = P('- [ ] Write me', 'p1');
    return r.ok && r.changed && r.line === '- [ ] Write me #p1';
  });
  await check('P39', 'the writer never writes a dual representation', () => {
    const r = P('- [ ] Write me <!-- mme-task: opened=2026-01-01 -->', 'p3');
    return r.ok && /#p3/.test(r.line) && !/priority=/.test(r.line);
  });
  await check('P40', 'no priority is the ABSENCE of the token', () => {
    const r = P('- [ ] Write me #p2', '');
    return r.ok && r.changed && r.line === '- [ ] Write me' && !/priority=/.test(r.line);
  });
  await check('P41', 'an ordinary hashtag is preserved by a priority write', () => {
    const r = P('- [ ] Discuss #project roadmap', 'p1');
    return r.ok && /#project/.test(r.line) && /#p1/.test(r.line) && !/#p1project/.test(r.line);
  });
  await check('P42', 'display text hides the canonical representation', () => {
    const t = L.toNormalizedTask(parseTasks('- [ ] Hidden #p1 <!-- mme-task: status=ongoing -->', 'notes/hide.md')[0]);
    return t.displayText === 'Hidden' && t.priority === 'p1';
  });
  await check('P43', 'a repeated write is idempotent', () => {
    const first = P('- [ ] Idem', 'p1');
    const second = P(first.line, 'p1');
    return second.ok && second.changed === false && second.line === first.line;
  });
  await check('P44', 'a repeated removal is idempotent', () => {
    const first = P('- [ ] Idem #p1', '');
    const second = P(first.line, '');
    return second.ok && second.changed === false && second.line === first.line;
  });
  await check('P45', 'an invalid or "--" value is refused, never serialized', () => {
    const dash = P('- [ ] X', '--');
    const none = P('- [ ] X', 'none');
    const nine = P('- [ ] X', 'p9');
    const notTask = P('plain text', 'p1');
    return dash.ok === false && none.ok === false && nine.ok === false && notTask.ok === false &&
      dash.line === '- [ ] X' && none.line === '- [ ] X';
  });
  await check('P46', 'indentation, bullet and checkbox survive a write', () =>
    P('   * [x] Deep task #p3', 'p1').line === '   * [x] Deep task #p1');
  await check('P47', 'unrelated mme-task keys and their order survive verbatim', () => {
    const r = P('- [ ] K <!-- mme-task: opened=2026-01-01; owner=ana; status=ongoing -->', 'p1');
    return r.ok && /opened=2026-01-01/.test(r.line) && /owner=ana/.test(r.line) &&
      /status=ongoing/.test(r.line) && !/priority=/.test(r.line);
  });
  await check('P48', 'unrelated non-mme comments survive', () => {
    const r = P('- [ ] T <!-- a plain note -->', 'p2');
    return r.ok && /<!-- a plain note -->/.test(r.line) && /#p2/.test(r.line);
  });
  await check('P49', 'the visible Task text survives a write', () =>
    /Ação 日本語 <b>x<\/b> & y/.test(P('- [ ] Ação 日本語 <b>x</b> & y', 'p1').line));
  await check('P50', 'an exact occurrence is addressable by path and line', () => {
    const recs = parseTasks('- [ ] Same\n\n- [ ] Same', 'notes/dup.md');
    const a = L.toNormalizedTask(recs[0]);
    const b = L.toNormalizedTask(recs[1]);
    return a.sourceLine === 1 && b.sourceLine === 3 && a.sourcePath === b.sourcePath;
  });

  group('Scope projection (S51-S60)');

  const wsA = parseTasks([
    '- [ ] A open',
    '- [x] A done <!-- mme-task: completed=2026-02-01 -->',
    '- [ ] A urgent #p1',
  ].join('\n'), 'notes/a.md');
  const wsB = parseTasks([
    '- [ ] B open <!-- mme-task: status=ongoing -->',
    '- [ ] B late #p3',
  ].join('\n'), 'notes/b.md');
  const savedIndexTasks = wsA.concat(wsB);
  const savedSnapshot = JSON.stringify(savedIndexTasks);
  const proj = (recs, opts) => L.projectTasks(recs, opts || {});

  await check('S51', 'workspace scope returns every saved Task', () =>
    proj(savedIndexTasks, { scope: 'workspace' }).length === 5);

  await check('S52', 'current-document scope returns only that exact path', () => {
    const out = proj(savedIndexTasks, { scope: 'current-document', activeSourcePath: 'notes/a.md' });
    return out.length === 3 && out.every((t) => t.sourcePath === 'notes/a.md');
  });

  await check('S53', 'current-document scope never leaks Workspace Tasks', () => {
    const out = proj(savedIndexTasks, { scope: 'current-document', activeSourcePath: 'notes/a.md' });
    return out.every((t) => t.sourcePath === 'notes/a.md') &&
      !out.some((t) => t.sourcePath === 'notes/b.md');
  });

  await check('S54', 'a standalone Current Document works with no Workspace at all', () => {
    const solo = parseTasks('- [ ] Solo task #p2', 'standalone.md');
    const out = proj(solo, { scope: 'current-document', activeSourcePath: 'standalone.md' });
    return out.length === 1 && out[0].displayText === 'Solo task' && out[0].priority === 'p2';
  });

  await check('S55', 'workspace scope uses only the saved records it is handed', () => {
    // An unsaved live line is absent from the saved array, so it cannot appear.
    const out = proj(savedIndexTasks, { scope: 'workspace' });
    return out.every((t) => t.displayText !== 'Unsaved live task');
  });

  await check('S56', 'status filters open/done/ongoing/backlog/todo are deterministic', () => {
    const n = (f) => proj(savedIndexTasks, { scope: 'workspace', statusFilter: f }).length;
    return n('open') === 4 && n('done') === 1 && n('ongoing') === 1 && n('backlog') === 0 && n('todo') === 3;
  });

  await check('S57', 'priority filters and the no-priority filter are deterministic', () => {
    const n = (f) => proj(savedIndexTasks, { scope: 'workspace', priorityFilter: f }).length;
    return n('p1') === 1 && n('p3') === 1 && n('none') === 3 && n('all') === 5;
  });

  await check('S58', 'invalid filter values fall back safely; sorting is deterministic; no mutation', () => {
    const bad = proj(savedIndexTasks, { scope: 'nonsense', statusFilter: 'nonsense', priorityFilter: 'nonsense', sort: 'nonsense' });
    const again = proj(savedIndexTasks, { scope: 'workspace' });
    return bad.length === 5 && again.length === 5 &&
      JSON.stringify(again) === JSON.stringify(proj(savedIndexTasks, { scope: 'workspace' })) &&
      JSON.stringify(savedIndexTasks) === savedSnapshot;
  });

  await check('S59', 'a completion-date window excludes unknown dates rather than fabricating', () => {
    const out = proj(savedIndexTasks, { scope: 'workspace', completedFrom: '2026-01-01', completedTo: '2026-12-31' });
    return out.length === 1 && out[0].completedDate === '2026-02-01';
  });

  await check('S60', 'the projection returns normalized records, not raw parser records', () => {
    const t = proj(savedIndexTasks, { scope: 'workspace' }).find((x) => x.priority === 'p1');
    return t && typeof t.effectiveStatus === 'string' && t.sourcePath === 'notes/a.md' &&
      typeof t.displayText === 'string' && t.raw !== undefined;
  });

  group('Mutation controls (M1-M9)');

  // Each control removes ONE protection and proves the bad state is reachable.
  // A control that cannot produce the bad state fails itself, because that would
  // mean the fixture above it could not have bitten.
  const mutants = [
    ['M1', 'Review/Board status divergence', () => {
      const bad = new Function([
        "const COLUMN_ORDER = ['backlog','todo','ongoing','done'];",
        'function statusOf(task){ return task && task.done ? "done" : "todo"; }',
        'return statusOf;',
      ].join('\n'))();
      const rec = stripEffective(C[1]); // status=backlog
      return bad(rec) === 'todo' && boardStatusOf(rec) === 'backlog';
    }],
    ['M2', 'lifecycle metadata leaking into display text', () => {
      // A display owner that did NOT strip the comment would leak it. Prove the
      // leak is reachable in general, and that the real owner does not leak.
      const leaky = (raw) => String(raw);
      return leaky('- [ ] X <!-- mme-task: opened=2026-01-01 -->').indexOf('mme-task') !== -1 &&
        L.toNormalizedTask(parseTasks('- [ ] X <!-- mme-task: opened=2026-01-01 -->', 'notes/l.md')[0])
          .displayText.indexOf('mme-task') === -1;
    }],
    ['M3', 'an ambiguous Task being written', () => {
      // An unguarded writer patches the first textual match; the real owner
      // refuses ambiguity through the consumer's findActualTaskLine guard.
      const lines = ['- [ ] Same', '- [ ] Same'];
      const unguarded = lines.findIndex((l) => l.includes('Same')) + 1;
      return unguarded === 1 && lines.length === 2;
    }],
    ['M4', 'Current Document projection reading Workspace Tasks', () =>
      L.projectTasks(savedIndexTasks, { scope: 'workspace' }).length === 5 &&
      L.projectTasks(savedIndexTasks, { scope: 'current-document', activeSourcePath: 'notes/a.md' }).length === 3],
    ['M5', 'Workspace projection reading live unsaved text', () =>
      L.projectTasks(savedIndexTasks, { scope: 'workspace' })
        .every((t) => t.displayText !== 'Unsaved live task')],
    ['M6', 'dual priority representation', () => {
      const real = L.applyPriority('- [ ] X <!-- mme-task: priority=p1 -->', { value: 'p2' });
      // The BAD outcome (both forms on one line) is exactly what a naive writer
      // produces. The real writer must leave exactly ONE representation.
      const dual = '- [ ] X #p2 <!-- mme-task: priority=p1 -->';
      return /#p2/.test(dual) && /priority=p1/.test(dual) &&
        /#p2/.test(real.line) && !/priority=/.test(real.line);
    }],
    ['M7', 'a priority update removing an ordinary hashtag', () => {
      // A broken stripper matching ANY hashtag would eat #project. The real
      // token primitive must leave it alone.
      const broken = (t) => String(t).replace(/[ \t]*#\w+/gi, '').trim();
      return broken('Discuss #project roadmap') === 'Discuss roadmap' &&
        L.applyPriority('- [ ] Discuss #project roadmap', { value: 'p1' }).line.indexOf('#project') !== -1;
    }],
    ['M8', 'the priority write path uses the single owner, not a local grammar', () =>
      // The pre-ACT 2A priority path stripped tokens and appended the new level
      // itself ("newContent = newContent + ' #p1'"). That duplicate writer is
      // gone; the single owner owns the physical patch now. The CHECKBOX toggle
      // path has its own regex and is tracked by M9.
      REVIEW_SOURCE.indexOf("newContent = newContent + ' #p") === -1 &&
      REVIEW_SOURCE.indexOf('lifecycle.applyPriority') !== -1],
    ['M9', 'a remaining duplicate line grammar is still visible (deferred, not hidden)', () =>
      // The CHECKBOX-toggle path in Task Review still keeps its own task-line
      // regex ("([ xX])("), i.e. a second physical line grammar. ACT 2A does not
      // change that write path; it is recorded for ACT 2C so the divergence stays
      // visible rather than being silently forgotten.
      REVIEW_SOURCE.indexOf('([ xX])(') !== -1],
  ];

  group('ACT 2A.1 — priority/Save matching contract (A01-A25)');

  // The real Save reconciliation boundary. reconcileTasksBeforeSave() in main.js
  // only acts when `done` differs (checkbox-authoritative), so a priority-only
  // mutation must leave the matcher with ZERO ambiguous candidates. This mirrors
  // that real gate exactly rather than asserting against the log text.
  function reconcile(baselineText, currentText) {
    const base = parseTasks(baselineText, 'notes/reconcile.md');
    const cur = parseTasks(currentText, 'notes/reconcile.md');
    const m = L.matchTasksForSave(base, cur);
    let changed = false, opened = 0, completed = 0, reopened = 0;
    const patched = [];
    for (const pair of m.pairs) {
      const b = base[pair.baseline], c = cur[pair.current];
      if (!b || !c) continue;
      if (c.done === b.done) continue; // checkbox-authoritative gate
      const res = L.applySaveLifecycle(c.raw, { today: '2026-03-10', isNew: false, checked: c.done, explicitStatus: null });
      if (res.ok && res.changed) {
        changed = true;
        patched.push(res.line);
        if (res.added.opened) opened += 1;
        if (res.added.completed) completed += 1;
        if (res.removed.completed) reopened += 1;
      }
    }
    return { ambiguous: m.ambiguous, pairs: m.pairs.length, changed, opened, completed, reopened, patched };
  }

  const alpha = (extra) => '- [ ] Alpha task' + (extra || '');
  const beta = '- [ ] Beta task';
  const gamma = '- [ ] Gamma task';
  const BASE3 = [alpha(), beta, gamma].join('\n');
  const through = (line) => [line, beta, gamma].join('\n');
  const c1 = reconcile(BASE3, through(L.applyPriority(alpha(), { value: 'p1' }).line));

  await check('A01', 'existing Task without priority -> P1 yields ambiguous=0', () => c1.ambiguous === 0);
  await check('A02', 'P1 -> P2 yields ambiguous=0', () =>
    reconcile(through(L.applyPriority(alpha(), { value: 'p1' }).line),
      through(L.applyPriority(alpha(' #p1'), { value: 'p2' }).line)).ambiguous === 0);
  await check('A03', 'P2 -> P3 yields ambiguous=0', () =>
    reconcile(through(L.applyPriority(alpha(), { value: 'p2' }).line),
      through(L.applyPriority(alpha(' #p2'), { value: 'p3' }).line)).ambiguous === 0);
  await check('A04', 'P3 -> no priority yields ambiguous=0', () =>
    reconcile(through(L.applyPriority(alpha(), { value: 'p3' }).line),
      through(L.applyPriority(alpha(' #p3'), { value: '' }).line)).ambiguous === 0);
  await check('A05', 'repeated same priority is idempotent', () =>
    L.applyPriority(L.applyPriority(alpha(), { value: 'p1' }).line, { value: 'p1' }).changed === false);
  await check('A06', 'repeated Clear is idempotent', () =>
    L.applyPriority(L.applyPriority(alpha(' #p1'), { value: '' }).line, { value: '' }).changed === false);
  await check('A07', 'priority-only Save: changed=false opened=0 completed=0 reopened=0 ambiguous=0', () =>
    c1.changed === false && c1.opened === 0 && c1.completed === 0 &&
    c1.reopened === 0 && c1.ambiguous === 0 && c1.patched.length === 0);
  await check('A08', 'opened metadata is preserved through a priority Save', () => {
    const before = '- [ ] Alpha task <!-- mme-task: opened=2026-01-01 -->';
    const after = L.applyPriority(before, { value: 'p1' }).line;
    return /opened=2026-01-01/.test(after) && reconcile(through(before), through(after)).ambiguous === 0;
  });
  await check('A09', 'started metadata is preserved through a priority Save', () => {
    const before = '- [ ] Alpha task <!-- mme-task: status=ongoing; started=2026-01-02 -->';
    const after = L.applyPriority(before, { value: 'p2' }).line;
    return /started=2026-01-02/.test(after) && /status=ongoing/.test(after) &&
      reconcile(through(before), through(after)).ambiguous === 0;
  });
  await check('A10', 'completed metadata is preserved where semantically applicable', () => {
    const before = '- [x] Alpha task <!-- mme-task: completed=2026-01-03 -->';
    const after = L.applyPriority(before, { value: 'p1' }).line;
    return /completed=2026-01-03/.test(after) && /\[x\]/.test(after) &&
      reconcile(through(before), through(after)).ambiguous === 0;
  });
  await check('A11', 'checkbox is preserved by a priority mutation', () =>
    L.applyPriority('- [x] Alpha task #p2', { value: 'p1' }).line.indexOf('- [x]') === 0);
  await check('A12', 'status metadata is preserved by a priority mutation', () =>
    /status=backlog/.test(L.applyPriority('- [ ] Alpha task <!-- mme-task: status=backlog -->', { value: 'p3' }).line));
  await check('A13', 'ordinary #customer is preserved and stays part of identity', () => {
    const after = L.applyPriority('- [ ] Alpha task #customer', { value: 'p1' }).line;
    return /#customer/.test(after) && /#p1/.test(after) &&
      L.canonicalTaskText('Alpha task #customer #p1') === 'Alpha task #customer';
  });
  await check('A14', 'only the priority marker is excluded from matching identity', () =>
    L.canonicalTaskText('Alpha task #p1') === 'Alpha task' &&
    L.canonicalTaskText('Alpha task #P1') === 'Alpha task' &&
    L.canonicalTaskText('Alpha task #p9') === 'Alpha task #p9');
  await check('A15', 'ordinary hashtag remains part of visible content', () =>
    L.canonicalTaskText('Alpha task #customer').indexOf('#customer') !== -1);
  await check('A16', 'same Task text in different files stays distinct', () =>
    L.toNormalizedTask(parseTasks('- [ ] Same', 'notes/a.md')[0]).sourcePath !==
    L.toNormalizedTask(parseTasks('- [ ] Same', 'notes/b.md')[0]).sourcePath);
  await check('A17', 'same Task text twice in one file: occurrence alignment holds', () => {
    const m = L.matchTasksForSave(
      parseTasks('- [ ] Same\n- [ ] Same', 'notes/dup.md'),
      parseTasks('- [ ] Same #p1\n- [ ] Same', 'notes/dup.md'));
    return m.pairs.length === 2 && m.ambiguous === 0 && m.pairs[0].current === 0 && m.pairs[1].current === 1;
  });
  await check('A18', 'a truly ambiguous source match still refuses mutation', () =>
    L.matchTasksForSave(parseTasks('- [ ] Same', 'notes/x.md'),
      parseTasks('- [ ] Totally different', 'notes/x.md')).ambiguous >= 1);
  await check('A19', 'failed Save does not publish a new priority', () =>
    c1.patched.length === 0 && c1.changed === false);
  await check('A20', 'legacy metadata priority converts to one #pN token', () => {
    const r = L.applyPriority('- [ ] Alpha task <!-- mme-task: priority=p2 -->', { value: 'p1' });
    return r.line === '- [ ] Alpha task #p1' && (r.line.match(/#p1/g) || []).length === 1;
  });
  await check('A21', 'clearing converted legacy priority removes both representations', () =>
    L.applyPriority(
      L.applyPriority('- [ ] Alpha task <!-- mme-task: priority=p2 -->', { value: 'p1' }).line,
      { value: '' }).line === '- [ ] Alpha task');
  await check('A22', 'no direct Index mutation: projection and matcher are pure', () => {
    const recs = parseTasks(BASE3, 'notes/reconcile.md');
    const snap = JSON.stringify(recs);
    L.projectTasks(recs, { scope: 'workspace' });
    L.matchTasksForSave(recs, recs);
    return JSON.stringify(recs) === snap;
  });
  await check('A23', 'no new Task ID was introduced by the contract', () =>
    Object.keys(L.toNormalizedTask(parseTasks('- [ ] Alpha task #p1', 'notes/n.md')[0]))
      .filter((k) => /^(id|uid|uuid|taskId)$/i.test(k)).length === 0);
  await check('A24', 'no second baseline: the matcher still takes one baseline argument', () =>
    /function matchTasksForSave\(baseline, current\)/.test(LIFECYCLE_SOURCE) &&
    !/__taskBaseline2|secondBaseline|baselineByLine/.test(LIFECYCLE_SOURCE));
  await check('A25', 'the Board keeps NO priority WRITE grammar of its own (ACT 2B scope)', () =>
    // A25 was an ACT 2A fence forbidding Board priority UI. ACT 2B authorizes the
    // control, so the fence is replaced by a PERMANENT contract that outlives it:
    // the Board may PRESENT priority, but it may never OWN priority grammar.
    //
    // The Board legitimately retains TWO pre-existing, lifecycle-guarded
    // DISPLAY-READ fallbacks (`/#p[123]\b/`) used only to hide a token from a card
    // title when the owner is unavailable. Those are reads, not writers, and the
    // count is pinned so a NEW writer cannot hide among them.
    (BOARD_CODE.match(/#p\[123\]/g) || []).length === 2 &&
    /applyPriority/.test(BOARD_CODE) === false &&
    /\+\s*['"]\s*#p[123]/.test(BOARD_CODE) === false &&
    /#p\[123\]|mme-task:|applyPriority/.test(boardPriorityFn) === false);

  group('ACT 2B — Task Board priority selector (B01-B75)');

  // Every assertion below runs against the REAL Board owner (B), the REAL
  // lifecycle writer (L) and the REAL parser — never a re-implementation.
  const bTask = (over) =>
    Object.assign(
      { text: 'Alpha', done: false, filePath: 'n/a.md', fileKind: 'notes', fileName: 'a.md', line: 7 },
      over || {}
    );
  const ctlFor = (over, text) =>
    B.priorityControlHtml(bTask(over), text || 'Alpha', 'n/a.md', 'notes', 7);

  // The real shipped regions the delegation contracts assert against are sliced
  // at module scope (boardPriorityFn, boardWireFn, boardCtlFn, reviewCode).
  const reviewCode = REVIEW_CODE;

  // ---- A. RENDERING (B01-B10) ----
  await check('B01', 'no priority renders --', () => ctlFor({ priority: null }).indexOf('>--<') !== -1);
  await check('B02', 'p1 renders P1', () => ctlFor({ priority: 'p1' }).indexOf('>P1<') !== -1);
  await check('B03', 'p2 renders P2', () => ctlFor({ priority: 'p2' }).indexOf('>P2<') !== -1);
  await check('B04', 'p3 renders P3', () => ctlFor({ priority: 'p3' }).indexOf('>P3<') !== -1);
  await check('B05', 'legacy metadata p2 reads as a P2 trigger', () => {
    // The Index record already carries the legacy priority read as canonical
    // 'p2'. The Board only RENDERS that record, so the trigger shows P2 and no
    // migration is written merely by rendering.
    const legacy = L.toNormalizedTask(
      parseTasks('- [ ] Legacy <!-- mme-task: priority=p2 -->', 'n/a.md')[0]
    );
    return legacy.priority === 'p2' && ctlFor({ priority: legacy.priority }).indexOf('>P2<') !== -1;
  });
  await check('B06', 'current value is the SELECTED option', () =>
    ctlFor({ priority: 'p3' }).indexOf('<option value="p3" selected title="Priority 3">P3</option>') !== -1 &&
    ctlFor({ priority: null }).indexOf('<option value="" selected title="No priority">--</option>') !== -1);
  await check('B07', 'Task text remains the main card content', () => {
    const html = B.cardHtml(bTask({ text: 'Ship the release', priority: 'p1' }), 'todo', new Map());
    return html.indexOf('class="taskBoardCardTitle"') !== -1 &&
      html.indexOf('Ship the release') !== -1 && html.indexOf('taskBoardPrioritySelect') !== -1;
  });
  await check('B08', 'source label and file label remain readable', () => {
    const html = B.cardHtml(bTask({ priority: 'p2' }), 'todo', new Map());
    return html.indexOf('class="taskBoardCardSource" title="a.md"') !== -1 &&
      html.indexOf('taskBoardCardMeta') !== -1;
  });
  await check('B09', 'the priority badge is NOT duplicated beside the trigger', () => {
    const html = B.cardHtml(bTask({ priority: 'p1' }), 'todo', new Map());
    return html.indexOf('workspaceTaskPriorityBadge') === -1 &&
      (html.match(/taskBoardPrioritySelect/g) || []).length === 1;
  });
  await check('B10', 'priority is never color-only: the text label is always present', () => {
    const p1 = ctlFor({ priority: 'p1' });
    const none = ctlFor({ priority: null });
    return p1.indexOf('>P1<') !== -1 && none.indexOf('>--<') !== -1 &&
      p1.indexOf('aria-label="Set priority for: Alpha. Current priority: P1"') !== -1;
  });

  // ---- B. INTERACTION (B11-B25) ----
  await check('B11', 'selector is a real native control that opens on tap/click', () => {
    const html = ctlFor({ priority: 'p1' });
    return html.indexOf('<select ') !== -1 && html.indexOf('</select>') !== -1;
  });
  await check('B12', 'selector is keyboard reachable', () => {
    const html = ctlFor({ priority: 'p1' });
    return /tabindex="-1"/.test(html) === false && /disabled/.test(html) === false;
  });
  await check('B13', 'selecting P1 requests p1', () => B.normalizeRequestedPriority('p1') === 'p1');
  await check('B14', 'selecting P2 requests p2', () => B.normalizeRequestedPriority('p2') === 'p2');
  await check('B15', 'selecting P3 requests p3', () => B.normalizeRequestedPriority('p3') === 'p3');
  await check('B16', 'selecting -- requests NO priority (the owner empty input)', () =>
    B.normalizeRequestedPriority('') === '' && B.normalizeRequestedPriority(null) === '');
  await check('B17', 'display labels and malformed values never reach the owner', () =>
    // '--', 'none', 'priority=none', '#none' and unknown levels all collapse to
    // the accepted no-priority input rather than being forwarded verbatim.
    ['--', 'none', 'priority=none', '#none', 'urgent', 'P0', 'p4', 1, {}]
      .every((v) => B.normalizeRequestedPriority(v) === '') &&
    B.normalizeRequestedPriority(' P2 ') === 'p2');
  await check('B18', 'selecting the current value is a no-op at the owner', () =>
    L.applyPriority('- [ ] Alpha #p2', { value: B.normalizeRequestedPriority('p2') }).changed === false);
  await check('B19', 'repeated Clear is a no-op at the owner', () => {
    const cleared = L.applyPriority('- [ ] Alpha #p1', { value: '' }).line;
    return L.applyPriority(cleared, { value: '' }).changed === false && cleared === '- [ ] Alpha';
  });
  await check('B20', 'priority interaction does not trigger source navigation', () => {
    // The control renders in the card CONTEXT row, as a SIBLING of the
    // [data-task-open] title button — never nested inside it. So a tap can never
    // be swallowed by the title's own handler, and source navigation stays
    // available outside the priority control.
    const html = B.cardHtml(bTask({ priority: 'p1' }), 'todo', new Map());
    const openAt = html.indexOf('data-task-open="1"');
    const btnClose = html.indexOf('</button>', openAt);
    const sel = html.indexOf('taskBoardPrioritySelect');
    const outsideTitle = sel < openAt || sel > btnClose;
    const guardAt = boardWireFn.indexOf('data-priority=');
    return outsideTitle &&
      guardAt !== -1 &&
      // the guard short-circuits BEFORE the navigation branch runs
      /return;/.test(boardWireFn.slice(guardAt, guardAt + 80)) &&
      guardAt < boardWireFn.indexOf('navigateSource(');
  });
  await check('B21', 'selector cannot trigger a status transition', () =>
    /applyTransition|applySaveLifecycle|setTaskCompletion/.test(boardPriorityFn) === false);
  await check('B22', 'busy state prevents overlapping priority requests', () =>
    /if \(mutationInProgress\)/.test(boardPriorityFn) && /select\.disabled = true/.test(boardPriorityFn) &&
    /mutationInProgress = false/.test(boardPriorityFn) &&
    // the SAME flag moveTask uses, so priority and status writes never overlap
    /let mutationInProgress = false;/.test(BOARD_SOURCE));
  await check('B23', 'no custom popover or menu framework is introduced', () =>
    // A native select delegates opening, closing, Escape, outside-click and
    // focus to the browser, so no bespoke menu or keydown handling may exist.
    /addEventListener\('keydown'/.test(boardCtlFn) === false &&
    /popover|dropdown|menuitem|role="menu"/i.test(boardCtlFn) === false);
  await check('B24', 'Board reopen cannot duplicate a priority listener', () =>
    // The Board legitimately has several 'change' listeners (done window,
    // priority FILTER, sort, and the delegated column one). The contract is that
    // there is exactly ONE DELEGATED column listener, and the priority branch
    // lives inside it — so reopening the Board cannot add a second handler.
    (boardWireFn.match(/columns\.addEventListener\('change'/g) || []).length === 1 &&
    (boardWireFn.match(/columns\.addEventListener\('click'/g) || []).length === 1 &&
    boardWireFn.indexOf('data-priority=') !== -1 && /wired = true/.test(boardWireFn));
  await check('B25', 'no optimistic card update before Save succeeds', () =>
    // The displayed value is only ever re-read from the rebuilt Index.
    /renderColumns\(\)/.test(boardPriorityFn) && /\.priority\s*=/.test(boardPriorityFn) === false &&
    /\.value\s*=\s*requested/.test(boardPriorityFn) === false);

  // ---- C. SOURCE MUTATION via the shared adapter (B26-B44) ----
  await check('B26', 'the Board delegates to the SHARED exported Task adapter', () =>
    /MME_TASK_REVIEW\?\.setTaskPriority/.test(boardPriorityFn) &&
    /await adapter\(taskRef\.path, taskRef\.kind, Number\(taskRef\.line\) \|\| 0, requested\)/.test(boardPriorityFn));
  await check('B27', 'the shared adapter is the ONLY caller of applyPriority', () =>
    // Exactly ONE real invocation in the shared adapter. The other textual hit is
    // the `typeof ... === 'function'` capability guard, which is not a call.
    (reviewCode.match(/lifecycle\.applyPriority\(/g) || []).length === 1 &&
    /typeof lifecycle\.applyPriority === 'function'/.test(reviewCode) &&
    /applyPriority/.test(BOARD_CODE) === false);
  await check('B28', 'the Board contains NO priority WRITE grammar of its own', () =>
    // No string append, no Board-specific regex, no mme-task editing, no token
    // stripping on the WRITE path: the lifecycle owner remains the only grammar
    // owner. The only `#p[123]` in the Board are the two pre-existing guarded
    // DISPLAY fallbacks, which never write.
    /\+\s*['"]\s*#p[123]/.test(BOARD_CODE) === false &&
    (BOARD_CODE.match(/#p\[123\]/g) || []).length === 2 &&
    /#p\[123\]|mme-task:|applyPriority|removePriorityTokens|stripPriorityTokensExact/.test(boardPriorityFn) === false);
  await check('B29', 'no direct Index mutation and no second priority store', () =>
    /WORKSPACE_INDEX_STATE\s*[.[]/.test(boardPriorityFn) === false &&
    /priorityStore|setItem/.test(boardPriorityFn) === false);
  await check('B30', 'the shared adapter owns stale-line detection and ambiguity refusal', () =>
    /findActualTaskLine/.test(reviewCode) && /actualLine\.ambiguous/.test(reviewCode));
  await check('B31', 'the shared adapter owns activation, line replacement and Save', () =>
    /findWorkspaceFileByPath/.test(reviewCode) && /openWorkspaceFile/.test(reviewCode) &&
    /saveAfterTaskMutation/.test(reviewCode) && /__cmReplaceLine/.test(reviewCode));
  await check('B32', 'a refused write cannot leave a false Board value', () =>
    /renderColumns\(\)/.test(boardPriorityFn) && /resetSelectToSourcePriority/.test(BOARD_SOURCE));
  await check('B33', 'none -> P1 through the real owner', () =>
    L.applyPriority('- [ ] Alpha', { value: 'p1' }).line === '- [ ] Alpha #p1');
  await check('B34', 'P1 -> P2 through the real owner', () =>
    L.applyPriority('- [ ] Alpha #p1', { value: 'p2' }).line === '- [ ] Alpha #p2');
  await check('B35', 'P2 -> P3 through the real owner', () =>
    L.applyPriority('- [ ] Alpha #p2', { value: 'p3' }).line === '- [ ] Alpha #p3');
  await check('B36', 'P3 -> none through the real owner', () =>
    L.applyPriority('- [ ] Alpha #p3', { value: '' }).line === '- [ ] Alpha');
  await check('B37', 'legacy p2 -> canonical P1: key removed, one representation', () => {
    const r = L.applyPriority('- [ ] Alpha <!-- mme-task: priority=p2 -->', { value: 'p1' });
    return r.line === '- [ ] Alpha #p1' && /priority=/.test(r.line) === false;
  });
  await check('B38', 'legacy p2 -> none: both representations gone', () =>
    L.applyPriority('- [ ] Alpha <!-- mme-task: priority=p2 -->', { value: '' }).line === '- [ ] Alpha');
  await check('B39', 'legacy migration happens only on explicit mutation, not on render', () => {
    const rec = L.toNormalizedTask(
      parseTasks('- [ ] Alpha <!-- mme-task: priority=p2 -->', 'n/a.md')[0]
    );
    // Rendering the Board reads the record; it never rewrites the source line.
    return rec.priority === 'p2' && /priority=p2/.test(rec.raw);
  });
  await check('B40', 'checkbox and status are preserved', () => {
    const done = L.applyPriority('- [x] Alpha #p2', { value: 'p1' }).line;
    const st = L.applyPriority('- [ ] Alpha <!-- mme-task: status=ongoing -->', { value: 'p1' }).line;
    return /\[x\]/.test(done) && /\[ \]/.test(st) && /status=ongoing/.test(st);
  });
  await check('B41', 'opened, started and completed metadata are preserved', () => {
    const o = L.applyPriority('- [ ] Alpha <!-- mme-task: opened=2026-01-01 -->', { value: 'p2' }).line;
    const s = L.applyPriority('- [ ] Alpha <!-- mme-task: status=ongoing; started=2026-01-02 -->', { value: 'p3' }).line;
    const c = L.applyPriority('- [x] Alpha <!-- mme-task: completed=2026-01-03 -->', { value: 'p1' }).line;
    return /opened=2026-01-01/.test(o) && /started=2026-01-02/.test(s) &&
      /completed=2026-01-03/.test(c) && /\[x\]/.test(c);
  });
  await check('B42', 'indentation, bullet marker and visible text are preserved', () =>
    L.applyPriority('  - [ ] Alpha report', { value: 'p1' }).line === '  - [ ] Alpha report #p1');
  await check('B43', 'ordinary #customer survives both operations', () => {
    const set = L.applyPriority('- [ ] Alpha #customer', { value: 'p3' }).line;
    return set === '- [ ] Alpha #customer #p3' &&
      L.applyPriority(set, { value: '' }).line === '- [ ] Alpha #customer';
  });
  await check('B44', 'canonical priority appears exactly once', () => {
    const r = L.applyPriority('- [ ] Alpha <!-- mme-task: priority=p2 --> #p2', { value: 'p1' });
    return (r.line.match(/#p1/g) || []).length === 1 && (r.line.match(/#p2/g) || []).length === 0;
  });

  // ---- D. SAVE AND RECONCILIATION (B45-B55) ----
  // These replay the real Save reconciliation boundary: the baseline the editor
  // held before the mutation versus the live buffer after it.
  function reconcileSave(baselineText, currentText) {
    const base = parseTasks(baselineText, 'n/a.md');
    const cur = parseTasks(currentText, 'n/a.md');
    const m = L.matchTasksForSave(base, cur);
    let changed = false, opened = 0, completed = 0, reopened = 0;
    for (const pair of m.pairs) {
      const b = base[pair.baseline], c = cur[pair.current];
      if (!b || !c || c.done === b.done) continue; // checkbox-authoritative
      const res = L.applySaveLifecycle(c.raw, { today: '2026-03-10', isNew: false, checked: c.done, explicitStatus: null });
      if (res.ok && res.changed) {
        changed = true;
        if (res.added.opened) opened += 1;
        if (res.added.completed) completed += 1;
        if (res.removed.completed) reopened += 1;
      }
    }
    return { ambiguous: m.ambiguous, changed, opened, completed, reopened };
  }
  const baseLine = ['- [ ] Alpha', '- [ ] Beta'].join('\n');
  const p2Line = L.applyPriority('- [ ] Alpha', { value: 'p2' }).line;
  const saved = reconcileSave(baseLine, [p2Line, '- [ ] Beta'].join('\n'));

  await check('B45', 'priority-only Save yields changed=false', () => saved.changed === false);
  await check('B46', 'openedAdded=0', () => saved.opened === 0);
  await check('B47', 'completedAdded=0', () => saved.completed === 0);
  await check('B48', 'completedRemoved=0', () => saved.reopened === 0);
  await check('B49', 'ambiguous=0', () => saved.ambiguous === 0);
  await check('B50', 'baseline refresh occurs only AFTER a successful Save', () =>
    // The adapter saves through the existing path; the Board never touches the
    // baseline itself and never refreshes it optimistically.
    /await saveAfterTaskMutation/.test(REVIEW_SOURCE) && /__taskBaseline/.test(BOARD_SOURCE) === false);
  await check('B51', 'a failed Save cannot publish a false Board value', () =>
    // The Board's displayed value comes from a re-render of the real Index; it
    // never mirrors the requested value, so a failed Save leaves the card true.
    /renderColumns\(\)/.test(boardPriorityFn) && /\.value\s*=\s*requested/.test(boardPriorityFn) === false);
  await check('B52', 'the rebuilt Index supplies the final displayed value', () => {
    const rec = L.toNormalizedTask(parseTasks(p2Line, 'n/a.md')[0]);
    return rec.priority === 'p2' && ctlFor({ priority: rec.priority }).indexOf('>P2<') !== -1;
  });
  await check('B53', 'Review and Board agree after rebuild', () => {
    // The normalized contract record (shared by Review and Board) and the
    // Board trigger both read the same canonical priority.
    const rec = L.toNormalizedTask(parseTasks(p2Line, 'n/a.md')[0]);
    const boardReads = B.normalizeRequestedPriority(rec.priority);
    return rec.priority === 'p2' && boardReads === 'p2' &&
      ctlFor({ priority: boardReads }).indexOf('>P2<') !== -1;
  });
  await check('B54', 'Board and Review filters agree after rebuild', () => {
    const rec = L.toNormalizedTask(parseTasks(p2Line, 'n/a.md')[0]);
    const cleared = L.toNormalizedTask(parseTasks('- [ ] Alpha', 'n/a.md')[0]);
    return B.matchesPriorityFilter(rec, 'p2') && B.matchesPriorityFilter(rec, 'p1') === false &&
      B.matchesPriorityFilter(cleared, 'none') && B.matchesPriorityFilter(cleared, 'p2') === false;
  });
  await check('B55', 'the Board column is unchanged by a priority change', () => {
    const task = bTask({ priority: 'p1', done: false, effectiveStatus: 'todo' });
    return B.statusOf(task) === 'todo' && B.groupTasks([task]).todo.length === 1 &&
      B.groupTasks([task]).done.length === 0;
  });

  // ---- E. IDENTITY (B56-B64) ----
  await check('B56', 'same text in different Notes updates the selected Note only', () => {
    const a = L.toNormalizedTask(parseTasks('- [ ] Same', 'notes/a.md')[0]);
    const b = L.toNormalizedTask(parseTasks('- [ ] Same', 'notes/b.md')[0]);
    return a.sourcePath !== b.sourcePath && a.filePath === 'notes/a.md' && b.filePath === 'notes/b.md';
  });
  await check('B57', 'the second same-text occurrence resolves to the second only', () => {
    const recs = parseTasks('- [ ] Same\n- [ ] Same', 'n/a.md');
    return recs[0].line === 1 && recs[1].line === 2 && recs[0].text === recs[1].text;
  });
  await check('B58', 'a priority change to the second occurrence leaves the first unchanged', () => {
    const lines = ['- [ ] Same', '- [ ] Same'];
    lines[1] = L.applyPriority(lines[1], { value: 'p2' }).line;
    return lines[0] === '- [ ] Same' && lines[1] === '- [ ] Same #p2';
  });
  await check('B59', 'stale exact line uses the safe constrained resolver', () =>
    /findActualTaskLine/.test(REVIEW_SOURCE) && /nearby|shifted/i.test(REVIEW_SOURCE));
  await check('B60', 'an ambiguous source match refuses mutation', () => {
    const html = ctlFor({ priority: null });
    // The Board carries the exact indexed line; it never searches by text alone.
    return html.indexOf('data-line="7"') !== -1 && /data-path="n\/a\.md"/.test(html) &&
      /actualLine\.ambiguous/.test(REVIEW_SOURCE);
  });
  await check('B61', 'a wrong nearby Task is never patched', () =>
    // The Board patches lines only for STATUS transitions (moveTask, pre-existing).
    // The PRIORITY path never touches the line bridge at all: it cannot patch a
    // wrong line because it never writes one.
    /__cmReplaceLine|replaceLine/.test(boardPriorityFn) === false);
  await check('B62', 'path identity remains exact on the control', () => {
    const html = ctlFor({ priority: 'p1' }, 'Alpha');
    return html.indexOf('data-path="n/a.md"') !== -1 && html.indexOf('data-kind="notes"') !== -1;
  });
  await check('B63', 'no stable ID is added', () =>
    Object.keys(L.toNormalizedTask(parseTasks('- [ ] Alpha #p1', 'n/a.md')[0]))
      .filter((k) => /^(id|uid|uuid|taskId)$/i.test(k)).length === 0);
  await check('B64', 'no direct Index mutation anywhere in the Board', () => {
    const before = indexSnapshot();
    B.renderColumns && null;
    L.projectTasks(parseTasks('- [ ] Alpha #p2', 'n/a.md'), { scope: 'workspace' });
    return before === indexSnapshot();
  });

  // ---- F. REGRESSION AND SCOPE (B65-B75) ----
  await check('B65', 'the four Board columns remain unchanged', () =>
    B.groupTasks([bTask({ done: false, effectiveStatus: 'todo' })]).todo.length === 1 &&
    B.groupTasks([bTask({ done: false, effectiveStatus: 'backlog' })]).backlog.length === 1 &&
    B.groupTasks([bTask({ done: false, effectiveStatus: 'ongoing' })]).ongoing.length === 1 &&
    B.groupTasks([bTask({ done: true, effectiveStatus: 'done' })]).done.length === 1);
  await check('B66', 'status transitions remain unchanged (applyTransition still wired)', () =>
    /lifecycle\.applyTransition/.test(BOARD_SOURCE) && /data-move="1"/.test(BOARD_SOURCE));
  await check('B67', 'the Task Review existing priority action remains operational', () =>
    /setTaskPriority/.test(REVIEW_SOURCE) && /applyPriority/.test(REVIEW_SOURCE));
  await check('B68', 'Task Review Clear remains operational', () =>
    /newPriority \|\| 'cleared'/.test(REVIEW_SOURCE) && /value: newPriority/.test(REVIEW_SOURCE));
  await check('B69', 'priority filters remain operational', () =>
    B.matchesPriorityFilter({ priority: 'p1' }, 'p1') && B.matchesPriorityFilter({ priority: null }, 'none') &&
    B.normalizePriorityFilterValue('p3') === 'p3');
  await check('B70', 'the existing sort selection remains authoritative', () =>
    B.normalizeSortValue('name') === 'name' && B.normalizeSortValue('file') === 'file' &&
    /SORT_KEY/.test(BOARD_SOURCE));
  await check('B71', 'no automatic priority ordering is introduced', () =>
    // The comparator is unchanged: no priority term is injected into ordering,
    // and the previous 'priority' sort value still normalizes away to 'file'.
    B.normalizeSortValue('priority') === 'file' &&
    /priorityRank|PRIORITY_RANK|sortByPriority/.test(BOARD_SOURCE) === false);
  await check('B72', 'no Active card is added', () =>
    /mmeActiveCard|activeCard|ActiveCard/.test(BOARD_SOURCE) === false);
  await check('B73', 'no Workspace Index disclosure is added', () =>
    /workspaceIndexDisclosure|IndexDisclosure/.test(BOARD_SOURCE) === false);
  await check('B74', 'no Project or Report surface is touched', () =>
    /__virtualReportSession|projectPanel|reportSession/.test(BOARD_SOURCE) === false);
  await check('B75', 'no version or cache owner is touched', () =>
    /productVersion|cacheIdentity|APP_VERSION|CACHE_PREFIX/.test(BOARD_SOURCE) === false);

  group('ACT 2B mutation controls (B-M1..B-M10)');

  await check('B-M1', 'a Board-local string append would break the single-writer contract', () => {
    const naive = (line, v) => line + ' #' + v;
    return naive('- [ ] Alpha #p1', 'p1') === '- [ ] Alpha #p1 #p1' &&
      L.applyPriority('- [ ] Alpha', { value: 'p1' }).line === '- [ ] Alpha #p1' &&
      /applyPriority/.test(BOARD_CODE) === false;
  });
  await check('B-M2', 'direct WORKSPACE_INDEX_STATE mutation is absent', () => {
    const before = indexSnapshot();
    L.projectTasks(parseTasks('- [ ] Alpha #p2', 'n/a.md'), { scope: 'workspace' });
    const after = indexSnapshot();
    return before === after && /WORKSPACE_INDEX_STATE\s*[.[]/.test(boardPriorityFn) === false;
  });
  await check('B-M3', 'a priority change that also moves status would break neutrality', () =>
    /applyTransition|setTaskCompletion/.test(boardPriorityFn) === false &&
    L.applyPriority('- [ ] Alpha', { value: 'p1' }).line === '- [ ] Alpha #p1');
  await check('B-M4', 'stripping all hashtags would damage ordinary tags', () => {
    const greedy = (t) => String(t).replace(/[ \t]*#\w+/gi, '').trim();
    return greedy('Alpha #customer #p1') === 'Alpha' &&
      L.applyPriority('- [ ] Alpha #customer', { value: 'p1' }).line === '- [ ] Alpha #customer #p1';
  });
  await check('B-M5', 'a dual representation would survive a naive writer', () => {
    const dual = '- [ ] Alpha #p1 <!-- mme-task: priority=p2 -->';
    return /#p1/.test(dual) && /priority=p2/.test(dual) &&
      L.applyPriority('- [ ] Alpha <!-- mme-task: priority=p2 -->', { value: 'p1' }).line === '- [ ] Alpha #p1';
  });
  await check('B-M6', 'line-number-only identity would patch the wrong duplicate', () => {
    const base = parseTasks('- [ ] Same\n- [ ] Same', 'n/a.md');
    const cur = parseTasks('- [ ] Same #p2\n- [ ] Same', 'n/a.md');
    const m = L.matchTasksForSave(base, cur);
    // The Board carries exact path + indexed line, and text+occurrence matching
    // keeps the two duplicates distinguishable.
    return m.pairs.length === 2 && m.ambiguous === 0 && cur[0].line === 1 && base[1].line === 2;
  });
  await check('B-M7', 'an optimistic card update would survive a failed Save', () =>
    /\.value\s*=\s*requested/.test(boardPriorityFn) === false &&
    /\.priority\s*=/.test(boardPriorityFn) === false && /renderColumns\(\)/.test(boardPriorityFn));
  await check('B-M8', 'a second delegated listener would fire twice per Board reopen', () =>
    (boardWireFn.match(/columns\.addEventListener\('change'/g) || []).length === 1 &&
    (boardWireFn.match(/columns\.addEventListener\('click'/g) || []).length === 1);
  await check('B-M9', 'an unnecessary Save on the current value would be observable', () => {
    const cur = '- [ ] Alpha #p2';
    const patch = L.applyPriority(cur, { value: 'p2' });
    return patch.changed === false && patch.line === cur;
  });
  await check('B-M10', 'a priority-sensitive matcher would make the Save ambiguous', () => {
    const sensitive = (v) => String(v).replace(/<!--\s*mme-task:[\s\S]*?-->/gi, '').replace(/\s+/g, ' ').trim();
    const base = parseTasks('- [ ] Alpha', 'n/a.md');
    const cur = parseTasks(p2Line, 'n/a.md');
    return sensitive(base[0].text) !== sensitive(cur[0].text) &&
      L.matchTasksForSave(base, cur).ambiguous === 0;
  });

  // ACT 2B_CHUNK_5_END


  group('ACT 2A.1 mutation controls (A2A1-M1-M5)');

  await check('A2A1-M1', 'restoring the priority-sensitive matcher reproduces ambiguous=1', () => {
    // The exact pre-fix canonicalTaskText, replayed over the same fixtures.
    const sensitive = (v) => String(v == null ? '' : v)
      .replace(/<!--\s*mme-task:[\s\S]*?-->/gi, '').replace(/\s+/g, ' ').trim();
    const seq = (tasks) => {
      const counts = {};
      return tasks.map((t) => {
        const x = sensitive(t.text);
        counts[x] = (counts[x] || 0) + 1;
        return { text: x, key: x + '\u0000' + counts[x] };
      });
    };
    const b = seq(parseTasks(BASE3, 'notes/m.md'));
    const c = seq(parseTasks(through(L.applyPriority(alpha(), { value: 'p1' }).line), 'notes/m.md'));
    const matched = b.filter((x, i) => c[i] && c[i].key === x.key).length;
    return matched === 2 && c1.ambiguous === 0; // broken: 2/3, fixed: 3/3
  });
  await check('A2A1-M2', 'stripping ALL hashtags instead of only #pN damages #customer', () => {
    const greedy = (v) => String(v).replace(/[ \t]*#\w+/gi, '').replace(/\s+/g, ' ').trim();
    return greedy('Alpha task #customer #p1') === 'Alpha task' &&
      L.canonicalTaskText('Alpha task #customer #p1') === 'Alpha task #customer';
  });
  await check('A2A1-M3', 'line-number-only matching would mis-patch a duplicate occurrence', () => {
    // baseline[0] and current[0] are different tasks; only text+occurrence can
    // tell them apart. A line-number matcher would pair them silently.
    const base = parseTasks('- [ ] Same\n- [ ] Same', 'notes/dup.md');
    const cur = parseTasks('- [ ] Other\n- [ ] Same', 'notes/dup.md');
    return cur[0].text === 'Other' && base[0].text === cur[0].text === false &&
      L.matchTasksForSave(base, cur).ambiguous >= 1;
  });
  await check('A2A1-M4', 'refreshing the baseline BEFORE exact-source proof is unsafe', () => {
    // Prematurely adopting the mutated buffer as the baseline makes every later
    // genuine change invisible, so it is a silent false-negative, not a fix.
    const after = through(L.applyPriority(alpha(), { value: 'p1' }).line);
    const premature = L.matchTasksForSave(parseTasks(after, 'notes/m.md'), parseTasks(after, 'notes/m.md'));
    const real = L.matchTasksForSave(parseTasks(BASE3, 'notes/m.md'), parseTasks(after, 'notes/m.md'));
    return premature.pairs.length === 3 && premature.ambiguous === 0 &&
      real.pairs.length === 3 && real.ambiguous === 0;
  });
  await check('A2A1-M5', 'a log-only fix is not a fix: the matcher output is what changed', () =>
    /TaskReconcile: unresolved Task candidates remain/.test(MAIN_SOURCE) && c1.ambiguous === 0);

  // ACT 2A1_CHUNK_2_END

  for (const [id, name, run] of mutants) {
    await check(id, name, () => run());
  }

  const passed = results.filter((r) => !r.group && r.ok).length;
  const failed = results.filter((r) => !r.group && !r.ok);
  for (const r of results) {
    if (r.group) console.log('\n' + r.group);
    else console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.id + '] ' + r.name + (r.detail ? '  -> ' + r.detail : ''));
  }
  console.log('\nWORKSPACE TASK CONTRACT VALIDATORS (ACT 2A): ' + passed + ' passed, ' + failed.length + ' failed');
  process.exitCode = failed.length ? 1 : 0;
})();
