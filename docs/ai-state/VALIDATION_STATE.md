# Validation State (CONSOLIDATED — compatibility pointer)

> **Status:** This file has been consolidated into the MarkmapEditor knowledge
> system. The operational continuity fields below are maintained for
> compatibility. Canonical locations are listed under "Where the information
> now lives."

## Current required test tier

**Tier: ACT 2 — targeted Tier 1/2 suites by changed owner + owner browser
checkpoint (Tier D).**

- ACT 1 closure gate (2026-10-18) re-run green: project-view 534/534,
  contract 434/434, consumer 163/163, save-integration 103/103,
  device-acceptance 74/74, mutation-anchor 164/164, `git diff --check` clean.
- ACT 2 suite selection is fixed when the slice's changed owners are fixed
  (see docs/validation/CURRENT_VALIDATION.md — "Selected suites for ACT 2").
- ACT 2 slice 1 executed 2026-10-18: workspace-index-task-filter 64/64
  (W01–W08), workspace-index-notes 58/58, project suites 534/434/163/103/74,
  mutation anchors 167/167, Tier M 13/13 in a disposable copy,
  `git diff --check` clean. Owner browser checkpoint PASSED 2026-10-18;
  slice accepted.
- Evidence discipline: static, browser and device evidence stay separately
  labeled; browser claims require owner physical observation.

## Where the information now lives

| Concern | Canonical location |
|---|---|
| Full validation summary | `docs/validation/CURRENT_VALIDATION.md` |
| Test catalog (37 scripts + runner) | `docs/validation/TEST_CATALOG.md` |
| Owner → test matrix | `docs/validation/OWNER_TEST_MATRIX.md` |
| Aggregate profiles | `npm run validate:list` |
| Original content (archived) | `docs/archive/ai-state-VALIDATION_STATE.original.md` |

## Validation tiers

- TIER 0 — QUICK DOMAIN SMOKE: fast, non-mutating, changed domain only
- TIER 1 — TARGETED DOMAIN REGRESSION: selected by changed owner
- TIER 2 — TARGETED DOMAIN REGRESSION: affected contracts and integrations
- TIER 3 — PACKAGE PRE-ACCEPTANCE: all active Package validators
- TIER 4 — PACKAGE CLOSURE: final active Package suite
- TIER M — MUTATION-CONTROL GATE: isolated disposable copies only
- TIER D — BROWSER/DEVICE: physical evidence, separate from static

## Authority order

1. accepted canonical architecture;
2. roadmap and Package mapping;
3. checked-out source and executable validators;
4. compact AI-state documents;
5. previous reports and conversations;
6. Repomix snapshots.
