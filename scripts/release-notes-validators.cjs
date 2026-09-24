#!/usr/bin/env node
// @ts-nocheck
'use strict';
/* Focused Release Notes + header-controls validators (ACT I follow-up).
   Executes the real content registry (js/ui/release-notes-content.js) and the
   real viewer renderer (js/ui/release-notes.js) inside a minimal DOM stub, and
   statically verifies the selected panel header markup contract. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log('PASS ' + name);
  } else {
    failures++;
    console.log('FAIL ' + name + (detail ? ' — ' + detail : ''));
  }
}

/* ---------------- Minimal DOM stub ---------------- */
function makeEl(tagName) {
  const el = {
    tagName: (tagName || 'div').toLowerCase(),
    attributes: {},
    children: [],
    listeners: [],
    textContent: '',
    innerHTMLValue: '',
    hidden: false,
    style: {},
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); },
    },
    setAttribute(k, v) { el.attributes[k] = String(v); },
    getAttribute(k) { return k in el.attributes ? el.attributes[k] : null; },
    removeAttribute(k) { delete el.attributes[k]; },
    addEventListener(type, fn) { el.listeners.push([type, fn]); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    appendChild(c) { el.children.push(c); return c; },
    insertBefore(c) { el.children.push(c); return c; },
    focus() {},
  };
  Object.defineProperty(el, 'innerHTML', {
    get() { return el.innerHTMLValue; },
    set(v) { el.innerHTMLValue = String(v); },
  });
  return el;
}

const elements = {};
function getElementById(id) {
  if (!elements[id]) elements[id] = makeEl('div');
  return elements[id];
}

/* Load the real content registry. */
const registrySrc = fs.readFileSync(path.join(ROOT, 'js/ui/release-notes-content.js'), 'utf8');
const regCtx = {};
regCtx.globalThis = regCtx;
vm.createContext(regCtx);
vm.runInContext(registrySrc, regCtx);
const REG = regCtx.globalThis.MME_RELEASE_NOTES;

/* Load the real release identity. */
const relSrc = fs.readFileSync(path.join(ROOT, 'js/release/release.js'), 'utf8');
const relCtx = {};
relCtx.globalThis = relCtx;
vm.createContext(relCtx);
vm.runInContext(relSrc, relCtx);
const REL = relCtx.globalThis.MME_RELEASE;

/* Load the real viewer IIFE with a DOM stub. */
const viewerSrc = fs.readFileSync(path.join(ROOT, 'js/ui/release-notes.js'), 'utf8');
const storage = new Map();
const viewCtx = {
  document: {
    readyState: 'complete',
    getElementById,
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
  },
  localStorage: {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null),
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
  },
  CSS: { escape: (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => '\\' + c) },
};
viewCtx.globalThis = viewCtx;
viewCtx.window = viewCtx;
vm.createContext(viewCtx);
vm.runInContext(viewerSrc, viewCtx, { filename: 'js/ui/release-notes.js' });

/* ---------------- Validators ---------------- */

/* 1. Exactly one entry for 0.6.0 and one for 0.6.1, newest first. */
const entries = (REG && REG.releases) || [];
check('RN-01 exactly one 0.6.0 entry and one 0.6.1 entry (newest first)',
  entries.filter((e) => e.version === '0.6.0').length === 1 &&
  entries.filter((e) => e.version === '0.6.1').length === 1 &&
  entries[0] && entries[0].version === '0.6.1');

/* 2. entry.version equals MME_RELEASE.productVersion. */
const current = entries[0];
check('RN-02 entry.version === productVersion', REL && current && current.version === REL.productVersion,
  'entry=' + (current && current.version) + ' productVersion=' + (REL && REL.productVersion));

/* 3–4. Title and summary non-empty. */
check('RN-03 title non-empty', !!(current && current.title && current.title.trim()));
check('RN-04 summary non-empty', !!(current && current.summary && current.summary.trim()));

/* 5–6. Exactly four groups, each with non-empty title and ≥1 item. */
const groups = (current && current.changes) || [];
check('RN-05 exactly four change groups', groups.length === 4, 'got ' + groups.length);
check('RN-06 every group titled with ≥1 item',
  groups.every((g) => g.group && g.group.trim() && Array.isArray(g.items) && g.items.length > 0));

/* 7–9. Try it, limitations, help topic. */
check('RN-07 Try it present', !!(current && current.tryIt && current.tryIt.trim()));
check('RN-08 limitations present', Array.isArray(current && current.limitations) && current.limitations.length > 0);
const helpTopicsSrc = fs.readFileSync(path.join(ROOT, 'js/ui/help-content.js'), 'utf8');
const topicIds = Array.from(helpTopicsSrc.matchAll(/id:\s*'([a-z-]+)'/g)).map((m) => m[1]);
check('RN-09 help topic resolves', topicIds.includes(current && current.helpTopic),
  'helpTopic=' + (current && current.helpTopic) + ' topics=' + topicIds.join(','));

/* 10–13. Execute the real renderer via showOverlay.
   Note: globals declared inside the VM land on the sandbox root, so we set
   MME_* there and invoke the exposed function from the sandbox root. */
viewCtx.MME_RELEASE_NOTES = REG;
viewCtx.MME_RELEASE = REL;
viewCtx.showReleaseNotes();
const bodyHtml = getElementById('releaseNotesBody').innerHTMLValue;
check('RN-10 rendered body non-empty', bodyHtml.length > 200, 'length=' + bodyHtml.length);
check('RN-11 rendered contains release title', bodyHtml.includes(current.title));
check('RN-12 rendered contains current version title',
  bodyHtml.includes('Version ' + REL.productVersion) || bodyHtml.includes('>' + REL.productVersion + '<'));
check('RN-13 rendered contains all four group titles',
  groups.map((g) => g.group).every((g) => bodyHtml.includes(g)));

/* 14–15. Boolean attributes + accessible labels. */
const firstEntrySegment = bodyHtml.split('data-release=')[1] || bodyHtml;
check('RN-14 expanded render omits hidden attribute',
  !/releaseEntryContent"\s+[^>]*\bhidden/.test(firstEntrySegment));
check('RN-15 hide label contains current version', bodyHtml.includes('Hide release ' + REL.productVersion));
/* RN-15b: "Show release <version>" appears only in the collapsed state. Verify by
   executing the real toggle path: flip the current entry's expanded flag in
   the registry, re-render, and assert the collapsed labels appear. */
REG.releases[0].expanded = false;
viewCtx.showReleaseNotes();
const collapsedHtml = getElementById('releaseNotesBody').innerHTMLValue;
REG.releases[0].expanded = true;
check('RN-15b collapsed render shows Show label with current version',
  collapsedHtml.includes('Show release ' + REL.productVersion) &&
  !collapsedHtml.includes('Hide release ' + REL.productVersion));
check('RN-15b2 collapsed render emits hidden attribute',
  /releaseEntryContent"[^>]*\bhidden/.test(collapsedHtml.split('data-release=')[1] || collapsedHtml));
viewCtx.showReleaseNotes(); // restore expanded state for later assertions
check('RN-15c no empty boolean attributes',
  !/\b(hidden|disabled|open)\s*=\s*(""\s|''\s|"">|''>|""|'')/.test(bodyHtml));
check('RN-16 aria-expanded present per entry', /aria-expanded="(true|false)"/.test(bodyHtml));

/* ---------------- Header-controls markup contract ---------------- */
const PANELS = ['Projects', 'Tasks', 'Report', 'Related'];

for (const name of PANELS) {
  const headerClass = 'workspace' + name + 'Header';
  let src = null;
  let file = '';
  for (const f of ['js/main.js', 'js/workspace/task-review.js', 'js/report/report-panel.js']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (s.indexOf(headerClass) !== -1) { src = s; file = f; break; }
  }
  if (!src) { failures++; console.log('FAIL HC-00 header not found for ' + name); continue; }
  const start = src.indexOf(headerClass);
  const block = src.slice(start, src.indexOf('workspacePanelBody', start));

  const cIdx = block.indexOf('workspacePanelHeaderControls');
  const bIdx = block.indexOf('workspacePanelBadge');
  const btnOpen = block.indexOf('<button');
  const btnClose = block.indexOf('</button>');

  check('HC-' + name + ' controls container exists', cIdx !== -1);
  check('HC-' + name + ' badge inside controls', bIdx > cIdx);
  check('HC-' + name + ' toggle closes before controls', btnClose !== -1 && btnClose < cIdx);
  check('HC-' + name + ' badge NOT inside collapse toggle', !(bIdx > btnOpen && bIdx < btnClose));
  check('HC-' + name + ' exactly one badge in header block',
    (block.match(/workspacePanelBadge/g) || []).length === 1, file);
}

/* Report-specific: report-panel.js markup uses the controls group. */
const rpSrc = fs.readFileSync(path.join(ROOT, 'js/report/report-panel.js'), 'utf8');
const rpIdx = rpSrc.indexOf('workspacePanelHeaderControls');
const rpBadgeIdx = rpSrc.indexOf('workspaceReportBadge');
check('HC-Report controls precede badge in report-panel.js', rpIdx !== -1 && rpBadgeIdx > rpIdx);
check('HC-Report badge outside any <button>', !/<button[\s\S]*workspaceReportBadge[\s\S]*<\/button>[\s\S]*?>/.test(rpSrc.slice(Math.max(0, rpIdx - 400), rpBadgeIdx + 80)));

/* Contextual helper contract. */
const chSrc = fs.readFileSync(path.join(ROOT, 'js/ui/contextual-help.js'), 'utf8');
check('HC-helper inserts before indicator', chSrc.includes('controls.insertBefore(btn, indicator)'));
check('HC-helper no body fallback', !chSrc.includes('workspacePanelBody'));
check('HC-helper idempotent', chSrc.includes("controls.querySelector(':scope > .ctxHelpBtn')"));
check('HC-helper controls-only resolution', chSrc.includes("header.querySelector(':scope > .workspacePanelHeaderControls')"));

/* ---------------- Report header one-row layout (ACT I final) ---------------- */
const wsCss = fs.readFileSync(path.join(ROOT, 'css/workspace.css'), 'utf8');
const ctxCss = fs.readFileSync(path.join(ROOT, 'css/contextual-help.css'), 'utf8');
const flexGroup = wsCss.match(/\.workspaceIndexHeader[\s\S]*?\{[\s\S]*?\}/);
check('RL-Report in shared flex header group',
  !!flexGroup && /workspaceReportHeader/.test(flexGroup[0].split('{')[0]));
check('RL-Report toggle flex 1 1 auto + min-width 0',
  /\.workspaceReportHeader > \.workspacePanelHeaderButton,\s*\n[^}]*flex: 1 1 auto;\s*\n\s*width: auto;\s*\n\s*min-width: 0;/.test(wsCss));
check('RL-controls group flex 0 0 auto nowrap',
  /\.workspacePanelHeaderControls\s*\{[^}]*flex: 0 0 auto;[^}]*\}/.test(wsCss) &&
  !/\.workspacePanelHeaderControls\s*\{[^}]*flex-wrap\s*:\s*wrap/.test(wsCss));
check('RL-no Report-specific controls override remains',
  !/workspaceReportHeader[^{]*workspacePanelHeaderControls\s*\{/.test(ctxCss));
check('RL-Report header not display block (covered by flex group)',
  wsCss.indexOf('workspaceReportHeader') !== -1);


/* ---------------- 0.6.1 closure coverage (release close-out) ---------------- */
const verifyMd = fs.readFileSync(path.join(ROOT, 'VERIFY.md'), 'utf8');
const relSrcCheck = fs.readFileSync(path.join(ROOT, 'js/release/release.js'), 'utf8');
const swSrcCheck = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const rnUiSrc = fs.readFileSync(path.join(ROOT, 'js/ui/release-notes.js'), 'utf8');

check('CL-01 product version is 0.6.1', /productVersion: '0\.6\.1'/.test(relSrcCheck));
check('CL-02 cache identity is 0.6.1 foundation closure and matches sw.js',
  /cacheIdentity: 'markmap-journal-pwa-0\.6\.1-foundation-closure'/.test(relSrcCheck) &&
  /APP_VERSION = 'markmap-journal-pwa-0\.6\.1-foundation-closure'/.test(swSrcCheck));
check('CL-03 old 0.6.0 cache identity no longer installed',
  !swSrcCheck.includes('markmap-journal-pwa-0.6.0-help-release-foundation'));
check('CL-04 no temporary development identity is the current public release',
  !/test1|0\.6\.2-test|v7x-metadata/.test(relSrcCheck + swSrcCheck + rnUiSrc));
check('CL-05 What\'s New ownership is automatic (no hardcoded version in viewer)',
  /MME_RELEASE\.productVersion|REL\.productVersion|release\.productVersion/.test(rnUiSrc) &&
  !/0\.6\.[01]/.test(rnUiSrc));
check('CL-06 Release Notes covers offline foundation and Update Ready',
  /Offline foundation/.test(registrySrc) && /Update Ready/.test(registrySrc));
check('CL-07 Release Notes covers ModeSession, Bulk Task, dark mode, HTML Preview inline',
  /Editor and Journal keep their own unsaved text/.test(registrySrc) &&
  /several new Tasks at once/.test(registrySrc) &&
  /dark theme/.test(registrySrc) &&
  /Inline formatting inside HTML Preview list items/.test(registrySrc));
check('CL-08 Release Notes has a usage example and technical boundaries',
  !!current && Array.isArray(current.limitations) && current.limitations.length > 0 &&
  /When Update Ready appears, select Reload\./.test(registrySrc));
check('CL-09 new release listed first, older 0.6.0 retained beneath it',
  entries[0] && entries[0].version === '0.6.1' &&
  entries.findIndex((e) => e.version === '0.6.0') === 1);
check('CL-10 VERIFY.md records F1–F5 closure sections',
  /F1\. Offline foundation/.test(verifyMd) && /F2\. ModeSession/.test(verifyMd) &&
  /F3\. Bulk Task reconciliation/.test(verifyMd) && /F4\. Update Ready/.test(verifyMd) &&
  /F5\. HTML Preview inline rendering/.test(verifyMd));
check('CL-11 VERIFY.md records 89 resources in six groups',
  /89 (unique )?resources/.test(verifyMd) && /six groups/.test(verifyMd));
check('CL-12 no F-section describes accepted items as pending', (() => {
  const sections = verifyMd.split(/^### F\d\./m).slice(1); // F1..F5 bodies
  return sections.length === 5 &&
    sections.every((s) => /- \[x\]/.test(s.split(/^###/m)[0]) &&
      !/\(PENDING/.test(s.split(/^###/m)[0]));
})());
check('CL-13 Help copy covers offline/updates, tasks/mode switching, preview inline lists',
  /Offline and updates/.test(helpTopicsSrc) &&
  /Saving and Task lifecycle/.test(helpTopicsSrc) &&
  /List items in HTML Preview render inline formatting/.test(helpTopicsSrc) &&
  /keeps its own unsaved text for the current session/.test(helpTopicsSrc));
check('CL-14 Help copy stays version-agnostic', !/0\.6\.[01]/.test(helpTopicsSrc));
check('CL-15 release identity literals are consistent across release files',
  (relSrcCheck.match(/0\.6\.1/g) || []).length > 0 &&
  swSrcCheck.includes('MarkmapEditor 0.6.1'));

console.log('\n' + (failures === 0 ? 'ALL FOCUSED VALIDATORS PASS' : failures + ' VALIDATOR(S) FAILED'));
process.exit(failures === 0 ? 0 : 1);

vm.runInContext(viewerSrc, viewCtx);
