# MarkmapEditor Product Principles

## Purpose

This document defines the stable product principles that guide the design and development of MarkmapEditor.

It explains why the product is structured as it is and provides decision criteria for future features, architecture plans, implementation packages, and user-interface changes.

This document does not replace subsystem architecture files.

Use the following authority model:

    PRODUCT_PRINCIPLES.md
    -> stable product philosophy and decision criteria

    AI_DEVELOPMENT_WORKFLOW.md
    -> required PLAN, review, ACT, validation, and checkpoint process

    AI_DEVELOPMENT_ENVIRONMENT.md
    -> execution environment and tooling constraints

    docs/architecture/
    -> subsystem ownership, contracts, information flows, and boundaries

    Feature PLAN handoffs
    -> source-grounded scope for the current implementation package

    ACT completion reports
    -> implementation evidence, validation results, and checkpoint status

When multiple technically valid solutions exist, prefer the one that follows these principles while preserving the current source-proven architecture.

---

## 1. Simplicity First

MarkmapEditor should remain as straightforward as possible.

Use the smallest complete workflow that provides real user value.

Do not introduce complexity only because it could become useful in the future.

Architectural space may be reserved for future evolution, but reserving space does not authorize implementing the future subsystem now.

Prefer:

- direct workflows;
- understandable controls;
- minimal required fields;
- existing application patterns;
- explicit actions;
- progressive enhancement;
- small, complete implementation packages.

Avoid:

- speculative configuration;
- duplicate systems;
- unnecessary management screens;
- premature abstraction;
- hidden automation;
- features that create ongoing maintenance work for the user;
- large frameworks for problems that can be solved locally and clearly.

Complexity must be justified by a real workflow, current technical requirement, or repeated usage need.

---

## 2. Markdown Is the Canonical Source

Markdown remains the primary portable and understandable source of information.

Visual interfaces should consume, enrich, or interact with Markdown-backed information without silently replacing it with a competing source of truth.

The preferred information path is:

    Physical Markdown
    -> parsing and normalization
    -> shared application model
    -> focused views and outputs
    -> explicit source mutation
    -> physical Save
    -> shared model refresh

Examples include:

    Tasks:
    Markdown Task
    -> Task lifecycle normalization
    -> Workspace Index
    -> TaskReview or Task Board
    -> source mutation
    -> physical Save
    -> Workspace Index rebuild

    Projects:
    Markdown Project declaration
    -> Workspace Index
    -> Sidebar Projects view
    -> Project Quick View
    -> richer Project workflow only if justified

    Reports:
    Workspace Index
    -> generated Markdown report
    -> user review
    -> Report Dictionary
    -> Draw.io reconciliation
    -> visual output

    Knowledge:
    Markdown Journals and Concepts
    -> Workspace Index
    -> links, tags, timelines, and explorers
    -> future graph-based views if justified

Markmap, HTML Preview, Task Board, Draw.io, Mermaid, and future Graph Views are representations or interaction surfaces over shared information.

They do not automatically become canonical data stores.

Any change to the canonical-data model requires an explicit architecture decision.

---

## 3. Information Flow Must Be Clear

The movement of information through the application should be explainable.

For every feature, the architecture should be able to answer:

    What is the canonical source?
    Who parses it?
    Who normalizes it?
    Who displays it?
    Who may mutate it?
    Who persists it?
    What event or operation refreshes its consumers?

If these answers are unclear, duplicated, or contradictory, the work package must return to PLAN or architecture review.

Implementation convenience is not sufficient justification for an unclear information flow.

A user or future developer should be able to understand how information moves from source to interface and back to source without reconstructing the behavior from unrelated modules.

---

## 4. One Clear Owner per Responsibility

Each important responsibility should have one authoritative owner.

Examples of responsibilities include:

- parsing;
- normalization;
- lifecycle transitions;
- source mutation;
- physical persistence;
- view rendering;
- navigation;
- refresh coordination;
- global preferences;
- workspace state.

Consumers should call or observe the appropriate owner rather than reproduce its logic.

Avoid:

- duplicated lifecycle rules;
- multiple competing indexes;
- separate local copies of global preference state;
- repeated file scanning;
- polling when an existing refresh event is sufficient;
- visual components writing metadata directly when a domain owner exists;
- multiple modules believing they own the same control or transaction.

A new owner should be introduced only when an existing owner cannot reasonably or safely hold the responsibility.

---

## 5. Reuse Shared State Before Creating Parallel State

Before adding state, determine whether the required information already exists in:

- the current physical document;
- the Workspace Index;
- an established domain owner;
- a current workspace session;
- an existing global preference;
- an existing event or refresh lifecycle.

Prefer derived read models over redundant persisted state.

Do not create a second source of truth merely to simplify one user interface.

Patterns to avoid include:

- a second Workspace Index;
- a separate Project scanner;
- a Board-only copy of Task lifecycle state;
- a local theme system for one overlay;
- a duplicated document metadata store;
- a persisted value that can be safely and cheaply derived;
- polling for changes already announced by application events.

Parallel state is acceptable only when its purpose, synchronization contract, failure behavior, and owner are explicitly defined.

---

## 6. Use Progressive Interaction Levels

MarkmapEditor should introduce interaction depth progressively.

The product-wide model is:

    Source or normalized Workspace data
    -> closest representation of the underlying information

    Sidebar
    -> quick information and lightweight actions

    Quick View
    -> richer focused interaction

    Full Mode
    -> only when sustained usage justifies it

Examples:

    Tasks
    -> TaskReview Sidebar
    -> Task Board Quick View
    -> possible future Task Manager

    Projects
    -> Projects Sidebar
    -> Project Quick View
    -> possible future Projects Mode

    Reports
    -> Report Sidebar setup
    -> focused Report generation and reconciliation
    -> possible future Report Designer

    Knowledge
    -> compact Sidebar panels
    -> focused explorers
    -> possible future Graph or Knowledge Mode

A Full Mode should not be created merely because another feature has one.

Visual symmetry is not sufficient justification for architectural symmetry.

---

## 7. Standalone First, Integration by Opt-In

Useful workflows should provide value without requiring the user to configure the entire MarkmapEditor workspace model.

Where technically reasonable:

- standalone document workflows should work immediately;
- Journal and Knowledge integration should be optional;
- Workspace aggregation should add value without becoming mandatory;
- Groups should remain optional;
- advanced metadata should remain optional;
- users should be able to capture information before organizing it deeply.

Integration should be progressive:

    Standalone use
    -> optional Workspace discovery
    -> optional Knowledge or Journal aggregation
    -> optional Groups and richer filtering

The application should not require advanced organization before basic work can begin.

---

## 8. Fast Capture Remains a First-Class Workflow

MarkmapEditor must preserve fast Markdown capture even as richer visual workflows are added.

A user should be able to create useful information with minimal syntax and minimal interruption.

Examples:

- a basic Markdown checkbox remains a valid Task;
- a Project is valid when it has a name;
- optional metadata enriches behavior but does not invalidate simple input;
- Reports begin as understandable Markdown;
- Mermaid begins as Markdown-native diagram syntax;
- specialized templates remain optional.

Rich interfaces must share the same underlying information model.

They should not force users to abandon direct Markdown editing.

---

## 9. Metadata Must Be Progressive

Metadata should be introduced only when it enables a useful workflow.

Basic content must remain valid without every optional field.

Prefer:

- minimal required fields;
- optional structured enrichment;
- conservative normalization;
- visible user-authored tags;
- metadata that can be ignored safely;
- archive instead of destructive deletion where appropriate.

Avoid:

- fields users normally delete immediately;
- mandatory empty properties;
- speculative metadata;
- automatic historical backfill;
- mass rewriting of existing files;
- metadata that exists only to satisfy a future hypothetical feature.

Default Journal and Concept starters should remain minimal.

Additional fields should be introduced through specialized templates or later workflows rather than placed in every new document.

---

## 10. Automate Only at Stable Boundaries

Automation should happen at deliberate and understandable transaction points.

Preferred automation boundaries include:

- physical Save;
- explicit Generate;
- explicit Reconcile;
- explicit Archive;
- explicit status transition;
- explicit workspace refresh;
- explicit import or export.

Avoid surprising structural mutation during ordinary typing.

Draft auto-save should not silently perform operations intended for physical document persistence.

When automation changes source information, its owner, trigger, result, and failure behavior must be clear.

---

## 11. Preserve Ambiguity Instead of Inventing Certainty

MarkmapEditor should not guess when identity, ownership, mapping, or source location cannot be established safely.

When information is ambiguous:

- preserve the original source;
- avoid destructive mutation;
- avoid silently selecting one possible interpretation;
- expose the limitation when useful;
- request architecture review when the ambiguity affects a contract;
- defer richer identity systems until usage justifies them.

Conservative behavior is preferred over apparently intelligent but unreliable automation.

An honest limitation is better than incorrect certainty.

---

## 12. Visual Outputs Remain Reproducible

Whenever practical, visual outputs should remain explainable and reproducible from their canonical information.

Examples:

- Markmap is rendered from Markdown;
- HTML Preview is rendered from Markdown;
- Task Board consumes normalized Tasks;
- Reports are generated as Markdown;
- Draw.io reconciliation consumes the Report Dictionary and a selected template;
- Mermaid diagrams remain embedded in Markdown;
- future Graph Views should consume established relationships rather than create an unrelated graph database by default.

A visual representation may maintain temporary interaction state, but that state must not silently replace the canonical content.

---

## 13. Complete Thin Workflows Before Expanding Them

Prefer an end-to-end thin workflow over an incomplete rich system.

Use this sequence:

    finish the smallest useful workflow
    -> validate it with real usage
    -> document limitations
    -> create a stable checkpoint
    -> improve it in a later PLAN and ACT package

Do not redesign a locked workflow in the middle of implementation unless the approved path is technically impossible or would violate an established architecture contract.

Potential improvements should be recorded without automatically expanding the current ACT scope.

---

## 14. Real Usage Decides Future Complexity

Future possibilities may be documented or reserved, but they are not current requirements.

Examples of intentionally conditional directions include:

- Full Task Manager;
- Full Projects Mode;
- Gantt views;
- Graph View;
- advanced Groups behavior;
- global filtering systems;
- automated intelligent grouping;
- template libraries and template versioning;
- Mermaid visual editing;
- advanced Project hierarchies;
- multiple reporting data stores;
- extensive presentation-template systems.

These should be implemented only when real usage demonstrates that the simpler workflow is insufficient.

Future compatibility should normally be preserved through clean ownership and data contracts, not through premature feature implementation.

---

## 15. Groups Are Optional Scope, Not a Replacement Structure

Groups should remain an optional organizational layer.

Groups are not automatically:

- tags;
- folders;
- workspaces;
- document types;
- mandatory classifications.

Their primary purpose is to provide optional scope, filtering, and aggregation.

Initial Group integration should favor focused views such as:

- Task Board;
- Project Quick View;
- Report setup;
- Search;
- future knowledge exploration.

Groups should not introduce hidden global filtering that makes application state difficult to understand.

Group behavior must follow the established metadata architecture before broad integration begins.

---

## 16. Projects Should Grow Progressively

Projects should begin with fast Markdown discovery.

The minimum valid Project is a Project name.

Additional fields may remain optional, including:

- period;
- value;
- currency;
- status;
- delivery information;
- billing information;
- Group;
- parent or subproject relationships.

The preferred progression is:

    Markdown Project capture
    -> Workspace Index discovery
    -> lightweight Sidebar view
    -> Project Quick View
    -> richer Projects Mode only if justified

Archive should normally be preferred over deletion.

Parent Projects should remain the primary objects in the Sidebar, Journal aggregation, and default Workspace Index.

Subprojects should remain compact and subordinate unless a focused view requires them.

---

## 17. Tasks Should Remain Easy to Create

A normal Markdown checkbox is sufficient to create a basic Task.

Task metadata may enrich lifecycle behavior, but it must not make ordinary Task capture difficult.

The Task information model should remain:

    Markdown Task
    -> Task lifecycle owner
    -> Workspace Index
    -> TaskReview
    -> Task Board
    -> explicit source mutation
    -> physical Save
    -> index refresh

The Task Board is a consumer of Task lifecycle rules.

It must not create a competing lifecycle implementation.

Completion metadata, dates, and future enriched fields should remain conservative and compatible with simple checkbox completion.

A future Full Task Manager remains optional and must be justified by usage.

---

## 18. Reports Remain Markdown First

The automatic Markdown report is the core reporting output.

The preferred reporting flow is:

    Workspace information
    -> Report setup
    -> generated unsaved Markdown
    -> user review and editing
    -> optional Save
    -> Report Dictionary
    -> optional Draw.io reconciliation
    -> rich visual output

HTML and Draw.io provide richer presentation and finishing experiences.

They should consume the same underlying report information rather than create a separate reporting truth.

Partial reconciliation is acceptable.

Unknown placeholders, unmatched fields, and missing values should remain visible and recoverable rather than being silently discarded.

---

## 19. Mermaid Should Begin as a Markdown-Native Capability

Mermaid should initially be implemented as a Markdown-native feature.

Initial goals may include:

- fenced Mermaid syntax;
- HTML Preview rendering;
- Markmap integration where technically appropriate;
- report diagrams;
- Project flows;
- future local relationship visualization.

Do not initially create:

- a complex dedicated Mermaid module;
- a separate diagram data store;
- an elaborate visual Mermaid editor;
- extensive configuration systems.

Mermaid may later support Graph View or knowledge exploration, but this future possibility does not require an early graph subsystem.

---

## 20. UI Consistency Should Not Create Unnecessary Features

Reuse established interaction and visual patterns when doing so improves understanding.

Do not add a control, mode, toolbar, preference, or local state merely because another experience has one.

Prefer:

- existing application controls;
- shared global preferences;
- established overlay behavior;
- consistent icon treatment;
- familiar navigation;
- responsive behavior based on capability and available space.

A shared global control should remain globally owned.

A focused view should consume global Theme, Compact, and other application states rather than duplicate them locally unless a separate local setting has a proven purpose.

---

## 21. Desktop and DeX Are Primary, Without Blocking Other Devices

Desktop and desktop-like DeX usage are primary interaction targets.

Responsive behavior should use available width, height, pointer capability, and other reliable browser characteristics rather than fragile device detection.

Touch targets should remain usable where coarse pointers are present.

Narrow and short viewports should retain access to essential actions and content.

Mobile support should remain practical and progressive without forcing a large separate mobile architecture unless real usage requires it.

---

## 22. Explicit Exclusions Protect Simplicity

Architecture and PLAN documents should state what is out of scope.

An exclusion is not a product failure.

It protects the current workflow from uncontrolled expansion and helps future contributors understand whether an absence is deliberate.

Typical exclusions may include:

- unrelated feature redesign;
- new persistence layers;
- broad metadata migration;
- historical backfill;
- new Full Modes;
- new template-management systems;
- global filtering;
- duplicate scanning;
- speculative integrations.

Deferred ideas should be recorded in the roadmap rather than inserted into the current ACT.

---

## 23. Development Must Follow PLAN and ACT Separation

Product simplicity depends on disciplined implementation.

Every implementation package must follow the process defined in:

`docs/AI_DEVELOPMENT_WORKFLOW.md`

The expected lifecycle is:

    PLAN
    -> plan review
    -> explicit ACT authorization
    -> implementation
    -> static validation
    -> browser validation
    -> final report
    -> stable checkpoint

PLAN must inspect the actual current repository.

It must not assume that an earlier prompt, handoff, roadmap, or repository snapshot still represents the current source.

ACT must remain inside the approved boundaries.

A direct ACT is allowed only when the user explicitly overrides the normal workflow.

---

## 24. Development Agents Must Inspect Before Assuming

Before proposing or implementing a change, the development agent should inspect:

- current branch;
- current repository status;
- uncommitted and untracked files;
- workflow documents;
- environment instructions;
- relevant architecture documents;
- actual source owners;
- loading order;
- persistence boundaries;
- current runtime evidence;
- applicable validators and acceptance requirements.

Repository source and verified runtime evidence take priority over assumptions from earlier conversations.

If the source, runtime evidence, and architecture disagree, the agent must reconcile them during PLAN.

---

## 25. Every PLAN Must Pass the Product Decision Filter

Before a package is ready for ACT, its PLAN should answer:

1. What user problem is being solved?
2. What is the smallest complete solution?
3. What is the canonical source of the information?
4. Which existing owner should handle each responsibility?
5. What existing shared state, event, or workflow can be reused?
6. Does the proposal create another source of truth?
7. Can the information flow be explained clearly?
8. Is any complexity being added only for hypothetical future use?
9. Which behavior is explicitly out of scope?
10. What current files and hunks must be protected?
11. How will static and browser behavior be validated?
12. What stable checkpoint closes the package?

If the proposed solution cannot answer these questions clearly, it is not ready for ACT.

---

## 26. Architecture Review Triggers

A package should return to architecture review when it would:

- change the canonical source of information;
- create a new persistent state owner;
- duplicate an existing domain owner;
- change a public module contract;
- alter physical Save boundaries;
- alter Workspace Index ownership;
- introduce automatic source mutation at a new boundary;
- add broad metadata migration or backfill;
- establish a new Full Mode;
- create a new global filtering layer;
- make an optional workflow mandatory;
- introduce synchronization between competing sources of truth;
- make the information flow difficult to explain.

Small CSS, presentation, or local interaction changes do not automatically require architecture review when existing ownership and state contracts remain unchanged.

They still require the normal PLAN and ACT workflow unless explicitly overridden.

---

## 27. Documentation Should Remain Layered and Maintainable

Do not copy every product principle into every architecture document.

Use concise cross-references.

The intended documentation hierarchy is:

    Product principles
    -> stable decision framework

    Development workflow
    -> implementation process

    Development environment
    -> execution constraints

    Architecture documents
    -> subsystem-specific authority

    Roadmap
    -> current and future package order

    PLAN handoffs
    -> current source-grounded implementation proposal

    Completion reports
    -> evidence and checkpoint status

Architecture documents should remain authoritative for their specific subsystems.

Historical handoffs should normally remain unchanged as records of the decision state at that time.

The roadmap may evolve frequently.

Product principles should change only when the long-term product philosophy changes.

---

## 28. Definition of a Good MarkmapEditor Change

A good change:

- solves a real user problem;
- is understandable;
- fits the existing information flow;
- has clear ownership;
- reuses shared state;
- does not create unnecessary maintenance;
- preserves basic Markdown workflows;
- keeps optional structures optional;
- remains conservative when information is ambiguous;
- is implemented in a focused package;
- has explicit exclusions;
- is validated statically and in the browser;
- ends with a stable checkpoint;
- leaves the application simpler or more useful without making it harder to understand.

The goal is not to maximize the number of features.

The goal is to create a coherent, dependable, Markdown-centered environment that becomes richer progressively while remaining straightforward to use, inspect, and maintain.
