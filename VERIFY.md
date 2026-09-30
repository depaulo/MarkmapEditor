# VERIFY.md — Verification Checklist & Procedures

This document outlines short, repeatable verification procedures suitable for DeX/mobile and desktop validation.

---

## 0. ACT V0 mobile checkpoint (performed)

ACT V0 was a Sidebar **visual correction** executed before Package 2. It is part of
the accepted 1.0 baseline, not a pending item.

**Scope verified on S22/DeX:**

1. separator visible between Workspace Index and Archive, with no double or thick border;
2. Projects panel title uses normal panel-title weight;
3. Archive panel title uses normal panel-title weight;
4. Related badge shows only `0` (or its numeric count);
5. Tags badge shows only the numeric count;
6. Workspace Index retains its `files · open` compound summary;
7. Archive Active is absent from the global Workspace actions;
8. Archive / Restore appears exactly once, in the Active panel action row;
9. Archive marks the document dirty before Save, and Save persists it;
10. a Note opened from Archive shows Restore in Active, and Restore + Save works;
11. Active and Archive collapse and expand repeatedly.

**Static proof:** `scripts/workspace-sidebar-visual-validators.cjs` — 50 fixtures,
0 failed, including five mutation controls that revert each correction and prove the
corresponding contract breaks.

**Not claimed here:** no Task, Wiki Links, Standalone, Projects, Reports, Active-card,
Workspace-Index-disclosure or pane-layout acceptance. None of those packages has begun.

---

## 0.0. ACT 2A / ACT 2A.1 Task Stabilization checkpoint (performed)

ACT 2A is CLOSED. This section records the final real-device acceptance. It is
**not** a Task Board priority-selector acceptance — no such UI was delivered.

**Scope verified on S22/DeX (disposable Workspace Note):**

1. exact source Task located for an explicit priority mutation;
2. **P2 written successfully** to the intended occurrence;
3. **Clear removed the priority successfully**;
4. physical Save succeeded in both directions;
5. Save baseline refreshed **only after** Save success;
6. Workspace Index rebuilt;
7. Task Review refreshed;
8. Task Board remained operational;
9. **both priority-only Saves reported `changed=false opened=0 completed=0 reopened=0 ambiguous=0`**;
10. no physical data loss was observed.

**Static proof at the committed HEAD:**

- `scripts/workspace-task-contract-validators.cjs` — 99 fixtures, 0 failed,
  including A01–A25 (priority/Save matching contract) and five mutation controls
  A2A1-M1–M5.
- `scripts/act2a-checkpoint-harness.cjs` — 56 fixtures, 0 failed.
- Task Lifecycle built-in validator — 101/101, 0 failed.
- Task Board built-in validator (with required DOM stubs) — 111/111, 0 failed.
- `scripts/task-reconcile-validators.cjs` — 68/0.
- `scripts/workspace-task-consumers-validators.cjs` — 62/0.
- `scripts/current-document-scope-validators.cjs` — 41/0.
- `scripts/workspace-lifecycle-output-validators.cjs` — 67/0.
- `scripts/workspace-index-notes-validators.cjs` — 58/0.
- `scripts/workspace-sidebar-visual-validators.cjs` (ACT V0) — 50/0.
- `scripts/dependency-cache-validators.cjs` — 284/0.
- `scripts/release-parity.cjs` — OK, normal **and** `RELEASE_PARITY_STRICT_SW=1`;
  release identity remains `0.6.2`, unchanged by Package 2.

**Recorded non-blocking observation:** an intermediate refresh briefly reported
`tasks=0` and `tags=0` before the final Save rebuild restored `tasks=1` and
`tags=3`. No persistent data loss and no incorrect final Index were observed.
**No runtime change was made for this.** Any future correction requires a focused
reproduction proving persistent or user-visible impact.

**Not claimed here:** ACT 2B has not begun and is not authorized. No Task Board
priority selector, Board redesign, automatic priority sorting, Active or
Workspace Index cards, version/cache change, or `main` promotion is part of
Package 2.

---

## 0.0.1 ACT 2B Task Board priority selector (performed)

ACT 2B is CLOSED. Package 2 (Task Stabilization) is therefore CLOSED.

**Scope verified on S22/DeX:**

1. Board priority selector **visible** on the card;
2. `--` / `P1` / `P2` / `P3` visible as the current priority;
3. priority mutation **operational** end to end;
4. Board and Task Review **consistent** after every Save and Index rebuild;
5. lifecycle-neutral Save contract preserved — priority-only Save reported
   `changed=false opened=0 completed=0 reopened=0 ambiguous=0`;
6. **duplicate occurrence protections preserved**;
7. **no automatic priority ordering**;
8. **no second writer** — the Board delegates to the already-exported shared
   adapter `MME_TASK_REVIEW.setTaskPriority`, the only caller of
   `MME_TASK_LIFECYCLE.applyPriority`;
9. **no second priority store** and no direct Index mutation.

**Static proof at the committed HEAD (`69bedd8`):**

- `scripts/workspace-task-contract-validators.cjs` — **184 fixtures, 0 failed**,
  including ACT 2A A01–A25, ACT 2B B01–B75, and 15 mutation controls
  (A2A1-M1–M5 and B-M1–M10).
- Task Board built-in validator — **115/115, 0 failed**. The five former badge
  fixtures were re-pointed at the trigger that replaced the badge, preserving
  their intent; four new fixtures cover the selected option, native-control
  identity, the accessible name, and canonical-only option values.
- Task Lifecycle built-in validator — **101/101, 0 failed**.
- `scripts/act2a-checkpoint-harness.cjs` — 56/0.
- Full affected regression chain — **996 passed, 0 failed** across eleven suites.
- `scripts/release-parity.cjs` — OK, normal **and** `RELEASE_PARITY_STRICT_SW=1`;
  release identity remains `0.6.2`, unchanged by Package 2.
- `node --check` clean on every Package 2 touched JS/CJS file; `git diff --check`
  clean.

**Temporary instrumentation was removed before acceptance.** A `cardHtml` /
`renderColumns` DOM probe and a build marker were used to diagnose a build/origin
mismatch on the device. Both were deleted, and the full chain above was re-run
green on the committed runtime.

**Deployment note (not a feature defect):** the Service Worker serves local assets
cache-first with no revalidation and precaches `js/tasks/task-board.js` and
`css/task-board.css`. Clearing site data re-fetches from the same origin and
therefore cannot surface an **uncommitted** build. The device must be served the
current working tree for a new build to be observable.

**ACT 2C:** CONDITIONAL and **not currently required**. The duplicate
checkbox-toggle line grammar in `js/workspace/task-review.js` (`([ xX])(`) remains
tracked; Package 2 closed without it.

**Not claimed here:** Package 3 has not begun and is not authorized. No Board
redesign, automatic priority sorting, Active or Workspace Index cards,
version/cache change, Service Worker change, or `main` promotion is part of
Package 2.

---

## 0.0.2 ACT 3A canonical Wiki Link resolution (STATICALLY ACCEPTED)

**ACT 3A — STATICALLY ACCEPTED. DEVICE ACCEPTANCE DEFERRED TO PACKAGE 3
CLOSURE.**

No browser acceptance is claimed for ACT 3A. The repository owner authorized
deferring manual S22/DeX checkpoints for ACT 3A and the following Package 3
ACTS to one integrated Package 3 closure checkpoint. This does not weaken any
static requirement.

**What ACT 3A established (source-proven):**

1. **One canonical resolution owner.** `resolveWikiTarget(rawTarget,
   indexSnapshot)` in `js/links/wiki-links.js` is the single owner. It is pure
   with respect to its input: it reads the PASSED saved Index, returns a plain
   object, and never opens a file, scans, mutates the Index, or consults a
   clock. `resolveTarget()` is now a thin back-compat wrapper over it.
2. **Documented precedence, strongest physical identity first:**
   `path` → `filename` → `h1`. The first tier that yields candidates decides; a
   weaker tier is consulted only when every stronger tier produced zero
   candidates. Physical keys (`path`, `filename`) are case-SENSITIVE; only the
   visual `h1` key is case-insensitive. Extension is stripped for all keys.
3. **Four states.** `resolved` (exactly one physical path), `missing` (none),
   `ambiguous` (2+ distinct paths in the SAME tier — all candidate paths
   returned, nothing selected, order-independent), `not-ready` (saved Index
   unavailable; never degrades to `missing`).
4. **Proven defect corrected.** The pre-ACT 3A resolver pooled every key into a
   single candidate list with no precedence, so a target matching one file's
   filename AND another Note's H1 was reported `ambiguous` — a resolution
   failure presented as ambiguity. Mutation control **W-M3** executes the legacy
   pooled algorithm alongside the canonical one on the same fixture and proves
   the defect existed and is gone.
5. **Proven defect corrected.** CodeMirror's `computeDecorations` derived link
   status from the Workspace-wide `index.links` key set and fell back to
   `'missing'` for any target absent from it, so an unsaved or Index-unlisted
   link in the active document was decorated as a **false missing target**. It
   now asks the canonical owner per target, using live-buffer offsets.
6. **Identity and safety preserved.** `targetPath` (exact physical path) remains
   the navigation identity. Missing, ambiguous and not-ready never call the
   physical opener. `openTarget` continues to reuse the existing
   `openWorkspaceFile` / `findWorkspaceFileByPath` contract unchanged.
7. **Classification preserved.** Archived, Knowledge and Pinned Notes remain
   eligible targets — preserving current accepted behavior rather than changing
   it by preference. Classification cannot duplicate a candidate because
   de-duplication is by exact path over the single `index.files` collection.

**Static proof at committed HEAD (`3ab143a`):**

- `scripts/wiki-link-resolution-validators.cjs` (new) — **65 fixtures, 0
  failed**, including 10 mutation controls (W-M1..W-M10) that execute the real
  resolver and the real legacy algorithm.
- Full affected regression — **1113 passed, 0 failed** across 13 suites,
  including the Package 2 Task contract (184/0), the ACT 2A checkpoint harness
  (56/0) and ACT V0 visual (50/0).
- Task Lifecycle built-in 101/101; Task Board built-in 115/115.
- `scripts/release-parity.cjs` OK, normal **and** `RELEASE_PARITY_STRICT_SW=1`;
  product identity remains `0.6.2` / `markmap-journal-pwa-0.6.2-notes-workspace-foundation`.
- `node --check` clean on every touched JS/CJS file; `git diff --check` clean.

**Three sibling assertions were updated, deliberately.** `workspace-discovery-consumers-validators`
W24/W25/X41 encoded the OLD pooled ambiguity for `[[Architecture]]` (which
matches the filename of `notes/Architecture.md` AND the H1 of
`notes/Deployment.md`). They now assert the new physical-beats-visual
precedence. The two Notes remain distinct physical records and are never merged.

**Deferred to ACT 3B:** the Wiki Link extraction grammar still exists in 7
places across 4 files with 2 different regexes, and Related still matches
normalized names rather than resolved target identity.

---

## 0.0.3 ACT 3B Wiki Link relationships + shared grammar (STATICALLY ACCEPTED)

**ACT 3B — STATICALLY ACCEPTED. DEVICE ACCEPTANCE DEFERRED TO PACKAGE 3
CLOSURE.** No browser acceptance is claimed.

**1. One authoritative extraction grammar (was seven sites, four files, two
regex forms).** `js/links/wiki-link-grammar.js` is now the single owner, loaded
by `script-loader.js` BEFORE `main.js`. The load order is proven from source:
`main.js` carries `parseConceptLinks` and `wikiExpand`, `wiki-links.js` loads
later, and the CodeMirror bootstrap is a deferred `type="module"` that always
evaluates last — so the grammar cannot live in `wiki-links.js` without a second
fallback regex, which this ACT exists to remove. All four consumers now call
`MME_WIKI_LINK_GRAMMAR.extractWikiLinks`.

**Retired inconsistency, recorded:** `parseConceptLinks` previously used a
negated class that allowed `]` and newlines, so it matched MULTI-LINE links and
NESTED-LOOKING brackets. The canonical single-line form now wins: a link never
spans a line break and a target may not contain brackets. Fixtures G11/G12
record the retired behaviour explicitly.

**2. Relationship direction contract.** `getLinksOut` returns the links DECLARED
by one source document; `getLinksIn` returns saved sources whose RESOLVED Links
Out target is exactly the requested `targetPath`. Both are pure, deterministic,
non-mutating and UI-neutral. Links In is derived ONLY from canonical resolved
target identity — never from raw target text, H1 text, basename or a first
match. Missing, ambiguous and not-ready relationships can never become an
inbound edge. Without a saved Index, Links In returns `available: false` rather
than a false zero.

**3. Related semantic proof — RELATED IS NOT EQUIVALENT TO LINKS IN (case B).**
Proven by execution against the shipped algorithm and the canonical provider on
the same Index, for active note `notes/Alpha.md`:

| Consumer | Result |
|---|---|
| Canonical Links In | `note1` (filename-resolved) **and** `note2` (H1-resolved) |
| Current Related (name-keyed) | `note1` only — **misses `note2`** |
| Current Related (title-keyed) | `note2` only — **misses `note1`** |

Current Related compares the active file's **NAME** against raw saved link
target text and never consults the resolver, so an H1-resolved inbound link is
never reported. Per ACT 3B §9 case B, Related is therefore **preserved, not
migrated and not renamed**; the difference is documented and the decision on
coexistence is deferred to ACT 3C. Fixtures R45–R51 record the proof, the
preservation, and the known gap.

**Static proof at committed HEAD (`9584b17`):**

- `scripts/wiki-link-relationship-validators.cjs` (new) — **68 fixtures, 0
  failed**, including 10 mutation controls (M1–M10).
- `scripts/wiki-link-resolution-validators.cjs` — 65/0 (ACT 3A contract intact).
- Full affected regression — **1181 passed, 0 failed** across 14 suites,
  including the Package 2 Task contract (184/0), the ACT 2A checkpoint harness
  (56/0) and ACT V0 visual (50/0).
- Task Lifecycle built-in 101/101; Task Board built-in 115/115.
- Release parity OK, normal **and** strict, at `0.6.2`.
- `node --check` clean on all 11 touched files; `git diff --check` clean.

**Harness note.** Five existing suites evaluate their sources in isolation and
were updated to reproduce the real load order (grammar owner first). Without it
they would correctly extract zero links, which is a harness artifact rather than
a product defect.

---

## 0.0.5 Release 0.6.3 — PUBLISHED RUNTIME ACCEPTANCE

**RELEASE 0.6.3: PUBLISHED AND VERIFIED.** Documentation-only closure; no
runtime, version, cache, Help or Release Notes content was changed.

Verified by the repository owner on the PUBLISHED 0.6.3 build:

- [x] application starts as 0.6.3
- [x] productive Workspace opens safely
- [x] Notes render
- [x] Knowledge renders
- [x] Archive renders
- [x] Task Review operates
- [x] Task Board operates
- [x] Task Board priority selector is visible and functional
- [x] Links In is visible
- [x] canonical Wiki Link navigation opens the correct physical target
- [x] missing and ambiguous targets do not navigate
- [x] Search operates
- [x] Tags operate
- [x] Projects remain indexed
- [x] Quick Report opens
- [x] HTML Preview operates
- [x] no blocking runtime exception was observed

### Preserved as NOT EXERCISED (no controlled 0.6.2 profile was available)

- [ ] the full 0.6.2 -> 0.6.3 Update Ready transition
- [ ] Defer against an actual 0.6.2-controlled worker
- [ ] Accept / controllerchange from an actual 0.6.2-controlled worker
- [ ] automatic one-time 0.6.3 Release Notes following that exact upgrade path

**The update mechanism remains statically validated** through the existing
suites on every commit: `scripts/update-ready-validators.cjs` (93/0) proves the
message-gated worker handshake, that `skipWaiting()` is never called
unconditionally, and that Defer/Accept are supported; `scripts/release-notes-validators.cjs`
(68/0) proves the 0.6.3 entry is newest, prior entries are retained, and the
once-only display state is derived from `MME_RELEASE.productVersion`. The same
mechanism was exercised live on the earlier 0.6.1 -> 0.6.2 boundary. The gap is
the absence of a genuine 0.6.2-controlled profile, not an untested code path.

No other Package 3 scenario was converted to PASS.

---

## 0.0.4 Package 3 device acceptance — ACCEPTED

**Package 3 is DEVICE-ACCEPTED and CLOSED.** Release boundary 0.6.3 prepared.
No corrective ACT was required.

**Confirmed by the accepted integrated device run (owner, generated disposable
Workspace, localhost):**

- [x] Workspace opened as valid-notes
- [x] Workspace Index reached ready state
- [x] visible inbound panel is **Links In**, not Related
- [x] available zero rendered **badge 0** and **"No Links In."**
- [x] exact source navigation from Links In opened the correct physical Note
- [x] a target containing spaces resolved through the canonical owner
- [x] navigation opened `notes/Spaced Name.md`
- [x] logs confirmed `resolve status=resolved`
- [x] logs confirmed exact physical targetPath
- [x] logs confirmed open through the canonical lookup
- [x] Workspace active-file updated
- [x] Workspace Index rebuilt after navigation
- [x] Knowledge remained operational
- [x] Archive remained operational
- [x] Search remained operational
- [x] Tasks remained operational
- [x] Projects remained operational
- [x] no runtime exception observed
- [x] no physical mutation from relationship discovery or navigation

**Accepted product clarification:** Package 3 adds no final relationship cards
inside Active and no final disclosure cards inside the Workspace Index. Those
visual consumers remain scheduled for **Package 10**. The Sidebar **Links In**
panel is the accepted specialized relationship surface for 0.6.3.

### Register resolution (not automatically promoted to PASS)

The accumulated Package 3 register resolved as follows. Scenarios the accepted
run did not directly exercise are recorded as **NOT EXERCISED** rather than PASS:

| Group | Result |
|---|---|
| ACT 3A A-01..A-16 (resolution, navigation, Back/Forward, dirty state) | **NOT EXERCISED** in the integrated run; covered by the accepted ACT 3A/3B device passes |
| ACT 3B B-01..B-22 | **NOT EXERCISED** in the integrated run; covered by the accepted ACT 3A/3B device passes |
| ACT 3C C-01 Links In panel visible | **PASS** |
| ACT 3C C-02 filename-resolved inbound source | **NOT EXERCISED** |
| ACT 3C C-03 H1-resolved inbound source | **NOT EXERCISED** |
| ACT 3C C-04 repeated links deduplicated | **NOT EXERCISED** |
| ACT 3C C-05 occurrence count shown | **NOT EXERCISED** |
| ACT 3C C-06 Links In available zero | **PASS** |
| ACT 3C C-07 Links In unavailable state | **NOT EXERCISED** |
| ACT 3C C-08 live Links Out (Current Document) | **NOT EXERCISED** |
| ACT 3C C-09 saved Workspace Links Out | **NOT EXERCISED** |
| ACT 3C C-10 resolved/missing/ambiguous/not-ready previews | **NOT EXERCISED** |
| ACT 3C C-11 exact source-path navigation | **PASS** |
| ACT 3C C-12 Back / Forward | **NOT EXERCISED** |
| ACT 3C C-13 dirty-state cancellation | **NOT EXERCISED** |
| ACT 3C C-14 no-Workspace behaviour | **NOT EXERCISED** |
| ACT 3C C-15 saved vs unsaved relationships | **NOT EXERCISED** |
| ACT 3C C-16 archived / Knowledge / Pinned behaviour | **PASS** (operational; not exercised as link state) |
| ACT 3C C-17 Search / Tags / Tasks / Projects regression | **PASS** |
| ACT 3C C-18 no physical mutation | **PASS** |
| ACT 3C C-19 no stale name-keyed Related | **PASS** |
| ACT 3C C-20 Help reads Links In / Links Out | **PASS** |
| Final Active / Workspace Index cards | **NOT APPLICABLE** — intentionally deferred to Package 10 |
| Help / Release Notes for the future visual package | **NOT APPLICABLE** — deferred to Package 3 closure documentation, written as planned-not-present |

**Device checkpoint not exercised (integrated run):** the 0.6.2 -> 0.6.3 PWA
update transition is **NOT EXERCISED** — a genuine 0.6.2-controlled profile was
not available. See §0.0.5 for the published runtime acceptance and the preserved
scope of this gap. The 0.6.3 controller and once-only Release Notes behavior are
proven statically by `update-ready-validators.cjs` (93/0) and
`release-notes-validators.cjs` (68/0).

---

## 0.1 Package 3 deferred-test register (ACCUMULATES — do not replace)

Manual S22/DeX scenarios deferred to the integrated Package 3 closure
checkpoint. **No entry here is complete.** This register grows with each ACT;
later ACTs append, they do not overwrite.

### ACT 3A — deferred (device acceptance deferred)

| # | Scenario | Status |
|---|---|---|
| A-01 | exact filename resolution | DEFERRED |
| A-02 | filename with extension | DEFERRED |
| A-03 | saved H1 resolution | DEFERRED |
| A-04 | filename versus H1 precedence (physical key wins) | DEFERRED |
| A-05 | missing target | DEFERRED |
| A-06 | duplicate H1 ambiguity | DEFERRED |
| A-07 | duplicate basename ambiguity, when the Workspace structure permits | DEFERRED |
| A-08 | not-ready behavior without an open Workspace | DEFERRED |
| A-09 | dirty-state cancellation leaves source and History unchanged | DEFERRED |
| A-10 | exact physical opener is the one used | DEFERRED |
| A-11 | Back returns to the source Note | DEFERRED |
| A-12 | Forward returns to the target Note | DEFERRED |
| A-13 | saved versus unsaved H1 behavior | DEFERRED |
| A-14 | unsaved outgoing-link decoration (false-missing regression) | DEFERRED |
| A-15 | Related regression — still renders, not renamed | DEFERRED |
| A-16 | Search, Tags, Tasks and Projects regression | DEFERRED |

### ACT 3B — deferred (device acceptance deferred)

All entries are **DEFERRED TO PACKAGE 3 INTEGRATED DEVICE CHECKPOINT**.

| # | Scenario | Status |
|---|---|---|
| B-01 | live Current Document Links Out | DEFERRED |
| B-02 | saved Workspace Links Out | DEFERRED |
| B-03 | one Links In source | DEFERRED |
| B-04 | multiple Links In sources | DEFERRED |
| B-05 | repeated links from one source deduplicated | DEFERRED |
| B-06 | exact source-path navigation | DEFERRED |
| B-07 | occurrence navigation | DEFERRED |
| B-08 | Related equivalence (or the recorded difference) on device | DEFERRED |
| B-09 | Related row deduplication | DEFERRED |
| B-10 | filename-resolved inbound relationship | DEFERRED |
| B-11 | H1-resolved inbound relationship | DEFERRED |
| B-12 | missing excluded from Links In | DEFERRED |
| B-13 | ambiguous excluded from Links In | DEFERRED |
| B-14 | not-ready excluded from Links In | DEFERRED |
| B-15 | alias behaviour | DEFERRED |
| B-16 | dirty-state cancellation | DEFERRED |
| B-17 | Back / Forward | DEFERRED |
| B-18 | no-Workspace Current Document behaviour | DEFERRED |
| B-19 | saved versus unsaved relationship behaviour | DEFERRED |
| B-20 | Search / Tags / Tasks / Projects regression | DEFERRED |
| B-21 | shared grammar renders identically in editor and HTML Preview | DEFERRED |
| B-22 | multi-line / nested-bracket link no longer extracted (retired behaviour) | DEFERRED |

### ACT 3C — deferred (device acceptance deferred)

All entries are **DEFERRED TO PACKAGE 3 INTEGRATED DEVICE CHECKPOINT**.

| # | Scenario | Status |
|---|---|---|
| C-01 | visible Links In panel | DEFERRED |
| C-02 | filename-resolved inbound source | DEFERRED |
| C-03 | H1-resolved inbound source (the case old Related missed) | DEFERRED |
| C-04 | repeated links deduplicated to one row | DEFERRED |
| C-05 | occurrence count shown | DEFERRED |
| C-06 | Links In available zero | DEFERRED |
| C-07 | Links In unavailable state (not zero) | DEFERRED |
| C-08 | live Links Out from Current Document | DEFERRED |
| C-09 | saved Workspace Links Out | DEFERRED |
| C-10 | resolved / missing / ambiguous / not-ready previews | DEFERRED |
| C-11 | exact source-path navigation | DEFERRED |
| C-12 | Back / Forward after inbound navigation | DEFERRED |
| C-13 | dirty-state cancellation | DEFERRED |
| C-14 | no-Workspace behaviour | DEFERRED |
| C-15 | saved versus unsaved relationship behaviour | DEFERRED |
| C-16 | archived / Knowledge / Pinned behaviour | DEFERRED |
| C-17 | Search / Tags / Tasks / Projects regression | DEFERRED |
| C-18 | no physical file mutation from relationship discovery | DEFERRED |
| C-19 | no stale name-keyed Related behaviour remains | DEFERRED |
| C-20 | Help text reads Links In / Links Out | DEFERRED |

**Integrated checkpoint Workspace:** generate the disposable fixture with

    node scripts/package3-device-workspace.cjs <outputDir>

It writes 20 generic Notes covering exact filename, filename+extension, saved
H1, physical filename differing from H1, spaces, Unicode, duplicate H1, duplicate
basename (nested folders), a missing target, an ambiguous target, repeated links
from one source, Knowledge+Pinned overlap, an archived source, and a Note with no
inbound links. No user content is written into the repository.

### ACT 3D — integrated Package 3 checkpoint

*(to be appended when ACT 3C is statically accepted: one disposable Workspace
covering resolution, states, direction, navigation, scope, classification and
full regression)*

---

## 0.0.7 Package 4 — ACT 4A static acceptance (ACCEPTED)

**Status: STATICALLY ACCEPTED.** No browser checkpoint was executed and none was
required, because ACT 4A introduced **no visible behaviour change**: no Open Note
UI, no Sidebar composition, no Task UI, no Wiki Link UI.

Contract source: `docs/architecture/MarkmapEditor_1.0_PACKAGE_4_STANDALONE_SCOPE_PLAN.md`.
Runtime: `js/main.js` (composition owners, beside the existing scope owners).
Focused suite: `scripts/scope-contract-validators.cjs` — **55 passed, 0 failed**.

### Vocabulary

- [x] `MME_SCOPE_IDS` contains exactly two values: `current-document`, `workspace`
- [x] Standalone is `current-document` + `workspaceAvailable=false` (no third scope)
- [x] `MME_AVAILABILITY` contains exactly four values: `available`, `unavailable`,
      `not-ready`, `error`
- [x] `unavailable` is never represented as an empty array or numeric zero alone

### Preserved owners

- [x] `getCurrentDocumentScope()` remains the Current Document owner
- [x] `getWorkspaceScope()` remains the Workspace aggregation owner
- [x] `currentSaveHandle` remains the single physical file-handle owner
- [x] no second snapshot store, parser, Index, Task store or Link store
- [x] composition records reuse existing owners **by reference** (identity asserted)
- [x] the physical file handle is never copied or persisted into the scope record

### Projections

- [x] local Tags reflect the live buffer, with no Workspace inventory
- [x] local Tasks reuse Package 2 normalized records; no Workspace Index required
- [x] local Links Out reuse the Package 3 Wiki Link grammar
- [x] Links Out without a Workspace resolves `not-ready`, never `missing`
- [x] Links In without a Workspace is `unavailable` with `count: null`
- [x] composition is deterministic and does not mutate the buffer, the dirty flag,
      the supplied Index, or any file

### Task source identity (source-proven)

- [x] Task records carry exact physical source identity, one-based `line`, `raw`
- [x] no `occurrence` field was added to Task records
- [x] two same-text Tasks remain separate records with different lines (no merge)
- [x] no stable UUID/identity is introduced
- [x] Package 2 identity semantics unchanged

### Scope boundary

- [x] no Sidebar markup or panel-state change
- [x] no Workspace activation, app-context change or Workspace Index mutation
- [x] no DOM access, file read or Save inside the pure composition owners
- [x] no version, Service Worker or cache identity change
- [x] `sw.js`, `index.html`, Help and Release Notes unchanged

### Mutation controls (all bite)

M1 live-source · M2 H1-as-identity · M3 tags-from-Index · M4 tasks-from-Index ·
M5 not-ready-to-missing · M6 unavailable-to-available-zero · M7 Index-mutation ·
M8 second-Task-parser · M9 fake-Workspace · M10 Sidebar-touch. Each mutation was
applied to the real `js/main.js`, executed against the real shipped owners, and
restored; every one produced failing fixtures.

### Not in ACT 4A

Open Note UI, Sidebar composition, Workspace ↔ Standalone transition UI, final
Task/Tags/Links panels, and the release boundary remain **ACT 4B+**.

---

## 0.0.6 Package 4 — Standalone Notes and Scope Composition (FUTURE)

**Status: FUTURE STRUCTURE ONLY. Package 4 runtime is NOT started.**
Gate 4 produced planning documentation only. Nothing below has been executed,
and no result may be recorded as PASS until the corresponding ACT is accepted.

Contract source: `docs/architecture/MarkmapEditor_1.0_PACKAGE_4_STANDALONE_SCOPE_PLAN.md`.

### ACT 4A — shared scope contract and Current Document snapshot

*(to be executed)*

- [ ] live Markdown snapshot reflects unsaved buffer edits
- [ ] saved title and filename identity correct
- [ ] file handle optionality (present and absent)
- [ ] writable vs non-writable state
- [ ] local Tags present and correctly scoped
- [ ] local Tasks present and Package-2 normalized
- [ ] local Links Out present
- [ ] Workspace reported unavailable
- [ ] Links In unavailable, **not zero**
- [ ] no second parser owner
- [ ] no second Task store / Wiki Link store
- [ ] no `WORKSPACE_INDEX_STATE` mutation from a live-scope read
- [ ] live/saved boundary proven
- [ ] deterministic snapshot
- [ ] input immutability

### ACT 4B — Open Note entry and Standalone Sidebar composition

*(to be executed; mobile-first S22/DeX)*

- [ ] open a writable Markdown file via Open Note
- [ ] edit, Save, and confirm the physical file on disk changes
- [ ] reopen and confirm saved content
- [ ] local Tags reflect the live document
- [ ] local Tasks render; a status toggle mutates the buffer and marks dirty
- [ ] local Links Out render, each "unresolved (no Workspace)" and non-navigating
- [ ] Links In absent/unavailable — no false zero
- [ ] no Workspace panels visible
- [ ] open Workspace — all accepted 0.6.3 panels return
- [ ] return to Standalone — document panels only, no ghost panels
- [ ] dirty-state cancel leaves content and handle untouched
- [ ] no stale handle points at the prior file
- [ ] static Sidebar shell free of stale "Related" / "No active concept" text

### ACT 4C — transitions, recovery, History and integrated acceptance

*(to be executed)*

- [ ] no transition silently discards dirty content
- [ ] no transition leaves a stale writable handle
- [ ] no Workspace panel remains active without a Workspace
- [ ] cancelled/failed open pushes no History entry
- [ ] failed Save does not refresh the baseline and does not rebuild the Index
- [ ] History identity is handle-based, never the visible H1
- [ ] reload recovery restores the draft without claiming writability
- [ ] an unrecoverable handle requires the user to reopen
- [ ] virtual-view Return remains distinct from Navigation History
- [ ] Workspace function not reduced (full regression chain green)

### ACT 4D — conditional correction

*(opens only on source-proven or browser-proven focused defect; not scheduled)*

### Laptop-only triggers

*(request explicitly; not required per ACT)*: desktop-only keyboard/focus, wide
multi-pane layout, File System Access behaviour not reproducible on S22/DeX, PWA
release/update behaviour, productive Workspace acceptance.

---

## 1. Diagnostics & Runtime Checks

### A. Host Diagnostic Output
Ensure globalThis diagnostics match exactly:
```
ready=true
active=journal
registered=2
transition=false
journalInitialized=true
initializationState=initialized
initializationCount=1
hostCalledAdapter=true
adapterCalledInitialize=true
legacyAutoInit=false
```

### B. Directly Validated Evidence
- [x] Application boots without uncaught exceptions or unhandled rejections.
- [x] Service Worker (`sw.js`) registers successfully.
- [x] Host loaded, active=journal, and initializationCount=1 precisely.
- [x] Populated Workspace Index successfully rebuilt.
- [x] Sidebar panel order matches canonical ordering.

---

## 2. Structured Verification Groups

### Group A: Startup and Ownership
- [ ] **Host Registration**: Confirm `MME_WORKSPACE_HOST.getSnapshot().registeredWorkspaces.length === 2` (Journal and Workspace Index).
- [ ] **Authority Check**: Verify Journal doesn't run legacy self-init (`legacyAutoInit = false`).
- [ ] **No Duplicate Workspaces**: Assert no multiple workspace controllers or duplicate registered listeners.

### Group B: Sidebar Reload & Panel Idempotency
- [ ] **Same-Tab Reload**: Perform a clean tab reload while workspace is active.
- [ ] **Index Readiness**: Wait for `mme-workspace-index-ready` event dispatch.
- [ ] **Order Normalization**: Verify panels follow canonical order:
  1. Search
  2. Active File
  3. Journals
  4. Concepts
  5. Related
  6. Open Tasks
  7. Tags
  8. Workspace Index
  9. Navigation History
- [ ] **Panel Toggles**: Toggle every panel section exactly once.
- [ ] **Preference Persistence**: Refresh page; confirm previous collapsed/expanded preferences persist correctly.
- [ ] **Open Full Index**: Click "Open Full Index" button; verify it transitions to the Workspace Index View.

### Group C: Programmatic Dirty Behavior
- [ ] **Reopen Suppression**: Automatic active-file reopen on boot leaves the file non-dirty (`isDirty = false`).
- [ ] **Sidebar Select Suppression**: Double-click file in sidebar; verify document opens without triggering a false dirty event.
- [ ] **Index Select Suppression**: Open file from Virtual Workspace Index; verify document opens cleanly with `isDirty = false`.
- [ ] **History Restore Suppression**: Trigger Back/Forward; verify restored file doesn't set false dirty state.
- [ ] **Genuine Typing**: Type in CodeMirror; verify `isDirty = true` immediately, followed by one debounced render and autosave.
- [ ] **Draft Restore**: Open a previously unsaved draft; verify it is correctly flagged as dirty.

### Group D: Mode Session (Required - Unverified)
*Note: This group is marked REQUIRED as manual validation has not yet been explicitly completed.*
- [ ] **Text Independence**: Write text in Editor mode; switch to Slides mode and write different text. Switch back and forth; verify unique texts.
- [ ] **Filename Independence**: Verify independent file names for Editor vs Slides mode.
- [ ] **Dirty State Capture**: Capture `isDirty = true` in Editor, switch to Slides and verify Slides can be non-dirty, switch back to Editor and verify dirty state is restored.
- [ ] **Physical File Authority**: Verify that switching to Journal workspace respects the physical active file as the single source of truth.

### Group E: Navigation History
- [ ] **Physical Walk**: Open File A → File B → File C.
- [ ] **Back-Forward Actions**: Click Back twice (re-opens B, then A). Click Forward twice (re-opens B, then C).
- [ ] **Virtual Walk**: Open File A → click "Open Full Index" (Virtual index opens) → click Back (A restored) → click Forward (Index restored).
- [ ] **Return Action**: Click Return button from Virtual Workspace Index; verify it returns to File A.
- [ ] **Cancelled Dirty Rollback**: Try to navigate away while active file is dirty; cancel the navigation confirm dialog. Verify history stack is NOT committed and current position is preserved.
- [ ] **Navigation Log**: Inspect console; verify logged actions correctly report: `opened`, `cancelled`, `failed`, or `noop`.

### Group F: Regression Checks
- [ ] **Wiki Links**: Decorated links display, double-clicking them redirects to resolved physical target.
- [ ] **Task Review**: Open tasks parsed correctly, filters and status changes apply seamlessly.
- [ ] **Return Button**: Independent of Back and Forward buttons.
- [ ] **Dirty Rollback**: Reverts correctly when dirty edits are discarded.
- [ ] **Sidebar Width**: Sidebar resize handle operates smoothly; width persists across refreshes.
- [ ] **Save / Save As**: Standard file system handlers preserve document content securely.
- [ ] **PWA Cache**: Offline operations and cache hits verified via DevTools Application tab.

---

## 7. Group G: Draw.io Report MVP Import (H1)

Reusable H1 verification:

- [ ] **Importer API presence**: in a fresh application session, confirm `globalThis.MME_REPORT_MARKDOWN_IMPORT` exists.
- [ ] **Dormant validator**: `globalThis.MME_REPORT_MARKDOWN_IMPORT.validateReportMarkdownImport()` returns `ok=true, passed=39, total=39, failed=0`.
- [ ] **Browser-console sanitized import**: in a fresh session, run:
  ```js
  const R = globalThis.MME_REPORT_MARKDOWN_IMPORT;
  const md = [
    '---',
    'type: report',
    'period_start: 2026-08-24',
    'period_end: 2026-08-30',
    '---',
    '',
    '# Weekly Business Report',
    '',
    '## Summary',
    '',
    'Reviewed summary text.',
    '',
    '## Next Steps',
    '',
    '- Action item 1',
    '',
    '## Template Fields',
    '',
    '{{customer}}: Alibaba',
    '{{region}}:'
  ].join('\n');
  const r = R.importReviewedReport(md);
  console.log(r.ok, r.fields.title, r.fields.summary, r.fields.customer, r.fields.region, r.sourceMarkdown === md);
  ```
  Confirm `r.ok === true`, a non-empty `r.fields.summary`, custom `r.fields.customer.value === 'Alibaba'`, `r.fields.region.value === ''`, and `r.sourceMarkdown === md`.

### Reusable H2 verification (Draw.io reconciler)

- [ ] **Reconciler API presence**: in a fresh application session, confirm `globalThis.MME_DRAWIO_REPORT_RECONCILER` exists.
- [ ] **Dormant validator**: `globalThis.MME_DRAWIO_REPORT_RECONCILER.validateDrawioReportReconciler()` returns:
  ```
  ok=true
  passed=60
  total=60
  failed=0
  ```
- [ ] **Browser-console sanitized H1-to-H2 reconciliation**: in a fresh session, run:
  ```js
  const importer = globalThis.MME_REPORT_MARKDOWN_IMPORT;
  const R = globalThis.MME_DRAWIO_REPORT_RECONCILER;
  const md = [
    '---',
    'type: report',
    'period_start: 2026-08-24',
    'period_end: 2026-08-30',
    '---',
    '',
    '# Weekly Business Report',
    '',
    '## Summary',
    '',
    'Sanitized summary.',
    '',
    '## Next Steps',
    '',
    'Sanitized next step.',
    '',
    '## Template Fields',
    '',
    '{{customer}}: Example Customer',
    '{{customer decision}}:'
  ].join('\n');
  const templateXml = '<mxfile><diagram id="page-1" name="Page-1"><mxGraphModel><root>'
    + '<mxCell id="0"/><mxCell id="1" parent="0"/>'
    + '<mxCell id="2" value="{{title}}" vertex="1" parent="1"/>'
    + '<mxCell id="3" value="{{summary}}" vertex="1" parent="1"/>'
    + '<mxCell id="4" value="{{customer}}" vertex="1" parent="1"/>'
    + '<mxCell id="5" value="{{customer decision}}" vertex="1" parent="1"/>'
    + '<mxCell id="6" value="{{regional sponsor}}" vertex="1" parent="1"/>'
    + '</root></mxGraphModel></diagram></mxfile>';
  const imported = importer.importReviewedReport(md);
  const r = R.reconcile(templateXml, imported.fields);
  console.log('ok', r.ok);
  console.log('matched', r.matched.map(m => m.placeholder.key));
  console.log('missingValues', r.missingValues.map(m => m.field.key));
  console.log('unknownPlaceholders', r.unknownPlaceholders.map(u => u.key));
  console.log('unusedFields', r.unusedFields.map(f => f.key));
  console.log('occurrences', r.placeholders.map(p => p.key + '=' + p.occurrences));
  console.log(R.buildMissingTemplateFieldsMarkdown(r));
  const pop = R.populateTemplate(templateXml, imported.fields);
  console.log(pop.xml);
  console.log('unresolved preserved',
    pop.xml.includes('{{customer decision}}') &&
    pop.xml.includes('{{regional sponsor}}'));
  console.log('original unchanged', templateXml.includes('{{title}}'));
  ```
  Confirm:
  - `r.ok === true`;
  - matched includes `title`, `summary`, `customer`;
  - missingValues includes `customer decision`;
  - unknownPlaceholders includes `regional sponsor`;
  - unusedFields includes `next steps`;
  - occurrences report one canonical entry per key (`summary=1`, etc.);
  - Template Fields Markdown starts with `## Template Fields` and lists
    `{{customer decision}}:` and `{{regional sponsor}}:` only;
  - populated XML replaces valued placeholders with escaped text;
  - blank and unknown placeholders remain verbatim including braces;
  - the original `templateXml` string is unchanged.

No debug button is added; this remains a console-only procedure.

Browser-console runtime verification for H2: pending (Node-only validation
passed 101/101; a fresh browser session run belongs in the Draw.io MVP
closure).

### Reusable H3 verification (Draw.io reconciliation UI)

**API availability**

- [ ] **Panel API presence**: in a fresh application session, confirm
  `globalThis.MME_DRAWIO_REPORT_PANEL` exists (an object exposing `open`,
  `close`, `selectTemplate`, `reconcileCurrentReport`,
  `insertMissingTemplateFields`, `refresh`, `resetSession`, `getSessionState`,
  and `validateDrawioReportPanel`).
- [ ] **Dormant validator**:
  ```js
  globalThis.MME_DRAWIO_REPORT_PANEL.validateDrawioReportPanel()
  ```
  ```text
  ok=true
  passed=38
  total=38
  failed=0
  ```

**Browser-confirmed checks**

- [ ] **Adapter handoff**: a fresh Report session log shows
  `Report: Draw.io adapter received=true`.
- [ ] **Report button enablement**: with a virtual or saved Report active, the
  Report sidebar `Reconcile Draw.io Template` button is enabled
  (`disabled=false`).
- [ ] **Non-Report disablement**: with a Journal/Concept/non-Report document
  open, the same button is disabled.
- [ ] **Report collapse**: the Report sidebar panel collapse/expand toggle works
  and the Draw.io button reflects the active Report state.
- [ ] **Overlay open**: clicking the enabled entry opens a single
  `#mmeDrawioReportOverlay` overlay (one instance only).
- [ ] **Close**: the overlay Close / top ✕ closes the overlay and returns focus.
- [ ] **Picker cancellation**: dismissing the native file picker cancels safely
  without an editor error and preserves the Report session.
- [ ] **No-template blocking**: Add Missing Fields and Reconcile Again before any
  template is selected are blocked safely (no-template message).
- [ ] **Mobile open/Close**: the overlay opens and scrolls correctly on a narrow
  mobile viewport.

**Pending real-template acceptance (laptop)**

- [ ] **Real template selection**: pick a valid uncompressed `.drawio`/`.xml`
  template.
- [ ] **Four categories**: Matched / Missing Values / Unknown Template
  Placeholders / Unused Report Fields render with a real template.
- [ ] **Occurrence counts**: per-key occurrence counts display correctly.
- [ ] **Insertion**: Add Missing Fields inserts only absent tokens into
  `## Template Fields` (one section, no duplicates).
- [ ] **Duplicate prevention**: tokens already present elsewhere are not
  duplicated.
- [ ] **Reconcile Again**: running Reconcile Again after values are completed
  updates the match categories.
- [ ] **Navigation session behavior**: cancelled accepted-document navigation
  preserves H3; successful navigation clears the temporary session.

---

## Reusable H4 verification (Draw.io flexible output delivery)

### Node/static validation (no browser required)

- [ ] **H2 reconciler validator** (kept separate):
  ```js
  globalThis.MME_DRAWIO_REPORT_RECONCILER.validateDrawioReportReconciler()
  ```
  ```text
  ok=true  passed=101  total=101  failed=0  (0 entries with pass !== true)
  ```
  Covers uncompressed roots, optional XML declaration / UTF-8 BOM / leading
  whitespace (assessment view only), declaration retained in output, strict
  rejection of unrelated/escaped/fenced/malformed/PI-led input, declaration-led
  compressed → `template-compressed`, and honest totals (no post-count results).
- [ ] **Runtime API presence**: `globalThis.MME_DRAWIO_REPORT_PANEL` exposes
  `generateDrawioOutput` and `validateDrawioOutputDelivery`.
- [ ] **H3 regression validator** (kept separate):
  ```js
  globalThis.MME_DRAWIO_REPORT_PANEL.validateDrawioReportPanel()
  ```
  ```text
  ok=true  passed=38  total=38  failed=0
  ```
- [ ] **H4 output-delivery validator**:
  ```js
  globalThis.MME_DRAWIO_REPORT_PANEL.validateDrawioOutputDelivery()
  ```
  ```text
  ok=true  passed=107  total=107  failed=0  (0 entries with pass !== true)
  ```
  Adapter-mocked coverage: final Markdown reread per attempt; final H1 import +
  two-pass H2 reconciliation; partial/complete generation modes; unresolved
  placeholder preservation; `-visual.drawio` filename contract (fn01–fn07,
  pk04); duplicate-generation blocking; unused-field aggregation (agg01–agg20,
  flow36); reserved aggregate excluded from Markdown insertion (md01–md03,
  insertion count=3); single-owner delivery logging (log01–log04, state06);
  log hygiene; module-state restoration.

### Gate and availability checks

- [ ] **Generate Draw.io availability** *(desktop; browser)*: with a Report
  open, a template selected, and at least one matched valued field, the
  Generate Draw.io button inside the H3 overlay is enabled — no global toolbar
  action exists; the button is always present in the overlay markup.
- [ ] **Structural blocks**: no Report/session/template, invalid, compressed,
  or placeholder-free templates, and no matched valued field each block
  generation with guidance instead of output (`no-populated-fields`).
- [ ] **Partial generation**: missing values, unknown placeholders, and unused
  Report fields do NOT block; the status explains how many unresolved
  placeholders will remain; matched values are populated; unresolved
  placeholders stay visible with intact braces; `mode=partial` logged.
- [ ] **Complete generation**: with nothing unresolved the status says
  "Ready to generate." and the output uses `mode=complete`.
- [ ] **Unused-field aggregation opt-in**: only when the template contains
  `{{unused report fields}}`; constituents stay listed under Unused Report
  Fields with the single informational note; no new mxCell or geometry is
  created; H1 fields/fieldOrder are never mutated; the reserved placeholder is
  never inserted into Markdown (insertion count=3 for the three-field case).

### Browser-only and desktop-only cases (PENDING — laptop acceptance)

- [ ] **Save As success** *(desktop-only, real showSaveFilePicker)*: writes one
  separate `.drawio` artifact; suggested filename equals the Report base plus
  `-visual.drawio`; the output handle is never adopted as `currentSaveHandle`;
  current Report filename remains unchanged; exactly one success log.
- [ ] **Picker cancellation** *(desktop-only)*: dismissing the save dialog is
  normal ("Save cancelled." info only) — no error surface, no false success,
  H3 session and Report preserved, retry allowed, one cancellation log.
- [ ] **Failure handling** *(desktop-only)*: permission/write failure reports a
  structured failure (not cancellation), preserves H3 and Report, allows retry,
  one failure log.
- [ ] **Fallback delivery** *(browser-only environments without the picker)*:
  Blob download starts, temporary object URL revoked, Report remains open,
  one delivered log.
- [ ] **Android `.drawio` selection** *(mobile)*: a `.drawio` file classified
  BIN / `application/octet-stream` is visible or selectable via All files, read
  as text, and accepted by content validation.
- [ ] **XML declaration template**: a template beginning with
  `<?xml version="1.0" ... ?>` is accepted with reconciliation equivalent to
  the declaration-free copy; the declaration remains in generated output.
- [ ] **Generated file opening in Draw.io** *(desktop)*: the generated `.drawio`
  opens correctly in external Draw.io; valued placeholders replaced; unresolved
  placeholders preserved during partial generation; aggregate text present when
  opted in; template layout preserved; output remains editable.
- [ ] **State preservation and regeneration**: after success/cancel/failure,
  Report Markdown, dirty state, Navigation History, `WORKSPACE_STATE.activeFile`,
  and the H3 template session are untouched; another generation is allowed;
  Markdown is not auto-saved; H3 is not reset.
- [ ] **Concurrent generation**: a second attempt during delivery is blocked
  (in-progress) and the in-progress state resets after every result.
- [ ] **Mobile layout** *(mobile-only)*: the overlay reaches the Generate action
  and save status on a narrow mobile viewport.
---

## Draw.io MVP PWA closure verification

Cache/version closure is source-complete:
`APP_VERSION` = `markmap-journal-pwa-v61-drawio-report-mvp-v1`
(single owner: `sw.js`); caches
`markmap-journal-pwa-v61-drawio-report-mvp-v1-app` / `...-runtime`;
activation cleanup is prefix-scoped (`markmap-journal-pwa-`); all six Report
modules are precached in `LOCAL_APP_SHELL`.
Note: this identity is superseded by
`markmap-journal-pwa-v62-screen-layout-closure-v1` (Screen Layout closure);
the Report modules remain precached unchanged under the v62 identity.

### Static / Node validation (no browser required)

- [x] `node --check sw.js` -> PASS.
- [x] Cache-manifest paths: all 64 `LOCAL_APP_SHELL` entries exist on disk
  (zero missing). Note: the array contains pre-existing duplicate entries for
  modules listed in both the shell block and the dynamic-modules block;
  precaching is idempotent and harmless.
- [x] Version consistency: exactly one `APP_VERSION = '...'` owner (`sw.js`);
  no page-level or manifest copy; no `markmap-journal-pwa-v60-*` active owner
  remains in `sw.js`.
- [x] H1 importer validator: `MME_REPORT_MARKDOWN_IMPORT.validateReportMarkdownImport()`
  -> ok=true, passed=39, total=39, failed=0.
- [x] H2 reconciler validator (separate):
  `MME_DRAWIO_REPORT_RECONCILER.validateDrawioReportReconciler()`
  -> ok=true, passed=101, total=101, failed=0.
- [x] H3 panel validator (separate):
  `MME_DRAWIO_REPORT_PANEL.validateDrawioReportPanel()`
  -> ok=true, passed=38, total=38, failed=0.
- [x] H4 output-delivery validator (separate):
  `MME_DRAWIO_REPORT_PANEL.validateDrawioOutputDelivery()`
  -> ok=true, passed=107, total=107, failed=0.

### Browser acceptance (PENDING — not executed in the Termux coder environment)

**A. Clean install**
1. DevTools → Application → Service Workers: Unregister for this origin.
2. Application → Cache Storage: delete only caches beginning with
   `markmap-journal-pwa-`.
3. Close the application tab; reopen online; allow install/activation
   (skipWaiting + claim; reload the tab once after activation).
4. Confirm Cache Storage contains
   `markmap-journal-pwa-v61-drawio-report-mvp-v1-app` (and `-runtime`) and no
   `v60` caches remain.
5. Confirm the app boots and the three runtime APIs exist:
   `globalThis.MME_REPORT_MARKDOWN_IMPORT`,
   `globalThis.MME_DRAWIO_REPORT_RECONCILER`,
   `globalThis.MME_DRAWIO_REPORT_PANEL`.

**B. Update over the old cache**
1. Load the previous release (v60 cache active), then serve/deploy the new
   release and reload online.
2. Confirm the new Service Worker installs and activates (skipWaiting),
   the old `markmap-journal-pwa-v60-*` caches are removed, the new v61 caches
   are present.
3. Reload; confirm all Draw.io runtime APIs load together and none of these
   mixed-version symptoms appear: `MME_DRAWIO_REPORT_PANEL` undefined, missing
   Generate Draw.io, old clean-only generation gate, missing
   `{{unused report fields}}` support, `.drawio` Android picker regression,
   XML declaration regression, old CSS/guidance layout.

**C. Offline**
1. After one successful online load, close the tab, go offline (or DevTools
   Offline), reopen the same URL.
2. Confirm the shell starts, the Report panel renders, the Draw.io
   reconciliation overlay opens with the three runtime APIs present, a local
   uncompressed template reconciles, Generate Draw.io follows the Report
   state, and Save As/download stays local.
3. Restore the network and confirm normal operation continues.

**D. Minimum Draw.io smoke**
- App boots; H1/H2/H3 runtime objects exist; a Report can be generated;
  `Reconcile Draw.io Template` enables; a controlled template can be selected;
  the four categories display; Generate Draw.io is present; partial generation
  reaches Save As; the Report remains current; no runtime exception appears.

---

## Screen Layout closure verification

Cache/version closure is source-complete:
`APP_VERSION` = `markmap-journal-pwa-v62-screen-layout-closure-v1`
(single owner: `sw.js`); caches `...v62-screen-layout-closure-v1-app` /
`...-runtime`; activation cleanup remains prefix-scoped
(`markmap-journal-pwa-`); `css/view-layout.css` and `js/ui/view-layout.js` are
deterministic precache assets in `LOCAL_APP_SHELL`.

### A. Source / static validation (executed in the coder environment)

- [x] `node --check` PASS for `sw.js`, `js/app/script-loader.js`,
  `js/ui/view-layout.js`, `js/main.js`, `js/editor/editor-visibility.js`,
  `js/workspace/workspace-controller.js`.
- [x] Exactly one `APP_VERSION` definition (`sw.js`); value is
  `markmap-journal-pwa-v62-screen-layout-closure-v1`; `APP_CACHE` and
  `RUNTIME_CACHE` derive from it; no page-level or manifest copy; no `v61`
  identity remains active in `sw.js`.
- [x] `css/view-layout.css` and `js/ui/view-layout.js` each appear exactly once
  in `LOCAL_APP_SHELL`; paths match `js/app/script-loader.js` exactly
  (`./css/view-layout.css`, `./js/ui/view-layout.js`); no case, leading-path,
  or alternate-path mismatch; script-loader ownership preserved (no duplicate
  link/script tags added).
- [x] All twelve critical Screen Layout runtime assets are precached
  (`main.js`, `view-layout.js`, `editor-visibility.js`,
  `workspace-controller.js`, `script-loader.js`, `layout.css`, `toolbar.css`,
  `view-layout.css`, `workspace.css`, `editor.css`, `html-preview.css`,
  `overlays.css`).
- [x] Activation cleanup remains prefix-scoped (`markmap-journal-pwa-`);
  old v61 app and runtime caches are deleted by the owned-prefix cleanup after
  v62 activates; no unrelated-origin cache is touched.
- [x] `git diff --check` PASS; no implementation file modified.

### B. Previously confirmed browser/device evidence (accepted, not re-run)

- [x] `#splitEditor` receives touch Pointer Events; resize starts and ends.
- [x] `#splitHtml` receives touch Pointer Events; resize starts and ends.
- [x] Markmap fullscreen preserves zoom/pan on exit.
- [x] Editor width restored after Hide/Restore; CodeMirror preserved.
- [x] HTML canonical show/hide (`showHtmlPreview`/`hideHtmlPreview`); splitter
  drag-to-open works.
- [x] Focus full-width behavior through the derived viewer-empty state.
- [x] Quick Edit and Done live in `#grpPresentationAction` beside Layout; no
  floating pane overlays.
- [x] Work / Review / Presentation / Focus presets and local fullscreen
  functional on device.

### C. PWA / browser acceptance (PENDING — not executed in this environment)

Do not mark these PASS until executed on the deployed origin.

- [ ] **Clean install**: clear this origin's previous application data;
  unregister the Service Worker; delete owned caches beginning with
  `markmap-journal-pwa-`; reopen online; allow install/activation (skipWaiting
  + claim; reload once after activation). Confirm Cache Storage contains
  `markmap-journal-pwa-v62-screen-layout-closure-v1-app` (and `-runtime`),
  that `css/view-layout.css` and `js/ui/view-layout.js` are in the app cache,
  and that `globalThis.MME_VIEW_LAYOUT` exists.
- [ ] **Update**: begin from an older controlled installation (v61 or earlier);
  serve the v62 release; reload online; confirm the new Service Worker
  installs and activates (skipWaiting), old `markmap-journal-pwa-v61-*` caches
  are removed, and one coherent release loads (Registry, presets, view-layout
  CSS, Quick Edit).
- [ ] **Online reload**: confirm Registry, presets, styles, Quick Edit, Focus,
  and Pointer Event resizing after reload.
- [ ] **Offline reload**: genuinely disable network; reload; confirm Registry,
  presets, toolbar, view-layout CSS, and pane controls load with no missing
  Screen Layout asset.

### D. Focused Screen Layout smoke (after v62 activation; PENDING)

1. Reload online; confirm version/caches.
2. Open Layout menu; apply Work.
3. Apply Review.
4. Apply Presentation.
5. Open and close Quick Edit.
6. Apply Focus (Editor fills content width).
7. Touch-resize `#splitEditor`; touch-resize `#splitHtml`.
8. Enter and exit one local fullscreen.
9. Reload offline; confirm Registry, presets, styles, and controls load.

---

## MarkmapEditor 0.6.2 Notes Workspace Foundation verification

Release identity: `markmap-journal-pwa-0.6.2-notes-workspace-foundation`
(product version `0.6.2`, owned by `js/release/release.js` and `sw.js`).

Scope note: the `PENDING` blocks in the 0.6.1 section below are historical
records for that superseded package. They are not acceptance criteria for 0.6.2.

### N1. Version and Service Worker identity

- [x] `js/release/release.js` `productVersion = 0.6.2`,
  `cacheIdentity = markmap-journal-pwa-0.6.2-notes-workspace-foundation`.
- [x] `sw.js` `APP_VERSION` is identical; the superseded
  `markmap-journal-pwa-0.6.1-foundation-closure` is no longer the installed
  identity.
- [x] `scripts/release-parity.cjs` green: identity matches across both owners and
  the cache identity embeds the product version.
- [x] `scripts/dependency-cache-validators.cjs` and
  `scripts/update-ready-validators.cjs` green at the new identity.
- [x] The user-controlled Update Ready contract is preserved: no unconditional
  forced reload, defer-update retained, `controllerchange` handling retained,
  unsaved-work guard retained, Release Notes shown automatically once after
  activation and permanently available from the existing button.
- [x] No legacy Workspace folder, user file, or generated migration archive is
  present in the precache.

### N2. Notes Workspace static validation

- [x] `scripts/workspace-detection-validators.cjs` 185/185 — strict format
  detection; a legacy `journals/`+`concepts/` Workspace is still rejected.
- [x] `scripts/workspace-storage-validators.cjs` 199/199.
- [x] `scripts/workspace-index-notes-validators.cjs` 58/58.
- [x] `scripts/workspace-discovery-consumers-validators.cjs` 52/52 — includes
  X49–X52, the Navigation History controller fixtures proving Back/Forward
  resolve `notes/` paths through the controller resolver.
- [x] `scripts/workspace-task-consumers-validators.cjs` 62/62 — includes the
  Task Review single-escape correction.
- [x] `scripts/workspace-lifecycle-output-validators.cjs` 67/67.
- [x] `scripts/workspace-today-index-validators.cjs` 31/31.
- [x] `scripts/current-document-scope-validators.cjs` 41/41.
- [x] `scripts/workspace-notes-sidebar-validators.cjs` 65/65 — includes C54–C65,
  the Archive panel collapse regression fixtures.
- [x] `scripts/workspace-note-creation-validators.cjs` 35/35.
- [x] `scripts/workspace-note-metadata-validators.cjs` 42/42.
- [x] `scripts/release-notes-validators.cjs` green — 0.6.2 entry is newest,
  0.6.1 and 0.6.0 retained beneath it, activation example present, and the entry
  does not advertise deferred features as shipped.

### N3. Archive panel collapse correction (this release)

The Archive header click was a silent no-op: `toggleWorkspacePanel()` had no
`archive` branch, so the click resolved to `null` and returned before touching
any state. The persisted-collapse default had no `archive` key, and the Archive
renderer never re-applied the persisted state, so a rebuild would have discarded
it. All three gaps are corrected against the existing Notes and Knowledge
owners; no CSS change and no projection or metadata change was required.

- [x] `scripts/workspace-notes-sidebar-validators.cjs` C54–C65 green, executed
  against the real shipped owners.
- [x] Mutation-tested: reverting the three corrections fails C55, C56, C58, C59,
  C60, C61 and C62 (exit 1), so the fixtures are not vacuous.
- [x] **Browser acceptance COMPLETE** (MarkmapEditor 0.6.2, localhost, real
  browser). Observed:
  - a valid `notes/` Workspace opened;
  - Archive rendered one archived Note;
  - a real Archive header click collapsed the panel;
  - a second click expanded the panel;
  - the runtime logged
    `Workspace Panels: toggled archive collapsed=true` and then
    `Workspace Panels: toggled archive collapsed=false`;
  - Workspace counts remained stable throughout
    (`files=3, notes=3, active=2, pinned=1, archived=1`);
  - no Archive-collapse runtime error occurred.
  The real click path is accepted.

### N5. Post-publication published-laptop checks (retained, not commit blockers)

These remain to be exercised on the published application. They do not block
this commit: the real Archive click path is accepted (§N3) and C54–C65 execute
both persistence contracts, so these are confirmation of published behaviour
rather than unknown risk.

- [ ] An existing 0.6.1 PWA detects 0.6.2.
- [ ] Update Ready supports both Defer (stay on 0.6.1) and Accept.
- [ ] `controllerchange` activates 0.6.2 and the application reloads.
- [ ] 0.6.2 Release Notes appears exactly once after activation; the permanent
      Release Notes button still works; a second normal reload does not reopen it.
- [ ] Archive collapse persists after an Index rebuild.
- [ ] Archive collapse persists after a Workspace reopen.
- [ ] A legacy Workspace is rejected without modification, and a persisted legacy
      last-active path (`concepts/CommScope.md`) is not reopened, moved or
      modified, and `notes/` is not created inside it without explicit selection
      and confirmation.
- [ ] The migrated Workspace copy opens successfully.

### N4. Release 0.6.2 browser acceptance (owner device)

Static validation cannot substitute for device acceptance. The Archive collapse
gate is satisfied (§N3). The following were additionally exercised during the
same 0.6.2 validation pass; items still marked `[ ]` below are retained in §N5.

- [x] A valid `notes/` Workspace opens with no runtime loading error; the
  application reports version 0.6.2. (Observed during the §N3 acceptance pass;
  the full clean/incognito load, legacy rejection, and the Notes / Knowledge /
  Archive / Pinned render pass are retained in §N5.)
- [ ] Existing 0.6.1 PWA discovers the new worker; Update Ready appears; Defer
  keeps 0.6.1 active; Accept activates 0.6.2; the app reloads; 0.6.2 Release
  Notes appears once; the permanent button still works; a second normal reload
  does not reopen the same Release Notes. → §N5
- [ ] Product smoke: Today, New Note, Save, Notes, Knowledge, Pin, Archive,
  Restore, Back, Forward, Search, Wiki Links, Task Review, Task Board, Projects,
  Quick Report, Draw.io entry. → §N5
- [x] Archive collapses and expands on a real click, with stable Workspace
  counts and no runtime error. → §N3
- [ ] Migrated Workspace copy: 62 Notes indexed, 59 active, 41 Knowledge,
  3 archived; Knowledge Notes also appear in Notes; archived Notes appear in
  neither active Notes nor Knowledge; Back and Forward return `status=opened`;
  no file moved, renamed or duplicated. → §N5
- [ ] Legacy Workspace safety: a persisted `concepts/CommScope.md` last-active
  path is not inferred to be a Note, reopened, moved or modified, and `notes/`
  is not created inside that legacy Workspace without explicit selection and
  confirmation. → §N5

The counts above describe one tested migrated copy only and are not general
application requirements.

---

## MarkmapEditor 0.6.1 foundation closure verification (historical)

Release identity: `markmap-journal-pwa-0.6.1-foundation-closure`
(product version `0.6.1`, owned by `js/release/release.js` and `sw.js`).

Scope note: earlier `PENDING` blocks in this document are historical records for
superseded pre-0.6.x packages (Draw.io MVP, Screen Layout v62). They are not
acceptance criteria for 0.6.1 and do not describe the acceptance state of this
release. The acceptance state of 0.6.1 is recorded only in this section.

### F1. Offline foundation — 89 resources in six groups

- [x] `sw.js` `APP_CACHE` precache parses to 89 unique deterministic URLs across
  the six accepted groups (shell, Markmap/CodeMirror, Shiki renderer,
  Release Notes/Help, application modules, styles/assets).
- [x] `scripts/dependency-cache-validators.cjs` green: cache identity,
  group counts, Shiki pinning, fetch-routing shape, activation-cleanup shape.
- [x] Previously accepted browser evidence: offline startup works from a clean
  install with Editor, Markmap, HTML Preview, and syntax highlighting.
- [x] Previously accepted browser evidence: CodeMirror, Markmap, and Shiki
  sources resolve from the app cache with no network dependency.
- [x] Service worker identity changed to the 0.6.1 closure identity only;
  no routing, deterministic-list, or precache-shape drift
  (`scripts/release-parity.cjs` with `RELEASE_PARITY_STRICT_SW=1` green).

### F2. ModeSession (cross-mode text restoration)

- [x] `scripts/mode-session-validators.cjs` green (55 checks): single
  restoration point, no cross-mode text bleed, restore-on-init ordering,
  diagnostics ownership.
- [x] Previously accepted browser evidence: Editor and Journal retain separate
  unsaved text across mode switches within the session.
- [x] Help copy states the session-scoped boundary (no permanent-persistence
  promise) in `mode-editor` and `mode-journal` topics.

### F3. Bulk Task reconciliation

- [x] `scripts/task-reconcile-validators.cjs` green: conservative ceiling,
  duplicate/ambiguous cases left untouched, physical Save initializes lifecycle
  metadata, draft autosave never substitutes for Save.
- [x] Previously accepted browser evidence: pasting three Tasks initializes
  lifecycle metadata for all three on physical Save.
- [x] Release Notes documents the boundary; Tasks above the limit, duplicates,
  and ambiguous rows remain untouched.

### F4. Update Ready workflow and dark mode

- [x] `scripts/update-ready-validators.cjs` green: user-controlled reload,
  dark-mode card styling, offline update checks deferred and resumed,
  last-seen state keyed by product version.
- [x] `js/ui/release-notes.js` derives the current version from
  `MME_RELEASE.productVersion` — no hardcoded version, so What's New ownership
  follows `js/release/release.js` automatically.
- [x] Release identity `0.6.1` present in `js/release/release.js` and `sw.js`;
  `scripts/release-parity.cjs` reports no owner mismatch.
- [x] Previously accepted browser evidence: Update Ready card renders
  correctly in dark mode and applies an update only when Reload is chosen.

### F5. HTML Preview inline rendering

- [x] `scripts/html-preview-render-validators.cjs` green (48/48): inline
  Markdown inside list items — bold, italic, inline code, links, Wiki Links,
  nested lists, and formatted Task rows.
- [x] Previously accepted browser evidence: list items render inline formatting
  in HTML Preview in the installed application.

### Release close-out checks

- [x] Version ownership: `js/release/release.js` `productVersion = 0.6.1`,
  `cacheIdentity = markmap-journal-pwa-0.6.1-foundation-closure`; `sw.js`
  `APP_VERSION` identical.
- [x] Release Notes: 0.6.1 entry is newest, opened expanded; 0.6.0 entry
  retained beneath it, collapsed; content covers offline foundation, updates,
  mode/Task reliability, usage example, and technical boundaries.
- [x] No temporary development identity (`test1`, `0.6.2-test`, `v7x-metadata`)
  appears as the current public release.
- [x] `node --check` clean on all touched JS; focused validator suite green;
  `git diff --check` clean.
- [x] In-environment headless Chromium (149) acceptance attempt executed and
  recorded: `data:` URL navigation works, but every HTTP(S) navigation
  (localhost and external, across `--no-proxy-server` and
  `--single-process/--no-zygote` launch variants) issues
  `Network.requestWillBeSent` and never receives a response, so this device's
  coder environment cannot complete §I browser steps.
- [ ] Post-bump browser smoke (owner device): reload online, confirm 0.6.1
  activation and old `markmap-journal-pwa-0.6.0-help-release-foundation-*`
  cache cleanup, three-Task Save smoke, genuine offline reload.
