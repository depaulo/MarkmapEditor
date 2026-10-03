// @ts-nocheck
// ACT 5B-4 — Dedicated Projects route + container foundation.
//
// This is a THIRD registered Host workspace, separate from `journal` and from
// `workspace-index`. It is READ-ONLY foundation: it proves route isolation,
// record identity and lifecycle. The editable column interface is ACT 5C.
//
// It does NOT own: Project Markdown writes, Save, currentSaveHandle, the
// parser, the Workspace Index, or Report generation. All future edits go
// through the single pure owner MME_PROJECT_METADATA_MUTATION.
//
// It is NOT a new global application mode: Projects stays a focused
// Journal/Workspace experience reached through the Host.

(function initProjectsView(global) {
  'use strict';

  const HOST_ID = 'projects';
  const HOST_TITLE = 'Projects';
  const VIRTUAL_LOCATION_ID = 'mme://workspace/projects';
  const VIRTUAL_LOCATION_TYPE = 'virtual-projects';
  const CONTAINER_ID = 'projectsView';

  let registered = false;
  let refreshListenerBound = false;
  let previousWorkspace = null;

  function safeLog(message) {
    try {
      if (typeof globalThis.MME_APP?.log === 'function') globalThis.MME_APP.log(message);
    } catch {}
  }

  function getHost() {
    return typeof globalThis.MME_WORKSPACE_HOST === 'object' ? globalThis.MME_WORKSPACE_HOST : null;
  }

  function getWorkspaceState() {
    return globalThis.WORKSPACE_STATE || globalThis.window?.WORKSPACE_STATE || null;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---- Project records (read-only) ----------------------------------------

  function readProjects() {
    const state = globalThis.WORKSPACE_INDEX_STATE || globalThis.window?.WORKSPACE_INDEX_STATE;
    return Array.isArray(state?.projects) ? state.projects : [];
  }

  // ACT 5B-1/5B-2: one shared key + one shared order. Managed rows key by
  // projectId; Projects that have not been reconciled yet use the bounded
  // transitional key. The title is never identity.
  function decorate(project) {
    const utils = globalThis.MME_PROJECT_RECORD_UTILS;
    const key = utils
      ? utils.projectRecordKey(project)
      : project.projectId || `legacy:${project.sourcePath || ''}:${project.sourceLine || 0}`;
    return {
      key,
      managed: Boolean(project.projectId),
      name: project.name || '',
      value: project.value,
      currency: project.currency || '',
      order: project.expectedOrder?.valid ? project.expectedOrder.display : '',
      sourcePath: project.sourcePath || '',
      sourceLine: project.sourceLine || 0,
      sourceKind: project.sourceKind || '',
      sourceName: project.sourceName || '',
    };
  }

  function buildProjection() {
    const state = globalThis.WORKSPACE_INDEX_STATE || globalThis.window?.WORKSPACE_INDEX_STATE;
    if (!state || state.ready !== true) {
      return { html: renderEmpty('Loading Projects…'), count: 0, ready: false };
    }
    const ws = getWorkspaceState();
    if (!ws || !ws.activeWorkspace) {
      return { html: renderEmpty('No Workspace is open.'), count: 0, ready: true };
    }

    const utils = globalThis.MME_PROJECT_RECORD_UTILS;
    const ordered = utils ? utils.sortProjects(readProjects()) : readProjects();
    const rows = ordered.map(decorate);

    if (!rows.length) {
      return { html: renderEmpty('No Projects yet.'), count: 0, ready: true };
    }

    const items = rows
      .map((r) => {
        const valueText = Number.isFinite(r.value)
          ? escapeHtml((r.currency ? r.currency + ' ' : '') + Number(r.value).toLocaleString())
          : '—';
        const orderText = r.order ? escapeHtml(r.order) : 'Unscheduled';
        const sourceText = escapeHtml((r.sourceName || r.sourcePath || '—') + (r.sourceLine ? ':' + r.sourceLine : ''));
        return `
          <li class="projectsRow" data-projects-key="${escapeHtml(r.key)}" data-projects-managed="${r.managed ? 'true' : 'false'}">
            <span class="projectsRowName">${escapeHtml(r.name)}</span>
            <span class="projectsRowValue">${valueText}</span>
            <span class="projectsRowOrder">${orderText}</span>
            <button type="button" class="projectsRowSource" data-action="open-source"
              data-path="${escapeHtml(r.sourcePath)}" data-kind="${escapeHtml(r.sourceKind)}"
              data-line="${escapeHtml(String(r.sourceLine))}">${sourceText}</button>
          </li>`;
      })
      .join('');

    return {
      html: `
        <div class="projectsViewHead">
          <h2 class="projectsViewTitle">Projects</h2>
          <div class="projectsViewCount">${rows.length} Project${rows.length === 1 ? '' : 's'}</div>
        </div>
        <ul class="projectsList">${items}</ul>`,
      count: rows.length,
      ready: true,
    };
  }

  function renderEmpty(message) {
    return `<div class="projectsViewEmpty">${escapeHtml(message)}</div>`;
  }

  // ---- Container ownership ------------------------------------------------

  function ensureContainer() {
    let container = document.getElementById(CONTAINER_ID);
    if (container) return container;

    const layout = document.getElementById('layout');
    if (!layout) throw new Error('ProjectsView: #layout not found');

    container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.className = 'projectsView';
    container.hidden = true;
    container.setAttribute('aria-label', 'Projects');
    layout.appendChild(container);

    safeLog('ProjectsView: container created');
    return container;
  }

  function renderInto(container) {
    const projection = buildProjection();
    container.innerHTML = projection.html;
    container.insertAdjacentHTML(
      'afterbegin',
      `<div class="projectsReturnRow">
         <button type="button" data-action="return-to-workspace" class="projectsReturnAction">← Return to Workspace</button>
       </div>`
    );
    return projection;
  }

  function handleReturnToWorkspace() {
    const host = getHost();
    if (!host) return;
    host.switchTo('journal', { reason: 'projects return' }).catch((e) => {
      safeLog(`ProjectsView: return failed: ${e?.message || e}`);
    });
  }

  function findWorkspaceFileByPath(path, kind) {
    try {
      if (typeof globalThis.findWorkspaceFileByPath === 'function') {
        return globalThis.findWorkspaceFileByPath(path, kind);
      }
    } catch {}
    return null;
  }

  // Source navigation resolves the physical file BEFORE switching to Journal,
  // exactly like the Workspace Index. Read-only: it never writes.
  async function openProjectSource(path, kind, line) {
    const host = getHost();
    if (!host) return;
    const fileRecord = findWorkspaceFileByPath(path, kind);
    if (!fileRecord) {
      safeLog(`ProjectsView: source file not found path=${path} kind=${kind}`);
      globalThis.MME_APP?.showToast?.('File not found', 'warn', 2400);
      return;
    }
    try {
      await host.switchTo('journal', { reason: 'projects source navigation' });
      if (typeof globalThis.openWorkspaceFile === 'function') {
        const opened = await globalThis.openWorkspaceFile(fileRecord, {
          reason: 'projects source navigation',
          focusLine: Number(line) || 0,
        });
        if (opened && opened.cancelled) return;
      }
      safeLog(`ProjectsView: opening ${path} line=${line}`);
    } catch (e) {
      safeLog(`ProjectsView: source open failed: ${e?.message || e}`);
    }
  }

  function onActionClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.getAttribute('data-action');
    if (action === 'return-to-workspace') {
      event.preventDefault();
      handleReturnToWorkspace();
      return;
    }
    if (action === 'open-source') {
      event.preventDefault();
      openProjectSource(
        button.getAttribute('data-path'),
        button.getAttribute('data-kind'),
        Number(button.getAttribute('data-line')) || 0
      );
    }
  }

  // ---- Lifecycle ----------------------------------------------------------

  async function activate() {
    const host = getHost();
    previousWorkspace = host ? host.getActiveId() : null;

    let container;
    try {
      container = ensureContainer();
    } catch (e) {
      throw new Error(`ProjectsView.activate: container failed: ${e?.message || e}`);
    }

    if (!container.__projectsActionBound) {
      container.addEventListener('click', onActionClick);
      container.__projectsActionBound = true;
    }

    const projection = renderInto(container);

    // Show only as the final step.
    container.hidden = false;
    document.documentElement.classList.add('projects-view-active');

    if (typeof globalThis.MME_NAVIGATION === 'object') {
      globalThis.MME_NAVIGATION.recordSuccessfulNavigation({
        type: VIRTUAL_LOCATION_TYPE,
        id: VIRTUAL_LOCATION_ID,
      });
    }

    bindRefreshListener();

    return Object.freeze({ activated: true, projectCount: projection.count });
  }

  function deactivate() {
    const container = document.getElementById(CONTAINER_ID);
    if (container) container.hidden = true;
    document.documentElement.classList.remove('projects-view-active');
    return Object.freeze({ status: 'deactivated' });
  }

  function refresh() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return Object.freeze({ status: 'skipped', reason: 'no-container' });
    const projection = renderInto(container);
    return Object.freeze({ status: 'refreshed', projectCount: projection.count });
  }

  function detach() {
    return Object.freeze({ status: 'detached' });
  }

  function getState() {
    return Object.freeze({
      visible: Boolean(document.getElementById(CONTAINER_ID) && !document.getElementById(CONTAINER_ID).hidden),
      projectCount: readProjects().length,
      indexReady: Boolean(globalThis.WORKSPACE_INDEX_STATE?.ready),
    });
  }

  function restoreState(state) {
    if (!state || !state.visible) return;
    const container = document.getElementById(CONTAINER_ID);
    if (container) container.hidden = false;
    document.documentElement.classList.add('projects-view-active');
  }

  function onWorkspaceIndexReady() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container || container.hidden) return;
    renderInto(container);
  }

  function bindRefreshListener() {
    if (refreshListenerBound) return;
    window.addEventListener('mme-workspace-index-ready', onWorkspaceIndexReady);
    refreshListenerBound = true;
  }

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

  function registerProjectsView() {
    if (registered) return null;
    const host = getHost();
    if (!host) return null;
    try {
      host.register(buildDescriptor());
      registered = true;
      safeLog('ProjectsView: registered=true');
      return true;
    } catch (e) {
      safeLog(`ProjectsView: registration failed: ${e?.message || e}`);
      return null;
    }
  }

  globalThis.MME_PROJECTS_VIEW = Object.freeze({
    HOST_ID,
    HOST_TITLE,
    CONTAINER_ID,
    getDescriptor: buildDescriptor,
    register: registerProjectsView,
    isRegistered: () => registered,
    getPreviousWorkspace: () => previousWorkspace,
  });

  const regResult = registerProjectsView();
  if (regResult) safeLog('ProjectsView: ready');
})();
