// @ts-nocheck
// ACT R1A — Report Composer, session-local selection surface.
// Reuses existing Workspace Index and Report Dictionary.
// Does NOT create a second parser, second Index, second editor, or second Save owner.
(function () {
  'use strict';

  // =========================================================================
  // Period semantics helpers (Phase 3)
  // =========================================================================

  // Inclusive boundaries: startDate <= recordDate <= endDate
  // Both dates required before Build Selection; invalid period blocks it.

  // Parse an ISO date string into a Date at start of day. Returns null if invalid.
  function parseIsoDate(dateStr) {
    if (!dateStr) return null;
    var m = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
    return dt;
  }

  // Format a Date as YYYY-MM-DD
  function formatIsoDate(dt) {
    var y = dt.getFullYear();
    var mo = String(dt.getMonth() + 1).padStart(2, '0');
    var d = String(dt.getDate()).padStart(2, '0');
    return y + '-' + mo + '-' + d;
  }

  // Normalize and validate a period. Returns an object with:
  //   status: 'complete' | 'incomplete' | 'invalid'
  //   error: null | 'Start date must be on or before End date.'
  //   startDate, endDate: normalized ISO strings or ''
  function normalizePeriod(startDate, endDate) {
    var start = startDate ? parseIsoDate(startDate) : null;
    var end = endDate ? parseIsoDate(endDate) : null;

    if (!start && !end) {
      return { status: 'incomplete', error: null, startDate: '', endDate: '' };
    }
    if (!start || !end) {
      return { status: 'incomplete', error: null, startDate: start ? formatIsoDate(start) : '', endDate: end ? formatIsoDate(end) : '' };
    }
    if (start > end) {
      return { status: 'invalid', error: 'Start date must be on or before End date.', startDate: formatIsoDate(start), endDate: formatIsoDate(end) };
    }
    return { status: 'complete', error: null, startDate: formatIsoDate(start), endDate: formatIsoDate(end) };
  }

  // Check if a date falls within an inclusive period.
  function isDateWithinInclusivePeriod(dateStr, period) {
    if (!period || !period.startDate || !period.endDate) return false;
    if (!dateStr) return false;
    var dt = parseIsoDate(dateStr);
    if (!dt) return false;
    var start = parseIsoDate(period.startDate);
    var end = parseIsoDate(period.endDate);
    return dt >= start && dt <= end;
  }

  // Convert a normalized quarter (YYYY-Qn) to a date range [startDate, endDate].
  function quarterToRange(quarterStr) {
    if (!quarterStr) return null;
    var m = String(quarterStr).match(/^(\d{4})-Q([1-4])$/);
    if (!m) return null;
    var y = Number(m[1]), q = Number(m[2]);
    var startMonth = (q - 1) * 3;
    var start = new Date(y, startMonth, 1);
    var endMonth = startMonth + 2;
    var end = new Date(y, endMonth + 1, 0); // last day of endMonth
    return { startDate: formatIsoDate(start), endDate: formatIsoDate(end) };
  }

  // Check if a quarter intersects a period (inclusive).
  function quarterIntersectsPeriod(quarterStr, period) {
    var range = quarterToRange(quarterStr);
    if (!range) return false;
    return isDateWithinInclusivePeriod(range.startDate, period) ||
           isDateWithinInclusivePeriod(range.endDate, period) ||
           (parseIsoDate(range.startDate) <= parseIsoDate(period.endDate) &&
            parseIsoDate(range.endDate) >= parseIsoDate(period.startDate));
  }

// =========================================================================
// Module-local Composer state (session-only)
// =========================================================================

const initialState = {
  config: {
    period: {
      startDate: '',
      endDate: '',
      inclusive: true,
    },
    includedDomains: {
      projects: true,
      tasks: true,
      notes: false,
    }
  },
  selection: {
    projectIds: [],
    taskIds: [],
    notePaths: [],
  },
  workflow: {
    step: 'configure',
  },
  projection: {
    eligibleProjectIds: [],
    eligibleTaskIds: [],
    eligibleNotePaths: [],
    diagnostics: []
  }
};

let state = Object.freeze({ ...initialState });

function resetState() {
  state = Object.freeze({ ...initialState });
}


// =========================================================================
// Project eligibility (Phase 4)
// =========================================================================

function collectProjectPeriodMatches(project, period) {
  var matchReasons = [];
  var periodValues = {};

  if (project.expectedOrder && quarterIntersectsPeriod(project.expectedOrder, period)) {
    matchReasons.push('expected-order');
    periodValues.expectedOrder = project.expectedOrder;
  }
  if (project.expectedDelivery && quarterIntersectsPeriod(project.expectedDelivery, period)) {
    matchReasons.push('expected-delivery');
    periodValues.expectedDelivery = project.expectedDelivery;
  }
  if (project.expectedBilling && quarterIntersectsPeriod(project.expectedBilling, period)) {
    matchReasons.push('expected-billing');
    periodValues.expectedBilling = project.expectedBilling;
  }

  return {
    matchReasons: matchReasons,
    periodValues: periodValues,
    eligible: matchReasons.length > 0
  };
}


// =========================================================================
// Task eligibility (Phase 5)
// =========================================================================

function classifyTaskForPeriod(task, period) {
  var matchReasons = [];
  var relevantDates = {};

  if (!period || !period.endDate) return { matchReasons: [], relevantDates: {}, eligible: false };

  var endDate = parseIsoDate(period.endDate);
  if (!endDate) return { matchReasons: [], relevantDates: {}, eligible: false };

  var dueDate = task.dueDate ? parseIsoDate(task.dueDate) : null;
  var completedDate = task.completedDate ? parseIsoDate(task.completedDate) : null;
  var done = Boolean(task.done);

  if (dueDate) {
    relevantDates.dueDate = task.dueDate;
  }
  if (completedDate) {
    relevantDates.completedDate = task.completedDate;
  }

  if (!done && dueDate && dueDate <= endDate) {
    matchReasons.push('open-at-period-end');
  }
  if (!done && dueDate && isDateWithinInclusivePeriod(task.dueDate, period)) {
    matchReasons.push('due-in-period');
  }
  if (done && completedDate && isDateWithinInclusivePeriod(task.completedDate, period)) {
    matchReasons.push('completed-in-period');
  }
  if (!done && dueDate && dueDate < endDate) {
    matchReasons.push('overdue-at-period-end');
  }

  return {
    matchReasons: matchReasons,
    relevantDates: relevantDates,
    eligible: matchReasons.length > 0
  };
}


// =========================================================================
// Note eligibility (Phase 6)
// =========================================================================

function classifyNoteForPeriod(note, period) {
  var matchReasons = [];
  var documentDate = note.date || '';
  var dateKind = '';

  if (documentDate) {
    dateKind = 'dated';
    if (isDateWithinInclusivePeriod(documentDate, period)) {
      matchReasons.push('dated-in-period');
    }
  } else {
    dateKind = 'undated';
    matchReasons.push('undated-manual');
  }

  return {
    path: note.path || '',
    title: note.title || '',
    documentDate: documentDate,
    dateKind: dateKind,
    matchReasons: matchReasons,
    eligible: matchReasons.length > 0
  };
}


// =========================================================================
// Eligibility projection (Phase 7)
// =========================================================================

function buildEligibilityProjection(indexSnapshot, composerState) {
  var period = composerState.config.period;
  var includedDomains = composerState.config.includedDomains;
  var selection = composerState.selection;

  var periodNorm = normalizePeriod(period.startDate, period.endDate);
  var periodValid = periodNorm.status === 'complete';

  var eligibleProjects = [];
  var eligibleTasks = [];
  var eligibleNotes = [];
  var diagnostics = [];

  var indexReady = indexSnapshot && indexSnapshot.ready === true;
  var workspaceAvailable = indexSnapshot && Boolean(indexSnapshot.rootHandle);

  if (!workspaceAvailable) {
    diagnostics.push({ code: 'no-workspace', detail: 'Open a Workspace to compose a Report.', level: 'info' });
  } else if (!indexReady) {
    diagnostics.push({ code: 'index-building', detail: 'Preparing Workspace records…', level: 'info' });
  } else {
    if (includedDomains.projects && indexSnapshot.projects) {
      for (var i = 0; i < indexSnapshot.projects.length; i += 1) {
        var proj = indexSnapshot.projects[i];
        var match = collectProjectPeriodMatches(proj, periodNorm.status === 'complete' ? periodNorm : { startDate: '', endDate: '' });
        if (match.eligible) {
          eligibleProjects.push({
            id: proj.projectId || proj.sourcePath || 'project-' + i,
            name: proj.name || '',
            stage: proj.stage || '',
            state: proj.state || '',
            periodValues: match.periodValues,
            matchReasons: match.matchReasons,
            sourcePath: proj.sourcePath || ''
          });
        }
      }
    }
    if (includedDomains.tasks && indexSnapshot.tasks) {
      for (var j = 0; j < indexSnapshot.tasks.length; j += 1) {
        var task = indexSnapshot.tasks[j];
        var classification = classifyTaskForPeriod(task, periodNorm.status === 'complete' ? periodNorm : { startDate: '', endDate: '' });
        if (classification.eligible) {
          eligibleTasks.push({
            id: task.filePath + ':' + task.line,
            text: task.text || '',
            status: task.effectiveStatus || (task.done ? 'done' : 'open'),
            relevantDates: classification.relevantDates,
            matchReasons: classification.matchReasons,
            sourcePath: task.filePath || ''
          });
        }
      }
    }
    if (includedDomains.notes && indexSnapshot.files) {
      for (var k = 0; k < indexSnapshot.files.length; k += 1) {
        var note = indexSnapshot.files[k];
        var classification = classifyNoteForPeriod(note, periodNorm.status === 'complete' ? periodNorm : { startDate: '', endDate: '' });
        if (classification.eligible) {
          eligibleNotes.push({
            path: note.path || '',
            title: note.title || '',
            documentDate: note.date || '',
            dateKind: classification.dateKind,
            matchReasons: classification.matchReasons
          });
        }
      }
    }
  }

  var eligibleProjectIdSet = new Set(eligibleProjects.map(function (p) { return p.id; }));
  var eligibleTaskIdSet = new Set(eligibleTasks.map(function (t) { return t.id; }));
  var eligibleNotePathSet = new Set(eligibleNotes.map(function (n) { return n.path; }));

  for (var s = 0; s < selection.projectIds.length; s += 1) {
    if (!eligibleProjectIdSet.has(selection.projectIds[s])) {
      diagnostics.push({ code: 'stale-project', detail: 'Selected project no longer eligible: ' + selection.projectIds[s], level: 'warn' });
    }
  }
  for (var t = 0; t < selection.taskIds.length; t += 1) {
    if (!eligibleTaskIdSet.has(selection.taskIds[t])) {
      diagnostics.push({ code: 'stale-task', detail: 'Selected task no longer eligible: ' + selection.taskIds[t], level: 'warn' });
    }
  }
  for (var n = 0; n < selection.notePaths.length; n += 1) {
    if (!eligibleNotePathSet.has(selection.notePaths[n])) {
      diagnostics.push({ code: 'stale-note', detail: 'Selected note no longer eligible: ' + selection.notePaths[n], level: 'warn' });
    }
  }

  return {
    projects: eligibleProjects,
    tasks: eligibleTasks,
    notes: eligibleNotes,
    diagnostics: diagnostics,
    periodValid: periodValid,
    periodError: periodNorm.error,
    workspaceAvailable: workspaceAvailable,
    indexReady: indexReady
  };
}

// =========================================================================
// Default selection policy (Phase 8)
// =========================================================================

var defaultSelectionApplied = false;
var lastDefaultPeriodKey = '';

function applyDefaultSelection(projection, composerState) {
  if (!projection.periodValid) return;

  var periodKey = composerState.config.period.startDate + '|' + composerState.config.period.endDate;
  if (defaultSelectionApplied && lastDefaultPeriodKey === periodKey) return;

  var selection = composerState.selection;

  if (composerState.config.includedDomains.projects) {
    selection.projectIds = projection.projects.map(function (p) { return p.id; });
  }

  if (composerState.config.includedDomains.tasks) {
    selection.taskIds = projection.tasks
      .filter(function (t) {
        return t.matchReasons.indexOf('open-at-period-end') >= 0 ||
               t.matchReasons.indexOf('overdue-at-period-end') >= 0 ||
               t.matchReasons.indexOf('due-in-period') >= 0;
      })
      .map(function (t) { return t.id; });
  }

  selection.notePaths = [];

  defaultSelectionApplied = true;
  lastDefaultPeriodKey = periodKey;
}

function resetDefaultSelection() {
  defaultSelectionApplied = false;
  lastDefaultPeriodKey = '';
}


// =========================================================================
// UI rendering helpers (Phase 9)
// =========================================================================

function escapeHtml(text) {
  if (!text) return '';
  var div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}


function renderComposerView(host) {
  if (!host) return;
  host.innerHTML = '';
  var periodNorm = normalizePeriod(state.config.period.startDate, state.config.period.endDate);
  var projection = buildEligibilityProjection(
    typeof globalThis !== 'undefined' && globalThis.WORKSPACE_INDEX_STATE ? globalThis.WORKSPACE_INDEX_STATE : null,
    state
  );
  if (projection.periodValid && !defaultSelectionApplied) {
    applyDefaultSelection(projection, state);
  }
  var view = document.createElement('div');
  view.className = 'reportComposerView';
  view.hidden = false;
  var header = document.createElement('div');
  header.className = 'reportComposerHeader';
  var backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'reportComposerBackButton';
  backBtn.setAttribute('data-report-action', 'composer-back-to-workspace');
  backBtn.textContent = 'Back to Workspace';
  backBtn.addEventListener('click', function () { returnToWorkspace(); });
  var title = document.createElement('span');
  title.className = 'reportComposerTitle';
  title.textContent = 'Report Composer';
  header.appendChild(backBtn);
  header.appendChild(title);
  view.appendChild(header);


  var periodDiv = document.createElement('div');
  periodDiv.className = 'reportComposerPeriod';
  var periodLabel = document.createElement('div');
  periodLabel.className = 'reportComposerPeriodLabel';
  periodLabel.textContent = 'Period';
  var periodValue = document.createElement('div');
  periodValue.className = 'reportComposerPeriodValue';
  periodValue.setAttribute('id', 'reportComposerPeriodValue');
  if (periodNorm.status === 'complete') {
    periodValue.textContent = periodNorm.startDate + ' to ' + periodNorm.endDate;
  } else if (periodNorm.status === 'invalid') {
    periodValue.textContent = periodNorm.startDate + ' to ' + periodNorm.endDate;
    periodValue.className += ' reportComposerPeriodInvalid';
  } else {
    periodValue.textContent = '—';
  }
  periodDiv.appendChild(periodLabel);
  periodDiv.appendChild(periodValue);
  view.appendChild(periodDiv);

  var domainsDiv = document.createElement('div');
  domainsDiv.className = 'reportComposerDomains';
  var domainsLabel = document.createElement('div');
  domainsLabel.className = 'reportComposerDomainsLabel';
  domainsLabel.textContent = 'Domains';
  domainsDiv.appendChild(domainsLabel);

  ['projects', 'tasks', 'notes'].forEach(function (domain) {
    var row = document.createElement('div');
    row.className = 'reportComposerDomainRow';
    var nameSpan = document.createElement('span');
    nameSpan.className = 'reportComposerDomainName';
    nameSpan.textContent = domain.charAt(0).toUpperCase() + domain.slice(1);
    var valueSpan = document.createElement('span');
    valueSpan.className = 'reportComposerDomainValue';
    valueSpan.setAttribute('id', 'reportComposerDomain' + domain.charAt(0).toUpperCase() + domain.slice(1));
    var eligibleCount = domain === 'projects' ? projection.projects.length :
                       domain === 'tasks' ? projection.tasks.length :
                       projection.notes.length;
    var selectedCount = domain === 'projects' ? state.selection.projectIds.length :
                       domain === 'tasks' ? state.selection.taskIds.length :
                       state.selection.notePaths.length;
    valueSpan.textContent = selectedCount + '/' + eligibleCount;
    row.appendChild(nameSpan);
    row.appendChild(valueSpan);
    domainsDiv.appendChild(row);
  });
  view.appendChild(domainsDiv);


  var sectionsDiv = document.createElement('div');
  sectionsDiv.className = 'reportComposerSections';

  ['projects', 'tasks', 'notes'].forEach(function (domain) {
    if (!state.config.includedDomains[domain]) return;
    var section = document.createElement('div');
    section.className = 'reportComposerSection';
    var heading = document.createElement('div');
    heading.className = 'reportComposerSectionHeading';
    heading.textContent = domain.charAt(0).toUpperCase() + domain.slice(1);
    section.appendChild(heading);
    var list = document.createElement('div');
    list.className = 'reportComposerSectionList';
    list.setAttribute('id', 'reportComposer' + domain.charAt(0).toUpperCase() + domain.slice(1) + 'List');
    var records = domain === 'projects' ? projection.projects :
                 domain === 'tasks' ? projection.tasks :
                 projection.notes;
    records.forEach(function (record) {
      var row = document.createElement('div');
      row.className = 'reportComposerRecordRow';
      row.setAttribute('data-report-action', 'composer-record-select');
      row.setAttribute('data-report-domain', domain);
      row.setAttribute('data-report-id', record.id || record.path || '');
      var checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'reportComposerRecordCheckbox';
      var isSelected = (domain === 'projects' ? state.selection.projectIds :
                       domain === 'tasks' ? state.selection.taskIds :
                       state.selection.notePaths).indexOf(record.id || record.path || '') >= 0;
      checkbox.checked = isSelected;
      checkbox.addEventListener('change', function () {
        setRecordSelected(record.id || record.path || '', domain, checkbox.checked);
        renderComposerView(host);
      });
      var details = document.createElement('div');
      details.className = 'reportComposerRecordDetails';
      var nameDiv = document.createElement('div');
      nameDiv.className = 'reportComposerRecordName';
      nameDiv.textContent = domain === 'projects' ? record.name :
                           domain === 'tasks' ? record.text :
                           record.title;
      details.appendChild(nameDiv);
      var metaDiv = document.createElement('div');
      metaDiv.className = 'reportComposerRecordMeta';
      var metaParts = [];
      if (domain === 'projects') {
        if (record.stage) metaParts.push('Stage: ' + escapeHtml(record.stage));
        if (record.state) metaParts.push('State: ' + escapeHtml(record.state));
        if (record.matchReasons && record.matchReasons.length) metaParts.push('Match: ' + escapeHtml(record.matchReasons.join(', ')));
        if (record.sourcePath) metaParts.push('Source: ' + escapeHtml(record.sourcePath));
      } else if (domain === 'tasks') {
        if (record.status) metaParts.push('Status: ' + escapeHtml(record.status));
        if (record.relevantDates && record.relevantDates.dueDate) metaParts.push('Due: ' + escapeHtml(record.relevantDates.dueDate));
        if (record.matchReasons && record.matchReasons.length) metaParts.push('Match: ' + escapeHtml(record.matchReasons.join(', ')));
        if (record.sourcePath) metaParts.push('Source: ' + escapeHtml(record.sourcePath));
      } else if (domain === 'notes') {
        if (record.dateKind) metaParts.push(record.dateKind.charAt(0).toUpperCase() + record.dateKind.slice(1));
        if (record.documentDate) metaParts.push('Date: ' + escapeHtml(record.documentDate));
        if (record.matchReasons && record.matchReasons.length) metaParts.push('Match: ' + escapeHtml(record.matchReasons.join(', ')));
        if (record.sourcePath) metaParts.push('Source: ' + escapeHtml(record.sourcePath));
      }
      metaDiv.textContent = metaParts.join('  •  ');
      details.appendChild(metaDiv);
      row.appendChild(checkbox);
      row.appendChild(details);
      list.appendChild(row);
    });
    section.appendChild(list);
    sectionsDiv.appendChild(section);
  });
  view.appendChild(sectionsDiv);


  var reviewDiv = document.createElement('div');
  reviewDiv.className = 'reportComposerSelectionReview';
  var reviewHeading = document.createElement('div');
  reviewHeading.className = 'reportComposerSelectionHeading';
  reviewHeading.textContent = 'Selection Review';
  reviewDiv.appendChild(reviewHeading);
  var countsDiv = document.createElement('div');
  countsDiv.className = 'reportComposerSelectionCounts';
  countsDiv.setAttribute('id', 'reportComposerSelectionCounts');
  var totalSelected = state.selection.projectIds.length + state.selection.taskIds.length + state.selection.notePaths.length;
  var totalEligible = projection.projects.length + projection.tasks.length + projection.notes.length;
  countsDiv.textContent = 'Selected: ' + totalSelected + ' of ' + totalEligible + ' eligible';
  reviewDiv.appendChild(countsDiv);
  view.appendChild(reviewDiv);

  var buildDiv = document.createElement('div');
  buildDiv.className = 'reportComposerBuildRow';
  var buildBtn = document.createElement('button');
  buildBtn.type = 'button';
  buildBtn.className = 'reportComposerBuildButton';
  buildBtn.setAttribute('data-report-action', 'composer-build-selection');
  buildBtn.textContent = 'Build Selection';
  var canBuild = projection.periodValid &&
                 projection.workspaceAvailable &&
                 projection.indexReady &&
                 totalSelected > 0;
  buildBtn.disabled = !canBuild;
  if (!canBuild) {
    if (!projection.periodValid) buildBtn.title = periodNorm.error || 'Invalid period';
    else if (!projection.workspaceAvailable) buildBtn.title = 'Open a Workspace to compose a Report';
    else if (!projection.indexReady) buildBtn.title = 'Preparing Workspace records…';
    else buildBtn.title = 'Select at least one record before building';
  }
  buildBtn.addEventListener('click', function () {
    var result = buildSelection();
    if (result.valid) {
      alert('Build Selection complete: ' + result.selectedProjectIds.length + ' projects, ' + result.selectedTaskIds.length + ' tasks, ' + result.selectedNotePaths.length + ' notes');
    } else {
      alert(result.error || 'Cannot build selection');
    }
  });
  buildDiv.appendChild(buildBtn);
  view.appendChild(buildDiv);

  var ariaDiv = document.createElement('div');
  ariaDiv.setAttribute('aria-live', 'polite');
  ariaDiv.className = 'reportComposerAria';
  ariaDiv.hidden = true;
  var msgs = [];
  if (periodNorm.status === 'invalid') msgs.push(periodNorm.error);
  projection.diagnostics.forEach(function (d) { if (d.level === 'warn') msgs.push(d.detail); });
  if (msgs.length) {
    ariaDiv.hidden = false;
    ariaDiv.textContent = msgs.join('  |  ');
  }
  view.appendChild(ariaDiv);

  host.appendChild(view);
}


function open() {
  var host = document.getElementById('workspaceReportPanel');
  if (host) {
    renderComposerView(host);
  }
  return getState();
}

function returnToWorkspace() {
  var host = document.getElementById('workspaceReportPanel');
  if (host) {
    var view = host.querySelector('.reportComposerView');
    if (view) {
      view.hidden = true;
    }
  }
  return getState();
}

function render(host) {
  if (host) {
    renderComposerView(host);
  }
  return getState();
}

function refresh() {
  var host = document.getElementById('workspaceReportPanel');
  if (host) {
    renderComposerView(host);
  }
  return getState();
}


function reset() {
  resetState();
  resetDefaultSelection();
  var host = document.getElementById('workspaceReportPanel');
  if (host) {
    renderComposerView(host);
  }
  return getState();
}

function getState() {
  var snapshot = {
    config: {
      period: {
        startDate: state.config.period.startDate,
        endDate: state.config.period.endDate,
        inclusive: state.config.period.inclusive,
      },
      includedDomains: {
        projects: state.config.includedDomains.projects,
        tasks: state.config.includedDomains.tasks,
        notes: state.config.includedDomains.notes,
      },
    },
    selection: {
      projectIds: [...state.selection.projectIds],
      taskIds: [...state.selection.taskIds],
      notePaths: [...state.selection.notePaths],
    },
    workflow: { step: state.workflow.step },
    projection: {
      eligibleProjectIds: [...state.projection.eligibleProjectIds],
      eligibleTaskIds: [...state.projection.eligibleTaskIds],
      eligibleNotePaths: [...state.projection.eligibleNotePaths],
      diagnostics: [...state.projection.diagnostics],
    },
  };
  return Object.freeze(snapshot);
}

function setPeriod(startDate, endDate) {
  var norm = normalizePeriod(startDate, endDate);
  state = Object.freeze(Object.assign({}, state, {
    config: Object.assign({}, state.config, {
      period: {
        startDate: norm.startDate,
        endDate: norm.endDate,
        inclusive: true
      }
    })
  }));
  resetDefaultSelection();
  var host = document.getElementById('workspaceReportPanel');
  if (host) {
    renderComposerView(host);
  }
  return getState();
}

function setDomain(domain, included) {
  state = Object.freeze(Object.assign({}, state, {
    config: Object.assign({}, state.config, {
      includedDomains: Object.assign({}, state.config.includedDomains, { [domain]: included })
    })
  }));
  resetDefaultSelection();
  var host = document.getElementById('workspaceReportPanel');
  if (host) {
    renderComposerView(host);
  }
  return getState();
}


function setRecordSelected(id, domain, selected) {
  if (domain === 'projects') {
    var pidSet = new Set(state.selection.projectIds);
    if (selected) pidSet.add(id); else pidSet.delete(id);
    state = Object.freeze(Object.assign({}, state, {
      selection: Object.assign({}, state.selection, { projectIds: Array.from(pidSet) })
    }));
  } else if (domain === 'tasks') {
    var tidSet = new Set(state.selection.taskIds);
    if (selected) tidSet.add(id); else tidSet.delete(id);
    state = Object.freeze(Object.assign({}, state, {
      selection: Object.assign({}, state.selection, { taskIds: Array.from(tidSet) })
    }));
  } else if (domain === 'notes') {
    var npathSet = new Set(state.selection.notePaths);
    if (selected) npathSet.add(id); else npathSet.delete(id);
    state = Object.freeze(Object.assign({}, state, {
      selection: Object.assign({}, state.selection, { notePaths: Array.from(npathSet) })
    }));
  }
  var host = document.getElementById('workspaceReportPanel');
  if (host) {
    renderComposerView(host);
  }
  return getState();
}

function selectEligible(domain) {
  var projection = buildEligibilityProjection(
    typeof globalThis !== 'undefined' && globalThis.WORKSPACE_INDEX_STATE ? globalThis.WORKSPACE_INDEX_STATE : null,
    state
  );
  var ids = [];
  if (domain === 'projects') ids = projection.projects.map(function (p) { return p.id; });
  else if (domain === 'tasks') ids = projection.tasks.map(function (t) { return t.id; });
  else if (domain === 'notes') ids = projection.notes.map(function (n) { return n.path; });

  var currentSet = new Set(domain === 'projects' ? state.selection.projectIds :
                          domain === 'tasks' ? state.selection.taskIds :
                          state.selection.notePaths);
  ids.forEach(function (id) { currentSet.add(id); });

  if (domain === 'projects') {
    state = Object.freeze(Object.assign({}, state, {
      selection: Object.assign({}, state.selection, { projectIds: Array.from(currentSet) })
    }));
  } else if (domain === 'tasks') {
    state = Object.freeze(Object.assign({}, state, {
      selection: Object.assign({}, state.selection, { taskIds: Array.from(currentSet) })
    }));
  } else if (domain === 'notes') {
    state = Object.freeze(Object.assign({}, state, {
      selection: Object.assign({}, state.selection, { notePaths: Array.from(currentSet) })
    }));
  }
  var host = document.getElementById('workspaceReportPanel');
  if (host) {
    renderComposerView(host);
  }
  return getState();
}

function clearSelection(domain) {
  if (domain === 'projects') {
    state = Object.freeze(Object.assign({}, state, {
      selection: Object.assign({}, state.selection, { projectIds: [] })
    }));
  } else if (domain === 'tasks') {
    state = Object.freeze(Object.assign({}, state, {
      selection: Object.assign({}, state.selection, { taskIds: [] })
    }));
  } else if (domain === 'notes') {
    state = Object.freeze(Object.assign({}, state, {
      selection: Object.assign({}, state.selection, { notePaths: [] })
    }));
  }
  var host = document.getElementById('workspaceReportPanel');
  if (host) {
    renderComposerView(host);
  }
  return getState();
}

function buildSelection() {
  var period = state.config.period;
  if (!period.startDate || !period.endDate) {
    return { valid: false, error: 'Start date must be on or before End date.' };
  }
  if (period.startDate > period.endDate) {
    return { valid: false, error: 'Start date must be on or before End date.' };
  }
  var hasSelection =
    state.selection.projectIds.length > 0 ||
    state.selection.taskIds.length > 0 ||
    state.selection.notePaths.length > 0;
  if (!hasSelection) {
    return { valid: false, error: 'Select at least one record before building.' };
  }
  return {
    valid: true,
    period: { startDate: period.startDate, endDate: period.endDate, inclusive: period.inclusive },
    includedDomains: {
      projects: state.config.includedDomains.projects,
      tasks: state.config.includedDomains.tasks,
      notes: state.config.includedDomains.notes
    },
    selectedProjectIds: [...state.selection.projectIds],
    selectedTaskIds: [...state.selection.taskIds],
    selectedNotePaths: [...state.selection.notePaths],
    eligibleCounts: {
      projects: state.projection.eligibleProjectIds ? state.projection.eligibleProjectIds.length : 0,
      tasks: state.projection.eligibleTaskIds ? state.projection.eligibleTaskIds.length : 0,
      notes: state.projection.eligibleNotePaths ? state.projection.eligibleNotePaths.length : 0
    },
    selectedCounts: {
      projects: state.selection.projectIds.length,
      tasks: state.selection.taskIds.length,
      notes: state.selection.notePaths.length
    },
    diagnostics: state.projection.diagnostics || [],
    sourceTraceability: {
      projects: [],
      tasks: [],
      notes: []
    },
    workflowStep: 'review'
  };
}

function recomputeProjection() {
  var host = document.getElementById('workspaceReportPanel');
  if (host) {
    renderComposerView(host);
  }
  return getState();
}

// =========================================================================
// Wire actions immediately (DOM may already be ready when module loads)
// =========================================================================

wireComposerActions();

// =========================================================================
// Publish Composer API via established global pattern
// =========================================================================

const composerAPI = Object.freeze({
  open,
  returnToWorkspace,
  render,
  refresh,
  reset,
  getState,
  setPeriod,
  setDomain,
  setRecordSelected,
  selectEligible,
  clearSelection,
  buildSelection,
  recomputeProjection
});

if (typeof globalThis !== 'undefined') {
  globalThis.MME_REPORT_COMPOSER = composerAPI;
}
if (typeof window !== 'undefined') {
  window.MME_REPORT_COMPOSER = composerAPI;
}

})();