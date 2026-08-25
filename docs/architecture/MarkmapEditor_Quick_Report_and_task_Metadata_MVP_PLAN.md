# MarkmapEditor Quick Report and Task Metadata MVP

## Implementation Status

- Dictionary: implemented
- Markdown generator: implemented
- Report panel: implemented
- Task metadata: implemented
- Report lifecycle & guards (ACT G): implemented
- Reviewed Markdown importer (H1): implemented and committed
- Draw.io reconciliation (H2): foundation source committed; not registered; pending review
- Draw.io visual output: not available

The historical plan body below is preserved.

## Architecture and Implementation Handoff

**Status:** Ready for source reconciliation and PLAN  
**Primary goal:** Generate a useful weekly Markdown report from existing workspace data with minimal user input, then preserve a clean future handoff to a richer embedded Draw.io Report workflow.  
**Product principle:** Simple Markdown input, one reliable automated output, presentable HTML rendering, optional richer editing later.

---

# 1. Product Intent

MarkmapEditor should reduce repeated copying, formatting, and re-entry across disconnected work systems.

The Quick Report MVP must support this flow:

```text
Daily Journals + optional Task metadata + discovered Projects
                             ↓
                 Shared Report Dictionary
                             ↓
                 Generated Markdown Report
                             ↓
                  Existing HTML Preview
                             ↓
              Save As, discard, or edit manually
                             ↓
              Future: Open in Rich Report
                             ↓
          Populate Draw.io template and edit in-app
```

The first useful output is the generated Markdown report. The future rich Draw.io report must consume the reviewed Markdown report or its normalized dictionary, not independently recalculate the original workspace data.

---

# 2. MVP Boundaries

## 2.1 Included

- Optional Task metadata parsing.
- Optional Task completion date.
- Completion date written immediately when a Task is completed from Task Review.
- Conservative completion-date reconciliation before a physical Save when a Task was completed through the editor.
- Journal sidebar Report panel.
- Explicit initial and final date fields.
- Report section enable/disable controls.
- Simple up/down Report section ordering.
- Mutually exclusive Project inclusion modes:
  - all Projects;
  - Projects with value;
  - Projects without value.
- Optional manual Report Notes using dictionary pairs.
- Automatic Report Dictionary creation.
- Automatic Markdown Report generation.
- New unsaved virtual Markdown document in the Editor.
- Existing HTML Preview compatibility.
- Save As behavior for generated reports.
- Stable Markdown headings for future Rich Report import.
- Documented handoff contract for future Draw.io replacement and embedded editing.

## 2.2 Explicitly deferred

- Embedded Draw.io editor.
- Draw.io placeholder replacement runtime.
- Draw.io template management.
- Automatic Gantt generation.
- Editable Draw.io tables.
- CSV or spreadsheet input.
- Report history or Report Index.
- Mandatory `reports/` workspace folder.
- Dedicated Report Host workspace.
- Top-bar Report launcher.
- Persistent Report profiles.
- Persistent Report configuration.
- Drag-and-drop section ordering.
- Project to Task relationships.
- Project-specific report templates.
- Automatic dating of ambiguous historical completed Tasks.
- Rich Task Manager fields or standalone managed Task records.

---

# 3. Existing Architecture to Reuse

The coder must reconcile these proposed owners against current source before editing.

Expected existing architecture:

```text
Markdown physical files
  → workspace-parser.js
  → buildWorkspaceIndex() or current Index builder
  → WORKSPACE_INDEX_STATE
  → Journal sidebar projections
  → Full Workspace Index projections

Editor and file workflow
  → CodeMirror/editor owner
  → dirty-state owner
  → physical Save and Save As owner
  → Mode Session and Navigation History

Report output
  → generated virtual Markdown
  → existing Markdown renderer
  → existing HTML Preview
```

The implementation must reuse existing owners for:

- Task parsing.
- Task Review source mutation.
- Workspace Index task aggregation.
- Project discovery and Project filtering semantics.
- Journal sidebar panel lifecycle.
- physical Save and Save As.
- editor content replacement.
- dirty state.
- proposed filename handling.
- HTML Preview.
- Mode Session and Navigation History.

Do not create parallel implementations for these responsibilities.

---

# 4. Recommended New Modules

The report logic should not be added directly to `main.js` as one large block.

Recommended new files:

```text
js/report/report-dictionary.js
js/report/quick-report-generator.js
js/report/report-panel.js
```

Optional Task module if current ownership permits:

```text
js/tasks/task-metadata.js
```

If the repository already has a canonical Task module or Task Review module that owns parsing and source mutation, extend the existing owner instead of creating `task-metadata.js`.

## 4.1 `js/report/report-dictionary.js`

Owns pure Report data preparation:

- normalize manual Report keys;
- parse dictionary-style Report Notes;
- calculate explicit Report period;
- select completed Tasks by date;
- select optional undated completed Tasks;
- select Projects by inclusion mode;
- calculate currency-separated totals;
- create the normalized Report Dictionary;
- expose no UI;
- perform no file operations;
- perform no source mutation.

Suggested public API:

```js
MME_REPORT_DICTIONARY = {
  normalizeReportKey,
  parseReportNotes,
  buildReportDictionary,
  selectCompletedTasks,
  selectProjects,
  calculateProjectTotals,
}
```

The exact public global or module registration must match repository conventions. Do not introduce a new global if the script loader and existing modules support a narrower registration pattern.

## 4.2 `js/report/quick-report-generator.js`

Owns pure Markdown generation:

- fixed report heading and metadata;
- section renderers;
- order of enabled sections;
- Markdown tables and lists;
- predictable empty states;
- generated filename proposal.

Suggested public API:

```js
MME_QUICK_REPORT = {
  buildMarkdown,
  buildSuggestedFilename,
  normalizeSectionOrder,
}
```

This module must not directly open the editor or save files.

## 4.3 `js/report/report-panel.js`

Owns Report sidebar UI and temporary Report configuration:

- ensure panel;
- render panel;
- wire panel;
- date range controls;
- section enable/disable controls;
- section up/down controls;
- Project inclusion mode;
- Report Notes editor/modal;
- Generate action;
- one temporary configuration object;
- no persistent storage in MVP.

The panel may call existing application APIs through explicit adapters injected or obtained according to current project conventions.

It must not own:

- Workspace scanning;
- Project parsing;
- Task parsing;
- physical Save;
- editor implementation;
- HTML rendering;
- Navigation History.

## 4.4 Task metadata owner

Prefer the current Task parser and Task Review owners.

Possible responsibilities:

- parse hidden Task metadata;
- serialize hidden Task metadata;
- add or remove only `completed` metadata;
- preserve future optional metadata such as Priority and Owner;
- report ambiguous Task matching without guessing.

---

# 5. Task Syntax and Metadata

## 5.1 Basic Task remains sufficient

```md
- [ ] Update customer quotation
```

No metadata is required.

## 5.2 Completed Task with hidden metadata

```md
- [x] Update customer quotation <!-- mme-task: completed=2026-08-05 -->
```

## 5.3 Future optional metadata

```md
- [x] Update customer quotation <!-- mme-task: completed=2026-08-05; priority=high; owner=Adelson -->
```

Supported MVP metadata:

```text
completed
```

Recognized but optional future-compatible metadata, only if easy to preserve safely:

```text
priority
owner
due
```

Do not require, validate, or expose Priority, Owner, or Due in the first Report UI.

## 5.4 Normalized Task fields

```js
{
  text: "Update customer quotation",
  completed: true,
  completedDate: "2026-08-05",
  priority: null,
  owner: null,
  dueDate: null,
  sourcePath: "...",
  sourceKind: "...",
  sourceLine: 12
}
```

The exact Task object must preserve all existing fields.

## 5.5 Metadata rules

- Checked Task with valid `completed` metadata receives a normalized `completedDate`.
- Checked Task without metadata remains completed with `completedDate: null`.
- Open Task must not keep a stale completion date after a source-proven open transition.
- Invalid completion date must not be treated as a valid period date.
- Existing Task text must exclude the hidden metadata comment.
- Hidden metadata must remain invisible in rendered Markdown and Markmap output where current renderer behavior allows.

---

# 6. Task Completion Date Behavior

## 6.1 Completion from Task Review

When Task Review changes:

```md
- [ ] Update customer quotation
```

into completed state, write:

```md
- [x] Update customer quotation <!-- mme-task: completed=YYYY-MM-DD -->
```

Use the current local date in a stable `YYYY-MM-DD` format.

When Task Review reopens the Task:

```md
- [ ] Update customer quotation
```

Remove only the `completed` property.

If future metadata exists:

```md
<!-- mme-task: completed=2026-08-05; priority=high; owner=Adelson -->
```

reopening becomes:

```md
<!-- mme-task: priority=high; owner=Adelson -->
```

If the metadata comment becomes empty, remove the comment entirely.

## 6.2 Completion through the editor

Do not insert dates while the user types.

Do not insert dates during:

- editor input;
- delayed render;
- editor blur render;
- local draft autosave;
- HTML Preview;
- workspace scanning;
- file opening;
- app boot.

Use conservative reconciliation only immediately before a physical Save or Save As.

### Save-time reconciliation

1. Capture a Task baseline when a physical document becomes active or after a successful Save.
2. Before physical Save, parse current editor Tasks.
3. Compare the current Task set with the baseline.
4. Detect unambiguous `open → completed` transitions.
5. Add today’s completion date only when no completion date exists.
6. Detect unambiguous `completed → open` transitions.
7. Remove only the completion field.
8. Apply one controlled editor/text transaction.
9. Save the reconciled text.
10. Refresh the Task baseline after successful Save.

### Conservative matching

Prefer stable Task identity if the repository already provides one.

Otherwise use a conservative combination such as:

```text
normalized Task text
+ occurrence index among identical Task texts
+ source path
+ previous completion state
```

If matching is ambiguous:

- do not insert a completion date;
- do not remove metadata;
- preserve user text;
- optionally record a concise diagnostic.

Never assign today’s date to every checked Task in the file.

Historical checked Tasks without dates remain `completedDate: null`.

---

# 7. Report Sidebar Panel

## 7.1 Placement

Recommended Journal sidebar order:

```text
Search
Active
Journals
Concepts
Projects
Related
Open Tasks
Report
Tags
Workspace Index
Navigation History
```

The coder must reconcile the exact current canonical order and preserve all existing relative ordering.

## 7.2 Compact panel layout

```text
Report

Period
From [YYYY-MM-DD]
To   [YYYY-MM-DD]

Sections
[x] Summary and Highlights      [↑] [↓]
[x] Completed Tasks             [↑] [↓]
[x] Project Forecast            [↑] [↓]
[x] Forecast Totals             [↑] [↓]
[x] Risks and Attention Points  [↑] [↓]
[x] Next Steps                  [↑] [↓]
[ ] Completed Tasks Without Date [↑] [↓]

Projects
(•) All Projects
( ) Projects With Value
( ) Projects Without Value

[Edit Report Notes]
[Generate Report]
```

The panel is configuration only. It must not render the report body.

## 7.3 Date range

Use two explicit native date controls:

```text
periodStart
periodEnd
```

Default:

- current week Monday;
- current week Sunday.

If repository or user locale conventions define another week boundary, the implementation may use the source-proven convention. Document it.

Validation:

```text
periodStart <= periodEnd
```

If invalid:

- disable Generate;
- display a short inline error;
- preserve typed values.

The date range filters completed Tasks only in MVP.

It does not filter Projects because Projects use forecast quarters rather than daily completion dates.

## 7.4 Project inclusion mode

Use radio buttons or another mutually exclusive semantic control:

```text
all
with-value
without-value
```

Definitions must match Project ACT E:

- `all`: every discovered Project;
- `with-value`: `Number.isFinite(project.value)`, including zero;
- `without-value`: missing, invalid, or non-finite Project value.

Do not add Year, Quarter, Currency, Delivery, Billing, or Status filters to the Report panel MVP.

## 7.5 Report section configuration

Initial section definitions:

```js
[
  { id: 'summary', enabled: true },
  { id: 'completed-tasks', enabled: true },
  { id: 'project-forecast', enabled: true },
  { id: 'forecast-totals', enabled: true },
  { id: 'risks', enabled: true },
  { id: 'next-steps', enabled: true },
  { id: 'undated-completed-tasks', enabled: false }
]
```

The exact initial order may be adjusted during PLAN if current workflow suggests a better default.

## 7.6 Section ordering

Use simple up/down buttons.

Rules:

- no drag-and-drop;
- no persistent order in MVP;
- first section cannot move up;
- last section cannot move down;
- disabled sections may still be reordered;
- generated Markdown follows current order and omits disabled sections;
- fixed Report title and metadata remain above reorderable sections.

## 7.7 Report Notes

`Edit Report Notes` opens a compact modal, overlay, or existing source-compatible editing surface.

Dictionary input example:

```md
Title: Weekly Business Report
Summary: Main customer and commercial activity during the week.
Highlights: Quotations advanced for priority accounts.
Risks: Delivery assumptions still require confirmation.
Next Steps: Complete technical reviews and update forecasts.
Management Notes:
```

All fields are optional.

Initial aliases:

```text
Report, Title
→ report.title

Summary
→ report.summary

Highlights
→ report.highlights

Risks, Risks and Attention Points
→ report.risks

Next Steps, Actions
→ report.next_steps

Management Notes, Notes
→ report.management_notes
```

The notes remain temporary session state in MVP.

Do not require a Report file before generation.

---

# 8. Shared Report Dictionary

The Report Dictionary is the internal working language shared by Quick Report and future Rich Report.

## 8.1 Core structure

A structured internal object is preferred, with a flattened placeholder view available later.

Conceptual structured form:

```js
{
  report: {
    title: "Weekly Business Report",
    periodStart: "2026-08-03",
    periodEnd: "2026-08-09",
    period: "2026-08-03 to 2026-08-09",
    generatedDate: "2026-08-09",
    summary: "...",
    highlights: "...",
    risks: "...",
    nextSteps: "...",
    managementNotes: "..."
  },
  tasks: {
    completed: [],
    completedUndated: []
  },
  projects: {
    mode: "with-value",
    items: [],
    totalsByCurrency: [],
    valuedWithoutCurrencyCount: 0
  },
  sections: []
}
```

## 8.2 Future flattened keys

The future Draw.io engine may consume:

```text
report.title
report.period
report.date
report.summary
report.highlights
report.risks
report.next_steps
report.management_notes

tasks.completed.count
tasks.completed.markdown
tasks.completed.text

projects.count
projects.valued.count
projects.forecast.markdown
projects.forecast.text
projects.total.usd
projects.total.brl
```

The Quick Report MVP does not need Draw.io aliases yet, but its dictionary must make the future mapping straightforward.

---

# 9. Project Selection and Totals

## 9.1 Source

Consume only the existing normalized Project collection:

```text
WORKSPACE_INDEX_STATE.projects
```

Do not scan or parse Projects again.

## 9.2 Selection

```text
all
with-value
without-value
```

Preserve existing deterministic Project order.

Do not mutate shared Projects.

## 9.3 Project table fields

```text
Project
Value
Order
Delivery
Billing
Status
```

Do not include Source in the generated external report unless selected later through actual use.

## 9.4 Values

- Numeric value with currency: `USD 50,000`.
- Numeric zero with currency: `BRL 0`.
- Numeric value without currency: `50,000 · no currency`.
- Missing or invalid value: `—`.

## 9.5 Totals

Calculate from selected Projects only.

Include named totals only when:

```text
Number.isFinite(project.value)
AND
project.currency.trim() is nonempty
```

Group currencies separately.

No conversion.

Sort currency codes alphabetically.

Track valued Projects without currency separately.

---

# 10. Completed Task Selection

## 10.1 Dated completed Tasks

Include when:

```text
task.completed === true
AND
task.completedDate is valid
AND
periodStart <= completedDate <= periodEnd
```

The range is inclusive.

## 10.2 Undated completed Tasks

```text
task.completed === true
AND
completedDate is missing or invalid
```

Include only when the optional `Completed Tasks Without Date` section is enabled.

Do not pretend these Tasks were completed in the selected period.

## 10.3 Task output

Initial report list item:

```md
- Task text
```

Optionally include source context later.

Do not include hidden metadata comment in the output.

---

# 11. Quick Markdown Report Output

## 11.1 Generated frontmatter

```md
---
type: report
period_start: 2026-08-03
period_end: 2026-08-09
generated: 2026-08-09
project_scope: with-value
---
```

Keep frontmatter small and stable.

## 11.2 Fixed top content

```md
# Weekly Business Report

**Period:** 2026-08-03 to 2026-08-09
```

## 11.3 Reorderable sections

### Summary and Highlights

```md
## Summary

...

## Highlights

...
```

If both fields are empty, omit empty subcontent or use one quiet placeholder according to source review.

### Completed Tasks

```md
## Completed Tasks

- Updated commercial forecast
- Completed quotation review
```

Empty state:

```md
_No completed Tasks found for this period._
```

### Project Forecast

```md
## Project Forecast

| Project | Value | Order | Delivery | Billing | Status |
|---|---:|---|---|---|---|
| ByteDance CCTV | USD 50,000 | 26Q4 | 27Q1 | 27Q1 | Quotation |
```

Empty state:

```md
_No Projects match the selected Project scope._
```

### Forecast Totals

```md
## Forecast Totals

- BRL 0
- USD 130,000
```

Optional auxiliary line:

```md
- Valued Projects without currency: 1
```

### Risks and Attention Points

```md
## Risks and Attention Points

...
```

### Next Steps

```md
## Next Steps

...
```

### Completed Tasks Without Date

```md
## Completed Tasks Without Date

- Historical completed Task
```

Add a note that the completion date is unavailable.

## 11.4 Generated filename

Recommended:

```text
YYYY-MM-DD-Weekly-Report.md
```

Use `periodEnd` in the filename.

Example:

```text
2026-08-09-Weekly-Report.md
```

Sanitize according to existing Save filename rules.

---

# 12. Virtual Unsaved Document Contract

Clicking Generate must create a new virtual Markdown document.

Required behavior:

- current Journal file is not overwritten;
- generated content becomes active Editor content;
- proposed filename is set;
- no current writable file handle is attached;
- document is marked dirty;
- Save uses Save As;
- Cancel leaves the virtual document unchanged;
- HTML Preview works;
- Markmap rendering may work normally, but Report output should prioritize Markdown and HTML readability;
- previous Journal session remains recoverable through current Mode Session or Navigation History contracts.

Do not automatically save the Report.

Do not create a `reports/` folder.

Do not require a workspace folder for generation if the current application architecture supports virtual output without it. If the Report depends on Project or Task data, a ready workspace is required.

---

# 13. Future Rich Report Handoff

The future Rich Report must consume the reviewed generated Markdown report.

```text
Workspace data
→ generated Markdown report
→ user edits Markdown
→ Parse Report Dictionary from current report
→ populate Draw.io template
→ open embedded Draw.io editor
```

Do not make the future Draw.io workflow independently rescan Projects and Tasks after the user has edited the report.

## 13.1 Stable section mapping

```text
# title
→ report.title

frontmatter period_start / period_end
→ report period

## Summary
→ report.summary

## Highlights
→ report.highlights

## Completed Tasks
→ tasks.completed

## Project Forecast
→ projects.forecast

## Forecast Totals
→ projects.totals

## Risks and Attention Points
→ report.risks

## Next Steps
→ report.next_steps

## Management Notes
→ report.management_notes
```

## 13.2 Draw.io template basis

The analyzed template contains simple tags such as:

```text
{{REPORT_PERIOD}}
{{REPORT_DATE}}
{{ALI_DECISIONS}}
{{ALI_NEXT_STEPS}}
{{ALI_RISKS_DEPENDENCIES}}
{{ALI_MANAGEMENT_NOTES}}
{{BYT_NEXT_STEPS}}
{{TEN_MANAGEMENT_NOTES}}
{{TOTAL_ALI_FORECAST}}
{{TOTAL_BYT_FORECAST}}
{{TOTAL_TEN_FORECAST}}
{{GRAND_TOTAL_FORECAST}}
{{GRAND_TOTAL_COMMENTS}}
```

Future canonical dictionary keys should use dotted normalized names, with an alias map for existing uppercase placeholders.

## 13.3 Future template-field import

When a Draw.io template is loaded later:

1. scan `{{...}}` placeholders;
2. resolve automatic fields from the Report Dictionary;
3. identify unresolved manual fields;
4. offer `Insert Missing Template Fields`;
5. append only unresolved manual fields to the Markdown Report;
6. do not duplicate automatically generated values.

This is out of scope for the Quick Report MVP.

---

# 14. Sidebar Panel Lifecycle

The Report panel must follow the existing idempotent sidebar panel lifecycle.

Expected pattern:

```text
ensure
→ render
→ wire
→ finalize after workspace readiness
```

Requirements:

- no duplicate panel;
- no duplicate listener;
- canonical panel ordering;
- collapse-state integration if current sidebar panels support it;
- same-tab reload safe;
- workspace switch safe;
- disabled or explanatory state when Workspace Index data is not ready;
- task/project counts available where useful;
- temporary Report configuration must not leak across incompatible workspaces.

Prefer a dedicated `report-panel.js` owner with a small bridge from the existing sidebar finalizer.

Do not add hundreds of Report UI lines to `main.js` unless current source architecture makes a separate module impossible.

---

# 15. Error and Empty-State Rules

## Invalid date range

```text
Start date must be before or equal to end date.
```

Generate disabled.

## Workspace not ready

```text
Open a workspace to generate an automatic Report.
```

## No completed Tasks in period

Use the Markdown empty state if that section is enabled.

## No Projects selected

Use the Project Forecast empty state if that section is enabled.

## No currency totals

```text
_No named currency totals are available for the selected Projects._
```

## Ambiguous editor Task transition

Skip metadata mutation and preserve user text.

## Save cancellation

Do nothing.

---

# 16. Accessibility and Responsive Requirements

- Native date inputs.
- Semantic checkboxes.
- Semantic radio buttons for Project scope.
- Buttons with visible names or accessible labels.
- Up/down controls keyboard accessible.
- Focus-visible styling.
- Controls do not rely only on color.
- Report panel remains compact at desktop sidebar widths.
- Mobile controls stack naturally.
- No horizontal page overflow.
- Report Notes editor remains usable on phone portrait.
- Generated Markdown remains readable without the application.

---

# 17. Protected Architecture

Preserve:

- Workspace Host registered workspaces.
- Journal initialization count and legacy auto-init contract.
- Workspace parser ownership.
- WORKSPACE_INDEX_STATE as the shared discovery model.
- Task Review as the current Task interaction owner.
- Project Discovery vocabulary and Index state.
- physical file handles.
- Save and Save As behavior.
- dirty state.
- Navigation History.
- Mode Session.
- HTML Preview.
- Full Workspace Index.
- Journal sidebar ordering outside insertion of Report.
- Service Worker strategy until final release ACT.

Do not introduce a second source of truth for Tasks, Projects, or Reports.

---

# 18. Independent ACT Plan

Each ACT must be independently reviewable and checkpointed.

## ACT A: Source reconciliation and final ownership map

**Purpose:** Reconcile this document against current repository source.

Inspect:

- Task parser.
- Task Review source mutation.
- Task aggregation.
- Save and Save As.
- editor content replacement.
- dirty-state owner.
- virtual/generated document patterns.
- sidebar panel lifecycle.
- script loader.
- Service Worker shell.

Output:

```text
QUICK REPORT SOURCE RECONCILIATION HANDOFF
```

No code changes.

## ACT B: Task metadata parser

**Preferred files:** Current Task parser owner only.

Implement:

- parse `<!-- mme-task: ... -->`;
- expose `completedDate`;
- preserve Task text without metadata;
- preserve existing Task behavior;
- parser fixtures;
- no source mutation.

Do not implement Report UI.

## ACT C: Task Review completion-date mutation

**Preferred files:** Current Task Review owner and source-proven helper only.

Implement:

- add current completion date on sidebar completion;
- remove only completion metadata on reopen;
- preserve future optional metadata;
- one physical source mutation path;
- no editor transition logic yet.

## ACT D: Conservative pre-save Task reconciliation

**Preferred files:** Existing physical Save owner plus a dedicated Task metadata helper if source-proven.

Implement:

- baseline capture;
- unambiguous state-transition detection;
- one pre-save reconciliation transaction;
- physical Save and Save As only;
- not draft autosave;
- skip ambiguous matches;
- baseline refresh after successful Save.

## ACT E: Report Dictionary and Quick Report generator modules

**Preferred new files:**

```text
js/report/report-dictionary.js
js/report/quick-report-generator.js
```

Implement pure logic:

- report notes parser;
- date range model;
- Task selection;
- Project selection;
- currency totals;
- section order model;
- Markdown generation;
- suggested filename;
- fixtures or focused validators.

No sidebar and no editor integration.

## ACT F: Report sidebar panel

**Preferred new file:**

```text
js/report/report-panel.js
```

Conditional small bridge in current sidebar finalizer owner.

Implement:

- explicit start and end dates;
- section switches;
- Project scope radio buttons;
- up/down section order;
- Report Notes editor;
- Generate action wiring;
- no report output until ACT G if safer.

## ACT G: Virtual Markdown Report output

Integrate:

- Report Dictionary;
- Markdown generator;
- current Editor;
- proposed filename;
- no writable handle;
- dirty state;
- Save As;
- HTML Preview;
- return/session behavior.

No Draw.io integration.

## ACT H: Report Markdown import contract

Implement or document the parser that can rebuild the Report Dictionary from the generated Markdown.

This should support future:

```text
Open in Rich Report
```

No Draw.io editor yet.

## ACT I: PWA finalization

After all runtime and visual tests:

- add new Report modules to loader and Service Worker shell if required;
- bump APP_VERSION once;
- preserve cache strategy;
- verify normal Service Worker upgrade.

---

# 19. Validation Matrix

## Task parsing

- open Task without metadata;
- completed Task without metadata;
- completed Task with valid date;
- invalid date;
- metadata with future optional fields;
- metadata hidden from Task text;
- duplicate Task text.

## Task Review mutation

- open to completed;
- completed to open;
- preserve Priority and Owner;
- check zero duplicate listeners;
- physical source remains valid Markdown.

## Save-time reconciliation

- one clear open to completed transition;
- one clear completed to open transition;
- line moved but text stable;
- duplicate ambiguous Tasks;
- historical checked Task without date;
- draft autosave does not mutate metadata;
- physical Save does mutate when safe;
- Save cancellation behavior.

## Report period

- valid same-day range;
- valid multi-day range;
- start after end;
- Tasks on start date;
- Tasks on end date;
- undated completed Tasks.

## Project scope

- all;
- with value;
- without value;
- zero value;
- missing currency;
- currencies remain separate.

## Section ordering

- move first up disabled;
- move last down disabled;
- reorder enabled sections;
- reorder disabled sections;
- disabled sections omitted;
- output follows visible order.

## Virtual report

- new unsaved content;
- previous Journal not overwritten;
- dirty state true;
- Save invokes Save As;
- Cancel does nothing;
- HTML Preview works;
- reopening Journal works;
- Back/Forward behavior preserved.

## Responsive

- desktop sidebar;
- narrow sidebar;
- phone portrait;
- Report Notes editor;
- generated Markdown preview.

---

# 20. Final Coder AI Instruction

Start a new coder-AI conversation in PLAN mode and send:

```text
Read docs/architecture/MarkmapEditor_Quick_Report_and_Task_Metadata_MVP_PLAN.md completely.

Inspect the current repository and reconcile every proposed owner, file,
function, event, listener, state object, editor API, Save path, sidebar lifecycle,
script-loader entry, and Service Worker boundary against actual source.

Do not edit during PLAN.

Produce one source-grounded master handoff with the independent ACTs defined in
the document.

Important product decisions:

- A basic Markdown checkbox Task remains sufficient.
- Task completion date and future metadata are optional.
- Task Review completion may add the date immediately.
- Editor completion metadata must be reconciled only before a physical Save or
  Save As, never during typing or draft autosave.
- Use explicit Report start and end dates.
- Project inclusion modes are mutually exclusive: all, with value, without
  value.
- Report sections can be enabled/disabled and reordered with up/down buttons.
- Manual Report Notes use dictionary pairs.
- Generate creates a new unsaved Markdown document with a proposed filename,
  no writable handle, dirty state, existing HTML Preview, and Save As behavior.
- No reports folder is required.
- No dedicated Report workspace is required.
- No Draw.io editor or placeholder replacement is implemented in this round.
- The generated Markdown and shared Report Dictionary must be suitable for a
  future Open in Rich Report flow.

Prefer dedicated new Report modules over adding large Report implementations to
main.js.

Prefer existing Task and Save owners over parallel implementations.

If any proposed owner differs from source, explain the difference and propose
the smallest safe adaptation.

Produce exactly:

QUICK REPORT AND TASK METADATA MASTER HANDOFF

Include:

- repository state;
- current Task parser owner;
- current Task Review mutation owner;
- physical Save owner;
- draft autosave owner;
- editor content owner;
- virtual document precedent;
- dirty-state owner;
- proposed filename owner;
- sidebar finalizer owner;
- script-loader implications;
- Service Worker implications;
- recommended new Report modules;
- exact ACT boundaries;
- protected architecture;
- hard stops;
- validation per ACT.

Then choose exactly one status:

READY FOR ACT B: SOURCE OWNERS RESOLVED

RETURN TO SOURCE REVIEW: TASK MUTATION OWNER UNRESOLVED

RETURN TO SOURCE REVIEW: PHYSICAL SAVE BOUNDARY UNRESOLVED

RETURN TO SOURCE REVIEW: VIRTUAL DOCUMENT CONTRACT UNRESOLVED

PLAN BLOCKED: QUICK REPORT REQUIRES ARCHITECTURE REDESIGN

Then stop.

Do not edit during PLAN.
```

---

# 21. Completion Criteria

The Quick Report MVP is complete when:

1. Basic Tasks remain easy to type.
2. Task completion dates are optional and portable.
3. Sidebar completion records a date.
4. Editor completion can be dated conservatively at physical Save.
5. User selects explicit Report start and end dates.
6. User selects Report sections.
7. User chooses all Projects, valued Projects, or Projects without value.
8. User orders enabled Report sections with up/down controls.
9. User optionally adds manual dictionary notes.
10. Generate opens a new unsaved Markdown report.
11. The report renders cleanly in HTML Preview.
12. Save uses Save As and never overwrites the Journal.
13. The generated report can later be parsed into the same Report Dictionary.
14. No Draw.io integration is required for the Quick Report to be useful.

---

# 22. Future Rich Report Direction

After real use validates the Markdown report:

```text
Generated and reviewed Markdown
→ Report Dictionary
→ Draw.io template placeholder scan
→ automatic field replacement
→ unresolved manual fields inserted into Markdown on request
→ embedded Draw.io editor
→ returned XML
→ Save generated .drawio
```

The Quick Report is therefore the core report-data workflow, while Draw.io becomes the richer visual editing and finishing environment.
