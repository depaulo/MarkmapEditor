# Package 4 — Standalone Note Experiment: Decision Record

**Decision: the Package 4 Standalone Note experiment is ARCHIVED and STOPPED.**
The active development line has been restored to the accepted Package 3
foundation. This record is committed on `development`; the experiment itself is
preserved separately.

- Decision date: 2026-10-02
- Active product: **Editor** (individual Markdown files), **Journal** (Workspace),
  **Slides** (presentation)
- Restoration commit: `3ab87b2` — `revert: restore development after Package 4 experiment`

---

## 1. What Package 4 was

Package 4 was an **unreleased experiment**. It was never a release, never a
version, and never a public capability:

- **ACT 4A** established a shared Current Document scope composition.
- **ACT 4B** built the Standalone Note composition on that scope: Journal Open
  Note, a Current Document Sidebar (Active / Tags / Tasks / Links Out), and
  read-only local Task presentation.

The experiment reached a meaningful, device-tested state. It was stopped on
product and maintenance grounds, not because it failed technically.

## 2. Why it stopped

The demonstrated value did not justify the Journal composition complexity:

1. The two most valuable transitions — Note → Workspace and Workspace → Note —
   were the hardest and were never implemented, leaving the experience a dead
   end for real work.
2. Every defect required reasoning across three competing Sidebar visibility
   owners (`hidden`, `html.workspace-empty`, `html.journal-sidebar-collapsed`)
   rather than about the feature itself.
3. Small defects (duplicate empty-state text in Tags and Links Out) survived into
   the final state, showing the surface area was still growing.
4. Shared infrastructure had not yet found a second proven consumer, and the
   maintenance cost of keeping it active was real.

## 3. Where the experiment is preserved

| Item | Value |
|---|---|
| Archive branch | `archive/package4-standalone-experiment` |
| Archive snapshot commit | `67abbf0` |
| Annotated tag | `package4-standalone-experiment-final` |
| Full experimental record | `docs/architecture/MarkmapEditor_1.0_PACKAGE_4_STANDALONE_EXPERIMENT_FINAL.md` |

Both the branch and the annotated tag were pushed to `origin` and verified
remotely before development was restored.

## 4. What the restoration removed from active development

- Journal Open Note entry and Standalone Note identity
- Journal note composition and the Current Document Sidebar composition
- local Active / Tags / Task Review / Links Out Sidebar adaptations
- the note/workspace presentation matrix and Note-specific CSS
- Note-specific observer generations and stale guards
- the Note-to-Workspace and Workspace-to-Note blocks
- render-completion machinery added only for Standalone entry
- ACT 4B diagnostics, the ACT 4B Resize Snapshot Logs action and the temporary
  collapse diagnostics
- ACT 4B probes, mutation tooling and experiment-only validators

## 5. What the restoration preserved

No shared Package 2/3 owner was removed merely because Package 4 consumed it:
`openSmart` and the physical file owners, `currentSaveHandle`, Save / Save As,
the Task parser, Task lifecycle, Task reconciliation, Workspace Task Review, Task
Board, Wiki Link grammar and resolver, Links In, Workspace Index, Workspace Host,
Navigation History, Mode Session, View Layout, Reports, Draw.io, Help, Release
Notes and Update Ready are all intact.

Release identity is unchanged: `productVersion` `0.6.3`, cache identity
`markmap-journal-pwa-0.6.3-tasks-wiki-links-foundation`, `sw.js` `APP_VERSION`
identical. No 0.6.4 release was created and no new Service Worker cache boundary
exists.

## 6. Status of the remaining Package 4 acts

- **ACT 4C** (cross-composition transition/recovery): **CANCELLED**
- **ACT 4D**: **CANCELLED / never opened**
- **Release 0.6.4**: **never created**

## 7. Future reconsideration

Reopening any of this requires **new product evidence** — a demonstrated user
demand that the restored three-mode model cannot serve. The preserved branch and
tag remain the reference for what was already explored.

A cheaper hypothesis survived from the experiment and is recorded as deferred
(see `NEXT_CYCLE_PLAN.md`): a single **unified Open** entry that chooses between
*Open Workspace* and *Open Markdown File*, where a Markdown file simply reuses
the existing Editor experience rather than rebuilding a local Sidebar. This is a
hypothesis only; it was not implemented during restoration.