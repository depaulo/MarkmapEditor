// @ts-nocheck
// ============================================================================
// ACT 3B — SHARED WIKI LINK EXTRACTION GRAMMAR (single authoritative owner)
// ============================================================================
//
// This module is the ONE owner of Wiki Link extraction. It exists as a small,
// dependency-free file because of LOAD ORDER, proven from source:
//
//   script-loader.js appends, in order:
//     95  ./js/main.js            <- parseConceptLinks + wikiExpand live here
//    114  ./js/links/wiki-links.js<- the resolver lives here
//   and js/editor/codemirror-bootstrap.js is a deferred `type="module"`, so it
//   always evaluates AFTER every classic script.
//
// So the grammar cannot live inside wiki-links.js: main.js loads FIRST and
// would have to reach back to a global that does not exist yet. Rather than
// duplicate the regex or add a second fallback, this pure module is appended
// BEFORE main.js and every consumer — main.js, wiki-links.js and CodeMirror —
// calls the same function.
//
// PROPERTIES (ACT 3B §5):
//   - pure: no DOM, no Workspace, no Index, no resolution, no mutation;
//   - stable source offsets, so occurrence-level consumers keep working;
//   - alias syntax preserved exactly as the previous canonical parser had it.
//
// GRAMMAR (unchanged from the 6-of-7 canonical sites ACT 3A identified):
//   [[Target]]            -> target 'Target'
//   [[Target|Label]]      -> target 'Target', alias 'Label'
//   target is trimmed; an empty target is skipped
//
// ACT 3B §16 NOTE — the retired inconsistency:
//   js/main.js parseConceptLinks used /\[\[([^\]]+)\]\]/g, which also matched
//   MULTI-LINE links and NESTED-LOOKING brackets. The 6 other sites used the
//   form below, which excludes '[', ']' and newlines. The canonical 6-site
//   behavior wins: a link never spans a line break and a target may not contain
//   brackets. Fixtures W-G11..W-G13 record the retired behavior explicitly.
// ============================================================================

(function (globalScope) {
  'use strict';

  var WIKI_LINK_PATTERN = /\[\[([^\[\]\n]+?)\]\]/g;

  // Source-proven canonical split: first '|' separates target from alias.
  function splitTargetAlias(inner) {
    var text = String(inner == null ? '' : inner);
    var pipeIndex = text.indexOf('|');
    var target = pipeIndex !== -1 ? text.slice(0, pipeIndex) : text;
    var alias = pipeIndex !== -1 ? text.slice(pipeIndex + 1) : '';
    return { target: target.trim(), alias: alias.trim() };
  }

  /**
   * Extract every Wiki Link occurrence from supplied text.
   *
   * @param {string} markdown
   * @returns {Array<{raw,rawTarget,target,alias,start,end}>} occurrence records in
   *          document order. `start`/`end` are offsets into the SUPPLIED string.
   *          Never resolves, never mutates, never throws on non-string input.
   */
  function extractWikiLinks(markdown) {
    if (!markdown || typeof markdown !== 'string') return [];

    var results = [];
    // A module-level /g regex carries lastIndex between calls, so it is reset
    // here rather than shared as state.
    WIKI_LINK_PATTERN.lastIndex = 0;

    var match;
    while ((match = WIKI_LINK_PATTERN.exec(markdown)) !== null) {
      var raw = match[0];
      var split = splitTargetAlias(match[1]);

      // An empty target ([[]] or [[|label]]) is malformed and is skipped.
      if (!split.target) continue;

      results.push({
        raw: raw,
        rawTarget: match[1],
        target: split.target,
        alias: split.alias,
        start: match.index,
        end: match.index + raw.length,
      });
    }

    return results;
  }

  var MME_WIKI_LINK_GRAMMAR = Object.freeze({
    extractWikiLinks: extractWikiLinks,
    splitTargetAlias: splitTargetAlias,
    WIKI_LINK_PATTERN: WIKI_LINK_PATTERN,
  });

  try {
    globalScope.MME_WIKI_LINK_GRAMMAR = MME_WIKI_LINK_GRAMMAR;
  } catch {}

  if (typeof globalThis !== 'undefined' && globalThis !== globalScope) {
    try {
      globalThis.MME_WIKI_LINK_GRAMMAR = MME_WIKI_LINK_GRAMMAR;
    } catch {}
  }

  if (typeof globalThis !== 'undefined' && typeof globalThis.log === 'function') {
    globalThis.log('WikiLinkGrammar: module loaded (single extraction owner)');
  }
})(typeof window !== 'undefined' ? window : globalThis);
