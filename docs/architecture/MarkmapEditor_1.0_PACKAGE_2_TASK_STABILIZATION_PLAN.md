# MarkmapEditor 1.0 — Package 2: Task Review and Task Board Stabilization PLAN

**Canonical architecture:** `docs/architecture/MarkmapEditor_1.0_PRODUCT_ARCHITECTURE_AND_IMPLEMENTATION_PROGRAM.md`
**Roadmap:** `NEXT_CYCLE_PLAN.md`
**Status:** PREPARATION ONLY. Neither ACT 2A nor ACT 2B is implemented, authorized or begun.
**Runtime implementation authorized by this document:** No

---

## 1. Package objectives

Package 2 makes the existing Task surface correct and internally consistent, and it
establishes the one canonical priority representation that ACT 2B then exposes in the
UI. It does not redesign Tasks and does not add a second Task model.

**Existing foundation that must be preserved, not replaced**

- the Markdown checkbox is the completion authority;
- lifecycle metadata lives in the task-local `mme-task` comment;
- lifecycle statuses are `backlog`, `todo`, `ongoing`, `done`;
- lifecycle dates include `opened`, `started` and `completed`;
- **Task Review** is the compact Sidebar owner;
- **Task Board** is the four-column virtual view;
- the **Workspace Index** is the saved Task read model;
- Save reconciliation remains conservative;
- there is **no stable Task ID** and **no second Task store**.

---

## 2. ACT 2A boundary — normalized contract and priority-source reconciliation

**In scope**

- reconcile the normalized Task record;
- prove Review/Board consistency for the same saved Index;
- stabilize lifecycle dates (`opened`, `started`, `completed`, reopen);
- prove conservative Save reconciliation;
- establish the scope-aware **pure** projection (Current Document vs Workspace);
- **identify one canonical physical priority representation**;
- return the exact ACT 2B owner and a mutation recommendation.

**Explicitly out of ACT 2A**

- any priority UI, selector, chip, dropdown or Board card control;
- any change to the Board column model or status transitions;
- Active summary cards;
- Workspace Index disclosures;
- Wiki Links naming;
- Standalone UI;
- Projects, Reports, pane layout;
- version or cache change.

### 2.1 The priority question ACT 2A must close

ACT 2A must decide the **single canonical write representation** for Task priority:

```text
(a) visible #pN syntax in the Task text
(b) priority inside the mme-task comment
(c) another source-proven representation
```

There must be exactly **one** canonical write representation. Two simultaneous
sources of truth are not acceptable.

**Source-reconciliation evidence gathered during Gate 1 (must be re-verified, not assumed):**

- `js/tasks/task-lifecycle.js` already contains a **reader**, `priorityOf()`, which the
  file describes as owning "the ONE priority-recognition grammar". Its documented
  precedence is **visible token first, `mme-task: priority=` as fallback**.
- `js/tasks/task-board.js` has a **read-only** priority *filter* and explicitly
  disclaims owning Task priority grammar.
- `js/workspace/workspace-parser.js` contains **no** `priority` vocabulary at all.
- `js/main.js` sets `priority: null` at parse time and defers resolution to
  `normalizeTask()`.

So: a reader for two candidate sources already exists, and **no writer exists**. That
asymmetry is the reason the decision belongs to ACT 2A, not ACT 2B.

**ACT 2A deliverable:** a written, fixture-backed statement of the canonical write
representation, plus a negative control proving the other representation is not
written by the Task package.

---

## 3. ACT 2B boundary — Task Board priority selection

**In scope**

- a compact **top-right priority selector** on each Task Board card;
- values `--`, `P1`, `P2`, `P3`;
- current priority visible without opening anything;
- touch-safe and keyboard-accessible;
- exactly one canonical source mutation (the one ACT 2A selected);
- no direct Index mutation;
- lifecycle metadata and the checkbox preserved;
- ordinary hashtags preserved (a `#tag` is not a priority);
- no status change;
- no automatic priority ordering;
- Board, Review and the priority filter agree **after Save**.

**Explicitly out of ACT 2B**

- a second priority representation;
- automatic sorting or reordering by priority;
- assignment / people fields;
- status editing from the priority control;
- any change outside the Task Board.

---

## 4. Source owners to inspect

| Area | Path | Note |
| --- | --- | --- |
| Task lifecycle + priority reader | `js/tasks/task-lifecycle.js` | `priorityOf()` and the `mme-task` metadata owner |
| Task Board | `js/tasks/task-board.js` | columns, cards, read-only priority filter |
| Task Review (Sidebar owner) | `js/workspace/task-review.js` | compact panel, filtering, badges |
| Task parsing | `js/main.js` | `parseMmeTaskMetadata()`, `parseMarkdownTasks()` |
| Parser consumption | `js/workspace/workspace-parser.js` | calls `parseMarkdownTasks()` (~line 778) |
| Save reconciliation | `js/main.js` / the current Save owner | must stay conservative |
| Active Task stats | `js/main.js` | `getWorkspaceActiveStats()` (Current Document projection) |
| Workspace Index Tasks | `js/main.js` + `WORKSPACE_INDEX_STATE` | saved Workspace projection |

**Known owner risk carried into ACT 2A:** the task-parsing surface lives in
`js/main.js`, not in the Workspace parser. Earlier planning documents described the
parser as the task-parsing owner. Verify the real boundary before editing.

---

## 5. Non-touch list

- `js/workspace/workspace-parser.js` Note / Project / tag vocabulary;
- `buildWorkspaceNotesViewModel()` and the Notes/Knowledge/Pinned/Archive projections;
- `applyActiveNoteMetadata()` / `patchNoteMetadata()` — the single metadata writer;
- Notes storage and the `notes/` format;
- `js/links/wiki-links.js`;
- `js/report/**`;
- `js/ui/view-layout.js`, `css/view-layout.css`, `index.html` pane structure;
- `js/release/release.js`, `sw.js` — no version or cache change in an intermediate ACT;
- `js/ui/help-content.js`, `js/ui/release-notes-content.js`.

---

## 6. Static validators

Run at every ACT boundary:

- `node --check` on every touched JS/CJS file;
- `scripts/workspace-task-consumers-validators.cjs`;
- `scripts/workspace-index-notes-validators.cjs`;
- `scripts/workspace-lifecycle-output-validators.cjs`;
- `scripts/current-document-scope-validators.cjs`;
- `scripts/workspace-sidebar-visual-validators.cjs` (ACT V0 regression guard);
- `scripts/workspace-today-index-validators.cjs`;
- the full current regression chain, reported suite by suite;
- `git diff --check`, `git status --short`, `git diff --stat`, `git diff --name-only`.

**Fixture policy:** each new behavioural fixture must **fail against the pre-fix
source**. Mutation-test it and record the failure list. Prefer executing the real
shipped owners over source-regex assertions, as
`scripts/workspace-sidebar-visual-validators.cjs` does.

`scripts/release-parity.cjs` runs at the package boundary, not during intermediate ACTs.

---

## 7. Cell-first checkpoints

Perform on S22/DeX:

1. open Task Review; toggle a checkbox; confirm the lifecycle owner reacts;
2. open Task Board; confirm the four columns and card navigation;
3. ACT 2A: edit `opened` / `completed` dates and confirm conservative Save behavior;
4. ACT 2A: confirm Review and Board agree for the same saved Index;
5. ACT 2B: read the current priority from a card without opening it;
6. ACT 2B: set `P1`, `P2`, `P3` and `--` with a finger;
7. ACT 2B: confirm the ordinary hashtag case is untouched;
8. ACT 2B: Save, then confirm Board, Review and the priority filter agree;
9. confirm the document is dirty before Save and clean after;
10. confirm no physical file was moved, renamed or duplicated.

---

## 8. Laptop checkpoint triggers

Request laptop testing only when a checkpoint requires:

- desktop-only keyboard behavior (Tab order, Enter/Space on the selector, Escape);
- wide layout or multi-column Board layout;
- PWA publication or update behavior (package closure only);
- productive Workspace acceptance;
- an interaction not reproducible on mobile.

Static validation quality is **not** reduced because development is mobile-first.

---

## 9. Package exit criteria

- ACT 2A proves one canonical physical priority representation, with a negative
  control against the other candidate;
- Review and Board are consistent for the same saved Index;
- lifecycle dates are stable across open / start / complete / reopen and survive
  conservative Save;
- the Current Document and Workspace projections are pure and reuse one owner;
- ACT 2B exposes the selector with `--`, `P1`, `P2`, `P3`, mutating exactly one
  source, preserving checkbox, `mme-task` metadata and ordinary hashtags;
- no status change, no automatic priority ordering, no direct Index mutation;
- Board, Review and the priority filter agree after Save;
- the full regression chain is green and reported suite by suite;
- no version or cache change during intermediate ACTs.

---

## 10. Closure requirements

Package 2 does **not** close in its intermediate ACTs. Closure is a separate
authorized step that performs: Help update, documentation update, Release Notes,
**one** version/cache update, commit, and PWA update validation.

---

## 11. Out of Package 2 entirely

- expandable Active cards;
- Workspace Index disclosures;
- Wiki Links / Links In / Links Out naming;
- Standalone UI;
- Projects;
- Reports;
- pane layout;
- release closure during intermediate ACTs.

---

## 12. Authorization

**STOP after this PLAN.** ACT 2A requires explicit owner authorization before any
runtime change is made. Do not begin ACT 2A automatically.