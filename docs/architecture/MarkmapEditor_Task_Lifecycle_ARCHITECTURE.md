# MarkmapEditor Task Lifecycle Architecture

## Status
- **T1A — core lifecycle:** implemented.
- **T1B — physical-Save integration:** pending (not implemented in T1A).

This document describes the Task lifecycle owner and its data contract. It is
the lifecycle companion to the existing
`docs/architecture/MarkmapEditor_Quick_Report_and_task_Metadata_MVP_PLAN.md`,
which remains the authority for the `mme-task` metadata comment grammar and the
legacy `completed` date behavior.

> **Important:** Do NOT treat automatic Opened Date as active after T1A. T1A
> provides the pure lifecycle owner and canonical transition/serialization
> contract only. Nothing in T1A writes dates, reconciles physical Save, or
> mutates the Workspace Index. Automatic date writing is a T1B (Save
> integration) responsibility.

---

## 1. Purpose

MarkmapEditor captures work as it happens (Journal and Concept notes, meetings,
daily notes) and derives minimal useful structure with as little manual
maintenance as possible. Tasks must stay easy to write as ordinary Markdown.

The lifecycle model supports four statuses — `backlog`, `todo`, `ongoing`,
`done` — with automatic Opened/Started/Closed dates, so that a future simple
Task Board and date-based Report sections can consume trustworthy data without
requiring the user to maintain lifecycle fields by hand.

## 2. Product simplicity principle

- Natural capture: a user types `- [ ] Prepare proposal` and nothing more is
  required. No ID, Opened Date, status, source path, project, owner, priority,
  or due date is required.
- Automatic structure: derived metadata is attached only where source-compatible
  and unambiguous.
- Reveal only what is needed: lifecycle data exists for future consumers; it is
  not surfaced everywhere in the Editor, TaskReview, Sidebar, Markmap, or HTML
  Preview.
- Standard Markdown checkboxes remain authoritative. Metadata is hidden
  HTML-comment data that other Markdown readers ignore.

## 3. Existing metadata grammar authority

Task metadata uses the established hidden comment syntax defined in the Quick
Report Task metadata document:

```md
- [ ] Task text
- [x] Task text <!-- mme-task: completed=YYYY-MM-DD -->
- [ ] Task text <!-- mme-task: status=ongoing; owner=adelson -->
```

Rules inherited from that authority:

- The comment is empty-removed when all fields are gone.
- Keys are normalized (lowercase, `-`/space → `_`).
- Duplicate keys: last wins, matching the existing parser.
- Unknown keys are preserved round-trip.
- There is at most one canonical `<!-- mme-task: ... -->` comment per task line.

T1A reuses this grammar and does not invent a second metadata format.

## 4. Lifecycle owner

The pure lifecycle owner is `js/tasks/task-lifecycle.js`, published as the single
application global `globalThis.MME_TASK_LIFECYCLE` (following the established
ordered-global-script pattern; no ES imports).

It contains only pure Task lifecycle responsibilities:

- lifecycle status vocabulary;
- normalization;
- date-field parsing and validation;
- canonical task-local metadata serialization;
- complete-line transitions (`applyTransition`);
- deterministic validator fixtures.

It performs **no I/O**: no DOM access, no Editor access, no file/localStorage/
fetch access, no Save behavior, no Workspace Index mutation.

## 5. Checkbox authority

The checkbox is authoritative over any lifecycle status:

- `[x]` ⇒ effective `done`, even if a stale `status=ongoing` or `status=backlog`
  survives in metadata.
- `[ ]` ⇒ open; the raw `status` selects among `todo` (default), `ongoing`, and
  `backlog`.

Canonical normalization therefore never lets a stale open status render a
checked task as open.

## 6. Status semantics

| Effective status | Checkbox | Source representation |
| ---------------- | -------- | --------------------- |
| `backlog`        | unchecked | `status=backlog`       |
| `todo`           | unchecked | no explicit status (default). `status=todo` is redundant and may be removed. |
| `ongoing`        | unchecked | `status=ongoing`       |
| `done`           | checked  | `completed=YYYY-MM-DD` (no `status=done`) |

- Unchecked with `status=ongoing` → `ongoing`.
- Unchecked with `status=backlog` → `backlog`.
- Unchecked with `status=todo` → `todo`.
- Unchecked with absent or unknown status → `todo` (backward compatible).
- Checked → `done` regardless of stale status.
- `status=done` is never serialized.

Todo-by-absence is the default open-state interpretation; existing Tasks without
## 7. Lifecycle dates

Canonical lifecycle fields (all `YYYY-MM-DD`):

- `opened=YYYY-MM-DD` — first date the task became known (Opened Date); recorded
  once, never silently replaced by a later date.
- `started=YYYY-MM-DD` — first date the task entered `ongoing` (Started Date);
  recorded only on first entry to Ongoing; preserved if the task later returns
  to Todo/Backlog.
- `completed=YYYY-MM-DD` — date the task entered `done` (Closed Date); recorded
  when the checkbox becomes checked; removed on reopen.

Normalized output on a task record:

- `openedDate`;
- `startedDate`;
- `completedDate`;
- `closedDate` — an alias of the validated `completedDate`.

Invalid calendar dates normalize to `null` for date consumers but are preserved
in the underlying raw metadata (never silently deleted).

## 8. Date supplied by the caller

The pure lifecycle module **never reads the clock**. It does not call `new Date`,
`Date.now`, UTC conversion, or locale date formatting.

The current local date is supplied by callers explicitly:

```js
applyTransition(line, { target: 'ongoing', today: '2026-09-01' })
```

The single application date-reading owner is `getLocalIsoDate()` in
`js/main.js`. When a transition semantically requires a date and the supplied
`today` is missing or invalid, the transition returns a validation failure and
writes nothing — it never invents a date.

## 9. Canonical serialization

Only lifecycle-owned keys (`status`, `opened`, `started`, `completed`) may be
added, updated, or removed by lifecycle serialization. Unrelated metadata
(`owner`, `priority`, `due`, `project`, custom/unknown keys) survives round-trip
unchanged in meaning.

Order behavior:

- Existing entries keep their order.
- Existing lifecycle keys are updated in place.
- Newly introduced lifecycle keys are appended deterministically.
- Non-lifecycle entries and malformed segments are preserved.

Task-line transformation preserves the bullet marker, indentation, visible task
text, unrelated trailing content, and newline ownership outside the single line.
Only the checkbox marker and lifecycle metadata may change.

## 10. applyTransition responsibility

`applyTransition(line, { target, today })` is the future Task Board transition
API. It owns the complete task line: it may change the checkbox and task-local
metadata together.

- `done` ⇒ checkbox checked; `completed` date; no `status=done`; stale open
  status removed.
- `todo` / `backlog` / `ongoing` ⇒ checkbox unchecked; canonical open-status
  representation; `completed` removed.
- Existing `opened`, `started`, `completed` values are not overwritten unless
  the transition semantically requires it (e.g. Started Date on first entry to
  Ongoing).
- A transition that produces a byte-identical line reports `changed: false`
  (idempotence under repeated application) while still allowing canonical
  cleanup on the first application, e.g. removing a redundant `status=todo`.

This function does not access the Editor, write a file, reload the Workspace
Index, trigger Save, call the clock, or update a baseline.
## 11. Future Save reconciliation responsibility

Automatic lifecycle reconciliation during physical Save belongs to **T1B**. It
is intentionally NOT in T1A.

T1B must observe the checkbox state already present in the Editor Markdown — it
must not decide that the user intended to check/uncheck a task. It will:

- detect newly inserted Tasks (append, prepend, and middle insertion) and add
  Opened Date;
- record Started Date on source-proven entry to Ongoing;
- record/remove Closed Date (`completed`) on checkbox completion/reopening;
- apply one consolidated Editor transaction;
- refresh the baseline only after a successful Save.

Sequence matching, occurrence indexing, ambiguity classification, and line-edit
assembly are T1B responsibilities. T1A exposes only the pure metadata helpers
these consumers will use.

## 12. Temporary T1A/T1B date-validator state (honest duplication)

Currently the repository has two date validators:

- `js/main.js` `isValidIsoDate()` — used by the legacy `parseMarkdownTasks` and
  physical Save completion handling;
- `js/tasks/task-lifecycle.js` `isValidIsoDate()` — used by the new lifecycle
  API. This validator is arithmetic-only (no `Date` calls).

This duplication is temporary. `js/main.js` does not yet consume
`MME_TASK_LIFECYCLE` in T1A. T1B must reconcile the duplication when
`parseMarkdownTasks` adopts the lifecycle owner. The final integrated
architecture must not leave two active lifecycle date-validation owners without
an explicit reason. The single current-date reader remains `getLocalIsoDate()`
in `main.js`.

## 13. Legacy behavior and no backfill

Existing Tasks may lack Opened/Started/status/stable identity. Policy:

- A legacy unchecked Task with no status defaults to `todo`.
- A legacy checked Task defaults to `done`; missing historical Opened Date
  remains unknown; an existing `completed` (Closed Date) remains respected.
- No mass backfill. The current physical-Save date is assigned only to Tasks
  detected as newly inserted at Save time (a T1B responsibility).
- A mass historical backfill, if ever desired, is a separate user-triggered
  maintenance command and is out of scope.

## 14. No stable ID in T1A

T1A introduces no stable Task ID and no UUID. The lifecycle owner operates on
task lines and metadata without identity. Stable identity (if required) is
deferred to the future Task Board / Save-integration work and is source-proven
only.

## 15. Future Board handoff

The Board (out of scope here) will consume the pure data contract:
`normalizeTask`, `applyTransition`, and canonical serialization. Tasks created
or moved through the Board may update immediately at the board boundary, but
the Board UI, drag-and-drop, columns, Done-period filter, and controls are
explicitly excluded.

## 16. Future Report handoff

Future Report sections will need Tasks Opened / Started / Closed during a
period, and counts of currently Ongoing / Backlog / Todo. Those consumers read
`effectiveStatus`, `openedDate`, `startedDate`, `closedDate` from the indexed
Task records. No Report section, Dictionary change, or Quick Report output
change is made by the lifecycle work.

## 17. Document-frontmatter separation

Lifecycle metadata is task-local and lives only in the task-line `mme-task`
comment. Nothing is placed in document YAML frontmatter. A Journal or Concept
may contain many Tasks with different states and dates; each Task's lifecycle
metadata remains associated with its own record. Document frontmatter and
Metadata Template visibility architecture remain separate and unmodified.

---

## Scope

**Included (T1A):** pure lifecycle owner; status vocabulary; checkbox-authoritative
normalization; date parsing/validation (arithmetic-only); canonical
serialization; `applyTransition`; deterministic validator fixtures; architecture
document; loader/precache/release integration for the new module.

**Explicitly excluded:** Board UI, drag-and-drop, Done-period filter, TaskReview
redesign, Report sections, Projects, document frontmatter, stable-ID migration,
transition history, Reopened Date, mass historical migration, physical-Save
reconciliation, Workspace Index behavior changes.
a status remain valid as Todo.