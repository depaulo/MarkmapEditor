#!/usr/bin/env node
'use strict';

/**
 * ACT 4 Slice 1 — Canonical File Knowledge Projection validators.
 *
 * Focused validation for js/workspace/file-knowledge-projection.js:
 *   - backlog/todo/ongoing/done task-status semantics via projectFileKnowledgeTasks
 *   - document-scoped isolation (Workspace tasks never leak into current-document)
 *   - Links In / Links Out correctness via getFileKnowledgeLinks
 *   - degraded behavior when MME_TASK_LIFECYCLE / MME_WIKI_LINKS are absent
 *
 * Executes the real projection module (extracted verbatim from
 * js/workspace/file-knowledge-projection.js) together with real shipped
 * owners (MME_TASK_LIFECYCLE from js/tasks/task-lifecycle.js,
 * MME_WIKI_LINKS from js/links/wiki-links.js).
 *
 * Usage: node scripts/file-knowledge-projection-validators.cjs
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

// ---------------------------------------------------------------
// Harness: load real owners + projection module in a Node sandbox
// ---------------------------------------------------------------

const TASK_LIFECYCLE_SOURCE = read('js', 'tasks', 'task-lifecycle.js');
const WIKI_LINKS_SOURCE = read('js', 'links', 'wiki-links.js');
const GRAMMAR_SOURCE = read('js', 'links', 'wiki-link-grammar.js');
const PROJECTION_SOURCE = read('js', 'workspace', 'file-knowledge-projection.js');

const SANDBOX_GLOBALS = [
  'globalThis.window = globalThis;',
  'globalThis.dispatchEvent = () => true;',
  'globalThis.addEventListener = () => {};',
  'window.addEventListener = () => {};',
  'const log = (m) => void 0;',
  'globalThis.log = log;',
  'globalThis.WORKSPACE_INDEX_STATE = { ready: true, files: [], tasks: [], tags: new Set(), links: new Map(), projects: [], byPath: {}, byKind: {}, lastBuiltAt: null };',
].join('\n');

// Build the sandbox script via string concatenation (not template literals)
// to avoid backtick conflicts with interpolated source files.
function runNode(absPath) {
  return execFileSync(process.execPath, [absPath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const VALIDATOR_SCRIPT =
  SANDBOX_GLOBALS + '\n\n' +
  '// ===== REAL OWNER: MME_TASK_LIFECYCLE =====\n' +
  TASK_LIFECYCLE_SOURCE + '\n\n' +
  '// ===== REAL OWNER: MME_WIKI_LINK_GRAMMAR =====' + '\n' +
  GRAMMAR_SOURCE + '\n\n' +
  '// ===== REAL OWNER: MME_WIKI_LINKS =====' + '\n' +
  WIKI_LINKS_SOURCE + '\n\n' +
  '// ===== REAL OWNER: MME_FILE_KNOWLEDGE (projection module) =====\n' +
  PROJECTION_SOURCE + '\n\n' +
  '// ===== VALIDATORS =====\n' +
  'const FK = globalThis.MME_FILE_KNOWLEDGE;\n' +
  'const results = [];\n' +
  'let passed = 0;\n' +
  'let failed = 0;\n' +
  'function check(id, name, ok, detail) {\n' +
  '  const pass = Boolean(ok);\n' +
  '  results.push({ id, name, pass, detail: pass ? \'\' : String(detail == null ? \'\' : detail) });\n' +
  '  if (pass) passed += 1; else failed += 1;\n' +
  '}\n' +
  '\n' +
  '// ---------------------------------------------------------------------------\n' +
  '// Group A: Module publication\n' +
  '// ---------------------------------------------------------------------------\n' +
  "check('A01', 'MME_FILE_KNOWLEDGE published', typeof FK === 'object' && FK !== null);\n" +
  "check('A02', 'projectFileKnowledgeTasks exported', typeof FK.projectFileKnowledgeTasks === 'function');\n" +
  "check('A03', 'getFileKnowledgeLinks exported', typeof FK.getFileKnowledgeLinks === 'function');\n" +
  "check('A04', 'projectFileKnowledge exported', typeof FK.projectFileKnowledge === 'function');\n" +
  '\n' +
  '// ---------------------------------------------------------------------------\n' +
  '// Group B: Task-status semantics via projectFileKnowledgeTasks\n' +
  '// ---------------------------------------------------------------------------\n' +
  '\n' +
  "// Fixture index: four tasks in the active document, one in another file.\n" +
  "const activePath = 'notes/alpha.md';\n" +
  "const otherPath = 'notes/beta.md';\n" +
  '\n' +
  'const indexWithMixedTasks = {\n' +
  '  ready: true,\n' +
  '  tasks: [\n' +
  "    { text: 'Backlog task', done: false, metadata: { status: 'backlog' }, filePath: activePath, fileName: 'alpha.md', fileKind: 'notes', line: 1 },\n" +
  "    { text: 'Todo task', done: false, metadata: {}, filePath: activePath, fileName: 'alpha.md', fileKind: 'notes', line: 2 },\n" +
  "    { text: 'Ongoing task', done: false, metadata: { status: 'ongoing' }, filePath: activePath, fileName: 'alpha.md', fileKind: 'notes', line: 3 },\n" +
  "    { text: 'Done task', done: true, metadata: { completed: '2026-01-01' }, filePath: activePath, fileName: 'alpha.md', fileKind: 'notes', line: 4 },\n" +
  "    { text: 'Workspace backlog', done: false, metadata: { status: 'backlog' }, filePath: otherPath, fileName: 'beta.md', fileKind: 'notes', line: 1 },\n" +
  "    { text: 'Workspace done', done: true, metadata: { completed: '2026-01-01' }, filePath: otherPath, fileName: 'beta.md', fileKind: 'notes', line: 2 },\n" +
  '  ],\n' +
  '};\n' +
  '\n' +
  'const projection = FK.projectFileKnowledgeTasks(indexWithMixedTasks, activePath);\n' +
  '\n' +
  "check('B01', 'backlog card has exactly 1 task from active doc', projection.backlog.length === 1 && projection.backlog[0].text === 'Backlog task');\n" +
  "check('B02', 'backlog task effectiveStatus is backlog', projection.backlog[0] && projection.backlog[0].effectiveStatus === 'backlog');\n" +
  "check('B03', 'open card is Todo only (1 task, mutually exclusive)', projection.open.length === 1 && projection.open[0] && projection.open[0].text === 'Todo task');\n" +
  "check('B03b', 'open card excludes backlog tasks (mutual exclusivity)', !projection.open.some((t) => t.text === 'Backlog task'));\n" +
  "check('B03c', 'open card excludes ongoing tasks (mutual exclusivity)', !projection.open.some((t) => t.text === 'Ongoing task'));\n" +
  "check('B04', 'open card excludes done task', !projection.open.some((t) => t.text === 'Done task'));\n" +
  "check('B05', 'ongoing card has exactly 1 task', projection.ongoing.length === 1 && projection.ongoing[0].text === 'Ongoing task');\n" +
  "check('B06', 'ongoing task effectiveStatus is ongoing', projection.ongoing[0] && projection.ongoing[0].effectiveStatus === 'ongoing');\n" +
  "check('B07', 'done card has exactly 1 task from active doc', projection.done.length === 1 && projection.done[0].text === 'Done task');\n" +
  "check('B08', 'done task effectiveStatus is done', projection.done[0] && projection.done[0].effectiveStatus === 'done');\n" +
  "check('B09', 'no workspace task leaks into current-document cards', projection.backlog.every((t) => t.filePath === activePath) && projection.open.every((t) => t.filePath === activePath) && projection.ongoing.every((t) => t.filePath === activePath) && projection.done.every((t) => t.filePath === activePath));\n" +
  "check('B10', 'all cards are arrays', Array.isArray(projection.backlog) && Array.isArray(projection.open) && Array.isArray(projection.ongoing) && Array.isArray(projection.done));\n" +
  '\n' +
  '// ---------------------------------------------------------------------------\n' +
  '// Group C: Document-scoped isolation (no active path -> empty)\n' +
  '// ---------------------------------------------------------------------------\n' +
  "const emptyProjection = FK.projectFileKnowledgeTasks(indexWithMixedTasks, '');\n" +
  "check('C01', 'empty active path -> all cards empty', emptyProjection.backlog.length === 0 && emptyProjection.open.length === 0 && emptyProjection.ongoing.length === 0 && emptyProjection.done.length === 0);\n" +
  '\n' +
  "const noMatchProjection = FK.projectFileKnowledgeTasks(indexWithMixedTasks, 'notes/nonexistent.md');\n" +
  "check('C02', 'non-matching path -> all cards empty', noMatchProjection.backlog.length === 0 && noMatchProjection.open.length === 0 && noMatchProjection.ongoing.length === 0 && noMatchProjection.done.length === 0);\n" +
  '\n' +
  '// ---------------------------------------------------------------------------\n' +
  '// Group D: Degraded behavior when lifecycle absent\n' +
  '// ---------------------------------------------------------------------------\n' +
  "check('D01', 'degraded returns empty cards when lifecycle missing', (() => {\n" +
  '  const saved = globalThis.MME_TASK_LIFECYCLE;\n' +
  '  globalThis.MME_TASK_LIFECYCLE = null;\n' +
  '  try {\n' +
  '    const r = FK.projectFileKnowledgeTasks(indexWithMixedTasks, activePath);\n' +
  '    return r.backlog.length === 0 && r.open.length === 0 && r.ongoing.length === 0 && r.done.length === 0;\n' +
  '  } finally {\n' +
  '    globalThis.MME_TASK_LIFECYCLE = saved;\n' +
  '  }\n' +
  '})());\n' +
  '\n' +
  '// ---------------------------------------------------------------------------\n' +
  '// Group E: Links In / Links Out\n' +
  '// ---------------------------------------------------------------------------\n' +
  'const indexWithLinks = {\n' +
  '  ready: true,\n' +
  '  files: [\n' +
  "    { path: 'notes/alpha.md', title: 'Alpha', conceptLinks: [['notes/gamma.md']] },\n" +
  "    { path: 'notes/beta.md', title: 'Beta', conceptLinks: [] },\n" +
  "    { path: 'notes/gamma.md', title: 'Gamma', conceptLinks: [] },\n" +
  '  ],\n' +
  '  tasks: [],\n' +
  '  tags: new Set(),\n' +
  '  links: new Map(),\n' +
  '  projects: [],\n' +
  '  byPath: {},\n' +
  '  byKind: {},\n' +
  '  lastBuiltAt: null,\n' +
  '};\n' +
  '\n' +
  "// Links Out for alpha.md: declares a wiki link to gamma.md\n" +
  'const linksResult = FK.getFileKnowledgeLinks(activePath, indexWithLinks, \'See [[gamma.md]] for details\', \'Alpha\');\n' +
  '\n' +
  "check('E01', 'linksOut available', linksResult.linksOut.available === true);\n" +
  "check('E02', 'linksOut sourcePath matches', linksResult.linksOut.sourcePath === activePath);\n" +
  "check('E03', 'linksOut has 1 relationship', Array.isArray(linksResult.linksOut.relationships) && linksResult.linksOut.relationships.length === 1);\n" +
  "check('E04', 'linksOut relationship targetPath is gamma.md', linksResult.linksOut.relationships[0] && linksResult.linksOut.relationships[0].targetPath === 'notes/gamma.md');\n" +
  '\n' +
  "// Links In for gamma.md: alpha.md links to it\n" +
  "const linksInGamma = FK.getFileKnowledgeLinks('notes/gamma.md', indexWithLinks, '', 'Gamma');\n" +
  "check('E05', 'linksIn available for gamma', linksInGamma.linksIn.available === true);\n" +
  "check('E06', 'linksIn has 1 row', Array.isArray(linksInGamma.linksIn.rows) && linksInGamma.linksIn.rows.length === 1);\n" +
  "check('E07', 'linksIn row sourcePath is alpha.md', linksInGamma.linksIn.rows[0] && linksInGamma.linksIn.rows[0].sourcePath === 'notes/alpha.md');\n" +
  '\n' +
  '// ---------------------------------------------------------------------------\n' +
  '// Group F: Combined projection\n' +
  '// ---------------------------------------------------------------------------\n' +
  'const combined = FK.projectFileKnowledge(indexWithMixedTasks, activePath, \'See [[gamma.md]]\', \'Alpha\');\n' +
  "check('F01', 'combined has tasks object', typeof combined.tasks === 'object' && combined.tasks !== null);\n" +
  "check('F02', 'combined has links object', typeof combined.links === 'object' && combined.links !== null);\n" +
  "check('F03', 'combined tasks.backlog is array', Array.isArray(combined.tasks.backlog));\n" +
  "check('F04', 'combined links.linksOut.available is boolean', typeof combined.links.linksOut.available === 'boolean');\n" +
  '\n' +
  '// ---------------------------------------------------------------------------\n' +
  '// Report\n' +
  '// ---------------------------------------------------------------------------\n' +
  "console.log('\\n=== ACT 4 Slice 1 — File Knowledge Projection Validators ===');\n" +
  "console.log('Passed: ' + passed + ' / ' + results.length);\n" +
  "console.log('Failed: ' + failed);\n" +
  'for (const r of results) {\n' +
  "  if (r.group) { console.log('\\n-- ' + r.group + ' --'); continue; }\n" +
  "  const mark = r.pass ? 'PASS' : 'FAIL';\n" +
  "  console.log('  ' + mark + ' ' + r.id + ' - ' + r.name + (r.detail ? ' | ' + r.detail : ''));\n" +
  '}\n' +
  'process.exit(failed > 0 ? 1 : 0);\n';

// Write to a temp file and run
const tmpFile = path.join(ROOT, 'tmp', 'fk-validate-tmp.cjs');
try { fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true }); } catch (e) {}

fs.writeFileSync(tmpFile, VALIDATOR_SCRIPT, 'utf8');

const output = runNode(tmpFile);
process.stdout.write(output);

// Parse exit-ish: if any FAIL appears, exit 1
const hasFail = /FAIL/.test(output);
fs.unlinkSync(tmpFile);
process.exit(hasFail ? 1 : 0);
