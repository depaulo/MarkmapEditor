# MarkmapEditor — AI Development Workflow

## Purpose

This document defines the required workflow for AI-assisted development on
MarkmapEditor.

It governs:

- PLAN and ACT separation;
- repository investigation;
- continuation inside the same AI conversation;
- incremental instructions;
- conditions for starting a new conversation;
- source-editing boundaries;
- command lifecycle;
- validation;
- browser evidence;
- handoff and completion reports;
- mandatory session entry and authority precedence;
- model/context-compaction handoff and AI-state lifecycle;
- validation tiers, owner-based test selection and mutation-control
  isolation.

Environment-specific instructions are defined separately in:

docs/AI_DEVELOPMENT_ENVIRONMENT.md

AI coding agents must read that document before using shell tooling.

This workflow does not authorize a particular feature implementation.
Each work package must still define its own approved scope and file boundaries.

---

## 1. Core Workflow

Every implementation package must follow this sequence:

PLAN
→ plan review
→ explicit ACT authorization
→ implementation
→ static validation
→ browser validation
→ final report
→ stable checkpoint

Do not skip PLAN because a correction appears simple.

Small corrections can still affect:

- files with existing uncommitted work;
- shared lifecycle code;
- event listeners;
- render scheduling;
- persistence;
- workspace indexing;
- CodeMirror extensions;
- service-worker behavior;
- unrelated features in the same file.

A direct ACT is allowed only when the user explicitly overrides this workflow.

Absent an explicit override, PLAN is mandatory.

---

## 2. PLAN Mode

PLAN is an investigation and design phase.

During PLAN, the agent must:

1. Inspect the current repository state.
2. Identify existing uncommitted changes.
3. Determine ownership of each changed file and hunk.
4. Inspect the actual current source.
5. Compare runtime evidence with source behavior.
6. Identify the root cause or the evidence still missing.
7. Define the narrowest safe implementation.
8. Define allowed and protected files.
9. Define static and browser validation.
10. Produce a structured PLAN handoff.
11. Stop without editing production source.

PLAN must not:

- edit production source;
- reconstruct files;
- run broad replacements;
- run automatic formatting;
- install packages;
- update documentation unless documentation is the task;
- commit;
- push;
- switch itself to ACT.

The agent must not treat an apparent one-line fix as authorization to edit.

---

## 3. PLAN Handoff

Every PLAN must produce a repository-specific handoff containing, as applicable:

- branch;
- working-tree state;
- changed files;
- ownership of existing changes;
- protected files;
- runtime evidence;
- confirmed root cause;
- unresolved questions;
- architecture ownership;
- exact functions and selectors involved;
- selected implementation scope;
- files allowed in ACT;
- files excluded from ACT;
- commands allowed in ACT;
- prohibited commands;
- static validation;
- browser validation;
- regression checks;
- risks and mitigations;
- deferred work;
- ordered ACT sequence;
- explicit PLAN status.

The PLAN status must clearly indicate one of these conditions:

- ready for review;
- partial because evidence is still missing;
- blocked because source or ownership cannot be safely verified.

The agent must stop after the PLAN handoff.

---

## 4. Plan Review

The PLAN handoff is reviewed before implementation.

The reviewer may:

- approve it;
- correct technical assumptions;
- narrow the file scope;
- request additional evidence;
- change validation requirements;
- reject speculative changes;
- preserve or defer parts of the proposal.

Reviewer corrections become part of the existing PLAN context.

The agent must not begin ACT until the user explicitly changes the mode.

---

## 5. ACT Authorization

ACT begins only with an explicit instruction such as:

CURRENT MODE: ACT

Implement the approved PLAN handoff already present in this conversation.

When ACT begins, the agent must:

1. Recheck repository status.
2. Confirm that relevant source has not materially changed since PLAN.
3. Use the approved handoff already present in context.
4. Apply reviewer corrections.
5. Implement only approved changes.
6. Preserve existing uncommitted work.
7. Validate every changed file.
8. Inspect the complete final diff.
9. Perform available browser tests.
10. Report anything not tested as pending.

The agent must not repeat the entire PLAN unless:

- the repository materially changed;
- the relevant source changed after PLAN;
- the user started a new conversation;
- the active work package changed;
- the previous handoff is no longer reliable.

---

## 6. Same-Conversation Continuity

When work continues in the same Cline or Roo Code conversation, the agent should
retain and reuse the existing context.

Previously established information remains active unless explicitly changed,
including:

- repository safety rules;
- environment constraints;
- approved PLAN;
- file ownership;
- allowed files;
- protected files;
- tool lifecycle;
- permitted commands;
- prohibited commands;
- runtime evidence;
- validation requirements;
- deferred work;
- final-status vocabulary.

Incremental instructions should not unnecessarily repeat the entire original
prompt.

A continuation instruction may use a compact form such as:

CURRENT MODE: PLAN

Add the new runtime evidence to the existing investigation.

Retain all previously established:

- repository-safety rules;
- file boundaries;
- Termux environment requirements;
- tool-lifecycle safeguards;
- validation requirements;
- deferred scope;
- PLAN → review → ACT workflow.

Do not repeat completed investigation.
Update only the affected sections of the existing PLAN handoff.

Similarly, an ACT transition may use:

CURRENT MODE: ACT

Implement the approved PLAN handoff already present in this conversation.

Apply the reviewer corrections below.

Retain all previously established:

- environment rules;
- repository-safety rules;
- file boundaries;
- tool-lifecycle safeguards;
- validation requirements;
- deferred scope.

Do not repeat the complete audit.
Do not broaden the implementation.

---

## 7. When Commands Must Be Repeated

Commands already executed in the same conversation do not need to be repeated
without a reason.

A command should be rerun when:

- source files changed after its previous execution;
- the working tree changed;
- its previous result is no longer current;
- a new ACT phase begins;
- fresh validation is required;
- the previous command failed;
- the previous output was incomplete;
- the command validates the final implementation;
- the agent cannot prove that the earlier result still applies.

Examples that normally require fresh execution before or after edits:

git status --short
git diff --check
git diff --stat
git diff -- APPROVED_FILE
node --check CHANGED_FILE

A repository search or source inspection does not need to be repeated merely to
restate a finding that remains valid.

---

## 8. When to Start a New AI Conversation

Continue in the existing conversation while:

- the same work package is active;
- the existing PLAN remains relevant;
- file ownership remains stable;
- the repository has not reached a clean package boundary;
- the conversation remains internally consistent;
- the agent remembers and obeys the established constraints.

Start a new conversation when one or more of these conditions apply:

1. The current work package is complete and validated.
2. The next task belongs to a substantially different feature or architecture.
3. The repository reached a stable committed checkpoint.
4. The existing conversation contains too many superseded plans.
5. Conflicting instructions are causing agent confusion.
6. The agent repeatedly forgets file boundaries or safety rules.
7. The agent attempts to repeat completed implementation.
8. Tool failures or partial edits have polluted the working context.
9. A new Repomix bundle materially replaces the previous repository picture.
10. The next task requires a new full architecture audit.
11. The current conversation is too large for reliable context retention.
12. The user, reviewer, or coding agent explicitly requests a clean context.

The reviewer should explicitly tell the user when a new conversation is
recommended.

---

## 9. New-Conversation Bootstrap

A new AI conversation must receive a complete standalone prompt.

Do not assume the new conversation remembers anything from an earlier session.

The bootstrap must include:

- project name and purpose;
- development environment;
- instruction to read docs/AI_DEVELOPMENT_ENVIRONMENT.md;
- instruction to read this workflow document;
- current branch;
- expected working-tree state;
- last stable checkpoint;
- completed features;
- current feature package;
- confirmed runtime evidence;
- known defects;
- current repository architecture;
- file ownership;
- protected files;
- PLAN requirements;
- safe commands;
- prohibited commands;
- tool-failure lifecycle;
- validation requirements;
- deferred work;
- required PLAN handoff;
- future ACT contract;
- allowed final statuses.

A new conversation begins in PLAN unless explicitly stated otherwise.

---

## 10. Repository Safety

Before editing, the agent must inspect:

git branch --show-current
git status --short
git diff --stat
git diff --check
git diff --name-only

The agent must distinguish among:

- changes belonging to the current work package;
- changes belonging to another active package;
- previous completed but uncommitted changes;
- investigation-only logs;
- unrelated user changes;
- unknown changes.

Unknown changes must be preserved.

The agent must not use the following without explicit authorization:

git reset
git restore
git checkout -- FILE
git clean
git stash
git rebase
rm on repository source
automatic formatting
automatic lint fixes
complete-file reconstruction
broad source replacement

The agent must not discard or overwrite user work to simplify implementation.

---

## 11. File and Hunk Ownership

Every work package must identify:

- primary files;
- supporting files;
- protected files;
- exact functions, selectors, or source regions;
- allowed runtime behavior changes;
- behavior that must remain unchanged.

Authorization to edit one function is not authorization to refactor the entire
file.

Authorization to edit one file is not authorization to modify adjacent modules.

If implementation requires an unapproved file, the agent must stop and report:

BOUNDARY BLOCKED — CURRENT FIX REQUIRES OUT-OF-SCOPE FILE

The agent must not silently broaden scope.

---

## 12. Editing Method

Edits must be:

- focused;
- incremental;
- based on inspected current source;
- limited to approved hunks;
- easy to audit through Git diff;
- compatible with existing architecture.

Preferred sequence:

1. Locate the exact symbol with rg.
2. Inspect the surrounding code with sed.
3. Confirm ownership and current diff.
4. Make the smallest justified edit.
5. Inspect git diff for that file.
6. Run syntax validation.
7. Continue only if the result is correct.

Do not rewrite complete files.

Do not reconstruct a file from remembered or previously supplied content.

Do not use an old Repomix snapshot as replacement source.

The checked-out repository is the source of truth.

---

## 13. Guarded Automated Edits

A small script may be used for an exact replacement during ACT only when:

- the approved old block is copied from the current checkout;
- the script requires exactly one match;
- zero matches stop without writing;
- multiple matches stop without writing;
- the replacement affects only the approved hunk;
- the final Git diff is inspected.

An automated edit must not:

- perform a broad regular-expression rewrite;
- reconstruct a complete file;
- normalize unrelated whitespace;
- format unrelated code;
- silently continue after a match-count mismatch.

---

## 14. Termux Command Rules

All shell work must follow:

docs/AI_DEVELOPMENT_ENVIRONMENT.md

In particular:

- use commands through PATH;
- do not hardcode conventional Linux binary paths;
- prefer rg for search;
- prefer sed for bounded inspection;
- prefer git diff and git status for verification;
- check undocumented commands with command -v;
- do not install packages without authorization;
- classify malformed tool calls as agent/tool errors, not missing commands;
- account for native Android Termux and aarch64;
- avoid unnecessarily expensive repository operations.

---

## 15. Tool Lifecycle

Every tool call must be completed or explicitly classified.

The agent must not leave unresolved tool-call identifiers.

If a tool invocation fails:

1. Determine whether it was:
   - malformed tool invocation;
   - missing command;
   - command error;
   - permission/path error;
   - source validation failure;
   - provider/quota failure.
2. Retry at most once with a materially corrected or simpler call.
3. Do not repeat the identical failed invocation.
4. Do not modify source because an AI tool call was malformed.
5. Do not install software merely because an invocation was malformed.
6. Stop and report TOOL BLOCKED if the required tool path remains unavailable.

No stdout does not automatically mean failure.

Commands such as file writes, mkdir, mv, or successful checks may produce no
output.

Verify results through:

git status --short
git diff -- FILE
sed -n
rg
ls or find where appropriate

Do not claim a command passed without evidence.

---

## 16. Investigation Discipline

Investigation should progressively narrow the problem.

Preferred pattern:

runtime evidence
→ relevant symbol search
→ bounded source inspection
→ call-path inspection
→ hypothesis
→ targeted supporting evidence
→ PLAN decision

Avoid:

- repeatedly dumping entire large files;
- scanning every directory without a reason;
- repeating previously completed searches;
- presenting speculation as root cause;
- making source changes merely to collect broad logs;
- leaving permanent high-volume tracing enabled.

Temporary diagnostics must be:

- narrowly scoped;
- recognizable;
- removable or flag-controlled;
- reviewed after use;
- excluded from normal operation when no longer needed.

---

## 17. Runtime Evidence

Runtime logs must be interpreted carefully.

A log that a refresh was requested does not prove that the refresh executed.

A log that a target resolved does not prove that the target opened successfully.

A downstream exception must not automatically be classified as failure of every
earlier operation.

The agent should distinguish:

- request;
- start;
- successful commit point;
- completion;
- cancellation;
- no-op;
- failure;
- downstream failure.

Recommended diagnostic pattern:

Feature: operation requested
Feature: operation begin
Feature: intermediate state
Feature: operation committed
Feature: operation complete

Errors should identify the owning stage.

---

## 18. Static Validation

Every ACT package must define validation appropriate to its files.

Typical checks include:

node --check CHANGED_CLASSIC_JS_FILE
npx tsc --noEmit
git diff --check
git diff --stat
git diff -- CHANGED_FILE

Do not install packages merely to run an optional validation command.

Separate:

- validation failures introduced by the current change;
- pre-existing validation failures;
- environment/tool limitations;
- browser-only behavior.

The complete final diff must be inspected before reporting completion.

---

## 19. Browser Validation

Browser behavior must not be marked as passed based only on source inspection.

The agent must distinguish:

- source complete;
- static validation passed;
- browser tests required;
- browser test passed;
- browser test failed;
- browser test blocked.

Each work package should define concrete browser tests.

Relevant evidence may include:

- startup logs;
- successful listener wiring;
- exact action logs;
- state mutation;
- persistence;
- index changes;
- visual behavior;
- navigation;
- absence of duplicate actions;
- absence of uncaught errors;
- PWA/cache behavior.

A test not performed must be reported as pending.

---

## 20. Performance Work

Do not optimize performance based only on perceived delay.

Before optimization, collect evidence such as:

- operation start;
- operation end;
- duration;
- invocation count;
- scheduling reason;
- replacement of pending work;
- concurrent/in-progress state;
- result size.

Do not add:

- caching;
- memoization;
- workers;
- observers;
- incremental indexing;
- new scheduling systems

until the current architecture and measured bottleneck justify them.

First correct functional exceptions that prevent operations from completing.

---

## 21. Documentation

Documentation updates should normally occur after implementation and validation.

Relevant project documents may include:

- README.md
- STATUS.md
- TODO.md
- VERIFY.md
- VALIDATION_REPORT.txt
- architecture or proposal documents

Do not update documentation during a narrow runtime investigation unless the
work package explicitly includes documentation.

Documentation must describe the verified implementation, not the intended
implementation.

Deferred behavior must remain clearly marked as deferred.

---

## 22. Commit and Push

The coding agent must not commit or push unless explicitly instructed.

Before commit:

git status --short
git diff --check
git diff --stat
git diff

Only validated and approved files should be staged.

Before push, confirm:

- intended branch;
- commit contents;
- browser validation status;
- service-worker/cache implications;
- absence of unrelated staged changes.

Promotion from development to main is a separate release action and must not be
performed implicitly as part of a feature fix.

---

## 23. Final ACT Report

The final report must include:

- branch;
- initial changed files;
- final changed files;
- exact files modified by the package;
- root cause;
- implementation summary;
- behavior preserved;
- static validation;
- browser validation;
- tests not performed;
- unresolved issues;
- deferred work;
- final status.

The report must not claim repository-wide completion when only a narrow package
was completed.

Use a status appropriate to the evidence, such as:

- implementation complete — browser tests required;
- implementation complete — browser validation passed;
- implementation partial — source gaps remain;
- validation tool blocked;
- boundary blocked;
- unresolved failures remain.

---

## 24. Stable Checkpoints

A stable checkpoint is reached when:

- implementation scope is complete;
- static checks pass or limitations are documented;
- required browser behavior is validated;
- unrelated changes remain preserved;
- final diff is reviewed;
- documentation is consistent where required;
- changes are committed when authorized.

After a stable checkpoint:

1. Record completed behavior.
2. Record deferred behavior.
3. Decide whether to continue in the same conversation.
4. Start a new conversation if the next package is materially different.
5. Provide a complete new-chat bootstrap when necessary.

---

## 25. Current MarkmapEditor Work-Package Order

Unless explicitly changed, use this priority order:

1. Finish and stabilize Task Review.
2. Finish and stabilize Wiki Links.
3. Verify and stabilize Related/backlink behavior.
4. Establish a daily-use release checkpoint.
5. Continue Frontmapper/frontmatter work.
6. Advance Report Mode afterward.

Do not mix future work into an active stabilization package merely because the
future feature appears easy or isolated.

---

## 26. Release Closure (Mandatory)

Every accepted package must close with all of the following documented:

- accepted runtime behavior;
- static validation;
- browser acceptance;
- contextual Help review;
- validation-backed examples;
- Release Notes entry;
- semantic version decision;
- cache identity update;
- LOCAL_APP_SHELL verification;
- one-time What's New verification;
- permanent history verification;
- cache-boundary smoke;
- checkpoint commit;
- separately authorized push.

A package is closed only when each item is verified or an approved exception
is recorded.

Experiment and non-release rules:

- An experiment does not create a release, version change, Help update, or
  Release Notes entry until its production behavior is accepted.
- A rejected feature receives no Release Notes entry.
- Browser-pending work does not close a release; it stays pending until
  browser-proven, then is reconsidered at a later closure.

Planned syntax and roadmap behavior must not be documented as implemented.

Preservation of historical validation evidence:

- Historical validation evidence (records of what previously ran, where, and
  what it proved) is preserved verbatim. New work never rewrites or re-labels
  past evidence; updates are recorded as current operational documentation,
  not as edits to historical proof.

Unresolved tool-call guard:

- If a validation tool-call fails or returns no result, the package is not
  closed and no checkpoint is created. Resolve the failure or record an
  approved exception before declaring closure.

---

## 27. Semantic Version Policy

MarkmapEditor uses semantic product versions of the form MAJOR.MINOR.PATCH.

- An accepted moderate user-facing inclusion increments MINOR.
- An accepted correction inside an existing inclusion increments PATCH.
- The first completed core releases as 1.0.0.
- A major second-generation architecture releases as 2.0.0.
- An experiment ships with no version change.
- A rejected feature gets no release entry.
- Browser-pending work does not close a release.
- A package may contain several accepted commits before its release boundary.
  The product version changes once during final release closure, not once per
  commit.

Four-part numbers (e.g. 0.6001) and channel labels (e.g. v73) are not
long-term user-facing product versions.

### First semantic release

0.6.0 is the first semantic MarkmapEditor release. Earlier vNN values were
cache identities, not product versions, and are not reconstructed as semantic
Release Notes entries.

---

## 28. Pre-1.0 Roadmap

- 0.6.x — Help, Permanent Release Notes, semantic versioning, and release closure.
- 0.7.x — Projects minimal declaration and managed metadata.
- 0.8.x — Projects Expanded View editing and normalized Report integration.
- 0.9.x — Basic Reminders and first-generation stabilization.
- 0.10.x — Visual hierarchy and interface distinction.
- 1.0.0 — First-generation core completion.
- 2.0.0 — Second-generation architecture and larger experiences.

Roadmap descriptions are planning intent, not release-note text, until reviewed
at the gate for each package.

### Version 2 candidates (recorded, not implemented)

Version 1 is not blocked by these items. They are candidates for a later
second-generation release:

- optional-feature configuration architecture (must hide UI without deleting or
  rewriting Markdown or managed comments);
- internal Draw.io architecture;
- shared @ attribute vocabulary;
- context-aware @ completion;
- optional @ insertion control;
- shared attributes for Tasks, Projects, and Reminders;
- decision on People / assignee identity;
- advanced Reminder recurrence;
- Reveal.js completion;
- major redesigns;
- deferred Report window composition;
- HTML-pane tabs;
- generalized pane surfaces.

The shared @ language is not part of Version 1. This release does not advertise
@ syntax, slash commands, autocomplete, people assignment, or advanced
reminder recurrence.

---

## 29. Session Entry and Authority Precedence

### Mandatory session entry

Every new coding agent must, before planning, editing, running broad tests or
making architecture claims:

1. read `.cline/rules/00-markmapeditor-entrypoint.md`;
2. read `docs/AI_DEVELOPMENT_WORKFLOW.md`;
3. read `docs/AI_DEVELOPMENT_ENVIRONMENT.md`;
4. read `project-state.json`;
5. read `docs/work/CURRENT.md`;
6. read `docs/validation/CURRENT_VALIDATION.md`;
7. read the active Package document (`docs/packages/P6-CONSISTENCY.md` for Package 6);
8. read only the architecture and ADR documents referenced by the current work or active Package;
9. inspect Git state: `git branch --show-current`, `git status --short`,
   `git diff --stat`, `git diff --check`, `git diff --name-only`;
10. inspect relevant live source and executable validators.

The concise project entrypoint rule lives in
.cline/rules/00-markmapeditor-entrypoint.md and must not be duplicated
elsewhere.

### Authority precedence

1. accepted canonical architecture;
2. roadmap and Package mapping;
3. checked-out source and executable validators;
4. `project-state.json` + `docs/work/CURRENT.md` + `docs/validation/CURRENT_VALIDATION.md` + `docs/packages/P6-CONSISTENCY.md`;
5. `docs/ai-state/*` — compatibility pointers only, never operational state;
6. previous reports and conversations;
7. Repomix snapshots.

Current source may expose an implementation defect, but accepted architecture
remains the authority for intended behavior. Contradictions between source,
validators and architecture must be surfaced to the owner, never silently
resolved.

### Repository-first inspection and Repomix boundary

- Inspect the live repository directly with targeted symbol searches and
  small source ranges.
- Repomix snapshots are secondary; they must not be loaded when the
  checked-out repository is available.
- Do not repeatedly read complete large files when symbol-level inspection
  is sufficient.

---

## 30. Model Switch and Context-Compaction Handoff

- A replacement model must read the canonical state files first, before any
  planning or editing.
- Agents must not reconstruct active state from conversation history when
  repository state files exist.
- `docs/work/CURRENT.md` carries the current authorization: stage, allowed and
  protected files, stop conditions.
- `docs/validation/CURRENT_VALIDATION.md` carries inherited static, browser
  and device evidence, kept as separate evidence classes.
- `project-state.json` carries the current phase, working-tree boundary and
  the list of architecture documents that are required right now.
- A context-compaction handoff is complete only when no tool_call_ids remain
  unresolved and any partial work is recorded in `docs/work/CURRENT.md`.
- One Cline task has one clear goal or one bounded staged ACT; a replacement
  model continues that ACT rather than starting a new broad one.

### AI-state update responsibilities

`docs/ai-state/*` files are compatibility pointers only; they are NOT updated
at every ACT. Update the canonical files instead:

- Update `project-state.json` at every ACT boundary (HEAD, branch, ACT statuses);
- Update `docs/work/CURRENT.md` at every ACT boundary;
- Update `docs/validation/CURRENT_VALIDATION.md` with concise evidence
  (command, exit, summary count, failure-log path) after each accepted
  validation run;
- Update the active Package document at ACT boundary;
- Migrate durable decisions into canonical architecture via
  `docs/decisions/`; clean stale operational detail at Package closure.
- Full terminal logs and source dumps never belong in ai-state.

---

## 31. Context-Efficient Execution

### Source inspection

- Inspect symbols and small ranges; avoid broad reads of large files.
- Search first (`rg`, targeted `sed` ranges), read only what the question
  requires.

### Terminal output

- Successful validation output is summarized: one line per suite with
  command, exit code and summary count.
- Verbose output is written to an ignored local log (for example
  `.validation/<suite>.log`), never returned wholesale to the model.
- Failures are inspected through targeted log ranges, not entire logs.
- Warnings and unexpected stderr are retained in the log and mentioned in the
  summary.

---

## 32. Validation Tiers and Owner-Based Test Selection

### Owner-based selection

- Consult docs/validation/OWNER_TEST_MATRIX.md and
  docs/validation/TEST_CATALOG.md before selecting tests.
- Run the smallest meaningful tier for the changed owners; do not run every
  script after every edit.
- Inherited accepted evidence is not rerun unless a changed owner can
  invalidate it.
- Map `js/main.js` changes by functional owner or source range; a `main.js`
  edit does not require every Workspace suite.

### Tiers

- TIER 0 — EDIT HYGIENE: `node --check` on touched JS/CJS,
  `git diff --check`, focused anchor/static check.
- TIER 1 — QUICK DOMAIN SMOKE: fast, non-mutating, changed domain only.
- TIER 2 — TARGETED DOMAIN REGRESSION: selected by changed owner; affected
  contracts and integrations; no unrelated domains.
- TIER 3 — PACKAGE PRE-ACCEPTANCE: all active Package validators, affected
  shared-runtime regressions, anchor audit, syntax/diff, release parity.
- TIER 4 — PACKAGE CLOSURE: final active Package suite, required
  cross-domain regressions, documentation checks, Help/Release Notes checks,
  release parity, browser/device checklist.
- TIER M — MUTATION-CONTROL GATE: see the next section.
- TIER D — BROWSER/DEVICE: physical evidence, kept separate from static
  evidence.

### Evidence classes

Static fixtures never prove: physical scrolling, visual overlap, keyboard
behavior, responsive usability, File System Access prompts, Service Worker
activation, Android/DeX usability. Browser and device claims require
physically observed evidence, labeled as such.

Aggregate commands (see package.json and scripts/validate-aggregate.cjs):
`validate:quick`, `validate:projects`, `validate:tasks`,
`validate:workspace`, `validate:reports`, `validate:package5`,
`validate:closure`, `validate:mutation:projects`. Direct script execution
remains available.

---

## 33. Mutation-Control Isolation (Tier M)

Tier M runs only after contract-sensitive changes, after material validator
changes, or at explicit gates — never routinely.

Requirements:

- run in a disposable isolated copy of the repository;
- include the current uncommitted candidate in the copy;
- never mutate browser-served source;
- run no two mutation suites concurrently;
- take exact byte snapshots (sha256) before and after every mutation;
- prove byte-identical restoration and a green baseline rerun;
- account every control as biting, non-biting or structural guard;
- remove the disposable copy and logs afterward.

Behavior-changing suites that mutate source belong only to Tier M; ordinary
validators must be non-mutating against the served tree.

---

## 34. ACT Completion, Owner Acceptance and Package Closure

### ACT lifecycle

- `docs/work/CURRENT.md` is updated at every stage change (A/B/C/owner
  acceptance/closed) and must reflect the actual state, never intent.
- On ACT completion, `docs/validation/CURRENT_VALIDATION.md` records concise
  evidence per suite: command, exit code, summary count, failure-log path —
  no pasted output.
- `project-state.json` is updated when the owner accepts a checkpoint and at
  Package closure.

### Owner acceptance

- Owner-accepted evidence is summarized compactly in `project-state.json` and
  `docs/work/CURRENT.md` and never rewritten or re-labeled later.
- Browser/device acceptance is labeled as such and is not claimed from Node
  fixtures.

### Package closure cleanup

- Migrate durable decisions from DECISION_LOG.md into canonical architecture
  and leave a short pointer.
- Remove stale operational detail and temporary artifacts.
- Keep release-identity changes, commit and push for the explicit closure
  boundary only (see §26 Release Closure).

---

## 35. General Rule

Inspect first.
Plan before editing.
Review before ACT.
Edit narrowly.
Validate explicitly.
Preserve existing work.
Reuse valid same-conversation context.
Start fresh when context or work-package ownership changes.
Never claim more than the evidence proves.

---

## 36. Final Work Report Standard

Every ACT completion report must follow this standard. The report is the
durable engineering record of what was done, why, and what evidence supports
it. Future agents must be able to reconstruct the ACT from the report without
re-examining Git.

### Required sections (in order)

1. **Executive Summary** — one paragraph: what changed, why, and the outcome.
2. **Initial State and Authorized Scope** — starting HEAD, branch, active
   Package/ACT status, release activation state, and the exact scope the
   owner authorized.
3. **Source-Proven Findings** — what the inspected source, validators, and
   evidence showed before implementation; exact validator counts where
   applicable.
4. **Previous Behavior and Root Cause** — the behavior before the change and
   the root cause of the defect or gap being addressed.
5. **Implementation Detail** — what was changed, in which files, and why those
   files; meaningful behavioral explanation, not just file lists.
6. **Files Changed** — each file with an explanation of its role; no bare file
   lists.
7. **Ownership and Data Flow** — which domain owns each changed file and how
   data moves through it after the change.
8. **User-Visible Result** — what a user can observe differently after the
   change.
9. **Preserved Behavior and Regression Guards** — what intentionally remains
   unchanged and what guards prevent regression.
10. **Validation Evidence** — exact validator counts (e.g. `93/93 PASS`),
    separate static/browser/device evidence, exit codes, and log paths.
11. **Browser and Device Evidence** — physically observed evidence labeled as
    such; never claim browser behavior from Node fixtures.
12. **Documentation Updated** — which documents changed and why each was in
    scope.
13. **Git and Checkpoint** — starting and ending HEAD, branch, dirty state,
    commit/push status.
14. **Deferred and Protected Work** — owner-deferred items and protected scope
    that was not touched.
15. **Known Limitations and Open Questions** — what remains unverified or
    unresolved.
16. **Release State** — releasedVersion, targetVersion, releaseActivation
    state, cache/version/service-worker change status.
17. **Recommended Next Step** — the owner-approved next action, or "none" if
    none is authorized.

### Requirements

- Include exact validator counts (e.g. `93/93 PASS`, not "all green").
- Name relevant owners (e.g. `js/workspace/workspace-parser.js`, `MME_TASK_LIFECYCLE`).
- Provide meaningful behavioral explanation for every changed file.
- Record starting and ending HEAD explicitly.
- Separate static, browser, and device evidence; never mix classes.
- List explicit unperformed tests (tests that were considered but not run).
- Record deferred owner-approved work and protected scope.
- State release activation state (`true`/`false`).

### Prohibited

- Raw successful terminal dumps — summarize passes, inspect failures through
  targeted log ranges only.
- Huge copied diffs — explain what changed, do not paste full diffs.
- "All green" without counts — every pass claim must carry a count.
- Unsupported browser claims — browser/device claims require physical
  observation, labeled as such.
- File lists without explanation — every listed file needs a role.
- Presenting PLAN targets as implemented — PLAN status is not implementation.
- Claiming closure with a pending browser checkpoint — closure requires all
  authorized checkpoints to pass.
- Omitting protected or deferred work — both must be listed explicitly.

---

## 37. Documentation Update Discipline

During a normal implementation ACT, agents normally update only:

- `project-state.json` — machine-readable project state (HEAD, branch,
  version, ACT statuses);
- `docs/work/CURRENT.md` — current human-readable work summary;
- `docs/validation/CURRENT_VALIDATION.md` — current validation evidence;
- the active Package document (for Package 6: `docs/packages/P6-CONSISTENCY.md`).

Other documents change only when their owned information changes:

- Roadmap — Package sequence or scope change;
- Architecture — durable architecture change;
- ADR — durable cross-Package decision;
- Test catalog/matrix — suite or ownership change;
- Help — accepted user-visible behavior;
- Release Notes — release boundary only;
- version/cache/service worker — accepted activation only.

Do not update historical or compatibility files at every ACT. Historical
documents (`NEXT_CYCLE_PLAN.md`, `STATUS.md`, `TODO.md`, `VERIFY.md`,
`VALIDATION_REPORT.txt`, `docs/validation/OPERATIONAL_FOUNDATION_COMPLETE.md`)
describe earlier Package eras and must not be rewritten to match current
Package numbers.