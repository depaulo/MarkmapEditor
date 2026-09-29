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
- [ ] Create or update a related Note.
- [ ] Review open follow-ups.
- Task Review and the Task Board read the same Task data.
- In the Task Board, set priority from the selector on each card:
  -- (no priority), P1, P2 or P3.
- Priority is saved as a visible #p1, #p2 or #p3 token on the Task line.
- Older Tasks using the previous priority metadata are still read, and are
  converted the first time you change their priority.
- Changing only priority never changes a lifecycle date.
- If two Tasks share the same text, the exact Task you are editing changes and
  the other is left alone.

## Wiki Links
- [[Note]] links one Note to another.
- [[Note|custom text]] shows different text but still opens Note.
- A link never spans a line break, and the target cannot contain brackets.
- Cross-file resolution uses the SAVED Workspace Index, so Save after renaming
  or retitling a Note.

### How a link target is resolved
- An exact path or filename wins first, then a Note's saved H1 heading.
- A filename always takes precedence over a matching H1, so a link never
  silently picks a different Note than you meant.
- A Note may be found by its H1, but opening it always uses its exact file path.
- H1 is a visual identity: two Notes may share one H1.

### Link states
- Resolved: the target was found and can be opened.
- Missing: nothing matched. No file is created and nothing is opened.
- Ambiguous: more than one Note matched. Nothing is opened, because choosing for
  you would be a guess.
- Not ready: the saved Workspace Index is not available yet, which is different
  from the target being missing.

## Links In and Links Out
- Links Out are the Wiki Links the current Note declares. While you are editing,
  they follow your unsaved text.
- Links In are the saved Notes whose resolved outgoing links point at the active
  Note. A Note linked by its H1 is included.
- Repeated links from one Note produce a single Links In row.
- Links In needs the saved Workspace Index. Before that, the panel says it is
  unavailable rather than reporting none.
- In the Sidebar, the Links In panel shows the count and the source Notes.
  A confirmed empty result shows 0 and "No Links In."; an unavailable one is
  shown differently.
- Selecting a Links In entry opens that exact source Note.

## Not in this release
- Compact Active and Workspace Index relationship cards are planned for a later
  visual-consistency release. For now, the Links In Sidebar panel is the
  relationship view.
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
