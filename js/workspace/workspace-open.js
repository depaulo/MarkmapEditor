export async function openWorkspaceDirectory() {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('Directory picker is not supported in this browser.');
  }

  const handle = await window.showDirectoryPicker({
    mode: 'readwrite',
  });

  return handle;
}

export async function ensureSubfolder(dirHandle, name) {
  let folderHandle = null;

  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'directory' && entry.name === name) {
      folderHandle = entry;
      break;
    }
  }

  if (!folderHandle) {
    folderHandle = await dirHandle.getDirectoryHandle(name, { create: true });
  }

  return folderHandle;
}

// ============================================================
// ACT 1A — Workspace format detection (strict, read-only)
// ============================================================
//
// Detection answers exactly one question: which Workspace format does the
// picked folder have? It performs one directory iteration and no mutation of
// any kind:
//   - no getDirectoryHandle() / getFileHandle() (with or without create: true),
//   - no createWritable(),
//   - no removeEntry(), move, rename or delete,
//   - no WORKSPACE_STATE access (this module never imports workspace state).
// Every outcome is returned as an explicit result object; the caller decides
// whether the currently active Workspace may be replaced.

export const WORKSPACE_FORMAT = Object.freeze({
  EMPTY: 'empty',
  UNINITIALIZED: 'uninitialized',
  VALID_NOTES: 'valid-notes',
  REJECTED_LEGACY: 'rejected-legacy',
  REJECTED_MIXED: 'rejected-mixed',
  REJECTED_INVALID_NOTES_ENTRY: 'rejected-invalid-notes-entry',
  PERMISSION_FAILURE: 'permission-failure',
  CANCELED: 'canceled',
});

// Exact lowercase directory name of the Workspace index folder.
export const NOTES_DIRECTORY_NAME = 'notes';

// Legacy physical Workspace model. Presence of any of these directories
// without `notes/` rejects the folder as legacy; presence together with
// `notes/` rejects it as mixed. There is no compatibility/read-only legacy mode.
export const LEGACY_WORKSPACE_DIRECTORIES = Object.freeze(['journals', 'concepts', 'archive']);

function normalizeEntryKind(entry) {
  return entry?.kind === 'directory' ? 'directory' : 'file';
}

// Pure classification over names/kinds already read from the directory.
// Precedence: an invalid `notes` entry is reported before legacy/mixed
// diagnostics, because it is the most specific defect of the picked folder.
//
// ACT 1B refinement: a folder that has no `notes` entry and no legacy marker
// directory is `empty` only when it contains nothing at all; a folder with
// unrelated content is `uninitialized`. Both outcomes are initializable, but
// they require two different confirmations (E1/E2 in ACT 1B), so they must be
// distinguishable before any mutation is offered.
export function classifyWorkspaceEntries(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const legacyDirectories = [];
  let notesEntryKind = null;
  let caseVariantNotesEntry = '';

  for (const entry of list) {
    const name = String(entry?.name || '');
    const kind = normalizeEntryKind(entry);

    if (name === NOTES_DIRECTORY_NAME) {
      notesEntryKind = kind === 'file' ? 'file' : 'directory';
      continue;
    }

    if (!caseVariantNotesEntry && name.toLowerCase() === NOTES_DIRECTORY_NAME) {
      caseVariantNotesEntry = name;
    }

    if (
      kind === 'directory' &&
      LEGACY_WORKSPACE_DIRECTORIES.includes(name) &&
      !legacyDirectories.includes(name)
    ) {
      legacyDirectories.push(name);
    }
  }

  if (notesEntryKind === 'file') {
    return {
      status: WORKSPACE_FORMAT.REJECTED_INVALID_NOTES_ENTRY,
      entryCount: list.length,
      notesEntryKind,
      caseVariantNotesEntry,
      legacyDirectories,
    };
  }

  if (notesEntryKind === 'directory') {
    return {
      status: legacyDirectories.length
        ? WORKSPACE_FORMAT.REJECTED_MIXED
        : WORKSPACE_FORMAT.VALID_NOTES,
      entryCount: list.length,
      notesEntryKind,
      caseVariantNotesEntry,
      legacyDirectories,
    };
  }

  if (legacyDirectories.length) {
    return {
      status: WORKSPACE_FORMAT.REJECTED_LEGACY,
      entryCount: list.length,
      notesEntryKind: null,
      caseVariantNotesEntry,
      legacyDirectories,
    };
  }

  return {
    status: list.length ? WORKSPACE_FORMAT.UNINITIALIZED : WORKSPACE_FORMAT.EMPTY,
    entryCount: list.length,
    notesEntryKind: null,
    caseVariantNotesEntry,
    legacyDirectories: [],
  };
}

// Single read pass over the directory. Two views are returned from the same
// iteration: names/kinds for classification, plus the raw entries so that the
// exact `notes/` directory handle discovered here can be reused instead of
// re-requesting it (ACT 1B must not call getDirectoryHandle() for a folder that
// already exists). No handle request, no write and no permission prompt is
// performed by this read pass.
async function readWorkspaceRootSnapshot(rootHandle) {
  if (!rootHandle || typeof rootHandle.values !== 'function') {
    throw new Error('Workspace root handle does not expose directory iteration');
  }

  const entries = [];
  const rawEntries = [];

  for await (const entry of rootHandle.values()) {
    entries.push({ name: String(entry?.name || ''), kind: normalizeEntryKind(entry) });
    rawEntries.push(entry);
  }

  return { entries, rawEntries };
}

// Single read pass over the directory; returns names/kinds only.
export async function readWorkspaceRootEntries(rootHandle) {
  const snapshot = await readWorkspaceRootSnapshot(rootHandle);

  return snapshot.entries;
}

// The discovered `notes/` directory handle, or null when the picked folder has
// no directory entry with exactly that name.
function findNotesDirectoryHandle(snapshot) {
  for (const entry of snapshot.rawEntries) {
    if (String(entry?.name || '') === NOTES_DIRECTORY_NAME && normalizeEntryKind(entry) === 'directory') {
      return entry;
    }
  }

  return null;
}

export function classifyWorkspaceReadError(error) {
  const name = String(error?.name || '');

  if (name === 'NotAllowedError' || name === 'SecurityError') return 'permission';
  if (name === 'AbortError') return 'aborted';

  return 'iteration';
}

// Never throws for expected outcomes and never reports a mutation.
// `notesHandle` is the discovered `notes/` directory handle (or null). ACT 1B
// reuses it for activation, so a detected valid Workspace never re-requests a
// folder that already exists on disk.
export async function detectWorkspaceFormat(rootHandle) {
  let snapshot = null;

  try {
    snapshot = await readWorkspaceRootSnapshot(rootHandle);
  } catch (error) {
    return {
      status: WORKSPACE_FORMAT.PERMISSION_FAILURE,
      reason: classifyWorkspaceReadError(error),
      root: rootHandle || null,
      entries: null,
      notesHandle: null,
      notesEntryKind: null,
      caseVariantNotesEntry: '',
      legacyDirectories: [],
      error,
    };
  }

  const classification = classifyWorkspaceEntries(snapshot.entries);

  return {
    status: classification.status,
    reason: '',
    root: rootHandle || null,
    entries: snapshot.entries,
    notesHandle: findNotesDirectoryHandle(snapshot),
    notesEntryKind: classification.notesEntryKind,
    caseVariantNotesEntry: classification.caseVariantNotesEntry,
    legacyDirectories: classification.legacyDirectories,
    error: null,
  };
}

export function isPickerCancellation(error) {
  return String(error?.name || '') === 'AbortError';
}

// Picker + detection as one read-only transaction. Cancellation is normalized
// here so the caller never sees an exception for a user cancel.
export async function openWorkspaceCandidate() {
  let root = null;

  try {
    root = await openWorkspaceDirectory();
  } catch (error) {
    if (isPickerCancellation(error)) {
      return {
        status: WORKSPACE_FORMAT.CANCELED,
        reason: 'picker',
        root: null,
        entries: null,
        notesHandle: null,
        notesEntryKind: null,
        caseVariantNotesEntry: '',
        legacyDirectories: [],
        error: null,
      };
    }

    return {
      status: WORKSPACE_FORMAT.PERMISSION_FAILURE,
      reason: 'picker',
      root: null,
      entries: null,
      notesHandle: null,
      notesEntryKind: null,
      caseVariantNotesEntry: '',
      legacyDirectories: [],
      error,
    };
  }

  return detectWorkspaceFormat(root);
}

// ============================================================
// ACT 1B — Workspace initialization (the only authorized writer)
// ============================================================

export const WORKSPACE_INITIALIZATION_MARKER = '// ACT 1B — Workspace initialization';

// Creates exactly one directory: the literal `notes/` name from
// NOTES_DIRECTORY_NAME. The name is not a parameter, so no caller can redirect
// this writer to another folder, and no other directory can be created here.
// Only the ACT 1B initialization transaction may call this, only for an `empty`
// or `uninitialized` folder, and only after the user confirmed.
export async function createNotesDirectory(rootHandle) {
  if (!rootHandle || typeof rootHandle.getDirectoryHandle !== 'function') {
    throw new Error('Workspace root handle does not expose getDirectoryHandle');
  }

  return rootHandle.getDirectoryHandle(NOTES_DIRECTORY_NAME, { create: true });
}
