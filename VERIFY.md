# VERIFY.md — Verification Checklist & Procedures

This document outlines short, repeatable verification procedures suitable for DeX/mobile and desktop validation.

---

## 1. Diagnostics & Runtime Checks

### A. Host Diagnostic Output
Ensure globalThis diagnostics match exactly:
```
ready=true
active=journal
registered=2
transition=false
journalInitialized=true
initializationState=initialized
initializationCount=1
hostCalledAdapter=true
adapterCalledInitialize=true
legacyAutoInit=false
```

### B. Directly Validated Evidence
- [x] Application boots without uncaught exceptions or unhandled rejections.
- [x] Service Worker (`sw.js`) registers successfully.
- [x] Host loaded, active=journal, and initializationCount=1 precisely.
- [x] Populated Workspace Index successfully rebuilt.
- [x] Sidebar panel order matches canonical ordering.

---

## 2. Structured Verification Groups

### Group A: Startup and Ownership
- [ ] **Host Registration**: Confirm `MME_WORKSPACE_HOST.getSnapshot().registeredWorkspaces.length === 2` (Journal and Workspace Index).
- [ ] **Authority Check**: Verify Journal doesn't run legacy self-init (`legacyAutoInit = false`).
- [ ] **No Duplicate Workspaces**: Assert no multiple workspace controllers or duplicate registered listeners.

### Group B: Sidebar Reload & Panel Idempotency
- [ ] **Same-Tab Reload**: Perform a clean tab reload while workspace is active.
- [ ] **Index Readiness**: Wait for `mme-workspace-index-ready` event dispatch.
- [ ] **Order Normalization**: Verify panels follow canonical order:
  1. Search
  2. Active File
  3. Journals
  4. Concepts
  5. Related
  6. Open Tasks
  7. Tags
  8. Workspace Index
  9. Navigation History
- [ ] **Panel Toggles**: Toggle every panel section exactly once.
- [ ] **Preference Persistence**: Refresh page; confirm previous collapsed/expanded preferences persist correctly.
- [ ] **Open Full Index**: Click "Open Full Index" button; verify it transitions to the Workspace Index View.

### Group C: Programmatic Dirty Behavior
- [ ] **Reopen Suppression**: Automatic active-file reopen on boot leaves the file non-dirty (`isDirty = false`).
- [ ] **Sidebar Select Suppression**: Double-click file in sidebar; verify document opens without triggering a false dirty event.
- [ ] **Index Select Suppression**: Open file from Virtual Workspace Index; verify document opens cleanly with `isDirty = false`.
- [ ] **History Restore Suppression**: Trigger Back/Forward; verify restored file doesn't set false dirty state.
- [ ] **Genuine Typing**: Type in CodeMirror; verify `isDirty = true` immediately, followed by one debounced render and autosave.
- [ ] **Draft Restore**: Open a previously unsaved draft; verify it is correctly flagged as dirty.

### Group D: Mode Session (Required - Unverified)
*Note: This group is marked REQUIRED as manual validation has not yet been explicitly completed.*
- [ ] **Text Independence**: Write text in Editor mode; switch to Slides mode and write different text. Switch back and forth; verify unique texts.
- [ ] **Filename Independence**: Verify independent file names for Editor vs Slides mode.
- [ ] **Dirty State Capture**: Capture `isDirty = true` in Editor, switch to Slides and verify Slides can be non-dirty, switch back to Editor and verify dirty state is restored.
- [ ] **Physical File Authority**: Verify that switching to Journal workspace respects the physical active file as the single source of truth.

### Group E: Navigation History
- [ ] **Physical Walk**: Open File A → File B → File C.
- [ ] **Back-Forward Actions**: Click Back twice (re-opens B, then A). Click Forward twice (re-opens B, then C).
- [ ] **Virtual Walk**: Open File A → click "Open Full Index" (Virtual index opens) → click Back (A restored) → click Forward (Index restored).
- [ ] **Return Action**: Click Return button from Virtual Workspace Index; verify it returns to File A.
- [ ] **Cancelled Dirty Rollback**: Try to navigate away while active file is dirty; cancel the navigation confirm dialog. Verify history stack is NOT committed and current position is preserved.
- [ ] **Navigation Log**: Inspect console; verify logged actions correctly report: `opened`, `cancelled`, `failed`, or `noop`.

### Group F: Regression Checks
- [ ] **Wiki Links**: Decorated links display, double-clicking them redirects to resolved physical target.
- [ ] **Task Review**: Open tasks parsed correctly, filters and status changes apply seamlessly.
- [ ] **Return Button**: Independent of Back and Forward buttons.
- [ ] **Dirty Rollback**: Reverts correctly when dirty edits are discarded.
- [ ] **Sidebar Width**: Sidebar resize handle operates smoothly; width persists across refreshes.
- [ ] **Save / Save As**: Standard file system handlers preserve document content securely.
- [ ] **PWA Cache**: Offline operations and cache hits verified via DevTools Application tab.

---

## 7. Group G: Draw.io Report MVP Import (H1)

Reusable H1 verification:

- [ ] **Importer API presence**: in a fresh application session, confirm `globalThis.MME_REPORT_MARKDOWN_IMPORT` exists.
- [ ] **Dormant validator**: `globalThis.MME_REPORT_MARKDOWN_IMPORT.validateReportMarkdownImport()` returns `ok=true, passed=39, total=39, failed=0`.
- [ ] **Browser-console sanitized import**: in a fresh session, run:
  ```js
  const R = globalThis.MME_REPORT_MARKDOWN_IMPORT;
  const md = [
    '---',
    'type: report',
    'period_start: 2026-08-24',
    'period_end: 2026-08-30',
    '---',
    '',
    '# Weekly Business Report',
    '',
    '## Summary',
    '',
    'Reviewed summary text.',
    '',
    '## Next Steps',
    '',
    '- Action item 1',
    '',
    '## Template Fields',
    '',
    '{{customer}}: Alibaba',
    '{{region}}:'
  ].join('\n');
  const r = R.importReviewedReport(md);
  console.log(r.ok, r.fields.title, r.fields.summary, r.fields.customer, r.fields.region, r.sourceMarkdown === md);
  ```
  Confirm `r.ok === true`, a non-empty `r.fields.summary`, custom `r.fields.customer.value === 'Alibaba'`, `r.fields.region.value === ''`, and `r.sourceMarkdown === md`.

### Reusable H2 verification (Draw.io reconciler)

- [ ] **Reconciler API presence**: in a fresh application session, confirm `globalThis.MME_DRAWIO_REPORT_RECONCILER` exists.
- [ ] **Dormant validator**: `globalThis.MME_DRAWIO_REPORT_RECONCILER.validateDrawioReportReconciler()` returns:
  ```
  ok=true
  passed=60
  total=60
  failed=0
  ```
- [ ] **Browser-console sanitized H1-to-H2 reconciliation**: in a fresh session, run:
  ```js
  const importer = globalThis.MME_REPORT_MARKDOWN_IMPORT;
  const R = globalThis.MME_DRAWIO_REPORT_RECONCILER;
  const md = [
    '---',
    'type: report',
    'period_start: 2026-08-24',
    'period_end: 2026-08-30',
    '---',
    '',
    '# Weekly Business Report',
    '',
    '## Summary',
    '',
    'Sanitized summary.',
    '',
    '## Next Steps',
    '',
    'Sanitized next step.',
    '',
    '## Template Fields',
    '',
    '{{customer}}: Example Customer',
    '{{customer decision}}:'
  ].join('\n');
  const templateXml = '<mxfile><diagram id="page-1" name="Page-1"><mxGraphModel><root>'
    + '<mxCell id="0"/><mxCell id="1" parent="0"/>'
    + '<mxCell id="2" value="{{title}}" vertex="1" parent="1"/>'
    + '<mxCell id="3" value="{{summary}}" vertex="1" parent="1"/>'
    + '<mxCell id="4" value="{{customer}}" vertex="1" parent="1"/>'
    + '<mxCell id="5" value="{{customer decision}}" vertex="1" parent="1"/>'
    + '<mxCell id="6" value="{{regional sponsor}}" vertex="1" parent="1"/>'
    + '</root></mxGraphModel></diagram></mxfile>';
  const imported = importer.importReviewedReport(md);
  const r = R.reconcile(templateXml, imported.fields);
  console.log('ok', r.ok);
  console.log('matched', r.matched.map(m => m.placeholder.key));
  console.log('missingValues', r.missingValues.map(m => m.field.key));
  console.log('unknownPlaceholders', r.unknownPlaceholders.map(u => u.key));
  console.log('unusedFields', r.unusedFields.map(f => f.key));
  console.log('occurrences', r.placeholders.map(p => p.key + '=' + p.occurrences));
  console.log(R.buildMissingTemplateFieldsMarkdown(r));
  const pop = R.populateTemplate(templateXml, imported.fields);
  console.log(pop.xml);
  console.log('unresolved preserved',
    pop.xml.includes('{{customer decision}}') &&
    pop.xml.includes('{{regional sponsor}}'));
  console.log('original unchanged', templateXml.includes('{{title}}'));
  ```
  Confirm:
  - `r.ok === true`;
  - matched includes `title`, `summary`, `customer`;
  - missingValues includes `customer decision`;
  - unknownPlaceholders includes `regional sponsor`;
  - unusedFields includes `next steps`;
  - occurrences report one canonical entry per key (`summary=1`, etc.);
  - Template Fields Markdown starts with `## Template Fields` and lists
    `{{customer decision}}:` and `{{regional sponsor}}:` only;
  - populated XML replaces valued placeholders with escaped text;
  - blank and unknown placeholders remain verbatim including braces;
  - the original `templateXml` string is unchanged.

No debug button is added; this remains a console-only procedure.

Browser-console runtime verification for H2: pending (Node-only validation
passed 60/60; a fresh browser session run belongs in H3/Draw.io closure).

### Reusable H3 verification (Draw.io reconciliation UI)

**API availability**

- [ ] **Panel API presence**: in a fresh application session, confirm
  `globalThis.MME_DRAWIO_REPORT_PANEL` exists (an object exposing `open`,
  `close`, `selectTemplate`, `reconcileCurrentReport`,
  `insertMissingTemplateFields`, `refresh`, `resetSession`, `getSessionState`,
  and `validateDrawioReportPanel`).
- [ ] **Dormant validator**:
  ```js
  globalThis.MME_DRAWIO_REPORT_PANEL.validateDrawioReportPanel()
  ```
  ```text
  ok=true
  passed=38
  total=38
  failed=0
  ```

**Browser-confirmed checks**

- [ ] **Adapter handoff**: a fresh Report session log shows
  `Report: Draw.io adapter received=true`.
- [ ] **Report button enablement**: with a virtual or saved Report active, the
  Report sidebar `Reconcile Draw.io Template` button is enabled
  (`disabled=false`).
- [ ] **Non-Report disablement**: with a Journal/Concept/non-Report document
  open, the same button is disabled.
- [ ] **Report collapse**: the Report sidebar panel collapse/expand toggle works
  and the Draw.io button reflects the active Report state.
- [ ] **Overlay open**: clicking the enabled entry opens a single
  `#mmeDrawioReportOverlay` overlay (one instance only).
- [ ] **Close**: the overlay Close / top ✕ closes the overlay and returns focus.
- [ ] **Picker cancellation**: dismissing the native file picker cancels safely
  without an editor error and preserves the Report session.
- [ ] **No-template blocking**: Add Missing Fields and Reconcile Again before any
  template is selected are blocked safely (no-template message).
- [ ] **Mobile open/Close**: the overlay opens and scrolls correctly on a narrow
  mobile viewport.

**Pending real-template acceptance (laptop)**

- [ ] **Real template selection**: pick a valid uncompressed `.drawio`/`.xml`
  template.
- [ ] **Four categories**: Matched / Missing Values / Unknown Template
  Placeholders / Unused Report Fields render with a real template.
- [ ] **Occurrence counts**: per-key occurrence counts display correctly.
- [ ] **Insertion**: Add Missing Fields inserts only absent tokens into
  `## Template Fields` (one section, no duplicates).
- [ ] **Duplicate prevention**: tokens already present elsewhere are not
  duplicated.
- [ ] **Reconcile Again**: running Reconcile Again after values are completed
  updates the match categories.
- [ ] **Navigation session behavior**: cancelled accepted-document navigation
  preserves H3; successful navigation clears the temporary session.
