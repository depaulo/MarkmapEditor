# MarkmapEditor Screen Layout Architecture

## Status

Final implemented architecture for the Screen Layout phase (S1, S2, S3, S4A, S4B).

This document describes the verified implementation, not intended behavior.
Screen Layout is horizontally composed; nothing here describes an implemented
vertical, drawer, or primary-pane mobile system.

Checkpoints:

- architecture baseline: `cf37f6e`;
- S1: `d241e9c` — resize and overlay isolation;
- S2: `677c2b7` — pane registry and edge restore;
- S3: `7264be3` — pane-local fullscreen;
- S4A: `c80dfc4` — contextual presets, Layout selector, Quick Edit;
- S4B: `4e6237c` + `0c98d8c` — touch-friendly controls and unified Pointer
  Events splitter lifecycle;
- PWA reconciliation: `css/view-layout.css` and `js/ui/view-layout.js` are
  deterministic precache assets under
  `markmap-journal-pwa-v62-screen-layout-closure-v1`.

## Layers

```text
CONTEXT      editor | journal | slides (future contexts register their own)
PRESET       Work | Review | Presentation | Focus | Custom (customized)
PANE         Sidebar | Editor | Markmap | HTML Preview
LOCAL ACTION Hide | edge Restore | Fullscreen | pane-specific tools
TEMPORARY    local fullscreen | Presentation Quick Edit | responsive toolbar
```

Each layer only orchestrates the layer below it; composition changes always
delegate to the per-pane visibility owners.

## Contexts

- `editor`: standalone editing context.
- `journal`: workspace context with the Workspace Sidebar.
- `slides`: presentation editing context.
- Future contexts register their own panes and presets through the registry;
  no context requires a hardcoded global pane-toggle menu.

The active context is resolved by `MME_VIEW_LAYOUT.setContext()` /
`getCurrentContextId()` from `currentAppContextId`, `data-app-context`, or the
context selector. A context change exits fullscreen and closes Quick Edit
before switching, and never auto-applies a preset.

## Pane Registry

Owner: `js/ui/view-layout.js`; global API `globalThis.MME_VIEW_LAYOUT`
(frozen object, also `window.MME_VIEW_LAYOUT`).

The registry is an orchestrator/state observer. It does not own pane geometry
and does not directly touch pane DOM for visibility; it delegates to adapters.

Responsibilities:

- `registerPane(definition)` / `getPane(id)` / `getAvailablePanes()`;
- availability (context membership plus `adapter.isAvailable()`);
- visibility orchestration through `showPane` / `hidePane` / `togglePane`;
- last-useful-pane protection (a useful pane cannot be hidden when no other
  useful pane is visible; reason `last-useful-pane`);
- subscriptions (`subscribe`) and the `mme-view-layout-changed` event;
- presets (`registerPreset`, `applyPreset`, `getCurrentPreset`);
- fullscreen (`enterFullscreen`, `exitFullscreen`);
- Quick Edit (`openQuickEdit`, `closeQuickEdit`);
- derived viewer-empty state (`html.mme-viewer-empty`).

Panes are registered in `js/main.js` with narrow adapters:

- `sidebar` — show/hide delegate to `setJournalSidebarCollapsed()`;
- `editor` — delegates to `MME_EDITOR_VISIBILITY`, preserves CodeMirror focus;
- `markmap` — narrow adapter over the map pane; DOM and Markmap instance are
  preserved; zoom/pan captured and restored through `getCurrentViewState` /
  `applyViewState`;
- `html` — delegates to `showHtmlPreview()` / `hideHtmlPreview()` and
  preserves scroll position.

## Pane visibility owners

- Editor: `globalThis.MME_EDITOR_VISIBILITY` (`js/editor/editor-visibility.js`)
  owns editor-hidden state, width save/restore, the toolbar toggle, the local
  hide control, and the edge-restore control.
- HTML Preview: `showHtmlPreview()`, `hideHtmlPreview()`, `toggleHtml()` in
  `js/main.js`; splitter drag-to-open on `#splitHtml` reopens HTML through the
  canonical show path (single source of truth, once per drag).
- Sidebar: `setJournalSidebarCollapsed()` in
  `js/workspace/workspace-controller.js` is the single canonical collapse and
  restore path (class, button label, persistence, and registry state stay in
  agreement). Desktop collapse state persists; Sidebar Report output is
  contained inside the pane.
- Markmap: local hide control and the registry-owned edge tab
  (`#mmeMapEdgeRestore`); no separate visibility system.

## Presets

All compositions delegate to pane adapters via `showPane`/`hidePane` during one
transactional `applyPreset` (rollback to the prior composition on failure; the
preset is recorded only after success). Presets never apply automatically.

WORK

- Editor context: Editor visible, Markmap visible, HTML hidden.
- Journal context: Sidebar visible, Editor visible, Markmap visible, HTML hidden.
- Slides context: Editor visible, Markmap visible, HTML hidden.

REVIEW

- Editor, Markmap, and HTML Preview visible; Sidebar visible in Journal.

PRESENTATION

- Markmap and HTML visible; Editor hidden; Sidebar hidden (Journal).
- Quick Edit available; no automatic fullscreen.

FOCUS

- Editor visible; Markmap and HTML hidden; Sidebar hidden (Journal).
- The derived viewer-empty state (`html.mme-viewer-empty`) collapses the shared
  `#viewer` so the Editor fills the application content width.
- Focus remains distinct from Fullscreen Editor.

Custom / customized state

- A local pane change after preset application marks the preset customized
  (`Layout · <Name> *`); nothing is auto-reapplied.
- Re-applying the preset restores the exact composition and clears the flag.

## Local actions

A visible pane owns its own Hide action, Fullscreen action, and pane-specific
tools. A hidden pane leaves a persistent edge-restore control. Pane toolbars
never define the pane minimum width (`MIN_EDITOR_PX = 96`, `MIN_MAP_PX = 140`,
`MIN_HTML_PX = 140`); panes may shrink below their local toolbar width.

## Temporary composition

### Local fullscreen

- Application-local CSS fullscreen (`html.mme-pane-fullscreen-active` plus
  `data-mme-fullscreen-pane`); the same pane and the same instance remain in
  place. No native Fullscreen API, no localStorage persistence.
- Registry-owned state: one target at a time; shared `#mmePaneFullscreenExit`
  control; Escape closes it unless a modal owns Escape (the Layout menu does).
- Context change or preset application exits fullscreen first.
- Restoration is exact: panes hidden before entering are re-hidden, baseline
  geometry is restored, and fullscreen-time layout wins when valid:
  - Editor: CodeMirror scroll and focus preserved;
  - Markmap: zoom/pan preserved (view-state capture/restore);
  - HTML: scroll position preserved.

### Presentation Quick Edit

- Only available in Presentation (`quick-edit-unavailable` elsewhere).
- Uses the real Editor and the real CodeMirror instance; does not clone
  Markdown, does not change context, does not Save, and preserves dirty-state
  ownership.
- Markmap and HTML remain logically visible; where the content cannot fit all
  three panes, the non-active surface is suppressed temporarily by CSS only
  (`data-mme-quick-edit-surface`), never through a visibility owner, so no edge
  tab, last-useful-pane effect, or customized marking can occur.
- Done restores the Presentation baseline.
- Quick Edit and Done live in `#grpPresentationAction` in the toolbar beside
  `#grpLayout`; neither control floats over pane content.
- Fullscreen and Quick Edit are mutually exclusive.

### Responsive toolbar behavior

- Narrow viewports: the toolbar scrolls horizontally (viewport width based,
  never user-agent based); menus positioned from toolbar controls use
  `getBoundingClientRect`, so they remain reachable while it scrolls.
- Touch targets enlarge under `@media (pointer: coarse)` (about 40-44 px); pane
  minimum widths are not raised.
- Edge controls keep deterministic positions; safe-area insets apply only to
  controls touching viewport edges.
- An open Sidebar receives a narrow-viewport width cap (about 86vw); the
  collapsed rail, persisted desktop width, and wide-viewport geometry are
  unchanged.
- Touch-friendly invisible splitter lanes (`--touch-splitter-hit-width: 28px`)
  under a coarse pointer for `#splitEditor`, `#splitHtml`, and the Sidebar
  resize handle; visible splitter geometry is unchanged.
- Pointer Events unify mouse, touch, and pen drag in `makeResizable()`: one
  active pointer id, pointer capture, and a shared idempotent finalizer for
  `pointerup` / `pointercancel` / `lostpointercapture`.
- DeX is treated by width/capability media queries, not by user-agent detection.

## PWA asset ownership

`css/view-layout.css` and `js/ui/view-layout.js` are loaded dynamically by
`js/app/script-loader.js` (before `main.js`) and are precached in `sw.js`
(`LOCAL_APP_SHELL`) so the release cache identity controls them
deterministically. Cache identity:
`markmap-journal-pwa-v62-screen-layout-closure-v1` (`-app` / `-runtime`),
prefix-scoped activation cleanup (`markmap-journal-pwa-`).

## Intentionally excluded (not implemented)

- vertical pane stacking;
- orientation-driven pane reorder;
- mobile primary-pane state;
- mandatory mobile switcher;
- mobile Sidebar drawer;
- native Fullscreen API;
- arbitrary docking / draggable pane rearrangement;
- saved custom layouts / per-document layout persistence.

## Module boundaries (recommendations only; no extraction performed)

- `js/ui/view-layout.js`: KEEP through closure; consider extracting the
  preset/Quick Edit UI if future work expands it.
- `js/main.js`: KEEP for closure; HTML Preview and pane resize are extraction
  candidates.
- HTML Preview: potential EXTRACT NEXT (substantial show/hide/render/control/
  scroll lifecycle, independently testable).
- Pane resize and Markmap pane: DEFER.
- Responsive CSS: KEEP distributed among its current owners (`layout.css`,
  `toolbar.css`, `view-layout.css`, `workspace.css`, `overlays.css`).

## Final acceptance

- overlays no longer block resize;
- panes shrink below their toolbar width;
- local Hide and edge restore are consistent;
- pane-local fullscreen restores state (Editor width, Markmap zoom/pan, HTML
  scroll);
- presets are contextual and predictable with honest customized marking;
- the Editor fills the content width in Focus;
- Quick Edit uses the real Editor and restores Presentation;
- touch resize works on `#splitEditor` and `#splitHtml` (device-confirmed);
- view-layout assets are deterministic release assets;
- existing editor, workspace, HTML, Markmap, and Report workflows remain
  functional.
