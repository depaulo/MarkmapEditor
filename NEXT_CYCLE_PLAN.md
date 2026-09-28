# MarkmapEditor Next-Cycle Plan (post-0.6.2)

**Status: PLANNING DOCUMENT ONLY. No Stage B runtime implementation occurred.**

This document was produced by reading the current source owners. It changes no
runtime code, no version, no Help copy, no Release Notes, and no Service Worker.
It is the deliverable of next-cycle preparation, not authorization to begin.

The Notes architecture is frozen during laptop validation.

---

## 1. Evidence-based current product state

Source owners inspected: `js/main.js`, `js/workspace/workspace-controller.js`,
`js/workspace/workspace-parser.js`, `js/workspace/workspace-scanner.js`,
`js/links/wiki-links.js`, `js/tasks/`, `js/report/`, `js/ui/help-content.js`,
`js/ui/release-notes-content.js`, `js/release/release.js`, `sw.js`.

**Accepted and frozen**

- One canonical unit: the Markdown file. Saved Note parsing is owned by
  `js/workspace/workspace-parser.js`; both Current Document and the Workspace
  Index consume it, so the two scopes cannot drift.
- `WORKSPACE_STATE.files.notes` is the single physical collection; `journals` and
  `concepts` survive only as defensive read fallbacks.
- Sidebar projections (Notes, Knowledge, Pinned, Archive) are computed by
  `buildWorkspaceNotesViewModel()` in `js/main.js` and rendered into pre-existing
  Sidebar hosts. No second store, no file duplication.
- Navigation is path-based everywhere. `findWorkspaceFileByPath()` resolves by
  exact path; H1 is presentation only.
- The Workspace Index is rebuilt from disk and is the only authority for Sidebar
  rendering. The saved Index is never mutated by a metadata action.
- The single metadata writer is `patchNoteMetadata()` in `js/main.js`. It writes
  `knowledge`, `pinned`, `archived`; it never writes `date` and never writes
  unmanaged keys.
- Archive is metadata-only. No `removeEntry()`, no move, no copy, no rename.
- `scripts/release-parity.cjs` enforces the single version identity across
  `js/release/release.js` and `sw.js`.

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

## 4–5. Package order and dependencies

Priority order follows the settled sequence. Narrow adjustments require source
evidence and must be recorded in the commit message.

```
Package 1  Post-release stabilization        (no dependencies)
Package 2  Task Review stabilization          (needs P1 green + laptop pass)
Package 3  Wiki Links stabilization          (needs P1; independent of P2)
Package 4  Current Document consumer-fit     (analysis only; needs P1-P3 evidence)
Package 5  Projects foundation + Expanded    (needs P4 classification settled)
Package 6  Reports workflow                  (needs P5 Project semantics)
```

Packages 2 and 3 may run in either order. P4 is an **analysis** package: it
produces a classification, not UI. P5 and P6 are strictly ordered because
Reports must not invent Project lifecycle semantics.

---

## 6–7. Likely source owners and non-touch files per package

**Package 1 — Post-release stabilization**
- Owners: whatever the defect report identifies. Known redundancy candidate:
  the `renderSidebarFiles()` / badge path in `js/workspace/workspace-controller.js`.
- Non-touch: `js/workspace/workspace-parser.js`; `buildWorkspaceNotesViewModel()`
  and the projection logic in `js/main.js`; the metadata writer;
  `js/release/release.js`; `sw.js`.

**Package 2 — Task Review stabilization**
- Owners: `js/tasks/` (`task-review.js`, Task Board owner), the task parsing
  surface of `js/workspace/workspace-parser.js`, task wiring in `js/main.js`, and
  task metadata writes in `js/workspace/workspace-controller.js`.
- Non-touch: Notes projection and metadata writer; the parser's Note/Sidebar
  surface; `js/release/release.js`; `sw.js`.
- Scope: lifecycle metadata, opened/completed/reopened dates, exact source
  navigation, reconciliation after edits, Task Review display, Task Board
  preservation. Local-vs-Workspace data-source feasibility may be *assessed*.
  No priority field and no assignment system.

**Package 3 — Wiki Links stabilization**
- Owners: `js/links/wiki-links.js` (resolver), the related/backlink projection in
  `js/main.js`, and link extraction in `js/workspace/workspace-parser.js`.
- Non-touch: the metadata writer; the Notes projection; `js/release/release.js`;
  `sw.js`.
- Scope: filename target, saved H1 target, duplicate H1 ambiguity, duplicate
  basename ambiguity, missing targets, exact path identity, Related/backlinks,
  and behaviour under a future rename. **No Rename implementation.**

**Package 4 — Current Document consumer-fit (analysis only)**
- Owners: read-only inspection of `js/main.js`, `js/ui/`, `js/workspace/`.
- Non-touch: everything. No runtime edit is permitted in this package.
- Classify each experience as Current Document, Workspace, both, or not useful
  standalone: local Tasks, local Projects, outgoing Wiki Links, local Tags,
  Outline, virtual Projects view with Return, virtual Quick Report with Return,
  Task Board local feasibility, and panels that should stay Workspace-only.
- Proposed entry direction, to be validated not assumed:
  *Open Standalone Note* -> document-relevant tools only;
  *Open Workspace* -> document tools plus Workspace aggregation.
  **One Sidebar. Two entry points. Never two independent Sidebars.**

**Package 5 — Projects foundation and Expanded View**
- Owners: `js/main.js` (Projects renderers), the first-line Project declaration
  in `js/workspace/workspace-parser.js`, `css/workspace.css`, `index.html`.
- Non-touch: the Notes projection and its classifications; the metadata writer;
  `js/release/release.js`; `sw.js`.
- Preserve settled decisions: standalone-first; first line declares the Project;
  following lines stay ordinary Markdown; no legacy-field migration; optional
  metadata is recreated by hand through visual controls and persists in a managed
  `mme-project` comment; three levels (Workspace data -> lightweight Sidebar ->
  Expanded View/full mode); archive instead of delete; normalized quarter; parent
  Projects in primary views; subprojects compact and inline; Projects feed Report
  Mode.
- Start with the smallest fields that have clear consumers: `status`, normalized
  quarter, archived state, and the lifecycle dates Reports actually needs. Health,
  priority, owner and further dates are **candidates, not requirements**.

**Package 6 — Reports workflow**
- Owners: `js/report/` (`report-panel.js`, `quick-report-generator.js`,
  `drawio-report-reconciler.js`, `report-markdown-import.js`, `report-dictionary.js`).
- Non-touch: Notes projection; the metadata writer; Project semantics — Reports
  consumes Project fields, it does not define them; `sw.js` precache grouping
  except where a new module is genuinely added.
- Preserve: Markdown canonical; Quick Report first; HTML is presentation; Draw.io
  derived; placeholders require extraction, normalization, reconciliation; partial
  generation supported; report settings persisted; neutral styling.
- Enriched data to evaluate: Task opened/completed/reopened/aging; Project
  status/quarter/lifecycle dates — **only after P5 defines their semantics.**

---

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

- **P1** Every logged defect is fixed or explicitly deferred with a reason; no
  speculative change was made; full chain green; laptop checklist re-passed.
- **P2** Task Review and Task Board are correct after real edits; exact source
  navigation returns `status=opened`; no Task Board regression; no priority or
  assignment field introduced.
- **P3** Every Wiki Links ambiguity case has defined, tested behavior; Related
  stays consistent; no link is rewritten and no rename is implemented.
- **P4** Every listed experience is classified with a source reason; the entry
  direction is agreed; **no runtime diff**.
- **P5** A Project can be created standalone-first, appears in the Sidebar, opens
  in Expanded View, can be archived, and feeds Report Mode. The managed comment
  is stable across edits.
- **P6** Quick Report generates, updates, and reconciles; placeholders extract,
  normalize and survive partial generation; Draw.io output remains valid;
  Project data is consumed, never invented.

---

## 11. 1.0 boundary

**Candidate 1.0 closure**
- Stable Notes checkpoint with laptop acceptance.
- Task Review stabilization.
- Wiki Links stabilization.
- Useful standalone / Current Document composition.
- Projects foundation and initial Expanded View.
- Completed Markdown-first Reports workflow.
- Selected Task/Project enrichment required by Reports.

**Remain deferred past 1.0**
- Rename File and automatic Wiki Link rewriting.
- Monthly calendar.
- Extraction to Knowledge.
- Non-Markdown assets browser.
- Reminders.
- Referencable Highlights.
- Shared `@` attribute layer.
- Autocomplete.
- Mermaid / Graph.
- Reveal.js completion.
- Draw.io internal architecture redesign.
- Major visual redesign.
- Full people/assignment system.

---

## 12. 2.0 Idea Bucket

**Shared Highlights / Reminders model** — one future model, not two features:
- an undated reminder may function as a Highlight;
- a dated reminder participates in alerting;
- referencable text Highlights are an Idea Bucket item requiring an explicit
  identity and reconciliation design before any implementation.

**Shared `@` layer and autocomplete** — planned together, opt-in, later
architecture, potentially 2.0. Neither ships ahead of the other.

None of these convert into implementation requirements. They are recorded so the
ideas are not lost, not so they can be started.

---

## 13. No Stage B runtime implementation occurred

To be unambiguous: creating this document changed **no** runtime file. No version
was bumped. Help, Release Notes and the Service Worker were not modified for
future work. No Task Review, Wiki Links, standalone-piping, Projects or Reports
work was started. Every statement above about owners, boundaries and non-touch
files was read from the current source, and every validator count cited here was
observed in this cycle's runs.
