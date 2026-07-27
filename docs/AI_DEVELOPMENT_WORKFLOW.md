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
- handoff and completion reports.

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

## 26. General Rule

Inspect first.
Plan before editing.
Review before ACT.
Edit narrowly.
Validate explicitly.
Preserve existing work.
Reuse valid same-conversation context.
Start fresh when context or work-package ownership changes.
Never claim more than the evidence proves.
