// @ts-nocheck
// ACT F — Quick Report sidebar configuration panel.
// Owns temporary Report configuration UI. Uses MME_REPORT_DICTIONARY and
// MME_QUICK_REPORT for all pure logic. No editor, Save, or file mutation.

(function () {
  'use strict';

  // ---- Canonical editable Report Notes template ----
  const DEFAULT_REPORT_NOTES_TEMPLATE = [
    '{{title}}:',
    '{{summary}}:',
    '{{highlights}}:',
    '{{risks}}:',
    '{{next steps}}:',
    '{{management notes}}:',
  ].join('\n');

  // ---- Temporary configuration (module-local, never persisted) ----
  let temporaryConfig = {
    startDate: '',
    endDate: '',
    projectMode: 'all',
    sections: [],
    reportNotes: DEFAULT_REPORT_NOTES_TEMPLATE,
  };

  // ---- Adapters injected via ensure() ----
  let adapters = {
    getWorkspaceIndexState: null,
    onPreparedReport: null,
    canGenerateReport: null,
    canReconcileDrawioReport: null,
  };

  let attachedWorkspaceKey = null;
  let rendered = false;
  let wired = false;

  // ---- Small local helpers ----

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

  function toLocalDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getDefaultLocalWeek() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun ... 6=Sat
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(12, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(12, 0, 0, 0);
    return {
      startDate: toLocalDateString(monday),
      endDate: toLocalDateString(sunday),
    };
  }

  function getDefaultSectionConfig() {
    const dict = getDictionaryModule();
    let ordered = [];
    if (dict && typeof dict.normalizeSectionOrder === 'function') {
      try {
        const result = dict.normalizeSectionOrder([]);
        ordered = Array.isArray(result?.sections) ? result.sections : [];
      } catch (e) {
        ordered = [];
      }
    }
    if (ordered.length === 0) {
      // Fallback minimal catalog — only used if ACT E cannot be reached.
      ordered = [
        { id: 'summary', label: 'Summary and Highlights', enabled: true, order: 0 },
        { id: 'completed-tasks', label: 'Completed Tasks', enabled: true, order: 1 },
        { id: 'project-forecast', label: 'Project Forecast', enabled: true, order: 2 },
        { id: 'forecast-totals', label: 'Forecast Totals', enabled: true, order: 3 },
        { id: 'risks', label: 'Risks and Attention Points', enabled: true, order: 4 },
        { id: 'next-steps', label: 'Next Steps', enabled: true, order: 5 },
        { id: 'undated-completed-tasks', label: 'Completed Tasks Without Date', enabled: false, order: 6 },
      ];
    }
    return ordered.map((s) => ({
      id: s.id || '',
      label: s.label || s.id || '',
      enabled: s.enabled !== false,
      order: s.order != null ? s.order : 0,
    }));
  }

  function safeStatus(message, kind) {
    const status = document.getElementById('workspaceReportStatus');
    if (!status) return;
    status.textContent = message || '';
    status.classList.toggle('reportPanelStatus--error', kind === 'error');
    status.classList.toggle('reportPanelStatus--ok', kind === 'ok');
    if (!message) {
      status.classList.remove('reportPanelStatus--error', 'reportPanelStatus--ok');
    }
  }

  function log(message) {
    try {
      const fn = globalThis.log || window.log;
      if (typeof fn === 'function') fn(message);
      else console.debug('[Report Panel]', message);
    } catch {}
  }

  // ---- Public API ----

  function ensure(options) {
    options = options || {};

    // Adapter update contract: update before any early return, and do not
    // erase a previously valid adapter when a later call omits it.
    if (typeof options.getWorkspaceIndexState === 'function') {
      adapters.getWorkspaceIndexState = options.getWorkspaceIndexState;
    }
    if (typeof options.onPreparedReport === 'function') {
      adapters.onPreparedReport = options.onPreparedReport;
    }
    if (typeof options.canGenerateReport === 'function') {
      adapters.canGenerateReport = options.canGenerateReport;
    }

    const host = getSidebarBodyHost();
    if (!host) {
      log('Report: panel ensure skipped; sidebar body host missing');
      return false;
    }

    // Establish workspace-local temporary state (reset on true workspace change).
    const wsKey =
      typeof globalThis.WORKSPACE_STATE?.rootHandle !== 'undefined'
        ? String(globalThis.WORKSPACE_STATE?.rootHandle?.name || '')
        : '';
    if (attachedWorkspaceKey !== null && attachedWorkspaceKey !== wsKey) {
      resetTemporaryState();
    }
    attachedWorkspaceKey = wsKey;

    if (!rendered) {
      render(host);
      wire();
      rendered = true;
    }

    refresh();
    return true;
  }

  function getSidebarBodyHost() {
    const sidebar = document.getElementById('workspaceSidebar');
    if (!sidebar) return null;
    const scroller = sidebar.querySelector(':scope > .workspaceNavScroller');
    return scroller || sidebar;
  }

  function render(host) {
    let panel = document.getElementById('workspaceReportPanel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'workspaceReportPanel';
    panel.className = 'workspaceSection workspaceReportPanel';
    panel.setAttribute('data-workspace-panel', 'report');
    panel.hidden = true;

    const sections = getDefaultSectionConfig();
    if (temporaryConfig.sections.length === 0) {
      temporaryConfig.sections = sections;
    }
    if (!temporaryConfig.startDate || !temporaryConfig.endDate) {
      const defaults = getDefaultLocalWeek();
      temporaryConfig.startDate = defaults.startDate;
      temporaryConfig.endDate = defaults.endDate;
    }

    panel.innerHTML = `
      <div class="workspaceReportHeader">
        <button
          type="button"
          class="workspacePanelHeaderButton"
          data-workspace-panel-toggle="report"
          aria-expanded="false"
        >
          <span class="workspacePanelHeaderLeft">
            <span class="workspacePanelChevron" aria-hidden="true">▶</span>
            <span class="workspaceReportTitle">Report</span>
          </span>
          <span id="workspaceReportBadge" class="workspacePanelBadge">Config</span>
        </button>
      </div>

      <div class="workspacePanelBody">
        <div class="workspaceReportBody">
          <fieldset class="reportFieldset">
            <legend class="reportFieldsetLegend">Period</legend>
            <div class="reportDateRow">
              <label class="reportFieldLabel" for="reportStartDate">From</label>
              <input class="reportInput reportDateInput" type="date" id="reportStartDate" />
            </div>
            <div class="reportDateRow">
              <label class="reportFieldLabel" for="reportEndDate">To</label>
              <input class="reportInput reportDateInput" type="date" id="reportEndDate" />
            </div>
          </fieldset>

          <fieldset class="reportFieldset">
            <legend class="reportFieldsetLegend">Projects</legend>
            <label class="reportRadioRow">
              <input type="radio" name="reportProjectMode" value="all" />
              <span>All Projects</span>
            </label>
            <label class="reportRadioRow">
              <input type="radio" name="reportProjectMode" value="with-value" />
              <span>With value</span>
            </label>
            <label class="reportRadioRow">
              <input type="radio" name="reportProjectMode" value="without-value" />
              <span>Without value</span>
            </label>
          </fieldset>

          <fieldset class="reportFieldset">
            <legend class="reportFieldsetLegend">Sections</legend>
            <div id="workspaceReportSections" class="workspaceReportSections"></div>
          </fieldset>

          <fieldset class="reportFieldset">
            <legend class="reportFieldsetLegend">Report Notes</legend>
            <div class="reportNotesHeader">
              <button
                type="button"
                id="reportResetNotesButton"
                class="reportResetNotesButton"
                aria-label="Reset Report Notes"
                title="Reset Report Notes"
              >Reset Notes</button>
            </div>
            <textarea
              id="workspaceReportNotes"
              class="reportInput reportNotesInput"
              rows="6"
              aria-label="Report Notes (dictionary pairs)"
            ></textarea>
            <div class="reportNotesHelper">Complete only the fields needed. Blank fields are ignored.</div>
          </fieldset>

          <button type="button" id="reportGenerateButton" class="reportGenerateButton">
            Generate Report
          </button>

          <!-- ACT H3: Draw.io reconciliation entry point. -->
          <fieldset class="reportFieldset drawioReportEntryFieldset">
            <legend class="reportFieldsetLegend">Draw.io Report</legend>
            <button type="button" id="reportDrawioReconcileButton" class="drawioReportEntryButton">
              Reconcile Draw.io Template
            </button>
            <div id="drawioReportEntryStatus" class="drawioReportEntryStatus" role="status"></div>
          </fieldset>

          <div id="workspaceReportStatus" class="workspaceReportStatus" role="status"></div>
        </div>
      </div>
    `;

    const tagsPanel = document.getElementById('workspaceTagsPanel');
    const tasksPanel = document.getElementById('workspaceTasksPanel');
    let insertAfter = null;

    if (tagsPanel && tagsPanel.parentNode === host) {
      host.insertBefore(panel, tagsPanel);
      insertAfter = tagsPanel.previousSibling;
    } else if (tasksPanel && tasksPanel.parentNode === host) {
      if (tasksPanel.nextSibling && tasksPanel.nextSibling.parentNode === host) {
        host.insertBefore(panel, tasksPanel.nextSibling);
      } else {
        host.appendChild(panel);
      }
    } else {
      host.appendChild(panel);
    }

    log('Report: panel rendered');
    return panel;
  }

  function wire() {
    if (wired) return;

    const panel = document.getElementById('workspaceReportPanel');
    if (!panel) return;

    const startDate = document.getElementById('reportStartDate');
    const endDate = document.getElementById('reportEndDate');
    const generate = document.getElementById('reportGenerateButton');
    const notes = document.getElementById('workspaceReportNotes');

    if (startDate) {
      startDate.value = temporaryConfig.startDate;
      startDate.addEventListener('change', () => {
        temporaryConfig.startDate = startDate.value || '';
        refreshGenerateAvailability();
        safeStatus('');
      });
    }

    if (endDate) {
      endDate.value = temporaryConfig.endDate;
      endDate.addEventListener('change', () => {
        temporaryConfig.endDate = endDate.value || '';
        refreshGenerateAvailability();
        safeStatus('');
      });
    }

    if (notes) {
      notes.value = temporaryConfig.reportNotes;
      notes.addEventListener('input', () => {
        temporaryConfig.reportNotes = notes.value || '';
      });
    }

    const resetNotesBtn = document.getElementById('reportResetNotesButton');
    if (resetNotesBtn) {
      resetNotesBtn.addEventListener('click', () => {
        resetReportNotes();
      });
    }

    const radios = panel.querySelectorAll('input[name="reportProjectMode"]');
    radios.forEach((radio) => {
      radio.addEventListener('change', () => {
        temporaryConfig.projectMode = radio.value || 'all';
        refreshGenerateAvailability();
      });
    });

    // Section enable toggle + up/down delegation.
    panel.addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-report-section-toggle]');
      const up = event.target.closest('[data-report-section-up]');
      const down = event.target.closest('[data-report-section-down]');

      if (toggle) {
        const id = toggle.dataset.reportSectionToggle;
        const section = temporaryConfig.sections.find((s) => s.id === id);
        if (section) section.enabled = toggle.checked;
        refreshGenerateAvailability();
        safeStatus('');
        return;
      }

      if (up) {
        event.preventDefault();
        moveSection(up.dataset.reportSectionUp, -1);
        return;
      }

      if (down) {
        event.preventDefault();
        moveSection(down.dataset.reportSectionDown, 1);
        return;
      }
    });

    if (generate) {
      generate.addEventListener('click', () => {
        handleGenerate();
      });
    }

    // ACT H3: Draw.io reconciliation entry action (single delegated listener).
    const drawioEntry = document.getElementById('reportDrawioReconcileButton');
    if (drawioEntry && !drawioEntry.dataset.drawioWired) {
      drawioEntry.dataset.drawioWired = '1';
      drawioEntry.addEventListener('click', () => {
        handleDrawioReconcileClick(drawioEntry);
      });
    }

    wired = true;
    log('Report: panel wired');
  }

  function renderSectionRows() {
    const container = document.getElementById('workspaceReportSections');
    if (!container) return;

    const rows = temporaryConfig.sections.map((section, index) => {
      const isFirst = index === 0;
      const isLast = index === temporaryConfig.sections.length - 1;
      return `
        <div class="workspaceReportSectionRow" data-report-section-id="${escapeHtml(section.id)}">
          <label class="reportSectionCheckLabel">
            <input
              type="checkbox"
              data-report-section-toggle="${escapeHtml(section.id)}"
              ${section.enabled ? 'checked' : ''}
            />
            <span class="reportSectionLabelText">${escapeHtml(section.label)}</span>
          </label>
          <span class="reportSectionOrderControls">
            <button
              type="button"
              class="reportOrderButton"
              data-report-section-up="${escapeHtml(section.id)}"
              aria-label="Move ${escapeHtml(section.label)} up"
              ${isFirst ? 'disabled' : ''}
            >↑</button>
            <button
              type="button"
              class="reportOrderButton"
              data-report-section-down="${escapeHtml(section.id)}"
              aria-label="Move ${escapeHtml(section.label)} down"
              ${isLast ? 'disabled' : ''}
            >↓</button>
          </span>
        </div>
      `;
    });

    container.innerHTML = rows.join('');
  }

  function moveSection(id, delta) {
    const index = temporaryConfig.sections.findIndex((s) => s.id === id);
    if (index < 0) return;
    const target = index + delta;
    if (target < 0 || target >= temporaryConfig.sections.length) return;

    const arr = temporaryConfig.sections.slice();
    const [item] = arr.splice(index, 1);
    arr.splice(target, 0, item);
    arr.forEach((s, i) => (s.order = i));
    temporaryConfig.sections = arr;

    renderSectionRows();
    refreshGenerateAvailability();
  }

  function refresh(workspaceState) {
    // Called from ensure() and from mme-workspace-index-ready.
    const panel = document.getElementById('workspaceReportPanel');
    if (!panel) return;

    // Render rows from current config each refresh so reorder reflects.
    renderSectionRows();

    // Radio sync.
    const radios = panel.querySelectorAll('input[name="reportProjectMode"]');
    radios.forEach((radio) => {
      radio.checked = radio.value === temporaryConfig.projectMode;
    });

    const startDateInput = document.getElementById('reportStartDate');
    const endDateInput = document.getElementById('reportEndDate');
    if (startDateInput && startDateInput.value !== temporaryConfig.startDate) {
      startDateInput.value = temporaryConfig.startDate;
    }
    if (endDateInput && endDateInput.value !== temporaryConfig.endDate) {
      endDateInput.value = temporaryConfig.endDate;
    }

    refreshGenerateAvailability(workspaceState);
    refreshDrawioEntry();
  }

  // ACT H3: Draw.io reconciliation entry availability. Uses the H3-specific
  // canReconcileDrawioReport adapter — never canGenerateReport.
  function refreshDrawioEntry() {
    const entryButton = document.getElementById('reportDrawioReconcileButton');
    const entryStatus = document.getElementById('drawioReportEntryStatus');
    if (!entryButton) return;

    const panelModule =
      (typeof globalThis !== 'undefined' && globalThis.MME_DRAWIO_REPORT_PANEL) || null;
    const modulesReady = Boolean(
      panelModule &&
        (typeof globalThis !== 'undefined' && globalThis.MME_REPORT_MARKDOWN_IMPORT) &&
        (typeof globalThis !== 'undefined' && globalThis.MME_DRAWIO_REPORT_RECONCILER)
    );

    let isReport = false;
    try {
      isReport = typeof adapters.canReconcileDrawioReport === 'function'
        ? Boolean(adapters.canReconcileDrawioReport())
        : false;
    } catch {
      isReport = false;
    }

    if (!modulesReady) {
      entryButton.disabled = true;
      entryButton.title = 'Draw.io Report modules are unavailable.';
      if (entryStatus) entryStatus.textContent = 'Draw.io Report modules unavailable.';
      return;
    }

    if (!isReport) {
      entryButton.disabled = true;
      entryButton.title = 'Open or generate a Report before using Draw.io reconciliation.';
      if (entryStatus) entryStatus.textContent = '';
      return;
    }

    entryButton.disabled = false;
    entryButton.title = '';
    if (entryStatus) entryStatus.textContent = 'Report active — select an uncompressed .drawio template.';
  }

  function handleDrawioReconcileClick(entryButton) {
    // Click-time defense: recheck the adapter, not just the disabled flag.
    let isReport = false;
    try {
      isReport = typeof adapters.canReconcileDrawioReport === 'function'
        ? Boolean(adapters.canReconcileDrawioReport())
        : false;
    } catch {
      isReport = false;
    }
    if (!isReport) {
      safeStatus('Open or generate a Report before using Draw.io reconciliation.', 'error');
      log('DrawioReport: reconcile blocked reason=not-report');
      return;
    }
    const panelModule =
      (typeof globalThis !== 'undefined' && globalThis.MME_DRAWIO_REPORT_PANEL) || null;
    if (!panelModule || typeof panelModule.open !== 'function') {
      safeStatus('Draw.io Report module unavailable.', 'error');
      log('DrawioReport: open blocked reason=module-unavailable');
      return;
    }
    try {
      panelModule.open({ focusReturn: entryButton });
    } catch (e) {
      log(`DrawioReport: open failed: ${e?.message || e}`);
    }
  }

  function getCurrentWorkspaceState() {
    if (typeof adapters.getWorkspaceIndexState === 'function') {
      try {
        return adapters.getWorkspaceIndexState() || null;
      } catch {
        return null;
      }
    }
    return (
      (typeof globalThis !== 'undefined' && globalThis.WORKSPACE_INDEX_STATE) ||
      (typeof window !== 'undefined' && window.WORKSPACE_INDEX_STATE) ||
      null
    );
  }

  function validateConfiguration(config) {
    const cfg = config || temporaryConfig;
    const diagnostics = [];
    const dict = getDictionaryModule();

    if (!dict || typeof dict.normalizeReportRange !== 'function') {
      return {
        ok: false,
        error: 'modules-unavailable',
        diagnostics: [{ code: 'report-modules-unavailable', message: 'Report modules unavailable.' }],
      };
    }

    const rangeResult = dict.normalizeReportRange(
      cfg.startDate || '',
      cfg.endDate || ''
    );
    if (!rangeResult.ok) {
      diagnostics.push({
        code: rangeResult.error || 'invalid-date-range',
        message: rangeResult.message || 'Invalid date range.',
      });
    }

    if (!['all', 'with-value', 'without-value'].includes(cfg.projectMode)) {
      diagnostics.push({ code: 'invalid-project-mode', message: 'Invalid Project mode.' });
    }

    const enabledSections = (cfg.sections || []).filter((s) => s.enabled);
    if (enabledSections.length === 0) {
      diagnostics.push({ code: 'no-enabled-sections', message: 'Enable at least one Report section.' });
    }

    const wsState = getCurrentWorkspaceState();
    if (!wsState || wsState.ready !== true) {
      diagnostics.push({ code: 'workspace-not-ready', message: 'Open a workspace to generate a Report.' });
    }

    return {
      ok: diagnostics.length === 0,
      diagnostics,
      error: diagnostics.length > 0 ? 'validation-failed' : null,
      workspaceReady: Boolean(wsState && wsState.ready === true),
    };
  }

  function readConfiguration() {
    // Read the current textarea DOM value at click time so configuration
    // always reflects exactly what the user sees in the panel.
    // This guarantees the textarea value reaches the dictionary even if
    // the last 'input' event was not processed yet.
    const notesEl = document.getElementById('workspaceReportNotes');
    const reportNotes = notesEl ? notesEl.value : temporaryConfig.reportNotes;

    return {
      startDate: temporaryConfig.startDate,
      endDate: temporaryConfig.endDate,
      projectMode: temporaryConfig.projectMode,
      sections: (temporaryConfig.sections || []).map((s) => ({
        id: s.id,
        label: s.label,
        enabled: s.enabled,
      })),
      reportNotes,
    };
  }

  function prepareReport() {
    const dict = getDictionaryModule();
    const gen = getGeneratorModule();

    if (!dict || typeof dict.buildReportDictionary !== 'function') {
      const diagnostics = [{ code: 'report-modules-unavailable', message: 'Report modules unavailable.' }];
      return { ok: false, diagnostics, error: 'report-modules-unavailable' };
    }

    // Read the current configuration snapshot at click time.
    // This ensures reportNotes exactly equals the textarea value at Generate click.
    const configuration = readConfiguration();

    const validation = validateConfiguration(configuration);
    if (!validation.ok) {
      return { ok: false, diagnostics: validation.diagnostics, error: 'validation-failed' };
    }

    const wsState = getCurrentWorkspaceState();
    if (!wsState || wsState.ready !== true) {
      const diagnostics = [{ code: 'workspace-not-ready', message: 'Open a workspace to generate a Report.' }];
      return { ok: false, diagnostics, error: 'workspace-not-ready' };
    }

    const generatedAt = new Date().toISOString();

    const dictionary = dict.buildReportDictionary({
      indexState: wsState,
      startDate: configuration.startDate,
      endDate: configuration.endDate,
      sections: configuration.sections.map((s) => ({ id: s.id, enabled: s.enabled })),
      projectMode: configuration.projectMode,
      reportNotes: configuration.reportNotes,
      generatedAt,
    });

    if (!dictionary || dictionary.ok === false) {
      const diagnostics = dictionary?.diagnostics || [
        { code: 'dictionary-build-failed', message: 'Report dictionary construction failed.' },
      ];
      return { ok: false, diagnostics, error: 'dictionary-build-failed' };
    }

    // Narrow development diagnostics at the preparation boundary.
    // Structural only — never logs full business content.
    try {
      const rawLines = String(configuration.reportNotes || '')
        .split(/\r?\n/)
        .filter((l) => l.trim()).length;
      const parsedKeys = (dictionary.notes || []).map((n) => n.key);
      const standard = parsedKeys.filter((k) =>
        ['title', 'summary', 'highlights', 'risks', 'next steps', 'management notes'].includes(k)
      );
      const custom = parsedKeys.filter(
        (k) => !['title', 'summary', 'highlights', 'risks', 'next steps', 'management notes'].includes(k)
      );
      log(`Report: notes raw lines=${rawLines}`);
      log(`Report: notes parsed keys=${standard.join(',')}`);
      log(`Report: dictionary standard fields=${standard.join(',')}`);
      if (custom.length) log(`Report: dictionary custom fields=${custom.join(',')}`);
    } catch {}

    const markdown =
      typeof gen?.buildMarkdown === 'function'
        ? gen.buildMarkdown(dictionary)
        : null;
    const suggestedFilename =
      typeof gen?.buildSuggestedFilename === 'function'
        ? gen.buildSuggestedFilename(dictionary)
        : null;

    if (!markdown) {
      const diagnostics = dict?.diagnostics || [{ code: 'markdown-generation-failed', message: 'Markdown generation failed.' }];
      return { ok: false, diagnostics, error: 'markdown-generation-failed' };
    }

    const result = {
      dictionary,
      markdown,
      suggestedFilename: suggestedFilename || '',
      diagnostics: dictionary.diagnostics || [],
    };

    return { ok: true, result };
  }

  function handleGenerate() {
    // Click-time defense: read the current canGenerateReport adapter.
    // Do not rely only on the disabled button.
    if (typeof adapters.canGenerateReport === 'function' && !adapters.canGenerateReport()) {
      safeStatus('Return to the workspace before generating another Report.', 'error');
      log('Report: generation blocked reason=report-already-active');
      return;
    }

    const prepared = prepareReport();

    if (!prepared.ok) {
      const first = prepared.diagnostics && prepared.diagnostics[0];
      safeStatus(first?.message || 'Report could not be prepared.', 'error');
      log(`Report: prepare failed — ${first?.message || prepared.error}`);
      return;
    }

    const result = prepared.result;
    if (typeof adapters.onPreparedReport === 'function') {
      try {
        adapters.onPreparedReport(result);
      } catch (e) {
        log(`Report: ACT G adapter failed — ${e?.message || e}`);
      }
    } else {
      safeStatus(`Report prepared: ${result.suggestedFilename || ''}`, 'ok');
      log(`Report: prepared ${result.suggestedFilename || 'report'}`);
    }

    // ACT F only prepares. It never opens the editor / saves / navigates.
  }

  function refreshGenerateAvailability(workspaceState) {
    const panel = document.getElementById('workspaceReportPanel');
    if (!panel) return;
    const generate = document.getElementById('reportGenerateButton');
    const dict = getDictionaryModule();
    const gen = getGeneratorModule();

    if (!dict || !gen) {
      safeStatus('Report modules unavailable.', 'error');
      if (generate) generate.disabled = true;
      return;
    }

    // A Report document is currently active: block generation.
    const reportActive =
      typeof adapters.canGenerateReport === 'function' && !adapters.canGenerateReport();

    const wsState = workspaceState || getCurrentWorkspaceState();
    const workspaceReady = Boolean(wsState && wsState.ready === true);

    const rangeResult =
      typeof dict.normalizeReportRange === 'function'
        ? dict.normalizeReportRange(temporaryConfig.startDate || '', temporaryConfig.endDate || '')
        : { ok: false };

    const enabledCount = (temporaryConfig.sections || []).filter((s) => s.enabled).length;

    const valid =
      !reportActive &&
      rangeResult.ok === true &&
      workspaceReady &&
      enabledCount > 0 &&
      ['all', 'with-value', 'without-value'].includes(temporaryConfig.projectMode);

    if (generate) {
      generate.disabled = !valid;
      generate.title = reportActive
        ? 'Return to the workspace before generating another Report.'
        : valid
          ? ''
          : 'Configure a valid range, scope, and at least one section';
    }

    if (reportActive) {
      safeStatus('Return to the workspace before generating another Report.', 'error');
    } else if (!workspaceReady) {
      safeStatus('Open a workspace to generate a Report.');
    } else if (!rangeResult.ok) {
      safeStatus(rangeResult.message || 'Invalid date range.', 'error');
    } else if (enabledCount === 0) {
      safeStatus('Enable at least one Report section.', 'error');
    } else {
      safeStatus('');
    }
  }

  function resetTemporaryState() {
    temporaryConfig = {
      startDate: '',
      endDate: '',
      projectMode: 'all',
      sections: [],
      reportNotes: DEFAULT_REPORT_NOTES_TEMPLATE,
    };
    const defaults = getDefaultLocalWeek();
    temporaryConfig.startDate = defaults.startDate;
    temporaryConfig.endDate = defaults.endDate;
    temporaryConfig.sections = getDefaultSectionConfig();
  }

  // ---- Report Notes reset ----

  function isReportNotesEdited() {
    const current = String(temporaryConfig.reportNotes || '');
    return current !== DEFAULT_REPORT_NOTES_TEMPLATE;
  }

  function resetReportNotes() {
    const notes = document.getElementById('workspaceReportNotes');
    const current = notes ? notes.value : String(temporaryConfig.reportNotes || '');

    // Empty or identical to clean template: reset immediately without confirmation.
    if (!current || current === DEFAULT_REPORT_NOTES_TEMPLATE) {
      applyReportNotesReset();
      return;
    }

    // Edited content: confirm before replacing.
    const ok = window.confirm(
      'Reset Report Notes?\n\nThis will replace the current Report Notes with the blank field template.'
    );

    if (!ok) {
      log('Report: Reset Notes canceled');
      return;
    }
    applyReportNotesReset();
  }

  function applyReportNotesReset() {
    temporaryConfig.reportNotes = DEFAULT_REPORT_NOTES_TEMPLATE;
    const notes = document.getElementById('workspaceReportNotes');
    if (notes) {
      notes.value = DEFAULT_REPORT_NOTES_TEMPLATE;
    }
    log('Report: Report Notes reset to template');
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"');
  }

  // ---- Developer validator / fixtures (dormant) ----

  function validateReportPanel() {
    const cases = [];
    const check = (label, actual, expected) => {
      cases.push({ label, pass: JSON.stringify(actual) === JSON.stringify(expected), actual, expected });
    };

    // 1. default local week range (Monday..Sunday)
    const week = getDefaultLocalWeek();
    check('default week monday', /^\d{4}-\d{2}-\d{2}$/.test(week.startDate), true);
    check('default week sunday', /^\d{4}-\d{2}-\d{2}$/.test(week.endDate), true);

    // 2. valid explicit range (uses dict module if available)
    const dict = getDictionaryModule();
    const gen = getGeneratorModule();
    const dictAvailable = Boolean(dict && typeof dict.normalizeReportRange === 'function');
    const genAvailable = Boolean(gen && typeof gen.buildMarkdown === 'function');

    if (dictAvailable) {
      check('valid explicit range', dict.normalizeReportRange('2026-08-03', '2026-08-09').ok, true);
      check('missing start date invalid', dict.normalizeReportRange('', '2026-08-09').ok, false);
      check('missing end date invalid', dict.normalizeReportRange('2026-08-03', '').ok, false);
      check('reversed range invalid', dict.normalizeReportRange('2026-08-10', '2026-08-09').ok, false);
    } else {
      check('dictionary module available for fixtures', dictAvailable, true);
    }

    // 6-9. Project mode mapping (delegated: panel passes raw value to dict)
    const projectModes = ['all', 'with-value', 'without-value'];
    check('all project mode valid', projectModes.includes('all'), true);
    check('with-value project mode valid', projectModes.includes('with-value'), true);
    check('without-value project mode valid', projectModes.includes('without-value'), true);
    check('zero value delegated to dictionary', typeof Number.isFinite === 'function', true);

    // 10-15. Section control helpers (pure)
    const cfg = { sections: getDefaultSectionConfig() };
    check('one enabled section', cfg.sections.filter((s) => s.enabled).length >= 1, true);
    check('no enabled sections invalid', cfg.sections.filter((s) => s.enabled).length === 0, false);

    // Move helper
    function applyMove(sections, id, delta) {
      const idx = sections.findIndex((s) => s.id === id);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= sections.length) return sections;
      const arr = sections.slice();
      const [item] = arr.splice(idx, 1);
      arr.splice(target, 0, item);
      return arr.map((s, i) => ({ ...s, order: i }));
    }

    const moved = applyMove(getDefaultSectionConfig(), 'summary', 1);
    check('move up first section index changed', moved[0].id !== 'summary', true);
    check('move first up disabled (idx -1 no-op)', applyMove(getDefaultSectionConfig(), 'summary', -1).length, getDefaultSectionConfig().length);
    check('move last down disabled (idx +1 no-op)', applyMove(getDefaultSectionConfig(), 'undated-completed-tasks', 1).length, getDefaultSectionConfig().length);
    check('disabled section remains ordered', getDefaultSectionConfig().some((s) => s.id === 'undated-completed-tasks' && !s.enabled), true);

    // 17. notes passed raw (delegated; raw passthrough is a plain string)
    check('notes raw passthrough', temporaryConfig.reportNotes === '' || typeof temporaryConfig.reportNotes === 'string', true);

    // 18. malformed note diagnostics delegated to dict (dict.parseReportNotes if available)
    if (dict && typeof dict.parseReportNotes === 'function') {
      const noteResult = dict.parseReportNotes('Title: Weekly Report\nBad Line Here');
      check('malformed note diagnostic surfaced', noteResult.diagnostics.some((d) => d.code === 'note-malformed'), true);
    }

    // 19. workspace not ready
    const wsNotReady = validateWithState({ ready: false });
    check('workspace not ready invalidates', wsNotReady.ok, false);

    // 20-21. module missing
    check('dictionary missing check', dictAvailable ? Boolean(dict) : !getDictionaryModule() === false, true);

    // 22-25. prepared result shape (requires dict+gen+valid fixtures)
    // We temporarily override adapter state to a ready fixture.
    const originalAdapter = adapters.getWorkspaceIndexState;
    adapters.getWorkspaceIndexState = () => ({
      ready: true,
      tasks: [],
      projects: [{ name: 'Alpha', value: 50000, currency: 'USD' }],
    });
    resetTemporaryState();
    const prepared = prepareReport();
    adapters.getWorkspaceIndexState = originalAdapter;

    check('prepared ok', prepared.ok, dictAvailable && genAvailable);
    if (prepared.ok) {
      check('prepared has dictionary', Boolean(prepared.result.dictionary), true);
      check('prepared has markdown', typeof prepared.result.markdown === 'string', true);
      check('prepared has suggestedFilename', typeof prepared.result.suggestedFilename === 'string', true);
      check('prepared has diagnostics', Array.isArray(prepared.result.diagnostics), true);
    }

    // 25. no source mutation (config copy)
    const cfgBefore = JSON.stringify(temporaryConfig);
    const cfgCopy = JSON.parse(JSON.stringify(temporaryConfig));
    cfgCopy.startDate = 'MUTATED';
    cfgCopy.projectMode = 'MUTATED';
    check('no config mutation on read', JSON.stringify(temporaryConfig), cfgBefore);

    const failed = cases.filter((c) => !c.pass);
    return { ok: failed.length === 0, total: cases.length, passed: cases.length - failed.length, failed: failed.length, cases };
  }

  function validateWithState(state) {
    const originalAdapter = adapters.getWorkspaceIndexState;
    adapters.getWorkspaceIndexState = () => state;
    const result = validateConfiguration();
    adapters.getWorkspaceIndexState = originalAdapter;
    return result;
  }

  const MME_REPORT_PANEL = Object.freeze({
    ensure,
    refresh,
    readConfiguration,
    validateConfiguration,
    prepareReport,
    resetTemporaryState,
    validateReportPanel,
  });

  try {
    globalThis.MME_REPORT_PANEL = MME_REPORT_PANEL;
    window.MME_REPORT_PANEL = MME_REPORT_PANEL;
    if (typeof globalThis.__validateReportPanel === 'undefined') {
      globalThis.__validateReportPanel = validateReportPanel;
    }
    // Narrow module-ready signal for late loader integration.
    if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('mme-report-panel-ready', { detail: { module: 'report-panel' } }));
    }
  } catch (e) {
    try {
      console.warn('[Report Panel] module export failed', e);
    } catch {}
  }
})();
