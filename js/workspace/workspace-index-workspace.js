// @ts-nocheck
// Virtual Workspace Index V1 — Host Workspace Descriptor
//
// Second registered Host workspace. Read-only, non-physical, deterministic.
// Consumes WORKSPACE_INDEX_STATE (read-only). Does NOT scan, parse, or read
// files. Does NOT create another index. Does NOT own Save/Archive/Navigation.
//
// Transaction boundaries:
// - activate() builds projection while hidden, shows only as final step
// - deactivate() hides container, preserves projection
// - refresh() regenerates in place, no history, no dirty state
// - Actions resolve physical file BEFORE switching to Journal
// - Rollback to workspace-index on cancelled/failed physical open
// - Return button switches back to previous workspace preserving live state

(function initWorkspaceIndexWorkspace(global) {
  'use strict';

  const HOST_ID = 'workspace-index';
  const HOST_TITLE = 'Workspace Index';
  const VIRTUAL_LOCATION_ID = 'mme://workspace/index';
  const VIRTUAL_LOCATION_TYPE = 'virtual-workspace-index';
  const CONTAINER_ID = 'workspaceIndexView';

  let registered = false;
  let diagnosticReported = false;
  let refreshListenerBound = false;
  let previousWorkspace = null;

  function safeLog(message) {
    try {
      if (typeof globalThis.MME_APP?.log === 'function') {
        globalThis.MME_APP.log(message);
      }
    } catch {}
  }

  function getHost() {
    return typeof globalThis.MME_WORKSPACE_HOST === 'object' ? globalThis.MME_WORKSPACE_HOST : null;
  }

  function getDocumentApi() {
    return typeof globalThis.MME_WORKSPACE_INDEX_DOCUMENT === 'object'
      ? globalThis.MME_WORKSPACE_INDEX_DOCUMENT
      : null;
  }

  // ---- Container ownership (Correction 4) ----

  function ensureContainer() {
    let container = document.getElementById(CONTAINER_ID);

    if (container) return container;

    const layout = document.getElementById('layout');
    if (!layout) {
      throw new Error('WorkspaceIndex: #layout not found');
    }

    container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.className = 'workspaceIndexView';
    container.hidden = true;
    container.setAttribute('aria-label', 'Workspace Index');

    layout.appendChild(container);

    safeLog('WorkspaceIndex: container created');
    return container;
  }

  function showContainer(container) {
    container.hidden = false;
  }

  function hideContainer(container) {
    container.hidden = true;
  }

  // ---- Return button helper ----

  function getPreviousWorkspaceLabel() {
    // Try to get the active file name from the previous workspace session
    const session = globalThis.APP_MODE_SESSIONS?.journal;
    if (session?.fileName) {
      return session.fileName;
    }
    return 'Workspace';
  }

  function buildReturnButtonHtml() {
    const label = getPreviousWorkspaceLabel();
    const escapedLabel = String(label).replace(/</g, '<').replace(/>/g, '>');
    return `
      <div class="wsIndexReturnRow">
        <button type="button" data-action="return-to-workspace" class="wsIndexReturnAction">
          ← Return to ${escapedLabel}
        </button>
      </div>
    `;
  }

  // ---- Action handling (Corrections 1 & 2) ----

  function findWorkspaceFileByPath(path, kind) {
    try {
      if (typeof globalThis.findWorkspaceFileByPath === 'function') {
        return globalThis.findWorkspaceFileByPath(path, kind);
      }
    } catch {}
    return null;
  }

  function handleReturnToWorkspace() {
    const host = getHost();
    if (!host) return;

    // Switch back to Journal (the only editable workspace registered)
    host.switchTo('journal', { reason: 'workspace-index return' }).catch((e) => {
      safeLog(`WorkspaceIndex: return failed: ${e?.message || e}`);
    });
  }

  async function handleOpenWorkspaceFile(path, kind) {
    // Correction 1: Resolve physical file BEFORE switching
    const fileRecord = findWorkspaceFileByPath(path, kind);

    if (!fileRecord || !fileRecord.handle) {
      safeLog(`WorkspaceIndex: file not found path=${path} kind=${kind}`);
      globalThis.MME_APP?.showToast?.(`File not found: ${path}`, 'error', 3000);
      return;
    }

    // Switch to Journal
    const host = getHost();
    if (!host) {
      safeLog('WorkspaceIndex: Host unavailable for switch');
      return;
    }

    let switchResult;
    try {
      switchResult = await host.switchTo('journal', {
        reason: 'workspace-index open file',
      });
    } catch (e) {
      safeLog(`WorkspaceIndex: switch to journal failed: ${e?.message || e}`);
      globalThis.MME_APP?.showToast?.(`Failed to switch to Journal: ${e?.message || e}`, 'error', 3000);
      return;
    }

    if (!switchResult || switchResult.status !== host.RESULT_STATUS.ACTIVATED) {
      safeLog(`WorkspaceIndex: switch to journal status=${switchResult?.status || 'unknown'}`);
      globalThis.MME_APP?.showToast?.('Failed to switch to Journal', 'error', 3000);
      return;
    }

    // Call canonical opener
    let opened;
    try {
      opened = await globalThis.openWorkspaceFile(
        fileRecord,
        kind || fileRecord.kind,
        'workspace index open'
      );
    } catch (e) {
      opened = null;
      safeLog(`WorkspaceIndex: openWorkspaceFile threw: ${e?.message || e}`);
    }

    // Correction 2: Rollback on cancelled/failed
    if (!opened) {
      safeLog('WorkspaceIndex: open cancelled/failed, rolling back to workspace-index');
      try {
        await host.switchTo(HOST_ID, {
          reason: 'workspace-index open file rollback',
        });
      } catch (e) {
        safeLog(`WorkspaceIndex: rollback failed: ${e?.message || e}`);
      }
      globalThis.MME_APP?.showToast?.('File open cancelled', 'warn', 2000);
    }
  }

  function handleRefreshIndex() {
    try {
      if (typeof globalThis.buildWorkspaceIndex === 'function') {
        globalThis.buildWorkspaceIndex().then(() => {
          refresh();
        });
      }
    } catch (e) {
      safeLog(`WorkspaceIndex: refresh failed: ${e?.message || e}`);
    }
  }

  function handleOpenWorkspace() {
    try {
      if (typeof globalThis.openWorkspace === 'function') {
        globalThis.openWorkspace();
      }
    } catch (e) {
      safeLog(`WorkspaceIndex: open workspace failed: ${e?.message || e}`);
    }
  }

  function onActionClick(event) {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return;

    const actionElement = event.target.closest('button[data-action]');

    if (
      !actionElement ||
      !container.contains(actionElement)
    ) {
      return;
    }

    const action = actionElement.dataset.action || '';
    const path = actionElement.dataset.path || '';
    const kind = actionElement.dataset.kind || '';

    safeLog(
      `WorkspaceIndex Action: action=${action} path=${path || 'none'} active=${getHost()?.getActiveId?.() || '(none)'}`
    );

    if (action === 'open-workspace-file') {
      handleOpenWorkspaceFile(path, kind);
    } else if (action === 'refresh-index') {
      handleRefreshIndex();
    } else if (action === 'open-workspace') {
      handleOpenWorkspace();
    } else if (action === 'return-to-workspace') {
      handleReturnToWorkspace();
    }
  }

  // ---- Refresh event listener (Correction K) ----

  function onWorkspaceIndexReady() {
    const host = getHost();
    if (!host) return;

    const activeId = host.getActiveId();

    if (activeId === HOST_ID) {
      // Visible: refresh in place
      refresh();
    }
    // If journal is active, compact panel refresh is handled by main.js already
  }

  function bindRefreshListener() {
    if (refreshListenerBound) return;
    window.addEventListener('mme-workspace-index-ready', onWorkspaceIndexReady);
    refreshListenerBound = true;
  }

  // ---- Descriptor methods ----

  async function activate(context) {
    // Staged activation (Correction 3):
    // 1. Validate dependencies
    const docApi = getDocumentApi();
    if (!docApi) {
      throw new Error('WorkspaceIndex.activate: MME_WORKSPACE_INDEX_DOCUMENT not available');
    }

    // Store previous workspace for Return button
    const host = getHost();
    previousWorkspace = host ? host.getActiveId() : null;

    // 2. Build projection while hidden
    let projectionHtml;
    try {
      projectionHtml = docApi.buildProjection();
    } catch (e) {
      throw new Error(`WorkspaceIndex.activate: projection failed: ${e?.message || e}`);
    }

    // 3. Create/wire container idempotently
    let container;
    try {
      container = ensureContainer();
    } catch (e) {
      throw new Error(`WorkspaceIndex.activate: container failed: ${e?.message || e}`);
    }

    // 4. Wire event listener if not already
    if (!container.__wsIndexActionBound) {
      container.addEventListener('click', onActionClick);
      container.__wsIndexActionBound = true;
    }

    // 5. Render projection into container (while still hidden)
    container.innerHTML = projectionHtml;

    // 6. Prepend Return button
    const returnBtnHtml = buildReturnButtonHtml();
    container.insertAdjacentHTML('afterbegin', returnBtnHtml);

    // 7. Show Index only as the final non-throwing step
    showContainer(container);

    // Add workspace-index-active class for command blocking
    document.documentElement.classList.add('workspace-index-active');

    bindRefreshListener();

    return Object.freeze({
      activated: true,
      indexReady: Boolean(globalThis.WORKSPACE_INDEX_STATE?.ready),
    });
  }

  function deactivate() {
    const container = document.getElementById(CONTAINER_ID);
    if (container) {
      hideContainer(container);
    }

    document.documentElement.classList.remove('workspace-index-active');

    return Object.freeze({ status: 'deactivated' });
  }

  function refresh() {
    const docApi = getDocumentApi();
    if (!docApi) return;

    const container = document.getElementById(CONTAINER_ID);
    if (!container) return;

    // Regenerate projection and swap in a single innerHTML assignment
    try {
      const html = docApi.buildProjection();
      container.innerHTML = html;
      // Re-prepend Return button after refresh
      const returnBtnHtml = buildReturnButtonHtml();
      container.insertAdjacentHTML('afterbegin', returnBtnHtml);
    } catch (e) {
      safeLog(`WorkspaceIndex: refresh projection failed: ${e?.message || e}`);
    }
  }

  function detach() {
    // V1 unsupported/no-op
    return Object.freeze({ status: 'unsupported' });
  }

  function getState() {
    const container = document.getElementById(CONTAINER_ID);
    return Object.freeze({
      visible: container ? !container.hidden : false,
      indexReady: Boolean(globalThis.WORKSPACE_INDEX_STATE?.ready),
      lastBuiltAt: globalThis.WORKSPACE_INDEX_STATE?.lastBuiltAt || 0,
    });
  }

  function restoreState(state) {
    // Restore visibility only if session says visible
    // Do NOT regenerate projection (refresh handles that)
    // Do NOT create history
    if (state && state.visible) {
      const container = document.getElementById(CONTAINER_ID);
      if (container) {
        showContainer(container);
      }
      document.documentElement.classList.add('workspace-index-active');
    }
  }

  // ---- Registration ----

  function buildDescriptor() {
    return Object.freeze({
      id: HOST_ID,
      title: HOST_TITLE,
      activate,
      deactivate,
      refresh,
      detach,
      getState,
      restoreState,
    });
  }

  async function registerWorkspaceIndex() {
    if (registered) return null;
    const host = getHost();
    if (!host) return null;

    try {
      const descriptor = buildDescriptor();
      host.register(descriptor);
      registered = true;
      safeLog('WorkspaceIndex: registered=true totalWorkspaces=2');
      return true;
    } catch (e) {
      safeLog(`WorkspaceIndex: registration failed: ${e?.message || e}`);
      return null;
    }
  }

  // ---- Diagnostics (Correction M) ----

  function reportDiagnostic() {
    if (diagnosticReported) return;
    if (typeof globalThis.MME_APP?.log !== 'function') return;

    const host = getHost();
    if (!host) return;

    const activeId = host.getActiveId();
    const registeredList = host.list();
    const indexReady = Boolean(globalThis.WORKSPACE_INDEX_STATE?.ready);

    globalThis.MME_APP.log(
      `WorkspaceIndex: registered=true totalWorkspaces=${registeredList.length} active=${activeId || '(none)'} indexReady=${indexReady}`
    );

    diagnosticReported = true;
  }

  // ---- Self-registration ----

  const regResult = registerWorkspaceIndex();
  if (regResult) {
    if (typeof globalThis.MME_APP === 'object') {
      reportDiagnostic();
    } else {
      window.addEventListener('mme-main-ready', reportDiagnostic, { once: true });
    }
  }
})(globalThis);