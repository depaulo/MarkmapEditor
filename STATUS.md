# MarkMapJournal Release Status

## Program Position (Gate 1)

- **Release `0.6.2` — Notes Workspace Foundation**: ACCEPTED and published.
- **ACT V0 — Sidebar hierarchy, badge consistency, Archive action ownership**:
  IMPLEMENTED and mobile-accepted. Presentation only. Part of the accepted 1.0
  baseline. Proof suite: `scripts/workspace-sidebar-visual-validators.cjs`
  (50 fixtures, 0 failed).
- **Canonical 1.0 architecture synchronization**: COMPLETE (Gate 1 accepted).
  Canonical file:
  `docs/architecture/MarkmapEditor_1.0_PRODUCT_ARCHITECTURE_AND_IMPLEMENTATION_PROGRAM.md`
- **Package 2 implementation**: ACT 2A **CLOSED and device-accepted**.
  - ACT 2A static acceptance: normalized Task contract in the single Task
    lifecycle owner; shared effective-status handling for Review and Board; pure
    Workspace / Current Document projection; visible `#p1`/`#p2`/`#p3` as the
    canonical write form; `mme-task: priority=` retained read-only as a legacy
    fallback; no-priority expressed as the absence of any priority marker.
  - ACT 2A.1 priority-neutral matching: `canonicalTaskText()` now ignores only
    recognized `#p1`/`#p2`/`#p3` tokens for lifecycle matching identity, so a
    priority-only mutation is lifecycle-neutral. Ordinary hashtags remain visible
    Task content and remain part of matching identity. Proven cause of the
    former false `ambiguous=1`: the matcher stripped the `mme-task` comment but
    retained the visible `#pN` token, so the LCS produced a replacement region
    instead of a match. A status transition never had this defect, because
    status is written into the comment the matcher already removes.
  - Real-device acceptance (owner S22/DeX, disposable Workspace Note): exact
    source Task located; **P2 written successfully**; **Clear removed the
    priority successfully**; physical Save succeeded; Save baseline refreshed
    only after success; Workspace Index rebuilt; Task Review refreshed; Task
    Board remained operational; **both priority-only Saves reported
    `changed=false opened=0 completed=0 reopened=0 ambiguous=0`**. No physical
    data loss observed.
  - **Non-blocking observation (transient projection)**: an intermediate refresh
    briefly reported `tasks=0` and `tags=0` before the final Save rebuild restored
    `tasks=1` and `tags=3`. No persistent data loss and no incorrect final Index
    were observed. **No runtime change was made for it.** Any future correction
    requires a focused reproduction proving persistent or user-visible impact.
  - **ACT 2B**: NEXT, NOT STARTED.
  - **ACT 2C**: CONDITIONAL — the duplicate checkbox-toggle line grammar in
    `js/workspace/task-review.js` (`([ xX])(`) remains tracked. Execute only if
    Package 2 source evidence proves it necessary.
  - Planning handoff:
    `docs/architecture/MarkmapEditor_1.0_PACKAGE_2_TASK_STABILIZATION_PLAN.md`.

**Not started, and not authorized by any document here:** ACT 2B, Task Board
priority selection, Wiki Links changes, Standalone Notes, Projects, Reports,
Active or Workspace Index disclosures, pane-layout changes.

**Explicitly NOT delivered by Package 2:** no Task Board priority selector, no
Board redesign, no automatic priority sorting, no Active or Workspace Index
cards, no version or cache change, no promotion to `main`.

---

## 0.1. Notes Workspace Foundation — Release 0.6.2

- **Release**: `0.6.2` — Notes Workspace Foundation.
- **productVersion**: `0.6.2`
- **cacheIdentity / APP_VERSION**: `markmap-journal-pwa-0.6.2-notes-workspace-foundation`
  — single authoritative owner `sw.js`; mirrored by `js/release/release.js`;
  parity enforced by `scripts/release-parity.cjs`.
- **Accepted architecture**: see `docs/architecture/MarkmapEditor_Notes_Knowledge_Workspace_1_0_PLAN.md`.
- **1.0 program architecture**: see
  `docs/architecture/MarkmapEditor_1.0_PRODUCT_ARCHITECTURE_AND_IMPLEMENTATION_PROGRAM.md`.
- **Migration guidance**: `docs/WORKSPACE_FORMAT.md`.
- **Status**: implementation accepted and published.

### ACT V0 result (accepted baseline)

- Global Workspace actions are exactly **Open Workspace · Today · New Note**.
- **Archive / Restore belongs to the Active panel action row** and uses the single
  metadata writer. The former global "Archive Active" control, its physical
  `archive/` copy-and-remove workflow, and its second click lifecycle were removed.
- Sidebar badges no longer repeat their panel title (`0 related` -> `0`,
  `<n> tags` -> `<n>`). Compound badges carrying a real state or a second metric
  (Active `Note`, Report `Config`, Workspace Index `62 files - 195 open`) were kept.
- Panel title weight has a single owner; the Archive panel uses the same generic
  sibling separator as every other Workspace panel.
- No parser, metadata-writer, YAML, Archive-semantics, Notes-storage, navigation,
  Task, Wiki Links, Projects, Report, pane-layout, version or cache change.

### Accepted boundaries (intentional, not gaps)

| Area | Boundary |
| --- | --- |
| Legacy migration | No automatic migration of `journals/` / `concepts/` Workspaces. Legacy Workspaces are rejected. |
| Filename rename | No Rename File workflow. |
| Wiki Links | No automatic link rewriting. |
| Assets | No non-Markdown asset browser. |
| Notes calendar | No monthly calendar. |
| Reminders | Not implemented. |
| Shared attributes | No shared `@` layer, no autocomplete. |
| Diagrams | No Mermaid / Graph completion. |
| Slides | No Reveal.js completion. |
| Draw.io | No internal architecture redesign. |
| Journal mode | Application context mode is still internally named `journal`; full removal deferred. |

### Deferred next-cycle work

Rename File and automatic Wiki Link rewriting, monthly calendar, extraction to
Knowledge, non-Markdown assets browser, Reminders, referencable Highlights, the
shared `@` attribute layer with autocomplete, Mermaid/Graph, Reveal.js
completion, Draw.io internal redesign, major visual redesign, and a full
people/assignment system. See `NEXT_CYCLE_PLAN.md` for the source-proven
sequencing.

---

## 0. Notes Architecture Gate 0 (2026-09-25)

- **Gate 0**: ACCEPTED with final sequencing amendments (source-proven architecture audit, `development` @ `a3537eb`).
- **ACT 0**: COMPLETE — canonical plan adopted at `docs/architecture/MarkmapEditor_Notes_Knowledge_Workspace_1_0_PLAN.md` (commit `4311a1b`); the superseded `MarkmapEditor_Document_Scope_and_Optional_Workspace_PLAN.md` deletion was accepted; the upload artifact `MarkmapEditor_Notes_Knowledge_Workspace_1_0_PLAN_UPDATED.md` was removed.
- **ACT 0.1**: COMPLETE — Section 1 reconciled against the authoritative release owners (`js/release/release.js`, `sw.js`): productVersion `0.6.1`, cacheIdentity/APP_VERSION `markmap-journal-pwa-0.6.1-foundation-closure`. The Screen Layout (v62) and v58 narratives were retained and explicitly labelled **historical**; no historical checkpoint data was rewritten.
- **Next authorized boundary**: ACT 1A (strict read-only Workspace format detection) — AUTHORIZED by the owner; implementation only, acceptance pending.
- **Scope**: documentation only. No runtime, version, cache or Service Worker changes were made.

---

## 1. Current Release / Checkpoint
- **Branch**: `development`
- **productVersion**: `0.6.2`
- **cacheIdentity / APP_VERSION**: `markmap-journal-pwa-0.6.2-notes-workspace-foundation`
  — single authoritative owner `sw.js`; mirrored by `js/release/release.js`;
  parity enforced by `scripts/release-parity.cjs`.
- **Status**: 0.6.2 Notes Workspace Foundation. The Notes architecture is
  accepted. This is the first release whose cache identity changes to carry the
  Notes implementation, so an installed 0.6.1 client follows the existing
  user-controlled Update Ready workflow. The Screen Layout (v62) and
  v58 checkpoints recorded below are **historical** and no longer describe the
  current release.

---

## 1a. Screen Layout State (historical — v62 checkpoint, superseded by 0.6.1)

> **Retained for history only.** The identity, checkpoint commits and pending
> browser procedures in this section belong to the superseded
> `markmap-journal-pwa-v62-screen-layout-closure-v1` package. The current
> release identity is `0.6.1 / markmap-journal-pwa-0.6.1-foundation-closure`
> (see Section 1).
>
> - **Historical checkpoint commits (Screen Layout S1–S4B)**: `d241e9c` (S1),
>   `677c2b7` (S2), `7264be3` (S3), `c80dfc4` (S4A), `4e6237c` + `0c98d8c`
>   (S4B, final).
> - **Historical APP_VERSION**: `markmap-journal-pwa-v62-screen-layout-closure-v1`.

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
- **PWA closure (historical)**: `css/view-layout.css` and `js/ui/view-layout.js` added to the
  `sw.js` deterministic precache; the cache identity at that time was
  `markmap-journal-pwa-v62-screen-layout-closure-v1` (since superseded by
  `markmap-journal-pwa-0.6.1-foundation-closure`). The clean-install, update and
  offline-reload browser acceptance listed in `VERIFY.md`: **PENDING (historical
  package)**; static/cache consistency checks passed.

Architecture owner:
`docs/architecture/MarkmapEditor_Screen_Layout_ARCHITECTURE.md`.

Intentionally excluded (not implemented): vertical pane stacking, mobile
primary-pane state, mandatory mobile switcher, mobile Sidebar drawer,
orientation pane reorder, native Fullscreen API, arbitrary docking, saved
custom layouts, per-document layout persistence.

---

## 1b. Legacy v58 Status (historical — superseded narrative, retained for history)
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
