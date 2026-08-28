# MarkmapEditor Screen Layout Architecture

## Status

Planning baseline for the screen-layout phase after the Draw.io Report MVP closure.

This document is based on the current repository snapshot in `repomix-output-depaulo-MarkmapEditor (9).xml`.

## Source-truth assessment

The repository already contains important pieces that older screen plans treated as future work:

- `#layout` and `#viewer` are flex containers.
- `#viewer` and `#mapPane` already use `min-width: 0`.
- `#editor` still declares `min-width: 200px`.
- `#htmlPane` still declares `min-width: 200px`.
- splitters already exist.
- `js/editor/editor-visibility.js` already owns Editor hide/show, remembers width, and wires:
  - the top toolbar Editor toggle;
  - the Editor local hide control;
  - the Editor edge-restore control.
- HTML Preview already has a close control and an edge-open control.
- Markmap and Editor already have local overlay control surfaces.
- HTML overlay controls are currently moved into `#viewer`, rather than remaining owned by `#htmlPane`.
- `main.js` still owns substantial HTML Preview, Markmap overlay, splitter, and editor-overlay integration.

Therefore, this phase must consolidate existing behavior rather than create a second visibility system.

## Product decisions

### Global controls

The top toolbar owns only:

- application context/mode;
- layout preset selection.

The top toolbar does not own a hardcoded list of every pane in every context.

### Local controls

A visible pane owns its own:

- Hide action;
- Fullscreen action;
- pane-specific tools.

### Hidden panes

A hidden pane leaves a persistent edge-restore control.

### Optional recovery menu

A future global recovery command may provide:

- Restore all panes;
- Reset current layout;
- Exit fullscreen.

It is secondary, not the primary pane-toggle mechanism.

## Core contract

```text
Context
-> registers available panes and presets

Preset
-> applies an initial composition

Visible pane
-> provides local Hide and Fullscreen

Hidden pane
-> provides an edge-restore control

Pane toolbar
-> never defines the pane minimum width

Mobile
-> reuses the same pane registry, normally showing one primary pane at a time
```

## Initial panes

### Editor context

- Editor
- Markmap
- HTML Preview

### Journal context

- Workspace Sidebar
- Editor
- Markmap
- HTML Preview

### Future contexts

Future contexts such as Slides or standalone Draw.io register their own panes and presets without adding their pane names to a fixed global toolbar contract.

## Pane registry

Recommended runtime owner:

```text
js/ui/view-layout.js
```

Recommended global API:

```text
globalThis.MME_VIEW_LAYOUT
```

The registry should support:

- `registerPane(definition)`
- `unregisterPane(id)` only if needed by a real context lifecycle
- `getPane(id)`
- `getAvailablePanes(contextId)`
- `isPaneVisible(id)`
- `showPane(id, options)`
- `hidePane(id, options)`
- `togglePane(id, options)`
- `restoreAll(contextId)`
- `registerPreset(definition)`
- `applyPreset(id, options)`
- `getCurrentPreset()`
- `enterFullscreen(paneId)`
- `exitFullscreen()`
- `getState()` as a safe immutable projection
- `refresh()`

The first implementation must adapt existing Editor and HTML owners rather than duplicate them.

## Pane definition

Conceptual shape:

```js
{
  id: 'editor',
  label: 'Editor',
  contexts: ['editor', 'journal'],
  edge: 'left',
  elementId: 'editor',
  splitterId: 'splitEditor',
  hideControlId: 'editorBtnHide',
  restoreControlId: 'btnEditorEdgeOpen',
  canHide: true,
  canFullscreen: true,
  adapter: {
    show,
    hide,
    isVisible,
    captureSize,
    restoreSize
  }
}
```

Definitions are data contracts. Existing owners remain authoritative until migrated deliberately.

## Size and resize contract

### Required behavior

- Editor, Markmap, and HTML Preview can shrink below the width of their local toolbars.
- Splitters retain pointer ownership during drag.
- Toolbars never impose intrinsic minimum width on panes.
- Markmap pan, zoom, node click, and drag remain functional.
- Editor selection, scroll, and CodeMirror commands remain functional.
- HTML scrolling remains functional.

### CSS rules

Pane and flex/grid ancestors that must shrink use:

```css
min-width: 0;
min-height: 0;
```

Grid tracks, if introduced, use:

```css
minmax(0, 1fr)
```

The pane defines toolbar capacity, not the reverse.

### Overlay isolation

- A transparent overlay layer uses `pointer-events: none`.
- Actual controls use `pointer-events: auto`.
- Toolbars use `max-width` constrained to the owning pane.
- Toolbars wrap, compact, scroll internally, or collapse into More/Tools.
- A toolbar must not overlap the splitter hit target.
- Splitters use a higher interaction layer than decorative overlay surfaces.

### Current source-specific risks

- `#editor { min-width: 200px; }` prevents smaller Editor widths.
- `#htmlPane { min-width: 200px; }` prevents smaller Preview widths.
- Markmap and Editor overlay widths can constrain or visually overrun narrow panes.
- HTML controls currently live under `#viewer`, so ownership and positioning must be reviewed before pane-local fullscreen.
- Markmap overlay listeners stop propagation on the entire overlay surface; the overlay hit area must remain no larger than the visible controls.

## Edge restore

Existing Editor and HTML edge controls should be generalized, not replaced abruptly.

Recommended edges:

- Editor: left
- Workspace Sidebar: left
- Markmap: right
- HTML Preview: right or lower-right

Requirements:

- edge controls remain reachable;
- controls do not cover splitters;
- controls remain touch-friendly;
- restoring a pane restores its last valid size when possible;
- hiding a pane does not destroy its state;
- at least one useful primary pane must remain visible.

## Fullscreen

Fullscreen is pane-local and temporary.

Targets:

- Editor
- Markmap
- HTML Preview

On enter:

- capture visibility and sizes;
- visually isolate the target pane;
- keep the same document and runtime objects;
- keep dirty state;
- preserve pane-local state;
- show Exit Fullscreen;
- support Escape.

On exit:

- restore the exact pre-fullscreen composition where possible;
- restore splitter visibility;
- preserve Editor selection;
- preserve Markmap zoom/pan;
- preserve HTML scroll where possible.

Fullscreen does not overwrite a saved preset.

## Presets

### Work

Editor context:

- Editor visible
- Markmap visible
- HTML Preview hidden

Journal context:

- Sidebar visible
- Editor visible
- Markmap visible
- HTML Preview hidden

### Review

- Editor visible
- Markmap visible
- HTML Preview visible
- Sidebar follows context default

### Presentation

- Markmap visible
- HTML Preview visible
- Editor hidden initially
- Sidebar hidden
- Quick Edit available

### Focus

- Editor visible
- Markmap hidden
- HTML Preview hidden
- Sidebar hidden

Presets are contextual definitions registered into the same layout owner. A future context may register different preset names without changing the pane registry core.

## Quick Edit

Quick Edit is temporary access to the real Editor during Presentation.

Desktop and DeX:

- temporary side panel where feasible.

Phone:

- near-fullscreen Editor overlay/composition.

Quick Edit:

- uses the current Markdown;
- does not clone the document;
- preserves dirty state;
- does not auto-save;
- refreshes Markmap and HTML through existing rendering paths;
- returns to the prior Presentation composition.

## Mobile behavior

Desktop and DeX remain the primary multi-pane experience.

Phone default:

- one primary pane at a time;
- Editor / Map / Preview switcher derived from the pane registry;
- Workspace Sidebar becomes a drawer;
- pane tools compact into a small Tools/More control;
- no hover-only interaction;
- safe-area aware controls;
- keyboard-safe Quick Edit completion control.

Phone Presentation:

- Map / Preview switcher;
- no forced side-by-side composition in portrait.

DeX should follow desktop behavior based on actual viewport capability, not device user-agent detection.

## Persistence

Initial persistence may store only:

- last preset;
- last normal visibility composition;
- last valid pane sizes;
- last mobile primary pane.

Do not initially persist:

- per-document layouts;
- per-workspace layouts;
- independent portrait/landscape layouts;
- arbitrary docking trees.

Temporary fullscreen and Quick Edit state must not persist.

## Compatibility requirements

This screen phase must preserve:

- current document identity;
- dirty state;
- Save and Save As;
- Hot Reload;
- mode sessions;
- Workspace Host;
- Navigation History;
- Wiki Links;
- Task Review;
- Markmap-to-Editor jump;
- HTML synchronization;
- Report panel;
- Draw.io Report overlay and output workflow;
- light and dark themes;
- Compact Mode.

## Revised implementation packages

The current repository already has Editor local hide/restore and HTML close/restore. Therefore the earlier six implementation ACTs should be reduced to five focused packages.

### S1 - Resize and overlay isolation

- remove toolbar-driven minimum-width behavior;
- correct Editor and HTML shrink constraints;
- constrain local toolbars to pane size;
- protect splitter pointer ownership;
- validate Markmap, Editor, and HTML interaction.

No new module required.

### S2 - Unified pane registry and edge restore

- create `js/ui/view-layout.js`;
- create `css/view-layout.css`;
- adapt existing Editor and HTML visibility owners;
- add Markmap local Hide and edge restore;
- register Workspace Sidebar where source ownership permits;
- expose a safe runtime API and dormant validator.

### S3 - Pane-local fullscreen

- add Editor, Markmap, and HTML fullscreen;
- restore exact prior layout;
- Escape and visible Exit;
- preserve local state.

### S4 - Contextual presets, Presentation, and Quick Edit

- add Work, Review, Presentation, Focus;
- add top-level Layout preset selector only;
- add Quick Edit;
- keep pane toggles local.

### S5 - Mobile layer and stabilization

- one primary pane at a time on phone;
- Sidebar drawer;
- Editor / Map / Preview switcher;
- touch/safe-area/keyboard handling;
- cross-context regression validation;
- no new feature beyond stabilization.

### S-DOC - Documentation closure

- update STATUS, TODO, VERIFY, VALIDATION_REPORT;
- finalize this architecture document from implemented source truth.

## Expected new files

Implementation:

```text
js/ui/view-layout.js
css/view-layout.css
```

Documentation:

```text
docs/architecture/MarkmapEditor_Screen_Layout_ARCHITECTURE.md
```

Conditional only if source size proves necessary after S4:

```text
js/ui/mobile-layout.js
```

Do not create the conditional mobile module in advance.

## Release boundaries

Recommended checkpoints:

```text
fix(layout): isolate pane controls from resize
feat(layout): add pane registry and edge restore
feat(layout): add local pane fullscreen
feat(layout): add contextual presets and presentation quick edit
feat(layout): add responsive mobile pane navigation
fix(layout): stabilize screen layout behavior

docs(layout): complete screen layout documentation
```

S5 may produce one feature commit and one stabilization commit if fixes are substantial. It remains one PLAN/ACT package unless source-proven complexity requires separation.

## Non-goals

- arbitrary docking;
- draggable pane rearrangement;
- per-document layouts;
- a second mobile application;
- phone splitters;
- context-specific hardcoded pane lists in the top toolbar;
- standalone Draw.io implementation;
- Reveal.js redesign;
- Report workflow changes.

## Final acceptance

- overlays no longer block resize;
- panes shrink below toolbar width;
- local Hide and edge restore are consistent;
- pane-local fullscreen restores state;
- presets are contextual and predictable;
- phone uses one primary pane without breaking DeX;
- no context requires a hardcoded global pane-toggle menu;
- existing editor, workspace, HTML, Markmap, and Report workflows remain functional.
