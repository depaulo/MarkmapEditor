# Package 6 — Expanded-View Behavior and Visual Consistency

**Version target:** 0.8.x (activation NOT authorized)
**Package plan:** `docs/architecture/consistency-package-plan.md`
**Plan-0 inventory:** `docs/architecture/CONSISTENCY_PLAN_0_SURFACE_INVENTORY.md`

## Status

- Branch: `development` (all Package 6 work; `main` is release-integration only)
- PLAN-0: complete (source-proven inventory, zero production changes)
- ACT 1: complete and accepted (2026-10-18)
- ACT 2 Slice 1: complete and accepted (owner browser checkpoint 2026-10-18)
- ACT 2 Slice 2: Inspection and Return Recovery Alignment — active (on `development`)

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

### Slice 1 — pre-edit source-proven record (2026-10-18)

Inspection owners re-read: `js/workspace/projects-view.js`,
`js/workspace/workspace-index-workspace.js`,
`js/workspace/workspace-index-document.js`, `js/tasks/task-board.js`,
`js/navigation/navigation-history.js`, `css/workspace.css`.

Confirmed inconsistencies (implemented in this slice):

| # | Inconsistency | Evidence (current source) |
|---|---------------|---------------------------|
| A2-1 | Workspace Index Return label escaping is a NO-OP — `String(label).replace(/</g, '<').replace(/>/g, '>')` replaces each character with itself; a journal fileName containing markup is injected raw into `innerHTML`. Projects escapes via its `escapeAttr`/`escapeHtml` discipline. | workspace-index-workspace.js buildReturnButtonHtml; `grep -c '&lt;'` on the file = 0 |
| A2-2 | Workspace Index Return control has NO `aria-label`; the Projects Return control carries `aria-label="Back to Workspace"`. One exit control announces its target to assistive tech, the other relies on visible text only. | workspace-index-workspace.js buildReturnButtonHtml vs projects-view.js:878 |
| A2-3 | Project-filter changes in Workspace Index call `rerenderProjectionWithAnchor()` with NO anchor → `oldTop=null` → NO scroll restore → `scrollTop` resets to top, while the in-file comment claims "stay anchored near the Projects section". Projects preserves its scroll owner across every destructive re-render. Disclosure and Task-filter rerenders (anchor path) already preserve. | workspace-index-workspace.js onProjectFilterClick/onProjectFilterChange + rerenderProjectionWithAnchor |
| A2-4 | Workspace Index close/reopen loses scroll: `deactivate()` hides the container but `activate()` rebuilds `innerHTML`, resetting scroll to top. Projects restores saved offsets on `renderInto`. The container is its own scroll owner (`css/workspace.css .workspaceIndexView { overflow-y: auto }`). | workspace-index-workspace.js activate/deactivate; css/workspace.css:2752 |

Recorded, NOT implemented (owner ruling or separate ACT required):

- B1 visible return-label grammar ("← Return to X" vs "← Back to Workspace")
  — open Q1; slice changes accessible naming only, visible copy untouched.
- B2 inspection recovery exists only for Projects (ACT 5D accepted) —
  convergence is a new interaction contract, owner ruling required.
- E1/F1 (exit grammars, filter persistence) — Task Board stays a modal
  overlay; no lifecycle conversion authorized.
- Q5 copy divergence "No Projects found." (Index) vs "No Projects yet."
  (Projects view) — copy-only; both surfaces already distinguish empty vs
  filtered-empty ("No Projects match the current filters."), so the
  empty-vs-filtered-empty behavior is CONSISTENT and out of slice.
- Escape semantics: Task Board closes on Escape (overlay); routed views do
  not (PR05 accepted Escape as no-op after close) — not converged.

Authorized implementation (this slice): `js/workspace/workspace-index-workspace.js`
only — real `escapeIndexLabel()` on the Return label (text + new
`aria-label="Return to …"`), module-local scroll preservation with the
Projects-style clamp grammar across no-anchor rerenders, `refresh()`, and
close/reopen (`deactivate` captures, `activate` restores). Validators: new
W01–W08 group in `scripts/workspace-index-task-filter-validators.cjs` and
mutation controls F11–F13 in
`scripts/workspace-index-task-filter-mutation-controls.cjs` (Tier M, run in a
disposable copy).

### Slice 1 — validation evidence (2026-10-18)

Static:
- workspace-index-task-filter: 64/64 PASS (W01–W08 added)
- workspace-index-notes: 58/58 PASS
- project-view 534/534; contract 434/434; consumer 163/163;
  save-integration 103/103; device-acceptance 74/74
- mutation-anchor-audit: 167/167 anchors
- Tier M (disposable copy `../tierm-p6act2`, removed after the run): 13/13
  behavioral controls bit — including new F11 (aria-label removed), F12
  (escape reverted to no-op), F13 (scroll restore dropped) — with
  byte-identical restores and green baselines after every restore; both
  structural guards clean
- `git diff --check` clean

Browser: owner checkpoint ACCEPTED 2026-10-18 — project-filter scroll
preservation passed; close/reopen scroll restoration passed; Return target
remained correct; no unexpected Save or mutation observed; application
remains at released version 0.7.0.

## Open owner questions (PLAN-0 Q1–Q8, still open)

Q1 return-label contract; Q2 Task Board overlay question; Q3 badge placement;
Q4 filter-persistence policy; Q5 empty/loading/failure shared contract; Q6
`virtual-projects` route participation; Q7 scroll-owner grammar adoption; Q8
disclosure grammar consolidation. ACT 2 must not pre-empt these rulings —
only proven inconsistencies inside the authorized slice are implemented.