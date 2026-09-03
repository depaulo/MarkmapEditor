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
  const VALID_DONE_WINDOWS = ['7', '30', '90', 'all'];
  const DONE_WINDOW_DEFAULT = '30';
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

  // ---- Status normalization ----

  function statusOf(task) {
    const effectiveStatus = task?.effectiveStatus;

    if (COLUMN_ORDER.includes(effectiveStatus)) {
      return effectiveStatus;
    }

    const lifecycle = globalThis.MME_TASK_LIFECYCLE;

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

  function viewModel(indexOrTasks, doneWindow, today) {
    const index =
      indexOrTasks && Array.isArray(indexOrTasks.tasks)
        ? indexOrTasks
        : { tasks: Array.isArray(indexOrTasks) ? indexOrTasks : [] };

    const grouped = groupTasks(index.tasks);
    const allDone = grouped.done || [];
    const recentDone = [];
    const undatedDone = [];

    allDone.forEach((task) => {
      const closedDate = task.closedDate || task.completedDate || null;

      if (closedDate && isRecent(closedDate, today, doneWindow)) {
        recentDone.push(task);
      } else if (!closedDate) {
        undatedDone.push(task);
      }
    });

    const visibleDone = doneWindow === 'all' ? allDone.slice() : recentDone;

    return {
      columns: {
        backlog: grouped.backlog || [],
        todo: grouped.todo || [],
        ongoing: grouped.ongoing || [],
        done: visibleDone,
      },

      counts: {
        backlog: (grouped.backlog || []).length,
        todo: (grouped.todo || []).length,
        ongoing: (grouped.ongoing || []).length,
        done: visibleDone.length,
      },

      undatedDone,
      undatedCount: undatedDone.length,
      allDoneCount: allDone.length,
      doneWindow,
    };
  }

  // ---- Card and column rendering ----

  function emptyMessage(label) {
    if (label === 'Backlog') return 'No backlog tasks.';
    if (label === 'Todo') return 'No todo tasks.';
    if (label === 'Ongoing') return 'No tasks in progress.';

    return 'No tasks completed in this period.';
  }

  function cardHtml(task, status) {
    const text = escapeHtml(task?.text || '(untitled task)');

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

    return (
      `<div class="taskBoardCard" data-card-status="${status}">` +
      `<button ` +
      `type="button" ` +
      `class="taskBoardCardTitle" ` +
      `data-task-open="1" ` +
      `data-path="${path}" ` +
      `data-kind="${kind}" ` +
      `data-line="${line}" ` +
      `aria-label="Open source for: ${text}">` +
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
    const model = viewModel(index, doneWindow, today);

    const columnDefinitions = [
      ['backlog', 'Backlog', model.columns.backlog],
      ['todo', 'Todo', model.columns.todo],
      ['ongoing', 'Ongoing', model.columns.ongoing],
      ['done', 'Done', model.columns.done],
    ];

    container.innerHTML = columnDefinitions
      .map(([status, label, tasks]) => {
        const cards = tasks.map((task) => cardHtml(task, status)).join('');

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

      summary.textContent = `${openCount} open · ` + `${model.undatedCount} undated done`;
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

    const columns = document.getElementById('mmeTaskBoardColumns');

    if (columns) {
      columns.addEventListener('click', (event) => {
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
