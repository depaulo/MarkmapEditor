// @ts-nocheck
// Pure reviewed Report Markdown importer for the Draw.io Report MVP.
// No DOM, file handles, workspace scan, or source mutation.

(function () {
  'use strict';

  const FORMAT_VERSION = 'mme-reviewed-report-import-v1';

  const SECTION_FIELD_MAP = Object.freeze({
    summary: 'summary',
    highlights: 'highlights',
    'completed tasks': 'completed tasks',
    'project forecast': 'project forecast',
    'forecast totals': 'forecast totals',
    'risks and attention points': 'risks',
    risks: 'risks',
    'next steps': 'next steps',
    'management notes': 'management notes',
    'completed tasks without date': 'completed tasks without date',
    'template fields': 'template fields',
  });

  function normalizeFieldName(value) {
    return String(value == null ? '' : value)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  function tokenFromFieldName(value) {
    const name = normalizeFieldName(value);
    return name ? `{{${name}}}` : '';
  }

  function parseScalar(value) {
    const source = String(value == null ? '' : value).trim();
    if (!source) return '';
    const quoted = source.match(/^(["'])([\s\S]*)\1$/);
    return quoted ? quoted[2] : source;
  }

  function parseLeadingFrontmatter(markdown) {
    const source = String(markdown == null ? '' : markdown);
    const result = {
      found: false,
      valid: true,
      metadata: {},
      body: source,
      raw: '',
      diagnostics: [],
    };

    if (!source.startsWith('---')) return result;

    const lines = source.split(/\r?\n/);
    if (lines[0].trim() !== '---') return result;

    let closingIndex = -1;
    for (let i = 1; i < lines.length; i += 1) {
      if (lines[i].trim() === '---') {
        closingIndex = i;
        break;
      }
    }

    result.found = true;

    if (closingIndex < 0) {
      result.valid = false;
      result.diagnostics.push({
        level: 'fatal',
        code: 'frontmatter-unclosed',
        message: 'Leading frontmatter does not have a closing delimiter.',
      });
      return result;
    }

    const metadata = {};
    for (let i = 1; i < closingIndex; i += 1) {
      const line = lines[i];
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const match = line.match(/^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/);
      if (!match) {
        result.diagnostics.push({
          level: 'warning',
          code: 'frontmatter-line-ignored',
          message: `Frontmatter line ${i + 1} was not imported.`,
        });
        continue;
      }
      metadata[normalizeFieldName(match[1]).replace(/\s+/g, '_')] = parseScalar(match[2]);
    }

    result.metadata = metadata;
    result.raw = lines.slice(0, closingIndex + 1).join('\n');
    result.body = lines.slice(closingIndex + 1).join('\n').replace(/^\r?\n/, '');
    return result;
  }

  function splitSections(body) {
    const source = String(body == null ? '' : body);
    const lines = source.split(/\r?\n/);
    const sections = [];
    let title = '';
    let current = null;

    for (const line of lines) {
      const h1 = line.match(/^#\s+(.+?)\s*$/);
      if (h1 && !title) {
        title = h1[1].trim();
        continue;
      }

      const h2 = line.match(/^##\s+(.+?)\s*$/);
      if (h2) {
        if (current) {
          current.markdown = current.lines.join('\n').replace(/^\s+|\s+$/g, '');
          delete current.lines;
          sections.push(current);
        }
        const heading = h2[1].trim();
        current = {
          heading,
          id: normalizeFieldName(heading),
          lines: [],
          order: sections.length,
        };
        continue;
      }

      if (current) current.lines.push(line);
    }

    if (current) {
      current.markdown = current.lines.join('\n').replace(/^\s+|\s+$/g, '');
      delete current.lines;
      sections.push(current);
    }

    return { title, sections };
  }

  function parseTokenLines(markdown) {
    const source = String(markdown == null ? '' : markdown);
    const fields = {};
    const fieldOrder = [];
    const diagnostics = [];
    // Token lines take the exact form {{field name}}: value with one token per
    // line. Parsing line-by-line (instead of a multiline /g regex) prevents
    // \s* and [^{}] from spanning newlines, which otherwise corrupts values
    // when a blank token line precedes another token line (e.g. {{region}}:
    // followed by {{ali summary}}: value).
    const tokenRe = /^\s*\{\{\s*([^{}\r\n]+?)\s*\}\}\s*:\s*(.*)$/;
    const lines = source.split(/\r?\n/);

    for (const line of lines) {
      const match = tokenRe.exec(line);
      if (!match) continue;
      const key = normalizeFieldName(match[1]);
      if (!key) continue;
      const value = String(match[2] == null ? '' : match[2]).trim();
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        diagnostics.push({
          level: 'warning',
          code: 'duplicate-field',
          field: key,
          message: `Duplicate field ${tokenFromFieldName(key)} found; last value wins.`,
        });
      } else {
        fieldOrder.push(key);
      }
      fields[key] = {
        key,
        token: tokenFromFieldName(key),
        value,
        source: 'token',
      };
    }

    return { fields, fieldOrder, diagnostics };
  }

  function addField(fields, fieldOrder, key, value, source, options = {}) {
    const normalizedKey = normalizeFieldName(key);
    if (!normalizedKey) return;
    const text = String(value == null ? '' : value).trim();
    const exists = Object.prototype.hasOwnProperty.call(fields, normalizedKey);

    if (exists && !options.overwrite) return;
    if (!exists) fieldOrder.push(normalizedKey);

    fields[normalizedKey] = {
      key: normalizedKey,
      token: tokenFromFieldName(normalizedKey),
      value: text,
      source,
    };
  }

  function importReviewedReport(markdown) {
    const sourceMarkdown = String(markdown == null ? '' : markdown);
    const frontmatter = parseLeadingFrontmatter(sourceMarkdown);
    const split = splitSections(frontmatter.body);
    const tokenResult = parseTokenLines(frontmatter.body);
    const fields = { ...tokenResult.fields };
    const fieldOrder = tokenResult.fieldOrder.slice();
    const diagnostics = frontmatter.diagnostics.concat(tokenResult.diagnostics);

    if (split.title) addField(fields, fieldOrder, 'title', split.title, 'heading', { overwrite: false });

    for (const section of split.sections) {
      const mapped = SECTION_FIELD_MAP[section.id];
      if (!mapped || mapped === 'template fields') continue;
      addField(fields, fieldOrder, mapped, section.markdown, 'section', { overwrite: false });
    }

    const type = normalizeFieldName(frontmatter.metadata.type || '');
    const isReport = frontmatter.found && frontmatter.valid && type === 'report';

    if (!frontmatter.found) {
      diagnostics.push({
        level: 'fatal',
        code: 'report-frontmatter-missing',
        message: 'Reviewed Report Markdown requires leading frontmatter.',
      });
    } else if (frontmatter.valid && type !== 'report') {
      diagnostics.push({
        level: 'fatal',
        code: 'report-type-missing',
        message: 'Leading frontmatter must contain type: report.',
      });
    }

    return {
      ok: isReport && !diagnostics.some((item) => item.level === 'fatal'),
      formatVersion: FORMAT_VERSION,
      metadata: { ...frontmatter.metadata },
      title: split.title,
      fields,
      fieldOrder,
      sections: split.sections.map((section) => ({ ...section })),
      sourceMarkdown,
      diagnostics,
    };
  }

  function isReportMarkdown(markdown) {
    const frontmatter = parseLeadingFrontmatter(markdown);
    return Boolean(
      frontmatter.found &&
        frontmatter.valid &&
        normalizeFieldName(frontmatter.metadata.type || '') === 'report'
    );
  }

  // Build a sanitized representative Reviewed Report mirroring the current
  // Quick Report generator output structure (frontmatter + H1 title +
  // **Period:** paragraph + standard sections + Template Fields). No real
  // customer content is included.
  function buildRealReportFixture() {
    return [
      '---',
      'type: report',
      'period_start: 2026-08-24',
      'period_end: 2026-08-30',
      'generated: 2026-08-31',
      'project_scope: all',
      '---',
      '',
      '# Weekly Business Report',
      '',
      '**Period:** 2026-08-24 to 2026-08-30',
      '',
      '## Summary',
      '',
      'Reviewed summary text.',
      '',
      '## Highlights',
      '',
      'Highlight one; highlight two.',
      '',
      '## Completed Tasks',
      '',
      '- Delivered task A.',
      '- Delivered task B.',
      '',
      '## Project Forecast',
      '',
      'Forecast heading content.',
      '',
      '## Forecast Totals',
      '',
      '| Column | Total |',
      '|---|---|---|',
      '| A | 10 |',
      '',
      '## Risks and Attention Points',
      '',
      'Risk item.',
      '',
      '## Next Steps',
      '',
      'Next action.',
      '',
      '## Management Notes',
      '',
      'Manager note.',
      '',
      '## Completed Tasks Without Date',
      '',
      '- Undated task.',
      '',
      '## Template Fields',
      '',
      '{{customer}}: Alibaba',
      '{{region}}:',
      '{{ali summary}}: Manual account update',
      '{{customer decision}}:',
    ].join('\n');
  }

  function validateReportMarkdownImport() {
    const cases = [];
    const check = (name, actual, expected) => {
      const pass = JSON.stringify(actual) === JSON.stringify(expected);
      cases.push({ name, pass, actual, expected });
    };

    const sample = [
      '---',
      'type: report',
      'period_start: 2026-08-24',
      'period_end: 2026-08-30',
      '---',
      '',
      '# Weekly Review',
      '',
      '## Summary',
      '',
      'Reviewed summary.',
      '',
      '## Next Steps',
      '',
      'Complete technical review.',
      '',
      '## Template Fields',
      '',
      '{{ Customer }}: Alibaba',
      '{{ali   summary}}: Manual account summary',
      '{{regional risk}}:',
    ].join('\n');

    const imported = importReviewedReport(sample);
    const real = importReviewedReport(buildRealReportFixture());

    // --- 1. Recognition / rejection ---
    check('1 valid type:report recognition', isReportMarkdown(sample), true);
    const noFront = '# Note\n\nPlain note body.';
    check('2 missing frontmatter rejected (is)', isReportMarkdown(noFront), false);
    const noFrontImport = importReviewedReport(noFront);
    check('2b missing frontmatter rejected (import.ok)', noFrontImport.ok, false);
    check(
      '2c missing frontmatter fatal diagnostic',
      noFrontImport.diagnostics.some((d) => d.code === 'report-frontmatter-missing'),
      true
    );
    check('3 unclosed frontmatter rejected', importReviewedReport('---\ntype: report\n').ok, false);
    const nonReport = '---\ntype: note\n---\n\n# Not a report\n';
    check('4 non-report type rejected', importReviewedReport(nonReport).ok, false);

    // --- 5. metadata + 6. title ---
    check('5 metadata period_start', imported.metadata.period_start, '2026-08-24');
    check('5b metadata project_scope/all on fixture', real.metadata.project_scope, 'all');
    check('6 first H1 title', imported.title, 'Weekly Review');

    // --- 7-15. per-section mapping ---
    const secChecks = [
      ['summary', 'Reviewed summary text.'],
      ['highlights', 'Highlight one; highlight two.'],
      ['completed tasks', '- Delivered task A.\n- Delivered task B.'],
      ['project forecast', 'Forecast heading content.'],
      ['forecast totals', '| Column | Total |\n|---|---|---|\n| A | 10 |'],
      ['risks', 'Risk item.'],
      ['next steps', 'Next action.'],
      ['management notes', 'Manager note.'],
      ['completed tasks without date', '- Undated task.'],
    ];
    for (const [key, expected] of secChecks) {
      check('section ' + key, real.fields[key]?.value, expected);
    }

    // --- 16. Template Fields extraction ---
    check('16 template fields heading preserved', real.sections.some((s) => s.id === 'template fields'), true);
    check('16b template field extracted', real.fields.customer?.value, 'Alibaba');

    // --- 17. custom token field ---
    check('17 custom token field', real.fields['ali summary']?.value, 'Manual account update');

    // --- 18. blank custom token field ---
    check('18 blank custom token preserved', real.fields.region?.value, '');
    check('18b blank customer decision preserved', real.fields['customer decision']?.value, '');

    // --- 19. token case normalization ---
    check('19 token key normalized', imported.fields.customer?.key, 'customer');
    check('19b token value read', imported.fields.customer?.value, 'Alibaba');

    // --- 20. repeated-space normalization ---
    check('20 repeated space normalized', imported.fields['ali summary']?.token, '{{ali summary}}');

    // --- 21. deterministic field order ---
    const repeatedOrder = importReviewedReport(buildRealReportFixture());
    check('21a field order present', real.fieldOrder.length > 0, true);
    check('21b field order deterministic', JSON.stringify(real.fieldOrder), JSON.stringify(repeatedOrder.fieldOrder));

    // --- 22. duplicate explicit token diagnostic ---
    const dupMd = [
      '---', 'type: report', '---', '',
      '# Dup', '',
      '## Template Fields', '',
      '{{customer}}: First',
      '{{customer}}: Second',
    ].join('\n');
    const dupImport = importReviewedReport(dupMd);
    check('22 duplicate-field warning', dupImport.diagnostics.some((d) => d.code === 'duplicate-field'), true);

    // --- 23. duplicate precedence ---
    check('23 last duplicate value wins', dupImport.fields.customer?.value, 'Second');

    // --- 24. explicit token precedence over section-derived ---
    const tokenBeatsSection =
      '---\ntype: report\n---\n\n' +
      '# T\n\n' +
      '## Summary\n\nSection text.\n\n' +
      '## Template Fields\n\n{{summary}}: Manual overrides section.\n';
    const preImport = importReviewedReport(tokenBeatsSection);
    check('24 token precedence', preImport.fields.summary?.value, 'Manual overrides section.');

    // --- 25. unknown H2 section preservation ---
    const unknownSections = importReviewedReport(buildRealReportFixture() + '\n\n## Custom Blob\n\nCustom content.\n');
    check('25 unknown section preserved', unknownSections.sections.some((s) => s.id === 'custom blob'), true);

    // --- 26. source Markdown not mutated ---
    check('26 sourceMarkdown equals input', real.sourceMarkdown, buildRealReportFixture());

    // --- 27. returned projection shares no mutable source objects ---
    const proj = importReviewedReport(sample);
    proj.fields.summary = { key: 'summary', token: '{{summary}}', value: 'mutated', source: 'token' };
    const reImport = importReviewedReport(sample);
    check('27 projection isolation', reImport.fields.summary?.value, 'Reviewed summary.');

    // --- 28. repeated import produces equivalent output ---
    check('28 repeated import equivalent', JSON.stringify(importReviewedReport(sample)), JSON.stringify(importReviewedReport(sample)));

    // --- 29. sanitized real ACT G Report sample imports ---
    check('29 sanitized real report imports ok', real.ok, true);
    check('29b real report formatVersion', real.formatVersion, FORMAT_VERSION);

    // --- 30. ordinary external Markdown is not a Report ---
    check('30 ordinary markdown not classified', isReportMarkdown('text without any report frontmatter'), false);
    check('30b external doc rejected', importReviewedReport('# Medical Journal\n\nno frontmatter').ok, false);

    const failed = cases.filter((item) => !item.pass);
    return {
      ok: failed.length === 0,
      total: cases.length,
      passed: cases.length - failed.length,
      failed: failed.length,
      cases,
    };
  }

  const API = Object.freeze({
    FORMAT_VERSION,
    SECTION_FIELD_MAP,
    normalizeFieldName,
    tokenFromFieldName,
    parseLeadingFrontmatter,
    splitSections,
    parseTokenLines,
    importReviewedReport,
    isReportMarkdown,
    validateReportMarkdownImport,
  });

  try {
    globalThis.MME_REPORT_MARKDOWN_IMPORT = API;
    if (typeof window !== 'undefined') window.MME_REPORT_MARKDOWN_IMPORT = API;
  } catch {}
})();
