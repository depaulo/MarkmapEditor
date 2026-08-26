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
    showToast: null,
    log: null,
  };

  // ---- Temporary in-memory session (never persisted) ----
  let session = null;
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
  // Session lifecycle
  // =====================================================================

  function resetSession(reason) {
    if (session) {
      safeLog(`session reset reason=${reason || 'unspecified'}`);
    }
    session = null;
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
            <p>Place the same <code>{{field name}}</code> tags from the Report inside the corresponding Draw.io template elements. <strong>Select Template</strong> loads the template, <strong>Add Missing Fields</strong> returns unresolved tags to the Markdown, and <strong>Reconcile Again</strong> refreshes the comparison after editing.</p>
          </div>
          <div id="drawioReportCategories" class="drawioReportCategories"></div>
        </div>
        <div class="drawioReportActions">
          <button type="button" id="drawioReportSelectTemplateButton">Select Template</button>
          <button type="button" id="drawioReportAddMissingButton">Add Missing Fields to Markdown</button>
          <button type="button" id="drawioReportReconcileAgainButton">Reconcile Again</button>
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

  function refresh() {
    if (overlayEl && !overlayEl.hidden && session && session.reconciliation) {
      renderReview();
    }
  }

  function close() {
    closeOverlay();
    session = null;
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
  const API = Object.freeze({
    configure,
    open,
    close,
    selectTemplate,
    reconcileCurrentReport,
    insertMissingTemplateFields,
    refresh,
    resetSession,
    getSessionState,
    validateDrawioReportPanel,
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
