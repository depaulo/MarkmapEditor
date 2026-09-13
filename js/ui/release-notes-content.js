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
      version: '0.6.0',
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
  // collapsed. 0.6.0 is the first semantic release and opens expanded by
  // default.
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
