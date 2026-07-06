import { WORKSPACE_STATE } from './workspace-state.js';

function normalizeWorkspacePathForCompare(value) {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '');
}

function normalizeWorkspaceKindForCompareLocal(value) {
  const kind = String(value || '').trim().toLowerCase();

  if (kind === 'journal') return 'journals';
  if (kind === 'journals') return 'journals';
  if (kind === 'concept') return 'concepts';
  if (kind === 'concepts') return 'concepts';

  return kind;
}

function isSameWorkspaceFileButton(btn, active) {
  if (!btn || !active) return false;

  const btnKind = normalizeWorkspaceKindForCompareLocal(btn.dataset.kind || '');
  const btnPath = normalizeWorkspacePathForCompare(btn.dataset.path || '');
  const btnName = String(btn.dataset.name || '').trim();

  const activeKind = normalizeWorkspaceKindForCompareLocal(active.kind || '');
  const activePath = normalizeWorkspacePathForCompare(active.path || '');
  const activeName = String(active.name || '').trim();

  /*
    Prefer exact path match first.
    If path matches, allow kind normalization to handle journal/journals and concept/concepts.
  */
  if (btnPath && activePath && btnPath === activePath) {
    if (!btnKind || !activeKind) return true;
    return btnKind === activeKind;
  }

  /*
    Then fall back to kind + name.
  */
  if (btnKind && activeKind && btnKind !== activeKind) {
    return false;
  }

  if (btnName && activeName && btnName === activeName) {
    return true;
  }

  return false;
}

function updateWorkspaceActiveFileHighlight() {
  try {
    const active =
      WORKSPACE_STATE?.activeFile ||
      globalThis.WORKSPACE_STATE?.activeFile ||
      null;


    const activeKind = normalizeWorkspaceKindForCompareLocal(active?.kind || '');
    const activePath = normalizeWorkspacePathForCompare(active?.path || '');
    const activeName = String(active?.name || '').trim();

    let total = 0;
    let matched = 0;

    document
      .querySelectorAll('.workspaceFileItem[data-workspace-file="1"]')
      .forEach((btnEl) => {
        const btn = /** @type {HTMLElement} */ (btnEl);

        total += 1;

        const isActive = isSameWorkspaceFileButton(btn, active);


        if (isActive) matched += 1;

        btn.classList.toggle('__active', isActive);

        if (isActive) {
          (btn.dataset || (btnEl.dataset = btnEl.dataset)).active = '1';
          btn.setAttribute('aria-current', 'true');
        } else {
          delete (btn.dataset || (btnEl.dataset = btnEl.dataset)).active;
          btn.removeAttribute('aria-current');
        }

      });

    globalThis.log?.(
      `Workspace: highlight updated active=${
        activePath || activeName || '(none)'
      } kind=${activeKind || '(none)'} matched=${matched}/${total}`
    );

    if (active && total > 0 && matched === 0) {
      globalThis.log?.(
        `Workspace: highlight active debug kind=${activeKind} path=${activePath} name=${activeName}`
      );

      document
        .querySelectorAll('.workspaceFileItem[data-workspace-file="1"]')
        .forEach((btn) => {
          globalThis.log?.(
            `Workspace: highlight miss btn kind=${normalizeWorkspaceKindForCompareLocal(
              btn.dataset.kind || ''
            )} path=${normalizeWorkspacePathForCompare(
              btn.dataset.path || ''
            )} name=${btn.dataset.name || ''}`
          );
        });
    }
  } catch (e) {
    globalThis.log?.(
      `Workspace: active highlight update failed: ${e?.message || e}`
    );
  }
}

try {
  window.updateWorkspaceActiveFileHighlight = updateWorkspaceActiveFileHighlight;
  globalThis.updateWorkspaceActiveFileHighlight = updateWorkspaceActiveFileHighlight;
  window.normalizeWorkspacePathForCompare = normalizeWorkspacePathForCompare;
  globalThis.normalizeWorkspacePathForCompare = normalizeWorkspacePathForCompare;
} catch {}

globalThis.log?.(
  `Workspace: active highlight function ready = ${
    typeof window.updateWorkspaceActiveFileHighlight === 'function'
  }`
);

export {
  normalizeWorkspacePathForCompare,
  isSameWorkspaceFileButton,
  updateWorkspaceActiveFileHighlight,
};

