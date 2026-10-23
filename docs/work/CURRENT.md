# Current Work — MarkmapEditor Package 6

## Identity

- Package: P6
- ACT: ACT 4 ACTIVE — File Knowledge Cards and Workspace Index Consolidation
- Name: File Knowledge Cards and Workspace Index Consolidation — Slice 1 & Slice 2 complete
- Branch: development
- Released baseline: 0.7.0
- Target release: 0.8.0
- Status: ACT 3 ACCEPTED; ACT 4 ACTIVE — Slice 1 (projection module: `js/workspace/file-knowledge-projection.js`, `globalThis.MME_FILE_KNOWLEDGE`) complete; Slice 2 (Workspace Active panel statsRows wired to `MME_FILE_KNOWLEDGE.projectFileKnowledgeTasks`) complete; remaining slices PLAN-0; release activation false

## Objective

Replace competing Sidebar insertion grammars with one deterministic structural
ordering while preserving all existing render, action, mutation and Save
owners.

## Authorized Scope

- semantic Sidebar group containers;
- one deterministic insertion/order owner;
- migration of existing panels into their accepted semantic positions;
- removal or disabling of the experimental competing insertion path;
- narrow CSS required for grouping and responsive integrity;
- focused validators.

## Protected Scope

- no Edit/Read relocation;
- no mode-state change;
- no Active File functional redesign;
- no Task or Project redesign;
- no Reports movement or redesign;
- no Notes/Knowledge feature implementation;
- no Reminders or Highlights;
- no generic panel framework;
- no version, cache or release-note changes.

## ACT 2 — Completion Record (retained)

ACT 2 Slice 1 — Workspace Index return control + scroll preservation: ACCEPTED (commit 9d01638).

ACT 2 Slice 2 — Inspection and Return Recovery Alignment: ACCEPTED (commits 78a1528 + 85feeac + 13e9b88).

ACT 2 Slice 3 — Overlay Exit, Transient State, and State-Copy Consistency: ACCEPTED (commits 484fd94 + 8431188 + 9399cae).

- Slice 3 implemented: Task Board localStorage filter persistence replaced with module-local state.
- Slice 3 inspection-only: Task Board exit grammar conforming; empty vs filtered-empty semantics conforming.
- ACT 2 browser checkpoints passed for all slices.
- Released identity remains 0.7.0.

## ACT 3 PLAN-0 — Sidebar Information Architecture

### Objective

Perform source inspection only. Do not reorganize Sidebar runtime in PLAN-0. Identify current Sidebar owners and classify existing content into:

- Current Document
- File Knowledge
- Workspace Knowledge

Determine the smallest grayfield implementation plan.

### Hypothesis (to validate against source)

**Current Document** — top-level context for the active document (document identity, file name/path, Edit/Read control, source access, Quick Actions, dirty status, entry points to Full Editor/Full Read/Full Markmap).

**File Knowledge** — document-scoped information only (Open Tasks, Done Tasks, Links In, Links Out, related Projects, document-scoped metadata). No Reminders, Highlights, or new relationships.

**Workspace Knowledge** — Workspace-scoped navigation (Search, Notes, Knowledge, Tasks, Projects, Index, Reports, Archive). Search remains Workspace-scoped; do not move Search into Current Document or File Knowledge.

### Accepted Owner Ruling — Header/Badge Grammar

Panel headers follow this logical order:

1. surface or disclosure identity;
2. title;
3. contextual action;
4. Help;
5. count or status badge.

Badge normally occupies the final logical header position. Do not duplicate the same count immediately in the body. Collapsed panels retain title and useful count.

### Accepted Owner Ruling — Responsive Contract

Essential controls remain available; no unexpected horizontal overflow; filters and actions may wrap; titles, badges and disclosure remain understandable; Sidebar remains usable at narrow width. Do not implement responsive changes during PLAN-0.

### Protected Scope (ACT 3 PLAN-0)

No runtime Sidebar reorganization; no Edit/Read changes; no Document Surface changes; no Markmap mode changes; no top-bar changes; no Reports redesign; no Compact View; no Task/Project domain changes; no generic panel/surface framework; no persistent layout storage changes; no release/version/cache changes.

### Required Validation

- `git diff --check`
- every referenced source file exists
- every named owner is source-proven
- layer classification is complete; no panel classified in two primary layers without explanation
- Search is Workspace-scoped; Reports is protected
- ACT 4 PLAN-0 active (source inspection only, documentation); no implementation
- no runtime file changed; no version/cache file changed

### Stop Conditions

- Sidebar runtime reorganization would be required
- Edit/Read or Document Surface changes would be needed
- persistent layout storage changes would be required
- release/version/cache changes would be required

## Source-Proven Findings (ACT 2 Slice 3 inspection)

### E1 — Task Board overlay exit grammar: NO inconsistency proven

- Visible Close control present with correct accessible name
  (`aria-label="Close Task Board"`, task-board.js:1058-1064)
- Escape uses the same `close()` owner (no duplicate handler,
  task-board.js:1099-1105)
- `close()` hides overlay, restores focus to `lastInvoker`, triggers no Save
  (task-board.js:1251-1272)
- `wired` flag prevents double wiring on re-open (task-board.js:1087)
- All E1 items conform to accepted lifecycle contracts

### F1 — Task Board filter persistence: PROVEN inconsistency

- Current behavior: Task Board persists `doneWindow`, `priorityFilter`,
  `sort`, `sourceFilter` to `localStorage` via
  `setStoredDoneWindow()`/`setStoredPriorityFilter()`/`setStoredSort()`
  (task-board.js:1118, 1134, 1150; keys defined at lines 37-51)
- Expected behavior: Module-local only (matching Projects and Workspace
  Index), no persistent browser storage per P6 policy
- Responsible source owner: `js/tasks/task-board.js`
- Responsible state owner: Task Board module (`globalThis.MME_TASK_BOARD`)
- Responsible render owner: Task Board module
- Smallest safe correction: replace `localStorage` reads/writes with
  module-local variables in task-board.js

### Q5 — State-copy/empty vs filtered-empty: NO inconsistency proven

- Projects: `"No Projects match the current filters."` (line 756) —
  correctly filtered-empty; filters + Clear filters button remain reachable
- Workspace Index: filter-state module-local; empty state consistent
- No copy divergence requiring runtime correction

## Authorized Implementation

1. `js/tasks/task-board.js`: Replace `localStorage` reads/writes with
   module-local variables for doneWindow, priorityFilter, sort, sourceFilter
   state. No new global store; Task Board module owns its own state.
2. Add validator assertions proving module-local filter state (no localStorage
   access) for Task Board.
3. Add Tier M mutation control verifying filter state survives close/reopen
   without persistent storage.

## Protected Scope

- no Task Board lifecycle conversion (stays modal overlay)
- no Reports changes
- no Compact View work
- no Timeline work
- no Sidebar redesign
- no generic framework
- no persistent browser storage
- no release activation

## Required Validation

- `git diff --check`
- Task Board aggregate / T20 proof Task Board is conforming
- workspace-index-task-filter-validators (W01–W08) — regression
- project-view-validators (PR01–PR23) — regression
- New validator: Task Board filter state is module-local (no localStorage)
- Tier M mutation control (disposable copy): close/reopen preserves filter
  state without localStorage
- Secondary consistency inspection after validator execution

## Browser Checklist (after static validation)

### Task Board exit
1. Open Task Board from a recognizable prior surface.
2. Confirm the visible Close control and its accessible label.
3. Close using the visible control; confirm prior surface returns.
4. Reopen Task Board; Close using Escape; confirm same prior surface returns.
5. Confirm no duplicate close behavior; confirm no Save.

### Task Board state (F1 correction)
1. Select Source filter; apply another filter; scroll two columns.
2. Close Task Board; reopen during same session; confirm filter/column
   state preserved (module-local, not localStorage).
3. Refresh browser; confirm no persistent browser storage behavior.

### Empty-state behavior
1. Create filtered-empty result safely.
2. Confirm filters remain available; Clear Filters works.
3. Confirm message does not claim domain is empty.
4. Confirm clearing restores results.

## ACT 2 Slice 3 Closure

Status: accepted

Implemented:

- replaced Task Board localStorage filter persistence with module-local state.

Accepted lifecycle:

- same-session close/reopen preserves Task Board filters;
- full browser refresh resets transient filters;
- no persistent browser storage is required.

Inspection-only conclusions:

- Task Board exit grammar was already consistent;
- empty and filtered-empty semantics were already consistent.

Owner browser evidence:

- Task Board opened successfully;
- same-session behavior passed;
- post-refresh reset passed;
- no unexpected Save or mutation was observed.

Release boundary:

- application remains at 0.7.0;
- Package 6 remains active;
- 0.8.0 release activation remains unauthorized.

## ACT 3 Slice 1 — Completion Record (Sidebar Structural Grouping and Deterministic Ordering)

Status: **completed**.

### Semantic Mapping (final)

| Group | Panels | Owner |
|---|---|---|
| Workspace Controls | (empty — no existing global command area is movable) | existing header/global action area; group rendered as empty, visually neutral |
| Current Document | Active File | `js/main.js` (`ensureWorkspaceActivePanel`, `renderWorkspaceActivePanel`) |
| Workspace Index | Workspace Index | `js/main.js` (`ensureWorkspaceIndexPanel`) — promoted out of Workspace Knowledge into its own Workspace Context group |
| File Knowledge | Tasks, Related/Links | `js/main.js` (`ensureWorkspaceTasksPanel`, `ensureWorkspaceRelatedPanel`) |
| Workspace Knowledge | Search, Notes/Journals, Knowledge/Concepts, Projects, Tags, Archive | `js/main.js` (respective ensure/render owners) |
| Protected ungrouped | Reports | Report panel owner; no movement or redesign |

### Corrections from initial implementation

- Search: moved from Workspace Controls → Workspace Knowledge (Search is Workspace-scoped, not a global command).
- Tags: moved from File Knowledge → Workspace Knowledge (Tags is Workspace-scoped despite interacting with the selected document).
- Workspace Index: promoted from Workspace Knowledge → its own Workspace Context group, placed immediately after Current Document.
- Workspace Controls: no existing global command area found as a child of the Sidebar content host; group remains empty; no duplicate Open Workspace/Today/New Note/New Concept controls created.

### Implementation

- `js/main.js`: `ensureWorkspaceSidebarGroups()` creates 4 group containers and moves existing panel nodes via `appendChild`; `normalizeWorkspacePanelOrder()` orders groups deterministically in the host and panels within groups; both wired into `finalizeWorkspaceSidebar()`.
- `css/workspace.css`: `.workspaceSidebarGroup` styles added.
- No panels recreated; no listeners re-wired; no domain models mutated; no Save triggered; Edit/Read owner unchanged (`#editorBtnEditToggle` in editor overlay).

### Validation

- `workspace-sidebar-visual-validators.cjs`: 93/93 PASS at ACT 3 completion (S1–S16 structural assertions; Y44 updated to 0.7.0 baseline; final ACT 3 suite = S1–S27 source-contract + S28–S41 executed rendered-DOM).
- `workspace-notes-sidebar-validators.cjs`: 65/65 PASS (S50 updated to 0.7.0 baseline).
- `workspace-discovery-consumers-validators.cjs`: 52/52 PASS.
- `workspace-task-consumers-validators.cjs`: 62/62 PASS.
- `node --check js/main.js`: PASS.
- `git diff --check`: clean.

## ACT 3 Slice 2 — Completion Record (Current Document Structural Area — after structural correction)

Status: **completed**.

### Semantic Mapping (final)

| Group | Panels | Owner |
|---|---|---|
| Workspace Controls | (empty — no existing global command area is movable) | existing header/global action area; group rendered as empty, visually neutral |
| Current Document | Active File | `js/main.js` (`ensureWorkspaceActivePanel`, `renderWorkspaceActivePanel`) |
| File Knowledge | Tasks, Related/Links | `js/main.js` (`ensureWorkspaceTasksPanel`, `ensureWorkspaceRelatedPanel`) |
| Workspace Knowledge | Search, Notes/Journals, Knowledge/Concepts, Projects, Tags, Archive | `js/main.js` (respective ensure/render owners) |
| Protected ungrouped | Reports | Report panel owner; no movement or redesign |

### Correction from initial Slice 2 implementation

The initial Slice 2 implementation added a `workspaceCurrentDocumentSection` wrapper with a `workspaceCurrentDocumentTitle` ("Current Document") and a non-interactive `workspaceActiveEditReadReserved` span. This created two visible titles ("Current Document" section title + "Active" panel title) and a premature Edit/Read placeholder — both in conflict with the accepted grayfield boundary.

### Corrected implementation

- `js/main.js`: `ensureWorkspaceActivePanel()` keeps the existing Active File panel and disclosure owner; visible semantic title changed from "Active" to "Current Document"; `workspaceCurrentDocumentSection` wrapper removed; `workspaceActiveEditReadReserved` span removed; no separate section header above the panel.
- `css/workspace.css`: `.workspaceCurrentDocumentSection`, `.workspaceCurrentDocumentTitle`, `.workspaceActiveEditReadReserved` rules removed.
- No panels recreated; no listeners re-wired; no domain models mutated; no Save triggered; Edit/Read owner unchanged (`#editorBtnEditToggle` in editor overlay).

### Validation

- `workspace-sidebar-visual-validators.cjs`: 93/93 PASS at ACT 3 completion (S17–S22 for no Edit/Read placeholder, no duplicate section wrapper, single Current Document title, no mode handler, no Save from rendering).
- `workspace-notes-sidebar-validators.cjs`: 65/65 PASS (unchanged).
- `workspace-discovery-consumers-validators.cjs`: 52/52 PASS (unchanged).
- `workspace-task-consumers-validators.cjs`: 62/62 PASS (unchanged).
- `node --check js/main.js`: PASS.
- `git diff --check`: clean.

## ACT 3 Slice 3 — Completion Record (Header, Badge and Disclosure Alignment)

Status: **completed**.

### Header grammar (ACT 3, Help deferred to ACT 5)

Panel headers follow: disclosure → title → action → badge. Help is intentionally deferred to ACT 5 per accepted owner ruling.

### Implementation

- `js/main.js`: `ensureWorkspaceIndexPanel()` restructured — badge moved from inside the toggle button to after the action controls within `workspacePanelHeaderControls`, yielding disclosure → title → action → badge order. All other panels (Active, Related, Tasks, Tags, Projects, Journals, Concepts, Archive) already conform.
- `css/workspace.css`: no changes required for Slice 3 (existing `.workspacePanelHeaderControls` and `.workspacePanelBadge` styles cover the restructured Index header).
- Projects summary/body count duplication: investigated — not proven. Badge shows compact count (e.g., "0"), summary shows descriptive label (e.g., "0 Projects"); these serve different UI purposes and are not duplicative.
- No panels recreated; no listeners re-wired; no domain models mutated; no Save triggered.

### Validation

- `workspace-sidebar-visual-validators.cjs`: 93/93 PASS at ACT 3 completion (S23–S27: Index action-before-badge, Projects action-before-badge, no badge-before-title, chevron-before-title, Active disclosure→title→badge).
- All other validator suites: unchanged, all pass.
- `node --check js/main.js`: PASS.
- `git diff --check`: clean.

## ACT 3 — Pre-browser structural correction (group attachment) + executed-DOM gate

### Defect found and fixed before integrated browser acceptance

`ensureWorkspaceSidebarGroups()` created the four group containers detached —
they were never appended to the Sidebar content host. Invisible to the S1–S27
source-contract checks, the consequences in a real browser would have been:
`document.getElementById` could not find the groups, the ordering loop skipped
them (`group.parentNode !== host`), and every panel moved into a group would
have vanished from the rendered Sidebar as a detached subtree.

Fix (`js/main.js`, `ensureWorkspaceSidebarGroups()`): each newly created group
is attached with `host.appendChild(group)` immediately; an existing group whose
`parentNode !== host` is re-homed to the host. The ordering loop then places
the groups after the header as before. No other owner, CSS, listener or
domain model changed.

### Executed rendered-DOM gate (S28–S34)

`scripts/workspace-sidebar-visual-validators.cjs` builds a tree-capable DOM
(real parentNode/insertBefore/appendChild, connectivity-aware getElementById)
and executes the five real structural owners extracted verbatim in finalize
order (`getWorkspaceSidebarContentHost`, `ensureWorkspaceActivePanel`,
`ensureWorkspaceIndexPanel`, `ensureWorkspaceSidebarGroups`,
`normalizeWorkspacePanelOrder`):

- S28 all four groups attached to the rendered host;
- S29 every mapped panel reachable from the document root and nested in its group;
- S30 Current Document panel renders exactly one visible title (removed slice-2 structures absent);
- S31 group order after header, within-group panel order, ungrouped tail;
- S32 no detached or duplicated groups/panels in the connected tree;
- S33 Reports stays ungrouped after the groups (protected scope);
- S34 second grouping run preserves node identity (idempotent).

### Evidence

- Gate-first, before the fix: 79/86 — S28–S34 all FAILED with detached-group/panel diagnostics (the gate caught the real defect).
- After the fix: visual suite 93/93 PASS; notes 65/65; discovery 52/52; tasks 62/62; `node --check js/main.js` PASS; `git diff --check` clean.
- Evidence class: executed-DOM in Node — not browser evidence. Integrated browser acceptance remains owner-gated.

## ACT 3 — Final Sidebar ordering correction (Workspace Knowledge order)

The integrated visual review found one remaining ACT 3 issue: the Workspace
Knowledge panel order did not yet reflect the accepted information hierarchy.
This narrow correction changes only the deterministic order array in
`normalizeWorkspacePanelOrder()` (plus a stale creation-anchor comment in
`ensureWorkspaceIndexPanel()`). No panel recreated, no listener re-wired, no
Save or domain mutation, no Edit/Read or Reports change, no Archive behavior
change.

### Accepted final order

1. **Workspace Controls** — empty, visually neutral; Open Workspace / Today /
   New Note stay with their existing global-action owner (no visible empty
   heading, no empty spacing, no duplicated global controls).
2. **Current Document** — first informational area; document identity, source
   access and the existing Quick Actions remain inside it.
3. **File Knowledge** — document-scoped only: Tasks (Task Review), Links In/Out.
4. **Workspace Knowledge** — Search → Workspace Index → Notes/Journals →
   Knowledge/Concepts → Projects → Tags → Archive. No independent
   Workspace-scoped Tasks panel exists, so none was created; the
   document-scoped Task Review stays in File Knowledge.
5. **Report** — protected, ungrouped, visually last.

### Deferred decisions (recorded, not implemented)

- Workspace Index becoming a richer Workspace Knowledge surface;
- reducing redundant Index number cards (and any Index count/filter change);
- moving Tags into Workspace Index;
- adding or changing Task statuses (Backlog/Ongoing/In Progress only if source proves canonical);
- Archive exclusion from active aggregations — archived files may currently
  contribute to active Workspace Index counts and possibly Search, Tasks,
  Projects, Tags and Links; a later source-proven ACT must determine the
  canonical indexing owner and exclude archived sources from active
  aggregations without scattering consumer-level filters;
- Reports redesign.

### Evidence

- Stale order assertions replaced (static S12, executed S31 constant); new
  executed-DOM gate S35–S41: item-wise Workspace Knowledge sequence, group
  precedences, Quick Actions ownership, repeated-finalization order/identity/
  uniqueness, missing optional panels skipped safely, structural owners free
  of event wiring and Save/mutation.
- `workspace-sidebar-visual-validators.cjs`: 93/93 PASS (S1–S41); notes 65/65;
  discovery 52/52; tasks 62/62; `node --check js/main.js` PASS;
  `git diff --check` clean.
- Evidence class: executed-DOM in Node — not browser evidence.

## Current Phase

ACT 3 ACCEPTED — all slices, group-attachment correction and the final Workspace Knowledge ordering correction above.

- ACT 3 static gate (S1–S27) + executed rendered-DOM gate (S28–S41, 93/93) passed;
- integrated browser acceptance passed;
- 93/93 sidebar, 65/65 notes, 52/52 discovery, 62/62 tasks PASS.

ACT 4 PLAN-0 active — source inspection only, documentation; no implementation.

Package 6 release gate: closed.
0.8.0 activation: unauthorized.
## ACT 4 PLAN-0 — File Knowledge Cards and Workspace Index Consolidation

### Status

**Source inspection / awaiting owner review. No implementation.**

### Workstreams

**A. File Knowledge cards for Current Document** (six-card document-scoped:
Backlog Tasks, Open Tasks, Ongoing Tasks, Done Tasks, Links In, Links Out)

**B. Workspace Index compact/full consolidation** (compact Workspace-context
surface)

### Proposed Cards (target hypothesis — source inspection pending)

| Card | Owner | Status |
|---|---|---|
| Backlog Tasks | Task-state parser | PLAN-0 |
| Open Tasks | Task-state parser | PLAN-0 |
| Ongoing Tasks | Task-state/started field | PLAN-0 |
| Done Tasks | Task completion owner | PLAN-0 |
| Links In | Related/Links owner | PLAN-0 |
| Links Out | Links-out owner | PLAN-0 |

### Source Inspection Status

- Task-state fields: pending source verification
- Backlog explicit/derived: pending source verification
- Ongoing explicit/derived: pending source verification
- started already supported: pending source verification
- No six-card runtime layout assumed
- No new Task metadata
- No Tags movement
- No Archive exclusion
- No Edit/Read

### Recommended Next Step

Feature-parity source-proven matrix; then owner agreement on Slice 1 before any implementation.

Package 6 release gate: closed.
0.8.0 activation: unauthorized.

## Source-Proven Asymmetry (B2) — live-source comparison, 2026-10-18

### Ownership matrix

| Role | Projects (projects-view.js) | Workspace Index (workspace-index-workspace.js) |
|---|---|---|
| Activation owner | `activate()` presentation model (ACT 5D) | staged `activate()`: build hidden, show last |
| Source-opening owner | `openProjectSource` → `switchTo('journal')` → `openWorkspaceFileSafe` | `handleOpenWorkspaceFile` → `switchTo('journal')` → `openWorkspaceFile` |
| Inspection owner | `inspectionActive` + `data-projects-inspection` + `ensureBackButton` (toolbar) | none (B2 gap) |
| Return-control render owner | `renderInto` return row; recovery = `ensureBackButton` | `buildReturnButtonHtml` prepended; no toolbar recovery |
| Return-label owner | `← Back to Workspace` + matching aria-label (static) | `← Return to <escaped file\|Workspace>` + matching aria-label |
| Originating-surface owner | host route + presentation snapshot | host route (`previousWorkspace`, informational) |
| Return-context owner | ONE owner: `MME_WORKSPACE_HOST.switchTo` + Navigation History — no second stack | same one owner |
| Filter-state owner | `viewState.filters`/`viewState.search` module-local (survive close/reopen) | `projectFilters`/`taskFilter` module-local — BUT reset inside `activate()` |
| Scroll-state owner | `viewState.scroll` + `data-projects-scroll-owner` clamp | `savedScrollTop` + `restoreScrollTop` (Slice 1) |
| Missing-source behavior | `!rec` → toast `File not found` (warn); surface stays open | `!fileRecord \|\| !handle` → toast `File not found: <path>` (error); surface stays open |
| Failed-open behavior | `null` result → recovery armed; `{cancelled:true}` → **stranded**; throw → **stranded** | `null` → rollback to Index; `{cancelled:true}`/`{ok:false}` → **stranded**; throw → rollback |
| Close behavior | deactivate hides; filters + scroll survive | deactivate hides; scroll survives (Slice 1); **filters reset on re-activation** |
| Save behavior | none — view navigation only (PR19) | none — module contract (T16/T17) |
| Relevant validators | PR01–PR21, F/S groups (project-view) | W01–W08, T-groups, new IX group |

Exact-path proof: `findWorkspaceFileByPath` (main.js:4140) matches on
`normalizeWorkspaceSearchPath(file.path) === target` — exact normalized path
identity; no basename fallback exists on either surface.

### Scenario comparison (open → filter → scroll → inspect → return → fail → close/reopen)

| Step | Projects | Workspace Index | Verdict |
|---|---|---|---|
| 1 open surface | builds hidden, shows last; state module-local | same (Slice 1 scroll restore) | consistent |
| 2 change filters | module-local, retained | module-local, retained in-session | consistent |
| 3 scroll | scroll-owner clamp restore | Slice 1 clamp restore | consistent (accepted) |
| 4 open source (success) | arms persistent `Back to Projects` toolbar action | **no recovery control armed** | **B2 core** |
| 5 return success | `backToProjects()` restores view + filters + scroll | only via panel re-entry; **filters reset in `activate()`** | **asymmetry** |
| 6 source unavailable at click | toast, surface stays, no navigation | toast, surface stays, no navigation | consistent (exact path, no fallback) |
| 7a open returns `null` (dirty declined / nav in progress) | recovery armed (recoverable) | rollback to Index + toast (recoverable) | DIFFERENT mechanisms — intentionally preserved |
| 7b open returns `{cancelled:true}` or `{ok:false}` | **stranded** (closed, no recovery) | **stranded** (no rollback) | both incorrect per ruling §11 |
| 7c open throws | **stranded** (no recovery) | rollback to Index | asymmetry |
| 8 close/reopen | filters + search + scroll preserved | **filters reset** (`resetProjectFilters()` + `taskFilter='all'` in `activate()`); scroll preserved | asymmetry vs ruling §8 |

### Current → intended → owner → smallest correction → intentionally different

- **B2 core (step 4-5):** current: Index arms nothing. Intended: one
  persistent, destination-aware recovery control using the existing
  `switchTo` owner. Owner: `workspace-index-workspace.js`. Smallest
  correction: mirror the accepted Projects model (toolbar button
  `Return to Workspace Index`, `data-workspace-index-inspection`), armed on
  successful open only, dismissed on Index activation/use.
- **Step 7b/7c:** current: stranding on truthy-failure results (both) and on
  throw (Projects). Intended: surface context never destroyed. Owner:
  projects-view.js + workspace-index-workspace.js. Smallest correction:
  Index extends its EXISTING rollback to every non-success result with
  bounded distinct toasts; Projects arms its EXISTING recovery on every
  post-switch outcome (ACT 5D model kept: stay closed + arm).
- **Step 8:** current: Index resets filters on re-activation. Intended:
  session-scoped filter preservation (browser refresh resets). Owner:
  workspace-index-workspace.js. Smallest correction: remove the two reset
  calls from `activate()` (module defaults still initialize at load).
- **Intentionally left different:** visible return labels (Q1 deferred —
  both already destination-aware with matching aria-labels); failure
  mechanisms (Projects = arm-and-stay-closed per ACT 5D, Index = rollback
  per module contract); Index requires `.handle` while Projects resolves
  failure later (records carry handles post-ACT 2A); recovery-button
  coexistence when the user diverts surfaces (mirrors accepted Projects
  behavior); empty-copy divergence (Q5); Escape semantics / overlay exit
  (E1, protected).

## Authorized Implementation

1. `js/workspace/workspace-index-workspace.js`
   - arm/dismiss/return helpers for a toolbar recovery control
     (`mmeWsIndexReturnToIndex`, visible + aria-label
     `Return to Workspace Index`), wired to
     `switchTo('workspace-index')` — the existing return owner;
   - arm only after a fully successful open; dismissed on Index activation
     and on use;
   - rollback condition extended to `!opened || opened.ok === false ||
     opened.cancelled === true` with bounded distinct toast copy
     (cancelled vs failure);
   - `activate()` no longer resets `projectFilters`/`taskFilter` (session
     retention; browser refresh still resets).
2. `js/workspace/projects-view.js`
   - `openProjectSource` arms `setInspection(true)` on EVERY post-switch
     outcome (cancelled + throw), so the accepted ACT 5D recovery is never
     absent.
3. `css/workspace.css` — `.wsIndexReturnToIndex` rules mirroring
   `.projectsBackToProjects` (proven-necessary: new visible control).
4. Validators: new behavioral suite `scripts/workspace-index-inspection-validators.cjs`
   (rendered presence + wiring, not helper-only); PR22/PR23 in
   `scripts/project-view-validators.cjs`; T10a realigned in
   `scripts/workspace-index-task-filter-validators.cjs`; new controls
   F14–F16 in `scripts/workspace-index-task-filter-mutation-controls.cjs`;
   TEST_CATALOG registration.

## Protected Scope

- No Task Board lifecycle conversion (overlay stays; T20 must stay green).
- No full visible-header normalization; no Sidebar reorganization.
- No Current Document redesign; no Edit/Read control movement.
- No Reports runtime changes (inspection-excluded).
- No Draw.io, Search relocation, Read/HTML search.
- No generic expanded-view / navigation / recovery / disclosure framework.
- No persistent browser filter storage (no localStorage/sessionStorage/
  IndexedDB/SW state).
- No Project metadata redesign; no Task-to-Project linkage.
- No Reminders, Highlights, Reveal.js, shared `@` layer.
- No version activation (stays 0.7.0), no service-worker changes, no
  release-note closure.
- No second navigation stack; no browser-history behavior added.

## Required Validation

- `git diff --check`
- workspace-index-inspection-validators (NEW behavioral: rendered presence
  + wiring for recovery control; missing-source; rollback; filter/scroll
  retention; no-Save)
- workspace-index-task-filter-validators (T-groups + W01–W08, T10a realigned)
- workspace-index-notes-validators
- project-view-validators (PR01–PR23 incl. new cancelled/throw checks)
- project contract / consumer / save-integration / device-acceptance
- mutation-anchor-audit
- Tier M in disposable copy: workspace-index mutation controls (+F14–F16),
  project-view mutation controls (changed owner)
- tasks aggregate or T20 proof that Task Board is untouched
- secondary consistency inspection after validator execution

## Browser Checkpoint

### Projects inspection

1. Open Projects.
2. Select Source and Search/filter criteria.
3. Scroll to a recognizable position.
4. Open a Project source.
5. Return via `Back to Projects`.
6. Confirm filters and scroll context.
7. Confirm correct Return label (`← Back to Workspace`, aria matches).
8. Confirm no Save (no dirty prompt, no save toast).

### Workspace Index inspection

1. Open Workspace Index.
2. Select available filters.
3. Scroll.
4. Open a source — confirm `Return to Workspace Index` appears in the
   toolbar after the source opens.
5. Return via that control — confirm Index restores with filters + scroll.
6. Confirm Return labels on the Index surface (`← Return to …`, aria
   matches; visible copy unchanged).
7. Close/reopen Index — confirm filters persist (session), scroll restores.
8. Confirm no Save.

### Recovery (safe fixture only)

1. Attempt inspection of a source that becomes unavailable (controlled
   fixture — do NOT damage real files).
2. Confirm no unrelated same-basename source opens (exact-path identity).
3. Confirm the originating surface remains recoverable (Projects: `Back to
   Projects` armed; Index: rolled back to Index).
4. Confirm the state reads as source-unavailable/failure toast — not an
   empty-Workspace message.
5. Confirm no Save or mutation.

### Task Board regression

- overlay opens; overlay closes; prior context returns; source filter usable;
  column scroll behavior intact.

## Stop Conditions

- a second navigation/history owner would be required;
- persistent browser storage would be required;
- Task Board lifecycle must change;
- Reports runtime must change;
- broad framework extraction would be required;
- source behavior contradicts an accepted Package 6 ruling (report instead
  of forcing).

## Accepted history

- **P6 ACT 2 Slice 1 — Status: accepted** (owner browser checkpoint
  2026-10-18): Return-label escaping; Return accessible label;
  project-filter rerender scroll preservation; close/reopen scroll
  restoration. Static: task/filter, Notes, full Projects profile,
  mutation-anchor, isolated Tier M, `git diff --check` — all passed.
  Deferred: return-label grammar (Q1), inspection-recovery alignment (B2 →
  this slice), overlay exit grammar (E1), filter-persistence (F1/Q4),
  state-copy normalization (Q5).
- **P6 ACT 1 — accepted** (Projects Source filter, exact `sourcePath`):
  see `docs/packages/P6-CONSISTENCY.md`.
- **P6 ACT 2 Slice 2 — Status: accepted** (owner browser checkpoint 2026-10-19): Inspection and Return Recovery Alignment. Static gate: project-view 536/536; inspection validators 15/15; workspace-index task/filter 64/64; `git diff --check` clean. Browser gate: normal Project source inspection PASS; Return to Projects PASS; Project Source/Search/filter restoration PASS; Project scroll restoration PASS; normal Workspace Index source inspection PASS; Return to Workspace Index PASS; Index Project and Task filter restoration PASS; Index scroll restoration PASS; cancellation recoverable PASS; recovery controls not duplicated or stranded PASS; Task Board overlay regression PASS; no unexpected Save PASS; no unexpected source mutation PASS. In-session transient state preserved; full browser refresh may reset transient state; no persistent browser storage. Released identity remains 0.7.0. No persistent storage, no service-worker/version/cache changes.
