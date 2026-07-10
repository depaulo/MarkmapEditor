// @ts-nocheck
(function () {
  'use strict';

  function loadScriptSequentially(srcs) {
    return new Promise((resolve) => {
      let index = 0;
      function loadNext() {
        if (index >= srcs.length) {
          resolve();
          return;
        }
        const s = document.createElement('script');
        s.src = srcs[index];
        s.onload = function () {
          console.log('Loaded:', srcs[index]);
          index++;
          loadNext();
        };
        s.onerror = function () {
          console.error('Failed to load:', srcs[index]);
          index++;
          loadNext();
        };
        document.body.appendChild(s);
      }
      loadNext();
    });
  }

  const scripts = [
    './js/ui/welcome.js',
    './js/ui/help.js',
    './js/templates/templates-data.js',
    './js/export/export-actions.js',
    './js/export/export-menu.js',
    './js/workspace/workspace-parser.js',
    './js/core/mode-session.js',
    './js/main.js',
    './js/editor/editor-visibility.js',
    './js/templates/templates-menu.js',
    './js/editor/editor-overlay-tools.js',
    './js/map/map-overlay-controls.js',
    './js/map/map-style-modifier.js',
    './js/editor/quick-insert.js'
  ];

  loadScriptSequentially(scripts).then(() => {
    window.dispatchEvent(new Event('mme-main-ready'));
  });
})();
