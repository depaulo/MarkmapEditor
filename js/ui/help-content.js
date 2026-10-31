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
      id: 'journal-notes',
      title: 'Notes, Knowledge, Pinned and Archive',
      subtitle: 'The Notes Workspace format, its classifications, and how the views relate.',
      html: t`<section class="helpSection">
  <h2>Opening a Workspace</h2>
  <ul>
    <li>Choose the workspace <strong>root</strong> — the folder that contains <code>notes/</code>.</li>
    <li>Do not select the <code>notes/</code> folder itself. The app looks for <code>notes/</code> inside the folder you choose.</li>
    <li>A workspace that still uses the older <code>journals/</code> and <code>concepts/</code> folders is rejected rather than converted.</li>
    <li>Migration is a manual conversion. Keep an untouched backup, and try the conversion on a copy first.</li>
  </ul>
</section>
<section class="helpSection">
  <h2>Notes</h2>
  <ul>
    <li>Every Markdown file inside <code>notes/</code> is a Note.</li>
    <li>Notes shows every active Note, newest dated Notes first, with Undated Notes listed after the dated groups.</li>
    <li>The H1 heading is the primary visual title. A Note with no H1 is shown by its filename.</li>
    <li>The filename and folder path remain the physical identity; the H1 is presentation only.</li>
    <li>Two Notes may share the same H1. They stay separate Notes, distinguished by their paths.</li>
  </ul>
  <code class="helpCode">workspace-root/
  notes/
    2026-09-28.md
    Customer-Reference.md</code>
</section>
<section class="helpSection">
  <h2>Knowledge</h2>
  <ul>
    <li>Knowledge is a filtered view over Notes, not a separate collection.</li>
    <li>Adding <code>knowledge: true</code> to a Note's frontmatter places it in Knowledge.</li>
    <li>The Note remains visible in Notes. Nothing is moved or duplicated on disk.</li>
  </ul>
  <code class="helpCode">---
knowledge: true
---</code>
</section>
<section class="helpSection">
  <h2>Pinned</h2>
  <ul>
    <li><code>pinned: true</code> places the Note in the Pinned subsection.</li>
    <li>A Pinned Note is not repeated in the dated or Undated subsection.</li>
    <li>Pin changes the document you are editing. Save to write it to the file.</li>
  </ul>
</section>
<section class="helpSection">
  <h2>Archive</h2>
  <ul>
    <li><code>archived: true</code> removes the Note from the active views: Notes, Pinned and Knowledge.</li>
    <li>The physical file stays in <code>notes/</code>. Archive is not deletion.</li>
    <li>The Note is listed in Archive. Restore removes the archived classification.</li>
    <li>Save is required, exactly as it is for the other actions.</li>
  </ul>
  <code class="helpCode">---
archived: true
---</code>
</section>
<section class="helpSection">
  <h2>Today and New Note</h2>
  <ul>
    <li><strong>Today</strong> opens or creates <code>notes/YYYY-MM-DD.md</code> for the current date.</li>
    <li>Pressing Today again on the same day reuses the same file; it does not create a duplicate.</li>
    <li><strong>New Note</strong> creates a Note with a name you choose.</li>
    <li>The date can be left empty to create an Undated Note.</li>
    <li>Knowledge can be selected during creation.</li>
    <li>If the filename already exists, creation is rejected and reported. An existing Note is never overwritten, and no numbered alternative is created for you.</li>
  </ul>
</section>
<section class="helpSection">
  <h2>Current Document versus Workspace</h2>
  <ul>
    <li><strong>Current Document</strong> represents the live contents of the document you are editing now.</li>
    <li><strong>Workspace</strong> projections represent saved files.</li>
    <li>An unsaved change to a title or a classification may not appear in the Workspace views until you Save.</li>
    <li>Saving rebuilds the Workspace Index, and the views refresh from it.</li>
  </ul>
</section>`,
    },
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
  <ul>
    <li>List items in HTML Preview render inline formatting: bold, italic, inline code, links, Wiki Links, and nested lists.</li>
    <li>Task rows such as <code class="helpCode">- [ ] review this</code> keep their formatted text inside list items.</li>
    <li>HTML Preview math rendering follows the currently documented Markmap-oriented behavior and is not part of this release.</li>
  </ul>
</section>
<section class="helpSection">
  <h2>Offline and updates</h2>
  <ul>
    <li>After a successful installation the core experience works offline: Editor, Markmap, HTML Preview with syntax highlighting, the Workspace, Wiki Links, Tasks, Help, and Release Notes.</li>
    <li>Updates arrive through Update Ready: the card appears when a new version is ready and you choose when to reload.</li>
    <li>While offline, update checks are skipped and resume automatically when you are online again.</li>
    <li>Offline support covers the core application surfaces; external or optional functions may still require a connection.</li>
  </ul>
</section>
<section class="helpSection">
  <h2>Mode selector</h2>
  <p>Switch Editor / Journal / Slides from the toolbar at any time; each mode keeps its own unsaved state for the current session.</p>
</section>`,
    },
    {
      id: 'mode-journal',
      title: 'Journal Workspace Reference',
      subtitle: 'Open a local workspace of Notes, search, and daily workflow.',
      html: t`<section class="helpSection">
  <h2>Open a workspace</h2>
  <p>Open Workspace grants the app access to a local folder the first time. Choose the workspace root — the folder that contains <code>notes/</code>. See Notes, Knowledge, Pinned and Archive for the full format.</p>
  <button type="button" class="helpTopicLink" data-help-topic="journal-notes">Notes, Knowledge, Pinned and Archive</button>
</section>
<section class="helpSection">
  <h2>Notes</h2>
  <p>Every Markdown file in <code>notes/</code> is a Note. Notes lists all active Notes. A Note is titled by its H1 where present; the filename and path remain its physical identity, and duplicate H1 values are supported.</p>
  <code class="helpCode"># 2026-09-11

## Notes

- Customer discussion
- Pricing follow-up

## Tasks

- [ ] Confirm the next meeting</code>
</section>
<section class="helpSection">
  <h2>Knowledge and Pinned</h2>
  <p><code>knowledge: true</code> adds a Note to Knowledge; the Note stays visible in Notes and no file is moved. <code>pinned: true</code> places a Note in Pinned and keeps it out of the dated and Undated parts of Notes.</p>
</section>
<section class="helpSection">
  <h2>Archive</h2>
  <p><code>archived: true</code> removes a Note from the active views. The file stays in <code>notes/</code> and the Note appears in Archive until you Restore it. Archive is not deletion.</p>
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
  <h2>Saving and Task lifecycle</h2>
  <ul>
    <li>A physical Save initializes lifecycle information for new Tasks it can safely recognize; draft autosave does not replace it.</li>
    <li>Pasting several new Tasks at once is supported within a conservative limit; Tasks above that limit, duplicates, or ambiguous Tasks are left untouched instead of being changed incorrectly.</li>
    <li>The current session holds separate Editor and Journal text while you switch modes.</li>
  </ul>
</section>
<section class="helpSection">
  <h2>Mode selector</h2>
  <p>Return to Editor or Slides from the toolbar; each mode keeps its own unsaved text for the current session.</p>
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
      subtitle: 'Manage Projects across your workspace.',
      html: t`<section class="helpSection">
  <h2>What is a Project</h2>
  <p>A Project is a visible Markdown declaration:</p>
  <code class="helpCode">Project: Customer Expansion [800000 BRL] [27Q3]</code>
  <ul>
    <li>The title is required.</li>
    <li><code>[value currency]</code> is optional (for example <code>[800000 BRL]</code>).</li>
    <li><code>[quarter]</code> is optional (for example <code>[27Q3]</code>).</li>
    <li>Dash, star and plus bullet prefixes are accepted and preserved.</li>
  </ul>
</section>
<section class="helpSection">
  <h2>Creating a Project</h2>
  <ul>
    <li>Write a <code>Project:</code> declaration in any Note.</li>
    <li>Save the source once to create managed identity.</li>
    <li>Open Projects to see the Project in the summary view.</li>
  </ul>
</section>
<section class="helpSection">
  <h2>Project fields</h2>
  <ul>
    <li><strong>Value / Currency:</strong> the monetary value and its currency code.</li>
    <li><strong>Expected Order:</strong> the quarter the work is expected (for example <code>27Q3</code>).</li>
    <li><strong>Stage:</strong> managed stage (for example <code>planned</code>, <code>active</code>).</li>
    <li><strong>State:</strong> managed state (for example <code>open</code>, <code>closed</code>).</li>
    <li><strong>Expected Delivery:</strong> managed delivery quarter.</li>
    <li><strong>Expected Billing:</strong> managed billing quarter.</li>
  </ul>
</section>
<section class="helpSection">
  <h2>Editing a Project</h2>
  <ul>
    <li>Open Projects and select a Project.</li>
    <li>Change Stage, State, Delivery or Billing in the expanded row.</li>
    <li>Click Apply — one physical Save occurs per changed source.</li>
    <li>Viewport and route are restored after Save.</li>
  </ul>
</section>
<section class="helpSection">
  <h2>Read-only before identity</h2>
  <p>A Project without managed identity (no Save yet) is read-only for managed fields.</p>
</section>
<section class="helpSection">
  <h2>Source navigation</h2>
  <p>Click a Project to open its source file at the declaration line.</p>
</section>
<section class="helpSection">
  <h2>Empty / not-ready states</h2>
  <p>Open a workspace first, Index not ready, No Projects found.</p>
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
</section>
<section class="helpSection">
  <h2>Source filter</h2>
  <ul>
    <li>Filter the Task Board by exact source file path.</li>
    <li>Duplicate file names are disambiguated by full path context.</li>
    <li>All Sources shows every Task.</li>
    <li>Source filter composes with Status, Priority and Search filters.</li>
    <li>Selected Source survives Board rerender and Workspace Index refresh.</li>
  </ul>
</section>
<section class="helpSection">
  <h2>Board context</h2>
  <ul>
    <li>Responsive column widths; Task text wraps instead of overlapping controls.</li>
    <li>Scroll position and board context are retained after Task operations.</li>
  </ul>
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
    {
      id: 'journal-quick-actions',
      title: 'Quick Actions',
      subtitle: 'Pin, Unpin, Promote to Knowledge, and Archive.',
      html: t`<section class="helpSection">
  <h2>Pin / Unpin</h2>
  <ul>
    <li><code>pinned: true</code> places the Note in the Pinned subsection.</li>
    <li>Unpin removes the classification.</li>
    <li>An accepted change performs one automatic physical Save.</li>
    <li>No second manual Save is normally required.</li>
  </ul>
</section>
<section class="helpSection">
  <h2>Promote to Knowledge</h2>
  <ul>
    <li>Adds <code>knowledge: true</code> to the Note's frontmatter.</li>
    <li>The Note remains visible in Notes; nothing is moved or duplicated.</li>
    <li>An accepted change performs one automatic physical Save.</li>
    <li>Sidebar and Workspace Index refresh after Save.</li>
  </ul>
</section>
<section class="helpSection">
  <h2>Archive</h2>
  <ul>
    <li><code>archived: true</code> removes the Note from Notes, Pinned and Knowledge.</li>
    <li>The physical file stays in <code>notes/</code>; Archive is not deletion.</li>
    <li>The Note is listed in Archive.</li>
    <li>Restore removes the archived classification.</li>
  </ul>
</section>
<section class="helpSection">
  <h2>Automatic Save</h2>
  <ul>
    <li>Accepted metadata Quick Actions save automatically.</li>
    <li>Save failure cannot claim persisted success; state remains recoverable.</li>
    <li>No separate manual Save is needed after an accepted Quick Action.</li>
  </ul>
</section>`,
    },
    {
      id: 'journal-current-document',
      title: 'Current Document',
      subtitle: 'Document-scoped Tasks, Links In, and Links Out for the open document.',
      html: t`<section class="helpSection">
  <h2>Cards scoped to the current document</h2>
  <ul>
    <li>Select a Task or Link card to open local details for that document.</li>
    <li>Click a result row to navigate to the source line.</li>
    <li>Close the local detail with the × control.</li>
    <li>Links In means documents that reference the current document.</li>
    <li>Links Out means documents referenced by the current document.</li>
  </ul>
</section>
<section class="helpSection">
  <h2>Card types</h2>
  <ul>
    <li><strong>Backlog</strong> — all open Tasks for this document.</li>
    <li><strong>Open</strong> — canonical todo Tasks only.</li>
    <li><strong>Ongoing</strong> — Tasks in progress for this document.</li>
    <li><strong>Done</strong> — completed Tasks for this document.</li>
    <li><strong>Links In</strong> — documents that link to this document.</li>
    <li><strong>Links Out</strong> — documents this document links to.</li>
  </ul>
  <p>Task categories are mutually exclusive; each Task appears in exactly one card.</p>
</section>
<section class="helpSection">
  <h2>Navigation</h2>
  <ul>
    <li>Task rows open the source file at the Task line.</li>
    <li>Link rows navigate through existing Wiki Link owners.</li>
    <li>Lists are read-only; no Task completion, reopen, or Save from these controls.</li>
  </ul>
</section>`,
    },
    {
      id: 'workspace-knowledge',
      title: 'Workspace Knowledge',
      subtitle: 'Search and filter indexed Workspace files by name, path, and Tags.',
      html: t`<section class="helpSection">
  <h2>Workspace summary</h2>
  <ul>
    <li>The summary describes the indexed Workspace contents.</li>
    <li>Search finds indexed files by filename or path match.</li>
    <li>Tag chips filter files by their Tags.</li>
    <li>Multiple green Tags are active simultaneously.</li>
    <li>Clicking an active green Tag removes that filter.</li>
    <li>Search and Tags work together using intersection.</li>
    <li>Show more and Show less expand or collapse the available Tags.</li>
    <li>Click a result to open the file.</li>
  </ul>
</section>
<section class="helpSection">
  <h2>Surface distinction</h2>
  <ul>
    <li><strong>Current Document</strong> — scoped to the document you have open; local Tasks and Links only.</li>
    <li><strong>Workspace Knowledge</strong> — Workspace-wide; Search and Tag filtering across all indexed files.</li>
    <li><strong>Knowledge classification</strong> — Notes marked with <code>knowledge: true</code> frontmatter; a filtered view over Notes, not a separate collection.</li>
    <li><strong>Archive</strong> — Notes marked <code>archived: true</code>; removed from active views but not deleted.</li>
    <li><strong>Report</strong> — a separate feature after Archive; generates virtual Reports from date ranges over Tasks and Projects.</li>
  </ul>
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
