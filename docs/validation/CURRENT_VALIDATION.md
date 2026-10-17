# Current Validation — MarkmapEditor Package 6

## Current required test tier

**Tier: PLAN-0 / Knowledge Consolidation — Tier 0 only.**

No production source files are touched in this session. Validation is limited to:
- `git diff --check` — clean
- `node --check` on any touched JS/CJS — exit 0
- No browser/device checkpoint required for PLAN-0 docs-only work

## Inherited Package 5 static evidence (accepted, not rerun)

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

## Selected suites for first implementation ACT (Projects source filtering)

| Changed owner | Tier 0 | Tier 1 smoke | Tier 2 targeted | Tier M | Browser/device |
|---|---|---|---|---|---|
| `js/workspace/projects-view.js` | node --check, git diff --check | — | project-view (523) | yes — project-view-mutation-controls | owner visual checkpoint (desktop + narrow) |
| `js/workspace/project-visual-adapter.js` | node --check | — | project-consumer, project-save-integration | yes — contract + consumer controls | owner apply checkpoint |
| `css/workspace.css` | git diff --check | — | project-view (columns/grid) | no | owner visual checkpoint |

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

## Pending owner checkpoints

None at this stage.