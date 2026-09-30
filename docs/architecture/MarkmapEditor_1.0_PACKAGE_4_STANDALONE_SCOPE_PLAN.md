# MarkmapEditor 1.0 — Package 4 Standalone Notes and Scope Composition

**Document status:** GATE 4 — source reconciliation, consumer classification,
transition contract and implementation handoffs.
**Nature:** documentation and planning only. No runtime implementation.
**Release baseline:** 0.6.3 published and verified.
**Expected release boundary after accepted Package 4:** `0.6.4` —
Standalone Notes and Scope Composition.

---

## 1. PACKAGE 4 MISSION

Prove and implement, through later ACTs, that MarkmapEditor works first as a
Markdown document experience and optionally as a Workspace aggregation.

Target entry direction:

```
Open Note     -> open one physical Markdown file
              -> live Current Document scope
              -> document-relevant tools
              -> no fabricated Workspace

Open Workspace -> open a valid Workspace root
              -> document tools
              -> saved Workspace aggregations
```

Target architecture:

```
one application
  -> one parser family
  -> one Current Document contract
  -> one Workspace Index contract
  -> context-sensitive composition
```

Package 4 must not produce separate application shells, a second Sidebar, a
second Markdown parser, Task grammar, Wiki Link grammar, Project parser, Save
implementation, file opener, Navigation History stack or Mode Session owner.

---

## 2. STARTING STATE (observed at Gate 4)

| Item | Value |
|---|---|
| branch | `development` |
| HEAD | `5af68fc` |
| `origin/development` | `5af68fc` |
| `origin/main` | `8cf5110` (not promoted) |
| working tree | clean (0 changes) |
| `productVersion` | `0.6.3` |
| `APP_VERSION` / cache identity | `markmap-journal-pwa-0.6.3-tasks-wiki-links-foundation` |
| 0.6.3 closure commit | `f1483c0` (Package 3 docs) |
| 0.6.3 release identity commit | `8cf5110` |
| published-verification doc commit | `5af68fc` |
| app contexts | `editor`, `journal`, `slides` |
| app-context storage | `markmap:appContext` (`js/core/context.js:7`) |
| default context | `editor` (`js/core/context.js:239`) |
| existing Open control | `btnOpen` in `index.html:54` -> `openSmart()` |
| physical opener | `openSmart()` `js/main.js:10299`; `showOpenFilePicker` guards `js/main.js:10210`, `10303` |
| Save handle owner | `currentSaveHandle` (single owner; `js/main.js:1336`, `1400`, `1396`) |
| dirty-state owner | module-level `dirty`, exposed `MME_APP.isDirty()` `js/main.js:5275` |
| Mode Session owner | `js/core/mode-session.js` |
| Navigation History owner | `js/navigation/navigation-history.js` |
| virtual-view owner | `js/render/render-controller.js` |
| Sidebar host | `index.html` Sidebar -> `.workspaceNavScroller` (`js/workspace/workspace-sidebar.js:77`) |
| Current Document API | `getCurrentDocumentScope()` `js/main.js:1396` |
| Workspace Index API | `getWorkspaceScope()` `js/main.js:1458` over `WORKSPACE_INDEX_STATE` |
| Workspace Note opener | `openWorkspaceFile()` `js/workspace/workspace-controller.js:1424` |
| recovery/persistence | autosave drafts + `MME_APP.resolveBeforeApplicationReload` `js/main.js:5275` |
| existing scope/session validators | `scripts/current-document-scope-validators.cjs` (41/0), `scripts/mode-session-validators.cjs` |
| Package 4 runtime | **not started** — no `standalone`, `openNote` or `scopeComposition` runtime identifiers exist |

## 3. MATERIAL SOURCE DIVERGENCES

Gate 4 was required to inspect actual owners rather than assume greenfield
work. Three divergences materially change the Package 4 shape. All three reduce
risk and must be carried into the ACT handoffs.

### D1 — The Current Document snapshot ALREADY EXISTS in substance

`getCurrentDocumentScope()` (`js/main.js:1396-1457`) already:

- reads the **live** `md.value` editor buffer;
- parses through the **shared** `parseWorkspaceDocument()` parser family;
- is wrapped in `try/catch` so a parse failure never corrupts either scope;
- reports `sourceFreshness: 'live'`;
- exposes `dirty`, `hasWritableHandle`, `handle`, `physicalName`;
- exposes `workspaceAvailable`, `belongsToWorkspace`, `workspacePath`,
  `membershipReason` — Workspace availability is already explicit;
- keeps a standalone document's Workspace path **neutral/empty** so it can
  never be mistaken for a Workspace Note;
- separates Report identity (`documentCategory`, `isReport`, `reportPath`) from
  Note eligibility, with a 41/0 validator suite already passing.

**Consequence:** ACT 4A must NOT build a new large global snapshot object. The
instruction anticipated this ("Do not commit to a new large global object when
current owners can be composed") and the source confirms it. ACT 4A becomes
alignment + availability + validators, not construction.

### D2 — The physical Open Note path ALREADY EXISTS

`openSmart()` (`js/main.js:10299`) already invokes `showOpenFilePicker` with
`text/markdown` and `.md,.markdown,.txt`, stores a **writable** handle, and logs
`openSmart(): using showOpenFilePicker (writable)`. `isTopLevel()` and
`isSecureContext` are already guarded (`openPickerUsable()`,
`js/main.js:10210`), and a fallback path exists for non-FSA environments.

**Consequence:** "Open Note" is substantially a **relabel and compose** of an
existing proven control, not a new file opener. This satisfies "prefer the
smallest understandable UI" and "do not add multiple redundant open controls".

### D3 — There is no Workspace-only availability mechanism in the Sidebar

`js/workspace/workspace-sidebar.js` has no `workspaceOnly` /
`data-workspace-only` attribute and no per-panel availability registry. Panel
collapse exists (`workspacePanelCollapsed`, `js/main.js:2011`, `2049`) and
resize state is on `body` (`workspace-sidebar-resizing`, `js/main.js:1597`,
`1625`), but **panel availability is not a first-class concept.**

**Consequence:** the Sidebar composition registry required by §16 is genuine new
work and is correctly assigned to ACT 4B, not ACT 4A.

### D4 — No divergence risk

Working tree was clean, release identity intact, and no Package 4 runtime
identifiers exist. There are no unrelated runtime changes to report.

---

## 6. SOURCE-OWNER MAP

| Owner | File / API | Dependencies | Package 4 change | Validator | Risk |
|---|---|---|---|---|---|
| app context | `js/core/context.js` | `APP_CONTEXT_STORAGE_KEY` | none | context validators | low |
| Open Note entry | `js/main.js:10299` `openSmart()` | `showOpenFilePicker`, `currentSaveHandle` | relabel + dirty guard | new scope-composition | low |
| Open Workspace | `js/workspace/workspace-controller.js` | root handle, `notes/` detection | none | workspace validators | medium |
| Workspace Note opener | `openWorkspaceFile()` `...:1424` | `WORKSPACE_STATE.activeFile` | none | existing | medium |
| file handle | `currentSaveHandle` (single) | FSA handle | **must stay the one owner** | new no-second-handle | medium |
| Save / Save As | `js/main.js:10290-10297`, `savePickerUsable()` | handle, draft clear, rebuild | none | existing save validators | medium |
| dirty state | module `dirty`, `MME_APP.isDirty()` `:5275` | autosave drafts | none | new transition guard | medium |
| autosave draft | `clearDraft(currentFileName)` `:10291` | filename identity | none | existing | low |
| Current Document snapshot | `getCurrentDocumentScope()` `:1396` | live `md.value`, shared parser | **align fields + availability** | `current-document-scope-validators.cjs` (41/0) | low |
| Workspace Index | `getWorkspaceScope()` `:1458` | `WORKSPACE_INDEX_STATE` | none | existing | medium |
| Sidebar host | `index.html` + `workspace-sidebar.js:77` | collapse state | **availability registry (new)** | new sidebar-composition | medium |
| local Tags/Tasks/LinksOut/Projects | `js/main.js:1103`,`1110`,`1119`,`1124` | shared parser output | adapt to scope | new standalone-scope | low |
| Links In | `index.html:182-189` `workspaceRelatedPanel` | `WORKSPACE_INDEX_STATE` | hide when no Workspace | new unavailable-not-zero | medium |
| Search / Notes / Knowledge / Pinned / Archive | `workspace-sidebar.js` | Workspace Index | hide when no Workspace | new composition | medium |
| Task Review / Task Board | workspace surfaces | Workspace Index | hide; Option B | new composition | medium |
| Quick Report / Draw.io | `describeCurrentDocumentReportState()` | Report identity | hide in Standalone | new composition | low |

## 7. CONSUMER CLASSIFICATION MATRIX

Classification is source-proven from the owners above, not from desired UX.

| Consumer | Class | Current data source | Hidden dependency | Pkg4 scope | Availability w/o Workspace | Save behaviour | Navigation | ACT |
|---|---|---|---|---|---|---|---|---|
| Editor | **CURRENT DOCUMENT** | live `md.value` | none | required | available | n/a | n/a | 4A |
| Markmap | **CURRENT DOCUMENT** | live buffer -> shared parser | none | required | available | n/a | n/a | 4A |
| HTML Preview | **CURRENT DOCUMENT** | live buffer | none | required | available | n/a | n/a | 4A |
| Active document identity | **CURRENT DOCUMENT** | `physicalName` `:1405` | `currentSaveHandle` | required | available | n/a | n/a | 4A |
| saved H1 / title | **CURRENT DOCUMENT** | `parsed.title` `:2206` | none | required | available | n/a | n/a | 4A |
| filename / path identity | **CURRENT DOCUMENT** | `physicalName` + neutral path | membership | required | available | n/a | n/a | 4A |
| local Tags | **CURRENT DOCUMENT** | live `parsed.tags` `:1103` | shared parser | required | available | n/a | in-document | 4B |
| local Tasks | **CURRENT DOCUMENT** | live `parsed.tasks` `:1110` | Package 2 contract | required (Option B) | available | lifecycle -> physical Save | in-document | 4B |
| local Links Out | **CURRENT DOCUMENT** | live `parsed.conceptLinks` `:1119` | Package 3 grammar | required | **resolution not-ready** | n/a | no cross-file open | 4B |
| local Projects | **CURRENT DOCUMENT (compact)** | live `parsed.projects` `:1124` | none | deferred to 5–6 | count only | n/a | to declaration | 4B/5 |
| Outline / metrics | **DEFERRED** | `js/main.js:3773-3796` | none | deferred | available | n/a | n/a | — |
| Logs | **CURRENT DOCUMENT** | runtime log | none | required | available | n/a | n/a | 4B |
| Help | **CURRENT DOCUMENT** | static | none | required | available | n/a | n/a | 4B |
| Release Notes | **DEFERRED** | version-gated | release boundary | 0.6.4 | n/a | n/a | n/a | 4C |
| Workspace Tags inventory | **WORKSPACE** | `WORKSPACE_INDEX_STATE` | Workspace | preserved | **unavailable** | n/a | cross-file | 4B |
| Task Review | **WORKSPACE** | saved Index | Workspace | preserved / Option B | available (Option B) | mutation -> Save + rebuild | in-document | 4B |
| Task Board | **WORKSPACE** | saved Index | Workspace | preserved; local board deferred | **unavailable** | mutation -> Save + rebuild | in-document | 4B |
| Links In | **WORKSPACE** | `workspaceRelatedPanel` `index.html:182` | Workspace | preserved | **UNAVAILABLE (not zero)** | n/a | cross-file | 4B |
| Notes | **WORKSPACE** | Workspace Index | Workspace | preserved | **unavailable** | n/a | opens Note | 4B |
| Knowledge | **WORKSPACE** | Workspace Index | Workspace | preserved | **unavailable** | n/a | opens Note | 4B |
| Pinned | **WORKSPACE** | Workspace Index | Workspace | preserved | **unavailable** | n/a | opens Note | 4B |
| Archive | **WORKSPACE** | Workspace Index | Workspace | preserved | **unavailable** | n/a | opens Note | 4B |
| Search (cross-file) | **WORKSPACE** | Workspace Index | Workspace | preserved | **unavailable** | n/a | opens Note | 4B |
| Workspace Projects | **WORKSPACE** | Workspace Index | Workspace | preserved | **unavailable** | n/a | cross-file | 4B |
| Workspace Index | **WORKSPACE** | `WORKSPACE_INDEX_STATE` | Workspace | preserved; **cards stay Pkg 10** | **unavailable** | n/a | opens Note | 4B |
| Quick Report | **DEFERRED** | Report identity | Workspace | **deferred to Package 7** | **unavailable** | n/a | n/a | — |
| Draw.io Report | **DEFERRED** | Draw.io reconciliation | Workspace | excluded | **unavailable** | n/a | n/a | — |
| Back / Forward | **BOTH** | `navigation-history.js` | entry identity | shared owner, explicit scope | available (session-local) | n/a | is navigation | 4C |
| virtual views | **CURRENT DOCUMENT** | `render-controller.js` | document buffer | conditional, preserved | available | suspend/restore | Return | 4C |
| Return | **CURRENT DOCUMENT** | `render-controller.js` | virtual-view stack | required | available | n/a | pops stack | 4C |
| Today | **WORKSPACE** | Workspace Index | Workspace | preserved | **unavailable** | n/a | opens Note | 4B |
| New Note | **WORKSPACE** | Workspace root | Workspace | preserved | **unavailable** | n/a | creates Note | 4B |
| Archive / Restore | **WORKSPACE** | Workspace Index | Workspace | preserved | **unavailable** | n/a | opens Note | 4B |
| Pin | **WORKSPACE** | Workspace Index | Workspace | preserved | **unavailable** | n/a | n/a | 4B |

## 8. CURRENT DOCUMENT SNAPSHOT CONTRACT

**Gate 4 finding: this contract already exists in substance** (divergence D1).
ACT 4A aligns and proves it; it does not invent it.

Accepted shape, expressed over the **existing** `getCurrentDocumentScope()`
return plus its existing `parsed` payload — no new global store:

| Field | Source today | ACT 4A action |
|---|---|---|
| `markdown` | `text` (live `md.value`) | keep, alias |
| `title` / `h1` | `parsed.title` | alias |
| `filename` | `physicalName` | alias |
| `path` | `workspacePath` **only when `belongsToWorkspace`** | keep neutral otherwise |
| `writable` | `hasWritableHandle` + permission state | add explicit boolean |
| `dirty` | `dirty` | keep |
| `tags` | `parsed.tags` | expose |
| `tasks` | `parsed.tasks` | expose |
| `linksOut` | `parsed.conceptLinks` | expose |
| `projects` | `parsed.projects` | expose (count-only consumer) |
| `frontmatter` | existing parser output | expose if already parsed |
| `sourceKind` | `documentCategory` + `belongsToWorkspace` | derive |
| `workspaceAvailable` | `workspaceAvailable` | keep — already explicit |

**Do not add fields without a real consumer.** `h1` and `title` are one
consumer, not two, and must not be duplicated.

Requirements already satisfied by source, to be locked by ACT 4A validators:

- live buffer is authoritative (`sourceFreshness: 'live'`);
- parser family is shared (`parseWorkspaceDocument()`);
- no second Markdown / Task / Wiki Link / Project grammar;
- snapshot is non-persistent and pure;
- snapshot does not mutate editor content or `WORKSPACE_INDEX_STATE`;
- snapshot works without Workspace;
- Workspace availability is explicit;
- unavailable cross-file consumers stay unavailable;
- a parse failure degrades the live scope only, leaving saved state untouched
  (`js/main.js:1420-1425`) — preserve this.

---

## 9. WORKSPACE SCOPE CONTRACT

Workspace input: saved root handle, saved `notes/` files, `WORKSPACE_INDEX_STATE`,
active saved source path, plus the live buffer only where a document-local
consumer explicitly requires it.

| Consumer | Live or Saved | Rule |
|---|---|---|
| local Tasks | **live** | reflects unsaved editor text |
| aggregated Task Review | **saved** | updates only after Save + rebuild |
| local Links Out | **live** | reflects unsaved text |
| Links In | **saved** | Workspace relationships only |
| local Tags | **live** | reflects unsaved text |
| Workspace Tags inventory | **saved** | built from saved Notes |
| local Projects | **live** | current document only |
| Workspace Projects | **saved** | Index only |

`js/main.js:10293-10295` already schedules a Workspace Index rebuild on save
when `WORKSPACE_STATE.activeFile` is set. **No consumer may silently mix live and
saved data**, and ACT 4A must prove that separation with a validator.

---

## 10. APP-ENTRY CONTRACT

### Open Note (adapts `openSmart()`, `js/main.js:10299`)

- invokes the existing `showOpenFilePicker` path or accepted fallback;
- opens one physical Markdown file;
- stores the writable handle in the **existing** `currentSaveHandle`;
- establishes Current Document scope;
- does **not** activate Workspace;
- does **not** create `notes/`;
- does **not** fabricate a single-file `WORKSPACE_INDEX_STATE`;
- composes document-relevant Sidebar panels;
- Save overwrites the opened file when writable.

## 12. TRANSITION MATRIX

`H` = `currentSaveHandle`; `WR` = Workspace root handle; `AF` = `activeFile`;
`LAP` = `lastActivePath`; `IDX` = Index lifecycle; `MS` = Mode Session;
`NH` = Navigation History; `SB` = Sidebar composition; `PV` = virtual-view
state; `DR` = autosave draft; `RC` = recovery.

| # | Transition | Dirty guard | H after | WR | AF / LAP | IDX | NH | SB | PV | DR / RC |
|---|---|---|---|---|---|---|---|---|---|---|
| T1 | initial editor -> Open Note | guard before open | new handle | none | cleared | not created | push entry | document panels | cleared | draft keyed to filename |
| T2 | initial editor -> Open Workspace | guard before open | preserved | new root | set from active Note | built | push entry | workspace panels | cleared | draft retained |
| T3 | Open Note -> another Open Note | **prompt**; Save/Discard/Cancel | new handle | none | cleared | not created | push entry | document panels | cleared | old draft preserved until Save |
| T4 | Open Note -> Open Workspace | **prompt** before switch | preserved or cleared per choice | new root | set | built | push entry | workspace panels | cleared | preserved |
| T5 | Workspace -> Open Note | **prompt** | new handle | **cleared** | cleared | **released** | push entry | document panels | cleared | draft preserved |
| T6 | Workspace -> another Workspace | **prompt** | preserved | new root | reset | rebuilt | push entry | workspace panels | cleared | preserved |
| T7 | Workspace Note -> another Workspace Note | **prompt** | new handle | preserved | updated | rebuilt | push entry | workspace panels | cleared | preserved |
| T8 | Standalone -> clear document | **prompt** | **cleared** | none | cleared | not created | push entry | document panels | cleared | draft preserved |
| T9 | Workspace -> close/deactivate | **prompt** | cleared | **cleared** | cleared | **released** | push entry | document panels | cleared | preserved |
| T10 | virtual view -> Return | n/a (buffer suspended) | preserved | preserved | preserved | preserved | preserved | preserved | **popped** | preserved |
| T11 | reload with Standalone session | draft restored, not saved | recovered if permitted | none | cleared | not created | restored | document panels | restored | draft restored; reopen if handle unrecoverable |
| T12 | reload with Workspace session | draft restored | recovered | recovered | `lastActivePath` | rebuilt | restored | workspace panels | restored | rebuild Index from root |
| T13 | browser back/forward | **prompt** on document change | restored | restored | restored | restored | pops/pushes | recomposed | preserved | preserved |
| T14 | cancelled file picker | **no change** | unchanged | unchanged | unchanged | unchanged | **no entry** | unchanged | unchanged | unchanged |
| T15 | cancelled Workspace picker | **no change** | unchanged | unchanged | unchanged | unchanged | **no entry** | unchanged | unchanged | unchanged |
| T16 | failed read | **no change**; report error | unchanged | unchanged | unchanged | unchanged | **no entry (rollback)** | unchanged | unchanged | draft preserved |
| T17 | failed Save | **baseline NOT refreshed** | preserved | preserved | preserved | **not rebuilt** | preserved | preserved | preserved | draft preserved for retry |
| T18 | permission denied | guard blocks switch | unchanged | unchanged | unchanged | unchanged | **no entry** | unchanged | unchanged | preserved; never claim writable |
| T19 | stale file handle | **prompt** | cleared, re-request | preserved | preserved | rebuilt | preserved | preserved | preserved | draft preserved; require reopen |
| T20 | non-writable opened file | n/a | `null` / read-only | unchanged | unchanged | unchanged | push entry | preserved | unchanged | Save routes to Save As |


## 13. DIRTY STATE AND SAVE CONTRACT

Source-proven dirty paths: module-level `dirty` exposed through
`MME_APP.isDirty()` (`js/main.js:5275`), with `MME_APP.confirmDiscardIfDirty()`
and `MME_APP.resolveBeforeApplicationReload()` as the existing guards.

- **Standalone Note dirty:** live-buffer edit while `currentSaveHandle` is set,
  with content differing from the saved baseline.
- **Workspace Note dirty:** identical rule — the same `dirty` flag. One dirty
  owner for both scopes is itself structural proof of one application.
- **Programmatic mutations:** any write to `md.value` (including Task lifecycle
  mutation) must mark dirty — a validator obligation for ACT 4A/4B.
- **Autosave draft vs physical Save:** the draft
  (`clearDraft(currentFileName)`, `js/main.js:10291`) is a recovery buffer, not a
  Save. Draft presence must never be reported as a successful physical write.
- **Preserved invariant:** Save success -> baseline refresh + `clearDraft` +
  conditional Index rebuild (`js/main.js:10291-10295`); failed Save -> baseline
  **not** refreshed; cancel -> no transition.

**Constraint:** ACT 4A must not become a Save rewrite. If a pre-transition guard
proves insufficient, record it as an ACT 4D candidate rather than expanding 4A.

---

## 14. MODE SESSION AND RECOVERY CONTRACT

| Field | STANDALONE recovery | WORKSPACE recovery |
|---|---|---|
| handle | recoverable only if the browser grants it | root handle recoverable |
| filename | restored | `lastActivePath` |
| editor text | restored | active Note text |
| dirty draft | restored per accepted autosave contract | restored |
| pane / layout | restored | restored |
| Sidebar | document panels | workspace panels |
| Index | not created | rebuilt from root |

**When a handle cannot be recovered, the safe behaviour is fixed:** do not
fabricate access; do not claim the file is writable; restore the draft only per
the accepted autosave contract; require the user to reopen the physical file.

**No database is introduced for session recovery.** ACT 4C extends
`js/core/mode-session.js` under `mode-session-validators.cjs`.

---

## 15. NAVIGATION HISTORY CONTRACT

### Decision: **Option B — History is scope-aware and session-local, with exact
physical identity for standalone files.**

`navigation-history.js` already owns the stack. Package 4 **extends that one
owner**; it does not create a second stack.

| Aspect | Accepted rule |
|---|---|
| Standalone entry identity | exact File System Access handle identity, **never** the visible H1 |
| Same-file navigation | a repeat open of the same handle must **not** push a duplicate entry |
| Workspace entries | remain distinct, keyed by Workspace-relative path |
| Cross-scope Back/Forward | a Workspace -> Standalone transition is a single valid history step (T5) |
| Dirty interaction | Back/Forward triggers the same guard as any document change (T13) |
| Failed-open rollback | a failed or cancelled open pushes **no** entry (T14-T16) |
| virtual-view Return | Return is a **separate** mechanism in `render-controller.js`; it must not be conflated with History |
| After reload | History is **not** expected to survive a reload as document identity; Mode Session restore governs. This is the one honest limit of Option B. |

**Why Option A was not chosen:** Option A (multi-file History across standalone
opens) depends on handle identity surviving reload, which browsers do not
guarantee. Claiming it would mean fabricating access. Option B is the only
source-honest option, and it still delivers meaningful standalone Back/Forward
within a session and across virtual views.

**Open risk (highest in Package 4):** ACT 4C must prove identity is handle-based
and H1 is never used as identity.

---

## 16. SIDEBAR COMPOSITION CONTRACT

One existing host (`index.html` Sidebar -> `.workspaceNavScroller`,
`js/workspace/workspace-sidebar.js:77`). **No copied markup tree, no second
Sidebar.** Divergence D3 shows availability is not yet first-class, so ACT 4B
introduces one composition registry keyed on
`getCurrentDocumentScope().workspaceAvailable`.

| Panel | Scope | Panel | Scope |
|---|---|---|---|
| Active / current document | DOCUMENT | Notes | WORKSPACE |
| local Tags | DOCUMENT | Knowledge | WORKSPACE |
| local Tasks | DOCUMENT | Pinned | WORKSPACE |
| local Links Out | DOCUMENT | Archive | WORKSPACE |
| local Projects (if approved) | DOCUMENT | Search | WORKSPACE |
| Logs | DOCUMENT | Links In | WORKSPACE |
| Help | DOCUMENT | Workspace Tags inventory | WORKSPACE |
| Outline / metrics | conditional | Task Review | WORKSPACE / scoped |
| | | Task Board | WORKSPACE |
| | | Workspace Projects | WORKSPACE |
| | | Workspace Index | WORKSPACE (cards = Package 10) |
| | | Workspace Report | WORKSPACE |


## 17. LOCAL TAGS CONTRACT

- Extracted from the **live** Current Document (`parsed.tags`, `js/main.js:1103`).
- Uses the **shared** Markdown parser/normalizer — no second normalizer.
- No Workspace inventory; no cross-file claim of any kind.
- Selecting a tag filters within the active document only.
- The existing visual chip grammar may be reused unchanged.
- **Final cross-surface tag visual alignment remains Package 10.**
- Workspace Tags inventory remains saved Workspace aggregation with existing
  filter ownership preserved.

**Scope communication:** the local panel is labelled to the active document
(e.g. "Tags in this note"). It is never presented as a Workspace inventory.
This avoids two unrelated tag systems: one is a document-local projection, the
other is a saved Workspace index, and each is labelled by its scope.

---

## 18. LOCAL TASKS CONTRACT

- Parsed from the live Current Document (`parsed.tasks`, `js/main.js:1110`).
- Uses the **Package 2 normalized Task contract**; no second Task parser, no
  second lifecycle owner, no Workspace Index required.
- Source identity is the active physical document; exact line/occurrence remains
  available.

### Decision: **Option B — reuse the existing Task Review adapted to Current
Document scope.**

Rationale from source: Task Review is already a **pure projection** over task
records with an existing mutation owner (Package 2). Adapting its *scope* is low
risk, whereas a new compact local list (Option A) would duplicate the
projection, and a local Task Board (Option C) would require a second store and
broad UI work. Option B is the only option that adds no second owner.

- **local Task Board: DEFERRED.** Board UI is Workspace-scoped in 0.6.3; giving
  it a local mode is deferred rather than half-built.
- **Save behaviour:** lifecycle mutations write to `md.value` and therefore mark
  dirty; persistence happens only through the single physical Save, which then
  triggers the existing Index rebuild when a Workspace is active.
- **Package 2 semantics are not changed.**

---

## 19. LOCAL LINKS OUT CONTRACT

- Extracted from the live Current Document (`parsed.conceptLinks`,
  `js/main.js:1119`) through the **shared Package 3 Wiki Link grammar**.
- **Without Workspace, resolution is not-ready** — not "missing", not "broken".
  A target that cannot be checked is not a failure.
- No fake missing state, no Links In, no cross-file opener, no live cross-file
  scan, no automatic target creation.
- With Workspace, live Current Document Links Out resolves against the **saved**
  Index, and Links In remains saved Workspace relationship data.

**Smallest useful standalone presentation:** a compact document-local list of
outgoing links, each marked *unresolved (no Workspace)*, non-navigating.
**The final Active Links Out card is not implemented** (Package 10).

---

## 20. LOCAL PROJECTS CONTRACT

## 22. STATIC SHELL AND LATENT COUPLINGS

**Confirmed in source:** `index.html:182-189` contains
`#workspaceRelatedPanel` (initially `hidden`) with a hard-coded
`workspaceRelatedTitle` of **"Related"** and a `workspaceRelatedSummary`
defaulting to **"No active concept"**.

Latent coupling: the runtime currently discards and rebuilds this panel as
**Links In** because the required badge markup is absent. If a badge is added
later without care, the stale static label and default summary could survive and
be presented as real content.

**Decision: correct in ACT 4B.** ACT 4B already edits Sidebar shell and
composition to add the availability registry, so the static label is corrected in
the same place, with a validator asserting the static shell carries no stale
"Related" / "No active concept" text. This follows the stated recommendation and
**no standalone ACT is opened** for it alone.

**Tracked development-cache workflow issue is preserved unchanged.** Cache
behaviour is not redesigned in Package 4.

---

## 23. CLOSED DECISIONS (Gate 4)

| # | Decision |
|---|---|
| 1 | Entry labels: **Open Note** and **Open Workspace**. |
| 2 | `btnOpen` **becomes** Open Note; no separate control is added. |
| 3 | Minimum Standalone panels: Active identity, local Tags, local Tasks (Task Review scoped), local Links Out, Logs, Help. |
| 4 | Task experience: **Option B** — existing Task Review adapted to Current Document. Local Task Board deferred. |
| 5 | Local Projects: **deferred to Packages 5-6**, count-only exception in ACT 4B only if it needs no new store. |
| 6 | Outline / metrics: **deferred** from Package 4. |
| 7 | No-Workspace Links Out: compact list, each *unresolved (no Workspace)*, non-navigating. |
| 8 | No-Workspace Links In: **unavailable**, distinct from zero, never a false empty. |
| 9 | Navigation History: **Option B**, handle-based identity, session-local, no cross-reload identity. |
| 10 | Reload without a recoverable handle: restore draft, do not claim writable, require reopen. |
| 11 | Workspace -> Standalone: clear root handle, release Index, recompose to document panels. |
| 12 | Standalone -> Workspace: dirty guard, then preserve accepted Workspace behaviour. |
| 13 | Static "Related" shell cleanup: **ACT 4B**, with a validator. |
| 14 | **Three ACTs remain sufficient** — divergences D1/D2 show 4A and 4B are alignment work, not construction. |
| 15 | Browser checkpoints are mobile-first (S22/DeX); laptop triggers in §27. |
| 16 | Package 4 closure targets **0.6.4 — Standalone Notes and Scope Composition**. |

**Unresolved items requiring a source experiment: none blocking.** Two
conditional items remain source-gated rather than open: local Projects count
(§20) and any pre-transition guard strengthening (§13). Both default to the
narrower option, so neither blocks ACT 4A.

---

## 24. ACT 4A HANDOFF — Shared Scope Contract and Current Document Snapshot

**Rationale for this ACT's size:** divergence D1 proves the snapshot already

## 25. ACT 4B HANDOFF — Open Note Entry and Standalone Sidebar Composition

**Expected areas:** Open Note control (relabel `btnOpen`, adapt `openSmart()`);
physical file picker; handle activation into the existing `currentSaveHandle`;
Save overwrite; no-Workspace runtime state; Sidebar panel availability registry;
local consumer wiring; Workspace-only panel hiding; transition to Workspace;
transition from Workspace; static "Related" shell correction (§22).

**Key implementation guidance from Gate 4:**

- `openSmart()` already performs the physical open and stores a writable handle.
  **Reuse it; do not write a second opener.** This is the single largest risk
  reduction in the package.
- The availability registry keys on
  `getCurrentDocumentScope().workspaceAvailable` — one boolean, one source.
- Workspace-only panels are set **unavailable**, never rendered as empty.
- On leaving a Workspace, the root handle is cleared and the Index released
  (T5, T9), then the Sidebar recomposes to document panels.

**Required ACT 4B browser checkpoint (mobile-first, S22/DeX):**

1. open a writable Markdown file via Open Note;
2. edit it;
3. Save — the physical file on disk changes;
4. reopen the file and confirm the saved content is present;
5. local Tags render and reflect the live document;
6. local Tasks render and a status toggle mutates the buffer and marks dirty;
7. local Links Out render, each marked *unresolved (no Workspace)* and
   non-navigating;
8. Links In is **absent/unavailable** — no false zero;
9. no Workspace panels are visible anywhere;
10. open a Workspace — all accepted 0.6.3 panels return;
11. return to Standalone — document panels only, no ghost panels;
12. dirty-state cancel on switching scope leaves content and handle untouched;
13. no stale handle points at the prior file;
14. static Sidebar shell shows no "Related" / "No active concept" residue.

**Validator owner:** new `scripts/sidebar-composition-validators.cjs` plus
extension of the scope suite; Package 2 task validators must stay green.

---

## 26. ACT 4C HANDOFF — Transitions, Recovery, History and Integrated Acceptance

**Expected areas:** Mode Session; reload recovery; Hot Reload; Navigation
History; Back/Forward; virtual views; Return; draft recovery; permission loss;
failed open; failed Save; scope-transition regression; Workspace preservation.

**Key implementation guidance from Gate 4:**

- Extend `js/core/mode-session.js` and
  `js/navigation/navigation-history.js`. Create neither a second session owner
  nor a second history stack.
- History identity is the **handle**, never the visible H1.

## 29. PACKAGE 4 EXIT CRITERIA

1. Open Note opens a physical Markdown file with no Workspace fabricated.
2. Open Workspace preserves every accepted 0.6.3 experience.
3. Scope composition is driven by one availability boolean from one owner.
4. No second parser, Task store, Link store, Project store, Save owner, file
   opener, History stack or Mode Session owner exists.
5. Links In is unavailable, not zero, without a Workspace.
6. Local Tags, Tasks and Links Out reflect the live buffer and claim no
   cross-file scope.
7. Local Links Out reuses the Package 3 grammar; local Tasks reuse Package 2.
8. Every transition in §12 is proven against its dirty, handle, History and
   recovery expectations.
9. No transition silently discards dirty content or leaves a stale handle.
10. Workspace panels never remain active without a Workspace.
11. Static Sidebar shell carries no stale "Related" / "No active concept" text.
12. Reports, Projects, Outline/metrics and the final disclosure cards remain in
    their assigned packages.
13. All validator suites pass, plus release parity normal and strict.
14. Accepted in a browser, with the mobile-first checkpoint executed.

---

## 30. 0.6.4 CLOSURE REQUIREMENTS

- `productVersion` -> `0.6.4`;
- `APP_VERSION` / cache identity -> the accepted 0.6.4 identity;
- Release Notes for 0.6.4;
- `VERIFY.md` records the accepted 0.6.4 runtime checkpoint;
- `STATUS.md` records Package 4 CLOSED and Package 5 as next;
- release parity normal **and** strict pass;
- full regression chain green;
- `main` promoted only under separate authorization.

**Gate 4 changes none of this.** Release identity is untouched at 0.6.3.

---

## 31. PACKAGE 4 NON-TOUCH LIST

Final Active Open/Done/Links In/Links Out/Projects cards; final Workspace Index
disclosure cards; shared final tag visual consistency; Project metadata model;
`mme-project` writer; Projects Expanded View; enriched Reports; Draw.io changes;
Reveal.js; Mermaid; Graph View; Rename File; Wiki Link rewrite; Reminders;
Highlights; @ layer; assignments; monthly calendar; non-Markdown assets; Service
Worker redesign; broad `main.js` refactor (Package 9.5).

Small source-proven extraction is permitted **only** where essential to scope
composition and protected by validators. Broad cleanup remains Package 9.5.

---

## 32. GATE 4 CONSISTENCY CHECKS

| # | Check | Result |
|---|---|---|
| 1 | one application, not two | PROVEN — §3, §7, single dirty owner §13 |
| 2 | one Sidebar, composed by scope | PROVEN — §16, host `workspace-sidebar.js:77` |
| 3 | one Markdown parser family | PROVEN — `parseWorkspaceDocument()` shared |
| 4 | Current Document uses live buffer | PROVEN — `sourceFreshness: 'live'` |
| 5 | Workspace aggregation uses saved Index | PROVEN — `getWorkspaceScope()` §9 |
| 6 | Open Note does not fabricate Workspace | PROVEN — §10, §11 |
| 7 | Open Workspace preserves accepted behaviour | PROVEN — §10, §7 |
| 8 | Save retains one physical owner | PROVEN — `currentSaveHandle` §11 |
| 9 | Links In unavailable != zero | PROVEN — §19, §16, fixture 9 |
| 10 | local Tags claim no cross-file scope | PROVEN — §17 |
| 11 | local Tasks reuse Package 2 | PROVEN — §18 Option B |
| 12 | local Links Out reuse Package 3 | PROVEN — §19 |
| 13 | local Projects do not preempt 5–6 | PROVEN — §20 deferred |
| 14 | Reports do not preempt 7–9 | PROVEN — §21 |
| 15 | Active cards remain Package 10 | PROVEN — §16, §31 |
| 16 | Workspace Index cards remain Package 10 | PROVEN — §16, §31 |
| 17 | broad `main.js` refactor remains 9.5 | PROVEN — §31 |
| 18 | transition matrix covers dirty state | PROVEN — §12 col 3 |
| 19 | transition matrix covers handles | PROVEN — §12 cols 4-6 |
| 20 | transition matrix covers History | PROVEN — §12 col 8, §15 |
| 21 | transition matrix covers Mode Session | PROVEN — §12, §14 |
| 22 | transition matrix covers reload recovery | PROVEN — §12 T11/T12, §14 |
| 23 | Package 4 closure targets 0.6.4 | PROVEN — §30 |
| 24 | no runtime implementation in Gate 4 | PROVEN — §33 |
| 25 | no version/cache owner changed | PROVEN — §33 |

---

## 33. GATE 4 CONFIRMATIONS

- planning/documentation only;
- no runtime implementation;
- no Open Note implementation;
- no Sidebar runtime change;
- no Task change;
- no Wiki Link change;
- no Project/Report implementation;
- no Active/Workspace Index cards;
- no broad refactor;
- no version/cache change;
- no commit;
- no push.

**Gate 4 does not execute ACT 4A.**

- A cancelled or failed open pushes **no** history entry (T14-T16, T18).
- When a handle cannot be recovered: restore the draft, do not claim writable,
  require the user to reopen. Never fabricate access.

**ACT 4C prepares one integrated Package 4 fixture/checklist** covering the
transition matrix invariants §12.1-12.5, and the full regression proof that
**Workspace function is not reduced** by any of this work.

**Validator owner:** `mode-session-validators.cjs` extended; new history
validators; the full runtime regression chain runs at ACT 4C, not at Gate 4.

---

## 27. CHECKPOINTS

**Mobile-first (S22 / DeX) — default for:** ACT 4B checkpoint 1-14, ACT 4C
transition walkthrough, draft recovery, and every availability-state assertion.

**Laptop-only triggers (require an explicit request, not automatic):**

- desktop-only keyboard/focus behaviour;
- wide multi-pane layout;
- File System Access behaviour not reproducible on S22/DeX;
- PWA release/update behaviour;
- productive Workspace acceptance.

A laptop test is **not** required for every ACT.

---

## 28. ACT 4D CRITERIA

ACT 4D is **conditional correction only** and opens only if source evidence or
browser acceptance proves a focused remaining defect. It is not scheduled work.

Triggers: a source-proven defect in ACT 4A/4B/4C output with a demonstrably
narrow fix; a browser-acceptance failure reproducible on a checkpoint above.

Non-triggers: feature growth, visual polish, broad refactor, Package 5-10 scope.

exists. ACT 4A is therefore **alignment, availability and proof**, not
construction. A larger ACT 4A would risk becoming an unjustified rewrite.

**May implement:** explicit scope/availability constants; the composed snapshot
API over `getCurrentDocumentScope()`; adaptation of existing local providers;
no-Workspace availability states; minimal extractions required for later
composition; Sidebar touched **only** to publish availability as data.

**Must not implement:** final Open Note UI; broad Sidebar composition; Workspace
<-> Standalone transition UI; final Task/Tags/Links panels; release boundary.

**Required fixtures (all become validators):**

1. live Markdown snapshot reflects unsaved buffer edits;
2. saved title and filename identity;
3. file handle optionality (present and absent);
4. writable vs non-writable state;
5. local Tags present and correctly scoped;
6. local Tasks present and Package-2 normalized;
7. local Links Out present;
8. Workspace unavailable reported as unavailable;
9. Links In unavailable, **not zero**;
10. no second parser owner (single `parseWorkspaceDocument` call path);
11. no second Task store;
12. no second Wiki Link store;
13. no `WORKSPACE_INDEX_STATE` mutation from a live-scope read;
14. live/saved boundary proven (local live, aggregation saved);
15. deterministic snapshot (same input -> same output);
16. input immutability (snapshot does not mutate the buffer).

**Validator owner:** extend `scripts/current-document-scope-validators.cjs`
(currently 41/0). No new validator file is required unless the suite grows
unmanageable.

---


- Allowed: discover a local Project declaration via the existing shared parser
  (`parsed.projects`, `js/main.js:1124`), show a **compact presence/count**, and
  allow navigation to the declaration line.
- Forbidden in Package 4: new Project metadata, `mme-project` writer, status
  controls, dates, quarter, Expanded View, modal, archive lifecycle.

**Decision: DEFERRED to Packages 5-6, with one narrow exception.** The count-only
presence indicator may ship in ACT 4B **only if** it requires no new store and no
UI scaffolding. If proving that proves more, it defers entirely. Preserving
complexity merely to claim local Projects coverage is explicitly rejected.

---

## 21. REPORTS CONTRACT

- **Quick Report remains Workspace-only during Package 4**; local Quick Report is
  deferred to **Package 7**.
- The Report panel is **hidden/unavailable** in Standalone.
- **No false empty Report state is shown.**
- Draw.io reconciliation is excluded entirely.

Package 7 is not pulled into Package 4.

---

Requirements:

- one panel owner per experience;
- shared panels receive an **explicit** scope argument;
- Workspace-only panels are **unavailable**, never shown as confirmed empty;
- collapse state (`workspacePanelCollapsed`, `js/main.js:2011`) stays stable
  across composition changes;
- internal IDs may remain where renaming would reset user preferences;
- no ghost Workspace panels after a transition to Standalone (T5, T9);
- returning to Workspace restores the appropriate panels (T2, T4, T6);
- **no final Active / Workspace Index disclosure-card work** (Package 10).

**ACT split:** ACT 4B builds the availability registry and the document panel
set. ACT 4A touches Sidebar only to publish availability as data.

---

All rows also refresh Mode Session (`MS`) on document change and preserve Hot
Reload behaviour.

**Invariants (ACT 4C must prove each):**

1. No transition may silently discard dirty content (T3-T9 all prompt).
2. No transition may leave a stale writable handle pointing at the prior file
   (T5, T8, T9, T19 clear or re-request `H`).
3. No transition may leave Workspace panels active without a Workspace
   (T5, T9 recompose to document panels and release `WR`).
4. A cancelled picker (T14, T15) and a failed read (T16) create **no** History
   entry — no failed-open ghost in the stack.
5. A failed Save (T17) never refreshes the baseline and never rebuilds the Index.

---


### Open Workspace (unchanged)

Preserves accepted `notes/` detection, Workspace Host activation, Index build,
panel restoration, and the active Current Document behaviour inside a Workspace.

### Entry decision

**The existing `btnOpen` (`index.html:54`) BECOMES "Open Note".** A separate
Open control is **not** required — it would be a redundant open control. Open
Workspace remains a distinct, semantically different action (directory root
versus single file) and keeps its own control. This is the smallest
understandable UI and is the direct consequence of divergence D2.

---

## 11. STANDALONE STATE CONTRACT

Minimum standalone runtime state (all already existing owners — no new store):

- `currentSaveHandle` — the single physical handle owner (**unchanged**);
- `currentFileName` / `physicalName` — filename identity;
- neutral `workspacePath` — deliberately empty so it can never be read as a
  Workspace path;
- live `md.value` — live editor text;
- `dirty` — dirty state;
- saved baseline (content at last successful Save);
- Current Document snapshot (§8) — live projection, non-persistent;
- Navigation History entry where meaningful (§15);
- Mode Session identity (§14);
- Sidebar composition state (§16).

Explicitly **forbidden** in standalone state: fake Workspace root, fake Notes
array, fake Workspace Index, fake Links In, hidden single-file database, copied
Task store, copied Link store, copied Project store.

**Handle decision:** `currentSaveHandle` **remains authoritative**. No narrower
runtime owner is introduced. `getCurrentDocumentScope()` reads it; it does not
re-wrap it. A second handle owner is forbidden and must be validator-protected.

---

| Add / Remove Knowledge | **WORKSPACE** | Workspace Index | Workspace | preserved | **unavailable** | n/a | n/a | 4B |

**BOTH classification note:** Back/Forward is the only consumer with a genuinely
shared owner. Everything else resolves cleanly to CURRENT DOCUMENT, WORKSPACE or
DEFERRED — structural proof that one composed application suffices and a second
application shell is unnecessary.

---

| Mode Session | `js/core/mode-session.js` | context + reload | Standalone variant | `mode-session-validators.cjs` | medium |
| Navigation History | `js/navigation/navigation-history.js` | entry identity | standalone entries | new history validators | **high** |
| virtual views / Return | `js/render/render-controller.js` | document buffer | preserve | new return validators | medium |
| Hot Reload | runtime | dev server | none | existing | low |

---


## 4. CLOSED PRODUCT DECISIONS

| ID | Decision |
|---|---|
| A | Entry terminology: **Open Note** and **Open Workspace**. "Open Standalone Note" rejected as needlessly long. |
| B | One application. Standalone and Workspace are two compositions of one shell. |
| C | Canonical unit is the physical Markdown file. Workspace aggregation never wraps the file in another data model. |
| D | Current Document reads the live editor buffer; local consumers may reflect unsaved edits. |
| E | Workspace aggregation reads saved files through `WORKSPACE_INDEX_STATE`; unsaved live text is never treated as saved cross-file state. |
| F | Links In is **unavailable** without Workspace. Unavailable is distinct from zero. |
| G | Adapt the existing Sidebar. No second Sidebar. |
| H | Save overwrites the currently opened writable file; otherwise Save As. Cancel does nothing. Unchanged in Package 4. |
| I | Final Active and Workspace Index disclosure cards remain **Package 10**. |

---


---
