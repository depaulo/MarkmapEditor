# MarkmapEditor 1.0 — Package 5: Managed Project Architecture

## Status

- **Package 5 — MANAGED PROJECT FOUNDATION: architecture DECIDED, not implemented.**
- This document is the authoritative architecture contract for Package 5.
- No runtime implementation accompanies this record. `ACT 5A` has not begun.
- Baseline at time of writing: `development` @ `e8e7264`, `productVersion 0.6.3`,
  cache identity `markmap-journal-pwa-0.6.3-tasks-wiki-links-foundation`.
  Package 4 (Standalone Note experiment) is archived and absent from active runtime.

Decisions in this document are **owner-approved**. Items marked
**[Package 6]** or **[OPEN]** are explicitly *not* settled here.

Where this document contradicts current source, the contradiction is recorded in
§15 rather than silently resolved. Source does not override an owner decision;
ACT 5A implements the decision and the noted transition.

---

## 1. Product purpose

Projects follow the successful architectural philosophy of Tasks:

- simple visible Markdown declaration;
- important readable attributes remain visible;
- independent managed metadata comment;
- conservative Save reconciliation;
- one mutation owner;
- aggregated visual management surface.

Tasks and Projects remain **separate feature types**.

Projects do **not** share with Tasks:

- parser;
- writer;
- lifecycle;
- metadata comment (`<!-- mme-project: ... -->` is independent of `<!-- mme-task: ... -->`);
- mutation owner.

Task priority remains `#p1`, `#p2`, `#p3`. Package 5 does **not** propose `[p1]`.

**Source note.** The Task side of this is real and proven: `PRIORITY_TOKEN_RE =
/#p[123]\b/gi` (`js/tasks/task-lifecycle.js:294`), with `#project` proven to be an
*unrelated* tag that must not be read as priority
(`js/tasks/task-lifecycle.js:1803-1804`). Projects must not disturb either.

---

## 2. Visible Project declaration

### 2.1 Accepted forms

```md
Project: Alibaba

Project: Alibaba [800000 BRL]

Project: Alibaba [27Q3]

Project: Alibaba [800000 BRL] [27Q3]
```

### 2.2 What the visible declaration owns

- Project title;
- value;
- currency;
- Expected Order quarter.

These values remain visible in:

- Editor;
- Markmap;
- HTML Preview;
- Sidebar;
- Expanded Projects View;
- Reports.

### 2.3 Grammar shape

```text
Project: <title> [ <value> <currency> ] [ <quarter> ]
```

Both bracket groups are optional. When both are present the value group precedes
the quarter group. The title is required; the title is the text between
`Project:` and the first bracket.

**[OPEN — ACT 5A]** Whether the title may itself contain `[` or `]` requires a
source-validated decision. See §15.2 (conflict with Wiki Link syntax) and §15.3
(conflict with Task checkbox syntax).

---

## 3. Value and currency contract

### 3.1 Canonical form

```text
[<numeric-value> <currency-code>]
```

Examples:

```md
[800000 BRL]
[1200000 USD]
[1250000.50 USD]
```

### 3.2 Rules

- value before currency;
- whitespace between value and currency;
- period for decimal fraction;
- no thousands separators;
- uppercase currency normalization;
- zero is distinct from missing;
- malformed content remains readable Markdown;
- malformed content must not crash parsing;
- no hashtag-based money syntax.

### 3.3 Explicitly rejected as canonical

```md
#800000BRL
[800000BRL]
[1.200.000 BRL]
[1,200,000 USD]
```

Rejected input must still **render as ordinary readable Markdown**. It is not
deleted, rewritten, or treated as a parse error that aborts the document.

**Source note.** "Zero is distinct from missing" already holds today: the legacy
parser yields `value: null` for missing and `value: 0` for an explicit zero, and
Report filtering uses `Number.isFinite(p.value)` so a zero-valued Project is
counted as *with-value* (`js/report/report-dictionary.js:509-511`, fixture
`Beta` = 0). This contract preserves that behavior.

---

## 4. Quarter contract

### 4.1 Accepted inputs

```text
27Q1
2027Q1
2027-Q1
```

### 4.2 Normalized internal form

```text
2027-Q1
```

### 4.3 Compact visible form

```text
27Q1
```

### 4.4 Valid quarters

```text
Q1
Q2
Q3
Q4
```

### 4.5 Scope

The visible line contains **only** Expected Order.

Expected Delivery and Expected Billing belong to managed metadata (§5).

Package 5 does **not** introduce an exact target date.

**Source note.** This contract is already satisfied by the existing
`normalizeProjectQuarter()` (`js/workspace/workspace-parser.js:244-273`), which
accepts `^(\d{2}|\d{4})[/-]?[qQ]([1-4])$`, emits `canonical: "2027-Q1"` and
`display: "27Q1"`, and produces `{ valid: false }` rather than throwing on
malformed input. ACT 5A reuses this owner; it does not create a second quarter
normalizer.

---

## 5. Managed metadata

### 5.1 The comment

Projects use an independent managed comment:

```md
<!-- mme-project: ... -->
```

Conceptual example:

```md
Project: Alibaba [800000 BRL] [27Q3]
<!-- mme-project: id=prj_<opaque-id>; created=2026-10-03; stage=quotation; delivery=27Q4; billing=28Q1 -->
```

### 5.2 What the comment owns

- `id`;
- `created`;
- `stage`;
- `delivery` (Expected Delivery);
- `billing` (Expected Billing);
- `closed`;
- `archived`.

### 5.3 What the comment does NOT own

- Project title;
- value;
- currency;
- Expected Order;
- source path;
- source line.

Do **not** duplicate visible-line fields inside `mme-project`. Duplication would
create two authorities for one value and re-introduce precedence ambiguity.

**Source precedent.** `mme-task` uses `key=value` segments joined by `; ` inside
one comment, written by `buildTaskMetadataComment()`
(`js/tasks/task-lifecycle.js:150-169`). `mme-project` follows the same
serialization convention independently; it must not import or extend
`MME_TASK_LIFECYCLE` key ownership. Lifecycle keys are owned and appended
deterministically while non-lifecycle entries survive round-trip
(`js/tasks/task-lifecycle.js:41-46`) — the same discipline applies to `mme-project`
keys, with a separate key set.

---

## 6. Authority and precedence

Recorded order:

1. **Visible Project declaration** — title, value, currency, Expected Order.
2. **`mme-project`** — identity and managed Project properties.
3. **Temporary legacy fallback** — only while transitioning existing Project
   declarations.
4. **Ordinary Markdown** — never interpreted as managed metadata unless it
   matches an accepted Project contract.

Rules:

- Legacy fallback must **not** override the new authorities.
- No automatic migration.
- No deletion of legacy lines.
- No write-on-scan.
- No write-on-index.

**Source note.** The legacy fallback is the dictionary-pair grammar
(`Project: X` / `Value: N` / `Currency: USD` / `Order: 26Q4`, inline or
multiline, optional list markers) implemented by `parseProjects()` /
`buildProjectFromBlock()` (`js/workspace/workspace-parser.js:451-504`, `356-449`)
and normalized by `resolveProjectKeyAlias()` (`js/workspace/workspace-parser.js:209-242`).
That grammar remains valid and remains the transition path.

---

## 7. Persistent identity

Project identity is stored in `mme-project`.

Three separate concepts:

| Concept | Meaning |
| --- | --- |
| `projectId` | persistent opaque identity |
| Project title | visible display text |
| `sourcePath` / `sourceLine` | current physical location |

### 7.1 Must NOT be used as persistent identity

- title;
- slug;
- filename;
- path;
- source line;
- ordinal;
- path + ordinal.

### 7.2 Identity requirements

- exactly one ID per Project;
- ID preserved through title rename;
- ID preserved through line movement;
- ID preserved through Project reorder;
- duplicate-ID diagnostics;
- malformed-comment behavior defined;
- conservative creation during Save reconciliation (§8).

### 7.3 Serialization

A complex general UUID framework is **not** prescribed.

The exact ID serialization may be finalized by **ACT 5A** after source
validation. The conceptual shape is `prj_<opaque-id>`.

**Source note — superseded design.** The accepted Package 3 baseline computes a
provisional `sourceIdentity = ${sourcePath}::${startLine}::${nameKey}` in
`buildProjectFromBlock()` (`js/workspace/workspace-parser.js:440-446`), carrying
the comment *"Provisional sourceIdentity — NOT a permanent ID."* It is read by
no consumer and is dropped by the Report projection `projectProject()`
(`js/report/report-dictionary.js:478-492`).

Under this architecture, `sourceIdentity` is **retired** and must not be promoted
to identity: it is title-derived and line-derived, so it fails §7.1 on two counts.
ACT 5A removes it or marks it as transitional.

---

## 8. Save and reconciliation

### 8.1 Intended flow

1. user writes a Project declaration;
2. user invokes the existing Save flow;
3. Project reconciliation detects an unambiguous declaration without managed
   identity;
4. reconciliation inserts an `mme-project` comment containing `id` and `created`;
5. the existing Save owner writes the document;
6. the Workspace Index rebuilds after successful Save.

### 8.2 Rules

- one reconciliation owner;
- no second Save path;
- no mutation during scan;
- no mutation during Index build;
- no mutation merely from opening a Workspace;
- ambiguous declarations remain unchanged;
- malformed comments do **not** receive a competing comment;
- a failed or cancelled Save does not claim successful reconciliation;
- ordinary Markdown remains preserved.

### 8.3 Source precedent to follow exactly

The Task lifecycle already implements this shape and is the model:

- pure owner `applySaveLifecycle()` in `js/tasks/task-lifecycle.js:905+`;
- orchestration `reconcileTasksBeforeSave()` in `js/main.js:10520+`;
- single Save entry `saveSmart()` calls reconciliation **once**, before writing
  (`js/main.js:10902-10930`);
- Report documents excluded from reconciliation **by identity**, returning
  `skippedReason: 'report-document'` (`js/main.js:10525-10536`);
- guarded by an explicit baseline and owner-availability check, each returning a
  skip reason rather than writing;
- buffer update guarded by `__programmaticTextChange` so programmatic edits are
  not mistaken for user typing.

Project reconciliation follows the same contract with a **separate owner and a
separate skip-reason vocabulary**. It must not reuse `MME_TASK_LIFECYCLE` and
must not add a second `createWritable()` call site.

---

## 9. Sidebar

The Sidebar remains **read-only** initially.

Target compact projection:

```text
Project title
[value and currency pill] [Expected Order pill]
source file and line
```

Preserve:

- grouping by Expected Order **year**;
- the `Unscheduled` group;
- source navigation.

No initial Sidebar editing.

Future quick editing of value or Expected Order must reuse **the same mutation
owner** as the Expanded Projects View (§10).

**Source note.** Grouping is already by year in
`renderWorkspaceProjectsPanel()` (`js/main.js:3262`, `String(order.year)`), and
`Unscheduled` collects Projects without a valid `expectedOrder`
(`js/main.js:3261-3269`). Preserve both. The
`MarkmapEditor_Projects_Discovery_MVP_PLAN.md` wording "grouped by expected-order
**quarter**" is stale relative to source and to contextual Help; source is
authoritative for this document.

---

## 10. Expanded Projects View

The Expanded Projects View is the primary Project-management surface.

### 10.1 Target columns

- Project;
- Stage;
- Value;
- Currency;
- Order;
- Delivery;
- Billing;
- Created;
- Closed;
- Archive;
- Source.

### 10.2 Control direction

| Column | Direction |
| --- | --- |
| Project name | displayed and linked to source; initially edited in Markdown |
| Stage | dropdown **after vocabulary approval** |
| Value | numeric input |
| Currency | selector |
| Order, Delivery, Billing | normalized quarter selectors |
| Created | generated, read-only |
| Closed | managed date or Project-closing workflow |
| Archive | explicit action; **no Delete** |
| Source | file and line navigation |

All edits must use **one Project mutation owner**.

### 10.3 Prohibited writers

No direct writer inside:

- Sidebar;
- Workspace Index;
- Reports;
- individual table columns.

**Scope note.** Package 5 includes a *minimal* Expanded View sufficient to
validate metadata editing (§14). The complete view is **[Package 6]**.

---

## 11. Open / closed / stage distinction

Three concepts are kept separate and are **not** conflated:

| Key | Meaning |
| --- | --- |
| `stage` | commercial or operational stage |
| `closed` | closure date |
| `archived` | Project-level archive flag |

Potential commercial stages include existing concepts such as:

- Lead;
- Proposal;
- Quotation.

**The final stage vocabulary still requires product review [OPEN].**

`active` / `on-hold` / `done` are **not** imposed in this documentation. The
Project open/closed state is expressed by `closed` and `archived`, not by a
lifecycle status enum.

**Source note.** Current `status` is unvalidated free text
(`js/workspace/workspace-parser.js:408-411`); fixtures use `Quotation`,
`Proposal`, `Lead` (`js/report/report-dictionary.js:677-680`). The managed key
here is named `stage`, so ACT 5A must map legacy `Status:`/`stage:` input onto
`mme-project: stage=` **without deleting the user's legacy line** (§6).

---

## 12. Task boundary

Task syntax remains unchanged:

```md
- [ ] Task text #p1
<!-- mme-task: ... -->
```

- Do **not** change `#p1` to `[p1]`.
- Task-to-Project association is **not** implemented in Package 5.
- Do **not** use path, title, or ordinal for Task association.

Future association may use:

```md
<!-- mme-task: project=<projectId> -->
```

only after a stable `projectId` **and** the managed Project writer are accepted.

**Source note.** `project` is already a preserved non-lifecycle `mme-task` key
that must survive round-trip unchanged in meaning
(`js/tasks/task-lifecycle.js:41-42`). Package 5 does not change that behavior; it
only declines to give the key authority.

---

## 13. Report and Index contract

The Workspace Index remains a **read model**. Reports consume normalized Project
records from the Index.

Package 5 transition must preserve:

- Project Forecast;
- Forecast Totals;
- value filtering;
- zero versus missing value;
- currencies;
- Expected Order;
- Expected Delivery;
- Expected Billing;
- generated Report Markdown shape, until an explicit change is accepted.

**Draw.io has no direct Project-data dependency and remains untouched.**

**Source note.** Reports read `indexState.projects` only, via
`selectProjects()` (`js/report/report-dictionary.js:495-523`); no Report consumer
re-parses files. `js/report/drawio-report-reconciler.js` contains **zero**
Project references, and the only "project" strings in `drawio-report-panel.js` are
the Report field name `'project forecast'`. Draw.io reconciliation is therefore
not a Package 5 transition surface.

---

## 14. Package boundary

### PACKAGE 5 — MANAGED PROJECT FOUNDATION

Includes:

- visible declaration grammar;
- `mme-project` schema;
- Project ID;
- conservative reconciliation;
- single mutation-owner architecture;
- parser and Index transition;
- Report compatibility;
- minimal Expanded View sufficient to validate metadata editing;
- no broad redesign.

### PACKAGE 6 — PROJECT EXPERIENCE

Includes candidates such as:

- complete Expanded Projects View;
- richer filters;
- finalized stage vocabulary;
- close workflow;
- **[Package 6 list as transmitted was truncated in the owner instruction — the
  remaining candidates are not recorded here and must be confirmed before
  Package 6 planning.]**

---

## 15. Source conflicts recorded for ACT 5A

These are contradictions between this architecture and the accepted 0.6.3
runtime. They are recorded, not resolved. Each is a transition obligation.

### 15.1 Value parsing currently accepts thousands separators

`parseProjectValue()` strips unambiguous thousands separators
(`/^\d{1,3}(,\d{3})+(\.\d+)?$/`, `js/workspace/workspace-parser.js:284-288`), so
legacy `Value: 1,200,000` **is currently accepted**.

§3.3 rejects `[1,200,000 USD]` as canonical. These are **not** the same path:
the bracket form must reject separators while the legacy fallback keeps
accepting them. ACT 5A must implement both behaviors deliberately and must not
silently change legacy Report output.

### 15.2 Brackets collide with Wiki Link syntax

`[[Wiki Link]]` is the accepted Package 3 Wiki Link form
(`js/links/wiki-link-grammar.js`). A single `[` starts neither a Task checkbox
nor a Wiki Link, but the parser must tokenize `[[...]]` before Project brackets
so a Project immediately adjacent to a Wiki Link cannot be mis-tokenized.
See §2.3 **[OPEN]**.

### 15.3 Brackets collide with Task checkbox syntax

Task lines use `[ ]` / `[x]`
(`/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/`, `js/main.js:686`). A Project
declaration is not a Task line, but a line such as
`- [ ] Ship Alibaba [800000 BRL]` must still parse as a Task whose text carries a
Project bracket. ACT 5A must not make Project parsing consume task lines.

### 15.4 Title-driven identity must be removed

`sourceIdentity` (`js/workspace/workspace-parser.js:440-446`) is title- and
line-derived and is retired per §7.3. Report projection `projectProject()` must
gain `projectId` rather than continuing to key Report rows by `name`
(`js/report/report-dictionary.js:479`).

### 15.5 Two divergent currency/sort implementations exist

- Currency: `buildProjectTotals()` uppercases
  (`js/workspace/workspace-index-document.js:101`), while
  `calculateProjectTotals()` does not (`js/report/report-dictionary.js:530`).
- Sort: `buildWorkspaceIndex()` has a `sourcePath` tiebreaker
  (`js/main.js:1157-1160`); `renderWorkspaceProjectsPanel()` does not
  (`js/main.js:3292-3295`).

ACT 5A must converge these rather than add a third implementation, and the
convergence must be validator-covered because Report totals can change for
lowercase-currency input.

### 15.6 Archived Notes still contribute Projects

`buildWorkspaceIndex()` never checks `parsed.archived`
(`js/main.js:1095-1132`); only the Notes / Pinned / Knowledge panels filter
archived Notes (`js/main.js:5984`). Today a Project inside an archived Note is
still indexed and still reaches Reports. Adding a Project-level `archived` flag
(§11) must not be confused with the Note-level Archive flag. **[OPEN]** — the
visibility rule for Projects inside archived Notes is a product decision not
settled by this document.

### 15.7 A new writer is introduced

Unlike the read-only Package 5 assessed in the pre-decision review, this
architecture **requires** a mutation owner (§8, §10). It must be exactly one
owner, integrated into the existing `saveSmart()` path, and must not add a
second `createWritable()` call site.

### 15.8 Validator guard interaction

`scripts/workspace-lifecycle-output-validators.cjs` contains a check asserting
that `workspace-parser.js` does **not** contain a line matching `/^## Project:/m`.
The accepted grammar is `Project:` at line start, not `## Project:`, so the guard
is not violated by this design; ACT 5A must nonetheless re-verify it and convert
it to a behavioral check rather than a source-string check.

---

## 16. Non-negotiable invariants

1. Markdown stays canonical; managed metadata is an independent HTML comment that
   other Markdown readers ignore.
2. Visible declaration fields are never duplicated into `mme-project`.
3. Exactly one Project mutation owner; no writer inside Sidebar, Workspace Index,
   Reports, or individual columns.
4. No write-on-scan, no write-on-index, no mutation on Workspace open.
5. Malformed or ambiguous input leaves user Markdown intact and readable.
6. The Workspace Index remains a read model.
7. Tasks and Projects remain separate feature types with separate parsers,
   writers, lifecycles, comments, and mutation owners.
8. Task priority remains `#p1` / `#p2` / `#p3`.
9. Archive is preferred over destructive deletion; no Delete action.
10. Reports and Draw.io behavior is preserved until an explicit accepted change.

---

## 17. Decision register

| # | Decision | State |
| --- | --- | --- |
| D1 | Visible declaration owns title/value/currency/Expected Order | Accepted |
| D2 | `[<value> <currency>]` bracket contract; no hashtag money | Accepted |
| D3 | `27Q1` / `2027Q1` / `2027-Q1` accepted; canonical `2027-Q1` | Accepted |
| D4 | `mme-project` owns id/created/stage/delivery/billing/closed/archived | Accepted |
| D5 | Precedence: visible > managed > legacy fallback > ordinary Markdown | Accepted |
| D6 | Identity persisted in `mme-project`; title/path/line/ordinal excluded | Accepted |
| D7 | Save-time conservative reconciliation inserting `id` + `created` | Accepted |
| D8 | Sidebar read-only; year grouping and Unscheduled preserved | Accepted |
| D9 | Expanded View is primary surface; single mutation owner | Accepted |
| D10 | `stage` / `closed` / `archived` kept separate; no `active`/`on-hold`/`done` | Accepted |
| D11 | Task association deferred out of Package 5; `#p1` unchanged | Accepted |
| D12 | Index stays a read model; Report Markdown shape preserved; Draw.io untouched | Accepted |
| D13 | Final stage vocabulary | **[OPEN]** |
| D14 | Projects inside archived Notes | **[OPEN]** — §15.6 |
| D15 | Title containing brackets | **[OPEN]** — §2.3, §15.2 |
| D16 | Exact `projectId` serialization | Deferred to ACT 5A — §7.3 |
| D17 | Package 6 candidate list beyond "close workflow" | **[OPEN]** — §14 |

---

## 18. Relationship to existing documents

- `MarkmapEditor_Projects_Discovery_MVP_PLAN.md` remains the record of the
  read-only Discovery MVP that shipped in the accepted baseline. Its
  quarter-grouping wording and `journals/`/`concepts/` examples are **stale**
  relative to the current `notes/`-only scanner; this document supersedes it for
  all Package 5 decisions.
- `MarkmapEditor_Task_Lifecycle_ARCHITECTURE.md` remains authoritative for Tasks.
  It is referenced here for **pattern** only; Tasks are not modified by Package 5.
- `MarkmapEditor_1.0_PRODUCT_ARCHITECTURE_AND_IMPLEMENTATION_PROGRAM.md` §11
  describes Package 5 as normalizing an "accepted managed model". No managed
  model existed at that time; this document supplies it.

---

## 19. Closure

Package 5 architecture is recorded. Implementation begins with **ACT 5A**, which
must resolve **[OPEN]** items D13–D15 before parser work, and must carry the
§15 transition obligations into focused validators.

No runtime source, CSS, HTML, validator, Help, Release Notes, `productVersion`,
`APP_VERSION`, or Service Worker was modified to produce this record.
