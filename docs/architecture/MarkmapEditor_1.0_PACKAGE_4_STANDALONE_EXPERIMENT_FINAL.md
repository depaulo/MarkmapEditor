# Package 4 — Standalone Note Experiment: Final Record

**Status: EXPERIMENT ARCHIVED. NOT RELEASED. NOT SHIPPED.**

This document is the complete final record of the Package 4 Standalone Note
experiment (ACT 4A and ACT 4B). It describes an unreleased experiment that the
owner has decided to stop. Nothing in this document describes a released
feature, a public capability, or shipped behavior.

- Decision date: 2026-10-02
- Preserved branch: `archive/package4-standalone-experiment`
- Preserved tag: `package4-standalone-experiment-final`
- Active development line: returned to the accepted Package 3 closure

---

## 1. Original hypothesis

Journal was already the authoritative owner of physical Workspace files, but a
person holding a single Markdown file outside any Workspace had no place in the
product. The hypothesis was:

> If Journal can open a **Standalone Note** — one physical Markdown file with no
> Workspace — then Journal becomes the single place where both Workspace and
> loose-file Notes are managed, and the three-mode model gains a valuable fourth
> experience at low cost.

The cost hypothesis was that the Note experience could reuse the existing
Workspace owners (Active, Tags, Tasks, Links Out) in a "current-document" scope,
rather than building a parallel Sidebar.

## 2. ACT 4A scope — shared Current Document scope composition

ACT 4A established the **scope** layer, not the composition:

- One shared parser consumed by both a Current Document scope and a Workspace
  scope, with a proven handle-based Workspace-membership rule.
- A single Current Document composition object describing availability, identity
  and projections (tags, tasks, links) for the open file.
- Scope separation proven: Current Document reads never touch the Workspace
  Index, and Workspace reads never claim Current Document facts.

ACT 4A delivered the foundation and was statically accepted (commit `4396f1a`).

## 3. ACT 4B scope — the isolated Standalone Note composition

ACT 4B composed the Standalone Note experience on that scope:

- Journal "Open Note" opening a physical, writable Markdown file.
- A Sidebar composition that withdraws every Workspace-only panel and renders
  four Current Document hosts: Active, Tags, Tasks, Links Out.
- Read-only presentation for Tasks (no mutation controls, no Workspace paths).
- Local line navigation into the open buffer.
- Links Out in an honest not-ready state.
- Local child-panel collapse and global Sidebar collapse.

## 4. Final architecture attempted

```
Journal (app context)
├── Workspace composition  -> existing Workspace owners, existing Index
└── Note composition       -> Current Document scope owners, no Index
     ├── Active        (Current Document identity)
     ├── Tags          (local tag projection)
     ├── Tasks         (read-only Current Document projection)
     └── Links Out     (local, not-ready)
```

Two composition owners (`composeStandaloneNotePanels`,
`applySidebarComposition`) with one shared delegated collapse owner, one shared
Task Review module, one shared parser, and one shared Workspace Index.

---

## 5. Final device-tested functionality (WORKING)

- Journal Open Note
- physical writable Markdown opening
- Standalone Note -> another Standalone Note
- Save to the correct physical handle
- Standalone Note identity and filename
- global Sidebar collapse and expansion
- child-panel collapse and expansion
- Active local projection
- Tags local projection
- Current Document Tasks in read-only presentation
- current-document line navigation
- local Links Out in not-ready state
- Journal neutral-to-Workspace behavior remained operational
- complete Workspace experience remained operational
- Editor and Slides remained isolated

## 6. Final known issues (NOT corrected before archiving)

These are part of the final experimental record and were deliberately left
uncorrected:

- the empty Links Out state displays "No Links Out." **twice**
- the empty Tags state displays "No tags." **twice**
- Standalone Note -> Workspace remains blocked
- Workspace -> Standalone Note remains blocked
- ACT 4C transition/recovery work was not implemented
- ACT 4D was not opened
- no Package 4 release was created
- the Codespaces preview produced environmental Service Worker fetch failures
  (including `sw.js` 404 responses); this is an environment defect and did not
  invalidate the accepted runtime evidence

## 7. Blocked ACT 4C transitions

The two cross-composition transitions were never implemented:

- **Note -> Workspace**: entering a Workspace from an open Standalone Note.
- **Workspace -> Note**: opening a loose Markdown file while a Workspace is active.

Both remained blocked by the accepted cross-composition guards. ACT 4C was
planned (transition and recovery semantics, observer generations, stale guards)
but **cancelled**.

## 8. Validator and mutation-testing lessons

- Behavioral fixtures (execute the real owner, observe the real result) are
  strictly preferable to source-string presence checks. Several defects were
  invisible to string checks and only appeared when the owner actually ran.
- A test predicate must return a **strict boolean**. A fixture that receives a
  function and coerces it with `Boolean()` reports success without ever
  evaluating anything — this bug shipped once in this experiment and was caught
  only because the mutation controls could not make the fixture fail.
- Mutation controls must run **sequentially**, never concurrently: two runs
  mutate the same files.
- Mutated files must restore **byte-identically** (verified by hash), and a
  killed run leaves residue — a lock file is mandatory, and residue must be
  detected by searching for the mutation marker, not only by `git status`.
- When a target string exists in more than one owner, a naive replace mutates the
  wrong owner and proves nothing; anchor the replacement positionally.

## 9. CSS `hidden`-versus-computed-display lesson

`element.hidden = true` is only a **request**. The UA `[hidden] { display: none }`
is a UA-origin rule, so **any author `display:` rule wins**, regardless of the
`hidden` state. In this experiment:

- ID-level author `display: flex` rules made `hidden = true` completely inert for
  several Sidebar hosts.
- An `!important` ID-scoped composition exception outranked the compact-rail rule
  and forced panels back on screen inside the collapsed rail.
- The fix was always the same: give `hidden` a real, specific `!important`
  authority, and scope competing exceptions to the state they actually describe.

`hidden` is not evidence. Only **computed** `display` is.

## 10. Owner and lifecycle lessons

- Current Document and Workspace are **different information scopes**, not two
  views of one scope.
- **Physical identity** is path/handle/filename; **H1 is visual identity**. They
  must never be conflated in an availability decision.
- A **retained `rootHandle` does not mean active Workspace presentation**. The
  handle can be retained for recoverability while the Workspace projection is
  inactive — and using the handle as a presentation decision is always wrong.
- **Completion logs do not prove final DOM state.** "composition: complete" was
  logged while the Sidebar was visibly wrong, repeatedly.
- **Shared infrastructure can cost more than small independent experiences.** The
  composition guards, cross-mode leakage guards, and per-mode presentation
  matrices consumed more complexity than the delivered value justified.
- **An abstraction should not remain active without a proven consumer.** Once the
  second consumer never arrived, the shared layer was pure cost.

## 11. Reasons for stopping

1. The demonstrated value did not justify the Journal composition complexity.
2. The two most valuable transitions (Note -> Workspace, Workspace -> Note) were
   the hardest and remained unimplemented, so the experience was a dead end for
   real work.
3. Every defect found required reasoning across three competing visibility owners
   (`hidden`, `html.workspace-empty`, `html.journal-sidebar-collapsed`) rather
   than about the feature itself.
4. Small defects (duplicate empty-state text) survived into the final state,
   showing the surface area was still growing.

## 12. Product decision

**The owner has decided to stop the Standalone Note implementation.** This is a
product and maintenance decision.

The active product returns to the accepted three-mode model:

- **Editor** for individual Markdown files
- **Journal** for Workspace
- **Slides** for presentation

Package 5 does not begin automatically.

## 13. Archived branch name

`archive/package4-standalone-experiment`

Created from the exact final experimental state of `development` (all Package 4
commits plus the complete uncommitted ACT 4B implementation, including
validators, probes, diagnostics and mutation controls).

## 14. Archived tag name

`package4-standalone-experiment-final`

Annotated tag pointing at the archive snapshot commit.

## 15. Future unified-Open hypothesis (NOT IMPLEMENTED)

A cheaper hypothesis survives from this experiment:

> Journal may eventually expose **one primary Open entry** with an explicit
> choice — *Open Workspace* or *Open Markdown File*. A Markdown file would reuse
> the **existing Editor experience** rather than restore the Package 4 local
> Sidebar.

This avoids an entire Sidebar composition, avoids all Current Document scope
infrastructure, and requires no new collapse/visibility owner. It is a
**hypothesis only** and was not implemented during restoration.

## 16. Explicit release statement

**The Package 4 Standalone Note experiment was NEVER RELEASED.**

- No release was created for it.
- `productVersion` was never bumped for it.
- No public Release Notes entry describes it.
- No Help copy describes it.
- No Service Worker cache boundary was created for it.
- It exists only in the archive branch and archive tag recorded above.

The public product identity remains the accepted 0.6.3 tasks/wiki-links
foundation release.

---

## Reusable lessons (summary)

1. Current Document and Workspace are different information scopes.
2. Physical identity is path/handle/filename; H1 is visual identity.
3. A retained `rootHandle` does not mean active Workspace presentation.
4. `hidden = true` does not prove computed `display: none`.
5. Completion logs do not prove final DOM state.
6. Behavioral fixtures beat source-string presence checks.
7. Test predicates must return strict booleans.
8. Mutation controls must run sequentially.
9. Mutated files must restore byte-identically.
10. Shared infrastructure can cost more than small independent experiences.
11. An abstraction should not remain active without a proven consumer.

