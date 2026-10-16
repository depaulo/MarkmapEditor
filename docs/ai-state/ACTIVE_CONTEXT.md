# Active Context

## Current Package
Package 5 — Git closure complete (545da19 on development + main + both remotes);
physical activated-build acceptance and daily-driver smoke pending owner laptop.

## Current Phase
0.7.0 Release — Git promotion complete; production activation pending

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
Owner laptop: activated-build acceptance (0.6.3 → 0.7.0 upgrade path, SW/cache
identity, one-time What's New, Help/Release Notes/Logs) + compact daily-driver
smoke (Workspace, Projects, Task Board, Quick Action, surfaces). Then final
AI-state closure to Previous Package: Package 5 — CLOSED. Do NOT invoke
Consistency PLAN-0 until physical activation is recorded.

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
Package 5 Projects presentation checkpoint — owner-accepted. Stage C
documentation gate COMPLETE (133607c). Stage D release identity + Git
promotion COMPLETE (545da19 on development, main, both remotes; deployment
now serves 0.7.0). Remaining physical gate: activated-build acceptance +
daily-driver smoke (owner laptop) before "Package 5 — CLOSED" and Consistency
PLAN-0.

## Known Blockers
None source-proven.
