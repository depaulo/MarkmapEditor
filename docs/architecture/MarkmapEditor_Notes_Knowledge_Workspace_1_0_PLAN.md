# MarkmapEditor Notes Architecture — Canonical Execution Plan

**Status:** Gate 0 ACCEPTED (2026-09-25). ACT 0 authorized and executed. ACT 1A NOT yet authorized.
**Supersedes:**
- `docs/architecture/MarkmapEditor_Document_Scope_and_Optional_Workspace_PLAN.md` — its deletion is accepted; Git history remains the archive of the old plan. Two active architecture plans with conflicting rules are not maintained.
- `MarkmapEditor_Notes_Knowledge_Workspace_1_0_PLAN_UPDATED.md` — upload artifact replaced by this canonical file.

**Authority:** PLAN ONLY until each ACT receives explicit owner authorization (`docs/AI_DEVELOPMENT_WORKFLOW.md`).
**Version boundary:** This plan does NOT assume the post-migration release is `1.0.0`. Final version selection happens only after product acceptance.

---

## 1. Fixed product decisions (owner-accepted; do not reopen without blocking source evidence)

1. Markdown remains canonical.
2. The simple Editor remains a first-class experience.
3. A standalone Markdown file can be created, opened, edited and saved without selecting a Workspace.
4. Workspace is an optional aggregation layer.
5. Workspace Markdown documents are intended to live in `workspace/notes/`.
6. Do not create `assets/`, `generated/` or `templates/` until a concrete feature requires each folder.
7. Today and Named Note create the same physical and logical Note model.
8. Proposed creation entry: `+ New Note` → `Today` / `Named Note...`.
9. Today opens or creates `notes/YYYY-MM-DD.md`; it opens the existing file for the same local date rather than creating a duplicate.
10. Named Note modal: name; note date defaulting to the local current date (editable and may be cleared); optional Knowledge checkbox; Cancel; Create Note.
11. Notes means every active Note, including Notes marked as Knowledge.
12. Knowledge is a filtered view over Notes, not a physical folder and not an exclusive destination.
13. Pinned is independent from Knowledge.
14. A pinned Note is shown in a Pinned area at the top and must not be duplicated again in the same Notes list.
15. Promote to Knowledge changes metadata only.
16. Promote does not rename or move the file.
17. Rename File is a separate future workflow with its own safety plan.
18. Archive is state/view metadata rather than physical file movement.
19. Existing Workspaces do not require automatic migration.
20. The owner accepts manually reorganizing the existing Workspace.
21. Compatibility break does not authorize silent data loss.
22. An old or mixed Workspace must not be modified automatically before its format is validated.
23. Journal remains available during transition.
24. Journal may be removed or renamed only after the Notes/Timeline experience reaches accepted browser-tested parity.
25. Slides remains a specialized experience.

Additional owner decisions (Gate 0 amendments):
- Named Note date defaults to local today, is editable and may be cleared. Missing date means Undated.
- False classification flags are represented by removing the managed key.
- Archive initially acts on the active Note only.
- Legacy/mixed Workspace detection is blocking, read-only and non-mutating. No compatibility mode.

---

## 2. Target Workspace structure

```text
Workspace chosen/
  notes/          # every Markdown document of the Workspace
```

Only `notes/` exists initially. `assets/`, `generated/` and `templates/` are reserved folders created only when a concrete feature requires them. A file opened outside the Workspace remains a standalone document and never joins `notes/` automatically.

---

## 3. Identity and classification contract

| Concept | Meaning | Physical effect |
| --- | --- | --- |
| Note | `.md` document in `notes/`; no metadata = normal Note | File in `notes/` |
| Today | Shortcut that opens or creates the single daily Note | Initial filename `YYYY-MM-DD.md` |
| Named Note | Shortcut creating a Note with a chosen name | Filename defined at creation |
| Knowledge | Optional reversible classification | Metadata update only; no move |
| Pinned | Quick-access highlight, independent of Knowledge | Metadata update only; no move |
| Archived | Outside active views; reachable in Archive | Metadata only; no move |
| Rename File | Explicit filename/path change | Separate, higher-risk flow |

- Physical identity: handle plus proven relative path. H1 is presentation only, never a navigation key. Duplicate H1 values remain distinct. Navigation uses path/handle.
- Indexed H1 title changes are reflected only after Save and Index rebuild; no per-keystroke Workspace indexing.
- Classification keys: `date`, `knowledge`, `pinned`, `archived` (exact serialization fixed in the metadata ACT PLAN).

---

## 4. Metadata contract (YAML frontmatter)

**Managed keys:** `date`, `knowledge`, `pinned`, `archived`.

| Key | Supported values | Absence semantics |
| --- | --- | --- |
| `date` | ISO `YYYY-MM-DD` | Missing date = Undated (never substitute filesystem mtime silently) |
| `knowledge` | `true` when set | Absent = not Knowledge |
| `pinned` | `true` when set | Absent = not pinned |
| `archived` | `true` when set | Absent = active |

Rules:
- False classification flags are represented by removing the managed key (a user action never writes `knowledge: false`). A manually typed `false` is read as absent and may be removed on the next managed write.
- Unknown frontmatter keys are always preserved verbatim; user formatting and body content are preserved where technically possible.
- No frontmatter present: a managed write may prepend a minimal `---` block.
- Malformed or unclosed frontmatter: mutators abort safely with a toast; no partial write ever remains.
- Insertion/update owner and physical Save owner are fixed in the metadata ACT PLAN. A dedicated frontmatter-mutator module is a RECOMMENDATION to be proven in that PLAN, not an approved file.
- Dirty-document policy: a metadata action on the ACTIVE note patches the editor buffer and marks the document dirty. It does NOT auto-save; user-controlled physical Save remains authoritative.
- Inactive-note actions are evaluated separately during the metadata ACT and are not assumed earlier.
- Virtual Reports are excluded from metadata actions.
- Actions are idempotent; permission or write failure rolls back with no partial state.

---

## 5. Creation contract

```text
[ + New Note ▾ ]
  Today            -> opens or creates the daily Note; no modal
  Named Note...    -> compact modal
```

**Today**
- Local date source: local `Date` components, zero-padded (`YYYY-MM-DD`).
- Target: `notes/YYYY-MM-DD.md`. If it exists, open the same file; never create a duplicate and never overwrite.
- A new file receives starter Markdown with `date: YYYY-MM-DD` frontmatter. No `journal` type and no `journals/` folder.
- Respects dirty guard, Report guard, ModeSession, writable handles and navigation history.
- If the daily Note was physically renamed, Today creates a new file for that date (documented consequence; the Rename workflow is a separate future package).

**Named Note modal**
- Fields: name; note date (defaults to local today, editable, may be cleared → Undated); Knowledge checkbox (unchecked by default); Cancel; Create Note.
- Filename normalization strips `[\/:*?"<>|]`, collapses whitespace and appends `.md`.
- Guards run BEFORE any file creation: empty name, invalid characters, filename collision (including a name resolving to `YYYY-MM-DD.md`, which collides with Today), and Cancel.
- Pin does NOT appear in the modal; Pin is a later, independent action.
- Partial-create failure rolls back (no orphan empty file, no index entry).
- Outside a Workspace, the simple Editor New/Open File flows keep working; the Workspace menu must never force `notes/` creation for standalone files.

---

## 6. Sidebar and view contract

```text
Workspace
  + New Note
  Search
  Notes                 every active Note (Knowledge included)
    Pinned              top subsection; never duplicated below
    By date             Today and Named Notes grouped by note date
    Undated             no resolved date
  Knowledge             filtered view (knowledge = true)
  Archive               filtered view (archived = true)
  Tasks / Projects / Reports / Index (existing panels, preserved)
```

- Notes contains every active Note; Knowledge is a filtered view; Pinned is independent; archived Notes never appear in active Notes or Knowledge.
- Restore preserves date, Knowledge and Pin.
- Duplicate H1 values remain distinct; navigation uses path/handle, never H1.
- Journal chronology is not reproduced as a separate physical kind.
- **Library decision:** do NOT create a separate Library list alongside Notes. The Sidebar area is the navigation host; `Notes` is the single all-active list. Avoid redundant lists showing the same content without a clear purpose.

---

## 7. Corrected execution sequence (each ACT is a review boundary)

```text
ACT 0   Documentation adoption & working-tree reconciliation        [AUTHORIZED - executed]
ACT 1A  Workspace format detection ONLY (strict read-only)          [AUTHORIZED NEXT - not started]
ACT 1B  folders.notes / files.notes + explicit init + notes/ scanner
ACT 1C  Single Workspace Index over notes/
ACT 2A  Consumer preservation: Search, Related, Tags, Wiki Links
ACT 2B  Consumer preservation: Task Review, Task Board, current Projects discovery
ACT 2C  Consumer preservation: Reports, Draw.io, Navigation History,
        Hot Reload, Save, Save As
-------- STRUCTURAL CHECKPOINT (browser accepted) --------
-------- MANUAL MIGRATION CHECKPOINT (owner reorganizes) --------
ACT 3A  Unified creation flow (+ New Note: Today / Named Note modal)
ACT 3B  Sidebar views: Notes / Pinned / date groups / Undated / Knowledge / Archive
ACT 4   Metadata actions on the active Note (buffer patch + dirty; no auto-save)
ACT 5   Timeline grouping + optional Workspace experience; Journal parity decision
6A-6E   Independent packages: Tasks; Projects parser; Project metadata;
        Projects Expanded View; Quick Report + Draw.io alignment;
        final 1.0 closure and version selection
```

### ACT 1A — strict read-only format detection (nothing else)
- Detects exactly: empty folder; valid `notes/` Workspace; legacy Workspace (`journals/`/`concepts/` without `notes/`); mixed Workspace (`notes/` plus legacy folders); permission failure.
- Legacy and mixed folders are REJECTED as Workspaces. The rejection is blocking, read-only and non-mutating. There is no compatibility mode. Individual Markdown files remain openable through Open File.
- MUST NOT create `notes/` and MUST NOT call any filesystem API with `create: true`.
- No metadata writers, no views and no creation UI anywhere in ACT 1 or ACT 2.

### ACT 1B — explicit initialization and scanner
- Only after ACT 1A returns empty AND the owner explicitly confirms: create `notes/`, initialize `folders.notes` and `files.notes`, then execute the notes/ scanner.
- Never initializes from a legacy or mixed detection result.

### ACT 1C — single Workspace Index over notes/
- The existing `buildWorkspaceIndex()` aggregates `files.notes` only. One Index; no second Workspace Index, parser or document store.

### ACT 2A–2C — consumer preservation only
- Preserve behavior of Search, Related, Tags, Wiki Links, Task Review, Task Board, current Projects discovery, Reports, Draw.io, Navigation History, Hot Reload, Save and Save As against the `notes/` sources.
- NO feature improvements in these phases — behavior preservation only.

---

## 8. STRUCTURAL CHECKPOINT (after ACT 2C; browser accepted)

Passage criteria:
1. The scanner discovers every Markdown file inside `notes/`.
2. One `WORKSPACE_INDEX_STATE` indexes notes, tasks, tags, projects and links.
3. All preserved consumers behave identically — no regression; every existing validator suite stays green plus new fixtures.
4. Browser acceptance on desktop and mobile/DeX with a test `notes/` Workspace.

No creation UI, Sidebar redesign or metadata writer starts before this checkpoint passes.

## 9. MANUAL MIGRATION CHECKPOINT (after structural acceptance)

Owner process (the application performs no migration):
1. Keep the old Workspace — with `journals/`, `concepts/` and `archive/` untouched — as the backup.
2. Create a SEPARATE new Workspace folder.
3. Create `notes/` in the new Workspace.
4. Copy reviewed Markdown files into `notes/`.
5. Validate filename collisions and Wiki Link targets after the copy.
6. Open the new Workspace in MarkmapEditor and validate navigation, Tags, Tasks and Reports.

Constraint: `journals/` and `concepts/` CANNOT remain inside the selected new Workspace root — the legacy structure stays only in the separate old folder.

## 10. Functional improvements deferred

Search H1 matching, Sidebar redesign, creation UX, metadata actions, Timeline grouping, Journal-mode removal or rename, Project metadata, standalone Reports and the Expanded Projects View are deferred until after structural acceptance, each in its own authorized package. The ACT 2A–2C consumer-preservation phases must not improve features.

## 11. Projects future direction (preserved decision)

The future Project declaration is:

```text
## Project: Project Name
<ordinary Markdown content>
```

- Do not introduce project frontmatter as an alternative primary declaration.
- Do not change Projects syntax during structural migration.
- The current `Project:` parser behavior stays untouched until the dedicated Projects parser package decides the reconciliation.

## 12. Version boundary

No version, cache identity or Service Worker change occurs in ACT 0–5. The post-migration release is NOT assumed to be `1.0.0`; final version selection happens only after product acceptance, with one version/cache bump per accepted release package.

## 13. Acceptance and regression criteria (carry-over)

- Today creates/opens `notes/YYYY-MM-DD.md` without duplicating or overwriting.
- The Knowledge checkbox classifies the same Note; unpinned/undated states are key removals.
- A promoted Note remains in Notes; a pinned Note never duplicates within a view; Archive exits active views; Restore preserves classification.
- Filename and H1 may differ; clicks use path/handle; duplicate H1s never merge records.
- A legacy or mixed Workspace is never modified silently; a standalone file never joins the Workspace by equal filename.
- Creation, metadata and Save/Save As respect dirty state, cancellation, permissions, failure, virtual Report and rollback; no action implicitly rewrites Wiki Links.
- Existing validators stay green; `node --check` on touched JS/CJS; `git diff --check`; desktop/mobile/dark/offline browser checkpoints.

## 14. Non-goals and boundaries

- No automatic migration of `journals/`, `concepts/` or `archive/`.
- No Rename File flow inside Promote or Archive.
- No ModeSession change without a demonstrated bug.
- No Journal mode removal before browser-tested parity (its own ACT boundary).
- Slides remains specialized.
- A dedicated frontmatter-mutator module remains a recommendation until its metadata PLAN proves it.
