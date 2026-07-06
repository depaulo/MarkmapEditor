// @ts-nocheck

import { WORKSPACE_STATE, isWorkspaceReady } from './workspace-state.js';
import { createWorkspaceActions } from './workspace-actions.js';
import { clearSidebar, renderSidebarFiles } from './workspace-sidebar.js';
import { openWorkspaceDirectory, ensureSubfolder } from './workspace-open.js';
import { scanFolder } from './workspace-scanner.js';

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
  return getLocalStorageValue(WORKSPACE_UI_STORAGE_KEYS.lastActivePath, '').trim();
}

function findWorkspaceFileByPath(path) {
  const target = String(path || '').trim();

  if (!target) return null;

  const journals = WORKSPACE_STATE.files?.journals || [];
  const concepts = WORKSPACE_STATE.files?.concepts || [];

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
    globalThis.MME_APP?.log?.(
      `Workspace: failed to reopen last active file: ${e?.message || e}`
    );
    return false;
  }
}

async function openWorkspace() {
  const root = await openWorkspaceDirectory();

  WORKSPACE_STATE.rootHandle = root;
  WORKSPACE_STATE.rootName = root.name || 'Workspace';

  WORKSPACE_STATE.folders.journals = await ensureSubfolder(root, 'journals');
  WORKSPACE_STATE.folders.concepts = await ensureSubfolder(root, 'concepts');
  WORKSPACE_STATE.folders.assets = await ensureSubfolder(root, 'assets');
  WORKSPACE_STATE.folders.archive = await ensureSubfolder(root, 'archive');
  WORKSPACE_STATE.folders.system = await ensureSubfolder(root, 'system');

  updateWorkspaceUiState();
  await refreshWorkspaceSidebar();

  await reopenLastActiveWorkspaceFileIfPossible();

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
    removeLocalStorageValue(WORKSPACE_UI_STORAGE_KEYS.lastActivePath);
    return;
  }

  setLocalStorageValue(WORKSPACE_UI_STORAGE_KEYS.lastActivePath, active.path);

  globalThis.MME_APP?.log?.(`Workspace: persisted active file ${active.path}`);
}

globalThis.persistActiveWorkspaceFile = persistActiveWorkspaceFile;
globalThis.refreshWorkspaceSidebar = refreshWorkspaceSidebar;

function normalizeWorkspaceKindForCompare(value) {
  const kind = String(value || '')
    .trim()
    .toLowerCase();

  if (kind === 'journal') return 'journals';
  if (kind === 'journals') return 'journals';

  if (kind === 'concept') return 'concepts';
  if (kind === 'concepts') return 'concepts';

  return kind;
}

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
  if (!WORKSPACE_STATE.rootHandle) {
    globalThis.MME_APP?.showToast?.('Open a workspace first', 'error', 3000);
    return;
  }

  if (!WORKSPACE_STATE.folders.journals) {
    await openWorkspace();
  }

  if (!WORKSPACE_STATE.folders.journals) return;

  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const fileName = `${yyyy}-${mm}-${dd}.md`;

  const fileHandle = await WORKSPACE_STATE.folders.journals.getFileHandle(fileName, {
    create: true,
  });

  let file = await fileHandle.getFile();
  let text = await file.text();

  if (!text.trim()) {
    text = `---
      type: journal
      date: ${yyyy}-${mm}-${dd}
      tags: []
      ---

      # Today
      Tags:

      ## Capture
      -

      ## Tasks
      - [ ]

      ## Notes
      `;

    const writable = await fileHandle.createWritable();
    await writable.write(text);
    await writable.close();
  }

  if (!globalThis.MME_APP?.confirmDiscardIfDirty?.()) return;

  globalThis.MME_APP.openTextDocument({
    text,
    fileName,
    fileHandle,
    reason: 'workspace today',
  });

  WORKSPACE_STATE.activeFile = {
    kind: 'journals',
    name: fileName,
    path: `journals/${fileName}`,
    handle: fileHandle,
  };

  persistActiveWorkspaceFile();
  await refreshWorkspaceSidebar();
  window.updateWorkspaceActiveFileHighlight?.();
  renderWorkspaceActivePanel?.();
  renderWorkspaceRelatedPanel?.();
  renderWorkspaceTasksPanel?.();
  window.scheduleWorkspaceIndexRebuild?.('today');
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
    kind: fileRecord.kind || 'journals',
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
  const allFiles = [...WORKSPACE_STATE.files.journals, ...WORKSPACE_STATE.files.concepts];

  const fileRecord = allFiles.find((file) => file.path === path);
  if (!fileRecord) {
    globalThis.MME_APP?.log?.(`Workspace file not found in state: ${path}`);
    return;
  }

  openWorkspaceFile(fileRecord).catch((e) => {
    globalThis.MME_APP?.showToast?.(`Open file failed: ${e?.message || e}`, 'error');
    globalThis.MME_APP?.log?.(`Open file failed: ${e?.message || e}`);
  });
}

const WORKSPACE_UI_STORAGE_KEYS = {
  lastActivePath: 'markmap:workspace:lastActivePath',
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
    document.documentElement.classList.toggle('journal-sidebar-collapsed', !!next);

    const btn2 = document.getElementById('btnWorkspaceCollapse');
    if (btn2) {
      btn2.textContent = next ? '▶' : '◀';
      btn2.title = next ? 'Expand sidebar' : 'Collapse sidebar';
      btn2.setAttribute('aria-label', btn2.title);
    }

    setLocalStorageValue(JOURNAL_SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');

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

async function archiveActiveWorkspaceFile() {
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
    globalThis.MME_APP?.log?.(
      'Workspace: Archive blocked because no active workspace file exists'
    );
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

  const archivedMessage = removedOriginal ? `Archived ${active.name}` : `Archive copy created: ${archiveFileName}`;

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

  globalThis.MME_APP?.log?.('Workspace: actions wired');
}

globalThis.WORKSPACE_API = {
  isWorkspaceReady,
  createWorkspaceActions,
  clearSidebar,
  renderSidebarFiles,
  openWorkspaceDirectory,
  ensureSubfolder,
  scanFolder,
  refreshWorkspaceSidebar,
  openWorkspace,
  openToday,
  initWorkspace,
};

globalThis.MME_APP?.log?.(
  `Workspace: stored last active file = ${getLastActiveWorkspacePath() || '(none)'}`
);

if (globalThis.MME_APP) {
  initWorkspace();
} else {
  window.addEventListener('mme-main-ready', initWorkspace, { once: true });
}

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


