// @ts-check

export function clearSidebar() {
  const journalsList = document.getElementById('workspaceJournalsList');
  const conceptsList = document.getElementById('workspaceConceptsList');

  if (journalsList) journalsList.innerHTML = '<div class="workspaceEmpty">No journals</div>';
  if (conceptsList) conceptsList.innerHTML = '<div class="workspaceEmpty">No concepts</div>';
}

export function renderSidebarFiles(files, containerId) {
  const container = document.getElementById(containerId);

  if (!container) return;

  if (!files || files.length === 0) {
    container.innerHTML = '<div class="workspaceEmpty">No files</div>';
    return;
  }

  container.innerHTML = files
    .map((file) => {
      const name = escapeHtml(file.name || '');
      const path = escapeHtml(file.path || '');
      return `<button type="button" class="workspaceFileItem" data-path="${path}" data-name="${name}">${name}</button>`;
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
