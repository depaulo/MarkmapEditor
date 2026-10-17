# Decision Log

Durable operational decisions. After integration each entry carries a short
pointer to the canonical document that now owns the decision.

## D-001 — Cline continuity model
- Date: 2026-10-15
- Status: integrated
- Decision: Rules (.cline/rules/) define mandatory behavior; AI-state
  (docs/ai-state/) carries compact continuity; architecture carries durable
  truth; Skills only for proven repeatable procedures; MCP only for necessary
  external capabilities; Repomix secondary whenever repository access exists.
- Evidence/reason: repeated context loss across model switches; repository
  state files beat conversation archaeology.
- Canonical destination: .cline/rules/00-markmapeditor-entrypoint.md;
  docs/ai-state/README.md; docs/AI_DEVELOPMENT_WORKFLOW.md §30–§33.
- Integration status: complete (Stage A).

## D-002 — Project declaration grammar
- Date: 2026-10-15
- Status: integrated
- Decision: plain `Project:` declaration is the recommended form; dash/star/plus
  bullet forms are compatible and their prefix is preserved by the mutation
  owner; Task-checkbox lines are excluded; fenced code is excluded.
- Evidence/reason: owner-accepted Package 5 physical inspection; parser and
  mutation-owner contract fixtures (contract suite group U).
- Canonical destination:
  docs/architecture/MarkmapEditor_1.0_PACKAGE_5_MANAGED_PROJECT_ARCHITECTURE.md
  §2.4.
- Integration status: complete.

## D-003 — Validation organization
- Date: 2026-10-15
- Status: integrated
- Decision: tests are selected by changed owner via OWNER_TEST_MATRIX; not
  every script runs after every edit; mutation controls run only in isolated
  disposable copies; static, browser and device evidence are separate classes
  and never substitute for each other.
- Evidence/reason: measured profile durations in TEST_CATALOG; Tier 0–4/M/D
  definitions.
- Canonical destination: docs/AI_DEVELOPMENT_WORKFLOW.md (Validation Tiers);
  docs/validation/OWNER_TEST_MATRIX.md; docs/validation/TEST_CATALOG.md.
- Integration status: complete (Stage A). TEST_CATALOG.md (38 entries) and
  OWNER_TEST_MATRIX.md created; validate:* npm scripts wired into
  package.json; .validation/ git-ignored.

## D-004 — Final pre-Package 6 corrective boundary
- Date: 2026-10-15
- Status: authorized (CURRENT_ACT)
- Decision: the final corrective boundary before Package 6 is exactly:
  Projects presentation (done, owner-accepted), Task Board column widths,
  Task Board exact source-file filter, Task Board viewport/interaction-state
  preservation, and one automatic physical Save after accepted Workspace
  metadata Quick Actions.
- Evidence/reason: owner staged brief; no other product fixes authorized.
- Canonical destination: docs/ai-state/CURRENT_ACT.md; roadmap package order.
- Integration status: Stage B in progress.

## D-005 — Roadmap reorder: consistency before Reports
- Date: 2026-10-15
- Status: integrated
- Decision: Package 5 closure → Expanded-View Behavior and Visual
  Consistency → Reports improvement → Draw.io/presentation-flow improvement →
  remaining 1.0 integration. Reports is delayed, not canceled; current Reports
  already works. Consistency must define shared surface/navigation behavior
  before Reports adds more presentation decisions.
- Evidence/reason: cohesive navigation has higher immediate product value.
- Canonical destination: NEXT_CYCLE_PLAN.md §4 (package order after Package 5);
  docs/architecture/MarkmapEditor_1.0_PRODUCT_ARCHITECTURE_AND_IMPLEMENTATION_PROGRAM.md §18.1.
- Integration status: complete (Stage C).

## D-006 — Future consistency-package direction
- Date: 2026-10-15
- Status: integrated
- Decision: next Package targets a compactable Current Document area,
  File Knowledge cards (document-scoped), Workspace Knowledge (workspace-
  scoped, exclusive owner of Workspace Search), a Document Surface
  (Edit=CodeMirror, Read=synchronized HTML; switching saves nothing and
  preserves cursor/selection/scrolls/dirty/handle), a first-class Markmap
  Structure Surface, reassessed focused surfaces, surface-owned controls with
  a global-only top bar, and cross-view consistency contracts (headers, Back,
  route restoration, scroll/filter/draft retention, empty/failure states,
  responsive behavior) — without a generic expanded-view framework and
  without turning MarkmapEditor into a generic note/database app.
- Evidence/reason: owner staged brief §22; differentiation non-goals.
- Canonical destination: docs/architecture/consistency-package-plan.md
  (PLAN-only, Stage C); NEXT_CYCLE_PLAN.md.
- Integration status: complete (Stage C, PLAN-only).

## D-007 — Operational foundation integration (Stage A)
- Date: 2026-10-15
- Status: integrated
- Decision: Stage A operational foundation is complete: workflow documentation
  integrated in small patches into docs/AI_DEVELOPMENT_WORKFLOW.md (§29–§35;
  General Rule heading preserved, exactly one), TEST_CATALOG.md and
  OWNER_TEST_MATRIX.md created under docs/validation/, aggregate validation
  runner scripts/validate-aggregate.cjs with profiles quick/projects/tasks/
  workspace/reports/package5/closure/mutation:projects, validate:* npm
  scripts added to package.json, .validation/ added to .gitignore, Tier M
  mutation controls isolated to disposable copies (.validation/isolated-*,
  removed afterward), never against the served tree.
- Evidence/reason: Stage A gate green — node --check on touched JS/CJS exit
  0, git diff --check exit 0, npm run validate:projects all suites green
  (contract 434/434, consumer 163/163, view 523/523, save-integration
  103/103, device-acceptance 74/74, mutation-anchor-audit PASS), release
  parity normal + strict OK (0.6.3 identity unchanged), --demo-fail nonzero
  propagation proven, --setup-only isolation proven (served-tree sha256
  unchanged).
- Canonical destination: docs/validation/TEST_CATALOG.md,
  docs/validation/OWNER_TEST_MATRIX.md, scripts/validate-aggregate.cjs,
  package.json validate:* scripts, docs/AI_DEVELOPMENT_WORKFLOW.md §29–§35.
- Canonical destination: docs/validation/TEST_CATALOG.md,
  docs/validation/OWNER_TEST_MATRIX.md, scripts/validate-aggregate.cjs,
  package.json validate:* scripts, docs/AI_DEVELOPMENT_WORKFLOW.md §29–§35.
- Integration status: complete (Stage A).

## D-008 — Package 5 closure and consistency package activation
- Date: 2026-10-16
- Status: integrated
- Decision: Package 5 is CLOSED. All release gates are green: Stage C docs +
  Stage D release identity committed (133607c), validation alignment
  (545da19), AI-state reconciliation (7232494) — all pushed to development
  and main with refs converged; deployment serves 0.7.0; owner accepted the
  activated build on laptop (0.6.3 → 0.7.0 upgrade path, What's New/Help,
  daily-driver smoke). The Expanded-View Behavior and Visual Consistency
  package is activated at PLAN stage: PLAN-0 = source-proven surface
  inventory, docs-only, zero production edits. Implementation requires
  separate owner authorization after PLAN review.
- Evidence/reason: owner statement (laptop acceptance, 2026-10-16); git
  rev-parse/rev-list reconciliation; release-parity + release-notes
  validators green; public Pages read at productVersion 0.7.0.
- Canonical destination: docs/architecture/consistency-package-plan.md;
  docs/ai-state/CURRENT_ACT.md (PLAN-0 ACT).
- Integration status: complete (closure); PLAN-0 in progress.
- Integration status: complete (Stage A).
