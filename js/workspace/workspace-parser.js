// @ts-nocheck
// R-SPLIT2 — Workspace Metadata/Index Parser.
// Extracted parser-only helpers from main.js.
//
// The helper functions referenced below that are NOT defined in this module
// (normalizeParserText, parseMarkdownHeadings, parseMarkdownTasks,
// parseConceptLinks, parseVisibleHeaderFields, getMarkdownTitle,
// inferDateFromWorkspacePath, countWords, stripYamlFrontmatterForTags,
// normalizeTagValue) continue to live in main.js as global functions and are
// resolved at call time. This keeps the parser self-contained for the 6
// extracted helpers without duplicating the broader parsing utilities.

(function () {
  'use strict';

  function parseSimpleYamlFrontmatter(text) {
    const raw = String(text || '');
    const match = raw.match(/^\uFEFF?\s*---\s*\n([\s\S]*?)\n---\s*/);

    if (!match) {
      return {
        data: {},
        body: raw,
      };
    }

    const yaml = match[1];
    const body = raw.slice(match[0].length);
    const data = {};
    const lines = yaml.split(/\r?\n/);

    let currentKey = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) continue;

      const listMatch = trimmed.match(/^-\s+(.+)$/);

      if (listMatch && currentKey) {
        if (!Array.isArray(data[currentKey])) {
          data[currentKey] = [];
        }

        data[currentKey].push(
          listMatch[1].trim().replace(/^['"]|['"]$/g, '')
        );
        continue;
      }

      const kv = trimmed.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);

      if (!kv) continue;

      const key = kv[1].trim();
      let value = kv[2].trim();

      currentKey = key;

      if (value === '[]') {
        data[key] = [];
        continue;
      }

      if (/^\[.*\]$/.test(value)) {
        data[key] = value
          .replace(/^\[/, '')
          .replace(/\]$/, '')
          .split(',')
          .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
          .filter(Boolean);
        continue;
      }

      data[key] = value.replace(/^['"]|['"]$/g, '');
    }

    return {
      data,
      body,
    };
  }

  function normalizeWorkspaceTagName(tag) {
    return String(tag || '')
      .trim()
      .replace(/^#/, '')
      .toLowerCase();
  }

  function isReservedWorkspaceTag(tagName) {
    const normalized = normalizeWorkspaceTagName(tagName);

    if (!normalized) return true;

    if (
      [
        'created',
        'updated',
        'date',
        'type',
        'journal',
        'concept',
        'status',
        'tags',
        '-',
        '---',
        '[]',
      ].includes(normalized)
    ) {
      return true;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return true;
    }

    return false;
  }

  function normalizeFrontmatterTags(tagsValue) {
    if (!tagsValue) return [];

    const raw = Array.isArray(tagsValue)
      ? tagsValue
      : typeof tagsValue === 'string'
        ? tagsValue.split(/[ ,]+/)
        : [];

    return raw
      .map(normalizeWorkspaceTagName)
      .filter(Boolean)
      .filter((tag) => !isReservedWorkspaceTag(tag));
  }

  function parseMarkdownTags(text) {
    // stripYamlFrontmatterForTags / normalizeParserText / normalizeTagValue
    // remain global helpers provided by main.js.
    const source = stripYamlFrontmatterForTags(normalizeParserText(text));
    const tags = new Set();

    const lines = source.split('\n');

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] || '';
      const trimmed = line.trim();

      if (/^tags\s*:/i.test(trimmed)) {
        const after = trimmed.replace(/^tags\s*:/i, '').trim();

        if (after) {
          after
            .split(/[\s,]+/)
            .map(normalizeTagValue)
            .filter(Boolean)
            .forEach((tag) => tags.add(tag));
        }

        const next = lines[i + 1]?.trim() || '';

        if (next && !next.startsWith('#') && !/^#{1,6}\s/.test(next)) {
          next
            .split(/[\s,]+/)
            .map(normalizeTagValue)
            .filter(Boolean)
            .forEach((tag) => tags.add(tag));
        }
      }

      if (/^#{1,6}\s/.test(trimmed)) {
        continue;
      }

      const inlineMatches = trimmed.match(/(^|\s)#([a-zA-Z0-9_-]{2,})\b/g);

      if (inlineMatches) {
        inlineMatches
          .map((m) => m.replace(/^\s*#/, ''))
          .map(normalizeTagValue)
          .filter(Boolean)
          .filter((tag) => !/^[0-9a-fA-F]{3,6}$/.test(tag))
          .forEach((tag) => tags.add(tag));
      }
    }

    return Array.from(tags).sort();
  }

  function parseWorkspaceDocument({ kind, name, path, text }) {
    const normalizedText = normalizeParserText(text);
    const parsedFrontmatter = parseSimpleYamlFrontmatter(normalizedText);
    const frontmatterTags = normalizeFrontmatterTags(parsedFrontmatter.data?.tags);
    const headings = parseMarkdownHeadings(parsedFrontmatter.body);
    const tasks = parseMarkdownTasks(parsedFrontmatter.body);
    const bodyTags = parseMarkdownTags(parsedFrontmatter.body);
    const tags = Array.from(new Set([...(frontmatterTags || []), ...(bodyTags || [])])).sort();
    const conceptLinks = parseConceptLinks(parsedFrontmatter.body);
    const header = parseVisibleHeaderFields(parsedFrontmatter.body);

    const title = getMarkdownTitle(normalizedText, String(name || '').replace(/\.md$/i, ''));

    const date = header.date || header.created || inferDateFromWorkspacePath(path, normalizedText);

    return {
      kind,
      name,
      path,
      title,
      date,
      tags,
      headings,
      tasks,
      conceptLinks,
      header,
      wordCount: countWords(normalizedText),
      textLength: normalizedText.length,
    };
  }

  // Expose the parser API.
  const WORKSPACE_PARSER = {
    parseSimpleYamlFrontmatter,
    normalizeWorkspaceTagName,
    isReservedWorkspaceTag,
    normalizeFrontmatterTags,
    parseMarkdownTags,
    parseWorkspaceDocument,
  };

  // Expose module-level API for direct use.
  try {
    window.WORKSPACE_PARSER = WORKSPACE_PARSER;
    globalThis.WORKSPACE_PARSER = WORKSPACE_PARSER;
  } catch {}

  // Also expose compatible globals so existing callers in main.js continue
  // to work without duplicate declarations.
  try {
    window.parseSimpleYamlFrontmatter = parseSimpleYamlFrontmatter;
    window.normalizeWorkspaceTagName = normalizeWorkspaceTagName;
    window.isReservedWorkspaceTag = isReservedWorkspaceTag;
    window.normalizeFrontmatterTags = normalizeFrontmatterTags;
    window.parseMarkdownTags = parseMarkdownTags;
    window.parseWorkspaceDocument = parseWorkspaceDocument;

    globalThis.parseSimpleYamlFrontmatter = parseSimpleYamlFrontmatter;
    globalThis.normalizeWorkspaceTagName = normalizeWorkspaceTagName;
    globalThis.isReservedWorkspaceTag = isReservedWorkspaceTag;
    globalThis.normalizeFrontmatterTags = normalizeFrontmatterTags;
    globalThis.parseMarkdownTags = parseMarkdownTags;
    globalThis.parseWorkspaceDocument = parseWorkspaceDocument;
  } catch {}
})();
