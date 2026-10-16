# Active Context

## Current Package
Package 5 — Closure

## Current Phase
0.7.0 Release Preparation

## Current Branch and HEAD
- branch: development
- HEAD: 5270b10 (dirty working tree preserved; Stage C/D authorized per
  owner release program)

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
Complete Stage C documentation: architecture alignment (Sections 2.1–2.9),
roadmap reorder (consistency before Reports), consistency-package PLAN
document, Help alignment (Projects/Task Board/Quick Action topics),
Release Notes 0.7.0 entry, then Stage D release identity, validation,
commit, push, promotion to main.

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
documentation gate pending. Stage D release authorization pending.

## Known Blockers
None source-proven.
