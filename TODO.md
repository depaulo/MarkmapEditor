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

### R-META2 (Completed)
- [x] Separate metadata generation from body templates
- [x] Compose metadata + body at creation/insertion time
- [x] Avoid duplicated frontmatter across templates

### R-META3 (Completed)
- [x] Keep frontmatter in saved Markdown files
- [x] Hide/collapse frontmatter in normal editor view
- [x] Add Show Metadata toggle

### R-META4
- [ ] Editable metadata UI for type/date/created/updated/status/tags
- [ ] Tags editable as chips
- [ ] Save recomposes frontmatter + body

---

## PHASE C — Knowledge Navigation

### R-LINK1
- [ ] Parse [[WikiLinks]] syntax including [[target|label]] aliases
- [ ] Resolve [[target]] to workspace file via path, filename, basename, H1 title
- [ ] Detect missing targets (no file found)
- [ ] Detect ambiguous targets (multiple matches)
- [ ] CodeMirror: decorate wiki links with visual styles
- [ ] CodeMirror: Ctrl/Cmd+Click opens resolved target
- [ ] HTML Preview: render wiki links as clickable anchors
- [ ] Markmap: wiki link click integration (postponed if unsafe)
- [ ] Open resolved target via existing workspace file-open flow
- [ ] Preserve dirty confirmation, active highlight, Render Controller, lastActiveFile
- [ ] Compatible with R-META3 hidden frontmatter

### R-LINK2
- [ ] Provide reverse references (backlinks)
- [ ] Display "Referenced By" section
- [ ] Update backlinks correctly
- [ ] Handle renames safely
- [ ] Depends on R-LINK1

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
- [ ] Depends on R-TASK2

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
- [ ] Depends on R-LINK1, R-LINK2, R-META4

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
2. [x] Metadata foundation (R-META2, R-META3)
3. [ ] Wiki links (R-LINK1)
4. [ ] Task search (R-TASK2)
5. [ ] Task priorities (R-TASK3)
6. [ ] Metadata panel (R-META4)
