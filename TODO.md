# TODO.md

## Completed Core Modules (v58 Functional Recovery)

- [x] Workspace Host Foundation & Registry (registered=2: Journal and Workspace-Index)
- [x] Idempotent Event-Driven Sidebar Panel Lifecycle Finalization (mme-workspace-index-ready)
- [x] Programmatic Text Mutation suppression helper (runProgrammaticTextChange)
- [x] Navigation History V1 Engine (Back & Forward with restore stack protection)
- [x] Journal initialization constraint (initializationCount = 1, legacyAutoInit = false)
- [x] Virtual Workspace Index V1 return-to-workspace and rollback

---

## Current — Draw.io Report MVP Forward Order

Completed (implementation committed; validations below are Node counts):
- [x] ACT G Quick Report + Report lifecycle.
- [x] H1 Reviewed Markdown importer (registered; 39/39 Node).
- [x] H2 reconciler review, registration, and validation (101/101 Node after
  XML declaration compatibility; honest totals, no hidden results).
- [x] H3 reconciliation UI (38/38 Node; core overlay behavior browser-confirmed;
  real-template desktop acceptance pending).
- [x] H4 Draw.io output delivery (committed at `2c03960`).
- [x] H4.1 flexible output: intentional partial generation with unresolved
  placeholder preservation; optional `{{unused report fields}}` aggregation;
  Android `.drawio` picker compatibility (`application/octet-stream`); XML
  declaration/BOM assessment compatibility (validator 107/107 Node;
  committed at `3ab7f65`); validator honesty and single-owner delivery logging
  cleanup (committed at `4541709`).

Completed (Draw.io MVP PWA closure package — source closure complete;
browser acceptance pending):
- [x] Service Worker and APP_VERSION finalization: all six Report modules
  (`js/report/report-markdown-import.js`, `js/report/drawio-report-reconciler.js`,
  `js/report/drawio-report-panel.js`, `js/report/report-dictionary.js`,
  `js/report/quick-report-generator.js`, `js/report/report-panel.js`) are
  precached in `LOCAL_APP_SHELL`; cache identity bumped to
  `markmap-journal-pwa-v61-drawio-report-mvp-v1` (`-app` / `-runtime`);
  activation cleanup narrowed to the `markmap-journal-pwa-` cache prefix;
  `skipWaiting()`/`clients.claim()` lifecycle preserved.
- [x] Cache-manifest and version-consistency validation: `node --check sw.js`
  PASS; every cached path exists; single APP_VERSION owner; old v60 identity
  removed as an active owner; H1 39/39, H2 101/101, H3 38/38, H4 107/107
  validators still pass.

Remaining forward order:

1. Laptop end-to-end acceptance (the next live workflow; covers the H3
   real-template categories and the H4 browser-only items: real Save As,
   picker cancellation, download fallback, partial generation with unresolved
   placeholders, `{{unused report fields}}` aggregation, Android `.drawio`
   selection, XML declaration template, opening the generated `.drawio` in
   Draw.io, mobile reachability).
2. Draw.io MVP closure browser acceptance: clean install, update over the old
   cache, offline boot with the Draw.io modules, and the minimum Draw.io smoke
   test — exact steps in VERIFY.md, "Draw.io MVP PWA closure".
3. Screen improvements (fullscreen Markmap, fullscreen HTML, presentation layout, vertical output).
4. Groups based on real Draw.io usage.
5. Later artifact workflows.

## Short-term Priorities & Remaining Verification

### 1. Mode Session Bridge Verification (Required)
- [ ] Verify Editor and Slides Mode Session text/filename/dirty independence
- [ ] Validate switch sequence: Editor → Slides → Editor → Slides
- [ ] Confirm no state bleed or duplicate registers on DeX/mobile

### 2. Edge Cases and Resilience Validation
- [ ] Validate dirty cancellation and save confirmation rollback edge cases
- [ ] Final security/capabilities audit on the Workspace Host boundary
- [ ] Encapsulate the global runtime registry securely (prevent window pollution)

### 3. Optimization Phase (Deferred)
- [ ] Navigation History performance optimization:
  - Distinguish active-file-only history restoration from workspace-content changes
  - Avoid redundant index rebuilding when workspace files have not mutated
  - Scope presentation-only updates (e.g. active-file highlights) narrowly and safely

---

## Deferred Roadmap (Future Features)

### 1. Projects Workflow (Standalone-First)
- [ ] Implement standalone Markdown project records with structured YAML frontmatter:
  - `type` (project)
  - `id` (unique identifier)
  - `title`
  - `status`
  - `value`
  - `currency`
  - `expected_date` / `order_date`
  - `delivery_date`
  - `group` (optional)
  - `tags`
  - `created`
  - `updated`
- [ ] Render Markdown narrative body as description and notes
- [ ] Group and aggregate totals dynamically by currency
- [ ] Standardize project archiving instead of deletion
- [ ] Decouple from Journal or Groups requirements
- [ ] Integrate optionally with Tasks, Knowledge Base/Journals, or Group filters
- [ ] Export structured source data for Report Mode

### 2. Report Mode & Draw.io
- [ ] Keep Draw.io as the primary editable report template asset (.drawio / .svg)
- [ ] Implement structured template tags to map Markdown data source directly into reports
- [ ] Export filtered/selected project data as CSV for external spreadsheet processing
- [ ] Support round-trip of enriched data to populate Draw.io text layers
- [ ] Keep Markdown narrative available as primary textual content
- [ ] Output presentation-ready PPTX (deferred format, not the primary edit source)
- [ ] Expose dynamic calculations and interactive input fields in Report sidebar

### 3. Reveal.js Presentations
- [ ] Draft specification and build isolated presentation prototype
- [ ] Postpone full runtime integration (deferred PWA integration, script loader additions, Service Worker caching, and SlidesWorkspace alignment)

### 4. Mermaid Diagrams
- [ ] Support Markdown-native Mermaid code-block parsing first
- [ ] Render diagrams within Markmap nodes and HTML preview where feasible
- [ ] Consider a separate standalone Mermaid export workflow in subsequent updates

### 5. Workspace Migrations
- [ ] Migrate the legacy EditorWorkspace, SlidesWorkspace, and future ReportWorkspace to run on top of the centralized Workspace Host foundation.

### Metadata UI, deferred

- [ ] Provide an optional visual editor for supported frontmatter fields.
- [ ] Preserve the complete Markdown source and hidden-frontmatter behavior.
- [ ] Avoid making metadata UI mandatory for standalone Markdown editing.
`
### Relationships and backlinks

- [ ] Audit which R-LINK2 backlink requirements are already covered by Related.
- [ ] Define remaining explicit Referenced By behavior.
- [ ] Defer rename-safe link migration until file rename ownership is defined.

