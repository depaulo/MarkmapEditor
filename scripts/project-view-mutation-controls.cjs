#!/usr/bin/env node
'use strict';

/**
 * ACT 5C - Projects view / adapter mutation controls.
 *
 * A control counts ONLY when applied to one occurrence, one or more NAMED
 * fixtures turn red for the intended reason, the file is restored
 * BYTE-IDENTICALLY, and the baseline reruns green. Structural guards are
 * reported separately and never counted.
 *
 * Usage: node scripts/project-view-mutation-controls.cjs
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ADAPTER = 'js/workspace/project-visual-adapter.js';
const VIEW = 'js/workspace/projects-view.js';
const MAIN = 'js/main.js';
const IDX = 'js/workspace/workspace-index-document.js';
const CSS = 'css/workspace.css';

const BASELINE = ['project-view-validators.cjs', 'project-consumer-validators.cjs', 'project-contract-validators.cjs'];
const FINDING_RE = /^\s*FAIL\s{2}([A-Za-z0-9_.-]+)\s/gm;

function sha256(f) { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'); }
function runSuite(script) {
  const res = { script, findings: [], exit: 0 };
  const attempt = () => {
    const r = { output: '', exit: 0 };
    try {
      r.output = execFileSync(process.execPath, [path.join(ROOT, 'scripts', script)], {
        cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024,
      });
    } catch (e) {
      r.exit = e.status == null ? 1 : e.status;
      r.output = String(e.stdout || '') + String(e.stderr || '');
    }
    return r;
  };
  let run = attempt();
  // A crash with NO named finding is a transient harness/device failure, not a
  // behavioral result: retry once so only real regressions are reported.
  if (run.exit !== 0 && !/^\s*FAIL\s{2}\S+/m.test(run.output)) run = attempt();
  res.output = run.output;
  res.exit = run.exit;
  for (const m of res.output.matchAll(FINDING_RE)) if (!res.findings.includes(m[1])) res.findings.push(m[1]);
  return res;
}

const S = ['project-view-validators.cjs'];

const MUTATIONS = [
  // ---- adapter ----
  { id: 'C01-title-based-targeting', file: ADAPTER,
    find: "  const re = /<!--\\s*mme-project:([\\s\\S]*?)-->/gi;",
    replace: "  const re = /Project:[^\\n]*\\n/gi; // mutated: resolve by title instead of identity",
    suites: S, expect: ['A01', 'A50', 'A56'], count: 1,
    why: 'The adapter targets by projectId only, never by title/position.' },
  { id: 'C02-skip-projectId-verification', file: ADAPTER,
    find: '    if (hits === 0) {',
    replace: '    if (false) {',
    suites: S, structural: true,
    why: 'INVARIANT: the adapter re-verifies projectId before mutating (the pure owner also refuses, so this is defence-in-depth).' },
  { id: 'C03-allow-duplicate-projectId', file: ADAPTER,
    find: '    if (hits > 1) {',
    replace: '    if (false) {',
    suites: S, structural: true,
    why: 'INVARIANT: duplicated identity is blocked at the adapter AND again in the pure owner (defence-in-depth).' },
  { id: 'C04-second-buffer-update', file: ADAPTER,
    find: '    h.applyMarkdown(mutation.proposedMarkdown);',
    replace: '    h.applyMarkdown(mutation.proposedMarkdown);\n    h.applyMarkdown(mutation.proposedMarkdown);',
    suites: S, expect: ['A02'], count: 1,
    why: 'Exactly ONE programmatic editor-buffer update.' },
  { id: 'C05-skip-index-rebuild-after-success', file: ADAPTER,
    find: '      await h.rebuildIndex();',
    replace: '      // mutated: Index rebuild skipped',
    suites: S, expect: ['A04'], count: 1,
    why: 'The Index rebuilds only after a successful physical Save.' },
  { id: 'C06-rebuild-even-when-save-failed', file: ADAPTER,
    find: "    if (!saveResult || saveResult.ok !== true) {\n      const canceled = saveResult && saveResult.reason === 'canceled';",
    replace: "    if (false) {\n      const canceled = saveResult && saveResult.reason === 'canceled';",
    suites: S, expect: ['A40', 'A41', 'A45', 'A46', 'A47', 'A48'], count: 1,
    why: 'A failed or canceled Save must never rebuild the Index.' },
  { id: 'C07-bypass-save-owner', file: ADAPTER,
    find: '      saveResult = await h.save();',
    replace: '      saveResult = { ok: true }; // mutated: Save owner bypassed',
    suites: S, expect: ['A03'], count: 1,
    why: 'Every Save goes through the single accepted Save owner.' },
  { id: 'C08-bypass-dirty-owner', file: ADAPTER,
    find: '    if (h && h.isDirty()) {',
    replace: '    if (false) {',
    suites: S, expect: ['A58', 'A60'], count: 1,
    why: 'A dirty Note must be protected before transitioning away.' },
  { id: 'C09-hidden-direct-file-write', file: ADAPTER,
    find: '    const hits = projectIdPresentIn(active, projectId);',
    replace: "    try { require('fs'); } catch {}\n    const hits = projectIdPresentIn(active, projectId);",
    suites: S, expect: ['R11'], count: 1,
    why: 'The adapter never writes files directly.' },

  // ---- UI: compact table, details, drafts (V01-V40) ----
  { id: 'V01-restore-per-row-apply', file: VIEW,
    find: '        <div class="projectsCell projectsCellToggle" role="cell" data-col="toggle">',
    replace: '        <div class="projectsCell projectsCellToggle" role="cell" data-col="toggle"><button type="button" class="projectsApplyBtn" data-action="apply">Apply</button>',
    suites: S, expect: ['B01', 'B02'], count: 1,
    why: 'The compact row is read-only: there is NO per-row Apply.' },
  { id: 'V02-restore-per-row-cancel', file: VIEW,
    find: '        <div class="projectsCell projectsCellToggle" role="cell" data-col="toggle">',
    replace: '        <div class="projectsCell projectsCellToggle" role="cell" data-col="toggle"><button type="button" class="projectsCancelBtn" data-action="cancel-edit">Cancel</button>',
    suites: S, expect: ['B01', 'B03'], count: 1,
    why: 'There is NO per-row Cancel; only one global Discard.' },
  { id: 'V03-render-editing-controls-in-row', file: VIEW,
    find: '        <div class="projectsCell projectsCellStage${cell(\'stage\')}" role="cell" data-col="stage">${escapeHtml(stageLabel(f.stage))}</div>',
    replace: '        <div class="projectsCell projectsCellStage${cell(\'stage\')}" role="cell" data-col="stage"><select data-field="stage">${opts(STAGE_OPTIONS, f.stage, \'-\')}</select></div>',
    suites: S, expect: ['B01', 'B52'], count: 1,
    why: 'Editing controls exist ONLY inside the details region.' },
  { id: 'V04-two-expand-controls', file: VIEW,
    find: '            aria-label="${expanded ? \'Collapse\' : \'Expand\'} details for ${escapeHtml(r.name)}">${expanded ? \'▾\' : \'▸\'}</button>',
    replace: '            aria-label="${expanded ? \'Collapse\' : \'Expand\'} details for ${escapeHtml(r.name)}">${expanded ? \'▾\' : \'▸\'}</button><button type="button" class="projectsExpandBtn2" data-action="toggle-details">▸</button>',
    suites: S, expect: ['B04'], count: 1,
    why: 'Exactly ONE expand control per row.' },
  { id: 'V05-duplicate-details-region', file: VIEW,
    find: '    const details = `<div class="projectsRowDetails" role="row" id="details-${escapeHtml(r.key)}" data-details-for="${escapeHtml(r.key)}"${expanded ? \'\' : \' hidden\'}>${body}</div>`;',
    replace: '    const details = `<div class="projectsRowDetails" role="row" id="details-${escapeHtml(r.key)}" data-details-for="${escapeHtml(r.key)}"${expanded ? \'\' : \' hidden\'}>${body}</div><div class="projectsRowDetails" role="row" data-details-for="${escapeHtml(r.key)}">${body}</div>`;',
    suites: S, expect: ['B06', 'B52'], count: 1,
    why: 'Exactly ONE details region per row.' },
  { id: 'V06-source-header-wraps-outside-row', file: VIEW,
    find: '        <div role="rowgroup">${rows.length ? rows.map((r) => rowHtml(r, viewState.expandedKeys)).join(\'\') : emptyHtml}</div>',
    replace: '        <div role="rowgroup"><div class="projectsHeadRow" role="row"><span class="projectsHeadCell" role="columnheader">Source</span></div>${rows.length ? rows.map((r) => rowHtml(r, viewState.expandedKeys)).join(\'\') : emptyHtml}</div>',
    suites: S, expect: ['B07', 'B07b'], count: 1,
    why: 'Source stays a column of the SAME header row; it never becomes a second header line.' },
  { id: 'V07-unmanaged-row-editable', file: VIEW,
    find: '    const body = r.managed\n',
    replace: '    const body = true\n',
    suites: S, expect: ['B08', 'B08b', 'B56'], count: 1,
    why: 'An unmanaged expanded region stays READ-ONLY: no input, no selector, no mutation action.' },
  { id: 'V08-missing-stage-option', file: VIEW,
    find: "    { value: 'on-delivery', label: 'On Delivery' },\n    { value: 'delivered', label: 'Delivered' },",
    replace: "    { value: 'on-delivery', label: 'On Delivery' },",
    suites: S, expect: ['V18'], count: 1,
    why: 'The Stage selector offers every canonical Stage.' },
  { id: 'V09-missing-state-option', file: VIEW,
    find: "    { value: 'lost', label: 'Lost' },\n    { value: 'canceled', label: 'Canceled' },",
    replace: "    { value: 'lost', label: 'Lost' },",
    suites: S, expect: ['V19'], count: 1,
    why: 'The State selector offers every canonical State.' },
  { id: 'V10-silent-legacy-stage-rewrite', file: VIEW,
    find: '  function legacyOption(list, current) {\n    if (current && !list.some((o) => o.value === current)) {',
    replace: '  function legacyOption(list, current) {\n    if (false && current && !list.some((o) => o.value === current)) {',
    suites: S, expect: ['V22'], count: 1,
    why: 'An unknown legacy Stage stays readable and is never silently dropped.' },
  { id: 'V11-silent-legacy-state-rewrite', file: VIEW,
    find: '  function legacyOption(list, current) {\n    if (current && !list.some((o) => o.value === current)) {',
    replace: '  function legacyOption(list, current) {\n    if (false && current && !list.some((o) => o.value === current)) {',
    suites: S, expect: ['V23'], count: 1,
    why: 'An unknown legacy State stays readable and is never silently dropped.' },

  // ---- filters ----
  { id: 'C22-zero-result-hides-filters', file: VIEW,
    find: "    const emptyHtml = rows.length ? '' : '<div class=\"projectsEmpty\">No Projects match the current filters.</div>';",
    replace: "    const emptyHtml = '';",
    suites: S, expect: ['F11', 'FT11a'], count: 1,
    why: 'A zero-result state must still explain itself.' },
  { id: 'C23-clear-filters-is-a-noop', file: VIEW,
    find: "      viewState.search = '';\n      viewState.filters = { stage: ALL, state: ALL, value: ALL, year: ALL, quarter: ALL, currency: ALL };\n      renderInto(ensureContainer());\n      return;\n    }\n    if (action === 'discard-drafts') {",
    replace: "      // mutated: the Clear filters action no longer resets any dimension\n      renderInto(ensureContainer());\n      return;\n    }\n    if (action === 'discard-drafts') {",
    suites: S, expect: ['CF08', 'CF09', 'CF10', 'CF11', 'CF12', 'CF13'], count: 1,
    why: 'Clear filters really clears every dimension.' },
  { id: 'C24-currency-filter-case-sensitive', file: VIEW,
    find: "      if (f.currency !== ALL && r.currency !== f.currency) return false;",
    replace: "      if (f.currency !== ALL && r.currency !== 'zzz') return false;",
    suites: S, expect: ['F05'], count: 1,
    why: 'Currency filtering compares against the normalized value, not a literal.' },

  // ---- totals ----
  { id: 'C25-combine-currencies', file: VIEW,
    find: '        byCurrency.set(r.currency, (byCurrency.get(r.currency) || 0) + r.value);',
    replace: "        byCurrency.set('ALL', (byCurrency.get('ALL') || 0) + r.value); // mutated: currencies merged",
    suites: S, expect: ['T03', 'T04'], count: 1,
    why: 'Currencies are never summed together.' },
  { id: 'C26-zero-treated-as-missing', file: VIEW,
    find: '      if (Number.isFinite(r.value)) withValue += 1;',
    replace: '      if (Number.isFinite(r.value) && r.value > 0) withValue += 1;',
    suites: S, expect: ['T01'], count: 1,
    why: 'Zero is a present value and counts as With value.' },
  { id: 'C27-missing-currency-included', file: VIEW,
    find: '      if (Number.isFinite(r.value) && r.currency) {\n        byCurrency.set(r.currency, (byCurrency.get(r.currency) || 0) + r.value);\n      }',
    replace: "      if (Number.isFinite(r.value)) {\n        const c2 = r.currency || 'NONE';\n        byCurrency.set(c2, (byCurrency.get(c2) || 0) + r.value);\n      }",
    suites: S, expect: ['T03', 'T05'], count: 1,
    why: 'A value without a currency never enters a currency bucket.' },
  { id: 'C28-totals-ignore-filters', file: VIEW,
    find: '    const totals = computeTotals(rows);',
    replace: '    const totals = computeTotals(ordered);',
    suites: S, expect: ['FT02b', 'FT02c', 'FT02e', 'FT03b', 'FT03c', 'FT04b', 'FT06b', 'FT06c', 'FT10b', 'FT11a', 'FT11b', 'FT11c'], count: 1,
    why: 'Totals must be computed from the FILTERED result, never the unfiltered collection while a filter is active. The visible rows stay filtered, so this cannot false-pass.' },

  // ---- Workspace / Index state model (M01-M08) ----
  { id: 'M01-zero-projects-as-no-workspace', file: VIEW,
    find: "    if (!all.length) return { html: renderEmpty('No Projects yet.'), count: 0, ready: true, state: 'empty' };",
    replace: "    if (!all.length) return { html: renderEmpty('No Workspace is open.'), count: 0, ready: true, state: 'empty' };",
    suites: S, expect: ['W03', 'W08'], count: 1,
    why: 'Zero Projects in a READY Index is the empty state, never the unavailable state.' },
  { id: 'M02-index-not-ready-as-no-workspace', file: VIEW,
    find: "    if (!src.indexReady) return { html: renderEmpty('Loading Projects…'), count: 0, ready: false, state: 'loading' };",
    replace: "    if (!src.indexReady) return { html: renderEmpty('No Workspace is open.'), count: 0, ready: false, state: 'loading' };",
    suites: S, expect: ['W02', 'W06'], count: 1,
    why: 'An active Workspace whose Index is still building renders Loading, not unavailable.' },
  { id: 'M03-active-file-as-workspace-availability', file: VIEW,
    find: '    return { state: st, available: Boolean(st && st.rootHandle) };',
    replace: '    return { state: st, available: Boolean(st && st.activeFile) }; // mutated: active file instead of rootHandle',
    suites: S, expect: ['W09', 'W04', 'W15'], count: 1,
    why: 'A valid Workspace is available without an active Note; availability comes from rootHandle.' },
  { id: 'M04-ignore-index-ready-event', file: VIEW,
    find: "    window.addEventListener('mme-workspace-index-ready', onWorkspaceIndexReady);",
    replace: "    window.removeEventListener('mme-workspace-index-ready', onWorkspaceIndexReady);",
    suites: S, expect: ['W06', 'W07'], count: 1,
    why: 'The Index-ready lifecycle event must refresh the mounted view.' },
  { id: 'M05-wrong-project-state-property', file: VIEW,
    find: "    return { indexReady: Boolean(st && st.ready === true), projects: Array.isArray(st?.projects) ? st.projects : [] };",
    replace: "    return { indexReady: Boolean(st && st.ready === true), projects: Array.isArray(st?.items) ? st.items : [] }; // mutated: wrong property",
    suites: S, expect: ['W04', 'W05', 'W16'], count: 1,
    why: 'The reader must use the real Index read-model property (projects).' },
  { id: 'M06-keep-initial-state-after-refresh', file: VIEW,
    find: '    const c = document.getElementById(CONTAINER_ID);\n    if (!c || c.hidden) return;\n    refresh();',
    replace: '    const c = document.getElementById(CONTAINER_ID);\n    if (!c || c.hidden) return;\n    // mutated: no refresh on Index-ready',
    suites: S, expect: ['W06', 'W07', 'W08'], count: 1,
    why: 'The view must not remain in its initial state after the Index-ready event.' },
  { id: 'M07-filtered-zero-as-no-workspace', file: VIEW,
    find: "    const emptyHtml = rows.length ? '' : '<div class=\"projectsEmpty\">No Projects match the current filters.</div>';",
    replace: "    const emptyHtml = rows.length ? '' : '<div class=\"projectsEmpty\">No Workspace is open.</div>'; // mutated: filtered zero treated as unavailable",
    suites: S, expect: ['W13'], count: 1,
    why: 'A filtered zero result is a filtered empty state, never the unavailable state.' },
  { id: 'M08-shim-only-workspace-property', file: VIEW,
    find: '    return { state: st, available: Boolean(st && st.rootHandle) };',
    replace: '    return { state: st, available: Boolean(st && (st.activeWorkspace || st.rootHandle)) }; // mutated: shim-only property',
    suites: S, expect: ['W14b'], count: 1,
    why: 'The reader must not depend on a shim-only property that production never sets.' },

  // ---- mobile ----
  { id: 'C29-return-unreachable-on-mobile', file: VIEW,
    find: '      `<div class="projectsReturnRow"><button type="button" data-action="return-to-workspace" class="projectsReturnAction">← Return to Workspace</button></div>`);',
    replace: '      `<div class="projectsReturnRow"></div>`); // mutated: Return removed',
    suites: ['project-device-acceptance.cjs'], expect: ['D33'], structural: true,
    why: 'INVARIANT: Return stays reachable on every layout.' },

  // ---- drafts and the global Apply (D01-D10) ----
  { id: 'D01-save-on-selector-change', file: VIEW,
    find: "    setDraftField(record, field, raw);\n    viewState.activeEdit = { key: record.key, field, at: Date.now() };",
    replace: "    setDraftField(record, field, raw);\n    adapter().applyProjectFieldChange({ projectId: record.projectId, sourcePath: record.sourcePath, operation: 'setStage', value: raw });\n    viewState.activeEdit = { key: record.key, field, at: Date.now() };",
    suites: S, expect: ['B15', 'B16', 'B17'], count: 1,
    why: 'Changing a control updates the DRAFT only: no Save, no adapter call, no Markdown mutation.' },
  { id: 'D02-overwrite-markdown-while-drafting', file: VIEW,
    find: "    setDraftField(record, field, raw);\n    viewState.activeEdit = { key: record.key, field, at: Date.now() };",
    replace: "    setDraftField(record, field, raw);\n    globalThis.MME_PROJECT_EDIT_HOST.applyMarkdown('# overwritten\\n');\n    viewState.activeEdit = { key: record.key, field, at: Date.now() };",
    suites: S, expect: ['B17'], count: 1,
    why: 'Drafting never touches Markdown.' },
  { id: 'D03-no-draft-created', file: VIEW,
    find: '    d.changedFields = changed;\n    if (!changed.length) { delete d.validationErrors; draftsByProjectId.delete(d.projectId); }',
    replace: '    d.changedFields = changed;\n    if (!changed.length) { delete d.validationErrors; draftsByProjectId.delete(d.projectId); }\n    draftsByProjectId.delete(d.projectId); // mutated: a draft is never kept',
    suites: S, expect: ['B09', 'B18'], count: 1,
    why: 'A control change creates a real, retained draft.' },
  { id: 'D04-pending-count-always-zero', file: VIEW,
    find: '    return { projects: draftsByProjectId.size, fields };',
    replace: '    return { projects: 0, fields: 0 }; // mutated: no pending indicator',
    suites: S, expect: ['B18', 'B19', 'B23'], count: 1,
    why: 'The global bar states the true pending Project and field counts.' },
  { id: 'D05-reverting-keeps-the-field', file: VIEW,
    find: '      if (String(d.proposed[f] || \'\') !== String(d.original[f] || \'\')) changed.push(f);',
    replace: '      changed.push(f); // mutated: reverting never removes the field',
    suites: S, expect: ['B20', 'B21'], count: 1,
    why: 'Reverting a field to its original value removes it from the draft.' },
  { id: 'D06-value-currency-are-separate-fields', file: VIEW,
    find: '        if (d.proposed.value !== d.original.value || d.proposed.currency !== d.original.currency) changed.push(f);',
    replace: '        if (d.proposed.value !== d.original.value) changed.push(f);\n        if (d.proposed.currency !== d.original.currency) changed.push(\'currency\');',
    suites: S, expect: ['B11'], count: 1,
    why: 'Value and Currency remain ONE logical pair.' },
  { id: 'D07-discard-also-saves', file: VIEW,
    find: '      discardAllDrafts();\n      viewState.lastError = \'\';',
    replace: '      discardAllDrafts();\n      globalThis.MME_PROJECT_EDIT_HOST.save(); // mutated: Discard triggers a Save\n      viewState.lastError = \'\';',
    suites: S, expect: ['B36', 'B36b'], count: 1,
    why: 'Global Discard performs no Save.' },
  { id: 'D08-discard-also-mutates-markdown', file: VIEW,
    find: '      discardAllDrafts();\n      viewState.lastError = \'\';',
    replace: '      discardAllDrafts();\n      globalThis.MME_PROJECT_EDIT_HOST.applyMarkdown(\'# discarded\\n\');\n      viewState.lastError = \'\';',
    suites: S, expect: ['B37', 'B37b'], count: 1,
    why: 'Global Discard performs no Markdown mutation.' },
  { id: 'D09-discard-kept', file: VIEW,
    find: '  function discardAllDrafts() {\n    const n = draftsByProjectId.size;\n    draftsByProjectId.clear();',
    replace: '  function discardAllDrafts() {\n    const n = draftsByProjectId.size;\n    viewState.lastBatchResult = { retained: n };',
    suites: S, expect: ['B35'], count: 1,
    why: 'Global Discard clears EVERY draft.' },
  { id: 'D10-hide-global-apply-after-draft', file: VIEW,
    find: "    return pendingSummary().projects > 0 && !viewState.applying;",
    replace: "    return false; // mutated: Apply never becomes available",
    suites: S, expect: ['B23'], count: 1,
    why: 'A valid draft enables the single global Apply.' },
  { id: 'D11-apply-available-without-drafts', file: VIEW,
    find: "    return pendingSummary().projects > 0 && !viewState.applying;",
    replace: "    return true; // mutated: Apply is always enabled",
    suites: S, expect: ['B22'], count: 1,
    why: 'With no drafts, Apply is unavailable (no false pending indicator).' },
  { id: 'D12-skip-validation-before-execution', file: VIEW,
    find: '    if (!validation.valid) {',
    replace: '    if (false) { // mutated: validation skipped before execution',
    suites: S, expect: ['B24', 'B25'], count: 1,
    why: 'Apply validates EVERY draft before any source transition starts.' },
  { id: 'D13-start-apply-with-an-invalid-draft', file: VIEW,
    find: '    const validation = validateAllDrafts();',
    replace: '    const validation = { valid: true, invalid: [], projects: draftsByProjectId.size, fields: 0 }; // mutated: no validation',
    suites: S, expect: ['B24', 'B25'], count: 1,
    why: 'One invalid draft prevents ALL execution.' },
  { id: 'D14-drop-failed-draft', file: VIEW,
    find: '      if (appliedIds.has(id)) draftsByProjectId.delete(id);',
    replace: '      draftsByProjectId.delete(id); // mutated: even failed drafts are discarded',
    suites: S, expect: ['B32', 'B33'], count: 1,
    why: 'Failed and unprocessed drafts are retained after a partial failure.' },
  { id: 'D15-claim-complete-after-partial-failure', file: ADAPTER,
    find: "  function partialOutcome(reason, appliedIds, appliedFields, failed, projects, groups, processed, extra) {\n    const code = boundedReason(reason);\n    return batchResult(Object.assign({\n      outcome: 'partial',",
    replace: "  function partialOutcome(reason, appliedIds, appliedFields, failed, projects, groups, processed, extra) {\n    const code = boundedReason(reason);\n    return batchResult(Object.assign({\n      ok: true, outcome: 'complete', // mutated: a partial run reports complete success\n      outcome: 'partial',",
    suites: S, expect: ['B34'], count: 1,
    why: 'A partial failure never claims complete success.' },
  { id: 'D16-batch-result-only-a-toast', file: VIEW,
    find: '      <div class="projectsBatchResult" role="status" aria-live="polite" data-batch-outcome="${escapeHtml(result.outcome || \'\')}">',
    replace: '      <div class="projectsBatchResult" role="status" aria-live="polite" data-batch-outcome="">',
    suites: S, expect: ['B24d'], count: 1,
    why: 'The bounded batch result is visible in the view, not only a toast.' },
  { id: 'D17-batch-owner-not-reached', file: VIEW,
    find: '      result = await a.applyProjectBatch(plan);',
    replace: '      result = { ok: true, outcome: \'complete\', appliedProjects: plan.projects.length, appliedFields: plan.fieldCount, appliedProjectIds: plan.projects.map((x) => x.projectId), sources: plan.sources.length }; // mutated: batch owner bypassed',
    suites: S, expect: ['B26', 'B27', 'B28', 'B29', 'B31', 'B39', 'B40'], count: 1,
    why: 'Apply always goes through the ONE batch owner.' },
  { id: 'D18-no-source-grouping', file: VIEW,
    find: '      if (last && last.sourcePath === pr.sourcePath) last.projects.push(pr);',
    replace: '      if (false && last && last.sourcePath === pr.sourcePath) last.projects.push(pr); // mutated: one group per Project',
    suites: S, expect: ['B27', 'B28'], count: 1,
    why: 'The plan groups by SOURCE FILE so one source means one Save.' },
  { id: 'D19-merge-same-title-drafts', file: VIEW,
    find: '        projectId: d.projectId,\n        sourcePath: d.sourcePath,',
    replace: '        projectId: String(d.name || \'\'),\n        sourcePath: d.sourcePath,',
    suites: S, expect: ['B26', 'B31', 'B41', 'B42', 'B43'], count: 1,
    why: 'Drafts are keyed by projectId, never by title.' },
  { id: 'D20-save-once-per-field', file: ADAPTER,
    find: '          proposed = mutation.proposedMarkdown;',
    replace: '          proposed = mutation.proposedMarkdown;\n          h.applyMarkdown(proposed);\n          await h.save();',
    suites: S, expect: ['B27', 'B28', 'B30'], count: 1,
    why: 'Several mutations in one source compose into ONE buffer update and ONE physical Save.' },
  { id: 'D21-buffer-update-per-field', file: ADAPTER,
    find: '          proposed = mutation.proposedMarkdown;',
    replace: '          proposed = mutation.proposedMarkdown;\n          h.applyMarkdown(proposed);',
    suites: S, expect: ['B27'], count: 1,
    why: 'ONE buffer update per source, never one per field.' },
  { id: 'D22-skip-dirty-note-guard', file: ADAPTER,
    find: '    if (h.isDirty()) {\n      const transition = await resolveDirtyNote();',
    replace: '    if (false) {\n      const transition = await resolveDirtyNote();',
    suites: S, expect: ['B38'], count: 1,
    why: 'A dirty Note is protected through Save/Discard/Cancel before any transition.' },
  { id: 'D23-continue-after-save-failure', file: ADAPTER,
    find: "        return partialOutcome(code, appliedIds, appliedFields, failed, projects, groups, processed, { saveResult });",
    replace: '        failed += groupProjects.length;\n        continue; // mutated: the run keeps going after a failed Save',
    suites: S, expect: ['B34', 'G-h'], count: 1,
    why: 'The run stops before later sources when a Save fails.' },
  { id: 'D24-second-buffer-update-per-source', file: ADAPTER,
    find: "      try { buffered = h.applyMarkdown(proposed) !== false; } catch { buffered = false; }",
    replace: "      try { buffered = h.applyMarkdown(proposed) !== false; } catch { buffered = false; }\n      h.applyMarkdown(proposed);",
    suites: S, expect: ['B27'], count: 1,
    why: 'Exactly ONE programmatic buffer update per source.' },
  { id: 'D25-trust-stale-source-line', file: ADAPTER,
    find: '        const hits = projectIdPresentIn(proposed, id);',
    replace: '        const staleLine = String((proposed.split(\'\\n\')[Number(p.sourceLine) - 1] || \'\'));\n        const hits = staleLine.includes(id) ? 1 : 0; // mutated: identity taken from the stale index line',
    suites: S, expect: ['B43'], count: 1,
    why: 'projectId is re-verified against LIVE Markdown, never from the indexed line.' },
  { id: 'D26-second-save-per-source', file: ADAPTER,
    find: "      try { buffered = h.applyMarkdown(proposed) !== false; } catch { buffered = false; }",
    replace: "      try { buffered = h.applyMarkdown(proposed) !== false; } catch { buffered = false; }\n      await h.save();",
    suites: S, expect: ['B28'], count: 1,
    why: 'Exactly ONE physical Save per source file.' },
  // ---- source navigation (N01-N05) ----
  { id: 'N01-kind-receives-record-object', file: VIEW,
    find: '      const opened = await openWorkspaceFileSafe(rec, rec.kind || kind || \'notes\', \'projects source navigation\', {',
    replace: '      const opened = await openWorkspaceFileSafe(rec, rec, \'projects source navigation\', {',
    suites: S, expect: ['B44', 'B47'], count: 1,
    why: 'The KIND position receives a string, never a record object (kind=[object object]).' },
  { id: 'N02-wrong-open-argument-order', file: VIEW,
    find: '      const opened = await openWorkspaceFileSafe(rec, rec.kind || kind || \'notes\', \'projects source navigation\', {\n        focusLine: Number(line) || 0,\n      });',
    replace: '      const opened = await openWorkspaceFileSafe(rec, { focusLine: Number(line) || 0, reason: \'projects source navigation\' }, \'projects source navigation\');',
    suites: S, expect: ['B44', 'B45', 'B47'], count: 1,
    why: 'file, kind, reason and focusLine travel in their accepted positions.' },
  { id: 'N03-adapter-kind-receives-record', file: ADAPTER,
    find: "      const opened = await globalThis.openWorkspaceFile(record, recordKind, 'projects edit: open source', {",
    replace: "      const opened = await globalThis.openWorkspaceFile(record, record, 'projects edit: open source', {",
    suites: S, expect: ['B44b'], count: 1,
    why: 'The adapter passes kind as a string too.' },
  { id: 'N04-global-apply-unreachable-on-narrow', file: CSS,
    find: '  .projectsChangeBar { position: sticky; bottom: 0; }',
    replace: '  .projectsChangeBar { position: static; } // mutated: the bar is no longer reachable while scrolling',
    suites: S, expect: ['B50'], count: 1,
    why: 'The global Apply bar stays reachable while scrolling on a narrow layout.' },
  { id: 'MOB01-duplicate-mobile-details-controls', file: VIEW,
    find: '    const body = r.managed\n      ? `<div class="projectsDetailsInner" role="cell" data-col="details">${detailsControls(r, d, expanded)}</div>`',
    replace: '    const body = r.managed\n      ? `<div class="projectsDetailsInner" role="cell" data-col="details">${detailsControls(r, d, expanded)}</div><div class="projectsDetailsInner" role="cell" data-col="details">${detailsControls(r, d, expanded)}</div>`',
    suites: S, expect: ['B06', 'B52', 'B52b'], count: 1,
    why: 'Mobile never renders duplicate detail controls.' },
  { id: 'MOB02-duplicate-global-change-bar', file: VIEW,
    find: '      ${changeBarHtml(summary)}\n      ${batchResultHtml(viewState.lastBatchResult)}',
    replace: '      ${changeBarHtml(summary)}\n      ${changeBarHtml(summary)}\n      ${batchResultHtml(viewState.lastBatchResult)}',
    suites: S, expect: ['B50b'], count: 1,
    why: 'There is exactly ONE global Apply / Discard bar on every layout.' },
  { id: 'G01-sidebar-editing', file: IDX,
    find: '      // ACT 5B-2: shared currency owner (same one the Report totals use).',
    replace: '      globalThis.MME_PROJECT_VISUAL_ADAPTER; // mutated: Index calls the adapter\n      // ACT 5B-2: shared currency owner (same one the Report totals use).',
    suites: S, expect: ['R02'], count: 1,
    why: 'The Workspace Index (and Sidebar) stay read-only.' },

  // DEVICE-CORRECTION CONTROLS (FC / AC)
  { id: 'FC1-full-render-per-input', file: VIEW,
    find: "    patchRowForKey(record.key);\n    patchChangeBar();\n    return true;\n  }",
    replace: "    renderInto(ensureContainer()); // mutated: a full rerender per keystroke\n    return true;\n  }",
    suites: S, expect: ['FO01', 'FO05', 'FO06'], count: 1,
    why: 'Typing patches the DOM in place: focus, caret and node identity survive.' },
  { id: 'FC2-replace-input-node', file: VIEW,
    find: "    patchChangeBar();\n    return true;\n  }\n\n  // ---- local DOM patching (no rerender, no focus loss) ----",
    replace: "    patchChangeBar();\n    renderInto(ensureContainer()); // mutated: the input node is replaced\n    return true;\n  }\n\n  // ---- local DOM patching (no rerender, no focus loss) ----",
    suites: S, expect: ['FO01', 'FO05'], count: 1,
    why: 'The focused control node is never replaced while typing.' },
  { id: 'FC3-save-on-input', file: VIEW,
    find: "    viewState.activeEdit = { key: record.key, field, at: Date.now() };",
    replace: "    globalThis.MME_PROJECT_EDIT_HOST.save(); // mutated: typing Saves\n    viewState.activeEdit = { key: record.key, field, at: Date.now() };",
    suites: S, expect: ['FO13'], count: 1,
    why: 'Typing never Saves.' },
  { id: 'FC4-adapter-on-input', file: VIEW,
    find: "    viewState.activeEdit = { key: record.key, field, at: Date.now() };",
    replace: "    adapter().applyProjectFieldChange({ projectId: record.projectId, sourcePath: record.sourcePath, operation: 'setStage', value: raw }); // mutated\n    viewState.activeEdit = { key: record.key, field, at: Date.now() };",
    suites: S, expect: ['FO11'], count: 1,
    why: 'Typing never calls the visual adapter.' },
  { id: 'FC5-lose-draft-after-rerender', file: VIEW,
    find: "    setDraftField(record, field, raw);",
    replace: "    setDraftField(record, field, raw);\n    draftsByProjectId.delete(record.projectId); // mutated: the draft is dropped",
    suites: S, expect: ['FO02', 'FO07', 'B18'], count: 1,
    why: 'A draft survives sequential typing.' },
  { id: 'FC6-no-deferred-refresh', file: VIEW,
    find: "    if (isEditActive()) {\n      deferredRefresh = true;",
    replace: "    if (false) { // mutated: Index-ready destroys the focused control\n      deferredRefresh = true;",
    suites: S, expect: ['FO20'], count: 1,
    why: 'Index-ready during an active edit defers the destructive refresh.' },
  { id: 'AC1-suppress-bounded-reason', file: ADAPTER,
    find: "  function partialOutcome(reason, appliedIds, appliedFields, failed, projects, groups, processed, extra) {\n    const code = boundedReason(reason);",
    replace: "  function partialOutcome(reason, appliedIds, appliedFields, failed, projects, groups, processed, extra) {\n    const code = ''; // mutated: the bounded reason is suppressed",
    suites: S, expect: ['AP22', 'B34'], count: 1,
    why: 'Every failure keeps ONE bounded reason on the result and in the log.' },
  { id: 'AC2-shim-only-source-lookup', file: ADAPTER,
    find: "      let record = null;\n      try { record = globalThis.findWorkspaceFileByPath(path, kind || 'notes'); } catch { record = null; }",
    replace: "      let record = null;\n      try { record = (globalThis.WORKSPACE_STATE.__testOnlyFiles || []).find((f) => f && f.path === path) || null; } catch { record = null; } // mutated: shim-only lookup",
    suites: S, expect: ['AP03', 'AP13'], count: 1,
    why: 'The source record comes from the accepted Workspace file owner.' },
  { id: 'AC4-skip-projectid-reverify', file: ADAPTER,
    find: "        const hits = projectIdPresentIn(proposed, id);",
    replace: "        const hits = 1; // mutated: identity is assumed",
    suites: S, structural: true,
    why: 'INVARIANT (defence in depth): the adapter re-verifies projectId, and the pure owner independently refuses an unresolvable or duplicated identity (AP15/AP17 stay green).' },
  { id: 'AC5-wrong-operation-payload', file: ADAPTER,
    find: "          const request = op.op\n            ? op\n            : { op: op.operation, value: op.value, currency: op.currency, quarter: op.quarter };",
    replace: "          const request = { op: op.op }; // mutated: the accepted payload is lost",
    suites: S, expect: ['AP01', 'AP05'], count: 1,
    why: 'The pure owner receives its accepted { op, value, ... } request shape.' },
  { id: 'AC6-skip-buffer-update', file: ADAPTER,
    find: "      try { buffered = h.applyMarkdown(proposed) !== false; } catch { buffered = false; }",
    replace: "      try { buffered = true; } catch { buffered = false; } // mutated: no buffer update",
    suites: S, expect: ['AP06'], count: 1,
    why: 'ONE programmatic buffer update per source.' },
  { id: 'AC7-rebuild-before-save', file: ADAPTER,
    find: "      logBatch(BATCH_PHASES.SAVE, counts());",
    replace: "      try { await h.rebuildIndex(); } catch {} // mutated: rebuild before Save\n      logBatch(BATCH_PHASES.SAVE, counts());",
    suites: S, expect: ['AP08', 'AP21'], count: 1,
    why: 'The Index rebuilds only AFTER a successful physical Save.' },
  { id: 'AC8-no-route-return', file: ADAPTER,
    find: "        await hostApi.switchTo('projects', { reason: 'projects apply: return' });",
    replace: "        await hostApi.switchTo('journal', { reason: 'mutated: stays on the source' });",
    suites: S, expect: ['AP09'], count: 1,
    why: 'The route returns to Projects after a successful Apply.' },

  // DEVICE-CORRECTION CONTROLS (SC / CC)
  { id: 'SC1-remove-min-height-zero', file: CSS,
    find: "  flex: 1 1 auto;\n  min-height: 0;\n  min-width: 0;\n  overflow-y: auto;",
    replace: "  flex: 1 1 auto;\n  min-width: 0;\n  overflow-y: auto; /* mutated */",
    suites: S, expect: ['SC02'], count: 1,
    why: 'min-height:0 on the flex chain is what allows the body to scroll.' },
  { id: 'SC2-remove-vertical-overflow', file: CSS,
    find: "  overflow-y: auto;\n  overflow-x: hidden;\n  overscroll-behavior: contain;",
    replace: "  overflow: visible; // mutated: the route no longer scrolls",
    suites: S, expect: ['SC03', 'SC10'], count: 1,
    why: 'The Projects body is the single vertical scroll owner.' },
  { id: 'SC3-splitter-visible-in-projects', file: CSS,
    find: "html.projects-view-active .splitter::before { content: none; }",
    replace: "html.projects-view-active .splitter::before { content: '⋮'; } // mutated: the six-dot handle returns",
    suites: S, expect: ['SP01'], count: 1,
    why: 'No splitter handle is visible while Projects is active.' },
  { id: 'SC4-apply-bar-covers-last-row', file: VIEW,
    find: "      ${body}\n      ${changeBarHtml(summary)}",
    replace: "      <div class=\"projectsChangeBarCovering\">${changeBarHtml(summary)}</div>\n      ${body}",
    suites: S, expect: ['SC06'], count: 1,
    why: 'The global Apply bar sits outside the scroll owner and never covers the last row.' },
  { id: 'CC1-rigid-fixed-columns', file: CSS,
    find: "    minmax(2rem, 2.5rem)       /* expand  */\n    minmax(10rem, 2.2fr)       /* Project  */\n    minmax(7rem, 1fr)          /* Stage    */\n    minmax(7rem, 1fr)          /* State    */\n    minmax(9rem, 1.2fr)        /* Value    */\n    minmax(6rem, 0.8fr)        /* Order    */\n    minmax(8rem, 1.1fr);       /* Source   */",
    replace: "    28px 140px 80px 80px 110px 70px 130px; // mutated: rigid pixel columns",
    suites: S, expect: ['CW02', 'CW03', 'CW04'], count: 1,
    why: 'Business columns use flexible minmax() widths, not rigid pixels.' },
  { id: 'CC2-detach-source-into-own-row', file: VIEW,
    find: "        <div class=\"projectsCell projectsCellSource\" role=\"cell\" data-col=\"source\">",
    replace: "        <div class=\"projectsHeadCell\" role=\"columnheader\">Source</div>\n        <div class=\"projectsCell projectsCellSource\" role=\"cell\" data-col=\"source\">",
    suites: S, expect: ['CW06'], count: 1,
    why: 'Source stays attached to the Project row.' },
  { id: 'CC3-remove-cell-min-width', file: CSS,
    find: ".projectsCell { font-size: 12px; color: var(--text); min-width: 0; overflow-wrap: anywhere; }",
    replace: ".projectsCell { font-size: 12px; color: var(--text); overflow-wrap: anywhere; }",
    suites: S, expect: ['CW05'], count: 1,
    why: 'Cells use min-width:0 so a column can shrink to its minimum.' },
  { id: 'CC4-keep-desktop-grid-at-narrow', file: CSS,
    find: "  .projectsHeadRow, .projectsRow {\n    grid-template-columns: 28px minmax(0, 2fr) minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 1fr);\n  }",
    replace: "  .projectsHeadRow, .projectsRow { grid-template-columns: minmax(2rem, 2.5rem) minmax(10rem, 2.2fr) minmax(7rem, 1fr) minmax(7rem, 1fr) minmax(9rem, 1.2fr) minmax(6rem, 0.8fr) minmax(8rem, 1.1fr); } // mutated: desktop grid kept",
    suites: S, expect: ['CW08'], count: 1,
    why: 'The narrow breakpoint replaces the desktop grid instead of narrowing it.' },

  // ---- main.js bridge ----
  { id: 'C31-bridge-bypasses-programmatic-guard', file: MAIN,
    find: '      __programmaticTextChange++;\n      try {\n        md.value = next;\n        if (typeof window.__cmSetText === \'function\') window.__cmSetText(next);\n      } finally {\n        __programmaticTextChange--;\n      }',
    replace: '      md.value = next;\n      if (typeof window.__cmSetText === \'function\') window.__cmSetText(next);',
    suites: S, structural: true,
    why: 'INVARIANT: the bridge keeps the programmatic text-change guard.' },
  { id: 'C32-bridge-second-save-owner', file: MAIN,
    find: '    save: () => saveSmart(),',
    replace: '    save: async () => { const h = globalThis.MME_PROJECT_EDIT_HOST; return saveSmart(); },',
    suites: S, structural: true,
    why: 'INVARIANT: the bridge delegates to the single Save owner.' },
];

console.log('ACT 5C - Projects view / adapter mutation controls');
console.log('='.repeat(62));
const base = BASELINE.map(runSuite);
if (!base.every((b) => b.exit === 0 && b.findings.length === 0)) {
  console.log('BASELINE RED - controls are not meaningful.');
  for (const b of base) if (b.exit !== 0 || b.findings.length) console.log('  ' + b.script + ' -> ' + b.findings.join(','));
  process.exit(1);
}
console.log('baseline: green (' + BASELINE.join(', ') + ')\n');

const TOUCHED = new Map();
function restoreAll() { for (const [abs, text] of TOUCHED) { try { fs.writeFileSync(abs, text); } catch {} } }
process.on('exit', restoreAll);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { restoreAll(); process.exit(130); });
process.on('uncaughtException', (e) => { console.error('DRIVER ERROR:', e && e.stack || e); restoreAll(); process.exit(1); });

const bit = [], notBit = [], restoreFailures = [], postFailures = [], structural = [];
let applied = 0, restoredCount = 0;

const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
for (const m of MUTATIONS) {
  if (ONLY.length && !ONLY.some((o) => String(m.id).indexOf(o) !== -1)) continue;
  const abs = path.join(ROOT, m.file);
  const original = fs.readFileSync(abs, 'utf8');
  const before = sha256(abs);
  TOUCHED.set(abs, original);

  const count = original.split(m.find).length - 1;
  if (count !== (m.count || 1)) { notBit.push({ id: m.id, reason: 'anchor occurs ' + count + ' time(s) - NOT applied' }); continue; }
  const at = original.indexOf(m.find);
  fs.writeFileSync(abs, original.slice(0, at) + m.replace + original.slice(at + m.find.length));
  if (sha256(abs) === before) { fs.writeFileSync(abs, original); notBit.push({ id: m.id, reason: 'no byte change - NOT applied' }); continue; }
  applied += 1;

  const runs = m.suites.map(runSuite);
  const observed = [];
  for (const r of runs) for (const f of r.findings) if (!observed.includes(f)) observed.push(f);
  const hits = (m.expect || []).filter((e) => observed.includes(e));
  const exitZero = runs.every((r) => r.exit === 0);

  fs.writeFileSync(abs, original);
  const restoredOk = sha256(abs) === before;
  if (restoredOk) restoredCount += 1;
  const post = BASELINE.map(runSuite);
  const postGreen = post.every((r) => r.exit === 0 && r.findings.length === 0);

  if (m.structural) {
    structural.push({ id: m.id, restoredOk, observed });
    if (!restoredOk) restoreFailures.push({ id: m.id, reason: 'structural restore NOT byte-identical' });
    console.log('GUARD ' + m.id.padEnd(42) + ' restored=' + (restoredOk ? 'ok' : 'FAIL') + ' observed=' + (observed.join(',') || '(none)'));
    continue;
  }

  if (hits.length) bit.push(m.id);
  else notBit.push({ id: m.id, reason: observed.length ? 'red, but not the intended fixtures: ' + observed.join(',') : (exitZero ? 'no named fixture failed' : 'suite crashed without a named fixture failing') });
  if (!restoredOk) restoreFailures.push({ id: m.id, reason: 'restore NOT byte-identical' });
  if (!postGreen) postFailures.push({ id: m.id, reason: 'baseline did not return to green' });
  console.log((hits.length ? 'BIT  ' : 'NOBIT') + ' ' + m.id.padEnd(42) + ' restored=' + (restoredOk ? 'ok' : 'FAIL') + ' post=' + (postGreen ? 'green' : 'RED') + (hits.length ? ' fixtures=' + hits.join(',') : ' observed=' + (observed.join(',') || '(none)')));
}

restoreAll();
TOUCHED.clear();

console.log('\n' + '='.repeat(62));
console.log('MUTATION CONTROLS (applied AND bit AND restored byte-identically): ' + bit.length);
console.log('  applied:                            ' + applied);
console.log('  bit the expected named fixtures:    ' + bit.length);
console.log('  restored byte-identically:          ' + restoredCount);
console.log('  baseline green after every restore: ' + (postFailures.length === 0 ? 'yes' : 'NO'));
console.log('\nNON-BITING CONTROLS (excluded from the denominator): ' + notBit.length);
for (const n of notBit) console.log('  ' + n.id + ' - ' + n.reason);
console.log('\nSTRUCTURAL GUARDS: ' + structural.length);
for (const s of structural) console.log('  ' + s.id + ' - restored=' + (s.restoredOk ? 'ok' : 'FAIL') + ' observed=' + (s.observed.join(',') || '(none)'));
console.log('\nHONEST TOTALS: ' + bit.length + ' mutation controls passed of ' + applied + ' applied; ' + notBit.length + ' non-biting; ' + structural.length + ' structural guards.');

if (restoreFailures.length) { console.log('\nRESTORE FAILURES:'); for (const r of restoreFailures) console.log('  ' + r.id + ' - ' + r.reason); process.exit(1); }
if (notBit.length) process.exit(1);
process.exit(0);
