// @ts-nocheck
// Task Lifecycle Core (T1A) — pure Task lifecycle owner.
//
// Owns ONLY pure Task lifecycle responsibilities:
// - lifecycle status vocabulary (backlog | todo | ongoing | done);
// - checkbox-authoritative normalization;
// - lifecycle date-field parsing and validation (opened/started/completed);
// - canonical task-local `<!-- mme-task: ... -->` metadata serialization;
// - complete-line transitions (applyTransition) for the future Task Board;
// - deterministic validation fixtures.
//
// This module performs NO I/O of any kind:
// - no DOM access;
// - no Editor access;
// - no file, localStorage, fetch, Save, or Workspace Index access;
// - no Date/Time reads (no `new Date`, no `Date.now`, no UTC, no locale
//   formatting). The current application-local date is always supplied by the
//   caller as `today: 'YYYY-MM-DD'` — the single date-reading owner in the
//   application remains main.js getLocalIsoDate().
//
// Temporary T1A/T1B state (honest duplication note):
// main.js still owns its own isValidIsoDate()/getLocalIsoDate() for the legacy
// parser and physical Save. main.js does NOT yet consume this module. T1B must
// reconcile that duplication when parseMarkdownTasks adopts
// MME_TASK_LIFECYCLE. Until then, this module owns validation for the NEW
// lifecycle API only.
//
// Publication follows the established application pattern (ordered global
// scripts, no imports): one owner global — globalThis.MME_TASK_LIFECYCLE.
// No second lifecycle global is created.

(function () {
  'use strict';

  // ---- Status vocabulary ----

  const STATUS_VALUES = Object.freeze(['backlog', 'todo', 'ongoing', 'done']);
  const OPEN_STATUSES = Object.freeze(['todo', 'ongoing', 'backlog']);

  // Lifecycle-owned metadata keys. Lifecycle serialization may add, update, or
  // remove ONLY these keys; every other key (owner, priority, due, project,
  // custom/unknown) must survive round-trip unchanged in meaning.
  const LIFECYCLE_KEYS = Object.freeze(['status', 'opened', 'started', 'completed']);

  // Deterministic append order for lifecycle keys newly introduced to a
  // comment that did not previously carry them.
  const LIFECYCLE_APPEND_ORDER = Object.freeze(['status', 'opened', 'started', 'completed']);

  // ---- Date validation (pure arithmetic; no Date calls) ----

  function isLeapYear(year) {
    const y = Number(year);
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  }

  function daysInMonth(year, month) {
    if (month === 2) return isLeapYear(year) ? 29 : 28;
    if ([1, 3, 5, 7, 8, 10, 12].indexOf(month) !== -1) return 31;
    return 30;
  }

  // Same acceptance semantics as the legacy main.js isValidIsoDate():
  // strict YYYY-MM-DD, real calendar date, year bounded to 1900..2100.
  function isValidIsoDate(value) {
    const str = String(value == null ? '' : value).trim();
    if (!str) return false;
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return false;
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > daysInMonth(year, month)) return false;
    if (year < 1900 || year > 2100) return false;
    return true;
  }

  // ---- Task line parsing (single line; newline ownership stays outside) ----

  const COMMENT_RE = /(<!--\s*mme-task:)([\s\S]*?)(\s*-->)/i;

  function normalizeMetadataKey(key) {
    return String(key || '')
      .trim()
      .toLowerCase()
      .replace(/[-\s]+/g, '_');
  }

  // Parses one task list line. Returns null when the line is not a task.
  function parseTaskLine(rawLine) {
    const m = String(rawLine == null ? '' : rawLine).match(
      /^(\s*)([-*+])(\s+)(\[)([ xX])(\])(\s*)(.*)$/
    );
    if (!m) return null;
    return {
      indent: m[1],
      bullet: m[2],
      gap: m[3],
      open: m[4],
      marker: m[5],
      close: m[6],
      after: m[7],
      content: m[8],
    };
  }

  // Parses the mme-task comment inside task content into ordered entries.
  // Preserves original entry order and duplicate keys (value semantics: last
  // wins, matching the existing grammar). Malformed segments are preserved
  // verbatim as { key: null, rawSegment }.
  function parseCommentEntries(content) {
    const match = String(content || '').match(COMMENT_RE);
    if (!match) return { comment: null, entries: [] };
    const inner = String(match[2] || '').trim();
    const entries = [];
    if (inner) {
      const parts = inner.split(';');
      for (const part of parts) {
        const p = part.trim();
        if (!p) continue;
        const kv = p.match(/^([^=]+?)\s*=\s*(.*)$/);
        if (kv) {
          entries.push({
            key: normalizeMetadataKey(kv[1]),
            value: String(kv[2] == null ? '' : kv[2]).trim(),
          });
        } else {
          entries.push({ key: null, rawSegment: p });
        }
      }
    }
    return { comment: match, entries };
  }

  function metadataFromEntries(entries) {
    const metadata = {};
    for (const e of entries) {
      if (e && e.key) metadata[e.key] = e.value;
    }
    return metadata;
  }


  // ---- Canonical serialization ----

  // Serializes metadata into one canonical comment. Accepts an object
  // (key -> value) or an array of { key, value } / { key: null, rawSegment }
  // entries (order preserved). Returns null when there is nothing to write,
  // so callers can remove an emptied comment entirely (existing grammar).
  function buildTaskMetadataComment(metadata) {
    let entries;
    if (Array.isArray(metadata)) {
      entries = metadata;
    } else {
      entries = Object.keys(metadata || {}).map((k) => ({
        key: normalizeMetadataKey(k),
        value: String(metadata[k] == null ? '' : metadata[k]),
      }));
    }
    const segments = [];
    for (const e of entries) {
      if (!e) continue;
      if (e.key) segments.push(`${e.key}=${e.value}`);
      else if (e.rawSegment) segments.push(e.rawSegment);
    }
    if (segments.length === 0) return null;
    return `<!-- mme-task: ${segments.join('; ')} -->`;
  }

  // Applies lifecycle entry operations to ordered comment entries.
  // ops: { set: {key: value}, remove: [key, ...] }.
  // Existing lifecycle keys are updated in place (order preserved); new
  // lifecycle keys are appended deterministically at the end. Non-lifecycle
  // entries and malformed segments always survive.
  function applyEntryOps(entries, ops) {
    const set = ops && ops.set ? ops.set : {};
    const remove = ops && Array.isArray(ops.remove) ? ops.remove : [];
    const removeSet = {};
    for (const k of remove) removeSet[normalizeMetadataKey(k)] = true;

    const result = entries.map((e) => ({ ...e }));
    for (const key of Object.keys(set)) {
      const norm = normalizeMetadataKey(key);
      let found = false;
      for (const e of result) {
        if (e.key === norm) {
          e.value = String(set[key]);
          found = true;
          break;
        }
      }
      if (!found) {
        result.push({ key: norm, value: String(set[key]) });
      }
    }
    return result.filter((e) => !(e.key && removeSet[e.key]));
  }

  // Rebuilds task content with an updated comment. Returns the new content.
  // - existing comment: rewritten in place (never duplicated);
  // - emptied comment: removed entirely (existing grammar);
  // - no comment and something to write: one canonical comment appended.
  function rewriteContentComment(content, newEntries) {
    const str = String(content || '');
    const { comment } = parseCommentEntries(str);
    const newComment = buildTaskMetadataComment(newEntries);

    if (comment) {
      if (!newComment) {
        return str.replace(comment[0], '').replace(/\s+$/, '');
      }
      return (
        str.slice(0, comment.index) + newComment + str.slice(comment.index + comment[0].length)
      );
    }

    if (!newComment) return str;
    return str.replace(/\s+$/, '') + ' ' + newComment;
  }

  // ---- Normalization ----

  // Effective status from checkbox + raw status. CHECKBOX IS AUTHORITATIVE:
  // a checked task is done even if a stale open status survives in metadata.
  function effectiveStatusOf(done, rawStatus) {
    if (done) return 'done';
    const s = String(rawStatus || '')
      .trim()
      .toLowerCase();
    if (s === 'ongoing') return 'ongoing';
    if (s === 'backlog') return 'backlog';
    // 'todo', unknown, or absent -> Todo (todo requires no explicit status).
    return 'todo';
  }

  // Accepts source-compatible task information:
  // { done: boolean, metadata?: object, completedDate?: string, ... }.
  // Returns a NEW object (input is never mutated) adding:
  // status, effectiveStatus, openedDate, startedDate, completedDate,
  // closedDate. Existing fields are preserved. Invalid lifecycle dates
  // normalize to null for date consumers but remain in raw metadata.
  function normalizeTask(task) {
    const src = task || {};
    const metadata = src.metadata && typeof src.metadata === 'object' ? src.metadata : {};
    const done = Boolean(src.done);

    const rawStatus = String(metadata.status == null ? '' : metadata.status).trim();

    const openedSrc = metadata.opened;
    const startedSrc = metadata.started;
    const completedSrc =
      src.completedDate != null && isValidIsoDate(src.completedDate)
        ? src.completedDate
        : metadata.completed;

    const result = { ...src };

    result.status = rawStatus ? rawStatus.toLowerCase() : null;
    result.effectiveStatus = effectiveStatusOf(done, rawStatus);
    result.openedDate = isValidIsoDate(openedSrc) ? String(openedSrc).trim() : null;
    result.startedDate = isValidIsoDate(startedSrc) ? String(startedSrc).trim() : null;
    // Checkbox authority: an open task never keeps a stale completion date.
    result.completedDate =
      done && isValidIsoDate(completedSrc) ? String(completedSrc).trim() : null;
    // closedDate is the alias of validated completedDate (Closed Date).
    result.closedDate = result.completedDate;

    return result;
  }

  // ---- Transitions (future Task Board contract) ----

  // Transforms ONE complete task line: checkbox + task-local metadata together.
  // Pure: no Editor, no file, no Save, no Date. The current local date must be
  // supplied by the caller as options.today ('YYYY-MM-DD') whenever the
  // transition semantically writes a date; a missing/invalid today is rejected
  // without inventing a value.
  //
  // Returns { ok, changed, line, effectiveStatus, reason? }.
  function applyTransition(rawLine, options) {
    const opts = options || {};
    const target = String(opts.target || '')
      .trim()
      .toLowerCase();

    if (STATUS_VALUES.indexOf(target) === -1) {
      return { ok: false, changed: false, line: rawLine, reason: 'invalid-target' };
    }

    const source = rawLine != null && typeof rawLine === 'object' ? rawLine.raw : rawLine;
    if (typeof source !== 'string') {
      return { ok: false, changed: false, line: rawLine, reason: 'not-a-task-line' };
    }

    const parsed = parseTaskLine(source);
    if (!parsed) {
      return { ok: false, changed: false, line: rawLine, reason: 'not-a-task-line' };
    }

    const { entries } = parseCommentEntries(parsed.content);
    const metadata = metadataFromEntries(entries);
    const checked = parsed.marker.toLowerCase() === 'x';
    const current = effectiveStatusOf(checked, metadata.status);

    const ops = { set: {}, remove: [] };
    let needsToday = false;

    if (target === 'done') {
      // Never serialize status=done; drop any stale open status.
      ops.remove.push('status');
      if (!isValidIsoDate(metadata.completed)) {
        ops.set.completed = opts.today;
        needsToday = true;
      }
      // An existing completed date is preserved (never silently overwritten).
    } else {
      // All open targets keep the checkbox unchecked.
      ops.remove.push('completed'); // an open task never keeps a completion date
      if (target === 'todo') {
        ops.remove.push('status'); // todo-by-absence
      } else if (target === 'ongoing') {
        ops.set.status = 'ongoing';
        if (!isValidIsoDate(metadata.started)) {
          ops.set.started = opts.today;
          needsToday = true;
        }
        // started preserved when already present.
      } else if (target === 'backlog') {
        ops.set.status = 'backlog';
        // started preserved if already present.
      }
    }

    if (needsToday && !isValidIsoDate(opts.today)) {
      return {
        ok: false,
        changed: false,
        line: source,
        effectiveStatus: current,
        reason: 'invalid-today',
      };
    }

    const newEntries = applyEntryOps(entries, ops);
    const newContent = rewriteContentComment(parsed.content, newEntries);
    const newMarker = target === 'done' ? 'x' : ' ';
    const newLine =
      parsed.indent +
      parsed.bullet +
      parsed.gap +
      parsed.open +
      newMarker +
      parsed.close +
      parsed.after +
      newContent;

    // True idempotence: when the transformed line is byte-identical to the
    // source, report changed=false. This still allows canonical cleanup (e.g.
    // removing a redundant status=todo) on the first application, while any
    // repeated application becomes a strict no-op.
    if (newLine === source) {
      return { ok: true, changed: false, line: source, effectiveStatus: target };
    }

    return { ok: true, changed: true, line: newLine, effectiveStatus: target };
  }

// ---- T1B sequence matcher (deterministic; occurrence-aware; no stable ID) ----
  //
  // Physical-Save new-Task detection. Aligns the baseline Task sequence with
  // the current sequence using occurrence-aware canonical keys and ordered LCS
  // anchors. It only ever PROVES insertion of uniquely identifiable visible
  // text; everything else is classified as ambiguous.
  //
  // Explicit limitations (see architecture document):
  // - identical visible text has NO stable identity, so an inserted extra copy
  //   of an already-present label is ambiguous (never auto-Opened);
  // - a moved Task reads as an equal-count region and is ambiguous;
  // - a replaced block reads as an equal/mixed region and is ambiguous;
  // - large rewrites hit the safety cap and never mass-tag.
  //
  // Occurrence index is an ALIGNMENT AID ONLY, never stable identity: the Nth
  // current occurrence of identical text is NOT assumed to be the Nth baseline
  // occurrence. Proving that would require a stable Task ID (deferred).

  // Narrow safety cap for automatic Opened-date tagging.
  const MAX_SAFE_NEW_PER_GAP = 8;
  const MAX_SAFE_NEW_TOTAL = 16;
  const MAX_SAFE_INSERT_TOTAL = 20;

  function canonicalTaskText(value) {
    return String(value == null ? '' : value)
      .replace(/<!--\s*mme-task:[\s\S]*?-->/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Builds occurrence-aware sequence entries: { src, text, occ, key }.
  function buildMatchSeq(tasks) {
    const counts = {};
    return (tasks || []).map((t) => {
      const text = canonicalTaskText(t && t.text);
      counts[text] = (counts[text] || 0) + 1;
      return { src: t, text, occ: counts[text], key: text + '\u0000' + counts[text] };
    });
  }

  // Longest-common-subsequence alignment over occurrence-aware keys.
  // Returns matched pairs [{ baseline, current }] ordered by baseline then
  // current. Fixed backtrack rule keeps the result deterministic.
  function lcsAlign(b, c) {
    const n = b.length;
    const m = c.length;
    const dp = [];
    for (let i = 0; i <= n; i++) dp.push(new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] =
          b[i].key === c[j].key ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const pairs = [];
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (b[i].key === c[j].key) {
        pairs.push({ baseline: i, current: j });
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        i++;
      } else {
        j++;
      }
    }
    return pairs;
  }

  // Aligns baseline/current Task sequences and classifies regions.
  // Returns:
  //   pairs, newIndices, ambiguousIndices, ambiguous, deletedCount,
  //   insertedCount, skippedRewrite.
  function matchTasksForSave(baseline, current) {
    const b = buildMatchSeq(baseline);
    const c = buildMatchSeq(current);
    const pairs = lcsAlign(b, c);

    // A current insertion is only source-proven new when its visible text does
    // NOT already exist in the baseline: an added duplicate copy of an existing
    // label cannot be positionally proven (no stable ID) -> ambiguous.
    const baselineTextCounts = {};
    for (const t of baseline || []) {
      const text = canonicalTaskText(t && t.text);
      baselineTextCounts[text] = (baselineTextCounts[text] || 0) + 1;
    }

    let newIndices = [];
    const ambiguousIndices = [];
    let ambiguous = 0;
    let deletedCount = 0;
    let insertedCount = 0;
    let skippedRewrite = false;

    let prevB = -1;
    let prevC = -1;
    const regions = [];
    for (const p of pairs) {
      regions.push({ bFrom: prevB + 1, bTo: p.baseline, cFrom: prevC + 1, cTo: p.current });
      prevB = p.baseline;
      prevC = p.current;
    }
    regions.push({ bFrom: prevB + 1, bTo: b.length, cFrom: prevC + 1, cTo: c.length });

    for (const r of regions) {
      const bDel = r.bTo - r.bFrom;
      const cIns = r.cTo - r.cFrom;
      deletedCount += bDel;
      insertedCount += cIns;

      if (cIns > 0 && bDel === 0) {
        // Pure insertion region: candidate new current Tasks.
        const candidates = [];
        for (let j = r.cFrom; j < r.cTo; j++) {
          const text = c[j].text;
          if (baselineTextCounts[text] > 0) {
            ambiguousIndices.push(j);
            ambiguous++;
          } else {
            candidates.push(j);
          }
        }
        if (candidates.length > MAX_SAFE_NEW_PER_GAP) {
          // Per-gap cap engaged: fold candidates to ambiguous, no tagging.
          skippedRewrite = true;
          ambiguous += candidates.length;
          for (const idx of candidates) ambiguousIndices.push(idx);
        } else {
          newIndices = newIndices.concat(candidates);
        }
      } else if (cIns === 0 && bDel === 0) {
        // Fully matched region: nothing to do.
      } else {
        // Deletion-only, edit/replace, or mixed -> ambiguous.
        ambiguous += Math.max(cIns, bDel);
        for (let j = r.cFrom; j < r.cTo; j++) ambiguousIndices.push(j);
      }
    }

    // Whole-document / total-new caps: skip automatic new-tagging entirely.
    if (insertedCount > MAX_SAFE_INSERT_TOTAL || newIndices.length > MAX_SAFE_NEW_TOTAL) {
      skippedRewrite = true;
    }
    if (skippedRewrite && newIndices.length) {
      ambiguous += newIndices.length;
      for (const idx of newIndices) ambiguousIndices.push(idx);
      newIndices = [];
    }

    return {
      pairs,
      newIndices,
      ambiguousIndices,
      ambiguous,
      deletedCount,
      insertedCount,
      skippedRewrite,
    };
  }
// ---- T1B save-lifecycle metadata writer (pure; checkbox never rewritten) ----
  //
  // Edits ONLY the task-local `mme-task` comment during physical-Save
  // reconciliation. The observed checkbox is authoritative and read from the
  // source line; the checkbox marker is never changed here. All non-lifecycle
  // metadata and unknown raw statuses survive round-trip. Invalid raw lifecycle
  // values are preserved as written (not silently overwritten).
  //
  // opts:
  //   { today, isNew, checked, explicitStatus }
  //     today           'YYYY-MM-DD' current local date (single owner main.js)
  //     isNew           source-proven new Task (may receive opened)
  //     checked         current checkbox authority state
  //     explicitStatus  normalized raw status value or null/'' (unknown kept)
  //
  // Returns { ok, changed, line, added:{opened,started,completed},
  //           removed:{completed,status}, reason? }.
  function applySaveLifecycle(rawLine, opts) {
    const o = opts || {};
    const today = o.today;
    const isNew = Boolean(o.isNew);
    const checked = Boolean(o.checked);
    const status = String(o.explicitStatus == null ? '' : o.explicitStatus)
      .trim()
      .toLowerCase() || null;

    const source = typeof rawLine === 'string' ? rawLine : (rawLine && rawLine.raw) || '';
    const parsed = parseTaskLine(source);
    if (!parsed) {
      return { ok: false, changed: false, line: source, reason: 'not-a-task-line' };
    }

    const { entries } = parseCommentEntries(parsed.content);
    const before = metadataFromEntries(entries);
    const ops = { set: {}, remove: [] };
    const needToday = [];

    // Date writes follow "add only if ABSENT" so valid hand-written dates and
    // invalid raw values are never silently overwritten or deleted.
    const absentOpened = before.opened == null || !String(before.opened).trim();
    const absentCompleted = before.completed == null || !String(before.completed).trim();
    const absentStarted = before.started == null || !String(before.started).trim();

    if (isNew && absentOpened) {
      ops.set.opened = today;
      needToday.push('opened');
    }

    if (checked) {
      // Effective Done: ensure a closed date; never status=done.
      if (absentCompleted) {
        ops.set.completed = today;
        needToday.push('completed');
      }
      // Remove a recognized stale open status only (backlog/ongoing/todo).
      // Unknown status values are preserved.
      if (OPEN_STATUSES.indexOf(status) !== -1) ops.remove.push('status');
    } else {
      // Effective open.
      ops.remove.push('completed');
      if (status === 'ongoing') {
        ops.set.status = 'ongoing';
        if (absentStarted) {
          ops.set.started = today;
          needToday.push('started');
        }
      } else if (status === 'backlog') {
        ops.set.status = 'backlog';
      }
      // todo/absent/unknown: status untouched (todo by absence).
    }

    if (needToday.length && !isValidIsoDate(today)) {
      return { ok: false, changed: false, line: source, reason: 'invalid-today' };
    }

    const newEntries = applyEntryOps(entries, ops);
    const newContent = rewriteContentComment(parsed.content, newEntries);
    const newLine =
      parsed.indent +
      parsed.bullet +
      parsed.gap +
      parsed.open +
      parsed.marker +
      parsed.close +
      parsed.after +
      newContent;

    const after = metadataFromEntries(newEntries);
    const added = {
      opened: !isValidIsoDate(before.opened) && isValidIsoDate(after.opened),
      started: !isValidIsoDate(before.started) && isValidIsoDate(after.started),
      completed: !isValidIsoDate(before.completed) && isValidIsoDate(after.completed),
    };
    const removed = {
      completed: isValidIsoDate(before.completed) && !isValidIsoDate(after.completed),
      status: before.status != null && after.status == null,
    };

    if (newLine === source) {
      return { ok: true, changed: false, line: source, added, removed };
    }
    return { ok: true, changed: true, line: newLine, added, removed };
  }
  // ---- Validator (deterministic; explicit today values; no clock) ----

  function validate() {
    const results = [];
    let passed = 0;
    let failed = 0;

    function check(label, cond, detail) {
      results.push({ label, pass: Boolean(cond), detail: cond ? null : detail });
      if (cond) passed++;
      else failed++;
    }

    const T = '2026-09-01';

    // ---------- NORMALIZATION ----------
    let t = normalizeTask({ done: false, metadata: {} });
    check(
      'N1 legacy unchecked no metadata -> Todo',
      t.effectiveStatus === 'todo' && t.status === null && t.closedDate === null,
      JSON.stringify(t)
    );

    t = normalizeTask({ done: true, metadata: {} });
    check(
      'N2 legacy checked no metadata -> Done, closedDate null',
      t.effectiveStatus === 'done' && t.completedDate === null && t.closedDate === null,
      JSON.stringify(t)
    );

    t = normalizeTask({ done: false, metadata: { status: 'backlog' } });
    check('N3 unchecked status=backlog -> Backlog', t.effectiveStatus === 'backlog', JSON.stringify(t));

    t = normalizeTask({ done: false, metadata: { status: 'ongoing' } });
    check('N4 unchecked status=ongoing -> Ongoing', t.effectiveStatus === 'ongoing', JSON.stringify(t));

    t = normalizeTask({ done: true, metadata: { status: 'ongoing', completed: '2026-08-05' } });
    check(
      'N5 checked stale status=ongoing -> Done (checkbox authority)',
      t.effectiveStatus === 'done' && t.completedDate === '2026-08-05',
      JSON.stringify(t)
    );

    t = normalizeTask({ done: false, metadata: { status: 'todo' } });
    check('N6 explicit status=todo -> effective Todo', t.effectiveStatus === 'todo', JSON.stringify(t));

    t = normalizeTask({ done: false, metadata: { status: 'weird-value' } });
    check(
      'N7 unknown status -> effective Todo, raw metadata survives',
      t.effectiveStatus === 'todo' && t.metadata && t.metadata.status === 'weird-value',
      JSON.stringify(t)
    );

    // ---------- DATES ----------
    t = normalizeTask({ done: false, metadata: { opened: '2026-08-01' } });
    check('D8 valid opened -> openedDate', t.openedDate === '2026-08-01', JSON.stringify(t));

    t = normalizeTask({ done: false, metadata: { started: '2026-08-02' } });
    check('D9 valid started -> startedDate', t.startedDate === '2026-08-02', JSON.stringify(t));

    t = normalizeTask({ done: true, metadata: { completed: '2026-08-03' } });
    check(
      'D10 valid completed -> completedDate and closedDate alias',
      t.completedDate === '2026-08-03' && t.closedDate === '2026-08-03',
      JSON.stringify(t)
    );

    t = normalizeTask({ done: true, metadata: { completed: '2026-02-30' } });
    check(
      'D11 impossible calendar date -> normalized null, raw preserved',
      t.completedDate === null && t.closedDate === null && t.metadata.completed === '2026-02-30',
      JSON.stringify(t)
    );

    t = normalizeTask({ done: true, metadata: { completed: '2020-02-29' } });
    check('D11b leap-year date accepted', t.completedDate === '2020-02-29', JSON.stringify(t));

    t = normalizeTask({ done: true, metadata: { completed: '1999-12-31' } });
    check(
      'D12 existing historical completed preserved',
      t.completedDate === '1999-12-31',
      JSON.stringify(t)
    );

    let r = applyTransition('- [ ] A', { target: 'done' });
    check(
      'D13a missing today rejected for date-writing transition',
      r.ok === false && r.reason === 'invalid-today' && r.line === '- [ ] A',
      JSON.stringify(r)
    );
    r = applyTransition('- [ ] A', { target: 'ongoing', today: '2026-02-30' });
    check(
      'D13b invalid today rejected (impossible date)',
      r.ok === false && r.reason === 'invalid-today' && r.line === '- [ ] A',
      JSON.stringify(r)
    );
    r = applyTransition('- [ ] A', { target: 'todo' });
    check(
      'D13c no-date transition does not require today',
      r.ok === true && r.changed === false && r.effectiveStatus === 'todo',
      JSON.stringify(r)
    );

    // ---------- CANONICAL SERIALIZATION ----------
    r = applyTransition('- [ ] A <!-- mme-task: status=todo -->', { target: 'todo', today: T });
    check(
      'S14 todo removes redundant status (todo-by-absence)',
      r.ok === true && r.line === '- [ ] A' && !/mme-task/.test(r.line),
      JSON.stringify(r)
    );

    r = applyTransition('- [ ] A', { target: 'backlog', today: T });
    check(
      'S15 backlog writes status=backlog only',
      r.ok === true && r.line === '- [ ] A <!-- mme-task: status=backlog -->',
      JSON.stringify(r)
    );

    r = applyTransition('- [ ] A', { target: 'ongoing', today: T });
    check(
      'S16 ongoing writes status=ongoing + started',
      r.ok === true &&
        r.line === '- [ ] A <!-- mme-task: status=ongoing; started=2026-09-01 -->',
      JSON.stringify(r)
    );

    r = applyTransition('- [ ] A', { target: 'done', today: T });
    check(
      'S17 done writes checked box + completed only',
      r.ok === true && r.line === '- [x] A <!-- mme-task: completed=2026-09-01 -->',
      JSON.stringify(r)
    );

    r = applyTransition('- [ ] A <!-- mme-task: status=ongoing; started=2026-08-01 -->', {
      target: 'done',
      today: T,
    });
    check(
      'S18 done removes stale open status',
      r.ok === true &&
        r.line === '- [x] A <!-- mme-task: started=2026-08-01; completed=2026-09-01 -->' &&
        !/status=/.test(r.line),
      JSON.stringify(r)
    );

    r = applyTransition('- [ ] A <!-- mme-task: owner=adelson; due=2026-09-10 -->', {
      target: 'backlog',
      today: T,
    });
    check(
      'S19 unknown metadata survives',
      r.ok === true &&
        r.line === '- [ ] A <!-- mme-task: owner=adelson; due=2026-09-10; status=backlog -->',
      JSON.stringify(r)
    );

    r = applyTransition('- [ ] A <!-- mme-task: status=todo -->', { target: 'ongoing', today: T });
    check(
      'S20 no duplicate mme-task comment',
      r.ok === true && (r.line.match(/mme-task:/gi) || []).length === 1,
      JSON.stringify(r)
    );

    r = applyTransition('- [ ] A <!-- mme-task: owner=adelson -->', { target: 'done', today: T });
    check(
      'S21 non-lifecycle key value survives',
      r.ok === true && /owner=adelson/.test(r.line) && /completed=2026-09-01/.test(r.line),
      JSON.stringify(r)
    );

    r = applyTransition('- [ ] A <!-- mme-task: opened=2026-08-01; started=2026-08-02 -->', {
      target: 'done',
      today: T,
    });
    check(
      'S22 existing opened/started not overwritten',
      r.ok === true &&
        /opened=2026-08-01/.test(r.line) &&
        /started=2026-08-02/.test(r.line) &&
        /completed=2026-09-01/.test(r.line),
      JSON.stringify(r)
    );

    r = applyTransition('- [ ] A <!-- mme-task: completed=2026-08-15 -->', {
      target: 'done',
      today: T,
    });
    check(
      'S22b existing completed preserved on Done (checkbox checked, date kept)',
      r.ok === true &&
        r.changed === true &&
        r.line === '- [x] A <!-- mme-task: completed=2026-08-15 -->' &&
        r.line.indexOf('2026-08-15') !== -1 &&
        r.line.indexOf('2026-09-01') === -1,
      JSON.stringify(r)
    );

    // ---------- TRANSITIONS ----------
    r = applyTransition('- [ ] A <!-- mme-task: opened=2026-08-01 -->', { target: 'ongoing', today: T });
    check(
      'T23 Todo -> Ongoing',
      r.ok === true &&
        r.line ===
          '- [ ] A <!-- mme-task: opened=2026-08-01; status=ongoing; started=2026-09-01 -->',
      JSON.stringify(r)
    );

    r = applyTransition('- [ ] A <!-- mme-task: opened=2026-08-01 -->', { target: 'backlog', today: T });
    check(
      'T24 Todo -> Backlog (opened preserved, no started)',
      r.ok === true &&
        r.line === '- [ ] A <!-- mme-task: opened=2026-08-01; status=backlog -->',
      JSON.stringify(r)
    );

    r = applyTransition('- [ ] A <!-- mme-task: opened=2026-08-01 -->', { target: 'done', today: T });
    check(
      'T25 Todo -> Done (checkbox checked, opened preserved)',
      r.ok === true &&
        r.line === '- [x] A <!-- mme-task: opened=2026-08-01; completed=2026-09-01 -->',
      JSON.stringify(r)
    );

    r = applyTransition(
      '- [ ] A <!-- mme-task: status=ongoing; started=2026-08-02; opened=2026-08-01 -->',
      { target: 'todo', today: T }
    );
    check(
      'T26 Ongoing -> Todo (status removed, started preserved)',
      r.ok === true && r.line === '- [ ] A <!-- mme-task: started=2026-08-02; opened=2026-08-01 -->',
      JSON.stringify(r)
    );

    r = applyTransition('- [ ] A <!-- mme-task: status=ongoing; started=2026-08-02 -->', {
      target: 'backlog',
      today: T,
    });
    check(
      'T27 Ongoing -> Backlog (started preserved)',
      r.ok === true &&
        r.line === '- [ ] A <!-- mme-task: status=backlog; started=2026-08-02 -->',
      JSON.stringify(r)
    );

    r = applyTransition('- [ ] A <!-- mme-task: status=ongoing; started=2026-08-02 -->', {
      target: 'done',
      today: T,
    });
    check(
      'T28 Ongoing -> Done (status removed, started preserved, completed added)',
      r.ok === true &&
        r.line === '- [x] A <!-- mme-task: started=2026-08-02; completed=2026-09-01 -->',
      JSON.stringify(r)
    );

    r = applyTransition('- [ ] A <!-- mme-task: status=backlog; opened=2026-08-01 -->', {
      target: 'todo',
      today: T,
    });
    check(
      'T29 Backlog -> Todo (status removed, opened preserved)',
      r.ok === true && r.line === '- [ ] A <!-- mme-task: opened=2026-08-01 -->',
      JSON.stringify(r)
    );

    r = applyTransition('- [ ] A <!-- mme-task: status=backlog; opened=2026-08-01 -->', {
      target: 'ongoing',
      today: T,
    });
    check(
      'T30 Backlog -> Ongoing (started created)',
      r.ok === true &&
        r.line ===
          '- [ ] A <!-- mme-task: status=ongoing; opened=2026-08-01; started=2026-09-01 -->',
      JSON.stringify(r)
    );

    r = applyTransition('- [ ] A <!-- mme-task: status=backlog -->', { target: 'done', today: T });
    check(
      'T31 Backlog -> Done',
      r.ok === true && r.line === '- [x] A <!-- mme-task: completed=2026-09-01 -->',
      JSON.stringify(r)
    );

    r = applyTransition(
      '- [x] A <!-- mme-task: completed=2026-08-05; opened=2026-08-01; started=2026-08-02 -->',
      { target: 'todo', today: T }
    );
    check(
      'T32 Done -> Todo (completed removed, opened/started preserved)',
      r.ok === true &&
        r.line === '- [ ] A <!-- mme-task: opened=2026-08-01; started=2026-08-02 -->' &&
        !/completed=/.test(r.line),
      JSON.stringify(r)
    );

    r = applyTransition('- [x] A <!-- mme-task: completed=2026-08-05; started=2026-08-02 -->', {
      target: 'ongoing',
      today: T,
    });
    check(
      'T33 Done -> Ongoing (completed removed, started preserved)',
      r.ok === true && r.line === '- [ ] A <!-- mme-task: started=2026-08-02; status=ongoing -->',
      JSON.stringify(r)
    );

    r = applyTransition('- [x] A <!-- mme-task: completed=2026-08-05 -->', {
      target: 'ongoing',
      today: T,
    });
    check(
      'T33b Done -> Ongoing creates started when absent',
      r.ok === true &&
        r.line === '- [ ] A <!-- mme-task: status=ongoing; started=2026-09-01 -->',
      JSON.stringify(r)
    );

    r = applyTransition('- [x] A <!-- mme-task: completed=2026-08-05; opened=2026-08-01 -->', {
      target: 'backlog',
      today: T,
    });
    check(
      'T34 Done -> Backlog (completed removed, opened preserved)',
      r.ok === true &&
        r.line === '- [ ] A <!-- mme-task: opened=2026-08-01; status=backlog -->',
      JSON.stringify(r)
    );
// Idempotence (35): same-state transitions on all four states.
    const idemInputs = [
      '- [ ] A',
      '- [ ] A <!-- mme-task: status=backlog -->',
      '- [ ] A <!-- mme-task: status=ongoing; started=2026-08-01 -->',
      '- [x] A <!-- mme-task: completed=2026-08-01 -->',
    ];
    const idemTargets = ['todo', 'backlog', 'ongoing', 'done'];
    let idemOk = true;
    let idemDetail = '';
    for (const input of idemInputs) {
      for (const target of idemTargets) {
        const first = applyTransition(input, { target, today: T });
        const second = applyTransition(first.line, { target, today: T });
        if (
          !first.ok ||
          second.changed !== false ||
          second.line !== first.line ||
          second.effectiveStatus !== first.effectiveStatus
        ) {
          idemOk = false;
          idemDetail =
            `${input} -> ${target}: first=${JSON.stringify(first)} ` +
            `second=${JSON.stringify(second)}`;
        }
      }
    }
    check('T35 same-state transition idempotence', idemOk, idemDetail);

    // ---------- LINE PRESERVATION ----------
    r = applyTransition('  - [ ] Indented task <!-- mme-task: owner=x -->', {
      target: 'done',
      today: T,
    });
    check(
      'L36 indentation preserved',
      r.ok === true && r.line.startsWith('  - [x] Indented task'),
      JSON.stringify(r)
    );

    r = applyTransition('* [ ] Star bullet task', { target: 'done', today: T });
    check(
      'L37 bullet marker preserved',
      r.ok === true && r.line.startsWith('* [x] Star bullet task'),
      JSON.stringify(r)
    );

    r = applyTransition('- [ ] Visible text here <!-- mme-task: owner=x -->', {
      target: 'backlog',
      today: T,
    });
    check(
      'L38 visible text preserved',
      r.ok === true && r.line.indexOf('Visible text here') !== -1,
      JSON.stringify(r)
    );

    r = applyTransition('- [ ] Task <!-- mme-task: owner=adelson; project=alpha; custom_thing=7 -->', {
      target: 'done',
      today: T,
    });
    check(
      'L39 unknown trailing metadata preserved',
      r.ok === true &&
        /owner=adelson/.test(r.line) &&
        /project=alpha/.test(r.line) &&
        /custom_thing=7/.test(r.line),
      JSON.stringify(r)
    );

    const dup = normalizeTask({
      done: true,
      metadata: (() => {
        const { entries } = parseCommentEntries(
          'A <!-- mme-task: completed=2026-08-01; completed=2026-08-02 -->'
        );
        return metadataFromEntries(entries);
      })(),
    });
    check(
      'L40 duplicate keys follow existing grammar (last wins)',
      dup.completedDate === '2026-08-02',
      JSON.stringify(dup)
    );

    r = applyTransition('Just a plain line', { target: 'todo', today: T });
    check(
      'L41 non-task line rejected without change',
      r.ok === false && r.reason === 'not-a-task-line' && r.line === 'Just a plain line',
      JSON.stringify(r)
    );

    r = applyTransition('- [ ] A <!-- other-comment: kept -->', { target: 'backlog', today: T });
    check(
      'L42 unrelated comment preserved, single mme-task comment',
      r.ok === true &&
        /other-comment: kept/.test(r.line) &&
        (r.line.match(/mme-task:/gi) || []).length === 1,
      JSON.stringify(r)
    );

    // ---------- T1B SEQUENCE MATCHER (pure) ----------
    const bas = (arr) => arr.map((text) => ({ text, done: false, line: 0 }));
    const basDone = (arr, done) => arr.map((text) => ({ text, done, line: 0 }));

    // append unique -> new proven
    let m = matchTasksForSave(bas(['A', 'B']), bas(['A', 'B', 'NEW']));
    check(
      'M1 append unique -> new proven',
      m.newIndices.length === 1 && m.newIndices[0] === 2 && m.ambiguous === 0,
      JSON.stringify({ n: m.newIndices.length, a: m.ambiguous })
    );

    // prepend unique -> new proven
    m = matchTasksForSave(bas(['A', 'B']), bas(['NEW', 'A', 'B']));
    check(
      'M2 prepend unique -> new proven',
      m.newIndices.length === 1 && m.newIndices[0] === 0,
      JSON.stringify({ n: m.newIndices.length })
    );

    // middle insertion unique -> new proven
    m = matchTasksForSave(bas(['A', 'B', 'C']), bas(['A', 'NEW', 'B', 'C']));
    check(
      'M3 middle unique -> new proven',
      m.newIndices.length === 1 && m.newIndices[0] === 1,
      JSON.stringify({ n: m.newIndices.length })
    );

    // moved unique task -> ambiguous, no new opened
    m = matchTasksForSave(bas(['A', 'B', 'C']), bas(['B', 'A', 'C']));
    check(
      'M4 moved task -> ambiguous, not new',
      m.newIndices.length === 0 && m.ambiguous > 0,
      JSON.stringify({ n: m.newIndices.length, a: m.ambiguous })
    );

    // edited task -> ambiguous, no new opened
    m = matchTasksForSave(bas(['A', 'B']), bas(['A edited', 'B']));
    check(
      'M5 edited task -> ambiguous, not new',
      m.newIndices.length === 0 && m.ambiguous > 0,
      JSON.stringify({ n: m.newIndices.length, a: m.ambiguous })
    );

    // replacement block -> ambiguous, no new opened
    m = matchTasksForSave(bas(['A', 'B', 'C']), bas(['X', 'Y', 'Z']));
    check(
      'M6 replacement block -> ambiguous, not new',
      m.newIndices.length === 0 && m.ambiguous > 0,
      JSON.stringify({ n: m.newIndices.length, a: m.ambiguous })
    );

    // unchanged duplicate tasks -> matched, no new
    m = matchTasksForSave(bas(['A', 'A']), bas(['A', 'A']));
    check(
      'M7 unchanged duplicates -> matched, no new',
      m.newIndices.length === 0 && m.pairs.length === 2 && m.ambiguous === 0,
      JSON.stringify({ n: m.newIndices.length, p: m.pairs.length, a: m.ambiguous })
    );

    // extra identical copy of a duplicated label -> ambiguous (no stable ID)
    m = matchTasksForSave(bas(['A', 'A']), bas(['A', 'A', 'A']));
    check(
      'M8 duplicate inserted -> ambiguous, not new',
      m.newIndices.length === 0 && m.ambiguous > 0,
      JSON.stringify({ n: m.newIndices.length, a: m.ambiguous })
    );

    // duplicate run with one distinct inserted label -> one new, duplicates matched
    m = matchTasksForSave(
      basDone(['A', 'A'], true),
      basDone(['A', 'NEW', 'A'], true)
    );
    check(
      'M9 duplicate run + distinct label -> one new proven',
      m.newIndices.length === 1 && m.newIndices[0] === 1 && m.pairs.length === 2,
      JSON.stringify({ n: m.newIndices.length, p: m.pairs.length })
    );

    // moved duplicate region -> ambiguous, no new opened
    m = matchTasksForSave(bas(['A', 'A', 'B']), bas(['B', 'A', 'A']));
    check(
      'M10 moved duplicate region -> ambiguous, not new',
      m.newIndices.length === 0 && m.ambiguous > 0,
      JSON.stringify({ n: m.newIndices.length, a: m.ambiguous })
    );

    // duplicate with differing metadata still aligned by visible text
    m = matchTasksForSave(
      [{ text: 'A', done: true, openedDate: '2026-08-01' }, { text: 'A', done: false }],
      [{ text: 'A', done: true, openedDate: '2026-08-01' }, { text: 'A', done: false }]
    );
    check(
      'M11 duplicate metadata-bearing -> aligned matched pairs',
      m.pairs.length === 2 && m.newIndices.length === 0,
      JSON.stringify({ p: m.pairs.length, n: m.newIndices.length })
    );

    // large rewrite safety cap
    const bigBase = [];
    const bigCur = [];
    for (let k = 0; k < 6; k++) bigBase.push('T' + k);
    for (let k = 6; k <= 30; k++) bigCur.push('Tk' + k);
    m = matchTasksForSave(bas(bigBase), bas(bigCur));
    check(
      'M12 large rewrite -> skippedRewrite, no new tagging',
      m.skippedRewrite === true && m.newIndices.length === 0,
      JSON.stringify({ skippedRewrite: m.skippedRewrite, n: m.newIndices.length })
    );


    // ---------- T1B SAVE-LIFECYCLE WRITER (pure) ----------
    const Y = '2026-09-01';

    // new Todo: opened once, no status
    r = applySaveLifecycle('- [ ] A', { today: Y, isNew: true, checked: false, explicitStatus: null });
    check(
      'S1 new Todo opened once',
      r.ok && r.changed && /opened=2026-09-01/.test(r.line) && !/status=/.test(r.line),
      r.line
    );

    // new Backlog: opened + status=backlog kept, no started
    r = applySaveLifecycle('- [ ] A <!-- mme-task: status=backlog -->', { today: Y, isNew: true, checked: false, explicitStatus: 'backlog' });
    check(
      'S2 new Backlog opened + status kept, no started',
      r.ok && r.changed && /opened=2026-09-01/.test(r.line) && /status=backlog/.test(r.line) && !/started=/.test(r.line),
      r.line
    );

    // new Ongoing: opened + started + status=ongoing
    r = applySaveLifecycle('- [ ] A <!-- mme-task: status=ongoing -->', { today: Y, isNew: true, checked: false, explicitStatus: 'ongoing' });
    check(
      'S3 new Ongoing opened + started',
      r.ok && r.changed && /opened=2026-09-01/.test(r.line) && /started=2026-09-01/.test(r.line) && /status=ongoing/.test(r.line),
      r.line
    );

    // new Done: opened + completed, no status=done
    r = applySaveLifecycle('- [x] A', { today: Y, isNew: true, checked: true, explicitStatus: null });
    check(
      'S4 new Done opened + completed, no status',
      r.ok && r.changed && /opened=2026-09-01/.test(r.line) && /completed=2026-09-01/.test(r.line) && !/status=/.test(r.line),
      r.line
    );

    // legacy completion: completed only, no opened backfill
    r = applySaveLifecycle('- [ ] A', { today: Y, isNew: false, checked: true, explicitStatus: null });
    check(
      'S5 legacy completion completed only, no opened',
      r.ok && r.changed && /completed=2026-09-01/.test(r.line) && !/opened=/.test(r.line),
      r.line
    );

        // done -> todo reopen: completed removed, opened preserved
    r = applySaveLifecycle('- [ ] A <!-- mme-task: completed=2026-08-01; opened=2026-08-02 -->', { today: Y, isNew: false, checked: false, explicitStatus: null });
    check(
      'S6 reopen to todo removes completed, preserves opened',
      r.ok && r.changed && !/completed=/.test(r.line) && /opened=2026-08-02/.test(r.line),
      r.line
    );

    // done -> ongoing reopen with explicit ongoing: keeps status + adds started if missing
    r = applySaveLifecycle('- [ ] A <!-- mme-task: completed=2026-08-01; status=ongoing -->', { today: Y, isNew: false, checked: false, explicitStatus: 'ongoing' });
    check(
      'S7 reopen to ongoing keeps status + adds started if missing',
      r.ok && r.changed && /status=ongoing/.test(r.line) && /started=2026-09-01/.test(r.line) && !/completed=/.test(r.line),
      r.line
    );

    // done -> backlog reopen: keeps status, no started added
    r = applySaveLifecycle('- [ ] A <!-- mme-task: completed=2026-08-01; status=backlog -->', { today: Y, isNew: false, checked: false, explicitStatus: 'backlog' });
    check(
      'S8 reopen to backlog keeps status, no started',
      r.ok && r.changed && /status=backlog/.test(r.line) && !/started=/.test(r.line) && !/completed=/.test(r.line),
      r.line
    );
    // unknown metadata preserved on a new task
    r = applySaveLifecycle('- [ ] A <!-- mme-task: owner=adelson; unknown=7 -->', { today: Y, isNew: true, checked: false, explicitStatus: null });
    check(
      'S9 unknown metadata preserved on new task',
      r.ok && r.changed && /owner=adelson/.test(r.line) && /unknown=7/.test(r.line),
      r.line
    );

    // invalid raw opened preserved (not backfilled) on a legacy completion
    r = applySaveLifecycle('- [ ] A <!-- mme-task: opened=2026-13-01 -->', { today: Y, isNew: false, checked: true, explicitStatus: null });
    check(
      'S10 invalid raw opened preserved on completion',
      r.ok && r.changed && /opened=2026-13-01/.test(r.line) && (r.line.match(/opened=2026-09-01/g) || []).length === 0,
      r.line
    );

    // idempotence / retry: re-running the writer is a no-op
    const one = applySaveLifecycle('- [ ] A', { today: Y, isNew: true, checked: false, explicitStatus: null });
    const two = applySaveLifecycle(one.line, { today: Y, isNew: true, checked: false, explicitStatus: null });
    check(
      'S11 idempotent re-application -> no repeat write / no duplicate comment',
      one.changed === true && two.changed === false && (two.line.match(/mme-task:/g) || []).length <= 1,
      JSON.stringify({ one: one.line, two: two.line })
    );

    // ---------- ACT B COMPOSITION: newIndices -> applySaveLifecycle(isNew:true) ----------
    // Exercises the exact composition used by reconcileTasksBeforeSave():
    // matcher classification feeds the save writer; the writer stays the only
    // metadata author.
    const DC = '2026-09-01';

    // C1 unique middle insertion: only the inserted task receives opened
    const midCur = ['A', 'NEW-MID', 'C'];
    const mMid = matchTasksForSave(bas(['A', 'C']), bas(midCur));
    let c1Ok = mMid.newIndices.length === 1 && mMid.ambiguous === 0;
    if (c1Ok) {
      const curText = midCur[mMid.newIndices[0]];
      const rc = applySaveLifecycle('- [ ] ' + curText, { today: DC, isNew: true, checked: false, explicitStatus: null });
      c1Ok = rc.ok && rc.changed && /opened=2026-09-01/.test(rc.line) && !/status=/.test(rc.line);
    }
    check(
      'C1 composition: unique middle insertion -> opened added to new task only',
      c1Ok,
      JSON.stringify({ n: mMid.newIndices.length, a: mMid.ambiguous })
    );

    // C2 duplicate insertion stays ambiguous: nothing receives opened
    const mDup = matchTasksForSave(bas(['A']), bas(['A', 'A']));
    check(
      'C2 composition: duplicate insertion -> newIndices empty, ambiguous counted',
      mDup.newIndices.length === 0 && mDup.ambiguousIndices.length === 1 && mDup.ambiguous === 1,
      JSON.stringify({ n: mDup.newIndices.length, a: mDup.ambiguous })
    );

    // C3 existing valid opened on a new task is preserved; opened not re-added
    const rC3 = applySaveLifecycle('- [ ] NEW <!-- mme-task: opened=2026-08-15 -->', { today: DC, isNew: true, checked: false, explicitStatus: null });
    check(
      'C3 composition: existing valid opened preserved, added.opened false',
      rC3.ok && /opened=2026-08-15/.test(rC3.line) && rC3.added && rC3.added.opened === false,
      rC3.line
    );

    // C4 new checked task composition: opened + completed, never status=done
    const mIns = matchTasksForSave(bas(['A']), bas(['A', 'NEW-DONE']));
    let c4Ok = mIns.newIndices.length === 1;
    if (c4Ok) {
      const rc4 = applySaveLifecycle('- [x] NEW-DONE', { today: DC, isNew: true, checked: true, explicitStatus: null });
      c4Ok =
        rc4.ok &&
        rc4.changed &&
        /opened=2026-09-01/.test(rc4.line) &&
        /completed=2026-09-01/.test(rc4.line) &&
        !/status=/.test(rc4.line);
    }
    check(
      'C4 composition: new checked task -> opened + completed, no status=done',
      c4Ok,
      JSON.stringify({ n: mIns.newIndices.length })
    );


    // completion of stale recognized open status removes it; unknown status kept
    r = applySaveLifecycle('- [x] A <!-- mme-task: status=ongoing -->', { today: Y, isNew: false, checked: true, explicitStatus: 'ongoing' });
    check(
      'S12 completion removes stale open status',
      r.ok && !/status=ongoing/.test(r.line) && /completed=2026-09-01/.test(r.line),
      r.line
    );

    // unknown status preserved across completion
    r = applySaveLifecycle('- [x] A <!-- mme-task: status=weird -->', { today: Y, isNew: false, checked: true, explicitStatus: 'weird' });
    check(
      'S13 unknown status preserved on completion',
      r.ok && /status=weird/.test(r.line) && /completed=2026-09-01/.test(r.line),
      r.line
    );

    // checkbox marker never rewritten
    r = applySaveLifecycle('- [x] Checked stays', { today: Y, isNew: false, checked: true, explicitStatus: null });
    check(
      'S14 checkbox marker preserved by save writer',
      r.ok && (r.changed === false || r.line.indexOf('[x]') !== -1),
      r.line
    );

    // new Done removes stale recognized open status but keeps unknown status
    r = applySaveLifecycle('- [x] A <!-- mme-task: status=backlog; owner=zoe -->', { today: Y, isNew: true, checked: true, explicitStatus: 'backlog' });
    check(
      'S15 new Done drops stale open status, keeps unrelated metadata',
      r.ok && /completed=2026-09-01/.test(r.line) && /opened=2026-09-01/.test(r.line) && !/status=/.test(r.line) && /owner=zoe/.test(r.line),
      r.line
    );


    return {
      ok: failed === 0,
      total: results.length,
      passed,
      failed,
      results,
    };
  }

  // ---- Public owner (single lifecycle global; no DOM/window reference) ----

  const LIFECYCLE = {
    STATUS_VALUES,
    OPEN_STATUSES,
    LIFECYCLE_KEYS,
    isValidIsoDate,
    normalizeTask,
    effectiveStatusOf,
    applyTransition,
    applySaveLifecycle,
    matchTasksForSave,
    buildTaskMetadataComment,
    validate,
  };

  try {
    globalThis.MME_TASK_LIFECYCLE = LIFECYCLE;
  } catch {}

  // Deterministic validation entry point (browser + Node harness).
  globalThis.__validateTaskLifecycle = validate;
})();