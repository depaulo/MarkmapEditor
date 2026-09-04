// @ts-nocheck
// R-TASK2 + R-TASK3 — Task Search, Status Filters, and Priority
// Reuses existing workspace index and task parser.
// ================================

(function () {
  'use strict';

  // ---- Private state ----

  let wiredPanel = null;
  let taskOpenInProgress = false;
  let taskStatusInProgress = false;
  let taskPriorityInProgress = false;

  const STATUS_FILTER_KEY = 'markmap:taskReview:status';
  const STATUS_FILTER_VALUES = ['open', 'backlog', 'todo', 'ongoing', 'done', 'all'];

  // Conservative compatibility normalization:
  // - legacy 'completed' -> 'done';
  // - unknown or missing -> 'open'.
  function normalizeStatusFilterValue(value) {
    const v = String(value == null ? '' : value).trim().toLowerCase();
    if (v === 'completed') return 'done';
    return STATUS_FILTER_VALUES.includes(v) ? v : 'open';
  }

  // TaskReview-owned lifecycle preference. Safe storage access only; a storage
  // failure never breaks TaskReview. No Workspace-, frontmatter-, or
  // Mode-Session-backed persistence.
  function statusFilterFromStored() {
    try {
      return normalizeStatusFilterValue(localStorage.getItem(STATUS_FILTER_KEY));
    } catch {
      return 'open';
    }
  }

  function setStoredStatusFilter(value) {
    const normalized = normalizeStatusFilterValue(value);
    try {
      localStorage.setItem(STATUS_FILTER_KEY, normalized);
    } catch {
      // Storage may be unavailable or blocked; filtering continues unpersisted.
    }
    return normalized;
  }

  const filterState = {
    query: '',
    status: statusFilterFromStored(),
    priority: 'all',
  };

  // ---- Private helpers ----

  function safeLog(msg) {
    if (typeof globalThis.log === 'function') {
      globalThis.log(msg);
    }
  }

  function getWorkspaceIndex() {
    return globalThis.WORKSPACE_INDEX_STATE || window.WORKSPACE_INDEX_STATE || null;
  }

  function getWorkspaceState() {
    return globalThis.WORKSPACE_STATE || window.WORKSPACE_STATE || null;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
  }

  // ---- Shared priority grammar (single owner: MME_TASK_LIFECYCLE) ----
  //
  // Priority recognition, precedence, and visible-token removal are owned by
  // the pure lifecycle module (priorityOf / removePriorityTokens). This module
  // consumes the canonical shared task.priority ('p1'|'p2'|'p3'|null) from the
  // Workspace Index record and no longer maintains a local grammar. The local
  // wrapper below only guards against the lifecycle module being absent.
  //
  // Priority mutation (P1/P2/P3/clear) still writes the same visible #pN
  // tokens to the physical Markdown line and saves through the existing owner.

  function stripPriorityTokens(text) {
    const lifecycle = globalThis.MME_TASK_LIFECYCLE;
    if (lifecycle && typeof lifecycle.removePriorityTokens === 'function') {
      return lifecycle.removePriorityTokens(text);
    }
    return String(text || '').replace(/#p[123]\b/gi, '').replace(/\s+/g, ' ').trim();
  }

  // ---- Task data enrichment ----

  function enrichTask(task) {
    const priority = task.priority || null;
    const displayText = priority ? stripPriorityTokens(task.text) : (task.text || '');
    return {
      ...task,
      priority,
      displayText: escapeHtml(displayText || ''),
      filePath: task.filePath || task.path || '',
      fileKind: task.fileKind || task.kind || '',
      fileName: task.fileName || task.name || task.filePath || '',
    };
  }

  // ---- Filtering ----

  // Pure lifecycle selection helper. Uses the shared normalized Task record
  // (effectiveStatus from MME_TASK_LIFECYCLE.normalizeTask); never re-parses
  // the raw comment and never inspects raw status text when the shared field
  // is available. A defensive checkbox fallback exists only for the
  // compatibility path where the shared field is unexpectedly absent.
  // Never mutates the Task record.
  function matchesStatusFilter(task, selectedStatus) {
    const status = normalizeStatusFilterValue(selectedStatus);
    if (status === 'all') return true;

    let effective = task?.effectiveStatus;
    if (!effective && typeof globalThis.MME_TASK_LIFECYCLE?.effectiveStatusOf === 'function') {
      effective = globalThis.MME_TASK_LIFECYCLE.effectiveStatusOf(
        Boolean(task?.done),
        task?.metadata?.status ?? task?.status ?? ''
      );
    }

    if (status === 'open') return effective !== 'done';
    if (status === 'done') return effective === 'done';
    return effective === status;
  }

  function getAllTasks() {
    const index = getWorkspaceIndex();
    if (!index || !index.ready || !index.tasks) return [];
    return index.tasks.map(enrichTask);
  }

  function getOpenTasks() {
    return getAllTasks().filter((t) => !t.done);
  }

  function getCompletedTasks() {
    return getAllTasks().filter((t) => t.done);
  }

  // Pure AND composition of the visible-Task equation:
  //   lifecycle match  AND  priority match  AND  text-search match.
  // Operates on enriched Tasks (priority + displayText already applied) and
  // returns a NEW array; never mutates Task records. No DOM access.
  function applyTaskFilters(enrichedTasks, filters) {
    const status = normalizeStatusFilterValue(filters?.status);
    const priority = filters?.priority || 'all';
    const query = String(filters?.query || '').trim().toLowerCase();

    let tasks = Array.isArray(enrichedTasks) ? enrichedTasks : [];

    if (status !== 'all') {
      tasks = tasks.filter((t) => matchesStatusFilter(t, status));
    }

    if (priority === 'p1') {
      tasks = tasks.filter((t) => t.priority === 'p1');
    } else if (priority === 'p2') {
      tasks = tasks.filter((t) => t.priority === 'p2');
    } else if (priority === 'p3') {
      tasks = tasks.filter((t) => t.priority === 'p3');
    } else if (priority === 'none') {
      tasks = tasks.filter((t) => !t.priority);
    }
    // 'all' — no priority filter

    if (query) {
      tasks = tasks.filter((t) => {
        const searchable = [
          t.text || '',
          t.displayText || '',
          t.fileName || '',
          t.filePath || '',
          t.heading || '',
          ...(t.tags || []),
        ].join(' ').toLowerCase();
        return searchable.includes(query);
      });
    }

    return tasks;
  }

  function getFilteredTasks() {
    return applyTaskFilters(getAllTasks(), filterState);
  }

  // ---- Grouping helper ----

  function groupTasksByFile(tasks) {
    const index = getWorkspaceIndex();
    const groupsMap = new Map();

    for (const task of tasks) {
      const path = task.filePath || '';
      let groupKey = path;
      let groupPath = path;
      let groupKind = task.fileKind || '';
      let groupFileName = task.fileName || '';
      let groupTitle = task.fileName || 'Unknown source';

      if (!path) {
        // Deterministic fallback for tasks without filePath
        const kind = task.fileKind || '';
        const name = task.fileName || '';
        groupKey = kind && name ? `${kind}::${name}` : name || '__unknown';
        groupPath = '';
        groupKind = kind;
        groupFileName = name || 'Unknown source';
        groupTitle = name ? `Unknown source (${name})` : 'Unknown source';
      } else {
        const parsed = index?.byPath?.get(path);
        groupKind = task.fileKind || parsed?.kind || '';
        groupFileName = task.fileName || parsed?.name || path;
        groupTitle = parsed?.title || parsed?.name || groupFileName || path;
      }

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          path: groupPath,
          kind: groupKind,
          fileName: groupFileName,
          title: groupTitle,
          date: '',
          tasks: [],
        });
      }

      groupsMap.get(groupKey).tasks.push(task);
    }

    const groups = Array.from(groupsMap.values());

    // Sort: journals first, then by date descending, then by title ascending
    groups.sort((a, b) => {
      if (a.kind !== b.kind) {
        if (a.kind === 'journals') return -1;
        if (b.kind === 'journals') return 1;
      }

      const dateA = String(a.date || '');
      const dateB = String(b.date || '');

      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }

      return String(a.title || '').localeCompare(String(b.title || ''));
    });

    // Sort tasks within each group by line number
    for (const group of groups) {
      group.tasks.sort((a, b) => Number(a.line || 0) - Number(b.line || 0));
    }

    return groups;
  }

  // ---- Panel UI ----

  function getSidebarContentHost() {
    const sidebar = document.getElementById('workspaceSidebar');
    if (!sidebar) return null;

    // If the persistent navigation footer is present, panels belong inside the scroller.
    const scroller = sidebar.querySelector(':scope > .workspaceNavScroller');
    return scroller || sidebar;
  }

  function ensureOrUpgradePanel() {
    const host = getSidebarContentHost();
    if (!host) return null;

    let panel = document.getElementById('workspaceTasksPanel');

    // Check if panel already has the Task Review markup
    const hasSearchInput = document.getElementById('workspaceTaskSearchInput');
    const hasStatusFilter = document.getElementById('workspaceTaskStatusFilter');
    const hasPriorityFilter = document.getElementById('workspaceTaskPriorityFilter');
    const hasSummary = document.getElementById('workspaceTasksSummary');
    const hasList = document.getElementById('workspaceTasksList');

    if (panel && hasSearchInput && hasStatusFilter && hasPriorityFilter && hasSummary && hasList) {
      // Panel already upgraded
      return panel;
    }

    // If panel exists but lacks Task Review markup, upgrade it
    if (panel) {
      panel.innerHTML = `
        <div class="workspaceTasksHeader">
          <span class="workspaceTasksHeaderCollapse">
            <button
              type="button"
              class="workspacePanelHeaderButton"
              data-workspace-panel-toggle="tasks"
              aria-expanded="false"
            >
              <span class="workspacePanelHeaderLeft">
                <span class="workspacePanelChevron" aria-hidden="true">▶</span>
                <span class="workspaceTasksTitle">Tasks</span>
              </span>
              <span id="workspaceTasksBadge" class="workspacePanelBadge">0</span>
            </button>
          </span>
          <button
            type="button"
            id="workspaceTaskBoardBtn"
            class="workspaceTaskBoardButton"
            aria-label="Open Task Board"
          >Board</button>
        </div>
        <div class="workspacePanelBody">
          <div id="workspaceTaskSearchRow" class="workspaceTaskSearchRow">
            <input
              type="search"
              id="workspaceTaskSearchInput"
              class="workspaceTaskSearchInput"
              placeholder="Search tasks..."
              autocomplete="off"
            />
          </div>
          <div class="workspaceTaskFilterRow">
            <select
              id="workspaceTaskStatusFilter"
              class="workspaceTaskStatusFilter"
              aria-label="Task status filter"
            >
              <option value="open">Open</option>
              <option value="backlog">Backlog</option>
              <option value="todo">Todo</option>
              <option value="ongoing">Ongoing</option>
              <option value="done">Done</option>
              <option value="all">All</option>
            </select>
            <select id="workspaceTaskPriorityFilter" class="workspaceTaskPriorityFilter">
              <option value="all">All priorities</option>
              <option value="p1">P1</option>
              <option value="p2">P2</option>
              <option value="p3">P3</option>
              <option value="none">No priority</option>
            </select>
          </div>
          <div id="workspaceTasksSummary" class="workspaceRelatedSummary">No tasks</div>
          <div id="workspaceTasksList" class="workspaceTasksList">
            <div class="workspaceTasksEmpty">No tasks</div>
          </div>
        </div>
      `;
      panel.dataset.taskReviewUpgraded = '1';
      safeLog('TaskReview: panel upgraded');
      return panel;
    }

    // Create new panel
    panel = document.createElement('div');
    panel.id = 'workspaceTasksPanel';
    panel.className = 'workspaceSection workspaceTasksPanel';
    panel.hidden = true;

    panel.innerHTML = `
      <div class="workspaceTasksHeader">
        <span class="workspaceTasksHeaderCollapse">
          <button
            type="button"
            class="workspacePanelHeaderButton"
            data-workspace-panel-toggle="tasks"
            aria-expanded="false"
          >
            <span class="workspacePanelHeaderLeft">
              <span class="workspacePanelChevron" aria-hidden="true">▶</span>
              <span class="workspaceTasksTitle">Tasks</span>
            </span>
            <span id="workspaceTasksBadge" class="workspacePanelBadge">0</span>
          </button>
        </span>
        <button
          type="button"
          id="workspaceTaskBoardBtn"
          class="workspaceTaskBoardButton"
          aria-label="Open Task Board"
        >Board</button>
      </div>
      <div class="workspacePanelBody">
        <div id="workspaceTaskSearchRow" class="workspaceTaskSearchRow">
          <input
            type="search"
            id="workspaceTaskSearchInput"
            class="workspaceTaskSearchInput"
            placeholder="Search tasks..."
            autocomplete="off"
          />
        </div>
        <div class="workspaceTaskFilterRow">
          <select
            id="workspaceTaskStatusFilter"
            class="workspaceTaskStatusFilter"
            aria-label="Task status filter"
          >
            <option value="open">Open</option>
            <option value="backlog">Backlog</option>
            <option value="todo">Todo</option>
            <option value="ongoing">Ongoing</option>
            <option value="done">Done</option>
            <option value="all">All</option>
          </select>
          <select id="workspaceTaskPriorityFilter" class="workspaceTaskPriorityFilter">
            <option value="all">All priorities</option>
            <option value="p1">P1</option>
            <option value="p2">P2</option>
            <option value="p3">P3</option>
            <option value="none">No priority</option>
          </select>
        </div>
        <div id="workspaceTasksSummary" class="workspaceRelatedSummary">No tasks</div>
        <div id="workspaceTasksList" class="workspaceTasksList">
          <div class="workspaceTasksEmpty">No tasks</div>
        </div>
      </div>
    `;

    const relatedPanel = document.getElementById('workspaceRelatedPanel');
    const filesSection = host.querySelector('.workspaceFilesSection');

    if (relatedPanel && relatedPanel.nextSibling && relatedPanel.nextSibling.parentNode === host) {
      host.insertBefore(panel, relatedPanel.nextSibling);
    } else if (filesSection) {
      host.insertBefore(panel, filesSection);
    } else {
      host.appendChild(panel);
    }

    panel.dataset.taskReviewUpgraded = '1';
    safeLog('TaskReview: panel created');
    return panel;
  }

  function renderPanel() {
    const panel = ensureOrUpgradePanel();
    if (!panel) {
      safeLog('TaskReview: render skipped; panel not available');
      return;
    }
    const badge = document.getElementById('workspaceTasksBadge');
    const summary = document.getElementById('workspaceTasksSummary');
    const list = document.getElementById('workspaceTasksList');

    if (!badge || !summary || !list) {
      safeLog('TaskReview: render skipped; panel elements missing');
      return;
    }

    panel.hidden = false;

    const ws = getWorkspaceState();
    const index = getWorkspaceIndex();

    if (!ws?.rootHandle) {
      badge.textContent = '0';
      summary.textContent = 'Open a workspace first';
      list.innerHTML = '<div class="workspaceTasksEmpty">Open a workspace first</div>';
      return;
    }

    if (!index?.ready) {
      badge.textContent = '0';
      summary.textContent = 'Index not ready';
      list.innerHTML = '<div class="workspaceTasksEmpty">Index not ready</div>';
      return;
    }

    const filtered = getFilteredTasks();
    const total = getAllTasks().length;
    const groups = groupTasksByFile(filtered);
    const groupCount = groups.length;

    badge.textContent = `${filtered.length}`;
    summary.textContent = filtered.length
      ? `Showing ${filtered.length} of ${total} tasks, grouped in ${groupCount} files`
      : 'No tasks match';

    if (!filtered.length) {
      const statusEmptyMessages = {
        open: 'No open tasks',
        backlog: 'No backlog tasks',
        todo: 'No todo tasks',
        ongoing: 'No ongoing tasks',
        done: 'No done tasks',
        all: 'No tasks',
      };
      const msg = filterState.query
        ? 'No tasks match this search'
        : statusEmptyMessages[filterState.status] || 'No tasks';
      list.innerHTML = `<div class="workspaceTasksEmpty">${msg}</div>`;
      return;
    }

    list.innerHTML = groups
      .map((group) => {
        const icon = group.kind === 'journals' ? '📝' : group.kind === 'concepts' ? '🧠' : '📄';
        const groupTitle = escapeHtml(group.title || group.fileName || group.path);
        const groupPath = escapeHtml(group.path || '');
        const groupKind = escapeHtml(group.kind || '');

        const tasksHtml = group.tasks
          .map((task) => {
            const priorityBadge = task.priority
              ? `<span class="workspaceTaskPriorityBadge priority-${task.priority}">${task.priority.toUpperCase()}</span>`
              : '';
            const doneClass = task.done ? ' workspaceTaskDone' : '';
            const displayText = escapeHtml(task.displayText || task.text || '');
            const filePath = escapeHtml(task.filePath || '');
            const fileName = escapeHtml(task.fileName || task.filePath || '');
            const line = Number(task.line || 0);

            return `
              <div class="workspaceTaskRow${doneClass}" data-task-id="${escapeHtml(task.id || '')}">
                <div class="workspaceTaskRowMain">
                  <button
                    type="button"
                    class="workspaceTaskStatusBtn"
                    data-path="${filePath}"
                    data-kind="${escapeHtml(task.fileKind || '')}"
                    data-line="${line}"
                    data-current-checked="${task.done ? '1' : '0'}"
                    title="${task.done ? 'Reopen' : 'Complete'}"
                    aria-label="${task.done ? 'Reopen task' : 'Complete task'}"
                  >${task.done ? '☑' : '☐'}</button>
                  ${priorityBadge}
                  <span class="workspaceTaskRowText">${displayText}</span>
                </div>
                <div class="workspaceTaskRowMeta">
                  <button
                    type="button"
                    class="workspaceTaskOpenBtn"
                    data-path="${filePath}"
                    data-kind="${escapeHtml(task.fileKind || '')}"
                    data-line="${line}"
                    title="Open ${filePath}${line ? `:${line}` : ''}"
                  >
                    ${fileName}${line ? `:${line}` : ''}
                  </button>
                  <span class="workspaceTaskPriorityActions">
                    <button type="button" class="workspaceTaskPriorityAction" data-action="p1" title="Set P1">P1</button>
                    <button type="button" class="workspaceTaskPriorityAction" data-action="p2" title="Set P2">P2</button>
                    <button type="button" class="workspaceTaskPriorityAction" data-action="p3" title="Set P3">P3</button>
                    ${task.priority ? '<button type="button" class="workspaceTaskPriorityAction" data-action="clear" title="Clear priority">✕</button>' : ''}
                  </span>
                </div>
              </div>
            `;
          })
          .join('');

        return `
          <div class="workspaceTaskGroup">
            <button
              type="button"
              class="workspaceTaskGroupHeader"
              data-workspace-task-group="1"
              data-path="${groupPath}"
              data-kind="${groupKind}"
              title="Open ${groupPath}"
            >
              <span class="workspaceTaskGroupTitle">
                <span class="workspaceTaskGroupTitleIcon" aria-hidden="true">${icon}</span>
                <span class="workspaceTaskGroupTitleText">${groupTitle}</span>
              </span>
              <span class="workspaceTaskGroupCount">${group.tasks.length}</span>
            </button>
            <div class="workspaceTasksGroupItems">
              ${tasksHtml}
            </div>
          </div>
        `;
      })
      .join('');
  }

  // ---- Open source file (file-level, no task line) ----

  async function openSourceFile(path, kind, reason) {
    const findFn = typeof globalThis.findWorkspaceFileByPath === 'function'
      ? globalThis.findWorkspaceFileByPath
      : typeof window.findWorkspaceFileByPath === 'function'
      ? window.findWorkspaceFileByPath
      : null;

    if (!findFn) {
      safeLog('TaskReview: findWorkspaceFileByPath not available');
      return;
    }

    const file = findFn(path, kind);
    if (!file || !file.handle) {
      safeLog(`TaskReview: file not found path=${path} kind=${kind}`);
      globalThis.showToast?.('Source file not found', 'error', 2200);
      return;
    }

    safeLog(`TaskReview: opening source ${path} reason=${reason}`);

    const openFn = typeof globalThis.openWorkspaceFile === 'function'
      ? globalThis.openWorkspaceFile
      : typeof window.openWorkspaceFile === 'function'
      ? window.openWorkspaceFile
      : null;

    if (openFn) {
      await openFn(file, kind || file.kind, reason || 'task review open source');
    } else {
      safeLog('TaskReview: openWorkspaceFile not available');
    }
  }

  // ---- Open task source ----

  async function openTaskSource(path, kind, line) {
    if (taskOpenInProgress) {
      safeLog('TaskReview: open already in progress, skipping');
      return;
    }

    taskOpenInProgress = true;

    try {
      const findFn = typeof globalThis.findWorkspaceFileByPath === 'function'
        ? globalThis.findWorkspaceFileByPath
        : typeof window.findWorkspaceFileByPath === 'function'
        ? window.findWorkspaceFileByPath
        : null;

      if (!findFn) {
        safeLog('TaskReview: findWorkspaceFileByPath not available');
        return;
      }

      const file = findFn(path, kind);
      if (!file || !file.handle) {
        safeLog(`TaskReview: file not found path=${path} kind=${kind}`);
        globalThis.showToast?.('Task file not found', 'error', 2200);
        return;
      }

      safeLog(`TaskReview: opening source ${path} line=${line}`);

      const openFn = typeof globalThis.openWorkspaceFile === 'function'
        ? globalThis.openWorkspaceFile
        : typeof window.openWorkspaceFile === 'function'
        ? window.openWorkspaceFile
        : null;

      if (openFn) {
        await openFn(file, kind || file.kind, 'task review open');
      } else {
        safeLog('TaskReview: openWorkspaceFile not available');
      }

      // Wait for file activation
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });

      // Scroll to the line and focus editor
      const scrollToLine = typeof window.__cmScrollToLine === 'function' ? window.__cmScrollToLine : null;
      if (scrollToLine) {
        scrollToLine(line - 1); // Convert 1-based to 0-based
      }

      // Focus the editor
      const focusEditor = typeof window.__cmFocus === 'function' ? window.__cmFocus : null;
      if (focusEditor) {
        focusEditor();
      }
    } catch (e) {
      safeLog(`TaskReview: open failed: ${e?.message || e}`);
    } finally {
      taskOpenInProgress = false;
    }
  }

  // ---- Priority actions ----

  function getCanonicalTaskText(rawLine) {
    try {
      const parsed = globalThis.parseMarkdownTasks?.(rawLine);
      if (parsed && parsed[0] && typeof parsed[0].text === 'string') {
        return parsed[0].text;
      }
    } catch {}

    const text = String(rawLine || '');
    const match = text.match(/^(\s*[-*+]\s+\[[ xX]\]\s+)(.*)$/);
    if (!match) return text;

    let content = match[2] || '';
    content = content.replace(/<!--\s*mme-task:[\s\S]*?-->/gi, '').trim();
    content = stripPriorityTokens(content);
    return content;
  }

  // Normalize task text for comparison (preserves identity-bearing content)
  function normalizeTaskTextForComparison(text) {
    let value = String(text || '')
      .replace(/^(\s*[-*+]\s+\[[ xX]\]\s+)/, '') // Remove checkbox prefix
      .replace(/<!--\s*mme-task:[\s\S]*?-->/gi, ''); // Remove recognized metadata comments
    value = stripPriorityTokens(value); // Remove priority tokens (shared grammar)
    return value
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toLowerCase();
  }

  // Find the actual line for a task, with nearby fallback
  function findActualTaskLine(getLineText, indexedLine, expectedText) {
    // P1-DIAG: capture indexed task state
    const diagExpected = String(expectedText ?? '');
    const diagExpectedNorm = normalizeTaskTextForComparison(diagExpected);
    safeLog(
      `TaskReview: findActualTaskLine START indexedLine=${indexedLine} expected="${diagExpected}" expectedNorm="${diagExpectedNorm}"`
    );

    // First, check the exact indexed line
    const exactLineText = getLineText(indexedLine);
    if (exactLineText !== null) {
      const exactMatch = exactLineText.match(/^(\s*[-*+]\s+\[[ xX]\]\s+)(.*)$/);
      if (exactMatch) {
        const exactNorm = normalizeTaskTextForComparison(exactMatch[2]);
        safeLog(
          `TaskReview: findActualTaskLine exactLine=${indexedLine} raw="${exactLineText}" match2="${exactMatch[2]}" norm="${exactNorm}" equal=${exactNorm === diagExpectedNorm}`
        );
        if (exactNorm === diagExpectedNorm) {
          return indexedLine;
        }
      } else {
        safeLog(
          `TaskReview: findActualTaskLine exactLine=${indexedLine} raw="${exactLineText}" NO_TASK_MATCH`
        );
      }
    } else {
      safeLog(`TaskReview: findActualTaskLine exactLine=${indexedLine} NULL_LINE`);
    }

    // Search nearby range (indexedLine - 3 through indexedLine + 3)
    const candidates = [];
    for (let offset = -3; offset <= 3; offset++) {
      if (offset === 0) continue; // Already checked
      const checkLine = indexedLine + offset;
      const checkText = getLineText(checkLine);
      if (checkText === null) continue;

      const checkMatch = checkText.match(/^(\s*[-*+]\s+\[[ xX]\]\s+)(.*)$/);
      if (checkMatch) {
        const candidateNorm = normalizeTaskTextForComparison(checkMatch[2]);
        const equal = candidateNorm === diagExpectedNorm;
        safeLog(
          `TaskReview: findActualTaskLine candidate line=${checkLine} raw="${checkText}" match2="${checkMatch[2]}" norm="${candidateNorm}" equal=${equal}`
        );
        if (equal) {
          candidates.push({ line: checkLine, text: checkText });
        }
      }
    }

    if (candidates.length === 0) {
      safeLog(`TaskReview: findActualTaskLine NO_CANDIDATES indexedLine=${indexedLine}`);
      return null; // No match found
    }

    if (candidates.length > 1) {
      safeLog(
        `TaskReview: findActualTaskLine AMBIGUOUS candidates=${candidates.length} indexedLine=${indexedLine}`
      );
      return { ambiguous: true }; // Multiple matches
    }

    safeLog(`TaskReview: findActualTaskLine MATCH line=${candidates[0].line}`);
    return candidates[0].line; // Unique match
  }

  async function setTaskPriority(path, kind, line, newPriority) {
    if (taskPriorityInProgress) {
      safeLog('TaskReview: priority change already in progress, skipping');
      return;
    }

    taskPriorityInProgress = true;

    try {
      const index = getWorkspaceIndex();
      if (!index || !index.ready) {
        safeLog('TaskReview: index not ready for priority edit');
        return;
      }

      // Find the file record
      const findFn = typeof globalThis.findWorkspaceFileByPath === 'function'
        ? globalThis.findWorkspaceFileByPath
        : typeof window.findWorkspaceFileByPath === 'function'
        ? window.findWorkspaceFileByPath
        : null;

      if (!findFn) {
        safeLog('TaskReview: findWorkspaceFileByPath not available');
        return;
      }

      const file = findFn(path, kind);
      if (!file || !file.handle) {
        safeLog(`TaskReview: file not found for priority edit path=${path}`);
        globalThis.showToast?.('File not found', 'error', 2200);
        return;
      }

      // Open the file first
      const openFn = typeof globalThis.openWorkspaceFile === 'function'
        ? globalThis.openWorkspaceFile
        : typeof window.openWorkspaceFile === 'function'
        ? window.openWorkspaceFile
        : null;

      if (!openFn) {
        safeLog('TaskReview: openWorkspaceFile not available');
        return;
      }

      const result = await openFn(file, kind || file.kind, 'task priority edit');
      if (!result) {
        safeLog('TaskReview: file open cancelled or failed');
        return;
      }

      // Wait for file activation and at least one animation frame
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });

      // Now edit the source line
      try {
        // Use stable CodeMirror bridge if available
        const getLineText = typeof window.__cmGetLineText === 'function' ? window.__cmGetLineText : null;
        const replaceLine = typeof window.__cmReplaceLine === 'function' ? window.__cmReplaceLine : null;
        const scrollToLine = typeof window.__cmScrollToLine === 'function' ? window.__cmScrollToLine : null;

        if (!getLineText || !replaceLine) {
          safeLog('TaskReview: CodeMirror bridge not available for priority edit');
          globalThis.showToast?.('Editor not ready', 'error', 2200);
          return;
        }

        // Get the expected task text from the index for comparison
        const indexedTask = index.tasks?.find((t) => t.filePath === path && t.line === line);
        const expectedText = indexedTask?.text || '';

        // Find the actual line (with nearby fallback)
        const actualLine = findActualTaskLine(getLineText, line, expectedText);

        if (actualLine === null) {
          safeLog(`TaskReview: task not found near indexed line ${line}`);
          globalThis.showToast?.('Task not found. Try refreshing the workspace index.', 'error', 2600);
          return;
        }

        if (actualLine && actualLine.ambiguous) {
          safeLog(`TaskReview: multiple tasks match near indexed line ${line}`);
          globalThis.showToast?.('Multiple matching tasks found. Cannot edit.', 'error', 2600);
          return;
        }

        // Log if we used a shifted line
        if (actualLine !== line) {
          safeLog(`TaskReview: shifted task resolved indexedLine=${line} actualLine=${actualLine}`);
        }

        // Validate the actual line
        const lineText = getLineText(actualLine);
        if (lineText === null) {
          safeLog(`TaskReview: line ${actualLine} not found`);
          globalThis.showToast?.('Task line not found', 'error', 2200);
          return;
        }

        const taskMatch = lineText.match(/^(\s*[-*+]\s+\[[ xX]\]\s+)(.*)$/);
        if (!taskMatch) {
          safeLog(`TaskReview: line ${actualLine} is not a task`);
          globalThis.showToast?.('Line is not a task', 'error', 2200);
          return;
        }

        const prefix = taskMatch[1];
        const content = taskMatch[2];

        // Remove existing priority tokens (shared removal grammar; identical
        // semantics: tokens removed, whitespace collapsed, trimmed)
        let newContent = stripPriorityTokens(content);

        // Add new priority token
        if (newPriority === 'p1') newContent = newContent + ' #p1';
        else if (newPriority === 'p2') newContent = newContent + ' #p2';
        else if (newPriority === 'p3') newContent = newContent + ' #p3';
        // clear: no token added

        const newLine = prefix + newContent;

        // Apply edit via CodeMirror bridge
        const success = replaceLine(actualLine, newLine, { scrollTo: true });
        if (!success) {
          safeLog('TaskReview: priority edit failed (replaceLine returned false)');
          globalThis.showToast?.('Priority edit failed', 'error', 2200);
          return;
        }

        // Scroll to the actual line
        if (scrollToLine) {
          scrollToLine(actualLine - 1); // Convert 1-based to 0-based
        }

        safeLog(`TaskReview: priority changed ${newPriority || 'cleared'} on ${path}:${actualLine}`);

        await saveAfterTaskMutation(
          `priority changed ${newPriority || 'cleared'}`,
          file,
          kind || file.kind
        );
      } catch (e) {
        safeLog(`TaskReview: priority edit failed: ${e?.message || e}`);
        globalThis.showToast?.('Priority edit failed', 'error', 2200);
      } finally {
        taskPriorityInProgress = false;
      }
    } catch (e) {
      safeLog(`TaskReview: priority edit failed: ${e?.message || e}`);
      globalThis.showToast?.('Priority edit failed', 'error', 2200);
    }
  }

  // ---- Wiring ----

  function wire() {
    const panel = ensureOrUpgradePanel();
    if (!panel) {
      safeLog('TaskReview: wire deferred; panel not available');
      return false;
    }

    if (wiredPanel === panel) {
      return true;
    }

    // Search input
    const searchInput = document.getElementById('workspaceTaskSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        filterState.query = searchInput.value;
        renderPanel();
      });
    }

    // Lifecycle status filter — one guarded change listener on the single
    // semantic select. Selection persists immediately; render runs once.
    const statusSelect = document.getElementById('workspaceTaskStatusFilter');
    if (statusSelect) {
      statusSelect.value = filterState.status;
      statusSelect.addEventListener('change', () => {
        filterState.status = setStoredStatusFilter(statusSelect.value);
        statusSelect.value = filterState.status;
        renderPanel();
      });
    }

    // Priority filter
    const prioritySelect = document.getElementById('workspaceTaskPriorityFilter');
    if (prioritySelect) {
      prioritySelect.addEventListener('change', () => {
        filterState.priority = prioritySelect.value;
        renderPanel();
      });
    }

    // Board entry action (Quick View). Single click handler; idempotence is
    // inherited from the wiredPanel === panel guard above. Delegates to the
    // single Board owner; never creates duplicate overlays.
    const boardBtn = document.getElementById('workspaceTaskBoardBtn');
    if (boardBtn) {
      boardBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        globalThis.MME_TASK_BOARD?.open?.(boardBtn);
      });
    }

    // Delegated click handler on panel
    panel.addEventListener('click', async (event) => {
      // Completion / reopen toggle
      const statusBtn = event.target?.closest?.('.workspaceTaskStatusBtn');
      if (statusBtn) {
        event.preventDefault();
        event.stopPropagation();
        const path = statusBtn.dataset.path || '';
        const kind = statusBtn.dataset.kind || '';
        const line = Number(statusBtn.dataset.line || 0);
        const currentChecked = statusBtn.dataset.currentChecked === '1';
        const desiredChecked = !currentChecked;
        if (!path) {
          safeLog('TaskReview: status click skipped; empty path');
          return;
        }
        safeLog(`TaskReview: status action=${desiredChecked ? 'complete' : 'reopen'} path=${path} line=${line}`);
        await setTaskCompletion(path, kind, line, desiredChecked);
        return;
      }

      // Open task source
      const openBtn = event.target?.closest?.('.workspaceTaskOpenBtn');
      if (openBtn) {
        event.preventDefault();
        event.stopPropagation();
        const path = openBtn.dataset.path || '';
        const kind = openBtn.dataset.kind || '';
        const line = Number(openBtn.dataset.line || 0);
        if (!path) {
          safeLog('TaskReview: task-source click skipped; empty path');
          return;
        }
        safeLog(`TaskReview: task-source click path=${path} line=${line}`);
        await openTaskSource(path, kind, line);
        return;
      }

      // Open group header (source file) — file-level open only
      // Task Review is the sole owner of Task group-header opening. The legacy
      // Workspace Tasks handler returns early whenever MME_TASK_REVIEW exists,
      // so this handler opens the source exactly once per click.
      const groupHeader = event.target?.closest?.('.workspaceTaskGroupHeader');
      if (groupHeader) {
        event.preventDefault();
        event.stopPropagation();
        const path = groupHeader.dataset.path || '';
        const kind = groupHeader.dataset.kind || '';
        if (!path) {
          safeLog('TaskReview: group-header click skipped; empty path');
          return;
        }
        safeLog(`TaskReview: group-header click path=${path}`);
        await openSourceFile(path, kind, 'workspace task group open');
        return;
      }

      // Priority action
      const priorityBtn = event.target?.closest?.('.workspaceTaskPriorityAction');
      if (priorityBtn) {
        event.preventDefault();
        event.stopPropagation();

        const action = priorityBtn.dataset.action || '';
        if (!action) return;

        const taskRow = priorityBtn.closest('.workspaceTaskRow');
        if (!taskRow) return;

        // Find the open button to get path/kind/line
        const openBtn2 = taskRow.querySelector('.workspaceTaskOpenBtn');
        if (!openBtn2) return;

        const path = openBtn2.dataset.path || '';
        const kind = openBtn2.dataset.kind || '';
        const line = Number(openBtn2.dataset.line || 0);

        if (!path) {
          safeLog('TaskReview: priority action skipped; empty path');
          return;
        }

        safeLog(`TaskReview: priority action=${action} path=${path} line=${line}`);

        if (action === 'clear') {
          await setTaskPriority(path, kind, line, '');
        } else if (action === 'p1' || action === 'p2' || action === 'p3') {
          await setTaskPriority(path, kind, line, action);
        }
        return;
      }
    });

    wiredPanel = panel;
    safeLog('TaskReview: wired');
    return true;
  }

  // ---- Task completion ----

  function getLocalIsoDate() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function rewriteTaskMetadataComment(text, desiredChecked) {
    const str = String(text || '');
    const commentMatch = str.match(/(<!--\s*mme-task:)([\s\S]*?)(\s*-->)/i);

    if (!commentMatch) {
      if (!desiredChecked) return str;
      const today = getLocalIsoDate();
      return `${str.trim()} <!-- mme-task: completed=${today} -->`;
    }

    let inner = String(commentMatch[2] || '').trim();

    if (desiredChecked) {
      const hasCompleted = /(?:^|;\s*)completed\s*=/i.test(inner);
      if (!hasCompleted) {
        inner = inner ? `completed=${getLocalIsoDate()}; ${inner}` : `completed=${getLocalIsoDate()}`;
      }
    } else {
      inner = inner.replace(/(?:^|;\s*)completed\s*=\s*[^;]+/i, '').replace(/^;\s*/, '').replace(/;\s*$/, '').trim();
    }

    if (!inner) {
      return str.replace(commentMatch[0], '').trim();
    }

    return `${str.slice(0, commentMatch.index)}<!-- mme-task: ${inner} -->${str.slice(commentMatch.index + commentMatch[0].length)}`;
  }

  async function setTaskCompletion(path, kind, line, desiredChecked) {
    if (taskStatusInProgress) {
      safeLog('TaskReview: status change already in progress, skipping');
      return;
    }

    taskStatusInProgress = true;

    try {
      const index = getWorkspaceIndex();
      if (!index || !index.ready) {
        safeLog('TaskReview: index not ready for status edit');
        return;
      }

      const findFn = typeof globalThis.findWorkspaceFileByPath === 'function'
        ? globalThis.findWorkspaceFileByPath
        : typeof window.findWorkspaceFileByPath === 'function'
        ? window.findWorkspaceFileByPath
        : null;

      if (!findFn) {
        safeLog('TaskReview: findWorkspaceFileByPath not available');
        return;
      }

      const file = findFn(path, kind);
      if (!file || !file.handle) {
        safeLog(`TaskReview: file not found for status edit path=${path}`);
        globalThis.showToast?.('File not found', 'error', 2200);
        return;
      }

      const openFn = typeof globalThis.openWorkspaceFile === 'function'
        ? globalThis.openWorkspaceFile
        : typeof window.openWorkspaceFile === 'function'
        ? window.openWorkspaceFile
        : null;

      if (!openFn) {
        safeLog('TaskReview: openWorkspaceFile not available');
        return;
      }

      const result = await openFn(file, kind || file.kind, 'task status change');
      if (!result) {
        safeLog('TaskReview: file open cancelled or failed');
        return;
      }

      // Wait for file activation
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      });

      // Validate and edit the source line
      const getLineText = typeof window.__cmGetLineText === 'function' ? window.__cmGetLineText : null;
      const replaceLine = typeof window.__cmReplaceLine === 'function' ? window.__cmReplaceLine : null;

      if (!getLineText || !replaceLine) {
        safeLog('TaskReview: CodeMirror bridge not available for status edit');
        globalThis.showToast?.('Editor not ready', 'error', 2200);
        return;
      }

      const indexedTask = index.tasks?.find((t) => t.filePath === path && t.line === line);
      const expectedText = getCanonicalTaskText(indexedTask?.text || '');

      const actualLine = findActualTaskLine(getLineText, line, expectedText);

      if (actualLine === null) {
        safeLog(`TaskReview: status task not found near indexed line ${line}`);
        globalThis.showToast?.('Task not found. Try refreshing the workspace index.', 'error', 2600);
        return;
      }

      if (actualLine && actualLine.ambiguous) {
        safeLog(`TaskReview: status task ambiguous near indexed line ${line}`);
        globalThis.showToast?.('Multiple matching tasks found. Cannot edit.', 'error', 2600);
        return;
      }

      const lineText = getLineText(actualLine);
      if (lineText === null) {
        safeLog(`TaskReview: line ${actualLine} not found for status edit`);
        globalThis.showToast?.('Task line not found', 'error', 2200);
        return;
      }

      const taskMatch = lineText.match(/^(\s*[-*+]\s+\[)([ xX])(\]\s+)(.*)$/);
      if (!taskMatch) {
        safeLog(`TaskReview: line ${actualLine} is not a task for status edit`);
        globalThis.showToast?.('Line is not a task', 'error', 2200);
        return;
      }

      const currentChecked = taskMatch[2].toLowerCase() === 'x';
      if (currentChecked === desiredChecked) {
        safeLog(`TaskReview: status already satisfied path=${path} line=${actualLine} desired=${desiredChecked}`);
        return;
      }

      const newCheckbox = desiredChecked ? 'x' : ' ';
      const newText = rewriteTaskMetadataComment(taskMatch[4], desiredChecked);
      const newLine = taskMatch[1] + newCheckbox + taskMatch[3] + newText;

      const success = replaceLine(actualLine, newLine, { scrollTo: false });
      if (!success) {
        safeLog('TaskReview: status edit failed (replaceLine returned false)');
        globalThis.showToast?.('Status edit failed', 'error', 2200);
        return;
      }

      safeLog(`TaskReview: ${desiredChecked ? 'completed' : 'reopened'} path=${path} line=${actualLine}`);

      await saveAfterTaskMutation(
        desiredChecked ? 'task completed' : 'task reopened',
        file,
        kind || file.kind
      );
    } catch (e) {
      safeLog(`TaskReview: status edit failed: ${e?.message || e}`);
      globalThis.showToast?.('Status edit failed', 'error', 2200);
    } finally {
      taskStatusInProgress = false;
    }
  }

  async function saveAfterTaskMutation(reason, file, kind) {
    const saveFn = typeof globalThis.saveSmart === 'function'
      ? globalThis.saveSmart
      : typeof window.saveSmart === 'function'
      ? window.saveSmart
      : null;

    if (!saveFn) {
      safeLog('TaskReview: save workflow not available after mutation');
      globalThis.showToast?.('Change applied but could not auto-save', 'error', 2600);
      return;
    }

    try {
      const result = await saveFn();
      if (result === false) {
        safeLog(`TaskReview: ${reason} save cancelled`);
        globalThis.showToast?.('Change applied but save was cancelled', 'error', 2600);
        return;
      }

      safeLog(`TaskReview: ${reason} saved`);

      if (typeof globalThis.MME_RENDER?.scheduleRender === 'function') {
        globalThis.MME_RENDER.scheduleRender(`task ${reason} saved`);
      }

      globalThis.showToast?.(`Saved`, 'ok', 1800);
    } catch (e) {
      safeLog(`TaskReview: ${reason} save failed: ${e?.message || e}`);
      globalThis.showToast?.('Save failed. Editor retains your change.', 'error', 3000);
    }
  }

  function refresh() {
    const index = getWorkspaceIndex();
    safeLog(`TaskReview: refresh indexReady=${Boolean(index?.ready)} tasks=${index?.tasks?.length || 0}`);
    wire();
    renderPanel();
  }

  // ---- Deterministic pure validator (no DOM) ----
  //
  // Verifies TaskReview lifecycle selection and AND composition. Lifecycle
  // semantics themselves remain owned by MME_TASK_LIFECYCLE; this validator
  // only checks how TaskReview consumes the shared normalized Task record.

  function runValidator() {
    const results = [];
    let passed = 0;
    let failed = 0;

    const check = (label, ok, detail) => {
      results.push({ label, pass: Boolean(ok), detail: ok ? '' : detail == null ? '' : String(detail) });
      if (ok) passed += 1;
      else failed += 1;
    };

    // ---- matchesStatusFilter (shared normalized fields) ----
    const backlogTask = { text: 'Backlog task', done: false, effectiveStatus: 'backlog', metadata: { status: 'backlog' } };
    const todoTask = { text: 'Todo task', done: false, effectiveStatus: 'todo', metadata: {} };
    const ongoingTask = { text: 'Ongoing task', done: false, effectiveStatus: 'ongoing', metadata: { status: 'ongoing' } };
    const doneTask = { text: 'Done task', done: true, effectiveStatus: 'done', metadata: {} };
    // Checkbox-authority fallback case (shared field absent, done wins over raw status)
    const conflictTask = { text: 'Checked with ongoing', done: true, metadata: { status: 'ongoing' } };

    check('A Open includes Backlog', matchesStatusFilter(backlogTask, 'open') === true);
    check('B Open includes Todo', matchesStatusFilter(todoTask, 'open') === true);
    check('C Open includes Ongoing', matchesStatusFilter(ongoingTask, 'open') === true);
    check('D Open excludes Done', matchesStatusFilter(doneTask, 'open') === false);
    check('E Backlog matches only Backlog', matchesStatusFilter(backlogTask, 'backlog') === true && matchesStatusFilter(todoTask, 'backlog') === false);
    check('F Todo matches Todo-by-absence', matchesStatusFilter(todoTask, 'todo') === true);
    check('G Todo excludes Backlog and Ongoing', matchesStatusFilter(backlogTask, 'todo') === false && matchesStatusFilter(ongoingTask, 'todo') === false);
    check('H Ongoing matches only Ongoing', matchesStatusFilter(ongoingTask, 'ongoing') === true && matchesStatusFilter(todoTask, 'ongoing') === false);
    check('I Done includes checked Task', matchesStatusFilter(doneTask, 'done') === true);
    check('J Done checkbox authority over conflicting raw status', matchesStatusFilter(conflictTask, 'done') === true);
    check('J2 unchecked with completed metadata is not Done', matchesStatusFilter({ done: false, effectiveStatus: 'todo', metadata: { completed: '2026-01-01' } }, 'done') === false);
    const all = [backlogTask, todoTask, ongoingTask, doneTask];
    check('K All includes every Task', all.every((t) => matchesStatusFilter(t, 'all') === true));

    // ---- compatibility normalization ----
    check('L legacy completed normalizes to done', normalizeStatusFilterValue('completed') === 'done');
    check('M invalid saved status normalizes to open', normalizeStatusFilterValue('bogus') === 'open' && normalizeStatusFilterValue('') === 'open' && normalizeStatusFilterValue(null) === 'open');
    check('M2 canonical values are stable', normalizeStatusFilterValue('BACKLOG') === 'backlog' && normalizeStatusFilterValue('all') === 'all');

    // ---- AND composition via pure applyTaskFilters ----
    // enrich a small fixture set with displayText/priority the way the panel does
    const enriched = [backlogTask, todoTask, ongoingTask, doneTask].map(enrichTask);
    const snapshot = JSON.stringify(enriched);

    // Add a P1 Todo so the negative case has a real P1-open fixture.
    const p1Todo = enrichTask({ text: 'Prio #p1 todo', done: false, priority: 'p1', effectiveStatus: 'todo', filePath: 'j/a.md', fileKind: 'journals', fileName: 'a.md', line: 1, heading: '' });
    const fixtureAll = [enrichTask(backlogTask), p1Todo, enrichTask(ongoingTask), enrichTask(doneTask)];

    const openP1 = applyTaskFilters(fixtureAll, { status: 'open', priority: 'p1', query: '' });
    check('N lifecycle + P1 is AND', openP1.length === 1 && openP1[0].priority === 'p1');

    const openNone = applyTaskFilters(fixtureAll, { status: 'open', priority: 'none', query: '' });
    check('O lifecycle + No priority is AND', openNone.length === 2 && openNone.every((t) => !t.priority));

    const openSearch = applyTaskFilters(fixtureAll, { status: 'open', priority: 'all', query: 'ongoing' });
    check('P lifecycle + search is AND', openSearch.length === 1 && openSearch[0].text === 'Ongoing task');

    const allThree = applyTaskFilters(fixtureAll, { status: 'open', priority: 'p1', query: 'prio' });
    check('P2 search + priority + lifecycle all AND', allThree.length === 1 && allThree[0].text === 'Prio #p1 todo');

    check('Q filtering does not mutate Task records', JSON.stringify(enriched) === snapshot && applyTaskFilters(fixtureAll, { status: 'all', priority: 'all', query: '' }).length === fixtureAll.length);

    // display-text guarantees
    const displayP1 = fixtureAll.find((t) => t.text === 'Prio #p1 todo');
    check('R priority tokens absent from display text', displayP1 && displayP1.displayText === 'Prio todo');

    const hashtag = enrichTask({ text: 'Discuss #project roadmap', done: false, effectiveStatus: 'todo', priority: null, filePath: 'j/a.md', fileKind: 'journals', fileName: 'a.md', line: 5, heading: '', tags: ['project'] });
    check('S unrelated hashtags remain visible', hashtag.displayText.indexOf('#project') !== -1);
    const hashtagSearch = applyTaskFilters([hashtag], { status: 'all', priority: 'all', query: '#project' });
    check('S2 unrelated hashtags remain searchable', hashtagSearch.length === 1);

    return {
      ok: failed === 0,
      total: results.length,
      passed,
      failed,
      results,
    };
  }

  // ---- Public API ----

  const MME_TASK_REVIEW = {
    wire,
    refresh,
    setSearchQuery: (q) => { filterState.query = String(q || ''); renderPanel(); },
    setStatusFilter: (s) => { filterState.status = setStoredStatusFilter(s); renderPanel(); },
    setPriorityFilter: (p) => { filterState.priority = p || 'all'; renderPanel(); },
    matchesStatusFilter,
    normalizeStatusFilterValue,
    applyTaskFilters,
    getFilteredTasks,
    getAllTasks,
    getOpenTasks,
    getCompletedTasks,
    openTaskSource,
    setTaskPriority,
    setTaskCompletion,
    findActualTaskLine, // Exposed for testing
    validate: runValidator, // Deterministic, DOM-free
  };

  try {
    window.MME_TASK_REVIEW = MME_TASK_REVIEW;
    globalThis.MME_TASK_REVIEW = MME_TASK_REVIEW;
  } catch {}

  safeLog('TaskReview: module loaded');

  // Late-load recovery: attempt wiring immediately if the panel already exists.
  // If no sidebar/panel is present yet, wire() returns false and refresh()
  // will recover once the workspace is set up.
  try {
    if (document.getElementById('workspaceSidebar')) {
      wire();
    }
  } catch {}
})();
