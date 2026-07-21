// @ts-nocheck
// Report Mode placeholder renderer.
// Generates report-output.drawio from report.md + report-template.drawio.

(function () {
  'use strict';

  const REPORT_TEMPLATE_PATH = 'templates/report-template.drawio';
  const REPORT_OUTPUT_PATH = 'generated/report-output.drawio';

  function log(msg) {
    try {
      if (typeof globalThis.log === 'function') {
        globalThis.log('[Report] ' + msg);
      } else {
        console.debug('[Report] ' + msg);
      }
    } catch {}
  }

  function showToast(msg, type, duration) {
    try {
      if (typeof globalThis.showToast === 'function') {
        globalThis.showToast(msg, type, duration);
      } else {
        console.log('[Report] ' + msg);
      }
    } catch {}
  }

  function getMarkdownText() {
    const mdEl = document.getElementById('md');
    if (!mdEl) return '';
    return String(mdEl.value || '');
  }

  function parseReportMarkdown(mdText) {
    const text = String(mdText || '').trim();
    const lines = text.split('\n');

    const result = {
      highlights: {
        alibaba: [],
        bytedance: [],
        tencent: [],
      },
      projects: [],
      notes: [],
    };

    let currentSection = null;
    let currentCompany = null;
    let currentProject = null;
    let currentPhase = null;
    let buffer = [];

    function flushBuffer(target) {
      const trimmed = buffer.join('\n').trim();
      if (trimmed) {
        target.push(trimmed);
      }
      buffer = [];
    }

    function detectCompany(line) {
      const lower = line.toLowerCase();
      if (lower.includes('alibaba')) return 'alibaba';
      if (lower.includes('bytedance')) return 'bytedance';
      if (lower.includes('tencent')) return 'tencent';
      return null;
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (/^#+\s+Notes\s*$/i.test(trimmed)) {
        currentSection = 'notes';
        currentCompany = null;
        currentProject = null;
        currentPhase = null;
        continue;
      }

      if (/^#+\s+Projects\s*$/i.test(trimmed)) {
        currentSection = 'projects';
        currentCompany = null;
        currentProject = null;
        currentPhase = null;
        continue;
      }

      if (/^#+\s+Highlights\s*$/i.test(trimmed)) {
        currentSection = 'highlights';
        currentCompany = null;
        currentProject = null;
        currentPhase = null;
        continue;
      }

      if (/^###\s+/.test(trimmed)) {
        const company = detectCompany(trimmed);
        if (company && currentSection === 'highlights') {
          currentCompany = company;
          flushBuffer(result.highlights[company]);
          continue;
        }
      }

      if (/^####\s+/.test(trimmed)) {
        if (currentSection === 'projects') {
          currentCompany = detectCompany(trimmed) || currentCompany;
          currentProject = trimmed.replace(/^####\s+/, '').trim();
          currentPhase = null;
          continue;
        }
      }

      if (/^#####\s+/.test(trimmed)) {
        if (currentSection === 'projects' && currentProject) {
          currentPhase = trimmed.replace(/^#####\s+/, '').trim();
          continue;
        }
      }

      if (/^[-*+]\s+/.test(trimmed)) {
        const bullet = trimmed.replace(/^[-*+]\s+/, '').trim();
        if (!bullet) continue;

        if (currentSection === 'notes') {
          result.notes.push(bullet);
        } else if (currentSection === 'highlights' && currentCompany) {
          result.highlights[currentCompany].push(bullet);
        } else if (currentSection === 'projects' && currentCompany && currentProject) {
          buffer.push(bullet);
        }
      } else if (trimmed && !/^#/.test(trimmed)) {
        if (currentSection === 'projects' && currentCompany && currentProject) {
          buffer.push(trimmed);
        }
      }
    }

    flushBuffer(result.highlights[currentCompany || 'alibaba']);

    if (buffer.length && currentSection === 'projects' && currentCompany && currentProject) {
      const projectKey = currentProject + (currentPhase ? ' / ' + currentPhase : '');
      const existing = result.projects.find(
        (p) => p.company === currentCompany && p.project === currentProject && p.phase === currentPhase
      );
      if (existing) {
        existing.details = buffer.join('\n').trim();
      } else {
        result.projects.push({
          company: currentCompany,
          project: currentProject,
          phase: currentPhase || '',
          details: buffer.join('\n').trim(),
        });
      }
    }

    return result;
  }

  function buildPlaceholderMap(parsed) {
    const map = {};

    const highlightBullets = (items) => (items || []).map((t) => '- ' + t).join('\n') || '- (empty)';

    map['{{H-ALI}}'] = highlightBullets(parsed.highlights.alibaba);
    map['{{H-BYT}}'] = highlightBullets(parsed.highlights.bytedance);
    map['{{H-TEN}}'] = highlightBullets(parsed.highlights.tencent);

    map['{{NOTES}}'] = (parsed.notes || [])
      .map((n) => '- ' + n)
      .join('\n') || '- (no notes)';

    return map;
  }

  async function loadTextFromHandle(fileHandle, label) {
    if (!fileHandle) {
      log(label + ': missing file handle');
      return null;
    }

    try {
      const file = await fileHandle.getFile();
      return await file.text();
    } catch (e) {
      log(label + ': failed to read file: ' + (e?.message || e));
      return null;
    }
  }

  async function resolveReportTemplateHandle() {
    try {
      if (typeof globalThis.MME_WORKSPACE_CONTROLLER?.resolveReportTemplateHandle === 'function') {
        const handle = await globalThis.MME_WORKSPACE_CONTROLLER.resolveReportTemplateHandle();
        if (handle) return handle;
      }
    } catch {}

    try {
      if (typeof globalThis.resolveReportTemplateHandle === 'function') {
        const handle = await globalThis.resolveReportTemplateHandle();
        if (handle) return handle;
      }
    } catch {}

    return null;
  }

  async function resolveReportOutputHandle() {
    try {
      if (typeof globalThis.MME_WORKSPACE_CONTROLLER?.resolveReportOutputHandle === 'function') {
        const handle = await globalThis.MME_WORKSPACE_CONTROLLER.resolveReportOutputHandle();
        if (handle) return handle;
      }
    } catch {}

    try {
      if (typeof globalThis.resolveReportOutputHandle === 'function') {
        const handle = await globalThis.resolveReportOutputHandle();
        if (handle) return handle;
      }
    } catch {}

    return null;
  }

  async function writeTextToHandle(fileHandle, text, label) {
    if (!fileHandle) {
      log(label + ': missing file handle for write');
      return false;
    }

    try {
      const writable = await fileHandle.createWritable();
      await writable.write(text);
      await writable.close();
      log(label + ': write complete');
      return true;
    } catch (e) {
      log(label + ': write failed: ' + (e?.message || e));
      return false;
    }
  }

  async function loadReportTemplate() {
    const handle = await resolveReportTemplateHandle();
    if (!handle) {
      log('Report template handle not found');
      return null;
    }

    const text = await loadTextFromHandle(handle, 'Report template');
    if (!text) return null;

    log('Report template loaded');
    return text;
  }

  async function saveReportOutput(xmlText) {
    const handle = await resolveReportOutputHandle();
    if (!handle) {
      log('Report output handle not found');
      return false;
    }

    const ok = await writeTextToHandle(handle, xmlText, 'Report output');
    if (!ok) return false;

    showToast('Report rendered', 'ok', 2000);
    return true;
  }

  function replacePlaceholders(xmlText, placeholderMap) {
    let result = String(xmlText || '');
    let replaced = 0;

    for (const [key, value] of Object.entries(placeholderMap)) {
      const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escapedKey, 'g');
      const matches = result.match(re);
      if (matches) {
        replaced += matches.length;
        result = result.replace(re, String(value || ''));
      }
    }

    log('Placeholder replacements: ' + replaced);
    return result;
  }

  async function renderReport() {
    log('Render started');

    const mdText = getMarkdownText();
    if (!mdText.trim()) {
      showToast('Empty Markdown', 'error', 2200);
      log('Render aborted: empty Markdown');
      return;
    }

    const templateXml = await loadReportTemplate();
    if (!templateXml) {
      showToast('Template not found', 'error', 3000);
      log('Render aborted: template missing');
      return;
    }

    const parsed = parseReportMarkdown(mdText);
    const placeholderMap = buildPlaceholderMap(parsed);
    const outputXml = replacePlaceholders(templateXml, placeholderMap);

    const saved = await saveReportOutput(outputXml);
    if (!saved) {
      showToast('Failed to save report output', 'error', 3000);
      log('Render failed: output save failed');
      return;
    }

    log('Render complete');
    refreshDrawioOutputPreview();
  }

  function refreshDrawioOutputPreview() {
    try {
      const preview = document.getElementById('drawioOutputPreview');
      if (!preview) return;

      preview.textContent = 'Report output updated. Open generated/report-output.drawio to view.';
    } catch {}
  }

  function refreshDrawioTemplatePreview() {
    try {
      const preview = document.getElementById('drawioTemplatePreview');
      if (!preview) return;

      preview.textContent = 'Template loaded from templates/report-template.drawio.';
    } catch {}
  }

  async function reloadTemplate() {
    log('Reload template requested');
    refreshDrawioTemplatePreview();
    showToast('Template reloaded', 'ok', 1400);
  }

  async function reloadOutput() {
    log('Reload output requested');
    refreshDrawioOutputPreview();
    showToast('Output reloaded', 'ok', 1400);
  }

  function wireReportControls() {
    const btnRender = document.getElementById('btnRenderReport');
    if (btnRender && !btnRender.__reportBound) {
      btnRender.addEventListener('click', async () => {
        try {
          await renderReport();
        } catch (e) {
          const msg = e?.message || String(e);
          showToast('Render failed: ' + msg, 'error', 3000);
          log('Render error: ' + msg);
        }
      });
      btnRender.__reportBound = true;
      log('Render Report button wired');
    }

    const btnReloadTemplate = document.getElementById('btnReloadTemplate');
    if (btnReloadTemplate && !btnReloadTemplate.__reportBound) {
      btnReloadTemplate.addEventListener('click', async () => {
        await reloadTemplate();
      });
      btnReloadTemplate.__reportBound = true;
      log('Reload Template button wired');
    }

    const btnReloadOutput = document.getElementById('btnReloadOutput');
    if (btnReloadOutput && !btnReloadOutput.__reportBound) {
      btnReloadOutput.addEventListener('click', async () => {
        await reloadOutput();
      });
      btnReloadOutput.__reportBound = true;
      log('Reload Output button wired');
    }
  }

  function initReportMode() {
    log('Initializing Report Mode');
    wireReportControls();
    refreshDrawioTemplatePreview();
    refreshDrawioOutputPreview();
  }

  try {
    if (document.documentElement.dataset.appContext === 'report') {
      initReportMode();
    }
  } catch {}

  try {
    window.addEventListener('mme-app-context-changed', (event) => {
      const ctx = event?.detail?.context || {};
      if (ctx.id === 'report') {
        initReportMode();
      }
    });
  } catch {}

  globalThis.MME_REPORT_RENDERER = {
    renderReport,
    parseReportMarkdown,
    buildPlaceholderMap,
    refreshDrawioOutputPreview,
    refreshDrawioTemplatePreview,
    reloadTemplate,
    reloadOutput,
    initReportMode,
  };
})();
