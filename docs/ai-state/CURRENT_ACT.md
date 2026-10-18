# Current ACT (CONSOLIDATED — compatibility pointer)

> **Status:** This file has been consolidated into the MarkmapEditor knowledge
> system. The operational continuity fields below are maintained for
> compatibility. Canonical locations are listed under "Where the information
> now lives."

## Current ACT status

- **Package:** Package 6 — Expanded-View Behavior and Visual Consistency
- **Stage:** ACT 2 — first bounded consistency slice (implementation
  authorized by owner; ACT 1 closed 2026-10-18)
- **Mission:** Projects + Workspace Index expanded-view behavioral
  consistency — exit/return semantics, scroll ownership, empty vs
  filtered-empty state presentation; implement only differences proven
  inconsistent against current source
- **Authorized scope:** production edits limited to the slice's current
  owners (`js/workspace/projects-view.js`,
  `js/workspace/workspace-index-workspace.js`, `-document.js` only if its
  proven inconsistencies are in-slice, validators, CSS only if a proven
  inconsistency requires it); docs updates at ACT boundary
- **Protected files/areas:** Reports owners; Task Board overlay conversion
  (`js/tasks/task-board.js` stays an overlay); `js/release/release.js`,
  `sw.js`, cache identity; 0.8.x activation; persistent filter storage; the
  untracked artifact `re`; generic expanded-view frameworks
- **Stop conditions:** slice would expand beyond proven inconsistencies;
  a PLAN-0 question (Q1–Q8) requires an owner ruling to proceed; any
  protected file would change

## Where the information now lives

| Concern | Canonical location |
|---|---|
| Full project state | `project-state.json` |
| AI agent entry point | `AGENTS.md` |
| Current work summary | `docs/work/CURRENT.md` |
| Current validation | `docs/validation/CURRENT_VALIDATION.md` |
| Original content (archived) | `docs/archive/ai-state-CURRENT_ACT.original.md` |

## Authority order

1. accepted canonical architecture;
2. roadmap and Package mapping;
3. checked-out source and executable validators;
4. compact AI-state documents;
5. previous reports and conversations;
6. Repomix snapshots.
