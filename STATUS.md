# MarkMapJournal v58 Release Status

## 1. Current Release / Checkpoint
- **Branch**: `development`
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

---

## 11. Report & Draw.io MVP (Current Alignment)

This section reflects the current alignment as of checkpoint `2c03960` (H4).
Earlier checkpoint sections above remain a historical record.

### Product state
- **ACT G (Quick Report + Report lifecycle):** Complete and committed.
  Dictionary, Markdown generator, Report panel, tokenized Report Notes,
  virtual/saved Report lifecycle, Save/Discard/Cancel protections, physical and
  auxiliary document-switch navigation guards, saved-Report reopening, and
  Task-reconciliation exclusion are implemented.
- **H1 (Reviewed Markdown importer):** Complete and committed at `e738ec3`.
  Pure importer registered via `js/app/script-loader.js`, exposing
  `globalThis.MME_REPORT_MARKDOWN_IMPORT`. No workspace rescan; reviewed Markdown
  remains authoritative. Dormant validator passes 39/39 in Node.
- **H2 (Draw.io reconciler):** Complete and committed at `f1a82b5`. Pure
  reconciler registered via `js/app/script-loader.js`, exposing
  `globalThis.MME_DRAWIO_REPORT_RECONCILER`. Accepts uncompressed Draw.io XML
  only; compressed templates rejected with a fatal diagnostic. Dormant validator
  passes 60/60 in Node; sanitized H1-to-H2 integration passes.
- **H3 (Reconciliation UI):** Implemented and committed at `a1c39dc`.
  Runtime-registered via `js/app/script-loader.js`, exposing
  `globalThis.MME_DRAWIO_REPORT_PANEL`. A user-facing reconciliation overlay is
  available from the Report sidebar panel. Runtime qualification, button
  availability, Report collapse, overlay open/Close, picker cancellation,
  no-template blocking, mobile open/Close, and session Close are
  browser-confirmed. Dormant validator passes 38/38 in Node. Real-template
  desktop acceptance is pending.
- **H4 (Draw.io output delivery):** Complete and committed at `2c03960`.
  The Generate Draw.io action inside the existing H3 overlay rereads the
  current Report Markdown on every attempt, reruns the final H1 import and
  final H2 reconciliation, enforces the clean generation gate (no-session,
  no-template, invalid/compressed/no-placeholder templates, missing values,
  unknown placeholders block generation; unused Report fields never do),
  populates XML exclusively through H2 `populateTemplate()`, and delivers one
  editable `.drawio` artifact as a separate file (`<report>-visual.drawio`) via
  Save As picker or download fallback without modifying Report state or the
  template. Runtime additions on `globalThis.MME_DRAWIO_REPORT_PANEL`:
  `generateDrawioOutput()` and `validateDrawioOutputDelivery()`. Output-delivery
  validator passes 51/51 in Node (adapter-mocked); browser-only acceptance —
  real Save As dialog, picker cancellation, download fallback, real-template
  end-to-end acceptance, generated-file opening in Draw.io, mobile
  reachability — is pending.

### Architecture invariants
- Markdown is canonical; reviewed Markdown edits are authoritative.
- Draw.io is a generated artifact, not a canonical source.
- Reviewed Markdown feeds Draw.io via exact `{{field name}}` tokens.
- No user-facing translation or synonym layer.
- First MVP: one uncompressed `.drawio` template and one generated output.
- Missing fields return to Markdown under `## Template Fields`.
- Manual copy-and-paste fallback is an architectural requirement.
- Grouping (customer/owner/Project/Tag) is deferred.
- No embedded Draw.io editor in the thin MVP.
- Screen improvements (fullscreen Markmap, fullscreen HTML, presentation
  layout, vertical output) are planned after the Draw.io MVP.

### Known limitations
- Report recognition requires leading `type: report` frontmatter.
- Token values are one line; section-derived fields preserve multiline Markdown.
- H1 imports Template Fields but does not insert them automatically.
- H2 reconciler supports uncompressed Draw.io XML only and direct textual
  token replacement only; no semantic Draw.io editing; blank and unknown
  placeholders are preserved verbatim in generated output.
- H3 reconciliation UI supports uncompressed template selection, review of the
  four categories, insertion of missing fields into Markdown, and Reconcile
  Again; real-template desktop acceptance is pending.
- Draw.io output delivery (H4) is source-complete and Node-validated but not
  yet browser-accepted: real Save As via showSaveFilePicker, picker
  cancellation, download-fallback delivery, real-template end-to-end
  acceptance, opening the generated `.drawio` in Draw.io, and mobile
  reachability of the Generate action remain pending.
- No compressed Draw.io template support and no automatic grouping.
- BOM before Report frontmatter is unsupported in H1.
- Report files stored physically under `journals/` may follow Journal workspace
  classification when opened through that workspace.

### PWA / versioning
- `sw.js` and `APP_VERSION` (`markmap-journal-pwa-v60-task-metadata-v1`) remain
  unchanged for this package. PWA cache and APP_VERSION finalization are
  deferred to the separate Draw.io MVP Closure package.
- Current source requiring cache review for that package:
  `js/report/drawio-report-panel.js`, `js/main.js`,
  `js/report/drawio-report-reconciler.js`, and `css/workspace.css`.
- Offline and update-path validation remain pending until that closure
  package passes.