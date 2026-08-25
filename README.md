# MarkmapEditor
Single File Markmap Editor

## Quick Report

Quick Report Markdown generation is available from your Journal workspace. A reviewed weekly report can be generated directly from existing workspace, Task, and Project data, then edited as Markdown.

## Reviewed Report Markdown importer (H1)

The reviewed Report Markdown importer is implemented as an internal foundation module (`globalThis.MME_REPORT_MARKDOWN_IMPORT`). It parses and imports reviewed Report Markdown but exposes no user-facing button or workflow of its own.

## Draw.io output

Visual Draw.io generation is **not yet available**. When delivered, the Markdown-to-Draw.io contract uses exact `{{field name}}` tokens (for example `{{summary}}`, `{{customer}}`, `{{ali summary}}`) with no user-facing translation or synonym layer.

See `docs/architecture/MarkmapEditor_Drawio_Report_MVP_ARCHITECTURE.md` for the locked architecture.
