# MarkmapEditor Task Lifecycle Architecture

## Status
- **T1A — core lifecycle:** implemented.
- **T1B — physical-Save integration:** implemented.

This document describes the Task lifecycle owner and its data contract. It is
the lifecycle companion to the existing
`docs/architecture/MarkmapEditor_Quick_Report_and_task_Metadata_MVP_PLAN.md`,
which remains the authority for the `mme-task` metadata comment grammar and the
legacy `completed` date behavior.

> **Important:** T1B is now active. Automatic Opened/Started/Closed date writing
> happens **only during physical Save** (via `reconcileTasksBeforeSave`), never
> during typing or draft Auto-save. The lifecycle owner remains pure — all
> I/O, Save, and Workspace Index mutation live in `js/main.js`. Report documents
> are excluded from Task reconciliation by identity.

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
## 11. Save reconciliation responsibility (T1B, implemented)

Automatic lifecycle reconciliation during physical Save is implemented in T1B
(`js/main.js` `reconcileTasksBeforeSave`). It observes the checkbox state already
present in the Editor Markdown — it never decides that the user intended to
check/uncheck a task. It:

- aligns current Tasks to the pre-Save baseline via `matchTasksForSave`
  (reorder-safe, text-identity matching);
- records/removes Closed Date (`completed`) on checkbox completion/reopening via
  `applySaveLifecycle` (checkbox-authoritative; one consolidated Editor
  transaction);
- refreshes the baseline only after a successful physical Save.

Report documents are excluded from reconciliation by identity. Sequence matching,
occurrence indexing, ambiguity classification, and line-edit assembly live in the
pure lifecycle owner; the glue lives in `js/main.js`.

## 12. Date-validator consolidation (resolved)

The temporary T1A/T1B date-validator duplication is resolved. After T1B,
`js/main.js` no longer declares `isValidIsoDate()` / `isLeapYear()` — the only
active lifecycle date validation is the pure arithmetic-only
`MME_TASK_LIFECYCLE.isValidIsoDate()`. The single application-local date reader
remains `main.js getLocalIsoDate()`, which always supplies `today` to the
lifecycle APIs.

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

**Included (T1B, in addition to T1A):** parser lifecycle enrichment
(`parseMarkdownTasks` adopts `MME_TASK_LIFECYCLE.normalizeTask`, adding
`status`, `effectiveStatus`, `openedDate`, `startedDate`, `closedDate` while
retaining every source-compatible field); physical-Save lifecycle reconciliation
in `js/main.js` (`reconcileTasksBeforeSave`); deterministic occurrence-aware
sequence matcher (`matchTasksForSave`); pure save-lifecycle metadata writer
(`applySaveLifecycle`) used by the reconcile pass; one consolidated CodeMirror
transaction; concise aggregate TaskReconcile metrics log; baseline lifecycle
(capture after document open; refresh only after successful physical Save; never
on draft Auto-save or failed Save; excluded for virtual Report documents); date-validator
consolidation (legacy `main.js` `isValidIsoDate`/`isLeapYear` removed in favor of
the pure lifecycle owner, `getLocalIsoDate` retained as the single date reader);
release cache identity bump in `sw.js`.

**Explicitly excluded:** Board UI, drag-and-drop, Done-period filter, TaskReview
redesign, Report sections, Projects, document frontmatter, stable-ID migration,
transition history, Reopened Date, mass historical migration.

---

## 18. T1B implementation (physical-Save integration)

T1B wires the pure lifecycle owner (`js/tasks/task-lifecycle.js`, global
`MME_TASK_LIFECYCLE`) into the existing parser and physical-Save reconciliation
in `js/main.js`. It adds no new UI and changes no Report output.

### 18.1 Parser enrichment

`parseMarkdownTasks()` retains every existing field and, when the lifecycle owner
is available, folds the normalized record back via `Object.assign(task,
lifecycle.normalizeTask(task))`. This adds `status`, `effectiveStatus`,
`openedDate`, `startedDate`, `closedDate` (where `closedDate` equals the validated
`completedDate`). A checked Task is always effectively `done`; an unchecked
Task is `backlog` / `ongoing` / `todo` by its status, defaulting to `todo` for
absent or unknown status. Unknown raw status and unknown metadata remain
preserved. Parsing never writes metadata; it is a pure read of source. A legacy
fallback (`task.done && isValidIsoDate(meta.completed)`) remains only for the
case where the lifecycle owner is unexpectedly absent.

### 18.2 Validator consolidation

The legacy `js/main.js` `isValidIsoDate()` / `isLeapYear()` helpers are removed:
after enrichment the only active lifecycle date validation is
`MME_TASK_LIFECYCLE.isValidIsoDate()` (arithmetic-only, no `Date` calls). The
single application-local date reader remains `main.js getLocalIsoDate()`, which
always supplies `today` to the pure lifecycle APIs — the lifecycle owner never
reads the clock.

### 18.3 Sequence matcher (`matchTasksForSave`)

`MME_TASK_LIFECYCLE.matchTasksForSave(baseline, current)` is a small, deterministic,
occurrence-aware matcher built on canonical clean text and an ordered LCS
alignment. Its job is to PROVE only the insertion of uniquely identifiable Tasks
(same visible text that did not exist in the baseline); everything else is
classified ambiguous and never auto-tagged.

The matcher classifies regions between matched anchors:

- pure insertion region (unmatched current, no baseline deletions) whose visible
  text does not already exist in the baseline, and whose text does not already
  appear in the baseline, is a **source-proven new** candidate;
- pure insertion of a duplicated label (identical text already present in the
  baseline) is **ambiguous** because, without a stable Task ID, positional proof
  is impossible;
- deletion-only, edit/replace, or mixed counts are **ambiguous**, and no lifecycle
  rewrite is applied;
- an inserted count above the per-gap / whole-document cap flips `skippedRewrite`,
  so automatic new-tagging is skipped while safely matched completion/reopening
  still applies.

A moved existing Task is intentionally ambiguous for *new-tagging* (it must not
receive a spurious Opened Date). For checkbox-change detection it is handled by
the aligned matched pairs (text identity, not line number). The `newIndices`
array is intentionally unused by the Save-reconcile pass (which only processes
matched pairs); it exists for future Board/consumer use. The safety cap values
are narrow by design (per-gap 8, total-insert 20, total-new 16).

### 18.4 Save-lifecycle writer (`applySaveLifecycle`)

`applySaveLifecycle(rawLine, { today, isNew, checked, explicitStatus })` edits
ONLY the task-local `mme-task` comment during physical-Save reconciliation. It
never rewrites the checkbox marker and preserves every non-lifecycle key and
unknown raw status. Date fields follow "add only if absent", so valid hand-written
dates and invalid raw values are never silently overwritten or deleted; invalid
raw values normalize to `null` on the derived date fields. Returns
`{ ok, changed, line, added, removed }`.

### 18.5 Physical-Save reconcile (`reconcileTasksBeforeSave`)

The existing `js/main.js` `reconcileTasksBeforeSave()` is extended to delegate to
the lifecycle owner. Required ordering (one local lines array, one join, one
`__cmSetText`):

1. read current Markdown;
2. parse current Tasks;
3. align current Tasks against the baseline (`matchTasksForSave`);
4. for each matched pair where the current checkbox disagrees with the baseline,
   apply `applySaveLifecycle` (checkbox-authoritative);
5. return one reconciled text;
6. `__cmSetText` once if changed (inside `__programmaticTextChange`);
7. continue through the existing physical Save;
8. refresh the baseline only after a successful write.

Report documents are excluded (`skippedReason: 'report-document'`); a missing
baseline or no Tasks also short-circuits with a `skippedReason` (no metadata is
reported as persisted). A `skippedReason` does not block the Save itself.

### 18.6 New-Task contract (physical Save)

A source-proven new Task receives Opened Date during physical Save (via the
reconcile pass), never during typing or draft Auto-save:

- new Todo: `opened=today`; no status; no started; no completed;
- new Backlog: `opened=today`; `status=backlog` preserved; no started unless
  already valid;
- new Ongoing: `opened=today`; `status=ongoing` preserved; `started=today` if
  absent;
- new Done: `opened=today`; `completed=today` if absent; never `status=done`;
  stale recognized open status removed during canonical editing.

### 18.7 Completion and reopening

- Open to Done: add `completed=today` if missing; preserve existing `opened` /
  started; remove a recognized stale open status (`backlog`/`ongoing`/`todo`)
  only when canonically editing; never write `status=done`.
- Done to Open: remove `completed`; preserve `opened` / `started`; keep an explicit
  `status=backlog` or `status=ongoing`; reopen to Ongoing with missing started
  adds `started=today`; absent/unknown status is effectively `todo`.
- No Reopened Date; no transition-history log.

### 18.8 Legacy / no-backfill policy

Existing Tasks without `opened` stay without `opened` unless a source-proven
transition requires another edit. Completing a legacy Task adds `completed=today`
but does NOT invent `opened`. Existing checked Tasks without `completed` remain
`done` with unknown close date unless they newly transition in the active
session. Existing invalid dates normalize to `null`; raw metadata is preserved.
No Workspace scan or mass file update.

### 18.9 Duplicate-task limitation (honest)

Visible-text identity with no stable ID cannot prove which occurrence of an
identical label is new after insertion, movement, or edit. The matcher therefore
treats ambiguous duplicate regions conservatively: it preserves source, increments
`ambiguous`, and never rewrites the region by occurrence number. Stable Task
identity remains deferred to the future Board package. The architecture does NOT
claim that ambiguous identical duplicates receive an Opened Date.

### 18.10 Baseline lifecycle

- **Physical-open capture:** baseline captured after document content becomes
  authoritative (post open, post draft-restore) for every normal open path
  (`openTextDocument`, `openFromRecent`, `openSmart`, `newDocument`).
- **Virtual Report:** baseline is never created or used (`__taskBaseline = null`).
- **Draft Auto-save:** baseline is not refreshed.
- **Failed Save:** baseline is NOT refreshed (the next Save retries safely and
  idempotently).
- **Successful Save:** baseline refreshed via `captureTaskBaseline()`.
- **Persistence:** in-memory only; never persisted to `localStorage`.

### 18.11 Transition terminology

The lifecycle vocabulary uses 12 directional transitions across the 4 statuses
(backlog, todo, ongoing, done) with same-state idempotence, serialized
canonically by `buildTaskMetadataComment`.

### 18.12 Consumers

- **Workspace Index:** enriched fields flow through the existing object spreads
  (`...task`); `open`/`done` counts unchanged (`!done` / `done`); Backlog/Todo/Ongoing
  all remain open. No index rendering change.
- **TaskReview:** current open/done view unchanged; `done` filter unchanged.
- **Report:** completed-task output remains based on `done`/`completedDate`;
  byte-compatible for identical source data; no new lifecycle sections.
- **Journals / Concepts:** lifecycle metadata is task-local only.
- **Standalone Editor:** without a valid physical-document baseline, reconcile
  short-circuits (`no-baseline`); no guessing.
