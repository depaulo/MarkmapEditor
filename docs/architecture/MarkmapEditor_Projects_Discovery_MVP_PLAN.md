# MarkmapEditor Projects Discovery MVP

## Architecture and Implementation Handoff

**Purpose:** Add a minimal Markdown-native Projects workflow that follows the existing MarkmapEditor architecture used by Tasks, Tags, Relationships, the Journal sidebar, and the Full Workspace Index.

**Primary product rule:** A Project is valid when it has a name. Every other field is optional.

**Primary user outcome:** Write one simple Project declaration in any indexed Journal or Concept file, then automatically receive:

- a Project entry in the shared Workspace Index;
- a compact sidebar Projects panel grouped by expected-order quarter;
- an expanded, presentable Projects Register;
- totals by currency;
- simple value and period filters;
- source-file navigation.

This MVP does **not** create a full Project Manager, a `projects/` folder, standalone Project files, Tasks integration, Reports integration, Gantt, subtasks, or synchronization.

---

# 1. Product philosophy

MarkmapEditor should accept simple Markdown once and produce an organized, presentable result with minimal manual work.

Projects follows the same pattern as Tasks:

```text
Markdown declaration in a normal file
        ↓
Workspace parser
        ↓
Shared Workspace Index state
        ↓
Compact Journal sidebar projection
        ↓
Expanded read-only Projects Register
```

The source Markdown remains authoritative in this MVP.

The application must not require a dedicated Project file, Project folder, separate database, or rich editor.

---

# 2. Architectural fit with the current repository

The current repository uses these established layers:

```text
workspace-parser.js
    Parses one Markdown document into normalized metadata.

workspace-scanner.js
    Discovers physical Markdown files. It should not contain Project parsing.

WORKSPACE_STATE
    Owns the physical workspace, folder handles, files, and active physical file.

WORKSPACE_INDEX_STATE
    Owns the aggregated read model for files, tags, tasks, links, and future Projects.

buildWorkspaceIndex() in main.js
    Parses indexed files, aggregates normalized data, updates WORKSPACE_INDEX_STATE,
    refreshes panels, and dispatches mme-workspace-index-ready.

Journal sidebar panels in main.js
    Follow ensure → render → wire patterns, delegated/idempotent behavior,
    persisted collapse state, and canonical ordering.

workspace-index-document.js
    Generates the deterministic Full Workspace Index HTML projection.
    It consumes state but must not scan files or mutate index state.

workspace-index-workspace.js
    Owns the virtual read-only Full Index workspace, Return, refresh,
    activation/deactivation, and physical source opening.

workspace-controller.js / openWorkspaceFile()
    Own physical file opening, dirty-state safety, navigation-history integration,
    active-file updates, and source navigation.

workspace-host.js
    Owns workspace lifecycle only. Projects Discovery does not add a new Host
    workspace in this MVP.

script-loader.js / sw.js
    Own module loading and static cache generation.
```

Projects must extend these existing owners rather than duplicate them.

---

# 3. MVP boundaries

## Included

- Project declarations in indexed Journals and Concepts.
- Project name as the only required value.
- Inline dictionary pairs.
- Multiline dictionary pairs.
- Optional Markdown list markers.
- Comma and semicolon separators for inline pairs.
- Quarter normalization.
- Known field aliases.
- Unknown field preservation in `extraFields`.
- `WORKSPACE_INDEX_STATE.projects`.
- Compact sidebar Projects panel.
- Sidebar grouping by expected-order quarter.
- `Unscheduled` group.
- Expanded Projects section/register in the Full Workspace Index.
- All / With Value / Without Value filters.
- Year and quarter filters.
- Totals grouped by currency.
- Source-file opening through the existing physical opener.
- Responsive presentation consistent with the current Index.

## Explicitly excluded

- `projects/` folder.
- Standalone Project files.
- Project IDs written into Markdown.
- Project editing from the sidebar or Full Index.
- Project enrichment workflow.
- Project Workspace Host registration.
- Top-bar Projects workflow.
- Project archive workflow.
- Tasks inside Projects.
- Project/task synchronization.
- Subtasks.
- Milestones.
- Gantt.
- Probability calculations.
- Currency conversion.
- Reports integration.
- Groups integration.
- Configurable schemas.
- Migration of existing documents.

---

# 4. Markdown declaration contract

## 4.1 Minimal valid Project

```md
Project: ByteDance CCTV
```

Only the Project name is required.

These are also valid Projects:

```md
Project: Internal workflow improvement
```

```md
Project: Customer opportunity, Status: Lead
```

A declaration with no name is not indexed:

```md
Project:
```

No error dialog is required. The parser may expose a non-blocking diagnostic.

## 4.2 Compact inline form

```md
Project: ByteDance CCTV, Value: 50000, Currency: USD, Order: 26Q4, Delivery: 27Q1, Billing: 27Q1
```

Semicolons are equivalent separators:

```md
Project: ByteDance CCTV; Value: 50000; Currency: USD; Order: 2026-Q4
```

## 4.3 Multiline form

```md
Project: ByteDance CCTV
Value: 50000
Currency: USD
Order: 26Q4
Delivery: 27Q1
Billing: 27Q1
Description: CCTV opportunity for the new facility.
```

## 4.4 Markdown-list form

```md
Project: ByteDance CCTV

- Value: 50000
- Currency: USD
- Order: 2026/Q4
- Delivery: 2027-Q1
- Billing: 27Q1
- Description: CCTV opportunity for the new facility.
```

Bullets are optional. Accepted list prefixes for field lines may include:

```text
-
*
+
```

## 4.5 Multiple Projects in one file

```md
## Commercial opportunities

Project: ByteDance CCTV
Value: 50000
Currency: USD
Order: 26Q4

Project: Alibaba Expansion
Value: 80000
Currency: USD
Order: 26Q3

## Meeting notes

The customer requested an updated quotation.
```

This produces two Project records.

---

# 5. Project block boundaries

A Project starts only when a parsed dictionary key normalizes exactly to:

```text
project
```

The Project name is the value of that pair.

A Project block continues across blank lines.

A Project block ends at the first of:

1. another valid `Project:` declaration;
2. a Markdown heading after the Project declaration;
3. end of document.

A heading before the Project declaration does not matter.

Do not create a Project from `Name:` alone.

Do not treat ordinary prose containing the word “project” as a declaration.

---

# 6. Pair parsing rules

## 6.1 Core grammar

```text
Key: Value
```

Accepted pair separators:

- new line;
- comma followed by another key and colon;
- semicolon followed by another key and colon.

Do not use arbitrary whitespace as a pair separator.

This must not be parsed as separate fields solely because of spaces:

```md
Project: ByteDance CCTV Value: 50000 Currency: USD
```

## 6.2 Commas inside values

Split a comma only when lookahead proves that another dictionary pair begins.

Example:

```md
Project: ByteDance CCTV, Description: CCTV, access control, and monitoring, Value: 50000
```

Expected result:

```text
Project = ByteDance CCTV
Description = CCTV, access control, and monitoring
Value = 50000
```

Semicolon remains the recommended separator when values contain many commas.

## 6.3 Key normalization

Normalize keys before alias resolution:

- trim;
- lowercase;
- replace underscores and hyphens with spaces;
- collapse repeated whitespace;
- remove optional Markdown list prefix before extraction.

Examples that normalize together:

```text
Expected Order
expected_order
expected-order
expected   order
```

---

# 7. Known vocabulary and aliases

Only `Project:` starts a Project.

## Name

```text
project
project name
```

The value of the starting `Project:` pair is canonical `name`.

A later `Name:` pair may update the name only inside an already-started Project block. It must not start a new Project.

## Value

```text
value
amount
quotation value
quote value
```

Canonical field:

```text
value
```

## Currency

```text
currency
curr
```

Canonical field:

```text
currency
```

Normalize display/storage value to uppercase when non-empty.

## Expected order

```text
order
expected order
order date
expected order date
```

Canonical field:

```text
expectedOrder
```

## Expected delivery

```text
delivery
expected delivery
delivery date
expected delivery date
```

Canonical field:

```text
expectedDelivery
```

## Expected billing

```text
billing
expected billing
billing date
expected billing date
invoice
expected invoice
```

Canonical field:

```text
expectedBilling
```

## Status

```text
status
stage
```

Canonical field:

```text
status
```

Do not enforce a fixed status vocabulary in the parser MVP. Preserve normalized display text.

## Description

```text
description
desc
details
```

Canonical field:

```text
description
```

## Unknown fields

Preserve unknown dictionary pairs under:

```text
extraFields
```

Example:

```md
Project: ByteDance CCTV
Customer: ByteDance
Country: Brazil
Probability: 70
```

Expected:

```js
extraFields: {
  customer: "ByteDance",
  country: "Brazil",
  probability: "70"
}
```

Unknown keys must not break parsing or require parser changes.

---

# 8. Quarter normalization

## 8.1 Accepted forms

Two-digit year:

```text
26Q1
26/Q1
26-Q1
26q1
26/q1
26-q1
```

Four-digit year:

```text
2026Q1
2026/Q1
2026-Q1
2026q1
2026/q1
2026-q1
```

The same applies to Q2, Q3, and Q4.

## 8.2 Canonical internal representation

Normalize all accepted values to:

```text
YYYY-QN
```

Examples:

```text
26Q1      → 2026-Q1
26/Q2     → 2026-Q2
26-Q3     → 2026-Q3
2026Q4    → 2026-Q4
2027/Q1   → 2027-Q1
```

## 8.3 Display representation

Default compact display:

```text
YYQN
```

Examples:

```text
2026-Q1 → 26Q1
2027-Q4 → 27Q4
```

## 8.4 Two-digit year expansion

For the MVP, use a deterministic fixed rule:

```text
00–99 → 2000–2099
```

Do not use a moving-century window.

## 8.5 Invalid values

Invalid values do not invalidate the Project.

Examples:

```text
26Q5
2026-Q0
Q3
26-3
```

Recommended behavior:

- keep the raw value in the relevant field diagnostic/raw metadata if useful;
- normalized quarter becomes `null`;
- Project appears in `Unscheduled` for expected-order grouping unless another valid order value exists;
- no blocking error.

## 8.6 Shared helper contract

Add a small reusable parser helper conceptually equivalent to:

```js
normalizeProjectQuarter(value)
```

Return shape:

```js
{
  raw: "26/Q1",
  canonical: "2026-Q1",
  display: "26Q1",
  year: 2026,
  quarter: 1,
  valid: true
}
```

Invalid return:

```js
{
  raw: "26Q5",
  canonical: null,
  display: "26Q5",
  year: null,
  quarter: null,
  valid: false
}
```

---

# 9. Normalized Project record

The parser should return a Project object conceptually shaped as:

```js
{
  name: "ByteDance CCTV",

  value: 50000,
  valueRaw: "50000",
  currency: "USD",
  status: "Quotation",

  expectedOrder: {
    raw: "26Q4",
    canonical: "2026-Q4",
    display: "26Q4",
    year: 2026,
    quarter: 4,
    valid: true
  },

  expectedDelivery: {
    raw: "27Q1",
    canonical: "2027-Q1",
    display: "27Q1",
    year: 2027,
    quarter: 1,
    valid: true
  },

  expectedBilling: {
    raw: "27Q1",
    canonical: "2027-Q1",
    display: "27Q1",
    year: 2027,
    quarter: 1,
    valid: true
  },

  description: "CCTV opportunity for the new facility.",

  extraFields: {},

  sourcePath: "journals/2026-08-03.md",
  sourceKind: "journals",
  sourceName: "2026-08-03.md",
  sourceLine: 12,

  sourceIdentity: "journals/2026-08-03.md::12::bytedance-cctv"
}
```

## Value rules

- Value is optional.
- Currency is optional.
- Value without currency remains valid.
- Currency without value remains valid.
- Zero is a valid value.
- Missing value must remain distinguishable from zero.
- Do not perform currency conversion.
- Do not infer currency.

Recommended numeric parsing:

- trim;
- remove ordinary thousands separators only when unambiguous;
- prefer simple integer/decimal formats for MVP;
- preserve `valueRaw`;
- if numeric normalization fails, set `value` to `null` and preserve raw text.

Avoid complex locale guessing in MVP.

---

# 10. Parser module integration

## Preferred owner

Extend:

```text
js/workspace/workspace-parser.js
```

Do not create Project parsing in:

- workspace scanner;
- sidebar renderer;
- Full Index document;
- Workspace Host;
- task-review.

## Suggested parser helpers

Use repository naming conventions, but conceptually provide:

```js
normalizeProjectKey(rawKey)
resolveProjectKeyAlias(normalizedKey)
normalizeProjectQuarter(rawValue)
parseProjectValue(rawValue)
parseDictionaryPairs(text)
parseProjects(markdownText, context)
```

## `parseWorkspaceDocument()` extension

Existing normalized document output should gain:

```js
projects: []
```

Each parsed file returns its local Project records.

Do not mutate global state inside the parser.

## Public API

If the parser currently exposes a global API, add Project helpers through the same owner rather than creating a second global namespace.

Preferred shape:

```js
globalThis.WORKSPACE_PARSER.parseProjects
globalThis.WORKSPACE_PARSER.normalizeProjectQuarter
```

Adapt to the actual parser export style found in source.

---

# 11. Workspace Index integration

## State extension

Extend the existing global index state with:

```js
WORKSPACE_INDEX_STATE.projects = []
```

Do not create a second Project index.

Do not create a second scanner.

## Index build

During the existing `buildWorkspaceIndex()` pass:

1. parse each indexed file once;
2. read `parsed.projects`;
3. enrich each Project with source file context if that context is not already provided by the parser;
4. append to `WORKSPACE_INDEX_STATE.projects`;
5. sort deterministically;
6. include Project count in the concise Index build summary;
7. dispatch the existing `mme-workspace-index-ready` event as usual.

Do not add a separate Project-ready event in the MVP unless source proves it is necessary.

## Default Project sort

Recommended deterministic ordering:

1. valid expected-order canonical period ascending;
2. Unscheduled after scheduled periods;
3. Project name using locale-insensitive normalized comparison;
4. source path;
5. source line.

Sidebar groups may display newer/later commercial periods differently after usage, but deterministic source ordering is required.

## Index build diagnostic

Extend the existing concise summary conceptually:

```text
Workspace Index: built files=... journals=... concepts=... projects=... tags=... tasks=... openTasks=... doneTasks=... links=...
```

Do not add per-Project trace spam.

---

# 12. Sidebar Projects panel

## Ownership pattern

Follow the existing dynamic panel lifecycle in `js/main.js`:

```text
ensureWorkspaceProjectsPanel()
renderWorkspaceProjectsPanel()
wireWorkspaceProjectsPanel()
```

Use the same idempotency, delegated event handling, collapse-state persistence, safe logging, and missing-element guards used by current panels.

Do not add direct repeated listeners during every render.

## Recommended canonical order

Place Projects after Concepts and before Related:

```text
Search
Active
Journals
Concepts
Projects
Related
Open Tasks
Tags
Workspace Index
Navigation History
```

This places source knowledge first, Projects next, then relationship/work projections.

The coder must inspect the current canonical order function before editing.

## Panel header

Conceptual header:

```text
Projects                         [count] [Open]
```

- Header/caret toggles collapse.
- Count shows all indexed Projects.
- Open button opens the Full Workspace Index and jumps to Projects.
- Do not create a separate Project workspace.

## Sidebar grouping basis

MVP grouping basis:

```text
expectedOrder
```

Groups display compact period labels:

```text
26Q1
26Q2
26Q3
26Q4
Unscheduled
```

Recommended group order:

1. valid periods ascending;
2. Unscheduled last.

## Compact row

Each Project row shows:

```text
Project name
value/currency when both or either exist
```

Examples:

```text
ByteDance CCTV                 USD 50,000
Internal workflow                      —
Opportunity without currency      50,000
```

Do not show every Project field in the sidebar.

## Project row action

Clicking a Project row must open the source file through the existing physical file opener and navigation path.

Reuse:

```text
openWorkspaceFile()
```

or the exact currently centralized source-opening owner.

Do not create a Project-specific file opener.

After opening the source file, the MVP does not need to scroll to the exact Project line unless this can reuse an existing safe source-line bridge without new complexity.

## Open expanded view

The Projects panel Open button should:

1. switch to the existing `workspace-index` virtual workspace;
2. use a native anchor or existing index target mechanism to reach `workspaceIndexProjectsSection`;
3. preserve Return behavior;
4. not create a new Host workspace.

If immediate post-switch anchor timing is awkward, opening the Full Index at the top is acceptable for the first ACT, followed by a separate minimal jump enhancement.

---

# 13. Full Workspace Index Projects section

## Owner

Extend:

```text
js/workspace/workspace-index-document.js
```

The projection must consume `WORKSPACE_INDEX_STATE.projects` only.

It must not parse files, scan folders, or mutate index state.

## Section position

Recommended order:

```text
Summary
Journals
Concepts
Projects
Tags
Open Tasks
Completed Tasks
Relationships
```

Add navigator entry:

```text
Projects
```

Add deterministic section ID:

```text
workspaceIndexProjectsSection
```

The current seven-section navigator becomes eight sections.

Update ID audit and navigator target validation accordingly.

## Summary metrics

Add:

```text
Projects
```

Do not create an oversized metrics area. Preserve responsive metric layout.

## Projects section layout

Display a presentable register, not Project cards with every raw field.

Recommended desktop columns:

```text
Project
Value
Order
Delivery
Billing
Status
Source
```

On mobile, rows may stack labels and values.

## Value display

Examples:

```text
USD 50,000
BRL 800,000
50,000 · no currency
—
```

Do not combine unlike currencies.

## Source opening

Each Project row must contain an existing-style action that opens:

```text
sourcePath
sourceKind
```

Use the current Full Index action delegation.

Preferred action remains:

```text
data-action="open-workspace-file"
```

Do not add a new handler if existing delegation can open the source.

---

# 14. Project Register filters and totals

The first expanded view/filter implementation must remain small.

## Filter set

```text
All
With Value
Without Value
```

Period filters:

```text
Year
Quarter
```

MVP date basis:

```text
Expected Order only
```

Do not implement Order/Delivery/Billing basis switching in the first parser/index ACT if it adds significant state or UI complexity. The fields are parsed now so the later switch is straightforward.

## Year options

Derive years from valid `expectedOrder` values.

Include:

```text
All years
```

## Quarter options

```text
All quarters
Q1
Q2
Q3
Q4
Unscheduled
```

## Totals

Calculate totals only from Projects that:

- pass the active filters;
- have a valid numeric `value`;
- have a non-empty `currency`.

Display separate totals:

```text
USD 1,250,000
BRL 3,400,000
EUR 220,000
```

Projects with value but no currency appear in the register but do not contribute to currency totals.

Optionally show:

```text
Unspecified currency: 2 Projects
```

No currency conversion.

## Filter implementation boundary

Prefer a small local UI state in the Full Index projection or its existing workspace owner.

Do not put user filter state into `WORKSPACE_INDEX_STATE` because the Index state should represent source data, not presentation choices.

The coder must inspect the existing Full Index action delegation before choosing whether filter controls require:

- native form controls plus a projection-local interaction helper;
- a minimal data-action extension in `workspace-index-workspace.js`;
- or a simpler first version with pre-rendered sections.

This decision belongs in a source-grounded PLAN before ACT.

---

# 15. CSS architecture

Extend:

```text
css/workspace.css
```

Use the current Full Index hierarchy:

```text
workspaceIndexView
  Return row
  wsIndexBody
    wsIndexNavigator
    wsIndexContent
      wsIndexSection...
```

Do not alter ACT C pane suspension.

Do not alter current navigator/content ownership.

## Sidebar classes

Use `workspaceProjects...` names for Journal sidebar elements.

Conceptual classes:

```text
workspaceProjectsPanel
workspaceProjectsHeader
workspaceProjectsSummary
workspaceProjectGroup
workspaceProjectGroupHeader
workspaceProjectGroupCount
workspaceProjectList
workspaceProjectItem
workspaceProjectName
workspaceProjectValue
workspaceProjectsEmpty
```

## Full Index classes

Use `wsIndexProject...` names.

Conceptual classes:

```text
wsIndexProjectsToolbar
wsIndexProjectsFilters
wsIndexProjectTotals
wsIndexProjectTotal
wsIndexProjectRegister
wsIndexProjectHeader
wsIndexProjectRow
wsIndexProjectCell
wsIndexProjectName
wsIndexProjectSource
wsIndexProjectEmpty
```

Reuse current variables:

```text
--bg
--text
--toolbar-bg
--menu-bg
--menu-border
--menu-hover
```

No separate theme system.

## Responsive behavior

Desktop:

- compact table/register;
- sticky or visible header only if source-safe;
- no horizontal page overflow;
- source action remains clear.

Tablet:

- reduce visible columns if necessary;
- retain Project, value, order, and source.

Portrait mobile:

- stack each Project into a compact labeled block;
- one column;
- touch-safe rows;
- no page-level horizontal scrolling.

---

# 16. Events and refresh behavior

Projects should reuse the existing Index lifecycle.

When the shared Index rebuilds:

```text
WORKSPACE_INDEX_STATE.projects updates
mme-workspace-index-ready dispatches
sidebar Projects panel rerenders
Full Index projection refreshes through its existing listener
```

Do not add duplicate scanning or polling.

Recommended public Project readiness derives from:

```text
WORKSPACE_INDEX_STATE.ready
```

Do not create:

```text
PROJECT_INDEX_STATE
```

Do not create:

```text
mme-projects-ready
```

unless later source evidence proves a separate event is required.

---

# 17. Capabilities and Workspace Host

No new workspace descriptor is required.

Do not register:

```text
project-manager
projects
```

with `MME_WORKSPACE_HOST` in this MVP.

Projects Discovery is:

- source data in Journal/Concept files;
- a Journal sidebar projection;
- a Full Workspace Index section.

No capabilities registry change is required unless the implementation introduces a new command that is exposed while `workspace-index` is active.

The source-open action should reuse existing navigation capability.

---

# 18. File ownership and likely modifications

The coder must inspect current source before finalizing scope.

## Expected modifications

```text
js/workspace/workspace-parser.js
js/main.js
js/workspace/workspace-index-document.js
css/workspace.css
sw.js, only in final cache-version ACT
```

## Conditional modification

```text
js/workspace/workspace-index-workspace.js
```

Only if Projects filters or the sidebar Open-to-Projects jump require an extension to existing Full Index action delegation.

## Expected inspected-only files

```text
js/workspace/workspace-state.js
js/workspace/workspace-scanner.js
js/workspace/workspace-controller.js
js/workspace/workspace-sidebar.js
js/workspace/task-review.js
js/workspace/workspace-host.js
js/workspace/workspace-capabilities.js
js/app/script-loader.js
index.html
```

## Protected unless source proves necessity

```text
js/navigation/navigation-history.js
js/editor/codemirror-bootstrap.js
js/render/render-controller.js
js/links/wiki-links.js
css/layout.css
css/editor.css
css/map.css
css/html-preview.css
```

---

# 19. Recommended implementation sequence

Use one master PLAN and independent ACTs.

## ACT A: Project parser and fixtures

Implement:

- Project start detection;
- inline pairs;
- multiline pairs;
- optional bullets;
- aliases;
- unknown-field preservation;
- value normalization;
- quarter normalization;
- `parsed.projects` output.

Do not modify UI.

Acceptance:

- parser can process supplied fixtures deterministically;
- existing tags/tasks/links/frontmatter output remains unchanged.

## ACT B: Shared Index plumbing

Implement:

- `WORKSPACE_INDEX_STATE.projects`;
- aggregation during existing Index build;
- deterministic sorting;
- concise Project count diagnostic;
- event reuse.

Do not add sidebar or Full Index UI.

Acceptance:

- console/global diagnostic confirms correct Project count;
- no second scan;
- no duplicate index.

## ACT C: Sidebar Projects panel

Implement:

- ensure/render/wire lifecycle;
- canonical order insertion;
- expected-order quarter grouping;
- `Unscheduled`;
- compact Project rows;
- source opening;
- Open button.

Acceptance:

- panel survives same-tab reload;
- no duplicate panel/listener;
- source opening inherits dirty and Navigation History behavior.

## ACT D: Full Index Projects section

Implement:

- Projects metric;
- navigator entry;
- deterministic section ID;
- Project register;
- source opening;
- responsive layout.

Acceptance:

- current Index layout remains intact;
- eight navigator targets exist;
- Projects with missing values remain visible.

## ACT E: Filters and currency totals

Implement:

- All / With Value / Without Value;
- expected-order year;
- expected-order quarter;
- Unscheduled;
- filtered totals by currency.

Acceptance:

- no currency conversion;
- zero value remains distinguishable from missing value;
- filters do not mutate source/index state.

## ACT F: PWA finalization

Implement:

- final APP_VERSION bump only after all accepted changes;
- verify relevant files already exist in LOCAL_APP_SHELL;
- preserve cache strategy and cleanup.

---

# 20. Parser fixtures

The implementation PLAN should create or manually validate at least these fixtures.

## Fixture 1: name only

```md
Project: Internal workflow
```

Expected:

```text
1 Project
name = Internal workflow
value = null
expectedOrder.valid = false or absent
sidebar group = Unscheduled
```

## Fixture 2: inline compact

```md
Project: ByteDance CCTV, Value: 50000, Currency: usd, Order: 26q4
```

Expected:

```text
name = ByteDance CCTV
value = 50000
currency = USD
expectedOrder.canonical = 2026-Q4
expectedOrder.display = 26Q4
```

## Fixture 3: semicolon and comma in description

```md
Project: CCTV Upgrade; Description: CCTV, access control, and monitoring; Value: 75000; Currency: USD
```

Expected:

```text
Description preserves internal commas
Value parses separately
```

## Fixture 4: multiline bullets

```md
Project: Alibaba Expansion

- Value: 80000
- Currency: USD
- Order: 2026/Q3
- Delivery: 26-Q4
- Billing: 27Q1
```

Expected normalized quarters:

```text
Order = 2026-Q3
Delivery = 2026-Q4
Billing = 2027-Q1
```

## Fixture 5: multiple Projects

```md
Project: First Project
Order: 26Q1

Project: Second Project
Order: 26Q2
```

Expected:

```text
2 Projects
```

## Fixture 6: heading terminates block

```md
Project: First Project
Value: 100

## Notes

Value: 999
```

Expected:

```text
Project value = 100
Notes value does not modify Project
```

## Fixture 7: unknown fields

```md
Project: New Opportunity
Customer: Example Customer
Country: Brazil
Probability: 70
```

Expected:

```text
extraFields.customer = Example Customer
extraFields.country = Brazil
extraFields.probability = 70
```

## Fixture 8: invalid quarter

```md
Project: Invalid Quarter Test
Order: 26Q5
```

Expected:

```text
Project remains valid
expectedOrder.valid = false
sidebar group = Unscheduled
```

## Fixture 9: value zero

```md
Project: Zero Value Test
Value: 0
Currency: USD
```

Expected:

```text
value = 0
Project is classified as With Value
USD total changes by 0
```

## Fixture 10: blank name

```md
Project:
Value: 50000
```

Expected:

```text
0 Projects
no blocking error
```

---

# 21. Validation principles

This is a personal single-user MVP. Prioritize the useful path over exhaustive edge-case handling.

Required validation:

- existing Journal and Concept parsing still works;
- Tasks remain unchanged;
- Wiki Links remain unchanged;
- Tags remain unchanged;
- Project count is correct;
- sidebar groups are correct;
- Projects without values remain visible;
- With Value filter works;
- totals remain separated by currency;
- quarter formats normalize correctly;
- source opening works;
- Full Index Return works;
- Back/Forward works;
- same-tab reload does not duplicate Projects panel;
- no stale PWA assets after final version bump.

Not required for MVP:

- exhaustive punctuation combinations;
- locale-perfect number parsing;
- every malformed dictionary pattern;
- rename-safe identity;
- exact Project-line scrolling;
- migrations;
- multi-user conflicts.

---

# 22. Hard architectural rules

1. Do not add a second workspace scanner.
2. Do not add a second Project index state.
3. Do not parse Projects inside sidebar or Full Index rendering.
4. Do not mutate source Markdown from the Project views.
5. Do not register a Projects Host workspace in this MVP.
6. Do not add Project files or a Project folder.
7. Do not couple Projects to Tasks or Reports yet.
8. Do not duplicate physical file opening.
9. Do not bypass dirty-state or Navigation History protections.
10. Do not redesign the current Full Index layout.
11. Do not update APP_VERSION until the final accepted ACT.
12. Do not mix PWA cache finalization into intermediate ACTs.

---

# 23. Future convergence, not current scope

The later standalone Projects workflow should use the same vocabulary:

```text
Project
Value
Currency
Order
Delivery
Billing
Status
Description
```

Future rich records may add:

```text
Stable ID
Customer
Owner
Probability
Products
Milestones
Tasks
Notes
Reports
Archive state
```

The future rich workflow and current fast Markdown workflow must normalize into the same Project language.

Conceptual future flow:

```text
Fast Markdown Project
        ↓
Discovered Project record
        ↓
Optional Enrich action
        ↓
Rich standalone Project workflow
```

Reverse future flow:

```text
Standalone rich Project
        ↓
Insert reference into current Journal/Concept
        ↓
Shared Project identity and vocabulary
```

Do not implement convergence in this MVP. Preserve the vocabulary so convergence remains possible.

---

# 24. Coder AI planning request

After importing this file into the repository, ask the coder AI to begin in PLAN mode with this instruction:

```text
Read this Projects Discovery MVP architecture handoff completely.

Inspect the current repository at the active checkpoint and reconcile every
proposed owner, function, event, selector, and file boundary against actual
source.

Do not edit during PLAN.

Produce one Projects Discovery master handoff with independent ACTs:

ACT A: Project parser and fixtures
ACT B: WORKSPACE_INDEX_STATE.projects plumbing
ACT C: Journal sidebar Projects panel
ACT D: Full Workspace Index Projects section
ACT E: filters and currency totals
ACT F: PWA cache-version finalization

Prefer existing owners and patterns over new modules.

If source ownership differs from this document, explain the difference and
propose the smallest safe adaptation.

Do not create a Projects Host workspace.
Do not create a projects folder.
Do not create standalone Project files.
Do not integrate Tasks, Reports, Gantt, Groups, or archive behavior.
Do not edit during PLAN.
```

---

# 25. Success condition

The MVP is successful when the user can write:

```md
Project: ByteDance CCTV, Value: 50000, Currency: USD, Order: 26Q4
```

inside an ordinary Journal or Concept and then receive:

```text
Sidebar
Projects
  26Q4
    ByteDance CCTV — USD 50,000
```

plus an expanded register containing:

```text
Project             Value         Order   Delivery   Billing
ByteDance CCTV      USD 50,000    26Q4    —          —
```

with:

- source-file opening;
- All / With Value / Without Value;
- year and quarter filtering;
- totals by currency;
- Projects without values preserved;
- existing Journal, Tasks, Tags, Links, Index, Return, and Navigation behavior unchanged.
