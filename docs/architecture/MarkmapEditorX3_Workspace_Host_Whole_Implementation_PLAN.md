# MarmapEditorX3 — Workspace Host Foundation

## Repository-Specific Whole-Implementation Plan

**Status:** PLAN / REVIEW  
**Implementation:** NOT AUTHORIZED UNTIL PHASE 1 HANDOFF IS REVIEWED  
**Repository baseline:** latest supplied Repomix snapshot (`repomix-output-depaulo-MarkmapEditor (3).xml`)  
**Target:** Introduce a Workspace Host while preserving the current Journal experience  
**Candidate runtime module:** `js/workspaces/workspace-host.js`

---

## 1. Purpose

Transform the current architecture from an application that implicitly treats Journal as the application itself into an application that hosts workspaces.

Current conceptual model:

```text
Application = Journal experience
```

Target conceptual model:

```text
Application
  → Workspace Host
      → Journal Workspace
      → Future Workspace Index
      → Future Report Workspace
      → Future Slides Workspace
      → Future Diagram Workspace
```

Only Journal is implemented and registered during the foundation package.

The user-facing Journal experience must remain nearly unchanged.

Success is measured by ownership improvement, not visible feature expansion.

---

## 2. Repository Reality

The current repository already contains several cross-cutting services and lifecycle owners that must be preserved.

### Existing application/runtime areas

- `js/main.js`
  - application boot and shared runtime exposure;
  - editor/document lifecycle;
  - Markmap and HTML rendering integration;
  - physical workspace-file opening integration;
  - dynamic workspace panels and several Journal-specific operations.

- `js/workspace/workspace-controller.js`
  - workspace directory opening;
  - folder setup;
  - Journal sidebar lifecycle;
  - Today and Archive actions;
  - last-active physical file restoration;
  - Navigation History UI and restore integration;
  - workspace state exposure.

- `js/navigation/navigation-history.js`
  - existing shared navigation-history service;
  - physical workspace locations;
  - Back/Forward transactions;
  - normal/restore/seed semantics;
  - navigation UI subscription.

- `js/workspace/workspace-state.js`
  - physical workspace state.

- `WORKSPACE_INDEX_STATE`
  - canonical workspace intelligence/index state;
  - files, kinds, paths, tags, tasks, and links;
  - emits `mme-workspace-index-ready` after rebuild.

- `js/editor/codemirror-bootstrap.js`
  - editor initialization and editor bridge.

- current Journal UI
  - editor;
  - Markmap;
  - HTML Preview;
  - Journal sidebar;
  - Workspace Index summary panel;
  - Active, Related, Tasks, Tags and Search panels;
  - Wiki Links;
  - Task Review;
  - navigation controls.

### Architectural implication

The Workspace Host must wrap existing lifecycle entry points through small adapters.

It must not immediately relocate large bodies of Journal code.

---

## 3. Core Architectural Principles

### 3.1 Host owns workspace lifecycle only

The Workspace Host owns:

- workspace registry;
- active workspace ID;
- activation/deactivation transition;
- workspace switching;
- workspace-scoped session snapshots;
- detach delegation for the active workspace;
- lifecycle subscribers/diagnostics.

It does not own:

- editor internals;
- physical file opening;
- navigation stacks;
- workspace indexing;
- Journal tasks;
- Journal tags;
- Journal Wiki Links;
- Journal panels;
- Journal sidebar content;
- Markmap rendering;
- HTML rendering.

### 3.2 Journal remains the first workspace

Journal becomes the first workspace registered with the host.

The first implementation should use a thin adapter:

```text
Workspace Host
  → Journal Workspace Adapter
      → existing Journal lifecycle/functions
```

The adapter should call existing behavior rather than move or duplicate it.

### 3.3 Shared services remain shared

These are not owned by the Host or duplicated by Journal:

- `MME_NAVIGATION`;
- `WORKSPACE_INDEX_STATE`;
- rendering infrastructure;
- document/file APIs;
- application logging/toast service;
- service-worker/runtime loading.

### 3.4 Sidebar region vs sidebar content

The host may eventually identify or expose a stable sidebar region.

The active workspace owns its sidebar content and commands.

During the foundation phase, the existing Journal sidebar remains in place and Journal continues to control it.

Do not redesign, move, or rebuild the sidebar.

### 3.5 Workspace state belongs to each workspace

The host stores only opaque snapshots returned by a workspace.

The host must not inspect or mutate Journal session fields.

Conceptual contract:

```javascript
workspace.getState()
workspace.restoreState(snapshot)
```

V1 may store session snapshots in memory only.

No persistence across app restart is required in this package.

---

## 4. Target Interfaces

### 4.1 Workspace descriptor

Recommended minimum shape:

```javascript
{
  id: 'journal',
  title: 'Journal',

  async activate(context) {},
  async deactivate(context) {},
  async refresh(context) {},
  async detach(context) {},

  getState() {},
  async restoreState(state, context) {}
}
```

### 4.2 Workspace Host public API

Recommended candidate API:

```javascript
MME_WORKSPACE_HOST.register(workspace)
MME_WORKSPACE_HOST.unregister(id)
MME_WORKSPACE_HOST.has(id)
MME_WORKSPACE_HOST.get(id)
MME_WORKSPACE_HOST.list()
MME_WORKSPACE_HOST.getActive()
MME_WORKSPACE_HOST.getActiveId()
MME_WORKSPACE_HOST.getSession(id)
MME_WORKSPACE_HOST.subscribe(listener)

await MME_WORKSPACE_HOST.activate(id, context)
await MME_WORKSPACE_HOST.switchTo(id, context)
await MME_WORKSPACE_HOST.deactivate(context)
await MME_WORKSPACE_HOST.refresh(context)
await MME_WORKSPACE_HOST.detach(context)
```

Exact names may change after Phase 1 review, but lifecycle ownership must remain centralized.

---

## 5. Transactional Switching Contract

Workspace switching must be transactional.

Unsafe flow:

```text
deactivate current
→ set active ID to next
→ next activation fails
→ no valid active workspace
```

Required conceptual flow:

```text
1. validate target registration;
2. reject/serialize concurrent switches;
3. capture current workspace state;
4. ask current workspace to deactivate;
5. ask target workspace to restore prior target state if available;
6. ask target workspace to activate;
7. only after activation succeeds, commit active workspace ID;
8. notify subscribers;
9. if target activation fails, attempt to reactivate previous workspace;
10. report structured failure without silently corrupting host state.
```

The skeleton must be reviewed against actual Journal lifecycle behavior before relying on rollback.

---

## 6. Lifecycle Context Contract

Host lifecycle calls should receive a small context object rather than reading arbitrary globals inside the host.

Recommended fields:

```javascript
{
  reason: 'application-boot',
  previousWorkspaceId: null,
  nextWorkspaceId: 'journal',
  host: MME_WORKSPACE_HOST
}
```

Future workspaces may receive additional context through backward-compatible fields.

The host must not place Journal-specific objects in the common context contract.

---

## 7. Implementation Phases

## Phase 1 — Repository Inspection and Ownership Map

**Mode:** PLAN only  
**Source edits:** prohibited

### Required inspections

Inspect current ownership of:

- application boot;
- `MME_APP` creation and `mme-main-ready`;
- app-context selection and session behavior;
- `workspace-controller.js` module evaluation and `initWorkspace()`;
- Navigation History creation, opener registration and UI subscription;
- physical file opening;
- editor initialization;
- Markmap creation/refresh;
- HTML Preview creation/refresh;
- Journal sidebar creation/wiring/refresh;
- Workspace Index rebuilding;
- Wiki Links wiring;
- Task Review wiring;
- detach command and detached-window lifecycle;
- service-worker/application-shell loading.

### Required dependency map

```text
Application boot
  ↓
Workspace Host initialization
  ↓
Journal Workspace registration
  ↓
Journal activation
  ↓
Journal sidebar / physical workspace lifecycle
  ↓
Editor
  ↓
Markmap
  ↓
HTML Preview
```

Also map shared services laterally:

```text
Navigation History
Workspace Index State
Render Controller
File/Save lifecycle
```

### Required ownership map

For every major symbol/function, classify:

- Host-owned;
- Journal-owned;
- Shared service;
- Application shell;
- Legacy/duplicate compatibility path;
- Future migration candidate;
- out of scope.

### Required deliverable

Produce:

```text
WORKSPACE HOST PHASE 1 ARCHITECTURE HANDOFF
```

with:

- current branch and changes;
- current startup graph;
- current ownership table;
- Journal coupling points;
- Navigation History ownership;
- sidebar ownership;
- detach ownership;
- editor/Markmap/HTML ownership;
- candidate new files;
- candidate narrow hooks;
- protected files;
- Phase 2 feasibility;
- hard-stop findings.

### Phase 1 stop condition

Stop if Journal cannot be adapted through a thin adapter without broad movement of existing implementation.

Do not continue to Phase 2 automatically.

---

## Phase 2 — Workspace Host Skeleton

**Status:** Completed

**Starts only after explicit review approval.**

### New candidate file

```text
js/workspaces/workspace-host.js
```

### Responsibilities

- register workspace descriptors;
- reject duplicate IDs unless explicitly allowed by reviewed policy;
- activate first workspace;
- switch between registered workspaces;
- deactivate current workspace;
- capture opaque workspace state;
- restore opaque workspace state;
- delegate refresh;
- delegate detach;
- prevent overlapping lifecycle transitions;
- expose immutable state snapshots;
- notify subscribers;
- log or return structured lifecycle results.

### Must not include

- Journal-specific UI IDs;
- editor calls;
- Markmap calls;
- HTML calls;
- Navigation History stack changes;
- workspace scanning;
- Workspace Index generation;
- Report/Slides/Diagram registrations;
- top-toolbar redesign;
- sidebar redesign.

### Phase 2 success

The host module loads safely and can register a test/candidate Journal descriptor without changing visible behavior.

Do not route application boot through the host until the Journal adapter is reviewed.

---

## Phase 3 — Journal Workspace Adapter

**Status:** Completed

### Recommended new file

```text
js/workspaces/journal-workspace.js
```

### Adapter role

Expose existing Journal behavior through the common workspace interface.

Recommended API:

```javascript
JournalWorkspace.id
JournalWorkspace.title
JournalWorkspace.activate(context)
JournalWorkspace.deactivate(context)
JournalWorkspace.refresh(context)
JournalWorkspace.detach(context)
JournalWorkspace.getState()
JournalWorkspace.restoreState(state, context)
```

### Initial adapter behavior

`activate()` should initially:

- ensure existing Journal regions are visible;
- invoke existing idempotent Journal setup only when source inspection proves needed;
- preserve Navigation History service;
- preserve physical workspace state;
- preserve existing editor/Markmap/HTML instances where possible.

`deactivate()` should initially:

- capture state;
- hide or suspend Journal-owned regions only if switching requires it;
- avoid destroying CodeMirror, Markmap or listeners unnecessarily;
- not clear shared Navigation History unless the target workspace contract requires it;
- not close physical file handles merely because Journal is inactive.

`refresh()` should delegate to existing Journal refresh paths without duplicating them.

`detach()` should delegate to the existing detach capability after source inspection.

`getState()` should return a small opaque snapshot, potentially including only source-proven values such as:

- active physical file identity;
- sidebar state;
- current view state;
- selected Journal session key.

Do not invent fields unsupported by source.

`restoreState()` should restore only proven safe state owned by Journal.

### Phase 3 integration

After adapter validation:

```text
application startup
→ initialize host
→ register JournalWorkspace
→ activate('journal')
```

Existing direct initialization may remain temporarily behind idempotent guards if removing it is risky.

The PLAN must identify the single authoritative activation path before ACT.

### Phase 3 stop conditions

Stop if:

- adapter requires moving large chunks of Journal implementation;
- editor must be recreated on every activation;
- Navigation History would be duplicated;
- Journal session behavior materially changes;
- visible layout changes substantially;
- existing detach cannot be delegated safely.

---

## Phase 4 — Host-Owned Workspace Selection Infrastructure

**Status:** Internal API already present; no additional implementation required before second-workspace design; visible selector deferred.

This phase creates switching capability, not a new workspace UI redesign.

### Scope

- active-workspace state exists in host;
- one registered Journal workspace exists;
- switching API is operational;
- optional current app-context integration is reviewed;
- no workspace tabs;
- no docking;
- no new top toolbar mode controls;
- no second workspace is implemented merely to demonstrate switching.

If the existing app-context selector already represents Editor/Journal/Slides contexts, the PLAN must determine whether:

- it remains an application context selector;
- it becomes a future workspace selector;
- or it remains unchanged during Host foundation.

Do not conflate app context with Workspace Host identity without source proof.

---

## Phase 5 — Detach Capability Promotion

**Status:** Deferred

### Goal

Expose:

```javascript
MME_WORKSPACE_HOST.detach()
```

which delegates to:

```javascript
activeWorkspace.detach(context)
```

### Rules

- reuse existing detach implementation where possible;
- do not create a new detach system;
- preserve current Journal detach behavior;
- do not redesign detached-window UI;
- if current detach is editor-only and cannot safely represent Journal Workspace, report that limitation rather than broadening scope.

---

## Phase 6 — Documentation and Stable Foundation Checkpoint

**Status:** In Progress

Update repository documentation only after implementation/runtime validation.

Likely documentation targets, subject to repository conventions:

- architecture status;
- roadmap/TODO;
- verification checklist;
- module ownership notes.

Documentation must state:

- Workspace Host implemented;
- Journal is the only registered workspace;
- future workspaces are not yet implemented;
- Navigation History remains shared;
- Workspace Index remains canonical shared state;
- UI remains Journal-compatible.

---

## 8. Future Phase — Workspace Index Workspace

Not authorized by this package.

Future conceptual registration:

```text
WorkspaceHost
  → JournalWorkspace
  → WorkspaceIndexWorkspace
```

The future Workspace Index workspace must:

- consume `WORKSPACE_INDEX_STATE`;
- remain read-only;
- use the existing Navigation History service;
- activate Journal when opening a physical note;
- not create another scanner, parser, index or history.

The Host foundation must permit this extension without implementing it now.

---

## 9. Loader and PWA Contract

If new runtime files are introduced, inspect the actual loader before editing.

Likely runtime order:

```text
shared foundations
→ workspace-host.js
→ existing application/shared services
→ journal-workspace.js
→ workspace-controller activation integration
```

Exact order must be source-proven.

If `sw.js` currently owns runtime JavaScript in its application shell:

- add new runtime files exactly once;
- inspect the current application version;
- increment from the current value;
- preserve naming convention;
- validate fresh reload and cache replacement.

Do not assume version values from an older snapshot.

---

## 10. Suggested File Scope

### New candidate files

```text
js/workspaces/workspace-host.js
js/workspaces/journal-workspace.js
```

### Likely narrow modifications

```text
js/app/script-loader.js
js/workspace/workspace-controller.js
js/main.js
sw.js
```

### Possible, only if source-proven

```text
js/core/context.js
index.html
README.md
STATUS.md
TODO.md
VERIFY.md
```

### Protected unless Phase 1 proves a narrow necessity

```text
js/navigation/navigation-history.js
js/links/wiki-links.js
js/workspace/task-review.js
js/workspace/workspace-parser.js
js/workspace/workspace-scanner.js
js/editor/codemirror-bootstrap.js
js/render/render-controller.js
css/workspace.css
```

Do not freeze the final allowed-file list until Phase 1 completes.

---

## 11. Hard Prohibitions

Do not:

- redesign Journal UI;
- redesign sidebar;
- redesign top toolbar;
- introduce workspace tabs;
- introduce docking;
- implement Workspace Index workspace;
- implement Report workspace;
- implement Slides workspace;
- implement Diagram workspace;
- duplicate Navigation History;
- duplicate Workspace Index;
- duplicate scanner/parser;
- move large Journal implementations merely for stylistic purity;
- recreate editor/Markmap/HTML on every lifecycle call without source-proven need;
- create persistent workspace sessions in V1;
- commit or push without explicit instruction.

---

## 12. Hard Stop Conditions

Return to PLAN if:

1. Journal cannot be represented through a thin adapter;
2. substantial `main.js` or `workspace-controller.js` reconstruction is required;
3. editor initialization cannot remain stable;
4. Navigation History must be duplicated or moved into the host;
5. Workspace Index must be duplicated or moved into the host;
6. sidebar must be redesigned;
7. Journal activation changes the visible layout materially;
8. deactivation destroys unsaved or active physical document state;
9. session snapshot ownership cannot be isolated;
10. detach requires a new window architecture;
11. app-context and workspace identity cannot be separated safely;
12. loader order cannot guarantee host/adapter readiness;
13. lifecycle rollback cannot preserve a usable Journal state;
14. protected files are needed without reviewed justification.

---

## 13. Acceptance Tests

### Host unit/contract tests

WH1 — Register Journal

```text
register JournalWorkspace
→ list contains journal once
→ get('journal') returns exact descriptor
```

WH2 — Duplicate registration

```text
register journal twice
→ deterministic rejected/noop behavior according to final policy
```

WH3 — Activate Journal

```text
activate('journal')
→ Journal activate called once
→ active ID commits after success
```

WH4 — Re-activate current

```text
activate current Journal again
→ noop or refresh according to final policy
→ no duplicate setup/listeners
```

WH5 — Unknown workspace

```text
activate unknown ID
→ structured failure
→ current Journal remains active
```

WH6 — Transition guard

```text
rapid switch calls
→ one transition owns lifecycle
→ no partial state
```

WH7 — Failed target activation

```text
target activation fails
→ Journal remains or is restored as active
→ host state is usable
```

WH8 — Session snapshot opacity

```text
host stores Journal snapshot
→ host does not inspect/mutate fields
```

WH9 — Refresh delegation

```text
host.refresh()
→ delegates once to active Journal
```

WH10 — Detach delegation

```text
host.detach()
→ delegates once to active Journal detach
```

### Journal regression tests

J1 — Application boots with no new console errors.

J2 — Journal is registered through Workspace Host.

J3 — Journal activation preserves the current visible layout.

J4 — Editor initializes once and remains usable.

J5 — Markmap renders and preserves current behavior.

J6 — HTML Preview opens, refreshes and closes.

J7 — physical workspace Open works.

J8 — Save and Save As work.

J9 — dirty confirmation works.

J10 — Today works.

J11 — New Concept works.

J12 — Archive Active works.

J13 — Navigation History H1–H16 remain valid.

J14 — Wiki Links work in editor and HTML Preview.

J15 — Related panel works.

J16 — Tasks and Task Review work.

J17 — Tags and Search work.

J18 — active physical-file highlight works.

J19 — workspace index rebuild works.

J20 — sidebar resize/collapse state works.

J21 — existing mode/session behavior works.

J22 — existing detach behavior works.

J23 — no duplicate listeners or subscriptions.

J24 — no uncaught error or unhandled rejection.

J25 — fresh PWA reload loads host and Journal adapter correctly.

Browser behavior must not be marked passed from static inspection alone.

---

## 14. Diff and Repository Safety

Before each ACT phase:

```text
git branch --show-current
git status --short
git diff --check
git diff --stat
git diff --name-only
```

After each phase:

```text
node --check <changed classic JS files>
git diff --check
git diff --stat
git diff -- <each changed file>
```

Inspect the complete final diff before reporting completion.

Preserve all pre-existing work.

Do not use:

- `git reset`;
- `git restore`;
- `git clean`;
- `git stash`;
- complete-file reconstruction;
- broad formatting;
- automatic dependency installation.

---

## 15. Multi-Stage Workflow

Use one integrated AI conversation when context remains reliable:

```text
Phase 1 PLAN
→ external review
→ explicit Phase 2 ACT authorization
→ Host skeleton implementation
→ validation
→ Journal Adapter PLAN refinement
→ explicit adapter ACT authorization
→ adapter implementation
→ validation
→ lifecycle/detach integration
→ browser regression
→ stable checkpoint
```

Do not treat the entire document as blanket authorization to make every predicted change.

Each implementation phase requires explicit approval after the preceding phase evidence.

---

## 16. Required Phase 1 Handoff

Produce exactly:

```text
WORKSPACE HOST PHASE 1 ARCHITECTURE HANDOFF

Repository:
- branch:
- changed files:
- pre-existing ownership:
- workflow docs read:
- current loader order:
- current service-worker version:

Startup ownership:
- application boot owner:
- MME_APP owner:
- mme-main-ready owner:
- app-context owner:
- workspace-controller init:

Journal ownership:
- editor:
- Markmap:
- HTML Preview:
- sidebar:
- physical file lifecycle:
- Today:
- New Concept:
- Archive:
- Wiki Links:
- Related:
- Tasks:
- Tags:
- Search:
- detach:

Shared services:
- Navigation History:
- Workspace Index:
- Render Controller:
- file/save lifecycle:

Dependency map:
- current:
- proposed:

Coupling analysis:
- Journal/application assumptions:
- global APIs:
- duplicate lifecycle paths:
- idempotence guards:
- session ownership:
- detach constraints:

Candidate workspace-host.js review:
- accepted as-is:
- required corrections:
- transactional switch safety:
- rollback safety:
- duplicate registration policy:
- concurrent transition policy:
- snapshot safety:
- API compatibility:

Journal adapter proposal:
- file:
- interface:
- activate mapping:
- deactivate mapping:
- refresh mapping:
- detach mapping:
- getState mapping:
- restoreState mapping:
- functions wrapped, not moved:

Final Phase 2 scope:
- new files:
- modified files:
- exact hooks:
- protected files:
- loader/PWA impact:

Risks:
- risk:
  - mitigation:

Phase 2 sequence:
1.
2.
3.
4.
5.
6.
7.
8.

PLAN STATUS:

Choose exactly one:

READY FOR REVIEW — WORKSPACE HOST FOUNDATION FEASIBLE

RETURN TO ARCHITECTURE REVIEW — JOURNAL ADAPTER REQUIRES BROAD REWRITE

PLAN BLOCKED — CURRENT LIFECYCLE OWNERSHIP CANNOT BE VERIFIED
```

After the handoff, stop.

Do not edit source.
Do not switch to ACT.

---

## 17. Success Condition

The Workspace Host Foundation is complete when:

- the application boots through a registered Journal workspace;
- the Host owns active workspace lifecycle;
- Journal remains visually and functionally stable;
- Journal-specific internals remain outside the Host;
- Navigation History remains shared and passing;
- Workspace Index remains the canonical shared index;
- existing detach remains functional through workspace capability delegation;
- future workspaces can be registered without redesigning the Host;
- no future workspace other than Journal is implemented in this package;
- repository documentation accurately reflects current ownership.
