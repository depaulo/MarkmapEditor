// @ts-nocheck

(function () {
  'use strict';

  // Classic dynamic script loader to keep index.html clean and preserve ordering.

  function appendScript(src, { onload } = {}) {
    const s = document.createElement('script');
    s.src = src;
    if (onload) s.onload = onload;
    document.body.appendChild(s);
    return s;
  }

  // Load order: UI overlays/modals -> templates data -> export helpers -> main -> templates menu
  appendScript('./js/ui/welcome.js');
  appendScript('./js/ui/help.js');
  appendScript('./js/templates/templates-data.js');

  appendScript('./js/export/export-actions.js');
  appendScript('./js/export/export-menu.js');

  appendScript('./js/main.js', {
    onload: function () {
      // main entry notifies other modules that UI actions can be wired
      window.dispatchEvent(new Event('mme-main-ready'));
    },
  });

  appendScript('./js/templates/templates-menu.js');
})();

