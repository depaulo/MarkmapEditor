// @ts-nocheck
// Pure uncompressed Draw.io XML placeholder reconciler for the Report MVP.
// No DOM, file handles, UI state, or template mutation.

(function () {
  'use strict';

  const FORMAT_VERSION = 'mme-drawio-report-reconciler-v1';

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

  function normalizeFields(input) {
    const source = input && input.fields ? input.fields : input || {};
    const fields = {};
    const order = [];

    if (Array.isArray(source)) {
      for (const item of source) {
        const key = normalizeFieldName(item?.key || item?.name || item?.token);
        if (!key) continue;
        if (!Object.prototype.hasOwnProperty.call(fields, key)) order.push(key);
        fields[key] = {
          key,
          token: tokenFromFieldName(key),
          value: String(item?.value == null ? '' : item.value),
          source: item?.source || 'input',
        };
      }
      return { fields, order };
    }

    for (const [rawKey, rawValue] of Object.entries(source || {})) {
      const key = normalizeFieldName(rawKey.replace(/^\{\{|\}\}$/g, ''));
      if (!key) continue;
      if (!Object.prototype.hasOwnProperty.call(fields, key)) order.push(key);
      const value = rawValue && typeof rawValue === 'object' && 'value' in rawValue
        ? rawValue.value
        : rawValue;
      fields[key] = {
        key,
        token: tokenFromFieldName(key),
        value: String(value == null ? '' : value),
        source: rawValue?.source || 'input',
      };
    }

    return { fields, order };
  }

  function assessTemplateXml(xml) {
    const source = String(xml == null ? '' : xml);
    const diagnostics = [];

    if (!source.trim()) {
      diagnostics.push({ level: 'fatal', code: 'template-empty', message: 'Draw.io template XML is empty.' });
      return { ok: false, compressed: false, diagnostics };
    }

    const looksLikeXml = /^\s*<(mxfile|mxGraphModel)\b/i.test(source);
    if (!looksLikeXml) {
      diagnostics.push({
        level: 'fatal',
        code: 'template-not-xml',
        message: 'The first MVP requires uncompressed Draw.io XML.',
      });
    }

    const compressedDiagram = /<diagram\b[^>]*>\s*[^<\s][\s\S]*?<\/diagram>/i.test(source);
    if (compressedDiagram && !/<mxGraphModel\b/i.test(source)) {
      diagnostics.push({
        level: 'fatal',
        code: 'template-compressed',
        message: 'Compressed Draw.io templates are not supported in the first MVP. Save the template as uncompressed XML.',
      });
    }

    return {
      ok: !diagnostics.some((item) => item.level === 'fatal'),
      compressed: compressedDiagram && !/<mxGraphModel\b/i.test(source),
      diagnostics,
    };
  }

  function extractPlaceholders(xml) {
    const source = String(xml == null ? '' : xml);
    const placeholders = [];
    const seen = new Set();
    const regex = /\{\{\s*([^{}]+?)\s*\}\}/g;
    let match;

    while ((match = regex.exec(source)) !== null) {
      const key = normalizeFieldName(match[1]);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      placeholders.push({
        key,
        token: tokenFromFieldName(key),
        rawToken: match[0],
        order: placeholders.length,
      });
    }

    return placeholders;
  }

  function reconcile(templateXml, fieldInput) {
    const assessment = assessTemplateXml(templateXml);
    const placeholders = extractPlaceholders(templateXml);
    const normalized = normalizeFields(fieldInput);
    const fields = normalized.fields;
    const placeholderKeys = new Set(placeholders.map((item) => item.key));
    const matched = [];
    const missingValues = [];
    const unknownPlaceholders = [];
    const unusedFields = [];

    for (const placeholder of placeholders) {
      const field = fields[placeholder.key];
      if (!field) {
        unknownPlaceholders.push({ ...placeholder });
      } else if (!String(field.value || '').trim()) {
        missingValues.push({ placeholder: { ...placeholder }, field: { ...field } });
      } else {
        matched.push({ placeholder: { ...placeholder }, field: { ...field } });
      }
    }

    for (const key of normalized.order) {
      if (!placeholderKeys.has(key)) unusedFields.push({ ...fields[key] });
    }

    return {
      ok: assessment.ok,
      formatVersion: FORMAT_VERSION,
      placeholders,
      fields,
      fieldOrder: normalized.order,
      matched,
      missingValues,
      unknownPlaceholders,
      unusedFields,
      diagnostics: assessment.diagnostics.slice(),
    };
  }

  function buildMissingTemplateFieldsMarkdown(reconciliation) {
    const keys = [];
    const seen = new Set();
    const add = (key) => {
      const normalized = normalizeFieldName(key);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      keys.push(normalized);
    };

    for (const item of reconciliation?.unknownPlaceholders || []) add(item.key);
    for (const item of reconciliation?.missingValues || []) add(item.field?.key || item.placeholder?.key);

    if (!keys.length) return '';

    return [
      '## Template Fields',
      '',
      ...keys.map((key) => `${tokenFromFieldName(key)}:`),
    ].join('\n');
  }

  function escapeXmlReplacement(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
      .replace(/\r\n|\r|\n/g, '&#xa;');
  }

  function populateTemplate(templateXml, fieldInput, options = {}) {
    const source = String(templateXml == null ? '' : templateXml);
    const reconciliation = reconcile(source, fieldInput);

    if (!reconciliation.ok) {
      return {
        ok: false,
        xml: source,
        reconciliation,
        diagnostics: reconciliation.diagnostics.slice(),
      };
    }

    const replaceBlank = options.replaceBlank === true;
    let output = source;

    for (const placeholder of reconciliation.placeholders) {
      const field = reconciliation.fields[placeholder.key];
      if (!field) continue;
      const rawValue = String(field.value == null ? '' : field.value);
      if (!rawValue.trim() && !replaceBlank) continue;
      const escaped = escapeXmlReplacement(rawValue);
      const pattern = new RegExp(`\\{\\{\\s*${escapeRegExp(placeholder.key).replace(/\\ /g, '\\s+')}\\s*\\}\\}`, 'gi');
      output = output.replace(pattern, escaped);
    }

    return {
      ok: true,
      xml: output,
      reconciliation,
      diagnostics: reconciliation.diagnostics.slice(),
    };
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function validateDrawioReportReconciler() {
    const cases = [];
    const check = (name, actual, expected) => {
      const pass = JSON.stringify(actual) === JSON.stringify(expected);
      cases.push({ name, pass, actual, expected });
    };

    const xml = [
      '<mxfile host="app.diagrams.net">',
      '<diagram name="Page-1">',
      '<mxGraphModel><root>',
      '<mxCell id="0"/>',
      '<mxCell id="1" parent="0"/>',
      '<mxCell id="2" value="{{ Summary }}" vertex="1" parent="1"/>',
      '<mxCell id="3" value="{{customer}}" vertex="1" parent="1"/>',
      '<mxCell id="4" value="{{regional risk}}" vertex="1" parent="1"/>',
      '</root></mxGraphModel>',
      '</diagram>',
      '</mxfile>',
    ].join('');

    const fields = {
      summary: { value: 'Main activity' },
      customer: { value: '' },
      'unused field': { value: 'Keep me in Markdown' },
    };

    const result = reconcile(xml, fields);
    check('template accepted', result.ok, true);
    check('placeholder normalization', result.placeholders.map((item) => item.key), ['summary', 'customer', 'regional risk']);
    check('matched', result.matched.map((item) => item.field.key), ['summary']);
    check('missing value', result.missingValues.map((item) => item.field.key), ['customer']);
    check('unknown placeholder', result.unknownPlaceholders.map((item) => item.key), ['regional risk']);
    check('unused field', result.unusedFields.map((item) => item.key), ['unused field']);

    const missing = buildMissingTemplateFieldsMarkdown(result);
    check(
      'missing markdown',
      missing,
      ['## Template Fields', '', '{{regional risk}}:', '{{customer}}:'].join('\n')
    );

    const populated = populateTemplate(xml, fields);
    check('population succeeds', populated.ok, true);
    check('summary replaced', populated.xml.includes('value="Main activity"'), true);
    check('blank preserved', populated.xml.includes('{{customer}}'), true);
    check('unknown preserved', populated.xml.includes('{{regional risk}}'), true);

    const compressed = assessTemplateXml('<mxfile><diagram>abc123</diagram></mxfile>');
    check('compressed rejected', compressed.ok, false);

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
    normalizeFieldName,
    tokenFromFieldName,
    normalizeFields,
    assessTemplateXml,
    extractPlaceholders,
    reconcile,
    buildMissingTemplateFieldsMarkdown,
    populateTemplate,
    validateDrawioReportReconciler,
  });

  try {
    globalThis.MME_DRAWIO_REPORT_RECONCILER = API;
    if (typeof window !== 'undefined') window.MME_DRAWIO_REPORT_RECONCILER = API;
  } catch {}
})();
