# Current ACT

## Status
CONSISTENCY PACKAGE — PLAN-0 COMPLETE (inventory document delivered:
docs/architecture/CONSISTENCY_PLAN_0_SURFACE_INVENTORY.md). PLAN stage only.
NO implementation authorized. AWAITING OWNER REVIEW of the inventory and
rulings on open questions Q1–Q8. Package 5 is CLOSED (owner laptop
acceptance 2026-10-16; refs at 7232494).

## Mission
Execute PLAN-0 for the Expanded-View Behavior and Visual Consistency
package: inventory every expanded view and cross-surface behavior listed in
docs/architecture/consistency-package-plan.md §7 (headers, Back/Workspace
actions, source navigation, full-view entry/exit, route restoration,
viewport/filter/search preservation, pending drafts, loading/empty/failure
states, responsive behavior) with source-proven evidence (file + line).
Deliver one PLAN-0 inventory document. No production file is touched.

## Current Stage
PLAN-0 complete — inventory + Q1–Q8 delivered; awaiting owner review.

## Authorized Scope
- Read-only inspection of production sources (js/**, css/**, index.html)
  for evidence.
- Write docs/architecture/CONSISTENCY_PLAN_0_SURFACE_INVENTORY.md and, if
  needed, pointer/annotation lines in consistency-package-plan.md.
- docs/ai-state/** continuity updates at ACT boundaries.
Stop before any implementation. Owner reviews the inventory and then
authorizes (or revises) the implementation ACTs.

## Allowed Files
- docs/architecture/CONSISTENCY_PLAN_0_SURFACE_INVENTORY.md (new);
- docs/architecture/consistency-package-plan.md (pointer only);
- docs/ai-state/** (ACT continuity).

## Protected Files
- ALL production js/**, css/**, index.html, sw.js — zero edits this ACT;
- no generic expanded-view framework; no WYSIWYG; no Standalone revival;
- no Reports/Draw.io/Reminders/Highlights implementation;
- domain models stay distinct (Tasks, Projects, Reports, Notes).

## Known Blockers
None source-proven. PLAN-0 can proceed read-only.

## Minimum Required Validation Tier
Tier 0 only: git diff --check; change set contains docs/** only.
Tier 1/2/3/4/M defer to implementation ACTs after PLAN approval.

## Browser/Device Checkpoint
None required for PLAN-0 (static, source-proven inventory).

## Stop Conditions
- any proposed edit to a production file;
- owner revokes PLAN stage;
- inventory expands into design decisions requiring owner ruling — record
  and ask; do not decide unilaterally.

## Closure Requirements
PLAN-0 ends with the inventory document committed on development and main
(fast-forward promotion, pushed to origin), CURRENT_ACT updated to await
owner PLAN review, and an explicit note that implementation is NOT yet
authorized.

## Authorized Scope (this ACT)
- Read-only inspection of production sources for inventory evidence;
- write the PLAN-0 inventory document (docs only);
- docs/ai-state/** continuity updates at ACT boundaries.
Stop before any implementation. Owner reviews the inventory and then
authorizes (or revises) the implementation ACTs.

## Changed Owners (Stage B, complete)
- js/tasks/task-board.js (widths, source filter, scroll preservation);
  css/task-board.css (responsive column tracks);
  js/main.js (Quick Action auto-Save path).
- Scripts updated for auto-Save harness support:
  scripts/workspace-note-metadata-validators.cjs;
  scripts/workspace-sidebar-visual-validators.cjs.
- New inline source filter tests (SQ–TF) in js/tasks/task-board.js runValidator.

## Changed Owners (Stage C, complete)
- docs/architecture/MarkmapEditor_1.0_PACKAGE_5_MANAGED_PROJECT_ARCHITECTURE.md
  (Sections 2.1–2.9 final accepted implementation).
- NEXT_CYCLE_PLAN.md (roadmap reorder: consistency before Reports).
- New consistency-package PLAN document (PLAN-only).
- js/ui/help-content.js (Projects, Task Board, Quick Action topics for 0.7.0).
- js/ui/release-notes-content.js (new 0.7.0 entry above 0.6.3).
- docs/ai-state/ACTIVE_CONTEXT.md, CURRENT_ACT.md, VALIDATION_STATE.md,
  DECISION_LOG.md (Stage C/D transitions).

## Changed Owners (Stage D, complete)
- js/release/release.js (productVersion 0.7.0,
  cacheIdentity markmap-journal-pwa-0.7.0-projects-foundation).
- sw.js (APP_VERSION markmap-journal-pwa-0.7.0-projects-foundation).
- docs/ai-state/VALIDATION_STATE.md (release parity 0.7.0, boundary items).

## Minimum Required Validation Tier
Tier 0 + Tier 1/2 per changed owner; Tier 3/4 closure; Tier M only if
mutation contract materially changed.

## Selected Suites (Stage C gate)
- node --check on touched JS/CJS — PASS;
- git diff --check — clean;
- npm run validate:package5 — 14/14 passed (incl. release-parity normal + strict);
- npm run validate:closure — release-parity normal + strict PASS;
- release-notes-validators — ALL PASS at closure. The pre-545da19 stale 0.6.3
  current-release assertions (RN-01, CL-01, CL-02, CL-09, CL-15) were aligned
  to 0.7.0 in 545da19 (test-scope only, no production file touched).

## Validation Results
- node --check: js/release/release.js OK, sw.js OK,
  js/ui/help-content.js OK, js/ui/release-notes-content.js OK;
- git diff --check: clean;
- release-parity normal: productVersion=0.7.0,
  cacheIdentity=markmap-journal-pwa-0.7.0-projects-foundation — PASS;
- release-parity strict: same identity — PASS;
- validate:closure: release-parity normal + strict PASS.
- Final closure gate re-verified 2026-10-16 on main 545da19: git diff --check
  clean; validate:quick 3/3 PASS; release-parity normal + strict PASS (0.7.0
  identity); release-notes-validators ALL PASS; public Pages read shows
  productVersion 0.7.0 (deployment follows main — not activated-build
  evidence).

## Mutation Gate Required
No by default. Tier M required only if a mutation contract or
mutation-strength validator is materially changed. Runs in disposable
isolated copies only, never against the served tree.

## Browser/Device Checkpoint
Stage B: focused owner browser retest (Task Board widths, source filter,
scroll retention, Quick Action auto-Save) — accepted as part of Package 5
owner acceptance evidence.
Stage D: activated-build acceptance and daily-driver physical smoke — pending.

## Stop Conditions
- `<STAGE> BLOCKED — <source-proven reason>` on any source-proven blocker;
- stop for explicit owner release authorization after Stage C report;
- never force-push; never reset main; never discard independent main history.

## Closure Requirements
Stage C ends with documentation gate green and release parity at 0.7.0 — COMPLETE.
Stage D ends with commit/push on development, promotion to main, push main,
and final closure report.
