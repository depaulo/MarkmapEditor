# MarkMapJournal Release 40 Dev Status

## Current Architecture Status

### Completed

✅ R-SPLIT1 — Mode Session Manager
✅ R-SPLIT2 — Workspace Parser
✅ R-SPLIT3 — Editor Visibility

✅ R-MULTI1 — Per-mode state
✅ R-MULTI2 — URL startup
✅ R-MULTI3 — Separate Mode windows
✅ R-MULTI4 — Session-aware storage

✅ R-META1 — Frontmatter parser

✅ R-IMAGE1 — Image workflow

✅ R-META2 — Metadata Template Split
✅ R-META3 — Hidden Frontmatter

### Completed

✅ UX-MODE1.2 — Welcome/Help navigation state (origin tracking, requestAnimationFrame transitions, button always visible)
✅ R-LINK1 — Wiki Links (parse, resolve, open via existing workspace paths)
✅ R-TASK2 — Task Search and Status Filters (open/completed/all, text search, source navigation)
✅ R-TASK3 — Task Priority Parsing and Actions (#p1/#p2/#p3, priority filters, set/clear priority)

### In Progress

🔄 R-SPLIT4 — Render Pipeline Stabilization
🔄 R-RENDER1 — Centralized Render Orchestration

---

# Roadmap

## PHASE A — Architecture Stabilization

### R-SPLIT4
Render Pipeline Stabilization

**Goal:**
Extract render debounce, Markmap setData, HTML refresh, and scroll sync into a render controller.

**Status:**
In Progress

**Priority:**
High

--------------------------------------------------

### R-RENDER1
Centralized Render Orchestration

**Goal:**
Prevent stale overlapping renders and centralize render orchestration.

**Status:**
In Progress

**Priority:**
High

---

## PHASE B — Metadata Foundation

### R-META2
Metadata Template Split

**Goal:**
Separate metadata generation from body templates.

**Status:**
Completed

**Priority:**
High

--------------------------------------------------

### R-META3
Hidden Frontmatter

**Goal:**
Hide metadata visually while preserving complete Markdown source.

**Status:**
Completed

**Priority:**
High

--------------------------------------------------

### R-META4
Metadata Panel

**Goal:**
Visual metadata editor.

**Status:**
Planned

**Priority:**
Medium

---

## PHASE C — Knowledge Navigation

### R-LINK1
Wiki Links

**Goal:**

Support:

[[AlibabaCloud]]
[[ByteDance]]
[[MeetingName]]

**Features:**

- clickable in CodeMirror
- clickable in Markmap
- clickable in HTML Preview
- open workspace file
- identify missing targets

**Priority:**
Very High

--------------------------------------------------

### R-LINK2
Backlinks

**Goal:**

Provide reverse references.

**Example:**

AlibabaCloud

Referenced By:
- ByteDance Meeting
- Capacity LATAM
- Brazil BD Plan

**Priority:**
High

**Depends On:**
R-LINK1

---

## PHASE D — Task Management

### R-TASK2
Task Search

**Goal:**

Search:

- Open Tasks
- Completed Tasks
- All Tasks

Search by:

- text
- file
- tag

**Examples:**

ANATEL
ByteDance
BOM

**Priority:**
Very High

--------------------------------------------------

### R-TASK3
Task Priority

**Goal:**

Support priorities directly in Markdown.

**Recommended syntax:**

- [ ] Contact China Telecom #p1
- [ ] Review BOM #p2
- [ ] Cleanup notes #p3

**Priority levels:**

P1
P2
P3

**Filters:**

All
Open
Completed
P1
P2
P3

**Priority:**
Very High

--------------------------------------------------

### R-TASK4
Waiting / Delegated Tasks

**Goal:**

Support:

#waiting

**Examples:**

- [ ] Waiting for Christine BOM #waiting
- [ ] Waiting for GC confirmation #waiting

**Future filters:**

Waiting
Open
Completed

**Priority:**
Medium

**Depends On:**
R-TASK2

---

## PHASE E — Business Knowledge Layer

### R-BIZ1
Company Type

**Goal:**

Support:

type: company

**Status:**
Planned

--------------------------------------------------

### R-BIZ2
Company Knowledge Views

**Goal:**

Treat companies as specialized concepts.

**Examples:**

Alibaba
ByteDance
Tencent
DiDi
China Telecom

**Status:**
Planned

--------------------------------------------------

### R-BIZ3
Company Rollups

**Goal:**

Aggregate:

- meetings
- tasks
- contacts
- projects

**Status:**
Planned

**Depends On:**

R-LINK1
R-LINK2
R-META4

---

## PHASE F — Diagram Layer

### R-DIAGRAM1
Mermaid

**Status:**
Planned

**Priority:**
Lower

--------------------------------------------------

### R-DIAGRAM2
Draw.io Assets

**Status:**
Planned

**Priority:**
Lower

---

## PHASE G — Canvas Layer

### R-CANVAS1

**Goal:**

Separate visual diagram workspace.

**Status:**
Planned

**Priority:**
Low

---

# Project Direction

The application is evolving toward:

**Knowledge Workspace**
+
**Project Workspace**
+
**Task Workspace**

## Primary Use Cases

- Journals
- Concepts
- Companies
- Meetings
- Business Development
- Opportunity Tracking
- Knowledge Navigation

## Short-term Priorities

1. Render stabilization
2. Metadata foundation
3. Wiki links
4. Task search
5. Task priorities
6. Metadata panel

**Business layer depends on those foundations.**

---

# Report Mode Roadmap

Status:
PLANNED — NOT IMPLEMENTED — NOT RUNTIME-REACHABLE

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

# Verification

## R-LINK1 — Wiki Links

Verify:

- [ ] Editor links open files
- [ ] Markmap links open files
- [ ] HTML Preview links open files
- [ ] Missing links identified

--------------------------------------------------

## R-TASK2 — Task Search

Verify:

- [ ] Completed tasks searchable
- [ ] Open tasks searchable
- [ ] Filters correct

--------------------------------------------------

## R-TASK3 — Task Priority

Verify:

- [ ] P1 detected
- [ ] P2 detected
- [ ] P3 detected
- [ ] Priority filters work

--------------------------------------------------

## R-LINK2 — Backlinks

Verify:

- [ ] Backlinks update correctly
- [ ] Renames handled safely
