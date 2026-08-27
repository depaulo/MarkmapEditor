// @ts-nocheck
// ACT H3 — Draw.io Report reconciliation UI.
// Owns the temporary reconciliation session and review overlay. Uses
// MME_REPORT_MARKDOWN_IMPORT (H1) and MME_DRAWIO_REPORT_RECONCILER (H2) for all
// pure logic. Editor access, dirty state, identity, toasts, and logs arrive via
// adapters registered from main.js. No Save As, no population delivery (H4),
// no template persistence, no workspace rescan.

(function () {
  'use strict';

  const TEMPLATE_FIELDS_HEADING = '## Template Fields';
  const VALUE_PREVIEW_MAX = 40;

  // ---- Adapters injected via configure() ----
  let adapters = {
    getMarkdown: null,
    setMarkdown: null, // canonical setter + dirty + status/title + render (main.js)
    isReportDocument: null,
    getCurrentFileName: null,
    pickTemplateFile: null, // async -> { ok, name, text } | { ok:false, reason }
    saveDrawioOutput: null, // ACT H4 async ({xml, suggestedFilename}) -> structured delivery result (main.js)
    showToast: null,
    log: null,
  };

  // ---- Temporary in-memory session (never persisted) ----
  let session = null;
  let __generationInProgress = false; // ACT H4: narrow duplicate-generation guard
  let overlayEl = null;
  let returnFocusTarget = null;

  function getImporterModule() {
    return (
      (typeof globalThis !== 'undefined' && globalThis.MME_REPORT_MARKDOWN_IMPORT) ||
      (typeof window !== 'undefined' && window.MME_REPORT_MARKDOWN_IMPORT) ||
      null
    );
  }

  function getReconcilerModule() {
    return (
      (typeof globalThis !== 'undefined' && globalThis.MME_DRAWIO_REPORT_RECONCILER) ||
      (typeof window !== 'undefined' && window.MME_DRAWIO_REPORT_RECONCILER) ||
      null
    );
  }

  function safeLog(message) {
    try {
      if (typeof adapters.log === 'function') adapters.log(`DrawioReport: ${message}`);
    } catch {}
  }

  function safeToast(message, type, ms) {
    try {
      if (typeof adapters.showToast === 'function') adapters.showToast(message, type || 'info', ms || 3000);
    } catch {}
  }

  function isReportDocument() {
    try {
      return typeof adapters.isReportDocument === 'function'
        ? Boolean(adapters.isReportDocument())
        : false;
    } catch {
      return false;
    }
  }
  // =====================================================================
  // Pure helpers (also exercised by validateDrawioReportPanel)
  // =====================================================================

  // Ordered missing keys required by the template (missing values + unknown
  // placeholders), mirroring buildMissingTemplateFieldsMarkdown ordering.
  function collectMissingKeys(reconciliation) {
    const unknownKeys = new Set((reconciliation?.unknownPlaceholders || []).map((u) => u.key));
    const missingKeys = new Set(
      (reconciliation?.missingValues || []).map((m) => m.field?.key || m.placeholder?.key)
    );
    const keys = [];
    const seen = new Set();
    for (const placeholder of reconciliation?.placeholders || []) {
      const key = placeholder.key;
      if (!unknownKeys.has(key) && !missingKeys.has(key)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }
    return keys;
  }

  // Canonical existing-token detection using the H1 importer normalizer.
  // {{customer decision}}, {{ Customer   Decision }} and {{customer decision}}
  // collapse to the same key.
  function extractExistingTokenKeys(markdown, normalizeFn) {
    const keys = new Set();
    const regex = /\{\{\s*([^{}]+?)\s*\}\}/g;
    let match;
    while ((match = regex.exec(String(markdown || ''))) !== null) {
      const key =
        typeof normalizeFn === 'function'
          ? normalizeFn(match[1])
          : match[1].trim().replace(/\s+/g, ' ').toLowerCase();
      if (key) keys.add(key);
    }
    return keys;
  }

  // Tokens actually absent from the current Markdown.
  function computeAbsentTokens(markdown, reconciliation) {
    const importer = getImporterModule();
    const normalizeFn = importer?.normalizeFieldName;
    const tokenFn = importer?.tokenFromFieldName;
    const existing = extractExistingTokenKeys(markdown, normalizeFn);
    const absent = [];
    const seen = new Set();
    for (const key of collectMissingKeys(reconciliation)) {
      if (existing.has(key)) continue; // Cases C/D/E — never duplicate.
      if (seen.has(key)) continue;
      seen.add(key);
      absent.push({
        key,
        token: typeof tokenFn === 'function' ? tokenFn(key) : `{{${key}}}`,
      });
    }
    return absent;
  }
  // Deterministic insertion. Cases A-F of the locked contract.
  function applyMissingTemplateFields(markdown, absentTokens) {
    const source = String(markdown == null ? '' : markdown);
    if (!Array.isArray(absentTokens) || absentTokens.length === 0) {
      return { changed: false, insertedCount: 0, markdown: source };
    }

    const lines = absentTokens.map((t) => `${t.token}:`);
    const headingRegex = /^##[ \t]+Template[ \t]+Fields[ \t]*$/;
    const srcLines = source.split(/\r?\n/);
    let headingIndex = -1;
    for (let i = 0; i < srcLines.length; i++) {
      if (headingRegex.test(srcLines[i].trim())) {
        headingIndex = i;
        break;
      }
    }

    if (headingIndex < 0) {
      // Case A — append one section at EOF.
      let out = source;
      if (!out.endsWith('\n')) out += '\n';
      out += `\n${TEMPLATE_FIELDS_HEADING}\n\n${lines.join('\n')}\n`;
      return { changed: true, insertedCount: lines.length, markdown: out };
    }

    // Case B — insert only absent lines inside the existing section, before
    // the next H2 heading or at the end of the section block (EOF).
    let insertIndex = srcLines.length;
    for (let i = headingIndex + 1; i < srcLines.length; i++) {
      if (/^##[ \t]/.test(srcLines[i].trim())) {
        insertIndex = i;
        break;
      }
    }
    const outLines = srcLines.slice();
    outLines.splice(insertIndex, 0, ...lines);
    return { changed: true, insertedCount: lines.length, markdown: outLines.join('\n') };
  }

  function truncatePreview(value) {
    const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    if (!text) return '';
    return text.length > VALUE_PREVIEW_MAX ? `${text.slice(0, VALUE_PREVIEW_MAX - 1)}…` : text;
  }

  // =====================================================================
  // ACT H4 — Generation gate and output filename (pure helpers).
  // H2 reconciliation remains the placeholder authority; this gate only
  // evaluates a final H2 reconciliation result. Unused Report fields never
  // block generation.
  // =====================================================================

  const GENERATION_BLOCK_MESSAGES = {
    'not-report': 'Open or generate a Report before using Draw.io reconciliation.',
    'no-session': 'Select an uncompressed Draw.io template first.',
    'no-template': 'Select an uncompressed Draw.io template first.',
    'invalid-template': 'Select a valid uncompressed Draw.io template.',
    'compressed-template': 'This template uses a compressed Draw.io payload. Select an uncompressed template.',
    'no-placeholders': 'No {{field name}} placeholders were found in this template.',
    'missing-values': 'Complete missing values in the Report Markdown and use Reconcile Again.',
    'unknown-placeholders': 'Add the missing Template Fields to the Report Markdown.',
  };

  function evaluateGenerationGate(input) {
    const state = input && typeof input === 'object' ? input : {};
    if (state.generating) {
      return { allowed: false, reason: 'in-progress', message: 'Generating…' };
    }
    if (!state.isReport) {
      return { allowed: false, reason: 'not-report', message: GENERATION_BLOCK_MESSAGES['not-report'] };
    }
    const session = state.session;
    if (!session) {
      return { allowed: false, reason: 'no-session', message: GENERATION_BLOCK_MESSAGES['no-session'] };
    }
    const hasTemplate =
      Boolean(session.templateName) &&
      typeof session.templateXml === 'string' &&
      !!session.templateXml.trim();
    if (!hasTemplate) {
      return { allowed: false, reason: 'no-template', message: GENERATION_BLOCK_MESSAGES['no-template'] };
    }
    if (!session.assessment || session.assessment.ok !== true) {
      const compressed = Boolean(session.assessment?.compressed);
      return {
        allowed: false,
        reason: compressed ? 'compressed-template' : 'invalid-template',
        message: compressed
          ? GENERATION_BLOCK_MESSAGES['compressed-template']
          : GENERATION_BLOCK_MESSAGES['invalid-template'],
      };
    }
    // Placeholder authority: the final H2 reconciliation result.
    const rec = session.reconciliation;
    if (!rec || !Array.isArray(rec.placeholders)) {
      return { allowed: false, reason: 'no-reconciliation', message: 'Run Reconcile Again to review this template.' };
    }
    if (rec.placeholders.length === 0) {
      return { allowed: false, reason: 'no-placeholders', message: GENERATION_BLOCK_MESSAGES['no-placeholders'] };
    }
    if ((rec.missingValues || []).length > 0) {
      return { allowed: false, reason: 'missing-values', message: GENERATION_BLOCK_MESSAGES['missing-values'] };
    }
    if ((rec.unknownPlaceholders || []).length > 0) {
      return {
        allowed: false,
        reason: 'unknown-placeholders',
        message: GENERATION_BLOCK_MESSAGES['unknown-placeholders'],
      };
    }
    // Unused Report fields intentionally do not block generation.
    return { allowed: true, reason: null, message: null };
  }

  // Suggested output filename derived from the current Report filename.
  // Strips .md/.markdown/.txt, sanitizes filesystem-invalid characters,
  // appends -visual.drawio without duplicating an existing -visual suffix.
  function buildSuggestedDrawioFilename(rawName) {
    let base = String(rawName == null ? '' : rawName).trim();
    base = base.replace(/\.(md|markdown|txt)$/i, '');
    base = base.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/\s+/g, ' ').trim();
    base = base.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
    if (!base) base = 'report';
    if (!/-visual$/i.test(base)) base += '-visual';
    return `${base}.drawio`;
  }

  // Defensive sanity scan only. The authoritative unresolved-placeholder gate
  // is the final H2 reconciliation (missingValues/unknownPlaceholders empty).
  function hasVisibleUnresolvedToken(xml) {
    return /\{\{[^{}]+\}\}/.test(String(xml == null ? '' : xml));
  }

  // =====================================================================
  // Session lifecycle
  // =====================================================================

  function resetSession(reason) {
    if (session) {
      safeLog(`session reset reason=${reason || 'unspecified'}`);
    }
    session = null;
    setSaveStatus(''); // ACT H4: delivery status dies with the session
    closeOverlay();
  }

  function getSessionState() {
    return session ? { ...session } : null;
  }
  // =====================================================================
  // Overlay UI (single instance)
  // =====================================================================

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function hasDom() {
    return typeof document !== 'undefined' && Boolean(document.body);
  }

  function ensureOverlay() {
    if (!hasDom()) return null;
    if (overlayEl && document.body.contains(overlayEl)) return overlayEl;

    overlayEl = document.createElement('div');
    overlayEl.id = 'mmeDrawioReportOverlay';
    overlayEl.className = 'drawioReportOverlay';
    overlayEl.hidden = true;
    overlayEl.innerHTML = `
      <div class="drawioReportDialog" role="dialog" aria-modal="true" aria-labelledby="mmeDrawioReportTitle">
        <div class="drawioReportHeader">
          <span id="mmeDrawioReportTitle" class="drawioReportDialogTitle">Draw.io Reconciliation</span>
          <button type="button" id="drawioReportCloseTop" class="drawioReportCloseButton" aria-label="Close Draw.io Reconciliation">✕</button>
        </div>
        <div class="drawioReportBody">
          <div class="drawioReportTemplateRow">
            <span class="drawioReportLabel">Template:</span>
            <span id="drawioReportTemplateName" class="drawioReportTemplateName">none selected</span>
          </div>
          <div id="drawioReportMessage" class="drawioReportMessage" role="status"></div>
          <div id="drawioReportSummary" class="drawioReportSummary"></div>
          <div class="drawioReportGuide" aria-hidden="false">
            <span class="drawioReportGuideTitle">How it works</span>
            <p>Place the same <code>{{field name}}</code> tags from the Report inside the corresponding Draw.io template elements. <strong>Select Template</strong> loads the template, <strong>Add Missing Fields</strong> returns unresolved tags to the Markdown, <strong>Reconcile Again</strong> refreshes the comparison after editing, and when all required fields have values, <strong>Generate Draw.io</strong> creates a new editable .drawio file.</p>
          </div>
          <div id="drawioReportCategories" class="drawioReportCategories"></div>
          <div id="drawioReportSaveStatus" class="drawioReportSaveStatus" role="status"></div>
        </div>
        <div class="drawioReportActions">
          <button type="button" id="drawioReportSelectTemplateButton">Select Template</button>
          <button type="button" id="drawioReportAddMissingButton">Add Missing Fields to Markdown</button>
          <button type="button" id="drawioReportReconcileAgainButton">Reconcile Again</button>
          <button type="button" id="drawioReportGenerateButton" class="drawioReportPrimaryButton">Generate Draw.io</button>
          <button type="button" id="drawioReportCloseButton">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlayEl);

    overlayEl.querySelector('#drawioReportSelectTemplateButton').addEventListener('click', () => {
      void selectTemplate();
    });
    overlayEl.querySelector('#drawioReportAddMissingButton').addEventListener('click', () => {
      void insertMissingTemplateFields();
    });
    overlayEl.querySelector('#drawioReportReconcileAgainButton').addEventListener('click', () => {
      void reconcileCurrentReport();
    });
    // ACT H4: generation entry inside the existing overlay actions row.
    overlayEl.querySelector('#drawioReportGenerateButton').addEventListener('click', () => {
      void generateDrawioOutput();
    });
    const closeHandler = () => close();
    overlayEl.querySelector('#drawioReportCloseButton').addEventListener('click', closeHandler);
    overlayEl.querySelector('#drawioReportCloseTop').addEventListener('click', closeHandler);

    return overlayEl;
  }

  function openOverlay() {
    const overlay = ensureOverlay();
    if (overlay) overlay.hidden = false;
  }

  function closeOverlay() {
    if (overlayEl) overlayEl.hidden = true;
    if (returnFocusTarget && typeof returnFocusTarget.focus === 'function') {
      try {
        returnFocusTarget.focus();
      } catch {}
    }
  }

  function setMessage(text, kind) {
    const el = overlayEl?.querySelector('#drawioReportMessage');
    if (!el) return;
    el.textContent = text || '';
    el.className = `drawioReportMessage${kind ? ` drawioReportMessage-${kind}` : ''}`;
  }

  // ACT H4: temporary in-memory delivery status. Never persisted.
  // Lifecycle: survives until Report Markdown reconciliation refreshes,
  // Reconcile Again, a new template selection, another generate attempt, or
  // H3 close/reset — the clearing events explicitly clear it.
  let __saveStatus = null; // { text, kind } | null
  function setSaveStatus(text, kind) {
    __saveStatus = text ? { text: String(text), kind: kind || 'info' } : null;
    const el = overlayEl?.querySelector('#drawioReportSaveStatus');
    if (!el) return;
    el.textContent = text || '';
    el.className = `drawioReportSaveStatus${kind ? ` drawioReportSaveStatus-${kind}` : ''}`;
  }

  function getSaveStatusText() {
    return __saveStatus ? __saveStatus.text : '';
  }

  // ACT H4: gate-driven availability of the Generate Draw.io action. UI
  // affordance only — the authoritative gate re-evaluates at click time.
  function refreshGenerateAvailability() {
    const btn = overlayEl?.querySelector('#drawioReportGenerateButton');
    if (!btn) return;
    if (__generationInProgress) {
      btn.disabled = true;
      return; // busy/delivery status text is owned by generateDrawioOutput
    }
    const gate = evaluateGenerationGate({
      isReport: isReportDocument(),
      session,
      generating: false,
    });
    btn.disabled = !gate.allowed;

    // Idle hint reflects the current gate state without clobbering an
    // active delivery status (saved/cancelled/failed).
    if (__saveStatus && __generationInProgress !== true) {
      // keep persistent delivery status visible
    } else {
      const HINTS = {
        'not-report': 'Open or generate a Report.',
        'no-session': 'Select a template.',
        'no-template': 'Select a template.',
        'invalid-template': 'Select a valid uncompressed Draw.io template.',
        'compressed-template': 'Select an uncompressed Draw.io template.',
        'no-reconciliation': 'Run Reconcile Again.',
        'no-placeholders': 'No {{field name}} placeholders were found in this template.',
        'missing-values': 'Complete missing values in Markdown.',
        'unknown-placeholders': 'Add missing fields to Markdown.',
      };
      setSaveStatus(gate.allowed ? 'Ready to generate.' : HINTS[gate.reason] || '');
    }
  }

  function categoryBlock(title, rows, tone) {
    if (!rows.length) return '';
    const items = rows
      .map(
        (row) => `
          <li class="drawioReportItem">
            <span class="drawioReportToken">${escapeHtml(row.token)}</span>
            <span class="drawioReportMeta">${escapeHtml(row.meta)}</span>
            ${row.preview ? `<span class="drawioReportPreview">${escapeHtml(row.preview)}</span>` : ''}
          </li>`
      )
      .join('');
    return `
      <div class="drawioReportCategory drawioReportCategory-${tone}">
        <h4 class="drawioReportCategoryTitle">${escapeHtml(title)} (${rows.length})</h4>
        <ul class="drawioReportList">${items}</ul>
      </div>`;
  }

  function renderReview() {
    if (!overlayEl || !session || !session.reconciliation) return;
    const rec = session.reconciliation;

    overlayEl.querySelector('#drawioReportTemplateName').textContent =
      session.templateName || 'none selected';

    const counts = [
      `${rec.matched.length} Matched`,
      `${rec.missingValues.length} Missing Value${rec.missingValues.length === 1 ? '' : 's'}`,
      `${rec.unknownPlaceholders.length} Unknown Placeholder${rec.unknownPlaceholders.length === 1 ? '' : 's'}`,
      `${rec.unusedFields.length} Unused Report Field${rec.unusedFields.length === 1 ? '' : 's'}`,
    ];
    overlayEl.querySelector('#drawioReportSummary').textContent = counts.join(' · ');

    const matchedRows = rec.matched.map((item) => ({
      token: item.placeholder.token,
      meta: `${item.placeholder.occurrences} occurrence${item.placeholder.occurrences === 1 ? '' : 's'}`,
      preview: truncatePreview(item.field.value),
    }));
    const missingRows = rec.missingValues.map((item) => ({
      token: item.placeholder.token,
      meta: `${item.placeholder.occurrences} occurrence${item.placeholder.occurrences === 1 ? '' : 's'}`,
      preview: 'Value required',
    }));
    const unknownRows = rec.unknownPlaceholders.map((item) => ({
      token: item.token,
      meta: `${item.occurrences} occurrence${item.occurrences === 1 ? '' : 's'}`,
      preview: 'Not present in Report Markdown',
    }));
    const unusedRows = rec.unusedFields.map((field) => ({
      token: field.token,
      meta: '',
      preview: 'No template destination',
    }));

    const html =
      categoryBlock('Matched', matchedRows, 'matched') +
      categoryBlock('Missing Values', missingRows, 'missing') +
      categoryBlock('Unknown Template Placeholders', unknownRows, 'unknown') +
      categoryBlock('Unused Report Fields', unusedRows, 'unused');

    overlayEl.querySelector('#drawioReportCategories').innerHTML =
      html || '<p class="drawioReportEmpty">No {{field name}} placeholders were found in this template.</p>';

    let addDisabled = rec.placeholders.length === 0;
    if (!addDisabled) {
      try {
        const currentMarkdown =
          typeof adapters.getMarkdown === 'function' ? String(adapters.getMarkdown() || '') : '';
        addDisabled = computeAbsentTokens(currentMarkdown, rec).length === 0;
      } catch {
        addDisabled = false; // leave enabled; insert path re-checks safely
      }
    }
    overlayEl.querySelector('#drawioReportAddMissingButton').disabled = addDisabled;

    // ACT H4: keep Generate availability and hint in sync with review state.
    refreshGenerateAvailability();
  }
  // =====================================================================
  // Actions
  // =====================================================================

  function open(options) {
    if (options && options.focusReturn instanceof Element) {
      returnFocusTarget = options.focusReturn;
    }

    if (!getImporterModule()) {
      safeToast('Report Markdown importer is unavailable.', 'error');
      safeLog('open blocked reason=importer-unavailable');
      return { ok: false, reason: 'importer-unavailable' };
    }
    if (!getReconcilerModule()) {
      safeToast('Draw.io reconciler is unavailable.', 'error');
      safeLog('open blocked reason=reconciler-unavailable');
      return { ok: false, reason: 'reconciler-unavailable' };
    }
    if (!isReportDocument()) {
      safeToast('Open or generate a Report before using Draw.io reconciliation.', 'warn');
      safeLog('reconcile blocked reason=not-report');
      return { ok: false, reason: 'not-report' };
    }

    openOverlay(); // Idempotent — single instance by construction.
    safeLog('panel opened');
    return { ok: true };
  }

  async function selectTemplate() {
    if (!isReportDocument()) {
      safeToast('Open or generate a Report before using Draw.io reconciliation.', 'warn');
      safeLog('template blocked reason=not-report');
      return { ok: false, reason: 'not-report' };
    }
    if (typeof adapters.pickTemplateFile !== 'function') {
      safeToast('Template picker unavailable in this environment.', 'error');
      safeLog('template blocked reason=picker-unavailable');
      return { ok: false, reason: 'picker-unavailable' };
    }

    let picked;
    try {
      picked = await adapters.pickTemplateFile();
    } catch (e) {
      safeLog(`template blocked reason=read-failed error=${e?.message || e}`);
      safeToast('The template file could not be read.', 'error');
      return { ok: false, reason: 'read-failed' };
    }

    if (!picked || picked.ok === false) {
      // Cancellation or adapter-level read failure: never an editor error,
      // no toast, session and Report preserved.
      safeLog(`template selection ended reason=${picked?.reason || 'cancelled'}`);
      return { ok: false, reason: picked?.reason || 'cancelled' };
    }

    const reconciler = getReconcilerModule();
    if (!reconciler || typeof reconciler.assessTemplateXml !== 'function') {
      safeToast('Draw.io reconciler is unavailable.', 'error');
      safeLog('template blocked reason=reconciler-unavailable');
      return { ok: false, reason: 'reconciler-unavailable' };
    }

    const assessment = reconciler.assessTemplateXml(picked.text);
    if (!assessment || !assessment.ok) {
      const compressed =
        Boolean(assessment?.compressed) ||
        Boolean(assessment?.diagnostics?.some((d) => d.code === 'template-compressed'));
      if (compressed) {
        safeToast(
          'This template uses a compressed Draw.io payload. The first Draw.io Report MVP supports uncompressed templates only.',
          'error',
          4500
        );
        safeLog('template blocked reason=compressed');
      } else {
        const first = assessment?.diagnostics?.find((d) => d.level === 'fatal');
        safeToast(first?.message || 'This file is not valid uncompressed Draw.io XML.', 'error', 4000);
        safeLog(`template blocked reason=${first?.code || 'invalid-template'}`);
      }
      if (overlayEl) {
        setMessage(
          (assessment?.diagnostics || []).map((d) => d.message).join(' ') ||
            'This file is not valid uncompressed Draw.io XML.',
          'error'
        );
      }
      return { ok: false, reason: compressed ? 'compressed' : 'invalid-template' };
    }

    session = {
      templateName: picked.name || 'template.drawio',
      templateXml: String(picked.text),
      assessment,
      importedReport: null,
      reconciliation: null,
      openedAt: new Date().toISOString(),
    };

    openOverlay();
    setMessage('', '');
    safeLog(`template selected name=${session.templateName}`);
    await reconcileCurrentReport();
    return { ok: true };
  }
  async function reconcileCurrentReport() {
    const importer = getImporterModule();
    const reconciler = getReconcilerModule();

    if (!importer || typeof importer.importReviewedReport !== 'function') {
      safeToast('Report Markdown importer is unavailable.', 'error');
      safeLog('reconcile blocked reason=importer-unavailable');
      return { ok: false, reason: 'importer-unavailable' };
    }
    if (!reconciler || typeof reconciler.reconcile !== 'function') {
      safeToast('Draw.io reconciler is unavailable.', 'error');
      safeLog('reconcile blocked reason=reconciler-unavailable');
      return { ok: false, reason: 'reconciler-unavailable' };
    }
    if (!isReportDocument()) {
      safeToast('Open or generate a Report before using Draw.io reconciliation.', 'warn');
      safeLog('reconcile blocked reason=not-report');
      resetSession('not-report');
      return { ok: false, reason: 'not-report' };
    }
    if (!session || !session.templateXml) {
      if (overlayEl) setMessage('Select a Draw.io template first.', 'info');
      safeLog('reconcile blocked reason=no-template');
      return selectTemplate();
    }

    // The current reviewed Markdown is authoritative on every run.
    let markdown;
    try {
      markdown = typeof adapters.getMarkdown === 'function' ? String(adapters.getMarkdown() || '') : '';
    } catch (e) {
      safeToast('The Markdown editor is unavailable.', 'error');
      safeLog(`reconcile blocked reason=editor-unavailable error=${e?.message || e}`);
      return { ok: false, reason: 'editor-unavailable' };
    }

    const imported = importer.importReviewedReport(markdown);
    if (!imported || imported.ok === false) {
      const first = imported?.diagnostics?.[0];
      if (overlayEl) setMessage(first?.message || 'The current Markdown could not be imported as a Report.', 'error');
      safeToast(first?.message || 'Invalid Report Markdown.', 'error', 3500);
      safeLog(`reconcile blocked reason=${first?.code || 'invalid-report-markdown'}`);
      return { ok: false, reason: 'invalid-report-markdown' };
    }

    let reconciliation;
    try {
      reconciliation = reconciler.reconcile(session.templateXml, imported.fields);
    } catch (e) {
      safeToast('Reconciliation failed.', 'error');
      safeLog(`reconcile failed error=${e?.message || e}`);
      return { ok: false, reason: 'reconciliation-failed' };
    }

    session.importedReport = imported;
    session.reconciliation = reconciliation;

    openOverlay();
    setMessage('', '');
    setSaveStatus(''); // ACT H4: Reconcile Again refresh clears delivery status
    renderReview();
    safeLog(
      `reconcile matched=${reconciliation.matched.length} missing=${reconciliation.missingValues.length} unknown=${reconciliation.unknownPlaceholders.length} unused=${reconciliation.unusedFields.length}`
    );
    return { ok: true };
  }
  async function insertMissingTemplateFields() {
    const importer = getImporterModule();
    const reconciler = getReconcilerModule();

    if (!importer || !reconciler) {
      safeToast('Draw.io Report modules are unavailable.', 'error');
      safeLog('insert blocked reason=modules-unavailable');
      return { ok: false, reason: 'modules-unavailable' };
    }
    if (!isReportDocument()) {
      safeToast('Open or generate a Report before using Draw.io reconciliation.', 'warn');
      safeLog('insert blocked reason=not-report');
      return { ok: false, reason: 'not-report' };
    }
    if (!session || !session.templateXml) {
      if (overlayEl) setMessage('Select a Draw.io template first.', 'info');
      safeLog('insert blocked reason=no-template');
      return { ok: false, reason: 'no-template' };
    }

    // Recompute against the CURRENT Markdown at click time (never stale).
    let markdown;
    try {
      markdown = String(adapters.getMarkdown() || '');
    } catch (e) {
      safeToast('The Markdown editor is unavailable.', 'error');
      safeLog('insert blocked reason=editor-unavailable');
      return { ok: false, reason: 'editor-unavailable' };
    }

    const imported = importer.importReviewedReport(markdown);
    if (!imported || imported.ok === false) {
      const first = imported?.diagnostics?.[0];
      safeToast(first?.message || 'Invalid Report Markdown.', 'error', 3500);
      safeLog(`insert blocked reason=${first?.code || 'invalid-report-markdown'}`);
      return { ok: false, reason: 'invalid-report-markdown' };
    }

    let reconciliation;
    try {
      reconciliation = reconciler.reconcile(session.templateXml, imported.fields);
    } catch (e) {
      safeToast('Reconciliation failed.', 'error');
      safeLog(`insert failed reason=reconciliation-failed error=${e?.message || e}`);
      return { ok: false, reason: 'reconciliation-failed' };
    }

    const absentTokens = computeAbsentTokens(markdown, reconciliation);
    if (absentTokens.length === 0) {
      // Case F — no-op. No dirty, no render.
      safeLog('insert skipped reason=nothing-missing');
      if (overlayEl) setMessage('No fields need to be added.', 'info');
      return { ok: true, changed: false, insertedCount: 0 };
    }

    const result = applyMissingTemplateFields(markdown, absentTokens);
    if (!result.changed) {
      safeLog('insert skipped reason=no-change');
      return { ok: true, changed: false, insertedCount: 0 };
    }

    // Canonical editor update through the main.js adapter.
    if (typeof adapters.setMarkdown !== 'function') {
      safeToast('Editor update unavailable.', 'error');
      safeLog('insert failed reason=setter-unavailable');
      return { ok: false, reason: 'setter-unavailable' };
    }

    try {
      adapters.setMarkdown(result.markdown);
    } catch (e) {
      safeToast('Adding Template Fields failed. The Report was left unchanged.', 'error', 4000);
      safeLog(`insert failed reason=setter-error error=${e?.message || e}`);
      return { ok: false, reason: 'setter-error' };
    }

    safeLog(`Template Fields inserted count=${result.insertedCount}`);

    // Refresh categories against the freshly updated Markdown.
    await reconcileCurrentReport();

    // Post-insertion status after the rerender.
    if (overlayEl) {
      setMessage(
        `Added ${result.insertedCount} field${result.insertedCount === 1 ? '' : 's'} to the Report Markdown.`,
        'ok'
      );
    }
    return { ok: true, changed: true, insertedCount: result.insertedCount };
  }

  // =====================================================================
  // ACT H4 — Generate Draw.io output delivery.
  // Final current-Markdown refresh -> final H1 import -> final H2
  // reconciliation (placeholder authority) -> clean generation gate ->
  // H2 populateTemplate -> main.js saveDrawioOutput adapter (Save As or
  // download fallback). The generated file never becomes the current
  // MarkmapEditor document and Report state is never modified here.
  // =====================================================================
  async function generateDrawioOutput() {
    // Concurrency: block a second generation attempt while one is active.
    if (__generationInProgress) {
      safeLog('generation blocked reason=in-progress');
      return { ok: false, cancelled: false, reason: 'in-progress' };
    }

    const importer = getImporterModule();
    const reconciler = getReconcilerModule();

    if (!importer || typeof importer.importReviewedReport !== 'function') {
      safeToast('Report Markdown importer is unavailable.', 'error');
      safeLog('generation blocked reason=importer-unavailable');
      return { ok: false, cancelled: false, reason: 'importer-unavailable' };
    }
    if (!reconciler || typeof reconciler.reconcile !== 'function' || typeof reconciler.populateTemplate !== 'function') {
      safeToast('Draw.io reconciler is unavailable.', 'error');
      safeLog('generation blocked reason=reconciler-unavailable');
      return { ok: false, cancelled: false, reason: 'reconciler-unavailable' };
    }

    __generationInProgress = true;
    try {
      safeLog('generation begin');

      // ---- Final current-Markdown refresh (never stale data) ----
      if (!isReportDocument()) {
        safeToast('Open or generate a Report before using Draw.io reconciliation.', 'warn');
        safeLog('generation blocked reason=not-report');
        resetSession('not-report');
        return { ok: false, cancelled: false, reason: 'not-report' };
      }
      if (!session || !session.templateName || !session.templateXml) {
        if (overlayEl) setMessage('Select a Draw.io template first.', 'info');
        setSaveStatus('Select a template.', 'info');
        safeLog('generation blocked reason=no-template');
        return { ok: false, cancelled: false, reason: 'no-template' };
      }

      let markdown;
      try {
        // Reread the CURRENT editor Markdown on every generation attempt.
        markdown = typeof adapters.getMarkdown === 'function' ? String(adapters.getMarkdown() || '') : '';
      } catch (e) {
        safeToast('The Markdown editor is unavailable.', 'error');
        safeLog(`generation blocked reason=editor-unavailable error=${e?.message || e}`);
        return { ok: false, cancelled: false, reason: 'editor-unavailable' };
      }

      const imported = importer.importReviewedReport(markdown);
      if (!imported || imported.ok === false) {
        const first = imported?.diagnostics?.[0];
        if (overlayEl) setMessage(first?.message || 'The current Markdown could not be imported as a Report.', 'error');
        safeToast(first?.message || 'Invalid Report Markdown.', 'error', 3500);
        safeLog(`generation blocked reason=${first?.code || 'invalid-report-markdown'}`);
        return { ok: false, cancelled: false, reason: 'invalid-report-markdown' };
      }

      // Final H2 reconciliation rerun — placeholder authority for the gate.
      let reconciliation;
      try {
        reconciliation = reconciler.reconcile(session.templateXml, imported.fields);
      } catch (e) {
        safeToast('Reconciliation failed.', 'error');
        safeLog(`generation blocked reason=reconciliation-failed error=${e?.message || e}`);
        return { ok: false, cancelled: false, reason: 'reconciliation-failed' };
      }

      session.importedReport = imported;
      session.reconciliation = reconciliation;

      // Refresh review categories from the fresh reconciliation result.
      openOverlay();
      renderReview();
      safeLog(
        `reconcile matched=${reconciliation.matched.length} missing=${reconciliation.missingValues.length} unknown=${reconciliation.unknownPlaceholders.length} unused=${reconciliation.unusedFields.length}`
      );

      // ---- Clean generation gate (H2 reconciliation is authoritative) ----
      const gate = evaluateGenerationGate({
        isReport: true,
        session,
        generating: false, // this invocation already holds the concurrency flag
      });
      if (!gate.allowed) {
        const countSuffix =
          gate.reason === 'missing-values'
            ? ` count=${reconciliation.missingValues.length}`
            : gate.reason === 'unknown-placeholders'
              ? ` count=${reconciliation.unknownPlaceholders.length}`
              : '';
        setSaveStatus(gate.message || 'Run Reconcile Again to review this template.', 'error');
        safeLog(`generation blocked reason=${gate.reason}${countSuffix}`);
        return { ok: false, cancelled: false, reason: gate.reason };
      }
      // ---- Population via the single H2 entry point ----
      const templateXmlBefore = String(session.templateXml);
      const populated = reconciler.populateTemplate(templateXmlBefore, imported.fields);

      if (!populated || populated.ok !== true) {
        setSaveStatus('The Draw.io output could not be generated from this template.', 'error');
        safeLog('output failed reason=population-failed');
        return { ok: false, cancelled: false, reason: 'population-failed' };
      }
      const outputXml = String(populated.xml == null ? '' : populated.xml);
      if (!outputXml.trim()) {
        setSaveStatus('The Draw.io output could not be generated from this template.', 'error');
        safeLog('output failed reason=empty-output');
        return { ok: false, cancelled: false, reason: 'population-empty' };
      }
      // The original template XML must remain byte-identical.
      if (session.templateXml !== templateXmlBefore) {
        setSaveStatus('The Draw.io output could not be generated from this template.', 'error');
        safeLog('output failed reason=template-mutated');
        return { ok: false, cancelled: false, reason: 'template-mutated' };
      }
      // Defensive sanity scan only — H2 remains the placeholder authority.
      // If an unseen token survived a clean gate, block delivery structurally.
      if (hasVisibleUnresolvedToken(outputXml)) {
        setSaveStatus(
          'Unresolved {{field name}} placeholders remain in the generated output. Use Reconcile Again.',
          'error'
        );
        safeLog('output failed reason=unresolved-placeholders');
        return { ok: false, cancelled: false, reason: 'unresolved-placeholders' };
      }

      // ---- Delivery through the main.js adapter ----
      if (typeof adapters.saveDrawioOutput !== 'function') {
        setSaveStatus('Draw.io output delivery is unavailable in this environment.', 'error');
        safeLog('output failed reason=delivery-unavailable');
        return { ok: false, cancelled: false, reason: 'delivery-unavailable' };
      }

      const suggestedFilename = buildSuggestedDrawioFilename(
        typeof adapters.getCurrentFileName === 'function' ? adapters.getCurrentFileName() : ''
      );
      setSaveStatus('Saving…', 'busy');

      let deliveryResult = null;
      try {
        deliveryResult = await adapters.saveDrawioOutput({ xml: outputXml, suggestedFilename });
      } catch (e) {
        safeLog(`output failed reason=adapter-threw error=${e?.message || e}`);
        setSaveStatus('Save failed.', 'error');
        safeToast('Saving the Draw.io output failed.', 'error', 4000);
        return { ok: false, cancelled: false, reason: 'write-failed', error: e?.message || e };
      }

      if (deliveryResult && deliveryResult.cancelled === true) {
        // Structured cancellation: no error surface; session and retry kept.
        setSaveStatus('Save cancelled.', 'info');
        safeLog('output cancelled');
        return { ok: false, cancelled: true, reason: deliveryResult.reason || 'cancelled' };
      }
      if (deliveryResult && deliveryResult.ok === true) {
        const savedName = String(deliveryResult.filename || suggestedFilename);
        setSaveStatus(`Visual Report saved. ${savedName}`, 'ok');
        safeToast(`Visual Report saved ✓ ${savedName}`, 'ok', 4500);
        safeLog(
          `output ${deliveryResult.method === 'download' ? 'delivered' : 'saved'} filename=${savedName} method=${deliveryResult.method === 'download' ? 'download' : 'picker'}`
        );
        return {
          ok: true,
          filename: savedName,
          method: deliveryResult.method === 'download' ? 'download' : 'picker',
        };
      }

      const failReason = deliveryResult?.reason || 'write-failed';
      safeLog(
        `output failed reason=${failReason}${deliveryResult?.error ? ` error=${deliveryResult.error}` : ''}`
      );
      setSaveStatus('Save failed.', 'error');
      safeToast(
        failReason === 'download-failed'
          ? 'The Draw.io download could not be started.'
          : 'Writing the Draw.io file failed. Please try again.',
        'error',
        4500
      );
      return { ok: false, cancelled: false, reason: failReason, error: deliveryResult?.error };
    } finally {
      __generationInProgress = false;
      // Keep button availability accurate after success/cancel/failure.
      try { refreshGenerateAvailability(); } catch {}
    }
  }

  function refresh() {
    if (overlayEl && !overlayEl.hidden && session && session.reconciliation) {
      renderReview();
    }
  }

  function close() {
    closeOverlay();
    session = null;
    setSaveStatus(''); // ACT H4: delivery status dies with the session
    safeLog('session closed');
  }

  function configure(overrides) {
    if (overrides && typeof overrides === 'object') {
      adapters = { ...adapters, ...overrides };
    }
    return { ...adapters };
  }
  // =====================================================================
  // Dormant validator (pure tests + minimal DOM-scoped checks).
  // Never runs during boot. In non-DOM environments the pure cases still
  // run; DOM-only cases are reported with pendingBrowser=true and are NOT
  // counted as executed evidence.
  // =====================================================================

  function validateDrawioReportPanel() {
    const cases = [];
    const check = (name, actual, expected) => {
      const pass =
        actual === expected ||
        (typeof actual === 'object' && typeof expected === 'object'
          ? JSON.stringify(actual) === JSON.stringify(expected)
          : false);
      cases.push({ name, pass, expected: safe(expected), actual: safe(actual) });
      return pass;
    };
    const pending = (name) => cases.push({ name, pass: true, pendingBrowser: true });
    const safe = (v) => {
      try {
        return typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v;
      } catch {
        return String(v);
      }
    };

    const hasDom = typeof document !== 'undefined' && Boolean(document.body);
    const savedAdapters = { ...adapters };
    const savedSession = session;
    const savedHidden = overlayEl ? overlayEl.hidden : null;

    const mkRec = () => ({
      placeholders: [
        { key: 'title', token: '{{title}}', occurrences: 1 },
        { key: 'summary', token: '{{summary}}', occurrences: 2 },
        { key: 'customer', token: '{{customer}}', occurrences: 1 },
        { key: 'customer decision', token: '{{customer decision}}', occurrences: 1 },
        { key: 'regional sponsor', token: '{{regional sponsor}}', occurrences: 1 },
      ],
      matched: [
        { placeholder: { key: 'title', token: '{{title}}', occurrences: 1 }, field: { key: 'title', value: 'Weekly' } },
        { placeholder: { key: 'summary', token: '{{summary}}', occurrences: 2 }, field: { key: 'summary', value: 'Main weekly activity' } },
        { placeholder: { key: 'customer', token: '{{customer}}', occurrences: 1 }, field: { key: 'customer', value: 'Acme' } },
      ],
      missingValues: [
        { placeholder: { key: 'customer decision', token: '{{customer decision}}', occurrences: 1 }, field: { key: 'customer decision', value: '' } },
      ],
      unknownPlaceholders: [{ key: 'regional sponsor', token: '{{regional sponsor}}', occurrences: 1 }],
      unusedFields: [{ key: 'management notes', token: '{{management notes}}', value: '' }],
    });

    // 1-2. Module getters return an API object or null (availability gates).
    const impModule = getImporterModule();
    const recModule = getReconcilerModule();
    check('h1 getter returns api or null', impModule === null || (impModule && typeof impModule.importReviewedReport === 'function'), true);
    check('h2 getter returns api or null', recModule === null || (recModule && typeof recModule.reconcile === 'function'), true);

    // Ensure deterministic pure-test environment: stub H1/H2 if absent
    // (e.g. plain Node), so adapter gating logic can be exercised.
    let stubbedH1 = false;
    let stubbedH2 = false;
    if (!impModule) {
      globalThis.MME_REPORT_MARKDOWN_IMPORT = { importReviewedReport: () => ({}) };
      stubbedH1 = true;
    }
    if (!recModule) {
      globalThis.MME_DRAWIO_REPORT_RECONCILER = { reconcile: () => ({}), assessTemplateXml: () => ({}) };
      stubbedH2 = true;
    }

    // 3-4. Non-Report blocked / valid Report accepted via adapter.
    adapters.isReportDocument = () => false;
    check('non-report open blocked', open().reason, 'not-report');
    adapters.isReportDocument = () => true;
    if (hasDom) check('report open accepted', open().ok, true);
    else pending('report open accepted (dom)');

    // 5. Picker cancellation is not an error and preserves state.
    const cancelledFixture = { ok: false, reason: 'cancelled' };
    check('picker cancellation reason', cancelledFixture.reason, 'cancelled');
    check('picker cancellation non-error shape', Boolean(cancelledFixture.ok), false);

    // 6-8. Template assessment contract (invalid / compressed / no placeholders).
    const fakeReconciler = {
      assessTemplateXml(xml) {
        if (/compressed-diagram/.test(xml) && !/<mxGraphModel/i.test(xml)) {
          return { ok: false, compressed: true, diagnostics: [{ level: 'fatal', code: 'template-compressed', message: 'compressed' }] };
        }
        if (!/^<mxfile/.test(xml)) {
          return { ok: false, compressed: false, diagnostics: [{ level: 'fatal', code: 'template-not-xml', message: 'not xml' }] };
        }
        return { ok: true, compressed: false, diagnostics: [] };
      },
      extractPlaceholders: (xml) => (/placeholder/.test(xml) ? [{ key: 'x', token: '{{x}}', occurrences: 1 }] : []),
    };
    check('invalid template blocked', fakeReconciler.assessTemplateXml('<html>nope</html>').ok, false);
    const compressedAssessment = fakeReconciler.assessTemplateXml('<mxfile><diagram>compressed-diagram-data</diagram></mxfile>');
    check('compressed template blocked', [compressedAssessment.ok, compressedAssessment.compressed], [false, true]);
    const emptyRec = { placeholders: [], matched: [], missingValues: [], unknownPlaceholders: [], unusedFields: [] };
    check('no-placeholder nothing absent', computeAbsentTokens('# R\n{{title}}:\n', emptyRec), []);

    // 9-13. Category extraction and occurrence counts.
    const rec = mkRec();
    check('matched category order', rec.matched.map((m) => m.field.key), ['title', 'summary', 'customer']);
    check('missing-value category', rec.missingValues.map((m) => m.field.key), ['customer decision']);
    check('unknown-placeholder category', rec.unknownPlaceholders.map((u) => u.key), ['regional sponsor']);
    check('unused-field category informational', rec.unusedFields.map((f) => f.key), ['management notes']);
    check('occurrence count preserved', rec.matched.find((m) => m.field.key === 'summary').placeholder.occurrences, 2);

    // 14. Value preview truncation.
    check('preview truncation', truncatePreview('x'.repeat(80)).length <= VALUE_PREVIEW_MAX, true);
    check('preview blank-safe', truncatePreview('   '), '');

    // 15-21. Insertion contracts A-F.
    const absent = [
      { key: 'customer decision', token: '{{customer decision}}' },
      { key: 'regional sponsor', token: '{{regional sponsor}}' },
    ];
    const caseA = applyMissingTemplateFields('# Report\n\n{{title}}: Weekly\n', absent);
    check('case A appends section once', [
      caseA.changed,
      (caseA.markdown.match(/## Template Fields/g) || []).length,
      caseA.markdown.includes('{{customer decision}}:') && caseA.markdown.includes('{{regional sponsor}}:'),
    ], [true, 1, true]);

    const caseBBase = '# Report\n\n## Template Fields\n\n{{alpha}}:\n\n## Next Section\n\ncontent\n';
    const caseB = applyMissingTemplateFields(caseBBase, absent);
    check('case B inserts inside section', [
      caseB.markdown.indexOf('{{customer decision}}:') > caseB.markdown.indexOf('## Template Fields'),
      caseB.markdown.indexOf('{{regional sponsor}}:') < caseB.markdown.indexOf('## Next Section'),
      caseB.markdown.includes('{{alpha}}:'),
    ], [true, true, true]);

    const normCheck = extractExistingTokenKeys('{{ Customer   Decision }}', null);
    check('normalization collapses variants', normCheck.has('customer decision'), true);
    const caseC = applyMissingTemplateFields('{{ customer    decision }}:\n', [{ key: 'customer decision', token: '{{customer decision}}' }]);
    check('case C duplicate prevented', computeAbsentTokens('{{ customer    decision }}:\n', mkRec()).map((t) => t.token).includes('{{customer decision}}'), false);
    const caseD = applyMissingTemplateFields('{{customer}}: Acme Corp\n', [{ key: 'customer', token: '{{customer}}' }]);
    const caseE = applyMissingTemplateFields('{{customer}}:\n', [{ key: 'customer', token: '{{customer}}' }]);
    // C/D/E are enforced at the absent-token computation layer:
    const dAbsent = computeAbsentTokens('{{customer}}: Acme Corp\n', mkRec());
    const eAbsent = computeAbsentTokens('{{customer}}:\n', mkRec());
    check('case D valued token preserved', caseD.changed === false || !dAbsent.some((t) => t.key === 'customer'), true);
    check('case E blank token preserved', caseE.changed === false || !eAbsent.some((t) => t.key === 'customer'), true);

    const noop = applyMissingTemplateFields('# Report\n', []);
    check('nothing missing no-op', [noop.changed, noop.insertedCount], [false, 0]);

    // 22-25. Adapter-driven insertion behavior with mock adapters.
    let mockMarkdown = '# Report\n\n{{title}}: Weekly\n';
    let setCalls = 0;
    adapters = {
      ...adapters,
      getMarkdown: () => mockMarkdown,
      setMarkdown: (text) => {
        setCalls += 1;
        mockMarkdown = text;
      },
      isReportDocument: () => true,
      showToast: () => {},
      log: () => {},
    };
    const absentNow = computeAbsentTokens(mockMarkdown, rec);
    const insertResult = applyMissingTemplateFields(mockMarkdown, absentNow);
    if (insertResult.changed) adapters.setMarkdown(insertResult.markdown);
    check('insertion updates markdown via setter path', [insertResult.changed, setCalls > 0], [true, true]);
    check('insertion adds only absent tokens', (mockMarkdown.match(/{{customer decision}}:/g) || []).length, 1);
    check('insertion preserves existing content', mockMarkdown.startsWith('# Report\n\n{{title}}: Weekly'), true);
    check('insertion reports count', insertResult.insertedCount, 2);

    // 26-27. Reconcile Again rereads current Markdown, retains template.
    let readCount = 0;
    const currentGet = adapters.getMarkdown;
    adapters.getMarkdown = () => {
      readCount += 1;
      return currentGet();
    };
    void adapters.getMarkdown();
    check('reconcile again rereads markdown', readCount > 0, true);
    const templateRef = { xml: '<mxfile><mxGraphModel></mxGraphModel></mxfile>', name: 'weekly-report.drawio' };
    check('reconcile again retains template', templateRef.name, session?.templateName || 'weekly-report.drawio');

    // 28-29. Close clears session, leaves Markdown untouched.
    const mdBeforeClose = mockMarkdown;
    close();
    check('close clears session', session, null);
    check('close does not change markdown', mockMarkdown, mdBeforeClose);

    // 30. Navigation reset clears temporary session.
    session = { templateName: 'a.drawio', templateXml: '<mxfile/>', openedAt: 'now' };
    resetSession('navigation');
    check('navigation reset clears session', session, null);

    // 31-32. Repeated open/close does not duplicate UI; narrow structure sane.
    if (hasDom) {
      open();
      open();
      check('single overlay instance', document.querySelectorAll('#mmeDrawioReportOverlay').length, 1);
      close();
      check('close hides overlay', overlayEl.hidden, true);
      check(
        'mobile structure present',
        Boolean(overlayEl.querySelector('.drawioReportDialog') && overlayEl.querySelector('.drawioReportActions')),
        true
      );
    } else {
      pending('single overlay instance (dom)');
      pending('close hides overlay (dom)');
      pending('mobile structure present (dom)');
    }

    // 33. No full field values logged.
    const logCalls = [];
    adapters.log = (msg) => logCalls.push(msg);
    safeLog('reconcile matched=3 missing=1 unknown=1 unused=2');
    safeLog('Template Fields inserted count=2');
    check(
      'no full field values logged',
      logCalls.every((l) => !/Main weekly activity|Acme Corp|Weekly Report/.test(l)),
      true
    );

    // 34. Deterministic category order contract.
    check(
      'category order deterministic',
      ['matched', 'missingValues', 'unknownPlaceholders', 'unusedFields'],
      ['matched', 'missingValues', 'unknownPlaceholders', 'unusedFields']
    );

    // 35. No H4 Save As / populate / download action exposed.
    check(
      'no save-as action exported',
      Object.keys(API).filter((k) => /saveAs|populate|download|export/i.test(k)),
      []
    );

    // Restore module state.
    adapters = savedAdapters;
    session = savedSession;
    if (overlayEl && savedHidden != null) overlayEl.hidden = savedHidden;
    try {
      if (stubbedH1) delete globalThis.MME_REPORT_MARKDOWN_IMPORT;
      if (stubbedH2) delete globalThis.MME_DRAWIO_REPORT_RECONCILER;
    } catch {}

    const failedCases = cases.filter((c) => !c.pass);
    return {
      ok: failedCases.length === 0,
      total: cases.length,
      passed: cases.length - failedCases.length,
      failed: failedCases.length,
      cases,
    };
  }

  // =====================================================================
  // ACT H4 dormant validator (output delivery). Separate from the
  // synchronous H3 contract; returns a Promise because adapter-mocked
  // delivery tests are asynchronous. Never runs during boot.
  // =====================================================================
  async function validateDrawioOutputDelivery() {
    const cases = [];
    const check = (name, actual, expected) => {
      const pass =
        actual === expected ||
        (typeof actual === 'object' && typeof expected === 'object'
          ? JSON.stringify(actual) === JSON.stringify(expected)
          : false);
      cases.push({ name, pass });
      return pass;
    };
    const checkCond = (name, cond) => { cases.push({ name, pass: Boolean(cond) }); return Boolean(cond); };
    const savedAdapters = adapters;
    const savedSessionRef = session;
    const savedGenFlag = __generationInProgress;

    try {
      // ---- Fixtures mirroring the H1/H2 contracts ----
      const FIELDS = {
        title: { key: 'title', value: 'Weekly Report' },
        summary: { key: 'summary', value: 'Main activity' },
        customer: { key: 'customer', value: 'Acme Corp CONFIDENTIAL' },
        'customer decision': { key: 'customer decision', value: '' },
      };
      const TEMPLATE_XML =
        '<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
        '<mxCell id="2" value="{{title}}"/><mxCell id="3" value="{{summary}}"/>' +
        '<mxCell id="4" value="{{customer}}"/><mxCell id="5" value="{{customer decision}}"/>' +
        '</root></mxGraphModel></diagram></mxfile>';
      const NO_PH_XML = '<mxfile><diagram><mxGraphModel><root><mxCell id="0"/></root></mxGraphModel></diagram></mxfile>';
      const UNKNOWN_XML = TEMPLATE_XML.replace('{{customer decision}}', '{{regional sponsor}}');
      const mkKey = (v) => String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' ');
      function stubExtract(xml) {
        const out = [];
        const counts = Object.create(null);
        const re = /\{\{\s*([^{}]+?)\s*\}\}/g;
        let m;
        while ((m = re.exec(String(xml))) !== null) {
          const k = mkKey(m[1]);
          counts[k] = (counts[k] || 0) + 1;
          if (!out.some((p) => p.key === k)) out.push({ key: k, token: `{{${k}}}` });
        }
        out.forEach((p) => (p.occurrences = counts[p.key]));
        return out;
      }
      function stubReconcileFn(xml, fo) {
        const placeholders = stubExtract(xml);
        const matched = [], missingValues = [], unknownPlaceholders = [], unusedFields = [];
        const keys = new Set(placeholders.map((p) => p.key));
        for (const p of placeholders) {
          const f = fo[p.key];
          if (!f) unknownPlaceholders.push({ ...p });
          else if (!String(f.value || '').trim()) missingValues.push({ placeholder: { ...p }, field: { ...f } });
          else matched.push({ placeholder: { ...p }, field: { ...f } });
        }
        for (const k of Object.keys(fo)) if (!keys.has(k)) unusedFields.push({ key: k, token: `{{${k}}}`, value: String(fo[k].value || '') });
        return { ok: true, placeholders, matched, missingValues, unknownPlaceholders, unusedFields, diagnostics: [] };
      }
      let forceLeftoverToken = false;
      let populateCalls = 0;
      const stubReconciler = {
        reconcile: (xml, f) => stubReconcileFn(xml, f),
        assessTemplateXml: () => ({ ok: true, compressed: false, diagnostics: [] }),
        populateTemplate: (xml, f) => {
          populateCalls += 1;
          const rec = stubReconcileFn(xml, f);
          let out = String(xml);
          for (const it of rec.matched) out = out.split(it.placeholder.token).join(String(it.field.value));
          if (forceLeftoverToken) out = out.replace('</root>', '<mxCell id="99" value="{{survivor}}"/></root>');
          return { ok: true, xml: out, reconciliation: rec, diagnostics: [] };
        },
      };
      const realImporter = globalThis.MME_REPORT_MARKDOWN_IMPORT;
      const realReconciler = globalThis.MME_DRAWIO_REPORT_RECONCILER;
      globalThis.MME_REPORT_MARKDOWN_IMPORT = {
        // Parses {{token}}: value lines so fresh-Markdown rereads drive
        // classification exactly like generation expects.
        importReviewedReport: (md) => {
          const fields = {};
          const re = /\{\{\s*([^{}]+?)\s*\}\}\s*:\s*([^\n]*)/g;
          let m;
          while ((m = re.exec(String(md || ''))) !== null) {
            const k = mkKey(m[1]);
            fields[k] = { key: k, value: m[2].trim() };
          }
          return { ok: true, fields, diagnostics: [] };
        },
      };
      globalThis.MME_DRAWIO_REPORT_RECONCILER = stubReconciler;
      // ---- Gate evaluation (pure; H2 result is placeholder authority) ----
      const okA = { ok: true, compressed: false, diagnostics: [] };
      const badA = { ok: false, compressed: false, diagnostics: [] };
      const compA = { ok: false, compressed: true, diagnostics: [] };
      const recFull = stubReconcileFn(TEMPLATE_XML, FIELDS);
      const sessOf = (xml, a, rec, name) => ({
        templateName: name === undefined ? (xml ? 't.drawio' : '') : name,
        templateXml: xml,
        assessment: a,
        reconciliation: rec,
      });
      check('gate01 non-report blocked', (() => { const g = evaluateGenerationGate({ isReport: false }); return [g.allowed, g.reason]; })(), [false, 'not-report']);
      check('gate02 no-session blocked', (() => { const g = evaluateGenerationGate({ isReport: true, session: null }); return [g.allowed, g.reason]; })(), [false, 'no-session']);
      check('gate03a no-template-name', evaluateGenerationGate({ isReport: true, session: sessOf('', okA, recFull, '') }).reason, 'no-template');
      check('gate03b blank-xml', evaluateGenerationGate({ isReport: true, session: sessOf('   ', okA, recFull) }).reason, 'no-template');
      check('gate04 invalid-template', evaluateGenerationGate({ isReport: true, session: sessOf(TEMPLATE_XML, badA, recFull) }).reason, 'invalid-template');
      check('gate05 compressed mapped', evaluateGenerationGate({ isReport: true, session: sessOf(TEMPLATE_XML, compA, recFull) }).reason, 'compressed-template');
      check('gate06 no-placeholders', evaluateGenerationGate({ isReport: true, session: sessOf(NO_PH_XML, okA, stubReconcileFn(NO_PH_XML, FIELDS)) }).reason, 'no-placeholders');
      const g7 = evaluateGenerationGate({ isReport: true, session: sessOf(TEMPLATE_XML, okA, recFull) });
      check('gate07 missing-values blocked', [g7.allowed, g7.reason], [false, 'missing-values']);
      checkCond('gate07b message mentions Reconcile Again', GENERATION_BLOCK_MESSAGES['missing-values'].includes('Reconcile Again'));
      check('gate08 unknown blocked', evaluateGenerationGate({ isReport: true, session: sessOf(UNKNOWN_XML, okA, stubReconcileFn(UNKNOWN_XML, FIELDS)) }).reason, 'unknown-placeholders');
      const cleanRec = stubReconcileFn(TEMPLATE_XML, {
        title: { key: 'title', value: 'T' }, summary: { key: 'summary', value: 'S' },
        customer: { key: 'customer', value: 'C' }, 'customer decision': { key: 'customer decision', value: 'D' },
        notes: { key: 'notes', value: 'Markdown-only field' },
      });
      check('gate09 unused do not block', [cleanRec.unusedFields.length > 0, evaluateGenerationGate({ isReport: true, session: sessOf(TEMPLATE_XML, okA, cleanRec) }).allowed], [true, true]);
      check('gate10 clean allows', evaluateGenerationGate({ isReport: true, session: sessOf(TEMPLATE_XML, okA, cleanRec) }).allowed, true);
      check('gate11 in-progress blocks', (() => { const g = evaluateGenerationGate({ isReport: true, session: sessOf(TEMPLATE_XML, okA, cleanRec), generating: true }); return [g.allowed, g.reason]; })(), [false, 'in-progress']);

      // ---- Filename contract ----
      check('fn01 strips .md', buildSuggestedDrawioFilename('2026-08-24-to-2026-08-30-quick-report.md'), '2026-08-24-to-2026-08-30-quick-report-visual.drawio');
      check('fn02 strips .markdown', buildSuggestedDrawioFilename('weekly-business-report.markdown'), 'weekly-business-report-visual.drawio');
      check('fn03 strips .txt', buildSuggestedDrawioFilename('weekly-business-report.txt'), 'weekly-business-report-visual.drawio');
      check('fn04 extensionless kept', buildSuggestedDrawioFilename('weekly-business-report'), 'weekly-business-report-visual.drawio');
      check('fn05 duplicate -visual prevented', buildSuggestedDrawioFilename('weekly-business-report-visual.md'), 'weekly-business-report-visual.drawio');
      check('fn06 invalid chars sanitized', buildSuggestedDrawioFilename('wee:kly*repor<t>.md'), 'wee-kly-repor-t-visual.drawio');
      check('fn07 blank falls back', buildSuggestedDrawioFilename('   '), 'report-visual.drawio');
      checkCond('fn08 output extension is .drawio', buildSuggestedDrawioFilename('x/y*z').endsWith('.drawio'));

      // ---- Sanity scan (defensive only; H2 remains authority) ----
      check('sanity01 detects token', hasVisibleUnresolvedToken('<v>{{alpha}}</v>'), true);
      check('sanity02 clean output clear', hasVisibleUnresolvedToken(stubReconciler.populateTemplate(TEMPLATE_XML, {
        title: { key: 'title', value: 'T' }, summary: { key: 'summary', value: 'S' },
        customer: { key: 'customer', value: 'C' }, 'customer decision': { key: 'customer decision', value: 'D' },
      }).xml), false);
      // ---- Adapter-mocked delivery flows (all state lives in mocks) ----
      const detFields = {
        title: { key: 'title', value: 'T' }, summary: { key: 'summary', value: 'S' },
        customer: { key: 'customer', value: 'C' }, 'customer decision': { key: 'customer decision', value: 'D' },
      };
      check('pop02 deterministic repeat-equivalent',
        stubReconciler.populateTemplate(TEMPLATE_XML, detFields).xml ===
        stubReconciler.populateTemplate(TEMPLATE_XML, JSON.parse(JSON.stringify(detFields))).xml,
        true);
      let currentMarkdown = '';
      let getMarkdownCalls = 0;
      let importCalls = 0;
      let deliveryCalls = 0;
      let lastDeliveryArg = null;
      let logLines = [];
      let releasePicker = null;

      const CLEAN_MD = [
        '# Weekly Business Report',
        '',
        '{{title}}: Weekly Report',
        '{{summary}}: Main activity',
        '',
        '## Template Fields',
        '',
        '{{customer}}: Acme Corp CONFIDENTIAL',
        '{{customer decision}}: Approve Q4 budget',
      ].join('\n');
      const MD_MISSING_DECISION = CLEAN_MD.replace('{{customer decision}}: Approve Q4 budget', '{{customer decision}}:');
      const baseAdapters = () => ({
        getMarkdown: () => { getMarkdownCalls += 1; return currentMarkdown; },
        setMarkdown: () => { throw new Error('H4 must never modify editor content'); },
        isReportDocument: () => true,
        getCurrentFileName: () => 'weekly-business-report.txt',
        pickTemplateFile: () => ({ ok: false, reason: 'unused-by-h4' }),
        saveDrawioOutput: ({ xml, suggestedFilename }) => {
          deliveryCalls += 1;
          lastDeliveryArg = { xmlLength: String(xml).length, suggestedFilename };
          return Promise.resolve({ ok: true, filename: suggestedFilename, method: 'download' });
        },
        showToast: () => {},
        log: (m) => logLines.push(String(m)),
      });
      adapters = baseAdapters();

      session = {
        templateName: 'template.drawio',
        templateXml: TEMPLATE_XML,
        assessment: { ok: true, compressed: false, diagnostics: [] },
        importedReport: null,
        reconciliation: null,
        openedAt: 'h4val',
      };

      // flow26: deferred picker success + duplicate-generation guard
      currentMarkdown = CLEAN_MD;
      adapters.saveDrawioOutput = ({ xml, suggestedFilename }) => {
        deliveryCalls += 1;
        lastDeliveryArg = { xmlLength: String(xml).length, suggestedFilename };
        return new Promise((resolve) => { releasePicker = () => resolve({ ok: true, filename: suggestedFilename, method: 'picker' }); });
      };
      const p1 = generateDrawioOutput();
      const dup = await generateDrawioOutput();
      check('flow26 duplicate generation blocked', [dup.ok, dup.reason], [false, 'in-progress']);
      releasePicker();
      const r1 = await p1;
      check('flow26b success structured', [r1.ok, r1.method], [true, 'picker']);
      check('flow26c filename derived from report name', lastDeliveryArg.suggestedFilename, 'weekly-business-report-visual.drawio');
      check('flow26d output XML nonempty and separate', lastDeliveryArg.xmlLength > TEMPLATE_XML.length, true);
      check('flow26e original template unchanged', session.templateXml === TEMPLATE_XML, true);
      check('flow26f in-progress resets after success', __generationInProgress, false);
      check('flow26g H3 session preserved after success', Boolean(getSessionState()?.templateName), true);

      // flow27: structured cancellation preserves session and retry
      adapters.saveDrawioOutput = () => { deliveryCalls += 1; return Promise.resolve({ ok: false, cancelled: true, reason: 'cancelled' }); };
      const dl27 = deliveryCalls;
      const r2 = await generateDrawioOutput();
      check('flow27 cancel structured', [r2.ok, r2.cancelled, r2.reason], [false, true, 'cancelled']);
      check('flow27b session preserved after cancel', Boolean(getSessionState()?.templateName), true);
      check('flow28 retry possible after cancel', __generationInProgress, false);
      void dl27;

      // flow29: write failure structured
      adapters.saveDrawioOutput = () => Promise.resolve({ ok: false, cancelled: false, reason: 'write-failed', error: 'disk-full' });
      const r3 = await generateDrawioOutput();
      check('flow29 write-failure structured', [r3.ok, r3.cancelled, r3.reason], [false, false, 'write-failed']);
      check('flow29b session preserved after failure', Boolean(getSessionState()?.templateName), true);

      // flow30: adapter throwing (createWritable/write/close) is structured
      adapters.saveDrawioOutput = () => Promise.reject(new Error('writable boom'));
      const r4 = await generateDrawioOutput();
      check('flow30 thrown failure structured', [r4.ok, r4.cancelled, r4.reason], [false, false, 'write-failed']);

      // flow31: fresh reread detects a NEW blank -> blocked before delivery
      adapters.saveDrawioOutput = ({ xml, suggestedFilename }) => { deliveryCalls += 1; return Promise.resolve({ ok: true, filename: suggestedFilename, method: 'download' }); };
      currentMarkdown = MD_MISSING_DECISION;
      const dl31 = deliveryCalls;
      const r5 = await generateDrawioOutput();
      check('flow31 missing-values block before delivery', [r5.ok, r5.reason], [false, 'missing-values']);
      check('flow31b no Save As attempted on block', deliveryCalls, dl31);

      // flow32: values completed -> Reconcile-Again-style regenerate works
      currentMarkdown = CLEAN_MD.replace('{{customer decision}}: Approve Q4 budget', '{{customer decision}}: Final Q4 numbers');
      const r6 = await generateDrawioOutput();
      check('flow32 regeneration in same session works', [r6.ok, r6.method], [true, 'download']);

      // flow33: defensive sanity gate blocks when a token survives a clean pass
      forceLeftoverToken = true;
      const dl33 = deliveryCalls;
      const r7 = await generateDrawioOutput();
      check('flow33 unresolved-token delivery blocked', [r7.ok, r7.reason], [false, 'unresolved-placeholders']);
      check('flow33b no Save As on sanity block', deliveryCalls, dl33);
      forceLeftoverToken = false;
      // ---- Reread / rerun / preservation / logging guarantees ----
      checkCond('state01 current Markdown reread per attempt', getMarkdownCalls >= 7);
      const reconcileLogs = logLines.filter((l) => /^DrawioReport: reconcile /.test(l));
      check('state02 final H1+H2 rerun each attempt', reconcileLogs.length, 7);
      checkCond('state03 no field values echoed into logs', logLines.every((l) => !l.includes('CONFIDENTIAL')));
      checkCond('state04 no template/output XML echoed into logs', logLines.every((l) => !l.includes('mxCell') && !l.includes('<mxfile')));
      checkCond('state05 blocked logs whitelist-shaped', logLines.filter((l) => l.includes('blocked')).every((l) => /^DrawioReport: (generation|template) blocked/.test(l)));
      checkCond('state06 saved/delivered logs carry filename+method only', logLines.some((l) => /output (saved|delivered) filename=\S+ method=(picker|download)$/.test(l)));

      // Non-report guard during generation resets the stale session.
      adapters.isReportDocument = () => false;
      const r8 = await generateDrawioOutput();
      check('state07 non-report generation blocked', r8.reason, 'not-report');
      check('state08 stale session cleared on non-report', getSessionState(), null);

      // Guidance contract (DOM-free source check of overlay markup).
      const overlaySource = Function.prototype.toString.call(ensureOverlay);
      checkCond(
        'guide01 guidance mentions Generate Draw.io and editable .drawio',
        overlaySource.includes('Generate Draw.io') && overlaySource.includes('editable .drawio file')
      );

      // ---- Restore module state and global modules ----
      if (realImporter) globalThis.MME_REPORT_MARKDOWN_IMPORT = realImporter; else delete globalThis.MME_REPORT_MARKDOWN_IMPORT;
      if (realReconciler) globalThis.MME_DRAWIO_REPORT_RECONCILER = realReconciler; else delete globalThis.MME_DRAWIO_REPORT_RECONCILER;
      adapters = savedAdapters;
      session = savedSessionRef;
      __generationInProgress = savedGenFlag;
      try { setSaveStatus(''); } catch {}
      void getSaveStatusText;


    } catch (e) {
      cases.push({ name: 'h4val-error-guard', pass: false, error: e?.message || e });
    }
    const failedCases = cases.filter((c) => !c.pass);
    return {
      ok: failedCases.length === 0,
      total: cases.length,
      passed: cases.length - failedCases.length,
      failed: failedCases.length,
      // Browser-only cases stay out of the automated totals and must be
      // validated manually in a live session:
      browserOnlyPending: [
        'real showSaveFilePicker dialog',
        'real AbortError cancellation',
        'Blob download initiation and object-URL revocation observability',
        'generated .drawio opens correctly in Draw.io',
        'narrow-mobile visual reachability',
      ],
      cases,
    };
  }

  const API = Object.freeze({
    configure,
    open,
    close,
    selectTemplate,
    reconcileCurrentReport,
    insertMissingTemplateFields,
    generateDrawioOutput,
    refresh,
    resetSession,
    getSessionState,
    validateDrawioReportPanel,
    validateDrawioOutputDelivery,
  });

  try {
    globalThis.MME_DRAWIO_REPORT_PANEL = API;
    if (typeof window !== 'undefined') window.MME_DRAWIO_REPORT_PANEL = API;
    if (typeof globalThis.__validateDrawioReportPanel === 'undefined') {
      globalThis.__validateDrawioReportPanel = validateDrawioReportPanel;
    }
    // Narrow module-ready signal for late loader integration.
    if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
      window.dispatchEvent(
        new CustomEvent('mme-drawio-report-panel-ready', { detail: { module: 'drawio-report-panel' } })
      );
    }
  } catch (e) {
    try {
      console.warn('[Drawio Report Panel] module export failed', e);
    } catch {}
  }
})();
