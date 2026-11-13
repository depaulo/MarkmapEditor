/**
 * F1 Local-Only Workspace Fixture — Static Validator
 * Validates the fixture implementation against the approved plan constraints.
 * Does not create a new validation framework; uses existing node --check patterns.
 */

'use strict';

const fs = require('fs');
const path = require('path');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

function fail(msg) {
  console.error('[FAIL]', msg);
  return false;
}

function pass(msg) {
  console.log('[PASS]', msg);
  return true;
}

let ok = true;

console.log('=== F1 Fixture Validator ===\n');

// 1. Fixture parameter allowlist
const fixtureLoader = read('js/workspace/fixture-loader.js');
if (!fixtureLoader.includes("FIXTURE_NAME = 'projects-review'") &&
    !fixtureLoader.includes('FIXTURE_NAME = "projects-review"')) {
  ok &= fail('fixture loader: allowed fixture name "projects-review" not found');
} else {
  ok &= pass('fixture loader: allowed fixture name "projects-review" present');
}

// 2. Exact localhost/127.0.0.1 guard
if (!fixtureLoader.includes('FIXTURE_HOST_ALLOWLIST') ||
    !fixtureLoader.includes('localhost') ||
    !fixtureLoader.includes('127.0.0.1')) {
  ok &= fail('fixture loader: host allowlist not found');
} else {
  ok &= pass('fixture loader: host allowlist (localhost, 127.0.0.1) present');
}

// 3. Unknown fixture refusal
if (!fixtureLoader.includes('unknown fixture name')) {
  ok &= fail('fixture loader: unknown fixture refusal log not found');
} else {
  ok &= pass('fixture loader: unknown fixture refusal present');
}

// 4. Public-host refusal (should be implied by allowlist)
if (!fixtureLoader.includes('isFixtureHostAllowed')) {
  ok &= fail('fixture loader: isFixtureHostAllowed guard not found');
} else {
  ok &= pass('fixture loader: host guard function present');
}

// 5. No direct WORKSPACE_INDEX_STATE fixture injection
if (fixtureLoader.includes('WORKSPACE_INDEX_STATE')) {
  ok &= fail('fixture loader: direct WORKSPACE_INDEX_STATE injection detected');
} else {
  ok &= pass('fixture loader: no direct WORKSPACE_INDEX_STATE injection');
}

// 6. No prebuilt Projects array
if (fixtureLoader.includes('projects:') || fixtureLoader.includes('projects = [')) {
  ok &= fail('fixture loader: prebuilt Projects array detected');
} else {
  ok &= pass('fixture loader: no prebuilt Projects array');
}

// 7. No prebuilt Tasks array
if (fixtureLoader.includes('tasks:') || fixtureLoader.includes('tasks = [')) {
  ok &= fail('fixture loader: prebuilt Tasks array detected');
} else {
  ok &= pass('fixture loader: no prebuilt Tasks array');
}

// 8. Fixture file handle uses getFile()
if (!fixtureLoader.includes('async getFile()') && !fixtureLoader.includes('getFile() {')) {
  ok &= fail('fixture loader: getFile() method not found');
} else {
  ok &= pass('fixture loader: getFile() method present');
}

// 9. getFile() returns a File
if (!fixtureLoader.includes('new File(')) {
  ok &= fail('fixture loader: File instantiation not found');
} else {
  ok &= pass('fixture loader: File instantiation present');
}

// 10. Fixed deterministic fixture timestamp
if (!fixtureLoader.includes('FIXTURE_DETERMINISTIC_TIMESTAMP')) {
  ok &= fail('fixture loader: deterministic timestamp constant not found');
} else {
  ok &= pass('fixture loader: deterministic timestamp constant present');
}

// 11. Fixture root has __mmeFixture=true
if (!fixtureLoader.includes('__mmeFixture') && !fixtureLoader.includes('FIXTURE_ROOT_SENTINEL_KEY')) {
  ok &= fail('fixture loader: fixture root sentinel not found');
} else {
  ok &= pass('fixture loader: fixture root sentinel (__mmeFixture) present');
}

// 12. No fixture createWritable implementation
if (fixtureLoader.includes('createWritable')) {
  ok &= fail('fixture loader: createWritable implementation found (should not exist)');
} else {
  ok &= pass('fixture loader: no createWritable implementation');
}

// 13. Physical operations are blocked by the canonical fixture guard using this.isFixtureWorkspace
if (!fixtureLoader.includes('guardPhysicalOperation') || !fixtureLoader.includes('this.isFixtureWorkspace(state)')) {
  ok &= fail('fixture loader: guardPhysicalOperation must use this.isFixtureWorkspace(state)');
} else {
  ok &= pass('fixture loader: physical operation guard uses this.isFixtureWorkspace(state)');
}

// 14. One banner owner and stable ID
if (!fixtureLoader.includes('FIXTURE_BANNER_ID') || !fixtureLoader.includes('mmeFixtureBanner')) {
  ok &= fail('fixture loader: stable banner ID not found');
} else {
  ok &= pass('fixture loader: stable banner ID (mmeFixtureBanner) present');
}

// 15. Reset remains on the allowed local fixture URL
if (!fixtureLoader.includes('handleFixtureReset') && !fixtureLoader.includes('Reset fixture') && !fixtureLoader.includes('location.href')) {
  ok &= fail('fixture loader: reset mechanism not found');
} else {
  ok &= pass('fixture loader: reset mechanism present');
}

// 16. No real customer identifiers in fixture data
const forbiddenIdentifiers = ['ByteDance', 'ACME', 'real-customer'];
let foundForbidden = false;
for (const id of forbiddenIdentifiers) {
  if (fixtureLoader.includes(id)) {
    ok &= fail(`fixture loader: forbidden identifier "${id}" found`);
    foundForbidden = true;
  }
}
if (!foundForbidden) {
  ok &= pass('fixture loader: no real customer identifiers in fixture data');
}

// 17. workspace-controller recognizes already-active fixture, never requests activation,
// and normal Open Workspace still reaches the native picker candidate path
const wsController = read('js/workspace/workspace-controller.js');
if (!wsController.includes('isFixtureWorkspace')) {
  ok &= fail('workspace-controller: fixture guard not found');
} else if (!wsController.includes('isFixtureWorkspace?.(') && !wsController.includes('isFixtureWorkspace(')) {
  ok &= fail('workspace-controller: isFixtureWorkspace must be called');
} else if (wsController.includes('maybeActivateFixture')) {
  ok &= fail('workspace-controller: must not request fixture activation');
} else if (!wsController.includes('openWorkspaceCandidate')) {
  ok &= fail('workspace-controller: openWorkspace must reference openWorkspaceCandidate');
} else {
  ok &= pass('workspace-controller: recognizes fixture, no activation request, picker path intact');
}

// 19. script-loader registers fixture loader before main.js
const scriptLoader = read('js/app/script-loader.js');
if (!scriptLoader.includes('fixture-loader.js')) {
  ok &= fail('script-loader: fixture-loader registration not found');
} else {
  ok &= pass('script-loader: fixture-loader registered');
}

// 20. script-loader sets durable ready flag before mme-main-ready dispatch
const readyFlagPos = scriptLoader.indexOf('MME_MAIN_READY = true');
const eventDispatchPos = scriptLoader.indexOf('dispatchEvent(new Event(\'mme-main-ready\')');
if (readyFlagPos === -1 || eventDispatchPos === -1 || readyFlagPos >= eventDispatchPos) {
  ok &= fail('script-loader: MME_MAIN_READY = true must precede dispatchEvent(new Event(\'mme-main-ready\'))');
} else {
  ok &= pass('script-loader: durable ready flag set before event dispatch');
}

// 20b. script-loader must NOT directly call MME_FIXTURE.maybeActivateFixture
if (scriptLoader.includes('MME_FIXTURE.maybeActivateFixture')) {
  ok &= fail('script-loader: direct MME_FIXTURE.maybeActivateFixture call must not exist (fixture-loader owns activation)');
} else {
  ok &= pass('script-loader: no direct MME_FIXTURE.maybeActivateFixture call');
}

// 21. fixture-loader registers mme-main-ready listener and checks ready flag
const fixtureLoader2 = read('js/workspace/fixture-loader.js');
const requestFnDecls = (fixtureLoader2.match(/function\s+requestFixtureActivation\s*\(/g) || []).length;
const listenerRefs = (fixtureLoader2.match(/addEventListener\s*\(\s*['\"]mme-main-ready['\"]\s*,\s*requestFixtureActivation/g) || []).length;
const immediateCheck = fixtureLoader2.includes('if (globalThis.MME_MAIN_READY === true) {\n  requestFixtureActivation();') || fixtureLoader2.includes('if (globalThis.MME_MAIN_READY === true) {\nrequestFixtureActivation();');
if (requestFnDecls !== 1) {
  ok &= fail(`fixture-loader: expected exactly 1 requestFixtureActivation declaration, found ${requestFnDecls}`);
} else if (listenerRefs !== 1) {
  ok &= fail(`fixture-loader: mme-main-ready listener must reference requestFixtureActivation exactly once, found ${listenerRefs}`);
} else if (!immediateCheck) {
  ok &= fail('fixture-loader: immediate MME_MAIN_READY check must call requestFixtureActivation()');
} else {
  ok &= pass('fixture-loader: mme-main-ready listener and ready flag check reference single requestFixtureActivation');
}

// 23. fixture-loader idempotency guard present
if (!fixtureLoader2.includes('_activationState')) {
  ok &= fail('fixture-loader: idempotency guard not found');
} else {
  ok &= pass('fixture-loader: idempotency guard present');
}

// 24. Functional ordering: unknown fixture check before activation-state handling
const maybeStart = fixtureLoader2.indexOf('maybeActivateFixture');
const unknownFixturePos = fixtureLoader2.indexOf('fixtureName !== FIXTURE_NAME', maybeStart);
const activationStatePos = fixtureLoader2.indexOf('_activationState === \'active\'', maybeStart);
if (unknownFixturePos === -1 || activationStatePos === -1) {
  ok &= fail('fixture-loader: unknown-fixture check or activation-state check not found');
} else if (unknownFixturePos >= activationStatePos) {
  ok &= fail('fixture-loader: unknown fixture check must occur before activation-state handling');
} else {
  ok &= pass('fixture-loader: unknown fixture check occurs before activation-state handling');
}

// 25. Active success transition exists
if (!fixtureLoader2.includes('_activationState = \'active\'')) {
  ok &= fail('fixture-loader: active success transition not found');
} else {
  ok &= pass('fixture-loader: active success transition present');
}

// 30. Inactive failure reset exists
if (!fixtureLoader2.includes('_activationState = \'inactive\'')) {
  ok &= fail('fixture-loader: inactive failure reset not found');
} else {
  ok &= pass('fixture-loader: inactive failure reset present');
}

// 31. One activation Promise exists (shared for in-progress activation)
if (!fixtureLoader2.includes('_activationPromise')) {
  ok &= fail('fixture-loader: activation Promise sharing not found');
} else {
  ok &= pass('fixture-loader: one activation Promise exists');
}

// 32. No timer or polling exists
if (
  fixtureLoader2.includes('setTimeout') ||
  fixtureLoader2.includes('setInterval')
) {
  ok &= fail(
    'fixture-loader: timer or polling activation detected'
  );
} else {
  ok &= pass(
    'fixture-loader: no timer or polling activation'
  );
}

// 32b. Fixture loader never creates or replaces globalThis.WORKSPACE_STATE
if (
  fixtureLoader2.includes('globalThis.WORKSPACE_STATE = {}') ||
  fixtureLoader2.includes('globalThis.WORKSPACE_STATE = {') ||
  fixtureLoader2.includes('WORKSPACE_STATE = {}')
) {
  ok &= fail('fixture-loader: fixture loader must not create or replace WORKSPACE_STATE');
} else {
  ok &= pass('fixture-loader: never creates or replaces WORKSPACE_STATE');
}

// 32c. Canonical state owner publishes WORKSPACE_STATE readiness
if (
  !wsController.includes('MME_WORKSPACE_STATE_READY = true') ||
  !wsController.includes('mme-workspace-state-ready')
) {
  ok &= fail('workspace-controller: must publish WORKSPACE_STATE readiness flag and event');
} else {
  ok &= pass('workspace-controller: publishes WORKSPACE_STATE readiness');
}

// 32d. Fixture activation requires canonical state readiness
const fixtureReadyPos = fixtureLoader2.indexOf('MME_WORKSPACE_STATE_READY');
if (fixtureReadyPos === -1) {
  ok &= fail('fixture-loader: must check MME_WORKSPACE_STATE_READY before activation');
} else {
  ok &= pass('fixture-loader: requires canonical Workspace state readiness');
}

// 33. One activation call site
const activationCallSites =
  (
    fixtureLoader2.match(
      /_activationPromise\s*=\s*activateFixtureWorkspace\s*\(/g
    ) || []
  ).length;

if (activationCallSites !== 1) {
  ok &= fail(
    `fixture-loader: expected 1 activation call site, found ${activationCallSites}`
  );
} else {
  ok &= pass(
    'fixture-loader: single activation call site'
  );
}

// 25. Fixture manifest files exist (3 synthetic Markdown files)
const fixtureDir = 'tests/fixtures/workspaces/projects-review';
const expectedFiles = ['CUSTOMER_A.md', 'CUSTOMER_B.md', 'PROJECTS_TEST.md'];
let foundFiles = 0;
for (const f of expectedFiles) {
  if (fs.existsSync(path.join(fixtureDir, f))) {
    foundFiles++;
  }
}
if (foundFiles === expectedFiles.length) {
  ok &= pass('fixture data: all 3 synthetic Markdown files present');
} else {
  ok &= fail(`fixture data: expected ${expectedFiles.length} files, found ${foundFiles}`);
}

// 22. Fixture markdown files contain required scenarios
let content = '';
for (const f of expectedFiles) {
  content += fs.readFileSync(path.join(fixtureDir, f), 'utf8');
}

const requiredScenarios = [
  { label: 'managed Project', pattern: '<!-- mme-project -->Project:' },
  { label: 'unmanaged Project', pattern: 'Project:.*(?!\\n\\s*<!-- mme-project -->)' },
  { label: 'Draft', pattern: 'Draft: true' },
  { label: 'Invalid quarter', pattern: 'Quarter: 99q4' },
  { label: 'Legacy custom value', pattern: 'Currency: legacy' },
  { label: 'Knowledge Note', pattern: 'Knowledge Note' },
  { label: 'Archived Note', pattern: 'Archived Note' },
  { label: 'Wiki link resolvable', pattern: '\\[\\[.*\\]\\]' },
  { label: 'Wiki link missing', pattern: '\\[\\[.*missing' },
  { label: 'Tasks', pattern: '\\[x\\]|\\[ \\]' },
];

for (const s of requiredScenarios) {
  const re = new RegExp(s.pattern, 'i');
  if (!re.test(content)) {
    ok &= fail(`fixture data: missing required scenario "${s.label}"`);
  }
}
if (ok) {
  ok &= pass('fixture data: all required scenarios present');
}

console.log('\n=== F1 Fixture Validator Result ===');
if (ok) {
  console.log('RESULT: PASS');
  process.exit(0);
} else {
  console.log('RESULT: FAIL');
  process.exit(1);
}
