# MarkMapJournal Release Status

## 1. Current Release / Checkpoint
- **Branch**: `development`
- **Checkpoint Commits**: Screen Layout S1–S4B: `d241e9c` (S1), `677c2b7` (S2),
  `7264be3` (S3), `c80dfc4` (S4A), `4e6237c` + `0c98d8c` (S4B, final `0c98d8c` = HEAD)
- **APP_VERSION**: `markmap-journal-pwa-v62-screen-layout-closure-v1` (single owner: `sw.js`)
- **Status**: Screen Layout phase complete. S1–S4B implemented and
  device-validated; documentation closure and PWA reconciliation performed in
  the Screen Layout closure package.

---

## 1a. Screen Layout State

- **S1** (resize and overlay isolation): ✅ Complete.
- **S2** (pane registry and edge restore): ✅ Complete.
- **S3** (pane-local fullscreen): ✅ Complete.
- **S4A** (contextual presets, Layout selector, Quick Edit): ✅ Complete.
- **S4B** (touch-friendly controls, Pointer Events splitter lifecycle): ✅ Complete.
- **Device touch resize**: accepted on real hardware — `#splitEditor` and
  `#splitHtml` receive touch Pointer Events and start/end resize; toolbar
  scrolls with a finger; presets and fullscreen functional.
- **Documentation closure**: ✅ Complete (architecture document finalized from
  source truth; STATUS/TODO/VERIFY/VALIDATION_REPORT updated).
- **PWA closure**: `css/view-layout.css` and `js/ui/view-layout.js` added to the
  `sw.js` deterministic precache; cache identity bumped to
  `markmap-journal-pwa-v62-screen-layout-closure-v1`. Clean-install, update,
  and offline-reload browser acceptance: **PENDING** (manual procedures in
  `VERIFY.md`); static/cache consistency checks passed.

Architecture owner:
`docs/architecture/MarkmapEditor_Screen_Layout_ARCHITECTURE.md`.

Intentionally excluded (not implemented): vertical pane stacking, mobile
primary-pane state, mandatory mobile switcher, mobile Sidebar drawer,
orientation pane reorder, native Fullscreen API, arbitrary docking, saved
custom layouts, per-document layout persistence.

---

## 1b. Legacy v58 Status (superseded narrative, retained for history)
- **Checkpoint Commit**: `a78963f`
- **APP_VERSION**: `markmap-journal-pwa-v58-editable-workspace-foundation-v1`
- **Status**: Functional recovery successfully implemented and verified. All runtime edits complete.


---

## 2. Workspace Host State
- **Status**: ✅ Completed & Integrated
- **Active Workspace**: `journal` (first) / `workspace-index` (second, read-only)
- **Registered Count**: 2 (Journal and Workspace Index)
- **Lifecycle Guard**: Host prevents auto-initialization via `legacyAutoInit = false`. Single authority owner registers and activates.
- **Diagnostics**: Custom status reporting integrated for mobile/DeX diagnostics.

---

## 3. Journal Workspace State
- **Status**: ✅ Completed & Restructured
- **Single-Owner Initialization**: Structured initialization ensures `initializationCount = 1` precisely.
- **Active File Recovery**: Session state persists the active file name and restores it safely.
- **Deactivate/Visibility**: Deactivation hides container and handles tab/workspace transition cleanup.

---

## 4. Workspace Index State
- **Status**: ✅ Completed & Integrated (Virtual Workspace Index V1)
- **Read-Only / Virtual**: Does not duplicate files, scans, or create secondary indices. Consumes `WORKSPACE_INDEX_STATE`.
- **Switching Boundaries**: Switches to `journal` workspace, resolves files physically prior to mode switch, and triggers workspace-index rollback on cancelled or failed file open.
- **Return Action**: "Return to [File/Workspace]" action switches back to previous active workspace seamlessly.

---

## 5. Sidebar Lifecycle Recovery
- **Status**: ✅ Completed & Restructured (Idempotent Event-Driven)
- **Bypass Rule**: Early panel setup safely skips rendering when `WORKSPACE_STATE` is not ready.
- **Idempotent Finalizer**: Restructured into a post-readiness finalizer triggered on `mme-workspace-index-ready`.
- **Deterministic Ordering**: Normalizes existing panel nodes into a strict canonical sequence:
  1. Search
  2. Active
  3. Journals
  4. Concepts
  5. Related
  6. Open Tasks
  7. Tags
  8. Workspace Index
  9. Navigation History
- **State Preservation**: Panel collapse states, listeners, and toggle boundaries are retained.
- **Delegation**: Single-owner collapse event listener delegation bound to `#workspaceSidebar`.

---

## 6. Programmatic Text / Dirty Recovery
- **Status**: ✅ Completed & Isolated
- **Lexical Counter Isolation**: Wrap programmatic document writes in `runProgrammaticTextChange()` lexical suppression to prevent false dirty triggers.
- **Physical Open / Restore Suppression**: Sidebar physical opening, Workspace Index file selection, automatic active-file reopening, and Navigation History restoration use the controlled programmatic text path.
- **Genuine Input Behavior**: Real typing still correctly triggers dirty=true, debounced map/preview render, and autosave.
- **Mode Session bridge**: Isolated Editor and Slides modes use a narrow state bridge rather than physical opens.

---

## 7. Navigation History Recovery
- **Status**: ✅ Completed & Integrated (Navigation History V1)
- **Opener Contract**: Back and Forward handlers register an opener, awaiting and logging Navigation results.
- **Workspace File & Virtual Restore**: Handles physical files (`workspace-file`) and virtual indices (`virtual-workspace-index`) safely.
- **Host Status Integration**: Accepts Host status `ACTIVATED` as success and `NOOP` only when requested workspace is already active.
- **Restore Stack Isolation**: Navigation uses `historyMode = 'restore'` to prevent generating normal navigation entries. Failed restores block stack commits, bounding rollback safely.
- **Return Independence**: Independent of standard Back/Forward stack.

---

## 8. Verification Summary
- **Validated**: Same-tab reload, panel toggles, physical programmatic open paths, and back/forward stack traversal verified.
- **Pending/Required**: Editor-to-Slides Mode Session restoration text/filename/dirty independence remains unverified manually in current repository logs. Marked as pending verification task.

---

## 9. Known Limitations
- **Navigation History Performance**: Under physical history restoration, full document-open and render paths are executed, sometimes triggering complete Workspace Index rebuilds.
- **Optimization Opportunity**:
  - Differentiate active-file navigation from workspace-content changes.
  - Reuse Index when content is unchanged.
  - Refresh only active-file-dependent presentation layers.
  - *Status*: Deferred (no active work).

---

## 10. Deferred Architecture
- **Projects Workflow**: Standalone-first Markdown projects with structured metadata and archive support.
- **Report Mode**: Draw.io templates mapped using structured tags, CSV exports, PPTX presentation output.
- **Reveal.js**: Isolated prototype followed by deferred PWA integration.
- **Mermaid**: Markdown-native Markdown rendering.
- **Workspace Migrations**: Migration of EditorWorkspace, SlidesWorkspace, and ReportWorkspace to Host foundation.

## Architectural invariants

- Standalone Editor does not require a Journal workspace.
- Journal remains the authoritative owner of physical workspace files.
- Workspace Index is a virtual, read-only projection.
- Return to Workspace is a presentation action, not a Navigation History action.
- Task Review remains the canonical task panel.
- One Workspace Index state is shared by dependent features.
  - Archive is preferred over destructive deletion for managed workspace records.
