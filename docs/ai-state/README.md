# AI State — Operational Continuity Files (CONSOLIDATED)

> **Status:** This file has been consolidated into the MarkmapEditor knowledge
> system. The content below is a compatibility pointer. Canonical locations are
> listed under "Where the information now lives."

## File responsibilities (historical)

- **ACTIVE_CONTEXT.md** — where the program is right now: Package, phase,
  branch/HEAD, accepted evidence, working-tree boundary, immediate next
  action, do-not-start list, required architecture, owner checkpoint, known
  blockers.
- **CURRENT_ACT.md** — the single authorized ACT: status, mission, stage,
  allowed/protected files, changed owners, required validation tier, selected
  suites, mutation gate, browser/device checkpoint, stop conditions, closure
  requirements.
- **VALIDATION_STATE.md** — current required tier, selected suites, inherited
  static/browser/device evidence (separated), current-stage evidence, pending
  owner checkpoints, release boundary checklist.
- **DECISION_LOG.md** — durable decisions with ID, date, status, evidence and
  canonical destination.

## Where the information now lives

| Concern | Canonical location |
|---|---|
| Project state (machine-readable) | `project-state.json` |
| AI agent entry point | `AGENTS.md` |
| Current work summary | `docs/work/CURRENT.md` |
| Current validation summary | `docs/validation/CURRENT_VALIDATION.md` |
| Roadmap and package sequence | `docs/ROADMAP.md` |
| Architecture decisions (ADR-001…008) | `docs/decisions/README.md` + `docs/decisions/ADR-00*.md` |
| Canonical architecture | `docs/architecture/*.md` |
| Workflow rules | `docs/AI_DEVELOPMENT_WORKFLOW.md` |
| Environment | `docs/AI_DEVELOPMENT_ENVIRONMENT.md` |
| Original ai-state content (archived) | `docs/archive/ai-state-*.original.md` |

## Source-authority precedence

1. accepted canonical architecture;
2. roadmap and Package mapping;
3. checked-out source and executable validators;
4. compact AI-state documents;
5. previous reports and conversations;
6. Repomix snapshots.

AI-state can never override architecture or current source.

## Original content

The pre-consolidation content of each file is preserved at:
- `docs/archive/ai-state-README.original.md`
- `docs/archive/ai-state-ACTIVE_CONTEXT.original.md`
- `docs/archive/ai-state-CURRENT_ACT.original.md`
- `docs/archive/ai-state-VALIDATION_STATE.original.md`
- `docs/archive/ai-state-DECISION_LOG.original.md`
