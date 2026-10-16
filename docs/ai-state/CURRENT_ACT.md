# Current ACT

## Status
IN PROGRESS — Stage D — Release identity 0.7.0, closure validation,
final activated-build acceptance, commit and push to development,
safe promotion to main, push main.

## Mission
Package 5 closure: canonical documentation alignment, roadmap reorder
(consistency before Reports), consistency-package PLAN-only direction,
Help alignment, Release Notes 0.7.0, release identity 0.7.0, closure
validation, final activated-build acceptance, commit and push to development,
safe promotion to main, push main. Stage D (release identity, commit, push)
is AUTHORIZED per owner release program.

## Current Stage
D — Release identity 0.7.0 and closure acceptance
Stage C documentation gate is green; release parity at 0.7.0 PASS.

## Authorized Scope
- Stage D: release identity 0.7.0; closure validation; final activated-build
  acceptance; commit and push to development; safe promotion to main; push
  main; final Package 5 closure report.
Do not implement the next product Package during this closure.

## Allowed Files
Stage C (complete): docs/**, js/ui/help-content.js, js/ui/release-notes-content.js,
docs/ai-state/**.
Stage D (current): js/release/release.js (productVersion 0.7.0,
cacheIdentity markmap-journal-pwa-0.7.0-projects-foundation),
sw.js (APP_VERSION markmap-journal-pwa-0.7.0-projects-foundation),
package.json (version fields only if present), plus all Stage C allowed files
for documentation/version consistency.

## Protected Files
- all accepted Projects runtime behavior (no redesign);
- Workspace Index canonical state; no second stores;
- Task lifecycle semantics (no change); Task-to-Project linkage (none);
- Do not begin consistency implementation; do not begin Reports
  implementation.

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
- release-notes-validators — RN-02–RN-17, HC-*, CL-03–CL-08, CL-10–CL-14,
  CL-16, CL-17 PASS; RN-01, CL-01, CL-02, CL-09, CL-15 expected due to
  hardcoded 0.6.3 checks in scripts/release-notes-validators.cjs (not in
  allowed files for Stage C or D; unchanged).

## Validation Results
- node --check: js/release/release.js OK, sw.js OK,
  js/ui/help-content.js OK, js/ui/release-notes-content.js OK;
- git diff --check: clean;
- release-parity normal: productVersion=0.7.0,
  cacheIdentity=markmap-journal-pwa-0.7.0-projects-foundation — PASS;
- release-parity strict: same identity — PASS;
- validate:closure: release-parity normal + strict PASS.

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
