# MarkmapEditor — Cline Session-Entry Rule

This is the single project Rule entrypoint. Do not duplicate this content in
`.clinerules`, another Rule, Skills, AI-state documents or architecture.

Every new coding agent MUST complete this entry sequence BEFORE planning,
editing, running broad tests or making architecture claims.

## 1. Read completely

- docs/AI_DEVELOPMENT_WORKFLOW.md
- docs/AI_DEVELOPMENT_ENVIRONMENT.md
- docs/ai-state/README.md
- docs/ai-state/ACTIVE_CONTEXT.md
- docs/ai-state/CURRENT_ACT.md
- docs/ai-state/VALIDATION_STATE.md

## 2. Read architecture — targeted, not everything

Read only the canonical architecture documents explicitly listed under
"Required Architecture" in docs/ai-state/ACTIVE_CONTEXT.md. Use symbol-level
search and small source ranges; do not read whole large files repeatedly.

## 3. Inspect repository state

- `git branch --show-current`
- `git status --short`
- `git diff --stat`
- `git diff --check`
- `git diff --name-only`

Record branch, HEAD, modified/untracked files and preserve the dirty working
tree.

## 4. Authority order

1. accepted canonical architecture;
2. roadmap and Package mapping;
3. checked-out source and executable validators;
4. compact AI-state documents;
5. previous reports and conversations;
6. Repomix snapshots.

AI-state can never override architecture or current source. When the
checked-out repository is available, Repomix snapshots are secondary and must
not be loaded as the primary source.

## 5. Working rules

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
docs/ai-state/CURRENT_ACT.md.
