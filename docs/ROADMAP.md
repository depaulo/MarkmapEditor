# MarkmapEditor Roadmap

> **This document is a roadmap, not the architecture.** The canonical
> architecture and package contract is
> `docs/architecture/MarkmapEditor_1.0_PRODUCT_ARCHITECTURE_AND_IMPLEMENTATION_PROGRAM.md`.
> Read that document first. This file records the sequence, the accepted
> source-owner evidence, and the pointer to the current package.

## Program position

| Milestone | Status |
|---|---|
| Release 0.6.2 (Notes Workspace Foundation) | ACCEPTED and published |
| ACT V0 (Sidebar visual correction) | IMPLEMENTED, mobile checkpoint accepted |
| Canonical 1.0 architecture synchronization | COMPLETE (Gate 1 accepted) |
| Package 1 (post-release defects) | DORMANT; no reproduced defect |
| Package 2 (Tasks) | CLOSED |
| Package 5 (Managed Project Foundation) | CLOSED — 0.7.0 released, owner-accepted 2026-10-16 |
| Package 6 (Expanded-View Behavior and Visual Consistency / Consistency and Document Experience) | ACTIVE on `development` — Target 0.8.0; ACT 1 accepted; ACT 2 (Slices 1–3) accepted; ACT 3 ACCEPTED; ACT 4 PLAN-0 active — File Knowledge cards and Workspace Index consolidation |
| ACT 4 | File Knowledge cards (Workstream A) + Workspace Index compact/full consolidation (Workstream B) | PLAN-0 — source inspection only; implementation NOT AUTHORIZED until D1 gate green |
| ACT 5 | Current Document Edit/Read and Document Surface | PLANNED |
| ACT 6 | Archive Participation and Final Cross-Surface Consistency | PLANNED |
| ACT 7 | Package Closure and 0.8.0 Release | NOT AUTHORIZED |
| Package 7 (Native Report Composer) | PLANNED — Probable target 0.9.0 |
| Package 8 (Draw.io Adapter) | CONDITIONAL — based on validated value |
| Package 9 (1.0 Integration and Product Acceptance) | PLANNED |

## Package order after Package 5

1. **Expanded-View Behavior and Visual Consistency** (current — Package 6)
2. Native Report Composer (Package 7)
3. Draw.io Adapter (Package 8)
4. 1.0 Integration and Product Acceptance (Package 9)

**Older Package numbering (Packages 3, 4 as described in NEXT_CYCLE_PLAN.md / STATUS.md) is HISTORICAL — do not use for active Package/ACT/version selection.**

## Package order after Package 5

1. **Expanded-View Behavior and Visual Consistency** (current — Package 6)
2. Reports improvement
3. Draw.io / presentation-flow improvement
4. Remaining 1.0 integration

## Deferred past 1.0

- Subprojects and Project hierarchy
- Rename File and automatic Wiki Link rewriting
- Monthly calendar
- Extraction to Knowledge
- Non-Markdown assets browser
- Highlights and Reminders (including the alert subsystem)
- Shared `@` attribute layer
- Autocomplete
- People/assignment system
- Mermaid / Graph
- Reveal.js completion
- Draw.io internal architecture redesign and embedded Draw.io editor
- Milestones and Gantt
- Major visual redesign

## 2.0 idea bucket

- Shared Highlights / Reminders model
- Shared `@` layer and autocomplete

Neither converts into implementation requirements. Recorded so the ideas are
not lost, not so they can be started.

## Mobile-first execution

Primary development and static validation occur on the cellphone. Validators,
mutation tests and source inspection follow every ACT. Browser checkpoints
happen on S22/DeX when the interaction is available there. Static validation
quality is never reduced because development happens on mobile.