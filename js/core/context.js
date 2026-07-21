// @ts-check
// App context foundation:
//   1. MarkMapEditor
//   2. MarkMapJournal
//   3. MarkMapSlides

export const APP_CONTEXT_STORAGE_KEY = 'markmap:appContext';

function getTodayDateStringForStarter() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function buildSlidesStarterMarkdown() {
  const date = getTodayDateStringForStarter();
  return `---
title: "First Pandoc Deck"
author: "Markmap Editor"
date: "${date}"

---

# Title Slide

<!-- Target PPT layout: Title Slide -->
<!-- Source layout: title -->

- First slide generated from Markdown.
- Use this as a quick export test.
- Edit the title, author, and date in the frontmatter.

---

# Agenda

<!-- Target PPT layout: Title and Content -->
<!-- Source layout: content -->

- Context
- Key points
- Decisions
- Next steps

---

# Key Message

<!-- Target PPT layout: Title and Content -->
<!-- Source layout: content -->

- Use bullets for slide content.
- Bullets also render clearly in Markmap.
- Layout comments guide the slide export workflow.

---

# Example Data Slide

<!-- Target PPT layout: Title and Content -->
<!-- Source layout: content -->

- Metric one increased.
- Metric two needs attention.
- Main takeaway should be short and clear.

---

# Next Steps

<!-- Target PPT layout: Title and Content -->
<!-- Source layout: content -->

- Edit this starter deck.
- Export Slides Markdown.
- Process with the Pandoc pipeline.
- Review the generated presentation.
`;
}

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
    defaultMarkdown: `# Markmap Editor

## What this mode is for
- Create quick Markdown mindmaps.
- Edit Markdown on the left.
- Explore the interactive Markmap on the right.
- Use this mode for scratch maps, notes, outlines, and structured thinking.

## Basic Markdown
- Use headings for major branches.
- Use bullets for child ideas.
- Indent bullets to create hierarchy.
- Click nodes in the map to navigate.

## Useful Actions
- Open and Save Markdown files.
- Export SVG.
- Export HTML Preview.
- Use templates to start faster.
- Hide the editor when you want more map space.

## Try This
- Add a new heading.
- Add nested bullets.
- Toggle the HTML Preview.
- Export the map as SVG or HTML.
`,
  },

  journal: {
    id: 'journal',
    label: 'MarkMap Journal',
    shortLabel: 'Journal',
    templateLabel: 'MMJ Templates',
    defaultFileName: 'journal-workspace.md',
    showWorkspace: true,
    showJournalControls: true,
    showPandocTools: false,
    defaultMarkdown: `# Journal Workspace

## What this mode is for
- Daily Capture
- Concepts
- Tasks
- Tags
- Backlinks and related notes
- Local workspace-based knowledge management

## Daily Capture
- Use Today to open or create the daily journal.
- Keep one journal per day.
- Add notes, decisions, links, and tasks.
- Use the daily journal as the timeline of your work.

## Concepts
- Use concepts for persistent knowledge.
- Create concepts for customers, projects, opportunities, topics, and frameworks.
- Link journals to concepts with wiki-style links.
- Example:
  - [[CustomerDiscovery]]
  - [[OKFFramework]]

## Tags
- Use frontmatter tags for structured metadata.
- Example:
  - cala-capabilities
  - hk-tax
  - partner
- Body tags still work as a fallback:
  - Tags: #example-tag

## Tasks
- [ ] Capture today's main work.
- [ ] Create or update a related concept.
- [ ] Review open follow-ups.

## Related Notes
- Link related journals with [[2026-07-07]].
- Link concepts with [[CustomerDiscovery]].
- Use the Related panel to move between connected notes.
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
    defaultMarkdown: buildSlidesStarterMarkdown(),
  },

  report: {
    id: 'report',
    label: 'MarkMap Report',
    shortLabel: 'Report',
    templateLabel: 'Report Templates',
    defaultFileName: 'report.md',
    showWorkspace: false,
    showJournalControls: false,
    showPandocTools: false,
    showReportTools: true,
    defaultMarkdown: `# Project Report

## Highlights

### Alibaba

- Item 1
- Item 2

### ByteDance

- Item 1

### Tencent

- Item 1

## Projects

### Alibaba

#### Brasil

##### Brasil - Phase 1

Forecast: 1.2M

Period:
26Q2~27Q1

Comments:
Waiting contract

## Notes

- General comment 1
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
  } catch {
    // Ignore storage errors.
  }

  return ctx;
}

export function applyAppContextDataset(contextId) {
  const ctx = getAppContext(contextId);
  document.documentElement.dataset.appContext = ctx.id;
  return ctx;
}
