#!/usr/bin/env node
'use strict';

/**
 * ACT 5A — Managed Project contract validators (built fresh in ACT 5A).
 *
 * Tests the REAL owners in js/workspace/workspace-parser.js:
 *   parseProjectDeclarationValue, parseProjects, parseManagedProjectComment,
 *   serializeManagedProjectComment, reconcileManagedProjects.
 *
 * `today` and the ID generator are INJECTED, so every fixture is deterministic.
 * This script asserts no historical fixture count; it reports what it executes.
 *
 * Usage: node scripts/project-contract-validators.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PARSER_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-parser.js');
const MAIN_PATH = path.join(ROOT, 'js', 'main.js');
const SW_PATH = path.join(ROOT, 'sw.js');

global.window = global;
require(PARSER_PATH);

const P = globalThis.WORKSPACE_PARSER;
if (!P || typeof P.reconcileManagedProjects !== 'function') {
  console.error('FATAL: WORKSPACE_PARSER owners unavailable — cannot validate.');
  process.exit(1);
}


// Defensive accessors: a mutation must produce a NAMED fixture failure, never a
// crash, so diagnostics are always read defensively.
function code0(list) {
  return list && list.length ? list[0].code : '<none>';
}
function hasCode(list, code) {
  return Boolean(list && list.some ? list.some((d) => d && d.code === code) : false);
}

const results = [];
let currentGroup = '';
function group(title) {
  currentGroup = title;
  results.push({ group: title });
}
function check(id, name, ok, detail) {
  results.push({
    id,
    group: currentGroup,
    name,
    ok: ok === true,
    detail: detail == null ? '' : String(detail),
  });
}

const FENCE = String.fromCharCode(96).repeat(3);
const FIXED_TODAY = '2026-10-03';

const ID_A = 'prj_11111111-1111-4111-8111-111111111111';
const ID_B = 'prj_22222222-2222-4222-8222-222222222222';
const ID_C = 'prj_33333333-3333-4333-8333-333333333333';

function makeIdFactory(ids) {
  const queue = (ids || []).slice();
  let calls = 0;
  const fn = () => {
    calls += 1;
    return queue.length ? queue.shift() : `prj_0000000${calls}-0000-4000-8000-00000000000${calls}`;
  };
  fn.callCount = () => calls;
  return fn;
}

function managedComment(id, created, extra) {
  const parts = [`id=${id}`, `created=${created}`];
  if (extra) for (const piece of extra.split(';')) parts.push(piece.trim());
  return `<!-- mme-project: ${parts.join('; ')} -->`;
}

function reconcile(text, ids, today) {
  const gen = makeIdFactory(ids);
  const result = P.reconcileManagedProjects(text, {
    today: today || FIXED_TODAY,
    generateId: gen,
  });
  result.__idCalls = gen.callCount();
  return result;
}

function countComments(text) {
  return (String(text).match(/<!--\s*mme-project:/gi) || []).length;
}
function extractId(text, chunk) {
  const m = String(chunk == null ? text : chunk).match(/id=(prj_[0-9a-f-]+)/i);
  return m ? m[1] : '';
}
function extractCreated(text) {
  const m = String(text).match(/created=([0-9-]+)/i);
  return m ? m[1] : '';
}

/* ============================ A. visible declaration ========================= */

group('A. visible declaration and trailing-token parsing');
{
  const d = P.parseProjectDeclarationValue('Alibaba');
  check('A01', 'name-only declaration is valid', d.title === 'Alibaba' && d.value === null, d.title);
  check('A02', 'name-only has no Expected Order', d.expectedOrder === null);
}
{
  const d = P.parseProjectDeclarationValue('Alibaba [800000 BRL]');
  check('A03', 'value+currency form', d.title === 'Alibaba' && d.value === 800000 && d.currency === 'BRL');
}
{
  const d = P.parseProjectDeclarationValue('Alibaba [27Q3]');
  check('A04', 'quarter-only form', d.title === 'Alibaba' && d.expectedOrder && d.expectedOrder.canonical === '2027-Q3');
}
{
  const d = P.parseProjectDeclarationValue('Alibaba [800000 BRL] [27Q3]');
  check('A05', 'combined form', d.title === 'Alibaba' && d.value === 800000 && d.currency === 'BRL' && d.expectedOrder.canonical === '2027-Q3');
}
{
  const d = P.parseProjectDeclarationValue('Migration [Phase 1]');
  check('A06', 'bracketed title preserved verbatim', d.title === 'Migration [Phase 1]');
  check('A07', 'unrecognized bracket yields no value', d.value === null);
  check('A08', 'unrecognized bracket yields no quarter', d.expectedOrder === null);
  check('A09', 'ordinary bracketed title is not diagnosed', d.diagnostics.length === 0);
}
{
  const d = P.parseProjectDeclarationValue('Migration [Phase 1] [800000 BRL] [27Q3]');
  check('A10', 'title stops at first unrecognized bracket', d.title === 'Migration [Phase 1]');
  check('A11', 'trailing value still consumed', d.value === 800000 && d.currency === 'BRL');
  check('A12', 'trailing quarter still consumed', d.expectedOrder.canonical === '2027-Q3');
}
{
  const d = P.parseProjectDeclarationValue('Review [[Alibaba]] [27Q3]');
  check('A13', 'Wiki Link preserved in title', d.title === 'Review [[Alibaba]]');
  check('A14', 'quarter consumed after Wiki Link', d.expectedOrder.canonical === '2027-Q3');
}
{
  const src = 'Project: Alibaba [800000 BRL] [27Q3]';
  P.parseProjects(src, {});
  check('A15', 'parsing never rewrites source', src === 'Project: Alibaba [800000 BRL] [27Q3]');
}

/* ============================== B. value / currency ========================== */

group('B. value and currency');
check('B01', 'canonical BRL', P.parseProjectDeclarationValue('X [800000 BRL]').value === 800000);
check('B02', 'canonical USD', P.parseProjectDeclarationValue('X [1200000 USD]').value === 1200000);
check('B03', 'decimal fraction', P.parseProjectDeclarationValue('X [1250000.50 USD]').value === 1250000.5);
check('B04', 'currency uppercased', P.parseProjectDeclarationValue('X [10 brl]').currency === 'BRL');
check('B05', 'zero is a present value', P.parseProjectDeclarationValue('X [0 BRL]').value === 0);
check('B06', 'zero is not null', P.parseProjectDeclarationValue('X [0 BRL]').value !== null);
check('B07', 'zero distinct from missing', P.parseProjectDeclarationValue('X [0 BRL]').value !== P.parseProjectDeclarationValue('X').value);
{
  const rejected = ['X [800000BRL]', 'X [1.200.000 BRL]', 'X [1,200,000 USD]', 'X [-50000 BRL]'];
  check('B08', 'non-canonical money never yields a value', rejected.every((s) => P.parseProjectDeclarationValue(s).value === null));
  check('B09', 'thousands separator diagnosed', code0(P.parseProjectDeclarationValue('X [1,200,000 USD]').diagnostics) === 'invalid-value-token');
  check('B10', 'negative value diagnosed', code0(P.parseProjectDeclarationValue('X [-50000 BRL]').diagnostics) === 'invalid-value-token');
  check('B11', 'value without currency diagnosed', code0(P.parseProjectDeclarationValue('X [800000]').diagnostics) === 'value-without-currency');
  check('B12', 'malformed candidate stays readable', P.parseProjectDeclarationValue('X [1,200,000 USD]').title === 'X [1,200,000 USD]');
  let noThrow = true;
  try { for (const s of ['X [', 'X []', 'X [[]]', 'X []]', 'X [-]', 'X [a b c]', 'X [800000 BRL']) P.parseProjectDeclarationValue(s); }
  catch { noThrow = false; }
  check('B13', 'malformed input never throws', noThrow);
}
check('B14', 'legacy Value: still accepts separators', P.parseProjects('Project: L\nValue: 1,200,000', {})[0].value === 1200000);
// The visible grammar must reject a malformed token CONSUMED as a value: a
// Number() that is not finite can never become a Project value.
check('B15', 'a non-finite numeric token is never a value', (() => {
  const d = P.parseProjectDeclarationValue('X [1,200,000 USD]');
  return d.value === null && typeof d.value !== 'number';
})());
check('B16', 'NaN never reaches the record', P.parseProjects('Project: X [1,200,000 USD]', {})[0].value === null);
// Legacy must not override a ZERO visible value (zero is present, not missing).
check('B17', 'legacy never overrides a zero visible value', P.parseProjects('Project: Z [0 USD]\nValue: 999\nCurrency: BRL', {})[0].value === 0);
check('B18', 'legacy never overrides a zero visible currency', P.parseProjects('Project: Z [0 USD]\nCurrency: BRL', {})[0].currency === 'USD');
// identity: an unmanaged Project must never receive a derived identity
check('B19', 'unmanaged Project gets no derived identity', P.parseProjects('Project: Some Title [1 USD]', { path: 'notes/a.md' })[0].projectId === '');
check('B20', 'no path-derived identity for an unmanaged Project', P.parseProjects('Project: Some Title [1 USD]', { path: 'notes/a.md' }).every((x) => x.projectId !== 'notes/a.md'));
check('B21', 'no line-derived identity for an unmanaged Project', P.parseProjects('Project: Some Title [1 USD]', { path: 'notes/a.md' })[0].projectId !== '1');
check('B22', 'no title-derived identity for an unmanaged Project', P.parseProjects('Project: Some Title [1 USD]', { path: 'notes/a.md' })[0].projectId !== 'some-title');

/* ============================ C. quarter normalization ======================= */

group('C. quarter normalization');
for (const pair of [['27Q1', '2027-Q1'], ['2027Q1', '2027-Q1'], ['2027-Q1', '2027-Q1']]) {
  check(`C-${pair[0]}`, `${pair[0]} normalizes`, P.parseProjectDeclarationValue(`X [${pair[0]}]`).expectedOrder.canonical === pair[1]);
}
check('C04', 'quarter reuses the existing normalizer', P.normalizeProjectQuarter('27Q3').display === '27Q3');
check('C05', 'Q5 rejected', P.parseProjectDeclarationValue('X [27Q5]').expectedOrder === null);
check('C06', 'Q5 diagnosed', code0(P.parseProjectDeclarationValue('X [27Q5]').diagnostics) === 'invalid-expected-order');
check('C07', 'malformed quarter stays readable', P.parseProjectDeclarationValue('X [27Q5]').title === 'X [27Q5]');
check('C08', 'Q9 diagnosed', code0(P.parseProjectDeclarationValue('X [27Q9]').diagnostics) === 'invalid-expected-order');
{
  const p = P.parseProjects('Project: X [27Q3]\n', {})[0];
  check('C09', 'visible line owns only Expected Order', p.expectedDelivery.valid === false && p.expectedBilling.valid === false);
  let noThrow = true;
  try { for (const s of ['X [27Q]', 'X [Q1]', 'X [q1]', 'X [9999Q4]', 'X [27Q4x]']) P.parseProjectDeclarationValue(s); } catch { noThrow = false; }
  check('C10', 'malformed quarters never throw', noThrow);
}

/* ============================ D. mme-project parsing ========================= */

group('D. mme-project parsing');
{
  const c = P.parseManagedProjectComment(managedComment(ID_A, FIXED_TODAY));
  check('D01', 'valid comment recognized', c.present === true && c.valid === true);
  check('D02', 'id parsed', c.fields.id === ID_A);
  check('D03', 'created parsed', c.fields.created === FIXED_TODAY);
  check('D04', 'unrelated line is not a comment', P.parseManagedProjectComment('Project: X') === null);
  check('D05', 'unrelated HTML comment ignored', P.parseManagedProjectComment('<!-- note -->') === null);
  check('D06', 'whitespace tolerant', P.parseManagedProjectComment(`<!--   mme-project:   id=${ID_A};   created=${FIXED_TODAY}   -->`).valid === true);
}

check('D07', 'missing id diagnosed', hasCode(P.parseManagedProjectComment(`<!-- mme-project: created=${FIXED_TODAY} -->`).diagnostics, 'missing-managed-id'));
check('D08', 'invalid id diagnosed', hasCode(P.parseManagedProjectComment('<!-- mme-project: id=prj_short; created=2026-10-03 -->').diagnostics, 'invalid-managed-id'));
check('D09', 'missing created diagnosed', hasCode(P.parseManagedProjectComment(`<!-- mme-project: id=${ID_A} -->`).diagnostics, 'missing-created'));
check('D10', 'invalid created diagnosed', hasCode(P.parseManagedProjectComment(`<!-- mme-project: id=${ID_A}; created=03/10/2026 -->`).diagnostics, 'invalid-created'));
check('D11', 'impossible date diagnosed', hasCode(P.parseManagedProjectComment(`<!-- mme-project: id=${ID_A}; created=2026-02-30 -->`).diagnostics, 'invalid-created'));
check('D12', 'garbage body diagnosed', hasCode(P.parseManagedProjectComment('<!-- mme-project: garbage -->').diagnostics, 'malformed-managed-comment'));
check('D13', 'duplicate serialized key rejected', P.parseManagedProjectComment(`<!-- mme-project: id=${ID_A}; id=${ID_B}; created=${FIXED_TODAY} -->`).valid === false);
check('D14', 'unterminated comment diagnosed', P.parseManagedProjectComment('<!-- mme-project: id=x; created=2026-10-03').valid === false);
check('D15', 'delivery quarter validated', P.parseManagedProjectComment(`<!-- mme-project: id=${ID_A}; created=${FIXED_TODAY}; delivery=27Q4 -->`).valid === true);
check('D16', 'invalid delivery quarter diagnosed', hasCode(P.parseManagedProjectComment(`<!-- mme-project: id=${ID_A}; created=${FIXED_TODAY}; delivery=27Q5 -->`).diagnostics, 'invalid-delivery-quarter'));
check('D17', 'invalid billing quarter diagnosed', hasCode(P.parseManagedProjectComment(`<!-- mme-project: id=${ID_A}; created=${FIXED_TODAY}; billing=Q9 -->`).diagnostics, 'invalid-billing-quarter'));
check('D18', 'invalid closed date diagnosed', hasCode(P.parseManagedProjectComment(`<!-- mme-project: id=${ID_A}; created=${FIXED_TODAY}; closed=nope -->`).diagnostics, 'invalid-closed-date'));
check('D19', 'invalid archived value diagnosed', hasCode(P.parseManagedProjectComment(`<!-- mme-project: id=${ID_A}; created=${FIXED_TODAY}; archived=maybe -->`).diagnostics, 'invalid-archived-value'));
check('D20', 'unrelated mme-task not read as project', P.parseManagedProjectComment('<!-- mme-task: completed=2026-10-03 -->') === null);

/* ================================ E. identity =============================== */

group('E. identity');
check('E01', 'ID format is prj_ + full uuid', P.isProjectIdValue(ID_A) === true);
check('E02', 'truncated uuid rejected', P.isProjectIdValue('prj_11111111-1111-4111-8111') === false);
check('E03', 'short uuid rejected', P.isProjectIdValue('prj_11111111-1111-4111-8111-11111111111') === false);
check('E04', 'non-prj prefix rejected', P.isProjectIdValue('proj_11111111-1111-4111-8111-111111111111') === false);
check('E05', 'bare uuid rejected', P.isProjectIdValue('11111111-1111-4111-8111-111111111111') === false);
check('E06', 'full uuid retained, not truncated', P.isProjectIdValue('prj_12345678-1234-4234-8234-123456789abc') === true);
{
  const base = `Project: Alibaba [800000 BRL] [27Q3]\n${managedComment(ID_A, FIXED_TODAY)}\n`;
  check('E07', 'title is not identity', P.parseProjects(base, {})[0].projectId === ID_A);
  check('E08', 'rename preserves ID', P.parseProjects(`Project: Alibaba Renamed [800000 BRL] [27Q3]\n${managedComment(ID_A, FIXED_TODAY)}\n`, {})[0].projectId === ID_A);
  const moved = P.parseProjects(`intro\n\nintro 2\n\nProject: Alibaba\n${managedComment(ID_A, FIXED_TODAY)}\n`, {})[0];
  check('E09', 'line movement preserves ID', moved.projectId === ID_A);
  check('E10', 'line movement changes sourceLine', moved.sourceLine === 5, String(moved.sourceLine));
  check('E11', 'sourceLine is not identity', moved.sourceLine !== ID_A);
  const ids = P.parseProjects(`Project: Beta\n${managedComment(ID_B, FIXED_TODAY)}\n\nProject: Alibaba\n${managedComment(ID_A, FIXED_TODAY)}\n`, {}).map((p) => p.projectId);
  check('E12', 'reorder preserves both IDs', ids[0] === ID_B && ids[1] === ID_A);
  check('E13', 'file move preserves ID', P.parseProjects(`Project: Alibaba\n${managedComment(ID_A, FIXED_TODAY)}\n`, { path: 'notes/other.md' })[0].projectId === ID_A);
  check('E14', 'path is not identity', P.parseProjects(`Project: Alibaba\n${managedComment(ID_A, FIXED_TODAY)}\n`, { path: 'notes/other.md' })[0].sourcePath !== ID_A);
  check('E15', 'ordinal is not identity', P.parseProjects(`Project: Alpha\n${managedComment(ID_B, FIXED_TODAY)}\n\nProject: Beta\n${managedComment(ID_A, FIXED_TODAY)}\n`, {})[1].projectId === ID_A);
}
{
  const parsed = P.parseProjects('Project: Fresh [10 USD]\n', {})[0];
  check('E16', 'unmanaged Project has no projectId', parsed.projectId === '');
  check('E17', 'unmanaged Project needs reconciliation', parsed.needsReconciliation === true);
  check('E18', 'duplicate ID diagnosed', P.parseProjects('Project: A\n' + managedComment(ID_A, FIXED_TODAY) + '\n\nProject: B\n' + managedComment(ID_A, FIXED_TODAY) + '\n', {}).some((p) => p.diagnostics.some((d) => d.code === 'duplicate-managed-id')));
}

/* ============================== F. created date ============================= */

group('F. created date');
{
  const r = reconcile('Project: A\nProject: B\nProject: C\n', [ID_A, ID_B, ID_C]);
  const dates = [...r.text.matchAll(/created=([0-9-]+)/g)].map((m) => m[1]);
  check('F01', 'one date for all new Projects in one attempt', dates.length === 3 && dates.every((d) => d === FIXED_TODAY));
  check('F02', 'injected date makes results deterministic', r.text.includes(`created=${FIXED_TODAY}`));
}
{
  const first = reconcile('Project: A\n', [ID_A], FIXED_TODAY);
  const retry = reconcile(first.text, [], '2026-12-25');
  check('F03', 'retry generates no replacement ID', retry.__idCalls === 0);
  check('F04', 'retry preserves created', extractCreated(retry.text) === FIXED_TODAY);
  check('F05', 'later Save keeps created stable', reconcile(retry.text, [], '2027-01-01').text === retry.text);
  check('F06', 'no updated date introduced', !/updated=|modified=|lastSeen=/i.test(retry.text));
  check('F07', 'no automatic closed date', !/closed=/.test(retry.text));
  check('F08', 'no automatic archived flag', !/archived=/.test(retry.text));
  check('F09', 'parser never rewrites created', P.parseProjects(retry.text, {})[0].created === FIXED_TODAY);
  check('F10', 'invalid created diagnosed', P.parseProjects(`Project: A\n<!-- mme-project: id=${ID_A}; created=2026-13-01 -->\n`, {})[0].created === '');
}

/* ============================ G. optional metadata =========================== */

group('G. optional metadata');
{
  const src = `Project: Alibaba\n${managedComment(ID_A, FIXED_TODAY, 'stage=Quotation; delivery=27Q4; billing=28Q1; closed=2026-12-01; archived=false')}\n`;
  const p = P.parseProjects(src, {})[0];
  check('G01', 'managed stage read', p.stage === 'Quotation');
  check('G02', 'commercial stage preserved verbatim', p.stage === 'Quotation');
  check('G03', 'status mirrors managed stage for consumers', p.status === 'Quotation');
  check('G04', 'managed delivery read', p.expectedDelivery.canonical === '2027-Q4');
  check('G05', 'managed billing read', p.expectedBilling.canonical === '2028-Q1');
  check('G06', 'closed read', p.closed === '2026-12-01');
  check('G07', 'archived false read', p.archived === false);
  check('G08', 'archived true read', P.parseProjects(`Project: A\n${managedComment(ID_B, FIXED_TODAY, 'archived=true')}\n`, {})[0].archived === true);
  check('G09', 'Lead/Proposal preserved verbatim', ['Lead', 'Proposal', 'Quotation'].every((s) => P.parseProjects('Project: A\n' + managedComment(ID_B, FIXED_TODAY, 'stage=' + s) + '\n', {})[0].stage === s));
  check('G10', 'no active/on-hold/done enum imposed', !/^(active|on-hold|done)$/.test(P.parseProjects(`Project: A\n${managedComment(ID_B, FIXED_TODAY, 'stage=Lead')}\n`, {})[0].stage));
  const many = Array.from({ length: 4 }, (_, i) => `Project: P${i}\n${managedComment(`prj_0000000${i}-0000-4000-8000-00000000000${i}`, FIXED_TODAY, 'archived=true')}\n`).join('\n');
  const ps = P.parseProjects(many, {});
  check('G11', 'archived has no filtering effect in ACT 5A', ps.length === 4 && ps.every((p) => p.archived === true));
}

/* ============================== H. legacy fallback ========================== */

group('H. legacy fallback');
{
  const p = P.parseProjects('Project: Legacy\nValue: 50000\nCurrency: usd\nOrder: 26q4\nStatus: Quotation\n', {})[0];
  check('H01', 'legacy value read', p.value === 50000);
  check('H02', 'legacy currency uppercased', p.currency === 'USD');
  check('H03', 'legacy order normalized', p.expectedOrder.canonical === '2026-Q4');
  check('H04', 'legacy status fills stage when managed absent', p.stage === 'Quotation');
  check('H05', 'legacyFieldsPresent exposed', p.legacyFieldsPresent === true);
  check('H06', 'legacy-only Project has no projectId', p.projectId === '');
  check('H07', 'multiline legacy still parses', P.parseProjects('Project: M\n- Value: 10\n- Currency: USD\n', {})[0].value === 10);
}
{
  const p = P.parseProjects('Project: Both [800000 BRL] [27Q3]\nValue: 1\nCurrency: USD\nOrder: 26Q1\n', {})[0];
  check('H08', 'legacy never overrides visible value', p.value === 800000);
  check('H09', 'legacy never overrides visible currency', p.currency === 'BRL');
  check('H10', 'legacy never overrides visible order', p.expectedOrder.canonical === '2027-Q3');
}
{
  const src = 'Project: Both [800000 BRL]\nStatus: Lead\n' + managedComment(ID_A, FIXED_TODAY, 'stage=Proposal') + '\n';
  const p = P.parseProjects(src, {})[0];
  check('H11', 'managed stage wins over legacy', p.stage === 'Proposal');
  check('H12', 'legacy line never deleted', src.includes('Status: Lead'));
  check('H13', 'legacy line never rewritten', P.reconcileManagedProjects(src, { today: FIXED_TODAY, generateId: () => ID_B }).text === src);
}
{
  const src = 'Project: NoAuto\nStatus: Lead\n';
  const r = reconcile(src, [ID_A]);
  check('H14', 'no automatic legacy-stage migration', !/stage=/.test(r.text));
  check('H15', 'reconciliation inserts only id and created', r.text.includes(managedComment(ID_A, FIXED_TODAY)));
  check('H16', 'legacy Status: line survives reconciliation', r.text.includes('Status: Lead'));
}
{
  const p = P.parseProjects('Project: X\nCustomer: Example\n' + managedComment(ID_A, FIXED_TODAY, 'customer=Example') + '\n', {})[0];
  check('H17', 'unknown managed field preserved', p.extraFields.customer === 'Example');
  check('H18', 'unknown managed field reserialized after owned keys', P.serializeManagedProjectComment({ id: ID_A, created: FIXED_TODAY }, { customer: 'Example' }) === managedComment(ID_A, FIXED_TODAY, 'customer=Example'));
  for (const banned of ['owner', 'probability', 'dependency', 'subproject', 'reminder']) {
    check('H19-' + banned, 'no ' + banned + ' key invented', !new RegExp(banned + '=', 'i').test(P.serializeManagedProjectComment({ id: ID_A, created: FIXED_TODAY })));
  }
}

/* ======================== I. fenced-code exclusion ========================== */

group('I. fenced-code exclusion');
{
  const fenced = [FENCE, 'Project: Inside [800000 BRL] [27Q3]', FENCE].join('\n');
  check('I01', 'Project inside a fence is not parsed', P.parseProjects(fenced, {}).length === 0);
  const r = reconcile(fenced, [ID_A]);
  check('I02', 'no comment inserted inside a fence', countComments(r.text) === 0);
  check('I03', 'fenced text preserved byte-identically', r.text === fenced);
  check('I04', 'tilde fences also excluded', P.parseProjects(['~~~', 'Project: Inside', '~~~'].join('\n'), {}).length === 0);
  check('I05', 'unterminated fence excludes the rest', P.parseProjects(['```', 'Project: Inside'].join('\n'), {}).length === 0);
}
{
  const mixed = 'Project: Real [800000 BRL]\n' + managedComment(ID_A, FIXED_TODAY) + '\n\n' + FENCE + '\nProject: Inside\n' + FENCE + '\n';
  check('I06', 'only the real Project is parsed', P.parseProjects(mixed, {}).length === 1);
  check('I07', 'reconciliation does not touch fenced content', reconcile(mixed, [ID_B]).changed === false);
  check('I08', 'fenced block preserved', reconcile(mixed, [ID_B]).text === mixed);
}
{
  const src = FENCE + '\nProject: A\n' + FENCE + '\nProject: B\n';
  const r = reconcile(src, [ID_A]);
  check('I09', 'Project after a fence reconciles', countComments(r.text) === 1);
  check('I10', 'reconciled Project is the post-fence one', r.text.includes(FENCE + '\nProject: B\n<!-- mme-project:'));
}

/* ================== J. Wiki Link and Task-line exclusion ===================== */

group('J. Wiki Link and Task-line exclusion');
{
  const p = P.parseProjects('Project: Review [[Alibaba]] [27Q3]\n', {})[0];
  check('J01', 'Wiki Link survives parsing', p.name === 'Review [[Alibaba]]');
  check('J02', 'Expected Order still read', p.expectedOrder.canonical === '2027-Q3');
  check('J03', 'Wiki Link is not a value token', p.value === null);
  check('J04', 'Wiki Link before a value token', P.parseProjects('Project: Review [[Alibaba]] [800000 BRL]\n', {})[0].value === 800000);
  check('J05', 'Wiki Link alone keeps full title', P.parseProjects('Project: Review [[Alibaba]]\n', {})[0].name === 'Review [[Alibaba]]');
}
check('J06', 'Task line is not a Project', P.parseProjects('- [ ] Ship Alibaba [800000 BRL]\n', {}).length === 0);
check('J07', 'completed Task line is not a Project', P.parseProjects('- [x] Ship Alibaba [800000 BRL]\n', {}).length === 0);
check('J08', 'starred Task line is not a Project', P.parseProjects('* [ ] Ship Alibaba [800000 BRL]\n', {}).length === 0);
{
  const r = reconcile('- [ ] ACT 5A Task #p1\n', [ID_A]);
  check('J09', 'no Project metadata added to a Task line', countComments(r.text) === 0);
  check('J10', 'Task priority token untouched', r.text.includes('#p1'));
}
{
  const src = 'Project: Alibaba [800000 BRL] [27Q3]\n- [ ] Ship it #p1\n' + managedComment(ID_A, FIXED_TODAY) + '\n';
  const p = P.parseProjects(src, {})[0];
  check('J11', 'Task line does not become a legacy field', p.name === 'Alibaba');
  check('J12', 'Task line does not override visible value', p.value === 800000);
}

/* =========================== K. pure reconciliation ========================= */

group('K. pure reconciliation');
{
  const src = 'Project: Alibaba [800000 BRL] [27Q3]\n';
  const r = reconcile(src, [ID_A]);
  check('K01', 'unmanaged unambiguous Project gets one comment', countComments(r.text) === 1);
  check('K02', 'inserted counted', r.inserted === 1 && r.changed === true);
  check('K03', 'ID generated once', r.__idCalls === 1 && extractId(r.text) === ID_A);
  check('K04', 'created generated once', extractCreated(r.text) === FIXED_TODAY);
  check('K05', 'comment is immediately adjacent', r.text.split('\n')[1].startsWith('<!-- mme-project:'));
  check('K06', 'source line untouched', r.text.split('\n')[0] === 'Project: Alibaba [800000 BRL] [27Q3]');
}
{
  const src = 'Project: Alibaba [800000 BRL] [27Q3]\n' + managedComment(ID_A, FIXED_TODAY) + '\n';
  const r = reconcile(src, []);
  check('K07', 'valid managed Project inserts nothing', r.changed === false && r.inserted === 0);
  check('K08', 'valid managed Project counted unchanged', r.unchanged === 1);
  check('K09', 'valid managed Project mints no ID', r.__idCalls === 0);
  check('K10', 'valid comment not reformatted', r.text === src);
}
{
  const src = 'Project: Alibaba [800000 BRL]\n<!-- mme-project: garbage -->\n';
  const r = reconcile(src, [ID_A]);
  check('K11', 'malformed comment receives no competing comment', countComments(r.text) === 1);
  check('K12', 'malformed comment source unchanged', r.text === src);
  check('K13', 'malformed counted', r.malformed === 1);
  check('K14', 'malformed mints no ID', r.__idCalls === 0);
}
{
  const src = 'Project: Alibaba\n' + managedComment(ID_A, FIXED_TODAY) + '\n\nProject: Alibaba\n' + managedComment(ID_A, FIXED_TODAY) + '\n';
  const r = reconcile(src, []);
  check('K15', 'duplicate IDs not auto-repaired', r.text === src);
  check('K16', 'duplicate identity diagnosed',hasCode( r.diagnostics, 'duplicate-managed-id') || r.malformed >= 1);
}
{
  const src = 'Project: Alibaba\n' + managedComment(ID_A, FIXED_TODAY) + '\n' + managedComment(ID_B, FIXED_TODAY) + '\n';
  const r = reconcile(src, []);
  check('K17', 'two adjacent comments are not repaired', countComments(r.text) === 2);
  check('K18', 'duplicate adjacent comments diagnosed',hasCode( r.diagnostics, 'duplicate-managed-comment'));
  check('K19', 'duplicate adjacent mints no ID', r.__idCalls === 0);
}
{
  const r = reconcile('Project: A\nProject: A\n', [ID_A, ID_B]);
  const ids = [...r.text.matchAll(/id=(prj_[0-9a-f-]+)/g)].map((m) => m[1]);
  check('K20', 'duplicate titles stay independent', r.inserted === 2);
  check('K21', 'duplicate titles receive distinct IDs', ids.length === 2 && ids[0] !== ids[1]);
}
{
  const src = 'Project: A\n\nordinary text\n\nProject: B\n\nmore text\n';
  const r = reconcile(src, [ID_A, ID_B]);
  check('K22', 'multiple Projects reconcile independently', r.inserted === 2);
  check('K23', 'ordinary Markdown byte-preserved', r.text.includes('ordinary text') && r.text.includes('more text'));
  check('K24', 'blank lines preserved', r.text.split('\n').filter((l) => l === '').length === src.split('\n').filter((l) => l === '').length);
}
{
  const src = 'Project: A [800000 BRL] [27Q3]\n\n- [ ] Task\n\n> quote\n\n' + FENCE + '\ncode\n' + FENCE + '\n\n<!-- unrelated -->\n';
  const r = reconcile(src, [ID_A]);
  check('K25', 'unrelated Markdown preserved', r.text.includes('> quote') && r.text.includes('code') && r.text.includes('<!-- unrelated -->'));
  const r2 = reconcile(r.text, []);
  check('K26', 'repeated reconciliation is idempotent', r2.changed === false && r2.text === r.text);
  check('K27', 'third pass still idempotent', reconcile(r2.text, []).text === r.text);
}
{
  const plain = '# Title\n\nSome text.\n\n## Section\n\nMore.\n';
  const r = reconcile(plain, [ID_A]);
  check('K28', 'document without Projects is untouched', r.changed === false && r.text === plain);
  check('K29', 'no ID minted without a Project', r.__idCalls === 0);
}
{
  const r = reconcile('Project: A\n', [ID_A], 'not-a-date');
  check('K30', 'invalid injected date skips reconciliation', r.changed === false && r.skippedReason === 'invalid-today');
  check('K31', 'invalid date mints no ID', r.__idCalls === 0);
}
{
  const r = reconcile('Project: A\n', ['prj_not-a-uuid']);
  check('K32', 'invalid generated ID is ambiguous, not written', r.changed === false && r.ambiguous === 1);
  check('K33', 'no title/path fallback ID minted', countComments(r.text) === 0);
  // The FIRST use of a valid generated ID is written; only the collision is
  // refused. No title/path fallback identity is ever substituted.
  const dup = P.reconcileManagedProjects('Project: A\nProject: B\n', { today: FIXED_TODAY, generateId: () => ID_A });
  check('K34', 'colliding generated ID is ambiguous, not written', dup.ambiguous === 1 && dup.inserted === 1, 'ambiguous=' + dup.ambiguous + ' inserted=' + dup.inserted);
  check('K34b', 'colliding Project receives no fallback ID', (dup.text.match(/mme-project/g) || []).length === 1);
}
{
  const one = 'Project: A\n' + managedComment(ID_A, FIXED_TODAY) + '\n';
  check('K35', 'one blank line is tolerated', P.parseProjects(one, {})[0].metadataValid === true);
  check('K36', 'two blank lines is not associated', P.parseProjects('Project: A\n\n\n' + managedComment(ID_A, FIXED_TODAY) + '\n', {})[0].metadataValid === false);
  const before = managedComment(ID_A, FIXED_TODAY) + '\nProject: A\n';
  check('K37', 'comment before declaration is not associated', P.parseProjects(before, {}).find((p) => !p.orphanOnly).projectId === '');
  check('K38', 'comment before declaration is an orphan', P.parseProjects(before, {}).some((p) => p.orphanOnly && p.diagnostics[0].code === 'orphan-managed-comment'));
  check('K39', 'never associates across another Project', P.parseProjects('Project: A\n\nProject: B\n' + managedComment(ID_A, FIXED_TODAY) + '\n', {})[0].projectId === '');
  check('K40', 'never associates across a heading', P.parseProjects('Project: A\n\n## Notes\n' + managedComment(ID_A, FIXED_TODAY) + '\n', {})[0].projectId === '');
  check('K41', 'ordinary comment between blocks association', P.parseProjects('Project: A\n<!-- note -->\n' + managedComment(ID_A, FIXED_TODAY) + '\n', {})[0].projectId === '');
  check('K42', 'orphan comment is never deleted', P.reconcileManagedProjects(before, { today: FIXED_TODAY, generateId: () => ID_B }).text.includes(managedComment(ID_A, FIXED_TODAY)));
}
{
  const r1 = reconcile('Project: A\n', [ID_A]);
  const p = P.parseProjects(r1.text, {})[0];
  check('K43', 'reconciled Project round-trips its ID', p.projectId === ID_A);
  check('K44', 'reconciled Project is metadataManaged', p.metadataManaged === true);
  check('K45', 'reconciled Project needs no further reconciliation', p.needsReconciliation === false);
  check('K46', 'reconciled Project reports no diagnostics', p.diagnostics.length === 0);
}
check('K47', 'deterministic key order', P.serializeManagedProjectComment({ archived: 'false', billing: '28Q1', delivery: '27Q4', stage: 'Quotation', closed: '2026-12-01', created: FIXED_TODAY, id: ID_A }) === '<!-- mme-project: id=' + ID_A + '; created=' + FIXED_TODAY + '; stage=Quotation; delivery=27Q4; billing=28Q1; closed=2026-12-01; archived=false -->');
check('K48', 'minimal comment has exactly two keys', P.serializeManagedProjectComment({ id: ID_A, created: FIXED_TODAY }) === managedComment(ID_A, FIXED_TODAY));
check('K49', 'no duplicate serialized keys', (P.serializeManagedProjectComment({ id: ID_A, created: FIXED_TODAY }).match(/\bid=/g) || []).length === 1);
check('K50', 'round-trip stays valid', P.parseManagedProjectComment(P.serializeManagedProjectComment({ id: ID_A, created: FIXED_TODAY, stage: 'Lead' })).valid === true);

/* ==================== P. Task regression / independence ==================== */

group('P. Task regression and independence');
{
  const mainSrc = fs.readFileSync(MAIN_PATH, 'utf8');
  const lifecycleSrc = fs.readFileSync(path.join(ROOT, 'js', 'tasks', 'task-lifecycle.js'), 'utf8');
  const act5a = fs.readFileSync(PARSER_PATH, 'utf8').split('ACT 5A — Managed Project foundation')[1] || '';
  check('P01', 'Task priority owner untouched', /PRIORITY_TOKEN_RE/.test(lifecycleSrc));
  check('P02', 'no [p1] priority form in the parser', !/\[p1\]/.test(fs.readFileSync(PARSER_PATH, 'utf8')));
  check('P03', 'Project parser never references mme-task', !/mme-task/.test(fs.readFileSync(PARSER_PATH, 'utf8')));
  check('P04', 'Project parser never imports Task lifecycle', !/MME_TASK_LIFECYCLE/.test(act5a));
  check('P05', 'no Task-to-Project association key introduced', !/mme-task[^]*project=/.test(fs.readFileSync(PARSER_PATH, 'utf8')));
  check('P06', 'Task reconciliation still returns a skip reason', mainSrc.slice(mainSrc.indexOf('function reconcileTasksBeforeSave(')).includes('skippedReason'));
  const src = 'Project: Alibaba [800000 BRL] [27Q3]\n- [ ] ACT 5A Task #p1\n' + managedComment(ID_A, FIXED_TODAY) + '\n';
  const r = reconcile(src, [ID_B]);
  check('P07', 'Project reconciliation adds no Task metadata', !/mme-task/.test(r.text));
  check('P08', 'Project comment stays adjacent to the declaration', r.text.split('\n')[1].startsWith('<!-- mme-project:'));
  check('P09', 'existing Task text untouched', r.text.includes('- [ ] ACT 5A Task #p1'));
  // A Project block must stop at its managed comment so the comment's own
  // key=value segments are never re-read as legacy dictionary pairs.
  check('P11', 'block collection stops at a managed comment', fs.readFileSync(PARSER_PATH, 'utf8').includes('managedCommentLine'));
}

/* ==================== Q. Report-field compatibility ========================= */

group('Q. Report compatibility');
{
  const p = P.parseProjects('Project: ByteDance CCTV, Value: 50000, Currency: usd, Order: 26q4\n', {})[0];
  check('Q01', 'legacy Report grammar still parses', p.name === 'ByteDance CCTV');
  check('Q02', 'legacy value preserved', p.value === 50000);
  check('Q03', 'legacy currency still uppercased', p.currency === 'USD');
  check('Q04', 'legacy order still normalized', p.expectedOrder.canonical === '2026-Q4');
  check('Q05', 'description preserved', P.parseProjects('Project: CCTV Upgrade; Description: CCTV, access control, and monitoring; Value: 75000; Currency: USD', {})[0].description === 'CCTV, access control, and monitoring');
  check('Q06', 'status field still present for Reports', 'status' in p);
  check('Q07', 'extraFields still present for Reports', 'extraFields' in p);
  // ACT 5B-1: Project sourceIdentity is RETIRED. projectId is the only
  // persistent managed identity; sourcePath/sourceLine remain for navigation.
  check('Q08', 'Project sourceIdentity retired', !('sourceIdentity' in p));
  check('Q08b', 'sourcePath/sourceLine preserved for navigation', 'sourcePath' in p && 'sourceLine' in p);
  check('Q09', 'description default preserved', P.parseProjects('Project: X', {})[0].description === '');
  check('Q10', 'unknown legacy fields preserved', P.parseProjects('Project: X\nProbability: 70', {})[0].extraFields.probability === '70');
  check('Q11', 'zero value still present for Report filtering', P.parseProjects('Project: Zero\nValue: 0\nCurrency: USD', {})[0].value === 0);
  const reportSrc = fs.readFileSync(path.join(ROOT, 'js', 'report', 'report-dictionary.js'), 'utf8');
  // ACT 5B-1: the Report dictionary now carries projectId INTERNALLY.
  check('Q12', 'Report dictionary carries projectId internally', /projectId/.test(reportSrc));
  check('Q12b', 'Report dictionary never renders projectId', !/\\$\\{[^}]*projectId/.test(reportSrc) && !/projectId[^\n]*\\$\\{/.test(reportSrc));
  check('Q13', 'Report zero-vs-missing semantics still intact', reportSrc.includes('Number.isFinite'));
}

/* ================ R/S/T. no write-on-scan, no Package 4, version ============ */

group('R/S/T. purity, Package 4 absence, version identity');
{
  const parserSrc = fs.readFileSync(PARSER_PATH, 'utf8');
  const pureSrc = parserSrc.slice(parserSrc.indexOf('function reconcileManagedProjects('), parserSrc.indexOf('// Expose the parser API.'));
  const parseSrc = parserSrc.slice(parserSrc.indexOf('function parseProjects('), parserSrc.indexOf('ACT 5A — Pure Project reconciliation owner'));
  check('R01', 'parser never writes', !/createWritable|showSaveFilePicker|saveSmart|scheduleWorkspaceIndexRebuild|buildWorkspaceIndex/.test(parseSrc));
  check('R02', 'pure owner never reads the wall clock', !/new Date\(\)|Date\.now|getLocalIsoDate/.test(pureSrc));
  check('R03', 'pure owner never writes a file', !/createWritable|\.write\(|saveSmart/.test(pureSrc));
  check('R04', 'pure owner never accesses currentSaveHandle', !/currentSaveHandle/.test(pureSrc));
  check('R05', 'pure owner never mutates the Index', !/scheduleWorkspaceIndexRebuild|buildWorkspaceIndex/.test(pureSrc));
  check('R06', 'pure owner never renders UI', !/innerHTML|showToast|render\(/.test(pureSrc));
  check('R07', 'pure owner never touches Tasks', !/task/i.test(pureSrc));
  check('R08', 'pure owner never opens handles', !/FileSystemFileHandle|queryPermission/.test(pureSrc));
  check('R09', 'no write during scan', !/write\(/.test(parseSrc));

  const mainSrc = fs.readFileSync(MAIN_PATH, 'utf8');
  const orchSrc = mainSrc.slice(mainSrc.indexOf('function reconcileProjectsBeforeSave('), mainSrc.indexOf('function logProjectReconcileSuccess('));
  check('R10', 'reconciler opens no handles', !/createWritable|currentSaveHandle\s*=|activateWritableHandle/.test(orchSrc));
  check('R11', 'reconciler does not rebuild the Index', !/scheduleWorkspaceIndexRebuild|buildWorkspaceIndex/.test(orchSrc));
  check('R12', 'reconciler does not refresh Task baselines', !/captureTaskBaseline/.test(orchSrc));
  check('R13', 'reconciler does not mark the document clean', !/dirty\s*=\s*false/.test(orchSrc));
}
{
  const mainSrc = fs.readFileSync(MAIN_PATH, 'utf8');
  check('S01', 'Package 4 runtime absent (no module dir)', !fs.existsSync(path.join(ROOT, 'js', 'standalone')));
  check('S02', 'no Package 4 markers in main.js', !/standalone-note|StandaloneNote/i.test(mainSrc));
  check('S03', 'no Package 4 script tag in index.html', !/src=[^>]*standalone/i.test(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')));
}
{
  const swSrc = fs.readFileSync(SW_PATH, 'utf8');
  check('T01', 'APP_VERSION unchanged', swSrc.includes("const APP_VERSION = 'markmap-journal-pwa-0.6.3-tasks-wiki-links-foundation';"));
  check('T02', 'cache identity unchanged', swSrc.includes('const APP_CACHE = `${APP_VERSION}-app`;'));
  check('T03', 'no ACT 5A cache identity introduced', !/5a|managed-project/i.test(swSrc));
  const releaseSrc = fs.readFileSync(path.join(ROOT, 'js', 'release', 'release.js'), 'utf8');
  check('T04', 'productVersion still 0.6.3', /productVersion\s*:\s*'0\.6\.3'/.test(releaseSrc));
  check('T07', 'cacheIdentity unchanged', /cacheIdentity\s*:\s*'markmap-journal-pwa-0\.6\.3-tasks-wiki-links-foundation'/.test(releaseSrc));
  check('T05', 'no ## Project: heading grammar introduced', !/^## Project:/m.test(fs.readFileSync(PARSER_PATH, 'utf8')));
  check('T06', '## Project: heading is behaviorally not a declaration', P.parseProjects('## Project: NotAProject\n', {}).length === 0);
}

/* ============================== diagnostics bound =========================== */

group('Diagnostics bounds');
{
  const many = Array.from({ length: 50 }, (_, i) => 'Project: P' + i + ' [1,200,000 USD]').join('\n');
  const r = reconcile(many, [ID_A]);
  check('D-B01', 'diagnostics are bounded', r.diagnostics.length <= 50);
  check('D-B02', 'diagnostics are deterministic', JSON.stringify(reconcile(many, [ID_A]).diagnostics) === JSON.stringify(r.diagnostics));
  check('D-B03', 'diagnostics are location-aware', r.diagnostics.every((d) => typeof d.line === 'number'));
  check('D-B04', 'malformed declarations are not rewritten by diagnostics', many.split('\n').every((l) => r.text.includes(l)));
  check('D-B05', 'many Projects per file handled safely', P.parseProjects(many, {}).length === 50);
  check('D-B06', 'diagnostics deduplicated per Project', (() => { const d = reconcile('Project: A [1,200,000 USD]\n', [ID_A]).diagnostics; return d.length === new Set(d.map((x) => x.code + '@' + x.line)).size; })());
}

/* ---------------------------------- report --------------------------------- */

let passed = 0;
let failed = 0;
let groupCount = 0;
const failures = [];
for (const r of results) {
  if (r.id === undefined) { groupCount += 1; continue; }
  if (r.ok) passed += 1;
  else { failed += 1; failures.push(r); }
}

console.log('ACT 5A — Managed Project contract validators');
console.log('='.repeat(62));
for (const r of results) {
  if (r.id === undefined) { console.log('\n[' + r.group + ']'); continue; }
  console.log('  ' + (r.ok ? 'PASS' : 'FAIL') + '  ' + r.id.padEnd(10) + ' ' + r.name + (r.ok || !r.detail ? '' : '  <- ' + r.detail));
}
console.log('='.repeat(62));
console.log('groups=' + groupCount + ' passed=' + passed + ' failed=' + failed + ' total=' + (passed + failed));
if (failed) {
  console.log('\nRESULT: FAIL');
  process.exit(1);
}
console.log('\nRESULT: PASS');
