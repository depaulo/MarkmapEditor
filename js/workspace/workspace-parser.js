// @ts-nocheck
// R-SPLIT2 — Workspace Metadata/Index Parser.
// Extracted parser-only helpers from main.js.
//
// The helper functions referenced below that are NOT defined in this module
// (normalizeParserText, parseMarkdownHeadings, parseMarkdownTasks,
// parseConceptLinks, parseVisibleHeaderFields, getMarkdownTitle, countWords,
// stripYamlFrontmatterForTags, normalizeTagValue) continue to live in main.js
// as global functions and are resolved at call time. This keeps the parser
// self-contained for the 6 extracted helpers without duplicating the broader
// parsing utilities. (inferDateFromWorkspacePath was retired from this module
// by the ACT 1C strict date contract: frontmatter date → dated filename → ''.)

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

  // ==============================
  // ACT 5A — Managed Project foundation
  // ==============================

  // Visible trailing-token grammar. Only exact, valid, recognized trailing
  // bracket groups are consumed; every other bracket stays in the title.
  const PROJECT_VALUE_TOKEN_RE = /^(\d+(?:\.\d+)?)[ \t]+([A-Za-z]{3})$/;
  const PROJECT_VALUE_LOOKALIKE_RE = /^-?\d[\d.,]*[ \t]*[A-Za-z]{0,6}$/;
  const PROJECT_BARE_NUMBER_RE = /^-?\d[\d.,]*$/;
  const PROJECT_QUARTER_LOOKALIKE_RE = /^(\d{2}|\d{4})[/-]?[qQ]\d$/i;

  const MME_PROJECT_COMMENT_RE = /^<!--\s*mme-project:\s*([\s\S]*?)\s*-->$/i;
  const MME_PROJECT_COMMENT_LOOKALIKE_RE = /^<!--[\s\S]*?mme-project\s*:/i;
  const PROJECT_ID_RE = /^prj_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const MME_PROJECT_KEY_ORDER = ['id', 'created', 'stage', 'state', 'delivery', 'billing', 'closed', 'archived'];
  const MME_PROJECT_OWNED_KEYS = new Set(MME_PROJECT_KEY_ORDER);

  // ACT 5B-3 — canonical managed vocabularies.
  //
  // STAGE and STATE are separate concepts. `closed` remains a DATE and is never
  // a State value, and State is never synchronized with it in either direction.
  // Unknown legacy text is PRESERVED and classified conservatively: it never
  // blocks read-only display and is never rewritten by parsing.
  const PROJECT_STAGE_CANONICAL = Object.freeze({
    funnel: 'Funnel',
    pipeline: 'Pipeline',
    quoted: 'Quoted',
    'on-delivery': 'On Delivery',
    delivered: 'Delivered',
  });
  const PROJECT_STATE_CANONICAL = Object.freeze({
    open: 'Open',
    'on-hold': 'On Hold',
    completed: 'Completed',
    lost: 'Lost',
    canceled: 'Canceled',
  });
  const PROJECT_STATE_DEFAULT = 'open';

  function canonicalProjectStage(raw) {
    const key = String(raw == null ? '' : raw).trim().toLowerCase();
    if (!key) return '';
    return Object.prototype.hasOwnProperty.call(PROJECT_STAGE_CANONICAL, key) ? key : '';
  }

  function projectStageLabel(raw) {
    return PROJECT_STAGE_CANONICAL[canonicalProjectStage(raw)] || String(raw == null ? '' : raw).trim();
  }

  function canonicalProjectState(raw) {
    const key = String(raw == null ? '' : raw).trim().toLowerCase();
    if (!key) return '';
    return Object.prototype.hasOwnProperty.call(PROJECT_STATE_CANONICAL, key) ? key : '';
  }

  function projectStateLabel(raw) {
    return PROJECT_STATE_CANONICAL[canonicalProjectState(raw)] || String(raw == null ? '' : raw).trim();
  }

  function pushProjectDiagnostic(list, code, detail, line) {
    list.push({
      code: String(code || ''),
      detail: String(detail == null ? '' : detail),
      line: Number(line) || 0,
    });
  }

  function isValidProjectIsoDate(value) {
    const m = String(value == null ? '' : value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return false;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
    const probe = new Date(Date.UTC(y, mo - 1, d));
    return (
      probe.getUTCFullYear() === y && probe.getUTCMonth() === mo - 1 && probe.getUTCDate() === d
    );
  }

  function isProjectIdValue(raw) {
    return PROJECT_ID_RE.test(normalizeProjectIdValue(raw));
  }

  function normalizeProjectIdValue(raw) {
    return String(raw == null ? '' : raw).trim();
  }

  // Pure and non-mutating: reads a declaration value and reports the title plus
  // any exact recognized trailing tokens. Malformed candidates are diagnosed and
  // left as readable title text.
  function parseProjectDeclarationValue(rawValue) {
    const raw = String(rawValue == null ? '' : rawValue);
    let rest = raw.replace(/\s+$/, '');
    const diagnostics = [];
    let value = null;
    let valueRaw = '';
    let currency = '';
    let expectedOrder = null;

    // Bounded: a token can only be consumed from the tail, so a small fixed
    // budget is sufficient and guarantees termination on any input.
    for (let budget = 0; budget < 16; budget += 1) {
      if (rest.charAt(rest.length - 1) !== ']') break;
      const open = rest.lastIndexOf('[');
      if (open <= 0) break;
      const inner = rest.slice(open + 1, rest.length - 1);
      // Nested brackets (including Wiki Links) are never Project tokens.
      if (inner.indexOf('[') !== -1 || inner.indexOf(']') !== -1) break;
      const token = inner.trim();

      if (token) {
        const valueMatch = token.match(PROJECT_VALUE_TOKEN_RE);
        if (valueMatch) {
          const num = Number(valueMatch[1]);
          if (Number.isFinite(num)) {
            value = num;
            valueRaw = valueMatch[1];
            currency = valueMatch[2].toUpperCase();
            rest = rest.slice(0, open).replace(/\s+$/, '');
            continue;
          }
        }

        const quarter = normalizeProjectQuarter(token);
        if (quarter.valid) {
          expectedOrder = quarter;
          rest = rest.slice(0, open).replace(/\s+$/, '');
          continue;
        }
      }

      // Not consumed. Distinguish a malformed recognized-looking attempt
      // (bounded diagnostic) from ordinary bracketed title text (silent).
      if (PROJECT_QUARTER_LOOKALIKE_RE.test(token)) {
        pushProjectDiagnostic(diagnostics, 'invalid-expected-order', token);
        break;
      }
      if (PROJECT_BARE_NUMBER_RE.test(token)) {
        pushProjectDiagnostic(diagnostics, 'value-without-currency', token);
        break;
      }
      if (PROJECT_VALUE_LOOKALIKE_RE.test(token)) {
        pushProjectDiagnostic(diagnostics, 'invalid-value-token', token);
        break;
      }
      break;
    }

    return { title: rest.trim(), value, valueRaw, currency, expectedOrder, diagnostics };
  }

  // Pure reader for one managed metadata comment line. Returns null when the
  // line is not an mme-project comment at all.
  function parseManagedProjectComment(rawLine) {
    const raw = String(rawLine == null ? '' : rawLine).trim();
    if (!MME_PROJECT_COMMENT_LOOKALIKE_RE.test(raw)) return null;

    const matched = raw.match(MME_PROJECT_COMMENT_RE);
    if (!matched) {
      return {
        present: true,
        valid: false,
        raw,
        fields: {},
        extraFields: {},
        diagnostics: [{ code: 'malformed-managed-comment', detail: raw, line: 0 }],
        warnings: [],
      };
    }

    const fields = {};
    const extraFields = {};
    const diagnostics = [];
    const warnings = [];
    let structurallyMalformed = false;

    for (const segment of String(matched[1] || '').split(';')) {
      const piece = segment.trim();
      if (!piece) continue;
      const eq = piece.indexOf('=');
      if (eq <= 0) {
        structurallyMalformed = true;
        continue;
      }
      const key = piece.slice(0, eq).trim().toLowerCase();
      const value = piece.slice(eq + 1).trim();
      if (MME_PROJECT_OWNED_KEYS.has(key)) {
        if (Object.prototype.hasOwnProperty.call(fields, key)) {
          structurallyMalformed = true; // duplicate serialized key
          continue;
        }
        fields[key] = value;
      } else {
        extraFields[key] = value;
      }
    }

    if (structurallyMalformed) {
      pushProjectDiagnostic(diagnostics, 'malformed-managed-comment', raw);
    }

    if (!fields.id) {
      pushProjectDiagnostic(diagnostics, 'missing-managed-id', raw);
    } else if (!PROJECT_ID_RE.test(fields.id)) {
      pushProjectDiagnostic(diagnostics, 'invalid-managed-id', fields.id);
    }

    if (!fields.created) {
      pushProjectDiagnostic(diagnostics, 'missing-created', raw);
    } else if (!isValidProjectIsoDate(fields.created)) {
      pushProjectDiagnostic(diagnostics, 'invalid-created', fields.created);
    }

    if (fields.stage && /[\r\n;]/.test(fields.stage)) {
      pushProjectDiagnostic(diagnostics, 'malformed-managed-comment', fields.stage);
      structurallyMalformed = true;
    }

    // ACT 5B-3: non-canonical stage/state text is preserved and reported, but
    // it never invalidates the whole comment and never blocks read-only
    // display. It is never rewritten by parsing. These are WARNINGS, not
    // validity diagnostics: an unknown legacy stage must not stop the Project
    // from being recognised as managed.
    if (fields.stage && !canonicalProjectStage(fields.stage)) {
      warnings.push({ code: 'non-canonical-stage', detail: fields.stage, line: 0 });
    }
    if (fields.state && !canonicalProjectState(fields.state)) {
      warnings.push({ code: 'non-canonical-state', detail: fields.state, line: 0 });
    }

    for (const key of ['delivery', 'billing']) {
      const value = fields[key];
      if (value === undefined || value === '') continue;
      if (!normalizeProjectQuarter(value).valid) {
        pushProjectDiagnostic(diagnostics, 'invalid-' + key + '-quarter', value);
      }
    }

    if (fields.closed && !isValidProjectIsoDate(fields.closed)) {
      pushProjectDiagnostic(diagnostics, 'invalid-closed-date', fields.closed);
    }

    if (
      fields.archived !== undefined &&
      fields.archived !== '' &&
      !/^(true|false)$/i.test(fields.archived)
    ) {
      pushProjectDiagnostic(diagnostics, 'invalid-archived-value', fields.archived);
    }

    return {
      present: true,
      valid: diagnostics.length === 0 && !structurallyMalformed,
      raw,
      fields,
      extraFields,
      diagnostics,
      warnings,
    };
  }

  // Deterministic serialization. Owned key order is fixed; unknown fields are
  // preserved and appended after the owned keys.
  function serializeManagedProjectComment(fields, extraFields) {
    const src = fields || {};
    const parts = [];

    for (const key of MME_PROJECT_KEY_ORDER) {
      const value = src[key];
      if (value === undefined || value === null || value === '') continue;
      parts.push(key + '=' + String(value));
    }

    for (const key of Object.keys(extraFields || {})) {
      if (MME_PROJECT_OWNED_KEYS.has(key)) continue;
      const value = extraFields[key];
      if (value === undefined || value === null || value === '') continue;
      parts.push(key + '=' + String(value));
    }

    return parts.length ? '<!-- mme-project: ' + parts.join('; ') + ' -->' : '';
  }

  function computeFencedLineRanges(lines) {
    const ranges = [];
    let open = null;

    for (let i = 0; i < lines.length; i++) {
      const marker = lines[i].match(/^\s{0,3}(`{3,}|~{3,})/);
      if (!marker) continue;
      const token = marker[1];
      const rest = lines[i].slice(marker[0].length);

      if (!open) {
        open = { ch: token.charAt(0), len: token.length, start: i };
        continue;
      }
      if (token.charAt(0) === open.ch && token.length >= open.len && !/[`~]/.test(rest)) {
        ranges.push([open.start, i]);
        open = null;
      }
    }

    if (open) ranges.push([open.start, lines.length - 1]);
    return ranges;
  }

  function isTaskCheckboxLine(rawLine) {
    return /^(\s*)[-*+]\s+\[[ xX]\]/.test(String(rawLine == null ? '' : rawLine));
  }

  // Canonical writer placement is the immediate next line. The reader tolerates
  // exactly one blank line and never associates across another Project or a
  // Markdown heading.
  function associateManagedProjectComment(lines, declIndex, fencedSet, consumed) {
    const candidates = [];
    const probe = (idx) => {
      if (idx < 0 || idx >= lines.length) return;
      if (fencedSet.has(idx)) return;
      if (candidates.includes(idx)) return;
      const parsed = parseManagedProjectComment(lines[idx]);
      if (parsed && parsed.present) candidates.push(idx);
    };

    probe(declIndex + 1);
    // Scan forward from the declaration. The comment may be the immediate next
    // line, or follow this Project's own legacy dictionary lines. The scan stops
    // at a blank line, a heading, a fence, or another Project declaration — it
    // never searches arbitrarily and never crosses Projects.
    let cursor = declIndex + 1;
    let blanks = 0;

    while (cursor < lines.length) {
      const raw = lines[cursor];
      const trimmed = String(raw == null ? '' : raw).trim();

      if (!trimmed) {
        // Exactly one blank line is tolerated; more ends association.
        blanks += 1;
        if (blanks > 1) break;
        cursor += 1;
        continue;
      }

      if (fencedSet.has(cursor)) break;
      if (/^#{1,6}\s/.test(trimmed)) break;

      const parsed = parseManagedProjectComment(raw);
      if (parsed && parsed.present) {
        // Two comment lines inside one window are DUPLICATES, never two
        // different Projects' comments.
        probe(cursor);
        probe(cursor + 1);
        break;
      }

      // Skip a legacy dictionary line belonging to this same Project block.
      const nextFirst = parseInlinePairs(stripListPrefix(raw))[0];
      if (!nextFirst || normalizeProjectKey(nextFirst.key) === 'project') break;

      cursor += 1;
    }

    if (!candidates.length) return { comment: null, duplicate: false, indexes: [] };

    const indexes = candidates.slice();
    for (const idx of indexes) consumed.add(idx);

    return {
      comment: parseManagedProjectComment(lines[indexes[0]]),
      duplicate: indexes.length > 1,
      indexes,
    };
  }

  function buildProjectFromBlock(blockLines, { startLine, sourcePath, sourceKind, sourceName, managed }) {
    const fields = {};
    const extraFields = {};
    const diagnostics = [];
    let name = '';
    let declaration = null;
    let legacyFieldsPresent = false;

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

        // The first pair on the starter line is the authoritative Project name
        // and carries the visible trailing-token grammar.
        if (idx === 0 && pIdx === 0 && canonical === 'name') {
          declaration = parseProjectDeclarationValue(value);
          name = declaration.title;
          for (const d of declaration.diagnostics) {
            pushProjectDiagnostic(diagnostics, d.code, d.detail, startLine);
          }
          continue;
        }

        // A later Name: pair must NOT rename the Project.
        // Preserve it as an extra field.
        if (canonical === 'name') {
          extraFields[normalizedKey] = value;
          continue;
        }

        // Legacy dictionary fallback fills ABSENT values only. It never
        // overrides a visible token and never overrides managed metadata.
        if (canonical === 'value') {
          legacyFieldsPresent = true;
          if (declaration && declaration.value !== null) continue;
          const parsed = parseProjectValue(value);
          fields.value = parsed.value;
          fields.valueRaw = parsed.valueRaw;
        }

        if (canonical === 'currency') {
          legacyFieldsPresent = true;
          if (declaration && declaration.currency) continue;
          fields.currency = value ? value.toUpperCase() : value;
          continue;
        }

        if (
          canonical === 'expectedOrder' ||
          canonical === 'expectedDelivery' ||
          canonical === 'expectedBilling'
        ) {
          legacyFieldsPresent = true;
          if (canonical === 'expectedOrder' && declaration && declaration.expectedOrder) continue;
          fields[canonical] = normalizeProjectQuarter(value);
          continue;
        }

        if (canonical === 'status') {
          legacyFieldsPresent = true;
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

    const managedInfo = managed && managed.comment ? managed.comment : null;
    const managedFields = managedInfo ? managedInfo.fields : {};
    const managedExtra = managedInfo ? managedInfo.extraFields : {};

    if (managed && managed.duplicate) {
      pushProjectDiagnostic(
        diagnostics,
        'duplicate-managed-comment',
        managedInfo ? managedInfo.raw : '',
        startLine
      );
    }
    if (managedInfo) {
      for (const d of managedInfo.diagnostics) {
        pushProjectDiagnostic(diagnostics, d.code, d.detail, startLine);
      }
    }

    const managedIdRaw = normalizeProjectIdValue(managedFields.id);
    const managedId = PROJECT_ID_RE.test(managedIdRaw) ? managedIdRaw : '';
    const managedCreated =
      managedFields.created && isValidProjectIsoDate(managedFields.created) ? managedFields.created : '';
    const managedStage = String(managedFields.stage || '').trim();

    const managedDelivery =
      managedFields.delivery !== undefined && managedFields.delivery !== ''
        ? normalizeProjectQuarter(managedFields.delivery)
        : null;
    const managedBilling =
      managedFields.billing !== undefined && managedFields.billing !== ''
        ? normalizeProjectQuarter(managedFields.billing)
        : null;

    // Managed stage wins; legacy Status:/Stage: is a temporary read fallback
    // only. There is no automatic legacy-stage migration.
    const stage = managedStage || (fields.status !== undefined ? fields.status : '');

    const visibleValue =
      declaration && declaration.value !== null
        ? declaration.value
        : fields.value !== undefined
          ? fields.value
          : null;
    const visibleValueRaw =
      declaration && declaration.value !== null
        ? declaration.valueRaw
        : fields.valueRaw !== undefined
          ? fields.valueRaw
          : '';
    const visibleCurrency =
      declaration && declaration.currency
        ? declaration.currency
        : fields.currency !== undefined
          ? fields.currency
          : '';
    const visibleOrder =
      declaration && declaration.expectedOrder
        ? declaration.expectedOrder
        : fields.expectedOrder || normalizeProjectQuarter('');

    const nameKey = String(name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const metadataValid = Boolean(managedInfo && managedInfo.valid && !managed.duplicate);

    const project = {
      // Persistent managed identity (ACT 5A). Empty when unmanaged.
      projectId: managedId,
      name,
      nameKey,
      value: visibleValue,
      valueRaw: visibleValueRaw,
      currency: visibleCurrency,
      // `status` is retained for existing consumers; managed stage wins.
      status: stage,
      stage,
      // ACT 5B-3: State is a separate concept from Stage and from `closed`.
      // When absent, the READ MODEL derives `open`; parsing never writes it and
      // ACT 5A reconciliation never adds it. `stateRaw` keeps the exact stored
      // text (which may be non-canonical legacy text, preserved verbatim).
      state: canonicalProjectState(managedFields.state) || PROJECT_STATE_DEFAULT,
      stateRaw: String(managedFields.state || ''),
      stageCanonical: canonicalProjectStage(managedStage),
      stateCanonical: canonicalProjectState(managedFields.state),
      created: managedCreated,
      closed:
        managedFields.closed && isValidProjectIsoDate(managedFields.closed) ? managedFields.closed : '',
      archived: /^(true|false)$/i.test(String(managedFields.archived || ''))
        ? /^true$/i.test(String(managedFields.archived))
        : null,
      expectedOrder: visibleOrder,
      expectedDelivery:
        managedDelivery && managedDelivery.valid
          ? managedDelivery
          : fields.expectedDelivery || normalizeProjectQuarter(''),
      expectedBilling:
        managedBilling && managedBilling.valid
          ? managedBilling
          : fields.expectedBilling || normalizeProjectQuarter(''),
      description: fields.description !== undefined ? fields.description : '',
      extraFields: Object.assign({}, extraFields, managedExtra),
      legacyFieldsPresent,
      metadataManaged: metadataValid,
      metadataValid,
      // A Project with no adjacent comment needs reconciliation. A malformed or
      // duplicated comment is left unchanged and must NOT receive a new comment.
      needsReconciliation: !managedInfo,
      diagnostics,
      // Non-canonical managed text is reported separately so it can never make
      // a valid comment invalid.
      warnings: managedInfo && managedInfo.warnings ? managedInfo.warnings.slice() : [],
      sourcePath,
      sourceKind,
      sourceName,
      sourceLine: startLine,
    };

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

    // ACT 5A: fenced-code exclusion. Project-like text inside a fence is
    // ordinary Markdown and is never a Project declaration.
    const fencedSet = new Set();
    for (const [from, to] of computeFencedLineRanges(lines)) {
      for (let k = from; k <= to; k++) fencedSet.add(k);
    }
    const consumedManagedCommentLines = new Set();
    let i = 0;

    while (i < n) {
      if (fencedSet.has(i)) {
        i++;
        continue;
      }

      // ACT 5A: a Task checkbox line is never parsed as a Project declaration,
      // even when it carries Project-looking bracket text.
      if (isTaskCheckboxLine(lines[i])) {
        i++;
        continue;
      }

      const stripped = stripListPrefix(lines[i]);
      const pairs = parseInlinePairs(stripped);
      const first = pairs[0];

      if (first && normalizeProjectKey(first.key) === 'project') {
        const name = String(first.value || '').trim();

        if (name) {
          const startLine = i + 1 + lineOffset;
          const managed = associateManagedProjectComment(
            lines,
            i,
            fencedSet,
            consumedManagedCommentLines
          );
          const blockLines = [lines[i]];
          let j = i + 1;

          // Collect block until: another Project:, a heading, or EOF.
          while (j < n) {
            if (fencedSet.has(j)) break;
            if (isTaskCheckboxLine(lines[j])) break;
            const nextStripped = stripListPrefix(lines[j]);
            const nextPairs = parseInlinePairs(nextStripped);
            const nextFirst = nextPairs[0];

            if (nextFirst && normalizeProjectKey(nextFirst.key) === 'project') break;
            if (/^#{1,6}\s/.test(lines[j].trim())) break;

            // The managed comment is metadata, never legacy dictionary content.
            // Stopping here also prevents the block from swallowing the NEXT
            // Project's comment when two declarations are adjacent.
            const managedCommentLine = parseManagedProjectComment(lines[j]);
            if (managedCommentLine && managedCommentLine.present) break;

            blockLines.push(lines[j]);
            j++;
          }

          const project = buildProjectFromBlock(blockLines, {
            startLine,
            sourcePath,
            sourceKind,
            sourceName,
            managed,
          });
          projects.push(project);
          i = j;
          continue;
        }
      }

      i++;
    }

    // ACT 5A: duplicate managed identity diagnosis is document-wide; a comment
    // never associated with a Project is an orphan and is left unchanged.
    const seenIds = new Map();
    for (const p of projects) {
      const id = p.projectId;
      if (!id) continue;
      if (seenIds.has(id)) {
        pushProjectDiagnostic(p.diagnostics, 'duplicate-managed-id', '', p.sourceLine);
        seenIds.get(id).diagnostics.push({
          code: 'duplicate-managed-id',
          detail: '',
          line: p.sourceLine,
        });
      } else {
        seenIds.set(id, p);
      }
    }

    for (let k = 0; k < n; k++) {
      if (consumedManagedCommentLines.has(k)) continue;
      const parsed = parseManagedProjectComment(lines[k]);
      if (!parsed || !parsed.present) continue;
      projects.push({
        projectId: '',
        name: '',
        orphan: true,
        metadataManaged: false,
        metadataValid: false,
        needsReconciliation: false,
        diagnostics: [{ code: 'orphan-managed-comment', detail: '', line: k + 1 + lineOffset }],
        sourcePath,
        sourceKind,
        sourceName,
        sourceLine: k + 1 + lineOffset,
        orphanOnly: true,
      });
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

  // ============================================================
  // ACT 1C — saved Note metadata READ contract (read-only)
  // ============================================================
  //
  // These three helpers read managed classification fields from already-parsed
  // frontmatter. Nothing here writes, normalizes, adds or removes frontmatter,
  // and a malformed frontmatter simply degrades to the safe defaults below:
  //
  //   date    a valid YYYY-MM-DD frontmatter value takes precedence;
  //           otherwise only a filename that is exactly `YYYY-MM-DD.md`
  //           (case-insensitive extension, matching the ACT 1B scanner)
  //           contributes a date; otherwise '' (the existing parser
  //           convention). Body content, Task/Project dates and file times
  //           are never date sources.
  //   knowledge / pinned / archived
  //           true only for the supported frontmatter value `true`
  //           (case-insensitive). Absent, false and unsupported values
  //           resolve to false without rewriting the file.
  const FRONTMATTER_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;
  const DATED_NOTE_FILENAME = /^(\d{4}-\d{2}-\d{2})\.md$/i;

  function readFrontmatterDate(value) {
    const raw = typeof value === 'string' ? value.trim() : '';

    return FRONTMATTER_DATE_SHAPE.test(raw) ? raw : '';
  }

  function readFrontmatterFlag(value) {
    if (typeof value !== 'string') return false;

    return value.trim().toLowerCase() === 'true';
  }

  function inferDateFromDatedFilename(name) {
    const match = String(name || '').match(DATED_NOTE_FILENAME);

    return match ? match[1] : '';
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

    // ACT 1C title contract (parser-owned extraction, never editor text):
    // saved first valid H1 in the frontmatter BODY → filename basename.
    // The body is passed so frontmatter lines can never be title candidates;
    // fenced-code exclusion is owned by getMarkdownTitle in main.js.
    const title = getMarkdownTitle(
      parsedFrontmatter.body,
      String(name || '').replace(/\.md$/i, '')
    );

    // ACT 1C date contract: valid frontmatter date → exactly dated filename
    // → '' (existing empty convention). The former body-visible and
    // any-date-in-path/text inference is intentionally gone.
    const date =
      readFrontmatterDate(parsedFrontmatter.data?.date) ||
      inferDateFromDatedFilename(name) ||
      '';

    return {
      kind,
      name,
      path,
      title,
      date,
      knowledge: readFrontmatterFlag(parsedFrontmatter.data?.knowledge),
      pinned: readFrontmatterFlag(parsedFrontmatter.data?.pinned),
      archived: readFrontmatterFlag(parsedFrontmatter.data?.archived),
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

  // ==============================
  // ACT 5A — Pure Project reconciliation owner
  // ==============================

  // The ID generator and `today` are INJECTED. This owner never reads the wall
  // clock, never writes a file, never opens a handle and never mutates the
  // Workspace Index. It only proposes Markdown.
  function reconcileManagedProjects(markdownText, options) {
    const opts = options || {};
    const text = String(markdownText == null ? '' : markdownText);
    const today = String(opts.today == null ? '' : opts.today);
    const generateId =
      typeof opts.generateId === 'function' ? opts.generateId : () => '';

    const result = {
      text,
      changed: false,
      inserted: 0,
      unchanged: 0,
      ambiguous: 0,
      malformed: 0,
      diagnostics: [],
      projects: [],
      skippedReason: '',
    };

    if (!isValidProjectIsoDate(today)) {
      result.skippedReason = 'invalid-today';
      return result;
    }

    const lines = text.split(/\r?\n/);
    const projects = parseProjects(text, {});

    // Rebuild bottom-up so earlier insertions cannot shift later line indexes.
    const insertions = [];
    const generatedIds = new Set();

    for (const project of projects) {
      if (project.orphanOnly) {
        result.diagnostics.push(...project.diagnostics);
        continue;
      }

      const hasManagedComment = !project.needsReconciliation;

      if (!hasManagedComment) {
        const raw = generateId();
        const id = normalizeProjectIdValue(raw);
        const comment = serializeManagedProjectComment({ id, created: today });

        if (!PROJECT_ID_RE.test(id) || generatedIds.has(id)) {
          // Ambiguous identity: refuse to write rather than mint a fallback ID.
          result.ambiguous++;
          pushProjectDiagnostic(result.diagnostics, 'invalid-managed-id', '', project.sourceLine);
          continue;
        }

        generatedIds.add(id);
        insertions.push({ afterLine: project.sourceLine, comment, id, sourceLine: project.sourceLine });
        result.inserted++;
        result.projects.push({
          sourceLine: project.sourceLine,
          projectId: id,
          created: today,
          action: 'inserted',
        });
        continue;
      }

      // A comment is present. A malformed or duplicated one is left unchanged
      // and never receives a competing comment.
      const malformedCodes = project.diagnostics.filter((d) =>
        /^(malformed-managed-comment|duplicate-managed-comment|missing-managed-id|invalid-managed-id|missing-created|invalid-created|duplicate-managed-id|invalid-delivery-quarter|invalid-billing-quarter|invalid-closed-date|invalid-archived-value)$/.test(
          d.code
        )
      );

      if (!project.metadataValid || malformedCodes.length) {
        result.malformed++;
        result.diagnostics.push(...project.diagnostics);
        result.projects.push({
          sourceLine: project.sourceLine,
          projectId: project.projectId || '',
          action: 'malformed',
        });
        continue;
      }

      result.unchanged++;
      result.diagnostics.push(...project.diagnostics);
      result.projects.push({
        sourceLine: project.sourceLine,
        projectId: project.projectId || '',
        created: project.created || '',
        action: 'unchanged',
      });
    }

    if (!insertions.length) return result;

    for (const insertion of insertions.slice().reverse()) {
      lines.splice(insertion.afterLine, 0, insertion.comment);
    }

    result.text = lines.join('\n');
    result.changed = true;
    return result;
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
    // ACT 5A — Managed Project foundation.
    parseProjectDeclarationValue,
    parseManagedProjectComment,
    serializeManagedProjectComment,
    canonicalProjectStage,
    projectStageLabel,
    canonicalProjectState,
    projectStateLabel,
    PROJECT_STAGE_CANONICAL,
    PROJECT_STATE_CANONICAL,
    PROJECT_STATE_DEFAULT,
    reconcileManagedProjects,
    isValidProjectIsoDate,
    isProjectIdValue,
    computeFencedLineRanges,
    isTaskCheckboxLine,
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

    // ACT 5A — Managed Project foundation (module-level globals so the Save
    // owner can reach the pure reconciliation without a new import graph).
    globalThis.parseProjectDeclarationValue = parseProjectDeclarationValue;
    globalThis.parseManagedProjectComment = parseManagedProjectComment;
    globalThis.serializeManagedProjectComment = serializeManagedProjectComment;
    globalThis.canonicalProjectStage = canonicalProjectStage;
    globalThis.projectStageLabel = projectStageLabel;
    globalThis.canonicalProjectState = canonicalProjectState;
    globalThis.projectStateLabel = projectStateLabel;
    globalThis.PROJECT_STAGE_CANONICAL = PROJECT_STAGE_CANONICAL;
    globalThis.PROJECT_STATE_CANONICAL = PROJECT_STATE_CANONICAL;
    globalThis.PROJECT_STATE_DEFAULT = PROJECT_STATE_DEFAULT;
    globalThis.reconcileManagedProjects = reconcileManagedProjects;
    globalThis.isValidProjectIsoDate = isValidProjectIsoDate;
    globalThis.isProjectIdValue = isProjectIdValue;
  } catch {}
})();
