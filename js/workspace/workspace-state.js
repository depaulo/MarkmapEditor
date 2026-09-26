// ============================================================
// Canonical Workspace storage state (ACT 1B)
// ============================================================
//
// ACT 1B storage model: a Workspace is a picked folder that contains a
// `notes/` directory (NOTES_DIRECTORY_NAME in workspace-open.js).
//
//   folders.notes — directory handle of `notes/`
//   files.notes   — read-only storage records for the direct `notes/*.md`
//                   entries (kind/name/path/handle, see workspace-scanner.js)
//
// ACT 1A detection outcomes that are rejected, failed or canceled never reach
// this object: the storage activation boundary (workspace-controller.js) only
// assigns these fields after detection AND scan have both succeeded.
//
// The legacy journal model fields (folders.journals, folders.concepts,
// folders.assets, folders.archive, folders.system, files.journals,
// files.concepts) are intentionally NOT present here after ACT 1B. They were
// removed rather than kept as compatibility aliases or transitional getters,
// because a parallel legacy state would keep the retired physical model alive
// as a second source of truth. Consumers of the legacy fields are adapted in
// a later ACT; ACT 1B performs no consumer adaptation.
export const WORKSPACE_STATE = {
  rootHandle: null,
  rootName: '',
  folders: {
    notes: null,
  },
  files: {
    notes: [],
  },
  activeFile: null,
};

export function isWorkspaceReady(state) {
  return Boolean(state.rootHandle);
}
