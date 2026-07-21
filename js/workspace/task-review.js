// @ts-nocheck
// R-TASK2 + R-TASK3 — Task Search, Status Filters, and Priority
// Reuses existing workspace index and task parser.
// ================================

(function () {
  'use strict';

  // ---- Private state ----

  let wired = false;
  let taskOpenInProgress = false;

  const filterState = {
    query: '',
    status: 'open',
    priority: 'all',
  };

  // ---- Private helpers ----

  function safeLog(msg) {
    if (typeof globalThis.log === 'function') {
      globalThis.log(msg);
    }
  }
 }());

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

  function normalizePriorityTag(tag) {
    const t = String(tag || '').trim().toLowerCase();
    if (t === '#p1' || t === 'p1') return 'p1';
    if (t === '#p2' || t === 'p2') return 'p2';
    if (t === '#p3' || t === 'p3') return 'p3';
    return '';
  }

  function extractPriorityFromText(text) {
    const tokens = String(text || '').match(/#p[123]\b/gi);
    if (!tokens) return '';

    const priorities = tokens.map((t) => normalizePriorityTag(t)).filter(Boolean);
    if (priorities.length === 0) return '';

    // Highest priority wins: p1 > p2 > p3
    if (priorities.includes('p1')) return 'p1';
    if (priorities.includes('p2')) return 'p2';
    return 'p3';
  }

  function removePriorityTokens(text) {
    return String(text || '').replace(/#p[123]\b/gi, '').replace(/\s+/g, ' ').trim();
  }

  // ---- Task data enrichment ----

  function enrichTask(task) {
    const priority = extractPriorityFromText(task.text || '');
    const displayText = priority ? removePriorityTokens(task.text) : (task.text || '');
    return {
      ...task,
      priority,
      displayText,
      filePath: task.filePath || task.path || '',
      fileKind: task.fileKind || task.kind || '',
      fileName: task.fileName || task.name || task.filePath || '',
    };
  }

  // ---- Filtering ----

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

  function getFilteredTasks() {
    let tasks = getAllTasks();

    // Status filter
    if (filterState.status === 'open') {
      tasks = tasks.filter((t) => !t.done);
    } else if (filterState.status === 'completed') {
      tasks = tasks.filter((t) => t.done);
    }
    // 'all' — no filter

    // Priority filter
    if (filterState.priority === 'p1') {
      tasks = tasks.filter((t) => t.priority === 'p1');
    } else if (filterState.priority === 'p2') {
      tasks = tasks.filter((t) => t.priority === 'p2');
    } else if (filterState.priority === 'p3') {
      tasks = tasks.filter((t) => t.priority === 'p3');
    } else if (filterState.priority === 'none') {
      tasks = tasks.filter((t) => !t.priority);
    }
    // 'all' — no filter

    // Text search
    const query = filterState.query.trim().toLowerCase();
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

  // ---- Panel UI ----

  function ensureOrUpgradePanel() {
    const sidebar = document.getElementById('workspaceSidebar');
    if (!sidebar) return null;

    let panel = document.getElementById('workspaceTasksPanel');

    // Check if panel already has the Task Review markup
    const hasSearchInput = document.getElementById('workspaceTaskSearchInput');
    const hasStatusFilters = document.querySelector('.workspaceTaskStatusFilters');
    const hasPriorityFilter = document.getElementById('workspaceTaskPriorityFilter');
    const hasSummary = document.getElementById('workspaceTasksSummary');
    const hasList = document.getElementById('workspaceTasksList');

    if (panel && hasSearchInput && hasStatusFilters && hasPriorityFilter && hasSummary && hasList) {
      // Panel already upgraded
      return panel;
    }

    // If panel exists but lacks Task Review markup, upgrade it
    if (panel) {
      panel.innerHTML = `
        <div class="workspaceTasksHeader">
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
            <div class="workspaceTaskStatusFilters">
              <button type="button" class="workspaceTaskFilterBtn active" data-status="open">Open</button>
              <button type="button" class="workspaceTaskFilterBtn" data-status="completed">Done</button>
              <button type="button" class="workspaceTaskFilterBtn" data-status="all">All</button>
            </div>
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
          <div class="workspaceTaskStatusFilters">
            <button type="button" class="workspaceTaskFilterBtn active" data-status="open">Open</button>
            <button type="button" class="workspaceTaskFilterBtn" data-status="completed">Done</button>
            <button type="button" class="workspaceTaskFilterBtn" data-status="all">All</button>
          </div>
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
    const filesSection = sidebar.querySelector('.workspaceFilesSection');

    if (relatedPanel && relatedPanel.nextSibling) {
      sidebar.insertBefore(panel, relatedPanel.nextSibling);
    } else if (filesSection) {
      sidebar.insertBefore(panel, filesSection);
    } else {
      sidebar.appendChild(panel);
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

    badge.textContent = `${filtered.length}`;
    summary.textContent = filtered.length
      ? `Showing ${filtered.length} of ${total} tasks`
      : 'No tasks match';

    if (!filtered.length) {
      const msg = filterState.query
        ? 'No tasks match this search'
        : filterState.status === 'open'
        ? 'No open tasks'
        : filterState.status === 'completed'
        ? 'No completed tasks'
        : 'No tasks';
      list.innerHTML = `<div class="workspaceTasksEmpty">${msg}</div>`;
      return;
    }

    list.innerHTML = filtered
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
              <span class="workspaceTaskCheckbox">${task.done ? '☑' : '☐'}</span>
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

  // Normalize task text for comparison (preserves identity-bearing content)
  function normalizeTaskTextForComparison(text) {
    return String(text || '')
      .replace(/^(\s*[-*+]\s+\[[ xX]\]\s+)/, '') // Remove checkbox prefix
      .replace(/#p[123]\b/gi, '') // Remove priority tokens
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toLowerCase();
  }

  // Find the actual line for a task, with nearby fallback
  function findActualTaskLine(getLineText, indexedLine, expectedText) {
    // First, check the exact indexed line
    const exactLineText = getLineText(indexedLine);
    if (exactLineText !== null) {
      const exactMatch = exactLineText.match(/^(\s*[-*+]\s+\[[ xX]\]\s+)(.*)$/);
      if (exactMatch && normalizeTaskTextForComparison(exactMatch[2]) === normalizeTaskTextForComparison(expectedText)) {
        return indexedLine;
      }
    }

    // Search nearby range (indexedLine - 3 through indexedLine + 3)
    const candidates = [];
    for (let offset = -3; offset <= 3; offset++) {
      if (offset === 0) continue; // Already checked
      const checkLine = indexedLine + offset;
      const checkText = getLineText(checkLine);
      if (checkText === null) continue;

      const checkMatch = checkText.match(/^(\s*[-*+]\s+\[[ xX]\]\s+)(.*)$/);
      if (checkMatch && normalizeTaskTextForComparison(checkMatch[2]) === normalizeTaskTextForComparison(expectedText)) {
        candidates.push({ line: checkLine, text: checkText });
      }
    }

    if (candidates.length === 0) {
      return null; // No match found
    }

    if (candidates.length > 1) {
      return { ambiguous: true }; // Multiple matches
    }

    return candidates[0].line; // Unique match
  }

  async function setTaskPriority(path, kind, line, newPriority) {
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

      // Remove existing priority tokens
      let newContent = content.replace(/#p[123]\b/gi, '').replace(/\s+/g, ' ').trim();

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

      // Schedule render
      if (typeof globalThis.MME_RENDER?.scheduleRender === 'function') {
        globalThis.MME_RENDER.scheduleRender('task priority changed');
      }

      globalThis.showToast?.(`Priority ${newPriority ? 'set to ' + newPriority.toUpperCase() : 'cleared'}`, 'ok', 2000);
    } catch (e) {
      safeLog(`TaskReview: priority edit failed: ${e?.message || e}`);
      globalThis.showToast?.('Priority edit failed', 'error', 2200);
    }
  }

  // ---- Wiring ----

  function wire() {
    if (wired) return true;

    const panel = ensureOrUpgradePanel();
    if (!panel) {
      safeLog('TaskReview: wire deferred; panel not available');
      return false;
    }

    // Search input
    const searchInput = document.getElementById('workspaceTaskSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        filterState.query = searchInput.value;
        renderPanel();
      });
    }

    // Status filter buttons
    const statusBtns = document.querySelectorAll('.workspaceTaskFilterBtn');
    statusBtns.forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        statusBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        filterState.status = btn.dataset.status || 'open';
        renderPanel();
      });
    });

    // Priority filter
    const prioritySelect = document.getElementById('workspaceTaskPriorityFilter');
    if (prioritySelect) {
      prioritySelect.addEventListener('change', () => {
        filterState.priority = prioritySelect.value;
        renderPanel();
      });
    }

    // Delegated click handler on panel
    panel.addEventListener('click', async (event) => {
      // Open task source
      const openBtn = event.target?.closest?.('.workspaceTaskOpenBtn');
      if (openBtn) {
        event.preventDefault();
        event.stopPropagation();
        const path = openBtn.dataset.path || '';
        const kind = openBtn.dataset.kind || '';
        const line = Number(openBtn.dataset.line || 0);
        await openTaskSource(path, kind, line);
        return;
      }

      // Priority action
      const priorityBtn = event.target?.closest?.('.workspaceTaskPriorityAction');
      if (priorityBtn) {
        event.preventDefault();
        event.stopPropagation();

        const action = priorityBtn.dataset.action || '';
        const taskRow = priorityBtn.closest('.workspaceTaskRow');
        if (!taskRow) return;

        // Find the open button to get path/kind/line
        const openBtn2 = taskRow.querySelector('.workspaceTaskOpenBtn');
        if (!openBtn2) return;

        const path = openBtn2.dataset.path || '';
        const kind = openBtn2.dataset.kind || '';
        const line = Number(openBtn2.dataset.line || 0);

        if (action === 'clear') {
          await setTaskPriority(path, kind, line, '');
        } else if (action === 'p1' || action === 'p2' || action === 'p3') {
          await setTaskPriority(path, kind, line, action);
        }
        return;
      }
    });

    wired = true;
    safeLog('TaskReview: wired');
    return true;
  }

  function refresh() {
    const index = getWorkspaceIndex();
    safeLog(`TaskReview: refresh indexReady=${Boolean(index?.ready)} tasks=${index?.tasks?.length || 0}`);
    renderPanel();
  }

  // ---- Public API ----

  const MME_TASK_REVIEW = {
    wire,
    refresh,
    setSearchQuery: (q) => { filterState.query = String(q || ''); renderPanel(); },
    setStatusFilter: (s) => { filterState.status = s || 'open'; renderPanel(); },
    setPriorityFilter: (p) => { filterState.priority = p || 'all'; renderPanel(); },
    getFilteredTasks,
    getAllTasks,
    getOpenTasks,
    getCompletedTasks,
    openTaskSource,
    setTaskPriority,
    findActualTaskLine, // Exposed for testing
  };

  try {
    window.MME_TASK_REVIEW = MME_TASK_REVIEW;
    globalThis.MME_TASK_REVIEW = MME_TASK_REVIEW;
  } catch {}

  safeLog('TaskReview: module loaded');
 }());

  safeLog('TaskReview: module loaded');
})();