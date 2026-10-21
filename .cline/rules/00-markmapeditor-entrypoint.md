# MarkmapEditor — Cline Session-Entry Rule

This is the single project Rule entrypoint. Do not duplicate this content in
`.clinerules`, another Rule, Skills, AI-state documents or architecture.

Every new coding agent MUST complete this entry sequence BEFORE planning,
editing, running broad tests or making architecture claims.

## 1. Session entry — required reading sequence

Read in order:

1. `.cline/rules/00-markmapeditor-entrypoint.md` — this entrypoint;
2. `docs/AI_DEVELOPMENT_WORKFLOW.md` — workflow, authority hierarchy,
   validation tiers, Final Work Report Standard (§36);
3. `docs/AI_DEVELOPMENT_ENVIRONMENT.md` — environment and tooling;
4. `project-state.json` — machine-readable project state (HEAD, branch,
   released/target version, ACT statuses);
5. `docs/work/CURRENT.md` — current human-readable work summary;
6. `docs/validation/CURRENT_VALIDATION.md` — current validation evidence;
7. the active Package document (for Package 6: `docs/packages/P6-CONSISTENCY.md`);
8. only the architecture and ADR documents referenced by the current work or
   active Package — do not read every architecture file;
9. inspect Git state: `git branch --show-current`, `git status --short`,
   `git diff --stat`, `git diff --check`, `git diff --name-only`;
10. inspect relevant live source and executable validators.

Record branch, HEAD, modified/untracked files and preserve the dirty working
tree.

## 2. Read architecture — targeted, not everything

Read only the canonical architecture documents explicitly listed under
"Required Architecture" in the active work context. Use symbol-level search
and small source ranges; do not read whole large files repeatedly.

Do not require Repomix when the repository is available.

## 3. Inspect repository state

- `git branch --show-current`
- `git status --short`
- `git diff --stat`
- `git diff --check`
- `git diff --name-only`

Record branch, HEAD, modified/untracked files and preserve the dirty working
tree.

## 4. Authority order

### Procedural authority
1. `.cline/rules/00-markmapeditor-entrypoint.md` — concise entrypoint only;
2. `docs/AI_DEVELOPMENT_WORKFLOW.md` — detailed workflow and reporting;
3. `docs/AI_DEVELOPMENT_ENVIRONMENT.md` — environment and tooling.

### Current operational authority
4. `project-state.json` — machine-readable project state;
5. `docs/work/CURRENT.md` — current human-readable work;
6. `docs/validation/CURRENT_VALIDATION.md` — current validation evidence;
7. `docs/packages/P6-CONSISTENCY.md` — active Package scope, decisions,
   history.

### Current product direction
8. `docs/ROADMAP.md` — current Package sequence through 1.0;
9. `docs/PRODUCT_PRINCIPLES.md` — durable product principles.

### Durable technical authority
10. `docs/architecture/*` — stable architecture, completed Package
    architecture, archived experiments, historical proposals with explicit
    status;
11. `docs/decisions/*` — durable cross-Package decisions.

### Compatibility only (concise pointers, no operational state)
12. `docs/ai-state/*` — former operational-state files, now compatibility
    pointers only; no active ACT details, no branch or HEAD, no validator
    counts, no Package history, no roadmap duplication. Agents must not add
    duplicated ACT, Git or validation state here.

### Historical / supporting (do not use for current state)
13. `NEXT_CYCLE_PLAN.md`, `STATUS.md`, `TODO.md`, `VERIFY.md`,
    `VALIDATION_REPORT.txt`, `docs/validation/OPERATIONAL_FOUNDATION_COMPLETE.md`
    — describe earlier Package eras; classify each as HISTORICAL or
    SUPERSEDED; must not be used for active Package/ACT/version selection.

AI-state can never override architecture or current source. When the
checked-out repository is available, Repomix snapshots are secondary and must
not be loaded as the primary source.

## 5. Working rules

- **Branch check (Package 6):** before active implementation, verify the
  checked-out branch matches the active development branch declared by
  `project-state.json`. Package 6 implementation is performed on
  `development`; do not implement on `main` unless executing an explicitly
  authorized release-integration ACT.
- Preserve PLAN → review → ACT separation; do not expand scope without
  authorization.
- Prohibited unless explicitly authorized: `git reset`, `restore`, `clean`,
  `stash`, `amend`, branch switching, commit, push, product-version/cache
  changes.
- Consult docs/validation/OWNER_TEST_MATRIX.md before selecting tests; run the
  smallest meaningful validation tier for the changed owners (see
  docs/AI_DEVELOPMENT_WORKFLOW.md, Validation Tiers).
- Keep source-mutating tests (Tier M) isolated in a disposable copy; never run
  them against the browser-served tree; never run competing mutation suites.
- Distinguish static, browser and device evidence. Never claim browser
  behavior from Node fixtures.
- Do not return complete successful terminal output to the model; summarize
  passes and inspect failures through targeted log ranges only.
- Report actual tool failures; never invent results; never leave unresolved
  tool_call_ids.
- Update docs/ai-state/ at every accepted ACT boundary and whenever the owner
  checkpoint changes.

## 6. Scope guard

One Cline task has one clear goal or one bounded staged ACT. Do not start a
new Package, redesign, or deferred roadmap item without explicit owner
authorization. Stage boundaries and stop conditions live in
`docs/work/CURRENT.md` and `docs/validation/CURRENT_VALIDATION.md`.
