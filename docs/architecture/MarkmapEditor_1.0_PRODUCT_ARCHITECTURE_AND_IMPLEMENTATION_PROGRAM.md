# MarkmapEditor 1.0 Product Architecture and Implementation Program

**Canonical path:** `docs/architecture/MarkmapEditor_1.0_PRODUCT_ARCHITECTURE_AND_IMPLEMENTATION_PROGRAM.md`
**Status:** Canonical planning document for the post-0.6.2 program
**Baseline:** MarkmapEditor 0.6.2, Notes Workspace Foundation
**Authority:** PLAN first. Each implementation package requires its own source-proven PLAN, explicit ACT authorization, static validation, browser acceptance, and release closure.
**Runtime implementation authorized by this document:** No
**Synchronization:** Gate 1 — architecture synchronization, source reconciliation and implementation handoffs. This document was synchronized from the closed product decisions of Gate 1. No runtime file was changed by that Gate.

---

## 1. Purpose

This document defines the coordinated path from the accepted 0.6.2 foundation to MarkmapEditor 1.0.

It does not replace subsystem-specific architecture documents. It establishes the cross-feature product contract, package order, dependencies, boundaries, and acceptance model for:

- Notes and Workspace;
- Standalone Notes;
- Tasks;
- Wiki Links;
- Projects;
- Reports;
- final visual consistency;
- 1.0 release closure.

The implementation must remain incremental. Tasks, Projects, Reports, and Standalone Notes must not be implemented as one large ACT.

---

## 2. Source-Proven Baseline

The program is based on the current repository owners and accepted documentation, including:

- `NEXT_CYCLE_PLAN.md`;
- `STATUS.md`;
- `VERIFY.md`;
- `docs/WORKSPACE_FORMAT.md`;
- `docs/AI_DEVELOPMENT_WORKFLOW.md`;
- `docs/architecture/MarkmapEditor_Notes_Knowledge_Workspace_1_0_PLAN.md` — current Notes/Knowledge Workspace architecture;
- `docs/architecture/MarkmapEditor_Task_Lifecycle_ARCHITECTURE.md` — current Task Lifecycle architecture;
- `docs/architecture/MarkmapEditor_Projects_Discovery_MVP_PLAN.md` — current Projects Discovery architecture;
- `docs/architecture/MarkmapEditor_Quick_Report_and_task_Metadata_MVP_PLAN.md` — current Quick Report and Task Metadata architecture;
- `docs/architecture/MarkmapEditor_Drawio_Report_MVP_ARCHITECTURE.md` — current Draw.io Report architecture;
- `docs/architecture/MarkmapEditor_Screen_Layout_ARCHITECTURE.md` — current Screen Layout architecture;
- `docs/architecture/MarkmpaEditorX3_Navigation_History_V1_PLAN.md` — current Navigation History architecture;
- the current source owners in `js/workspace/`, `js/tasks/`, `js/links/`, `js/report/`, `js/core/`, `js/main.js`, and `sw.js`.

> **Naming note (corrected during Gate 1).** Earlier revisions of this section cited
> `MarkmapEditor_Task_Lifecycle_Architecture.md` and
> `MarkmapEditor_Projects_Discovery_MVP_Architecture.md`. Neither path exists. The real
> files are the `*_ARCHITECTURE.md` and `*_MVP_PLAN.md` names listed above. Always
> verify a path against the checkout before citing it as an owner.

**Historical status of the other architecture documents.** Every file listed above
other than this one is a **historical subsystem record**. It remains valid evidence
for its own subsystem and must not be rewritten as though it were the current
execution document. Where this document and a subsystem record differ on a
cross-feature question, this document governs.

Repository facts that constrain this program:

- Markdown remains canonical.
- The current Workspace format is `workspace-root/notes/*.md`.
- Notes, Knowledge, Pinned, and Archive are projections over the same physical Notes.
- `WORKSPACE_INDEX_STATE` already aggregates files, Tasks, links, tags, and Projects.
- Current Document scope already parses the live editor buffer through the shared Workspace parser.
- Task lifecycle is owned by `MME_TASK_LIFECYCLE` and task-local `mme-task` comments.
- Task Review and Task Board already consume the shared Workspace read model.
- Projects are already discovered by the parser and aggregated into the Workspace Index.
- Quick Report, reviewed Markdown import, Draw.io reconciliation, and Report panel foundations already exist.
- Version 0.6.2 is published. Notes architecture is frozen except for defects proven by real use.

---

## 3. Product Principles

### 3.1 Markdown-first

The Markdown file is the canonical unit. Visual experiences may project, filter, aggregate, and safely edit Markdown, but must not create a competing hidden database.

### 3.2 Progressive opt-in

A workflow must work at its simplest level first. Optional Workspace aggregation, metadata enrichment, Reports, and future attribute layers may add value later without making the base workflow mandatory.

### 3.3 Standalone first where useful

A standalone Markdown file must remain a first-class experience. Workspace is an optional aggregation layer, not a prerequisite for editing or using document-local features.

### 3.4 One owner per responsibility

Do not add:

- a second Workspace scanner;
- a second Workspace Index;
- a second Task lifecycle owner;
- a parallel Project database;
- a Report source of truth outside Markdown;
- duplicate physical open, Save, or navigation paths.

### 3.5 Conservative mutation

When identity or reconciliation is ambiguous, do not write automatically. Preserve user content and report the ambiguity.

### 3.6 Small packages, stable checkpoints

Every package must end in a browser-tested checkpoint. Version, Service Worker, Help, Release Notes, and documentation are updated once, only after that package is accepted.

---

## 4. Accepted Notes and Workspace Contract

### 4.1 Physical layout

```text
workspace-root/
└── notes/
    └── *.md
```

### 4.2 Projections

- **Notes:** every active Note.
- **Knowledge:** active Notes with `knowledge: true`. Knowledge Notes remain visible in Notes.
- **Pinned:** active Notes with `pinned: true`, displayed once in the Pinned area.
- **Archive:** Notes with `archived: true`, excluded from active Notes, Knowledge, and Pinned.

Archive is reversible metadata. It never moves, copies, renames, or deletes a file.

### 4.3 Identity

- H1 is the primary saved visual title.
- Filename and exact path remain the physical identity.
- Duplicate H1 values are allowed.
- Navigation uses path, not title.

### 4.4 Scope

```text
Current Document
→ live editor buffer
→ one shared parser result
→ never persisted as a second store

Workspace
→ saved physical Notes
→ WORKSPACE_INDEX_STATE aggregation
```

Unsaved changes belong to Current Document scope. Workspace projections represent saved content until Save rebuilds the Index.

### 4.5 Freeze rule

The accepted Notes architecture must not be redesigned during the 1.0 program. Changes are limited to defects found through real use and narrowly scoped usability improvements assigned to an approved package.

### 4.6 ACT V0 — accepted pre-package visual correction

ACT V0 was a source-proven visual correction performed before Package 2. It is part
of the **accepted 1.0 baseline**, not a pending change:

- the global Workspace action area is exactly **Open Workspace · Today · New Note**;
- **Archive and Restore belong to the Active panel action row**, using the existing
  single metadata writer (`applyActiveNoteMetadata`). The former global
  "Archive Active" control, its physical archive/ copy-and-remove workflow and its
  second click lifecycle were removed, so Archive/Restore has exactly one owner;
- Sidebar panel badges no longer repeat their panel title (`0 related` → `0`,
  `<n> tags` → `<n>`); compound badges that carry a real state or a second metric
  (Active `Note`, Report `Config`, Workspace Index `62 files · 195 open`) were kept;
- panel title weight is owned by a single rule, and the Archive panel now uses the
  same generic sibling separator as every other Workspace panel.

ACT V0 changed presentation only. It did not change the parser, the metadata writer,
YAML format, Archive semantics, Notes storage, navigation, Task parsing, Wiki Links,
Projects data, Report behaviour or pane layout, and it did not change the version or
cache identity. Its proof suite is `scripts/workspace-sidebar-visual-validators.cjs`
(50 fixtures, including five mutation controls).

---

## 4A. Scope Composition Rule

Every consumer in the program must be assessed **individually** and classified as one of:

- **Current Document** — the live editor buffer;
- **Workspace** — saved physical Notes through `WORKSPACE_INDEX_STATE`;
- **Both** — meaningful in each scope, potentially with different content;
- **Workspace-only** — meaningless or misleading without aggregation.

Both scopes must reuse the same parser. A **second parser, second Workspace Index, or
second document store is not allowed.** A consumer that is "Both" reuses the same
owner in both scopes with different inputs; it does not acquire a second owner.

---

## 5. Application Entry and Standalone Notes

Standalone Notes are part of 1.0.

### 5.1 Target entry contract

```text
Open Standalone Note
→ open one Markdown file
→ document-relevant tools only

Open Workspace
→ open the Notes Workspace
→ document tools plus Workspace aggregation
```

The implementation must adapt existing owners. It must not create two independent applications or two independently maintained Sidebars.

### 5.2 Candidate Standalone tools

The consumer-fit package must evaluate and explicitly classify each feature as `Current Document`, `Workspace`, `Both`, or `Workspace-only`.

Likely useful in Standalone scope:

- Editor;
- Markmap;
- HTML Preview;
- Outline;
- local Tasks;
- local Projects;
- local tags;
- outgoing Wiki Links;
- document information and metrics;
- virtual local Projects view with Return;
- virtual Quick Report with Return, if the data and Save contract remain simple.

Likely Workspace-only:

- Notes, Knowledge, Pinned, and Archive aggregation;
- search across files;
- backlinks from other files;
- global tags inventory;
- All Tasks;
- All Projects;
- Workspace Report;
- Workspace migration and indexing controls.

### 5.3 Virtual-view contract

Projects and Reports may open as virtual views without replacing the physical file identity.

```text
Physical Markdown document
→ open virtual view
→ inspect or configure derived content
→ Return
→ restore the previous physical document and layout safely
```

Virtual views must preserve dirty-state protection, writable handle, Current Document identity, Navigation History, and Return behavior.

---

## 5A. Shared Interaction Grammar

**Product principle: learn one interaction → recognize and use the equivalent interaction elsewhere.**

The following surfaces must converge visually and behaviorally wherever they represent
equivalent information:

- Active;
- Workspace Index;
- Tags Sidebar;
- future document-local summaries;
- future Highlights and Reminders.

Sharing a grammar does **not** create another persistent store. Two surfaces may look
identical and still read different scopes.

### 5A.1 Shared summary-card contract

Target card contract:

- compact title;
- numeric count;
- small disclosure chevron;
- `aria-expanded` state;
- concise preview list;
- clickable navigation entries;
- optional **View All** action;
- consistent empty state;
- mouse, touch and keyboard support;
- **no domain editing inside the summary card.**

Scope difference:

- **Active** → the active Current Document and relationships involving that document;
- **Workspace Index** → saved Workspace aggregation.

### 5A.2 Active summary cards

Planned Active cards:

- **Open**;
- **Done**;
- **Links In**;
- **Links Out**;
- **Projects**.

Possible future post-1.0 cards: **Highlights**, **Reminders**.

Active remains a **compact summary and navigation surface**. It does not replace Task
Review, Task Board, Projects Expanded View, the Wiki Links owner, the Tags Sidebar or
the Workspace Index.

Initial expanded lists should normally show **no more than three to five items**.
**View All delegates to the specialized owner** and never duplicates it.

> **Status: planned, not implemented.** No expandable Active card exists in the
> current source. `renderWorkspaceActivePanel()` in `js/main.js` renders a flat
> `workspaceActiveStats` grid only. No ACT has begun this work.

### 5A.3 Workspace Index parity

The Workspace Index may use the same disclosure and navigation grammar for Open Tasks,
Done Tasks, Links In, Links Out, Projects and Tags.

- Workspace Index uses **Workspace** scope.
- Active uses **Current Document** scope.

Identical list sizes or complete layouts are **not** required. Equivalent interaction
semantics are required.

> **Status: planned, not implemented.** The current Workspace Index uses static
> metric tiles and sections, not disclosure cards.

### 5A.4 Tags

Tags must use the same chip appearance and selection behavior in Active, the Tags
Sidebar and the Workspace Index.

Workspace behavior:

- an Active tag delegates to the existing Workspace Tags filtering owner;
- a Sidebar tag uses that same filter owner;
- a Workspace Index tag uses that same filter owner.

Standalone behavior:

- an Active tag operates only inside the Current Document;
- no cross-file result is implied without a Workspace.

> **Status: planned, not implemented.** ACT V0 established count-only Tags badges but
> did not add clickable Active tags or cross-surface parity.

### 5A.5 Relationship terminology

Adopt the symmetric convention:

- **Links In**;
- **Links Out**.

**Links In** replaces `Related` wherever Related currently means Notes linking *into*
the active Note. **Links Out** means Wiki Links *declared by* the current source.

**The rename is planned, not implemented.** Package 3 must first prove that the
current Related data is truly the backlink / Links In projection before any visible
label changes.

> **Source-reconciliation note (Gate 1).** Both projections currently derive from the
> same `parsed.conceptLinks` array: `findBacklinksForConcept()`
> (`js/main.js:2498`) selects *other* Notes whose `conceptLinks` include the active
> one, while the Active stat `linksOut` (`js/main.js:3811`) counts the active
> document's *own* `conceptLinks`. This is consistent with Links In / Links Out, but
> it is a reading, not a proof. Package 3 owns that proof.

---

## 6. Tasks Architecture for 1.0

### 6.1 Existing foundation

Tasks already use:

- Markdown checkbox state as the completion authority;
- task-local `<!-- mme-task: ... -->` metadata;
- lifecycle states `backlog`, `todo`, `ongoing`, and `done`;
- lifecycle dates such as `opened`, `started`, and `completed`;
- conservative Save reconciliation;
- Task Review;
- Task Board;
- exact source navigation.

### 6.2 1.0 stabilization scope

The Task package must stabilize:

- Task Review display and filtering;
- exact source navigation;
- Task Board and Review consistency;
- first-save `opened` behavior;
- completion and reopening reconciliation;
- duplicate visible Task text;
- line movement and reorder behavior;
- ambiguous matching without unsafe writes;
- lifecycle dates consumed by Reports;
- local Current Document feasibility without adding a second lifecycle model.

### 6.3 Required Package 2 sequence

```text
ACT 2A
→ normalized Task contract
→ Review/Board consistency
→ lifecycle-date stabilization
→ Current Document / Workspace pure projection
→ canonical priority-source reconciliation

ACT 2B
→ Task Board priority selection

ACT 2C
→ only if ACT 2A or ACT 2B proves a remaining focused Task correction
```

### 6.4 Task Board priority selection

**Accepted 1.0 requirement, subject to ACT 2A proving the canonical physical
representation.**

Each Task Board card may receive a compact **top-right priority selector**:

```text
--      no priority
P1
P2
P3
```

Requirements:

- current priority visible without opening anything;
- touch-safe;
- keyboard-accessible;
- **no status change**;
- **no automatic priority ordering**;
- **no direct Index mutation**;
- exact Task source patched conservatively;
- checkbox and lifecycle metadata preserved;
- Save and the Index rebuild remain authoritative;
- Board, Review and the priority filter agree **after Save**.

**ACT 2A must decide the single canonical write representation** — visible `#pN`
syntax, priority inside `mme-task`, or another source-proven representation. There
must be **one** canonical write representation. Do not specify two simultaneous
sources of truth.

> **Source-reconciliation note (Gate 1).** A read-side priority grammar **already
> exists**: `priorityOf()` in `js/tasks/task-lifecycle.js` (around line 305) resolves
> priority as **visible token first, `mme-task: priority=` as fallback**, and that
> file states it owns "the ONE priority-recognition grammar". Separately,
> `js/tasks/task-board.js` has a read-only priority *filter* and explicitly
> disclaims owning priority grammar, and `js/workspace/workspace-parser.js` has no
> `priority` vocabulary at all. So a **reader** for two candidate sources already
> exists while no **writer** does. Assigning that decision to ACT 2A, not ACT 2B, is
> deliberate.

### 6.5 Active and Workspace Index Task dependency

Future Active summary cards (§5A.2) depend on Package 2's normalized Task projection:

```text
Active Open / Done              → Current Document Tasks
Workspace Index Open / Done     → saved Workspace Tasks
```

The summary cards **navigate only**. Task status and priority management remain in the
document, Task Review or Task Board.

### 6.6 Explicit exclusions

Do not add before 1.0 unless a later accepted package proves the need:

- stable Task UUIDs;
- person assignment system;
- **automatic priority ordering**;
- file grouping mode;
- history column;
- complex dependencies;
- subtasks;
- configurable workflow columns.

> **Correction applied during Gate 1.** An earlier revision of this section listed
> "priority editing from the Board" as an exclusion. That directly contradicted the
> accepted 1.0 requirement. It has been removed: **ACT 2B owns Task Board priority
> selection.** Only *automatic priority ordering* remains excluded.

---

## 7. Wiki Links Architecture for 1.0

The stabilization package must cover:

- exact filename target resolution;
- saved H1 target resolution;
- duplicate basename ambiguity;
- duplicate H1 ambiguity;
- missing targets;
- exact path identity;
- Workspace backlinks and Related;
- Current Document outgoing links;
- safe source navigation through the canonical opener;
- preservation of links during all 1.0 packages.

Rename File and automatic Wiki Link rewriting remain deferred. The 1.0 work may document requirements needed by a future rename workflow but must not implement it.

### 7.1 Mandatory pre-rename proof

Package 3 must **explicitly prove** that:

```text
Related  ==  Links In (backlinks)
```

before any visible terminology changes. The label rename is gated on that proof, not
scheduled beside it.

### 7.2 Target future behavior

Active:

```text
Links In   → source Notes linking to the active Note
Links Out  → links declared in the active document
```

Workspace Index:

```text
Links In   → aggregated inbound relationships
Links Out  → aggregated outbound relationships
```

Resolved, missing and ambiguous states remain controlled by the **Wiki Links owner**
(`js/links/wiki-links.js`, `resolveTarget`). Do not re-implement resolution, ambiguity
reporting or missing-target handling in a consumer.

**Do not implement Rename File. Do not implement automatic Wiki Link rewriting.**

---

## 8. Projects Architecture for 1.0

### 8.1 Product model

Projects remain Markdown-first and standalone-capable.

Minimal declaration:

```md
Project: Project name
```

The first declaration identifies the Project. Subsequent lines remain ordinary Markdown content. Optional metadata is enriched through visual controls and persisted in a managed `mme-project` comment, following the same conservative principles used by `mme-task`.

Legacy Project fields do not require migration. New optional metadata may be recreated manually through the Expanded View.

### 8.2 Three-level architecture

```text
Level 1
Shared parser + Current Document/Workspace read model

Level 2
Lightweight Projects projection in the Sidebar or document tools

Level 3
Virtual Projects Expanded View with modal editing
```

No `projects/` folder and no second Project store are introduced.

### 8.3 Required Project metadata for 1.0

The initial managed Project model must support:

- **status**;
- **created date**;
- **PO date**;
- **delivery date**;
- **completed date**;
- **normalized quarter**;
- **archived state**.

Suggested canonical managed keys, subject to source reconciliation during the Project PLAN:

```text
status
created
po
 delivery
completed
quarter
archived
```

The PLAN must validate final key names against existing parser vocabulary and avoid conflicting aliases. The accidental leading space shown before `delivery` is not part of the key; the final key must be `delivery`.

### 8.4 Date semantics

All Project dates use local calendar ISO format:

```text
YYYY-MM-DD
```

Definitions:

- `created`: date the Project record is intentionally created or first enriched;
- `po`: date the purchase order is received or confirmed;
- `delivery`: planned or confirmed delivery date, with the exact semantic finalized in the Project PLAN and reflected in the UI label;
- `completed`: date the Project is completed.

The PLAN must decide whether `delivery` means planned delivery or actual delivery. Do not support both meanings under one field. If the product later needs both, add a separate candidate field in a later package.

No mass backfill is required. Missing dates remain unknown.

### 8.5 Status ownership

Status is an explicit user selection. Dates do not silently change status.

The UI may provide non-blocking consistency guidance, for example:

```text
Status = Completed
Completed date is empty
```

or:

```text
Completed date exists
Status is not Completed
```

The user remains the decision owner. Automatic status transitions are deferred unless explicitly designed and accepted later.

The status vocabulary must be proposed by the Project PLAN after reconciling existing values and reporting needs. Do not invent an excessively detailed pipeline. Prefer a small, understandable set.

### 8.6 Expanded View and modal

The Expanded View must:

- operate as a virtual view with Return;
- show parent Project records from the selected scope;
- open the exact source Note;
- provide a modal or focused edit surface;
- use dropdowns or controlled inputs for structured fields;
- preserve normal Markdown content;
- write only the managed `mme-project` comment;
- validate dates without rewriting unrelated fields;
- archive instead of delete;
- refresh the appropriate Current Document or Workspace projection after successful Save.

The modal should use controlled fields for nearly all structured metadata. Free text should remain limited to fields that truly require it.

### 8.7 Subprojects

Subprojects are explicitly deferred to the Idea Bucket.

Do not implement:

- subproject parser semantics;
- parent IDs;
- nested Project UI;
- automatic hierarchy;
- subproject rollups;
- subproject reporting.

Future design must first decide whether subprojects are inline items, relationships, references, or independent Projects. The 1.0 model must not create compatibility obligations for an undecided hierarchy.

### 8.8 Additional candidates, not accepted requirements

Keep these as candidates until a consumer is proven:

- health;
- priority;
- owner;
- probability;
- budget/value redesign;
- actual delivery date separate from planned delivery;
- customer identity;
- Project-task synchronization;
- milestones.

---

## 9. Reports Architecture for 1.0

### 9.1 Canonical pipeline

```text
Current Document or Workspace read model
→ Quick Report configuration
→ Markdown Report
→ user review and editing
→ HTML presentation
→ optional Draw.io reconciliation and generation
```

Markdown remains canonical. HTML and Draw.io are derived outputs.

### 9.2 Task information available to Reports

Reports may use source-proven lifecycle data:

- Task opened date;
- Task started date;
- Task completed date;
- reopened/open state;
- effective status;
- calculated aging or duration where dates are valid;
- exact source Note and line.

Unknown historical dates remain unknown. Reports must not fabricate them.

### 9.3 Project information available to Reports

After the Project package defines the managed model, Reports may use:

- Project status;
- created date;
- PO date;
- delivery date;
- completed date;
- normalized quarter;
- archived state where explicitly included;
- source Note;
- existing value/currency fields only if retained by the source-proven Project model.

Reports must not invent Project lifecycle semantics. They consume the contract created by Projects.

### 9.4 Report workflow completion

The 1.0 Report packages must complete:

- useful Quick Report Markdown;
- Current Document versus Workspace scope selection where valuable;
- section configuration;
- reviewed Markdown import;
- placeholder extraction;
- normalization;
- reconciliation categories;
- insertion of missing fields into Markdown;
- partial generation where supported;
- persistence of appropriate user settings;
- neutral presentation styling;
- editable uncompressed `.drawio` generation through the accepted thin workflow.

### 9.5 Report boundaries

Do not make Draw.io canonical. Do not add an embedded Draw.io editor, template library, automatic AI field generation, complex grouping, or geometry rewriting as part of 1.0.

---

## 9A. Pane-Divider Visual Requirement

The number of **visible, functional** dividers must follow the visible panes:

| Visible panes | Visible dividers |
| --- | --- |
| Editor + Markmap + HTML | two |
| Editor + HTML | one |
| Editor + Markmap | one |
| Markmap + HTML | one |
| one visible pane | none |

**Hiding the middle Markmap pane must not leave two adjacent splitters or a visually
doubled line.** The two splitters must be re-associated with the panes that actually
remain visible, and the surviving divider must sit exactly where the boundary between
those two panes is.

The correction belongs to the **existing pane/layout owner**
(`js/ui/view-layout.js` plus the splitter markup in `index.html` and
`css/view-layout.css`). It must not be solved by adding a decorative element, and it
must not introduce a second layout owner.

**Routing:**

- if later source inspection proves the defect is a small local correction in the
  existing owner, it may be handled **before** the final visual package;
- otherwise it belongs to **Package 10**.

**Not implemented in this Gate.** This is a recorded, accepted requirement.

> **Source-reconciliation note (Gate 1).** The current markup contains exactly two
> splitters — `#splitEditor` (`index.html:750`) and `#splitHtml` (`index.html:776`).
> Whether hiding Markmap currently produces a doubled or orphaned divider has **not**
> been reproduced in a browser in this Gate. The requirement is recorded as accepted
> behavior to be proven or corrected in the owning package, not as a diagnosed defect.

---

## 10. Final Visual Consistency Package

Package 10 remains **one constrained final visual ACT, or a small group of tightly
related ACTs.** It runs after Standalone Notes, Tasks, Projects and Reports are
functionally accepted. It is a consistency and usability pass, **not an open redesign.**

It may align:

- the Open Standalone Note / Open Workspace entry;
- Active disclosures;
- Workspace Index disclosures;
- shared tag behavior;
- Links In / Links Out labels;
- the Projects card;
- chevrons and preview lists;
- panel hierarchy;
- empty states;
- dropdown consistency;
- modal consistency;
- touch targets;
- keyboard focus;
- virtual-view Return controls;
- mobile / DeX / laptop layout;
- dark mode;
- dynamic pane dividers (§9A).

It **must not** alter:

- parser contracts;
- lifecycle ownership;
- Project metadata semantics;
- the Report pipeline;
- Save ownership;
- Workspace storage;
- Navigation History.

---

## 11. Implementation Packages and Order

### Package 0: Published 0.6.2 acceptance — COMPLETE

Exit:

```text
RELEASE 0.6.2 FULLY ACCEPTED
NOTES ARCHITECTURE FROZEN
```

### Pre-Package ACT V0: Sidebar visual correction — IMPLEMENTED

Scope: Sidebar hierarchy, badge consistency and Archive action ownership. Presentation
only. See §4.6. Part of the accepted 1.0 baseline. Mobile checkpoint accepted.

### Package 1: Post-release defect stabilization — CONDITIONAL

Only when **reproduced** defects exist during real use. No speculative redesign.

**Current state: no blocking defect package is required.** Package 1 stays dormant
unless a defect report satisfies the intake format in `NEXT_CYCLE_PLAN.md` §3.

### Package 2: Task Review and Task Board stabilization

- **ACT 2A** — normalized contract and priority-source reconciliation;
- **ACT 2B** — Task Board priority selection;
- **ACT 2C** — optional, only if source evidence requires it.

This is the **first new functional package of 1.0**. See §6.3–§6.5.

### Package 3: Wiki Links stabilization

Stabilize resolution, ambiguity, missing targets, Related/backlinks, and exact source navigation.

### Package 4: Standalone Notes and scope composition

Classify consumers, implement the application entry choice, adapt existing UI composition, and connect only useful Current Document consumers.

### Package 5: Projects data foundation

Implement the accepted managed model, date/status semantics, parser/index normalization, archive rule, and Current Document/Workspace provider contract.

### Package 6: Projects Expanded View

Implement virtual view, Return, modal/dropdowns, safe metadata editing, source navigation, filtering, and browser acceptance.

### Package 7: Quick Report Markdown

Complete useful Markdown generation using the accepted Task and Project contracts.

### Package 8: Enriched Reports

Add Task lifecycle and Project date/status information, scope behavior, report sections, and saved preferences where approved.

### Package 9: HTML and Draw.io workflow completion

Complete reviewed Markdown import, placeholder reconciliation, missing-field workflow, partial generation, persistence, and editable output.

### Package 10: Final Visual Consistency ACT

Perform the constrained cross-experience visual review defined in Section 10.

### Package 11: 1.0 integration and release closure

Complete Help, documentation, onboarding, validators, browser acceptance, release notes, version/cache update, commit, publication, and PWA update validation.

---

## 12. Standard PLAN and ACT Lifecycle

Each package must begin with a source-proven PLAN containing:

1. starting branch, HEAD, working tree, and protected changes;
2. current behavior and reproduced problem;
3. authoritative source owners;
4. product contract;
5. data contract;
6. exact implementation sequence;
7. likely files;
8. non-touch files;
9. validators and mutation tests;
10. browser checkpoints;
11. risks and mitigations;
12. exit criteria;
13. deferred candidates;
14. closure requirements.

Recommended ACT structure:

```text
ACT A
pure data/parser/owner contract

Static validation

ACT B
shared plumbing and consumers

Static validation

ACT C
UI or virtual-view integration

Browser checkpoint

ACT D
edge cases and reconciliation

Full regression

Browser acceptance

CLOSURE
Help + docs + Release Notes + one version/cache update
```

The exact number of ACTs is decided by each PLAN. Do not combine unrelated concerns merely to reduce the ACT count.

---

## 13. Cross-Package Non-Touch Rules

Unless the package PLAN explicitly proves a required change, do not modify:

- Notes storage format;
- physical Workspace migration behavior;
- canonical file Save ownership;
- Navigation History transaction contract;
- Service Worker lifecycle during intermediate ACTs;
- unrelated app contexts;
- Markmap engine loading;
- HTML Preview ownership;
- Draw.io geometry and template source files;
- user Workspace content;
- historical architecture documents as if they were current implementation handoffs.

Do not bump the version or cache identity during unaccepted experiments.

---

## 14. Validation Strategy

Each package must include:

- `node --check` on every touched JS/CJS file;
- focused owner validators;
- source-owner wiring validators;
- regression suites for consumers;
- mutation tests for the reproduced defect or new contract where practical;
- `git diff --check`;
- suite-by-suite reporting;
- meaningful browser checkpoints;
- PWA/update testing only at package closure.

Validator harnesses should prefer:

```text
exit code = 0
failed = 0
expected owner marker present
```

Avoid brittle cross-package assertions that pin exact sibling-suite pass counts unless the exact count protects against silent fixture removal.

### 14.1 Mobile-first development policy

This is the current execution constraint of the program:

- **primary development and static validation occur on the cellphone**;
- after each ACT, use validators, mutation tests and source inspection;
- browser checkpoints should be performed on **S22/DeX** when the interaction is
  available there;
- laptop testing is requested **only at meaningful checkpoints** that require:
  - desktop-only keyboard behavior;
  - wide layout;
  - PWA publication / update behavior;
  - productive Workspace acceptance;
  - an interaction not reproducible on mobile.

Do not require laptop testing after every static package. **Do not reduce static
validation quality because development occurs on mobile.**

---

## 15. Definition of MarkmapEditor 1.0

Version 1.0 is ready when:

- Notes Workspace is stable in productive use;
- standalone Markdown files remain first-class;
- the app offers a clear Open Standalone Note/Open Workspace path;
- useful document-local consumers work without requiring Workspace;
- Task Review and Task Board are stable and lifecycle dates are reliable;
- Wiki Links resolve conservatively and explain ambiguity;
- Projects use the simple Markdown declaration plus optional managed metadata;
- Projects support explicit status, created date, PO date, delivery date, completed date, quarter, and archive;
- Projects Expanded View safely edits managed metadata;
- Reports produce useful canonical Markdown from Task and Project information;
- HTML presentation remains reliable;
- the accepted thin Draw.io workflow is complete and reproducible;
- the final visual consistency ACT is accepted on mobile and laptop;
- Help and documentation match the product;
- the complete validator chain is green;
- PWA update and Release Notes behavior pass;
- the 1.0 release is published and browser-accepted.

---

## 16. Deferred 2.0 and Idea Bucket

The following remain outside the 1.0 implementation program:

- subprojects and Project hierarchy;
- Highlights as stable referencable text fragments;
- Reminders and alert subsystem;
- shared `@` attribute layer;
- autocomplete;
- people/assignment system;
- Rename File and automatic Wiki Link rewriting;
- monthly calendar;
- automatic extraction to Knowledge;
- non-Markdown asset browser;
- Mermaid or Graph View;
- Reveal.js completion;
- Draw.io internal architecture redesign;
- embedded Draw.io editor;
- complex Project/task synchronization;
- milestones and Gantt;
- major visual redesign.

Future Highlights and Reminders should be evaluated as one model:

```text
Undated reminder
→ possible Highlight

Dated reminder
→ alerting/reminder behavior
```

Referencable Highlights require a separate identity and reconciliation design. The shared `@` layer and autocomplete should be planned together with that future subsystem, not added incrementally during 1.0.

---

## 17. Closed Decisions

Do not reopen without blocking source evidence:

- Markdown is canonical.
- Workspace is optional aggregation.
- Standalone Notes belong in 1.0.
- Notes architecture is frozen after 0.6.2 acceptance.
- Knowledge remains a projection within Notes.
- Archive is metadata, not deletion.
- Tasks retain checkbox-authoritative completion and `mme-task` metadata.
- Projects remain standalone-first and file-based.
- Project status is explicitly selected, not silently derived from dates.
- Required Project dates are created, PO, delivery, and completed.
- Project metadata uses a managed comment model.
- Subprojects are deferred.
- Reports keep Markdown canonical.
- Draw.io remains derived.
- A final visual consistency ACT is reserved before 1.0 closure.
- Highlights, Reminders, `@`, autocomplete, Mermaid, Graph, Reveal.js, and Rename remain post-1.0.

### 17.1 Decisions closed during Gate 1

- Every consumer is classified individually as Current Document, Workspace, Both or
  Workspace-only (§4A). One parser, one Workspace Index, one document store.
- The entry direction is **Open Standalone Note → document tools only** and
  **Open Workspace → document tools plus aggregation**. Never two applications,
  never two independently maintained Sidebars.
- Surfaces representing equivalent information share one interaction grammar
  (§5A): compact title, count, chevron, `aria-expanded`, preview list, View All
  delegation, consistent empty state, mouse/touch/keyboard, no domain editing in
  the card.
- Active stays a compact summary and navigation surface. It does not replace Task
  Review, Task Board, Projects Expanded View, the Wiki Links owner, the Tags
  Sidebar or the Workspace Index.
- Initial expanded lists show at most about three to five items; View All
  delegates.
- Tags converge on one chip appearance and one selection behavior; in Workspace
  scope all three surfaces delegate to the same Tags filter owner.
- The symmetric relationship convention is **Links In / Links Out**. The rename is
  **gated on a Package 3 proof** that Related is the backlinks projection.
- **Task Board priority selection is an accepted 1.0 requirement owned by ACT 2B**;
  ACT 2A owns the single canonical priority write representation.
- Visible divider count follows visible pane count; hiding Markmap must not leave
  two adjacent splitters or a doubled line (§9A).
- Primary development and static validation occur on the cellphone; laptop testing
  is checkpoint-driven, not per-package (§14.1).

---

## 18. Decisions Required During Package PLANs

These are not blockers for this architecture document. They must be closed in the relevant source-proven PLAN:

### Projects

- final small status vocabulary;
- whether `delivery` means planned or actual delivery;
- final `mme-project` serialization grammar;
- creation-date initialization boundary;
- whether quarter is independent or derived from one selected date;
- exact behavior when status/date fields are inconsistent;
- Current Document mutation and Save flow from the Expanded View.

### Standalone

- exact tools shown by default;
- whether a local Task Board adds enough value;
- whether local Quick Report is included in the first Standalone package or after Workspace Reports stabilize;
- how the existing Sidebar is composed when no Workspace is active.

### Reports

- default 1.0 report sections;
- which Project date filters are useful;
- which user preferences are persisted;
- whether Current Document Report and Workspace Report share one panel with a scope selector or use contextual entry points.

### Final visual ACT

- exact visual changes based on the accepted end-to-end product;
- no visual decision may alter underlying data contracts.

---

## 19. Next Official Handoff

Package 1 is dormant (§11) because no reproduced blocking defect exists. The next
authorized package is therefore **Package 2**.

```text
MARKMAPEDITOR 1.0 PROGRAM
PACKAGE 2: TASK REVIEW AND TASK BOARD STABILIZATION
MODE: PLAN ONLY

Read:
- MarkmapEditor_1.0_PRODUCT_ARCHITECTURE_AND_IMPLEMENTATION_PROGRAM.md
- docs/architecture/MarkmapEditor_1.0_PACKAGE_2_TASK_STABILIZATION_PLAN.md
- NEXT_CYCLE_PLAN.md
- VERIFY.md
- STATUS.md
- docs/architecture/MarkmapEditor_Task_Lifecycle_ARCHITECTURE.md

Inspect the current repository source owners listed in the Package 2 PLAN.

Do not implement speculative improvements.
Do not redesign Notes.
Do not begin ACT 2A automatically: the owner advances to it explicitly.

Return:
- starting state;
- ACT 2A source reconciliation;
- canonical priority write representation and its evidence;
- exact owners;
- non-touch list;
- validators;
- browser checkpoints;
- exit criteria.

STOP after PLAN.
```

**Do not create detailed handoffs for Packages 3–11 in advance.** Each is created only
when that package becomes current.

---

## 20. Program Status

```text
0.6.2 release
→ closed and published

ACT V0 (Sidebar visual correction)
→ implemented, mobile checkpoint accepted, part of the accepted baseline

Published acceptance
→ completed for 0.6.2

1.0 architecture
→ defined and synchronized by this document

1.0 runtime implementation
→ not started (Package 2 is next, PLAN only)

Next authorization
→ one package PLAN at a time
```
