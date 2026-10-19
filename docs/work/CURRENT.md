# Current Work — MarkmapEditor Package 6

## Identity

- Package: P6
- ACT: ACT 2 Slice 3
- Name: Overlay Exit, Transient State, and State-Copy Consistency
- Branch: development
- Released baseline: 0.7.0
- Target release: 0.8.0
- Status: accepted

## Objective

Correct only source-proven inconsistencies in Task Board overlay exit,
transient surface state, and empty/failure presentation. Task Board overlay
exit grammar (E1) verified conforming; transient filter/state lifecycle (F1)
inspected for persistence policy alignment; state-copy presentation (Q5)
inspected for empty vs filtered-empty distinction.

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

## Current Phase

Package 6 consolidation and remaining-scope assessment. No new active
implementation slice assigned after Slice 3.

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
