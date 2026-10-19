# Current Validation — MarkmapEditor Package 6

> Branch: `development` (active Package 6 branch; `main` is release-integration
> only — see AGENTS.md branch policy).

## Current required test tier

**Tier: ACT 3 PLAN-0 — source inspection and documentation only (`git diff --check`, docs readability).** No runtime implementation authorized during PLAN-0.

## ACT 2 — COMPLETE (all slices accepted)

ACT 2 Slice 1 — Workspace Index return control + scroll preservation: ACCEPTED (commit 9d01638).
Static: task/filter 64/64, Notes 58/58, project-view/contract/consumer/save-integration/device-acceptance 534/434/163/103/74, mutation-anchor 167/167, Tier M 13/13, `git diff --check` clean. Browser checkpoint passed 2026-10-18.

ACT 2 Slice 2 — Inspection and Return Recovery Alignment: ACCEPTED (commits 78a1528 + 85feeac + 13e9b88).
Static: project-view 536/536, inspection validators 15/15, workspace-index task/filter 64/64, `git diff --check` clean. Browser checkpoint passed 2026-10-19.

ACT 2 Slice 3 — Overlay Exit, Transient State, and State-Copy Consistency: ACCEPTED (commits 484fd94 + 8431188 + 9399cae).
Static: project-view 536/536, inspection validators 15/15, workspace-index task/filter 64/64, `git diff --check` clean. Browser checkpoint passed (Task Board opens, exit works, Escape/close works, filters preserved in-session, filters reset after refresh, no unexpected Save or mutation).

Release gate: still CLOSED — 0.8.x activation not authorized; no service-worker/version/cache changes in this package.

## ACT 3 PLAN-0 — ACTIVE (source inspection only, awaiting owner review)

ACT 3 PLAN-0 inventory recorded in docs/packages/P6-CONSISTENCY.md
(Sidebar ownership matrix, layer classification, Active File analysis,
File/Workspace Knowledge analysis, header/badge + responsive rulings,
3-slice recommendation, ACT 4 boundary). Implementation not authorized.
Validation: `git diff --check` + docs readability only.

## Pending owner checkpoints

None at this stage.

## ACT 1 closure evidence (2026-10-18, commit 66e3b7a)

Static full-gate re-run, all green:
- project-view validators: 534/534 PASS (28 groups; includes new S01–S11
  Source-filter group)
- project-contract: 434/434 PASS
- project-consumer: 163/163 PASS
- project-save-integration: 103/103 PASS
- project-device-acceptance: 74/74 PASS
- mutation-anchor-audit: 164 anchors, 0 missing/ambiguous PASS
- `git diff --check` clean

Browser/device evidence (owner physical checkpoint, 2026-10-18):
Mme-test-new, 8 projects — Source options rendered with duplicate-basename
disambiguation; exact-sourcePath filtering; All Sources/clear/reset;
empty-vs-filtered-empty copy; return/scroll preservation across
close/reopen. `Legacy:` option label confirmed as a proven rendering
fallback for a stale selection, not a filter defect.

Release gate: still CLOSED — 0.8.x activation not authorized; no
service-worker/version/cache changes in this package.

## Inherited Package 5 static evidence (superseded for Projects owners by ACT 1 closure re-run above)

- contract 434/434, project-view 523/523, project-consumer 163/163,
  project-save-integration 103/103, project-device-acceptance 74/74,
  mutation-anchor-audit PASS, release-parity normal + strict PASS

## Inherited Package 5 browser/device evidence

Owner physical acceptance (Termux X11 / Chrome): collapsed Projects summary
columns; Stage/State separation; Value/Currency non-overlap; Delivery/Billing
collapsed on desktop; source cells contained; two-line Workspace Index badge;
Android virtual-keyboard usability; non-active-source Apply; one Save per
changed source; Index rebuild; applied=1/failed=0/pending=0; viewport
preservation; fenced-code exclusion; plain/dash/star/plus declarations.

S22/DeX device checkpoints for Workspace foundation and Projects navigation
from earlier ACTs; not rerun — no changed owner can invalidate them.

## Validation tiers (from docs/AI_DEVELOPMENT_WORKFLOW.md §32)

- TIER 0 — QUICK DOMAIN SMOKE: fast, non-mutating, changed domain only
- TIER 1 — TARGETED DOMAIN REGRESSION: selected by changed owner
- TIER 2 — TARGETED DOMAIN REGRESSION: affected contracts and integrations
- TIER 3 — PACKAGE PRE-ACCEPTANCE: all active Package validators
- TIER 4 — PACKAGE CLOSURE: final active Package suite, cross-domain regressions
- TIER M — MUTATION-CONTROL GATE: isolated disposable copies only
- TIER D — BROWSER/DEVICE: physical evidence, separate from static

## Selected suites for PLAN-0 / knowledge consolidation

None required — Tier 0 only (`git diff --check`, docs readability).

## Selected suites — ACT 1 (Projects source filtering) EXECUTED, accepted 2026-10-18

| Changed owner | Tier 0 | Tier 1 smoke | Tier 2 targeted | Tier M | Browser/device |
|---|---|---|---|---|---|
| `js/workspace/projects-view.js` | node --check, git diff --check | — | project-view (534) | yes — project-view-mutation-controls | owner visual checkpoint (desktop + narrow) — DONE |
| `js/workspace/project-visual-adapter.js` | node --check | — | project-consumer, project-save-integration | yes — contract + consumer controls | owner apply checkpoint |
| `css/workspace.css` | git diff --check | — | project-view (columns/grid) | no | owner visual checkpoint |

## Selected suites for ACT 2 — slice 1 EXECUTED 2026-10-18, owner-accepted (browser checkpoint passed)

Changed owners: `js/workspace/workspace-index-workspace.js`,
`scripts/workspace-index-task-filter-validators.cjs` (W01–W08),
`scripts/workspace-index-task-filter-mutation-controls.cjs` (F11–F13).

| Suite | Result |
|---|---|
| workspace-index-task-filter | 64/64 PASS |
| workspace-index-notes | 58/58 PASS |
| project-view / contract / consumer / save-integration / device-acceptance | 534 / 434 / 163 / 103 / 74 PASS |
| mutation-anchor-audit | 167/167 PASS |
| Tier M workspace-index mutation controls (disposable copy) | 13/13 behavioral controls bit, restored byte-identically, baselines green |
| `git diff --check` | clean |

Task Board owners (`js/tasks/task-board.js`) NOT touched — overlay conversion
not authorized. Owner browser checkpoint PASSED 2026-10-18; slice accepted.

Aggregate commands:
- `npm run validate:quick`
- `npm run validate:projects`
- `npm run validate:tasks`
- `npm run validate:workspace`
- `npm run validate:package5`
- `npm run validate:closure`

## Evidence classes

Static fixtures never prove physical scrolling, visual overlap, keyboard
behavior, responsive usability, File System Access prompts, Service Worker
activation, Android/DeX usability. Browser and device claims require physically
observed evidence, labeled as such.

## ACT 2 Slice 2 — ACCEPTED (owner browser checkpoint 2026-10-19)

Static gate: project-view 536/536 PASS; inspection validators 15/15 PASS; workspace-index task/filter 64/64 PASS; mutation-anchor-audit PASS; `git diff --check` clean.

Browser gate: normal Project source inspection PASS; Return to Projects PASS; Project Source/Search/filter restoration PASS; Project scroll restoration PASS; normal Workspace Index source inspection PASS; Return to Workspace Index PASS; Index Project and Task filter restoration PASS; Index scroll restoration PASS; cancellation recoverable PASS; recovery controls not duplicated or stranded PASS; Task Board overlay regression PASS; no unexpected Save PASS; no unexpected source mutation PASS. Same-session transient state preserved; full browser refresh may reset transient state; no persistent browser storage. Released identity remains 0.7.0.

## ACT 2 Slice 3 — ACCEPTED (owner browser checkpoint)

Static gate: project-view 536/536 PASS; inspection validators 15/15 PASS; workspace-index task/filter 64/64 PASS; `git diff --check` clean.

Browser gate: Task Board opens normally; visible exit works; Escape/close works; previous context restoration works; filters remain during close/reopen in-session; filters reset after full browser refresh; Task Board functional after refresh; no duplicate close behavior; no unexpected Save; no unexpected Task or Markdown mutation. Regression: Workspace initialization passed; Workspace Index initialization passed; Projects module remained registered; Task Review remained active; no critical browser error observed. Released identity remains 0.7.0.

## Pending owner checkpoints

None at this stage.