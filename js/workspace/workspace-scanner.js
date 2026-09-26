import { NOTES_DIRECTORY_NAME } from './workspace-open.js';

export function isMarkdownFile(entry) {
  if (entry.kind !== 'file') return false;
  const name = entry.name.toLowerCase();
  return name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.txt');
}

// ACT 2B — RETAINED LEGACY. scanFolder() is the retired flat-folder scanner
// (journals/ concepts/ assets/ archive/ system/). The notes/ storage scanner
// below is the only live owner. Kept because the dead legacy activation sequence
// in workspace-controller.js still references it; removal happens with that
// sequence in the Sidebar cleanup after the post-2C structural checkpoint.
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

// ============================================================
// ACT 1B — notes/ storage scanner (strict, read-only)
// ============================================================
//
// The scanner answers exactly one question: which direct entries of `notes/`
// are Notes? It is the only owner that turns directory entries into storage
// records, and it performs discovery only:
//   - no getDirectoryHandle() / getFileHandle() (no handle requests at all),
//   - no createWritable(), no create/rename/removeEntry(),
//   - no getFile(): file content is never read here (the ACT 1C parser owns
//     content),
//   - no metadata, tags, dates, tasks, projects, links or metrics.
//
// Records are physical discovery fields only, so ACT 1C can build the single
// Workspace Index from them without this module owning any interpretation:
//
//   { kind: 'notes', name, path: `notes/${name}`, handle }
//
// `isMarkdownFile`/`scanFolder` above remain the legacy journal-model scanner
// used by the retired Journals/Concepts sidebar path. They are dead in ACT 1B
// (the legacy sidebar scan is never reached) and are removed with the legacy
// Workspace UI in a later ACT. They are deliberately NOT reused here: their
// extension contract (.md/.markdown/.txt) is wider than the notes/ contract.

// Notes are Markdown files only. The extension comparison is case-insensitive,
// so `note.md`, `Note.MD` and `NOTE.Md` are all eligible, while `.markdown`,
// `.txt`, images, Draw.io files and every other extension are ignored.
export const NOTES_FILE_EXTENSION = '.md';

export function isEligibleNoteEntry(entry) {
  if (!entry || entry.kind !== 'file') return false;

  const name = String(entry.name || '');
  if (!name) return false;

  return name.toLowerCase().endsWith(NOTES_FILE_EXTENSION);
}

// Smallest existing file-order contract in the codebase: ascending name order
// (the same comparator the retired Concepts list used). No date, timeline or
// metadata ordering is introduced here.
export function compareNoteStorageRecords(a, b) {
  return String(a?.name || '').localeCompare(String(b?.name || ''));
}

export function buildNoteStorageRecord(entry) {
  const name = String(entry.name || '');

  return {
    kind: 'notes',
    name,
    path: `${NOTES_DIRECTORY_NAME}/${name}`,
    handle: entry,
  };
}

// Single read pass over the direct contents of notes/. Throws for an unusable
// handle or a failed iteration, so the caller can preserve the previously
// active Workspace instead of activating a partial scan.
export async function scanNotesFolder(notesHandle) {
  if (!notesHandle || typeof notesHandle.values !== 'function') {
    throw new Error('notes/ handle does not expose directory iteration');
  }

  const records = [];

  for await (const entry of notesHandle.values()) {
    if (!isEligibleNoteEntry(entry)) continue;

    records.push(buildNoteStorageRecord(entry));
  }

  records.sort(compareNoteStorageRecords);

  return records;
}
