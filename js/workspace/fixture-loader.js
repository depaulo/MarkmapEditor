// ============================================================
// MarkmapEditor — Local-Only Workspace Fixture Loader (F1 MVP)
// Subject to: PLAN ONLY / NOT IMPLEMENTATION AUTHORIZATION
// Classic script (loaded via appendScript, not ES module).
// ============================================================

'use strict';

// =====================
// Fixture configuration
// =====================
const FIXTURE_PARAM = 'mme-fixture';
const FIXTURE_NAME = 'projects-review';
const FIXTURE_HOST_ALLOWLIST = ['localhost', '127.0.0.1'];
const FIXTURE_ROOT_SENTINEL_KEY = '__mmeFixture';
const FIXTURE_BANNER_ID = 'mmeFixtureBanner';
const FIXTURE_BANNER_TEXT = 'TEST FIXTURE · projects-review · Read-only';
const FIXTURE_RESET_TEXT = 'Reset fixture';
const FIXTURE_DETERMINISTIC_TIMESTAMP = 1700000000000; // fixed deterministic timestamp

// =====================
// Helpers
// =====================

function isFixtureHostAllowed() {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  return FIXTURE_HOST_ALLOWLIST.includes(hostname);
}

function getFixtureParam() {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return params.get(FIXTURE_PARAM) || '';
}

function isFixtureActive() {
  return getFixtureParam() === FIXTURE_NAME && isFixtureHostAllowed();
}

// =====================
// FixtureFileHandle — minimal read-only handle (getFile only)
// =====================

class FixtureFileHandle {
  constructor(name, markdown, deterministicTimestamp = FIXTURE_DETERMINISTIC_TIMESTAMP) {
    this.name = name;
    this.kind = 'file';
    this._markdown = markdown;
    this._timestamp = deterministicTimestamp;
  }

  async getFile() {
    return new File(
      [this._markdown],
      this.name,
      {
        type: 'text/markdown',
        lastModified: this._timestamp,
      }
    );
  }
}

// =====================
// Record builder
// =====================

function buildFixtureRecord(name, markdown) {
  const ext = '.md';
  return {
    kind: 'notes',
    name: `${name}${ext}`,
    path: `notes/${name}${ext}`,
    handle: new FixtureFileHandle(`${name}${ext}`, markdown),
  };
}

// =====================
// Manifest — inlined Markdown data
// =====================

const FIXTURE_MANIFEST = {
  CUSTOMER_A: `# FIXTURE_A

## Managed Projects

<!-- mme-project -->Project: PROJECT_ALPHA, Value: 50000, Currency: usd, Order: 26q4

<!-- mme-project -->Project: PROJECT_BETA, Value: 30000, Currency: usd, Order: 27q4

## Unmanaged Project

Project: OWNER_A, Value: 9999

## Draft Project

<!-- mme-project -->Project: FIXTURE_DRAFT, Value: 10000, Currency: usd, Order: 26q4, Draft: true

## Invalid Quarter Project

<!-- mme-project -->Project: FIXTURE_INVALID_Q, Value: 5000, Currency: usd, Quarter: 99q4

## Legacy Custom Value Project

<!-- mme-project -->Project: FIXTURE_LEGACY, Value: 99999, Currency: legacy, Order: old

## Knowledge Note

Some knowledge content with #tag and ##nested-tag.

## Archived Note

Content marked as archived.

## Resolvable Wiki Link

[[FIXTURE_OTHER_NOTE]] resolvable link

## Missing Wiki Link

[[FIXTURE_MISSING_NOTE]] unresolved link

## Task Example

- [x] Completed Task
- [ ] Open Task`,

  CUSTOMER_B: `# FIXTURE_B

## Managed Projects

<!-- mme-project -->Project: FIXTURE_MANAGED_1, Value: 75000, Currency: usd, Order: 27q3

<!-- mme-project -->Project: FIXTURE_MANAGED_2, Value: 25000, Currency: usd, Draft: true

## Unmanaged Project

Project: FIXTURE_UNMANAGED

## Knowledge Note

# FIXTURE_KNOWLEDGE_2

More knowledge content.

## Archived Note

# FIXTURE_ARCHIVED_2

## Resolvable Wiki Link

[[FIXTURE_RESOLVABLE_2]] resolvable link

## Missing Wiki Link

[[FIXTURE_MISSING_2]]

## Tasks

- [x] Done
- [ ] Todo
- [x] Done`,

  PROJECTS_TEST: `# Projects Test

## Managed Projects

<!-- mme-project -->Project: FIXTURE_MANAGED_3, Value: 10000, Currency: usd, Order: 26q4

<!-- mme-project -->Project: FIXTURE_MANAGED_4, Value: 20000, Currency: usd, Order: 27q4

<!-- mme-project -->Project: FIXTURE_MANAGED_5, Value: 15000, Currency: usd, Order: 26q3

## Unmanaged Project

Project: FIXTURE_UNMANAGED_2

## Draft Project

<!-- mme-project -->Project: FIXTURE_DRAFT_2, Value: 5000, Currency: usd, Draft: true

### Discard section

Discard changes

## Invalid Draft

<!-- mme-project -->Project: FIXTURE_INVALID_DRAFT, Value: 1000, Currency: usd, Quarter: 99q4

## Knowledge Note

# FIXTURE_KNOWLEDGE_3

Project-related knowledge.

## Archived Project Note

# FIXTURE_ARCHIVED_3`
};

// Build fixture records from manifest
const fixtureRecords = Object.entries(FIXTURE_MANIFEST).map(
  ([name, markdown]) => buildFixtureRecord(name, markdown)
);

// =====================
// Fixture banner
// =====================

function renderFixtureBanner() {
  const existing = document.getElementById(FIXTURE_BANNER_ID);
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = FIXTURE_BANNER_ID;
  banner.style.cssText = [
    'position: fixed',
    'top: 80px',
    'left: 0',
    'right: 0',
    'background: #ffeb3b',
    'border: 1px solid #ccc',
    'padding: 8px 12px',
    'font-size: 12px',
    'font-family: sans-serif',
    'z-index: 9999',
    'color: #000',
  ].join('; ');
  banner.textContent = FIXTURE_BANNER_TEXT;

  const resetBtn = document.createElement('button');
  resetBtn.textContent = FIXTURE_RESET_TEXT;
  resetBtn.style.cssText = [
    'margin-left: 12px',
    'background: #fff',
    'border: 1px solid #ccc',
    'padding: 2px 6px',
    'font-size: 11px',
    'cursor: pointer',
  ].join('; ');
  resetBtn.onclick = handleFixtureReset;

  banner.appendChild(resetBtn);
  document.body.insertBefore(banner, document.body.firstChild);
}

function handleFixtureReset() {
  window.location.href = 'http://127.0.0.1:8000/?mme-fixture=projects-review';
}

// =====================
// Main activation
// =====================

async function activateFixtureWorkspace() {
  // Idempotency guard: do not activate more than once per page load.
  if (globalThis.MME_FIXTURE._activationState === 'active' ||
      globalThis.MME_FIXTURE._activationState === 'activating') {
    return false;
  }
  globalThis.MME_FIXTURE._activationState = 'activating';

  try {
    if (!isFixtureActive()) {
      globalThis.MME_FIXTURE._activationState = 'inactive';
      return false;
    }

    // Require canonical Workspace state object — never create or replace it.
    if (!globalThis.WORKSPACE_STATE) {
      globalThis.MME_FIXTURE._activationState = 'inactive';
      globalThis.MME_FIXTURE._activationPromise = null;
      globalThis.MME_APP?.log?.('[fixture] activation blocked: WORKSPACE_STATE not ready', 'error');
      return false;
    }

    const state = globalThis.WORKSPACE_STATE;

    if (!state.files || !Array.isArray(state.files.notes) || !state.folders) {
      globalThis.MME_FIXTURE._activationState = 'inactive';
      globalThis.MME_FIXTURE._activationPromise = null;
      globalThis.MME_APP?.log?.('[fixture] activation blocked: WORKSPACE_STATE not ready', 'error');
      return false;
    }

    renderFixtureBanner();

    // Log activation
    globalThis.MME_APP?.log?.('[fixture] activated projects-review storage=read-only-memory');

    // Populate fixture fields on the canonical state object — mutate only,
    // never assign globalThis.WORKSPACE_STATE = ...
    state.rootHandle = {
      __mmeFixture: true,
      fixture: true,
    };
    state.rootName = 'TEST FIXTURE · projects-review';
    state.folders.notes = {
      __mmeFixtureRoot: true,
      getFileHandle: () => Promise.resolve(new FixtureFileHandle('fixture-root', '')),
      getDirectoryHandle: () => Promise.resolve(new FixtureFileHandle('fixture-root', '')),
    };
    state.files.notes = fixtureRecords;
    state.activeFile = null;

    // Refresh the UI state so the sidebar/mode surfaces know a Workspace is
    // active (same owner the canonical activation transaction calls after
    // assigning WORKSPACE_STATE).
    if (typeof globalThis.updateWorkspaceUiState === 'function') {
      globalThis.updateWorkspaceUiState();
    }

    // Build the Workspace Index (reads from state.files.notes)
    if (typeof buildWorkspaceIndex === 'function') {
      await buildWorkspaceIndex();
    }

    // ACT 1C continuation — the canonical activation closure dispatches
    // mme-workspace-index-ready and refreshes every Index consumer from the
    // completed snapshot. The fixture cannot rely on a host picker, so it
    // performs the same consumer refresh here (existing owners only — no
    // manual DOM injection).
    window.dispatchEvent(new CustomEvent('mme-workspace-index-ready', {
      detail: {
        files: state.files.notes.length,
      },
    }));

    // Refresh the same UI panels that the canonical activation closure refreshes.
    globalThis.renderWorkspaceIndexSummary?.();
    globalThis.renderWorkspaceActivePanel?.();
    globalThis.renderWorkspaceTasksPanel?.();
    globalThis.renderWorkspaceTagsPanel?.();
    globalThis.updateWorkspaceJournalSidebarTitlesFromIndex?.();
    globalThis.renderWorkspaceJournalTimeline?.();
    globalThis.renderWorkspaceKnowledgePanel?.();
    globalThis.renderWorkspaceArchivePanel?.();

    globalThis.MME_APP?.log?.('[fixture] Journal context active');

    // Final active-state assertion: verify fixture root and files are present
    // in the canonical state object before marking active.
    if (
      state.rootHandle.__mmeFixture !== true ||
      state.rootName !== 'TEST FIXTURE · projects-review' ||
      state.files.notes.length !== 3
    ) {
      throw new Error('fixture split-state: canonical WORKSPACE_STATE does not match fixture records');
    }

    // Success: transition activating → active
    globalThis.MME_FIXTURE._activationState = 'active';
    return true;
  } catch (e) {
    // Failure: transition activating → inactive
    globalThis.MME_FIXTURE._activationState = 'inactive';
    globalThis.MME_FIXTURE._activationPromise = null;
    globalThis.MME_APP?.log?.(`[fixture] activation failed: ${e?.message || e}`, 'error');
    throw e;
  }
}

// =====================
// Public API (global)
// =====================

globalThis.MME_FIXTURE = {
  _activationState: 'inactive',
  _activationPromise: null,

  async maybeActivateFixture() {
    // 1. Read fixtureName
    const fixtureName = getFixtureParam();

    // 2. If no fixture parameter, return false silently
    if (!fixtureName) return false;

    // 3. If host is not exactly localhost or 127.0.0.1, log bounded refusal and return
    if (!isFixtureHostAllowed()) {
      globalThis.MME_APP?.log?.(`[fixture] refused host=${window.location.hostname}`);
      return false;
    }

    // 4. If fixtureName is not exactly projects-review, log unknown fixture name and return
    if (fixtureName !== FIXTURE_NAME) {
      globalThis.MME_APP?.log?.(`[fixture] refused fixture=${fixtureName} unknown fixture name`);
      return false;
    }

    // 5. Handle active/activating lifecycle
    if (this._activationState === 'active') return true;
    if (this._activationState === 'activating') {
      return this._activationPromise;
    }

    // 6. Start one activation Promise
    this._activationPromise = activateFixtureWorkspace();
    return this._activationPromise;
  },

  isFixtureWorkspace(state) {
    if (!state || !state.rootHandle) return false;
    return Boolean(state.rootHandle.__mmeFixture === true);
  },

  guardPhysicalOperation() {
    const state = globalThis.WORKSPACE_STATE;
    if (this.isFixtureWorkspace(state)) {
      globalThis.MME_APP?.log?.('[fixture] physical operations are unavailable in fixture mode');
      console.warn('TEST FIXTURE is read-only. Physical file operations are unavailable.');
      return false;
    }
    return true;
  },
};

console.log('[fixture] loader ready');

// Fixture bootstrap: register mme-main-ready listener and immediately
// check the durable ready flag so both startup orders activate the fixture.
// Path A: event fires → listener calls activation.
// Path B: flag already true → immediate activation.
function requestFixtureActivation() {
  // Only activate when both main.js and canonical Workspace state are ready.
  if (globalThis.MME_MAIN_READY !== true || globalThis.MME_WORKSPACE_STATE_READY !== true) {
    return;
  }
  Promise.resolve(
    globalThis.MME_FIXTURE?.maybeActivateFixture?.()
  ).catch((error) => {
    console.error('[fixture] activation failed:', error);
    if (globalThis.MME_APP?.log) {
      globalThis.MME_APP.log('[fixture] activation failed: ' + (error?.message || String(error)), 'error');
    }
  });
}

window.addEventListener(
  'mme-main-ready',
  requestFixtureActivation,
  { once: true }
);

if (globalThis.MME_MAIN_READY === true) {
  requestFixtureActivation();
}

window.addEventListener(
  'mme-workspace-state-ready',
  requestFixtureActivation,
  { once: true }
);

if (globalThis.MME_WORKSPACE_STATE_READY === true) {
  requestFixtureActivation();
}
