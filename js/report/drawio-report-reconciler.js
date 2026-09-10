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

  // ACT H4.1 — narrow assessment normalization. The original template string
  // is never mutated; this view is used only for the Draw.io root and
  // compression checks. Removes from the internal view only: one optional
  // UTF-8 BOM, optional leading whitespace, and ONE valid leading XML
  // declaration (version 1.0, optional encoding, double or single quoted)
  // plus the whitespace after it. Arbitrary processing instructions, malformed
  // declarations, and declarations appearing after other content are NOT
  // removed. extractPlaceholders/reconcile/populateTemplate keep reading the
  // ORIGINAL source; the declaration remains present in populated output.
  const XML_DECLARATION_RE =
    /^<\?xml\s+version\s*=\s*(?:"1\.0"|'1\.0')(?:\s+encoding\s*=\s*(?:"[A-Za-z][A-Za-z0-9._-]*"|'[A-Za-z][A-Za-z0-9._-]*'))?\s*\?>/;

  function normalizedAssessmentView(source) {
    let view = String(source == null ? '' : source).replace(/^\uFEFF/, '');
    view = view.replace(/^\s+/, '');
    if (XML_DECLARATION_RE.test(view)) {
      view = view.replace(XML_DECLARATION_RE, '').replace(/^\s+/, '');
    }
    return view;
  }

  function assessTemplateXml(xml) {
    const source = String(xml == null ? '' : xml);
    const diagnostics = [];

    if (!source.trim()) {
      diagnostics.push({ level: 'fatal', code: 'template-empty', message: 'Draw.io template XML is empty.' });
      return { ok: false, compressed: false, diagnostics };
    }

    // Root and compression checks run on the normalized assessment view so
    // BOM-led, whitespace-led, and XML-declaration-led uncompressed Draw.io
    // XML are assessed correctly. The original input is never mutated.
    const view = normalizedAssessmentView(source);

    const looksLikeXml = /^<(mxfile|mxGraphModel)\b/i.test(view);
    if (!looksLikeXml) {
      diagnostics.push({
        level: 'fatal',
        code: 'template-not-xml',
        message: 'The first MVP requires uncompressed Draw.io XML.',
      });
      return { ok: false, compressed: false, diagnostics };
    }

    const compressedDiagram = /<diagram\b[^>]*>\s*[^<\s][\s\S]*?<\/diagram>/i.test(view);
    if (compressedDiagram && !/<mxGraphModel\b/i.test(view)) {
      diagnostics.push({
        level: 'fatal',
        code: 'template-compressed',
        message: 'Compressed Draw.io templates are not supported in the first MVP. Save the template as uncompressed XML.',
      });
    }

    return {
      ok: !diagnostics.some((item) => item.level === 'fatal'),
      compressed: compressedDiagram && !/<mxGraphModel\b/i.test(view),
      diagnostics,
    };
  }

  function extractPlaceholders(xml) {
    const source = String(xml == null ? '' : xml);
    const regex = /\{\{\s*([^{}]+?)\s*\}\}/g;
    let match;
    const counts = Object.create(null);
    const firstSeen = [];
    const rawTokens = Object.create(null);

    while ((match = regex.exec(source)) !== null) {
      const key = normalizeFieldName(match[1]);
      if (!key) continue;
      counts[key] = (counts[key] || 0) + 1;
      if (!rawTokens[key]) rawTokens[key] = match[0];
      if (counts[key] === 1) firstSeen.push(key);
    }

    return firstSeen.map((key, index) => ({
      key,
      token: tokenFromFieldName(key),
      rawToken: rawTokens[key],
      occurrences: counts[key],
      order: index,
    }));
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
    const placeholders = reconciliation?.placeholders || [];
    const unknownKeys = new Set(
      (reconciliation?.unknownPlaceholders || []).map((item) => item.key)
    );
    const missingKeys = new Set(
      (reconciliation?.missingValues || []).map(
        (item) => item.field?.key || item.placeholder?.key
      )
    );

    const keys = [];
    const seen = new Set();
    for (const placeholder of placeholders) {
      const key = placeholder.key;
      if (!unknownKeys.has(key) && !missingKeys.has(key)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      keys.push(key);
    }

    if (!keys.length) return '';

    return [
      '## Template Fields',
      '',
      ...keys.map((key) => `${tokenFromFieldName(key)}:`)
    ].join(
      '\n'
    );
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

    // Markdown-in-HTML-cells path — occurrence-aware, html=1 formatted cells.
    // Enabled by the explicit true option (production passes it). The plain
    // default (no option) stays intact for the public API.
    if (options.formatMarkdownForHtmlCells === true) {
      output = populateWithMarkdownHtml(source, reconciliation.fields, replaceBlank);
      return {
        ok: true,
        xml: output,
        reconciliation,
        diagnostics: reconciliation.diagnostics.slice(),
      };
    }

    for (const placeholder of reconciliation.placeholders) {
      const field = reconciliation.fields[placeholder.key];
      if (!field) continue;
      const rawValue = String(field.value == null ? '' : field.value);
      if (!rawValue.trim() && !replaceBlank) continue;
      const escaped = escapeXmlReplacement(rawValue);
      const pattern = new RegExp(`\\{\\{\\s*${escapeRegExp(placeholder.key).replace(/ /g, '\\s+')}\\s*\\}\\}`, 'gi');
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

  // =====================================================================
  // ACT B — Pure restricted Markdown value → Draw.io HTML fragment.
  // Emits only a small safe subset (div, br, strong, em, ul, ol, li), never
  // attributes, never p/b/i/code/a/style/class/id. Any unsupported block
  // construct, raw HTML, or ambiguity causes whole-field plain fallback.
  // =====================================================================
  function escapeHtmlInlineText(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // Returns an unsupported reason (string) or null when the whole field may
  // proceed to formatting. Detects any construct outside the approved subset.
  function detectFragmentUnsupported(value) {
    const s = String(value == null ? '' : value);
    if (!s.trim()) return null;
    for (const line of s.split(/\r?\n/)) {
      if (/<\/?[a-zA-Z][^>]*>/.test(line)) return 'raw-html';
      if (line.includes('\u0060')) return 'code';
      if (/^[ \t]{0,3}#{1,6}\s/.test(line)) return 'heading';
      if (/^[ \t]*>[ \t]/.test(line)) return 'blockquote';
      if (/^[ \t]*[-*]\s+\[[ xX]\]/.test(line)) return 'task-checkbox';
      if (line.includes('|')) return 'table';
      if (/!\[[^\]]*]\([^)]*\)/.test(line)) return 'image';
      if (/\[[^\]]+\]\([^)]*\)/.test(line)) return 'link';
      if (/^[ \t]{2,}\S/.test(line)) return 'indented-or-nested';
      if (/\\[*_#]/.test(line)) return 'escaped-marker';
    }
    return null;
  }

  // Whether the value contains at least one supported formatting structure.
  function fragmentHasFormatting(value) {
    const s = String(value == null ? '' : value);
    if (/\n\s*\n/.test(s)) return true; // multiple paragraphs
    if (/[ \t]{2,}\n/.test(s)) return true; // hard break
    if (/\*\*[^*]+\*\*/.test(s)) return true; // bold
    if (/(^|[^\w*])\*[^*]+?\*(?![\w*])/.test(s)) return true; // asterisk-italic
    if (/(^|[^\w_])_[^_]+_(?![\w_])/.test(s)) return true; // underscore-italic
    if (/^[ \t]*([-+]|\d{1,3}\.)[ \t]+\S/m.test(s)) return true; // list
    return false;
  }

  // Conservative inline emphasis renderer -> produces literal tags + raw text.
  function renderInline(value) {
    let t = String(value == null ? '' : value);
    t = t.replace(/\*\*\*[^*]+\*\*\*/g, (m) => '<strong><em>' + m.slice(3, m.length - 3) + '</em></strong>');
    t = t.replace(/\*\*[^*]+\*\*/g, (m) => '<strong>' + m.slice(2, m.length - 2) + '</strong>');
    t = t.replace(/(^|[^\w*])\*([^*]+)\*(?![\w*])/g, '$1<em>$2</em>');
    t = t.replace(/(^|[^\w_])_([^_]+)_(?![\w_])/g, '$1<em>$2</em>');
    return t;
  }

  // Escape only text portions of a string already containing literal tags,
  // leaving the allowed tags themselves unescaped.
  function escapeFragmentText(htmlWithTags) {
    const parts = String(htmlWithTags).split(/(<[^>]+>)/);
    return parts.map((p, i) => (i % 2 === 1 ? p : escapeHtmlInlineText(p))).join('');
  }

  function renderParagraph(lines) {
    const parts = [];
    for (let i = 0; i < lines.length; i += 1) {
      const hard = /[ \t]{2,}$/.test(lines[i]);
      const line = lines[i].replace(/[ \t]{2,}$/, '').replace(/^\s+/, '').trim();
      parts.push(renderInline(line));
      if (i < lines.length - 1) parts.push(hard ? '<br>' : ' ');
    }
    const inner = parts.join('');
    return inner ? `<div>${inner}</div>` : '';
  }

  function emitList(lines) {
    const first = String(lines[0] || '').trim();
    const ordered = /^\s*\d{1,3}\.\s/.test(first);
    const items = lines.map((line) => {
      const m = String(line).match(/^[ \t]*([-+]|\d{1,3}\.)[ \t]+(.*)$/);
      const content = m ? m[2] : String(line);
      return `<li>${renderInline(String(content).trim())}</li>`;
    }).join('');
    return ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
  }

  function isListItem(line) {
    return /^[ \t]*([-+]|\d{1,3}\.)[ \t]+\S/.test(String(line));
  }

  function buildFragment(value) {
    const s = String(value == null ? '' : value).replace(/\r\n/g, '\n');
    const lines = s.split('\n');
    const blocks = [];
    let cur = [];
    for (const ln of lines) {
      if (ln.trim() === '') {
        if (cur.length) { blocks.push(cur); cur = []; }
      } else {
        cur.push(ln);
      }
    }
    if (cur.length) blocks.push(cur);

    const frags = [];
    for (const block of blocks) {
      let html = '';
      let i = 0;
      while (i < block.length) {
        if (isListItem(block[i])) {
          const items = [];
          while (i < block.length && isListItem(block[i])) { items.push(block[i]); i += 1; }
          html += emitList(items);
        } else {
          const para = [];
          while (i < block.length && !isListItem(block[i])) { para.push(block[i]); i += 1; }
          html += renderParagraph(para);
        }
      }
      frags.push(html);
    }
    return frags.join('');
  }

  // Public converter. Returns { ok:true, html } for formatted output, or
  // { ok:false, reason } for plain fallback.
  function convertMarkdownToHtmlFragment(value) {
    const raw = String(value == null ? '' : value);
    if (!raw.trim()) return { ok: false, reason: 'empty' };
    const unsupported = detectFragmentUnsupported(raw);
    if (unsupported) return { ok: false, reason: unsupported };
    if (!fragmentHasFormatting(raw)) return { ok: false, reason: 'plain' };
    let html;
    try {
      html = escapeFragmentText(buildFragment(raw));
    } catch (e) {
      return { ok: false, reason: 'conversion-error' };
    }
    if (!html || !html.trim()) return { ok: false, reason: 'empty-fragment' };
    return { ok: true, html };
  }

  // =====================================================================
  // Markdown-in-HTML-cells population (production path for
  // formatMarkdownForHtmlCells: true). Scans each <mxCell ...> opening tag,
  // reads its style for the exact `html=1` token, and replaces placeholders
  // only inside the value attribute. Everything else stays byte-identical.
  // A placeholder in a non-html cell or in a non-value attribute falls back
  // to the existing plain replacement or is left untouched as appropriate.
  // =====================================================================
  function hasHtmlCellEligibility(style) {
    const tokens = String(style == null ? '' : style).split(';');
    for (const tok of tokens) {
      const t = tok.trim();
      if (t === 'html=1') return true;
      if (t.startsWith('html=') && t !== 'html=1') return false;
    }
    return false;
  }

  // Reads attributes of an mxCell opening-tag string.
  // Returns [{ name, content, contentStartAbs, contentEndAbs }] where the
  // content offsets are relative to the start of the tag substring (inside
  // the surrounding quotes).
  function scanCellAttrs(tag) {
    const attrs = [];
    const attrRe = /([A-Za-z_:][A-Za-z0-9_.:-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let mm;
    while ((mm = attrRe.exec(tag))) {
      const whole = mm[0];
      const eqIdx = whole.indexOf('=');
      const quoteChar = whole[eqIdx + 1];
      const content = mm[3] != null ? mm[3] : mm[4];
      const contentStartAbs = mm.index + eqIdx + 2;
      const contentEndAbs = mm.index + whole.length - 1;
      attrs.push({ name: mm[1], content, contentStartAbs, contentEndAbs, quoteChar });
    }
    return attrs;
  }

  function replaceValueInner(inner, fields, eligible, replaceBlank) {
    const tokenRe = /\{\{\s*([^{}]+?)\s*\}\}/g;
    return String(inner).replace(tokenRe, (full, keyRaw) => {
      const key = normalizeFieldName(keyRaw);
      if (!key) return full;
      const field = fields ? fields[key] : undefined;
      const value = field ? String(field.value == null ? '' : field.value) : '';
      if (!value.trim()) return replaceBlank ? '' : full;
      if (eligible) {
        const conv = convertMarkdownToHtmlFragment(value);
        if (conv.ok) return escapeXmlReplacement(conv.html);
      }
      return escapeXmlReplacement(value);
    });
  }

  function renderCellTag(tag, fields, replaceBlank) {
    const attrs = scanCellAttrs(tag);
    const styleAttr = attrs.find((a) => a.name === 'style');
    const eligible = hasHtmlCellEligibility(styleAttr ? styleAttr.content : '');
    let newTag = tag;
    for (const a of attrs) {
      if (a.name !== 'value') continue;
      const newInner = replaceValueInner(a.content, fields, eligible, replaceBlank);
      if (newInner !== a.content) {
        newTag = newTag.slice(0, a.contentStartAbs) + newInner + newTag.slice(a.contentEndAbs);
      }
      break;
    }
    return newTag;
  }

  function populateWithMarkdownHtml(source, fields, replaceBlank) {
    const tagRe = /<mxCell\b[\s\S]*?(\/>|>)/g;
    let out = '';
    let last = 0;
    let m;
    tagRe.lastIndex = 0;
    while ((m = tagRe.exec(source))) {
      out += source.slice(last, m.index);
      const tagRaw = m[0];
      out += renderCellTag(tagRaw, fields, replaceBlank);
      last = m.index + tagRaw.length;
    }
    out += source.slice(last);
    return out;
  }

  function buildDrawioTemplateFixture() {
    return [
      '<mxfile host="app.diagrams.net">',
      '<diagram id="page-1" name="Page-1">',
      '<mxGraphModel><root>',
      '<mxCell id="0"/>',
      '<mxCell id="1" parent="0"/>',
      '<mxCell id="2" value="{{title}}" vertex="1" parent="1"/>',
      '<mxCell id="3" value="{{summary}}" vertex="1" parent="1"/>',
      '<mxCell id="4" value="{{summary}}" vertex="1" parent="1"/>',
      '<mxCell id="5" value="{{customer}}" vertex="1" parent="1"/>',
      '<mxCell id="6" value="{{customer decision}}" vertex="1" parent="1"/>',
      '<mxCell id="7" value="{{regional sponsor}}" vertex="1" parent="1"/>',
      '<mxCell id="8" value="&lt;div&gt;{{next steps}}&lt;/div&gt;" vertex="1" parent="1"/>',
      '<mxCell id="9" value="{{region}}" vertex="1" parent="1"/>',
      '</root></mxGraphModel>',
      '</diagram>',
      '</mxfile>',
    ].join('');
  }

  function buildH1FieldsFixture() {
    return {
      title: { key: 'title', token: '{{title}}', value: 'Weekly Report', source: 'heading' },
      summary: { key: 'summary', token: '{{summary}}', value: 'Main activity', source: 'section' },
      customer: { key: 'customer', token: '{{customer}}', value: 'Example Customer', source: 'token' },
      'customer decision': { key: 'customer decision', token: '{{customer decision}}', value: '', source: 'token' },
      'regional sponsor': { key: 'regional sponsor', token: '{{regional sponsor}}', value: '', source: 'token' },
      'next steps': { key: 'next steps', token: '{{next steps}}', value: 'Review and plan', source: 'section' },
      notes: { key: 'notes', token: '{{notes}}', value: 'Extra notes', source: 'token' },
    };
  }


  function validateDrawioReportReconciler() {
    const cases = [];
    const check = (name, actual, expected) => {
      const pass = JSON.stringify(actual) === JSON.stringify(expected);
      cases.push({ name, pass, actual, expected });
    };
    const checkCond = (name, cond) => {
      cases.push({ name, pass: Boolean(cond), actual: Boolean(cond), expected: true });
    };

    const fixture = buildDrawioTemplateFixture();
    const fields = buildH1FieldsFixture();

    // 1. empty template rejected
    const empty = assessTemplateXml('');
    check('01 empty rejected', empty.ok, false);
    check('01b empty diagnostic', empty.diagnostics.some((d) => d.code === 'template-empty'), true);

    // 2. non-Draw.io XML rejected
    const nonDrawio = assessTemplateXml('<html><body><p>not a diagram</p></body></html>');
    check('02 non-drawio rejected', nonDrawio.ok, false);
    check('02b non-drawio diagnostic', nonDrawio.diagnostics.some((d) => d.code === 'template-not-xml'), true);

    // 3. malformed XML diagnostic where supported
    const malformed = assessTemplateXml('<<<garbage>>>');
    check('03 malformed rejected', malformed.ok, false);
    check('03b malformed diagnostic', malformed.diagnostics.some((d) => d.code === 'template-not-xml'), true);

    // 4. uncompressed template accepted
    check('04 uncompressed accepted', assessTemplateXml(fixture).ok, true);

    // 5. compressed template rejected
    const compressed = assessTemplateXml('<mxfile><diagram>abc123encoded</diagram></mxfile>');
    check('05 compressed rejected', compressed.ok, false);
    check('05b compressed diagnostic', compressed.diagnostics.some((d) => d.code === 'template-compressed'), true);

    // 6. no-placeholder template handled deterministically
    const noPhXml = '<mxfile><diagram><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>';
    const noPh = reconcile(noPhXml, fields);
    check('06 no-placeholder ok', noPh.ok, true);
    check('06b no-placeholder extraction', noPh.placeholders.length, 0);
    check('06c no-placeholder markdown', buildMissingTemplateFieldsMarkdown(noPh), '');

    // 7. standard placeholder extraction
    const stdXml = '<mxfile><diagram><mxGraphModel><root><mxCell value="{{summary}}" vertex="1" parent="1"/><mxCell value="{{customer}}" vertex="1" parent="1"/></root></mxGraphModel></diagram></mxfile>';
    check('07 standard extraction', extractPlaceholders(stdXml).map((p) => p.key), ['summary', 'customer']);

    // 8. custom placeholder extraction
    const customXml = '<mxfile><diagram><mxGraphModel><root><mxCell value="{{ali summary}}" vertex="1" parent="1"/></root></mxGraphModel></diagram></mxfile>';
    check('08 custom extraction', extractPlaceholders(customXml).map((p) => p.key), ['ali summary']);

    // 9. placeholder case normalization
    const caseXml = '<mxfile><diagram><mxGraphModel><root><mxCell value="{{ SUMMARY }}" vertex="1" parent="1"/></root></mxGraphModel></diagram></mxfile>';
    check('09 case normalization', extractPlaceholders(caseXml).map((p) => p.key), ['summary']);

    // 10. repeated-space normalization
    const spaceXml = '<mxfile><diagram><mxGraphModel><root><mxCell value="{{  summary  }}" vertex="1" parent="1"/></root></mxGraphModel></diagram></mxfile>';
    check('10a space normalization key', extractPlaceholders(spaceXml).map((p) => p.key), ['summary']);
    check('10b space normalization token', extractPlaceholders(spaceXml).map((p) => p.token), ['{{summary}}']);

    // 11. deterministic first-seen order
    const orderXml = '<mxfile><diagram><mxGraphModel><root><mxCell value="{{c}}" vertex="1" parent="1"/><mxCell value="{{a}}" vertex="1" parent="1"/><mxCell value="{{b}}" vertex="1" parent="1"/></root></mxGraphModel></diagram></mxfile>';
    check('11 first-seen order', extractPlaceholders(orderXml).map((p) => p.key), ['c', 'a', 'b']);
    check('11b order deterministic', JSON.stringify(extractPlaceholders(orderXml)), JSON.stringify(extractPlaceholders(orderXml)));

    // 12. repeated placeholder occurrence count
    const repXml = '<mxfile><diagram><mxGraphModel><root><mxCell value="{{summary}}" vertex="1" parent="1"/><mxCell value="{{summary}}" vertex="1" parent="1"/></root></mxGraphModel></diagram></mxfile>';
    check('12 occurrence count', extractPlaceholders(repXml).find((p) => p.key === 'summary').occurrences, 2);
    check('12b occurrence dedup', extractPlaceholders(repXml).length, 1);

    // 13. H1 object-of-field-objects accepted
    const h1Style = { summary: { key: 'summary', token: '{{summary}}', value: 'From H1', source: 'section' }, customer: { key: 'customer', token: '{{customer}}', value: 'Acme', source: 'token' } };
    const h1Res = reconcile(stdXml, h1Style);
    check('13 h1 fields accepted', h1Res.ok, true);
    check('13b h1 matched', h1Res.matched.map((m) => m.field.key), ['summary', 'customer']);

    // 14. plain key/value field object accepted
    const plainFields = { summary: 'Plain value', customer: 'Plain customer' };
    const plainRes = reconcile(stdXml, plainFields);
    check('14 plain fields accepted', plainRes.ok, true);
    check('14b plain matched', plainRes.matched.map((m) => m.field.key), ['summary', 'customer']);

    // Full fixture reconciliation for 15-35
    const reconciliation = reconcile(fixture, fields);

    // 15. matched field with value
    check('15 matched with value', reconciliation.matched.map((m) => m.field.key), ['title', 'summary', 'customer', 'next steps']);

    // 16. matched field with blank value
    check('16 missing values blank', reconciliation.missingValues.map((m) => m.field.key), ['customer decision', 'regional sponsor']);

    // 17. unknown template placeholder
    check('17 unknown placeholder', reconciliation.unknownPlaceholders.map((u) => u.key), ['region']);

    // 18. unused Report field
    check('18 unused field', reconciliation.unusedFields.map((f) => f.key), ['notes']);

    // 19. category ordering deterministic
    const result2 = reconcile(fixture, fields);
    check('19a matched order deterministic', JSON.stringify(reconciliation.matched), JSON.stringify(result2.matched));
    check('19b unknown order deterministic', JSON.stringify(reconciliation.unknownPlaceholders), JSON.stringify(result2.unknownPlaceholders));
    check('19c missing order deterministic', JSON.stringify(reconciliation.missingValues), JSON.stringify(result2.missingValues));
    check('19d unused order deterministic', JSON.stringify(reconciliation.unusedFields), JSON.stringify(result2.unusedFields));

    // 20. missing Template Fields Markdown output
    const missingMd = buildMissingTemplateFieldsMarkdown(reconciliation);
    check('20 missing markdown', missingMd, ['## Template Fields', '', '{{customer decision}}:', '{{regional sponsor}}:', '{{region}}:'].join('\n'));

    // 21. duplicate Template Fields lines prevented
    const mdPhLines = missingMd.split('\n').filter((l) => l.startsWith('{{'));
    check('21 no duplicate lines', mdPhLines.length, new Set(mdPhLines).size);

    // 22. stable final newline
    check('22 stable newline', missingMd.endsWith('\n'), false);
    check('22b newline deterministic', buildMissingTemplateFieldsMarkdown(reconciliation), buildMissingTemplateFieldsMarkdown(result2));

    // 23. populated XML replaces all valued occurrences
    const populated = populateTemplate(fixture, fields);
    check('23a population ok', populated.ok, true);
    check('23b summary replaced both', (populated.xml.match(/Main activity/g) || []).length, 2);
    check('23c title replaced', populated.xml.includes('value="Weekly Report"'), true);
    check('23d customer replaced', populated.xml.includes('value="Example Customer"'), true);
    check('23e next steps in html', populated.xml.includes('&lt;div&gt;Review and plan&lt;/div&gt;'), true);

    // 24. blank matched placeholder preserved
    check('24a customer decision preserved', populated.xml.includes('{{customer decision}}'), true);
    check('24b regional sponsor preserved', populated.xml.includes('{{regional sponsor}}'), true);

    // 25. unknown placeholder preserved
    check('25 region preserved', populated.xml.includes('{{region}}'), true);

    // 26. XML ampersand escaping
    const ampXml = '<mxfile><diagram><mxGraphModel><root><mxCell value="{{summary}}" vertex="1" parent="1"/></root></mxGraphModel></diagram></mxfile>';
    const ampFields = { summary: { key: 'summary', token: '{{summary}}', value: 'A & B', source: 'token' } };
    const ampPop = populateTemplate(ampXml, ampFields);
    check('26a ampersand escaped', ampPop.xml.includes('A &amp; B'), true);
    check('26b no raw ampersand', ampPop.xml.includes('A & B'), false);

    // 27. XML less-than escaping
    const ltFields = { summary: { key: 'summary', token: '{{summary}}', value: '5 < 10', source: 'token' } };
    const ltPop = populateTemplate(ampXml, ltFields);
    check('27 less-than escaped', ltPop.xml.includes('5 &lt; 10'), true);

    // 28. quote/apostrophe behavior
    const qFields = { summary: { key: 'summary', token: '{{summary}}', value: '"Quoted" and Customer\'s decision', source: 'token' } };
    const qPop = populateTemplate(ampXml, qFields);
    check('28a double quote escaped', qPop.xml.includes('&quot;Quoted&quot;'), true);
    check('28b apostrophe escaped', qPop.xml.includes('&apos;s decision'), true);

    // 29. multiline value behavior
    const mlFields = { summary: { key: 'summary', token: '{{summary}}', value: 'Line one\nLine two', source: 'token' } };
    const mlPop = populateTemplate(ampXml, mlFields);
    check('29a multiline newline entity', mlPop.xml.includes('Line one&#xa;Line two'), true);
    check('29b no raw newline', !mlPop.xml.includes('Line one\nLine two'), true);

    // 30. original template not mutated
    const originalFixture = buildDrawioTemplateFixture();
    reconcile(fixture, fields);
    populateTemplate(fixture, fields);
    check('30 original unchanged', fixture, originalFixture);

    // 31. H1 fields not mutated
    const fieldsSnapshot = JSON.stringify(fields);
    reconcile(fixture, fields);
    populateTemplate(fixture, fields);
    check('31 fields not mutated', JSON.stringify(fields), fieldsSnapshot);

    // 32. repeated reconcile equivalence
    check('32 reconcile equivalence', JSON.stringify(reconcile(fixture, fields)), JSON.stringify(reconcile(fixture, fields)));

    // 33. repeated population byte identity
    check('33 population byte identity', populateTemplate(fixture, fields).xml, populateTemplate(fixture, fields).xml);

    // 34. sanitized end-to-end H1 fields plus Draw.io template
    check('34a e2e ok', populated.ok, true);
    check('34b e2e matched replaced', populated.xml.includes('Weekly Report'), true);
    check('34c e2e unknown preserved', populated.xml.includes('{{region}}'), true);
    check('34d e2e unreconciled count', (populated.xml.match(/\{\{/g) || []).length, 3);

    // =====================================================================
    // ACT H4.1 — narrow XML declaration compatibility (36-39).
    // =====================================================================
    const XML_DECL = '<?xml version="1.0" encoding="UTF-8"?>\n';
    const BOM = '\uFEFF';
    const declFixture = XML_DECL + fixture;
    const gmXml = '<mxGraphModel><root><mxCell value="{{summary}}"/></root></mxGraphModel>';

    check('36a direct mxfile accepted', assessTemplateXml(fixture).ok, true);
    check('36b direct mxGraphModel accepted', assessTemplateXml(gmXml).ok, true);
    check('36c declaration plus mxfile accepted', assessTemplateXml(declFixture).ok, true);
    check('36d declaration plus mxGraphModel accepted', assessTemplateXml(XML_DECL + gmXml).ok, true);
    check('36e UTF-8 encoding declaration accepted', assessTemplateXml(XML_DECL + fixture).ok, true);
    check('36f single-quoted declaration accepted', assessTemplateXml("<?xml version='1.0' encoding='UTF-8'?>\n" + fixture).ok, true);
    check('36g BOM plus mxfile accepted', assessTemplateXml(BOM + fixture).ok, true);
    check('36h BOM + whitespace + declaration + mxfile accepted', assessTemplateXml(BOM + '  \n ' + XML_DECL + ' \n' + fixture).ok, true);
    check('36i BOM + declaration + mxGraphModel accepted', assessTemplateXml(BOM + XML_DECL + gmXml).ok, true);
    check('36j leading whitespace + declaration accepted', assessTemplateXml('\n  ' + XML_DECL + fixture).ok, true);
    check('36k declaration without encoding accepted', assessTemplateXml('<?xml version="1.0"?>\n' + fixture).ok, true);

    const declStd = XML_DECL + stdXml;
    check('37a declaration-led placeholder extraction', extractPlaceholders(declStd).map((p) => p.key), ['summary', 'customer']);
    check('37b declaration-led repeated occurrences', extractPlaceholders(XML_DECL + repXml).find((p) => p.key === 'summary').occurrences, 2);
    const declRec = reconcile(declFixture, fields);
    check('37c declaration-led reconciliation ok', declRec.ok, true);
    check('37d declaration-led matched', declRec.matched.map((m) => m.field.key), ['title', 'summary', 'customer', 'next steps']);
    check('37e declaration-led missing values', declRec.missingValues.map((m) => m.field.key), ['customer decision', 'regional sponsor']);
    check('37f declaration-led unknown', declRec.unknownPlaceholders.map((u) => u.key), ['region']);
    check('37g declaration-led unused', declRec.unusedFields.map((f) => f.key), ['notes']);
    const declPop = populateTemplate(declFixture, fields);
    check('37h declaration-led population ok', declPop.ok, true);
    check('37i declaration retained in populated output', declPop.xml.startsWith('<?xml'), true);
    check('37j declaration-led values replaced', declPop.xml.includes('Weekly Report'), true);
    check('37k declaration-led blanks preserved', declPop.xml.includes('{{customer decision}}'), true);
    check('37l declaration-led unknown preserved', declPop.xml.includes('{{region}}'), true);
    check('37m original declaration-led input unchanged', declFixture, XML_DECL + fixture);
    check('37n repeated assessment deterministic', JSON.stringify(assessTemplateXml(declFixture)), JSON.stringify(assessTemplateXml(declFixture)));
    check('37o repeated population byte identity', populateTemplate(declFixture, fields).xml, populateTemplate(declFixture, fields).xml);

    check('38a unrelated declaration-led XML rejected', assessTemplateXml(XML_DECL + '<html><body>no</body></html>').ok, false);
    check('38a2 unrelated diagnostic template-not-xml', assessTemplateXml(XML_DECL + '<html></html>').diagnostics.some((d) => d.code === 'template-not-xml'), true);
    check('38b HTML-escaped declaration-led rejected', assessTemplateXml('&lt;?xml version="1.0"?&gt;\n&lt;mxfile&gt;').ok, false);
    check('38c Markdown-fenced declaration-led rejected', assessTemplateXml('```xml\n' + declFixture + '\n```').ok, false);
    check('38d malformed declaration rejected', assessTemplateXml('<?xml version="2.0"?>\n' + fixture).ok, false);
    check('38d2 missing-version declaration rejected', assessTemplateXml('<?xml encoding="UTF-8"?>\n' + fixture).ok, false);
    check('38e arbitrary processing instruction not treated as declaration', assessTemplateXml('<?xml-stylesheet href="a.xsl"?>\n' + fixture).ok, false);
    check('38f plain text containing mxfile rejected', assessTemplateXml('the word mxfile appears here').ok, false);
    check('38g mxfile only later inside unrelated root rejected', assessTemplateXml(XML_DECL + '<html><body>mxfile</body></html>').ok, false);
    check('38h declaration after other content not removed', assessTemplateXml('<html></html>\n' + XML_DECL + fixture).ok, false);

    const declCompressed = assessTemplateXml(XML_DECL + '<mxfile><diagram>abc123encoded</diagram></mxfile>');
    check('39a declaration-led compressed rejected', declCompressed.ok, false);
    check('39b declaration-led compressed diagnostic', declCompressed.diagnostics.some((d) => d.code === 'template-compressed'), true);
    check('39c declaration-led compressed not misdiagnosed not-xml', declCompressed.diagnostics.some((d) => d.code === 'template-not-xml'), false);
    check('39d direct-root compressed detection unchanged', assessTemplateXml('<mxfile><diagram>abc123encoded</diagram></mxfile>').diagnostics.some((d) => d.code === 'template-compressed'), true);
    check('39e declaration-led assessment shape unchanged', [typeof declCompressed.ok, typeof declCompressed.compressed, Array.isArray(declCompressed.diagnostics)], ['boolean', 'boolean', true]);

    // ===================================================================
    // ACT A — Baseline contract assertions. These lock in the plain
    // population path so the formatted html=1 path is proven to leave it
    // byte-identical when the option is absent.
    // ===================================================================
    const baseAmpXml = '<mxfile><diagram><mxGraphModel><root><mxCell id="1" parent="0"/><mxCell id="2" value="{{summary}}" style="text;html=0" vertex="1" parent="1"/></root></mxGraphModel></diagram></mxfile>';
    const basePlainFieldsA = { summary: { key: 'summary', token: '{{summary}}', value: 'First line\n\n**Bold second line**', source: 'section' } };
    const basePlainPop = populateTemplate(baseAmpXml, basePlainFieldsA);
    // With format disabled (default), a multi-paragraph emphasized value stays
    // on the existing plain XML-escaped path.
    check('A01 default population is plain (no format option)', basePlainPop.xml.includes('First line&#xa;&#xa;**Bold second line**'), true);
    check('A02 default does not emit HTML div', basePlainPop.xml.includes('&lt;div&gt;'), false);
    check('A03 default does not emit strong tag', basePlainPop.xml.includes('&lt;strong&gt;'), false);
    check('A04 default newline is numeric entity', basePlainPop.xml.includes('&#xa;'), true);
    const A05 = populateTemplate(baseAmpXml, basePlainFieldsA);
    check('A05 default population deterministic', basePlainPop.xml, A05.xml);
    check('A06 default population is byte-stable vs options omitted', populateTemplate(baseAmpXml, basePlainFieldsA).xml, basePlainPop.xml);

    // Baseline: unresolved + unknown placeholders preserved regardless of html=0 style.
    check('A08 unresolved placeholder preserved (plain default)', basePlainPop.xml.trim().endsWith('{{summary}}'), false);
    const A09xml = '<mxfile><diagram><mxGraphModel><root><mxCell id="1" parent="0"/><mxCell id="2" value="A {{summary}} B {{ghost}}" style="html=1" vertex="1" parent="1"/></root></mxGraphModel></diagram></mxfile>';
    const A09fields = { summary: { key: 'summary', token: '{{summary}}', value: 'val', source: 'token' } };
    const A09pop = populateTemplate(A09xml, A09fields);
    check('A09 default global replacement replaces summary', A09pop.xml.includes('A val B {{ghost}}'), true);
    check('A09b default global leaves unknown ghost', A09pop.xml.includes('{{ghost}}'), true);

    // Baseline: field input not mutated.
    const A10Before = JSON.stringify(basePlainFieldsA);
    populateTemplate(baseAmpXml, basePlainFieldsA);
    check('A10 default field input unmutated', JSON.stringify(basePlainFieldsA), A10Before);

    // Baseline: XML declaration + compression unchanged (regression lock).
    check('A11 default declaration-led population preserved', populateTemplate(declFixture, fields).xml.startsWith('<?xml'), true);
    check('A12 default compressed rejection unchanged', assessTemplateXml('<mxfile><diagram>abc123encoded</diagram></mxfile>').diagnostics.some((d) => d.code === 'template-compressed'), true);

    // ===================================================================
    // ACT B — restricted Markdown fragment converter cases.
    // ===================================================================
    const convB = (v) => convertMarkdownToHtmlFragment(v);
    check('B01 plain one-line stays plain', convB('Just a simple line.').reason, 'plain');
    check('B02 two paragraphs -> two divs', (convB('A\n\nB').html || '').split('<div>').length - 1, 2);
    check('B03 hard break -> br', convB('line  \nsecond').html.includes('<br>'), true);
    check('B04 bold -> strong', convB('**Bold** text').html.includes('<strong>'), true);
    check('B05 italic -> em', convB('*Italic* text').html.includes('<em>'), true);
    check('B06 bold-italic -> strong+em', (() => { const h = convB('***Both*** x').html || ''; return h.includes('<strong>') && h.includes('<em>'); })(), true);
    check('B07 unordered list -> ul/li', (() => { const h = convB('- one\n- two').html || ''; return h.includes('<ul>') && (h.match(/<li>/g) || []).length === 2; })(), true);
    check('B08 ordered list -> ol/li', (() => { const h = convB('1. one\n2. two').html || ''; return h.includes('<ol>') && (h.match(/<li>/g) || []).length === 2; })(), true);
    check('B09 paragraph + list', (() => { const h = convB('Intro\n\n- a\n- b').html || ''; return h.includes('<div>') && h.includes('<ul>'); })(), true);
    check('B10 unicode preserved', convB('**Más café** 😀').html.includes('Más'), true);
    const ampConv = convB('**A** & B');
    check('B11 ampersand escaped at html layer', ampConv.ok, true);
    check('B11b ampersand entity present', (ampConv.html || '').includes('&amp;'), true);
    check('B12 double quote escaped', (convB('**say** "hi"').html || '').includes('&quot;'), true);
    check('B13 apostrophe escaped', (convB("**it's** long").html || '').includes('&apos;'), true);
    check('B14 angle brackets plain fallback', convB('5 < 10 and > 2').reason, 'plain');
    check('B15 raw HTML fallback', convB('<b>hi</b>').reason, 'raw-html');
    check('B16 script-like fallback', convB('x<script>alert(1)</script>').reason, 'raw-html');
    check('B17 table fallback', convB('a | b\n---|---').reason, 'table');
    check('B18 code fence fallback', convB('x\n```\ncode\n```').reason, 'code');
    check('B19 nested-list fallback', convB('  - nested').reason, 'indented-or-nested');
    check('B20 task-checkbox fallback', convB('- [ ] todo').reason, 'task-checkbox');
    check('B21 image fallback', convB('![alt](img.png)').reason, 'image');
    check('B22 heading fallback', convB('## Head').reason, 'heading');
    check('B23 blockquote fallback', convB('> quote').reason, 'blockquote');
    check('B24 unmatched markers fallback', convB('* unclosed').reason, 'plain');
    check('B25 identifier underscores literal', convB('USD_50_000 cost').reason, 'plain');
    check('B26 escaped markers literal', convB('C:\\*not italic\\* x').reason, 'escaped-marker');
    check('B27 empty value', convB('').reason, 'empty');

    // ACT B allowlist: formatted output emits only div/br/strong/em/ul/ol/li,
    // never attributes, never script/style/id/class/event-handler.
    const B28 = convB('**Bold** title\n\n- one\n- two\n\n*Ital* end');
    const B28html = B28.html || '';
    const B28tags = B28html.match(/<\/?[a-z0-9]+/g) || [];
    const B28clean = B28tags.map((t) => t.replace(/[</?]/g, ''));
    check('B28 allowlist div/br/strong/em/ul/ol/li only', B28clean.every((tag) => ['div', 'br', 'strong', 'em', 'ul', 'ol', 'li'].includes(tag)), true);
    check('B28b no class/style/id/on attributes', !B28html.includes('class=') && !B28html.includes('style=') && !B28html.includes('id=') && !/on[a-z]+=/.test(B28html), true);
    check('B28c no p/b/i/code/a emitted', !B28html.includes('<p>') && !B28html.includes('<b>') && !B28html.includes('<i>') && !B28html.includes('<code>') && !B28html.includes('<a '), true);

    // ===================================================================
    // Markdown-in-HTML-cells population cases (occurrence-aware, html=1).
    // ===================================================================
    const Cfields = {
      summary: { key: 'summary', token: '{{summary}}', value: '**Bold** and *italic*', source: 'token' },
      next: { key: 'next', token: '{{next}}', value: '1. a\n2. b', source: 'token' },
      blank: { key: 'blank', token: '{{blank}}', value: '', source: 'token' },
    };
    const Cxml = '<mxfile><root><mxCell id="0"/><mxCell id="1" parent="0"/>' +
      '<mxCell id="2" value="{{summary}}" style="text;html=0" vertex="1" parent="1"/>' +
      '<mxCell id="3" value="{{summary}}" style="text;html=1" vertex="1" parent="1"/>' +
      '<mxCell id="4" value="{{next}}" style="text;html=1" vertex="1" parent="1"/>' +
      '<mxCell id="5" value="{{blank}}" style="text;html=1" vertex="1" parent="1"/>' +
      '<mxCell id="6" value="{{ghost}}" style="text;html=1" vertex="1" parent="1"/>' +
      '</root></mxfile>';
    const Cplain = populateTemplate(Cxml, Cfields);
    const Cfmt = populateTemplate(Cxml, Cfields, { formatMarkdownForHtmlCells: true });
    const Chtml0 = /value="([^"]*)" style="text;html=0"/.exec(Cfmt.xml);
    check('C01 formatted html=0 cell stays plain', Chtml0 ? Chtml0[1].includes('&lt;strong&gt;') : false, false);
    check('C02 formatted html=1 cell has strong', Cfmt.xml.includes('&lt;strong&gt;'), true);
    check('C03 formatted html=1 cell has em', Cfmt.xml.includes('&lt;em&gt;'), true);
    check('C04 formatted next -> ol', Cfmt.xml.includes('&lt;ol&gt;'), true);
    check('C05 blank placeholder preserved', Cfmt.xml.includes('{{blank}}'), true);
    check('C06 unknown placeholder preserved', Cfmt.xml.includes('{{ghost}}'), true);
    check('C07 optionless population stays plain', !Cplain.xml.includes('&lt;strong&gt;'), true);

    const Corder = '<mxfile><root><mxCell id="1" value="{{summary}}" style="html=1"/>' +
      '<mxCell id="2" style="html=1" value="{{summary}}"/></root></mxfile>';
    const CorderPop = populateTemplate(Corder, Cfields, { formatMarkdownForHtmlCells: true });
    check('C08 value-before-style parsed', CorderPop.xml.includes('&lt;strong&gt;'), true);
    check('C08b style-before-value parsed', (CorderPop.xml.match(/&lt;strong&gt;/g) || []).length, 2);

    const Cnot = { summary: { key: 'summary', token: '{{summary}}', value: '**Bold** only', source: 'token' } };
    const Cmy = '<mxfile><root><mxCell id="1" value="{{summary}}" style="text;myhtml=1"/></root></mxfile>';
    check('C10 myhtml=1 not eligible', populateTemplate(Cmy, Cnot, { formatMarkdownForHtmlCells: true }).xml.includes('&lt;strong&gt;'), false);
    const Chtml10 = '<mxfile><root><mxCell id="1" value="{{summary}}" style="text;html=10"/></root></mxfile>';
    check('C11 html=10 not eligible', populateTemplate(Chtml10, Cnot, { formatMarkdownForHtmlCells: true }).xml.includes('&lt;strong&gt;'), false);

    const CmultiCells = {
      a: { key: 'a', token: '{{a}}', value: '**A**', source: 'token' },
      b: { key: 'b', token: '{{b}}', value: 'B', source: 'token' },
    };
    const CmultiXml = '<mxfile><root><mxCell id="1" value="{{a}} & {{b}} {{ghost}}" style="html=1"/></root></mxfile>';
    const CmultiPop = populateTemplate(CmultiXml, CmultiCells, { formatMarkdownForHtmlCells: true });
    check('C12 multiple placeholders one cell', CmultiPop.xml.includes('&lt;strong&gt;') && CmultiPop.xml.includes('& B') && CmultiPop.xml.includes('{{ghost}}'), true);

    const failed = cases.filter((item) => !item.pass);
    const result = {
      ok: failed.length === 0,
      total: cases.length,
      passed: cases.length - failed.length,
      failed: failed.length,
      cases,
    };

    // Return-shape contract (informational, intentionally NOT test cases):
    // ok = (failed.length === 0); total = cases.length; passed + failed =
    // cases.length. The former self-referential 35a/35b/35c entries were
    // removed from the result array: 35b compared result.total (captured
    // before later pushes) against the grown cases.length and could never
    // pass, and 35a/35c restated the construction invariants above. Totals
    // are computed after every result so no pass:false entry is hidden.
    return result;
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
    convertMarkdownToHtmlFragment,
    populateTemplate,
    validateDrawioReportReconciler,
  });

  try {
    globalThis.MME_DRAWIO_REPORT_RECONCILER = API;
    if (typeof window !== 'undefined') window.MME_DRAWIO_REPORT_RECONCILER = API;
  } catch {}
})();
