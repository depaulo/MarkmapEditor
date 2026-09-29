// @ts-nocheck

// Task Board Quick View - first visual Task management experience.
//
// Consumer of the three-level Task architecture:
// Level 1 Workspace Index = normalized read model (WORKSPACE_INDEX_STATE).
// Level 2 TaskReview = compact Sidebar view (js/workspace/task-review.js).
// Level 3 Task Board = focused Quick View overlay (this module).
//
// Ownership contract:
// - renders ONLY from the current Workspace Index; never a parallel store.
// - lifecycle mutation is owned exclusively by
//   globalThis.MME_TASK_LIFECYCLE.applyTransition(
//     currentLine,
//     { target, today }
//   ).
// - the Board never writes checkbox markers, status, opened, started, or
//   completed itself. It supplies: current physical line, target status,
//   canonical local today.
// - canonical local date is owned by main.js (globalThis.getLocalIsoDate).
//   This module never calls new Date(), Date.now(), UTC conversion, or
//   locale date formatting. Done-filter comparisons use pure day-number
//   arithmetic on the explicitly provided canonical local date.
//
// Source mutation reuses the existing TaskReview source resolver and the
// openWorkspaceFile / __cmGetLineText / __cmReplaceLine / saveSmart owners.
// No alternate file writer, no alternate Save pipeline, no manual Index patch.
//
// Publication follows the application pattern (ordered global script, no
// imports): a single owner global - globalThis.MME_TASK_BOARD.

(function () {
  'use strict';

  // ---- Board constants ----

  const DONE_WINDOW_KEY = 'markmap:taskBoard:doneWindow';
  const DONE_WINDOW_DEFAULT = '30';
  const PRIORITY_FILTER_KEY = 'markmap:taskBoard:priority';
  const PRIORITY_FILTER_DEFAULT = 'all';
  const VALID_PRIORITY_FILTERS = ['all', 'p1', 'p2', 'p3', 'none'];
  const SORT_KEY = 'markmap:taskBoard:sort';
  const SORT_DEFAULT = 'file';
  const VALID_SORTS = ['file', 'opened-newest', 'opened-oldest', 'name'];
  const VALID_DONE_WINDOWS = ['7', '30', '90', 'all'];
  const COLUMN_ORDER = ['backlog', 'todo', 'ongoing', 'done'];

  const STATUS_LABELS = {
    backlog: 'Backlog',
    todo: 'Todo',
    ongoing: 'Ongoing',
    done: 'Done',
  };

  // ---- Private state ----

  let wired = false;
  let lastInvoker = null;
  let mutationInProgress = false;

  // ---- Small helpers ----

  function safeLog(msg) {
    if (typeof globalThis.log === 'function') {
      globalThis.log(msg);
    }
  }

  function getWorkspaceIndex() {
    return globalThis.WORKSPACE_INDEX_STATE || globalThis.window?.WORKSPACE_INDEX_STATE || null;
  }

  function getWorkspaceState() {
    return globalThis.WORKSPACE_STATE || globalThis.window?.WORKSPACE_STATE || null;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showToast(msg, type, ms) {
    if (typeof globalThis.showToast === 'function') {
      globalThis.showToast(msg, type || 'info', ms || 2200);
    }
  }

  // ---- Pure date arithmetic (no Date objects, no timezone) ----
  //
  // Converts YYYY-MM-DD to an integer day count (days since 1970-01-01)
  // using proleptic Gregorian arithmetic. All Done-period comparisons are
  // date-only and deterministic.

  function daysFromEpoch(year, month, day) {
    const y = year - (month <= 2 ? 1 : 0);
    const era = Math.floor((y >= 0 ? y : y - 399) / 400);
    const yoe = y - era * 400;
    const mp = (month + 9) % 12;
    const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
    const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;

    return era * 146097 + doe - 719468;
  }

  function parseDateNum(value) {
    const raw = String(value == null ? '' : value).trim();
    const lifecycle = globalThis.MME_TASK_LIFECYCLE;

    if (
      lifecycle &&
      typeof lifecycle.isValidIsoDate === 'function' &&
      !lifecycle.isValidIsoDate(raw)
    ) {
      return null;
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) return null;

    return daysFromEpoch(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  // Recent-Done rule:
  // A Done Task is recent iff its closedDate is valid and it falls on one
  // of the N calendar dates ending at the canonical local today.
  //
  // This includes today plus the previous N-1 dates.
  // The boundary is inclusive.
  // Undated Done Tasks are excluded from recent windows.

  function isRecent(closedDate, today, doneWindow) {
    if (doneWindow === 'all') return true;

    const n = Number(doneWindow);
    if (!(n > 0)) return false;

    const closedDay = parseDateNum(closedDate);
    if (closedDay === null) return false;

    const todayDay = parseDateNum(today);
    if (todayDay === null) return false;

    return closedDay >= todayDay - (n - 1);
  }

  function isValidDoneWindow(value) {
    return VALID_DONE_WINDOWS.includes(String(value));
  }

  function doneWindowDefault(value) {
    return isValidDoneWindow(value) ? String(value) : DONE_WINDOW_DEFAULT;
  }

  function doneWindowFromStored() {
    try {
      const raw = localStorage.getItem(DONE_WINDOW_KEY);
      return doneWindowDefault(raw);
    } catch {
      return DONE_WINDOW_DEFAULT;
    }
  }

  function setStoredDoneWindow(value) {
    if (!isValidDoneWindow(value)) return;

    try {
      localStorage.setItem(DONE_WINDOW_KEY, String(value));
    } catch {
      // Storage may be unavailable or blocked.
    }
  }

  // ---- Priority filter preference (Board-owned presentation) ----

  // Normalizes a priority-filter control value. Only these are canonical:
  // all | p1 | p2 | p3 | none. Unsupported, missing, malformed, or
  // storage-corrupted values -> all. This normalizes the filter CONTROL, never
  // Task source metadata and never Task priority grammar.
  function normalizePriorityFilterValue(value) {
    const v = String(value == null ? '' : value).trim().toLowerCase();
    return VALID_PRIORITY_FILTERS.includes(v) ? v : PRIORITY_FILTER_DEFAULT;
  }

  function getStoredPriorityFilter() {
    try {
      return normalizePriorityFilterValue(localStorage.getItem(PRIORITY_FILTER_KEY));
    } catch {
      return PRIORITY_FILTER_DEFAULT;
    }
  }

  function setStoredPriorityFilter(value) {
    const normalized = normalizePriorityFilterValue(value);
    try {
      localStorage.setItem(PRIORITY_FILTER_KEY, normalized);
    } catch {
      // Storage may be unavailable or blocked; filtering continues unpersisted.
    }
    return normalized;
  }

  // Pure matching of a Task against the selected priority filter. Uses only
  // the canonical task.priority. Never inspects raw lines, #pN, metadata
  // comments, visible text, CSS classes, or badge markup. Never mutates.
  function matchesPriorityFilter(task, filter) {
    const f = normalizePriorityFilterValue(filter);
    if (f === 'all') return true;

    const priority = task?.priority;
    if (f === 'none') return priority == null || priority === '';
    return priority === f;
  }

  // ---- Sort preference (Board-owned presentation order) ----

  // Normalizes a Sort control value. Only these are canonical:
  // file | opened-newest | opened-oldest | name. Unsupported, missing,
  // malformed, or corrupted values -> file. Never accepts aliases. Never a
  // priority/manual/status/custom/drag sort.
  function normalizeSortValue(value) {
    const v = String(value == null ? '' : value).trim().toLowerCase();
    return VALID_SORTS.includes(v) ? v : SORT_DEFAULT;
  }

  function getStoredSort() {
    try {
      return normalizeSortValue(localStorage.getItem(SORT_KEY));
    } catch {
      return SORT_DEFAULT;
    }
  }

  function setStoredSort(value) {
    const normalized = normalizeSortValue(value);
    try {
      localStorage.setItem(SORT_KEY, normalized);
    } catch {
      // Storage may be unavailable or blocked; sorting continues unpersisted.
    }
    return normalized;
  }

  // Deterministic, locale-independent string compare (stable across engines and
  // repeated renders).
  function cmpStrings(a, b) {
    const sa = String(a == null ? '' : a);
    const sb = String(b == null ? '' : b);
    if (sa < sb) return -1;
    if (sa > sb) return 1;
    return 0;
  }

  // Unescaped, normalized visible Task text for comparison. Uses the shared
  // priority-token cleaner (never raw Markdown with checkbox/mme-task/#pN).
  // Unrelated hashtags remain part of the name. Does not mutate task.text.
  //
  // ACT 2A: the token grammar is owned by MME_TASK_LIFECYCLE and is the SAME
  // primitive the canonical writer uses, so a `#pN` token can never be visible
  // on one surface and hidden on another. The inline regex below is only a
  // guard for the lifecycle module being absent; it is not a second grammar.
  function sortableTaskText(task) {
    const lifecycle = globalThis.MME_TASK_LIFECYCLE;
    if (lifecycle && typeof lifecycle.removePriorityTokens === 'function') {
      return String(lifecycle.removePriorityTokens(task?.text || '') || '').toLowerCase();
    }
    return String(
      String(task?.text || '').replace(/#p[123]\b/gi, '').replace(/\\s+/g, ' ').trim()
    ).toLowerCase();
  }

  // Stable source identity for the File comparator. Prefers stable file
  // identity (filePath -> fileName) so title changes never rearrange Tasks from
  // the same file. Empty when no source identity exists.
  function stableSourceIdentity(task) {
    const filePath = String(task?.filePath || '');
    if (filePath) return filePath;
    const fileName = String(task?.fileName || '');
    if (fileName) return fileName;
    return '';
  }

  // Physical source line, numeric ascending; valid positive lines sort before
  // missing/invalid lines; missing uses a large fixed fallback.
  function sourceLineNum(task) {
    const n = Number(task?.line);
    return Number.isFinite(n) && n > 0 ? n : Number.MAX_SAFE_INTEGER;
  }

  // comparatorFor returns a deterministic comparator for a canonical sort value.
  function comparatorFor(sortValue) {
    const sort = normalizeSortValue(sortValue);

    if (sort === 'opened-newest' || sort === 'opened-oldest') {
      return function openedComparator(a, b) {
        const dateA = parseDateNum(a?.openedDate);
        const dateB = parseDateNum(b?.openedDate);
        const validA = dateA !== null;
        const validB = dateB !== null;

        // Dated Tasks before undated Tasks in both Opened modes.
        if (validA !== validB) return validA ? -1 : 1;

        if (validA && validB && dateA !== dateB) {
          return sort === 'opened-newest' ? dateB - dateA : dateA - dateB;
        }

        return fileCompare(a, b);
      };
    }

    if (sort === 'name') {
      return function nameComparator(a, b) {
        const textA = sortableTaskText(a);
        const textB = sortableTaskText(b);
        if (textA !== textB) {
          // Non-empty text before empty text.
          if (!textA) return 1;
          if (!textB) return -1;
          return cmpStrings(textA, textB);
        }
        return fileCompare(a, b);
      };
    }

    // file (default)
    return fileCompare;
  }

  // File and source order:
  //   1. stable source identity
  //   2. physical source line ascending
  //   3. normalized visible Task text
  //   4. final stable fallback
  function fileCompare(a, b) {
    const idA = stableSourceIdentity(a);
    const idB = stableSourceIdentity(b);
    const idCmp = cmpStrings(idA, idB);
    if (idCmp !== 0) return idCmp;

    const lineA = sourceLineNum(a);
    const lineB = sourceLineNum(b);
    if (lineA !== lineB) return lineA - lineB;

    const textCmp = cmpStrings(sortableTaskText(a), sortableTaskText(b));
    if (textCmp !== 0) return textCmp;

    return cmpStrings(`${idA}::${lineA}`, `${idB}::${lineB}`);
  }

  // Non-mutating per-column sort: never sorts a stored/Index array directly.
  function sortColumn(columnTasks, sortValue) {
    return (columnTasks || []).slice().sort(comparatorFor(sortValue));
  }

  // ---- Status normalization ----

  function statusOf(task) {
    const effectiveStatus = task?.effectiveStatus;

    if (COLUMN_ORDER.includes(effectiveStatus)) {
      return effectiveStatus;
    }

    const lifecycle = globalThis.MME_TASK_LIFECYCLE;

    // ACT 2A: the Board resolves an absent effectiveStatus through the SAME
    // normalized contract Task Review uses, so the two surfaces cannot disagree
    // about which column a Task belongs to.
    if (lifecycle && typeof lifecycle.toNormalizedTask === 'function') {
      const status = lifecycle.toNormalizedTask(task).effectiveStatus;

      if (COLUMN_ORDER.includes(status)) {
        return status;
      }
    }

    if (lifecycle && typeof lifecycle.effectiveStatusOf === 'function') {
      const rawStatus = task?.metadata?.status ?? task?.status ?? '';

      const status = lifecycle.effectiveStatusOf(Boolean(task?.done), rawStatus);

      if (COLUMN_ORDER.includes(status)) {
        return status;
      }
    }

    // Defensive fallback:
    // checked -> Done
    // status=backlog -> Backlog
    // status=ongoing -> Ongoing
    // other unchecked -> Todo

    if (task?.done) return 'done';

    const rawStatus = String(task?.metadata?.status ?? task?.status ?? '')
      .trim()
      .toLowerCase();

    if (rawStatus === 'backlog') return 'backlog';
    if (rawStatus === 'ongoing') return 'ongoing';

    return 'todo';
  }

  function groupTasks(tasks) {
    const columns = {
      backlog: [],
      todo: [],
      ongoing: [],
      done: [],
    };

    (tasks || []).forEach((task) => {
      const status = statusOf(task);

      if (columns[status]) {
        columns[status].push(task);
      } else {
        columns.todo.push(task);
      }
    });

    return columns;
  }

  // Pure view model.
  //
  // indexOrTasks may be:
  // - a Workspace Index object containing { tasks }
  // - a raw Task array

  function viewModel(indexOrTasks, doneWindow, today, priorityFilter, sortValue) {
    const index =
      indexOrTasks && Array.isArray(indexOrTasks.tasks)
        ? indexOrTasks
        : { tasks: Array.isArray(indexOrTasks) ? indexOrTasks : [] };

    const priority = normalizePriorityFilterValue(priorityFilter);
    const sort = normalizeSortValue(sortValue);

    const grouped = groupTasks(index.tasks);

    // Priority filter applies to every lifecycle column after Done eligibility.
    const applyFilter = (tasks) => tasks.filter((t) => matchesPriorityFilter(t, priority));

    // Sort applies independently per column AFTER filtering (presentation only).
    const applySort = (tasks) => sortColumn(tasks, sort);

    const backlog = applySort(applyFilter(grouped.backlog || []));
    const todo = applySort(applyFilter(grouped.todo || []));
    const ongoing = applySort(applyFilter(grouped.ongoing || []));

    const allDone = grouped.done || [];
    const recentDone = [];
    const undatedDone = [];

    allDone.forEach((task) => {
      // Undated counting is Done-window data; keep it independent of priority.
      const closedDate = task.closedDate || task.completedDate || null;

      if (closedDate && isRecent(closedDate, today, doneWindow)) {
        recentDone.push(task);
      } else if (!closedDate) {
        undatedDone.push(task);
      }
    });

    const doneEligible = doneWindow === 'all' ? allDone.slice() : recentDone;
    const done = applySort(applyFilter(doneEligible));

    return {
      columns: {
        backlog,
        todo,
        ongoing,
        done,
      },

      counts: {
        backlog: backlog.length,
        todo: todo.length,
        ongoing: ongoing.length,
        done: done.length,
      },

      undatedDone,
      undatedCount: undatedDone.length,
      allDoneCount: allDone.length,
      doneWindow,
      priorityFilter: priority,
    };
  }

  // ---- Card and column rendering ----

  function emptyMessage(label) {
    if (label === 'Backlog') return 'No backlog tasks.';
    if (label === 'Todo') return 'No todo tasks.';
    if (label === 'Ongoing') return 'No tasks in progress.';

    return 'No tasks completed in this period.';
  }

  // ---- Pure card presentation helpers (source label + priority badge) ----

  // Resolves a compact source-document label from the existing Workspace Index
  // records only. Never rescans a file and never re-parses Markdown.
  // Resolution order:
  //   1. meaningful parsed document title (byPath doc.title);
  //   2. source filename (task.fileName, or parsed.name as backup);
  //   3. compact path segment (final non-empty segment);
  //   4. neutral fallback.
  // Never mutates the Task or Index records; never exposes local device paths.
  function resolveSourceLabel(task, byPath) {
    const filePath = String(task?.filePath || task?.path || '');
    const fileName = String(task?.fileName || task?.name || '');

    if (byPath && typeof byPath.get === 'function' && filePath) {
      const doc = byPath.get(filePath);
      if (doc) {
        const title = doc.title;
        if (title && String(title).trim()) return String(title).trim();
        if (!fileName && doc.name && String(doc.name).trim()) return String(doc.name).trim();
      }
    }

    if (fileName && fileName.trim()) return fileName.trim();

    const segments = String(filePath)
      .replace(/\\/g, '/')
      .split('/')
      .filter(Boolean);
    if (segments.length) {
      const last = segments[segments.length - 1];
      if (last) return last;
    }

    return 'Unknown source';
  }

  // ---- ACT 2B: compact priority TRIGGER (replaces the read-only badge) ----
  //
  // This control REPLACES the priority badge rather than sitting beside it, so a
  // card never renders the same priority twice (§4).
  //
  // It is a NATIVE <select> because the Board already establishes exactly this
  // compact control for status (`.taskBoardMove` + `.taskBoardMoveSelect`).
  // Reusing that established owner satisfies §5 preference 1 without inventing a
  // second interaction: correct S22/DeX touch behavior, DeX keyboard behavior,
  // selected-option identification, focus, Escape and outside-click closing are
  // all the browser's own, so NO custom popover, menu framework, or duplicate
  // keydown handling is introduced in this ACT.
  //
  // The control is PRESENTATION ONLY. It carries the exact source identity
  // (path / kind / line) and the requested canonical value, and the delegated
  // owner hands both to the shared Task mutation adapter. It never patches
  // Markdown, holds no priority grammar, and keeps no priority store.
  //
  // Option VALUES are canonical owner inputs, never display labels: '--' is the
  // LABEL for the empty value. '--', 'none' and 'priority=none' must never
  // reach MME_TASK_LIFECYCLE.applyPriority.
  const PRIORITY_CONTROL_OPTIONS = Object.freeze([
    { value: '', label: '--', title: 'No priority' },
    { value: 'p1', label: 'P1', title: 'Priority 1' },
    { value: 'p2', label: 'P2', title: 'Priority 2' },
    { value: 'p3', label: 'P3', title: 'Priority 3' },
  ]);

  // Maps ANY control/DOM value to the canonical owner input, or '' for "no
  // priority". An unrecognized value becomes the no-priority request rather
  // than being forwarded verbatim, so no malformed value can reach the owner.
  function normalizeRequestedPriority(value) {
    const v = String(value == null ? '' : value)
      .trim()
      .toLowerCase();
    return v === 'p1' || v === 'p2' || v === 'p3' ? v : '';
  }

  // Human label for the accessible name / log. Never sent to the owner.
  function priorityLabel(priority) {
    const p = normalizeRequestedPriority(priority);
    return p ? p.toUpperCase() : '--';
  }

  function priorityControlHtml(task, accessibleText, path, kind, line) {
    const current = normalizeRequestedPriority(task?.priority);

    const options = PRIORITY_CONTROL_OPTIONS.map((opt) => {
      const selected = opt.value === current ? ' selected' : '';
      return (
        `<option value="${opt.value}"${selected} title="${opt.title}">` +
        `${opt.label}</option>`
      );
    }).join('');

    // The accessible name carries BOTH Task context AND the current priority, so
    // the control stays meaningful when read out of visual context, and so
    // priority is never conveyed by color alone.
    const aria =
      `Set priority for: ${accessibleText}. Current priority: ${priorityLabel(current)}`;

    // The current level rides on the control as a class so the trigger keeps the
    // established P1/P2/P3 badge visual language, with the TEXT label (P1/P2/P3
    // or --) carrying the meaning independently of color.
    const levelClass = current ? ` priority-${current}` : '';

    return (
      `<label class="taskBoardPriority">` +
      `<span class="taskBoardPriorityLabel">Priority</span>` +
      `<select ` +
      `class="taskBoardPrioritySelect${levelClass}" ` +
      `data-priority="1" ` +
      `data-path="${path}" ` +
      `data-kind="${kind}" ` +
      `data-line="${line}" ` +
      `data-priority-current="${current}" ` +
      `aria-label="${aria}">` +
      options +
      `</select>` +
      `</label>`
    );
  }

  // Card display text. Uses the shared priority-token cleaner (guarded) so a
  // recognized #pN token never appears in the visible card title; unrelated
  // hashtags and the rest of the text are preserved. Workspace Index Task
  // records carry task.text (displayText is a TaskReview-only enrichment), so
  // the shared cleaner is the correct Board path.
  function cardDisplayText(task) {
    const text = String(task?.text || '(untitled task)');
    const lifecycle = globalThis.MME_TASK_LIFECYCLE;
    if (lifecycle && typeof lifecycle.removePriorityTokens === 'function') {
      const cleaned = lifecycle.removePriorityTokens(text);
      return cleaned || text;
    }
    return (
      String(text).replace(/#p[123]\b/gi, '').replace(/\s+/g, ' ').trim() || text
    );
  }

  function cardHtml(task, status, byPath) {
    const text = escapeHtml(cardDisplayText(task) || '(untitled task)');

    const sourceLabel = escapeHtml(resolveSourceLabel(task, byPath));

    const kindLabel = escapeHtml(task?.fileKind || 'task');

    const fileName = escapeHtml(task?.fileName || '');

    const sourceContext = [kindLabel, fileName].filter(Boolean).join(' · ');

    const path = escapeHtml(task?.filePath || '');
    const kind = escapeHtml(task?.fileKind || '');
    const line = Number(task?.line) || 0;

    let dateHtml = '';

    if (status === 'ongoing' && task?.startedDate) {
      dateHtml =
        `<div class="taskBoardCardDate">` + `Started ${escapeHtml(task.startedDate)}` + `</div>`;
    } else if (status === 'done' && (task?.closedDate || task?.completedDate)) {
      dateHtml =
        `<div class="taskBoardCardDate">` +
        `Closed ${escapeHtml(task.closedDate || task.completedDate)}` +
        `</div>`;
    }

    const moveOptions = COLUMN_ORDER.map((targetStatus) => {
      const selected = targetStatus === status ? ' disabled selected' : '';

      return (
        `<option value="${targetStatus}"${selected}>` +
        `${STATUS_LABELS[targetStatus]}` +
        `</option>`
      );
    }).join('');

    const accessibleSource = sourceLabel && sourceLabel !== 'Unknown source' ? `, ${sourceLabel}` : '';

    // ACT 2B: the priority trigger replaces the former read-only badge, so the
    // card shows the priority exactly once, in the top-right area of the
    // context row. Task text stays the main card content and is never covered.
    const priorityControl = priorityControlHtml(task, text, path, kind, line);

    return (
      `<div class="taskBoardCard" data-card-status="${status}">` +
      `<div class="taskBoardCardContext">` +
      `<span class="taskBoardCardSource" title="${sourceLabel}">${sourceLabel}</span>` +
      `${priorityControl}` +
      `</div>` +
      `<button ` +
      `type="button" ` +
      `class="taskBoardCardTitle" ` +
      `data-task-open="1" ` +
      `data-path="${path}" ` +
      `data-kind="${kind}" ` +
      `data-line="${line}" ` +
      `aria-label="Open source for: ${text}${accessibleSource}">` +
      `${text}` +
      `</button>` +
      `<div class="taskBoardCardMeta">` +
      `${sourceContext}` +
      `</div>` +
      dateHtml +
      `<label class="taskBoardMove">` +
      `<span class="taskBoardMoveLabel">Move to</span>` +
      `<select ` +
      `class="taskBoardMoveSelect" ` +
      `data-move="1" ` +
      `data-path="${path}" ` +
      `data-kind="${kind}" ` +
      `data-line="${line}" ` +
      `data-status="${status}" ` +
      `aria-label="Move task to status">` +
      `${moveOptions}` +
      `</select>` +
      `</label>` +
      `</div>`
    );
  }

  function renderColumns() {
    const container = document.getElementById('mmeTaskBoardColumns');

    if (!container) return;

    const index = getWorkspaceIndex();

    const today =
      typeof globalThis.getLocalIsoDate === 'function' ? globalThis.getLocalIsoDate() : '';

    const doneWindow = doneWindowFromStored();
    const priorityFilter = getStoredPriorityFilter();
    const sortValue = getStoredSort();
    const model = viewModel(index, doneWindow, today, priorityFilter, sortValue);

    const prioritySelect = document.getElementById('mmeTaskBoardPriorityFilter');
    if (prioritySelect && prioritySelect.value !== priorityFilter) {
      prioritySelect.value = priorityFilter;
    }

    const sortSelect = document.getElementById('mmeTaskBoardSort');
    if (sortSelect && sortSelect.value !== sortValue) {
      sortSelect.value = sortValue;
    }

    const columnDefinitions = [
      ['backlog', 'Backlog', model.columns.backlog],
      ['todo', 'Todo', model.columns.todo],
      ['ongoing', 'Ongoing', model.columns.ongoing],
      ['done', 'Done', model.columns.done],
    ];

    container.innerHTML = columnDefinitions
      .map(([status, label, tasks]) => {
        const cards = tasks.map((task) => cardHtml(task, status, index?.byPath)).join('');

        const empty =
          tasks.length === 0 ? `<div class="taskBoardEmpty">${emptyMessage(label)}</div>` : '';

        return (
          `<section ` +
          `class="taskBoardColumn" ` +
          `data-column="${status}">` +
          `<header class="taskBoardColumnHeader">` +
          `<span class="taskBoardColumnName">${label}</span>` +
          `<span class="taskBoardColumnCount">${tasks.length}</span>` +
          `</header>` +
          `<div class="taskBoardColumnBody">` +
          `${cards}${empty}` +
          `</div>` +
          `</section>`
        );
      })
      .join('');

    const note = document.getElementById('mmeTaskBoardDoneNote');

    if (note) {
      note.textContent = model.undatedCount
        ? `${model.undatedCount} completed task${
            model.undatedCount === 1 ? '' : 's'
          } without a close date (shown only under All).`
        : '';
    }

    const doneSelect = document.getElementById('mmeTaskBoardDoneWindow');

    if (doneSelect && doneSelect.value !== doneWindow) {
      doneSelect.value = doneWindow;
    }

    const summary = document.getElementById('mmeTaskBoardSummary');

    if (summary) {
      const openCount = model.counts.backlog + model.counts.todo + model.counts.ongoing;

      const filterLabel = priorityFilter === 'all' ? '' : ` · ${priorityFilter.toUpperCase()}`;

      summary.textContent =
        `${openCount} open${filterLabel} · ` + `${model.undatedCount} undated done`;
    }
  }

  // ---- Overlay lifecycle ----

  function ensureBoard() {
    const existing = document.getElementById('mmeTaskBoard');

    if (existing) return existing;

    const overlay = document.createElement('div');

    overlay.id = 'mmeTaskBoard';
    overlay.className = 'taskBoardOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'mmeTaskBoardTitle');
    overlay.hidden = true;

    overlay.innerHTML =
      `<div class="taskBoardPanel">` +
      `<header class="taskBoardHeader">` +
      `<div class="taskBoardHeaderLeft">` +
      `<h2 ` +
      `id="mmeTaskBoardTitle" ` +
      `class="taskBoardTitle" ` +
      `tabindex="-1">` +
      `Task Board` +
      `</h2>` +
      `<div ` +
      `id="mmeTaskBoardSummary" ` +
      `class="taskBoardSummary">` +
      `</div>` +
      `</div>` +
      `<div class="taskBoardHeaderRight">` +
      `<label class="taskBoardDoneWindowLabel">` +
      `Done` +
      `<select ` +
      `id="mmeTaskBoardDoneWindow" ` +
      `class="taskBoardDoneWindow" ` +
      `aria-label="Done period filter">` +
      `<option value="7">7 days</option>` +
      `<option value="30">30 days</option>` +
      `<option value="90">90 days</option>` +
      `<option value="all">All</option>` +
      `</select>` +
      `</label>` +
      `<label class="taskBoardPriorityLabel">` +
      `Priority` +
      `<select ` +
      `id="mmeTaskBoardPriorityFilter" ` +
      `class="taskBoardPriorityFilter" ` +
      `aria-label="Task Board priority filter">` +
      `<option value="all">All priorities</option>` +
      `<option value="p1">P1</option>` +
      `<option value="p2">P2</option>` +
      `<option value="p3">P3</option>` +
      `<option value="none">No priority</option>` +
      `</select>` +
      `</label>` +
      `<label class="taskBoardSortLabel">` +
      `Sort` +
      `<select ` +
      `id="mmeTaskBoardSort" ` +
      `class="taskBoardSort" ` +
      `aria-label="Task Board sort order">` +
      `<option value="file">File and source order</option>` +
      `<option value="opened-newest">Opened, newest first</option>` +
      `<option value="opened-oldest">Opened, oldest first</option>` +
      `<option value="name">Task name A–Z</option>` +
      `</select>` +
      `</label>` +
      `<button ` +
      `type="button" ` +
      `id="mmeTaskBoardClose" ` +
      `class="taskBoardClose" ` +
      `aria-label="Close Task Board">` +
      `Close` +
      `</button>` +
      `</div>` +
      `</header>` +
      `<div ` +
      `id="mmeTaskBoardColumns" ` +
      `class="taskBoardColumns">` +
      `</div>` +
      `<footer class="taskBoardFooter">` +
      `<span ` +
      `id="mmeTaskBoardDoneNote" ` +
      `class="taskBoardDoneNote">` +
      `</span>` +
      `</footer>` +
      `</div>`;

    document.body.appendChild(overlay);

    return overlay;
  }

  function wireBoard() {
    const overlay = ensureBoard();

    if (!overlay || wired) return;

    const closeButton = document.getElementById('mmeTaskBoardClose');

    if (closeButton) {
      closeButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        close();
      });
    }

    overlay.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      event.stopPropagation();
      close();
    });

    const doneSelect = document.getElementById('mmeTaskBoardDoneWindow');

    if (doneSelect) {
      doneSelect.addEventListener('change', () => {
        const value = doneSelect.value;

        if (!isValidDoneWindow(value)) {
          doneSelect.value = DONE_WINDOW_DEFAULT;
          return;
        }

        setStoredDoneWindow(value);
        renderColumns();
      });
    }

    const prioritySelect = document.getElementById('mmeTaskBoardPriorityFilter');

    if (prioritySelect) {
      prioritySelect.addEventListener('change', () => {
        const value = prioritySelect.value;

        if (!VALID_PRIORITY_FILTERS.includes(value)) {
          prioritySelect.value = PRIORITY_FILTER_DEFAULT;
          return;
        }

        prioritySelect.value = setStoredPriorityFilter(value);
        renderColumns();
      });
    }

    const sortSelect = document.getElementById('mmeTaskBoardSort');

    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        const value = sortSelect.value;

        if (!VALID_SORTS.includes(value)) {
          sortSelect.value = SORT_DEFAULT;
          return;
        }

        sortSelect.value = setStoredSort(value);
        renderColumns();
      });
    }

    const columns = document.getElementById('mmeTaskBoardColumns');

    if (columns) {
      columns.addEventListener('click', (event) => {
        // ACT 2B: a priority interaction must never open the source Note. The
        // control lives OUTSIDE the [data-task-open] title button, so this early
        // return is all that is required, and it deliberately does NOT call
        // preventDefault() so the native select still opens its menu normally.
        if (event.target?.closest?.('[data-priority="1"]')) return;

        const title = event.target?.closest?.('[data-task-open="1"]');

        if (!title) return;

        event.preventDefault();
        event.stopPropagation();

        navigateSource({
          path: title.dataset.path || '',
          kind: title.dataset.kind || '',
          line: Number(title.dataset.line || 0),
        });
      });

      columns.addEventListener('change', (event) => {
        // ACT 2B: priority requests are handled on the SAME already-wired
        // listener as status moves. No new listener is registered, so reopening
        // the Board can never duplicate a priority handler.
        const prioritySelect = event.target?.closest?.('[data-priority="1"]');

        if (prioritySelect) {
          setTaskPriorityFromBoard(
            {
              path: prioritySelect.dataset.path || '',
              kind: prioritySelect.dataset.kind || '',
              line: Number(prioritySelect.dataset.line || 0),
            },
            prioritySelect.value,
            prioritySelect
          );
          return;
        }

        const select = event.target?.closest?.('[data-move="1"]');

        if (!select) return;

        const target = String(select.value || '')
          .trim()
          .toLowerCase();

        if (!COLUMN_ORDER.includes(target)) {
          resetSelectToSourceStatus(select);
          return;
        }

        moveTask(
          {
            path: select.dataset.path || '',
            kind: select.dataset.kind || '',
            line: Number(select.dataset.line || 0),
          },
          target,
          select
        );
      });
    }

    wired = true;
    safeLog('TaskBoard: wired');
  }

  function isOpen() {
    const board = document.getElementById('mmeTaskBoard');

    return Boolean(board && !board.hidden);
  }

  function close() {
    const overlay = document.getElementById('mmeTaskBoard');

    if (overlay) {
      overlay.hidden = true;
    }

    if (lastInvoker && typeof lastInvoker.focus === 'function') {
      try {
        lastInvoker.focus();
      } catch {
        // Focus may no longer be available.
      }
    }
  }

  function open(invokerButton) {
    if (!getWorkspaceState()?.rootHandle) {
      showToast('Open a workspace first.', 'warn', 2200);
      return;
    }

    const index = getWorkspaceIndex();

    if (!index || !index.ready) {
      showToast('Workspace index is not ready.', 'warn', 2200);
      return;
    }

    ensureBoard();
    wireBoard();

    lastInvoker = invokerButton || document.getElementById('workspaceTaskBoardBtn');

    renderColumns();

    const overlay = document.getElementById('mmeTaskBoard');

    if (overlay) {
      overlay.hidden = false;

      const title = document.getElementById('mmeTaskBoardTitle');

      const closeButton = document.getElementById('mmeTaskBoardClose');

      const focusTarget = title || closeButton;

      if (focusTarget && typeof focusTarget.focus === 'function') {
        try {
          focusTarget.focus({
            preventScroll: true,
          });
        } catch {
          try {
            focusTarget.focus();
          } catch {
            // Focus unavailable.
          }
        }
      }
    }

    safeLog('TaskBoard: opened');
  }

  function refresh() {
    if (isOpen()) {
      renderColumns();
    }
  }

  // ---- Source navigation ----

  function navigateSource(taskRef) {
    if (!taskRef?.path) return;

    close();

    const opener = globalThis.MME_TASK_REVIEW?.openTaskSource;

    if (typeof opener === 'function') {
      opener(taskRef.path, taskRef.kind, taskRef.line);
    } else {
      showToast('Source navigation unavailable.', 'error', 2200);
    }
  }

  // ---- Status movement ----

  function resetSelectToSourceStatus(select) {
    if (!select) return;

    try {
      const status = String(select.dataset.status || 'todo');

      select.value = status;
      select.disabled = false;

      select.querySelectorAll('option').forEach((option) => {
        option.disabled = option.value === status;
      });
    } catch {
      // The select may have been detached by a refresh.
    }
  }

  // Restores a priority select to the priority recorded on the CARD at render
  // time. Used only when a request is refused before any source mutation, so a
  // rejected request never leaves the control showing a value the source never
  // accepted. It is NOT the post-mutation source of truth; see
  // setTaskPriorityFromBoard, which always re-reads the rebuilt Index.
  function resetSelectToSourcePriority(select) {
    if (!select) return;

    try {
      const current = normalizeRequestedPriority(select.dataset.priorityCurrent);
      if (select.value !== current) select.value = current;
      select.disabled = false;
    } catch {
      // The select may have been detached by a refresh.
    }
  }

  // ---- ACT 2B: priority mutation, delegated to the SHARED Task adapter ----
  //
  // This function deliberately contains NO priority grammar. It does not append
  // ' #p1', does not run a Board-specific regex, does not touch an mme-task
  // comment, and does not strip hashtag tokens. The single priority writer
  // remains MME_TASK_LIFECYCLE.applyPriority, and the single source-mutation
  // lifecycle remains the exported Task Review adapter, which already owns:
  // exact sourcePath, exact occurrence resolution via findActualTaskLine,
  // stale-line detection, ambiguous-match refusal, writable-handle activation,
  // exact line replacement, Save, and Index rebuild.
  //
  // ACT 2B therefore adds PRESENTATION and DELEGATION only. Extracting a second
  // adapter or copying Review's mutation internals would be the duplication this
  // ACT is required to avoid, and source proves it is unnecessary: the adapter is
  // already an external, exported owner.
  async function setTaskPriorityFromBoard(taskRef, value, select) {
    // Busy guard is SHARED with moveTask, so a priority write and a status write
    // can never overlap on the same Board, and rapid repeat taps cannot stack
    // two writes for one card.
    if (mutationInProgress) {
      safeLog('TaskBoard: mutation already in progress, skipping priority change');
      resetSelectToSourcePriority(select);
      return;
    }

    if (!taskRef?.path) {
      resetSelectToSourcePriority(select);
      return;
    }

    // The ONLY value shape that reaches the owner. '--' is a display label and
    // is normalized to the owner's accepted no-priority input (empty).
    const requested = normalizeRequestedPriority(value);

    if (select) select.disabled = true;
    mutationInProgress = true;

    try {
      const adapter = globalThis.MME_TASK_REVIEW?.setTaskPriority;

      if (typeof adapter !== 'function') {
        safeLog('TaskBoard: shared Task priority adapter unavailable');
        showToast('Priority editing unavailable.', 'error', 2200);
        return;
      }

      safeLog(`TaskBoard: requesting priority=${requested || 'none'} for ${taskRef.path}`);

      await adapter(taskRef.path, taskRef.kind, Number(taskRef.line) || 0, requested);
    } catch (error) {
      safeLog(`TaskBoard: priority change failed ${error?.message || error}`);
      showToast('Priority change failed.', 'error', 2400);
    } finally {
      mutationInProgress = false;
      if (select) select.disabled = false;

      // The displayed priority is ALWAYS re-read from the rebuilt Index by
      // re-rendering, never carried over from the requested value. A refused,
      // no-op, or failed Save therefore cannot leave a false priority on the
      // card, and a Save that failed leaves the physical source authoritative.
      renderColumns();
    }
  }

  async function moveTask(taskRef, target, select) {
    if (mutationInProgress) {
      safeLog('TaskBoard: mutation already in progress, skipping');
      resetSelectToSourceStatus(select);
      return;
    }

    if (!taskRef?.path) {
      resetSelectToSourceStatus(select);
      return;
    }

    mutationInProgress = true;

    const wasOpenBefore = isOpen();

    if (select) {
      select.disabled = true;
    }

    const lifecycle = globalThis.MME_TASK_LIFECYCLE;

    const todayFn = globalThis.getLocalIsoDate;

    if (!lifecycle || typeof lifecycle.applyTransition !== 'function') {
      showToast('Lifecycle transition unavailable.', 'error', 2200);

      resetSelectToSourceStatus(select);
      mutationInProgress = false;
      return;
    }

    if (typeof todayFn !== 'function') {
      showToast('Date helper unavailable.', 'error', 2200);

      resetSelectToSourceStatus(select);
      mutationInProgress = false;
      return;
    }

    try {
      const index = getWorkspaceIndex();

      if (!index || !index.ready) {
        showToast('Workspace index is not ready.', 'warn', 2200);

        resetSelectToSourceStatus(select);
        return;
      }

      const indexedTask = (index.tasks || []).find(
        (task) => task.filePath === taskRef.path && task.line === Number(taskRef.line)
      );

      if (!indexedTask) {
        showToast('Task not found in the current index.', 'error', 2200);

        resetSelectToSourceStatus(select);
        return;
      }

      // Hide the Board temporarily so a dirty-file confirmation or another
      // navigation prompt cannot be obscured by this modal overlay.

      if (wasOpenBefore) {
        const overlay = document.getElementById('mmeTaskBoard');

        if (overlay) {
          overlay.hidden = true;
        }
      }

      const findFile = globalThis.findWorkspaceFileByPath;

      if (typeof findFile !== 'function') {
        showToast('Workspace file resolver unavailable.', 'error', 2200);

        restoreAfterMutation(wasOpenBefore, select);
        return;
      }

      const file = findFile(taskRef.path, taskRef.kind);

      if (!file?.handle) {
        showToast('Source file not found.', 'error', 2200);

        restoreAfterMutation(wasOpenBefore, select);
        return;
      }

      const openFile = globalThis.openWorkspaceFile;

      if (typeof openFile !== 'function') {
        showToast('Source opener unavailable.', 'error', 2200);

        restoreAfterMutation(wasOpenBefore, select);
        return;
      }

      let opened;

      try {
        opened = await openFile(file, taskRef.kind || file.kind, 'task board move');
      } catch (error) {
        safeLog(`TaskBoard: open failed ${error?.message || error}`);

        showToast('Failed to open the source file.', 'error', 2200);

        restoreAfterMutation(wasOpenBefore, select, true);
        return;
      }

      const explicitlyFailed = typeof opened === 'object' && opened !== null && opened.ok === false;

      if (!opened || explicitlyFailed) {
        const cancelled =
          !opened ||
          opened?.cancelled === true ||
          opened?.reason === 'cancelled' ||
          opened?.reason === 'canceled';

        safeLog(`TaskBoard: source open not successful ${JSON.stringify(opened)}`);

        showToast(cancelled ? 'Source open cancelled.' : 'Source open blocked.', 'warn', 2400);

        restoreAfterMutation(wasOpenBefore, select);
        return;
      }

      await waitForActivation();

      // Revalidate against the current source after opening the file.

      const getLineText = globalThis.window?.__cmGetLineText || globalThis.__cmGetLineText;

      const replaceLine = globalThis.window?.__cmReplaceLine || globalThis.__cmReplaceLine;

      const resolver = globalThis.MME_TASK_REVIEW?.findActualTaskLine;

      if (
        typeof getLineText !== 'function' ||
        typeof replaceLine !== 'function' ||
        typeof resolver !== 'function'
      ) {
        showToast('Editor bridge unavailable.', 'error', 2200);

        restoreAfterMutation(wasOpenBefore, select, true);
        return;
      }

      const expectedText = indexedTask.text || '';

      const resolvedLine = resolver(getLineText, indexedTask.line, expectedText);

      if (resolvedLine === null || resolvedLine === undefined) {
        showToast('Task not found in the source.', 'warn', 2400);

        restoreAfterMutation(wasOpenBefore, select, true);
        return;
      }

      if (typeof resolvedLine === 'object' && resolvedLine.ambiguous) {
        showToast('Multiple matching tasks found. No change made.', 'warn', 2600);

        restoreAfterMutation(wasOpenBefore, select, true);
        return;
      }

      const actualLine = Number(resolvedLine);

      if (!Number.isInteger(actualLine) || actualLine <= 0) {
        showToast('Task location is invalid.', 'warn', 2400);

        restoreAfterMutation(wasOpenBefore, select, true);
        return;
      }

      const lineText = getLineText(actualLine);

      const taskLinePattern = /^(\s*[-*+]\s+\[[ xX]\]\s+)/;

      if (
        lineText === null ||
        lineText === undefined ||
        lineText === '' ||
        !taskLinePattern.test(lineText)
      ) {
        showToast('Task line is not valid for transition.', 'warn', 2400);

        restoreAfterMutation(wasOpenBefore, select, true);
        return;
      }

      const today = todayFn();

      const transition = lifecycle.applyTransition(lineText, {
        target,
        today,
      });

      if (!transition || transition.ok !== true) {
        showToast(`Cannot move to ${STATUS_LABELS[target] || target}.`, 'error', 2400);

        restoreAfterMutation(wasOpenBefore, select);
        return;
      }

      if (transition.changed === false) {
        safeLog('TaskBoard: transition was a no-op; refreshing from source');

        restoreAfterMutation(wasOpenBefore, select, true);
        return;
      }

      const replaced = replaceLine(actualLine, transition.line, {
        scrollTo: false,
      });

      if (!replaced) {
        showToast('Could not write the updated line.', 'error', 2200);

        restoreAfterMutation(wasOpenBefore, select, true);
        return;
      }

      const saveFn = globalThis.saveSmart;

      let saveOk = false;

      if (typeof saveFn === 'function') {
        try {
          const result = await saveFn();
          saveOk = Boolean(result && result.ok === true);

          if (!saveOk) {
            safeLog(`TaskBoard: save not confirmed ${JSON.stringify(result?.reason)}`);
          }
        } catch (error) {
          safeLog(`TaskBoard: save threw ${error?.message || error}`);

          saveOk = false;
        }
      }

      if (!saveOk) {
        showToast('Change applied but save was not confirmed.', 'warn', 3000);

        restoreAfterMutation(wasOpenBefore, select, true);
        return;
      }

      showToast('Saved', 'ok', 1800);

      safeLog(`TaskBoard: moved line=${actualLine} to ${target}`);

      if (typeof globalThis.scheduleWorkspaceIndexRebuild === 'function') {
        globalThis.scheduleWorkspaceIndexRebuild('task board move');
      }

      restoreAfterMutation(wasOpenBefore, select);
    } catch (error) {
      safeLog(`TaskBoard: move failed ${error?.message || error}`);

      showToast('Task move failed.', 'error', 2400);

      restoreAfterMutation(wasOpenBefore, select, true);
    } finally {
      mutationInProgress = false;
    }
  }

  function waitForActivation() {
    return new Promise((resolve) => {
      if (typeof requestAnimationFrame !== 'function') {
        resolve();
        return;
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });
  }

  function restoreAfterMutation(reopen, select, refreshFromSource) {
    if (reopen) {
      const overlay = document.getElementById('mmeTaskBoard');

      if (overlay) {
        overlay.hidden = false;
      }

      if (refreshFromSource) {
        renderColumns();
      } else {
        resetSelectToSourceStatus(select);
      }
    } else if (select) {
      resetSelectToSourceStatus(select);
    }
  }

  // ---- Dormant validator ----

  function runValidator() {
    const results = [];
    let passed = 0;
    let failed = 0;

    const check = (label, ok, detail) => {
      results.push({
        label,
        ok: Boolean(ok),
        detail: detail == null ? '' : String(detail),
      });

      if (ok) {
        passed += 1;
      } else {
        failed += 1;
      }
    };

    const today = '2026-09-02';
    const lifecycle = globalThis.MME_TASK_LIFECYCLE;

    const tasks = [
      {
        text: 'A',
        done: true,
        completedDate: '2026-09-01',
        closedDate: '2026-09-01',
        filePath: 'j/a.md',
        line: 1,
        effectiveStatus: 'done',
      },
      {
        text: 'B',
        done: false,
        metadata: {
          status: 'backlog',
        },
        filePath: 'j/a.md',
        line: 2,
        effectiveStatus: 'backlog',
      },
      {
        text: 'C',
        done: false,
        metadata: {
          status: 'ongoing',
        },
        startedDate: '2026-08-20',
        filePath: 'j/a.md',
        line: 3,
        effectiveStatus: 'ongoing',
      },
      {
        text: 'D',
        done: false,
        filePath: 'j/a.md',
        line: 4,
        effectiveStatus: 'todo',
      },
    ];

    const grouped = groupTasks(tasks);

    check('G1 backlog', grouped.backlog.length === 1 && grouped.backlog[0].text === 'B');

    check('G2 todo', grouped.todo.length === 1 && grouped.todo[0].text === 'D');

    check('G3 ongoing', grouped.ongoing.length === 1 && grouped.ongoing[0].text === 'C');

    check('G4 done', grouped.done.length === 1 && grouped.done[0].text === 'A');

    check(
      'F1 checked -> done',
      statusOf({
        done: true,
        metadata: {},
      }) === 'done'
    );

    check(
      'F2 backlog',
      statusOf({
        done: false,
        metadata: {
          status: 'backlog',
        },
      }) === 'backlog'
    );

    check(
      'F3 ongoing',
      statusOf({
        done: false,
        metadata: {
          status: 'ongoing',
        },
      }) === 'ongoing'
    );

    check(
      'F4 other unchecked -> todo',
      statusOf({
        done: false,
        metadata: {},
      }) === 'todo'
    );

    check(
      'F5 checkbox authority',
      statusOf({
        done: true,
        metadata: {
          status: 'ongoing',
        },
      }) === 'done'
    );

    check('D1 30d includes today', isRecent('2026-09-02', '2026-09-02', '30') === true);

    check('D2 30d includes today-29', isRecent('2026-08-04', '2026-09-02', '30') === true);

    check('D3 30d excludes today-30', isRecent('2026-08-03', '2026-09-02', '30') === false);

    check('D4 7d includes today-6', isRecent('2026-08-27', '2026-09-02', '7') === true);

    check('D5 7d excludes today-7', isRecent('2026-08-26', '2026-09-02', '7') === false);

    check('D6 all includes dated task', isRecent('2020-01-01', '2026-09-02', 'all') === true);

    check('D7 undated excluded from recent', isRecent(null, '2026-09-02', '30') === false);

    check('D8 invalid date excluded', isRecent('not-a-date', '2026-09-02', '30') === false);

    const undatedDone = {
      text: 'Old',
      done: true,
      completedDate: null,
      closedDate: null,
      filePath: 'j/b.md',
      line: 5,
      effectiveStatus: 'done',
    };

    const recentModel = viewModel(
      {
        tasks: tasks.concat([undatedDone]),
      },
      '30',
      today
    );

    check('V1 recent excludes undated Done', recentModel.columns.done.length === 1);

    check('V2 undated counted', recentModel.undatedCount === 1);

    check('V3 allDoneCount includes undated', recentModel.allDoneCount === 2);

    const allModel = viewModel(
      {
        tasks: tasks.concat([undatedDone]),
      },
      'all',
      today
    );

    check('V4 All includes undated Done', allModel.columns.done.length === 2);

    check('V5 doneWindow surfaced', allModel.doneWindow === 'all');

    check('P1 invalid filter falls back to 30', doneWindowDefault('99') === '30');

    check('P2 valid filters accepted', isValidDoneWindow('7') && isValidDoneWindow('all'));

    if (lifecycle && typeof lifecycle.applyTransition === 'function') {
      const ongoing = lifecycle.applyTransition('- [ ] Ship it', {
        target: 'ongoing',
        today,
      });

      check('L1 Todo -> Ongoing succeeds', ongoing.ok === true);

      check(
        'L2 Todo -> Ongoing writes started',
        ongoing.ok && /started=2026-09-02/.test(ongoing.line)
      );

      check('L3 checkbox remains open', ongoing.ok && /- \[ \]/.test(ongoing.line));

      const done = lifecycle.applyTransition('- [ ] Ship it', {
        target: 'done',
        today,
      });

      check(
        'L4 Todo -> Done',
        done.ok === true && /- \[x\]/.test(done.line) && /completed=2026-09-02/.test(done.line)
      );

      const reopened = lifecycle.applyTransition(
        '- [x] Ship it <!-- mme-task: completed=2026-09-02; opened=2026-09-01 -->',
        {
          target: 'todo',
          today,
        }
      );

      check(
        'L5 Done -> Todo',
        reopened.ok === true && /- \[ \]/.test(reopened.line) && !/completed=/.test(reopened.line)
      );

      check(
        'L6 reopening preserves opened',
        reopened.ok && /opened=2026-09-01/.test(reopened.line)
      );

      const backlog = lifecycle.applyTransition('- [ ] Ship it', {
        target: 'backlog',
        today,
      });

      check('L7 Todo -> Backlog', backlog.ok === true && /status=backlog/.test(backlog.line));

      const invalid = lifecycle.applyTransition('- [ ] X', {
        target: 'bogus',
        today,
      });

      check('L8 invalid target rejected', invalid.ok === false);
    } else {
      check('L0 lifecycle owner present', false, 'MME_TASK_LIFECYCLE missing');
    }

    // ---------- CARD PRESENTATION: SOURCE LABEL + PRIORITY BADGE (pure) ----------
    const cardByPath = new Map();
    cardByPath.set('notes/a.md', { title: 'Alpha Note', name: 'a.md', kind: 'notes' });
    cardByPath.set('notes/b.md', { title: '', name: 'b.md', kind: 'notes' });

    const srcTaskTitle = {
      text: 'Do #p1 things #project',
      done: false,
      priority: 'p1',
      filePath: 'notes/a.md',
      fileName: 'a.md',
      fileKind: 'notes',
      line: 3,
    };
    const srcSnapshot = JSON.stringify(srcTaskTitle);

    check('A parsed title wins', resolveSourceLabel(srcTaskTitle, cardByPath) === 'Alpha Note');

    check(
      'B empty parsed title falls back to filename',
      resolveSourceLabel({ text: 'x', filePath: 'notes/b.md', fileName: 'b.md' }, cardByPath) === 'b.md'
    );

    check(
      'C missing parsed record falls back to filename',
      resolveSourceLabel({ text: 'x', filePath: 'missing.md', fileName: 'missing.md' }, new Map()) === 'missing.md'
    );

    check(
      'D missing filename falls back to compact path segment',
      resolveSourceLabel({ text: 'x', filePath: 'deep/outer/inner.md' }, new Map()) === 'inner.md'
    );

    check('E all missing -> neutral fallback', resolveSourceLabel({ text: 'x' }, new Map()) === 'Unknown source');

    resolveSourceLabel(srcTaskTitle, cardByPath);
    check('F resolver does not mutate Task or Index', JSON.stringify(srcTaskTitle) === srcSnapshot);

    // ---- ACT 2B: the priority trigger replaces the read-only priority badge.
    // The former badge fixtures (G-L) are preserved in INTENT and re-pointed at
    // the control that now occupies that role, so the established P1/P2/P3 visual
    // language and the "no badge for an unknown level" rule stay proven.

    const ctlNone = priorityControlHtml({ priority: null }, 'Task A', 'n/a.md', 'note', 1);
    const ctlP1 = priorityControlHtml({ priority: 'p1' }, 'Task A', 'n/a.md', 'note', 1);
    const ctlP2 = priorityControlHtml({ priority: 'p2' }, 'Task A', 'n/a.md', 'note', 1);
    const ctlP3 = priorityControlHtml({ priority: 'p3' }, 'Task A', 'n/a.md', 'note', 1);

    check('G P1 trigger text', ctlP1.indexOf('>P1<') !== -1);
    check('H P2 trigger text', ctlP2.indexOf('>P2<') !== -1);
    check('I P3 trigger text', ctlP3.indexOf('>P3<') !== -1);
    check('J null priority renders --', priorityLabel(null) === '--' && ctlNone.indexOf('>--<') !== -1);
    check(
      'K invalid priority falls back to -- and requests no priority',
      priorityLabel('urgent') === '--' &&
        normalizeRequestedPriority('urgent') === '' &&
        normalizeRequestedPriority(undefined) === '' &&
        normalizeRequestedPriority(1) === ''
    );
    check(
      'L trigger level class driven only by canonical priority',
      ctlP2.indexOf('priority-p2') !== -1 && ctlP2.indexOf('priority-p1') === -1 &&
        ctlP3.indexOf('priority-p3') !== -1 && ctlNone.indexOf('priority-p') === -1
    );

    // The current value must be SELECTED (not merely present) so the closed
    // control shows the Task's real priority.
    check(
      'L2 current priority is the selected option',
      ctlP2.indexOf('<option value="p2" selected title="Priority 2">P2</option>') !== -1 &&
        ctlNone.indexOf('<option value="" selected title="No priority">--</option>') !== -1
    );

    // The trigger is a native <select>, so touch, keyboard, Escape, outside-click
    // closing and focus are the browser's own. No custom menu is introduced.
    check(
      'L3 trigger is a native select carrying exact source identity',
      ctlP2.indexOf('<select ') !== -1 && ctlP2.indexOf('data-priority="1"') !== -1 &&
        ctlP2.indexOf('data-path="n/a.md"') !== -1 && ctlP2.indexOf('data-line="1"') !== -1
    );

    // Priority must never be conveyed by color alone, and the accessible name
    // must carry BOTH Task context and current priority.
    check(
      'L4 accessible name carries Task context and current priority',
      ctlP2.indexOf('aria-label="Set priority for: Task A. Current priority: P2"') !== -1 &&
        ctlNone.indexOf('Current priority: --') !== -1
    );

    // Option VALUES are canonical owner inputs; display labels must never be
    // forwarded. '--' and 'none' must not exist as a value anywhere.
    check(
      'L5 only canonical owner values are offered as option values',
      PRIORITY_CONTROL_OPTIONS.map((o) => o.value).join(',') === ',p1,p2,p3' &&
        /value="(--|none)"/.test(ctlP2) === false
    );

    const cleanTitleText = cardDisplayText(srcTaskTitle);
    check(
      'M card title cleaned, no #pN token',
      cleanTitleText.indexOf('#p1') === -1 && cleanTitleText.indexOf('#project') !== -1
    );
    check('N unrelated hashtag remains visible', cleanTitleText.indexOf('#project') !== -1);

    const renderedCard = cardHtml(srcTaskTitle, 'todo', cardByPath);
    check(
      'O source-navigation data attributes remain',
      renderedCard.indexOf('data-task-open="1"') !== -1 &&
        renderedCard.indexOf('data-path="notes/a.md"') !== -1 &&
        renderedCard.indexOf('data-kind="notes"') !== -1 &&
        renderedCard.indexOf('data-line="3"') !== -1
    );
    // ACT 2B: the read-only badge span is replaced by the priority TRIGGER. The
    // card now carries exactly one priority affordance, and it is a native
    // <select> with P1 selected — so the card shows P1 while closed, is
    // keyboard reachable, and is NOT a dead non-interactive span.
    check(
      'P priority trigger replaces the badge and shows P1',
      renderedCard.indexOf('taskBoardPrioritySelect priority-p1') !== -1 &&
        renderedCard.indexOf('<option value="p1" selected title="Priority 1">P1</option>') !== -1 &&
        renderedCard.indexOf('workspaceTaskPriorityBadge') === -1
    );
    check('P2 source label present on the card', renderedCard.indexOf('class="taskBoardCardSource" title="Alpha Note"') !== -1);
    check(
      'P3 trigger renders -- for an unprioritized card',
      cardHtml({ text: 'plain', priority: null, filePath: 'x.md', fileKind: 'notes', fileName: 'x.md', line: 1 }, 'todo', new Map())
        .indexOf('data-priority-current=""') !== -1
    );

    check('Q card input not mutated during render', JSON.stringify(srcTaskTitle) === srcSnapshot);

    // ---------- PRIORITY FILTER (pure) ----------
    check('A normalize all -> all', normalizePriorityFilterValue('all') === 'all');
    check('B normalize p1/p2/p3/none', normalizePriorityFilterValue('p1') === 'p1' && normalizePriorityFilterValue('p2') === 'p2' && normalizePriorityFilterValue('p3') === 'p3' && normalizePriorityFilterValue('none') === 'none');
    check('B2 uppercase/whitespace normalize', normalizePriorityFilterValue('  P1 ') === 'p1');
    check('C invalid filter -> all', normalizePriorityFilterValue('urgent') === 'all' && normalizePriorityFilterValue('p4') === 'all' && normalizePriorityFilterValue('p0') === 'all' && normalizePriorityFilterValue('high') === 'all' && normalizePriorityFilterValue(5) === 'all');
    check('D empty/missing -> all', normalizePriorityFilterValue('') === 'all' && normalizePriorityFilterValue(null) === 'all' && normalizePriorityFilterValue(undefined) === 'all');

    const prioSet = [
      { id: 1, priority: 'p1' },
      { id: 2, priority: 'p2' },
      { id: 3, priority: 'p3' },
      { id: 4, priority: null },
      { id: 5, priority: 'urgent' }, // unsupported
    ];
    const prioSnapshot = JSON.stringify(prioSet);

    check('E All includes every Task', prioSet.filter((t) => matchesPriorityFilter(t, 'all')).length === 5);
    check('F P1 includes only P1', matchesPriorityFilter(prioSet[0], 'p1') === true && prioSet.filter((t) => matchesPriorityFilter(t, 'p1')).length === 1);
    check('G P2 includes only P2', matchesPriorityFilter(prioSet[1], 'p2') === true && prioSet.filter((t) => matchesPriorityFilter(t, 'p2')).length === 1);
    check('H P3 includes only P3', matchesPriorityFilter(prioSet[2], 'p3') === true && prioSet.filter((t) => matchesPriorityFilter(t, 'p3')).length === 1);
    check('I No priority includes canonical null', matchesPriorityFilter(prioSet[3], 'none') === true);
    check('J No priority handles missing defensively', matchesPriorityFilter({ priority: undefined }, 'none') === true && matchesPriorityFilter({ priority: '' }, 'none') === true && matchesPriorityFilter({}, 'none') === true);
    check('K P1 excludes P2/P3/null', matchesPriorityFilter(prioSet[1], 'p1') === false && matchesPriorityFilter(prioSet[2], 'p1') === false && matchesPriorityFilter(prioSet[3], 'p1') === false);
    check('X unsupported priority not in P1/P2/P3', matchesPriorityFilter(prioSet[4], 'p1') === false && matchesPriorityFilter(prioSet[4], 'p2') === false && matchesPriorityFilter(prioSet[4], 'p3') === false);
    check('Y unsupported priority included by All', matchesPriorityFilter(prioSet[4], 'all') === true);

    // Pipeline: lifecycle partition -> Done eligibility -> priority each column.
    const modelTasks = [
      { id: 'b1', done: false, priority: 'p1', effectiveStatus: 'backlog' },
      { id: 't1', done: false, priority: 'p1', effectiveStatus: 'todo' },
      { id: 't2', done: false, priority: 'p2', effectiveStatus: 'todo' },
      { id: 'o1', done: false, priority: 'p3', effectiveStatus: 'ongoing' },
      { id: 'd1', done: true, priority: 'p1', closedDate: '2026-09-01', completedDate: '2026-09-01', effectiveStatus: 'done' },
      { id: 'd2', done: true, priority: 'p2', closedDate: '2026-09-01', completedDate: '2026-09-01', effectiveStatus: 'done' },
      { id: 'd3', done: true, priority: null, closedDate: null, effectiveStatus: 'done' }, // undated
    ];
    const modelSnapshot = JSON.stringify(modelTasks);

    const mP1 = viewModel(modelTasks, '30', '2026-09-02', 'p1');
    check('F2 P1 -> todo column only p1', mP1.columns.todo.length === 1 && mP1.columns.todo[0].id === 't1');
    check('M P1 applies to Backlog', mP1.columns.backlog.length === 1 && mP1.columns.backlog[0].id === 'b1');
    check('N P1 applies to Todo', mP1.columns.todo.length === 1);
    check('L P1 applies to Ongoing', mP1.columns.ongoing.length === 0);
    check('O P1 applies to Done (eligible only)', mP1.columns.done.length === 1 && mP1.columns.done[0].id === 'd1');
    check('R visible column counts reflect filtered arrays', mP1.counts.todo === 1 && mP1.counts.done === 1 && mP1.counts.ongoing === 0);

    const mNone = viewModel(modelTasks, '30', '2026-09-02', 'none');
    check('P Done-period filtering precedes priority (undated excluded from 30d)', mNone.columns.done.length === 0);

    const mAll = viewModel(modelTasks, 'all', '2026-09-02', 'all');
    check('P2 All + all -> all done incl undated', mAll.columns.done.length === 3);
    const mNoneAll = viewModel(modelTasks, 'all', '2026-09-02', 'none');
    check('Q Done-window + priority intersection (none + all -> undated only)', mNoneAll.columns.done.length === 1 && mNoneAll.columns.done[0].id === 'd3');
    check('Q2 p1 + all done -> only d1 dated p1', viewModel(modelTasks, 'all', '2026-09-02', 'p1').columns.done.length === 1);

    check('T filtering does not mutate Task records', JSON.stringify(modelTasks) === modelSnapshot);
    check('U model input array not mutated', JSON.stringify(prioSet) === prioSnapshot);

    const orderCheck = viewModel(modelTasks, '30', '2026-09-02', 'p1');
    check('V relative order unchanged', orderCheck.columns.todo[0].id === 't1');

    // W: rendering remains correct after filtering (badge + source label intact).
    const filteredRendered = orderCheck.columns.backlog[0];
    const cardBacklog = cardHtml(filteredRendered, 'backlog', cardByPath);
    check(
      'W priority trigger rendering correct after filter',
      cardBacklog.indexOf('taskBoardPrioritySelect priority-p1') !== -1 &&
        cardBacklog.indexOf('data-priority-current="p1"') !== -1
    );
    check('W2 source label rendering correct after filter', cardBacklog.indexOf('taskBoardCardSource') !== -1);

    check('Z persistence normalizer never returns unsupported', ['all', 'p1', 'p2', 'p3', 'none'].indexOf(normalizePriorityFilterValue('bogus')) !== -1 && ['all', 'p1', 'p2', 'p3', 'none'].indexOf(normalizePriorityFilterValue('P2')) !== -1);

    // ---------- SORT (pure, deterministic) ----------
    check('A normalize file -> file', normalizeSortValue('file') === 'file');
    check('B normalize opened-newest', normalizeSortValue('opened-newest') === 'opened-newest');
    check('C normalize opened-oldest', normalizeSortValue('opened-oldest') === 'opened-oldest');
    check('D normalize name', normalizeSortValue('name') === 'name');
    check('D2 uppercase/whitespace', normalizeSortValue('  Name ') === 'name');
    check('E invalid/empty -> file', normalizeSortValue('priority') === 'file' && normalizeSortValue('') === 'file' && normalizeSortValue(null) === 'file' && normalizeSortValue('manual') === 'file' && normalizeSortValue(5) === 'file');

    // File comparator fixtures (mixed files, lines, names).
    const sortTasks = [
      { id: 'c', filePath: 'notes/b/day.md', fileName: 'day.md', line: 3, text: 'Zebra', openedDate: '2026-08-01' },
      { id: 'a', filePath: 'notes/a/week.md', fileName: 'week.md', line: 1, text: 'Alpha', openedDate: '2026-08-05' },
      { id: 'b', filePath: 'notes/a/week.md', fileName: 'week.md', line: 2, text: 'Beta', openedDate: '2026-08-02' },
      { id: 'd', filePath: null, fileName: 'orphan.md', line: null, text: 'Delta', openedDate: '2026-08-03' },
    ];
    const sortSnapshot = JSON.stringify(sortTasks);

    const fileSorted = sortColumn(sortTasks, 'file');
    check('F File sort groups by stable file identity', fileSorted.indexOf(sortTasks[1]) < fileSorted.indexOf(sortTasks[2]) && fileSorted.indexOf(sortTasks[2]) < fileSorted.indexOf(sortTasks[0]));
    check('G File sort uses source line ascending within a file', fileSorted[0].id === 'a' && fileSorted[1].id === 'b');
    check('H File sort places positive line before missing line', fileSorted.indexOf(sortTasks[3]) === fileSorted.length - 1);
    check('I File sort uses visible text as stable tie-breaker', sortColumn([{ filePath: 'x', line: 1, text: 'B' }, { filePath: 'x', line: 1, text: 'A' }], 'file')[0].text === 'A');

    // Opened-newest / oldest.
    const openedNewest = sortColumn(sortTasks, 'opened-newest');
    check('J Opened newest sorts valid dates descending', openedNewest[0].openedDate === '2026-08-05');
    check('K Opened newest undated after dated', sortColumn([{ text: 'u', openedDate: null }, { text: 'd', openedDate: '2026-01-01' }], 'opened-newest')[0].text === 'd');
    check('L invalid date treated as undated', sortColumn([{ text: 'x' }, { text: 'y', openedDate: 'not-a-date' }], 'opened-newest')[1] !== undefined);
    const openedOldest = sortColumn(sortTasks, 'opened-oldest');
    check('M Opened oldest sorts valid dates ascending', openedOldest[0].openedDate === '2026-08-01');
    check('N Opened oldest undated after dated', sortColumn([{ text: 'D', openedDate: '2026-01-01' }, { text: 'E', openedDate: null }], 'opened-oldest')[1].openedDate === null);
    check('O Opened oldest uses file/source fallback for equal dates', (() => { const r = sortColumn([{ id: 'x', filePath: 'b', text: 'n' }, { id: 'y', filePath: 'a', text: 'm', openedDate: '2026-01-01' }], 'opened-oldest'); return r[r.length - 1].filePath === 'b'; })());

    const nameSorted = sortColumn([{ text: 'banana' }, { text: 'Apple' }, { text: '' }, { text: 'apple #p1' }], 'name');
    check('P Name sort case-insensitive', nameSorted[0].text === 'Apple' && nameSorted[1].text === 'apple #p1');
    check('Q name sort excludes priority token from sortable text', sortableTaskText(nameSorted[1]).indexOf('#p1') === -1 && sortableTaskText(nameSorted[1]) === 'apple');
    check('R Name sort places non-empty before empty', nameSorted[nameSorted.length - 1].text === '');
    check('S Name sort uses file/source fallback for equal names', (() => { const r = sortColumn([{ text: 'same', filePath: 'b' }, { text: 'same', filePath: 'a' }], 'name'); return r[0].filePath === 'a'; })());

    check('AC unsupported legacy records do not throw', (() => { try { sortColumn([null, { text: undefined }, { line: -5 }], 'name'); return true; } catch (e) { return false; } })());

    const perCol = viewModel([
      { id: 'tN', done: false, priority: null, effectiveStatus: 'todo', text: 'n', filePath: 'a', line: 2, openedDate: null },
      { id: 'tA', done: false, priority: null, effectiveStatus: 'todo', text: 'a', filePath: 'a', line: 1, openedDate: '2026-01-01' },
    ], 'all', '2026-09-02', 'all', 'name');
    check('T Sorting applies independently per column', perCol.columns.todo[0].id === 'tA');
    check('U Sorting occurs after priority filtering', (() => { const r = viewModel([{ id: 'tp1', priority: 'p1', filePath: 'z', line: 1, text: 'a' }, { id: 'tp2', priority: null, filePath: 'a', line: 1, text: 'zzz' }], 'all', '2026-09-02', 'p1', 'name'); return r.columns.todo.length === 1; })());
    check('V2 Sorting occurs after Done-period eligibility', (() => { const r = viewModel([{ id: 'd', done: true, closedDate: '2026-01-01', effectiveStatus: 'done', openedDate: '2026-01-02' }], '30', '2026-09-02', 'all', 'name'); return r.columns.done.length === 0; })());
    check('W Sorting does not change lifecycle membership', (() => { const r = viewModel(sortTasks.concat([{ id: 'td', done: true, closedDate: '2026-09-01', effectiveStatus: 'done', line: 9, filePath: 'x' }]), '30', '2026-09-02', 'all', 'file'); return r.columns.todo.length === 4; })());
    check('X Sorting does not mutate source records', JSON.stringify(sortTasks) === sortSnapshot);
    check('Z Sorting does not modify priority/line', (() => { const pre = JSON.stringify(sortTasks); sortColumn(sortTasks, 'name'); return JSON.stringify(sortTasks) === pre; })());
    check('AA Sorting does not modify source line', (() => { const pre = JSON.stringify(sortTasks); sortColumn(sortTasks, 'file'); return JSON.stringify(sortTasks) === pre; })());
    check('AD persisted Sort normalizer never returns unsupported', ['file', 'opened-newest', 'opened-oldest', 'name'].indexOf(normalizeSortValue('bogus')) !== -1 && ['file', 'opened-newest', 'opened-oldest', 'name'].indexOf(normalizeSortValue('NAME')) !== -1);

    // AB: rendered cards retain source label and badge after sorting.
    const sortedForRender = sortColumn([{ id: 'p1x', text: 'do #p1 things #project', priority: 'p1', filePath: 'notes/a.md', fileName: 'a.md', fileKind: 'notes', line: 3 }], 'name');
    const sortedCardHtml = cardHtml(sortedForRender[0], 'todo', cardByPath);
    check(
      'AB source labels + priority trigger survive sorting',
      sortedCardHtml.indexOf('taskBoardCardSource') !== -1 &&
        sortedCardHtml.indexOf('taskBoardPrioritySelect priority-p1') !== -1
    );

    return {
      ok: failed === 0,
      total: results.length,
      passed,
      failed,
      results,
    };
  }

  // ---- Public owner ----

  const MME_TASK_BOARD = {
    open,
    close,
    refresh,
    isOpen,

    // Pure and testable surface.
    viewModel,
    groupTasks,
    statusOf,
    isRecent,
    parseDateNum,
    isValidDoneWindow,
    doneWindowDefault,
    resolveSourceLabel,
    cardDisplayText,
    cardHtml,
    // ACT 2B: the priority trigger is a pure renderer over the canonical task
    // record, and the request normalizer is the single gate that keeps display
    // labels ('--') and malformed values out of the lifecycle owner. Both are
    // exposed so the contract suite can prove the rendering and the value
    // mapping without booting the Board overlay.
    priorityControlHtml,
    priorityLabel,
    normalizeRequestedPriority,
    PRIORITY_CONTROL_OPTIONS,
    normalizePriorityFilterValue,
    matchesPriorityFilter,
    normalizeSortValue,
    comparatorFor,
    fileCompare,
    sortColumn,
    sortableTaskText,
    PRIORITY_FILTER_KEY,
    SORT_KEY,
    DONE_WINDOW_KEY,
    validate: runValidator,
  };

  try {
    globalThis.MME_TASK_BOARD = MME_TASK_BOARD;
  } catch {
    // Global publication unavailable.
  }

  globalThis.__validateTaskBoard = runValidator;

  // Subscribe once to Workspace Index rebuilds.
  // Render only while the Board is open.

  if (typeof window !== 'undefined' && !window.__mmeTaskBoardIndexReadyBound) {
    window.addEventListener('mme-workspace-index-ready', () => {
      try {
        if (isOpen()) {
          renderColumns();
        }
      } catch (error) {
        safeLog(`TaskBoard: index-ready refresh failed ${error?.message || error}`);
      }
    });

    window.__mmeTaskBoardIndexReadyBound = true;
  }

  safeLog('TaskBoard: module loaded');
})();
