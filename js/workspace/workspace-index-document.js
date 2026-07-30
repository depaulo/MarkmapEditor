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
      <section class="wsIndexSection" aria-label="Summary">
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
        <section class="wsIndexSection" aria-label="Journals">
          <h2 class="wsIndexSectionTitle">Journals</h2>
          <div class="wsIndexEmpty">No journals indexed</div>
        </section>
      `;
    }

    const items = journals.map(buildFileActionButton).join('');

    return `
      <section class="wsIndexSection" aria-label="Journals">
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
        <section class="wsIndexSection" aria-label="Concepts">
          <h2 class="wsIndexSectionTitle">Concepts</h2>
          <div class="wsIndexEmpty">No concepts indexed</div>
        </section>
      `;
    }

    const items = concepts.map(buildFileActionButton).join('');

    return `
      <section class="wsIndexSection" aria-label="Concepts">
        <h2 class="wsIndexSectionTitle">Concepts (${concepts.length})</h2>
        <div class="wsIndexFileList">${items}</div>
      </section>
    `;
  }

  function buildTagsSection(index) {
    const tags = index.tags;
    if (!tags || tags.size === 0) {
      return `
        <section class="wsIndexSection" aria-label="Tags">
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
      <section class="wsIndexSection" aria-label="Tags">
        <h2 class="wsIndexSectionTitle">Tags (${sortedTags.length})</h2>
        ${items}
      </section>
    `;
  }

  function buildTasksSection(index, done) {
    const tasks = (index.tasks || []).filter((t) => Boolean(t.done) === done);

    if (!tasks.length) {
      const label = done ? 'Completed Tasks' : 'Open Tasks';
      return `
        <section class="wsIndexSection" aria-label="${label}">
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
      <section class="wsIndexSection" aria-label="${label}">
        <h2 class="wsIndexSectionTitle">${label} (${tasks.length})</h2>
        ${groupHtml}
      </section>
    `;
  }

  function buildRelationshipsSection(index) {
    const links = index.links;
    if (!links || links.size === 0) {
      return `
        <section class="wsIndexSection" aria-label="Relationships">
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
      <section class="wsIndexSection" aria-label="Relationships">
        <h2 class="wsIndexSectionTitle">Relationships / Links (${sortedConcepts.length})</h2>
        ${items}
      </section>
    `;
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

  function buildProjection() {
    const index = safeIndex();
    const wsState = safeWorkspaceState();
    const hasWorkspace = Boolean(wsState?.rootHandle);

    if (!index || !index.ready) {
      return buildNotReadyHtml(hasWorkspace);
    }

    if ((index.files || []).length === 0) {
      return buildSummarySection(index) + buildEmptyWorkspaceHtml();
    }

    return [
      buildSummarySection(index),
      buildJournalsSection(index),
      buildConceptsSection(index),
      buildTagsSection(index),
      buildTasksSection(index, false),
      buildTasksSection(index, true),
      buildRelationshipsSection(index),
    ].join('\n');
  }

  const api = Object.freeze({
    buildProjection,
    escapeHtml,
    escapeAttr,
  });

  global.MME_WORKSPACE_INDEX_DOCUMENT = api;
})(globalThis);