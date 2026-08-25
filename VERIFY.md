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

- [ ] **H2 reconciler (pending)**: confirm `MME_DRAWIO_REPORT_RECONCILER` is NOT registered as a live workflow until H2 review.

Browser-console runtime verification: pending (Node-only validation passed; a fresh browser session run belongs in H2/Draw.io closure).
