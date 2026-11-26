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

  // Log a Composer action once to the app Logs panel (never per render item,
  // never record titles/note contents or file paths).
  function logComposer(message) {
    try {
      var fn = globalThis.log || (globalThis.MME_APP && globalThis.MME_APP.log);
      if (typeof fn === 'function') fn('[Report Composer] ' + message);
    } catch {}
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
    },
    sections: {
      projects: { enabled: true, periodOverride: null, initialView: 'table' },
      tasks: { enabled: true, periodOverride: null, initialView: 'grouped-list' },
      notes: { enabled: false, periodOverride: null, initialView: 'text' }
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

  if (project.expectedOrder && quarterIntersectsPeriod(project.expectedOrder.canonical, period)) {
    matchReasons.push('expected-order');
    periodValues.expectedOrder = project.expectedOrder;
  }
  if (project.expectedDelivery && quarterIntersectsPeriod(project.expectedDelivery.canonical, period)) {
    matchReasons.push('expected-delivery');
    periodValues.expectedDelivery = project.expectedDelivery;
  }
  if (project.expectedBilling && quarterIntersectsPeriod(project.expectedBilling.canonical, period)) {
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

  // An open Task is eligible as "open at period end" even without a due date;
  // do not discard it solely for lack of an optional field.
  if (!done && (!dueDate || dueDate <= endDate)) {
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

function buildEligibilityProjection(indexSnapshot, composerState, periodOverride) {
  // periodOverride (per-section effective period) takes precedence over the
  // global period. null means inherit the global period.
  var period = periodOverride || composerState.config.period;
  var includedDomains = composerState.config.includedDomains;
  var selection = composerState.selection;

  var periodNorm = normalizePeriod(period.startDate, period.endDate);
  var periodValid = periodNorm.status === 'complete';

  var eligibleProjects = [];
  var eligibleTasks = [];
  var eligibleNotes = [];
  var diagnostics = [];

  // Workspace presence is owned by WORKSPACE_STATE.rootHandle (the Workspace
  // file-handle owner), NOT by the Index snapshot. The Index (WORKSPACE_INDEX_STATE)
  // owns readiness and the record collections; it has no rootHandle field.
  var indexReady = indexSnapshot && indexSnapshot.ready === true;
  var workspaceAvailable = Boolean(
    typeof globalThis !== 'undefined' &&
    globalThis.WORKSPACE_STATE &&
    globalThis.WORKSPACE_STATE.rootHandle
  );

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

  var sourceAvailable = workspaceAvailable && indexReady;
  return {
    projects: eligibleProjects,
    tasks: eligibleTasks,
    notes: eligibleNotes,
    diagnostics: diagnostics,
    periodValid: periodValid,
    periodError: periodNorm.error,
    workspaceAvailable: workspaceAvailable,
    indexReady: indexReady,
    ok: sourceAvailable
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

// Translate internal match-reason IDs into readable labels for the UI.
// Never label a forecast quarter as a created date or an actual order/billing
// date; keep the existing quarter-overlap behavior.
function readableMatchReason(reason, domain) {
  var labels = {
    projects: {
      'expected-order': 'Expected Order quarter overlaps period',
      'expected-delivery': 'Expected Delivery quarter overlaps period',
      'expected-billing': 'Expected Billing quarter overlaps period',
    },
    tasks: {
      'open-at-period-end': 'Open at period end',
      'due-in-period': 'Due within period',
      'completed-in-period': 'Completed within period',
      'overdue-at-period-end': 'Overdue at period end',
    },
    notes: {
      'dated-in-period': 'Document date within period',
      'undated-manual': 'Undated (manual)',
    },
  };
  var domainLabels = labels[domain] || {};
  return domainLabels[reason] || reason;
}

function escapeHtml(text) {
  if (!text) return '';
  var div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

// Read-only review row: name, match reasons, source path. No generation, no Save.
function reviewRecordRow(rec) {
  var row = document.createElement('div');
  row.className = 'reportComposerReviewRow';
  var name = document.createElement('div');
  name.className = 'reportComposerReviewName';
  name.textContent = rec.name || 'Untitled';
  var meta = document.createElement('div');
  meta.className = 'reportComposerReviewMeta';
  var parts = [];
  if (rec.reasons && rec.reasons.length) {
    var reasons = rec.reasons.map(function (r) { return readableMatchReason(r, rec.domain); });
    parts.push('Match: ' + escapeHtml(reasons.join(', ')));
  }
  if (rec.sourcePath) parts.push('Source: ' + escapeHtml(rec.sourcePath));
  meta.textContent = parts.join('  •  ');
  row.appendChild(name);
  row.appendChild(meta);
  return row;
}


function renderComposerView(host) {
  // If a report has been generated, show the Reader view instead of the
  // Composer configuration surface.
  if (state.workflow && state.workflow.step === 'generated') {
    renderReaderView(host);
    return;
  }

  const container = getComposerContainer();
  if (!container) return;
  container.innerHTML = '';
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

  var body = document.createElement('div');
  body.className = 'reportComposerBody';
  view.appendChild(body);


  var globalConfigDiv = document.createElement('div');
  globalConfigDiv.className = 'reportComposerGlobalConfig';

  // --- Period group (editable, global) ---
  var periodGroup = document.createElement('div');
  periodGroup.className = 'reportComposerPeriodGroup';
  var periodHeading = document.createElement('div');
  periodHeading.className = 'reportComposerConfigureHeading';
  periodHeading.textContent = 'Period';
  periodGroup.appendChild(periodHeading);

  var periodInputs = document.createElement('div');
  periodInputs.className = 'reportComposerPeriodInputs';

  var startLabel = document.createElement('label');
  startLabel.className = 'reportComposerFieldLabel';
  startLabel.setAttribute('for', 'reportComposerPeriodStart');
  startLabel.textContent = 'Start date';
  var startInput = document.createElement('input');
  startInput.type = 'date';
  startInput.id = 'reportComposerPeriodStart';
  startInput.className = 'reportComposerPeriodInput';
  startInput.value = state.config.period.startDate || '';
  startInput.addEventListener('change', function () {
    setPeriod(startInput.value || null, endInput.value || null);
    renderComposerView(host);
  });
  var endLabel = document.createElement('label');
  endLabel.className = 'reportComposerFieldLabel';
  endLabel.setAttribute('for', 'reportComposerPeriodEnd');
  endLabel.textContent = 'End date';
  var endInput = document.createElement('input');
  endInput.type = 'date';
  endInput.id = 'reportComposerPeriodEnd';
  endInput.className = 'reportComposerPeriodInput';
  endInput.value = state.config.period.endDate || '';
  endInput.addEventListener('change', function () {
    setPeriod(startInput.value || null, endInput.value || null);
    renderComposerView(host);
  });
  periodInputs.appendChild(startLabel);
  periodInputs.appendChild(startInput);
  periodInputs.appendChild(endLabel);
  periodInputs.appendChild(endInput);
  periodGroup.appendChild(periodInputs);

  var periodValueDiv = document.createElement('div');
  periodValueDiv.className = 'reportComposerPeriodValue';
  periodValueDiv.setAttribute('id', 'reportComposerPeriodValue');
  if (periodNorm.status === 'complete') {
    periodValueDiv.textContent = 'Period: ' + periodNorm.startDate + ' to ' + periodNorm.endDate + ' (inclusive)';
  } else if (periodNorm.status === 'invalid') {
    periodValueDiv.textContent = 'Period: ' + (periodNorm.startDate || '—') + ' to ' + (periodNorm.endDate || '—') + ' — ' + (periodNorm.error || 'Invalid period');
    periodValueDiv.className += ' reportComposerPeriodInvalid';
  } else {
    periodValueDiv.textContent = 'Period: —';
  }
  periodGroup.appendChild(periodValueDiv);
  globalConfigDiv.appendChild(periodGroup);

  // --- Include domains group ---
  var includeGroup = document.createElement('div');
  includeGroup.className = 'reportComposerIncludeGroup';
  var includeHeading = document.createElement('div');
  includeHeading.className = 'reportComposerConfigureHeading';
  includeHeading.textContent = 'Include';
  includeGroup.appendChild(includeHeading);

  var domainChecks = document.createElement('div');
  domainChecks.className = 'reportComposerDomainChecks';
  ['projects', 'tasks', 'notes'].forEach(function (domain) {
    var label = document.createElement('label');
    label.className = 'reportComposerDomainCheck';
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.id = 'reportComposerInclude' + domain.charAt(0).toUpperCase() + domain.slice(1);
    input.checked = Boolean(state.config.sections && state.config.sections[domain] && state.config.sections[domain].enabled);
    input.dataset.reportDomain = domain;
    input.addEventListener('change', function () {
      setDomain(domain, input.checked);
      renderComposerView(host);
    });
    var text = document.createElement('span');
    text.textContent = domain.charAt(0).toUpperCase() + domain.slice(1);
    label.appendChild(input);
    label.appendChild(text);
    domainChecks.appendChild(label);
  });
  includeGroup.appendChild(domainChecks);
  globalConfigDiv.appendChild(includeGroup);

  body.appendChild(globalConfigDiv);

  // Domain summary is rendered per-section; no global summary block.


  var sectionsDiv = document.createElement('div');
  sectionsDiv.className = 'reportComposerSections';

  var totalEligible = 0;
  ['projects', 'tasks', 'notes'].forEach(function (domain) {
    var sectionConfig = state.config.sections && state.config.sections[domain] || {};
    var sectionEnabled = Boolean(sectionConfig.enabled);
    if (!sectionEnabled) return;
    var sectionDiv = document.createElement('div');
    sectionDiv.className = 'reportComposerSectionBlock';

    var sectionHeader = document.createElement('div');
    sectionHeader.className = 'reportComposerSectionHeader';
    var sectionTitle = document.createElement('span');
    sectionTitle.className = 'reportComposerSectionTitle';
    sectionTitle.textContent = domain.charAt(0).toUpperCase() + domain.slice(1);
    sectionHeader.appendChild(sectionTitle);

    var periodOverride = sectionConfig.periodOverride || null;
    var effectivePeriod = periodOverride || state.config.period;
    var effectiveNorm = normalizePeriod(effectivePeriod.startDate, effectivePeriod.endDate);

    var effPeriodDiv = document.createElement('div');
    effPeriodDiv.className = 'reportComposerEffectivePeriod';
    if (effectiveNorm.status === 'complete') {
      effPeriodDiv.textContent = 'Period: ' + effectiveNorm.startDate + ' to ' + effectiveNorm.endDate + ' (inclusive)';
    } else if (effectiveNorm.status === 'invalid') {
      effPeriodDiv.textContent = 'Period: ' + (effectiveNorm.startDate || '—') + ' to ' + (effectiveNorm.endDate || '—') + ' — ' + (effectiveNorm.error || 'Invalid period');
      effPeriodDiv.className += ' reportComposerPeriodInvalid';
    } else {
      effPeriodDiv.textContent = 'Period: —';
    }
    sectionHeader.appendChild(effPeriodDiv);
    sectionDiv.appendChild(sectionHeader);

    var useGlobalLabel = document.createElement('label');
    useGlobalLabel.className = 'reportComposerUseGlobal';
    var useGlobalInput = document.createElement('input');
    useGlobalInput.type = 'checkbox';
    useGlobalInput.checked = sectionConfig.periodOverride === null;
    useGlobalInput.addEventListener('change', function () {
      if (useGlobalInput.checked) {
        // Explicitly restore inheritance of the global period.
        setSectionPeriod(domain, null, null);
      } else {
        // Activate custom period mode for this section, seeded from the
        // current effective period so the editable fields are pre-filled. The
        // override is independent of the global period; a partial range stays
        // custom and incomplete.
        var cur = effectivePeriod;
        setSectionPeriod(domain, cur.startDate || '', cur.endDate || '');
      }
      renderComposerView(host);
    });
    var useGlobalText = document.createTextNode(' Use global period');
    useGlobalLabel.appendChild(useGlobalInput);
    useGlobalLabel.appendChild(useGlobalText);
    sectionHeader.appendChild(useGlobalLabel);

    if (sectionConfig.periodOverride !== null) {
      var customPeriodInputs = document.createElement('div');
      customPeriodInputs.className = 'reportComposerCustomPeriod';

      var cStartLabel = document.createElement('label');
      cStartLabel.className = 'reportComposerFieldLabel';
      cStartLabel.setAttribute('for', 'reportComposerSectionPeriodStart' + domain.charAt(0).toUpperCase() + domain.slice(1));
      cStartLabel.textContent = 'Start date';
      var cStartInput = document.createElement('input');
      cStartInput.type = 'date';
      cStartInput.id = 'reportComposerSectionPeriodStart' + domain.charAt(0).toUpperCase() + domain.slice(1);
      cStartInput.className = 'reportComposerPeriodInput';
      cStartInput.value = effectivePeriod.startDate || '';
      cStartInput.addEventListener('change', function () {
        setSectionPeriod(domain, cStartInput.value || null, cEndInput.value || null);
        renderComposerView(host);
      });
      var cEndLabel = document.createElement('label');
      cEndLabel.className = 'reportComposerFieldLabel';
      cEndLabel.setAttribute('for', 'reportComposerSectionPeriodEnd' + domain.charAt(0).toUpperCase() + domain.slice(1));
      cEndLabel.textContent = 'End date';
      var cEndInput = document.createElement('input');
      cEndInput.type = 'date';
      cEndInput.id = 'reportComposerSectionPeriodEnd' + domain.charAt(0).toUpperCase() + domain.slice(1);
      cEndInput.className = 'reportComposerPeriodInput';
      cEndInput.value = effectivePeriod.endDate || '';
      cEndInput.addEventListener('change', function () {
        setSectionPeriod(domain, cStartInput.value || null, cEndInput.value || null);
        renderComposerView(host);
      });
      customPeriodInputs.appendChild(cStartLabel);
      customPeriodInputs.appendChild(cStartInput);
      customPeriodInputs.appendChild(cEndLabel);
      customPeriodInputs.appendChild(cEndInput);
      sectionDiv.appendChild(customPeriodInputs);
    }

    var viewSelector = document.createElement('div');
    viewSelector.className = 'reportComposerViewSelector';
    var viewLabel = document.createElement('label');
    viewLabel.className = 'reportComposerFieldLabel';
    viewLabel.textContent = 'Report style';
    var viewSelect = document.createElement('select');
    viewSelect.className = 'reportComposerViewSelect';
    viewSelect.value = sectionConfig.initialView || 'table';
    var views = domain === 'projects' ? ['table', 'cards'] :
                domain === 'tasks' ? ['grouped-list', 'table', 'cards'] :
                ['text', 'list'];
    views.forEach(function (v) {
      var opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v.charAt(0).toUpperCase() + v.slice(1);
      viewSelect.appendChild(opt);
    });
    viewSelect.addEventListener('change', function () {
      setSectionInitialView(domain, viewSelect.value);
      renderComposerView(host);
    });
    viewSelector.appendChild(viewLabel);
    viewSelector.appendChild(viewSelect);
    sectionDiv.appendChild(viewSelector);

    var sectionProjection = buildEligibilityProjection(
      typeof globalThis !== 'undefined' && globalThis.WORKSPACE_INDEX_STATE ? globalThis.WORKSPACE_INDEX_STATE : null,
      state,
      effectivePeriod
    );
    var records = domain === 'projects' ? sectionProjection.projects :
                 domain === 'tasks' ? sectionProjection.tasks :
                 sectionProjection.notes;
    totalEligible += records.length;

    var selCount = (domain === 'projects' ? state.selection.projectIds :
                   domain === 'tasks' ? state.selection.taskIds :
                   state.selection.notePaths).length;
    var headingCount = document.createElement('div');
    headingCount.className = 'reportComposerSectionCounts';
    headingCount.textContent = ' (' + selCount + ' of ' + records.length + ')';
    sectionHeader.appendChild(headingCount);

    // "Filtrado por:" — short rule visible on each section, based on what the
    // code actually applies. Not a selector; purely informational.
    var filterLabel = document.createElement('div');
    filterLabel.className = 'reportComposerFilterLabel';
    if (domain === 'projects') {
      filterLabel.textContent = 'Match rule: Expected Order / Delivery / Billing quarter overlaps the report period';
    } else if (domain === 'tasks') {
      filterLabel.textContent = 'Match rule: Open at period end · Due within period · Completed within period · Overdue at period end';
    } else if (domain === 'notes') {
      filterLabel.textContent = 'Match rule: Document date within period · Undated → manual';
    }
    sectionHeader.appendChild(filterLabel);

    var tools = document.createElement('div');
    tools.className = 'reportComposerSectionTools';
    var selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.className = 'reportComposerSectionTool';
    selectBtn.textContent = 'Select all';
    selectBtn.dataset.reportDomain = domain;
    selectBtn.addEventListener('click', function () { selectEligible(domain); renderComposerView(host); });
    var clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'reportComposerSectionTool';
    clearBtn.textContent = 'Deselect all';
    clearBtn.dataset.reportDomain = domain;
    clearBtn.disabled = selCount === 0;
    clearBtn.addEventListener('click', function () { clearSelection(domain); renderComposerView(host); });
    // Select all has nothing to do when no eligible records exist or all are
    // already selected; Deselect all has nothing to do when nothing selected.
    var eligibleCount = records.length;
    selectBtn.disabled = eligibleCount === 0 || selCount === eligibleCount;
    tools.appendChild(selectBtn);
    tools.appendChild(clearBtn);
    sectionDiv.appendChild(tools);

    var list = document.createElement('div');
    list.className = 'reportComposerSectionList';
    list.setAttribute('id', 'reportComposer' + domain.charAt(0).toUpperCase() + domain.slice(1) + 'List');
    var undatedShown = false;
    records.forEach(function (record) {
      if (domain === 'notes' && record.dateKind === 'undated' && !undatedShown) {
        var undatedHead = document.createElement('div');
        undatedHead.className = 'reportComposerSectionSubhead';
        undatedHead.textContent = 'Undated / Manual';
        list.appendChild(undatedHead);
        undatedShown = true;
      }
      var row = document.createElement('label');
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
        if (record.matchReasons && record.matchReasons.length) {
          var reasons = record.matchReasons.map(function (r) { return readableMatchReason(r, 'projects'); });
          metaParts.push('Match: ' + escapeHtml(reasons.join(', ')));
        }
        if (record.sourcePath) metaParts.push('Source: ' + escapeHtml(record.sourcePath));
      } else if (domain === 'tasks') {
        if (record.status) metaParts.push('Status: ' + escapeHtml(record.status));
        if (record.relevantDates && record.relevantDates.dueDate) metaParts.push('Due: ' + escapeHtml(record.relevantDates.dueDate));
        if (record.matchReasons && record.matchReasons.length) {
          var reasons = record.matchReasons.map(function (r) { return readableMatchReason(r, 'tasks'); });
          metaParts.push('Match: ' + escapeHtml(reasons.join(', ')));
        }
        if (record.sourcePath) metaParts.push('Source: ' + escapeHtml(record.sourcePath));
      } else if (domain === 'notes') {
        if (record.dateKind) metaParts.push(record.dateKind.charAt(0).toUpperCase() + record.dateKind.slice(1));
        if (record.documentDate) metaParts.push('Date: ' + escapeHtml(record.documentDate));
        if (record.matchReasons && record.matchReasons.length) {
          var reasons = record.matchReasons.map(function (r) { return readableMatchReason(r, 'notes'); });
          metaParts.push('Match: ' + escapeHtml(reasons.join(', ')));
        }
        if (record.sourcePath) metaParts.push('Source: ' + escapeHtml(record.sourcePath));
      }
      metaDiv.textContent = metaParts.join('  •  ');
      details.appendChild(metaDiv);
      row.appendChild(checkbox);
      row.appendChild(details);
      list.appendChild(row);
    });
    if (records.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'reportComposerSectionEmpty';
      empty.textContent = 'No ' + domain.charAt(0).toUpperCase() + domain.slice(1).toLowerCase() + ' match this period.';
      list.appendChild(empty);
    }
    sectionDiv.appendChild(list);
    sectionsDiv.appendChild(sectionDiv);
  });
  body.appendChild(sectionsDiv);


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
  // totalEligible is accumulated per section above (each section's effective
  // period), so the summary shows eligible counts for enabled sections only.
  countsDiv.textContent = 'Selected: ' + totalSelected + ' of ' + totalEligible + ' eligible';
  reviewDiv.appendChild(countsDiv);
  body.appendChild(reviewDiv);

  var actions = document.createElement('div');
  actions.className = 'reportComposerActions';
  view.appendChild(actions);

  var buildDiv = document.createElement('div');
  buildDiv.className = 'reportComposerBuildRow';
  var buildBtn = document.createElement('button');
  buildBtn.type = 'button';
  buildBtn.className = 'reportComposerBuildButton';
  buildBtn.setAttribute('data-report-action', 'composer-build-selection');
  // 'Build Selection' is the read-only operation; its visible label is
  // 'Review selection'. Keep the canonical name for the action contract.
  buildBtn.textContent = 'Review selection';
  buildBtn.setAttribute('aria-label', 'Build Selection');
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

  // Inline review output (populated after Review selection; no alert).
  var reviewOut = document.createElement('div');
  reviewOut.className = 'reportComposerReviewOut';
  reviewDiv.appendChild(reviewOut);

  buildBtn.addEventListener('click', function () {
    var result = buildSelection();
    reviewOut.innerHTML = '';
    if (!result.valid) {
      logComposer('Review rejected: ' + (result.error || 'Cannot build selection.'));
      var err = document.createElement('div');
      err.className = 'reportComposerReviewError';
      err.textContent = result.error || 'Cannot build selection.';
      reviewOut.appendChild(err);
      return;
    }
    // Mark workflow as reviewed so Generate Report becomes available.
    state = Object.freeze(Object.assign({}, state, {
      workflow: { step: 'review' },
    }));
    logComposer('Workflow set to review; totalSelected=' + (state.selection.projectIds.length + state.selection.taskIds.length + state.selection.notePaths.length));
    // Add the Generate Report button to the existing actions row without
    // clearing the review output that is about to be rendered below.
    var actionsEl = document.querySelector('.reportComposerActions');
    if (actionsEl && !actionsEl.querySelector('[data-report-action="composer-generate-report"]')) {
      var genDiv = document.createElement('div');
      genDiv.className = 'reportComposerBuildRow';
      var genBtn = document.createElement('button');
      genBtn.type = 'button';
      genBtn.className = 'reportComposerBuildButton reportComposerGenerateButton';
      genBtn.setAttribute('data-report-action', 'composer-generate-report');
      genBtn.textContent = 'Generate Report';
      genBtn.addEventListener('click', function () {
        var genResult = generateReport();
        if (genResult.ok) {
          renderComposerView(host);
        } else {
          logComposer('Generate failed: ' + (genResult.error || 'unknown error'));
          var errOut = document.querySelector('.reportComposerReviewOut');
          if (errOut) {
            var err = document.createElement('div');
            err.className = 'reportComposerReviewError';
            err.textContent = 'Generate failed: ' + (genResult.error || 'unknown error');
            errOut.appendChild(err);
          }
        }
      });
      genDiv.appendChild(genBtn);
      actionsEl.appendChild(genDiv);
    }
    // Recompute the projection to render real source traceability for the
    // selected records (read-only; no generation, no Save).
    var viewProjection = buildEligibilityProjection(
      typeof globalThis !== 'undefined' && globalThis.WORKSPACE_INDEX_STATE ? globalThis.WORKSPACE_INDEX_STATE : null,
      state
    );
    var byId = {};
    viewProjection.projects.forEach(function (p) { byId[p.id] = { domain: 'projects', name: p.name, sourcePath: p.sourcePath, reasons: p.matchReasons }; });
    viewProjection.tasks.forEach(function (t) { byId[t.id] = { domain: 'tasks', name: t.text, sourcePath: t.sourcePath, reasons: t.matchReasons }; });
    viewProjection.notes.forEach(function (n) { byId[n.path] = { domain: 'notes', name: n.title, sourcePath: n.path, reasons: n.matchReasons }; });

    var total = result.selectedProjectIds.length + result.selectedTaskIds.length + result.selectedNotePaths.length;
    var head = document.createElement('div');
    head.className = 'reportComposerReviewHead';
    head.textContent = 'Review selection: ' + total + ' record(s) selected';
    reviewOut.appendChild(head);

    var counts = document.createElement('div');
    counts.className = 'reportComposerReviewCounts';
    counts.textContent = 'Projects ' + result.selectedProjectIds.length + ' · Tasks ' + result.selectedTaskIds.length + ' · Notes ' + result.selectedNotePaths.length;
    reviewOut.appendChild(counts);
    // Per-section Review log: source state, effective period, origin
    // (global/custom), eligible candidates, included (selected), displayed.
    var sourceState = (projection.workspaceAvailable && projection.indexReady) ? 'ready' : 'unavailable';
    ['projects', 'tasks', 'notes'].forEach(function (d) {
      var sel = state.config.sections && state.config.sections[d];
      var override = sel && sel.periodOverride;
      var origin = override === null ? 'global' : 'custom';
      var effPeriod = override || state.config.period;
      var eligibleInDomain = (d === 'projects' ? viewProjection.projects : d === 'tasks' ? viewProjection.tasks : viewProjection.notes).length;
      var selectedInDomain = (d === 'projects' ? result.selectedProjectIds : d === 'tasks' ? result.selectedTaskIds : result.selectedNotePaths).length;
      logComposer('Review section=' + d + ' source=' + sourceState + ' period=' + (effPeriod.startDate || '—') + ' to ' + (effPeriod.endDate || '—') + ' origin=' + origin + ' eligible=' + eligibleInDomain + ' included=' + selectedInDomain + ' displayed=' + selectedInDomain);
    });

    var list = document.createElement('div');
    list.className = 'reportComposerReviewList';
    var shown = 0;
    result.selectedProjectIds.forEach(function (id) { var r = byId[id]; if (r) { shown++; list.appendChild(reviewRecordRow(r)); } });
    result.selectedTaskIds.forEach(function (id) { var r = byId[id]; if (r) { shown++; list.appendChild(reviewRecordRow(r)); } });
    result.selectedNotePaths.forEach(function (id) { var r = byId[id]; if (r) { shown++; list.appendChild(reviewRecordRow(r)); } });
    if (shown === 0) {
      var none = document.createElement('div');
      none.className = 'reportComposerReviewNone';
      none.textContent = 'No records to review.';
      list.appendChild(none);
    }
    reviewOut.appendChild(list);
  });
  buildDiv.appendChild(buildBtn);
  actions.appendChild(buildDiv);

  // Generate Report: only available after a successful review with selected
  // items. Generates an in-memory Markdown draft and opens the Reader view.
  if (totalSelected > 0) {
    var genDiv = document.createElement('div');
    genDiv.className = 'reportComposerBuildRow';
    var genBtn = document.createElement('button');
    genBtn.type = 'button';
    genBtn.className = 'reportComposerBuildButton reportComposerGenerateButton';
    genBtn.setAttribute('data-report-action', 'composer-generate-report');
    genBtn.textContent = 'Generate Report';
    genBtn.addEventListener('click', function () {
      var genResult = generateReport();
      if (genResult.ok) {
        renderComposerView(host);
      } else {
        logComposer('Generate failed: ' + (genResult.error || 'unknown error'));
        var err = document.createElement('div');
        err.className = 'reportComposerReviewError';
        err.textContent = 'Generate failed: ' + (genResult.error || 'unknown error');
        reviewOut.appendChild(err);
      }
    });
    genDiv.appendChild(genBtn);
    actions.appendChild(genDiv);
  }

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

  container.appendChild(view);
}


function open() {
  const host = getComposerHost();
  if (host && typeof host.switchTo === 'function') {
    host.switchTo('report-composer', { reason: 'open report composer' });
  }
  logComposer('Expanded Report opened');
  return getState();
}

function returnToWorkspace() {
  const host = getComposerHost();
  if (host && typeof host.switchTo === 'function') {
    host.switchTo('journal', { reason: 'composer return to workspace' });
  }
  logComposer('Expanded Report closed');
  return getState();
}

function render(host) {
  renderComposerView(host);
  return getState();
}

function refresh() {
  const container = getComposerContainer();
  if (container && !container.hidden) {
    renderComposerView(container);
  }
  return getState();
}


function reset() {
  resetState();
  resetDefaultSelection();
  renderComposerView();
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
      sections: {
        projects: {
          enabled: state.config.sections.projects.enabled,
          periodOverride: state.config.sections.projects.periodOverride
            ? Object.assign({}, state.config.sections.projects.periodOverride)
            : null,
          initialView: state.config.sections.projects.initialView,
        },
        tasks: {
          enabled: state.config.sections.tasks.enabled,
          periodOverride: state.config.sections.tasks.periodOverride
            ? Object.assign({}, state.config.sections.tasks.periodOverride)
            : null,
          initialView: state.config.sections.tasks.initialView,
        },
        notes: {
          enabled: state.config.sections.notes.enabled,
          periodOverride: state.config.sections.notes.periodOverride
            ? Object.assign({}, state.config.sections.notes.periodOverride)
            : null,
          initialView: state.config.sections.notes.initialView,
        },
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
  // Defaults apply once (first valid period); changing the period recomputes
  // eligibility but keeps still-valid user choices and does not auto-recheck
  // manually excluded records.
  logComposer('global period start=' + norm.startDate + ' end=' + norm.endDate + ' status=' + norm.status);
  renderComposerView();
  return getState();
}

function setDomain(domain, included) {
  logComposer('domain ' + domain + ' enabled=' + included);
  state = Object.freeze(Object.assign({}, state, {
    config: Object.assign({}, state.config, {
      includedDomains: Object.assign({}, state.config.includedDomains, { [domain]: included }),
      sections: Object.assign({}, state.config.sections, {
        [domain]: Object.assign({}, state.config.sections[domain], { enabled: included })
      })
    })
  }));
  renderComposerView();
  return getState();
}

// Set a per-section period override. null means inherit the global period.
// An incomplete override stays incomplete; it never falls back silently.
function setSectionPeriod(domain, startDate, endDate) {
  var norm = normalizePeriod(startDate, endDate);
  var override;
  if (startDate === null && endDate === null) {
    // Explicit request to inherit the global period.
    override = null;
  } else {
    // Custom period mode for this section: a partial range stays custom and
    // incomplete and never silently inherits the global period.
    override = {
      startDate: norm.startDate || '',
      endDate: norm.endDate || '',
      inclusive: true
    };
  }
  state = Object.freeze(Object.assign({}, state, {
    config: Object.assign({}, state.config, {
      sections: Object.assign({}, state.config.sections, {
        [domain]: Object.assign({}, state.config.sections[domain], { periodOverride: override })
      })
    })
  }));
  var effective = override || state.config.period;
  var origin = override === null ? 'global' : 'custom';
  logComposer('section ' + domain + ' period origin=' + origin + ' start=' + (effective.startDate || '—') + ' end=' + (effective.endDate || '—'));
  renderComposerView();
  return getState();
}

// Set per-section presentation style (initial view).
function setSectionInitialView(domain, view) {
  state = Object.freeze(Object.assign({}, state, {
    config: Object.assign({}, state.config, {
      sections: Object.assign({}, state.config.sections, {
        [domain]: Object.assign({}, state.config.sections[domain], { initialView: view })
      })
    })
  }));
  renderComposerView();
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
  renderComposerView();
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
  renderComposerView();
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
  renderComposerView();
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
  // Transition to review state when a valid selection exists.
  state = Object.freeze(Object.assign({}, state, {
    workflow: { step: 'review' },
  }));
  logComposer('Review built — ' + hasSelection + ' record(s) selected');
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

// =========================================================================
// Generate Report — builds an in-memory Markdown draft from the reviewed
// selection only. No file writes, no Save, no editor replacement.
// =========================================================================

function getDictionaryModule() {
  return (
    (typeof globalThis !== 'undefined' && globalThis.MME_REPORT_DICTIONARY) ||
    (typeof window !== 'undefined' && window.MME_REPORT_DICTIONARY) ||
    null
  );
}

function getGeneratorModule() {
  return (
    (typeof globalThis !== 'undefined' && globalThis.MME_QUICK_REPORT) ||
    (typeof window !== 'undefined' && window.MME_QUICK_REPORT) ||
    null
  );
}

function generateReport() {
  var result = buildSelection();
  if (!result.valid) {
    return { ok: false, error: result.error || 'Cannot generate report.' };
  }

  var dict = getDictionaryModule();
  var gen = getGeneratorModule();
  if (!dict || typeof dict.buildReportDictionary !== 'function') {
    return { ok: false, error: 'dictionary-module-unavailable' };
  }

  var indexState =
    typeof globalThis !== 'undefined' && globalThis.WORKSPACE_INDEX_STATE
      ? globalThis.WORKSPACE_INDEX_STATE
      : null;
  if (!indexState || indexState.ready !== true) {
    return { ok: false, error: 'index-not-ready' };
  }

  var fullDict = dict.buildReportDictionary({
    indexState: indexState,
    startDate: result.period.startDate,
    endDate: result.period.endDate,
    sections: [
      { id: 'summary', enabled: true },
      { id: 'completed-tasks', enabled: true },
      { id: 'project-forecast', enabled: true },
      { id: 'forecast-totals', enabled: true },
      { id: 'risks', enabled: true },
      { id: 'next-steps', enabled: true },
      { id: 'undated-completed-tasks', enabled: false }
    ],
    projectMode: 'all',
    generatedAt: new Date().toISOString(),
  });

  if (!fullDict || fullDict.ok === false) {
    return { ok: false, error: 'dictionary-build-failed' };
  }

  // Filter to only reviewed/selected items. Never include unselected records.
  var selectedProjectSet = new Set(result.selectedProjectIds);
  var selectedTaskSet = new Set(result.selectedTaskIds);
  var selectedNoteSet = new Set(result.selectedNotePaths);

  var filteredProjects = (fullDict.projects.items || []).filter(function (p) {
    var pid = p.projectId || p.recordKey || '';
    return selectedProjectSet.has(pid);
  });

  var filteredCompleted = (fullDict.tasks.completed || []).filter(function (t) {
    var tid = (t.sourcePath || '') + ':' + (t.sourceLine != null ? t.sourceLine : '');
    return selectedTaskSet.has(tid);
  });
  var filteredOpen = (fullDict.tasks.open || []).filter(function (t) {
    var tid = (t.sourcePath || '') + ':' + (t.sourceLine != null ? t.sourceLine : '');
    return selectedTaskSet.has(tid);
  });

  // Notes: resolve selected note paths from the index state via the read path.
  var filteredNotes = [];
  if (result.selectedNotePaths.length > 0 && indexState.files) {
    for (var i = 0; i < indexState.files.length; i += 1) {
      var n = indexState.files[i];
      if (selectedNoteSet.has(n.path || '')) {
        filteredNotes.push({
          path: n.path || '',
          title: n.title || '',
          date: n.date || '',
        });
      }
    }
  }

  var filteredDict = Object.assign({}, fullDict, {
    projects: Object.assign({}, fullDict.projects, {
      items: filteredProjects,
      totalsByCurrency: fullDict.projects.totalsByCurrency || [],
    }),
    tasks: Object.assign({}, fullDict.tasks, {
      completed: filteredCompleted,
      open: filteredOpen,
    }),
    notes: filteredNotes,
    reportRange: result.period,
  });

  var markdown = '';
  if (gen && typeof gen.buildMarkdown === 'function') {
    markdown = gen.buildMarkdown(filteredDict);
  }

  // Append a Notes section for selected notes (dictionary does not include
  // workspace notes; resolve via the existing read path).
  if (filteredNotes.length > 0) {
    var notesLines = ['', '## Notes', ''];
    for (var i = 0; i < filteredNotes.length; i += 1) {
      var n = filteredNotes[i];
      notesLines.push('- ' + (n.title || n.path) + (n.date ? ' (' + n.date + ')' : ''));
    }
    notesLines.push('');
    markdown = markdown + notesLines.join('\n');
  }

  // Append a Sources section with stable references.
  var sources = [];
  filteredProjects.forEach(function (p) {
    if (p.sourcePath) sources.push({ kind: 'Project', name: p.name, source: p.sourcePath });
  });
  (filteredCompleted.concat(filteredOpen)).forEach(function (t) {
    if (t.sourcePath) sources.push({ kind: 'Task', name: t.text, source: t.sourcePath + (t.sourceLine != null ? ':' + t.sourceLine : '') });
  });
  filteredNotes.forEach(function (n) {
    sources.push({ kind: 'Note', name: n.title, source: n.path });
  });
  if (sources.length > 0) {
    var srcLines = ['', '## Sources', ''];
    for (var i = 0; i < sources.length; i += 1) {
      srcLines.push('- ' + sources[i].kind + ': ' + sources[i].name + ' — ' + sources[i].source);
    }
    srcLines.push('');
    markdown = markdown + srcLines.join('\n');
  }

  // Persist in Composer session state.
  state = Object.freeze(Object.assign({}, state, {
    workflow: { step: 'generated' },
    generatedMarkdown: markdown,
    generatedDictionary: filteredDict,
    generatedPeriod: result.period,
  }));

  return {
    ok: true,
    markdown: markdown,
    dictionary: filteredDict,
    period: result.period,
  };
}

// =========================================================================
// Reader view — dedicated document-style reading surface for the generated
// draft. Read-only; no Save, no Edit, no second model.
// =========================================================================

function renderReaderView(host) {
  const container = getComposerContainer();
  if (!container) return;
  container.innerHTML = '';

  var period = state.generatedPeriod || { startDate: '', endDate: '' };
  var periodNorm = normalizePeriod(period.startDate, period.endDate);
  var periodText = periodNorm.status === 'complete'
    ? periodNorm.startDate + ' to ' + periodNorm.endDate + ' (inclusive)'
    : '—';

  var view = document.createElement('div');
  view.className = 'reportReaderView';
  view.hidden = false;

  // Header
  var header = document.createElement('div');
  header.className = 'reportReaderHeader';

  var backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'reportReaderBackButton';
  backBtn.setAttribute('data-report-action', 'reader-back-to-composer');
  backBtn.textContent = 'Back to Composer';
  backBtn.addEventListener('click', function () { returnToComposer(); });
  header.appendChild(backBtn);

  var titleDiv = document.createElement('div');
  titleDiv.className = 'reportReaderTitle';
  titleDiv.textContent = 'Report';
  header.appendChild(titleDiv);

  var statusDiv = document.createElement('div');
  statusDiv.className = 'reportReaderStatus';
  statusDiv.textContent = 'Unsaved draft';
  header.appendChild(statusDiv);

  var periodDiv = document.createElement('div');
  periodDiv.className = 'reportReaderPeriod';
  periodDiv.textContent = 'Period: ' + periodText;
  header.appendChild(periodDiv);

  view.appendChild(header);

  // Body - scrollable content area
  var body = document.createElement('div');
  body.className = 'reportReaderBody';

  var markdown = state.generatedMarkdown || '';
  var contentDiv = document.createElement('div');
  contentDiv.className = 'reportReaderContent';
  contentDiv.style.whiteSpace = 'pre-wrap';
  contentDiv.style.wordWrap = 'break-word';
  contentDiv.textContent = markdown;
  body.appendChild(contentDiv);

  view.appendChild(body);

  container.appendChild(view);
}

function returnToComposer() {
  // Return from Reader to Composer review state; preserve selection, periods,
  // and initial styles. Do not regenerate.
  state = Object.freeze(Object.assign({}, state, {
    workflow: { step: 'review' },
  }));
  renderComposerView(getComposerContainer());
}

function recomputeProjection() {
  renderComposerView();
  return getState();
}

// =========================================================================
// Wire actions immediately (DOM may already be ready when module loads)
// =========================================================================



// =========================================================================
// Workspace Host integration — dedicated Composer route
// Reuses MME_WORKSPACE_HOST (same owner as Projects and Workspace Index)
// =========================================================================

function getComposerHost() {
  return typeof globalThis.MME_WORKSPACE_HOST === 'object'
    ? globalThis.MME_WORKSPACE_HOST
    : null;
}

let composerContainer = null;

function getComposerContainer() {
  if (!composerContainer) {
    composerContainer = document.createElement('div');
    composerContainer.id = 'workspaceReportComposer';
    composerContainer.className = 'workspaceSection workspaceReportComposer';
    composerContainer.hidden = true;
    composerContainer.setAttribute('aria-label', 'Report Composer');
    // Reuse the working Expanded View layout convention: mount into #layout
    // (positioned below the main toolbar) instead of document.body, so the
    // Composer header is not clipped under the toolbar and the view owns its
    // scroll container. Fall back to document.body only if #layout is absent.
    const layout = document.getElementById('layout');
    if (layout) {
      layout.appendChild(composerContainer);
    } else {
      document.body.appendChild(composerContainer);
    }
  }
  return composerContainer;
}

// Sync the Sidebar's visible date/domain inputs to the Composer session on
// first open, when the Composer has no period set yet. This guarantees the
// dates and domains the user chose in the Sidebar arrive on the Composer's
// first open without requiring a second edit. Never overwrites a live
// Composer configuration. Reads the DOM inputs (not legacy temporaryConfig).
function syncSidebarConfigToComposerIfEmpty() {
  var hasPeriod = Boolean(state.config.period.startDate && state.config.period.endDate);
  if (hasPeriod) return;

  var startInput = document.getElementById('reportStartDate');
  var endInput = document.getElementById('reportEndDate');
  if (startInput && endInput && startInput.value && endInput.value) {
    setPeriod(startInput.value, endInput.value);
  }

  ['projects', 'tasks', 'notes'].forEach(function (domain) {
    var cb = document.getElementById('report' + domain.charAt(0).toUpperCase() + domain.slice(1));
    if (cb) {
      setDomain(domain, cb.checked);
    }
  });
}

function composerActivate() {
  // Seed Composer config from Sidebar on first open (empty period only).
  syncSidebarConfigToComposerIfEmpty();
  const container = getComposerContainer();
  container.hidden = false;
  // Suspend the Journal/editor/sidebar presentation (splitters included) so
  // they are neither visible nor interactive while the Composer is active.
  // Restored on deactivate (Back). Mirrors html.workspace-index-active.
  document.documentElement.classList.add('report-composer-active');
  renderComposerView(container);
  return Object.freeze({ activated: true });
}

function composerDeactivate() {
  const container = getComposerContainer();
  if (container) {
    container.hidden = true;
    document.documentElement.classList.remove('report-composer-active');
  }
  return Object.freeze({ status: 'deactivated' });
}

function composerRefresh() {
  const container = getComposerContainer();
  if (container && !container.hidden) {
    renderComposerView(container);
  }
  return Object.freeze({ status: 'refreshed' });
}

function composerDetach() {
  return Object.freeze({ status: 'detached' });
}

function composerGetState() {
  return getState();
}

function composerRestoreState(savedState) {
  if (!savedState) return;
  // Session state is authoritative. Seed config from a Host restore snapshot
  // only on first entry (no period set yet); never overwrite a live Composer
  // configuration with a stale Host restore snapshot, Quick Report
  // temporaryConfig, or a rerender. Selection and workflow still resume.
  if (savedState.config && (!state.config.period.startDate && !state.config.period.endDate)) {
    state = Object.freeze(Object.assign({}, state, {
      config: Object.assign({}, state.config, savedState.config)
    }));
  }
  if (savedState.selection) {
    state = Object.freeze(Object.assign({}, state, {
      selection: Object.assign({}, state.selection, savedState.selection)
    }));
  }
  if (savedState.workflow) {
    state = Object.freeze(Object.assign({}, state, {
      workflow: Object.assign({}, state.workflow, savedState.workflow)
    }));
  }
}

let composerRegistered = false;

function registerComposerWithHost() {
  if (composerRegistered) return;
  const host = getComposerHost();
  if (!host) return;
  try {
    host.register(Object.freeze({
      id: 'report-composer',
      title: 'Report Composer',
      activate: composerActivate,
      deactivate: composerDeactivate,
      refresh: composerRefresh,
      detach: composerDetach,
      getState: composerGetState,
      restoreState: composerRestoreState,
    }));
    composerRegistered = true;
  } catch (e) {}
}

if (typeof globalThis !== 'undefined' && typeof globalThis.MME_WORKSPACE_HOST === 'object') {
  registerComposerWithHost();
} else if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  if (typeof globalThis !== 'undefined' && globalThis.MME_MAIN_READY === true) {
    registerComposerWithHost();
  } else {
    window.addEventListener('mme-main-ready', registerComposerWithHost, { once: true });
  }
}

// =========================================================================
// Publish Composer API via established global pattern
// =========================================================================

const composerAPI = Object.freeze({
  open,
  returnToWorkspace,
  returnToComposer,
  render,
  refresh,
  reset,
  getState,
  setPeriod,
  setDomain,
  setSectionPeriod,
  setSectionInitialView,
  setRecordSelected,
  selectEligible,
  clearSelection,
  buildSelection,
  generateReport,
  recomputeProjection
});

if (typeof globalThis !== 'undefined') {
  globalThis.MME_REPORT_COMPOSER = composerAPI;
}
if (typeof window !== 'undefined') {
  window.MME_REPORT_COMPOSER = composerAPI;
}

})();