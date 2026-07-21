# MarkmapEditor
Single File Markmap Editor

## Report Mode

Report Mode allows users to generate Draw.io-based project reports from Markdown.

Source files:

- `reports/report.md`
- `templates/report-template.drawio`

Generated files:

- `generated/report-output.drawio`
- `generated/report-output.pptx` (future optional export)

Report Mode layout:

- Left: Markdown Editor
- Middle Top: Markmap Viewer
- Middle Bottom: Draw.io Template Viewer
- Right: Draw.io Output Viewer

Workflow:

1. Human or AI updates `report.md`.
2. User opens Report Mode.
3. The Markdown Editor shows the report source on the left.
4. The Markmap Viewer shows the report structure in the middle-top pane.
5. The Draw.io Template Viewer shows the layout template in the middle-bottom pane.
6. User clicks Render Report.
7. App generates `report-output.drawio`.
8. The Draw.io Output Viewer shows the rendered report on the right side.
9. Future export can generate `report-output.pptx` from `report-output.drawio` without Pandoc.

Report Mode does not require Pandoc.

Pandoc remains available for the existing Slides mode until the Draw.io-based workflow is validated.

Ownership model:

- AI owns `report.md`.
- Human owns `report-template.drawio`.
- Renderer owns `report-output.drawio`.
- PPT exporter owns `report-output.pptx`.
