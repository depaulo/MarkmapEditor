# MarkmapEditor
Single File Markmap Editor

## Quick Report

Quick Report Markdown generation is available from your Journal workspace. A reviewed weekly report can be generated directly from existing workspace, Task, and Project data, then edited as Markdown.

## Reviewed Report Markdown importer (H1)

The reviewed Report Markdown importer is implemented as an internal foundation module (`globalThis.MME_REPORT_MARKDOWN_IMPORT`). It parses and imports reviewed Report Markdown but exposes no user-facing button or workflow of its own.

## Draw.io output

A reviewed Report can be reconciled with an uncompressed Draw.io template inside the Report reconciliation overlay, using exact `{{field name}}` tokens (for example `{{summary}}`, `{{customer}}`, `{{ali summary}}`) with no user-facing translation or synonym layer.

When all required fields have values, **Generate Draw.io** creates a new editable `.drawio` file as a separate artifact, delivered via Save As with a suggested `<report-name>-visual.drawio` filename (download fallback when the Save As picker is unavailable).

The built-in Draw.io visual editor is **not included**. Generated output must be opened externally in Draw.io.

See `docs/architecture/MarkmapEditor_Drawio_Report_MVP_ARCHITECTURE.md` for the locked architecture.
