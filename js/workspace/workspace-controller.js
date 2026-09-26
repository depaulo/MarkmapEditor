// @ts-nocheck

import { WORKSPACE_STATE, isWorkspaceReady } from './workspace-state.js';
import { createWorkspaceActions } from './workspace-actions.js';
import { clearSidebar, renderSidebarFiles, renderNavigationControls, updateNavigationControls } from './workspace-sidebar.js';
import {
  openWorkspaceDirectory,
  ensureSubfolder,
  openWorkspaceCandidate,
  detectWorkspaceFormat,
  classifyWorkspaceEntries,
  classifyWorkspaceReadError,
  createNotesDirectory,
  WORKSPACE_FORMAT,
  NOTES_DIRECTORY_NAME,
} from './workspace-open.js';
import { scanFolder, scanNotesFolder } from './workspace-scanner.js';

globalThis.WORKSPACE_STATE = WORKSPACE_STATE;
window.WORKSPACE_STATE = WORKSPACE_STATE;

async function refreshWorkspaceSidebar() {
  if (!WORKSPACE_STATE.folders.journals || !WORKSPACE_STATE.folders.concepts) {
    clearSidebar();
    return;
  }

  WORKSPACE_STATE.files.journals = (await scanFolder(WORKSPACE_STATE.folders.journals))
    .map((handle) => ({
      name: handle.name,
      path: `journals/${handle.name}`,
      kind: 'journals',
      handle,
    }))
    .sort((a, b) => b.name.localeCompare(a.name));

  WORKSPACE_STATE.files.concepts = (await scanFolder(WORKSPACE_STATE.folders.concepts))
    .map((handle) => ({
      name: handle.name,
      path: `concepts/${handle.name}`,
      kind: 'concepts',
      handle,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  log?.(
    `Workspace: sidebar scan journals=${WORKSPACE_STATE.files.journals.length} concepts=${WORKSPACE_STATE.files.concepts.length}`
  );

  renderSidebarFiles(WORKSPACE_STATE.files.journals, 'workspaceJournalsList', 'journals');
  renderSidebarFiles(WORKSPACE_STATE.files.concepts, 'workspaceConceptsList', 'concepts');
  renderWorkspaceJournalTimeline?.();

  // Update collapsible panel count badges
  const journalsBadge = document.getElementById('workspaceJournalsBadge');
  const conceptsBadge = document.getElementById('workspaceConceptsBadge');

  if (journalsBadge) {
    journalsBadge.textContent = String(WORKSPACE_STATE.files.journals.length);
  }

  if (conceptsBadge) {
    conceptsBadge.textContent = String(WORKSPACE_STATE.files.concepts.length);
  }

  // Apply persisted collapsed state to Journals/Concepts panels
  const journalsPanel = document.getElementById('workspaceJournalsPanel');
  const conceptsPanel = document.getElementById('workspaceConceptsPanel');

  if (journalsPanel && typeof window.isWorkspacePanelCollapsed === 'function') {
    const collapsed = window.isWorkspacePanelCollapsed('journals');
    journalsPanel.classList.toggle('workspacePanelCollapsed', collapsed);
    const btn = journalsPanel.querySelector('[data-workspace-panel-toggle]');
    if (btn) btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }

  if (conceptsPanel && typeof window.isWorkspacePanelCollapsed === 'function') {
    const collapsed = window.isWorkspacePanelCollapsed('concepts');
    conceptsPanel.classList.toggle('workspacePanelCollapsed', collapsed);
    const btn = conceptsPanel.querySelector('[data-workspace-panel-toggle]');
    if (btn) btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }

  window.updateWorkspaceActiveFileHighlight?.();
  window.scheduleWorkspaceIndexRebuild?.('sidebar refreshed');
}

function updateWorkspaceUiState() {
  const hasWorkspace = Boolean(WORKSPACE_STATE.rootHandle);

  document.documentElement.classList.toggle('workspace-ready', hasWorkspace);
  document.documentElement.classList.toggle('workspace-empty', !hasWorkspace);

  const btnToday = document.getElementById('btnJournalToday');
  if (btnToday) {
    btnToday.disabled = !hasWorkspace;
    btnToday.title = hasWorkspace ? 'Open today journal' : 'Open a workspace first';
  }

  const btnArchiveActive = document.getElementById('btnArchiveActive');
  if (btnArchiveActive) {
    btnArchiveActive.disabled = !hasWorkspace || !WORKSPACE_STATE.activeFile;
  }

  const title = document.getElementById('workspaceTitle');
  if (title) {
    title.textContent = hasWorkspace
      ? WORKSPACE_STATE.rootName || 'Workspace'
      : 'Journal Workspace';
  }
}

function getLastActiveWorkspacePath() {
  // 1. Try the new session-aware key first.
  const newKey = getLastActiveFileKey();
  let value = getLocalStorageValue(newKey, '').trim();
  if (value) return value;

  // 2. Fall back to the legacy key.
  value = getLocalStorageValue(WORKSPACE_UI_STORAGE_KEYS.lastActivePathLegacy, '').trim();
  return value;
}

function findWorkspaceFileByPath(path, preferredKind = '') {
  const target = String(path || '').trim();

  if (!target) return null;

  const journals = WORKSPACE_STATE.files?.journals || [];
  const concepts = WORKSPACE_STATE.files?.concepts || [];

  const kind = String(preferredKind || '').trim().toLowerCase();

  if (kind) {
    const pool = kind === 'journals' ? journals : kind === 'concepts' ? concepts : [];
    const match = pool.find((file) => file.path === target);
    if (match) return match;
  }

  return (
    journals.find((file) => file.path === target) ||
    concepts.find((file) => file.path === target) ||
    null
  );
}

async function reopenLastActiveWorkspaceFileIfPossible() {
  const lastPath = getLastActiveWorkspacePath();

  if (!lastPath) {
    globalThis.MME_APP?.log?.('Workspace: no last active file to reopen');
    return false;
  }

  const file = findWorkspaceFileByPath(lastPath);

  if (!file || !file.handle) {
    globalThis.MME_APP?.log?.(`Workspace: last active file not found: ${lastPath}`);
    return false;
  }

  try {
    const blob = await file.handle.getFile();
    const text = await blob.text();

    WORKSPACE_STATE.activeFile = {
      kind: file.kind,
      name: file.name,
      path: file.path,
      handle: file.handle,
    };

    globalThis.MME_APP.openTextDocument({
      text,
      fileName: file.name,
      fileHandle: file.handle,
      reason: `workspace reopen last active file: ${file.path}`,
    });

    window.updateWorkspaceActiveFileHighlight?.();
    renderWorkspaceActivePanel?.();
    renderWorkspaceRelatedPanel?.();

    globalThis.MME_APP?.showToast?.(`Reopened ${file.name}`, 'ok', 1600);
    globalThis.MME_APP?.log?.(`Workspace: reopened last active file ${file.path}`);

    return true;
  } catch (e) {
    globalThis.MME_APP?.log?.(`Workspace: failed to reopen last active file: ${e?.message || e}`);
    return false;
  }
}

// ACT 1A/1B — transient user-facing report per rejected or failed detection
// outcome. No persistent state, no error surface for a user cancel. The
// actionable ACT 1B statuses (empty, uninitialized, valid-notes) intentionally
// have no entry here: they report through the initialization/activation
// boundary below, which must never present a rejected-workspace error for a
// folder the user is allowed to initialize.
const WORKSPACE_DETECTION_REPORTS = {
  [WORKSPACE_FORMAT.REJECTED_LEGACY]: {
    type: 'error',
    ms: 4200,
    text: 'Legacy workspace rejected — no compatibility mode and nothing was changed.',
  },
  [WORKSPACE_FORMAT.REJECTED_MIXED]: {
    type: 'error',
    ms: 4200,
    text: `Mixed workspace rejected (${NOTES_DIRECTORY_NAME}/ together with legacy folders) — nothing was changed.`,
  },
  [WORKSPACE_FORMAT.REJECTED_INVALID_NOTES_ENTRY]: {
    type: 'error',
    ms: 4200,
    text: `Cannot open: "${NOTES_DIRECTORY_NAME}" exists but is a file, not a folder — nothing was changed.`,
  },
  [WORKSPACE_FORMAT.PERMISSION_FAILURE]: {
    type: 'error',
    ms: 4200,
    text: 'Workspace unavailable — the current workspace is unchanged.',
  },
};

function describeWorkspaceDetection(detection) {
  const parts = [];

  if (Array.isArray(detection?.legacyDirectories) && detection.legacyDirectories.length) {
    parts.push(`found ${detection.legacyDirectories.map((name) => `${name}/`).join(' ')}`);
  }

  if (detection?.caseVariantNotesEntry) {
    parts.push(
      `entry "${detection.caseVariantNotesEntry}" is not the exact lowercase "${NOTES_DIRECTORY_NAME}"`
    );
  }

  if (detection?.reason === 'picker' && detection?.error?.message) {
    parts.push(detection.error.message);
  } else if (detection?.error?.message) {
    parts.push(`read ${detection.reason || 'failed'}: ${detection.error.message}`);
  }

  return parts.length ? ` (${parts.join('; ')})` : '';
}

function reportWorkspaceDetection(detection) {
  const status = detection?.status || '';

  if (status === WORKSPACE_FORMAT.CANCELED) {
    globalThis.MME_APP?.log?.(
      `Workspace: detection status=${WORKSPACE_FORMAT.CANCELED} (open cancelled by user; current workspace preserved)`
    );
    return;
  }

  const detail = describeWorkspaceDetection(detection);

  globalThis.MME_APP?.log?.(`Workspace: detection status=${status}${detail}`);

  const report = WORKSPACE_DETECTION_REPORTS[status];

  // Actionable ACT 1B statuses (empty / uninitialized / valid-notes) are not
  // rejections and carry no report entry: they continue into the
  // confirmation/activation boundary instead of surfacing an error message.
  if (!report) return;

  globalThis.MME_APP?.showToast?.(`${report.text}${detail}`, report.type, report.ms);
}

// ============================================================
// ACT 1B — explicit initialization + transactional storage activation
// ============================================================
//
// A picked folder becomes storage-active in four steps, and no WORKSPACE_STATE
// field is assigned before every fallible step has succeeded:
//
//   1. detection (ACT 1A, read-only) classifies the picked folder;
//   2. `empty` / `uninitialized` require an explicit user confirmation, and
//      only then is exactly one directory created: `notes/`;
//   3. `notes/` is scanned into a local record array and the complete next-state
//      snapshot is validated locally;
//   4. the validated snapshot is applied at one controlled boundary, field by
//      field, so existing consumers keep WORKSPACE_STATE's object identity.
//
// Every outcome that fails before step 4 (rejected format, declined
// confirmation, permission failure, creation failure, scan failure) leaves the
// currently active Workspace, the editor buffer, currentSaveHandle, navigation
// history and the Sidebar untouched. ACT 1C appends one Index build AFTER the
// activation boundary; neither ACT 1B nor ACT 1C clears navigation history or
// reopens a last active Note (both are deferred to the consumer ACTs).

// E1 — empty folder / E2 — folder with unrelated content. These are the
// confirmation texts required by the ACT 1B contract, and the only place where
// the user is asked to authorize a filesystem mutation.
const WORKSPACE_INITIALIZATION_PROMPTS = {
  [WORKSPACE_FORMAT.EMPTY]:
    'Initialize a new MarkmapEditor Workspace here?\n\n' +
    `A ${NOTES_DIRECTORY_NAME}/ folder will be created.\n` +
    'No other folders will be created.',
  [WORKSPACE_FORMAT.UNINITIALIZED]:
    'This folder is not yet a MarkmapEditor Workspace.\n\n' +
    `Initialize it by creating ${NOTES_DIRECTORY_NAME}/?\n\n` +
    'Existing files and folders will remain untouched.',
};

// ACT 1B presents the storage as opened, never as fully ready: the Workspace
// Index, the Sidebar and every consumer still belong to the next package.
const WORKSPACE_STORAGE_ACTIVATED_MESSAGE =
  `Workspace ${NOTES_DIRECTORY_NAME}/ storage opened. Index activation follows in the next package.`;

// ACT 1C — reported only after the Index build completed successfully at the
// activation boundary. Temporary neutral message (removal: ACT 2C, once the
// existing consumers are adapted and a product-complete message exists).
const WORKSPACE_INDEX_READY_MESSAGE =
  'Workspace notes/ index ready. Existing feature adaptation continues in the next package.';

const WORKSPACE_INITIALIZATION_DECLINED_MESSAGE =
  'Initialization cancelled — nothing was changed.';

const WORKSPACE_STORAGE_FAILURE_LABELS = {
  permission: 'permission denied',
  aborted: 'read aborted',
  iteration: 'folder read failed',
  'missing-root-handle': 'selected folder unavailable',
  'missing-notes-handle': `${NOTES_DIRECTORY_NAME}/ folder unavailable`,
  'invalid-notes-records': `${NOTES_DIRECTORY_NAME}/ listing invalid`,
  'invalid-note-record': `${NOTES_DIRECTORY_NAME}/ entry invalid`,
};

function buildWorkspaceInitializationPrompt(detection) {
  const base =
    WORKSPACE_INITIALIZATION_PROMPTS[detection?.status] ||
    WORKSPACE_INITIALIZATION_PROMPTS[WORKSPACE_FORMAT.EMPTY];

  const caseVariant = String(detection?.caseVariantNotesEntry || '');

  if (!caseVariant) return base;

  return (
    `${base}\n\nNote: "${caseVariant}" exists with different capitalisation; ` +
    `MarkmapEditor uses exactly "${NOTES_DIRECTORY_NAME}".`
  );
}

// Blocking user confirmation through the existing codebase convention (the
// Archive action uses the same call). An unavailable or throwing confirmation
// is treated as a decline, so no mutation can happen without an explicit yes.
function confirmWorkspaceInitialization(detection) {
  const ask = typeof globalThis.confirm === 'function' ? globalThis.confirm : null;

  if (!ask) {
    globalThis.MME_APP?.log?.(
      'Workspace: initialization confirmation unavailable — nothing was created'
    );
    return false;
  }

  const message = buildWorkspaceInitializationPrompt(detection);

  try {
    return ask(message) === true;
  } catch (error) {
    globalThis.MME_APP?.log?.(
      `Workspace: initialization confirmation failed: ${error?.message || error}`
    );
    return false;
  }
}


// Local, fallible-free validation of the assembled snapshot. It runs before any
// assignment, so an incomplete transaction can never become visible state.
function validateNotesWorkspaceSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return 'missing-root-handle';

  if (!snapshot.rootHandle || typeof snapshot.rootHandle !== 'object') {
    return 'missing-root-handle';
  }

  if (!snapshot.notesHandle || typeof snapshot.notesHandle !== 'object') {
    return 'missing-notes-handle';
  }

  if (!Array.isArray(snapshot.notesRecords)) return 'invalid-notes-records';

  const invalid = snapshot.notesRecords.some(
    (record) =>
      !record ||
      typeof record !== 'object' ||
      record.kind !== 'notes' ||
      typeof record.path !== 'string' ||
      !record.handle
  );

  return invalid ? 'invalid-note-record' : '';
}

function buildNotesWorkspaceSnapshot({ rootHandle, notesHandle, notesRecords }) {
  return {
    rootHandle,
    rootName: String(rootHandle?.name || '') || 'Workspace',
    notesHandle,
    notesRecords: Array.isArray(notesRecords) ? notesRecords.slice() : [],
    activeFile: null,
  };
}

// All fallible work: obtain (or create once) the notes/ handle, then scan it.
// Returns a plain result object; WORKSPACE_STATE is never touched here.
async function prepareNotesWorkspaceStorage(detection) {
  const rootHandle = detection?.root || null;
  let notesHandle = detection?.notesHandle || null;
  let notesCreated = false;

  if (!rootHandle || typeof rootHandle.getDirectoryHandle !== 'function') {
    return { ok: false, reason: 'missing-root-handle', notesCreated, error: null };
  }

  try {
    if (!notesHandle) {
      // The only filesystem mutation authorized in ACT 1B, and it happens only
      // for a confirmed empty/uninitialized folder. An existing notes/
      // directory is reused from detection and never re-created.
      notesHandle = await createNotesDirectory(rootHandle);
      notesCreated = true;
    }

    const notesRecords = await scanNotesFolder(notesHandle);

    const snapshot = buildNotesWorkspaceSnapshot({ rootHandle, notesHandle, notesRecords });
    const invalid = validateNotesWorkspaceSnapshot(snapshot);

    if (invalid) {
      return { ok: false, reason: invalid, notesCreated, error: null };
    }

    return { ok: true, reason: '', notesCreated, snapshot, error: null };
  } catch (error) {
    return {
      ok: false,
      reason: classifyWorkspaceReadError(error),
      notesCreated,
      error,
    };
  }
}


// The single controlled activation boundary. Runs only after the snapshot was
// fully assembled and validated.
function activateWorkspaceStorage(snapshot) {
  WORKSPACE_STATE.rootHandle = snapshot.rootHandle;
  WORKSPACE_STATE.rootName = snapshot.rootName;
  WORKSPACE_STATE.folders.notes = snapshot.notesHandle;
  WORKSPACE_STATE.files.notes = snapshot.notesRecords;
  WORKSPACE_STATE.activeFile = snapshot.activeFile;

  updateWorkspaceUiState();
}

function reportWorkspaceInitializationDeclined(detection) {
  globalThis.MME_APP?.log?.(
    `Workspace: initialization declined status=${detection?.status} — current workspace preserved`
  );

  globalThis.MME_APP?.showToast?.(WORKSPACE_INITIALIZATION_DECLINED_MESSAGE, 'warn', 2600);
}

function reportWorkspaceStorageFailure(result) {
  const label = WORKSPACE_STORAGE_FAILURE_LABELS[result?.reason] || 'storage error';

  const created = result?.notesCreated
    ? ` Note: a ${NOTES_DIRECTORY_NAME}/ folder was created in the selected folder; no workspace state changed.`
    : '';

  globalThis.MME_APP?.showToast?.(
    `Workspace ${NOTES_DIRECTORY_NAME}/ storage failed (${label}). The current workspace is unchanged.${created}`,
    'error',
    4600
  );

  globalThis.MME_APP?.log?.(
    `Workspace: storage activation failed reason=${result?.reason} notesCreated=${Boolean(
      result?.notesCreated
    )} error=${result?.error?.message || '(none)'}`
  );
}

function reportWorkspaceStorageActivated(snapshot, notesCreated, indexReady) {
  // Honest report: the index-ready text is only shown when the Index build
  // actually completed; otherwise the ACT 1B storage-only text stands and the
  // failure detail goes to the log.
  const message = indexReady ? WORKSPACE_INDEX_READY_MESSAGE : WORKSPACE_STORAGE_ACTIVATED_MESSAGE;

  globalThis.MME_APP?.showToast?.(message, 'warn', 4200);

  globalThis.MME_APP?.log?.(
    `Workspace: ${NOTES_DIRECTORY_NAME}/ storage activated root=${snapshot.rootName} notes=${
      snapshot.notesRecords.length
    } created=${Boolean(notesCreated)} index=${indexReady ? 'ready' : 'deferred'}`
  );
}

// ACT 1C — the narrowest safe wiring into the existing Index lifecycle: one
// direct buildWorkspaceIndex() call, made only AFTER activateWorkspaceStorage()
// has completed, so the builder always sees a fully assigned storage state.
// A missing builder or a failing build is reported honestly and never blocks
// or rolls back the already-completed storage activation.
async function buildActivatedWorkspaceIndex() {
  const build = globalThis.buildWorkspaceIndex;

  if (typeof build !== 'function') {
    globalThis.MME_APP?.log?.(
      'Workspace: index build unavailable after storage activation (buildWorkspaceIndex not exposed)'
    );
    return false;
  }

  try {
    await build();
    return true;
  } catch (error) {
    globalThis.MME_APP?.log?.(
      `Workspace: index build failed after storage activation: ${error?.message || error}`
    );
    return false;
  }
}


async function openWorkspace() {
  if (globalThis.MME_NAVIGATION?.isNavigationInProgress?.()) {
    globalThis.MME_APP?.showToast?.('Navigation in progress. Try again shortly.', 'warn', 2000);
    return;
  }

  // ACT 1A — strict read-only Workspace format gate. Detection runs BEFORE any
  // WORKSPACE_STATE replacement or filesystem mutation.
  const detection = await openWorkspaceCandidate();

  // `openWorkspaceCandidate()` always resolves to a detection result object.
  const status = detection.status || '';

  // Uniform outcome log. Rejected and failed formats surface their ACT 1A
  // message and return here with the currently active Workspace (rootHandle,
  // rootName, folders, files, activeFile), navigation history, editor buffer,
  // currentSaveHandle and Sidebar untouched.
  reportWorkspaceDetection(detection);

  if (
    status !== WORKSPACE_FORMAT.VALID_NOTES &&
    status !== WORKSPACE_FORMAT.EMPTY &&
    status !== WORKSPACE_FORMAT.UNINITIALIZED
  ) {
    return;
  }

  // ACT 1B — an empty or uninitialized folder may only be mutated after an
  // explicit confirmation. Declining is a normalized cancel: zero writes, and
  // the active Workspace, editor and save handle stay as they are.
  if (status !== WORKSPACE_FORMAT.VALID_NOTES && !confirmWorkspaceInitialization(detection)) {
    reportWorkspaceInitializationDeclined(detection);
    return;
  }

  // Every fallible step (creating notes/, scanning notes/) happens before the
  // activation boundary. A failure here leaves no partial state behind.
  const storage = await prepareNotesWorkspaceStorage(detection);

  if (!storage.ok) {
    reportWorkspaceStorageFailure(storage);
    return;
  }

  activateWorkspaceStorage(storage.snapshot);

  // ACT 1C — storage state is complete; build the Workspace Index once at
  // this boundary (existing lifecycle owner, direct call, no rescan), then
  // report storage and Index readiness honestly. Navigation history and the
  // last active Note are still deliberately untouched.
  const indexReady = await buildActivatedWorkspaceIndex();

  reportWorkspaceStorageActivated(storage.snapshot, storage.notesCreated, indexReady);
}

// DEAD LEGACY CODE — not called by any path since ACT 1A, and still not called
// by ACT 1B. It creates the retired journals/ concepts/ assets/ archive/ and
// system/ folders, scans the legacy Journals/Concepts lists, clears navigation
// history and reopens a legacy lastActivePath — none of which the notes/
// storage model allows. ACT 1B implements only the storage-state activation
// portion of this sequence (prepareNotesWorkspaceStorage / activateWorkspaceStorage
// above) and deliberately leaves this sequence uncalled.
// Removal ACT: the legacy Workspace UI/Index cleanup (ACT 1C and the consumer
// adaptation that follows it), where refreshWorkspaceSidebar(), scanFolder(),
// ensureSubfolder() and the legacy Sidebar markup are removed together.
async function activateWorkspaceAtExistingBoundary(root) {
  WORKSPACE_STATE.rootHandle = root;
  WORKSPACE_STATE.rootName = root.name || 'Workspace';

  WORKSPACE_STATE.folders.journals = await ensureSubfolder(root, 'journals');
  WORKSPACE_STATE.folders.concepts = await ensureSubfolder(root, 'concepts');
  WORKSPACE_STATE.folders.assets = await ensureSubfolder(root, 'assets');
  WORKSPACE_STATE.folders.archive = await ensureSubfolder(root, 'archive');
  WORKSPACE_STATE.folders.system = await ensureSubfolder(root, 'system');

  updateWorkspaceUiState();
  await refreshWorkspaceSidebar();

  globalThis.MME_NAVIGATION?.clear?.();

  await reopenLastActiveWorkspaceFileIfPossible();

  const lastActive = WORKSPACE_STATE.activeFile;
  if (lastActive?.path) {
    globalThis.MME_NAVIGATION?.seed?.({
      type: 'workspace-file',
      path: lastActive.path,
      kind: lastActive.kind || '',
      name: lastActive.name || '',
      source: 'workspace startup',
    });
  }

  try {
    restoreWorkspaceSidebarWidth?.();
    wireWorkspaceSidebarResize?.();
    ensureWorkspaceSearchPanel?.();
    wireWorkspaceSearch?.();
    ensureWorkspaceRelatedPanel?.();
    wireWorkspaceRelatedPanel?.();
    renderWorkspaceRelatedPanel?.();
  } catch (e) {
    globalThis.MME_APP?.log?.(
      `Workspace: sidebar resize restore/wire failed after openWorkspace: ${e?.message || e}`
    );
  }

  globalThis.MME_APP?.showToast?.(`Workspace opened ✓ ${WORKSPACE_STATE.rootName}`, 'ok');
  globalThis.MME_APP?.log?.(`Workspace opened: ${WORKSPACE_STATE.rootName}`);
}

function persistActiveWorkspaceFile() {
  const active = WORKSPACE_STATE.activeFile;

  if (!active || !active.path) {
    removeLocalStorageValue(getLastActiveFileKey());
    return;
  }

  // Write only to the new session-aware key.
  setLocalStorageValue(getLastActiveFileKey(), active.path);

  globalThis.MME_APP?.log?.(`Workspace: persisted active file ${active.path}`);
}

globalThis.persistActiveWorkspaceFile = persistActiveWorkspaceFile;
globalThis.refreshWorkspaceSidebar = refreshWorkspaceSidebar;

function normalizeWorkspaceKindForCompare(value) {
  // ACT 2A — 'notes' is the canonical Workspace kind; shared by
  // findWorkspaceFileByPath / openWorkspaceFile / search / tags / related.
  const kind = String(value || '')
    .trim()
    .toLowerCase();

  if (kind === 'note') return 'notes';
  if (kind === 'notes') return 'notes';

  if (kind === 'journal') return 'journals';
  if (kind === 'journals') return 'journals';

  if (kind === 'concept') return 'concepts';
  if (kind === 'concepts') return 'concepts';

  return kind;
}

try {
  globalThis.normalizeWorkspaceKindForCompare = normalizeWorkspaceKindForCompare;
} catch {}

function buildArchiveFileName(activeFile) {
  const name = String(activeFile?.name || 'archived.md').trim();
  const kind = normalizeWorkspaceKindForCompare
    ? normalizeWorkspaceKindForCompare(activeFile?.kind || 'workspace')
    : String(activeFile?.kind || 'workspace').trim();
  const stamp = new Date().toISOString().slice(0, 10);

  return `${stamp}-${kind}-${name}`;
}

async function readActiveWorkspaceFileText() {
  const active = WORKSPACE_STATE.activeFile;

  if (!active || !active.handle) {
    throw new Error('No active workspace file');
  }

  const file = await active.handle.getFile();
  return await file.text();
}

async function removeArchivedOriginalFile(activeFile) {
  if (!activeFile || !activeFile.kind || !activeFile.name) {
    return false;
  }

  const folder = WORKSPACE_STATE.folders?.[activeFile.kind];

  if (!folder || typeof folder.removeEntry !== 'function') {
    globalThis.MME_APP?.log?.(
      'Workspace: removeEntry unavailable; archive copy created but original not removed'
    );
    return false;
  }

  await folder.removeEntry(activeFile.name);

  return true;
}

function clearActiveWorkspaceFileAfterArchive() {
  WORKSPACE_STATE.activeFile = null;

  if (typeof globalThis.MME_APP?.setWritableHandleForCurrentFile === 'function') {
    globalThis.MME_APP.setWritableHandleForCurrentFile(null);
  }

  if (typeof currentSaveHandle !== 'undefined') {
    currentSaveHandle = null;
  }

  if (
    typeof removeLocalStorageValue === 'function' &&
    typeof WORKSPACE_UI_STORAGE_KEYS !== 'undefined'
  ) {
    removeLocalStorageValue(WORKSPACE_UI_STORAGE_KEYS.lastActivePath);
  }

  window.updateWorkspaceActiveFileHighlight?.();
}

async function openToday() {
  if (globalThis.MME_NAVIGATION?.isNavigationInProgress?.()) {
    globalThis.MME_APP?.log?.('Workspace: Today blocked by active navigation');
    return;
  }

  // ACT G2B: Before Today replaces editor content, run the Report leave
  // decision. Cancel does nothing. Save or Discard proceeds once.
  if (typeof globalThis.guardUnsavedReportBeforeDocumentSwitch === 'function') {
    const guard = await globalThis.guardUnsavedReportBeforeDocumentSwitch();
    if (!guard || guard.ok !== true) {
      globalThis.MME_APP?.log?.('Workspace: Today blocked by Report guard');
      return;
    }
  }

  if (!WORKSPACE_STATE.rootHandle) {
    globalThis.MME_APP?.showToast?.('Open a workspace first', 'error', 3000);
    return;
  }

  // ACT 2C — the ACT 1B Today gate is removed: Today is a lifecycle/output
  // consumer and is now fully adapted to `notes/`. It creates/opens exactly
  // `notes/YYYY-MM-DD.md` and never duplicates or overwrites: getFileHandle()
  // with create:true reuses an existing file, and the starter body is written
  // only when the existing content is empty.
  const notesFolder = WORKSPACE_STATE.folders?.notes;
  if (!notesFolder) {
    globalThis.MME_APP?.showToast?.(
      `Today needs an open ${NOTES_DIRECTORY_NAME}/ storage.`,
      'warn',
      3000
    );
    globalThis.MME_APP?.log?.(
      `Workspace: Today unavailable — no ${NOTES_DIRECTORY_NAME}/ directory handle`
    );
    return;
  }

  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const fileName = `${yyyy}-${mm}-${dd}.md`;

  const fileHandle = await notesFolder.getFileHandle(fileName, {
    create: true,
  });

  let file = await fileHandle.getFile();
  let text = await file.text();

  const dateString = `${yyyy}-${mm}-${dd}`;

  if (!String(text || '').trim()) {
    // ACT 2C — the legacy `type: journal` frontmatter key belonged to the
    // retired kind split and is not written. No new metadata writer is added.
    text = `# ${dateString}

## Notes

## Tasks

## Projects
`;


    const writable = await fileHandle.createWritable();
    await writable.write(text);
    await writable.close();

    globalThis.MME_APP?.log?.(
      `Workspace: initialized Today journal with Daily Capture starter ${fileName}`
    );
  }

  if (!globalThis.MME_APP?.confirmDiscardIfDirty?.()) return;

  globalThis.MME_APP.openTextDocument({
    text,
    fileName,
    fileHandle,
    reason: 'workspace today',
  });

  // ACT G2B: Clear Report identity at the safe target-activation boundary.
  globalThis.clearReportIdentityAfterTransition?.();

  // ACT 2C — Today opens a real `notes/` Note: identity is the physical
  // notes/YYYY-MM-DD.md path, and `notes` is the only canonical kind.
  WORKSPACE_STATE.activeFile = {
    kind: 'notes',
    name: fileName,
    path: `${NOTES_DIRECTORY_NAME}/${fileName}`,
    handle: fileHandle,
  };

  persistActiveWorkspaceFile();
  await refreshWorkspaceSidebar();
  window.updateWorkspaceActiveFileHighlight?.();
  renderWorkspaceActivePanel?.();
  renderWorkspaceRelatedPanel?.();
  renderWorkspaceTasksPanel?.();
  window.scheduleWorkspaceIndexRebuild?.('today');
  // Record successful navigation for Today.
  if (typeof globalThis.MME_NAVIGATION === 'object') {
    globalThis.MME_NAVIGATION.recordSuccessfulNavigation({
      type: 'workspace-file',
      path: `${NOTES_DIRECTORY_NAME}/${fileName}`,
      kind: 'notes',
      name: fileName,
      source: 'workspace today',
    });
  }

  globalThis.MME_APP?.showToast?.(`Today opened ✓ ${fileName}`, 'ok');
  globalThis.MME_APP?.log?.(`Today opened: ${fileName}`);
}

async function openWorkspaceFile(fileRecord) {
  if (!fileRecord?.handle) return;

  if (!globalThis.MME_APP?.confirmDiscardIfDirty?.()) return;

  const file = await fileRecord.handle.getFile();
  const text = await file.text();

  globalThis.MME_APP.openTextDocument({
    text,
    fileName: file.name,
    fileHandle: fileRecord.handle,
    reason: 'workspace open file',
  });

  WORKSPACE_STATE.activeFile = {
    // ACT 2C — 'notes' is the only canonical Workspace kind; the 'journals'
    // fallback belonged to the retired kind split.
    kind: fileRecord.kind || 'notes',
    name: fileRecord.name,
    path: fileRecord.path,
    handle: fileRecord.handle,
  };

  persistActiveWorkspaceFile();
  window.updateWorkspaceActiveFileHighlight?.();
  renderWorkspaceActivePanel?.();
  renderWorkspaceRelatedPanel?.();
  window.scheduleWorkspaceIndexRebuild?.('workspace file opened');
  globalThis.MME_APP?.showToast?.(`Opened ✓ ${file.name}`, 'ok');
}

function handleSidebarClick(event) {
  const item = event.target.closest('.workspaceFileItem');
  if (!item) return;

  const path = item.dataset.path || '';
  const kind = item.dataset.kind || '';
  // Legacy Journals/Concepts lists. ACT 1B removed those state fields, so the
  // read is optional-chained: a stale legacy sidebar item must not throw here.
  const allFiles = [
    ...(WORKSPACE_STATE.files?.journals || []),
    ...(WORKSPACE_STATE.files?.concepts || []),
  ];

  const fileRecord = allFiles.find((file) => file.path === path);
  if (!fileRecord) {
    globalThis.MME_APP?.log?.(`Workspace file not found in state: ${path}`);
    return;
  }

  // Use globalThis.openWorkspaceFile (main.js) which records navigation history.
  if (typeof globalThis.openWorkspaceFile === 'function') {
    globalThis.openWorkspaceFile(fileRecord, kind || fileRecord.kind, 'workspace sidebar click').catch((e) => {
      globalThis.MME_APP?.showToast?.(`Open file failed: ${e?.message || e}`, 'error');
      globalThis.MME_APP?.log?.(`Open file failed: ${e?.message || e}`);
    });
  } else {
    // Fallback to local openWorkspaceFile if global is not available.
    openWorkspaceFile(fileRecord).catch((e) => {
      globalThis.MME_APP?.showToast?.(`Open file failed: ${e?.message || e}`, 'error');
      globalThis.MME_APP?.log?.(`Open file failed: ${e?.message || e}`);
    });
  }
}

// R-MULTI4: session-aware last active file key with legacy fallback.
function getLastActiveFileKey() {
  try {
    return globalThis.getModeSessionStorageKey?.(
      undefined, undefined, 'lastActiveFile'
    ) || 'markmap:workspace:lastActivePath';
  } catch {
    return 'markmap:workspace:lastActivePath';
  }
}
const WORKSPACE_UI_STORAGE_KEYS = {
  lastActivePath: 'markmap:workspace:lastActivePath',
  lastActivePathLegacy: 'markmap:workspace:lastActivePath',
  sidebarCollapsed: 'markmap:workspace:sidebarCollapsed',
};

const JOURNAL_SIDEBAR_COLLAPSED_KEY = 'markmap:journalSidebarCollapsed';

function getLocalStorageValue(key, fallback = '') {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function setLocalStorageValue(key, value) {
  try {
    localStorage.setItem(key, String(value ?? ''));
  } catch {
    // Ignore storage errors.
  }
}

function removeLocalStorageValue(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage errors.
  }
}

function initJournalSidebarCollapse() {
  const btn = document.getElementById('btnWorkspaceCollapse');
  if (!btn || btn.__bound) return;

  let saved = false;
  try {
    saved = localStorage.getItem(JOURNAL_SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {}

  document.documentElement.classList.toggle('journal-sidebar-collapsed', !!saved);

  const btnLabel = btn;
  if (btnLabel) {
    btnLabel.textContent = saved ? '▶' : '◀';
    btnLabel.title = saved ? 'Expand sidebar' : 'Collapse sidebar';
    btnLabel.setAttribute('aria-label', btnLabel.title);
  }

  btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    const next = !document.documentElement.classList.contains('journal-sidebar-collapsed');
    setJournalSidebarCollapsed(next);

    if (!next) {
      try {
        restoreWorkspaceSidebarWidth?.();
        wireWorkspaceSidebarResize?.();
      } catch (e) {
        globalThis.MME_APP?.log?.(
          `Workspace: sidebar resize restore/wire failed after expand: ${e?.message || e}`
        );
      }
    }
  });

  btn.__bound = true;
}

// S2 — single canonical Sidebar collapse/restore path. Shared by the local
// header button and the pane-registry sidebar adapter; keeps class, button
// label, persistence, and registry state in agreement.
function setJournalSidebarCollapsed(next) {
  document.documentElement.classList.toggle('journal-sidebar-collapsed', !!next);

  const btn2 = document.getElementById('btnWorkspaceCollapse');
  if (btn2) {
    btn2.textContent = next ? '▶' : '◀';
    btn2.title = next ? 'Expand sidebar' : 'Collapse sidebar';
    btn2.setAttribute('aria-label', btn2.title);
  }

  setLocalStorageValue(JOURNAL_SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');

  try { globalThis.MME_VIEW_LAYOUT?.refresh?.(); } catch {}
}

globalThis.setJournalSidebarCollapsed = setJournalSidebarCollapsed;

async function archiveActiveWorkspaceFile() {
  // Capability guard — block when the active workspace cannot archive.
  if (!globalThis.MME_WORKSPACE_CAPABILITIES?.canActive?.('archive')) {
    const activeId = globalThis.MME_WORKSPACE_CAPABILITIES?.getActiveId?.() || 'current workspace';
    globalThis.MME_APP?.showToast?.(`Archive is not available in ${activeId}`, 'warn', 2000);
    return;
  }

  globalThis.MME_APP?.log?.('Workspace: archiveActiveWorkspaceFile() begin');

  if (!WORKSPACE_STATE.rootHandle) {
    globalThis.MME_APP?.showToast?.('Open a workspace first', 'error', 2600);
    globalThis.MME_APP?.log?.('Workspace: Archive blocked because rootHandle is missing');
    return;
  }

  if (!WORKSPACE_STATE.folders?.archive) {
    globalThis.MME_APP?.showToast?.('Archive folder is not ready', 'error', 2600);
    globalThis.MME_APP?.log?.('Workspace: Archive blocked because archive folder is missing');
    return;
  }

  const active = WORKSPACE_STATE.activeFile;

  globalThis.MME_APP?.log?.(
    `Workspace: archive active candidate kind=${active?.kind || '(none)'} path=${
      active?.path || '(none)'
    } name=${active?.name || '(none)'} hasHandle=${Boolean(active?.handle)}`
  );

  if (!active || !active.handle || !active.kind || !active.name) {
    globalThis.MME_APP?.showToast?.('No active workspace file to archive', 'error', 2600);
    globalThis.MME_APP?.log?.('Workspace: Archive blocked because no active workspace file exists');
    return;
  }

  const activeKind = normalizeWorkspaceKindForCompare
    ? normalizeWorkspaceKindForCompare(active.kind)
    : String(active.kind || '').trim();

  const sourceFolder = WORKSPACE_STATE.folders?.[activeKind];

  globalThis.MME_APP?.log?.(
    `Workspace: archive sourceFolder kind=${activeKind} exists=${Boolean(sourceFolder)} removeEntry=${typeof sourceFolder?.removeEntry}`
  );

  const activePath = active.path || `${activeKind}/${active.name}`;

  const ok = confirm(`Archive ${activePath}?`);

  if (!ok) {
    globalThis.MME_APP?.log?.(`Workspace: archive cancelled for ${activePath}`);
    return;
  }

  const file = await active.handle.getFile();
  const text = await file.text();

  const archiveFileName = buildArchiveFileName({
    ...active,
    kind: activeKind,
  });

  globalThis.MME_APP?.log?.(`Workspace: archive target archive/${archiveFileName}`);

  const archiveHandle = await WORKSPACE_STATE.folders.archive.getFileHandle(archiveFileName, {
    create: true,
  });

  const writable = await archiveHandle.createWritable();
  await writable.write(text);
  await writable.close();

  globalThis.MME_APP?.log?.(`Workspace: archive copy written archive/${archiveFileName}`);

  let removedOriginal = false;

  try {
    if (sourceFolder && typeof sourceFolder.removeEntry === 'function') {
      await sourceFolder.removeEntry(active.name);
      removedOriginal = true;
      globalThis.MME_APP?.log?.(`Workspace: archive original removed ${activePath}`);
    } else {
      globalThis.MME_APP?.log?.('Workspace: removeEntry unavailable; original kept');
    }
  } catch (e) {
    globalThis.MME_APP?.log?.(
      `Workspace: original remove failed after archive copy: ${e?.message || e}`
    );
    removedOriginal = false;
  }

  WORKSPACE_STATE.activeFile = null;

  if (typeof currentSaveHandle !== 'undefined') {
    currentSaveHandle = null;
  }

  if (
    typeof removeLocalStorageValue === 'function' &&
    typeof WORKSPACE_UI_STORAGE_KEYS !== 'undefined'
  ) {
    removeLocalStorageValue(WORKSPACE_UI_STORAGE_KEYS.lastActivePath);
  }

  if (typeof refreshWorkspaceSidebar === 'function') {
    await refreshWorkspaceSidebar();
  }

  window.updateWorkspaceActiveFileHighlight?.();
  renderWorkspaceActivePanel?.();
  renderWorkspaceRelatedPanel?.();
  renderWorkspaceTasksPanel?.();
  window.scheduleWorkspaceIndexRebuild?.('archive active');

  globalThis.MME_APP.openTextDocument({
    text: `# Archived\n\nArchived: ${activePath}\n\nArchive copy: archive/${archiveFileName}\n`,
    fileName: 'archived.md',
    fileHandle: null,
    reason: 'workspace archive active file',
  });

  const archivedMessage = removedOriginal
    ? `Archived ${active.name}`
    : `Archive copy created: ${archiveFileName}`;

  globalThis.MME_APP?.showToast?.(archivedMessage, removedOriginal ? 'ok' : 'download', 2600);

  globalThis.MME_APP?.log?.(
    removedOriginal
      ? `Workspace: archived and removed original ${activePath} -> archive/${archiveFileName}`
      : `Workspace: archive copy created but original kept ${activePath} -> archive/${archiveFileName}`
  );

  globalThis.MME_APP?.log?.('Workspace: archiveActiveWorkspaceFile() end');
}

let __archiveActiveInProgress = false;

function bindArchiveActiveDirect() {
  const btn = document.getElementById('btnArchiveActive');

  if (!btn) {
    globalThis.MME_APP?.log?.('Workspace: Archive Active direct button not found');
    return;
  }

  if (btn.__archiveDirectBound) {
    return;
  }

  let __archiveActiveLastEvent = 0;
  const archiveActiveHandler = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    const now = performance.now();
    if (now - __archiveActiveLastEvent < 120) {
      globalThis.MME_APP?.log?.(
        `Workspace: Archive Active direct duplicate event ignored (${event.type})`
      );
      return;
    }
    __archiveActiveLastEvent = now;

    globalThis.MME_APP?.log?.(
      `Workspace: Archive Active direct ${event.type} clicked disabled=${Boolean(
        btn.disabled
      )} active=${WORKSPACE_STATE.activeFile?.path || '(none)'}`
    );

    if (__archiveActiveInProgress) {
      globalThis.MME_APP?.log?.(
        'Workspace: Archive Active ignored because archive is already in progress'
      );
      return;
    }

    try {
      __archiveActiveInProgress = true;

      if (btn.disabled) {
        globalThis.MME_APP?.log?.('Workspace: Archive Active direct forced disabled=false');
        btn.disabled = false;
      }

      if (typeof archiveActiveWorkspaceFile !== 'function') {
        throw new Error('archiveActiveWorkspaceFile missing');
      }

      await archiveActiveWorkspaceFile();
    } catch (e) {
      const msg = e?.message || String(e);
      globalThis.MME_APP?.log?.(`Workspace: Archive Active direct failed: ${msg}`);
      globalThis.MME_APP?.showToast?.(`Archive failed: ${msg}`, 'error', 3500);
    } finally {
      __archiveActiveInProgress = false;
    }
  };

  ['click', 'pointerup'].forEach((evt) => {
    btn.addEventListener(evt, archiveActiveHandler, {
      capture: true,
      passive: false,
    });
  });

  btn.__archiveDirectBound = true;
  globalThis.MME_APP?.log?.('Workspace: Archive Active direct bound');
}

let journalInitializationState = 'not-started';
let journalInitializationCount = 0;
let journalInitializationError = null;

function initializeJournal() {
  if (journalInitializationState === 'initialized') {
    return {
      status: 'noop',
      initialized: true,
      initializationState: 'initialized',
      initializationCount: journalInitializationCount,
      error: null,
    };
  }

  if (journalInitializationState === 'initializing') {
    return {
      status: 'busy',
      initialized: false,
      initializationState: 'initializing',
      initializationCount: journalInitializationCount,
      error: null,
    };
  }

  if (journalInitializationState === 'failed') {
    return {
      status: 'failed',
      initialized: false,
      initializationState: 'failed',
      initializationCount: journalInitializationCount,
      error: journalInitializationError,
    };
  }

  // State is 'not-started'.
  journalInitializationState = 'initializing';
  journalInitializationError = null;

  try {
    initWorkspace();

    journalInitializationCount++;
    journalInitializationState = 'initialized';

    window.dispatchEvent(new CustomEvent('mme-journal-workspace-ready', {
      detail: {
        initialized: true,
        initializationState: 'initialized',
        initializationCount: journalInitializationCount,
      },
    }));

    return {
      status: 'initialized',
      initialized: true,
      initializationState: 'initialized',
      initializationCount: journalInitializationCount,
      error: null,
    };
  } catch (error) {
    journalInitializationState = 'failed';
    journalInitializationError = error;

    return {
      status: 'failed',
      initialized: false,
      initializationState: 'failed',
      initializationCount: journalInitializationCount,
      error: journalInitializationError,
    };
  }
}

function initWorkspace() {
  if (initWorkspace.__done) return;
  initWorkspace.__done = true;

  updateWorkspaceUiState();
  initJournalSidebarCollapse();

  createWorkspaceActions({
    onOpenWorkspace: openWorkspace,
    onToday: openToday,
    onNewConcept: createNewConcept,
    onArchiveActive: archiveActiveWorkspaceFile,
  });

  globalThis.MME_APP?.log?.(
    `Workspace: archive handler registered = ${typeof archiveActiveWorkspaceFile === 'function'}`
  );

  bindArchiveActiveDirect();

  clearSidebar();
  ensureWorkspaceSearchPanel?.();
  wireWorkspaceSearch?.();

  document.getElementById('workspaceJournalsList')?.addEventListener('click', handleSidebarClick);
  document.getElementById('workspaceConceptsList')?.addEventListener('click', handleSidebarClick);

  // Navigation History V1 — UI wiring.
  const controls = renderNavigationControls();
  globalThis.MME_APP?.log?.(`Workspace: navigation controls rendered = ${Boolean(controls)}`);

  const btnBack = document.getElementById('btnNavBack');
  const btnForward = document.getElementById('btnNavForward');

  if (btnBack && !btnBack.__mmeNavigationBound) {
    btnBack.addEventListener('click', async () => {
      globalThis.MME_APP?.log?.('NavigationTrace: Back clicked');

      // ACT G2B: Block Back while an unsaved Report is active. The History
      // contract cannot safely await the Report decision without modifying
      // Navigation History, so we block and show the required message.
      if (typeof globalThis.isUnsavedReportActive === 'function' && globalThis.isUnsavedReportActive()) {
        globalThis.MME_APP?.showToast?.(
          'Save or discard the current Report before navigating.',
          'warn',
          3000
        );
        globalThis.MME_APP?.log?.('NavigationTrace: Back blocked by unsaved Report');
        return;
      }

      try {
        const result = await globalThis.MME_NAVIGATION?.back?.();

        globalThis.MME_APP?.log?.(
          `NavigationTrace: Back result status=${
            result?.status || 'missing'
          }`
        );

        if (result?.error) {
          globalThis.MME_APP?.log?.(
            `NavigationTrace: Back error=${
              result.error?.message || result.error
            }`
          );
        }
      } catch (error) {
        globalThis.MME_APP?.log?.(
          `NavigationTrace: Back threw=${error?.message || error}`
        );
      }
    });

    btnBack.__mmeNavigationBound = true;
  }

  if (btnForward && !btnForward.__mmeNavigationBound) {
    btnForward.addEventListener('click', async () => {
      globalThis.MME_APP?.log?.('NavigationTrace: Forward clicked');

      // ACT G2B: Block Forward while an unsaved Report is active.
      if (typeof globalThis.isUnsavedReportActive === 'function' && globalThis.isUnsavedReportActive()) {
        globalThis.MME_APP?.showToast?.(
          'Save or discard the current Report before navigating.',
          'warn',
          3000
        );
        globalThis.MME_APP?.log?.('NavigationTrace: Forward blocked by unsaved Report');
        return;
      }

      try {
        const result = await globalThis.MME_NAVIGATION?.forward?.();

        globalThis.MME_APP?.log?.(
          `NavigationTrace: Forward result status=${
            result?.status || 'missing'
          }`
        );

        if (result?.error) {
          globalThis.MME_APP?.log?.(
            `NavigationTrace: Forward error=${
              result.error?.message || result.error
            }`
          );
        }
      } catch (error) {
        globalThis.MME_APP?.log?.(
          `NavigationTrace: Forward threw=${error?.message || error}`
        );
      }
    });

    btnForward.__mmeNavigationBound = true;
  }

  let navigationUnsubscribe = null;
  if (globalThis.MME_NAVIGATION && !navigationUnsubscribe) {
    navigationUnsubscribe = globalThis.MME_NAVIGATION.subscribe(updateNavigationControls);
  }

  // Register the authoritative opener for Back/Forward restore.
  // Host ACTIVATED and validated NOOP are both successful restore states.
  if (typeof globalThis.MME_NAVIGATION?.setOpener === 'function') {
    globalThis.MME_NAVIGATION.setOpener(async function restoreOpen(location) {
      if (!location) {
        return {
          status: 'failed',
          location,
          error: new Error('No location'),
        };
      }

      const host = globalThis.MME_WORKSPACE_HOST;

      function isSuccessfulHostSwitch(result, targetWorkspaceId) {
        return Boolean(
          host &&
            (result?.status === host.RESULT_STATUS.ACTIVATED ||
              (result?.status === host.RESULT_STATUS.NOOP &&
                host.getActiveId?.() === targetWorkspaceId))
        );
      }

      async function rollbackWorkspace(previousWorkspace, cause = null) {
        if (
          !host ||
          !previousWorkspace ||
          host.getActiveId?.() === previousWorkspace
        ) {
          return;
        }

        try {
          const rollbackResult = await host.switchTo(previousWorkspace, {
            reason: 'navigation restore rollback',
          });

          if (!isSuccessfulHostSwitch(rollbackResult, previousWorkspace)) {
            globalThis.MME_APP?.log?.(
              `Workspace: navigation rollback returned status=${
                rollbackResult?.status || 'unknown'
              } target=${previousWorkspace} cause=${
                cause?.message || cause || 'unknown'
              }`
            );
          }
        } catch (rollbackError) {
          globalThis.MME_APP?.log?.(
            `Workspace: navigation rollback failed target=${previousWorkspace}: ${
              rollbackError?.message || rollbackError
            }`
          );
        }
      }

      // Virtual Workspace Index restoration.
      if (location.type === 'virtual-workspace-index') {
        if (!host || !host.has?.('workspace-index')) {
          return {
            status: 'failed',
            location,
            error: new Error('workspace-index not registered'),
          };
        }

        try {
          const result = await host.switchTo('workspace-index', {
            reason: 'navigation restore',
          });

          if (!isSuccessfulHostSwitch(result, 'workspace-index')) {
            const error = new Error(
              `workspace-index switch failed: ${
                result?.status || 'unknown'
              }`
            );

            globalThis.MME_APP?.log?.(
              `Workspace: navigation restore failed type=virtual-workspace-index status=${
                result?.status || 'unknown'
              }`
            );

            return {
              status: 'failed',
              location,
              error,
            };
          }

          return {
            status: 'opened',
            location,
          };
        } catch (error) {
          globalThis.MME_APP?.log?.(
            `Workspace: navigation restore Workspace Index switch threw: ${
              error?.message || error
            }`
          );

          return {
            status: 'failed',
            location,
            error,
          };
        }
      }

      if (location.type !== 'workspace-file') {
        const error = new Error(
          `Unsupported navigation location type: ${
            location.type || '(missing)'
          }`
        );

        globalThis.MME_APP?.log?.(
          `Workspace: navigation restore rejected unsupported type=${
            location.type || '(missing)'
          }`
        );

        return {
          status: 'failed',
          location,
          error,
        };
      }

      // Resolve the physical file before switching workspace presentation.
      const previousWorkspace = host?.getActiveId?.() || null;

      const fileRecord = findWorkspaceFileByPath(
        location.path,
        location.kind
      );

      if (!fileRecord || !fileRecord.handle) {
        const error = new Error('Workspace file not found');

        globalThis.MME_APP?.log?.(
          `Workspace: navigation restore file not found path=${
            location.path || '(missing)'
          } kind=${location.kind || '(missing)'}`
        );

        return {
          status: 'failed',
          location,
          error,
        };
      }

      // Switch to Journal. NOOP is valid when Journal is already active.
      if (host) {
        try {
          const switchResult = await host.switchTo('journal', {
            reason: 'navigation restore',
          });

          if (!isSuccessfulHostSwitch(switchResult, 'journal')) {
            const error = new Error(
              `Journal switch failed: ${
                switchResult?.status || 'unknown'
              }`
            );

            globalThis.MME_APP?.log?.(
              `Workspace: navigation restore Journal switch failed status=${
                switchResult?.status || 'unknown'
              } path=${location.path || '(missing)'}`
            );

            await rollbackWorkspace(previousWorkspace, error);

            return {
              status: 'failed',
              location,
              error,
            };
          }
        } catch (error) {
          globalThis.MME_APP?.log?.(
            `Workspace: navigation restore Journal switch threw path=${
              location.path || '(missing)'
            }: ${error?.message || error}`
          );

          await rollbackWorkspace(previousWorkspace, error);

          return {
            status: 'failed',
            location,
            error,
          };
        }
      }

      try {
        const opened = await globalThis.openWorkspaceFile(
          fileRecord,
          fileRecord.kind || location.kind,
          'navigation restore',
          { historyMode: 'restore' }
        );

        if (!opened) {
          const error = new Error(
            'Workspace file restore was cancelled or returned no result'
          );

          globalThis.MME_APP?.log?.(
            `Workspace: navigation restore cancelled path=${
              location.path || '(missing)'
            }`
          );

          await rollbackWorkspace(previousWorkspace, error);

          return {
            status: 'cancelled',
            location,
          };
        }

        return {
          status: 'opened',
          location,
        };
      } catch (error) {
        globalThis.MME_APP?.log?.(
          `Workspace: navigation restore open failed path=${
            location.path || '(missing)'
          }: ${error?.message || error}`
        );

        await rollbackWorkspace(previousWorkspace, error);

        return {
          status: 'failed',
          location,
          error,
        };
      }
    });
  }

  globalThis.MME_APP?.log?.('Workspace: actions wired');
}

globalThis.WORKSPACE_API = {
  isWorkspaceReady,
  isJournalInitialized: () => journalInitializationState === 'initialized',
  getJournalInitializationState: () => journalInitializationState,
  getJournalInitializationCount: () => journalInitializationCount,
  initializeJournal,
  createWorkspaceActions,
  clearSidebar,
  renderSidebarFiles,
  openWorkspaceDirectory,
  ensureSubfolder,
  scanFolder,
  openWorkspaceCandidate,
  detectWorkspaceFormat,
  classifyWorkspaceEntries,
  classifyWorkspaceReadError,
  createNotesDirectory,
  scanNotesFolder,
  buildNotesWorkspaceSnapshot,
  validateNotesWorkspaceSnapshot,
  WORKSPACE_FORMAT,
  refreshWorkspaceSidebar,
  openWorkspace,
  openToday,
  initWorkspace,
};

// Dispatch API readiness event for late activation listeners.
// WORKSPACE_API is now fully assigned and initializeJournal is available.
try {
  window.dispatchEvent(
    new CustomEvent('mme-workspace-api-ready')
  );
} catch (error) {
  console.error(
    'Workspace: failed to dispatch API readiness',
    error
  );
}

globalThis.MME_APP?.log?.(
  `Workspace: stored last active file = ${getLastActiveWorkspacePath() || '(none)'}`
);

try {
  window.refreshWorkspaceSidebar = refreshWorkspaceSidebar;
  window.updateWorkspaceUiState = updateWorkspaceUiState;
  window.persistActiveWorkspaceFile = persistActiveWorkspaceFile;
  window.restoreActiveWorkspaceFile = reopenLastActiveWorkspaceFileIfPossible;

  globalThis.refreshWorkspaceSidebar = refreshWorkspaceSidebar;
  globalThis.updateWorkspaceUiState = updateWorkspaceUiState;
  globalThis.persistActiveWorkspaceFile = persistActiveWorkspaceFile;
  globalThis.restoreActiveWorkspaceFile = reopenLastActiveWorkspaceFileIfPossible;
} catch {}
