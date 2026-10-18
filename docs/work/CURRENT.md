# Current Work — MarkmapEditor Package 6

## Position

- **Released version:** 0.7.0
- **Target version:** 0.8.0
- **Branch:** main, HEAD = `66e3b7a` (3 ahead of origin/main, push pending)
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

Pending ACT 2 inspection — to be confirmed against live source.

## Confirmed Inconsistencies

Pending ACT 2 inspection — only source-proven inconsistencies will be listed.

## Authorized Implementation

Only the smallest selected corrections proven inconsistent and within current
owners.

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