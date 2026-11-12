# MarkmapEditor ACT 3 — Projects Review Usability (PLAN)

PLAN APPROVED

IMPLEMENTATION AUTHORIZATION: ACT 3A ONLY

ACT 3B, ACT 3C AND ACT 3D REQUIRE SEPARATE AUTHORIZATION

---

## 1. Status and Scope

- **Approved plan:** ACT 3 — Projects Review Usability.
- **Status:** owner-approved; ACT 3A authorized for implementation; ACT 3B, ACT 3C and ACT 3D require separate authorization.
- **Goal:** Make Projects Review faster and more useful for real commercial and delivery reviews, without a greenfield redesign and without touching the accepted Projects mutation architecture.
- **Scope:** Interaction usability (Option A polish), column presets, optional Groups V1 (gated), validation and documentation closure.
- **Out of scope (this plan):** Report Composer, Report HTML/email/Reveal.js outputs, Mermaid, Draw.io export, Highlights, Reminders, Graph, Sidebar modernization, Project schema expansion (Customer/Owner/Probability), Task-to-Project integration, version/cache bump, Release Notes.
- **Branch:** `development` (Package 6 active development branch).
- **Preservation rule:** the current mutation architecture is preserved unless this plan identifies a proven source defect. No proven defect has been identified; the existing pipeline already satisfies every requirement in Part I step 11. ACT 3 is interaction/presentation polish only.

## 2. Baseline

Recorded before planning, per Part A.

- **Branch:** `development`
- **HEAD:** `dae338f78f10f0c46baa87a340ea8334122bb8f7` (commit subject: "Add new XML configuration for project reviews")
- **Working tree:** clean (`git status --short` empty; `git diff --stat` empty; `git diff --check` exit 0)
- **Synchronization:** `git fetch origin` succeeded; `git rev-list --left-right --count development...origin/development` = `0 0` (development in sync with origin/development)
- **Baseline observation:** `project-state.json` records HEAD as `d8e27164e0aa5c0edd961985404cf397f90c4d39`, which differs from the actual checked-out HEAD (`dae338f...`). `project-state.json` also describes Package 6 as closed/released toward 0.9.0, while `docs/work/CURRENT.md` and `docs/ROADMAP.md` describe Package 6 as active on `development` targeting 0.8.0 with ACT 4 plan-0. This staleness does not block source-inspection-based planning, but the plan records the actual baseline (branch `development`, HEAD `dae338f...`, clean tree, `0 0` sync) as authoritative for this task.
- **Pre-existing untracked artifacts:** `re` (untracked) and `sys` (untracked directory) are present and must not be touched (per project-state.json).

## 3. Repository Guidance Reviewed

Authoritative-current / durable-principle / current-architecture / current-validation-contract / historical-discovery / historical-proposal / superseded-context classifications:

| Document | Classification | Role in this plan |
|---|---|---|
| `.cline/rules/00-markmapeditor-entrypoint.md` | procedural authority | session-entry sequence, authority order, working rules |
| `docs/AI_DEVELOPMENT_WORKFLOW.md` | procedural authority | PLAN → review → ACT, validation tiers, Final Work Report |
| `docs/AI_DEVELOPMENT_ENVIRONMENT.md` | procedural authority | Termux environment, verified command set |
| `project-state.json` | current operational authority | machine state; recorded as stale-vs-HEAD above (baseline observation only) |
| `docs/work/CURRENT.md` | current operational authority | Package 6 active on `development`; ACT 4 accepted; protected scope |
| `docs/validation/CURRENT_VALIDATION.md` | current-validation-contract | current required test tier; accepted ACT evidence |
| `docs/packages/P6-CONSISTENCY.md` | current operational authority | Package 6 scope; ACT 1 Projects Source filter evidence; consistency method |
| `docs/PRODUCT_PRINCIPLES.md` | durable-principle | Simplicity First; Markdown is canonical source; smallest complete solution; preserve existing architecture |
| `docs/ROADMAP.md` | roadmap (not architecture) | package sequence; Program position |
| `docs/architecture/MarkmapEditor_1.0_PRODUCT_ARCHITECTURE_AND_IMPLEMENTATION_PROGRAM.md` | current-architecture | durable product/program architecture |
| `docs/architecture/MarkmapEditor_1.0_PACKAGE_5_MANAGED_PROJECT_ARCHITECTURE.md` | current-architecture | Managed Project Foundation contract (Project metadata, mutation, batch) |
| `docs/architecture/MarkmapEditor_Projects_Discovery_MVP_PLAN.md` | historical-discovery | early Projects discovery; superseded by current Package 5/Package 6 source |
| `docs/architecture/MarkmapEditor_Screen_Layout_ARCHITECTURE.md` | current-architecture | screen layout/panes |
| `docs/architecture/consistency-package-plan.md` | current-architecture | Package 6 plan; Plan-0 inventory method |
| `docs/architecture/CONSISTENCY_PLAN_0_SURFACE_INVENTORY.md` | current-architecture | PLAN-0 surface inventory method |
| `docs/validation/TEST_CATALOG.md` | current-validation-contract | 37 tracked scripts; project-view-validators / project-save-integration-validators coverage |
| `docs/validation/OWNER_TEST_MATRIX.md` | current-validation-contract | test selection by changed owner |
| `NEXT_CYCLE_PLAN.md`, `STATUS.md`, `TODO.md`, `VERIFY.md`, `VALIDATION_REPORT.txt`, `docs/validation/OPERATIONAL_FOUNDATION_COMPLETE.md` | historical / superseded | not used for active state |
| `docs/ai-state/*` | compatibility pointers only | no operational state; not updated by this task |

## 4. Guidance Precedence and Conflicts

Precedence order (when sources disagree): 1) current explicit architecture contract; 2) current accepted source implementation; 3) current validators and mutation controls; 4) recent accepted Git history; 5) durable product principles; 6) older discovery plans/proposals. Current source was followed over older discovery plans wherever they disagreed.

**Material conflicts and resolution:**

1. **ACT numbering conflict.** Repository operational docs (`project-state.json`, `docs/work/CURRENT.md`, `docs/ROADMAP.md`) number the accepted sequence as: ACT 1 = Projects Source filter, ACT 2 = Expanded-View Behavior (slices 1–3 accepted), ACT 3 = Sidebar Information Architecture (accepted), ACT 4 = File Knowledge Cards (accepted/plan-0 depending on doc). This task's framing numbers the present work as "ACT 3 — Projects Review Usability" with a roadmap ACT 3 → Report Composer → … . **Resolution:** ACT 3 is the current roadmap label for this work; old ACT 5C/5D labels remain historical. The repository's accepted ACT 3 (Sidebar) and ACT 4 (File Knowledge Cards) remain accepted and are untouched by this plan.

2. **project-state.json HEAD staleness.** `project-state.json` records HEAD `d8e27164…`; actual HEAD is `dae338f…`. **Resolution:** the plan uses the actual checked-out baseline (branch `development`, HEAD `dae338f…`, clean tree, `0 0` sync) and records the discrepancy as an observation, not a blocker.

3. **"Do not modify CSS" vs Part F Option A.** The task header says "Do not modify … CSS" while Part F Option A lists presentation additions (sticky change bar, dirty/invalid badges). **Resolution:** no sticky Apply/Discard bar is assumed. First verify whether the existing change bar already remains visible outside the `.projectsBody` scroll owner. If already visible: preserve it and add no sticky CSS. If browser evidence proves it scrolls away: authorize the smallest Projects-scoped sticky correction in `css/workspace.css`. Dirty/invalid badges likewise require browser evidence before any CSS is added. All other CSS/Workspace-surfaces/Reports/Tasks/Notes changes are forbidden.

## 5. Current Ownership Map

Source-grounded from `js/workspace/projects-view.js`, `js/workspace/project-visual-adapter.js`, `js/workspace/project-metadata-mutation.js`, `js/workspace/project-record-utils.js`, `js/workspace/workspace-parser.js`, `js/workspace/workspace-index-document.js`, `js/workspace/workspace-controller.js`, `js/main.js`, `css/workspace.css`.

| Role | Owner (file / symbol) | Notes |
|---|---|---|
| Project Markdown grammar owner | `js/workspace/workspace-parser.js` — `parseManagedProjectComment`, `MME_PROJECT_OWNED_KEYS`, `MME_PROJECT_KEY_ORDER` | Declaration grammar; bullet-prefix boundary; fenced/task exclusion |
| Project parser | `js/workspace/workspace-parser.js` | Parses Project declarations into indexed records |
| Project canonical record owner | `js/workspace/project-record-utils.js` — `MME_PROJECT_RECORD_UTILS` (`normalizeProjectCurrencyCode`, `compareProjects`, `sortProjects`, `projectRecordKey`, `isManagedProjectRecord`) | Pure; no DOM, no Save, no Index; one normalization + ordering owner |
| projectId generation/identity owner | `js/workspace/project-record-utils.js` (`projectRecordKey`, `isManagedProjectRecord`); id parsed from `mme-project` comment by `workspace-parser.js` | projectId-keyed; title is NEVER identity |
| managed/unmanaged classification owner | `js/workspace/project-record-utils.js` (`isManagedProjectRecord`); `js/workspace/projects-view.js` `decorate()` (`managed: Boolean(p.projectId)`) | Unmanaged = read-only |
| legacy-value handling owner | `js/workspace/project-metadata-mutation.js` (serializes `owned` + preserved `extras`; never erases legacy); `js/workspace/projects-view.js` `legacyOption` / `projectsQuarterLegacy` ("Custom: …") | Legacy values preserved, visible, not silently erased |
| quarter normalization owner | `js/workspace/project-record-utils.js` (ordering canonical); `js/workspace/project-metadata-mutation.js` (mutation input via `normalizeProjectQuarter`); `js/workspace/projects-view.js` `normalizeQuarterValue` (display/partial markers) | Spread across three owners; display preserves partial/legacy |
| active/archive projection owner | `js/main.js` `getActiveWorkspaceProjects(index)` (feeds Projects view); archive classification via parser/index (`workspace-parser.js`, `workspace-controller.js` `buildArchiveFileName`) | Archived Projects excluded from active projections |
| Workspace Index Project owner | `js/workspace/workspace-index-document.js`; `js/main.js` `buildWorkspaceIndex()` / `WORKSPACE_INDEX_STATE.projects` | Single Index read model |
| compact Sidebar Projects owner | `js/workspace/workspace-sidebar.js` / `js/workspace/workspace-controller.js` (`workspaceProjectsPanel`) | Sidebar panel; read-only |
| Expanded Projects route owner | `js/workspace/projects-view.js` — dedicated Host route `projects` (`HOST_ID = 'projects'`, `VIRTUAL_LOCATION_ID = 'mme://workspace/projects'`) | Separate from Workspace Index; read/Index/Sidebar stay read-only |
| Projects Review renderer | `js/workspace/projects-view.js` — `buildProjection`, `rowHtml`, `detailsControls`, `changeBarHtml`, `batchResultHtml`, `renderEmpty` | Renders table + filters + totals + change bar + batch result |
| Projects view-state owner | `js/workspace/projects-view.js` — `viewState` (`search`, `filters`, `scroll`, `expandedKeys`, `applying`, `activeEdit`, `deferred`, `firstInvalidProjectId`, `lastError`, `lastBatchResult`) | Module-local; never persisted |
| filter owner | `js/workspace/projects-view.js` — `setFilter`, `applyFilters`, `sourceOptions`, `normalizeSourceValue` | Search + Source + Stage + State + Value + Year + Quarter + Currency |
| sorting owner | `js/workspace/project-record-utils.js` (`compareProjects`, `sortProjects`) used by `projects-view.js` `buildProjection` | Canonical order: valid Expected Order → canonical → name → sourcePath → sourceLine → projectId |
| expanded-row owner | `js/workspace/projects-view.js` — `expandedKeys`, `toggleDetails`, details region in `rowHtml` | Exactly one expand control per row; exactly one details region per row |
| draft owner | `js/workspace/projects-view.js` — `draftsByProjectId` (Map), `ensureDraft`, `setDraftField`, `recomputeChanged`, `pendingSummary`, `discardAllDrafts`, `pruneDrafts` | Keyed by projectId; never persisted; managed only |
| draft validation owner | `js/workspace/projects-view.js` (`validationErrors` per draft; `recomputeChanged` clears errors when no change) + `js/workspace/project-visual-adapter.js` (Apply validates every draft before any source transition) | `firstInvalidProjectId` tracked |
| Apply-plan owner | `js/workspace/project-visual-adapter.js` — `applyProjectBatch(plan)` where plan = `{projects, sources, fieldCount}` | Single batch entry point; plan grouped by physical source |
| pure Markdown mutation owner | `js/workspace/project-metadata-mutation.js` — `MME_PROJECT_METADATA_MUTATION` (PURE BY CONTRACT) | VISIBLE_OPS: value/currency/expectedOrder; MANAGED_OPS: stage/state/delivery/billing; projectId-only targeting |
| visual adapter | `js/workspace/project-visual-adapter.js` — `MME_PROJECT_VISUAL_ADAPTER` | Orchestrates: resolve → verify (live) → pure mutate → one buffer update → one Save → Index rebuild → refresh; never writes files directly |
| source-open owner | `js/main.js` — `data-action="open-source"` navigation (`openWorkspaceFile` path) | Source stays inside row/details; no second header |
| live source re-verification owner | `js/workspace/project-visual-adapter.js` — VERIFY phase re-verifies `projectId` against live Markdown | Never trusts stale line |
| buffer-update owner | `js/main.js` — ONE programmatic editor-buffer update per source | Existing main.js owner |
| physical Save owner | `js/main.js` — ONE physical Save per source | Existing main.js owner |
| Index rebuild owner | `js/main.js` — `scheduleWorkspaceIndexRebuild()` / `buildWorkspaceIndex()` after successful Save | Rebuild only after Save success |
| partial-failure owner | `js/workspace/project-visual-adapter.js` — `BOUNDED` closed reason vocabulary; per-source complete/failed/pending outcomes | `batchResultHtml` reports Applied/Failed/Pending/Sources |
| return-to-Projects owner | `js/workspace/projects-view.js` + `js/main.js` — return control after Save/refresh | Scroll restored on render |
| scroll-restoration owner | `js/workspace/projects-view.js` — `viewState.scroll`, `restoreScrollOwner`, body `data-projects-scroll-owner="1"` | Clamped to [0, max]; preserved across rerenders |

## 6. Existing Projects Architecture

Confirmed from source. The Projects system (Package 5 Managed Project Foundation + Package 6 ACT 1 Source filter + ACT 5C view) already contains every element the task lists as "already appears to contain":

- Canonical Project parsing (`workspace-parser.js`).
- `projectId`-based identity (`project-record-utils.js` `projectRecordKey`; title never identity).
- Module-local `draftsByProjectId` (`projects-view.js`, Map, never persisted).
- Editing controls in expanded Project details (`projects-view.js` `detailsControls`; controls ONLY inside details region).
- Multiple simultaneous drafts (`draftsByProjectId` Map).
- One global Discard changes action (`data-action="discard-drafts"`; `discardAllDrafts` clears every draft).
- One global Apply changes action (`data-action="apply-drafts"`; `applyEnabled()`).
- Validation of all drafts before any source transition (adapter Apply validates every draft; `firstInvalidProjectId`).
- `MME_PROJECT_VISUAL_ADAPTER.applyProjectBatch` as the batch entry point (`project-visual-adapter.js`).
- Grouping operations by physical Markdown source (adapter plan `sources`; one Save per source).
- Live Markdown re-verification (adapter VERIFY phase).
- Pure Project metadata mutation (`project-metadata-mutation.js`, PURE BY CONTRACT).
- One buffer update per affected source (`main.js`).
- One physical Save per affected source (`main.js`).
- Index rebuild after successful Save (`main.js` `scheduleWorkspaceIndexRebuild`).
- Partial-result reporting (`BOUNDED` reasons; `batchResultHtml` Applied/Failed/Pending/Sources).
- Scroll-position preservation (`projects-view.js` scroll owner, clamped restore).
- Unmanaged Projects protected as read-only (no inputs/selectors/mutation actions; `data-projects-managed="false"`).
- Legacy values preserved instead of silently erased (`project-metadata-mutation` `owned`+`extras`; `projects-view.js` legacy note).
- Archived Projects excluded from active projections (`getActiveWorkspaceProjects`).

**Current persistence pipeline (exactly as documented, no source-proven divergence):**

Project control change → update local draft only (`setDraftField`/`recomputeChanged`) → validate every draft → build one Apply plan (`applyProjectBatch`, grouped by physical source) → open and verify live source (adapter VERIFY) → apply pure metadata mutation (`project-metadata-mutation`) → update buffer once per source (`main.js`) → save physically once per source (`main.js`) → rebuild Index after successful Save (`main.js`) → return to Projects → clear only successfully applied drafts.

## 7. Existing Projects Review UX

Confirmed by reading `js/workspace/projects-view.js` (render path, filters, change bar, row/details rendering).

- **Current route title:** `Projects` (`<h2 class="projectsViewTitle">Projects</h2>`) plus count `N Project(s)` (`projectsViewCount`). Dedicated Host route `projects`, virtual location `mme://workspace/projects`, separate from Workspace Index.
- **Current table columns (collapsed row):** Expand toggle | Project | Stage | State | Value | Order | Delivery | Billing | Source. Header uses `role="columnheader"`; toggle cell has visually-hidden "Expand" label.
- **Current filters:** Search (text), Source (select, exact `sourcePath`, duplicate-basename disambiguation, `Legacy:` fallback), Stage, State, Value (With/Without/All), Year (Expected Order), Quarter (Q1–Q4), Currency, Clear filters. All `data-filter="*"`. Filter state is module-local `viewState.filters`; never persisted.
- **Current totals:** `N of M Projects`; `With value:` / `Without value:`; per-currency totals (`Currency totalValue`). Totals reflect current filtered, persisted result (drafts never filter).
- **Current source disambiguation:** when two Projects share a source basename but differ in `sourcePath`, the Source column shows the full path for those rows (`sourceDisplayName`); source filter options use `base — dir` for duplicates; unknown stored source resets to All (never basename-match).
- **Collapsed-row content:** Project name (+ managed tag + draft badge), Stage, State, Value, Order, Delivery, Billing, Source button. Read-only: no inputs, no selectors, no per-row Apply/Cancel (`data-field="title"`/`name`/`created` never rendered as inputs).
- **Expanded-row content (managed):** editable controls — Stage select, State select, Value input (`inputmode="decimal"`), Currency select (+ `Other…`), Expected Order (year + quarter selects), Expected Delivery (year + quarter), Expected Billing (year + quarter), Created (read-only time), Source button. Quarter partial markers (`2029-` / `-Q3`) keep first selection visible and block Apply until completed or cleared; legacy/custom values render `Custom: …` note. Unmanaged rows render read-only details only.
- **Editable fields:** `stage`, `state`, `value`, `currency`, `expectedOrder`, `expectedDelivery`, `expectedBilling` (`DRAFT_FIELDS`). `created`, `projectId`, `sourcePath` are not editable.
- **How editing starts:** click the row's expand control (`data-action="toggle-details"`) → details region shows controls → changing a control creates/updates the draft via `setDraftField` → `recomputeChanged`. No explicit "Edit" affordance exists today.
- **How a draft is created:** `ensureDraft(record)` creates `{projectId, original, proposed, changedFields, validationErrors}` keyed by projectId (managed only; `projectId` required, returns null for legacy/unmanaged). Drafts survive route deactivate/reactivate within the same Workspace; pruned when projectId leaves the Index; cleared on workspace change.
- **How a draft is indicated:** draft badge on the row; row `changedAttr`; change bar shows `N Project(s) changed · M field(s)` (`data-projects-change-bar`, `data-pending-projects`, `data-pending-fields`).
- **How validation errors appear:** per-draft `validationErrors`; `firstInvalidProjectId` tracked; invalid Apply is blocked/reported via bounded reasons (adapter `BOUNDED` vocabulary); `lastError` rendered in `projectsError` alert.
- **Where Apply/Discard appears:** global change bar at bottom of the view (`projectsChangeBar`, `role="group"`, `aria-label="Pending Project changes"`), with `Discard changes` (`discard-drafts`) and `Apply changes` (`apply-drafts`) buttons; batch result shown below (`projectsBatchResult`).
- **When Apply/Discard is enabled:** `applyEnabled()` = `pendingSummary().projects > 0 && !viewState.applying`. Disabled when no drafts or while applying.
- **Behavior after Discard:** `discardAllDrafts()` clears `draftsByProjectId`, `draftsWorkspaceKey = null`, `firstInvalidProjectId = ''`; no Markdown mutation, no Save, no adapter call; pending summary cleared.
- **Behavior after successful Apply:** adapter runs batch; `lastBatchResult` set (`outcome complete`, `appliedProjects`, `appliedFields`, `appliedProjectIds`, `sources`); successful drafts cleared; batch result rendered; Index rebuilt; Projects route refreshed with scroll restored.
- **Behavior after invalid Apply:** no source transition, no physical write, draft preserved, first invalid Project reachable (`firstInvalidProjectId`); bounded reason reported.
- **Behavior after partial failure:** completed sources reported; failed source reported with bounded reason; pending/unprocessed work preserved; retry remains possible (failed drafts not cleared).
- **Behavior when filters change:** `setFilter` updates `viewState.filters`, rerenders; drafts remain (keyed by projectId, independent of filter); hidden drafted rows remain counted in pending summary; no silent discard. Stale source selection resets to All.
- **Behavior when sorting/order changes:** canonical `sortProjects` (no user sort control); order is deterministic and stable.
- **Behavior when a drafted row becomes filtered out:** draft persists in `draftsByProjectId`; remains counted in pending summary; row hidden by filter but not discarded.
- **Behavior of unmanaged Projects:** read-only; no input/selector/mutation action; source navigation retained; never receives a draft or identity.
- **Behavior of legacy/custom values:** visible (`Custom: …` note), preserved in mutation (`owned`+`extras`), not silently normalized/erased; legacy quarters/values block Apply until completed or cleared.
- **Behavior of archived Projects:** excluded from active Projects projections (`getActiveWorkspaceProjects`).
- **Behavior of multiple Projects from one source:** each is its own row; drafts keyed by projectId; Save groups changes by physical source (one Save for shared source).
- **Behavior of Projects from multiple sources:** Source filter disambiguates by exact `sourcePath`; one Save per affected source across sources.

## 8. What Is Already Implemented

All of the following are source-proven in the current tree (no gap to fill):

- multiple simultaneous Project drafts — YES (`draftsByProjectId` Map)
- no write during editing — YES (controls update draft only; no adapter call on input)
- global validation before first write — YES (Apply validates every draft before any source transition)
- one Save per physical source — YES (adapter groups by source; one physical Save per source)
- transparent partial failure — YES (`BOUNDED` reasons; `batchResultHtml` Applied/Failed/Pending/Sources)
- preserved drafts for failed or unprocessed work — YES (failed/pending preserved; only successful drafts cleared)
- no mutation of Tasks, Notes or Reports — YES (mutation owner is Project-only; adapter never touches other domains)

**Not yet implemented (the ACT 3 opportunity):** explicit Edit affordance; drafted-row auto-expansion / clean-row collapse; sticky/persistent Apply/Discard bar; clearer dirty/invalid badges; column presets; column-visibility state; session persistence of view preferences; Groups filter/column/Flat-By-Group.

## 9. Proven Usability Gaps

Separating source-proven behavior from UX inference requiring owner validation.

**Source-proven behavior:**
- Every Project must be expanded (`toggle-details`) before any field can be edited; the collapsed row is read-only by design.
- Editing controls exist only inside the per-row details region; there is no inline editing in the collapsed table.
- There is one global Apply/Discard bar at the bottom of the view.
- Drafts are module-local and never persisted (page reload starts clean).
- Source disambiguation, totals, filters, scroll preservation, partial-failure reporting, and archive/unmanaged/legacy behavior all work as documented in §7.

**UX inference (requires owner validation — not source-proven):**
- Requiring expansion of every Project before editing slows commercial/delivery review when scanning many rows.
- Comparing editable values (Stage/State/Value/Expected dates) across many Projects is difficult because values are hidden until each row is expanded.
- The filter row (7 selects + search + clear) consumes vertical space above the list.
- The most useful commercial fields (Value, Currency, Expected Order/Delivery/Billing) are not visible in the collapsed row for all rows at once.
- Expanding multiple rows makes the list harder to scan (details regions are tall).
- The table width on laptop displays (~1366×768) may crowd 9 columns plus Source.
- The Apply/Discard bar sits at the bottom; with long Project lists it is not immediately reachable without scrolling.
- Hidden (filtered-out) drafted rows are counted but not visually called out in the pending summary.
- Partial results are shown in the batch result, but a user may not notice without scanning the result area.
- The compact Sidebar Projects panel and the Expanded Projects route appear consistent (both read-only Index projections), but no new divergence is introduced by this plan.

## 10. Interaction Options A, B and C

**OPTION A — Per-Project Edit affordance on the current expanded-row model** (recommended).
- Per-Project Edit affordance: each managed row gains an Edit action that reuses the existing expand/details owner (`toggle-details`) — it expands the existing details region and focuses the first editable control. No draft is created until a field changes. No `viewState.editMode` is introduced.
- Managed row actions: Edit / Close. Unmanaged row actions: View / Close, without editing controls.
- No second action that duplicates `toggle-details`; the existing expand/details owner is reused.
- Drafted rows remain expanded across Projects rerenders while visible. When filtered out, the draft remains preserved and counted; when visible again, the drafted row is expanded again. Filters are not cleared automatically. No automatic scrolling except through the existing invalid-Apply owner.
- Optional small actions only: Expand changed / Collapse clean. They mutate only `expandedKeys`; they must not mutate drafts, Markdown, Index or files.
- Clearer dirty/invalid badges on rows and in the change bar (only if browser evidence requires CSS).
- Editing controls remain only in expanded details (no inline collapsed-table editing).
- Reuses: `projects-view.js` (drafts, expandedKeys, changeBar, rowHtml), `project-visual-adapter.js` (existing batch Apply), `project-metadata-mutation.js` (pure mutation), `project-record-utils.js` (identity/ordering), `css/workspace.css` (minimal scoped additions only when browser evidence requires).
- Duplicate-control risk: none (no new control set; `toggle-details` reused).
- Draft synchronization risk: none (single `draftsByProjectId` already shared; Option A keeps one edit surface).
- Accessibility: preserved (existing `aria-expanded`/`aria-controls`/`aria-label` on toggle; row name not an input).

**OPTION B — Explicit full table edit mode** (rejected).
- One Edit button enters table edit mode; editable controls visible for visible managed Projects in collapsed cells.
- Duplicate-control risk: high (collapsed cells + details region both editable; two edit surfaces).
- Draft synchronization risk: high (inline + expanded must share one draft object; current details-only model avoids this).
- Implementation size: large (renderer rewrite for cell editors, edit-mode state, focus management).
- Regression risk: high; conflicts with the accepted invariant "collapsed row is compact and READ-ONLY."
- Not the smallest model.

**OPTION C — Hybrid edit mode** (rejected for initial ACT 3).
- Compact table read-only by default; small set of high-value fields inline editable; full fields in expanded details; share one draft.
- Duplicate-control risk: medium (two edit surfaces for overlapping fields).
- Draft synchronization risk: medium (inline + expanded share draft).
- Larger than Option A; introduces edit-mode state the current architecture lacks.
- Deferrable: could be reconsidered after Option A is validated.
**Evaluation against criteria (A/B/C):**

| Criterion | A | B | C |
|---|---|---|---|
| implementation size | small | large | medium |
| reuse of current renderer | high | low | medium |
| duplicate-control risk | none | high | medium |
| draft synchronization risk | none | high | medium |
| accessibility | preserved | new risk | new risk |
| keyboard usability | preserved (existing focus flow) | new focus management | new focus management |
| laptop-width usability | unchanged unless change bar scrolls away (sticky only if proven needed) | unchanged/crowded | unchanged/crowded |
| comparison across Projects | partial (badges + drafted rows stay expanded) | best (all inline) | partial |
| validation clarity | preserved (global Apply) | new per-cell complexity | new per-cell complexity |
| filter interaction | unchanged | edit-mode filter complexity | edit-mode filter complexity |
| partial-failure behavior | preserved | unchanged | unchanged |
| regression risk | lowest | highest | medium |
| rollback simplicity | simplest | complex | medium |
| value for commercial review | high (fastest to deliver) | high but slow | medium |
| value for delivery review | high | high but slow | medium |

## 11. Recommended Interaction Model

**OPTION A — Per-Project Edit affordance on the current expanded-row model.**

Why it improves the real workflow: commercial and delivery reviews need to scan many Projects, spot which ones have pending changes, expand only the drafted/needing-attention rows, and apply globally without scrolling to the bottom of a long list. Option A adds exactly that (per-Project Edit affordance, drafted rows staying expanded across rerenders, clearer dirty/invalid badges) while keeping the proven architecture intact. It is the smallest model that materially improves Projects Review.

- Existing owners reused: `projects-view.js` (view state, drafts, renderer, change bar, `toggle-details`), `project-visual-adapter.js` (batch Apply), `project-metadata-mutation.js` (pure mutation), `project-record-utils.js` (identity/ordering). `css/workspace.css` is touched only if browser evidence proves the change bar scrolls away or badges require it.
- Current behavior unchanged: projectId-keyed drafts; module-local non-persisted draft state; no writes during input/change; global validation before first source transition; one batch adapter entry point; live Markdown re-verification; pure metadata mutation; one buffer update per source; one physical Save per source; Index rebuild only after successful Save; partial-failure reporting; successful-draft cleanup only; failed/unprocessed draft preservation; unmanaged read-only; legacy values visible; archived excluded; no Tasks/Notes/Reports mutation; no per-row Apply/Cancel; collapsed row read-only.
- Alternative rejected: Option B (full table edit mode) — rejected due to duplicate-control risk, draft-sync risk, large implementation size, high regression risk, and conflict with the accepted read-only collapsed-row invariant. Option C (hybrid) — rejected for initial ACT 3 due to medium duplicate-control/sync risk; revisitable after Option A validation.
- Expected files changed: `js/workspace/projects-view.js` (primary), `css/workspace.css` (only if browser evidence requires), `scripts/project-view-validators.cjs` (added coverage), `scripts/project-view-mutation-controls.cjs` (mutation controls for new UX).
- Required validators: existing `project-view-validators.cjs` + `project-view-mutation-controls.cjs` extended with checks for: per-Project Edit affordance present, single, no duplicate; no second action duplicating `toggle-details`; drafted rows remain expanded across rerenders while visible; hidden drafts remain counted in pending summary; no duplicate input listeners; no per-row Save; no per-field Save; changing a preset never mutates Project data; column preferences never enter Markdown/Index; Group derivation never mutates filenames/metadata (if Groups approved); Edit/details remain read-only for unmanaged Projects; change bar remains visible outside `.projectsBody` scroll owner (no sticky CSS added unless proven needed); badges reflect draft/invalid state.
- Browser risks: narrow-laptop (1366×768) column crowding; focus management when Edit expands details; dark/light theme badge contrast. Change bar visibility verified outside `.projectsBody` scroll owner before any sticky CSS is considered. Mitigated by scoped CSS and existing theme variables.
- Rollback boundary: per accepted sub-act commit; revert that sub-act's changed files. No claim that the entire ACT is reverted by a fixed four-file restore.

## 12. Rejected Alternatives

- **Option B (full table edit mode):** rejected — not the smallest model; duplicate-control and draft-sync risk; high regression risk; contradicts read-only collapsed-row invariant.
- **Option C (hybrid edit mode):** rejected for initial ACT 3 — medium duplicate-control/sync risk; introduces per-Project Edit state; deferrable to after Option A validation.
- **New mutation architecture / second mutation owner:** rejected — protected owner; no proven defect.
- **Per-row Save / per-field Save / write while typing:** rejected — protected pipeline.
- **Storing drafts in Markdown or browser storage:** rejected — drafts remain module-local, never persisted (current contract).
- **Replacing projectId with title identity:** rejected — identity is projectId-keyed; title never identity.
- **Bypassing live-source verification:** rejected — protected adapter VERIFY phase.
- **Project schema expansion (Customer/Owner/Probability):** rejected — deferred; not in canonical schema (§13).
- **Report Composer / Mermaid / Reveal.js / Draw.io / Sidebar modernization:** rejected — out of scope for ACT 3 (§25 deferred list).
- **Groups as new schema/frontmatter/folder migration/nested Groups/Group mutation:** rejected — Groups are a derived read-only filename projection only (§15).

## 13. Current Project Fields

Canonical indexed record fields (from `projects-view.js` `decorate()`, `DRAFT_FIELDS`, `project-record-utils.js`, `project-metadata-mutation.js`). No new fields invented; Customer/Owner/Probability excluded (not in canonical schema → listed under Deferred schema candidates only).

| Field | Canonical owner | Stored Markdown form | Normalized form | Display form | Editable | Filterable | Collapsed row | Expanded details | Table column | Preset |
|---|---|---|---|---|---|---|---|---|---|---|
| title / name (Project) | `workspace-parser.js` (first H1 → basename) | H1 / declaration name | raw (comparison lowercased only) | escaped name | no | search | yes | yes | yes | all presets |
| projectId | `workspace-parser.js` / `project-record-utils.js` | `mme-project: id=…` comment | raw id | not displayed (identity) | no | no | no (badge only) | no (identity) | no | none |
| stage | `project-metadata-mutation.js` (STAGE_CANONICAL) | `stage=…` in comment | lowercased canonical | `stageLabel()` | yes (select) | yes (Stage filter) | yes | yes | yes | Summary, Commercial, All |
| state | `project-metadata-mutation.js` (STATE_CANONICAL) | `state=…` | lowercased canonical | `stateLabel()` | yes (select) | yes (State filter) | yes | yes | yes | Summary, Commercial, Delivery, All |
| value | `project-metadata-mutation.js` (VALUE_RE) | `value=…` | canonical digits | `currency + value` | yes (decimal input) | yes (Value filter With/Without) | yes | yes | yes | Commercial, All |
| currency | `project-record-utils.js` (`normalizeProjectCurrencyCode`) | `currency=…` | trimmed uppercase 3-letter | raw | yes (select + Other…) | yes (Currency filter) | no | yes | yes | Commercial, All |
| expectedOrder | `project-record-utils.js` (ordering canonical) | `expectedOrder=…` | `{year, quarter, valid, canonical, display, raw}` | `orderDisplay` / `—` | yes (year+quarter selects) | yes (Year + Quarter filters) | yes | yes | yes | Commercial, All |
| expectedDelivery | `project-metadata-mutation.js` (via `normalizeProjectQuarter`) | `delivery=…` | compact quarter | `delivery` / `—` | yes (year+quarter) | no dedicated filter | yes | yes | yes | Delivery, All |
| expectedBilling | `project-metadata-mutation.js` (via `normalizeProjectQuarter`) | `billing=…` | compact quarter | `billing` / `—` | yes (year+quarter) | no dedicated filter | yes | yes | yes | Delivery, All |
| sourcePath / sourceName (Source) | `workspace-parser.js` / Index | physical path | `sourcePath` | `sourceDisplayName` (disambiguated) | no (navigation) | yes (Source filter exact `sourcePath`) | yes | yes (button) | yes | Summary, Delivery, All |
| sourceLine | `workspace-parser.js` | line number | int | `:line` in Source label | no | no | yes (in Source) | yes | no | none |
| created | parser (comment field) | `created=…` | raw | `<time>` / `—` | no | no | no | yes (read-only) | no | none |
| managed/unmanaged | `project-record-utils.js` (`isManagedProjectRecord`) | presence of projectId | boolean | managed tag | no | no | yes (tag) | yes (read-only vs controls) | no | none |
| parse diagnostics | `workspace-parser.js` / `project-metadata-mutation.js` | diagnostics array | — | not rendered in UI | no | no | no | no | no | none |
| validation diagnostics | `project-metadata-mutation.js` (REASONS) | — | — | not rendered in UI (bounded reasons via adapter) | no | no | no | no | no | none |

**Deferred schema candidates (NOT in ACT 3):** Customer, Owner, Probability, and any other field not in the canonical schema above. Listed only; no schema expansion in ACT 3.

## 14. Columns and Presets

Existing fields only (no schema expansion).

**Proposed column presets:**

- **Summary (default):** Project, Stage, State, Source.
- **Commercial:** Project, Value, Currency, Expected Order, Stage, State.
- **Delivery:** Project, Expected Delivery, Expected Billing, State, Source. (Stage is not part of Delivery unless explicitly listed; it is not listed here.)
- **All:** Project, Stage, State, Value, Currency, Expected Order, Expected Delivery, Expected Billing, Source (+ expand toggle always retained).

**Column behavior:**
- Default preset: Summary.
- Mandatory columns: Project (title) is mandatory; the expand toggle is always retained (first column, not hideable).
- Source can be hidden (it is included in Summary/Delivery/All but not mandatory).
- Expand control always retained (first column).
- Horizontal scroll policy: table scrolls horizontally within the Projects container on narrow layouts; no rigid pixel widths; Project column grows most (existing CSS contract `css/workspace.css` projects table).
- Minimum table width: follows existing responsive project table CSS; no new breakpoint beyond narrow-laptop.
- Narrow-laptop behavior (1366×768): Source column may be hidden first; Stage/State/Value remain; horizontal scroll preserves all columns; change bar sticky stays reachable.
- Interaction with expanded details: details span the full row below the collapsed row; presets apply to collapsed row only; details fields unchanged.
- Interaction with edit mode (Option A): no edit mode separate from expanded details; presets do not affect details controls.
- Accessibility labels: `aria-label` on expand (`Collapse/Expand details for <name>`), field `aria-label` (Stage/State/Value/Currency/…), columnheader roles, change bar `aria-label="Pending Project changes"` with `aria-live="polite"` summary.
- Empty and legacy values: `—` for empty; `Custom: …` note for legacy/non-canonical; legacy values visible, not erased.
**Preference persistence:**
- Preferred: module-local session state (`viewState` already module-local; no browser storage).
- localStorage only if the repository already has a clear accepted owner for Projects view preferences (it does not; Task Board moved away from localStorage to module-local state in ACT 2 Slice 3).
- Column preferences never persisted in: Markdown, Project metadata, Workspace Index, Workspace files, Report configuration.

## 15. Groups Decision

Groups evaluated strictly as a derived read-only filename projection (`GROUP - name.md`, space-hyphen-space delimiter, first valid delimiter; examples in task). Examples: `ALIBABA - Projects.md` → Group ALIBABA / local name Projects; `ALIBABA - Project Review - November.md` → ALIBABA / `Project Review - November`; `2026-11-11.md`, `follow-up.md`, ` - Notes.md`, `ALIBABA - .md` → Ungrouped.

Groups only for: Projects Review filter, optional Group column, optional Flat/By Group mode, future Report Composer, future Find Files filter. Not for: new schema, frontmatter group property, automatic filename changes, folder migration, nested Groups, Group entity management, Group/Task/Project mutation.

**Recommendation: defer Groups to a post-ACT-3 follow-up (not in initial sub-acts).** Base: proven review value first; add Groups only when it improves review or Report scope. Projects Review interaction + presets ship first (ACT 3A + 3B); Groups (ACT 3C) is gated on owner approval and only if real filename fixtures demonstrate review value. If real source filenames are unavailable (user Workspace content excluded), the minimum anonymized samples needed are: a set of `GROUP - name.md` files with Projects declarations across 2–3 groups, plus ungrouped and malformed examples, to validate the delimiter derivation and the filter/column UI.

This matches the preferred conservative outcome: Projects Review first → validate workflow → add Groups only when it improves review or Report scope.

## 16. Persistence and Failure Contract

- Draft state: module-local `draftsByProjectId`; never persisted; reload starts clean; drafts survive same-Workspace route deactivate/reactivate; pruned when projectId leaves the Index; cleared on Workspace change.
- Writes: none during input/change; first write only at Apply; global validation of every draft before any source transition.
- Save: one physical Save per affected source; one buffer update per source.
- Index rebuild: only after successful Save.
- Partial failure: completed sources reported; failed source reported with bounded reason; failed/pending drafts preserved; retry possible; only successfully applied drafts cleared.
- Discard: no write; persisted values restored (drafts dropped, view re-renders from Index); pending summary cleared.
- Column/preset/Group preferences: never mutate Project data, Markdown, Index, or Workspace files.
- No mutation of Tasks, Notes, or Reports at any point.

## 17. Protected Owners

The following are treated as protected (no proven defect exists); this plan does not change them:

- projectId-keyed drafts; module-local non-persisted draft state.
- No writes during input/change.
- Global validation before the first source transition.
- One batch adapter entry point (`MME_PROJECT_VISUAL_ADAPTER.applyProjectBatch`).
- Live Markdown re-verification.
- Pure metadata mutation (`project-metadata-mutation.js`).
- One buffer update per source; one physical Save per source.
- Index rebuild only after successful Save.
- Partial-failure reporting; successful-draft cleanup only; failed/unprocessed draft preservation.
- Unmanaged Projects remain read-only; legacy values remain visible; archived Projects remain outside active projections.
- No mutation of Tasks, Notes, or Reports.

Do not propose: a second mutation owner; per-row Save; per-field Save; writing while typing; storing drafts in Markdown/browser storage; replacing projectId with title identity; bypassing live-source verification; rebuilding the Projects architecture.

## 18. Files Explicitly Forbidden

No changes (this planning task makes none; ACT 3 implementation must not touch these without a separate owner decision):

- Reports domain source; Tasks domain source; Notes/Journals domain source.
- Workspace surfaces other than the dedicated Projects route (Sidebar panels, Workspace Index, Current Document, Archive, Report panels) — their logic/owners are protected.
- `sw.js` and service worker; version/cache identity files (`js/release/release.js` cache identity, `sw.js`).
- Release Notes content (`js/ui/release-notes-content.js` etc.); Help content.
- Product version / cache identity.
- Column/Project preferences in Markdown, Project metadata, Workspace Index, Workspace files, or Report configuration.
- `js/main.js` Save/buffer/Index owners — ACT 3 must not create a second Save path or new mutation owner; main.js remains unchanged unless a proven defect is found.

Note: `css/workspace.css` is the single scoped exception. No sticky Apply/Discard bar is assumed; first verify whether the existing change bar already remains visible outside the `.projectsBody` scroll owner. If already visible: preserve it and add no sticky CSS. If browser evidence proves it scrolls away: authorize the smallest Projects-scoped sticky correction. Dirty/invalid badges only if browser evidence requires. Not a visual redesign.

## 19. Validation Plan

Use existing scripts and conventions; do not create a new framework. Consult `docs/validation/OWNER_TEST_MATRIX.md` before selecting tests; run the smallest meaningful tier for changed owners.

Extended validators (existing `project-view-validators.cjs` / `project-view-mutation-controls.cjs`):

- Per-Project Edit affordance present, single, no duplicate; no `viewState.editMode`.
- No second action duplicating `toggle-details`; the existing expand/details owner is reused.
- Drafted rows remain expanded across Projects rerenders while visible; draft preserved and counted when filtered out; expanded again when visible again.
- No duplicate input listeners (one change handler per control).
- No per-row Save; no per-field Save (global Apply only).
- Hidden drafts remain represented in pending summary when filtered out.
- Changing a preset never mutates Project data (presets are view-only).
- Column preferences never enter Markdown or Index (module-local only).
- Group derivation never mutates filenames or metadata (if Groups approved).
- Edit/details remain read-only for unmanaged Projects (no input/selector/mutation action).
- Change bar remains visible outside `.projectsBody` scroll owner (no sticky CSS added unless proven needed); badges reflect draft/invalid state only if browser evidence requires.
- Existing coverage retained: parser contract, record normalization, projectId identity, managed/unmanaged, legacy preservation, quarter normalization, draft lifecycle, global validation, Apply-plan, one Save per source, partial failure, successful-draft cleanup, failed-draft preservation, scroll restoration, filter preservation, archived exclusion, compact/Expanded consistency.

Runtime owner exercised: `project-view-validators.cjs` (view), `project-view-mutation-controls.cjs` (mutation controls), `project-save-integration-validators.cjs` (Save integration), `project-device-acceptance.cjs` (device acceptance). Static + browser tiers per `docs/AI_DEVELOPMENT_WORKFLOW.md`.

## 20. Browser Acceptance Plan

A. Open clean Projects Review.
B. Verify read-only mode.
C. Enter per-Project Edit affordance.
D. Edit one Project.
E. Edit multiple Projects from the same physical source.
F. Edit Projects from multiple physical sources.
G. Create an invalid draft → Expected: no source transition; no physical write; draft preserved; first invalid Project reachable.
H. Discard all drafts → Expected: no write; persisted values restored; pending summary cleared.
I. Apply valid drafts → Expected: one Save per affected source; Index rebuild after each successful source Save according to current owner; successful drafts cleared.
J. Simulate or use an existing safe partial-failure fixture → Expected: completed sources reported; failed source reported; unprocessed work preserved; retry remains possible.
K. Change filters while drafts exist → Expected: drafts remain; hidden drafts remain counted; no silent discard.
L. Verify legacy/custom values → Expected: visible; not silently normalized or erased.
M. Verify unmanaged Project → Expected: read-only; no mutation action.
N. Verify archived Project → Expected: excluded from active Projects projections.
O. Verify compact Sidebar Projects → Expected: consistent with active Index; no new mutation owner.
P. Verify Task and Note regressions → Expected: no change to Tasks/Notes behavior.
Q. Verify column presets at 1280×720, 1366×768, 1920×1080.
R. Verify keyboard and focus behavior.
S. Verify Group filter and By Group only if Groups is approved.

**Evidence required:** browser console Logs; visible results (change bar, badges, batch result); physical files inspected (source Markdown readback after Save); Save count (one per affected source); Index count (rebuild once after Save); draft count (pending summary); partial-result message; screenshots (presets at Q sizes; invalid-draft state; partial-failure state); validator outputs (project-view / project-view-mutation-controls / save-integration / device-acceptance).

## 21. Proposed ACT 3 Sub-Acts

No more than four; stop conditions and owner gate in §26.

**ACT 3A — Interaction usability (per-Project Edit affordance).**
- Objective: faster scanning and editing for commercial/delivery reviews.
- Owner-visible result: per-Project Edit affordance reusing `toggle-details`; drafted rows remain expanded across Projects rerenders while visible; draft preserved and counted when filtered out; expanded again when visible again; cleaner dirty/invalid badges (only if browser evidence requires CSS); change bar verified visible outside `.projectsBody` scroll owner (no sticky CSS unless proven needed).
- Protected owners: all §17 owners (mutation pipeline unchanged).
- Files likely changed: `js/workspace/projects-view.js`, `css/workspace.css` (only if browser evidence requires).
- Files forbidden: §18.
- Expected changed-line range: `js/workspace/projects-view.js` 40–140; `css/workspace.css` 10–60; validators 20–100. Hard stop: more than 240 total changed lines.
- If more is required: stop and report why existing owners cannot be reused.
- Validators: extended `project-view-validators.cjs` / `project-view-mutation-controls.cjs` (§19).
- Browser acceptance: A–C, D, G–R (subset relevant to interaction).
- Commit boundary: after ACT 3A static + browser acceptance pass.
- Rollback boundary: revert ACT 3A's changed files (per accepted sub-act commit).
- Dependencies: none.
- Stop conditions: any regression in Tasks/Notes/Reports; any new mutation owner; any write during editing; change bar proven already visible outside `.projectsBody` (no sticky CSS added).

**ACT 3B — Columns and presets.**
- Objective: configurable visible fields for commercial vs delivery review.
- Owner-visible result: Summary (default)/Commercial/Delivery/All presets exactly as defined in §14; column visibility; mandatory Project + toggle; Source hideable; module-local session persistence.
- Protected owners: §17; no data mutation from presets.
- Files likely changed: `js/workspace/projects-view.js`, `css/workspace.css` (only if browser evidence requires).
- Files forbidden: §18 (preferences never in Markdown/Index/Workspace files/Report config).
- Expected changed-line range: `js/workspace/projects-view.js` 60–180; `css/workspace.css` 10–60; validators 20–100. Hard stop: more than 300 total changed lines.
- Validators: preset change never mutates data; preferences never enter Markdown/Index.
- Browser acceptance: Q (presets at three viewport sizes), R (focus).
- Commit boundary: after ACT 3B static + browser acceptance pass.
- Rollback boundary: revert ACT 3B's changed files (per accepted sub-act commit).
- Dependencies: ACT 3A.
- Stop conditions: any preset change mutating Project data; persistence outside module-local state.

**ACT 3C — Groups V1 only if approved.**
- Objective: optional Group filter + Group column + Flat/By Group mode, derived read-only.
- Owner-visible result: Groups UI only if owner approves and filename fixtures validate value.
- Protected owners: §17; no filename/metadata mutation; no schema/frontmatter.
- Files likely changed: `js/workspace/projects-view.js` (filter + column + mode).
- Files forbidden: §18; no Workspace file/folder changes.
- Expected changed-line range: 100–200 (if approved).
- Validators: Group derivation never mutates filenames/metadata.
- Browser acceptance: S (if approved).
- Commit boundary: after ACT 3C static + browser acceptance pass (if approved).
- Rollback boundary: revert `projects-view.js`.
- Dependencies: ACT 3A + 3B; owner approval + anonymized filename samples.
- Stop conditions: any Group mutation; any filename/folder migration; no owner approval → ACT 3C not started.

**ACT 3D — Closure, validation and documentation.**
- Objective: close ACT 3 with validation evidence and this plan recorded as the basis.
- Owner-visible result: validator outputs green; current validation evidence summarized; this plan's approved status updated.
- Files likely changed: none (validation + documentation only; this plan file may be updated to reflect accepted status).
- Validators: full project-view / project-view-mutation-controls / save-integration / device-acceptance tier.
- Browser acceptance: full A–S scope per §20.
- Commit boundary: after ACT 3C (if approved) browser acceptance pass.
- Rollback boundary: n/a (no source change; plan status update only).
- Dependencies: ACT 3A/B (+C if approved).
- Stop conditions: any validator or browser-acceptance failure unresolved.
- ACT 3D may update existing validators, current validation evidence and the approved plan status. Do not create another plan or summary document.

Use fewer sub-acts if safer: ACT 3C may be merged into 3D or dropped if Groups is deferred.

## 22. Files Likely Changed Per Sub-Act

| Sub-act | Files likely changed |
|---|---|
| ACT 3A | `js/workspace/projects-view.js`; `css/workspace.css` (only if browser evidence requires) |
| ACT 3B | `js/workspace/projects-view.js`; `css/workspace.css` (only if browser evidence requires) |
| ACT 3C | `js/workspace/projects-view.js` (if approved) |
| ACT 3D | none (validation + plan artifact only; plan file may be updated) |
| Validator extension (all) | `scripts/project-view-validators.cjs`; `scripts/project-view-mutation-controls.cjs` |

## 23. Commit Boundaries

This plan file is committed separately (documentation-only commit) before ACT 3A implementation begins. When authorized, one commit per sub-act (3A, 3B, 3C-if-approved, 3D) at its commit boundary, each preceded by static validation (`git diff --check`, `node --check`) and the relevant browser acceptance. No `main` advancement; all work on `development`.

## 24. Rollback Boundaries

- ACT 3A: revert ACT 3A's changed files (per accepted sub-act commit).
- ACT 3B: revert ACT 3B's changed files (per accepted sub-act commit).
- ACT 3C: revert ACT 3C's changed files (per accepted sub-act commit).
- ACT 3D: no source change.
- Rollback is per accepted sub-act commit. Do not claim the entire ACT is reverted by a fixed four-file restore.

## 25. Deferred Items

Not part of ACT 3 (no schema expansion, no new owners, no new outputs):

- Report Composer; Report HTML/email/Reveal.js outputs.
- Mermaid; Draw.io export.
- Highlights; Reminders; Graph.
- Sidebar modernization.
- Project schema expansion (Customer/Owner/Probability — deferred schema candidates only).
- Task-to-Project integration.
- Version/cache bump; Release Notes.
- Groups beyond the gated ACT 3C (deferred until owner approval + demonstrated review value or Report Composer scope).
- Full table edit mode (Option B) and hybrid edit mode (Option C) — rejected for ACT 3, revisitable later.

## 26. Owner Decisions Required

All current decisions are resolved:

- Interaction model: Option A (per-Project Edit affordance).
- Editable fields: current `DRAFT_FIELDS` only (stage, state, value, currency, expectedOrder, expectedDelivery, expectedBilling; no new fields).
- Columns: Project, Stage, State, Value, Currency, Expected Order, Expected Delivery, Expected Billing, Source, plus the always-visible toggle.
- Presets: Summary, Commercial, Delivery and All exactly as defined in §14.
- Groups: deferred to separately approved ACT 3C.
- Minimal Projects-scoped CSS: approved only when browser evidence requires it.
- ACT 3 is the current roadmap label; old ACT 5C/5D labels remain historical.
- Browser acceptance scope: approved (§20).

Only ACT 3C Groups remains gated on:

- separate owner approval;
- real anonymized filename samples;
- proven review or Report scope value.

If any decision cannot be made without anonymized Project Markdown: only the Groups decision needs samples — minimum a set of `GROUP - name.md` files with Projects declarations across 2–3 groups plus ungrouped/malformed examples. This does not block the full plan.

## 27. Implementation Authorization Gate

ACT 3A may begin only after:

- this corrected plan is reviewed;
- this plan is committed separately;
- `development` is clean and `0 0` with `origin/development`.

ACT 3B requires separate owner authorization after ACT 3A browser acceptance.

ACT 3C requires separate owner authorization and anonymized filename samples.

ACT 3D follows accepted implementation acts.

Until ACT 3A is authorized: **no source changes, no staging, no commit, no push.** The plan file remains the sole artifact of this task.

---

**End of plan.**