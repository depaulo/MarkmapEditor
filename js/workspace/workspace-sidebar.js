export function clearSidebar() {
  const journalsList = document.getElementById('workspaceJournalsList');
  const conceptsList = document.getElementById('workspaceConceptsList');

  if (journalsList) journalsList.innerHTML = '';
  if (conceptsList) conceptsList.innerHTML = '';
}

export function renderSidebarFiles(files, containerId) {
  const container = document.getElementById(containerId);

  if (!container) return;

  if (!files || files.length === 0) {
    container.innerHTML = '<div style="font-size: 12px; opacity: 0.5;">No files</div>';
    return;
  }

  container.innerHTML = files
    .map(
      (file) =>
        `<div class="workspaceFileItem" data-path="${file.path || ''}" data-name="${file.name || ''}">${escapeHtml(file.name || '')}</div>`
    )
    .join('');
}

export function escapeHtml(text) {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}
