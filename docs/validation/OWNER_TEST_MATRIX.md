# Owner → Test Matrix

Select tests by changed owner. For each owner: Tier 0 always, the smallest
smoke, the targeted suites that can actually invalidate the owner, whether
Tier M is required, the physical checkpoint if any, and dependent domains.
Do not run every Workspace suite after every edit — map `js/main.js` changes
by functional owner or source range (ranges are indicative; verify with
symbol search).

| Owner | Tier 0 | Tier 1 smoke | Tier 2 targeted | Tier M | Browser/device | Dependent domains |
|---|---|---|---|---|---|---|
| js/workspace/workspace-parser.js | node --check, git diff --check | — | project-contract (434) | yes — project-contract-mutation-controls | none (static sufficient) | Projects, Reports parity, Tasks (declaration grammar) |
| js/workspace/project-metadata-mutation.js | node --check | — | project-contract (group U), project-consumer, project-save-integration | yes — contract + consumer controls | none | Projects apply, Workspace Index |
| js/workspace/project-visual-adapter.js | node --check | — | project-view (523), project-save-integration, project-device-acceptance | yes — project-view-mutation-controls | owner apply checkpoint | Projects view, sidebar (route return), Workspace Index rebuild |
| js/workspace/projects-view.js | node --check | — | project-view | yes — project-view controls | owner visual checkpoint (desktop + narrow) | workspace.css, main.js apply bridge |
| js/main.js — Projects/apply bridge (buildApplyPlan, drafts, project route) | node --check | — | project-view, project-consumer | yes — view controls | owner apply checkpoint | route/session, Workspace Index |
| js/main.js — Workspace Index builder + badge (buildWorkspaceIndex, #workspaceIndexBadge) | node --check | — | workspace-sidebar-visual (B21), workspace-task-consumers, workspace-index-notes | no | owner sidebar checkpoint | Tasks, Projects, Notes projections |
| js/main.js — Task Board render/filter owners | node --check | — | workspace-task-contract, workspace-task-consumers | no unless contract changes | owner Task Board checkpoint | route/session, sidebar |
| js/main.js — Quick Action metadata (applyActiveNoteMetadata, patchNoteMetadata) | node --check | — | workspace-note-metadata, workspace-notes-sidebar, workspace-index-notes | no | owner Quick Action checkpoint (Save must be physical) | Sidebar, Workspace Index, dirty state |
| js/main.js — Notes/Knowledge sidebar projections | node --check | — | workspace-notes-sidebar, workspace-note-metadata | no | owner sidebar checkpoint | Archive, Index |
| js/main.js — renderer (renderHtmlWithShiki, escapeHtml) | node --check | — | html-preview-render | no | HTML preview spot-check | Wiki Links |
| css/workspace.css | git diff --check | — | project-view (columns/grid), workspace-sidebar-visual | no | owner visual checkpoint (laptop/Termux X11/DeX/phone) | Projects view, Task Board, sidebar |
| js/tasks/task-lifecycle.js + reconcile path | node --check | — | workspace-task-contract, task-reconcile | no unless contract changes | Task completion/reopen checkpoint | Save reconciliation, Index |
| js/tasks/task-board.js (review/board presentation) | node --check | — | workspace-task-contract, workspace-task-consumers, workspace-index-task-filter | no | owner Task Board checkpoint (widths, filters, scroll) | route/session, sidebar |
| Task Review owners | node --check | — | workspace-task-consumers, workspace-task-contract | no | owner checkpoint if presentation changes | Task Board, Index |
| Workspace Index document (workspace-index-document.js) | node --check | — | workspace-index-notes, workspace-index-task-filter, workspace-task-consumers | yes — index-task-filter controls if filter contract changes | owner index checkpoint | Projects (Stage/State parity), Tasks, Notes |
| Notes/Knowledge/Archive (storage/scanner/metadata) | node --check | — | workspace-storage, workspace-note-creation, workspace-note-metadata, workspace-notes-sidebar | no | owner sidebar checkpoint | Index, dirty state |
| Report owners (js/report/*, Report parity groups) | node --check | — | project-contract group Q, project-consumer Report parity (no standalone Reports suite) | no | deferred with Reports package | Projects, Notes (read-only) |
| Route/session owners (js/core/mode-session.js, host switchTo) | node --check | — | mode-session, project-view (route return) | no | owner navigation checkpoint | Projects, Task Board, Index |
| Help (js/ui/help-content.js) | node --check | — | release-notes-validators (shared content contract) | no | owner Help read-through | Release Notes |
| js/release/release.js | node --check | release-parity | release-parity strict | no | release activation (Stage D only) | sw.js, Release Notes |
| sw.js | node --check | release-parity | dependency-cache-validators, update-ready-validators | no | Service Worker activation (Stage D) | release.js, offline behavior |

Rules:

- Inherited accepted evidence is rerun only when a changed owner can
  invalidate it (docs/AI_DEVELOPMENT_WORKFLOW.md §32).
- Tier M runs only in disposable copies, sequentially
  (TEST_CATALOG Profiles: `npm run validate:mutation:projects`).
- Static fixtures never substitute for the browser/device checkpoint column.
