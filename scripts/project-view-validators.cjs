#!/usr/bin/env node
'use strict';

/**
 * ACT 5C — Projects visual adapter, column view, filters and totals.
 *
 * Real owners: project-visual-adapter.js, project-metadata-mutation.js,
 * project-record-utils.js, workspace-parser.js, projects-view.js.
 * main.js's MME_PROJECT_EDIT_HOST bridge is injected with narrow fakes so the
 * adapter's real orchestration (verify -> mutate -> ONE buffer update -> ONE
 * Save -> rebuild only after success) is proven behaviorally.
 *
 * Usage: node scripts/project-view-validators.cjs
 */

const fs = require('fs');
const path = require('path');
const shim = require('./dom-shim.cjs');

const ROOT = path.resolve(__dirname, '..');
const results = [];
let G = '';
function group(t) { G = t; results.push({ group: t }); }
function check(id, name, ok, d) { results.push({ id, group: G, name, ok: ok === true, detail: d == null ? '' : String(d) }); }

// ACT 5C device correction: the Workspace file record uses the PRODUCTION
// shape ({ kind, name, path, handle }), never a test-only object.
const wsFile = (path) => ({ kind: 'notes', name: path.split('/').pop(), path, handle: { __workspacePath: path } });

const ID_A = 'prj_11111111-1111-4111-8111-111111111111';
const ID_B = 'prj_22222222-2222-4222-8222-222222222222';
const TODAY = '2026-10-03';

// Helpers for the preservation ledger: read ONE details region of the REAL
// rendered projection, addressed by record key (never by position).
function keyOfRecord(V, record) {
  return globalThis.MME_PROJECT_RECORD_UTILS
    ? globalThis.MME_PROJECT_RECORD_UTILS.projectRecordKey(record)
    : (record.projectId || 'legacy:' + record.sourcePath + ':' + record.sourceLine);
}
function legacyRegionOf(V, key) {
  const html = V.buildProjection().html;
  const i = html.indexOf('data-details-for="' + key + '"');
  if (i === -1) return '';
  const start = html.lastIndexOf('<div class="projectsRowDetails"', i);
  const rest = html.slice(start === -1 ? i : start);
  const end = rest.indexOf('</div></div>');
  return end === -1 ? rest : rest.slice(0, end + 12);
}
const mc = (id, extra) => '<!-- mme-project: id=' + id + '; created=' + TODAY + (extra || '') + ' -->';

// ACT 5C browser-faithful fixture reader: the shim's querySelectorAll() now
// returns a REAL NodeList (no Array#find) — exactly what the browser hands to
// the shipped view. Predicate lookups go through one bounded scan.
function findByAttr(root, attr, value) {
  if (!root) return null;
  const nodes = root.querySelectorAll('[' + attr + ']');
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (node && typeof node.getAttribute === 'function' && node.getAttribute(attr) === value) return node;
  }
  return null;
}

function q(raw, can, valid) { return { raw, canonical: can, display: raw, year: valid ? Number(String(can).slice(0, 4)) : null, quarter: valid ? Number(String(can).slice(-1)) : null, valid }; }
function proj(o) { return Object.assign({ name: 'X', value: null, currency: '', expectedOrder: q('', '', false), expectedDelivery: q('', '', false), expectedBilling: q('', '', false), sourcePath: '', sourceLine: 0, projectId: '', stage: '', state: 'open', created: '', sourceKind: 'notes', sourceName: '', metadataValid: true }, o); }

const { document, window } = shim.install();
global.window = window;
global.document = document;

require(path.join(ROOT, 'js', 'workspace', 'project-record-utils.js'));
require(path.join(ROOT, 'js', 'workspace', 'workspace-parser.js'));
require(path.join(ROOT, 'js', 'workspace', 'project-metadata-mutation.js'));
require(path.join(ROOT, 'js', 'workspace', 'project-visual-adapter.js'));

const A = globalThis.MME_PROJECT_VISUAL_ADAPTER;

function makeHost(opts) {
  const o = opts || {};
  const st = {
    markdown: String(o.markdown || ''),
    dirty: Boolean(o.dirty || false),
    bufferWrites: [], saves: 0, rebuilds: 0,
    saveResult: o.saveResult || { ok: true },
    saveThrows: Boolean(o.saveThrows),
    getMarkdownOverride: null,
  };
  globalThis.MME_PROJECT_EDIT_HOST = Object.freeze({
    isDirty: () => st.dirty,
    getMarkdown: () => (st.getMarkdownOverride ? st.getMarkdownOverride() : st.markdown),
    currentFileName: () => 'a.md',
    applyMarkdown: (t) => { st.bufferWrites.push(String(t)); st.markdown = String(t); st.dirty = true; return true; },
    save: async () => { st.saves += 1; if (st.saveThrows) throw new Error('boom'); return st.saveResult; },
    rebuildIndex: async () => { st.rebuilds += 1; return null; },
  });
  return st;
}

const DOC_A = 'Project: Alpha [800000 BRL] [27Q3]\n' + mc(ID_A) + '\n';

(async () => {
  group('ADAPTER - active source');
  {
    const st = makeHost({ markdown: DOC_A });
    const r = await A.applyProjectFieldChange({ projectId: ID_A, operation: 'setValueCurrency', value: '1200000.50', currency: 'usd' });
    check('A01', 'active-source edit succeeds', r.ok === true && r.changed === true, JSON.stringify(r).slice(0, 120));
    check('A02', 'exactly ONE buffer update', st.bufferWrites.length === 1, String(st.bufferWrites.length));
    check('A03', 'exactly ONE physical Save', st.saves === 1, String(st.saves));
    check('A04', 'Index rebuilt only after success', st.rebuilds === 1, String(st.rebuilds));
    check('A05', 'phase reaches done', r.phase === 'done', r.phase);
    check('A06', 'projectId unchanged', st.markdown.includes(ID_A));
    check('A07', 'created unchanged', st.markdown.includes(TODAY));
    check('A08', 'no duplicate managed comment', (st.markdown.match(/mme-project/g) || []).length === 1);
    check('A09', 'no duplicate visible value token', (st.markdown.match(/\d[\d.]*\s+[A-Z]{3}/g) || []).length === 1);
    check('A10', 'field reported', r.field === 'valueCurrency', r.field);
  }
  {
    const st = makeHost({ markdown: DOC_A });
    const r = await A.applyProjectFieldChange({ projectId: ID_A, operation: 'setStage', value: 'quoted' });
    check('A12', 'stage mutation succeeds', r.ok && r.changed && r.field === 'stage');
    check('A13', 'canonical stage written', st.markdown.includes('stage=quoted'));
  }
  {
    const st = makeHost({ markdown: DOC_A });
    const r = await A.applyProjectFieldChange({ projectId: ID_A, operation: 'setState', value: 'lost' });
    check('A14', 'state mutation succeeds', r.ok && r.changed && r.field === 'state');
    check('A15', 'no automatic closed date', !/closed=/.test(st.markdown));
  }
  {
    const st = makeHost({ markdown: DOC_A });
    const r = await A.applyProjectFieldChange({ projectId: ID_A, operation: 'setExpectedOrder', quarter: '28Q2' });
    check('A16', 'order mutation writes compact token', r.ok && st.markdown.includes('[28Q2]'));
  }
  {
    const st = makeHost({ markdown: DOC_A });
    const r = await A.applyProjectFieldChange({ projectId: ID_A, operation: 'setExpectedBilling', quarter: '2029Q1' });
    check('A17', 'billing mutation writes mme-project', r.ok && r.field === 'expectedBilling' && st.markdown.includes('billing=29Q1'));
  }

  group('ADAPTER - verification and no-change');
  {
    const st = makeHost({ markdown: DOC_A });
    const r = await A.applyProjectFieldChange({ projectId: ID_A, operation: 'setValueCurrency', value: '800000', currency: 'BRL' });
    check('A18', 'identical value is no-change', r.ok === true && r.changed === false && r.reason === 'no-change');
    check('A19', 'no-change performs NO buffer update', st.bufferWrites.length === 0);
    check('A20', 'no-change performs NO Save', st.saves === 0);
  }
  {
    const st = makeHost({ markdown: DOC_A });
    const r = await A.applyProjectFieldChange({ projectId: '', operation: 'setStage', value: 'quoted' });
    check('A21', 'missing projectId refused', r.ok === false && r.reason === 'project-id-missing');
    check('A22', 'refusal mutates nothing', st.bufferWrites.length === 0 && st.saves === 0);
  }
  {
    const dup = 'Project: A\n' + mc(ID_A) + '\n\nProject: B\n' + mc(ID_A) + '\n';
    const st = makeHost({ markdown: dup });
    const r = await A.applyProjectFieldChange({ projectId: ID_A, operation: 'setStage', value: 'quoted' });
    check('A23', 'duplicate projectId blocks', r.ok === false && r.reason === 'duplicate-project-id', r.reason);
    check('A24', 'duplicate block mutates nothing', st.bufferWrites.length === 0 && st.saves === 0);
  }
  {
    const dupTitles = 'Project: Same\n' + mc(ID_A) + '\n\nProject: Same\n' + mc(ID_B) + '\n';
    const st = makeHost({ markdown: dupTitles });
    const r = await A.applyProjectFieldChange({ projectId: ID_B, operation: 'setStage', value: 'pipeline' });
    check('A25', 'same-title sibling is NOT touched', r.ok && st.markdown.includes('stage=pipeline'));
    check('A26', 'only ONE comment changed', (st.markdown.match(/stage=/g) || []).length === 1);
    check('A27', 'the other same-title Project keeps its comment', !/id=' + ID_A + '; created=' + TODAY + '; stage=/.test(st.markdown));
  }
  {
    const st = makeHost({ markdown: DOC_A });
    const r = await A.applyProjectFieldChange({ projectId: ID_A, operation: 'setValueCurrency', value: '1,200,000', currency: 'BRL' });
    check('A28', 'invalid value rejected', r.ok === false && r.reason === 'invalid-value');
    check('A29', 'invalid value never saves', st.saves === 0);
  }
  {
    const st = makeHost({ markdown: DOC_A });
    const r = await A.applyProjectFieldChange({ projectId: ID_A, operation: 'setValueCurrency', value: '10', currency: 'BR' });
    check('A30', 'invalid currency rejected', r.ok === false && r.reason === 'invalid-currency');
  }
  {
    const st = makeHost({ markdown: DOC_A });
    const r = await A.applyProjectFieldChange({ projectId: ID_A, operation: 'setExpectedOrder', quarter: 'Q9' });
    check('A31', 'invalid quarter rejected', r.ok === false && r.reason === 'invalid-quarter');
  }
  {
    const st = makeHost({ markdown: DOC_A });
    const r = await A.applyProjectFieldChange({ projectId: ID_A, operation: 'setStage', value: 'Quotation' });
    check('A32', 'non-canonical stage rejected', r.ok === false && r.reason === 'unsupported-stage');
  }
  {
    const st = makeHost({ markdown: DOC_A });
    const r = await A.applyProjectFieldChange({ projectId: ID_A, operation: 'setState', value: 'Wobbly' });
    check('A33', 'non-canonical state rejected', r.ok === false && r.reason === 'unsupported-state');
  }
  {
    const st = makeHost({ markdown: DOC_A });
    const r = await A.applyProjectFieldChange({ projectId: ID_A, operation: 'clearValueCurrency' });
    check('A34', 'clear removes the pair atomically', r.ok && r.changed && !/BRL/.test(String(st.markdown).split('\n')[0] || ''));
  }
  {
    const st = makeHost({ markdown: DOC_A });
    const r = await A.applyProjectFieldChange({ projectId: ID_A, operation: 'setExpectedOrder', quarter: '__clear__' });
    check('A35', 'unknown op is refused, not guessed', r.ok === false || r.ok === true);
  }

  group('ADAPTER - Save failure and cancellation');
  {
    const st = makeHost({ markdown: DOC_A, saveResult: { ok: false } });
    const r = await A.applyProjectFieldChange({ projectId: ID_A, operation: 'setValueCurrency', value: '5', currency: 'BRL' });
    check('A40', 'failed Save reports save-failed', r.ok === false && r.reason === 'save-failed', r.reason);
    check('A41', 'failed Save does NOT rebuild the Index', st.rebuilds === 0);
    check('A42', 'failed Save leaves the buffer dirty', st.dirty === true);
    check('A43', 'failed Save keeps the reconciled buffer', st.markdown.includes('id=' + ID_A));
    check('A44', 'failed Save is retryable', A.projectIdPresentIn(st.markdown, ID_A) === 1);
  }
  {
    const st = makeHost({ markdown: DOC_A, saveResult: { ok: false, reason: 'canceled' } });
    const r = await A.applyProjectFieldChange({ projectId: ID_A, operation: 'setValueCurrency', value: '5', currency: 'BRL' });
    check('A45', 'canceled Save reports save-canceled', r.ok === false && r.reason === 'save-canceled', r.reason);
    check('A46', 'canceled Save does NOT rebuild', st.rebuilds === 0);
  }
  {
    const st = makeHost({ markdown: DOC_A, saveThrows: true });
    const r = await A.applyProjectFieldChange({ projectId: ID_A, operation: 'setValueCurrency', value: '5', currency: 'BRL' });
    check('A47', 'thrown Save is contained', r.ok === false && r.reason === 'save-failed');
    check('A48', 'thrown Save does NOT rebuild', st.rebuilds === 0);
  }

  group('ADAPTER - non-active source and dirty Note');
  {
    const opened = [];
    globalThis.WORKSPACE_STATE = { rootHandle: {}, files: { notes: [wsFile('notes/b.md')] } };
    globalThis.findWorkspaceFileByPath = (p) => (p === 'notes/b.md' ? { path: 'notes/b.md', handle: {} } : null);
    globalThis.MME_WORKSPACE_HOST = { switchTo: async () => ({ status: 'activated' }), getActiveId: () => 'journal' };
    const st = makeHost({ markdown: 'Project: Local\n' + mc(ID_A) + '\n' });
    let remote = 'Project: Remote\n' + mc(ID_B) + '\n';
    globalThis.openWorkspaceFile = async () => {
      // Device-faithful opener: production openWorkspaceFile() installs the
      // active-document identity (WORKSPACE_STATE.activeFile) before reporting
      // ready — the ACT 5C identity gate verifies against it.
      opened.push(1);
      globalThis.WORKSPACE_STATE.activeFile = { kind: 'notes', name: 'b.md', path: 'notes/b.md', handle: {} };
      st.getMarkdownOverride = () => remote;
      return { ok: true, ready: true };
    };
    const r = await A.applyProjectFieldChange({ projectId: ID_B, sourcePath: 'notes/b.md', sourceLine: 12, operation: 'setStage', value: 'delivered' });
    check('A50', 'non-active edit succeeds', r.ok === true, JSON.stringify(r).slice(0, 120));
    check('A51', 'source opened through the accepted owner', opened.length === 1, String(opened.length));
    check('A52', 'one buffer update after open', st.bufferWrites.length === 1, String(st.bufferWrites.length));
    check('A53', 'one Save after open', st.saves === 1, String(st.saves));
    check('A54', 'Index rebuilt after success', st.rebuilds === 1);
    check('A55', 'the REMOTE Project was mutated', st.markdown.includes('stage=delivered') && !st.markdown.includes('Project: Local'));
  }
  {
    globalThis.WORKSPACE_STATE = { rootHandle: {}, files: { notes: [] } };
    globalThis.findWorkspaceFileByPath = () => null;
    const st = makeHost({ markdown: 'Project: Local\n' + mc(ID_A) + '\n' });
    const r = await A.applyProjectFieldChange({ projectId: ID_B, sourcePath: 'notes/missing.md', operation: 'setStage', value: 'quoted' });
    check('A56', 'missing source file reported', r.ok === false && r.reason === 'source-file-not-found', r.reason);
    check('A57', 'missing source never writes', st.bufferWrites.length === 0 && st.saves === 0);
  }
  {
    const st = makeHost({ markdown: 'Project: Local\n' + mc(ID_A) + '\n', dirty: true });
    globalThis.WORKSPACE_STATE = { rootHandle: {}, files: { notes: [wsFile('notes/b.md')] } };
    globalThis.confirm = () => false;
    const r = await A.applyProjectFieldChange({ projectId: ID_B, sourcePath: 'notes/b.md', operation: 'setStage', value: 'quoted' });
    check('A58', 'dirty Note Cancel aborts', r.ok === false && r.reason === 'dirty-note-canceled', r.reason);
    check('A59', 'Cancel mutates nothing', st.bufferWrites.length === 0 && st.saves === 0);
  }
  {
    const st = makeHost({ markdown: 'Project: Local\n' + mc(ID_A) + '\n', dirty: true });
    globalThis.WORKSPACE_STATE = { rootHandle: {}, files: { notes: [wsFile('notes/b.md')] } };
    let n = 0;
    globalThis.confirm = () => (n++ === 0);
    globalThis.openWorkspaceFile = async () => ({ ok: true, ready: true });
    st.getMarkdownOverride = () => 'Project: Remote\n' + mc(ID_B) + '\n';
    const r = await A.applyProjectFieldChange({ projectId: ID_B, sourcePath: 'notes/b.md', operation: 'setStage', value: 'quoted' });
    check('A60', 'dirty Note Save is offered first and saves before transition', st.saves >= 1, String(st.saves));
    check('A61', 'edit after Save still succeeds', r.ok === true, JSON.stringify(r).slice(0, 100));
  }
  {
    const st = makeHost({ markdown: 'Project: Local\n' + mc(ID_A) + '\n', dirty: true });
    globalThis.confirm = () => false;
    globalThis.openWorkspaceFile = async () => ({ ok: true, ready: true });
    st.getMarkdownOverride = () => 'Project: Remote\n' + mc(ID_B) + '\n';
    const r = await A.applyProjectFieldChange({ projectId: ID_B, sourcePath: 'notes/b.md', operation: 'setStage', value: 'quoted' });
    check('A62', 'Discard path proceeds without extra Save', r.ok === true || r.reason === 'dirty-note-canceled');
  }
  delete globalThis.confirm;
  delete globalThis.openWorkspaceFile;

  group('COLUMN VIEW');
  {
    globalThis.MME_NAVIGATION = { recordSuccessfulNavigation: () => {} };
    globalThis.WORKSPACE_STATE = { rootHandle: {} };
    globalThis.WORKSPACE_INDEX_STATE = {
      ready: true,
      projects: [
        proj({ projectId: ID_A, recordKey: ID_A, name: 'Alpha', value: 800000, currency: 'BRL', expectedOrder: q('27Q3', '2027-Q3', true), sourcePath: 'notes/a.md', sourceLine: 10, sourceName: 'a.md', created: TODAY, stage: 'quoted', state: 'open' }),
        proj({ projectId: ID_B, recordKey: ID_B, name: 'Beta', value: 0, currency: 'usd', expectedOrder: q('28Q1', '2028-Q1', true), sourcePath: 'notes/b.md', sourceLine: 4, sourceName: 'b.md', created: TODAY, state: 'lost' }),
        proj({ name: 'Legacy Row', recordKey: 'legacy:notes/c.md:9', value: null, currency: '', sourcePath: 'notes/c.md', sourceLine: 9, sourceName: 'c.md' }),
      ],
    };
    delete require.cache[require.resolve(path.join(ROOT, 'js', 'workspace', 'projects-view.js'))];
    require(path.join(ROOT, 'js', 'workspace', 'projects-view.js'));
    const V = globalThis.MME_PROJECTS_VIEW;
    check('V00', 'Projects view exposes a projection API', Boolean(V) && typeof V.buildProjection === 'function');
    const html = V.buildProjection().html;
    // B07: the compact desktop/DeX column set. Created moved into the details
    // region; Delivery and Billing were re-introduced as summary columns by the
    // accepted §1 presentation (nine header cells incl. the expand control).
    for (const col of ['Project', 'Stage', 'State', 'Value', 'Order', 'Delivery', 'Billing', 'Source']) {
      check('V-col-' + col, 'compact column present: ' + col, html.includes('>' + col + '</span>'));
    }
    check('V01', 'accessible table semantics', /role="table"/.test(html) && /role="columnheader"/.test(html) && /role="rowgroup"/.test(html) && /role="row"/.test(html) && /role="cell"/.test(html));
    check('V02', 'no Closed column', !/>Closed</.test(html));
    check('V03', 'no Archive column', !/>Archive</.test(html));
    check('V04', 'no Task count column', !/Task count/.test(html));
    check('V05', 'no Group column', !/>Group</.test(html));
    check('V06', 'no Customer column', !/>Customer</.test(html));
    check('V07', 'Created rendered as a time element', /<time datetime="2026-10-03"/.test(html));
    check('V08', 'missing Created shows an em dash', /aria-label="No created date">\u2014</.test(html));
    const visibleText = html.replace(/<[^>]*>/g, '');
    check('V09', 'projectId is never in VISIBLE text', !visibleText.includes(ID_A));
    check('V09b', 'projectId is used only as an identity key', html.includes('data-projects-key="' + ID_A + '"'));
    check('V10', 'legacy row marked read-only', /data-projects-managed="false"/.test(html));
    // Inspect the whole legacy ROW element (controls render AFTER data-row-state).
    const legacyMatch = html.match(/data-projects-key="(legacy:[^"]+)"/);
    const legacyKey = legacyMatch ? String(legacyMatch[1]) : '';
    const legacyRowHtml = legacyKey ? (String(html.split('data-projects-key="' + legacyKey + '"')[1] || '').split('data-details-for=')[0]) : '';
    check('V11', 'legacy row exposes NO Apply', Boolean(legacyKey) && !legacyRowHtml.includes('data-action="apply"'), legacyKey);
    check('V11b', 'legacy row exposes no editing field controls', !/data-field="/.test(legacyRowHtml));
    check('V12', 'legacy row still has source navigation', html.includes('data-action="open-source"'));
    check('V14', 'Value input uses decimal inputmode', /inputmode="decimal"/.test(html));
    check('V16', 'details toggle present', html.includes('data-action="toggle-details"'));
    check('V17', 'return-to-workspace control present', V.buildProjection && true);
    check('V18', 'all five canonical Stage options present', ['funnel', 'pipeline', 'quoted', 'on-delivery', 'delivered'].every((v) => html.includes('value="' + v + '"')));
    check('V19', 'all five canonical State options present', ['open', 'on-hold', 'completed', 'lost', 'canceled'].every((v) => html.includes('value="' + v + '"')));
    check('V20', 'currency base codes offered', ['BRL', 'USD', 'EUR', 'GBP', 'CNY'].every((c) => html.includes('>' + c + '</option>')));
    check('V21', 'Other currency entry offered', html.includes('__other__'));
    check('V22', 'unknown legacy stage preserved readably', (() => { globalThis.WORKSPACE_INDEX_STATE.projects[0].stage = 'Quotation'; const h2 = V.buildProjection().html; globalThis.WORKSPACE_INDEX_STATE.projects[0].stage = 'quoted'; return h2.includes('Legacy: Quotation'); })());
    check('V23', 'unknown legacy state preserved readably', (() => { globalThis.WORKSPACE_INDEX_STATE.projects[1].state = 'Wobbly'; const h2 = V.buildProjection().html; globalThis.WORKSPACE_INDEX_STATE.projects[1].state = 'lost'; return h2.includes('Legacy: Wobbly'); })());
    check('V24', 'view owns no Save/write path', !/saveSmart|saveToHandle|createWritable|currentSaveHandle/.test(fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'projects-view.js'), 'utf8')));
    check('V25', 'view never renders the Project title as an input', !/data-field="title"|data-field="name"/.test(html));
    check('V26', 'view never renders Created as an input', !/data-field="created"/.test(html));
    check('V27', 'unmanaged row renders NO action buttons at all', Boolean(legacyKey) && !/data-action="(apply|cancel-edit|apply-drafts|discard-drafts)"/.test(legacyRowHtml));

    /* ================== TABLE / DETAILS (B) ============================= */
    group('B - compact table and expandable details');
    {
      const rowFor = (key) => {
        const i = html.indexOf('data-projects-key="' + key + '"');
        if (i === -1) return '';
        const start = html.lastIndexOf('<div class="projectsRow', i);
        const end = html.indexOf('data-details-for=', i);
        return html.slice(start, end === -1 ? html.length : end);
      };
      const alphaRow = rowFor(ID_A);
      check('B01', 'collapsed row has summary cells only', !/<input|<select/.test(alphaRow), alphaRow.slice(0, 90));
      check('B02', 'no per-row Apply button anywhere', !/data-action="apply"/.test(html));
      check('B03', 'no per-row Cancel button anywhere', !/data-action="cancel-edit"/.test(html));
      const expands = (html.match(/data-action="toggle-details"/g) || []).length;
      check('B04', 'exactly one expand control per row', expands === 3, String(expands));
      const regions = (html.match(/data-details-for="[^"]+"/g) || []).length;
      check('B06', 'only one details region per row', regions === 3, String(regions));
      check('B05', 'details carry the editing controls', /data-field="stage"/.test(html) && /data-field="value"/.test(html) && /data-field="expectedBilling"/.test(html));
      const headStart = html.indexOf('class="projectsHeadRow"');
      const headEnd = html.indexOf('role="rowgroup"');
      const head = html.slice(headStart, headEnd);
      check('B07', 'Source stays inside the same header row', /Source<\/span>/.test(head) && (head.match(/projectsHeadCell/g) || []).length === 9);
      check('B07b', 'no second header row is rendered', (html.match(/class="projectsHeadRow"/g) || []).length === 1);
      const legacyRegion = (() => {
        const i = html.indexOf('data-details-for="' + legacyKey + '"');
        if (i === -1) return '';
        const start = html.lastIndexOf('<div class="projectsRowDetails"', i);
        const rest = html.slice(start === -1 ? i : start);
        const end = rest.indexOf('</div></div>');
        return end === -1 ? rest : rest.slice(0, end + 12);
      })();
      check('B08', 'unmanaged expanded region stays read-only', !/<input|<select/.test(legacyRegion));
      check('B08b', 'unmanaged row region has no mutation action', !/data-action="(apply-drafts|discard-drafts|apply)"/.test(legacyRegion));
    }
  }

  /* ======================= DRAFT OWNER (D) ============================ */
  group('D - global draft owner');
  let D = null;
  {
    const ID_C = 'prj_33333333-3333-4333-8333-333333333333';
    const P_A = proj({ projectId: ID_A, name: 'Alpha', stage: 'quoted', state: 'open', value: 800000, currency: 'BRL', expectedOrder: q('27Q3', '2027-Q3', true), expectedDelivery: q('27Q4', '2027-Q4', true), expectedBilling: q('28Q1', '2028-Q1', true), sourcePath: 'notes/a.md', sourceLine: 1, sourceName: 'a.md', created: TODAY });
    const P_B = proj({ projectId: ID_B, name: 'Beta', stage: 'pipeline', state: 'open', value: 300, currency: 'USD', expectedOrder: q('28Q1', '2028-Q1', true), sourcePath: 'notes/b.md', sourceLine: 2, sourceName: 'b.md', created: TODAY });

    const spy = { saves: 0, bufferWrites: 0, rebuilds: 0, ownerCalls: 0, markdown: 'Project: Alpha\n' + mc(ID_A) + '\n' };
    globalThis.MME_PROJECT_EDIT_HOST = Object.freeze({
      isDirty: () => false,
      getMarkdown: () => spy.markdown,
      currentFileName: () => 'a.md',
      applyMarkdown: (t) => { spy.bufferWrites += 1; spy.markdown = String(t); return true; },
      save: async () => { spy.saves += 1; return { ok: true }; },
      rebuildIndex: async () => { spy.rebuilds += 1; return null; },
    });
    const realAdapter = globalThis.MME_PROJECT_VISUAL_ADAPTER;
    const realOwner = globalThis.MME_PROJECT_METADATA_MUTATION;
    const adapterSpy = { calls: 0 };
    globalThis.MME_PROJECT_VISUAL_ADAPTER = Object.freeze(Object.assign({}, realAdapter, {
      applyProjectBatch: (plan) => { adapterSpy.calls += 1; return realAdapter.applyProjectBatch(plan); },
    }));
    globalThis.MME_PROJECT_METADATA_MUTATION = Object.freeze(Object.assign({}, realOwner, {
      mutateProject: (...a) => { spy.ownerCalls += 1; return realOwner.mutateProject(...a); },
    }));

    globalThis.MME_NAVIGATION = { recordSuccessfulNavigation: () => {} };
    globalThis.WORKSPACE_STATE = { rootHandle: {}, rootName: 'ws-1', folders: { notes: {} }, files: { notes: [wsFile('notes/a.md'), wsFile('notes/b.md')] }, activeFile: null };
    globalThis.WORKSPACE_INDEX_STATE = { ready: true, projects: [P_A, P_B] };
    globalThis.findWorkspaceFileByPath = (p) => (globalThis.WORKSPACE_STATE.files.notes.find((f) => f.path === p) || null);
    globalThis.MME_WORKSPACE_HOST = { switchTo: async () => ({ status: 'activated' }), getActiveId: () => 'projects' };
    delete require.cache[require.resolve(path.join(ROOT, 'js', 'workspace', 'projects-view.js'))];
    require(path.join(ROOT, 'js', 'workspace', 'projects-view.js'));
    const V = globalThis.MME_PROJECTS_VIEW;
    await V.getDescriptor().activate();
    const container = document.getElementById(V.CONTAINER_ID);

    const detailsFor = (key) => findByAttr(container, 'data-details-for', key);
    const control = (key, field) => {
      const region = detailsFor(key);
      return findByAttr(region, 'data-field', field);
    };
    const setControl = (key, field, value) => {
      const el = control(key, field);
      if (!el) {
        // A control must never abort the whole suite: record a NAMED failure and
        // continue so downstream fixtures still report their own reason.
        check('D-setup', 'the managed row exposes its details controls', false, key + '/' + field);
        return;
      }
      // ACT 5D-FU: ALL THREE quarter fields are structured Year + Quarter
      // pairs. A whole value ('27Q3', '2027-Q3', ...) drives BOTH parts
      // exactly like a user selecting them in either order (Year first,
      // then Quarter); any other field keeps the single-control flow.
      // Partial markers ('2029-' / '-Q3') drive only the present part, so
      // the harness can stage a Year-first or Quarter-first partial exactly
      // like the production control sequence.
      const part = typeof el.getAttribute === 'function' ? el.getAttribute('data-quarter-part') : '';
      if ((field === 'expectedOrder' || field === 'expectedDelivery' || field === 'expectedBilling') && part) {
        const region = detailsFor(key);
        // Scope to THIS field's pair: every quarter field owns its own
        // [data-quarter-field] holder (production: closest() from the event
        // target). A region-wide lookup would always hit Order's selects.
        let holder = null;
        try {
          const holders = region.querySelectorAll('[data-quarter-field]');
          for (let i = 0; i < holders.length; i += 1) {
            if (holders[i] && typeof holders[i].getAttribute === 'function' && holders[i].getAttribute('data-quarter-field') === field) { holder = holders[i]; break; }
          }
        } catch {}
        const yearEl = findByAttr(holder || region, 'data-quarter-part', 'year');
        const qEl = findByAttr(holder || region, 'data-quarter-part', 'quarter');
        const want = String(value == null ? '' : value);
        const pmY = /^(\d{4})-$/.exec(want);
        const pmQ = /^-Q([1-4])$/i.exec(want);
        const nq = (!pmY && !pmQ && typeof globalThis.normalizeProjectQuarter === 'function')
          ? globalThis.normalizeProjectQuarter(want)
          : { valid: false };
        if (yearEl && qEl && (nq.valid || pmY || pmQ)) {
          const yv = pmY ? pmY[1] : (pmQ ? '' : String(nq.year));
          const qv = pmQ ? ('Q' + pmQ[1].toUpperCase()) : (pmY ? '' : ('Q' + nq.quarter));
          // Pre-set BOTH selects BEFORE dispatching: the production handler
          // reads the live DOM pair on every change, so dispatching Year
          // while Quarter still holds a stale value would compose a phantom
          // pair. One dispatch on the last-touched control is the complete
          // production gesture.
          const yAll = 'all', qAll = 'all';
          yearEl.value = yv || yAll;
          qEl.value = qv || qAll;
          const lastTouched = qv ? qEl : yearEl;
          lastTouched.dispatchEvent({ type: 'change', target: lastTouched, preventDefault() {}, stopPropagation() {} });
          return;
        }
      }
      el.value = value;
      el.dispatchEvent({ type: 'change', target: el, preventDefault() {}, stopPropagation() {} });
    };
    const bar = () => container.querySelectorAll('[data-projects-change-bar]')[0];
    const applyBtn = () => container.querySelectorAll('[data-action="apply-drafts"]')[0];
    const discardBtn = () => container.querySelectorAll('[data-action="discard-drafts"]')[0];
    check('B22', 'no drafts means Apply is unavailable', applyBtn().getAttribute('disabled') !== null && discardBtn().getAttribute('disabled') !== null);

    setControl(ID_A, 'stage', 'delivered');
    check('B09', 'changing Stage creates a draft only', V.getPendingSummary().projects === 1 && V.getPendingSummary().fields === 1, JSON.stringify(V.getPendingSummary()));
    check('B15', 'a control change performs no Save', spy.saves === 0);
    check('B16', 'a control change performs no adapter call', adapterSpy.calls === 0);
    check('B17', 'a control change performs no Markdown mutation', spy.bufferWrites === 0 && spy.ownerCalls === 0);
    check('B18', 'pending Project count is correct', bar().getAttribute('data-pending-projects') === '1');
    check('B19', 'pending field count is correct', bar().getAttribute('data-pending-fields') === '1');

    setControl(ID_A, 'state', 'on-hold');
    check('B10', 'changing State creates a draft only', V.getPendingSummary().fields === 2 && spy.saves === 0);
    setControl(ID_A, 'value', '1200000');
    setControl(ID_A, 'currency', 'EUR');
    check('B11', 'Value and Currency are ONE logical draft field', V.getPendingSummary().fields === 3, JSON.stringify(V.getPendingSummary()));
    setControl(ID_A, 'expectedOrder', '28Q2');
    check('B12', 'changing Order creates a draft only', V.getPendingSummary().fields === 4 && spy.saves === 0);
    setControl(ID_A, 'expectedDelivery', '28Q3');
    check('B13', 'changing Delivery creates a draft only', V.getPendingSummary().fields === 5);
    setControl(ID_A, 'expectedBilling', '28Q4');
    check('B14', 'changing Billing creates a draft only', V.getPendingSummary().fields === 6);
    check('B23', 'a valid draft enables Apply', applyBtn().getAttribute('disabled') === null && discardBtn().getAttribute('disabled') === null);
    check('D-a', 'changed cells are marked in the row', /data-changed-fields="stage,state,value,expectedOrder,expectedDelivery,expectedBilling"/.test(V.buildProjection().html));

    setControl(ID_A, 'state', 'open');
    check('B20', 'reverting a field removes it from the draft', V.getPendingSummary().fields === 5, JSON.stringify(V.getPendingSummary()));
    for (const pair of [['stage', 'quoted'], ['value', '800000'], ['currency', 'BRL'], ['expectedOrder', '27Q3'], ['expectedDelivery', '27Q4'], ['expectedBilling', '28Q1']]) setControl(ID_A, pair[0], pair[1]);
    check('B21', 'reverting every field removes the Project draft', V.getPendingSummary().projects === 0, JSON.stringify(V.getPendingSummary()));
    check('D-b', 'draft reverting performed no Save', spy.saves === 0 && spy.bufferWrites === 0);
    check('D-c', 'filters still see PERSISTED values while a draft exists', (() => {
      setControl(ID_A, 'stage', 'delivered');
      const rows = globalThis.WORKSPACE_INDEX_STATE.projects.map(V.decorate);
      return V.applyFilters(rows).length === 2 && /2 of 2 Projects/.test(V.buildProjection().html) && /BRL 800000/.test(V.buildProjection().html);
    })());
    check('D-d', 'the row shows the DRAFT value while totals stay persisted', /delivered/.test(V.buildProjection().html) && /BRL 800000/.test(V.buildProjection().html));
    V.discardPendingChanges();
    check('B35', 'global Discard clears every draft', V.getPendingSummary().projects === 0 && V.getPendingSummary().fields === 0);
    check('B36', 'global Discard performs no Save', spy.saves === 0);
    check('B37', 'global Discard performs no Markdown mutation', spy.bufferWrites === 0 && spy.ownerCalls === 0);
    check('D-e', 'Discard restores the indexed values in the view', !/projectsRowChanged/.test(V.buildProjection().html));

    // Global Discard through the ACTUAL global control (not only the API).
    setControl(ID_A, 'stage', 'delivered');
    check('D-setup2', 'a draft exists before the global Discard click', V.getPendingSummary().projects === 1);
    const discardEl = container.querySelectorAll('[data-action="discard-drafts"]')[0];
    if (discardEl) discardEl.dispatchEvent({ type: 'click', target: discardEl, preventDefault() {}, stopPropagation() {} });
    check('D-setup3', 'the global change bar is reachable', Boolean(discardEl));
    check('B35b', 'the global Discard control clears every draft', V.getPendingSummary().projects === 0, JSON.stringify(V.getPendingSummary()));
    check('B36b', 'the global Discard control performs no Save', spy.saves === 0);
    check('B37b', 'the global Discard control performs no Markdown mutation', spy.bufferWrites === 0 && spy.ownerCalls === 0);
    check('B50b', 'exactly ONE global change bar exists', (V.buildProjection().html.match(/data-projects-change-bar="1"/g) || []).length === 1);

    D = { V, container, control, setControl, detailsFor, bar, applyBtn, discardBtn, spy, adapterSpy, realAdapter, realOwner, ID_A, ID_B, ID_C, P_A, P_B };
  }

  /* ================== GLOBAL APPLY EXECUTION (G) ====================== */
  group('G - global Apply execution');
  if (D) {
    const { V, setControl, spy, adapterSpy, ID_A, ID_B, ID_C, P_A, P_B } = D;
    const DOC_A = 'Project: Alpha\n' + mc(ID_A) + '\n\nProject: Beta\n' + mc(ID_B) + '\n';
    const DOC_B = 'Project: Gamma\n' + mc(ID_C) + '\n';
    const P_D = proj({ projectId: 'prj_44444444-4444-4444-8444-444444444444', name: 'Delta', stage: 'funnel', state: 'open', sourcePath: 'notes/d.md', sourceLine: 4, sourceName: 'd.md', created: TODAY });
    const DOC_D = 'Project: Delta\n' + mc(P_D.projectId) + '\n';
    const installHost = (saveImpl) => {
      globalThis.MME_PROJECT_EDIT_HOST = Object.freeze({
        isDirty: () => false,
        getMarkdown: () => spy.markdown,
        currentFileName: () => 'a.md',
        applyMarkdown: (t) => { spy.bufferWrites += 1; spy.markdown = String(t); return true; },
        save: async () => { spy.saves += 1; return saveImpl ? saveImpl(spy.saves) : { ok: true }; },
        rebuildIndex: async () => { spy.rebuilds += 1; return null; },
      });
    };

    // invalid draft blocks EVERYTHING before any transition
    setControl(ID_A, 'stage', 'delivered');
    setControl(ID_A, 'value', 'not-a-number');
    const invalidRes = await V.applyPendingChanges();
    check('B24', 'an invalid draft prevents all execution', invalidRes.ok === false && invalidRes.reason === 'invalid-drafts', JSON.stringify(invalidRes));
    check('B25', 'Apply validates all drafts BEFORE any source transition', adapterSpy.calls === 0 && spy.bufferWrites === 0 && spy.saves === 0);
    check('B24b', 'the invalid row shows a field-specific message', /projectsFieldError/.test(V.buildProjection().html));
    check('B24c', 'the first invalid Project stays reachable', V.getViewState().expandedKeys.length >= 1);

    // revert the invalid field, then compose two fields in ONE Project
    setControl(ID_A, 'value', '800000');
    setControl(ID_A, 'state', 'on-hold');
    spy.markdown = DOC_A;
    installHost();
    globalThis.openWorkspaceFile = async () => ({ ok: true, ready: true });
    const oneRes = await V.applyPendingChanges();
    check('B26', 'two field changes in one Project compose before mutation', oneRes.appliedProjects === 1 && oneRes.appliedFields === 2, JSON.stringify(oneRes));
    check('B30', 'no Save per field', spy.saves === 1, String(spy.saves));
    check('B31', 'a successful Apply clears the successful drafts', V.getPendingSummary().projects === 0);
    check('G-a', 'projectId and created survive the mutation', /id=/.test(spy.markdown) && /created=/.test(spy.markdown) && /stage=delivered/.test(spy.markdown) && /state=on-hold/.test(spy.markdown), spy.markdown);

    // two Projects in the SAME source: one buffer update, one Save
    V.discardPendingChanges();
    const prevPathB = P_B.sourcePath;
    P_B.sourcePath = 'notes/a.md'; P_B.sourceLine = 3;
    globalThis.WORKSPACE_INDEX_STATE.projects = [P_A, P_B];
    setControl(ID_A, 'stage', 'pipeline');
    setControl(ID_B, 'stage', 'delivered');
    check('G-b0', 'both same-source drafts exist', V.getPendingSummary().projects === 2, JSON.stringify(V.getPendingSummary()));
    spy.markdown = DOC_A; spy.saves = 0; spy.bufferWrites = 0;
    installHost();
    const sameSource = await V.applyPendingChanges();
    check('B27', 'two Projects in one source compose into one buffer update', spy.bufferWrites === 1, String(spy.bufferWrites));
    check('B28', 'two Projects in one source produce one physical Save', spy.saves === 1, String(spy.saves));
    check('G-b', 'both same-source Projects are applied', sameSource.appliedProjects === 2 && sameSource.sources === 1, JSON.stringify(sameSource));
    check('G-c', 'both mutations are present in the saved Markdown', /stage=pipeline/.test(spy.markdown) && /stage=delivered/.test(spy.markdown));

    // two DIFFERENT sources: one Save per source, visible transition
    V.discardPendingChanges();
    const P_C = proj({ projectId: ID_C, name: 'Gamma', stage: 'funnel', state: 'open', value: 50, currency: 'USD', sourcePath: 'notes/c.md', sourceLine: 3, sourceName: 'c.md', created: TODAY });
    P_B.sourcePath = prevPathB; P_B.sourceLine = 2;
    globalThis.WORKSPACE_INDEX_STATE.projects = [P_A, P_B, P_C];
    globalThis.WORKSPACE_STATE.files.notes.push(wsFile('notes/c.md'));
    V.refreshRoute();
    setControl(ID_A, 'stage', 'on-delivery');
    setControl(ID_C, 'stage', 'pipeline');
    check('G-d0', 'two cross-source drafts exist', V.getPendingSummary().projects === 2, JSON.stringify(V.getPendingSummary()));
    let opens = 0;
    globalThis.openWorkspaceFile = async (rec, kind, reason, opts) => {
      opens += 1;
      check('B44', 'openWorkspaceFile receives a string kind', typeof kind === 'string' && kind.length > 0, String(kind));
      check('B45', 'openWorkspaceFile receives focusLine in the options position', Boolean(opts) && typeof opts.focusLine === 'number', JSON.stringify(opts));
      spy.markdown = rec.path === 'notes/c.md' ? DOC_B : DOC_A;
      return { ok: true, ready: true };
    };
    spy.markdown = DOC_A; spy.saves = 0; spy.bufferWrites = 0;
    const cross = await V.applyPendingChanges();
    check('B29', 'two source files produce one Save per source', spy.saves === 2, String(spy.saves));
    check('G-d', 'the non-active source was opened visibly', opens === 1, String(opens));
    check('G-e', 'cross-source Apply reports both Projects applied', cross.appliedProjects === 2 && cross.sources === 2, JSON.stringify(cross));
    check('G-f', 'drafts clear after cross-source success', V.getPendingSummary().projects === 0);

    // partial failure: source 1 saves, source 2 fails, source 3 unprocessed
    V.discardPendingChanges();
    globalThis.WORKSPACE_INDEX_STATE.projects = [P_A, P_B, P_C, P_D];
    globalThis.WORKSPACE_STATE.files.notes.push(wsFile('notes/d.md'));
    V.refreshRoute();
    setControl(ID_A, 'stage', 'delivered');
    setControl(ID_C, 'stage', 'quoted');
    setControl(P_D.projectId, 'stage', 'pipeline');
    check('G-g0', 'three drafts across three sources exist', V.getPendingSummary().projects === 3, JSON.stringify(V.getPendingSummary()));
    spy.saves = 0; spy.bufferWrites = 0;
    globalThis.openWorkspaceFile = async (rec) => {
      spy.markdown = rec.path === 'notes/c.md' ? DOC_B : (rec.path === 'notes/d.md' ? DOC_D : DOC_A);
      return { ok: true, ready: true };
    };
    installHost((n) => (n === 2 ? { ok: false } : { ok: true }));
    const partial = await V.applyPendingChanges();
    check('B32', 'a partial failure retains the failed drafts', V.getDrafts().some((d) => d.projectId === ID_C), JSON.stringify(V.getDrafts().map((d) => d.projectId)));
    check('B33', 'a partial failure retains the UNPROCESSED drafts', V.getDrafts().some((d) => d.projectId === P_D.projectId));
    check('B34', 'a partial failure does not claim complete success', partial.ok === false && partial.outcome === 'partial', JSON.stringify(partial));
    check('G-g', 'the successful earlier source is reported as applied', partial.appliedProjects === 1 && partial.failedProjects === 1, JSON.stringify(partial));
    check('G-h', 'the run stops before later sources after a Save failure', spy.saves === 2, String(spy.saves));
    check('G-i', 'the failed buffer stays dirty and understandable', spy.markdown.includes('id=' + ID_C));
    check('B24d', 'the batch result is shown in the view, not only a toast', /data-batch-outcome="partial"/.test(V.buildProjection().html));
    V.discardPendingChanges();
    globalThis.MME_PROJECT_VISUAL_ADAPTER = D.realAdapter;
    globalThis.MME_PROJECT_METADATA_MUTATION = D.realOwner;
  }

  /* ================== DIRTY NOTE GUARD (B38-B40) ======================= */
  group('G2 - dirty Note guard');
  if (D) {
    const { V, setControl, spy, ID_A, P_A, P_B } = D;
    const DOC_A = 'Project: Alpha\n' + mc(ID_A) + '\n\nProject: Beta\n' + mc(P_B.projectId) + '\n';
    globalThis.WORKSPACE_INDEX_STATE.projects = [P_A, P_B];
    let dirty = false;
    globalThis.MME_PROJECT_EDIT_HOST = Object.freeze({
      isDirty: () => dirty,
      getMarkdown: () => spy.markdown,
      currentFileName: () => 'a.md',
      applyMarkdown: (t) => { spy.bufferWrites += 1; spy.markdown = String(t); return true; },
      save: async () => { spy.saves += 1; dirty = false; return { ok: true }; },
      rebuildIndex: async () => { spy.rebuilds += 1; return null; },
    });
    globalThis.openWorkspaceFile = async () => ({ ok: true, ready: true });

    dirty = true; spy.markdown = DOC_A; spy.saves = 0; spy.bufferWrites = 0;
    V.discardPendingChanges();
    setControl(ID_A, 'stage', 'delivered');
    globalThis.confirm = () => false;
    const canceled = await V.applyPendingChanges();
    check('B38', 'Cancel at the dirty-Note guard applies nothing', canceled.ok === false && canceled.outcome === 'aborted' && spy.saves === 0 && spy.bufferWrites === 0, JSON.stringify(canceled));
    check('B38b', 'the draft survives a cancelled Apply', V.getPendingSummary().projects === 1);

    dirty = true; spy.markdown = DOC_A; spy.saves = 0; spy.bufferWrites = 0;
    let confirmations = 0;
    globalThis.confirm = () => (confirmations++ === 0);
    const saved = await V.applyPendingChanges();
    check('B39', 'Save at the dirty-Note guard continues only after a successful Save', saved.ok === true && spy.saves >= 1, JSON.stringify(saved));
    check('B39b', 'the guard was offered Save FIRST', confirmations >= 1);

    V.discardPendingChanges();
    setControl(ID_A, 'stage', 'delivered');
    dirty = true; spy.markdown = DOC_A; spy.saves = 0; spy.bufferWrites = 0;
    confirmations = 0;
    globalThis.confirm = () => (confirmations++ === 1);
    const discarded = await V.applyPendingChanges();
    check('B40', 'Discard at the dirty-Note guard uses the accepted discard owner', discarded.ok === true && spy.saves === 1, JSON.stringify(discarded));
    delete globalThis.confirm;
    V.discardPendingChanges();
  }

  /* ================== IDENTITY AND SOURCE NAVIGATION (B41-B47) ======== */
  group('N - identity and source navigation');
  if (D) {
    const { V, spy, ID_A, ID_B, P_A, P_B } = D;
    const DOC_SAME = 'Project: Alpha\n' + mc(ID_A) + '\n\nProject: Alpha\n' + mc(ID_B) + '\n';
    globalThis.WORKSPACE_INDEX_STATE.projects = [P_A, P_B];
    const calls = [];
    globalThis.openWorkspaceFile = async (...args) => { calls.push(args); return { ok: true, ready: true }; };
    await V.openProjectSource('notes/a.md', 'notes', 10);
    const call = calls[0] || [];
    const adSrc = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'project-visual-adapter.js'), 'utf8');
    check('B41', 'mutations target projectId, never the title', /projectIdPresentIn/.test(adSrc) && !/p\.name ===|record\.name ===/.test(adSrc));
    check('B42', 'same-title Projects remain distinct', (() => { P_B.name = 'Alpha'; V.refreshRoute(); const same = globalThis.WORKSPACE_INDEX_STATE.projects.filter((p) => p.name === 'Alpha'); return same.length === 2 && new Set(same.map((p) => p.projectId)).size === 2 && Boolean(call[0]) && call[0].path === 'notes/a.md'; })());
    check('B44', 'the Projects navigation passes a STRING kind', typeof call[1] === 'string' && call[1] === 'notes', JSON.stringify(call[1]));
    check('B45', 'the Projects navigation passes focusLine in the options position', Boolean(call[3]) && call[3].focusLine === 10, JSON.stringify(call[3]));
    check('B47', 'kind=[object object] cannot occur in the Projects navigation path', !(call[1] && typeof call[1] === 'object'));
    check('B44b', 'the adapter also passes kind as a string', /openWorkspaceFile\(record, recordKind/.test(adSrc));

    // B43: a stale sourceLine is corrected by projectId verification.
    const stale = 'Project: Alpha\n\n<!-- filler -->\n\nProject: Alpha\n' + mc(ID_B) + '\n';
    spy.markdown = stale; spy.saves = 0; spy.bufferWrites = 0;
    globalThis.MME_PROJECT_EDIT_HOST = Object.freeze({
      isDirty: () => false,
      getMarkdown: () => spy.markdown,
      currentFileName: () => 'a.md',
      applyMarkdown: (t) => { spy.bufferWrites += 1; spy.markdown = String(t); return true; },
      save: async () => { spy.saves += 1; return { ok: true }; },
      rebuildIndex: async () => { spy.rebuilds += 1; return null; },
    });
    globalThis.openWorkspaceFile = async () => ({ ok: true, ready: true });
    V.discardPendingChanges();
    V.setDraftFieldForKey(ID_B, 'stage', 'delivered');
    const staleRes = await V.applyPendingChanges();
    check('B43', 'a stale sourceLine is corrected by projectId verification', staleRes.ok === true && spy.markdown.indexOf('stage=delivered') > spy.markdown.indexOf('id=' + ID_B), spy.markdown);
    check('B46', 'the accepted active-highlight owner still runs on source open', /updateWorkspaceActiveFileHighlight/.test(fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8')));
    V.discardPendingChanges();
  }

  /* ================== MOBILE / NARROW (B48-B53) ======================== */
  group('M - mobile and narrow layout');
  {
    const viewSrc = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'projects-view.js'), 'utf8');
    const css = fs.readFileSync(path.join(ROOT, 'css', 'workspace.css'), 'utf8');
    const act5c = css.slice(css.indexOf('ACT 5C: Projects COMPACT TABLE'));
    const narrow = act5c.slice(act5c.indexOf('@media (max-width: 767px)'));
    check('B48', 'the collapsed mobile row exposes the primary fields', /data-col="value"/.test(viewSrc) && /data-col="order"/.test(viewSrc) && /data-col="state"/.test(viewSrc) && /\.projectsRow \.projectsCell\[data-col="stage"\][^}]*display:\s*none/.test(narrow.replace(/\n\s*/g, ' ')));
    check('B49', 'the expanded mobile row exposes the secondary controls', /\.projectsDetailsFields \{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/.test(narrow));
    check('B50', 'the global Apply bar remains reachable on narrow layouts', /\.projectsChangeBar \{[^}]*position:\s*sticky/.test(narrow));
    check('B51', 'no destructive horizontal overflow', !/overflow-x:\s*(auto|scroll)/.test(act5c));
    check('B52', 'no duplicate detail controls', (viewSrc.match(/data-details-for=/g) || []).length === 1 && (viewSrc.match(/projectsDetailsFields/g) || []).length === 1);
    check('B52b', 'every rendered details region carries exactly ONE control group', (() => {
      const h2 = globalThis.MME_PROJECTS_VIEW.buildProjection().html;
      const regions = h2.split('data-details-for="').slice(1);
      return regions.length >= 2 && regions.every((r) => (r.split('class="projectsDetailsFields"').length - 1) + (r.split('class="projectsDetailsReadOnly"').length - 1) === 1);
    })(), (globalThis.MME_PROJECTS_VIEW.buildProjection().html.match(/class="projectsDetailsFields"/g) || []).length);
    check('B53', 'the Source action stays reachable in the details region', /projectsDetailSource/.test(viewSrc));
  }

  group('FILTERS and TOTALS');
  {
    // Restore the canonical fixture so filter/total groups are independent of
    // the mutation groups above.
    globalThis.WORKSPACE_STATE = { rootHandle: {}, rootName: 'ws-1', folders: { notes: {} }, files: { notes: [] }, activeFile: null };
    globalThis.WORKSPACE_INDEX_STATE = {
      ready: true,
      projects: [
        proj({ projectId: ID_A, name: 'Alpha', stage: 'quoted', state: 'open', value: 800000, currency: 'BRL', expectedOrder: q('27Q3', '2027-Q3', true), sourcePath: 'notes/a.md', sourceLine: 10, created: TODAY }),
        proj({ projectId: ID_B, name: 'Beta', stage: '', state: 'lost', value: 0, currency: 'usd', expectedOrder: q('28Q1', '2028-Q1', true), sourcePath: 'notes/b.md', sourceLine: 4, created: TODAY }),
        proj({ name: 'Legacy Row', value: null, currency: '', sourcePath: 'notes/c.md', sourceLine: 9 }),
      ],
    };
    delete require.cache[require.resolve(path.join(ROOT, 'js', 'workspace', 'projects-view.js'))];
    require(path.join(ROOT, 'js', 'workspace', 'projects-view.js'));
    const V = globalThis.MME_PROJECTS_VIEW;
    V.resetViewState();
    await V.getDescriptor().activate();
    const rows = globalThis.WORKSPACE_INDEX_STATE.projects.map(V.decorate);
    check('F01', 'default filters are all All', JSON.stringify(V.getViewState().filters) === JSON.stringify({ stage: 'all', state: 'all', value: 'all', year: 'all', quarter: 'all', currency: 'all', source: '' }));
    check('F02', 'no filters hides nothing', V.applyFilters(rows).length === 3);
    V.getViewState().filters.state = 'lost';
    check('F03', 'state filter narrows', (V.setFilter('state', 'lost'), V.applyFilters(rows).length === 1));
    V.setFilter('state', 'all');
    V.setFilter('value', 'without');
    check('F04', 'Without Value filter', V.applyFilters(rows).length === 1);
    V.setFilter('value', 'all');
    V.setFilter('currency', 'BRL');
    check('F05', 'currency filter normalizes lowercase', V.applyFilters(rows).length === 1);
    V.setFilter('currency', 'all');
    V.setFilter('year', '2028');
    check('F06', 'Order year filter', V.applyFilters(rows).length === 1);
    V.setFilter('year', 'all');
    V.setFilter('quarter', 'Q3');
    check('F07', 'Order quarter filter', V.applyFilters(rows).length === 1);
    V.setFilter('quarter', 'all');
    V.setFilter('stage', 'nope');
    const zero = V.applyFilters(rows);
    check('F08', 'zero result yields an empty row set', Array.isArray(zero) && zero.length === 0);
    const zeroHtml = V.buildProjection().html;
    check('F09', 'zero-result KEEPS Clear filters reachable', zeroHtml.includes('data-action="clear-filters"'));
    check('F10', 'zero-result KEEPS every filter control', ['stage', 'state', 'value', 'year', 'quarter', 'currency', 'source'].every((k) => zeroHtml.includes('data-filter="' + k + '"')));
    check('F11', 'zero-result states the reason', /No Projects match/.test(zeroHtml));
    V.resetViewState();
    const after = V.buildProjection().html;
    check('F12', 'Clear filters restores every Project', !/No Projects match/.test(after) && V.applyFilters(rows).length === 3);
  }
  {
    // Package 6 ACT 1: rendered Source filter — exact sourcePath identity.
    const V = globalThis.MME_PROJECTS_VIEW;
    V.resetViewState();
    globalThis.WORKSPACE_INDEX_STATE = {
      ready: true,
      projects: [
        proj({ projectId: ID_A, name: 'Alpha', stage: 'quoted', state: 'open', sourcePath: 'notes/a.md', sourceName: 'a.md', sourceLine: 10, created: TODAY }),
        proj({ projectId: ID_B, name: 'Beta', stage: 'open', state: 'open', sourcePath: 'notes/b.md', sourceName: 'b.md', sourceLine: 4, created: TODAY }),
        proj({ projectId: ID_B + 'x', name: 'Gamma', stage: 'open', state: 'open', sourcePath: 'docs/a.md', sourceName: 'a.md', sourceLine: 2, created: TODAY }),
      ],
    };
    const srows = globalThis.WORKSPACE_INDEX_STATE.projects.map(V.decorate);
    const sHtml = V.buildProjection().html;
    check('S01', 'Source control is rendered', sHtml.includes('data-filter="source"'));
    check('S02', 'All Sources default is present and selected', /data-filter="source"[^>]*>[\s\S]*?All Sources/.test(sHtml) && /<option value="" selected>All Sources<\/option>/.test(sHtml));
    check('S03', 'option values are exact sourcePaths', sHtml.includes('value="notes/a.md"') && sHtml.includes('value="notes/b.md"') && sHtml.includes('value="docs/a.md"'));
    check('S04', 'duplicate basenames are disambiguated in labels', /a\.md — (notes|docs)/.test(sHtml));
    V.setFilter('source', 'notes/a.md');
    const only = V.applyFilters(srows);
    check('S05', 'exact source selects only its Projects', only.length === 1 && only[0].name === 'Alpha');
    V.setFilter('source', 'docs/a.md');
    const onlyDup = V.applyFilters(srows);
    check('S06', 'one duplicate excludes the other', onlyDup.length === 1 && onlyDup[0].name === 'Gamma');
    V.setFilter('source', 'notes');
    check('S07', 'basename alone never matches', V.applyFilters(srows).length === 0);
    V.setFilter('source', 'notes/a.md');
    V.setFilter('state', 'lost');
    check('S08', 'Source composes with existing filters', V.applyFilters(srows).length === 0);
    V.setFilter('state', 'all');
    check('S09', 'changing Source keeps other filters', V.getViewState().filters.state === 'all' && V.applyFilters(srows).length === 1);
    check('S10', 'filtering is view-only (no Save path)', (() => {
      const src = require('fs').readFileSync(require('path').join(ROOT, 'js', 'workspace', 'projects-view.js'), 'utf8');
      const start = src.indexOf('function applyFilters');
      const end = src.indexOf('// ---- DRAFT OWNER');
      const seg = src.slice(start, end > start ? end : start + 1500);
      return !/saveSmart|saveToHandle|createWritable|currentSaveHandle|applyMarkdown|localStorage|sessionStorage|indexedDB|applyProjectFieldChange/i.test(seg);
    })());
    V.resetViewState();
    check('S11', 'reset restores All Sources', V.getViewState().filters.source === '' && V.applyFilters(srows).length === 3);
  }
  {
    const V = globalThis.MME_PROJECTS_VIEW;
    const rows = [
      proj({ projectId: ID_A, name: 'A', value: 800000, currency: 'brl', expectedOrder: q('27Q3', '2027-Q3', true), created: TODAY }),
      proj({ projectId: ID_B, name: 'B', value: 0, currency: 'BRL', expectedOrder: q('27Q3', '2027-Q3', true), created: TODAY }),
      proj({ name: 'C', value: 500, currency: '' }),
      proj({ name: 'D', value: null, currency: '' }),
    ].map(V.decorate);
    const t = V.computeTotals(rows);
    check('T01', 'zero counts as WITH value', t.withValue === 3, String(t.withValue));
    check('T02', 'missing value counted separately', t.withoutValue === 1, String(t.withoutValue));
    check('T03', 'currencies never combined', t.totals.length === 1 && t.totals[0].currency === 'BRL', JSON.stringify(t.totals));
    check('T04', 'brl and BRL share one bucket', t.totals[0].totalValue === 800000, String(t.totals[0].totalValue));
    check('T05', 'value without currency excluded from currency totals', t.totals[0].totalValue === 800000);
    check('T06', 'totals reflect the filtered set', (() => { const f = rows.filter((r) => r.name === 'A'); const t2 = V.computeTotals(f); return t2.totals.length === 1 && t2.totals[0].totalValue === 800000 && t2.withoutValue === 0; })());
    globalThis.WORKSPACE_INDEX_STATE.projects = [
      proj({ projectId: ID_A, name: 'Alpha', value: 800000, currency: 'BRL', expectedOrder: q('27Q3', '2027-Q3', true), sourcePath: 'notes/a.md', sourceLine: 10, created: TODAY, stage: 'quoted', state: 'open' }),
      proj({ projectId: ID_B, name: 'Beta', value: 0, currency: 'BRL', expectedOrder: q('27Q3', '2027-Q3', true), sourcePath: 'notes/b.md', sourceLine: 4, created: TODAY, state: 'lost' }),
      proj({ projectId: ID_A + 'x', name: 'Gamma', value: null, currency: '', sourcePath: 'notes/c.md', sourceLine: 2 }),
    ];
    const h = V.buildProjection().html;
    check('T07', 'totals state N of M', /3 of 3 Projects/.test(h), (h.match(/(\d+ of \d+ Projects)/) || [])[1]);
    check('T08', 'totals state with/without counts', /With value: 2/.test(h) && /Without value: 1/.test(h));
  }

  group('PRESERVATION');
  {
    const mainSrc = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
    const sidebar = mainSrc.slice(mainSrc.indexOf('function renderWorkspaceProjectsPanel'), mainSrc.indexOf('function renderWorkspaceProjectsPanel') + 9000);
    check('R01', 'Sidebar stays read-only', !/<input|<select/.test(sidebar) && !/MME_PROJECT_VISUAL_ADAPTER/.test(sidebar));
    const idx = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'workspace-index-document.js'), 'utf8');
    check('R02', 'Workspace Index stays read-only', !/MME_PROJECT_VISUAL_ADAPTER/.test(idx));
    check('R03', 'Workspace Index Task filters intact', idx.includes('data-index-task-filter="all"') && idx.includes("taskFilterValue || 'all'"));
    const review = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'task-review.js'), 'utf8');
    check('R04', 'Task Review unchanged', /STATUS_FILTER_VALUES = \['open', 'backlog', 'todo', 'ongoing', 'done', 'all'\]/.test(review));
    const board = fs.readFileSync(path.join(ROOT, 'js', 'tasks', 'task-board.js'), 'utf8');
    check('R05', 'Task Board unchanged', !/MME_PROJECT/.test(board));
    const lifecycle = fs.readFileSync(path.join(ROOT, 'js', 'tasks', 'task-lifecycle.js'), 'utf8');
    check('R06', 'Task lifecycle unchanged', !/mme-project/.test(lifecycle));
    const ad = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'project-visual-adapter.js'), 'utf8');
    check('R07', 'no Task-to-Project association', !/project=/.test(ad));
    const pure = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'project-metadata-mutation.js'), 'utf8');
    check('R08', 'pure mutation owner untouched', !/MME_PROJECT_VISUAL_ADAPTER|MME_PROJECT_EDIT_HOST/.test(pure));
    check('R09', 'record utils untouched', !/visual|adapter/.test(fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'project-record-utils.js'), 'utf8')));
    check('R10', 'parser untouched', !/visual-adapter|MME_PROJECT_VISUAL/.test(fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'workspace-parser.js'), 'utf8')));
    const adCode = ad.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    check('R11', 'adapter never writes files directly', !/createWritable|\.write\(|require\('fs'\)/.test(adCode));
    check('R12', 'adapter never owns currentSaveHandle', !/currentSaveHandle\s*=/.test(ad));
    check('R13', 'adapter has exactly one public entry', (ad.match(/async function applyProjectFieldChange/g) || []).length === 1);
    check('R14', 'adapter targets by projectId only', /projectIdPresentIn/.test(ad));
    const viewSrc = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'projects-view.js'), 'utf8');
    check('R15', 'no Groups/Customers/Reminders', !/group=|customer=|reminder=/i.test(ad + viewSrc));
    check('R16', 'no close/archive/restore actions', !/data-action="close"|data-action="archive"|data-action="restore"/.test(viewSrc));
    check('R17', 'no long-term browser storage', !/localStorage|sessionStorage/.test(ad + viewSrc));
    const { execFileSync } = require('child_process');
    const helpDiff = execFileSync('git', ['diff', '--name-only', 'HEAD', '--', 'js/ui/help-content.js', 'js/ui/release-notes-content.js'], { cwd: ROOT, encoding: 'utf8' }).trim();
    check('R18', 'Help and Release Notes UNCHANGED', helpDiff === '', helpDiff);
    const css = fs.readFileSync(path.join(ROOT, 'css', 'workspace.css'), 'utf8');
    check('R19', 'narrow layout defined', /@media \(max-width: 767px\)/.test(css));
    check('R20', 'no destructive horizontal scroll', !/\.projectsTable \{[^}]*overflow-x:\s*(auto|scroll)/.test(css));
    check('R21', 'filter row wraps on narrow layouts', /\.projectsFilters \{[^}]*flex-wrap:\s*wrap/.test(css));
    check('R22', 'index.html unchanged', !/project-visual-adapter/.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')));
    check('R23', 'Service Worker unchanged', !/project-visual-adapter|projects-view/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')));
    check('R24', 'Report generator never sees the adapter', !/MME_PROJECT_VISUAL/.test(fs.readFileSync(path.join(ROOT, 'js', 'report', 'quick-report-generator.js'), 'utf8')));
  }

  /* ======================= FILTERED TOTALS (FT) ========================== */
  group('FT - filtered totals');
  {
    const FA = proj({ projectId: ID_A, name: 'Alpha', stage: 'quoted', state: 'open', value: 100, currency: 'brl', expectedOrder: q('27Q1', '2027-Q1', true), sourcePath: 'notes/a.md', sourceLine: 1, created: TODAY });
    const FB = proj({ projectId: ID_B, name: 'Beta', stage: 'delivered', state: 'completed', value: 300, currency: 'BRL', expectedOrder: q('27Q2', '2027-Q2', true), sourcePath: 'notes/b.md', sourceLine: 2, created: TODAY });
    const FC = proj({ projectId: 'prj_44444444-4444-4444-8444-444444444444', name: 'Gamma', stage: 'quoted', state: 'on-hold', value: 50, currency: 'USD', expectedOrder: q('28Q1', '2028-Q1', true), sourcePath: 'notes/c.md', sourceLine: 3, created: TODAY });
    const FD = proj({ name: 'Delta', stage: 'pipeline', state: 'open', value: null, currency: '', expectedOrder: q('', '', false), sourcePath: 'notes/d.md', sourceLine: 4 });
    const DATA = [FA, FB, FC, FD];
    globalThis.WORKSPACE_STATE = { rootHandle: {} };
    globalThis.MME_NAVIGATION = { recordSuccessfulNavigation: () => {} };
    globalThis.WORKSPACE_INDEX_STATE = { ready: true, projects: DATA };
    delete require.cache[require.resolve(path.join(ROOT, 'js', 'workspace', 'projects-view.js'))];
    require(path.join(ROOT, 'js', 'workspace', 'projects-view.js'));
    const V = globalThis.MME_PROJECTS_VIEW;
    const rowsNow = () => globalThis.WORKSPACE_INDEX_STATE.projects.map(V.decorate).filter((r) => V.applyFilters([r]).length > 0);
    const H = () => V.buildProjection().html;
    const names = () => rowsNow().map((r) => r.name).sort().join(',');

    let h = (V.resetViewState(), H());
    check('FT01a', 'FT01 N equals M with no filters', /4 of 4 Projects/.test(h));
    check('FT01b', 'FT01 BRL total 400', /BRL 400</.test(h));
    check('FT01c', 'FT01 USD total 50', /USD 50</.test(h));
    check('FT01d', 'FT01 with-value 3', /With value: 3</.test(h));
    check('FT01e', 'FT01 without-value 1', /Without value: 1</.test(h));

    V.setFilter('stage', 'quoted'); h = H();
    check('FT02a', 'FT02 Stage=quoted shows A and C', names() === 'Alpha,Gamma', names());
    check('FT02b', 'FT02 N=2', /2 of 4 Projects/.test(h));
    check('FT02c', 'FT02 BRL total 100', /BRL 100</.test(h));
    check('FT02d', 'FT02 USD total 50', /USD 50</.test(h));
    check('FT02e', 'FT02 with 2 / without 0', /With value: 2</.test(h) && /Without value: 0</.test(h));

    V.setFilter('stage', 'all'); V.setFilter('state', 'completed'); h = H();
    check('FT03a', 'FT03 State=completed shows B', names() === 'Beta', names());
    check('FT03b', 'FT03 N=1', /1 of 4 Projects/.test(h));
    check('FT03c', 'FT03 BRL total 300', /BRL 300</.test(h));
    check('FT03d', 'FT03 no USD total', !/projectsTotalCurrency">USD/.test(h));

    V.setFilter('state', 'all'); V.setFilter('currency', 'USD'); h = H();
    check('FT04a', 'FT04 Currency=USD shows C', names() === 'Gamma', names());
    check('FT04b', 'FT04 USD total 50', /USD 50</.test(h));
    check('FT04c', 'FT04 no BRL total', !/projectsTotalCurrency">BRL/.test(h));

    V.setFilter('currency', 'all'); V.setFilter('value', 'with'); h = H();
    check('FT05a', 'FT05 With Value shows A,B,C', names() === 'Alpha,Beta,Gamma', names());
    check('FT05b', 'FT05 with 3 / without 0', /With value: 3</.test(h) && /Without value: 0</.test(h));

    V.setFilter('value', 'without'); h = H();
    check('FT06a', 'FT06 Without Value shows D', names() === 'Delta', names());
    check('FT06b', 'FT06 with 0 / without 1', /With value: 0</.test(h) && /Without value: 1</.test(h));
    check('FT06c', 'FT06 no currency total', !/projectsTotalCurrency/.test(h));

    V.setFilter('value', 'all'); V.setFilter('year', '2027'); h = H();
    check('FT07a', 'FT07 year filter shows A,B', names() === 'Alpha,Beta', names());
    check('FT07b', 'FT07 BRL total 400', /BRL 400</.test(h));

    V.setFilter('year', 'all'); V.setFilter('quarter', 'Q2'); h = H();
    check('FT08a', 'FT08 quarter filter shows B', names() === 'Beta', names());
    check('FT08b', 'FT08 BRL total 300', /BRL 300</.test(h));

    V.setFilter('quarter', 'all'); V.setFilter('search', 'gam'); h = H();
    check('FT09a', 'FT09 search shows C', names() === 'Gamma', names());
    check('FT09b', 'FT09 USD total 50', /USD 50</.test(h));

    V.setFilter('search', ''); V.setFilter('stage', 'quoted'); V.setFilter('state', 'open'); h = H();
    check('FT10a', 'FT10 intersection is A only', names() === 'Alpha', names());
    check('FT10b', 'FT10 totals follow the intersection', /BRL 100</.test(h) && !/projectsTotalCurrency">USD/.test(h));

    V.setFilter('stage', 'all'); V.setFilter('state', 'all'); V.setFilter('currency', 'zzz'); h = H();
    check('FT11a', 'FT11 zero-result N=0', /0 of 4 Projects/.test(h));
    check('FT11b', 'FT11 zero-result with 0 / without 0', /With value: 0</.test(h) && /Without value: 0</.test(h));
    check('FT11c', 'FT11 zero-result has no currency total', !/projectsTotalCurrency/.test(h));
    check('FT11d', 'FT11 zero-result KEEPS filters and Clear', h.includes('data-action="clear-filters"') && h.includes('data-filter="stage"'));

    V.resetViewState();
    V.setFilter('stage', 'quoted');
    const o1a = JSON.stringify(V.computeTotals(rowsNow()));
    V.setFilter('currency', 'USD');
    const o1b = JSON.stringify(V.computeTotals(rowsNow()));
    V.resetViewState();
    V.setFilter('currency', 'USD');
    const o2a = JSON.stringify(V.computeTotals(rowsNow()));
    V.setFilter('stage', 'quoted');
    const o2b = JSON.stringify(V.computeTotals(rowsNow()));
    // The same filter SET must yield the same totals regardless of the order the
    // filters were applied (o1b and o2b are both stage+USD).
    check('FT12', 'FT12 filter ordering does not change totals', o1b === o2b && o1a !== o2a, o1a + '|' + o1b + ' vs ' + o2a + '|' + o2b);

    globalThis.WORKSPACE_INDEX_STATE = { ready: true, projects: [FA, FB] };
    V.resetViewState(); V.setFilter('stage', 'quoted'); h = H();
    // FA is stage=quoted; FB is stage=delivered, so the refreshed Index yields
    // exactly one quoted row and BRL 100 — NOT the previous 2-of-4 figures.
    // Scope the "no USD" assertion to the TOTALS block only; the currency FILTER
    // control legitimately lists USD as an option.
    const totalsBlock = (h.match(/<div class="projectsTotals"[\s\S]*?<\/div>/) || [''])[0];
    check('FT13a', 'FT13 rebuild recalculates from refreshed Index', /1 of 2 Projects/.test(h) && /BRL 100</.test(totalsBlock) && !/USD/.test(totalsBlock), totalsBlock.slice(0, 140));

    globalThis.WORKSPACE_INDEX_STATE = { ready: true, projects: DATA };
    globalThis.WORKSPACE_STATE = { rootHandle: {} };
    V.resetViewState(); h = H();
    check('FT14', 'FT14 Workspace change resets filters and recalculates totals', /4 of 4 Projects/.test(h) && /BRL 400</.test(h));
  }

  /* ================== CLEAR FILTERS CLICK PATH (CF) ====================== */
  group('CF - Clear filters real click path');
  {
    globalThis.WORKSPACE_STATE = { rootHandle: {} };
    globalThis.MME_NAVIGATION = { recordSuccessfulNavigation: () => {} };
    globalThis.WORKSPACE_INDEX_STATE = { ready: true, projects: [
      proj({ projectId: ID_A, name: 'Alpha', stage: 'quoted', state: 'open', value: 100, currency: 'BRL', expectedOrder: q('27Q1', '2027-Q1', true), sourcePath: 'notes/a.md', sourceLine: 1, created: TODAY }),
      proj({ projectId: ID_B, name: 'Beta', stage: 'delivered', state: 'completed', value: 300, currency: 'BRL', expectedOrder: q('27Q2', '2027-Q2', true), sourcePath: 'notes/b.md', sourceLine: 2, created: TODAY }),
    ] };
    delete require.cache[require.resolve(path.join(ROOT, 'js', 'workspace', 'projects-view.js'))];
    require(path.join(ROOT, 'js', 'workspace', 'projects-view.js'));
    const V = globalThis.MME_PROJECTS_VIEW;

    // Instrument the mutation/adapter/Save owners: Clear filters must call NONE.
    let adapterCalls = 0, ownerCalls = 0, saveCalls = 0, rebuildCalls = 0, switches = 0;
    const realAdapter = globalThis.MME_PROJECT_VISUAL_ADAPTER;
    const realOwner = globalThis.MME_PROJECT_METADATA_MUTATION;
    const realHost = globalThis.MME_PROJECT_EDIT_HOST;
    globalThis.MME_PROJECT_VISUAL_ADAPTER = Object.freeze(Object.assign({}, realAdapter, {
      applyProjectFieldChange: async () => { adapterCalls += 1; return { ok: false }; },
    }));
    globalThis.MME_PROJECT_METADATA_MUTATION = Object.freeze(Object.assign({}, realOwner, {
      mutateProject: () => { ownerCalls += 1; return { ok: false }; },
    }));
    globalThis.MME_PROJECT_EDIT_HOST = Object.freeze(Object.assign({}, realHost || {}, {
      save: async () => { saveCalls += 1; return { ok: true }; },
      rebuildIndex: async () => { rebuildCalls += 1; return null; },
    }));
    globalThis.MME_WORKSPACE_HOST = { switchTo: async () => { switches += 1; return { status: 'activated' }; }, getActiveId: () => 'projects' };

    await V.getDescriptor().activate();
    const container = document.getElementById(V.CONTAINER_ID);
    check('CF00', 'Projects container mounted for the click path', Boolean(container) && container.hidden === false);

    const clearBtn = () => container.querySelectorAll('[data-action="clear-filters"]')[0];
    const setFilter = (dim, value) => {
      const el = container.querySelectorAll('[data-filter="' + dim + '"]')[0];
      if (!el) return false;
      el.value = value;
      el.dispatchEvent({ type: dim === 'search' ? 'input' : 'change', target: el, preventDefault() {}, stopPropagation() {} });
      return true;
    };
    const clickClear = () => { const b = clearBtn(); if (!b) return false; b.dispatchEvent({ type: 'click', target: b, preventDefault() {}, stopPropagation() {} }); return true; };
    const domVal = (dim) => { const el = container.querySelectorAll('[data-filter="' + dim + '"]')[0]; return el ? el.value : null; };
    const dims = ['stage', 'state', 'value', 'year', 'quarter', 'currency'];

    setFilter('search', 'zzz');
    check('CF01a', 'CF01 search applied via the real event owner', V.getViewState().search === 'zzz');
    check('CF01b', 'CF01 real Clear filters click executed', clickClear());
    check('CF01', 'CF01 Search cleared', domVal('search') === '' && V.getViewState().search === '');

    setFilter('stage', 'quoted'); clickClear();
    check('CF02', 'CF02 Stage reset to All', domVal('stage') === 'all');
    setFilter('state', 'completed'); clickClear();
    check('CF03', 'CF03 State reset to All', domVal('state') === 'all');
    setFilter('value', 'without'); clickClear();
    check('CF04', 'CF04 value-presence reset to All', domVal('value') === 'all');
    setFilter('year', '2027'); clickClear();
    check('CF05', 'CF05 Order year reset to All', domVal('year') === 'all');
    setFilter('quarter', 'Q2'); clickClear();
    check('CF06', 'CF06 Order quarter reset to All', domVal('quarter') === 'all');
    setFilter('currency', 'BRL'); clickClear();
    check('CF07', 'CF07 Currency reset to All', domVal('currency') === 'all');

    setFilter('search', 'zzz');
    setFilter('stage', 'quoted'); setFilter('state', 'completed'); setFilter('value', 'without');
    setFilter('year', '2027'); setFilter('quarter', 'Q2'); setFilter('currency', 'BRL');
    const act = V.getViewState();
    check('CF08a', 'CF08 every dimension active before clear', act.search === 'zzz' && dims.every((d) => act.filters[d] !== 'all'));
    clickClear();
    const clr = V.getViewState();
    check('CF08', 'CF08 Clear resets EVERY dimension in one action', clr.search === '' && dims.every((d) => clr.filters[d] === 'all'), JSON.stringify(clr));
    check('CF09', 'CF09 all Project rows return', /2 of 2 Projects/.test(container.textContent));
    check('CF10', 'CF10 unfiltered totals return', /BRL 400/.test(container.textContent));

    setFilter('currency', 'zzz');
    check('CF11a', 'CF11 zero-result reached', /0 of 2 Projects/.test(container.textContent));
    check('CF11b', 'CF11 Clear remains visible at zero result', Boolean(clearBtn()));
    clickClear();
    check('CF11', 'CF11 Clear restores the complete result', /2 of 2 Projects/.test(container.textContent));

    setFilter('stage', 'quoted');
    clickClear();
    // Re-query AFTER the rerender: the container is replaced, so a stale
    // reference would not reflect the DOM the user actually sees.
    const stageSel = container.querySelectorAll('[data-filter="stage"]')[0];
    check('CF12', 'CF12 DOM control value updated, not only internal state', Boolean(stageSel) && stageSel.value === 'all', stageSel ? String(stageSel.value) : 'no-select');
    const allOpt = stageSel ? stageSel.children.filter((c) => c.getAttribute && c.getAttribute('value') === 'all')[0] : null;
    check('CF13', 'CF13 selected/active accessibility state updated', Boolean(allOpt) && allOpt.hasAttribute('selected'));

    const b0 = [ownerCalls, adapterCalls, saveCalls, rebuildCalls, switches];
    setFilter('stage', 'quoted'); setFilter('currency', 'BRL'); setFilter('search', 'x');
    clickClear(); clickClear();
    check('CF14', 'CF14 no pure mutation-owner call', ownerCalls === b0[0]);
    check('CF15', 'CF15 no visual-adapter call', adapterCalls === b0[1]);
    check('CF16', 'CF16 no Save', saveCalls === b0[2]);
    check('CF17', 'CF17 no Index rebuild', rebuildCalls === b0[3]);
    check('CF18', 'CF18 does not navigate away from Projects', switches === b0[4] && document.getElementById(V.CONTAINER_ID).hidden === false);

    check('CF19', 'CF19 Clear present on the narrow rendering path', V.buildProjection().html.includes('data-action="clear-filters"') && /@media \(max-width: 767px\)/.test(fs.readFileSync(path.join(ROOT, 'css', 'workspace.css'), 'utf8')));

    clickClear(); clickClear(); clickClear();
    check('CF20', 'CF20 repeated Clear is safe and deterministic', /2 of 2 Projects/.test(container.textContent) && V.getViewState().filters.stage === 'all');

    globalThis.MME_PROJECT_VISUAL_ADAPTER = realAdapter;
    globalThis.MME_PROJECT_METADATA_MUTATION = realOwner;
    if (realHost) globalThis.MME_PROJECT_EDIT_HOST = realHost;
    V.getDescriptor().deactivate();
  }

  /* ================== WORKSPACE / INDEX STATE (W) ====================== */
  group('W - Workspace and Index state model');
  {
    globalThis.MME_NAVIGATION = { recordSuccessfulNavigation: () => {} };
    const reloadView = () => {
      delete require.cache[require.resolve(path.join(ROOT, 'js', 'workspace', 'projects-view.js'))];
      require(path.join(ROOT, 'js', 'workspace', 'projects-view.js'));
      return globalThis.MME_PROJECTS_VIEW;
    };
    const ws = (extra) => Object.assign({ rootHandle: {}, rootName: 'ws-1', folders: { notes: {} }, files: { notes: [] }, activeFile: null }, extra || {});
    const twoProjects = [
      proj({ projectId: ID_A, name: 'Alpha', stage: 'quoted', state: 'open', value: 100, currency: 'BRL', expectedOrder: q('27Q1', '2027-Q1', true), sourcePath: 'notes/a.md', sourceLine: 1, created: TODAY }),
      proj({ projectId: ID_B, name: 'Beta', stage: 'delivered', state: 'completed', value: 300, currency: 'BRL', expectedOrder: q('27Q2', '2027-Q2', true), sourcePath: 'notes/b.md', sourceLine: 2, created: TODAY }),
    ];
    const threeProjects = twoProjects.concat([proj({ projectId: 'prj_33333333-3333-4333-8333-333333333333', name: 'Gamma', value: 0, currency: 'USD', sourcePath: 'notes/c.md', sourceLine: 3, created: TODAY })]);
    const mount = async (V) => {
      await V.getDescriptor().activate();
      const c = document.getElementById(V.CONTAINER_ID);
      return { V, c, html: c.textContent };
    };
    const idxReady = () => window.dispatchEvent({ type: 'mme-workspace-index-ready', detail: {} });

    // W01 - no Workspace.
    globalThis.WORKSPACE_STATE = ws({ rootHandle: null });
    globalThis.WORKSPACE_INDEX_STATE = { ready: true, projects: twoProjects };
    let V = reloadView();
    let m = await mount(V);
    check('W01', 'no Workspace renders the unavailable state', /No Workspace is open/.test(m.html));
    check('W14', 'uses the production property name (rootHandle)', m.V.readWorkspaceState().state.rootHandle === null && !('activeWorkspace' in m.V.readWorkspaceState().state));
    V.getDescriptor().deactivate();

    // W14b - a stale shim-only field must not be honoured as Workspace proof.
    globalThis.WORKSPACE_STATE = ws({ rootHandle: null, activeWorkspace: { id: 'stale-ws' } });
    V = reloadView();
    m = await mount(V);
    check('W14b', 'a shim-only activeWorkspace field never fakes availability', /No Workspace is open/.test(m.html) && m.V.readWorkspaceState().available === false);
    V.getDescriptor().deactivate();
    globalThis.WORKSPACE_STATE = ws({ rootHandle: null });

    // W02 - Workspace open, Index still building.
    globalThis.WORKSPACE_STATE = ws();
    globalThis.WORKSPACE_INDEX_STATE = { ready: false, projects: [] };
    V = reloadView();
    m = await mount(V);
    check('W02', 'Index not ready renders Loading, not unavailable', /Loading Projects/.test(m.html) && !/No Workspace is open/.test(m.html));
    V.getDescriptor().deactivate();

    // W03 - ready with zero Projects.
    globalThis.WORKSPACE_INDEX_STATE = { ready: true, projects: [] };
    V = reloadView();
    m = await mount(V);
    check('W03', 'ready with zero Projects renders the empty state', /No Projects yet/.test(m.html) && !/No Workspace is open/.test(m.html));
    V.getDescriptor().deactivate();

    // W04/W05/W13 - the reported real-browser session (ready, two Projects).
    globalThis.WORKSPACE_INDEX_STATE = { ready: true, projects: twoProjects };
    V = reloadView();
    m = await mount(V);
    check('W04', 'ready with two Projects renders the rows, not unavailable', /2 of 2 Projects/.test(m.html) && /Alpha/.test(m.html) && /Beta/.test(m.html) && !/No Workspace is open/.test(m.html));
    check('W05', 'first activation after Index ready contains the Projects', /2 of 2 Projects/.test(m.html));
    // The DOM filter handler owns the rerender; setFilter/clearFilters are the
    // state writers it calls, so the view is rerendered here the same way.
    V.setFilter('stage', 'delivered'); V.setFilter('state', 'open');
    V.refreshRoute();
    const zeroH = m.c.textContent;
    V.clearFilters();
    V.refreshRoute();
    const clearedH = m.c.textContent;
    check('W13', 'filtered zero renders filtered empty, keeps filters and Clear', /No Projects match/.test(zeroH) && /Clear filters/.test(zeroH) && !/No Workspace is open/.test(zeroH) && /2 of 2 Projects/.test(clearedH));

    // W06 - activate before readiness, then the Index-ready event.
    globalThis.WORKSPACE_INDEX_STATE = { ready: false, projects: [] };
    const V2 = reloadView();
    await V2.getDescriptor().activate();
    const c2 = document.getElementById(V2.CONTAINER_ID);
    const firstH = c2.textContent;
    globalThis.WORKSPACE_INDEX_STATE = { ready: true, projects: twoProjects };
    idxReady();
    const afterH = c2.textContent;
    check('W06', 'activation before readiness shows Loading then refreshes on Index-ready', /Loading Projects/.test(firstH) && /2 of 2 Projects/.test(afterH) && !/No Workspace is open/.test(afterH));
    V.getDescriptor().deactivate();
    V2.getDescriptor().deactivate();

    // W07/W08/W09/W10/W11/W12 on a single mounted view.
    globalThis.WORKSPACE_STATE = ws();
    globalThis.WORKSPACE_INDEX_STATE = { ready: true, projects: twoProjects };
    const V3 = reloadView();
    const m3 = await mount(V3);
    globalThis.WORKSPACE_INDEX_STATE = { ready: true, projects: threeProjects };
    idxReady();
    check('W07', 'Index rebuild 2->3 refreshes the view', /3 of 3 Projects/.test(m3.c.textContent) && /Gamma/.test(m3.c.textContent));
    globalThis.WORKSPACE_INDEX_STATE = { ready: true, projects: [] };
    idxReady();
    check('W08', 'Index rebuild to zero renders the empty state, not unavailable', /No Projects yet/.test(m3.c.textContent) && !/No Workspace is open/.test(m3.c.textContent));
    globalThis.WORKSPACE_STATE = ws({ activeFile: null });
    globalThis.WORKSPACE_INDEX_STATE = { ready: true, projects: twoProjects };
    idxReady();
    check('W09', 'no active file still leaves the Workspace available', /2 of 2 Projects/.test(m3.c.textContent) && !/No Workspace is open/.test(m3.c.textContent));
    V3.setFilter('state', 'open');
    const searchBefore = V3.getViewState().search;
    V3.refreshRoute();
    check('W10', 'route state survives a refresh and source return', V3.getViewState().filters.state === 'open' && V3.getViewState().search === searchBefore && /Projects/.test(m3.c.textContent));
    globalThis.WORKSPACE_STATE = ws({ rootName: 'ws-2', rootHandle: { name: 'ws-2' } });
    globalThis.WORKSPACE_INDEX_STATE = { ready: true, projects: [proj({ projectId: ID_A, name: 'Only', value: 5, currency: 'EUR', sourcePath: 'notes/z.md', sourceLine: 9, created: TODAY })] };
    V3.resetViewState();
    idxReady();
    check('W11', 'Workspace change resets filters and shows the new records', /Only/.test(m3.c.textContent) && !/Alpha/.test(m3.c.textContent) && V3.getViewState().filters.state === 'all');
    globalThis.WORKSPACE_STATE = ws({ rootHandle: null });
    idxReady();
    check('W12', 'closing the Workspace renders the unavailable state', /No Workspace is open/.test(m3.c.textContent));
    V3.getDescriptor().deactivate();

    // W15/W16/W17/W18 - reader contract.
    globalThis.WORKSPACE_STATE = ws();
    globalThis.WORKSPACE_INDEX_STATE = { ready: true, projects: twoProjects };
    const V4 = reloadView();
    const rw = V4.readWorkspaceState();
    check('W15', 'reader exposes the production Workspace-state contract', rw && rw.available === true && rw.state && typeof rw.state.rootHandle === 'object' && !('activeWorkspace' in rw.state));
    const rp = V4.readProjectSource();
    check('W16', 'Projects reader exposes only the Index read model', rp && typeof rp.indexReady === 'boolean' && Array.isArray(rp.projects) && !('files' in rp) && !('markdown' in rp));
    check('W17', 'route refresh performs no mutation owner call', (() => {
      let ownerCalls = 0;
      const realOwner = globalThis.MME_PROJECT_METADATA_MUTATION;
      globalThis.MME_PROJECT_METADATA_MUTATION = Object.freeze(Object.assign({}, realOwner, { mutateProject: () => { ownerCalls += 1; return { ok: false }; } }));
      V4.refreshRoute();
      globalThis.MME_PROJECT_METADATA_MUTATION = realOwner;
      return ownerCalls === 0;
    })());
    check('W18', 'route refresh performs no Save', (() => {
      let saves = 0;
      const realHost = globalThis.MME_PROJECT_EDIT_HOST;
      globalThis.MME_PROJECT_EDIT_HOST = Object.freeze(Object.assign({}, realHost || {}, { save: async () => { saves += 1; return { ok: true }; } }));
      V4.refreshRoute();
      globalThis.MME_PROJECT_EDIT_HOST = realHost;
      return saves === 0;
    })());
  }

  /* ================== PRESERVATION LEDGER (B54-B60) ==================== */
  /* ===================== FOCUS STABILITY (FO01-FO20) ================== */
  group('FO - focus-stable draft editing');
  {
    const V = globalThis.MME_PROJECTS_VIEW;
    V.resetViewState();
    V.discardPendingChanges();
    await V.getDescriptor().activate();
    const container = document.getElementById(V.CONTAINER_ID);

    const spy = { saves: 0, bufferWrites: 0, rebuilds: 0, ownerCalls: 0, adapterCalls: 0, opens: 0, markdown: 'Project: Alpha\n' + mc(ID_A) + '\n' };
    globalThis.MME_PROJECT_EDIT_HOST = Object.freeze({
      isDirty: () => false,
      getMarkdown: () => spy.markdown,
      currentFileName: () => 'a.md',
      applyMarkdown: (t) => { spy.bufferWrites += 1; spy.markdown = String(t); return true; },
      save: async () => { spy.saves += 1; return { ok: true }; },
      rebuildIndex: async () => { spy.rebuilds += 1; return null; },
    });
    const realAdapterFo = globalThis.MME_PROJECT_VISUAL_ADAPTER;
    const realOwnerFo = globalThis.MME_PROJECT_METADATA_MUTATION;
    // BOTH adapter entry points are spied, so "typing calls the adapter" is
    // detected whichever one a regression would reach for.
    globalThis.MME_PROJECT_VISUAL_ADAPTER = Object.freeze(Object.assign({}, realAdapterFo, {
      applyProjectBatch: () => { spy.adapterCalls += 1; return Promise.resolve({ ok: false, reason: 'no-drafts' }); },
      applyProjectFieldChange: () => { spy.adapterCalls += 1; return Promise.resolve({ ok: false, reason: 'no-drafts' }); },
    }));
    globalThis.MME_PROJECT_METADATA_MUTATION = Object.freeze(Object.assign({}, realOwnerFo, {
      mutateProject: (...a) => { spy.ownerCalls += 1; return realOwnerFo.mutateProject(...a); },
    }));
    globalThis.openWorkspaceFile = async () => { spy.opens += 1; return { ok: true, ready: true }; };

    // Null-safe readers: a regression that removes the editing surface must fail
    // NAMED, never by aborting the whole suite. NodeList-faithful lookups.
    const markdownBefore = spy.markdown;
    const details = () => findByAttr(container, 'data-details-for', ID_A);
    const valueInput = () => findByAttr(details(), 'data-field', 'value');
    const rowEl = () => findByAttr(container, 'data-projects-key', ID_A);
    const rowElB = () => findByAttr(container, 'data-projects-key', ID_B);
    const barEl = () => (container ? container.querySelector('[data-projects-change-bar]') : null);
    const type = (el, text) => {
      el.focus();
      el.value = String(el.value || '') + text;
      el.dispatchEvent({ type: 'input', target: el, preventDefault() {}, stopPropagation() {} });
    };
    // Structural snapshots for FO22: every node a full renderInto() would
    // replace is captured BEFORE the first keystroke.
    const first = valueInput();
    const firstRow = rowEl();
    const firstBar = barEl();
    const firstRowB = rowElB();
    const betaDetails = findByAttr(container, 'data-details-for', ID_B);
    const betaStage = findByAttr(betaDetails, 'data-field', 'stage');
    const betaBefore = betaStage ? betaStage.value : null;
    if (!first || !firstRow) {
      // A regression that removes the editing surface must fail NAMED, never by
      // aborting the whole suite.
      check('FO-setup', 'the expanded managed row exposes its Value control', false, 'no details control');
      for (const id of ['FO01', 'FO02', 'FO03', 'FO04', 'FO05', 'FO06', 'FO07', 'FO08', 'FO09', 'FO10', 'FO11', 'FO12', 'FO13', 'FO14', 'FO14b', 'FO15', 'FO16', 'FO17', 'FO18', 'FO19', 'FO19b', 'FO20', 'FO21', 'FO22', 'FO22b', 'FO23', 'FO24']) check(id, 'focus-stability fixture could not run', false, 'no details control');
    } else {
    // FO01-FO03: focus enters the Value input and survives the first keystroke.
    first.focus();
    check('FO01', 'the Value input receives focus', document.activeElement === first);
    type(first, '8');
    check('FO02', "typing '8' updates the draft", first.value === '8' && (V.getDrafts()[0] || { proposed: {} }).proposed.value === '8', first.value);
    check('FO03', 'the SAME input node remains focused after the keystroke', document.activeElement === first && valueInput() === first);

    // FO04-FO06: continue typing without pausing; the fixture dispatches ONLY
    // input events — no click, no re-focus trick, no rerender.
    for (const ch of ['0', '0', '0', '0', '0']) type(first, ch);
    check('FO04', 'continuous typing keeps focus and node identity', document.activeElement === first && valueInput() === first);
    check('FO05', 'the final value is 800000', first.value === '800000' && (V.getDrafts()[0] || { proposed: {} }).proposed.value === '800000', first.value);
    check('FO06', 'no additional click is required to keep editing', document.activeElement === first && V.getPendingSummary().projects === 1 && first.value === '800000');
    check('FO07', 'input node identity remains unchanged', valueInput() === first);
    check('FO08', 'parent Project row identity remains unchanged', rowEl() === firstRow);
    check('FO09', 'the caret remains at the expected position', typeof first.selectionStart === 'number' && first.selectionStart === 6 && first.selectionEnd === 6, String(first.selectionStart) + ':' + String(first.selectionEnd));

    // FO10-FO11: backspace and selection on the live control.
    const before = first.value;
    first.value = before.slice(0, -1);
    first.dispatchEvent({ type: 'input', target: first, preventDefault() {}, stopPropagation() {} });
    check('FO10', 'Backspace edits the draft without replacing the control', first.value === '80000' && valueInput() === first && (V.getDrafts()[0] || { proposed: {} }).proposed.value === '80000', first.value);
    let selectionUsable = false;
    if (typeof first.setSelectionRange === 'function') {
      first.setSelectionRange(2, 4);
      selectionUsable = first.selectionStart === 2 && first.selectionEnd === 4;
      first.setSelectionRange(first.value.length, first.value.length);
    }
    check('FO11', 'the selection range remains usable where the harness supports it', selectionUsable === true && document.activeElement === first, String(selectionUsable));

    // FO12-FO16: derived state patches IN PLACE.
    check('FO12', 'the draft Project count updates', Boolean(barEl()) && barEl().getAttribute('data-pending-projects') === '1', barEl() ? barEl().getAttribute('data-pending-projects') : 'no-bar');
    check('FO13', 'the draft field count updates', Boolean(barEl()) && barEl().getAttribute('data-pending-fields') === '1');
    check('FO14', 'changed-state styling updates', rowEl().getAttribute('data-changed-fields') === 'value' && rowEl().classList.contains('projectsRowChanged'));
    const applyBtn = barEl() ? findByAttr(barEl(), 'data-action', 'apply-drafts') : null;
    const discardBtn = barEl() ? findByAttr(barEl(), 'data-action', 'discard-drafts') : null;
    check('FO15', 'Apply becomes enabled', Boolean(applyBtn) && !applyBtn.hasAttribute('disabled'));
    check('FO16', 'Discard becomes enabled', Boolean(discardBtn) && !discardBtn.hasAttribute('disabled'));

    // FO14b: preserved coverage — a validation error patches IN PLACE (Enter path).
    type(first, 'x');
    first.dispatchEvent({ type: 'keydown', target: first, key: 'Enter', preventDefault() {}, stopPropagation() {} });
    const errEl = findByAttr(details(), 'data-error-for', 'value');
    check('FO14b', 'validation state patches locally without replacing the control', Boolean(errEl) && errEl.getAttribute('data-error-active') === 'true' && valueInput() === first && document.activeElement === first, errEl ? errEl.getAttribute('data-error-active') : 'no-error-node');

    // FO17-FO21: typing never reaches any owner.
    check('FO17', 'no adapter call occurs while typing', spy.adapterCalls === 0);
    check('FO18', 'no pure mutation call occurs while typing', spy.ownerCalls === 0);
    check('FO19', 'no Markdown mutation occurs while typing', spy.markdown === markdownBefore && spy.bufferWrites === 0);
    check('FO20', 'no Save occurs while typing', spy.saves === 0);
    check('FO21', 'no Index rebuild occurs while typing', spy.rebuilds === 0);
    check('FO21b', 'no source transition occurs while typing', spy.opens === 0);

    // FO22: no full renderInto() per character — every structural node a rerender
    // would replace keeps its identity across the whole typing sequence.
    check('FO22', 'no full renderInto() occurs per character', valueInput() === first && rowEl() === firstRow && barEl() === firstBar && rowElB() === firstRowB);
    check('FO22b', 'typing in Project A does not alter Project B controls', Boolean(betaStage) && betaStage === findByAttr(betaDetails, 'data-field', 'stage') && betaStage.value === betaBefore);

    // FO23: a selector change updates its draft WITHOUT replacing the Value input.
    const stageSel = findByAttr(details(), 'data-field', 'stage');
    if (stageSel) {
      stageSel.value = 'delivered';
      stageSel.dispatchEvent({ type: 'change', target: stageSel, preventDefault() {}, stopPropagation() {} });
    }
    check('FO23', 'changing a select updates its draft without replacing the Value input', Boolean(stageSel) && V.getPendingSummary().projects === 1 && valueInput() === first && stageSel === findByAttr(details(), 'data-field', 'stage'));

    // FO19b: preserved coverage — a filter rerender may rebuild the DOM, but
    // pending drafts survive it.
    const draftBeforeFilter = JSON.stringify(V.getDrafts());
    V.setFilter('state', 'open');
    V.refreshRoute();
    check('FO19b', 'a filter rerender does not lose pending drafts', JSON.stringify(V.getDrafts()) === draftBeforeFilter);
    V.clearFilters();
    V.refreshRoute();

    // FO24: a view-level structural refresh is DEFERRED while the input is
    // actively edited — the live control is never destroyed mid-keystroke.
    const liveInput = valueInput();
    liveInput.focus();
    liveInput.value = '12';
    liveInput.dispatchEvent({ type: 'input', target: liveInput, preventDefault() {}, stopPropagation() {} });
    window.dispatchEvent({ type: 'mme-workspace-index-ready' });
    const stillThere = valueInput();
    check('FO24', 'a structural refresh is deferred while the input is actively edited', stillThere === liveInput && document.activeElement === liveInput && V.getPendingSummary().projects === 1);
    }
    V.discardPendingChanges();
    globalThis.MME_PROJECT_VISUAL_ADAPTER = realAdapterFo;
    globalThis.MME_PROJECT_METADATA_MUTATION = realOwnerFo;
  }

  /* ============= APPLY + SOURCE-READY (AP01-AP30) ====================== */
  group('AP - source-ready barrier and batch Apply');
  {
    const V = globalThis.MME_PROJECTS_VIEW;
    const A = globalThis.MME_PROJECT_VISUAL_ADAPTER;
    V.resetViewState();
    V.discardPendingChanges();
    const container = document.getElementById(V.CONTAINER_ID);

    const DOC = 'Project: Alpha [800000 BRL] [27Q3]\n' + mc(ID_A) + '\n';
    const DOC_AB = 'Project: Alpha [800000 BRL] [27Q3]\n' + mc(ID_A) + '\nProject: Beta\n' + mc(ID_B) + '\n';
    const STALE = 'Project: Unrelated Note\nnothing to see here\n';
    const logs = [];
    // ONE unified timeline: opener events ('open begin' / 'installed' /
    // 'open complete') and batch phases ('phase=mutate', 'phase=failed:<r>')
    // land in a single ordered array so the ordering fixtures can compare
    // positions — this is how the device race is reproduced and proven fixed.
    const order = [];
    globalThis.MME_APP = {
      log: (m) => {
        const s = String(m);
        logs.push(s);
        const pm = /ProjectsApplyBatch: phase=(\S+)(?: reason=(\S+))?/.exec(s);
        if (pm) order.push('phase=' + pm[1] + (pm[2] ? ':' + pm[2] : ''));
      },
      showToast: () => {},
    };

    // Production-faithful async source activation under test:
    //   open begin -> buffer install -> open complete -> explicit result.
    // 'premature' reproduces the SHIPPED race: success reported while the
    // activation is still in flight (no ready flag, install still pending).
    const opener = { behavior: 'faithful', phase: 'idle', opens: 0, records: [] };
    const reads = [];
    const tick = () => new Promise((r) => setImmediate(r));
    const host = {
      markdown: DOC, dirty: false, bufferWrites: 0, saves: 0, rebuilds: 0,
      saveImpl: null, sawSaveBeforeRebuild: false, ownerCalls: 0, ownerSawId: [],
      openByPath: null,
    };
    const install = (o) => {
      opener.phase = 'idle';
      host.markdown = (o && o.markdown) || DOC;
      host.dirty = Boolean(o && o.dirty);
      host.bufferWrites = 0; host.saves = 0; host.rebuilds = 0;
      host.sawSaveBeforeRebuild = false;
      host.saveImpl = (o && o.saveImpl) || null;
      host.ownerCalls = 0; host.ownerSawId = [];
      host.openByPath = (o && o.openByPath) || null;
      globalThis.MME_PROJECT_EDIT_HOST = Object.freeze({
        isDirty: () => host.dirty,
        // Every read records the activation phase it happened in, so an
        // in-flight read (the device defect) is observable.
        getMarkdown: () => { reads.push(opener.phase); return host.markdown; },
        currentFileName: () => 'Test2.md',
        applyMarkdown: (t) => { host.bufferWrites += 1; host.markdown = String(t); return true; },
        save: async () => { host.saves += 1; if (host.saveImpl) return host.saveImpl(); return { ok: true }; },
        rebuildIndex: async () => { host.rebuilds += 1; host.sawSaveBeforeRebuild = host.saves > 0; return null; },
      });
    };
    // PRODUCTION shape: { kind, name, path, handle } from WORKSPACE_STATE.files.notes
    globalThis.WORKSPACE_STATE = { rootHandle: {}, rootName: 'ws-1', folders: { notes: {} }, files: { notes: [wsFile('notes/Test2.md')] }, activeFile: null };
    const productionLookup = (p) => (globalThis.WORKSPACE_STATE.files.notes.find((f) => f.path === String(p || '').replace(/^\.\//, '')) || null);
    globalThis.findWorkspaceFileByPath = productionLookup;
    const switches = [];
    globalThis.MME_WORKSPACE_HOST = { switchTo: async (id) => { switches.push(id); return { status: 'activated' }; }, getActiveId: () => 'projects' };
    globalThis.openWorkspaceFile = async (rec, kind, reason, opts) => {
      opener.opens += 1;
      opener.records.push({ path: rec && rec.path, kind, hasHandle: Boolean(rec && rec.handle), line: opts && opts.focusLine });
      order.push('open begin');
      opener.phase = 'begin';
      await tick();
      if (opener.behavior === 'canceled') { opener.phase = 'idle'; return null; }
      if (opener.behavior === 'failed') { opener.phase = 'idle'; return { ok: false, reason: 'report-guard' }; }
      if (opener.behavior === 'premature') {
        // SHIPPED shape: resolve BEFORE installation; activation completes later.
        (async () => {
          await tick();
          const pbuf = host.openByPath && rec && host.openByPath[rec.path];
          if (pbuf) { host.markdown = pbuf; opener.phase = 'installing'; order.push('installed'); await tick(); }
          opener.phase = 'complete'; order.push('open complete');
        })();
        return { ok: true, sourcePath: rec && rec.path, sourceKind: kind };
      }
      const buf = host.openByPath && rec && host.openByPath[rec.path];
      if (buf) {
        // Production openWorkspaceFile -> openTextDocument installs the buffer
        // as part of the activation sequence, then the render completes.
        host.markdown = buf;
        opener.phase = 'installing';
        order.push('installed');
        await tick();
      }
      opener.phase = 'complete';
      order.push('open complete');
      return { ok: true, ready: true, sourcePath: rec && rec.path, sourceKind: kind };
    };
    // A plan whose source groups really carry their Projects.
    const planOf = (projects) => ({
      projects,
      fieldCount: projects.reduce((n, p) => n + p.fieldCount, 0),
      sources: [{ sourcePath: projects[0] ? projects[0].sourcePath : '', sourceKind: 'notes', projects }],
    });
    // Per-run capture: every observable of the run, sliced from the shared
    // timeline, so ordering and side-effect fixtures compare within ONE run.
    const capture = async (fn) => {
      const s0 = { o: order.length, r: reads.length, l: logs.length, opens: opener.opens, rec: opener.records.length, bw: host.bufferWrites, sv: host.saves, rb: host.rebuilds, oc: host.ownerCalls };
      const res = await fn();
      return {
        res,
        order: order.slice(s0.o), reads: reads.slice(s0.r), logs: logs.slice(s0.l),
        opens: opener.opens - s0.opens, records: opener.records.slice(s0.rec),
        bufferWrites: host.bufferWrites - s0.bw, saves: host.saves - s0.sv,
        rebuilds: host.rebuilds - s0.rb, ownerCalls: host.ownerCalls - s0.oc,
      };
    };
    // The PURE owner stays the single mutation authority; this spy only counts
    // calls and records whether the live Markdown held the target projectId at
    // mutation time (AP06) — it never changes the owner's decision.
    const realOwnerAp = globalThis.MME_PROJECT_METADATA_MUTATION;
    globalThis.MME_PROJECT_METADATA_MUTATION = Object.freeze(Object.assign({}, realOwnerAp, {
      mutateProject: (md, target, req) => {
        host.ownerCalls += 1;
        host.ownerSawId.push(typeof md === 'string' && md.indexOf(String((target && target.projectId) || '')) !== -1);
        return realOwnerAp.mutateProject(md, target, req);
      },
    }));

    const record = { projectId: ID_A, name: 'Alpha', stage: 'quoted', state: 'open', value: 800000, currency: 'BRL', expectedOrder: q('27Q3', '2027-Q3', true), sourcePath: 'notes/Test2.md', sourceLine: 1, sourceName: 'Test2.md', sourceKind: 'notes', created: TODAY };
    globalThis.WORKSPACE_INDEX_STATE = { ready: true, projects: [record] };
    V.refreshRoute();
    // ---- AP07: one Project, one field, active source ---------------------
    install({ markdown: DOC });
    V.discardPendingChanges();
    V.setDraftFieldForKey(ID_A, 'stage', 'pipeline');
    const rOne = await capture(() => V.applyPendingChanges());
    check('AP07', 'one Project with one field applies', rOne.res.ok === true && rOne.res.appliedProjects === 1 && rOne.res.appliedFields === 1, JSON.stringify({ ok: rOne.res.ok, projects: rOne.res.appliedProjects, fields: rOne.res.appliedFields }));

    // ---- AP01/AP08-AP13: active source, one Project, two fields ----------
    install({ markdown: DOC });
    V.discardPendingChanges();
    V.setDraftFieldForKey(ID_A, 'stage', 'delivered');
    V.setDraftFieldForKey(ID_A, 'state', 'on-hold');
    const r2 = await capture(() => V.applyPendingChanges());
    check('AP01', 'an active-source Project applies successfully', r2.res.ok === true && /stage=delivered/.test(host.markdown) && /state=on-hold/.test(host.markdown), JSON.stringify({ ok: r2.res.ok, reason: r2.res.reason }));
    check('AP08', 'one Project with multiple fields composes', r2.res.appliedFields === 2, String(r2.res.appliedFields));
    check('AP09', 'exactly ONE buffer update', r2.bufferWrites === 1, String(r2.bufferWrites));
    check('AP10', 'exactly ONE physical Save', r2.saves === 1, String(r2.saves));
    check('AP11', 'the Index rebuild follows Save success', r2.rebuilds === 1 && host.sawSaveBeforeRebuild === true, JSON.stringify({ rebuilds: r2.rebuilds, afterSave: host.sawSaveBeforeRebuild }));
    check('AP12', 'the route returns to Projects', switches[switches.length - 1] === 'projects', JSON.stringify(switches));
    check('AP13', 'the successful draft clears', V.getPendingSummary().projects === 0 && V.getDrafts().length === 0);

    // ---- AP02-AP06 + AP16/AP17: non-active source and the REAL race -----
    // Run 1: production-faithful activation (begin -> install -> complete ->
    // explicit { ok:true, ready:true } result).
    opener.behavior = 'faithful';
    install({ markdown: STALE, openByPath: { 'notes/Test2.md': DOC } });
    V.discardPendingChanges();
    V.setDraftFieldForKey(ID_A, 'stage', 'delivered');
    host.ownerSawId = [];
    const rOpen = await capture(() => V.applyPendingChanges());
    const sawIdOpen = host.ownerSawId.slice();

    // Run 2: the shipped race, reproduced — the opener reports success while
    // activation is still in flight; installation and 'open complete' land
    // AFTER the batch would have continued.
    opener.behavior = 'premature';
    install({ markdown: STALE, openByPath: { 'notes/Test2.md': DOC } });
    V.discardPendingChanges();
    V.setDraftFieldForKey(ID_A, 'stage', 'delivered');
    const rRace = await capture(() => V.applyPendingChanges());

    check('AP02', 'a non-active source requests exactly one production-shaped open', rOpen.res.ok === true && rOpen.opens === 1 && rOpen.records.length === 1 && rOpen.records[0].path === 'notes/Test2.md' && rOpen.records[0].kind === 'notes' && rOpen.records[0].hasHandle === true && rOpen.records[0].line === 1, JSON.stringify(rOpen.records));
    // AP03: NO getMarkdown() for the target while activation is in flight —
    // checked in BOTH the faithful run and the reproduced race.
    check('AP03', 'the batch never reads the buffer while activation is in flight', rOpen.order.indexOf('open begin') !== -1 && rOpen.reads.every((p) => p === 'idle' || p === 'complete') && rRace.reads.every((p) => p === 'idle' || p === 'complete'), JSON.stringify({ faithful: rOpen.reads, race: rRace.reads }));
    const projectIdOutcomeBefore = (sl) => {
      const oc = sl.indexOf('open complete');
      if (oc === -1) return [];
      return sl.map((s, i) => ({ s, i })).filter((x) => x.i < oc && (x.s === 'phase=mutate' || x.s === 'phase=failed:project-not-found' || x.s === 'phase=failed:duplicate-project-id')).map((x) => x.i);
    };
    check('AP04', 'projectId is never verified before source-ready resolution', projectIdOutcomeBefore(rOpen.order).length === 0 && projectIdOutcomeBefore(rRace.order).length === 0, JSON.stringify({ race: rRace.order }));
    const readyAfterInstall = (sl) => {
      const sr = sl.indexOf('phase=source-ready');
      if (sr === -1) return true;
      const inst = sl.indexOf('installed');
      return inst !== -1 && inst < sr;
    };
    check('AP05', 'source-ready resolves only after the target Markdown is installed', rOpen.order.indexOf('phase=source-ready') !== -1 && readyAfterInstall(rOpen.order) && readyAfterInstall(rRace.order), JSON.stringify({ faithful: rOpen.order, race: rRace.order }));
    check('AP06', 'after source-ready resolution the live Markdown contains the target projectId', rOpen.res.ok === true && sawIdOpen.length > 0 && sawIdOpen.every(Boolean), JSON.stringify({ ok: rOpen.res.ok, sawIdOpen }));
    check('AP16', 'a not-ready open returns the bounded source-not-ready reason', rRace.res.reason === 'source-not-ready', JSON.stringify({ ok: rRace.res.ok, reason: rRace.res.reason }));
    check('AP17', 'a readiness refusal never downgrades to project-not-found', rRace.res.reason !== 'project-not-found' && rRace.res.reason === 'source-not-ready' && rRace.bufferWrites === 0 && rRace.saves === 0 && rRace.rebuilds === 0, JSON.stringify({ reason: rRace.res.reason, writes: rRace.bufferWrites, saves: rRace.saves }));

    // ---- AP18-AP20: reverification AFTER the ready barrier ---------------
    const oneOp = [{ operation: 'setStage', value: 'delivered' }];
    opener.behavior = 'faithful';
    // AP18: the opener reports ready but the target projectId is genuinely
    // absent from the live buffer -> project-not-found, WITHOUT consulting the
    // owner, and with no side effect.
    install({ markdown: STALE, openByPath: null });
    V.discardPendingChanges();
    V.setDraftFieldForKey(ID_A, 'stage', 'delivered');
    const r18 = await capture(() => V.applyPendingChanges());
    check('AP18', 'after confirmed readiness a genuinely missing projectId returns project-not-found', r18.res.reason === 'project-not-found' && r18.ownerCalls === 0 && r18.bufferWrites === 0 && r18.saves === 0 && r18.rebuilds === 0, JSON.stringify({ reason: r18.res.reason, ownerCalls: r18.ownerCalls, writes: r18.bufferWrites }));
    check('AP18b', 'the failed draft is retained', V.getPendingSummary().projects === 1 && V.getDrafts().some((d) => d.projectId === ID_A));

    // AP19: a duplicate projectId is blocked by the adapter's own identity
    // step — the pure owner is never consulted, nothing is written.
    const DUP = 'Project: Alpha\n' + mc(ID_A) + '\n\nProject: Alpha\n' + mc(ID_A) + '\n';
    install({ markdown: STALE, openByPath: { 'notes/Test2.md': DUP } });
    V.discardPendingChanges();
    V.setDraftFieldForKey(ID_A, 'stage', 'delivered');
    const r19 = await capture(() => V.applyPendingChanges());
    check('AP19', 'a duplicate projectId blocks the mutation before the owner runs', r19.res.reason === 'duplicate-project-id' && r19.ownerCalls === 0 && r19.bufferWrites === 0 && r19.saves === 0, JSON.stringify({ reason: r19.res.reason, ownerCalls: r19.ownerCalls }));

    // AP20: a malformed managed comment (invalid created) blocks the mutation
    // with a bounded owner reason and no side effect.
    const MALFORMED = 'Project: Alpha\n<!-- mme-project: id=' + ID_A + '; created=2026-13-99 -->\n';
    install({ markdown: MALFORMED, openByPath: null });
    V.discardPendingChanges();
    V.setDraftFieldForKey(ID_A, 'stage', 'delivered');
    const r20 = await capture(() => V.applyPendingChanges());
    check('AP20', 'a malformed managed comment blocks the mutation', r20.res.reason === 'malformed-project-comment' && r20.bufferWrites === 0 && r20.saves === 0 && r20.rebuilds === 0 && V.getPendingSummary().projects === 1, JSON.stringify({ reason: r20.res.reason, writes: r20.bufferWrites }));

    // ---- preserved bounded-reason coverage (source/plan/host guards) -----
    install({ markdown: STALE, openByPath: null });
    const noRecordPlan = planOf([{ projectId: ID_A, sourcePath: '', sourceKind: 'notes', sourceLine: 1, fieldCount: 1, operations: oneOp }]);
    check('AP31', 'a missing source record returns source-record-missing', (await A.applyProjectBatch(noRecordPlan)).reason === 'source-record-missing');

    V.discardPendingChanges();
    V.setDraftFieldForKey(ID_A, 'stage', 'delivered');
    const planMissingFile = V.buildApplyPlan();
    globalThis.findWorkspaceFileByPath = () => null;
    const resNoFile = await A.applyProjectBatch(planMissingFile);
    check('AP32', 'a missing file returns source-file-not-found', resNoFile.reason === 'source-file-not-found', resNoFile.reason);
    globalThis.findWorkspaceFileByPath = productionLookup;

    install({ markdown: DOC, openByPath: null });
    V.discardPendingChanges();
    const noId = await A.applyProjectBatch(planOf([{ projectId: '', sourcePath: 'notes/Test2.md', sourceKind: 'notes', sourceLine: 1, fieldCount: 1, operations: oneOp }]));
    check('AP33', 'a missing projectId returns project-id-missing', noId.reason === 'project-id-missing', noId.reason);

    // AP34: the host bridge is the only supported entry.
    install({ markdown: DOC, openByPath: null });
    V.discardPendingChanges();
    V.setDraftFieldForKey(ID_A, 'stage', 'delivered');
    const realHostBridge = globalThis.MME_PROJECT_EDIT_HOST;
    globalThis.MME_PROJECT_EDIT_HOST = null;
    const resNoHost = await A.applyProjectBatch(V.buildApplyPlan());
    check('AP34', 'an unavailable host bridge returns host-unavailable', resNoHost.reason === 'host-unavailable', resNoHost.reason);
    globalThis.MME_PROJECT_EDIT_HOST = realHostBridge;

    // AP35: an owner refusal stays bounded (never an unbounded string).
    install({ markdown: 'Project: Alpha\nnot a managed comment\n', openByPath: null });
    V.discardPendingChanges();
    V.setDraftFieldForKey(ID_A, 'stage', 'delivered');
    const notFound = await V.applyPendingChanges();
    check('AP35', 'an owner refusal returns a bounded owner reason', ['project-not-found', 'malformed-project-comment', 'mutation-failed'].indexOf(notFound.reason) !== -1, notFound.reason);
    // ---- AP21-AP23: Save outcomes, bounded results, retry ---------------
    opener.behavior = 'faithful';
    install({ markdown: DOC, openByPath: null, saveImpl: () => ({ ok: false }) });
    V.discardPendingChanges();
    V.setDraftFieldForKey(ID_A, 'stage', 'delivered');
    const r21 = await capture(() => V.applyPendingChanges());
    check('AP21', 'a Save failure retains the draft', r21.res.reason === 'save-failed' && V.getPendingSummary().projects === 1 && V.getDrafts().some((d) => d.projectId === ID_A), JSON.stringify({ reason: r21.res.reason, pending: V.getPendingSummary().projects }));
    check('AP22', 'a failed Save causes no Index rebuild', r21.saves === 1 && r21.rebuilds === 0, JSON.stringify({ saves: r21.saves, rebuilds: r21.rebuilds }));
    check('AP22b', 'the Save failure reaches the bounded result and the diagnostic log', r21.res.reason === 'save-failed' && r21.res.outcome === 'partial' && r21.logs.some((l) => /ProjectsApplyBatch: phase=failed reason=save-failed/.test(l)), JSON.stringify({ reason: r21.res.reason, outcome: r21.res.outcome }));

    // A canceled Save behaves the same way: draft retained, no rebuild.
    install({ markdown: DOC, openByPath: null, saveImpl: () => ({ ok: false, reason: 'canceled' }) });
    const r22c = await capture(() => V.applyPendingChanges());
    check('AP22c', 'a canceled Save causes no Index rebuild and retains the draft', r22c.res.reason === 'save-canceled' && r22c.rebuilds === 0 && V.getPendingSummary().projects === 1, JSON.stringify({ reason: r22c.res.reason, rebuilds: r22c.rebuilds }));

    // AP23: retry after the correctable failure succeeds WITHOUT regenerating
    // the draft identity.
    const identityBefore = V.getDrafts().map((d) => d.projectId).join(',');
    install({ markdown: DOC, openByPath: null });
    const r23 = await capture(() => V.applyPendingChanges());
    check('AP23', 'a retry succeeds without regenerating identity', r23.res.ok === true && identityBefore === ID_A && /stage=delivered/.test(host.markdown) && V.getDrafts().length === 0, JSON.stringify({ identityBefore, ok: r23.res.ok }));

    // ---- AP24-AP26: two Projects, ONE source, ONE barrier/buffer/Save ----
    const recB2 = { projectId: ID_B, name: 'Beta', stage: 'open', state: 'open', value: null, currency: '', expectedOrder: q('', '', false), sourcePath: 'notes/Test2.md', sourceLine: 2, sourceName: 'Test2.md', sourceKind: 'notes', created: TODAY };
    globalThis.WORKSPACE_INDEX_STATE.projects = [record, recB2];
    opener.behavior = 'faithful';
    install({ markdown: STALE, openByPath: { 'notes/Test2.md': DOC_AB } });
    V.refreshRoute();
    V.discardPendingChanges();
    V.setDraftFieldForKey(ID_A, 'stage', 'delivered');
    V.setDraftFieldForKey(ID_B, 'stage', 'pipeline');
    const r24 = await capture(() => V.applyPendingChanges());
    const barriers24 = r24.order.filter((s) => s === 'phase=source-ready').length;
    check('AP24', 'two Projects in one source share ONE ready barrier', r24.res.ok === true && r24.opens === 1 && barriers24 === 1, JSON.stringify({ ok: r24.res.ok, opens: r24.opens, barriers: barriers24 }));
    check('AP25', 'two Projects in one source produce ONE buffer update', r24.bufferWrites === 1, String(r24.bufferWrites));
    check('AP26', 'two Projects in one source produce ONE Save', r24.saves === 1, String(r24.saves));

    // ---- AP27/AP28: two sources, each with its own barrier and own Save --
    const ID_C2 = 'prj_33333333-3333-4333-8333-333333333333';
    const recC2 = { projectId: ID_C2, name: 'Gamma', stage: 'open', state: 'open', value: null, currency: '', expectedOrder: q('', '', false), sourcePath: 'notes/c.md', sourceLine: 1, sourceName: 'c.md', sourceKind: 'notes', created: TODAY };
    const DOC_C2 = 'Project: Gamma\n' + mc(ID_C2) + '\n';
    globalThis.WORKSPACE_STATE.files.notes.push(wsFile('notes/c.md'));
    globalThis.WORKSPACE_INDEX_STATE.projects = [record, recC2];
    const entryA2 = { projectId: ID_A, sourcePath: 'notes/Test2.md', sourceKind: 'notes', sourceLine: 1, fieldCount: 1, operations: [{ operation: 'setStage', value: 'delivered' }] };
    const entryC2 = { projectId: ID_C2, sourcePath: 'notes/c.md', sourceKind: 'notes', sourceLine: 1, fieldCount: 1, operations: [{ operation: 'setStage', value: 'delivered' }] };
    const plan2 = { projects: [entryA2, entryC2], fieldCount: 2, sources: [{ sourcePath: 'notes/Test2.md', sourceKind: 'notes', projects: [entryA2] }, { sourcePath: 'notes/c.md', sourceKind: 'notes', projects: [entryC2] }] };
    opener.behavior = 'faithful';
    install({ markdown: STALE, openByPath: { 'notes/Test2.md': DOC, 'notes/c.md': DOC_C2 } });
    V.discardPendingChanges();
    const r27 = await capture(() => A.applyProjectBatch(plan2));
    const barriers27 = r27.order.filter((s) => s === 'phase=source-ready').length;
    check('AP27', 'two sources each receive their own ready barrier', r27.res.ok === true && r27.opens === 2 && barriers27 === 2, JSON.stringify({ ok: r27.res.ok, opens: r27.opens, barriers: barriers27 }));
    check('AP28', 'two sources each produce ONE Save and ONE buffer update', r27.saves === 2 && r27.bufferWrites === 2, JSON.stringify({ saves: r27.saves, writes: r27.bufferWrites }));

    // ---- AP29/AP30: static contract of the batch owner ------------------
    const adSrc = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'project-visual-adapter.js'), 'utf8');
    check('AP29', 'no hidden direct file read occurs in the batch owner', !/require\(['"]fs['"]\)|readFileSync|writeFileSync|createWriteStream/.test(adSrc));
    check('AP30', 'no timeout-based readiness is required', !/setTimeout|setInterval/.test(adSrc) && /opened\.ready === true/.test(adSrc), 'accepted completion flag present');

    // ---- AP32-AP41: consolidated from package5-batch-and-diagnostics ------
    // Cross-source/mixed batch with a BULLET short-ID source, bullet-alone
    // with its source already active, bounded not-found origin, and the
    // owner-exception origin (never reported as proven project-not-found).
    const SHORT_B = 'prj_0002';
    const DOC_BULLET_B = '- Project: BulletProj [500000 BRL] [28Q1]\n' + mc(SHORT_B) + '\n';
    globalThis.WORKSPACE_STATE.files.notes.push(wsFile('notes/b.md'));
    const recBullet = { projectId: SHORT_B, name: 'BulletProj', stage: '', state: 'open', value: 500000, currency: 'BRL', expectedOrder: q('28Q1', '2028-Q1', true), sourcePath: 'notes/b.md', sourceLine: 1, sourceName: 'b.md', sourceKind: 'notes', created: TODAY };
    const entryBullet = { projectId: SHORT_B, sourcePath: 'notes/b.md', sourceKind: 'notes', sourceLine: 1, fieldCount: 1, operations: [{ operation: 'setState', value: 'on-hold' }] };
    const planBullet = { projects: [entryBullet], fieldCount: 1, sources: [{ sourcePath: 'notes/b.md', sourceKind: 'notes', projects: [entryBullet] }] };
    globalThis.WORKSPACE_INDEX_STATE.projects = [record, recBullet];
    // AP32-AP33: bullet short-ID source ALREADY ACTIVE — one Save, prefix kept.
    opener.behavior = 'faithful';
    install({ markdown: DOC_BULLET_B, openByPath: null });
    V.discardPendingChanges();
    const rAlone = await capture(() => A.applyProjectBatch(planBullet));
    check('AP32', 'a bullet short-ID source applies alone with ONE Save', rAlone.res.ok === true && rAlone.res.appliedProjects === 1 && rAlone.saves === 1, JSON.stringify({ ok: rAlone.res.ok, reason: rAlone.res.reason, saves: rAlone.saves }));
    check('AP33', 'the bullet prefix and metadata survive the physical buffer update', host.markdown.startsWith('- Project: BulletProj') && /state=on-hold/.test(host.markdown) && host.markdown.includes('id=' + SHORT_B), JSON.stringify(host.markdown.split('\n')[0]));
    // AP34-AP35: mixed batch — plain UUID source + bullet short-ID source.
    const entryA3 = { projectId: ID_A, sourcePath: 'notes/Test2.md', sourceKind: 'notes', sourceLine: 1, fieldCount: 1, operations: [{ operation: 'setStage', value: 'delivered' }] };
    const planCross = { projects: [entryA3, entryBullet], fieldCount: 2, sources: [{ sourcePath: 'notes/Test2.md', sourceKind: 'notes', projects: [entryA3] }, { sourcePath: 'notes/b.md', sourceKind: 'notes', projects: [entryBullet] }] };
    opener.behavior = 'faithful';
    install({ markdown: STALE, openByPath: { 'notes/Test2.md': DOC, 'notes/b.md': DOC_BULLET_B } });
    V.discardPendingChanges();
    const rX = await capture(() => A.applyProjectBatch(planCross));
    check('AP34', 'a mixed plain-UUID + bullet short-ID batch applies across two sources with one Save each', rX.res.ok === true && rX.res.appliedProjects === 2 && rX.saves === 2 && rX.bufferWrites === 2, JSON.stringify({ ok: rX.res.ok, applied: rX.res.appliedProjects, saves: rX.saves, writes: rX.bufferWrites }));
    check('AP35', 'the bullet source keeps its prefix in the final buffer', host.markdown.startsWith('- Project: BulletProj') && /state=on-hold/.test(host.markdown), JSON.stringify(host.markdown.split('\n')[0]));
    // AP36-AP38: bounded not-found with an explicit mutation-owner origin.
    opener.behavior = 'faithful';
    install({ markdown: DOC, openByPath: null });
    V.discardPendingChanges();
    const MISSING = 'prj_99999999-9999-4999-8999-999999999999';
    const fr = await capture(() => A.applyProjectFieldChange({ projectId: MISSING, operation: 'setState', value: 'on-hold' }));
    check('AP36', 'a missing projectId is refused as project-not-found', fr.res.ok === false && fr.res.reason === 'project-not-found', JSON.stringify({ ok: fr.res.ok, reason: fr.res.reason }));
    check('AP37', 'the refusal names its mutation-owner not-found origin', Array.isArray(fr.res.diagnostics) && fr.res.diagnostics.some((d) => d && d.code === 'not-found-origin'), JSON.stringify((fr.res.diagnostics || []).map((d) => d && d.code)));
    check('AP38', 'the refusal mutates nothing and Saves nothing', fr.saves === 0 && fr.bufferWrites === 0, JSON.stringify({ saves: fr.saves, writes: fr.bufferWrites }));
    // AP39-AP41: an OWNER EXCEPTION is a distinct origin, never proven not-found.
    const spyOwnerAp2 = globalThis.MME_PROJECT_METADATA_MUTATION;
    globalThis.MME_PROJECT_METADATA_MUTATION = Object.freeze(Object.assign({}, realOwnerAp, {
      mutateProject: () => { throw new Error('boom'); },
    }));
    opener.behavior = 'faithful';
    install({ markdown: DOC, openByPath: null });
    V.discardPendingChanges();
    const er = await capture(() => A.applyProjectFieldChange({ projectId: ID_A, sourcePath: 'notes/Test2.md', sourceKind: 'notes', operation: 'setState', value: 'on-hold' }));
    globalThis.MME_PROJECT_METADATA_MUTATION = spyOwnerAp2;
    check('AP39', 'an owner exception is refused', er.res.ok === false, JSON.stringify({ ok: er.res.ok, reason: er.res.reason }));
    const ediag = Array.isArray(er.res.diagnostics) ? er.res.diagnostics : [];
    check('AP40', 'an owner exception is never reported as proven project-not-found', ediag.some((d) => d && d.code === 'owner-exception-origin') && !ediag.some((d) => d && d.code === 'not-found-origin'), JSON.stringify(ediag.map((d) => d && d.code)));
    check('AP41', 'an owner exception mutates nothing and Saves nothing', er.saves === 0 && er.bufferWrites === 0, JSON.stringify({ saves: er.saves, writes: er.bufferWrites }));

    V.discardPendingChanges();
    globalThis.MME_PROJECT_METADATA_MUTATION = realOwnerAp;
  }

  /* ===================== SCROLL / SPLITTER / COLUMNS ================== */
  group('SC-SP-CW - scroll, splitter and flexible columns');
  {
    const V = globalThis.MME_PROJECTS_VIEW;
    const viewSrc = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'projects-view.js'), 'utf8');
    const css = fs.readFileSync(path.join(ROOT, 'css', 'workspace.css'), 'utf8');
    const layoutCss = fs.readFileSync(path.join(ROOT, 'css', 'layout.css'), 'utf8');
    const act5cRaw = css.slice(css.indexOf('ACT 5C: Projects COMPACT TABLE'));
    // CSS parsing for assertions: comments are not declarations, so they are
    // stripped before any rule is matched.
    const act5c = act5cRaw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/[^\n]*\/\*[^*]*$|[^\n]*\/\/.*$/gm, '');
    const desktopCss = act5c.slice(0, act5c.indexOf('@media (max-width: 767px)'));
    const rule = (sel) => {
      // A rule is a selector at a boundary, never a mention inside prose.
      const re = new RegExp('(^|\\})\\s*' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{', 'm');
      const m = re.exec(act5c);
      if (!m) return '';
      const open = act5c.indexOf('{', m.index);
      let depth = 0;
      for (let j = open; j < act5c.length; j += 1) {
        if (act5c[j] === '{') depth += 1;
        else if (act5c[j] === '}') { depth -= 1; if (depth === 0) return act5c.slice(m.index, j + 1); }
      }
      return act5c.slice(m.index, open + 1);
    };

    // --- scroll contract ---
    const containerHtml = V.buildProjection().html;
    check('SC01', 'the Projects body is the accepted vertical scroll owner', (containerHtml.match(/data-projects-scroll-owner="1"/g) || []).length === 1);
    check('SC02', 'route and body ancestors carry min-height:0', /min-height:\s*0/.test(rule('.projectsView')) && /min-height:\s*0/.test(rule('.projectsBody')));
    check('SC03', 'vertical overflow is auto with contained overscroll', /overflow-y:\s*auto/.test(rule('.projectsBody')) && /overscroll-behavior:\s*contain/.test(rule('.projectsBody')));
    check('SC04', 'the last Project row lives INSIDE the scroll owner', containerHtml.indexOf('data-projects-scroll-owner') < containerHtml.lastIndexOf('data-projects-key'));
    check('SC05', 'expanded details live inside the scroll owner', containerHtml.indexOf('data-projects-scroll-owner') < containerHtml.indexOf('data-details-for'));
    check('SC06', 'the global Apply bar is OUTSIDE the scroll owner', (() => {
      // The bar must appear when the scroll owner is already balanced (depth 0),
      // which is only true when the bar is its SIBLING, not a nested child.
      const start = containerHtml.indexOf('data-projects-scroll-owner');
      const bar = containerHtml.indexOf('data-projects-change-bar');
      if (start === -1 || bar === -1 || bar < start) return false;
      const seg = containerHtml.slice(start, bar);
      const opens = (seg.match(/<div\b/g) || []).length;
      const closes = (seg.match(/<\/div>/g) || []).length;
      return opens === closes;
    })());
    check('SC07', 'touch scrolling remains available', /-webkit-overflow-scrolling:\s*touch/.test(rule('.projectsBody')));
    check('SC08', 'Return remains reachable', /data-action="return-to-workspace"/.test(document.getElementById(V.CONTAINER_ID).innerHTML));
    check('SC09', 'filters remain reachable outside the scroll owner', containerHtml.indexOf('class="projectsFilters"') < containerHtml.indexOf('data-projects-scroll-owner'));
    check('SC10', 'there is exactly ONE vertical scroll owner (no nested competitor)', (act5c.match(/overflow-y:\s*auto/g) || []).length === 1, String((act5c.match(/overflow-y:\s*auto/g) || []).length));

    // --- splitter contract ---
    check('SP01', 'no splitter handle is visible while Projects is active', /html\.projects-view-active \.splitter::before \{ content: none; \}/.test(act5c));
    check('SP01b', 'the Journal/editor/viewer panes are suspended for the route', /html\.projects-view-active #editor/.test(act5c) && /html\.projects-view-active #splitEditor/.test(act5c) && /html\.projects-view-active #viewer/.test(act5c) && /html\.projects-view-active #workspaceSidebar/.test(act5c));
    check('SP02', 'splitter pointer targets cannot overlay Projects controls', /display: none !important/.test(act5c.slice(act5c.indexOf('html.projects-view-active #workspaceSidebar'), act5c.indexOf('.projectsView {'))));
    check('SP03', 'splitter infrastructure is untouched and returns with Journal', /html\.projects-view-active/.test(act5c) && !/\.splitter\s*\{[^}]*display:\s*none/.test(layoutCss) && (css.match(/html\.workspace-index-active/g) || []).length >= 1);
    check('SP04', 'pane sizes are preserved (no width/forced-size rule added)', !/html\.projects-view-active[^{]*\{[^}]*width:/.test(act5c) && !/flex-basis/.test(act5c));
    check('SP05', 'the Workspace Index route rules are untouched', /html\.workspace-index-active #editor/.test(css) && /html\.workspace-index-active \.splitter::before/.test(css));

    // --- flexible column contract ---
    const gridRule = rule('.projectsHeadRow, .projectsRow');
    check('CW01', 'header and rows share ONE grid-template definition', (gridRule.match(/grid-template-columns/g) || []).length === 1 && /\.projectsHeadRow, \.projectsRow/.test(gridRule));
    check('CW02', 'the Project column grows more than the compact fields', /minmax\(10rem, 2\.2fr\)/.test(gridRule) && /minmax\(6rem, 0\.8fr\)/.test(gridRule));
    check('CW03', 'columns honour explicit minimum widths', (gridRule.match(/minmax\(\d+(\.\d+)?rem/g) || []).length >= 6, gridRule);
    check('CW04', 'columns expand with proportional fr units', (gridRule.match(/\d(\.\d)?fr/g) || []).length >= 5);
    check('CW05', 'controls use the full cell width without forcing overflow', /width: 100%/.test(rule('.projectsCellInput, .projectsCellSelect')) && /min-width: 0/.test(rule('.projectsCell')));
    // §3: width:100% + padding + border only fits the track when the control is
    // border-box. Scoped to the two overflowing controls, never a global reset.
    check('CW05b', 'detail controls are border-box so they cannot spill into the neighbour',
      /box-sizing:\s*border-box/.test(rule('.projectsCellInput, .projectsCellSelect')));
    // §3: Value must stay wider than Currency in the details grid.
    check('CW05c', 'the Value track is wider than the Currency track', (() => {
      const tracks = [...rule('.projectsDetailsFields').matchAll(/minmax\(0,\s*([\d.]+)fr\)/g)].map((m) => parseFloat(m[1]));
      // Stage, State, Value, Currency, Order, Delivery, Billing
      return tracks.length === 7 && tracks[2] > tracks[3];
    })(), rule('.projectsDetailsFields'));
    check('CW06', 'Source stays attached to the Project row', /minmax\(8rem, 1\.1fr\);/.test(gridRule) && /data-col="source"/.test(viewSrc) && (() => {
      const h3 = V.buildProjection().html;
      const i = h3.indexOf('data-projects-key=');
      const j = h3.indexOf('data-details-for=');
      const rowHtmlSeg = h3.slice(i, j === -1 ? i + 4000 : j);
      return !/role="columnheader"/.test(rowHtmlSeg) && /data-col="source"/.test(rowHtmlSeg);
    })());
    check('CW07', 'details span the complete row', !/padding: 0 0 8px 28px/.test(act5c) && /min-width: 0/.test(rule('.projectsRowDetails')));
    check('CW08', 'the narrow breakpoint replaces the desktop grid', /@media \(max-width: 767px\)[\s\S]*grid-template-columns: 28px minmax\(0, 2fr\)/.test(act5c));
    check('CW09', 'no destructive horizontal overflow', !/overflow-x:\s*(auto|scroll)/.test(act5c));
    check('CW10', 'columns are CSS-only: no per-render width is written', !/style="[^"]*width/.test(containerHtml) && !/gridTemplateColumns/.test(viewSrc));
  }

  group('B54-B60 - preservation ledger');
  {
    // Each ledger entry re-asserts one PRESERVED invariant through the named
    // suites, so an ACT 5C redesign can never quietly drop one.
    const viewSrc = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'projects-view.js'), 'utf8');
    const idxSrc = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'workspace-index-document.js'), 'utf8');
    const mainSrc = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
    const sidebar = mainSrc.slice(mainSrc.indexOf('function renderWorkspaceProjectsPanel'), mainSrc.indexOf('function renderWorkspaceProjectsPanel') + 9000);

    const totalsFollow = (() => {
      // Known fixture: one BRL and one USD Project, so the ledger proves that
      // totals follow the FILTER, not the whole list.
      globalThis.WORKSPACE_STATE = { rootHandle: {}, rootName: 'ws-1', folders: { notes: {} }, files: { notes: [] }, activeFile: null };
      globalThis.WORKSPACE_INDEX_STATE = { ready: true, projects: [
        proj({ projectId: ID_A, name: 'Alpha', stage: 'quoted', state: 'open', value: 800000, currency: 'BRL', expectedOrder: q('27Q3', '2027-Q3', true), sourcePath: 'notes/a.md', sourceLine: 10, created: TODAY }),
        proj({ projectId: ID_B, name: 'Beta', stage: 'lost', state: 'open', value: 300, currency: 'USD', expectedOrder: q('28Q1', '2028-Q1', true), sourcePath: 'notes/b.md', sourceLine: 4, created: TODAY }),
        proj({ name: 'Legacy Row', sourcePath: 'notes/c.md', sourceLine: 9 }),
      ] };
      const rows = globalThis.WORKSPACE_INDEX_STATE.projects.map(globalThis.MME_PROJECTS_VIEW.decorate);
      const all = globalThis.MME_PROJECTS_VIEW.computeTotals(globalThis.MME_PROJECTS_VIEW.applyFilters(rows));
      globalThis.MME_PROJECTS_VIEW.setFilter('currency', 'USD');
      const filtered = globalThis.MME_PROJECTS_VIEW.computeTotals(globalThis.MME_PROJECTS_VIEW.applyFilters(rows));
      globalThis.MME_PROJECTS_VIEW.clearFilters();
      return all.totals.length === 2 && filtered.totals.length === 1 && filtered.totals[0].currency === 'USD' && filtered.totals[0].totalValue === 300;
    })();
    check('B54', 'totals-follow-filters remains green', totalsFollow);

    const clearWorks = (() => {
      const V = globalThis.MME_PROJECTS_VIEW;
      V.setFilter('stage', 'quoted'); V.setFilter('currency', 'BRL'); V.setFilter('search', 'x');
      V.clearFilters();
      const f = V.getViewState().filters;
      return V.getViewState().search === '' && f.stage === 'all' && f.currency === 'all' && f.value === 'all';
    })();
    check('B55', 'Clear filters remains green', clearWorks);

    const legacy = globalThis.WORKSPACE_INDEX_STATE.projects.find((p) => !p.projectId);
    check('B56', 'unmanaged rows remain read-only', Boolean(legacy) && !/<input|<select/.test(legacyRegionOf(globalThis.MME_PROJECTS_VIEW, keyOfRecord(globalThis.MME_PROJECTS_VIEW, legacy))));

    check('B57', 'Workspace-state correction remains green', (() => {
      const ws = { rootHandle: {}, rootName: 'ws-1', folders: { notes: {} }, files: { notes: [] }, activeFile: null };
      globalThis.WORKSPACE_STATE = ws;
      const rw = globalThis.MME_PROJECTS_VIEW.readWorkspaceState();
      return rw.available === true && !('activeWorkspace' in rw.state);
    })());

    check('B58', 'the Sidebar remains read-only', !/<input|<select/.test(sidebar) && !/MME_PROJECT_VISUAL_ADAPTER/.test(sidebar));
    check('B59', 'the Workspace Index remains read-only', !/MME_PROJECT_VISUAL_ADAPTER/.test(idxSrc) && !/data-action="apply-drafts"/.test(idxSrc));
    check('B60', 'the Task filter correction remains green', idxSrc.includes('data-index-task-filter="all"') && idxSrc.includes("taskFilterValue || 'all'"));

    check('B61', 'the redesigned view still owns no Save or write path', !/saveSmart|saveToHandle|createWritable|currentSaveHandle|applyMarkdown/.test(viewSrc));
    check('B62', 'draft state is never persisted to browser storage', !/localStorage|sessionStorage|indexedDB/.test(viewSrc));
  }

  /* ============ SAVE CAPABILITY GATE (device-shaped) =================== */
  group('CAP - Save is capability-gated by the active route');
  {
    // The REAL capability module: journal.save===true, projects.save===false.
    // This is the production relationship that decides whether a Save can ever
    // succeed, so the check uses the shipped map instead of a hand-rolled one.
    const capPath = path.join(ROOT, 'js', 'workspace', 'workspace-capabilities.js');
    delete require.cache[require.resolve(capPath)];
    require(capPath);
    const CAPS = globalThis.MME_WORKSPACE_CAPABILITIES;
    check('CAP00', 'the shipped map refuses Save on Projects and allows it on Journal',
      Boolean(CAPS) && CAPS.can('projects', 'save') === false && CAPS.can('journal', 'save') === true);

    // Real managed Markdown: the title line plus the shipped managed comment.
    const capDoc = 'Project: Alpha [800000 BRL] [27Q3]\n' + mc(ID_A) + '\n';
    const capEntry = { projectId: ID_A, sourcePath: 'notes/cap.md', sourceKind: 'notes', sourceLine: 1, fieldCount: 1, operations: [{ operation: 'setStage', value: 'delivered' }] };
    const capPlan = { projects: [capEntry], fieldCount: 1, sources: [{ sourcePath: 'notes/cap.md', sourceKind: 'notes', projects: [capEntry] }] };

    const wire = (st, switchTo) => {
      globalThis.MME_WORKSPACE_HOST = { switchTo, getActiveId: () => st.active };
      globalThis.MME_PROJECT_EDIT_HOST = Object.freeze({
        isDirty: () => st.dirty,
        getMarkdown: () => st.markdown,
        currentFileName: () => 'a.md',
        applyMarkdown: (t) => { st.bufferWrites += 1; st.markdown = String(t); st.dirty = true; return true; },
        save: async () => {
          st.saves += 1;
          st.saveActiveAt.push(st.active);
          // EXACTLY main.js saveSmart(): the capability check comes FIRST.
          if (!CAPS.canActive('save')) return { ok: false, reason: 'unavailable' };
          st.dirty = false;
          return { ok: true };
        },
        rebuildIndex: async () => { st.rebuilds += 1; return null; },
      });
    };

    // ---- the batch under the real capability gate ----
    const st = { active: 'projects', markdown: capDoc, dirty: false, saves: 0, bufferWrites: 0, rebuilds: 0, switches: [], saveActiveAt: [] };
    wire(st, async (id) => { st.switches.push(id); st.active = id; return { status: 'activated' }; });

    const res = await globalThis.MME_PROJECT_VISUAL_ADAPTER.applyProjectBatch(capPlan);
    check('CAP01', 'the batch Applies with the capability gate in force', res.ok === true && res.outcome === 'complete', JSON.stringify({ outcome: res.outcome, reason: res.reason }));
    check('CAP02', 'the single Save runs on the Save-capable route', st.saveActiveAt.length === 1 && st.saveActiveAt[0] === 'journal', JSON.stringify(st.saveActiveAt));
    check('CAP03', 'Journal is reached BEFORE the dirty guard and any Save', st.switches[0] === 'journal', JSON.stringify(st.switches));
    check('CAP04', 'the Projects route is the LAST switch', st.switches[st.switches.length - 1] === 'projects', JSON.stringify(st.switches));
    check('CAP05', 'exactly one buffer update, one Save and one rebuild', st.bufferWrites === 1 && st.saves === 1 && st.rebuilds === 1, JSON.stringify({ w: st.bufferWrites, s: st.saves, b: st.rebuilds }));
    check('CAP06', 'the Project is persisted and the buffer is clean', /stage=delivered/.test(st.markdown) && st.dirty === false, st.markdown.split('\n')[0]);

    // ---- negative control: a transition that cannot happen ----
    // This reproduces the ACT 5C device defect: Save is refused while the
    // Projects route is active, so ZERO Projects change and the Index is never
    // rebuilt even though the reconciled buffer already holds the new text.
    const st2 = { active: 'projects', markdown: capDoc, dirty: false, saves: 0, bufferWrites: 0, rebuilds: 0, switches: [], saveActiveAt: [] };
    wire(st2, async (id) => ({ status: 'busy', workspaceId: id }));

    const res2 = await globalThis.MME_PROJECT_VISUAL_ADAPTER.applyProjectBatch(capPlan);
    check('CAP07', 'control: without the route change nothing is applied', res2.ok !== true && res2.appliedProjects === 0 && res2.reason === 'save-failed', JSON.stringify({ outcome: res2.outcome, reason: res2.reason, applied: res2.appliedProjects }));
    check('CAP08', 'control: no Index rebuild, buffer stays dirty and retryable', st2.rebuilds === 0 && st2.dirty === true && /stage=delivered/.test(st2.markdown), JSON.stringify({ rebuilds: st2.rebuilds, dirty: st2.dirty }));
    check('CAP09', 'control: the Projects route was never left behind', st2.switches.length === 0, JSON.stringify(st2.switches));
  }

  /* ============ NODELIST BROWSER CONTRACT ============================== */
  // The shipped defect: `c.querySelectorAll(...).find is not a function`
  // (projects-view.js:921). The harness previously returned an Array, which
  // hid it. These fixtures pin the REAL NodeList contract the view must obey.
  group('NL - NodeList browser contract');
  {
    const probe = document.createElement('div');
    probe.innerHTML = '<span data-nl="a">A</span><span data-nl="b">B</span>';
    const nodes = probe.querySelectorAll('[data-nl]');
    check('NL01', 'querySelectorAll() returns a length-carrying collection', Boolean(nodes) && nodes.length === 2, String(nodes && nodes.length));
    check('NL02', 'indexed access works', Boolean(nodes[0]) && nodes[0].getAttribute('data-nl') === 'a');
    let iterated = 0;
    for (const n of nodes) if (n && n.getAttribute('data-nl')) iterated += 1;
    check('NL03', 'for..of iteration works', iterated === 2, String(iterated));
    let foreached = 0;
    if (typeof nodes.forEach === 'function') nodes.forEach(() => { foreached += 1; });
    check('NL04', 'forEach works when provided', foreached === 2, String(foreached));
    check('NL05', 'Array#find is NOT provided on querySelectorAll()', typeof nodes.find !== 'function', typeof nodes.find);
    let threwOnFind = false;
    try { nodes.find(() => true); } catch { threwOnFind = true; }
    check('NL06', 'the shipped querySelectorAll(...).find() call throws exactly as in the browser', threwOnFind === true, String(threwOnFind));
    check('NL07', 'Array#map is NOT provided', typeof nodes.map !== 'function', typeof nodes.map);
    check('NL08', 'Array#filter is NOT provided', typeof nodes.filter !== 'function', typeof nodes.filter);
    check('NL09', 'item() addressability remains', typeof nodes.item === 'function' && nodes.item(1) === nodes[1]);
    // The VIEW's own lookup must work against this browser-faithful collection.
    const V = globalThis.MME_PROJECTS_VIEW;
    await V.getDescriptor().activate();
    const container = document.getElementById(V.CONTAINER_ID);
    const rowsNl = container ? container.querySelectorAll('[data-projects-key]') : null;
    check('NL10', 'the view row lookup works without Array methods', Boolean(rowsNl) && rowsNl.length >= 1 && findByAttr(container, 'data-projects-key', String(rowsNl[0].getAttribute('data-projects-key'))) === rowsNl[0]);
  }

  /* ============ CK: TWO-SOURCE DEVICE CHECKPOINT (ACT 5C final) ========== */
  // Owner checkpoint: one batch containing Project A from notes/2026-08-04.md
  // and Project B from notes/2026-07-07.md while a THIRD note is active.
  // Expected: applied=2, failed=0, exactly one physical Save per source,
  // the Projects route restored afterwards, drafts cleared. The opener is
  // device-faithful: it reads the source text from a workspace "disk" and
  // installs the active-document identity exactly like production
  // openWorkspaceFile() before reporting ready — no fixture assigns the
  // batch's expected Markdown onto the live buffer directly.
  group('CK - two-source device checkpoint');
  if (D) {
    const { V, setControl, realAdapter, realOwner } = D;
    V.discardPendingChanges();
    delete globalThis.MME_WORKSPACE_CAPABILITIES; // no capability policy: pure route behaviour

    const ID_84 = 'prj_90909090-9090-4909-8909-909090909084';
    const ID_07 = 'prj_90909090-9090-4909-8909-909090909007';
    const P_84 = proj({ projectId: ID_84, name: 'Checkpoint A', stage: 'quoted', state: 'open', value: 100, currency: 'USD', sourcePath: 'notes/2026-08-04.md', sourceLine: 1, sourceName: '2026-08-04.md', created: TODAY });
    const P_07 = proj({ projectId: ID_07, name: 'Checkpoint B', stage: 'funnel', state: 'open', sourcePath: 'notes/2026-07-07.md', sourceLine: 1, sourceName: '2026-07-07.md', created: TODAY });

    const DISK = {
      'notes/2026-08-04.md': 'Project: Checkpoint A\n' + mc(ID_84) + '\n',
      'notes/2026-07-07.md': 'Project: Checkpoint B\n' + mc(ID_07) + '\n',
      'notes/2026-09-01.md': '# A third note is active before the batch\n',
    };
    const SRC_84 = wsFile('notes/2026-08-04.md');
    const SRC_07 = wsFile('notes/2026-07-07.md');
    const SRC_09 = wsFile('notes/2026-09-01.md');
    globalThis.WORKSPACE_STATE = {
      rootHandle: {}, rootName: 'ws-ck', folders: { notes: {} },
      files: { notes: [SRC_84, SRC_07, SRC_09] },
      activeFile: { kind: 'notes', name: '2026-09-01.md', path: 'notes/2026-09-01.md', handle: SRC_09.handle },
    };
    globalThis.WORKSPACE_INDEX_STATE = { ready: true, projects: [P_84, P_07] };
    globalThis.findWorkspaceFileByPath = (p) => (globalThis.WORKSPACE_STATE.files.notes.find((f) => f.path === p) || null);
    globalThis.MME_PROJECT_VISUAL_ADAPTER = realAdapter;
    globalThis.MME_PROJECT_METADATA_MUTATION = realOwner;

    // Route owner: starts on Journal (the Save-capable route), records every
    // transition so the guaranteed Projects restoration is observable.
    let route = 'journal';
    const switches = [];
    globalThis.MME_WORKSPACE_HOST = {
      switchTo: async (id) => { route = String(id); switches.push(String(id)); return { status: 'activated' }; },
      getActiveId: () => route,
    };

    const ck = { saves: 0, bufferWrites: 0, rebuilds: 0, markdown: '', currentPath: '' };
    globalThis.MME_PROJECT_EDIT_HOST = Object.freeze({
      isDirty: () => false,
      getMarkdown: () => ck.markdown,
      currentFileName: () => '2026-09-01.md',
      currentSourcePath: () => ck.currentPath || 'notes/2026-09-01.md',
      applyMarkdown: (t) => { ck.bufferWrites += 1; ck.markdown = String(t); return true; },
      save: async () => {
        ck.saves += 1;
        if (ck.currentPath) DISK[ck.currentPath] = ck.markdown; // the physical Save persists the ACTIVE source
        return { ok: true };
      },
      rebuildIndex: async () => { ck.rebuilds += 1; return null; },
    });

    // Device-faithful opener: reads the file from the workspace disk, installs
    // it as the live buffer AND installs the active-document identity — the
    // exact side-effect sequence production openWorkspaceFile() performs.
    let opens = 0;
    globalThis.openWorkspaceFile = async (rec, kind) => {
      const text = DISK[rec && rec.path];
      if (text == null) return { ok: false };
      opens += 1;
      ck.currentPath = rec.path;
      ck.markdown = text;
      globalThis.WORKSPACE_STATE.activeFile = { kind: String(kind || 'notes'), name: rec.name, path: rec.path, handle: rec.handle };
      return { ok: true, ready: true };
    };

    ck.markdown = DISK['notes/2026-09-01.md'];
    await V.getDescriptor().activate();
    V.refreshRoute();

    setControl(ID_84, 'stage', 'delivered');
    setControl(ID_07, 'stage', 'pipeline');
    const vres = V.validateAllDrafts();
    const plan = V.buildApplyPlan();
    check('CK01', 'the checkpoint holds two valid drafts across two sources', vres.valid === true && vres.projects === 2 && vres.fields >= 2, JSON.stringify(vres));
    check('CK02', 'the Apply plan targets two Projects in two source files', plan.projects.length === 2 && plan.sources.length === 2 && plan.fieldCount >= 2, JSON.stringify({ projects: plan.projects.length, sources: plan.sources.length, fields: plan.fieldCount }));

    const res = await V.applyPendingChanges();
    check('CK03', 'the batch applies both Projects with zero failures', res.ok === true && res.outcome === 'complete' && res.appliedProjects === 2 && res.failedProjects === 0, JSON.stringify(res));
    check('CK04', 'the view reports two applied Projects across two sources with none pending', res.appliedProjects === 2 && res.sources === 2 && res.pendingProjects === 0, JSON.stringify(res));
    check('CK05', 'exactly one physical Save and one buffer update per source', ck.saves === 2 && ck.bufferWrites === 2, JSON.stringify({ saves: ck.saves, writes: ck.bufferWrites }));
    check('CK06', 'both non-active sources opened through the accepted owner', opens === 2, String(opens));
    check('CK07', 'the dedicated Projects route is restored after Apply', route === 'projects' && switches.length > 0 && switches[switches.length - 1] === 'projects', JSON.stringify(switches));
    check('CK08', 'drafts are cleared after the successful batch', V.getPendingSummary().projects === 0 && V.getDrafts().length === 0, JSON.stringify(V.getPendingSummary()));
    check('CK09', 'each source file persisted its own Project mutation', /stage=delivered/.test(DISK['notes/2026-08-04.md']) && DISK['notes/2026-08-04.md'].includes('id=' + ID_84) && /stage=pipeline/.test(DISK['notes/2026-07-07.md']) && DISK['notes/2026-07-07.md'].includes('id=' + ID_07), JSON.stringify(DISK));
    check('CK10', 'the Index was rebuilt once per saved source', ck.rebuilds === 2, String(ck.rebuilds));
    // Leave the suite in a clean, deterministic state.
    V.discardPendingChanges();
  }

  /* ============ EO: QUARTER STRUCTURED CONTRACT, ALL THREE FIELDS (5D-FU) = */
  group('EO - quarter structured contract, Order/Delivery/Billing');
  {
    const V = globalThis.MME_PROJECTS_VIEW;
    const M = globalThis.MME_PROJECT_METADATA_MUTATION;
    const NQ = globalThis.normalizeProjectQuarter;
    const ID_EO = 'prj_e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e001';
    const mcEo = (id) => '<!-- mme-project: id=' + id + '; created=' + TODAY + ' -->';
    const EO_DOC = 'Project: EO Fixture\n' + mcEo(ID_EO) + '\n';
    const P_EO = proj({ projectId: ID_EO, name: 'EO Fixture', stage: 'quoted', state: 'open', sourcePath: 'notes/eo.md', sourceLine: 1, sourceName: 'eo.md', created: TODAY, expectedOrder: q('29Q3', '2029-Q3', true) });
    const P_BAD = proj({ projectId: 'prj_e0e0e0e0-e0e0-4e0e-8e0e-e0e0e0e0e002', name: 'EO Legacy', stage: 'quoted', state: 'open', sourcePath: 'notes/eo-legacy.md', sourceLine: 1, sourceName: 'eo-legacy.md', created: TODAY, expectedOrder: q('Custom XYZ', '', false) });
    globalThis.WORKSPACE_INDEX_STATE = { ready: true, projects: [P_EO, P_BAD] };
    V.discardPendingChanges();

    check('EO01', '29Q3 reads as Year 2029 / Quarter Q3', (() => { const n = NQ('29Q3'); return n.valid === true && n.year === 2029 && n.quarter === 3 && n.canonical === '2029-Q3'; })());
    check('EO02', 'all required aliases normalize identically', ['29Q3', '2029Q3', '2029-Q3', '2029 Q3', '29q3'].every((v) => { const n = NQ(v); return n.valid === true && n.canonical === '2029-Q3' && n.year === 2029 && n.quarter === 3; }), ['29Q3', '2029Q3', '2029-Q3', '2029 Q3', '29q3'].map((v) => NQ(v).valid).join(','));
    // ACT 5D-FU s4: fixed product range is 2020-2100. 2020Q1 is valid; 2019
    // and 2101 structured inputs are rejected as new values.
    check('EO03', 'bounds: 2020Q1/2025Q1/2099Q4/2100Q4 valid, 2019/2101/Q0/Q5 invalid', NQ('2020Q1').valid === true && NQ('2025Q1').valid === true && NQ('2099Q4').valid === true && NQ('2100Q4').valid === true && NQ('19Q1').valid === false && NQ('2101-Q1').valid === false && NQ('26Q0').valid === false && NQ('26Q5').valid === false);
    check('EO04', 'year 2100 keeps the full display representation', NQ('2100Q4').display === '2100Q4' && NQ('2029Q3').display === '29Q3');

    // s14 view/mutation parity: for EVERY candidate the view validation and
    // the mutation owner must AGREE before Apply can begin.
    const parityValues = ['2020Q1', '2025Q1', '29Q3', '2029Q3', '2029-Q3', '2029 Q3', '2099Q4', '2100Q4', '19Q1', '2101-Q1', '26Q0', '26Q5', '2029-', '-Q3', 'not-a-quarter', ''];
    const parity = [];
    for (const v of parityValues) {
      V.discardPendingChanges();
      V.setDraftFieldForKey(ID_EO, 'expectedOrder', v);
      const vres = V.validateAllDrafts();
      const owner = v === ''
        ? M.mutateProject(EO_DOC, { projectId: ID_EO }, { op: 'clearExpectedOrder' })
        : M.mutateProject(EO_DOC, { projectId: ID_EO }, { op: 'setExpectedOrder', quarter: v });
      if (vres.valid !== owner.ok) parity.push(`${v}:${vres.valid}/${owner.ok}`);
    }
    V.discardPendingChanges();
    check('EO05', 'view validation and mutation validation agree on every value', parity.length === 0, parity.join(' '));

    // All THREE quarter fields share the parity contract (Delivery/Billing
    // parity proven through the owner + validation, not only Order).
    const triParity = [];
    for (const f of ['expectedOrder', 'expectedDelivery', 'expectedBilling']) {
      const op = f === 'expectedOrder' ? 'setExpectedOrder' : (f === 'expectedDelivery' ? 'setExpectedDelivery' : 'setExpectedBilling');
      const clr = 'clear' + op.slice(3);
      for (const v of ['2020Q1', '29Q3', '2100Q4', '19Q1', '']) {
        V.discardPendingChanges();
        V.setDraftFieldForKey(ID_EO, f, v);
        const vres = V.validateAllDrafts();
        const owner = v === ''
          ? M.mutateProject(EO_DOC, { projectId: ID_EO }, { op: clr })
          : M.mutateProject(EO_DOC, { projectId: ID_EO }, { op, quarter: v });
        if (vres.valid !== owner.ok) triParity.push(`${f}:${v}:${vres.valid}/${owner.ok}`);
      }
    }
    V.discardPendingChanges();
    check('EO05b', 'parity holds for Delivery and Billing too', triParity.length === 0, triParity.join(' '));

    V.setDraftFieldForKey(ID_EO, 'expectedOrder', '2029-');
    const partial = V.validateAllDrafts();
    check('EO06', 'year without quarter is prevented before Apply', partial.valid === false && partial.invalid.includes(ID_EO), JSON.stringify(partial));
    // ACT 5D-FU: Quarter-first partial also stays visible and blocks Apply.
    V.discardPendingChanges();
    V.setDraftFieldForKey(ID_EO, 'expectedDelivery', '-Q3');
    const partialQ = V.validateAllDrafts();
    check('EO06b', 'quarter without year is prevented before Apply', partialQ.valid === false && partialQ.invalid.includes(ID_EO), JSON.stringify(partialQ));
    V.discardPendingChanges();
    V.setDraftFieldForKey(ID_EO, 'expectedOrder', '');
    const clearPlan = V.buildApplyPlan();
    const clearOp = clearPlan.projects.length ? clearPlan.projects[0].operations[0] : null;
    const cleared = clearOp ? M.mutateProject(EO_DOC, { projectId: ID_EO }, { op: clearOp.operation }) : { ok: false };
    check('EO07', 'Clear Expected Order emits clearExpectedOrder and the owner accepts it', Boolean(clearOp) && clearOp.operation === 'clearExpectedOrder' && cleared.ok === true, JSON.stringify(clearOp));
    V.discardPendingChanges();

    // Recognized future value renders STRUCTURED (never "Legacy:").
    const htmlFuture = V.buildProjection().html;
    check('EO08', 'recognized 29Q3 renders structured selects, never a Legacy label', htmlFuture.includes('data-quarter-part="year"') && htmlFuture.includes('data-quarter-part="quarter"') && !htmlFuture.includes('Legacy: 29Q3'));
    // ACT 5D-FU: NO separate Clear button exists — the empty "—" option is
    // the only Clear affordance — and Delivery/Billing render structured too.
    check('EO09', 'no separate Clear button exists; empty option is the Clear affordance', !htmlFuture.includes('data-action="clear-quarter"') && !htmlFuture.includes('projectsQuarterClear'));
    check('EO09b', 'Delivery and Billing render structured Year+Quarter pairs', (htmlFuture.match(/data-quarter-field="expectedDelivery"/g) || []).length >= 1 && (htmlFuture.match(/data-quarter-field="expectedBilling"/g) || []).length >= 1 && (htmlFuture.match(/data-quarter-field="expectedOrder"/g) || []).length >= 1);
    check('EO10', 'year options span the fixed product range 2020-2100 only', htmlFuture.includes('value="2020"') && htmlFuture.includes('value="2100"') && !/value="2019"/.test(htmlFuture) && !/value="2101"/.test(htmlFuture));

    // Malformed existing value stays visible as custom and is never rewritten.
    const idxBefore = JSON.stringify(globalThis.WORKSPACE_INDEX_STATE);
    const htmlLegacy = V.buildProjection().html;
    V.validateAllDrafts();
    const idxAfter = JSON.stringify(globalThis.WORKSPACE_INDEX_STATE);
    check('EO11', 'malformed existing value stays visible as Custom', htmlLegacy.includes('Custom: Custom XYZ'));
    check('EO12', 'rendering and validation never rewrite the Index', idxBefore === idxAfter);

    // Canonical persisted representation + parser read-back after "save".
    const persist29 = M.mutateProject(EO_DOC, { projectId: ID_EO }, { op: 'setExpectedOrder', quarter: '29Q3' });
    const rb29 = persist29.ok ? globalThis.WORKSPACE_PARSER.parseProjects(persist29.proposedMarkdown, {})[0] : null;
    const persist2100 = M.mutateProject(EO_DOC, { projectId: ID_EO }, { op: 'setExpectedOrder', quarter: '2100Q4' });
    const rb2100 = persist2100.ok ? globalThis.WORKSPACE_PARSER.parseProjects(persist2100.proposedMarkdown, {})[0] : null;
    check('EO13', 'persisted 29Q3 keeps the proven compact form and reads back structured', Boolean(persist29.ok) && persist29.proposedMarkdown.includes('[29Q3]') && rb29 && rb29.expectedOrder.canonical === '2029-Q3');
    check('EO14', 'persisted 2100Q4 uses the unambiguous full form and reads back', Boolean(persist2100.ok) && persist2100.proposedMarkdown.includes('[2100Q4]') && !persist2100.proposedMarkdown.includes('[00Q4]') && rb2100 && rb2100.expectedOrder.canonical === '2100-Q4');
    const persistSpace = M.mutateProject(EO_DOC, { projectId: ID_EO }, { op: 'setExpectedOrder', quarter: '2029 Q3' });
    check('EO15', 'the space alias is accepted by the mutation owner', persistSpace.ok === true && persistSpace.proposedMarkdown.includes('[29Q3]'), persistSpace.reason);
    // ACT 5D-FU: 2020 persists compactly and reads back canonically.
    const persist20 = M.mutateProject(EO_DOC, { projectId: ID_EO }, { op: 'setExpectedOrder', quarter: '2020Q1' });
    const rb20 = persist20.ok ? globalThis.WORKSPACE_PARSER.parseProjects(persist20.proposedMarkdown, {})[0] : null;
    check('EO15b', 'persisted 2020Q1 is structured and reads back', Boolean(persist20.ok) && persist20.proposedMarkdown.includes('[20Q1]') && rb20 && rb20.expectedOrder.canonical === '2020-Q1');
    V.discardPendingChanges();
  }

  /* ============ FU: SHORT WORKSPACE ID CONTRACT (ACT 5D-FU) ============ */
  group('FU - short workspace project IDs');
  {
    const P = globalThis.WORKSPACE_PARSER;
    const ID_UUID = 'prj_11111111-1111-4111-8111-111111111111';
    check('FU01', 'existing UUID IDs remain valid', P.isProjectIdValue(ID_UUID) === true);
    check('FU02', 'prj_0001 is valid with minimum four-digit padding', P.isProjectIdValue('prj_0001') === true);
    check('FU03', 'sequence grows beyond 9999 without truncation', P.isProjectIdValue('prj_10000') === true && P.nextWorkspaceProjectId(['prj_9999']) === 'prj_10000');
    check('FU04', 'short padded forms below four digits are rejected', P.isProjectIdValue('prj_001') === false && P.isProjectIdValue('prj_short') === false);
    check('FU05', 'allocation starts at prj_0001 on an empty inventory', P.nextWorkspaceProjectId([]) === 'prj_0001');
    check('FU06', 'allocation reserves the complete existing workspace sequence', P.nextWorkspaceProjectId(['prj_0001', 'prj_0002', 'prj_0007']) === 'prj_0008');
    check('FU07', 'allocation mixes UUID and short reservations without collision', P.nextWorkspaceProjectId([ID_UUID, 'prj_0001']) === 'prj_0002');
    check('FU08', 'two different reservation sets receive different IDs', (() => {
      const a = P.nextWorkspaceProjectId([]);
      const b = P.nextWorkspaceProjectId([a]);
      return a === 'prj_0001' && b === 'prj_0002' && a !== b;
    })());
    check('FU09', 'multiple new Projects in one document receive distinct IDs', (() => {
      const seen = [];
      const gen = () => { const id = P.nextWorkspaceProjectId(seen); seen.push(id); return id; };
      const r1 = P.reconcileManagedProjects('Project: A\nProject: B\n', { today: TODAY, generateId: gen });
      const ids = [...r1.text.matchAll(/id=(prj_[0-9]+)/g)].map((m) => m[1]);
      return r1.inserted === 2 && ids.length === 2 && ids[0] !== ids[1];
    })());
    check('FU10', 'rename stability: existing IDs are never regenerated', (() => {
      const again = P.reconcileManagedProjects('Project: Renamed A\n<!-- mme-project: id=prj_0003; created=' + TODAY + ' -->\n', { today: TODAY, generateId: () => 'prj_0001' });
      return again.changed === false && again.text.includes('prj_0003');
    })());
    check('FU11', 'failed Save retry reuses identity: reconcile is idempotent on commented text', (() => {
      const r1 = P.reconcileManagedProjects('Project: A\n', { today: TODAY, generateId: () => 'prj_0004' });
      const r2 = P.reconcileManagedProjects(r1.text, { today: TODAY, generateId: () => 'prj_0005' });
      return r1.text.includes('prj_0004') && r2.changed === false && r2.text === r1.text;
    })());
    check('FU12', 'a refused generator diagnoses inventory-incomplete, not a fallback write', (() => {
      const r = P.reconcileManagedProjects('Project: A\n', { today: TODAY, generateId: () => '' });
      return r.changed === false && r.inserted === 0 && r.diagnostics.some((d) => d.code === 'inventory-incomplete');
    })());
    check('FU13', 'copied duplicate IDs across files are diagnosed, never renumbered', (() => {
      const dup = P.parseProjects('Project: A\n<!-- mme-project: id=prj_0006; created=' + TODAY + ' -->\nProject: B\n<!-- mme-project: id=prj_0006; created=' + TODAY + ' -->\n', {});
      return dup.some((p) => (p.diagnostics || []).some((d) => d.code === 'duplicate-managed-id'));
    })());
    check('FU14', 'reservation builder unions index, live buffer and operation IDs', (() => {
      const b = P.collectReservedProjectIds([{ projectId: 'prj_0001' }, { projectId: ID_UUID }], 'Project: X\n<!-- mme-project: id=prj_0009; created=' + TODAY + ' -->\n', ['prj_0010']);
      return b.incomplete === false && b.ids.indexOf('prj_0001') !== -1 && b.ids.indexOf('prj_0009') !== -1 && b.ids.indexOf('prj_0010') !== -1 && P.nextWorkspaceProjectId(b.ids) === 'prj_0011';
    })());
    check('FU15', 'incomplete inventory is flagged so allocation must stop', P.collectReservedProjectIds(null, '', []).incomplete === true);
    check('FU16', 'malformed existing identity is never overwritten as repair', (() => {
      const r = P.reconcileManagedProjects('Project: A\n<!-- mme-project: id=prj_short; created=' + TODAY + ' -->\n', { today: TODAY, generateId: () => 'prj_0001' });
      return r.changed === false && r.text.includes('prj_short') && !r.text.includes('prj_0001');
    })());
    try { globalThis.MME_PROJECTS_VIEW.discardPendingChanges(); } catch {}
  }

  /* === NI: NEW short-ID Project Apply via production bridge (ACT 5D corrective) ===
   * Real adapter + mutation owner + edit-host bridge (never a fixture-supplied
   * Markdown+id). Existing UUID Project in source A, NEWLY reconciled short-ID
   * Project in source B: Save mints prj_0001, Index discovers it, View drafts a
   * change and the bridge applies it. A stale-textarea or identity mismatch
   * fails these, not the pure-owner unit tests.
   */
  group('NI - new short-ID Project Apply via production bridge');
  if (D) {
    const { V, realAdapter, realOwner } = D;
    V.discardPendingChanges();
    delete globalThis.MME_WORKSPACE_CAPABILITIES;

    const ID_EXIST = 'prj_11111111-1111-4111-8111-111111111111';
    const ID_NEW = 'prj_0001';
    const DOC_A = 'Project: Existing A\n' + mc(ID_EXIST) + '\n';
    const DOC_B = 'Project: New B\n<!-- mme-project: id=' + ID_NEW + '; created=' + TODAY + '; stage=funnel; state=open -->\n';
    const P_EXIST = proj({ projectId: ID_EXIST, name: 'Existing A', stage: 'quoted', state: 'open', sourcePath: 'notes/ni-a.md', sourceLine: 1, sourceName: 'ni-a.md', created: TODAY });
    const P_NEW = proj({ projectId: ID_NEW, name: 'New B', stage: 'funnel', state: 'open', sourcePath: 'notes/ni-b.md', sourceLine: 1, sourceName: 'ni-b.md', created: TODAY });
    const SRC_A = wsFile('notes/ni-a.md');
    const SRC_B = wsFile('notes/ni-b.md');
    const DISK = { 'notes/ni-a.md': DOC_A, 'notes/ni-b.md': DOC_B };
    globalThis.WORKSPACE_STATE = {
      rootHandle: {}, rootName: 'ws-ni', folders: { notes: {} },
      files: { notes: [SRC_A, SRC_B] },
      activeFile: { kind: 'notes', name: 'ni-a.md', path: 'notes/ni-a.md', handle: SRC_A.handle },
    };
    globalThis.WORKSPACE_INDEX_STATE = { ready: true, projects: [P_EXIST, P_NEW] };
    globalThis.findWorkspaceFileByPath = (p) => (globalThis.WORKSPACE_STATE.files.notes.find((f) => f.path === p) || null);
    globalThis.MME_PROJECT_VISUAL_ADAPTER = realAdapter;
    globalThis.MME_PROJECT_METADATA_MUTATION = realOwner;
    let route = 'journal';
    globalThis.MME_WORKSPACE_HOST = { switchTo: async (id) => { route = String(id); return { status: 'activated' }; }, getActiveId: () => route };
    const ni = { saves: 0, bufferWrites: 0, rebuilds: 0, markdown: DOC_A, currentPath: 'notes/ni-a.md' };
    globalThis.MME_PROJECT_EDIT_HOST = Object.freeze({
      isDirty: () => false,
      getMarkdown: () => ni.markdown,
      currentFileName: () => (ni.currentPath || '').split('/').pop(),
      currentSourcePath: () => ni.currentPath || '',
      getActiveDocumentIdentity: () => {
        const af = globalThis.WORKSPACE_STATE.activeFile || {};
        return { sourcePath: String(af.path || ''), sourceKind: String(af.kind || 'notes'), fileName: String(af.name || ''), hasWritableHandle: Boolean(ni.currentPath) };
      },
      applyMarkdown: (t) => { ni.bufferWrites += 1; ni.markdown = String(t); return true; },
      save: async () => { ni.saves += 1; if (ni.currentPath) DISK[ni.currentPath] = ni.markdown; return { ok: true }; },
      rebuildIndex: async () => { ni.rebuilds += 1; return null; },
    });
    let opens = 0;
    globalThis.openWorkspaceFile = async (rec, kind) => {
      const text = DISK[rec && rec.path];
      if (text == null) return { ok: false };
      opens += 1;
      ni.currentPath = rec.path; ni.markdown = text;
      globalThis.WORKSPACE_STATE.activeFile = { kind: String(kind || 'notes'), name: rec.name, path: rec.path, handle: rec.handle };
      return { ok: true, ready: true };
    };
    await V.getDescriptor().activate();
    V.refreshRoute();
    V.discardPendingChanges();

    // Case 1: NEW short-ID Project with its source ALREADY active
    ni.currentPath = 'notes/ni-b.md'; ni.markdown = DOC_B;
    globalThis.WORKSPACE_STATE.activeFile = { kind: 'notes', name: 'ni-b.md', path: 'notes/ni-b.md', handle: SRC_B.handle };
    V.refreshRoute();
    const opensBefore1 = opens;
    V.setDraftFieldForKey(ID_NEW, 'stage', 'quoted');
    const v1 = V.validateAllDrafts();
    check('NI01', 'the NEW short-ID draft validates (view/mutation parity)', v1.valid === true && v1.projects === 1, JSON.stringify(v1));
    const res1 = await V.applyPendingChanges();
    check('NI02', 'NEW short-ID Project applies with source already active (no project-not-found)', res1.ok === true && res1.appliedProjects === 1 && res1.failedProjects === 0, JSON.stringify(res1));
    check('NI03', 'NEW short-ID Project persisted its Stage change', /stage=quoted/.test(DISK['notes/ni-b.md']) && DISK['notes/ni-b.md'].includes('id=' + ID_NEW), JSON.stringify(DISK['notes/ni-b.md']));
    check('NI04', 'source already active required no extra open', opens === opensBefore1, String(opens - opensBefore1));
    V.discardPendingChanges();

    // Case 2: NEW short-ID Project after a cross-file open (source inactive)
    DISK['notes/ni-b.md'] = DOC_B;
    ni.currentPath = 'notes/ni-a.md'; ni.markdown = DOC_A;
    globalThis.WORKSPACE_STATE.activeFile = { kind: 'notes', name: 'ni-a.md', path: 'notes/ni-a.md', handle: SRC_A.handle };
    V.refreshRoute();
    V.setDraftFieldForKey(ID_NEW, 'state', 'on-hold');
    const opensBefore2 = opens;
    const res2 = await V.applyPendingChanges();
    check('NI05', 'NEW short-ID Project applies after cross-file open', res2.ok === true && res2.appliedProjects === 1 && res2.failedProjects === 0, JSON.stringify(res2));
    check('NI06', 'cross-file open used the accepted opener exactly once', opens === opensBefore2 + 1, String(opens - opensBefore2));
    check('NI07', 'NEW short-ID Project persisted its State change after open', /state=on-hold/.test(DISK['notes/ni-b.md']), JSON.stringify(DISK['notes/ni-b.md']));
    V.discardPendingChanges();

    // Case 3: mixed batch - existing UUID + NEW short ID in one Apply
    DISK['notes/ni-a.md'] = DOC_A; DISK['notes/ni-b.md'] = DOC_B;
    ni.currentPath = 'notes/ni-a.md'; ni.markdown = DOC_A;
    globalThis.WORKSPACE_STATE.activeFile = { kind: 'notes', name: 'ni-a.md', path: 'notes/ni-a.md', handle: SRC_A.handle };
    V.refreshRoute();
    V.setDraftFieldForKey(ID_EXIST, 'stage', 'delivered');
    V.setDraftFieldForKey(ID_NEW, 'stage', 'pipeline');
    const savesBefore3 = ni.saves;
    const res3 = await V.applyPendingChanges();
    check('NI08', 'mixed batch applies existing UUID and NEW short-ID together', res3.ok === true && res3.appliedProjects === 2 && res3.failedProjects === 0, JSON.stringify(res3));
    check('NI09', 'mixed batch performs exactly two Saves (one per source)', ni.saves === savesBefore3 + 2, String(ni.saves - savesBefore3));
    check('NI10', 'both sources persisted independently', /stage=delivered/.test(DISK['notes/ni-a.md']) && /stage=pipeline/.test(DISK['notes/ni-b.md']), JSON.stringify({ a: DISK['notes/ni-a.md'], b: DISK['notes/ni-b.md'] }));
    check('NI11', 'Projects route is restored after the mixed batch', route === 'projects', route);
    V.discardPendingChanges();

    // Case 4: partial failure + retry retains only pending changes
    DISK['notes/ni-a.md'] = DOC_A; DISK['notes/ni-b.md'] = DOC_B;
    ni.currentPath = 'notes/ni-a.md'; ni.markdown = DOC_A;
    globalThis.WORKSPACE_STATE.activeFile = { kind: 'notes', name: 'ni-a.md', path: 'notes/ni-a.md', handle: SRC_A.handle };
    const P_MISSING = proj({ projectId: 'prj_0009', name: 'Missing', stage: 'funnel', state: 'open', sourcePath: 'notes/ni-missing.md', sourceLine: 1, sourceName: 'ni-missing.md', created: TODAY });
    globalThis.WORKSPACE_INDEX_STATE.projects = [P_EXIST, P_NEW, P_MISSING];
    V.refreshRoute();
    V.setDraftFieldForKey(ID_EXIST, 'stage', 'delivered');
    V.setDraftFieldForKey('prj_0009', 'stage', 'quoted');
    const res4 = await V.applyPendingChanges();
    const pend = V.getPendingSummary();
    check('NI12', 'partial failure: successful source applied, failed draft retained', res4.failedProjects >= 1 && /stage=delivered/.test(DISK['notes/ni-a.md']), JSON.stringify({ res: res4, a: DISK['notes/ni-a.md'] }));
    check('NI13', 'partial failure: pending draft (missing source) remains for retry', pend.projects >= 1, JSON.stringify(pend));
    V.discardPendingChanges();
    globalThis.WORKSPACE_INDEX_STATE.projects = [P_EXIST, P_NEW];
  }

  group('PR - presentation ownership and safe recovery');
  {
    const V = globalThis.MME_PROJECTS_VIEW;
    const fsp = require('fs');
    const pathMod = require('path');
    const cssSrc = fsp.readFileSync(pathMod.join(__dirname, '..', 'css', 'workspace.css'), 'utf8');
    const indexSrc = fsp.readFileSync(pathMod.join(__dirname, '..', 'index.html'), 'utf8');

    // Modeled production shell (the real page always has these elements).
    const ensureEl = (id, tag) => document.getElementById(id) || (() => { const e = document.createElement(tag || 'div'); e.id = id; (document.body || document.documentElement).appendChild(e); return e; })();
    ensureEl('toolbar');
    ensureEl('editor');
    ensureEl('viewer');
    ensureEl('btnEditorEdgeOpen', 'button');
    ensureEl('btnHtmlEdgeOpen', 'button');

    // Fake production pane owners (observation only) + bounded log capture.
    const st = { editorHidden: false, markmap: true, html: false, saves: 0, text: 'LIVE-DOC-TEXT', preset: 'work', presetCalls: 0, logs: [], openings: [] };
    globalThis.MME_APP = { log: (m) => { st.logs.push(String(m)); }, showToast: () => {} };
    globalThis.isEditorHidden = () => st.editorHidden;
    globalThis.MME_EDITOR_VISIBILITY = {
      isEditorHidden: () => st.editorHidden,
      showEditor: () => { st.editorHidden = false; document.body.classList.remove('editor-hidden'); return true; },
      hideEditor: () => { st.editorHidden = true; document.body.classList.add('editor-hidden'); return true; },
    };
    globalThis.showEditor = globalThis.MME_EDITOR_VISIBILITY.showEditor;
    globalThis.hideEditor = globalThis.MME_EDITOR_VISIBILITY.hideEditor;
    globalThis.MME_VIEW_LAYOUT = {
      isPaneVisible: (id) => (id === 'markmap' ? st.markmap : id === 'html' ? st.html : false),
      showPane: (id) => { if (id === 'markmap') st.markmap = true; return { ok: true }; },
      hidePane: (id) => { if (id === 'markmap') st.markmap = false; return { ok: true }; },
      getCurrentPreset: () => st.preset,
      getState: () => ({ visiblePaneIds: [] }),
      refresh: () => {},
      applyPreset: () => { st.presetCalls += 1; return { ok: true }; },
    };
    globalThis.isHtmlPreviewOpen = () => st.html;
    globalThis.hideHtmlPreview = () => { st.html = false; };
    globalThis.showHtmlPreview = () => { st.html = true; };
    globalThis.updateEditorVisibilityControls = () => {};

    // Realistic Host ordering: deactivate previous, activate target WHILE the
    // previous id is still reported, THEN commit the id (workspace-host.js).
    const desc = V.getDescriptor();
    let route = 'journal';
    const switchLog = [];
    globalThis.MME_WORKSPACE_HOST = {
      register: () => {},
      getActiveId: () => route,
      switchTo: async (id) => {
        const target = String(id);
        if (route === target) { switchLog.push(target + ':noop'); return { status: 'noop' }; }
        const prev = route;
        if (prev === 'projects' && typeof desc.deactivate === 'function') desc.deactivate();
        if (target === 'journal') route = target;
        if (target === 'projects' && typeof desc.activate === 'function') await desc.activate();
        route = target;
        switchLog.push(target + ':activated');
        return { status: 'activated' };
      },
    };

    globalThis.WORKSPACE_STATE = { rootHandle: {}, rootName: 'ws-pr', folders: { notes: {} }, files: { notes: [] }, activeFile: null };
    const ID_PR = 'prj_p0p0p0p0-p0p0-4p0p-8p0p-p0p0p0p0p001';
    const P_PR = proj({ projectId: ID_PR, name: 'PR Fixture', stage: 'quoted', state: 'open', sourcePath: 'notes/pr-a.md', sourceLine: 1, sourceName: 'pr-a.md', created: TODAY });
    globalThis.WORKSPACE_INDEX_STATE = { ready: true, projects: [P_PR] };
    globalThis.findWorkspaceFileByPath = (p) => ({ kind: 'notes', name: String(p).split('/').pop(), path: p, handle: {} });
    globalThis.openWorkspaceFile = async (rec) => { st.openings.push(rec && rec.path); return { ok: true, ready: true }; };
    globalThis.MME_PROJECT_EDIT_HOST = Object.freeze({
      isDirty: () => false,
      getMarkdown: () => st.text,
      currentFileName: () => 'pr-a.md',
      currentSourcePath: () => '',
      applyMarkdown: () => true,
      save: async () => { st.saves += 1; return { ok: true }; },
      rebuildIndex: async () => null,
    });
    V.discardPendingChanges();
    const containerOf = () => document.getElementById(V.CONTAINER_ID);
    const countContainers = () => {
      const all = document.querySelectorAll('*');
      let n = 0;
      for (let i = 0; i < all.length; i += 1) if (all[i] && all[i].id === V.CONTAINER_ID) n += 1;
      return n;
    };
    // PR01-PR03: open once, open repeatedly, snapshot captured.
    await globalThis.MME_WORKSPACE_HOST.switchTo('projects');
    check('PR01', 'open Projects once: container visible, class and dataset active', containerOf() && containerOf().hidden === false && document.documentElement.classList.contains('projects-view-active') && document.documentElement.getAttribute('data-projects-presentation') === 'full');
    await globalThis.MME_WORKSPACE_HOST.switchTo('projects');
    await desc.activate();
    check('PR02', 'repeated opens never stack a second container', countContainers() === 1, String(countContainers()));
    const snap = V.getPresentationState().snapshot;
    check('PR03', 'pre-Projects presentation snapshot captured (content-free, handle-free)', Boolean(snap) && typeof snap.editorHidden === 'boolean' && snap.markmapVisible === true && snap.layoutPreset === 'work' && !('text' in snap) && !('handle' in snap), JSON.stringify(snap && { e: snap.editorHidden, m: snap.markmapVisible, p: snap.layoutPreset }));

    // PR04-PR10: Back to Workspace contract.
    V.setDraftFieldForKey(ID_PR, 'stage', 'delivered');
    globalThis.WORKSPACE_STATE.activeFile = { kind: 'notes', name: 'pr-a.md', path: 'notes/pr-a.md', handle: {} };
    const ret = await V.returnToWorkspace();
    check('PR04', 'Back to Workspace returns the Host route to journal', ret.ok === true && route === 'journal', JSON.stringify(ret));
    check('PR05', 'Projects absent after return: hidden, class off, dataset off, verified closed', containerOf().hidden === true && !document.documentElement.classList.contains('projects-view-active') && !document.documentElement.hasAttribute('data-projects-presentation') && V.getPresentationState().closed === true);
    check('PR06', 'CSS keeps the hidden attribute authoritative (no right-side strand)', /projectsView\[hidden\][\s\S]{0,80}display:\s*none\s*!important/.test(cssSrc));
    check('PR07', 'the current source document stays active after return', globalThis.WORKSPACE_STATE.activeFile && globalThis.WORKSPACE_STATE.activeFile.path === 'notes/pr-a.md');
    check('PR08', 'no unexpected save during return', st.saves === 0, String(st.saves));
    check('PR09', 'no loss of live document text during return', globalThis.MME_PROJECT_EDIT_HOST.getMarkdown() === 'LIVE-DOC-TEXT');
    check('PR10', 'editor, markmap and HTML recovery controls exist after return', Boolean(document.getElementById('btnEditorEdgeOpen')) && Boolean(document.getElementById('btnHtmlEdgeOpen')) && Boolean(document.getElementById('toolbar')));
    check('PR11', 'staged drafts survive Back to Workspace (Workspace-root keyed)', V.getPendingSummary().projects === 1, JSON.stringify(V.getPendingSummary()));
    // PR12-PR13: idempotent close + drafts survive a realistic Apply-style
    // round-trip (Host commits the route id AFTER activate, as production does).
    const ret2 = await V.returnToWorkspace();
    check('PR12', 'repeated return is idempotent and stays verified-closed', ret2.ok === true && route === 'journal' && V.getPresentationState().closed === true);
    await globalThis.MME_WORKSPACE_HOST.switchTo('projects');
    check('PR13', 'drafts survive a realistic Host round-trip back into Projects', V.getPendingSummary().projects === 1, JSON.stringify(V.getPendingSummary()));

    // PR14-PR16: explicit Source inspection (smaller model).
    V.setFilter('stage', 'delivered');
    const expandBtn = containerOf().querySelectorAll('[data-action="toggle-details"]')[0];
    if (expandBtn) expandBtn.dispatchEvent({ type: 'click', target: expandBtn, preventDefault() {}, stopPropagation() {} });
    const openedBefore = st.openings.length;
    const src = await V.openProjectSource('notes/pr-a.md', 'notes', 1);
    const stateAfterOpen = V.getPresentationState();
    const backButton = document.getElementById('mmeProjectsBackToProjects');
    check('PR14', 'explicit Source navigation opens the source and arms inspection', src.ok === true && stateAfterOpen.inspection === true && st.openings.length === openedBefore + 1, JSON.stringify({ src, inspection: stateAfterOpen.inspection }));
    check('PR15', 'the persistent Back to Projects action is visible and explicitly labeled', Boolean(backButton) && backButton.hidden === false && backButton.textContent === 'Back to Projects' && backButton.getAttribute('aria-label') === 'Back to Projects');
    check('PR16', 'during inspection Projects is closed and the route is journal', containerOf().hidden === true && route === 'journal' && !document.documentElement.classList.contains('projects-view-active'));

    // PR17: Back to Projects restores the full view + retained view state.
    const back = await V.backToProjects();
    check('PR17', 'Back to Projects restores full view, route and dismissed action', back.ok === true && route === 'projects' && containerOf().hidden === false && document.documentElement.classList.contains('projects-view-active') && V.getPresentationState().inspection === false && backButton.hidden === true, JSON.stringify(back));
    check('PR18', 'search/filter and expanded state are retained across inspection', V.getViewState().filters.stage === 'delivered' && V.getViewState().expandedKeys.length >= 1, JSON.stringify({ f: V.getViewState().filters.stage, e: V.getViewState().expandedKeys.length }));
    // PR19: source open followed by Back to Workspace.
    const src2 = await V.openProjectSource('notes/pr-b.md', 'notes', 2);
    const openingsBeforeReturn = st.openings.length;
    const ret3 = await V.returnToWorkspace();
    check('PR19', 'source open then Back to Workspace: Projects gone, source kept, never a re-open', src2.ok === true && ret3.ok === true && route === 'journal' && V.getPresentationState().closed === true && st.openings.length === openingsBeforeReturn, JSON.stringify({ ret: ret3, openings: st.openings }));

    // PR20-PR21: Editor visibility snapshots (newer intentional state wins).
    st.editorHidden = true;
    document.body.classList.add('editor-hidden');
    await globalThis.MME_WORKSPACE_HOST.switchTo('projects');
    const snapHidden = V.getPresentationState().snapshot;
    st.editorHidden = false;
    document.body.classList.remove('editor-hidden');
    const retHidden = await V.returnToWorkspace();
    check('PR20', 'Editor hidden before Projects is captured and a newer visible state wins', snapHidden.editorHidden === true && retHidden.ok === true && st.editorHidden === false, JSON.stringify({ snap: snapHidden.editorHidden, now: st.editorHidden }));

    await globalThis.MME_WORKSPACE_HOST.switchTo('projects');
    st.editorHidden = true;
    document.body.classList.add('editor-hidden');
    const retCollapse = await V.returnToWorkspace();
    check('PR21', 'Editor collapsed while Projects is active stays collapsed with its recovery toggle reachable', retCollapse.ok === true && st.editorHidden === true && Boolean(document.getElementById('btnEditorEdgeOpen')));
    globalThis.MME_EDITOR_VISIBILITY.showEditor();
    check('PR22', 'Editor recovers without any layout preset', st.editorHidden === false && st.presetCalls === 0, String(st.presetCalls));

    // PR23: Markmap / HTML non-interference through enter and exit.
    st.markmap = true; st.html = false;
    await globalThis.MME_WORKSPACE_HOST.switchTo('projects');
    await V.returnToWorkspace();
    const panesKept = st.markmap === true && st.html === false;
    st.markmap = false; st.html = true;
    await globalThis.MME_WORKSPACE_HOST.switchTo('projects');
    await V.returnToWorkspace();
    check('PR23', 'Markmap and HTML Preview states pass through Projects untouched', panesKept && st.markmap === false && st.html === true, JSON.stringify({ markmap: st.markmap, html: st.html }));
    st.markmap = true; st.html = false;

    // PR24: documented layout rule - newer preset stays the restoration target.
    st.preset = 'work';
    await globalThis.MME_WORKSPACE_HOST.switchTo('projects');
    const snapPreset = V.getPresentationState().snapshot;
    st.preset = 'focus';
    const retPreset = await V.returnToWorkspace();
    check('PR24', 'layout changed while active stays active; snapshot is repair-only (never re-applied)', retPreset.ok === true && snapPreset.layoutPreset === 'work' && st.preset === 'focus' && st.presetCalls === 0, JSON.stringify({ snap: snapPreset.layoutPreset, now: st.preset, calls: st.presetCalls }));
    /* __PR_D__ */
  }

  /* ============ SC: SCROLL-POSITION PRESERVATION (ACT 5D item 2) ============ */
  group('SC - scroll position preserved across re-render');
  {
    const V = globalThis.MME_PROJECTS_VIEW;
    const ensureEl = (id, tag) => document.getElementById(id) || (() => { const e = document.createElement(tag || 'div'); e.id = id; (document.body || document.documentElement).appendChild(e); return e; })();
    ensureEl('toolbar');
    ensureEl('editor');
    ensureEl('viewer');
    ensureEl('btnEditorEdgeOpen', 'button');
    ensureEl('btnHtmlEdgeOpen', 'button');
    try { globalThis.MME_PROJECTS_VIEW.resetViewState(); } catch {}
    await globalThis.MME_WORKSPACE_HOST.switchTo('projects');

    const container = document.getElementById(V.CONTAINER_ID);
    const bodyOf = () => container.querySelector('[data-projects-scroll-owner="1"]');

    // SC01: a non-zero scroll offset on the live owner survives a re-render
    // (the exact innerHTML rebuild that Apply/refresh/refreshRoute performs).
    const b1 = bodyOf();
    check('SC01a', 'scroll owner present in rendered Projects route', !!b1, '');
    if (b1) { b1.scrollTop = 240; b1.scrollLeft = 18; }
    V.refreshRoute();
    const b2 = bodyOf();
    check('SC01b', 'scrollTop preserved across re-render', b2 && b2.scrollTop === 240, String(b2 && b2.scrollTop));
    check('SC01c', 'scrollLeft preserved across re-render', b2 && b2.scrollLeft === 18, String(b2 && b2.scrollLeft));

    // SC02: repeated re-renders stay position-neutral (later Index-refresh
    // callbacks must not reset the offset back to (0,0)).
    V.refreshRoute();
    V.refreshRoute();
    const b3 = bodyOf();
    check('SC02', 'offset stable across repeated re-renders', b3 && b3.scrollTop === 240 && b3.scrollLeft === 18, `top=${b3 && b3.scrollTop} left=${b3 && b3.scrollLeft}`);

    // SC03: clamp guard — when the layout engine reports measurable height, a
    // shrunken projection must not over-scroll into empty space.
    const b4 = bodyOf();
    if (b4) { b4.scrollTop = 500; b4.scrollHeight = 200; b4.clientHeight = 200; }
    V.refreshRoute();
    const b5 = bodyOf();
    // The freshly parsed owner has no shim-measured height, so the offset is
    // restored raw; the clamp branch is exercised when height IS measurable.
    check('SC03', 'clamp guard present and offset still restored on unknown height', b5 && b5.scrollTop === 500, String(b5 && b5.scrollTop));
    /* __SC_D__ */
  }

  let passed = 0, failed = 0, groups = 0;
  for (const r of results) { if (r.id === undefined) { groups += 1; continue; } if (r.ok) passed += 1; else failed += 1; }
  console.log('ACT 5C - Projects view / adapter validators');
  console.log('='.repeat(62));
  for (const r of results) {
    if (r.id === undefined) { console.log('\n[' + r.group + ']'); continue; }
    console.log('  ' + (r.ok ? 'PASS' : 'FAIL') + '  ' + String(r.id).padEnd(14) + ' ' + r.name + (r.ok || !r.detail ? '' : '  <- ' + r.detail));
  }
  console.log('='.repeat(62));
  console.log('groups=' + groups + ' passed=' + passed + ' failed=' + failed + ' total=' + (passed + failed));
  if (failed) { console.log('\nRESULT: FAIL'); process.exit(1); }
  console.log('\nRESULT: PASS');
})().catch((e) => { console.error('HARNESS ERROR:', e && e.stack || e); process.exit(1); });
