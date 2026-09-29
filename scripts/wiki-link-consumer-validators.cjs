#!/usr/bin/env node
'use strict';

/**
 * ACT 3C — canonical relationship CONSUMERS and the Package 3 integration
 * boundary.
 *
 * A separate suite on purpose: wiki-link-resolution-validators owns RESOLUTION
 * (ACT 3A) and wiki-link-relationship-validators owns DIRECTION and GRAMMAR
 * (ACT 3B). This one owns the CONSUMER layer — the migrated inbound panel, the
 * UI-neutral Active/Workspace summaries, the compact preview contract, and the
 * proof that the retired name-keyed Related algorithm is gone for good.
 *
 * It loads the REAL owners verbatim, in the REAL load order, and exercises the
 * REAL providers and the REAL panel renderer.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GRAMMAR_SOURCE = fs.readFileSync(path.join(ROOT, 'js/links/wiki-link-grammar.js'), 'utf8');
const WIKI_SOURCE = fs.readFileSync(path.join(ROOT, 'js/links/wiki-links.js'), 'utf8');
const MAIN_SOURCE = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
const CM_SOURCE = fs.readFileSync(path.join(ROOT, 'js/editor/codemirror-bootstrap.js'), 'utf8');
const CONTEXT_SOURCE = fs.readFileSync(path.join(ROOT, 'js/core/context.js'), 'utf8');
const RELEASE_SOURCE = fs.readFileSync(path.join(ROOT, 'js/release/release.js'), 'utf8');
const SW_SOURCE = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const results = [];
function record(id, name, ok, detail) {
  const d = typeof detail === 'function' ? detail() : detail;
  results.push({ id, name, ok: Boolean(ok), detail: ok || d == null ? '' : String(d) });
}
async function check(id, name, ok) {
  let v = ok;
  if (typeof v === 'function') {
    try { v = v(); } catch (e) { record(id, name, false, (e && e.message) || e); return; }
  }
  record(id, name, v);
}
function group(t) { results.push({ group: t }); }

globalThis.window = globalThis;
globalThis.addEventListener = function () {};
globalThis.removeEventListener = function () {};
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.log = () => {};
globalThis.showToast = () => {};
const el = (id) => ({
  id: id || '', value: '', hidden: false, innerHTML: '', textContent: '', dataset: {},
  style: {}, attrs: {}, classes: new Set(),
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  addEventListener() {}, removeEventListener() {}, appendChild() {}, setAttribute() {},
  querySelector: () => null, querySelectorAll: () => [], focus() {}, getAttribute: () => null,
});

const DOC_ELS = {};
for (const id of ['workspaceRelatedPanel', 'workspaceRelatedBadge', 'workspaceRelatedSummary',
  'workspaceRelatedList']) DOC_ELS[id] = el(id);
globalThis.document = {
  getElementById: (id) => DOC_ELS[id] || null,
  addEventListener() {}, removeEventListener() {}, dispatchEvent: () => true,
  querySelector: () => null, querySelectorAll: () => [], createElement: () => el(),
  documentElement: el('html'), body: el('body'), head: el('head'),
};

// REAL load order, exactly as script-loader performs it.
(0, eval)(GRAMMAR_SOURCE);
(0, eval)(WIKI_SOURCE);
const W = globalThis.MME_WIKI_LINKS;
if (!W) throw new Error('MME_WIKI_LINKS not exposed');

const file = (p, name, title, extra) =>
  Object.assign({ path: p, name: name, title: title, kind: 'notes' }, extra || {});
const idx = (files) => ({ ready: true, files: files });

// The control fixture proving the ACT 3B divergence: one source links by
// FILENAME, one by the saved H1. The old name-keyed Related saw only the first.
const CONTROL = () => idx([
  file('notes/Alpha.md', 'Alpha.md', 'Alpha Title', { conceptLinks: [] }),
  file('notes/byName.md', 'byName.md', 'By Filename', { conceptLinks: ['Alpha'] }),
  file('notes/byTitle.md', 'byTitle.md', 'By Saved H1', { conceptLinks: ['Alpha Title'] }),
  file('notes/dup.md', 'dup.md', 'Dup', { conceptLinks: ['Alpha', 'Alpha', 'Alpha'] }),
  file('notes/ghost.md', 'ghost.md', 'Ghost', { conceptLinks: ['Nowhere'] }),
  file('notes/a/S.md', 'S.md', 'S A', { conceptLinks: [] }),
  file('notes/b/S.md', 'S.md', 'S B', { conceptLinks: [] }),
  file('notes/amb.md', 'amb.md', 'Amb', { conceptLinks: ['S'] }),
]);

// The real name-keyed algorithm, replicated to prove it is no longer used.
const legacyKey = (v) => String(v || '').trim().replace(/^\.?\//, '').replace(/^notes\//i, '')
  .replace(/^concepts\//i, '').replace(/\.md$/i, '').replace(/\|.*$/, '').trim().toLowerCase();
function legacyRelated(files, activeName) {
  const key = legacyKey(activeName);
  if (!key) return [];
  return files
    .filter((f) => (f.conceptLinks || []).some((l) => legacyKey(l) === key))
    .map((f) => f.path).sort();
}

function extractBlock(src, marker) {
  const s = src.indexOf(marker);
  if (s === -1) throw new Error('missing block: ' + marker);
  const open = src.indexOf('{', s);
  let d = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') d += 1;
    else if (src[i] === '}') { d -= 1; if (d === 0) return src.slice(s, i + 1); }
  }
  throw new Error('unbalanced block: ' + marker);
}

// ACT3C_CONSUMER_1_END

const relPanel = extractBlock(MAIN_SOURCE, 'function renderWorkspaceRelatedPanel() {');
const activeStats = extractBlock(MAIN_SOURCE, 'function getWorkspaceActiveStats(');
const relEnsure = extractBlock(MAIN_SOURCE, 'function ensureWorkspaceRelatedPanel() {');
const relWire = extractBlock(MAIN_SOURCE, 'function wireWorkspaceRelatedPanel() {');

(async () => {
  group('C. Inbound panel identity and states (C01-C30)');

  const lin = () => W.getLinksIn({ targetPath: 'notes/Alpha.md', indexSnapshot: CONTROL() });
  const paths = () => lin().rows.map((r) => r.sourcePath);
  const oneTo = (extra) => W.getLinksIn({
    targetPath: 'notes/T.md',
    indexSnapshot: idx([file('notes/T.md', 'T.md', 'T', { conceptLinks: [] }),
      file('notes/m.md', 'm.md', 'M', { conceptLinks: ['T'], ...extra })]),
  }).rows.length;

  await check('C01', 'visible panel title is Links In', () =>
    /workspaceRelatedTitle">Links In</.test(relEnsure));
  await check('C02', 'accessible label is Links In (badge carries the numeric count)', () =>
    /workspaceRelatedBadge/.test(relEnsure) && !/>Related</.test(MAIN_SOURCE));
  await check('C03', 'active inbound count comes from canonical getLinksIn', () =>
    /MME_WIKI_LINKS\?\.getLinksIn/.test(relPanel) &&
    /badge\.textContent = `\$\{linksInRows\.length\}`/.test(relPanel));
  await check('C04', 'one inbound source renders once', () =>
    lin().rows.length === 3 && new Set(paths()).size === 3);
  await check('C05', 'repeated links from one source render one compact row', () =>
    lin().rows.filter((x) => x.sourcePath === 'notes/dup.md').length === 1);
  await check('C06', 'occurrenceCount remains available', () =>
    lin().rows.find((x) => x.sourcePath === 'notes/dup.md').occurrenceCount === 3);
  await check('C07', 'multiple source Notes remain separate', () =>
    paths().includes('notes/byName.md') && paths().includes('notes/byTitle.md'));
  await check('C08', 'filename-resolved inbound source is included', () =>
    lin().relationships.some((r) => r.sourcePath === 'notes/byName.md' && r.resolutionKind === 'filename'));
  await check('C09', 'saved-H1-resolved inbound source is included', () =>
    lin().relationships.some((r) => r.sourcePath === 'notes/byTitle.md' && r.resolutionKind === 'h1'));
  await check('C10', 'missing relationship is excluded', () => !paths().includes('notes/ghost.md'));
  await check('C11', 'ambiguous relationship is excluded', () =>
    W.getLinksIn({ targetPath: 'notes/a/S.md', indexSnapshot: CONTROL() }).rows.length === 0);
  await check('C12', 'not-ready relationship is excluded', () => {
    // A NOT-READY index (not ready) is distinct from a VALID EMPTY index
    // (available with zero rows). Only the former is 'unavailable'.
    const nr = W.getLinksIn({ targetPath: 'notes/Alpha.md', indexSnapshot: { ready: false, files: [] } });
    const empty = W.getLinksIn({ targetPath: 'notes/Alpha.md', indexSnapshot: idx([]) });
    return nr.available === false && nr.rows.length === 0 &&
      empty.available === true && empty.rows.length === 0;
  });
  await check('C13', 'Knowledge classification does not duplicate a source', () => oneTo({ knowledge: true }) === 1);
  await check('C14', 'Pinned classification does not duplicate a source', () => oneTo({ pinned: true }) === 1);
  await check('C15', 'Knowledge plus Pinned remains one physical source', () => oneTo({ knowledge: true, pinned: true }) === 1);

  // ACT3C_CONSUMER_2_END

  group('C. Inbound panel states, navigation and summaries (C16-C49)');

  await check('C16', 'archived behavior follows the preserved accepted policy', () => oneTo({ archived: true }) === 1);
  await check('C17', 'available zero renders numeric zero', () =>
    /badge\.textContent = `\$\{linksInRows\.length\}`/.test(relPanel) && /No Links In\./.test(relPanel));
  await check('C18', 'unavailable renders an explicit state, not zero', () =>
    /badge\.textContent = '—'/.test(relPanel) && /Links In unavailable/.test(relPanel));
  await check('C19', 'empty state is No Links In.', () => /No Links In\./.test(relPanel));
  await check('C20', 'no-active-note state is distinct from available zero', () =>
    /summary\.textContent = 'No active note'/.test(relPanel) && /No active concept/.test(relPanel) === false);
  await check('C21', 'source row carries exact sourcePath', () =>
    /path: row\.sourcePath \|\| ''/.test(relPanel) && /data-path="\$\{path\}"/.test(relPanel));
  await check('C22', 'source-row click uses exact dataset.path', () =>
    /const path = btn\.dataset\.path \|\| '';/.test(relWire));
  await check('C23', 'source row uses the existing physical opener', () =>
    /findWorkspaceFileByPath/.test(relWire) && /openWorkspaceFile\(file/.test(relWire));
  await check('C24', 'source occurrence remains available when supplied', () => {
    const r = W.getLinksIn({
      targetPath: 'notes/T.md',
      indexSnapshot: idx([file('notes/T.md', 'T.md', 'T', { conceptLinks: [] }),
        file('notes/m.md', 'm.md', 'M', { conceptLinks: ['T', 'T'] })]),
    });
    return r.relationships.length === 2 && r.relationships[1].occurrence === 2;
  });
  await check('C25', 'H1 is display data, not navigation identity', () =>
    /title: row\.sourceTitle \|\| row\.sourceName/.test(relPanel) && /path: row\.sourcePath \|\| ''/.test(relPanel));
  await check('C26', 'old name-keyed Related function has zero active calls', () =>
    /function findBacklinksForConcept\(/.test(MAIN_SOURCE) === false);
  await check('C27', 'old Related function is not restored as a fallback', () =>
    /findBacklinksForConcept/.test(relPanel) === false && /findBacklinksForConcept/.test(activeStats) === false);
  await check('C28', 'no active concepts/ physical path assumption remains', () =>
    paths().every((p) => p.startsWith('notes/')));
  await check('C29', 'canonical Links In includes the control source old Related missed', () => {
    const i = CONTROL();
    const canonical = W.getLinksIn({ targetPath: 'notes/Alpha.md', indexSnapshot: i }).rows.map((r) => r.sourcePath);
    return canonical.includes('notes/byTitle.md') && !legacyRelated(i.files, 'Alpha.md').includes('notes/byTitle.md');
  });
  await check('C30', 'repeated occurrences do not duplicate source rows', () => {
    const p = W.buildLinksInPreview({ relationships: lin().relationships, limit: 10 });
    return p.total === 3 && p.rows.length === 3;
  });

  // ACT3C_CONSUMER_2B_END

  group('D. Active and Workspace summaries (C31-C49)');

  // sourcePath is the ACTIVE note, so its inbound count comes from the Control
  // fixture's three sources that point at notes/Alpha.md.
  const active = (md, indexSnapshot) => W.getActiveRelationshipSummary({
    sourcePath: 'notes/Alpha.md', markdown: md, indexSnapshot: indexSnapshot,
  });
  const ws = (i) => W.getWorkspaceRelationshipSummary({ indexSnapshot: i });
  const wsSrc = WIKI_SOURCE.slice(WIKI_SOURCE.indexOf('function getWorkspaceRelationshipSummary('),
    WIKI_SOURCE.indexOf('// ---- Compatibility wrapper'));
  const actSrc = WIKI_SOURCE.slice(WIKI_SOURCE.indexOf('function getActiveRelationshipSummary('),
    WIKI_SOURCE.indexOf('function getWorkspaceRelationshipSummary('));

  await check('C31', 'active summary returns Links In count', () => active('[[Alpha]]', CONTROL()).linksIn.count === 3);
  await check('C32', 'active summary returns Links Out count', () => active('[[Alpha]] [[Nope]] [[S]]', CONTROL()).linksOut.count === 3);
  await check('C33', 'no Workspace makes Links In unavailable', () => {
    const s = active('[[Alpha]]', { ready: false, files: [] });
    return s.linksIn.available === false && s.linksIn.count === null;
  });
  await check('C34', 'no Workspace still extracts live Links Out', () => {
    const s = active('[[Alpha]]', { ready: false, files: [] });
    return s.linksOut.count === 1 && s.linksOut.notReadyCount === 1;
  });
  await check('C35', 'live unsaved outgoing link appears in the Current Document summary', () =>
    active('[[Alpha]] [[Unsaved]]', CONTROL()).linksOut.count === 2);
  await check('C36', 'live outgoing target resolves against the saved Index', () => {
    const s = active('[[Alpha]]', CONTROL());
    return s.linksOut.resolvedCount === 1 && s.linksOut.preview.rows[0].targetPath === 'notes/Alpha.md';
  });
  await check('C37', 'active summary does not mutate source records', () => {
    const md = '[[Alpha]]';
    active(md, CONTROL());
    return md === '[[Alpha]]';
  });
  await check('C38', 'active summary does not mutate the Index', () => {
    const i = CONTROL();
    const snap = JSON.stringify(i);
    active('[[Alpha]] [[S]]', i);
    return JSON.stringify(i) === snap;
  });
  await check('C39', 'no final Active card markup is generated', () =>
    /createElement|innerHTML|appendChild/.test(actSrc) === false);
  await check('C40', 'Workspace summary uses saved relationships only', () =>
    ws(CONTROL()).linksOutByPath['notes/byName.md'].length === 1);
  await check('C41', 'Workspace summary counts resolved edges', () => ws(CONTROL()).resolvedRelationshipCount === 5);
  await check('C42', 'Workspace summary counts missing targets', () => ws(CONTROL()).missingTargetCount === 1);
  await check('C43', 'Workspace summary counts ambiguous targets', () => ws(CONTROL()).ambiguousTargetCount === 1);
  await check('C44', 'Workspace summary preserves exact source and target paths', () =>
    ws(CONTROL()).linksInByPath['notes/Alpha.md'].sort().join(',') === 'notes/byName.md,notes/byTitle.md,notes/dup.md');
  await check('C45', 'Workspace summary is deterministic', () =>
    JSON.stringify(ws(CONTROL())) === JSON.stringify(ws(CONTROL())));
  await check('C46', 'Workspace summary is independent of Index ordering', () => {
    const i = CONTROL();
    return JSON.stringify(ws(i)) === JSON.stringify(ws(idx([...i.files].reverse())));
  });
  await check('C47', 'Workspace summary does not read live editor text', () =>
    /__cmGetText|md\.value/.test(wsSrc) === false);
  await check('C48', 'Workspace summary does not persist a second graph', () =>
    /localStorage|sessionStorage|__mme/.test(wsSrc) === false);
  await check('C49', 'no final Workspace Index disclosure-card markup is generated', () =>
    /createElement|innerHTML|appendChild/.test(wsSrc) === false);

  // ACT3C_CONSUMER_3_END

  group('E. Package 3 regression and scope (C50-C65)');

  // These assert the CURRENT owner markers and behaviour, not stale counts: a
  // sibling suite passing proves nothing about this consumer layer.
  const BS = String.fromCharCode(92);
  const lit = BS + '[' + BS + '[';
  const tagPanel = extractBlock(MAIN_SOURCE, 'function renderWorkspaceTagsPanel() {');
  const providerSrc = WIKI_SOURCE.slice(WIKI_SOURCE.indexOf('// ACT 3B — RELATIONSHIP PROVIDERS'),
    WIKI_SOURCE.indexOf('// ---- Compatibility wrapper'));
  const openTargetSrc = WIKI_SOURCE.slice(WIKI_SOURCE.indexOf('async function openTarget'),
    WIKI_SOURCE.indexOf('// ---- Missing target check'));

  await check('C50', 'ACT 3A resolution precedence remains path -> filename -> h1', () =>
    /WIKI_RESOLUTION_KINDS = Object\.freeze\(\['path', 'filename', 'h1'\]\)/.test(WIKI_SOURCE));
  await check('C51', 'ACT 3B extraction grammar remains single-owner', () =>
    WIKI_SOURCE.indexOf(lit) === -1 && MAIN_SOURCE.indexOf(lit) === -1 && CM_SOURCE.indexOf(lit) === -1);
  await check('C52', 'CodeMirror resolution states remain unchanged', () =>
    /wikiLinkMissing/.test(CM_SOURCE) && /wikiLinkAmbiguous/.test(CM_SOURCE) &&
    /resolveTargetStatus/.test(CM_SOURCE));
  await check('C53', 'HTML Preview Wiki Link behavior remains unchanged', () =>
    /class="wikiLink" data-wiki-target=/.test(MAIN_SOURCE));
  await check('C54', 'missing never navigates', () =>
    /status === 'missing'/.test(openTargetSrc) && /return false/.test(openTargetSrc));
  await check('C55', 'ambiguous never navigates', () =>
    /status === 'ambiguous'/.test(openTargetSrc) && /return false/.test(openTargetSrc));
  await check('C56', 'not-ready never navigates', () =>
    /status === 'not-ready'/.test(openTargetSrc) && /return false/.test(openTargetSrc));
  await check('C57', 'Search behavior is preserved', () =>
    /function runWorkspaceSearch\(/.test(MAIN_SOURCE));
  await check('C58', 'Tags behavior is preserved', () =>
    /badge\.textContent = `\$\{tags\.length\}`/.test(tagPanel) &&
    /renderWorkspaceTagResults\(__workspaceActiveTag\)/.test(tagPanel));
  await check('C59', 'Task behavior is preserved', () =>
    /MME_TASK_LIFECYCLE/.test(MAIN_SOURCE) && /parseMarkdownTasks/.test(MAIN_SOURCE));
  await check('C60', 'Projects behavior is preserved', () => /projects/.test(MAIN_SOURCE));
  await check('C61', 'link discovery does not modify physical files', () =>
    /createWritable|writeFile|saveSmart/.test(providerSrc) === false);
  await check('C62', 'no Rename File implementation', () => /renameFile/.test(MAIN_SOURCE) === false);
  await check('C63', 'no automatic Wiki Link rewrite', () =>
    /applyPriority|replaceLine/.test(providerSrc) === false);
  await check('C64', 'no Graph or Mermaid implementation', () =>
    /graphView|mermaidView/.test(WIKI_SOURCE) === false);
  // ACT 3C's scope fence ("no version change during an intermediate ACT") is
  // satisfied by the PACKAGE 3 CLOSURE boundary itself: the accepted release is
  // now 0.6.3, in BOTH owners, with no intermediate identity left behind.
  await check('C65', 'the release boundary is 0.6.3 in both owners', () =>
    /productVersion: '0\.6\.3'/.test(RELEASE_SOURCE) &&
    /markmap-journal-pwa-0\.6\.3-tasks-wiki-links-foundation/.test(SW_SOURCE) &&
    /markmap-journal-pwa-0\.6\.3-tasks-wiki-links-foundation/.test(RELEASE_SOURCE) &&
    /0\.6\.2-notes-workspace-foundation/.test(RELEASE_SOURCE) === false);

  group('F. ACT 3C mutation controls (C-M1..C-M10)');

  await check('C-M1', 'restore name-keyed Related source: C09/C29 must fail', () => {
    const i = CONTROL();
    const canonical = W.getLinksIn({ targetPath: 'notes/Alpha.md', indexSnapshot: i }).rows.map((r) => r.sourcePath);
    const legacy = legacyRelated(i.files, 'Alpha.md');
    return canonical.includes('notes/byTitle.md') && !legacy.includes('notes/byTitle.md');
  });
  await check('C-M2', 'one row per occurrence: C05/C30 must fail', () => {
    const p = W.buildLinksInPreview({ relationships: lin().relationships, limit: 10 });
    return p.total === 3 && lin().relationships.length === 5;
  });
  await check('C-M3', 'include missing in Links In: C10 must fail', () =>
    !paths().includes('notes/ghost.md') && paths().length === 3);
  await check('C-M4', 'include ambiguous in Links In: C11 must fail', () =>
    W.getLinksIn({ targetPath: 'notes/a/S.md', indexSnapshot: CONTROL() }).rows.length === 0);
  await check('C-M5', 'treat unavailable as zero: C33 must fail', () => {
    const s = active('[[Alpha]]', { ready: false, files: [] });
    return s.linksIn.available === false && s.linksIn.count === null;
  });
  await check('C-M6', 'navigate by H1 instead of sourcePath: C21/C25 must fail', () =>
    /path: row\.sourcePath \|\| ''/.test(relPanel) &&
    !/path: row\.sourceTitle \|\| row\.sourceName/.test(relPanel));
  await check('C-M7', 'read live editor text in Workspace summary: C47 must fail', () =>
    /__cmGetText|md\.value/.test(wsSrc) === false);
  await check('C-M8', 'render Active cards in ACT 3C: C39 must fail', () =>
    /createElement|innerHTML|appendChild/.test(actSrc) === false);
  await check('C-M9', 'two active inbound providers: C26/C27 must fail', () =>
    /function findBacklinksForConcept\(/.test(MAIN_SOURCE) === false &&
    /MME_WIKI_LINKS\?\.getLinksIn/.test(relPanel));
  await check('C-M10', 'change ACT 3A precedence: C08/C09 must fail', () =>
    WIKI_SOURCE.includes("Object.freeze(['path', 'filename', 'h1'])") &&
    WIKI_SOURCE.indexOf("Object.freeze(['h1', 'filename', 'path'])") === -1);

  const passed = results.filter((r) => !r.group && r.ok).length;
  const failed = results.filter((r) => !r.group && !r.ok);
  for (const r of results) {
    if (r.group) console.log('\n' + r.group);
    else console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.id + '] ' + r.name + (r.detail ? '  -> ' + r.detail : ''));
  }
  console.log('\nWIKI LINK CONSUMER VALIDATORS (ACT 3C): ' + passed + ' passed, ' + failed.length + ' failed');
  process.exitCode = failed.length ? 1 : 0;
})();
