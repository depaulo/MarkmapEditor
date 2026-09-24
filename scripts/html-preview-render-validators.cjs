#!/usr/bin/env node
'use strict';

/**
 * HTML Preview renderer validators — final 0.6.x renderer contract.
 *
 * These validators exercise the REAL renderer ownership in js/main.js
 * (`renderHtmlWithShiki` -> `new marked.Renderer()` -> `renderer.text` plus the
 * module-scope `escapeHtml` / `wikiExpand` helpers) against the REAL marked
 * runtime, and compare the result with marked's own DEFAULT renderer output
 * (the reference contract).
 *
 * The marked runtime is resolved from, in order:
 *   1. process.env.MME_MARKED_PATH
 *   2. <home>/.mme-marked.js           (cached copy)
 *   3. the same CDN build index.html loads (cached to <home>/.mme-marked.js)
 * When no runtime can be resolved the run FAILS with an explicit
 * MARKED RUNTIME UNAVAILABLE report: dependency absence is never reported as a
 * successful validation.
 *
 * Usage: node scripts/html-preview-render-validators.cjs
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const MAIN_JS_PATH = path.join(ROOT, 'js', 'main.js');
const INDEX_HTML_PATH = path.join(ROOT, 'index.html');
const MARKED_CDN_URL = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
const MARKED_CACHE_PATH = path.join(os.homedir(), '.mme-marked.js');
const MARKED_CACHE_VERSION_PATH = `${MARKED_CACHE_PATH}.version`;

const results = [];
function check(id, name, ok, detail) {
  results.push({ id, name, ok: Boolean(ok), detail: detail == null ? '' : String(detail) });
}
function group(title) {
  results.push({ group: title });
}

/* ---------------- source extraction (tests the SHIPPED code) ---------------- */

// Returns the balanced `{ ... }` block starting at openIndex (an opening brace),
// skipping strings, template literals, comments and regex literals.
function sliceBalanced(src, openIndex, fromIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  let prev = '';

  for (let i = openIndex; i < src.length; i += 1) {
    const c = src[i];
    const n = src[i + 1];

    if (lineComment) {
      if (c === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (c === '*' && n === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (c === '\\') {
        escaped = true;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && n === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (c === '/' && n === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      continue;
    }
    if (c === '/' && /[=(,:[!&|?{};+\-*%<>~^\n]/.test(prev || '\n')) {
      let inClass = false;
      for (let j = i + 1; j < src.length; j += 1) {
        const rc = src[j];
        if (rc === '\\') {
          j += 1;
          continue;
        }
        if (rc === '\n') {
          i = j;
          break;
        }
        if (rc === '[') inClass = true;
        else if (rc === ']') inClass = false;
        else if (rc === '/' && !inClass) {
          i = j;
          break;
        }
      }
      prev = '/';
      continue;
    }
    if (c === '{') {
      depth += 1;
      prev = c;
      continue;
    }
    if (c === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(fromIndex == null ? openIndex : fromIndex, i + 1);
      prev = c;
      continue;
    }
    if (!/\s/.test(c)) prev = c;
  }

  return null;
}

function findFunctionSource(src, name) {
  const marker = `function ${name}(`;
  const start = src.indexOf(marker);
  if (start === -1) return null;
  const open = src.indexOf('{', start + marker.length);
  if (open === -1) return null;
  return sliceBalanced(src, open, start);
}

function findAssignmentFunctionSource(src, assignment) {
  const start = src.indexOf(assignment);
  if (start === -1) return null;
  const fnStart = src.indexOf('function', start);
  if (fnStart === -1) return null;
  const open = src.indexOf('{', fnStart);
  if (open === -1) return null;
  return sliceBalanced(src, open, fnStart);
}

/* --------------------------- marked runtime loading -------------------------- */

function loadMarkedFromPath(file) {
  const src = fs.readFileSync(file, 'utf8');
  const mod = { exports: {} };
  new Function('module', 'exports', src)(mod, mod.exports);
  const runtime = mod.exports.marked || mod.exports;
  if (!runtime || typeof runtime.parse !== 'function') {
    throw new Error(`no marked export in ${file}`);
  }
  return runtime;
}

function readCachedVersion(file) {
  try {
    return fs.readFileSync(`${file}.version`, 'utf8').trim();
  } catch {
    return '';
  }
}

function httpsGet(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => resolve({ body, headers: res.headers || {} }));
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout after ${timeoutMs}ms`)));
    req.on('error', reject);
  });
}

async function resolveMarkedRuntime() {
  const fromEnv = process.env.MME_MARKED_PATH;
  if (fromEnv) {
    return {
      marked: loadMarkedFromPath(fromEnv),
      source: `MME_MARKED_PATH=${fromEnv}`,
      version: readCachedVersion(fromEnv),
    };
  }

  if (fs.existsSync(MARKED_CACHE_PATH)) {
    return {
      marked: loadMarkedFromPath(MARKED_CACHE_PATH),
      source: `cache ${MARKED_CACHE_PATH}`,
      version: readCachedVersion(MARKED_CACHE_PATH),
    };
  }

  const { body, headers } = await httpsGet(MARKED_CDN_URL, 30000);
  fs.writeFileSync(MARKED_CACHE_PATH, body, 'utf8');
  const version = String(headers['x-jsd-version'] || '').trim();
  if (version) fs.writeFileSync(MARKED_CACHE_VERSION_PATH, version, 'utf8');
  return {
    marked: loadMarkedFromPath(MARKED_CACHE_PATH),
    source: `${MARKED_CDN_URL} (cached)`,
    version,
  };
}

/* ------------------------------ report helpers ------------------------------ */

function printReport(title, runtimeInfo) {
  let passed = 0;
  let failed = 0;

  for (const entry of results) {
    if (entry.group) {
      console.log(`\n--- ${entry.group} ---`);
      continue;
    }
    if (entry.ok) {
      passed += 1;
      console.log(`PASS ${entry.id} ${entry.name}`);
    } else {
      failed += 1;
      console.log(`FAIL ${entry.id} ${entry.name}${entry.detail ? ` :: ${entry.detail}` : ''}`);
    }
  }

  console.log('\n========================================');
  console.log(`${title}`);
  if (runtimeInfo) console.log(`marked runtime: ${runtimeInfo}`);
  console.log(`${passed} passed, ${failed} failed`);
  console.log('========================================');

  return failed;
}

/* ---------------------------------- fixtures --------------------------------- */

const FIXTURES = {
  bold: '- **Bold text**',
  italic: '- *Italic text*',
  boldItalic: '- ***Bold and italic text***',
  strike: '- ~~Strikethrough~~',
  code: '- `Inline code`',
  link: '- [Example](https://example.com)',
  wiki: '- [[Concept]]',
  wikiAlias: '- [[Concept|Visible label]]',
  boldCode: '- **Bold with `code`**',
  italicLink: '- *Italic with [link](https://example.com)*',
  boldWiki: '- **Bold with [[Concept|Wiki label]]**',
  ordered: '1. **Ordered bold**',
  welcomeOrdered: '1. Switch to **Journal**.\n2. Select **Open Workspace**.\n3. Use **New Concept** for a knowledge page.',
  nested: '- item\n  - nested **bold**',
  taskOpen: '- [ ] Open task **bold**',
  taskDone: '- [x] Done task **bold**',
  loose: '- loose one **bold**\n\n- loose two',
  looseTask: '- [x] loose done **bold**\n\n- other',
  looseWiki: '- loose wiki [[Concept]]\n\n- other',
  rawHtml: '- plain <b>raw</b> & text',
  deep: '- **a *b* `c` [[W]]**',
};

const stripTags = (html) => String(html).replace(/<[^>]*>/g, '');
// Rewrites rendered wikiLink spans back to their literal Markdown source so the
// result can be compared byte-for-byte with marked's default renderer output.
const wikiSpansToLiteral = (html) =>
  String(html).replace(
    /<span class="wikiLink" data-wiki-target="([^"]*)" title="Wiki link: [^"]*">([\s\S]*?)<\/span>/g,
    (match, target, label) => (label === target ? `[[${target}]]` : `[[${target}|${label}]]`)
  );

async function main() {
  const mainSrc = fs.readFileSync(MAIN_JS_PATH, 'utf8');

  group('A. shipped renderer ownership (js/main.js)');

  const escapeHtmlSrc = findFunctionSource(mainSrc, 'escapeHtml');
  const wikiExpandSrc = findFunctionSource(mainSrc, 'wikiExpand');
  const textFnSrc = findAssignmentFunctionSource(mainSrc, 'renderer.text = function');
  const headingFnSrc = findAssignmentFunctionSource(mainSrc, 'renderer.heading = function');
  const codeFnSrc = findAssignmentFunctionSource(mainSrc, 'renderer.code = function');
  const rendererInstances = (mainSrc.match(/new marked\.Renderer\(\)/g) || []).length;
  const parseCalls = (mainSrc.match(/marked\.parse\(/g) || []).length;

  check('H1', 'single HTML render owner (renderHtmlWithShiki)', /async function renderHtmlWithShiki\(/.test(mainSrc));
  check('H2', 'exactly one marked.Renderer and one marked.parse call', rendererInstances === 1 && parseCalls === 1, `renderers=${rendererInstances} parses=${parseCalls}`);
  check('H3', 'escapeHtml helper present in shipped source', Boolean(escapeHtmlSrc));
  check('H4', 'wikiExpand extracted as module-scope helper', Boolean(wikiExpandSrc));
  check('H5', 'renderer.text extracted from shipped source', Boolean(textFnSrc), textFnSrc ? '' : 'renderer.text assignment not found');
  check('H6', 'renderer.text delegates child tokens to this.parser.parseInline', /anyToken\.tokens[\s\S]{0,120}this\.parser[\s\S]{0,60}parseInline/.test(textFnSrc || ''));
  check('H7', 'renderer.text passes already-safe escaped markup through', /anyToken\.escaped\)\s*return String\(anyToken\.text \?\? ''\)/.test(textFnSrc || ''));
  check('H8', 'leaf branch escapes and expands wiki links', /wikiExpand\(String\(anyToken\.text \?\? ''\)\)/.test(textFnSrc || ''));
  check('H9', 'legacy string renderer signature supported', /wikiExpand\(String\(token \?\? ''\)\)/.test(textFnSrc || ''));
  check('H10', 'nullish text handling (no String(x || ""))', !/String\([^)]*\|\|/.test(textFnSrc || ''));
  check('H11', 'no synthetic token construction in renderer.text', !/type:\s*'text'/.test(textFnSrc || ''));
  check('H12', 'renderer.listitem NOT overridden', !/renderer\.listitem\s*=/.test(mainSrc));
  check('H13', 'no Markdown marker regex rewriting in renderer.text', !/replace\([^\n]*\*\*/.test(textFnSrc || ''));
  check('H14', 'heading renderer unchanged (slug id + anchor)', /slugifyHeading\(/.test(headingFnSrc || '') && /href="#\$\{id\}"/.test(headingFnSrc || ''));
  check('H15', 'code renderer unchanged (shiki + copy button + escaped fallback)', Boolean(codeFnSrc) && /copy-btn/.test(codeFnSrc) && /codeToHtml/.test(codeFnSrc) && /escapeHtml\(code\)/.test(codeFnSrc));
  check('H16', 'frontmatter + mme-task render-copy stripping still applied before parse', /stripMmeTaskMetadataForRender\(\s*stripLeadingFrontmatterForRender\(mdText\)\s*\)/.test(mainSrc));

  const indexSrc = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
  check('H17', 'index.html loads the same marked CDN build the validator resolves', indexSrc.includes(MARKED_CDN_URL));

  group('B. real marked runtime');

  let runtime = null;
  let runtimeError = null;
  try {
    runtime = await resolveMarkedRuntime();
  } catch (error) {
    runtimeError = error;
  }

  check(
    'H18',
    'marked runtime available',
    Boolean(runtime),
    runtimeError ? `MARKED RUNTIME UNAVAILABLE: ${runtimeError.message}` : ''
  );

  if (!runtime) {
    console.log('MARKED RUNTIME UNAVAILABLE — validation NOT reported as successful.');
    printReport('HTML PREVIEW RENDERER VALIDATORS (INCOMPLETE)', 'MARKED RUNTIME UNAVAILABLE');
    process.exit(1);
  }

  const runtimeLabel = `${runtime.source}${runtime.version ? ` version=${runtime.version}` : ''}`;
  console.log(`marked runtime: ${runtimeLabel}`);

  const buildRenderer = new Function(
    'marked',
    `${escapeHtmlSrc}\n${wikiExpandSrc}\nreturn function buildRenderer() { var renderer = new marked.Renderer(); renderer.text = ${textFnSrc}; return renderer; };`
  )(runtime.marked);

  const appRender = (md) => runtime.marked.parse(md, { renderer: buildRenderer() });
  const defaultRender = (md) => runtime.marked.parse(md);

  const html = {};
  for (const key of Object.keys(FIXTURES)) html[key] = appRender(FIXTURES[key]);
  const has = (key, needle) => html[key].includes(needle);

  group('C. list item inline contract (TIGHT)');
  check('H19', 'tight bold item renders <strong>', has('bold', '<li><strong>Bold text</strong></li>'), html.bold.trim());
  check('H20', 'tight italic item renders <em>', has('italic', '<li><em>Italic text</em></li>'), html.italic.trim());
  check('H21', 'tight bold+italic uses semantic parser nesting', has('boldItalic', '<strong>') && has('boldItalic', '<em>') && !html.boldItalic.includes('***'), html.boldItalic.trim());
  check('H22', 'tight strikethrough renders <del>', has('strike', '<del>Strikethrough</del>'), html.strike.trim());
  check('H23', 'tight inline code renders <code>', has('code', '<code>Inline code</code>'), html.code.trim());
  check('H24', 'tight normal link renders <a href>', has('link', '<a href="https://example.com">Example</a>'), html.link.trim());
  check('H25', 'tight wiki link renders wikiLink span (class/data/title)', has('wiki', '<span class="wikiLink" data-wiki-target="Concept" title="Wiki link: Concept">Concept</span>'), html.wiki.trim());
  check('H26', 'tight wiki alias keeps label + target', has('wikiAlias', 'data-wiki-target="Concept"') && has('wikiAlias', '>Visible label</span>'), html.wikiAlias.trim());
  check('H27', 'bold item containing inline code', has('boldCode', '<strong>Bold with <code>code</code></strong>'), html.boldCode.trim());
  check('H28', 'italic item containing normal link', has('italicLink', '<em>Italic with <a href="https://example.com">link</a></em>'), html.italicLink.trim());
  check('H29', 'bold item containing wiki alias', has('boldWiki', '<strong>Bold with <span class="wikiLink"') && has('boldWiki', '>Wiki label</span></strong>'), html.boldWiki.trim());
  check('H30', 'ordered list inline formatting', has('ordered', '<li><strong>Ordered bold</strong></li>'), html.ordered.trim());
  check('H31', 'shipped Welcome ordered list formatting (3 bold runs)', (html.welcomeOrdered.match(/<strong>/g) || []).length === 3, html.welcomeOrdered.trim());
  check('H32', 'nested list inline formatting', has('nested', '<li>nested <strong>bold</strong></li>'), html.nested.trim());

  group('D. task list items and loose lists');
  check('H33', 'open task: checkbox intact + formatted text', has('taskOpen', '<input disabled="" type="checkbox">') && has('taskOpen', 'Open task <strong>bold</strong>'), html.taskOpen.trim());
  check('H34', 'completed task: checked box + formatted text', has('taskDone', '<input checked="" disabled="" type="checkbox">') && has('taskDone', 'Done task <strong>bold</strong>'), html.taskDone.trim());
  check('H35', 'loose list inline formatting', has('loose', '<strong>bold</strong>'), html.loose.trim());
  check('H36', 'loose task: checkbox NOT double-escaped', has('looseTask', '<input checked="" disabled="" type="checkbox">') && !html.looseTask.includes('&amp;lt;'), html.looseTask.trim());
  check('H37', 'loose task: formatted text preserved', has('looseTask', '<strong>bold</strong>'), html.looseTask.trim());
  check('H38', 'loose list wiki link expands', has('looseWiki', '<span class="wikiLink" data-wiki-target="Concept"'), html.looseWiki.trim());

  group('E. invariants');
  const allHtml = Object.keys(FIXTURES).map((k) => html[k]).join('\n');
  check('U1', 'no [object Object] anywhere', !allHtml.includes('[object Object]'));
  check('U2', 'no double-escaped entities anywhere', !/&amp;(lt|gt|quot|amp);/.test(allHtml));
  check('U3', 'deep nesting terminates and renders every inline feature', (() => {
    try {
      return has('deep', '<strong>') && has('deep', '<em>') && has('deep', '<code>') && has('deep', 'wikiLink');
    } catch {
      return false;
    }
  })(), html.deep.trim());
  check('U4', 'no literal Markdown markers in rendered TEXT', Object.keys(FIXTURES).every((k) => !/\*\*|~~|`|\[\[/.test(stripTags(html[k]))), Object.keys(FIXTURES).filter((k) => /\*\*|~~|`|\[\[/.test(stripTags(html[k]))).join(','));

  group('F. parity with the marked default renderer');
  const wikiKeys = ['wiki', 'wikiAlias', 'boldWiki', 'looseWiki', 'deep'];
  const strictKeys = Object.keys(FIXTURES).filter((k) => !wikiKeys.includes(k));
  const strictMismatch = strictKeys.filter((k) => html[k] !== defaultRender(FIXTURES[k]));
  check('P1', 'non-wiki fixtures are byte-identical to marked default output', strictMismatch.length === 0, strictMismatch.join(','));
  const wikiMismatch = wikiKeys.filter((k) => wikiSpansToLiteral(html[k]) !== defaultRender(FIXTURES[k]));
  check('P2', 'wiki fixtures equal marked default output modulo wiki spans', wikiMismatch.length === 0, wikiMismatch.map((k) => `${k}:${wikiSpansToLiteral(html[k]).trim()}`).join(' | '));
  check('P3', 'raw inline HTML parity with default (documented consequence)', html.rawHtml === defaultRender(FIXTURES.rawHtml) && html.rawHtml.includes('<b>'), html.rawHtml.trim());

  group('G. copy-output contracts');
  check('C1', 'code renderer still emits .code-block + copy button', /code-block/.test(codeFnSrc || '') && /copy-btn/.test(codeFnSrc || ''));
  check('C2', 'copy handler still copies rendered text (code.innerText)', /clipboard\.writeText\(code\.innerText/.test(mainSrc));
  check('C3', 'renderable tags present for copied HTML', html.bold.includes('<strong>') && html.link.includes('<a href=') && html.strike.includes('<del>'));

  group('H. negative controls (the fixtures detect the old defect)');
  const legacyFactory = new Function(
    'marked',
    `${escapeHtmlSrc}\n${wikiExpandSrc}\nreturn function buildLegacy() { var renderer = new marked.Renderer(); renderer.text = function (text) { var str = typeof text === 'object' && text !== null ? String(text.text ?? text.raw ?? '') : String(text || ''); return wikiExpand(str) || str; }; return renderer; };`
  )(runtime.marked);
  const legacyRender = (md) => runtime.marked.parse(md, { renderer: legacyFactory() });

  check('N1', 'legacy text-only renderer emits literal markers (defect is detectable)', legacyRender(FIXTURES.bold).includes('**Bold text**'), legacyRender(FIXTURES.bold).trim());
  check('N2', 'legacy renderer diverges from marked default for the same input', legacyRender(FIXTURES.bold) !== defaultRender(FIXTURES.bold));
  check('N3', 'shipped renderer matches marked default where the legacy one does not', appRender(FIXTURES.bold) === defaultRender(FIXTURES.bold));
  check('N4', 'legacy renderer double-escapes loose task checkboxes (defect is detectable)', legacyRender(FIXTURES.looseTask).includes('&amp;lt;') && !appRender(FIXTURES.looseTask).includes('&amp;lt;'), legacyRender(FIXTURES.looseTask).trim());
  check('N5', 'legacy renderer leaves ordered-list formatting literal', legacyRender(FIXTURES.welcomeOrdered).includes('**Journal**') && !appRender(FIXTURES.welcomeOrdered).includes('**Journal**'));

  const failed = printReport('HTML PREVIEW RENDERER VALIDATORS', runtimeLabel);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(`validator crashed: ${error && error.stack ? error.stack : error}`);
  process.exit(1);
});
