export function isMarkdownFile(entry) {
  if (entry.kind !== 'file') return false;
  const name = entry.name.toLowerCase();
  return name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt');
}

export async function scanFolder(dirHandle) {
  const files = [];

  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      if (isMarkdownFile(entry)) {
        files.push(entry);
      }
    }
  }

  return files;
}
