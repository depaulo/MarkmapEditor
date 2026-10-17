# Architecture Decisions — MarkmapEditor

This directory holds Architecture Decision Records (ADR-001…ADR-007). Each ADR
captures a durable decision: context, decision, consequences, and the canonical
destination where the decision lives in the architecture.

## Index

| ID | Title | Status | Canonical destination |
|---|---|---|---|
| ADR-001 | Cline continuity model | Integrated | `.cline/rules/00-markmapeditor-entrypoint.md`; `docs/ai-state/README.md`; `docs/AI_DEVELOPMENT_WORKFLOW.md` §30–§33 |
| ADR-002 | Project declaration grammar | Integrated | `docs/architecture/MarkmapEditor_1.0_PACKAGE_5_MANAGED_PROJECT_ARCHITECTURE.md` §2.4 |
| ADR-003 | Validation organization | Integrated | `docs/AI_DEVELOPMENT_WORKFLOW.md` (Validation Tiers); `docs/validation/OWNER_TEST_MATRIX.md`; `docs/validation/TEST_CATALOG.md` |
| ADR-004 | Final pre-Package 6 corrective boundary | Authorized | `docs/ai-state/CURRENT_ACT.md`; roadmap package order |
| ADR-005 | Roadmap reorder: consistency before Reports | Integrated | `NEXT_CYCLE_PLAN.md` §4; product architecture §18.1 |
| ADR-006 | Consistency package scope and surface model | Integrated | `docs/architecture/consistency-package-plan.md`; `NEXT_CYCLE_PLAN.md` |
| ADR-007 | Operational foundation integration (Stage A) | Integrated | `docs/validation/TEST_CATALOG.md`; `docs/validation/OWNER_TEST_MATRIX.md`; `scripts/validate-aggregate.cjs`; `package.json` validate:\* scripts; `docs/AI_DEVELOPMENT_WORKFLOW.md` §29–§35 |
| ADR-008 | Package 5 closure and consistency package activation | Integrated | `docs/architecture/consistency-package-plan.md`; `docs/ai-state/CURRENT_ACT.md` (PLAN-0 ACT) |

ADRs are durable. Once integrated into canonical architecture, the ADR itself
remains as the decision record and carries a pointer to the canonical owner.