// @ts-check

export function createWorkspaceActions({
  onOpenWorkspace,
  onToday,
  onNewConcept,
}) {
  const btnOpenWorkspace = document.getElementById('btnOpenWorkspace');
  const btnJournalToday = document.getElementById('btnJournalToday');
  const btnNewConcept = document.getElementById('btnNewConcept');

  // ACT V0 — this global Workspace action area is now exactly Open Workspace,
  // Today and New Note. The former "Archive Active" entry is not re-bound here:
  // Archive/Restore is owned solely by the Active panel action row
  // (renderWorkspaceActiveNoteActions in js/main.js), which reuses the single
  // metadata writer. No second Archive/Restore control or click lifecycle is
  // created by this module.

  function bindOnce(btn, name, handler) {
    if (!btn) {
      globalThis.MME_APP?.log?.(`Workspace: missing button ${name}`);
      return;
    }

    if (btn.__workspaceBound) {
      globalThis.MME_APP?.log?.(`Workspace: ${name} already bound`);
      return;
    }

    btn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (btn.disabled) {
        globalThis.MME_APP?.log?.(`Workspace: ${name} disabled click ignored`);
        return;
      }

      try {
        globalThis.MME_APP?.log?.(`Workspace: ${name} clicked`);

        if (typeof handler !== 'function') {
          throw new Error(`${name} handler missing`);
        }

        await handler();
      } catch (e) {
        const msg = e?.message || String(e);
        globalThis.MME_APP?.log?.(`Workspace: ${name} failed: ${msg}`);
        globalThis.MME_APP?.showToast?.(`${name} failed: ${msg}`, 'error', 3500);
      }
    });

    btn.__workspaceBound = true;
    globalThis.MME_APP?.log?.(`Workspace: ${name} bound`);
  }

  bindOnce(btnOpenWorkspace, 'Open Workspace', onOpenWorkspace);
  bindOnce(btnJournalToday, 'Today', onToday);
  bindOnce(btnNewConcept, 'New Concept', onNewConcept);
}

