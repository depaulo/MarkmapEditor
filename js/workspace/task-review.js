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

  function ensurePanel() {
    const sidebar = document.getElementById('workspaceSidebar');
    if (!sidebar) return null;

    let panel = document.getElementById('workspaceTasksPanel');
    if (panel) return panel;

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

    safeLog('TaskReview: panel created');
    return panel;
  }

  function renderPanel() {
    const panel = ensurePanel();
    const badge = document.getElementById('workspaceTasksBadge');
    const summary = document.getElementById('workspaceTasksSummary');
    const list = document.getElementById('workspaceTasksList');

    if (!panel || !badge || !summary || !list) {
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
    } catch (e) {
      safeLog(`TaskReview: open failed: ${e?.message || e}`);
    } finally {
      taskOpenInProgress = false;
    }
  }

  // ---- Priority actions ----

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

    // Now edit the source line
    try {
      const cm = globalThis.cm;
      if (!cm || typeof cm.state !== 'object') {
        safeLog('TaskReview: CodeMirror not available for priority edit');
        globalThis.showToast?.('Editor not ready', 'error', 2200);
        return;
      }

      const doc = cm.state.doc;
      const totalLines = doc.lines;
      const lineIndex = Math.max(0, Math.min(line - 1, totalLines - 1));

      // Validate the line
      const currentLine = doc.line(lineIndex + 1);
      if (!currentLine) {
        safeLog(`TaskReview: line ${line} not found`);
        globalThis.showToast?.('Task line not found', 'error', 2200);
        return;
      }

      const lineText = currentLine.text;
      const taskMatch = lineText.match(/^(\s*[-*+]\s+\[[ xX]\]\s+)(.*)$/);
      if (!taskMatch) {
        safeLog(`TaskReview: line ${line} is not a task`);
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

      // Apply edit via CodeMirror transaction
      const from = currentLine.from;
      const to = currentLine.to;

      cm.dispatch({
        changes: { from, to, insert: newLine },
        scrollIntoView: true,
      });

      safeLog(`TaskReview: priority changed ${newPriority || 'cleared'} on ${path}:${line}`);

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
    if (wired) return;
    wired = true;

    const panel = ensurePanel();
    if (!panel) {
      safeLog('TaskReview: wire deferred; panel not available');
      setTimeout(wire, 200);
      return;
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

    safeLog('TaskReview: wired');
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
  };

  try {
    window.MME_TASK_REVIEW = MME_TASK_REVIEW;
    globalThis.MME_TASK_REVIEW = MME_TASK_REVIEW;
  } catch {}

  safeLog('TaskReview: module loaded');
})();
