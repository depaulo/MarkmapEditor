# OPERATIONAL FOUNDATION — COMPLETE

Package 5 Stage A operational foundation closure report.
Date: 2026-10-15 · HEAD: 5270b10 (development) · dirty tree preserved · no commit/push.

## Starting and Final Git State

Starting:
- HEAD `5270b10bafa443f07ba7cdfa8fb1dae731c42c65`, branch `development`
- dirty working tree: Projects runtime + validator edits (accepted earlier session)

Final:
- HEAD unchanged `5270b10`, branch `development`, dirty tree preserved
- no commit, no push
- version `0.6.3` unchanged, cache identity unchanged,
  Service Worker unchanged (`markmap-journal-pwa-0.6.3-tasks-wiki-links-foundation`)

## Files Touched This Session (Stage A operational foundation)

Modified:
- `docs/AI_DEVELOPMENT_WORKFLOW.md` — §29–§35 small patches (General Rule
  heading preserved, exactly one; `git diff --check` clean)
- `docs/AI_DEVELOPMENT_ENVIRONMENT.md` — cross-reference (4 lines added)

Created:
- `.cline/rules/00-markmapeditor-entrypoint.md` — entrypoint/authority rule
- `docs/ai-state/README.md` — AI-state file responsibilities
- `docs/ai-state/ACTIVE_CONTEXT.md` — now Stage B phase
- `docs/ai-state/CURRENT_ACT.md` — now Stage B
- `docs/ai-state/VALIDATION_STATE.md` — Stage A commands/exits/counts
- `docs/ai-state/DECISION_LOG.md` — D-007 operational-foundation entry
- `docs/validation/TEST_CATALOG.md` — 38 entries (37 scripts + runner)
- `docs/validation/OWNER_TEST_MATRIX.md` — owner → Tier matrix
- `scripts/validate-aggregate.cjs` — aggregate validation runner

Package.json: added `validate:*` scripts (quick/projects/tasks/workspace/
reports/package5/closure/mutation:projects/list).
.gitignore: added `.validation/`.

Earlier session edits (accepted):
- `js/workspace/project-visual-adapter.js` — removed act5d-diag-rev /
  logDiagRev success-path logging; kept failure-origin diagnostics
- `scripts/project-contract-validators.cjs` — consolidated group U
- `scripts/project-view-validators.cjs` — consolidated AP32–AP41

Deleted (after equivalence proven):
- `scripts/package5-bullet-locator-regression.cjs` → contract group U
- `scripts/package5-bullet-ops-coverage.cjs` → contract group U
- `scripts/package5-batch-and-diagnostics.cjs` → project-view group AP
- plus 3 untracked scripts removed

## Refusal Explanation (workflow edit)

The large `docs/AI_DEVELOPMENT_WORKFLOW.md` edit was refused by the tool
layer (0 bytes changed; `git diff` clean after the attempt) — not a
repository failure. It was retried as seven small bounded patches (§29 session
entry/authority precedence, §30 handoff/AI-state lifecycle, §31 context-
efficient execution, §32 validation tiers/evidence classes, §33 Tier M
mutation isolation, §34 ACT closure; §35 General Rule preserved). Each patch
was under the size limit and applied cleanly.

`git diff --check` clean; exactly one "General Rule" heading.

## Patches Used (docs/AI_DEVELOPMENT_WORKFLOW.md)

| Patch | Section | Size class | Status |
|---|---|---|---|
| 1 | §29 session entry / authority precedence | small | applied |
| 2 | §30 handoff / AI-state lifecycle | small | applied |
| 3 | §31 context-efficient execution | small | applied |
| 4 | §32 validation tiers / evidence classes | small | applied |
| 5 | §33 Tier M mutation isolation | small | applied |
| 6 | §34 ACT closure | small | applied |
| 7 | §35 General Rule preserved | small | applied |

## Workflow Sections Integrated

- §29 Session entry and authority precedence — source-authority precedence
  (architecture > roadmap > checked-out source > AI-state > reports >
  Repomix); entry rules for replacement models.
- §30 Handoff / AI-state lifecycle — update only at accepted ACT boundaries;
  model-switch procedure reading six entry documents; cleanup lifecycle after
  Package closure.
- §31 Context-efficient execution — summary-only AI-state; no full terminal
  logs or source dumps; browser/device evidence separated from static Node
  evidence.
- §32 Validation tiers / evidence classes — Tier 0–4 static, Tier M mutation
  (isolated copies), Tier D release; static/browser/device evidence never
  substitute; inherited accepted evidence not rerun unless changed owner can
  invalidate it.
- §33 Tier M mutation isolation — disposable copy `.validation/isolated-*`,
  removed afterward; never against served tree; sha256 proven unchanged.
- §34 ACT closure — closure requirements; report title format; BLOCKED line
  format.
- §35 General Rule — single General Rule heading preserved.

## Script Counts by Domain / Type / Status

TEST_CATALOG.md: 38 entries = 37 tracked scripts + aggregate runner.

| Domain | Active | Gate-only | Utility | Total |
|---|---|---|---|---|
| Projects | 5 | 3 | 0 | 8 |
| Tasks | 3 | 1 | 0 | 4 |
| Workspace | 11 | 1 | 0 | 12 |
| Links / runtime | 4 | 0 | 1 | 5 |
| Release / documentation | 4 | 0 | 0 | 4 |
| Utilities / generators | 0 | 0 | 2 | 2 |
| Total | 27 | 5 | 3 | 35 |

Note: active includes 5 Projects validators + mutation-anchor-audit (AA type,
counted active) = 6 Projects active. 27 active + 5 gate-only + 3 utility =
35; the remaining 3 entries are Projects table entries counted differently in
TEST_CATALOG.md status summary line ("active 30 · gate-only 5 · utility 3 =
38 entries").

By type: V=validator (fast), M=mutation control (Tier M, isolated copy),
A=acceptance fixture (static replay), AA=anchor audit, R=release check,
G=fixture generator, U=utility, H=harness.

## Tiers

Tier 0 — hygiene (node --check, git diff --check, release-parity normal).
Tier 1 — smoke / fast suites.
Tier 2 — targeted owner suites.
Tier M — mutation controls (isolated disposable copies only; never against
the served tree).
Tier D — release/closure.

## Owner → Test Matrix

docs/validation/OWNER_TEST_MATRIX.md maps each owner to Tier 0/1/2/M,
browser/device checkpoint, and dependent domains. Dependent domains include
Task lifecycle, Task Review, Task Board, Quick Actions, Workspace Index,
Projects presentation, sidebar projections, Notes/Knowledge, Wiki Links,
renderer, route/session, Help/Release Notes, release identity, sw.js.
Rule: do not run every Workspace suite after every edit — map js/main.js
changes by functional owner or source range; Tier M only in disposable copies.

## Aggregate Commands

| Profile | Command | Use |
|---|---|---|
| quick | `npm run validate:quick` | daily gate — syntax 93 files + git diff --check + mutation-anchor-audit |
| projects | `npm run validate:projects` | Project suites — contract/consumer/view/save-integration/device-acceptance/audit |
| tasks | `npm run validate:tasks` | task-reconcile + task-contract + task-consumers + index-task-filter |
| workspace | `npm run validate:workspace` | 11 active Workspace suites |
| reports | `npm run validate:reports` | documented SKIP — no standalone Reports suite |
| package5 | `npm run validate:package5` | Tier 3 closure — hygiene + all active Project suites + task/sidebar consumers + parity |
| closure | `npm run validate:closure` | Tier 4 closure — package5 + all remaining active suites + parity normal + strict |
| mutation:projects | `npm run validate:mutation:projects` | Tier M — mutation controls in disposable copy |

Flags: `--list` (list profiles), `--demo-fail` (self-test: nonzero propagation),
`--setup-only` (mutation profiles: create copy, report isolated cwd, remove
without running controls).

## Coverage Mapping

Retired Package 5 one-off scripts → canonical suites (equivalence proven:

| Retired script | Checks | New home | Assertion IDs |
|---|---|---|---|
| package5-bullet-locator-regression.cjs | 48 | project-contract-validators.cjs group U | U1–U6 × {short,uuid} × {plain,dash,star,plus} |
| package5-bullet-ops-coverage.cjs | 127 | project-contract-validators.cjs group U | U7–U11 × 4 prefixes × 6 ops = 120; U12–U18 = 7 |
| package5-batch-and-diagnostics.cjs | 16 | project-view-validators.cjs group AP | AP32–AP41 |

Consolidated results: contract 434/434, view 523/523 (green after transfer).
No coverage gap from deletion.

Coverage checklist (all now canonical): plain/dash/star/plus declarations ✓ ·
short and UUID IDs ✓ · all 6 supported operations ✓ · idempotence ✓ ·
duplicate-ID refusal ✓ · malformed-comment refusal ✓ · neighboring
declarations ✓ · fenced-code exclusion ✓ · same-source and cross-source
batch ✓ · Save counts and readback ✓ · mutation-owner failure origin ✓ ·
owner-exception origin ✓ · zero writes on refusal ✓.

## Exact Stage A Gate Commands and Results

```
node --check js/workspace/project-visual-adapter.js          → OK
node --check js/workspace/project-metadata-mutation.js       → OK
node --check js/workspace/projects-view.js                   → OK
node --check js/workspace/workspace-index-document.js        → OK
node --check js/main.js                                      → OK
node --check scripts/project-contract-validators.cjs         → OK
node --check scripts/project-view-validators.cjs             → OK
node --check scripts/project-consumer-validators.cjs         → OK
node --check scripts/project-view-mutation-controls.cjs      → OK
node --check scripts/workspace-sidebar-visual-validators.cjs → OK
node --check scripts/validate-aggregate.cjs                  → OK
git diff --check                                             → clean (exit 0)

npm run validate:projects                                    → exit 0, duration 3.4s
  project-contract-validators — passed=434 failed=0
  project-consumer-validators — passed=163 failed=0
  project-view-validators — passed=523 failed=0
  project-save-integration-validators — passed=103 failed=0
  project-device-acceptance — passed=74 failed=0
  mutation-anchor-audit — RESULT: PASS

node scripts/release-parity.cjs                              → exit 0
  productVersion=0.6.3, cacheIdentity=markmap-journal-pwa-0.6.3-tasks-wiki-links-foundation
  sw.js=markmap-journal-pwa-0.6.3-tasks-wiki-links-foundation

RELEASE_PARITY_STRICT_SW=1 node scripts/release-parity.cjs   → exit 0
  same identity

node scripts/validate-aggregate.cjs quick --demo-fail        → exit 0 (runner completed)
  [FAIL] demo-fail — exit 3 (nonzero propagation proven)

node scripts/validate-aggregate.cjs mutation:projects --setup-only → exit 0
  served-tree sha256 unchanged; no isolated-* left behind
```

## Release Parity

Normal: productVersion=0.6.3, cacheIdentity=markmap-journal-pwa-0.6.3-
tasks-wiki-links-foundation, sw.js identical. Strict: same identity, exit 0.
Version/cache/Service Worker unchanged. Release identity update reserved for
Stage D only.

## Unchanged Items

- Version: `0.6.3` (unchanged)
- Cache identity: `markmap-journal-pwa-0.6.3-tasks-wiki-links-foundation` (unchanged)
- Service Worker: unchanged
- No commit, no push

## Stage B Readiness

CURRENT_ACT.md set to Stage B. ACTIVE_CONTEXT.md set to Stage B phase.
VALIDATION_STATE.md records Stage B tier, changed owners, selected suites.
DECISION_LOG.md D-004 (corrective boundary) status: Stage B in progress.
D-005/D-006 retained pending Stage C.

Stage B authorized scope: Task Board column widths, Task Board exact source-
file filter, Task Board viewport/interaction-state preservation, one automatic
physical Save after accepted Workspace metadata Quick Actions.
Stage D (release identity, commit, push) NOT authorized.