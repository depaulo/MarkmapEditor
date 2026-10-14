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

  // ---- ACT 5D presentation state (ONE narrow owner) -----------------------
  // presentationSnapshot: the pre-Projects REPAIR source (§10). Presentation
  // fields only — never document content, never file handles.
  let presentationSnapshot = null;
  // inspectionActive: explicit Projects source inspection under the smaller
  // model (§5): the source is open in the normal Workspace and exactly one
  // persistent `Back to Projects` recovery action is armed.
  let inspectionActive = false;

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
  let draftsWorkspaceKey = null;

  // Drafts are never persisted, so a page reload starts from a clean slate.
  let deferredRefresh = false;

  function safeLog(m) { try { if (typeof globalThis.MME_APP?.log === 'function') globalThis.MME_APP.log(m); } catch {} }
  function getHost() { return typeof globalThis.MME_WORKSPACE_HOST === 'object' ? globalThis.MME_WORKSPACE_HOST : null; }
  function getWorkspaceState() { return globalThis.WORKSPACE_STATE || globalThis.window?.WORKSPACE_STATE || null; }
  // ACT 5D: drafts belong to the WORKSPACE root, never to a host route id.
  // The route-id comparison previously cleared staged drafts on every Apply
  // round-trip under real Host ordering (id committed AFTER activate).
  function currentWorkspaceKey() {
    const st = getWorkspaceState();
    return st && st.rootHandle ? String(st.rootName || '') : '';
  }
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
      orderDisplay: p.expectedOrder ? (p.expectedOrder.valid ? (p.expectedOrder.display || '') : (p.expectedOrder.raw || '')) : '',
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
      draftsWorkspaceKey = currentWorkspaceKey();
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
    draftsWorkspaceKey = null;
    viewState.firstInvalidProjectId = '';
    logDrafts('discard');
    return n;
  }

  function resetDraftsForWorkspaceChange() {
    if (!draftsByProjectId.size) return;
    draftsByProjectId.clear();
    draftsWorkspaceKey = null;
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
    // ACT 5D-FU s4/s14: view/mutation parity through the ONE shared
    // normalizer, applied to ALL THREE quarter fields (Order, Delivery,
    // Billing). Only a CHANGED structured value can be invalid: an unchanged
    // legacy/custom value is PRESERVED (never an error), partial markers
    // ("2029-"/"-Q3") block Apply with guidance, and an explicit Clear
    // (empty) is a valid structured state.
    for (const f of ['expectedOrder', 'expectedDelivery', 'expectedBilling']) {
      if (d.changedFields.indexOf(f) === -1) continue;
      const orderVal = String(p[f] || '');
      if (!orderVal) continue;
      const nq = normalizeQuarterValue(orderVal);
      if (!nq.valid) {
        if (/^\d{4}-$/.test(orderVal)) errors[f] = `Select a quarter for ${orderVal.slice(0, 4)}, or Clear`;
        else if (/^-Q[1-4]$/i.test(orderVal)) errors[f] = `Select a year for ${orderVal.slice(1).toUpperCase()}, or Clear`;
        else errors[f] = 'Choose a year 2020-2100 and a quarter Q1-Q4, or Clear';
      }
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
        // ACT 5D s14 parity: the Value + Currency pair is atomic. An empty
        // value ALWAYS clears the pair, so a view-valid plan can never reach
        // the mutation owner as setValueCurrency('', code) -> invalid-value.
        if (!v) ops.push({ operation: 'clearValueCurrency' });
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
  // ACT 5D-FU: quarterList()/quarterSel()/__custom__ retired — all three
  // quarter fields use the ONE structured contract above.

  // The displayed cell prefers the DRAFT when one exists, so a pending edit is
  // visible. Filters and totals keep using the persisted record.
  function displayFields(r) {
    const d = getDraft(r.projectId);
    return d ? d.proposed : {
      stage: r.stage, state: r.state, value: Number.isFinite(r.value) ? String(r.value) : '',
      currency: r.currency, expectedOrder: r.orderDisplay, expectedDelivery: r.delivery, expectedBilling: r.billing,
    };
  }

  // ACT 5D shared normalizer facade: the ONE production owner is
  // normalizeProjectQuarter() (workspace-parser.js). A missing owner is
  // invalid here exactly as in the mutation owner - view/mutation parity.
  function normalizeQuarterValue(v) {
    try {
      if (typeof globalThis.normalizeProjectQuarter === 'function') {
        return globalThis.normalizeProjectQuarter(String(v == null ? '' : v));
      }
    } catch {}
    return { raw: String(v == null ? '' : v), canonical: null, display: String(v == null ? '' : v), year: null, quarter: null, valid: false };
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
    // ACT 5D-FU s4: ONE structured Year + Quarter control contract shared by
    // Expected Order, Expected Delivery and Expected Billing. Label renders on
    // the first line, compact Year + Quarter sit side by side on the second
    // line. The empty option "—" is the ONLY Clear affordance (no Clear
    // button): selecting "—" in EITHER select clears the COMPLETE field and
    // both controls. Partial states stay visible but block Apply; Cancel
    // restores persisted values. Legacy values stay visible until explicit
    // replacement or clearing. Year range: fixed product floor 2020 to 2100
    // (never derived from the current year).
    const yearOptions = (() => {
      const out = [];
      for (let y = 2020; y <= 2100; y += 1) out.push({ value: String(y), label: String(y) });
      return out;
    })();
    const quarterOptions = [
      { value: 'Q1', label: 'Q1' }, { value: 'Q2', label: 'Q2' },
      { value: 'Q3', label: 'Q3' }, { value: 'Q4', label: 'Q4' },
    ];
    const quarterStructured = (field, current) => {
      const parsed = normalizeQuarterValue(current);
      const legacy = Boolean(current) && !parsed.valid && !/^(\d{4}-|-Q[1-4])$/i.test(String(current));
      // ACT 5D-FU: partial markers (year-only "2029-" / quarter-only "-Q3")
      // keep the FIRST selection visible while the companion is still empty;
      // they are not valid values and block Apply until completed or cleared.
      const partialYear = /^(\d{4})-$/.exec(String(current || ''));
      const partialQ = /^-Q([1-4])$/i.exec(String(current || ''));
      const yearVal = parsed.valid && !legacy ? String(parsed.year || '') : (partialYear ? partialYear[1] : '');
      const qVal = parsed.valid && !legacy ? `Q${parsed.quarter}` : (partialQ ? `Q${partialQ[1].toUpperCase()}` : '');
      const yearSel = `<select class="projectsCellSelect projectsQuarterYear" data-field="${field}" data-quarter-part="year" aria-label="${escapeHtml(field)} Year">${opts(yearOptions, yearVal, '—')}</select>`;
      const qSel = `<select class="projectsCellSelect projectsQuarterQuarter" data-field="${field}" data-quarter-part="quarter" aria-label="${escapeHtml(field)} Quarter">${opts(quarterOptions, qVal, '—')}</select>`;
      const legacyNote = legacy ? `<span class="projectsQuarterLegacy" data-quarter-legacy="1">Custom: ${escapeHtml(current)}</span>` : '';
      return `<span class="projectsQuarterPair" data-quarter-field="${field}">${yearSel}${qSel}${legacyNote}</span>`;
    };
    const stageSel = `<select class="projectsCellSelect" data-field="stage" aria-label="Stage">${opts(STAGE_OPTIONS, f.stage, '—')}${legacyOption(STAGE_OPTIONS, f.stage)}</select>`;
    const stateSel = `<select class="projectsCellSelect" data-field="state" aria-label="State">${opts(STATE_OPTIONS, f.state, '—')}${legacyOption(STATE_OPTIONS, f.state)}</select>`;
    const valueInput = `<input class="projectsCellInput" type="text" inputmode="decimal" data-field="value" value="${escapeHtml(f.value)}" aria-label="Value" />`;
    const currencySel = `<select class="projectsCellSelect" data-field="currency" aria-label="Currency">${opts(currencies, f.currency, '—')}${legacyOption(currencies, f.currency)}<option value="__other__">Other…</option></select>`;
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
        ${fieldWrap('Expected Order', quarterStructured('expectedOrder', f.expectedOrder), 'expectedOrder')}
        ${fieldWrap('Expected Delivery', quarterStructured('expectedDelivery', f.expectedDelivery), 'expectedDelivery')}
        ${fieldWrap('Expected Billing', quarterStructured('expectedBilling', f.expectedBilling), 'expectedBilling')}
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

  // ---- ACT 5D corrective item 2: scroll-position preservation -------------
  // .projectsBody (data-projects-scroll-owner="1") is the single vertical
  // scroll owner of the Projects route. Replacing container.innerHTML during
  // every post-Apply renderInto, refresh, refreshRoute and later Index-refresh
  // callback rebuilt the DOM subtree from scratch and reset the scroll owner
  // to (0,0): the user scrolled the Project list to row N, pressed Apply, and
  // the list jumped back to the top. Capture the LIVE scroll owner's offsets
  // BEFORE the destructive rebuild and restore them AFTER the final layout, so
  // a re-render is visually position-neutral. Clamped to [0, max] so a shrunken
  // projection (fewer rows after Apply) can never over-scroll into empty space.
  function restoreScrollOwner(container) {
    let body = null;
    try {
      body = container ? container.querySelector('[data-projects-scroll-owner="1"]') : null;
    } catch { body = null; }
    if (!body) return () => {};
    const top = Number(body.scrollTop) || 0;
    const left = Number(body.scrollLeft) || 0;
    if (!top && !left) return () => {};
    return () => {
      try {
        // innerHTML already replaced the subtree; address the NEW owner node so
        // the restored offsets land on the element the user is actually viewing.
        const next = container.querySelector('[data-projects-scroll-owner="1"]') || body;
        // Measurable layout requires a POSITIVE client box. Zero is finite but
        // means "not laid out / hidden" (e.g. Projects is briefly unmounted
        // during the Workspace transition), NOT "shrunken to empty". Clamping
        // against a zero client box would silently reset a saved nonzero offset
        // to 0. So:
        //   - clientHeight > 0  → genuinely laid out → clamp (a shrunken
        //     projection must never over-scroll into empty space);
        //   - clientHeight === 0 → hidden / unknown → assign the RAW saved
        //     offset and let the browser clamp at paint time once visible.
        const scrollHeight = Number(next.scrollHeight);
        const clientHeight = Number(next.clientHeight);
        const scrollWidth = Number(next.scrollWidth);
        const clientWidth = Number(next.clientWidth);
        const measurableV = Number.isFinite(scrollHeight) && Number.isFinite(clientHeight) && clientHeight > 0;
        const measurableH = Number.isFinite(scrollWidth) && Number.isFinite(clientWidth) && clientWidth > 0;
        next.scrollTop = measurableV
          ? Math.min(Math.max(0, top), Math.max(0, scrollHeight - clientHeight))
          : Math.max(0, top);
        next.scrollLeft = measurableH
          ? Math.min(Math.max(0, left), Math.max(0, scrollWidth - clientWidth))
          : Math.max(0, left);
      } catch {}
    };
  }

  function renderInto(container) {
    const p = buildProjection();
    // Bounded diagnostic only: counts and lifecycle state, never content.
    safeLog(`ProjectsView: workspaceAvailable=${p.state !== 'unavailable'} indexReady=${p.ready} projects=${p.total != null ? p.total : (p.state === 'unavailable' || p.state === 'loading' ? 0 : p.count)} state=${p.state}`);
    const restoreScroll = restoreScrollOwner(container);
    container.innerHTML = p.html;
    container.insertAdjacentHTML('afterbegin',
      `<div class="projectsReturnRow"><button type="button" data-action="return-to-workspace" class="projectsReturnAction" aria-label="Back to Workspace">← Back to Workspace</button></div>`);
    restoreScroll();
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
      // ACT 5D smaller model (§5): explicit Source navigation from Projects
      // opens the source in the normal Workspace and arms the ONE persistent
      // recovery action (`Back to Projects`).
      setInspection(true);
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

  // ---- ACT 5D: ONE authoritative Projects presentation owner --------------
  // open Projects full view -> host switchTo('projects') -> activate()
  // close / Back to Workspace -> handleReturnToWorkspace()
  // Back to Projects -> backToProjects(); safe recovery -> recoverPresentation()
  // Operations are idempotent: repeated opens never stack (ensureContainer),
  // repeated closes leave one clean closed state, returns are NOOP-safe.
  // Snapshot rule (documented): pane visibility the user changes WHILE Projects
  // is active is the NEWER restoration target; the captured pre-Projects
  // snapshot is ONLY a REPAIR source when the returned state cannot be verified.
  function capturePresentationSnapshot(reason) {
    try {
      const vl = globalThis.MME_VIEW_LAYOUT;
      const editorEl = document.getElementById('editor');
      const snap = {
        contextId: String(globalThis.currentAppContextId || ''),
        hostActiveId: (function () { const h = getHost(); return h && typeof h.getActiveId === 'function' ? String(h.getActiveId() || '') : ''; })(),
        editorHidden: (function () { try { if (typeof globalThis.isEditorHidden === 'function') return Boolean(globalThis.isEditorHidden()); } catch {} return document.body.classList.contains('editor-hidden'); })(),
        editorWidth: (editorEl && editorEl.style && editorEl.style.width) ? String(editorEl.style.width) : '',
        markmapVisible: (vl && typeof vl.isPaneVisible === 'function') ? Boolean(vl.isPaneVisible('markmap')) : null,
        htmlVisible: (typeof globalThis.isHtmlPreviewOpen === 'function') ? Boolean(globalThis.isHtmlPreviewOpen()) : null,
        layoutPreset: (vl && typeof vl.getCurrentPreset === 'function') ? String(vl.getCurrentPreset() || '') : '',
        paneVisibleIds: (vl && vl.getState && Array.isArray(vl.getState().visiblePaneIds)) ? Array.prototype.slice.call(vl.getState().visiblePaneIds) : [],
        timestamp: Date.now(),
        reason: String(reason || ''),
      };
      // Presentation state ONLY - never document content, never file handles.
      presentationSnapshot = Object.freeze(snap);
    } catch { /* capture failure leaves any previous snapshot in place */ }
    return presentationSnapshot;
  }
  function closeProjectsPresentation() {
    try {
      const c = document.getElementById(CONTAINER_ID);
      if (c) c.hidden = true;
      document.documentElement.classList.remove('projects-view-active');
      document.documentElement.removeAttribute('data-projects-presentation');
    } catch {}
    return verifyProjectsClosed().ok;
  }

  function verifyProjectsClosed() {
    let classOff = true;
    let dsOff = true;
    let hiddenOn = true;
    let displayOff = true;
    try { classOff = !document.documentElement.classList.contains('projects-view-active'); } catch {}
    try { dsOff = typeof document.documentElement.hasAttribute === 'function' ? !document.documentElement.hasAttribute('data-projects-presentation') : true; } catch {}
    try { const c = document.getElementById(CONTAINER_ID); hiddenOn = !c || c.hidden === true; } catch {}
    try {
      const gcs = typeof globalThis.getComputedStyle === 'function' ? globalThis.getComputedStyle : (globalThis.window && globalThis.window.getComputedStyle);
      const c = document.getElementById(CONTAINER_ID);
      if (c && typeof gcs === 'function') displayOff = gcs.call(globalThis.window || globalThis, c).display === 'none';
    } catch {}
    return { ok: Boolean(classOff && dsOff && hiddenOn && displayOff), classOff, dsOff, hiddenOn, displayOff };
  }

  function shellModeled() {
    try { return Boolean(document.getElementById('toolbar') || document.getElementById('editor') || document.getElementById('btnEditorEdgeOpen') || document.getElementById('viewer')); } catch { return false; }
  }
  function verifyShellReachable(snapshot) {
    if (!shellModeled()) return { ok: true };
    const problems = [];
    let editorHidden = document.body.classList.contains('editor-hidden');
    try { if (typeof globalThis.isEditorHidden === 'function') editorHidden = Boolean(globalThis.isEditorHidden()); } catch {}
    const edge = document.getElementById('btnEditorEdgeOpen');
    const ed = document.getElementById('editor');
    const incoherent = (editorHidden && !edge) || (!editorHidden && ed && ed.style && ed.style.display === 'none');
    if (incoherent) {
      // Repair ONLY from the snapshot: deliberate, reachable user changes made
      // while Projects was active are the NEWER restoration target.
      if (snapshot && typeof snapshot.editorHidden === 'boolean') {
        try {
          const ev = globalThis.MME_EDITOR_VISIBILITY;
          if (ev && typeof ev.showEditor === 'function' && typeof ev.hideEditor === 'function') { if (snapshot.editorHidden) ev.hideEditor(); else ev.showEditor(); }
          else if (typeof globalThis.showEditor === 'function' && typeof globalThis.hideEditor === 'function') { if (snapshot.editorHidden) globalThis.hideEditor(); else globalThis.showEditor(); }
        } catch {}
      }
      let after = editorHidden;
      try { if (typeof globalThis.isEditorHidden === 'function') after = Boolean(globalThis.isEditorHidden()); else after = document.body.classList.contains('editor-hidden'); } catch {}
      const edgeAfter = document.getElementById('btnEditorEdgeOpen');
      const edAfter = document.getElementById('editor');
      if ((after && !edgeAfter) || (!after && edAfter && edAfter.style && edAfter.style.display === 'none')) problems.push('editor-controls');
    }
    return { ok: problems.length === 0 };
  }
  function ensureBackButton() {
    try {
      const existing = document.getElementById('mmeProjectsBackToProjects');
      if (existing) return existing;
      const toolbar = document.getElementById('toolbar');
      if (!toolbar || typeof document.createElement !== 'function') return null;
      const b = document.createElement('button');
      b.id = 'mmeProjectsBackToProjects';
      b.type = 'button';
      b.className = 'projectsBackToProjects';
      b.textContent = 'Back to Projects';
      b.setAttribute('aria-label', 'Back to Projects');
      b.title = 'Back to Projects';
      b.hidden = !inspectionActive;
      b.addEventListener('click', function () { void backToProjects(); });
      toolbar.appendChild(b);
      return b;
    } catch { return null; }
  }

  function setInspection(on) {
    inspectionActive = Boolean(on);
    try { inspectionActive ? document.documentElement.setAttribute('data-projects-inspection', 'true') : document.documentElement.removeAttribute('data-projects-inspection'); } catch {}
    try { const b = ensureBackButton(); if (b) b.hidden = !inspectionActive; } catch {}
    return inspectionActive;
  }

  async function backToProjects() {
    const hostApi = getHost();
    setInspection(false);
    let status = 'no-host';
    try {
      if (hostApi && typeof hostApi.switchTo === 'function') {
        const r = await hostApi.switchTo('projects', { reason: 'projects back to projects' });
        status = String((r && r.status) || 'unknown');
      }
    } catch (e) { status = 'failed'; }
    // Idempotent DOM guarantee: a Host NOOP (already on Projects) must still
    // leave the full presentation mounted exactly once.
    try {
      const c = ensureContainer();
      c.hidden = false;
      document.documentElement.classList.add('projects-view-active');
      document.documentElement.setAttribute('data-projects-presentation', 'full');
    } catch {}
    const hostApi2 = getHost();
    const active = hostApi2 && typeof hostApi2.getActiveId === 'function' ? String(hostApi2.getActiveId() || '') : 'projects';
    const c2 = document.getElementById(CONTAINER_ID);
    const ok = active === 'projects' && Boolean(c2) && c2.hidden === false && document.documentElement.classList.contains('projects-view-active');
    safeLog(`ProjectsPresentation: back-to-projects status=${status} ok=${ok}`);
    return Object.freeze({ ok, reason: ok ? '' : 'back-to-projects-failed' });
  }
  async function recoverPresentation(reason) {
    // ACT 5D s9 safe recovery: a Projects-specific boundary, never a generic
    // app reset. No Save, no Markdown write, no Project draft clearing.
    const code = String(reason || 'unspecified');
    safeLog(`ProjectsPresentation: recovery reason=${code}`);
    const hostApi = getHost();
    setInspection(false);
    closeProjectsPresentation();
    try {
      const active = hostApi && typeof hostApi.getActiveId === 'function' ? String(hostApi.getActiveId() || '') : '';
      if (active !== 'journal' && hostApi && typeof hostApi.switchTo === 'function') {
        await hostApi.switchTo('journal', { reason: 'projects recovery' });
      }
    } catch {}
    closeProjectsPresentation();
    try {
      const ev = globalThis.MME_EDITOR_VISIBILITY;
      if (ev && typeof ev.showEditor === 'function' && (typeof ev.isEditorHidden !== 'function' || ev.isEditorHidden())) ev.showEditor();
      else if (typeof globalThis.showEditor === 'function' && typeof globalThis.isEditorHidden === 'function' && globalThis.isEditorHidden()) globalThis.showEditor();
    } catch {}
    try {
      const vl = globalThis.MME_VIEW_LAYOUT;
      if (vl && typeof vl.isPaneVisible === 'function' && typeof vl.showPane === 'function' && !vl.isPaneVisible('markmap')) vl.showPane('markmap');
      else if (!vl && typeof globalThis.showMapPane === 'function' && typeof globalThis.isMapPaneVisible === 'function' && !globalThis.isMapPaneVisible()) globalThis.showMapPane();
    } catch {}
    try {
      if (typeof globalThis.isHtmlPreviewOpen === 'function' && globalThis.isHtmlPreviewOpen() && typeof globalThis.hideHtmlPreview === 'function') globalThis.hideHtmlPreview();
    } catch {}
    try { if (typeof globalThis.updateEditorVisibilityControls === 'function') globalThis.updateEditorVisibilityControls(); } catch {}
    try { const vl2 = globalThis.MME_VIEW_LAYOUT; if (vl2 && typeof vl2.refresh === 'function') vl2.refresh(); } catch {}
    return Object.freeze({ ok: true, reason: code });
  }
  // The accepted Back to Workspace contract (ACT 5D s6). Verified against the
  // real DOM state, never against context ids or log messages alone.
  async function handleReturnToWorkspace() {
    const hostApi = getHost();
    // 1. Accepted restoration through the Host owner. NOOP-safe: in the
    //    stranded case the route is already Journal, so this may legitimately
    //    do nothing - step 2 still closes the presentation.
    if (hostApi && typeof hostApi.switchTo === 'function') {
      try { await hostApi.switchTo('journal', { reason: 'projects return' }); } catch {}
    }
    // 2. Explicit close, independent of the Host result (stranded-proof).
    const closed = closeProjectsPresentation();
    // 3. The inspection recovery action leaves with the presentation.
    setInspection(false);
    // 4. Verify with actual DOM visibility; recover when the normal closure
    //    cannot be confirmed.
    if (!closed) await recoverPresentation('projects-close-verification-failed');
    // 5. Verify the shell is reachable and coherent; repair from the snapshot
    //    only when the state cannot be confirmed (newer user changes win).
    const shell = verifyShellReachable(presentationSnapshot);
    if (!shell.ok) await recoverPresentation('workspace-reachability-failed');
    const finalCheck = verifyProjectsClosed().ok && verifyShellReachable(presentationSnapshot).ok;
    if (!finalCheck) {
      safeLog('ProjectsPresentation: return-failed');
      return Object.freeze({ ok: false, reason: 'return-failed' });
    }
    safeLog('ProjectsPresentation: return-to-workspace ok');
    return Object.freeze({ ok: true, reason: '' });
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
    // ACT 5D-FU: the clear-quarter action is retired — the empty "—" option
    // in either Year/Quarter select is the ONLY Clear affordance.
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

    // ACT 5D s11: no draft edits while Apply is running.
    if (viewState.applying) return false;
    let raw = String(el.value == null ? '' : el.value);
    if (raw === '__other__') {
      const entered = typeof globalThis.prompt === 'function' ? globalThis.prompt('Currency code, for example BRL') : null;
      raw = entered == null ? String(recordKeyedOriginal(record, 'currency')) : String(entered).trim().toUpperCase();
    } else if (raw === ALL) {
      // ACT 5D-FU: the empty "—" option is the per-field explicit Clear
      // state. For a structured quarter pair the composed block below
      // reduces to '' (complete field cleared); for a plain field this is
      // the ordinary empty state. The untouched companion select keeps its
      // own "—" default, so initial selection works in either order.
      raw = '';
    }

    // ACT 5D-FU s4: compose the structured Year + Quarter selection into
    // the ONE draft field. Clearing EITHER select (to "—") clears the
    // COMPLETE field (raw='') — the explicit Clear state. A first selection
    // whose companion is still empty persists as a partial marker
    // ("2029-" / "-Q3") so the UI keeps it visible; validateDraft blocks
    // Apply until the pair is completed or cleared. Year-first and
    // Quarter-first selection both work — the first selection is never
    // erased because the companion is still empty.
    const QUARTER_FIELDS = ['expectedOrder', 'expectedDelivery', 'expectedBilling'];
    const part = typeof el.getAttribute === 'function' ? el.getAttribute('data-quarter-part') : '';
    if (part && QUARTER_FIELDS.indexOf(field) !== -1) {
      const elCleared = String(el.value == null ? '' : el.value) === ALL || String(el.value || '') === '';
      const holder = el.closest('[data-quarter-field]');
      const yearEl = holder ? childByAttr(holder, 'data-quarter-part', 'year') : null;
      const qEl = holder ? childByAttr(holder, 'data-quarter-part', 'quarter') : null;
      const yv = yearEl ? String(yearEl.value || '') : '';
      const qv = qEl ? String(qEl.value || '') : '';
      const year = (yv === ALL || yv === '') ? '' : yv;
      const quarter = (qv === ALL || qv === '') ? '' : qv.toUpperCase();
      if (elCleared) raw = '';
      else if (year && quarter) raw = normalizeQuarterValue(year + quarter).display || (year + quarter);
      else if (year && !quarter) raw = year + '-';
      else if (!year && quarter) raw = '-' + quarter;
      else raw = '';
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
    // ACT 5D §10: capture the pre-Projects presentation snapshot BEFORE the
    // route class is applied. An Apply return (viewState.applying) must NOT
    // overwrite the original restoration source with mid-apply state.
    if (!viewState.applying) capturePresentationSnapshot('projects-enter');

    // ACT 5D: drafts belong to the WORKSPACE root — they always survive route
    // deactivate/reactivate inside the SAME Workspace, and are cleared only
    // when the Workspace root itself changes.
    const wk = currentWorkspaceKey();
    if (draftsByProjectId.size && draftsWorkspaceKey && wk && wk !== draftsWorkspaceKey) resetDraftsForWorkspaceChange();

    // Entering full Projects always dismisses the inspection recovery action.
    setInspection(false);

    let container;
    try { container = ensureContainer(); } catch (e) { throw new Error(`ProjectsView.activate: ${e?.message || e}`); }

    bindContainer(container);

    renderInto(container);
    container.hidden = false;
    document.documentElement.classList.add('projects-view-active');
    document.documentElement.setAttribute('data-projects-presentation', 'full');

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
    document.documentElement.removeAttribute('data-projects-presentation');
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
    if (c) { c.hidden = false; document.documentElement.classList.add('projects-view-active'); document.documentElement.setAttribute('data-projects-presentation', 'full'); }
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
    draftsWorkspaceKey = null;
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
    // ACT 5D presentation owner (single transition authority)
    returnToWorkspace: handleReturnToWorkspace,
    backToProjects,
    recoverPresentation,
    getPresentationState: () => Object.freeze({ inspection: inspectionActive, snapshot: presentationSnapshot, closed: verifyProjectsClosed().ok }),
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
