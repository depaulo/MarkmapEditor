# Current Work — MarkmapEditor Package 6

## Position

- **Released version:** 0.7.0
- **Target version:** 0.8.0
- **Branch:** main, HEAD = `fbe08a5` (ACT 1 closure docs; 4 ahead of origin/main, push pending)
- **Working tree:** clean except untracked artifact `re` (do not touch)
- **Package 5:** CLOSED (owner laptop acceptance 2026-10-16)
- **Package 6:** Expanded-View Behavior and Visual Consistency — ACT 1 CLOSED, ACT 2 active

## Package 6 ACT 1 Closure

Status: accepted

Implemented:

- Projects Source control;
- All Sources default;
- exact sourcePath identity;
- duplicate-basename display disambiguation;
- Source and Search/filter composition;
- view-only filtering;
- same-session in-memory state;
- reset after browser refresh;
- no persistent Web Storage.

Owner browser evidence (http://localhost:8000/, 0.7.0, Workspace Mme-test-new, 8 Projects):

- source selection passed;
- close and reopen preservation passed;
- refresh reset passed;
- Projects return-to-workspace passed;
- no unexpected Save or mutation observed.

Static evidence:

- Projects view 534/534;
- Projects contract 434/434;
- Projects consumers 163/163;
- save integration 103/103;
- device-oriented static validation 74/74;
- mutation-anchor audit passed.

Non-blocking observation:

- Source-label observation verified.
  The label is derived from the source path/display-name owner and exact
  sourcePath filtering remains correct.
  No ACT 1 correction required.

## ACT 2 Objective

Define and implement the narrow shared Expanded View behavioral contract for
Projects and Workspace Index, with Task Board preserved as an overlay
exception.

## Source-Proven Owners

- Projects view: `js/workspace/projects-view.js` — Return row with
  `aria-label`, `escapeAttr`/`escapeHtml` discipline, scroll-owner grammar
  (`data-projects-scroll-owner` + clamp restore), ACT 5D presentation model.
- Workspace Index full view: `js/workspace/workspace-index-workspace.js` —
  Return button builder, `activate`/`deactivate`/`refresh`/`rerenderProjectionWithAnchor`
  rebuilds; `#workspaceIndexView` is its own scroll owner
  (`css/workspace.css`, `overflow-y: auto`).
- Workspace Index projection: `js/workspace/workspace-index-document.js` —
  Projects section already distinguishes empty ("No Projects found.") vs
  filtered-empty ("No Projects match the current filters.") — CONSISTENT
  with the Projects view, out of slice.
- Task Board: `js/tasks/task-board.js` — modal overlay, Close + Escape;
  protected exception, no lifecycle change.

## Confirmed Inconsistencies (slice 1, full evidence in docs/packages/P6-CONSISTENCY.md)

- A2-1: Workspace Index Return label escaping was a NO-OP
  (`replace(/</g, '<')`); markup-bearing fileNames injected raw HTML.
- A2-2: Workspace Index Return control had no `aria-label` (Projects has one).
- A2-3: project-filter rerenders called `rerenderProjectionWithAnchor()`
  without an anchor → scroll reset to top (comment claimed anchoring).
- A2-4: close/reopen lost scroll — `deactivate` hid the container but
  `activate` rebuilt `innerHTML` from the top.

Recorded, NOT implemented (owner ruling / separate ACT): visible return-label
grammar (Q1), inspection-recovery asymmetry (B2), overlay exit grammar (E1),
filter persistence (F1), copy divergences (Q5), Escape semantics.

## Authorized Implementation — slice 1 (IMPLEMENTED, awaiting owner browser checkpoint)

`js/workspace/workspace-index-workspace.js` only:

- `escapeIndexLabel()` — real `&amp;/&lt;/&gt;/&quot;/&#39;` escaping on the
  Return label;
- Return button `aria-label="Return to <label>"` sharing the escaped label
  with the visible text (visible copy unchanged — Q1 untouched);
- module-local scroll preservation (`savedScrollTop` + `restoreScrollTop`
  with the Projects-style clamp grammar) across no-anchor rerenders,
  `refresh()`, and close/reopen (`deactivate` captures, `activate` restores
  while hidden — raw offset, browser clamps at paint).

Validation (2026-10-18):

- workspace-index task-filter 64/64 (new W01–W08); notes 58/58;
  project-view 534/534; contract 434/434; consumer 163/163;
  save-integration 103/103; device-acceptance 74/74;
  mutation-anchor audit 167/167; `git diff --check` clean.
- Tier M in disposable copy (removed after run): 13/13 behavioral controls
  bit, including new F11 (aria-label), F12 (escape no-op), F13 (scroll
  restore); byte-identical restores; baseline green after every restore.

Owner browser checkpoint PENDING: Index close/reopen scroll, project-filter
scroll stability, Return label/aria-label with a markup-bearing fileName.

## Protected Scope

- no Reports runtime changes;
- no Task Board lifecycle conversion;
- no full Sidebar redesign;
- no Current Document redesign;
- no generic Expanded View framework;
- no persistent filter storage;
- no 0.8.0 activation.

## Do not start

- Reports implementation (deferred, not canceled)
- Draw.io redesign, generic expanded-view framework, Tasks redesign, Sidebar
  redesign, Reminders, Highlights, Standalone resurrection