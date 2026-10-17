# Current Work — MarkmapEditor Package 6

## Position

- **Released version:** 0.7.0
- **Target version:** 0.8.x
- **Branch:** main, HEAD = `1905a86` (all remotes synchronized, rev-list 0/0)
- **Working tree:** clean except untracked artifact `re` (do not touch)
- **Package 5:** CLOSED (owner laptop acceptance 2026-10-16)
- **Package 6:** Expanded-View Behavior and Visual Consistency — PLAN-0 complete

## PLAN-0 status

`docs/architecture/CONSISTENCY_PLAN_0_SURFACE_INVENTORY.md` has been delivered.
It is source-proven, docs-only, zero production changes. Open questions Q1–Q8
await owner rulings before any implementation ACT is authorized:

- Q1: Unify return grammar ("← Return to X" vs "← Back to Workspace")?
- Q2: Should Task Board stay a modal overlay, or become a routed view?
- Q3: Badge placement — inside toggle (Active) or in HeaderControls (others)?
- Q4: Filter-persistence policy — module-local, localStorage, or per-surface?
- Q5: Empty/loading/failure — shared contract or per-surface?
- Q6: Verify `virtual-projects` navigation-history participation?
- Q7: Adopt Projects scroll-owner grammar as a shared contract?
- Q8: Consolidation scope for disclosure grammars?

## Knowledge consolidation (this session)

- `AGENTS.md` — AI agent entry point (created)
- `project-state.json` — machine-readable project state (created)
- `docs/work/CURRENT.md` — this file (created)
- `docs/validation/CURRENT_VALIDATION.md` — current validation summary (created)
- `docs/ROADMAP.md` — program position and package sequence (created)
- `docs/decisions/README.md` + ADR-001…007 — architecture decisions (created)
- Old `docs/ai-state/*` files reduced to compatibility pointers or archived

## First implementation ACT (pending owner authorization)

Scope: Projects Expanded View source-file filtering with session-level filter,
scroll, and return-context preservation.

- Source filter (Projects view)
- Exact source identity (projectId + sourcePath)
- Duplicate basename labels
- Filter composition
- In-memory state (module-local viewState)
- Safe return / scroll restoration
- CSS for filter controls
- Focused validators

## Do not start

- Consistency implementation before PLAN approval
- Reports implementation (deferred, not canceled)
- Draw.io redesign, generic expanded-view framework, Tasks redesign, Sidebar
  redesign, Reminders, Highlights, Standalone resurrection

## Known blockers

None source-proven. Awaiting owner PLAN review and Q1–Q8 rulings.