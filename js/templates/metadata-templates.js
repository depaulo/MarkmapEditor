// @ts-nocheck
// R-META2 — Metadata Template Split
// Separates metadata/frontmatter generation from body templates.
// ================================

(function () {
  'use strict';

  // ---- Private helpers ----

  function getLocalDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function safeLog(msg) {
    if (typeof globalThis.log === 'function') {
      globalThis.log(msg);
    }
  }

  // ---- Public API ----

  function getMetadataDefaults(metadataType) {
    const type = String(metadataType || '').toLowerCase();
    const date = getLocalDateString();

    if (type === 'journal') {
      return {
        type: 'journal',
        date: date,
        created: date,
        updated: '',
        status: 'active',
        tags: [],
      };
    }

    if (type === 'concept') {
      return {
        type: 'concept',
        created: date,
        updated: '',
        status: 'active',
        tags: [],
      };
    }

    return {};
  }

  function normalizeTags(tagsValue) {
    if (!Array.isArray(tagsValue)) {
      if (typeof tagsValue === 'string') {
        tagsValue = tagsValue
          .split(/[,\s]+/)
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
      } else {
        tagsValue = [];
      }
    }

    const normalized = [];
    const seen = new Set();

    for (const tag of tagsValue) {
      const trimmed = String(tag || '').trim().toLowerCase();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        normalized.push(trimmed);
      }
    }

    return normalized;
  }

  function buildFrontmatter(metadata) {
    if (!metadata || typeof metadata !== 'object') {
      return '';
    }

    const lines = ['---'];
    const keys = Object.keys(metadata).filter((k) => k !== 'date' || metadata.type === 'journal');

    for (const key of keys) {
      const value = metadata[key];

      if (Array.isArray(value)) {
        if (value.length === 0) {
          lines.push(`${key}: []`);
        } else {
          lines.push(`${key}:`);
          for (const item of value) {
            lines.push(`  - ${String(item || '')}`);
          }
        }
      } else if (value === '' || value === null || value === undefined) {
        lines.push(`${key}:`);
      } else {
        lines.push(`${key}: ${String(value || '')}`);
      }
    }

    lines.push('---');
    return lines.join('\n') + '\n';
  }

  function composeDocument(metadata, body) {
    const meta = metadata || {};
    const bodyText = String(body || '');

    const frontmatter = buildFrontmatter(meta);

    if (!frontmatter) {
      return bodyText;
    }

    const trimmedBody = bodyText.trimStart();

    if (trimmedBody.startsWith('---')) {
      const endIndex = trimmedBody.indexOf('---', 3);
      if (endIndex !== -1) {
        safeLog('MetadataTemplates: body already contains frontmatter, leaving intact');
        return bodyText;
      }
    }

    const composed = frontmatter + '\n' + trimmedBody;

    return composed;
  }

  // ---- Expose module API ----

  const MME_METADATA_TEMPLATES = {
    getMetadataDefaults,
    normalizeTags,
    buildFrontmatter,
    composeDocument,
  };

  try {
    window.MME_METADATA_TEMPLATES = MME_METADATA_TEMPLATES;
    globalThis.MME_METADATA_TEMPLATES = MME_METADATA_TEMPLATES;
  } catch {}

  // ---- Boot logging ----

  safeLog('MetadataTemplates: module loaded');
})();
