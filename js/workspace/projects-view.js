// @ts-nocheck
// ACT 5C - Projects View: COMPACT TABLE + EXPANDABLE ROW DETAILS + GLOBAL
// DRAFT STATE + ONE GLOBAL APPLY / DISCARD.
//
// Dedicated Host workspace route (`projects`), SEPARATE from the Workspace
// Index. Read / Index / Sidebar stay read-only.
//
// This module owns VIEW STATE ONLY:
//   - search, filters, scroll, expanded rows
//   - draftsByProjectId (temporary, keyed by projectId, never persisted)
//   - one bounded last batch result / last error
//
// It never parses Project Markdown, never mutates Markdown, never calls Save,
// never writes a file and never creates a second Save path. Every real change
// leaves the view through ONE batch entry point on the visual adapter
// (MME_PROJECT_VISUAL_ADAPTER.applyProjectBatch), which orchestrates the
// accepted owners: visible source open -> pure mutation -> ONE buffer update ->
// ONE physical Save -> Index rebuild.
//
// ACT 5C-INTERACTION REDESIGN invariants:
//   - the collapsed row is compact and READ-ONLY (no inputs, no selectors);
//   - editing controls exist ONLY inside the single details region per row;
//   - unmanaged rows never render an input, a selector or a mutation action;
//   - there is NO per-row Apply and NO per-row Cancel;
//   - changing a control updates the DRAFT ONLY: no Save, no adapter call,
//     no Markdown mutation, no source open;
//   - Apply validates EVERY draft before any source transition starts;
//   - Source stays inside the Project row / details, never a second header.

(function initProjectsView(global) {
  'use strict';

  const HOST_ID = 'projects';
  const HOST_TITLE = 'Projects';
  const VIRTUAL_LOCATION_ID = 'mme://workspace/projects';
  const VIRTUAL_LOCATION_TYPE = 'virtual-projects';
  const CONTAINER_ID = 'projectsView';

  const STAGE_OPTIONS = [
    { value: 'funnel', label: 'Funnel' },
    { value: 'pipeline', label: 'Pipeline' },
    { value: 'quoted', label: 'Quoted' },
    { value: 'on-delivery', label: 'On Delivery' },
    { value: 'delivered', label: 'Delivered' },
  ];
  const STATE_OPTIONS = [
    { value: 'open', label: 'Open' },
    { value: 'on-hold', label: 'On Hold' },
    { value: 'completed', label: 'Completed' },
    { value: 'lost', label: 'Lost' },
    { value: 'canceled', label: 'Canceled' },
  ];
  const BASE_CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP', 'CNY'];

  // 'value' is the ONE logical Value + Currency pair.
  const DRAFT_FIELDS = ['stage', 'state', 'value', 'expectedOrder', 'expectedDelivery', 'expectedBilling'];
  const QUARTER_FIELDS = ['expectedOrder', 'expectedDelivery', 'expectedBilling'];
  const ALL = 'all';
  const VALUE_RE = /^\d+(?:\.\d+)?$/;   // canonical: no separators, no sign
  const CURRENCY_RE = /^[A-Za-z]{3}$/;
  const QUARTER_RE = /^\d{2}Q[1-4]$/;

  let registered = false;
  let refreshListenerBound = false;
  let previousWorkspace = null;

  // ---- view state (module-local; never persisted) ----
  const viewState = {
    search: '',
    filters: { stage: ALL, state: ALL, value: ALL, year: ALL, quarter: ALL, currency: ALL },
    scroll: 0,
    expandedKeys: [],
    applying: false,
    activeEdit: null,
    deferred: false,
    firstInvalidProjectId: '',
    lastError: '',
    lastBatchResult: null,
  };

  // ---- global draft owner: keyed by projectId, NEVER by title ----
  const draftsByProjectId = new Map();
  let draftsWorkspaceId = null;

  // Drafts are never persisted, so a page reload starts from a clean slate.
  let deferredRefresh = false;

  function safeLog(m) { try { if (typeof globalThis.MME_APP?.log === 'function') globalThis.MME_APP.log(m); } catch {} }
  function getHost() { return typeof globalThis.MME_WORKSPACE_HOST === 'object' ? globalThis.MME_WORKSPACE_HOST : null; }
  function getWorkspaceState() { return globalThis.WORKSPACE_STATE || globalThis.window?.WORKSPACE_STATE || null; }
  function utils() { return globalThis.MME_PROJECT_RECORD_UTILS || null; }
  function adapter() { return globalThis.MME_PROJECT_VISUAL_ADAPTER || null; }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function cssEscape(v) { return String(v).replace(/"/g, '\\"'); }

  // ---- read model (the Workspace Index read projection is the ONLY reader) ----
  function readProjects() {
    const st = globalThis.WORKSPACE_INDEX_STATE || globalThis.window?.WORKSPACE_INDEX_STATE;
    return Array.isArray(st?.projects) ? st.projects : [];
  }

  function keyOf(p) {
    const u = utils();
    return u ? u.projectRecordKey(p) : (p.projectId || `legacy:${p.sourcePath || ''}:${p.sourceLine || 0}`);
  }

  function decorate(p) {
    const u = utils();
    return {
      projectId: p.projectId || '',
      key: keyOf(p),
      managed: Boolean(p.projectId),
      name: p.name || '',
      value: p.value,
      currency: u ? u.normalizeProjectCurrencyCode(p.currency) : String(p.currency || '').toUpperCase(),
      orderValid: Boolean(p.expectedOrder && p.expectedOrder.valid),
      orderCanonical: p.expectedOrder && p.expectedOrder.valid ? p.expectedOrder.canonical : '',
      orderDisplay: p.expectedOrder && p.expectedOrder.valid ? (p.expectedOrder.display || '') : '',
      delivery: p.expectedDelivery && p.expectedDelivery.valid ? (p.expectedDelivery.display || '') : '',
      billing: p.expectedBilling && p.expectedBilling.valid ? (p.expectedBilling.display || '') : '',
      stage: p.stage || '',
      state: p.state || '',
      created: p.created || '',
      sourcePath: p.sourcePath || '',
      sourceLine: p.sourceLine || 0,
      sourceName: p.sourceName || '',
      sourceKind: p.sourceKind || 'notes',
      year: p.expectedOrder && p.expectedOrder.valid ? p.expectedOrder.year : null,
      quarter: p.expectedOrder && p.expectedOrder.valid ? p.expectedOrder.quarter : null,
    };
  }

  // ---- filters (persisted/indexed records ONLY - drafts never filter) ----
  function yearOptions(records) {
    const set = new Set();
    for (const r of records) if (Number.isFinite(r.year)) set.add(String(r.year));
    return Array.from(set).sort();
  }
  function currencyOptions(records) {
    const set = new Set(BASE_CURRENCIES);
    for (const r of records) if (r.currency) set.add(r.currency);
    return Array.from(set).sort();
  }
  function computeTotals(records) {
    let withValue = 0, withoutValue = 0;
    const byCurrency = new Map();
    for (const r of records) {
      if (Number.isFinite(r.value)) withValue += 1;
      else withoutValue += 1;
      if (Number.isFinite(r.value) && r.currency) {
        byCurrency.set(r.currency, (byCurrency.get(r.currency) || 0) + r.value);
      }
    }
    const totals = Array.from(byCurrency.entries())
      .map(([currency, totalValue]) => ({ currency, totalValue }))
      .sort((a, b) => a.currency.localeCompare(b.currency));
    return { withValue, withoutValue, totals };
  }
  function applyFilters(records) {
    const f = viewState.filters;
    const search = viewState.search.trim().toLowerCase();
    return records.filter((r) => {
      if (search && !String(r.name || '').toLowerCase().includes(search)) return false;
      if (f.stage !== ALL && r.stage !== f.stage) return false;
      if (f.state !== ALL && r.state !== f.state) return false;
      if (f.year !== ALL && String(r.year) !== String(f.year)) return false;
      if (f.quarter !== ALL && 'Q' + r.quarter !== f.quarter) return false;
      if (f.currency !== ALL && r.currency !== f.currency) return false;
      if (f.value === 'with' && !Number.isFinite(r.value)) return false;
      if (f.value === 'without' && Number.isFinite(r.value)) return false;
      return true;
    });
  }

  // ---- DRAFT OWNER ------------------------------------------------------
  // Draft state is VIEW state: no Markdown, no Index write, no adapter call,
  // no Save, never persisted, keyed by projectId (never by title).

  function fieldsOfRecord(r) {
    return {
      stage: String(r.stage || ''),
      state: String(r.state || ''),
      value: Number.isFinite(r.value) ? String(r.value) : '',
      currency: String(r.currency || ''),
      expectedOrder: String(r.orderDisplay || ''),
      expectedDelivery: String(r.delivery || ''),
      expectedBilling: String(r.billing || ''),
    };
  }
  function getDraft(projectId) { return draftsByProjectId.get(String(projectId || '')) || null; }

  function ensureDraft(record) {
    const id = String(record.projectId || '');
    if (!id) return null;
    if (!draftsByProjectId.has(id)) {
      const h = getHost();
      draftsWorkspaceId = h && typeof h.getActiveId === 'function' ? String(h.getActiveId() || '') : '';
      draftsByProjectId.set(id, {
        projectId: id,
        original: fieldsOfRecord(record),
        proposed: fieldsOfRecord(record),
        changedFields: [],
        validationErrors: {},
      });
    }
    const d = draftsByProjectId.get(id);
    d.sourcePath = record.sourcePath;
    d.sourceKind = record.sourceKind;
    d.sourceLine = record.sourceLine;
    d.key = record.key;
    return d;
  }

  function setDraftField(record, field, rawValue) {
    const d = ensureDraft(record);
    if (!d) return null;
    const value = field === 'value' ? String(rawValue == null ? '' : rawValue).trim() : String(rawValue == null ? '' : rawValue);
    if (field === 'value') {
      d.proposed.value = value;
      // Currency is part of the SAME logical pair, never an independent field.
      if (value !== '' && !d.proposed.currency) d.proposed.currency = d.original.currency;
    } else {
      d.proposed[field] = value;
    }
    recomputeChanged(d);
    return d;
  }

  function recomputeChanged(d) {
    const changed = [];
    for (const f of DRAFT_FIELDS) {
      if (f === 'value') {
        if (d.proposed.value !== d.original.value || d.proposed.currency !== d.original.currency) changed.push(f);
        continue;
      }
      if (String(d.proposed[f] || '') !== String(d.original[f] || '')) changed.push(f);
    }
    d.changedFields = changed;
    if (!changed.length) { delete d.validationErrors; draftsByProjectId.delete(d.projectId); }
    return d;
  }

  function pendingSummary() {
    let fields = 0;
    for (const d of draftsByProjectId.values()) fields += d.changedFields.length;
    return { projects: draftsByProjectId.size, fields };
  }

  function discardAllDrafts() {
    const n = draftsByProjectId.size;
    draftsByProjectId.clear();
    draftsWorkspaceId = null;
    viewState.firstInvalidProjectId = '';
    logDrafts('discard');
    return n;
  }

  function resetDraftsForWorkspaceChange() {
    if (!draftsByProjectId.size) return;
    draftsByProjectId.clear();
    draftsWorkspaceId = null;
    viewState.firstInvalidProjectId = '';
  }

  // Drafts survive route deactivate/reactivate in the SAME Workspace, but a
  // projectId that disappeared from the Index cannot stay a draft.
  function pruneDrafts() {
    const live = new Set(readProjects().filter((p) => p && p.projectId).map((p) => String(p.projectId)));
    for (const id of Array.from(draftsByProjectId.keys())) {
      if (!live.has(id)) draftsByProjectId.delete(id);
    }
  }

  function logDrafts(event) {
    const s = pendingSummary();
    let valid = true;
    for (const d of draftsByProjectId.values()) {
      if (d.validationErrors && Object.keys(d.validationErrors).length) valid = false;
    }
    safeLog(`ProjectsDraft: event=${event} projects=${s.projects} fields=${s.fields} valid=${valid}`);
  }

  // ---- local validation (VIEW ONLY: never mutates Markdown) --------------
  function legacyPreserved(d, field, canonicalList) {
    const original = String(d.original[field] || '');
    const proposed = String(d.proposed[field] || '');
    if (!proposed) return true;                       // cleared
    if (canonicalList.indexOf(proposed) !== -1) return true;
    return original === proposed;                      // explicit legacy preservation
  }

  function validateDraft(d) {
    const errors = {};
    const p = d.proposed;
    const hasValue = String(p.value || '') !== '';
    if (hasValue) {
      if (!VALUE_RE.test(String(p.value))) errors.value = 'Value must be a plain number such as 800000';
      if (!String(p.currency || '')) errors.currency = 'A value requires a currency';
      else if (!CURRENCY_RE.test(String(p.currency))) errors.currency = 'Currency must be a three-letter code';
    }
    for (const f of QUARTER_FIELDS) {
      const v = String(p[f] || '');
      if (v && !QUARTER_RE.test(v)) errors[f] = 'Quarter must look like 27Q3';
    }
    if (!legacyPreserved(d, 'stage', STAGE_OPTIONS.map((o) => o.value))) errors.stage = 'Unknown stage';
    if (!legacyPreserved(d, 'state', STATE_OPTIONS.map((o) => o.value))) errors.state = 'Unknown state';

    // Identity + source existence are validated BEFORE any execution starts.
    if (!d.projectId) errors.projectId = 'Project is not managed';
    const live = readProjects().filter((x) => x && String(x.projectId || '') === String(d.projectId));
    if (live.length === 0) errors.projectId = 'Project no longer exists in the Index';
    if (live.length > 1) errors.projectId = 'Duplicate projectId in the Index';
    if (!d.sourcePath) errors.source = 'Project has no source record';
    d.validationErrors = errors;
    return errors;
  }

  function validateAllDrafts() {
    const invalid = [];
    let fields = 0;
    for (const d of draftsByProjectId.values()) {
      fields += d.changedFields.length;
      const errs = validateDraft(d);
      if (Object.keys(errs).length) invalid.push(d.projectId);
    }
    return { valid: invalid.length === 0, invalid, projects: draftsByProjectId.size, fields };
  }

  // ---- deterministic application plan ------------------------------------
  // One entry per (projectId, field). Grouped by SOURCE FILE so the batch owner
  // performs one buffer update + one physical Save per source.
  function planForDraft(d) {
    const p = d.proposed;
    const ops = [];
    for (const f of d.changedFields) {
      if (f === 'value') {
        const v = String(p.value || '');
        const c = String(p.currency || '');
        if (!v && !c) ops.push({ operation: 'clearValueCurrency' });
        else ops.push({ operation: 'setValueCurrency', value: v, currency: c });
      } else if (f === 'stage') {
        ops.push(p.stage ? { operation: 'setStage', value: p.stage } : { operation: 'clearStage' });
      } else if (f === 'state') {
        ops.push(p.state ? { operation: 'setState', value: p.state } : { operation: 'clearState' });
      } else if (f === 'expectedOrder') {
        ops.push(p.expectedOrder ? { operation: 'setExpectedOrder', quarter: p.expectedOrder } : { operation: 'clearExpectedOrder' });
      } else if (f === 'expectedDelivery') {
        ops.push(p.expectedDelivery ? { operation: 'setExpectedDelivery', quarter: p.expectedDelivery } : { operation: 'clearExpectedDelivery' });
      } else if (f === 'expectedBilling') {
        ops.push(p.expectedBilling ? { operation: 'setExpectedBilling', quarter: p.expectedBilling } : { operation: 'clearExpectedBilling' });
      }
    }
    return ops;
  }

  function buildApplyPlan() {
    const projects = [];
    for (const d of draftsByProjectId.values()) {
      const ops = planForDraft(d);
      if (!ops.length) continue;
      projects.push({
        projectId: d.projectId,
        sourcePath: d.sourcePath,
        sourceKind: d.sourceKind,
        sourceLine: d.sourceLine,
        fieldCount: d.changedFields.length,
        operations: ops,
      });
    }
    // Deterministic order: source path, then projectId.
    projects.sort((a, b) => String(a.sourcePath).localeCompare(String(b.sourcePath)) || String(a.projectId).localeCompare(String(b.projectId)));
    const sources = [];
    for (const pr of projects) {
      const last = sources[sources.length - 1];
      if (last && last.sourcePath === pr.sourcePath) last.projects.push(pr);
      else sources.push({ sourcePath: pr.sourcePath, sourceKind: pr.sourceKind, projects: [pr] });
    }
    let fields = 0;
    for (const pr of projects) fields += pr.fieldCount;
    return { projects, sources, fieldCount: fields };
  }

  // ---- rendering ---------------------------------------------------------
  function opts(list, current, allLabel) {
    const isAll = String(current) === ALL || current == null || current === '';
    let out = `<option value="${ALL}"${isAll ? ' selected' : ''}>${escapeHtml(allLabel)}</option>`;
    for (const o of list) {
      const sel = String(o.value) === String(current) ? ' selected' : '';
      out += `<option value="${escapeHtml(o.value)}"${sel}>${escapeHtml(o.label)}</option>`;
    }
    return out;
  }
  function stateLabel(value) {
    const f = STATE_OPTIONS.find((x) => x.value === value);
    return f ? f.label : (value || '—');
  }
  function stageLabel(value) {
    const f = STAGE_OPTIONS.find((x) => x.value === value);
    return f ? f.label : (value || '—');
  }
  function legacyOption(list, current) {
    if (current && !list.some((o) => o.value === current)) {
      return `<option value="${escapeHtml(current)}" selected>Legacy: ${escapeHtml(current)}</option>`;
    }
    return '';
  }
  function quarterList() {
    const out = [];
    const now = new Date().getFullYear();
    for (let y = now + 1; y >= now - 3; y -= 1) {
      for (let q = 1; q <= 4; q += 1) out.push({ value: `${String(y).slice(-2)}Q${q}`, label: `${String(y).slice(-2)}Q${q}` });
    }
    return out;
  }

  // The displayed cell prefers the DRAFT when one exists, so a pending edit is
  // visible. Filters and totals keep using the persisted record.
  function displayFields(r) {
    const d = getDraft(r.projectId);
    return d ? d.proposed : {
      stage: r.stage, state: r.state, value: Number.isFinite(r.value) ? String(r.value) : '',
      currency: r.currency, expectedOrder: r.orderDisplay, expectedDelivery: r.delivery, expectedBilling: r.billing,
    };
  }

  function detailsControls(r, d, expanded) {
    const f = displayFields(r);
    const err = (d && d.validationErrors) || {};
    const errHtml = (field) => {
      const msg = err[field];
      return `<span class="projectsFieldError" role="alert" data-error-for="${escapeHtml(field)}" data-error-active="${msg ? 'true' : 'false'}">${escapeHtml(msg || '')}</span>`;
    };
    const fieldWrap = (label, control, field) => `
      <label class="projectsField">
        <span class="projectsFieldLabel">${escapeHtml(label)}</span>
        ${control}
        ${errHtml(field)}
      </label>`;
    const currencies = currencyOptions(readProjects().map(decorate)).map((c) => ({ value: c, label: c }));
    const qs = quarterList();
    const stageSel = `<select class="projectsCellSelect" data-field="stage" aria-label="Stage">${opts(STAGE_OPTIONS, f.stage, '—')}${legacyOption(STAGE_OPTIONS, f.stage)}</select>`;
    const stateSel = `<select class="projectsCellSelect" data-field="state" aria-label="State">${opts(STATE_OPTIONS, f.state, '—')}${legacyOption(STATE_OPTIONS, f.state)}</select>`;
    const valueInput = `<input class="projectsCellInput" type="text" inputmode="decimal" data-field="value" value="${escapeHtml(f.value)}" aria-label="Value" />`;
    const currencySel = `<select class="projectsCellSelect" data-field="currency" aria-label="Currency">${opts(currencies, f.currency, '—')}${legacyOption(currencies, f.currency)}<option value="__other__">Other…</option></select>`;
    const quarterSel = (field, current) => `<select class="projectsCellSelect" data-field="${field}" aria-label="${escapeHtml(field)}">${opts(qs, current, '—')}${legacyOption(qs, current)}<option value="__custom__">Custom…</option></select>`;
    const createdCell = r.created
      ? `<time datetime="${escapeHtml(r.created)}">${escapeHtml(r.created)}</time>`
      : '<span aria-label="No created date">—</span>';
    const sourceBtn = `<button type="button" class="projectsDetailSource" data-action="open-source"
      data-path="${escapeHtml(r.sourcePath)}" data-kind="${escapeHtml(r.sourceKind)}" data-line="${escapeHtml(String(r.sourceLine))}"
      aria-label="Open source for ${escapeHtml(r.name)}">${escapeHtml(r.sourceName || r.sourcePath || '—')}:${escapeHtml(String(r.sourceLine || ''))}</button>`;

    return `
      <div class="projectsDetailsFields" role="group" aria-label="Edit ${escapeHtml(r.name)}"${expanded ? '' : ' hidden'}>
        ${fieldWrap('Stage', stageSel, 'stage')}
        ${fieldWrap('State', stateSel, 'state')}
        ${fieldWrap('Value', valueInput, 'value')}
        ${fieldWrap('Currency', currencySel, 'currency')}
        ${fieldWrap('Expected Order', quarterSel('expectedOrder', f.expectedOrder), 'expectedOrder')}
        ${fieldWrap('Expected Delivery', quarterSel('expectedDelivery', f.expectedDelivery), 'expectedDelivery')}
        ${fieldWrap('Expected Billing', quarterSel('expectedBilling', f.expectedBilling), 'expectedBilling')}
        <span class="projectsDetailItem projectsDetailCreated">Created: ${createdCell}</span>
        <span class="projectsDetailItem">Source: ${sourceBtn}</span>
      </div>`;
  }

  function rowHtml(r, expandedKeys) {
    const d = getDraft(r.projectId);
    const f = displayFields(r);
    const expanded = expandedKeys.indexOf(r.key) !== -1;
    const changed = d ? d.changedFields : [];
    const changedAttr = changed.length ? ` data-changed-fields="${escapeHtml(changed.join(','))}"` : '';
    const managedTag = r.managed ? '' : '<span class="projectsUnmanagedTag" title="Not yet managed — open the source and Save">read-only</span>';
    const draftBadge = `<span class="projectsDraftBadge" data-draft-badge="${changed.length ? '1' : '0'}" aria-label="${changed.length} pending field change(s)">${changed.length ? changed.length + ' pending' : ''}</span>`;
    const valueText = f.value ? `${f.currency ? f.currency + ' ' : ''}${f.value}` : '—';
    const sourceText = `${r.sourceName || r.sourcePath || '—'}:${r.sourceLine || ''}`;
    const cell = (field) => (changed.indexOf(field) !== -1 ? ' projectsCellChanged' : '');

    // The collapsed row is READ-ONLY: no input, no selector, no per-row Apply.
    const primaryRow = `
      <div class="projectsRow${changed.length ? ' projectsRowChanged' : ''}" role="row" data-projects-key="${escapeHtml(r.key)}"
           data-projects-managed="${r.managed ? 'true' : 'false'}" data-row-state="${viewState.applying ? 'saving' : 'idle'}"${changedAttr}>
        <div class="projectsCell projectsCellToggle" role="cell" data-col="toggle">
          <button type="button" class="projectsExpandBtn" data-action="toggle-details"
            aria-expanded="${expanded ? 'true' : 'false'}"
            aria-controls="details-${escapeHtml(r.key)}"
            aria-label="${expanded ? 'Collapse' : 'Expand'} details for ${escapeHtml(r.name)}">${expanded ? '▾' : '▸'}</button>
        </div>
        <div class="projectsCell projectsCellTitle" role="cell" data-col="project">
          <span class="projectsRowName">${escapeHtml(r.name)}</span>${managedTag}${draftBadge}
        </div>
        <div class="projectsCell projectsCellStage${cell('stage')}" role="cell" data-col="stage">${escapeHtml(stageLabel(f.stage))}</div>
        <div class="projectsCell projectsCellState${cell('state')}" role="cell" data-col="state">${escapeHtml(stateLabel(f.state))}</div>
        <div class="projectsCell projectsCellValue${cell('value')}" role="cell" data-col="value">${escapeHtml(valueText)}</div>
        <div class="projectsCell projectsCellOrder${cell('expectedOrder')}" role="cell" data-col="order">${escapeHtml(f.expectedOrder || '—')}</div>
        <div class="projectsCell projectsCellSource" role="cell" data-col="source">
          <button type="button" class="projectsRowSource" data-action="open-source"
            data-path="${escapeHtml(r.sourcePath)}" data-kind="${escapeHtml(r.sourceKind)}"
            data-line="${escapeHtml(String(r.sourceLine))}"
            aria-label="Open source for ${escapeHtml(r.name)}">${escapeHtml(sourceText)}</button>
        </div>
      </div>`;

    const createdText = r.created
      ? escapeHtml(r.created)
      : '<span aria-label="No created date">\u2014</span>';

    // EXACTLY ONE details region per row.
    const body = r.managed
      ? `<div class="projectsDetailsInner" role="cell" data-col="details">${detailsControls(r, d, expanded)}</div>`
      : `<div class="projectsDetailsInner" role="cell" data-col="details">
          <div class="projectsDetailsReadOnly" role="group" aria-label="Read-only details">
            <span class="projectsDetailItem">Stage: ${escapeHtml(r.stage || '—')}</span>
            <span class="projectsDetailItem">State: ${escapeHtml(stateLabel(r.state))}</span>
            <span class="projectsDetailItem">Value: ${escapeHtml(Number.isFinite(r.value) ? ((r.currency ? r.currency + ' ' : '') + r.value) : '—')}</span>
            <span class="projectsDetailItem">Order: ${escapeHtml(r.orderDisplay || '—')}</span>
            <span class="projectsDetailItem">Delivery: ${escapeHtml(r.delivery || '—')}</span>
            <span class="projectsDetailItem">Billing: ${escapeHtml(r.billing || '—')}</span>
            <span class="projectsDetailItem">Created: ${createdText}</span>
            <span class="projectsDetailItem">Source: ${escapeHtml(sourceText)}</span>
          </div>
        </div>`;
    const details = `<div class="projectsRowDetails" role="row" id="details-${escapeHtml(r.key)}" data-details-for="${escapeHtml(r.key)}"${expanded ? '' : ' hidden'}>${body}</div>`;

    return primaryRow + details;
  }

  // ONE source of truth for the global Apply/Discard enabled state, shared by
  // the renderer and the local patcher so they can never disagree.
  function applyEnabled() {
    return pendingSummary().projects > 0 && !viewState.applying;
  }

  function changeBarHtml(summary) {
    const hasDrafts = summary.projects > 0;
    const disabled = applyEnabled() ? '' : ' disabled';
    const label = hasDrafts
      ? `${summary.projects} Project${summary.projects === 1 ? '' : 's'} changed · ${summary.fields} field${summary.fields === 1 ? '' : 's'}`
      : 'No pending Project changes';
    const busy = viewState.applying ? ' projectsChangeBarBusy' : '';
    return `
      <div class="projectsChangeBar${busy}" role="group" aria-label="Pending Project changes"
        data-projects-change-bar="1" data-pending-projects="${summary.projects}" data-pending-fields="${summary.fields}"
        data-applying="${viewState.applying ? 'true' : 'false'}">
        <span class="projectsChangeSummary" data-projects-change-summary="1" role="status" aria-live="polite">${escapeHtml(viewState.applying ? 'Applying changes…' : label)}</span>
        <button type="button" class="projectsDiscardBtn" data-action="discard-drafts"${disabled}>Discard changes</button>
        <button type="button" class="projectsApplyAllBtn" data-action="apply-drafts"${disabled}>Apply changes</button>
      </div>`;
  }

  function batchResultHtml(result) {
    if (!result) return '';
    const line = (label, value) => `<span class="projectsBatchLine">${escapeHtml(label)}: ${escapeHtml(String(value))}</span>`;
    return `
      <div class="projectsBatchResult" role="status" aria-live="polite" data-batch-outcome="${escapeHtml(result.outcome || '')}">
        ${line('Applied', `${result.appliedProjects} Project(s), ${result.appliedFields} field(s)`)}
        ${result.failedProjects ? line('Failed', `${result.failedProjects} Project(s) — ${result.reason || 'error'}`) : ''}
        ${result.pendingProjects ? line('Pending', `${result.pendingProjects} Project(s)`) : ''}
        ${result.sources ? line('Sources', result.sources) : ''}
      </div>`;
  }

  function readWorkspaceState() {
    const st = getWorkspaceState();
    return { state: st, available: Boolean(st && st.rootHandle) };
  }

  // The Workspace Index read model is the single Projects reader.
  function readProjectSource() {
    const st = globalThis.WORKSPACE_INDEX_STATE || globalThis.window?.WORKSPACE_INDEX_STATE;
    return { indexReady: Boolean(st && st.ready === true), projects: Array.isArray(st?.projects) ? st.projects : [] };
  }

  function buildProjection() {
    const wsRead = readWorkspaceState();
    if (!wsRead.available) return { html: renderEmpty('No Workspace is open.'), count: 0, ready: true, state: 'unavailable' };
    const src = readProjectSource();
    if (!src.indexReady) return { html: renderEmpty('Loading Projects…'), count: 0, ready: false, state: 'loading' };
    const all = src.projects.map(decorate);
    const u = utils();
    const ordered = u ? u.sortProjects(all) : all;
    const rows = applyFilters(ordered);
    const totals = computeTotals(rows);
    const summary = pendingSummary();

    if (!all.length) return { html: renderEmpty('No Projects yet.'), count: 0, ready: true, state: 'empty' };

    const f = viewState.filters;
    const filterHtml = `
      <div class="projectsFilters" role="group" aria-label="Project filters">
        <input class="projectsFilterSearch" type="search" data-filter="search" value="${escapeHtml(viewState.search)}" placeholder="Search projects" aria-label="Search projects" />
        <select class="projectsFilterSelect" data-filter="stage" aria-label="Stage filter">${opts(STAGE_OPTIONS, f.stage, 'All stages')}</select>
        <select class="projectsFilterSelect" data-filter="state" aria-label="State filter">${opts(STATE_OPTIONS, f.state, 'All states')}</select>
        <select class="projectsFilterSelect" data-filter="value" aria-label="Value filter">
          ${opts([{ value: 'with', label: 'With value' }, { value: 'without', label: 'Without value' }], f.value, 'All values')}
        </select>
        <select class="projectsFilterSelect" data-filter="year" aria-label="Expected Order year filter">
          ${opts(yearOptions(all).map((y) => ({ value: y, label: y })), f.year, 'All years')}
        </select>
        <select class="projectsFilterSelect" data-filter="quarter" aria-label="Expected Order quarter filter">
          ${opts([1, 2, 3, 4].map((q) => ({ value: 'Q' + q, label: 'Q' + q })), f.quarter, 'All quarters')}
        </select>
        <select class="projectsFilterSelect" data-filter="currency" aria-label="Currency filter">
          ${opts(currencyOptions(all).map((c) => ({ value: c, label: c })), f.currency, 'All currencies')}
        </select>
        <button type="button" class="projectsClearFilters" data-action="clear-filters" aria-label="Clear all filters">Clear filters</button>
      </div>`;

    // Totals always reflect the CURRENT FILTERED, PERSISTED result.
    const totalHtml = `
      <div class="projectsTotals" role="status" aria-live="polite">
        <span class="projectsTotalCount">${rows.length} of ${all.length} Projects</span>
        <span class="projectsTotalValue">With value: ${totals.withValue}</span>
        <span class="projectsTotalValue">Without value: ${totals.withoutValue}</span>
        ${totals.totals.map((t) => `<span class="projectsTotalCurrency">${escapeHtml(t.currency)} ${escapeHtml(String(t.totalValue))}</span>`).join('')}
      </div>`;

    const emptyHtml = rows.length ? '' : '<div class="projectsEmpty">No Projects match the current filters.</div>';

    // ONE header row. Source stays a column of the same logical row.
    const header = `
      <div class="projectsHeadRow" role="row">
        <span class="projectsHeadCell" role="columnheader"><span class="projectsVisuallyHidden">Expand</span></span>
        <span class="projectsHeadCell" role="columnheader">Project</span>
        <span class="projectsHeadCell" role="columnheader">Stage</span>
        <span class="projectsHeadCell" role="columnheader">State</span>
        <span class="projectsHeadCell" role="columnheader">Value</span>
        <span class="projectsHeadCell" role="columnheader">Order</span>
        <span class="projectsHeadCell" role="columnheader">Source</span>
      </div>`;

    const body = `
      <div class="projectsBody" data-projects-scroll-owner="1" tabindex="0" role="region" aria-label="Project list">
        <div class="projectsTable" role="table" aria-label="Projects">
          ${header}
          <div role="rowgroup">${rows.length ? rows.map((r) => rowHtml(r, viewState.expandedKeys)).join('') : emptyHtml}</div>
        </div>
      </div>`;

    const html = `
      <div class="projectsViewHead">
        <h2 class="projectsViewTitle">Projects</h2>
        <div class="projectsViewCount">${all.length} Project${all.length === 1 ? '' : 's'}</div>
      </div>
      ${filterHtml}
      ${totalHtml}
      ${body}
      ${changeBarHtml(summary)}
      ${batchResultHtml(viewState.lastBatchResult)}
      ${viewState.lastError ? `<div class="projectsError" role="alert">${escapeHtml(viewState.lastError)}</div>` : ''}`;

    return { html, count: rows.length, ready: true, total: all.length, state: rows.length ? 'ready' : 'filtered-empty', pending: summary };
  }

  function renderEmpty(message) {
    // The zero-result / unavailable state MUST keep filters and the global
    // change bar reachable.
    return `
      <div class="projectsViewHead"><h2 class="projectsViewTitle">Projects</h2></div>
      <div class="projectsFilters" role="group" aria-label="Project filters">
        <button type="button" class="projectsClearFilters" data-action="clear-filters" aria-label="Clear all filters">Clear filters</button>
      </div>
      <div class="projectsViewEmpty">${escapeHtml(message)}</div>
      ${changeBarHtml(pendingSummary())}`;
  }

  function ensureContainer() {
    let c = document.getElementById(CONTAINER_ID);
    if (c) return c;
    const layout = document.getElementById('layout');
    if (!layout) throw new Error('ProjectsView: #layout not found');
    c = document.createElement('div');
    c.id = CONTAINER_ID;
    c.className = 'projectsView';
    c.hidden = true;
    c.setAttribute('aria-label', 'Projects');
    layout.appendChild(c);
    safeLog('ProjectsView: container created');
    return c;
  }

  function renderInto(container) {
    const p = buildProjection();
    // Bounded diagnostic only: counts and lifecycle state, never content.
    safeLog(`ProjectsView: workspaceAvailable=${p.state !== 'unavailable'} indexReady=${p.ready} projects=${p.total != null ? p.total : (p.state === 'unavailable' || p.state === 'loading' ? 0 : p.count)} state=${p.state}`);
    container.innerHTML = p.html;
    container.insertAdjacentHTML('afterbegin',
      `<div class="projectsReturnRow"><button type="button" data-action="return-to-workspace" class="projectsReturnAction">← Return to Workspace</button></div>`);
    return p;
  }

  // ---- source navigation (correct accepted argument positions) ----------
  // openWorkspaceFile(file, kind, reason, options). The Projects path used to
  // pass the OPTIONS OBJECT in the KIND position, which produced
  // "kind=[object object]" and made every highlight miss.
  function openWorkspaceFileSafe(file, kind, reason, options) {
    const fn = typeof globalThis.openWorkspaceFile === 'function'
      ? globalThis.openWorkspaceFile
      : typeof globalThis.window?.openWorkspaceFile === 'function'
        ? globalThis.window.openWorkspaceFile
        : null;
    if (!fn) return Promise.resolve({ ok: false, reason: 'no-owner' });
    return Promise.resolve(fn(file, String(kind || ''), String(reason || ''), options || {}));
  }

  async function openProjectSource(path, kind, line) {
    const hostApi = getHost();
    if (!hostApi) return { ok: false, reason: 'no-host' };
    const rec = findWorkspaceFileByPath(path, kind);
    if (!rec) { globalThis.MME_APP?.showToast?.('File not found', 'warn', 2400); return { ok: false, reason: 'source-file-not-found' }; }
    try {
      await hostApi.switchTo('journal', { reason: 'projects source navigation' });
      const opened = await openWorkspaceFileSafe(rec, rec.kind || kind || 'notes', 'projects source navigation', {
        focusLine: Number(line) || 0,
      });
      if (opened && opened.cancelled) return { ok: false, reason: 'canceled' };
      focusSourceLine(Number(line) || 0);
      return { ok: true };
    } catch (e) {
      safeLog(`ProjectsView: source open failed reason=${String(e && e.message ? e.message : e)}`);
      return { ok: false, reason: 'open-failed' };
    }
  }

  // The accepted line-focus owner for an opened Note (same owner Task Review
  // uses). Kept deliberately narrow: it does not redesign navigation.
  function focusSourceLine(line) {
    const n = Number(line) || 0;
    if (!n) return false;
    try {
      const scroll = typeof globalThis.window?.__cmScrollToLine === 'function' ? globalThis.window.__cmScrollToLine : null;
      if (scroll) scroll(n - 1);
      const focus = typeof globalThis.window?.__cmFocus === 'function' ? globalThis.window.__cmFocus : null;
      if (focus) focus();
      return true;
    } catch { return false; }
  }

  function findWorkspaceFileByPath(p, k) {
    try { if (typeof globalThis.findWorkspaceFileByPath === 'function') return globalThis.findWorkspaceFileByPath(p, k); } catch {}
    return null;
  }

  // ---- GLOBAL APPLY ------------------------------------------------------
  // One batch owner call. Validation of EVERY draft happens BEFORE any source
  // transition, so an invalid draft starts nothing at all.
  async function applyAllDrafts() {
    const container = ensureContainer();
    if (viewState.applying) return Object.freeze({ ok: false, reason: 'already-applying' });

    const a = adapter();
    if (!a || typeof a.applyProjectBatch !== 'function') {
      viewState.lastError = 'Project editing is unavailable';
      renderInto(container);
      return Object.freeze({ ok: false, reason: 'no-owner' });
    }

    const validation = validateAllDrafts();
    safeLog(`ProjectsApply: phase=validate projects=${validation.projects} fields=${validation.fields} valid=${validation.valid}`);
    viewState.activeEdit = null;
    if (!validation.valid) {
      viewState.firstInvalidProjectId = validation.invalid[0] || '';
      viewState.lastError = 'Fix the highlighted fields before applying';
      // The first invalid Project is expanded and reachable; nothing else moves.
      const first = draftsByProjectId.get(viewState.firstInvalidProjectId);
      if (first && first.key && viewState.expandedKeys.indexOf(first.key) === -1) viewState.expandedKeys.push(first.key);
      renderInto(container);
      return Object.freeze({ ok: false, reason: 'invalid-drafts', invalid: validation.invalid.slice() });
    }

    const plan = buildApplyPlan();
    if (!plan.projects.length) {
      viewState.lastError = '';
      renderInto(container);
      return Object.freeze({ ok: false, reason: 'no-drafts' });
    }

    viewState.applying = true;
    viewState.lastError = '';
    viewState.lastBatchResult = null;
    renderInto(container);

    let result;
    try {
      result = await a.applyProjectBatch(plan);
    } catch (e) {
      result = {
        ok: false, outcome: 'failed', reason: 'batch-owner-failed',
        appliedProjects: 0, appliedFields: 0, failedProjects: plan.projects.length,
        pendingProjects: plan.projects.length, sources: plan.sources.length,
        diagnostics: [{ code: 'threw', detail: String(e && e.message ? e.message : e) }],
      };
    }
    viewState.applying = false;

    const appliedIds = new Set((result && result.appliedProjectIds) || []);
    for (const id of Array.from(draftsByProjectId.keys())) {
      if (appliedIds.has(id)) draftsByProjectId.delete(id);
    }
    const remaining = pendingSummary();
    viewState.firstInvalidProjectId = '';
    viewState.lastBatchResult = {
      outcome: (result && result.outcome) || 'failed',
      appliedProjects: (result && result.appliedProjects) || 0,
      appliedFields: (result && result.appliedFields) || 0,
      failedProjects: (result && result.failedProjects) || 0,
      pendingProjects: remaining.projects,
      sources: (result && result.sources) || 0,
      reason: (result && result.reason) || '',
    };
    safeLog(`ProjectsApply: phase=${viewState.lastBatchResult.outcome} projects=${plan.projects.length} sources=${plan.sources.length} applied=${viewState.lastBatchResult.appliedProjects} failed=${viewState.lastBatchResult.failedProjects} pending=${remaining.projects}`);
    renderInto(container);

    if (remaining.projects) {
      // Keep the failed/unprocessed Projects reachable and identifiable.
      for (const d of draftsByProjectId.values()) {
        if (d.key && viewState.expandedKeys.indexOf(d.key) === -1) viewState.expandedKeys.push(d.key);
      }
      renderInto(container);
    }
    return Object.freeze(Object.assign({ ok: Boolean(result && result.ok) }, viewState.lastBatchResult));
  }

  function handleReturnToWorkspace() {
    const hostApi = getHost();
    if (!hostApi) return;
    hostApi.switchTo('journal', { reason: 'projects return' }).catch(() => {});
  }

  function rowRecordByKey(key) {
    return readProjects().map(decorate).find((x) => x.key === key) || null;
  }

  function toggleDetails(key) {
    const i = viewState.expandedKeys.indexOf(key);
    if (i === -1) viewState.expandedKeys.push(key);
    else viewState.expandedKeys.splice(i, 1);
  }

  function onActionClick(event) {
    const btn = event.target && event.target.closest ? event.target.closest('[data-action]') : null;
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const key = (btn.closest('[data-projects-key]') || {}).getAttribute
      ? btn.closest('[data-projects-key]').getAttribute('data-projects-key') : '';

    if (action === 'return-to-workspace') { event.preventDefault(); handleReturnToWorkspace(); return; }
    if (action === 'open-source') {
      event.preventDefault();
      openProjectSource(btn.getAttribute('data-path'), btn.getAttribute('data-kind'), Number(btn.getAttribute('data-line')) || 0);
      return;
    }
    if (action === 'toggle-details') { event.preventDefault(); toggleDetails(key); renderInto(ensureContainer()); return; }
    if (action === 'clear-filters') {
      event.preventDefault();
      viewState.search = '';
      viewState.filters = { stage: ALL, state: ALL, value: ALL, year: ALL, quarter: ALL, currency: ALL };
      renderInto(ensureContainer());
      return;
    }
    if (action === 'discard-drafts') {
      event.preventDefault();
      // Discards VIEW drafts only. It never touches the active Note, never
      // mutates Markdown and never Saves.
      discardAllDrafts();
      viewState.lastError = '';
      viewState.lastBatchResult = null;
      renderInto(ensureContainer());
      return;
    }
    if (action === 'apply-drafts') {
      event.preventDefault();
      applyAllDrafts();
      return;
    }
  }

  // A control change updates the DRAFT ONLY. It never Saves, never calls the
  // adapter, never opens a source and never mutates Markdown.
  function onFieldControlChange(event) {
    const el = event.target;
    if (!el || typeof el.getAttribute !== 'function') return;
    const field = el.getAttribute('data-field');
    if (!field) return false;
    const holder = el.closest('[data-projects-key]') || el.closest('[data-details-for]');
    const key = holder ? (holder.getAttribute('data-projects-key') || holder.getAttribute('data-details-for') || '') : '';
    const record = rowRecordByKey(key);
    if (!record || !record.managed) return false;

    let raw = String(el.value == null ? '' : el.value);
    if (raw === '__custom__') {
      const entered = typeof globalThis.prompt === 'function' ? globalThis.prompt('Quarter, for example 27Q3') : null;
      raw = entered == null ? String(recordKeyedOriginal(record, field)) : String(entered).trim().toUpperCase();
    } else if (raw === '__other__') {
      const entered = typeof globalThis.prompt === 'function' ? globalThis.prompt('Currency code, for example BRL') : null;
      raw = entered == null ? String(recordKeyedOriginal(record, 'currency')) : String(entered).trim().toUpperCase();
    } else if (raw === ALL) {
      raw = '';
    }

    setDraftField(record, field, raw);
    viewState.activeEdit = { key: record.key, field, at: Date.now() };
    logDrafts('change');
    // ACT 5C device correction: patch the DOM IN PLACE. The focused control,
    // its caret and its selection are never replaced, so sequential typing
    // keeps focus with no focus-restore trick and no full rerender.
    patchRowForKey(record.key);
    patchChangeBar();
    return true;
  }

  // ---- local DOM patching (no rerender, no focus loss) ----
  // ACT 5C browser correction: querySelectorAll() returns a real NodeList,
  // which has NO Array#find (the shipped crash: `c.querySelectorAll(...).find
  // is not a function`). One intention-revealing bounded scan serves every
  // lookup below: no Array.from() conversion of the whole container collection
  // on each keystroke, no selector-escaping pitfalls, identical behaviour in
  // the browser and in the harness.
  function childByAttr(root, attr, value) {
    if (!root) return null;
    const nodes = root.querySelectorAll('[' + attr + ']');
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      if (node && typeof node.getAttribute === 'function' && node.getAttribute(attr) === value) return node;
    }
    return null;
  }
  function rowElement(key) {
    return childByAttr(document.getElementById(CONTAINER_ID), 'data-projects-key', key);
  }
  function detailsElement(key) {
    return childByAttr(document.getElementById(CONTAINER_ID), 'data-details-for', key);
  }
  function cellOf(row, col) {
    return childByAttr(row, 'data-col', col);
  }
  function setCellClass(el, on, className) {
    if (!el) return;
    if (on) el.classList.add(className);
    else el.classList.remove(className);
  }

  // Refresh ONLY the derived, non-input state of one row and its details.
  // The focused control node is never touched.
  function patchRowForKey(key) {
    const record = rowRecordByKey(key);
    if (!record) return false;
    const row = rowElement(key);
    if (!row) return false;
    const details = detailsElement(key);
    const d = getDraft(record.projectId);
    const changed = d ? d.changedFields : [];
    const f = displayFields(record);
    const errs = (d && d.validationErrors) || {};

    row.setAttribute('data-changed-fields', changed.join(','));
    row.setAttribute('data-draft-count', String(changed.length));
    setCellClass(row, changed.length > 0, 'projectsRowChanged');

    const title = cellOf(row, 'project');
    if (title) {
      const badge = title.querySelectorAll('[data-draft-badge]')[0];
      if (badge) {
        badge.setAttribute('data-draft-badge', changed.length ? '1' : '0');
        badge.textContent = changed.length ? `${changed.length} pending` : '';
      }
    }
    setCellClass(cellOf(row, 'stage'), changed.indexOf('stage') !== -1, 'projectsCellChanged');
    setCellClass(cellOf(row, 'state'), changed.indexOf('state') !== -1, 'projectsCellChanged');
    setCellClass(cellOf(row, 'value'), changed.indexOf('value') !== -1, 'projectsCellChanged');
    setCellClass(cellOf(row, 'order'), changed.indexOf('expectedOrder') !== -1, 'projectsCellChanged');

    const stageCell = cellOf(row, 'stage');
    if (stageCell) stageCell.textContent = stageLabel(f.stage);
    const stateCell = cellOf(row, 'state');
    if (stateCell) stateCell.textContent = stateLabel(f.state);
    const valueCell = cellOf(row, 'value');
    if (valueCell) valueCell.textContent = f.value ? `${f.currency ? f.currency + ' ' : ''}${f.value}` : '—';
    const orderCell = cellOf(row, 'order');
    if (orderCell) orderCell.textContent = f.expectedOrder || '—';

    if (details) {
      for (const ef of ['stage', 'state', 'value', 'expectedOrder', 'expectedDelivery', 'expectedBilling', 'currency']) {
        const errEl = childByAttr(details, 'data-error-for', ef);
        if (!errEl) continue;
        const msg = errs[ef];
        errEl.setAttribute('data-error-active', msg ? 'true' : 'false');
        errEl.textContent = msg || '';
      }
      setCellClass(details, Object.keys(errs).length > 0, 'projectsRowInvalid');
    }
    return true;
  }

  function patchChangeBar() {
    const c = document.getElementById(CONTAINER_ID);
    if (!c) return false;
    const bar = c.querySelectorAll('[data-projects-change-bar]')[0];
    if (!bar) return false;
    const s = pendingSummary();
    bar.setAttribute('data-pending-projects', String(s.projects));
    bar.setAttribute('data-pending-fields', String(s.fields));
    const label = bar.querySelectorAll('[data-projects-change-summary]')[0];
    if (label) {
      label.textContent = s.projects
        ? `${s.projects} Project${s.projects === 1 ? '' : 's'} changed · ${s.fields} field${s.fields === 1 ? '' : 's'}`
        : 'No pending Project changes';
    }
    const enabled = applyEnabled();
    const applyBtn = bar.querySelectorAll('[data-action="apply-drafts"]')[0];
    if (applyBtn) {
      if (enabled) applyBtn.removeAttribute('disabled');
      else applyBtn.setAttribute('disabled', 'disabled');
    }
    const discardBtn = bar.querySelectorAll('[data-action="discard-drafts"]')[0];
    if (discardBtn) {
      if (enabled) discardBtn.removeAttribute('disabled');
      else discardBtn.setAttribute('disabled', 'disabled');
    }
    return true;
  }

  function recordKeyedOriginal(record, field) {
    const d = getDraft(record.projectId);
    const src = d ? d.original : fieldsOfRecord(record);
    if (field === 'value') return src.currency;
    return src[field] == null ? '' : src[field];
  }

  function onFilterChange(event) {
    const el = event.target;
    if (!el || typeof el.getAttribute !== 'function') return;
    const kind = el.getAttribute('data-filter');
    if (!kind) return;
    if (kind === 'search') viewState.search = String(el.value || '');
    else viewState.filters[kind] = String(el.value == null ? ALL : el.value);
    renderInto(ensureContainer());
  }

  function onControlEvent(event) {
    if (onFieldControlChange(event)) return;
    onFilterChange(event);
  }

  function onControlKeydown(event) {
    const el = event.target;
    if (!el || typeof el.getAttribute !== 'function') return;
    const field = el.getAttribute('data-field');
    if (!field) return;
    const holder = el.closest('[data-projects-key]') || el.closest('[data-details-for]');
    const key = holder ? (holder.getAttribute('data-projects-key') || holder.getAttribute('data-details-for') || '') : '';
    const record = rowRecordByKey(key);
    if (!record || !record.managed) return;

    if (event.key === 'Enter') {
      // Validates the LOCAL field only. It never bypasses the global Apply and
      // it never replaces the control the user is typing in.
      const d = getDraft(record.projectId);
      if (d) validateDraft(d);
      patchRowForKey(record.key);
      patchChangeBar();
      return;
    }
    if (event.key === 'Escape') {
      // Restores the CURRENT FIELD only. Markdown is untouched.
      const d = getDraft(record.projectId);
      if (d) {
        if (field === 'value') { d.proposed.value = d.original.value; d.proposed.currency = d.original.currency; }
        else d.proposed[field] = d.original[field];
        recomputeChanged(d);
        const el2 = controlInDetails(record.key, field);
        if (el2) el2.value = field === 'value' ? d.original.value : String(d.original[field] || '');
      }
      logDrafts('escape');
      patchRowForKey(record.key);
      patchChangeBar();
    }
  }

  function controlInDetails(key, field) {
    const details = detailsElement(key);
    return childByAttr(details, 'data-field', field);
  }

  // Delegated handlers are bound per MODULE LOAD: a reloaded view instance owns
  // its own listeners instead of silently inheriting a previous instance's, and
  // the previous instance's listeners are detached so only ONE view is live.
  const BIND_TOKEN = 'pview-' + Math.random().toString(36).slice(2);
  const HANDLERS = { click: onActionClick, change: onControlEvent, input: onControlEvent, keydown: onControlKeydown };

  function bindContainer(container) {
    const prev = container.__projectsHandlers;
    if (prev && container.__projectsBindToken !== BIND_TOKEN) {
      for (const type of Object.keys(prev)) {
        try { container.removeEventListener(type, prev[type]); } catch {}
      }
    }
    if (container.__projectsBindToken === BIND_TOKEN) return;
    for (const type of Object.keys(HANDLERS)) container.addEventListener(type, HANDLERS[type]);
    container.__projectsHandlers = HANDLERS;
    container.__projectsBindToken = BIND_TOKEN;
  }

  // ---- lifecycle ----
  async function activate() {
    const hostApi = getHost();
    const activeId = hostApi ? String(hostApi.getActiveId() || '') : '';
    // Drafts never cross a Workspace boundary.
    if (draftsByProjectId.size && draftsWorkspaceId && activeId && activeId !== draftsWorkspaceId) resetDraftsForWorkspaceChange();
    if (previousWorkspace !== null && activeId !== previousWorkspace) resetDraftsForWorkspaceChange();
    previousWorkspace = activeId;

    let container;
    try { container = ensureContainer(); } catch (e) { throw new Error(`ProjectsView.activate: ${e?.message || e}`); }

    bindContainer(container);

    renderInto(container);
    container.hidden = false;
    document.documentElement.classList.add('projects-view-active');

    if (typeof globalThis.MME_NAVIGATION === 'object') {
      globalThis.MME_NAVIGATION.recordSuccessfulNavigation({ type: VIRTUAL_LOCATION_TYPE, id: VIRTUAL_LOCATION_ID });
    }
    bindRefreshListener();
    return Object.freeze({ activated: true });
  }

  function deactivate() {
    const c = document.getElementById(CONTAINER_ID);
    if (c) c.hidden = true;
    document.documentElement.classList.remove('projects-view-active');
    // Drafts intentionally SURVIVE deactivate/reactivate in the same Workspace.
    return Object.freeze({ status: 'deactivated' });
  }

  function refresh() {
    const c = document.getElementById(CONTAINER_ID);
    if (!c) return Object.freeze({ status: 'skipped', reason: 'no-container' });
    // A destructive refresh during an active edit would destroy the focused
    // control: defer it and reconcile after Apply / Discard / blur.
    if (isEditActive()) {
      deferredRefresh = true;
      pruneDrafts();
      return Object.freeze({ status: 'deferred' });
    }
    pruneDrafts();
    renderInto(c);
    deferredRefresh = false;
    return Object.freeze({ status: 'refreshed' });
  }

  function isEditActive() {
    if (viewState.applying) return true;
    const ae = viewState.activeEdit;
    if (!ae || !ae.at) return false;
    return (Date.now() - ae.at) < 30000;
  }

  function refreshRoute() {
    const c = document.getElementById(CONTAINER_ID);
    if (!c || c.hidden) return false;
    pruneDrafts();
    renderInto(c);
    deferredRefresh = false;
    return true;
  }

  // Reconcile a deferred Index refresh once the edit is finished.
  function reconcileDeferred() {
    if (!deferredRefresh) return false;
    const c = document.getElementById(CONTAINER_ID);
    if (!c) return false;
    pruneDrafts();
    renderInto(c);
    deferredRefresh = false;
    return true;
  }

  function detach() { return Object.freeze({ status: 'detached' }); }
  function getState() {
    const c = document.getElementById(CONTAINER_ID);
    return Object.freeze({ visible: Boolean(c && !c.hidden), projectCount: readProjects().length, pending: pendingSummary() });
  }
  function restoreState(state) {
    if (!state || !state.visible) return;
    const c = document.getElementById(CONTAINER_ID);
    if (c) { c.hidden = false; document.documentElement.classList.add('projects-view-active'); }
  }

  function onWorkspaceIndexReady() {
    const c = document.getElementById(CONTAINER_ID);
    if (!c || c.hidden) return;
    refresh();
  }
  function bindRefreshListener() {
    if (refreshListenerBound) return;
    window.addEventListener('mme-workspace-index-ready', onWorkspaceIndexReady);
    refreshListenerBound = true;
  }

  function resetViewState() {
    viewState.search = '';
    viewState.filters = { stage: ALL, state: ALL, value: ALL, year: ALL, quarter: ALL, currency: ALL };
    viewState.expandedKeys = [];
    viewState.applying = false;
    viewState.lastError = '';
    viewState.lastBatchResult = null;
    draftsByProjectId.clear();
    draftsWorkspaceId = null;
  }

  function buildDescriptor() {
    return Object.freeze({
      id: HOST_ID, title: HOST_TITLE,
      activate, deactivate, refresh, detach, getState, restoreState,
    });
  }

  function registerProjectsView() {
    if (registered) return null;
    const hostApi = getHost();
    if (!hostApi) return null;
    try {
      hostApi.register(buildDescriptor());
      registered = true;
      safeLog('ProjectsView: registered=true');
      return true;
    } catch (e) { safeLog(`ProjectsView: registration failed: ${e?.message || e}`); return null; }
  }

  function setFilter(dim, value) {
    if (dim === 'search') { viewState.search = String(value == null ? '' : value); return true; }
    if (!Object.prototype.hasOwnProperty.call(viewState.filters, dim)) return false;
    viewState.filters[dim] = String(value == null ? ALL : value);
    return true;
  }

  function clearFilters() {
    viewState.search = '';
    viewState.filters = { stage: ALL, state: ALL, value: ALL, year: ALL, quarter: ALL, currency: ALL };
    return true;
  }

  globalThis.MME_PROJECTS_VIEW = Object.freeze({
    HOST_ID, HOST_TITLE, CONTAINER_ID,
    getDescriptor: buildDescriptor,
    register: registerProjectsView,
    isRegistered: () => registered,
    refreshRoute,
    resetViewState,
    setFilter,
    clearFilters,
    getViewState: () => JSON.parse(JSON.stringify(viewState)),
    buildProjection,
    applyFilters,
    computeTotals,
    decorate,
    readWorkspaceState,
    readProjectSource,
    // draft owner (test/inspection surface; still view-only state)
    getDrafts: () => JSON.parse(JSON.stringify(Array.from(draftsByProjectId.values()))),
    getPendingSummary: pendingSummary,
    setDraftFieldForKey: (key, field, value) => {
      const rec = rowRecordByKey(key);
      return rec && rec.managed ? Boolean(setDraftField(rec, field, value)) : false;
    },
    validateAllDrafts,
    buildApplyPlan,
    applyPendingChanges: applyAllDrafts,
    discardPendingChanges: () => discardAllDrafts(),
    openProjectSource,
  });

  registerProjectsView();
})();
