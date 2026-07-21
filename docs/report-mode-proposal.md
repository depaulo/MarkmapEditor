# Report Mode Proposal

Status:
PLANNED — NOT IMPLEMENTED — NOT RUNTIME-REACHABLE

Implementation must not begin until the current runtime-integration package has passed browser validation and a dedicated Report Mode architecture review has been approved.

---

## Objective

Add a new application context called "Report Mode" to MarkmapEditor.

The long-term goal is to create a Draw.io-only reporting and presentation workflow that can eventually reduce or replace the need for Pandoc Slides, if the new workflow proves successful.

Important:

- Do NOT remove the current Pandoc Slides mode yet.
- Keep Slides/Pandoc mode working as-is.
- Build Report Mode as a parallel, additive feature.
- After Report Mode is validated, the project owner may decide whether to simplify the app and reduce or remove Pandoc Slides.

Report Mode should be based on:

    report.md
        +
    report-template.drawio
        ↓
    Report Renderer
        ↓
    report-output.drawio

Future export:

    report-output.drawio
        ↓
    SVG or PNG export
        ↓
    report-output.pptx

Pandoc should NOT be required for Report Mode.

Pandoc should remain available only for the existing Slides mode until a later project decision is made.

---

## Core Principle

Report Mode should use Draw.io as the visual source of truth.

Markdown provides content.

Draw.io provides layout.

The renderer connects both.

Conceptually:

    Markdown = content
    Draw.io Template = layout
    Draw.io Output = rendered report
    PPT = optional derived presentation artifact

This is similar to:

    HTML + CSS + Rendered Page

but using:

    Markdown + Draw.io Template + Draw.io Output

---

## New App Context

Add a fourth app context:

    editor
    journal
    slides
    report

Suggested context definition:

report: {
    id: "report",
    label: "MarkMap Report",
    shortLabel: "Report",
    templateLabel: "Report Templates",
    defaultFileName: "report.md",
    showWorkspace: false,
    showJournalControls: false,
    showPandocTools: false,
    showReportTools: true,
    defaultMarkdown: `# Project Report

## Highlights

### Alibaba

- Item 1
- Item 2

### ByteDance

- Item 1

### Tencent

- Item 1

## Projects

### Alibaba

#### Brasil

##### Brasil - Phase 1

Forecast: 1.2M

Period:
26Q2~27Q1

Comments:
Waiting contract

## Notes

- General comment 1
`
}

---

## Report Mode Layout

Current general layout:

    Editor
    Markmap Viewer
    HTML Viewer

New Report Mode layout:

    LEFT:
        Markdown Editor

    MIDDLE:
        Top: Markmap Viewer
        Bottom: Draw.io Template Viewer

    RIGHT:
        Draw.io Output Viewer

ASCII layout:

    +----------------------+------------------------------+------------------------------+
    |                      |                              |                              |
    |                      |       Markmap Viewer         |                              |
    |                      |                              |                              |
    |                      |------------------------------|                              |
    |   Markdown Editor    |                              |    Draw.io Output Viewer     |
    |                      |   Draw.io Template Viewer    |                              |
    |                      |                              |                              |
    +----------------------+------------------------------+------------------------------+

Meaning:

    LEFT COLUMN:
        Markdown Editor

    MIDDLE COLUMN:
        Top: Markmap Viewer
        Bottom: Draw.io Template Viewer

    RIGHT COLUMN:
        Draw.io Output Viewer

Recommended proportional widths:

    Editor:
        30%

    Middle Column:
        35%

    Right Output Viewer:
        35%

Recommended middle column height split:

    Markmap Viewer:
        45%

    Draw.io Template Viewer:
        55%

Alternative proportions can be adjusted later.

---

## Report Mode Screen Structure

Recommended DOM-level structure:

    #layout.report-layout
        #editor

        .splitter

        #viewer.report-viewer

            #reportMiddleColumn

                #reportMarkmapPane
                    #mapPane
                        #mapSvg

                .reportVerticalSplitter

                #drawioTemplatePane
                    #drawioTemplateFrame
                    or
                    #drawioTemplatePreview

            .splitter

            #drawioOutputPane
                #drawioOutputFrame
                or
                #drawioOutputPreview

Important:

- In Report Mode, the HTML Viewer should not be the primary third pane.
- HTML Viewer can be hidden or disabled in Report Mode.
- Markmap Viewer remains visible in the middle-top area.
- Draw.io Template Viewer appears in the middle-bottom area.
- Draw.io Output Viewer appears on the right side.
- The Editor remains on the left side.
- If screen space is limited, add toggles to show/hide:
    - Markmap
    - Template
    - Output

---

## Report Mode Files

Source content:

    reports/report.md

Template layout:

    templates/report-template.drawio

Generated output:

    generated/report-output.drawio

Future presentation output:

    generated/report-output.pptx

Optional future image outputs:

    generated/report-output-slide-01.png
    generated/report-output-slide-02.png
    generated/report-output-slide-03.png

Optional future SVG outputs:

    generated/report-output-slide-01.svg
    generated/report-output-slide-02.svg
    generated/report-output-slide-03.svg

Optional future assets:

    assets/companies/alibaba.png
    assets/companies/bytedance.png
    assets/companies/tencent.png

---

## Ownership Model

AI owns:

    report.md

Human owns:

    report-template.drawio

Renderer owns:

    report-output.drawio

Future PPT exporter owns:

    report-output.pptx

Rules:

- AI should generate or update report.md only.
- AI should not modify report-template.drawio.
- Renderer should not modify report-template.drawio.
- Renderer should generate report-output.drawio.
- PPT exporter should generate report-output.pptx from report-output.drawio.
- User can manually edit report-output.drawio if needed.
- report-output.drawio is disposable and can be regenerated.
- report-template.drawio is the visual source of truth.
- report.md is the content source of truth.
- report-output.drawio is the generated editable Draw.io artifact.
- report-output.pptx is a derived presentation artifact.

---

## Placeholder Strategy

The Draw.io template should contain text placeholders.

Examples:

    {{H-ALI}}
    {{H-BYT}}
    {{H-TEN}}

    {{P-ALI}}
    {{P-BYT}}
    {{P-TEN}}

    {{NOTES}}

    {{IMG-ALI}}
    {{IMG-BYT}}
    {{IMG-TEN}}

Initial implementation should support text placeholders only.

Renderer behavior:

    1. Load report-template.drawio
    2. Parse report.md
    3. Build replacement map
    4. Replace placeholders in Draw.io XML
    5. Save generated/report-output.drawio
    6. Refresh Draw.io Output Viewer

Renderer must NOT:

    - move objects
    - resize objects
    - change colors
    - change fonts
    - change page structure
    - modify template file directly

Renderer only replaces placeholder text in the generated output file.

---

## Markdown Structure for Report Mode

Use Markdown as the content source instead of YAML.

Example:

# Project Report

## Highlights

### Alibaba

- Forecast updated
- Brazil Phase 1 under discussion

### ByteDance

- Workshop completed

### Tencent

- Commercial discussion opened

## Projects

### Alibaba

#### Brasil

##### Brasil - Phase 1

Forecast: 1.2M

Period:
26Q2~27Q1

Comments:
Waiting contract

##### Brasil - Phase 2

Forecast: 800K

Period:
27Q2~27Q4

Comments:
Scope under review

### ByteDance

#### México

##### México - Phase 1

Forecast: 500K

Period:
26Q3~27Q2

Comments:
Initial alignment required

### Tencent

#### SOLA

##### Country - Phase 1

Forecast: 700K

Period:
26Q4~27Q3

Comments:
Pipeline qualification

## Notes

- General comment 1
- General comment 2

---

## Report Render Command

Add a new command:

    Render Report

Suggested button label:

    Render Report

Suggested menu location:

    Report toolbar group

Alternative menu location:

    Export menu

Suggested workflow:

    User edits report.md
        ↓
    Markmap Viewer updates automatically
        ↓
    User clicks Render Report
        ↓
    App parses Markdown
        ↓
    App loads report-template.drawio
        ↓
    App replaces placeholders
        ↓
    App writes report-output.drawio
        ↓
    App refreshes Draw.io Output Viewer

Optional future shortcut:

    Ctrl + Shift + R

---

## Draw.io Viewers

Add two Draw.io-related viewer panes in Report Mode:

1. Draw.io Template Viewer

Location:

    Middle column, bottom pane

Purpose:

    Show report-template.drawio

Behavior:

    - read-only preview in V1
    - later allow open/edit in external Draw.io
    - later allow reload template
    - should never be overwritten by renderer

2. Draw.io Output Viewer

Location:

    Right column

Purpose:

    Show report-output.drawio

Behavior:

    - read-only preview in V1
    - refresh after Render Report
    - allow export/download output
    - later allow open/edit in external Draw.io
    - can always be regenerated

---

## Report Mode View Controls

Add view controls for Report Mode:

    [Markmap]
    [Template]
    [Output]
    [Render Report]
    [Reload Template]
    [Reload Output]

Minimum V1 behavior:

    - Editor always visible on the left
    - Markmap visible in the middle-top
    - Template visible in the middle-bottom
    - Output visible on the right

Future compact behavior:

    - Editor left
    - Middle column allows Markmap/Template toggle
    - Right column always shows Output

---

## CSS / Layout Guidelines

Use CSS class or html dataset to activate Report Mode layout:

    html[data-app-context="report"]

Suggested CSS behavior:

    html[data-app-context="report"] #htmlPane {
        display: none;
    }

    html[data-app-context="report"] #layout {
        display: flex;
        flex-direction: row;
    }

    html[data-app-context="report"] #editor {
        flex: 0 0 30%;
        min-width: 260px;
    }

    html[data-app-context="report"] #viewer {
        flex: 1 1 70%;
        display: flex;
        flex-direction: row;
        min-width: 0;
    }

    html[data-app-context="report"] #reportMiddleColumn {
        flex: 1 1 50%;
        display: flex;
        flex-direction: column;
        min-width: 260px;
        min-height: 0;
    }

    html[data-app-context="report"] #reportMarkmapPane {
        flex: 1 1 45%;
        min-height: 200px;
        min-width: 0;
    }

    html[data-app-context="report"] #drawioTemplatePane {
        flex: 1 1 55%;
        min-height: 220px;
        min-width: 0;
    }

    html[data-app-context="report"] #drawioOutputPane {
        flex: 1 1 50%;
        min-width: 300px;
        min-height: 0;
    }

Keep implementation consistent with existing layout.css and pane architecture.

---

## JavaScript Implementation Plan

PHASE 1: ADD REPORT CONTEXT

Tasks:

- Add report context to APP_CONTEXTS.
- Add Report label to context selector.
- Ensure context switch does not erase current document.
- Add default report.md starter content.
- Add showReportTools flag.

Deliverable:

User can select Report Mode.

--------------------------------------------------

PHASE 2: ADD REPORT LAYOUT

Tasks:

- Add Report-specific DOM containers:
    - reportMiddleColumn
    - reportMarkmapPane
    - drawioTemplatePane
    - drawioOutputPane
- Hide HTML pane in Report Mode.
- Keep Markmap viewer visible in middle-top area.
- Add Draw.io Template Viewer in middle-bottom area.
- Add Draw.io Output Viewer on right side.
- Ensure switching back to Editor, Journal, or Slides restores existing behavior.

Deliverable:

Report Mode layout visible.

--------------------------------------------------

PHASE 3: ADD DRAW.IO PREVIEW PANES

Tasks:

- Add placeholder preview containers.
- Initially support loading Draw.io XML as raw XML text preview if full render is not ready.
- Later support iframe or embedded Draw.io viewer.
- Add reload buttons:
    - Reload Template
    - Reload Output

Deliverable:

Template and Output panes can display content.

--------------------------------------------------

PHASE 4: ADD PLACEHOLDER ENGINE

Tasks:

- Implement parser for report.md.
- Build a simple replacement map:
    - H-ALI
    - H-BYT
    - H-TEN
    - NOTES
- Load report-template.drawio.
- Replace placeholders:
    - {{H-ALI}}
    - {{H-BYT}}
    - {{H-TEN}}
    - {{NOTES}}
- Save generated output as report-output.drawio.

Deliverable:

Text placeholder replacement works.

--------------------------------------------------

PHASE 5: ADD RENDER REPORT COMMAND

Tasks:

- Add toolbar or menu item:
    Render Report
- Connect button to placeholder engine.
- Show toast on success/failure.
- Log render steps.
- Refresh Output Viewer after render.

Deliverable:

One-click report generation.

--------------------------------------------------

PHASE 6: ADD LIVE PREVIEW OPTION

Tasks:

- Optional auto-render after Markdown change.
- Debounce render to avoid excessive updates.
- Add toggle:
    Auto Render: On/Off

Deliverable:

Live output preview available.

--------------------------------------------------

PHASE 7: ADD IMAGE PLACEHOLDERS

Tasks:

- Support:
    {{IMG-ALI}}
    {{IMG-BYT}}
    {{IMG-TEN}}
- Use Markdown image references or project asset paths.
- Replace Draw.io image references safely.

Deliverable:

Logo/image replacement.

--------------------------------------------------

PHASE 8: ADD PROJECT BLOCK GENERATION

Tasks:

- Parse Projects section from Markdown.
- Generate project rows.
- Insert rows into placeholder:
    {{PROJECTS-ALI}}
    {{PROJECTS-BYT}}
    {{PROJECTS-TEN}}

Deliverable:

Dynamic project list generation.

--------------------------------------------------

PHASE 9: ADD GANTT / TIMELINE SUPPORT

Tasks:

- Parse project period:
    26Q2~27Q1
- Map period to fixed quarter range:
    26Q1 to 28Q4
- Generate visual representation in Draw.io output.
- Keep template untouched.

Deliverable:

Automatic roadmap rendering.

--------------------------------------------------

PHASE 10: ADD DRAW.IO EXPORTS

Tasks:

- Export report-output.drawio
- Export SVG
- Export PNG

Deliverable:

Presentation-ready Draw.io-based assets.

---

## Report Mode Export V2: PPT Export Without Pandoc

Add as a future export phase after the Draw.io report renderer is stable.

Goal:

Generate a PowerPoint file from the rendered Draw.io output without using Pandoc.

Input:

    generated/report-output.drawio

Process:

    1. Open report-output.drawio
    2. Export each Draw.io page as SVG or PNG
    3. Create a PPTX file
    4. Insert each exported image as one full-slide image
    5. Save as generated/report-output.pptx

Output:

    generated/report-output.pptx

PPT behavior:

    - Non-editable in V1
    - Each slide is an image generated from one Draw.io page
    - Visual fidelity is more important than PowerPoint editability
    - Draw.io remains the master editable format

Recommended first implementation:

    Draw.io page
        ↓
    PNG or SVG
        ↓
    Full-slide image in PPTX

Do NOT attempt native editable PowerPoint shapes in the first version.

Reason:

    - Much simpler
    - More stable
    - Preserves visual design
    - Avoids complex shape conversion
    - Avoids dependency on Pandoc
    - Keeps Draw.io as the source of truth

Future optional advanced implementation:

    Draw.io XML
        ↓
    Convert basic shapes/text/connectors
        ↓
    Native editable PPT objects

This should be considered only after Report Mode is validated.

---

## Draw.io PPT-Like Template Concept

Report Mode should allow Draw.io templates to behave like PPT layouts.

A user should be able to design:

    report-template.drawio

as if it were a slide deck.

Each Draw.io page can represent one slide.

Example:

    Page 1:
        Highlights

    Page 2:
        Projects and Roadmap

    Page 3:
        Comments and Notes

Then the renderer generates:

    report-output.drawio

and the PPT exporter generates:

    report-output.pptx

with:

    Slide 1 = image of Draw.io Page 1
    Slide 2 = image of Draw.io Page 2
    Slide 3 = image of Draw.io Page 3

This creates an alternative to Pandoc Slides:

    Markdown content
        +
    Draw.io slide-like template
        ↓
    Draw.io rendered report
        ↓
    PPT image deck

---

## Relationship with Pandoc Slides

Do not remove Pandoc Slides now.

Current state:

    Slides mode uses Pandoc-oriented Markdown.

Future desired direction:

    Report Mode may become the preferred presentation workflow if validated.

Possible future simplification:

    If Draw.io-based Report Mode works well, evaluate whether Pandoc Slides should be:
        - kept as advanced export mode
        - hidden by default
        - moved to legacy mode
        - removed from the main workflow

Important:

    Report Mode should not depend on Pandoc.

    The Draw.io template should become the primary visual design layer.

    PPT export should be generated from Draw.io output, not from Pandoc.

---

## Report Mode Roadmap

## v0.4 - Report Context Foundation

- Add Report context
- Add report.md starter template
- Add Report-specific layout
- Hide HTML Viewer in Report Mode
- Keep Editor visible on the left
- Keep Markmap Viewer visible in the middle-top area
- Add Draw.io Template Viewer in the middle-bottom area
- Add Draw.io Output Viewer on the right side

## v0.5 - Draw.io Placeholder Rendering

- Add placeholder engine
- Support text replacements
- Generate report-output.drawio
- Add Render Report command

## v0.6 - Report Preview Workflow

- Refresh Draw.io Output Viewer after render
- Add reload buttons for template and output
- Add basic error handling and logs
- Add optional auto-render toggle

## v0.7 - Image Support

- Add image placeholders
- Add logo/image replacement
- Support company assets

## v0.8 - Project Block Generation

- Parse projects from Markdown
- Generate rows from project hierarchy
- Support company sections:
    - Alibaba
    - ByteDance
    - Tencent

## v0.9 - Timeline / Gantt Rendering

- Parse quarter ranges
- Generate timeline bars
- Add project-level Gantt visualization

## v1.0 - Stable Draw.io Report Mode

- Stable Markdown report format
- Stable Draw.io template workflow
- Stable generated Draw.io output
- AI-generated report.md workflow
- GitHub-ready report process

## v1.1 - Draw.io Export Assets

- Export report-output.drawio
- Export SVG
- Export PNG
- Support one image per Draw.io page

## v1.2 - PPT Export Without Pandoc

- Generate report-output.pptx from report-output.drawio
- Use PNG or SVG images as full-slide visuals
- Treat PPT as non-editable presentation output
- Keep Draw.io as master editable format

## v1.3 - Draw.io PPT-Like Templates

- Support Draw.io templates designed as slide decks
- Treat each Draw.io page as one slide
- Generate PPT slides from Draw.io pages
- Evaluate if this workflow can replace or simplify Pandoc Slides

---

## Implementation Rules

1. Do not break Editor mode.
2. Do not break Journal mode.
3. Do not break Slides mode.
4. Do not remove Pandoc Slides yet.
5. Report Mode should be additive.
6. Existing Markmap rendering should continue working.
7. Existing HTML Viewer should remain available outside Report Mode.
8. In Report Mode, HTML Viewer can be hidden.
9. report-template.drawio must never be modified by renderer.
10. report-output.drawio can be regenerated.
11. Keep implementation modular.
12. The left pane must remain the Markdown Editor.
13. The middle pane must be vertically split:
    - top: Markmap Viewer
    - bottom: Draw.io Template Viewer
14. The right pane must be the Draw.io Output Viewer.
15. PPT export must not use Pandoc in Report Mode.
16. PPT export V1 should be image-based and non-editable.
17. Draw.io must remain the master editable format.
18. PPT must be treated as a derived presentation artifact.

---

## Optional Future Advanced PPT Strategy

Do not implement native editable PPT in V1.

Future options:

Option A: Non-editable PPT

    report-output.drawio
        ↓
    SVG or PNG
        ↓
    Insert into PPT

Complexity: Low to Medium

Recommended first implementation.

Option B: Semi-editable PPT

    report-output.drawio XML
        ↓
    Convert basic shapes/text to PPT objects

Complexity: Medium to High

Only consider after Report Mode is validated.

Option C: Fully editable PPT

    Full Draw.io to PowerPoint converter

Complexity: Very High

Not recommended as part of the initial Report Mode roadmap.

Recommendation:

Keep Draw.io as the master format.

Treat PPT as a derived output only.