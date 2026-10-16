# AI State — Operational Continuity Files

Compact, tracked operational continuity for AI coding agents. These files do
NOT replace architecture, roadmap, TODO or source.

## File responsibilities

- **ACTIVE_CONTEXT.md** — where the program is right now: Package, phase,
  branch/HEAD, accepted evidence, working-tree boundary, immediate next
  action, do-not-start list, required architecture, owner checkpoint, known
  blockers. Kept compact; no historical reports.
- **CURRENT_ACT.md** — the single authorized ACT: status, mission, stage,
  allowed/protected files, changed owners, required validation tier, selected
  suites, mutation gate, browser/device checkpoint, stop conditions, closure
  requirements. Does not accumulate older ACT prompts.
- **VALIDATION_STATE.md** — current required tier, selected suites, inherited
  static/browser/device evidence (separated), current-stage evidence, pending
  owner checkpoints, release boundary checklist.
- **DECISION_LOG.md** — durable decisions with ID, date, status, evidence and
  canonical destination. After integration, entries carry a short pointer to
  the canonical document that now owns the decision.

## Source-authority precedence

1. accepted canonical architecture;
2. roadmap and Package mapping;
3. checked-out source and executable validators;
4. AI-state documents;
5. previous reports and conversations;
6. Repomix snapshots.

AI-state can never override architecture or current source. AI-state is not a
second roadmap and not a permanent ACT archive.

## Update ownership

Only an agent executing an authorized ACT updates these files, and only at
accepted ACT boundaries or owner-checkpoint changes. Updates record what
actually happened, never intent.

## Cleanup lifecycle

After a Package closure: migrate durable decisions into canonical
architecture, delete stale operational detail, and reset CURRENT_ACT to the
next authorized ACT. Stale entries are cleaned, not accumulated.

## Model-switch procedure

A replacement model must read the six entry documents (see
.cline/rules/00-markmapeditor-entrypoint.md) before working. It must not
reconstruct active state from conversation history when repository state
files exist. Unresolved tool_call_ids must be resolved before handoff.

## prohibitions

- No complete terminal logs or source dumps in AI-state. Summaries only.
- Browser/device evidence must be labeled accurately and kept separate from
  static Node evidence.
- Full Repomix snapshots must not be loaded when the repository is available.

## Document classes

- **Rules** (.cline/rules/) — mandatory agent behavior.
- **AI-state** (docs/ai-state/) — compact operational continuity.
- **Architecture** (docs/architecture/) — durable truth about the product.
- **Skills** — only proven repeatable procedures; none mandatory today.
- **MCP** — only necessary external capabilities; none added.
