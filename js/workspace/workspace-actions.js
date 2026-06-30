export function createWorkspaceActions({ onOpenWorkspace, onToday }) {
  const btnOpenWorkspace = document.getElementById('btnOpenWorkspace');
  const btnJournalToday = document.getElementById('btnJournalToday');

  if (btnOpenWorkspace) {
    btnOpenWorkspace.addEventListener('click', onOpenWorkspace);
  }

  if (btnJournalToday) {
    btnJournalToday.addEventListener('click', onToday);
  }
}
