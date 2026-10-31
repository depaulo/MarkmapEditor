# Current Work — MarkmapEditor Package 6

## Identity

- Package: P6
- ACT: ACT 4 ACCEPTED — Package 6 CLOSED
- Name: Expanded-View Behavior and Visual Consistency — Complete
- Branch: development
- Released baseline: 0.7.0
- Target release: 0.8.0
- Status: Package 6 CLOSED; ACT 1 ACCEPTED; ACT 2 (slices 1–3) ACCEPTED; ACT 3 ACCEPTED; ACT 4 ACCEPTED; release activation false

## Objective

Consolidate Workspace Index, Search, and Tags into one Workspace Knowledge
panel with Find Files multi-Tag intersection filtering; add document-scoped
Current Document cards and detail region; prepare 0.8.0 release candidate
(documentation, Help, Release Notes, version/cache boundary) without
activating release.

## Authorized Scope

- Workspace Knowledge panel consolidation (Find Files: Search + Tags);
- document-scoped Current Document cards (Backlog, Open, Ongoing, Done,
  Links In, Links Out) with local transient detail region;
- Sidebar order: Current Document → Workspace Knowledge → Notes → Knowledge →
  Tasks → Projects → Archive → Report;
- Help guidance for Current Document and Workspace Knowledge;
- Release Notes 0.8.0 entry;
- version and cache boundary update (0.7.0 → 0.8.0);
- documentation closure (project-state.json, CURRENT.md, CURRENT_VALIDATION.md,
  P6-CONSISTENCY.md);

## Protected Scope

- no Edit/Read relocation;
- no mode-state change;
- no Active File functional redesign;
- no Task or Project redesign;
- no Reports movement or redesign;
- no Archive-behavior change;
- no Reminders or Highlights;
- no generic panel framework;
- no 0.8.0 activation (activation pending owner authorization);
- no new runtime behavior beyond accepted Package 6 work;
- no validator repairs beyond focused static checks.

## ACT 2 — Completion Record (retained)

ACT 2 Slice 1 — Workspace Index return control + scroll preservation: ACCEPTED (commit 9d01638).

ACT 2 Slice 2 — Inspection and Return Recovery Alignment: ACCEPTED (commits 78a1528 + 85feeac + 13e9b88).

ACT 2 Slice 3 — Overlay Exit, Transient State, and State-Copy Consistency: ACCEPTED (commits 484fd94 + 8431188 + 9399cae).

## ACT 3 — Completion Record (retained)

ACT 3 — Sidebar Information Architecture: ACCEPTED (commit adac27d).
Sidebar order: Current Document → Workspace Knowledge → Notes → Knowledge → Tasks → Projects → Archive → Report.

## ACT 4 — Completion Record

ACT 4 — File Knowledge Cards and Workspace Index Consolidation: ACCEPTED.

Slice 1 — Task-state semantics and canonical projections:
- `js/workspace/file-knowledge-projection.js` — pure, document-scoped
  projection functions; `globalThis.MME_FILE_KNOWLEDGE`.
- Critical semantic fix: `project('open')` → `project('todo')` for mutual
  exclusivity.
- `js/app/script-loader.js` — loads projection module after wiki-links.js.
- Static: `scripts/file-knowledge-projection-validators.cjs`: 30/30 PASS.

Slice 2 — Workspace Knowledge Find Files — Search + multi-Tag consolidation:
- Find Files section under Workspace Knowledge: title, description, Search
  input, Tag chips, Show more/less toggle, results host.
- `workspaceSelectedTags` Set state owner for multi-tag intersection
  filtering.
- `renderWorkspaceFindFiles()` — shared Search + Tag coordinator rendering
  into `#workspaceSearchResults`.
- `normalizeWorkspaceFindFilesOrder()` — enforces DOM order.
- `renderWorkspaceTagsPanel()` chip click handler toggles selection.
- `renderWorkspaceRelatedPanel()` retired (`data-standalone-retired="1"`).
- CSS: Find Files section styling, chip styling, section layout.
- Static: `node --check js/main.js`: PASS; `git diff --check`: PASS.
- Browser acceptance: tag select/deselect, multi-tag intersection, result
  navigation, standalone Links In retired, Current Document functional.

Slice 3 — Current Document document-scoped cards and detail region:
- Six document-scoped cards: Backlog, Open, Ongoing, Done, Links In, Links
  Out.
- Open = canonical `todo` only; categories mutually exclusive.
- Selecting a card opens one local transient detail region; changing document
  clears previous detail.
- Local Task and Link lists are read-only; Task rows navigate to source line;
  relationship rows navigate through existing link/file owners.
- `[ ]` and `[x]` non-interactive status indicators; no Task mutation or Save
  from local controls.

Slice 4 — Workspace Knowledge panel consolidation:
- Workspace Index evolved into one expandable Workspace Knowledge panel.
- Find Files integrates Workspace Search and Tags.
- Search matches existing filename/path contract; Workspace-wide within
  indexed Notes file scope.
- Multiple Tags may be selected; AND semantics; one shared result list.
- Available Tags bounded to ~2 rows; Show more/less control expansion.
- Results vertically bounded (max-height 240px).
- Separate visible Search, Tags, and Links In panels retired; standalone
  Related owner visually hidden and unavailable to keyboard interaction.

Slice 5 — Sidebar order, Help, Release Notes, and Package 6 closure:
- Sidebar order documented and source-proven.
- Help topics added for Current Document and Workspace Knowledge.
- Release Notes 0.8.0 entry added.
- Version/cache boundary updated (0.7.0 → 0.8.0).
- Documentation authorities updated (project-state.json, CURRENT.md,
  CURRENT_VALIDATION.md, P6-CONSISTENCY.md).
- Package 6 runtime committed (adac27d).

## Required Validation

- `git diff --check`
- `node --check js/main.js`
- `node --check js/report/report-panel.js`
- `node -e "JSON.parse(require('fs').readFileSync('project-state.json','utf8')); console.log('project-state.json OK')"`

## Stop Conditions

- a second navigation/history owner would be required;
- persistent browser storage would be required;
- Task Board lifecycle must change;
- Reports runtime must change;
- broad framework extraction would be required;
- 0.8.0 activation without explicit owner authorization.
## Accepted history

- **P6 ACT 1 — accepted** (Projects Source filter, exact `sourcePath`):
  see `docs/packages/P6-CONSISTENCY.md`.
- **P6 ACT 2 Slice 1 — accepted** (owner browser checkpoint 2026-10-18):
  Return-label escaping; Return accessible label; project-filter rerender
  scroll preservation; close/reopen scroll restoration. Static: task/filter,
  Notes, full Projects profile, mutation-anchor, isolated Tier M,
  `git diff --check` — all passed.
- **P6 ACT 2 Slice 2 — accepted** (owner browser checkpoint 2026-10-19):
  Inspection and Return Recovery Alignment. Static gate: project-view
  536/536; inspection validators 15/15; workspace-index task/filter 64/64;
  `git diff --check` clean. Browser gate: normal Project source inspection
  PASS; Return to Projects PASS; Project Source/Search/filter restoration
  PASS; Project scroll restoration PASS; normal Workspace Index source
  inspection PASS; Return to Workspace Index PASS; Index Project and Task
  filter restoration PASS; Index scroll restoration PASS; cancellation
  recoverable PASS; recovery controls not duplicated or stranded PASS; Task
  Board overlay regression PASS; no unexpected Save PASS; no unexpected
  source mutation PASS. In-session transient state preserved; full browser
  refresh may reset transient state; no persistent browser storage. Released
  identity remains 0.7.0.
- **P6 ACT 2 Slice 3 — accepted**: Task Board localStorage filter persistence
  replaced with module-local state.
- **P6 ACT 3 — accepted** (Sidebar Information Architecture): 11-group flat
  sidebar order; Reports protected tail. Static: 93/93 sidebar (S1–S41),
  65/65 notes, 52/52 discovery, 62/62 tasks; `git diff --check` clean.
- **P6 ACT 4 — accepted** (File Knowledge Cards and Workspace Index
  Consolidation): all 5 slices complete; Package 6 runtime committed
  (adac27d); browser acceptance passed for Find Files boundary fix, tag
  selection/deselection, multi-tag intersection filtering, standalone Links In
  retired, Current Document functional.

## Next Actions

- Commit documentation closure (docs/work/CURRENT.md,
  docs/validation/CURRENT_VALIDATION.md, docs/packages/P6-CONSISTENCY.md);
- Commit release preparation (js/release/release.js, sw.js,
  js/ui/release-notes-content.js);
- Push to development;
- 0.8.0 activation pending owner authorization.