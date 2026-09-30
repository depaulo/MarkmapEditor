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

  // ACT V0 — the global "Archive Active" control no longer exists in this
  // action area, so there is nothing to keep disabled or retitled here. Archive
  // and Restore are owned exclusively by the Active panel action row
  // (renderWorkspaceActiveNoteActions in js/main.js): it reads the live buffer
  // flags, labels the action Archive/Restore, and routes through the single
  // metadata writer applyActiveNoteMetadata(). No second Archive/Restore control,
  // click lifecycle, metadata writer, automatic Save or physical archive/
  // move/copy/delete operation is introduced or re-exposed by this ACT.

  // ACT 5 — Named Note creation now exists, so the control is live and is the
  // single Named Note entry point. It still shares the existing creation row
  // with Today: no second creation system, no duplicate control.
  const btnNewConcept = document.getElementById('btnNewConcept');
  if (btnNewConcept) {
    btnNewConcept.disabled = false;
    btnNewConcept.title = 'Create a new named note';
  }

  const title = document.getElementById('workspaceTitle');
  if (title) {
    // ACT 5/6 terminology: the workspace surface is the Notes surface. The
    // "Journal Workspace" fallback was retired panel wording and is no longer
    // correct user-facing copy.
    title.textContent = hasWorkspace
      ? WORKSPACE_STATE.rootName || 'Workspace'
      : 'Notes Workspace';
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

// Resolve a Workspace file by its EXACT relative path.
//
// ACT 2C.1/4: the canonical physical collection is WORKSPACE_STATE.files.notes,
// so it is searched first. This owner is the one used by the Navigation History
// restore opener, by reopenLastActiveWorkspaceFileIfPossible() and by the Sidebar
// click owner, so a restore that could not resolve notes/... left Back/Forward
// unable to reopen any Note. The retired journals/concepts buckets remain only as
// a defensive fallback for a stale legacy record.
function findWorkspaceFileByPath(path, preferredKind = '') {
  const target = String(path || '').trim();

  if (!target) return null;

  const notes = Array.isArray(WORKSPACE_STATE.files?.notes) ? WORKSPACE_STATE.files.notes : [];
  const journals = WORKSPACE_STATE.files?.journals || [];
  const concepts = WORKSPACE_STATE.files?.concepts || [];

  const kind = String(preferredKind || '').trim().toLowerCase();

  if (kind) {
    // Preferred-kind exact match, always over the canonical notes/ collection.
    const pool = kind === 'notes' ? notes : kind === 'journals' ? journals : concepts;
    const match = pool.find((file) => file.path === target);
    if (match) return match;
  }

  return (
    notes.find((file) => file.path === target) ||
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

// ACT 2C.1 — the notes/ storage refresh owner.
//
// Today creates a NEW physical file inside the already-open notes/ directory,
// which the ACT 1B activation snapshot cannot know about: it was taken once, at
// Workspace activation. Without a refresh, WORKSPACE_STATE.files.notes keeps the
// stale record set, and because buildWorkspaceIndex() reads that list as its
// only source, the Index rebuild scheduled right after Today necessarily reports
// files=0 notes=0 until the Workspace is reopened and rescanned.
//
// This is deliberately the smallest possible correction:
//   - it reuses the existing ACT 1B scanner (scanNotesFolder) rather than
//     building a second discovery path or a parallel authoritative list;
//   - every fallible step runs against local values, and the single assignment
//     to WORKSPACE_STATE.files.notes happens only after the candidate records
//     validated, so a failed refresh leaves the previous storage snapshot AND
//     the previously published Index untouched;
//   - it never re-opens or re-creates the Workspace root or notes/, never reads
//     file content and never mutates a record it did not scan.
async function refreshWorkspaceNotesStorage() {
  const previousCount = Array.isArray(WORKSPACE_STATE.files?.notes)
    ? WORKSPACE_STATE.files.notes.length
    : 0;

  const notesHandle = WORKSPACE_STATE.folders?.notes;

  if (!notesHandle) {
    return { ok: false, reason: 'missing-notes-handle', count: previousCount, error: null };
  }

  try {
    const notesRecords = await scanNotesFolder(notesHandle);

    // Reuse the ACT 1B activation validator so a refresh can never publish a
    // record shape the activation boundary would have rejected.
    const invalid = validateNotesWorkspaceSnapshot(
      buildNotesWorkspaceSnapshot({
        rootHandle: WORKSPACE_STATE.rootHandle,
        notesHandle,
        notesRecords,
      })
    );

    if (invalid) {
      return { ok: false, reason: invalid, count: previousCount, error: null };
    }

    // Single controlled assignment boundary — the transactional replace.
    WORKSPACE_STATE.files.notes = notesRecords;

    return { ok: true, reason: '', count: notesRecords.length, error: null };
  } catch (error) {
    return {
      ok: false,
      reason: classifyWorkspaceReadError(error),
      count: previousCount,
      error,
    };
  }
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

// ============================================================
// ACT 5 — Unified Note creation
// ============================================================
//
// There is ONE physical Markdown Note model. Today and Named Note both create
// the same model inside notes/ and both publish it through the same ACT 2C.1
// refresh owner (refreshWorkspaceNotesStorage), so neither can drift from the
// canonical storage list or from the Index.
//
// Named Note creation is deliberately a MODAL over the existing Sidebar
// creation area: there is no second creation system, no second modal framework
// and no concepts/ folder anywhere in this path.

// Filesystem-invalid characters that must never reach a filename, plus control
// characters. Unicode letters, marks and spaces are NOT invalid: a human name
// like "Café notes — 日本語" is preserved exactly.
const NOTE_NAME_INVALID_CHARS = /[\\/:*?"<>|]/;
const NOTE_NAME_CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

// Windows reserved device names, which are invalid filenames on some
// platforms even with an .md suffix.
const NOTE_NAME_RESERVED_BASENAMES =
  /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

// The canonical Today filename. A Named Note must never take it, so Today keeps
// exactly one physical file per day.
const TODAY_NOTE_FILENAME_SHAPE = /^\d{4}-\d{2}-\d{2}\.md$/i;

const NOTE_NAME_MAX_LENGTH = 120;

/**
 * Validate a human-entered Note name and derive its exact filename.
 *
 * Pure: no handle is requested, no file is touched, no state changes. The
 * caller must not create anything until this returns ok === true.
 *
 * @returns {{ok: boolean, fileName: string, title: string, reason: string}}
 */
function buildNamedNoteFileName(rawName) {
  const title = String(rawName ?? '').trim();

  if (!title) {
    return { ok: false, fileName: '', title: '', reason: 'empty-name' };
  }

  if (title.length > NOTE_NAME_MAX_LENGTH) {
    return { ok: false, fileName: '', title, reason: 'name-too-long' };
  }

  if (NOTE_NAME_INVALID_CHARS.test(title) || NOTE_NAME_CONTROL_CHARS.test(title)) {
    return { ok: false, fileName: '', title, reason: 'invalid-characters' };
  }

  // A leading/trailing dot is invisible in a file list and breaks round-tripping.
  if (title.startsWith('.') || title.endsWith('.')) {
    return { ok: false, fileName: '', title, reason: 'invalid-characters' };
  }

  const withExtension = /\.md$/i.test(title) ? title : `${title}.md`;

  const basename = withExtension.replace(/\.md$/i, '');

  if (NOTE_NAME_RESERVED_BASENAMES.test(basename)) {
    return { ok: false, fileName: '', title, reason: 'reserved-name' };
  }

  if (TODAY_NOTE_FILENAME_SHAPE.test(withExtension)) {
    // Reserved for Today. There is no automatic suffix: the user picks a
    // different name rather than silently getting "2026-03-04-2.md".
    return { ok: false, fileName: '', title, reason: 'reserved-today-name' };
  }

  return { ok: true, fileName: withExtension, title, reason: '' };
}

/**
 * Build the starter Markdown for a Named Note.
 *
 * Minimal by contract: frontmatter carries the date ONLY when one was chosen
 * (a cleared date means Undated) and `knowledge: true` ONLY when the checkbox
 * was ticked. No `type: note` key is written, and no managed flag is written
 * when it is false — absence is the "off" state.
 */
function buildNamedNoteStarterMarkdown({ title, date, knowledge }) {
  const frontmatter = [];
  const cleanDate = String(date || '').trim();

  if (cleanDate) frontmatter.push(`date: ${cleanDate}`);
  if (knowledge === true) frontmatter.push('knowledge: true');

  const header = frontmatter.length ? `---\n${frontmatter.join('\n')}\n---\n\n` : '';

  return `${header}# ${title}\n\n## Notes\n\n## Tasks\n\n## Projects\n`;
}

const NAMED_NOTE_ERROR_MESSAGES = {
  'empty-name': 'Enter a name for the note.',
  'name-too-long': 'That name is too long for a filename.',
  'invalid-characters': 'That name contains characters a filename cannot use.',
  'reserved-name': 'That name is reserved. Choose another name.',
  'reserved-today-name': 'That name is reserved for Today. Choose another name.',
  'name-exists': 'A note with that filename already exists.',
  'no-workspace': 'Open a workspace first.',
  'no-notes-storage': 'Today needs an open notes/ storage.',
  'write-failed': 'The note could not be created. Nothing was changed.',
};

function getNamedNoteModalElement() {
  return document.getElementById('namedNoteModal');
}

function getNamedNoteLocalDate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Open the Named Note modal.
 *
 * The modal is a thin form over the existing Sidebar creation control. Opening
 * it creates no handle and changes no state.
 */
function openNamedNoteModal() {
  if (!WORKSPACE_STATE.rootHandle) {
    globalThis.MME_APP?.showToast?.('Open a workspace first', 'error', 2600);
    return false;
  }

  if (!WORKSPACE_STATE.folders?.notes) {
    globalThis.MME_APP?.showToast?.(
      `Today needs an open ${NOTES_DIRECTORY_NAME}/ storage.`,
      'warn',
      3000
    );
    return false;
  }

  const modal = getNamedNoteModalElement();
  if (!modal) {
    globalThis.MME_APP?.log?.('Named Note: modal host missing');
    return false;
  }

  const nameInput = document.getElementById('namedNoteName');
  const dateInput = document.getElementById('namedNoteDate');
  const knowledgeInput = document.getElementById('namedNoteKnowledge');
  const errorEl = document.getElementById('namedNoteError');

  if (nameInput) {
    nameInput.value = '';
    nameInput.focus();
  }

  // ACT 5 — the date defaults to the local today and stays editable; clearing it
  // creates an Undated Note.
  if (dateInput) dateInput.value = getNamedNoteLocalDate();
  if (knowledgeInput) knowledgeInput.checked = false;
  if (errorEl) errorEl.textContent = '';

  // Remember the opener so focus can be restored on close.
  globalThis.__namedNoteOpener = document.activeElement || null;
  modal.style.display = 'block';

  return true;
}

function closeNamedNoteModal() {
  const modal = getNamedNoteModalElement();
  if (modal) modal.style.display = 'none';

  const opener = globalThis.__namedNoteOpener;
  globalThis.__namedNoteOpener = null;

  try {
    if (opener && typeof opener.focus === 'function') opener.focus();
  } catch {
    // A detached opener is not an error worth surfacing.
  }
}

function showNamedNoteError(reason) {
  const errorEl = document.getElementById('namedNoteError');
  const message = NAMED_NOTE_ERROR_MESSAGES[reason] || 'The note could not be created.';

  if (errorEl) {
    errorEl.textContent = message;
  } else {
    globalThis.MME_APP?.showToast?.(message, 'error', 3600);
  }

  globalThis.MME_APP?.log?.(`Named Note: creation rejected reason=${reason}`);
}

/**
 * Create a Named Note.
 *
 * Transaction order, with no partial state on any failure:
 *   validate (pure) -> collision check (no create) -> acquire exact handle ->
 *   write starter exactly once -> publish through the ACT 2C.1 storage refresh
 *   -> open the exact Note (which adopts the writable handle) -> assign the
 *   active record -> one Index rebuild -> path-based navigation record.
 *
 * Cancel never reaches this function: the modal Cancel button only closes.
 */
async function createNamedNote() {
  const nameInput = document.getElementById('namedNoteName');
  const dateInput = document.getElementById('namedNoteDate');
  const knowledgeInput = document.getElementById('namedNoteKnowledge');

  const result = buildNamedNoteFileName(nameInput?.value ?? '');

  if (!result.ok) {
    showNamedNoteError(result.reason);
    return { ok: false, reason: result.reason };
  }

  if (globalThis.MME_NAVIGATION?.isNavigationInProgress?.()) {
    globalThis.MME_APP?.log?.('Named Note: creation blocked by active navigation');
    return { ok: false, reason: 'navigation-in-progress' };
  }

  // The Report leave decision is the same one Today already uses.
  if (typeof globalThis.guardUnsavedReportBeforeDocumentSwitch === 'function') {
    const guard = await globalThis.guardUnsavedReportBeforeDocumentSwitch();
    if (!guard || guard.ok !== true) {
      globalThis.MME_APP?.log?.('Named Note: creation blocked by Report guard');
      return { ok: false, reason: 'report-guard' };
    }
  }

  if (!WORKSPACE_STATE.rootHandle) {
    showNamedNoteError('no-workspace');
    return { ok: false, reason: 'no-workspace' };
  }

  const notesFolder = WORKSPACE_STATE.folders?.notes;
  if (!notesFolder) {
    showNamedNoteError('no-notes-storage');
    return { ok: false, reason: 'no-notes-storage' };
  }

  // Collision: ask WITHOUT create:true, so an existing note is detected and
  // never opened for writing. No automatic numeric suffix is invented.
  let alreadyExists = (WORKSPACE_STATE.files?.notes || []).some(
    (record) => record?.name === result.fileName
  );

  if (!alreadyExists) {
    try {
      await notesFolder.getFileHandle(result.fileName);
      alreadyExists = true;
    } catch {
      alreadyExists = false;
    }
  }

  if (alreadyExists) {
    showNamedNoteError('name-exists');
    return { ok: false, reason: 'name-exists' };
  }

  const date = String(dateInput?.value ?? '').trim();
  const knowledge = knowledgeInput?.checked === true;

  const text = buildNamedNoteStarterMarkdown({
    title: result.title,
    date,
    knowledge,
  });

  // The handle is requested only now, after every rejection path is closed.
  const fileHandle = await notesFolder.getFileHandle(result.fileName, { create: true });

  try {
    const writable = await fileHandle.createWritable();
    await writable.write(text);
    await writable.close();
  } catch (error) {
    showNamedNoteError('write-failed');
    globalThis.MME_APP?.log?.(
      `Named Note: starter write failed for ${result.fileName}: ${error?.message || error}`
    );
    return { ok: false, reason: 'write-failed' };
  }

  // Publish through the SAME owner Today uses, then open the exact Note.
  const refreshed = await refreshWorkspaceNotesStorage();

  if (!refreshed.ok) {
    globalThis.MME_APP?.showToast?.(
      `Note created, but the ${NOTES_DIRECTORY_NAME}/ list could not be refreshed (${refreshed.reason}). Reopen the workspace to refresh.`,
      'warn',
      4600
    );
    globalThis.MME_APP?.log?.(
      `Named Note: storage refresh failed reason=${refreshed.reason} notes=${refreshed.count}`
    );
  } else {
    globalThis.MME_APP?.log?.(
      `Named Note: storage refreshed notes=${refreshed.count} path=${NOTES_DIRECTORY_NAME}/${result.fileName}`
    );
  }

  if (!globalThis.MME_APP?.confirmDiscardIfDirty?.()) {
    return { ok: false, reason: 'discard-declined' };
  }

  const path = `${NOTES_DIRECTORY_NAME}/${result.fileName}`;

  globalThis.MME_APP.openTextDocument({
    text,
    fileName: result.fileName,
    fileHandle,
    reason: 'workspace named note',
  });

  globalThis.clearReportIdentityAfterTransition?.();

  WORKSPACE_STATE.activeFile = {
    kind: 'notes',
    name: result.fileName,
    path,
    handle: fileHandle,
  };

  persistActiveWorkspaceFile();
  window.updateWorkspaceActiveFileHighlight?.();
  renderWorkspaceActivePanel?.();
  renderWorkspaceRelatedPanel?.();
  renderWorkspaceTasksPanel?.();

  // Exactly one Index rebuild, and only when the physical collection is current.
  if (refreshed.ok) {
    window.scheduleWorkspaceIndexRebuild?.('named note');
  }

  if (typeof globalThis.MME_NAVIGATION === 'object') {
    globalThis.MME_NAVIGATION.recordSuccessfulNavigation({
      type: 'workspace-file',
      path,
      kind: 'notes',
      name: result.fileName,
      source: 'workspace named note',
    });
  }

  closeNamedNoteModal();

  globalThis.MME_APP?.showToast?.(`Note created ✓ ${result.fileName}`, 'ok', 1800);
  globalThis.MME_APP?.log?.(`Named Note created: ${path}`);

  return { ok: true, path, fileName: result.fileName };
}

/**
 * Wire the Named Note modal exactly once.
 *
 * Cancel is a pure close: it creates no handle and changes no state.
 */
function wireNamedNoteModal() {
  if (globalThis.__namedNoteModalWired) return;
  globalThis.__namedNoteModalWired = true;

  const createBtn = document.getElementById('namedNoteCreate');
  const cancelBtn = document.getElementById('namedNoteCancel');
  const closeBtn = document.getElementById('namedNoteClose');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', (event) => {
      event.preventDefault();
      closeNamedNoteModal();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', (event) => {
      event.preventDefault();
      closeNamedNoteModal();
    });
  }

  if (createBtn) {
    createBtn.addEventListener('click', async (event) => {
      event.preventDefault();
      try {
        await createNamedNote();
      } catch (e) {
        globalThis.MME_APP?.log?.(`Named Note: create failed: ${e?.message || e}`);
        showNamedNoteError('write-failed');
      }
    });
  }
}

try {
  globalThis.openNamedNoteModal = openNamedNoteModal;
  globalThis.closeNamedNoteModal = closeNamedNoteModal;
  globalThis.createNamedNote = createNamedNote;
  window.openNamedNoteModal = openNamedNoteModal;
  window.closeNamedNoteModal = closeNamedNoteModal;
} catch {}

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

  // ACT 2C.1 — did Today CREATE the file, or reuse an existing one?
  // getFileHandle({create:true}) is silent about that. The honest signal is the
  // canonical storage snapshot itself: it was produced by scanning THIS SAME
  // notes/ directory handle (WORKSPACE_STATE.folders.notes), so a record for
  // this exact name in it proves the file already existed. A missing record
  // means Today just created it and the snapshot is now stale.
  //
  // This is a same-directory existence proof, not a name guess: a Note in
  // another Workspace, another directory or a matching title/H1 can never
  // produce a record here.
  const existingRecord = (WORKSPACE_STATE.files?.notes || []).find(
    (record) => record?.name === fileName
  );
  const createdNewFile = !existingRecord;

  if (!String(text || '').trim()) {
    // ACT 2C — the legacy `type: journal` frontmatter key belonged to the
    // retired kind split and is not written. No new metadata writer is added.
    text = `# ${dateString}

## Notes

## Tasks

## Projects
`;

    // ACT 2C.1 — the starter write is the only physical write in this path, and
    // it happens exactly once per newly created file. If it fails, nothing is
    // published: no storage record, no Index rebuild, no document switch.
    let written = false;

    try {
      const writable = await fileHandle.createWritable();
      await writable.write(text);
      await writable.close();
      written = true;
    } catch (error) {
      globalThis.MME_APP?.showToast?.(
        `Today could not be created (${fileName}). Nothing was changed.`,
        'error',
        4200
      );
      globalThis.MME_APP?.log?.(
        `Workspace: Today starter write failed for ${fileName}: ${error?.message || error}`
      );
      return;
    }

    if (written) {
      globalThis.MME_APP?.log?.(
        `Workspace: initialized Today journal with Daily Capture starter ${fileName}`
      );
    }
  }

  if (!globalThis.MME_APP?.confirmDiscardIfDirty?.()) return;

  // ACT 2C.1 — refresh the canonical physical collection BEFORE the document
  // switch and before the single Index rebuild below, so the Active panel, the
  // saved Index snapshot and any future Sidebar projection all observe the new
  // Note in the same turn. Exactly one rescan, exactly one assignment, one
  // rebuild: the collection is never current-then-stale at any observed point.
  // An existing Today file performs no scan at all.
  let storageRefresh = { ok: true, reason: '', count: 0, error: null };

  if (createdNewFile) {
    storageRefresh = await refreshWorkspaceNotesStorage();

    if (!storageRefresh.ok) {
      // Honest, non-destructive failure: the previous storage snapshot and the
      // previously published Index are both preserved, and no rebuild is
      // scheduled against a list we could not refresh.
      globalThis.MME_APP?.showToast?.(
        `Today file created, but the ${NOTES_DIRECTORY_NAME}/ list could not be refreshed (${storageRefresh.reason}). Reopen the workspace to refresh.`,
        'warn',
        4600
      );
      globalThis.MME_APP?.log?.(
        `Workspace: Today storage refresh failed reason=${storageRefresh.reason} notes=${storageRefresh.count} error=${
          storageRefresh.error?.message || '(none)'
        }`
      );
    } else {
      globalThis.MME_APP?.log?.(
        `Workspace: Today storage refreshed notes=${storageRefresh.count} path=${NOTES_DIRECTORY_NAME}/${fileName}`
      );
    }
  }

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
  // ACT 2C.1 — exactly one Index rebuild for this Today, and only when the
  // physical collection is current. A failed refresh leaves the previous Index
  // snapshot published and untouched.
  if (!createdNewFile || storageRefresh.ok) {
    window.scheduleWorkspaceIndexRebuild?.('today');
  }
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
  // ACT 4 — resolution is by EXACT relative path against the canonical notes/
  // storage records (the ACT 1B collection that owns physical handles). The
  // retired journals/concepts buckets are only a defensive fallback, so a stale
  // legacy row can never throw here. H1 is never used to resolve a click.
  const storageRecords = Array.isArray(WORKSPACE_STATE.files?.notes)
    ? WORKSPACE_STATE.files.notes
    : [];
  const legacyRecords = [
    ...(WORKSPACE_STATE.files?.journals || []),
    ...(WORKSPACE_STATE.files?.concepts || []),
  ];

  const fileRecord =
    storageRecords.find((file) => file.path === path) ||
    legacyRecords.find((file) => file.path === path);

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

// ACT V0 — the global Archive/Restore control is gone from the Workspace action
// area, so its two owners are removed here rather than left dormant:
//   1. archiveActiveWorkspaceFile() — the legacy PHYSICAL archive workflow.
//      It wrote a copy into an archive/ folder, removed the original with
//      removeEntry(), nulled currentSaveHandle, dropped the last-active-path
//      key and opened a synthetic archived.md document. None of that is part of
//      the Archive contract, which is a frontmatter flag patched into the live
//      buffer: no move, no copy, no delete, no rename, no automatic Save.
//   2. bindArchiveActiveDirect() — a second capture-phase click/pointerup
//      lifecycle on the same control, which force-enabled a control that was
//      deliberately kept disabled.
// Archive and Restore now have exactly ONE owner: the Active panel action row
// in js/main.js (renderWorkspaceActiveNoteActions), which reads the live buffer
// flags, labels the action Archive/Restore, and writes through the single
// metadata writer applyActiveNoteMetadata(). Nothing here is re-introduced.

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
    onOpenWorkspace: async () => {
      // ACT 4B — reuse the EXISTING Workspace owner unchanged. It already
      // preserves the current document, handle and Sidebar on cancel, on an
      // invalid folder and on a declined initialization. Only AFTER it resolves
      // is the shared Sidebar composition recomposed, so accepted Workspace
      // panels return and Standalone results stop masquerading as aggregation.
      await openWorkspace();
      try {
        globalThis.applySidebarComposition?.();
      } catch (e) {
        globalThis.MME_APP?.log?.(`Workspace: composition refresh skipped (${e?.message || e})`);
      }
    },
    onToday: openToday,
    onNewConcept: openNamedNoteModal,
  });

  globalThis.MME_APP?.log?.(
    'Workspace: global action area bound (Open Workspace, Today, New Note)'
  );

  // ACT V0 — bindArchiveActiveDirect() is removed. It existed only to attach a
  // second, capture-phase click lifecycle to the global "Archive Active"
  // control, and it force-enabled a control that was deliberately disabled.
  // With the control gone, the Active panel action row in js/main.js is the one
  // and only Archive/Restore owner.

  // ACT 5 — wire the Named Note modal once, alongside the existing creation
  // controls. It is the same modal the adapted "New Note" button opens.
  wireNamedNoteModal();

  clearSidebar();
  ensureWorkspaceSearchPanel?.();
  wireWorkspaceSearch?.();

  document.getElementById('workspaceJournalsList')?.addEventListener('click', handleSidebarClick);
  document.getElementById('workspaceConceptsList')?.addEventListener('click', handleSidebarClick);
  // ACT 6 — Archive rows navigate by the same exact-path click contract.
  document.getElementById('workspaceArchiveList')?.addEventListener('click', handleSidebarClick);

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
  buildNamedNoteFileName,
  buildNamedNoteStarterMarkdown,
  openNamedNoteModal,
  closeNamedNoteModal,
  createNamedNote,
  wireNamedNoteModal,
  refreshWorkspaceNotesStorage,
  WORKSPACE_FORMAT,
  refreshWorkspaceSidebar,
  openWorkspace,
  openToday,
  initWorkspace,
};

// ACT 2C.1 — expose the notes/ storage refresh owner alongside the existing
// globals. ACT 3 and future Sidebar packages read the canonical physical
// collection through it; nothing else publishes WORKSPACE_STATE.files.notes.
globalThis.refreshWorkspaceNotesStorage = refreshWorkspaceNotesStorage;
window.refreshWorkspaceNotesStorage = refreshWorkspaceNotesStorage;

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
