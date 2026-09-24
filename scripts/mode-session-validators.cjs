#!/usr/bin/env node
'use strict';

/**
 * ModeSession safe-restoration validators (recreated regression harness).
 *
 * Loads the REAL js/core/mode-session.js inside a vm sandbox with recording DOM
 * / bridge stubs, then drives capture and restore through the module's own
 * public API (the compat globals it publishes). Nothing is re-implemented: the
 * shipped source is the code under test.
 *
 * Accepted contract under test: the editor text owner is the #md textarea; the
 * CodeMirror bridge (__cmSetText) is published asynchronously by
 * js/editor/codemirror-bootstrap.js and may be absent during boot or
 * permanently absent after the textarea fallback. Restoration must therefore
 * write the textarea unconditionally, mirror into CodeMirror only when the
 * bridge exists, run both writes inside the application-owned suppression
 * helper, restore dirty/file state afterwards through the existing runtime
 * owner, and fall back to setCurrentEditorTextSafe only when neither channel
 * accepted the text. No listener, timeout, polling, pending state, or
 * generation counter may exist.
 *
 * Usage: node scripts/mode-session-validators.cjs
 */

const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'js', 'core', 'mode-session.js');
const MODULE_SOURCE = fs.readFileSync(MODULE_PATH, 'utf8');
const MAIN_JS_PATH = path.join(ROOT, 'js', 'main.js');

const results = [];
function check(id, name, ok, detail) {
  results.push({ id, name, ok: Boolean(ok), detail: detail == null ? '' : String(detail) });
}
function group(title) {
  results.push({ group: title });
}

function makeClassList(initial) {
  const set = new Set(initial || []);
  return {
    _set: set,
    contains: (c) => set.has(c),
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
    has: (c) => set.has(c),
  };
}

// One isolated application-like environment per scenario.
function createEnv(cfg) {
  const config = cfg || {};
  const calls = {
    suppressionRuns: 0,
    appText: [],
    cmSetText: [],
    cmSetValue: [],
    appliedStates: [],
    runtimeCapture: [],
    runtimeRestore: [],
    toggleEditor: 0,
    toggleHtml: 0,
    titleUpdates: 0,
    logs: [],
    listeners: [],
    timers: [],
    textareaWrites: [],
  };

  const rootClasses = makeClassList(config.rootClasses || []);
  const bodyClasses = makeClassList(config.bodyClasses || []);

  let textareaValue = config.textareaValue == null ? '' : String(config.textareaValue);
  const textarea = config.noTextarea
    ? null
    : {
        id: 'md',
        get value() {
          return textareaValue;
        },
        set value(next) {
          textareaValue = String(next);
          calls.textareaWrites.push(textareaValue);
        },
      };

  const htmlPane = { id: 'htmlPane', style: { display: config.htmlDisplay || 'none' } };

  const document = {
    readyState: 'complete',
    documentElement: {
      dataset: { appContext: config.appContext || 'editor' },
      classList: rootClasses,
    },
    body: { classList: bodyClasses },
    getElementById: (id) => {
      if (id === 'md') return textarea;
      if (id === 'htmlPane') return htmlPane;
      return null;
    },
    addEventListener: (type, fn) => calls.listeners.push({ target: 'document', type, fn }),
  };

  const sandbox = {
    console: { info() {}, log() {}, warn() {}, error() {} },
    document,
    location: { href: config.href || 'https://example.test/' },
    URL,
    Date,
    log: (m) => calls.logs.push(String(m)),
    setTimeout: (fn, ms) => {
      calls.timers.push({ kind: 'timeout', fn, ms });
      return calls.timers.length;
    },
    setInterval: (fn, ms) => {
      calls.timers.push({ kind: 'interval', fn, ms });
      return calls.timers.length;
    },
    clearTimeout: () => {},
    clearInterval: () => {},
    toggleEditor: () => {
      calls.toggleEditor += 1;
    },
    toggleHtml: () => {
      calls.toggleHtml += 1;
    },
    updateDocumentTitle: () => {
      calls.titleUpdates += 1;
    },
    MME_MODE_RUNTIME_SESSIONS: {
      captureCurrentRuntime: (mode) => calls.runtimeCapture.push(mode),
      restoreRuntime: (mode) => calls.runtimeRestore.push(mode),
    },
  };

  if (config.workspaceActiveFile) {
    sandbox.WORKSPACE_STATE = { activeFile: config.workspaceActiveFile };
  }

  sandbox.window = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(MODULE_SOURCE, sandbox, { filename: MODULE_PATH });

  // Post-load wiring (the module resolves these at call time).
  if (!config.noBridge) {
    sandbox.__cmSetText = (text) => calls.cmSetText.push(String(text));
  }

  if (!config.noAppBridge) {
    sandbox.MME_APP = {
      runProgrammaticTextChange: (fn) => {
        calls.suppressionRuns += 1;
        return fn();
      },
      applyCurrentDocumentRuntimeState: (state) => {
        calls.appliedStates.push(Object.assign({}, state));
      },
      setText: (text) => calls.appText.push(String(text)),
      getCurrentDocumentRuntimeState: () => ({ fileName: config.runtimeFileName || '' }),
      isDirty: () => Boolean(config.bridgeDirty),
    };
  }

  const sessions = sandbox.APP_MODE_SESSIONS || { editor: {}, journal: {}, slides: {} };

  return {
    sandbox,
    calls,
    sessions,
    textarea,
    htmlPane,
    rootClasses,
    bodyClasses,
    session(mode, session) {
      sessions[mode] = session;
      return session;
    },
    restore: (mode, reason) => sandbox.restoreModeSession(mode, reason),
    capture: (reason) => sandbox.captureCurrentModeSession(reason),
    setBridge: (fn) => {
      if (fn == null) delete sandbox.__cmSetText;
      else sandbox.__cmSetText = fn;
    },
    removeAppBridge: () => {
      delete sandbox.MME_APP;
    },
  };
}

const session = (text, extra) =>
  Object.assign({ mode: 'editor', sessionId: 'editor-main', text, fileName: '', dirty: false }, extra || {});

/* A. module surface */
group('A. module surface');
{
  const env = createEnv({});
  check('M1', 'module publishes MME_MODE_SESSION', env.sandbox.MME_MODE_SESSION && env.sandbox.window.MME_MODE_SESSION === env.sandbox.MME_MODE_SESSION);
  check('M2', 'compat globals published (capture/restore/mode id)', typeof env.sandbox.restoreModeSession === 'function' && typeof env.sandbox.captureCurrentModeSession === 'function' && typeof env.sandbox.getCurrentModeIdSafe === 'function');
  check('M3', 'mode ids are editor/journal/slides', JSON.stringify(env.sandbox.MME_MODE_SESSION.APP_MODE_IDS) === '["editor","journal","slides"]');
  check('M4', 'normalizeAppModeId maps valid ids and falls back to editor', env.sandbox.normalizeAppModeId('JOURNAL') === 'journal' && env.sandbox.normalizeAppModeId('nope') === 'editor');
  check('M5', 'module load registers no listener, timeout or interval', env.calls.listeners.length === 0 && env.calls.timers.length === 0);
  check('M6', 'module load performs no editor write', env.calls.textareaWrites.length === 0);
}

/* B. no session (CASE E) */
group('B. no session (CASE E)');
{
  const env = createEnv({ textareaValue: 'KEEP' });
  const ret = env.restore('editor', 'test');
  check('M7', 'no session -> returns false', ret === false);
  check('M8', 'no session -> textarea untouched', env.textarea.value === 'KEEP' && env.calls.textareaWrites.length === 0);
  check('M9', 'no session -> no bridge call, no state application, no toggle', env.calls.cmSetText.length === 0 && env.calls.appliedStates.length === 0 && env.calls.toggleEditor === 0 && env.calls.toggleHtml === 0);
  check('M10', 'no session -> logs "no session to restore"', env.calls.logs.some((l) => l.includes('no session to restore')));
}

/* C. ready bridge (CASE A) */
group('C. ready bridge (CASE A)');
{
  const env = createEnv({ textareaValue: 'OLD' });
  env.session('editor', session('EDITOR-READY'));
  const ret = env.restore('editor', 'test');
  check('M11', 'ready bridge -> returns true', ret === true);
  check('M12', 'ready bridge -> textarea written once with the exact session text', env.calls.textareaWrites.length === 1 && env.textarea.value === 'EDITOR-READY', JSON.stringify(env.calls.textareaWrites));
  check('M13', 'ready bridge -> exactly ONE bridge call with the same text', env.calls.cmSetText.length === 1 && env.calls.cmSetText[0] === 'EDITOR-READY', JSON.stringify(env.calls.cmSetText));
  check('M14', 'coordinated textarea+bridge write is one logical restore', env.calls.suppressionRuns === 1, `runs=${env.calls.suppressionRuns}`);
  check('M15', 'dirty + fileName restored once through applyCurrentDocumentRuntimeState', env.calls.appliedStates.length === 1 && env.calls.appliedStates[0].dirty === false && env.calls.appliedStates[0].fileName === '');
  check('M16', 'runtime session restore invoked once for the mode', env.calls.runtimeRestore.length === 1 && env.calls.runtimeRestore[0] === 'editor');
  check('M17', 'document title updated once', env.calls.titleUpdates === 1);
}

/* D. delayed bridge (CASE B) */
group('D. delayed bridge (CASE B)');
{
  const env = createEnv({ noBridge: true, textareaValue: 'OLD' });
  env.session('editor', session('EDITOR-DELAYED'));
  let threw = null;
  let ret = null;
  try {
    ret = env.restore('editor', 'test');
  } catch (error) {
    threw = error;
  }
  check('M18', 'delayed bridge -> no exception thrown', threw === null, threw ? String(threw.message) : '');
  check('M19', 'delayed bridge -> returns true', ret === true);
  check('M20', 'delayed bridge -> textarea written once', env.calls.textareaWrites.length === 1 && env.textarea.value === 'EDITOR-DELAYED');
  check('M21', 'delayed bridge -> ZERO bridge calls', env.calls.cmSetText.length === 0);
  check('M22', 'delayed bridge -> no listener, no cm-ready listener, no timer', env.calls.listeners.length === 0 && env.calls.timers.length === 0);
  check('M23', 'delayed bridge -> later restoration steps still complete', env.calls.appliedStates.length === 1 && env.calls.titleUpdates === 1);
  const adopted = { value: env.textarea.value };
  check('M24', 'simulated CodeMirror bootstrap adopts the restored textarea text', adopted.value === 'EDITOR-DELAYED');
}

/* E. fallback (CASE D) */
group('E. textarea fallback (CASE D)');
{
  const env = createEnv({ noBridge: true, noTextarea: true });
  env.session('editor', session('EDITOR-FALLBACK'));
  let threw = null;
  let ret = null;
  try {
    ret = env.restore('editor', 'test');
  } catch (error) {
    threw = error;
  }
  check('M25', 'fallback -> no TypeError', threw === null, threw ? String(threw.message) : '');
  check('M26', 'fallback -> returns true (no silent session loss)', ret === true);
  check('M27', 'fallback -> last-resort setter used exactly once', env.calls.appText.length === 1 && env.calls.appText[0] === 'EDITOR-FALLBACK');
  check('M28', 'fallback -> later restoration steps complete', env.calls.appliedStates.length === 1 && env.calls.titleUpdates === 1);
}

/* F. empty text */
group('F. empty text is an intentional restore');
{
  const env = createEnv({ textareaValue: 'PREVIOUS' });
  env.session('editor', session(''));
  const ret = env.restore('editor', 'test');
  check('M29', 'empty session text clears the editor and returns true', ret === true && env.textarea.value === '');
  check('M30', 'empty text is not treated as "no session"', !env.calls.logs.some((l) => l.includes('no session to restore')));
}

/* G. dirty + file state */
group('G. dirty + file state');
{
  const dirtyEnv = createEnv({ textareaValue: 'x' });
  dirtyEnv.session('editor', session('DIRTY-TEXT', { dirty: true, fileName: 'journal/2026-09-24.md' }));
  dirtyEnv.restore('editor', 'test');
  check('M31', 'dirty snapshot restored (dirty=true) with fileName', Boolean(dirtyEnv.calls.appliedStates[0]) && dirtyEnv.calls.appliedStates[0].dirty === true && dirtyEnv.calls.appliedStates[0].fileName === 'journal/2026-09-24.md');

  const cleanEnv = createEnv({ textareaValue: 'x' });
  cleanEnv.session('editor', session('CLEAN-TEXT', { dirty: false }));
  cleanEnv.restore('editor', 'test');
  check('M32', 'clean snapshot is not turned dirty by the restore', Boolean(cleanEnv.calls.appliedStates[0]) && cleanEnv.calls.appliedStates[0].dirty === false);
}

/* H. mode isolation, stale safety, rapid switching */
group('H. mode isolation, stale safety, rapid switching');
{
  const env = createEnv({ textareaValue: 'BOOT' });
  env.session('editor', session('EDITOR-UNSAVED'));
  env.session('journal', session('JOURNAL-UNSAVED', { sessionId: 'journal-main' }));

  env.restore('editor', 'switch');
  const afterEditor = env.textarea.value;
  env.restore('journal', 'switch');
  const afterJournal = env.textarea.value;
  env.restore('editor', 'switch');
  env.restore('journal', 'switch');
  env.restore('editor', 'switch');

  check('M33', 'editor restore yields editor text only', afterEditor === 'EDITOR-UNSAVED');
  check('M34', 'journal restore yields journal text only (no stale editor injection)', afterJournal === 'JOURNAL-UNSAVED');
  check('M35', 'rapid switching: last valid restore wins per mode', env.textarea.value === 'EDITOR-UNSAVED');
  check('M36', 'each restore performs exactly one textarea write (no duplicate restore)', env.calls.textareaWrites.length === 5, `writes=${env.calls.textareaWrites.length}`);
  check('M37', 'each restore runs inside exactly one suppression scope', env.calls.suppressionRuns === 5, `runs=${env.calls.suppressionRuns}`);
  check('M38', 'no residual listener/timer/pending state after switching', env.calls.listeners.length === 0 && env.calls.timers.length === 0);
}

/* I. guards, capture, runtime compatibility, TypeError regression */
group('I. guards, capture, runtime compatibility');
{
  const guardEnv = createEnv({ workspaceActiveFile: 'notes.md' });
  guardEnv.session('journal', session('JOURNAL-STALE'));
  check('M39', 'journal restore skipped when a workspace activeFile exists', guardEnv.restore('journal', 'test') === false && guardEnv.calls.textareaWrites.length === 0);

  const capEnv = createEnv({ textareaValue: 'CAPTURE-TEXT', bridgeDirty: true });
  capEnv.session('editor', {});
  const captured = capEnv.capture('test');
  check('M40', 'capture stores mode, sessionId, text, dirty and timestamp', captured.mode === 'editor' && captured.sessionId === 'editor-main' && captured.text === 'CAPTURE-TEXT' && captured.dirty === true && typeof captured.timestamp === 'number');
  check('M41', 'capture publishes the session on APP_MODE_SESSIONS[mode]', capEnv.sessions.editor === captured);
  check('M42', 'capture delegates live resources to MME_MODE_RUNTIME_SESSIONS', capEnv.calls.runtimeCapture.length === 1 && capEnv.calls.runtimeCapture[0] === 'editor');

  const bareEnv = createEnv({ noAppBridge: true, textareaValue: 'OLD' });
  bareEnv.session('editor', session('BARE'));
  let bareThrew = null;
  let bareRet = null;
  try {
    bareRet = bareEnv.restore('editor', 'test');
  } catch (error) {
    bareThrew = error;
  }
  check('M43', 'restore works without MME_APP.runProgrammaticTextChange', bareThrew === null && bareRet === true && bareEnv.textarea.value === 'BARE');

  const regEnv = createEnv({ noBridge: true, textareaValue: 'OLD' });
  regEnv.session('editor', session('REGRESSION'));
  let regThrew = null;
  try {
    regEnv.restore('editor', 'test');
  } catch (error) {
    regThrew = error;
  }
  check('M44', 'no "__cmSetText is not a function" TypeError regression', regThrew === null, regThrew ? String(regThrew.message) : '');
  check('M45', 'runtime session compatibility preserved (no duplicate text owner)', regEnv.calls.runtimeRestore.length === 1 && regEnv.calls.textareaWrites.length === 1);
}

/* J. shipped source contract */
group('J. shipped source contract (no deferred machinery)');
{
  check('M46', 'nullish session text derivation String(session.text ?? "")', /String\(session\.text \?\? ''\)/.test(MODULE_SOURCE));
  check('M47', 'no cm-ready listener anywhere in the module', !MODULE_SOURCE.includes('cm-ready'));
  check('M48', 'no setTimeout / setInterval retry machinery in the module', !/setInterval\(/.test(MODULE_SOURCE) && !/setTimeout\(/.test(MODULE_SOURCE));
  check('M49', 'no pending-restore state or generation counter', !/pendingRestore|pending_restore|restoreToken|restoreGeneration|__mmePending/i.test(MODULE_SOURCE));
  check('M50', 'setCurrentEditorTextSafe is only the last-resort branch', /if \(!applied\) \{\s*setCurrentEditorTextSafe\(nextText\);\s*\}/.test(MODULE_SOURCE));
  check('M51', 'textarea write precedes the optional bridge mirror', MODULE_SOURCE.indexOf('textarea.value = nextText') !== -1 && MODULE_SOURCE.indexOf('textarea.value = nextText') < MODULE_SOURCE.indexOf('globalThis.__cmSetText(nextText)'));
  check('M52', 'no unguarded globalThis.__cmSetText( call site', (() => {
    const guardRe = /typeof globalThis\.__cmSetText === 'function'|if \(globalThis\.__cmSetText\)|if \(cmBridgeReady\)/;
    const lines = MODULE_SOURCE.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].includes('__cmSetText(')) continue;
      const window = lines.slice(Math.max(0, i - 4), i + 1).join('\n');
      if (!guardRe.test(window)) return false;
    }
    return true;
  })());
  check('M55', 'cmBridgeReady derives from the typeof bridge guard', /const cmBridgeReady = typeof globalThis\.__cmSetText === 'function';/.test(MODULE_SOURCE));
  check('M53', 'editor text owner resolves #md', /document\.getElementById\('md'\)/.test(MODULE_SOURCE));
  check('M54', 'main.js still owns the canonical programmatic write helper', /runProgrammaticTextChange/.test(fs.readFileSync(MAIN_JS_PATH, 'utf8')));
}

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
console.log('MODESESSION SAFE RESTORATION VALIDATORS');
console.log(`${passed} passed, ${failed} failed`);
console.log('========================================');

process.exit(failed ? 1 : 0);
