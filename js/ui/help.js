// @ts-nocheck
// Help / Reference modal logic.
// Extracted from js/main.js into a standalone UI module.
// ================================
// Help / Reference Modal
// ================================

function getCurrentHelpContext() {
  const contextId =
    globalThis.currentAppContextId ||
    document.documentElement.dataset.appContext ||
    localStorage.getItem('markmap:appContext') ||
    'editor';

  if (contextId === 'slides') {
    return 'slides';
  }

  if (contextId === 'journal') {
    const workspaceState = globalThis.WORKSPACE_STATE || window.WORKSPACE_STATE || null;

    const activeKind =
      typeof normalizeWorkspaceKindForCompare === 'function'
        ? normalizeWorkspaceKindForCompare(workspaceState?.activeFile?.kind || '')
        : String(workspaceState?.activeFile?.kind || '').trim();

    if (activeKind === 'concepts') {
      return 'concept';
    }

    return 'journal';
  }

  return 'editor';
}

function getHelpContextTitle(context) {
  if (context === 'journal') return 'Journal Workspace Reference';
  if (context === 'concept') return 'Concept Reference';
  if (context === 'slides') return 'Pandoc / Slides Reference';
  return 'Markdown Editor Reference';
}

function getHelpContextSubtitle(context) {
  if (context === 'journal') {
    return 'Journals, tags, tasks, backlinks, assets, archive, and daily workflow.';
  }

  if (context === 'concept') {
    return 'Persistent knowledge pages, backlinks, tags, tasks, and concept links.';
  }

  if (context === 'slides') {
    return 'Pandoc-compatible Markdown, slide blocks, notes, layouts, images, and export source.';
  }

  return 'Markdown syntax, mindmap structure, preview, images, tasks, links, code, and tables.';
}

function showHelpOverlay() {
  const overlay = document.getElementById('helpOverlay');

  if (!overlay) {
    log?.('Help: overlay missing');
    return;
  }

  renderHelpContent();

  overlay.hidden = false;

  // Ensure modal overlay display works even if some other code manipulates inline styles.
  // Using display:flex matches overlays.css.
  overlay.style.display = 'flex';

  try {
    overlay.focus?.();
  } catch {}

  log?.(`Help: shown context=${getCurrentHelpContext()}`);
}

function hideHelpOverlay() {
  const overlay = document.getElementById('helpOverlay');

  if (overlay) {
    overlay.hidden = true;
  }

  log?.('Help: hidden');
}

function wireHelpOverlay() {
  const btnHelp = document.getElementById('btnHelp');
  const overlay = document.getElementById('helpOverlay');
  const btnClose = document.getElementById('btnHelpClose');
  const btnBackToWelcome = document.getElementById('btnHelpBackToWelcome');

  if (!overlay) {
    log?.('Help: wire skipped; overlay missing');
    return;
  }

  if (overlay.__helpBound) {
    return;
  }

  btnHelp?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    showHelpOverlay();
  });

  btnClose?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideHelpOverlay();
  });

  // UX-MODE1.1: Back to Welcome button.
  btnBackToWelcome?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    hideHelpOverlay();
    try {
      globalThis.showWelcomeOverlay?.();
    } catch {}
    log?.('Help: back to Welcome');
  });

  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      hideHelpOverlay();
    }
  });

  overlay.__helpBound = true;

  log?.('Help: wired');
}

function renderHelpContentForContext(context) {
  const title = document.getElementById('helpTitle');
  const subtitle = document.getElementById('helpSubtitle');
  const body = document.getElementById('helpBody');

  if (!body) {
    log?.('Help: body missing');
    return;
  }

  if (title) title.textContent = getHelpContextTitle(context);
  if (subtitle) subtitle.textContent = getHelpContextSubtitle(context);

  if (context === 'journal') {
    body.innerHTML = getJournalHelpHtml();
  } else if (context === 'concept') {
    body.innerHTML = getConceptHelpHtml();
  } else if (context === 'slides') {
    body.innerHTML = getSlidesHelpHtml();
  } else {
    body.innerHTML = getEditorHelpHtml();
  }

  const overlay = document.getElementById('helpOverlay');
  if (overlay) {
    overlay.hidden = false;
    overlay.style.display = 'flex';
    try { overlay.focus?.(); } catch {}
  }
}

function renderHelpContent() {
  renderHelpContentForContext(getCurrentHelpContext());
}

function showHelpForContext(context) {
  const valid = context === 'journal' || context === 'concept' || context === 'slides' || context === 'editor';
  const target = valid ? context : 'editor';
  log?.(`Help: force context=${target}`);
  renderHelpContentForContext(target);
}

function getEditorHelpHtml() {
  return `
    <section class="helpSection">
      <h2>Markdown + Mindmap Basics</h2>
      <p>
        Editor mode is for standalone Markdown files, outlines, notes, and mindmaps.
        Write Markdown in the editor and use the mindmap / preview views to review structure.
      </p>
      <div class="helpCallout">
        Best mindmap results come from clear headings and nested lists.
      </div>
    </section>

    <section class="helpSection">
      <h2>Headings</h2>
      <p>Use headings to create the main document structure.</p>
      <code class="helpCode"># Main topic
## Section
### Detail</code>
      <p>
        Headings are also used by the HTML preview index and source-line navigation.
      </p>
    </section>

    <section class="helpSection">
      <h2>Lists and Nesting</h2>
      <p>Use bullets for mindmap branches and supporting details.</p>
      <code class="helpCode">- Main point
  - Supporting point
  - Another detail
- Next point</code>
    </section>

    <section class="helpSection">
      <h2>Tasks</h2>
      <p>Use Markdown tasks for actions. In workspace mode, open tasks are indexed.</p>
      <code class="helpCode">- [ ] Open task
- [x] Completed task</code>
    </section>

    <section class="helpSection">
      <h2>Links</h2>
      <p>Use normal Markdown links for URLs.</p>
      <code class="helpCode">https://www.microsoft.com

https://example.com</code>
    </section>

    <section class="helpSection">
      <h2>Images</h2>
      <p>In standalone Editor mode, use an images folder next to the Markdown file.</p>
      <code class="helpCode">./images/architecture-view.png</code>
      <p>
        If you are using a workspace, image paths usually point to assets/images from
        journals or concepts.
      </p>
      <code class="helpCode">../assets/images/architecture-view.png</code>
    </section>

    <section class="helpSection">
      <h2>Code Blocks</h2>
      <p>
        Use fenced code blocks. The HTML preview supports syntax highlighting for common languages.
      </p>
      <code class="helpCode">\`\`\`js
console.log('Hello');
\`\`\`

\`\`\`python
print('Hello')
\`\`\`

\`\`\`yaml
status: active
\`\`\`</code>
    </section>

    <section class="helpSection">
      <h2>Tables</h2>
      <p>Use Markdown tables for simple structured data.</p>
      <code class="helpCode">| Item | Status |
|---|--|
| Option A | Open |
| Option B | Done |</code>
    </section>

    <section class="helpSection">
      <h2>Horizontal Rules</h2>
      <p>Use horizontal rules to visually separate sections.</p>
      <code class="helpCode">---</code>
    </section>

    <section class="helpSection">
      <h2>Preview and Export</h2>
      <p>
        Use HTML Preview for cleaner reading. Use Export for Markdown, HTML Preview,
        or Mindmap SVG depending on mode.
      </p>
      <div class="helpCallout">
        Mermaid diagrams are not part of the supported reference yet. Add them later after Mermaid support is implemented.
      </div>
    </section>
  `;
}

function getJournalHelpHtml() {
  return `
    <section class="helpSection">
      <h2>Journal Workspace</h2>
      <p>
        Journal mode is for working inside a workspace folder with journals, concepts,
        search, backlinks, tags, tasks, assets, and archive.
      </p>
      <code class="helpCode">workspace/
  journals/
  concepts/
  assets/
    images/
  archive/
  system/</code>
    </section>

    <section class="helpSection">
      <h2>Journals</h2>
      <p>
        Journals are daily capture files. Use journals for things that happen today:
        meetings, thoughts, decisions, customer conversations, tasks, and quick notes.
      </p>
      <code class="helpCode">journals/2026-07-05.md

# 2026-07-05 — Daily Capture

Type: Journal
Status: active
Tags: #customer #strategy
Created: 2026-07-05
Updated: 2026-07-05</code>
      <div class="helpCallout">
        Simple rule: use a journal when the note belongs to today.
      </div>
    </section>

    <section class="helpSection">
      <h2>Journal Titles</h2>
      <p>
        Journal file names should normally stay date-based, such as 2026-07-05.md.
        The H1 title can be more descriptive and appears in the Journal timeline.
      </p>
      <code class="helpCode"># 2026-07-05 — Customer discovery and product feedback</code>
    </section>

    <section class="helpSection">
      <h2>Tags</h2>
      <p>
        Tags help group topics across journals and concepts. Tags are indexed in the Tags panel.
      </p>
      <code class="helpCode">Tags: #customer #pipeline #strategy

Inline tags also work:
- Discussed #pricing and #partner motion.</code>
      <p>
        Recommended tag style: lowercase words, no spaces, use hyphens when needed.
      </p>
      <code class="helpCode">#customer
#product-feedback
#region-latam</code>
    </section>

    <section class="helpSection">
      <h2>Tasks</h2>
      <p>
        Use Markdown tasks. Open tasks appear in the Open Tasks panel and are grouped by source file.
      </p>
      <code class="helpCode">- [ ] Send follow-up email
- [ ] Validate opportunity with partner
- [x] Add meeting notes</code>
    </section>

    <section class="helpSection">
      <h2>Concept Links and Related</h2>
      <p>
        Link from a journal to a concept when a daily note belongs to a persistent topic.
        The Related panel uses these links to show backlinks.
      </p>
      <code class="helpCode">[[ProductNews]]

[[CustomerDiscovery]]

concepts/ProductNews.md</code>
      <div class="helpCallout">
        Journal = capture. Concept = organize.
      </div>
    </section>

    <section class="helpSection">
      <h2>Images and Assets</h2>
      <p>
        Workspace images should live in assets/images. From journals, use:
      </p>
      <code class="helpCode">../assets/images/diagram.png</code>
    </section>

    <section class="helpSection">
      <h2>Archive</h2>
      <p>
        Archive removes files from the active workspace view without deleting them.
        Use archive instead of delete when you want to preserve history.
      </p>
    </section>

    <section class="helpSection">
      <h2>Recommended Daily Workflow</h2>
      <ul>
        <li>Open Today / Daily Capture.</li>
        <li>Capture quick notes during the day.</li>
        <li>Add tasks using - [ ].</li>
        <li>Add tags for topics you want to find later.</li>
        <li>Link recurring topics to concepts with [[ConceptName]].</li>
        <li>Create concepts when a topic becomes important or reusable.</li>
        <li>Review Open Tasks, Tags, Related, and the Journal timeline.</li>
      </ul>
    </section>
  `;
}

function getConceptHelpHtml() {
  return `
    <section class="helpSection">
      <h2>Concepts</h2>
      <p>
        Concepts are persistent knowledge pages. Use concepts for topics that should live over time:
        accounts, opportunities, product feedback, market notes, partners, competitors,
        playbooks, and recurring initiatives.
      </p>
      <code class="helpCode">concepts/ProductNews.md

# ProductNews

Type: Concept
Status: active
Tags: #product #customer
Created:
Updated:</code>
    </section>

    <section class="helpSection">
      <h2>Journals vs Concepts</h2>
      <div class="helpGrid">
        <div>
          <h3>Journal</h3>
          <p>Use for daily capture, meetings, tasks, and what happened today.</p>
        </div>
        <div>
          <h3>Concept</h3>
          <p>Use for durable knowledge, recurring topics, and things you will revisit.</p>
        </div>
      </div>
      <div class="helpCallout">
        Journal = capture. Concept = organize.
      </div>
    </section>

    <section class="helpSection">
      <h2>Concept Links</h2>
      <p>
        Concepts become useful when journals and other concepts link to them.
      </p>
      <code class="helpCode">[[OpportunityBrief]]

[[CustomerDiscovery]]

concepts/OpportunityBrief.md</code>
    </section>

    <section class="helpSection">
      <h2>Backlinks / Related</h2>
      <p>
        When a concept is active, the Related panel shows journals and concepts that reference it.
        This helps you see where the idea came from and where it is being used.
      </p>
    </section>

    <section class="helpSection">
      <h2>Tags</h2>
      <p>
        Use tags to make concepts discoverable by topic.
      </p>
      <code class="helpCode">Tags: #customer #opportunity #partner #market-note</code>
    </section>

    <section class="helpSection">
      <h2>Tasks Inside Concepts</h2>
      <p>
        Concept tasks are useful when the action belongs to a durable topic.
      </p>
      <code class="helpCode">## Tasks
- [ ] Validate value proposition
- [ ] Add customer example
- [x] Link related journal notes</code>
    </section>

    <section class="helpSection">
      <h2>Business Concept Examples</h2>
      <ul>
        <li>Account / Customer Profile</li>
        <li>Opportunity Brief</li>
        <li>Partner Profile</li>
        <li>Product Feedback</li>
        <li>Market / Region Note</li>
        <li>Competitor Profile</li>
        <li>Stakeholder Map</li>
        <li>Playbook / Process Note</li>
      </ul>
    </section>

    <section class="helpSection">
      <h2>Recommended Concept Structure</h2>
      <code class="helpCode"># ConceptName

Type: Concept
Status: active
Tags:
Created:
Updated:

## Summary
-

## Notes
-

## Related Concepts
-

## Tasks
- [ ]

## Sources
-</code>
    </section>
  `;
}

function getSlidesHelpHtml() {
  return `
    <section class="helpSection">
      <h2>Pandoc / Slides Mode</h2>
      <p>
        Pandoc / Slides mode is for writing presentation-oriented Markdown.
        The app exports Markdown source. An external Pandoc workflow can convert it to PowerPoint.
      </p>
      <div class="helpCallout">
        The app prepares Markdown. It does not run Pandoc in the browser.
      </div>
    </section>

    <section class="helpSection">
      <h2>Slide Blocks</h2>
      <p>
        Use one slide block per slide. Slide templates are already written in Pandoc-compatible Markdown.
      </p>
      <code class="helpCode"># Executive Summary

&lt;!-- Target PPT layout: Title and Content --&gt;
&lt;!-- Source layout: content --&gt;

- Point 1
- Point 2
- Point 3</code>
    </section>

    <section class="helpSection">
      <h2>Layout Comments</h2>
      <p>
        Layout comments describe the intended PowerPoint template target and preserve the old source layout mapping.
      </p>
      <code class="helpCode">&lt;!-- Target PPT layout: Image Left + Text Right --&gt;
&lt;!-- Source layout: image-text --&gt;</code>
      <p>
        These comments are kept in the Markdown export and can be used by future tooling.
      </p>
    </section>

    <section class="helpSection">
      <h2>Speaker Notes</h2>
      <p>Use Pandoc-compatible notes blocks for presenter notes.</p>
      <code class="helpCode">::: notes
Presenter notes go here.
:::</code>
    </section>

    <section class="helpSection">
      <h2>Columns</h2>
      <p>Use Pandoc-compatible columns for two-column or multi-column slide layouts.</p>
      <code class="helpCode">:::: {.columns}
::: {.column}
## Left
- Point 1
- Point 2
:::

::: {.column}
## Right
- Point A
- Point B
:::
:::</code>
    </section>

    <section class="helpSection">
      <h2>Images</h2>
      <p>
        In a workspace, store images in assets/images and reference them from slide Markdown.
      </p>
      <code class="helpCode">../assets/images/market-opportunity.png</code>
      <p>Outside a workspace, use an images folder next to the Markdown file.</p>
      <code class="helpCode">./images/market-opportunity.png</code>
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
        <li>Operating Model Overview — 2x2 Grid</li>
        <li>Revenue Growth Potential — KPI</li>
        <li>Option Comparison — Table</li>
        <li>Next Steps — Action List</li>
      </ul>
    </section>

    <section class="helpSection">
      <h2>Export Workflow</h2>
      <p>
        Use Export Slides Markdown (.md). Then pass the exported Markdown file to your external Pandoc workflow.
      </p>
      <code class="helpCode">pandoc slides.md -o output.pptx --reference-doc=PandocTemplateV4.pptx</code>
      <p>
        The exported Markdown should preserve headings, layout comments, images, speaker notes,
        columns, and tables.
      </p>
    </section>
  `;
}

(function () {
  try {
    window.getCurrentHelpContext = getCurrentHelpContext;
    window.getHelpContextTitle = getHelpContextTitle;
    window.getHelpContextSubtitle = getHelpContextSubtitle;
    window.showHelpOverlay = showHelpOverlay;
    window.hideHelpOverlay = hideHelpOverlay;
    window.wireHelpOverlay = wireHelpOverlay;
    window.renderHelpContent = renderHelpContent;

    globalThis.getCurrentHelpContext = getCurrentHelpContext;
    globalThis.getHelpContextTitle = getHelpContextTitle;
    globalThis.getHelpContextSubtitle = getHelpContextSubtitle;
    globalThis.showHelpOverlay = showHelpOverlay;
    globalThis.hideHelpOverlay = hideHelpOverlay;
    globalThis.wireHelpOverlay = wireHelpOverlay;
    globalThis.renderHelpContent = renderHelpContent;
    globalThis.showHelpForContext = showHelpForContext;
    window.showHelpOverlay = showHelpOverlay;
    window.hideHelpOverlay = hideHelpOverlay;
    window.wireHelpOverlay = wireHelpOverlay;
    window.renderHelpContent = renderHelpContent;
    window.showHelpForContext = showHelpForContext;
  } catch {}
})();
