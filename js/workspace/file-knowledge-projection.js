/**
 * ACT 4 Slice 1 — Canonical File Knowledge Projection
 *
 * Pure, document-scoped derivation of the six File Knowledge cards for the
 * Current Document. Reuses existing owners only:
 *   - MME_TASK_LIFECYCLE (task status semantics: backlog/todo/ongoing/done;
 *     projectTasks projection)
 *   - MME_WIKI_LINKS (Links In / Links Out relationship providers)
 *
 * No DOM access, no file I/O, no mutation of source records. All functions are
 * pure projections over the saved Workspace Index and the live editor text.
 */

'use strict';

// ---------------------------------------------------------------------------
// Task projection — four status cards via the single Task lifecycle owner
// ---------------------------------------------------------------------------

/**
 * Project the four Task-status cards for the Current Document from the saved
 * Workspace Index, using MME_TASK_LIFECYCLE.projectTasks() with
 * scope='current-document' so Workspace tasks never leak into the document.
 *
 * @param {object} indexSnapshot   saved Workspace Index (WORKSPACE_INDEX_STATE)
 * @param {string} activeSourcePath exact physical path of the active note
 * @returns {{backlog: Array, open: Array, ongoing: Array, done: Array}}
 */
function projectFileKnowledgeTasks(indexSnapshot, activeSourcePath) {
  const lifecycle = globalThis.MME_TASK_LIFECYCLE;
  if (!lifecycle || typeof lifecycle.projectTasks !== 'function') {
    return { backlog: [], open: [], ongoing: [], done: [] };
  }

  const records = Array.isArray(indexSnapshot?.tasks) ? indexSnapshot.tasks : [];
  const path = String(activeSourcePath || '').trim();

  const project = (statusFilter) =>
    lifecycle.projectTasks(records, {
      scope: 'current-document',
      activeSourcePath: path,
      statusFilter,
      sort: 'source',
    });

  return {
    backlog: project('backlog'),
    // Open ≡ Todo: the File Knowledge "Open" card displays the single canonical
    // `todo` effective status. The lifecycle's 'open' filter means "all non-done"
    // (backlog + todo + ongoing), which would break the four mutually-exclusive
    // status cards contract. See docs/packages/P6-CONSISTENCY.md (ACT 4).
    open: project('todo'),
    ongoing: project('ongoing'),
    done: project('done'),
  };
}

// ---------------------------------------------------------------------------
// Links projection — Links In / Links Out via MME_WIKI_LINKS
// ---------------------------------------------------------------------------

/**
 * Project the Links In / Links Out cards for the Current Document.
 *
 * Links In: derived from the saved Workspace Index (authoritative for
 *   inbound relationships). Unavailable when the Index is not ready — never
 *   reported as zero when it is actually unavailable.
 * Links Out: derived from the live Current Document markdown text
 *   (source of truth for declarations). Unavailable when the wiki-link
 *   grammar is absent.
 *
 * @param {string} activeSourcePath exact physical path of the active note
 * @param {object} indexSnapshot   saved Workspace Index
 * @param {string} markdownText    live Current Document markdown (Links Out source of truth)
 * @param {string} sourceTitle     saved visual title, display only
 * @returns {{linksIn: {available, targetPath, rows, relationships},
 *            linksOut: {available, sourcePath, relationships}}}
 */
function getFileKnowledgeLinks(activeSourcePath, indexSnapshot, markdownText, sourceTitle) {
  const wikiLinks = globalThis.MME_WIKI_LINKS;
  if (
    !wikiLinks ||
    typeof wikiLinks.getLinksIn !== 'function' ||
    typeof wikiLinks.getLinksOut !== 'function'
  ) {
    return {
      linksIn: {
        available: false,
        targetPath: String(activeSourcePath || ''),
        rows: [],
        relationships: [],
      },
      linksOut: {
        available: false,
        sourcePath: String(activeSourcePath || ''),
        relationships: [],
      },
    };
  }

  const path = String(activeSourcePath || '').trim();
  const text = String(markdownText || '');

  const linksIn = wikiLinks.getLinksIn({ targetPath: path, indexSnapshot });
  const linksOut = wikiLinks.getLinksOut({
    markdown: text,
    sourcePath: path,
    sourceTitle: sourceTitle || '',
    indexSnapshot,
  });

  return { linksIn, linksOut };
}

// ---------------------------------------------------------------------------
// Combined projection — all six File Knowledge cards
// ---------------------------------------------------------------------------

/**
 * Combined projection: all six File Knowledge cards for the Current Document.
 *
 * @param {object} indexSnapshot   saved Workspace Index
 * @param {string} activeSourcePath exact physical path of the active note
 * @param {string} markdownText    live Current Document markdown
 * @param {string} sourceTitle     saved visual title, display only
 * @returns {{tasks: {backlog, open, ongoing, done}, links: {linksIn, linksOut}}}
 */
function projectFileKnowledge(indexSnapshot, activeSourcePath, markdownText, sourceTitle) {
  return {
    tasks: projectFileKnowledgeTasks(indexSnapshot, activeSourcePath),
    links: getFileKnowledgeLinks(activeSourcePath, indexSnapshot, markdownText, sourceTitle),
  };
}

// ---------------------------------------------------------------------------
// Publish for consumers and validators
// ---------------------------------------------------------------------------

try {
  globalThis.MME_FILE_KNOWLEDGE = {
    projectFileKnowledgeTasks,
    getFileKnowledgeLinks,
    projectFileKnowledge,
  };
  window.MME_FILE_KNOWLEDGE = globalThis.MME_FILE_KNOWLEDGE;
} catch {}