// @ts-nocheck

// Classic browser script: Export helpers moved out of js/main.js
// Must not change export behavior.

(function () {
  'use strict';

  // These functions rely on globals from js/main.js (currentFileName, md, dirty, etc.).
  // They are expected to be defined in js/main.js at runtime OR in this file via moves.

  // If any required dependency is missing, we fail silently to preserve legacy behavior.

  function getCurrentMarkdownText() {
    if (typeof window.__cmGetText === 'function') {
      return window.__cmGetText();
    }

    const mdEl = document.getElementById('md');
    return mdEl?.value || '';
  }

  function downloadTextFile(text, fileName, mimeType = 'text/markdown;charset=utf-8') {
    const blob = new Blob([text || ''], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'document.md';
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 500);
  }

  function getMarkdownExportFileName(defaultName = 'document.md') {
    const name =
      typeof currentFileName !== 'undefined' && currentFileName
        ? currentFileName
        : defaultName;

    return String(name || defaultName).replace(/\.[^.]+$/, '') + '.md';
  }

  function exportCurrentMarkdownFile(fileName) {
    const text = getCurrentMarkdownText();
    const safeName = fileName || getMarkdownExportFileName('slides.md');
    downloadTextFile(text, safeName, 'text/markdown;charset=utf-8');
  }

  function exportMarkdownDownload() {
    try {
      const text = getCurrentMarkdownText();
      const fileName = getMarkdownExportFileName('slides.md');
      downloadTextFile(text, fileName, 'text/markdown;charset=utf-8');
      showToast?.(`Exported ✓ ${fileName}`, 'download', 2600);
      log?.(`Export Slides Markdown: downloaded ${fileName}`);
    } catch (e) {
      showToast?.(' ❌ Export failed: ' + e.message, 'error');
    }
  }

  // HTML preview export and Mindmap SVG export are still implemented in main.js today.
  // Keep stubs exported to avoid breaking menu wiring if showExportMenu gets moved.
  // They will be overwritten by js/main.js or by later refactor steps.
  async function exportHtmlPreview() {
    if (typeof window.exportHtmlPreview === 'function') {
      return window.exportHtmlPreview();
    }
    throw new Error('exportHtmlPreview not available');
  }

  async function exportMindmapSvg() {
    if (typeof window.exportMindmapSvg === 'function') {
      return window.exportMindmapSvg();
    }
    throw new Error('exportMindmapSvg not available');
  }

  try {
    // Export to window/globalThis to preserve classic wiring.
    window.getCurrentMarkdownText = getCurrentMarkdownText;
    window.downloadTextFile = downloadTextFile;
    window.getMarkdownExportFileName = getMarkdownExportFileName;
    window.exportCurrentMarkdownFile = exportCurrentMarkdownFile;
    window.exportMarkdownDownload = exportMarkdownDownload;

    window.exportHtmlPreview = exportHtmlPreview;
    window.exportMindmapSvg = exportMindmapSvg;

    globalThis.getCurrentMarkdownText = getCurrentMarkdownText;
    globalThis.downloadTextFile = downloadTextFile;
    globalThis.getMarkdownExportFileName = getMarkdownExportFileName;
    globalThis.exportCurrentMarkdownFile = exportCurrentMarkdownFile;
    globalThis.exportMarkdownDownload = exportMarkdownDownload;

    globalThis.exportHtmlPreview = exportHtmlPreview;
    globalThis.exportMindmapSvg = exportMindmapSvg;
  } catch {}
})();

