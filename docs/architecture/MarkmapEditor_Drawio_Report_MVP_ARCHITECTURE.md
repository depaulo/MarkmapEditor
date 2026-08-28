# MarkmapEditor Draw.io Report MVP Architecture

**Status:** Locked architecture for the first thin Draw.io MVP  
**Scope:** Thin MVP only  
**Canonical source:** Reviewed Markdown Report  
**Output:** One editable, uncompressed `.drawio` XML file generated from one user-selected template

Current implementation:

- ACT G (Quick Report + Report lifecycle): complete.
- H1 (Reviewed Markdown importer): complete (committed at `e738ec3`, registered via `js/app/script-loader.js`, runtime API `globalThis.MME_REPORT_MARKDOWN_IMPORT`, dormant validator passes 39/39 in Node).
- H2 (Draw.io reconciler): complete (committed at `f1a82b5`; XML declaration/BOM assessment compatibility added at `3ab7f65`; runtime API `globalThis.MME_DRAWIO_REPORT_RECONCILER`; validator passes 101/101 in Node with honest totals; accepts `<mxfile>`/`<mxGraphModel>` roots optionally preceded by a UTF-8 BOM, leading whitespace, and one standard XML declaration — assessment-view normalization only, original template and declaration-in-output preserved; compressed payloads still rejected as `template-compressed`).
- H3 (reconciliation UI): complete (committed at `a1c39dc`, refined through `3ab7f65`; runtime API `globalThis.MME_DRAWIO_REPORT_PANEL`, validator passes 38/38 in Node; runtime qualification, button availability, Report collapse, overlay open/Close, picker cancellation, no-template blocking, mobile open/Close, and session Close are browser-confirmed). Real-template desktop acceptance is pending.
- H4 (Draw.io flexible output delivery): complete (committed at `2c03960`; flexible partial generation, unused-field aggregation, and Android `application/octet-stream` picker compatibility at `3ab7f65`; validator-honesty and single-owner delivery logging cleanup at `4541709`; runtime APIs `globalThis.MME_DRAWIO_REPORT_PANEL.generateDrawioOutput` and `validateDrawioOutputDelivery`, output-delivery validator passes 107/107 in Node; browser-only acceptance — real Save As dialog, picker cancellation, download fallback, laptop end-to-end suite, generated-file opening in Draw.io, mobile reachability — is pending). The embedded Draw.io editor remains outside the thin MVP.

---

## 1. Product decision

The Draw.io workflow must remain simple, transparent, portable, and manually recoverable.

```text
Workspace data
→ Quick Report Markdown
→ user reviews and edits Markdown
→ Report Markdown importer
→ field dictionary
→ select one Draw.io template
→ extract {{field name}} placeholders
→ reconcile fields
→ complete missing values in Markdown
→ generate one .drawio output
```

The reviewed Markdown Report is the source of truth.

The Draw.io file is a generated artifact. Draw.io must never become the only location containing report information.

If MarkmapEditor is unavailable, the user must still be able to:

1. open the Markdown Report in another editor;
2. find a field such as `{{summary}}`;
3. open the Draw.io template;
4. find the same `{{summary}}` placeholder;
5. copy the value manually.

No user-facing translation layer is allowed.

---

## 2. Locked MVP rules

1. Use the exact same visible token syntax everywhere:

   ```text
   {{field name}}
   ```

2. Field normalization may only:

   - trim whitespace inside braces;
   - collapse repeated internal spaces;
   - lowercase letters.

3. Field normalization must not:

   - translate languages;
   - guess synonyms;
   - convert visible spaces to underscores;
   - remove unknown fields.

4. One reviewed Markdown Report is reconciled with one Draw.io template.

5. The first MVP accepts **uncompressed Draw.io XML only**.

6. The template remains unchanged. Generation creates a new output string/file.

7. Unknown or unresolved placeholders remain visible and are reported.

8. Missing values are maintained in Markdown under a stable section:

   ```md
   ## Template Fields

   {{customer}}:
   {{region}}:
   {{ali summary}}:
   ```

9. No customer, owner, Project, Task, or Tag grouping is implemented in this MVP.

10. No embedded Draw.io editor is implemented in this MVP.

---

## 3. Why uncompressed Draw.io XML is required initially

The `.drawio` document model is XML-based. Draw.io can expose and accept diagram XML, and uncompressed XML is inspectable and editable outside MarkmapEditor.

For the first integration:

```text
Template requirement:
Uncompressed .drawio XML
```

This keeps the implementation:

- browser-native;
- dependency-free;
- diffable;
- manually repairable;
- compatible with ordinary text tools.

Compressed Draw.io payload support is deferred until after the end-to-end MVP works.

---

## 4. Canonical field syntax

### Standard examples

```text
{{title}}
{{summary}}
{{highlights}}
{{risks}}
{{next steps}}
{{management notes}}
```

### Manual template-specific examples

```text
{{customer}}
{{region}}
{{ali summary}}
{{customer decision}}
{{regional risk}}
```

### Current automatic content

Current Report sections such as Completed Tasks, Project Forecast, and Forecast Totals may be imported as section-derived fields.

Conceptual keys:

```text
{{completed tasks}}
{{project forecast}}
{{forecast totals}}
```

The first MVP may populate these as complete Markdown/text blocks. It does not split them automatically by customer or owner.

---

## 5. Reviewed Markdown import contract

The Report Markdown importer produces a plain serializable projection.

```js
{
  ok,
  metadata,
  title,
  fields,
  fieldOrder,
  sections,
  sourceMarkdown,
  diagnostics
}
```

### Required import sources

- leading Report frontmatter;
- first H1 title;
- known H2 sections;
- token-value lines such as `{{customer}}: Alibaba`;
- the `## Template Fields` section;
- unknown custom sections, preserved as section content where practical.

### Standard section mapping

```text
# Report title
→ title

## Summary
→ summary

## Highlights
→ highlights

## Completed Tasks
→ completed tasks

## Project Forecast
→ project forecast

## Forecast Totals
→ forecast totals

## Risks and Attention Points
→ risks

## Next Steps
→ next steps

## Management Notes
→ management notes
```

The importer must not rescan the Workspace Index or regenerate the Report.

Manual edits in the current Markdown are authoritative.

---

## 6. Draw.io template contract

A template is a user-selected uncompressed `.drawio` or `.xml` file containing visible placeholders.

Example cell label:

```text
Executive Summary
{{summary}}
```

Example template-specific field:

```text
Customer
{{customer}}
```

The reconciler scans the XML source for `{{...}}` tokens without interpreting Draw.io layout, shape geometry, style, or relationships.

The renderer replaces only known placeholder text. It must not:

- move objects;
- resize shapes;
- modify connectors;
- modify styles;
- modify page structure;
- overwrite the template file.

---

## 7. Reconciliation result

The reconciler returns:

```js
{
  ok,
  placeholders,
  fields,
  matched,
  missingValues,
  unknownPlaceholders,
  unusedFields,
  diagnostics
}
```

### Definitions

**Matched**

A template placeholder has a nonblank Markdown value.

**Missing value**

The Markdown contains the field, but its value is blank.

**Unknown placeholder**

The template contains a field that does not exist in the imported Markdown.

**Unused field**

The Markdown contains a field with no destination in the selected template.

Unknown placeholders and missing values are not deleted.

---

## 8. Missing-field workflow

When the selected template contains unresolved placeholders:

```text
Template placeholder
→ unresolved
→ show in review
→ add to Markdown under ## Template Fields
→ user fills value
→ reconcile again
```

Example insertion:

```md
## Template Fields

{{customer}}:
{{customer decision}}:
{{ali summary}}:
```

The Markdown remains canonical after the user fills the values.

The UI must not hold the only copy of manually entered values.

---

## 9. Output generation

Generation inputs:

```text
validated uncompressed template XML
+
reconciled Markdown fields
```

Generation output:

```text
new uncompressed .drawio XML string
```

Suggested filename:

```text
<report-name>-visual.drawio
```

The template file is never overwritten automatically.

The output remains editable in Draw.io/diagrams.net.

---

## 10. UI MVP

The UI may be a compact overlay or dedicated Report action surface.

Required actions:

```text
Select Draw.io Template
Review Fields
Add Missing Fields to Markdown
Generate Draw.io
Cancel
```

Required review groups:

```text
Matched
Missing Values
Unknown Template Fields
Unused Markdown Fields
```

The MVP does not require a live Draw.io preview.

---

## 11. Proposed modules

### 11.1 `js/report/report-markdown-import.js`

Pure module.

Responsibilities:

- recognize Report Markdown from leading frontmatter;
- parse frontmatter metadata;
- extract title;
- extract known sections;
- extract all `{{field name}}: value` lines;
- parse `## Template Fields`;
- preserve custom fields;
- return diagnostics;
- never mutate source Markdown.

Export:

```js
globalThis.MME_REPORT_MARKDOWN_IMPORT
```

### 11.2 `js/report/drawio-report-reconciler.js`

Pure module.

Responsibilities:

- normalize field names;
- extract `{{field name}}` placeholders from Draw.io XML;
- reconcile placeholders with imported Markdown fields;
- build missing `Template Fields` Markdown;
- populate an uncompressed Draw.io XML string;
- preserve unknown placeholders;
- never access DOM or file handles.

Export:

```js
globalThis.MME_DRAWIO_REPORT_RECONCILER
```

H2 implementation status: complete (committed at `f1a82b5`; XML declaration
and BOM assessment compatibility added at `3ab7f65`; registered via
`js/app/script-loader.js`; validator passes 101/101 in Node with honest
totals; sanitized H1-to-H2 integration passes).

Current H2 limitations:

- uncompressed XML only (compressed payloads rejected, not decoded);
- direct textual token replacement only;
- no semantic Draw.io editing;
- no compressed payload decoding;
- no UI;
- no template picker;
- no output Save As;
- no grouping.

### 11.3 Reconciliation UI owner

Implementation file:

```text
js/report/drawio-report-panel.js
```

Currently implemented (H3, committed at `a1c39dc`). The reconciled UI owns:

- Report-gated entry;
- template selection;
- template assessment (compressed/invalid blocking);
- the four reconciliation categories (Matched, Missing Values, Unknown Template
  Placeholders, Unused Report Fields);
- occurrence display;
- Add Missing Fields (insert absent tokens only into `## Template Fields`);
- Reconcile Again;
- the temporary in-memory session lifecycle;
- the single responsive overlay;
- light/dark mode support;
- the "How it works" guidance box.

H3 does not own output delivery. H4 owns output delivery (implemented at
`2c03960`; flexible partial generation, aggregation, and picker compatibility
at `3ab7f65`; cleanup at `4541709`; APIs on
`globalThis.MME_DRAWIO_REPORT_PANEL`:

- final current-Markdown reread on every generation attempt;
- final H1 import and final H2 reconciliation reruns — deterministic two-pass
  reconciliation when the template opts in via `{{unused report fields}}`
  (PASS 1 classifies; a derived field with `source: 'derived'` is added to a
  non-mutated effective projection; PASS 2 drives the gate and population);
- the flexible generation gate: missing values, unknown template placeholders,
  and unused Report fields never block; blocked only by in-progress generation,
  non-Report, no session, no/invalid/compressed/no-placeholder templates, or no
  matched field with a nonblank value (`no-populated-fields`);
- intentional partial output: matched nonblank values populated exclusively
  through H2 `populateTemplate()`; blank matched and unknown placeholders remain
  visible with intact braces; structural verification replaces the former
  unresolved-token rejection;
- generation modes `partial` (with unresolved count) and `complete`;
- the `<report>-visual.drawio` output filename contract (supported Markdown/
  text extensions stripped, invalid characters sanitized, duplicate `-visual`
  prevented, safe `report` fallback base; no path appends `.xml`);
- Save As picker delivery with a writable handle deliberately NOT retained as
  `currentSaveHandle`, plus an XML Blob download fallback with revoked object
  URL;
- template picker compatibility: `application/octet-stream` mapped to `.drawio`
  and `application/xml` to `.xml` (no duplicate-extension declarations), All
  files retained, files read as text, `file.type` never trusted, H2 content
  assessment authoritative;
- single-owner delivery logging: the main.js adapter emits the final
  saved/delivered/cancelled/failed logs; the panel owns begin/blocked logs,
  visible status, and toasts;
- a concurrency guard blocking duplicate generation and resetting after every
  result;
- cancellation and failure handling: picker cancellation (AbortError) is
  normal and retryable, write/permission failures are structured failures —
  neither produces a false success, and both preserve the H3 session and
  Report;
- state preservation: generated delivery never contaminates the Report
  Markdown, dirty state, `currentSaveHandle`, `currentFileName`, Report
  identity, the H3 template session, Navigation History,
  `WORKSPACE_STATE.activeFile`, Hot Reload ownership, or Report Notes
  configuration; after successful generation another attempt remains allowed;
- aggregation guarantees: no new mxCell elements, no geometry changes, the
  reserved placeholder never enters Markdown via Add Missing Fields, and the
  template controls the aggregate element's location, size, and style.

Browser-only acceptance for this flow (real picker, cancellation, download
fallback, laptop end-to-end suite, generated-file opening in Draw.io, mobile
reachability) is pending.

Real-template desktop acceptance for H3 is pending.

---

## 12. Implementation sequence

### ACT H1: Reviewed Markdown import

Deliver:

- `report-markdown-import.js`;
- deterministic fixtures;
- Report recognition;
- section extraction;
- field extraction;
- source preservation.

No Draw.io UI.

### ACT H2: Draw.io reconciler foundation

Deliver:

- `drawio-report-reconciler.js`;
- placeholder extraction;
- reconciliation result;
- missing Template Fields builder;
- uncompressed XML population;
- deterministic fixtures.

No file picker and no UI.

### ACT H3: Reconciliation UI

Deliver:

- select one template;
- import current saved/reviewed Report Markdown;
- display reconciliation groups;
- add missing fields to Markdown;
- generate output after reconciliation.

No embedded Draw.io editor.

### ACT H4: Output delivery

Deliver:

- Save As `.drawio`;
- suggested filename;
- template remains unchanged;
- fresh-session runtime validation;
- PWA registration only after workflow stability.

---

## 13. Report Notes template persistence

The current repository snapshot describes Report Notes as module-local temporary state and explicitly labels it as never persisted.

This is not a Draw.io blocker.

After the Draw.io MVP, a small preference feature may add:

```text
Save Notes Template
Reset Notes Template
```

Storage:

```text
localStorage
```

Rules:

- one saved template only;
- no versions;
- no template manager;
- workspace-independent user preference;
- Reset restores application defaults.

---

## 14. Deferred intelligence

The following are explicitly deferred:

- group completed Tasks by customer;
- group Projects by customer;
- group Risks by owner;
- group content by Tag;
- customer or person dimensions;
- automatic account-specific placeholder creation;
- automatic Project splitting;
- automatic Task splitting.

Manual template-specific fields are acceptable in the first MVP.

Example:

```text
{{alibaba completed tasks}}:
{{alibaba projects}}:
{{alibaba risks}}:
```

Real Report usage will determine the later grouping architecture.

---

## 15. Out of scope for first MVP

- embedded Draw.io editor;
- live template viewer;
- live output viewer;
- compressed Draw.io payloads;
- multiple templates in one generation;
- template library;
- template versioning;
- template inheritance;
- automatic grouping;
- visual field mapping;
- AI-generated diagrams;
- changing Draw.io geometry or styles;
- treating Draw.io as canonical data.

---

## 16. Acceptance criteria

The MVP is complete when:

1. A reviewed saved Report Markdown is recognized.
2. Manual Markdown edits are imported.
3. One uncompressed Draw.io template can be selected.
4. All `{{field name}}` placeholders are extracted.
5. Matched fields are identified.
6. Blank fields are identified.
7. Unknown template placeholders are identified.
8. Unused Markdown fields are identified.
9. Missing placeholders can be inserted into `## Template Fields`.
10. The user can fill those values in Markdown.
11. Reconciliation can run again.
12. One new editable `.drawio` output is generated.
13. The template remains unchanged.
14. Unknown placeholders remain preserved.
15. The entire workflow can be understood and reproduced manually.

---

## 17. Architecture lock

During ACT H implementation, do not add grouping, an embedded editor, template management, or compressed XML support.

If a limitation is discovered:

```text
finish the thin workflow
→ document the limitation
→ checkpoint the working implementation
→ improve it in a later ACT
```

Do not redesign the workflow in the middle of implementation unless the locked end-to-end path is technically impossible.
