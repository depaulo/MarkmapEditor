// @ts-nocheck
// ================================
// Help topic registry — ALL user-facing Help copy.
// Every visible Help string lives in this single reviewable file.
// Panel and page code store only topic IDs and never duplicate Help text.
// openHelpTopic(topicId) is owned by js/ui/help.js.
// ================================
(function () {
  'use strict';

  function t(strings) { return strings.raw.join(''); }

  var TOPICS = [
    {
      id: 'mode-editor',
      title: 'Markdown Editor Reference',
      subtitle: 'Markdown syntax, mindmap structure, preview, images, tasks, links, code, and tables.',
      html: t`<section class="helpSection">
  <h2>Getting Started</h2>
  <ol>
    <li>Open or create a Markdown file.</li>
    <li>Edit Markdown in the Editor pane.</li>
    <li>Use Markmap to navigate document structure.</li>
    <li>Open HTML Preview for rendered output.</li>
    <li>Save the current file or use Save As when necessary.</li>
  </ol>
</section>
<section class="helpSection">
  <h2>Markdown Basics</h2>
  <p>Write Markdown on the left; the interactive mindmap renders on the right. Headings become map branches.</p>
  <code class="helpCode"># Title

## Section

**bold**, *italic*, and \`inline code\`

- bullet item
- bullet item

1. numbered item
2. numbered item

- [ ] open Task
- [x] completed Task

[[Workspace Page]]</code>
</section>
<section class="helpSection">
  <h2>Source and derived views</h2>
  <ul>
    <li>Editor Markdown is the canonical source.</li>
    <li>Markmap is a derived structural view.</li>
    <li>HTML Preview is a derived rendered view.</li>
    <li>Edit Markdown to change the document.</li>
  </ul>
</section>
<section class="helpSection">
  <h2>File behavior</h2>
  <ul>
    <li>Save overwrites the active writable file.</li>
    <li>Save As is used when no writable handle exists.</li>
    <li>Cancel leaves the document unchanged.</li>
    <li>Auto-save drafts support recovery but do not replace physical Save.</li>
  </ul>
</section>
<section class="helpSection">
  <h2>Preview and Export</h2>
  <p>Toggle HTML Preview for cleaner reading. Use Export for Markdown, HTML Preview, or Mindmap SVG depending on mode.</p>
</section>
<section class="helpSection">
  <h2>Mode selector</h2>
  <p>Switch Editor / Journal / Slides from the toolbar at any time; each mode keeps its own unsaved state.</p>
</section>`,
    },
    {
      id: 'mode-journal',
      title: 'Journal Workspace Reference',
      subtitle: 'Open a local workspace for journals, concepts, search, and daily workflow.',
      html: t`<section class="helpSection">
  <h2>Open a workspace</h2>
  <p>Open Workspace grants the app access to a local folder the first time.</p>
</section>
<section class="helpSection">
  <h2>Today</h2>
  <p>Opens (or creates) today's journal entry.</p>
</section>
<section class="helpSection">
  <h2>Journals</h2>
  <p>Date-based Markdown notes for daily use.</p>
  <code class="helpCode"># 2026-09-11

## Notes

- Customer discussion
- Pricing follow-up

## Tasks

- [ ] Confirm the next meeting</code>
</section>
<section class="helpSection">
  <h2>Concepts</h2>
  <p>Persistent knowledge pages with links between notes.</p>
  <code class="helpCode">## Related Pages

- [[Customer Name]]
- [[Project Name]]</code>
</section>
<section class="helpSection">
  <h2>Search</h2>
  <p>Find text across workspace files.</p>
</section>
<section class="helpSection">
  <h2>Active file</h2>
  <p>Shows the currently open file and its state.</p>
</section>
<section class="helpSection">
  <h2>Related</h2>
  <p>Backlinks and related entries for the active note.</p>
  <button type="button" class="helpTopicLink" data-help-topic="journal-links">Related and Wiki Links</button>
</section>
<section class="helpSection">
  <h2>Open Tasks</h2>
  <p>Open tasks across the workspace; click to open the source.</p>
  <button type="button" class="helpTopicLink" data-help-topic="journal-tasks">Tasks</button>
</section>
<section class="helpSection">
  <h2>Tags</h2>
  <p>Tags are supported metadata on notes, surfaced in the workspace index so notes can be grouped and found.</p>
</section>
<section class="helpSection">
  <h2>Workspace Index</h2>
  <p>A read-only index the app builds from your files to power Search, Related, Open Tasks, and Tags. You do not maintain it by hand.</p>
</section>
<section class="helpSection">
  <h2>Projects</h2>
  <p>Projects parsed from workspace content, grouped by expected order.</p>
  <button type="button" class="helpTopicLink" data-help-topic="journal-projects">Projects</button>
</section>
<section class="helpSection">
  <h2>Reports</h2>
  <p>Generate structured Reports from the workspace.</p>
  <button type="button" class="helpTopicLink" data-help-topic="journal-reports">Reports</button>
</section>
<section class="helpSection">
  <h2>Archive</h2>
  <p>Archive keeps managed workspace records; prefer archive over deleting them.</p>
</section>
<section class="helpSection">
  <h2>Mode selector</h2>
  <p>Return to Editor or Slides from the toolbar.</p>
</section>`,
    },
    {
      id: 'mode-slides',
      title: 'Pandoc / Slides Reference',
      subtitle: 'Pandoc-compatible Markdown, slide blocks, notes, layouts, images, and export source.',
      html: t`<section class="helpSection">
  <h2>Slides Mode</h2>
  <p>Write presentation-oriented Markdown; use Export Slides Markdown to produce a .md source for an external Pandoc workflow.</p>
</section>
<section class="helpSection">
  <h2>Slide Delimiters</h2>
  <p>Use Pandoc slide separators between slides.</p>
</section>
<section class="helpSection">
  <h2>Speaker Notes</h2>
  <p>Author notes that are preserved in the exported Markdown.</p>
</section>
<section class="helpSection">
  <h2>Blocks and Columns</h2>
  <p>Use Pandoc fenced blocks and columns for multi-column layouts.</p>
  <code class="helpCode">:::: {.columns}
::: {.column}
## Left
- Point 1
:::
::: {.column}
## Right
- Point A
:::</code>
</section>
<section class="helpSection">
  <h2>Images</h2>
  <p>In a workspace, store images in assets/images and reference them from slide Markdown.</p>
  <code class="helpCode">../assets/images/market-opportunity.png</code>
</section>
<section class="helpSection">
  <h2>Tables</h2>
  <p>Use Markdown tables for comparison or risk slides.</p>
  <code class="helpCode">| Criteria | Option A | Option B |
|---|---|---|
| Cost | Low | Medium |
| Impact | Medium | High |</code>
</section>
<section class="helpSection">
  <h2>Common Slide Templates</h2>
  <ul>
    <li>Title Slide — Title + Subtitle</li>
    <li>Agenda — Bullet List</li>
    <li>Executive Summary — Key Points</li>
    <li>Growth Strategy — Two Columns</li>
    <li>Market Opportunity — Image + Text</li>
    <li>Product Roadmap — Text + Image</li>
    <li>Strategic Options — Three Columns</li>
    <li>Revenue Growth Potential — KPI</li>
    <li>Option Comparison — Table</li>
    <li>Next Steps — Action List</li>
  </ul>
</section>
<section class="helpSection">
  <h2>Export Workflow</h2>
  <p>Use Export Slides Markdown (.md). Then pass the exported Markdown file to your external Pandoc workflow.</p>
  <code class="helpCode">pandoc slides.md -o output.pptx --reference-doc=PandocTemplateV4.pptx</code>
</section>`,
    },
    {
      id: 'journal-reports',
      title: 'Reports',
      subtitle: 'Generate a structured Report from the workspace, then reconcile it into a Draw.io visual.',
      html: t`<section class="helpSection">
  <h2>Purpose</h2>
  <p>Build a Markdown Report over a date range from completed Tasks and parsed Projects, add Report Notes, then optionally reconcile it into a Draw.io template.</p>
</section>
<section class="helpSection">
  <h2>Period</h2>
  <p>Set From and To dates (YYYY-MM-DD). The range must be valid and not reversed.</p>
</section>
<section class="helpSection">
  <h2>Projects scope</h2>
  <p>Choose All Projects, With value, or Without value.</p>
</section>
<section class="helpSection">
  <h2>Sections</h2>
  <p>Enable and reorder sections: Summary &amp; Highlights, Completed Tasks, Project Forecast, Forecast Totals, Risks and Attention Points, Next Steps, Completed Tasks Without Date (off by default).</p>
</section>
<section class="helpSection">
  <h2>Inline Notes</h2>
  <p>A single-line field uses one token line.</p>
  <code class="helpCode">{{summary}}: Supplier qualification progressed.</code>
</section>
<section class="helpSection">
  <h2>Multiline Notes</h2>
  <p>A multiline field opens on the token line and closes with the closing token.</p>
  <code class="helpCode">{{summary}}:
**Brazil remains the priority market.**

This period focused on:

- supplier qualification
- installation planning
{{/summary}}</code>
</section>
<section class="helpSection">
  <h2>Standard vs custom fields</h2>
  <p>Standard fields (title, summary, highlights, risks, next steps, management notes) render into their standard sections. Any other field is a custom field.</p>
</section>
<section class="helpSection">
  <h2>Custom fields and reconciliation</h2>
  <p>Custom fields preserve their identifiers under ## Template Fields so they flow into Draw.io reconciliation instead of being discarded.</p>
</section>
<section class="helpSection">
  <h2>Blank fields ignored</h2>
  <p>Only the fields you complete are used.</p>
</section>
<section class="helpSection">
  <h2>Invalid field structure</h2>
  <p>A Notes entry with an invalid or unclosed field structure blocks generation and is reported, so no text is silently lost.</p>
</section>
<section class="helpSection">
  <h2>Summary &amp; Highlights</h2>
  <p>The single section renders both a Summary and a Highlights block; if neither is supplied it shows _No summary or highlights provided._.</p>
</section>
<section class="helpSection">
  <h2>Generated Markdown</h2>
  <p>The Report is produced in the editor as a fresh virtual, unsaved document with a suggested filename <start>-to-<end>-quick-report.md.</p>
</section>
<section class="helpSection">
  <h2>Generate New Report</h2>
  <p>Always creates a fresh virtual Report from the current configuration; it never silently overwrites reviewed Markdown. If a Report is active, the coordinated Save / Discard / Cancel decision runs first.</p>
</section>
<section class="helpSection">
  <h2>Save / Discard / Cancel</h2>
  <p>Leaving or replacing an unsaved Report presents a single coordinated decision: save it, discard it, or cancel and return with no change. No change is made until you confirm.</p>
</section>
<section class="helpSection">
  <h2>Draw.io reconciliation</h2>
  <p>UI path: Journal → Reports → Generate Report → Reconcile Draw.io Template → Choose Template → Generate Draw.io → Save As.</p>
</section>
<section class="helpSection">
  <h2>Template setup</h2>
  <p>In Draw.io, enable Formatted Text and Word Wrap on cells that should accept formatted Report content. These options normally correspond to html=1 and whiteSpace=wrap in the cell style. Configure the template once and reuse it. MarkmapEditor does not add html=1 or change template styles automatically.</p>
</section>
<section class="helpSection">
  <h2>Formatted content</h2>
  <p>A cell whose style already contains the exact html=1 token can receive a safe Markdown-derived fragment when the field value has a supported structure. Every other occurrence keeps the plain path. Simple values remain plain text, even in a cell that supports formatted content; Markdown conversion is used only when supported formatting or structure is present.</p>
</section>
<section class="helpSection">
  <h2>Supported formatting</h2>
  <p>Paragraphs (multi-line), hard line breaks (two or more trailing spaces), <strong>bold</strong>, <em>italic</em> / _italic_, and bullet or numbered lists. Only div, br, strong, em, ul, ol, li are emitted.</p>
</section>
<section class="helpSection">
  <h2>Unsupported plain fallback</h2>
  <p>Raw HTML, backtick code, headings, blockquotes, task checkboxes, tables, images, links, indented/nested lines, and escaped markers cause the whole field to fall back to plain escaped text.</p>
</section>
<section class="helpSection">
  <h2>Partial generation</h2>
  <p>Unresolved placeholders remain visible in partial output as long as at least one matched field has a value.</p>
</section>`,
    },
    {
      id: 'journal-projects',
      title: 'Projects',
      subtitle: 'An aggregated view of Projects currently parsed from the workspace.',
      html: t`<section class="helpSection">
  <h2>Read-only in this release</h2>
  <p>The Projects panel shows Projects already present in workspace content. There is no Project editor in this release.</p>
</section>
<section class="helpSection">
  <h2>What is shown</h2>
  <p>Each Project shows its name, value with currency (or · no currency), expected order, status, and its source file · line.</p>
</section>
<section class="helpSection">
  <h2>Grouping</h2>
  <p>Projects are grouped by Expected Order year (ascending), with unscheduled Projects last; within a year they sort by order, then name.</p>
</section>
<section class="helpSection">
  <h2>Open source</h2>
  <p>Click a Project to open the source file at that line.</p>
</section>
<section class="helpSection">
  <h2>Empty / not-ready states</h2>
  <p>Open a workspace first, Index not ready, No Projects found.</p>
</section>
<section class="helpSection">
  <h2>Not permanent</h2>
  <p>Project parsing and editing are under active development; this view reflects the current reading of workspace content and may change.</p>
</section>`,
    },
    {
      id: 'journal-tasks',
      title: 'Tasks',
      subtitle: 'Track tasks across the workspace.',
      html: t`<section class="helpSection">
  <h2>Task syntax</h2>
  <p>Mark a task open or completed:</p>
  <code class="helpCode">- [ ] Open Task
- [x] Completed Task</code>
</section>
<section class="helpSection">
  <h2>Optional managed metadata</h2>
  <p>A small amount of optional metadata may be stored beside a Task (for example a due date or priority). It is managed by the app and normally does not need manual editing.</p>
</section>
<section class="helpSection">
  <h2>Open Tasks panel</h2>
  <p>Lists open tasks grouped by source file; each row shows the task text and line, and clicking opens the source.</p>
</section>
<section class="helpSection">
  <h2>Task Board</h2>
  <p>A visual board with lifecycle columns and priority filtering. Invalid metadata values are ignored rather than promoted.</p>
</section>`,
    },
    {
      id: 'journal-links',
      title: 'Related and Wiki Links',
      subtitle: 'Backlinks and related entries for the active note.',
      html: t`<section class="helpSection">
  <h2>Related panel</h2>
  <p>Shows related entries and backlinks for the active note; badge shows N related. Empty / not-ready states include "No active note".</p>
</section>
<section class="helpSection">
  <h2>Wiki Links</h2>
  <p>Link between workspace documents with double-bracket syntax:</p>
  <code class="helpCode">[[Target]]</code>
  <p>or with a display label:</p>
  <code class="helpCode">[[Target|label]]</code>
</section>
<section class="helpSection">
  <h2>Opening</h2>
  <p>Clicking a Wiki Link opens the target through the workspace. A target that resolves to exactly one file opens it. Multiple matches show "Multiple files match <target>". A missing target shows "Wiki link target not found: <target>".</p>
</section>`,
    },
  ];

  // Expose the topic registry.
  (function () {
    try {
      globalThis.MME_HELP_TOPICS = Object.freeze(TOPICS);
      window.MME_HELP_TOPICS = Object.freeze(TOPICS);
    } catch {}
  })();
})();
