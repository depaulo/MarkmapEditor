# Validation State (CONSOLIDATED — compatibility pointer)

> **Status:** This file has been consolidated into the MarkmapEditor knowledge
> system. The operational continuity fields below are maintained for
> compatibility. Canonical locations are listed under "Where the information
> now lives."

## Current required test tier

**Tier: ACT 3 PLAN-0 — source inspection and documentation only.**

- ACT 2 (Slices 1–3) accepted; see docs/validation/CURRENT_VALIDATION.md
  for closure evidence.
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
