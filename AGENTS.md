# MarkmapEditor — AI Agent Entry Point

## Purpose
This file is the single entry point for AI coding agents working on MarkmapEditor.
It does not replace the full documentation; it orients you and points to the
authoritative sources.

## Where to start (read in order)

1. **.cline/rules/00-markmapeditor-entrypoint.md** — mandatory session-entry
   behavior (PLAN → review → ACT, source-authority precedence, working rules,
   scope guard).
2. **docs/AI_DEVELOPMENT_WORKFLOW.md** — full development workflow: PLAN mode,
   PLAN handoff, ACT execution, validation tiers, mutation-control isolation,
   owner acceptance, package closure.
3. **docs/AI_DEVELOPMENT_ENVIRONMENT.md** — native Termux on Android; verified
   command set; commands known to be missing; do not assume conventional Linux
   paths.
4. **docs/ai-state/README.md** — AI-state file responsibilities, source-authority
   precedence, update ownership, cleanup lifecycle, document classes.
5. **docs/ai-state/ACTIVE_CONTEXT.md** — current package, phase, branch/HEAD,
   accepted evidence, working-tree boundary, immediate next action.
6. **docs/ai-state/CURRENT_ACT.md** — the single authorized ACT: status, mission,
   stage, allowed/protected files, stop conditions.
7. **docs/ai-state/VALIDATION_STATE.md** — current required tier, selected suites,
   evidence classes, pending owner checkpoints.
8. **docs/ai-state/DECISION_LOG.md** — durable decisions with canonical pointers.

## Canonical architecture (durable truth)

- `docs/architecture/MarkmapEditor_1.0_PRODUCT_ARCHITECTURE_AND_IMPLEMENTATION_PROGRAM.md`
- `docs/architecture/MarkmapEditor_1.0_PACKAGE_5_MANAGED_PROJECT_ARCHITECTURE.md`
- `docs/architecture/MarkmapEditor_Task_Lifecycle_ARCHITECTURE.md`
- `docs/architecture/MarkmapEditor_Screen_Layout_ARCHITECTURE.md`

## Roadmap & package mapping

- `docs/ROADMAP.md` — program position and package sequence
- `NEXT_CYCLE_PLAN.md` — roadmap (not architecture)
- `docs/architecture/consistency-package-plan.md` — Expanded-View Consistency package plan
- `docs/architecture/CONSISTENCY_PLAN_0_SURFACE_INVENTORY.md` — PLAN-0 surface inventory

## Validation

- `docs/validation/OWNER_TEST_MATRIX.md` — select tests by changed owner
- `docs/validation/TEST_CATALOG.md` — 37 tracked scripts + aggregate runner
- Aggregate commands: `npm run validate:quick`, `validate:projects`, `validate:tasks`,
  `validate:workspace`, `validate:reports`, `validate:package5`, `validate:closure`,
  `validate:mutation:projects`, `validate:list`

## State files (operational continuity — do not treat as architecture)

- `docs/ai-state/ACTIVE_CONTEXT.md`
- `docs/ai-state/CURRENT_ACT.md`
- `docs/ai-state/VALIDATION_STATE.md`
- `docs/ai-state/DECISION_LOG.md`
- `project-state.json` — machine-readable project state
- `docs/work/CURRENT.md` — current work summary
- `docs/validation/CURRENT_VALIDATION.md` — current validation summary

## Authority order (never invert)

1. accepted canonical architecture
2. roadmap and Package mapping
3. checked-out source and executable validators
4. compact AI-state documents
5. previous reports and conversations
6. Repomix snapshots

AI-state can never override architecture or current source.

## Current project state (see project-state.json)

- Released version: 0.7.0
- Target version: 0.8.x
- Branch: main (HEAD = 1905a86), all remotes synchronized
- Active package: Package 6 — Expanded-View Behavior and Visual Consistency
- PLAN-0: complete (source-proven surface inventory delivered)
- Release activation: NOT authorized
- Untracked artifact `re`: present — do not touch

## Prohibited unless explicitly authorized

`git reset`, `restore`, `clean`, `stash`, `amend`, branch switching, commit,
push, product-version/cache changes. Zero production source edits until the
documentation gate passes.