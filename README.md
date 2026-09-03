# MarkmapEditor

Single File Markmap Editor

## Screen Layout

Panes (Sidebar, Editor, Markmap, HTML Preview) compose horizontally. Use the
toolbar **Layout** selector to apply the **Work**, **Review**, **Presentation**,
or **Focus** presets; manual pane changes mark the preset as customized. Each
visible pane has its own Hide control with an edge restore tab, and a local
fullscreen action with a shared exit control (Escape also exits).
**Presentation** offers **Quick Edit** in the toolbar, which opens the real
editor without leaving the presentation. On narrow or touch screens the toolbar
scrolls horizontally and splitters have enlarged touch lanes for finger
resizing.

## Quick Report

Quick Report Markdown generation is available from your Journal workspace. A reviewed weekly report can be generated directly from existing workspace, Task, and Project data, then edited as Markdown.

## Reviewed Report Markdown importer (H1)

The reviewed Report Markdown importer is implemented as an internal foundation module (`globalThis.MME_REPORT_MARKDOWN_IMPORT`). It parses and imports reviewed Report Markdown but exposes no user-facing button or workflow of its own.

## Draw.io output

A reviewed Report can be reconciled with an uncompressed Draw.io template (`.xml` or `.drawio`) inside the Report reconciliation overlay, using exact `{{field name}}` tokens (for example `{{summary}}`, `{{customer}}`, `{{ali summary}}`) with no user-facing translation or synonym layer. Templates beginning with a standard XML declaration (`<?xml version="1.0" ... ?>`) and optional UTF-8 BOM are accepted; compressed Draw.io payloads are detected and rejected.

**Generate Draw.io** supports intentional partial generation: matched values are populated, and any unresolved placeholders (missing values, unknown template placeholders) remain visible in the output for later completion — as long as at least one matched field has a value. Optionally, add `{{unused report fields}}` to a template text element to include all remaining nonblank Report fields that have no other template destination.

Output is delivered via Save As with a suggested `<report-name>-visual.drawio` filename (download fallback when the Save As picker is unavailable). Android/Chrome picker compatibility for `.drawio` files classified as BIN / `application/octet-stream` is built in; content is always validated as uncompressed Draw.io XML regardless of extension or MIME type.

The built-in Draw.io visual editor is **not included**. Generated output must be opened externally in Draw.io.

See `docs/architecture/MarkmapEditor_Drawio_Report_MVP_ARCHITECTURE.md` for the locked architecture.

Read the following documents to understand the project guidelines and principles:

- docs/PRODUCT_PRINCIPLES.md
- docs/AI_DEVELOPMENT_WORKFLOW.md
- docs/AI_DEVELOPMENT_ENVIRONMENT.
- Architecture documents: `docs/architecture/`
