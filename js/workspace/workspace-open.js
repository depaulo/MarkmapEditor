export async function openWorkspaceDirectory() {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('Directory picker is not supported in this browser.');
  }

  const handle = await window.showDirectoryPicker({
    mode: 'readwrite',
  });

  return handle;
}

export async function ensureSubfolder(dirHandle, name) {
  let folderHandle = null;

  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'directory' && entry.name === name) {
      folderHandle = entry;
      break;
    }
  }

  if (!folderHandle) {
    folderHandle = await dirHandle.getDirectoryHandle(name, { create: true });
  }

  return folderHandle;
}
