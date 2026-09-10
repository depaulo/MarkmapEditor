// @ts-nocheck
// ACT E — Report Dictionary. Pure data preparation. No UI, no DOM, no file ops.
(function () {
  'use strict';

  const SCHEMA_VERSION = 'mme-report-dictionary-v1';

  const DEFAULT_SECTION_ORDER = Object.freeze([
    { id: 'summary', label: 'Summary & Highlights', enabled: true },
    { id: 'completed-tasks', label: 'Completed Tasks', enabled: true },
    { id: 'project-forecast', label: 'Project Forecast', enabled: true },
    { id: 'forecast-totals', label: 'Forecast Totals', enabled: true },
    { id: 'risks', label: 'Risks and Attention Points', enabled: true },
    { id: 'next-steps', label: 'Next Steps', enabled: true },
    { id: 'undated-completed-tasks', label: 'Completed Tasks Without Date', enabled: false },
  ]);

  const SECTION_BY_ID = (() => {
    const m = {};
    for (const s of DEFAULT_SECTION_ORDER) m[s.id] = s;
    return m;
  })();

  const NOTE_ALIASES = Object.freeze({
    report: 'report.title',
    title: 'report.title',
    summary: 'report.summary',
    highlights: 'report.highlights',
    risks: 'report.risks',
    'risks and attention points': 'report.risks',
    'next steps': 'report.next_steps',
    actions: 'report.next_steps',
    'management notes': 'report.management_notes',
    notes: 'report.management_notes',
  });

  // Canonical brace-token normalization: {{field name}} -> field name (lowercase, collapsed spaces).
  function normalizeBraceToken(rawKey) {
    const str = String(rawKey || '').trim();
    const m = str.match(/^\{\{\s*([\s\S]*?)\s*\}\}$/);
    if (!m) return null;
    const inner = String(m[1] || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    return inner || null;
  }

  const PROJECT_MODES = Object.freeze(['all', 'with-value', 'without-value']);

  function isValidCalendarDate(v) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const p = v.split('-');
    const y = Number(p[0]),
      mo = Number(p[1]),
      d = Number(p[2]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
  }

  function normalizeReportRange(startDate, endDate) {
    if (!isValidCalendarDate(startDate))
      return {
        ok: false,
        error: 'invalid-start-date',
        message: 'Invalid start date: ' + String(startDate),
      };
    if (!isValidCalendarDate(endDate))
      return {
        ok: false,
        error: 'invalid-end-date',
        message: 'Invalid end date: ' + String(endDate),
      };
    if (startDate > endDate)
      return {
        ok: false,
        error: 'start-after-end',
        message: 'Start date must be before or equal to end date.',
      };
    return { ok: true, reportRange: { startDate, endDate, inclusive: true } };
  }

  function normalizeReportKey(rawKey) {
    const key = String(rawKey || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (!key) return null;
    // Brace-token canonical form: {{summary}} -> summary (canonical key, no report. prefix).
    const braceInner = normalizeBraceToken(key);
    if (braceInner) {
      // Canonical key is the normalized inner content (e.g. 'next steps', 'ali summary').
      return braceInner;
    }
    if (NOTE_ALIASES[key]) return NOTE_ALIASES[key];
    return key.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function getNoteLabel(nk) {
    const m = {
      'report.title': 'Report Title',
      'report.summary': 'Summary',
      'report.highlights': 'Highlights',
      'report.risks': 'Risks and Attention Points',
      'report.next_steps': 'Next Steps',
      'report.management_notes': 'Management Notes',
      title: 'Report Title',
      summary: 'Summary',
      highlights: 'Highlights',
      risks: 'Risks and Attention Points',
      'next steps': 'Next Steps',
      'management notes': 'Management Notes',
    };
    return m[nk] || nk;
  }

  function parseReportNotes(reportNotes, injectedPairs) {
    const notes = [];
    const diagnostics = [];
    let pairs = injectedPairs;
    let order = 0;

    if (!Array.isArray(pairs)) {
      // Pre-scan: extract {{field name}}: tokenized lines BEFORE parser dispatch.
      // This is independent of WORKSPACE_PARSER availability.
      //
      // Two accepted field forms:
      //   INLINE:    {{field}}: value on one line (blank value allowed)
      //   MULTILINE: {{field}}: with no non-whitespace value after the colon
      //              opens a block that ends ONLY at the exact matching
      //              {{/field}} token. Blank lines, emphasis, and flat lists
      //              inside the block are preserved as the field value.
      // Any other non-empty line is text outside a field and is reported as
      // a blocking diagnostic (no entered text may disappear silently).
      const lines = String(reportNotes || '').split(/\r?\n/);
      const nonBraceLines = [];
      const normalizeKeyInner = (s) =>
        String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const NOTES_FRIENDLY_KEY_RE = /^[A-Za-z][A-Za-z0-9 _-]*\s*:/;
      const NOTES_CLOSE_RE = /^\{\{\s*\/\s*([\s\S]*?)\s*\}\}$/;
      const NOTES_OPEN_RE = /^\{\{\s*([\s\S]*?)\s*\}\}\s*:\s*(.*)$/;

      let lineIdx = 0;
      while (lineIdx < lines.length) {
        const raw = lines[lineIdx];
        lineIdx += 1;
        const t = raw.trim();
        if (!t) continue;

        // Closing marker while not inside a block: stray close.
        const strayClose = t.match(NOTES_CLOSE_RE);
        if (strayClose) {
          const closeKey = normalizeKeyInner(strayClose[1]);
          diagnostics.push({
            code: 'notes-stray-close',
            message: `Report Notes has the closing tag {{/${closeKey}}} without a matching opening.`,
          });
          continue;
        }

        // Handle {{field name}}: tokenized format
        const braceMatch = t.match(NOTES_OPEN_RE);
        if (braceMatch) {
          const nk = normalizeKeyInner(braceMatch[1]);
          if (!nk) {
            diagnostics.push({
              code: 'note-invalid-key',
              message: 'Invalid report note key: ' + String(braceMatch[1] || '').trim(),
            });
            continue;
          }
          const inlineValue = String(braceMatch[2] || '').trim();
          if (inlineValue) {
            notes.push({
              key: nk,
              token: '{{' + nk + '}}',
              label: getNoteLabel(nk),
              value: inlineValue,
              order,
            });
            order += 1;
            continue;
          }

          // MULTILINE block: ends only at the exact matching {{/nk}} token.
          // Disambiguation for the blank-field scaffold: when the next
          // non-blank line is another field marker (opening or closing),
          // this "{{field}}:" line is a BLANK inline field, not a block —
          // there is no content to assign, so nothing is implicitly
          // terminated. Only actual content before the close forms a block,
          // and a content block never ends at another field marker.
          const label = getNoteLabel(nk);
          let peek = lineIdx;
          let nextNonBlank = '';
          while (peek < lines.length) {
            const probe = lines[peek].trim();
            if (probe) { nextNonBlank = probe; break; }
            peek += 1;
          }
          const nextIsFieldMarker =
            !nextNonBlank ||
            NOTES_CLOSE_RE.test(nextNonBlank) ||
            NOTES_OPEN_RE.test(nextNonBlank);
          // A "{{field}}:" line followed by its own matching close with no
          // content between is a BLANK block field (a deliberately empty
          // scaffold), not an error — the closing tag is consumed as part of
          // the blank field, ahead of the "next is a field marker" branch.
          if (nextIsFieldMarker && nextNonBlank && NOTES_CLOSE_RE.test(nextNonBlank)) {
            const closePeek = normalizeKeyInner(nextNonBlank.match(NOTES_CLOSE_RE)[1]);
            if (closePeek === nk) {
              lineIdx = peek + 1;
              notes.push({
                key: nk,
                token: '{{' + nk + '}}',
                label,
                value: '',
                order,
              });
              order += 1;
              continue;
            }
          }
          if (nextIsFieldMarker) {
            notes.push({
              key: nk,
              token: '{{' + nk + '}}',
              label,
              value: '',
              order,
            });
            order += 1;
            continue;
          }

          const blockLines = [];
          let closed = false;
          while (lineIdx < lines.length) {
            const blockRaw = lines[lineIdx];
            lineIdx += 1;
            const bt = blockRaw.trim();
            if (!bt) {
              if (blockLines.length) blockLines.push(blockRaw);
              continue;
            }
            const closeMatch = bt.match(NOTES_CLOSE_RE);
            if (closeMatch) {
              const closeKey = normalizeKeyInner(closeMatch[1]);
              if (closeKey === nk) {
                closed = true;
                break;
              }
              diagnostics.push({
                code: 'notes-mismatched-close',
                message: `Expected the closing tag {{/${nk}}}, but found {{/${closeKey}}}.`,
              });
              continue;
            }
            const nestedOpen = bt.match(NOTES_OPEN_RE);
            if (nestedOpen) {
              const nestedKey = normalizeKeyInner(nestedOpen[1]);
              diagnostics.push({
                code: 'notes-nested-field',
                message: `Expected the closing tag {{/${nk}}} before starting the field {{${nestedKey}}}.`,
              });
              continue;
            }
            blockLines.push(blockRaw);
          }
          if (!closed) {
            diagnostics.push({
              code: 'notes-unclosed-block',
              message: `${label} is missing its closing tag {{/${nk}}}.`,
            });
          }
          const blockValue = blockLines
            .join('\n')
            .replace(/^\s*\n/, '')
            .replace(/\s+$/, '');
          notes.push({
            key: nk,
            token: '{{' + nk + '}}',
            label,
            value: blockValue,
            order,
          });
          order += 1;
          continue;
        }

        // Friendly one-line "Key: value" fields remain accepted.
        // Any other non-empty line is text outside a field: report it as a
        // blocking diagnostic instead of passing it on for silent dropping.
        if (NOTES_FRIENDLY_KEY_RE.test(t)) {
          nonBraceLines.push(t);
        } else {
          diagnostics.push({
            code: 'notes-text-outside-field',
            message: `Report Notes contains text outside a field: "${t.length > 80 ? t.slice(0, 80) + '…' : t}"`,
          });
        }
      }

      const parser =
        (typeof globalThis !== 'undefined' && globalThis.WORKSPACE_PARSER?.parseDictionaryPairs) ||
        (typeof window !== 'undefined' && window.WORKSPACE_PARSER?.parseDictionaryPairs) ||
        null;
      if (parser) {
        try {
          pairs = parser(nonBraceLines.join('\n'));
        } catch (e) {
          diagnostics.push({
            code: 'notes-parse-failed',
            message: 'Report Notes parsing failed: ' + (e?.message || e),
          });
          pairs = [];
        }
      } else {
        pairs = [];
        for (const t of nonBraceLines) {
          const m = t.match(/^([A-Za-z][A-Za-z0-9 _-]*)\s*:\s*(.*)$/);
          if (m) pairs.push({ key: m[1].trim(), value: m[2].trim() });
          else diagnostics.push({ code: 'note-malformed', message: 'Malformed note line: ' + t });
        }
      }
    }

    for (const pair of pairs || []) {
      const rawKey = pair?.key;
      const rawValue = pair?.value;
      if (rawKey == null || String(rawKey).trim() === '') {
        diagnostics.push({ code: 'note-missing-key', message: 'Report note missing key.' });
        continue;
      }
      const nk = normalizeReportKey(rawKey);
      if (!nk) {
        diagnostics.push({
          code: 'note-invalid-key',
          message: 'Invalid report note key: ' + String(rawKey),
        });
        continue;
      }
      notes.push({
        key: nk,
        label: getNoteLabel(nk),
        value: String(rawValue == null ? '' : rawValue).trim(),
        order,
      });
      order += 1;
    }
    return { notes, diagnostics };
  }

  // ---------------------------------------------------------------------
  // Inline Report Notes contract validation.
  //
  // Report Notes is a structured pre-generation input. Two accepted field
  // forms exist — INLINE "{{field}}: value" and MULTILINE "{{field}}:" …
  // "{{/field}}" blocks — plus legacy friendly "Key: value" one-line
  // fields. Everything else is invalid and BLOCKS generation:
  //   - missing block close;
  //   - mismatched block close;
  //   - a nested field opened before the current block closes;
  //   - a stray closing tag without a matching opening;
  //   - non-empty text outside any field (no silent data loss).
  // Blank/whitespace lines outside fields are accepted. Duplicate fields
  // follow the current duplicate policy (entries kept; later value wins at
  // field build). Pure reader: never mutates its input. The generator
  // renders field values under normal Markdown headings — Notes markers
  // never appear in the generated Report.
  // ---------------------------------------------------------------------
  function validateReportNotes(reportNotes) {
    const result = parseReportNotes(reportNotes);
    return {
      ok: result.diagnostics.length === 0,
      diagnostics: result.diagnostics.slice(),
    };
  }

  function projectTask(t) {
    if (!t || typeof t !== 'object') return null;
    return {
      text: t.text || '',
      done: Boolean(t.done),
      completedDate: t.completedDate != null ? t.completedDate : null,
      dueDate: t.dueDate != null ? t.dueDate : null,
      priority: t.priority != null ? t.priority : null,
      owner: t.owner != null ? t.owner : null,
      sourcePath: t.sourcePath || t.filePath || '',
      sourceLine: t.sourceLine != null ? t.sourceLine : t.line != null ? t.line : null,
      sourceKind: t.sourceKind || t.fileKind || t.kind || '',
      sourceDate: t.sourceDate != null ? t.sourceDate : null,
    };
  }

  function selectCompletedTasks(indexState, reportRange, includeUndated) {
    const tasks = Array.isArray(indexState?.tasks) ? indexState.tasks : [];
    const completed = [];
    const completedUndated = [];
    const diagnostics = [];

    for (const raw of tasks) {
      if (!raw || raw.done !== true) continue;
      const p = projectTask(raw);
      if (!p) continue;
      const cd = p.completedDate;
      if (cd && isValidCalendarDate(cd)) {
        if (cd >= reportRange.startDate && cd <= reportRange.endDate) completed.push(p);
      } else {
        if (cd != null && cd !== '') {
          diagnostics.push({
            code: 'task-invalid-completed-date',
            message: 'Task has invalid completed date: ' + String(cd),
            sourcePath: p.sourcePath,
            sourceLine: p.sourceLine,
          });
        }
        completedUndated.push(p);
      }
    }

    completed.sort((a, b) => {
      const da = a.completedDate || '',
        db = b.completedDate || '';
      if (da !== db) return da < db ? -1 : 1;
      const pa = a.sourcePath || '',
        pb = b.sourcePath || '';
      if (pa !== pb) return pa < pb ? -1 : 1;
      return (a.sourceLine || 0) - (b.sourceLine || 0);
    });

    completedUndated.sort((a, b) => {
      const pa = a.sourcePath || '',
        pb = b.sourcePath || '';
      if (pa !== pb) return pa < pb ? -1 : 1;
      return (a.sourceLine || 0) - (b.sourceLine || 0);
    });

    if (completedUndated.length > 0 && !includeUndated) {
      diagnostics.push({
        code: 'undated-completions-excluded',
        message:
          completedUndated.length +
          ' historical completed Task(s) without a date were excluded from the dated completion list.',
      });
    }
    return { completed, completedUndated, diagnostics };
  }

  function selectOpenTasks(indexState) {
    const tasks = Array.isArray(indexState?.tasks) ? indexState.tasks : [];
    const open = [];
    for (const raw of tasks) {
      if (!raw || raw.done === true) continue;
      const p = projectTask(raw);
      if (p) open.push(p);
    }
    open.sort((a, b) => {
      const pa = a.sourcePath || '',
        pb = b.sourcePath || '';
      if (pa !== pb) return pa < pb ? -1 : 1;
      return (a.sourceLine || 0) - (b.sourceLine || 0);
    });
    return open;
  }

  function projectProject(pr) {
    if (!pr || typeof pr !== 'object') return null;
    const q = (x) => {
      if (!x || typeof x !== 'object') return null;
      return {
        raw: x.raw || '',
        canonical: x.canonical || null,
        display: x.display || '',
        valid: Boolean(x.valid),
      };
    };
    return {
      name: pr.name || '',
      status: pr.status || '',
      value: pr.value != null ? pr.value : null,
      valueRaw: pr.valueRaw != null ? pr.valueRaw : '',
      currency: pr.currency || '',
      expectedOrder: q(pr.expectedOrder),
      expectedBilling: q(pr.expectedBilling),
      expectedDelivery: q(pr.expectedDelivery),
      description: pr.description || '',
      sourcePath: pr.sourcePath || '',
      sourceLine: pr.sourceLine != null ? pr.sourceLine : null,
      sourceKind: pr.sourceKind || '',
      sourceName: pr.sourceName || '',
    };
  }

  function selectProjects(indexState, projectMode) {
    const projects = Array.isArray(indexState?.projects) ? indexState.projects : [];
    const diagnostics = [];
    const mode = PROJECT_MODES.includes(projectMode) ? projectMode : 'all';
    if (!PROJECT_MODES.includes(projectMode)) {
      diagnostics.push({
        code: 'invalid-project-mode',
        message: 'Invalid project mode: ' + String(projectMode) + '. Using "all".',
      });
    }
    const selected = [];
    for (const raw of projects) {
      const p = projectProject(raw);
      if (!p) continue;
      const hasValue = Number.isFinite(p.value);
      if (mode === 'with-value' && !hasValue) continue;
      if (mode === 'without-value' && hasValue) continue;
      if (hasValue && !p.currency.trim()) {
        diagnostics.push({
          code: 'project-value-without-currency',
          message: 'Project "' + p.name + '" has a value but no currency.',
          sourcePath: p.sourcePath,
          sourceLine: p.sourceLine,
        });
      }
      selected.push(p);
    }
    return { projects: selected, diagnostics };
  }

  function calculateProjectTotals(projects) {
    const totalsByCurrency = new Map();
    let valuedWithoutCurrencyCount = 0;
    for (const p of projects || []) {
      if (!Number.isFinite(p.value)) continue;
      const c = String(p.currency || '').trim();
      if (!c) {
        valuedWithoutCurrencyCount += 1;
        continue;
      }
      if (!totalsByCurrency.has(c))
        totalsByCurrency.set(c, { currency: c, projectCount: 0, totalValue: 0 });
      const e = totalsByCurrency.get(c);
      e.projectCount += 1;
      e.totalValue += p.value;
    }
    const totals = Array.from(totalsByCurrency.values()).sort((a, b) =>
      a.currency < b.currency ? -1 : 1
    );
    return { totals, valuedWithoutCurrencyCount };
  }

  function normalizeSectionOrder(userSections) {
    const diagnostics = [];
    const seen = new Set();
    const ordered = [];

    for (const s of userSections || []) {
      const id = s?.id;
      if (!id || !SECTION_BY_ID[id]) {
        diagnostics.push({ code: 'unknown-section', message: 'Unknown section id: ' + String(id) });
        continue;
      }
      if (seen.has(id)) {
        diagnostics.push({ code: 'duplicate-section', message: 'Duplicate section id: ' + id });
        continue;
      }
      seen.add(id);
      ordered.push({
        id,
        label: SECTION_BY_ID[id].label,
        enabled: s.enabled !== false,
        order: ordered.length,
      });
    }

    for (const s of DEFAULT_SECTION_ORDER) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      ordered.push({ id: s.id, label: s.label, enabled: s.enabled, order: ordered.length });
    }

    return { sections: ordered, diagnostics };
  }

  function buildReportDictionary(input) {
    const indexState = input?.indexState || {};
    const startDate = input?.startDate;
    const endDate = input?.endDate;
    const sections = input?.sections;
    const projectMode = input?.projectMode || 'all';
    const reportNotes = input?.reportNotes;
    const options = input?.options || {};
    const generatedAt = input?.generatedAt || new Date().toISOString();

    const rangeResult = normalizeReportRange(startDate, endDate);
    if (!rangeResult.ok) {
      return {
        ok: false,
        error: rangeResult.error,
        message: rangeResult.message,
        schemaVersion: SCHEMA_VERSION,
        generatedAt,
      };
    }

    const reportRange = rangeResult.reportRange;
    const diagnostics = [];

    const notesResult = parseReportNotes(reportNotes, options?.injectedPairs);
    diagnostics.push(...notesResult.diagnostics);

    const sectionResult = normalizeSectionOrder(sections);
    diagnostics.push(...sectionResult.diagnostics);

    const includeUndated = sectionResult.sections.some(
      (s) => s.id === 'undated-completed-tasks' && s.enabled
    );

    const taskResult = selectCompletedTasks(indexState, reportRange, includeUndated);
    diagnostics.push(...taskResult.diagnostics);

    const openTasks = selectOpenTasks(indexState);
    const projectResult = selectProjects(indexState, projectMode);
    diagnostics.push(...projectResult.diagnostics);

    const totalsResult = calculateProjectTotals(projectResult.projects);

    return {
      ok: true,
      schemaVersion: SCHEMA_VERSION,
      generatedAt,
      reportRange,
      options: { projectMode, includeUndated },
      workspace: {
        ready: Boolean(indexState.ready),
        lastBuiltAt: indexState.lastBuiltAt != null ? indexState.lastBuiltAt : null,
      },
      summary: {
        completedCount: taskResult.completed.length,
        completedUndatedCount: taskResult.completedUndated.length,
        openCount: openTasks.length,
        projectCount: projectResult.projects.length,
        projectMode,
      },
      journals: [],
      tasks: {
        completed: taskResult.completed,
        completedUndated: taskResult.completedUndated,
        open: openTasks,
      },
      projects: {
        mode: projectMode,
        items: projectResult.projects,
        totalsByCurrency: totalsResult.totals,
        valuedWithoutCurrencyCount: totalsResult.valuedWithoutCurrencyCount,
      },
      tags: [],
      relationships: [],
      notes: notesResult.notes,
      sections: sectionResult.sections,
      diagnostics,
    };
  }


  // ---- Dormant validation fixtures ----

  function makeFixtureIndex() {
    const q = (raw, canonical, display, valid) => ({ raw, canonical, display, valid });
    return {
      ready: true,
      lastBuiltAt: 1234567890,
      tasks: [
        { done: true, text: 'Task on start', completedDate: '2026-08-03', line: 1, filePath: 'journals/a.md', fileKind: 'journals' },
        { done: true, text: 'Task on end', completedDate: '2026-08-09', line: 2, filePath: 'journals/a.md', fileKind: 'journals' },
        { done: true, text: 'Task outside', completedDate: '2026-08-10', line: 3, filePath: 'journals/a.md', fileKind: 'journals' },
        { done: true, text: 'Historical undated', completedDate: null, line: 4, filePath: 'journals/b.md', fileKind: 'journals' },
        { done: false, text: 'Open with due', dueDate: '2026-08-15', line: 5, filePath: 'journals/b.md', fileKind: 'journals' },
        { done: true, text: 'Invalid date', completedDate: '2026-02-30', line: 6, filePath: 'journals/c.md', fileKind: 'journals' },
      ],
      projects: [
        { name: 'Alpha', value: 50000, currency: 'USD', status: 'Quotation', expectedOrder: q('26Q4', '2026-Q4', '26Q4', true), expectedBilling: q('27Q1', '2027-Q1', '27Q1', true), expectedDelivery: q('27Q1', '2027-Q1', '27Q1', true), sourcePath: 'journals/a.md', sourceLine: 10, sourceKind: 'journals', sourceName: 'a.md' },
        { name: 'Beta', value: 0, currency: 'BRL', status: 'Proposal', expectedOrder: q('26Q3', '2026-Q3', '26Q3', true), expectedBilling: q('', null, '', false), expectedDelivery: q('', null, '', false), sourcePath: 'journals/a.md', sourceLine: 20, sourceKind: 'journals', sourceName: 'a.md' },
        { name: 'Gamma', value: null, currency: '', status: 'Lead', expectedOrder: q('', null, '', false), expectedBilling: q('', null, '', false), expectedDelivery: q('', null, '', false), sourcePath: 'journals/b.md', sourceLine: 30, sourceKind: 'journals', sourceName: 'b.md' },
        { name: 'Delta', value: 30000, currency: '', status: 'Quotation', expectedOrder: q('26Q2', '2026-Q2', '26Q2', true), expectedBilling: q('', null, '', false), expectedDelivery: q('', null, '', false), sourcePath: 'journals/b.md', sourceLine: 40, sourceKind: 'journals', sourceName: 'b.md' },
      ],
    };
  }

  function validateReportDictionary() {
    const results = [];
    const check = (label, actual, expected) => {
      const pass = JSON.stringify(actual) === JSON.stringify(expected);
      results.push({ label, pass, actual, expected });
    };

    const idx = makeFixtureIndex();
    const idxBefore = JSON.stringify(idx);

    // 1. valid inclusive range
    const r1 = normalizeReportRange('2026-08-03', '2026-08-09');
    check('valid range ok', r1.ok, true);
    check('valid range inclusive', r1.reportRange?.inclusive, true);

    // 2. invalid calendar date
    const r2 = normalizeReportRange('2026-02-30', '2026-08-09');
    check('invalid start date', r2.ok, false);
    check('invalid start error', r2.error, 'invalid-start-date');

    // 3. start after end
    const r3 = normalizeReportRange('2026-08-10', '2026-08-09');
    check('start after end', r3.ok, false);
    check('start after end error', r3.error, 'start-after-end');

    // 4-8. Task selection
    const dict = buildReportDictionary({
      indexState: idx,
      startDate: '2026-08-03',
      endDate: '2026-08-09',
      sections: [{ id: 'completed-tasks', enabled: true }],
      projectMode: 'all',
      generatedAt: '2026-08-09T00:00:00.000Z',
    });

    check('dict ok', dict.ok, true);
    check('completed on start', dict.tasks.completed.some((t) => t.text === 'Task on start'), true);
    check('completed on end', dict.tasks.completed.some((t) => t.text === 'Task on end'), true);
    check('completed outside excluded', dict.tasks.completed.some((t) => t.text === 'Task outside'), false);
    check('undated excluded from dated', dict.tasks.completed.some((t) => t.text === 'Historical undated'), false);
    check('undated in undated list', dict.tasks.completedUndated.some((t) => t.text === 'Historical undated'), true);
    check('open task present', dict.tasks.open.some((t) => t.text === 'Open with due'), true);
    check('open task due preserved', dict.tasks.open.find((t) => t.text === 'Open with due')?.dueDate, '2026-08-15');
    check('invalid date in undated', dict.tasks.completedUndated.some((t) => t.text === 'Invalid date'), true);

    // 9-17. Project selection
    const allDict = buildReportDictionary({
      indexState: idx,
      startDate: '2026-08-03',
      endDate: '2026-08-09',
      sections: [],
      projectMode: 'all',
      generatedAt: '2026-08-09T00:00:00.000Z',
    });
    check('all projects count', allDict.projects.items.length, 4);

    const withValue = buildReportDictionary({
      indexState: idx,
      startDate: '2026-08-03',
      endDate: '2026-08-09',
      sections: [],
      projectMode: 'with-value',
      generatedAt: '2026-08-09T00:00:00.000Z',
    });
    check('with-value count', withValue.projects.items.length, 3);
    check('zero value included', withValue.projects.items.some((p) => p.name === 'Beta'), true);

    const withoutValue = buildReportDictionary({
      indexState: idx,
      startDate: '2026-08-03',
      endDate: '2026-08-09',
      sections: [],
      projectMode: 'without-value',
      generatedAt: '2026-08-09T00:00:00.000Z',
    });
    check('without-value count', withoutValue.projects.items.length, 1);
    check('without-value name', withoutValue.projects.items[0]?.name, 'Gamma');

    // 15-16. Totals
    const totals = calculateProjectTotals(withValue.projects.items);
    check('totals count', totals.totals.length, 2);
    check('USD total', totals.totals.find((t) => t.currency === 'USD')?.totalValue, 50000);
    check('BRL total', totals.totals.find((t) => t.currency === 'BRL')?.totalValue, 0);
    check('valued without currency', totals.valuedWithoutCurrencyCount, 1);

    // 17. missing Expected Order
    check('missing order canonical', withValue.projects.items.find((p) => p.name === 'Beta')?.expectedOrder?.canonical, '2026-Q3');

    // 18-19. Report Notes
    const notesResult = parseReportNotes('Title: Weekly Report\nSummary: Main activity\nBad Line Here\nNext Steps: Review');
    check('notes count', notesResult.notes.length, 3);
    check('notes title key', notesResult.notes[0]?.key, 'report.title');
    check('notes summary key', notesResult.notes[1]?.key, 'report.summary');
    check('notes malformed diag', notesResult.diagnostics.some((d) => d.code === 'notes-text-outside-field' && d.message.includes('Bad Line Here')), true);

    // 20-23. Sections
    const secResult = normalizeSectionOrder([
      { id: 'next-steps', enabled: true },
      { id: 'summary', enabled: false },
      { id: 'summary', enabled: true },
      { id: 'unknown-id', enabled: true },
    ]);
    check('sections count', secResult.sections.length, 7);
    check('sections first', secResult.sections[0]?.id, 'next-steps');
    check('sections second', secResult.sections[1]?.id, 'summary');
    check('sections summary disabled', secResult.sections[1]?.enabled, false);
    check('sections duplicate diag', secResult.diagnostics.some((d) => d.code === 'duplicate-section'), true);
    check('sections unknown diag', secResult.diagnostics.some((d) => d.code === 'unknown-section'), true);

    // 24-25. Empty workspace
    const emptyDict = buildReportDictionary({
      indexState: { ready: true, tasks: [], projects: [] },
      startDate: '2026-08-03',
      endDate: '2026-08-09',
      sections: [],
      projectMode: 'all',
      generatedAt: '2026-08-09T00:00:00.000Z',
    });
    check('empty dict ok', emptyDict.ok, true);
    check('empty tasks', emptyDict.tasks.completed.length, 0);
    check('empty projects', emptyDict.projects.items.length, 0);

    // 26. source provenance
    check('task sourcePath', dict.tasks.completed[0]?.sourcePath, 'journals/a.md');
    check('project sourcePath', withValue.projects.items[0]?.sourcePath, 'journals/a.md');

    // 27. deterministic with injected generatedAt
    const dict2 = buildReportDictionary({
      indexState: idx,
      startDate: '2026-08-03',
      endDate: '2026-08-09',
      sections: [{ id: 'completed-tasks', enabled: true }],
      projectMode: 'all',
      generatedAt: '2026-08-09T00:00:00.000Z',
    });
    check('deterministic generatedAt', dict2.generatedAt, '2026-08-09T00:00:00.000Z');

    // 30. no mutation of source fixtures
    const idxAfter = JSON.stringify(idx);
    check('no source mutation', idxAfter, idxBefore);

    // 31-34. source-reference isolation (Task)
    const srcTask = { done: true, text: 'Source Task', completedDate: '2026-08-03', line: 1, filePath: 'journals/a.md', fileKind: 'journals' };
    const srcProject = { name: 'SrcProj', value: 1000, currency: 'USD', status: 'Quotation', expectedOrder: { raw: '26Q4', canonical: '2026-Q4', display: '26Q4', valid: true }, expectedBilling: { raw: '', canonical: null, display: '', valid: false }, expectedDelivery: { raw: '', canonical: null, display: '', valid: false }, sourcePath: 'journals/a.md', sourceLine: 10, sourceKind: 'journals', sourceName: 'a.md' };
    const isoIdx = { ready: true, tasks: [srcTask], projects: [srcProject] };
    const isoDict1 = buildReportDictionary({ indexState: isoIdx, startDate: '2026-08-03', endDate: '2026-08-09', sections: [], projectMode: 'all', generatedAt: '2026-08-09T00:00:00.000Z' });
    const isoDictPre = buildReportDictionary({ indexState: isoIdx, startDate: '2026-08-03', endDate: '2026-08-09', sections: [], projectMode: 'all', generatedAt: '2026-08-09T00:00:00.000Z' });
    isoDict1.tasks.completed[0].text = 'MUTATED';
    isoDict1.projects.items[0].name = 'MUTATED';
    isoDict1.projects.items[0].expectedOrder.canonical = 'MUTATED';
    check('task source isolation after dict mutation', srcTask.text, 'Source Task');
    check('project source isolation after dict mutation', srcProject.name, 'SrcProj');
    check('nested period source isolation after dict mutation', srcProject.expectedOrder.canonical, '2026-Q4');

    srcTask.text = 'SRC_MUT';
    srcProject.name = 'SRC_MUT';
    srcProject.expectedOrder.canonical = 'SRC_MUT';
    check('task dict isolation after source mutation', isoDictPre.tasks.completed[0]?.text, 'Source Task');
    check('project dict isolation after source mutation', isoDictPre.projects.items[0]?.name, 'SrcProj');
    check('nested period dict isolation after source mutation', isoDictPre.projects.items[0]?.expectedOrder?.canonical, '2026-Q4');

    // 35. generator does not mutate the dictionary (secondary)
    const genDict = buildReportDictionary({ indexState: { ready: true, tasks: [], projects: [] }, startDate: '2026-08-03', endDate: '2026-08-09', sections: [], projectMode: 'all', generatedAt: '2026-08-09T00:00:00.000Z' });
    const genBefore = JSON.stringify(genDict);
    const genModule = globalThis.MME_QUICK_REPORT;
    if (genModule && typeof genModule.buildMarkdown === 'function') genModule.buildMarkdown(genDict);
    const genAfter = JSON.stringify(genDict);
    check('generator does not mutate dictionary', genAfter, genBefore);

    // -----------------------------------------------------------------
    // Report Notes structured contract (inline + multiline blocks) and
    // section label alignment.
    // -----------------------------------------------------------------
    const NOTES_FIXTURE_INPUT = [
      '{{title}}: Weekly Business Report',
      '{{summary}}:',
      '**Brazil remains the priority market.**',
      '',
      '- Supplier qualification',
      '- Installation planning',
      '{{/summary}}',
      '{{highlights}}: Supplier qualification progressed.',
      '{{risks}}: No major risks recorded.',
      '{{next steps}}:',
      '1. Confirm installation pricing',
      '2. Validate the delivery schedule',
      '{{/next steps}}',
    ].join('\n');
    const notesBefore = JSON.stringify(NOTES_FIXTURE_INPUT);

    // N1. inline standard fields consumed; valid notes have no diagnostics
    const nValid = parseReportNotes(NOTES_FIXTURE_INPUT);
    check('N1 inline highlights consumed', nValid.notes.some((n) => n.key === 'highlights' && n.value === 'Supplier qualification progressed.'), true);
    check('N1b inline risks consumed', nValid.notes.some((n) => n.key === 'risks' && n.value === 'No major risks recorded.'), true);
    check('N1c no structural diagnostics on valid notes', nValid.diagnostics.length, 0);

    // N2. multiline block value preserved (emphasis, blank line, list)
    const nSummary = nValid.notes.find((n) => n.key === 'summary');
    check('N2 multiline summary value', nSummary?.value, '**Brazil remains the priority market.**\n\n- Supplier qualification\n- Installation planning');

    // N3. ordered-list block value preserved
    const nNext = nValid.notes.find((n) => n.key === 'next steps');
    check('N3 multiline next steps value', nNext?.value, '1. Confirm installation pricing\n2. Validate the delivery schedule');

    // N4. inline + multiline coexist; blank block value stays blank
    const nBlank = parseReportNotes('{{summary}}:\n{{risks}}: something');
    check('N4 blank block value stays blank', nBlank.notes.some((n) => n.key === 'summary' && n.value === ''), true);

    // N5. structural errors block with field-identifying messages
    const nMissing = validateReportNotes('{{summary}}:\nBrazil remains the priority market.');
    check('N5 missing close blocks', nMissing.ok, false);
    check('N5b missing close message', nMissing.diagnostics.some((d) => d.code === 'notes-unclosed-block' && d.message.includes('{{/summary}}')), true);

    const nMismatch = validateReportNotes('{{highlights}}:\nText.\n{{/risks}}');
    check('N6 mismatched close blocks', nMismatch.diagnostics.some((d) => d.code === 'notes-mismatched-close' && d.message.includes('Expected the closing tag {{/highlights}}') && d.message.includes('{{/risks}}')), true);

    const nNested = validateReportNotes('{{summary}}:\nSome text\n{{risks}}: oops\n{{/summary}}');
    check('N7 nested field blocks', nNested.diagnostics.some((d) => d.code === 'notes-nested-field' && d.message.includes('{{/summary}}') && d.message.includes('{{risks}}')), true);

    const nOutside = validateReportNotes('{{risks}}: fine\nSome stray text.\n{{next steps}}: ok');
    check('N8 text outside field blocks', nOutside.diagnostics.some((d) => d.code === 'notes-text-outside-field' && d.message.includes('Some stray text.')), true);

    const nStray = validateReportNotes('{{risks}}: ok\n{{/summary}}');
    check('N9 stray close blocks', nStray.diagnostics.some((d) => d.code === 'notes-stray-close' && d.message.includes('{{/summary}}')), true);

    // N10. whitespace outside fields is accepted
    const nWs = validateReportNotes('{{risks}}: ok\n\n   \n\n{{next steps}}: ok\n');
    check('N10 whitespace outside fields accepted', nWs.ok, true);

    // N11. mismatched close inside a block: block still ends at exact token
    const nMismatchThenClose = parseReportNotes('{{summary}}:\nA\n{{/risks}}\nB\n{{/summary}}');
    check('N11 block ends at exact matching token', nMismatchThenClose.notes.find((n) => n.key === 'summary')?.value, 'A\nB');


    // N12. duplicate policy: entries kept, later value wins at field build
    const nDupInline = parseReportNotes('{{summary}}: first\n{{summary}}: second');
    check('N12 duplicate inline entries kept', nDupInline.notes.filter((n) => n.key === 'summary').length, 2);
    const nDupBlock = parseReportNotes('{{summary}}:\nfirst\n{{/summary}}\n{{summary}}:\nsecond\n{{/summary}}');
    check('N12b duplicate block entries kept', nDupBlock.notes.filter((n) => n.key === 'summary').length, 2);
    const nDupMixed = parseReportNotes('{{summary}}: inline\n{{summary}}:\nblocked\n{{/summary}}');
    check('N12c inline+block duplicates kept', nDupMixed.notes.filter((n) => n.key === 'summary').length, 2);

    // N13. custom (unknown) fields are accepted field entries
    const nCustom = parseReportNotes('{{customer message}}:\nThe customer requested:\n\n- revised pricing\n{{/customer message}}');
    check('N13 custom multiline field consumed', nCustom.notes.some((n) => n.key === 'customer message' && n.value === 'The customer requested:\n\n- revised pricing'), true);
    check('N13b custom field has no diagnostics', nCustom.diagnostics.length, 0);

    // N14. Notes input remains unmodified
    check('N14 notes input unmutated', JSON.stringify(NOTES_FIXTURE_INPUT), notesBefore);

    // N15. valid structured notes generate an ok dictionary carrying values
    const dictValid = buildReportDictionary({
      indexState: idx,
      startDate: '2026-08-03',
      endDate: '2026-08-09',
      sections: [{ id: 'summary', enabled: true }],
      projectMode: 'all',
      reportNotes: NOTES_FIXTURE_INPUT,
    });
    check('N15 valid structured notes generate ok dictionary', dictValid?.ok, true);
    check('N15b dictionary carries the multiline summary', (dictValid?.notes || []).find((n) => n.key === 'summary')?.value, nSummary?.value);

    // N16. summary section label owns both generated headings
    check('N16 label is Summary & Highlights', DEFAULT_SECTION_ORDER[0]?.label, 'Summary & Highlights');
    const orderedLabel = normalizeSectionOrder([{ id: 'summary', enabled: true }]).sections?.[0]?.label;
    check('N16b normalized label preserved', orderedLabel, 'Summary & Highlights');

    const failed = results.filter((r) => !r.pass);
    return { ok: failed.length === 0, total: results.length, passed: results.length - failed.length, failed: failed.length, cases: results };
  }

  const MME_REPORT_DICTIONARY = Object.freeze({
    SCHEMA_VERSION,
    DEFAULT_SECTION_ORDER,
    normalizeReportKey,
    normalizeReportRange,
    parseReportNotes,
    validateReportNotes,
    selectCompletedTasks,
    selectProjects,
    calculateProjectTotals,
    normalizeSectionOrder,
    buildReportDictionary,
    validateReportDictionary,
  });

  try {
    window.MME_REPORT_DICTIONARY = MME_REPORT_DICTIONARY;
    globalThis.MME_REPORT_DICTIONARY = MME_REPORT_DICTIONARY;
  } catch {}
})();
