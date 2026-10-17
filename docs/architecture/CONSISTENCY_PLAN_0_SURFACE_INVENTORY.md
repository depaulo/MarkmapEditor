# Consistency PLAN-0 — Source-Proven Surface Inventory

**Status:** PLAN-only deliverable. Zero production changes. Evidence gathered
2026-10-16 against `main` at 7232494 by read-only inspection.
**Authority:** fulfills consistency-package-plan.md §9 — "The next Package
must begin with a source-proven comparison before production convergence
work." This document is that comparison. It records what EXISTS; it does not
authorize or design any convergence. Every convergence item requires owner
review and an explicit implementation ACT.

---

## 1. Surface inventory (what exists today)

| # | Surface | Kind | Owner | Container | Exit control | Navigation History |
|---|---------|------|-------|-----------|--------------|--------------------|
| S1 | Sidebar panels (Active, Notes, Knowledge, Pinned, Archive, Workspace Index panel, Tasks/Task Review, Report, Tags) | Inline collapsible panels | index.html + js/main.js + js/workspace/task-review.js + js/report/report-panel.js | `#workspaceSidebar` sections | Header toggle collapse (`data-workspace-panel-toggle`) | Not routed |
| S2 | Workspace Index full view | Routed Host workspace (`HOST_ID='workspace-index'`) | js/workspace/workspace-index-workspace.js + workspace-index-document.js | `#workspaceIndexView` (created dynamically, workspace-index-workspace.js:79–99) | Return button (`← Return to <file>`, :120–130) | Yes — virtual-workspace-index type (js/navigation/navigation-history.js:8) |
| S3 | Projects view | Routed Host workspace (`HOST_ID='projects'`) | js/workspace/projects-view.js | `#projectsView` (projects-view.js:743–756) | Return button (`← Back to Workspace`, :813–814) | Route recorded as `virtual-projects` (scripts/project-device-acceptance.cjs:128–129); engine acceptance is an open question — see Q6 |
| S4 | Task Board | Modal overlay (`role=dialog aria-modal=true`) | js/tasks/task-board.js | `#mmeTaskBoard` on document.body (:983–1079) | Close button + Escape (:1089–1105) | No history participation |
| S5 | Reports | Sidebar config panel + generated documents | js/report/report-panel.js + js/report/*.js | `#workspaceReportPanel` (:195–198) | Header toggle collapse (:212–222) | Generated Report opens as a normal file (Journal route) |
| S6 | Current Document (Edit/Read/Markmap) | Pane system | js/ui/view-layout.js (pane registry, S3 fullscreen) + editor owners | `#layout` panes | Pane toggles / fullscreen exit | File-level only (workspace-file locations) |

## 2. Header comparison (§7: headers)

**Shared grammar (S1):** `.workspacePanelHeaderButton` + `data-workspace-panel-toggle`
+ `aria-expanded` + `.workspacePanelHeaderLeft` + `.workspacePanelChevron` +
optional `.workspacePanelHeaderControls` + `.workspacePanelBadge`.
Owners: Active (js/main.js:1891–1906), Workspace Index panel (js/main.js:1949–1984),
Tasks (js/workspace/task-review.js:336–358), Report (js/report/report-panel.js:210–226),
Notes/Journals (index.html:200–206).

**Divergence H1 — badge placement:** Active places its badge INSIDE the
toggle button (js/main.js:1903–1905); Workspace Index, Tasks and Report place
badge + controls OUTSIDE the toggle in `.workspacePanelHeaderControls`
(js/main.js:1962–1983; task-review.js:349–357; report-panel.js:223–225).
Same visual family, two markup shapes.

**Divergence H2 — routed-view headers:** S2/S3 do not use the panel header
grammar; each builds its own top Return row with distinct classes
(`wsIndexReturnRow` vs `projectsReturnRow`). S4 uses a separate overlay
header (`taskBoardHeader`, task-board.js:999–1066) with its own title +
summary + filter cluster + Close.

**Divergence H3 — title/summary coupling:** Task Board couples title and
summary in one header (task-board.js:1001–1011); Workspace Index shows
"Updated …" inside the body (workspace-index-document.js:217–219); Projects
shows totals in a body row with `role=status aria-live=polite`
(projects-view.js:684–690). Three summary patterns.

## 3. Back / Workspace actions (§7: Back/Workspace actions)

- S2: `← Return to <fileName|Workspace>` — dynamic label from previous
  session file (workspace-index-workspace.js:111–129);
  `data-action="return-to-workspace"`.
- S3: `← Back to Workspace` — static label, aria-label "Back to Workspace"
  (projects-view.js:813–814); same `data-action` value.
- S4: no Workspace action; Close only (task-board.js:1058–1064, 1089–1105).
- S1: no Back action; collapse toggle only.
- Source-inspection recovery: Projects arms exactly ONE persistent recovery
  action after source navigation (`setInspection(true)`,
  projects-view.js:845–848; validator PR16
  scripts/project-view-validators.cjs:2472–2473). Workspace Index does not
  arm an equivalent recovery action (rollback only on cancelled/failed open,
  module contract :12–14).

**Inconsistency B1:** two visible return grammars ("Return to X" vs "Back to
Workspace") for the same action value; one surface names the target, the
other does not. **B2:** inspection-recovery exists only for Projects.

## 4. Source navigation (§7: source navigation)

- S2: file action buttons `data-action="open-workspace-file"` with
  data-path/data-kind (workspace-index-document.js:240–247); actions resolve
  the physical file BEFORE switching; rollback to Index on cancel/failure
  (module contract :12–13).
- S3: `openProjectSource` → `switchTo('journal')` → `openWorkspaceFileSafe`
  with `focusLine` → `focusSourceLine` (projects-view.js:833–854, 858–860).
- S1 Task Review: rows navigate to the source line (task-review.js).
- S5: generated Report opens through the normal file pipeline.
- **Already consistent:** one navigation owner (`openWorkspaceFile`) with
  reasons; path-based identity everywhere.

## 5. Full-view entry and exit (§7: full-view entry/exit)

- S2 entry: Workspace Index panel ▤ button (js/main.js:1976–1983); exit:
  Return; contract: activate builds while hidden, shows only as final step;
  deactivate hides container, preserves projection
  (workspace-index-workspace.js:8–14).
- S3 entry: Projects entry point (panel/route); exit: Return; ACT 5D model:
  source navigation leaves Projects closed and arms Back to Projects.
- S4 entry: Task Review "Board" button (task-review.js:350–355); exit:
  Close/Escape.
- **Exit-model inconsistency E1:** two routed views + one overlay + one
  collapsible-panel family = four exit grammars. No shared
  return/escape contract.

## 6. Route restoration and viewport preservation (§7)

- Navigation History V1 engine: workspace-file + virtual-workspace-index
  location types, transactional Back/Forward, restore-stack protection
  (navigation-history.js:7–9, 29–80).
- Projects scroll preservation: explicit single scroll owner
  (`data-projects-scroll-owner="1"`) with capture/restore/clamp across
  destructive re-renders (projects-view.js:758–805) — the most rigorous
  preservation in the product.
- Index full view: preserves projection across deactivate; filter/disclosure
  state module-local (workspace-index-workspace.js:30–53).
- Task Board: overlay rebuilds columns in place; filter state in localStorage.
- **Inconsistency V1:** scroll-preservation contract exists only for
  Projects; other re-rendering surfaces (Index sections, Task Review list,
  Board columns) have no documented shared owner/grammar.
- **Open question Q6:** engine `normalizeLocation` accepts only
  workspace-file and virtual-workspace-index (navigation-history.js:29–52);
  the Projects route is recorded with type `virtual-projects`
  (scripts/project-device-acceptance.cjs:128–129). Whether/how that type
  participates in Back/Forward must be verified in the implementation ACT —
  not assumed.

## 7. Filter and search preservation (§7: filter/search preservation)

| Surface | Filter owner | Persistence | Search |
|---------|--------------|-------------|--------|
| S3 Projects | `viewState.filters` + `viewState.search` (projects-view.js:662–681) | Module-local; survives re-render; route re-entry behavior to verify in ACT | Own search input (`projectsFilterSearch`) |
| S2 Index full view | `projectFilters`, `taskFilter`, `expandedDisclosureCards` (workspace-index-workspace.js:30–53) | Module-local, explicitly NEVER persisted anywhere | No own search; Workspace Search panel is the sole search owner |
| S4 Task Board | localStorage keys `markmap:taskBoard:*` (task-board.js:37–51) | Persisted across sessions | No text search |
| S1 Task Review | DOM selects, defaults per render (task-review.js:360–389) | Not persisted | Own search input |
| S5 Report | `temporaryConfig` module memory (report-panel.js:200–208, 333–356) | Session-memory only | N/A |

**Inconsistency F1:** four different filter-persistence policies (module-local,
localStorage, DOM-only, session-memory). **F2:** search ownership is clear
(Workspace Search = workspace scope) but three surfaces carry their own
scoped search with different grammars.

## 8. Pending drafts (§7: pending drafts)

- Projects: single change bar (`data-projects-change-bar`) with pending
  counts, Discard/Apply, applying busy state, `aria-live` summary
  (projects-view.js:602–623); batch outcome block applied/failed/pending/
  sources (:625–635); failed drafts retained (accepted Package 5 behavior).
- Task lifecycle mutations: physical Save per mutation through the one Save
  pipeline (task-board.js:10–27) — no draft layer.
- Editor: CodeMirror dirty state is the Current Document draft owner.
- **Drafts are domain-specific and correct.** Async outcome reporting shares
  only `role=status aria-live` (see §10).

## 9. Loading states (§7: loading states)

- Projects: explicit `Loading Projects…` projection when Index not ready
  (projects-view.js:652) + `No Workspace is open.` unavailable projection (:650).
- Index panel: summary "Index not ready" + badge "Not ready" (main.js:1962–1990).
- Index full view: container created hidden; activate shows only when built
  (workspace-index-workspace.js:8–14) — no visible loading state.
- Task Board: renders from current Index; no loading projection (task-board.js:74–76).
- **Inconsistency L1:** loading representation ranges from explicit copy →
  badge text → nothing.

## 10. Empty and failure states (§7: empty/failure states)

Empty copy inventory (all distinct):
- "No active workspace file" (main.js:1910)
- "No tasks" — summary AND list (task-review.js:390–393)
- "No Notes indexed" (workspace-index-document.js:297)
- "No Projects yet." / "No Projects match the current filters."
  (projects-view.js:660, 692)
- "No Workspace is open." / "Loading Projects…" (projects-view.js:650, 652)
- "Index not ready" (main.js:1990); badge "Not ready" (main.js:1963)
- Report: status line + empty dictionary fallback (quick-report-generator.js:72–76)

Failure representation:
- Projects: batch result block (applied/failed/pending + reason)
  (projects-view.js:625–635) + toasts for missing file/open failure (:837, 851).
- Task Board: toasts (task-board.js:90–94).
- Report: `role=status` status div (report-panel.js:296).
- **Inconsistency X1:** empty-state copy has no shared class/grammar
  (`workspaceActiveEmpty`, `workspaceTasksEmpty`, `wsIndexEmpty`,
  `projectsEmpty` + renderEmpty); failure reporting has three owners
  (block, toast, status div) with no shared contract.

## 11. Responsive behavior (§7: responsive behavior)

- Projects: narrow layout hides Stage column, reflows Delivery/Billing into
  details; five-track collapsed row preserved byte-for-byte
  (css/workspace.css:4825–4829; validators B48/B49
  scripts/project-view-validators.cjs:738–739); mutation control C29
  guarantees Return reachable on mobile (scripts/project-view-mutation-controls.cjs:244–247).
- Task Board: responsive column tracks + coarse-pointer target heights
  (css/task-board.css:37–40).
- Toolbar: `overflow-x: auto` on narrow (css/toolbar.css:127–129).
- View-layout: 44px edge-restore targets (css/view-layout.css:285–287);
  safe-area overlays (css/release-notes.css:272–274; css/overlays.css:98–100).
- Sidebar: resize handle coarse-pointer lane (css/workspace.css:203–207).
- **Inconsistency R1:** responsive strategies are per-surface and
  undocumented as a shared contract (no shared breakpoint/target-size rule
  set beyond scattered patterns).

## 12. Disclosure grammars (cross-cutting)

Coexisting grammars:
1. First-N disclosure ("+ N more" / "Show less", aria-expanded/controls) —
   Workspace Index sections (workspace-index-document.js:250–282).
2. Row details toggle (▾/▸ per row, aria-expanded/aria-controls) —
   Projects rows (projects-view.js:555–559).
3. Panel collapse (chevron + aria-expanded) — all S1 panels.
4. Release Notes entry expand (js/ui/release-notes.js:97–105) — separate again.
Not defects; recorded so convergence scope can be ruled by the owner.

## 13. Open questions for owner ruling (before any implementation ACT)

- Q1 Unify return grammar: "← Return to X" (names target) vs "← Back to
  Workspace" (generic)? One visible contract or domain-specific labels?
- Q2 Should Task Board stay a modal overlay, or become a routed view with
  history participation? (Overlay = no route restoration, no Back.)
- Q3 Badge placement: inside the toggle (Active) or in HeaderControls
  (everything else)?
- Q4 Filter-persistence policy: module-local everywhere, localStorage
  everywhere, or documented per-surface rules?
- Q5 Empty/loading/failure: adopt one shared copy+class contract
  (recommended direction: shared CSS class contract + per-surface copy,
  `role=status aria-live=polite` for async outcomes) or leave per-surface?
- Q6 Verify navigation-history participation of the `virtual-projects`
  route type (engine currently normalizes only two types).
- Q7 Adopt the Projects scroll-owner grammar (`data-*-scroll-owner`) as a
  shared contract for re-rendering surfaces?
- Q8 Consolidation scope for disclosure grammars (keep all, or converge 1+2)?

## 14. Non-goals re-asserted (plan §8)

Nothing above authorizes: a generic expanded-view framework, WYSIWYG, domain
model merging (Tasks stay Tasks, Projects stay Projects, Reports stay
generation-oriented, Notes stay files), Standalone resurrection, or any
production edit. Convergence work begins only with an owner-authorized ACT
scoped from this inventory.
