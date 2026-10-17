# Active Context

## Current Package
Expanded-View Behavior and Visual Consistency — PLAN-0 (inventory only;
PLAN stage, no implementation authorized).

## Previous Package
Package 5 — CLOSED (0.7.0 activated: deployed build accepted on owner laptop
2026-10-16; git closure at 133607c + 545da19 + 7232494 on development, main
and both remotes).

## Current Phase
Consistency package — PLAN-0 source-proven surface inventory

## Current Branch and HEAD
- branch: main
- HEAD: 545da19 (test(release): align current release validation with 0.7.0)
- development: 545da19; origin/development: 545da19; origin/main: 545da19
- Git truth (2026-10-16 reconciliation): 133607c exists and is ancestor of all
  four refs; Stage C docs + Stage D release identity pushed; narrow RN-01
  alignment 545da19 pushed to development AND main; rev-list main...development
  0/0; development...main tree diff empty; no independent main history.

## Accepted Package 5 Evidence
Summarize only:
- managed Project identity (UUID + sequential short IDs; title, line and
  ordinal are not identity);
- plain, dash, star and plus Project declarations accepted and preserved;
- same-source and cross-source Apply;
- one physical Save per changed source;
- failed-draft retention and bounded refusal diagnostics with explicit
  failure origins (canonical-verification / mutation-owner /
  owner-exception);
- source navigation and route restoration;
- fenced-code exclusion and viewport preservation;
- quarter validation (Order/Delivery/Billing);
- Projects presentation: collapsed summary Project | Stage | State | Value |
  Order | Delivery | Billing | Source; Stage/State separate; Value/Currency
  non-overlapping; Delivery/Billing collapsed on desktop and hidden on
  narrow layouts;
- Workspace Index Stage/State parity and dynamic two-line badge counts
  (`<n> files` / `<n> open`);
- Task Board responsive column widths; exact filePath source filtering;
  duplicate basename disambiguation; filter composition; scroll/state
  preservation;
- one automatic physical Save after accepted Workspace metadata Quick Actions;
  Pin/Unpin/Knowledge promotion persistence; Sidebar and Index refresh after
  Save.

## Current Working-Tree Boundary
All groups below are committed; the release landed in 133607c + 545da19.
The current tree holds docs/ai-state closure reconciliation only.
Changed files by functional group (Stage B, complete):
- Projects runtime: js/workspace/projects-view.js,
  js/workspace/project-visual-adapter.js,
  js/workspace/project-metadata-mutation.js,
  js/workspace/workspace-index-document.js, js/main.js (badge),
  css/workspace.css;
- Stage B Task Board + Quick Action auto-Save: js/tasks/task-board.js
  (widths, source filter, scroll preservation), css/task-board.css
  (responsive column tracks, source filter styles), js/main.js
  (Quick Action auto-Save after applyActiveNoteMetadata);
- validators: scripts/project-view-validators.cjs,
  scripts/project-contract-validators.cjs,
  scripts/project-consumer-validators.cjs,
  scripts/project-view-mutation-controls.cjs,
  scripts/workspace-sidebar-visual-validators.cjs,
  scripts/workspace-note-metadata-validators.cjs (saveSmart stub,
  L20 auto-save assertion, L15-L19/L25 await),
  scripts/workspace-sidebar-visual-validators.cjs (saveSmart stub);
- Stage C documentation (in progress): docs/ai-state/CURRENT_ACT.md,
  docs/ai-state/ACTIVE_CONTEXT.md, docs/ai-state/VALIDATION_STATE.md,
  docs/ai-state/DECISION_LOG.md.

## Immediate Next Action
Owner review of docs/architecture/CONSISTENCY_PLAN_0_SURFACE_INVENTORY.md
and rulings on open questions Q1–Q8 (return grammar, Task Board exit model,
badge placement, filter persistence, empty/failure contract, virtual-projects
history verification, scroll-owner grammar, disclosure scope). Then owner
authorizes (or revises) the first implementation ACT. No implementation
until that authorization.

## Do Not Start
- consistency implementation before PLAN approval;
- Reports implementation (deferred, not canceled);
- Draw.io redesign; generic expanded-view framework; Tasks redesign; Sidebar
  redesign; Reminders; Highlights; Standalone resurrection.

## Required Architecture
- docs/architecture/MarkmapEditor_1.0_PRODUCT_ARCHITECTURE_AND_IMPLEMENTATION_PROGRAM.md
- docs/architecture/MarkmapEditor_1.0_PACKAGE_5_MANAGED_PROJECT_ARCHITECTURE.md
- docs/architecture/MarkmapEditor_Task_Lifecycle_ARCHITECTURE.md
- docs/architecture/MarkmapEditor_Screen_Layout_ARCHITECTURE.md
- NEXT_CYCLE_PLAN.md (roadmap; not architecture)

## Current Owner Checkpoint
Package 5 CLOSED — owner-accepted activated build on laptop 2026-10-16
(upgrade path, What's New/Help/Logs, daily-driver smoke). Consistency package
activated at PLAN stage; PLAN-0 inventory in progress. Implementation starts
only after PLAN approval.

## Known Blockers
None source-proven.
