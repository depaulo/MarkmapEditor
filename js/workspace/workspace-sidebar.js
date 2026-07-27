// @ts-check

export function clearSidebar() {
  const journalsList = document.getElementById('workspaceJournalsList');
  const conceptsList = document.getElementById('workspaceConceptsList');

  if (journalsList) journalsList.innerHTML = '<div class="workspaceEmpty">No journals</div>';
  if (conceptsList) conceptsList.innerHTML = '<div class="workspaceEmpty">No concepts</div>';
}

export function renderSidebarFiles(files, containerId, kind = '') {

  const container = document.getElementById(containerId);

  if (!container) return;

  if (!files || files.length === 0) {
    container.innerHTML = '<div class="workspaceEmpty">No files</div>';
    return;
  }

  container.innerHTML = files
    .map((file) => {
      const name = escapeHtml(file.name || '');
      const path = escapeHtml(file.path || file.name || '');
      const fileKind = escapeHtml(kind || file.kind || '');

      const icon =
        fileKind === 'journals'
          ? '📝'
          : fileKind === 'concepts'
            ? '🧠'
            : '📄';

      return `
        <button
          type="button"
          class="workspaceFileItem"
          data-workspace-file="1"
          data-kind="${fileKind}"
          data-path="${path}"
          data-name="${name}"
          title="${path}"
        >
          <span class="workspaceFileIcon" aria-hidden="true">${icon}</span>
          <span class="workspaceFileName">${name}</span>
        </button>
      `;
    })
    .join('');
}

export function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderNavigationControls() {
  const existing = document.getElementById('workspaceNavControls');
  if (existing) return existing;

  const sidebar = document.getElementById('workspaceSidebar');
  if (!sidebar) return null;

  // Wrap existing sidebar content in a scrollable container.
  const scroller = document.createElement('div');
  scroller.className = 'workspaceNavScroller';
  scroller.setAttribute('data-nav-scroller', '1');

  while (sidebar.firstChild) {
    scroller.appendChild(sidebar.firstChild);
  }

  sidebar.appendChild(scroller);

  // Create navigation controls as a persistent footer.
  const container = document.createElement('div');
  container.id = 'workspaceNavControls';
  container.className = 'workspaceNavControls';
  container.innerHTML = `
    <button id="btnNavBack" class="navBtn" aria-label="Back" disabled title="Back">←</button>
    <button id="btnNavForward" class="navBtn" aria-label="Forward" disabled title="Forward">→</button>
  `;

  sidebar.appendChild(container);
  return container;
}

export function updateNavigationControls(state) {
  const back = document.getElementById('btnNavBack');
  const forward = document.getElementById('btnNavForward');
  if (back) back.disabled = !state.canBack;
  if (forward) forward.disabled = !state.canForward;
}