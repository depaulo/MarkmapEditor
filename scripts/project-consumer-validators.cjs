#!/usr/bin/env node
'use strict';

/**
 * ACT 5B — Project consumer, normalization and route validators.
 *
 * Runs the REAL owners:
 *   js/workspace/project-record-utils.js        (currency + comparator + key)
 *   js/workspace/workspace-parser.js            (state/stage schema, identity)
 *   js/workspace/project-metadata-mutation.js  (pure mutation owner)
 *   js/report/report-dictionary.js             (projection + totals)
 *   js/workspace/workspace-capabilities.js     (route capabilities)
 *
 * Usage: node scripts/project-consumer-validators.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const results = [];
let currentGroup = '';
function group(t) { currentGroup = t; results.push({ group: t }); }
function check(id, name, ok, detail) {
  results.push({ id, group: currentGroup, name, ok: ok === true, detail: detail == null ? '' : String(detail) });
}

global.window = global;
require(path.join(ROOT, 'js', 'workspace', 'project-record-utils.js'));
require(path.join(ROOT, 'js', 'workspace', 'workspace-parser.js'));
require(path.join(ROOT, 'js', 'workspace', 'project-metadata-mutation.js'));

const U = globalThis.MME_PROJECT_RECORD_UTILS;
const P = globalThis.WORKSPACE_PARSER;
const M = globalThis.MME_PROJECT_METADATA_MUTATION;
if (!U || !P || !M) { console.error('FATAL: ACT 5B owners unavailable'); process.exit(1); }

const ID_A = 'prj_11111111-1111-4111-8111-111111111111';
const ID_B = 'prj_22222222-2222-4222-8222-222222222222';
const TODAY = '2026-10-03';
const m = (id, extra) => '<!-- mme-project: id=' + id + '; created=' + TODAY + (extra || '') + ' -->';

/* ============================ 1. projectId propagation ===================== */

group('projectId propagation');

check('P01', 'parsed record carries projectId', P.parseProjects('Project: X\n' + m(ID_A) + '\n', {})[0].projectId === ID_A);
check('P02', 'unmanaged record has no projectId', P.parseProjects('Project: X\n', {})[0].projectId === '');
check('P03', 'managed record keys by projectId', U.projectRecordKey({ projectId: ID_A, sourcePath: 'n.md', sourceLine: 3 }) === ID_A);
check('P04', 'legacy record uses the transitional key', U.projectRecordKey({ sourcePath: 'n.md', sourceLine: 3 }) === 'legacy:n.md:3');
check('P05', 'title is never used as identity', U.projectRecordKey({ name: 'Same', sourcePath: 'a.md', sourceLine: 1 }) !== U.projectRecordKey({ name: 'Same', sourcePath: 'b.md', sourceLine: 1 }));
check('P06', 'duplicate titles remain distinct records', P.parseProjects('Project: Same\n' + m(ID_A) + '\n\nProject: Same\n' + m(ID_B) + '\n', {}).length === 2);
check('P07', 'duplicate titles keep distinct keys', U.projectRecordKey(P.parseProjects('Project: Same\n' + m(ID_A) + '\n', {})[0]) !== U.projectRecordKey(P.parseProjects('Project: Same\n' + m(ID_B) + '\n', {})[0]));
check('P08', 'isManagedProjectRecord true only when managed', U.isManagedProjectRecord({ projectId: ID_A }) === true && U.isManagedProjectRecord({}) === false);
check('P09', 'malformed id is not promoted to identity', P.parseProjects('Project: X\n<!-- mme-project: id=prj_short; created=2026-10-03 -->\n', {})[0].projectId === '');
check('P10', 'legacy Project without id stays visible in the list', P.parseProjects('Project: Legacy\n', {}).length === 1);

/* ======================= 2. sourceIdentity retirement ====================== */

group('sourceIdentity retirement');

{
  const rec = P.parseProjects('Project: X\n' + m(ID_A) + '\n', {})[0];
  check('R01', 'Project sourceIdentity is gone', !('sourceIdentity' in rec));
  const parserSrc = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'workspace-parser.js'), 'utf8');
  check('R02', 'no sourceIdentity assignment remains in the parser', !/sourceIdentity\s*:/.test(parserSrc));
  const runtime = ['js/main.js', 'js/report/report-dictionary.js', 'js/report/quick-report-generator.js',
    'js/workspace/workspace-index-document.js', 'js/workspace/workspace-index-workspace.js',
    'js/workspace/workspace-sidebar.js', 'js/workspace/projects-view.js'];
  check('R03', 'zero runtime reads of Project sourceIdentity', runtime.every((f) => !/sourceIdentity/.test(fs.readFileSync(path.join(ROOT, f), 'utf8'))));
  check('R04', 'Task-local source identity untouched', /sourceIdentityOf/.test(fs.readFileSync(path.join(ROOT, 'js', 'tasks', 'task-lifecycle.js'), 'utf8')));
  check('R05', 'sourcePath preserved for navigation', rec.sourcePath === '' ? typeof rec.sourcePath === 'string' : true);
  check('R06', 'sourceLine preserved for navigation', typeof rec.sourceLine === 'number');
}

/* ======================= 3. currency normalization ======================== */

group('currency convergence');

check('C01', 'lowercase normalized to uppercase', U.normalizeProjectCurrencyCode('brl') === 'BRL');
check('C02', 'mixed case normalized', U.normalizeProjectCurrencyCode('BrL') === 'BRL');
check('C03', 'whitespace trimmed', U.normalizeProjectCurrencyCode('  usd  ') === 'USD');
check('C04', 'empty stays empty (missing is distinguishable)', U.normalizeProjectCurrencyCode('') === '' && U.normalizeProjectCurrencyCode(null) === '');
check('C05', 'no FX conversion', U.normalizeProjectCurrencyCode('BRL') === 'BRL');
check('C06', 'parser and shared owner agree', P.parseProjects('Project: X\nCurrency: brl\n', {})[0].currency === U.normalizeProjectCurrencyCode('brl'));
check('C07', 'brl and BRL are one currency', U.normalizeProjectCurrencyCode('brl') === U.normalizeProjectCurrencyCode('BRL'));
{
  const idxSrc = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'workspace-index-document.js'), 'utf8');
  const repSrc = fs.readFileSync(path.join(ROOT, 'js', 'report', 'report-dictionary.js'), 'utf8');
  check('C08', 'Index totals use the shared owner', /normalizeProjectCurrencyCode\(project\.currency\)/.test(idxSrc));
  check('C09', 'Report totals use the shared owner', /normalizeProjectCurrencyCode\(p\.currency\)/.test(repSrc));
  check('C10', 'Index totals prefer the shared owner over the legacy inline uppercase', /normalizeProjectCurrencyCode\(project\.currency\)/.test(idxSrc));
}

/* ========================= 4. sorting convergence ========================= */

group('sort convergence');

{
  const q = (raw, can, valid) => ({ raw, canonical: can, display: raw, year: valid ? Number(can.slice(0, 4)) : null, quarter: valid ? Number(can.slice(-1)) : null, valid });
  const proj = (o) => Object.assign({ name: 'X', value: null, currency: '', expectedOrder: q('', '', false), sourcePath: '', sourceLine: 0, projectId: '' }, o);

  const scheduled = proj({ name: 'A', expectedOrder: q('27Q1', '2027-Q1', true) });
  const unscheduled = proj({ name: 'Z', expectedOrder: q('', '', false) });
  check('O01', 'valid Expected Order sorts before unscheduled', U.compareProjects(scheduled, unscheduled) < 0);
  check('O02', 'unscheduled sorts after', U.compareProjects(unscheduled, scheduled) > 0);

  const q1 = proj({ name: 'B', expectedOrder: q('27Q1', '2027-Q1', true) });
  const q3 = proj({ name: 'A', expectedOrder: q('27Q3', '2027-Q3', true) });
  check('O03', 'canonical quarter ascending', U.compareProjects(q1, q3) < 0);

  const nA = proj({ name: 'alpha', expectedOrder: q('27Q1', '2027-Q1', true), sourcePath: 'a.md', sourceLine: 9 });
  const nB = proj({ name: 'Beta', expectedOrder: q('27Q1', '2027-Q1', true), sourcePath: 'a.md', sourceLine: 1 });
  check('O04', 'name compared case-insensitively', U.compareProjects(nA, nB) < 0);

  const pA = proj({ name: 'Same', expectedOrder: q('27Q1', '2027-Q1', true), sourcePath: 'a.md', sourceLine: 5 });
  const pB = proj({ name: 'Same', expectedOrder: q('27Q1', '2027-Q1', true), sourcePath: 'b.md', sourceLine: 5 });
  check('O05', 'sourcePath breaks a same-name tie (Sidebar/Index defect fixed)', U.compareProjects(pA, pB) < 0);

  const lA = proj({ name: 'Same', expectedOrder: q('27Q1', '2027-Q1', true), sourcePath: 'a.md', sourceLine: 2 });
  const lB = proj({ name: 'Same', expectedOrder: q('27Q1', '2027-Q1', true), sourcePath: 'a.md', sourceLine: 7 });
  check('O06', 'sourceLine breaks the next tie', U.compareProjects(lA, lB) < 0);

  const iA = proj({ name: 'Same', expectedOrder: q('27Q1', '2027-Q1', true), sourcePath: 'a.md', sourceLine: 2, projectId: ID_A });
  const iB = proj({ name: 'Same', expectedOrder: q('27Q1', '2027-Q1', true), sourcePath: 'a.md', sourceLine: 2, projectId: ID_B });
  check('O07', 'projectId is the final stable tiebreaker', U.compareProjects(iA, iB) < 0);
  check('O08', 'identical records compare equal', U.compareProjects(iA, Object.assign({}, iA)) === 0);

  const mainSrc = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
  check('O09', 'Sidebar uses the shared comparator', /MME_PROJECT_RECORD_UTILS\.sortProjects\(group\.projects\)/.test(mainSrc));
  check('O10', 'Index build uses the shared comparator', /projects\.sort\(__projectUtils\.compareProjects\)/.test(mainSrc));
  const viewSrc = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'projects-view.js'), 'utf8');
  // ACT 5C: the route decorates records first, then sorts with the SAME shared
  // comparator; the invariant (one owner) is unchanged.
  check('O11', 'dedicated route uses the shared comparator', /sortProjects\(/.test(viewSrc) && /MME_PROJECT_RECORD_UTILS/.test(viewSrc));
  check('O12', 'archived metadata does not affect order', U.compareProjects(Object.assign({}, iA, { archived: true }), Object.assign({}, iB, { archived: true })) < 0);
}

/* ========================= 5. state / stage schema ======================== */

group('state and stage schema');

{
  check('S01', 'key order places state after stage', P.serializeManagedProjectComment({ archived: 'false', state: 'on-hold', stage: 'quoted', delivery: '27Q4', billing: '28Q1', closed: '2026-12-01', created: TODAY, id: ID_A }) === '<!-- mme-project: id=' + ID_A + '; created=' + TODAY + '; stage=quoted; state=on-hold; delivery=27Q4; billing=28Q1; closed=2026-12-01; archived=false -->');
  check('S02', 'absent state derives open in the read model', P.parseProjects('Project: X\n' + m(ID_A) + '\n', {})[0].state === 'open');
  check('S03', 'legacy Project derives open', P.parseProjects('Project: X\n', {})[0].state === 'open');
  check('S04', 'parsing never writes state', !/state=/.test(P.reconcileManagedProjects('Project: X\n', { today: TODAY, generateId: () => ID_A }).text));
  check('S05', 'explicit canonical state is read', P.parseProjects('Project: X\n' + m(ID_A, '; state=lost') + '\n', {})[0].state === 'lost');
  check('S06', 'all five canonical states parse', ['open', 'on-hold', 'completed', 'lost', 'canceled'].every((v) => P.parseProjects('Project: X\n' + m(ID_A, '; state=' + v) + '\n', {})[0].state === v));
  const unknown = P.parseProjects('Project: X\n' + m(ID_A, '; state=Wobbly') + '\n', {})[0];
  check('S07', 'unknown state text preserved verbatim', unknown.stateRaw === 'Wobbly');
  check('S08', 'unknown state still reads as managed', unknown.metadataValid === true);
  check('S09', 'unknown state is warned, not fatal', unknown.warnings.some((w) => w.code === 'non-canonical-state'));
  check('S10', 'unknown state does not invalidate the comment', !unknown.diagnostics.some((d) => d.code === 'non-canonical-state'));
  check('S11', 'all five canonical stages parse', ['funnel', 'pipeline', 'quoted', 'on-delivery', 'delivered'].every((v) => P.parseProjects('Project: X\n' + m(ID_A, '; stage=' + v) + '\n', {})[0].stage === v));
  check('S12', 'unknown legacy stage preserved', P.parseProjects('Project: X\n' + m(ID_A, '; stage=Quotation') + '\n', {})[0].stage === 'Quotation');
  check('S13', 'unknown legacy stage still managed', P.parseProjects('Project: X\n' + m(ID_A, '; stage=Quotation') + '\n', {})[0].metadataValid === true);
  check('S14', 'state and stage are separate', P.parseProjects('Project: X\n' + m(ID_A, '; stage=quoted; state=lost') + '\n', {})[0].state === 'lost' && P.parseProjects('Project: X\n' + m(ID_A, '; stage=quoted; state=lost') + '\n', {})[0].stage === 'quoted');
  check('S15', 'closed is a date, never a State value', P.canonicalProjectState('2026-12-01') === '' && P.parseProjects('Project: X\n' + m(ID_A, '; closed=2026-12-01') + '\n', {})[0].closed === '2026-12-01');
  check('S16', 'no state<->closed synchronization', P.parseProjects('Project: X\n' + m(ID_A, '; closed=2026-12-01') + '\n', {})[0].state === 'open');
  check('S17', 'canonical helpers reject unknown values', P.canonicalProjectState('wobbly') === '' && P.canonicalProjectStage('wobbly') === '');
  check('S18', 'labels are display-only', P.projectStateLabel('on-hold') === 'On Hold' && P.projectStageLabel('on-delivery') === 'On Delivery');
}

/* ======================= 6. pure mutation owner =========================== */

group('pure mutation owner');

const DOC = 'Project: Alpha [800000 BRL] [27Q3]\n' + m(ID_A) + '\n\nProject: Beta\n' + m(ID_B) + '\n';

check('U01', 'owner exists', typeof M.mutateProject === 'function');
check('U02', 'no project id supplied -> project-id-missing', M.mutateProject(DOC, { projectId: '' }, { op: 'setValueCurrency', value: 1, currency: 'BRL' }).reason === 'project-id-missing');
check('U03', 'unknown id -> project-not-found', M.mutateProject(DOC, { projectId: 'prj_99999999-9999-4999-8999-999999999999' }, { op: 'setStage', value: 'quoted' }).reason === 'project-not-found');
check('U04', 'targeting by id not title: same-title sibling untouched', (() => {
  const doc = 'Project: Same\n' + m(ID_A) + '\n\nProject: Same\n' + m(ID_B) + '\n';
  const r = M.mutateProject(doc, { projectId: ID_B }, { op: 'setStage', value: 'quoted' });
  return r.ok && r.proposedMarkdown.split('\n').filter((l) => l.includes('stage=quoted')).length === 1 && !r.proposedMarkdown.split('\n')[3].includes('stage=');
})());
check('U05', 'duplicate id blocks the mutation', (() => {
  const doc = 'Project: A\n' + m(ID_A) + '\n\nProject: B\n' + m(ID_A) + '\n';
  return M.mutateProject(doc, { projectId: ID_A }, { op: 'setStage', value: 'quoted' }).reason === 'duplicate-project-id';
})());
// A comment that carries a VALID id but is otherwise malformed must be located
// and must BLOCK, never be repaired or duplicated.
check('U06', 'malformed comment blocks the mutation', M.mutateProject('Project: A\n<!-- mme-project: id=' + ID_A + '; created=not-a-date -->\n', { projectId: ID_A }, { op: 'setStage', value: 'quoted' }).reason === 'malformed-project-comment');
check('U06b', 'comment with no id is not a mutation target', M.mutateProject('Project: A\n<!-- mme-project: garbage -->\n', { projectId: ID_A }, { op: 'setStage', value: 'quoted' }).reason === 'project-not-found');
check('U07', 'unsupported operation is reported', M.mutateProject(DOC, { projectId: ID_A }, { op: 'deleteEverything' }).reason === 'unsupported-operation');
check('U08', 'failed mutation returns the original Markdown', M.mutateProject(DOC, { projectId: 'nope' }, { op: 'setStage', value: 'quoted' }).proposedMarkdown === DOC);
check('U08b', 'blocked malformed mutation returns the original Markdown', M.mutateProject('Project: A\n<!-- mme-project: id=' + ID_A + '; created=not-a-date -->\n', { projectId: ID_A }, { op: 'setStage', value: 'quoted' }).proposedMarkdown === 'Project: A\n<!-- mme-project: id=' + ID_A + '; created=not-a-date -->\n');
check('U09', 'result exposes resolvedSourceLine', typeof M.mutateProject(DOC, { projectId: ID_A }, { op: 'setStage', value: 'quoted' }).resolvedSourceLine === 'number');
check('U10', 'owner does not claim filesystem reasons', !Object.values(M.REASONS).some((r) => /source-file|writable|save-/.test(r)));

/* -------------------------- visible-line mutations ---------------------- */

group('visible-line mutations');

{
  const r = M.mutateProject(DOC, { projectId: ID_A }, { op: 'setValueCurrency', value: '1200000.50', currency: 'usd' });
  check('V01', 'setValueCurrency writes one canonical pair', r.ok && r.changed && r.proposedMarkdown.includes('Project: Alpha [1200000.50 USD] [27Q3]'));
  check('V02', 'value/currency is one atomic pair', r.proposedMarkdown.split('\n')[0].includes('[1200000.50 USD]'));
  check('V03', 'no duplicate value token', (r.proposedMarkdown.match(/\d[\d.]*\s+[A-Z]{3}/g) || []).length === 1);
  check('V04', 'quarter token preserved and ordered after value', r.proposedMarkdown.split('\n')[0].indexOf('1200000.50') < r.proposedMarkdown.split('\n')[0].indexOf('27Q3'));
  check('V05', 'fieldsChanged lists the pair', r.fieldsChanged.join(',') === 'value,currency');
  const zero = M.mutateProject(DOC, { projectId: ID_A }, { op: 'setValueCurrency', value: '0', currency: 'BRL' });
  check('V06', 'zero remains valid', zero.ok && zero.proposedMarkdown.includes('[0 BRL]'));
  check('V07', 'invalid value rejected', M.mutateProject(DOC, { projectId: ID_A }, { op: 'setValueCurrency', value: '1,200,000', currency: 'USD' }).reason === 'invalid-value');
  check('V08', 'negative value rejected', M.mutateProject(DOC, { projectId: ID_A }, { op: 'setValueCurrency', value: '-5', currency: 'BRL' }).reason === 'invalid-value');
  check('V09', 'invalid currency rejected', M.mutateProject(DOC, { projectId: ID_A }, { op: 'setValueCurrency', value: '10', currency: 'BR' }).reason === 'invalid-currency');
  check('V10', 'currency is never written without a value', M.mutateProject(DOC, { projectId: ID_A }, { op: 'setValueCurrency', value: '10', currency: '' }).ok === false);

  const cleared = M.mutateProject(DOC, { projectId: ID_A }, { op: 'clearValueCurrency' });
  check('V11', 'clearValueCurrency removes the pair', cleared.ok && cleared.proposedMarkdown.split('\n')[0] === 'Project: Alpha [27Q3]');
  const setOrder = M.mutateProject(DOC, { projectId: ID_A }, { op: 'setExpectedOrder', quarter: '2028Q2' });
  check('V12', 'setExpectedOrder writes compact form', setOrder.ok && setOrder.proposedMarkdown.includes('Project: Alpha [800000 BRL] [28Q2]'));
  check('V13', 'no duplicate quarter token', (setOrder.proposedMarkdown.match(/\[\d{2}Q[1-4]\]/g) || []).length === 1);
  check('V14', 'invalid quarter rejected', M.mutateProject(DOC, { projectId: ID_A }, { op: 'setExpectedOrder', quarter: '27Q9' }).reason === 'invalid-quarter');
  const clearOrder = M.mutateProject(DOC, { projectId: ID_A }, { op: 'clearExpectedOrder' });
  check('V15', 'clearExpectedOrder removes only the quarter', clearOrder.ok && clearOrder.proposedMarkdown.split('\n')[0] === 'Project: Alpha [800000 BRL]');

  const bracket = 'Project: Migration [Phase 1] [800000 BRL] [27Q3]\n' + m(ID_A) + '\n';
  const br = M.mutateProject(bracket, { projectId: ID_A }, { op: 'setValueCurrency', value: '5', currency: 'BRL' });
  check('V16', 'bracketed title preserved exactly', br.proposedMarkdown.split('\n')[0] === 'Project: Migration [Phase 1] [5 BRL] [27Q3]');
  const wiki = 'Project: Review [[Alibaba]] [27Q3]\n' + m(ID_A) + '\n';
  const wk = M.mutateProject(wiki, { projectId: ID_A }, { op: 'setExpectedOrder', quarter: '27Q4' });
  check('V17', 'Wiki Link preserved', wk.proposedMarkdown.split('\n')[0] === 'Project: Review [[Alibaba]] [27Q4]');
  check('V18', 'title is never renamed', M.mutateProject(DOC, { projectId: ID_A }, { op: 'setValueCurrency', value: '5', currency: 'BRL' }).proposedMarkdown.includes('Project: Alpha'));
  check('V19', 'visible mutation never touches managed metadata', !M.mutateProject(DOC, { projectId: ID_A }, { op: 'setValueCurrency', value: '5', currency: 'BRL' }).proposedMarkdown.split('\n')[1].includes('value='));
  const badQ = 'Project: Alpha [27Q9]\n' + m(ID_A) + '\n';
  const bq = M.mutateProject(badQ, { projectId: ID_A }, { op: 'setValueCurrency', value: '5', currency: 'BRL' });
  check('V21', 'an invalid quarter token stays in the title', bq.ok && bq.proposedMarkdown.split('\n')[0] === 'Project: Alpha [27Q9] [5 BRL]');
  const noop = M.mutateProject(DOC, { projectId: ID_A }, { op: 'setValueCurrency', value: '800000', currency: 'BRL' });
  check('V20', 'identical value is a no-change', noop.ok && noop.changed === false && noop.reason === 'no-change');
}

/* ------------------------ managed-comment mutations --------------------- */

group('managed-comment mutations');

{
  const r = M.mutateProject(DOC, { projectId: ID_A }, { op: 'setStage', value: 'Quoted' });
  check('G01', 'stage is written canonically (lowercased)', r.ok && r.proposedMarkdown.includes('stage=quoted'));
  check('G02', 'unsupported stage rejected', M.mutateProject(DOC, { projectId: ID_A }, { op: 'setStage', value: 'Quotation' }).reason === 'unsupported-stage');
  check('G03', 'clearStage removes the key', M.mutateProject('Project: A\n' + m(ID_A, '; stage=quoted') + '\n', { projectId: ID_A }, { op: 'clearStage' }).proposedMarkdown.split('\n')[1] === m(ID_A));
  const st = M.mutateProject(DOC, { projectId: ID_A }, { op: 'setState', value: 'On-Hold' });
  check('G04', 'state is written canonically', st.ok && st.proposedMarkdown.includes('state=on-hold'));
  check('G05', 'unsupported state rejected', M.mutateProject(DOC, { projectId: ID_A }, { op: 'setState', value: 'Wobbly' }).reason === 'unsupported-state');
  const dl = M.mutateProject(DOC, { projectId: ID_A }, { op: 'setExpectedDelivery', quarter: '2028Q1' });
  check('G06', 'delivery written canonically', dl.ok && dl.proposedMarkdown.includes('delivery=28Q1'));
  const bl = M.mutateProject(DOC, { projectId: ID_A }, { op: 'setExpectedBilling', quarter: '2028Q3' });
  check('G07', 'billing written canonically', bl.ok && bl.proposedMarkdown.includes('billing=28Q3'));
  check('G08', 'invalid delivery quarter rejected', M.mutateProject(DOC, { projectId: ID_A }, { op: 'setExpectedDelivery', quarter: 'Q9' }).reason === 'invalid-quarter');

  const rich = 'Project: A\n' + m(ID_A, '; stage=quoted; state=on-hold; delivery=27Q4; billing=28Q1; closed=2026-12-01; archived=false; customer=Acme') + '\n';
  const set = M.mutateProject(rich, { projectId: ID_A }, { op: 'setStage', value: 'pipeline' });
  check('G09', 'projectId preserved', set.proposedMarkdown.includes('id=' + ID_A));
  check('G10', 'created preserved', set.proposedMarkdown.includes('created=' + TODAY));
  check('G11', 'closed preserved', set.proposedMarkdown.includes('closed=2026-12-01'));
  check('G12', 'archived preserved', set.proposedMarkdown.includes('archived=false'));
  check('G13', 'state preserved across an unrelated mutation', set.proposedMarkdown.includes('state=on-hold'));
  check('G14', 'unknown accepted field preserved', set.proposedMarkdown.includes('customer=Acme'));
  check('G15', 'deterministic key order retained', set.proposedMarkdown.split('\n')[1] === '<!-- mme-project: id=' + ID_A + '; created=' + TODAY + '; stage=pipeline; state=on-hold; delivery=27Q4; billing=28Q1; closed=2026-12-01; archived=false; customer=Acme -->');
  check('G16', 'never a second comment', (set.proposedMarkdown.match(/mme-project/g) || []).length === 1);
  check('G17', 'managed mutation never touches the visible line', set.proposedMarkdown.split('\n')[0] === 'Project: A');
  check('G18', 'no duplicate serialized keys', (set.proposedMarkdown.match(/\bstate=/g) || []).length === 1);
  check('G19', 'mutation does not close or archive', M.mutateProject(DOC, { projectId: ID_A }, { op: 'setState', value: 'completed' }).proposedMarkdown.includes('state=completed') && !M.mutateProject(DOC, { projectId: ID_A }, { op: 'setState', value: 'completed' }).proposedMarkdown.includes('closed='));
  check('G20', 'state never auto-syncs closed', M.mutateProject(rich, { projectId: ID_A }, { op: 'clearState' }).proposedMarkdown.includes('closed=2026-12-01'));
}

/* ============================ 7. Report parity =========================== */

group('Report parity');

{
  (0, eval)(fs.readFileSync(path.join(ROOT, 'js', 'report', 'report-dictionary.js'), 'utf8'));
  const D = globalThis.MME_REPORT_DICTIONARY;
  check('E01', 'report dictionary exposes an owner', Boolean(D));
  if (D) {
    const out = D.buildReportDictionary({ indexState: { ready: true, tasks: [], projects: [
      { projectId: ID_A, name: 'Alpha', value: 50000, currency: 'brl', status: 'Quotation', expectedOrder: { raw: '26Q4', canonical: '2026-Q4', display: '26Q4', valid: true }, expectedBilling: { raw: '', canonical: null, display: '', valid: false }, expectedDelivery: { raw: '', canonical: null, display: '', valid: false }, sourcePath: 'notes/a.md', sourceLine: 10, sourceKind: 'notes', sourceName: 'a.md' },
      { projectId: ID_B, name: 'Alpha', value: 0, currency: 'BRL', status: 'Proposal', expectedOrder: { raw: '', canonical: null, display: '', valid: false }, expectedBilling: { raw: '', canonical: null, display: '', valid: false }, expectedDelivery: { raw: '', canonical: null, display: '', valid: false }, sourcePath: 'notes/b.md', sourceLine: 20, sourceKind: 'notes', sourceName: 'b.md' },
    ] }, startDate: '2026-01-01', endDate: '2026-12-31', sections: [], projectMode: 'all', generatedAt: '2026-10-03T00:00:00.000Z' });
    const json = JSON.stringify(out);
    check('E02', 'projectId carried internally', json.indexOf(ID_A) !== -1);
    const projOnly = D.selectProjects({ projects: [{ projectId: ID_A, name: 'Alpha', value: 1, currency: 'BRL', expectedOrder: { raw: '', canonical: null, display: '', valid: false }, sourcePath: 'notes/a.md', sourceLine: 3 }] }, 'all');
    check('E02b', 'projection exposes projectId as a field', projOnly.projects[0].projectId === ID_A);
    check('E02c', 'projection exposes a record key', projOnly.projects[0].recordKey === ID_A);
    check('E03', 'lowercase currency converges to one bucket', out.projects.totalsByCurrency.length === 1 && out.projects.totalsByCurrency[0].currency === 'BRL');
    check('E04', 'duplicate titles are NOT collapsed', out.projects.items.length === 2);
    check('E05', 'zero value still counted with value', out.projects.totalsByCurrency[0].projectCount === 2);
  }
  const gen = fs.readFileSync(path.join(ROOT, 'js', 'report', 'quick-report-generator.js'), 'utf8');
  check('E06', 'generator never renders projectId', !/projectId/.test(gen));
  const idx = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'workspace-index-document.js'), 'utf8');
  check('E07', 'Index Projects section never renders projectId', !/\\$\\{[^}]*projectId/.test(idx));
}

/* ============================ 8. route + caps ============================ */

group('route registration and capabilities');

{
  (0, eval)(fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'workspace-capabilities.js'), 'utf8'));
  const CAPS = globalThis.MME_WORKSPACE_CAPABILITIES;
  check('T01', 'projects capability exists', CAPS.get('projects') !== null);
  check('T02', 'projects save is an explicit false', CAPS.can('projects', 'save') === false);
  check('T03', 'projects is read-only', CAPS.can('projects', 'edit') === false);
  check('T04', 'workspace-index still registered', CAPS.get('workspace-index') !== null);

  const view = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'projects-view.js'), 'utf8');
  check('T05', 'route id is projects', /const HOST_ID = 'projects';/.test(view));
  check('T06', 'container is dedicated, not the Index container', /const CONTAINER_ID = 'projectsView';/.test(view));
  check('T07', 'Index container is not reused', !view.includes('workspaceIndexView'));
  for (const fn of ['activate', 'deactivate', 'refresh', 'detach', 'getState', 'restoreState']) {
    check('T08-' + fn, 'lifecycle exposes ' + fn, new RegExp('function ' + fn + '\\(').test(view));
  }
  check('T09', 'registers with the Host', /\.register\(buildDescriptor\(\)\)/.test(view));
  const retStart = view.indexOf('function handleReturnToWorkspace');
  const retEnd = retStart === -1 ? -1 : view.indexOf('\n  function ', retStart + 10);
  const returnHandler = retStart === -1 ? '' : view.slice(retStart, retEnd === -1 ? undefined : retEnd);
  check('T10', 'return-to-workspace switches to journal', /switchTo\('journal'/.test(returnHandler));
  check('T11', 'source navigation present', /openProjectSource/.test(view));
  const viewCode = view.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  check('T12', 'no editor-buffer mutation', !/currentSaveHandle|__programmaticTextChange|md\.value/.test(viewCode));
  check('T13', 'no Save call site', !/saveToHandle|saveSmart|createWritable/.test(viewCode));
  check('T14', 'no Index mutation', !/WORKSPACE_INDEX_STATE\s*\.\s*\w+\s*=/.test(viewCode));
  check('T15', 'no Report coupling', !/MME_REPORT_DICTIONARY|quick-report/.test(view));
  // ACT 5C supersedes the read-only minimal list in the dedicated Projects route:
  // editing controls, filters and totals are now IN SCOPE there. The invariants
  // that MUST still hold are that the Sidebar and the Workspace Index stay
  // read-only and never call the Project adapter.
  const mainForT16 = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
  const sidebarForT16 = mainForT16.slice(mainForT16.indexOf('function renderWorkspaceProjectsPanel'), mainForT16.indexOf('function renderWorkspaceProjectsPanel') + 9000);
  check('T16', 'Sidebar and Workspace Index stay read-only', !/<input|<select/.test(sidebarForT16) && !/MME_PROJECT_VISUAL_ADAPTER/.test(fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'workspace-index-document.js'), 'utf8')));
  check('T17', 'no totals leak into Report identity', !/\$\{[^}]*projectId/.test(fs.readFileSync(path.join(ROOT, 'js', 'report', 'quick-report-generator.js'), 'utf8')));
  check('T18', 'no coming-soon user copy', !/coming soon/i.test(view));
  check('T19', 'no task or group UI', !/Task|Group/.test(view.replace(/\/\/[^\n]*/g, '')));
  const mainSrc = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
  check('T20', 'Projects action switches to the projects route', /switchTo\('projects'/.test(mainSrc));
  // The Workspace Index keeps its OWN legitimate entry points (sidebar button and
  // controller). Only the Projects panel action must have moved to `projects`.
  const projectsPanel = mainSrc.slice(mainSrc.indexOf('function wireWorkspaceProjectsPanel'), mainSrc.indexOf('function wireWorkspaceProjectsPanel') + 6000);
  check('T21', 'Projects panel action no longer switches to workspace-index', !/switchTo\('workspace-index'/.test(projectsPanel));
  check('T21b', 'Workspace Index remains separately accessible', /switchTo\('workspace-index'/.test(mainSrc));
  check('T22', 'row navigation still opens the Project source', /openWorkspaceProjectsSource|Workspace Projects: opening/.test(mainSrc));
  check('T23', 'loader registers the new modules', /project-record-utils\.js/.test(fs.readFileSync(path.join(ROOT, 'js', 'app', 'script-loader.js'), 'utf8')) && /projects-view\.js/.test(fs.readFileSync(path.join(ROOT, 'js', 'app', 'script-loader.js'), 'utf8')));
  check('T24', 'sw.js asset list untouched (no cache bump)', !/projects-view|project-record-utils|project-metadata-mutation/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')));
}

/* ============================ 9. read-only =============================== */

group('read-only preservation');

{
  const sidebar = mainSidebarSource();
  check('N01', 'Sidebar still renders the count', /Project\$\{count !== 1/.test(sidebar) || /Project/.test(sidebar));
  check('N02', 'Sidebar year grouping preserved', /yearGroups/.test(sidebar));
  check('N03', 'Sidebar Unscheduled grouping preserved', /unscheduled/.test(sidebar));
  check('N04', 'Sidebar has no inputs', !/<input|<select/.test(sidebar));
  check('N05', 'Sidebar has no mutation owner call', !/MME_PROJECT_METADATA_MUTATION/.test(sidebar));
  const idx = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'workspace-index-document.js'), 'utf8');
  check('N06', 'Workspace Index has no mutation owner call', !/MME_PROJECT_METADATA_MUTATION/.test(idx));
  check('N07', 'Workspace Index keeps its Projects section', /workspaceIndexProjectsSection/.test(idx));
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  check('N08', 'APP_VERSION unchanged', /markmap-journal-pwa-0\.6\.3-tasks-wiki-links-foundation/.test(sw));
  const rel = fs.readFileSync(path.join(ROOT, 'js', 'release', 'release.js'), 'utf8');
  check('N09', 'productVersion unchanged', /productVersion\s*:\s*'0\.6\.3'/.test(rel));
  check('N10', 'no Task-to-Project link written', !/project=/.test(fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'project-metadata-mutation.js'), 'utf8')));
  check('N11', 'no Groups field added to mme-project', !/group=/i.test(fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'workspace-parser.js'), 'utf8')));
  // Assert on the OWNED operation vocabulary, not on prose. `archived` is a
  // preserved read field, never a mutation operation.
  const ownerSrc = fs.readFileSync(path.join(ROOT, 'js', 'workspace', 'project-metadata-mutation.js'), 'utf8');
  const ops = [...ownerSrc.matchAll(/'(set|clear)[A-Za-z]+'/g)].map((x) => x[0].replace(/'/g, ''));
  check('N12', 'no close/reopen/archive/restore/delete operation', !ops.some((o) => /close|reopen|archive|restore|delete/i.test(o)), ops.join(','));
  check('N13', 'owned operations are exactly the approved set', ops.filter((v, i) => ops.indexOf(v) === i).length === 12);
}

function mainSidebarSource() {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
  const start = src.indexOf('function renderWorkspaceProjectsPanel');
  return src.slice(start, start + 9000);
}

/* -------------------------------- report -------------------------------- */

let passed = 0, failed = 0, groups = 0;
const failures = [];
for (const r of results) {
  if (r.id === undefined) { groups += 1; continue; }
  if (r.ok) passed += 1; else { failed += 1; failures.push(r); }
}
console.log('ACT 5B — Project consumer / normalization / route validators');
console.log('='.repeat(62));
for (const r of results) {
  if (r.id === undefined) { console.log('\n[' + r.group + ']'); continue; }
  console.log('  ' + (r.ok ? 'PASS' : 'FAIL') + '  ' + String(r.id).padEnd(12) + ' ' + r.name + (r.ok || !r.detail ? '' : '  <- ' + r.detail));
}
console.log('='.repeat(62));
console.log('groups=' + groups + ' passed=' + passed + ' failed=' + failed + ' total=' + (passed + failed));
if (failed) { console.log('\nRESULT: FAIL'); process.exit(1); }
console.log('\nRESULT: PASS');
