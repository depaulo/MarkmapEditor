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
    populateTemplate,
    validateDrawioReportReconciler,
  });

  try {
    globalThis.MME_DRAWIO_REPORT_RECONCILER = API;
    if (typeof window !== 'undefined') window.MME_DRAWIO_REPORT_RECONCILER = API;
  } catch {}
})();
