# Test Catalog

Authoritative inventory of tracked validation scripts (37) plus the aggregate
runner. Classified from executable behavior (entrypoints and assertions), not
filename. Nothing here was executed merely to classify it.

- Direct command for every entry: `node scripts/<file>` (unless noted).
- Aggregate profiles: `npm run validate:<name>` (see Profiles below).
- Logs: `.validation/` (git-ignored). Concise output only; full child output
  stays in the logs.
- Tiers: defined in docs/AI_DEVELOPMENT_WORKFLOW.md §32–§33.

Legend — Type: V=validator, M=mutation control (Tier M), A=acceptance fixture
(static/deterministic replay), AA=anchor audit, R=release check,
G=fixture generator, U=utility, H=harness. Cost: fast (<2s), medium (<10s),
slow. Mutation: none / isolated (self-restoring sha256 — run only in a
disposable copy).

## Profiles (scripts/validate-aggregate.cjs)

| Profile | Command | Contents | Measured |
|---|---|---|---|
| quick | `npm run validate:quick` | syntax (93 files), `git diff --check`, mutation-anchor-audit | 24.8s (exit 0) |
| projects | `npm run validate:projects` | contract, consumer, view, save-integration, device-acceptance, anchor audit | 4.6s (exit 0) |
| tasks | `npm run validate:tasks` | task-reconcile, task-contract, task-consumers, index-task-filter | on demand |
| workspace | `npm run validate:workspace` | 11 active Workspace suites (list below) | on demand |
| reports | `npm run validate:reports` | documented SKIP — no standalone Reports suite; parity owned by contract group Q + consumer Report-parity group | instant |
| package5 | `npm run validate:package5` | Tier 3: hygiene + all active Project suites + task/sidebar consumers + release parity normal & strict | at closure |
| closure | `npm run validate:closure` | Tier 4: package5 + all remaining active suites + parity normal & strict | at closure |
| mutation:projects | `npm run validate:mutation:projects` | Tier M: contract/view/consumer mutation controls, sequentially, in a disposable copy (`.validation/isolated-*`, removed afterward) — never the served tree | at gates |

`--demo-fail` (runner self-test) appends an injected failing child to prove
nonzero propagation, failed-child naming and log-path printing without
touching production files (proven: exit 1, `[FAIL] demo-fail — exit 3` +
`details:` line). `--setup-only` (mutation profiles) creates the disposable
copy, reports the isolated cwd and removes it WITHOUT running controls — the
isolation seam: sha256 of served parser/adapter/view/main/css verified
identical before and after, no `isolated-*` directory left behind.
`--list` prints profile names. Direct script execution always remains valid.

## Projects

| File | Purpose / protected owners | Type | Cost | Mutation | Tier / trigger | Status |
|---|---|---|---|---|---|---|
| project-contract-validators.cjs | Declaration grammar, mme-project comments, identity/created, quarters, fenced/task exclusion, reconciliation (group U: bullet prefixes × short/UUID IDs × all mutation ops, idempotence, dup/malformed/neighbor/fence refusals) — owners: workspace-parser.js, project-metadata-mutation.js | V | fast | none | T1/T2 — parser, grammar, mutation-owner changes | active |
| project-consumer-validators.cjs | Index→Projects view consumer contract: projectId propagation, stage/state schema, pure mutation owner, visible/managed mutations, route/capabilities, read-only preservation — owners: main.js project consumers, project-metadata-mutation.js, projects-view consumers | V | fast | none | T2 — consumer contracts, stage/state schema | active |
| project-view-validators.cjs | Projects view + adapter: drafts, verification barriers, batch Apply (AP32–AP41: bullet batch, not-found origin, owner-exception origin), scroll/splitter/columns, narrow layout, quarter contract — owners: projects-view.js, project-visual-adapter.js, css workspace project rules | V | fast | none | T2 — view/adapter/CSS project presentation changes | active |
| project-save-integration-validators.cjs | Same-source and cross-source Save + readback, one Save per changed source, failed-draft retention — owners: adapter save path, MME_PROJECT_EDIT_HOST integration | V | fast | none | T2 — save/readback behavior | active |
| project-device-acceptance.cjs | DOM-shim acceptance replay of the Projects device checkpoint (STATIC evidence only; physical acceptance stays with the owner) — depends dom-shim.cjs | A | fast | none (in-memory) | T2 — at Projects checkpoints | active |
| mutation-anchor-audit.cjs | Proves every declared mutation-control anchor exists exactly once in shipped source | AA | fast | none | T0/T3 — hygiene/closure runs | active |
| project-contract-mutation-controls.cjs | Controls over workspace-parser.js / main.js anchors | M | slow | isolated copy only | TM — contract-sensitive or material validator changes | gate-only |
| project-view-mutation-controls.cjs | Controls over adapter/view/main/index/css anchors | M | slow | isolated copy only | TM — view/adapter contract changes | gate-only |
| project-consumer-mutation-controls.cjs | Controls over consumer-owner anchors | M | slow | isolated copy only | TM — consumer contract changes | gate-only |

## Tasks

| File | Purpose / protected owners | Type | Cost | Mutation | Tier / trigger | Status |
|---|---|---|---|---|---|---|
| task-reconcile-validators.cjs | Save-time Task reconciliation (metadata ↔ source lines) — owners: task reconcile path in main.js/tasks | V | fast | none | T2 — reconcile/priority-source changes | active |
| workspace-task-contract-validators.cjs | Normalized Task contract, scope projection, priority-source reconciliation (cross-consumer owner) | V | fast | none | T2 — Task contract changes | active |
| workspace-task-consumers-validators.cjs | Task Review / Board / Projects / Index projection preservation | V | fast | none | T2 — consumer/projection changes | active |
| workspace-index-task-filter-validators.cjs | Workspace Index Task filtering behavior | V | fast | none | T2 — index task filter changes | active |
| workspace-index-task-filter-mutation-controls.cjs | Controls over index task-filter anchors | M | slow | isolated copy only | TM | gate-only |
| act2a-checkpoint-harness.cjs | Deterministic replay of the ACT 2A device checkpoint scenarios against shipped owners | H | medium | none | checkpoint support — run on demand, not in profiles | gate-only |

## Workspace

| File | Purpose / protected owners | Type | Cost | Mutation | Tier / trigger | Status |
|---|---|---|---|---|---|---|
| current-document-scope-validators.cjs | One parser, two explicit scopes, handle-proven Workspace membership | V | fast | none | T2 — scope contract changes | active |
| workspace-detection-validators.cjs | Workspace detection/roots | V | fast | none | T2 — detection changes | active |
| workspace-discovery-consumers-validators.cjs | Discovery consumers | V | fast | none | T2 — discovery consumer changes | active |
| workspace-storage-validators.cjs | notes/ storage scanner + open transaction | V | fast | none | T2 — storage/open changes | active |
| workspace-note-creation-validators.cjs | Unified Note creation owners | V | fast | none | T2 — creation changes | active |
| workspace-note-metadata-validators.cjs | Active-note metadata actions (Like/Pin/Archive/knowledge) — Quick Action owners in main.js | V | fast | none | T2 — REQUIRED for Stage B Quick Action auto-Save | active |
| workspace-notes-sidebar-validators.cjs | Notes/Knowledge Sidebar projections | V | fast | none | T2 — sidebar projection changes | active |
| workspace-index-notes-validators.cjs | Index ↔ Notes projection | V | fast | none | T2 — index notes changes | active |
| workspace-today-index-validators.cjs | Today-created Note enters Index same turn | V | fast | none | T2 — today/index changes | active |
| workspace-lifecycle-output-validators.cjs | Workspace lifecycle output contract | V | fast | none | T2 — lifecycle output changes | active |
| workspace-sidebar-visual-validators.cjs | Sidebar hierarchy/badges/Active-action ownership (includes B21 two-line badge) | V | fast | none | T2 — sidebar visual changes | active |

## Links and shared runtime

| File | Purpose / protected owners | Type | Cost | Mutation | Tier / trigger | Status |
|---|---|---|---|---|---|---|
| wiki-link-resolution-validators.cjs | Wiki Link resolution rules | V | fast | none | T2 — resolution changes | active |
| wiki-link-relationship-validators.cjs | Links In / Links Out relationships | V | fast | none | T2 — relationship changes | active |
| wiki-link-consumer-validators.cjs | Wiki Link consumers | V | fast | none | T2 — consumer changes | active |
| mode-session-validators.cjs | ModeSession safe restoration in a vm sandbox — owners: js/core/mode-session.js | V | fast | none | T2 — route/session changes | active |
| html-preview-render-validators.cjs | HTML Preview renderer contract vs marked defaults — owners: js/main.js renderHtmlWithShiki/renderer | V | fast | none | T2 — preview renderer changes | active |
| dom-shim.cjs | Minimal DOM shim shared by Project acceptance suites — NOT a validator, makes no layout claims | U | fast | none | dependency only | utility |

## Release / documentation

| File | Purpose / protected owners | Type | Cost | Mutation | Tier / trigger | Status |
|---|---|---|---|---|---|---|
| release-parity.cjs | Single version identity across js/release/release.js and sw.js (strict: `RELEASE_PARITY_STRICT_SW=1`) | R | fast | none | T0/T3/T4 — release-adjacent change; closure normal+strict | active |
| release-notes-validators.cjs | Release Notes content contract | R | fast | none | T4 — Help/Release Notes changes | active |
| update-ready-validators.cjs | Update-ready notification contract | R | fast | none | T2/T4 — update flow changes | active |
| dependency-cache-validators.cjs | Offline dependency cache contract (sw.js/index.html structure + vm harness) | R | medium | none | T2/T4 — sw.js/dependency changes | active |

## Utilities / generators

| File | Purpose / protected owners | Type | Cost | Mutation | Tier / trigger | Status |
|---|---|---|---|---|---|---|
| package3-device-workspace.cjs | Generates a disposable fixture Workspace into a caller-chosen output dir; never writes into the repository | G | fast | writes only to the given output dir | device checkpoints on demand | utility |
| validate-aggregate.cjs | Profile runner: concise lines, `.validation/` logs, nonzero propagation, `--demo-fail` self-test, isolated Tier M copy | U | fast | copies tree for mutation profiles only | every aggregate command | utility |

### Status counts
active 30 · gate-only 5 · utility 3 (38 entries = 37 tracked scripts + the
new runner) · historical 0 · merge/dup/removal candidates 0. (No script was
found to be a duplicate or removal candidate; the three temporary Package 5
one-off scripts were removed in Stage A after the coverage transfer below.)

## Consolidation coverage mapping (retired Package 5 one-offs)

The three temporary scripts were deleted only after every unique assertion
was transferred to a canonical suite. Equivalence proven by re-running both
canonical suites green (contract 434/434, view 523/523).

| Retired script | New home | Assertion IDs |
|---|---|---|
| package5-bullet-locator-regression.cjs (48 checks) | project-contract-validators.cjs group U | U1-/U2-/U3-/U4-/U5-/U6- × {short,uuid} × {plain,dash,star,plus} = 48 |
| package5-bullet-ops-coverage.cjs (127 checks) | project-contract-validators.cjs group U | U7–U11 × {plain,dash,star,plus} × 6 operations = 120; U12 duplicate-ID, U13 malformed-comment, U14–U16 neighbors, U17–U18 fenced = 7 |
| package5-batch-and-diagnostics.cjs (16 checks) | project-view-validators.cjs group AP | AP32 bullet-alone ok + AP32 Save count + AP33 prefix/readback/id; AP34 two-source mixed batch + Save/buffer counts; AP35 bullet prefix after batch; AP36 not-found refusal + AP37 mutation-owner origin + AP38 zero writes/Saves; AP39 owner-exception refused + AP40 never proven not-found + AP41 zero writes/Saves |

Coverage checklist (all now canonical): plain/dash/star/plus declarations ✓ ·
short and UUID IDs ✓ · all 6 supported operations ✓ · idempotence ✓ ·
duplicate-ID refusal ✓ · malformed-comment refusal ✓ · neighboring
declarations ✓ · fenced-code exclusion ✓ · same-source and cross-source
batch ✓ · Save counts and readback ✓ · mutation-owner failure origin ✓ ·
owner-exception origin ✓ · zero writes on refusal ✓.

