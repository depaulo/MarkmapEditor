# Package 6 — Expanded-View Behavior and Visual Consistency

**Version target:** 0.8.x (activation NOT authorized)
**Package plan:** `docs/architecture/consistency-package-plan.md`
**Plan-0 inventory:** `docs/architecture/CONSISTENCY_PLAN_0_SURFACE_INVENTORY.md`

## Status

- PLAN-0: complete (source-proven inventory, zero production changes)
- ACT 1: complete and accepted (2026-10-18)
- ACT 2: first bounded consistency slice — in progress

## ACT 1 — Projects Source filter (ACCEPTED, commit 66e3b7a)

- **Objective:** rendered Source filter for the Projects view with exact
  `sourcePath` identity matching; module-local state only (no persistent
  storage).
- **Owners touched:** `js/workspace/projects-view.js`
  (`viewState.filters.source`, `sourceOptions`/`baseNameOf`/`dirOf`/
  `normalizeSourceValue`, exact-match `applyFilters`, `buildProjection`
  `<select data-filter="source">` with duplicate-basename disambiguation,
  `setFilter`/`clearFilters`/`resetViewState`);
  `scripts/project-view-validators.cjs` (F01/F10 realigned; S01–S11 Source
  group added).
- **Static evidence (2026-10-18):** view 534/534; contract 434/434; consumer
  163/163; save-integration 103/103; device-acceptance 74/74; mutation-anchor
  164/164; `git diff --check` clean.
- **Browser evidence:** owner physical checkpoint (Mme-test-new, 8 projects):
  options with duplicate-basename disambiguation ("base — dir"), exact-source
  filtering, All Sources/clear/reset, empty-vs-filtered-empty copy, in-memory
  persistence across close/reopen, scroll preservation.
- **Observation (Q4-relevant, not a defect):** when one physical file is
  reachable from two Workspace roots, option labels differ only by root
  suffix ("Project Alpha — Workspace-Client" / "— Workspace-Archive"); the
  disambiguation grammar cannot distinguish a within-root duplicate basename.
  The exact-`sourcePath` filtering contract stays correct; any label change
  requires an owner ruling.
- **Note:** `Legacy:` fallback option renders when a stored selection no
  longer exists in the current index — proven rendering fallback, not a
  filter bug.

## ACT 2 — first bounded consistency slice (IN PROGRESS)

- **Objective (consistency-package-plan §11):** Projects + Workspace Index
  expanded-view behavioral consistency — exit/return semantics, scroll
  ownership, empty vs filtered-empty state presentation.
- **Method:** re-verify PLAN-0 divergences (B1/V1/E1/F1) against current
  source; implement only differences proven inconsistent, within current
  owners; targeted static validation + owner browser checkpoint per ACT.
- **Protected scope:** Task Board overlay conversion not authorized; no
  Reports changes; no 0.8.x activation; no service-worker/version/cache
  changes; no persistent filter storage; no generic expanded-view framework;
  domain models stay separate.

## Open owner questions (PLAN-0 Q1–Q8, still open)

Q1 return-label contract; Q2 Task Board overlay question; Q3 badge placement;
Q4 filter-persistence policy; Q5 empty/loading/failure shared contract; Q6
`virtual-projects` route participation; Q7 scroll-owner grammar adoption; Q8
disclosure grammar consolidation. ACT 2 must not pre-empt these rulings —
only proven inconsistencies inside the authorized slice are implemented.