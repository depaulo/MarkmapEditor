# MarkmapEditor Next-Cycle Plan (post-0.6.2)

> **This document is a roadmap, not the architecture.**
> The canonical architecture and package contract is
> `docs/architecture/MarkmapEditor_1.0_PRODUCT_ARCHITECTURE_AND_IMPLEMENTATION_PROGRAM.md`.
> Read that document first. This file records the sequence, the accepted source-owner
> evidence, and the pointer to the current package. It deliberately does **not**
> duplicate the canonical architecture.

**Status: PLANNING DOCUMENT ONLY. No runtime implementation was authorized here.**
**Synchronized:** Gate 1 — architecture synchronization, source reconciliation and
implementation handoffs. No runtime file was changed by that Gate.

---

## 0. Program position

```text
Release 0.6.2 (Notes Workspace Foundation)   → accepted and published
ACT V0 (Sidebar visual correction)          → implemented, mobile checkpoint accepted
Canonical 1.0 architecture                  → synchronized (Gate 1)
Package 1 (post-release defects)            → dormant; no reproduced defect
Package 2 (Tasks)                           → NEXT; PLAN only
```

ACT V0 was a **pre-package visual correction**, not the first functional 1.0 package.
No Task, Wiki Links, Standalone, Projects or Reports package has begun.

---

## 1. Evidence-based current product state

Source owners inspected for this roadmap: `js/main.js`, `js/workspace/workspace-controller.js`,
`js/workspace/workspace-parser.js`, `js/workspace/workspace-scanner.js`,
`js/workspace/task-review.js`, `js/tasks/task-lifecycle.js`, `js/tasks/task-board.js`,
`js/links/wiki-links.js`, `js/report/`, `js/core/context.js`, `js/core/mode-session.js`,
`js/ui/view-layout.js`, `css/workspace.css`, `css/view-layout.css`, `index.html`,
`js/ui/help-content.js`, `js/ui/release-notes-content.js`, `js/release/release.js`, `sw.js`.

**Accepted and frozen**

- One canonical unit: the Markdown file. Saved Note parsing is owned by
  `js/workspace/workspace-parser.js`; both Current Document and the Workspace
  Index consume it, so the two scopes cannot drift.
- `WORKSPACE_STATE.files.notes` is the single physical collection; `journals` and
  `concepts` survive only as defensive read fallbacks.
- Sidebar projections (Notes, Knowledge, Pinned, Archive) are computed by
  `buildWorkspaceNotesViewModel()` in `js/main.js`. No second store, no file duplication.
- Navigation is path-based everywhere. `findWorkspaceFileByPath()` resolves by
  exact path; H1 is presentation only.
- The Workspace Index is rebuilt from disk and is the only authority for Sidebar
  rendering. The saved Index is never mutated by a metadata action.
- The single metadata writer is `applyActiveNoteMetadata()` / `patchNoteMetadata()`
  in `js/main.js`. It writes `knowledge`, `pinned`, `archived`; never `date`, never
  unmanaged keys.
- Archive is metadata-only. No `removeEntry()`, no move, no copy, no rename.
  **Archive/Restore is owned only by the Active panel action row** (ACT V0).
- `scripts/release-parity.cjs` enforces the single version identity across
  `js/release/release.js` and `sw.js`.

**Corrections applied by ACT V0 (accepted baseline)**

- The global Workspace action area is exactly **Open Workspace · Today · New Note**.
- The former global "Archive Active" control, its physical archive/ workflow and
  its second click lifecycle were removed; one owner remains.
- Sidebar badges no longer repeat their panel title; compound badges carrying a
  real state or a second metric were kept.
- One panel-title typography rule; Archive uses the shared sibling separator.
- Proof: `scripts/workspace-sidebar-visual-validators.cjs` (50 fixtures).

**Known transitional state (accepted, do not "fix" opportunistically)**

- The app context mode is still internally named `journal`; `getCurrentHelpContext()`
  in `js/ui/help.js` maps `activeKind === 'concepts'` to a `concept` help context.
- Internal IDs still contain `journals`/`concepts` (`workspaceJournalsPanel`,
  `btnNewConcept`, `workspaceConceptsList`). Deliberate aliasing, not
  user-facing wording.
- `renderSidebarFiles()` in the controller still writes badges from the retired
  `files.journals` / `files.concepts` counts. The Notes and Knowledge renderers
  overwrite those badges afterwards, so the visible result is correct, but the
  controller path is redundant. A Package 1 candidate, not a 0.6.2 change.
- Today and New Note remain two flat buttons; the dropdown is deferred.
- `buildArchiveFileName()`, `removeArchivedOriginalFile()` and
  `readActiveWorkspaceFileText()` in `js/workspace/workspace-controller.js` are
  unreferenced helpers left over from the removed physical archive workflow. They
  cannot execute. Removal is a Package 1 cleanup candidate.

---

## 2. Laptop acceptance checklist (0.6.2)

Reproduced from `VERIFY.md` §N3–N4. Required before any next-cycle package
begins. The migrated-copy counts describe **one** tested copy only and are not
general application requirements.

**A. Clean/incognito load**
- [ ] Application reports version `0.6.2`; no runtime loading error.
- [ ] A valid `notes/` Workspace opens.
- [ ] A legacy `journals/`+`concepts/` Workspace is rejected.
- [ ] Notes, Knowledge, Archive and Pinned render.

**B. Existing 0.6.1 PWA update path**
- [ ] Startup detects the new worker; Update Ready appears.
- [ ] Defer keeps 0.6.1 active; Accept activates 0.6.2; the app reloads.
- [ ] 0.6.2 Release Notes appears exactly once; the permanent button still works.
- [ ] A second normal reload does not reopen the same Release Notes.
- [ ] A persisted legacy last-active path (`concepts/CommScope.md`) is not
      inferred to be a Note, reopened, moved, or modified; `notes/` is not created
      inside that legacy Workspace without explicit selection and confirmation.

**C. Product smoke**
- [ ] Today · New Note · Save · Notes · Knowledge · Pin · Archive · Restore
- [ ] Back · Forward · Search · Wiki Links
- [ ] Task Review · Task Board · Projects · Quick Report · Draw.io entry

**D. Migrated Workspace copy**
- [ ] 62 Notes indexed; 59 active; 41 Knowledge; 3 archived.
- [ ] Knowledge Notes also appear in Notes.
- [ ] Archived Notes appear in neither active Notes nor Knowledge.
- [ ] **Archive collapses and expands repeatedly, survives an Index rebuild, and
      restores after Workspace reopen.** (the 0.6.2 open item)
- [ ] Back and Forward return `status=opened`.
- [ ] No file moved, renamed or duplicated.

---

## 3. Defect intake format

Package 1 accepts only defects observed in real laptop use. A report must carry
all fields; anything missing returns as "not yet reproducible", never as a
speculative redesign.

```
Defect ID:            MME-####
Date / build:         <date> / 0.6.2 (+ commit if post-release)
Area:                 Tasks | Wiki Links | Sidebar | Reports | Projects |
                       Editor | PWA/Update | Workspace | Draw.io
Steps to reproduce:   numbered, from a known state
Expected:             <what should happen>
Actual:               <what happened>
Reproducible:         always | intermittent | once-only
Workspace state:      standalone | valid notes/ Workspace | migrated copy
Data:                 Note count, active/Knowledge/archived counts if Workspace
Attachments:          screenshot and/or console excerpt
Severity:             blocker | major | minor | cosmetic
Regression risk:      which accepted behaviour could a fix plausibly disturb?
```

Severity only orders the queue. It never authorises a redesign.

---

## 4-5. Package order and dependencies

The canonical order is the Gate 1 order. It is defined in the canonical architecture
(Section 11) and reproduced here only as a pointer.

```text
PACKAGE 0   0.6.2 published acceptance          -> COMPLETE
ACT V0      Sidebar visual correction           -> IMPLEMENTED (pre-package)
PACKAGE 1   Post-release defect stabilization   -> CONDITIONAL; currently dormant
PACKAGE 2   Task Review and Task Board          -> NEXT
            ACT 2A normalized contract + priority-source reconciliation
            ACT 2B Task Board priority selection
            ACT 2C optional, only on source evidence
PACKAGE 3   Wiki Links stabilization
            Links In / Links Out contract, ambiguity, relationship providers
PACKAGE 4   Standalone Notes and scope composition
PACKAGE 5   Projects data foundation
PACKAGE 6   Projects Expanded View and modal
PACKAGE 7   Quick Report Markdown
PACKAGE 8   Enriched Reports
PACKAGE 9   HTML and Draw.io workflow completion
PACKAGE 10  Final visual consistency
PACKAGE 11  1.0 integration and release closure
```

Packages 2 and 3 may run in either order. **Package 4 is an implementation package**,
not an analysis package: it classifies consumers and then implements the entry
composition. Packages 5 and 6 are strictly ordered. Packages 7, 8 and 9 are strictly
ordered because Reports must not invent Project lifecycle semantics.

Do not renumber historical ACTs inside older documents. This order applies only to
the current canonical architecture and this roadmap.

---

## 6. Source owners per package (verified against the checkout, Gate 1)

**Package 1 - Post-release defect stabilization**
- Owners: whatever a reproduced defect identifies. Known redundancy candidates: the
  `renderSidebarFiles()` badge path in `js/workspace/workspace-controller.js`, and
  the three dead archive helpers listed in Section 1.
- Non-touch: `js/workspace/workspace-parser.js`; `buildWorkspaceNotesViewModel()`;
  the metadata writer; `js/release/release.js`; `sw.js`.

**Package 2 - Task Review and Task Board stabilization**
- Owners: `js/tasks/task-lifecycle.js` (lifecycle + `priorityOf()`),
  `js/tasks/task-board.js` (Board, read-only priority filter),
  `js/workspace/task-review.js` (compact Sidebar owner),
  `parseMmeTaskMetadata()` / `parseMarkdownTasks()` in `js/main.js`, and the parser
  call site at `js/workspace/workspace-parser.js:778`.
- Non-touch: the Notes projection; the metadata writer; Notes storage;
  `js/release/release.js`; `sw.js`.
- **Owner risk found in Gate 1:** the task-parsing surface lives in `js/main.js`, not
  in the Workspace parser, which only *consumes* `parseMarkdownTasks`. Earlier
  revisions of this file described the parser as the task-parsing owner.
- **Owner risk found in Gate 1:** a priority *reader* already exists
  (`priorityOf()` - visible token first, `mme-task: priority=` fallback) while **no
  priority writer exists** and `js/workspace/workspace-parser.js` has no `priority`
  vocabulary at all. ACT 2A owns closing that gap.
- Detailed handoff: `docs/architecture/MarkmapEditor_1.0_PACKAGE_2_TASK_STABILIZATION_PLAN.md`.

**Package 3 - Wiki Links stabilization**
- Owners: `js/links/wiki-links.js` (`resolveTarget` is the resolution owner),
  link extraction in `js/workspace/workspace-parser.js` (`conceptLinks`), the Related
  renderer (`findBacklinksForConcept()`, `normalizeBacklinkConceptKey()` in
  `js/main.js`), the Active `linksOut` stat, and the canonical physical opener.
- Non-touch: the metadata writer; the Notes projection; link text during other
  packages; `js/release/release.js`; `sw.js`.
- **Gate 1 reading, not a proof:** Related and Links Out both derive from the same
  `conceptLinks` array in opposite directions. Package 3 must prove
  `Related == Links In` **before** any visible label change.

**Package 4 - Standalone Notes and scope composition**
- Owners: the Current Document scope owner in `js/main.js`
  (`getCurrentDocumentScope()`, `:1396`); the app-context owner
  (`js/core/context.js`); Mode Session (`js/core/mode-session.js`); the Sidebar
  host/composition owner; `js/workspace/workspace-host.js`; the virtual-view Return
  owner.
- Non-touch: the Notes projection; the metadata writer; `js/release/release.js`;
  `sw.js`.
- **One Sidebar, two entry points. Never two independent Sidebars.**
- **ACT order (accepted at Gate 4):** ACT 4A shared scope contract and Current
  Document snapshot; ACT 4B Open Note entry and Standalone Sidebar composition;
  ACT 4C transitions, recovery, History and integrated acceptance; ACT 4D
  conditional correction only.
- **Source-owner summary:** the Current Document snapshot and the physical
  Open Note path (`openSmart()`, `js/main.js:10299`) already exist, so 4A and 4B
  are alignment/composition work rather than construction; Sidebar availability
  is the genuine new work. `currentSaveHandle` stays the single file-handle and
  Save owner. Full detail in
  `docs/architecture/MarkmapEditor_1.0_PACKAGE_4_STANDALONE_SCOPE_PLAN.md`.
- **Entry decision:** the existing `btnOpen` (`index.html:54`) becomes
  **Open Note**; no second open control is added.
- **Release boundary: 0.6.4 — Standalone Notes and Scope Composition.**
- **Non-touch list:** final Active and Workspace Index disclosure cards
  (Package 10); Projects metadata, `mme-project` writer and Expanded View
  (Packages 5-6); Reports and Draw.io (Packages 7-9); broad `main.js` refactor
  (Package 9.5); Service Worker and cache identity; Help; Release Notes.

**Packages 5-6 - Projects**
- Owners: `js/workspace/workspace-parser.js` (`parseProjects`,
  `WORKSPACE_INDEX_STATE.projects`), the Projects Sidebar renderer in `js/main.js`,
  the Workspace Index Projects projection, `css/workspace.css`, `index.html`.
- Future `mme-project` writer owner: **does not exist yet.** `mme-project` has zero
  occurrences in `js/` at Gate 1. Package 5 creates it.
- Non-touch: the Notes projection; the metadata writer; `js/release/release.js`; `sw.js`.
- Subprojects remain deferred; no parent IDs, nested UI or rollups in 1.0.

**Packages 7-9 - Reports**
- Owners: `js/report/report-dictionary.js`, `quick-report-generator.js`,
  `report-panel.js`, `report-markdown-import.js`, `drawio-report-reconciler.js`,
  `drawio-report-panel.js`.
- Non-touch: the Notes projection; the metadata writer; **Project semantics** -
  Reports consumes Project fields, it does not define them; `sw.js` precache
  grouping except where a new module is genuinely added.
- Pipeline: source -> Quick Report -> Markdown Report -> user review -> HTML ->
  optional Draw.io reconciliation and generation.

**Package 10 - Final visual consistency**
- Owners: `css/workspace.css`, `css/view-layout.css`, `index.html`, panel renderers.
- Also owns the **pane-divider requirement** (canonical architecture Section 9A)
  unless a small local correction is proven earlier in the existing layout owner
  (`js/ui/view-layout.js`; splitters `#splitEditor` and `#splitHtml`).

## 8. Validator strategy

Every package keeps the established contract: focused Node validator suites
extracting the **real shipped owners** verbatim, never re-implementations.

- One new suite per package, untracked until green, then tracked.
- Each behavioural fix ships with a fixture that **fails against the pre-fix
  source**. Mutation-test the new fixtures and record the failure list; a
  fixture that passes against the broken code is worse than no fixture.
- A negative control is mandatory where a fixture could pass vacuously
  (`workspace-today-index-validators.cjs` N31 is the model).
- **Known harness brittleness — fix before P1.** Cross-package fixtures pin exact
  sibling counts by regex (for example `/52 passed, 0 failed/`). Adding one
  fixture to any suite therefore broke three other suites, twice in this cycle.
  Convert these to a `0 failed` assertion, or have them read an exit code.
  Do not simply update the pinned numbers again.
- Run the full chain after every package; report each suite individually, never
  only a total.
- `scripts/release-parity.cjs` runs at every package boundary.

---

## 9. Browser checkpoints

Each package requires: full static chain green, then the package's own device
check, then a regression pass of the A/B/C/D laptop checklist. P2 and P3 add
their own device checks. P4 is a document review, not a device check. P5 and P6
add Report-generation device checks (partial generation, unresolved placeholders,
Draw.io output) before acceptance.

No package is accepted on static validation alone.

---

## 10. Exit criteria per package

- **ACT V0** Complete. Sidebar separator, title weight, badge text and Archive action
  ownership corrected; mobile checkpoint accepted; `scripts/workspace-sidebar-visual-validators.cjs` green.
- **P1** Only runs if a defect is reproduced. Every logged defect fixed or explicitly
  deferred with a reason; no speculative change; full chain green.
- **P2** Task Review and Task Board are correct after real edits; exact source
  navigation returns `status=opened`; **one** canonical priority write representation
  exists and is proven by ACT 2A; ACT 2B selector agrees with Review and the priority
  filter after Save; no Task Board regression; no assignment field; no automatic
  priority ordering.
- **P3** Every Wiki Links ambiguity case has defined, tested behavior; `Related ==
  Links In` is **proved**; the label rename follows that proof; no link is rewritten
  and no rename is implemented.
- **P4** Every candidate consumer is classified with a source reason; the entry
  direction is implemented; the Workspace experience is preserved; **one** Sidebar.
- **P5** The `mme-project` managed model exists; a Project can be created
  standalone-first, appears in the Sidebar and feeds Report Mode; dates validate;
  status is explicit; archive works. The managed comment is stable across edits.
- **P6** Projects Expanded View is a virtual view with Return, source navigation and a
  controlled modal; no hidden database; no direct Index mutation.
- **P7** Quick Report generates, updates and reconciles; placeholders extract,
  normalize and survive partial generation.
- **P8** Enriched Reports consume Task and Project contracts without inventing them.
- **P9** Draw.io output remains valid and editable; HTML import and reconciliation
  complete.
- **P10** Cross-experience visual consistency accepted on mobile and laptop; the
  pane-divider requirement holds; no data contract changed.
- **P11** Help, docs, onboarding, Release Notes, version/cache, publication and PWA
  update all verified.

---

## 11. 1.0 boundary

**Candidate 1.0 closure**
- Stable Notes checkpoint with acceptance.
- Task Review and Task Board stabilization, including priority selection.
- Wiki Links stabilization with the Links In / Links Out contract.
- Useful standalone / Current Document composition.
- Projects foundation and Projects Expanded View.
- Quick Report Markdown, Enriched Reports, and completed HTML / Draw.io workflow.
- Accepted final visual consistency package.

**Remain deferred past 1.0**
- Subprojects and Project hierarchy.
- Rename File and automatic Wiki Link rewriting.
- Monthly calendar.
- Extraction to Knowledge.
- Non-Markdown assets browser.
- Highlights and Reminders (including the alert subsystem).
- Shared `@` attribute layer.
- Autocomplete.
- People/assignment system.
- Mermaid / Graph.
- Reveal.js completion.
- Draw.io internal architecture redesign and embedded Draw.io editor.
- Milestones and Gantt.
- Major visual redesign.

---

## 12. 2.0 Idea Bucket

**Shared Highlights / Reminders model** — one future model, not two features:
- an undated reminder may function as a Highlight;
- a dated reminder participates in alerting;
- referencable text Highlights require a separate identity and reconciliation design
  before any implementation.

Both would reuse the shared summary-card grammar (canonical architecture Section 5A).

**Shared `@` layer and autocomplete** — planned together, opt-in, later
architecture, potentially 2.0. Neither ships ahead of the other.

None of these convert into implementation requirements. They are recorded so the
ideas are not lost, not so they can be started.

---

## 13. Mobile-first execution

Primary development and static validation occur on the cellphone. Validators,
mutation tests and source inspection follow every ACT. Browser checkpoints happen on
S22/DeX when the interaction is available there. Laptop testing is requested only at
checkpoints that genuinely require desktop-only keyboard behavior, wide layout, PWA
publication/update behavior, productive Workspace acceptance, or an interaction not
reproducible on mobile. Static validation quality is never reduced because
development happens on mobile.

---

## 14. No runtime implementation occurred in this synchronization

To be unambiguous: Gate 1 changed **documentation only**. No runtime file, no version,
no cache identity, no Service Worker, no Help and no Release Notes were modified. No
Task Review, Task Board priority, Wiki Links, Standalone, Projects or Reports work was
started. ACT 2A is not begun and requires explicit owner authorization.
