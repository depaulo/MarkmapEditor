# TODO.md

## PHASE A — Architecture Stabilization

### R-SPLIT4
- [ ] Extract render debounce, Markmap setData, HTML refresh, and scroll sync into render controller
- [ ] Prevent stale overlapping renders

### R-RENDER1
- [ ] Centralize render orchestration
- [ ] Validate render controller integration

---

## PHASE B — Metadata Foundation

### R-META2
- [ ] Separate metadata generation from body templates
- [ ] Compose metadata + body at creation/insertion time
- [ ] Avoid duplicated frontmatter across templates

### R-META3
- [ ] Keep frontmatter in saved Markdown files
- [ ] Hide/collapse frontmatter in normal editor view
- [ ] Add Show Metadata toggle

### R-META4
- [ ] Editable metadata UI for type/date/created/updated/status/tags
- [ ] Tags editable as chips
- [ ] Save recomposes frontmatter + body

---

## PHASE C — Knowledge Navigation

### R-LINK1
- [ ] Support [[WikiLinks]] syntax
- [ ] Make links clickable in CodeMirror
- [ ] Make links clickable in Markmap
- [ ] Make links clickable in HTML Preview
- [ ] Open workspace file on click
- [ ] Identify missing targets

### R-LINK2
- [ ] Provide reverse references (backlinks)
- [ ] Display "Referenced By" section
- [ ] Update backlinks correctly
- [ ] Handle renames safely

---

## PHASE D — Task Management

### R-TASK2
- [ ] Search open tasks
- [ ] Search completed tasks
- [ ] Search all tasks
- [ ] Filter by text
- [ ] Filter by file
- [ ] Filter by tag

### R-TASK3
- [ ] Support #p1, #p2, #p3 priority tags
- [ ] Detect P1 tasks
- [ ] Detect P2 tasks
- [ ] Detect P3 tasks
- [ ] Priority filters (All, Open, Completed, P1, P2, P3)

### R-TASK4
- [ ] Support #waiting tag
- [ ] Waiting filter
- [ ] Delegated task tracking

---

## PHASE E — Business Knowledge Layer

### R-BIZ1
- [ ] Support type: company in frontmatter

### R-BIZ2
- [ ] Company knowledge views
- [ ] Specialized concept treatment for companies

### R-BIZ3
- [ ] Aggregate meetings, tasks, contacts, projects
- [ ] Company rollup views

---

## PHASE F — Diagram Layer

### R-DIAGRAM1
- [ ] Mermaid diagram support in Markdown
- [ ] Render Mermaid in HTML Preview
- [ ] Export Mermaid in HTML export
- [ ] Dark/light mode support

### R-DIAGRAM2
- [ ] Draw.io asset support (.drawio + .svg)
- [ ] Double-click to edit workflow
- [ ] Refresh SVG after save

---

## PHASE G — Canvas Layer

### R-CANVAS1
- [ ] Separate visual diagram workspace

---

## Short-term Priorities

1. [ ] Render stabilization (R-SPLIT4, R-RENDER1)
2. [ ] Metadata foundation (R-META2, R-META3)
3. [ ] Wiki links (R-LINK1)
4. [ ] Task search (R-TASK2)
5. [ ] Task priorities (R-TASK3)
6. [ ] Metadata panel (R-META4)
