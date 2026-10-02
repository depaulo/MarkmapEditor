#!/usr/bin/env node
'use strict';

/**
 * ACT 4B — FOCUSED COLLAPSE CORRECTION fixtures.
 *
 * TWO INDEPENDENT DEFECTS, proven separately and corrected separately:
 *
 *   A. GLOBAL (whole-Sidebar) collapse produced a 52px column that still
 *      rendered text (composition label, filename / root name, section
 *      headings, action descriptions), i.e. clipped content instead of a clean
 *      icon rail — in BOTH the Standalone Note and the Workspace composition.
 *   B. CHILD panel collapse worked in Workspace and did nothing in Standalone
 *      Note, because the ONE existing delegated owner was only ever installed
 *      from finalizeWorkspaceSidebar(), which is Workspace-gated.
 *
 * The child-collapse fixtures (CC01-CC13) EXECUTE the real shipped owners
 * (extracted verbatim from js/main.js and js/workspace/workspace-controller.js)
 * against a DOM built from the shipped sidebar markup, and read REAL computed
 * `display` from the shipped CSS through the mini cascade below.
 *
 * The global-collapse fixtures (GC01-GC14) evaluate the shipped CSS against the
 * shipped markup with the collapsed and expanded class states, and execute the
 * real global-collapse owner to prove it never touches child-panel or width
 * state.
 *
 * Usage: node scripts/collapse-validators.cjs
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

const MAIN_SOURCE = read('js', 'main.js');
const CSS_SOURCE = read('css', 'workspace.css');
const INDEX_HTML = read('index.html');
const CONTROLLER_SOURCE = read('js', 'workspace', 'workspace-controller.js');
const TASK_REVIEW_SOURCE = read('js', 'workspace', 'task-review.js');

const results = [];

// A fixture may be a value, a thunk or a promise. A thunk MUST be invoked:
// coercing a function with Boolean() would report every fixture as passing
// without ever evaluating it (the bug this suite would otherwise ship).
function record(id, name, ok, detail) {
  let text = '';
  if (!ok) {
    try {
      text = typeof detail === 'function' ? String(detail()) : detail == null ? '' : String(detail);
    } catch (e) {
      text = e && e.message ? e.message : String(e);
    }
  }
  results.push({ id, name, ok: Boolean(ok), detail: text });
}

function check(id, name, ok, detail) {
  let value = ok;
  if (typeof value === 'function') {
    try {
      value = value();
    } catch (e) {
      record(id, name, false, () => (e && e.message ? e.message : String(e)));
      return;
    }
  }
  if (value && typeof value.then === 'function') {
    value.then(
      (v) => record(id, name, v, detail),
      (e) => record(id, name, false, () => (e && e.message ? e.message : String(e)))
    );
    return;
  }
  record(id, name, value, detail);
}

function group(title) {
  results.push({ group: title });
}

// Verbatim top-level extraction (col-0 boundaries), identical to the technique
// the other suites use: nothing in these fixtures is re-implemented.
function extractBlockFrom(src, startMarker, endLine = '}') {
  const start = src.indexOf(startMarker);
  if (start === -1) throw new Error('verbatim extraction failed: ' + startMarker);
  let lineStart = src.indexOf('\n', start);
  if (lineStart === -1) throw new Error('verbatim extraction failed: ' + startMarker);
  lineStart += 1;
  while (lineStart <= src.length) {
    const nl = src.indexOf('\n', lineStart);
    const line = src.slice(lineStart, nl === -1 ? src.length : nl);
    // Exact col-0 match, identical to the other suites: an indented "}" is body
    // syntax, not the end of the block.
    if (line === endLine) return src.slice(start, nl === -1 ? src.length : nl);
    if (nl === -1) break;
    lineStart = nl + 1;
  }
  throw new Error('verbatim extraction never closed: ' + startMarker);
}

// Brace-balanced extraction (used for the larger owners whose bodies contain
// multi-line template literals).
function extractFunctionByBracesCompat(src, signature) {
  const start = src.indexOf(signature);
  if (start === -1) throw new Error('verbatim extraction failed: ' + signature);
  const open = src.indexOf('{', start);
  if (open === -1) throw new Error('verbatim extraction failed: ' + signature);
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('verbatim extraction never closed: ' + signature);
}

// ============================== CSS MINI CASCADE =============================
//
// The fixtures must answer "is this element actually displayed?", not "does
// this string exist?". This parses the SHIPPED stylesheet into rules, matches
// them against the SHIPPED markup tree, and returns the effective `display`.

function matchBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTopLevel(text, separator) {
  const out = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(' || ch === '[') depth += 1;
    else if (ch === ')' || ch === ']') depth -= 1;
    if (ch === separator && depth === 0) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

function parseDeclarations(body) {
  const decls = [];
  for (const part of splitTopLevel(body, ';')) {
    const colon = part.indexOf(':');
    if (colon === -1) continue;
    const prop = part.slice(0, colon).trim().toLowerCase();
    let value = part.slice(colon + 1).trim();
    if (!prop || !value) continue;
    const important = /!\s*important$/i.test(value);
    if (important) value = value.replace(/!\s*important$/i, '').trim();
    decls.push({ prop, value, important });
  }
  return decls;
}

function parseCssRules(css, insideMedia) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let i = 0;
  while (i < clean.length) {
    const open = clean.indexOf('{', i);
    if (open === -1) break;
    const prelude = clean.slice(i, open).trim();
    const close = matchBrace(clean, open);
    if (close === -1) break;
    const body = clean.slice(open + 1, close);
    if (prelude.startsWith('@')) {
      // Media-conditioned rules do not apply to the default cascade the
      // fixtures evaluate; their contents are still parsed so nested rules do
      // not leak into the unconditional list.
      rules.push(...parseCssRules(body, true));
    } else if (prelude) {
      const decls = parseDeclarations(body);
      if (decls.length) {
        for (const selector of splitTopLevel(prelude, ',')) {
          const text = selector.trim();
          if (text && !insideMedia) rules.push({ selector: text, decls });
        }
      }
    }
    i = close + 1;
  }
  return rules;
}

function parseCompound(text) {
  const compound = { tag: null, id: null, classes: [], attrs: [], not: [] };
  let rest = text.trim();
  if (!rest) return null;

  const type = rest.match(/^([a-zA-Z][\w-]*|\*)/);
  if (type) {
    if (type[1] !== '*') compound.tag = type[1].toLowerCase();
    rest = rest.slice(type[0].length);
  }

  while (rest.length) {
    if (rest[0] === '.') {
      const m = rest.match(/^\.([\w-]+)/);
      if (!m) return null;
      compound.classes.push(m[1]);
      rest = rest.slice(m[0].length);
    } else if (rest[0] === '#') {
      const m = rest.match(/^#([\w-]+)/);
      if (!m) return null;
      compound.id = m[1];
      rest = rest.slice(m[0].length);
    } else if (rest[0] === '[') {
      const m = rest.match(/^\[([^\]]+)\]/);
      if (!m) return null;
      compound.attrs.push(m[1].trim());
      rest = rest.slice(m[0].length);
    } else if (rest.startsWith(':not(')) {
      const end = rest.indexOf(')');
      if (end === -1) return null;
      const inner = parseCompound(rest.slice(5, end));
      if (!inner) return null;
      compound.not.push(inner);
      rest = rest.slice(end + 1);
    } else {
      return null; // unsupported pseudo-class / pseudo-element
    }
  }
  return compound;
}

function nodeHasAttr(node, expr) {
  const m = expr.match(/^([\w-]+)(?:\s*([~|^$*]?=)\s*(.+))?$/);
  if (!m) return false;
  const key = m[1];
  if (!node.attrs.has(key)) return false;
  if (!m[2]) return true;
  const raw = node.attrs.get(key);
  const value = String(m[3]).replace(/^['"]|['"]$/g, '');
  return String(raw) === value;
}

function matchCompound(compound, node) {
  if (!node) return false;
  if (compound.tag && node.tag !== compound.tag) return false;
  if (compound.id && node.id !== compound.id) return false;
  for (const cls of compound.classes) if (!node.classes.has(cls)) return false;
  for (const expr of compound.attrs) if (!nodeHasAttr(node, expr)) return false;
  for (const negated of compound.not) if (matchCompound(negated, node)) return false;
  return true;
}

function splitSelectorChain(selector) {
  const parts = [];
  let depth = 0;
  let current = '';
  let pendingCombinator = null;
  for (let i = 0; i < selector.length; i += 1) {
    const ch = selector[i];
    if (ch === '(' || ch === '[') depth += 1;
    if (ch === ')' || ch === ']') depth -= 1;
    if (depth === 0 && (ch === ' ' || ch === '>')) {
      if (current.trim()) {
        parts.push({ combinator: pendingCombinator, compound: current.trim() });
        current = '';
        pendingCombinator = null;
      }
      if (ch === '>') pendingCombinator = 'child';
      else if (pendingCombinator !== 'child') pendingCombinator = 'descendant';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push({ combinator: pendingCombinator, compound: current.trim() });
  return parts;
}

function selectorMatches(selector, node) {
  const parts = splitSelectorChain(selector);
  if (!parts.length) return false;
  const compiled = [];
  for (const part of parts) {
    const compound = parseCompound(part.compound);
    if (!compound) return false; // unsupported selector never matches
    compiled.push({ combinator: part.combinator, compound });
  }
  const last = compiled[compiled.length - 1];
  if (!matchCompound(last.compound, node)) return false;
  let cursor = node.parent;
  for (let i = compiled.length - 2; i >= 0; i -= 1) {
    const link = compiled[i + 1].combinator || 'descendant';
    let found = null;
    if (link === 'child') {
      if (cursor && matchCompound(compiled[i].compound, cursor)) found = cursor;
      cursor = cursor ? cursor.parent : null;
    } else {
      let scan = cursor;
      while (scan) {
        if (matchCompound(compiled[i].compound, scan)) { found = scan; cursor = scan; break; }
        scan = scan.parent;
      }
      if (!found) cursor = null;
    }
    if (!found) return false;
  }
  return true;
}

const CSS_RULES = parseCssRules(CSS_SOURCE, false);

// Effective declaration for a node, using the shipped cascade: later rules win,
// `!important` beats ordinary declarations, and rules inside @media are not
// part of the unconditional cascade.
function computedStyleValue(node, prop) {
  let value = null;
  let important = false;
  for (const rule of CSS_RULES) {
    if (!selectorMatches(rule.selector, node)) continue;
    for (const decl of rule.decls) {
      if (decl.prop !== prop) continue;
      if (important && !decl.important) continue;
      if (decl.important || !important) {
        value = decl.value;
        important = decl.important;
      }
    }
  }
  return value;
}

function computedDisplay(node) {
  const value = computedStyleValue(node, 'display');
  return value === null ? 'inline' : value;
}


// ============================== DOM MODEL ===================================
//
// Built from the SHIPPED sidebar markup (index.html) so the fixtures never
// invent structure, plus the runtime-created panel hosts the existing
// idempotent ensure owners add to the same scroller.

const VOID_TAGS = new Set(['input', 'img', 'br', 'hr', 'meta', 'link', 'source', 'path', 'circle']);

function makeNode(tag, attrs = {}) {
  const node = {
    tag: String(tag || 'div').toLowerCase(),
    id: '',
    classes: new Set(),
    attrs: new Map(),
    children: [],
    parent: null,
    listeners: {},
  };

  node.classList = {
    add: (cls) => node.classes.add(cls),
    remove: (cls) => node.classes.delete(cls),
    contains: (cls) => node.classes.has(cls),
    toggle: (cls, force) => {
      const on = force === undefined ? !node.classes.has(cls) : Boolean(force);
      if (on) node.classes.add(cls);
      else node.classes.delete(cls);
      return on;
    },
  };

  node.setAttribute = (name, value) => {
    node.attrs.set(String(name), String(value));
    if (name === 'id') node.id = String(value);
  };
  Object.defineProperty(node, 'className', {
    get() {
      return Array.from(node.classes).join(' ');
    },
  });
  node.getAttribute = (name) => (node.attrs.has(name) ? node.attrs.get(name) : null);
  node.hasAttribute = (name) => node.attrs.has(name);
  node.removeAttribute = (name) => node.attrs.delete(name);
  Object.defineProperty(node, 'hidden', {
    get() {
      return node.attrs.has('hidden');
    },
    set(value) {
      if (value) node.attrs.set('hidden', '');
      else node.attrs.delete('hidden');
    },
  });
  node.dataset = new Proxy({}, {
    get(_t, prop) {
      if (typeof prop !== 'string') return undefined;
      const key = `data-${prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
      return node.attrs.has(key) ? node.attrs.get(key) : undefined;
    },
    set(_t, prop, value) {
      const key = `data-${String(prop).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
      node.attrs.set(key, String(value));
      return true;
    },
    has(_t, prop) {
      return node.attrs.has(`data-${String(prop).replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`);
    },
  });

  node.addEventListener = (type, fn) => {
    (node.listeners[type] = node.listeners[type] || []).push(fn);
  };
  node.removeEventListener = (type, fn) => {
    node.listeners[type] = (node.listeners[type] || []).filter((f) => f !== fn);
  };
  node.getBoundingClientRect = () => ({ width: 280, height: 600, top: 0, left: 0, right: 280, bottom: 600 });

  node.append = (child) => {
    child.parent = node;
    node.children.push(child);
    return child;
  };

  const walk = (fn) => {
    for (const child of node.children) {
      fn(child);
      child.walk(fn);
    }
  };
  node.walk = walk;

  node.querySelectorAll = (selector) => {
    const out = [];
    const seen = new Set();
    for (const one of splitTopLevel(selector, ',')) {
      const compound = parseCompound(one.trim());
      if (!compound) continue;
      walk((n) => {
        if (matchCompound(compound, n) && !seen.has(n)) {
          seen.add(n);
          out.push(n);
        }
      });
    }
    return out;
  };
  node.querySelector = (selector) => node.querySelectorAll(selector)[0] || null;
  node.closest = (selector) => {
    const compound = parseCompound(selector);
    if (!compound) return null;
    let cursor = node;
    while (cursor) {
      if (matchCompound(compound, cursor)) return cursor;
      cursor = cursor.parent;
    }
    return null;
  };

  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'class') {
      String(value).split(/\s+/).filter(Boolean).forEach((cls) => node.classes.add(cls));
    } else if (name === 'id') {
      node.id = String(value);
      node.attrs.set('id', String(value));
    } else {
      node.attrs.set(name, String(value));
    }
  }
  return node;
}

function parseAttributes(raw) {
  const attrs = {};
  const re = /([:\w-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'))?/g;
  let m;
  while ((m = re.exec(raw))) {
    attrs[m[1]] = m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : '');
  }
  return attrs;
}


// The real shipped sidebar shell, parsed from index.html.
function buildSidebarTree() {
  const start = INDEX_HTML.indexOf('<aside id="workspaceSidebar"');
  const end = INDEX_HTML.indexOf('</aside>', start);
  if (start === -1 || end === -1) throw new Error('sidebar shell not found in index.html');
  const openEnd = INDEX_HTML.indexOf('>', start);
  // The synthetic root IS the shipped <aside>: parse only its CHILDREN, so the
  // element the fixtures measure is the element the browser builds.
  const region = INDEX_HTML.slice(openEnd + 1, end).replace(/<!--[\s\S]*?-->/g, '');

  const sidebar = makeNode('aside', parseAttributes(INDEX_HTML.slice(start + '<aside'.length, openEnd)));
  const stack = [sidebar];
  const tokenRe = /<\/?([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let m;
  while ((m = tokenRe.exec(region))) {
    const raw = m[0];
    const tag = m[1].toLowerCase();
    if (raw.startsWith('</')) {
      for (let i = stack.length - 1; i > 0; i -= 1) {
        if (stack[i].tag === tag) { stack.length = i; break; }
      }
      continue;
    }
    const node = makeNode(tag, parseAttributes(m[2] || ''));
    stack[stack.length - 1].append(node);
    if (!VOID_TAGS.has(tag) && !/\/>$/.test(raw)) stack.push(node);
  }

  // The navigation scroller is created at Journal initialization
  // (workspace-sidebar.js renderNavigationControls) and receives every existing
  // Sidebar child, the header included.
  const scroller = makeNode('div', { class: 'workspaceNavScroller', 'data-nav-scroller': '1' });
  while (sidebar.children.length) scroller.append(sidebar.children.shift());
  sidebar.append(scroller);

  return { sidebar, scroller };
}

// The runtime-created panel hosts (existing idempotent ensure owners).
const RUNTIME_PANELS = [
  { id: 'workspaceActivePanel', key: 'active' },
  { id: 'workspaceTagsPanel', key: 'tags' },
  { id: 'workspaceIndexPanel', key: 'index' },
  { id: 'workspaceProjectsPanel', key: 'projects' },
  { id: 'workspaceJournalsPanel', key: 'journals' },
  { id: 'workspaceConceptsPanel', key: 'concepts' },
  { id: 'workspaceSearchPanel', key: null },
  { id: 'workspaceArchivePanel', key: 'archive' },
];

function installRuntimePanels(scroller) {
  const created = {};
  for (const spec of RUNTIME_PANELS) {
    const panel = makeNode('div', { id: spec.id, class: 'workspaceSection' });
    const header = makeNode('button', {
      type: 'button',
      class: 'workspacePanelHeaderButton',
      'data-workspace-panel-toggle': spec.key || '',
      'aria-expanded': 'true',
    });
    const body = makeNode('div', { class: 'workspacePanelBody' });
    body.append(makeNode('div', { id: `${spec.id.replace('Panel', '')}Body` }));
    panel.append(header);
    panel.append(body);
    scroller.append(panel);
    created[spec.key || spec.id] = panel;
  }
  return created;
}


// The Task Review panel is upgraded at runtime by its own owner
// (ensureOrUpgradePanel in js/workspace/task-review.js): the static shell in
// index.html carries no header, so the fixture models the UPGRADED host and
// proves below that the shipped upgrade markup really carries the toggle.
function upgradeTasksPanel(panel) {
  const header = makeNode('button', {
    type: 'button',
    class: 'workspacePanelHeaderButton',
    'data-workspace-panel-toggle': 'tasks',
    'aria-expanded': 'false',
  });
  const body = makeNode('div', { class: 'workspacePanelBody' });
  body.append(makeNode('div', { id: 'workspaceTasksList', class: 'workspaceTasksList' }));
  body.append(makeNode('div', { id: 'workspaceTasksSummary', class: 'workspaceRelatedSummary' }));
  panel.append(header);
  panel.append(body);
  return { header, body };
}

function makeScenario({ collapsed, composition }) {
  const html = makeNode('html', { 'data-app-context': 'journal' });
  if (collapsed) html.classes.add('journal-sidebar-collapsed');
  if (composition === 'note') {
    html.classes.add('workspace-empty');
    html.attrs.set('data-journal-composition', 'note');
  } else {
    html.attrs.set('data-journal-composition', 'workspace');
  }

  const { sidebar, scroller } = buildSidebarTree();
  html.append(sidebar);
  const runtimePanels = installRuntimePanels(scroller);

  const byId = new Map();
  html.walk((n) => { if (n.id) byId.set(n.id, n); });

  const workspaceSection = byId.get('workspaceWorkspaceSection');
  if (workspaceSection) workspaceSection.hidden = composition !== 'workspace';
  const emptyState = byId.get('workspaceEmptyState');
  if (emptyState) emptyState.hidden = composition === 'note';

  // Links Out is statically shipped with its toggle; Tasks is upgraded.
  const relatedPanel = byId.get('workspaceRelatedPanel');
  const tasksPanel = byId.get('workspaceTasksPanel');
  const tasks = tasksPanel ? upgradeTasksPanel(tasksPanel) : null;

  return { html, sidebar, scroller, runtimePanels, byId, relatedPanel, tasksPanel, tasks };
}


// ------------------------------ HARNESS ------------------------------------

const COLLAPSE_SNIPPETS = [
  (MAIN_SOURCE.match(/const WORKSPACE_PANEL_COLLAPSE_STORAGE_KEY = '[^']*';\n/) || [''])[0],
  extractFunctionByBracesCompat(MAIN_SOURCE, 'const WORKSPACE_PANEL_DEFAULT_COLLAPSED ='),
  extractBlockFrom(MAIN_SOURCE, 'function getWorkspacePanelCollapsedState() {'),
  extractBlockFrom(MAIN_SOURCE, 'function setWorkspacePanelCollapsedState(panelId, collapsed) {'),
  extractBlockFrom(MAIN_SOURCE, 'function isWorkspacePanelCollapsed(panelId) {'),
  extractBlockFrom(MAIN_SOURCE, 'function applyWorkspacePanelCollapsed(panelEl, panelId, collapsed) {'),
  extractBlockFrom(MAIN_SOURCE, 'function toggleWorkspacePanel(panelId) {'),
  (MAIN_SOURCE.match(/let __workspacePanelCollapseOwner = null;/) || ['let __workspacePanelCollapseOwner = null;'])[0],
  extractBlockFrom(MAIN_SOURCE, 'function handleWorkspacePanelCollapseClick(event) {'),
  extractBlockFrom(MAIN_SOURCE, 'function wireWorkspacePanelCollapses() {'),
].join('\n\n');

const CONTROLLER_SNIPPETS = [
  (CONTROLLER_SOURCE.match(/const JOURNAL_SIDEBAR_COLLAPSED_KEY = '[^']*';\n/) || [''])[0],
  extractBlockFrom(CONTROLLER_SOURCE, 'function setLocalStorageValue(key, value) {'),
  extractBlockFrom(CONTROLLER_SOURCE, 'function setJournalSidebarCollapsed(next) {'),
].join('\n\n');

const harness = { logs: [], storage: new Map() };

// A FRESH closure per scenario, so the module-level __workspacePanelCollapseOwner
// marker is exercised exactly as the browser evaluates it once per document.
function makeOwners(snippets, names) {
  const body = `${snippets}\nreturn { ${names.join(', ')} };`;
  return new Function(body)();
}

const COLLAPSE_NAMES = [
  'wireWorkspacePanelCollapses',
  'handleWorkspacePanelCollapseClick',
  'toggleWorkspacePanel',
  'applyWorkspacePanelCollapsed',
  'isWorkspacePanelCollapsed',
  'getWorkspacePanelCollapsedState',
  'setWorkspacePanelCollapsedState',
  'WORKSPACE_PANEL_COLLAPSE_STORAGE_KEY',
  'WORKSPACE_PANEL_DEFAULT_COLLAPSED',
];

function installHarness(scenario) {
  harness.logs.length = 0;
  harness.storage = new Map();
  globalThis.window = globalThis;
  globalThis.document = {
    getElementById: (id) => scenario.byId.get(id) || null,
    documentElement: scenario.html,
    createElement: (tag) => makeNode(tag),
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.getComputedStyle = (node) => ({
    display: computedDisplay(node),
    visibility: 'visible',
    opacity: '1',
    width: '280px',
  });
  globalThis.localStorage = {
    getItem: (k) => (harness.storage.has(k) ? harness.storage.get(k) : null),
    setItem: (k, v) => harness.storage.set(k, String(v)),
    removeItem: (k) => harness.storage.delete(k),
  };
  globalThis.log = (m) => harness.logs.push(String(m));
  globalThis.MME_VIEW_LAYOUT = { refresh: () => {} };

  scenario.owners = makeOwners(COLLAPSE_SNIPPETS, COLLAPSE_NAMES);
  scenario.globalOwner = makeOwners(CONTROLLER_SNIPPETS, ['setJournalSidebarCollapsed', 'JOURNAL_SIDEBAR_COLLAPSED_KEY']);
  return scenario.owners;
}

function headerButtonOf(panel) {
  return panel ? panel.querySelector('[data-workspace-panel-toggle]') : null;
}

function bodyOf(panel) {
  return panel ? panel.querySelector('.workspacePanelBody') : null;
}

function clickHeader(scenario, panel) {
  const btn = headerButtonOf(panel);
  if (!btn) return { error: 'no header toggle' };
  const event = { target: btn, preventDefault() {}, stopPropagation() {} };
  const handlers = (scenario.sidebar.listeners.click || []).slice();
  for (const handler of handlers) handler(event);
  const record = harness.logs
    .filter((l) => l.startsWith('ACT 4B Collapse\n'))
    .map((l) => {
      try { return JSON.parse(l.split('\n').slice(1).join('\n')); } catch { return null; }
    })
    .filter(Boolean)
    .pop();
  return { record, handlerCount: handlers.length };
}

function panelState(panel) {
  const btn = headerButtonOf(panel);
  const body = bodyOf(panel);
  return {
    collapsed: Boolean(panel && panel.classes.has('workspacePanelCollapsed')),
    datasetCollapsed: panel ? panel.dataset.collapsed : undefined,
    ariaExpanded: btn ? btn.getAttribute('aria-expanded') : null,
    bodyDisplay: body ? computedDisplay(body) : null,
  };
}


// ============================== CHILD COLLAPSE ==============================
//
// The four Standalone Note panels under test, with the panel host each existing
// owner creates and the toggle key it must carry.
const LOCAL_PANELS = [
  { name: 'Active', id: 'workspaceActivePanel', key: 'active', source: 'main.js:ensureWorkspaceActivePanel' },
  { name: 'Links Out', id: 'workspaceRelatedPanel', key: 'related', source: 'index.html:workspaceRelatedPanel' },
  { name: 'Tasks', id: 'workspaceTasksPanel', key: 'tasks', source: 'task-review.js:ensureOrUpgradePanel' },
  { name: 'Tags', id: 'workspaceTagsPanel', key: 'tags', source: 'main.js:ensureWorkspaceTagsPanel' },
];

// The browser installs the delegated owner ONLY when the shipped Journal
// composition boundary calls it. The fixture executes that SAME statement, so
// deleting it from the source removes the listener here too — the fixtures can
// never pass by calling the owner behind the application's back.
function wireAsTheAppDoes(owners, signature) {
  const boundary = extractFunctionByBracesCompat(MAIN_SOURCE, signature);
  if (!/^\s*wireWorkspacePanelCollapses\(\);$/m.test(boundary)) return false;
  owners.wireWorkspacePanelCollapses();
  return true;
}

function noteScenario() {
  const scenario = makeScenario({ collapsed: false, composition: 'note' });
  const owners = installHarness(scenario);
  scenario.wired = wireAsTheAppDoes(owners, 'function applySidebarComposition(options) {');
  return { scenario, owners };
}

function workspaceScenario() {
  const scenario = makeScenario({ collapsed: false, composition: 'workspace' });
  const owners = installHarness(scenario);
  scenario.wired = wireAsTheAppDoes(owners, 'function finalizeWorkspaceSidebar() {');
  return { scenario, owners };
}

group('ACT 4B — child panel collapse in the Standalone Note composition (CC01-CC13)');

check('CC01', 'ONE delegated child-collapse owner, wired once on the stable Sidebar root', () => {
  const { scenario } = noteScenario();
  const owners = scenario.owners;
  // Second call from the Workspace boundary: the accepted owner returns early on
  // its idempotence marker, which must NOT add a second listener.
  owners.wireWorkspacePanelCollapses();
  const listenerCount = (scenario.sidebar.listeners.click || []).length;

  return (MAIN_SOURCE.match(/function wireWorkspacePanelCollapses\(/g) || []).length === 1 &&
    (MAIN_SOURCE.match(/function handleWorkspacePanelCollapseClick\(/g) || []).length === 1 &&
    (MAIN_SOURCE.match(/addEventListener\('click', handleWorkspacePanelCollapseClick\)/g) || []).length === 1 &&
    // the Note composition boundary installed it
    scenario.wired === true &&
    // exactly ONE click listener on #workspaceSidebar after BOTH call sites
    listenerCount === 1 &&
    // no per-panel listener anywhere in the collapse owners
    !/addEventListener/.test(
      extractBlockFrom(MAIN_SOURCE, 'function toggleWorkspacePanel(panelId) {') +
      extractBlockFrom(MAIN_SOURCE, 'function applyWorkspacePanelCollapsed(panelEl, panelId, collapsed) {') +
      extractBlockFrom(MAIN_SOURCE, 'function handleWorkspacePanelCollapseClick(event) {')
    );
}, () => 'collapse delegation is duplicated, per-panel, or missing');

check('CC02', 'the delegation is installed at the shared Journal boundary, before any local interaction', () => {
  const compose = extractFunctionByBracesCompat(MAIN_SOURCE, 'function applySidebarComposition(options) {');
  const composeNote = extractFunctionByBracesCompat(MAIN_SOURCE, 'function composeStandaloneNotePanels() {');
  const inactiveAt = compose.indexOf('if (composition.inactive) return composition;');
  const wiringAt = compose.indexOf('wireWorkspacePanelCollapses();');
  const { scenario, owners } = noteScenario();

  // A tap BEFORE any Workspace exists, straight after the boundary wiring.
  const first = clickHeader(scenario, scenario.byId.get('workspaceActivePanel'));

  return composeNote.includes('applySidebarComposition()') &&
    inactiveAt !== -1 && wiringAt > inactiveAt &&
    // exactly one extra invocation; the Workspace call site is untouched
    (MAIN_SOURCE.match(/^\s*wireWorkspacePanelCollapses\(\);$/gm) || []).length === 2 &&
    /wireWorkspacePanelCollapses\(\);/.test(extractFunctionByBracesCompat(MAIN_SOURCE, 'function finalizeWorkspaceSidebar() {')) &&
    (scenario.sidebar.listeners.click || []).length === 1 &&
    first.handlerCount === 1 &&
    first.record && first.record.requestedPanelKey === 'active';
}, () => 'Standalone Note interaction is not covered by the delegated owner');


for (const [index, spec] of LOCAL_PANELS.entries()) {
  const id = ['CC03', 'CC04', 'CC05', 'CC06'][index];

  check(id, `Standalone ${spec.name} header tap resolves to the "${spec.key}" panel and collapses it`, () => {
    const { scenario, owners } = noteScenario();
    const panel = scenario.byId.get(spec.id);
    const btn = headerButtonOf(panel);
    const body = bodyOf(panel);
    const before = panelState(panel);

    const result = clickHeader(scenario, panel);
    const after = panelState(panel);
    const record = result.record || {};

    // The SHIPPED header really carries the toggle the handler matches on, and
    // the same key the Workspace composition uses.
    const shippedKey = (() => {
      if (spec.id === 'workspaceRelatedPanel') {
        return /id="workspaceRelatedPanel"[\s\S]{0,400}?data-workspace-panel-toggle="related"/.test(INDEX_HTML);
      }
      if (spec.id === 'workspaceTasksPanel') {
        return /class="workspacePanelHeaderButton"\s+data-workspace-panel-toggle="tasks"/.test(TASK_REVIEW_SOURCE);
      }
      const ensure = extractFunctionByBracesCompat(MAIN_SOURCE, `function ensure${spec.name === 'Active' ? 'WorkspaceActivePanel' : `Workspace${spec.name}Panel`}() {`);
      return ensure.includes(`data-workspace-panel-toggle="${spec.key}"`);
    })();

    return Boolean(btn) &&
      btn.dataset.workspacePanelToggle === spec.key &&
      btn.closest('[data-workspace-panel-toggle]') === btn &&
      shippedKey === true &&
      // the visible tap target covers the whole header button
      btn.classes.has('workspacePanelHeaderButton') &&
      Boolean(body) &&
      before.collapsed === false &&
      after.collapsed === true &&
      record.requestedPanelKey === spec.key &&
      record.closestToggle === spec.key &&
      record.panelElementId === spec.id &&
      record.previousCollapsed === false &&
      record.nextCollapsed === true;
  }, () => `the ${spec.name} header does not reach the "${spec.key}" panel owner`);
}

{
  const { scenario } = noteScenario();
  const panel = scenario.byId.get('workspaceActivePanel');
  clickHeader(scenario, panel);
  const collapsed = panelState(panel);
  const persisted = JSON.parse(harness.storage.get('markmap:workspace:panelCollapsed') || '{}');
  clickHeader(scenario, panel);
  const expanded = panelState(panel);
  const persistedAfter = JSON.parse(harness.storage.get('markmap:workspace:panelCollapsed') || '{}');

  check('CC07', 'the first local tap hides the panel body (computed display none)', () =>
    collapsed.collapsed === true &&
    collapsed.bodyDisplay === 'none' &&
    collapsed.datasetCollapsed === '1',
  () => 'collapsed=' + JSON.stringify(collapsed));

  check('CC08', 'the second local tap restores the panel body (computed display restored)', () =>
    expanded.collapsed === false &&
    expanded.bodyDisplay !== 'none' &&
    expanded.datasetCollapsed === '0' &&
    collapsed.bodyDisplay !== expanded.bodyDisplay,
  () => 'expanded=' + JSON.stringify(expanded));

  check('CC09', 'local collapse updates aria-expanded on the SAME toggle element', () =>
    collapsed.ariaExpanded === 'false' &&
    expanded.ariaExpanded === 'true' &&
    headerButtonOf(panel).getAttribute('aria-expanded') === 'true',
  () => 'aria=' + collapsed.ariaExpanded + '/' + expanded.ariaExpanded);

  check('CC10', 'local collapse persists through the EXISTING panel store only', () =>
    persisted.active === true &&
    persistedAfter.active === false &&
    // exactly the existing key, no Standalone-specific store
    Array.from(harness.storage.keys()).join(',') === 'markmap:workspace:panelCollapsed',
  () => 'storage=' + JSON.stringify(Array.from(harness.storage.entries())));
}


{
  // CC11 — the renderers RE-APPLY the persisted state on every render; a
  // composition rerender must therefore preserve whatever the user collapsed.
  // `related` is used as the untouched control because the SHIPPED default for
  // `tasks`/`tags`/`index` is already collapsed=true (WORKSPACE_PANEL_DEFAULT_COLLAPSED).
  const { scenario, owners } = noteScenario();
  const activePanel = scenario.byId.get('workspaceActivePanel');
  const relatedPanel = scenario.byId.get('workspaceRelatedPanel');
  clickHeader(scenario, activePanel);

  const rerender = () => {
    for (const [panel, key] of [[activePanel, 'active'], [relatedPanel, 'related']]) {
      owners.applyWorkspacePanelCollapsed(panel, key, owners.isWorkspacePanelCollapsed(key));
    }
  };
  rerender();
  rerender();

  const composeOwner = extractFunctionByBracesCompat(MAIN_SOURCE, 'function composeStandaloneNotePanels() {') +
    extractFunctionByBracesCompat(MAIN_SOURCE, 'function applySidebarComposition(options) {');

  check('CC11', 'a Note composition rerender preserves the collapsed child-panel state', () =>
    activePanel.classes.has('workspacePanelCollapsed') === true &&
    panelState(activePanel).bodyDisplay === 'none' &&
    // the untouched control keeps its SHIPPED default (related: expanded)
    relatedPanel.classes.has('workspacePanelCollapsed') === false &&
    panelState(relatedPanel).bodyDisplay !== 'none' &&
    // the composition owners never WRITE the panel store themselves
    !/setWorkspacePanelCollapsedState/.test(composeOwner) &&
    !/isWorkspacePanelCollapsed/.test(composeOwner),
  () => 'rerender=' + JSON.stringify({ active: panelState(activePanel), related: panelState(relatedPanel) }));
}

{
  // CC12 — Note-to-Note: a second Note keeps the accepted policy (a collapsed
  // panel stays collapsed; an untouched panel stays expanded).
  const first = noteScenario();
  clickHeader(first.scenario, first.scenario.byId.get('workspaceActivePanel'));
  clickHeader(first.scenario, first.scenario.byId.get('workspaceRelatedPanel'));
  const persisted = harness.storage.get('markmap:workspace:panelCollapsed');

  const second = makeScenario({ collapsed: false, composition: 'note' });
  const owners = installHarness(second);
  harness.storage.set('markmap:workspace:panelCollapsed', persisted);
  owners.wireWorkspacePanelCollapses();
  for (const spec of LOCAL_PANELS) {
    const panel = second.byId.get(spec.id);
    owners.applyWorkspacePanelCollapsed(panel, spec.key, owners.isWorkspacePanelCollapsed(spec.key));
  }

  const states = LOCAL_PANELS.map((spec) => ({ key: spec.key, ...panelState(second.byId.get(spec.id)) }));
  const byKey = Object.fromEntries(states.map((s) => [s.key, s]));

  check('CC12', 'Note-to-Note preserves the accepted child-collapse policy', () =>
    byKey.active.collapsed === true && byKey.related.collapsed === true &&
    // `tasks`/`tags` keep the SHIPPED default (collapsed=true); the point is
    // that the transition itself changed nothing.
    byKey.tasks.collapsed === true && byKey.tags.collapsed === true &&
    harness.storage.get('markmap:workspace:panelCollapsed') === persisted &&
    JSON.stringify(JSON.parse(persisted)) === JSON.stringify({
      ...owners.WORKSPACE_PANEL_DEFAULT_COLLAPSED,
      active: true,
      related: true,
    }),
  () => 'states=' + JSON.stringify(states));
}

{
  // CC13 — the accepted Workspace behaviour is unchanged.
  const { scenario, owners } = workspaceScenario();
  const activePanel = scenario.byId.get('workspaceActivePanel');
  const indexPanel = scenario.byId.get('workspaceIndexPanel');
  const first = clickHeader(scenario, activePanel);
  const collapsed = panelState(activePanel);
  clickHeader(scenario, activePanel);
  const expanded = panelState(activePanel);
  const indexResult = clickHeader(scenario, indexPanel);

  check('CC13', 'Workspace child collapse is unchanged: same delegated owner, same contract', () =>
    first.record.requestedPanelKey === 'active' &&
    collapsed.collapsed === true && collapsed.bodyDisplay === 'none' && collapsed.ariaExpanded === 'false' &&
    expanded.collapsed === false && expanded.bodyDisplay !== 'none' && expanded.ariaExpanded === 'true' &&
    indexResult.record.requestedPanelKey === 'index' &&
    indexResult.record.panelElementId === 'workspaceIndexPanel' &&
    panelState(indexPanel).collapsed === true &&
    // the Workspace call site still installs the SAME owner
    /wireWorkspacePanelCollapses\(\);/.test(extractFunctionByBracesCompat(MAIN_SOURCE, 'function finalizeWorkspaceSidebar() {')) &&
    /finalizeWorkspaceSidebar\(\);/.test(extractFunctionByBracesCompat(MAIN_SOURCE, 'function setupWorkspacePanels() {')),
  () => 'workspace collapse=' + JSON.stringify({ collapsed, expanded }));
}



// ============================== GLOBAL COLLAPSE =============================
//
// Everything below is evaluated against the SHIPPED stylesheet and the SHIPPED
// sidebar markup: "visible" means the cascade says display:none for the element
// OR for any ancestor, which is what the eye actually sees.

function isVisible(node) {
  let cursor = node;
  while (cursor) {
    if (computedDisplay(cursor) === 'none') return false;
    cursor = cursor.parent;
  }
  return true;
}

const RAIL_ACTIONS = ['btnWorkspaceCollapse', 'btnOpenNote', 'btnOpenWorkspace'];
const WORKSPACE_RAIL_ACTIONS = ['btnJournalToday', 'btnNewConcept'];
const IDENTITY_HOSTS = ['workspaceTitle', 'workspaceCompositionLabel', 'workspaceCompositionName', 'workspaceWorkspaceName'];
const PANEL_HOSTS = [
  'workspaceActivePanel', 'workspaceRelatedPanel', 'workspaceTasksPanel', 'workspaceTagsPanel',
  'workspaceIndexPanel', 'workspaceProjectsPanel', 'workspaceJournalsPanel',
  'workspaceConceptsPanel', 'workspaceSearchPanel', 'workspaceArchivePanel',
];

function visibleTexts(scenario) {
  return scenario.html
    .querySelectorAll('.workspaceSectionCaption, .workspaceLabel, .workspaceActionHint, .workspaceActionText')
    .filter((n) => isVisible(n))
    .map((n) => n.tag + '.' + n.className);
}

function visiblePanels(scenario) {
  return PANEL_HOSTS.map((id) => scenario.byId.get(id)).filter((n) => n && isVisible(n)).map((n) => n.id);
}

function railActions(scenario, ids) {
  return ids.map((id) => scenario.byId.get(id)).filter(Boolean);
}

group('ACT 4B — global (whole-Sidebar) compact rail in both compositions (GC01-GC14)');

// Fixtures below build their scenario inside the thunk, so the failure detail is
// published through this cell rather than through a closure over a dead scope.
let lastDetail = '';
function detailOf() {
  return () => lastDetail;
}

check('GC01', 'Standalone Note + globally collapsed shows ONLY expand / Open Note / Open Workspace', () => {
  const s = makeScenario({ collapsed: true, composition: 'note' });
  const shown = RAIL_ACTIONS.filter((id) => { const n = s.byId.get(id); return n && isVisible(n); });
  const leaked = WORKSPACE_RAIL_ACTIONS.filter((id) => { const n = s.byId.get(id); return n && isVisible(n); });
  const identityLeak = IDENTITY_HOSTS.filter((id) => { const n = s.byId.get(id); return n && isVisible(n); });
  lastDetail = 'shown=' + JSON.stringify(shown) +
    ' workspaceIcons=' + JSON.stringify(leaked) +
    ' identity=' + JSON.stringify(identityLeak) +
    ' texts=' + JSON.stringify(visibleTexts(s)) +
    ' panels=' + JSON.stringify(visiblePanels(s));

  return shown.length === 3 &&
    leaked.length === 0 &&
    identityLeak.length === 0 &&
    visibleTexts(s).length === 0 &&
    visiblePanels(s).length === 0;
}, detailOf());

check('GC02', 'Workspace + globally collapsed adds the Today and New Note icons, nothing else', () => {
  const s = makeScenario({ collapsed: true, composition: 'workspace' });
  const shown = [...RAIL_ACTIONS, ...WORKSPACE_RAIL_ACTIONS]
    .filter((id) => { const n = s.byId.get(id); return n && isVisible(n); });
  const identityLeak = IDENTITY_HOSTS.filter((id) => { const n = s.byId.get(id); return n && isVisible(n); });
  lastDetail = 'shown=' + JSON.stringify(shown) +
    ' identity=' + JSON.stringify(identityLeak) +
    ' texts=' + JSON.stringify(visibleTexts(s)) +
    ' panels=' + JSON.stringify(visiblePanels(s));

  return shown.length === 5 &&
    identityLeak.length === 0 &&
    visibleTexts(s).length === 0 &&
    visiblePanels(s).length === 0;
}, detailOf());

check('GC03', 'global collapse hides EVERY child-panel host in both compositions', () => {
  const note = makeScenario({ collapsed: true, composition: 'note' });
  const workspace = makeScenario({ collapsed: true, composition: 'workspace' });
  lastDetail = 'note=' + JSON.stringify(visiblePanels(note)) +
    ' workspace=' + JSON.stringify(visiblePanels(workspace));

  return visiblePanels(note).length === 0 &&
    visiblePanels(workspace).length === 0 &&
    PANEL_HOSTS.every((id) => note.byId.get(id) && workspace.byId.get(id));
}, detailOf());

check('GC04', 'global collapse hides the identity line and the physical filename / root name', () => {
  const collapsedNote = makeScenario({ collapsed: true, composition: 'note' });
  const collapsedWorkspace = makeScenario({ collapsed: true, composition: 'workspace' });
  const expandedNote = makeScenario({ collapsed: false, composition: 'note' });
  const identityIds = ['workspaceCompositionLabel', 'workspaceCompositionName'];

  const hiddenWhenCollapsed = [collapsedNote, collapsedWorkspace].every((s) =>
    identityIds.every((id) => { const n = s.byId.get(id); return n && !isVisible(n); }));
  const shownWhenExpanded = identityIds.every((id) => {
    const n = expandedNote.byId.get(id);
    return n && isVisible(n);
  });
  const titleWhenExpanded = expandedNote.byId.get('workspaceTitle');
  lastDetail = 'hidden=' + hiddenWhenCollapsed + ' shownExpanded=' + shownWhenExpanded +
    ' titleVisible=' + Boolean(titleWhenExpanded && isVisible(titleWhenExpanded));

  return hiddenWhenCollapsed && shownWhenExpanded &&
    Boolean(titleWhenExpanded) && isVisible(titleWhenExpanded);
}, detailOf());

check('GC05', 'global collapse hides section headings, action labels and descriptions', () => {
  const collapsedNote = makeScenario({ collapsed: true, composition: 'note' });
  const collapsedWorkspace = makeScenario({ collapsed: true, composition: 'workspace' });
  const expandedNote = makeScenario({ collapsed: false, composition: 'note' });
  const leaked = [...visibleTexts(collapsedNote), ...visibleTexts(collapsedWorkspace)];
  lastDetail = 'leaked=' + JSON.stringify(leaked);

  return leaked.length === 0 &&
    // and the same text really is displayed when the Sidebar is expanded
    visibleTexts(expandedNote).length > 0;
}, detailOf());

check('GC06', 'compact actions keep their icon, accessible name and tooltip in the rail', () => {
  const s = makeScenario({ collapsed: true, composition: 'workspace' });
  const buttons = railActions(s, [...RAIL_ACTIONS, ...WORKSPACE_RAIL_ACTIONS]);
  const init = extractFunctionByBracesCompat(CONTROLLER_SOURCE, 'function initJournalSidebarCollapse() {');
  const setCollapsed = extractFunctionByBracesCompat(CONTROLLER_SOURCE, 'function setJournalSidebarCollapsed(next) {');

  const perButton = buttons.map((btn) => {
    const icon = btn.querySelector('.workspaceIcon');
    const label = btn.querySelector('.workspaceLabel');
    const actionText = btn.querySelector('.workspaceActionText');
    const name = btn.getAttribute('aria-label') || btn.getAttribute('title') || '';
    // The four content actions carry an .workspaceIcon; the global control is a
    // glyph button. Either way the requirement is identical: the AFFORDANCE is
    // visible, no text label is, and the accessible name survives.
    const hiddenTextNodes = [label, actionText].filter(Boolean);
    return {
      id: btn.id,
      visible: isVisible(btn),
      affordanceVisible: icon ? isVisible(icon) : btn.children.length === 0,
      noVisibleText: hiddenTextNodes.every((n) => !isVisible(n)),
      named: name.length > 0,
    };
  });
  lastDetail = JSON.stringify(perButton);

  return buttons.length === 5 &&
    perButton.every((b) => b.visible && b.affordanceVisible && b.noVisibleText && b.named) &&
    // the collapse control publishes its accessible name at runtime
    /setAttribute\('aria-label', btnLabel\.title\)/.test(init) &&
    /setAttribute\('aria-label', btn2\.title\)/.test(setCollapsed);
}, detailOf());

check('GC07', 'global expansion restores the Standalone Note presentation', () => {
  const s = makeScenario({ collapsed: false, composition: 'note' });
  const identity = ['workspaceTitle', 'workspaceCompositionLabel', 'workspaceCompositionName']
    .map((id) => s.byId.get(id))
    .filter(Boolean);
  const openSection = s.html.querySelector('.workspaceOpenSection');
  const workspaceSection = s.byId.get('workspaceWorkspaceSection');
  lastDetail = 'identity=' + identity.length +
    ' panels=' + JSON.stringify(visiblePanels(s)) +
    ' texts=' + JSON.stringify(visibleTexts(s));

  return identity.length === 3 && identity.every((n) => isVisible(n)) &&
    visibleTexts(s).length > 0 &&
    Boolean(openSection) && isVisible(openSection) &&
    // the Workspace section stays withdrawn in the Note composition
    Boolean(workspaceSection) && !isVisible(workspaceSection) &&
    railActions(s, RAIL_ACTIONS).every((btn) => isVisible(btn)) &&
    visiblePanels(s).length > 0;
}, detailOf());

check('GC08', 'global expansion restores the Workspace presentation', () => {
  const s = makeScenario({ collapsed: false, composition: 'workspace' });
  const workspaceSection = s.byId.get('workspaceWorkspaceSection');
  const name = s.byId.get('workspaceWorkspaceName');
  lastDetail = 'panels=' + JSON.stringify(visiblePanels(s)) +
    ' workspaceSection=' + Boolean(workspaceSection && isVisible(workspaceSection)) +
    ' name=' + Boolean(name && isVisible(name));

  return visiblePanels(s).length > 0 &&
    Boolean(workspaceSection) && isVisible(workspaceSection) &&
    Boolean(name) && isVisible(name) &&
    railActions(s, [...RAIL_ACTIONS, ...WORKSPACE_RAIL_ACTIONS]).every((btn) => isVisible(btn));
}, detailOf());


{
  // GC09 / GC10 — the two state models stay independent: executing the REAL
  // global-collapse owner must not read or write a single child-panel key.
  const s = makeScenario({ collapsed: false, composition: 'note' });
  const owners = installHarness(s);
  wireAsTheAppDoes(owners, 'function applySidebarComposition(options) {');
  const activePanel = s.byId.get('workspaceActivePanel');
  const tagsPanel = s.byId.get('workspaceTagsPanel');
  clickHeader(s, activePanel);
  const panelStore = harness.storage.get('markmap:workspace:panelCollapsed');
  const classesBefore = activePanel.className + '|' + tagsPanel.className;

  s.globalOwner.setJournalSidebarCollapsed(true);
  const afterCollapse = {
    store: harness.storage.get('markmap:workspace:panelCollapsed'),
    classes: activePanel.className + '|' + tagsPanel.className,
    keys: Array.from(harness.storage.keys()).sort().join(','),
    classOnHtml: s.html.classes.has('journal-sidebar-collapsed'),
  };

  s.globalOwner.setJournalSidebarCollapsed(false);
  const afterExpand = {
    store: harness.storage.get('markmap:workspace:panelCollapsed'),
    classes: activePanel.className + '|' + tagsPanel.className,
    classOnHtml: s.html.classes.has('journal-sidebar-collapsed'),
  };

  check('GC09', 'global collapse writes ONLY its own state, never a child-panel key', () =>
    afterCollapse.store === panelStore &&
    afterCollapse.classes === classesBefore &&
    afterCollapse.keys === 'markmap:journalSidebarCollapsed,markmap:workspace:panelCollapsed' &&
    afterCollapse.classOnHtml === true,
  () => JSON.stringify(afterCollapse));

  check('GC10', 'global expansion restores the child-panel preferences unchanged', () =>
    afterExpand.store === panelStore &&
    afterExpand.classes === classesBefore &&
    afterExpand.classOnHtml === false &&
    activePanel.classes.has('workspacePanelCollapsed') === true &&
    tagsPanel.classes.has('workspacePanelCollapsed') === false,
  () => JSON.stringify(afterExpand));
}

check('GC11', 'global collapse never persists the 52px rail as the expanded width', () => {
  const s = makeScenario({ collapsed: true, composition: 'note' });
  installHarness(s);
  const expanded = makeScenario({ collapsed: false, composition: 'note' });
  const setCollapsed = extractFunctionByBracesCompat(CONTROLLER_SOURCE, 'function setJournalSidebarCollapsed(next) {');
  const init = extractFunctionByBracesCompat(CONTROLLER_SOURCE, 'function initJournalSidebarCollapse() {');
  const sidebar = s.byId.get('workspaceSidebar');
  const expandedSidebar = expanded.byId.get('workspaceSidebar');

  s.globalOwner.setJournalSidebarCollapsed(true);

  return !/applyWorkspaceSidebarWidth|storeWorkspaceSidebarWidth|restoreWorkspaceSidebarWidth|--workspace-sidebar-width/.test(setCollapsed) &&
    !Array.from(harness.storage.keys()).includes('markmap:workspace:sidebarWidth') &&
    // the collapsed rail width comes from the collapsed rule; the expanded
    // width still comes from the persisted variable
    computedStyleValue(sidebar, 'width') === '52px' &&
    computedStyleValue(expandedSidebar, 'width') === 'var(--workspace-sidebar-width, 280px)' &&
    // and the stored width is restored only when the Sidebar is EXPANDED
    /if \(!next\) \{[\s\S]*restoreWorkspaceSidebarWidth/.test(init);
}, () => 'collapsedWidth=' + computedStyleValue(sidebar, 'width'));


check('GC12', 'ONE global-collapse owner, bound once, with an idempotence guard', () => {
  const init = extractFunctionByBracesCompat(CONTROLLER_SOURCE, 'function initJournalSidebarCollapse() {');
  const setCollapsed = extractFunctionByBracesCompat(CONTROLLER_SOURCE, 'function setJournalSidebarCollapsed(next) {');
  const mainCode = MAIN_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // A WRITE of the collapsed class is an owner. Reads (the resize guard and the
  // read-only resize diagnostic) are consumers and stay allowed.
  const writers = /classList\.(add|remove|toggle)\('journal-sidebar-collapsed'/;
  lastDetail = 'mainWrites=' + writers.test(mainCode) +
    ' clickDelegates=' + /setJournalSidebarCollapsed\(next\);/.test(init) +
    ' controllerOwners=' + (CONTROLLER_SOURCE.match(/function setJournalSidebarCollapsed\(/g) || []).length;

  return (CONTROLLER_SOURCE.match(/function setJournalSidebarCollapsed\(/g) || []).length === 1 &&
    (CONTROLLER_SOURCE.match(/function initJournalSidebarCollapse\(/g) || []).length === 1 &&
    (init.match(/addEventListener\('click'/g) || []).length === 1 &&
    /if \(!btn \|\| btn\.__bound\) return;/.test(init) &&
    (init.match(/setJournalSidebarCollapsed\(next\);/g) || []).length === 1 &&
    // the click path delegates instead of writing the class itself
    !writers.test(init.split('btn.addEventListener')[1] || '') &&
    // and no second owner appears in the main script
    !writers.test(mainCode);
}, detailOf());

check('GC13', 'ONE Sidebar, and every panel host lives under it', () => {
  const s = makeScenario({ collapsed: false, composition: 'note' });
  const sidebar = s.byId.get('workspaceSidebar');
  const contentHost = extractFunctionByBracesCompat(MAIN_SOURCE, 'function getWorkspaceSidebarContentHost() {');
  const reviewHost = extractFunctionByBracesCompat(TASK_REVIEW_SOURCE, 'function getSidebarContentHost() {');

  const underSidebar = PANEL_HOSTS.every((id) => {
    const node = s.byId.get(id);
    let cursor = node ? node.parent : null;
    while (cursor) {
      if (cursor === sidebar) return true;
      cursor = cursor.parent;
    }
    return false;
  });
  lastDetail = 'idCount=' + (INDEX_HTML.match(/id="workspaceSidebar"/g) || []).length +
    ' sidebar=' + Boolean(sidebar) + ' allUnder=' + underSidebar;

  return (INDEX_HTML.match(/id="workspaceSidebar"/g) || []).length === 1 &&
    Boolean(sidebar) &&
    underSidebar &&
    // both content hosts resolve the SAME single Sidebar root
    /getElementById\('workspaceSidebar'\)/.test(contentHost) &&
    /getElementById\('workspaceSidebar'\)/.test(reviewHost) &&
    !/createElement\('aside'\)/.test(contentHost);
}, detailOf());

check('GC14', 'the Sidebar resize owner is unchanged and still refuses the collapsed rail', () => {
  const resizeOwner = extractFunctionByBracesCompat(MAIN_SOURCE, 'function wireWorkspaceSidebarResize() {');
  const s = makeScenario({ collapsed: true, composition: 'note' });
  const expanded = makeScenario({ collapsed: false, composition: 'note' });
  const handle = s.byId.get('workspaceSidebarResizeHandle');
  const expandedHandle = expanded.byId.get('workspaceSidebarResizeHandle');

  return (resizeOwner.match(/addEventListener\(/g) || []).length === 3 &&
    /const WORKSPACE_SIDEBAR_WIDTH_MIN = 220;/.test(MAIN_SOURCE) &&
    /const WORKSPACE_SIDEBAR_WIDTH_MAX = 420;/.test(MAIN_SOURCE) &&
    /function isSidebarCollapsed\(\)/.test(resizeOwner) &&
    /'Workspace: sidebar resize ignored while collapsed'/.test(resizeOwner) &&
    // the rail never offers a resize target
    Boolean(handle) && computedDisplay(handle) === 'none' &&
    Boolean(expandedHandle) && computedDisplay(expandedHandle) !== 'none';
}, () => 'handle collapsed=' + (handle ? computedDisplay(handle) : 'absent'));


// ------------------------------- REPORT -------------------------------------

function report() {
  const failed = results.filter((e) => !e.group && !e.ok);
  const passed = results.filter((e) => !e.group && e.ok);
  for (const e of results) {
    if (e.group) {
      console.log('\n' + e.group);
      continue;
    }
    console.log((e.ok ? 'PASS' : 'FAIL') + ' [' + e.id + '] ' + e.name + (e.ok ? '' : ' -- ' + e.detail));
  }
  console.log('\nCOLLAPSE VALIDATORS: ' + passed.length + ' passed, ' + failed.length + ' failed');
  process.exitCode = failed.length === 0 ? 0 : 1;
}


report();
