#!/usr/bin/env node
'use strict';

/**
 * ACT 1C — saved Note parser + single Workspace Index validators.
 *
 * Executes the REAL shipped owners in Node (package.json is type=module):
 *   - js/workspace/workspace-parser.js (parseWorkspaceDocument + metadata READ
 *     contract; its main.js helper dependencies are extracted verbatim from
 *     js/main.js and evaluated — nothing is re-implemented);
 *   - js/main.js                      (WORKSPACE_INDEX_STATE, buildWorkspaceIndex,
 *     scheduleWorkspaceIndexRebuild, getMarkdownTitle — extracted verbatim
 *     from shipped source and evaluated against recording shims);
 *   - js/workspace/workspace-scanner.js (eligibility for the .MD fixture);
 *   - js/workspace/workspace-controller.js (driven through its own global
 *     WORKSPACE_API for the activation → Index lifecycle scenarios).
 *
 * Contract under test (ACT 1C):
 *   - saved parser: title (first valid H1 → basename), strict date contract
 *     (frontmatter date → exactly dated filename → ''), knowledge/pinned/
 *     archived boolean READ with safe defaults, tags unchanged, no writers;
 *   - one canonical Index over WORKSPACE_STATE.files.notes: one record per
 *     physical file, one byPath entry, one byKind.notes entry, aggregated
 *     tasks/tags/links/projects, deterministic task order;
 *   - transactional build: local structures → one assignment boundary →
 *     ready last → mme-workspace-index-ready once, never recursive;
 *   - no WORKSPACE_STATE.files.notes mutation, no filesystem writes;
 *   - activation triggers exactly one build; rejected/failed candidates
 *     preserve the previous Index; no consumer adaptation in Index code.
 *
 * Usage: node scripts/workspace-index-notes-validators.cjs
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const MAIN_PATH = path.join(ROOT, 'js', 'main.js');
const PARSER_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-parser.js');
const SCANNER_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-scanner.js');
const CONTROLLER_PATH = path.join(ROOT, 'js', 'workspace', 'workspace-controller.js');

const MAIN_SOURCE = fs.readFileSync(MAIN_PATH, 'utf8');
const PARSER_SOURCE = fs.readFileSync(PARSER_PATH, 'utf8');
const CONTROLLER_SOURCE = fs.readFileSync(CONTROLLER_PATH, 'utf8');

// The neutral activation text is restated here as an independent expectation.
const WORKSPACE_INDEX_READY_MESSAGE =
  'Workspace notes/ index ready. Existing feature adaptation continues in the next package.';

const results = [];
function check(id, name, ok, detail) {
  results.push({ id, name, ok: Boolean(ok), detail: detail == null ? '' : String(detail) });
}
function group(title) {
  results.push({ group: title });
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n');
}

// ---------------------------------------------------------------
// Verbatim extraction of top-level main.js code (col-0 boundaries)
// ---------------------------------------------------------------

// Returns the source from startMarker through the first line that is exactly
// `endLine` (main.js closes every top-level block at column 0).
function extractBlock(startMarker, endLine = '}') {
  const start = MAIN_SOURCE.indexOf(startMarker);
  if (start === -1) return '';

  let lineStart = MAIN_SOURCE.indexOf('\n', start);
  if (lineStart === -1) return '';
  lineStart += 1;

  while (lineStart <= MAIN_SOURCE.length) {
    const nl = MAIN_SOURCE.indexOf('\n', lineStart);
    const lineEnd = nl === -1 ? MAIN_SOURCE.length : nl;
    const line = MAIN_SOURCE.slice(lineStart, lineEnd);

    if (line === endLine) return MAIN_SOURCE.slice(start, lineEnd);
    if (nl === -1) break;

    lineStart = nl + 1;
  }

  return '';
}

function extractLine(marker) {
  const start = MAIN_SOURCE.indexOf(marker);
  if (start === -1) return '';
  const nl = MAIN_SOURCE.indexOf('\n', start);
  return MAIN_SOURCE.slice(start, nl === -1 ? undefined : nl);
}

// ---------------------------------------------------------------
// window / document / app shims with recording
// ---------------------------------------------------------------

function createHarnessState() {
  return {
    logs: [],
    toasts: [],
    textDocuments: [],
    confirmPrompts: [],
    storageWrites: [],
    navigation: { clear: 0, seed: 0, restore: 0 },
    parseCalls: [],
    events: {
      indexReady: 0,
      totalIndexReady: 0,
      readyAtDispatch: null,
      filesAtDispatch: null,
    },
  };
}

const harness = createHarnessState();

function installShims() {
  function defineGlobal(name, value) {
    try {
      globalThis[name] = value;
      if (globalThis[name] === value) return;
    } catch {
      // fall through to defineProperty
    }

    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }

  globalThis.window = globalThis;

  globalThis.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: () => ({
      setAttribute() {},
      appendChild() {},
      remove() {},
      style: {},
      dataset: {},
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    }),
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
    body: { appendChild() {} },
    documentElement: { classList: { add() {}, remove() {}, toggle() {}, contains: () => false } },
  };

  defineGlobal('localStorage', {
    getItem: () => null,
    setItem() {},
    removeItem() {},
  });

  globalThis.MME_APP = {
    log: (message) => harness.logs.push(String(message)),
    showToast: (message, type, ms) =>
      harness.toasts.push({ message: String(message), type, ms }),
    openTextDocument: (payload) => harness.textDocuments.push(payload),
    confirmDiscardIfDirty: () => true,
    setCurrentEditorTextSafe: () => true,
  };

  globalThis.MME_NAVIGATION = { isNavigationInProgress: () => false };
  globalThis.showToast = (message, type, ms) =>
    harness.toasts.push({ message: String(message), type, ms });
  globalThis.log = (message) => harness.logs.push(String(message));
  globalThis.currentSaveHandle = null;

  defineGlobal('confirm', (message) => {
    harness.confirmPrompts.push(String(message));
    return true;
  });

  // window (=== globalThis) event surface: counts index-ready dispatches and
  // records the Index state observed AT dispatch time.
  globalThis.addEventListener = () => {};
  globalThis.removeEventListener = () => {};
  globalThis.dispatchEvent = (event) => {
    if (event && event.type === 'mme-workspace-index-ready') {
      harness.events.indexReady += 1;
      harness.events.totalIndexReady += 1;
      const index = globalThis.WORKSPACE_INDEX_STATE;
      harness.events.readyAtDispatch = index ? index.ready : null;
      harness.events.filesAtDispatch = index ? index.files : null;
    }
    return true;
  };

  // Existing render/finalizer entrypoints called by buildWorkspaceIndex();
  // stubs prove the builder itself performs no consumer adaptation.
  [
    'renderWorkspaceIndexSummary',
    'renderWorkspaceActivePanel',
    'renderWorkspaceTasksPanel',
    'renderWorkspaceRelatedPanel',
    'renderWorkspaceTagsPanel',
    'updateWorkspaceJournalSidebarTitlesFromIndex',
    'renderWorkspaceJournalTimeline',
  ].forEach((name) => {
    globalThis[name] = function stubRender() {};
  });
}

function resetHarness() {
  harness.logs.length = 0;
  harness.toasts.length = 0;
  harness.textDocuments.length = 0;
  harness.confirmPrompts.length = 0;
  harness.storageWrites.length = 0;
  harness.navigation.clear = 0;
  harness.navigation.seed = 0;
  harness.navigation.restore = 0;
  harness.parseCalls.length = 0;
  harness.events.indexReady = 0;
  harness.events.readyAtDispatch = null;
  harness.events.filesAtDispatch = null;
}

// ---------------------------------------------------------------
// Recording handles (reads execute; writes record and refuse)
// ---------------------------------------------------------------

function createFileRecorder() {
  return { contentReads: [], writeCalls: [], permissions: [], iterations: [] };
}

// A file handle with real content (ACT 1C reads content) while every
// mutating API records and refuses.
function makeFileHandle(name, content, recorder) {
  return {
    kind: 'file',
    name,
    async getFile() {
      recorder.contentReads.push(`getFile(${name})`);
      return { text: async () => content, size: String(content).length };
    },
    async createWritable() {
      recorder.writeCalls.push(`file.createWritable(${name})`);
      throw new Error('createWritable is never authorized in ACT 1C');
    },
  };
}

function makeDirectoryHandle({ name, entries = [], recorder, options = {} }) {
  return {
    kind: 'directory',
    name,
    async *values() {
      recorder.iterations.push(name);

      if (options.permissionError) {
        const error = new Error('simulated permission failure');
        error.name = options.permissionError;
        throw error;
      }

      let seen = 0;

      for (const entry of entries) {
        if (options.throwAfter !== undefined && seen >= options.throwAfter) {
          throw new Error('simulated iteration failure');
        }
        seen += 1;
        yield entry;
      }
    },
    async getDirectoryHandle(childName, opts) {
      if (opts && opts.create) {
        recorder.writeCalls.push(`getDirectoryHandle(${childName},{create:true})`);
        throw new Error('directory creation is never authorized in ACT 1C');
      }

      recorder.writeCalls.push(`getDirectoryHandle(${childName})`);
      throw new Error(`getDirectoryHandle(${childName}) without create is unexpected here`);
    },
    async getFileHandle(childName) {
      recorder.writeCalls.push(`getFileHandle(${childName})`);
      throw new Error('getFileHandle is never authorized in ACT 1C');
    },
    async removeEntry(childName) {
      recorder.writeCalls.push(`removeEntry(${childName})`);
      throw new Error('removeEntry is never authorized in ACT 1C');
    },
    async queryPermission() {
      recorder.permissions.push('queryPermission');
      return 'granted';
    },
    async requestPermission() {
      recorder.permissions.push('requestPermission');
      return 'granted';
    },
  };
}

// ---------------------------------------------------------------
// Real owner loading (verbatim main.js helpers + shipped parser)
// ---------------------------------------------------------------

const PARSER_HELPER_MARKERS = [
  'function normalizeParserText(value) {',
  'function stripMarkdownHeadingPrefix(line) {',
  'function countWords(text) {',
  'function normalizeTagValue(value) {',
  'function parseMarkdownHeadings(text) {',
  'function removeFencedCodeBlocks(text) {',
  "function getMarkdownTitle(text, fallback = '') {",
  'function stripYamlFrontmatterForTags(text) {',
  'function normalizeMetadataKey(key) {',
  'function parseMmeTaskMetadata(rawLine) {',
  'function cleanTaskText(rawMatch3) {',
  'function parseMarkdownTasks(text) {',
  'function normalizeConceptName(value) {',
  'function parseConceptLinks(text) {',
  'function parseVisibleHeaderFields(text) {',
];

function loadParserHelpers() {
  const sources = PARSER_HELPER_MARKERS.map((marker) => {
    const source = extractBlock(marker);
    if (!source) throw new Error(`main.js helper not extractable: ${marker}`);
    return source;
  });

  const names = PARSER_HELPER_MARKERS.map((marker) =>
    marker.slice('function '.length, marker.indexOf('('))
  );

  const api = new Function(
    `${sources.join('\n\n')}\nreturn { ${names.join(', ')} };`
  )();

  Object.assign(globalThis, api);

  return names;
}

// Evaluates the shipped IIFE (it publishes WORKSPACE_PARSER on window/globalThis).
function loadParser() {
  new Function(PARSER_SOURCE)();
}

function parseNote(name, text) {
  return globalThis.WORKSPACE_PARSER.parseWorkspaceDocument({
    kind: 'notes',
    name,
    path: `notes/${name}`,
    text,
  });
}

// ---------------------------------------------------------------
// Verbatim extraction of the Index owner from main.js
// ---------------------------------------------------------------

function buildIndexApi() {
  const parts = [
    extractBlock('const WORKSPACE_INDEX_STATE = {', '};'),
    extractBlock('try {\n  window.WORKSPACE_INDEX_STATE', '} catch {}'),
    extractBlock('async function readWorkspaceFileText(file) {'),
    extractBlock('async function buildWorkspaceIndex() {'),
    extractLine('let __workspaceIndexTimer = null;'),
    extractBlock("function scheduleWorkspaceIndexRebuild(reason = 'scheduled') {"),
    'return { WORKSPACE_INDEX_STATE, buildWorkspaceIndex, scheduleWorkspaceIndexRebuild, readWorkspaceFileText };',
  ];

  for (const part of parts) {
    if (!part) throw new Error('main.js Index owner section not extractable');
  }

  return new Function(parts.join('\n\n'))();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}

// ---------------------------------------------------------------
// Runner
// ---------------------------------------------------------------

(async () => {
  installShims();

  const helperNames = loadParserHelpers();
  loadParser();

  const scannerModule = await import(pathToFileURL(SCANNER_PATH).href);

  group('Group P — saved parser fixtures (real parseWorkspaceDocument)');

  check(
    'P01',
    'note without frontmatter: title from H1, empty date, all flags false',
    (() => {
      const rec = parseNote('note.md', '# First Heading\n\nBody paragraph.');
      return (
        rec.title === 'First Heading' &&
        rec.date === '' &&
        rec.knowledge === false &&
        rec.pinned === false &&
        rec.archived === false &&
        rec.kind === 'notes' &&
        rec.path === 'notes/note.md'
      );
    })(),
    JSON.stringify(parseNote('note.md', '# First Heading').title)
  );

  check(
    'P02',
    'frontmatter date is read when valid YYYY-MM-DD',
    parseNote('x.md', '---\ndate: 2026-09-24\n---\n\n# Dated').date === '2026-09-24'
  );

  check(
    'P03',
    'exact dated filename falls back to its date',
    parseNote('2026-09-25.md', '# Plain').date === '2026-09-25'
  );

  check(
    'P04',
    'descriptive filenames never infer a date',
    parseNote('meeting-2026-09-25.md', '# M').date === '' &&
      parseNote('2026-09-25-client.md', '# C').date === ''
  );

  check(
    'P05',
    'frontmatter date overrides the dated filename',
    parseNote('2026-09-25.md', '---\ndate: 2026-09-24\n---\n\n# O').date === '2026-09-24'
  );

  check(
    'P06',
    'knowledge true in frontmatter reads true',
    parseNote('k.md', '---\nknowledge: true\n---\n\n# K').knowledge === true
  );

  check(
    'P07',
    'knowledge absent reads false',
    parseNote('k.md', '# K').knowledge === false
  );

  check(
    'P08',
    'knowledge false reads false',
    parseNote('k.md', '---\nknowledge: false\n---\n\n# K').knowledge === false
  );

  check(
    'P09',
    'pinned true in frontmatter reads true',
    parseNote('p.md', '---\npinned: true\n---\n\n# P').pinned === true
  );

  check(
    'P10',
    'pinned absent reads false',
    parseNote('p.md', '# P').pinned === false
  );

  check(
    'P11',
    'archived true in frontmatter reads true',
    parseNote('a.md', '---\narchived: true\n---\n\n# A').archived === true
  );

  check(
    'P12',
    'archived absent reads false',
    parseNote('a.md', '# A').archived === false
  );

  check(
    'P13',
    'tags preserved exactly (frontmatter + body, sorted)',
    JSON.stringify(
      parseNote('t.md', '---\ntags: [alpha, beta]\n---\n\n# T\n\ntagged line #gamma').tags
    ) === JSON.stringify(['alpha', 'beta', 'gamma'])
  );

  check(
    'P14',
    'unknown frontmatter keys do not affect managed read fields',
    (() => {
      const rec = parseNote(
        'u.md',
        '---\nauthor: Someone\nstatus: published\ncolor: blue\n---\n\n# U'
      );
      return rec.date === '' && rec.knowledge === false && rec.pinned === false &&
        rec.archived === false && rec.title === 'U';
    })()
  );

  check(
    'P15',
    'malformed frontmatter returns safe classification defaults',
    (() => {
      const brokenShape = parseNote(
        'm.md',
        '---\ndate: [oops\nknowledge: maybe\npinned: 1\narchived: \'\'\n---\n\n# Safe'
      );
      const unterminated = parseNote('m.md', '---\ndate: 2026-01-01\n# No Close');
      return (
        brokenShape.date === '' &&
        brokenShape.knowledge === false &&
        brokenShape.pinned === false &&
        brokenShape.archived === false &&
        brokenShape.title === 'Safe' &&
        unterminated.date === '' &&
        unterminated.knowledge === false &&
        unterminated.title === 'No Close'
      );
    })(),
    JSON.stringify(parseNote('m.md', '---\ndate: [oops\n---\n\n# Safe'))
  );

  check(
    'P16',
    'first valid H1 wins across multiple H1 headings',
    parseNote('multi.md', '# Alpha\n\nintro\n\n# Beta').title === 'Alpha'
  );

  check(
    'P17',
    'H2 without H1 falls back to the filename basename',
    parseNote('fallback-note.md', '## Only H2\n\nbody').title === 'fallback-note'
  );

  check(
    'P18',
    'empty H1 falls back to the basename',
    parseNote('empty-h1.md', '# \n\n## Sub\n\nbody').title === 'empty-h1'
  );

  check(
    'P19',
    'Unicode H1 becomes the title',
    parseNote('unicode.md', '# 日本語のノート — テスト\n\nbody').title === '日本語のノート — テスト'
  );

  check(
    'P20',
    'fenced-code H1 never becomes the title (backtick, only-code, tilde)',
    parseNote('fenced.md', '```md\n# Not A Title\n```\n\n# Real Title').title === 'Real Title' &&
      parseNote('fenced-only.md', '```\n# Only Coded\n```').title === 'fenced-only' &&
      parseNote('tilde.md', '~~~\n# Coded Tilde\n~~~\n# Real').title === 'Real'
  );

  check(
    'P21',
    'duplicate H1 across two files preserves distinct paths',
    (() => {
      const one = { ...parseNote('one.md', '# Same'), path: 'notes/one.md' };
      const two = { ...parseNote('two.md', '# Same'), path: 'notes/two.md' };
      return one.title === two.title && one.path !== two.path;
    })()
  );

  check(
    'P22',
    '.MD extension behaves like ACT 1B (eligibility, basename, dated filename)',
    scannerModule.isEligibleNoteEntry({ kind: 'file', name: 'NOTE.MD' }) === true &&
      parseNote('NOTE.MD', '# Upper').title === 'Upper' &&
      parseNote('2026-09-25.MD', '# Upper Date').date === '2026-09-25' &&
      scannerModule.isEligibleNoteEntry({ kind: 'file', name: 'note.txt' }) === false
  );

  const PARSER_ACT1C_CODE = stripComments(
    PARSER_SOURCE.slice(
      PARSER_SOURCE.indexOf('// ACT 1C — saved Note metadata READ contract'),
      PARSER_SOURCE.indexOf('function parseWorkspaceDocument')
    )
  );

  check(
    'P23',
    'the parser ACT 1C section holds no writer and no second title source',
    PARSER_ACT1C_CODE.length > 0 &&
      !/(createWritable|removeEntry|getDirectoryHandle|getFileHandle|create:\s*true)/.test(
        PARSER_ACT1C_CODE
      ) &&
      !PARSER_SOURCE.includes('displayTitle')
  );

  check(
    'P24',
    'helpers exercised above are verbatim shipped main.js code',
    helperNames.length === PARSER_HELPER_MARKERS.length &&
      helperNames.every((name) => typeof globalThis[name] === 'function') &&
      extractBlock("function getMarkdownTitle(text, fallback = '') {").includes(
        'removeFencedCodeBlocks(text)'
      )
  );

  // -------------------------------------------------------------
  // Group I — single Workspace Index over files.notes (real builder)
  // -------------------------------------------------------------

  group('Group I — saved Index build (real buildWorkspaceIndex)');

  const indexApi = buildIndexApi();
  const IDX = indexApi.WORKSPACE_INDEX_STATE;

  // Counts parseWorkspaceDocument invocations: exactly once per record.
  const realParse = globalThis.parseWorkspaceDocument;
  globalThis.parseWorkspaceDocument = (args) => {
    harness.parseCalls.push(args.path);
    return realParse(args);
  };

  let buildRuns = 0;
  async function runBuild() {
    buildRuns += 1;
    return await indexApi.buildWorkspaceIndex();
  }

  const indexRecorder = createFileRecorder();

  function seedIndexWorkspace(contents, options = {}) {
    const records = Object.entries(contents).map(([name, content]) => ({
      kind: 'notes',
      name,
      path: `notes/${name}`,
      handle: options.handles && options.handles[name]
        ? options.handles[name]
        : makeFileHandle(name, content, indexRecorder),
    }));

    globalThis.WORKSPACE_STATE = {
      rootHandle: { kind: 'directory', name: options.rootName || 'Workspace' },
      rootName: options.rootName || 'Workspace',
      folders: { notes: { kind: 'directory', name: 'notes' } },
      files: { notes: records },
      activeFile: null,
    };

    return records;
  }

  function resetIndexToNoWorkspace() {
    globalThis.WORKSPACE_STATE = { rootHandle: null };
    return indexApi.buildWorkspaceIndex();
  }

  await resetIndexToNoWorkspace();

  check(
    'I23',
    'zero-note Workspace: ready is false before the build starts',
    (() => {
      seedIndexWorkspace({});
      return IDX.ready === false;
    })()
  );

  await runBuild();

  check(
    'I23b',
    'zero-note Workspace: ready only after build, empty collections, one dispatch',
    IDX.ready === true &&
      IDX.files.length === 0 &&
      IDX.byPath.size === 0 &&
      IDX.byKind.notes.length === 0 &&
      harness.events.indexReady === 1
  );

  seedIndexWorkspace({ 'single.md': '# Single\n\n- [ ] t1' });
  const oneNoteRecords = globalThis.WORKSPACE_STATE.files.notes;
  await runBuild();

  check(
    'I24',
    'one Note: one record, one byPath entry, one byKind.notes entry',
    IDX.files.length === 1 &&
      IDX.byPath.size === 1 &&
      IDX.byKind.notes.length === 1 &&
      IDX.byPath.get('notes/single.md') === IDX.files[0] &&
      IDX.byKind.notes[0] === IDX.files[0] &&
      IDX.files[0].title === 'Single'
  );

  check(
    'I25',
    'seeding the next Workspace does not disturb the previous Index snapshot',
    (() => {
      seedIndexWorkspace({
        'a.md': '# Alpha\n\n- [ ] a1\n- [x] a2\n\nhas #alpha and #shared tags\n\nSee [[Alpha]] and [[Shared]]\n\nProject: Alpha One\nValue: 10\nCurrency: USD',
        'b.md': '# Beta\n\n- [ ] b1\n\nhas #shared and #beta tags\n\nSee [[Shared]]',
        'c.md': '# Gamma',
      });
      // The previous single-note snapshot is still published (transactional).
      return IDX.files.length === 1 && IDX.ready === true;
    })()
  );

  const multiRecords = globalThis.WORKSPACE_STATE.files.notes;
  resetHarness();
  await runBuild();

  check(
    'I25b',
    'several Notes: files/byPath/byKind.notes all complete',
    IDX.files.length === 3 &&
      IDX.byPath.size === 3 &&
      IDX.byKind.notes.length === 3
  );

  check(
    'I26',
    'each physical file appears exactly once and is parsed exactly once',
    new Set(IDX.files.map((f) => f.path)).size === 3 &&
      harness.parseCalls.length === 3 &&
      new Set(harness.parseCalls).size === 3 &&
      JSON.stringify(IDX.files.map((f) => f.name)) ===
        JSON.stringify(['a.md', 'b.md', 'c.md'])
  );

  check(
    'I27',
    'byPath contains every path exactly once, identity-matching files',
    IDX.byPath.size === 3 &&
      IDX.files.every((f, i) => IDX.byPath.get(f.path) === IDX.files[i])
  );

  check(
    'I28',
    'byKind.notes contains every Note exactly once in files order',
    IDX.byKind.notes.length === 3 &&
      IDX.byKind.notes.every((rec, i) => rec === IDX.files[i])
  );

  check(
    'I29',
    'no authoritative journals/concepts bucket exists',
    JSON.stringify(Object.keys(IDX.byKind)) === JSON.stringify(['notes']) &&
      !('journals' in IDX.byKind) &&
      !('concepts' in IDX.byKind)
  );

  check(
    'I30',
    'knowledge/pinned/archived are boolean fields, never kinds',
    Object.keys(IDX.byKind).every(
      (k) => !['knowledge', 'pinned', 'archived'].includes(k)
    ) &&
      IDX.files.every(
        (f) =>
          typeof f.knowledge === 'boolean' &&
          typeof f.pinned === 'boolean' &&
          typeof f.archived === 'boolean'
      )
  );

  check(
    'I31',
    'tasks aggregated exactly once with source identity',
    IDX.tasks.length === 3 &&
      new Set(IDX.tasks).size === 3 &&
      IDX.tasks.filter((t) => t.filePath === 'notes/a.md').length === 2 &&
      IDX.tasks.filter((t) => t.filePath === 'notes/b.md').length === 1 &&
      IDX.tasks.every((t) => t.fileName && t.fileKind === 'notes')
  );

  check(
    'I32',
    'tags aggregated exactly once per path',
    IDX.tags.get('alpha').length === 1 &&
      IDX.tags.get('alpha')[0] === 'notes/a.md' &&
      JSON.stringify(IDX.tags.get('shared')) ===
        JSON.stringify(['notes/a.md', 'notes/b.md']) &&
      JSON.stringify(IDX.tags.get('beta')) === JSON.stringify(['notes/b.md'])
  );

  check(
    'I33',
    'links aggregated exactly once per path',
    JSON.stringify(IDX.links.get('Alpha')) === JSON.stringify(['notes/a.md']) &&
      JSON.stringify(IDX.links.get('Shared')) ===
        JSON.stringify(['notes/a.md', 'notes/b.md'])
  );

  check(
    'I34',
    'Projects aggregated exactly once with source metadata',
    IDX.projects.length === 1 &&
      IDX.projects[0].sourcePath === 'notes/a.md' &&
      IDX.projects[0].sourceKind === 'notes' &&
      IDX.projects[0].sourceName === 'a.md'
  );

  const firstTaskRun = IDX.tasks.map((t) => `${t.filePath}:${t.line}:${t.text}`);
  await runBuild();
  const secondTaskRun = IDX.tasks.map((t) => `${t.filePath}:${t.line}:${t.text}`);

  check(
    'I35',
    'deterministic task ordering preserved across rebuilds',
    JSON.stringify(secondTaskRun) === JSON.stringify(firstTaskRun) &&
      JSON.stringify(firstTaskRun) ===
        JSON.stringify([
          'notes/a.md:3:a1',
          'notes/a.md:4:a2',
          'notes/b.md:3:b1',
        ]),
    JSON.stringify(firstTaskRun)
  );

  // One unreadable file: documented skip policy (log the exact path, index
  // the rest, never touch the file).
  const blockedHandle = {
    kind: 'file',
    name: 'blocked.md',
    async getFile() {
      const err = new Error('simulated read failure');
      err.name = 'NotAllowedError';
      throw err;
    },
  };
  seedIndexWorkspace(
    { 'good1.md': '# Good One', 'blocked.md': '', 'good2.md': '# Good Two' },
    { handles: { 'blocked.md': blockedHandle } }
  );
  resetHarness();
  await runBuild();

  check(
    'I36',
    'one unreadable file follows the documented skip policy',
    IDX.ready === true &&
      IDX.files.length === 2 &&
      JSON.stringify(IDX.files.map((f) => f.name)) ===
        JSON.stringify(['good1.md', 'good2.md']) &&
      harness.logs.some((line) => line.includes('failed parsing notes/blocked.md')),
    harness.logs.join(' | ')
  );

  // One malformed file: conservative parse, zero filesystem mutation.
  seedIndexWorkspace({
    'ok.md': '# Ok',
    'malformed.md': '---\n:broken line\nno closing fence\n# Malformed Title\n',
    'after.md': '# After',
  });
  resetHarness();
  await runBuild();

  check(
    'I37',
    'one malformed file causes no filesystem mutation and still indexes',
    IDX.files.length === 3 &&
      indexRecorder.writeCalls.length === 0 &&
      indexRecorder.permissions.length === 0,
    JSON.stringify(indexRecorder.writeCalls)
  );

  check(
    'I38',
    'ready is false before the first build completion',
    await (async () => {
      await resetIndexToNoWorkspace();
      return IDX.ready === false && IDX.lastBuiltAt === 0;
    })()
  );

  // Gated read: ready/snapshot must not flip until the read completes.
  const gate = deferred();
  const gatedRecords = seedIndexWorkspace({});
  gatedRecords.push({
    kind: 'notes',
    name: 'gated.md',
    path: 'notes/gated.md',
    handle: {
      kind: 'file',
      name: 'gated.md',
      async getFile() {
        return { text: () => gate.promise, size: 0 };
      },
    },
  });
  globalThis.WORKSPACE_STATE.files.notes = gatedRecords;

  const buildPromise = runBuild();
  await tick();

  const midReady = IDX.ready;
  const midFiles = IDX.files;
  const midLastBuiltAt = IDX.lastBuiltAt;

  gate.resolve('# Gated\n');
  await buildPromise;

  check(
    'I39',
    'ready flips true only after the snapshot is assigned and before dispatch',
    midReady === false &&
      midFiles.length === 0 &&
      midLastBuiltAt === 0 &&
      IDX.ready === true &&
      IDX.files.length === 1 &&
      harness.events.readyAtDispatch === true &&
      harness.events.filesAtDispatch === IDX.files,
    `midReady=${midReady} dispatchReady=${harness.events.readyAtDispatch}`
  );

  resetHarness();
  seedIndexWorkspace({ 'once.md': '# Once' });
  await runBuild();

  check(
    'I40',
    'index-ready dispatched exactly once per completed build',
    harness.events.indexReady === 1 && harness.events.readyAtDispatch === true
  );

  const BUILD_CODE = stripComments(extractBlock('async function buildWorkspaceIndex() {'));
  const FINALIZER_CODE = stripComments(
    MAIN_SOURCE.slice(
      MAIN_SOURCE.indexOf("window.addEventListener('mme-workspace-index-ready'"),
      MAIN_SOURCE.indexOf('__mmeWorkspaceIndexReadyFinalizerBound = true;')
    )
  );

  // Each slice may mention its own entrypoint exactly once (the signature /
  // registration line); anything beyond that would be a re-entry.
  const buildSelfCalls = (BUILD_CODE.match(/buildWorkspaceIndex\s*\(/g) || []).length;
  const buildSchedCalls = (BUILD_CODE.match(/scheduleWorkspaceIndexRebuild\s*\(/g) || [])
    .length;
  const finalizerBuildCalls = (FINALIZER_CODE.match(/buildWorkspaceIndex\s*\(/g) || [])
    .length;
  const finalizerSchedCalls = (FINALIZER_CODE.match(/scheduleWorkspaceIndexRebuild\s*\(/g) || [])
    .length;

  check(
    'I41',
    'no recursive rebuild: neither builder nor finalizer schedules another build',
    BUILD_CODE.length > 0 &&
      buildSelfCalls <= 1 &&
      buildSchedCalls === 0 &&
      FINALIZER_CODE.length > 0 &&
      finalizerBuildCalls === 0 &&
      finalizerSchedCalls === 0 &&
      buildRuns === harness.events.totalIndexReady,
    `buildSelf=${buildSelfCalls} buildSched=${buildSchedCalls} finBuild=${finalizerBuildCalls} finSched=${finalizerSchedCalls} runs=${buildRuns} dispatches=${harness.events.totalIndexReady}`
  );

  const sourceRecords = seedIndexWorkspace({
    'immutable-a.md': '# A',
    'immutable-b.md': '# B',
  });
  const sourceArray = globalThis.WORKSPACE_STATE.files.notes;
  const sourceSnapshots = sourceRecords.map((record) => ({
    record,
    keys: Object.keys(record).join(','),
    path: record.path,
  }));
  await runBuild();

  check(
    'I42',
    'WORKSPACE_STATE.files.notes is never mutated by the build',
    globalThis.WORKSPACE_STATE.files.notes === sourceArray &&
      sourceArray.length === 2 &&
      sourceSnapshots.every(
        (snap) =>
          snap.record === sourceArray[sourceSnapshots.indexOf(snap)] &&
          Object.keys(snap.record).join(',') === snap.keys &&
          snap.record.path === snap.path
      ) &&
      sourceArray.every((r) => Object.keys(r).join(',') === 'kind,name,path,handle')
  );

  check(
    'I43',
    'the Index build performs reads only: zero filesystem writes',
    indexRecorder.writeCalls.length === 0 &&
      indexRecorder.permissions.length === 0 &&
      indexRecorder.contentReads.length > 0,
    JSON.stringify(indexRecorder.writeCalls)
  );

  // Save rebuild entrypoint: same ownership, now proven to target notes/.
  const saveStaticOk = MAIN_SOURCE.includes(
    "globalThis.scheduleWorkspaceIndexRebuild?.('save')"
  );
  const filesBeforeSave = IDX.files;
  seedIndexWorkspace({ 'after-save.md': '# After Save' });
  indexApi.scheduleWorkspaceIndexRebuild('save');
  await sleep(450);

  check(
    'I44',
    'Save rebuild entrypoint targets WORKSPACE_STATE.files.notes',
    saveStaticOk &&
      IDX.files !== filesBeforeSave &&
      IDX.ready === true &&
      IDX.byPath.has('notes/after-save.md') &&
      IDX.files[0].title === 'After Save'
  );

  const OPEN_SLICE_CODE = stripComments(
    CONTROLLER_SOURCE.slice(
      CONTROLLER_SOURCE.indexOf('async function openWorkspace() {'),
      CONTROLLER_SOURCE.indexOf('async function activateWorkspaceAtExistingBoundary(')
    )
  );

  check(
    'I48a',
    'Index code holds no legacy bucket and no hidden consumer adaptation',
    BUILD_CODE.length > 0 &&
      !BUILD_CODE.includes('byKind.journals') &&
      !BUILD_CODE.includes('byKind.concepts') &&
      !BUILD_CODE.includes('files?.journals') &&
      !BUILD_CODE.includes('files?.concepts') &&
      !/MME_TASK_REVIEW|renderNotesPanel|knowledgePanel|pinnedPanel|archivedPanel/.test(
        BUILD_CODE
      )
  );

  check(
    'I48b',
    'the activation lifecycle hides no consumer adaptation',
    OPEN_SLICE_CODE.length > 0 &&
      !/render[A-Z]|finalizeWorkspaceSidebar|ensureWorkspace|MME_TASK_REVIEW/.test(
        OPEN_SLICE_CODE
      ) &&
      OPEN_SLICE_CODE.includes('buildActivatedWorkspaceIndex()')
  );

  check(
    'I48c',
    'Note records keep the minimal contract (no handle, no saved text, no extras)',
    (() => {
      const rec = IDX.files[0];
      const required = [
        'kind', 'name', 'path', 'title', 'date',
        'knowledge', 'pinned', 'archived',
        'tags', 'headings', 'tasks', 'conceptLinks', 'projects',
        'wordCount', 'textLength',
      ];
      return (
        required.every((key) => key in rec) &&
        !('handle' in rec) &&
        !('text' in rec) &&
        !('lastModified' in rec) &&
        !('displayTitle' in rec) &&
        rec.kind === 'notes' &&
        rec.path === 'notes/after-save.md'
      );
    })()
  );

  // -------------------------------------------------------------
  // Group L — activation → Index lifecycle (real controller)
  // -------------------------------------------------------------

  group('Group L — Workspace activation lifecycle (real controller)');

  // Import once: WORKSPACE_API and WORKSPACE_STATE become the shipped objects.
  await import(pathToFileURL(CONTROLLER_PATH).href);

  const WORKSPACE_STATE = globalThis.WORKSPACE_STATE;

  // The REAL builder behind a counted wrapper: scenarios can prove exactly
  // how many builds the controller requested.
  let controllerBuildCalls = 0;
  globalThis.buildWorkspaceIndex = async () => {
    controllerBuildCalls += 1;
    return await indexApi.buildWorkspaceIndex();
  };

  function seedIndexSentinel() {
    const sentinelFiles = [
      { kind: 'notes', name: 'sentinel.md', path: 'notes/sentinel.md', title: 'Sentinel' },
    ];

    IDX.ready = true;
    IDX.lastBuiltAt = 4242;
    IDX.files = sentinelFiles;
    IDX.byPath = new Map([['notes/sentinel.md', sentinelFiles[0]]]);
    IDX.byKind = { notes: sentinelFiles.slice() };
    IDX.tags = new Map([['sentinel', ['notes/sentinel.md']]]);
    IDX.tasks = [{ text: 'sentinel task' }];
    IDX.links = new Map();
    IDX.projects = [];

    return sentinelFiles;
  }

  function indexSentinelIntact(sentinelFiles) {
    return (
      IDX.files === sentinelFiles &&
      IDX.lastBuiltAt === 4242 &&
      IDX.ready === true &&
      IDX.tasks.length === 1 &&
      controllerBuildCalls === 0 &&
      harness.events.totalIndexReady === dispatchesBeforeScenario
    );
  }

  let dispatchesBeforeScenario = 0;
  const controllerRecorder = createFileRecorder();

  // --- I45: ACT 1A rejected candidate preserves the previous Index ---
  resetHarness();
  controllerBuildCalls = 0;
  dispatchesBeforeScenario = harness.events.totalIndexReady;
  const sentinelFiles45 = seedIndexSentinel();

  globalThis.window.showDirectoryPicker = async () =>
    makeDirectoryHandle({
      name: 'LegacyRoot',
      entries: [
        makeDirectoryHandle({ name: 'journals', recorder: controllerRecorder }),
        makeDirectoryHandle({ name: 'concepts', recorder: controllerRecorder }),
      ],
      recorder: controllerRecorder,
    });

  await globalThis.WORKSPACE_API.openWorkspace();

  check(
    'I45',
    'ACT 1A rejected candidate preserves the previous Index and never builds',
    indexSentinelIntact(sentinelFiles45) &&
      harness.logs.some((line) => line.includes('detection status=rejected-legacy')),
    `builds=${controllerBuildCalls} logs=${harness.logs.slice(-2).join(' | ')}`
  );

  // --- I46: ACT 1B scan failure preserves the previous Index ---
  resetHarness();
  controllerBuildCalls = 0;
  dispatchesBeforeScenario = harness.events.totalIndexReady;
  const sentinelFiles46 = seedIndexSentinel();

  const failingNotes = makeDirectoryHandle({
    name: 'notes',
    recorder: controllerRecorder,
    options: { permissionError: 'NotAllowedError' },
  });

  globalThis.window.showDirectoryPicker = async () =>
    makeDirectoryHandle({
      name: 'ScanFailRoot',
      entries: [failingNotes],
      recorder: controllerRecorder,
    });

  await globalThis.WORKSPACE_API.openWorkspace();

  check(
    'I46',
    'ACT 1B scan failure preserves the previous Index and never builds',
    indexSentinelIntact(sentinelFiles46) &&
      harness.logs.some((line) => line.includes('storage activation failed reason=permission')) &&
      controllerRecorder.writeCalls.length === 0,
    `builds=${controllerBuildCalls} logs=${harness.logs.slice(-2).join(' | ')}`
  );

  // --- I47: valid storage activation triggers exactly one Index build ---
  resetHarness();
  controllerBuildCalls = 0;
  dispatchesBeforeScenario = harness.events.totalIndexReady;

  const noteContent1 = [
    '---',
    'date: 2026-09-24',
    'knowledge: true',
    '---',
    '',
    '# Client Meeting',
    '',
    'Notes #client',
    '',
    '- [ ] prepare agenda',
    '',
    'See [[Alpha]]',
    '',
    'Project: Rollout',
    'Value: 42',
    '',
  ].join('\n');

  const noteContent2 = '# Plain Note\n\n- [x] finished task\n';

  const notesDir47 = makeDirectoryHandle({
    name: 'notes',
    entries: [
      makeFileHandle('2026-09-25.md', noteContent1, controllerRecorder),
      makeFileHandle('plain.md', noteContent2, controllerRecorder),
    ],
    recorder: controllerRecorder,
  });

  globalThis.window.showDirectoryPicker = async () =>
    makeDirectoryHandle({
      name: 'WorkspaceC',
      entries: [
        notesDir47,
        makeFileHandle('README.md', '# readme', controllerRecorder),
      ],
      recorder: controllerRecorder,
    });

  await globalThis.WORKSPACE_API.openWorkspace();

  check(
    'I47',
    'valid storage activation triggers exactly one Index build and one dispatch',
    controllerBuildCalls === 1 &&
      harness.events.totalIndexReady === dispatchesBeforeScenario + 1 &&
      IDX.ready === true,
    `builds=${controllerBuildCalls}`
  );

  check(
    'I47b',
    'the built snapshot is the saved notes/ Index with parsed metadata',
    IDX.byPath.size === 2 &&
      IDX.byKind.notes.length === 2 &&
      IDX.byPath.has('notes/2026-09-25.md') &&
      IDX.byPath.has('notes/plain.md') &&
      IDX.byPath.get('notes/2026-09-25.md').date === '2026-09-24' &&
      IDX.byPath.get('notes/2026-09-25.md').knowledge === true &&
      IDX.byPath.get('notes/2026-09-25.md').title === 'Client Meeting' &&
      IDX.tasks.length === 2 &&
      IDX.tags.has('client') &&
      IDX.links.has('Alpha') &&
      IDX.projects.length === 1 &&
      IDX.projects[0].sourcePath === 'notes/2026-09-25.md',
    JSON.stringify(IDX.files.map((f) => f.path))
  );

  check(
    'I47c',
    'storage records remain physical-only after the build (no parser fields merged)',
    WORKSPACE_STATE.rootName === 'WorkspaceC' &&
      Array.isArray(WORKSPACE_STATE.files.notes) &&
      WORKSPACE_STATE.files.notes.length === 2 &&
      WORKSPACE_STATE.files.notes.every(
        (record) => Object.keys(record).join(',') === 'kind,name,path,handle'
      ) &&
      WORKSPACE_STATE.activeFile === null
  );

  check(
    'I47d',
    'storage and Index readiness reported honestly (one neutral toast)',
    harness.toasts.length === 1 &&
      harness.toasts[0].type === 'warn' &&
      harness.toasts[0].message === WORKSPACE_INDEX_READY_MESSAGE &&
      harness.logs.some((line) => line.includes('storage activated')) &&
      harness.logs.some((line) => line.includes('index=ready')),
    JSON.stringify(harness.toasts)
  );

  check(
    'I47e',
    'activation build reads only the discovered notes (no writes, no README read)',
    controllerRecorder.writeCalls.length === 0 &&
      controllerRecorder.permissions.length === 0 &&
      controllerRecorder.contentReads.length === 2 &&
      JSON.stringify(controllerRecorder.contentReads) ===
        JSON.stringify(['getFile(2026-09-25.md)', 'getFile(plain.md)']),
    JSON.stringify(controllerRecorder.contentReads)
  );

  // -------------------------------------------------------------
  // Report
  // -------------------------------------------------------------

  const failed = results.filter((entry) => !entry.group && !entry.ok);
  const passed = results.filter((entry) => !entry.group && entry.ok);

  for (const entry of results) {
    if (entry.group) {
      console.log(`\n${entry.group}`);
      continue;
    }

    console.log(
      `${entry.ok ? 'PASS' : 'FAIL'} [${entry.id}] ${entry.name}${entry.ok ? '' : ` — ${entry.detail}`}`
    );
  }

  console.log(
    `\nWORKSPACE INDEX NOTES VALIDATORS: ${passed.length} passed, ${failed.length} failed`
  );
  process.exitCode = failed.length === 0 ? 0 : 1;
})().catch((error) => {
  console.error('WORKSPACE INDEX NOTES VALIDATORS: harness error', error);
  process.exitCode = 1;
});

