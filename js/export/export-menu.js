// @ts-nocheck

// Classic browser script: Export menu wiring
// Extracted behavior-preserving from js/main.js.

(function () {
  'use strict';

  const btnExportMenu = document.getElementById('btnExportMenu');
  const exportMenu = document.getElementById('exportMenu');

  function hideExportMenu() {
    if (exportMenu) exportMenu.style.display = 'none';
  }

  function positionExportMenu() {
    try {
      if (!btnExportMenu || !exportMenu) return;

      const r = btnExportMenu.getBoundingClientRect();
      const top = r.bottom + 6;
      const left = Math.max(8, Math.min(window.innerWidth - 340, r.left));

      exportMenu.style.top = top + 'px';
      exportMenu.style.left = left + 'px';
    } catch {}
  }

  function isSlidesContext() {
    try {
      const ctxId =
        getSelectedAppContextId?.() ||
        document.documentElement.dataset.appContext ||
        localStorage.getItem('markmap:appContext') ||
        'editor';

      return ctxId === 'slides';
    } catch {
      return false;
    }
  }

  function showExportMenu() {
    try {
      if (!exportMenu) return;

      positionExportMenu();
      exportMenu.innerHTML = '';

      exportMenu.appendChild(makeMenuHeader('Export'));

      exportMenu.appendChild(
        makeMenuItem(
          'Mindmap SVG (.svg)',
          () => {
            hideExportMenu();
            exportMindmapSvg();
          },
          { icon: '🖼️' }
        )
      );

      exportMenu.appendChild(
        makeMenuItem(
          'HTML Preview (.html)',
          () => {
            hideExportMenu();
            exportHtmlPreview();
          },
          { icon: '🌐' }
        )
      );

      exportMenu.appendChild(makeMenuSep());

      if (isSlidesContext()) {
        exportMenu.appendChild(
          makeMenuItem(
            'Export Slides Markdown (.md)',
            () => {
              hideExportMenu();
              exportMarkdownDownload();
            },
            { icon: '📊' }
          )
        );

        exportMenu.appendChild(makeMenuSep());
      }

      exportMenu.appendChild(
        makeMenuHeader('SVG is static. HTML Preview is standalone.')
      );

      exportMenu.style.display = 'flex';
    } catch (e) {
      const msg = e?.message || String(e);
      try {
        log?.('❌ showExportMenu failed: ' + msg);
      } catch {}
      showToast?.('Export menu error: ' + msg, 'error', 3200);
    }
  }

  if (btnExportMenu && !btnExportMenu.__bound) {
    btnExportMenu.addEventListener('click', () => {
      const open = exportMenu && exportMenu.style.display === 'flex';
      if (open) hideExportMenu();
      else showExportMenu();
    });
    btnExportMenu.__bound = true;
  }

  document.addEventListener('mousedown', (e) => {
    if (!exportMenu || exportMenu.style.display !== 'flex') return;
    if (exportMenu.contains(e.target)) return;

    if (
      btnExportMenu &&
      (e.target === btnExportMenu || btnExportMenu.contains(e.target))
    ) {
      return;
    }

    hideExportMenu();
  });

  window.addEventListener('resize', () => {
    if (exportMenu && exportMenu.style.display === 'flex') {
      positionExportMenu();
    }
  });

  try {
    if (btnExportMenu) log?.('Export menu: wired');
  } catch {}
})();

