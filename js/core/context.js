// @ts-nocheck
// App context foundation — future three-context app:
//   1. MarkMapEditor
//   2. MarkMapJournal
//   3. MarkMapSlides

export const APP_CONTEXT_STORAGE_KEY = 'markmap:appContext';

export const APP_CONTEXTS = {
  editor: {
    id: 'editor',
    label: 'MarkMap Editor',
    shortLabel: 'Editor',
    templateLabel: 'Templates',
    defaultFileName: 'mindmap.md',
    showWorkspace: false,
    showJournalControls: false,
    showPandocTools: false,
    defaultMarkdown: `# New Mindmap

### Ideas
- `,
  },

  journal: {
    id: 'journal',
    label: 'MarkMap Journal',
    shortLabel: 'Journal',
    templateLabel: 'MMJ Templates',
    defaultFileName: 'journal.md',
    showWorkspace: true,
    showJournalControls: true,
    showPandocTools: false,
    defaultMarkdown: `# Today

Tags:

## Capture
-

## Tasks
- [ ]

## Notes
`,
  },

  slides: {
    id: 'slides',
    label: 'MarkMap Slides',
    shortLabel: 'Slides',
    templateLabel: 'Pandoc Templates',
    defaultFileName: 'slides.md',
    showWorkspace: false,
    showJournalControls: false,
    showPandocTools: true,
    defaultMarkdown: `---
title: Presentation Title
author:
date:
---

# Title Slide

## Agenda
- Topic 1
- Topic 2
`,
  },
};

export function getAppContext(contextId) {
  return APP_CONTEXTS[contextId] || APP_CONTEXTS.editor;
}

export function getStoredAppContextId() {
  try {
    return localStorage.getItem(APP_CONTEXT_STORAGE_KEY) || 'editor';
  } catch {
    return 'editor';
  }
}

export function storeAppContextId(contextId) {
  const ctx = getAppContext(contextId);
  try {
    localStorage.setItem(APP_CONTEXT_STORAGE_KEY, ctx.id);
  } catch {}
  return ctx;
}

export function applyAppContextDataset(contextId) {
  const ctx = getAppContext(contextId);
  document.documentElement.dataset.appContext = ctx.id;
  return ctx;
}
