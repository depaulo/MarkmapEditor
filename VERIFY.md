# Verification Checklist

## Boot

- [ ] App opens in browser preview
- [ ] No red console errors
- [ ] Markmap renders
- [ ] CodeMirror loads
- [ ] Editor typing updates map
- [ ] Logs panel opens

## Existing features

- [ ] Open file
- [ ] Save file
- [ ] Save fallback/download
- [ ] Recent files menu
- [ ] Templates menu
- [ ] Pandoc templates menu
- [ ] Add image menu
- [ ] Export Markdown
- [ ] Export SVG
- [ ] Export HTML Preview
- [ ] HTML Preview opens/closes
- [ ] Dark mode
- [ ] Compact mode
- [ ] Map style modal

## PWA

- [ ] manifest loads
- [ ] sw.js registers
- [ ] css loaded/cached
- [ ] js/main.js loaded/cached
- [ ] js/editor/* loaded/cached
- [ ] js/core/* loaded/cached
- [ ] js/workspace/* loaded/cached
- [ ] js/export/* loaded/cached

## UX-MODE1.2 — Welcome / Help Navigation

- [ ] Welcome opens on first visit
- [ ] Welcome Reference (Editor) → Help opens, Welcome hides
- [ ] Welcome Reference (Journal) → Help opens, Welcome hides
- [ ] Welcome Reference (Slides) → Help opens, Welcome hides
- [ ] Help Back to Welcome button visible
- [ ] Help → Back to Welcome → Welcome appears, Help closes
- [ ] Repeated Welcome→Help→Back cycle works without errors
- [ ] Toolbar Help opens correctly
- [ ] Toolbar Help → Back to Welcome works
- [ ] No overlay overlap or click-through
- [ ] Mode/document/dirty state preserved after navigation

## R-LINK1 — Wiki Links

### Parser
- [ ] [[Target]] parsed correctly
- [ ] [[Target|Label]] parsed correctly (alias support)
- [ ] Source preserved (no mutation)
- [ ] Multiple links per line supported
- [ ] Empty targets rejected
- [ ] Code fence exclusion attempted if safe

### Resolver
- [ ] Exact workspace-relative path resolves
- [ ] Exact filename (with .md) resolves
- [ ] Exact basename (without .md) resolves
- [ ] H1/title match resolves
- [ ] Case-insensitive fallback works
- [ ] Missing target detected (status: missing)
- [ ] Ambiguous target detected (status: ambiguous)
- [ ] Existing workspace index reused (no second scanner)

### CodeMirror
- [ ] Wiki links decorated with visual style
- [ ] Normal editing preserved (no forced navigation)
- [ ] Ctrl/Cmd+Click opens target
- [ ] Missing link style distinct
- [ ] Ambiguous link style distinct
- [ ] No dirty state changes from decoration
- [ ] Decoration refresh after document change

### HTML Preview
- [ ] Wiki links rendered as clickable elements
- [ ] data-wiki-target attribute used for delegation
- [ ] Normal Markdown links preserved
- [ ] No HTML injection
- [ ] Standalone export behavior safe

### Markmap
- [ ] MarkmapJump preserved (normal click)
- [ ] Node folding preserved
- [ ] Wiki link integration implemented or postponed with documentation
- [ ] If implemented: Ctrl/Cmd+Click opens target
- [ ] If postponed: STATUS.md documents pending status

### Opening
- [ ] Existing workspace file-open path reused (openWorkspaceFile)
- [ ] Dirty confirmation preserved
- [ ] Active highlight updated
- [ ] Render Controller preserved
- [ ] lastActiveFile preserved

### Metadata Compatibility
- [ ] R-META2 composed documents work with links
- [ ] R-META3 hidden frontmatter preserved
- [ ] Show/Hide Metadata continues working
- [ ] Complete source preserved in editor

## R-LINK2 — Backlinks

- [ ] Backlinks update correctly
- [ ] Renames handled safely
- [ ] Depends on R-LINK1

## R-TASK2 — Task Search

- [ ] Completed tasks searchable
- [ ] Open tasks searchable
- [ ] Filters correct

## R-TASK3 — Task Priority

- [ ] P1 detected
- [ ] P2 detected
- [ ] P3 detected
- [ ] Priority filters work

## R-TASK4 — Waiting / Delegated

- [ ] #waiting detected
- [ ] Waiting filter works
- [ ] Depends on R-TASK2
