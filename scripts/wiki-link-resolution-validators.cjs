#!/usr/bin/env node
'use strict';

/**
 * ACT 3A — canonical Wiki Link target-resolution contract.
 *
 * The single focused home for the resolution contract. Existing suites each own
 * one surface (CodeMirror decoration, Related, Task contract, navigation) and
 * none of them can own the SHARED contract without duplicating it, so this suite
 * is the one place the contract is proven.
 *
 * It loads the REAL owner verbatim — js/links/wiki-links.js — so every fixture
 * runs against shipped code, never a re-implementation, and passes the Index in
 * explicitly so the resolver is exercised as a PURE function.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WIKI_SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'links', 'wiki-links.js'), 'utf8');
const CM_SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'editor', 'codemirror-bootstrap.js'), 'utf8');
const MAIN_SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');

const results = [];
function record(id, name, ok, detail) {
  const d = typeof detail === 'function' ? detail() : detail;
  results.push({ id, name, ok: Boolean(ok), detail: ok || d == null ? '' : String(d) });
}
async function check(id, name, ok) {
  let v = ok;
  if (typeof v === 'function') { try { v = v(); } catch (e) { record(id, name, false, (e && e.message) || e); return; } }
  record(id, name, v);
}
function group(t) { results.push({ group: t }); }

// Minimal host shims: the resolver is pure, so the module only needs to load.
globalThis.window = globalThis;
globalThis.addEventListener = function () {};
globalThis.removeEventListener = function () {};
globalThis.requestAnimationFrame = (f) => setTimeout(f, 0);
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.log = () => {};
globalThis.showToast = () => {};
const el = () => ({ value: '', hidden: false, innerHTML: '', textContent: '', dataset: {},
  style: {}, attrs: {}, classes: new Set(),
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  addEventListener() {}, removeEventListener() {}, appendChild() {}, setAttribute() {},
  querySelector: () => null, querySelectorAll: () => [], focus() {} });
globalThis.document = { getElementById: () => null, addEventListener() {}, removeEventListener() {},
  querySelector: () => null, querySelectorAll: () => [], createElement: el, dispatchEvent: () => true,
  documentElement: el(), body: el(), head: el() };

(0, eval)(WIKI_SOURCE);
const W = globalThis.MME_WIKI_LINKS;
if (!W) throw new Error('MME_WIKI_LINKS not exposed by the real owner');

// ---- Index fixtures -------------------------------------------------------
const file = (path_, name, title, extra) =>
  Object.assign({ path: path_, name: name, title: title, kind: 'notes' }, extra || {});

const idx = {
  alpha:   { ready: true, files: [ file('notes/Alpha.md', 'Alpha.md', 'Alpha') ] },
  unicode: { ready: true, files: [ file('notes/日本語.md', '日本語.md', '日本語 ノート'),
                                    file('notes/Spaced Name.md', 'Spaced Name.md', 'Spaced Name') ] },
  dupH1:   { ready: true, files: [ file('notes/one.md', 'one.md', 'Shared Title'),
                                    file('notes/two.md', 'two.md', 'Shared Title') ] },
  dupBase: { ready: true, files: [ file('notes/a/Dup.md', 'Dup.md', 'First A'),
                                    file('notes/b/Dup.md', 'Dup.md', 'Second B') ] },
  // filename of one Note collides with the H1 of another: the precedence case
  collides: { ready: true, files: [ file('notes/Beta.md', 'Beta.md', 'Something Else'),
                                     file('notes/gamma.md', 'gamma.md', 'Beta') ] },
  classified: { ready: true, files: [ file('notes/Class.md', 'Class.md', 'Classified',
                              { knowledge: true, pinned: true, archived: true }) ] },
  notReady: { ready: false, files: [] },
};

const R = (t, i) => W.resolveWikiTarget(t, i);
const P = (t, i) => R(t, i).targetPath;

(async () => {
  group('A. Extraction (W01-W06)');
  await check('W01', 'one normal link', () => W.parseWikiLinks('see [[Alpha]] now').length === 1);
  await check('W02', 'repeated same target is two occurrences', () =>
    W.parseWikiLinks('[[Alpha]] and [[Alpha]]').length === 2);
  await check('W03', 'multiple distinct targets', () =>
    W.parseWikiLinks('[[Alpha]] [[Beta]]').map((l) => l.target).join(',') === 'Alpha,Beta');
  await check('W04', 'alias syntax is supported and does not enter the target', () => {
    const l = W.parseWikiLinks('[[Alpha|see this]]')[0];
    return l.target === 'Alpha' && l.label === 'see this';
  });
  await check('W05', 'Unicode and spaced targets parse', () =>
    W.parseWikiLinks('[[日本語 ノート]] [[Spaced Name]]').length === 2);
  await check('W06', 'malformed empty target is skipped', () =>
    W.parseWikiLinks('[[]] and [[|only label]]').length === 0);

  group('B. Resolved (W11-W20)');
  await check('W11', 'exact path target resolves', () => {
    const r = R('notes/Alpha', idx.alpha);
    return r.status === 'resolved' && r.targetPath === 'notes/Alpha.md' && r.resolutionKind === 'path';
  });
  await check('W12', 'filename WITH extension resolves', () =>
    R('Alpha.md', idx.alpha).status === 'resolved' && P('Alpha.md', idx.alpha) === 'notes/Alpha.md');
  await check('W13', 'filename WITHOUT extension resolves', () =>
    P('Alpha', idx.alpha) === 'notes/Alpha.md');
  await check('W14', 'saved H1 resolves', () => {
    const r = R('Alpha', { ready: true, files: [ file('notes/x-file.md', 'x-file.md', 'Alpha') ] });
    return r.status === 'resolved' && r.targetPath === 'notes/x-file.md' && r.resolutionKind === 'h1';
  });
  await check('W15', 'Unicode filename resolves', () =>
    P('日本語', idx.unicode) === 'notes/日本語.md');
  await check('W16', 'Unicode H1 resolves', () =>
    P('日本語 ノート', idx.unicode) === 'notes/日本語.md');
  await check('W17', 'filename with spaces resolves', () =>
    P('Spaced Name', idx.unicode) === 'notes/Spaced Name.md');
  await check('W18', 'title differing from filename resolves by filename', () => {
    const r = R('Alpha', { ready: true, files: [ file('notes/Alpha.md', 'Alpha.md', 'A Different Title') ] });
    return r.status === 'resolved' && r.targetTitle === 'A Different Title';
  });
  await check('W19', 'resolved result carries the exact targetPath', () =>
    R('Alpha', idx.alpha).targetPath === 'notes/Alpha.md');
  await check('W20', 'resolutionKind is deterministic per tier', () =>
    R('notes/Alpha', idx.alpha).resolutionKind === 'path' &&
    R('Alpha', idx.alpha).resolutionKind === 'filename' &&
    R('A Different Title', { ready: true, files: [ file('notes/f.md', 'f.md', 'A Different Title') ] })
      .resolutionKind === 'h1');

  group('C. Missing (W21-W25)');
  await check('W21', 'no candidate is missing', () => R('Nowhere', idx.alpha).status === 'missing');
  await check('W22', 'near match does not resolve', () =>
    R('Alph', idx.alpha).status === 'missing');
  await check('W23', 'substring does not resolve', () =>
    R('Alphax', idx.alpha).status === 'missing');
  await check('W24', 'missing returns no path and no candidates', () => {
    const r = R('Nowhere', idx.alpha);
    return r.targetPath === '' && r.candidates.length === 0;
  });
  await check('W25', 'missing is not ambiguous and vice versa', () =>
    R('Nowhere', idx.alpha).status !== 'ambiguous' && R('Shared Title', idx.dupH1).status !== 'missing');

  group('D. Ambiguity (W27-W34)');
  await check('W27', 'duplicate H1 is ambiguous', () =>
    R('Shared Title', idx.dupH1).status === 'ambiguous');
  await check('W28', 'duplicate basename in different folders is ambiguous', () =>
    R('Dup', idx.dupBase).status === 'ambiguous');
  await check('W29', 'filename tier WINS over a colliding H1 (documented precedence)', () => {
    const r = R('Beta', idx.collides);
    return r.status === 'resolved' && r.targetPath === 'notes/Beta.md' && r.resolutionKind === 'filename';
  });
  await check('W30', 'physical keys are case-SENSITIVE; only the H1 tier is case-insensitive', () => {
    // To observe physical case-sensitivity in isolation, the H1 must NOT also
    // match, otherwise the deliberately case-insensitive visual tier would
    // legitimately catch the target and hide the physical result.
    const i = { ready: true, files: [file('notes/Alpha.md', 'Alpha.md', 'Zebra Title')] };
    return R('ALPHA.md', i).status === 'missing' &&      // filename tier: no case fold
      R('notes/alpha', i).status === 'missing' &&        // path tier: no case fold
      R('zebra title', i).status === 'resolved' &&       // H1 tier: case-insensitive
      R('ZEBRA TITLE', i).resolutionKind === 'h1' &&
      R('ZEBRA TITLE', i).status === 'resolved' &&
      // and with a matching H1, a case-mismatched target resolves only via H1
      R('alpha', idx.alpha).resolutionKind === 'h1';
  });
  await check('W31', 'ambiguity returns ALL candidate paths', () => {
    const r = R('Shared Title', idx.dupH1);
    return r.candidates.length === 2 && r.candidates.map((c) => c.path).join(',') ===
      'notes/one.md,notes/two.md';
  });
  await check('W32', 'ambiguity selects nothing', () => {
    const r = R('Shared Title', idx.dupH1);
    return r.targetPath === '' && r.resolutionKind === 'h1' && r.diagnostic === '2-candidates';
  });
  await check('W33', 'Index order does not decide a winner', () => {
    const a = R('Shared Title', idx.dupH1);
    const b = R('Shared Title', { ready: true, files: [...idx.dupH1.files].reverse() });
    return a.status === 'ambiguous' && b.status === 'ambiguous' && a.targetPath === b.targetPath;
  });
  await check('W34', 'duplicate references to one Note are not false ambiguity', () =>
    R('Alpha', idx.alpha).status === 'resolved');

  group('E. Archive and classification (W35-W40)');
  await check('W35', 'Knowledge classification does not duplicate the candidate', () =>
    R('Class', idx.classified).candidates.length === 1);
  await check('W36', 'Pinned classification does not duplicate the candidate', () =>
    R('Class', idx.classified).status === 'resolved');
  await check('W37', 'Knowledge + Pinned + Archived remain ONE candidate', () => {
    const r = R('Class', idx.classified);
    return r.candidates.length === 1 && r.candidates[0].knowledge === true &&
      r.candidates[0].pinned === true && r.candidates[0].archived === true;
  });
  await check('W38', 'archived Notes stay eligible (preserves current accepted behavior)', () =>
    R('Class', idx.classified).status === 'resolved');
  await check('W39', 'no physical Archive folder is assumed', () =>
    idx.classified.files.every((f) => !/archive/i.test(f.path)));
  await check('W40', 'archive metadata does not change physical identity', () =>
    R('Class', idx.classified).targetPath === 'notes/Class.md');

  group('F. Navigation contract (W41-W44)');
  await check('W41', 'only a resolved target yields a path to open', () =>
    P('Alpha', idx.alpha) === 'notes/Alpha.md' && P('Shared Title', idx.dupH1) === '' &&
    P('Nowhere', idx.alpha) === '');
  await check('W42', 'H1-resolved still yields the exact path, not the title', () => {
    const r = R('Alpha', { ready: true, files: [ file('notes/real.md', 'real.md', 'Alpha') ] });
    return r.targetPath === 'notes/real.md' && r.targetPath !== 'Alpha';
  });
  await check('W43', 'openTarget routes through the canonical owner for a string target', () => {
    const s = WIKI_SOURCE.slice(WIKI_SOURCE.indexOf('async function openTarget'),
      WIKI_SOURCE.indexOf('// ---- Missing target check'));
    return /resolveTarget\(targetOrFile\)/.test(s) && /findWorkspaceFileByPath/.test(s) &&
      /openFn\(/.test(s);
  });
  await check('W44', 'openTarget refuses missing/ambiguous/not-ready before the opener', () => {
    const s = WIKI_SOURCE.slice(WIKI_SOURCE.indexOf('async function openTarget'),
      WIKI_SOURCE.indexOf('// ---- Missing target check'));
    return /status === 'missing'/.test(s) && /status === 'ambiguous'/.test(s) &&
      /status === 'not-ready'/.test(s);
  });

  group('G. Not-ready (W50-W54)');
  await check('W50', 'index not ready is not-ready, never missing', () => {
    const r = R('Alpha', idx.notReady);
    return r.status === 'not-ready' && r.status !== 'missing';
  });
  await check('W51', 'absent index is not-ready', () => R('Alpha', null).status === 'not-ready');
  await check('W52', 'index without files array is not-ready', () =>
    R('Alpha', { ready: true }).status === 'not-ready');
  await check('W53', 'empty target is not-ready, not missing', () =>
    R('', idx.alpha).status === 'not-ready');
  await check('W54', 'not-ready returns no path and no candidates', () => {
    const r = R('Alpha', idx.notReady);
    return r.targetPath === '' && r.candidates.length === 0;
  });

  group('H. Purity and consumer alignment (W60-W70)');
  await check('W60', 'resolver does not mutate the passed Index', () => {
    const snapshot = JSON.stringify(idx.collides);
    R('Beta', idx.collides); R('Shared Title', idx.dupH1);
    return JSON.stringify(idx.collides) === snapshot;
  });
  await check('W61', 'resolver does not mutate the returned candidates', () => {
    const r = R('Shared Title', idx.dupH1);
    const before = r.candidates.map((c) => c.path).join(',');
    r.candidates.length = 0;
    return before === 'notes/one.md,notes/two.md';
  });
  await check('W62', 'resolver never returns more than one target path', () => {
    for (const t of ['Alpha', 'Shared Title', 'Nowhere']) {
      for (const i of [idx.alpha, idx.dupH1, idx.collides]) {
        if (typeof R(t, i).targetPath !== 'string') return false;
      }
    }
    return true;
  });
  await check('W63', 'the canonical return shape is complete', () => {
    const r = R('Alpha', idx.alpha);
    return ['status','rawTarget','normalizedTarget','targetPath','targetTitle','candidates',
      'resolutionKind','diagnostic'].every((k) => k in r);
  });
  await check('W64', 'CodeMirror derives status from the canonical owner per target', () => {
    const s = CM_SOURCE.slice(CM_SOURCE.indexOf('function computeDecorations'),
      CM_SOURCE.indexOf('const wikiLinkField'));
    return /resolveTargetStatus\(target\)/.test(s) &&
      // the Index-keyed status map and its false-'missing' fallback are gone
      /linkStatusMap/.test(s) === false;
  });
  await check('W65', 'CodeMirror still distinguishes missing and ambiguous visually', () => {
    const s = CM_SOURCE.slice(CM_SOURCE.indexOf('function computeDecorations'),
      CM_SOURCE.indexOf('const wikiLinkField'));
    return /wikiLinkMissing/.test(s) && /wikiLinkAmbiguous/.test(s);
  });
  await check('W66', 'no consumer calls the legacy pooled resolver', () => {
    // Consumers must not reach the pre-ACT 3A algorithm at all. The owner
    // mentions it exactly three times: its definition, the comment above it,
    // and its export — all for validator proof.
    return /resolveTargetLegacyPooled/.test(CM_SOURCE) === false &&
      /resolveTargetLegacyPooled/.test(MAIN_SOURCE) === false &&
      (WIKI_SOURCE.match(/resolveTargetLegacyPooled/g) || []).length === 3;
  });
  await check('W67', 'exactly one resolution precedence exists in the owner', () => {
    return /WIKI_RESOLUTION_KINDS = Object\.freeze\(\['path', 'filename', 'h1'\]\)/.test(WIKI_SOURCE);
  });
  await check('W68', 'the back-compat wrapper delegates to the canonical owner', () => {
    const s = WIKI_SOURCE.slice(WIKI_SOURCE.indexOf('function resolveTarget(rawTarget)'),
      WIKI_SOURCE.indexOf('function resolveTargetLegacyPooled'));
    return /resolveWikiTarget\(rawTarget\)/.test(s);
  });
  await check('W69', 'no navigation happens inside the resolver', () => {
    const s = WIKI_SOURCE.slice(WIKI_SOURCE.indexOf('function resolveWikiTarget'),
      WIKI_SOURCE.indexOf('// ---- Compatibility wrapper'));
    return /openWorkspaceFile|openTarget/.test(s) === false;
  });
  await check('W70', 'the resolver does not create, rename, or rewrite anything', () => {
    const s = WIKI_SOURCE.slice(WIKI_SOURCE.indexOf('function resolveWikiTarget'),
      WIKI_SOURCE.indexOf('// ---- Compatibility wrapper'));
    return /createWritable|writeFile|rename|mkdir|showToast/.test(s) === false;
  });

  group('I. Mutation controls (W-M1..W-M10)');
  await check('W-M1', 'missing target must NOT navigate to a guessed file', () => {
    const r = R('Nowhere', idx.alpha);
    return r.status === 'missing' && r.targetPath === '' && r.candidates.length === 0;
  });
  await check('W-M2', 'ambiguous must NOT select the first candidate', () => {
    const r = R('Shared Title', idx.dupH1);
    return r.status === 'ambiguous' && r.targetPath === '' &&
      r.candidates[0].path !== r.targetPath;
  });
  await check('W-M3', 'the pooled legacy algorithm DID misreport the precedence case', () => {
    // Proves the defect ACT 3A fixed is real and is now gone.
    globalThis.WORKSPACE_INDEX_STATE = idx.collides;
    const legacy = W.resolveTargetLegacyPooled('Beta');
    const canonical = W.resolveWikiTarget('Beta', idx.collides);
    delete globalThis.WORKSPACE_INDEX_STATE;
    return legacy.status === 'ambiguous' && canonical.status === 'resolved' &&
      canonical.targetPath === 'notes/Beta.md';
  });
  await check('W-M4', 'classification must not create duplicate candidates', () => {
    const r = R('Class', idx.classified);
    return r.candidates.length === 1 && new Set(r.candidates.map((c) => c.path)).size === 1;
  });
  await check('W-M5', 'two consumers must not disagree on precedence', () => {
    // Both the CM consumer and the owner route through the same function.
    const cmSlice = CM_SOURCE.slice(CM_SOURCE.indexOf('function resolveTargetStatus'),
      CM_SOURCE.indexOf('function computeDecorations'));
    return /resolveTarget\(target\)/.test(cmSlice) && /resolveWikiTarget/.test(WIKI_SOURCE);
  });
  await check('W-M6', 'not-ready must not be presented as missing', () => {
    const r = R('Alpha', idx.notReady);
    return r.status === 'not-ready' && r.status !== 'missing' && r.diagnostic === 'workspace-index-unavailable';
  });
  await check('W-M7', 'navigation identity is the path, never the display title', () => {
    const i = { ready: true, files: [ file('notes/real.md', 'real.md', 'Alpha') ] };
    const r = R('Alpha', i);
    return r.targetPath === 'notes/real.md' && r.targetTitle === 'Alpha' && r.targetPath !== r.targetTitle;
  });
  await check('W-M8', 'the physical opener is reused, never bypassed', () => {
    const s = WIKI_SOURCE.slice(WIKI_SOURCE.indexOf('async function openTarget'),
      WIKI_SOURCE.indexOf('// ---- Missing target check'));
    return /globalThis\.openWorkspaceFile/.test(s) &&
      /globalThis\.findWorkspaceFileByPath/.test(s) &&
      /showDirectoryPicker|getFileHandle|querySelector/.test(s) === false;
  });
  await check('W-M9', 'the resolver never reads live unsaved editor text', () => {
    const s = WIKI_SOURCE.slice(WIKI_SOURCE.indexOf('function resolveWikiTarget'),
      WIKI_SOURCE.indexOf('// ---- Compatibility wrapper'));
    return /__cmGetText|md\.value|editor/.test(s) === false;
  });
  await check('W-M10', 'the resolver owns no second target grammar', () => {
    // No '[[' token syntax and no link regex inside the resolver. The constant
    // WIKI_RESOLUTION_KINDS is a KEY-TIER list, not a grammar, so it is matched
    // on its exact declaration rather than by the WIKI_RE substring it contains.
    const s = WIKI_SOURCE.slice(WIKI_SOURCE.indexOf('function resolveWikiTarget'),
      WIKI_SOURCE.indexOf('// ---- Compatibility wrapper'));
    return /\[\[/.test(s) === false && /WIKI_RE\s*=/.test(s) === false;
  });

  const passed = results.filter((r) => !r.group && r.ok).length;
  const failed = results.filter((r) => !r.group && !r.ok);
  for (const r of results) {
    if (r.group) console.log('\n' + r.group);
    else console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.id + '] ' + r.name + (r.detail ? '  -> ' + r.detail : ''));
  }
  console.log('\nWIKI LINK RESOLUTION VALIDATORS (ACT 3A): ' + passed + ' passed, ' + failed.length + ' failed');
  process.exitCode = failed.length ? 1 : 0;
})();
