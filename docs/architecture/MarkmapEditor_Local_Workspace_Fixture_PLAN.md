# MarkmapEditor — Local-Only Workspace Fixture Harness (PLAN)

> PLAN ONLY
> NOT IMPLEMENTATION AUTHORIZATION
> OWNER APPROVAL REQUIRED

No source, tests, validators, service worker, version, cache, Release Notes, ACT 3A or ACT 3B is modified by this task. This document is a planning artifact only. It is not staged, committed or pushed by the authoring task.

---

## 1. Status and Scope

- **Objective:** `http://127.0.0.1:8000/?mme-fixture=projects-review` must load a small deterministic synthetic Workspace without invoking `showDirectoryPicker()`.
- **Hard constraint:** the fixture must exercise the real parser, Workspace Index and UI projections. It must NOT create a second parser, second Index, static HTML mock or fake Projects array.
- **Host guard:** fixture activation must be refused outside `localhost` / `127.0.0.1` (GitHub Pages, Codespaces public hostname, any remote host).
- **Baseline:** branch `development`, working tree clean (`git status --short` empty, `git diff --check` exit 0, `git diff --stat` empty).

---

## 2. Guidance Reviewed (Part 1)

| Document | Classification | Role in this plan |
|---|---|---|
| `docs/validation/PLAYWRIGHT_MCP_BROWSER_VALIDATION.md` | current validation contract | defines headless MCP scope, Workspace-dependent blocker policy, owner manual acceptance, reporting categories |
| `docs/validation/OWNER_TEST_MATRIX.md` | validation contract | owner → test-tier mapping; owner manual acceptance column |
| `docs/validation/TEST_CATALOG.md` | validation contract | 37 tracked scripts + aggregate runner; fixture harness registered here only after authorization |
| `docs/architecture/MarkmapEditor_ACT3_Projects_Review_Usability_PLAN.md` | current architecture | ACT 3 scope, ownership map, persistence contract, protected owners |
| `docs/architecture/MarkmapEditor_1.0_PACKAGE_5_MANAGED_PROJECT_ARCHITECTURE.md` | durable architecture | managed Project contract, parser, mutation owner, adapter |
| `docs/architecture/MarkmapEditor_Task_Lifecycle_ARCHITECTURE.md` | durable architecture | Task grammar, lifecycle, board/review projection |
| `docs/architecture/MarkmapEditor_Screen_Layout_ARCHITECTURE.md` | durable architecture | Journal context, route/splitter contract, mode session |

Conclusion: the fixture is a **test harness only**. It must reuse the shipped owners end-to-end and must not become a second architecture.

---

## 3. Ownership Map (Part 2)

| Role | Owner (file / symbol) | Notes |
|---|---|---|
| `showDirectoryPicker()` owner | `js/workspace/workspace-open.js` — `openWorkspaceDirectory()` | throws if picker unsupported; calls `window.showDirectoryPicker({ mode: 'readwrite' })` |
| picker + detection transaction | `js/workspace/workspace-open.js` — `openWorkspaceCandidate()` | wraps picker, normalizes cancel, calls `detectWorkspaceFormat()` |
| format detection | `js/workspace/workspace-open.js` — `detectWorkspaceFormat()` / `classifyWorkspaceEntries()` | read-only; validates `notes/` presence and rejects legacy/mixed |
| Workspace activation owner | `js/workspace/workspace-controller.js` | transaction: detect → create `notes/` if needed → scan → assign state |
| file enumeration owner | `js/workspace/workspace-scanner.js` — `scanFolder()` / `scanNotesFolder()` | one pass over directory entries; maps to file records |
| file record representation | `WORKSPACE_STATE.files.notes[]` (`workspace-state.js`) | `{ kind: 'notes', name, path, handle }` — `handle` is a `FileSystemFileHandle` |
| canonical Workspace state | `js/workspace/workspace-state.js` — `WORKSPACE_STATE` | `rootHandle`, `rootName`, `folders.notes`, `files.notes[]`, `activeFile` |
| text-read owner | production `WorkspaceFile` read path (file handle `getFile()` → text) consumed by `js/workspace/workspace-parser.js` and `js/main.js` text helpers | single parse owner; must not be duplicated |
| Workspace Index build entry point | `js/main.js` — `buildWorkspaceIndex()` (globals `WORKSPACE_INDEX_STATE`, `scheduleWorkspaceIndexRebuild`) | consumes `WORKSPACE_STATE.files.notes` only |
| Host lifecycle / capabilities | `js/workspace/workspace-host.js`, `js/workspace/workspace-capabilities.js` | route registration, `journals` capability, activation lifecycle |
| navigation / open-file assumptions | `globalThis.openWorkspaceFile`, `globalThis.findWorkspaceFileByPath` (main.js) | physical open via file handle; navigation history integration |
| physical Save assumptions | `saveSmart()` / buffer update / one Save per source (main.js + `project-visual-adapter.js`) | F1 must NOT reach these owners |
| smallest seam for synthetic records | `WORKSPACE_STATE` record population boundary in `workspace-controller.js` (the point where `files.notes` is populated) | synthetic file records could enter here; **storage abstraction already exists** (`WORKSPACE_STATE` object shape) |

### Storage abstraction status
A storage abstraction **already exists** in the form of the plain `WORKSPACE_STATE` object: `rootHandle` + `files.notes[]` (each record `{ kind, name, path, handle }`). The parser, Index builder and UI consumers read only this object. The seam is therefore **the record population step**, not a new abstraction.

### Critical assumptions to satisfy
1. `WORKSPACE_STATE.rootHandle` is used as the "workspace ready" signal (`isWorkspaceReady()` = `Boolean(state.rootHandle)`) and for physical operations.
2. Every file record carries a `handle`; text reads go through `handle.getFile()`.
3. The Index builder and UI only read `WORKSPACE_STATE.files.notes` (path/name/kind), not the live handles, for projections.
4. Physical Save / `createWritable()` / directory permissions require a **real writable handle** — F1 will not provide one.

---

## 4. Fixture Contract (Part 3)

**Fixture name:** `projects-review`

Minimal non-confidential fixture contents (synthetic names only):

| # | Record | Purpose |
|---|---|---|
| 1 | managed Project A in source `CUSTOMER_A.md` | managed row, draft test |
| 2 | managed Project B in source `CUSTOMER_A.md` | two managed in one source |
| 3 | managed Project C in source `PROJECT_BETA.md` | managed in another source |
| 4 | unmanaged Project | read-only row |
| 5 | Project with legacy/custom value | legacy value preservation |
| 6 | valid Project (draft + Discard) | Edited/Discard behavior |
| 7 | Project with invalid quarter | invalid Apply blocked before persistence |
| 8 | Task 1 | Task projection |
| 9 | Task 2 | Task projection |
| 10 | normal Note | Notes projection |
| 11 | Knowledge Note | Knowledge projection |
| 12 | archived Note | Archive presentation |
| 13 | valid Wiki Link | link resolution |
| 14 | missing Wiki Link | unresolved link |

Synthetic identifiers only: `CUSTOMER_A`, `CUSTOMER_B`, `PROJECT_ALPHA`, `PROJECT_BETA`, `OWNER_A`. No real Workspace content is copied.

## 5. Activation (Part 4)

Activation through `?mme-fixture=projects-review` with required conditions:

- hostname is `localhost` or `127.0.0.1`;
- fixture parameter matches an allowlisted fixture (`projects-review` only in F1);
- **no activation** on GitHub Pages (`*.github.io`) or Codespaces public hostname;
- no secret or token in URL or storage;
- clear visible banner: `TEST FIXTURE · projects-review · Read-only`
- console log stating activation or refusal;
- reset reloads original deterministic fixture — no persisted fixture state.

The fixture activates the **real Journal context**.

## 6. First-Version Boundary (Part 5)

**F1 is read-only at the physical-storage boundary.**

F1 may test:
- parsing; Index construction; Notes; Knowledge; Archive presentation; Find Files; Wiki Links; Tasks;
- Projects Review; Edit/View/Close; local drafts; Edited/Invalid; filters; Discard;
- invalid Apply blocked before persistence;
- ACT 3B Columns and Presets (when ACT 3B exists);
- responsive layout; accessibility; console; screenshots.

F1 must NOT claim to test:
- physical Save; `createWritable()`; directory permissions;
- real Archive/Restore persistence; real Project Apply persistence; one physical Save per source;
- published service worker.

A later **F2 in-memory mutation adapter** may be evaluated separately. F2 is NOT part of the initial implementation plan unless strictly required to render F1 (it is not).

## 7. Production Safety (Part 6)

The plan must prove:
- fixture cannot activate on GitHub Pages / non-loopback hosts (host allowlist guard);
- fixture data is synthetic (no real Workspace content, no secrets);
- fixture does not enter user Workspace state (only a module-scoped synthetic record set used when the parameter is present);
- fixture does not touch `localStorage` except existing harmless UI state (no new keys; no persistence of fixture data);
- fixture cannot call a physical Save owner (no writable handle is created; Save owners are unreachable without a real handle);
- fixture banner cannot be hidden accidentally (banner is part of the fixture projection, re-rendered on each fixture render);
- fixture activation is visible in console Logs;
- normal boot without the query parameter remains byte-for-byte unchanged in behavior.

## 8. File and Size Gate (Part 7)

Recommended smallest file set:

**Preferred shape:**
- one small fixture loader module (reads manifest, builds synthetic records, injects into `WORKSPACE_STATE`-shaped seam, logs activation/refusal, renders banner);
- one manifest/data file (or bounded fixture directory) with the synthetic Markdown records;
- minimal bootstrap registration (one guarded call at the existing Workspace activation seam);
- one validator (static contract);
- one browser acceptance script or documented MCP scenario.

**Target budget:**
- production source: maximum 3 changed files;
- fixture/test files: maximum 6 files;
- total implementation: target 150–350 changed lines.

**Hard stop (recommend deferring the fixture until the pre-1.0 regression package if reached):**
- more than 4 production files changed;
- more than 450 total changed lines;
- need to refactor Workspace storage generally;
- need to duplicate parsing or Index logic;
- need to modify physical Save owners.

## 9. Validation Plan (Part 8)

### Static checks
- localhost-only activation (host allowlist: `localhost`, `127.0.0.1`);
- GitHub Pages refusal (`*.github.io` refused);
- allowed fixture names only (`projects-review`);
- real parser and Index entry points used (no `parseProjects`-equivalent re-implementation; no second `WORKSPACE_INDEX_STATE`);
- no static Projects/Tasks arrays injected after parsing (records go through the parser/Index path);
- no physical Save owner reachable from the fixture path;
- no production behavior changed without the query parameter (normal boot unchanged);
- no confidential data (synthetic names only; scan for identifiers/tokens).

### Playwright MCP acceptance
- normal URL has no fixture (banner absent, normal Workspace prompt);
- fixture URL shows the banner;
- Journal activates (real Journal context);
- Workspace Index reaches ready;
- expected counts appear (Projects/Tasks/Notes/Knowledge/Archive);
- Projects Review opens;
- managed/unmanaged rows render;
- draft / Discard / Invalid work (Edited/Invalid labels; Discard clears draft; invalid Apply blocked before persistence);
- Notes / Knowledge / Archive / Find Files render;
- console has no fixture error;
- viewports 1280×720 and 1366×768.

## 7. Production Safety (Part 6)

The plan must prove:
- fixture cannot activate on GitHub Pages / non-loopback hosts (host allowlist guard);
- fixture data is synthetic (no real Workspace content, no secrets);
- fixture does not enter user Workspace state (only a module-scoped synthetic record set used when the parameter is present);
- fixture does not touch `localStorage` except existing harmless UI state (no new keys; no persistence of fixture data);
- fixture cannot call a physical Save owner (no writable handle is created; Save owners are unreachable without a real handle);
- banner cannot be hidden accidentally (banner is part of the fixture projection, re-rendered on each fixture render);
- activation is visible in console Logs;
- normal boot without the query parameter remains byte-for-byte unchanged in behavior.

## 8. File and Size Gate (Part 7)

Recommended smallest file set:

**Preferred shape:**
- one small fixture loader module (reads manifest, builds synthetic records, injects into `WORKSPACE_STATE`-shaped seam, logs activation/refusal, renders banner);
- one manifest/data file (or bounded fixture directory) with the synthetic Markdown records;
- minimal bootstrap registration (one guarded call at the existing Workspace activation seam);
- one validator (static contract);
- one browser acceptance script or documented MCP scenario.

**Target budget:**
- production source: maximum 3 changed files;
- fixture/test files: maximum 6 files;
- total implementation: target 150–350 changed lines.

**Hard stop (recommend deferring the fixture until the pre-1.0 regression package if reached):**
- more than 4 production files changed;
- more than 450 total changed lines;
- need to refactor Workspace storage generally;
- need to duplicate parsing or Index logic;
- need to modify physical Save owners.

## 9. Validation Plan (Part 8)

### Static checks
- localhost-only activation (host allowlist: `localhost`, `127.0.0.1`);
- GitHub Pages refusal (`*.github.io` refused);
- allowed fixture names only (`projects-review`);
- real parser and Index entry points used (no `parseProjects`-equivalent re-implementation; no second `WORKSPACE_INDEX_STATE`);
- no static Projects/Tasks arrays injected after parsing (records go through the parser/Index path);
- no physical Save owner reachable from the fixture path;
- no production behavior changed without the query parameter (normal boot unchanged);
- no confidential data (synthetic names only; scan for identifiers/tokens).

### Playwright MCP acceptance
- normal URL has no fixture (banner absent, normal Workspace prompt);
- fixture URL shows the banner;
- Journal activates (real Journal context);
- Workspace Index reaches ready;
- expected counts appear (Projects/Tasks/Notes/Knowledge/Archive);
- Projects Review opens;
- managed/unmanaged rows render;
- draft / Discard / Invalid work (Edited/Invalid labels; Discard clears draft; invalid Apply blocked before persistence);
- Notes / Knowledge / Archive / Find Files render;
- console has no fixture error;
- viewports 1280×720 and 1366×768.

## 10. Decision (Part 9)

**Recommendation: B — Defer F1** unless the owner accepts the narrow-seam risk below. Rationale:

The only clean seam is the `WORKSPACE_STATE` record-population boundary in `workspace-controller.js`. A fixture would need to inject synthetic file records that carry a `handle` satisfying the text-read path without a real `FileSystemFileHandle`. This risks either (a) a narrow adapter that fakes `getFile()` (a second read path) or (b) touching the controller's activation transaction (a production behavior change). Both approach the hard stops (duplicate read/Index logic; production behavior change).

- **Exact seam:** `WORKSPACE_STATE.files.notes[]` population in the Workspace activation transaction (`workspace-controller.js`), plus a guarded loader invoked at boot when `?mme-fixture=` is present and host is loopback.
- **Exact files (if A):** `js/workspace/workspace-controller.js` (guarded injection), `js/main.js` (boot guard + banner), `js/app/script-loader.js` (register fixture loader) — 3 production files; fixture loader + manifest + validator + MCP scenario — 4 fixture/test files.
- **Changed-line estimate:** ~180–260 lines total (within target, near the lower bound).
- **Risks:** faking `getFile()` for text reads (second read path); banner accidentally hideable; fixture data leaking into real Workspace state; host guard bypass via crafted hostname.
- **Hard-stop evaluation:** F1 as specified stays at 3 production files / ~260 lines / no storage refactor / no parser or Index duplication — **no hard stop reached** for F1 itself. The risk is architectural (read-path faking), not size.
- **Rollback boundary:** remove the guarded loader registration and delete the fixture directory; the normal boot path is untouched when the parameter is absent.
- **Value:** unblocks ACT 3B (Columns/Presets) browser acceptance, Reports parity checks, Mermaid preview checks and the pre-1.0 regression package with a deterministic Workspace, without requiring the owner to hand-select a real directory for every run.

**Owner decision required:** approve A (implement F1 now, accepting the read-path adapter risk) or confirm B (defer until a cleaner storage seam or the pre-1.0 regression package).

## 11. Plan Artifact (Part 10)

This document is the single candidate plan. No other guide or summary file is created by this task.
