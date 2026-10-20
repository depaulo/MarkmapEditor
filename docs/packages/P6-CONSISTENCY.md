# Package 6 — Expanded-View Behavior and Visual Consistency

**Version target:** 0.8.x (activation NOT authorized)
**Package plan:** `docs/architecture/consistency-package-plan.md`
**Plan-0 inventory:** `docs/architecture/CONSISTENCY_PLAN_0_SURFACE_INVENTORY.md`

## Status

- Branch: `development` (all Package 6 work; `main` is release-integration only)
- PLAN-0: complete (source-proven inventory, zero production changes)
- ACT 1: complete and accepted (2026-10-18)
- ACT 2 Slice 1: complete and accepted (owner browser checkpoint 2026-10-18)
- ACT 2 Slice 2: Inspection and Return Recovery Alignment — complete and accepted (on `development`)
- ACT 2 Slice 3: Overlay Exit, Transient State, and State-Copy Consistency — complete and accepted (on `development`)

## ACT 1 — Projects Source filter (ACCEPTED, commit 66e3b7a)

- **Objective:** rendered Source filter for the Projects view with exact
  `sourcePath` identity matching; module-local state only (no persistent
  storage).
- **Owners touched:** `js/workspace/projects-view.js`
  (`viewState.filters.source`, `sourceOptions`/`baseNameOf`/`dirOf`/
  `normalizeSourceValue`, exact-match `applyFilters`, `buildProjection`
  `<select data-filter="source">` with duplicate-basename disambiguation,
  `setFilter`/`clearFilters`/`resetViewState`);
  `scripts/project-view-validators.cjs` (F01/F10 realigned; S01–S11 Source
  group added).
- **Static evidence (2026-10-18):** view 534/534; contract 434/434; consumer
  163/163; save-integration 103/103; device-acceptance 74/74; mutation-anchor
  164/164; `git diff --check` clean.
- **Browser evidence:** owner physical checkpoint (Mme-test-new, 8 projects):
  options with duplicate-basename disambiguation ("base — dir"), exact-source
  filtering, All Sources/clear/reset, empty-vs-filtered-empty copy, in-memory
  persistence across close/reopen, scroll preservation.
- **Observation (Q4-relevant, not a defect):** when one physical file is
  reachable from two Workspace roots, option labels differ only by root
  suffix ("Project Alpha — Workspace-Client" / "— Workspace-Archive"); the
  disambiguation grammar cannot distinguish a within-root duplicate basename.
  The exact-`sourcePath` filtering contract stays correct; any label change
  requires an owner ruling.
- **Note:** `Legacy:` fallback option renders when a stored selection no
  longer exists in the current index — proven rendering fallback, not a
  filter bug.

## ACT 2 — first bounded consistency slice (IN PROGRESS)

- **Objective (consistency-package-plan §11):** Projects + Workspace Index
  expanded-view behavioral consistency — exit/return semantics, scroll
  ownership, empty vs filtered-empty state presentation.
- **Method:** re-verify PLAN-0 divergences (B1/V1/E1/F1) against current
  source; implement only differences proven inconsistent, within current
  owners; targeted static validation + owner browser checkpoint per ACT.
- **Protected scope:** Task Board overlay conversion not authorized; no
  Reports changes; no 0.8.x activation; no service-worker/version/cache
  changes; no persistent filter storage; no generic expanded-view framework;
  domain models stay separate.

### Slice 1 — pre-edit source-proven record (2026-10-18)

Inspection owners re-read: `js/workspace/projects-view.js`,
`js/workspace/workspace-index-workspace.js`,
`js/workspace/workspace-index-document.js`, `js/tasks/task-board.js`,
`js/navigation/navigation-history.js`, `css/workspace.css`.

Confirmed inconsistencies (implemented in this slice):

| # | Inconsistency | Evidence (current source) |
|---|---------------|---------------------------|
| A2-1 | Workspace Index Return label escaping is a NO-OP — `String(label).replace(/</g, '<').replace(/>/g, '>')` replaces each character with itself; a journal fileName containing markup is injected raw into `innerHTML`. Projects escapes via its `escapeAttr`/`escapeHtml` discipline. | workspace-index-workspace.js buildReturnButtonHtml; `grep -c '&lt;'` on the file = 0 |
| A2-2 | Workspace Index Return control has NO `aria-label`; the Projects Return control carries `aria-label="Back to Workspace"`. One exit control announces its target to assistive tech, the other relies on visible text only. | workspace-index-workspace.js buildReturnButtonHtml vs projects-view.js:878 |
| A2-3 | Project-filter changes in Workspace Index call `rerenderProjectionWithAnchor()` with NO anchor → `oldTop=null` → NO scroll restore → `scrollTop` resets to top, while the in-file comment claims "stay anchored near the Projects section". Projects preserves its scroll owner across every destructive re-render. Disclosure and Task-filter rerenders (anchor path) already preserve. | workspace-index-workspace.js onProjectFilterClick/onProjectFilterChange + rerenderProjectionWithAnchor |
| A2-4 | Workspace Index close/reopen loses scroll: `deactivate()` hides the container but `activate()` rebuilds `innerHTML`, resetting scroll to top. Projects restores saved offsets on `renderInto`. The container is its own scroll owner (`css/workspace.css .workspaceIndexView { overflow-y: auto }`). | workspace-index-workspace.js activate/deactivate; css/workspace.css:2752 |

Recorded, NOT implemented (owner ruling or separate ACT required):

- B1 visible return-label grammar ("← Return to X" vs "← Back to Workspace")
  — open Q1; slice changes accessible naming only, visible copy untouched.
- B2 inspection recovery exists only for Projects (ACT 5D accepted) —
  convergence is a new interaction contract, owner ruling required.
- E1/F1 (exit grammars, filter persistence) — Task Board stays a modal
  overlay; no lifecycle conversion authorized.
- Q5 copy divergence "No Projects found." (Index) vs "No Projects yet."
  (Projects view) — copy-only; both surfaces already distinguish empty vs
  filtered-empty ("No Projects match the current filters."), so the
  empty-vs-filtered-empty behavior is CONSISTENT and out of slice.
- Escape semantics: Task Board closes on Escape (overlay); routed views do
  not (PR05 accepted Escape as no-op after close) — not converged.

Authorized implementation (this slice): `js/workspace/workspace-index-workspace.js`
only — real `escapeIndexLabel()` on the Return label (text + new
`aria-label="Return to …"`), module-local scroll preservation with the
Projects-style clamp grammar across no-anchor rerenders, `refresh()`, and
close/reopen (`deactivate` captures, `activate` restores). Validators: new
W01–W08 group in `scripts/workspace-index-task-filter-validators.cjs` and
mutation controls F11–F13 in
`scripts/workspace-index-task-filter-mutation-controls.cjs` (Tier M, run in a
disposable copy).

### Slice 1 — validation evidence (2026-10-18)

Static:
- workspace-index-task-filter: 64/64 PASS (W01–W08 added)
- workspace-index-notes: 58/58 PASS
- project-view 534/534; contract 434/434; consumer 163/163;
  save-integration 103/103; device-acceptance 74/74
- mutation-anchor-audit: 167/167 anchors
- Tier M (disposable copy `../tierm-p6act2`, removed after the run): 13/13
  behavioral controls bit — including new F11 (aria-label removed), F12
  (escape reverted to no-op), F13 (scroll restore dropped) — with
  byte-identical restores and green baselines after every restore; both
  structural guards clean
- `git diff --check` clean

Browser: owner checkpoint ACCEPTED 2026-10-18 — project-filter scroll
preservation passed; close/reopen scroll restoration passed; Return target
remained correct; no unexpected Save or mutation observed; application
remains at released version 0.7.0.

### Slice 2 — Inspection and Return Recovery Alignment (ACCEPTED, commits 78a1528 + 85feeac + closure commit 13e9b88)

- **Objective:** align source inspection and return recovery between Projects
  Expanded View and Workspace Index; prove Task Board isolation.
- **Owners touched:** `js/workspace/projects-view.js`
  (`openProjectSource` arms `setInspection(true)` on cancelled/thrown);
  `js/workspace/workspace-index-workspace.js`
  (`ensureReturnToIndexButton`/`setIndexInspection`/`returnToIndex` recovery
  control; rollback extended to `!opened || ok === false || cancelled ===
  true` with distinct cancel/failure toasts; `activate()`/`refresh()` pass
  `taskFilter` to `buildProjection` and no longer reset `projectFilters`/`taskFilter`);
  `css/workspace.css` (`.wsIndexReturnToIndex` mirrors
  `.projectsBackToProjects`); `dom-shim.cjs` (`closest()` compound selectors,
  `contains()`, `dataset` getter); validators + mutation controls.
- **Static evidence (2026-10-19):** project-view 536/536 PASS; inspection
  validators IX01–IX15 15/15 PASS; workspace-index task/filter 64/64 PASS;
  `git diff --check` clean.
- **Browser evidence (owner checkpoint 2026-10-19):** normal Project source
  inspection PASS; Return to Projects PASS; Project Source/Search/filter
  restoration PASS; Project scroll restoration PASS; normal Workspace Index
  source inspection PASS; Return to Workspace Index PASS; Index Project and
  Task filter restoration PASS; Index scroll restoration PASS; cancellation
  recoverable PASS; recovery controls not duplicated or stranded PASS; Task
  Board overlay regression PASS; no unexpected Save PASS; no unexpected
  source mutation PASS. Same-session transient state preserved; full browser
  refresh may reset transient state; no persistent browser storage; released
  identity remains 0.7.0.

## Open owner questions (PLAN-0 Q1–Q8, still open)

Q1 return-label contract; Q2 Task Board overlay question; Q3 badge placement;
Q4 filter-persistence policy; Q5 empty/loading/failure shared contract; Q6
`virtual-projects` route participation; Q7 scroll-owner grammar adoption; Q8
disclosure grammar consolidation. ACT 2 must not pre-empt these rulings —
only proven inconsistencies inside the authorized slice are implemented.

## ACT 2 Slice 3 — Source Inspection Matrix (overlay exit, transient state,
state-copy consistency)

Slice 3 scope: E1 (Task Board overlay exit grammar), F1 (transient
filter/state lifecycle consistency), Q5 (empty, filtered-empty, unavailable,
failure and refusal presentation). No Task Board lifecycle conversion; no
Reports changes; no persistent browser storage; no broad redesign.

### Surface matrix

| Surface | Task Board | Projects Expanded View | Workspace Index |
|---|---|---|---|
| Lifecycle type | Modal overlay (`role=dialog`) | Routed Host workspace | Routed Host workspace |
| Activation owner | `open(invokerButton)` — task-board.js:1285 | `activate()` — projects-view.js:1534 | `activate()` — workspace-index-workspace.js |
| Visible exit | Close button (`aria-label="Close Task Board"`, task-board.js:1058-1064) | Return row (`← Back to Workspace`, projects-view.js:813-814) | Return button (`← Return to …`, workspace-index-workspace.js) |
| Escape behavior | Calls same `close()` (task-board.js:1099-1105) | No-op (PR05 accepted) | No-op |
| Return destination | Not used to close overlay | Restores Projects view + filters + scroll | Restores Index view + filters + scroll |
| Previous-context owner | `lastInvoker` (task-board.js:63, focus restored on close) | `presentationSnapshot` + Navigation History | `previousWorkspace` (informational) |
| Filter-state owner | **localStorage** (task-board.js:37-51) — DONE_WINDOW_KEY, PRIORITY_FILTER_KEY, SORT_KEY, SOURCE_FILTER_KEY | Module-local `viewState.filters` (projects-view.js:75-76) | Module-local `projectFilters`/`taskFilter` (workspace-index-workspace.js:30-40, 53) |
| Scroll owner | Independent column scroll owners (CSS tracks) | `data-projects-scroll-owner` clamp (projects-view.js:773) | `savedScrollTop`/`restoreScrollTop` (workspace-index-workspace.js:55-77) |
| Close/reopen behavior | Overlay dismissed; filters/scroll from localStorage | Filters + scroll preserved in-session | Filters + scroll preserved in-session |
| Full-refresh behavior | Transient state resets | Transient state resets | Transient state resets |
| Domain-empty owner | N/A (task domain) | `"No Projects match the current filters."` (line 756) | `wsIndexEmpty` class |
| Filtered-empty owner | N/A | `"No Projects match the current filters."` — filters + Clear remain reachable | `wsIndexEmpty` class |
| Unavailable owner | N/A | `"File not found"` toast; surface stays open | `"File not found: <path>"` toast; surface stays open |
| Failure owner | `task-board.js:90-94` toasts | batch result block + toasts (line 625-635) | rollback to Index + toasts |
| Mutation-refusal owner | Task lifecycle owner (MME_TASK_LIFECYCLE) | visual adapter batch entry | N/A (read-only Index) |
| Accessible labels | `aria-label="Close Task Board"` | Return aria matches visible text | Return aria matches visible text |
| Relevant validators | Task Board aggregate / T20 | PR01–PR23, F/S groups | W01–W08, IX01–IX15 |
| Proven inconsistency | **F1: localStorage usage** contradicts P6 policy "browser persistence: not authorized" / "Do not use localStorage"; Projects + Workspace Index both use module-local only | None — filter-state module-local, never persisted | None — filter-state module-local, never persisted |
| Intentional difference | Overlay exit = close/Escape (not Return); routed views use Return | Return behavior after source inspection; explicit Close when leaving surface | Return behavior after source inspection; explicit Close |

### Slice 3 findings

**E1 — Task Board overlay exit grammar: NO inconsistency proven.**
- Visible Close control present with correct accessible name (`aria-label="Close Task Board"`)
- Escape uses the same `close()` owner (no duplicate handler)
- `close()` hides overlay, restores focus to `lastInvoker`, triggers no Save
- `wired` flag prevents double wiring on re-open
- E1 items all conform to accepted lifecycle contracts

**F1 — Task Board filter persistence: PROVEN inconsistency.**
- Current behavior: Task Board persists `doneWindow`, `priorityFilter`, `sort`, `sourceFilter` to `localStorage` via `setStoredDoneWindow()`/`setStoredPriorityFilter()`/`setStoredSort()` (task-board.js:1118, 1134, 1150)
- Expected behavior: Module-local only (matching Projects and Workspace Index), no persistent browser storage per P6 policy
- Smallest safe correction: replace `localStorage` reads/writes with module-local variables in task-board.js; existing `getStored*`/`doneWindowFromStored` readers updated to read module-local state
- Surfaces intentionally different: none — all three surfaces should use module-local filter state

**Q5 — State-copy/empty vs filtered-empty: NO inconsistency proven.**
- Projects: `"No Projects match the current filters."` (line 756) — correctly filtered-empty; filters + Clear filters button remain reachable (`renderEmpty()` line 795-805)
- Workspace Index: filter-state module-local; empty state consistent with filtered-empty distinction
- No copy divergence requiring runtime correction

## ACT 2 Slice 3 Closure (ACCEPTED)

**Implemented:** replaced Task Board localStorage filter persistence with
module-local state (`js/tasks/task-board.js`). No new global store; Task Board
module owns its own state.

**Accepted lifecycle:**
- same-session close/reopen preserves Task Board filters;
- full browser refresh resets transient filters;
- no persistent browser storage is required.

**Inspection-only conclusions:**
- Task Board exit grammar was already consistent — no runtime correction required.
- empty and filtered-empty semantics were already consistent — no runtime correction required.

**Owner browser evidence:** Task Board opened successfully; same-session behavior passed;
post-refresh reset passed; no unexpected Save or mutation observed. Released identity
remains 0.7.0.

## Package 6 Remaining-Scope Assessment — CORRECTED

The previous conclusion "Package 6 implementation complete" is rejected.
Package 6 ACT 2 implementation is complete. Package 6 continues with ACT 3
Sidebar Information Architecture.

## ACT Sequence (accepted)

| ACT | Name | Status |
|---|---|---|
| ACT 1 | Projects Source filtering | ACCEPTED (commit 66e3b7a) |
| ACT 2 | Existing Expanded View behavior and state consistency | ACCEPTED (Slices 1–3) |
| ACT 3 | Sidebar Information Architecture | Slices 1–3 complete after structural correction (static + executed-DOM gates passed; integrated browser acceptance pending) |
| ACT 4 | Current Document, Edit/Read and Document Surface | planned |
| ACT 5 | Cross-surface visual, responsive and accessibility consistency | planned |
| ACT 6 | Package closure and 0.8.0 release | not authorized |

**Package 6 ACT 2 implementation complete.**
**Package 6 continues with ACT 3 Sidebar Information Architecture (all slices complete after structural correction; integrated browser acceptance pending).**

## ACT 3 PLAN-0 — Sidebar Information Architecture

### Objective

Perform source inspection only. Do not reorganize Sidebar runtime in PLAN-0.
Identify current Sidebar owners and classify existing content into:

- Current Document
- File Knowledge
- Workspace Knowledge

Determine the smallest grayfield implementation plan.

### Sidebar Ownership Matrix

| Panel / Area | Container Owner | Render Owner | State Owner | Mutation Owner | Save Owner | Scope | Ordering | Disclosure Owner | Header Owner | Badge Owner | Responsive CSS Owner | Proposed Layer | Move Required | Runtime Risk | Relevant Validators |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Header / workspace creation | `index.html` + `js/main.js` | `index.html` | none | none (creation actions only) | none | Workspace | 1 | `#btnWorkspaceCollapse` | `#workspaceTitle` ("Notes Workspace") | Help: none | none | `css/workspace.css` | Open Workspace, Today, New Note | `WORKSPACE_STATE.rootHandle` | Workspace Knowledge | no | low | workspace-sidebar-visual |
| Search | `js/main.js` (`ensureWorkspaceSearchPanel`, `#workspaceSearchPanel`) | `js/main.js` | search input value (ephemeral) | none | none | Workspace | after Header, before Active | none (label + input, no disclosure) | `#workspaceSearchLabel` ("Search") | Help: none (label-input pattern) | `#workspaceSearchResults` (result count implicit) | `css/workspace.css` | typing + result selection | `WORKSPACE_INDEX_STATE`, `openWorkspaceFile` | Workspace Knowledge | no | low | workspace-search |
| Active File / Current Document | `js/main.js` (`ensureWorkspaceActivePanel`, `renderWorkspaceActivePanel`) | `js/main.js` | `WORKSPACE_STATE.activeFile` | `applyActiveNoteMetadata()` / `patchNoteMetadata()` | user-controlled Save | document | after Header, before Index | `workspacePanelHeaderButton` `data-workspace-panel-toggle="active"` | `workspaceActiveTitle` | `#workspaceActiveBadge` | `css/workspace.css` | Current Document | no | low | current-document-scope |
| Open Tasks / Task Review | `index.html` (`#workspaceTasksPanel`) + `js/workspace/task-review.js` | `js/workspace/task-review.js` (`renderTaskReview`, upgrades panel in place) | `filterState` (task-review.js) + `WORKSPACE_STATE.activeFile` (document scope) | lifecycle via `MME_TASK_LIFECYCLE` (task-review.js:841+) | user-controlled Save | document | after Related | `data-workspace-panel-toggle="tasks"` (`aria-expanded="false"`) | `workspaceTasksTitle` ("Open Tasks") | contextual Help via `attachContextualHelpButton` (`journal-tasks`, main.js:3698) | `#workspaceTasksBadge` ("N open") | `css/workspace.css` | open-source, priority edit, lifecycle actions | `WORKSPACE_STATE.activeFile`, `WORKSPACE_INDEX_STATE`, `findWorkspaceFileByPath`, `openWorkspaceFile` | File Knowledge | no | medium | workspace-task-contract, workspace-task-consumers |
| Related / Links In | `index.html` (`#workspaceRelatedPanel`) | `js/main.js` (`ensureWorkspaceRelatedPanel`) | none (derived from active file) | none | none | document | after Tasks, before Notes | `data-workspace-panel-toggle="related"` | `workspaceRelatedTitle` | none | `css/workspace.css` | File Knowledge | no | low | wiki-link-relationship |
| Notes | `index.html` (`#workspaceJournalsPanel`) | `js/workspace/workspace-sidebar.js` (inert/legacy) | none | none | none | Workspace | after Tasks | `data-workspace-panel-toggle="journals"` | `workspaceJournalsTitle` | `#workspaceJournalsBadge` | `css/workspace.css` | Workspace Knowledge | no | low | workspace-index-notes |
| Knowledge | `index.html` (`#workspaceConceptsPanel`) | `js/workspace/workspace-sidebar.js` (inert/legacy) | none | none | none | Workspace | after Notes | `data-workspace-panel-toggle="concepts"` | `workspaceConceptsTitle` | `#workspaceConceptsBadge` | `css/workspace.css` | Workspace Knowledge | no | low | workspace-index-notes |
| Archive | `index.html` (`#workspaceArchivePanel`) | `js/main.js` (`ensureWorkspaceArchivePanel`) | Workspace metadata | metadata writer (Archive/Restore action row) | user-controlled Save | Workspace | after Knowledge | `data-workspace-panel-toggle="archive"` | `workspaceArchiveTitle` | `#workspaceArchiveBadge` | `css/workspace.css` | Workspace Knowledge | no | low | package5 contract |
| Tags | `js/main.js` (`#workspaceTagsPanel`, dynamic) | `js/main.js` | `__workspaceActiveTag` (main.js) | tag toggle (main.js) | none | document | after Index | `workspacePanelHeaderButton` | header title | badge inline | `css/workspace.css` | File Knowledge | no | low | workspace-task-contract |
| Workspace Index panel | `js/main.js` (`ensureWorkspaceIndexPanel`) | `js/main.js` | `WORKSPACE_INDEX_STATE` | none (read-only) | none | Workspace | after Tags | `data-workspace-panel-toggle="index"` | `workspaceIndexTitle` | `#workspaceIndexBadge` | `css/workspace.css` | Workspace Knowledge | no | low | workspace-index-* |
| Workspace Index full view | `js/workspace/workspace-index-workspace.js` | `js/workspace/workspace-index-workspace.js` | module-local filters | none | none | Workspace | routed Host | `data-workspace-panel-toggle` | Return row | Return row | `css/workspace.css` | Workspace Knowledge | no | low | workspace-index-inspection, workspace-index-task-filter |
| Projects panel | `js/main.js` (`#workspaceProjectsPanel`, dynamic) | `js/main.js` | none | none | none | Workspace | toggleable | `data-workspace-panel-toggle="projects"` | header title | badge inline | `css/workspace.css` | Workspace Knowledge | no | low | project-view |
| Reports panel | `js/main.js` (`#workspaceReportPanel`, dynamic) | `js/report/report-panel.js` | Report state | none | none | Workspace | toggleable | `data-workspace-panel-toggle="report"` | header title | badge inline | `css/report/` | Outside Sidebar scope | no | low | report-panel |
| Resize handle | `index.html` (`#workspaceSidebarResizeHandle`) | `index.html` | none | none | none | Workspace | last | none | none | none | `css/workspace.css` | Outside Sidebar scope | no | low | visual |
| Navigation controls | `js/workspace/workspace-sidebar.js` (`renderNavigationControls`) | `js/workspace/workspace-sidebar.js` | history engine | none | none | Workspace | footer | none | none | none | `css/workspace.css` | Outside Sidebar scope | no | low | visual |

### Layer Classification

**Current Document** (document-scoped):
- Active File / Current Document panel (`js/main.js`, `WORKSPACE_STATE.activeFile`)
- Open Tasks / Task Review (`js/workspace/task-review.js`, document-scoped via `filePath`)
- Related / Links In (`js/main.js`, derived from active file)
- Tags (`js/main.js`, `__workspaceActiveTag`)

**File Knowledge** (document-scoped):
- (Open Tasks, Related, Tags as above — no additional File Knowledge panels identified)

**Workspace Knowledge** (Workspace-scoped):
- Header / workspace creation area
- Notes panel (`js/workspace/workspace-sidebar.js`, inert/legacy)
- Knowledge panel (`js/workspace/workspace-sidebar.js`, inert/legacy)
- Archive panel (`js/main.js`, metadata writer)
- Workspace Index panel + full view (`js/main.js` + `workspace-index-workspace.js`)
- Projects panel (`js/main.js`)
- Reports panel (`js/report/report-panel.js` — protected, unchanged)

**Outside Sidebar scope:**
- Resize handle
- Navigation controls

### Mixed-scope findings

None identified — each panel has a single clear primary scope.

### Active File / Current Document analysis

1. Does Active File already own document identity? **Yes** — `WORKSPACE_STATE.activeFile` with `path`, `name`, `handle`.
2. Does it already own source access? **Yes** — active file handle provides source access.
3. Which Quick Actions live there? **Metadata actions** (Pin, Unpin, Promote to Knowledge, Archive) via `applyActiveNoteMetadata()`.
4. Do Quick Actions trigger the accepted one-save owner? **Yes** — metadata patches the live buffer and marks dirty; Save is user-controlled.
5. Where does Edit/Read currently live? **Editor overlay controls** (`index.html` `#editorBtnEditToggle`, `js/main.js` mode ownership).
6. Who owns the selected mode? **`js/main.js`** — mode state in `WORKSPACE_STATE`/view-layout.
7. Can Edit/Read be moved visually without moving its state owner? **Yes** — visual relocation in Sidebar does not require state owner change.
8. Can the area remain visible while secondary details collapse? **Yes** — `workspacePanelHeaderButton` with `aria-expanded` supports collapse.
9. What happens with no active file? **`workspaceActiveEmpty`: "No active workspace file"** — panel hidden when no workspace.
10. What happens with an unwritable file? **`describeNoteActionTarget()` returns ineligible** with `no-active-note` / `not-a-workspace-note` / `report-active`.
11. What happens with a dirty file? **Dirty state tracked on buffer; Save is user-controlled.**
12. What happens after switching Workspace context? **`WORKSPACE_STATE.activeFile = null`** (line 5248).
13. Would adding Markmap to the same control overload the mode model? **Potentially** — Markmap is a separate mode; belongs to ACT 4.
14. ACT 3 vs ACT 4 boundary: ACT 3 = structural placement/placeholder only; ACT 4 = functional Edit/Read control, mode state ownership.

### Help owner / Action set / Dependencies (spec §7 companion — fields not in the wide table)

| Panel / Area | Help owner | Current action set | Dependencies | Accessible labels |
|---|---|---|---|---|
| Header / workspace creation | none | Open Workspace, Today, New Note | `WORKSPACE_STATE.rootHandle` | `title`/`aria-label` on buttons |
| Search | none (label-input pattern) | typing + result selection | `WORKSPACE_INDEX_STATE`, `openWorkspaceFile` | `<label for="workspaceSearchInput">` |
| Active File / Current Document | TBD (Help alignment is ACT 5) | Pin/Unpin, Add/Remove Knowledge, Archive/Restore | `WORKSPACE_STATE.activeFile`, live buffer, `patchNoteMetadata()` | `aria-expanded`; `#workspaceActiveBadge` status |
| Open Tasks / Task Review | `attachContextualHelpButton` (`journal-tasks`, main.js:3698) | open-source, priority edit, lifecycle actions | `WORKSPACE_STATE.activeFile`, `WORKSPACE_INDEX_STATE` | `aria-expanded="false"`; `#workspaceTasksBadge` |
| Related / Links In | `attachContextualHelpButton` (`journal-links`, main.js:3702) | link navigation | active file derivation | disclosure `aria-expanded` |
| Notes | none (legacy inert — ACT 5 decides) | none (inert) | none (nothing populates journals) | disclosure `aria-expanded` |
| Knowledge | none (legacy inert — ACT 5 decides) | none (inert) | none (nothing populates concepts) | disclosure `aria-expanded` |
| Archive | TBD (ACT 5) | Archive/Restore via Active action row | metadata writer, live buffer | disclosure `aria-expanded`; badge |
| Tags | none (ACT 5 decides) | tag toggle → filtered results | `WORKSPACE_INDEX_STATE.tags`, `__workspaceActiveTag` | disclosure `aria-expanded` |
| Workspace Index panel | TBD (ACT 5) | open Index full view | `WORKSPACE_INDEX_STATE` | disclosure `aria-expanded`; badge |
| Workspace Index full view | TBD (ACT 5) | Return row, filters | module-local filters, host route | Return row labels |
| Projects panel | `attachContextualHelpButton` (`journal-projects`, main.js:3694) | open full Index (`open-index`) | `WORKSPACE_INDEX_STATE.projects` | `aria-expanded="false"`; badge |
| Reports panel | `attachContextualHelpButton` (`journal-reports`, main.js:3690) — protected | report actions (unchanged) | Report state | report-panel labels |
| Resize handle | none | drag-resize | `#workspaceSidebar` width var | `aria-hidden` (decorative) |
| Navigation controls | none | Back/Forward | history engine | `aria-label` Back/Forward |

### File Knowledge analysis (spec §9)

- **Open Tasks / Task Review** — genuinely document-scoped: render driven by `WORKSPACE_STATE.activeFile`; badge ("N open") and empty state ("No open tasks") document-scoped; actions reuse `MME_TASK_LIFECYCLE` + `openWorkspaceFile`. Open vs Done are separate projections (Done counts in Active stats, main.js:3912 — no second panel). Moving the panel changes no parsing/mutation ownership.
- **Related / Links In** — genuinely document-scoped: derived from active file, no independent state; empty state ("No active note") document-scoped.
- **Tags panel** — MIXED (the one mixed panel): summary derives from Workspace-wide `WORKSPACE_INDEX_STATE.tags`, but selection (`__workspaceActiveTag`) and per-note chips are document-scoped. Proposed: File Knowledge for document usage; Workspace tag index stays Workspace concern.
- Active stats rows (Open/Done/Related/Links out, main.js:3911-3914) are document-scoped readouts inside Current Document, not separate panels. No Tasks redesign in ACT 3.

### Workspace Knowledge analysis (spec §10)

- **Search** — confirmed Workspace-scoped (`ensureWorkspaceSearchPanel`, main.js:1824; queries `WORKSPACE_INDEX_STATE`). It is a control + results section, not a collapsible panel. Stays Workspace-scoped; never moves into Current Document or File Knowledge.
- **Notes / Knowledge panels** — Workspace-scoped but **inert/legacy**: `workspace-sidebar.js` header comment (ACT 2B retained legacy) states nothing populates `files.journals`/`files.concepts` after ACT 1B; renderer only called from the dead legacy activation sequence. Independently collapsible. ACT 3 must decide remove/repurpose/leave-inert — removal needs an owner ruling (deferred past structural checkpoint per the file's own comment).
- **Tasks entry point** — the Open Tasks panel doubles as the Tasks entry; no separate Workspace-wide Tasks panel exists in the Sidebar (Task Board is the Workspace-wide Tasks surface: overlay, out of Sidebar scope).
- **Projects entry point** — Workspace-scoped (`WORKSPACE_INDEX_STATE.projects`), collapsible, `open-index` contextual action routes to the full Index view. No incorrect active-document dependency.
- **Index panel** — Workspace-scoped read-only projection (`WORKSPACE_INDEX_STATE`), collapsible.
- **Reports panel** — Workspace-scoped, protected, unchanged (`js/report/report-panel.js`).
- **Archive panel** — Workspace-scoped projection (`renderWorkspaceArchivePanel`, main.js:5902), collapsible, actions route through the Active action row's metadata writer.
- No Workspace panel incorrectly depends on the active document for its primary content (Tags selection is the single mixed case, documented above).

### Header and badge owner ruling (spec §11 — recorded)

Order: 1. surface/disclosure identity; 2. title; 3. contextual action; 4. Help; 5. count/status badge (final position). No same-count duplication in body; collapsed panels retain title + useful count; nonessential actions may hide when collapsed; no generic header framework in ACT 3; reuse existing owners first.

Violations found (visual only — no behavioral inconsistency proven):

- **Related panel** — badge `#workspaceRelatedBadge` exists in the dynamic ensure path but the static `index.html` fallback (line 182-190) has no badge: visual inconsistency static-vs-dynamic. No behavioral gap (render upgrades markup).
- **Tasks panel** — same pattern: static `index.html` (192-196) title-only; dynamic path adds badge + Help. Visual only.
- **Active badge** — `#workspaceActiveBadge` (kind label) + stat values in body: intentional domain difference (badge = kind status, body = counts), not a violation.
- **Projects summary/body duplication** — badge count + `#workspaceProjectsSummary` ("N Projects") + list: summary line duplicates the badge count. Candidate visual-only alignment for ACT 3 Slice 4. No behavioral change.
- **Help coverage partial** (Reports/Projects/Tasks/Related have `attachContextualHelpButton`; Active/Search/Tags/Index/Archive do not): intentional staging — Help alignment belongs to ACT 5, not ACT 3.

### Responsive contract owner ruling (spec §12 — recorded)

Essential controls remain available; no unexpected horizontal overflow; filters/actions may wrap; titles, badges and disclosure remain understandable; Sidebar usable at narrow width; Task Board keeps independent column scrolling; Projects/Index keep central scrolling; domain differences valid; notebook + narrow-browser acceptance required per ACT; S22/DeX acceptance required before Package 6 release when global Sidebar or Document Surface layout changes.

Current CSS owners / risk (no implementation in PLAN-0): owner `css/workspace.css` — sidebar width var (`--workspace-sidebar-width`, 229-230), `@container` narrow query (139-140), coarse-pointer rules (205), breakpoints 767/1023/1199px. Risk: header rows (disclosure + title + actions + badge) at narrow widths — wrapping unproven; Slice 5 validates only if Slices 1-3 change header markup.

### ACT 3 implementation slicing recommendation (spec §13)

Default 5-slice shape assessed against source evidence; recommendation compresses to **3 slices** (grouping + ordering combined; header alignment kept separate; responsive/accessibility folded as gate criteria unless Slices 1-2 change header markup):

**ACT 3 Slice 1 — Sidebar structural grouping + ordering (semantic section containers).**
Source-proven need: two overlapping insertion grammars (`getWorkspaceSidebarContentHost()` + `insertBefore` chains vs `#projectsSectionRoot` experimental gate with swallowed `insertAdjacentElement` exceptions) can silently reorder panels; Tag selection (`__workspaceActiveTag`) is the single mixed-scope interaction. Runtime owners: `js/main.js` (ensure/render/collapse owners), `index.html` static fallback, `css/workspace.css` section styles. Files expected: `js/main.js`, `index.html`, `css/workspace.css`, narrow validator. Protected: Reports runtime, Task Board overlay, Save/mutation owners, Edit/Read mode state. Validators: sidebar structural (panel order assertion), collapse persistence, header/badge position. Browser checkpoint: open workspace, verify Current Document → File Knowledge → Workspace Knowledge order, collapse/expand each section, reload and confirm no reorder. Stop: second insertion owner required; mode ownership would move; persistent layout storage required.

**ACT 3 Slice 2 — Current Document structural area using existing Active File owner.**
Source-proven need: Active already owns identity + source access + Quick Actions + collapse; Edit/Read lives in editor overlay (`#editorBtnEditToggle`, js/main.js:11918), so only a structural placeholder (not functional control) may be created. Runtime owners: `renderWorkspaceActivePanel`/`ensureWorkspaceActivePanel`, `applyActiveNoteMetadata`, `describeNoteActionTarget`. Files expected: `js/main.js` (Active panel template only), docs. Protected: mode state owner, Save owner, Markmap mode, Reports. Validators: current-document-scope (identity/source/Quick Actions/empty states). Browser checkpoint: no-file / unwritable / dirty / workspace-switch states render correctly; no Save triggered by viewing. Stop: functional Edit/Read required (→ ACT 4); second mode owner required.

**ACT 3 Slice 3 — Panel header, badge and disclosure alignment.**
Source-proven need: static-vs-dynamic badge gap (Related/Tasks), Projects summary/body count duplication — visual only. Runtime owners: panel templates in `js/main.js`, `index.html` fallback, `css/workspace.css`. Protected: behavioral owners, Help expansion (→ ACT 5), generic header framework (prohibited). Validators: header/badge position assertions, `git diff --check`. Browser checkpoint: each panel header shows disclosure → title → action → Help → badge; collapsed panels retain title + count. Stop: behavioral change required; Help framework required.

Slice 4 (ordering alone) and Slice 5 (responsive/a11y alone) **not recommended as standalone slices**: ordering is inseparable from grouping (same insertion owners); responsive/accessibility ride as acceptance gates on Slices 1-3 unless header markup actually changes.

### ACT 4 boundary (spec §14 — reserved, not in ACT 3)

Functional Edit/Read control, mode state ownership, Editor/Read synchronization, handle preservation, dirty-state preservation, cursor/selection preservation, Editor scroll, Read scroll, Markmap relationship, shared vs mode-specific top controls, Full Editor / Full Read / Full Markmap behavior. ACT 3 creates the Current Document location/placeholder only; it must not duplicate mode ownership.

### ACT 3 PLAN-0 status

Status: **Slices 1–3 complete after structural correction.** Implementation: Slices 1–3 on `development` (including the pre-browser group-attachment correction and executed-DOM gate S28–S34); integrated browser acceptance pending owner authorization.

### ACT 3 Slice 1 — Final Semantic Mapping (recorded 2026-10-20)

| Group | Panels | Notes |
|---|---|---|
| Workspace Controls | (empty) | No existing global command area found as child of Sidebar content host; group rendered empty, visually neutral; owner remains existing header/global action area; no duplicate Open Workspace/Today/New Note/New Concept controls |
| Current Document | Active File | `js/main.js` (`ensureWorkspaceActivePanel`, `renderWorkspaceActivePanel`) |
| File Knowledge | Tasks, Related/Links | Order: Tasks before Related; `js/main.js` (`ensureWorkspaceTasksPanel`, `ensureWorkspaceRelatedPanel`) |
| Workspace Knowledge | Search, Notes/Journals, Knowledge/Concepts, Tags, Projects, Index, Archive | Order: Search → Journals → Concepts → Tags → Projects → Index → Archive |
| Protected ungrouped | Reports | No movement or redesign; protected scope |

Corrections from initial implementation:
- Search: Workspace Controls → Workspace Knowledge (Search is Workspace-scoped, not a global command).
- Tags: File Knowledge → Workspace Knowledge (Tags is Workspace-scoped despite interacting with the selected document).

Validation (at ACT 3 completion): workspace-sidebar-visual-validators.cjs 86/86 PASS; workspace-notes-sidebar-validators.cjs 65/65 PASS; workspace-discovery-consumers-validators.cjs 52/52 PASS; workspace-task-consumers-validators.cjs 62/62 PASS; `git diff --check` clean.

### ACT 3 Slices 2–3 + pre-browser structural correction (recorded 2026-10-20)

- **Slice 2 — Current Document structural area (after correction):** visible
  Active title changed to "Current Document";
  `workspaceCurrentDocumentSection` / `workspaceCurrentDocumentTitle` /
  `workspaceActiveEditReadReserved` markup and CSS removed (grayfield
  boundary — no Edit/Read ownership move).
- **Slice 3 — Header, badge and disclosure alignment:**
  `ensureWorkspaceIndexPanel()` header reordered to disclosure → title →
  action → badge; all other panels conform; Help deferred to ACT 5; Projects
  summary/badge count duplication investigated — ruled non-duplicative.
- **Pre-browser structural correction:** `ensureWorkspaceSidebarGroups()`
  now attaches each new (or displaced) group to the content host
  (`host.appendChild(group)`) before the move/order loops — groups were
  previously created detached, which in a real browser would have made every
  grouped panel vanish from the rendered Sidebar (and made `getElementById`
  and the ordering loop skip the groups).
- **Executed rendered-DOM gate (S28–S34):** the validator builds a
  tree-capable DOM and executes the five real structural owners verbatim —
  group attachment (S28), panel nesting/reachability (S29), single rendered
  "Current Document" title (S30), rendered group/panel order (S31),
  uniqueness/no detached or duplicated nodes (S32), protected Reports tail
  (S33), idempotent second run (S34). Gate-first evidence: 79/86 before the
  fix (S28–S34 failed on the real defect), 86/86 after.
- **Integrated browser acceptance:** pending owner authorization. Release
  gate: CLOSED (0.8.x activation not authorized).