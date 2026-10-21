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
   owner acceptance, package closure, Final Work Report Standard (§36).
3. **docs/AI_DEVELOPMENT_ENVIRONMENT.md** — native Termux on Android; verified
   command set; commands known to be missing; do not assume conventional Linux
   paths.
4. **project-state.json** — machine-readable project state (HEAD, branch,
   released/target version, ACT statuses).
5. **docs/work/CURRENT.md** — current human-readable work summary.
6. **docs/validation/CURRENT_VALIDATION.md** — current validation evidence.
7. **docs/packages/P6-CONSISTENCY.md** — active Package scope, decisions,
   history (Package 6).
8. Only the architecture and ADR documents referenced by the current work or
   active Package — do not read every architecture file.

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

- `project-state.json` — machine-readable project state;
- `docs/work/CURRENT.md` — current work summary;
- `docs/validation/CURRENT_VALIDATION.md` — current validation summary;
- `docs/ai-state/*` — compatibility pointers only (no operational state).

## Authority order (never invert)

1. accepted canonical architecture
2. roadmap and Package mapping
3. checked-out source and executable validators
4. `project-state.json` + `docs/work/CURRENT.md` + `docs/validation/CURRENT_VALIDATION.md` + `docs/packages/P6-CONSISTENCY.md`
5. `docs/ai-state/*` — compatibility pointers only, never operational state
6. previous reports and conversations
7. Repomix snapshots

AI-state can never override architecture or current source.

## Current project state (see project-state.json)

- Released version: 0.7.0
- Target version: 0.8.0
- **Active development branch: `development`** (Package 6 work happens here)
- Release integration branch: `main` (do not advance until the accepted
  0.8.0 release boundary; never push `main` during development)
- Active package: Package 6 — Expanded-View Behavior and Visual Consistency
- Package 6 status: ACTIVE
- ACT 1 (Projects Source filtering): ACCEPTED
- ACT 2 (Expanded-View Behavior and State Consistency, slices 1–3): ACCEPTED
- ACT 3 (Sidebar Information Architecture): ACCEPTED
- ACT 4 (File Knowledge Cards and Workspace Index Consolidation): PLAN-0 active —
  source inspection only, implementation NOT AUTHORIZED until D1 gate green
- ACT 5 (Cross-surface consistency): PLANNED
- ACT 6 (Archive participation and final cross-surface consistency): PLANNED
- ACT 7 (Package closure and 0.8.0 release): NOT AUTHORIZED
- Release activation: NOT authorized
- Untracked artifact `re`: present — do not touch

## Branch policy (Package 6)

- `development` — all Package 6 planning, implementation, corrections,
  validation and documentation work; remote: `origin/development`.
- `main` — accepted released product baseline and final release-integration
  branch; remote: `origin/main` (released-product branch — not updated until
  the accepted 0.8.0 release boundary).
- Mandatory startup check: before active implementation, verify the
  checked-out branch matches the active development branch declared by
  project state. For Package 6, implementation is performed on
  `development`. Do not continue implementation on `main` unless executing
  an explicitly authorized release-integration ACT.

## Prohibited unless explicitly authorized

`git reset`, `restore`, `clean`, `stash`, `amend`, branch switching, commit,
push, product-version/cache changes. Zero production source edits until the
documentation gate passes.