# MarkmapEditor — Expanded-View Behavior and Visual Consistency Package Plan

**Status:** PLAN-only. No runtime implementation authorized by this document.
**Package:** Next package after Package 5 (0.7.0 release).
**Prerequisite:** Package 5 closure and 0.7.0 release must be complete before
this package is authorized.

---

## 1. Product objective

Make MarkmapEditor easier for new users to understand without turning it into a
generic note-taking, block-editing or database application.

Preserve the product direction:

- Markdown is the source.
- Markmap is the structure.
- Current Document is the focus.
- File Knowledge explains the active document.
- Workspace Knowledge connects the Workspace.
- Derived views make source files actionable.

---

## 2. Sidebar behavioral model

Formalize three layers.

### CURRENT DOCUMENT

Owns:

- active document identity;
- title;
- Workspace-relative path where relevant;
- Edit/Read representation control;
- source access;
- Quick Actions;
- compact/expanded state.

The essential identity and Edit/Read control should not disappear completely.

Current Document may later support a focused single-file experience when
expanded, without reviving a separate Standalone architecture.

### FILE KNOWLEDGE

Contains document-scoped cards:

- Open Tasks;
- Done Tasks;
- Links In;
- Links Out;
- Projects;
- future Reminders;
- future Highlights.

File Knowledge is not a general search surface.

Selecting a card exposes a source-scoped list.
Selecting an item navigates to the exact source location when available.

Only one contextual list should need to expand at a time.

### WORKSPACE KNOWLEDGE

Contains:

- Workspace Search;
- Notes;
- Knowledge;
- Archive;
- Tasks;
- Projects;
- Tags;
- Workspace Index;
- future Reminders;
- future Highlights.

Workspace Search remains exclusively Workspace-scoped.

Do not place Workspace Search inside File Knowledge.

---

## 3. Search ownership

Document:

- CodeMirror Find searches active Markdown source;
- Markmap search handles headings/structure;
- Workspace Search searches indexed Workspace content;
- Read/HTML search remains an open design question.

Do not assume the first Edit/Read implementation requires a dedicated Read
search.

---

## 4. Document Surface

Formalize:

Document Surface
- Edit;
- Read.

Edit uses the existing CodeMirror owner.

Read uses the existing synchronized HTML renderer.

Edit and Read are representations of the same active source.

Switching must not:

- Save;
- reopen the source;
- rebuild the Workspace Index;
- change active source;
- discard drafts;
- clear undo/redo.

Preserve independently:

- Editor cursor;
- Editor selection;
- Editor scroll;
- Read scroll;
- dirty state;
- writable handle;
- Sidebar context;
- Markmap zoom/pan.

---

## 5. Structure Surface

Markmap remains first-class.

Markmap must not become a hidden secondary plugin-like feature.

Reassess:

- Document + Markmap;
- Full Editor;
- Full Read;
- Full Markmap;
- advanced multi-panel desktop layouts.

The current four-panel possibility may remain available, but it should not
automatically define the primary user experience.

---

## 6. Surface controls

Classify:

- global application controls;
- shared document controls;
- Edit-specific controls;
- Read-specific controls;
- Markmap-specific controls;
- expanded-view controls.

Reassess:

- top-bar density;
- duplicate commands;
- overlay controls;
- controls shown in irrelevant modes;
- return/escape paths from focused surfaces.

Do not implement these changes during 0.7.0 closure.

---

## 7. Expanded-view consistency

Compare:

- Task Review;
- Task Board;
- Projects;
- Workspace Index;
- current Reports;
- Notes/Knowledge navigation.

Formalize shared behavior for:

- headers;
- Back/Workspace actions;
- source navigation;
- full-view entry and exit;
- route restoration;
- viewport preservation;
- filter preservation;
- search preservation;
- pending drafts;
- loading states;
- empty states;
- failure states;
- responsive behavior.

Do not force identical domain models.

Tasks remain Tasks.
Projects remain Projects.
Reports remain generation-oriented documents.
Notes remain files.

---

## 8. Product differentiation non-goal

The consistency Package must not make MarkmapEditor imitate a generic market
application.

Preserve:

- canonical Markdown ownership;
- physical-file transparency;
- Markmap as first-class structure;
- exact derived-view-to-source navigation;
- Current Document and Workspace as separate but connected scopes;
- local/offline operation;
- domain-specific Tasks, Projects and Reports;
- no required proprietary database.

Familiar interactions may be adopted to reduce learning cost.

Product identity must remain source-grounded.

---

## 9. Implementation boundary (PLAN-only)

This document does NOT authorize:

- consistency implementation;
- generic expanded-view framework;
- full WYSIWYG/Live Preview;
- Standalone resurrection;
- Reminders implementation;
- Highlights implementation;
- Reports implementation;
- Draw.io redesign.

The next Package must begin with a source-proven comparison before production
convergence work.