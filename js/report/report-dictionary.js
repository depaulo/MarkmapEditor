// @ts-nocheck
// ACT E — Report Dictionary. Pure data preparation. No UI, no DOM, no file ops.
(function () {
  'use strict';

  const SCHEMA_VERSION = 'mme-report-dictionary-v1';

  const DEFAULT_SECTION_ORDER = Object.freeze([
    { id: 'summary', label: 'Summary and Highlights', enabled: true },
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
    // Brace-token canonical form: {{summary}} -> report.summary via aliases.
    const braceInner = normalizeBraceToken(key);
    if (braceInner) {
      if (NOTE_ALIASES[braceInner]) return NOTE_ALIASES[braceInner];
      // Unknown custom brace token preserved as its normalized name.
      return braceInner.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
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
    };
    return m[nk] || nk;
  }

  function parseReportNotes(reportNotes, injectedPairs) {
    const notes = [];
    const diagnostics = [];
    let pairs = injectedPairs;

    if (!Array.isArray(pairs)) {
      const parser =
        (typeof globalThis !== 'undefined' && globalThis.WORKSPACE_PARSER?.parseDictionaryPairs) ||
        (typeof window !== 'undefined' && window.WORKSPACE_PARSER?.parseDictionaryPairs) ||
        null;
      if (parser) {
        try {
          pairs = parser(reportNotes);
        } catch (e) {
          diagnostics.push({
            code: 'notes-parse-failed',
            message: 'Report Notes parsing failed: ' + (e?.message || e),
          });
          pairs = [];
        }
      } else {
        pairs = [];
        const lines = String(reportNotes || '').split(/\r?\n/);
        for (const line of lines) {
          const t = line.trim();
          if (!t || /^#{1,6}\s/.test(t)) continue;
          const m = t.match(/^([A-Za-z][A-Za-z0-9 _-]*)\s*:\s*(.*)$/);
          if (m) pairs.push({ key: m[1].trim(), value: m[2].trim() });
          else diagnostics.push({ code: 'note-malformed', message: 'Malformed note line: ' + t });
        }
      }
    }

    let order = 0;
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
    const totals = Array.from(totalsByCurrency.values()).sort((a
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
    check('notes malformed diag', notesResult.diagnostics.some((d) => d.code === 'note-malformed'), true);

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

    const failed = results.filter((r) => !r.pass);
    return { ok: failed.length === 0, total: results.length, passed: results.length - failed.length, failed: failed.length, cases: results };
  }

  const MME_REPORT_DICTIONARY = Object.freeze({
    SCHEMA_VERSION,
    DEFAULT_SECTION_ORDER,
    normalizeReportKey,
    normalizeReportRange,
    parseReportNotes,
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
