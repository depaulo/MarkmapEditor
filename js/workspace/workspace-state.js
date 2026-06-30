export const WORKSPACE_STATE = {
  rootHandle: null,
  rootName: '',
  folders: {
    journals: null,
    concepts: null,
    assets: null,
    archive: null,
    system: null,
  },
  files: {
    journals: [],
    concepts: [],
  },
  activeFile: null,
};

export function isWorkspaceReady(state) {
  return Boolean(state.rootHandle);
}
