#!/usr/bin/env node
'use strict';

/**
 * ACT 3B — Wiki Link relationship contract (Links Out / Links In) AND shared
 * extraction grammar.
 *
 * A separate suite from wiki-link-resolution-validators.cjs on purpose: that
 * suite owns RESOLUTION (ACT 3A) and its fixtures are about one target at a
 * time. This one owns DIRECTION and GRAMMAR CONSOLIDATION, which are different
 * questions. Merging them would make both harder to read.
 *
 * Every fixture executes the REAL owners loaded verbatim:
 *   - js/links/wiki-link-grammar.js  (the single extraction grammar)
 *   - js/links/wiki-links.js         (resolution + relationship providers)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GRAMMAR_SOURCE = fs.readFileSync(path.join(ROOT, 'js/links/wiki-link-grammar.js'), 'utf8');
const WIKI_SOURCE = fs.readFileSync(path.join(ROOT, 'js/links/wiki-links.js'), 'utf8');
const MAIN_SOURCE = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
const CM_SOURCE = fs.readFileSync(path.join(ROOT, 'js/editor/codemirror-bootstrap.js'), 'utf8');
const LOADER_SOURCE = fs.readFileSync(path.join(ROOT, 'js/app/script-loader.js'), 'utf8');

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
const el = () => ({
  value: '', hidden: false, innerHTML: '', textContent: '', dataset: {}, style: {},
  classes: new Set(),
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  addEventListener() {}, removeEventListener() {}, appendChild() {}, setAttribute() {},
  querySelector: () => null, querySelectorAll: () => [], focus() {},
});
globalThis.document = {
  getElementById: () => null, addEventListener() {}, removeEventListener() {},
  querySelector: () => null, querySelectorAll: () => [], createElement: el,
  dispatchEvent: () => true, documentElement: el(), body: el(), head: el(),
};

// Load order matters: grammar first, exactly as script-loader does.
(0, eval)(GRAMMAR_SOURCE);
(0, eval)(WIKI_SOURCE);
const G = globalThis.MME_WIKI_LINK_GRAMMAR;
const W = globalThis.MME_WIKI_LINKS;
if (!G) throw new Error('MME_WIKI_LINK_GRAMMAR not exposed');
if (!W) throw new Error('MME_WIKI_LINKS not exposed');

const file = (p, name, title, extra) =>
  Object.assign({ path: p, name: name, title: title, kind: 'notes' }, extra || {});
const idx = (files) => ({ ready: true, files: files });

// ACT3B_SUITE_1_END

(async () => {
  group('A. Shared grammar (G01-G15)');

  // A Wiki Link regex literal in SOURCE TEXT is the 4-character sequence
  // backslash,'[',backslash,'[' ("\[\["). The Task checkbox grammar used by
  // Package 2 is the 3-character sequence backslash,'[','[' ("\[["), which must
  // NOT trip this detector. The needle is built from char codes so no escaping
  // ambiguity can creep in.
  //
  // An earlier version of this fixture searched for the raw "[[" form and could
  // never detect a private copy, making the single-owner contract vacuous; a
  // second version used a fragile literal escape. This form is explicit.
  const BS = String.fromCharCode(92);
  const WIKI_LITERAL = BS + '[' + BS + '[';
  const hasWikiRegexLiteral = (src) => src.indexOf(WIKI_LITERAL) !== -1;

  await check('G01', 'exactly one active extraction regex in the whole app', () => {
    const others = [WIKI_SOURCE, MAIN_SOURCE, CM_SOURCE, LOADER_SOURCE]
      .filter(hasWikiRegexLiteral);
    return others.length === 0 && hasWikiRegexLiteral(GRAMMAR_SOURCE);
  });
  await check('G02', 'grammar owner is loaded BEFORE main.js', () => {
    const g = LOADER_SOURCE.indexOf("appendScript('./js/links/wiki-link-grammar.js')");
    const m = LOADER_SOURCE.indexOf("appendScript('./js/main.js'");
    return g !== -1 && m !== -1 && g < m;
  });
  await check('G03', 'normal Wiki Link', () =>
    G.extractWikiLinks('see [[Alpha]] here')[0].target === 'Alpha');
  await check('G04', 'alias splits target and alias', () => {
    const l = G.extractWikiLinks('[[Alpha|see this]]')[0];
    return l.target === 'Alpha' && l.alias === 'see this';
  });
  await check('G05', 'spaces in target are preserved', () =>
    G.extractWikiLinks('[[Spaced Name]]')[0].target === 'Spaced Name');
  await check('G06', 'Unicode target is preserved', () =>
    G.extractWikiLinks('[[日本語 ノート]]')[0].target === '日本語 ノート');
  await check('G07', 'repeated target yields two occurrences', () =>
    G.extractWikiLinks('[[Alpha]] and [[Alpha]]').length === 2);
  await check('G08', 'multiple links on one line are all found', () =>
    G.extractWikiLinks('[[A]] [[B]] [[C]]').map((l) => l.target).join(',') === 'A,B,C');
  await check('G09', 'malformed empty target is skipped', () =>
    G.extractWikiLinks('[[]] [[|only alias]]').length === 0);
  await check('G10', 'target is trimmed', () =>
    G.extractWikiLinks('[[  Alpha  ]]')[0].target === 'Alpha');
  await check('G11', 'RETIRED: a link does NOT span a newline', () => {
    // main.js parseConceptLinks used /\[\[([^\]]+)\]\]/g, which DID match across
    // a line break. The canonical single-line form wins. Recorded so the retired
    // inconsistency stays visible rather than being forgotten.
    return G.extractWikiLinks('[[start\nend]]').length === 0;
  });
  await check('G12', 'RETIRED: a target may not contain brackets', () =>
    G.extractWikiLinks('[[a[b]]').length === 0);
  await check('G13', 'source offsets are stable and addressable', () => {
    const src = 'x [[Alpha]] y [[Beta]]';
    const links = G.extractWikiLinks(src);
    return links.length === 2 &&
      src.slice(links[0].start, links[0].end) === '[[Alpha]]' &&
      src.slice(links[1].start, links[1].end) === '[[Beta]]' &&
      links[0].end < links[1].start;
  });
  await check('G14', 'extraction is pure: input untouched, non-strings safe', () => {
    const src = '[[Alpha]]';
    G.extractWikiLinks(src);
    return src === '[[Alpha]]' && G.extractWikiLinks(null).length === 0 &&
      G.extractWikiLinks(42).length === 0;
  });
  await check('G15', 'grammar owner has no DOM, Workspace or Index dependency', () => {
    const code = GRAMMAR_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    return /document\.|WORKSPACE_INDEX|MME_WIKI_LINKS|openWorkspaceFile/.test(code) === false;
  });

  // ACT3B_SUITE_2_END

  group('B. Links Out (O16-O25)');

  const I = idx([
    file('notes/Alpha.md', 'Alpha.md', 'Alpha Title'),
    file('notes/one.md', 'one.md', 'One'),
    file('notes/two.md', 'two.md', 'Two'),
  ]);
  const out = W.getLinksOut({
    markdown: 'Link [[Alpha]] and [[Nope]] and [[Alpha]] again.',
    sourcePath: 'notes/one.md', sourceTitle: 'One', indexSnapshot: I,
  });

  await check('O16', 'resolved outgoing carries exact targetPath', () => {
    const r = out.relationships[0];
    return r.status === 'resolved' && r.targetPath === 'notes/Alpha.md' &&
      r.resolutionKind === 'filename';
  });
  await check('O17', 'missing outgoing has no targetPath', () => {
    const r = out.relationships[1];
    return r.status === 'missing' && r.targetPath === '';
  });
  await check('O18', 'ambiguous outgoing carries candidates and no targetPath', () => {
    const amb = idx([file('notes/a/S.md', 'S.md', 'A'), file('notes/b/S.md', 'S.md', 'B'),
      file('notes/one.md', 'one.md', 'One')]);
    const r = W.getLinksOut({ markdown: '[[S]]', sourcePath: 'notes/one.md', indexSnapshot: amb })
      .relationships[0];
    return r.status === 'ambiguous' && r.targetPath === '' && r.candidates.length === 2;
  });
  await check('O19', 'no Index means not-ready, never missing', () =>
    W.getLinksOut({ markdown: '[[Alpha]]', sourcePath: 'notes/one.md' })
      .relationships[0].status === 'not-ready');
  await check('O20', 'exact sourcePath is carried on every relationship', () =>
    out.relationships.every((r) => r.sourcePath === 'notes/one.md'));
  await check('O21', 'repeated occurrences are numbered and preserved', () => {
    const r = out.relationships;
    return r.length === 3 && r[0].occurrence === 1 && r[2].occurrence === 2 &&
      r[0].rawTarget === 'Alpha' && r[2].rawTarget === 'Alpha';
  });
  await check('O22', 'alias display label preserved; owner value is the target', () => {
    const r = W.getLinksOut({ markdown: '[[Alpha|read me]]', sourcePath: 's.md', indexSnapshot: I })
      .relationships[0];
    return r.rawTarget === 'Alpha' && r.displayLabel === 'read me' &&
      r.targetPath === 'notes/Alpha.md';
  });
  await check('O23', 'provider does not mutate the supplied markdown', () => {
    const md = '[[Alpha]]';
    W.getLinksOut({ markdown: md, sourcePath: 's.md', indexSnapshot: I });
    return md === '[[Alpha]]';
  });
  await check('O24', 'provider does not mutate the Index', () => {
    const snap = JSON.stringify(I);
    W.getLinksOut({ markdown: '[[Alpha]]', sourcePath: 's.md', indexSnapshot: I });
    W.getLinksIn({ targetPath: 'notes/Alpha.md', indexSnapshot: I });
    return JSON.stringify(I) === snap;
  });
  await check('O25', 'Links Out summary preserves state distinctions', () => {
    const s = W.summarizeLinksOut({ relationships: out.relationships });
    return s.resolved.length === 1 && s.missing.length === 1 && s.ambiguous.length === 0;
  });

  // ACT3B_SUITE_3_END

  group('C. Links In (N29-N44)');

  // note1 links by FILENAME, note2 links by the H1 of the same note, note3 links
  // to a name that only matches note1's filename, note4 links nowhere valid.
  const J = idx([
    file('notes/Alpha.md', 'Alpha.md', 'Alpha Title', { conceptLinks: [] }),
    file('notes/note1.md', 'note1.md', 'Note One', { conceptLinks: ['Alpha'] }),
    file('notes/note2.md', 'note2.md', 'Note Two', { conceptLinks: ['Alpha Title'] }),
    file('notes/note3.md', 'note3.md', 'Note Three', { conceptLinks: ['note1'] }),
    file('notes/note4.md', 'note4.md', 'Note Four', { conceptLinks: ['Ghost'] }),
  ]);
  const jin = W.getLinksIn({ targetPath: 'notes/Alpha.md', indexSnapshot: J });
  const rows = jin.rows.map((r) => r.sourcePath).sort();

  await check('N29', 'one source to one target', () =>
    rows.length > 0 && rows.includes('notes/note1.md'));
  await check('N30', 'multiple source Notes to one target', () =>
    rows.includes('notes/note1.md') && rows.includes('notes/note2.md'));
  await check('N31', 'filename-resolved inbound relationship is found', () =>
    jin.relationships.some((r) => r.sourcePath === 'notes/note1.md' &&
      r.resolutionKind === 'filename'));
  await check('N32', 'H1-resolved inbound relationship is found', () =>
    jin.relationships.some((r) => r.sourcePath === 'notes/note2.md' &&
      r.resolutionKind === 'h1'));
  await check('N33', 'missing relationship is excluded from Links In', () =>
    jin.rows.every((r) => r.sourcePath !== 'notes/note4.md'));
  await check('N34', 'a link to a DIFFERENT note is not inbound here', () =>
    jin.rows.every((r) => r.sourcePath !== 'notes/note3.md'));
  await check('N35', 'target comparison uses exact path, not H1 or basename text', () => {
    // Two notes share the H1 'Alpha Title'; only the exact path row is returned.
    const r = W.getLinksIn({ targetPath: 'notes/Alpha.md', indexSnapshot: J });
    return r.relationships.every((x) => x.targetPath === 'notes/Alpha.md');
  });
  await check('N36', 'ambiguous relationship is excluded', () => {
    const K = idx([file('notes/a/S.md', 'S.md', 'A'), file('notes/b/S.md', 'S.md', 'B'),
      file('notes/src.md', 'src.md', 'Src', { conceptLinks: ['S'] })]);
    const r = W.getLinksIn({ targetPath: 'notes/a/S.md', indexSnapshot: K });
    return r.rows.length === 0;
  });
  await check('N37', 'not-ready is unavailable, not an empty result', () => {
    const r = W.getLinksIn({ targetPath: 'notes/Alpha.md', indexSnapshot: { ready: false } });
    return r.available === false && r.rows.length === 0;
  });
  await check('N38', 'one row per exact sourcePath, even for many relationships', () => {
    const L = idx([file('notes/T.md', 'T.md', 'T', { conceptLinks: [] }),
      file('notes/m.md', 'm.md', 'M', { conceptLinks: ['T', 'T', 'T'] })]);
    const r = W.getLinksIn({ targetPath: 'notes/T.md', indexSnapshot: L });
    return r.rows.length === 1 && r.rows[0].occurrenceCount === 3;
  });
  await check('N39', 'Index order does not affect Links In', () => {
    const rev = W.getLinksIn({ targetPath: 'notes/Alpha.md',
      indexSnapshot: idx([...J.files].reverse()) });
    return rev.rows.map((r) => r.sourcePath).sort().join(',') === rows.join(',');
  });
  await check('N40', 'classification does not duplicate a source row', () => {
    const M = idx([file('notes/T.md', 'T.md', 'T', { conceptLinks: [] }),
      file('notes/m.md', 'm.md', 'M', { conceptLinks: ['T'],
        knowledge: true, pinned: true, archived: true })]);
    const r = W.getLinksIn({ targetPath: 'notes/T.md', indexSnapshot: M });
    return r.rows.length === 1;
  });
  await check('N41', 'archived source remains an eligible inbound row', () => {
    const M = idx([file('notes/T.md', 'T.md', 'T', { conceptLinks: [] }),
      file('notes/old.md', 'old.md', 'Old', { conceptLinks: ['T'], archived: true })]);
    return W.getLinksIn({ targetPath: 'notes/T.md', indexSnapshot: M }).rows.length === 1;
  });
  await check('N42', 'no targetPath means no inbound result at all', () =>
    W.getLinksIn({ targetPath: '', indexSnapshot: J }).available === false);
  await check('N43', 'Links In reads saved data only, never live text', () => {
    const s = WIKI_SOURCE.slice(WIKI_SOURCE.indexOf('function getLinksIn('),
      WIKI_SOURCE.indexOf('function summarizeLinksIn'));
    return /__cmGetText|md\.value|editor/.test(s) === false;
  });
  await check('N44', 'summarizeLinksIn dedupes by sourcePath and counts', () => {
    const s = W.summarizeLinksIn({ relationships: jin.relationships });
    const one = s.rows.filter((r) => r.sourcePath === 'notes/note1.md');
    return one.length === 1 && one[0].occurrenceCount === 1;
  });

  // ACT3B_SUITE_4_END

  group('D. Related semantic proof (R45-R51)');

  // The CURRENT Related algorithm, replicated verbatim from main.js
  // (normalizeBacklinkConceptKey + findBacklinksForConcept), so the comparison
  // is against real shipped semantics rather than a paraphrase.
  const nk = (v) => String(v || '').trim().replace(/^\.?\//, '').replace(/^notes\//i, '')
    .replace(/^concepts\//i, '').replace(/\.md$/i, '').replace(/\|.*$/, '').trim().toLowerCase();
  function relatedAsShipped(files, activeName) {
    const key = nk(activeName);
    if (!key) return [];
    const acc = [];
    for (const p of files) {
      if (!(p.conceptLinks || []).some((l) => nk(l) === key)) continue;
      acc.push(String(p.path));
    }
    return acc.sort();
  }

  const canonicalRows = jin.rows.map((r) => r.sourcePath).sort();
  const relatedRows = relatedAsShipped(J.files, 'Alpha.md');

  await check('R45', 'PROVEN DIFFERENCE: Related is NOT equivalent to canonical Links In', () => {
    // Canonical finds BOTH note1 (filename-resolved) and note2 (H1-resolved).
    // Current Related keys on the active file NAME, so it finds only note1 and
    // MISSES the H1-resolved inbound link entirely.
    return canonicalRows.length === 2 && relatedRows.length === 1 &&
      canonicalRows.join(',') !== relatedRows.join(',');
  });
  await check('R46', 'the exact difference is recorded, not silently replaced', () =>
    canonicalRows.filter((r) => !relatedRows.includes(r)).join(',') === 'notes/note2.md');
  await check('R47', 'Related is PRESERVED, not migrated, in this ACT', () =>
    /function findBacklinksForConcept\(conceptName\)/.test(MAIN_SOURCE) &&
    /normalizeBacklinkConceptKey/.test(MAIN_SOURCE) &&
    /getLinksIn\(/.test(MAIN_SOURCE) === false);
  await check('R48', 'Related panel label is NOT renamed in this ACT', () =>
    /workspaceRelatedTitle">Related</.test(MAIN_SOURCE) && /workspaceRelatedPanel/.test(MAIN_SOURCE));
  await check('R49', 'no legacy concepts/ physical path in the new provider', () => {
    const s = WIKI_SOURCE.slice(WIKI_SOURCE.indexOf('function getLinksIn('),
      WIKI_SOURCE.indexOf('function summarizeLinksIn'));
    return /concepts\//.test(s) === false;
  });
  await check('R50', 'no first-match selection in the providers', () => {
    const s = WIKI_SOURCE.slice(WIKI_SOURCE.indexOf('function getLinksIn('),
      WIKI_SOURCE.indexOf('function summarizeLinksOut'));
    return /\[0\]|\.find\(/.test(s) === false;
  });
  await check('R51', 'the live Related consumer still resolves no target (known gap)', () =>
    /function findBacklinksForConcept\(conceptName\)[\s\S]{0,2500}resolveWikiTarget/.test(MAIN_SOURCE)
      === false);

  // ACT3B_SUITE_5_END

  group('E. Mutation controls (M1-M10)');

  await check('M1', 'restoring the legacy parseConceptLinks regex would fail G01', () => {
    // Injecting a private Wiki Link regex literal back into main.js must make a
    // second grammar owner visible to the SAME detector G01 uses.
    const injected = 'const wikiRe = ' + WIKI_LITERAL + '([^' + BS + ']]+)' + BS + ']/g;';
    const withLegacy = MAIN_SOURCE.replace(
      'const grammar = globalThis.MME_WIKI_LINK_GRAMMAR;', injected);
    return hasWikiRegexLiteral(withLegacy) === true &&
      hasWikiRegexLiteral(MAIN_SOURCE) === false;
  });
  await check('M2', 'a second CodeMirror or Wiki regex copy would fail G01', () =>
    hasWikiRegexLiteral(CM_SOURCE) === false && hasWikiRegexLiteral(WIKI_SOURCE) === false);
  await check('M3', 'building Links In from raw target text would fail N35', () => {
    // A raw-text Links In would match only name-equal text and would MISS the
    // H1-resolved edge entirely — the concrete defect R45 records.
    const rawText = (files, target) => {
      const t = nk(target);
      return files.filter((f) => (f.conceptLinks || []).some((l) => nk(l) === t))
        .map((f) => f.path).sort();
    };
    const naive = rawText(J.files, 'notes/Alpha.md');
    return naive.length === 1 && canonicalRows.length === 2;
  });
  await check('M4', 'including a MISSING relationship would fail N33', () => {
    const r = W.getLinksIn({ targetPath: 'notes/Alpha.md', indexSnapshot: J });
    return r.relationships.every((x) => x.status === 'resolved') &&
      r.rows.every((x) => x.sourcePath !== 'notes/note4.md');
  });
  await check('M5', 'including an AMBIGUOUS relationship would fail N36', () => {
    const K = idx([file('notes/a/S.md', 'S.md', 'A'), file('notes/b/S.md', 'S.md', 'B'),
      file('notes/src.md', 'src.md', 'Src', { conceptLinks: ['S'] })]);
    return W.getLinksIn({ targetPath: 'notes/a/S.md', indexSnapshot: K }).rows.length === 0;
  });
  await check('M6', 'duplicating a source row per occurrence would fail N38', () => {
    const L = idx([file('notes/T.md', 'T.md', 'T', { conceptLinks: [] }),
      file('notes/m.md', 'm.md', 'M', { conceptLinks: ['T', 'T', 'T'] })]);
    const r = W.getLinksIn({ targetPath: 'notes/T.md', indexSnapshot: L });
    return r.relationships.length === 3 && r.rows.length === 1;
  });
  await check('M7', 'comparing target by H1 would merge Notes that share one H1', () => {
    // two.md and one.md both have H1 'Shared', so [[Shared]] is genuinely
    // AMBIGUOUS. Canonical Links In therefore returns nothing for either note.
    // An H1-text comparison would instead return BOTH notes as inbound — that
    // merge is exactly what exact-path identity prevents.
    const dup = idx([file('notes/one.md', 'one.md', 'Shared', { conceptLinks: [] }),
      file('notes/two.md', 'two.md', 'Shared', { conceptLinks: [] }),
      file('notes/src.md', 'src.md', 'Src', { conceptLinks: ['Shared'] })]);
    const byPath = W.getLinksIn({ targetPath: 'notes/one.md', indexSnapshot: dup });
    const h1Comparison = dup.files
      .filter((f) => nk(f.title) === 'shared')
      .map((f) => f.path).sort();
    return byPath.rows.length === 0 && h1Comparison.length === 2;
  });
  await check('M8', 'reading live editor text in the Workspace provider would fail N43', () =>
    /__cmGetText|md\.value|editor/.test(
      WIKI_SOURCE.slice(WIKI_SOURCE.indexOf('function getLinksIn('),
        WIKI_SOURCE.indexOf('function summarizeLinksIn'))) === false);
  await check('M9', 'bypassing the physical opener would fail the nav contract', () => {
    const s = WIKI_SOURCE.slice(WIKI_SOURCE.indexOf('async function openTarget'),
      WIKI_SOURCE.indexOf('// ---- Missing target check'));
    return /globalThis\.openWorkspaceFile/.test(s) &&
      /showDirectoryPicker|getFileHandle/.test(s) === false;
  });
  await check('M10', 'renaming Related without proof would fail R48', () =>
    /workspaceRelatedTitle">Related</.test(MAIN_SOURCE) === true);

  // ACT3B_SUITE_6_END

  group('F. Scope and safety (S55-S64)');

  const providerSrc = () => WIKI_SOURCE.slice(
    WIKI_SOURCE.indexOf('// ACT 3B — RELATIONSHIP PROVIDERS'),
    WIKI_SOURCE.indexOf('// ---- Compatibility wrapper'));

  await check('S55', 'live Current Document Links Out works from supplied text', () => {
    const r = W.getLinksOut({ markdown: '[[Alpha]]', sourcePath: 'notes/live.md', indexSnapshot: I });
    return r.available === true && r.relationships[0].targetPath === 'notes/Alpha.md';
  });
  await check('S56', 'no Workspace gives not-ready resolution, not missing', () =>
    W.getLinksOut({ markdown: '[[Alpha]]', sourcePath: 'x.md' }).relationships[0].status === 'not-ready');
  await check('S57', 'no Workspace gives unavailable Links In, not a false zero', () =>
    W.getLinksIn({ targetPath: 'notes/Alpha.md' }).available === false);
  await check('S58', 'no second relationship store is created', () =>
    /localStorage|sessionStorage/.test(providerSrc()) === false);
  await check('S59', 'providers never write Markdown, open files or save', () =>
    /createWritable|writeFile|openWorkspaceFile|saveSmart|rename/.test(providerSrc()) === false);
  await check('S60', 'no second resolver is introduced', () =>
    (WIKI_SOURCE.match(/function resolveWikiTarget\(/g) || []).length +
    (MAIN_SOURCE.match(/function resolveWikiTarget\(/g) || []).length === 1);
  await check('S61', 'no Task, Project or Report owner is touched', () =>
    /MME_TASK_LIFECYCLE|parseProjects|report/i.test(providerSrc()) === false);
  await check('S62', 'no version or cache owner is referenced', () =>
    /productVersion|cacheIdentity|APP_VERSION/.test(providerSrc()) === false);
  await check('S63', 'no Active or Workspace Index disclosure UI is added', () =>
    /createElement|innerHTML|appendChild/.test(providerSrc()) === false);
  await check('S64', 'relationship providers are exported and reachable', () =>
    typeof W.getLinksOut === 'function' && typeof W.getLinksIn === 'function' &&
    typeof W.summarizeLinksIn === 'function' && typeof W.summarizeLinksOut === 'function');

  const passed = results.filter((r) => !r.group && r.ok).length;
  const failed = results.filter((r) => !r.group && !r.ok);
  for (const r of results) {
    if (r.group) console.log('\n' + r.group);
    else console.log((r.ok ? 'PASS ' : 'FAIL ') + '[' + r.id + '] ' + r.name + (r.detail ? '  -> ' + r.detail : ''));
  }
  console.log('\nWIKI LINK RELATIONSHIP VALIDATORS (ACT 3B): ' + passed + ' passed, ' + failed.length + ' failed');
  process.exitCode = failed.length ? 1 : 0;
})();
