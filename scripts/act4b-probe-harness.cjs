/* TEMPORARY validation harness for scripts/act4b-visibility-probe.js.
 * Not part of the app. Proves the probe detects every defect class the
 * `.hidden`-only log is structurally blind to:
 *   Class A — a panel with hidden=true that an AUTHOR rule keeps displayed
 *             (the UA [hidden]{display:none} rule is outranked);
 *   Class B — a LATER named owner re-hides a host the composition showed;
 *   Class C — a class-on-<html> flip that suppresses a host with hidden=false;
 * and that stop() restores every wrapper and observer it installed.
 * Run: node scripts/act4b-probe-harness.cjs
 */
const fs = require('fs');
const path = require('path');

// ------------------------------------------------------------- DOM stub
const observers = [];

function notify(type, target, attributeName, oldValue) {
  observers.slice().forEach((entry) => {
    const filter = (entry.options && entry.options.attributeFilter) || null;
    if (type === 'attributes' && filter && attributeName && filter.indexOf(attributeName) === -1) return;
    try {
      entry.cb([{ type, target, attributeName: attributeName || null, oldValue: oldValue || null }]);
    } catch (e) { /* observer callbacks must not break the stub */ }
  });
}

function DOMTokenList(owner) { this.__owner = owner || null; }
DOMTokenList.prototype = Object.create(Array.prototype);
DOMTokenList.prototype.constructor = DOMTokenList;
DOMTokenList.prototype.add = function (...t) {
  const before = this.value;
  t.forEach((x) => { if (this.indexOf(x) === -1) Array.prototype.push.call(this, x); });
  if (this.value !== before) notify('attributes', this.__owner, 'class', before);
};
DOMTokenList.prototype.remove = function (...t) {
  const before = this.value;
  t.forEach((x) => { const i = this.indexOf(x); if (i > -1) Array.prototype.splice.call(this, i, 1); });
  if (this.value !== before) notify('attributes', this.__owner, 'class', before);
};
DOMTokenList.prototype.contains = function (t) { return this.indexOf(t) > -1; };
DOMTokenList.prototype.toggle = function (t, force) {
  const has = this.indexOf(t) > -1;
  const want = force === undefined ? !has : Boolean(force);
  if (want && !has) this.add(t);
  if (!want && has) this.remove(t);
  return want;
};
Object.defineProperty(DOMTokenList.prototype, 'value', {
  get() { return Array.prototype.join.call(this, ' '); },
});

const registry = new Map();
const hiddenStore = new WeakMap();

class Element {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.id = '';
    this.__attrs = new Map();
    this.__classList = new DOMTokenList(this);
    this.__children = [];
    this.parentElement = null;
    this.dataset = {};
    // `__authorKeepsDisplayed` models an ID-level author `display:` rule that
    // outranks the UA [hidden] rule — the Class A defect. When false the
    // element follows the UA rule: hidden=true -> display:none.
    this.__authorKeepsDisplayed = false;
    this.__shownDisplay = 'flex';
    this.__computed = { display: 'block', visibility: 'visible', opacity: '1' };
  }
  get classList() { return this.__classList; }
  get className() { return this.__classList.value; }
  set className(v) {
    this.__classList.length = 0;
    String(v).split(/\s+/).filter(Boolean).forEach((c) => this.__classList.add(c));
  }
  setAttribute(n, v) {
    const old = this.getAttribute(n);
    this.__attrs.set(String(n), String(v));
    notify('attributes', this, String(n), old);
  }
  getAttribute(n) { return this.__attrs.has(String(n)) ? this.__attrs.get(String(n)) : null; }
  hasAttribute(n) {
    if (String(n) === 'hidden') return this.__attrs.has('hidden') || hiddenStore.get(this) === true;
    return this.__attrs.has(String(n));
  }
  removeAttribute(n) {
    const old = this.getAttribute(n);
    this.__attrs.delete(String(n));
    notify('attributes', this, String(n), old);
  }
  appendChild(c) { this.__children.push(c); c.parentElement = this; return c; }
  // Minimal selector engine: `.class`, `[attr]`, `#id`, `tag` alternatives
  // separated by commas — exactly what the probe queries.
  __matches(part) {
    const p = part.trim();
    if (!p) return false;
    if (p[0] === '.') return this.__classList.contains(p.slice(1));
    if (p[0] === '[') return this.hasAttribute(p.slice(1).split('=')[0].replace(']', ''));
    if (p[0] === '#') return this.id === p.slice(1);
    return this.tagName === p.toUpperCase();
  }
  __descendants() {
    const out = [];
    this.__children.forEach((c) => { out.push(c); out.push(...c.__descendants()); });
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) {
    const parts = String(sel).split(',').map((p) => p.trim());
    return this.__descendants().filter((d) => parts.some((p) => d.__matches(p)));
  }
  get clientWidth() { return this.__computed.display === 'none' ? 0 : (this.__boxWidth || 300); }
  get clientHeight() { return this.__computed.display === 'none' ? 0 : (this.__boxHeight || 160); }
  get offsetParent() { return this.__computed.display === 'none' ? null : (this.parentElement || null); }
}
class HTMLElement extends Element {}
Object.defineProperty(HTMLElement.prototype, 'hidden', {
  configurable: true,
  enumerable: true,
  get() { return hiddenStore.get(this) === true; },
  set(v) {
    const next = Boolean(v);
    const before = hiddenStore.get(this) === true;
    if (before === next) { hiddenStore.set(this, next); return; }
    const displayBefore = this.__computed ? this.__computed.display : '';
    hiddenStore.set(this, next);
    if (this.__computed) {
      if (next && !this.__authorKeepsDisplayed) this.__computed.display = 'none';
      if (!next && this.__computed.display === 'none') this.__computed.display = this.__shownDisplay;
      if (this.__computed.display !== displayBefore) {
        notify('attributes', this, 'style', 'display:' + displayBefore);
      }
    }
    notify('attributes', this, 'hidden', String(before));
  },
});

global.HTMLElement = HTMLElement;
global.Element = Element;
global.DOMTokenList = DOMTokenList;

// --------------------------------------------------- document / style stubs
const html = new HTMLElement('html');
html.className = 'workspace-ready';

const activePanel = new HTMLElement('div'); // Class A: author rule keeps it shown
activePanel.id = 'workspaceActivePanel';
activePanel.parentElement = html;
activePanel.__authorKeepsDisplayed = true;
activePanel.__computed = { display: 'flex', visibility: 'visible', opacity: '1' };
activePanel.hidden = true;
registry.set('workspaceActivePanel', activePanel);

const tagsPanel = new HTMLElement('div'); // the host the composition SHOWS
tagsPanel.id = 'workspaceTagsPanel';
tagsPanel.className = 'workspaceSection workspaceTagsPanel';
tagsPanel.parentElement = html;
tagsPanel.__computed = { display: 'flex', visibility: 'visible', opacity: '1' };
tagsPanel.hidden = false;
registry.set('workspaceTagsPanel', tagsPanel);

const relatedPanel = new HTMLElement('div'); // matches NOTE_LOCAL_IDS (4th host)
relatedPanel.id = 'workspaceRelatedPanel';
relatedPanel.parentElement = html;
relatedPanel.__computed = { display: 'flex', visibility: 'visible', opacity: '1' };
relatedPanel.hidden = false;
const relatedTitleNode = new HTMLElement('span');
relatedTitleNode.className = 'workspaceRelatedTitle';
relatedTitleNode.textContent = 'Links Out (2)';
relatedPanel.appendChild(relatedTitleNode);
registry.set('workspaceRelatedPanel', relatedPanel);

const tasksPanel = new HTMLElement('div'); // host with rows for rowCount evidence
tasksPanel.id = 'workspaceTasksPanel';
tasksPanel.parentElement = html;
tasksPanel.__computed = { display: 'flex', visibility: 'visible', opacity: '1' };
tasksPanel.hidden = false;
const taskRow = new HTMLElement('li');
taskRow.className = 'workspaceTagItem';
taskRow.textContent = '- [ ] Packet loss on first synchronization';
tasksPanel.appendChild(taskRow);
registry.set('workspaceTasksPanel', tasksPanel);

global.document = {
  documentElement: html,
  body: { appendChild() {} },
  createElement: (t) => new HTMLElement(t),
  getElementById: (id) => registry.get(id) || null,
};
global.getComputedStyle = (el) => el.__computed;
global.performance = global.performance || { now: () => Date.now() };

class MutationObserver {
  constructor(cb) { this.cb = cb; this.options = null; }
  observe(target, options) {
    this.options = options || null;
    if (observers.indexOf(this) === -1) observers.push(this);
  }
  disconnect() { const i = observers.indexOf(this); if (i > -1) observers.splice(i, 1); }
  takeRecords() { return []; }
}
global.MutationObserver = MutationObserver;

global.WORKSPACE_STATE = { rootHandle: { name: 'Workspace' }, activeFile: null };
global.getJournalComposition = () => 'note';
global.getSidebarComposition = () => ({
  composition: 'note',
  workspaceAvailable: false,
  visibleElementIds: ['workspaceActivePanel', 'workspaceTagsPanel'],
  hiddenElementIds: ['workspaceJournalsPanel'],
  unknownAvailabilityKeys: [],
});
global.MME_PANEL_COMPOSITION = {
  note: { elementId: 'workspaceActivePanel' },
  note1: { elementId: 'workspaceTagsPanel' },
  note2: { elementId: 'workspaceRelatedPanel' },
  note3: { elementId: 'workspaceTasksPanel' },
  unknownKey: { elementId: 'workspacePinnedPanel' },
};

// The LATER named owner. Defined BEFORE the probe loads so the probe's phase
// marker wraps it — this is how "who changed it" becomes an evidence-backed
// attribution instead of a guess.
function renderWorkspaceTagsPanel() {
  tagsPanel.hidden = true;
  tagsPanel.setAttribute('aria-hidden', 'true');
}
global.renderWorkspaceTagsPanel = renderWorkspaceTagsPanel;

// ------------------------------------------------------- capture output
const out = [];
const real = {
  log: console.log,
  warn: console.warn,
  table: console.table,
  group: console.group,
  groupCollapsed: console.groupCollapsed,
  groupEnd: console.groupEnd,
};
console.log = (...a) => out.push(['log', a.map((x) => {
  if (typeof x === 'object') { try { return JSON.stringify(x); } catch (e) { return String(x); } }
  return String(x);
}).join(' ')]);
console.warn = (...a) => out.push(['WARN', a.map(String).join(' ')]);
console.table = (rows) => out.push(['table', JSON.stringify(rows)]);
console.group = (s) => out.push(['group', String(s)]);
console.groupCollapsed = (s) => out.push(['group', String(s)]);
console.groupEnd = () => {};

// ------------------------------------------------------------- run probe
const src = fs.readFileSync(
  path.join(__dirname, '..', 'scripts', 'act4b-visibility-probe.js'), 'utf8');
eval(src);
const mutationsAfterInstall = global.__ACT4B_PROBE__.mutations.length; // probe writes nothing

// ------------------------------------------------------------- scenarios
// A — neutral Journal boot (composition owners have run; hosts on screen).
const snapA = global.__ACT4B_PROBE__.snapshot('A neutral Journal');

// B — a LATER named owner re-hides a host the Note composition showed, and a
//     class-on-<html> flip suppresses the rest (the `workspace-empty` owner).
// Called through the GLOBAL so the probe's phase marker is in the path.
global.renderWorkspaceTagsPanel();
html.classList.remove('workspace-ready');
const snapB = global.__ACT4B_PROBE__.snapshot('B neutral -> Open Note (later owner ran)');

const contrast = global.__ACT4B_PROBE__.compare(snapA, snapB);
const report = global.__ACT4B_PROBE__.report();
const mutationsBefore = global.__ACT4B_PROBE__.mutations.length;
const wrappedBefore = global.renderWorkspaceTagsPanel;

// stop() must restore every wrapper and disconnect the observer.
const stopResult = global.__ACT4B_PROBE__.stop();
const restored = global.renderWorkspaceTagsPanel === renderWorkspaceTagsPanel;
global.renderWorkspaceTagsPanel(); // still works after stop()
const stillWritable = tagsPanel.hidden === true;

// ------------------------------------------------------------ assertions
const text = out.map((o) => o[1]).join('\n');
const hiddenWrite = global.__ACT4B_PROBE__.mutations.find(
  (m) => m.id === 'workspaceTagsPanel' && m.attr === 'hidden');
const classWrite = global.__ACT4B_PROBE__.mutations.find((m) => m.attr === 'class');
const ariaWrite = global.__ACT4B_PROBE__.mutations.find(
  (m) => m.id === 'workspaceTagsPanel' && m.attr === 'aria-hidden');

const checks = [
  ['probe installed (diagnostic, read-only)', /visibility probe installed \(read-only, diagnostic\)/.test(text)],
  ['A snapshot reports the shown Current Document hosts as effective-visible',
    ['workspaceTagsPanel', 'workspaceRelatedPanel', 'workspaceTasksPanel']
      .every((id) => snapA.visibleElementIds.indexOf(id) > -1)],
  // Class A: hidden=true while an author ID rule keeps the host on screen.
  ['detects Class A (hidden=true, computed display=flex)',
    (snapA.contradictions || []).some((c) => /^workspaceActivePanel: hidden=true but computed display=flex/.test(c))],
  ['Class A host is NOT counted effective-visible',
    snapA.visibleElementIds.indexOf('workspaceActivePanel') === -1],
  // Class B: a LATER owner re-hides a host the composition showed.
  ['records the later hidden-property write',
    !!hiddenWrite && hiddenWrite.newValue === 'true'],
  ['names the later owner from the phase marker',
    !!hiddenWrite && hiddenWrite.phase === 'renderWorkspaceTagsPanel'],
  ['reports the re-hiding owner in the mutation log',
    /renderWorkspaceTagsPanel/.test(JSON.stringify(report.mutations))],
  ['B snapshot shows the re-hidden host as NOT effective-visible',
    snapB.visibleElementIds.indexOf('workspaceTagsPanel') === -1],
  // The class mechanism a hidden-only log never sees.
  ['captures the <html> class flip (Class C owner)',
    !!classWrite && classWrite.id === '' && /workspace-ready/.test(String(classWrite.oldValue))],
  ['captures aria-hidden writes', !!ariaWrite],
  ['contrast A->B names the demoted host',
    contrast.becameHidden.indexOf('workspaceTagsPanel') > -1],
  ['does NOT false-positive a genuinely hidden host',
    (snapB.contradictions || []).every((c) => c.indexOf('workspaceTagsPanel') !== 0)],
  ['context block records the shared relationship direction (Links Out)',
    snapA.context.relationshipDirection === 'links-out'],
  ['context block records visible/hidden element ids from the owner',
    Array.isArray(snapA.context.sidebarComposition.hiddenElementIds)],
  ['content-derived value is bounded to 24 chars',
    (snapA.hosts || []).every((h) => !h.firstRowText || h.firstRowText.length <= 24)],
  ['stop() reports the counts', stopResult.stopped === true && stopResult.snapshots === 2],
  ['stop() restores wrapped owners', wrappedBefore !== renderWorkspaceTagsPanel && restored],
  ['probe never wrote to the DOM itself', mutationsAfterInstall === 0],
  ['app still writable after stop (probe removed cleanly)', stillWritable],
];

let failed = 0;
checks.forEach(([name, ok]) => {
  if (ok !== true && ok !== false) failed += 1; // strict-boolean contract
  if (!ok) failed += 1;
  real.log((ok === true ? 'PASS  ' : 'FAIL  ') + name);
});

real.log('\n--- captured probe messages (truncated) ---');
out.slice(0, 24).forEach((o) => real.log(o[0] + ': ' + o[1].slice(0, 220)));

real.log('\n--- captured mutations (probe evidence) ---');
global.__ACT4B_PROBE__.mutations.forEach((m) => {
  real.log('  ' + m.at + 'ms  ' + m.type + '  id=' + (m.id || '(documentElement)') +
    '  attr=' + m.attr + '  ' + m.oldValue + ' -> ' + m.newValue + '  PHASE ' + m.phase);
});

real.log(failed === 0 ? '\nHARNESS: ALL CHECKS PASSED' : '\nHARNESS: ' + failed + ' CHECK(S) FAILED');
process.exit(failed === 0 ? 0 : 1);


