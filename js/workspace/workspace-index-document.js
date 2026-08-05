// @ts-nocheck
// Virtual Workspace Index V1 — Deterministic Projection Generator
//
// Consumes WORKSPACE_INDEX_STATE (read-only) and produces a stable HTML
// projection with structured action buttons. Does NOT scan, parse, or read
// files. Does NOT create another index. Does NOT mutate state.

(function initWorkspaceIndexDocument(global) {
  'use strict';

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '\x26amp;')
      .replace(/</g, '\x26lt;')
      .replace(/>/g, '\x26gt;')
      .replace(/"/g, '\x26quot;');
  }

  function escapeAttr(str) {
    return escapeHtml(str);
  }

  function formatTimestamp(ms) {
    if (!ms) return '';
    try {
      return new Date(ms).toLocaleString([], {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return String(ms);
    }
  }

  function safeIndex() {
    return globalThis.WORKSPACE_INDEX_STATE || null;
  }

  function safeWorkspaceState() {
    return globalThis.WORKSPACE_STATE || null;
  }

  // ---- Project filter helpers (ACT E) ----

  const DEFAULT_PROJECT_FILTERS = Object.freeze({
    valueMode: 'all',
    year: 'all',
    quarter: 'all',
  });

  function applyProjectFilters(projects, filters) {
    const f = filters || DEFAULT_PROJECT_FILTERS;
    const valueMode = f.valueMode || 'all';
    const year = f.year || 'all';
    const quarter = f.quarter || 'all';

    return (projects || []).filter((project) => {
      // Value filter
      if (valueMode === 'with-value') {
        if (!Number.isFinite(project.value)) return false;
      } else if (valueMode === 'without-value') {
        if (Number.isFinite(project.value)) return false;
      }

      const order = project.expectedOrder;
      const valid = Boolean(order && order.valid === true);

      // Quarter filter
      if (quarter === 'unscheduled') {
        if (valid) return false;
        // Unscheduled ignores Year
        return true;
      }

      if (quarter !== 'all') {
        if (!valid) return false;
        const q = Number(quarter.replace('q', ''));
        if (order.quarter !== q) return false;
      }

      // Year filter (only meaningful for scheduled)
      if (year !== 'all') {
        if (!valid) return false;
        if (order.year !== Number(year)) return false;
      }

      return true;
    });
  }

  function buildProjectTotals(visibleProjects) {
    const totals = new Map();
    let valuedWithoutCurrency = 0;

    for (const project of visibleProjects || []) {
      if (!Number.isFinite(project.value)) continue;

      const currency = String(project.currency || '').trim().toUpperCase();

      if (!currency) {
        valuedWithoutCurrency += 1;
        continue;
      }

      if (!totals.has(currency)) totals.set(currency, 0);
      totals.set(currency, totals.get(currency) + project.value);
    }

    const sortedCurrencies = Array.from(totals.keys()).sort();

    return {
      totals: sortedCurrencies.map((currency) => ({
        currency,
        value: totals.get(currency),
      })),
      valuedWithoutCurrency,
    };
  }

  function buildProjectFilterControls(filters, projects) {
    const f = filters || DEFAULT_PROJECT_FILTERS;
    const valueMode = f.valueMode || 'all';
    const year = f.year || 'all';
    const quarter = f.quarter || 'all';

    // Derive available years from valid expectedOrder.year
    const years = new Set();
    for (const project of projects || []) {
      const order = project.expectedOrder;
      if (order && order.valid === true && Number.isFinite(order.year)) {
        years.add(order.year);
      }
    }
    const sortedYears = Array.from(years).sort((a, b) => a - b);

    const yearOptions = sortedYears
      .map(
        (y) =>
          `<option value="${escapeAttr(String(y))}"${String(y) === String(year) ? ' selected' : ''}>${escapeHtml(String(y))}</option>`
      )
      .join('');

    const quarterOptions = ['q1', 'q2', 'q3', 'q4']
      .map(
        (q) =>
          `<option value="${q}"${q === quarter ? ' selected' : ''}>${escapeHtml(q.toUpperCase())}</option>`
      )
      .join('');

    const valueBtn = (mode, label) =>
      `<button type="button" class="wsIndexProjectFilterBtn${valueMode === mode ? ' __active' : ''}" data-project-filter="value" data-project-filter-value="${mode}" aria-pressed="${valueMode === mode ? 'true' : 'false'}">${escapeHtml(label)}</button>`;

    return `
      <div class="wsIndexProjectsToolbar">
        <div class="wsIndexProjectsFilters">
          <div class="wsIndexProjectFilterGroup" role="group" aria-label="Value filter">
            ${valueBtn('all', 'All')}
            ${valueBtn('with-value', 'With Value')}
            ${valueBtn('without-value', 'Without Value')}
          </div>

          <label class="wsIndexProjectFilterSelect">
            <span class="wsIndexProjectFilterLabel">Year</span>
            <select data-project-filter="year" aria-label="Expected Order Year">
              <option value="all"${year === 'all' ? ' selected' : ''}>All Years</option>
              ${yearOptions}
            </select>
          </label>

          <label class="wsIndexProjectFilterSelect">
            <span class="wsIndexProjectFilterLabel">Quarter</span>
            <select data-project-filter="quarter" aria-label="Expected Order Quarter">
              <option value="all"${quarter === 'all' ? ' selected' : ''}>All Quarters</option>
              ${quarterOptions}
              <option value="unscheduled"${quarter === 'unscheduled' ? ' selected' : ''}>Unscheduled</option>
            </select>
          </label>
        </div>
      </div>
    `;
  }

  // ---- Section builders ----

  function buildSummarySection(index) {
    const openTasks = (index.tasks || []).filter((t) => !t.done).length;
    const doneTasks = (index.tasks || []).filter((t) => t.done).length;
    const journals = (index.byKind?.journals || []).length;
    const concepts = (index.byKind?.concepts || []).length;

    const metrics = [
      { label: 'Files', value: (index.files || []).length },
      { label: 'Journals', value: journals },
      { label: 'Concepts', value: concepts },
      { label: 'Projects', value: (index.projects || []).length },
      { label: 'Tags', value: index.tags?.size || 0 },
      { label: 'Tasks', value: (index.tasks || []).length },
      { label: 'Open', value: openTasks },
      { label: 'Done', value: doneTasks },
      { label: 'Links', value: index.links?.size || 0 },
    ];

    const metricsHtml = metrics
      .map(
        (m) =>
          `<div class="wsIndexMetricItem"><div class="wsIndexMetricValue">${escapeHtml(String(m.value))}</div><div class="wsIndexMetricLabel">${escapeHtml(m.label)}</div></div>`
      )
      .join('');

    const updated = index.lastBuiltAt
      ? `<div class="wsIndexUpdated">Updated ${escapeHtml(formatTimestamp(index.lastBuiltAt))}</div>`
      : '';

    return `
      <section class="wsIndexSection" id="workspaceIndexSummarySection" aria-label="Summary">
        <h2 class="wsIndexSectionTitle">Summary</h2>
        ${updated}
        <div class="wsIndexMetrics">${metricsHtml}</div>
      </section>
    `;
  }

  function buildFileActionButton(file) {
    const path = escapeAttr(file.path || '');
    const kind = escapeAttr(file.kind || '');
    const name = escapeHtml(file.name || file.path || '');
    const title = escapeHtml(file.title || file.name || '');
    const date = escapeHtml(file.date || '');
    const icon = kind === 'journals' ? '📝' : kind === 'concepts' ? '🧠' : '📄';

    return `<button type="button" class="wsIndexFileAction" data-action="open-workspace-file" data-path="${path}" data-kind="${kind}">
      <span class="wsIndexFileIcon" aria-hidden="true">${icon}</span>
      <span class="wsIndexFileBody">
        <span class="wsIndexFileName">${name}</span>
        <span class="wsIndexFileTitle">${title}</span>
        ${date ? `<span class="wsIndexFileDate">${date}</span>` : ''}
      </span>
    </button>`;
  }

  function buildJournalsSection(index) {
    const journals = (index.byKind?.journals || []).slice().sort((a, b) => {
      return String(b.path || '').localeCompare(String(a.path || ''));
    });

    if (!journals.length) {
      return `
        <section class="wsIndexSection" id="workspaceIndexJournalsSection" aria-label="Journals">
          <h2 class="wsIndexSectionTitle">Journals</h2>
          <div class="wsIndexEmpty">No journals indexed</div>
        </section>
      `;
    }

    const items = journals.map(buildFileActionButton).join('');

    return `
      <section class="wsIndexSection" id="workspaceIndexJournalsSection" aria-label="Journals">
        <h2 class="wsIndexSectionTitle">Journals (${journals.length})</h2>
        <div class="wsIndexFileList">${items}</div>
      </section>
    `;
  }

  function buildConceptsSection(index) {
    const concepts = (index.byKind?.concepts || []).slice().sort((a, b) => {
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

    if (!concepts.length) {
      return `
        <section class="wsIndexSection" id="workspaceIndexConceptsSection" aria-label="Concepts">
          <h2 class="wsIndexSectionTitle">Concepts</h2>
          <div class="wsIndexEmpty">No concepts indexed</div>
        </section>
      `;
    }

    const items = concepts.map(buildFileActionButton).join('');

    return `
      <section class="wsIndexSection" id="workspaceIndexConceptsSection" aria-label="Concepts">
        <h2 class="wsIndexSectionTitle">Concepts (${concepts.length})</h2>
        <div class="wsIndexFileList">${items}</div>
      </section>
    `;
  }

  function buildProjectsSection(index, filters) {
    const projects = index.projects || [];

    if (!projects.length) {
      return `
        <section class="wsIndexSection" id="workspaceIndexProjectsSection" aria-label="Projects">
          <h2 class="wsIndexSectionTitle">Projects</h2>
          <div class="wsIndexEmpty">No Projects found.</div>
        </section>
      `;
    }

    const visibleProjects = applyProjectFilters(projects, filters);
    const total = projects.length;
    const visibleCount = visibleProjects.length;
    const totals = buildProjectTotals(visibleProjects);

    const controlsHtml = buildProjectFilterControls(filters, projects);

    let countHtml = '';
    if (total > 0) {
      countHtml = `<div class="wsIndexProjectCount">Visible Projects: ${visibleCount} of ${total}</div>`;
    }

    let totalsHtml = '';
    if (visibleCount === 0) {
      totalsHtml = '<div class="wsIndexProjectTotalsEmpty">No currency totals for the current filters.</div>';
    } else if (totals.totals.length === 0 && totals.valuedWithoutCurrency === 0) {
      totalsHtml = '<div class="wsIndexProjectTotalsEmpty">No currency totals for the current filters.</div>';
    } else {
      const totalItems = totals.totals
        .map(
          (t) =>
            `<div class="wsIndexProjectTotal"><span class="wsIndexProjectTotalCurrency">${escapeHtml(t.currency)}</span> <span class="wsIndexProjectTotalValue">${escapeHtml(Number(t.value).toLocaleString())}</span></div>`
        )
        .join('');
      const missingCurrencyHtml =
        totals.valuedWithoutCurrency > 0
          ? `<div class="wsIndexProjectTotalMissing">Valued without currency: ${totals.valuedWithoutCurrency}</div>`
          : '';
      totalsHtml = `<div class="wsIndexProjectTotals">${totalItems}${missingCurrencyHtml}</div>`;
    }

    let rowsHtml = '';
    if (visibleCount === 0) {
      rowsHtml = '<div class="wsIndexEmpty">No Projects match the current filters.</div>';
    } else {
      rowsHtml = visibleProjects
        .map((project) => {
          const name = escapeHtml(project.name || '');
          const path = escapeAttr(project.sourcePath || '');
          const kind = escapeAttr(project.sourceKind || '');
          const line = Number(project.sourceLine) || 0;
          const lineAttr = line ? `data-line="${escapeAttr(String(line))}"` : '';

          // Value
          let valueDisplay = '\u2014';
          if (project.value !== null && project.value !== undefined) {
            if (project.currency) {
              valueDisplay = project.currency + ' ' + Number(project.value).toLocaleString();
            } else {
              valueDisplay = Number(project.value).toLocaleString() + ' \u00b7 no currency';
            }
          }

          // Periods
          const orderDisplay =
            project.expectedOrder && project.expectedOrder.valid === true
              ? project.expectedOrder.display
              : '\u2014';
          const deliveryDisplay =
            project.expectedDelivery && project.expectedDelivery.valid === true
              ? project.expectedDelivery.display
              : '\u2014';
          const billingDisplay =
            project.expectedBilling && project.expectedBilling.valid === true
              ? project.expectedBilling.display
              : '\u2014';

          // Status
          const statusDisplay = project.status ? project.status : '\u2014';

          // Source label
          const sourceLabel = project.sourceName || project.sourcePath || '\u2014';

          return `
            <button
              type="button"
              class="wsIndexProjectRow"
              data-action="open-workspace-file"
              data-path="${path}"
              data-kind="${kind}"
              ${lineAttr}
              title="${path}"
              aria-label="Open source: ${path}"
            >
              <span class="wsIndexProjectCell wsIndexProjectName">${name}</span>
              <span class="wsIndexProjectCell wsIndexProjectValue">${escapeHtml(valueDisplay)}</span>
              <span class="wsIndexProjectCell wsIndexProjectOrder">${escapeHtml(orderDisplay)}</span>
              <span class="wsIndexProjectCell wsIndexProjectDelivery">${escapeHtml(deliveryDisplay)}</span>
              <span class="wsIndexProjectCell wsIndexProjectBilling">${escapeHtml(billingDisplay)}</span>
              <span class="wsIndexProjectCell wsIndexProjectStatus">${escapeHtml(statusDisplay)}</span>
              <span class="wsIndexProjectCell wsIndexProjectSource">${escapeHtml(sourceLabel)}</span>
            </button>
          `;
        })
        .join('');
    }

    return `
      <section class="wsIndexSection" id="workspaceIndexProjectsSection" aria-label="Projects">
        <h2 class="wsIndexSectionTitle">Projects (${projects.length})</h2>
        ${controlsHtml}
        ${countHtml}
        ${totalsHtml}
        <div class="wsIndexProjectRegister">
          <div class="wsIndexProjectHeader" aria-hidden="true">
            <span class="wsIndexProjectCell wsIndexProjectName">Project</span>
            <span class="wsIndexProjectCell wsIndexProjectValue">Value</span>
            <span class="wsIndexProjectCell wsIndexProjectOrder">Order</span>
            <span class="wsIndexProjectCell wsIndexProjectDelivery">Delivery</span>
            <span class="wsIndexProjectCell wsIndexProjectBilling">Billing</span>
            <span class="wsIndexProjectCell wsIndexProjectStatus">Status</span>
            <span class="wsIndexProjectCell wsIndexProjectSource">Source</span>
          </div>
          ${rowsHtml}
        </div>
      </section>
    `;
  }

  function buildTagsSection(index) {
    const tags = index.tags;
    if (!tags || tags.size === 0) {
      return `
        <section class="wsIndexSection" id="workspaceIndexTagsSection" aria-label="Tags">
          <h2 class="wsIndexSectionTitle">Tags</h2>
          <div class="wsIndexEmpty">No tags indexed</div>
        </section>
      `;
    }

    const sortedTags = Array.from(tags.keys()).sort();

    const items = sortedTags
      .map((tag) => {
        const paths = (tags.get(tag) || []).slice().sort();
        const fileButtons = paths
          .map((path) => {
            const parsed = index.byPath?.get(path);
            if (!parsed) return '';
            return buildFileActionButton(parsed);
          })
          .filter(Boolean)
          .join('');

        if (!fileButtons) {
          return `<div class="wsIndexTagGroup">
            <div class="wsIndexTagName">#${escapeHtml(tag)}</div>
            <div class="wsIndexEmpty">No files resolved</div>
          </div>`;
        }

        return `<div class="wsIndexTagGroup">
          <div class="wsIndexTagName">#${escapeHtml(tag)} <span class="wsIndexTagCount">(${paths.length})</span></div>
          <div class="wsIndexFileList">${fileButtons}</div>
        </div>`;
      })
      .join('');

    return `
      <section class="wsIndexSection" id="workspaceIndexTagsSection" aria-label="Tags">
        <h2 class="wsIndexSectionTitle">Tags (${sortedTags.length})</h2>
        <div class="wsIndexTagGrid">${items}</div>
      </section>
    `;
  }

  function buildTasksSection(index, done) {
    const tasks = (index.tasks || []).filter((t) => Boolean(t.done) === done);

    if (!tasks.length) {
      const label = done ? 'Completed Tasks' : 'Open Tasks';
      return `
        <section class="wsIndexSection" id="${done ? 'workspaceIndexCompletedTasksSection' : 'workspaceIndexOpenTasksSection'}" aria-label="${label}">
          <h2 class="wsIndexSectionTitle">${label}</h2>
          <div class="wsIndexEmpty">No ${done ? 'completed' : 'open'} tasks</div>
        </section>
      `;
    }

    // Sort by filePath ascending, then line ascending
    const sorted = tasks.slice().sort((a, b) => {
      const ap = String(a.filePath || '');
      const bp = String(b.filePath || '');
      if (ap !== bp) return ap.localeCompare(bp);
      return (a.line || 0) - (b.line || 0);
    });

    // Group by file
    const groups = new Map();
    for (const task of sorted) {
      const key = task.filePath || '(unknown)';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(task);
    }

    const sortedKeys = Array.from(groups.keys()).sort();

    const groupHtml = sortedKeys
      .map((filePath) => {
        const fileTasks = groups.get(filePath);
        const parsed = index.byPath?.get(filePath);
        const fileName = parsed?.name || filePath;
        const kind = parsed?.kind || '';
        const icon = kind === 'journals' ? '📝' : kind === 'concepts' ? '🧠' : '📄';

        const taskItems = fileTasks
          .map((task) => {
            const checkbox = task.done ? '✅' : '⬜';
            const lineAttr = task.line ? `data-line="${escapeAttr(String(task.line))}"` : '';
            return `<button type="button" class="wsIndexTaskAction" data-action="open-workspace-file" data-path="${escapeAttr(filePath)}" data-kind="${escapeAttr(kind)}" ${lineAttr}>
              <span class="wsIndexTaskCheckbox" aria-hidden="true">${checkbox}</span>
              <span class="wsIndexTaskText">${escapeHtml(task.text || '(empty task)')}</span>
            </button>`;
          })
          .join('');

        return `<div class="wsIndexTaskGroup">
          <div class="wsIndexTaskGroupHeader">
            <span class="wsIndexFileIcon" aria-hidden="true">${icon}</span>
            <span class="wsIndexTaskGroupName">${escapeHtml(fileName)}</span>
          </div>
          <div class="wsIndexTaskList">${taskItems}</div>
        </div>`;
      })
      .join('');

    const label = done ? 'Completed Tasks' : 'Open Tasks';

    return `
      <section class="wsIndexSection" id="${done ? 'workspaceIndexCompletedTasksSection' : 'workspaceIndexOpenTasksSection'}" aria-label="${label}">
        <h2 class="wsIndexSectionTitle">${label} (${tasks.length})</h2>
        ${groupHtml}
      </section>
    `;
  }

  function buildRelationshipsSection(index) {
    const links = index.links;
    if (!links || links.size === 0) {
      return `
        <section class="wsIndexSection" id="workspaceIndexRelationshipsSection" aria-label="Relationships">
          <h2 class="wsIndexSectionTitle">Relationships / Links</h2>
          <div class="wsIndexEmpty">No concept links indexed</div>
        </section>
      `;
    }

    const sortedConcepts = Array.from(links.keys()).sort();

    const items = sortedConcepts
      .map((concept) => {
        const sourcePaths = (links.get(concept) || []).slice().sort();
        const fileButtons = sourcePaths
          .map((path) => {
            const parsed = index.byPath?.get(path);
            if (!parsed) return '';
            return buildFileActionButton(parsed);
          })
          .filter(Boolean)
          .join('');

        if (!fileButtons) {
          return `<div class="wsIndexLinkGroup">
            <div class="wsIndexLinkName">${escapeHtml(concept)}</div>
            <div class="wsIndexEmpty">No source files resolved</div>
          </div>`;
        }

        return `<div class="wsIndexLinkGroup">
          <div class="wsIndexLinkName">${escapeHtml(concept)} <span class="wsIndexLinkCount">(${sourcePaths.length})</span></div>
          <div class="wsIndexFileList">${fileButtons}</div>
        </div>`;
      })
      .join('');

    return `
      <section class="wsIndexSection" id="workspaceIndexRelationshipsSection" aria-label="Relationships">
        <h2 class="wsIndexSectionTitle">Relationships / Links (${sortedConcepts.length})</h2>
        <div class="wsIndexLinkGrid">${items}</div>
      </section>
    `;
  }

  // ---- Body wrapper ----

  function buildBody(nav, content) {
    return `<div class="wsIndexBody">${nav}${content}</div>`;
  }

  function buildContent(children) {
    return `<main class="wsIndexContent">${children}</main>`;
  }

  // ---- Navigator ----

  function buildNavigator() {
    const links = [
      { id: 'workspaceIndexSummarySection', label: 'Summary' },
      { id: 'workspaceIndexJournalsSection', label: 'Journals' },
      { id: 'workspaceIndexConceptsSection', label: 'Concepts' },
      { id: 'workspaceIndexProjectsSection', label: 'Projects' },
      { id: 'workspaceIndexTagsSection', label: 'Tags' },
      { id: 'workspaceIndexOpenTasksSection', label: 'Open Tasks' },
      { id: 'workspaceIndexCompletedTasksSection', label: 'Completed Tasks' },
      { id: 'workspaceIndexRelationshipsSection', label: 'Relationships' },
    ];

    const anchors = links
      .map(
        (l) =>
          `<a href="#${escapeAttr(l.id)}" class="wsIndexNavLink">${escapeHtml(l.label)}</a>`
      )
      .join('');

    return `<nav class="wsIndexNavigator" aria-label="Workspace Index sections">${anchors}</nav>`;
  }

  // ---- Main projection ----

  function buildNotReadyHtml(hasWorkspace) {
    const message = hasWorkspace ? 'Index building…' : 'No workspace open';
    const action = hasWorkspace
      ? '<button type="button" class="wsIndexRefreshAction" data-action="refresh-index">↻ Refresh Index</button>'
      : '<button type="button" class="wsIndexOpenWorkspaceAction" data-action="open-workspace">📁 Open Workspace</button>';

    return `<div class="wsIndexNotReady">
      <div class="wsIndexNotReadyMessage">${escapeHtml(message)}</div>
      ${action}
    </div>`;
  }

  function buildEmptyWorkspaceHtml() {
    return `<div class="wsIndexEmptyWorkspace">
      <div class="wsIndexEmptyTitle">Workspace is empty</div>
      <div class="wsIndexEmptyText">No journals or concepts found in the workspace.</div>
    </div>`;
  }

  function buildProjection(filters) {
    const index = safeIndex();
    const wsState = safeWorkspaceState();
    const hasWorkspace = Boolean(wsState?.rootHandle);

    if (!index || !index.ready) {
      return buildNotReadyHtml(hasWorkspace);
    }

    if ((index.files || []).length === 0) {
      return buildSummarySection(index) + buildEmptyWorkspaceHtml();
    }

    const nav = buildNavigator();
    const sections = [
      buildSummarySection(index),
      buildJournalsSection(index),
      buildConceptsSection(index),
      buildProjectsSection(index, filters),
      buildTagsSection(index),
      buildTasksSection(index, false),
      buildTasksSection(index, true),
      buildRelationshipsSection(index),
    ].join('\n');

    const content = buildContent(sections);
    return buildBody(nav, content);
  }

  const api = Object.freeze({
    buildProjection,
    escapeHtml,
    escapeAttr,
  });

  global.MME_WORKSPACE_INDEX_DOCUMENT = api;
})(globalThis);
