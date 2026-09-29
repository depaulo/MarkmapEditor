// @ts-nocheck
// ================================
// Release Notes content — ALL user-visible release copy.
// Visible Release Notes text lives in this single reviewable file.
// The viewer in js/ui/release-notes.js owns display logic only.
// ================================
(function () {
  'use strict';

  function t(strings) {
    return strings.raw.join('');
  }

  // Each release entry supports:
  //   version, title, summary, changes (groups of bullets),
  //   tryIt? (snippet), uiPath? (UI action path),
  //   limitations?, helpTopic? (links to a Help topic ID).
  const RELEASES = Object.freeze([
    {
      version: '0.6.3',
      title: 'MarkmapEditor 0.6.3: Tasks and Wiki Links Foundation',
      summary: t`Version 0.6.3 stabilizes Tasks and Wiki Links. Tasks now share one
normalized contract across Task Review and the Task Board, and a Task Board card can
set priority directly. Wiki Links now resolve through one canonical owner, and the
Sidebar panel that showed related Notes is now a Links In panel driven by real
resolved relationships.`,
      expanded: true,
      changes: [
        {
          group: 'Tasks',
          items: [
            'Task Review and the Task Board now read one shared Task contract, so a Task shows the same status and priority in both places.',
            'Task lifecycle dates are written conservatively: opened, started and completed are only recorded where they are actually established.',
            'Added a priority selector to every Task Board card. Choose -- for no priority, or P1, P2 or P3.',
            'Task priority is written as a visible #p1, #p2 or #p3 token on the Task line.',
            'Existing Tasks that still carry the older priority metadata continue to be read correctly, and are converted the first time you change their priority.',
            'Changing only a Task priority does not alter any lifecycle date, and never renames or rewrites a Task.',
            'When two Tasks share the same visible text, the exact one you are editing is changed, and the other is left alone.',
          ],
        },
        {
          group: 'Wiki Links',
          items: [
            'All Wiki Links are now recognized by one shared rule, so a link looks the same in the editor, in HTML Preview and in your saved Notes.',
            'Wiki Link targets resolve in a fixed order: an exact path or filename first, then a Note\'s saved H1 heading. A filename always wins over a matching title.',
            'A link is shown distinctly when its target is missing, or when more than one Note could match. A missing or ambiguous target never opens a file by guesswork.',
            'Opening a resolved Wiki Link always uses the target\'s exact file path.',
          ],
        },
        {
          group: 'Links In and Links Out',
          items: [
            'Added canonical Links Out (the Wiki Links a Note declares) and Links In (the Notes that link to it).',
            'The Sidebar panel formerly called Related is now Links In. It is driven by real resolved relationships, so a Note linked by its title is now correctly listed.',
            'Repeated links from one Note produce a single Links In row instead of duplicates.',
            'Selecting a Links In entry opens that exact source Note.',
            'Links In requires a ready Workspace Index. Before that, the panel reports that it is unavailable rather than claiming there are none.',
          ],
        },
        {
          group: 'Sidebar and Active actions',
          items: [
            'Panel separators and title weights are now consistent across the Sidebar.',
            'Related and Tags badges show a plain number.',
            'Archive and Restore now live in the Active panel.',
            'Archiving remains metadata-based: Archive a Note and Save to make the change stick.',
          ],
        },
        {
          group: 'Scope',
          items: [
            'The Links In Sidebar panel is the relationship view in 0.6.3. Richer relationship cards inside Active and the Workspace Index are planned for a later release.',
            'Markdown remains the source of truth. Nothing renames, rewrites, or creates Notes on your behalf.',
          ],
        },
      ],
      helpTopic: 'journal-links',
      tryIt: t`Open a workspace, open a Note, and type a link to another Note:
[[Alpha]]. Save, then open the Sidebar and read the Links In panel on the target
Note. On the Task Board, set a Task to P1 and the card shows P1.`,
      limitations: [
        'The Links In Sidebar panel is the relationship view in 0.6.3. Richer relationship cards inside Active and the Workspace Index are planned for a later release.',
        'Cross-file Wiki Link resolution and Links In use the saved Workspace Index, so Save after renaming or retitling a Note.',
        'When one Note links to the same target several times, the saved data counts it once, so the panel shows a single row.',
        'Archiving stays metadata-based: archive a Note and Save for the change to take effect.',
      ],
    },
    {
      version: '0.6.2',
      title: 'MarkmapEditor 0.6.2: Notes Workspace Foundation',
      summary: t`Version 0.6.2 introduces the new Workspace format. Every Markdown file
inside a workspace's notes/ folder is a Note, and Notes, Knowledge, Pinned and
Archive are views over those same files. Existing Tasks, Projects, Search, Tags,
Wiki Links, Related, Reports and Draw.io continue to work.`,
      expanded: true,
      changes: [
        {
          group: 'The new Workspace format',
          items: [
            'Introduced the new notes/ Workspace format. Open the workspace root; the root contains notes/.',
            'Unified Journals and Concepts as Markdown Notes in a single notes/ folder.',
            'Added the Notes, Knowledge, Pinned and Archive views. These are views over your existing files, not copies of them.',
            'A Note is titled by its H1 heading where present, while its filename and folder path remain its physical identity. Two Notes may share the same H1.',
          ],
        },
        {
          group: 'Creating and organizing Notes',
          items: [
            'Added Today, which opens or creates notes/YYYY-MM-DD.md. Pressing Today again on the same day reuses the same file instead of creating a second one.',
            'Added New Note, which creates a named Note. Its date can be left empty for an Undated Note, and it can be created as a Knowledge Note.',
            'If a chosen filename already exists, creation is rejected and reported; an existing Note is never overwritten.',
            'Added the Pin, Unpin, Add to Knowledge, Remove from Knowledge, Archive and Restore actions for the active Note.',
          ],
        },
        {
          group: 'How the views relate',
          items: [
            'Knowledge is a filtered view over Notes. A Note with knowledge: true also appears in Knowledge and remains visible in Notes.',
            'Pinned is an independent classification. A pinned Note is listed in Pinned and is not repeated in the dated or Undated part of Notes.',
            'Archive is reversible metadata, not deletion. An archived Note leaves the active views, still exists as a file in notes/, and appears in Archive until you Restore it.',
            'The Pin, Knowledge and Archive actions change the document you are editing. Save to write them to the file.',
          ],
        },
        {
          group: 'Corrected in this release',
          items: [
            'Corrected Note navigation: Back and Forward now reopen the Note you came from.',
            'Corrected Task Review display escaping so Task text is shown exactly as written.',
            'Corrected the Archive panel so it collapses and expands like the other Workspace panels, and remembers that choice.',
          ],
        },
        {
          group: 'Current Document and Workspace',
          items: [
            'Current Document shows the document you are editing right now. Workspace views show saved files.',
            'An unsaved title or classification change may not appear in the Workspace views until you Save. Saving rebuilds the Workspace Index.',
          ],
        },
        {
          group: 'What stayed the same',
          items: [
            'Markdown remains the canonical source; Markmap, HTML Preview, Notes, Knowledge, Archive, Reports and Draw.io are derived from it.',
            'Tasks, Projects, Search, Tags, Wiki Links, Related, Reports and Draw.io continue to work against the same Notes.',
            'A physical Save remains the owner of every metadata and Task lifecycle change.',
          ],
        },
      ],
      tryIt: t`A small workspace looks like this:

workspace-root/
  notes/
    2026-09-28.md
    Customer-Reference.md

A Knowledge Note:

\`\`\`
---
knowledge: true
---
\`\`\`

An archived Note:

\`\`\`
---
archived: true
---
\`\`\``,
      uiPath: 'Journal → Open Workspace → choose the workspace root → Notes',
      limitations: [
        'This version does not automatically migrate a workspace that still uses the older journals/ and concepts/ folders. A legacy workspace is rejected; migration is a manual conversion.',
        'Test the conversion on a copy of your workspace before applying it to the original.',
        'Archive hides a Note from the active views; it does not delete the file.',
      ],
      helpTopic: 'journal-notes',
    },
    {
      version: '0.6.1',
      title: 'MarkmapEditor 0.6.1: Foundation reliability and workflow polish',
      summary: t`Version 0.6.1 closes the 0.6.x foundation work. After a successful
installation the application starts offline with the Editor, Markmap, HTML
Preview, syntax highlighting, workspace navigation, Wiki Links, Tasks, and Help.
Updates are applied through a user-controlled Update Ready step, and several
workflow details are more reliable: mode switching, saving several new Tasks at
once, list formatting in HTML Preview, and the Update Ready card in dark mode.`,
      expanded: true,
      changes: [
        {
          group: 'Offline foundation',
          items: [
            'The core experience works offline once the application has been installed: Editor, Markmap, HTML Preview with syntax highlighting, the Workspace, Wiki Links, Tasks, and Help.',
            'Offline startup does not need a previous online session beyond the installation itself.',
            'Help and Release Notes remain available offline from the installed application.',
          ],
        },
        {
          group: 'Updates',
          items: [
            'Updates are applied through Update Ready: the card appears when a new version is ready, and you choose when to reload.',
            'The Update Ready card now follows the dark theme, so it reads as part of the interface in either appearance.',
            'While offline, update checks are skipped and resume automatically when you are online again.',
          ],
        },
        {
          group: 'Editing, modes, and Tasks',
          items: [
            'Editor and Journal keep their own unsaved text while you switch between modes.',
            'Switching modes no longer risks restoring the other mode text over the active one.',
            'Saving a document initializes lifecycle information for new Tasks it can safely recognize; pasting several new Tasks at once is supported within a conservative limit.',
            'Tasks that cannot be identified safely are left untouched instead of being changed incorrectly.',
            'Inline formatting inside HTML Preview list items renders correctly, including bold, italic, inline code, links, Wiki Links, nested lists, and formatted Task text.',
          ],
        },
        {
          group: 'What stayed the same',
          items: [
            'Markdown remains the canonical source; Markmap, HTML Preview, Reports, and visual outputs are derived from it.',
            'A physical Save remains the owner of Task lifecycle initialization; draft autosave does not replace it.',
            'Existing files, Task metadata, and workspace content are not converted or reformatted by this release.',
          ],
        },
      ],
      tryIt: t`1. Open MarkmapEditor online once after the update.
2. When Update Ready appears, select Reload.
3. Continue editing, using the Workspace, Markmap, and HTML Preview normally.
4. The installed application can reopen its core experience offline.`,
      uiPath: 'Toolbar → Update Ready → Reload (updates apply when you choose)',
      limitations: [
        'Tasks above the conservative bulk-reconciliation limit remain untouched rather than being given lifecycle information incorrectly.',
        'Duplicate or otherwise ambiguous Tasks may remain untouched when a safe identity cannot be established.',
        'HTML Preview math rendering is outside this release and continues to follow the currently documented Markmap-oriented behavior.',
        'Offline support covers the core application surfaces; it is not a guarantee that every external or optional function is available offline.',
      ],
      helpTopic: 'mode-editor',
    },
    {
      version: '0.6.0',
      expanded: false,
      title: 'MarkmapEditor 0.6.0: Help and Release Notes',
      summary: t`Version 0.6.0 introduces mode-aware Help, contextual guidance for key Journal
features, permanent Release Notes, and one-time What's New notices. It also
delivers the completed Reports workflow, including structured Report Notes,
custom Template Fields, safer Report transitions, and formatted content in
eligible Draw.io template cells.`,
      expanded: true,
      changes: [
        {
          group: 'Help and guidance',
          items: [
            'Mode-aware Help (?) in the toolbar shows Editor, Journal, or Slides content for the active mode.',
            'Contextual guidance (?) is available in the Reports, Projects, Tasks, and Related panels.',
            'All Help text lives in one reviewable content file; panel modules store only topic IDs.',
          ],
        },
        {
          group: 'Reports',
          items: [
            'Generate a fresh virtual Report from a date range over completed Tasks and parsed Projects.',
            'Report Notes support inline and multiline fields; a blank note template starts each Report.',
            'Custom fields are preserved under ## Template Fields for Draw.io reconciliation.',
            'Invalid field structure blocks generation so text is never silently lost.',
            'Simple values remain plain text, even in a cell that supports formatted content; Markdown conversion is used only when supported formatting or structure is present.',
          ],
        },
        {
          group: 'Draw.io reporting',
          items: [
            'Reconcile a Report into a Draw.io template; eligible cells accept safe Markdown-derived fragments.',
            'Unsupported content in a cell falls back to plain text.',
            'The Draw.io UI path is: Journal → Reports → Generate Report → Reconcile Draw.io Template → Choose Template → Generate Draw.io → Save As.',
          ],
        },
        {
          group: 'Updates',
          items: [
            'MarkmapEditor now presents a MAJOR.MINOR.PATCH product version (0.6.0) instead of a cache label.',
            'Safer Report transitions run a single coordinated Save / Discard / Cancel decision before replacing the active Report.',
            'One-time What\'s New shows the current release once after update; Welcome and What\'s New never appear together.',
            'Earlier vNN values were cache identities, not semantic product versions, and are not reconstructed as Release Notes entries.',
          ],
        },
      ],
      tryIt: t`{{summary}}:
**Brazil remains the priority market.**

This period focused on:

- supplier qualification
- installation planning
{{/summary}}

{{highlights}}: Supplier qualification progressed.

{{customer message}}:
The customer requested:

- revised pricing
- an updated schedule
{{/customer message}}

{{account ref}}: ACME-42`,
      uiPath: 'Journal → Reports → set From/To dates → choose Projects scope → enable Sections → paste Notes → Generate Report',
            limitations: [
        'Report generation requires an open workspace.',
        'At least one Report section must be enabled.',
        'The Report date range must be a valid, non-reversed YYYY-MM-DD range.',
        'Draw.io cell formatting supports a restricted safe subset only; headings, code, links, images, tables, blockquotes, and raw HTML fall back to plain text.',
        'Projects are read-only in this release; there is no Project editor or managed Project metadata yet.',
      ],
      helpTopic: 'journal-reports',
    },
  ]);

  // Newest first. The current release opens expanded; older releases open
  // collapsed.
  const RELEASES_NEWEST_FIRST = Object.freeze(
    RELEASES.slice().sort((a, b) => {
      const av = a.version.split('.').map(Number);
      const bv = b.version.split('.').map(Number);
      for (let i = 0; i < Math.max(av.length, bv.length); i++) {
        const aN = av[i] || 0;
        const bN = bv[i] || 0;
        if (aN !== bN) return bN - aN;
      }
      return 0;
    })
  );

  const RELEASE_NOTES_SUBTITLE = 'See what changed in each MarkmapEditor release.';

  (function expose() {
    try {
      globalThis.MME_RELEASE_NOTES = Object.freeze({
        releases: RELEASES_NEWEST_FIRST,
        subtitle: RELEASE_NOTES_SUBTITLE,
      });
      window.MME_RELEASE_NOTES = globalThis.MME_RELEASE_NOTES;
    } catch {}
  })();
})();
