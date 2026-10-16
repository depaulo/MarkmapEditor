# Validation State

## Current Required Test Tier
Tier: Stage C — Tier 0 + selected Tier 1/2 per changed owner; Tier 3/4 closure
(normal + strict release parity); Tier M only for contract-sensitive changes.
Reason: Stage C documentation changes touch docs/**, js/ui/help-content.js,
js/ui/release-notes-content.js. Stage D release identity changes touch
js/release/release.js and sw.js — release-parity (normal + strict) required.
Changed owners: docs/**, js/ui/help-content.js, js/ui/release-notes-content.js.
Selected suites: release-parity (normal + strict), release-notes-validators,
git diff --check, node --check on touched JS/CJS, validate:closure.
Deferred gate suites: Tier M mutation controls (only if contract-sensitive
runtime change).
Browser/device checkpoint: Stage B focused owner retest (Task Board widths,
source filter, scroll retention, Quick Action auto-Save) — accepted as Package
5 owner acceptance evidence.

## Inherited Package 5 Static Evidence
- contract 259/259, project-view 513/513, consumer 163/163, save-integration
  103/103, device-acceptance 74/74, sidebar-visual 52/52, contract 259/259,
  index-task-filter 56/56, task-reconcile 68/68, workspace-task 184+62,
  notes-sidebar 65/65, release-notes, mutation-anchor-audit 164/164,
  release-parity normal + strict. Suite totals updated after consolidation:
  contract 434/434, project-view 523/523.

## Inherited Package 5 Browser Evidence
Owner physical acceptance (Termux X11 / Chrome): collapsed Projects summary
columns; Stage/State separation; Value/Currency non-overlap; Delivery/Billing
collapsed; source cells contained; two-line Workspace Index badge; Android
virtual-keyboard usability; non-active-source Apply; one Save per changed
source; Index rebuild; applied=1/failed=0/pending=0; viewport preservation;
fenced-code exclusion; plain/dash/star/plus declarations.

## Inherited Package 5 Device Evidence
S22/DeX device checkpoints for Workspace foundation and Projects navigation
from earlier ACTs; not rerun — no changed owner can invalidate them.

## Current Stage Evidence
- Stage A operational foundation complete (see docs/validation/OPERATIONAL
  FOUNDATION COMPLETE report):
  Commands run:
  - node --check on all touched JS/CJS files — exit 0
  - git diff --check — exit 0
  - npm run validate:projects — contract 434/434, consumer 163/163, view
    523/523, save-integration 103/103, device-acceptance 74/74,
    mutation-anchor-audit PASS; duration 3.4s; exit 0
  - node scripts/release-parity.cjs (normal) — productVersion=0.7.0,
    cacheIdentity=markmap-journal-pwa-0.7.0-projects-foundation,
    sw.js=markmap-journal-pwa-0.7.0-projects-foundation; exit 0
  - node scripts/release-parity.cjs RELEASE_PARITY_STRICT_SW=1 — same
    identity; exit 0
  - node scripts/validate-aggregate.cjs quick — 3 suites passed (syntax 93
    files, git diff --check, mutation-anchor-audit); duration 24.0s; exit 0
  - node scripts/validate-aggregate.cjs mutation:projects --setup-only —
    disposable copy isolated; served-tree sha256 unchanged; no isolated-*
    left behind; exit 0
  - node scripts/validate-aggregate.cjs quick --demo-fail — injected child
    [FAIL] demo-fail — exit 3; nonzero propagation proven; exit 0 (runner
    completed)

- Stage B source filter correction complete — all static validation green:
  - node --check: js/main.js OK, js/tasks/task-board.js OK
  - git diff --check: clean
  - npm run validate:tasks — 4/4 passed (incl. new source filter tests SQ–TF)
  - npm run validate:workspace — 11/11 passed
    (workspace-note-metadata-validators 42/42,
    workspace-sidebar-visual-validators 52/52)
  - npm run validate:projects — 6/6 passed
  - npm run validate:package5 — 14/14 passed
    (release-parity normal + strict OK)
  - npm run validate:closure — 35/35 passed

Consolidated coverage:
- contract 434/434 (group U: U1–U18 ≙ 48 locator + 127 ops checks;
  transferred from retired package5-bullet-locator-regression.cjs +
  package5-bullet-ops-coverage.cjs)
- project-view 523/523 (AP32–AP41 ≙ 16 batch/diagnostics checks;
  transferred from retired package5-batch-and-diagnostics.cjs)
- project-consumer 163/163
- project-save-integration 103/103
- project-device-acceptance 74/74
- mutation-anchor-audit PASS
- release-parity normal + strict OK

## Pending Owner Checkpoints
1. Stage C documentation gate (architecture, roadmap, Help, Release Notes,
   release parity at 0.7.0).
2. Stage D activated-build acceptance and daily-driver physical smoke.
3. Stage D commit/push on development, promotion to main, push main.

## Release Boundary
- [x] architecture aligned (Stage C);
- [x] Help aligned (Stage C);
- [x] Release Notes aligned (Stage C);
- [x] release parity (normal + strict) at closure — target 0.7.0 — PASS;
- [x] product version — Stage D complete (0.6.3 → 0.7.0);
- [x] cache identity — Stage D complete (markmap-journal-pwa-0.6.3-tasks-wiki-links-foundation → markmap-journal-pwa-0.7.0-projects-foundation);
- [ ] activated-build acceptance — Stage D;
- [ ] commit — Stage D;
- [ ] push — Stage D.

## Stage C Documentation Evidence
- Package 5 canonical architecture Sections 2.1–2.9 updated with final
  accepted implementation;
- DECISION_LOG.md decisions integrated with canonical pointers;
- Roadmap reordered: consistency before Reports;
- Consistency-package PLAN document created (PLAN-only);
- Reports plan preserved (deferred, not canceled);
- Help content updated for 0.7.0 (Projects, Task Board, Quick Action);
- Release Notes 0.7.0 entry added above 0.6.3;
- Release identity 0.7.0 prepared in js/release/release.js and sw.js.
