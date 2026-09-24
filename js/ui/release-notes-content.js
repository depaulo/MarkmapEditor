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
