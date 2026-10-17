# Validation State (CONSOLIDATED — compatibility pointer)

> **Status:** This file has been consolidated into the MarkmapEditor knowledge
> system. The operational continuity fields below are maintained for
> compatibility. Canonical locations are listed under "Where the information
> now lives."

## Current required test tier

**Tier: PLAN-0 / Knowledge Consolidation — Tier 0 only.**

No production source files are touched. Validation is limited to:
- `git diff --check` — clean
- `node --check` on any touched JS/CJS — exit 0

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
