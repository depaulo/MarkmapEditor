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
      bodyLineOffset: match ? match[0].split(/\r?\n/).length - 1 : 0,
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

  // ================================
  // Projects Discovery — parser helpers (ACT A)
  // ================================

  function stripListPrefix(line) {
    return String(line || '').replace(/^[-*+]\s+/, '').trim();
  }

  function normalizeProjectKey(rawKey) {
    return String(rawKey || '')
      .trim()
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function resolveProjectKeyAlias(normalizedKey) {
    const key = String(normalizedKey || '').trim();
    const aliases = {
      project: 'name',
      'project name': 'name',
      name: 'name',
      value: 'value',
      amount: 'value',
      'quotation value': 'value',
      'quote value': 'value',
      currency: 'currency',
      curr: 'currency',
      order: 'expectedOrder',
      'expected order': 'expectedOrder',
      'order date': 'expectedOrder',
      'expected order date': 'expectedOrder',
      delivery: 'expectedDelivery',
      'expected delivery': 'expectedDelivery',
      'delivery date': 'expectedDelivery',
      'expected delivery date': 'expectedDelivery',
      billing: 'expectedBilling',
      'expected billing': 'expectedBilling',
      'billing date': 'expectedBilling',
      'expected billing date': 'expectedBilling',
      invoice: 'expectedBilling',
      'expected invoice': 'expectedBilling',
      status: 'status',
      stage: 'status',
      description: 'description',
      desc: 'description',
      details: 'description',
    };
    return aliases[key] || null;
  }

  function normalizeProjectQuarter(rawValue) {
    const raw = String(rawValue == null ? '' : rawValue).trim();
    const match = raw.match(/^(\d{2}|\d{4})[/-]?[qQ]([1-4])$/);

    if (!match) {
      return {
        raw,
        canonical: null,
        display: raw,
        year: null,
        quarter: null,
        valid: false,
      };
    }

    const yearPart = match[1];
    const quarter = Number(match[2]);
    const year = yearPart.length === 2 ? 2000 + Number(yearPart) : Number(yearPart);
    const canonical = `${year}-Q${quarter}`;
    const display = `${String(year).slice(-2)}Q${quarter}`;

    return {
      raw,
      canonical,
      display,
      year,
      quarter,
      valid: true,
    };
  }

  function parseProjectValue(rawValue) {
    const raw = String(rawValue == null ? '' : rawValue).trim();

    if (raw === '') {
      return { value: null, valueRaw: raw };
    }

    let candidate = raw;

    // Unambiguous thousands separators only: 1,000 / 1,000,000 / 1,000.50
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw)) {
      candidate = raw.replace(/,/g, '');
    }

    if (/^\d+(\.\d+)?$/.test(candidate)) {
      const num = Number(candidate);
      if (Number.isFinite(num)) {
        return { value: num, valueRaw: raw };
      }
    }

    return { value: null, valueRaw: raw };
  }

  function parseInlinePairs(line) {
    const pairs = [];
    const keyRe = /^[A-Za-z][A-Za-z0-9 _-]*\s*:/;
    const len = line.length;
    let i = 0;

    const firstMatch = line.slice(i).match(keyRe);
    if (!firstMatch) return pairs;

    let key = firstMatch[0].replace(/:$/, '').trim();
    i += firstMatch[0].length;
    let valueStart = i;

    while (i < len) {
      const ch = line[i];

      if (ch === ',' || ch === ';') {
        let j = i + 1;
        while (j < len && /\s/.test(line[j])) j++;
        const rest = line.slice(j);
        const nextKey = rest.match(keyRe);

        if (nextKey) {
          const value = line.slice(valueStart, i).trim();
          pairs.push({ key, value });
          key = nextKey[0].replace(/:$/, '').trim();
          i = j + nextKey[0].length;
          valueStart = i;
          continue;
        }
      }

      i++;
    }

    const value = line.slice(valueStart).trim();
    pairs.push({ key, value });
    return pairs;
  }

  function parseDictionaryPairs(text) {
    const source = String(text || '');
    const lines = source.split(/\r?\n/);
    const pairs = [];

    for (const line of lines) {
      const stripped = stripListPrefix(line);
      if (!stripped) continue;
      if (/^#{1,6}\s/.test(stripped)) continue;

      const inline = parseInlinePairs(stripped);
      for (const p of inline) pairs.push(p);
    }

    return pairs;
  }

  function buildProjectFromBlock(blockLines, { startLine, sourcePath, sourceKind, sourceName }) {
    const fields = {};
    const extraFields = {};
    let name = '';

    for (let idx = 0; idx < blockLines.length; idx++) {
      const stripped = stripListPrefix(blockLines[idx]);
      if (!stripped) continue;
      if (/^#{1,6}\s/.test(stripped)) continue;

      const pairs = parseInlinePairs(stripped);

      for (let pIdx = 0; pIdx < pairs.length; pIdx++) {
        const pair = pairs[pIdx];
        const normalizedKey = normalizeProjectKey(pair.key);
        const canonical = resolveProjectKeyAlias(normalizedKey);
        const value = String(pair.value || '').trim();

        // The first pair on the starter line is the authoritative Project name.
        if (idx === 0 && pIdx === 0 && canonical === 'name') {
          name = value;
          continue;
        }

        // A later Name: pair must NOT rename the Project in MVP.
        // Preserve it as an extra field.
        if (canonical === 'name') {
          extraFields[normalizedKey] = value;
          continue;
        }

        if (canonical === 'value') {
          const parsed = parseProjectValue(value);
          fields.value = parsed.value;
          fields.valueRaw = parsed.valueRaw;
          continue;
        }

        if (canonical === 'currency') {
          fields.currency = value ? value.toUpperCase() : value;
          continue;
        }

        if (
          canonical === 'expectedOrder' ||
          canonical === 'expectedDelivery' ||
          canonical === 'expectedBilling'
        ) {
          fields[canonical] = normalizeProjectQuarter(value);
          continue;
        }

        if (canonical === 'status') {
          fields.status = value;
          continue;
        }

        if (canonical === 'description') {
          fields.description = value;
          continue;
        }

        // Unknown field — last-value-wins.
        extraFields[normalizedKey] = value;
      }
    }

    const project = {
      name,
      value: fields.value !== undefined ? fields.value : null,
      valueRaw: fields.valueRaw !== undefined ? fields.valueRaw : '',
      currency: fields.currency !== undefined ? fields.currency : '',
      status: fields.status !== undefined ? fields.status : '',
      expectedOrder: fields.expectedOrder || normalizeProjectQuarter(''),
      expectedDelivery: fields.expectedDelivery || normalizeProjectQuarter(''),
      expectedBilling: fields.expectedBilling || normalizeProjectQuarter(''),
      description: fields.description !== undefined ? fields.description : '',
      extraFields,
      sourcePath,
      sourceKind,
      sourceName,
      sourceLine: startLine,
    };

    // Provisional sourceIdentity — NOT a permanent ID.
    const nameKey = String(name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    project.sourceIdentity = `${sourcePath}::${startLine}::${nameKey}`;

    return project;
  }

  function parseProjects(markdownText, context = {}) {
    const text = String(markdownText || '');
    const lines = text.split(/\r?\n/);
    const projects = [];
    const sourcePath = context.path || '';
    const sourceKind = context.kind || '';
    const sourceName = context.name || '';
    const lineOffset = Number(context.lineOffset) || 0;
    const n = lines.length;
    let i = 0;

    while (i < n) {
      const stripped = stripListPrefix(lines[i]);
      const pairs = parseInlinePairs(stripped);
      const first = pairs[0];

      if (first && normalizeProjectKey(first.key) === 'project') {
        const name = String(first.value || '').trim();

        if (name) {
          const startLine = i + 1 + lineOffset;
          const blockLines = [lines[i]];
          let j = i + 1;

          // Collect block until: another Project:, a heading, or EOF.
          while (j < n) {
            const nextStripped = stripListPrefix(lines[j]);
            const nextPairs = parseInlinePairs(nextStripped);
            const nextFirst = nextPairs[0];

            if (nextFirst && normalizeProjectKey(nextFirst.key) === 'project') break;
            if (/^#{1,6}\s/.test(lines[j].trim())) break;

            blockLines.push(lines[j]);
            j++;
          }

          const project = buildProjectFromBlock(blockLines, {
            startLine,
            sourcePath,
            sourceKind,
            sourceName,
          });
          projects.push(project);
          i = j;
          continue;
        }
      }

      i++;
    }

    return projects;
  }

  function validateProjectFixtures() {
    const results = [];

    function check(label, actual, expected) {
      const pass = JSON.stringify(actual) === JSON.stringify(expected);
      results.push({ label, pass, actual, expected });
    }

    const ctx = { path: 'journals/a.md', kind: 'journals', name: 'a.md' };

    // 1. name-only
    {
      const projects = parseProjects('Project: Internal workflow', ctx);
      check('name-only count', projects.length, 1);
      check('name-only name', projects[0]?.name, 'Internal workflow');
      check('name-only value', projects[0]?.value, null);
      check('name-only order valid', projects[0]?.expectedOrder?.valid, false);
    }

    // 2. empty Project name
    {
      const projects = parseProjects('Project:\nValue: 50000', ctx);
      check('empty-name count', projects.length, 0);
    }

    // 3. compact inline
    {
      const projects = parseProjects(
        'Project: ByteDance CCTV, Value: 50000, Currency: usd, Order: 26q4',
        ctx
      );
      check('inline count', projects.length, 1);
      check('inline name', projects[0]?.name, 'ByteDance CCTV');
      check('inline value', projects[0]?.value, 50000);
      check('inline currency', projects[0]?.currency, 'USD');
      check('inline order canonical', projects[0]?.expectedOrder?.canonical, '2026-Q4');
      check('inline order display', projects[0]?.expectedOrder?.display, '26Q4');
    }

    // 4. multiline
    {
      const text = [
        'Project: ByteDance CCTV',
        'Value: 50000',
        'Currency: USD',
        'Order: 26Q4',
        'Delivery: 27Q1',
        'Billing: 27Q1',
        'Description: CCTV opportunity for the new facility.',
      ].join('\n');
      const projects = parseProjects(text, ctx);
      check('multiline count', projects.length, 1);
      check('multiline name', projects[0]?.name, 'ByteDance CCTV');
      check('multiline value', projects[0]?.value, 50000);
      check('multiline currency', projects[0]?.currency, 'USD');
      check('multiline order', projects[0]?.expectedOrder?.canonical, '2026-Q4');
      check('multiline delivery', projects[0]?.expectedDelivery?.canonical, '2027-Q1');
      check('multiline billing', projects[0]?.expectedBilling?.canonical, '2027-Q1');
      check(
        'multiline description',
        projects[0]?.description,
        'CCTV opportunity for the new facility.'
      );
    }

    // 5. bullet-pair
    {
      const text = [
        'Project: Alibaba Expansion',
        '',
        '- Value: 80000',
        '- Currency: USD',
        '- Order: 2026/Q3',
        '- Delivery: 26-Q4',
        '- Billing: 27Q1',
      ].join('\n');
      const projects = parseProjects(text, ctx);
      check('bullet count', projects.length, 1);
      check('bullet order', projects[0]?.expectedOrder?.canonical, '2026-Q3');
      check('bullet delivery', projects[0]?.expectedDelivery?.canonical, '2026-Q4');
      check('bullet billing', projects[0]?.expectedBilling?.canonical, '2027-Q1');
    }

    // 6. multiple Projects
    {
      const text = [
        'Project: First Project',
        'Order: 26Q1',
        '',
        'Project: Second Project',
        'Order: 26Q2',
      ].join('\n');
      const projects = parseProjects(text, ctx);
      check('multi count', projects.length, 2);
      check('multi first name', projects[0]?.name, 'First Project');
      check('multi first order', projects[0]?.expectedOrder?.canonical, '2026-Q1');
      check('multi second name', projects[1]?.name, 'Second Project');
      check('multi second order', projects[1]?.expectedOrder?.canonical, '2026-Q2');
    }

    // 7. blank lines inside Project
    {
      const text = [
        'Project: First Project',
        'Value: 100',
        '',
        'Description: Has blank lines',
      ].join('\n');
      const projects = parseProjects(text, ctx);
      check('blank count', projects.length, 1);
      check('blank value', projects[0]?.value, 100);
      check('blank description', projects[0]?.description, 'Has blank lines');
    }

    // 8. heading ends Project
    {
      const text = [
        'Project: First Project',
        'Value: 100',
        '',
        '## Notes',
        '',
        'Value: 999',
      ].join('\n');
      const projects = parseProjects(text, ctx);
      check('heading count', projects.length, 1);
      check('heading value', projects[0]?.value, 100);
    }

    // 9. comma inside Description
    {
      const text =
        'Project: CCTV Upgrade; Description: CCTV, access control, and monitoring; Value: 75000; Currency: USD';
      const projects = parseProjects(text, ctx);
      check('comma count', projects.length, 1);
      check('comma description', projects[0]?.description, 'CCTV, access control, and monitoring');
      check('comma value', projects[0]?.value, 75000);
    }

    // 10. unknown fields
    {
      const text = [
        'Project: New Opportunity',
        'Customer: Example Customer',
        'Country: Brazil',
        'Probability: 70',
      ].join('\n');
      const projects = parseProjects(text, ctx);
      check('unknown count', projects.length, 1);
      check('unknown customer', projects[0]?.extraFields?.customer, 'Example Customer');
      check('unknown country', projects[0]?.extraFields?.country, 'Brazil');
      check('unknown probability', projects[0]?.extraFields?.probability, '70');
    }

    // 11. value zero
    {
      const text = 'Project: Zero Value Test\nValue: 0\nCurrency: USD';
      const projects = parseProjects(text, ctx);
      check('zero value', projects[0]?.value, 0);
      check('zero currency', projects[0]?.currency, 'USD');
    }

    // 12. invalid value
    {
      const text = 'Project: Bad Value\nValue: abc';
      const projects = parseProjects(text, ctx);
      check('invalid value null', projects[0]?.value, null);
      check('invalid value raw', projects[0]?.valueRaw, 'abc');
    }

    // 13. all accepted quarter formats
    {
      const formats = [
        '26Q1',
        '26/Q1',
        '26-Q1',
        '2026Q1',
        '2026/Q1',
        '2026-Q1',
        '26q1',
        '26/q1',
        '26-q1',
        '2026q1',
        '2026/q1',
        '2026-q1',
      ];
      for (const fmt of formats) {
        const q = normalizeProjectQuarter(fmt);
        check(`quarter ${fmt} canonical`, q.canonical, '2026-Q1');
        check(`quarter ${fmt} display`, q.display, '26Q1');
        check(`quarter ${fmt} valid`, q.valid, true);
      }
    }

    // 14. invalid Q5
    {
      const q = normalizeProjectQuarter('26Q5');
      check('Q5 valid', q.valid, false);
      check('Q5 canonical', q.canonical, null);
    }

    // 15. lowercase quarter
    {
      const text = 'Project: Lower\nOrder: 26q1';
      const projects = parseProjects(text, ctx);
      check('lowercase order', projects[0]?.expectedOrder?.canonical, '2026-Q1');
    }

    // 16. missing Order producing Unscheduled later
    {
      const text = 'Project: No Order';
      const projects = parseProjects(text, ctx);
      check('no-order valid', projects[0]?.expectedOrder?.valid, false);
      check('no-order canonical', projects[0]?.expectedOrder?.canonical, null);
    }

    const failed = results.filter((r) => !r.pass);

    return {
      ok: failed.length === 0,
      total: results.length,
      passed: results.length - failed.length,
      failed: failed.length,
      results,
    };
  }

  function parseWorkspaceDocument({ kind, name, path, text }) {
    const normalizedText = normalizeParserText(text);
    const parsedFrontmatter = parseSimpleYamlFrontmatter(normalizedText);
    const offset = parsedFrontmatter.bodyLineOffset || 0;
    const frontmatterTags = normalizeFrontmatterTags(parsedFrontmatter.data?.tags);
    const headings = parseMarkdownHeadings(parsedFrontmatter.body).map((h) => ({ ...h, line: h.line + offset }));
    const tasks = parseMarkdownTasks(parsedFrontmatter.body).map((t) => ({ ...t, line: t.line + offset }));
    const bodyTags = parseMarkdownTags(parsedFrontmatter.body);
    const tags = Array.from(new Set([...(frontmatterTags || []), ...(bodyTags || [])])).sort();
    const conceptLinks = parseConceptLinks(parsedFrontmatter.body);
    const header = parseVisibleHeaderFields(parsedFrontmatter.body);
    const projects = parseProjects(parsedFrontmatter.body, {
      kind,
      name,
      path,
      lineOffset: offset,
    });

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
      projects,
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
    normalizeProjectKey,
    resolveProjectKeyAlias,
    normalizeProjectQuarter,
    parseProjectValue,
    parseDictionaryPairs,
    parseProjects,
    validateProjectFixtures,
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
    window.normalizeProjectKey = normalizeProjectKey;
    window.resolveProjectKeyAlias = resolveProjectKeyAlias;
    window.normalizeProjectQuarter = normalizeProjectQuarter;
    window.parseProjectValue = parseProjectValue;
    window.parseDictionaryPairs = parseDictionaryPairs;
    window.parseProjects = parseProjects;
    window.validateProjectFixtures = validateProjectFixtures;

    globalThis.parseSimpleYamlFrontmatter = parseSimpleYamlFrontmatter;
    globalThis.normalizeWorkspaceTagName = normalizeWorkspaceTagName;
    globalThis.isReservedWorkspaceTag = isReservedWorkspaceTag;
    globalThis.normalizeFrontmatterTags = normalizeFrontmatterTags;
    globalThis.parseMarkdownTags = parseMarkdownTags;
    globalThis.parseWorkspaceDocument = parseWorkspaceDocument;
    globalThis.normalizeProjectKey = normalizeProjectKey;
    globalThis.resolveProjectKeyAlias = resolveProjectKeyAlias;
    globalThis.normalizeProjectQuarter = normalizeProjectQuarter;
    globalThis.parseProjectValue = parseProjectValue;
    globalThis.parseDictionaryPairs = parseDictionaryPairs;
    globalThis.parseProjects = parseProjects;
    globalThis.validateProjectFixtures = validateProjectFixtures;
  } catch {}
})();
