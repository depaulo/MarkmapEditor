# MarmapEditorX3 — Navigation History V1

## Repository-Specific Design Contract & Implementation Specification

**Status:** PLAN / REVIEW  
**Implementation:** NOT AUTHORIZED YET  
**Target:** Journal Workspace navigation foundation  
**Scope:** Application-level Back / Forward for physical workspace documents only  
**Planning / reconciliation agent:** DeepSeek V4 Flash PLAN  
**Implementation agent:** Step 3.7 ACT

---

## 1. Purpose

Implement the first safe version of application-level document navigation history:

- **Back** returns to the previously opened physical workspace document.
- **Forward** returns to the next document after a Back operation.
- History represents user navigation order, not filesystem order.

Example:

```text
Journal A
→ Concept B
→ Journal C
→ Back = Concept B
→ Back = Journal A
→ Forward = Concept B
```

This V1 deliberately establishes and validates the navigation foundation before the virtual Workspace Index document is introduced.

---

## 2. V1 Scope

V1 includes:

1. One centralized navigation-history state owner.
2. Transactional Back / Forward behavior.
3. A canonical physical workspace location identity.
4. Duplicate-current-location prevention.
5. Dirty-document cancellation safety.
6. Forward-stack invalidation after successful normal navigation.
7. History clearing when a workspace is opened.
8. Startup-restored physical file seeding without a Back entry.
9. Visible Back / Forward controls in the Journal workspace sidebar.
10. Navigation inherited through the central physical workspace-open flow.
11. Browser and regression validation.

V1 does **not** include:

- virtual Workspace Index document;
- virtual locations;
- browser History API;
- persistent history across reloads;
- filesystem Previous / Next;
- keyboard shortcuts;
- cursor restoration;
- scroll restoration;
- graph or Mermaid views;
- Report Mode;
- changes to workspace scanning, parsing, tags, tasks or backlinks.

The later virtual Workspace Index package must reuse this V1 history system rather than create another one.

---

## 3. Repository Reality

The current repository has a predominant physical workspace-open function:

```text
openWorkspaceFile(file, kind, reason)
```

Its current responsibilities include:

1. validating the physical file and handle;
2. reading the file;
3. applying existing dirty-document confirmation;
4. opening the text through the current document lifecycle;
5. assigning `WORKSPACE_STATE.activeFile`;
6. persisting the active physical path;
7. updating sidebar highlight;
8. refreshing Active, Related and Tasks panels;
9. scheduling workspace-index rebuild;
10. returning the opened file or `null` when navigation is cancelled.

This is the preferred physical navigation integration boundary.

The repository also contains paths that must be classified during PLAN:

- `openWorkspaceSearchResultFile()` fallback;
- `reopenLastActiveWorkspaceFileIfPossible()`;
- `openToday()`;
- New Concept behavior;
- physical opens initiated by Wiki Links;
- Related items;
- Task Review;
- Tags;
- Search results;
- sidebar journal/concept lists.

Do not independently add history code to every UI surface if those surfaces already reach the same physical open path.

---

## 4. Architectural Principles

### 4.1 One history owner

Recommended new module:

```text
js/navigation/navigation-history.js
```

It owns:

- current physical navigation location;
- back stack;
- forward stack;
- location normalization and equality;
- Back / Forward transaction semantics;
- navigation-in-progress protection;
- subscriptions for UI state;
- `canBack` / `canForward` derivation.

It must not:

- read files;
- parse Markdown;
- access File System handles directly;
- rebuild the workspace index;
- render workspace panels;
- implement Wiki-Link-specific history;
- own Save or Save As.

### 4.2 One physical opener

Physical navigation must continue through the existing workspace-opening behavior.

Do not replace `openWorkspaceFile()`.

Do not create a second complete physical file loader.

### 4.3 Transactional history

History must commit only after successful navigation.

Unsafe:

```text
mutate stacks
→ attempt open
→ user cancels
→ stacks are corrupted
```

Required:

```text
peek target
→ attempt open
→ await result
→ commit stack movement only when opened
```

### 4.4 No source-specific histories

Wiki Links, Related, Tasks, Tags, Search, Today and sidebar clicks must not maintain independent stacks.

They should inherit history through the central coordinator / successful physical-open boundary.

---

## 5. Physical Navigation Location Contract

V1 supports only physical workspace files.

Recommended conceptual structure:

```javascript
{
  type: 'workspace-file',
  path: 'concepts/alibaba.md',
  kind: 'concepts',
  name: 'alibaba.md',
  source: 'wiki-link'
}
```

Required identity fields:

- `type`
- canonical `path`

Useful metadata:

- `kind`
- `name`
- `source`

V1 must not store a `FileSystemHandle` as the location identity.

The opener may resolve the current physical file record from the canonical path when restoring history.

Location equality:

```text
type + normalized canonical path
```

Normalize paths consistently with current workspace path behavior.

Opening the current location again must return a no-op and must not:

- add history;
- clear Forward;
- prompt dirty discard;
- cause a duplicate file open.

---

## 6. Navigation Modes

V1 must distinguish these modes:

### `normal`

Used for ordinary user navigation.

After successful open:

- previous current moves to Back;
- target becomes current;
- Forward clears.

If unsuccessful or cancelled:

- all history remains unchanged;
- Forward remains unchanged.

### `restore`

Used by Back and Forward.

- target opens through the physical opener;
- no normal history entry is generated;
- stack movement commits only after successful open.

### `seed`

Used after startup last-active-file restoration.

- establishes current location;
- creates no Back entry;
- leaves Forward empty.

A later package may add `refresh` for virtual documents. V1 may reserve the mode name but must not implement virtual refresh behavior.

---

## 7. Structured Navigation Result

Physical navigation integration must distinguish:

```javascript
{
  status: 'opened' | 'cancelled' | 'failed' | 'noop',
  location,
  error
}
```

Semantics:

- `opened`: target successfully became the current physical workspace document.
- `cancelled`: existing dirty confirmation was cancelled.
- `failed`: file resolution, handle access or open lifecycle failed.
- `noop`: target equals the current location.

Do not report a cancelled navigation as failure.

Do not commit history for `cancelled`, `failed`, or `noop`.

---

## 8. Recommended Public API

Exact names may be reconciled, but semantics must remain centralized.

```javascript
MME_NAVIGATION.back()
MME_NAVIGATION.forward()
MME_NAVIGATION.canBack()
MME_NAVIGATION.canForward()
MME_NAVIGATION.getCurrent()
MME_NAVIGATION.seed(location)
MME_NAVIGATION.clear()
MME_NAVIGATION.subscribe(listener)
MME_NAVIGATION.setOpener(openLocation)
MME_NAVIGATION.recordSuccessfulNavigation(location, options)
```

Avoid a public API that encourages callers to push a destination before it has opened successfully.

The module should expose read-only snapshots rather than direct mutable stack references.

---

## 9. Back Transaction

Required conceptual sequence:

```text
1. If navigation is in progress, do nothing.
2. If Back is empty, return noop.
3. Peek the Back target without removing it.
4. Capture the current location.
5. Attempt target open with mode=restore.
6. If opened:
   - remove target from Back;
   - push prior current into Forward;
   - set target as current;
   - notify subscribers.
7. If cancelled or failed:
   - preserve Back;
   - preserve Forward;
   - preserve current;
   - notify only if UI in-progress state changed.
8. Clear in-progress state in finally.
```

Forward performs the inverse.

---

## 10. Concurrency Contract

While Back or Forward is opening a target:

- Back and Forward controls are disabled;
- a second navigation-history request must not start another transition;
- stack state must not partially commit;
- the in-progress guard must clear in `finally`.

V1 may ignore repeated requests while one history transition is active.

It does not need to implement a queue.

---

## 11. Dirty Document Contract

The current dirty-confirmation behavior remains authoritative.

Back / Forward must not introduce another independent confirmation prompt.

Required behavior:

```text
dirty physical document
→ press Back
→ existing confirmation appears
→ Cancel
→ document unchanged
→ Back unchanged
→ Forward unchanged
→ current location unchanged
```

Normal navigation after a Back must clear Forward only after the new target opens successfully.

If the open is cancelled, Forward must remain available.

---

## 12. Workspace Lifecycle

### Successful workspace open

On successful workspace open:

```text
MME_NAVIGATION.clear()
```

This prevents stale paths or handles from a prior workspace from being restored.

### Last-active-file restoration

If the repository restores a last active physical file:

```text
successful restoration
→ MME_NAVIGATION.seed(restoredLocation)
```

No Back entry is created.

### No restored file

History remains empty until the first successful normal physical navigation.

Do not derive cross-workspace identity only from workspace display name.

---

## 13. Navigation Sources Required in V1

V1 acceptance must cover successful navigation from:

- journal sidebar list;
- concept sidebar list;
- Today;
- New Concept, if it opens a physical concept through the current lifecycle;
- Wiki Links;
- Related / Backlinks;
- Task Review source navigation;
- Tags;
- Search results.

Implementation rule:

- prefer one central integration;
- inspect exceptions;
- do not patch every source blindly;
- preserve existing `reason` strings where useful for diagnostics.

Startup restoration is `seed`, not `normal`.

---

## 14. UI Contract

Add visible Journal workspace controls:

```text
← Back    → Forward
```

Requirements:

- Back disabled when `canBack()` is false;
- Forward disabled when `canForward()` is false;
- both disabled while history navigation is in progress;
- states update immediately after successful commit;
- states remain correct after cancel/failure;
- labels/tooltips clearly identify document navigation;
- controls must not look like editor Undo / Redo;
- compact enough for mobile and Samsung DeX sidebar use;
- idempotent wiring: no duplicate listeners after repeated workspace setup.

Keyboard shortcuts are not included in V1.

---

## 15. Recommended File Ownership

### New

```text
js/navigation/navigation-history.js
```

Substantive history state and transaction semantics.

### Likely modified

```text
js/main.js
js/workspace/workspace-controller.js
js/workspace/workspace-sidebar.js
js/app/script-loader.js
css/workspace.css
sw.js
```

Only after source verification.

### `js/main.js`

Allowed only for narrow hooks such as:

- successful physical-open history integration;
- exposing a structured physical navigation opener;
- preserving existing dirty/open/panel behavior.

Do not place stacks or full history logic in `main.js`.

### `workspace-controller.js`

Possible narrow responsibilities:

- clearing history after successful workspace selection;
- seeding after successful last-active restoration;
- wiring navigation controls;
- classifying Today / New Concept only when required.

### `workspace-sidebar.js`

Possible UI responsibilities:

- render Back / Forward controls;
- update disabled state;
- bind click actions.

Do not put stack logic there.

### `script-loader.js`

Modify only after determining whether the new navigation module is a classic script, IIFE, or ES module and confirming current dependency order.

### `sw.js`

Modify only if the current service worker explicitly caches runtime JavaScript files.

If required:

- add the new path;
- bump the current app/cache version;
- validate activation and stale-cache replacement.

### Protected unless source proves necessity

```text
js/links/wiki-links.js
js/workspace/workspace-open.js
js/workspace/task-review.js
js/workspace/workspace-parser.js
js/editor/codemirror-bootstrap.js
```

Wiki Links and Task Review should inherit history centrally.

---

## 16. Diagnostic PLAN Before ACT

The planning agent must verify the current checkout before implementation.

### D1 — Repository safety

Verify:

```text
git branch --show-current
git status --short
git diff --stat
git diff --check
git diff --name-only
```

Identify all pre-existing changes and preserve them.

### D2 — Workflow documents

Read:

```text
docs/AI_DEVELOPMENT_ENVIRONMENT.md
docs/AI_DEVELOPMENT_WORKFLOW.md
```

Apply native Termux rules and PLAN → review → ACT.

### D3 — Authoritative physical opener

Inspect:

- `openWorkspaceFile()`;
- return value on success;
- return value on dirty cancellation;
- throw/failure behavior;
- caller expectations;
- panel/index side effects.

### D4 — Duplicate / fallback openers

Inspect:

- `openWorkspaceSearchResultFile()`;
- last-active restoration;
- Today;
- New Concept;
- sidebar click handler;
- Wiki Links;
- Related;
- Task Review;
- Tags;
- Search.

Classify each as:

- reaches canonical opener;
- startup seed path;
- duplicate fallback;
- physical create-and-open path;
- unrelated non-workspace open.

### D5 — History integration boundary

Prove the narrowest integration that covers normal physical navigation without instrumenting every source.

### D6 — Workspace lifecycle

Identify:

- successful workspace-open commit point;
- last-active restoration success point;
- correct `clear()` and `seed()` calls.

### D7 — Module loading

Inspect actual script/module style and loading order.

### D8 — Service worker

Inspect current shell/cache policy before deciding whether `sw.js` changes.

---

## 17. Hard Stop Conditions

Return to PLAN if:

1. authoritative physical-open ownership cannot be determined;
2. history requires replacing `openWorkspaceFile()`;
3. dirty cancellation cannot remain transactional;
4. successful/failure/cancel results cannot be distinguished through narrow hooks;
5. substantial `main.js` restructuring becomes necessary;
6. Wiki Links require architectural redesign;
7. Task Review requires architectural redesign;
8. implementation requires persistent history;
9. implementation requires storing stale `FileSystemHandle` objects as history identity;
10. the Related-panel stabilization is not complete or the branch contains an unresolved regression;
11. protected files become necessary without source-proven reason.

---

## 18. History Acceptance Tests

### H1 — Basic Back

```text
Open Journal A
Open Concept B
Open Journal C
Press Back
```

Expected:

```text
Concept B
```

### H2 — Second Back

Expected:

```text
Journal A
```

### H3 — Forward

Expected:

```text
Concept B
```

### H4 — Forward invalidation

```text
From Concept B, open Concept D normally
```

Expected after D successfully opens:

```text
Forward disabled
```

### H5 — Duplicate current

Open the currently active file again.

Expected:

- no history duplicate;
- no Forward clearing;
- no discard prompt;
- no unnecessary reopen.

### H6 — Dirty Back cancellation

```text
dirty current document
→ Back
→ Cancel
```

Expected:

- current document unchanged;
- current location unchanged;
- Back unchanged;
- Forward unchanged.

### H7 — Wiki Link origin

Navigate through a Wiki Link, then press Back.

Expected:

- return to originating physical document;
- no Wiki-Link-specific history behavior.

### H8 — Other navigation sources

Navigate through Tasks, Tags, Related and Search, then press Back.

Expected:

- return to originating physical document;
- one entry per successful physical navigation.

### H9 — Workspace switch

Open Workspace A, navigate, then open Workspace B.

Expected:

- Workspace A history cleared;
- Back cannot reopen Workspace A.

### H10 — Startup restoration

Restore the last active physical file.

Expected:

- restored file becomes current;
- Back remains disabled until a new normal navigation.

### H11 — Rapid double Back

Expected:

- one deterministic transition;
- no duplicate open;
- no stack corruption;
- controls disabled during transition.

### H12 — Deleted or unavailable target

Expected:

- current document unchanged;
- stacks unchanged;
- clear error;
- navigation remains usable.

### H13 — Failed normal navigation after Back

```text
A → B → C
Back to B
attempt D
D fails or is cancelled
```

Expected:

- Forward to C remains available.

### H14 — Today

Expected:

- successful Today open recorded once;
- failure/cancel creates no entry.

### H15 — New Concept

Expected:

- successful physical concept open recorded once;
- creation/open does not create duplicate entries.

### H16 — Repeated setup

Expected:

- Back/Forward controls have one listener each;
- one click creates one navigation.

---

## 19. Regression Tests

Must verify in browser:

- app boot;
- CodeMirror boot;
- editor Wiki Link decoration;
- editor Wiki Link navigation;
- no `startSide` error;
- HTML Wiki Links;
- Markmap rendering;
- physical Open;
- Save;
- Save As;
- dirty confirmation;
- Today;
- New Concept;
- sidebar journal/concept navigation;
- Search;
- Related;
- Tags;
- Task Review;
- Complete / Reopen;
- task priority controls;
- active physical-file highlight;
- workspace-index refresh;
- last-active physical restoration;
- workspace switching;
- Archive Active;
- no duplicate listeners;
- no uncaught errors;
- no unhandled rejections;
- PWA fresh reload/cache behavior when affected.

Browser behavior must not be marked passed from static inspection alone.

---

## 20. Diff Discipline

Before ACT completion:

```text
git status --short
git diff --check
git diff --stat
git diff
```

Requirements:

- inspect the complete final diff;
- preserve unrelated existing work;
- no broad formatting;
- no complete-file rewrites;
- no automatic dependency installation;
- no commit;
- no push;
- no service-worker bump unless required by actual cache policy.

---

## 21. Required PLAN Handoff

The planning/reconciliation agent must produce:

```text
NAVIGATION HISTORY V1 PLAN HANDOFF

Repository:
- branch:
- changed files:
- pre-existing change ownership:
- workflow documents read:
- protected files:
- git diff status:

Physical navigation:
- authoritative opener:
- success return:
- cancellation return:
- failure behavior:
- activeFile commit point:
- persistence commit point:
- index rebuild side effect:

Navigation sources:
- sidebar:
- Today:
- New Concept:
- Wiki Links:
- Related:
- Tasks:
- Tags:
- Search:
- startup restoration:
- duplicate/fallback paths:

History contract:
- location shape:
- normalization:
- equality:
- current state:
- back state:
- forward state:
- normal mode:
- restore mode:
- seed mode:
- noop behavior:
- concurrency behavior:
- structured result:

Transactional behavior:
- Back attempt sequence:
- Forward attempt sequence:
- dirty cancellation:
- open failure:
- Forward invalidation:
- stack commit point:

Workspace lifecycle:
- history clear point:
- startup seed point:
- workspace-switch safety:

UI:
- control owner:
- markup owner:
- wiring owner:
- disabled-state owner:
- duplicate-listener prevention:
- mobile/DeX behavior:

Module and PWA loading:
- module style:
- loader order:
- service-worker impact:
- cache-version impact:

Final ACT scope:
- new files:
- modified files:
- exact allowed hooks:
- excluded files:

Validation:
- static checks:
- H1-H16:
- regression checks:
- browser tests:
- PWA tests:

Risks:
- risk:
  - mitigation:

ACT sequence:
1.
2.
3.
4.
5.
6.
7.
8.

PLAN STATUS:

Choose exactly one:

READY FOR REVIEW — NAVIGATION HISTORY V1 PLAN COMPLETE

RETURN TO ARCHITECTURE REVIEW — CANONICAL OPEN OR TRANSACTION SAFETY UNRESOLVED

PLAN BLOCKED — CURRENT REPOSITORY STATE CANNOT BE VERIFIED
```

After the handoff, stop.

Do not edit source.
Do not switch to ACT.

---

## 22. Future Phase Boundary

After Navigation History V1 passes browser validation and reaches a stable checkpoint, the next package may add:

```text
Virtual Workspace Index V1
```

That future package must reuse:

- the same NavigationLocation normalization;
- the same Back / Forward stacks;
- the same transactional opener contract;
- the same subscriptions;
- the same sidebar controls.

It may then add:

- `type: 'virtual-workspace-index'`;
- `mode: 'refresh'`;
- read-only current-document descriptor;
- Save / Save As blocking;
- virtual ↔ physical navigation;
- Open Index action;
- generated index content.

No second navigation system is permitted.

---

## 23. Success Condition

Navigation History V1 is successful when MarmapEditorX3 has:

- one centralized physical-document navigation history;
- transactional Back and Forward;
- no stack mutation on cancel or failure;
- no duplicate-current entries;
- correct Forward invalidation;
- clean workspace-switch behavior;
- startup seed behavior;
- visible and reliable sidebar controls;
- central inheritance by Wiki Links, Related, Tasks, Tags, Search and sidebar opens;
- no regression to physical editing, Save, Task Review, Related or Wiki Links;
- an architecture ready to accept the later virtual Workspace Index without redesigning history.
