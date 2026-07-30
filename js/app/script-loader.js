// @ts-nocheck

(function () {
  'use strict';

  // Classic dynamic script loader to keep index.html clean and preserve ordering.

function appendScript(src, { onload } = {}) {
  const s = document.createElement('script');
  s.src = src;
  s.async = false;
  if (onload) s.onload = onload;
  document.body.appendChild(s);
  return s;
}

  // Load order: navigation history -> UI overlays/modals -> templates data -> export helpers -> main -> editor visibility -> templates menu
  appendScript('./js/navigation/navigation-history.js');

  appendScript('./js/ui/welcome.js');
  appendScript('./js/ui/help.js');
  appendScript('./js/templates/templates-data.js');

  appendScript('./js/export/export-actions.js');
  appendScript('./js/export/export-menu.js');

  // Workspace metadata/index parser (R-SPLIT2). Loaded before main.js so its
  // globals are available; main.js no longer declares these functions.
  appendScript('./js/workspace/workspace-parser.js');

  // Workspace Host — lifecycle foundation. Loaded before capability/runtime
  // modules and workspace adapters.
  appendScript('./js/workspace/workspace-host.js');

  // Workspace command capability policy. Must exist before main.js command
  // guards execute.
  appendScript('./js/workspace/workspace-capabilities.js');

  // Runtime-only per-mode resources, including non-cloneable file handles.
  // Must load before mode-session.js and main.js.
  appendScript('./js/workspace/mode-runtime-sessions.js');

  // Mode session manager. Loaded after the runtime registry so capture and
  // restore can use the runtime-session API.
  appendScript('./js/core/mode-session.js');

  // Render controller (R-SPLIT4 + R-RENDER1). Loaded before main.js so
  // MME_RENDER globals are available.
  appendScript('./js/render/render-controller.js');

  // Journal Workspace Adapter — thin acknowledgement adapter. Loaded before
  // main.js so it can register with the Host and coordinate with legacy init.
  appendScript('./js/workspace/journal-workspace.js');

  // Virtual Workspace Index V1. Keep the existing relative order of these two
  // files to avoid changing already-validated Index startup behavior.
  appendScript('./js/workspace/workspace-index-workspace.js');
  appendScript('./js/workspace/workspace-index-document.js');

  appendScript('./js/main.js', {
    onload: function () {
      // main entry notifies other modules that UI actions can be wired
      window.dispatchEvent(new Event('mme-main-ready'));
    },
  });

  appendScript('./js/editor/editor-visibility.js');

  // R-META2 — metadata template split. Load before templates-menu so
  // metadata/body composition helpers are available.
  appendScript('./js/templates/metadata-templates.js');

  // R-META3 — frontmatter visual hide/collapse. Load after editor visibility
  // and before templates-menu so CodeMirror-dependent wiring can use the
  // editor view when available.
  appendScript('./js/editor/frontmatter-visibility.js');

  // R-LINK1 — wiki links. Load after workspace index and editor are ready.
  appendScript('./js/links/wiki-links.js');

  // R-TASK2 + R-TASK3 — task search, filters, and priority.
  appendScript('./js/workspace/task-review.js');

  appendScript('./js/templates/templates-menu.js');
})();

